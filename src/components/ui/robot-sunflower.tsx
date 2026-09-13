"use client"

/**
 * robot-sunflower — a heliotropic collector mast.
 *
 * The machine is one idea carried all the way through: the light is a
 * *direction*, and everything on the machine is placed in the frame that
 * direction implies. `aimFrom` turns the light into an azimuth and an
 * elevation, `trackerFrame` turns that pair back into the head's own axes, and
 * the disc, the rays and the leaf wings are all written in those axes — so
 * they cannot disagree about where the sun is.
 *
 * Two things fall out rather than being drawn. The florets are placed by the
 * golden angle over equal area, and the spiral arms are then *found* in the
 * result: consecutive Fibonacci numbers of them, because the angle says so.
 * And the collar at the top of the stem is a remainder — the stem leans toward
 * the light on its own, and the collar takes up exactly what the stem did not,
 * so the head's normal never comes off the sun however far the stem bends.
 *
 * One geometry, four cameras. Design note: docs/heliotropic-collector.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  aimDirection,
  aimFrom,
  discDish,
  framePoint,
  frameDirection,
  parastichyOffsets,
  rayFlorets,
  spiralArm,
  trackerFrame,
  vogelDisc,
  type TrackerAim,
} from "@/lib/robocn/phyllotaxis"
import { solveSpine } from "@/lib/robocn/spine"
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
const VIEW_HEIGHT = 210
/** The centre of the anchor plate, on the ground, in view units. */
const ORIGIN = { x: 100, y: 188 }
/** It is drawn straight on, looking at the face of a head aimed at noon. */
const NATIVE_VIEW: RobotView = "front"

/** The mast, in world units. */
const STEM_LENGTH = 104
const STEM_SEGMENTS = 10
const STEM_RADIUS = 3.8
const ANCHOR_RADIUS = 20
const ANCHOR_HEIGHT = 6
/** How far the head sits above the last stem joint, along the tip tangent. */
const NECK = 8
/** The head. */
const HEAD_RADIUS = 33
const DISC_RADIUS = 28
const RAY_LENGTH = 19
const RAY_WIDTH = 8.6
const HUB_RADIUS = 6.5
/** How far the rim leads the centre of the dished face. */
const DISH = 5.5
/** Ray pitch at nothing open, and at fully open. */
const FURLED_PITCH = 72
const OPEN_PITCH = -8
/** Where the leaf wings are bracketed, as a fraction of the stem from the root. */
const LEAF_STATIONS = [0.36, 0.62] as const
const LEAF_SPAN = 30
const LEAF_CHORD = 21
/**
 * The stem's full heliotropic lean, in the spine solver's own −1..1 turn. Held
 * well short of the stop: past about a third the head leaves the frame, and a
 * mast that lies down is not what tracking the sun looks like.
 */
const MAX_LEAN = 0.17
/** Daylight travelled per second while it returns to its behaviour. */
const DAY_RATE = 0.42
/** Peak solar elevation at noon, in degrees. */
const NOON = 68

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the camera pulls back, and rides up, to hold one frame. */
const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 0.92, rise: -84 },
  front: { zoom: 1, rise: 0 },
  profile: { zoom: 1, rise: 0 },
  iso: { zoom: 0.9, rise: -10 },
}

export type SunflowerBehavior = "sweep" | "day" | "nod" | "static"

export interface RobotSunflowerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Controlled time of day, 0 and 1 midnight, 0.5 noon. Stops the loop. */
  daylight?: number
  /** Where the light actually is. Overrides the day arc entirely. */
  sun?: TrackerAim
  /** What the day does when `daylight` is not supplied. */
  behavior?: SunflowerBehavior
  /** Cycles per second: one pass of the arc. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across it to scrub the day, or arrow-key it. */
  interactive?: boolean
  onDaylightChange?: (daylight: number) => void
  /** Controlled gaze in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** Hand the light to the pointer while it is over the drawing. */
  track?: boolean
  /** Collector cells on the face. Clamped 12–320. */
  florets?: number
  /** Ray petals round the rim. Clamped 0–48. */
  rays?: number
  /** Spiral arms drawn over the lattice. Clamped 0–24; 0 leaves them off. */
  arms?: number
  /** How open the rays are, 0 furled to 1 wide. Omit and the light opens them. */
  bloom?: number
  /** How much of the aim the stem takes up itself, 0 rigid to 1 full lean. */
  lean?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function RobotSunflower({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  daylight,
  sun,
  behavior = "sweep",
  speed = 0.14,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onDaylightChange,
  look = null,
  track = true,
  florets = 120,
  rays = 21,
  arms = 8,
  bloom,
  lean = 1,
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
}: RobotSunflowerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = daylight !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(daylight) ? daylight : 0.5, 0, 1) : held
  const goal = React.useCallback(
    (clock: number) => sunflowerGoal(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: DAY_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(Number.isFinite(next) ? next : 0.5, 0, 1)
      setHeld(bounded)
      onDaylightChange?.(bounded)
    },
    [onDaylightChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look && !sun,
    toWorld: React.useCallback(
      (unit: Vec2) => ({ x: unit.x * 2 - 1, y: unit.y * 2 - 1 }),
      [],
    ),
  })

  const day = clamp(motion.value, 0, 1)
  // The light, in order of authority: an explicit aim, then the pointer, then
  // the day arc the behaviour is running.
  const gaze = look ?? (dragging ? null : pointer.target)
  const aim: TrackerAim = sun
    ? {
        azimuth: clamp(Number.isFinite(sun.azimuth) ? sun.azimuth : 0, -180, 180),
        elevation: clamp(Number.isFinite(sun.elevation) ? sun.elevation : 0, -90, 90),
      }
    : gaze
      ? {
          azimuth: clamp(Number.isFinite(gaze.x) ? gaze.x : 0, -1, 1) * 110,
          elevation: 34 - clamp(Number.isFinite(gaze.y) ? gaze.y : 0, -1, 1) * 46,
        }
      : sunflowerSun(day)

  const openness =
    bloom !== undefined
      ? clamp(Number.isFinite(bloom) ? bloom : 0, 0, 1)
      : sunflowerBloom(aim.elevation)
  const cells = Math.round(clamp(Number.isFinite(florets) ? florets : 120, 12, 320))
  const petals = Math.round(clamp(Number.isFinite(rays) ? rays : 21, 0, 48))
  const armCount = Math.round(clamp(Number.isFinite(arms) ? arms : 8, 0, 24))
  const bend = clamp(Number.isFinite(lean) ? lean : 1, 0, 1)

  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  /** One collector cell: machined, so the cells read against the dark disc. */
  const seed = robotSurface("metal", variant, palette, 0.45)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const towardCamera = (point: Vec3) => camera.depth(point.x, point.y, point.z)

  /* ---- the stem ------------------------------------------------------- */

  // The stem bends in the vertical plane that contains the light, so leaning
  // toward a sun off to one side is a real lean and not a drawing of one.
  const bearing = (aim.azimuth * Math.PI) / 180
  const sideways: Vec3 = { x: Math.sin(bearing), y: 0, z: -Math.cos(bearing) }
  // Low sun, hard lean: a head that has to look near the horizon gets there by
  // bending the mast before it asks the collar for the rest.
  const turn = bend * MAX_LEAN * Math.cos((clamp(aim.elevation, -90, 90) * Math.PI) / 180)
  const spine = solveSpine({
    segments: STEM_SEGMENTS,
    length: STEM_LENGTH,
    turn,
    amplitude: 0.05,
    waves: 0.7,
    taper: -0.5,
    phase: motion.clock * 0.35,
  })
  // Spine space has the nose at the origin running toward −x; the head is the
  // nose, so `x + length` stands the mast up with its root on the floor.
  const stemPoint = (joint: { position: Vec2 }): Vec3 => ({
    x: sideways.x * joint.position.y,
    y: joint.position.x + STEM_LENGTH,
    z: sideways.z * joint.position.y,
  })
  const stem = spine.joints.map(stemPoint)
  const tipAngle = (spine.head.angle * Math.PI) / 180
  const tangent: Vec3 = {
    x: sideways.x * Math.sin(tipAngle),
    y: Math.cos(tipAngle),
    z: sideways.z * Math.sin(tipAngle),
  }
  const crown = stem[0]
  const headCentre: Vec3 = {
    x: crown.x + tangent.x * NECK,
    y: crown.y + tangent.y * NECK,
    z: crown.z + tangent.z * NECK,
  }

  /* ---- the head ------------------------------------------------------- */

  const frame = trackerFrame(aim)
  const forward = frame.forward
  const faceVisible = towardCamera(forward) > 0
  // The collar is the remainder: what the stem did not take up, the gimbal did.
  const collar =
    (Math.acos(
      clamp(
        tangent.x * forward.x + tangent.y * forward.y + tangent.z * forward.z,
        -1,
        1,
      ),
    ) *
      180) /
    Math.PI

  const place = (local: Vec3) => framePoint(frame, headCentre, local)
  const sites = vogelDisc(cells, { radius: DISC_RADIUS, innerRadius: HUB_RADIUS * 0.7 })
  const dishOptions = { dish: DISH, extent: DISC_RADIUS }
  const cellRadius = Math.max(0.7, (DISC_RADIUS * 0.9) / Math.sqrt(cells))
  const lattice = sites.map((site) => {
    const surface = discDish(site, dishOptions)
    const world = place({ x: site.position.x, y: site.position.y, z: surface.offset })
    return {
      index: site.index,
      point: at(world),
      facing: towardCamera(frameDirection(frame, surface.normal)) > 0.02,
    }
  })

  const offsets = parastichyOffsets(sites)
  const armStep = offsets[0] ?? 0
  const spirals =
    armCount > 0 && armStep > 0
      ? Array.from({ length: Math.min(armCount, armStep) }, (_, index) => {
          const start = Math.round((index * armStep) / Math.min(armCount, armStep))
          return {
            index,
            path: linePath(
              spiralArm(sites, start, armStep).map((site) =>
                at(place({
                  x: site.position.x,
                  y: site.position.y,
                  z: discDish(site, dishOptions).offset,
                })),
              ),
            ),
          }
        })
      : []

  const petalPitch = FURLED_PITCH + (OPEN_PITCH - FURLED_PITCH) * openness
  const ring = rayFlorets(petals, {
    radius: HEAD_RADIUS - 2,
    length: RAY_LENGTH,
    width: RAY_WIDTH,
    taper: 0.34,
    pitch: petalPitch,
  }).map((ray) => {
    const corners = ray.corners.map(place)
    const mid = place({
      x: (ray.root.x + ray.tip.x) / 2,
      y: (ray.root.y + ray.tip.y) / 2,
      z: (ray.root.z + ray.tip.z) / 2,
    })
    return {
      index: ray.index,
      path: hullPath(corners.map(at)),
      spine: linePath([at(place(ray.root)), at(place(ray.tip))]),
      depth: towardCamera(mid),
    }
  })
  const headDepth = towardCamera(headCentre)
  const farRays = ring.filter((ray) => ray.depth <= headDepth)
  const nearRays = ring.filter((ray) => ray.depth > headDepth)

  const rim = hullPath(
    Array.from({ length: 40 }, (_, index) => {
      const angle = (index / 40) * Math.PI * 2
      return at(
        place({
          x: Math.cos(angle) * HEAD_RADIUS,
          y: Math.sin(angle) * HEAD_RADIUS,
          z: DISH,
        }),
      )
    }),
  )

  /* ---- the leaf wings -------------------------------------------------- */

  // The leaves take half the aim: a panel bracketed off the mast does not have
  // the travel the head's gimbal does, and it shows.
  const leafAim: TrackerAim = { azimuth: aim.azimuth, elevation: aim.elevation * 0.5 }
  const leafFrame = trackerFrame(leafAim)
  const leaves = LEAF_STATIONS.map((station, index) => {
    const joint = spine.joints[Math.round((1 - station) * STEM_SEGMENTS)] ?? spine.head
    const mount = stemPoint(joint)
    const hand = index % 2 === 0 ? 1 : -1
    // A panel, not a leaf shape: a bracket runs out from the mast and the
    // collector is a quad hung off it, so its outline is four corners in the
    // world rather than a curve that has to be kept in step with the aim.
    const corners = [
      { x: hand * 9, y: -LEAF_CHORD * 0.42, z: 0 },
      { x: hand * LEAF_SPAN, y: -LEAF_CHORD * 0.5, z: 0 },
      { x: hand * LEAF_SPAN, y: LEAF_CHORD * 0.5, z: 0 },
      { x: hand * 9, y: LEAF_CHORD * 0.42, z: 0 },
    ].map((local) => framePoint(leafFrame, mount, local))
    const root = framePoint(leafFrame, mount, { x: hand * 6, y: 0, z: 0 })
    const tip = framePoint(leafFrame, mount, { x: hand * LEAF_SPAN, y: 0, z: 0 })
    return {
      side: hand > 0 ? ("right" as const) : ("left" as const),
      path: hullPath(corners.map(at)),
      stalk: capsulePath(at(mount), at(root), 1.8),
      rib: linePath([at(root), at(tip)]),
      depth: towardCamera(tip),
      lit: towardCamera(leafFrame.forward) > 0,
    }
  })

  /* ---- the ground ------------------------------------------------------ */

  const anchor = extrudedPath(
    circleFootprint(0, 0, ANCHOR_RADIUS, 3),
    camera,
    ANCHOR_HEIGHT,
    0,
  )
  const feet = Array.from({ length: 3 }, (_, index) => {
    const angle = (index / 3) * Math.PI * 2 + Math.PI / 2
    return at({ x: Math.cos(angle) * ANCHOR_RADIUS, y: 1.4, z: Math.sin(angle) * ANCHOR_RADIUS })
  })

  const readout = Math.round(day * 100)
  const hourLabel = `${String(Math.floor(day * 24)).padStart(2, "0")}:${String(
    Math.floor(((day * 24) % 1) * 60),
  ).padStart(2, "0")}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot sunflower, sun at ${Math.round(aim.elevation)} degrees elevation, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${hourLabel}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.1 : 0.03, 0.25)
        if (delta !== 0) apply(day + delta)
        else if (event.key === "Home") apply(0.25)
        else if (event.key === "End") apply(0.75)
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
            d={`M 12 ${ORIGIN.y} H 188 M ${ORIGIN.x} 12 V ${ORIGIN.y + 10}`}
            strokeDasharray="2 3"
          />
          {/* The aim itself: where the head says the light is. */}
          <path
            d={linePath([
              at(headCentre),
              at({
                x: headCentre.x + forward.x * 46,
                y: headCentre.y + forward.y * 46,
                z: headCentre.z + forward.z * 46,
              }),
            ])}
            strokeDasharray="4 2.5"
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
            rx={px(ANCHOR_RADIUS * 1.5)}
            ry={px(Math.max(2.2, ANCHOR_RADIUS * 1.5 * camera.flatten))}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-anchor>
          <path d={anchor} {...cast} />
          {feet.map((foot, index) => (
            <circle key={index} cx={px(foot.x)} cy={px(foot.y)} r={3} {...machined} />
          ))}
        </g>

        {leaves
          .filter((leaf) => leaf.depth <= towardCamera(crown))
          .map((leaf) => (
            <LeafWing key={leaf.side} leaf={leaf} shell={shell} cast={cast} rib={palette.dark} />
          ))}

        <g data-stem>
          {stem.slice(0, -1).map((joint, index) => (
            <path
              key={index}
              d={capsulePath(at(joint), at(stem[index + 1]), STEM_RADIUS)}
              {...shell}
            />
          ))}
          {stem.map((joint, index) => (
            <circle
              key={index}
              data-node={index}
              cx={px(at(joint).x)}
              cy={px(at(joint).y)}
              r={px(STEM_RADIUS * 0.6)}
              fill={palette.dark}
              opacity={variant === "solid" ? 0.4 : 0.22}
            />
          ))}
        </g>

        {leaves
          .filter((leaf) => leaf.depth > towardCamera(crown))
          .map((leaf) => (
            <LeafWing key={leaf.side} leaf={leaf} shell={shell} cast={cast} rib={palette.dark} />
          ))}

        <g data-collar>
          <path d={capsulePath(at(crown), at(headCentre), 3.6)} {...machined} />
          <circle cx={px(at(crown).x)} cy={px(at(crown).y)} r={4.4} {...cast} />
        </g>

        <g data-head>
          {farRays.map((ray) => (
            <path key={ray.index} data-ray={ray.index} d={ray.path} {...shell} />
          ))}

          <path data-rim d={rim} {...(faceVisible ? cast : shell)} />

          {faceVisible ? (
            <g data-disc>
              {spirals.map((arm) => (
                <path
                  key={arm.index}
                  data-arm={arm.index}
                  d={arm.path}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={0.6}
                  opacity={0.4}
                />
              ))}
              {lattice
                .filter((cell) => cell.facing)
                .map((cell) => (
                  <circle
                    key={cell.index}
                    data-floret={cell.index}
                    cx={px(cell.point.x)}
                    cy={px(cell.point.y)}
                    r={px(cellRadius)}
                    {...seed}
                    opacity={0.55}
                  />
                ))}
              <circle
                data-hub
                cx={px(at(headCentre).x)}
                cy={px(at(headCentre).y)}
                r={HUB_RADIUS}
                {...machined}
              />
              <circle
                cx={px(at(headCentre).x)}
                cy={px(at(headCentre).y)}
                r={px(HUB_RADIUS * 0.45)}
                fill={signalColor}
                opacity={0.9}
              />
            </g>
          ) : (
            // Turned away: the back of the disc, and the ribs that carry it.
            <g data-back>
              {Array.from({ length: 6 }, (_, index) => {
                const angle = (index / 6) * Math.PI
                return (
                  <path
                    key={index}
                    d={linePath([
                      at(place({ x: Math.cos(angle) * HEAD_RADIUS, y: Math.sin(angle) * HEAD_RADIUS, z: DISH })),
                      at(place({ x: -Math.cos(angle) * HEAD_RADIUS, y: -Math.sin(angle) * HEAD_RADIUS, z: DISH })),
                    ])}
                    fill="none"
                    stroke={palette.dark}
                    strokeWidth={0.9}
                    opacity={0.45}
                  />
                )
              })}
              <circle
                data-hub
                cx={px(at(headCentre).x)}
                cy={px(at(headCentre).y)}
                r={px(HUB_RADIUS * 1.2)}
                {...cast}
              />
            </g>
          )}

          {nearRays.map((ray) => (
            <path key={ray.index} data-ray={ray.index} d={ray.path} {...shell} />
          ))}
        </g>

        <circle
          data-lamp
          cx={px(at({ x: 0, y: ANCHOR_HEIGHT + 3, z: -ANCHOR_RADIUS * 0.7 }).x)}
          cy={px(at({ x: 0, y: ANCHOR_HEIGHT + 3, z: -ANCHOR_RADIUS * 0.7 }).y)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {variant === "blueprint" && (
        <text
          x={188}
          y={24}
          textAnchor="end"
          fontFamily="ui-monospace, monospace"
          fontSize={5}
          fill={palette.grid}
        >
          {`AZ ${px(aim.azimuth)}° EL ${px(aim.elevation)}° COLLAR ${px(collar)}°`}
        </text>
      )}
      {label && (
        <text
          x={ORIGIN.x}
          y={204}
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

interface Leaf {
  side: "left" | "right"
  path: string
  stalk: string
  rib: string
  lit: boolean
}

function LeafWing({
  leaf,
  shell,
  cast,
  rib,
}: {
  leaf: Leaf
  shell: ReturnType<typeof robotSurface>
  cast: ReturnType<typeof robotSurface>
  rib: string
}) {
  return (
    <g data-leaf={leaf.side}>
      <path d={leaf.stalk} {...cast} />
      {/* Washed out when the panel is edge-on to the light, which is the only
          thing a collector facing the wrong way has to say. */}
      <path d={leaf.path} {...shell} fillOpacity={leaf.lit ? shell.fillOpacity : 0.5} />
      <path d={leaf.rib} fill="none" stroke={rib} strokeWidth={0.7} opacity={0.5} />
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

/** Where in the day the machine is aiming to be at `clock`, 0..1. */
export function sunflowerGoal(behavior: SunflowerBehavior, clock: number): number {
  if (behavior === "static") return 0.5
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    // Dawn to dusk and no further: the half of the day there is light in.
    case "sweep":
      return 0.25 + 0.5 * t
    // The whole twenty-four hours, so the head turns away and the rays furl.
    case "day":
      return t
    // Hunting about noon, the way a tracker that has arrived behaves.
    case "nod":
      return 0.5 + 0.035 * Math.sin(t * Math.PI * 2)
    default:
      return 0.5
  }
}

/**
 * The sun for a time of day: round once in azimuth, and an elevation that is a
 * sine about the horizon, so midnight is as far below it as noon is above.
 * This is a shaped number and not a solar position — there is no date here and
 * no latitude.
 */
export function sunflowerSun(daylight: number): TrackerAim {
  const t = clamp(Number.isFinite(daylight) ? daylight : 0.5, 0, 1)
  return {
    azimuth: -180 + 360 * t,
    elevation: NOON * Math.sin(2 * Math.PI * (t - 0.25)),
  }
}

/** How far open the rays are for a given solar elevation: shut below the horizon. */
export function sunflowerBloom(elevation: number): number {
  const e = clamp(Number.isFinite(elevation) ? elevation : 0, -90, 90)
  return clamp(e / 40, 0, 1)
}

/** The direction the light is coming from, for a given aim. */
export const sunflowerLight = (aim: TrackerAim): Vec3 => aimDirection(aim)

/** The aim a direction implies — the inverse, and the same one the head uses. */
export const sunflowerAim = (direction: Vec3): TrackerAim => aimFrom(direction)

/* -------------------------------------------------------------------------- */
/* drawing helpers                                                             */
/* -------------------------------------------------------------------------- */

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** An open polyline: a spiral arm, a rib, a dimension line. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { RobotSunflower }
