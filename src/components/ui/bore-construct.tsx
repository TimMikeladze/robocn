"use client"

/**
 * bore-construct — a tunnelling head forged out of light, and the wall it takes
 * with it.
 *
 * Every other machine in the set moves in front of a background it never
 * touches. This one's whole job is to change that background: the hole is the
 * real intersection of the bit's swept envelope with the slab, the spoil heaped
 * at the collar is the volume that came out of it, and the rubble off the kerf
 * is integrated ballistically. All of that is `src/lib/robocn/boring.ts` —
 * pure, no React, tested on its own.
 *
 * **Solved:** the penetration rate, from an energy balance at the face; the
 * cavity and its clipping at both faces; the excavated volume and the heap that
 * conserves it; the spall trajectories; the reduction — a fixed-ring planetary
 * set whose `ratio` is why the bit turns slower than the drum; the transfer
 * pair, meshed through `meshAngle`; the flushing pump, a real slider-crank; and
 * the main bearing's cage ratio.
 *
 * **Illustrated:** the fracture pattern around the bore (deterministic, but no
 * fracture mechanics), the bit's flights, the wheel's tread, the hoses and fins,
 * and the glow. Nothing collides — the machine is not stopped by the wall, it is
 * driven through it by `depth`.
 *
 * The wall is drawn as a **cutaway**: an opaque slab whose near half is washed
 * back, so the machine inside the bore can be seen. The bit is drawn inscribed
 * in the envelope the cavity is cut from, so it never stands outside its own
 * hole.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 *
 * Original archetype: a generic boring construct, named for its job. Design
 * note: docs/bore-construct.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  BORE_TAPER,
  boreCavity,
  boreDuty,
  boreEnvelope,
  boreFractures,
  boreSpall,
  cageRatio,
  rollAngle,
  spoilHeap,
  type BoreWall,
} from "@/lib/robocn/boring"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSliderCrank } from "@/lib/robocn/linkage"
import {
  elevationPoint,
  boxCorners,
  elevationDraft,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotSurface,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { gearPath, meshAngle, planetaryPose, planetaryTrain } from "@/lib/robocn/transmission"
import { cn } from "@/lib/utils"

/** What the machine does with nobody driving it. Always includes `static`. */
export type BoreConstructBehavior = "bore" | "surge" | "idle" | "static"

const VIEW_WIDTH = 316
const VIEW_HEIGHT = 132
const NATIVE_VIEW: RobotView = "profile"

/* -------------------------------------------------------------------------- */
/* the machine, in world units: x along the drawing, y up, depth out of it      */
/* -------------------------------------------------------------------------- */

/** Centreline of the machine, and of the bore. Low, because the drive wheel
 *  behind it has to reach the floor. */
const AXIS = 30
/** Gauge radius of the cutterhead — the largest thing on the machine, so
 *  everything behind it passes through the hole it cuts. */
const BIT_R = 24
const BODY_R = 16
/** Nose-cone length — the same one `boreCavity` cuts with. */
const TAPER = BIT_R * BORE_TAPER

/** Where the machine sits at `depth = 0`: crown on the face, tail at `TAIL`. */
const TAIL = -194
/** How far the crown travels between `depth` 0 and 1. */
const TRAVEL = 96

const WALL: BoreWall = { face: 0, thickness: 46, axis: AXIS, base: 0, top: 88 }
const WALL_DEPTH = 52
/** The share of the muck that reaches the collar; the rest packs the bore
 *  behind the machine, which is what a real head leaves behind it. */
const SPOIL_SHARE = 0.35

const ENVELOPE = boxCorners(
  { x: -WALL_DEPTH, y: 0, z: -(TRAVEL + 8) },
  { x: WALL_DEPTH, y: WALL.top, z: -TAIL },
)

/** The stepped bit, each cylinder inscribed in the cone the cavity is cut from. */
const BIT_STEPS: { from: number; to: number; radius: number }[] = [
  { from: 0, to: 0.2, radius: 0.08 },
  { from: 0.2, to: 0.4, radius: 0.2 },
  { from: 0.4, to: 0.6, radius: 0.4 },
  { from: 0.6, to: 0.8, radius: 0.6 },
  { from: 0.8, to: 1, radius: 0.8 },
]

/** The reduction between the drum and the bit. Tooth counts that assemble. */
const TRAIN = planetaryTrain(16, 12, 3)
/** Module of the planetary set, so the ring fits the spindle housing. */
const PLANET_MODULE = 0.7
const SUN_R = (PLANET_MODULE * TRAIN.sun) / 2
const PLANET_R = (PLANET_MODULE * TRAIN.planet) / 2
const RING_R = (PLANET_MODULE * TRAIN.ring) / 2
const CARRIER_R = SUN_R + PLANET_R

/** Right-angle tap off the main shaft, out to the layshaft. */
const CROWN: Vec2 = { x: -96, y: AXIS }
const CROWN_TEETH = 34
const CROWN_R = 17
const PINION_TEETH = 13
const PINION_R = 6.5
/** The layshaft gear, up and aft of the crown so it clears the bore. */
const LAYSHAFT_BEARING = -135
const LAY_TEETH = 10
const LAY_R = 5
const LAY: Vec2 = {
  x: CROWN.x - (CROWN_R + LAY_R) * Math.SQRT1_2,
  y: CROWN.y + (CROWN_R + LAY_R) * Math.SQRT1_2,
}

/** The flushing pump, on the front end of the layshaft. */
const PUMP_DEPTH = 12
const PUMP_CRANK = 4
const PUMP_ROD = 13

/** Thrust rams, four about the axis, and the gripper shoes they react against. */
const RAM_RING = 19
const RAM_ANGLES = [45, 135, 225, 315]
const RAM_ROOT = -126
const RAM_HEAD = -62
const GRIP_X = -74
const GRIP_ANGLES = [0, 90, 180, 270]

/** Main bearing: rollers on a pitch circle, orbiting at the real cage ratio. */
const ROLLERS = 9
const ROLLER_R = 2.1
const BEARING_PITCH = 11
const CAGE = cageRatio(ROLLER_R * 2, BEARING_PITCH * 2)

/**
 * The drive wheel: a pair on one transverse axle behind the body, rolling on
 * the floor. Its radius is its ride height, so the hub sits exactly on the
 * machine's axis and the tyre meets the ground.
 */
const AXLE: Vec2 = { x: -164, y: AXIS }
/** One unit shy of the ride height, so the tread tips meet the floor. */
const WHEEL_R = AXIS - 1
const RIM_R = WHEEL_R - 6.5
const HUB_R = 8
/** Half the track: one wheel each side of the body, on the same axle. */
const WHEEL_TRACK = 19
const WHEEL_WIDTH = 5.5
const TREAD_BLOCKS = 20
const SPOKES = 8
/** Longitudinal ribs down the body, the way the reference is built. */
const RIBS = 12

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/* -------------------------------------------------------------------------- */
/* motion                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * How far through the wall the head is at `clock`, 0 to 1, where `cycles` is
 * the share of the travel the solved penetration rate covers per clock unit.
 *
 * `bore` drives through and backs out to re-enter; `surge` takes the same
 * ground in four bites, with the grippers re-setting between them; `idle` turns
 * at the face without advancing.
 */
export function boreConstructAdvance(
  behavior: BoreConstructBehavior,
  clock: number,
  cycles = 0.25,
): number {
  if (!Number.isFinite(clock)) return 0.45
  const per = Number.isFinite(cycles) ? clamp(cycles, 0, 4) : 0.25
  const t = ((((clock * per) % 1) + 1) % 1)
  switch (behavior) {
    case "bore":
      // In over the first 82% of the cycle, withdrawn quickly to re-enter.
      return t < 0.82 ? t / 0.82 : clamp(1 - (t - 0.82) / 0.18, 0, 1)
    case "surge": {
      // Four bites: push, hold while the grippers re-set, push again.
      const bites = 4
      const step = Math.floor(t * bites)
      const within = t * bites - step
      const pushed = (step + clamp(within / 0.62, 0, 1)) / bites
      return clamp(pushed, 0, 1)
    }
    case "idle":
      return 0.015 + (Math.sin(clock * Math.PI * 2) + 1) * 0.01
    default:
      return 0.45
  }
}

/** A point on a ring about the machine axis, in the drawing and out of it. */
function aboutAxis(radius: number, degrees: number) {
  const a = (degrees * Math.PI) / 180
  return { across: Math.cos(a) * radius, depth: Math.sin(a) * radius }
}

/* -------------------------------------------------------------------------- */
/* the component                                                               */
/* -------------------------------------------------------------------------- */

export interface BoreConstructProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Controlled bore progress: 0 crown on the near face, 1 crown clear of the
   * far one. Supplying it pins the advance exactly — the spindle keeps turning,
   * because a drill held at depth is still a drill that is turning.
   */
  depth?: number
  onDepthChange?: (depth: number) => void
  behavior?: BoreConstructBehavior
  /** Spindle speed, bit revolutions per clock unit. The drum turns faster. */
  rev?: number
  /** Torque at the bit, 0 free to 1 the drive's rating. */
  thrust?: number
  /** The material: 0 spoil, 1 hard rock. Too hard for the thrust and it stalls. */
  hardness?: number
  /** How solidly the construct stands, 0 to 1. Paint only — nothing moves. */
  forge?: number
  showWall?: boolean
  /** The rubble off the kerf and the heap at the collar. */
  showSpoil?: boolean
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BoreConstruct({
  depth,
  onDepthChange,
  behavior = "bore",
  rev = 1.1,
  thrust = 0.72,
  hardness = 0.45,
  forge = 1,
  showWall = true,
  showSpoil = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.5,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  label,
  size = "md",
  variant = "solid",
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
  "aria-label": ariaLabel,
  ...props
}: BoreConstructProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = depth !== undefined

  const spin = Number.isFinite(rev) ? clamp(rev, 0, 12) : 1.1
  const torque = Number.isFinite(thrust) ? clamp(thrust, 0, 1) : 0.72
  const rock = Number.isFinite(hardness) ? clamp(hardness, 0, 1) : 0.45
  const solidity = Number.isFinite(forge) ? clamp(forge, 0, 1) : 1

  // The energy balance at the face. Everything the readout shows, and the rate
  // the behaviour advances at, comes out of this one call.
  const duty = boreDuty({ radius: BIT_R, cutters: 8, rev: spin, torque, hardness: rock })

  // Controlled wins and pins the advance; the clock keeps running underneath,
  // so the spindle turns and release reads as a machine resuming.
  const hold = controlled ? (Number.isFinite(depth) ? clamp(depth as number, 0, 1) : 0) : held
  // A stalled head advances at zero, and the behaviour eases back to the face.
  const cycles = clamp(duty.rate / TRAVEL, 0, 4)
  const goal = React.useCallback(
    (clock: number) => boreConstructAdvance(behavior, clock, cycles),
    [behavior, cycles],
  )
  const motion = useRobotScalar(goal, {
    rate: 2.4,
    hold,
    speed,
    paused,
    phase,
    animate: animate && behavior !== "static",
  })
  const progress = clamp(motion.value, 0, 1)
  const advance = progress * TRAVEL

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onDepthChange?.(bounded)
    },
    [onDepthChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* --- paint ------------------------------------------------------------- */

  const base = {
    shell: robotSurface("shell", variant, palette),
    metal: robotSurface("metal", variant, palette),
    dark: robotSurface("dark", variant, palette),
    accent: robotSurface("accent", variant, palette),
  }
  /**
   * A construct is solid light: in `solid` the panels wash out and every edge
   * lights up. The other three variants are the set's own, untouched — this
   * only ever changes paint.
   */
  const forged = (surface: RobotSurface, fill = 0.26): RobotSurface =>
    variant === "solid"
      ? { ...surface, stroke: palette.glow, strokeWidth: surface.strokeWidth + 0.55, fillOpacity: fill }
      : surface
  const shell = forged(base.shell)
  const machined = forged(base.metal, 0.3)
  const cast = forged(base.dark, 0.5)
  const lit = forged(base.accent, 0.72)
  // The wall is not a construct: it stays opaque.
  const rockFace = base.dark
  const rockCut = base.metal

  /* --- the cut ------------------------------------------------------------ */

  const cavity = boreCavity(advance, { radius: BIT_R }, WALL)
  const envelope = boreEnvelope(advance, { radius: BIT_R }, WALL)
  const crown: Vec2 = { x: advance, y: AXIS }
  const inWall = showWall && advance > 0 && advance < WALL.thickness + TAPER
  const cutting = duty.turning ? clamp(duty.rate / 30, 0, 1) : 0
  const spall =
    showWall && showSpoil && inWall
      ? boreSpall(motion.clock, cutting, { radius: BIT_R }, { at: crown, count: 16, life: 0.8 })
      : []
  const heap = spoilHeap(cavity.volume * SPOIL_SHARE, 27, { x: WALL.face - 26, y: 0 })
  const fractures = showWall ? boreFractures(cavity, { radius: BIT_R, hardness: rock }, WALL, 14) : []
  // Courses through the wall, interrupted exactly where the bore has eaten them.
  const courses = [16, 34, 52, 70, 88, 106].map((y) => {
    const half = Math.abs(y - AXIS)
    // The envelope reaches half-width `half` at this x; ahead of it is rock.
    const eaten = half <= BIT_R ? clamp(advance - (half / BIT_R) * TAPER, 0, WALL.thickness) : 0
    return { y, from: WALL.face + eaten, to: WALL.face + WALL.thickness }
  })

  /* --- the drive train ---------------------------------------------------- */

  const turns = motion.clock * spin
  const bitAngle = turns * 360
  // The cutterhead drive: the spindle turns `ratio` times for every turn of
  // the bit, and the bevel branch off it drives the flushing pump.
  const spindleAngle = bitAngle * TRAIN.ratio
  const planets = planetaryPose(TRAIN, spindleAngle)
  // The drive wheel rolls: it turns exactly as far as the machine has moved.
  const wheelAngle = rollAngle(advance, WHEEL_R)
  // A bevel, so the ratio is the tooth counts and the drawing is two cones.
  const crownAngle = -spindleAngle * (PINION_TEETH / CROWN_TEETH)
  const layAngle = meshAngle(CROWN_TEETH, crownAngle, LAY_TEETH, LAYSHAFT_BEARING)
  const pump = solveSliderCrank(layAngle, { crank: PUMP_CRANK, rod: PUMP_ROD })
  const cageAngle = spindleAngle * CAGE
  const ramStroke = torque * 9

  /* --- draw order --------------------------------------------------------- */

  /** How far toward the camera a part riding a ring about the axis sits. */
  const axialDepth = (x: number, across: number, out: number) => {
    const p = elevationPoint({ x, y: AXIS + across }, out, "profile")
    return camera.depth(p.x, p.y, p.z)
  }
  /** Sorts anything riding that ring back to front, so it paints in order. */
  const sortAxial = <T extends { x: number; across: number; depth: number }>(items: T[]) =>
    [...items].sort(
      (a, b) => axialDepth(a.x, a.across, a.depth) - axialDepth(b.x, b.across, b.depth),
    )

  const cutters = sortAxial(
    Array.from({ length: 6 }, (_, i) => {
      const { across, depth: d } = aboutAxis(BIT_R * 0.72, bitAngle + (i * 360) / 6)
      return { x: -TAPER * 0.55, across, depth: d, index: i }
    }),
  )
  const gauge = sortAxial(
    Array.from({ length: 8 }, (_, i) => {
      const { across, depth: d } = aboutAxis(BIT_R - 2.6, bitAngle * -1 + (i * 360) / 8)
      return { x: -TAPER - 7, across, depth: d, index: i }
    }),
  )
  const rollers = sortAxial(
    Array.from({ length: ROLLERS }, (_, i) => {
      const { across, depth: d } = aboutAxis(BEARING_PITCH, cageAngle + (i * 360) / ROLLERS)
      return { x: -50, across, depth: d, index: i }
    }),
  )
  const carriers = sortAxial(
    planets.planets.map((planet, i) => {
      const { across, depth: d } = aboutAxis(CARRIER_R, planet.bearing)
      return { x: -68, across, depth: d, index: i }
    }),
  )
  /** A point on the wheel's own rim, in drawing coordinates. */
  const onRim = (radius: number, degrees: number): Vec2 => {
    const a = ((degrees + wheelAngle) * Math.PI) / 180
    return { x: AXLE.x + Math.cos(a) * radius, y: AXLE.y + Math.sin(a) * radius }
  }
  const spokeAngles = Array.from({ length: SPOKES }, (_, i) => (i * 360) / SPOKES)
  const treadAngles = Array.from({ length: TREAD_BLOCKS }, (_, i) => (i * 360) / TREAD_BLOCKS)
  const ribs = sortAxial(
    Array.from({ length: RIBS }, (_, i) => {
      const { across, depth: d } = aboutAxis(BODY_R + 0.8, (i * 360) / RIBS)
      return { x: -150, across, depth: d, index: i }
    }),
  )
  const blades = sortAxial(
    Array.from({ length: 3 }, (_, i) => {
      const angle = bitAngle + 90 + (i * 360) / 3
      const { across, depth: d } = aboutAxis(BIT_R + 5, angle)
      return { x: -34, across, depth: d, index: i, angle }
    }),
  )
  const rams = sortAxial(
    RAM_ANGLES.map((angle, i) => {
      const { across, depth: d } = aboutAxis(RAM_RING, angle)
      return { x: RAM_ROOT, across, depth: d, index: i }
    }),
  )
  const grips = sortAxial(
    GRIP_ANGLES.map((angle, i) => {
      const { across, depth: d } = aboutAxis(1, angle)
      return { x: GRIP_X, across, depth: d, index: i, angle }
    }),
  )

  const percent = Math.round(progress * 100)
  const readout = `${percent} percent through the wall`
  // The gear artwork lives in the elevation plane: x right, y down.
  const inPlane = (depthOut = 0) => camera.wall(depthOut, 90) || undefined

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Bore construct, ${readout}, ${duty.turning ? "cutting" : "stalled against the face"}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(progress) : undefined}
      aria-valuetext={interactive ? readout : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.2)
        if (delta !== 0) apply(progress + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
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
        <path
          d={`M 10 ${VIEW_HEIGHT - 26} H ${VIEW_WIDTH - 10}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={solid([{ x: TAIL - 6, y: 0 }, { x: TRAVEL + 6, y: 0 }], WALL_DEPTH)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: TAIL - 6, y: 0 }, { x: TRAVEL + 6, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        {/* The spoil that reached the collar: the volume the bit removed. */}
        {showWall && showSpoil && heap.radius > 0.5 && (
          <g data-spoil data-volume={px(cavity.volume)}>
            <path
              d={solid(heap.outline, heap.radius * 0.72)}
              fill={palette.dark}
              opacity={0.18}
            />
            <path
              d={line(heap.outline)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.7}
              strokeLinejoin="round"
              opacity={0.42}
            />
            {/* A few boulders shed off the toe, so the heap reads as loose. */}
            {[-0.82, -0.44, 0.5, 0.86].map((along, index) => (
              <path
                key={along}
                d={disc(
                  { x: WALL.face - 26 + along * heap.radius, y: 1.4 + index * 0.4 },
                  1.4 + index * 0.35,
                  1.2,
                  (index - 1.5) * heap.radius * 0.3,
                )}
                fill={palette.dark}
                opacity={0.3}
              />
            ))}
          </g>
        )}

        {/* The wall, in cutaway: the slab's mass, then the sectioned face with
            the bore cut out of it under `evenodd`. */}
        {showWall && (
          <g data-wall>
            <path d={solid(cavity.outline, WALL_DEPTH)} {...rockFace} opacity={0.28} />
            <path
              data-cavity
              data-progress={px(cavity.progress)}
              d={`${line(cavity.outline, 0, true)} ${cavity.hole.length ? line(cavity.hole, 0, true) : ""}`}
              fillRule="evenodd"
              fill={variant === "solid" || variant === "blueprint" ? palette.metal : "none"}
              stroke={palette.dark}
              strokeWidth={0.9}
              opacity={variant === "wire" ? 0.25 : 0.42}
            />
            {courses.map((course) =>
              course.to - course.from > 0.5 ? (
                <path
                  key={course.y}
                  d={line([
                    { x: course.from, y: course.y },
                    { x: course.to, y: course.y },
                  ])}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={0.6}
                  opacity={0.35}
                />
              ) : null,
            )}
            <g data-fracture>
              {fractures.map((crack, index) => (
                <path
                  key={index}
                  d={line(crack.points)}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={px(0.3 + crack.weight * 0.6)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={px(0.18 + crack.weight * 0.3)}
                />
              ))}
            </g>
            {/* The void itself: what the bit took out, so the machine inside it
                reads as a machine inside a hole. */}
            {cavity.hole.length > 0 && (
              <>
                <path
                  data-void
                  d={line(cavity.hole, 0, true)}
                  fill={palette.dark}
                  opacity={variant === "wire" ? 0.12 : 0.55}
                />
                <path
                  d={line(cavity.hole, 0, true)}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={1.1}
                  opacity={0.75}
                />
              </>
            )}
            {/* The bore's mouth, and the far face once it starts to give way. */}
            {cavity.hole.length > 0 && (
              <path
                d={line([
                  { x: WALL.face, y: AXIS + envelope(WALL.face) },
                  { x: WALL.face, y: AXIS - envelope(WALL.face) },
                ])}
                fill="none"
                stroke={palette.accent}
                strokeWidth={1.4}
                opacity={0.5}
              />
            )}
            {cavity.breakthrough > 0.01 && (
              <path
                data-breakthrough
                d={box(
                  WALL.face + WALL.thickness - 1.6,
                  AXIS - Math.max(1, cavity.exitRadius),
                  WALL.face + WALL.thickness + 1.6,
                  AXIS + Math.max(1, cavity.exitRadius),
                  Math.max(1, cavity.exitRadius),
                )}
                fill={palette.glow}
                opacity={px(0.12 + cavity.breakthrough * 0.34)}
              />
            )}
          </g>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* the machine                                                        */}
        {/* ------------------------------------------------------------------ */}
        <g
          data-machine
          data-advance={px(advance)}
          transform={`translate(${px(to({ x: advance, y: 0 }).x - to({ x: 0, y: 0 }).x)} ${px(to({ x: advance, y: 0 }).y - to({ x: 0, y: 0 }).y)})`}
          opacity={px(0.58 + solidity * 0.42)}
        >
          {/* The construct's own bloom, hugging the silhouette it is made of.
              Solid only: the other three variants are line drawings. */}
          {variant === "solid" && (
            <path
              // A polyline, not a swept solid: a hull would bridge the waist
              // and the head into one wedge instead of following the shape.
              d={line(
                [
                  { x: -152, y: AXIS + BODY_R + 3 },
                  { x: -50, y: AXIS + BODY_R + 3 },
                  { x: -44, y: AXIS + BIT_R + 3 },
                  { x: -TAPER, y: AXIS + BIT_R + 3 },
                  { x: 3, y: AXIS },
                  { x: -TAPER, y: AXIS - BIT_R - 3 },
                  { x: -44, y: AXIS - BIT_R - 3 },
                  { x: -50, y: AXIS - BODY_R - 3 },
                  { x: -152, y: AXIS - BODY_R - 3 },
                ],
                0,
                true,
              )}
              fill={palette.glow}
              opacity={px(0.04 + solidity * 0.09)}
            />
          )}

          {/*
            --- the drive wheel -------------------------------------------
            A pair on one transverse axle behind the body, rolling on the
            floor. `rollAngle` ties the turn to the travel: one revolution per
            2πr of advance, nothing at all while the machine is held. Every
            wheel part is drawn in the elevation plane, so the wheel is a wheel
            here and foreshortens to its own width seen from the front.
          */}
          <g data-wheel data-angle={px(wheelAngle % 360)}>
            {/* The trailing arms carrying the axle, one each side. */}
            {[-WHEEL_TRACK, WHEEL_TRACK].map((side) => (
              <path
                key={`arm${side}`}
                d={bar({ x: -142, y: AXIS + 4 }, AXLE, 4, 3.4, side)}
                {...cast}
              />
            ))}
            {[-WHEEL_TRACK, WHEEL_TRACK].map((side) => (
              <g key={side} data-side={side < 0 ? "port" : "starboard"}>
                {/* Tyre, rim well, and the spokes that make the turn legible. */}
                <path d={disc(AXLE, WHEEL_R, WHEEL_WIDTH, side, 28)} {...shell} />
                <path d={disc(AXLE, RIM_R, WHEEL_WIDTH * 0.75, side, 24)} {...cast} />
                {spokeAngles.map((angle, index) => (
                  <path
                    key={angle}
                    data-spoke={index}
                    d={bar(
                      onRim(HUB_R * 0.7, angle),
                      onRim(RIM_R - 1, angle),
                      2.3,
                      WHEEL_WIDTH * 0.5,
                      side,
                    )}
                    {...machined}
                  />
                ))}
                {/* The tread: lugs round the rim, standing proud of the tyre. */}
                {treadAngles.map((angle, index) => (
                  <path
                    key={angle}
                    data-tread={index}
                    d={solid(
                      [
                        onRim(WHEEL_R - 2.4, angle - 7),
                        onRim(WHEEL_R + 0.9, angle - 5),
                        onRim(WHEEL_R + 0.9, angle + 5),
                        onRim(WHEEL_R - 2.4, angle + 7),
                      ],
                      WHEEL_WIDTH * 1.1,
                      side,
                    )}
                    {...cast}
                  />
                ))}
                {/* Hub, and the drive that lives inside it. */}
                <path d={disc(AXLE, HUB_R, WHEEL_WIDTH * 1.5, side, 16)} {...machined} />
                <path
                  data-core
                  d={disc(AXLE, HUB_R * 0.5, WHEEL_WIDTH * 1.7, side, 12)}
                  fill={palette.accent}
                  opacity={px(0.4 + solidity * 0.5)}
                />
              </g>
            ))}
            {/* The axle itself, through the body. */}
            <path
              d={bar(
                { x: AXLE.x, y: AXIS },
                { x: AXLE.x, y: AXIS },
                2.6,
                WHEEL_TRACK + WHEEL_WIDTH,
              )}
              {...machined}
            />
          </g>

          {/* --- the machinery bay ----------------------------------------- */}
          <g data-bay>
            <path d={box(-150, AXIS - BODY_R, -112, AXIS + BODY_R, BODY_R)} {...shell} />
            {/* The rib cage down the body: longitudinal staves over the shell. */}
            {ribs.map((rib) => (
              <path
                key={rib.index}
                data-rib={rib.index}
                d={bar(
                  { x: -146, y: AXIS + rib.across },
                  { x: -80, y: AXIS + rib.across },
                  1.5,
                  1.5,
                  rib.depth,
                )}
                {...machined}
              />
            ))}
            {/* Bands round the cage, the way the reference is hooped. */}
            {[-142, -128, -114, -100, -86].map((x) => (
              <path
                key={x}
                d={box(x - 1.8, AXIS - BODY_R - 1.6, x + 1.8, AXIS + BODY_R + 1.6, BODY_R + 1.6)}
                {...cast}
              />
            ))}
            {/* Aft bulkhead, and the bolts round it. */}
            <path d={box(-152, AXIS - BODY_R - 2.5, -146, AXIS + BODY_R + 2.5, BODY_R + 2.5)} {...cast} />
            {[0, 60, 120, 180, 240, 300].map((angle) => {
              const { across, depth: d } = aboutAxis(BODY_R + 1.2, angle)
              return (
                <path
                  key={angle}
                  d={bar({ x: -153, y: AXIS + across }, { x: -145, y: AXIS + across }, 1.5, 1.5, d)}
                  {...machined}
                />
              )
            })}
            {/* Heat exchanger fins on the crown of the body. */}
            <g data-fins>
              {[-144, -138, -132, -126, -120].map((x) => (
                <path
                  key={x}
                  d={solid(
                    [
                      { x: x - 1, y: AXIS + BODY_R - 1 },
                      { x: x + 1, y: AXIS + BODY_R - 1 },
                      { x: x + 1, y: AXIS + BODY_R + 5.5 },
                      { x: x - 1, y: AXIS + BODY_R + 5.5 },
                    ],
                    11,
                  )}
                  {...machined}
                />
              ))}
            </g>
          </g>

          {/* --- thrust rams: four about the axis, extending with torque ---- */}
          <g data-thrust>
            {rams.map((ram) => {
              const y = AXIS + ram.across
              const rodEnd = RAM_HEAD + ramStroke
              return (
                <g key={ram.index} data-ram={ram.index}>
                  <path
                    d={bar({ x: RAM_ROOT, y }, { x: -92, y }, 3.4, 3.4, ram.depth)}
                    {...machined}
                  />
                  <path
                    d={bar({ x: -94, y }, { x: rodEnd, y }, 1.5, 1.5, ram.depth)}
                    {...cast}
                  />
                  <path d={bar({ x: -93.4, y }, { x: -90.6, y }, 3.9, 3.9, ram.depth)} {...cast} />
                  <path d={bar({ x: rodEnd - 1.6, y }, { x: rodEnd + 1.6, y }, 2.6, 2.6, ram.depth)} {...machined} />
                </g>
              )
            })}
          </g>

          {/* --- grippers: the shoes the thrust reacts against -------------- */}
          <g data-gripper data-reach={px(ramStroke)}>
            {grips.map((grip) => {
              const reach = BODY_R + 1 + (BIT_R - BODY_R - 3) * (progress > 0.01 ? torque : 0)
              const seat = aboutAxis(BODY_R - 2, grip.angle)
              const pad = aboutAxis(reach, grip.angle)
              const shoe = aboutAxis(reach - 2.6, grip.angle)
              return (
                <g key={grip.index} data-shoe={grip.index}>
                  <path
                    d={bar(
                      { x: GRIP_X, y: AXIS + seat.across },
                      { x: GRIP_X, y: AXIS + shoe.across },
                      2.2,
                      2.2,
                      (seat.depth + shoe.depth) / 2,
                    )}
                    {...cast}
                  />
                  <path
                    d={solid(
                      [
                        { x: GRIP_X - 8, y: AXIS + shoe.across },
                        { x: GRIP_X + 8, y: AXIS + shoe.across },
                        { x: GRIP_X + 6, y: AXIS + pad.across },
                        { x: GRIP_X - 6, y: AXIS + pad.across },
                      ],
                      4,
                      (pad.depth + shoe.depth) / 2,
                    )}
                    {...machined}
                  />
                </g>
              )
            })}
          </g>

          {/* --- the gearbox: a right-angle tap, a layshaft gear, a pump ---- */}
          <g data-gearbox data-ratio={px(TRAIN.ratio)}>
            <path d={box(-114, AXIS - BODY_R, -78, AXIS + BODY_R, BODY_R)} {...shell} />
            {/* The hump that houses the layshaft. */}
            <path d={box(-116, AXIS + BODY_R - 3, -84, AXIS + 22, 11)} {...cast} />
            {/* Main shaft, drum to spindle. */}
            <path d={bar({ x: -148, y: AXIS }, { x: -80, y: AXIS }, 3.2, 3.2)} {...machined} />

            <g transform={inPlane(0)}>
              <g
                data-gear="crown"
                transform={`translate(${px(CROWN.x)} ${px(-CROWN.y)}) rotate(${px(crownAngle)})`}
              >
                <path d={gearPath(CROWN_TEETH, CROWN_R)} {...machined} />
                <circle r={4.5} fill={palette.dark} opacity={0.8} />
              </g>
              <g
                data-gear="layshaft"
                transform={`translate(${px(LAY.x)} ${px(-LAY.y)}) rotate(${px(layAngle)})`}
              >
                <path d={gearPath(LAY_TEETH, LAY_R)} {...machined} />
                <circle r={1.6} fill={palette.dark} opacity={0.8} />
              </g>
            </g>

            {/* The bevel pinion on the main shaft, meshing with the crown's rim. */}
            <path
              data-gear="pinion"
              d={solid(
                [
                  { x: CROWN.x + CROWN_R - 1, y: AXIS - PINION_R },
                  { x: CROWN.x + CROWN_R + 7, y: AXIS - PINION_R * 0.45 },
                  { x: CROWN.x + CROWN_R + 7, y: AXIS + PINION_R * 0.45 },
                  { x: CROWN.x + CROWN_R - 1, y: AXIS + PINION_R },
                ],
                PINION_R,
              )}
              {...cast}
            />

            {/* The flushing pump, on the front end of the layshaft. */}
            <g data-pump transform={inPlane(PUMP_DEPTH)}>
              <path
                d={`M ${px(LAY.x)} ${px(-LAY.y)} L ${px(LAY.x + pump.pin.x)} ${px(-(LAY.y + pump.pin.y))}`}
                stroke={palette.metal}
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={`M ${px(LAY.x + pump.pin.x)} ${px(-(LAY.y + pump.pin.y))} L ${px(LAY.x + pump.wrist.x)} ${px(-(LAY.y + pump.wrist.y))}`}
                stroke={palette.dark}
                strokeWidth={1.7}
                strokeLinecap="round"
                fill="none"
              />
              <rect
                x={px(LAY.x + pump.wrist.x - 1)}
                y={px(-LAY.y - 3.2)}
                width={7}
                height={6.4}
                rx={1}
                {...machined}
              />
              <rect
                x={px(LAY.x + PUMP_CRANK + PUMP_ROD - 5)}
                y={px(-LAY.y - 4.6)}
                width={14}
                height={9.2}
                rx={1.6}
                fill="none"
                stroke={palette.metal}
                strokeWidth={1}
                opacity={0.85}
              />
            </g>

            {/* Flushing line, pump forward to the bit. */}
            <path
              data-wiring
              d={line(
                [
                  { x: LAY.x + 14, y: LAY.y },
                  { x: -74, y: AXIS + BODY_R - 3 },
                  { x: -50, y: AXIS + BODY_R - 6 },
                  { x: -38, y: AXIS + 8 },
                ],
                PUMP_DEPTH,
              )}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.75}
            />
          </g>

          {/* --- the planetary reduction ----------------------------------- */}
          <g data-reduction data-carrier={px(planets.carrier % 360)}>
            <path d={box(-80, AXIS - 17, -58, AXIS + 17, 17)} {...shell} />
            <path d={box(-81.6, AXIS - RING_R - 1.6, -78.4, AXIS + RING_R + 1.6, RING_R + 1.6)} {...cast} />
            <path d={box(-59.6, AXIS - RING_R - 1.6, -56.4, AXIS + RING_R + 1.6, RING_R + 1.6)} {...cast} />
            {carriers.map((planet) => (
              <g key={planet.index} data-planet={planet.index}>
                <path
                  d={bar(
                    { x: -78, y: AXIS + planet.across },
                    { x: -60, y: AXIS + planet.across },
                    PLANET_R,
                    PLANET_R,
                    planet.depth,
                  )}
                  {...machined}
                />
                <path
                  d={bar(
                    { x: -60, y: AXIS + planet.across },
                    { x: -56, y: AXIS + planet.across },
                    PLANET_R * 0.35,
                    PLANET_R * 0.35,
                    planet.depth,
                  )}
                  {...cast}
                />
              </g>
            ))}
            <path d={bar({ x: -80, y: AXIS }, { x: -44, y: AXIS }, SUN_R, SUN_R)} {...cast} />
          </g>

          {/* --- the main bearing ------------------------------------------ */}
          <g data-bearing data-cage={px(cageAngle % 360)}>
            <path d={box(-58, AXIS - 14, -44, AXIS + 14, 14)} {...machined} />
            {rollers.map((roller) => (
              <path
                key={roller.index}
                data-roller={roller.index}
                d={bar(
                  { x: -56, y: AXIS + roller.across },
                  { x: -46, y: AXIS + roller.across },
                  ROLLER_R,
                  ROLLER_R,
                  roller.depth,
                )}
                {...cast}
              />
            ))}
            {/* Spindle collar, out to the head. */}
            <path d={box(-46, AXIS - 11, -38, AXIS + 11, 11)} {...cast} />
          </g>

          {/* Plough blades: a cowl of three claws off the gauge, hooking over
              the cone to the nose, turning with the head. */}
          <g data-cowl>
            {blades.map((blade) => {
              // One ribbon at constant radial thickness: outer edge forward,
              // inner edge back, both on the same ray so it never fattens.
              const ribs2 = Array.from({ length: 10 }, (_, i) => {
                const t = i / 9
                const outer = (BIT_R + 6) * (1 - t * t * 0.84)
                const inner = Math.max(1.6, outer - 5)
                const at = aboutAxis(1, blade.angle)
                return {
                  x: -48 + t * 54,
                  outer: at.across * outer,
                  inner: at.across * inner,
                  depth: at.depth * ((outer + inner) / 2),
                }
              })
              return (
                <path
                  key={blade.index}
                  data-blade={blade.index}
                  d={solid(
                    [
                      ...ribs2.map((r) => ({ x: r.x, y: AXIS + r.outer })),
                      ...ribs2
                        .slice()
                        .reverse()
                        .map((r) => ({ x: r.x - 4, y: AXIS + r.inner })),
                    ],
                    2.6,
                    ribs2[4].depth,
                  )}
                  {...shell}
                />
              )
            })}
          </g>

          {/* --- the cutterhead -------------------------------------------- */}
          <g data-bit data-angle={px(bitAngle % 360)}>
            {/* Gauge barrel: the widest thing on the machine, so everything
                behind it passes through the hole it cuts. */}
            <path d={box(-44, AXIS - BIT_R, -TAPER, AXIS + BIT_R, BIT_R)} {...shell} />
            {/* The stepped cone, inscribed in the envelope the cavity is cut from. */}
            {BIT_STEPS.map((step) => (
              <path
                key={step.from}
                d={box(
                  -TAPER * step.to,
                  AXIS - BIT_R * step.radius,
                  -TAPER * step.from,
                  AXIS + BIT_R * step.radius,
                  BIT_R * step.radius,
                )}
                {...machined}
              />
            ))}
            {/* Helical flights up the cone: drawing, phased by the bit's angle. */}
            <g data-flights opacity={0.8}>
              {[0, 1, 2].map((strand) => {
                const points = Array.from({ length: 11 }, (_, i) => {
                  const t = i / 10
                  const x = -TAPER * t
                  const turn = bitAngle + strand * 120 + t * 260
                  return { x, y: AXIS + aboutAxis(BIT_R * (t * 0.94 + 0.08), turn).across }
                })
                return (
                  <path
                    key={strand}
                    d={line(points)}
                    fill="none"
                    stroke={palette.glow}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    opacity={0.65}
                  />
                )
              })}
            </g>
            {/* Disc cutters on the cone, and gauge cutters on the barrel. */}
            {cutters.map((cutter) => (
              <path
                key={cutter.index}
                data-cutter={cutter.index}
                d={disc({ x: cutter.x, y: AXIS + cutter.across }, 3.6, 1.4, cutter.depth)}
                {...cast}
              />
            ))}
            {gauge.map((tooth) => (
              <path
                key={tooth.index}
                data-cutter={`gauge-${tooth.index}`}
                d={disc({ x: tooth.x, y: AXIS + tooth.across }, 2.8, 2.8, tooth.depth)}
                {...lit}
              />
            ))}
            {/* The crown ring, and the kerf it is standing in. */}
            <path d={box(-TAPER - 0.9, AXIS - BIT_R - 1, -TAPER + 0.9, AXIS + BIT_R + 1, BIT_R + 1)} {...machined} />
            {cutting > 0.02 && inWall && (
              <path
                data-kerf
                d={disc({ x: -1.5, y: AXIS }, px(3 + cutting * 5), 1)}
                fill={palette.glow}
                opacity={px(0.3 + cutting * 0.5)}
              />
            )}
          </g>
        </g>

        {/* Rubble off the kerf: ballistic, and thrown by the head's own flow. */}
        {spall.length > 0 && (
          <g data-spall>
            {spall.map((fragment, index) => (
              <path
                key={index}
                d={disc({ x: fragment.x, y: fragment.y }, px(fragment.size), px(fragment.size * 0.6), fragment.depth)}
                fill={palette.dark}
                opacity={px(clamp(0.75 - fragment.age * 0.7, 0, 1))}
              />
            ))}
          </g>
        )}

        {variant === "blueprint" && (
          <g data-diagnostic fontFamily="ui-monospace, monospace" fontSize={5.4} fill={palette.foreground}>
            <text x={px(to({ x: TAIL + 4, y: WALL.top - 6 }).x)} y={px(to({ x: TAIL + 4, y: WALL.top - 6 }).y)}>
              {`ROP ${duty.rate.toFixed(1)} u/s · ${duty.advancePerRev.toFixed(2)} u/rev`}
            </text>
            <text x={px(to({ x: TAIL + 4, y: WALL.top - 14 }).x)} y={px(to({ x: TAIL + 4, y: WALL.top - 14 }).y)}>
              {`Es ${duty.specificEnergy.toFixed(2)} · i ${TRAIN.ratio.toFixed(2)}:1 · ${duty.turning ? "CUT" : "STALL"}`}
            </text>
          </g>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 6}
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

export { BoreConstruct }
