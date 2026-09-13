/**
 * Bounce dynamics: the two regimes a machine that leaves the ground has, and
 * the boundary between them.
 *
 * Flight is a projectile — a parabola, exactly. Stance is a mass on a linear
 * spring, which is simple harmonic motion about its static sag — exactly. What
 * makes this worth solving rather than tweening is that *how long each lasts*
 * is not a control: given a drop height and a spring rate, the flight time, the
 * contact time and therefore the duty factor all fall out of the physics.
 * Stiffen the spring and contact gets shorter and harder without the hop
 * changing.
 *
 * Units: mass 1, gravity 1. Lengths are "hop units" — whatever the drawing
 * decides one is — and a `load` of 1 is the machine's own weight.
 *
 * Not modelled: damping inside the stance (the loss is taken at take-off as a
 * restitution coefficient, the way a bounce is actually measured), horizontal
 * travel, friction, spin-up from contact, material, or any energy source that
 * would keep a real hopper going.
 *
 * Design note: docs/bouncing-machines.md
 */

import type { Vec2 } from "@/lib/robocn/kinematics"

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const wrap = (value: number) =>
  Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0

/** Apex height in hop units. Zero is a machine that only ever bobs on its spring. */
const HEIGHT = { min: 0, max: 1, fallback: 0.5 }
/** Spring rate, in weights per hop unit. Static sag is its reciprocal. */
const STIFFNESS = { min: 4, max: 400, fallback: 40 }
/** Below this apex a rebound cannot lift the machine, and the sequence is over. */
const REST_HEIGHT = 0.004

export interface HopOptions {
  /** Cycle fraction from touchdown. Wraps in both directions. */
  phase?: number
  /** Apex of the hop above the machine's free-standing rest, 0–1 hop units. */
  height?: number
  /** Spring rate in weights per hop unit, 4–400. Static sag is `1 / stiffness`. */
  stiffness?: number
}

export interface DropOptions extends Omit<HopOptions, "phase"> {
  /** Seconds since release, from the apex with no upward throw. */
  time?: number
  /** Fraction of the landing speed returned at take-off, 0–1. */
  restitution?: number
  /** Apex below which a rebound counts as none, ending the sequence. */
  restHeight?: number
}

export interface HopState {
  /**
   * Height of the machine's reference point above where it stands at rest with
   * the compliance free, in hop units. Negative while the compliance is loaded:
   * the body sinks, the foot does not move.
   */
  altitude: number
  /** How far the compliance is compressed, in hop units. Zero in flight. */
  compression: number
  /** The same, as 0–1 of the hardest impact of this sequence — for drawing. */
  squeeze: number
  /** Touching the ground. */
  contact: boolean
  /** Vertical velocity in hop units per second, up positive. */
  velocity: number
  /** Ground reaction force in machine weights: 0 in flight, 1 standing still. */
  load: number
  /** Which contact of a decaying sequence this is. Always 0 for a steady hop. */
  bounce: number
  /** A decaying sequence has run down and the machine is sat on its spring. */
  resting: boolean
}

export interface HopTimings {
  /** Seconds on the ground. */
  contact: number
  /** Seconds in the air. */
  flight: number
  /** One whole bounce. */
  cycle: number
  /** Fraction of the cycle spent touching the ground. */
  duty: number
  /** Deepest compression reached, in hop units. */
  depth: number
  /** Speed at take-off and at touchdown, in hop units per second. */
  takeoff: number
  /** Static sag: how far the compliance gives under the machine standing still. */
  sag: number
  /** Natural frequency of the compliance under the machine, in radians a second. */
  omega: number
}

const resolve = (options: HopOptions) => {
  const stiffness = clamp(
    Math.abs(finite(options.stiffness, STIFFNESS.fallback)),
    STIFFNESS.min,
    STIFFNESS.max,
  )
  return {
    stiffness,
    omega: Math.sqrt(stiffness),
    sag: 1 / stiffness,
    height: clamp(finite(options.height, HEIGHT.fallback), HEIGHT.min, HEIGHT.max),
  }
}

/**
 * How long a contact at this touchdown speed lasts.
 *
 * Contact ends when the spring force returns to zero — the compliance back at
 * its free length — which is *not* half a period, because gravity biases the
 * oscillation. Solving `x0(1 − cos ωt) + (v/ω) sin ωt = 0` for the second root
 * gives this closed form, which tends to a full half period plus the sag's own
 * quarter as the landing speed goes to zero.
 */
const contactTime = (speed: number, omega: number) =>
  (2 / omega) * (Math.PI - Math.atan(speed * omega))

/** Deepest the compliance goes on a contact at this speed. */
const contactDepth = (speed: number, omega: number, sag: number) =>
  sag + Math.hypot(sag, speed / omega)

/** The state during one contact, `elapsed` seconds after touchdown at `speed`. */
function stanceState(
  elapsed: number,
  speed: number,
  omega: number,
  sag: number,
  stiffness: number,
  reference: number,
  bounce: number,
): HopState {
  const angle = omega * elapsed
  // Downward displacement of the body from the compliance's free length.
  const sink = sag * (1 - Math.cos(angle)) + (speed / omega) * Math.sin(angle)
  const compression = Math.max(0, sink)
  return {
    altitude: -compression,
    compression,
    squeeze: reference > 0 ? clamp(compression / reference, 0, 1) : 0,
    contact: true,
    velocity: -(sag * omega * Math.sin(angle) + speed * Math.cos(angle)),
    load: stiffness * compression,
    bounce,
    resting: false,
  }
}

/** The state during one flight, `elapsed` seconds after take-off at `speed`. */
function flightState(elapsed: number, speed: number, bounce: number): HopState {
  return {
    altitude: Math.max(0, speed * elapsed - (elapsed * elapsed) / 2),
    compression: 0,
    squeeze: 0,
    contact: false,
    velocity: speed - elapsed,
    load: 0,
    bounce,
    resting: false,
  }
}

/** Sat on the spring with nothing left: the end of a decaying sequence. */
function restingState(sag: number, stiffness: number, bounce: number): HopState {
  return {
    altitude: -sag,
    compression: sag,
    squeeze: 0,
    contact: true,
    velocity: 0,
    load: stiffness * sag,
    bounce,
    resting: true,
  }
}

/** Timings of one steady bounce. Every number here is a consequence, not a control. */
export function hopTimings(options: HopOptions = {}): HopTimings {
  const { omega, sag, height, stiffness } = resolve(options)
  const takeoff = Math.sqrt(2 * height)
  const contact = contactTime(takeoff, omega)
  const flight = 2 * takeoff
  const cycle = contact + flight
  return {
    contact,
    flight,
    cycle,
    duty: cycle > 0 ? contact / cycle : 1,
    depth: contactDepth(takeoff, omega, sag),
    takeoff,
    sag,
    omega: Math.sqrt(stiffness),
  }
}

/**
 * The steady bounce: touchdown at phase 0, stance, take-off, flight, round
 * again. This is the ideal lossless case — a real machine would have to put
 * back what the contact took, and nothing here draws that.
 */
export function solveHop(options: HopOptions = {}): HopState {
  const { omega, sag, height, stiffness } = resolve(options)
  const takeoff = Math.sqrt(2 * height)
  const contact = contactTime(takeoff, omega)
  const flight = 2 * takeoff
  const cycle = contact + flight
  const depth = contactDepth(takeoff, omega, sag)
  const time = wrap(options.phase ?? 0) * cycle
  return time <= contact
    ? stanceState(time, takeoff, omega, sag, stiffness, depth, 0)
    : flightState(time - contact, takeoff, 0)
}

export interface DropTimings {
  /** Contacts the machine makes before it has nothing left to rebound with. */
  bounces: number
  /** Seconds from release until it is sat on its spring for good. */
  settleTime: number
  /** When the apex of flight `index` happens. Flight 0 is the release itself. */
  apexAt(index: number): number
}

/** Hard stop on the walk, so a pathological restitution cannot spin. */
const MAX_BOUNCES = 200

/** Walks the sequence, calling back once per contact, until it runs down. */
function sequence(
  options: DropOptions,
  visit: (bounce: {
    index: number
    /** When this contact starts, and its touchdown speed. */
    start: number
    speed: number
    duration: number
    /** Take-off speed and flight length. Zero once it cannot rebound. */
    rebound: number
    flight: number
  }) => boolean | void,
) {
  const { omega, sag, height } = resolve(options)
  const restitution = clamp(finite(options.restitution, 1), 0, 1)
  const restHeight = Math.max(0, finite(options.restHeight, REST_HEIGHT))
  const minimum = Math.sqrt(2 * restHeight)

  let speed = Math.sqrt(2 * height)
  // Released at the apex with no throw, so the first flight is the fall alone.
  let clock = speed
  for (let index = 0; index < MAX_BOUNCES; index += 1) {
    const duration = contactTime(speed, omega)
    const rebound = restitution * speed < minimum ? 0 : restitution * speed
    const stop = visit({ index, start: clock, speed, duration, rebound, flight: 2 * rebound })
    if (stop || rebound === 0) return { bounces: index + 1, settleTime: clock }
    clock += duration + 2 * rebound
    speed = rebound
  }
  return { bounces: MAX_BOUNCES, settleTime: clock }
}

/** How many bounces a drop gets, how long it takes to die, and where the apexes fall. */
export function dropTimings(options: DropOptions = {}): DropTimings {
  const apexes: number[] = [0]
  const run = sequence(options, ({ start, duration, rebound }) => {
    if (rebound > 0) apexes.push(start + duration + rebound)
  })
  return {
    ...run,
    apexAt: (index: number) => apexes[clamp(Math.round(index), 0, apexes.length - 1)] ?? 0,
  }
}

/**
 * A machine released from `height` at `time` 0 and left alone: it falls,
 * bounces lower every time by the square of the restitution, and finally sits
 * down on its own spring. Past the settle time it stays there.
 *
 * Contact time does not go to zero as the speed does — it tends to `2π/ω` — so
 * an ideal Zeno bounce would never finish. The sequence ends instead when the
 * rebound can no longer lift the machine past `restHeight`, which is the honest
 * version of coming to rest.
 */
export function solveDrop(options: DropOptions = {}): HopState {
  const { omega, sag, height, stiffness } = resolve(options)
  const time = Math.max(0, finite(options.time, 0))
  const first = Math.sqrt(2 * height)
  const reference = contactDepth(first, omega, sag)

  // The fall from the release apex, before anything has been touched.
  if (time < first) {
    return {
      ...flightState(time, 0, 0),
      altitude: Math.max(0, height - (time * time) / 2),
      velocity: -time,
    }
  }

  let state: HopState | null = null
  const run = sequence(options, ({ index, start, speed, duration, rebound, flight }) => {
    if (time < start + duration) {
      state = stanceState(time - start, speed, omega, sag, stiffness, reference, index)
      return true
    }
    if (rebound > 0 && time < start + duration + flight) {
      state = flightState(time - start - duration, rebound, index + 1)
      return true
    }
    return false
  })
  return state ?? restingState(sag, stiffness, run.bounces)
}

export interface SpringOptions {
  /** Free length along the axis, in drawing units. Clamped at the solid height. */
  length?: number
  /** Active coils. Never changes with compression — a spring twists its wire. */
  turns?: number
  /** Coil radius. Never changes either. */
  radius?: number
  /** Wire diameter, which is what sets the solid height. */
  wire?: number
}

export interface SpringCoils {
  /** The helix seen side-on, which is a sinusoid: x across the axis, y along it. */
  points: Vec2[]
  /** Length actually drawn, after the solid-height clamp. */
  length: number
  /** Distance between coils. */
  pitch: number
  /** Shortest the spring can be: every coil touching its neighbour. */
  solid: number
  /** The requested length was past that, and has been clamped. */
  bottomedOut: boolean
}

/** Samples per coil. A multiple of four, so the extremes are sampled exactly. */
const COIL_STEPS = 16

/**
 * A helical spring seen side-on. The projection of a helix is a sinusoid, so it
 * is sampled rather than drawn as a zig-zag, and the coil count and radius are
 * invariant: a real spring compresses by twisting its wire, not by losing or
 * fattening coils. It cannot go past its own solid height.
 */
export function springCoils(options: SpringOptions = {}): SpringCoils {
  const turns = clamp(Math.abs(finite(options.turns, 6)), 1, 40)
  const radius = Math.max(0.1, Math.abs(finite(options.radius, 6)))
  const wire = Math.max(0.05, Math.abs(finite(options.wire, 1)))
  const solid = turns * wire
  const requested = Math.max(0, finite(options.length, solid))
  const length = Math.max(solid, requested)
  const steps = Math.max(8, Math.round(turns * COIL_STEPS))
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const s = index / steps
    return { x: radius * Math.sin(2 * Math.PI * turns * s), y: length * s }
  })
  return { points, length, pitch: length / turns, solid, bottomedOut: requested < solid }
}

/**
 * A shell flattened against the ground, at constant volume: an oblate spheroid
 * with `rx² ry = r³`. A ball squashed on impact has to get wider, and by
 * exactly this much.
 */
export function squashRadii(radius: number, squeeze: number): { rx: number; ry: number } {
  const r = Math.max(0.01, Math.abs(finite(radius, 1)))
  // Past this it stops being a ball and starts being a puddle.
  const depth = clamp(finite(squeeze, 0), 0, 0.85)
  if (depth === 0) return { rx: r, ry: r }
  const ry = r * (1 - depth)
  return { rx: r * Math.sqrt(r / ry), ry }
}
