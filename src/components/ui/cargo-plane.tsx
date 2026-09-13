"use client"

/**
 * cargo-plane — a high-wing freighter, and the turn it has to bank to make.
 *
 * An aircraft cannot steer. Ask this one for a rate of turn and the bank is
 * *solved*: at an airspeed and a turn rate the radius is fixed, and a
 * coordinated turn stands at `atan(v²/rg)`. So the same commanded turn banks
 * further at speed and less in a wide one, and a rate the machine cannot hold
 * is a bank it will not reach.
 *
 * The ailerons are not a second animation. They carry the roll the autopilot
 * has *left to do* — the difference between the bank it is holding and the one
 * the turn asks for — which is why they come back to neutral once the turn is
 * established, and why they never move in level flight.
 *
 * The wing is a flat plate and the propellers are drawn rather than solved.
 * Nothing here computes lift, drag, load factor or a stall.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { coordinatedBank } from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

const VIEW_SIZE = 250
const NATIVE_VIEW: RobotView = "plan"

const NOSE = -118
const TAIL = 112
const WING_Z = -14
const WING_Y = 13
const HALF_SPAN = 104
const FIN_TOP = 62
const MAX_TURN = 6
const MAX_BANK = 38
/** Degrees of bank per second the autopilot rolls at. */
const ROLL_RATE = 9
/** Aileron per degree of bank still to establish. */
const AILERON_GAIN = 1.6
const MAX_AILERON = 18

const ENVELOPE = boxCorners(
  { x: -112, y: -26, z: -124 },
  { x: 112, y: 74, z: 118 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Fuselage radius at a station: a nose cone, a constant barrel, an upswept tail. */
const fuselageRadius = (z: number) => {
  if (z < NOSE + 28) return 15 * Math.sqrt(Math.max(0, (z - NOSE) / 28))
  if (z > TAIL - 54) return 15 * (1 - ((z - (TAIL - 54)) / 54) * 0.5)
  return 15
}

/** Wing planform in the horizontal plane: x across, z along the machine. */
const wingPanel = (from: number, to: number): Vec2[] => {
  const chord = (x: number) => 34 - (Math.abs(x) / HALF_SPAN) * 16
  const sweep = (x: number) => WING_Z + (Math.abs(x) / HALF_SPAN) * 12
  return [
    { x: from, y: sweep(from) - chord(from) / 2 },
    { x: to, y: sweep(to) - chord(to) / 2 },
    { x: to, y: sweep(to) + chord(to) / 2 },
    { x: from, y: sweep(from) + chord(from) / 2 },
  ]
}

export type CargoPlaneBehavior = "cruise" | "circuit" | "approach" | "static"

export interface CargoPlaneProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Commanded rate of turn, degrees per second, positive to starboard. Supplying it stops the loop. */
  turn?: number
  onTurnChange?: (turn: number) => void
  /** True airspeed in metres per second. The bank is not the same at every speed. */
  airspeed?: number
  /** Flaps and gear together, 0 clean to 1 dirty. Omit and the behaviour sets it. */
  configuration?: number
  behavior?: CargoPlaneBehavior
  /** Two engines or four. */
  engines?: 2 | 4
  view?: RobotView
  /** The rear loading ramp, down at the dirty end of the configuration. */
  showRamp?: boolean
  /** Light the navigation and anti-collision lamps. */
  active?: boolean
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function CargoPlane({
  turn,
  onTurnChange,
  airspeed = 110,
  configuration,
  behavior = "cruise",
  engines = 4,
  view = NATIVE_VIEW,
  showRamp = true,
  active,
  interactive = false,
  speed = 0.2,
  animate = true,
  paused = false,
  phase = 0,
  label,
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: CargoPlaneProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = turn !== undefined

  const rate = controlled
    ? Number.isFinite(turn) ? clamp(turn as number, -MAX_TURN, MAX_TURN) : 0
    : held
  const v = Number.isFinite(airspeed) ? clamp(airspeed, 20, 300) : 110
  /** Bank for a rate of turn: the radius is v/ω, and the turn is coordinated. */
  const bankFor = React.useCallback(
    (ofTurn: number) => {
      if (ofTurn === 0) return 0
      const radius = v / toRadians(Math.abs(ofTurn))
      return Math.sign(ofTurn) * Math.min(coordinatedBank(v, radius), MAX_BANK)
    },
    [v],
  )
  const goal = React.useCallback(
    (clock: number) => bankFor(planeTurn(behavior, clock)),
    [bankFor, behavior],
  )
  // A supplied or held rate of turn pins the bank it implies; the clock keeps
  // running underneath, so releasing it rolls back into the behaviour.
  const hold = rate === null || rate === undefined ? null : bankFor(rate)
  const motion = useRobotScalar(goal, {
    rate: ROLL_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const bank = clamp(motion.value, -MAX_BANK, MAX_BANK)
  // A non-finite phase parks the clock at NaN; nothing derived from it may
  // reach the DOM.
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const commanded = hold ?? goal(clock)
  // The ailerons hold the roll the autopilot has not finished, so they return
  // to neutral once the turn is established.
  const aileron = clamp((commanded - bank) * AILERON_GAIN, -MAX_AILERON, MAX_AILERON)
  const dirty = configuration !== undefined
    ? Number.isFinite(configuration) ? clamp(configuration, 0, 1) : 0
    : planeConfig(behavior, clock)
  const flap = dirty * 35
  const gear = clamp((dirty - 0.35) / 0.35, 0, 1)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, -MAX_TURN, MAX_TURN) * 10) / 10
      setHeld(bounded)
      onTurnChange?.(bounded)
    },
    [onTurnChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * MAX_TURN),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_SIZE, VIEW_SIZE)
  const bankRad = toRadians(bank)
  const cosBank = Math.cos(bankRad)
  const sinBank = Math.sin(bankRad)
  /** The whole airframe turns about its own fore-aft axis. */
  const banked = (point: Vec3): Vec3 => ({
    x: point.x * cosBank + point.y * sinBank,
    y: -point.x * sinBank + point.y * cosBank,
    z: point.z,
  })
  const solid = (corners: Vec3[]) => slabPath(corners.map(banked), camera)
  const to = (point: Vec3) => {
    const turned = banked(point)
    return camera.project(turned.x, turned.y, turned.z)
  }
  const line = (points: Vec3[], close = false) =>
    `${points
      .map((point, index) => {
        const screen = to(point)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  /** A run of fuselage, as the cross-sections it really has. */
  const tube = (from: number, to_: number, steps = 8, radius = fuselageRadius, cy = 0) =>
    Array.from({ length: steps + 1 }, (_, index) => from + ((to_ - from) * index) / steps)
      .flatMap((z) => {
        const r = radius(z)
        return Array.from({ length: 10 }, (_, spoke) => {
          const angle = (spoke / 10) * Math.PI * 2
          return { x: Math.cos(angle) * r, y: cy + Math.sin(angle) * r, z }
        })
      })
  /** A flat panel in the horizontal plane, given its planform. */
  const plate = (planform: Vec2[], y: number, thickness: number): Vec3[] =>
    planform.flatMap((point) => [
      { x: point.x, y: y + thickness, z: point.y },
      { x: point.x, y: y - thickness, z: point.y },
    ])
  /** The same, hinged down about a spanwise line: a flap, or an aileron. */
  const hinged = (planform: Vec2[], y: number, thickness: number, hinge: number, deflect: number) => {
    const angle = toRadians(deflect)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return plate(planform, y, thickness).map((corner) => {
      const dz = corner.z - hinge
      const dy = corner.y - y
      return { x: corner.x, y: y + dz * sin + dy * cos, z: hinge + dz * cos - dy * sin }
    })
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const flying = !controlled && behavior !== "static" && animate && !paused
  const lamps = active ?? flying
  const readout = Math.round(bank)
  const spin = clock * 620

  const nacelles = (engines === 2 ? [52, -52] : [40, 74, -40, -74]).map((x) => ({
    x,
    z: WING_Z + (Math.abs(x) / HALF_SPAN) * 12 - 26,
  }))

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `${engines}-engine cargo aircraft, banked ${readout} degrees, ${viewNames[view] ?? viewNames.plan}`
      }
      aria-valuemin={interactive ? -MAX_TURN : undefined}
      aria-valuemax={interactive ? MAX_TURN : undefined}
      aria-valuenow={interactive ? px(rate ?? 0) : undefined}
      aria-valuetext={interactive ? `turning ${px(rate ?? 0)} degrees per second` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 1 : 0.5, 3)
        if (delta !== 0) apply((rate ?? 0) + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      width={width}
      height={width}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M ${VIEW_SIZE / 2} 8 V ${VIEW_SIZE - 8} M 8 ${VIEW_SIZE / 2} H ${VIEW_SIZE - 8}`}
            strokeDasharray="2 3"
          />
        </g>
      )}

      <g
        data-view={view}
        data-bank={px(bank)}
        data-aileron={px(aileron)}
        data-configuration={px(dirty)}
        transform={frame || undefined}
      >
        <g data-airframe>
          <path d={solid(tube(NOSE, TAIL))} {...shell} />
          {/* Flight deck glazing, on the crown of the nose. */}
          <path
            data-flightdeck
            d={line(
              [
                { x: -9, y: 11, z: NOSE + 20 },
                { x: 9, y: 11, z: NOSE + 20 },
                { x: 8, y: 13, z: NOSE + 34 },
                { x: -8, y: 13, z: NOSE + 34 },
              ],
              true,
            )}
            fill={palette.dark}
            opacity={0.6}
          />
          {showRamp && (
            <path
              data-ramp
              d={solid(
                hinged(
                  [
                    { x: -11, y: TAIL - 46 },
                    { x: 11, y: TAIL - 46 },
                    { x: 11, y: TAIL - 14 },
                    { x: -11, y: TAIL - 14 },
                  ],
                  -7,
                  1.4,
                  TAIL - 46,
                  dirty * 46,
                ),
              )}
              {...machined}
            />
          )}
        </g>

        <g data-wing="port">
          <path d={solid(plate(wingPanel(-HALF_SPAN, -12), WING_Y, 3))} {...shell} />
          <path
            data-flap="port"
            d={solid(
              hinged(
                [
                  { x: -62, y: WING_Z + 8 },
                  { x: -18, y: WING_Z + 12 },
                  { x: -18, y: WING_Z + 19 },
                  { x: -62, y: WING_Z + 17 },
                ],
                WING_Y,
                1.6,
                WING_Z + 8,
                flap,
              ),
            )}
            {...machined}
          />
          <path
            data-aileron="port"
            d={solid(
              hinged(
                [
                  { x: -98, y: WING_Z + 13 },
                  { x: -68, y: WING_Z + 11 },
                  { x: -68, y: WING_Z + 17 },
                  { x: -98, y: WING_Z + 18 },
                ],
                WING_Y,
                1.4,
                WING_Z + 12,
                -aileron,
              ),
            )}
            {...machined}
          />
        </g>
        <g data-wing="starboard">
          <path d={solid(plate(wingPanel(12, HALF_SPAN), WING_Y, 3))} {...shell} />
          <path
            data-flap="starboard"
            d={solid(
              hinged(
                [
                  { x: 18, y: WING_Z + 12 },
                  { x: 62, y: WING_Z + 8 },
                  { x: 62, y: WING_Z + 17 },
                  { x: 18, y: WING_Z + 19 },
                ],
                WING_Y,
                1.6,
                WING_Z + 8,
                flap,
              ),
            )}
            {...machined}
          />
          <path
            data-aileron="starboard"
            d={solid(
              hinged(
                [
                  { x: 68, y: WING_Z + 11 },
                  { x: 98, y: WING_Z + 13 },
                  { x: 98, y: WING_Z + 18 },
                  { x: 68, y: WING_Z + 17 },
                ],
                WING_Y,
                1.4,
                WING_Z + 12,
                aileron,
              ),
            )}
            {...machined}
          />
        </g>

        <g data-tail>
          {/* Fin, then a tailplane on top of it: the load-through layout. */}
          <path
            d={solid(
              [
                { x: -2.5, y: 4, z: TAIL - 44 },
                { x: 2.5, y: 4, z: TAIL - 44 },
                { x: -2.5, y: FIN_TOP, z: TAIL - 12 },
                { x: 2.5, y: FIN_TOP, z: TAIL - 12 },
                { x: -2.5, y: FIN_TOP, z: TAIL + 4 },
                { x: 2.5, y: FIN_TOP, z: TAIL + 4 },
                { x: -2.5, y: 4, z: TAIL - 4 },
                { x: 2.5, y: 4, z: TAIL - 4 },
              ],
            )}
            {...shell}
          />
          <path
            data-tailplane
            d={solid(
              plate(
                [
                  { x: -48, y: TAIL - 6 },
                  { x: 48, y: TAIL - 6 },
                  { x: 48, y: TAIL + 6 },
                  { x: -48, y: TAIL + 6 },
                ],
                FIN_TOP,
                2,
              ),
            )}
            {...shell}
          />
        </g>

        {nacelles.map((nacelle) => (
          <g key={nacelle.x} data-engine={nacelle.x < 0 ? `port-${Math.abs(nacelle.x)}` : `starboard-${nacelle.x}`}>
            <path
              d={solid(
                tube(nacelle.z, nacelle.z + 34, 3, () => 7.5, 0).map((corner) => ({
                  x: corner.x + nacelle.x,
                  y: corner.y + WING_Y,
                  z: corner.z,
                })),
              )}
              {...machined}
            />
            <g data-prop={nacelle.x}>
              {[0, 90, 180, 270].map((blade) => {
                const angle = toRadians(spin + blade)
                return (
                  <path
                    key={blade}
                    d={line([
                      { x: nacelle.x, y: WING_Y, z: nacelle.z - 1 },
                      {
                        x: nacelle.x + Math.cos(angle) * 24,
                        y: WING_Y + Math.sin(angle) * 24,
                        z: nacelle.z - 1,
                      },
                    ])}
                    fill="none"
                    stroke={palette.metal}
                    strokeWidth={1.6}
                    opacity={0.55}
                  />
                )
              })}
            </g>
          </g>
        ))}

        {gear > 0.01 && (
          <g data-gear data-extension={px(gear)}>
            {[
              { x: 0, z: NOSE + 34, drop: 22 * gear },
              { x: -19, z: WING_Z + 26, drop: 26 * gear },
              { x: 19, z: WING_Z + 26, drop: 26 * gear },
            ].map((leg) => (
              <g key={`${leg.x}-${leg.z}`}>
                <path
                  d={line([
                    { x: leg.x, y: -8, z: leg.z },
                    { x: leg.x, y: -8 - leg.drop, z: leg.z },
                  ])}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                />
                <path
                  d={solid(
                    tube(leg.z - 5, leg.z + 5, 2, () => 5, 0).map((corner) => ({
                      x: corner.x * 0.34 + leg.x,
                      y: corner.y - 8 - leg.drop,
                      z: corner.z,
                    })),
                  )}
                  {...cast}
                />
              </g>
            ))}
          </g>
        )}

        {/* Navigation lamps: red to port, green to starboard, in the set's own
            two colours, plus the beacon on the fin. */}
        <path
          data-lamp="port"
          d={line([
            { x: -HALF_SPAN + 1, y: WING_Y, z: WING_Z + 10 },
            { x: -HALF_SPAN + 6, y: WING_Y, z: WING_Z + 10 },
          ])}
          fill="none"
          stroke={lamps ? palette.shell : palette.metal}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          data-lamp="starboard"
          d={line([
            { x: HALF_SPAN - 1, y: WING_Y, z: WING_Z + 10 },
            { x: HALF_SPAN - 6, y: WING_Y, z: WING_Z + 10 },
          ])}
          fill="none"
          stroke={lamps ? palette.accent : palette.metal}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <path
          data-lamp="beacon"
          d={line([
            { x: 0, y: FIN_TOP + 1, z: TAIL - 2 },
            { x: 0, y: FIN_TOP + 5, z: TAIL - 2 },
          ])}
          fill="none"
          stroke={lamps ? palette.accent : palette.metal}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>

      {label && (
        <text
          x={VIEW_SIZE / 2}
          y={VIEW_SIZE - 5}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

/** The rate of turn the autopilot is asking for, degrees per second. */
export function planeTurn(behavior: CargoPlaneBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  switch (behavior) {
    case "circuit":
      // Rate one each way, with the straight legs between the turns.
      return Math.tanh(Math.sin(t) * 2.4) * 3
    case "approach":
      return Math.sin(t) * 1.2
    default:
      return Math.sin(t * 0.5) * 0.6
  }
}

/** Flaps and gear together, 0 clean to 1 dirty. Only an approach is dirty. */
export function planeConfig(behavior: CargoPlaneBehavior, clock: number): number {
  if (behavior !== "approach" || !Number.isFinite(clock)) return 0
  const cycle = ((clock * 0.4) % 1 + 1) % 1
  if (cycle < 0.25) return cycle / 0.25
  if (cycle < 0.75) return 1
  return Math.max(0, 1 - (cycle - 0.75) / 0.25)
}

export { CargoPlane }
