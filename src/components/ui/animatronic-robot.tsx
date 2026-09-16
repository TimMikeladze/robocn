"use client"

/**
 * animatronic-robot — the whole animatronic, running itself.
 *
 * The set has the parts already: `robot-skeleton` walks a biped, `robot-torso`
 * breathes a cage, `animatronic-face` drives a head as servo channels,
 * `robot-hand` grips. This is the body they belong to, and two things here are
 * new.
 *
 * **It controls itself as one body.** `routineIntent` returns an
 * `AnimatronicIntent` — gait, stance, lean, twist, reach, gaze, expression,
 * breath, grip, all at once — rather than a scalar, because looking at
 * something is a posture rather than a number. `solveAttention` splits a look
 * across the eyes, the neck and the waist, each taking only what the one before
 * it could not reach, which is what reads as *looking at you*. Every field of
 * the intent is also a prop: supply one and it wins, and nothing below the
 * controller branches on a routine name.
 *
 * **It stands over its own foot.** `centreOfMass` sums the segment masses at
 * their own centres, `supportPolygon` is the hull of the feet actually loaded,
 * and the machine rolls rigidly about its support centroid to bring the plumb
 * line back inside. Rigid: no bone changes length, and `showBalance` draws the
 * polygon, the weight and the plumb line so the claim is checkable.
 *
 * Solved: legs, spine, ribs, arms, hands, the skull's silhouette, every face
 * channel, and the balance. Illustrated: the shell panels, the chest core, the
 * vents and the hip and shoulder cans — they are drawn on the solved frame and
 * drive nothing. There is no dynamics anywhere: the machine corrects its
 * posture toward its support, it does not compute whether it could.
 *
 * One geometry, four projections through `robotCamera`.
 *
 * Design note: `docs/animatronic-robot.md`.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  animatronicRoutines,
  blendIntent,
  footHalfWidth,
  rollAbout,
  routineIntent,
  solveAnimatronic,
  solveAttention,
  type AnimatronicIntent,
  type AnimatronicRoutine,
} from "@/lib/robocn/animatronic"
import {
  ellipsoidOutline,
  faceShape,
  onFace,
  rotateHead,
  type FaceChannels,
  type FaceExpression,
  type FaceSide,
  type HeadGeometry,
} from "@/lib/robocn/face"
import { type HandGrasp } from "@/lib/robocn/hand"
import { clamp, lerp2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  rollPoint,
  type SkeletonArm,
  type SkeletonGait,
  type SkeletonLeg,
  type SkeletonProportions,
} from "@/lib/robocn/skeleton"
import {
  capsulePath,
  circleFootprint,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the machine does with nobody driving it. */
export type AnimatronicRobotBehavior = AnimatronicRoutine

/** Panels over the frame, or the frame on its own. */
export type AnimatronicChassis = "shell" | "frame"

const VIEW_WIDTH = 214
const VIEW_HEIGHT = 300
/** World origin on screen: the floor, under the pelvis. */
const CENTRE = { x: 107, y: 258 }
const SCALE = 1.3
const NATIVE_VIEW: RobotView = "front"

/**
 * The family's proportions with an animatronic's head: bigger than a person's,
 * because the face is the part of this machine that has to carry at 150px.
 */
export const animatronicProportions: SkeletonProportions = {
  ...defaultProportions,
  // The family's 80 gives a leg with 86 of bone in it 73 of gap to cover, which
  // is a permanent half-squat — invisible head-on and a bird leg in profile.
  // 88 leaves the knee a working bend instead of a crouch.
  hip: 88,
  // A wider stance than a person's: at 11 the feet, which are four times longer
  // than they are apart, cross each other from a three-quarter camera.
  hipSpan: 14,
  neck: 12,
  skull: 34,
}

/** The face chart's own units; every feature below is drawn in them. */
const HEAD_GEOMETRY: HeadGeometry = { radii: { x: 34, y: 43, z: 38 }, gain: 6, travel: 6 }
/** Chart units to world units, so the skull comes out the height it is spec'd. */
const HEAD_SCALE = animatronicProportions.skull / 2 / HEAD_GEOMETRY.radii.y

const EYE_X = 13
const EYE_Y = 12
const EYE_R = 7
const BROW_Y = 29
const MOUTH_Y = -24
/** The jaw hinges on a real axis through the ear servos. */
const HINGE: Vec3 = { x: 0, y: 4, z: 18 }
/** Where an ear servo sits on the skull's surface, on the machine's right. */
const EAR: Vec3 = { x: 33.75, y: 4, z: 3 }
const JAW_SWING = 21

/** The frame the foot plates are measured against. */
const P = animatronicProportions

/**
 * The sole between the heel and the ball, measured from the ankle joint it
 * pitches about — the same chassis `robot-foot` draws, on the same numbers, so
 * the two machines cannot drift apart. `y` runs up from the ankle, which puts
 * the sole line at `-P.ankle`.
 */
const soleChassis: Vec2[] = [
  { x: -P.heel, y: -P.ankle },
  { x: -P.heel - 1.5, y: -P.ankle + 3.6 },
  { x: -P.heel + 1, y: -P.ankle + 8.8 },
  { x: 3, y: -P.ankle + 11.5 },
  { x: P.sole - 2, y: -P.ankle + 7.2 },
  { x: P.sole + 1, y: -P.ankle + 2.6 },
  { x: P.sole + 1, y: -P.ankle },
]

/** The toe plate, measured from the ball it hinges on — already on the sole. */
const toePlate: Vec2[] = [
  { x: -1.5, y: 0 },
  { x: P.toe, y: 0 },
  { x: P.toe - 1.8, y: 3.2 },
  { x: -1.5, y: 5.4 },
]

/** A contact pad lying on a sole line at `base`. */
const contactPad = (from: number, to: number, height: number, base: number): Vec2[] => [
  { x: from, y: base - 0.6 },
  { x: to, y: base - 0.6 },
  { x: to, y: base + height },
  { x: from, y: base + height },
]

/**
 * The cage. Narrower than the shoulder span, or the ribs overhang the arm rails
 * into open air, and starting above the lumbar so the bottom pair are attached
 * ribs rather than a floating hook ending in nothing.
 */
const CAGE = { width: 15.5, depth: 11, front: 5.5, from: 0.46, to: 0.93 }

/**
 * Plan view has no height in it, so a standing machine projects to its own
 * footprint — a head, a pair of shoulders and two feet, and nothing else. That
 * is the correct projection and it is small, so the camera comes in.
 */
const fits: Record<RobotView, number> = { plan: 1.7, front: 1, profile: 1, iso: 0.86 }

/**
 * Where the world origin lands on screen. The elevations hang off the floor
 * line, which is what keeps the feet on the ground; plan view has no height in
 * it at all, so a standing machine collapses onto that line and would sit in
 * the bottom of a frame sized for an elevation. It gets the middle instead.
 */
const origins: Record<RobotView, { x: number; y: number }> = {
  plan: { x: CENTRE.x, y: VIEW_HEIGHT / 2 },
  front: CENTRE,
  profile: CENTRE,
  iso: { x: CENTRE.x, y: CENTRE.y - 22 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const finite = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const isRoutine = (value: unknown): value is AnimatronicRoutine =>
  typeof value === "string" && (animatronicRoutines as readonly string[]).includes(value)

/**
 * The self-control loop, re-exported as a pure function of the clock so motion
 * is tested by sampling it rather than by faking animation frames.
 */
export function animatronicRobotIntent(
  behavior: AnimatronicRobotBehavior,
  clock: number,
): AnimatronicIntent {
  return routineIntent(isRoutine(behavior) ? behavior : "idle", finite(clock))
}

export interface AnimatronicRobotProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** What the machine does with anything you have not supplied. */
  behavior?: AnimatronicRobotBehavior
  /** Panels over the frame, or the frame bare. */
  chassis?: AnimatronicChassis

  /* ---- posing: every one of these wins over the routine ---- */
  /** Footfall pattern. */
  gait?: SkeletonGait
  /** Controlled gait cycle fraction. */
  gaitPhase?: number
  /** Hip height, 0 crouched to 1 standing tall. */
  stance?: number
  stride?: number
  lift?: number
  /** Whole-column pitch in degrees, positive leaning forward. */
  lean?: number
  /** Shoulders against the pelvis, in degrees. */
  twist?: number
  /** Neck angles in degrees, on top of what the column carries. */
  neckYaw?: number
  neckPitch?: number
  neckRoll?: number
  /** Pupil aim, −1..1 on both axes. */
  look?: Vec2 | null
  /** A point both hands reach for, in the body frame. */
  reach?: Vec3 | null
  /** A point one hand reaches for. Wins over `reach` for that side. */
  reachLeft?: Vec3 | null
  reachRight?: Vec3 | null
  /** The face's expression, by name or as a channel vector you blended. */
  expression?: FaceExpression | FaceChannels
  /** How far the face rig drives there, 0..1. */
  intensity?: number
  /** Lid closure, 0..1. Omit and it blinks on its own. */
  blink?: number
  /** Speech level, 0..1: opens the jaw and works the lips. */
  speech?: number
  /** Chest expansion, 0 emptied to 1 filled. */
  breath?: number
  grasp?: HandGrasp
  /** Hand closure, 0 open to 1 shut. */
  grip?: number
  /** Drive individual face servos. These win over the expression. */
  channels?: Partial<FaceChannels> & { left?: Partial<FaceSide>; right?: Partial<FaceSide> }
  /** How hard the machine works to keep its weight over its feet, 0..1. */
  effort?: number

  /* ---- attention ---- */
  /**
   * What the machine is looking at, −1..1 on both axes: `x` to its left on
   * screen, `y` up. Supplying it stops the pointer tracking.
   */
  attend?: Vec2 | null
  onAttendChange?: (point: Vec2 | null) => void
  /** Follow the pointer anywhere on the page. */
  track?: boolean
  /** Reach for whatever it is attending to, as well as looking at it. */
  follow?: boolean
  /** Correct the posture toward the support polygon. */
  balance?: boolean

  /* ---- the rest of the contract ---- */
  showGround?: boolean
  /** Draw the support polygon, the centre of mass and its plumb line. */
  showBalance?: boolean
  /** Shade each pad of each sole by what it is carrying. Follows showBalance. */
  showLoad?: boolean
  showReadout?: boolean
  /** Rib hoops in the cage. */
  ribs?: number
  proportions?: Partial<SkeletonProportions>
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Routine cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a crowd of them breaks step. */
  phase?: number
  /** Drag to move what it is looking at; arrow keys do the same. */
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function AnimatronicRobot({
  behavior = "idle",
  chassis = "shell",
  gait,
  gaitPhase,
  stance,
  stride,
  lift,
  lean,
  twist,
  neckYaw,
  neckPitch,
  neckRoll,
  look,
  reach,
  reachLeft,
  reachRight,
  expression,
  intensity,
  blink,
  speech,
  breath,
  grasp,
  grip,
  channels,
  effort,
  attend,
  onAttendChange,
  track = true,
  follow = true,
  balance = true,
  showGround = true,
  showBalance = false,
  showLoad,
  showReadout = true,
  ribs = 7,
  proportions,
  view = NATIVE_VIEW,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
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
}: AnimatronicRobotProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  /** Stable across server and client, so two of these on a page cannot collide. */
  const faceClip = `${React.useId().replace(/:/g, "")}-face`
  const routine: AnimatronicRoutine = isRoutine(behavior) ? behavior : "idle"

  /* ------------------------------------------------------------ attention */

  const [held, setHeld] = React.useState<Vec2 | null>(null)
  const controlledAttention = attend !== undefined
  const pointer = usePointerTarget(svgRef, {
    enabled: (track || interactive) && !controlledAttention && held === null,
    within: "window",
    persist: true,
    // The page maps to −1..1 with `y` up, clipped to the unit disc so a corner
    // of the screen is not a harder look than an edge.
    toWorld: React.useCallback((point: Vec2) => {
      const x = (point.x - 0.5) * 2
      const y = -(point.y - 0.5) * 2
      const distance = Math.hypot(x, y) || 1
      const limit = Math.min(1, distance) / distance
      return { x: x * limit, y: y * limit }
    }, []),
  })

  const raw = controlledAttention ? attend : (held ?? pointer.target)
  const target: Vec2 | null =
    raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)
      ? { x: clamp(raw.x, -1, 1), y: clamp(raw.y, -1, 1) }
      : null

  /**
   * One loop, and one scalar on it: how far the machine has given itself over
   * to what it is looking at. The routine keeps running underneath, so letting
   * go eases back into wherever it has moved on to rather than snapping.
   */
  const motion = useRobotScalar(target ? 1 : 0, {
    rate: 2.4,
    speed,
    paused,
    phase,
    animate: animate && routine !== "static",
  })
  const clock = motion.clock
  const engaged = clamp(motion.value, 0, 1)

  /* --------------------------------------------------------- the intent */

  const own = routineIntent(routine, clock)
  const attention = solveAttention(target, finite(effort, 1))

  // Attending is a whole posture, so it is a second intent crossfaded with the
  // routine's rather than a set of overrides sprayed over it.
  const attending: AnimatronicIntent = {
    ...own,
    look: attention.look,
    neckYaw: attention.neckYaw,
    neckPitch: attention.neckPitch,
    neckRoll: attention.neckRoll,
    twist: own.twist * 0.3 + attention.twist,
    lean: own.lean + attention.lean,
    grip: follow && target ? Math.max(own.grip, 0.34) : own.grip,
  }
  const blended = target ? blendIntent(own, attending, engaged) : own
  /**
   * The reach is the one channel the crossfade cannot carry on its own: a
   * chain either solves to a point or it swings, and there is nothing halfway.
   * So the *point* is what eases — out from wherever the routine already had
   * the hands, or from where they hang — and the chain solves to it every
   * frame. Without this the arms snap out the instant a pointer appears.
   */
  const driven: AnimatronicIntent =
    follow && target
      ? {
          ...blended,
          reach: null,
          reachLeft: mix3(own.reachLeft ?? own.reach ?? REST_REACH, aimedReach(target, -1), engaged),
          reachRight: mix3(own.reachRight ?? own.reach ?? REST_REACH, aimedReach(target, 1), engaged),
        }
      : blended

  // Props win outright, and only the ones supplied.
  const posed: AnimatronicIntent = {
    ...driven,
    gait: gait ?? driven.gait,
    cycle: gaitPhase !== undefined ? finite(gaitPhase) : driven.cycle,
    stance: stance ?? driven.stance,
    stride: stride ?? driven.stride,
    lift: lift ?? driven.lift,
    lean: lean ?? driven.lean,
    twist: twist ?? driven.twist,
    neckYaw: neckYaw ?? driven.neckYaw,
    neckPitch: neckPitch ?? driven.neckPitch,
    neckRoll: neckRoll ?? driven.neckRoll,
    look: look ?? driven.look,
    reach: reach !== undefined ? reach : driven.reach,
    reachLeft: reachLeft !== undefined ? reachLeft : driven.reachLeft,
    reachRight: reachRight !== undefined ? reachRight : driven.reachRight,
    expression: resolveExpression(expression, driven.expression),
    intensity: intensity ?? driven.intensity,
    blink: blink ?? driven.blink,
    speech: speech ?? driven.speech,
    breath: breath ?? driven.breath,
    grasp: grasp ?? driven.grasp,
    grip: grip ?? driven.grip,
    effort: effort ?? driven.effort,
  }

  const rig = React.useMemo(
    () => ({ ...animatronicProportions, ...proportions }),
    [proportions],
  )

  const body = solveAnimatronic({
    ...posed,
    balance,
    proportions: rig,
    head: HEAD_GEOMETRY,
    ribs,
    cage: CAGE,
    handScale: HEAD_SCALE * 0.68,
  })
  const pose = body.skeleton
  // The face channels a caller supplied last, over everything the rig solved.
  const solution = channels ? withChannels(body.face, channels) : body.face

  /* ---------------------------------------------------------- interaction */

  const apply = React.useCallback(
    (next: Vec2 | null) => {
      const bounded = next
        ? { x: Math.round(clamp(finite(next.x), -1, 1) * 100) / 100, y: Math.round(clamp(finite(next.y), -1, 1) * 100) / 100 }
        : null
      setHeld((current) => {
        const same =
          current === bounded ||
          (current !== null && bounded !== null && current.x === bounded.x && current.y === bounded.y)
        if (!same) onAttendChange?.(bounded)
        return bounded
      })
    },
    [onAttendChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    onDrag: React.useCallback(
      (point: Vec2) => apply({ x: (point.x - 0.5) * 2, y: -(point.y - 0.5) * 2 }),
      [apply],
    ),
    // Release hands it straight back: the pointer is where the drag left it, so
    // the machine keeps watching without the grab becoming a lock.
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ------------------------------------------------------------- drawing */

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const origin = origins[view] ?? CENTRE
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const depthOf = (point: Vec3) => camera.depth(point.x, point.y, point.z)
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)
  const trace3 = (points: Vec3[], close = true) => {
    const path = points
      .map((point, index) => {
        const at = to(point)
        return `${index ? "L" : "M"} ${px(at.x)} ${px(at.y)}`
      })
      .join(" ")
    return close ? `${path} Z` : path
  }
  const box = (centre: Vec3, hx: number, hy: number, hz: number) =>
    slabPath(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) => ({
            x: centre.x + sx * hx,
            y: centre.y + sy * hy,
            z: centre.z + sz * hz,
          })),
        ),
      ),
      camera,
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const panelled = chassis === "shell"
  const showLoadPads = showLoad ?? showBalance
  /** Line work — brows, lips, seams — follows the variant like everything else. */
  const line1 = variant === "solid" ? palette.dark : palette.grid
  const hoopPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.shell,
    strokeWidth: variant === "solid" ? 2.2 : shell.strokeWidth,
    strokeDasharray: shell.strokeDasharray,
    strokeLinejoin: "round" as const,
  }

  /* ---- the head: one ellipsoid, every feature pushed onto its surface ---- */

  const headPose = body.headPose
  const radii = HEAD_GEOMETRY.radii
  const worldRadii: Vec3 = {
    x: radii.x * HEAD_SCALE,
    y: radii.y * HEAD_SCALE,
    z: radii.z * HEAD_SCALE,
  }
  const centreOfHead = body.headCentre
  /** A point in the head's own chart, out to the world. */
  const inHead = (point: Vec3): Vec3 => {
    const turned = rotateHead(point, headPose)
    return {
      x: centreOfHead.x + turned.x * HEAD_SCALE,
      y: centreOfHead.y + turned.y * HEAD_SCALE,
      z: centreOfHead.z + turned.z * HEAD_SCALE,
    }
  }
  const skin = (u: number, v: number, outset = 0) => onFace(u, v, radii, outset)
  const chart = (point: Vec2, outset = 0) => to(inHead(skin(point.x, point.y, outset)))

  /** The jaw swings about the ear axis before anything else touches it. */
  const swing = -(solution.jaw * JAW_SWING * Math.PI) / 180
  const hinged = (point: Vec3): Vec3 => {
    const y = point.y - HINGE.y
    const z = point.z - HINGE.z
    const c = Math.cos(swing)
    const s = Math.sin(swing)
    return { x: point.x, y: HINGE.y + y * c - z * s, z: HINGE.z + y * s + z * c }
  }
  const jawChart = (point: Vec2, outset = 0) => to(inHead(hinged(skin(point.x, point.y, outset))))

  const face = (points: Vec2[], project: (p: Vec2, outset?: number) => Vec2, outset = 0, close = true) => {
    const path = points
      .map((point, index) => {
        const at = project(point, outset)
        return `${index ? "L" : "M"} ${px(at.x)} ${px(at.y)}`
      })
      .join(" ")
    return close ? `${path} Z` : path
  }

  // The camera is linear, so its coefficients are the direction toward it.
  const toCamera = {
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  }
  /**
   * How squarely a patch of the skull meets the camera. The ellipsoid's normal
   * against the view direction, so the far eye turns away by itself — and so
   * does anything else on the surface, which is why this takes a point rather
   * than a pair of face-chart coordinates.
   */
  const facingAt = (point: Vec3) => {
    const normal = { x: point.x / radii.x ** 2, y: point.y / radii.y ** 2, z: point.z / radii.z ** 2 }
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1
    const turned = rotateHead(
      { x: normal.x / length, y: normal.y / length, z: normal.z / length },
      headPose,
    )
    return turned.x * toCamera.x + turned.y * toCamera.y + turned.z * toCamera.z
  }
  const facing = (u: number, v: number) => facingAt(skin(u, v))
  /**
   * A feature is pushed off the skull by its own outset, so one still being
   * drawn at the limb projects outside the silhouette and reads as clipped by
   * the head. It fades out before it gets there rather than at the exact edge.
   */
  const seen = (u: number, v: number) => px(clamp((facing(u, v) - 0.14) * 4, 0, 1))
  const forward = rotateHead({ x: 0, y: 0, z: -1 }, headPose)
  const ahead = forward.x * toCamera.x + forward.y * toCamera.y + forward.z * toCamera.z
  /**
   * Centreline parts sit on the median plane, so the normal test is the wrong
   * question for them: seen from the side they are not turned away, they are
   * edge-on, and the projection has already collapsed them to a line. They fade
   * only once the head has actually turned its back. The floor is what keeps
   * that line drawn — without it the whole lower face goes blank in profile.
   */
  const median = px(clamp(ahead * 2.2 + 0.12, 0, 1))

  const skull = ellipsoidOutline(worldRadii, headPose, camera, centreOfHead)
  const ring = (cx: number, cy: number, rx: number, ry: number, count = 20, from = 0, sweep = Math.PI * 2) =>
    Array.from({ length: count }, (_, index) => {
      const angle = from + (index / (count - 1 || 1)) * sweep
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }
    })
  const panel = (cx: number, cy: number, halfW: number, halfH: number, corner: number, per = 8) => {
    const r = Math.max(0, Math.min(corner, halfW, halfH))
    const centers: [number, number, number][] = [
      [cx + halfW - r, cy + halfH - r, 0],
      [cx - halfW + r, cy + halfH - r, Math.PI / 2],
      [cx - halfW + r, cy - halfH + r, Math.PI],
      [cx + halfW - r, cy - halfH + r, (Math.PI * 3) / 2],
    ]
    return centers.flatMap(([ox, oy, from]) =>
      Array.from({ length: per }, (_, index) => {
        const angle = from + (index / (per - 1)) * (Math.PI / 2)
        return { x: ox + Math.cos(angle) * r, y: oy + Math.sin(angle) * r }
      }),
    )
  }

  const eye = (sign: -1 | 1) => {
    const channel = sign < 0 ? solution.left : solution.right
    const cx = sign * EYE_X
    const lidTop = EYE_Y + EYE_R * 1.05 - channel.lidUpper * (EYE_R * 2.1)
    const lidBottom = EYE_Y - EYE_R * 1.05 + channel.lidLower * (EYE_R * 1.35)
    const pupil = { x: cx + solution.gaze.x * 3.2, y: EYE_Y - solution.gaze.y * 2.8 }
    const lid = (name: string, edge: number, over: boolean) => (
      <path
        key={name}
        data-lid={name}
        d={face(
          [
            { x: cx - EYE_R * 1.16, y: edge },
            ...ring(cx, EYE_Y, EYE_R * 1.16, EYE_R * 1.3, 12, Math.PI, over ? -Math.PI : Math.PI),
            { x: cx + EYE_R * 1.16, y: edge },
          ],
          chart,
          1.9,
        )}
        fill={variant === "solid" ? palette.metal : "none"}
        stroke={variant === "solid" ? palette.dark : palette.grid}
        strokeWidth={0.7}
      />
    )
    return (
      <g key={sign} data-eye={sign < 0 ? "left" : "right"} opacity={seen(cx, EYE_Y)}>
        <path
          d={face(ring(cx, EYE_Y, EYE_R, EYE_R), chart, 0.9)}
          fill={palette.metal}
          stroke={palette.dark}
          strokeWidth={0.7}
          opacity={variant === "solid" ? 1 : 0.35}
        />
        <path d={face(ring(pupil.x, pupil.y, 4.2, 4.2, 18), chart, 1.3)} fill={palette.accent} stroke="none" opacity={0.92} />
        <path d={face(ring(pupil.x, pupil.y, 2, 2, 14), chart, 1.5)} fill={palette.dark} stroke="none" />
        {lid(sign < 0 ? "left-upper" : "right-upper", lidTop, true)}
        {lid(sign < 0 ? "left-lower" : "right-lower", lidBottom, false)}
      </g>
    )
  }

  const brow = (sign: -1 | 1) => {
    const channel = sign < 0 ? solution.left : solution.right
    const inner = BROW_Y + channel.browInner * 6
    const outer = BROW_Y + channel.browOuter * 7
    const points = Array.from({ length: 6 }, (_, index) => {
      const t = index / 5
      return {
        // Kept clear of the limb: a brow drawn out to the temple leaves the
        // silhouette once its stroke width and outset are added.
        x: sign * (4.5 + t * 16),
        // A brow is an arch: the middle rides above the chord between its tips.
        y: inner + (outer - inner) * t + Math.sin(t * Math.PI) * 2,
      }
    })
    return (
      <path
        key={sign}
        data-brow={sign < 0 ? "left" : "right"}
        opacity={seen(sign * 13, BROW_Y)}
        d={face(points, chart, 1.4, false)}
        fill="none"
        stroke={line1}
        strokeWidth={variant === "solid" ? 2.9 : 1.6}
        strokeLinecap="round"
      />
    )
  }

  const halfMouth = 13 - solution.lipPucker * 4
  const cornerLeft = { x: -halfMouth, y: MOUTH_Y + solution.left.lipCorner * 5 }
  const cornerRight = { x: halfMouth, y: MOUTH_Y + solution.right.lipCorner * 5 }
  const upperLip = [
    cornerLeft,
    { x: -halfMouth * 0.45, y: MOUTH_Y + 2.2 - solution.lipPress * 1.3 },
    { x: 0, y: MOUTH_Y + 1 - solution.lipPress * 1.1 },
    { x: halfMouth * 0.45, y: MOUTH_Y + 2.2 - solution.lipPress * 1.3 },
    cornerRight,
  ]
  // Deep enough that the plate is still in front of it at full swing, so what
  // opens is the cavity rather than the back of the head.
  const cavity = [
    ...upperLip,
    { x: halfMouth * 0.92, y: MOUTH_Y - 6 },
    { x: 0, y: MOUTH_Y - 14 },
    { x: -halfMouth * 0.92, y: MOUTH_Y - 6 },
  ]
  /**
   * The jaw plate. Kept inside the ellipsoid's own domain: `onFace` clamps a
   * chart point that is off the surface onto the equator, and an outline with
   * two of those in it folds over itself and draws as a tangle rather than a
   * plate. Every point here has real surface under it at every swing.
   */
  const jawOutline = [
    { x: -22, y: -12 },
    { x: -16, y: -20 },
    { x: -8, y: -24 },
    { x: 0, y: -25 },
    { x: 8, y: -24 },
    { x: 16, y: -20 },
    { x: 22, y: -12 },
    { x: 24.5, y: -16 },
    { x: 22.5, y: -23 },
    { x: 17, y: -27.5 },
    { x: 10, y: -31 },
    { x: 0, y: -32.5 },
    { x: -10, y: -31 },
    { x: -17, y: -27.5 },
    { x: -22.5, y: -23 },
    { x: -24.5, y: -16 },
  ]

  const head = (
    <g data-head>
      <g data-neck>
        <path d={link(pose.shoulders, pose.neck, 3.4)} {...machined} />
        <path d={link(pose.neck, centreOfHead, 2.8)} {...cast} />
      </g>
      <g data-skull>
        {/*
          Every feature is a curve pushed off the skull by its own outset, and
          near the limb that outset projects outside the silhouette — a brow
          crossing the crown, a lip escaping as a detached bead. Clipping the
          whole face to the head's own outline makes that impossible at any
          angle rather than tuning each feature until it stops.
        */}
        <clipPath id={faceClip}>
          <ellipse
            cx={px(skull.cx)}
            cy={px(skull.cy)}
            rx={px(Math.max(skull.rx, 0.1))}
            ry={px(Math.max(skull.ry, 0.1))}
            transform={`rotate(${px(skull.angle)} ${px(skull.cx)} ${px(skull.cy)})`}
          />
        </clipPath>
        <ellipse
          cx={px(skull.cx)}
          cy={px(skull.cy)}
          rx={px(Math.max(skull.rx, 0.1))}
          ry={px(Math.max(skull.ry, 0.1))}
          transform={`rotate(${px(skull.angle)} ${px(skull.cx)} ${px(skull.cy)})`}
          {...shell}
        />
        {/* The cranium seam: a panel line over the crown, which is what tells
            the silhouette apart from a ball. */}
        <path
          d={face(ring(0, 6, 28, 31, 16, Math.PI * 0.08, Math.PI * 0.84), chart, 0.6, false)}
          fill="none"
          stroke={line1}
          strokeWidth={0.9}
          opacity={0.35}
        />
      </g>
      <g clipPath={`url(#${faceClip})`}>
      <path
        data-band
        opacity={seen(0, EYE_Y)}
        d={face(panel(0, EYE_Y, 25, 8.6, 7.5, 9), chart, 0.25)}
        {...cast}
      />
      {([-1, 1] as const).map(eye)}
      {([-1, 1] as const).map(brow)}
      {/* The plate and the cavity behind it have volume, so they survive being
          seen edge-on and are not faded by a test meant for flat detail. The
          lips drawn on them are flat, and are. */}
      <g data-mouth>
        <path data-cavity d={face(cavity, chart, 0.15)} {...cast} opacity={median} />
        <path data-jaw d={face(jawOutline, jawChart, 0.55)} {...shell} />
        {/* The seam the plate parts along — its top edge alone, drawn lighter,
            so the jaw reads as a hinge rather than as a crack. */}
        <path
          d={face(jawOutline.slice(0, 7), jawChart, 0.75, false)}
          fill="none"
          stroke={line1}
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={px(median * 0.3)}
        />
        <path
          d={face(upperLip, chart, 1.2, false)}
          fill="none"
          stroke={line1}
          strokeWidth={variant === "solid" ? 2 : 1.4}
          strokeLinecap="round"
          opacity={px(median * (1 - solution.jaw * 0.85))}
        />
      </g>
      </g>
      {/* The ear servo cans, on the hinge axis — the one part of the head that
          only exists off the face's own chart. */}
      {([-1, 1] as const).map((sign) => {
        // On the side of the skull, on its surface — not a disc floating on the
        // cheek. Its own normal points sideways, which is what lets the far one
        // turn away when the head does.
        const seat: Vec3 = { x: sign * EAR.x, y: EAR.y, z: EAR.z }
        const at = to(inHead(seat))
        return (
          <circle
            key={sign}
            data-servo={sign < 0 ? "left-ear" : "right-ear"}
            cx={px(at.x)}
            cy={px(at.y)}
            r={2.6}
            {...machined}
            /* A can standing off the skull has volume, so unlike the flat
               detail on the face it survives being seen edge-on — which is
               exactly the head-on view, where it is the thing breaking the
               silhouette. It goes only once the head has turned its back. */
            opacity={px(clamp(facingAt(seat) * 1.8 + 0.72, 0, 1))}
          />
        )
      })}
    </g>
  )

  /* ------------------------------------------------------------- the body */

  /**
   * A limb's own sagittal frame. The balance roll turns the whole machine about
   * a point on the floor, so `unroll` takes a solved point back into the
   * upright body the leg was drawn in and `reroll` puts it back — which is what
   * lets the sole plate and the toe hinge stay flat outlines rather than
   * becoming special cases of the correction.
   */
  const unroll = (point: Vec3) => (body.roll === 0 ? point : rollAbout(point, body.pivot, -body.roll))
  const reroll = (point: Vec3) => (body.roll === 0 ? point : rollAbout(point, body.pivot, body.roll))

  /**
   * One leg, with the chassis `robot-leg` and `robot-foot` draw around the same
   * solver: two strut actuators whose stroke is a consequence of the pose, a
   * shin plate, a sole turned about the ankle, a toe plate hinged at the ball,
   * and one contact pad per part of the sole shaded by what it is carrying.
   */
  const legPart = (leg: SkeletonLeg) => {
    const lateral = unroll(leg.hip).x
    /** Sagittal to world, at a lateral offset across the machine. */
    const at = (point: Vec2, across = 0): Vec3 =>
      reroll({ x: lateral + across, y: point.y, z: -point.x })
    /** A solved world point back into the leg's own sagittal chart. */
    const sag = (point: Vec3): Vec2 => {
      const up = unroll(point)
      return { x: -up.z, y: up.y }
    }
    const project = (point: Vec2, across = 0) => to(at(point, across))
    const solid = (outline: Vec2[], halfWidth = footHalfWidth) =>
      slabPath(
        outline.flatMap((point) => [at(point, -halfWidth), at(point, halfWidth)]),
        camera,
      )
    /** The same, for a plate that hinges: turned in the plane it lives in. */
    const turned = (outline: Vec2[], about: Vec2, degrees: number, halfWidth = footHalfWidth) =>
      solid(
        outline.map((point) => rollPoint({ x: point.x + about.x, y: point.y + about.y }, about, degrees)),
        halfWidth,
      )

    const hip = sag(leg.hip)
    const knee = sag(leg.knee)
    const ankle = sag(leg.ankle)
    const ball = sag(leg.ball)

    // Struts: one from the pelvis down to the thigh, one across the knee to the
    // shin. Both run between solved points, so their stroke is the pose.
    const struts: Array<[string, Vec2, Vec2]> = [
      // Anchored inside the pelvis block, not above it: a strut that starts
      // clear of the shell reads as a pillar standing in the machine's belly.
      ["hip", { x: hip.x - 7, y: hip.y + 1 }, lerp2(hip, knee, 0.42)],
      ["knee", lerp2(hip, knee, 0.72), lerp2(knee, ankle, 0.3)],
    ]
    const loads: Array<[string, Vec2[], Vec2, number, number]> = [
      ["heel", contactPad(-P.heel - 1, -P.heel + 6, 2.6, -P.ankle), ankle, leg.angle, leg.roll.heelLoad],
      ["ball", contactPad(P.sole - 6, P.sole + 1, 2.6, -P.ankle), ankle, leg.angle, leg.roll.ballLoad],
      ["toe", contactPad(2, P.toe, 2.4, 0), ball, leg.toeAngle, leg.roll.toeLoad],
    ]

    return (
      <g key={`leg-${leg.side}`} data-leg={leg.side}>
        {panelled &&
          struts.map(([name, from, into]) => {
            const span = Math.max(Math.hypot(into.x - from.x, into.y - from.y), 1e-3)
            const rod = lerp2(from, into, Math.min(span * 0.55, 14) / span)
            return (
              <g key={name} data-actuator={`${leg.side}-${name}`}>
                <path d={capsulePath(project(from), project(rod), 2.4)} {...cast} />
                <path d={capsulePath(project(rod), project(into), 1.1)} {...machined} />
              </g>
            )
          })}

        {panelled && <path d={link(leg.hip, leg.knee, 6.2)} {...shell} />}
        <path data-femur d={link(leg.hip, leg.knee, 3.4)} {...machined} />
        <path data-tibia d={link(leg.knee, leg.ankle, 2.6)} {...machined} />
        {panelled && (
          <path
            data-shin
            d={solid(
              [
                lerp2(knee, ankle, 0.16),
                lerp2(knee, ankle, 0.9),
                { x: lerp2(knee, ankle, 0.85).x + 4.5, y: lerp2(knee, ankle, 0.85).y },
                { x: lerp2(knee, ankle, 0.22).x + 5.5, y: lerp2(knee, ankle, 0.22).y },
              ],
              4.2,
            )}
            {...shell}
          />
        )}

        <g data-foot={leg.side}>
          <path data-sole d={turned(soleChassis, ankle, leg.angle)} {...(panelled ? shell : machined)} />
          <path data-toe d={turned(toePlate, ball, leg.toeAngle, footHalfWidth - 1)} {...machined} />
          {panelled && (
            <path
              data-heel
              d={turned(contactPad(-P.heel + 0.5, -P.heel + 6, 3, -P.ankle), ankle, leg.angle, footHalfWidth - 0.5)}
              {...cast}
            />
          )}
          {/* The loads are geometry — which parts of the sole are still on the
              floor — and not forces. Nothing here weighs anything, which is why
              they are shown with the balance rather than by default. */}
          {showLoadPads && loads.map(([name, outline, about, degrees, amount]) => (
            <path
              key={name}
              data-pad={`${leg.side}-${name}`}
              d={turned(outline, about, degrees, footHalfWidth - 1.5)}
              fill={palette.accent}
              fillOpacity={px(0.08 + amount * 0.8)}
              stroke="none"
            />
          ))}
        </g>

        <g data-joint={`${leg.side}-knee`}>
          <circle cx={px(to(leg.knee).x)} cy={px(to(leg.knee).y)} r={4} {...machined} />
          <circle cx={px(to(leg.knee).x)} cy={px(to(leg.knee).y)} r={1.7} fill={palette.dark} />
        </g>
        <g data-joint={`${leg.side}-ankle`}>
          <circle cx={px(to(leg.ankle).x)} cy={px(to(leg.ankle).y)} r={3.2} {...machined} />
          <circle cx={px(to(leg.ankle).x)} cy={px(to(leg.ankle).y)} r={1.4} fill={palette.dark} />
        </g>
        <circle
          data-joint={`${leg.side}-toe`}
          cx={px(to(leg.ball).x)}
          cy={px(to(leg.ball).y)}
          r={1.5}
          {...cast}
        />
      </g>
    )
  }

  /**
   * One arm, with `robot-hand`'s own chassis on the end of it: the palm slab
   * with its thenar plate, a knuckle per finger, alternating phalanx shells,
   * and a pad on each fingertip shaded by how far that digit has closed. Same
   * solver, same pose, drawn at the scale the machine wears it.
   */
  const armPart = (arm: SkeletonArm) => {
    const hand = body.hands.find((entry) => entry.side === arm.side)
    const place = (point: Vec3): Vec3 => {
      if (!hand) return point
      const { frame } = hand
      const s = frame.scale
      return {
        x: frame.origin.x + (frame.right.x * point.x + frame.up.x * point.y + frame.out.x * point.z) * s,
        y: frame.origin.y + (frame.right.y * point.x + frame.up.y * point.y + frame.out.y * point.z) * s,
        z: frame.origin.z + (frame.right.z * point.x + frame.up.z * point.y + frame.out.z * point.z) * s,
      }
    }
    /** Hand units to drawn radius, so a phalanx keeps its taper at this scale. */
    const gauge = (radius: number) => Math.max(1.1, radius * (hand?.frame.scale ?? 0.25) * 2)
    const slab = (outline: Vec2[], front: number, back: number) =>
      slabPath(
        outline.flatMap((point) => [
          place({ x: point.x, y: point.y, z: front }),
          place({ x: point.x, y: point.y, z: back }),
        ]),
        camera,
      )

    return (
      <g key={`arm-${arm.side}`} data-arm={arm.side}>
        {panelled && <path d={link(arm.shoulder, arm.elbow, 5.4)} {...shell} />}
        <path data-humerus d={link(arm.shoulder, arm.elbow, 2.9)} {...machined} />
        {panelled && <path d={link(arm.elbow, arm.wrist, 4.2)} {...shell} />}
        <path data-forearm d={link(arm.elbow, arm.wrist, 2.3)} {...machined} />
        <g data-joint={`${arm.side}-elbow`}>
          <circle cx={px(to(arm.elbow).x)} cy={px(to(arm.elbow).y)} r={3.4} {...machined} />
          <circle cx={px(to(arm.elbow).x)} cy={px(to(arm.elbow).y)} r={1.5} fill={palette.dark} />
        </g>
        {hand && (
          <g data-hand={arm.side}>
            <path data-palm d={slab(hand.pose.palm, hand.pose.palmFront, hand.pose.palmBack)} {...(panelled ? shell : machined)} />
            {panelled && (
              /* Thenar plate: the pad the thumb's saddle joint sits under. */
              <path
                d={slab(
                  hand.pose.palm.map((point) => ({
                    x: point.x * 0.5 + (arm.side === "left" ? -9 : 9),
                    y: point.y * 0.48 + 12,
                  })),
                  hand.pose.palmFront + 1.8,
                  hand.pose.palmFront,
                )}
                {...machined}
              />
            )}
            {hand.pose.digits.slice(1).map((finger) => {
              const knuckle = to(place(finger.joints[0]))
              return (
                <circle
                  key={finger.name}
                  data-knuckle={`${arm.side}-${finger.name}`}
                  cx={px(knuckle.x)}
                  cy={px(knuckle.y)}
                  r={px(gauge(finger.radii[0] ?? 4) * 0.78)}
                  {...machined}
                />
              )
            })}
            {hand.pose.digits.map((finger) => (
              <g key={finger.name} data-digit={`${arm.side}-${finger.name}`}>
                {finger.joints.slice(0, -1).map((joint, i) => (
                  <path
                    key={i}
                    data-phalanx={`${arm.side}-${finger.name}-${i}`}
                    d={capsulePath(to(place(joint)), to(place(finger.joints[i + 1])), gauge(finger.radii[i] ?? 3))}
                    {...(panelled && i % 2 ? shell : machined)}
                  />
                ))}
                {/* The pad is the surface that would touch something. It is a
                    shape the solver produced, not a grip on anything. */}
                <circle
                  data-pad={`${arm.side}-${finger.name}`}
                  cx={px(to(place(finger.pad)).x)}
                  cy={px(to(place(finger.pad)).y)}
                  r={px(gauge(finger.radii[finger.radii.length - 1] ?? 3) * 0.7)}
                  fill={palette.accent}
                  fillOpacity={px(finger.closure * 0.8)}
                />
              </g>
            ))}
          </g>
        )}
      </g>
    )
  }

  /**
   * The pelvis is drawn before both legs rather than inside the torso: a femur
   * head sits on the outside of it, so a leg sorted behind the torso would
   * otherwise disappear into the block on one side and not the other.
   */
  const pelvis = (
    <g data-pelvis>
      <path d={box({ x: pose.pelvis.x, y: pose.pelvis.y - 4, z: pose.pelvis.z }, 13, 7.5, 8)} {...(panelled ? shell : machined)} />
      {pose.legs.map((leg) => (
        <circle
          key={leg.side}
          data-joint={`${leg.side}-hip`}
          cx={px(to(leg.hip).x)}
          cy={px(to(leg.hip).y)}
          r={3.6}
          {...cast}
        />
      ))}
    </g>
  )

  const torso = (
    <>
      <g data-spine>
        {pose.spine.map((vertebra, index) => (
          <g key={index} data-vertebra={index}>
            {index > 0 && <path d={link(pose.spine[index - 1], vertebra, 1.8)} {...cast} />}
            <path d={box(vertebra, 2.8, 1.4, 2.4)} {...machined} />
          </g>
        ))}
      </g>

      <g data-ribcage>
        {body.ribs.map((rib) => (
          <g key={rib.index} data-rib={rib.index}>
            {[rib.left, rib.right].map((arc, half) => (
              <path key={half} d={trace3(arc, false)} {...hoopPaint} />
            ))}
          </g>
        ))}
      </g>

      <g data-chest>
        <path d={link(body.sternum[0], body.sternum[1], panelled ? 8 : 3.2)} {...(panelled ? shell : machined)} />
        {/* The core: it opens with the breath, because the cage it sits in does. */}
        <circle
          data-core
          cx={px(to(midpoint(body.sternum[0], body.sternum[1])).x)}
          cy={px(to(midpoint(body.sternum[0], body.sternum[1])).y)}
          r={px(3 + posed.breath * 1.6)}
          fill={palette.accent}
          fillOpacity={px(0.5 + posed.breath * 0.5)}
        />
      </g>

      <g data-shoulders>
        <path d={link(pose.arms[0].shoulder, pose.arms[1].shoulder, panelled ? 4.4 : 2.8)} {...machined} />
        {pose.arms.map((arm) => (
          <circle
            key={arm.side}
            data-joint={`${arm.side}-shoulder`}
            cx={px(to(arm.shoulder).x)}
            cy={px(to(arm.shoulder).y)}
            r={panelled ? 4.6 : 3.8}
            {...cast}
          />
        ))}
      </g>
    </>
  )

  /* ---------------------------------------------------------- the balance */

  const onFloor = (point: Vec2): Vec3 => ({ x: point.x, y: 0, z: point.y })
  /**
   * The polygon lies on the floor, so it belongs under the feet that hold it;
   * the weight and its plumb line are a readout about the whole machine, so
   * they belong over it. Drawing both at one end gets one of them wrong —
   * either dashes cutting across the boots, or a plumb line sawn in half by
   * the chest plate.
   */
  const supportLayer = showBalance && (
    <g data-balance="support">
      {body.balance.support.length > 0 && (
        /* Mid-stride the polygon narrows to one foot, and at toe-off to a line
           across the toes. It is drawn as whatever it actually is rather than
           padded out to look like a base. */
        <path
          data-support
          d={trace3(body.balance.support.map(onFloor), body.balance.support.length > 2)}
          fill={body.balance.support.length > 2 ? palette.accent : "none"}
          fillOpacity={0.14}
          stroke={body.balance.stable ? palette.accent : palette.dark}
          strokeWidth={1.2}
          strokeDasharray="3 3"
        />
      )}
    </g>
  )

  const weightLayer = showBalance && (
    <g data-balance="weight">
      <path
        data-plumb
        d={trace3([body.balance.com, onFloor(body.balance.ground)], false)}
        fill="none"
        stroke={body.balance.stable ? palette.accent : palette.dark}
        strokeWidth={0.9}
        strokeDasharray="2 3"
        opacity={0.8}
      />
      <circle
        data-com
        cx={px(to(body.balance.com).x)}
        cy={px(to(body.balance.com).y)}
        r={3.4}
        fill="none"
        stroke={body.balance.stable ? palette.accent : palette.dark}
        strokeWidth={1.6}
      />
    </g>
  )

  /* ------------------------------------------------------------- assembly */

  /**
   * Draw order is the camera's, not a fixed list. An arm is placed by whichever
   * of its shoulder and its wrist is nearest, so a hand reaching out in front
   * passes in front of the chest instead of being painted into the rib cage;
   * and in plan view, where depth *is* height, the head comes out on top of the
   * legs by itself. Ties keep the original order, so a pure elevation — where
   * left and right sit at exactly the same depth — draws as it always did.
   */
  const pieces: Array<{ key: string; depth: number; node: React.ReactNode }> = [
    ...pose.legs.map((leg) => ({
      key: `leg-${leg.side}`,
      depth: depthOf(leg.ankle),
      node: legPart(leg),
    })),
    ...pose.arms.map((arm) => ({
      key: `arm-${arm.side}`,
      depth: Math.max(depthOf(arm.shoulder), depthOf(arm.wrist)),
      node: armPart(arm),
    })),
    { key: "torso", depth: depthOf(body.sternum[1]), node: torso },
    {
      key: "head",
      // The skull is a solid, so its centre is the wrong point to sort on: the
      // camera is linear, so the nearest point of the ellipsoid is its centre
      // plus the radii projected onto the view direction. Sorting on the centre
      // puts the chest plate over the jaw.
      depth:
        depthOf(centreOfHead) +
        Math.abs(worldRadii.x * toCamera.x) +
        Math.abs(worldRadii.y * toCamera.y) +
        Math.abs(worldRadii.z * toCamera.z),
      node: head,
    },
  ]
  const ordered = pieces
    .map((piece, order) => ({ piece, order }))
    .sort((a, b) => a.piece.depth - b.piece.depth || a.order - b.order)
    .map(({ piece }) => piece)

  const headYaw = Math.round(headPose.yaw)
  const margin = Number.isFinite(body.balance.margin) ? Math.round(body.balance.margin) : 0
  const readout = `${routine.toUpperCase()} / ${headYaw > 0 ? `${headYaw}° LEFT` : headYaw < 0 ? `${-headYaw}° RIGHT` : "AHEAD"} / ${body.balance.stable ? `MARGIN ${margin}` : "OFF SUPPORT"}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Animatronic robot, ${routine} routine, looking ${headYaw === 0 ? "straight ahead" : `${Math.abs(headYaw)} degrees to its ${headYaw > 0 ? "left" : "right"}`}, ${body.balance.stable ? "weight over its feet" : "weight outside its support"}, ${viewNames[view] ?? viewNames[NATIVE_VIEW]}`
      }
      aria-valuemin={interactive ? -90 : undefined}
      aria-valuemax={interactive ? 90 : undefined}
      aria-valuenow={interactive ? headYaw : undefined}
      aria-valuetext={
        interactive
          ? headYaw === 0
            ? "looking straight ahead"
            : `looking ${Math.abs(headYaw)} degrees to its ${headYaw > 0 ? "left" : "right"}`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const here = target ?? { x: 0, y: 0 }
        const step = arrowStep(event.key, 0.12, 0.4)
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          apply({ x: here.x + (event.key === "ArrowLeft" ? -0.12 : 0.12), y: here.y })
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          apply({ x: here.x, y: here.y + (event.key === "ArrowUp" ? 0.12 : -0.12) })
        } else if (step !== 0) {
          apply({ x: here.x + step, y: here.y })
        } else if (event.key === "Home") {
          apply({ x: 0, y: 0 })
        } else if (event.key === "End") {
          // Hand it back to the routine.
          apply(null)
        } else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) apply(null)
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
      data-view={view}
      {...props}
    >
      <g
        data-animatronic
        transform={`translate(${origin.x} ${origin.y}) scale(${px(SCALE * fit)})`}
      >
        {showGround && (
          /* The floor is a disc in the floor plane, projected — not an ellipse
             typed to look like one. A fixed ellipse at the origin stops short
             of a foot whose toe is 30 units out, which reads as the machine
             standing through its own shadow. */
          <path
            data-ground
            d={trace3(circleFootprint(0, 0, 44, 48).map(onFloor))}
            fill={palette.dark}
            opacity={px(pose.grounded ? 0.14 : 0.06)}
          />
        )}
        {supportLayer}

        {pelvis}
        {ordered.map((piece) => (
          <React.Fragment key={piece.key}>{piece.node}</React.Fragment>
        ))}

        {weightLayer}

        {variant === "blueprint" && (
          <path
            d={trace3(
              [
                { x: -52, y: 0, z: 0 },
                { x: 52, y: 0, z: 0 },
              ],
              false,
            )}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.4}
            strokeDasharray="2 3"
            opacity={0.7}
          />
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        {showReadout && (
          <text x={VIEW_WIDTH / 2} y={281} fontSize={5}>
            {readout}
          </text>
        )}
        {label && (
          <text x={VIEW_WIDTH / 2} y={291} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/**
 * Where a look in −1..1 sits in the body frame, for a machine that reaches for
 * what it is watching: out in front, up with the look, and across with it.
 */
/** Where the hands sit with nothing to reach for: below the machine, so both
 *  arms clamp to their own reach and hang nearly straight down. */
const REST_REACH: Vec3 = { x: 0, y: -30, z: -6 }

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => {
  const k = clamp(t, 0, 1)
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
  }
}

function aimedReach(target: Vec2, side: -1 | 1): Vec3 {
  // Both hands go out toward the point, but each stays on its own side of the
  // machine — two hands offered, not two hands meeting in the middle.
  return {
    x: side * 19 + clamp(target.x, -1, 1) * 24,
    y: 116 + clamp(target.y, -1, 1) * 30,
    z: -44,
  }
}

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})

function resolveExpression(
  supplied: FaceExpression | FaceChannels | undefined,
  fallback: FaceChannels,
): FaceChannels {
  if (!supplied) return fallback
  if (typeof supplied === "string") return faceShape(supplied)
  return supplied
}

/** A caller's own servo values, applied last — these win outright. */
function withChannels<T extends FaceChannels>(
  solution: T,
  channels: Partial<FaceChannels> & { left?: Partial<FaceSide>; right?: Partial<FaceSide> },
): T {
  return {
    ...solution,
    ...channels,
    left: { ...solution.left, ...channels.left },
    right: { ...solution.right, ...channels.right },
  }
}

export { AnimatronicRobot }
