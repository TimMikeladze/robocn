/**
 * Plantigrade stance: a foot that is a segment on the floor rather than a point,
 * the base of support that follows from it, and the share of the standing
 * weight at each contact.
 *
 * Every other quadruped in this registry stands on dots — `quadruped-kinematics`
 * and `hexapod-kinematics` both solve a chain to a foot *position*. A bear's
 * sole is heel and toe, so one foot is an **interval**, several feet union into
 * a base of support, and a base of support has edges a centre of mass can be
 * inside or outside of. That margin is the number these machines are built on,
 * and it is what makes rearing onto two legs a mechanism rather than a pose.
 *
 * Design note: docs/ursine-robots.md.
 */
import {
  clamp,
  clampToReach2,
  solveChain2,
  type Bend,
  type Vec2,
} from "@/lib/robocn/kinematics"

/** Which part of the sole is on the floor. */
export type SolePivot = "heel" | "flat" | "toe"
/** What the sole is actually doing, read off the geometry rather than asked for. */
export type SoleContact = "flat" | "heel" | "toe" | "airborne"

export interface SoleOptions {
  /** Hip or shoulder, in the animal's own frame: x nose-ward, y up. */
  hip: Vec2
  /** Where the pivot sits: x along the floor, y above it. */
  plant: Vec2
  /** Which point of the sole `plant` refers to: its heel end, its middle, its toe end. */
  pivot?: SolePivot
  /** Sole angle in degrees, positive toe-up. */
  pitch?: number
  /** Upper and lower limb lengths, hip to knee to ankle. */
  femur: number
  tibia: number
  /** Sole behind and in front of the ankle's projection onto it. */
  heel: number
  toe: number
  /** Ankle height above the sole line. */
  ankle: number
  /** Which way the knee breaks. */
  bend?: Bend
  /** Floor height in the same frame. */
  floor?: number
}

export interface SolePose {
  hip: Vec2
  knee: Vec2
  ankle: Vec2
  heel: Vec2
  toe: Vec2
  /** The sole angle actually drawn, in degrees. */
  pitch: number
  contact: SoleContact
  /** Grounded interval along the floor, degenerate at a roll, null in the air. */
  span: [number, number] | null
  /** False when the hip could not get to the ankle the placement asked for. */
  reached: boolean
}

export interface SupportContact {
  id: string
  /** Grounded interval along the floor; null is a limb in the air. */
  span: [number, number] | null
}

export interface SupportPose {
  /** The base of support: the union hull of the grounded intervals. */
  span: [number, number] | null
  com: number
  /** 1 dead centre, 0 on an edge, negative outside the base. */
  margin: number
  stable: boolean
  /** Static share of the standing weight at each contact; sums to 1. */
  loads: Record<string, number>
}

export interface StepOptions {
  /** Foot travel either side of the nominal stance point. */
  reach?: number
  /** Peak swing height. */
  clearance?: number
  /** Fraction of the cycle the sole spends on the floor, 0.35–0.9. */
  duty?: number
}

export interface StepPose {
  /** Where the pivot is: x along the floor, y above it. */
  plant: Vec2
  pivot: SolePivot
  pitch: number
  /** Which part of the step this is. */
  roll: "strike" | "flat" | "off" | "swing"
  contact: boolean
}

/** The sole angles a step rolls through, and the fractions of the stance it rolls at. */
export const soleLimits = {
  /** Toe-up at heel strike, and heel-up at toe-off. */
  strike: 18,
  off: 26,
  /** Stance fractions the sole is flat between. */
  down: 0.18,
  lift: 0.72,
} as const

const RIGHT_ANGLE = Math.PI / 2
/** Anything inside this of the floor counts as touching it. */
const TOUCH = 1e-6

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback
const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * One plantigrade limb, placed by its foot.
 *
 * The sole is rigid: heel and toe are stepped off one direction vector from the
 * ankle's projection, so the segment is exactly `heel + toe` long at every
 * pitch. `plant` and `pivot` say where the sole touches the floor, the ankle
 * falls out of that placement, and the two links are solved *to* the ankle —
 * the inversion this family needs, because a foot is placed the way a foot is
 * placed and the leg answers for it.
 *
 * Two corrections, in this order, and both are reported rather than hidden:
 * a sole that would sink below the floor lifts the whole limb until it does
 * not, and an ankle the hip cannot reach is clamped to the chain's reach with
 * the sole riding along rigidly, at which point the contact is `"airborne"`.
 */
export function solveSole({
  hip,
  plant,
  pivot = "flat",
  pitch = 0,
  femur,
  tibia,
  heel,
  toe,
  ankle,
  bend = "up",
  floor = 0,
}: SoleOptions): SolePose {
  const root: Vec2 = { x: finite(hip?.x, 0), y: finite(hip?.y, 0) }
  const ground = finite(floor, 0)
  const back = Math.max(0, finite(heel, 0))
  const front = Math.max(0, finite(toe, 0))
  const rise = Math.max(0, finite(ankle, 0))
  const links = [Math.max(0.01, finite(femur, 1)), Math.max(0.01, finite(tibia, 1))]
  const place: Vec2 = { x: finite(plant?.x, 0), y: finite(plant?.y, ground) }
  const angle = clamp(finite(pitch, 0), -80, 80)

  // The sole's own frame: along it toe-ward, and its upward normal.
  const a = toRadians(angle)
  const along: Vec2 = { x: Math.cos(a), y: Math.sin(a) }
  const up: Vec2 = { x: Math.cos(a + RIGHT_ANGLE), y: Math.sin(a + RIGHT_ANGLE) }

  // Where the ankle's projection sits, given which part of the sole is planted.
  const offset = pivot === "heel" ? back : pivot === "toe" ? -front : (back - front) / 2
  let base: Vec2 = { x: place.x + along.x * offset, y: place.y + along.y * offset }

  const soleEnds = (origin: Vec2) => ({
    heel: { x: origin.x - along.x * back, y: origin.y - along.y * back },
    toe: { x: origin.x + along.x * front, y: origin.y + along.y * front },
  })

  // A rigid sole does not go through the floor: lift the limb rather than bend it.
  const ends = soleEnds(base)
  const sunk = ground - Math.min(ends.heel.y, ends.toe.y)
  if (sunk > 0) base = { x: base.x, y: base.y + sunk }

  let ankleAt: Vec2 = { x: base.x + up.x * rise, y: base.y + up.y * rise }
  // `clampToReach2` pulls the ankle onto the annulus the chain can touch, at
  // both ends: too far out and too far folded.
  const goal = clampToReach2(root, ankleAt, links)
  const reached = Math.hypot(goal.x - ankleAt.x, goal.y - ankleAt.y) < 1e-4
  if (!reached) {
    // The foot goes where the limb can put it and the sole rides with it.
    base = { x: goal.x - up.x * rise, y: goal.y - up.y * rise }
    ankleAt = goal
  }

  const [, knee, solved] = solveChain2(root, ankleAt, links, { bend })
  const placed = soleEnds(base)
  const heelDown = reached && placed.heel.y - ground <= TOUCH
  const toeDown = reached && placed.toe.y - ground <= TOUCH
  const contact: SoleContact =
    heelDown && toeDown ? "flat" : heelDown ? "heel" : toeDown ? "toe" : "airborne"
  const span: [number, number] | null =
    contact === "flat"
      ? [Math.min(placed.heel.x, placed.toe.x), Math.max(placed.heel.x, placed.toe.x)]
      : contact === "heel"
        ? [placed.heel.x, placed.heel.x]
        : contact === "toe"
          ? [placed.toe.x, placed.toe.x]
          : null

  return {
    hip: root,
    knee,
    ankle: solved,
    heel: placed.heel,
    toe: placed.toe,
    pitch: angle,
    contact,
    span,
    reached,
  }
}

/**
 * The base of support, and what each contact is carrying.
 *
 * Two constraints fix the loads — they sum to one body, and the load-weighted
 * mean of the contact positions *is* the centre of mass — and the minimum-norm
 * solution of those two is closed form:
 *
 *     load(i) = 1/n + (com − x̄)(x(i) − x̄) / Σ (x(j) − x̄)²
 *
 * For two contacts that is exactly the lever rule. A load that comes out
 * negative is a foot being pulled off the floor — the centre of mass is outside
 * the base — so it is clamped to zero and the rest renormalized; `stable`
 * already said as much. This is a **static** weight distribution and not a
 * dynamics solve: no acceleration, no ground reaction, no centre of pressure.
 */
export function solveSupport(
  contacts: readonly SupportContact[],
  com: number,
): SupportPose {
  const list = Array.isArray(contacts) ? contacts : []
  const loads: Record<string, number> = {}
  for (const contact of list) if (contact?.id) loads[contact.id] = 0

  const down = list.filter(
    (contact): contact is SupportContact & { span: [number, number] } =>
      Boolean(contact?.id) &&
      Array.isArray(contact.span) &&
      Number.isFinite(contact.span[0]) &&
      Number.isFinite(contact.span[1]),
  )
  const centreOfMass = finite(com, 0)
  if (down.length === 0) {
    return { span: null, com: centreOfMass, margin: -1, stable: false, loads }
  }

  const low = Math.min(...down.map((contact) => Math.min(contact.span[0], contact.span[1])))
  const high = Math.max(...down.map((contact) => Math.max(contact.span[0], contact.span[1])))
  const centre = (low + high) / 2
  const half = (high - low) / 2
  const margin =
    half > TOUCH
      ? clamp(1 - Math.abs(centreOfMass - centre) / half, -1, 1)
      : Math.abs(centreOfMass - centre) <= TOUCH
        ? 0
        : -1
  const stable = centreOfMass >= low - TOUCH && centreOfMass <= high + TOUCH

  // Each contact answers from its own midpoint.
  const points = down.map((contact) => (contact.span[0] + contact.span[1]) / 2)
  const mean = points.reduce((sum, x) => sum + x, 0) / points.length
  const spread = points.reduce((sum, x) => sum + (x - mean) ** 2, 0)
  const share = points.map((x) =>
    spread > TOUCH
      ? 1 / points.length + ((centreOfMass - mean) * (x - mean)) / spread
      : 1 / points.length,
  )
  // Negative means that foot is being lifted off, which is a fall, not a pull.
  const clipped = share.map((value) => Math.max(0, value))
  const total = clipped.reduce((sum, value) => sum + value, 0)
  down.forEach((contact, index) => {
    loads[contact.id] = total > TOUCH ? clipped[index] / total : 1 / clipped.length
  })

  return { span: [low, high], com: centreOfMass, margin, stable, loads }
}

/**
 * Where one sole is in its own step.
 *
 * A digitigrade foot has one state; this has four. It strikes on the heel with
 * the toe still up, rolls down onto the whole sole, spends the middle of the
 * stance **flat** — which is the only reason a bear can stop mid-stride and
 * stand up — then rolls off the toe and swings forward toe-up for the next
 * strike. Illustrative: no ground reaction, and the animal does not travel.
 */
export function plantigradeStep(t: number, options: StepOptions = {}): StepPose {
  const { reach = 12, clearance = 8, duty = 0.62 } = options
  const travel = Math.max(0, finite(reach, 12))
  const lift = Math.max(0, finite(clearance, 8))
  const hold = Number.isFinite(duty) ? clamp(duty, 0.35, 0.9) : 0.62
  const cycle = wrap(t)

  if (cycle < hold) {
    // Stance: the contact point is carried backwards while the sole rolls.
    const s = hold > 0 ? cycle / hold : 0
    const x = travel * (1 - 2 * s)
    if (s < soleLimits.down) {
      const k = s / soleLimits.down
      return {
        plant: { x, y: 0 },
        pivot: "heel",
        pitch: soleLimits.strike * (1 - k),
        roll: "strike",
        contact: true,
      }
    }
    if (s < soleLimits.lift) {
      return { plant: { x, y: 0 }, pivot: "flat", pitch: 0, roll: "flat", contact: true }
    }
    const k = (s - soleLimits.lift) / (1 - soleLimits.lift)
    return {
      plant: { x, y: 0 },
      pivot: "toe",
      pitch: -soleLimits.off * k,
      roll: "off",
      contact: true,
    }
  }

  const swing = (cycle - hold) / (1 - hold)
  return {
    plant: { x: -travel * Math.cos(Math.PI * swing), y: lift * Math.sin(Math.PI * swing) },
    pivot: "flat",
    // Off the toe, back through flat, and up onto the heel for the next strike.
    pitch: -soleLimits.off * (1 - swing) + soleLimits.strike * swing,
    roll: "swing",
    contact: false,
  }
}
