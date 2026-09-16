/**
 * airframe — the loft of an aeroplane, and the one mechanism on it that is
 * really solved.
 *
 * Three things the set had no maths for:
 *
 * - **A body lofted along a horizontal axis, with a second lobe on top.**
 *   `produce.ts` revolves a profile about `y` for a fruit and `hull.ts` tiles a
 *   sphere; a fuselage is neither. It is a nose ogive, a constant barrel, an
 *   upswept tail cone, and — over its forward third — an upper deck standing on
 *   the crown. That makes it **non-convex**, which is the whole reason a
 *   component cannot just wrap it in one hull.
 * - **A swept, tapered, kinked, dihedral wing sampled at any station.** Chord
 *   is piecewise linear root to kink to tip while the leading edge stays one
 *   straight swept line, which is what gives a big jet its almost-unswept
 *   inboard trailing edge. Every moving surface on the wing is then a patch of
 *   that planform between two spanwise stations and two chord fractions, so
 *   flaps, slats, ailerons and spoilers all come out of one function.
 * - **A retracting undercarriage.** Not a leg that gets shorter: an oleo
 *   swinging about a fixed trunnion, with a two-part side stay that folds as it
 *   goes. The leg's angle fixes the stay's foot, so the knee is an elbow solve
 *   between the anchor and that foot — two links, law of cosines, the cheap and
 *   stable answer. Out of range clamps onto the annulus and still returns a
 *   pose, and `reachable` says it happened.
 *
 * `controlMix` is a mixer, not aerodynamics. It holds the rules a big aeroplane
 * actually flies by — the slats lead the flaps out, the outboard ailerons lock
 * out once the flaps are up, the roll spoilers rise on the down-going wing
 * only, the stabiliser trims with the configuration — and nothing else. There
 * is no lift here, no drag, no load factor and no stall.
 *
 * World axes are the set's own: **x** starboard, **y** up from the ground,
 * **z** aft, the nose at `-z`. Angles are degrees on the surface and radians
 * inside. Pure functions over plain objects: no React, no three.js, no
 * dependencies.
 *
 * Design note: docs/airliner.md.
 */

import { clamp, solveElbow2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"

const DEG = Math.PI / 180

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

/** A length: finite, and never negative. */
const span = (value: number | undefined, fallback: number) =>
  Math.abs(finite(value, fallback))

/** `-0` is not a value any drawing wants, and it serialises differently. */
const signless = (value: number) => (value === 0 ? 0 : value)

/** The set's easing everywhere a shape has to start and stop smoothly. */
const smoothstep = (t: number) => {
  const u = clamp(finite(t, 0), 0, 1)
  return u * u * (3 - 2 * u)
}

/** `value` mapped from the range `[from, to]` onto 0..1, eased. */
const ramp = (value: number, from: number, to: number) =>
  from === to ? (value >= to ? 1 : 0) : smoothstep((value - from) / (to - from))

/* -------------------------------------------------------------------------- */
/* the fuselage loft                                                           */
/* -------------------------------------------------------------------------- */

/** The fixed dimensions of a fuselage, in world units. */
export interface FuselageLoft {
  /** z of the nose tip. Negative — the nose is at `-z`. */
  nose: number
  /** z where the nose ogive meets the constant barrel. */
  barrel: number
  /** z where the barrel starts sweeping up into the tail cone. */
  upsweep: number
  /** z of the tail cone's end. */
  tail: number
  /** Barrel radius. */
  radius: number
  /** Centreline height above the ground. */
  centre: number
  /** How far the nose droops below the barrel's centreline. */
  noseDroop: number
  /** How far the tail cone's centreline lifts by its end. */
  tailRise: number
  /** What the tail cone keeps of the barrel radius at its end, 0 to 1. */
  tailRadius: number
  /** z by which the upper-deck crown has fully risen. */
  humpFrom: number
  /** z by which it has faired back into the barrel. */
  humpTo: number
  /** How far above the barrel crown the upper deck stands. */
  humpRise: number
}

/** One cross-section of the body. */
export interface FuselageSection {
  z: number
  /** Barrel radius here. Zero at the nose tip. */
  radius: number
  /** Centreline height here: the nose droops, the tail cone lifts. */
  centre: number
  /** How much of the upper deck stands here, in world units. */
  hump: number
  /** The same as a fraction, which is what narrows the upper deck's sides. */
  humpFraction: number
  /** Top of the section, upper deck included. */
  crown: number
  /** Bottom of the section. */
  keel: number
  /** Half the section's width. */
  halfWidth: number
}

export const defaultFuselageLoft: FuselageLoft = {
  nose: -118,
  barrel: -86,
  upsweep: 56,
  tail: 112,
  radius: 10.6,
  centre: 22,
  noseDroop: 2.4,
  tailRise: 12,
  tailRadius: 0.16,
  humpFrom: -100,
  humpTo: -24,
  humpRise: 8.4,
}

const loftOf = (loft: Partial<FuselageLoft> | undefined): FuselageLoft => {
  const base = defaultFuselageLoft
  const nose = finite(loft?.nose, base.nose)
  const tail = finite(loft?.tail, base.tail)
  // The four stations have to stay in order, or the ramps invert and the body
  // turns itself inside out.
  const barrel = clamp(finite(loft?.barrel, base.barrel), nose + 1e-3, tail - 2e-3)
  const upsweep = clamp(finite(loft?.upsweep, base.upsweep), barrel + 1e-3, tail - 1e-3)
  return {
    nose,
    barrel,
    upsweep,
    tail: Math.max(tail, upsweep + 1e-3),
    radius: span(loft?.radius, base.radius),
    centre: finite(loft?.centre, base.centre),
    noseDroop: finite(loft?.noseDroop, base.noseDroop),
    tailRise: finite(loft?.tailRise, base.tailRise),
    tailRadius: clamp(finite(loft?.tailRadius, base.tailRadius), 0, 1),
    humpFrom: finite(loft?.humpFrom, base.humpFrom),
    humpTo: finite(loft?.humpTo, base.humpTo),
    humpRise: Math.max(0, finite(loft?.humpRise, base.humpRise)),
  }
}

/**
 * The body at one station. Continuous across both joins: the ogive meets the
 * barrel at full radius with no step, and the tail cone leaves it the same way.
 * Outside `[nose, tail]` the section is the end it is past, so a caller that
 * over-runs gets a closed body rather than a negative radius.
 */
export function fuselageSection(
  z: number,
  loft: Partial<FuselageLoft> = defaultFuselageLoft,
): FuselageSection {
  const l = loftOf(loft)
  const station = clamp(finite(z, l.barrel), l.nose, l.tail)

  let radius = l.radius
  let centre = l.centre
  if (station < l.barrel) {
    // The nose: an ogive that meets the barrel with no step and closes to a
    // rounded point, and a centreline that droops toward the radome.
    const u = clamp((l.barrel - station) / (l.barrel - l.nose), 0, 1)
    radius = l.radius * Math.max(0, 1 - u ** 3) ** 0.45
    centre = l.centre - l.noseDroop * u * u
  } else if (station > l.upsweep) {
    const u = clamp((station - l.upsweep) / (l.tail - l.upsweep), 0, 1)
    radius = l.radius * (1 - (1 - l.tailRadius) * u ** 1.35)
    centre = l.centre + l.tailRise * u ** 1.7
  }

  // The upper deck: up over the nose, a plateau behind the flight deck, then a
  // long fairing back into the crown.
  const plateau = l.humpFrom + (l.humpTo - l.humpFrom) * 0.42
  const humpFraction = clamp(
    ramp(station, l.nose, l.humpFrom) * (1 - ramp(station, plateau, l.humpTo)),
    0,
    1,
  )
  const hump = humpFraction * l.humpRise

  return {
    z: station,
    radius,
    centre,
    hump,
    humpFraction,
    crown: centre + radius + hump,
    keel: centre - radius,
    halfWidth: radius,
  }
}

/**
 * One cross-section as a closed ring of world points, crown first and round to
 * starboard. The upper deck is a lobe added on the crown side and faded out by
 * the equator, and it narrows the section slightly where it stands — which is
 * what makes the double bubble read as two decks rather than as a bulge.
 */
export function fuselageRing(section: FuselageSection, steps = 16): Vec3[] {
  const count = Math.max(4, Math.round(finite(steps, 16)))
  const radius = Math.max(0, finite(section?.radius, 0))
  const centre = finite(section?.centre, 0)
  const hump = Math.max(0, finite(section?.hump, 0))
  const fraction = clamp(finite(section?.humpFraction, 0), 0, 1)
  const z = finite(section?.z, 0)
  return Array.from({ length: count }, (_, index) => {
    const theta = (index / count) * Math.PI * 2
    const up = Math.cos(theta)
    const across = Math.sin(theta)
    const lobe = Math.max(0, up) ** 1.25
    return {
      x: radius * across * (1 - 0.2 * fraction * lobe),
      y: centre + radius * up + hump * lobe,
      z,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* the wing planform                                                           */
/* -------------------------------------------------------------------------- */

/** The fixed dimensions of one wing panel, measured from the centreline. */
export interface WingPlanform {
  /** Half-span, centreline to tip. */
  span: number
  /** Where the wing leaves the side of the body. */
  root: number
  /** Fraction of the half-span the planform kink sits at. */
  kink: number
  rootChord: number
  kinkChord: number
  tipChord: number
  /** Leading-edge sweep, degrees. */
  sweep: number
  /** Dihedral, degrees. */
  dihedral: number
  /** z of the leading edge at the centreline. */
  leading: number
  /** Height of the leading edge at the centreline, above the ground. */
  height: number
  /** Degrees of washout built into the tip. */
  twist: number
}

/** The wing at one spanwise station. */
export interface WingStation {
  /** Fraction of the half-span, 0 at the centreline and 1 at the tip. */
  t: number
  /** Distance from the centreline, always positive. */
  x: number
  /** Height of this station above the ground, from the dihedral. */
  y: number
  /** z of the leading edge here. */
  leading: number
  /** z of the trailing edge here. */
  trailing: number
  chord: number
  /** Incidence here, degrees, from the built-in washout. */
  twist: number
}

export const defaultWingPlanform: WingPlanform = {
  span: 105,
  root: 10,
  kink: 0.32,
  rootChord: 54,
  kinkChord: 30,
  tipChord: 14,
  sweep: 36,
  dihedral: 7,
  leading: -34,
  height: 14,
  twist: -3,
}

const planformOf = (plan: Partial<WingPlanform> | undefined): WingPlanform => {
  const base = defaultWingPlanform
  return {
    span: Math.max(1e-3, span(plan?.span, base.span)),
    root: Math.max(0, finite(plan?.root, base.root)),
    kink: clamp(finite(plan?.kink, base.kink), 0.02, 0.98),
    rootChord: span(plan?.rootChord, base.rootChord),
    kinkChord: span(plan?.kinkChord, base.kinkChord),
    tipChord: span(plan?.tipChord, base.tipChord),
    sweep: clamp(finite(plan?.sweep, base.sweep), -80, 80),
    dihedral: clamp(finite(plan?.dihedral, base.dihedral), -30, 30),
    leading: finite(plan?.leading, base.leading),
    height: finite(plan?.height, base.height),
    twist: clamp(finite(plan?.twist, base.twist), -20, 20),
  }
}

/**
 * The wing at `t`, a fraction of the half-span. The leading edge is one
 * straight swept line all the way out while the chord collapses root → kink →
 * tip, so the inboard trailing edge comes out nearly unswept and the outboard
 * one almost parallel to the leading edge. That kink is the shape, not a
 * decoration: it is where the undercarriage, the inboard flap and the inboard
 * aileron all end.
 */
export function wingStation(
  t: number,
  plan: Partial<WingPlanform> = defaultWingPlanform,
): WingStation {
  const p = planformOf(plan)
  const u = clamp(finite(t, 0), 0, 1)
  const x = p.root + (p.span - p.root) * u
  const chord =
    u <= p.kink
      ? p.rootChord + (p.kinkChord - p.rootChord) * (u / p.kink)
      : p.kinkChord + (p.tipChord - p.kinkChord) * ((u - p.kink) / (1 - p.kink))
  const leading = p.leading + x * Math.tan(p.sweep * DEG)
  return {
    t: u,
    x,
    y: p.height + x * Math.tan(p.dihedral * DEG),
    leading,
    trailing: leading + chord,
    chord,
    twist: p.twist * u,
  }
}

/**
 * A patch of the planform between two spanwise stations and two chord
 * fractions, as four world points on the starboard side, leading edge first.
 * Every moving surface the wing carries is one of these — a slat is `0 → 0.14`,
 * a Fowler flap `0.72 → 1`, a spoiler a panel ahead of it — so they all track
 * the same planform instead of being drawn separately and drifting off it.
 */
export function wingSurface(
  from: number,
  to: number,
  chordFrom: number,
  chordTo: number,
  plan: Partial<WingPlanform> = defaultWingPlanform,
): Vec3[] {
  const inner = wingStation(from, plan)
  const outer = wingStation(to, plan)
  const a = clamp(finite(chordFrom, 0), 0, 1)
  const b = clamp(finite(chordTo, 1), 0, 1)
  const at = (station: WingStation, fraction: number): Vec3 => ({
    x: station.x,
    y: station.y,
    z: station.leading + station.chord * fraction,
  })
  return [at(inner, a), at(outer, a), at(outer, b), at(inner, b)]
}

/** The whole panel between two stations: {@link wingSurface} over the full chord. */
export const wingPanel = (
  from: number,
  to: number,
  plan: Partial<WingPlanform> = defaultWingPlanform,
): Vec3[] => wingSurface(from, to, 0, 1, plan)

/* -------------------------------------------------------------------------- */
/* the undercarriage                                                           */
/* -------------------------------------------------------------------------- */

/** Which way a leg folds away. */
export type GearFold = "inboard" | "forward" | "aft"

/** The fixed dimensions of one gear unit, in world units. */
export interface GearGeometry {
  /** Where the leg pivots. */
  trunnion: Vec3
  /** Trunnion to axle. */
  leg: number
  /** Which way it folds. */
  fold: GearFold
  /** Which side of the aircraft it is on: `1` starboard, `-1` port. */
  side: 1 | -1
  /** Degrees the leg swings between down-and-locked and stowed. */
  sweep: number
  /**
   * The side stay's anchor, in the fold plane and relative to the trunnion:
   * `x` toward the fold, `y` up.
   */
  anchor: Vec2
  /** The stay's two links, anchor outward. */
  stayUpper: number
  stayLower: number
  /** How far down the leg the stay's foot sits, 0 at the trunnion, 1 at the axle. */
  stayFoot: number
  /** Which side of the anchor-to-foot line the stay breaks toward. */
  bend?: "up" | "down"
  /** Degrees the bay door stands open with the gear down. */
  doorSwing: number
  /** Degrees the bogie tilts by the time it is stowed. */
  bogieTilt: number
  wheel: number
  /** Axles on the bogie, and the spacing between them. */
  axles: number
  axleSpacing: number
  /** Wheels on each axle, and the track across it. */
  wheels: number
  track: number
}

/** One gear unit at some point through its retraction. */
export interface GearPose {
  /** 0 down and locked, 1 stowed. */
  retraction: number
  /** Degrees the leg has swung off vertical. */
  legAngle: number
  /** The trunnion, unmoved: the leg's fixed pivot. */
  trunnion: Vec3
  /** The axle at the bottom of the leg. */
  axle: Vec3
  /** Where the stay's foot sits on the leg. */
  foot: Vec3
  /** The stay's anchor on the structure. */
  anchor: Vec3
  /** The knee the stay folds at — the solved joint. */
  knee: Vec3
  /** Degrees the bay door stands open. It shuts last. */
  door: number
  /** Degrees the bogie has tilted. */
  tilt: number
  /** False when the stay could not reach and the knee was clamped onto its annulus. */
  reachable: boolean
}

export const defaultGearGeometry: GearGeometry = {
  trunnion: { x: 0, y: 20, z: 0 },
  leg: 18,
  fold: "forward",
  side: 1,
  sweep: 88,
  anchor: { x: 9, y: 1.5 },
  stayUpper: 10,
  stayLower: 11,
  stayFoot: 0.62,
  bend: "up",
  doorSwing: 84,
  bogieTilt: 14,
  wheel: 3.4,
  axles: 2,
  axleSpacing: 7,
  wheels: 2,
  track: 6.4,
}

const gearOf = (gear: Partial<GearGeometry> | undefined): GearGeometry => {
  const base = defaultGearGeometry
  return {
    trunnion: {
      x: finite(gear?.trunnion?.x, base.trunnion.x),
      y: finite(gear?.trunnion?.y, base.trunnion.y),
      z: finite(gear?.trunnion?.z, base.trunnion.z),
    },
    leg: Math.max(1e-3, span(gear?.leg, base.leg)),
    fold: gear?.fold === "inboard" || gear?.fold === "aft" ? gear.fold : "forward",
    side: gear?.side === -1 ? -1 : 1,
    sweep: clamp(finite(gear?.sweep, base.sweep), -180, 180),
    anchor: {
      x: finite(gear?.anchor?.x, base.anchor.x),
      y: finite(gear?.anchor?.y, base.anchor.y),
    },
    stayUpper: Math.max(1e-3, span(gear?.stayUpper, base.stayUpper)),
    stayLower: Math.max(1e-3, span(gear?.stayLower, base.stayLower)),
    stayFoot: clamp(finite(gear?.stayFoot, base.stayFoot), 0, 1),
    bend: gear?.bend === "down" ? "down" : "up",
    doorSwing: finite(gear?.doorSwing, base.doorSwing),
    bogieTilt: finite(gear?.bogieTilt, base.bogieTilt),
    wheel: span(gear?.wheel, base.wheel),
    axles: clamp(Math.round(span(gear?.axles, base.axles)), 1, 4),
    axleSpacing: span(gear?.axleSpacing, base.axleSpacing),
    wheels: clamp(Math.round(span(gear?.wheels, base.wheels)), 1, 4),
    track: span(gear?.track, base.track),
  }
}

/**
 * Where a gear unit stands at `retraction`, 0 down and locked to 1 stowed.
 *
 * The leg is rigid and swings about its trunnion; the only thing that has to be
 * *solved* is the side stay, which is anchored to the structure at one end and
 * pinned part-way down the leg at the other, and folds at a knee as the leg
 * comes up. Two links and a known pair of ends is an elbow, so it is the law of
 * cosines — and a stay that cannot span the gap clamps onto its own annulus and
 * reports `reachable: false` rather than returning `NaN`.
 *
 * Everything comes back in world units, so a drawing projects the pose and has
 * no trigonometry of its own.
 */
export function gearRetraction(
  retraction: number,
  gear: Partial<GearGeometry> = defaultGearGeometry,
): GearPose {
  const g = gearOf(gear)
  const r = clamp(finite(retraction, 0), 0, 1)
  const theta = g.sweep * r * DEG

  // The fold plane: `u` runs toward the fold, `v` up, both from the trunnion.
  const legU = g.leg * Math.sin(theta)
  const legV = -g.leg * Math.cos(theta)
  const foot: Vec2 = { x: legU * g.stayFoot, y: legV * g.stayFoot }
  const anchor: Vec2 = { x: g.anchor.x, y: g.anchor.y }

  const reach = Math.hypot(foot.x - anchor.x, foot.y - anchor.y)
  const reachable =
    reach >= Math.abs(g.stayUpper - g.stayLower) && reach <= g.stayUpper + g.stayLower
  const knee = solveElbow2(anchor, foot, g.stayUpper, g.stayLower, g.bend)

  // Back into the world. A fold is a rotation in one plane, so the remaining
  // axis is simply the trunnion's own.
  const place = (point: Vec2): Vec3 => {
    switch (g.fold) {
      case "inboard":
        return { x: g.trunnion.x - g.side * point.x, y: g.trunnion.y + point.y, z: g.trunnion.z }
      case "aft":
        return { x: g.trunnion.x, y: g.trunnion.y + point.y, z: g.trunnion.z + point.x }
      default:
        return { x: g.trunnion.x, y: g.trunnion.y + point.y, z: g.trunnion.z - point.x }
    }
  }

  return {
    retraction: r,
    legAngle: g.sweep * r,
    trunnion: { ...g.trunnion },
    axle: place({ x: legU, y: legV }),
    foot: place(foot),
    anchor: place(anchor),
    knee: place(knee),
    // The door is open before the leg moves and shuts after it is home, which
    // is the one part of the sequence that is not the leg's own angle.
    door: g.doorSwing * (1 - ramp(r, 0.78, 1)),
    tilt: g.bogieTilt * r,
    reachable,
  }
}

/* -------------------------------------------------------------------------- */
/* the control mix                                                             */
/* -------------------------------------------------------------------------- */

/** What the flight deck is asking for. Degrees, except the two levers. */
export interface ControlCommand {
  /** Nose-up positive. */
  pitch?: number
  /** Starboard wing down positive. */
  roll?: number
  /** Nose right positive. */
  yaw?: number
  /** The flap lever, 0 clean to 1 fully dirty. Drives the slats and the gear too. */
  configuration?: number
  /** The speedbrake lever, 0 to 1. */
  speedbrake?: number
}

/** What every surface on the aeroplane is doing about it. */
export interface ControlDeflections {
  /** Elevator, degrees, trailing edge down positive. */
  elevator: number
  /** Stabiliser trim, degrees, leading edge up positive. */
  stabiliser: number
  /** Rudder, degrees, trailing edge to starboard positive. */
  rudder: number
  /** Inboard aileron, degrees, trailing edge down on the starboard side. */
  aileronInboard: number
  /** Outboard aileron. Zero once the flaps are up. */
  aileronOutboard: number
  /** Flap deflection, degrees. */
  flap: number
  /** Fowler travel aft, as a fraction of the flap's own chord. */
  flapExtension: number
  /** Leading-edge slat, degrees. */
  slat: number
  /** Slat travel forward, as a fraction of the slat's own chord. */
  slatExtension: number
  /** Port spoilers, degrees: speedbrake plus roll. */
  spoilerPort: number
  /** Starboard spoilers, degrees. */
  spoilerStarboard: number
  /** Where the gear should be, 0 up to 1 down. */
  gear: number
}

const MAX_ELEVATOR_DOWN = 17
const MAX_ELEVATOR_UP = 25
const MAX_RUDDER = 26
const MAX_AILERON = 20
const MAX_FLAP = 30
const MAX_SLAT = 25
const MAX_SPOILER = 45

/**
 * The commands a flight deck gives, mixed into the surfaces that carry them.
 * Four rules, all of them ones a big aeroplane really keeps:
 *
 * - **The slats lead the flaps.** Move the lever and the leading edge is out
 *   before the trailing edge has done anything, because that is the order the
 *   high-lift system runs in.
 * - **The outboard ailerons lock out** once the flaps are up. At cruise they
 *   would twist the wing more than they would roll it, so roll goes to the
 *   inboard pair and the spoilers, and the outboard pair only wakes up with the
 *   flaps out.
 * - **Roll spoilers rise on the down-going wing only.** They are not a mirrored
 *   pair — the up-going wing's stay down, and the speedbrake is what puts both
 *   sides up together.
 * - **The stabiliser trims with the configuration**, because extending the
 *   flaps changes the trim the aeroplane needs.
 *
 * Non-finite in gives the neutral, clean aeroplane out.
 */
export function controlMix(command: ControlCommand = {}): ControlDeflections {
  const pitch = clamp(finite(command?.pitch, 0), -30, 30)
  const roll = clamp(finite(command?.roll, 0), -30, 30)
  const yaw = clamp(finite(command?.yaw, 0), -30, 30)
  const configuration = clamp(finite(command?.configuration, 0), 0, 1)
  const speedbrake = clamp(finite(command?.speedbrake, 0), 0, 1)

  // The leading edge runs out first and is done by a third of the lever; the
  // trailing edge starts a little later and takes the rest of it.
  const slatExtension = ramp(configuration, 0, 0.3)
  const flapExtension = ramp(configuration, 0.15, 1)
  const flap = MAX_FLAP * ramp(configuration, 0.2, 1)

  // No flaps, no outboard aileron.
  const lockout = ramp(configuration, 0.05, 0.28)
  const demand = signless(clamp(roll * 1.4, -MAX_AILERON, MAX_AILERON))

  const brake = MAX_SPOILER * speedbrake
  const rollSpoiler = Math.abs(roll) * 1.6

  return {
    elevator: signless(clamp(pitch * -1.4, -MAX_ELEVATOR_UP, MAX_ELEVATOR_DOWN)),
    stabiliser: signless(clamp(pitch * 0.3 + configuration * 2.6, -4, 12)),
    rudder: signless(clamp(yaw * 1.5, -MAX_RUDDER, MAX_RUDDER)),
    aileronInboard: signless(demand),
    aileronOutboard: signless(demand * lockout),
    flap,
    flapExtension,
    slat: MAX_SLAT * slatExtension,
    slatExtension,
    spoilerPort: clamp(brake + (roll < 0 ? rollSpoiler : 0), 0, MAX_SPOILER),
    spoilerStarboard: clamp(brake + (roll > 0 ? rollSpoiler : 0), 0, MAX_SPOILER),
    // The gear is the last thing out and the first thing away.
    gear: ramp(configuration, 0.45, 0.8),
  }
}
