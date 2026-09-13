/**
 * Equine gaits: footfall sequence, support pattern, and the share of the body
 * each contact point carries.
 *
 * `quadruped-kinematics` solves four planar legs and spreads quarter-cycle
 * offsets around a phase. This solves the other half of the problem and solves
 * no legs at all: *which* feet are down, *when* they land, how many distinct
 * beats that makes, and what fraction of the standing weight each grounded
 * limb takes. Components own their own limb chains and read the load off this.
 *
 * Design note: docs/equine-robots.md.
 */
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

export type EquineGait = "halt" | "walk" | "trot" | "pace" | "canter" | "gallop"
export type GaitLead = "left" | "right"
export type GaitLegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

export interface GaitOptions {
  gait?: EquineGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Which foreleg lands last. Only the canter and the gallop have one. */
  lead?: GaitLead
  /** Override the gait's own duty factor, 0–1. The fraction of the cycle one limb spends down. */
  duty?: number
  /** Normalized foot travel, 0–1. */
  stride?: number
  /** Normalized swing height, 0–1. */
  lift?: number
}

export interface GaitLeg {
  id: GaitLegId
  side: "left" | "right"
  fore: boolean
  /** Where in the cycle this limb touches down, 0–1. */
  touchdown: number
  /** Time since its own touchdown, 0–1. */
  t: number
  contact: boolean
  /** Share of the body's weight on this limb right now, 0 in the air. */
  load: number
  /** Foot displacement from its nominal stance point: x nose-ward, y up. */
  foot: Vec2
}

export interface GaitPose {
  gait: EquineGait
  /** Distinct footfall instants per stride, counted from the offsets. */
  beats: number
  duty: number
  lead: GaitLead
  /** The foreleg that lands last, or null for a symmetrical gait. */
  leadLeg: GaitLegId | null
  /** How many feet are on the floor. */
  support: number
  airborne: boolean
  /** Static share of the weight on the forehand when every foot is down. */
  forehand: number
  legs: GaitLeg[]
}

/**
 * Foot travel at `stride` 1, swing height at `lift` 1, the fetlock's full drop,
 * how far a loaded pad spreads past its own width, and how deep a foot goes
 * into fully soft ground at the pressure a bare unspread pad makes.
 */
export const gaitLimits = { reach: 16, clearance: 11, fetlock: 30, spread: 0.55, sinkage: 9 } as const

/** The standing weight split: a horse carries more of itself on the forehand. */
const FOREHAND = 0.58

/**
 * When each limb lands, as a fraction of the stride. These are the gaits
 * themselves — everything else in the pose is derived from them.
 *
 * Written for a right lead, so the right fore lands last where there is a lead
 * at all; `left` mirrors the two sides.
 */
const footfalls: Record<EquineGait, { order: Record<GaitLegId, number>; duty: number }> = {
  // Standing square: no cycle, so no footfall and no beat.
  halt: {
    order: { "fore-left": 0, "fore-right": 0, "hind-left": 0, "hind-right": 0 },
    duty: 1,
  },
  // Four beats, lateral sequence: LH, LF, RH, RF. Duty over a half means two
  // feet are always down and the walk never leaves the floor.
  walk: {
    order: { "hind-left": 0, "fore-left": 0.25, "hind-right": 0.5, "fore-right": 0.75 },
    duty: 0.65,
  },
  // Two beats on diagonal pairs, with a suspension between them.
  trot: {
    order: { "fore-left": 0, "hind-right": 0, "fore-right": 0.5, "hind-left": 0.5 },
    duty: 0.45,
  },
  // Two beats on lateral pairs. The same count as a trot on the other diagonal,
  // which is why a beat count alone does not name a gait.
  pace: {
    order: { "fore-left": 0, "hind-left": 0, "fore-right": 0.5, "hind-right": 0.5 },
    duty: 0.45,
  },
  // Three beats: the outside hind, then the diagonal pair, then the lead fore.
  // The intervals are uneven on purpose — that is what leaves room for exactly
  // one suspension after the leading fore comes off, and no gaps before it.
  canter: {
    order: { "hind-left": 0, "hind-right": 0.28, "fore-left": 0.28, "fore-right": 0.56 },
    duty: 0.4,
  },
  // Four beats: the canter's diagonal broken apart, and a real suspension.
  gallop: {
    order: { "hind-left": 0, "hind-right": 0.2, "fore-left": 0.45, "fore-right": 0.65 },
    duty: 0.3,
  },
}

const ids: GaitLegId[] = ["fore-left", "fore-right", "hind-left", "hind-right"]
/** Gaits whose two sides differ, and so have a lead to swap. */
const handed: EquineGait[] = ["canter", "gallop"]

const mirrored: Record<GaitLegId, GaitLegId> = {
  "fore-left": "fore-right",
  "fore-right": "fore-left",
  "hind-left": "hind-right",
  "hind-right": "hind-left",
}

const unit = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : fallback
const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const resolveGait = (gait: EquineGait): EquineGait =>
  gait in footfalls ? gait : "halt"

/**
 * How many distinct footfalls a stride of this gait has. Counted from the
 * touchdown instants rather than declared, which is what makes the walk /
 * trot / canter distinction a fact about the numbers.
 */
export function gaitBeats(gait: EquineGait): number {
  const name = resolveGait(gait)
  if (name === "halt") return 0
  const { order } = footfalls[name]
  return new Set(ids.map((id) => Number(order[id].toFixed(4)))).size
}

/**
 * One instant of a gait: who is down, and what each of them is carrying.
 *
 * A limb is in stance for `duty` of the cycle after its own touchdown; the
 * stance carries the foot backwards and the swing arcs it forward with ground
 * clearance. The load is a **static** weight distribution — the forehand's
 * share divided among whichever feet are down — not a dynamics solve. No
 * acceleration, no ground reaction, no centre of pressure.
 */
export function solveGait({
  gait = "halt",
  phase = 0,
  lead = "right",
  duty,
  stride = 0.7,
  lift = 0.5,
}: GaitOptions = {}): GaitPose {
  const name = resolveGait(gait)
  const plan = footfalls[name]
  const swap = handed.includes(name) && lead === "left"
  const hold = unit(duty ?? plan.duty, plan.duty)
  const reach = gaitLimits.reach * unit(stride, 0.7)
  const clearance = gaitLimits.clearance * unit(lift, 0.5)
  const cycle = wrap(phase)
  const still = hold >= 1

  const sampled = ids.map((id) => {
    const touchdown = plan.order[swap ? mirrored[id] : id]
    const t = wrap(cycle - touchdown)
    const contact = still || t < hold
    return { id, touchdown, t, contact }
  })

  // The weight is shared out among whatever is on the floor, so it always sums
  // to exactly one body while anything is down and to nothing when it is not.
  const weight = (id: GaitLegId) => (id.startsWith("fore") ? FOREHAND : 1 - FOREHAND)
  const carried = sampled.reduce(
    (sum, leg) => (leg.contact ? sum + weight(leg.id) : sum),
    0,
  )

  const legs = sampled.map(({ id, touchdown, t, contact }): GaitLeg => {
    let foot: Vec2 = { x: 0, y: 0 }
    if (!still) {
      if (contact) {
        // Planted: the floor carries the foot backwards under the body.
        foot = { x: reach * (1 - (2 * t) / hold), y: 0 }
      } else {
        const swing = (t - hold) / (1 - hold)
        foot = {
          x: -reach * Math.cos(Math.PI * swing),
          y: clearance * Math.sin(Math.PI * swing),
        }
      }
    }
    return {
      id,
      side: id.endsWith("left") ? "left" : "right",
      fore: id.startsWith("fore"),
      touchdown,
      t,
      contact,
      load: contact && carried > 0 ? weight(id) / carried : 0,
      foot,
    }
  })

  const support = legs.filter((leg) => leg.contact).length
  return {
    gait: name,
    beats: gaitBeats(name),
    duty: hold,
    lead,
    leadLeg: handed.includes(name) ? (swap ? "fore-left" : "fore-right") : null,
    support,
    airborne: support === 0,
    forehand: FOREHAND,
    legs,
  }
}

/** The load on one limb, or zero for a limb this pose does not have. */
export function gaitLoad(pose: GaitPose, id: GaitLegId): number {
  return pose.legs.find((leg) => leg.id === id)?.load ?? 0
}

/**
 * The sprung fetlock: how far the pastern drops, in degrees, under a load.
 *
 * A horse's fetlock is passive — the suspensory apparatus lets the joint sink
 * under weight and returns it when the limb comes free — so the angle is an
 * output of whichever gait is running rather than something anybody sets. A
 * proportional rule, not a stiffness: there is no spring rate and no damping.
 */
export function fetlockSink(load: number): number {
  return gaitLimits.fetlock * unit(load, 0)
}

/**
 * A spreading pad: how much wider than its own width a foot gets under load.
 *
 * A desert foot is a splay pad rather than a hoof — it opens as weight comes on
 * to it and closes again when the limb swings — so this is the same primitive
 * as {@link fetlockSink}, read off the same load, with a different consequence.
 * Returns a multiplier on the pad's unloaded width, 1 at no load.
 */
export function padSpread(load: number): number {
  return 1 + gaitLimits.spread * unit(load, 0)
}

/**
 * How far a foot sinks into the ground, in world units.
 *
 * Pressure is load over contact area, and how far that pressure takes the foot
 * down depends on how soft the ground is: rock takes nothing, dry sand takes
 * most of it. The spread is what makes the difference — a pad that opens under
 * load drops its own pressure, so the same animal on the same sand sinks less
 * than it would on a foot that did not open.
 *
 * A proportional rule, not a soil model: no bearing capacity, no shear, no
 * compaction, and nothing is displaced anywhere it has to go.
 */
export function footSinkage(load: number, ground: number, spread = padSpread(load)): number {
  const soft = unit(ground, 0)
  const area = Number.isFinite(spread) ? Math.max(1, spread) : 1
  return (gaitLimits.sinkage * unit(load, 0) * soft) / area
}
