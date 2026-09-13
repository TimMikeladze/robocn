"use client"

/**
 * celestial-star — a luminous body, drawn as geometry rather than as glow.
 *
 * The disc is not a radial gradient. Limb darkening is a real law —
 * `I/I₀ = 1 − u(1 − μ)`, with `μ` the cosine of the angle between the line of
 * sight and the surface normal — and the component samples it into concentric
 * shells, so the falloff is the physics at that radius rather than a ramp
 * someone tuned. Change the class and the coefficient changes with it: a giant
 * has a much darker edge than a dwarf, and it is visible.
 *
 * Everything else lives on the sphere and turns with it. Spots sit at a
 * latitude belt and go round the back. Prominences are arcs anchored at two
 * footpoints on the surface, lifted out of the chord — so one end of a loop can
 * be over the limb while the other is still on the disc.
 *
 * Design note: docs/celestial-bodies.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bodyFrame,
  discMu,
  limbDarkening,
  sphereLattice,
  surfacePoint,
} from "@/lib/robocn/celestial"
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

const LIMB_STEPS = 80
/** Activity travelled per second while it returns to its behaviour. */
const ACTIVITY_RATE = 0.55
/** How far a prominence stands off the surface at full activity. */
const LOOP_HEIGHT = 0.46
const LOOP_STEPS = 18

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type StarBehavior = "rotate" | "flare" | "pulse" | "static"
export type StarClass = "dwarf" | "main-sequence" | "giant"

/**
 * Radius, the limb-darkening coefficient, how far the body pulsates, and how
 * much of the surface a granule covers. A cooler, more extended atmosphere
 * darkens harder at the edge, which is the whole reason the class matters here.
 */
const classes: Record<StarClass, { radius: number; darkening: number; pulse: number; grain: number }> = {
  dwarf: { radius: 38, darkening: 0.34, pulse: 0.015, grain: 0.9 },
  "main-sequence": { radius: 54, darkening: 0.6, pulse: 0.03, grain: 1 },
  giant: { radius: 74, darkening: 0.86, pulse: 0.07, grain: 1.5 },
}

export interface CelestialStarProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. The disc is round; the spot belt is not. */
  view?: RobotView
  /** Controlled activity, 0 quiet to 1 violent. Stops the loop. */
  activity?: number
  /** What the surface does when `activity` is not supplied. */
  behavior?: StarBehavior
  /** Cycles per second: one activity cycle. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across it to work the activity, or arrow-key it. */
  interactive?: boolean
  onActivityChange?: (activity: number) => void
  /** Which kind of star: it sets the radius and the limb-darkening law. */
  kind?: StarClass
  /** Controlled rotation about the pole, in degrees. */
  spin?: number
  /** Degrees the pole leans out of vertical. */
  tilt?: number
  /** Concentric brightness shells sampled off the law. Clamped 3–20. */
  shells?: number
  /** Convection cells on the disc. Clamped 0–260. */
  granules?: number
  /** Cool spots in the latitude belt. Clamped 0–12. */
  spots?: number
  /** Loops anchored on the limb. Clamped 0–8. */
  prominences?: number
  /** The outer halo. */
  corona?: boolean
  label?: string
}

function CelestialStar({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  activity,
  behavior = "flare",
  speed = 0.16,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onActivityChange,
  kind = "main-sequence",
  spin,
  tilt = 14,
  shells = 8,
  granules = 90,
  spots = 5,
  prominences = 3,
  corona = true,
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
}: CelestialStarProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = activity !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(activity) ? activity : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => starGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: ACTIVITY_RATE,
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
      onActivityChange?.(bounded)
    },
    [onActivityChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const stir = clamp(motion.value, 0, 1)
  const type = classes[kind] ?? classes["main-sequence"]
  const turn =
    spin !== undefined
      ? Number.isFinite(spin)
        ? spin
        : 0
      : motion.clock * 180
  const lean = clamp(Number.isFinite(tilt) ? tilt : 0, -90, 90)
  // A pulsating star really does change size, so the whole drawing does.
  const beat = behavior === "pulse" ? 1 + type.pulse * Math.sin(motion.clock * Math.PI * 2) : 1
  const radius = type.radius * beat
  const layers = Math.round(clamp(Number.isFinite(shells) ? shells : 8, 3, 20))
  const cells = Math.round(clamp(Number.isFinite(granules) ? granules : 90, 0, 260))
  const blemishes = Math.round(clamp(Number.isFinite(spots) ? spots : 5, 0, 12))
  const loops = Math.round(clamp(Number.isFinite(prominences) ? prominences : 3, 0, 8))

  const camera = robotCamera(view)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  /** Filled variants paint the law; line variants contour it instead. */
  const fills = variant === "solid" || variant === "blueprint"

  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const eye = unit({
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  })
  const front = (p: Vec3) => p.x * eye.x + p.y * eye.y + p.z * eye.z

  const b = (() => {
    const reference: Vec3 = Math.abs(eye.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    const across = unit(cross(reference, eye))
    return { across, up: cross(eye, across) }
  })()
  const limbAt = (r: number, steps = LIMB_STEPS) =>
    Array.from({ length: steps }, (_, index) => {
      const angle = (index / steps) * Math.PI * 2
      const ca = Math.cos(angle) * r
      const sa = Math.sin(angle) * r
      return {
        x: b.across.x * ca + b.up.x * sa,
        y: b.across.y * ca + b.up.y * sa,
        z: b.across.z * ca + b.up.z * sa,
      }
    })

  const frame = bodyFrame({ tilt: lean, precession: 0, spin: turn })

  /* ---- the disc -------------------------------------------------------- */

  // Each shell is an *annulus*, and it carries the law sampled at its own
  // radius as attenuation over the disc. Stacked discs would composite into a
  // ramp of their own making; a ring of the disc darkened by `1 − I/I₀` is the
  // law and nothing else.
  const brightness = Array.from({ length: layers }, (_, index) => {
    const outer = 1 - index / layers
    const inner = 1 - (index + 1) / layers
    const value = limbDarkening(discMu((outer + inner) / 2), type.darkening)
    return {
      index,
      value,
      ring: `${polygonPath(limbAt(radius * outer).map(at))} ${polygonPath(
        [...limbAt(radius * inner)].reverse().map(at),
      )}`,
      circle: polygonPath(limbAt(radius * outer).map(at)),
    }
  })
  const floor = limbDarkening(0, type.darkening)

  const granuleList = sphereLattice(cells)
    .map((site, index) => {
      const point = bodyPoint(frame, site, radius * 1.001)
      const facing = front(point) / radius
      const screen = at(point)
      const outward = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y) || 1
      const scale = (2 + (((index * 29) % 11) / 11) * 2.4) * type.grain
      return {
        index,
        shown: facing > 0.16,
        screen,
        major: scale,
        minor: scale * Math.max(0.1, facing),
        angle:
          (Math.atan2((screen.y - ORIGIN.y) / outward, (screen.x - ORIGIN.x) / outward) * 180) /
            Math.PI +
          90,
      }
    })
    .filter((granule) => granule.shown)

  // Spots ride a belt either side of the equator, the way an active star's do.
  const spotList = Array.from({ length: blemishes }, (_, index) => {
    const latitude = (index % 2 === 0 ? 1 : -1) * (12 + ((index * 7) % 22))
    const longitude = (index * 137.5) % 360
    const point = surfacePoint(frame, radius, latitude, longitude)
    const facing = front(point) / radius
    const screen = at(point)
    const outward = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y) || 1
    const scale = (2.6 + (index % 3) * 1.7) * (0.55 + stir)
    return {
      index,
      shown: facing > 0.14,
      screen,
      major: scale,
      minor: scale * Math.max(0.1, facing),
      angle:
        (Math.atan2((screen.y - ORIGIN.y) / outward, (screen.x - ORIGIN.x) / outward) * 180) /
          Math.PI +
        90,
    }
  }).filter((spot) => spot.shown)

  /* ---- prominences ----------------------------------------------------- */

  // Anchored on the limb, which is the only place a loop stands clear of the
  // disc and reads as one. They travel round it as the body turns.
  const onLimb = (angle: number): Vec3 => ({
    x: (b.across.x * Math.cos(angle) + b.up.x * Math.sin(angle)) * radius,
    y: (b.across.y * Math.cos(angle) + b.up.y * Math.sin(angle)) * radius,
    z: (b.across.z * Math.cos(angle) + b.up.z * Math.sin(angle)) * radius,
  })
  const loopList = Array.from({ length: loops }, (_, index) => {
    const azimuth = ((index * 137.5 + turn * 0.5) * Math.PI) / 180
    const span = ((9 + (index % 3) * 6) * Math.PI) / 180
    const a = onLimb(azimuth - span)
    const c = onLimb(azimuth + span)
    const height = LOOP_HEIGHT * (0.24 + 0.76 * stir) * (1 + (index % 2) * 0.34)
    const arc = Array.from({ length: LOOP_STEPS + 1 }, (_, step) => {
      const t = step / LOOP_STEPS
      const mid = slerp(a, c, t)
      const rise = 1 + height * Math.sin(Math.PI * t)
      return { x: mid.x * rise, y: mid.y * rise, z: mid.z * rise }
    })
    return {
      index,
      behind: index % 2 === 1,
      path: linePath(arc.map(at)),
      width: 1.1 + 2.4 * stir,
      feet: [at(a), at(c)],
    }
  })

  const coronaRings = corona
    ? [1.1, 1.24, 1.42].map((scale, index) => ({
        index,
        path: polygonPath(limbAt(radius * scale, 48).map(at)),
        opacity: (0.16 - index * 0.045) * (0.5 + stir),
      }))
    : []

  const readout = Math.round(stir * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Celestial star, ${kind} at ${readout} percent activity, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent activity` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(stir + delta)
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
          <text
            x={192}
            y={18}
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
            fontSize={5}
            fill={palette.grid}
            stroke="none"
          >
            {`u ${type.darkening} · LIMB ${px(floor)}`}
          </text>
        </g>
      )}

      <g data-frame data-view={view}>
        <g data-corona>
          {coronaRings.map((ring) => (
            <path key={ring.index} d={ring.path} fill={palette.glow} opacity={px(ring.opacity)} />
          ))}
        </g>

        {loopList
          .filter((loop) => loop.behind)
          .map((loop) => (
            <path
              key={`far-${loop.index}`}
              data-prominence={loop.index}
              d={loop.path}
              fill="none"
              stroke={palette.glow}
              strokeWidth={px(loop.width)}
              strokeLinecap="round"
              opacity={0.4}
            />
          ))}

        <g data-disc>
          <path
            data-photosphere
            d={polygonPath(limbAt(radius).map(at))}
            fill={fills ? palette.accent : "none"}
            stroke={palette.dark}
            strokeWidth={0.7}
          />
          {brightness.map((shell) => (
            <path
              key={shell.index}
              data-shell={shell.index}
              d={fills ? shell.ring : shell.circle}
              fillRule="evenodd"
              fill={fills ? palette.dark : "none"}
              // `1 − I/I₀`: nothing at the centre, most at the limb.
              fillOpacity={fills ? px((1 - shell.value) * 0.78) : undefined}
              stroke={fills ? "none" : variant === "wire" ? palette.grid : palette.accent}
              strokeWidth={fills ? 0 : px(0.45 + shell.value * 0.7)}
              strokeOpacity={fills ? 1 : px(0.3 + shell.value * 0.55)}
            />
          ))}
        </g>

        <g data-granules>
          {granuleList.map((granule) => (
            <ellipse
              key={granule.index}
              data-granule={granule.index}
              cx={px(granule.screen.x)}
              cy={px(granule.screen.y)}
              rx={px(granule.major)}
              ry={px(granule.minor)}
              transform={`rotate(${px(granule.angle)} ${px(granule.screen.x)} ${px(granule.screen.y)})`}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.5}
              opacity={0.16}
            />
          ))}
        </g>

        <g data-spots>
          {spotList.map((spot) => (
            <ellipse
              key={spot.index}
              data-spot={spot.index}
              cx={px(spot.screen.x)}
              cy={px(spot.screen.y)}
              rx={px(spot.major)}
              ry={px(spot.minor)}
              transform={`rotate(${px(spot.angle)} ${px(spot.screen.x)} ${px(spot.screen.y)})`}
              {...cast}
              opacity={0.55}
            />
          ))}
        </g>

        {loopList
          .filter((loop) => !loop.behind)
          .map((loop) => (
            <g key={loop.index}>
              <path
                data-prominence={loop.index}
                d={loop.path}
                fill="none"
                stroke={palette.glow}
                strokeWidth={px(loop.width)}
                strokeLinecap="round"
                opacity={0.85}
              />
              {loop.feet.map((foot, step) => (
                <circle
                  key={step}
                  cx={px(foot.x)}
                  cy={px(foot.y)}
                  r={px(loop.width * 0.8)}
                  {...machined}
                  opacity={0.7}
                />
              ))}
            </g>
          ))}
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

/** How active the surface is aiming to be at `clock`, 0..1. */
export function starGoal(behavior: StarBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.35
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    // Quiet, then a loop grows over half the cycle and falls back.
    case "flare":
      return t < 0.55 ? 0.12 + (t / 0.55) * 0.88 : 1 - ((t - 0.55) / 0.45) * 0.88
    case "rotate":
      return 0.35
    case "pulse":
      return 0.3 + 0.18 * Math.sin(t * Math.PI * 2)
    default:
      return 0.35
  }
}

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-9 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 }
}

/** Along the great circle from `a` to `b`, so a loop's span is on the surface. */
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z) || 1
  const ua = unit(a)
  const ub = unit(b)
  const dot = clamp(ua.x * ub.x + ua.y * ub.y + ua.z * ub.z, -1, 1)
  const angle = Math.acos(dot)
  if (angle < 1e-6) return { x: a.x, y: a.y, z: a.z }
  const sa = Math.sin((1 - t) * angle) / Math.sin(angle)
  const sb = Math.sin(t * angle) / Math.sin(angle)
  return {
    x: (ua.x * sa + ub.x * sb) * length,
    y: (ua.y * sa + ub.y * sb) * length,
    z: (ua.z * sa + ub.z * sb) * length,
  }
}

/** A lattice direction, read as a latitude and longitude on the turning body. */
function bodyPoint(frame: ReturnType<typeof bodyFrame>, site: Vec3, radius: number): Vec3 {
  const latitude = (Math.asin(clamp(site.y, -1, 1)) * 180) / Math.PI
  const longitude = (Math.atan2(site.z, site.x) * 180) / Math.PI
  return surfacePoint(frame, radius, latitude, longitude)
}

function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { CelestialStar }
