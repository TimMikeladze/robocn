/**
 * gym-geometry — the mechanisms that stand between a selected weight and a
 * felt load.
 *
 * Everything else in the set that carries a load is honest about *position*: a
 * walker's hull goes where the support polygon lets it, a derrick's block hangs
 * where the rope pays out. None of them say anything about force, because none
 * of them has a mechanism in between. These five do, and the mechanism is the
 * whole point — in a gym the resistance a person feels is almost never the
 * weight they selected:
 *
 * ```
 * reeving ratio    handle force = W / n,   stack rise = d / n
 * cam radius       resistance   = W · r(θ),  payout = ∫ r dθ
 * rail angle       sled load    = W · sin(θ)
 * coupler curve    stride       = extent of the path the linkage draws
 * air drag         handle force ∝ (handle speed)²,  drag factor = k / I
 * ```
 *
 * Every one of those right-hand sides is an **output**. The inputs are a pin
 * position, a lever angle, a rail angle, four link lengths and a damper vent.
 *
 * Pure functions over plain `{x, y}`. No React, no three.js, no dependencies
 * beyond `kinematics.ts` and `linkage.ts`. Unit-agnostic: lengths are world
 * units and weights are whatever the caller counts in, so a "plate" is a plate.
 * No friction anywhere — no rail friction, no sheave loss, no rope stretch, no
 * bearing drag — and no person: nothing here knows about a muscle or a rep.
 *
 * Design note: docs/gym-machines.md.
 */

import { clamp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  rigidPoint,
  solveFourBar,
  tacklePosition,
  type FourBarGeometry,
  type FourBarOptions,
} from "@/lib/robocn/linkage"

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, and never negative. */
const span = (value: number, fallback: number) =>
  Math.abs(finite(value, fallback))

/** A count: finite, whole, and at least one. */
const count = (value: number, fallback: number) =>
  Math.max(1, Math.round(finite(value, fallback)))

/** Hermite ease, flat at both ends. */
const smooth = (t: number) => {
  const u = clamp(t, 0, 1)
  return u * u * (3 - 2 * u)
}

/* -------------------------------------------------------------------------- */
/* 1 — the reeving ratio                                                       */
/* -------------------------------------------------------------------------- */

export interface StackGeometry {
  /** Plates in the stack. */
  plates: number
  /** Height of one plate. */
  plateHeight: number
  /** Air between plates at rest, so a lifted plate reads as lifted. */
  plateGap: number
  /**
   * Falling lines under the load. This is the mechanical advantage, and it is
   * the only thing that decides it.
   */
  lines: number
  /** What one plate weighs, in whatever unit the caller counts in. */
  plateWeight: number
  /**
   * Which plate the selector pin is in, counted from the **top**: 0 pins the
   * top plate alone. That plate and everything above it ride the riser.
   */
  pin: number
  /** How far the stack may rise before the top plate reaches the crown. */
  headroom: number
}

export interface StackPlate {
  /** Counted from the top: 0 is the top plate. */
  index: number
  /** Height of the plate's underside. */
  y: number
  /** True where the pin has coupled this plate to the riser. */
  rising: boolean
}

export interface StackLift {
  /** Plate the pin is in, clamped into the stack. */
  pin: number
  /** How many plates that pin picks up. */
  selected: number
  /** What they weigh together. */
  weight: number
  /** Lines under the load, which is the mechanical advantage. */
  advantage: number
  /** What the handle has to hold: the selected weight over the advantage. */
  handleForce: number
  /** How far the handle has been drawn. */
  draw: number
  /** How far the stack came up for it: the draw over the advantage. */
  rise: number
  /** Every plate, top first, at the height it is actually at. */
  plates: StackPlate[]
  /** True at the top of the travel, where the stack has run out of headroom. */
  atLimit: boolean
}

export const defaultStackGeometry: StackGeometry = {
  plates: 10,
  plateHeight: 7,
  plateGap: 1.2,
  lines: 2,
  plateWeight: 5,
  pin: 5,
  headroom: 44,
}

/**
 * `tacklePosition` states the travel constraint for a rope coming off a drum.
 * A cable station has no drum — the handle *is* the fast line — so one "turn"
 * is set to one world unit of rope and the same constraint runs unchanged.
 */
const ROPE_TURN = 1 / (2 * Math.PI)

/**
 * Where the stack sits after the handle has been drawn `draw` world units.
 *
 * The rope is inextensible, so whatever the handle draws is shared between the
 * lines under the load: the stack rises `draw / lines` and the handle holds
 * `weight / lines`. Reeve another pair of lines in and the same pull moves the
 * same plates half as far, for half the force. Nobody sets the advantage; the
 * reeving is the advantage.
 */
export function reeveStack(
  draw: number,
  geometry: StackGeometry = defaultStackGeometry,
): StackLift {
  const plates = count(geometry?.plates, defaultStackGeometry.plates)
  const plateHeight = span(geometry?.plateHeight, defaultStackGeometry.plateHeight)
  const plateGap = span(geometry?.plateGap, defaultStackGeometry.plateGap)
  const plateWeight = span(geometry?.plateWeight, defaultStackGeometry.plateWeight)
  const headroom = span(geometry?.headroom, defaultStackGeometry.headroom)
  const lines = count(geometry?.lines, defaultStackGeometry.lines)
  const pin = clamp(Math.round(finite(geometry?.pin, 0)), 0, plates - 1)
  const pulled = Math.max(0, finite(draw, 0))

  // Top at rest, travelling down to -headroom, so `travel` is the clamped rise.
  const tackle = tacklePosition(pulled, {
    lines,
    drumRadius: ROPE_TURN,
    topHeight: 0,
    floorHeight: -headroom,
  })
  const rise = tackle.travel
  const selected = pin + 1
  const weight = selected * plateWeight
  const pitch = plateHeight + plateGap

  return {
    pin,
    selected,
    weight,
    advantage: tackle.advantage,
    handleForce: weight / tackle.advantage,
    draw: pulled,
    rise,
    plates: Array.from({ length: plates }, (_, index) => {
      const rising = index <= pin
      return {
        index,
        y: (plates - 1 - index) * pitch + (rising ? rise : 0),
        rising,
      }
    }),
    atLimit: tackle.atLimit,
  }
}

/* -------------------------------------------------------------------------- */
/* 2 — the cam radius                                                          */
/* -------------------------------------------------------------------------- */

export interface CamGeometry {
  /** Smallest working radius, at the ends of the sweep. */
  baseRadius: number
  /** Largest working radius, where the strength curve peaks. */
  peakRadius: number
  /** Lever angle the peak sits at, degrees into the sweep. */
  peakAngle: number
  /** How far the lever travels, degrees. */
  sweep: number
  /** How much of the sweep the hump occupies, either side of the peak. 0–1. */
  width: number
  /** The lever's own radius: where the hand is, so leverage has a denominator. */
  lever: number
  /** Where the cable runs to, relative to the pivot: the sheave under the cam. */
  anchor: Vec2
  /** Which way round the anchor line the cable leaves the groove. */
  side: 1 | -1
}

export interface CamPose {
  /** Lever angle, degrees into the sweep, clamped. */
  angle: number
  /**
   * The working radius at this angle. `momentArm` is the same number — that is
   * the mechanism, not a coincidence.
   */
  radius: number
  /** Perpendicular distance from the pivot to the cable. Equals `radius`. */
  momentArm: number
  /** What the cam multiplies the stack weight by at the hand. */
  leverage: number
  /** Cable off the cam, the integral of r dθ over the sweep so far. */
  payout: number
  /**
   * Where the cable leaves the groove: the point on the working circle where
   * the run to the anchor is tangent. So the perpendicular distance from the
   * pivot to that run is `radius`, exactly, whatever direction it leaves in.
   */
  departure: Vec2
  /** Where it runs to, carried through so the drawing has the whole line. */
  anchor: Vec2
  /** Degrees the cam has turned to bring this radius round to the departure. */
  spin: number
  /**
   * What the payout would have been on a plain round pulley of `baseRadius`.
   * The gap between this and `payout` is the non-linearity, and it is why the
   * stack does not track the lever.
   */
  linearPayout: number
}

export const defaultCamGeometry: CamGeometry = {
  baseRadius: 13,
  peakRadius: 34,
  peakAngle: 55,
  sweep: 120,
  width: 0.5,
  lever: 56,
  anchor: { x: 8, y: -100 },
  side: 1,
}

const camSpread = (geometry: CamGeometry) =>
  Math.max(1e-6, span(geometry?.width, defaultCamGeometry.width) * span(geometry?.sweep, defaultCamGeometry.sweep))

/**
 * The working radius at one lever angle: a raised cosine hump over the sweep,
 * so the cam is fattest where the joint is strongest and falls smoothly back to
 * the base radius at both ends. Continuous and bounded, which matters because
 * this profile is integrated and then drawn.
 */
export function camRadius(
  angle: number,
  geometry: CamGeometry = defaultCamGeometry,
): number {
  const base = span(geometry?.baseRadius, defaultCamGeometry.baseRadius)
  const peak = span(geometry?.peakRadius, defaultCamGeometry.peakRadius)
  const peakAngle = finite(geometry?.peakAngle, defaultCamGeometry.peakAngle)
  const spread = camSpread(geometry)
  const offset = clamp((finite(angle, 0) - peakAngle) / spread, -1, 1)
  const hump = 0.5 * (1 + Math.cos(Math.PI * offset))
  return base + (peak - base) * hump
}

/** Composite Simpson over `[0, angle]` in radians; `r` is smooth, so this is tight. */
function integrateRadius(angle: number, geometry: CamGeometry, steps = 64): number {
  const to = toRadians(angle)
  if (to === 0) return 0
  const n = count(steps, 64) * 2
  const h = to / n
  let total = camRadius(0, geometry) + camRadius(angle, geometry)
  for (let index = 1; index < n; index += 1) {
    const at = toDegrees(h * index)
    total += camRadius(at, geometry) * (index % 2 === 0 ? 2 : 4)
  }
  return (total * h) / 3
}

/**
 * The lever, the cam and the cable it pays out.
 *
 * The cable sits in the cam's groove and leaves it along a line whose
 * perpendicular distance from the pivot is the working radius — which is the
 * definition of a pitch radius, and it makes two things exactly true at once:
 * the **moment arm is the cam radius** at that angle, so the resistance is
 * `W · r(θ)`; and the cable comes off at `r dθ`, so the **payout is the
 * integral** and the stack does not rise linearly with the lever. Turn the cam
 * through its fat part and the stack runs away from the handle.
 */
export function solveCam(
  angle: number,
  geometry: CamGeometry = defaultCamGeometry,
): CamPose {
  const sweep = span(geometry?.sweep, defaultCamGeometry.sweep)
  const lever = Math.max(1e-6, span(geometry?.lever, defaultCamGeometry.lever))
  const at = clamp(finite(angle, 0), 0, sweep)
  const radius = camRadius(at, geometry)
  const base = span(geometry?.baseRadius, defaultCamGeometry.baseRadius)

  const anchor: Vec2 = {
    x: finite(geometry?.anchor?.x, defaultCamGeometry.anchor.x),
    y: finite(geometry?.anchor?.y, defaultCamGeometry.anchor.y),
  }
  const departure = camTangent(radius, anchor, geometry?.side === -1 ? -1 : 1)

  return {
    angle: at,
    radius,
    momentArm: radius,
    leverage: radius / lever,
    payout: integrateRadius(at, geometry),
    departure,
    anchor,
    // The cam has to turn until the point of its profile for cam angle `at`
    // reaches wherever the cable is leaving from. That profile point sits at
    // polar −at, so the spin runs forward with the lever, as a keyed cam does.
    spin: toDegrees(Math.atan2(departure.y, departure.x)) + at,
    linearPayout: base * toRadians(at),
  }
}

/**
 * Where a cable running to `anchor` touches a circle of `radius` about the
 * origin. The run from there to the anchor is tangent, so its perpendicular
 * distance from the pivot is exactly `radius` — which is what makes the moment
 * arm the cam radius no matter which way the cable leaves.
 *
 * An anchor inside the circle has no tangent; the cable is then taken as
 * leaving straight at it, which is the degenerate case drawn rather than NaN.
 */
export function camTangent(radius: number, anchor: Vec2, side: 1 | -1 = 1): Vec2 {
  const r = span(radius, 1)
  const x = finite(anchor?.x, 0)
  const y = finite(anchor?.y, -1)
  const distance = Math.hypot(x, y)
  const heading = Math.atan2(y, x)
  if (distance <= r || distance === 0) {
    return { x: Math.cos(heading) * r, y: Math.sin(heading) * r }
  }
  const offset = Math.acos(clamp(r / distance, -1, 1)) * side
  return {
    x: Math.cos(heading + offset) * r,
    y: Math.sin(heading + offset) * r,
  }
}

/**
 * The cam's profile where it actually stands at this lever angle: the outline
 * from {@link camProfile}, turned by the pose's own spin. The drawn snail is
 * then the resistance curve *in place* — the radius reaching the cable is the
 * moment arm, read straight off the machine.
 */
export function camOutline(
  pose: CamPose,
  geometry: CamGeometry = defaultCamGeometry,
  steps = 48,
): Vec2[] {
  const turn = toRadians(finite(pose?.spin, 0))
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return camProfile(geometry, steps).map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }))
}

/**
 * The cam's outline in its own frame, polar about the pivot: the point for cam
 * angle φ sits at radius `camRadius(φ)` and polar angle **−φ**, so that a cam
 * keyed to the lever and turning forward with it brings later and later parts
 * of the groove round to the cable. So the drawn snail **is** the resistance
 * curve — reading radius off the outline is reading the moment arm off the
 * machine.
 */
export function camProfile(
  geometry: CamGeometry = defaultCamGeometry,
  steps = 48,
): Vec2[] {
  const sweep = span(geometry?.sweep, defaultCamGeometry.sweep)
  const n = count(steps, 48)
  return Array.from({ length: n + 1 }, (_, index) => {
    const at = (index / n) * sweep
    const radius = camRadius(at, geometry)
    const radians = toRadians(-at)
    return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius }
  })
}

/* -------------------------------------------------------------------------- */
/* 3 — the rail angle                                                          */
/* -------------------------------------------------------------------------- */

export interface SledGeometry {
  /** Rail inclination from horizontal, degrees. This is the resistance. */
  railAngle: number
  /** How far along the rails the carriage may travel. */
  travel: number
  /** Where the bottom of the rail sits. */
  foot: Vec2
  /** What is loaded onto the carriage. */
  weight: number
}

export interface SledPose {
  /** Stroke, 0 racked at the bottom to 1 fully extended. */
  stroke: number
  /** Rail inclination actually used, clamped to something a frame could be. */
  railAngle: number
  /** How far up the rails the carriage has gone. */
  along: number
  /** Where the carriage sits. */
  carriage: Vec2
  /** Bottom and top of the rail, for the drawing. */
  rail: [Vec2, Vec2]
  /** The component of the weight along the rails: `weight · sin(angle)`. */
  load: number
  /** That load as a fraction of the weight — `sin(angle)`, and nothing else. */
  fraction: number
  /** Height the carriage has actually gained. */
  lift: number
}

export const defaultSledGeometry: SledGeometry = {
  railAngle: 38,
  travel: 96,
  foot: { x: -52, y: 16 },
  weight: 60,
}

/**
 * A carriage on inclined rails.
 *
 * Only the component of the weight that lies along the rails resists, so the
 * load is `weight · sin(angle)` and the rail angle *is* the resistance: a 30°
 * frame hands back half the plate weight, a 45° frame 0.71 of it, and a
 * vertical one all of it. This is the only machine in the family where changing
 * the frame changes the weight, which is why a number off one leg press does
 * not compare with a number off another.
 *
 * Frictionless: no rail friction, no roller drag, no bearing loss.
 */
export function solveSled(
  stroke: number,
  geometry: SledGeometry = defaultSledGeometry,
): SledPose {
  const railAngle = clamp(finite(geometry?.railAngle, defaultSledGeometry.railAngle), 0, 90)
  const travel = span(geometry?.travel, defaultSledGeometry.travel)
  const weight = span(geometry?.weight, defaultSledGeometry.weight)
  const foot: Vec2 = {
    x: finite(geometry?.foot?.x, defaultSledGeometry.foot.x),
    y: finite(geometry?.foot?.y, defaultSledGeometry.foot.y),
  }
  const at = clamp(finite(stroke, 0), 0, 1)
  const radians = toRadians(railAngle)
  const along = at * travel
  const fraction = Math.sin(radians)

  const step = (distance: number): Vec2 => ({
    x: foot.x + Math.cos(radians) * distance,
    y: foot.y + Math.sin(radians) * distance,
  })

  return {
    stroke: at,
    railAngle,
    along,
    carriage: step(along),
    rail: [foot, step(travel)],
    load: weight * fraction,
    fraction,
    lift: along * fraction,
  }
}

/* -------------------------------------------------------------------------- */
/* 4 — the coupler curve                                                       */
/* -------------------------------------------------------------------------- */

export interface TrainerGeometry extends FourBarGeometry {
  /** Where the footpad is fixed on the coupler: along it, then to its left. */
  padAlong: number
  padOffset: number
  /** How far up the rocker the grip stands, from the rocker's ground pivot. */
  grip: number
}

export interface TrainerPose {
  crankAngle: number
  crankPivot: Vec2
  crankPin: Vec2
  couplerPin: Vec2
  rockerPivot: Vec2
  /** The footpad: a point rigidly attached to the coupler. */
  foot: Vec2
  /** The grip: the rocker carried on past its pin, so arms and feet share a loop. */
  grip: Vec2
  /** Straight from `solveFourBar` — how near the linkage is to locking up. */
  transmissionAngle: number
  /** False where the loop cannot close, so the drawing shows it stretched. */
  assembled: boolean
}

export interface TrainerPath {
  /** One closed turn of the crank, as the path the footpad draws. */
  path: Vec2[]
  /** Horizontal extent of that path. Nobody set this. */
  stride: number
  /** Vertical extent of the same path. */
  rise: number
  /** Where the path sits, for framing. */
  centre: Vec2
}

export const defaultTrainerGeometry: TrainerGeometry = {
  ground: 90,
  rise: 30,
  crank: 36,
  coupler: 80,
  rocker: 90,
  padAlong: 140,
  padOffset: 0,
  grip: -70,
}

/**
 * The assembly this linkage is built around. Chosen once, here, so the machine
 * cannot flip branch between frames and turn itself inside out.
 */
const TRAINER_BRANCH: FourBarOptions = { branch: "down" }

/**
 * The crank, the coupler and the rocker, solved as a closed loop, with the
 * footpad fixed to the coupler and the grip carried on up the rocker.
 *
 * The foot does not follow a drawn oval: it follows the **coupler curve** of
 * this linkage, which is closed, egg-shaped and distinctly not an ellipse.
 * Change the crank radius or any link length and the shape of the path changes
 * — which is exactly the difference between one machine's feel and another's.
 * Arms and legs cannot drift out of phase because they are the same loop.
 */
export function solveTrainer(
  crankAngle: number,
  geometry: TrainerGeometry = defaultTrainerGeometry,
  options: FourBarOptions = TRAINER_BRANCH,
): TrainerPose {
  const pose = solveFourBar(crankAngle, geometry ?? defaultTrainerGeometry, options)
  const padAlong = finite(geometry?.padAlong, defaultTrainerGeometry.padAlong)
  const padOffset = finite(geometry?.padOffset, defaultTrainerGeometry.padOffset)
  const grip = finite(geometry?.grip, defaultTrainerGeometry.grip)

  return {
    crankAngle: pose.crankAngle,
    crankPivot: pose.crankPivot,
    crankPin: pose.crankPin,
    couplerPin: pose.couplerPin,
    rockerPivot: pose.rockerPivot,
    foot: rigidPoint(pose.crankPin, pose.couplerAngle, padAlong, padOffset),
    grip: rigidPoint(pose.rockerPivot, pose.rockerAngle, grip),
    transmissionAngle: pose.transmissionAngle,
    assembled: pose.assembled,
  }
}

/**
 * A whole turn of the crank, sampled: the closed path the footpad draws, and
 * the stride and rise that path happens to have. Both are measured off the
 * solved loop, so they move when the linkage does.
 */
export function trainerFootPath(
  geometry: TrainerGeometry = defaultTrainerGeometry,
  steps = 72,
  options: FourBarOptions = TRAINER_BRANCH,
): TrainerPath {
  const n = count(steps, 72)
  const path = Array.from(
    { length: n },
    (_, index) => solveTrainer((index / n) * 360, geometry, options).foot,
  )
  const xs = path.map((point) => point.x)
  const ys = path.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    path,
    stride: maxX - minX,
    rise: maxY - minY,
    centre: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  }
}

/* -------------------------------------------------------------------------- */
/* 5 — velocity-squared drag                                                   */
/* -------------------------------------------------------------------------- */

export interface ErgGeometry {
  /** Flywheel moment of inertia. */
  inertia: number
  /** Damper vent, 0 shut to 1 open: how much air reaches the cage. */
  vent: number
  /** Drag coefficient with the vent shut, and with it wide open. */
  dragShut: number
  dragOpen: number
  /** Sprocket radius: what turns chain speed into rim speed. */
  sprocket: number
  /** Strokes per second. */
  rate: number
  /** Seat slide, body swing and arm draw, as travel at the handle. */
  slide: number
  swing: number
  draw: number
  /** Fraction of the cycle the drive takes; the rest is the recovery. */
  driveFraction: number
  /**
   * How much of the cycle the slide is still coming forward after the chain has
   * gone taut. The overlap at the catch, and where the counter-travel lives.
   */
  catchOverlap: number
}

export interface ErgSample {
  phase: number
  /** Handle position, measured away from the flywheel. */
  handle: number
  /** Seat position on the slide, measured the same way. */
  seat: number
  /** Their rates, in world units per second. Signs are the interesting part. */
  handleRate: number
  seatRate: number
  /** Flywheel speed, radians per second. */
  speed: number
  /** What the handle holds. Zero whenever the clutch has let go. */
  force: number
  /** True while the chain is driving the wheel rather than the wheel coasting. */
  engaged: boolean
}

export interface ErgCycle {
  /** One steady-state stroke, evenly spaced in phase. */
  samples: ErgSample[]
  /** `k / I` — the number a rower reads off the monitor. Set by the vent. */
  dragFactor: number
  /** Drag coefficient itself. */
  drag: number
  peakSpeed: number
  meanSpeed: number
  peakForce: number
  /** Strokes per minute. */
  strokeRate: number
  /**
   * Fraction of the cycle where the handle and the seat are travelling in
   * opposite directions. Measured off the samples, not asserted.
   */
  counterPhase: number
}

export const defaultErgGeometry: ErgGeometry = {
  inertia: 0.1,
  vent: 0.5,
  dragShut: 0.008,
  dragOpen: 0.028,
  sprocket: 1.4,
  rate: 0.5,
  slide: 42,
  swing: 16,
  draw: 26,
  driveFraction: 0.38,
  catchOverlap: 0.05,
}

const ergDrag = (geometry: ErgGeometry) => {
  const shut = span(geometry?.dragShut, defaultErgGeometry.dragShut)
  const open = span(geometry?.dragOpen, defaultErgGeometry.dragOpen)
  return shut + (open - shut) * clamp(finite(geometry?.vent, 0.5), 0, 1)
}

/** Position on a ramp that may start before the cycle does, on a wrapped axis. */
const ramp = (phase: number, from: number, to: number) => {
  const width = to - from
  if (width <= 0) return phase >= to ? 1 : 0
  // A ramp reaching past the end of the cycle is still running at the start of
  // the next one, which is what an overlap at the catch is.
  const at = phase < from - 1 + width ? phase + 1 : phase
  return smooth((at - from) / width)
}

/**
 * Where the seat is at `phase`, 0 at the catch and 1 at the finish.
 *
 * The recovery's slide runs past the end of the cycle by `catchOverlap`, so the
 * seat is still coming forward into the start of the next drive. That is the
 * change of direction at the catch, and it is where the handle and the seat end
 * up travelling opposite ways.
 */
function ergSeat(phase: number, geometry: ErgGeometry): number {
  const drive = clamp(finite(geometry?.driveFraction, 0.38), 0.05, 0.95)
  const overlap = clamp(finite(geometry?.catchOverlap, 0), 0, 0.2)
  const recovery = 1 - drive
  const legsEnd = drive * 0.62
  const slideStart = drive + recovery * 0.34

  if (phase < overlap) return 1 - ramp(phase, slideStart, 1 + overlap)
  if (phase < legsEnd) return smooth((phase - overlap) / Math.max(1e-6, legsEnd - overlap))
  if (phase < slideStart) return 1
  return 1 - ramp(phase, slideStart, 1 + overlap)
}

/** The body swing, 0 compressed at the catch to 1 laid back at the finish. */
function ergSwing(phase: number, geometry: ErgGeometry): number {
  const drive = clamp(finite(geometry?.driveFraction, 0.38), 0.05, 0.95)
  const recovery = 1 - drive
  // Opens from before the catch, so it already has speed when the chain bites.
  const open = ramp(phase, -recovery * 0.08, drive * 0.86)
  if (phase < drive) return open
  return 1 - ramp(phase, drive + recovery * 0.16, drive + recovery * 0.58)
}

/** The arm draw, 0 extended to 1 drawn to the chest. */
function ergDrawAt(phase: number, geometry: ErgGeometry): number {
  const drive = clamp(finite(geometry?.driveFraction, 0.38), 0.05, 0.95)
  const recovery = 1 - drive
  if (phase < drive) return smooth((phase - drive * 0.52) / Math.max(1e-6, drive * 0.48))
  return 1 - ramp(phase, drive, drive + recovery * 0.26)
}

/** Handle travel: the seat carries it, the body swings it, the arms draw it. */
function ergHandle(phase: number, geometry: ErgGeometry): number {
  const slide = span(geometry?.slide, defaultErgGeometry.slide)
  const swing = span(geometry?.swing, defaultErgGeometry.swing)
  const draw = span(geometry?.draw, defaultErgGeometry.draw)
  return (
    ergSeat(phase, geometry) * slide +
    ergSwing(phase, geometry) * swing +
    ergDrawAt(phase, geometry) * draw
  )
}

/**
 * One steady-state stroke of the flywheel.
 *
 * The fan is retarded by `k·ω²`, and the damper vent sets `k`: open it, more
 * air reaches the cage, `k` rises and so does the drag factor `k / I`. The
 * chain drives the wheel through a one-way clutch, so while the chain is faster
 * than the rim the wheel is *driven* — `ω = handleRate / sprocket` — and the
 * handle holds `k·ω² / sprocket`, which is why an erg gets harder the faster it
 * is pulled rather than the further. Drop below rim speed and the clutch lets
 * go; the wheel then coasts on drag alone, `dω/dt = −k·ω²/I`.
 *
 * The cycle is integrated repeatedly until the speed it starts at is the speed
 * it ends at, so what comes back is the machine's steady state rather than a
 * spin-up. Sample it with {@link ergAt}; it is a pure function of the geometry,
 * so a component can memoise it and still be a pure function of the clock.
 */
export function solveErgCycle(
  geometry: ErgGeometry = defaultErgGeometry,
  steps = 180,
): ErgCycle {
  const inertia = Math.max(1e-6, span(geometry?.inertia, defaultErgGeometry.inertia))
  const sprocket = Math.max(1e-6, span(geometry?.sprocket, defaultErgGeometry.sprocket))
  const rate = Math.max(1e-3, span(geometry?.rate, defaultErgGeometry.rate))
  const drag = ergDrag(geometry)
  const n = count(steps, 180)
  const period = 1 / rate
  const dt = period / n

  // Rates come off the schedules by a central difference in phase, which is
  // exact enough for schedules this smooth and keeps them the single source.
  const h = 0.5 / n
  const handleAt = (phase: number) => ergHandle(((phase % 1) + 1) % 1, geometry)
  const seatAt = (phase: number) =>
    ergSeat(((phase % 1) + 1) % 1, geometry) * span(geometry?.slide, defaultErgGeometry.slide)
  const slopeOf = (at: (phase: number) => number, phase: number) =>
    ((at(phase + h) - at(phase - h)) / (2 * h)) * rate

  let speed = 0
  let samples: ErgSample[] = []
  // Two passes settle it — the clutch pins the speed through the whole drive —
  // but a shut vent and a slow rate coast a long way, so allow a few more.
  for (let pass = 0; pass < 8; pass += 1) {
    const started = speed
    samples = []
    for (let index = 0; index < n; index += 1) {
      const phase = index / n
      const handleRate = slopeOf(handleAt, phase)
      const seatRate = slopeOf(seatAt, phase)
      const chain = Math.max(0, handleRate) / sprocket
      const engaged = chain > speed
      if (engaged) speed = chain
      else speed = Math.max(0, speed - (drag * speed * speed * dt) / inertia)
      samples.push({
        phase,
        handle: handleAt(phase),
        seat: seatAt(phase),
        handleRate,
        seatRate,
        speed,
        force: engaged ? (drag * speed * speed) / sprocket : 0,
        engaged,
      })
    }
    if (Math.abs(speed - started) < 1e-9) break
  }

  const speeds = samples.map((sample) => sample.speed)
  const counter = samples.filter(
    (sample) => sample.handleRate * sample.seatRate < 0,
  ).length

  return {
    samples,
    dragFactor: drag / inertia,
    drag,
    peakSpeed: Math.max(...speeds),
    meanSpeed: speeds.reduce((total, value) => total + value, 0) / n,
    peakForce: Math.max(...samples.map((sample) => sample.force)),
    strokeRate: rate * 60,
    counterPhase: counter / n,
  }
}

/** One sample of a solved cycle, interpolated, with the phase wrapped. */
export function ergAt(cycle: ErgCycle, phase: number): ErgSample {
  const samples = cycle?.samples ?? []
  if (!samples.length) {
    return {
      phase: 0,
      handle: 0,
      seat: 0,
      handleRate: 0,
      seatRate: 0,
      speed: 0,
      force: 0,
      engaged: false,
    }
  }
  const wrapped = ((finite(phase, 0) % 1) + 1) % 1
  const position = wrapped * samples.length
  const index = Math.floor(position)
  const blend = position - index
  const from = samples[index % samples.length]
  const to = samples[(index + 1) % samples.length]
  const mix = (a: number, b: number) => a + (b - a) * blend
  return {
    phase: wrapped,
    handle: mix(from.handle, to.handle),
    seat: mix(from.seat, to.seat),
    handleRate: mix(from.handleRate, to.handleRate),
    seatRate: mix(from.seatRate, to.seatRate),
    speed: mix(from.speed, to.speed),
    force: mix(from.force, to.force),
    engaged: blend < 0.5 ? from.engaged : to.engaged,
  }
}
