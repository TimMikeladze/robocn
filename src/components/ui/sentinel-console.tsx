"use client"

/**
 * sentinel-console — a bulkhead-mounted watch station.
 *
 * Every other machine in the set stands on something. This one is part of the
 * ship: a housing set into a wall, carrying an identity strip, a gimballed
 * optic behind an iris diaphragm, and a voice grille. That is the whole robot.
 *
 * Two mechanisms carry it. The iris is *solved* — each blade pivots about a pin
 * on a fixed ring and carries a circular working edge, and the bore is the law
 * of cosines run backwards from the opening you asked for. The optic is a real
 * body in space that yaws and pitches about a pivot behind its own face, so
 * turning it foreshortens the bezel and slides the glass across it rather than
 * sliding a dot inside a static circle.
 *
 * Design note: docs/sentinel-console.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  clamp,
  convexHull2,
  toDegrees,
  toRadians,
  type Vec2,
} from "@/lib/robocn/kinematics"
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

const VIEW_WIDTH = 130
const VIEW_HEIGHT = 250
/** The optical axis where it meets the bulkhead, in view units. */
const ORIGIN = { x: 65, y: 126 }
/** The console is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

/* Panel coordinates, all in world units about the optical axis:
   `x` across the face, `y` *down* it, `z` out of the wall toward the room.
   The lens sits above the middle of the face, which is the one ratio that
   makes a panel read as something watching you. */
const FACE_HALF = 33
const FACE_TOP = -104
const FACE_BOTTOM = 86
const FACE_Z = 2

const HOUSING_HALF = 38
const HOUSING_TOP = -110
const HOUSING_BOTTOM = 92
const HOUSING_FRONT = 6
const HOUSING_BACK = -10

const BULKHEAD_HALF = 56
const BULKHEAD_TOP = -118
const BULKHEAD_BOTTOM = 102
const BULKHEAD_BACK = -16

const PLATE_HALF = 24
const PLATE_TOP = -96
const PLATE_BOTTOM = -85
const PLATE_FRONT = 4.4

const GRILLE_HALF = 25
const GRILLE_TOP = 44
const GRILLE_BOTTOM = 78
const GRILLE_COLS = 7
const GRILLE_ROWS = 4
const SPEAKER_BACK = -6

/** The optic. Distances along the cell axis are from the gimbal pivot. */
const BEZEL_OUTER = 23
const BEZEL_BORE = 17
const BEZEL_FRONT = 9
const BEZEL_BACK = 1
const IRIS_PLANE = 6.5
const GLASS_PLANE = 8.4
const GLASS_RADIUS = 16.5
const ELEMENT_PLANE = 3.8
const PUPIL_PLANE = 3.4
const PUPIL_RADIUS = 5.6
const PAN_LIMIT = 18
const TILT_LIMIT = 12

/** Aperture units per second while the iris eases back into its behaviour. */
const IRIS_RATE = 1.1
const RING_STEPS = 28
const BLADE_ARC_STEPS = 12
const BORE_ARC_STEPS = 8

/**
 * The diaphragm, in world units. A blade pivots about a pin at `pivot` from the
 * optical axis; fixed in the blade at `arm` from that pin is the centre of its
 * working edge, an arc of radius `edge`. `bore` is the hole in the bezel the
 * blades sweep across, and `min`/`max` are the stroke the aperture maps onto.
 */
export const IRIS_GEOMETRY = {
  pivot: 19,
  arm: 14,
  edge: 15,
  bore: BEZEL_BORE,
  min: 2.5,
  max: 16,
} as const

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back to keep the console inside one frame. */
const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 0.92, iso: 0.9 }

export type SentinelBehavior = "watch" | "listen" | "speak" | "alert" | "static"

export interface SentinelPose {
  /** Degrees the optic is turned across the face; positive is drawn right. */
  pan: number
  /** Degrees the optic is raised; positive is up. */
  tilt: number
  aperture: number
  voice: number
}

export interface IrisState {
  /** The clamped aperture the rest of these came from. */
  aperture: number
  /** Radius of the opening the blade edges are tangent to, in world units. */
  radius: number
  /** Degrees each blade is swung about its pin to make that opening. */
  swing: number
}

export interface SentinelConsoleProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One console, four projections. */
  view?: RobotView
  /** Controlled opening, 0 (a pinhole) to 1 (wide). Supplying it stops the loop. */
  aperture?: number
  /** What the console does when `aperture` is not supplied. */
  behavior?: SentinelBehavior
  /** Cycles per second: one sweep of the room, one burst of speech. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the lens to work the iris, or arrow-key it. */
  interactive?: boolean
  onApertureChange?: (aperture: number) => void
  /** Controlled optic aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** The optic follows the page pointer while `look` is null. */
  track?: boolean
  /** Lit cells in the voice grille, 0..1. Omit and the behavior works it. */
  voice?: number
  /** Leaves in the diaphragm, clamped to 4..10. */
  blades?: number
  /** The identity strip across the top of the console. */
  plate?: string
  signal?: "idle" | "ready" | "warning"
  /** Draw the bulkhead plate the console is set into. */
  showBulkhead?: boolean
  label?: string
}

function SentinelConsole({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  aperture,
  behavior = "watch",
  speed = 0.22,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onApertureChange,
  look = null,
  track = true,
  voice,
  blades = 8,
  plate = "SENTINEL",
  signal = "ready",
  showBulkhead = true,
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
}: SentinelConsoleProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = aperture !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? irisOpening(aperture).aperture : held
  const goal = React.useCallback(
    (clock: number) => sentinelPose(behavior, clock).aperture,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: IRIS_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const iris = irisOpening(motion.value)
  const scripted = sentinelPose(behavior, motion.clock)
  const percent = Math.round(iris.aperture * 100)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(Number.isFinite(next) ? next : 0.5, 0, 1))
      setHeld(bounded)
      onApertureChange?.(bounded)
    },
    [onApertureChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // The console is a narrow thing in a wide box: the drag is the width of the
    // face, so the whole stroke is reachable without leaving the machine.
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.22) / 0.56), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp((unit.x - 0.5) * 2, -1, 1),
        y: clamp((unit.y - 0.5) * 2, -1, 1),
      }),
      [],
    ),
  })
  const aim = look ?? pointer.target
  const pan = aim
    ? clamp(finite(aim.x), -1, 1) * PAN_LIMIT
    : clamp(scripted.pan, -PAN_LIMIT, PAN_LIMIT)
  const tilt = aim
    ? -clamp(finite(aim.y), -1, 1) * TILT_LIMIT
    : clamp(scripted.tilt, -TILT_LIMIT, TILT_LIMIT)
  const talk = finiteClamp(voice ?? scripted.voice, 0, 1, 0)
  const leaves = Math.round(finiteClamp(blades, 4, 10, 8))

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  /** A point on the console: `x` across the face, `y` down it, `z` out of it. */
  const at = (x: number, y: number, z = 0): Vec2 => {
    const point = camera.project(-x, -y, -z)
    return { x: ORIGIN.x + point.x, y: ORIGIN.y + point.y }
  }
  const towardCamera = (x: number, y: number, z: number) => camera.depth(-x, -y, -z)
  /** True while there is a face to see: the front elevation and the isometric. */
  const faceVisible = towardCamera(0, 0, 1) > 0.02

  /**
   * The affine map from flat artwork on a plane `z` out of the bulkhead onto
   * the screen. Panel coordinates are the artwork's own — x across, y down —
   * so a strip of text or a grid of grille cells is drawn once and comes out
   * skewed correctly from every camera that can see it.
   */
  const facePlane = (z: number) => {
    const base = at(0, 0, z)
    const ex = at(1, 0, z)
    const ey = at(0, 1, z)
    return `matrix(${px(ex.x - base.x)} ${px(ex.y - base.y)} ${px(ey.x - base.x)} ${px(ey.y - base.y)} ${px(base.x)} ${px(base.y)})`
  }

  /** A solid: a flat cross-section pushed through the wall, hulled. */
  const slab = (outline: readonly Vec2[], front: number, back: number) =>
    hullPath(outline.flatMap((p) => [at(p.x, p.y, front), at(p.x, p.y, back)]))

  /* ----------------------------------------------------------- the optic */

  // The cell frame: `axis` out of the lens, `across` horizontal in the cell,
  // `up` completing it. `across` does not depend on the tilt, which is what
  // makes the trunnions the tilt axis rather than ornament.
  const yaw = toRadians(pan)
  const pitch = toRadians(tilt)
  const axis = {
    x: Math.cos(pitch) * Math.sin(yaw),
    y: -Math.sin(pitch),
    z: Math.cos(pitch) * Math.cos(yaw),
  }
  const across = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
  const up = {
    x: Math.sin(pitch) * Math.sin(yaw),
    y: -Math.cos(pitch),
    z: Math.sin(pitch) * Math.cos(yaw),
  }
  /** A point in the cell: `a` across it, `b` down it, `d` along its axis. */
  const cellAt = (a: number, b: number, d: number) =>
    at(
      across.x * a + up.x * b + axis.x * d,
      across.y * a + up.y * b + axis.y * d,
      FACE_Z + across.z * a + up.z * b + axis.z * d,
    )
  /** A disc in the cell's own plane, sampled ready to hull. */
  const ring = (radius: number, d: number, a = 0, b = 0) =>
    Array.from({ length: RING_STEPS }, (_, step) => {
      const angle = (step / RING_STEPS) * Math.PI * 2
      return cellAt(a + Math.cos(angle) * radius, b + Math.sin(angle) * radius, d)
    })
  /** The same affine map as `facePlane`, for artwork living in the cell. */
  const cellPlane = (d: number) => {
    const base = cellAt(0, 0, d)
    const ea = cellAt(1, 0, d)
    const eb = cellAt(0, 1, d)
    return `matrix(${px(ea.x - base.x)} ${px(ea.y - base.y)} ${px(eb.x - base.x)} ${px(eb.y - base.y)} ${px(base.x)} ${px(base.y)})`
  }

  const trunnions = ([-1, 1] as const).map((side) => {
    const reach = BEZEL_OUTER + 3
    const pin = at(across.x * side * reach, 0, FACE_Z + across.z * side * reach)
    const root = at(side * (BEZEL_OUTER + 9), 0, FACE_Z)
    return { side, name: side === -1 ? "left" : "right", pin, root }
  })

  /* --------------------------------------------------------------- paint */

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plated = robotSurface("metal", variant, palette, 0.8)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const cells = faceVisible
    ? Array.from({ length: GRILLE_COLS * GRILLE_ROWS }, (_, index) => {
        const col = index % GRILLE_COLS
        const row = Math.floor(index / GRILLE_COLS)
        const acrossT = Math.abs(col - (GRILLE_COLS - 1) / 2) / ((GRILLE_COLS - 1) / 2)
        const downT = Math.abs(row - (GRILLE_ROWS - 1) / 2) / ((GRILLE_ROWS - 1) / 2)
        return {
          index,
          x: px(-GRILLE_HALF + 5 + (col * (GRILLE_HALF * 2 - 10)) / (GRILLE_COLS - 1)),
          y: px(GRILLE_TOP + 6 + (row * (GRILLE_BOTTOM - GRILLE_TOP - 12)) / (GRILLE_ROWS - 1)),
          // Cells light out from the middle, so quiet speech is a flicker in it.
          lit: acrossT < talk && downT < talk,
        }
      })
    : []

  const state = dragging
    ? "worked by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "alert"
        ? "on alert"
        : behavior === "speak"
          ? "speaking"
          : behavior === "listen"
            ? "listening"
            : "watching"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Sentinel console, ${state}, aperture ${percent} percent, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} percent aperture` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(iris.aperture + delta)
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
          <path d={`M ${ORIGIN.x} 14 V 236 M 10 ${ORIGIN.y} H 120`} strokeDasharray="2 3" />
          <circle cx={ORIGIN.x} cy={ORIGIN.y} r={px(iris.radius)} strokeDasharray="3 2" />
        </g>
      )}

      <g
        data-console
        data-view={view}
        transform={aboutPoint("", ORIGIN.x, ORIGIN.y, fits[view] ?? 1)}
      >
        {showBulkhead && (
          <path
            data-bulkhead
            d={slab(
              rectOutline(BULKHEAD_HALF, BULKHEAD_TOP, BULKHEAD_BOTTOM, 6),
              0,
              BULKHEAD_BACK,
            )}
            {...plated}
            fillOpacity={variant === "solid" ? 0.35 : plated.fillOpacity}
          />
        )}

        {/* The trunk into the back of the housing. Hidden behind the console
            straight on; from anywhere else it is where the wiring goes. */}
        <path
          data-conduit
          d={capsulePath(at(0, 40, HOUSING_BACK), at(0, 40, BULKHEAD_BACK - 6), 6)}
          {...cast}
        />

        <path
          data-housing
          d={slab(
            rectOutline(HOUSING_HALF, HOUSING_TOP, HOUSING_BOTTOM, 5),
            HOUSING_FRONT,
            HOUSING_BACK,
          )}
          {...shell}
        />
        <path
          data-speaker
          d={slab(rectOutline(GRILLE_HALF, GRILLE_TOP, GRILLE_BOTTOM, 3), FACE_Z, SPEAKER_BACK)}
          {...cast}
        />
        <path
          data-face
          d={slab(rectOutline(FACE_HALF, FACE_TOP, FACE_BOTTOM, 4), FACE_Z, FACE_Z - 1)}
          {...cast}
        />
        <path
          data-plate
          d={slab(rectOutline(PLATE_HALF, PLATE_TOP, PLATE_BOTTOM, 2), PLATE_FRONT, FACE_Z)}
          {...machined}
        />

        {faceVisible && (
          <g data-facing transform={facePlane(PLATE_FRONT + 0.1)}>
            <rect
              x={px(-PLATE_HALF + 2.5)}
              y={px(PLATE_TOP + 2)}
              width={px(PLATE_HALF * 2 - 5)}
              height={px(PLATE_BOTTOM - PLATE_TOP - 4)}
              rx={1.2}
              fill={palette.accent}
              fillOpacity={0.24}
              stroke={palette.dark}
              strokeWidth={0.5}
            />
            <text
              x={px(-2.5)}
              y={px((PLATE_TOP + PLATE_BOTTOM) / 2 + 2.4)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={5.4}
              letterSpacing={0.5}
              fill={palette.foreground}
            >
              {plate}
            </text>
            <circle
              data-lamp
              cx={px(PLATE_HALF - 5)}
              cy={px((PLATE_TOP + PLATE_BOTTOM) / 2)}
              r={1.8}
              fill={signalColor}
              className={signal === "ready" ? "robocn-pulse" : undefined}
            />
          </g>
        )}

        {faceVisible && (
          <g data-grille transform={facePlane(FACE_Z + 0.1)}>
            {cells.map((cell) => (
              <circle
                key={cell.index}
                data-bar={cell.index}
                data-lit={cell.lit}
                cx={cell.x}
                cy={cell.y}
                r={1.5}
                fill={cell.lit ? palette.accent : palette.metal}
                opacity={cell.lit ? 0.95 : 0.55}
              />
            ))}
          </g>
        )}

        {/* The gimbal: a yoke across the face, a pin each side, and the cell
            swinging between them. */}
        {trunnions.map((trunnion) => (
          <g key={trunnion.name} data-trunnion={trunnion.name}>
            <path d={capsulePath(trunnion.root, trunnion.pin, 2.6)} {...machined} />
            <circle cx={px(trunnion.pin.x)} cy={px(trunnion.pin.y)} r={3} fill={palette.dark} />
          </g>
        ))}

        <path data-barrel d={hullPath([...ring(BEZEL_OUTER, BEZEL_BACK), ...ring(BEZEL_OUTER, BEZEL_FRONT)])} {...machined} />
        <path data-tube d={hullPath(ring(BEZEL_BORE, IRIS_PLANE))} {...cast} />

        {/* The lit element fills the whole bore; the blades are what cut it
            down, so the opening you see is the diaphragm's own shape. */}
        <path
          data-element
          d={hullPath(ring(BEZEL_BORE - 0.4, ELEMENT_PLANE))}
          fill={palette.accent}
          opacity={variant === "solid" ? 0.9 : 0.5}
        />
        <path
          data-pupil
          d={hullPath(ring(PUPIL_RADIUS, PUPIL_PLANE))}
          fill={palette.glow}
          opacity={0.95}
        />

        <g data-cell transform={cellPlane(IRIS_PLANE)}>
          {faceVisible && (
            <g data-iris>
              {Array.from({ length: leaves }, (_, index) => (
                <path
                  key={index}
                  data-blade={index}
                  d={polygonPath(irisBladePoints(iris, index, leaves))}
                  {...cast}
                  stroke={palette.metal}
                  strokeWidth={0.4}
                  strokeOpacity={0.45}
                  fillOpacity={variant === "blueprint" ? 0.3 : 0.96}
                />
              ))}
              {/* The bore the edges are tangent to: a dimension, not a part. */}
              <circle
                data-bore
                r={px(iris.radius)}
                fill="none"
                stroke={variant === "blueprint" ? palette.grid : "none"}
                strokeWidth={0.5}
                strokeDasharray="3 2"
              />
            </g>
          )}
        </g>

        <path
          data-bezel
          d={hullPath(ring((BEZEL_OUTER + BEZEL_BORE) / 2, BEZEL_FRONT))}
          fill="none"
          stroke={palette.metal}
          strokeWidth={px(BEZEL_OUTER - BEZEL_BORE)}
          opacity={variant === "solid" ? 1 : 0.8}
        />

        <path
          data-glass
          d={hullPath(ring(GLASS_RADIUS, GLASS_PLANE))}
          fill={palette.glow}
          fillOpacity={variant === "solid" ? 0.14 : 0.06}
          stroke={palette.metal}
          strokeWidth={0.5}
          opacity={0.85}
        />
        {/* The specular off the front element. It rides the glass, so it is a
            disc on the cell's own plane rather than a shape stuck to the page. */}
        <path
          data-highlight
          d={hullPath(ring(3.4, GLASS_PLANE + 0.2, -6.5, -6.5))}
          fill={palette.metal}
          opacity={0.45}
        />
      </g>

      {label && (
        <text
          x={ORIGIN.x}
          y={244}
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

/**
 * The diaphragm at a given opening. Each blade's working edge is an arc of
 * radius `edge` whose centre sits `arm` from the blade's pin and `pivot` from
 * the axis, so that centre's distance from the axis is the law of cosines in
 * the blade swing — and the bore is that distance less the edge radius. This
 * runs it backwards: the opening is what the caller has, the swing is what the
 * drawing needs.
 */
export function irisOpening(aperture: number): IrisState {
  const { pivot, arm, edge, min, max } = IRIS_GEOMETRY
  const a = Number.isFinite(aperture) ? clamp(aperture, 0, 1) : 0.5
  const radius = min + (max - min) * a
  const cosine = clamp(
    ((radius + edge) ** 2 - pivot ** 2 - arm ** 2) / (2 * pivot * arm),
    -1,
    1,
  )
  return { aperture: a, radius, swing: toDegrees(Math.acos(cosine)) }
}

/**
 * One blade, as a polygon in the plane of the diaphragm: the lens of overlap
 * between the bezel bore and the blade's own edge circle. The material runs
 * from that edge out to the rim, so the opening is what the edges leave
 * behind. Blades overlap, because real ones do — what you see of each is its
 * leading arc and the rest is under its neighbour.
 */
export function irisBladePoints(iris: IrisState, index: number, count: number): Vec2[] {
  const { pivot, arm, edge, bore } = IRIS_GEOMETRY
  const leaves = Math.round(clamp(Number.isFinite(count) ? count : 8, 4, 10))
  const pin = toRadians((index / leaves) * 360)
  const swung = pin + toRadians(iris.swing)
  // The centre of this blade's edge, and the two places that edge crosses the
  // bore. Both circles always meet across the stroke the geometry allows.
  const centre = {
    x: pivot * Math.cos(pin) + arm * Math.cos(swung),
    y: pivot * Math.sin(pin) + arm * Math.sin(swung),
  }
  const span = Math.hypot(centre.x, centre.y) || 1e-6
  const unit = { x: centre.x / span, y: centre.y / span }
  const along = (span ** 2 - edge ** 2 + bore ** 2) / (2 * span)
  const off = Math.sqrt(Math.max(0, bore ** 2 - along ** 2))
  const foot = { x: unit.x * along, y: unit.y * along }
  const side = { x: -unit.y * off, y: unit.x * off }
  const a = { x: foot.x + side.x, y: foot.y + side.y }
  const b = { x: foot.x - side.x, y: foot.y - side.y }

  const points: Vec2[] = []
  // The edge arc, taking the way round that passes the near point — the point
  // of the blade closest to the axis, which is what bounds the opening.
  const near = Math.atan2(-unit.y, -unit.x)
  const fromEdge = Math.atan2(a.y - centre.y, a.x - centre.x)
  const edgeSweep = sweepBetween(fromEdge, Math.atan2(b.y - centre.y, b.x - centre.x), near)
  for (let step = 0; step <= BLADE_ARC_STEPS; step++) {
    const angle = fromEdge + (edgeSweep * step) / BLADE_ARC_STEPS
    points.push({ x: centre.x + Math.cos(angle) * edge, y: centre.y + Math.sin(angle) * edge })
  }
  // Back round the bore, on the far side — the material is between the edge
  // and the rim, which is why the opening is what the edges leave behind.
  const far = Math.atan2(unit.y, unit.x)
  const fromBore = Math.atan2(b.y, b.x)
  const boreSweep = sweepBetween(fromBore, Math.atan2(a.y, a.x), far)
  for (let step = 1; step < BORE_ARC_STEPS; step++) {
    const angle = fromBore + (boreSweep * step) / BORE_ARC_STEPS
    points.push({ x: Math.cos(angle) * bore, y: Math.sin(angle) * bore })
  }
  return points
}

/** What the console is doing at `clock`, when nothing is driving it. */
export function sentinelPose(behavior: SentinelBehavior, clock: number): SentinelPose {
  if (behavior === "static") return { pan: 0, tilt: 0, aperture: 0.55, voice: 0 }
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  const turn = t * Math.PI * 2
  switch (behavior) {
    // Wide open and all but still: the optic is taking the room in.
    case "listen":
      return {
        pan: Math.sin(turn * 1.7) * 2.4,
        tilt: Math.sin(turn * 1.1 + 1) * 1.6,
        aperture: 0.86 + 0.04 * Math.sin(turn * 3),
        voice: 0,
      }
    // Held on whoever is being spoken to, with the grille doing the work.
    case "speak":
      return {
        pan: Math.sin(turn * 2.3) * 3.2,
        tilt: Math.sin(turn * 1.9) * 1.4,
        aperture: 0.5,
        voice: syllable(t),
      }
    // Stopped down hard, snapping between two bearings, clipped bursts.
    case "alert":
      return {
        pan: (t % 0.5 < 0.25 ? -1 : 1) * 15,
        tilt: -3,
        aperture: 0.1 + 0.09 * (0.5 + 0.5 * Math.sin(turn * 6)),
        voice: t % 0.25 < 0.09 ? 0.8 : 0,
      }
    // Holds a bearing, swings to the next, holds again.
    default: {
      const stations = [-13, 5, 15, -4]
      const slot = t * stations.length
      const index = Math.floor(slot)
      const into = slot - index
      const from = stations[index % stations.length]
      const to = stations[(index + 1) % stations.length]
      // Three quarters dwell, one quarter to swing across.
      const swing = into < 0.75 ? 0 : ease((into - 0.75) / 0.25)
      return {
        pan: from + (to - from) * swing,
        tilt: Math.sin(turn * 2) * 2.2,
        aperture: 0.55 + 0.07 * Math.sin(turn * 2),
        voice: 0,
      }
    }
  }
}

/** A burst of speech: three runs of syllables with gaps between them. */
function syllable(t: number) {
  const gate = t < 0.32 || (t > 0.42 && t < 0.68) || (t > 0.78 && t < 0.94)
  if (!gate) return 0
  return clamp(0.35 + 0.6 * Math.abs(Math.sin(t * Math.PI * 26)), 0, 1)
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/**
 * The signed angular distance from `from` to `to` that passes `through`, so an
 * arc can be sampled the way round that keeps the shape it belongs to.
 */
function sweepBetween(from: number, to: number, through: number) {
  const full = Math.PI * 2
  const wrap = (angle: number) => ((angle % full) + full) % full
  const forward = wrap(to - from)
  return wrap(through - from) <= forward ? forward : forward - full
}

/** A rounded rectangle in panel coordinates, sampled for hulling. */
function rectOutline(halfWidth: number, top: number, bottom: number, radius: number): Vec2[] {
  const r = Math.max(0, Math.min(radius, halfWidth, (bottom - top) / 2))
  const corners: Vec2[] = [
    { x: halfWidth - r, y: top + r },
    { x: halfWidth - r, y: bottom - r },
    { x: -(halfWidth - r), y: bottom - r },
    { x: -(halfWidth - r), y: top + r },
  ]
  if (r === 0) return corners
  return corners.flatMap((corner, index) =>
    Array.from({ length: 4 }, (_, step) => {
      const angle = toRadians(index * 90 - 90 + (step * 90) / 3)
      return { x: corner.x + Math.cos(angle) * r, y: corner.y + Math.sin(angle) * r }
    }),
  )
}

const polygonPath = (points: readonly Vec2[]) =>
  points.length < 3
    ? ""
    : `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`

const hullPath = (points: readonly Vec2[]) => polygonPath(convexHull2(points))

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

const round3 = (value: number) => Number(value.toFixed(3))

export { SentinelConsole }
