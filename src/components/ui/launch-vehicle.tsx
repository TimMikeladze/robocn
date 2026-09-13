"use client"

/**
 * launch-vehicle — a two-stage booster, and the half of itself it throws away.
 *
 * `ascent` is the whole machine. It flies the pitch program, so the stack tips
 * downrange on its own; it stages, so past the separation point the first stage
 * is a *separate body* falling behind with its grid fins out; and it is what
 * the readout reports against, because the Δv left is the rocket equation
 * summed over the stages still attached. Throw the booster away and the number
 * drops, which is the only honest way to draw staging.
 *
 * The engines gimbal against the program rather than being animated: they
 * carry the pitch the stack has not taken up yet, so they centre once it is
 * tracking and swing hardest through the pitchover.
 *
 * The rocket equation is exact. The pitch program is an illustrative curve, not
 * a solved trajectory, and nothing here integrates a flight: no thrust, no
 * drag, no gravity losses, no atmosphere.
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
import { pitchProgram, stackDeltaV, type RocketStage } from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 300
const NATIVE_VIEW: RobotView = "front"

/** The stack, in world units: the pad deck at y = 0, downrange toward +x. */
const RADIUS = 15
const FIRST_TOP = 148
const INTERSTAGE = 160
const SECOND_TOP = 228
const FAIRING_TOP = 274
const ENGINE_DROP = 13
const FIN_HEIGHT = 134
/** Where in the ascent the first stage lets go. */
const STAGE_AT = 0.44
/** Degrees of nozzle per degree of pitch the stack has not taken up. */
const GIMBAL_GAIN = 0.7
const MAX_GIMBAL = 8
/** Ascent per second while it eases back into a behaviour. */
const ASCENT_RATE = 0.22

/** The vehicle as flown, for the readout. Stated numbers, not a real vehicle. */
const STAGES: RocketStage[] = [
  { massRatio: 3.4, exhaustVelocity: 2900 },
  { massRatio: 5.2, exhaustVelocity: 3350 },
]

/**
 * The vehicle's own frame. It turns about its own middle and stays in the
 * picture; the pad is what falls away, which is how the drawing says "climbing"
 * without the machine breathing inside its own frame.
 */
const CENTRE = 140
const ENVELOPE = boxCorners(
  { x: -152, y: CENTRE - 156, z: -60 },
  { x: 152, y: CENTRE + 156, z: 60 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type LaunchVehicleBehavior = "ascent" | "hold" | "static"

export interface LaunchVehicleProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the vehicle is in its ascent, 0 on the pad to 1 at insertion. Supplying it stops the loop. */
  ascent?: number
  onAscentChange?: (ascent: number) => void
  behavior?: LaunchVehicleBehavior
  view?: RobotView
  /** Engines in the first-stage cluster. */
  engines?: 5 | 9
  /** The pad, and the hold-down it lifts off. */
  showPad?: boolean
  /** Pitch, altitude and the remaining ideal Δv, as a readout. */
  showReadout?: boolean
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function LaunchVehicle({
  ascent,
  onAscentChange,
  behavior = "ascent",
  view = NATIVE_VIEW,
  engines = 9,
  showPad = true,
  showReadout = true,
  interactive = false,
  speed = 0.16,
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
}: LaunchVehicleProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = ascent !== undefined

  const hold = controlled
    ? Number.isFinite(ascent) ? clamp(ascent as number, 0, 1) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => launchAscent(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: ASCENT_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const flown = clamp(motion.value, 0, 1)
  const programmed = pitchProgram(flown)
  // The stack takes the program up with a lag, and the engines carry whatever
  // it has not taken: they centre once it is tracking.
  const attitude = pitchProgram(clamp(flown - 0.05, 0, 1))
  const gimbal = clamp((programmed - attitude) * GIMBAL_GAIN, -MAX_GIMBAL, MAX_GIMBAL)
  const separated = clamp((flown - STAGE_AT) / 0.1, 0, 1)
  const remaining = stackDeltaV(separated >= 1 ? STAGES.slice(1) : STAGES)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onAscentChange?.(bounded)
    },
    [onAscentChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)

  /** A world point on a body pitched `tilt` degrees downrange about CENTRE. */
  const posed = (tilt: number, rise: number, drift: number) => {
    const angle = toRadians(tilt)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return (point: Vec3): Vec3 => {
      const dy = point.y - CENTRE
      return {
        x: point.x * cos + dy * sin + drift,
        y: CENTRE - point.x * sin + dy * cos + rise,
        z: point.z,
      }
    }
  }
  const stack = posed(attitude, 0, 0)
  // The spent stage keeps the attitude it was let go at, and falls behind.
  const spent = posed(
    pitchProgram(STAGE_AT) + separated * 26,
    -separated * 54,
    -separated * 30,
  )

  const solid = (corners: Vec3[], place: (point: Vec3) => Vec3) =>
    slabPath(corners.map(place), camera)
  const to = (point: Vec3, place: (point: Vec3) => Vec3) => {
    const moved = place(point)
    return camera.project(moved.x, moved.y, moved.z)
  }
  const line = (points: Vec3[], place: (point: Vec3) => Vec3, close = false) =>
    `${points
      .map((point, index) => {
        const screen = to(point, place)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  /** A body of revolution about the machine's own long axis. */
  const barrel = (from: number, to_: number, radius: (y: number) => number, steps = 4) =>
    Array.from({ length: steps + 1 }, (_, index) => from + ((to_ - from) * index) / steps)
      .flatMap((y) => {
        const r = radius(y)
        return Array.from({ length: 12 }, (_, spoke) => {
          const angle = (spoke / 12) * Math.PI * 2
          return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r }
        })
      })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const nozzles = engines === 5
    ? [{ x: 0, z: 0 }, ...[0, 90, 180, 270].map((a) => ({
        x: Math.cos(toRadians(a)) * 9.5,
        z: Math.sin(toRadians(a)) * 9.5,
      }))]
    : [{ x: 0, z: 0 }, ...Array.from({ length: 8 }, (_, index) => {
        const a = toRadians((index / 8) * 360)
        return { x: Math.cos(a) * 9.5, z: Math.sin(a) * 9.5 }
      })]
  const firstBurning = flown > 0.01 && separated < 1
  const secondBurning = separated > 0.2 && flown < 0.99
  const plume = firstBurning ? 26 + flown * 40 : 0

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Two-stage launch vehicle, ${Math.round(flown * 100)} percent through its ascent, pitched ${Math.round(attitude)} degrees from vertical, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(flown) : undefined}
      aria-valuetext={interactive ? `${Math.round(flown * 100)} percent through the ascent` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.2)
        if (delta !== 0) apply(flown + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
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
          <path d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 8}`} strokeDasharray="2 3" />
        </g>
      )}

      <g
        data-view={view}
        data-ascent={px(flown)}
        data-pitch={px(attitude)}
        data-separation={px(separated)}
        transform={frame || undefined}
      >
        {showPad && (
          <g data-pad data-fallaway={px(flown)} opacity={clamp(1 - flown * 7, 0, 1)} transform={`translate(0 ${px(flown * 240)})`}>
            <path
              d={slabPath(
                [
                  { x: -40, y: -2, z: -30 },
                  { x: 40, y: -2, z: -30 },
                  { x: 40, y: -2, z: 30 },
                  { x: -40, y: -2, z: 30 },
                  { x: -40, y: -18, z: -30 },
                  { x: 40, y: -18, z: -30 },
                  { x: 40, y: -18, z: 30 },
                  { x: -40, y: -18, z: 30 },
                ],
                camera,
              )}
              {...cast}
            />
            {[-1, 1].map((side) => (
              <path
                key={side}
                data-holddown={side < 0 ? "port" : "starboard"}
                d={slabPath(
                  [
                    { x: side * 20, y: -2, z: -5 },
                    { x: side * 20, y: -2, z: 5 },
                    { x: side * 26, y: 26, z: -4 },
                    { x: side * 26, y: 26, z: 4 },
                  ],
                  camera,
                )}
                {...machined}
              />
            ))}
          </g>
        )}

        {/* The spent stage, once it is a body of its own. */}
        {separated > 0.01 && (
          <g data-stage="first" data-spent="true" opacity={clamp(1.15 - separated * 0.4, 0, 1)}>
            <path d={solid(barrel(0, FIRST_TOP, () => RADIUS, 3), spent)} {...machined} />
            {[0, 90, 180, 270].map((angle) => {
              const a = toRadians(angle)
              return (
                <path
                  key={angle}
                  data-fin={angle}
                  d={solid(
                    [
                      { x: Math.cos(a) * RADIUS, y: FIN_HEIGHT, z: Math.sin(a) * RADIUS },
                      { x: Math.cos(a) * (RADIUS + 18 * separated), y: FIN_HEIGHT, z: Math.sin(a) * (RADIUS + 18 * separated) },
                      { x: Math.cos(a) * (RADIUS + 18 * separated), y: FIN_HEIGHT + 15, z: Math.sin(a) * (RADIUS + 18 * separated) },
                      { x: Math.cos(a) * RADIUS, y: FIN_HEIGHT + 15, z: Math.sin(a) * RADIUS },
                    ],
                    spent,
                  )}
                  {...cast}
                />
              )
            })}
          </g>
        )}

        <g data-stack>
          {separated < 1 && (
            <g data-stage="first">
              <path d={solid(barrel(0, FIRST_TOP, () => RADIUS, 3), stack)} {...shell} />
              {/* A band at each tank dome, so the stage reads as tankage. */}
              {[42, 96].map((y) => (
                <path
                  key={y}
                  d={line(
                    [
                      { x: -RADIUS, y, z: 0 },
                      { x: RADIUS, y, z: 0 },
                    ],
                    stack,
                  )}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={1.6}
                  opacity={0.5}
                />
              ))}
              <g data-gimbal data-angle={px(gimbal)}>
                {nozzles.map((nozzle) => {
                  const swing = toRadians(gimbal)
                  const foot = {
                    x: nozzle.x + Math.sin(swing) * ENGINE_DROP,
                    y: -ENGINE_DROP,
                    z: nozzle.z,
                  }
                  return (
                    <path
                      key={`${nozzle.x}-${nozzle.z}`}
                      data-engine={`${px(nozzle.x)}-${px(nozzle.z)}`}
                      d={solid(
                        [
                          { x: nozzle.x - 2.4, y: 1, z: nozzle.z - 2.4 },
                          { x: nozzle.x + 2.4, y: 1, z: nozzle.z + 2.4 },
                          { x: nozzle.x - 2.4, y: 1, z: nozzle.z + 2.4 },
                          { x: nozzle.x + 2.4, y: 1, z: nozzle.z - 2.4 },
                          { x: foot.x - 4.4, y: foot.y, z: foot.z - 4.4 },
                          { x: foot.x + 4.4, y: foot.y, z: foot.z + 4.4 },
                          { x: foot.x - 4.4, y: foot.y, z: foot.z + 4.4 },
                          { x: foot.x + 4.4, y: foot.y, z: foot.z - 4.4 },
                        ],
                        stack,
                      )}
                      {...cast}
                    />
                  )
                })}
              </g>
              {plume > 0 && (
                <path
                  data-plume="first"
                  d={solid(
                    [
                      { x: -13, y: -ENGINE_DROP, z: -13 },
                      { x: 13, y: -ENGINE_DROP, z: 13 },
                      { x: -13, y: -ENGINE_DROP, z: 13 },
                      { x: 13, y: -ENGINE_DROP, z: -13 },
                      { x: Math.sin(toRadians(gimbal)) * plume, y: -ENGINE_DROP - plume, z: 0 },
                    ],
                    stack,
                  )}
                  fill={palette.glow}
                  opacity={0.55}
                />
              )}
            </g>
          )}

          <g data-stage="second">
            <path
              d={solid(barrel(INTERSTAGE, SECOND_TOP, () => RADIUS - 0.6, 2), stack)}
              {...shell}
            />
            <path
              d={solid(
                barrel(FIRST_TOP, INTERSTAGE, () => RADIUS, 1),
                stack,
              )}
              {...machined}
            />
            <path
              data-fairing
              d={solid(
                barrel(SECOND_TOP, FAIRING_TOP, (y) => {
                  const t = (y - SECOND_TOP) / (FAIRING_TOP - SECOND_TOP)
                  return (RADIUS - 0.6) * Math.sqrt(Math.max(0, 1 - t * t))
                }, 5),
                stack,
              )}
              {...shell}
            />
            <path
              data-seam
              d={line(
                [
                  { x: 0, y: SECOND_TOP, z: 0 },
                  { x: 0, y: FAIRING_TOP, z: 0 },
                ],
                stack,
              )}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
              opacity={0.55}
            />
            {secondBurning && (
              <path
                data-plume="second"
                d={solid(
                  [
                    { x: -7, y: INTERSTAGE - 2, z: -7 },
                    { x: 7, y: INTERSTAGE - 2, z: 7 },
                    { x: -7, y: INTERSTAGE - 2, z: 7 },
                    { x: 7, y: INTERSTAGE - 2, z: -7 },
                    { x: 0, y: INTERSTAGE - 34, z: 0 },
                  ],
                  stack,
                )}
                fill={palette.accent}
                opacity={0.5}
              />
            )}
          </g>
        </g>
      </g>

      {showReadout && (
        <g data-readout fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          <text x={10} y={16}>{`PITCH ${String(Math.round(attitude)).padStart(2, " ")}°`}</text>
          <text x={10} y={26}>{`STAGE ${separated >= 1 ? "2" : "1"}`}</text>
          <text x={10} y={36}>{`ΔV ${Math.round(remaining)} m/s`}</text>
        </g>
      )}

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 5}
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

/** Where in the ascent the vehicle is at `clock`, 0 on the pad to 1 at insertion. */
export function launchAscent(behavior: LaunchVehicleBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "hold") return 0
  // One flight per cycle, with a beat on the pad before each.
  const cycle = ((clock * 0.5) % 1 + 1) % 1
  return clamp((cycle - 0.12) / 0.82, 0, 1)
}

export { LaunchVehicle }
