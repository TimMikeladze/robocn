/**
 * robocn — grand piano geometry.
 *
 * The closures in a grand, and the one thing every drawing of a piano gets
 * wrong: the hammer does not follow the key. A jack drives the knuckle until
 * the jack's toe meets the let-off button, and from there the hammer covers the
 * last of its blow distance with nothing behind it — you cannot hold a hammer
 * against a string. On the way back the back check catches it part-way down and
 * holds it there while the key is still down, which is what lets a note repeat.
 *
 * Under that: an action ratio that is a product of three levers rather than a
 * number, a damper that leaves the string late, a scale that cannot be ideal
 * (halving the speaking length every octave down 88 notes wants a six-metre
 * bottom string, so the exponent is compressed and the shortfall is what the
 * wound strings are for), a bridge that lands one speaking length behind an
 * agraffe that stands one strike point in front of the hammers — so the bent
 * side of the case is the envelope of the scale — and a lid whose angle is a
 * triangle solved from its prop stick.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * acoustics: nothing here computes a frequency, an inharmonicity, a tension, a
 * soundboard impedance or a decay, and there is no hammer mass and no velocity.
 * The flight after let-off is the remaining gap covered in a fixed window, not
 * an integration.
 */

import { clamp, convexHull2, lerp, toDegrees, type Vec2 } from "@/lib/robocn/kinematics"

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

/** A length: finite, never negative, never zero. */
const span = (value: number | undefined, fallback: number) =>
  Math.max(1e-6, Math.abs(finite(value, fallback)))

const unit = (value: number | undefined, fallback = 0) =>
  clamp(finite(value, fallback), 0, 1)

const count = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(finite(value, fallback))))

/* -------------------------------------------------------------------------- */
/* the action                                                                  */
/* -------------------------------------------------------------------------- */

export interface ActionOptions {
  /** Full travel of the front of the key. Everything else is a multiple of it. */
  dip?: number
  /** Rise at the back of the key per unit of dip at the front. */
  balance?: number
  /** Rise of the jack per unit of rise at the capstan. */
  wippen?: number
  /** Hammer travel per unit of rise at the knuckle. */
  lever?: number
  /** Distance from the hammer at rest to the string: the blow. */
  blow?: number
  /** Gap left to the string when the jack trips on the let-off button. */
  letOff?: number
  /** Where the back check holds the hammer on the way down, as a share of the blow. */
  check?: number
  /** Length of the hammer shank, which turns travel into an angle. */
  shank?: number
}

export interface ActionPose {
  /** Key dip used, in world units, clamped to the key's travel. */
  dip: number
  /** The same as a share of the full dip. */
  press: number
  /** How far the back of the key — and so the capstan — has risen. */
  capstan: number
  /** How far the jack has raised the knuckle. */
  knuckle: number
  /** Hammer travel from rest toward the string. */
  hammer: number
  /** Hammer rotation about its flange, degrees. */
  angle: number
  /** What is left between the hammer and the string. */
  gap: number
  /** Total action ratio: hammer travel per unit of key dip. */
  ratio: number
  /** The dip at which the jack trips on the let-off button. */
  escapeDip: number
  /** True once the jack has tripped and the hammer is no longer driven. */
  escaped: boolean
  /** How far the jack has rotated out from under the knuckle, 0..1. */
  jack: number
  /** Dip left after the escapement — the after-touch. */
  afterTouch: number
  /** False when the key bottoms before the jack can trip: a note that never sounds. */
  regulated: boolean
}

interface Action {
  dip: number
  blow: number
  letOff: number
  check: number
  shank: number
  ratio: number
  escapeDip: number
}

/** Over how much of the remaining dip the jack rotates clear of the knuckle. */
const TRIP = 0.35

function action(options: ActionOptions = {}): Action {
  const dip = span(options.dip, 1)
  const balance = span(options.balance, 0.55)
  const wippen = span(options.wippen, 1.3)
  const lever = span(options.lever, 7)
  const blow = span(options.blow, 4.6)
  // A let-off wider than the blow would mean a hammer released before it moved.
  const letOff = clamp(Math.abs(finite(options.letOff, 0.2)), 0, blow)
  const ratio = balance * wippen * lever
  return {
    dip,
    blow,
    letOff,
    check: unit(options.check, 0.66),
    shank: span(options.shank, 12),
    ratio,
    escapeDip: (blow - letOff) / ratio,
  }
}

/**
 * One action solved from the key dip. `dip` is in world units, 0 at rest.
 *
 * The chain is key → capstan → wippen → jack → knuckle → hammer, so the ratio
 * is the product of three levers and the escapement moves when any of them
 * does: the jack trips at `(blow − letOff) / ratio` of dip, and the dip left
 * over is the after-touch. Past the trip the hammer holds where the jack left
 * it, because nothing is driving it any more — the last of the blow is a
 * separate question, and `hammerPose` is the one that answers it.
 */
export function actionPose(dip: number, options: ActionOptions = {}): ActionPose {
  const it = action(options)
  const balance = span(options.balance, 0.55)
  const wippen = span(options.wippen, 1.3)
  const used = clamp(finite(dip, 0), 0, it.dip)
  const escaped = used >= it.escapeDip
  const driven = Math.min(used, it.escapeDip)
  const hammer = Math.min(driven * it.ratio, it.blow)
  return {
    dip: used,
    press: used / it.dip,
    capstan: used * balance,
    knuckle: driven * balance * wippen,
    hammer,
    angle: toDegrees(hammer / it.shank),
    gap: it.blow - hammer,
    ratio: it.ratio,
    escapeDip: it.escapeDip,
    escaped,
    jack: escaped ? unit((used - it.escapeDip) / (it.dip * TRIP)) : 0,
    afterTouch: Math.max(0, used - it.escapeDip),
    // A key that bottoms before the jack trips holds the hammer short of the
    // string for ever: the note cannot sound, and that is a regulation fault.
    regulated: it.escapeDip < it.dip,
  }
}

export interface HammerPose extends ActionPose {
  /** Hammer travel, including the free flight and the return to the check. */
  travel: number
  /** True at the string. */
  contact: boolean
  /** True while the back check is holding the hammer short of its rest. */
  checked: boolean
}

/** Share of the ring spent coming back from the string to the check. */
const REBOUND = 0.3

/**
 * The whole stroke, from the two numbers a pattern gives you: `lift` is the
 * approach — 0 free, 1 at the moment of the strike, which is what `combLift`
 * returns — and `ring` is 1 at the strike and falling away after it, which is
 * `combRelease`.
 *
 * The key is held while the note rings, so the damper stays off the string for
 * as long as the string is speaking and falls as the key returns. The hammer
 * does not: it leaves the string immediately and is caught by the back check a
 * third of the way down, where it waits for the key.
 */
export function hammerPose(lift: number, ring: number, options: ActionOptions = {}): HammerPose {
  const it = action(options)
  const rang = unit(ring)
  const press = Math.max(unit(lift), rang)
  const pose = actionPose(press * it.dip, options)
  if (rang <= 0) {
    return { ...pose, travel: pose.hammer, contact: false, checked: false }
  }
  const held = it.check * it.blow
  const travel =
    rang >= 1 - REBOUND
      ? // Off the string and back to the check, over the first of the ring.
        lerp(it.blow, held, (1 - rang) / REBOUND)
      : // Held there until the key lets it go.
        held * (rang / (1 - REBOUND))
  return {
    ...pose,
    hammer: travel,
    travel,
    angle: toDegrees(travel / it.shank),
    gap: it.blow - travel,
    contact: travel >= it.blow - 1e-6,
    checked: travel <= held + 1e-6,
  }
}

export interface DamperOptions {
  /** Share of the key dip at which the damper starts to leave the string. */
  lifts?: number
  /** Share of the dip by which it is clear of the string. */
  clears?: number
  /** The sustain pedal, 0..1. It lifts every damper regardless of the keys. */
  pedal?: number
}

/**
 * How far the damper has left the string, 0 on it to 1 clear.
 *
 * It leaves late — nothing happens for the first half of the key dip — which is
 * why a half-pressed key is a key that has done nothing at all. The sustain
 * pedal takes every damper off the strings on its own.
 */
export function damperLift(press: number, options: DamperOptions = {}): number {
  const lifts = unit(options.lifts, 0.45)
  const clears = Math.max(lifts + 1e-3, unit(options.clears, 0.85))
  const key = unit(press)
  const byKey = clamp((key - lifts) / (clears - lifts), 0, 1)
  return Math.max(byKey, unit(options.pedal))
}

/* -------------------------------------------------------------------------- */
/* the scale                                                                   */
/* -------------------------------------------------------------------------- */

export interface PianoScaleOptions {
  /** Notes in the compass, 88 for a full keyboard. */
  notes?: number
  /** Speaking length of the top note. */
  shortest?: number
  /** Speaking length of the bottom note, after the bass has been foreshortened. */
  longest?: number
  /** Notes from the bottom that are overspun. */
  wound?: number
  /** Notes from the bottom strung with one string. */
  single?: number
  /** Notes above those strung with two. Everything higher is a trichord. */
  pairs?: number
  /** Strike point in the bass, as one over this. */
  bassStrike?: number
  /** Strike point at the top, as one over this. */
  trebleStrike?: number
}

export interface PianoString {
  /** 0 is the bottom note. */
  index: number
  /** Speaking length: agraffe to bridge. */
  speaking: number
  /** What an ideal halving scale would have asked for. */
  ideal: number
  /** How far short of ideal this note falls, 0 in the treble to most in the bass. */
  foreshortening: number
  /** Where the hammer strikes, measured from the agraffe. */
  strike: number
  /** Strings in the choir: one in the bass, two through the break, three above. */
  choir: number
  /** Overspun. */
  wound: boolean
}

interface Scale {
  notes: number
  shortest: number
  longest: number
  octaves: number
  /** How hard the exponent is compressed toward the bass. 0 is an ideal scale. */
  bend: number
}

function scale(options: PianoScaleOptions = {}): Scale {
  const notes = count(options.notes, 88, 2, 128)
  const shortest = span(options.shortest, 2)
  const longest = Math.max(shortest, span(options.longest, 78))
  const octaves = (notes - 1) / 12
  // An ideal scale halves every octave. A real one cannot: the bottom note
  // would want a string metres long, so the exponent is compressed by `bend`,
  // chosen to land the bottom note on `longest`. A scale that asks for less
  // than ideal needs no compression at all.
  const bend = clamp(1 - Math.log2(longest / shortest) / octaves, 0, 1)
  return { notes, shortest, longest, octaves, bend }
}

/** Speaking length of one note, and what an ideal scale would have wanted. */
function speakingLength(index: number, it: Scale) {
  const above = (it.notes - 1 - clamp(index, 0, it.notes - 1)) / 12
  const ideal = it.shortest * 2 ** above
  // Ideal at the top, where the rate is exactly one octave per halving, and
  // progressively compressed below it — which is the shape of a real scale.
  const exponent = above - (it.bend * above * above) / it.octaves
  return { speaking: it.shortest * 2 ** exponent, ideal }
}

/**
 * The whole scale, bottom note first. The lengths are the thing the case is
 * drawn around: `pianoLayout` turns them into a bridge, a capo line and a rim.
 */
export function pianoScale(options: PianoScaleOptions = {}): PianoString[] {
  const it = scale(options)
  const wound = count(options.wound, 26, 0, it.notes)
  const single = count(options.single, 8, 0, it.notes)
  const pairs = count(options.pairs, 10, 0, it.notes)
  const bass = Math.max(2, span(options.bassStrike, 8))
  const treble = Math.max(2, span(options.trebleStrike, 16))
  return Array.from({ length: it.notes }, (_, index) => {
    const { speaking, ideal } = speakingLength(index, it)
    const up = it.notes > 1 ? index / (it.notes - 1) : 0
    // The strike ratio is not constant: it runs from about an eighth in the
    // bass to half that at the top, so the capo line is a curve.
    const ratio = 1 / lerp(bass, treble, up)
    return {
      index,
      speaking,
      ideal,
      foreshortening: ideal > 0 ? clamp(1 - speaking / ideal, 0, 1) : 0,
      strike: speaking * ratio,
      choir: index < single ? 1 : index < single + pairs ? 2 : 3,
      wound: index < wound,
    }
  })
}

/* -------------------------------------------------------------------------- */
/* the plan                                                                    */
/* -------------------------------------------------------------------------- */

export interface PianoLayoutOptions extends PianoScaleOptions {
  /** Where the hammers strike, along the case. */
  strike?: number
  /**
   * How far in front of its own agraffe each tuning pin stands. The pins follow
   * the agraffes, which is why a grand's pin block is laid out on a curve.
   */
  pins?: number
  /** The front of the case, in front of the keyboard. */
  front?: number
  /** Half the width the string field is spread across. */
  halfWidth?: number
  /** Notes at the bottom carried on their own bridge, over the others. */
  overstrung?: number
  /** How far that bridge is displaced toward the treble, as a share of the width. */
  bassOffset?: number
  /** How far past the bridge the strings reach their hitch pins. */
  hitch?: number
  /** How far outside the strings the rim runs. */
  margin?: number
  /** How wide the tail is, so the bent side has somewhere to finish. */
  tail?: number
}

export interface PianoPlacement extends PianoString {
  /** Tuning pin, in plan: x across the case, y from the front toward the tail. */
  pin: Vec2
  /** Agraffe — the front end of the speaking length — one strike point back from the hammers. */
  agraffe: Vec2
  /** Bridge pin: the far end of the speaking length. */
  bridge: Vec2
  /** Hitch pin, out at the rim. */
  hitchPin: Vec2
  /** True for the bass notes that cross over the others on their own bridge. */
  crossed: boolean
}

export interface PianoLayout {
  strings: PianoPlacement[]
  /** The long bridge, treble end first. */
  bridge: Vec2[]
  /** The overstrung bass bridge, or empty when nothing is crossed. */
  bassBridge: Vec2[]
  /** The capo line the agraffes stand on: a curve, because the strike ratio is. */
  capo: Vec2[]
  /** The case: the front, the bent side, the tail and the spine. */
  rim: Vec2[]
  /** How far back the tail reaches. */
  depth: number
}

/**
 * The plan of the instrument, derived from the scale.
 *
 * Each string runs from its agraffe — one strike point in front of the hammer
 * line — to its bridge pin one speaking length behind it, so the bridge curve
 * and, offset outward from it, the bent side of the case are both consequences
 * of the lengths rather than shapes somebody liked. What is laid out rather
 * than derived is the fan across the width and the displacement of the bass
 * bridge that carries the bass strings over the others.
 */
export function pianoLayout(options: PianoLayoutOptions = {}): PianoLayout {
  const strings = pianoScale(options)
  const notes = strings.length
  const strike = finite(options.strike, 0)
  const run = span(options.pins, 2.6)
  const front = finite(options.front, 0)
  const half = span(options.halfWidth, 26)
  const overstrung = count(options.overstrung, 18, 0, notes)
  const bassOffset = unit(options.bassOffset, 0.32)
  const hitch = span(options.hitch, 3)
  const margin = span(options.margin, 4)
  const tail = span(options.tail, 20)

  /** Across the case: the bottom note at the bass edge, the top at the treble. */
  const fan = (index: number) => (notes > 1 ? lerp(half, -half, index / (notes - 1)) : 0)

  const placed: PianoPlacement[] = strings.map((string) => {
    const crossed = string.index < overstrung
    const x = fan(string.index)
    const agraffeZ = strike - string.strike
    // The crossed notes angle toward the middle, which is what carries them
    // over the long bridge — and a string run at an angle reaches less far down
    // the case than its own length, which is the whole point of running it so.
    const sideways = crossed
      ? -half * 2 * bassOffset * (1 - string.index / Math.max(1, overstrung))
      : 0
    const along = Math.sqrt(Math.max(0, string.speaking * string.speaking - sideways * sideways))
    const bridge = { x: x + sideways, y: agraffeZ + along }
    const reach = Math.max(1e-6, string.speaking)
    return {
      ...string,
      crossed,
      pin: { x, y: agraffeZ - run },
      agraffe: { x, y: agraffeZ },
      bridge,
      hitchPin: {
        x: bridge.x + (sideways / reach) * hitch,
        y: bridge.y + (along / reach) * hitch,
      },
    }
  })

  const bridge = placed
    .filter((string) => !string.crossed)
    .map((string) => string.bridge)
    .reverse()
  const bassBridge = placed
    .filter((string) => string.crossed)
    .map((string) => string.bridge)
    .reverse()
  const capo = placed.map((string) => string.agraffe).reverse()
  const depth =
    placed.reduce((deepest, string) => Math.max(deepest, string.hitchPin.y), strike) + margin

  return {
    strings: placed,
    bridge,
    bassBridge,
    capo,
    rim: rimOutline(placed, { half, margin, tail, depth, front }),
    depth,
  }
}

interface RimOptions {
  half: number
  margin: number
  tail: number
  depth: number
  front: number
}

/**
 * The case. Every string has to fit inside it, so the outline is the hull of
 * the hitch pins pushed outward by the rim — which is what makes the bent side
 * the envelope of the scale — with the spine and the front, which on a grand
 * are straight, snapped back onto their own lines.
 */
function rimOutline(
  strings: readonly PianoPlacement[],
  { half, margin, tail, depth, front }: RimOptions,
): Vec2[] {
  const edge = half + margin
  const back = depth - margin
  const seeds: Vec2[] = [
    ...strings.map((string) => string.hitchPin),
    { x: -half, y: front + margin },
    { x: half, y: front + margin },
    // Hold the spine out to the tail, and give the tail a width to finish on.
    { x: half, y: back },
    { x: half - tail, y: back },
  ]
  const hull = convexHull2(seeds)
  if (hull.length < 3) return seeds
  const centre = hull.reduce(
    (sum, point) => ({ x: sum.x + point.x / hull.length, y: sum.y + point.y / hull.length }),
    { x: 0, y: 0 },
  )
  const outline: Vec2[] = []
  for (let index = 0; index < hull.length; index += 1) {
    const point = hull[index]!
    const previous = hull[(index - 1 + hull.length) % hull.length]!
    const next = hull[(index + 1) % hull.length]!
    const normal = bisector(previous, point, next, centre)
    const moved = {
      x: clamp(point.x + normal.x * margin, -edge, edge),
      y: Math.max(point.y + normal.y * margin, front),
    }
    if (point.x >= half - 1e-6) moved.x = edge
    if (point.y <= front + margin + 1e-6) moved.y = front
    if (point.y >= back - 1e-6) moved.y = depth
    const last = outline[outline.length - 1]
    if (!last || Math.hypot(last.x - moved.x, last.y - moved.y) > 1e-6) outline.push(moved)
  }
  return outline
}

/** The outward unit bisector at one hull vertex. */
function bisector(previous: Vec2, point: Vec2, next: Vec2, centre: Vec2): Vec2 {
  let x = 0
  let y = 0
  for (const edge of [
    { x: point.x - previous.x, y: point.y - previous.y },
    { x: next.x - point.x, y: next.y - point.y },
  ]) {
    const length = Math.hypot(edge.x, edge.y)
    if (length < 1e-9) continue
    x += -edge.y / length
    y += edge.x / length
  }
  const length = Math.hypot(x, y)
  if (length < 1e-9) return { x: 0, y: 0 }
  const away = { x: point.x - centre.x, y: point.y - centre.y }
  const sign = (x * away.x + y * away.y < 0 ? -1 : 1) / length
  return { x: x * sign, y: y * sign }
}

/* -------------------------------------------------------------------------- */
/* the lid                                                                     */
/* -------------------------------------------------------------------------- */

export type LidStage = "closed" | "half" | "full"

export interface LidOptions {
  /** The reference the two props are sized off: the width of the case. */
  width?: number
  /** Hinge to the notch the stick stands in, measured across the lid. */
  notch?: number
  /** Hinge to the foot of the stick, measured across the case. */
  foot?: number
  /** The prop stick itself. */
  stick?: number
}

export interface LidPose {
  /** Angle the lid stands at, degrees from the case. */
  angle: number
  notch: number
  foot: number
  stick: number
  /** False when the stick is too long or too short for the triangle to close. */
  stands: boolean
}

/**
 * The two cups a grand's props stand in, as shares of the case's width: the
 * long prop reaches nearly across it, the short one stands close to the hinge
 * on a stick barely a fifth as long. The angles — about 47 and about 22 degrees
 * — are what falls out of those three sides, not what was asked for.
 */
const LID_STAGES: Record<LidStage, { foot: number; notch: number; stick: number }> = {
  closed: { foot: 0.9, notch: 0.85, stick: 0 },
  half: { foot: 0.46, notch: 0.42, stick: 0.175 },
  full: { foot: 0.9, notch: 0.85, stick: 0.7 },
}

/**
 * The lid on its prop. Three sides — hinge to notch along the lid, hinge to the
 * stick's foot across the case, and the stick between them — so the angle is
 * solved rather than picked, and a short prop and a long prop give the two
 * angles a grand actually has. A stick that cannot close the triangle will not
 * stand, and the lid stays shut rather than being drawn on nothing.
 */
export function lidPose(stage: LidStage, options: LidOptions = {}): LidPose {
  const width = span(options.width, 1)
  const preset = LID_STAGES[stage] ?? LID_STAGES.closed
  const foot = span(options.foot ?? preset.foot * width, 1e-6)
  const notch = span(options.notch ?? preset.notch * width, 1e-6)
  const stick = Math.abs(finite(options.stick ?? preset.stick * width, 0))
  if (stage === "closed" || stick <= 0) {
    return { angle: 0, notch, foot, stick, stands: stage === "closed" }
  }
  const cosine = (notch * notch + foot * foot - stick * stick) / (2 * notch * foot)
  const stands = cosine >= -1 && cosine <= 1
  return { angle: stands ? toDegrees(Math.acos(cosine)) : 0, notch, foot, stick, stands }
}

/* -------------------------------------------------------------------------- */
/* the keyboard                                                                */
/* -------------------------------------------------------------------------- */

export interface PianoKey {
  index: number
  /** Pitch class, 0 is C. */
  pitch: number
  /** True for a white key. */
  natural: boolean
  /** Centre of the key across the keyboard. The bottom note is at the bass edge. */
  x: number
  /** Width of the key. */
  width: number
  /** How far back it runs from the front of the naturals. */
  length: number
}

export interface KeyboardOptions {
  /** Width the whole compass is laid across. */
  span?: number
  /** Length of a natural. */
  length?: number
  /** Width of a sharp, as a share of a natural's. */
  sharpWidth?: number
  /** Length of a sharp, as a share of a natural's. */
  sharpLength?: number
  /** Pitch class of the bottom note. 9 is A, which is where an 88 starts. */
  first?: number
}

const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11])
/**
 * Sharps do not sit on the boundary between their naturals: each group leans
 * outward from its middle. A share of a natural's width, toward the treble.
 */
const SHARP_OFFSET: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.12, 8: 0, 10: 0.12 }

/**
 * The compass laid out across the keyboard, bottom note first. `+x` is the bass
 * end, so the keys run down the screen the way they do under a player's hands.
 */
export function pianoKeys(notes: number, options: KeyboardOptions = {}): PianoKey[] {
  const total = count(notes, 88, 1, 128)
  const across = span(options.span, 48)
  const long = span(options.length, 6)
  const first = ((count(options.first, 9, -128, 128) % 12) + 12) % 12
  const sharpWidth = span(options.sharpWidth, 0.58)
  const sharpLength = span(options.sharpLength, 0.62)
  const pitchOf = (index: number) => (index + first) % 12
  let whites = 0
  for (let index = 0; index < total; index += 1) {
    if (NATURALS.has(pitchOf(index))) whites += 1
  }
  const width = across / Math.max(1, whites)
  const half = across / 2
  let seen = 0
  return Array.from({ length: total }, (_, index) => {
    const pitch = pitchOf(index)
    const natural = NATURALS.has(pitch)
    if (natural) {
      const x = half - (seen + 0.5) * width
      seen += 1
      return { index, pitch, natural, x, width, length: long }
    }
    const boundary = half - seen * width
    return {
      index,
      pitch,
      natural,
      x: boundary - (SHARP_OFFSET[pitch] ?? 0) * width,
      width: width * sharpWidth,
      length: long * sharpLength,
    }
  })
}
