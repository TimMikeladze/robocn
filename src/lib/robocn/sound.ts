/**
 * robocn — sound geometry.
 *
 * The closures in a machine that makes a sound by moving something. A spiral
 * groove that gears the stylus to the platter, a pivoted tonearm whose angle is
 * solved from the groove radius and whose tracking error falls out of it, an
 * exponential horn, a spring governor, a comb tuned by length, and a pinned
 * barrel — which is also a step sequencer, unrolled flat.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * acoustics: nothing here computes a frequency response, a horn's cutoff, a
 * spring's torque curve or a decay. Geometry only.
 */

import { clamp, lerp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { px } from "@/lib/robocn/style"

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

/** Wrap into `[0, span)`, for negatives as well as positives. */
const wrap = (value: number, span: number) =>
  span > 0 ? ((value % span) + span) % span : 0

/* -------------------------------------------------------------------------- */
/* the groove                                                                  */
/* -------------------------------------------------------------------------- */

export interface GrooveGeometry {
  /** Radius of the outermost groove — where the stylus lands. */
  outer: number
  /** Radius of the innermost groove, at the run-out. */
  inner: number
  /** How far in the stylus walks per revolution of the platter. */
  pitch: number
}

export interface GroovePose {
  /** Where the stylus is standing, as a radius from the spindle. */
  radius: number
  /** How far through the side, 0 at the lead-in and 1 at the run-out. */
  progress: number
  /** Revolutions of the platter since the lead-in. */
  revolutions: number
  /** Revolutions left before the run-out. */
  remaining: number
}

/** Revolutions in a whole side: the playable band divided by the groove pitch. */
export function grooveTurns({ outer, inner, pitch }: GrooveGeometry) {
  const band = Math.max(0, finite(outer, 0) - finite(inner, 0))
  const step = Math.max(1e-6, Math.abs(finite(pitch, 1)))
  return band / step
}

/**
 * The spiral is what gears the arm to the platter: one revolution moves the
 * stylus inward by exactly one groove pitch, so progress and platter angle are
 * one number at two scales rather than two animations that drift apart.
 */
export function groovePose(progress: number, geometry: GrooveGeometry): GroovePose {
  const turns = grooveTurns(geometry)
  const at = clamp(finite(progress, 0), 0, 1)
  const outer = finite(geometry.outer, 0)
  const inner = finite(geometry.inner, 0)
  return {
    radius: lerp(outer, inner, at),
    progress: at,
    revolutions: turns * at,
    remaining: turns * (1 - at),
  }
}

/** Where a stylus standing at `radius` has got to through the side. */
export function grooveProgress(radius: number, geometry: GrooveGeometry) {
  const outer = finite(geometry.outer, 0)
  const inner = finite(geometry.inner, 0)
  const band = outer - inner
  if (Math.abs(band) < 1e-9) return 0
  return clamp((outer - finite(radius, outer)) / band, 0, 1)
}

/**
 * The groove as artwork: one Archimedean spiral from the outer radius to the
 * inner one, drawn with `turns` visible turns. A side holds hundreds; this is
 * the drawing of it, and the count is the caller's choice.
 */
export function grooveSpiralPath(
  geometry: GrooveGeometry,
  turns = 18,
  stepsPerTurn = 24,
): string {
  const laps = Math.max(0, Math.floor(finite(turns, 18)))
  const per = Math.max(4, Math.floor(finite(stepsPerTurn, 24)))
  if (laps < 1) return ""
  const outer = finite(geometry.outer, 0)
  const inner = finite(geometry.inner, 0)
  const total = laps * per
  const points: string[] = []
  for (let step = 0; step <= total; step += 1) {
    const at = step / total
    const radius = lerp(outer, inner, at)
    const angle = at * laps * Math.PI * 2
    points.push(
      `${step ? "L" : "M"} ${px(Math.cos(angle) * radius)} ${px(Math.sin(angle) * radius)}`,
    )
  }
  return points.join(" ")
}

/* -------------------------------------------------------------------------- */
/* the tonearm                                                                 */
/* -------------------------------------------------------------------------- */

export interface TonearmGeometry {
  /** Pivot to spindle: where the arm is bolted to the plinth. */
  mounting: number
  /** Pivot to stylus, the effective length. Overhang is the difference. */
  effective: number
  /** How far the headshell twists the cartridge out of the arm's axis, degrees. */
  offset: number
}

export interface TonearmPose {
  /** Groove radius actually reached, clamped into what the arm can sweep. */
  radius: number
  /**
   * The arm's rotation about its pivot, degrees. Zero points from the pivot
   * straight at the spindle, and it grows as the stylus moves outward.
   */
  angle: number
  /** Pivot position, with the spindle at the origin and the pivot at +x. */
  pivot: Vec2
  /** Stylus position in the same frame. The arm sweeps below the axis. */
  stylus: Vec2
  /**
   * Angle between the cartridge's axis and the groove's tangent, degrees. The
   * number the whole geometry exists to minimise; it changes sign between the
   * two null radii.
   */
  trackingError: number
  /** How far the stylus reaches past the spindle: effective minus mounting. */
  overhang: number
  /** True when the radius asked for is outside the band the arm can reach. */
  offGroove: boolean
}

/**
 * A triangle with two fixed sides. The pivot is `mounting` from the spindle and
 * the stylus is `effective` from the pivot, so asking for a groove radius fixes
 * the arm angle — it is solved, never tweened between an inner pose and an
 * outer one.
 */
export function tonearmPose(radius: number, geometry: TonearmGeometry): TonearmPose {
  const mounting = Math.max(1e-6, finite(geometry.mounting, 0))
  const effective = Math.max(1e-6, finite(geometry.effective, 0))
  const offset = finite(geometry.offset, 0)
  const wanted = finite(radius, mounting)
  // The stylus can only stand between |L − m| and L + m from the spindle.
  const near = Math.abs(effective - mounting)
  const far = effective + mounting
  const reached = clamp(wanted, near, far)
  const cosPivot = clamp(
    (mounting * mounting + effective * effective - reached * reached) /
      (2 * mounting * effective),
    -1,
    1,
  )
  const angle = Math.acos(cosPivot)
  // The arm sweeps into y < 0, so the stylus swings below the pivot-spindle line.
  const pivot = { x: mounting, y: 0 }
  const stylus = {
    x: mounting - Math.cos(angle) * effective,
    y: -Math.sin(angle) * effective,
  }
  // Angle at the stylus between stylus→pivot and stylus→spindle. The cartridge
  // points the other way down the arm, and the tangent is square to the radius.
  const cosStylus = clamp(
    (effective * effective + reached * reached - mounting * mounting) /
      (2 * effective * Math.max(1e-6, reached)),
    -1,
    1,
  )
  return {
    radius: reached,
    angle: toDegrees(angle),
    pivot,
    stylus,
    trackingError: 90 - toDegrees(Math.acos(cosStylus)) - offset,
    overhang: effective - mounting,
    offGroove: Math.abs(reached - wanted) > 1e-9,
  }
}

/**
 * The radii where the cartridge sits exactly square to the groove. A well set
 * up arm has two of them inside the record; a badly set up one, or an acoustic
 * gramophone's, may have none.
 */
export function tonearmNulls(
  geometry: TonearmGeometry,
  inner: number,
  outer: number,
  samples = 240,
): number[] {
  const from = Math.max(1e-6, finite(inner, 0))
  const to = Math.max(from, finite(outer, 0))
  const steps = Math.max(8, Math.floor(finite(samples, 240)))
  const error = (radius: number) => tonearmPose(radius, geometry).trackingError
  const found: number[] = []
  let previousRadius = from
  let previous = error(previousRadius)
  for (let step = 1; step <= steps; step += 1) {
    const radius = lerp(from, to, step / steps)
    const current = error(radius)
    if (previous === 0) found.push(previousRadius)
    else if (previous * current < 0) {
      // Bisect: the error is smooth in the radius, so this converges fast.
      let low = previousRadius
      let high = radius
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const middle = (low + high) / 2
        if (error(low) * error(middle) <= 0) high = middle
        else low = middle
      }
      found.push((low + high) / 2)
    }
    previousRadius = radius
    previous = current
  }
  if (previous === 0) found.push(previousRadius)
  return found
}

/* -------------------------------------------------------------------------- */
/* the horn                                                                    */
/* -------------------------------------------------------------------------- */

export type HornFlare = "exponential" | "conical"

export interface HornGeometry {
  /** Radius where the horn meets the soundbox. */
  throat: number
  /** Radius at the mouth. */
  mouth: number
  /** Distance from throat to mouth along the axis. */
  length: number
  flare?: HornFlare
}

export interface HornSection {
  /** Distance from the throat along the axis. */
  along: number
  radius: number
}

/**
 * The flare constant: the exponential horn's area doubles every `ln 2 / rate`
 * of axial length. Zero for a cone, which grows by a constant radius instead.
 */
export function flareRate({ throat, mouth, length, flare = "exponential" }: HornGeometry) {
  const start = Math.max(1e-6, finite(throat, 1))
  const end = Math.max(1e-6, finite(mouth, 1))
  const run = Math.max(1e-6, finite(length, 1))
  return flare === "conical" ? 0 : Math.log(end / start) / run
}

/** Horn radius `along` the axis from the throat. */
export function hornRadius(along: number, geometry: HornGeometry) {
  const start = Math.max(1e-6, finite(geometry.throat, 1))
  const end = Math.max(1e-6, finite(geometry.mouth, 1))
  const run = Math.max(1e-6, finite(geometry.length, 1))
  const at = clamp(finite(along, 0), 0, run)
  if (geometry.flare === "conical") return lerp(start, end, at / run)
  return start * Math.exp(flareRate(geometry) * at)
}

/** The horn sampled into sections, throat first, ready to be drawn as a solid. */
export function hornProfile(geometry: HornGeometry, steps = 14): HornSection[] {
  const run = Math.max(1e-6, finite(geometry.length, 1))
  const count = Math.max(2, Math.floor(finite(steps, 14)))
  return Array.from({ length: count }, (_, index) => {
    const along = (index / (count - 1)) * run
    return { along, radius: hornRadius(along, geometry) }
  })
}

/* -------------------------------------------------------------------------- */
/* the governor                                                                */
/* -------------------------------------------------------------------------- */

export interface GovernorOptions {
  /** Wind below which the mainspring can no longer hold the speed up. */
  knee?: number
  /** Flyweight arm angle from the shaft at rest and against its stop, degrees. */
  minAngle?: number
  maxAngle?: number
}

export interface GovernorPose {
  /** Regulated speed, 0 stalled to 1 at the governed rate. */
  speed: number
  /** How far the flyweights have flown out, 0 in to 1 against the stop. */
  spread: number
  /** The flyweight arms' angle from the shaft, degrees. */
  angle: number
  /** True once the spring is run right down. */
  stalled: boolean
  /** True while the governor is actually regulating rather than being dragged. */
  governing: boolean
}

/**
 * What a wind-up drive actually does: the mainspring holds the governed speed
 * while it has torque to spare and sags proportionally once it does not, and
 * the flyweights stand out with the square of the speed until they reach their
 * stop. No spring model — this is the shape of the behaviour, not a torque
 * curve.
 */
export function governorPose(
  wind: number,
  { knee = 0.3, minAngle = 8, maxAngle = 46 }: GovernorOptions = {},
): GovernorPose {
  const wound = clamp(finite(wind, 0), 0, 1)
  const sag = clamp(finite(knee, 0.3), 1e-3, 1)
  const speed = wound >= sag ? 1 : wound / sag
  const spread = clamp(speed * speed, 0, 1)
  return {
    speed,
    spread,
    angle: lerp(finite(minAngle, 8), finite(maxAngle, 46), spread),
    stalled: wound <= 0,
    governing: wound >= sag,
  }
}

/* -------------------------------------------------------------------------- */
/* the comb                                                                    */
/* -------------------------------------------------------------------------- */

export interface CombOptions {
  /** Length of the lowest tine. Everything else is tuned against it. */
  longest?: number
  /** Semitones above the root, repeating up the octaves. */
  scale?: readonly number[]
}

export interface CombTine {
  index: number
  /** Semitones above the lowest tine. */
  semitones: number
  /** Free length of the tine. */
  length: number
}

/**
 * A comb is tuned by length. A cantilever's frequency goes as one over its
 * length squared, so a semitone is a factor of 2^(−1/24) and an octave up is
 * exactly one over root two the length — which is why the fan is curved rather
 * than a straight taper.
 */
export function combTines(count: number, options: CombOptions = {}): CombTine[] {
  const tines = Number.isFinite(count) ? clamp(Math.round(count), 0, 64) : 0
  const longest = Math.max(1e-6, finite(options.longest, 1))
  const scale = options.scale?.length ? options.scale : [0, 2, 4, 5, 7, 9, 11]
  return Array.from({ length: tines }, (_, index) => {
    const degree = scale[index % scale.length] ?? 0
    const semitones = finite(degree, 0) + 12 * Math.floor(index / scale.length)
    return { index, semitones, length: longest * Math.pow(2, -semitones / 24) }
  })
}

/* -------------------------------------------------------------------------- */
/* the pinned barrel                                                           */
/* -------------------------------------------------------------------------- */

export interface BarrelPin {
  /** Which tine — or which voice — this pin lifts. */
  tine: number
  /** Where round the barrel it stands, in steps. */
  step: number
  /** The same position as an angle about the barrel, degrees. */
  angle: number
}

export interface Barrel {
  /** Positions round the barrel. One revolution is this many steps. */
  steps: number
  /** Rows in the pattern: tines on a comb, voices on a kit. */
  tines: number
  pins: BarrelPin[]
}

const BLANK = new Set([" ", ".", "-", "_", "\t"])

export interface BarrelLiftOptions {
  /** Steps over which a pin lifts its tine before letting go. */
  engage?: number
  /** Steps over which a released tine rings down. */
  tail?: number
}

/**
 * Pins laid out from a pattern: one row per tine, any non-blank character a
 * pin at that step. It is data, so a malformed or empty row gives a barrel that
 * turns and plucks nothing rather than one that throws.
 */
export function pinBarrel(pattern: readonly string[], steps?: number): Barrel {
  const rows = Array.isArray(pattern) ? pattern : []
  const widest = rows.reduce((longest, row) => Math.max(longest, row?.length ?? 0), 0)
  const span = Number.isFinite(steps) ? Math.max(0, Math.round(steps as number)) : widest
  const pins: BarrelPin[] = []
  rows.forEach((row, tine) => {
    for (let step = 0; step < Math.min(row?.length ?? 0, span); step += 1) {
      if (BLANK.has(row[step]!)) continue
      pins.push({ tine, step, angle: span > 0 ? (step / span) * 360 : 0 })
    }
  })
  return { steps: span, tines: rows.length, pins }
}

/** The step standing under the comb at `position`, wrapped into the barrel. */
export function barrelStep(barrel: Barrel, position: number) {
  return Math.floor(wrap(finite(position, 0), barrel.steps))
}

/**
 * How far a pin has lifted its tine: 0 free, rising as the pin comes round and
 * exactly 1 at the step itself, then nothing — that discontinuity is the pluck.
 */
export function combLift(
  barrel: Barrel,
  tine: number,
  position: number,
  { engage = 0.7 }: BarrelLiftOptions = {},
) {
  const span = barrel.steps
  if (span <= 0) return 0
  const window = clamp(finite(engage, 0.7), 1e-3, span)
  const at = finite(position, 0)
  let lift = 0
  for (const pin of barrel.pins) {
    if (pin.tine !== tine) continue
    const away = wrap(pin.step - at, span)
    if (away < window) lift = Math.max(lift, 1 - away / window)
  }
  return lift
}

/**
 * The other half of the pluck: 1 at the instant of release and falling away
 * over `tail` steps. A tine at full lift and a tine just let go are the same
 * moment, which is why both are 1 exactly at the pin.
 */
export function combRelease(
  barrel: Barrel,
  tine: number,
  position: number,
  { tail = 2 }: BarrelLiftOptions = {},
) {
  const span = barrel.steps
  if (span <= 0) return 0
  const window = clamp(finite(tail, 2), 1e-3, span)
  const at = finite(position, 0)
  let ring = 0
  for (const pin of barrel.pins) {
    if (pin.tine !== tine) continue
    const since = wrap(at - pin.step, span)
    if (since < window) ring = Math.max(ring, 1 - since / window)
  }
  return ring
}

/** Where a pin stands on the barrel's surface, in the barrel's own section. */
export function pinPoint(angle: number, radius: number, height = 0): Vec2 {
  const turn = toRadians(finite(angle, 0))
  const reach = Math.max(0, finite(radius, 0)) + Math.max(0, finite(height, 0))
  return { x: Math.sin(turn) * reach, y: -Math.cos(turn) * reach }
}
