/**
 * bore-geometry — what it costs to cut a hole, the hole that cutting leaves,
 * and where the material that came out of it went.
 *
 * Every other machine in the set moves in front of a background it never
 * touches. A boring head's whole job is to change that background, so the
 * honest question is what can actually be computed about excavation rather
 * than drawn:
 *
 * - **Penetration from an energy balance.** {@link boreDuty} is Teale's
 *   mechanical specific energy read the useful way round. Power at the bit is
 *   `2π·rev·torque`; the material costs `Es` work per unit volume; the bit
 *   sweeps `πr²` per unit of advance. Dividing gives the rate of penetration,
 *   and advance per revolution, chip thickness per cutter and muck flow all
 *   fall out of it. Below the face's stall torque the rate is zero — a bit
 *   pushed into rock too hard for it does not creep, it stops.
 * - **The cavity is a real intersection.** {@link boreCavity} clips the bit's
 *   swept envelope — a full-gauge cylinder behind a nose cone — against the
 *   slab, at both faces. A half-driven bit leaves a cone-bottomed hole; one
 *   nearly through leaves a hole that opens at the far face at exactly the
 *   diameter it has reached.
 * - **The spoil is the hole.** {@link spoilHeap} inverts the cone volume, so
 *   the heap at the collar is the volume that came out of the wall, standing
 *   at the material's own angle of repose.
 * - **Spall is ballistic.** {@link boreSpall} launches each fragment off the
 *   kerf rim and integrates `p₀ + v t + ½ g t²`. Deterministic in the clock,
 *   so there is no randomness to desynchronise.
 *
 * The fracture pattern ({@link boreFractures}) is a **drawing**: it grows with
 * depth and with the material, but nothing here is fracture mechanics. Say so
 * wherever it is used.
 *
 * Coordinates are the caller's own picture units, x along the bore axis and y
 * across it; nothing here assumes a viewBox, a camera or a direction for y.
 *
 * Pure functions over plain objects. No React, no three.js, no dependencies.
 *
 * Design note: docs/bore-construct.md.
 */

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

const TAU = Math.PI * 2

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

const span = (value: number | undefined, fallback: number) =>
  Math.abs(finite(value, fallback))

/**
 * A deterministic unit value for `index`. Spall has to look like rubble
 * without being random, or two renders of the same clock disagree.
 */
const hash = (index: number, salt = 0) => {
  const h = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return h - Math.floor(h)
}

/* -------------------------------------------------------------------------- */
/* the duty                                                                    */
/* -------------------------------------------------------------------------- */

/** What the head is, and what it is being asked to cut. */
export interface BoreSpec {
  /** Gauge radius of the bit, in picture units. */
  radius: number
  /** Cutters on the head. Sets how the advance is shared out as chips. */
  cutters: number
  /** Spindle speed, revolutions per second. */
  rev: number
  /** Torque at the bit, 0 free to 1 the drive's rating. */
  torque: number
  /** How hard the material is, 0 spoil to 1 hard rock. */
  hardness: number
  /** How much of the shaft power reaches the face. */
  efficiency: number
}

export const defaultBoreSpec: BoreSpec = {
  radius: 15,
  cutters: 8,
  rev: 1.1,
  torque: 0.72,
  hardness: 0.45,
  efficiency: 0.34,
}

/**
 * Torque at the drive's rating, in work units per radian, and the scale
 * constant of this whole module. The set draws in picture units, so it is
 * chosen to make a nominal head advance a few units a second — it is not taken
 * from any real machine and nothing here claims otherwise.
 */
const RATED_TORQUE = 1.35e4

/** Specific energy of the softest and hardest material this models. */
const ES_SOFT = 0.55
const ES_HARD = 7.4

/** What one unit of volume costs to remove, for a material of `hardness`. */
export function specificEnergy(hardness: number): number {
  const h = clamp(finite(hardness, 0.5), 0, 1)
  // Rock strength runs away faster than the number people set, so the curve is
  // convex: the top of the range is where a head actually gets into trouble.
  return ES_SOFT + (ES_HARD - ES_SOFT) * h * h
}

/**
 * The torque a face demands before it will turn at all, as a fraction of the
 * drive's rating. Below it the bit is stalled: rubbing, not cutting.
 */
export function stallTorque(hardness: number): number {
  return clamp(0.06 + clamp(finite(hardness, 0.5), 0, 1) * 0.42, 0, 1)
}

/** Everything the energy balance says about one head on one material. */
export interface BoreDuty {
  /** Work per unit volume the material costs. */
  specificEnergy: number
  /** Power at the bit: `2π · rev · torque · rating`. */
  power: number
  /** The torque the face demands before it turns, 0 to 1. */
  stall: number
  /** False when the face has won: nothing advances. */
  turning: boolean
  /** Rate of penetration, picture units per second. */
  rate: number
  /** Advance in one revolution. Zero when stalled or stopped. */
  advancePerRev: number
  /** The chip one cutter takes in one revolution. */
  chip: number
  /** Volume removed per second. */
  flow: number
}

/**
 * The energy balance. `rate = η · P / (A · Es)` — the power that reaches the
 * face, divided by what a unit of advance costs to remove.
 *
 * Rubbish in gives a stalled duty rather than `NaN`, which is what lets a
 * caller hand it a prop straight from a stranger's render.
 */
export function boreDuty(spec: Partial<BoreSpec> = {}): BoreDuty {
  const radius = Math.max(0.5, span(spec.radius, defaultBoreSpec.radius))
  const cutters = Math.max(1, Math.round(span(spec.cutters, defaultBoreSpec.cutters)))
  const rev = Math.max(0, span(spec.rev, defaultBoreSpec.rev))
  const torque = clamp(finite(spec.torque, defaultBoreSpec.torque), 0, 1)
  const hardness = clamp(finite(spec.hardness, defaultBoreSpec.hardness), 0, 1)
  const efficiency = clamp(finite(spec.efficiency, defaultBoreSpec.efficiency), 0, 1)

  const energy = specificEnergy(hardness)
  const stall = stallTorque(hardness)
  const turning = torque > stall && rev > 0
  const power = TAU * rev * torque * RATED_TORQUE
  const area = Math.PI * radius * radius
  // Only the torque above stall does any cutting; the rest is spent on the
  // face without moving the head forward.
  const cutting = turning ? (torque - stall) / Math.max(1e-6, 1 - stall) : 0
  const rate = turning ? (efficiency * power * cutting) / (area * energy) : 0

  return {
    specificEnergy: energy,
    power,
    stall,
    turning,
    rate,
    advancePerRev: rev > 0 ? rate / rev : 0,
    chip: rev > 0 ? rate / rev / cutters : 0,
    flow: area * rate,
  }
}

/* -------------------------------------------------------------------------- */
/* the cavity                                                                  */
/* -------------------------------------------------------------------------- */

/** The slab being bored, in drawing coordinates. */
export interface BoreWall {
  /** x of the near face, where the bit goes in. */
  face: number
  /** Thickness along the bore axis. */
  thickness: number
  /** y of the bore axis. */
  axis: number
  /** y of the bottom of the section drawn. */
  base: number
  /** y of the top of it. */
  top: number
}

export const defaultBoreWall: BoreWall = {
  face: 0,
  thickness: 46,
  axis: 62,
  base: 0,
  top: 150,
}

export interface BoreCavity {
  /** How far the crown has passed the near face. Negative before contact. */
  depth: number
  /** 0 at the near face, 1 once the crown is clear of the far one. */
  progress: number
  /** The crown is clear of the far face. */
  through: boolean
  /**
   * The far side giving way: 0 while more than a nose-length of material is
   * left ahead of the crown, 1 once the crown is out of it. This is the moment
   * worth drawing.
   */
  breakthrough: number
  /** Radius the hole has actually reached where it meets the far face. */
  exitRadius: number
  /** Volume taken out of the slab. */
  volume: number
  /** The slab's outline, wound one way. */
  outline: Vec2[]
  /**
   * The hole, as a second subpath: outline and hole in one path under
   * `fill-rule="evenodd"` is a slab with a bore through it. Empty before
   * contact.
   */
  hole: Vec2[]
}

/** Points down the nose cone, from gauge to apex. */
const NOSE_STEPS = 7

/** Nose-cone length as a multiple of the gauge radius. */
export const BORE_TAPER = 1.15

/**
 * Half-width of the bit's swept envelope at a drawing x — the function
 * {@link boreCavity} clips against, and the one anything drawn *inside* the
 * wall has to respect. Courses, strata and reinforcement interrupted by this
 * stop exactly where the bore has eaten them, and a bit drawn inside it never
 * stands outside its own hole.
 */
export function boreEnvelope(
  depth: number,
  spec: Partial<BoreSpec> = {},
  wall: Partial<BoreWall> = {},
): (x: number) => number {
  const radius = Math.max(0.5, span(spec.radius, defaultBoreSpec.radius))
  const face = finite(wall.face, defaultBoreWall.face)
  const taper = radius * BORE_TAPER
  const front = face + finite(depth, 0)
  return (x: number) => clamp(((front - finite(x, 0)) / taper) * radius, 0, radius)
}

/**
 * The hole a bit at `depth` has cut in `wall`: the intersection of the swept
 * envelope — a full-gauge cylinder behind a cone of length `taper` — with the
 * slab, clipped at both faces.
 *
 * Advance is monotonic, so the envelope at the current depth already contains
 * every earlier one and there is no history to keep.
 */
export function boreCavity(
  depth: number,
  spec: Partial<BoreSpec> = {},
  wall: Partial<BoreWall> = {},
): BoreCavity {
  const radius = Math.max(0.5, span(spec.radius, defaultBoreSpec.radius))
  const face = finite(wall.face, defaultBoreWall.face)
  const thickness = Math.max(1e-3, span(wall.thickness, defaultBoreWall.thickness))
  const axis = finite(wall.axis, defaultBoreWall.axis)
  const base = finite(wall.base, defaultBoreWall.base)
  const top = finite(wall.top, defaultBoreWall.top)
  const taper = radius * BORE_TAPER
  const back = face + thickness

  const cut = finite(depth, 0)
  const front = face + cut
  const outline: Vec2[] = [
    { x: face, y: base },
    { x: back, y: base },
    { x: back, y: top },
    { x: face, y: top },
  ]

  // Half-width of the envelope at x: gauge behind the cone, tapering to a
  // point at the crown.
  const halfWidth = (x: number) =>
    clamp(((front - x) / taper) * radius, 0, radius)

  const clipped = clamp(front, face, back)
  const shoulder = clamp(front - taper, face, back)
  // ∫ π·halfWidth(x)² dx across the slab, in its two pieces: the full-gauge
  // barrel behind the shoulder, and the frustum of the nose cone in front of
  // it. Both are clipped to the slab, so nothing is charged for material that
  // is not there.
  const coneFrom = Math.max(face, front - taper)
  const coneTo = Math.max(coneFrom, clipped)
  const volume =
    Math.PI * radius * radius * Math.max(0, shoulder - face) +
    (Math.PI * radius * radius * ((front - coneFrom) ** 3 - (front - coneTo) ** 3)) /
      (3 * taper * taper)

  if (cut <= 0) {
    return {
      depth: cut,
      progress: 0,
      through: false,
      breakthrough: 0,
      exitRadius: 0,
      volume: 0,
      outline,
      hole: [],
    }
  }

  // The mouth is gauge once the shoulder is inside the slab, and the cone's
  // own width while the bit is still entering.
  const mouth = halfWidth(face)
  const upper: Vec2[] = [{ x: face, y: axis + mouth }]
  const lower: Vec2[] = [{ x: face, y: axis - mouth }]
  if (shoulder > face) {
    upper.push({ x: shoulder, y: axis + radius })
    lower.push({ x: shoulder, y: axis - radius })
  }
  for (let i = 1; i <= NOSE_STEPS; i += 1) {
    const x = shoulder + ((clipped - shoulder) * i) / NOSE_STEPS
    if (x <= shoulder) continue
    const half = halfWidth(x)
    upper.push({ x, y: axis + half })
    lower.push({ x, y: axis - half })
  }

  // Up the top edge, round the nose, back down the bottom edge — the opposite
  // winding to the outline above, which is what evenodd needs.
  const hole = [...upper, ...lower.reverse()]

  const exitRadius = halfWidth(back)
  return {
    depth: cut,
    progress: clamp(cut / (thickness + taper), 0, 1),
    through: front >= back,
    breakthrough: clamp((cut - (thickness - taper)) / taper, 0, 1),
    exitRadius,
    volume,
    outline,
    hole,
  }
}

/* -------------------------------------------------------------------------- */
/* what came out                                                               */
/* -------------------------------------------------------------------------- */

export interface SpoilHeap {
  /** Half-width of the heap at its base. */
  radius: number
  /** Height at the peak. */
  height: number
  /** The heap's profile, left toe to right toe. */
  outline: Vec2[]
}

/**
 * The muck pile the excavated volume makes, standing at its own angle of
 * repose: `V = ⅓πR²·R·tan α`, so `R = (3V / π tan α)^⅓`. Conservation is the
 * whole point — the heap is the hole, which is why it grows as a cube root.
 */
export function spoilHeap(
  volume: number,
  repose = 34,
  at: Vec2 = { x: 0, y: 0 },
): SpoilHeap {
  const v = Math.max(0, finite(volume, 0))
  const angle = clamp(finite(repose, 34), 5, 75)
  const tangent = Math.tan((angle * Math.PI) / 180)
  const radius = Math.cbrt((3 * v) / (Math.PI * tangent))
  const height = radius * tangent
  const cx = finite(at?.x, 0)
  const cy = finite(at?.y, 0)
  // A heap slumps at the toes rather than meeting the floor at the full
  // repose angle; two intermediate points are enough to read as loose muck.
  const outline: Vec2[] = [
    { x: cx - radius, y: cy },
    { x: cx - radius * 0.55, y: cy + height * 0.52 },
    { x: cx, y: cy + height },
    { x: cx + radius * 0.55, y: cy + height * 0.52 },
    { x: cx + radius, y: cy },
  ]
  return { radius, height, outline }
}

/** One piece of rubble off the kerf. */
export interface Spall {
  x: number
  y: number
  /** Out of the drawing plane, so the debris is a cloud rather than a fan. */
  depth: number
  size: number
  /** Degrees, for a fragment that tumbles as it flies. */
  spin: number
  /** 0 at launch, 1 at the end of its life. */
  age: number
}

export interface SpallOptions {
  /** How many fragments are in the air at once. */
  count?: number
  /** Seconds each one is drawn for. */
  life?: number
  /** Launch speed, picture units per second. */
  speed?: number
  /** Downward acceleration. */
  gravity?: number
  /** Where the kerf is: the bit's crown, in drawing coordinates. */
  at?: Vec2
}

/**
 * Rubble thrown off the kerf, integrated ballistically:
 * `p = p₀ + v t + ½ g t²`. The launch point walks the kerf rim, and the
 * fragment's speed, size and spin come from a deterministic hash — so the
 * field is reproducible frame to frame and identical on the server.
 *
 * `flow` scales the whole field: nothing is thrown by a stalled head.
 */
export function boreSpall(
  clock: number,
  flow: number,
  spec: Partial<BoreSpec> = {},
  options: SpallOptions = {},
): Spall[] {
  const t = finite(clock, 0)
  const strength = clamp(finite(flow, 0), 0, 1)
  if (strength <= 0.01) return []

  const radius = Math.max(0.5, span(spec.radius, defaultBoreSpec.radius))
  const count = Math.max(0, Math.min(64, Math.round(span(options.count, 14))))
  const life = Math.max(0.05, span(options.life, 0.85))
  const speed = Math.max(0, span(options.speed, 46)) * (0.45 + strength * 0.55)
  const gravity = finite(options.gravity, -120)
  const ox = finite(options.at?.x, 0)
  const oy = finite(options.at?.y, 0)

  const out: Spall[] = []
  for (let i = 0; i < count; i += 1) {
    // Each fragment runs its own life, offset so they do not all launch at once.
    const age = (((t / life + i / count) % 1) + 1) % 1
    const flight = age * life
    const around = hash(i) * TAU
    const kick = 0.55 + hash(i, 1) * 0.75
    // Launched off the rim, outward and back along the bore.
    const vx = -speed * kick * (0.35 + hash(i, 2) * 0.5)
    const vOut = speed * kick
    out.push({
      x: ox + vx * flight,
      y: oy + Math.sin(around) * radius + vOut * Math.sin(around) * flight + 0.5 * gravity * flight * flight,
      depth: Math.cos(around) * radius + vOut * Math.cos(around) * flight * 0.6,
      size: 0.8 + hash(i, 3) * 2.4,
      spin: (hash(i, 4) * 720 - 360) * flight,
      age,
    })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* the wall giving way                                                         */
/* -------------------------------------------------------------------------- */

/** A crack radiating from the bore. A drawing, not fracture mechanics. */
export interface Fracture {
  points: Vec2[]
  /** 0 hairline to 1 open. */
  weight: number
}

/**
 * The fracture pattern around a bore, deterministic in everything it is given.
 * Cracks start on the bore wall, run outward, and grow with depth and with the
 * material — but nothing here solves a stress field, and callers must say so.
 */
export function boreFractures(
  cavity: Pick<BoreCavity, "depth" | "breakthrough">,
  spec: Partial<BoreSpec> = {},
  wall: Partial<BoreWall> = {},
  count = 9,
): Fracture[] {
  const depth = Math.max(0, finite(cavity?.depth, 0))
  if (depth <= 0) return []

  const radius = Math.max(0.5, span(spec.radius, defaultBoreSpec.radius))
  const hardness = clamp(finite(spec.hardness, defaultBoreSpec.hardness), 0, 1)
  const face = finite(wall.face, defaultBoreWall.face)
  const thickness = Math.max(1e-3, span(wall.thickness, defaultBoreWall.thickness))
  const axis = finite(wall.axis, defaultBoreWall.axis)
  const base = finite(wall.base, defaultBoreWall.base)
  const top = finite(wall.top, defaultBoreWall.top)
  const total = Math.max(0, Math.min(40, Math.round(span(count, 9))))
  // Hard, brittle material cracks further; a breakthrough opens them all up.
  const reach = radius * (0.26 + hardness * 0.72) * (1 + finite(cavity?.breakthrough, 0) * 0.5)

  const out: Fracture[] = []
  for (let i = 0; i < total; i += 1) {
    // Along the bore, then out of it: a crack cannot start where nothing is cut.
    const along = hash(i) * Math.min(depth, thickness)
    const x0 = clamp(face + along, face, face + thickness)
    const up = i % 2 === 0 ? 1 : -1
    const y0 = axis + up * radius
    const grown = reach * (0.35 + hash(i, 5) * 0.65) * clamp(depth / thickness, 0.2, 1.4)
    const lean = (hash(i, 6) - 0.5) * 1.6

    const points: Vec2[] = [{ x: x0, y: y0 }]
    let x = x0
    let y = y0
    for (let step = 1; step <= 3; step += 1) {
      const run = grown / 3
      x = clamp(x + lean * run * (0.6 + hash(i * 7 + step, 8) * 0.8), face, face + thickness)
      y = clamp(y + up * run, base, top)
      points.push({ x, y })
    }
    out.push({ points, weight: clamp(0.25 + hash(i, 9) * 0.75, 0, 1) })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* rolling, and the bearing                                                    */
/* -------------------------------------------------------------------------- */

/**
 * How far a wheel of `radius` has turned after rolling `distance`, in degrees,
 * with no slip: `θ = s / r`. Negative because a wheel rolling toward +x turns
 * clockwise, which is the negative sense in a y-up drawing.
 *
 * It is the one constraint that ties a drive wheel to the machine it moves, so
 * a reader can check it: one revolution per `2πr` of travel, and nothing at
 * all when the machine is held.
 */
export function rollAngle(distance: number, radius: number): number {
  const r = Math.max(1e-6, span(radius, 1))
  return (-finite(distance, 0) / r) * (180 / Math.PI)
}

/* -------------------------------------------------------------------------- */
/* the bearing                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How fast the cage of a rolling-element bearing turns, as a fraction of the
 * shaft: `(1 − d/D)/2` for rollers of diameter `d` on a pitch diameter `D`.
 * A roller orbits at a little under half shaft speed, and that is the detail
 * that makes a drawn bearing read as a bearing rather than as dots.
 */
export function cageRatio(rollerDiameter: number, pitchDiameter: number): number {
  const d = span(rollerDiameter, 1)
  const big = Math.max(d + 1e-6, span(pitchDiameter, 4))
  return clamp((1 - d / big) / 2, 0, 0.5)
}
