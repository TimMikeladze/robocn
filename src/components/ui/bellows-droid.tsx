"use client"

/**
 * bellows-droid — a soft-shell pneumatic pod.
 *
 * Every other machine in the set is a rigid body with joints hung off it. This
 * one has no joints: the shell *is* the mechanism. A pleated dome inflates and
 * settles, and where the optics sit, how far apart they are, how wide the vent
 * opens and how hard the crown is gathered all follow from that one number.
 *
 * The shell is volume-conserving — filling it makes it taller and narrower —
 * and it is a surface of revolution modelled once in world units, so all four
 * cameras come out of the same geometry. Design note: docs/soft-shell-pod.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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
const VIEW_HEIGHT = 180
/** The centre of the base disc, on the ground, in view units. */
const ORIGIN = { x: 95, y: 142 }
/** The pod is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

/** Stroke of the bellows, in world units of shell height. */
const HEIGHT_FLAT = 58
const HEIGHT_FULL = 92
/** The one (radius, height) pair the volume is taken from. */
const REFERENCE_HEIGHT = 75
const REFERENCE_RADIUS = 60
/** Crown radius as a fraction of body radius, before the gather. */
const CROWN_RATIO = 0.16
/** The machined collar the shell is clamped to. */
const COLLAR_TOP = 11
const COLLAR_RATIO = 0.66
/** The shell skirt meets the collar here rather than at the ground. */
const SHELL_FLOOR = 9
/** Where the lens pods are set into the shell, as a fraction of its height. */
const OPTIC_HEIGHT = 0.52
/** How far apart, as an angle off the centre line of the shell at that height. */
const OPTIC_SPREAD = 27
const OPTIC_STANDOFF = 5
const LENS_RADIUS = 9
/** The pleats gather above the face; below this the shell is a plain panel. */
const PLEAT_FLOOR = 0.26
/** Inflation units per second while the shell is returning to its behaviour. */
const FILL_RATE = 1.1
/** Samples along the profile, and around it, for the silhouette hull. */
const RINGS = 9
const MERIDIANS = 24
const PLEAT_STEPS = 8

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back, and rides up, to keep the pod in one frame. */
const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 0.78, rise: -50 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.95, rise: -6 },
}

export type BellowsBehavior = "breathe" | "settle" | "startle" | "static"
export type BellowsOptics = "pair" | "single" | "none"
export type BellowsAperture = "grille" | "iris" | "none"

export interface BellowsProfile {
  /** The clamped inflation the rest of these came from. */
  inflation: number
  height: number
  radius: number
  crown: number
  /** Degrees the pleats sweep between the skirt and the crown. */
  twist: number
}

export interface BellowsDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One pod, four projections. */
  view?: RobotView
  /** Controlled fill, 0 (flat and wide) to 1 (full and tall). Stops the loop. */
  inflation?: number
  /** What the bellows does when `inflation` is not supplied. */
  behavior?: BellowsBehavior
  /** Cycles per second: one breath, one fill-and-dump. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the crown up and down, or arrow-key it. */
  interactive?: boolean
  onInflationChange?: (inflation: number) => void
  /** Seams gathered into the crown, clamped to 4..12. */
  pleats?: number
  optics?: BellowsOptics
  aperture?: BellowsAperture
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function BellowsDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  inflation,
  behavior = "breathe",
  speed = 0.28,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onInflationChange,
  pleats = 7,
  optics = "pair",
  aperture = "grille",
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
}: BellowsDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = inflation !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? bellowsProfile(inflation).inflation : held
  const goal = React.useCallback((clock: number) => bellowsGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: FILL_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const shellShape = bellowsProfile(motion.value)
  const { height, radius, crown, twist } = shellShape
  const fill = shellShape.inflation
  const percent = Math.round(fill * 100)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0.5, 0, 1)
      setHeld(bounded)
      onInflationChange?.(bounded)
    },
    [onInflationChange],
  )

  const camera = robotCamera(view)
  // Straight down the crown does not rise at all, so a drag still has to mean
  // something: floor the travel it is measured over rather than dividing by it.
  const travel = Math.max(14, (HEIGHT_FULL - HEIGHT_FLAT) * camera.lift)
  const flatCrown = ORIGIN.y - HEIGHT_FLAT * camera.lift
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((flatCrown - unit.y * VIEW_HEIGHT) / travel),
      [apply, flatCrown, travel],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const live = robotSurface("accent", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const seams = pleatCount(pleats)

  /**
   * A point on the machine. `x` is starboard, `y` up, `z` out through the face,
   * and the negation is what puts `+x` on the right of the front elevation, so
   * a panel's own drawing coordinates and the projected ones agree.
   */
  const at = (x: number, y: number, z = 0): Vec2 => {
    const point = camera.project(-x, y, -z)
    return { x: ORIGIN.x + point.x, y: ORIGIN.y + point.y }
  }
  const towardCamera = (x: number, y: number, z: number) => camera.depth(-x, y, -z)
  /** Radius and height of the shell at `t`, from the skirt to the crown. */
  const section = (t: number) => ({
    radius: crown + (radius - crown) * sectionRadius(t),
    height: SHELL_FLOOR + (height - SHELL_FLOOR) * sectionHeight(t),
  })
  /** The shell radius at a given height, for anything mounted on the surface. */
  const radiusAt = (y: number) =>
    section(Math.pow(clamp((y - SHELL_FLOOR) / Math.max(1, height - SHELL_FLOOR), 0, 1), 1 / 0.92)).radius
  /**
   * Flat artwork laid onto a vertical panel facing `azimuth`, standing
   * `standoff` from the axis and `lateral` across it. Local `x` runs across the
   * panel, `y` down it.
   */
  const panel = (azimuth: number, standoff: number, y: number, lateral = 0) => {
    const a = toRadians(azimuth)
    const centre = at(
      Math.sin(a) * standoff + Math.cos(a) * lateral,
      y,
      Math.cos(a) * standoff - Math.sin(a) * lateral,
    )
    const across = camera.project(-Math.cos(a), 0, Math.sin(a))
    return `matrix(${px(across.x)} ${px(across.y)} 0 ${px(camera.lift)} ${px(centre.x)} ${px(centre.y)})`
  }
  const panelFaces = (azimuth: number) => {
    const a = toRadians(azimuth)
    return towardCamera(Math.sin(a), 0, Math.cos(a)) > 0.02
  }

  // The silhouette is the hull of the projected surface, which is exact for a
  // convex solid of revolution and the same one path in every view.
  const surface: Vec2[] = []
  for (let ring = 0; ring <= RINGS; ring++) {
    const cut = section(ring / RINGS)
    for (let step = 0; step < MERIDIANS; step++) {
      const a = (step / MERIDIANS) * Math.PI * 2
      surface.push(at(Math.sin(a) * cut.radius, cut.height, Math.cos(a) * cut.radius))
    }
  }
  const shellPath = hullPath(surface)
  const collarRadius = radius * COLLAR_RATIO
  const collarPath = extrudedPath(circleFootprint(0, 0, collarRadius, 18), camera, COLLAR_TOP, 0)

  const pleatSeams = Array.from({ length: seams }, (_, index) => {
    const base = (index / seams) * 360
    const points = Array.from({ length: PLEAT_STEPS }, (_, step) => {
      const t = PLEAT_FLOOR + (step / (PLEAT_STEPS - 1)) * (1 - PLEAT_FLOOR)
      const cut = section(t)
      const a = toRadians(base + twist * Math.pow(t, 1.4))
      return at(Math.sin(a) * cut.radius, cut.height, Math.cos(a) * cut.radius)
    })
    const mid = section(0.7)
    const a = toRadians(base + twist * Math.pow(0.7, 1.4))
    const facing =
      towardCamera(Math.sin(a) * mid.radius, mid.height, Math.cos(a) * mid.radius) >=
      towardCamera(0, mid.height, 0) - 0.001
    return { index, facing, d: points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ") }
  }).filter((seam) => seam.facing)

  const opticAngles = optics === "none" ? [] : optics === "single" ? [0] : [-OPTIC_SPREAD, OPTIC_SPREAD]
  const opticHeight = SHELL_FLOOR + (height - SHELL_FLOOR) * OPTIC_HEIGHT
  const opticRadius = radiusAt(opticHeight)
  // The pods are set *through* the shell and aim forward, not radially out of
  // it: two lenses on one boresight, which is what makes them read as a pair.
  const pods = opticAngles.map((angle) => {
    const a = toRadians(angle)
    const lateral = Math.sin(a) * opticRadius
    const surface = Math.cos(a) * opticRadius
    const reach = surface + OPTIC_STANDOFF
    return {
      angle,
      lateral,
      side: lateral > 0.5 ? "right" : lateral < -0.5 ? "left" : "centre",
      depth: towardCamera(lateral, opticHeight, reach),
      // Short: the pod is a bezel set through the shell, not a tube on a stalk.
      barrel: capsulePath(
        at(lateral, opticHeight, surface - 3),
        at(lateral, opticHeight, reach),
        LENS_RADIUS * 0.74,
      ),
      standoff: reach,
    }
  })
  const bodyDepth = towardCamera(0, opticHeight, 0)
  /** The pods share one boresight, so one test says whether any lens is on show. */
  const podsFace = panelFaces(0)
  const apertureHeight = SHELL_FLOOR + (height - SHELL_FLOOR) * 0.24
  const apertureRadius = radiusAt(apertureHeight)
  // The vent is what the bellows breathes through, so it opens with the shell.
  const apertureOpen = 3 + fill * 8

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Bellows droid, ${percent} percent inflated, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} percent inflated` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(fill + delta)
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
          <path d={`M 12 ${ORIGIN.y} H 178 M ${ORIGIN.x} 18 V ${ORIGIN.y + 14}`} strokeDasharray="2 3" />
          <path d={`M 168 ${ORIGIN.y} V ${px(ORIGIN.y - height * camera.lift)} M 164 ${px(ORIGIN.y - height * camera.lift)} H 172`} />
        </g>
      )}

      <g data-frame data-view={view} transform={aboutPoint(framing[view]?.rise ? `translate(0 ${framing[view].rise})` : "", ORIGIN.x, ORIGIN.y, framing[view]?.zoom ?? 1)}>
        {showGround && (
          <ellipse
            cx={ORIGIN.x}
            cy={ORIGIN.y}
            rx={px(radius * 1.04)}
            ry={px(Math.max(2.4, radius * 1.04 * camera.flatten))}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-collar transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
          <path d={collarPath} {...machined} />
        </g>
        <g transform={`translate(${ORIGIN.x} ${ORIGIN.y}) ${camera.plane(COLLAR_TOP)}`} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.65}>
          <circle r={px(collarRadius)} />
        </g>

        {/* Anything behind the shell paints before it. A pod whose lens is
            edge-on to the camera goes here whichever side of the axis it is:
            with no face to see, the barrel is a bezel *inside* the shell, and
            painting it over the silhouette would read as a hole in the dome. */}
        {pods.filter((pod) => !podsFace || pod.depth <= bodyDepth).map((pod) => (
          <path key={`far-${pod.angle}`} data-barrel={pod.side} d={pod.barrel} {...cast} />
        ))}

        <path data-shell d={shellPath} {...shell} />

        <g fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.4}>
          {pleatSeams.map((seam) => (
            <path key={seam.index} data-pleat={seam.index} d={seam.d} />
          ))}
        </g>

        <g data-crown transform={`translate(${ORIGIN.x} ${ORIGIN.y}) ${camera.plane(height)}`}>
          <circle r={px(crown)} {...machined} />
          <circle r={px(crown * 0.44)} {...cast} />
        </g>
        <circle
          data-lamp
          cx={px(at(0, height + 1.5).x)}
          cy={px(at(0, height + 1.5).y)}
          r={2.4}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />

        {podsFace && pods.filter((pod) => pod.depth > bodyDepth).map((pod) => (
          <path key={`near-${pod.angle}`} data-barrel={pod.side} d={pod.barrel} {...cast} />
        ))}

        {podsFace && pods.map((pod) => (
          <g key={`lens-${pod.angle}`} data-optic={pod.side} transform={panel(0, pod.standoff, opticHeight, pod.lateral)}>
            <circle r={LENS_RADIUS} {...machined} />
            <circle r={LENS_RADIUS * 0.72} {...cast} />
            <circle r={LENS_RADIUS * 0.34} fill={palette.accent} opacity={0.9} />
            <circle cx={-2.6} cy={-2.6} r={1.5} fill={palette.metal} />
          </g>
        ))}

        {aperture !== "none" && podsFace && (
          <g data-aperture={aperture} transform={panel(0, apertureRadius + 1, apertureHeight)}>
            <rect
              x={-13}
              y={px(-apertureOpen / 2)}
              width={26}
              height={px(apertureOpen)}
              rx={px(Math.min(4, apertureOpen / 2))}
              {...cast}
            />
            {aperture === "grille"
              ? [-6.5, 0, 6.5].map((x) => (
                  <path key={x} d={`M ${x} ${px(-apertureOpen / 2 + 1)} V ${px(apertureOpen / 2 - 1)}`} stroke={palette.metal} strokeWidth={0.9} />
                ))
              : <ellipse rx={px(9)} ry={px(apertureOpen * 0.32)} {...live} />}
            {[-22, 22].map((x) => (
              <g key={x} data-vent transform={`translate(${x} 0)`}>
                <rect x={-5} y={-4} width={10} height={8} rx={3} {...machined} />
                {[-1.6, 1.6].map((y) => (
                  <path key={y} d={`M -3 ${y} H 3`} stroke={palette.dark} strokeWidth={0.8} />
                ))}
              </g>
            ))}
          </g>
        )}
      </g>

      {variant === "blueprint" && (
        <text x={168} y={px(ORIGIN.y - height * camera.lift - 5)} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.grid}>
          {percent}%
        </text>
      )}
      {label && (
        <text x={ORIGIN.x} y={172} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/**
 * The shell at a given fill. Height and radius are tied so that
 * `radius² × height` — the volume of the solid of revolution, up to the fixed
 * shape factor of the profile — never changes: filling it makes it taller *and*
 * narrower. The crown gather and the pleat twist are shaped to read rather than
 * solved from a fold pattern.
 */
export function bellowsProfile(inflation: number): BellowsProfile {
  const fill = Number.isFinite(inflation) ? clamp(inflation, 0, 1) : 0.5
  const height = HEIGHT_FLAT + (HEIGHT_FULL - HEIGHT_FLAT) * fill
  const radius = REFERENCE_RADIUS * Math.sqrt(REFERENCE_HEIGHT / height)
  return {
    inflation: fill,
    height,
    radius,
    crown: radius * CROWN_RATIO * (1.35 - 0.5 * fill),
    twist: 22 + 26 * (1 - fill),
  }
}

/** How full the bellows is aiming to be at `clock`, 0..1. */
export function bellowsGoal(behavior: BellowsBehavior, clock: number): number {
  if (behavior === "static") return 0.5
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Fills over three quarters of the cycle and dumps over the last quarter.
    case "settle":
      return t < 0.72 ? 0.12 + (t / 0.72) * 0.8 : 0.92 - ((t - 0.72) / 0.28) * 0.8
    // Sits full, and twice a cycle loses most of it in a moment.
    case "startle":
      return 0.86 - 0.6 * Math.max(flinch(t, 0.18), flinch(t, 0.62))
    default:
      return 0.5 + 0.36 * Math.sin(t * Math.PI * 2)
  }
}

/** A short spike either side of `at`, on a cycle that wraps. */
function flinch(t: number, at: number) {
  const gap = Math.abs(t - at)
  return Math.max(0, 1 - Math.min(gap, 1 - gap) / 0.09)
}

/** The profile, dimensionless: 1 at the skirt, 0 at the crown. */
const sectionRadius = (t: number) => Math.pow(Math.max(0, 1 - Math.pow(t, 1.35)), 0.47)
const sectionHeight = (t: number) => Math.pow(t, 0.92)

const pleatCount = (pleats: number) =>
  Math.round(clamp(Number.isFinite(pleats) ? pleats : 7, 4, 12))

const hullPath = (points: Vec2[]) => {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

export { BellowsDroid }
