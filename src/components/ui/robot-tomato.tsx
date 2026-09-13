"use client"

/**
 * robot-tomato — a truss-hung crop unit.
 *
 * Everything else in the set stands on the ground, floats, or is bolted to a
 * bulkhead. This one hangs: a clamp on the truss, a peduncle with two hinges,
 * and the fruit swinging under it. One swing angle is split between the hinges,
 * so the stem droops rather than pivoting as a stick, and the link lengths are
 * held exactly at every angle.
 *
 * `ripeness` is coverage, not a colour ramp: the skin still to ripen is the
 * cap of the surface *above* a latitude, painted in the live colour, and that
 * latitude climbs from the blossom end to the shoulder as the fruit ripens.
 * The boundary is the near half of a real ring on the body, so it curves the
 * way the fruit does, and it is gone entirely once the shoulder has turned.
 *
 * Design note: docs/produce-robots.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  bladeRing,
  hingeRotate,
  latitudeRing,
  meridianLine,
  revolveProfile,
  widestSection,
  type ProduceProfile,
} from "@/lib/robocn/produce"
import {
  aboutPoint,
  capsulePath,
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
const VIEW_HEIGHT = 182
/** The clamp on the truss: world origin, and where the machine hangs from. */
const ORIGIN = { x: 95, y: 30 }
const NATIVE_VIEW: RobotView = "front"

/** The peduncle: two links, two hinges, and the fruit rigid below the second. */
const STEM_UPPER = 26
const STEM_LOWER = 15
/** How the swing is shared out. The upper hinge takes the larger share. */
const UPPER_SHARE = 0.6
const MAX_SWING = 34
/** The fruit: oblate, and dimpled at both poles. */
const BODY_RADIUS = 30
const BODY_HALF_HEIGHT = 22
/** Where the sepals are hinged, as a station on the profile. */
const CALYX_T = 0.86
const SEPAL_LENGTH = 18
const SEPAL_PITCH = -26
/** Degrees per second while the fruit is returning to its behaviour. */
const SWING_RATE = 58
const RINGS = 12
const MERIDIANS = 24
/** Where the floor is, in view units, for the contact shadow. */
const FLOOR_Y = 160

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 0.92, rise: 56 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.96, rise: 4 },
}

/** The fruit, hanging under the origin: flattened poles, widest at the belt. */
export const tomatoProfile: ProduceProfile = (t) => {
  const station = clamp(t, 0, 1)
  return {
    height: -BODY_HALF_HEIGHT + 2 * BODY_HALF_HEIGHT * station,
    radius: BODY_RADIUS * Math.pow(Math.max(0, 1 - Math.pow(2 * station - 1, 2)), 0.34),
  }
}

export type TomatoBehavior = "sway" | "settle" | "sort" | "static"

export interface RobotTomatoProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One fruit, four projections. */
  view?: RobotView
  /** Controlled swing off plumb, in degrees, clamped to ±34. Stops the loop. */
  swing?: number
  behavior?: TomatoBehavior
  /** Cycles per second: one swing, one knock. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the fruit to swing it, or arrow-key it. */
  interactive?: boolean
  onSwingChange?: (swing: number) => void
  /** How far the ripening front has climbed, 0 at the blossom end to 1. */
  ripeness?: number
  /** Meridian furrows cut into the shell, clamped to 4..9. */
  lobes?: number
  /** Sepals hinged on the crown, clamped to 0..8. */
  sepals?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function RobotTomato({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  swing,
  behavior = "sway",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onSwingChange,
  ripeness = 0.72,
  lobes = 6,
  sepals = 5,
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
}: RobotTomatoProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = swing !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled
    ? clamp(Number.isFinite(swing) ? swing : 0, -MAX_SWING, MAX_SWING)
    : held
  const goal = React.useCallback((clock: number) => tomatoGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SWING_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const lean = clamp(motion.value, -MAX_SWING, MAX_SWING)
  const degrees = Math.round(lean)
  const ripe = clamp(Number.isFinite(ripeness) ? ripeness : 0, 0, 1)
  const ripePercent = Math.round(ripe * 100)
  const furrows = Math.round(clamp(Number.isFinite(lobes) ? lobes : 6, 4, 9))
  const sepalCount = Math.round(clamp(Number.isFinite(sepals) ? sepals : 5, 0, 8))

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0, -MAX_SWING, MAX_SWING)
      setHeld(bounded)
      onSwingChange?.(bounded)
    },
    [onSwingChange],
  )

  const camera = robotCamera(view)
  // Which way starboard runs on screen in this camera, so a drag moves the
  // fruit the way the pointer went from every angle.
  const handed = camera.project(1, 0, 0).x >= 0 ? 1 : -1
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * MAX_SWING * handed),
      [apply, handed],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const live = robotSurface("accent", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /** Produce space puts azimuth 0 at +z; this machine faces the camera at −z. */
  const world = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: -point.z })
  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const towardCamera = (point: Vec3) => camera.depth(point.x, point.y, point.z)

  // The chain: everything below the lower hinge turns with it, then the whole
  // assembly turns about the clamp. Link lengths are held by the rotation.
  const upperAngle = lean * UPPER_SHARE
  const lowerAngle = lean * (1 - UPPER_SHARE)
  const axis = { x: 0, y: 0, z: 1 }
  const jointRest: Vec3 = { x: 0, y: -STEM_UPPER, z: 0 }
  const pose = (points: readonly Vec3[]) =>
    hingeRotate(
      hingeRotate(points, { origin: jointRest, axis }, lowerAngle),
      { origin: { x: 0, y: 0, z: 0 }, axis },
      upperAngle,
    )

  const joint = pose([jointRest])[0]
  const hub = pose([{ x: 0, y: -STEM_UPPER - STEM_LOWER, z: 0 }])[0]
  /** The fruit hangs rigidly off the lower link, crown at the hub. */
  const drop = -STEM_UPPER - STEM_LOWER - BODY_HALF_HEIGHT
  const onBody = (point: Vec3): Vec3 => ({ x: point.x, y: point.y + drop, z: point.z })
  const bodyPoints = (points: readonly Vec3[]) => pose(points.map(world).map(onBody))

  const surfaceOptions = { rings: RINGS, meridians: MERIDIANS, lobes: furrows, lobeDepth: 0.085 }
  const bodyHull = convexHull2(
    bodyPoints(revolveProfile(tomatoProfile, surfaceOptions)).map(at),
  )
  const bodyCentre = pose([{ x: 0, y: drop, z: 0 }])[0]

  // A furrow is a trough between two lobes, and only the near ones are drawn.
  const lobeLines = Array.from({ length: furrows }, (_, index) => {
    const azimuth = ((index + 0.5) / furrows) * 360
    const line = bodyPoints(meridianLine(tomatoProfile, azimuth, surfaceOptions, 14))
    const middle = line[Math.floor(line.length / 2)]
    return {
      index,
      facing: towardCamera(middle) > towardCamera(bodyCentre),
      d: linePath(line.map(at)),
    }
  }).filter((furrow) => furrow.facing)

  // The ripening front: the boundary latitude, and the cap of skin *above* it
  // that has not turned yet. It climbs as the fruit ripens and is gone at 1.
  const frontT = ripe
  const widest = widestSection(tomatoProfile)
  const flatCamera = camera.lift < 1e-6
  const ringPoints =
    ripe > 0.004 && ripe < 0.996
      ? bodyPoints(latitudeRing(tomatoProfile, frontT, surfaceOptions, 48)).map(at)
      : []
  const nearRing = ringPoints.length > 0 && !flatCamera ? nearArc(ringPoints) : []
  const frontPath =
    ripe <= 0.004
      ? // Nothing has turned: the whole fruit is still the unripe colour.
        hullPath(bodyHull)
      : ripe >= 0.996
        ? null
        : flatCamera
          ? // Straight down, the visible skin is the shoulder: unripe out to
            // the front once it has climbed past the belt, and all of it before.
            frontT >= widest.t
            ? polygonPath(ringPoints)
            : hullPath(bodyHull)
          : polygonPath([...nearRing, ...upperChain(bodyHull)])

  const crown = tomatoProfile(CALYX_T)
  const calyx = bladeRing(sepalCount, {
    radius: crown.radius * 0.86,
    height: crown.height,
    length: SEPAL_LENGTH,
    width: 14,
    taper: 0.26,
    pitch: SEPAL_PITCH,
  }).map((blade) => {
    const corners = bodyPoints(blade.corners)
    const root = bodyPoints([blade.root])[0]
    const tip = bodyPoints([blade.tip])[0]
    return {
      index: blade.index,
      depth: towardCamera(tip),
      d: polygonPath(corners.map(at)),
      rib: linePath([at(root), at(tip)]),
    }
  })
  calyx.sort((a, b) => a.depth - b.depth)
  const crownDepth = towardCamera(
    bodyPoints([{ x: 0, y: tomatoProfile(1).height, z: 0 }])[0],
  )

  // An inspection port on the belt, facing the machine's own front.
  const portSeat = bodyPoints([{ x: 0, y: tomatoProfile(0.5).height, z: -tomatoProfile(0.5).radius }])[0]
  const portNormal = pose([{ x: 0, y: 0, z: -1 }])[0]
  const portFaces = towardCamera(portNormal) > 0.2
  const portPanel = (() => {
    const across = camera.project(portNormal.z, 0, -portNormal.x)
    const centre = at(portSeat)
    return `matrix(${px(across.x)} ${px(across.y)} 0 ${px(camera.lift)} ${px(centre.x)} ${px(centre.y)})`
  })()

  const rail = capsulePath(at({ x: -52, y: 0, z: 0 }), at({ x: 52, y: 0, z: 0 }), 3.4)
  const shadowCentre = at({ x: bodyCentre.x, y: 0, z: bodyCentre.z })

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot tomato, ${degrees} degrees off plumb, ${ripePercent} percent ripe, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -MAX_SWING : undefined}
      aria-valuemax={interactive ? MAX_SWING : undefined}
      aria-valuenow={interactive ? degrees : undefined}
      aria-valuetext={interactive ? `${degrees} degrees off plumb` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 15)
        if (delta !== 0) apply(lean + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(MAX_SWING)
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
          <path d={`M ${ORIGIN.x} ${ORIGIN.y} V ${FLOOR_Y}`} strokeDasharray="2 3" />
          <path d={`M 12 ${ORIGIN.y} H 178`} strokeDasharray="2 3" />
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
            cx={px(shadowCentre.x)}
            cy={FLOOR_Y}
            rx={px(BODY_RADIUS * 0.92)}
            ry={px(Math.max(2.4, BODY_RADIUS * 0.92 * camera.flatten))}
            fill={palette.dark}
            opacity={0.12}
          />
        )}

        <g data-hanger>
          <path d={rail} {...machined} />
          <path
            d={polygonPath([
              at({ x: -7, y: 2, z: 0 }),
              at({ x: 7, y: 2, z: 0 }),
              at({ x: 5, y: -7, z: 0 }),
              at({ x: -5, y: -7, z: 0 }),
            ])}
            {...cast}
          />
        </g>

        <path data-stem="upper" d={capsulePath(at({ x: 0, y: -2, z: 0 }), at(joint), 2.8)} {...cast} />
        <circle cx={px(at(joint).x)} cy={px(at(joint).y)} r={3} {...machined} />
        <path data-stem="lower" d={capsulePath(at(joint), at(hub), 2.4)} {...cast} />

        {calyx
          .filter((sepal) => sepal.depth <= crownDepth)
          .map((sepal) => (
            <path key={`far-${sepal.index}`} data-sepal={sepal.index} d={sepal.d} {...machined} />
          ))}

        <path data-body d={hullPath(bodyHull)} {...shell} />
        {frontPath && (
          <path
            data-front
            d={frontPath}
            fillRule="evenodd"
            {...live}
            stroke={variant === "solid" ? "none" : live.stroke}
          />
        )}
        {nearRing.length > 1 && (
          <path d={linePath(nearRing)} fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.35} />
        )}

        <g fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.3}>
          {lobeLines.map((furrow) => (
            <path key={furrow.index} data-lobe={furrow.index} d={furrow.d} />
          ))}
        </g>

        {portFaces && (
          <g data-port transform={portPanel}>
            <rect x={-7} y={-4.5} width={14} height={9} rx={2.4} {...machined} />
            {[-2.6, 0, 2.6].map((offset) => (
              <path
                key={offset}
                d={`M ${offset} -2.6 V 2.6`}
                stroke={palette.dark}
                strokeWidth={0.8}
              />
            ))}
          </g>
        )}

        {calyx
          .filter((sepal) => sepal.depth > crownDepth)
          .map((sepal) => (
            <g key={`near-${sepal.index}`}>
              <path data-sepal={sepal.index} d={sepal.d} {...machined} />
              <path d={sepal.rib} fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.5} />
            </g>
          ))}

        <circle
          data-lamp
          cx={px(at(hub).x)}
          cy={px(at(hub).y)}
          r={2.6}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {variant === "blueprint" && (
        <text x={178} y={24} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.grid}>
          {degrees}° · {ripePercent}%
        </text>
      )}
      {label && (
        <text x={ORIGIN.x} y={176} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** Where the fruit is hanging at `clock`, in degrees off plumb. */
export function tomatoGoal(behavior: TomatoBehavior, clock: number): number {
  if (behavior === "static") return 0
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Knocked, and swinging it off over the cycle.
    case "settle":
      return 30 * Math.exp(-3.4 * t) * Math.cos(t * Math.PI * 6)
    // Over to one side, held there to be picked, then back.
    case "sort":
      if (t < 0.25) return (t / 0.25) * 26
      if (t < 0.7) return 26
      return 26 * (1 - (t - 0.7) / 0.3)
    default:
      return 24 * Math.sin(t * Math.PI * 2)
  }
}

/** The near half of a projected ring: the half a camera above sees as lower. */
function nearArc(ring: readonly Vec2[]): Vec2[] {
  if (ring.length < 3) return [...ring]
  let left = 0
  let right = 0
  ring.forEach((point, index) => {
    if (point.x < ring[left].x) left = index
    if (point.x > ring[right].x) right = index
  })
  const chain = (from: number, to: number) => {
    const points: Vec2[] = []
    for (let index = from; ; index = (index + 1) % ring.length) {
      points.push(ring[index])
      if (index === to) break
    }
    return points
  }
  const forward = chain(left, right)
  const backward = chain(right, left).reverse()
  const mean = (points: Vec2[]) => points.reduce((sum, p) => sum + p.y, 0) / points.length
  return mean(forward) >= mean(backward) ? forward : backward
}

/** The upper boundary of a silhouette, walked from its right end to its left. */
function upperChain(hull: readonly Vec2[]): Vec2[] {
  if (hull.length < 3) return [...hull]
  let left = 0
  let right = 0
  hull.forEach((point, index) => {
    if (point.x < hull[left].x) left = index
    if (point.x > hull[right].x) right = index
  })
  const chain = (from: number, to: number) => {
    const points: Vec2[] = []
    for (let index = from; ; index = (index + 1) % hull.length) {
      points.push(hull[index])
      if (index === to) break
    }
    return points
  }
  const forward = chain(right, left)
  const backward = chain(left, right).reverse()
  const mean = (points: Vec2[]) => points.reduce((sum, p) => sum + p.y, 0) / points.length
  return mean(forward) <= mean(backward) ? forward : backward
}

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(hull: readonly Vec2[]): string {
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** A planar polygon, in the order it was built. */
function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a furrow, a rib, a ripening front. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { RobotTomato }
