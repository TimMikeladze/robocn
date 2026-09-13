/**
 * vehicle-geometry — the constraints a vehicle works against.
 *
 * A machine that goes somewhere is not just a body with a heading. It is a
 * body held by a medium, and the mechanism worth drawing is the one that turns
 * it: a steering rack whose two wheels run on different circles, a hitch whose
 * angle is an output rather than an input, a wing that has to bank to turn, a
 * foil that carries less of the hull the faster it goes, a stack that throws
 * half of itself away.
 *
 * Pure functions over plain numbers and vectors. No React, no dependencies.
 * Everything here is exact geometry except `pitchProgram` and `roadProfile`,
 * which are stated shapes and are labelled as such — nothing in this file
 * integrates a path, a force or a mass.
 *
 * Design note: docs/vehicle-robots.md.
 */

import {
  clamp,
  toDegrees,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, positive, and never zero — it usually ends up a divisor. */
const span = (value: number, fallback: number) => {
  const magnitude = Math.abs(finite(value, fallback))
  return magnitude > 1e-6 ? magnitude : Math.abs(fallback)
}

/** Past this the rack is at its stop; no road car steers further. */
export const MAX_STEER = 60

/* -------------------------------------------------------------------------- */
/* steering                                                                    */
/* -------------------------------------------------------------------------- */

export interface SteerGeometry {
  /** Front axle to rear axle. */
  wheelbase: number
  /** Wheel centre to wheel centre across one axle. */
  track: number
}

export interface AckermannPose {
  /** The wheel on the inside of the turn. Always the harder angle. */
  inner: number
  /** The wheel on the outside, running on the larger circle. */
  outer: number
  /** Signed angle for the near-side wheel: positive turns to starboard. */
  left: number
  /** Signed angle for the off-side wheel. */
  right: number
  /** Radius the centre of the rear axle runs on. `Infinity` going straight. */
  radius: number
  /** −1 to port, 0 straight, +1 to starboard. */
  sign: number
}

/**
 * True Ackermann: the two front wheels run on circles half a track apart, so
 * the same rack has to turn them through different angles or one of them
 * scrubs. `steer` is the angle the *centreline* would need — what a driver
 * asks for — and the two wheel angles are what the geometry answers.
 *
 * Positive is a turn to starboard, which is clockwise seen from above, the
 * same sense as every heading in the set.
 */
export function ackermann(
  steer: number,
  geometry: SteerGeometry,
): AckermannPose {
  const wheelbase = span(geometry?.wheelbase, 1)
  const track = Math.abs(finite(geometry?.track, 0))
  const angle = clamp(finite(steer, 0), -MAX_STEER, MAX_STEER)
  if (angle === 0) {
    return { inner: 0, outer: 0, left: 0, right: 0, radius: Infinity, sign: 0 }
  }
  const sign = angle > 0 ? 1 : -1
  const radius = wheelbase / Math.tan(toRadians(Math.abs(angle)))
  // The inner circle can never close inside the axle itself: hold it off the
  // wheel centre so a rack at full lock gives a hard angle, not a right one.
  const inside = Math.max(radius - track / 2, wheelbase / 20)
  const inner = toDegrees(Math.atan(wheelbase / inside))
  const outer = toDegrees(Math.atan(wheelbase / (radius + track / 2)))
  return {
    inner,
    outer,
    left: sign > 0 ? outer * sign : inner * sign,
    right: sign > 0 ? inner * sign : outer * sign,
    radius,
    sign,
  }
}

export interface TractorGeometry extends SteerGeometry {
  /** How far behind the rear axle the pivot sits. Negative is ahead of it. */
  hitch: number
}

/**
 * The steady-state articulation angle of a towed section, in degrees, signed
 * with the steer.
 *
 * The hitch rides a circle of its own — offset behind the rear axle, so a
 * larger one than the tractor's — and the towed axle cannot slide sideways, so
 * its velocity lies along its own body. Those two facts fix the angle between
 * the sections: no integration and no history, which is why a bus that has
 * been round a roundabout comes out of it straight.
 *
 * Past the jackknife, where the hitch circle is smaller than the towed
 * wheelbase, there is no steady state at all; the angle is held at the last
 * one there is rather than reported as a solution.
 */
export function hitchAngle(
  steer: number,
  tractor: TractorGeometry,
  trailerWheelbase: number,
): number {
  const angle = clamp(finite(steer, 0), -MAX_STEER, MAX_STEER)
  if (angle === 0) return 0
  const wheelbase = span(tractor?.wheelbase, 1)
  const hitch = finite(tractor?.hitch, 0)
  const towed = span(trailerWheelbase, 1)
  const sign = angle > 0 ? 1 : -1
  const radius = wheelbase / Math.tan(toRadians(Math.abs(angle)))
  const hitchRadius = Math.hypot(radius, hitch)
  const lead = Math.asin(clamp(towed / hitchRadius, -1, 1))
  const offset = Math.atan2(hitch, radius)
  return sign * toDegrees(lead - offset)
}

/* -------------------------------------------------------------------------- */
/* flight                                                                      */
/* -------------------------------------------------------------------------- */

const GRAVITY = 9.81

/**
 * The bank a level turn is coordinated at: `atan(v² / rg)`. Nothing is
 * balanced here beyond that identity — no lift, no load factor, no stall.
 * `radius` of `Infinity` (or zero speed) is wings level.
 */
export function coordinatedBank(
  speed: number,
  radius: number,
  gravity = GRAVITY,
): number {
  const v = Math.abs(finite(speed, 0))
  const r = Math.abs(finite(radius, Infinity))
  const g = span(gravity, GRAVITY)
  if (v === 0 || !Number.isFinite(r) || r < 1e-6) return 0
  return toDegrees(Math.atan((v * v) / (r * g)))
}

/* -------------------------------------------------------------------------- */
/* suspension                                                                  */
/* -------------------------------------------------------------------------- */

export interface AxleRide {
  /** Height of the body's reference line at x = 0. */
  heave: number
  /** Degrees, nose-up positive, where the nose is toward +x. */
  pitch: number
  /** Each axle's own travel: the surface under it, less the body line. */
  travel: number[]
}

/**
 * A rigid body carried on N axles over a surface. The body cannot follow every
 * bump, so it takes the least-squares line through the wheel contacts — the
 * heave and pitch a real body settles into — and each axle keeps the rest as
 * suspension travel. Exact: this is the normal equation, not a filter.
 */
export function axleRide(
  surface: (x: number) => number,
  positions: readonly number[],
): AxleRide {
  const xs = positions.map((value) => finite(value, 0))
  const ys = xs.map((x) => finite(surface(x), 0))
  const n = xs.length
  if (n === 0) return { heave: 0, pitch: 0, travel: [] }
  const meanX = xs.reduce((total, x) => total + x, 0) / n
  const meanY = ys.reduce((total, y) => total + y, 0) / n
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX
    numerator += dx * (ys[index] - meanY)
    denominator += dx * dx
  }
  const slope = denominator > 1e-9 ? numerator / denominator : 0
  const heave = meanY - slope * meanX
  return {
    heave,
    pitch: toDegrees(Math.atan(slope)),
    travel: xs.map((x, index) => ys[index] - (heave + slope * x)),
  }
}

/**
 * An illustrative road: two sines that do not share a period, so a body on it
 * never repeats over a short run. A stated shape, not a measured surface.
 */
export function roadProfile(x: number, amplitude = 1, wavelength = 40): number {
  const position = finite(x, 0)
  const height = finite(amplitude, 1)
  const length = span(wavelength, 40)
  return (
    Math.sin((position / length) * Math.PI * 2) * height * 0.6 +
    Math.sin((position / (length * 0.37)) * Math.PI * 2) * height * 0.4
  )
}

/* -------------------------------------------------------------------------- */
/* rockets                                                                     */
/* -------------------------------------------------------------------------- */

export interface RocketStage {
  /** Wet mass over dry mass, for this stage and everything above it. */
  massRatio: number
  /** Effective exhaust velocity, metres per second. */
  exhaustVelocity: number
}

/** The rocket equation: `Δv = vₑ ln(m₀/m₁)`. A ratio at or below one is no Δv. */
export function tsiolkovsky(massRatio: number, exhaustVelocity: number): number {
  const ratio = finite(massRatio, 1)
  const velocity = finite(exhaustVelocity, 0)
  if (ratio <= 1 || velocity <= 0) return 0
  return velocity * Math.log(ratio)
}

/** What a stack of stages is still worth, ideally: the sum over what is left. */
export function stackDeltaV(stages: readonly RocketStage[]): number {
  if (!Array.isArray(stages)) return 0
  return stages.reduce(
    (total, stage) =>
      total + tsiolkovsky(stage?.massRatio ?? 0, stage?.exhaustVelocity ?? 0),
    0,
  )
}

/**
 * **Illustrative.** A pitch program shaped like a gravity turn: vertical off
 * the pad, kicked over early, then most of the turn taken in the middle of the
 * ascent and very little of it at either end. Degrees from vertical, 0 on the
 * pad and 90 at insertion.
 *
 * This is a curve chosen to look like the real thing. It is not a solved
 * trajectory, and no machine here is flying it.
 */
export function pitchProgram(fraction: number, kick = 8): number {
  const f = clamp(finite(fraction, 0), 0, 1)
  const kicked = clamp(finite(kick, 8), 0, 45)
  const start = 0.04
  if (f <= start) return (f / start) * kicked
  const t = (f - start) / (1 - start)
  const rest = t * t * (3 - 2 * t)
  return clamp(kicked + (90 - kicked) * rest, 0, 90)
}

/* -------------------------------------------------------------------------- */
/* foils                                                                       */
/* -------------------------------------------------------------------------- */

/** Sea water, kilograms per cubic metre. */
const SEA_DENSITY = 1025

/**
 * The ideal lift equation, `½ ρ v² S C_L`. No drag, no wave-making, no
 * cavitation and no free-surface effect — the one relation that matters for
 * the drawing is that lift goes as the *square* of speed.
 */
export function foilLift(
  speed: number,
  area: number,
  coefficient = 0.9,
  density = SEA_DENSITY,
): number {
  const v = Math.abs(finite(speed, 0))
  const s = Math.abs(finite(area, 0))
  const cl = Math.abs(finite(coefficient, 0.9))
  const rho = Math.abs(finite(density, SEA_DENSITY))
  return 0.5 * rho * v * v * s * cl
}

/**
 * How far out of the water a surface-piercing foil carries the hull, 0 (hull
 * in the water) to 1 (fully foilborne).
 *
 * The equilibrium is the honest part: lift goes as v², so at a steady weight
 * the immersed area has to fall as 1/v². Below the takeoff speed the foil
 * cannot carry the boat at all and it stays hullborne; above it, the
 * proportion of the foil still wetted is `(takeoff/v)²` and the rest of it is
 * the rise.
 */
export function foilRise(speed: number, takeoff: number): number {
  const v = Math.abs(finite(speed, 0))
  const onset = span(takeoff, 1)
  if (v <= onset) return 0
  return clamp(1 - (onset / v) ** 2, 0, 1)
}

/* -------------------------------------------------------------------------- */
/* drawing geometry                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A steered wheel as the solid it is: a disc standing in the wheel's own
 * plane, swept `halfWidth` either side of it. World axes — x starboard, y up,
 * z aft — so the corners go straight to `slabPath` and the wheel comes out
 * right from every camera. `steer` turns it about the vertical, positive to
 * starboard.
 */
export function wheelSolid(
  centre: Vec3,
  radius: number,
  halfWidth: number,
  steer = 0,
  steps = 16,
): Vec3[] {
  const cx = finite(centre?.x, 0)
  const cy = finite(centre?.y, 0)
  const cz = finite(centre?.z, 0)
  const r = span(radius, 1)
  const half = Math.abs(finite(halfWidth, 0))
  const turn = toRadians(clamp(finite(steer, 0), -90, 90))
  // The wheel rolls along its own forward vector and turns about its axle.
  const forward = { x: Math.sin(turn), z: -Math.cos(turn) }
  const axle = { x: Math.cos(turn), z: Math.sin(turn) }
  const count = Math.max(3, Math.round(finite(steps, 16)))
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    const along = Math.cos(angle) * r
    const up = Math.sin(angle) * r
    return { x: cx + forward.x * along, y: cy + up, z: cz + forward.z * along }
  }).flatMap((point) => [
    { x: point.x + axle.x * half, y: point.y, z: point.z + axle.z * half },
    { x: point.x - axle.x * half, y: point.y, z: point.z - axle.z * half },
  ])
}

/**
 * A point of a **profile elevation** drawing, lifted into the world and rolled
 * about the vehicle's own fore-aft axis.
 *
 * Drawing coordinates are the set's usual ones — x along the drawing toward
 * the nose, y up from the ground — and `depth` is out of the plane, positive
 * to starboard. `roll` follows the aircraft convention: positive puts the
 * starboard side down, about an axis at height `centre`.
 *
 * This is what lets one elevation drawing bank, heel or roll truthfully
 * instead of being redrawn: the body is modelled once and the roll is a rigid
 * rotation of it, so every length is preserved and every camera agrees.
 */
export function rollPoint(
  point: Vec2,
  depth: number,
  roll: number,
  centre = 0,
): Vec3 {
  const angle = toRadians(clamp(finite(roll, 0), -180, 180))
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const axis = finite(centre, 0)
  const height = finite(point?.y, 0) - axis
  const out = finite(depth, 0)
  return {
    x: out * cos + height * sin,
    y: axis - out * sin + height * cos,
    z: -finite(point?.x, 0),
  }
}
