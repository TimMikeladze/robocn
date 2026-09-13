/**
 * robocn — keyboard geometry.
 *
 * The mechanisms under a machine a person types on. Four things a drawing gets
 * wrong if it guesses:
 *
 * - **travel is not linear and actuation is not at the bottom.** A key closes
 *   its contact partway down and has overtravel left, and it opens again
 *   *higher* than it closed. `keyTravel` reports the contact and the travel
 *   separately, with real hysteresis.
 * - **a keystroke is not a sine.** It falls fast, bottoms out for a moment and
 *   comes back slower on the spring. `pressCurve` is that shape, once, so every
 *   key in the family presses the same way.
 * - **a row of caps has to fill the deck.** Rows are specified in units and laid
 *   out on a fixed pitch; a row that does not add up is reported short rather
 *   than stretched.
 * - **a raked deck is a plane at an attitude, and a cap presses along its
 *   normal** — not down the world's y axis. `deckFrame` is that frame and
 *   `capSolid` is one cap as a box standing on it, so travel is truthful from
 *   all four cameras.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * dynamics: no force curve, no tactile bump force, no click leaf, no rollover,
 * no debounce and no encoding. The scan *order* is real; the scan rate is
 * whatever the caller's clock says.
 */

import { clamp, toRadians, type Vec3 } from "@/lib/robocn/kinematics"
import { panelTransform, type PanelProjection } from "@/lib/robocn/device"
import { slabPath, type RobotCamera } from "@/lib/robocn/style"

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, never negative, never zero. */
const span = (value: number, fallback: number) =>
  Math.max(1e-6, Math.abs(finite(value, fallback)))

const wrap01 = (value: number) => {
  const safe = finite(value, 0)
  return ((safe % 1) + 1) % 1
}

const count = (value: number, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(finite(value, fallback))))

/* -------------------------------------------------------------------------- */
/* travel                                                                      */
/* -------------------------------------------------------------------------- */

export interface KeyTravelOptions {
  /** Full travel of the stem, world units. */
  travel?: number
  /** How far down the contact closes. */
  actuation?: number
  /** How far down it opens again on the way back up. Defaults below actuation. */
  reset?: number
  /** Whether the contact was already closed, which is what makes hysteresis. */
  closed?: boolean
}

export interface KeyTravelPose {
  /** Press asked for, clamped to 0..1. */
  fraction: number
  /** Travel used, in world units. */
  depth: number
  /** True while the contact is closed. */
  actuated: boolean
  /** True at the end of the travel. */
  bottomedOut: boolean
  /** How far past the actuation point, 0..1 of the overtravel that is left. */
  overtravel: number
}

/**
 * One key's travel. `press` is 0 at rest to 1 bottomed out; everything else is
 * in world units so it can be drawn directly.
 *
 * The contact closes at `actuation` on the way down and opens at `reset` on the
 * way up, so between the two it holds whatever state it was already in — which
 * is the whole reason `closed` is an input. A switch with no hysteresis chatters
 * at the actuation point, and a drawing of one lies about what a key does.
 */
export function keyTravel(press: number, options: KeyTravelOptions = {}): KeyTravelPose {
  const total = span(options.travel ?? 4, 4)
  const fraction = clamp(finite(press, 0), 0, 1)
  const depth = fraction * total
  const close = Math.max(0, finite(options.actuation ?? total * 0.5, total * 0.5))
  const open = Math.max(0, finite(options.reset ?? close - total * 0.1, close - total * 0.1))
  const actuated =
    close > total
      ? // A contact placed past the end of the travel can never be reached.
        false
      : options.closed
        ? depth >= Math.min(open, close)
        : depth >= close
  const left = total - close
  return {
    fraction,
    depth,
    actuated,
    bottomedOut: fraction >= 1,
    overtravel: left > 0 ? clamp((depth - close) / left, 0, 1) : 0,
  }
}

/** Where the fall ends and the bottom-out dwell begins, as a share of a stroke. */
const FALL = 0.25
/** Where the spring starts pushing the cap back. */
const RELEASE = 0.35

/**
 * The shape of one keystroke, `0` at rest through `1` bottomed out and back.
 * `t` runs 0..1 across the stroke.
 *
 * Asymmetric on purpose: a finger drives the cap down in the first quarter,
 * holds it at the bottom for a moment, and the spring returns it over the rest —
 * which is why a key looks nothing like a sine wave in slow motion.
 */
export function pressCurve(t: number): number {
  const at = finite(t, 0)
  if (at <= 0 || at >= 1) return 0
  if (at < FALL) {
    const x = at / FALL
    // Fast in, decelerating onto the bottom-out.
    return 1 - (1 - x) * (1 - x)
  }
  if (at < RELEASE) return 1
  const x = (at - RELEASE) / (1 - RELEASE)
  return Math.pow(1 - x, 1.4)
}

/* -------------------------------------------------------------------------- */
/* the deck                                                                    */
/* -------------------------------------------------------------------------- */

export interface KeyPlacement {
  /** Scan index: rows back to front, columns left to right. */
  index: number
  row: number
  column: number
  /** Cap centre in deck coordinates: `x` across, `y` toward the operator. */
  x: number
  y: number
  /** Cap size in world units, one gap smaller than its pitch. */
  width: number
  depth: number
  /** What the row spec asked for, in units. */
  units: number
}

export interface KeyboardDeck {
  keys: KeyPlacement[]
  rows: number
  /** The widest row, in units — what the deck has to be. */
  units: number
  /** Each row's own width in units, so a short row can be drawn short. */
  rowUnits: number[]
  /** Deck size in world units. */
  width: number
  depth: number
  /** Pitch between key centres, world units. */
  unit: number
}

export interface KeyboardLayoutOptions {
  /** Pitch between key centres, world units. A real board is 19.05mm. */
  unit?: number
  /** Gap between neighbouring caps, world units. */
  gap?: number
  /** Units each row is shifted right by — the stagger. */
  stagger?: readonly number[]
}

/**
 * A deck laid out from rows of unit widths — `[1, 1, 1.5]`, `[1.25, 6.25]` — on
 * one fixed pitch, centred on the deck's own origin.
 *
 * Rows run back to front, so `index` is the order a matrix scan reads them in.
 * Widths come out one `gap` short of their pitch, which is what makes a 2u key
 * exactly two pitches wide including the gap it swallows, and `rowUnits` says
 * what each row actually came to so a row that does not fill the deck is drawn
 * as the short row it is rather than stretched to fit.
 */
export function keyboardLayout(
  rows: readonly (readonly number[])[],
  { unit = 10, gap = 1, stagger = [] }: KeyboardLayoutOptions = {},
): KeyboardDeck {
  const pitch = span(unit, 10)
  const seam = Math.min(pitch * 0.5, Math.abs(finite(gap, 1)))
  const spec = rows.map((row) => row.map((width) => span(width, 1)))
  const rowUnits = spec.map((row) => row.reduce((sum, width) => sum + width, 0))
  const units = rowUnits.length ? Math.max(...rowUnits) : 0
  const width = units * pitch
  const depth = spec.length * pitch

  let index = 0
  const keys = spec.flatMap((row, rowIndex) => {
    const shift = finite(stagger[rowIndex] ?? 0, 0)
    let cursor = shift
    return row.map((widthUnits, column) => {
      const centre = cursor + widthUnits / 2
      cursor += widthUnits
      return {
        index: index++,
        row: rowIndex,
        column,
        x: centre * pitch - width / 2,
        y: (rowIndex + 0.5) * pitch - depth / 2,
        width: widthUnits * pitch - seam,
        depth: pitch - seam,
        units: widthUnits,
      }
    })
  })

  return { keys, rows: spec.length, units, rowUnits, width, depth, unit: pitch }
}

export interface KeycapProfile {
  /** How far the cap's top face stands above the deck, world units. */
  rise: number
  /** Degrees the cap's top face is tilted, positive toward the operator. */
  tilt: number
}

/**
 * The sculpt of one row. A sculpted board dishes toward its home row: the rows
 * either side of it ride higher and their faces tilt back toward the operator's
 * fingers, which is what gives a keyboard a real profile in elevation instead
 * of a flat plate. A one-row board asks for no sculpt at all.
 */
export function keycapProfile(row: number, rows: number, base = 5): KeycapProfile {
  const total = count(rows, 1, 1, 24)
  const at = count(row, 0, 0, Math.max(0, total - 1))
  const home = Math.round((total - 1) / 2)
  const offset = at - home
  return {
    rise: span(base, 5) + Math.abs(offset) * 0.9,
    tilt: offset === 0 ? 0 : -offset * 6,
  }
}

/* -------------------------------------------------------------------------- */
/* the matrix                                                                  */
/* -------------------------------------------------------------------------- */

export interface MatrixScanPose {
  /** The energized row. */
  row: number
  /** The column being read across it. */
  column: number
  /** Which cell of the matrix that is, in scan order. */
  cell: number
  cells: number
}

/**
 * Where a matrix scan has got to. A keyboard is not one wire per key: it
 * strobes one row at a time and reads the columns across it, so "which key is
 * down" and "which key is being looked at" are two different things — both
 * worth drawing, and only one of them a key press.
 *
 * `clock` is cycles of the whole matrix, wrapped, so a whole cycle comes back
 * to the first cell and a negative clock scans backwards into the last.
 */
export function matrixScan(clock: number, rows: number, columns: number): MatrixScanPose {
  const rowCount = count(rows, 1, 1, 64)
  const columnCount = count(columns, 1, 1, 64)
  const cells = rowCount * columnCount
  // The epsilon is for exact fractions: 1/12 * 12 is 0.9999999999999999, and a
  // scan that lands one cell behind on a whole number of steps reads as a stall.
  const cell = Math.min(cells - 1, Math.floor(wrap01(clock) * cells + 1e-9))
  return { row: Math.floor(cell / columnCount), column: cell % columnCount, cell, cells }
}

/* -------------------------------------------------------------------------- */
/* typing                                                                      */
/* -------------------------------------------------------------------------- */

export interface KeyStrike {
  /** Which key of the deck is struck, by scan index. */
  index: number
  /** Where in the passage it is struck, 0..1. */
  at: number
}

export interface StrokeOptions {
  /** How long one keystroke lasts, as a share of the passage. */
  dwell?: number
}

/**
 * How far each of `keys` keys is pressed at `stroke`, given a schedule.
 *
 * One pass of the passage plays the schedule once. Strikes are independent, so
 * two that overlap give the key the deeper of the two presses — the honest
 * answer for a finger that has not left the cap yet.
 */
export function strokePresses(
  strikes: readonly KeyStrike[],
  keys: number,
  stroke: number,
  { dwell = 0.14 }: StrokeOptions = {},
): number[] {
  const deck = Math.max(0, Math.round(finite(keys, 0)))
  const presses = new Array<number>(deck).fill(0)
  if (deck === 0 || !Number.isFinite(stroke)) return presses
  const length = Math.min(1, span(dwell, 0.14))
  for (const strike of strikes) {
    const index = Math.round(finite(strike.index, -1))
    if (index < 0 || index >= deck) continue
    const at = finite(strike.at, Number.NaN)
    if (!Number.isFinite(at)) continue
    const t = (stroke - at) / length
    if (t < 0 || t > 1) continue
    presses[index] = Math.max(presses[index], pressCurve(t))
  }
  return presses
}

export interface CodeStrikeOptions {
  /** Where the first and last strikes land in the passage. */
  start?: number
  end?: number
}

/**
 * A schedule that strikes each of `indices` in turn, evenly across the passage
 * and inside it at both ends, so there is room for a machine to settle before
 * the first keystroke and to answer after the last. Keys outside the deck are
 * dropped rather than clamped onto a key nobody asked for.
 */
export function codeStrikes(
  indices: readonly number[],
  keys: number,
  { start = 0.08, end = 0.7 }: CodeStrikeOptions = {},
): KeyStrike[] {
  const deck = Math.max(0, Math.round(finite(keys, 0)))
  const from = clamp(finite(start, 0.08), 0, 1)
  const to = clamp(finite(end, 0.7), from, 1)
  const wanted = indices
    .map((index) => Math.round(finite(index, -1)))
    .filter((index) => index >= 0 && index < deck)
  if (wanted.length === 0) return []
  const step = (to - from) / wanted.length
  return wanted.map((index, order) => ({ index, at: from + (order + 0.5) * step }))
}

/* -------------------------------------------------------------------------- */
/* the deck in space                                                           */
/* -------------------------------------------------------------------------- */

export interface DeckFrame {
  /** Deck origin: the middle of the key face, in world units. */
  origin: Vec3
  /** Across the deck, to the machine's starboard. */
  u: Vec3
  /** Down the deck toward the operator, which is downhill when it is raked. */
  q: Vec3
  /** Out of the face: up and toward the operator. Keys press along `-n`. */
  n: Vec3
  /** Rake actually used, degrees from flat. */
  rake: number
}

/**
 * The frame a raked key face lives in. World axes are the set's own — `x`
 * starboard, `y` up, `z` toward the tail — and the operator stands at the nose,
 * which is where the `front` camera is.
 *
 * Rake is what makes a press *visible*: a face flat on the bench travels
 * straight into a front camera and shows nothing, while a raked one moves its
 * caps down the screen as well as into the deck.
 */
export function deckFrame(origin: Vec3, rake: number): DeckFrame {
  const angle = clamp(finite(rake, 0), 0, 80)
  const theta = toRadians(angle)
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  return {
    origin: {
      x: finite(origin.x, 0),
      y: finite(origin.y, 0),
      z: finite(origin.z, 0),
    },
    u: { x: 1, y: 0, z: 0 },
    // Toward the operator: forward is -z, and downhill is -y once it is raked.
    q: { x: 0, y: s === 0 ? 0 : -s, z: -c },
    // Out of the face, so the normal tips toward the operator as it rakes.
    n: { x: 0, y: c, z: s === 0 ? 0 : -s },
    rake: angle,
  }
}

/** A point on the deck at `(x, y)` in deck coordinates, `lift` out of the face. */
export function deckPoint(frame: DeckFrame, x: number, y: number, lift = 0): Vec3 {
  const across = finite(x, 0)
  const down = finite(y, 0)
  const out = finite(lift, 0)
  return {
    x: frame.origin.x + frame.u.x * across + frame.q.x * down + frame.n.x * out,
    y: frame.origin.y + frame.u.y * across + frame.q.y * down + frame.n.y * out,
    z: frame.origin.z + frame.u.z * across + frame.q.z * down + frame.n.z * out,
  }
}

export interface CapOptions {
  /** Top of the cap above the deck at rest, world units. */
  height?: number
  /** How far it goes down, world units. */
  travel?: number
  /** Cap body thickness. */
  body?: number
  /** How much narrower the top face is than the base, 0..1. */
  taper?: number
  /** Degrees the cap is turned within the deck plane — a split board's halves. */
  spin?: number
  /** Degrees its top face is tilted about the deck's across-axis, positive toward the operator. */
  tilt?: number
}

const capMetrics = ({
  height = 5,
  travel = 3,
  body = 3.4,
  taper = 0.84,
  spin = 0,
  tilt = 0,
}: CapOptions) => ({
  height: span(height, 5),
  travel: Math.abs(finite(travel, 3)),
  body: span(body, 3.4),
  taper: clamp(finite(taper, 0.84), 0.2, 1),
  spin: finite(spin, 0),
  // Past a right angle a "tilt" is a different face, so it is bounded well short.
  tilt: clamp(finite(tilt, 0), -45, 45),
})

/** A cap-local offset, turned into the deck plane by the cap's own spin. */
const capOffset = (across: number, down: number, spin: number) => {
  const theta = toRadians(spin)
  const cs = Math.cos(theta)
  const sn = Math.sin(theta)
  return { x: across * cs - down * sn, y: across * sn + down * cs }
}

/**
 * One keycap as a tapered box standing on the deck, projected and hulled.
 *
 * The press moves it along the deck's normal rather than down the world's y
 * axis, which is the whole point: the same cap is truthful from every camera,
 * and in plan — where the camera sees none of the rake — a pressed cap correctly
 * looks almost exactly like an unpressed one.
 */
export function capSolid(
  camera: RobotCamera,
  frame: DeckFrame,
  placement: Pick<KeyPlacement, "x" | "y" | "width" | "depth">,
  press: number,
  options: CapOptions = {},
): string {
  const metric = capMetrics(options)
  const down = clamp(finite(press, 0), 0, 1) * metric.travel
  const top = metric.height - down
  const halfWidth = span(placement.width, 8) / 2
  const halfDepth = span(placement.depth, 8) / 2
  const rake = Math.tan(toRadians(metric.tilt))
  const corners = ([
    [top, metric.taper, true],
    [Math.max(0, top - metric.body), 1, false],
  ] as const).flatMap(([lift, scale, tilted]) =>
    ([-1, 1] as const).flatMap((sx) =>
      ([-1, 1] as const).map((sy) => {
        const across = sx * halfWidth * scale
        const back = sy * halfDepth * scale
        const offset = capOffset(across, back, metric.spin)
        return deckPoint(
          frame,
          finite(placement.x, 0) + offset.x,
          finite(placement.y, 0) + offset.y,
          // The sculpt tilts the top face only: a cap's base sits flat on the deck.
          tilted ? lift + back * rake : lift,
        )
      }),
    ),
  )
  return slabPath(corners, camera)
}

/**
 * A rectangle of the deck as a panel of artwork — a cap's legend, a readout
 * strip, a status window — as one affine transform plus the `facing` that says
 * whether the camera can see its front at all.
 *
 * Panel axes follow the operator: its own left-to-right runs from the machine's
 * starboard to its port, because from the operator's side the machine's
 * starboard is on their left, and its own top-to-bottom runs downhill toward
 * them. That is upright in `front`, `profile` and `iso`; from directly above,
 * where the camera stands past the far edge of the deck, it reads away from you,
 * which is what looking at a keyboard over its own top edge does.
 */
export function deckPanel(
  camera: RobotCamera,
  frame: DeckFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  lift = 0,
): PanelProjection {
  const w = span(width, 1)
  const h = span(height, 1)
  const cx = finite(x, 0)
  const cy = finite(y, 0)
  const out = finite(lift, 0)
  return panelTransform(
    camera,
    deckPoint(frame, cx + w / 2, cy - h / 2, out),
    deckPoint(frame, cx - w / 2, cy - h / 2, out),
    deckPoint(frame, cx + w / 2, cy + h / 2, out),
    w,
    h,
  )
}

/**
 * The top face of one cap as a panel, so a legend rides the press with it — and
 * rides its spin and its sculpt too, which `deckPanel` on its own cannot do.
 */
export function capFace(
  camera: RobotCamera,
  frame: DeckFrame,
  placement: Pick<KeyPlacement, "x" | "y" | "width" | "depth">,
  press: number,
  options: CapOptions = {},
): PanelProjection {
  const metric = capMetrics(options)
  const lift = metric.height - clamp(finite(press, 0), 0, 1) * metric.travel
  const rake = Math.tan(toRadians(metric.tilt))
  const w = span(placement.width, 8) * metric.taper
  const h = span(placement.depth, 8) * metric.taper
  const cx = finite(placement.x, 0)
  const cy = finite(placement.y, 0)
  const at = (across: number, back: number) => {
    const offset = capOffset(across, back, metric.spin)
    return deckPoint(frame, cx + offset.x, cy + offset.y, lift + back * rake)
  }
  return panelTransform(camera, at(w / 2, -h / 2), at(-w / 2, -h / 2), at(w / 2, h / 2), w, h)
}
