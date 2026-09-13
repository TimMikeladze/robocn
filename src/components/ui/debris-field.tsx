"use client"

/**
 * debris-field — what is left, and the one drawing in the set that has to
 * decide what is in front of what.
 *
 * Everything else here is one object, or a handful of parts rigidly attached to
 * one body. This is a *population*: every fragment is a plate off the same
 * `hull-geometry` tiling a station was built from, each on its own straight
 * line from the rupture, released at its own moment by the fracture front, and
 * turning at its own rate. Nothing holds them in any order, so the component
 * sorts them by `camera.depth` and paints back to front — which is why a near
 * fragment genuinely covers a far one, and why the sort changes when the camera
 * moves rather than the artwork being redrawn per angle.
 *
 * The fragments keep turning after they have flown out, because nothing stopped
 * them: the tumble runs off the clock rather than off the travel, which is what
 * separates this from the station's breakup, where a plate only turns while it
 * is being thrown.
 *
 * `showTrails` draws each fragment's trajectory back to the piece of hull it
 * came off, which is the ballistics made visible — they are straight lines
 * because that is what the solver produces, not because they were drawn
 * straight.
 *
 * There is no mass, no energy, no gravity and no collision here: fragments pass
 * through each other's paths, and `spread` is a number you can scrub in both
 * directions rather than a time after an event.
 *
 * Design note: docs/battle-station.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { bodyFrame, illumination } from "@/lib/robocn/celestial"
import {
  burst,
  direction,
  hullPlates,
  plateNormal,
  plateOutline,
  shockRing,
  type BurstOptions,
  type PlateBurst,
} from "@/lib/robocn/hull"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_SIZE = 200
const ORIGIN = { x: 100, y: 100 }
const NATIVE_VIEW: RobotView = "front"

/** The body the fragments came off, which is what sets their size. */
const RADIUS = 40
const PLATE_STEPS = 3
/** Units of spread per second while the field returns to its behaviour. */
const SPREAD_RATE = 1.1
/** Degrees a fragment turns per second once it is loose, before its own share. */
const FREE_TUMBLE = 50
const DEG = Math.PI / 180
const TAU = Math.PI * 2

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type DebrisBehavior = "burst" | "drift" | "tumble" | "static"

export interface DebrisFieldProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. It changes the depth order, not just the angle. */
  view?: RobotView
  /** Controlled spread, 0 still assembled to 1 fully scattered. Stops the loop. */
  spread?: number
  /** What the field does when `spread` is not supplied. */
  behavior?: DebrisBehavior
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across it to scrub the scatter, or arrow-key it. */
  interactive?: boolean
  onSpreadChange?: (spread: number) => void
  /** Courses the body was plated in. Clamped 2..14 — it sets the fragment count. */
  courses?: number
  /** Fragments round the equator of that body. Clamped 2..20. */
  perCourse?: number
  /** How far a fragment travels at full spread, in radii. Clamped 0..12. */
  reach?: number
  /** Degrees round the field the rupture sat at. */
  rupture?: number
  /** Straight lines back to the hull each fragment came off. */
  showTrails?: boolean
  /** The expanding front. */
  showShock?: boolean
  /** Any integer. The same seed is the same field, every render. */
  seed?: number
  /** Where the light is, in degrees round the field. 0 is behind the viewer. */
  sun?: number
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function DebrisField({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  spread,
  behavior = "drift",
  speed = 0.1,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onSpreadChange,
  courses = 6,
  perCourse = 9,
  reach = 1.3,
  rupture = 18,
  showTrails = false,
  showShock = true,
  seed = 5,
  sun = 38,
  signal = "ready",
  label,
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
  ...props
}: DebrisFieldProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = spread !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(spread) ? spread : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => debrisGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SPREAD_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0, 0, 1)
      setHeld(bounded)
      onSpreadChange?.(bounded)
    },
    [onSpreadChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---- the numbers ------------------------------------------------------ */

  const progress = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const bands = Math.round(clamp(Number.isFinite(courses) ? courses : 6, 2, 14))
  const seats = Math.round(clamp(Number.isFinite(perCourse) ? perCourse : 9, 2, 20))
  const grain = Math.round(Number.isFinite(seed) ? seed : 5)
  const bearing = Number.isFinite(rupture) ? rupture : 18
  const sunBearing = Number.isFinite(sun) ? sun : 38

  const frame = bodyFrame({ tilt: 16, precession: 22, spin: clock * 18 })
  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const toWorld = (v: Vec3): Vec3 => ({
    x: frame.right.x * v.x + frame.up.x * v.y + frame.forward.x * v.z,
    y: frame.right.y * v.x + frame.up.y * v.y + frame.forward.y * v.z,
    z: frame.right.z * v.x + frame.up.z * v.y + frame.forward.z * v.z,
  })
  const at = (local: Vec3): Vec2 => {
    const world = toWorld(local)
    const screen = camera.project(world.x, world.y, world.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const depthOf = (local: Vec3) => {
    const world = toWorld(local)
    return camera.depth(world.x, world.y, world.z)
  }
  const light = (() => {
    const world = bearingDirection(sunBearing)
    return {
      x: dot3(world, frame.right),
      y: dot3(world, frame.up),
      z: dot3(world, frame.forward),
    }
  })()

  /* ---- the field -------------------------------------------------------- */

  const ruptureDirection = direction(8, bearing)
  const burstOptions: BurstOptions = {
    origin: ruptureDirection,
    spread: clamp(Number.isFinite(reach) ? reach : 1.3, 0, 12),
    focus: 0.55,
    tumble: 420,
    front: 0.45,
    seed: grain,
  }

  const fragments = hullPlates(bands, { perCourse: seats })
    .map((plate) => {
      const rest = plateNormal(plate)
      const state = burst(plate, progress, burstOptions)
      // Loose pieces keep turning: nothing stopped them. The travel decides how
      // far they are, the clock decides how far round they are.
      const spin = state.spin + (state.release > 0 ? clock * FREE_TUMBLE * (0.4 + ((plate.index * 37 + grain) % 11) / 8) : 0)
      const points = plateOutline(plate, PLATE_STEPS).map((corner) =>
        move(direction(corner.latitude, corner.longitude), rest, state, spin, RADIUS),
      )
      const centre = move(rest, rest, state, spin, RADIUS)
      return {
        index: plate.index,
        course: plate.course,
        seat: plate.seat,
        state,
        lit: illumination(unit(centre), light) > -0.05,
        depth: depthOf(centre),
        d: polygonPath(points.map(at)),
        trail: state.release > 0 ? linePath([at({ x: rest.x * RADIUS, y: rest.y * RADIUS, z: rest.z * RADIUS }), at(centre)]) : "",
      }
    })
    // Back to front, so a near fragment covers a far one. This is the whole
    // reason the component sorts anything.
    .sort((a, b) => a.depth - b.depth)

  const shock = (() => {
    if (!showShock || progress <= 0.02) return null
    const radius = RADIUS * (0.16 + progress * 1.9)
    const points = shockRing(
      { x: ruptureDirection.x * RADIUS, y: ruptureDirection.y * RADIUS, z: ruptureDirection.z * RADIUS },
      ruptureDirection,
      radius,
      48,
    )
    return { d: polygonPath(points.map(at)), fade: Math.max(0.05, 0.5 - progress * 0.4) }
  })()

  const rupturePoint = at({
    x: ruptureDirection.x * RADIUS,
    y: ruptureDirection.y * RADIUS,
    z: ruptureDirection.z * RADIUS,
  })

  const readout = Math.round(progress * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Debris field, ${fragments.length} fragments ${readout} percent scattered, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent scattered` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(progress + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
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
          <path d="M 8 100 H 192 M 100 8 V 192" strokeDasharray="2 3" />
          {/* The body the pieces came off. */}
          <circle cx={100} cy={100} r={px(RADIUS)} strokeDasharray="3 3" />
        </g>
      )}

      <g data-frame data-view={view}>
        {shock && (
          <path data-shock d={shock.d} fill="none" stroke={palette.glow} strokeWidth={1.3} opacity={shock.fade} />
        )}

        {showTrails && (
          <g data-trails fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
            {fragments
              .filter((fragment) => fragment.trail)
              .map((fragment) => (
                <path key={fragment.index} data-trail={fragment.index} d={fragment.trail} strokeDasharray="2 2" />
              ))}
          </g>
        )}

        {progress > 0 && progress < 0.6 && (
          <circle
            data-rupture
            cx={px(rupturePoint.x)}
            cy={px(rupturePoint.y)}
            r={px(2.5 + progress * 6)}
            fill={palette.glow}
            opacity={Math.max(0, 0.75 - progress)}
          />
        )}

        {fragments.map((fragment) => (
          <path
            key={fragment.index}
            data-fragment={fragment.index}
            data-course={fragment.course}
            d={fragment.d}
            {...((fragment.seat + fragment.course * 2) % 3 === 0 ? machined : shell)}
            fillOpacity={
              variant === "solid" ? (fragment.lit ? 1 : 0.4) : variant === "blueprint" ? 0.16 : undefined
            }
          />
        ))}

        <circle
          data-lamp
          cx={ORIGIN.x}
          cy={px(ORIGIN.y + RADIUS + 40)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {label && (
        <text
          x={100}
          y={194}
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

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

/** How far scattered the field is at `clock`, 0 to 1. */
export function debrisGoal(behavior: DebrisBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return 0.5
  switch (behavior) {
    // Out and back: the same solved field scrubbed in both directions.
    case "burst":
      return 0.5 - 0.5 * Math.cos(TAU * clock)
    // Barely moving apart any more — what carries the drawing is the tumble.
    case "drift":
      return 0.55 + 0.06 * Math.sin(TAU * clock)
    case "tumble":
      return 0.82
    default:
      return 0.5
  }
}

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-9 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 }
}

/** A horizontal direction from a bearing: 0 is behind the viewer. */
function bearingDirection(bearing: number): Vec3 {
  const a = ((Number.isFinite(bearing) ? bearing : 0) * Math.PI) / 180
  return { x: Math.sin(a), y: 0.2, z: -Math.cos(a) }
}

/** Rodrigues: turn `v` about the unit `axis` by `angle` radians. */
function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = dot3(axis, v) * (1 - c)
  const cr = cross3(axis, v)
  return {
    x: v.x * c + cr.x * s + axis.x * k,
    y: v.y * c + cr.y * s + axis.y * k,
    z: v.z * c + cr.z * s + axis.z * k,
  }
}

/**
 * One point of a fragment, carried by its own burst and its own free turn. The
 * pivot is where the piece sat, so nothing has moved at all until it is
 * released and the assembled body is the tiling untouched.
 */
function move(
  point: Vec3,
  rest: Vec3,
  state: PlateBurst,
  spin: number,
  radius: number,
): Vec3 {
  const scaled = { x: point.x * radius, y: point.y * radius, z: point.z * radius }
  if (state.release <= 0) return scaled
  const pivot = { x: rest.x * radius, y: rest.y * radius, z: rest.z * radius }
  const local = { x: scaled.x - pivot.x, y: scaled.y - pivot.y, z: scaled.z - pivot.z }
  const turned = rotateAbout(local, state.axis, spin * DEG)
  return {
    x: state.offset.x * radius + turned.x,
    y: state.offset.y * radius + turned.y,
    z: state.offset.z * radius + turned.z,
  }
}

function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { DebrisField }
