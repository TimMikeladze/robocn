"use client"

/**
 * celestial-asteroid — the one body here whose outline changes as it turns.
 *
 * Every other body in this family is a sphere, so its rotation is invisible
 * except for what is painted on it. This one has a real shape: `lumpyRadius`
 * sums deterministic cosine lobes over direction, and the surface is that
 * radius field applied to the unit sphere. Turn it and the *silhouette*
 * changes, because there is a different amount of rock in the way.
 *
 * So the outline cannot be a hull. A hull would smooth out every hollow the
 * lobes make, which is exactly the information this component exists to show.
 * Instead the surface is sampled densely, projected, and the farthest sample in
 * each angular bin about the centre is kept — the true silhouette of a body
 * that is star-shaped about its own centre, concavities included.
 *
 * And it tumbles rather than spins: the body turns about its pole while the
 * pole itself goes round, at a rate that is not a whole multiple of the first,
 * so no two frames of the cycle repeat.
 *
 * Design note: docs/celestial-bodies.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bodyFrame,
  illumination,
  lumpyRadius,
  orbitalState,
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

const RADIUS = 56
/** Directions the outline is built at, and depth samples along each one. */
const OUTLINE_BINS = 64
const OUTLINE_DEPTH = 11
/** Degrees of tumble per second while it returns to its behaviour. */
const TUMBLE_RATE = 60
/**
 * The pole goes round at this fraction of the body's own turn. Deliberately
 * not a whole number: that is what makes a tumble rather than a spin.
 */
const PRECESSION_RATIO = 0.382

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type AsteroidBehavior = "tumble" | "spin" | "drift" | "static"
export type AsteroidBody = "rubble" | "monolith" | "contact"

/** Lobe count and depth: how broken up the rock is. */
const bodies: Record<AsteroidBody, { lobes: number; depth: number }> = {
  rubble: { lobes: 9, depth: 0.5 },
  monolith: { lobes: 5, depth: 0.34 },
  // Two deep lobes: a body that came together out of two, and looks it.
  contact: { lobes: 2, depth: 0.6 },
}

export interface CelestialAsteroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. This body has a shape, so every angle differs. */
  view?: RobotView
  /** Controlled rotation, in degrees. The pole follows it. Stops the loop. */
  tumble?: number
  /** What the rock does when `tumble` is not supplied. */
  behavior?: AsteroidBehavior
  /** Cycles per second: one revolution. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across it to turn it, or arrow-key it. */
  interactive?: boolean
  onTumbleChange?: (tumble: number) => void
  /** Which kind of body: it sets the lobe count and how deep they cut. */
  body?: AsteroidBody
  /** Any integer. The same seed is the same rock, every render. */
  seed?: number
  /** Craters on the surface. Clamped 0–80. */
  craters?: number
  /** Where the light is, in degrees round the body. 0 is behind the viewer. */
  sun?: number
  /** A companion on its own orbit. */
  moonlet?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function CelestialAsteroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  tumble,
  behavior = "tumble",
  speed = 0.08,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTumbleChange,
  body = "rubble",
  seed = 9,
  craters = 18,
  sun = 34,
  moonlet = false,
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
}: CelestialAsteroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = tumble !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(tumble) ? tumble : 0) : held
  const goal = React.useCallback((clock: number) => asteroidGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: TUMBLE_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Number.isFinite(next) ? next : 0
      setHeld(bounded)
      onTumbleChange?.(bounded)
    },
    [onTumbleChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.5) * 720), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const turn = Number.isFinite(motion.value) ? motion.value : 0
  const shape = bodies[body] ?? bodies.rubble
  const grain = Math.round(Number.isFinite(seed) ? seed : 9)
  const pits = Math.round(clamp(Number.isFinite(craters) ? craters : 18, 0, 80))
  const bearing = Number.isFinite(sun) ? sun : 34
  const field = { lobes: shape.lobes, depth: shape.depth, seed: grain }
  // One number is the whole mechanism: the body's turn also carries its pole
  // round, at a rate that shares no whole factor with it.
  const frame = bodyFrame({
    tilt: 34 + 26 * Math.sin((turn * PRECESSION_RATIO * Math.PI) / 180),
    precession: turn * PRECESSION_RATIO,
    spin: behavior === "drift" && !controlled ? turn * 0.35 : turn,
  })

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
  const light = bearingDirection(bearing)

  /* ---- the rock -------------------------------------------------------- */

  // The screen plane, in world directions.
  const reference: Vec3 = Math.abs(eye.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const across = unit(crossOf(reference, eye))
  const upward = crossOf(eye, across)
  const bodyLocal = (d: Vec3): Vec3 => ({
    x: dot3(d, frame.right),
    y: dot3(d, frame.up),
    z: dot3(d, frame.forward),
  })
  const surfaceAt = (d: Vec3) => scale3(d, RADIUS * lumpyRadius(bodyLocal(d), field))

  /**
   * The outline, exactly rather than by binning a point cloud. Every direction
   * that projects onto one screen bearing lies on a single great circle
   * through the line of sight — so sweeping that circle and keeping the point
   * that projects farthest out gives the true silhouette of a body that is
   * star-shaped about its own centre, concavities and all, and smoothly.
   */
  const rim = Array.from({ length: OUTLINE_BINS }, (_, index) => {
    const bearing = (index / OUTLINE_BINS) * Math.PI * 2
    const plane: Vec3 = {
      x: across.x * Math.cos(bearing) + upward.x * Math.sin(bearing),
      y: across.y * Math.cos(bearing) + upward.y * Math.sin(bearing),
      z: across.z * Math.cos(bearing) + upward.z * Math.sin(bearing),
    }
    let best: { point: Vec3; screen: Vec2; reach: number; lit: boolean } | null = null
    for (let step = 0; step <= OUTLINE_DEPTH; step++) {
      // Toward the camera only: the far half of the body is behind this one.
      const lean = (-Math.PI / 2 + (Math.PI * step) / OUTLINE_DEPTH) * 0.94
      const direction: Vec3 = {
        x: plane.x * Math.cos(lean) + eye.x * Math.sin(lean),
        y: plane.y * Math.cos(lean) + eye.y * Math.sin(lean),
        z: plane.z * Math.cos(lean) + eye.z * Math.sin(lean),
      }
      const point = surfaceAt(direction)
      const screen = at(point)
      const reach = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y)
      if (!best || reach > best.reach) {
        best = { point, screen, reach, lit: illumination(direction, light) > 0 }
      }
    }
    return best!
  })
  const outline = polygonPath(rim.map((edge) => edge.screen))

  // The day-night line: the great circle of directions square to the light,
  // with the body's own radius along each one. Analytic, so it is smooth.
  const edge = (() => {
    const pole: Vec3 = Math.abs(light.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    const a = unit(crossOf(pole, light))
    const c = crossOf(light, a)
    return Array.from({ length: 96 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2
      const direction = {
        x: a.x * Math.cos(angle) + c.x * Math.sin(angle),
        y: a.y * Math.cos(angle) + c.y * Math.sin(angle),
        z: a.z * Math.cos(angle) + c.z * Math.sin(angle),
      }
      return { point: surfaceAt(direction), facing: front(direction) > 0 }
    })
      .filter((sample) => sample.facing)
      .map((sample) => at(sample.point))
  })()

  // The night side: the body's own outline outside, the terminator inside.
  const shadow = nightPath(
    rim.map((point) => point.screen),
    rim.map((point) => !point.lit),
    edge,
  )

  const pitList = sphereLattice(pits).map((site, index) => {
    const local = surfacePoint(frame, 1, latitudeOf(site), longitudeOf(site))
    const point = surfaceAt(local)
    const facing = front(local)
    const screen = at(point)
    const scale = 2 + ((((index * 41 + grain * 17) % 13) + 13) % 13) / 13 * 4
    const outward = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y) || 1
    return {
      index,
      shown: facing > 0.18,
      screen,
      major: scale,
      minor: scale * Math.max(0.12, facing),
      angle:
        (Math.atan2((screen.y - ORIGIN.y) / outward, (screen.x - ORIGIN.x) / outward) * 180) /
          Math.PI +
        90,
      lit: illumination(local, light) > 0,
    }
  })

  const companion = moonlet
    ? (() => {
        const state = orbitalState(
          {
            semiMajor: RADIUS * 1.9,
            eccentricity: 0.3,
            inclination: 28,
            node: 40,
            period: 5,
          },
          motion.clock,
        )
        return { point: at(state.position), behind: front(state.position) < 0 }
      })()
    : null

  const readout = ((Math.round(turn) % 360) + 360) % 360

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Celestial asteroid, ${body} body at ${readout} degrees, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 30 : 10, 90)
        if (delta !== 0) apply(turn + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(180)
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
          {/* The mean radius the lobes depart from. */}
          <circle cx={100} cy={100} r={px(RADIUS)} strokeDasharray="3 3" />
          <path
            data-axis
            d={linePath([
              at(scale3(surfacePoint(frame, 1, 90, 0), RADIUS * 1.35)),
              at(scale3(surfacePoint(frame, 1, -90, 0), RADIUS * 1.35)),
            ])}
            strokeDasharray="3 2"
          />
        </g>
      )}

      <g data-frame data-view={view}>
        {companion?.behind && (
          <circle data-moonlet cx={px(companion.point.x)} cy={px(companion.point.y)} r={5} {...cast} />
        )}

        <path data-body d={outline} {...shell} />
        {shadow && <path data-shadow d={shadow} {...cast} opacity={0.5} />}

        <g data-craters>
          {pitList
            .filter((pit) => pit.shown)
            .map((pit) => (
              <g
                key={pit.index}
                data-crater={pit.index}
                transform={`translate(${px(pit.screen.x)} ${px(pit.screen.y)}) rotate(${px(pit.angle)})`}
              >
                <ellipse
                  rx={px(pit.major)}
                  ry={px(pit.minor)}
                  {...machined}
                  opacity={pit.lit ? 0.5 : 0.24}
                />
              </g>
            ))}
        </g>

        {companion && !companion.behind && (
          <circle
            data-moonlet
            cx={px(companion.point.x)}
            cy={px(companion.point.y)}
            r={5}
            {...machined}
          />
        )}

        <circle
          data-lamp
          cx={ORIGIN.x}
          cy={px(ORIGIN.y + RADIUS + 24)}
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

/** How far the rock has turned at `clock`, in degrees. */
export function asteroidGoal(behavior: AsteroidBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  switch (behavior) {
    case "tumble":
      return clock * 360
    case "spin":
      return clock * 540
    // Barely turning, the way a body nobody has hit in a long time turns.
    case "drift":
      return clock * 90
    default:
      return 0
  }
}

/* -------------------------------------------------------------------------- */
/* geometry helpers                                                            */
/* -------------------------------------------------------------------------- */

const scale3 = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })

const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const crossOf = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-9 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 0, z: 1 }
}

const latitudeOf = (site: Vec3) => (Math.asin(clamp(site.y, -1, 1)) * 180) / Math.PI
const longitudeOf = (site: Vec3) => (Math.atan2(site.z, site.x) * 180) / Math.PI

/** A horizontal direction from a bearing: 0 is behind the viewer. */
function bearingDirection(bearing: number): Vec3 {
  const a = ((Number.isFinite(bearing) ? bearing : 0) * Math.PI) / 180
  return { x: Math.sin(a), y: 0.16, z: -Math.cos(a) }
}

/**
 * The unlit part of the visible face: the dark arc of the body's own outline,
 * closed against the terminator's visible arc. Two curves that already meet at
 * the limb, so the region between them is the night side exactly — no binning,
 * and no spokes to the centre where a bin happened to miss the terminator.
 */
function nightPath(
  rim: readonly Vec2[],
  dark: readonly boolean[],
  edge: readonly Vec2[],
): string {
  const count = rim.length
  if (dark.every((night) => night)) return polygonPath(rim)
  if (!dark.some((night) => night) || edge.length < 3) return ""

  // The longest unbroken run of dark bins: the one arc the light is not on.
  let best = { start: 0, length: 0 }
  for (let start = 0; start < count; start++) {
    if (dark[start] && dark[(start - 1 + count) % count]) continue
    let length = 0
    while (length < count && dark[(start + length) % count]) length++
    if (length > best.length) best = { start, length }
  }
  if (best.length < 2) return ""
  const arc = Array.from({ length: best.length }, (_, step) => rim[(best.start + step) % count])

  // The terminator comes back as a closed sweep with the far half removed, so
  // it can be split across the seam: start it where its own gap is widest.
  const term = openedAt(edge)
  const tail = arc[arc.length - 1]
  const forward =
    span(tail, term[0]) <= span(tail, term[term.length - 1]) ? term : [...term].reverse()
  return polygonPath([...arc, ...forward])
}

const span = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

/** A sampled arc rotated so it starts after its own widest gap. */
function openedAt(points: readonly Vec2[]): Vec2[] {
  if (points.length < 3) return [...points]
  let seam = 0
  let widest = -1
  for (let index = 0; index < points.length; index++) {
    const gap = span(points[index], points[(index + 1) % points.length])
    if (gap > widest) {
      widest = gap
      seam = index + 1
    }
  }
  return [...points.slice(seam), ...points.slice(0, seam)]
}

function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { CelestialAsteroid }
