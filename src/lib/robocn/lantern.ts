/**
 * lantern-geometry — a reservoir that can be spent, and an assembly that comes
 * apart in the order it was built.
 *
 * Five things the set had no maths for:
 *
 * - **An ordered exploded assembly.** Moved out to `assembly-geometry`, since
 *   nothing about it is lantern-shaped, and re-exported from here so anything
 *   already installed keeps compiling. The lantern is still the machine that
 *   shows it off.
 * - **Charge that is conserved.** Transfer moves charge out of a reservoir and
 *   into a cell against the cell's own capacity: what leaves one arrives in the
 *   other, and the only charge that disappears is what the emitter drew. The
 *   dynamics are piecewise linear with two clamps, so {@link stepCharge} solves
 *   them in closed form and one big step equals a thousand small ones.
 * - **A recital.** A count of glyph cells lit one at a time, and the line the
 *   count has reached. The glyph marks come from a hash of the cell index, so
 *   they are abstract, deterministic and unreadable — there is no text here.
 * - **A reserve read two ways.** A segmented gauge whose fills sum back to the
 *   level they were made from, and a four-state reading off the same number.
 * - **An emission column that costs something.** Intensity is what the reserve
 *   can pay for; reach follows the inverse-square law, so for a fixed threshold
 *   twice the power is √2 the distance rather than twice it.
 *
 * World axes are the set's own — `x` starboard, `y` up, `z` aft — and offsets
 * come back in them, which matters: projection is linear, so a world offset
 * projects to a pure screen offset and one schedule serves all four cameras.
 *
 * There is no collision model, no fastener model, no thermal model and no
 * discharge curve. Parts pass through each other's paths the way they do in
 * every exploded drawing, and `progress` runs backwards as happily as forwards.
 * Design note: docs/power-lantern.md.
 */

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

const TAU = Math.PI * 2

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

/* -------------------------------------------------------------------------- */
/* the exploded assembly                                                       */
/* -------------------------------------------------------------------------- */

// The teardown schedule is not lantern-shaped — parts, axes, an order — so it
// lives in `assembly-geometry` and every machine that comes apart shares it.
// Re-exported here so anything already installed keeps compiling.
export {
  assemblyEnvelope,
  explodeAssembly,
  explodeFraction,
  type AssemblyPart,
  type ExplodedPart,
  type ExplodeOptions,
} from "@/lib/robocn/assembly"

/* -------------------------------------------------------------------------- */
/* the charge                                                                  */
/* -------------------------------------------------------------------------- */

/** What the reservoir holds, and what the docked cell holds. */
export interface ChargeState {
  /** The lantern's own reserve, 0 to 1. */
  reservoir: number
  /** What is in the docked cell, 0 to `cellCapacity`. */
  cell: number
}

export interface ChargeOptions {
  /** Reservoir units per unit time through the conduit while docked. */
  rate?: number
  /** What the cell can hold, in reservoir units. */
  cellCapacity?: number
  /** Whether a cell is seated in the dock. Nothing transfers when it is not. */
  docked?: boolean
  /** Units per unit time the emitter takes out of the reservoir. */
  draw?: number
}

export interface ChargeStep {
  state: ChargeState
  /** How much moved from the reservoir into the cell. */
  transferred: number
  /** How much the emitter took out of the reservoir. */
  drawn: number
}

const DEFAULT_CAPACITY = 0.12

/**
 * The reservoir, the cell and the emitter over `dt`.
 *
 * Exact rather than integrated: with constant conditions the system is
 * piecewise linear in time with two clamps — the reservoir emptying and the
 * cell filling — so the step is solved in closed form and one 10-second step
 * gives the same state as a thousand 10-millisecond ones. Nothing is created:
 * `reservoir + cell` afterwards is what it was before, less exactly `drawn`.
 */
export function stepCharge(
  state: ChargeState,
  dt: number,
  { rate = 0.25, cellCapacity = DEFAULT_CAPACITY, docked = false, draw = 0 }: ChargeOptions = {},
): ChargeStep {
  const capacity = Math.max(0, finite(cellCapacity, DEFAULT_CAPACITY))
  let reservoir = clamp(finite(state?.reservoir, 0), 0, 1)
  let cell = clamp(finite(state?.cell, 0), 0, capacity)
  const span = Math.max(0, finite(dt, 0))
  const transferRate = docked ? Math.max(0, finite(rate, 0)) : 0
  const drawRate = Math.max(0, finite(draw, 0))
  if (span === 0 || (transferRate === 0 && drawRate === 0)) {
    return { state: { reservoir, cell }, transferred: 0, drawn: 0 }
  }

  let transferred = 0
  let drawn = 0

  // Phase one: both run, until the reservoir empties or the cell fills.
  const outflow = transferRate + drawRate
  const untilEmpty = outflow > 0 ? reservoir / outflow : Number.POSITIVE_INFINITY
  const untilFull =
    transferRate > 0 ? (capacity - cell) / transferRate : Number.POSITIVE_INFINITY
  const first = Math.min(span, untilEmpty, untilFull)
  reservoir -= outflow * first
  cell += transferRate * first
  transferred += transferRate * first
  drawn += drawRate * first

  // Phase two: the cell is full but the reservoir is not empty, so the emitter
  // goes on drawing on its own.
  const rest = span - first
  if (rest > 0 && reservoir > 0 && drawRate > 0) {
    const second = Math.min(rest, reservoir / drawRate)
    reservoir -= drawRate * second
    drawn += drawRate * second
  }

  return {
    state: {
      reservoir: clamp(reservoir, 0, 1),
      cell: clamp(cell, 0, capacity),
    },
    transferred,
    drawn,
  }
}

export type ReserveState = "depleted" | "low" | "nominal" | "full"

/** The four-state reading of a reserve, which is what the lamp shows. */
export function reserveState(reservoir: number): ReserveState {
  const level = clamp(finite(reservoir, 0), 0, 1)
  if (level <= 0.02) return "depleted"
  if (level < 0.25) return "low"
  if (level < 0.98) return "nominal"
  return "full"
}

/**
 * A level as a segmented gauge: each segment full, empty, or part filled at the
 * boundary. The fills average back to the level they came from, so the gauge is
 * a reading of the reserve rather than a picture of one.
 */
export function chargeSegments(level: number, count = 8): number[] {
  const segments = Math.max(1, Math.round(finite(count, 8)))
  const value = clamp(finite(level, 0), 0, 1)
  return Array.from({ length: segments }, (_, index) =>
    clamp(value * segments - index, 0, 1),
  )
}

/* -------------------------------------------------------------------------- */
/* the recital                                                                 */
/* -------------------------------------------------------------------------- */

export interface RecitalOptions {
  /** Lines of inscription on the collar. */
  lines?: number
  /** Glyph cells per line. */
  glyphs?: number
}

export interface Recital {
  /** Which line the recital has reached, 0-based. */
  line: number
  /** Which glyph of that line, 0-based. */
  glyph: number
  /** How many cells are lit in total. */
  lit: number
  /** How many there are. */
  total: number
  complete: boolean
}

/** Where the recital has got to at `progress`, 0 to 1. */
export function recital(
  progress: number,
  { lines = 4, glyphs = 6 }: RecitalOptions = {},
): Recital {
  const perLine = Math.max(1, Math.round(finite(glyphs, 6)))
  const count = Math.max(1, Math.round(finite(lines, 4)))
  const total = perLine * count
  const t = clamp(finite(progress, 0), 0, 1)
  const lit = t >= 1 ? total : Math.min(total, Math.floor(t * total))
  const reached = Math.max(0, lit - 1)
  return {
    line: Math.min(count - 1, Math.floor(reached / perLine)),
    glyph: reached % perLine,
    lit,
    total,
    complete: lit >= total,
  }
}

/**
 * The marks in one glyph cell: three bar heights from a hash of the index. No
 * text, no language, nothing to read — deterministic so a cell looks the same
 * every render, and varied so the band does not read as a barcode.
 */
export function glyphBars(index: number): [number, number, number] {
  const seed = Math.abs(Math.round(finite(index, 0))) + 1
  const bar = (salt: number) => {
    const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
    return 0.35 + (value - Math.floor(value)) * 0.65
  }
  return [bar(1), bar(2), bar(3)]
}

/* -------------------------------------------------------------------------- */
/* the cage                                                                    */
/* -------------------------------------------------------------------------- */

export interface CageRib {
  index: number
  /** Degrees about the vertical axis, measured from the front of the machine. */
  angle: number
  /** Where the rib stands, in the plan-view footprint: x starboard, y aft. */
  x: number
  z: number
}

/**
 * The ribs of the cage, placed so a *bay* faces the front rather than a rib:
 * the machine is read front-on, and a rib down the middle of the reservoir
 * would hide the one thing worth seeing. Angles are measured from the front,
 * which is `-z` in world axes.
 */
export function cageRibs(count: number, radius = 22): CageRib[] {
  const ribs = clamp(Math.round(finite(count, 6)), 3, 16)
  const r = Math.max(0, finite(radius, 22))
  return Array.from({ length: ribs }, (_, index) => {
    const angle = ((index + 0.5) * 360) / ribs
    const theta = (angle / 180) * Math.PI
    return {
      index,
      angle,
      // Front is -z, so the first bay straddles it.
      x: Math.sin(theta) * r,
      z: -Math.cos(theta) * r,
    }
  })
}

/**
 * An arc of a band as a plan-view footprint, ready to extrude: the cell of an
 * inscription collar, a rib's own section, a vent slot cut in a skirt.
 */
export function bandCell(
  angle: number,
  radius: number,
  halfArc: number,
  thickness: number,
  steps = 4,
): Vec2[] {
  const centre = (finite(angle, 0) / 180) * Math.PI
  const half = Math.abs(finite(halfArc, 6)) * (Math.PI / 180)
  const outer = Math.max(0, finite(radius, 1))
  const inner = Math.max(0, outer - Math.abs(finite(thickness, 1)))
  const count = Math.max(2, Math.round(finite(steps, 4)))
  const at = (t: number, r: number): Vec2 => {
    const theta = centre - half + t * half * 2
    return { x: Math.sin(theta) * r, y: -Math.cos(theta) * r }
  }
  const front = Array.from({ length: count }, (_, i) => at(i / (count - 1), outer))
  const back = Array.from({ length: count }, (_, i) => at(1 - i / (count - 1), inner))
  return [...front, ...back]
}

/* -------------------------------------------------------------------------- */
/* the emission                                                                */
/* -------------------------------------------------------------------------- */

export interface BeamOptions {
  /** Half-angle of the column at full power, in degrees. */
  spread?: number
  /** How far it reaches at full intensity. */
  length?: number
}

export interface Beam {
  /** What the emitter is actually running at, 0 to 1. */
  intensity: number
  /** How far the column reaches. */
  length: number
  /** Its half-width at the far end. */
  halfWidth: number
}

/**
 * The emission column. Intensity is the power asked for, limited by the reserve
 * there is to pay for it — an empty lantern emits nothing whatever it is told.
 *
 * Reach is inverse-square: a fixed threshold illuminance is met at
 * `√intensity` of the full-power distance, so twice the power buys √2 the
 * distance and not twice it.
 */
export function emissionBeam(
  charge: number,
  power: number,
  { spread = 7, length = 120 }: BeamOptions = {},
): Beam {
  const reserve = clamp(finite(charge, 0), 0, 1)
  const asked = clamp(finite(power, 0), 0, 1)
  // The reserve is a ceiling on what can be run, not a multiplier on it: a
  // half-full lantern still emits at full power, an empty one not at all.
  const intensity = Math.min(asked, reserve)
  const reach = Math.max(0, finite(length, 120)) * Math.sqrt(intensity)
  const half = Math.abs(finite(spread, 7)) * (Math.PI / 180)
  return {
    intensity,
    length: reach,
    halfWidth: Math.tan(half) * reach,
  }
}

/**
 * A point on the conduit between the core and the dock, as a fraction of the
 * way up. `beads` travel with the clock so the flow has a direction, and they
 * stand still when nothing is moving.
 */
export function conduitBeads(flow: number, clock: number, beads = 4): number[] {
  const moving = clamp(finite(flow, 0), 0, 1)
  const t = finite(clock, 0)
  const count = Math.max(1, Math.round(finite(beads, 4)))
  return Array.from({ length: count }, (_, index) => {
    const base = index / count
    const travel = moving === 0 ? 0 : (t * 0.9) % 1
    return (((base + travel) % 1) + 1) % 1
  })
}

/** A cycle-normalised clock: `clock` folded into 0..1. */
export const cyclePhase = (clock: number) => {
  const t = finite(clock, 0)
  return ((t % 1) + 1) % 1
}

/** A smooth 0..1..0 over a cycle, for a glow that breathes rather than blinks. */
export const breathe = (clock: number) =>
  (1 - Math.cos(cyclePhase(clock) * TAU)) / 2
