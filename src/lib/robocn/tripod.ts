/**
 * Three-legged walking: a load schedule, the body position that schedule
 * demands, and the support polygon that says whether the machine can hold it.
 *
 * Every other walker in this registry stands on an even number of legs, and
 * every one of them keeps half of them planted while the other half swings —
 * with six legs that is free, because three feet are always down. With
 * **three** it is not. Lift one and the base of support collapses from a
 * triangle to a **segment**; lift two and it collapses to a point. So a
 * three-legged walker cannot take a step without first moving its own mass
 * onto the line between the two feet that stay down, and that movement is the
 * machine.
 *
 * `bear.ts` asks the opposite question in one dimension: given a centre of
 * mass, what is each sole carrying? This runs the same relation forwards in
 * two. A leg's load is handed over on a ramp before it lifts and taken back
 * after it lands; the loads sum to one body; and the static condition then
 * says the centre of mass *is* the load-weighted mean of the contacts. That
 * mean is the body's plan position.
 *
 * The body cannot slide over its own hips without limit, so the demanded
 * position is clamped to a `sway` disc — derived from how far the legs can
 * still reach a planted foot, which is why ride height and link length change
 * whether the machine can walk statically at all. When the clamp bites, the
 * centre of mass leaves the support polygon and `margin` goes negative.
 *
 * Illustrative, not dynamics: the load ramp is a chosen schedule rather than a
 * ground-reaction solve, and there is no mass, inertia or acceleration here. A
 * negative margin says the machine could not hold that pose standing still, not
 * that it has been simulated falling over.
 *
 * Design note: docs/tripod-droid.md.
 */

import {
  clamp,
  rotate2,
  solveChain2,
  toRadians,
  type Vec2,
} from "@/lib/robocn/kinematics"

export type TripodGait = "stand" | "creep" | "amble" | "pivot"

export type TripodLegId = 0 | 1 | 2

export interface TripodOptions {
  gait?: TripodGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Normalized ride height, foot travel and swing clearance, each 0–1. */
  height?: number
  step?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose, 90 to starboard. */
  heading?: number
  /** Degrees the body turns per cycle in `pivot`. */
  turn?: number
  /**
   * How far the body may move over its feet, in world units. Clamped to what
   * the legs can follow, which is the real limit; omit it and that is the one
   * you get.
   */
  sway?: number
  /** Extra body offset in −1..1 of the sway limit, added before the clamp. */
  lean?: Vec2
  /** Segment lengths in world units. */
  femur?: number
  tibia?: number
}

export interface TripodLeg {
  id: TripodLegId
  /** Fore-starboard, fore-port, hind. */
  name: "fore-starboard" | "fore-port" | "hind"
  /** Plan-view positions: x starboard, y toward the nose. */
  hip: Vec2
  knee: Vec2
  foot: Vec2
  /** Height of the knee above the ground, in world units. */
  kneeHeight: number
  /** Height of the foot above the ground; zero while it carries weight. */
  clearance: number
  contact: boolean
  /** Share of the body this foot is carrying, 0–1. The three sum to one. */
  load: number
}

export interface TripodPose {
  gait: TripodGait
  /** Body height above the ground in world units. */
  height: number
  /** Plan position of the body over its feet — the whole mechanism. */
  centre: Vec2
  /** Body heading in degrees, which `pivot` turns and the others leave alone. */
  yaw: number
  legs: TripodLeg[]
  /** The feet on the ground, in leg order. */
  support: Vec2[]
  /**
   * Signed distance from `centre` to the edge of the support polygon: positive
   * inside a triangle, zero at best on a segment, negative outside either.
   */
  margin: number
  stable: boolean
  /** How far the body was allowed to move this frame. */
  sway: number
  femur: number
  tibia: number
}

/** The fixed numbers the machine is drawn to, in world units. */
export const tripodLimits = {
  /** Plan hip positions and the stance point each leg plants at. */
  legs: [
    { id: 0 as TripodLegId, name: "fore-starboard" as const, hip: { x: 19, y: 10 }, stance: { x: 29, y: 15 } },
    { id: 1 as TripodLegId, name: "fore-port" as const, hip: { x: -19, y: 10 }, stance: { x: -29, y: 15 } },
    { id: 2 as TripodLegId, name: "hind" as const, hip: { x: 0, y: -19 }, stance: { x: 0, y: -30 } },
  ],
  /** Ride height runs from a crouch to a stand. */
  clearance: { min: 14, max: 28 },
  /** Foot travel and swing clearance at full `step` and `lift`. */
  travel: 8.3,
  swing: 7,
  femur: 19,
  tibia: 22,
  turn: 30,
} as const

/**
 * Where in the cycle each leg swings, and how much of it it spends planted.
 *
 * Three legs a third of a cycle apart are all down together for `3 · duty − 2`
 * of it. At a duty of exactly two thirds that window closes and the handover
 * becomes instantaneous, which no machine can do — so the walking gait keeps a
 * real overlap and hands the load across inside it.
 */
const OFFSETS = [0, 1 / 3, 2 / 3]
const DUTY: Record<TripodGait, number> = {
  // Never swings: all three planted, all the time.
  stand: 1,
  // One leg off at a time, with an eighth of a cycle of three-foot overlap.
  creep: 0.8,
  // Two legs off at once, which is more sway than a stubby machine has.
  amble: 0.5,
  // The creep pattern, turning on the spot instead of travelling.
  pivot: 0.8,
}

/** The shortest handover, as a fraction of the cycle, when there is no overlap. */
const MIN_RAMP = 0.06

const MAX_REACH = Math.max(
  ...tripodLimits.legs.map((leg) => Math.hypot(leg.stance.x - leg.hip.x, leg.stance.y - leg.hip.y)),
)
const MAX_STANCE = Math.max(...tripodLimits.legs.map((leg) => Math.hypot(leg.stance.x, leg.stance.y)))

const unit = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : fallback
const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const finite = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * One pose of the walker.
 *
 * Plan coordinates are x starboard, y toward the nose. Feet are planted in the
 * ground frame; the hips are bolted to the body and go wherever the balance
 * puts it.
 */
export function solveTripod({
  gait = "creep",
  phase = 0,
  height = 0.43,
  step = 0.6,
  lift = 0.5,
  heading = 0,
  turn = tripodLimits.turn,
  sway,
  lean,
  femur = tripodLimits.femur,
  tibia = tripodLimits.tibia,
}: TripodOptions = {}): TripodPose {
  const mode: TripodGait = DUTY[gait] === undefined ? "stand" : gait
  const duty = DUTY[mode]
  const upper = finite(femur, tripodLimits.femur, 12, 200)
  const lower = finite(tibia, tripodLimits.tibia, 12, 200)
  const span = upper + lower
  const travel = tripodLimits.travel * unit(step, 0.6)
  const swingLift = tripodLimits.swing * unit(lift, 0.5)
  const spin = finite(turn, tripodLimits.turn, -180, 180)
  // Turning swings a foot through an arc rather than along a line; that arc is
  // what the reach has to pay for in `pivot`.
  const amplitude = mode === "pivot" ? (Math.abs(spin) * duty) / 2 : 0
  const reachSpend = mode === "pivot" ? MAX_STANCE * toRadians(amplitude) : travel

  // The stance already spends this much horizontal reach, so the body can only
  // stand as tall as what is left over — and short legs get a low machine
  // rather than a foot the leg cannot hold on to.
  const budget = MAX_REACH + reachSpend + 1.5
  const ceiling = Math.sqrt(Math.max(64, span * span - budget * budget))
  const body = Math.min(
    tripodLimits.clearance.min +
      (tripodLimits.clearance.max - tripodLimits.clearance.min) * unit(height, 0.43),
    ceiling,
  )
  const room = Math.sqrt(Math.max(1, span * span - body * body))
  // Whatever reach is left once a planted foot has been paid for is how far
  // the body is allowed to move over it.
  const limit = Math.max(0, room - MAX_REACH - reachSpend)
  const allowed = sway === undefined ? limit : Math.min(limit, Math.abs(finite(sway, limit, 0, 1e4)))

  const cycle = wrap(phase)
  const yaw = mode === "pivot" ? spin * cycle : 0
  const course = Number.isFinite(heading) ? toRadians(heading) : 0
  // Plan view is x starboard, y toward the nose, so heading 0 walks along +y.
  const forward: Vec2 = { x: Math.sin(course), y: Math.cos(course) }

  const placed = tripodLimits.legs.map((leg, index) => {
    const t = wrap(cycle - OFFSETS[index])
    let travelled = 0
    let raise = 0
    let weight = 1
    if (mode !== "stand") {
      if (t < duty) {
        // Stance: the foot runs back through the body's travel, carrying its
        // load except while it is being handed over at either end.
        travelled = 1 - (2 * t) / duty
        // Hand the load over inside the three-foot overlap the duty buys.
        const ramp = Math.max(MIN_RAMP, duty - 2 / 3)
        weight =
          smoothstep(clamp(t / ramp, 0, 1)) * smoothstep(clamp((duty - t) / ramp, 0, 1))
      } else {
        const swing = (t - duty) / (1 - duty)
        travelled = -Math.cos(Math.PI * swing)
        raise = swingLift * Math.sin(Math.PI * swing)
        weight = 0
      }
    }
    const foot =
      mode === "pivot"
        ? rotate2(leg.stance, toRadians(yaw + amplitude * travelled))
        : {
            x: leg.stance.x + forward.x * travel * travelled,
            y: leg.stance.y + forward.y * travel * travelled,
          }
    return { leg, foot, raise, weight, contact: raise <= 1e-7 }
  })

  // The loads are a schedule, and they add up to one body.
  const total = placed.reduce((sum, entry) => sum + entry.weight, 0)
  const grounded = placed.filter((entry) => entry.contact)
  const loads = placed.map((entry) =>
    total > 1e-6
      ? entry.weight / total
      : entry.contact && grounded.length
        ? 1 / grounded.length
        : 0,
  )

  // The static condition, solved for the position rather than for the loads:
  // the centre of mass is the load-weighted mean of the contacts.
  const demanded = placed.reduce(
    (sum, entry, index) => ({
      x: sum.x + entry.foot.x * loads[index],
      y: sum.y + entry.foot.y * loads[index],
    }),
    { x: 0, y: 0 },
  )
  const bias = {
    x: finite(lean?.x ?? 0, 0, -1, 1) * allowed,
    y: finite(lean?.y ?? 0, 0, -1, 1) * allowed,
  }
  const centre = clampToDisc({ x: demanded.x + bias.x, y: demanded.y + bias.y }, allowed)

  const turnRad = toRadians(yaw)
  const legs: TripodLeg[] = placed.map((entry, index) => {
    const base = yaw ? rotate2(entry.leg.hip, turnRad) : entry.leg.hip
    const hip: Vec2 = { x: base.x + centre.x, y: base.y + centre.y }
    // Solve in the leg's own vertical plane: horizontal reach on one axis,
    // ride height on the other, so femur and tibia hold their lengths.
    const reach = Math.hypot(entry.foot.x - hip.x, entry.foot.y - hip.y)
    const [, knee] = solveChain2({ x: 0, y: body }, { x: reach, y: entry.raise }, [upper, lower], {
      bend: "up",
    })
    const out =
      reach < 1e-9
        ? { x: 0, y: 1 }
        : { x: (entry.foot.x - hip.x) / reach, y: (entry.foot.y - hip.y) / reach }
    return {
      id: entry.leg.id,
      name: entry.leg.name,
      hip,
      knee: { x: hip.x + out.x * knee.x, y: hip.y + out.y * knee.x },
      foot: entry.foot,
      kneeHeight: knee.y,
      clearance: entry.raise,
      contact: entry.contact,
      load: loads[index],
    }
  })

  const support = legs.filter((leg) => leg.contact).map((leg) => leg.foot)
  const margin = supportMargin(centre, support)
  return {
    gait: mode,
    height: body,
    centre,
    yaw,
    legs,
    support,
    margin,
    stable: margin >= -1e-6,
    sway: allowed,
    femur: upper,
    tibia: lower,
  }
}

/** Nothing moves further from home than the machine can follow. */
function clampToDisc(point: Vec2, radius: number): Vec2 {
  const distance = Math.hypot(point.x, point.y)
  if (distance <= radius || distance < 1e-12) return point
  const scale = radius / distance
  return { x: point.x * scale, y: point.y * scale }
}

/**
 * How much room the centre of mass has left.
 *
 * Three contacts make a polygon with an inside; two make a segment the mass
 * has to sit exactly on; one makes a point. Positive is inside, and anything
 * less than three contacts is zero at best — which is the whole reason a
 * three-legged walker has to move its body to take a step.
 */
export function supportMargin(centre: Vec2, support: readonly Vec2[]): number {
  if (support.length >= 3) {
    const [a, b, c] = support
    // Wind the ring the same way every time, so "left of the edge" is inside.
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const ring = area < 0 ? [a, c, b, ...support.slice(3)] : support
    let margin = Number.POSITIVE_INFINITY
    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index]
      const to = ring[(index + 1) % ring.length]
      const length = Math.hypot(to.x - from.x, to.y - from.y)
      if (length < 1e-9) continue
      const cross =
        (to.x - from.x) * (centre.y - from.y) - (to.y - from.y) * (centre.x - from.x)
      margin = Math.min(margin, cross / length)
    }
    return Number.isFinite(margin) ? margin : -Math.hypot(centre.x - a.x, centre.y - a.y)
  }
  if (support.length === 2) return -segmentDistance(centre, support[0], support[1])
  if (support.length === 1) {
    return -Math.hypot(centre.x - support[0].x, centre.y - support[0].y)
  }
  // Unreachable while a duty cycle keeps at least one foot down.
  return Number.NEGATIVE_INFINITY
}

function segmentDistance(point: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < 1e-12) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t))
}
