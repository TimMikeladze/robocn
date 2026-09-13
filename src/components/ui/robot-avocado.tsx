"use client"

/**
 * robot-avocado — a split-shell specimen pod.
 *
 * The mechanism is the cut: the body is one solid of revolution, halved on the
 * `x = 0` plane, and the two halves swing on a vertical pin behind the machine.
 * The stone rides up out of the gap on a screw column as they part, so a single
 * number opens the shell, raises the core and draws the latch apart.
 *
 * Because the halves are the same surface, closing them reassembles it exactly.
 * The interior is a real cut face — the section polygon in the hinge plane —
 * drawn only while it faces the camera, never a shape painted on the outside.
 *
 * One geometry, four cameras. Design note: docs/produce-robots.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  goldenLattice,
  halfShell,
  hingeRotate,
  latitudeRing,
  profilePoint,
  widestSection,
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

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 182
/** The centre of the pedestal, on the ground, in view units. */
const ORIGIN = { x: 100, y: 152 }
/** The pod is drawn straight on. */
const NATIVE_VIEW: RobotView = "front"

/** The shell, in world units: it stands on a pedestal, not on the floor. */
const FLOOR = 10
const SHELL_HEIGHT = 96
const BULB_RADIUS = 34
const NECK_RADIUS = 8
/**
 * The pin the halves swing on: a rod along the fore-aft axis, on the floor
 * under the machine, so the shell opens the way a bivalve does. Face is at −z.
 */
const HINGE_Y = FLOOR + 8
const HINGE_REACH = 15
const MAX_OPEN = 34
/** Shell wall: what makes an open half read as a bowl and not a cut-out. */
const WALL = 3.6
/** The stone, and how far the column lifts it over the stroke. */
const STONE_RADIUS = 15
const STONE_REST = FLOOR + 34
const STONE_LIFT = 26
const COLUMN_RADIUS = 5.5
/** The latch lugs meet at the front seam, this far up the shell. */
const LATCH_T = 0.44
/** Shell opening per second while it is returning to its behaviour. */
const SWING_RATE = 1.15
const RINGS = 10
const MERIDIANS = 14
/** Speckle on the skin: illustrated, but placed on the surface it sits on. */
const SPECKLES = 9

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back, and rides up, to hold one frame. */
const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 0.86, rise: -54 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.94, rise: -6 },
}

/**
 * The body: a wide bulb low down drawn out into a neck. The radius never
 * reaches zero — the base seats in the pedestal cup and the crown carries the
 * stem boss.
 */
export const avocadoProfile: ProduceProfile = (t) => ({
  height: FLOOR + SHELL_HEIGHT * t,
  radius:
    NECK_RADIUS +
    (BULB_RADIUS - NECK_RADIUS) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 1.2),
})

/** The inside of the same shell, one wall thickness in. */
export const avocadoInnerProfile: ProduceProfile = (t) => {
  const outer = avocadoProfile(clamp(t, 0, 1))
  return {
    height: FLOOR + WALL + (SHELL_HEIGHT - 2 * WALL) * clamp(t, 0, 1),
    radius: Math.max(0.5, outer.radius - WALL),
  }
}

export type AvocadoBehavior = "present" | "ajar" | "scan" | "static"
export type AvocadoStone = "optic" | "core" | "none"

export interface RobotAvocadoProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One shell, four projections. */
  view?: RobotView
  /** Controlled shell opening, 0 shut to 1 wide. Stops the loop. */
  open?: number
  /** What the shell does when `open` is not supplied. */
  behavior?: AvocadoBehavior
  /** Cycles per second: one open-and-shut. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the shell to part it, or arrow-key it. */
  interactive?: boolean
  onOpenChange?: (open: number) => void
  /** Where the stone's optic is aimed, in degrees off the face. */
  bearing?: number
  /** What sits in the socket. */
  stone?: AvocadoStone
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function RobotAvocado({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  open,
  behavior = "present",
  speed = 0.24,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onOpenChange,
  bearing,
  stone = "optic",
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
}: RobotAvocadoProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = open !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(open) ? open : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => avocadoGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SWING_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const spread = clamp(motion.value, 0, 1)
  const percent = Math.round(spread * 100)
  const angle = spread * MAX_OPEN
  const aim = clamp(
    bearing !== undefined
      ? Number.isFinite(bearing)
        ? bearing
        : 0
      : avocadoBearing(behavior, motion.clock),
    -180,
    180,
  )

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0, 0, 1)
      setHeld(bounded)
      onOpenChange?.(bounded)
    },
    [onOpenChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Either way out of the middle parts the shell — which is the gesture a
    // person makes at a clamshell, whichever half they take hold of.
    onDrag: React.useCallback((unit: Vec2) => apply(Math.abs(unit.x - 0.5) * 2.4), [apply]),
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
  /** Flat artwork laid on a panel whose outward normal is `n`, centred at `p`. */
  const panelAt = (n: Vec3, p: Vec3) => {
    const across = camera.project(n.z, 0, -n.x)
    const centre = at(p)
    return `matrix(${px(across.x)} ${px(across.y)} 0 ${px(camera.lift)} ${px(centre.x)} ${px(centre.y)})`
  }

  const hinge = { origin: { x: 0, y: HINGE_Y, z: 0 }, axis: { x: 0, y: 0, z: 1 } }
  const surfaceOptions = { rings: RINGS, meridians: MERIDIANS }
  /** One half, cut and tilted: starboard leans to +x, port to −x. */
  const halves = (["right", "left"] as const).map((side) => {
    const sense = side === "right" ? 1 : -1
    // The rod runs fore and aft, so a positive turn drops the port side: the
    // starboard half leans out on a negative one.
    const swing = -sense * angle
    const skin = hingeRotate(halfShell(avocadoProfile, side, surfaceOptions).map(world), hinge, swing)
    // The cut is the section polygon of the *inner* surface, drawn in order up
    // the face meridian and back down the spine, so the shell keeps a rim.
    const section = Array.from({ length: RINGS + 1 }, (_, index) => index / RINGS)
    const face = section.map((t) => world(profilePoint(avocadoInnerProfile, t, 0)))
    const spine = section.map((t) => world(profilePoint(avocadoInnerProfile, t, 180))).reverse()
    const cut = hingeRotate([...face, ...spine], hinge, swing)
    // Which way the cut looks, from the half's own inward normal.
    const [normal] = hingeRotate(
      [{ x: -sense, y: 0, z: 0 }],
      { origin: { x: 0, y: 0, z: 0 }, axis: hinge.axis },
      swing,
    )
    const belt = hingeRotate(
      latitudeRing(avocadoProfile, 0.3, surfaceOptions, 36)
        .map(world)
        .filter((point) => (side === "right" ? point.x >= -0.001 : point.x <= 0.001)),
      hinge,
      swing,
    )
    const lug = hingeRotate(latchLug(sense).map(world), hinge, swing)
    const socket = hingeRotate([{ x: 0, y: STONE_REST, z: 0 }], hinge, swing)[0]
    // The stem boss sits on the crown, so it leaves with whichever half owns
    // it — the starboard one — rather than hovering over the gap.
    const stem =
      side === "right"
        ? hingeRotate(
            [
              { x: 0, y: FLOOR + SHELL_HEIGHT - 1, z: 0 },
              { x: 0, y: FLOOR + SHELL_HEIGHT + 7, z: -2 },
            ],
            hinge,
            swing,
          )
        : null
    const centre = hingeRotate([world(profilePoint(avocadoProfile, 0.45, sense * 90))], hinge, swing)[0]
    return {
      side,
      swing,
      normal,
      socket,
      depth: towardCamera(centre),
      skin: hullPath(skin.map(at)),
      cut: polygonPath(cut.map(at)),
      belt: linePath(belt.map(at)),
      lug: hullPath(lug.map(at)),
      stem: stem ? capsulePath(at(stem[0]), at(stem[1]), 2.8) : null,
      cutFaces: spread > 0.04 && towardCamera(normal) > 0.05,
    }
  })
  halves.sort((a, b) => a.depth - b.depth)

  const stoneCentre: Vec3 = { x: 0, y: STONE_REST + STONE_LIFT * spread, z: 0 }
  const stoneScreen = at(stoneCentre)
  const columnFoot = at({ x: 0, y: FLOOR + 2, z: 0 })
  const opticNormal: Vec3 = {
    x: Math.sin((aim * Math.PI) / 180),
    y: 0,
    z: -Math.cos((aim * Math.PI) / 180),
  }
  const opticFaces = stone === "optic" && towardCamera(opticNormal) > 0.18
  const opticCentre: Vec3 = {
    x: opticNormal.x * STONE_RADIUS,
    y: stoneCentre.y,
    z: opticNormal.z * STONE_RADIUS,
  }

  const widest = widestSection(avocadoProfile)
  const pedestalRadius = NECK_RADIUS + 14
  const pedestal = extrudedPath(circleFootprint(0, 0, pedestalRadius, 18), camera, FLOOR, 0)
  const hingeRod = capsulePath(
    at({ x: 0, y: HINGE_Y, z: -HINGE_REACH }),
    at({ x: 0, y: HINGE_Y, z: HINGE_REACH }),
    3.2,
  )
  const knuckles = [-HINGE_REACH, HINGE_REACH].map((z) => at({ x: 0, y: HINGE_Y, z }))
  // Speckle sits on the skin, so it rides whichever half it belongs to.
  const speckles = goldenLattice(avocadoProfile, SPECKLES, { from: 0.14, to: 0.86 }).map((site) => {
    const side = Math.sin((site.azimuth * Math.PI) / 180) >= 0 ? 1 : -1
    const point = hingeRotate([world(site.position)], hinge, -side * angle)[0]
    const normal = hingeRotate(
      [world(site.normal)],
      { origin: { x: 0, y: 0, z: 0 }, axis: hinge.axis },
      -side * angle,
    )[0]
    return { index: site.index, point: at(point), facing: towardCamera(normal) > 0.05 }
  })

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot avocado, ${percent} percent open, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(spread + delta)
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
            d={`M 14 ${ORIGIN.y} H 186 M ${ORIGIN.x} 16 V ${ORIGIN.y + 12}`}
            strokeDasharray="2 3"
          />
          <circle cx={px(at({ x: 0, y: HINGE_Y, z: 0 }).x)} cy={px(at({ x: 0, y: HINGE_Y, z: 0 }).y)} r={4} />
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
            rx={px(widest.radius * 1.1)}
            ry={px(Math.max(2.4, widest.radius * 1.1 * camera.flatten))}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-pedestal transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
          <path d={pedestal} {...machined} />
        </g>
        <g transform={`translate(${ORIGIN.x} ${ORIGIN.y}) ${camera.plane(FLOOR)}`} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.6}>
          <circle r={px(pedestalRadius)} />
        </g>
        <g data-hinge>
          <path d={hingeRod} {...cast} />
          {knuckles.map((knuckle, index) => (
            <circle key={index} cx={px(knuckle.x)} cy={px(knuckle.y)} r={4.2} {...machined} />
          ))}
        </g>

        {/* The column and the stone are painted behind both halves: shut, the
            reassembled shell covers them exactly, and what shows as it opens
            is only what the gap actually exposes. */}
        {stone !== "none" && (
          <>
            <path
              data-column
              d={capsulePath(columnFoot, stoneScreen, COLUMN_RADIUS)}
              {...machined}
            />
            {[0.3, 0.55, 0.8].map((step) => {
              const y = FLOOR + 2 + (stoneCentre.y - FLOOR - 2) * step
              const collar = at({ x: 0, y, z: 0 })
              return (
                <path
                  key={step}
                  d={`M ${px(collar.x - COLUMN_RADIUS)} ${px(collar.y)} H ${px(collar.x + COLUMN_RADIUS)}`}
                  stroke={palette.dark}
                  strokeWidth={0.8}
                  opacity={0.55}
                />
              )
            })}
            <circle
              data-stone
              cx={px(stoneScreen.x)}
              cy={px(stoneScreen.y)}
              r={STONE_RADIUS}
              {...cast}
            />
            <ellipse
              cx={px(stoneScreen.x)}
              cy={px(stoneScreen.y - STONE_RADIUS * 0.22)}
              rx={px(STONE_RADIUS * 0.86)}
              ry={px(STONE_RADIUS * 0.4)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={0.8}
              opacity={0.5}
            />
            {opticFaces && (
              <g data-optic transform={panelAt(opticNormal, opticCentre)}>
                <circle r={6.4} {...machined} />
                <circle r={4.4} {...cast} />
                <circle r={2.1} fill={palette.accent} opacity={0.92} />
                <circle cx={-1.8} cy={-1.8} r={1} fill={palette.metal} />
              </g>
            )}
          </>
        )}

        {halves.map((half) => (
          <g key={half.side}>
            <path data-half={half.side} d={half.skin} {...shell} />
            {half.cutFaces && (
              <>
                <path data-cut={half.side} d={half.cut} {...machined} />
                <g transform={panelAt(half.normal, half.socket)}>
                  <circle r={px(STONE_RADIUS * 0.94)} {...cast} />
                  <circle r={px(STONE_RADIUS * 0.6)} fill="none" stroke={palette.metal} strokeWidth={0.8} opacity={0.6} />
                </g>
              </>
            )}
            {!half.cutFaces && (
              <path d={half.belt} fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.22} />
            )}
            {half.stem && <path data-stem d={half.stem} {...cast} />}
            <path data-latch={half.side} d={half.lug} {...machined} />
          </g>
        ))}

        {speckles
          .filter((speck) => speck.facing)
          .map((speck) => (
            <circle
              key={speck.index}
              data-speckle={speck.index}
              cx={px(speck.point.x)}
              cy={px(speck.point.y)}
              r={1.1}
              fill={palette.dark}
              opacity={0.3}
            />
          ))}

        <circle
          data-lamp
          cx={px(at({ x: 0, y: FLOOR + 5, z: -pedestalRadius }).x)}
          cy={px(at({ x: 0, y: FLOOR + 5, z: -pedestalRadius }).y)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {variant === "blueprint" && (
        <text x={186} y={26} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.grid}>
          {px(angle)}°
        </text>
      )}
      {label && (
        <text x={ORIGIN.x} y={175} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** The latch lug on one half: a small tab at the front seam, in world units. */
function latchLug(sense: number): Vec3[] {
  const y = FLOOR + SHELL_HEIGHT * LATCH_T
  const z = -(avocadoProfile(LATCH_T).radius + 1.2)
  return [
    { x: sense * 0.6, y: y + 3.2, z },
    { x: sense * 5.6, y: y + 3.2, z },
    { x: sense * 5.6, y: y - 3.2, z },
    { x: sense * 0.6, y: y - 3.2, z },
  ]
}

/** How far open the shell is aiming to be at `clock`, 0..1. */
export function avocadoGoal(behavior: AvocadoBehavior, clock: number): number {
  if (behavior === "static") return 0
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Open, hold it wide while the stone is up, then shut.
    case "present":
      if (t < 0.3) return (t / 0.3) * 0.95
      if (t < 0.72) return 0.95
      return 0.95 * (1 - (t - 0.72) / 0.28)
    // Never more than a crack, breathing.
    case "ajar":
      return 0.18 + 0.13 * Math.sin(t * Math.PI * 2)
    // Held half open while the optic works the room.
    case "scan":
      return 0.46 + 0.05 * Math.sin(t * Math.PI * 2)
    default:
      return 0
  }
}

/** Where the stone's optic is aimed at `clock`, in degrees off the face. */
export function avocadoBearing(behavior: AvocadoBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "scan":
      return 62 * Math.sin(t * Math.PI * 2)
    case "ajar":
      return 10 * Math.sin(t * Math.PI * 2)
    default:
      return 0
  }
}

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** A planar polygon, in the order it was built: a cut face, a flat panel. */
function polygonPath(points: readonly Vec2[]): string {
  if (points.length < 3) return ""
  return `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a seam, a belt, a furrow. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { RobotAvocado }
