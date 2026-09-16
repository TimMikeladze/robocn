/**
 * robocn — the whole animatronic: one intent, one body, one balance.
 *
 * World axes follow `skeleton.ts`: `x` the machine's right, `y` up, `z` behind
 * it. The machine faces `-z` and the floor is `y = 0`.
 *
 * Three things live here that the part-solvers deliberately do not have.
 *
 * **An intent.** A humanoid's behaviour is not a scalar. Looking at something
 * moves the eyes, the neck and the waist; talking moves the jaw, the head and
 * the hands; reaching shifts the weight first. So a routine returns an
 * `AnimatronicIntent` — the whole body's demand at an instant — and every field
 * of it is also a prop, which is what makes the machine posable.
 *
 * **An attention cascade.** `solveAttention` splits a demand across the eyes,
 * the neck and the waist, each taking only what the one before it could not
 * reach. That is what reads as looking at someone rather than as three sliders.
 *
 * **Balance.** `centreOfMass` sums segment masses at their own centres;
 * `supportPolygon` is the hull of the feet actually on the floor;
 * `balanceOf` reports the signed margin between the two. `balanceRoll` is the
 * roll about the support centroid that puts the plumb line back inside it, and
 * `solveAnimatronic` applies it as a **rigid** rotation — every bone the same
 * length after as before, the planted foot where it was.
 *
 * What this is not: dynamics. Nothing here integrates a mass, computes a ground
 * reaction or decides whether the machine falls. It measures where the weight
 * is and moves the posture toward the support; that is the whole claim.
 */

import {
  blendFace,
  faceShape,
  type FaceChannels,
  type FaceExpression,
  type FaceSolution,
  type HeadGeometry,
  type HeadPose,
  defaultHeadGeometry,
  solveFace,
} from "@/lib/robocn/face"
import { solveHand, type HandGrasp, type HandPose } from "@/lib/robocn/hand"
import {
  clamp,
  convexHull2,
  lerp,
  solveChain3,
  toDegrees,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  solveSkeleton,
  type SkeletonArm,
  type SkeletonGait,
  type SkeletonLeg,
  type SkeletonPose,
  type SkeletonProportions,
} from "@/lib/robocn/skeleton"

const finite = (value: number | undefined | null, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const unit = (value: number | undefined, fallback = 0) => clamp(finite(value, fallback), 0, 1)
const signed = (value: number | undefined, fallback = 0) => clamp(finite(value, fallback), -1, 1)
const wrap = (value: number) => {
  const t = finite(value)
  return ((t % 1) + 1) % 1
}

/* ------------------------------------------------------------------ routines */

/** What the machine does with nobody driving it. */
export type AnimatronicRoutine =
  | "idle"
  | "greet"
  | "present"
  | "inspect"
  | "converse"
  | "walk"
  | "static"

export const animatronicRoutines: readonly AnimatronicRoutine[] = [
  "idle",
  "greet",
  "present",
  "inspect",
  "converse",
  "walk",
  "static",
]

/**
 * The whole body's demand at one instant. Every field is also a prop on the
 * component: supply one and it wins over the routine.
 */
export interface AnimatronicIntent {
  gait: SkeletonGait
  /** Gait cycle fraction, 0..1. */
  cycle: number
  /** Hip height, 0 crouched to 1 standing tall. */
  stance: number
  stride: number
  lift: number
  /** Whole-column pitch in degrees, positive leaning forward. */
  lean: number
  /** Shoulders against the pelvis in degrees. */
  twist: number
  /** Neck angles in degrees, on top of whatever the spine is doing. */
  neckYaw: number
  neckPitch: number
  neckRoll: number
  /** Pupil aim, −1..1 on both axes. */
  look: Vec2
  /** A point both hands reach for, in the body frame. Null leaves them swinging. */
  reach: Vec3 | null
  /**
   * A point one hand reaches for, which wins over `reach` for that side. This
   * is what a wave is: `solveSkeleton` only takes a target both arms share, so
   * without a per-side target every reaching pose comes out with the hands
   * clasped in front of the machine.
   */
  reachLeft: Vec3 | null
  reachRight: Vec3 | null
  /** The face rig's channel vector — already blended, never an expression name. */
  expression: FaceChannels
  intensity: number
  blink: number
  speech: number
  /** Chest expansion, 0 emptied to 1 filled. */
  breath: number
  grasp: HandGrasp
  grip: number
  /** How hard the machine works to keep its weight over its feet, 0..1. */
  effort: number
}

/** A machine that is switched on but doing nothing. */
export const restIntent: AnimatronicIntent = {
  gait: "stand",
  cycle: 0,
  stance: 1,
  stride: 0.7,
  lift: 0.6,
  lean: 0,
  twist: 0,
  neckYaw: 0,
  neckPitch: 0,
  neckRoll: 0,
  look: { x: 0, y: 0 },
  reach: null,
  reachLeft: null,
  reachRight: null,
  expression: faceShape("neutral"),
  intensity: 1,
  blink: 0,
  speech: 0,
  breath: 0.35,
  grasp: "open",
  grip: 0.22,
  effort: 1,
}

/**
 * A blink is a spike, not a wave: long stretches open, then a fast close and a
 * slower open. Two coprime rates so a row of machines never blinks in unison.
 */
export function animatronicBlink(clock: number): number {
  const t = finite(clock)
  const beat = ((t * 0.43) % 1 + 1) % 1
  const second = ((t * 0.31 + 0.37) % 1 + 1) % 1
  const spike = (u: number) => {
    if (u > 0.12) return 0
    const k = u / 0.12
    return k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6
  }
  return clamp(Math.max(spike(beat), spike(second)), 0, 1)
}

/** Breathing: a quick fill and a longer empty, which is the shape of a breath. */
export function animatronicBreath(clock: number, rate = 0.23): number {
  const u = ((finite(clock) * rate) % 1 + 1) % 1
  return u < 0.38
    ? (1 - Math.cos((u / 0.38) * Math.PI)) / 2
    : (1 + Math.cos(((u - 0.38) / 0.62) * Math.PI)) / 2
}

const parade: FaceExpression[] = ["joy", "surprise", "doubt", "neutral", "sorrow", "anger"]

/**
 * The self-control loop: a routine, a clock, and the whole body's demand out
 * the other side. Pure, so it is tested by sampling rather than by faking
 * animation frames.
 */
export function routineIntent(
  routine: AnimatronicRoutine,
  clock: number,
): AnimatronicIntent {
  const t = finite(clock)
  if (routine === "static") return { ...restIntent, expression: faceShape("neutral") }
  const turn = t * Math.PI * 2
  const breath = animatronicBreath(t)
  const blink = animatronicBlink(t)
  // Breathing is a posture as well as a chest: the column rises a little on the
  // fill and the shoulders come back.
  const carried = (breath - 0.5) * 2

  switch (routine) {
    case "greet": {
      // One arm up and across, held at the top, and the whole body turned a
      // little toward whoever it is greeting.
      const beat = wrap(t * 0.5)
      const raise = beat < 0.25 ? beat / 0.25 : beat < 0.75 ? 1 : 1 - (beat - 0.75) / 0.25
      const eased = (1 - Math.cos(clamp(raise, 0, 1) * Math.PI)) / 2
      const wave = Math.sin(turn * 2.4) * eased
      return {
        ...restIntent,
        gait: "stand",
        cycle: wrap(t * 0.5),
        stance: 1,
        lean: 2 + carried * 0.8,
        twist: 8 * eased + wave * 4,
        neckYaw: -6 * eased + wave * 2,
        neckPitch: 3 * eased,
        neckRoll: wave * 4,
        look: { x: -0.25 * eased + wave * 0.12, y: 0.1 },
        // One arm, not two: a wave is the left hand up beside the head while
        // the right stays where it hangs.
        reachLeft: { x: -30 - wave * 10, y: 150 + eased * 18, z: -18 - eased * 10 },
        expression: blendFace(faceShape("neutral"), faceShape("joy"), 0.35 + eased * 0.45),
        blink,
        breath,
        grasp: "open",
        grip: 0.08,
        effort: 1,
      }
    }
    case "present": {
      // Both hands out, palms up, offering the thing in front of it.
      const swing = Math.sin(turn * 0.31)
      const open = 0.55 + 0.45 * Math.sin(turn * 0.23)
      return {
        ...restIntent,
        gait: "stand",
        stance: 0.96,
        lean: 4 + carried,
        twist: swing * 5,
        neckPitch: -7 + carried * 2,
        neckYaw: swing * 4,
        look: { x: swing * 0.18, y: -0.35 },
        // Apart, palms up: two hands offering something, not two hands clasped.
        reachLeft: { x: -20 + swing * 5, y: 116 + open * 10, z: -40 - open * 14 },
        reachRight: { x: 20 + swing * 5, y: 116 + open * 10, z: -40 - open * 14 },
        expression: blendFace(faceShape("neutral"), faceShape("joy"), 0.22),
        blink,
        breath,
        grasp: "open",
        grip: 0.12,
        effort: 1,
      }
    }
    case "inspect": {
      // Weight onto one foot, turned down and in toward whatever it is holding.
      const scan = Math.sin(turn * 0.37)
      const close = (1 + Math.sin(turn * 0.53)) / 2
      return {
        ...restIntent,
        gait: "stand",
        stance: 0.82,
        lean: 11 + carried,
        twist: 12 + scan * 9,
        neckPitch: -16 + scan * 4,
        neckYaw: 8 + scan * 6,
        neckRoll: scan * 5,
        look: { x: 0.2 + scan * 0.2, y: -0.55 },
        // Held in front of it and turned over, but still two hands: a shared
        // target would put both arms on one point and through the chest.
        reachLeft: { x: -9 + scan * 4, y: 110, z: -46 },
        reachRight: { x: 11 + scan * 4, y: 108, z: -44 },
        expression: blendFace(faceShape("neutral"), faceShape("doubt"), 0.45),
        blink: blink * 0.7,
        breath,
        grasp: "tripod",
        grip: 0.35 + close * 0.45,
        effort: 1,
      }
    }
    case "converse": {
      // Syllables riding a phrase envelope, and the hands beating with them —
      // a talking machine that keeps its arms still reads as dubbed.
      const phrase = Math.max(0, Math.sin(turn * 0.37))
      const syllable = Math.abs(Math.sin(turn * 3.1)) * 0.7 + Math.abs(Math.sin(turn * 4.7)) * 0.3
      const speech = phrase * syllable
      const beat = Math.sin(turn * 1.6) * phrase
      return {
        ...restIntent,
        gait: "stand",
        stance: 0.99,
        lean: 3 + carried * 0.6 + phrase * 1.5,
        twist: Math.sin(turn * 0.29) * 7,
        neckYaw: Math.sin(turn * 0.33) * 10,
        neckPitch: Math.sin(turn * 0.74) * 5 - phrase * 3,
        neckRoll: Math.sin(turn * 0.21) * 4,
        look: { x: Math.sin(turn * 0.61) * 0.35, y: Math.sin(turn * 0.29) * 0.2 },
        // The hands beat out of phase with each other, which is what a talking
        // pair of hands does; together they would read as a conductor.
        reachLeft: { x: -22 + beat * 10, y: 122 + beat * 12, z: -30 - phrase * 10 },
        reachRight: { x: 22 + beat * 10, y: 122 - beat * 12, z: -30 - phrase * 8 },
        expression: blendFace(
          faceShape("neutral"),
          faceShape("joy"),
          0.25 + Math.sin(turn * 0.5) * 0.15,
        ),
        blink,
        speech,
        breath: Math.max(breath, phrase * 0.7),
        grasp: "open",
        grip: 0.18,
        effort: 1,
      }
    }
    case "walk":
      return {
        ...restIntent,
        gait: "walk",
        cycle: wrap(t),
        stance: 1,
        stride: 0.78,
        lift: 0.62,
        lean: 5,
        twist: 0,
        neckPitch: -2,
        look: { x: 0, y: -0.12 },
        reach: null,
        expression: blendFace(faceShape("neutral"), faceShape("joy"), 0.12),
        blink,
        breath: animatronicBreath(t, 0.5),
        grasp: "open",
        grip: 0.28,
        effort: 1,
      }
    default: {
      // Idle is never quite still: a dead-still machine reads as switched off.
      // Weight drifts from foot to foot, the eyes flick and hold.
      const drift = Math.sin(turn * 0.19)
      return {
        ...restIntent,
        gait: "stand",
        stance: 0.99 - Math.abs(drift) * 0.03,
        lean: 2.5 + carried * 1.2,
        twist: drift * 6,
        neckYaw: Math.sin(turn * 0.23) * 7 + drift * 3,
        neckPitch: Math.sin(turn * 0.41) * 3 + carried * 1.5,
        neckRoll: Math.sin(turn * 0.17) * 3,
        look: {
          x: Math.sin(turn * 0.31) * 0.35 + Math.sin(turn * 1.7) * 0.08,
          y: Math.sin(turn * 0.47) * 0.22,
        },
        reach: null,
        expression: blendFace(
          faceShape("neutral"),
          faceShape("joy"),
          0.16 + Math.sin(turn * 0.27) * 0.1,
        ),
        blink,
        breath,
        grasp: "open",
        grip: 0.22,
        effort: 1,
      }
    }
  }
}

const mixVec2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
})

const mixVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
})

/**
 * Cross-fade two intents. A routine change eases through this rather than
 * snapping, and so does a released drag returning to what the routine has
 * moved on to. The discrete fields — the gait, the grasp — take whichever side
 * the fade is past halfway to; there is no halfway between a walk and a stand.
 */
export function blendIntent(a: AnimatronicIntent, b: AnimatronicIntent, t: number): AnimatronicIntent {
  const k = unit(t)
  const past = k >= 0.5
  const fadeReach = (from: Vec3 | null, to: Vec3 | null) =>
    from && to ? mixVec3(from, to, k) : from ? (k < 1 ? from : null) : to ? (k > 0 ? to : null) : null
  const reach = fadeReach(a.reach, b.reach)
  return {
    gait: past ? b.gait : a.gait,
    // The cycle is a phase, so it crossfades only within one gait; across a
    // change it belongs to whichever gait won.
    cycle: a.gait === b.gait ? wrap(lerp(a.cycle, b.cycle, k)) : past ? b.cycle : a.cycle,
    stance: lerp(a.stance, b.stance, k),
    stride: lerp(a.stride, b.stride, k),
    lift: lerp(a.lift, b.lift, k),
    lean: lerp(a.lean, b.lean, k),
    twist: lerp(a.twist, b.twist, k),
    neckYaw: lerp(a.neckYaw, b.neckYaw, k),
    neckPitch: lerp(a.neckPitch, b.neckPitch, k),
    neckRoll: lerp(a.neckRoll, b.neckRoll, k),
    look: mixVec2(a.look, b.look, k),
    reach,
    reachLeft: fadeReach(a.reachLeft, b.reachLeft),
    reachRight: fadeReach(a.reachRight, b.reachRight),
    expression: blendFace(a.expression, b.expression, k),
    intensity: lerp(a.intensity, b.intensity, k),
    blink: lerp(a.blink, b.blink, k),
    speech: lerp(a.speech, b.speech, k),
    breath: lerp(a.breath, b.breath, k),
    grasp: past ? b.grasp : a.grasp,
    grip: lerp(a.grip, b.grip, k),
    effort: lerp(a.effort, b.effort, k),
  }
}

/* ----------------------------------------------------------------- attention */

/**
 * How much of a look each stage of the chain can take, before the next one has
 * to help. Eyes are fastest and cheapest, the waist is slowest and dearest, so
 * they are spent in that order.
 */
export const attentionShare = {
  eyeYaw: 30,
  eyePitch: 22,
  neckYaw: 34,
  neckPitch: 22,
  neckRoll: 10,
  waistTwist: 22,
  waistLean: 10,
} as const

export interface Attention {
  /** Pupil aim, −1..1, which is the eyes' own share of the demand. */
  look: Vec2
  neckYaw: number
  neckPitch: number
  neckRoll: number
  twist: number
  lean: number
  /** Total demand actually met, in degrees, against what was asked. */
  demand: Vec2
  /** False when even the waist ran out and the machine cannot see the target. */
  reached: boolean
}

/** Nothing to look at. */
export const restAttention: Attention = {
  look: { x: 0, y: 0 },
  neckYaw: 0,
  neckPitch: 0,
  neckRoll: 0,
  twist: 0,
  lean: 0,
  demand: { x: 0, y: 0 },
  reached: true,
}

/**
 * Split a look across the eyes, the neck and the waist.
 *
 * `target` is −1..1 on both axes, where 1 is as far as the machine is ever
 * asked to look: `x` to its left on screen, `y` up. Each stage takes what it
 * can of the remaining angle and passes the rest on, so a small look is pure
 * eyes, a larger one turns the head, and only a look over the shoulder costs a
 * twist. `effort` scales how willingly the later stages join in — a lazy
 * machine leaves it to the eyes.
 */
export function solveAttention(target: Vec2 | null, effort = 1): Attention {
  if (!target) return restAttention
  const gain = unit(effort, 1)
  const ax = signed(target.x)
  const ay = signed(target.y)
  // The full-scale demand in degrees: everything the chain could give.
  const spanYaw = attentionShare.eyeYaw + attentionShare.neckYaw + attentionShare.waistTwist
  const spanPitch = attentionShare.eyePitch + attentionShare.neckPitch + attentionShare.waistLean
  const demandYaw = ax * spanYaw
  const demandPitch = ay * spanPitch

  const take = (remaining: number, limit: number) => {
    const taken = clamp(remaining, -limit, limit)
    return [taken, remaining - taken] as const
  }

  // Eyes first, at full authority; the later stages are scaled by effort, so a
  // half-hearted look stays in the eyes.
  const [eyeYaw, afterEyeYaw] = take(demandYaw, attentionShare.eyeYaw)
  const [eyePitch, afterEyePitch] = take(demandPitch, attentionShare.eyePitch)
  const [neckYaw, afterNeckYaw] = take(afterEyeYaw * gain, attentionShare.neckYaw)
  const [neckPitch, afterNeckPitch] = take(afterEyePitch * gain, attentionShare.neckPitch)
  const [twist, leftYaw] = take(afterNeckYaw, attentionShare.waistTwist)
  const [lean, leftPitch] = take(afterNeckPitch, attentionShare.waistLean)

  return {
    look: {
      x: clamp(eyeYaw / attentionShare.eyeYaw, -1, 1),
      y: clamp(eyePitch / attentionShare.eyePitch, -1, 1),
    },
    neckYaw,
    neckPitch,
    // A head turning far tips a little with the turn, the way a real neck does.
    neckRoll: clamp((neckYaw / attentionShare.neckYaw) * attentionShare.neckRoll * 0.5, -attentionShare.neckRoll, attentionShare.neckRoll),
    twist,
    // Leaning forward to see something low is positive lean on the spine.
    lean: -lean,
    demand: { x: demandYaw, y: demandPitch },
    reached: Math.abs(leftYaw) < 1e-6 && Math.abs(leftPitch) < 1e-6,
  }
}

/* ------------------------------------------------------------------- balance */

/**
 * Segment masses as fractions of body mass (Winter), and where along each
 * segment its own centre of mass sits, measured from the proximal joint. These
 * sum to 1, which the test holds them to.
 */
export const segmentMass = {
  head: 0.081,
  trunk: 0.497,
  upperArm: 0.028,
  forearm: 0.022,
  thigh: 0.1,
  shank: 0.0465,
  foot: 0.0145,
} as const

export const segmentCentre = {
  trunk: 0.5,
  upperArm: 0.436,
  forearm: 0.682,
  thigh: 0.433,
  shank: 0.433,
} as const

const along = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})

/**
 * Where the machine's weight is. Each segment contributes its own mass at its
 * own centre — not at a joint, which is the mistake that puts the COM of a
 * raised arm in the wrong place entirely.
 */
export function centreOfMass(pose: SkeletonPose): Vec3 {
  let mass = 0
  let x = 0
  let y = 0
  let z = 0
  const add = (point: Vec3, m: number) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return
    mass += m
    x += point.x * m
    y += point.y * m
    z += point.z * m
  }

  add(pose.head, segmentMass.head)
  add(along(pose.pelvis, pose.shoulders, segmentCentre.trunk), segmentMass.trunk)
  for (const arm of pose.arms) {
    add(along(arm.shoulder, arm.elbow, segmentCentre.upperArm), segmentMass.upperArm)
    add(along(arm.elbow, arm.wrist, segmentCentre.forearm), segmentMass.forearm)
  }
  for (const leg of pose.legs) {
    add(along(leg.hip, leg.knee, segmentCentre.thigh), segmentMass.thigh)
    add(along(leg.knee, leg.ankle, segmentCentre.shank), segmentMass.shank)
    add(leg.ball, segmentMass.foot)
  }
  if (mass <= 0) return { x: 0, y: 0, z: 0 }
  return { x: x / mass, y: y / mass, z: z / mass }
}

/** Half the width of a foot, in world units, for the footprint it leaves. */
export const footHalfWidth = 5.5

/**
 * The footprint one foot puts on the floor, in ground-plane coordinates
 * (`{x, y}` is world `{x, z}`). Only the part of the sole that is down counts:
 * at toe-off that is the toe alone, which is what narrows the polygon exactly
 * when a walking machine is least stable.
 */
export function footPolygon(leg: SkeletonLeg, halfWidth = footHalfWidth): Vec2[] {
  if (!(leg.contact > 0)) return []
  const w = Math.abs(finite(halfWidth, footHalfWidth))
  // The roll tells which of heel, ball and toe are actually loaded. A foot at
  // toe-off supports on the toe alone, which is what narrows the polygon
  // exactly when a walking machine is least stable.
  const loaded: Vec3[] = []
  if (leg.roll.heelLoad > 0.01) loaded.push(leg.heel)
  if (leg.roll.ballLoad > 0.01) loaded.push(leg.ball)
  if (leg.roll.toeLoad > 0.01) loaded.push(leg.toe)
  if (loaded.length === 0) loaded.push(leg.ball)
  return loaded.flatMap((point) => [
    { x: point.x - w, y: point.z },
    { x: point.x + w, y: point.z },
  ])
}

/**
 * The polygon the machine is allowed to keep its weight inside: the convex hull
 * of every loaded footprint. A foot in swing contributes nothing, which is why
 * this shrinks to one foot in mid-stride and vanishes in the flight phase of a
 * run.
 */
export function supportPolygon(pose: SkeletonPose, halfWidth = footHalfWidth): Vec2[] {
  const points = pose.legs.flatMap((leg) => footPolygon(leg, halfWidth))
  if (points.length < 3) return points
  return convexHull2(points)
}

const centroid = (polygon: readonly Vec2[]): Vec2 => {
  if (polygon.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const point of polygon) {
    x += point.x
    y += point.y
  }
  return { x: x / polygon.length, y: y / polygon.length }
}

const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared > 0 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1) : 0
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

const insidePolygon = (p: Vec2, polygon: readonly Vec2[]) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Signed distance from a point to a polygon: positive inside, negative outside,
 * in the polygon's own units. This is the margin the machine has left.
 */
export function polygonMargin(point: Vec2, polygon: readonly Vec2[]): number {
  if (polygon.length === 0) return Number.NEGATIVE_INFINITY
  if (polygon.length === 1) return -Math.hypot(point.x - polygon[0].x, point.y - polygon[0].y)
  let nearest = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    nearest = Math.min(nearest, distanceToSegment(point, polygon[j], polygon[i]))
  }
  return insidePolygon(point, polygon) ? nearest : -nearest
}

export interface Balance {
  /** The whole machine's centre of mass, in world units. */
  com: Vec3
  /** Its plumb line's footprint on the floor, in ground coordinates. */
  ground: Vec2
  support: Vec2[]
  /** Centre of the support polygon — where the weight would ideally sit. */
  centre: Vec2
  /** Signed distance from the plumb line to the polygon. Positive is inside. */
  margin: number
  stable: boolean
}

export function balanceOf(pose: SkeletonPose, halfWidth = footHalfWidth): Balance {
  const com = centreOfMass(pose)
  const support = supportPolygon(pose, halfWidth)
  const ground: Vec2 = { x: com.x, y: com.z }
  const margin = polygonMargin(ground, support)
  return {
    com,
    ground,
    support,
    centre: centroid(support),
    margin,
    stable: margin > 0,
  }
}

/** The most an animatronic waist will lean sideways to save itself. */
export const balanceRollLimit = 13

/**
 * The roll about the support centroid that puts the plumb line over it.
 *
 * The pivot is the centroid on the floor; the machine is a rigid body above it,
 * so the angle to swing through is the one the COM's plumb line already makes
 * with the vertical over that pivot. Standing on two feet the COM is already
 * between them and this is near zero, which is the property that makes it safe
 * to apply unconditionally.
 */
export function balanceRoll(
  pose: SkeletonPose,
  effort = 1,
  halfWidth = footHalfWidth,
): number {
  const balance = balanceOf(pose, halfWidth)
  if (balance.support.length === 0) return 0
  const dx = balance.com.x - balance.centre.x
  const dy = balance.com.y
  if (!(dy > 1e-6)) return 0
  const lean = toDegrees(Math.atan2(dx, dy))
  return clamp(-lean * unit(effort, 1), -balanceRollLimit, balanceRollLimit)
}

/**
 * Roll a point about the `z` axis through a pivot on the floor. Rigid: every
 * distance between rolled points is unchanged, which is what lets the whole
 * machine go through it without a bone stretching.
 */
export function rollAbout(point: Vec3, pivot: Vec2, degrees: number): Vec3 {
  const angle = toRadians(finite(degrees))
  if (angle === 0) return point
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const x = finite(point.x) - pivot.x
  const y = finite(point.y) - pivot.y
  return {
    x: pivot.x + x * c - y * s,
    y: pivot.y + x * s + y * c,
    z: finite(point.z),
  }
}

/* ------------------------------------------------------------------- ribcage */

export interface RibOptions {
  count?: number
  /** Where the cage sits on the column, as spine fractions. */
  from?: number
  to?: number
  /** Half-width and half-depth of the widest hoop, unbreathed. */
  width?: number
  depth?: number
  /**
   * How far forward of the vertebra the hoop's centre sits. A cage centred on
   * the spine puts as much of itself behind the machine's back as in front of
   * its chest; a real one hangs forward, with the column at its back.
   */
  front?: number
  /** Chest expansion, 0 emptied to 1 filled. */
  breath?: number
  /** Shoulder rotation against the pelvis, in degrees. */
  twist?: number
}

export interface Rib {
  index: number
  left: Vec3[]
  right: Vec3[]
  /** The point on the sternum this pair meets at. */
  front: Vec3
  /** 1 for a floating rib at the bottom of the cage, 0 for an attached one. */
  floating: number
}

/** A point along a spine given as a fraction of its length. */
export function spineAt(spine: readonly Vec3[], fraction: number): Vec3 {
  if (spine.length === 0) return { x: 0, y: 0, z: 0 }
  if (spine.length === 1) return spine[0]
  const t = clamp(finite(fraction), 0, 1) * (spine.length - 1)
  const i = Math.min(spine.length - 2, Math.floor(t))
  const f = t - i
  return along(spine[i], spine[i + 1], f)
}

/**
 * Hoops hung off the thoracic vertebrae, drawn in the transverse plane so they
 * foreshorten into the ellipses a cage actually makes from a raised camera.
 * `breath` opens them along the machine's depth more than across its width,
 * which is the direction a pump moves a cage.
 */
export function ribCage(spine: readonly Vec3[], options: RibOptions = {}): Rib[] {
  const count = Math.max(3, Math.min(12, Math.round(finite(options.count, 7))))
  const from = clamp(finite(options.from, 0.4), 0, 1)
  const to = clamp(finite(options.to, 0.94), 0, 1)
  const width = Math.abs(finite(options.width, 22))
  const depth = Math.abs(finite(options.depth, 15))
  const front = finite(options.front, 0)
  const fill = unit(options.breath, 0)
  const twistDegrees = finite(options.twist, 0)

  return Array.from({ length: count }, (_, index) => {
    const k = index / (count - 1 || 1)
    const at = lerp(from, to, k)
    const centre = spineAt(spine, at)
    const profile = 0.42 + 0.58 * Math.sin(Math.PI * (0.16 + 0.78 * (1 - k)))
    // A breath opens the cage front-to-back about three times as much as it
    // opens it side to side.
    const half = width * profile * (1 + fill * 0.05)
    const deep = depth * profile * (1 + fill * 0.16)
    const floating = clamp((0.24 - k) / 0.24, 0, 1)
    const gap = lerp(0.2, 0.85, floating)
    // The fill also lifts the front of each hoop: the cage rotates up as well
    // as out, which is what makes breathing read from the side.
    const drop = lerp(4.5, 8, floating) * (1 - fill * 0.4)
    const yaw = toRadians(twistDegrees * at)
    const place = (a: number): Vec3 => {
      const x = Math.sin(a) * half
      const z = -Math.cos(a) * deep - front * profile
      return {
        x: centre.x + x * Math.cos(yaw) - z * Math.sin(yaw),
        y: centre.y - drop * (1 - Math.abs(a) / Math.PI),
        z: centre.z + x * Math.sin(yaw) + z * Math.cos(yaw),
      }
    }
    const arc = (sign: number) =>
      Array.from({ length: 11 }, (_, step) => place(lerp(Math.PI * 0.93, gap, step / 10) * sign))
    // The sternum point is the midline the two arcs stop short of — the gap
    // they leave is the thing it bridges, so it is `place(0)` and not the end
    // of either arc, which would sit a rib's width off centre.
    return { index, left: arc(-1), right: arc(1), front: place(0), floating }
  })
}

/* ------------------------------------------------------------------- framing */

/**
 * An orthonormal frame on the end of a limb, plus the scale the part drawn in
 * it is modelled at. `placeIn` takes a point in the part's own coordinates out
 * into the world.
 */
export interface LimbFrame {
  origin: Vec3
  right: Vec3
  up: Vec3
  out: Vec3
  scale: number
}

const norm3 = (v: Vec3, fallback: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-6 ? { x: v.x / length, y: v.y / length, z: v.z / length } : fallback
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

/**
 * Re-solve one arm to a target of its own. `solveSkeleton` takes a single
 * target both arms share, which is right for carrying something and wrong for
 * everything else; this is the per-side override, applied to the pose it
 * returned so the lengths and the shoulder it starts from are unchanged.
 */
export function reachArm(
  arm: SkeletonArm,
  target: Vec3 | null | undefined,
  proportions: SkeletonProportions = defaultProportions,
): SkeletonArm {
  if (!target) return arm
  if (![target.x, target.y, target.z].every(Number.isFinite)) return arm
  const [, elbow, wrist] = solveChain3(
    arm.shoulder,
    target,
    [proportions.humerus, proportions.forearm],
    { up: { x: 0, y: 0, z: 1 } },
  )
  // Forearm heading in the sagittal plane, measured the same way the skeleton
  // solver measures it: degrees from hanging straight down.
  const heading = toDegrees(Math.atan2(wrist.y - elbow.y, -(wrist.z - elbow.z))) + 90
  return { ...arm, elbow, wrist, heading }
}

/**
 * The frame a hand sits in on the end of a forearm: `up` runs out along the
 * forearm, the palm faces the body, and the thumb falls where a hanging hand's
 * does.
 */
export function handFrame(arm: SkeletonArm, scale = 0.26): LimbFrame {
  const sign = arm.side === "right" ? 1 : -1
  const up = norm3(
    { x: arm.wrist.x - arm.elbow.x, y: arm.wrist.y - arm.elbow.y, z: arm.wrist.z - arm.elbow.z },
    { x: 0, y: -1, z: 0 },
  )
  const out: Vec3 = { x: -sign, y: 0, z: 0 }
  const right = norm3(cross3(up, out), { x: 0, y: 0, z: -1 })
  return { origin: arm.wrist, right, up, out, scale: Math.abs(finite(scale, 0.26)) }
}

export function placeIn(frame: LimbFrame, point: Vec3): Vec3 {
  const s = frame.scale
  return {
    x: frame.origin.x + (frame.right.x * point.x + frame.up.x * point.y + frame.out.x * point.z) * s,
    y: frame.origin.y + (frame.right.y * point.x + frame.up.y * point.y + frame.out.y * point.z) * s,
    z: frame.origin.z + (frame.right.z * point.x + frame.up.z * point.y + frame.out.z * point.z) * s,
  }
}

/* --------------------------------------------------------------- the machine */

export interface AnimatronicOptions extends Partial<AnimatronicIntent> {
  /** Correct the posture toward the support polygon. */
  balance?: boolean
  proportions?: SkeletonProportions
  head?: HeadGeometry
  /** Rib hoop count. */
  ribs?: number
  /** The cage's own proportions, if the default does not suit the machine. */
  cage?: Omit<RibOptions, "count" | "breath" | "twist">
  /** How large a hand is against the solver's own units. */
  handScale?: number
}

export interface AnimatronicHand {
  side: "left" | "right"
  pose: HandPose
  frame: LimbFrame
}

export interface AnimatronicBody {
  intent: AnimatronicIntent
  skeleton: SkeletonPose
  ribs: Rib[]
  /** Where the sternum runs, bottom to top. */
  sternum: [Vec3, Vec3]
  face: FaceSolution
  /** Neck rotation for the head, in degrees. */
  headPose: HeadPose
  /** The centre of the skull, in world units. */
  headCentre: Vec3
  hands: AnimatronicHand[]
  balance: Balance
  /** The roll that was applied to save it, in degrees. */
  roll: number
  /**
   * The point on the floor that roll turned about. Anything that needs the
   * machine's own upright frame — a limb's sagittal plane, a foot's sole line —
   * undoes the roll about this and puts it back afterwards.
   */
  pivot: Vec2
}

const rollPose = (pose: SkeletonPose, pivot: Vec2, degrees: number): SkeletonPose => {
  if (degrees === 0) return pose
  const at = (point: Vec3) => rollAbout(point, pivot, degrees)
  return {
    ...pose,
    pelvis: at(pose.pelvis),
    spine: pose.spine.map(at),
    shoulders: at(pose.shoulders),
    neck: at(pose.neck),
    head: at(pose.head),
    legs: pose.legs.map((leg) => ({
      ...leg,
      hip: at(leg.hip),
      knee: at(leg.knee),
      ankle: at(leg.ankle),
      heel: at(leg.heel),
      ball: at(leg.ball),
      toe: at(leg.toe),
    })),
    arms: pose.arms.map((arm) => ({
      ...arm,
      shoulder: at(arm.shoulder),
      elbow: at(arm.elbow),
      wrist: at(arm.wrist),
    })),
  }
}

/**
 * The whole animatronic from one intent: the biped, the cage it breathes with,
 * the head's rig and neck, both hands, and where its weight is standing.
 *
 * With `balance`, the pose is solved, measured, and then rolled rigidly about
 * its own support centroid so the plumb line comes back inside the polygon. The
 * roll is reported, and the balance returned is the one after it.
 */
export function solveAnimatronic(options: AnimatronicOptions = {}): AnimatronicBody {
  const intent: AnimatronicIntent = { ...restIntent, ...options }
  const proportions = options.proportions ?? defaultProportions
  const geometry = options.head ?? defaultHeadGeometry

  const raw = solveSkeleton({
    gait: intent.gait,
    phase: intent.cycle,
    stance: intent.stance,
    stride: intent.stride,
    lift: intent.lift,
    lean: intent.lean,
    twist: intent.twist,
    reach: intent.reach,
    proportions,
  })

  // Per-side reach lands before the balance, not after: a raised arm moves the
  // centre of mass, and a machine that balanced without it would be balancing
  // the wrong body.
  const armed: SkeletonPose =
    intent.reachLeft || intent.reachRight
      ? {
          ...raw,
          arms: raw.arms.map((arm) =>
            reachArm(arm, arm.side === "left" ? intent.reachLeft : intent.reachRight, proportions),
          ),
        }
      : raw

  const before = balanceOf(armed)
  // The pivot is the support centroid **on the floor**, not at the centroid's
  // own depth: rolling about anything above the floor swings the feet as well
  // as the body and undoes the correction.
  const pivot: Vec2 = { x: before.centre.x, y: 0 }
  const wanted = options.balance ? balanceRoll(armed, intent.effort) : 0
  // The correction moves the polygon as well as the weight, so it is measured
  // rather than assumed: a roll that does not help is not taken.
  const corrected = wanted === 0 ? null : rollPose(armed, pivot, wanted)
  const after = corrected ? balanceOf(corrected) : before
  const helps = corrected !== null && after.margin >= before.margin - 1e-9
  const roll = helps ? wanted : 0
  const skeleton = helps && corrected ? corrected : armed
  const balance = helps ? after : before

  const ribs = ribCage(skeleton.spine, {
    ...options.cage,
    count: options.ribs,
    breath: intent.breath,
    twist: skeleton.shoulderYaw,
  })
  const ribFrom = clamp(finite(options.cage?.from, 0.4), 0, 1)
  const attached = ribs.filter((rib) => rib.floating < 0.5)
  const sternum: [Vec3, Vec3] = [
    attached.length ? attached[0].front : spineAt(skeleton.spine, ribFrom),
    attached.length ? attached[attached.length - 1].front : skeleton.shoulders,
  ]

  const face = solveFace(
    {
      expression: intent.expression,
      intensity: intent.intensity,
      gaze: intent.look,
      blink: intent.blink,
      speech: intent.speech,
    },
    geometry,
  )

  // The head's own axes, on top of what the body already carries it through:
  // the column's lean at the top of the spine, the shoulders' twist, and the
  // roll the balance correction put through the whole machine. Folding them in
  // here is what keeps a leaning machine from wearing its head bolted on level.
  const carriedPitch = toDegrees(
    Math.atan2(-(skeleton.neck.z - skeleton.shoulders.z), skeleton.neck.y - skeleton.shoulders.y),
  )
  const headPose: HeadPose = {
    yaw:
      clamp(finite(intent.neckYaw), -attentionShare.neckYaw, attentionShare.neckYaw) +
      finite(skeleton.shoulderYaw),
    pitch:
      clamp(finite(intent.neckPitch), -attentionShare.neckPitch, attentionShare.neckPitch) -
      (Number.isFinite(carriedPitch) ? carriedPitch : 0),
    roll: clamp(finite(intent.neckRoll), -attentionShare.neckRoll * 2, attentionShare.neckRoll * 2) + roll,
  }

  const hands = skeleton.arms.map((arm): AnimatronicHand => ({
    side: arm.side,
    pose: solveHand({ grasp: intent.grasp, curl: intent.grip, side: arm.side }),
    frame: handFrame(arm, options.handScale ?? 0.26),
  }))

  return {
    intent,
    skeleton,
    ribs,
    sternum,
    face,
    headPose,
    headCentre: skeleton.head,
    hands,
    balance,
    roll,
    pivot,
  }
}
