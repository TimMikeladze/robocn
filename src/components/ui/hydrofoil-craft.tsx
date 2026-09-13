"use client"

/**
 * hydrofoil-craft — the one machine in the set that climbs out of its own
 * ground plane.
 *
 * Everything else stands on the floor or floats in it. This one leaves it.
 * Lift goes as the *square* of speed, so a surface-piercing foil carrying a
 * steady weight has to shed immersed area as `1/v²` — and the only way it can
 * is by rising until less of the V is in the water. That is the whole machine:
 * `knots` sets the rise, the rise lifts the hull, and the wetted length of each
 * foil limb is what is left below the waterline.
 *
 * Two things follow for free. Below the takeoff speed the foil cannot carry the
 * boat at all, so it stays hullborne and rides the swell; foilborne, the struts
 * are all that touch the water and the ride goes quiet — which is what a
 * hydrofoil is for.
 *
 * The lift relation is real. Nothing else here is: no drag, no wave-making, no
 * cavitation, no righting moment, and the swell is a stated shape.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
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
import { foilRise, rollPoint } from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 290
const VIEW_HEIGHT = 170
const NATIVE_VIEW: RobotView = "profile"

/** The craft in its own profile: keel at y = 0, bow toward +x. */
const STERN = -4
const BOW = 236
const KEEL = 0
const DECK = 34
const HALF_BEAM = 26
/** How deep the keel sits when the foils are carrying nothing. */
const DRAFT = 11
/** How far the keel stands clear once the boat is fully foilborne. */
const CLEARANCE = 20
/** Strut stations, and how far the foils hang below the keel. */
const FORE_STRUT = 178
const AFT_STRUT = 44
const STRUT_DROP = 22
/** Half-span of the V, and how far its tips stand above its root. */
const FOIL_SPAN = 30
const FOIL_DIHEDRAL = 18
const MID = (STERN + BOW) / 2
const MAX_KNOTS = 60
/** Knots per second the throttle moves at while easing back into a behaviour. */
const THROTTLE_RATE = 11

const ENVELOPE = boxCorners(
  { x: -40, y: -46, z: -244 },
  { x: 40, y: 82, z: 12 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Half-beam at a height: fine at the keel, full at the deck. */
const beamAt = (y: number) => HALF_BEAM * clamp(0.42 + (y - KEEL) / 44, 0.3, 1)

/** The hull's sheer, from the transom to the stem. */
const HULL: Vec2[] = [
  { x: STERN, y: KEEL + 6 },
  { x: STERN, y: DECK },
  { x: BOW - 40, y: DECK + 3 },
  { x: BOW, y: DECK - 2 },
  { x: BOW - 16, y: KEEL + 9 },
  { x: STERN + 26, y: KEEL },
]

/** The cabin, set in from the sheer and raked at both ends. */
const CABIN: Vec2[] = [
  { x: STERN + 24, y: DECK },
  { x: STERN + 34, y: DECK + 26 },
  { x: BOW - 56, y: DECK + 28 },
  { x: BOW - 38, y: DECK },
]

export type HydrofoilBehavior = "takeoff" | "foilborne" | "moor" | "static"

export interface HydrofoilCraftProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Speed through the water. Supplying it stops the loop. */
  knots?: number
  onKnotsChange?: (knots: number) => void
  /** The speed the foils can first carry the boat at. */
  takeoffSpeed?: number
  behavior?: HydrofoilBehavior
  view?: RobotView
  /** The sea, the waterline, and the hull's shadow in it. */
  showSea?: boolean
  /** Spray off the struts. Omit and it appears whenever they are cutting water. */
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

function HydrofoilCraft({
  knots,
  onKnotsChange,
  takeoffSpeed = 18,
  behavior = "takeoff",
  view = NATIVE_VIEW,
  showSea = true,
  active,
  interactive = false,
  speed = 0.22,
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
}: HydrofoilCraftProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = knots !== undefined

  const hold = controlled
    ? Number.isFinite(knots) ? clamp(knots as number, 0, MAX_KNOTS) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => craftKnots(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: THROTTLE_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const through = clamp(motion.value, 0, MAX_KNOTS)
  const takeoff = Number.isFinite(takeoffSpeed) ? clamp(takeoffSpeed, 1, MAX_KNOTS) : 18
  const rise = foilRise(through, takeoff)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, MAX_KNOTS) * 10) / 10
      setHeld(bounded)
      onKnotsChange?.(bounded)
    },
    [onKnotsChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x * MAX_KNOTS), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // Hullborne, the boat rides the swell. Foilborne, the struts are all that
  // touch it and the ride goes quiet — which is the point of the machine.
  const swell = (1 - rise) * (through > 0.5 ? 1 : 0.45)
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const heave = Math.sin(clock * Math.PI * 2) * 2.6 * swell
  const trim = Math.sin(clock * Math.PI * 2 + 0.9) * 1.7 * swell
  // The bow lifts through the transition, then settles as she comes up.
  const attitude = trim + Math.sin(Math.PI * clamp(rise * 1.6, 0, 1)) * 3.2
  const float = lerp(-DRAFT, CLEARANCE, rise) + heave

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const pitch = toRadians(attitude)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)

  /** A drawing point on the craft: trimmed about amidships, then floated. */
  const afloat = (point: Vec2): Vec2 => {
    const dx = point.x - MID
    const dy = point.y - DECK / 2
    return {
      x: MID + dx * cosPitch - dy * sinPitch,
      y: DECK / 2 + dx * sinPitch + dy * cosPitch + float,
    }
  }
  const world = (point: Vec2, depth: number): Vec3 => rollPoint(afloat(point), depth, 0)

  const solid = (outline: Vec2[], beam: (y: number) => number, offset = 0) =>
    slabPath(
      outline.flatMap((point) => [
        world(point, offset + beam(point.y)),
        world(point, offset - beam(point.y)),
      ]),
      camera,
    )
  const to = (point: Vec2, depth: number) => {
    const corner = world(point, depth)
    return camera.project(corner.x, corner.y, corner.z)
  }
  const face = (points: Vec2[], depth: (y: number) => number, close = false) =>
    `${points
      .map((point, index) => {
        const screen = to(point, depth(point.y))
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`
  /** A member from one side of the machine to the other at one station. */
  const across = (point: Vec2, from: number, toDepth: number) => {
    const a = to(point, from)
    const b = to(point, toDepth)
    return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const making = active ?? through > 2
  const readout = Math.round(through)

  /**
   * One foil assembly: a strut down from the keel, and a V whose limbs pierce
   * the surface. What is drawn wetted is genuinely the part below y = 0 after
   * the boat has risen — the area the lift equation just took away.
   */
  const assembly = (name: string, station: number) => {
    const root: Vec2 = { x: station, y: KEEL - STRUT_DROP }
    const rootWorld = afloat(root)
    const tipHeight = rootWorld.y + FOIL_DIHEDRAL
    // Where the limb crosses the surface, as a fraction of its own span.
    const cut =
      tipHeight === rootWorld.y
        ? rootWorld.y < 0 ? 1 : 0
        : clamp((0 - rootWorld.y) / (tipHeight - rootWorld.y), 0, 1)
    const strutTop = afloat({ x: station, y: KEEL + 4 })
    // Spray comes off where the strut crosses the surface, not off the foil.
    const surface = camera.project(0, 0, -lerp(strutTop.x, rootWorld.x, 0.5))
    return (
      <g key={name} data-foil={name} data-wetted={px(cut)}>
        <path
          data-strut={name}
          d={slabPath(
            [
              { x: 4, y: strutTop.y, z: -strutTop.x },
              { x: -4, y: strutTop.y, z: -strutTop.x },
              { x: 4, y: rootWorld.y, z: -rootWorld.x },
              { x: -4, y: rootWorld.y, z: -rootWorld.x },
              { x: 4, y: strutTop.y, z: -strutTop.x - 9 },
              { x: -4, y: strutTop.y, z: -strutTop.x - 9 },
              { x: 4, y: rootWorld.y, z: -rootWorld.x - 3 },
              { x: -4, y: rootWorld.y, z: -rootWorld.x - 3 },
            ],
            camera,
          )}
          {...machined}
        />
        {[-1, 1].map((side) => {
          const tip = {
            x: side * FOIL_SPAN,
            y: tipHeight,
            z: -rootWorld.x,
          }
          const wet = {
            x: side * FOIL_SPAN * cut,
            y: lerp(rootWorld.y, tipHeight, cut),
            z: -rootWorld.x,
          }
          const a = camera.project(0, rootWorld.y, -rootWorld.x)
          const b = camera.project(tip.x, tip.y, tip.z)
          const c = camera.project(wet.x, wet.y, wet.z)
          return (
            <g key={side}>
              <path
                d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`}
                fill="none"
                stroke={variant === "solid" ? palette.dark : palette.metal}
                strokeWidth={4.5}
                strokeLinecap="round"
              />
              {cut > 0.01 && (
                <path
                  data-immersed={`${name}-${side < 0 ? "port" : "starboard"}`}
                  d={`M ${px(a.x)} ${px(a.y)} L ${px(c.x)} ${px(c.y)}`}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              )}
            </g>
          )
        })}
        {making && strutTop.y > 0 && rootWorld.y < 0 && (
          <path
            data-spray={name}
            d={`M ${px(surface.x - 7)} ${px(surface.y)} l 5 -7 l 4 7 l 5 -9`}
            fill="none"
            stroke={palette.glow}
            strokeWidth={1.4}
            opacity={0.7}
          />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Hydrofoil craft, ${readout} knots, ${rise > 0 ? `${Math.round(rise * 100)} percent foilborne` : "hullborne"}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? MAX_KNOTS : undefined}
      aria-valuenow={interactive ? px(through) : undefined}
      aria-valuetext={interactive ? `${readout} knots` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 5 : 2, 10)
        if (delta !== 0) apply(through + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(MAX_KNOTS)
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
          <path d={`M 10 ${VIEW_HEIGHT - 40} H ${VIEW_WIDTH - 10}`} strokeDasharray="3 4" />
        </g>
      )}

      <g data-view={view} data-rise={px(rise)} data-knots={px(through)} transform={frame || undefined}>
        {showSea && (
          <g data-waterline>
            {/* The sea is a plane, so it is a wash from above and a line from
                the side — which is exactly what a waterline is. */}
            <path
              d={slabPath(
                [
                  { x: 36, y: 0, z: 14 },
                  { x: -36, y: 0, z: 14 },
                  { x: 36, y: 0, z: -BOW - 18 },
                  { x: -36, y: 0, z: -BOW - 18 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.16}
            />
            <path
              d={(() => {
                const a = camera.project(0, 0, 16)
                const b = camera.project(0, 0, -BOW - 20)
                return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
              })()}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.6}
              opacity={0.5}
            />
          </g>
        )}

        {assembly("aft", AFT_STRUT)}
        {assembly("fore", FORE_STRUT)}

        <g data-hull>
          <path d={solid(HULL, beamAt)} {...shell} />
          {/* The boot top, painted on the hull, so it goes under when she sits. */}
          <path
            d={face(
              [
                { x: STERN + 4, y: KEEL + 9 },
                { x: BOW - 20, y: KEEL + 13 },
              ],
              (y) => beamAt(y) + 0.4,
            )}
            fill="none"
            stroke={palette.dark}
            strokeWidth={3}
            opacity={0.55}
          />
          <path d={solid(CABIN, (y) => beamAt(DECK) - 4 - Math.max(0, y - DECK) * 0.12)} {...machined} />
          <path
            data-glazing
            d={face(
              [
                { x: STERN + 40, y: DECK + 8 },
                { x: BOW - 62, y: DECK + 10 },
                { x: BOW - 62, y: DECK + 21 },
                { x: STERN + 40, y: DECK + 19 },
              ],
              () => beamAt(DECK) - 3.4,
              true,
            )}
            fill={palette.dark}
            opacity={0.6}
          />
          {/* Bridge, right forward, and the mast over it. */}
          <path
            data-bridge
            d={solid(
              [
                { x: BOW - 54, y: DECK + 28 },
                { x: BOW - 56, y: DECK + 44 },
                { x: BOW - 86, y: DECK + 44 },
                { x: BOW - 88, y: DECK + 28 },
              ],
              () => beamAt(DECK) - 8,
            )}
            {...shell}
          />
          <path
            d={across({ x: BOW - 62, y: DECK + 40 }, -(beamAt(DECK) - 8.4), beamAt(DECK) - 8.4)}
            fill="none"
            stroke={palette.dark}
            strokeWidth={3.4}
            opacity={0.6}
          />
          <path
            data-mast
            d={face(
              [
                { x: BOW - 72, y: DECK + 44 },
                { x: BOW - 74, y: DECK + 70 },
              ],
              () => 0,
            )}
            fill="none"
            stroke={palette.metal}
            strokeWidth={2.2}
          />
          <path
            data-lamp
            d={across({ x: BOW - 74, y: DECK + 71 }, -2, 2)}
            fill="none"
            stroke={making ? palette.accent : palette.metal}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </g>
      </g>

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

/** The speed the craft is working up to at `clock`, in knots. */
export function craftKnots(behavior: HydrofoilBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  switch (behavior) {
    case "foilborne":
      return 42 + Math.sin(clock * Math.PI * 2) * 4
    case "moor":
      return Math.max(0, Math.sin(clock * Math.PI * 2) * 5)
    default:
      // Away from the berth, up onto the foils, and back down again.
      return 24 + Math.sin(clock * Math.PI * 2) * 24
  }
}

export { HydrofoilCraft }
