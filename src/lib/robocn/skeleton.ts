/**
 * robocn — biped skeleton kinematics.
 *
 * World axes: `x` the machine's right, `y` up, `z` behind it. The machine
 * faces `-z`, the floor is `y = 0`, and everything is modelled once in that
 * frame so the four camera views are one projection rather than four drawings.
 *
 * The stride is worked in the **body frame**: the pelvis stays at `x = 0` and
 * the feet travel under it, which is why a walk cycle and a treadmill are the
 * same drawing. Per leg, at cycle time `t` with duty factor `d`, the planted
 * foot slides from `+stride/2` to `-stride/2` while `t < d` and then swings
 * back through the air. `run` is a walk with a duty factor below a half — that
 * is the entire difference, and it is what produces the moments with no foot
 * on the floor that `grounded` reports.
 *
 * A foot does not arrive flat, so `footRoll` is the part that carries the
 * weight of the drawing: dorsiflexed at heel strike, flat through mid-stance,
 * plantarflexed with the heel lifted at toe-off, and the load moving from the
 * heel to the ball to the toe as it goes.
 *
 * What none of this is: balance, centre of mass, ground reaction, dynamics.
 * The pelvis height is a number someone typed, not a number that fell out of
 * anything.
 */

import {
  clamp,
  forwardChain2,
  lerp,
  solveChain2,
  solveChain3,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

export type SkeletonGait = "stand" | "walk" | "run" | "march"

export type SkeletonSide = "left" | "right"

export interface SkeletonProportions {
  /** Hip joint height above the floor, standing tall. */
  hip: number
  femur: number
  tibia: number
  /** Ankle joint height above the sole. */
  ankle: number
  /** Ankle forward to the ball of the foot, and ball to toe tip. */
  sole: number
  toe: number
  /** Ankle back to the heel. */
  heel: number
  /** Half the distance between the hip joints. */
  hipSpan: number
  /** Sacrum to the shoulder line, and how many vertebrae carry it. */
  spine: number
  vertebrae: number
  /** Half the distance between the shoulder joints. */
  shoulderSpan: number
  humerus: number
  forearm: number
  /** Shoulder line to the base of the skull, and the skull's own height. */
  neck: number
  skull: number
}

/** The frame every machine in the family starts from. */
export const defaultProportions: SkeletonProportions = {
  hip: 80,
  femur: 44,
  tibia: 42,
  ankle: 7,
  sole: 20,
  toe: 11,
  heel: 10,
  hipSpan: 11,
  spine: 56,
  vertebrae: 7,
  shoulderSpan: 19,
  humerus: 30,
  forearm: 26,
  neck: 9,
  skull: 17,
}

interface GaitGeometry {
  /** Fraction of the cycle each foot spends on the floor. */
  duty: number
  /** Stride length at `stride: 1`, and foot clearance at `lift: 1`. */
  stride: number
  lift: number
  /** How far the pelvis rises between double-support and mid-stance. */
  bounce: number
  /** Peak arm swing, in degrees from hanging. */
  swing: number
}

const gaits: Record<SkeletonGait, GaitGeometry> = {
  stand: { duty: 1, stride: 0, lift: 0, bounce: 0, swing: 0 },
  walk: { duty: 0.62, stride: 34, lift: 12, bounce: 2.4, swing: 22 },
  run: { duty: 0.38, stride: 52, lift: 24, bounce: 6.5, swing: 44 },
  march: { duty: 0.5, stride: 26, lift: 30, bounce: 3.2, swing: 34 },
}

export const gaitGeometry = (gait: SkeletonGait): GaitGeometry =>
  gaits[gait] ?? gaits.stand

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const unit = (value: number | undefined, fallback: number) =>
  clamp(finite(value, fallback), 0, 1)

const wrap = (value: number) =>
  Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0

/**
 * Clockwise rotation in the sagittal plane, which is how a foot plantarflexes
 * and how every machine in this family pitches a piece of its own artwork.
 */
export function rollPoint(point: Vec2, pivot: Vec2, degrees: number): Vec2 {
  const a = toRadians(degrees)
  const c = Math.cos(a)
  const s = Math.sin(a)
  const x = point.x - pivot.x
  const y = point.y - pivot.y
  return { x: pivot.x + x * c + y * s, y: pivot.y - x * s + y * c }
}

export interface FootRoll {
  /** Ankle angle in degrees; positive is plantarflexed, toes down. */
  angle: number
  /** How much of the sole is on the floor, 0 to 1. */
  contact: number
  /** Which part is carrying, 0 clear of the floor to 1 bearing. */
  heelLoad: number
  ballLoad: number
  toeLoad: number
}

/**
 * The ankle through one stance, `stance` running 0 at heel strike to 1 at
 * toe-off. Outside that range — a swinging foot — pass a negative number and
 * the foot dorsiflexes to clear the floor instead.
 */
export function footRoll(stance: number): FootRoll {
  const s = finite(stance, 0)
  if (s < 0 || s > 1) {
    // Swing: hold the toes up so the foot clears, with nothing bearing.
    const clear = clamp(Math.abs(s) - 1, 0, 1)
    const angle = -9 + 4 * Math.sin(Math.PI * clear)
    return { angle, contact: 0, heelLoad: 0, ballLoad: 0, toeLoad: 0 }
  }
  const angle =
    s < 0.25
      ? lerp(-13, 0, s / 0.25)
      : s < 0.62
        ? 0
        : lerp(0, 28, (s - 0.62) / 0.38)
  const heelLoad = clamp(1 - Math.max(0, angle) / 8, 0, 1)
  const ballLoad = clamp(1 - Math.max(0, -angle) / 9, 0, 1)
  const toeLoad = clamp(Math.max(0, angle) / 12, 0, 1) * ballLoad
  return {
    angle,
    contact: clamp((heelLoad + ballLoad) / 2, 0, 1),
    heelLoad,
    ballLoad,
    toeLoad,
  }
}

export interface StrideOptions {
  stride?: number
  lift?: number
  proportions?: SkeletonProportions
}

export interface StrideSample {
  /** Ankle in the sagittal body frame: `forward` toward the nose, `height` up. */
  forward: number
  height: number
  /** Ankle angle in degrees, positive plantarflexed. */
  angle: number
  /** How much of the sole is down; 0 through the whole swing. */
  contact: number
  roll: FootRoll
}

/**
 * One leg's ankle at cycle time `t`. The planted foot rolls about its heel, its
 * sole and then its ball, so the ankle rises at both ends of a stance the way
 * it does over a real foot rather than sliding along at one height.
 */
export function strideCycle(
  gait: SkeletonGait,
  t: number,
  { stride = 0.7, lift = 0.6, proportions = defaultProportions }: StrideOptions = {},
): StrideSample {
  const geometry = gaitGeometry(gait)
  const reach = geometry.stride * unit(stride, 0.7)
  const clearance = geometry.lift * unit(lift, 0.6)
  const cycle = wrap(t)
  const { ankle: ankleHeight, sole, heel } = proportions

  if (geometry.duty >= 1) {
    const roll = footRoll(0.4)
    return { forward: 0, height: ankleHeight, angle: 0, contact: roll.contact, roll }
  }

  if (cycle < geometry.duty) {
    const s = cycle / geometry.duty
    const roll = footRoll(s)
    // Where the ankle's ground point sits while the foot is planted. The foot
    // rolls about its heel while the toes are up, its ball once they are down,
    // and about nothing at all in between — which is continuous at both
    // handovers, because the pivot is on the rotated point's own sole line.
    const plant = reach * (0.5 - s)
    const pivot: Vec2 = {
      x: plant + (roll.angle > 0 ? sole : roll.angle < 0 ? -heel : 0),
      y: 0,
    }
    const placed = rollPoint({ x: plant, y: ankleHeight }, pivot, roll.angle)
    return {
      forward: placed.x,
      height: placed.y,
      angle: roll.angle,
      contact: roll.contact,
      roll,
    }
  }

  // Swing: hand over from the attitude toe-off left the foot in to the one
  // heel strike needs, dorsiflexing early so the foot clears.
  const s = (cycle - geometry.duty) / (1 - geometry.duty)
  const leaving = footRoll(1)
  const arriving = footRoll(0)
  const angle = lerp(leaving.angle, arriving.angle, Math.pow(s, 0.4))
  const forward = (-reach / 2) * Math.cos(Math.PI * s)
  const height = lerp(
    ankleAt(leaving.angle, proportions),
    ankleAt(arriving.angle, proportions),
    s,
  ) + clearance * Math.sin(Math.PI * s)
  const clear = floorClearance({ x: forward, y: height }, angle, proportions)
  return {
    forward,
    height: height + clear,
    angle,
    contact: 0,
    roll: { angle, contact: 0, heelLoad: 0, ballLoad: 0, toeLoad: 0 },
  }
}

/** Ankle height over a foot rolled to `angle` with its sole on the floor. */
function ankleAt(angle: number, proportions: SkeletonProportions) {
  const a = toRadians(Math.abs(angle))
  const arm = angle > 0 ? proportions.sole : proportions.heel
  return arm * Math.sin(a) + proportions.ankle * Math.cos(a)
}

/** How far an ankle has to rise before no part of its sole is under the floor. */
function floorClearance(
  ankle: Vec2,
  angle: number,
  proportions: SkeletonProportions,
) {
  const { heel, ball, toe } = footPoints(ankle, angle, proportions)
  const lowest = Math.min(heel.y, ball.y, toe.y)
  return lowest < 0 ? -lowest : 0
}

export interface SkeletonLeg {
  side: SkeletonSide
  hip: Vec3
  knee: Vec3
  ankle: Vec3
  heel: Vec3
  ball: Vec3
  toe: Vec3
  /** Ankle angle in degrees, positive plantarflexed. */
  angle: number
  /** Toe plate angle in degrees, relative to the floor. */
  toeAngle: number
  /** How much of the sole is on the floor. */
  contact: number
  roll: FootRoll
}

export interface SkeletonArm {
  side: SkeletonSide
  shoulder: Vec3
  elbow: Vec3
  wrist: Vec3
  /** Forearm heading in the sagittal plane, degrees from hanging straight down. */
  heading: number
}

export interface SkeletonPose {
  gait: SkeletonGait
  phase: number
  /** Hip joint height above the floor. */
  hipHeight: number
  pelvis: Vec3
  /** Pelvis list toward the swinging side, and its counter-rotation. */
  pelvisRoll: number
  pelvisYaw: number
  /** Vertebra centres, sacrum first, shoulder line last. */
  spine: Vec3[]
  shoulders: Vec3
  /** Shoulder counter-rotation against the pelvis, in degrees. */
  shoulderYaw: number
  neck: Vec3
  head: Vec3
  legs: SkeletonLeg[]
  arms: SkeletonArm[]
  /** False in the moments of a run when neither foot is on the floor. */
  grounded: boolean
}

export interface SkeletonOptions {
  gait?: SkeletonGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Hip height, 0 crouched to 1 standing tall. */
  stance?: number
  stride?: number
  lift?: number
  /** Whole-body pitch in degrees, positive leaning forward. */
  lean?: number
  /** Shoulders against the pelvis in degrees, on top of the gait's own twist. */
  twist?: number
  /** Head pitch and yaw in degrees. */
  gazePitch?: number
  gazeYaw?: number
  /**
   * A point both hands reach for, in the body frame. Supplying it takes the
   * arms out of the swing and solves them to it.
   */
  reach?: Vec3 | null
  proportions?: SkeletonProportions
}

/** Extra pitch down the spine: lordosis low, kyphosis high. */
const lordosis = 5

/**
 * The whole biped. Legs solve in their own sagittal planes to the ankle the
 * stride asks for; the spine is a chain from the sacrum to the shoulder line;
 * the arms swing half a cycle out of phase with the leg on the same side, or
 * solve to `reach` when there is one.
 */
export function solveSkeleton({
  gait = "stand",
  phase = 0,
  stance = 1,
  stride = 0.7,
  lift = 0.6,
  lean = 0,
  twist = 0,
  gazePitch = 0,
  gazeYaw = 0,
  reach = null,
  proportions = defaultProportions,
}: SkeletonOptions = {}): SkeletonPose {
  const p = proportions
  const geometry = gaitGeometry(gait)
  const named = gaits[gait] ? gait : "stand"
  const cycle = wrap(phase)
  const crouch = unit(stance, 1)
  const pitch = clamp(finite(lean, 0), -35, 45)
  const extraTwist = clamp(finite(twist, 0), -40, 40)

  // Hip height: the driven number. The bob peaks at mid-stance, which is where
  // a walking pelvis is highest.
  const standing = lerp(p.hip * 0.66, p.hip, crouch)
  const bob = (geometry.bounce / 2) * Math.cos(4 * Math.PI * (cycle - 0.31))
  const hipHeight = standing + bob
  // A stride the leg cannot reach at the top of its own bob would leave the
  // solver clamping and the foot skating, so cap it at what the leg has.
  const highest = standing + geometry.bounce / 2
  const span =
    Math.sqrt(Math.max(0, (p.femur + p.tibia) ** 2 - (highest - p.ankle) ** 2)) * 1.96
  const stridden =
    geometry.stride > 0
      ? Math.min(unit(stride, 0.7), span / geometry.stride)
      : unit(stride, 0.7)

  const sides: SkeletonSide[] = ["left", "right"]
  const legOffsets = [0, 0.5]

  const legs = sides.map((side, index): SkeletonLeg => {
    const t = wrap(cycle + legOffsets[index])
    const sample = strideCycle(named, t, { stride: stridden, lift, proportions: p })
    const x = side === "left" ? -p.hipSpan : p.hipSpan
    // Solve in the sagittal plane: local x is forward, local y is up.
    const [hip, knee, ankle] = solveChain2(
      { x: 0, y: hipHeight },
      { x: sample.forward, y: sample.height },
      [p.femur, p.tibia],
      { bend: "up" },
    )
    const { heel, ball, toe, toeAngle } = footPoints(ankle, sample.angle, p)
    const out = (point: Vec2): Vec3 => ({ x, y: point.y, z: -point.x })
    return {
      side,
      hip: out(hip),
      knee: out(knee),
      ankle: out(ankle),
      heel: out(heel),
      ball: out(ball),
      toe: out(toe),
      angle: sample.angle,
      toeAngle,
      contact: sample.contact,
      roll: sample.roll,
    }
  })

  // The pelvis lists toward whichever hip is unsupported, and counter-rotates
  // against the shoulders.
  const support = legs[0].contact - legs[1].contact
  const pelvisRoll = -support * (geometry.stride / 12)
  const pelvisYaw = Math.sin(2 * Math.PI * cycle) * (geometry.swing / 4)
  const shoulderYaw = -pelvisYaw + extraTwist

  const pelvis: Vec3 = { x: 0, y: hipHeight, z: 0 }
  const spine = spineCurve({
    base: pelvis,
    length: p.spine,
    segments: Math.max(2, Math.round(finite(p.vertebrae, 7))),
    lean: pitch,
    twist: shoulderYaw,
  })
  const shoulders = spine[spine.length - 1]

  // The neck carries on from the last vertebra's heading, so a leaning machine
  // does not end up with a head bolted on vertically.
  const spineHeading = headingOf(spine[spine.length - 2], shoulders)
  const neck = advance(shoulders, spineHeading, p.neck)
  const head = advance(
    neck,
    spineHeading + clamp(finite(gazePitch, 0), -35, 35),
    p.skull * 0.62,
  )
  const gaze = clamp(finite(gazeYaw, 0), -60, 60)
  const headTurned = spin(head, shoulders, gaze)

  const arms = sides.map((side, index): SkeletonArm => {
    const x = side === "left" ? -p.shoulderSpan : p.shoulderSpan
    const shoulder: Vec3 = {
      x: shoulders.x + x,
      y: shoulders.y,
      z: shoulders.z,
    }
    if (reach && Number.isFinite(reach.x) && Number.isFinite(reach.y) && Number.isFinite(reach.z)) {
      const [, elbow, wrist] = solveChain3(shoulder, reach, [p.humerus, p.forearm], {
        up: { x: 0, y: 0, z: 1 },
      })
      return { side, shoulder, elbow, wrist, heading: sagittalHeading(elbow, wrist) }
    }
    // Half a cycle out of phase with the leg on the same side, and the elbow
    // flexes more on the way forward than on the way back.
    const t = wrap(cycle + legOffsets[index] + 0.5)
    const swing = Math.sin(2 * Math.PI * t) * geometry.swing
    const flex = 16 + Math.max(0, Math.sin(2 * Math.PI * t)) * (geometry.swing * 0.7)
    const chain = forwardChain2(
      { x: 0, y: 0 },
      [-90 + swing + pitch * 0.4, flex],
      [p.humerus, p.forearm],
    )
    const out = (point: Vec2): Vec3 => ({
      x: shoulder.x,
      y: shoulder.y + point.y,
      z: shoulder.z - point.x,
    })
    const elbow = out(chain[1])
    const wrist = out(chain[2])
    return { side, shoulder, elbow, wrist, heading: sagittalHeading(elbow, wrist) }
  })

  return {
    gait: named,
    phase: cycle,
    hipHeight,
    pelvis,
    pelvisRoll,
    pelvisYaw,
    spine,
    shoulders,
    shoulderYaw,
    neck,
    head: headTurned,
    legs,
    arms,
    grounded: legs.some((leg) => leg.contact > 0),
  }
}

export interface SpineOptions {
  base: Vec3
  length: number
  segments: number
  /** Total pitch from vertical across the whole column, in degrees. */
  lean: number
  /** Shoulder counter-rotation about the vertical, in degrees. */
  twist: number
}

/**
 * Vertebra centres from the sacrum to the shoulder line. Every segment is the
 * same length, so leaning and twisting move the shoulders without stretching
 * the back.
 */
export function spineCurve({
  base,
  length,
  segments,
  lean,
  twist,
}: SpineOptions): Vec3[] {
  const count = Math.max(2, Math.round(Number.isFinite(segments) ? segments : 7))
  const step = (Number.isFinite(length) ? length : 0) / count
  const pitch = Number.isFinite(lean) ? lean : 0
  const turn = Number.isFinite(twist) ? twist : 0
  const points: Vec3[] = [{ ...base }]
  let heading = 0
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count
    // Pitch accumulates down the column; the yaw is carried, so the twist is
    // shared out rather than applied in one place.
    heading += pitch / count + Math.sin(2 * Math.PI * u) * (lordosis / count) * 2
    const yaw = toRadians((turn * (i + 1)) / count)
    const rise = Math.cos(toRadians(heading))
    const run = Math.sin(toRadians(heading))
    const previous = points[i]
    // Each segment is a unit direction times one step, so no amount of leaning
    // or twisting can stretch the back. Positive lean pitches toward the nose.
    points.push({
      x: previous.x + run * Math.sin(yaw) * step,
      y: previous.y + rise * step,
      z: previous.z - run * Math.cos(yaw) * step,
    })
  }
  return points
}

/** Turn a point about the vertical axis through `pivot`. */
function spin(point: Vec3, pivot: Vec3, degrees: number): Vec3 {
  if (!degrees) return { ...point }
  const a = toRadians(degrees)
  const c = Math.cos(a)
  const s = Math.sin(a)
  const x = point.x - pivot.x
  const z = point.z - pivot.z
  return { x: pivot.x + x * c - z * s, y: point.y, z: pivot.z + x * s + z * c }
}

/** Degrees from straight up, in the sagittal plane, positive toward the nose. */
function headingOf(from: Vec3, to: Vec3) {
  return (Math.atan2(from.z - to.z, to.y - from.y) * 180) / Math.PI
}

/** Degrees from hanging straight down, positive toward the nose. */
function sagittalHeading(from: Vec3, to: Vec3) {
  return (Math.atan2(from.z - to.z, from.y - to.y) * 180) / Math.PI
}

/** Step `distance` from `point` along a heading measured from vertical. */
function advance(point: Vec3, heading: number, distance: number): Vec3 {
  const a = toRadians(heading)
  return {
    x: point.x,
    y: point.y + Math.cos(a) * distance,
    z: point.z - Math.sin(a) * distance,
  }
}

/**
 * The two-link leg on its own, in the sagittal plane: `x` toward the nose,
 * `y` up. The knee always breaks forward, which is the joint a person has.
 */
export function solveLeg(
  hip: Vec2,
  foot: Vec2,
  femur: number,
  tibia: number,
): [Vec2, Vec2, Vec2] {
  const safe = {
    x: Number.isFinite(foot.x) ? foot.x : 0,
    y: Number.isFinite(foot.y) ? foot.y : 0,
  }
  const [root, knee, ankle] = solveChain2(hip, safe, [femur, tibia], { bend: "up" })
  return [root, knee, ankle]
}

export interface FootGeometry {
  heel: Vec2
  /** The metatarsal joint — the hinge the toe plate swings on. */
  ball: Vec2
  toe: Vec2
  /** Toe plate angle in degrees, relative to the floor rather than the foot. */
  toeAngle: number
}

/**
 * Heel, ball and toe for an ankle at `ankle` rolled by `angle` degrees, in the
 * same sagittal frame. The one piece of foot geometry every machine in the
 * family draws from.
 *
 * The toe plate is hinged at the ball, not welded to the sole. Plantarflexing
 * the ankle over a planted foot extends that hinge instead of driving the toe
 * through the floor — which is what a real foot does at push-off, and what the
 * `robot-foot` toe joint is drawing.
 */
export function footPoints(
  ankle: Vec2,
  angle: number,
  proportions: SkeletonProportions = defaultProportions,
): FootGeometry {
  const turn = Number.isFinite(angle) ? angle : 0
  const sole = ankle.y - proportions.ankle
  const ball = rollPoint({ x: ankle.x + proportions.sole, y: sole }, ankle, turn)
  // Rolling forward over the ball leaves the toe plate flat; rolling back onto
  // the heel picks the whole foot up together.
  const toeAngle = Math.min(turn, 0)
  return {
    heel: rollPoint({ x: ankle.x - proportions.heel, y: sole }, ankle, turn),
    ball,
    toe: rollPoint({ x: ball.x + proportions.toe, y: ball.y }, ball, toeAngle),
    toeAngle,
  }
}
