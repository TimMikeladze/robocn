/**
 * rail-geometry — what a track does to the vehicle standing on it.
 *
 * Every other vehicle in the set is steered: a rack turns two wheels, a hitch
 * bends a bus, an aileron rolls a wing. A rail vehicle is the inverse. Nothing
 * on board steers it. The track is the input and the pose is the answer — the
 * yaw of each bogie is the tangent under its own pivot, the body is the chord
 * between them, and the sideways throw of the middle and the ends falls out of
 * that with no approximation.
 *
 * Two more constraints live here for the same reason. A coned wheelset is not
 * commanded to wander; it wanders because it is coned, at exactly Klingel's
 * wavelength. A pantograph's reach is not independent of its height; the
 * linkage decides. And a turnout's crossing angle is not chosen; it is the
 * turnout number.
 *
 * Pure functions over plain numbers and `{x, y}`. No React, no dependencies,
 * and no dynamics: nothing here knows about mass, speed, force, adhesion,
 * damping or wear. Everything is exact geometry except `trackCurvature` and
 * `wireStagger`, which are stated shapes and say so.
 *
 * Design note: docs/rail-machines.md.
 */

import { clamp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

const finite = (value: number | undefined, fallback = 0) =>
  Number.isFinite(value) ? (value as number) : fallback

/** A length: finite, positive, and never zero — it usually ends up a divisor. */
const span = (value: number | undefined, fallback: number) => {
  const magnitude = Math.abs(finite(value, fallback))
  return magnitude > 1e-6 ? magnitude : Math.abs(fallback)
}

/** Sharper than this and no bogie of any length would go round it. */
export const MAX_TRACK_TURN = 20

/* -------------------------------------------------------------------------- */
/* the curve                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The radius of a curve that turns through `turn` degrees under a chord of
 * `chord` — which is how a curve is quoted here, because the angle a vehicle's
 * own bogie spacing subtends is the thing you can see in the drawing.
 *
 * `chord = 2R sin(turn/2)`, so the radius is exact. A turn of zero is straight
 * and returns `Infinity` rather than forcing a special case on every caller.
 */
export function curveRadius(turn: number, chord: number): number {
  const angle = clamp(finite(turn, 0), -MAX_TRACK_TURN, MAX_TRACK_TURN)
  const c = span(chord, 1)
  if (angle === 0) return Infinity
  return c / (2 * Math.sin(toRadians(Math.abs(angle)) / 2))
}

export interface BogieGeometry {
  /** Pivot centre to pivot centre, along the body. */
  pivotSpacing: number
  /** Body centre to the end of the body. Half the overall length. */
  halfLength: number
}

export interface BogiePlacement {
  /** Pivot position in the body's own frame: x along the body, y to starboard. */
  position: Vec2
  /** Degrees the bogie is yawed relative to the body, positive to starboard. */
  yaw: number
}

export interface BogieRide {
  /** Curve radius actually used. `Infinity` on straight track. */
  radius: number
  /** −1 to port, 0 straight, +1 to starboard. */
  sign: number
  /** The leading pivot, then the trailing one. */
  bogies: [BogiePlacement, BogiePlacement]
  /**
   * How far the middle of the body swings *inside* the curve, `R(1 − cos θ)`.
   * Always positive on a curve: it is the overhang a platform has to allow for.
   */
  centreThrow: number
  /** How far a body corner swings *outside* it. Positive, and larger. */
  endThrow: number
  /** Degrees the body's own centreline is yawed on the track. Always zero: the
   * body is the chord, and the chord is what everything else is measured from. */
  bodyYaw: number
}

/**
 * A rigid body on two bogies, placed on a curve.
 *
 * The pivots lie *on* the track and the body is the straight line between
 * them, so the body is a chord. Write the curve about its own centre and the
 * two railway numbers that matter are immediate: the chord's midpoint stands
 * `R cos θ` from the centre, so the body's middle is `R(1 − cos θ)` inside the
 * track; a corner `L` along the chord stands `√(R²cos²θ + L²)` from the
 * centre, so it is that much *outside* it.
 *
 * Exact. Nothing is integrated, nothing is swept, and a straight track returns
 * zero throw and zero yaw rather than a limit.
 */
export function bogieRide(radius: number, geometry: BogieGeometry): BogieRide {
  const spacing = span(geometry?.pivotSpacing, 1)
  const half = spacing / 2
  const length = Math.abs(finite(geometry?.halfLength, half))
  const signed = finite(radius, Infinity)
  const r = Math.abs(signed)
  const sign = !Number.isFinite(signed) || r < 1e-6 ? 0 : signed > 0 ? 1 : -1

  if (sign === 0 || r <= half) {
    // Straight, or a radius no vehicle of this length could sit on: the honest
    // answer is the straight one rather than a complex half-angle.
    return {
      radius: Infinity,
      sign: 0,
      bogies: [
        { position: { x: half, y: 0 }, yaw: 0 },
        { position: { x: -half, y: 0 }, yaw: 0 },
      ],
      centreThrow: 0,
      endThrow: 0,
      bodyYaw: 0,
    }
  }

  // Half the angle the pivot spacing subtends at the curve centre.
  const theta = Math.asin(clamp(half / r, -1, 1))
  const yaw = toDegrees(theta)
  const cos = Math.cos(theta)
  return {
    radius: r,
    sign,
    bogies: [
      { position: { x: half, y: 0 }, yaw: yaw * sign },
      { position: { x: -half, y: 0 }, yaw: -yaw * sign },
    ],
    centreThrow: r * (1 - cos),
    endThrow: Math.hypot(r * cos, length) - r,
    bodyYaw: 0,
  }
}

/**
 * Where a point `x` along the body sits across the track, measured from the
 * track centreline and positive *outward* from the curve. Negative between the
 * pivots (the body is inside the curve there) and positive beyond them.
 *
 * The same chord, evaluated anywhere along it, which is what makes the centre
 * and end throws two readings of one relation rather than two formulae.
 */
export function bodyOffset(x: number, radius: number, pivotSpacing: number): number {
  const r = Math.abs(finite(radius, Infinity))
  const half = span(pivotSpacing, 1) / 2
  if (!Number.isFinite(r) || r <= half) return 0
  const along = finite(x, 0)
  const cos = Math.cos(Math.asin(clamp(half / r, -1, 1)))
  return Math.hypot(r * cos, along) - r
}

/**
 * **Illustrative.** The curvature a stretch of line runs through, as a signed
 * fraction of the sharpest curve on it: two sines that do not share a period,
 * so a train running it winds one way and then the other without repeating
 * over a short run. A stated shape, not a surveyed alignment — there are no
 * transition spirals here and no cant.
 */
export function trackCurvature(distance: number, amplitude = 1): number {
  const s = finite(distance, 0)
  const scale = finite(amplitude, 1)
  return (
    (Math.sin(s * Math.PI * 2) * 0.68 + Math.sin(s * Math.PI * 2 * 0.37) * 0.32) *
    scale
  )
}

/* -------------------------------------------------------------------------- */
/* hunting                                                                     */
/* -------------------------------------------------------------------------- */

export interface WheelsetGeometry {
  /** Rolling radius at the tread's design point. */
  wheelRadius: number
  /** Half the lateral distance between the two contact points. */
  halfGauge: number
  /** Tread conicity: tan of the cone angle. Zero is a cylindrical tread. */
  conicity: number
  /** How far the wheelset can move sideways before a flange touches a rail. */
  flangeClearance?: number
}

/**
 * Klingel's wavelength: `λ = 2π √(b r₀ / γ)`.
 *
 * A coned wheelset displaced sideways rolls on unequal radii, so it yaws; yaw
 * it and it runs sideways. That loop is undamped and second order, and this is
 * its period *in distance run* — the one length in railway engineering that
 * has nothing to do with speed. A cylindrical tread has no restoring term at
 * all, so the wavelength is `Infinity` and the motion never comes back.
 */
export function klingelWavelength(geometry: WheelsetGeometry): number {
  const r = span(geometry?.wheelRadius, 1)
  const b = span(geometry?.halfGauge, 1)
  const gamma = Math.abs(finite(geometry?.conicity, 0))
  if (gamma < 1e-9) return Infinity
  return 2 * Math.PI * Math.sqrt((b * r) / gamma)
}

export interface HuntingPose {
  /** Sideways displacement of the wheelset centre. Positive to starboard. */
  lateral: number
  /** Degrees the wheelset is yawed, positive to starboard. */
  yaw: number
  /** Difference in rolling radius, starboard less port. This is the restoring term. */
  radiusDifference: number
  /** The wavelength in force, in the same units as `distance`. */
  wavelength: number
  /** True while a flange is on a rail — where the kinematic solution stops. */
  flanging: boolean
}

/**
 * Where a hunting wheelset stands after running `distance`.
 *
 * `y = A cos(2πs/λ)` and the yaw is its own slope, `ψ = dy/ds`, so the two are
 * a quarter of a cycle apart — which is the whole shape of hunting: the
 * wheelset is running most steeply sideways exactly as it passes centre.
 *
 * The amplitude is an input because the kinematic solution does not fix one;
 * what does fix it is the flange, and that is a clamp rather than a curve.
 */
export function huntingPose(
  distance: number,
  amplitude: number,
  geometry: WheelsetGeometry,
): HuntingPose {
  const gamma = Math.abs(finite(geometry?.conicity, 0))
  const clearance = Math.abs(finite(geometry?.flangeClearance, Infinity))
  const wavelength = klingelWavelength(geometry)
  const wanted = Math.abs(finite(amplitude, 0))
  const bounded = Math.min(wanted, clearance)
  const s = finite(distance, 0)

  if (!Number.isFinite(wavelength) || bounded === 0) {
    return {
      lateral: 0,
      yaw: 0,
      radiusDifference: 0,
      wavelength,
      flanging: false,
    }
  }

  const k = (Math.PI * 2) / wavelength
  const lateral = bounded * Math.cos(k * s)
  // ψ = dy/ds, and a slope is an angle: the yaw is small, but it is not a
  // scaled copy of the displacement — it leads it by a quarter wavelength.
  const yaw = toDegrees(Math.atan(-bounded * k * Math.sin(k * s)))
  return {
    lateral,
    yaw,
    // r = r₀ ± γy at the two contacts, so the difference is 2γy.
    radiusDifference: 2 * gamma * lateral,
    wavelength,
    // The flange is on the rail wherever the motion the conicity is asking
    // for would have taken the wheelset past the clearance.
    flanging: Math.abs(wanted * Math.cos(k * s)) >= clearance - 1e-9,
  }
}

/**
 * The yaw a wheelset takes up on a curve if it steers radially — pointing at
 * the curve's own centre, which is what a bogie with soft primary yaw stiffness
 * tries to do and what a rigid one cannot.
 */
export function radialYaw(offset: number, radius: number): number {
  const r = Math.abs(finite(radius, Infinity))
  if (!Number.isFinite(r) || r < 1e-6) return 0
  return toDegrees(Math.atan(finite(offset, 0) / r))
}

/* -------------------------------------------------------------------------- */
/* the pantograph                                                              */
/* -------------------------------------------------------------------------- */

export interface PantographGeometry {
  /** Lower arm, from the base pivot to the knee. */
  lowerArm: number
  /** Upper arm, from the knee to the pan head pivot. */
  upperArm: number
  /** Height of the base pivot above the roof. */
  baseHeight?: number
  /** Which side the arm folds toward. Negative folds forward. */
  fold?: number
  /** Control rod, from its anchor on the lower arm to the head lever. */
  rod?: number
  /** The lever the rod works the head through, from the head pivot. */
  lever?: number
  /** How far up the lower arm the rod is anchored, 0 at the base, 1 at the knee. */
  rodAnchor?: number
  /** The height the head levelling was set at. It is flat here and nowhere else. */
  designHeight?: number
}

export interface PantographPose {
  /** Base pivot, in the roof's own frame: x along the vehicle, y up. */
  base: Vec2
  /** The knee: the lower–upper arm joint. */
  knee: Vec2
  /** Pan head pivot, at the top of the upper arm. */
  head: Vec2
  /** Where the control rod is anchored on the lower arm. */
  rodAnchor: Vec2
  /** The far end of the head lever, which the rod holds. */
  leverEnd: Vec2
  /** Degrees the lower arm stands from horizontal. */
  lowerAngle: number
  /** Degrees the upper arm stands from horizontal. */
  upperAngle: number
  /**
   * Degrees the pan head is tilted off level. An *output* of the levelling
   * loop, not a value pinned to zero: the rod holds it flat around the height
   * it was set at and lets it tip as the arm runs out to either end.
   */
  attitude: number
  /** Height of the contact strip above the roof. */
  workingHeight: number
  /** False once the arms are straight and the head cannot go higher. */
  reachable: boolean
}

/** Circle intersection: the point `ra` from `a` and `rb` from `b`, on one side. */
function meet(a: Vec2, b: Vec2, ra: number, rb: number, side: number): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d < 1e-9) return { x: a.x + ra, y: a.y }
  // Out of range clamps onto the line between the centres, which keeps the
  // loop assembled instead of producing NaN at the ends of the travel.
  const along = clamp((d * d + ra * ra - rb * rb) / (2 * d), -ra, ra)
  const height = Math.sqrt(Math.max(0, ra * ra - along * along))
  const ux = dx / d
  const uy = dy / d
  return {
    x: a.x + ux * along - uy * height * side,
    y: a.y + uy * along + ux * height * side,
  }
}

/** The two arms, solved for one working height. The rest of the pose hangs off this. */
function arms(height: number, geometry: PantographGeometry) {
  const lower = span(geometry?.lowerArm, 1)
  const upper = span(geometry?.upperArm, 1)
  const baseHeight = finite(geometry?.baseHeight, 0)
  const side = finite(geometry?.fold, 1) < 0 ? -1 : 1
  const base: Vec2 = { x: 0, y: baseHeight }

  const lowest = Math.abs(lower - upper)
  const highest = lower + upper
  const wanted = finite(height, 0) - baseHeight
  const reachable = wanted <= highest + 1e-6
  const rise = clamp(wanted, lowest + 1e-6, highest - 1e-6)

  // The head stands straight over the base pivot, so the knee is the elbow of
  // a two-link chain reaching `rise` — broken toward the folding side so the
  // arm never flips through the straight between two frames.
  const cosLower = clamp(
    (lower * lower + rise * rise - upper * upper) / (2 * lower * rise),
    -1,
    1,
  )
  const fromVertical = Math.acos(cosLower)
  const knee: Vec2 = {
    x: base.x - side * lower * Math.sin(fromVertical),
    y: base.y + lower * Math.cos(fromVertical),
  }
  return { base, knee, head: { x: base.x, y: base.y + rise }, side, lower, reachable }
}

/** Where the head levelling lever points, for one working height. */
function leverDirection(height: number, geometry: PantographGeometry): number {
  const { base, knee, head, side, lower } = arms(height, geometry)
  const rod = span(geometry?.rod, lower * 0.8)
  const lever = span(geometry?.lever, lower * 0.22)
  const fraction = clamp(finite(geometry?.rodAnchor, 0.45), 0, 1)
  const anchor: Vec2 = {
    x: base.x + (knee.x - base.x) * fraction,
    y: base.y + (knee.y - base.y) * fraction,
  }
  const end = meet(head, anchor, lever, rod, side)
  return toDegrees(Math.atan2(end.y - head.y, end.x - head.x))
}

/**
 * A single-arm pantograph solved to a working height.
 *
 * Height and reach are not independent. The head rides the workspace of a
 * two-link chain, so asking for height takes reach away and the knee folds in
 * as the pan goes up; asking for more than the arms have clamps the height
 * rather than producing NaN, and says so in `reachable`.
 *
 * The head's attitude is an output of a second, closed loop: a control rod
 * runs from the lower arm to a lever on the head, so the head's angle is
 * whatever assembles that loop at this height. It comes out flat at the height
 * the levelling was set for and tips away from it at the ends of the travel —
 * which is a real pantograph's working range, and is why this is solved rather
 * than pinned to horizontal.
 */
export function pantographPose(
  height: number,
  geometry: PantographGeometry,
): PantographPose {
  const { base, knee, head, side, lower, reachable } = arms(height, geometry)
  const rod = span(geometry?.rod, lower * 0.8)
  const lever = span(geometry?.lever, lower * 0.22)
  const fraction = clamp(finite(geometry?.rodAnchor, 0.45), 0, 1)
  const rodAnchor: Vec2 = {
    x: base.x + (knee.x - base.x) * fraction,
    y: base.y + (knee.y - base.y) * fraction,
  }
  const leverEnd = meet(head, rodAnchor, lever, rod, side)
  const design = finite(
    geometry?.designHeight,
    base.y + (span(geometry?.lowerArm, 1) + span(geometry?.upperArm, 1)) * 0.72,
  )
  return {
    base,
    knee,
    head,
    rodAnchor,
    leverEnd,
    lowerAngle: toDegrees(Math.atan2(knee.y - base.y, knee.x - base.x)),
    upperAngle: toDegrees(Math.atan2(head.y - knee.y, head.x - knee.x)),
    attitude:
      toDegrees(Math.atan2(leverEnd.y - head.y, leverEnd.x - head.x)) -
      leverDirection(design, geometry),
    workingHeight: head.y,
    reachable,
  }
}

/**
 * **Illustrative.** The stagger a contact wire is strung with — it zig-zags
 * across the track between masts so the carbon strip wears across its width
 * instead of grooving in one place. A triangular wave of the given amplitude
 * over the given span, which is the pattern; it is not a catenary solution and
 * there is no sag, tension or uplift here.
 */
export function wireStagger(distance: number, amplitude = 1, spanLength = 1): number {
  const s = finite(distance, 0)
  const a = finite(amplitude, 1)
  const length = span(spanLength, 1)
  const cycle = ((s / (length * 2)) % 1 + 1) % 1
  return a * (cycle < 0.5 ? 4 * cycle - 1 : 3 - 4 * cycle)
}

/* -------------------------------------------------------------------------- */
/* the turnout                                                                 */
/* -------------------------------------------------------------------------- */

export interface TurnoutGeometry {
  /** Crossing angle, in degrees. `atan(1/N)` for a turnout number `N`. */
  crossingAngle: number
  /** Radius of the diverging route's arc, tangent to the straight at the toe. */
  radius: number
  /** Distance from the switch toe to the crossing, along the straight. */
  lead: number
  /** How far the diverging route stands off the straight at the crossing. */
  offset: number
}

/**
 * The geometry a turnout number buys, for a track of a given gauge.
 *
 * The number `N` is the crossing's rate of divergence — one across for `N`
 * along — so the crossing angle is `atan(1/N)` and a larger number is a
 * shallower, faster turnout. The diverging route is a simple arc leaving the
 * straight tangentially at the toe, and the crossing is where the two routes'
 * inner rails meet: that happens at `cos α = (R − g)/(R + g)` for a half-gauge
 * `g`, which fixes the radius, and the lead is then `R sin α`.
 *
 * Two consequences worth seeing in a drawing. The offset at the crossing comes
 * out as `g(1 + cos α)` — very nearly one gauge, whatever the number. And the
 * lead grows roughly as `N²`, which is why a fast turnout is such a long thing.
 *
 * Exact for a simple-curve turnout. Real switch and crossing work has a
 * straight switch rail, a separate closure curve, and often a transition;
 * none of that is here.
 */
export function turnoutGeometry(turnoutNumber: number, gauge: number): TurnoutGeometry {
  const n = span(turnoutNumber, 8)
  const half = span(gauge, 2) / 2
  const alpha = Math.atan(1 / n)
  const cos = Math.cos(alpha)
  const radius = (half * (1 + cos)) / Math.max(1e-9, 1 - cos)
  return {
    crossingAngle: toDegrees(alpha),
    radius,
    lead: radius * Math.sin(alpha),
    offset: radius * (1 - cos),
  }
}

/**
 * A point on the diverging route, `distance` along the straight from the toe.
 * The arc is tangent to the straight at the toe, so it leaves with no kink;
 * past the crossing it runs straight on at the crossing angle, which is what
 * the rails actually do.
 */
export function turnoutPoint(distance: number, geometry: TurnoutGeometry): Vec2 {
  const radius = span(geometry?.radius, 1)
  const lead = span(geometry?.lead, 1)
  const alpha = toRadians(Math.abs(finite(geometry?.crossingAngle, 0)))
  const s = Math.max(0, finite(distance, 0))
  if (s <= lead) {
    // x = R sin φ along the straight, y = R(1 − cos φ) off it.
    const phi = Math.asin(clamp(s / radius, -1, 1))
    return { x: s, y: radius * (1 - Math.cos(phi)) }
  }
  const end = { x: lead, y: radius * (1 - Math.cos(alpha)) }
  const run = s - lead
  return { x: end.x + run, y: end.y + run * Math.tan(alpha) }
}

export type TurnoutRoute = "normal" | "reverse" | "unset"

export interface BladePose {
  /** Gap at the blade that closes for the normal route. Zero is closed. */
  normalGap: number
  /** Gap at the other one. The two always sum to the throw — they share a rod. */
  reverseGap: number
  /** Which route is set, or `"unset"` while the blades are between detections. */
  route: TurnoutRoute
  /** How far the throw bar has travelled, in the same units as the throw. */
  travel: number
  /** True while a blade is inside the detection tolerance of its stock rail. */
  detected: boolean
}

/**
 * The two switch blades on one throw bar.
 *
 * They are rigidly tied, so the open gap is *exactly* the throw less the
 * closed one; nobody sets them independently. The route is not a boolean
 * someone flipped either — it is detection, a tolerance on how close the
 * closed blade actually is. A turnout caught mid-stroke has no route set, and
 * that is the state a signaller sees.
 */
export function bladePose(
  position: number,
  throwDistance: number,
  tolerance = 0,
): BladePose {
  const p = clamp(finite(position, 0), 0, 1)
  const stroke = span(throwDistance, 1)
  const detect = Math.min(Math.abs(finite(tolerance, 0)), stroke / 2)
  const normalGap = p * stroke
  const reverseGap = (1 - p) * stroke
  const closedNormal = normalGap <= detect
  const closedReverse = reverseGap <= detect
  return {
    normalGap,
    reverseGap,
    route: closedNormal ? "normal" : closedReverse ? "reverse" : "unset",
    travel: p * stroke,
    detected: closedNormal || closedReverse,
  }
}
