/**
 * robocn — household geometry.
 *
 * The closures in the building you live in and the machines inside it. Seven
 * mechanisms, none of which a drawing is allowed to fake: a leaf hinged on an
 * edge that keeps its width, sectional panels that keep their length round a
 * bend, a drum whose whole regime is one dimensionless number, a tub on a
 * suspension that is worse at one speed than at a larger one, a lift car roped
 * to a counterweight, a louvre that reports when it has run out of travel, and
 * the flow a pressure pushes through a packed bed.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * thermodynamics: nothing here computes a heat flow, a pressure drop in a pipe,
 * a wind load, a temperature or an occupancy.
 */

import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, and never negative. */
const span = (value: number, fallback: number) => Math.abs(finite(value, fallback))

/** Standard gravity, in metres per second squared. The only constant here. */
export const GRAVITY = 9.80665

/* -------------------------------------------------------------------------- */
/* hinged leaves                                                               */
/* -------------------------------------------------------------------------- */

export interface SwingOptions {
  /** Across the face of the machine, hinge to free edge. */
  width: number
  /** How far the leaf can open before it hits its stop. Degrees. */
  maxAngle?: number
  /** Which way it opens: 1 swings the free edge toward +x, -1 toward -x. */
  side?: 1 | -1
}

export interface SwingPose {
  /** How far open, 0 shut to 1 at the stop. */
  open: number
  /** The angle that is, in degrees. */
  angle: number
  /**
   * The free edge, relative to the hinge: `x` across the face, `depth` out of
   * it toward the viewer. It lies on a circle of radius `width`, which is the
   * whole reason the swing is solved rather than tweened.
   */
  edge: { x: number; depth: number }
  /**
   * How much of the leaf a camera in front still sees, as a fraction of its own
   * width: `cos θ`. Zero edge-on. What decides whether the leaf's own artwork —
   * a handle, a dispenser, a control panel — is worth drawing at all.
   */
  facing: number
  /** How far the leaf now stands out of the face: `width · sin θ`. */
  reach: number
}

/**
 * A leaf hinged on a vertical edge. The free edge is placed on a circle about
 * the hinge, so a door at 90° stands exactly as far out of the face as it was
 * wide across it, and never stretches at any angle in between.
 */
export function swingPose(open: number, options: SwingOptions): SwingPose {
  const width = span(options.width, 40)
  const limit = clamp(span(options.maxAngle ?? 100, 100), 0, 180)
  const side = options.side === -1 ? -1 : 1
  const fraction = clamp(finite(open, 0), 0, 1)
  const angle = fraction * limit
  const radians = toRadians(angle)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    open: fraction,
    angle,
    edge: { x: side * width * cos, depth: width * sin },
    facing: cos,
    reach: width * sin,
  }
}

/* -------------------------------------------------------------------------- */
/* sectional doors                                                             */
/* -------------------------------------------------------------------------- */

export interface SectionalOptions {
  /** Hinged panels in the curtain. */
  panels: number
  /** Clear opening the shut door fills. Panel height is this over the count. */
  opening: number
  /** Radius of the quarter bend from vertical to horizontal. */
  radius?: number
  /** Horizontal run available under the head, back from the bend. */
  headroom?: number
}

export interface SectionalPanel {
  index: number
  /** Lower roller, in the door's own plane: `x` into the building, `y` up. */
  a: Vec2
  /** Upper roller. Exactly one panel height from `a`, at every travel. */
  b: Vec2
  /** Where the panel stands: 90° shut and vertical, 0° open and flat. */
  angle: number
  /** False once a roller has run past the end of the track and been clamped. */
  onTrack: boolean
}

interface Track {
  rise: number
  radius: number
  headroom: number
  length: number
}

const trackOf = (options: SectionalOptions): Track => {
  const rise = span(options.opening, 60)
  const radius = clamp(span(options.radius ?? rise * 0.22, rise * 0.22), 1, rise)
  const headroom = span(options.headroom ?? rise, rise)
  return { rise, radius, headroom, length: rise + (Math.PI * radius) / 2 + headroom }
}

/**
 * A point at arc length `s` along the track: up the face of the opening, round
 * a quarter bend, then back under the head. Past either end it runs on along
 * the tangent, which is what keeps a clamped roller in a straight line rather
 * than folded back on itself.
 */
function trackPoint(s: number, track: Track): Vec2 {
  const { rise, radius } = track
  const bend = (Math.PI * radius) / 2
  if (s <= rise) return { x: 0, y: s }
  if (s <= rise + bend) {
    const theta = (s - rise) / radius
    return {
      x: radius * (1 - Math.cos(theta)),
      y: rise + radius * Math.sin(theta),
    }
  }
  return { x: radius + (s - rise - bend), y: rise + radius }
}

const distance = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

/**
 * The arc length at which the track is exactly `chord` from the point at `s`.
 * The panel is rigid, so its two rollers are a chord apart, not an arc apart —
 * which is why a panel crossing the bend leans instead of curling.
 */
function chordAdvance(s: number, chord: number, track: Track): number {
  const from = trackPoint(s, track)
  let low = s
  let high = s + chord * 2
  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2
    if (distance(from, trackPoint(mid, track)) < chord) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/**
 * A sectional door: rigid panels hinged to each other, riding one track from
 * vertical to horizontal. `travel` is 0 shut and 1 fully open, and the panels
 * are placed by arc length along the track rather than drawn per position, so
 * every panel keeps its height at every travel.
 */
export function sectionalPanels(
  travel: number,
  options: SectionalOptions,
): SectionalPanel[] {
  const track = trackOf(options)
  const count = Math.max(1, Math.round(span(options.panels, 4)))
  const height = track.rise / count
  const open = clamp(finite(travel, 0), 0, 1)
  const limit = track.length - height * count

  let lower = open * Math.max(0, limit)
  const panels: SectionalPanel[] = []
  for (let index = 0; index < count; index += 1) {
    const upper = chordAdvance(lower, height, track)
    const a = trackPoint(lower, track)
    const b = trackPoint(upper, track)
    panels.push({
      index,
      a,
      b,
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      onTrack: upper <= track.length + 1e-6,
    })
    lower = upper
  }
  return panels
}

/** The track itself, as a polyline: what the rollers actually run in. */
export function sectionalTrack(options: SectionalOptions, steps = 24): Vec2[] {
  const track = trackOf(options)
  const count = Math.max(2, Math.round(finite(steps, 24)))
  return Array.from({ length: count }, (_, index) =>
    trackPoint((index / (count - 1)) * track.length, track),
  )
}

/* -------------------------------------------------------------------------- */
/* tumbling drums                                                              */
/* -------------------------------------------------------------------------- */

export type TumbleRegime =
  | "resting"
  | "cascading"
  | "cataracting"
  | "centrifuging"

export interface TumbleOptions {
  /** Inside radius of the drum, in metres. A domestic drum is about 0.25. */
  radius?: number
  /** Radius of an item's own body, so the load rides inside the wall. */
  itemRadius?: number
  gravity?: number
}

export interface TumblePose {
  /** Angular speed, radians per second. */
  omega: number
  /** ω²r/g. The whole regime is this number either side of one. */
  froude: number
  /**
   * Where the load leaves the wall, in degrees before the top on the rising
   * side, or `null` when it never leaves — which is the spin cycle.
   */
  release: number | null
  regime: TumbleRegime
}

const rideRadius = (options: TumbleOptions) => {
  const radius = span(options.radius ?? 0.25, 0.25)
  return Math.max(0.01, radius - span(options.itemRadius ?? 0, 0))
}

/**
 * What a drum at this speed does to what is in it.
 *
 * A body on the wall leaves it where gravity can no longer supply the
 * centripetal force: `cos α = ω²r/g`, with `α` the angle of the radius vector
 * from the upward vertical. Below a Froude number of one there is a solution
 * and the load falls; at or above it there is none and the load is pinned to
 * the wall. Wash and spin are this one solver either side of one.
 */
export function tumblePose(rpm: number, options: TumbleOptions = {}): TumblePose {
  const radius = rideRadius(options)
  const gravity = span(options.gravity ?? GRAVITY, GRAVITY) || GRAVITY
  const omega = (Math.abs(finite(rpm, 0)) * Math.PI * 2) / 60
  const froude = (omega * omega * radius) / gravity
  if (froude >= 1) {
    return { omega, froude, release: null, regime: "centrifuging" }
  }
  const release = (Math.acos(clamp(froude, 0, 1)) * 180) / Math.PI
  const regime: TumbleRegime =
    froude < 0.02 ? "resting" : froude < 0.4 ? "cascading" : "cataracting"
  return { omega, froude, release, regime }
}

export interface TumbleItem {
  index: number
  /** Position in the drum's own frame: centre at the origin, `y` up. */
  position: Vec2
  /** Where it is round the drum, degrees clockwise from the top. */
  angle: number
  /** True while it is off the wall and falling. */
  airborne: boolean
}

export interface TumbleCycle {
  /** Angle it is picked up at, degrees clockwise from the top. */
  pickup: number
  /** Angle it leaves the wall at. */
  release: number
  /** Seconds riding the wall from pickup to release. */
  rideTime: number
  /** Seconds in the air. Zero when the drum is centrifuging. */
  flightTime: number
  /** One whole trip round: ride, fall, land. */
  period: number
}

/** Position on the wall at `angle` degrees clockwise from the top. */
const onWall = (angle: number, radius: number): Vec2 => {
  const radians = toRadians(angle)
  return { x: Math.sin(radians) * radius, y: Math.cos(radians) * radius }
}

/**
 * One item's trip: up the wall to the release angle, through the air, and back
 * onto the wall. The landing is the root of the quadratic that puts the
 * projectile back on the drum circle, so nothing leaves the drum and nothing
 * hangs in the air.
 */
export function tumbleCycle(
  rpm: number,
  options: TumbleOptions = {},
): TumbleCycle | null {
  const pose = tumblePose(rpm, options)
  if (pose.release === null || pose.omega <= 1e-6) return null
  const radius = rideRadius(options)
  const gravity = span(options.gravity ?? GRAVITY, GRAVITY) || GRAVITY

  // Clockwise from the top: the load rises on the far side of the bottom, so
  // release happens `release` degrees before the top, at 360 - release.
  const releaseAngle = 360 - pose.release
  const start = onWall(releaseAngle, radius)
  // Velocity of a point riding a drum turning clockwise at ω.
  const velocity = {
    x: pose.omega * start.y,
    y: -pose.omega * start.x,
  }

  const height = (t: number) => ({
    x: start.x + velocity.x * t,
    y: start.y + velocity.y * t - 0.5 * gravity * t * t,
  })
  // Off the wall the item curves inside the drum, and the flight ends the
  // moment its path meets the circle again. At release the path is tangent to
  // the circle *and* has the circle's own curvature — that is what release
  // means — so it only separates to third order: wait until it is properly
  // inside before looking for the way back out.
  const radial = (t: number) => Math.hypot(height(t).x, height(t).y) - radius
  const slack = radius * 1e-5
  const step = 0.002

  let entered = 0
  for (let i = 1; i <= 4000; i += 1) {
    const t = i * step
    if (radial(t) < -slack) {
      entered = t
      break
    }
  }
  if (entered === 0) return null

  let low = entered
  let high = 0
  for (let i = 1; i <= 4000; i += 1) {
    const t = entered + i * step
    if (radial(t) >= 0) {
      low = t - step
      high = t
      break
    }
  }
  if (high === 0) return null
  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2
    if (radial(mid) < 0) low = mid
    else high = mid
  }
  const flightTime = (low + high) / 2
  const landing = height(flightTime)
  const pickup = (Math.atan2(landing.x, landing.y) * 180) / Math.PI
  const wrapped = ((pickup % 360) + 360) % 360

  // The wall carries it from where it landed round to the release angle.
  const sweep = ((releaseAngle - wrapped) % 360 + 360) % 360
  const rideTime = toRadians(sweep) / pose.omega
  return {
    pickup: wrapped,
    release: releaseAngle,
    rideTime,
    flightTime,
    period: rideTime + flightTime,
  }
}

/**
 * Where the load is at `clock` seconds. Items are spread evenly round the one
 * cycle, so a drum that is centrifuging shows a ring pinned to the wall and a
 * drum that is cascading shows a bed with one or two items in the air.
 */
export function tumbleItems(
  clock: number,
  rpm: number,
  count: number,
  options: TumbleOptions = {},
): TumbleItem[] {
  const items = Math.max(0, Math.round(span(count, 0)))
  if (items === 0) return []
  const radius = rideRadius(options)
  const time = finite(clock, 0)
  const pose = tumblePose(rpm, options)
  const cycle = tumbleCycle(rpm, options)
  const gravity = span(options.gravity ?? GRAVITY, GRAVITY) || GRAVITY

  return Array.from({ length: items }, (_, index) => {
    const offset = index / items
    if (!cycle || cycle.period <= 0) {
      // Pinned to the wall: either the drum is centrifuging or it is not
      // turning at all, and both put the load exactly where the drum is.
      const spin = (pose.omega * time * 180) / Math.PI
      const angle = ((offset * 360 + spin) % 360 + 360) % 360
      return {
        index,
        position: onWall(angle, radius),
        angle,
        airborne: false,
      }
    }
    const t = (((time / cycle.period + offset) % 1) + 1) % 1 * cycle.period
    if (t <= cycle.rideTime) {
      const swept = (pose.omega * t * 180) / Math.PI
      const angle = ((cycle.pickup + swept) % 360 + 360) % 360
      return { index, position: onWall(angle, radius), angle, airborne: false }
    }
    const flight = t - cycle.rideTime
    const start = onWall(cycle.release, radius)
    const position = {
      x: start.x + pose.omega * start.y * flight,
      y: start.y - pose.omega * start.x * flight - 0.5 * gravity * flight * flight,
    }
    return {
      index,
      position,
      angle: (Math.atan2(position.x, position.y) * 180) / Math.PI,
      airborne: true,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* suspension                                                                  */
/* -------------------------------------------------------------------------- */

export interface SuspensionOptions {
  /** Speed the suspension resonates at, in the same units as the input. */
  critical?: number
  /** How far off centre the load sits. The tub cannot settle better than this. */
  imbalance?: number
  /** Damping ratio. Below about 0.1 the resonance is violent. */
  damping?: number
}

export interface SuspensionPose {
  /** Speed over the critical speed. One is resonance. */
  ratio: number
  /** How far the tub is standing off centre. */
  amplitude: number
  /** How far the displacement lags the heavy spot, in degrees. */
  phase: number
  /** True while the machine is near enough its critical speed to walk. */
  resonant: boolean
}

/**
 * A tub hung on springs with an out-of-balance load in it: the textbook
 * response of a rotor on a flexible mount.
 *
 * `amplitude = e·r² / √((1−r²)² + (2ζr)²)`. It is small below the critical
 * speed, large at it, and settles back to the imbalance itself above it, which
 * is why a washing machine walks on the way up to a spin and stands still once
 * it is there. The only mechanism in the set that is worse at one input than at
 * a larger one.
 */
export function suspensionPose(
  speed: number,
  options: SuspensionOptions = {},
): SuspensionPose {
  const critical = Math.max(1e-6, span(options.critical ?? 300, 300))
  const imbalance = span(options.imbalance ?? 1, 1)
  const damping = clamp(span(options.damping ?? 0.08, 0.08), 0.001, 1)
  const ratio = Math.abs(finite(speed, 0)) / critical
  const squared = ratio * ratio
  const denominator = Math.hypot(1 - squared, 2 * damping * ratio)
  const amplitude = denominator === 0 ? imbalance : (imbalance * squared) / denominator
  const phase = (Math.atan2(2 * damping * ratio, 1 - squared) * 180) / Math.PI
  return {
    ratio,
    amplitude,
    phase,
    resonant: Math.abs(ratio - 1) < 0.25,
  }
}

/* -------------------------------------------------------------------------- */
/* hoists                                                                      */
/* -------------------------------------------------------------------------- */

export interface HoistOptions {
  /** Travel of the car between its bottom and top stops. */
  travel: number
  /** Height of the sheave the rope passes over. */
  sheave: number
  /** How far apart the car and the counterweight hang. */
  spacing?: number
  /** Height of the car itself, so the rope lands on its roof. */
  carHeight?: number
  /** Height of the counterweight. */
  weightHeight?: number
  /** Where the bottom stop is. */
  base?: number
}

export interface HoistPose {
  /** Bottom-centre of the car. */
  car: Vec2
  /** Bottom-centre of the counterweight. */
  counterweight: Vec2
  /** The rope: car roof, up over the sheave, down to the counterweight. */
  rope: Vec2[]
  /** Total rope length. Equal at every position — that is the invariant. */
  length: number
}

/**
 * A lift car roped to a counterweight over one sheave. The rope cannot stretch,
 * so the counterweight falls exactly as far as the car rises; `length` is
 * reported so a caller — or a test — can check that it does.
 */
export function hoistPose(position: number, options: HoistOptions): HoistPose {
  const travel = span(options.travel, 100)
  const sheave = finite(options.sheave, travel + 20)
  const spacing = span(options.spacing ?? 24, 24)
  const carHeight = span(options.carHeight ?? 18, 18)
  const weightHeight = span(options.weightHeight ?? 10, 10)
  const base = finite(options.base ?? 0, 0)

  const at = clamp(finite(position, 0), 0, 1)
  const carFoot = base + at * travel
  const carRoof = carFoot + carHeight
  // The counterweight hangs from the other side of the sheave on the same rope,
  // so its roof mirrors the car's about the mid-travel height.
  const weightRoof = base + travel + carHeight - (carRoof - base)
  return {
    car: { x: -spacing / 2, y: carFoot },
    counterweight: { x: spacing / 2, y: weightRoof - weightHeight },
    rope: [
      { x: -spacing / 2, y: carRoof },
      { x: -spacing / 2, y: sheave },
      { x: spacing / 2, y: sheave },
      { x: spacing / 2, y: weightRoof },
    ],
    length: sheave - carRoof + (sheave - weightRoof),
  }
}

/* -------------------------------------------------------------------------- */
/* sun, slats and trackers                                                     */
/* -------------------------------------------------------------------------- */

export interface SlatOptions {
  /** How far the blades can turn each way. Degrees. */
  minTilt?: number
  maxTilt?: number
  /** Blade width and the spacing between blades: together, how much they cover. */
  width?: number
  pitch?: number
  /** The sun's altitude at noon, in degrees. */
  peak?: number
}

export interface SlatPose {
  /** Sun altitude, degrees. Negative is night. */
  altitude: number
  /** Sun azimuth, degrees: negative before noon, positive after. */
  azimuth: number
  /** Where the blades have turned to. */
  tilt: number
  /** True when the blades wanted to turn further than their stops allow. */
  clamped: boolean
  /** How much of the opening the blades now cover, 0 to 1. */
  shade: number
  night: boolean
}

/**
 * Blades that turn to face the sun, and the shade that follows from how far
 * they turned. `sun` is one whole day from midnight to midnight, so the
 * altitude is a cosine about noon and the azimuth swings through south.
 *
 * A tracker that has run out of travel says so rather than quietly pointing at
 * a sun it cannot reach — the same honesty `motion-platform` gives a leg that
 * has run out of stroke.
 */
export function slatPose(sun: number, options: SlatOptions = {}): SlatPose {
  const peak = clamp(span(options.peak ?? 62, 62), 1, 90)
  const minTilt = finite(options.minTilt ?? -70, -70)
  const maxTilt = finite(options.maxTilt ?? 70, 70)
  const width = span(options.width ?? 1, 1)
  const pitch = Math.max(1e-6, span(options.pitch ?? 1, 1))

  const day = ((finite(sun, 0) % 1) + 1) % 1
  const altitude = -peak * Math.cos(2 * Math.PI * day)
  const azimuth = (day - 0.5) * 360
  const wanted = clamp(azimuth, -90, 90)
  const tilt = clamp(wanted, Math.min(minTilt, maxTilt), Math.max(minTilt, maxTilt))
  const shade = clamp((width * Math.cos(toRadians(tilt))) / pitch, 0, 1)
  return {
    altitude,
    azimuth,
    tilt,
    clamped: Math.abs(tilt - wanted) > 1e-9,
    shade,
    night: altitude <= 0,
  }
}

/* -------------------------------------------------------------------------- */
/* extraction                                                                  */
/* -------------------------------------------------------------------------- */

export interface FlowOptions {
  /** How hard the bed is to push through. Bigger is a finer grind. */
  resistance?: number
  /** Pressure below which nothing comes through at all. */
  threshold?: number
}

/**
 * Darcy's law through a packed bed: flow is proportional to the pressure over
 * the bed's resistance, and nothing at all comes through below the threshold —
 * rather than a negative trickle, which is what a bare division gives.
 */
export function extractionFlow(pressure: number, options: FlowOptions = {}): number {
  const resistance = Math.max(1e-6, span(options.resistance ?? 1, 1))
  const threshold = span(options.threshold ?? 0, 0)
  return Math.max(0, finite(pressure, 0) - threshold) / resistance
}

export interface SpringOptions {
  /** Force per unit of compression. */
  rate?: number
  /** Force already in the spring when the piston is at the top of its travel. */
  preload?: number
  /** Piston area. Pressure is force over this. */
  area?: number
}

/**
 * The pressure a compressed spring puts behind a piston. A lever machine's
 * declining shot is this and nothing else: the spring pays its force back as it
 * extends, so the pressure falls through the pull instead of being a curve
 * somebody drew.
 */
export function springPressure(
  compression: number,
  options: SpringOptions = {},
): number {
  const rate = span(options.rate ?? 1, 1)
  const preload = span(options.preload ?? 0, 0)
  const area = Math.max(1e-6, span(options.area ?? 1, 1))
  return Math.max(0, (preload + rate * Math.max(0, finite(compression, 0))) / area)
}
