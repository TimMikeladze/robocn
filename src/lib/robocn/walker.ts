/**
 * Walking with the mass carried high: two or four legs on a rectangular hip
 * base, and the hull attitude a load schedule demands.
 *
 * `tripod.ts` asks where a body has to **stand** to hold a load split. These
 * machines cannot answer that question by standing anywhere: their mass is a
 * hull well above the hip line, and a hull bolted to its hips does not slide
 * sideways — it rolls. So the same static condition is run through a different
 * mechanism:
 *
 * ```
 * lateral offset of the mass = hull · sin(roll)
 * fore-aft offset            = hull · sin(pitch)
 * ```
 *
 * Backwards, which is how this runs: the static condition says the mass has to
 * be inside the feet that are down, so the demand is the nearest place inside
 * that support polygon, and `asin(offset / hull)` is the attitude that gets the
 * mass there. Roll and pitch are **outputs**. They also run out — past the
 * stops the mass cannot reach the polygon at all, and `margin` goes negative.
 *
 * A hull already standing inside its own feet asks for no attitude at all,
 * which is why a four-legged machine walks nearly level and a two-legged one
 * cannot: with one foot down the polygon *is* that foot.
 *
 * That one relation is the whole difference between the two machines on it. A
 * biped stands on one foot for most of its cycle, so it must roll its mass a
 * half hip-width every step; a quadruped walking a lateral sequence never has
 * fewer than three feet down, so it hardly rolls at all — until it is asked to
 * `pace`, when its support collapses to a line down one flank and a machine the
 * size of a building has to roll like the biped. Nothing is animated to look
 * heavy; the footfall order does it.
 *
 * Illustrative, not dynamics: the footfall pattern is a chosen schedule, each
 * foot's share is that schedule weighted by how near the mass is rather than a
 * ground-reaction solve, and there is no mass, inertia, angular momentum or
 * overturning moment here. A negative margin says the machine could not hold
 * that pose *standing still*. In particular a taller hull needs less roll for
 * the same lateral move, which is true of this static geometry and says nothing
 * about what a tall machine does when it is moving.
 *
 * Design note: docs/armoured-walkers.md.
 */

import {
  clamp,
  convexHull2,
  solveElbow2,
  toDegrees,
  toRadians,
  type Bend,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

export type WalkerGait = "stand" | "walk" | "stride" | "creep" | "pace"

/** Two legs or four; nothing here is written for any other count. */
export type WalkerLegCount = 2 | 4

export type WalkerLegName =
  | "port"
  | "starboard"
  | "fore-port"
  | "fore-starboard"
  | "hind-port"
  | "hind-starboard"

export interface WalkerOptions {
  legs?: WalkerLegCount
  gait?: WalkerGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Normalized ride height, foot travel and swing clearance, each 0–1. */
  height?: number
  step?: number
  lift?: number
  /** Half the hip track across the machine, and half the hip base along it. */
  halfWidth?: number
  halfLength?: number
  /** Segment lengths in world units. */
  femur?: number
  tibia?: number
  /** How far the centre of mass sits above the hip line. */
  hull?: number
  /** Attitude stops in degrees. */
  rollLimit?: number
  pitchLimit?: number
  /** Which way the knee breaks: to the rear is what makes a walker read as one. */
  knee?: "fore" | "aft"
  /** How far inside the support polygon the machine tries to keep its mass. */
  inset?: number
  /** Extra attitude demand in −1..1 of each stop, added before the clamp. */
  lean?: Vec2
}

export interface WalkerLeg {
  id: number
  name: WalkerLegName
  /** Plan positions: x starboard, y toward the nose. */
  hip: Vec2
  /** Height of the hip above the ground — the attitude moves it. */
  hipHeight: number
  knee: Vec2
  kneeHeight: number
  foot: Vec2
  /** Height of the foot above the ground; zero while it carries weight. */
  clearance: number
  contact: boolean
  /** Share of the body this foot is carrying, 0–1. They sum to one. */
  load: number
}

export interface WalkerPose {
  count: WalkerLegCount
  gait: WalkerGait
  /** Hip height above the ground, before the attitude tips it. */
  ride: number
  /** Degrees, positive starboard-down and nose-down. Outputs, not inputs. */
  roll: number
  pitch: number
  /** Where the load asked the mass to be, and where the attitude got it. */
  demand: Vec2
  centre: Vec2
  legs: WalkerLeg[]
  support: Vec2[]
  /**
   * Signed distance from `centre` to the edge of the support polygon: positive
   * inside, zero at best on a segment, negative outside. Zero and `airborne`
   * when nothing is down, because there is then no support to be inside of.
   */
  margin: number
  airborne: boolean
  stable: boolean
  hull: number
  femur: number
  tibia: number
  rollLimit: number
  pitchLimit: number
}

/** The fixed numbers each machine is drawn to, in world units. */
export const walkerLimits = {
  2: {
    halfWidth: 10,
    halfLength: 0,
    clearance: { min: 34, max: 60 },
    travel: 13,
    swing: 10,
    femur: 34,
    tibia: 38,
    hull: 44,
    rollLimit: 20,
    pitchLimit: 12,
    // A biped standing on one foot has nothing to spare; it aims at the foot.
    inset: 0,
  },
  4: {
    halfWidth: 22,
    halfLength: 40,
    clearance: { min: 34, max: 58 },
    travel: 12,
    swing: 7,
    femur: 32,
    tibia: 35,
    hull: 30,
    rollLimit: 12,
    pitchLimit: 12,
    // A rectangle has room, so the hull aims a little way inside the edge.
    inset: 3,
  },
} as const satisfies Record<WalkerLegCount, unknown>

/**
 * Where each leg sits, and where in the cycle it swings.
 *
 * The biped is a pair across one axle. The quadruped is a rectangle walked in
 * lateral sequence — hind then fore, one side then the other — which is the
 * order that keeps three feet down; `pace` throws that away and swings the two
 * legs of a side together.
 */
const LAYOUT: Record<WalkerLegCount, { name: WalkerLegName; x: number; y: number }[]> = {
  2: [
    { name: "starboard", x: 1, y: 0 },
    { name: "port", x: -1, y: 0 },
  ],
  4: [
    { name: "fore-starboard", x: 1, y: 1 },
    { name: "fore-port", x: -1, y: 1 },
    { name: "hind-starboard", x: 1, y: -1 },
    { name: "hind-port", x: -1, y: -1 },
  ],
}

interface GaitPlan {
  duty: number
  offsets: number[]
}

/** Which gaits each leg count has, and what each one does. */
const GAITS: Record<WalkerLegCount, Partial<Record<WalkerGait, GaitPlan>>> = {
  2: {
    stand: { duty: 1, offsets: [0, 0.5] },
    // Real double support: both feet down for a quarter of the cycle.
    walk: { duty: 0.62, offsets: [0, 0.5] },
    // Under a half is a flight phase, and it says so rather than hiding it.
    stride: { duty: 0.46, offsets: [0, 0.5] },
  },
  4: {
    stand: { duty: 1, offsets: [0, 0.5, 0.25, 0.75] },
    // Lateral sequence: hind, then the fore on the same side, then the other.
    walk: { duty: 0.78, offsets: [0.75, 0.25, 0.5, 0] },
    creep: { duty: 0.9, offsets: [0.75, 0.25, 0.5, 0] },
    // Both legs of a side together, which is a line to balance on.
    pace: { duty: 0.56, offsets: [0.5, 0, 0.5, 0] },
  },
}

/** The shortest load handover, as a fraction of the cycle. */
const MIN_RAMP = 0.06

/**
 * How quickly a foot's share falls away with distance from the mass, in world
 * units. It is what keeps a foot directly under the centre from taking the
 * whole body on its own.
 */
const LOAD_SOFTENING = 6

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
 * ground frame and travel under the machine; the hull holds station over them
 * and pays for every lateral move with attitude.
 */
export function solveWalker(options: WalkerOptions = {}): WalkerPose {
  const count: WalkerLegCount = options.legs === 2 || options.legs === 4 ? options.legs : 4
  const limits = walkerLimits[count]
  const plans = GAITS[count]
  const gait: WalkerGait = options.gait && plans[options.gait] ? options.gait : "stand"
  const plan = plans[gait] ?? plans.stand!

  const halfWidth = finite(options.halfWidth ?? limits.halfWidth, limits.halfWidth, 2, 400)
  const halfLength = finite(options.halfLength ?? limits.halfLength, limits.halfLength, 0, 400)
  const femur = finite(options.femur ?? limits.femur, limits.femur, 8, 400)
  const tibia = finite(options.tibia ?? limits.tibia, limits.tibia, 8, 400)
  const hull = finite(options.hull ?? limits.hull, limits.hull, 4, 400)
  const rollLimit = finite(options.rollLimit ?? limits.rollLimit, limits.rollLimit, 0, 80)
  const pitchLimit = finite(options.pitchLimit ?? limits.pitchLimit, limits.pitchLimit, 0, 80)
  const inset = finite(options.inset ?? limits.inset, limits.inset, 0, 100)
  const bend: Bend = options.knee === "fore" ? "up" : "down"

  const travel = limits.travel * unit(options.step ?? 0.7, 0.7)
  const swing = limits.swing * unit(options.lift ?? 0.55, 0.55)
  const span = femur + tibia
  // A leg that is already spending reach on its stride can only stand as tall
  // as what is left, so short legs get a low machine rather than a broken one.
  const spend = travel + Math.max(halfWidth, 1) * 0.2 + 2
  // Attitude lifts the hip on the high side, and that lift is reach the leg has
  // to find on top of its stride — so the stops are paid for before the ride
  // height is, and short legs get a low machine rather than a torn one.
  const lift =
    halfWidth * Math.sin(toRadians(rollLimit)) + halfLength * Math.sin(toRadians(pitchLimit))
  const ceiling = Math.max(10, Math.sqrt(Math.max(64, span * span - spend * spend)) - lift)
  const ride = Math.min(
    limits.clearance.min +
      (limits.clearance.max - limits.clearance.min) * unit(options.height ?? 0.5, 0.5),
    ceiling,
  )

  const cycle = wrap(options.phase ?? 0)
  const layout = LAYOUT[count]
  const placed = layout.map((leg, index) => {
    const home: Vec2 = { x: leg.x * halfWidth, y: leg.y * halfLength }
    const t = wrap(cycle - (plan.offsets[index] ?? 0))
    let travelled = 0
    let raise = 0
    let weight = 1
    if (gait !== "stand") {
      if (t < plan.duty) {
        // Stance: the foot runs back through the machine's travel, carrying its
        // load except while it is being handed over at either end.
        travelled = 1 - (2 * t) / plan.duty
        const ramp = Math.max(MIN_RAMP, plan.duty - (count === 2 ? 0.5 : 0.75))
        weight =
          smoothstep(clamp(t / ramp, 0, 1)) * smoothstep(clamp((plan.duty - t) / ramp, 0, 1))
      } else {
        const through = (t - plan.duty) / (1 - plan.duty)
        travelled = -Math.cos(Math.PI * through)
        raise = swing * Math.sin(Math.PI * through)
        weight = 0
      }
    }
    return {
      name: leg.name,
      home,
      foot: { x: home.x, y: home.y + travel * travelled },
      raise,
      weight,
      contact: raise <= 1e-7,
    }
  })

  const grounded = placed.filter((entry) => entry.contact)
  const airborne = grounded.length === 0
  const support = grounded.map((entry) => entry.foot)

  // The static condition, solved for the position rather than for the loads:
  // the mass has to be inside the feet that are down. A hull already standing
  // inside them asks for nothing; otherwise the demand is the nearest place
  // inside that will hold it, found along the line to the middle of the feet.
  const held = airborne ? { x: 0, y: 0 } : settle(support, inset)
  const bias = {
    x: finite(options.lean?.x ?? 0, 0, -1, 1) * hull * Math.sin(toRadians(rollLimit)),
    y: finite(options.lean?.y ?? 0, 0, -1, 1) * hull * Math.sin(toRadians(pitchLimit)),
  }
  const demand = { x: held.x + bias.x, y: held.y + bias.y }

  // Attitude is what buys the offset, and it is the thing that runs out. Roll
  // goes first and pitch is then measured on the rolled hull, which is why the
  // fore-aft reach carries a `cos(roll)`: a hull already leaned over to one side
  // has less of its height left to spend along the machine.
  const roll = clamp(toDegrees(Math.asin(clamp(demand.x / hull, -1, 1))), -rollLimit, rollLimit)
  const along = Math.max(1e-6, hull * Math.cos(toRadians(roll)))
  const pitch = clamp(
    toDegrees(Math.asin(clamp(demand.y / along, -1, 1))),
    -pitchLimit,
    pitchLimit,
  )
  const mass = attitudePoint({ x: 0, y: hull, z: 0 }, toRadians(roll), toRadians(pitch))
  const centre = { x: mass.x, y: mass.z }

  // What each foot carries: what the schedule has handed it, weighted by how
  // near the mass actually ended up. Two feet either side of the centre split
  // the body evenly; stand over one of them and it takes nearly all of it.
  const shares = placed.map((entry) =>
    entry.weight <= 0
      ? 0
      : entry.weight / (Math.hypot(entry.foot.x - centre.x, entry.foot.y - centre.y) + LOAD_SOFTENING),
  )
  const total = shares.reduce((sum, share) => sum + share, 0)
  const loads = shares.map((share, index) =>
    total > 1e-9
      ? share / total
      : placed[index].contact && grounded.length
        ? 1 / grounded.length
        : 0,
  )

  const rollRad = toRadians(roll)
  const pitchRad = toRadians(pitch)
  const legs: WalkerLeg[] = placed.map((entry, index) => {
    // Rolling about the fore-aft axis through the hip centre drops the hip on
    // the low side and lifts the other; pitch does the same along the hull. The
    // hips ride the very same transform the hull is drawn with, so the crouch on
    // the loaded side is geometry rather than a drawn pose.
    const moved = attitudePoint({ x: entry.home.x, y: 0, z: entry.home.y }, rollRad, pitchRad)
    const hip: Vec2 = { x: moved.x, y: moved.z }
    const hipHeight = Math.max(2, ride + moved.y)
    // Solve in the leg's own vertical plane: horizontal reach on one axis, the
    // hip height on the other, so femur and tibia hold their lengths.
    // The plane is oriented along the machine rather than along the step, so
    // the horizontal coordinate is *signed* and the knee stays on the same side
    // of the leg all the way through a stride — a foot passing under its own
    // hip is the degenerate case, and it is the common one.
    const reach = Math.hypot(entry.foot.x - hip.x, entry.foot.y - hip.y)
    const forward =
      reach < 1e-9 || entry.foot.y - hip.y >= 0
        ? 1
        : -1
    const out =
      reach < 1e-9
        ? { x: 0, y: 1 }
        : {
            x: (forward * (entry.foot.x - hip.x)) / reach,
            y: (forward * (entry.foot.y - hip.y)) / reach,
          }
    const knee = solveElbow2(
      { x: 0, y: hipHeight },
      { x: forward * reach, y: entry.raise },
      femur,
      tibia,
      bend,
    )
    return {
      id: index,
      name: entry.name,
      hip,
      hipHeight,
      knee: { x: hip.x + out.x * knee.x, y: hip.y + out.y * knee.x },
      kneeHeight: knee.y,
      foot: entry.foot,
      clearance: entry.raise,
      contact: entry.contact,
      load: loads[index],
    }
  })

  const margin = airborne ? 0 : supportMargin(centre, support)
  return {
    count,
    gait,
    ride,
    roll,
    pitch,
    demand,
    centre,
    legs,
    support,
    margin,
    airborne,
    stable: !airborne && margin >= -1e-6,
    hull,
    femur,
    tibia,
    rollLimit,
    pitchLimit,
  }
}

/**
 * How much room the centre of mass has left inside the feet that are down.
 *
 * Three or more contacts make a polygon with an inside; two make a segment the
 * mass has to sit exactly on; one makes a point. Positive is inside, and
 * anything under three contacts is zero at best — which is why a biped rolls.
 */
export function supportMargin(centre: Vec2, support: readonly Vec2[]): number {
  const points = support.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (points.length >= 3) {
    const ring = convexHull2(points)
    if (ring.length < 3) return points.length ? -nearestDistance(centre, points) : 0
    // Wind the ring the same way every time, so "left of the edge" is inside.
    let area = 0
    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index]
      const to = ring[(index + 1) % ring.length]
      area += from.x * to.y - to.x * from.y
    }
    const wound = area < 0 ? [...ring].reverse() : ring
    let margin = Number.POSITIVE_INFINITY
    for (let index = 0; index < wound.length; index += 1) {
      const from = wound[index]
      const to = wound[(index + 1) % wound.length]
      const length = Math.hypot(to.x - from.x, to.y - from.y)
      if (length < 1e-9) continue
      const cross =
        (to.x - from.x) * (centre.y - from.y) - (to.y - from.y) * (centre.x - from.x)
      margin = Math.min(margin, cross / length)
    }
    return Number.isFinite(margin) ? margin : -nearestDistance(centre, wound)
  }
  if (points.length === 2) return -segmentDistance(centre, points[0], points[1])
  if (points.length === 1) return -Math.hypot(centre.x - points[0].x, centre.y - points[0].y)
  return 0
}

const nearestDistance = (point: Vec2, points: readonly Vec2[]) =>
  Math.min(...points.map((other) => Math.hypot(point.x - other.x, point.y - other.y)))

function segmentDistance(point: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < 1e-12) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1)
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t))
}

/** Which gaits a leg count actually has. */
export const walkerGaits = (legs: WalkerLegCount): WalkerGait[] =>
  Object.keys(GAITS[legs === 2 ? 2 : 4]) as WalkerGait[]

/**
 * The nearest place the mass can stand and be held, along the line from the
 * hips to the middle of the feet that are down.
 *
 * `margin` is concave along any line across a convex polygon, so walking that
 * line finds the best point on it — and stops as soon as the machine is `inset`
 * inside the edge, because there is no reason to lean any further than that. A
 * support that cannot hold the mass anywhere (one foot, or a line) still
 * returns its best point, and the caller learns the rest from `margin`.
 */
function settle(support: readonly Vec2[], inset: number): Vec2 {
  const origin = { x: 0, y: 0 }
  if (!support.length) return origin
  if (supportMargin(origin, support) >= inset) return origin
  const middle = support.reduce(
    (sum, foot) => ({ x: sum.x + foot.x / support.length, y: sum.y + foot.y / support.length }),
    origin,
  )
  let best = origin
  let bestMargin = supportMargin(origin, support)
  const steps = 24
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps
    const point = { x: middle.x * t, y: middle.y * t }
    const margin = supportMargin(point, support)
    if (margin > bestMargin + 1e-9) {
      best = point
      bestMargin = margin
    }
    if (bestMargin >= inset) break
  }
  return best
}

/**
 * A point of the hull, in the hull's own frame, after the attitude is applied.
 *
 * Hull coordinates are the machine's: origin at the hip centre, x starboard, y
 * up, z toward the nose. Roll turns the hull in the frontal plane about the
 * fore-aft axis, then pitch turns what is left in the sagittal plane — the same
 * order the solver works the attitude out in, so a part drawn with this lands
 * exactly where the solver put the hips.
 */
function attitudePoint(local: Vec3, roll: number, pitch: number): Vec3 {
  const x = local.x * Math.cos(roll) + local.y * Math.sin(roll)
  const lifted = -local.x * Math.sin(roll) + local.y * Math.cos(roll)
  return {
    x,
    y: -local.z * Math.sin(pitch) + lifted * Math.cos(pitch),
    z: local.z * Math.cos(pitch) + lifted * Math.sin(pitch),
  }
}

/**
 * Where a point bolted to the hull ends up in the world, given a pose.
 *
 * World coordinates are x starboard, y height above the ground, z toward the
 * nose. Every hull-mounted part a component draws goes through this, which is
 * what keeps the drawing and the solved hips on the same machine.
 */
export function walkerHullPoint(pose: WalkerPose, local: Vec3): Vec3 {
  const moved = attitudePoint(
    {
      x: Number.isFinite(local.x) ? local.x : 0,
      y: Number.isFinite(local.y) ? local.y : 0,
      z: Number.isFinite(local.z) ? local.z : 0,
    },
    toRadians(pose.roll),
    toRadians(pose.pitch),
  )
  return { x: moved.x, y: pose.ride + moved.y, z: moved.z }
}
