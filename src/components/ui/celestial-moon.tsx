"use client"

/**
 * celestial-moon — the phase machine.
 *
 * A crescent is where hand-drawn moons go wrong: two circles offset by eye
 * gives a shape that is nearly right at a crescent, wrong at a gibbous, and
 * that flips the wrong way at quarter. None of that is drawn here. `phase`
 * puts the light somewhere, `terminator` returns the great circle where the
 * light grazes the sphere, and the night side is the camera-facing half of
 * that circle closed against the unlit half of the limb. The crescent is a
 * projection, so the flip at quarter happens because the geometry does it.
 *
 * Then it rocks. A tidally locked body still shows a little more than half of
 * itself, because it librates — so the near side is a *range*, not a picture,
 * and craters near the limb come round and go again. The rocking is drawn from
 * the same body frame the craters are placed in, so nothing can drift.
 *
 * Design note: docs/celestial-bodies.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bodyFrame,
  illumination,
  sphereLattice,
  surfacePoint,
  terminator,
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

const RADIUS = 72
const LIMB_STEPS = 84
/** Lunations per second while it returns to its behaviour. */
const PHASE_RATE = 0.5
/** Peak libration, in degrees of longitude and latitude. */
const LIBRATION_LON = 7.8
const LIBRATION_LAT = 6.6
/**
 * Libration runs on its own period, not the phase's — which is the reason it
 * exists as an effect at all. These ratios are illustrative, not the real ones.
 */
const LIBRATION_LON_RATE = 1.09
const LIBRATION_LAT_RATE = 1.18
/** A crater under this much foreshortening is a line, so it is not drawn. */
const LIMB_CUT = 0.12

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type MoonBehavior = "cycle" | "libration" | "static"

/** The eight names a phase falls into, for the accessible label. */
const phaseNames = [
  "new",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full",
  "waning gibbous",
  "last quarter",
  "waning crescent",
] as const

export interface CelestialMoonProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. The body is a sphere; its axis is not. */
  view?: RobotView
  /** Controlled lunation, 0 new through 0.5 full and back. Stops the loop. */
  phase?: number
  /** What the body does when `phase` is not supplied. */
  behavior?: MoonBehavior
  /** Cycles per second: one lunation. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of clock offset, so a row of them breaks step. */
  offset?: number
  /** Drag across it to scrub the lunation, or arrow-key it. */
  interactive?: boolean
  onPhaseChange?: (phase: number) => void
  /** Craters on the surface. Clamped 0–200. */
  craters?: number
  /** Dark plains. Clamped 0–6. */
  maria?: number
  /** How far the body rocks, 0 locked to 1 full. */
  libration?: number
  /** Degrees the pole leans out of vertical. */
  tilt?: number
  /** Any integer: the same seed is the same face, every render. */
  seed?: number
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function CelestialMoon({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  phase,
  behavior = "cycle",
  speed = 0.09,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onPhaseChange,
  craters = 46,
  maria = 3,
  libration = 1,
  tilt = 5,
  seed = 7,
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
}: CelestialMoonProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? wrap(Number.isFinite(phase) ? phase : 0) : held
  const goal = React.useCallback((clock: number) => moonGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: PHASE_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = wrap(Number.isFinite(next) ? next : 0)
      setHeld(bounded)
      onPhaseChange?.(bounded)
    },
    [onPhaseChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const lunation = wrap(motion.value)
  const rock = clamp(Number.isFinite(libration) ? libration : 1, 0, 1)
  const pits = Math.round(clamp(Number.isFinite(craters) ? craters : 46, 0, 200))
  const plains = Math.round(clamp(Number.isFinite(maria) ? maria : 3, 0, 6))
  const lean = clamp(Number.isFinite(tilt) ? tilt : 0, -90, 90)
  const grain = Math.round(Number.isFinite(seed) ? seed : 7)

  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

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
  const limb = Array.from({ length: LIMB_STEPS }, (_, index) => {
    const angle = (index / LIMB_STEPS) * Math.PI * 2
    const ca = Math.cos(angle) * RADIUS
    const sa = Math.sin(angle) * RADIUS
    return {
      x: b.across.x * ca + b.up.x * sa,
      y: b.across.y * ca + b.up.y * sa,
      z: b.across.z * ca + b.up.z * sa,
    }
  })

  // Full when the light is behind the viewer, new when it is behind the body,
  // and signed so that a waxing moon lights from the right.
  const light = bearingDirection(lunation * 360 - 180)
  const swing = moonLibration(lunation, rock)
  const frame = bodyFrame({
    tilt: lean + swing.latitude,
    precession: 0,
    spin: swing.longitude,
  })

  /* ---- the night side -------------------------------------------------- */

  const nightEdge = terminator(RADIUS, light, 120).filter((point) => front(point) >= -0.001)
  const darkLimb = limb.filter((point) => illumination(point, light) <= 0)
  const night =
    nightEdge.length > 2 && darkLimb.length > 2
      ? polygonPath([...ordered(nightEdge), ...ordered(darkLimb).reverse()].map(at))
      : illumination(eye, light) < 0
        ? polygonPath(limb.map(at))
        : ""

  /* ---- the surface ----------------------------------------------------- */

  // The lattice is placed on the body, so the craters ride the libration and
  // the ones by the limb genuinely come round.
  const sites = sphereLattice(pits + plains * 9)
  const pitList = sites.slice(0, pits).map((site, index) => {
    const spot = bodyPoint(frame, site, RADIUS)
    const facing = front(spot) / RADIUS
    const screen = at(spot)
    // A circular pit projects to an ellipse squashed toward the limb, in the
    // direction of the limb: that is the whole of the foreshortening.
    const scale = 1.7 + ((((index * 37 + grain * 13) % 19) + 19) % 19) / 19 * 4.4
    const outward = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y) || 1
    const radial = {
      x: (screen.x - ORIGIN.x) / outward,
      y: (screen.y - ORIGIN.y) / outward,
    }
    const lit = illumination(spot, light)
    return {
      index,
      shown: facing > LIMB_CUT,
      screen,
      major: scale,
      minor: scale * Math.max(0.12, facing),
      angle: (Math.atan2(radial.y, radial.x) * 180) / Math.PI + 90,
      lit,
    }
  })
  const mariaList = Array.from({ length: plains }, (_, index) => {
    const centre = sites[pits + index * 9] ?? { x: 0, y: 0, z: 1 }
    const blob = Array.from({ length: 9 }, (_, step) => {
      const site = sites[pits + index * 9 + step] ?? centre
      return bodyPoint(frame, blend(centre, site, 0.34), RADIUS * 1.002)
    })
    const shown = blob.filter((point) => front(point) > 0)
    return { index, shown: shown.length > 3, path: hullPath(shown.map(at)) }
  })

  const phaseName = phaseNames[Math.round(lunation * 8) % 8]
  const readout = Math.round(lunation * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Celestial moon, ${phaseName}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? phaseName : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.125 : 0.025, 0.25)
        if (delta !== 0) apply(lunation + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(0.5)
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
          <path
            data-axis
            d={linePath([
              at(surfacePoint(frame, RADIUS * 1.16, 90, 0)),
              at(surfacePoint(frame, RADIUS * 1.16, -90, 0)),
            ])}
            strokeDasharray="3 2"
          />
        </g>
      )}

      <g data-frame data-view={view}>
        <path data-globe d={polygonPath(limb.map(at))} {...shell} />

        {mariaList
          .filter((mare) => mare.shown)
          .map((mare) => (
            <path key={mare.index} data-mare={mare.index} d={mare.path} {...cast} opacity={0.34} />
          ))}

        <g data-craters>
          {pitList
            .filter((pit) => pit.shown)
            .map((pit) => (
              <g
                key={pit.index}
                data-crater={pit.index}
                transform={`translate(${px(pit.screen.x)} ${px(pit.screen.y)}) rotate(${px(pit.angle)})`}
              >
                <ellipse rx={px(pit.major)} ry={px(pit.minor)} {...machined} opacity={0.5} />
                {/* The floor sits on the side the light is not coming from,
                    which is the only thing a pit has to say about the sun. */}
                <ellipse
                  cx={0}
                  cy={px(pit.lit > 0 ? pit.minor * 0.3 : -pit.minor * 0.3)}
                  rx={px(pit.major * 0.62)}
                  ry={px(pit.minor * 0.55)}
                  fill={palette.dark}
                  opacity={0.24}
                />
              </g>
            ))}
        </g>

        {night && <path data-terminator d={night} {...cast} opacity={0.85} />}

        <path
          data-limb
          d={polygonPath(limb.map(at))}
          fill="none"
          stroke={palette.dark}
          strokeWidth={0.8}
          opacity={0.4}
        />

        <circle
          data-lamp
          cx={ORIGIN.x}
          cy={px(ORIGIN.y + RADIUS + 14)}
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

/** Where in the lunation the body is aiming to be at `clock`, 0..1. */
export function moonGoal(behavior: MoonBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.5
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "cycle":
      return t
    // Held near full, where the rocking is the only thing left to see.
    case "libration":
      return 0.5 + 0.04 * Math.sin(t * Math.PI * 2)
    default:
      return 0.5
  }
}

/**
 * How far the body has rocked at this point in the lunation. Libration runs on
 * a period of its own, which is why the near side is a range rather than a
 * fixed face — the ratios here are illustrative, not real periods.
 */
export function moonLibration(
  lunation: number,
  amount = 1,
): { longitude: number; latitude: number } {
  const t = Number.isFinite(lunation) ? lunation : 0
  const scale = clamp(Number.isFinite(amount) ? amount : 1, 0, 1)
  return {
    longitude: LIBRATION_LON * scale * Math.sin(2 * Math.PI * t * LIBRATION_LON_RATE),
    latitude: LIBRATION_LAT * scale * Math.sin(2 * Math.PI * t * LIBRATION_LAT_RATE + 0.9),
  }
}

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

const wrap = (value: number) => ((value % 1) + 1) % 1

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-9 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 }
}

/** Toward a point `t` of the way from `a` to `b`, back on the unit sphere. */
function blend(a: Vec3, b: Vec3, t: number): Vec3 {
  return unit({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
}

/** A lattice direction, read as a latitude and longitude on the turning body. */
function bodyPoint(
  frame: ReturnType<typeof bodyFrame>,
  site: Vec3,
  radius: number,
): Vec3 {
  const latitude = (Math.asin(clamp(site.y, -1, 1)) * 180) / Math.PI
  const longitude = (Math.atan2(site.z, site.x) * 180) / Math.PI
  return surfacePoint(frame, radius, latitude, longitude)
}

/** A horizontal direction from a bearing: 0 is behind the viewer. */
function bearingDirection(bearing: number): Vec3 {
  const a = ((Number.isFinite(bearing) ? bearing : 0) * Math.PI) / 180
  return { x: Math.sin(a), y: 0.08, z: -Math.cos(a) }
}

/** Points round a closed curve, started where the gap is biggest. */
function ordered(points: readonly Vec3[]): Vec3[] {
  if (points.length < 3) return [...points]
  let seam = 0
  let widest = -1
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length]
    const gap = Math.hypot(
      next.x - points[index].x,
      next.y - points[index].y,
      next.z - points[index].z,
    )
    if (gap > widest) {
      widest = gap
      seam = index + 1
    }
  }
  return [...points.slice(seam), ...points.slice(0, seam)]
}

function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { CelestialMoon }
