"use client"

/**
 * robot-strawberry — a berry-shelled field unit with a lattice of sensor studs.
 *
 * The mechanism is the skin. The studs are placed by the golden angle over the
 * *surface area* of the profile rather than over its parameter, so they sit an
 * equal distance apart on a body whose radius changes all the way up, and each
 * one runs out along its own surface normal. Above them the calyx is a ring of
 * rigid blades on one hinge: `bloom` opens them and drives the studs out
 * together.
 *
 * One geometry, four cameras; the studs and blades are hidden-line culled
 * against the same surface they sit on. Design note: docs/produce-robots.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bladeRing,
  goldenLattice,
  latitudeRing,
  revolveProfile,
  type ProduceProfile,
} from "@/lib/robocn/produce"
import {
  aboutPoint,
  capsulePath,
  circleFootprint,
  extrudedPath,
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

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 172
/** The centre of the foot cup, on the ground, in view units. */
const ORIGIN = { x: 95, y: 142 }
const NATIVE_VIEW: RobotView = "front"

const FLOOR = 6
const BODY_HEIGHT = 84
const SHOULDER_RADIUS = 31
/** The profile's own peak, so the shoulder radius means what it says. */
const PROFILE_PEAK = 0.4726
/** Where the studs stop: the tip pad below, the calyx ring above. */
const LATTICE_FROM = 0.08
const LATTICE_TO = 0.9
/** How far a stud stands off the skin, seated and run out. */
const STUD_SEATED = 1.1
const STUD_TRAVEL = 3.6
const STUD_RADIUS = 1.6
/** The calyx: where it is hinged, and the arc its blades work through. */
const CALYX_T = 0.9
const BLADE_LENGTH = 19
const BLADE_WIDTH = 19
const BLADE_FURLED = 54
const BLADE_SPLAYED = -58
/** Bloom per second while the calyx is returning to its behaviour. */
const BLOOM_RATE = 0.9
const RINGS = 12
const MERIDIANS = 24

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 0.9, rise: -48 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.95, rise: -6 },
}

/**
 * The body: a point at the floor swelling to a shoulder three quarters of the
 * way up and doming over into the calyx seat, so the surface area — and with
 * it the lattice — crowds toward the top.
 */
export const strawberryProfile: ProduceProfile = (t) => {
  const station = clamp(t, 0, 1)
  return {
    height: FLOOR + BODY_HEIGHT * station,
    radius:
      (SHOULDER_RADIUS * Math.pow(station, 0.85) * Math.sqrt(Math.max(0, 1 - 0.85 * station))) /
      PROFILE_PEAK,
  }
}

export type StrawberryBehavior = "unfurl" | "probe" | "furl" | "static"

export interface RobotStrawberryProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One berry, four projections. */
  view?: RobotView
  /** Controlled bloom, 0 furled and seated to 1 splayed and run out. */
  bloom?: number
  behavior?: StrawberryBehavior
  /** Cycles per second: one open-and-furl. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up and down to work the calyx, or arrow-key it. */
  interactive?: boolean
  onBloomChange?: (bloom: number) => void
  /** Studs on the skin, clamped to 10..48. */
  seeds?: number
  /** Calyx blades, clamped to 3..9. */
  blades?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function RobotStrawberry({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  bloom,
  behavior = "unfurl",
  speed = 0.26,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onBloomChange,
  seeds = 26,
  blades = 6,
  signal = "ready",
  showGround = true,
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
}: RobotStrawberryProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = bloom !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(bloom) ? bloom : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => strawberryGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: BLOOM_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const open = clamp(motion.value, 0, 1)
  const percent = Math.round(open * 100)
  const studCount = Math.round(clamp(Number.isFinite(seeds) ? seeds : 26, 10, 48))
  const bladeCount = Math.round(clamp(Number.isFinite(blades) ? blades : 6, 3, 9))

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0, 0, 1)
      setHeld(bounded)
      onBloomChange?.(bounded)
    },
    [onBloomChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Pull down and the calyx comes down with the pointer.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.y * 1.3 - 0.15), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /** Produce space puts azimuth 0 at +z; this machine faces the camera at −z. */
  const world = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: -point.z })
  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const towardCamera = (point: Vec3) => camera.depth(point.x, point.y, point.z)
  const panelAt = (n: Vec3, p: Vec3) => {
    const across = camera.project(n.z, 0, -n.x)
    const centre = at(p)
    return `matrix(${px(across.x)} ${px(across.y)} 0 ${px(camera.lift)} ${px(centre.x)} ${px(centre.y)})`
  }

  const bodyPath = hullPath(
    revolveProfile(strawberryProfile, { rings: RINGS, meridians: MERIDIANS })
      .map(world)
      .map(at),
  )
  const shoulder = linePath(
    latitudeRing(strawberryProfile, 0.72, { meridians: 40 }, 40)
      .map(world)
      .filter((point) => towardCamera(point) > 0)
      .map(at),
  )

  const reach = STUD_SEATED + STUD_TRAVEL * open
  const studs = goldenLattice(strawberryProfile, studCount, {
    from: LATTICE_FROM,
    to: LATTICE_TO,
  }).map((site) => {
    const seat = world(site.position)
    const normal = world(site.normal)
    const tip = {
      x: seat.x + normal.x * reach,
      y: seat.y + normal.y * reach,
      z: seat.z + normal.z * reach,
    }
    return {
      index: site.index,
      normal,
      seat,
      facing: towardCamera(normal) > 0.08,
      pit: panelAt(normal, seat),
      stud: capsulePath(at(seat), at(tip), STUD_RADIUS),
    }
  })

  const calyx = bladeRing(bladeCount, {
    radius: strawberryProfile(CALYX_T).radius * 0.94,
    height: strawberryProfile(CALYX_T).height,
    length: BLADE_LENGTH,
    width: BLADE_WIDTH,
    taper: 0.22,
    pitch: BLADE_FURLED + (BLADE_SPLAYED - BLADE_FURLED) * open,
  }).map((blade) => {
    const corners = blade.corners.map(world)
    const root = world(blade.root)
    const tip = world(blade.tip)
    return {
      index: blade.index,
      depth: towardCamera({ x: (root.x + tip.x) / 2, y: (root.y + tip.y) / 2, z: (root.z + tip.z) / 2 }),
      path: polygonPath(corners.map(at)),
      rib: linePath([at(root), at(tip)]),
    }
  })
  calyx.sort((a, b) => a.depth - b.depth)
  const bodyDepth = towardCamera({ x: 0, y: strawberryProfile(CALYX_T).height, z: 0 })

  const crown = strawberryProfile(1)
  const stemFoot = { x: 0, y: crown.height - 2, z: 0 }
  const stemHead = { x: 0, y: crown.height + 8, z: 0 }
  const foot = extrudedPath(circleFootprint(0, 0, 9.5, 14), camera, FLOOR + 1.5, 0)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot strawberry, calyx ${percent} percent open, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(open + delta)
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
          <path
            d={`M 12 ${ORIGIN.y} H 178 M ${ORIGIN.x} 14 V ${ORIGIN.y + 12}`}
            strokeDasharray="2 3"
          />
        </g>
      )}

      <g
        data-frame
        data-view={view}
        transform={aboutPoint(
          framing[view]?.rise ? `translate(0 ${framing[view].rise})` : "",
          ORIGIN.x,
          ORIGIN.y,
          framing[view]?.zoom ?? 1,
        )}
      >
        {showGround && (
          <ellipse
            cx={ORIGIN.x}
            cy={ORIGIN.y}
            rx={px(SHOULDER_RADIUS * 0.9)}
            ry={px(Math.max(2.4, SHOULDER_RADIUS * 0.9 * camera.flatten))}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-foot transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
          <path d={foot} {...machined} />
        </g>

        {calyx
          .filter((blade) => blade.depth <= bodyDepth)
          .map((blade) => (
            <g key={`far-${blade.index}`}>
              <path data-blade={blade.index} d={blade.path} {...machined} />
              <path d={blade.rib} fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.5} />
            </g>
          ))}

        <path data-body d={bodyPath} {...shell} />
        <path d={shoulder} fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.18} />

        {studs
          .filter((stud) => stud.facing)
          .map((stud) => (
            <g key={stud.index}>
              <ellipse transform={stud.pit} rx={2.4} ry={1.6} fill={palette.dark} opacity={0.4} />
              <path data-seed={stud.index} d={stud.stud} {...machined} />
              <circle
                cx={px(at({
                  x: stud.seat.x + stud.normal.x * reach,
                  y: stud.seat.y + stud.normal.y * reach,
                  z: stud.seat.z + stud.normal.z * reach,
                }).x)}
                cy={px(at({
                  x: stud.seat.x + stud.normal.x * reach,
                  y: stud.seat.y + stud.normal.y * reach,
                  z: stud.seat.z + stud.normal.z * reach,
                }).y)}
                r={0.8}
                fill={palette.dark}
                opacity={0.55}
              />
            </g>
          ))}

        {calyx
          .filter((blade) => blade.depth > bodyDepth)
          .map((blade) => (
            <g key={`near-${blade.index}`}>
              <path data-blade={blade.index} d={blade.path} {...machined} />
              <path d={blade.rib} fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.5} />
            </g>
          ))}

        <path data-stem d={capsulePath(at(stemFoot), at(stemHead), 2.3)} {...cast} />
        <circle
          data-lamp
          cx={px(at(stemHead).x)}
          cy={px(at(stemHead).y)}
          r={2.4}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {variant === "blueprint" && (
        <text x={178} y={24} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.grid}>
          {percent}%
        </text>
      )}
      {label && (
        <text x={ORIGIN.x} y={166} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** How far open the calyx is aiming to be at `clock`, 0..1. */
export function strawberryGoal(behavior: StrawberryBehavior, clock: number): number {
  if (behavior === "static") return 0.45
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Open, work, furl again.
    case "unfurl":
      if (t < 0.28) return (t / 0.28) * 0.92
      if (t < 0.7) return 0.92
      return 0.92 * (1 - (t - 0.7) / 0.3)
    // Shut, bar the two moments it cracks open to look.
    case "furl":
      return 0.06 + 0.46 * Math.max(crack(t, 0.2), crack(t, 0.66))
    // Working the middle of the range, studs never fully seated.
    default:
      return 0.5 + 0.18 * Math.sin(t * Math.PI * 2)
  }
}

/** A short spike either side of `at`, on a cycle that wraps. */
function crack(t: number, at: number) {
  const gap = Math.abs(t - at)
  return Math.max(0, 1 - Math.min(gap, 1 - gap) / 0.1)
}

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** A planar polygon, in the order it was built: a blade, a flat panel. */
function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a seam, a rib, a latitude. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { RobotStrawberry }
