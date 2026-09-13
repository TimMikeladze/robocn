"use client"

/**
 * celestial-planet — a tilted, turning globe with a ring system.
 *
 * The mechanism is the occlusion. The rings are one annulus lying in the
 * body's own equatorial plane, and the globe stands in the middle of them: the
 * far half of the ring passes *behind* the body and is cut where the body's
 * silhouette crosses it. A ring point is hidden when it is behind the centre
 * plane and its perpendicular distance to the line of sight is inside the
 * radius — which is exact for a sphere seen orthographically, not a guess.
 * The visible runs are then drawn far, globe, near.
 *
 * The day-night line is not drawn either. `terminator` returns the great
 * circle where the light grazes the sphere, and the night side is the half of
 * that circle facing the camera closed against the unlit half of the limb — so
 * the crescent is a projection rather than a shape.
 *
 * One geometry, four cameras: a sphere looks the same from every angle but its
 * axis does not, so the tilt, the bands, the caps and the ring plane all turn.
 *
 * Design note: docs/celestial-bodies.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bodyFrame,
  illumination,
  latitudeBand,
  orbitalState,
  surfacePoint,
  terminator,
  type CelestialFrame,
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
/** Drawn straight on, which is where a ring plane reads as a plane. */
const NATIVE_VIEW: RobotView = "front"

const RADIUS = 44
const RING_INNER = 58
const RING_OUTER = 82
/** Degrees of spin per second while it returns to its behaviour. */
const SPIN_RATE = 70
const LIMB_STEPS = 72
const RING_STEPS = 120
/** Where a moon is put, as a multiple of the body's radius. */
const MOON_ORBIT = 2.4

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type PlanetBehavior = "rotate" | "orbit" | "tumble" | "static"
export type PlanetSurface = "terrestrial" | "banded" | "ice" | "molten"

/** How many bands, where they sit, how heavy they are, and how many storms. */
const surfaces: Record<
  PlanetSurface,
  { bands: number[]; caps: number; belt: number; storms: number }
> = {
  terrestrial: { bands: [-38, -12, 16, 44], caps: 68, belt: 0.35, storms: 3 },
  banded: { bands: [-56, -34, -14, 6, 26, 48, 66], caps: 78, belt: 0.6, storms: 4 },
  ice: { bands: [-24, 0, 24], caps: 42, belt: 0.22, storms: 1 },
  molten: { bands: [-50, -22, 8, 34, 58], caps: 84, belt: 0.5, storms: 5 },
}

export interface CelestialPlanetProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. The body is a sphere; its axis is not. */
  view?: RobotView
  /** Controlled rotation about the pole, in degrees. Stops the loop. */
  spin?: number
  /** What the globe does when `spin` is not supplied. */
  behavior?: PlanetBehavior
  /** Cycles per second: one revolution. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the globe to turn it, or arrow-key it. */
  interactive?: boolean
  onSpinChange?: (spin: number) => void
  /** Degrees the pole leans out of vertical. Clamped −90..90. */
  tilt?: number
  /** Degrees: the bearing the pole leans toward. */
  precession?: number
  /** Where the light is, in degrees round the body. 0 is behind the viewer. */
  sun?: number
  /** Degrees the light stands above the body's orbital plane. */
  sunHeight?: number
  /** Which kind of world: it changes the banding, not the palette. */
  surface?: PlanetSurface
  /** Rings in the equatorial plane. */
  rings?: boolean
  /** Bodies on real Kepler orbits around it. Clamped 0–3. */
  moons?: number
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function CelestialPlanet({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  spin,
  behavior = "rotate",
  speed = 0.1,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onSpinChange,
  tilt = 24,
  precession = 18,
  sun,
  sunHeight = 8,
  surface = "banded",
  rings = true,
  moons = 1,
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
}: CelestialPlanetProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = spin !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(spin) ? spin : 0) : held
  const goal = React.useCallback((clock: number) => planetGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SPIN_RATE,
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
      onSpinChange?.(bounded)
    },
    [onSpinChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.5) * 720), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const turn = Number.isFinite(motion.value) ? motion.value : 0
  const lean = clamp(Number.isFinite(tilt) ? tilt : 0, -90, 90)
  const wander =
    (Number.isFinite(precession) ? precession : 0) +
    (behavior === "tumble" && !controlled ? motion.clock * 140 : 0)
  const bearing =
    sun !== undefined
      ? Number.isFinite(sun)
        ? sun
        : 0
      : planetSun(behavior, motion.clock)
  const height = clamp(Number.isFinite(sunHeight) ? sunHeight : 0, -89, 89)
  const skin = surfaces[surface] ?? surfaces.banded
  const moonCount = Math.round(clamp(Number.isFinite(moons) ? moons : 0, 0, 3))

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
  // The line of sight, taken from the camera's own depth functional so it
  // cannot drift from the projection it belongs to.
  const eye = unit({
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  })
  const front = (p: Vec3) => p.x * eye.x + p.y * eye.y + p.z * eye.z
  /** Behind the centre plane and inside the silhouette: the globe is in the way. */
  const occluded = (p: Vec3, radius = RADIUS) => {
    const along = front(p)
    if (along >= 0) return false
    return Math.hypot(p.x - eye.x * along, p.y - eye.y * along, p.z - eye.z * along) < radius
  }

  const b = (() => {
    const reference: Vec3 = Math.abs(eye.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
    const across = unit(cross(reference, eye))
    return { across, up: cross(eye, across) }
  })()
  /** The silhouette: the circle on the sphere square to the line of sight. */
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

  const light = direction(bearing, height)
  const frame = bodyFrame({ tilt: lean, precession: wander, spin: turn })

  /* ---- the night side -------------------------------------------------- */

  // Half the terminator, closed against the unlit half of the limb: that is
  // the whole crescent, and it is never drawn as one.
  const nightEdge = terminator(RADIUS, light, 96).filter((point) => front(point) >= -0.001)
  const darkLimb = limb.filter((point) => illumination(point, light) <= 0)
  const night =
    nightEdge.length > 2 && darkLimb.length > 2
      ? polygonPath([...ordered(nightEdge), ...ordered(darkLimb).reverse()].map(at))
      : illumination(eye, light) < 0
        ? polygonPath(limb.map(at))
        : ""

  /* ---- surface --------------------------------------------------------- */

  const bands = skin.bands.map((latitude, index) => ({
    index,
    path: runsPath(
      latitudeBand(frame, RADIUS * 1.001, latitude, 72),
      (point) => front(point) > 0,
      at,
    ),
  }))
  const caps = (["north", "south"] as const).map((pole) => {
    const latitude = pole === "north" ? skin.caps : -skin.caps
    const ring = latitudeBand(frame, RADIUS, latitude, 48)
    const tip = surfacePoint(frame, RADIUS, latitude > 0 ? 90 : -90, 0)
    const visible = ring.filter((point) => front(point) > 0)
    return {
      pole,
      shown: front(tip) > 0 && visible.length > 3,
      path: hullPath([...visible, tip].map(at)),
    }
  })
  // Bands are rings about the pole, so the spin cannot show on them. Storms
  // sit at a longitude, which is what makes the rotation something you can
  // actually see: they come round the limb and go behind it again.
  const storms = Array.from({ length: skin.storms }, (_, index) => {
    const latitude = skin.bands[(index * 3) % skin.bands.length] ?? 0
    const longitude = (index * 137.5) % 360
    const spot = surfacePoint(frame, RADIUS * 1.002, latitude, longitude)
    const facing = front(spot) / RADIUS
    const screen = at(spot)
    const outward = Math.hypot(screen.x - ORIGIN.x, screen.y - ORIGIN.y) || 1
    const scale = 3.4 + (index % 3) * 1.6
    return {
      index,
      shown: facing > 0.14,
      screen,
      major: scale,
      minor: scale * Math.max(0.1, facing) * 0.7,
      angle:
        (Math.atan2((screen.y - ORIGIN.y) / outward, (screen.x - ORIGIN.x) / outward) * 180) /
          Math.PI +
        90,
    }
  })

  const axis = [1, -1].map((end) =>
    at(surfacePoint(frame, RADIUS * 1.22, end > 0 ? 90 : -90, 0)),
  )

  /* ---- the rings ------------------------------------------------------- */

  const ringRuns = rings ? ringSegments(frame, front, occluded) : { far: [], near: [] }
  const ringPath = (run: { outer: Vec3[]; inner: Vec3[] }) =>
    polygonPath([...run.outer, ...[...run.inner].reverse()].map(at))

  /* ---- the moons ------------------------------------------------------- */

  const satellites = Array.from({ length: moonCount }, (_, index) => {
    const state = orbitalState(
      {
        semiMajor: RADIUS * (MOON_ORBIT + index * 0.7),
        eccentricity: 0.18 + index * 0.12,
        inclination: lean + 6 * (index - 1),
        node: wander,
        periapsis: 40 * index,
        period: 6 + index * 3,
        epoch: 120 * index,
      },
      motion.clock,
    )
    return {
      index,
      point: at(state.position),
      radius: 5 - index,
      behind: occluded(state.position),
      lit: illumination(state.position, light) > -0.2,
    }
  })

  const readout = ((Math.round(turn) % 360) + 360) % 360

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Celestial planet, ${surface} world at ${readout} degrees rotation, ${viewNames[view] ?? viewNames.front}`}
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
          <path d={`M 8 100 H 192 M 100 8 V 192`} strokeDasharray="2 3" />
          <circle cx={100} cy={100} r={px(RING_OUTER)} strokeDasharray="4 3" />
        </g>
      )}

      <g data-frame data-view={view}>
        {ringRuns.far.map((run, index) => (
          <path key={`far-${index}`} data-ring="far" d={ringPath(run)} {...machined} opacity={0.62} />
        ))}

        <path data-globe d={polygonPath(limb.map(at))} {...shell} />

        <g data-surface>
          {bands.map((band) => (
            <path
              key={band.index}
              data-band={band.index}
              d={band.path}
              fill="none"
              stroke={palette.dark}
              strokeWidth={px(1.1 + skin.belt * 2.6)}
              strokeLinecap="round"
              opacity={0.24}
            />
          ))}
          {caps
            .filter((cap) => cap.shown)
            .map((cap) => (
              <path key={cap.pole} data-cap={cap.pole} d={cap.path} {...machined} opacity={0.8} />
            ))}
          {storms
            .filter((storm) => storm.shown)
            .map((storm) => (
              <ellipse
                key={storm.index}
                data-storm={storm.index}
                cx={px(storm.screen.x)}
                cy={px(storm.screen.y)}
                rx={px(storm.major)}
                ry={px(storm.minor)}
                transform={`rotate(${px(storm.angle + 90)} ${px(storm.screen.x)} ${px(storm.screen.y)})`}
                {...machined}
                opacity={0.55}
              />
            ))}
        </g>

        {night && <path data-terminator d={night} {...cast} opacity={0.6} />}

        {variant === "blueprint" && (
          <path
            data-axis
            d={linePath(axis)}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        )}

        {ringRuns.near.map((run, index) => (
          <path key={`near-${index}`} data-ring="near" d={ringPath(run)} {...machined} />
        ))}

        {satellites
          .filter((moon) => !moon.behind)
          .map((moon) => (
            <circle
              key={moon.index}
              data-moon={moon.index}
              cx={px(moon.point.x)}
              cy={px(moon.point.y)}
              r={px(moon.radius)}
              {...(moon.lit ? machined : cast)}
            />
          ))}

        <circle
          data-lamp
          cx={px(ORIGIN.x)}
          cy={px(ORIGIN.y + RADIUS + 20)}
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

/** Where the body has turned to at `clock`, in degrees. */
export function planetGoal(behavior: PlanetBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  switch (behavior) {
    case "rotate":
    case "orbit":
      return clock * 360
    // Turning about its pole while the pole itself goes round: the two rates
    // are different on purpose, so no two frames repeat.
    case "tumble":
      return clock * 420
    default:
      return 0
  }
}

/** Where the light is at `clock`, in degrees round the body. */
export function planetSun(behavior: PlanetBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return 28
  // Only a body going round its star changes which side of it is lit.
  return behavior === "orbit" ? ((clock * 90) % 360) - 40 : 28
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

/** A direction from a bearing round the body and a height above its plane. */
function direction(bearing: number, height: number): Vec3 {
  const a = ((Number.isFinite(bearing) ? bearing : 0) * Math.PI) / 180
  const e = ((Number.isFinite(height) ? height : 0) * Math.PI) / 180
  const ce = Math.cos(e)
  return { x: Math.sin(a) * ce, y: Math.sin(e), z: -Math.cos(a) * ce }
}

/**
 * Points round a closed curve, started where the gap is biggest — so an arc
 * cut out of a ring is drawn as one run rather than across its own opening.
 */
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

/** The ring, cut into the runs the globe leaves visible, far side and near. */
function ringSegments(
  frame: CelestialFrame,
  front: (p: Vec3) => number,
  occluded: (p: Vec3, radius?: number) => boolean,
) {
  const samples = Array.from({ length: RING_STEPS + 1 }, (_, index) => {
    const longitude = (index / RING_STEPS) * 360
    const outer = surfacePoint(frame, RING_OUTER, 0, longitude)
    const inner = surfacePoint(frame, RING_INNER, 0, longitude)
    return {
      outer,
      inner,
      hidden: occluded(outer) && occluded(inner),
      side: front(outer) < 0 ? ("far" as const) : ("near" as const),
    }
  })

  const far: { outer: Vec3[]; inner: Vec3[] }[] = []
  const near: { outer: Vec3[]; inner: Vec3[] }[] = []
  let run: { outer: Vec3[]; inner: Vec3[] } | null = null
  let side: "far" | "near" | null = null
  const close = () => {
    if (run && run.outer.length > 1) (side === "far" ? far : near).push(run)
    run = null
    side = null
  }
  samples.forEach((sample, index) => {
    if (sample.hidden) {
      close()
      return
    }
    if (run && sample.side !== side) close()
    if (!run) {
      run = { outer: [], inner: [] }
      side = sample.side
      // The far and near halves meet in front of and behind the body. Carrying
      // the previous sample into the new run closes that seam exactly, so the
      // only breaks left in the ring are the ones the globe really makes.
      const before = samples[index - 1]
      if (before && !before.hidden) {
        run.outer.push(before.outer)
        run.inner.push(before.inner)
      }
    }
    run.outer.push(sample.outer)
    run.inner.push(sample.inner)
  })
  close()
  return { far, near }
}

/** A polyline broken wherever the curve goes round the back. */
function runsPath(
  points: readonly Vec3[],
  visible: (p: Vec3) => boolean,
  at: (p: Vec3) => Vec2,
): string {
  const parts: string[] = []
  let run: Vec2[] = []
  for (const point of [...points, points[0]]) {
    if (point && visible(point)) run.push(at(point))
    else {
      if (run.length > 1) parts.push(linePath(run))
      run = []
    }
  }
  if (run.length > 1) parts.push(linePath(run))
  return parts.join(" ")
}

/** The outline round a set of projected points. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** A planar polygon in the order it was built: a cut face, a ring run. */
function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a band, an axis, a dimension line. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { CelestialPlanet }
