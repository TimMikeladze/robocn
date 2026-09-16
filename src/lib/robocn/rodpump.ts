/**
 * rodpump-geometry — the downhole end of a beam-pumped well, and the card it
 * draws.
 *
 * A sucker-rod pump has no chain to solve: the plunger is one reciprocating
 * degree of freedom hung off a crank. What it does have is *mechanics* — a
 * fluid column that transfers on and off the rods twice a revolution, two
 * ball valves whose sequence follows from where the plunger is and which way
 * it is going, and a gas space below the plunger that compresses. That is what
 * this file solves, and it is why the machine earns a solver rather than a
 * pose table.
 *
 * One compression model produces the whole diagnostic family. The travelling
 * valve opens where the gas trapped below the plunger reaches discharge
 * pressure, or on contact with the liquid, whichever comes first:
 *
 *   full  — the barrel fills, so contact is at the top of the stroke
 *   gas   — the gas compresses, so the load bleeds off down a Boyle curve
 *   pound — no gas to compress, so the load holds out to the liquid and slams
 *
 * They are the same function at different intake ratios and fillages, not
 * three drawn shapes, and `gas` and `pound` both fall back onto `full` as the
 * barrel fills. Valve leakage is the other axis: slip past the travelling
 * valve bleeds the column off through the upstroke, backflow through the
 * standing valve keeps load on the rods at the bottom.
 *
 * Field formulas, unchanged from the handbook: the fluid load
 * `Fo = 0.34 · D² · G · L` and the displacement `PD = 0.1166 · D² · S · N`.
 *
 * What is **not** here: no wave equation. The surface card is not propagated
 * down the rod string, there is no rod stretch, damping, inertia, buoyancy,
 * friction, gas solubility, temperature or slippage rate. `TRANSFER` is one
 * constant standing in for the stretch that rounds a real card's corners.
 *
 * Pure functions over plain objects. No React, no three.js, no dependencies —
 * the SVG components and the r3f rig call the same code, which is the whole
 * reason the set can claim "2D + 3D, same kinematics".
 */

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

/** The diagnostic cards a pump draws. `full` is the one everything else is read against. */
export type PumpCondition =
  | "full"
  | "gas"
  | "pound"
  | "tv-leak"
  | "sv-leak"
  | "tagging"

export interface PumpGeometry {
  /** Plunger bore, inches. */
  plungerDiameter: number
  /** Plunger stroke, inches. */
  strokeLength: number
  /** Net lift the plunger works against, feet. */
  netLift: number
  /** Produced-fluid specific gravity; water is 1. */
  fluidGravity: number
  /** Surface strokes a minute. */
  strokesPerMinute: number
  /** Liquid fillage of the barrel over one stroke, 0 to 1. */
  fillage: number
  /**
   * Pump intake pressure as a fraction of the differential the plunger works
   * against, `Pi / (Pd − Pi)`. It is how hard the gas below the plunger pushes
   * back as it is compressed, and so how rounded the gas-interference card is.
   * Zero is a vacuum below the plunger, which is a fluid pound.
   */
  intakeRatio: number
  /** Severity of the leak the `tv-leak` and `sv-leak` conditions model, 0 to 1. */
  leak: number
}

export const defaultPumpGeometry: PumpGeometry = {
  plungerDiameter: 1.75,
  strokeLength: 86,
  netLift: 4200,
  fluidGravity: 0.9,
  strokesPerMinute: 8,
  fillage: 1,
  intakeRatio: 0.35,
  leak: 0.45,
}

/**
 * How much of the stroke the fluid load takes to transfer on and off the rods
 * once the valves have done their part. This is rod stretch — a string four
 * thousand feet long is a spring — and it is the one number here that is a
 * constant rather than a consequence.
 */
export const TRANSFER = 0.05

/** Clearance below the plunger at the bottom of the stroke, in stroke fractions. */
export const CLEARANCE = 0.06

/**
 * The fraction of the plunger's differential over which a ball is released from
 * its seat. A ball is held down by the pressure across it, so it comes off when
 * that reverses — quickly, but not at a single instant.
 */
export const SEAL_BAND = 0.06

/** Travel over which a descending plunger takes up against the liquid it meets. */
export const CONTACT_BAND = 0.015

/**
 * The flow that pins a ball against its cage, as a fraction of the plunger's
 * peak rate. Below it the ball rides part way up, which is where a real one
 * spends most of the stroke.
 */
export const BALL_FLOAT = 0.55

/** Travel over which a tagging plunger loads up, and how far above Fo it goes. */
const TAG_TRAVEL = 0.06
const TAG_SPIKE = 1.45

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/** A dimension: finite, and never negative. */
const size = (value: number | undefined, fallback: number) =>
  Math.abs(finite(value, fallback))

const unit = (value: number | undefined, fallback: number) =>
  clamp(finite(value, fallback), 0, 1)

/** Smoothstep, so a load transfer starts and stops like a rod string. */
const ease = (t: number) => {
  const u = clamp(t, 0, 1)
  return u * u * (3 - 2 * u)
}

/* -------------------------------------------------------------------------- */
/* the stroke                                                                  */
/* -------------------------------------------------------------------------- */

/** Fold a running clock onto one cycle, 0 at the bottom of the stroke. */
export const pumpPhase = (cycle: number) => {
  const t = finite(cycle, 0)
  return ((t % 1) + 1) % 1
}

/**
 * Plunger travel at `cycle`: 0 on bottom, 1 on top. The plunger hangs off a
 * crank, so it dwells at both ends and runs fastest through the middle.
 */
export function plungerTravel(cycle: number) {
  return (1 - Math.cos(pumpPhase(cycle) * Math.PI * 2)) / 2
}

/** Which way the plunger is going at `cycle`: 1 up, −1 down. */
export function strokeDirection(cycle: number): 1 | -1 {
  return pumpPhase(cycle) < 0.5 ? 1 : -1
}

/**
 * How fast the plunger is going at `cycle`, normalised to ±1 — the derivative
 * of {@link plungerTravel}, so it is zero at both ends of the stroke and
 * fastest through the middle. Whatever the pump is moving, it is moving it at
 * this rate.
 */
export function plungerSpeed(cycle: number) {
  return Math.sin(pumpPhase(cycle) * Math.PI * 2)
}

/**
 * The cycle nearest `near` that puts the plunger at `travel`. Each travel
 * happens twice a cycle, once going up and once coming down; picking the
 * nearer branch is what lets a person drag the plunger by hand and have it
 * turn over at the top the way a crank does instead of reversing.
 */
export function cycleForTravel(travel: number, near = 0) {
  const t = unit(travel, 0)
  const here = finite(near, 0)
  const up = Math.acos(clamp(1 - 2 * t, -1, 1)) / (Math.PI * 2)
  const base = Math.floor(here)
  const candidates = [base + up, base + 1 - up, base + 1 + up, base - up]
  return candidates.reduce(
    (best, candidate) =>
      Math.abs(candidate - here) < Math.abs(best - here) ? candidate : best,
    candidates[0],
  )
}

/* -------------------------------------------------------------------------- */
/* the field formulas                                                          */
/* -------------------------------------------------------------------------- */

/** Plunger face area, square inches. */
export function plungerArea(geometry: PumpGeometry = defaultPumpGeometry) {
  const d = size(geometry?.plungerDiameter, defaultPumpGeometry.plungerDiameter)
  return (Math.PI / 4) * d * d
}

/**
 * The fluid load the plunger carries on the upstroke, pounds:
 * `Fo = 0.34 · D² · G · L`, which is the plunger area times the head of the
 * column it lifts.
 */
export function fluidLoad(geometry: PumpGeometry = defaultPumpGeometry) {
  const d = size(geometry?.plungerDiameter, defaultPumpGeometry.plungerDiameter)
  const gravity = size(geometry?.fluidGravity, defaultPumpGeometry.fluidGravity)
  const lift = size(geometry?.netLift, defaultPumpGeometry.netLift)
  return 0.34 * d * d * gravity * lift
}

/**
 * What the pump would displace and what this fillage actually lifts, barrels a
 * day: `PD = 0.1166 · D² · S · N`.
 */
export function pumpDisplacement(geometry: PumpGeometry = defaultPumpGeometry) {
  const d = size(geometry?.plungerDiameter, defaultPumpGeometry.plungerDiameter)
  const stroke = size(geometry?.strokeLength, defaultPumpGeometry.strokeLength)
  const spm = size(geometry?.strokesPerMinute, defaultPumpGeometry.strokesPerMinute)
  const displacement = 0.1166 * d * d * stroke * spm
  return { displacement, production: displacement * unit(geometry?.fillage, 1) }
}

/* -------------------------------------------------------------------------- */
/* the card                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What a condition does to the pump, as numbers rather than as a drawn shape.
 * Everything downstream reads this, so the six cards are six points in one
 * model instead of six special cases.
 */
export interface PumpRegime {
  /** Liquid fillage the barrel takes over a stroke. */
  fill: number
  /**
   * Pump intake pressure as a fraction of the differential the plunger works
   * against, `Pi / (Pd − Pi)`: how hard what is below the plunger pushes back.
   */
  ratio: number
  /**
   * How much of the unfilled barrel is compressible gas rather than void. Gas
   * cushions the plunger on the way down; a void does not, which is the whole
   * difference between gas interference and a fluid pound.
   */
  gas: number
  /** Slip past the travelling valve, bleeding the column off up the stroke. */
  slip: number
  /** Backflow through the standing valve, holding load on at the bottom. */
  backflow: number
  /** The plunger tags bottom. */
  tag: boolean
}

export function pumpRegime(
  condition: PumpCondition,
  geometry: PumpGeometry = defaultPumpGeometry,
): PumpRegime {
  const fill = unit(geometry?.fillage, 1)
  const ratio = Math.max(0, finite(geometry?.intakeRatio, defaultPumpGeometry.intakeRatio))
  const leak = unit(geometry?.leak, defaultPumpGeometry.leak)
  const sound = { fill: 1, ratio, gas: 1, slip: 0, backflow: 0, tag: false }
  switch (condition) {
    // Gas below the plunger has to be compressed to discharge pressure before
    // the travelling valve will open, and expanded back to intake pressure
    // before the standing valve will.
    case "gas":
      return { ...sound, fill }
    // The unfilled volume is void rather than gas, so there is nothing to
    // compress: the plunger falls free onto the liquid.
    case "pound":
      return { ...sound, fill, gas: 0 }
    // Slip past the valve or the plunger: the column cannot all be carried.
    case "tv-leak":
      return { ...sound, slip: leak }
    // Fluid running back down through the seat re-loads the rods early.
    case "sv-leak":
      return { ...sound, backflow: leak * 0.35 }
    case "tagging":
      return { ...sound, tag: true }
    default:
      return sound
  }
}

/* -------------------------------------------------------------------------- */
/* the chamber, which decides everything else                                  */
/* -------------------------------------------------------------------------- */

/** Gas the clearance keeps at the bottom of the stroke, as a stroke fraction. */
const trappedAtBottom = (regime: PumpRegime) =>
  Math.max(CLEARANCE * regime.gas * (1 - regime.fill), CLEARANCE * 0.02)

/** Gas space between the liquid and the plunger at the top of the stroke. */
const trappedAtTop = (regime: PumpRegime) => 1 - regime.fill + CLEARANCE

/**
 * Pressure in the pump chamber — the volume between the standing valve and the
 * plunger — normalised so 0 is pump intake pressure and 1 is discharge.
 *
 * **This is the one number the pump turns on.** The two balls are not
 * independent parts that happen to alternate: they are the two ends of this one
 * volume, and each is held on its seat or lifted off it by this pressure
 * against the pressure on its other side. So:
 *
 *   p ≤ 0   the chamber is below the formation — the standing valve lifts
 *   0 < p < 1  neither: **both balls are down**, and the plunger is doing
 *              nothing but change the pressure. That is the transfer, and it is
 *              the two ends of a dynamometer card.
 *   p ≥ 1   the chamber is above the column above it — the travelling valve
 *           lifts and the barrel discharges up through the plunger.
 *
 * They can never both pass, because the chamber cannot be below the formation
 * and above the discharge column at the same time.
 *
 * Which way the plunger is going decides which way the pressure is moving.
 * Going up it expands whatever gas the clearance kept, from discharge down
 * toward intake; coming down it compresses what is trapped above the liquid,
 * from intake up toward discharge — until it meets the liquid, which does not
 * compress at all.
 */
export function chamberPressure(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
) {
  const regime = pumpRegime(condition, geometry)
  const travel = plungerTravel(cycle)
  if (strokeDirection(cycle) > 0) {
    // Expansion. A barrel that filled has nothing to expand, so the chamber is
    // at intake pressure as soon as the plunger moves and the standing valve
    // lifts at once; a gassy one has to give the gas its volume back first.
    const kept = trappedAtBottom(regime)
    return clamp((1 + regime.ratio) * (kept / (kept + travel)) - regime.ratio, 0, 1)
  }
  // Compression, and then contact: below the liquid level the plunger is
  // pushing on something that will not compress, so the chamber goes straight
  // to discharge pressure and the travelling valve has to open.
  const contact = ease((regime.fill - travel) / CONTACT_BAND)
  const space = Math.max(travel - regime.fill + CLEARANCE, CLEARANCE * 0.02)
  const compressed =
    regime.gas <= 0 ? 0 : regime.ratio * (trappedAtTop(regime) / space - 1)
  return clamp(Math.max(compressed, contact), 0, 1)
}

/**
 * The travel at which the travelling valve opens on the downstroke: where the
 * chamber first reaches discharge pressure, either because the gas above the
 * liquid has been compressed that far or because the plunger has met the liquid
 * itself. For a barrel that fills, that is the top of the stroke — the card's
 * square corner.
 */
export function tvOpenTravel(regime: PumpRegime) {
  if (regime.gas <= 0) return clamp(regime.fill, 0, 1)
  const squeezed =
    regime.fill - CLEARANCE + (trappedAtTop(regime) * regime.ratio) / (1 + regime.ratio)
  return clamp(Math.max(regime.fill, squeezed), 0, 1)
}

/**
 * The travel at which the standing valve lifts on the upstroke: where the same
 * chamber first falls back to intake pressure. Zero, near enough, for a barrel
 * that fills; a real fraction of the stroke for a gassy one, which is the other
 * half of gas interference and the reason a gassy pump fills late as well as
 * discharging late.
 */
export function svOpenTravel(regime: PumpRegime) {
  if (regime.ratio <= 0) return 0
  return clamp(trappedAtBottom(regime) / regime.ratio, 0, 1)
}

/**
 * How much of the swept volume actually reaches surface. Three things take
 * their cut: the barrel only fills to `fill`, slip past the travelling valve
 * puts part of what it did lift back underneath the plunger, and backflow
 * through the standing valve puts part of it back in the hole. A pump can be
 * stroking perfectly and still deliver half of what it displaces.
 */
export function volumetricEfficiency(regime: PumpRegime) {
  return clamp(regime.fill * (1 - regime.slip) * (1 - regime.backflow), 0, 1)
}

/* -------------------------------------------------------------------------- */
/* the card                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Load on the plunger at `cycle`, as a fraction of the fluid load.
 *
 * It is one statement: **what the plunger carries is what is left of the
 * differential across it**, which is `1 − chamberPressure`, rounded by the
 * stretch of the rod string and reduced by whatever the valves are leaking. The
 * card's abscissa is {@link plungerTravel} and this is its ordinate, so the two
 * together *are* the card and a dot drawn from them cannot leave it.
 */
export function pumpLoad(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
) {
  const regime = pumpRegime(condition, geometry)
  const travel = plungerTravel(cycle)
  const differential = 1 - chamberPressure(cycle, condition, geometry)
  let load: number
  if (strokeDirection(cycle) > 0) {
    // Pick-up. The chamber has to fall to intake pressure before the plunger
    // carries anything, and the rods have to stretch before they feel it — so a
    // gassy pump picks up late twice over.
    const taken = differential * ease(travel / TRANSFER)
    load =
      (regime.backflow + (1 - regime.backflow) * taken) * (1 - regime.slip * travel)
  } else {
    // Release. The load stays on the rods until the chamber comes up to
    // discharge, which is immediate for a full barrel, a long smooth curve for
    // a gassy one, and a slam onto the liquid for a pounding one.
    const carried = 1 - regime.slip
    const stretch = 1 - ease((1 - travel) / TRANSFER)
    load = Math.max(
      carried * (differential + (1 - differential) * stretch),
      regime.backflow * (1 - travel),
    )
  }
  // Tagging: the plunger lands on the standing valve and the rods take the
  // shock, which is a spike above Fo at the bottom of the card and nowhere else.
  return regime.tag && travel < TAG_TRAVEL
    ? load + TAG_SPIKE * (1 - travel / TAG_TRAVEL)
    : load
}

export interface PumpCard {
  /** The closed card: x is plunger travel, y is load as a fraction of Fo. */
  points: Vec2[]
  /** The highest load on the card, for scaling it into a frame. */
  peak: number
}

/**
 * The card itself, sampled over one cycle. Sampling in cycle rather than in
 * travel is what puts the points where a recorder would put them — crowded at
 * the ends of the stroke, where the plunger dwells and the transfers happen.
 */
export function pumpCard(
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
  steps = 128,
): PumpCard {
  const count = Math.max(24, Math.round(finite(steps, 128)))
  const points = Array.from({ length: count }, (_, index) => {
    const cycle = index / count
    return { x: plungerTravel(cycle), y: pumpLoad(cycle, condition, geometry) }
  })
  return { points, peak: points.reduce((high, p) => Math.max(high, p.y), 0) }
}

/* -------------------------------------------------------------------------- */
/* the valves                                                                  */
/* -------------------------------------------------------------------------- */

export interface PumpValves {
  /** Travelling valve lift, in the plunger: 0 on its seat, 1 against its cage. */
  travelling: number
  /** Standing valve lift, at the foot of the barrel: 0 on its seat, 1 on its cage. */
  standing: number
  /** Flow through the travelling valve, as a fraction of the peak plunger rate. */
  travellingFlow: number
  /** Flow through the standing valve, same units. */
  standingFlow: number
  /** Top of the liquid in the barrel, in stroke fractions off the seat. */
  charge: number
  /** 1 up, −1 down. */
  direction: 1 | -1
}

/**
 * Flow through each valve at `cycle`, as a fraction of the plunger's peak rate.
 *
 * Both gates come off the **same** chamber pressure, which is what makes the
 * two valves one mechanism rather than two: the chamber cannot be below the
 * formation and above the discharge column at once, so they can never both
 * pass, and in between they are both shut and the plunger is only changing the
 * pressure.
 *
 * Direction decides which of them the flow could go through at all. Going up,
 * the plunger is drawing the barrel full through the standing valve; coming
 * down, it is pushing that charge back up through itself.
 */
export function valveFlow(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
) {
  const pressure = chamberPressure(cycle, condition, geometry)
  const rate = plungerSpeed(cycle)
  // Each ball is held down by the pressure across it and comes off its seat as
  // that reverses, over a little of the differential rather than at an instant.
  const under = ease((SEAL_BAND - pressure) / SEAL_BAND)
  const through = ease((pressure - (1 - SEAL_BAND)) / SEAL_BAND)
  return {
    travelling: rate < 0 ? -rate * through : 0,
    standing: rate > 0 ? rate * under : 0,
  }
}

/** What the pump is doing: the four sides of a dynamometer card, named. */
export type PumpState = "picking-up" | "filling" | "releasing" | "discharging"

/**
 * Which of the four it is at `cycle`. `picking-up` and `releasing` are the
 * intervals where **both balls are down** — the plunger is moving and nothing
 * is going anywhere, because all it is doing is changing the chamber pressure.
 * They are instants in a pump that fills and long arcs in a gassy one, and
 * that is why a gassy well's card has rounded ends.
 */
export function pumpState(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
): PumpState {
  const flow = valveFlow(cycle, condition, geometry)
  if (strokeDirection(cycle) > 0) return flow.standing > 0 ? "filling" : "picking-up"
  return flow.travelling > 0 ? "discharging" : "releasing"
}

/**
 * Where a ball rides. It is not a switch: once the pressure across it has let
 * it go, the stream past it carries it up its cage until the drag balances its
 * own submerged weight, and it settles back onto its seat as the flow dies at
 * the end of the stroke. Linear in flow, because the annular area past the ball
 * opens as it lifts — a ball in its seat is a rotameter, and that is why a real
 * one sits at a height rather than at one of two places.
 */
export function ballLift(flow: number) {
  return clamp(Math.abs(finite(flow, 0)) / BALL_FLOAT, 0, 1)
}

/**
 * What each ball is doing at `cycle`, and how much liquid the barrel is
 * holding. Nothing here is a schedule: a ball is off its seat because the
 * chamber let it go and fluid is going past it, and it is as far off its seat
 * as that flow will carry it.
 */
export function pumpValves(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
): PumpValves {
  const regime = pumpRegime(condition, geometry)
  const travel = plungerTravel(cycle)
  const up = strokeDirection(cycle) > 0
  const flow = valveFlow(cycle, condition, geometry)
  const svOpen = svOpenTravel(regime)
  return {
    travelling: ballLift(flow.travelling),
    standing: ballLift(flow.standing),
    travellingFlow: flow.travelling,
    standingFlow: flow.standing,
    // Going up nothing comes in until the standing valve lifts, and the barrel
    // then takes its fillage over what is left of the stroke. Coming down the
    // liquid stays where it is until the plunger reaches it, and from there the
    // plunger face is the level.
    charge: up
      ? travel <= svOpen
        ? 0
        : (regime.fill * (travel - svOpen)) / Math.max(1 - svOpen, 1e-6)
      : Math.min(regime.fill, travel),
    direction: up ? 1 : -1,
  }
}

/* -------------------------------------------------------------------------- */
/* the pose                                                                    */
/* -------------------------------------------------------------------------- */

export interface RodPumpPose {
  /** Position in the cycle, folded onto 0 to 1. */
  phase: number
  /** Plunger travel: 0 on bottom, 1 on top. */
  travel: number
  /** 1 up, −1 down. */
  direction: 1 | -1
  /** Plunger velocity normalised to ±1: zero at both ends, fastest in the middle. */
  speed: number
  /** Chamber pressure, 0 at pump intake and 1 at discharge. Decides both valves. */
  chamber: number
  /** Which of the card's four sides the pump is on. */
  state: PumpState
  /** Load on the plunger as a fraction of the fluid load. */
  load: number
  /** Travelling valve lift, 0 on its seat to 1 against its cage. */
  travelling: number
  /** Standing valve lift, 0 on its seat to 1 against its cage. */
  standing: number
  /** Flow through each valve, as a fraction of the peak plunger rate. */
  travellingFlow: number
  standingFlow: number
  /** Top of the liquid in the barrel, in stroke fractions off the seat. */
  charge: number
  /** Where the travelling valve opens on the downstroke, in travel. */
  tvOpen: number
  /** Fluid load Fo, pounds. */
  fluidLoad: number
  /** What the rods are carrying at this point in the cycle, pounds. */
  rodLoad: number
  /** Pump displacement, barrels a day. */
  displacement: number
  /** Fraction of the swept volume that reaches surface: fillage, less the leaks. */
  efficiency: number
  /** What this pump actually lifts, barrels a day. */
  production: number
}

/** The whole pump at one point in its cycle: one call, one frame of drawing. */
export function solveRodPump(
  cycle: number,
  condition: PumpCondition = "full",
  geometry: PumpGeometry = defaultPumpGeometry,
): RodPumpPose {
  const regime = pumpRegime(condition, geometry)
  const valves = pumpValves(cycle, condition, geometry)
  const load = pumpLoad(cycle, condition, geometry)
  const column = fluidLoad(geometry)
  const { displacement } = pumpDisplacement(geometry)
  const efficiency = volumetricEfficiency(regime)
  return {
    phase: pumpPhase(cycle),
    travel: plungerTravel(cycle),
    direction: valves.direction,
    speed: plungerSpeed(cycle),
    chamber: chamberPressure(cycle, condition, geometry),
    state: pumpState(cycle, condition, geometry),
    load,
    travelling: valves.travelling,
    standing: valves.standing,
    travellingFlow: valves.travellingFlow,
    standingFlow: valves.standingFlow,
    charge: valves.charge,
    tvOpen: tvOpenTravel(regime),
    fluidLoad: column,
    rodLoad: load * column,
    displacement,
    efficiency,
    production: displacement * efficiency,
  }
}
