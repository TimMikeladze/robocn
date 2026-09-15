/**
 * construct-geometry — reading a freehand stroke, and forging a construct of
 * solid light out of what it says.
 *
 * Every other interactive machine in the set maps a pointer to one scalar and
 * clamps it. This one takes the *shape of the gesture*, which needs maths the
 * set had none of:
 *
 * - **Arc-length resampling.** A pointer emits points at its own rate, not at
 *   even spacing — dense where the hand slowed, one long jump where it flew.
 *   Nothing downstream can be trusted until the samples are evenly spaced, so
 *   everything here runs on {@link resampleStroke} first.
 * - **A frame, not a bounding box.** Centroid, the principal axis from the
 *   covariance of the samples, the span along and across that axis, closure
 *   (the end-to-start gap over the path length), signed area by the shoelace
 *   formula, circularity `4πA/P²`, and a corner count from turning angle.
 *   Seven numbers that describe a gesture without keeping the gesture.
 * - **A classifier that shows its working.** {@link classifyStroke} scores
 *   every archetype over those numbers and returns the scores as well as the
 *   winner, so a near miss is visibly a near miss.
 * - **A real scanline fill.** {@link constructLattice} clips fill lines against
 *   the outline at the construct's own rake, so the hatch follows the shape
 *   rather than being painted across it.
 * - **A draw that costs.** {@link constructCost} charges for the area enclosed,
 *   which is what the ring's gauge reads.
 *
 * The archetype outlines are **drawings**, not solutions: a glove is a glove
 * because it is drawn as one. There is no physics on a construct — nothing
 * swings, nothing collides, nothing has mass — and no stroke is ever kept
 * beyond the frame it produced.
 *
 * Coordinates are the caller's own picture units; nothing here assumes a
 * viewBox, a camera or a direction for y.
 *
 * Design note: docs/construct-ring.md.
 */

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

/** A raw pointer path, exactly as it was captured. */
export type Vec2Stroke = readonly Vec2[]

/** What a stroke can be forged into. */
export type ConstructArchetype =
  | "bubble"
  | "shield"
  | "cage"
  | "glove"
  | "hammer"
  | "bridge"
  | "claw"

export const constructArchetypes = [
  "bubble",
  "shield",
  "cage",
  "glove",
  "hammer",
  "bridge",
  "claw",
] as const satisfies readonly ConstructArchetype[]

/** Everything a stroke says about itself, and nothing about the stroke. */
export interface StrokeFrame {
  /** Centroid of the evenly spaced samples. */
  center: Vec2
  /** Principal axis, in degrees. Undirected — 20° and 200° are the same axis. */
  angle: number
  /** Span along the principal axis. Never zero. */
  along: number
  /** Span across it. Never zero. */
  across: number
  /** `along / across`, at least 1 and at most 40. */
  aspect: number
  /** Path length of the samples. */
  length: number
  /** End-to-start gap over path length: 0 closed, 1 wide open. */
  closure: number
  /** Area enclosed by the sample polygon. */
  area: number
  /** `4πA/P²`: 1 for a circle, toward 0 for a scribble or a line. */
  circularity: number
  /** Direction changes sharp enough to read as corners. */
  corners: number
  /** Total absolute turning, in degrees. A single loop is about 360. */
  turning: number
  /** The evenly spaced samples the rest of it was measured from. */
  samples: Vec2[]
}

const TAU = Math.PI * 2
const DEFAULT_SAMPLES = 48
/** The enclosed area a construct may cost the whole reserve, in picture units². */
const COST_AREA = 11000

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

const isFinitePoint = (p: Vec2 | undefined): p is Vec2 =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y)

/** 1 at `target`, falling to 0 `tolerance` away. */
const near = (value: number, target: number, tolerance: number) =>
  clamp(1 - Math.abs(value - target) / Math.max(1e-6, tolerance), 0, 1)

/** 0 below `edge`, 1 once `soft` past it. */
const above = (value: number, edge: number, soft: number) =>
  clamp((value - edge) / Math.max(1e-6, soft), 0, 1)

/** 1 below `edge`, 0 once `soft` past it. */
const below = (value: number, edge: number, soft: number) =>
  clamp((edge + soft - value) / Math.max(1e-6, soft), 0, 1)

/* -------------------------------------------------------------------------- */
/* sampling                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The stroke, evenly spaced. Non-finite points are dropped rather than
 * propagated, repeated points collapse, and a stroke with no length at all
 * comes back as `count` copies of where it was — a click is a point, not a
 * division by zero.
 */
export function resampleStroke(points: Vec2Stroke, count = DEFAULT_SAMPLES): Vec2[] {
  const total = Math.max(2, Math.round(finite(count, DEFAULT_SAMPLES)))
  const clean: Vec2[] = []
  for (const p of Array.isArray(points) ? points : []) {
    if (!isFinitePoint(p)) continue
    const last = clean.at(-1)
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-9) continue
    clean.push({ x: p.x, y: p.y })
  }
  if (clean.length === 0) return Array.from({ length: total }, () => ({ x: 0, y: 0 }))
  if (clean.length === 1) return Array.from({ length: total }, () => ({ ...clean[0] }))

  const spans: number[] = []
  let length = 0
  for (let i = 1; i < clean.length; i += 1) {
    const span = Math.hypot(clean[i].x - clean[i - 1].x, clean[i].y - clean[i - 1].y)
    spans.push(span)
    length += span
  }
  if (length < 1e-9) return Array.from({ length: total }, () => ({ ...clean[0] }))

  const step = length / (total - 1)
  const out: Vec2[] = [{ ...clean[0] }]
  let segment = 0
  let walked = 0
  for (let i = 1; i < total - 1; i += 1) {
    const wanted = step * i
    while (segment < spans.length - 1 && walked + spans[segment] < wanted) {
      walked += spans[segment]
      segment += 1
    }
    const t = spans[segment] > 1e-12 ? (wanted - walked) / spans[segment] : 0
    const a = clean[segment]
    const b = clean[segment + 1]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  out.push({ ...clean.at(-1)! })
  return out
}

/** Area enclosed by a polygon, by the shoelace formula. 0 for rubbish. */
export function polygonArea(points: Vec2Stroke): number {
  const list = Array.isArray(points) ? points : []
  if (list.length < 3) return 0
  let sum = 0
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    const b = list[(i + 1) % list.length]
    if (!isFinitePoint(a) || !isFinitePoint(b)) return 0
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/* -------------------------------------------------------------------------- */
/* the frame                                                                   */
/* -------------------------------------------------------------------------- */

/** A stroke that says nothing: a circle of `span`, for a neutral construct. */
export function neutralFrame(span = 80): StrokeFrame {
  const radius = Math.max(6, finite(span, 80)) / 2
  const samples = Array.from({ length: DEFAULT_SAMPLES }, (_, index) => {
    const t = (index / DEFAULT_SAMPLES) * TAU
    return { x: Math.cos(t) * radius, y: Math.sin(t) * radius }
  })
  return strokeFrame(samples)
}

/** Everything measurable about a stroke. Never throws, never returns `NaN`. */
export function strokeFrame(points: Vec2Stroke, count = DEFAULT_SAMPLES): StrokeFrame {
  const samples = resampleStroke(points, count)
  const n = samples.length

  let cx = 0
  let cy = 0
  for (const p of samples) {
    cx += p.x
    cy += p.y
  }
  cx /= n
  cy /= n

  // Principal axis, from the covariance of the samples.
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of samples) {
    const dx = p.x - cx
    const dy = p.y - cy
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const ux = Math.cos(theta)
  const uy = Math.sin(theta)

  let alongMin = Infinity
  let alongMax = -Infinity
  let acrossMin = Infinity
  let acrossMax = -Infinity
  for (const p of samples) {
    const dx = p.x - cx
    const dy = p.y - cy
    const a = dx * ux + dy * uy
    const b = -dx * uy + dy * ux
    alongMin = Math.min(alongMin, a)
    alongMax = Math.max(alongMax, a)
    acrossMin = Math.min(acrossMin, b)
    acrossMax = Math.max(acrossMax, b)
  }
  const along = Math.max(1e-3, alongMax - alongMin)
  const across = Math.max(1e-3, acrossMax - acrossMin)

  let length = 0
  for (let i = 1; i < n; i += 1) {
    length += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y)
  }
  const gap = Math.hypot(samples[0].x - samples[n - 1].x, samples[0].y - samples[n - 1].y)
  const perimeter = length + gap
  const area = polygonArea(samples)

  // Turning: how hard the tangent swings from sample to sample.
  let turning = 0
  let corners = 0
  let sinceCorner = 3
  for (let i = 1; i < n - 1; i += 1) {
    const ax = samples[i].x - samples[i - 1].x
    const ay = samples[i].y - samples[i - 1].y
    const bx = samples[i + 1].x - samples[i].x
    const by = samples[i + 1].y - samples[i].y
    if (Math.hypot(ax, ay) < 1e-9 || Math.hypot(bx, by) < 1e-9) continue
    const turn = Math.abs((Math.atan2(by, bx) - Math.atan2(ay, ax) + Math.PI * 3) % TAU - Math.PI)
    turning += (turn * 180) / Math.PI
    sinceCorner += 1
    if (turn > (38 * Math.PI) / 180 && sinceCorner >= 3) {
      corners += 1
      sinceCorner = 0
    }
  }

  return {
    center: { x: finite(cx), y: finite(cy) },
    angle: finite((theta * 180) / Math.PI),
    along,
    across,
    aspect: clamp(along / across, 1, 40),
    length,
    closure: clamp(length > 1e-9 ? gap / length : 1, 0, 1),
    area,
    circularity: clamp(perimeter > 1e-9 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0, 0, 1),
    corners,
    turning: finite(turning),
  samples,
  }
}

/* -------------------------------------------------------------------------- */
/* the classifier                                                              */
/* -------------------------------------------------------------------------- */

export interface StrokeVerdict {
  archetype: ConstructArchetype
  /** The winning score. */
  score: number
  /** Every archetype's score, so a near miss reads as a near miss. */
  scores: Record<ConstructArchetype, number>
}

/**
 * Which construct a stroke is asking for. A score per archetype over five of
 * the frame's numbers — closure, circularity, aspect, corners, turning — and
 * the highest wins. It always names one: a ring that fails in front of the
 * reader is worse than a ring that makes a bubble.
 */
export function classifyStroke(frame: StrokeFrame): StrokeVerdict {
  const closed = below(frame.closure, 0.1, 0.22)
  const open = above(frame.closure, 0.18, 0.3)
  const round = above(frame.circularity, 0.7, 0.2)
  const slab = near(frame.circularity, 0.5, 0.35)

  const scores: Record<ConstructArchetype, number> = {
    bubble: 0.9 * closed + 1.3 * round + 0.8 * near(frame.aspect, 1, 0.5),
    shield:
      0.8 * closed + 1.2 * slab + 0.9 * near(frame.aspect, 1.3, 0.6) +
      0.5 * below(frame.corners, 3, 2),
    cage: 0.7 * closed + 1.5 * above(frame.corners, 4, 3) + 0.7 * near(frame.aspect, 1, 0.7),
    glove: 1.6 * near(frame.aspect, 1.75, 0.5) + 0.6 + 0.5 * below(frame.corners, 2, 2),
    hammer: 1.2 * open + 1.4 * above(frame.aspect, 2.6, 1.6) + 0.7 * below(frame.turning, 90, 90),
    bridge:
      1.1 * open + 1.0 * above(frame.aspect, 2, 1.2) + 1.1 * near(frame.turning, 180, 110) +
      0.4 * below(frame.corners, 2, 2),
    claw:
      1.1 * open + 1.2 * above(frame.turning, 220, 180) + 0.8 * below(frame.aspect, 1.6, 0.8) +
      0.6 * above(frame.corners, 2, 2),
  }

  let archetype: ConstructArchetype = "bubble"
  let score = -Infinity
  for (const name of constructArchetypes) {
    const value = finite(scores[name], 0)
    scores[name] = value
    if (value > score) {
      score = value
      archetype = name
    }
  }
  return { archetype, score, scores }
}

/* -------------------------------------------------------------------------- */
/* the archetypes                                                              */
/* -------------------------------------------------------------------------- */

/*
 * Unit outlines: x runs along the stroke's principal axis, y across it, both
 * inside [-1, 1]. They are drawings — the honest half of this module is the
 * frame and the classifier, not these.
 */

const arc = (
  from: number,
  to: number,
  steps: number,
  radiusX: number,
  radiusY: number,
  cx = 0,
  cy = 0,
): Vec2[] =>
  Array.from({ length: steps }, (_, index) => {
    const t = from + ((to - from) * index) / (steps - 1)
    return { x: cx + Math.cos(t) * radiusX, y: cy + Math.sin(t) * radiusY }
  })

/** A deterministic wobble, so a bubble is not a perfect circle. */
const wobble = (index: number) => {
  const h = Math.sin(index * 12.9898) * 43758.5453
  return (h - Math.floor(h)) * 2 - 1
}

const unitOutlines: Record<ConstructArchetype, () => Vec2[]> = {
  bubble: () =>
    Array.from({ length: 40 }, (_, index) => {
      const t = (index / 40) * TAU
      const r = 1 + wobble(index) * 0.025
      return { x: Math.cos(t) * r, y: Math.sin(t) * r }
    }),

  // Flat at the heel, widest a third along, tapering to a point.
  shield: () => [
    { x: -1, y: -0.62 },
    { x: -0.86, y: -0.86 },
    { x: -0.5, y: -0.98 },
    { x: -0.1, y: -0.9 },
    { x: 0.4, y: -0.66 },
    { x: 0.78, y: -0.36 },
    { x: 1, y: 0 },
    { x: 0.78, y: 0.36 },
    { x: 0.4, y: 0.66 },
    { x: -0.1, y: 0.9 },
    { x: -0.5, y: 0.98 },
    { x: -0.86, y: 0.86 },
    { x: -1, y: 0.62 },
  ],

  // A rounded box: the outline of a cage, whose bars are the lattice.
  cage: () => {
    const r = 0.34
    return [
      ...arc(Math.PI, Math.PI * 1.5, 6, r, r, -1 + r, -1 + r),
      ...arc(Math.PI * 1.5, TAU, 6, r, r, 1 - r, -1 + r),
      ...arc(0, Math.PI * 0.5, 6, r, r, 1 - r, 1 - r),
      ...arc(Math.PI * 0.5, Math.PI, 6, r, r, -1 + r, 1 - r),
    ]
  },

  // A mitt: a narrow cuff at the heel, a swollen striking face, a thumb lobe.
  glove: () => [
    { x: -1, y: 0.3 },
    { x: -0.82, y: 0.42 },
    { x: -0.6, y: 0.5 },
    // the knuckles, round the striking face and down the far side
    ...arc((128 * Math.PI) / 180, (-48 * Math.PI) / 180, 14, 0.9, 0.92, 0.1, 0),
    { x: 0.2, y: -0.84 },
    // the thumb, a lobe of its own off the palm
    { x: 0.04, y: -0.74 },
    { x: -0.02, y: -0.9 },
    { x: -0.24, y: -1 },
    { x: -0.44, y: -0.9 },
    { x: -0.46, y: -0.68 },
    { x: -0.34, y: -0.56 },
    { x: -0.6, y: -0.5 },
    { x: -0.82, y: -0.42 },
    { x: -1, y: -0.3 },
  ],

  // A head at the far end, a shaft back to the grip.
  hammer: () => [
    { x: -1, y: -0.2 },
    { x: 0.3, y: -0.16 },
    { x: 0.3, y: -0.86 },
    { x: 0.62, y: -1 },
    { x: 1, y: -0.92 },
    { x: 1, y: 0.92 },
    { x: 0.62, y: 1 },
    { x: 0.3, y: 0.86 },
    { x: 0.3, y: 0.16 },
    { x: -1, y: 0.2 },
    { x: -1.0, y: 0.2 },
  ],

  // An arch: two parallel curves and the piers they land on. Screen y grows
  // downward, so the span rises toward -y.
  bridge: () => {
    const outer = arc(Math.PI, 0, 16, 1, -1)
    const inner = arc(0, Math.PI, 16, 0.66, -0.6)
    return [
      { x: -1, y: 0.34 },
      ...outer.map((p) => ({ x: p.x, y: p.y + 0.34 })),
      { x: 1, y: 0.34 },
      { x: 0.66, y: 0.34 },
      ...inner.map((p) => ({ x: p.x, y: p.y + 0.34 })),
      { x: -0.66, y: 0.34 },
    ]
  },

  // Three talons off a palm.
  claw: () => [
    { x: -1, y: -0.34 },
    { x: -0.2, y: -0.66 },
    { x: 0.98, y: -0.98 },
    { x: 0.3, y: -0.32 },
    { x: 0.52, y: -0.12 },
    { x: 1, y: 0.02 },
    { x: 0.5, y: 0.2 },
    { x: 0.3, y: 0.38 },
    { x: 0.96, y: 0.98 },
    { x: -0.22, y: 0.62 },
    { x: -1, y: 0.34 },
  ],
}

/*
 * The seams: a line or two per archetype that makes it read as the thing it is.
 * Drawing, like the outlines, and fitted the same way.
 */
const unitDetails: Record<ConstructArchetype, () => Vec2[][]> = {
  bubble: () => [arc((150 * Math.PI) / 180, (95 * Math.PI) / 180, 8, 0.78, 0.78)],
  shield: () => [
    [
      { x: -0.72, y: -0.62 },
      { x: -0.72, y: 0.62 },
    ],
    arc(0, TAU, 14, 0.2, 0.26, -0.05, 0),
  ],
  cage: () => [
    [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ],
    [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ],
  ],
  glove: () => [
    // the cuff band, and the seam across the knuckles
    [
      { x: -0.58, y: 0.56 },
      { x: -0.5, y: -0.6 },
    ],
    arc((70 * Math.PI) / 180, (-45 * Math.PI) / 180, 9, 0.5, 0.56, 0.2, 0),
  ],
  hammer: () => [
    [
      { x: 0.3, y: -0.86 },
      { x: 0.3, y: 0.86 },
    ],
    [
      { x: 0.66, y: -0.9 },
      { x: 0.66, y: 0.9 },
    ],
  ],
  bridge: () => [
    [
      { x: -0.82, y: 0.34 },
      { x: -0.82, y: -0.3 },
    ],
    [
      { x: 0.82, y: 0.34 },
      { x: 0.82, y: -0.3 },
    ],
  ],
  claw: () => [
    [
      { x: -0.6, y: -0.3 },
      { x: 0.1, y: -0.2 },
      { x: 0.16, y: 0.1 },
      { x: -0.5, y: 0.3 },
    ],
  ],
}

/**
 * The proportion each archetype wants, `along / across`. A stroke says how big
 * a construct is and which way it points; what it cannot say is that a glove is
 * nearly as tall as it is long. The fit blends the two — see
 * {@link constructOutline} — so a flat scribble still makes a glove-shaped
 * glove, and a long one still makes a long hammer.
 */
const naturalAspect: Record<ConstructArchetype, number> = {
  bubble: 1,
  shield: 1.15,
  cage: 1,
  glove: 1.15,
  hammer: 1.9,
  bridge: 2,
  claw: 1.25,
}

/** How much of the archetype's own proportion survives the stroke's. */
const ASPECT_BLEND = 0.65

export interface ConstructOutlineOptions {
  /** Scales the whole construct about the frame's centre. Default 1. */
  scale?: number
}

/**
 * The archetype, fitted to the stroke's own frame: scaled to its spans, turned
 * onto its principal axis, centred on its centroid. An archetype nobody knows
 * falls back to a bubble.
 */
export function constructOutline(
  archetype: ConstructArchetype,
  frame: StrokeFrame = neutralFrame(),
  options: ConstructOutlineOptions = {},
): Vec2[] {
  return constructOutlineFrom(
    (unitOutlines[archetype] ?? unitOutlines.bubble)(),
    frame,
    options,
    naturalAspect[archetype] ?? 1,
  )
}

/** The fit itself: unit points in the stroke's frame. */
function constructOutlineFrom(
  unit: readonly Vec2[],
  frame: StrokeFrame,
  { scale = 1 }: ConstructOutlineOptions = {},
  aspect = 1,
): Vec2[] {
  const zoom = Math.max(0.05, finite(scale, 1))
  const along = Math.max(12, finite(frame?.along, 80))
  // A stroke with no width — a straight line — still has to make a solid, and
  // the archetype's own proportion gets most of the say in how wide it is.
  const wanted = along / Math.max(0.2, aspect)
  const drawn = Math.max(along * 0.3, finite(frame?.across, 80))
  const across = Math.max(12, wanted * ASPECT_BLEND + drawn * (1 - ASPECT_BLEND))
  const halfAlong = (along / 2) * zoom
  const halfAcross = (across / 2) * zoom
  const radians = (finite(frame?.angle, 0) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = finite(frame?.center?.x, 0)
  const cy = finite(frame?.center?.y, 0)

  return unit.map((p) => {
    const x = p.x * halfAlong
    const y = p.y * halfAcross
    return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos }
  })
}

/**
 * The seams inside a construct, fitted to the same frame as its outline: the
 * cuff of a glove, the piers of a bridge, the bars of a cage. Drawing, not
 * solution — they are what makes an archetype legible at a glance.
 */
export function constructDetail(
  archetype: ConstructArchetype,
  frame: StrokeFrame = neutralFrame(),
  options: ConstructOutlineOptions = {},
): Vec2[][] {
  const seams = (unitDetails[archetype] ?? unitDetails.bubble)()
  // Each seam rides the same transform the outline does, so it cannot drift.
  return seams.map((seam) =>
    constructOutlineFrom(seam, frame, options, naturalAspect[archetype] ?? 1),
  )
}

/* -------------------------------------------------------------------------- */
/* the fill                                                                    */
/* -------------------------------------------------------------------------- */

export interface ConstructLatticeOptions {
  /** Distance between fill lines, in picture units. */
  spacing: number
  /** The rake of the fill, in degrees. */
  angle?: number
}

/**
 * The fill lines of a construct: every span is the real intersection of the
 * outline with a line at `angle`, so the hatch follows the shape. A spacing
 * that could not terminate returns nothing rather than looping.
 */
export function constructLattice(
  outline: Vec2Stroke,
  { spacing, angle = 0 }: ConstructLatticeOptions,
): [Vec2, Vec2][] {
  const list = (Array.isArray(outline) ? outline : []).filter(isFinitePoint)
  const step = finite(spacing, 0)
  if (list.length < 3 || step <= 1e-3) return []

  const radians = (finite(angle, 0) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  // Into the rake's own frame, where every fill line is horizontal.
  const local = list.map((p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos }))
  const ys = local.map((p) => p.y)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const rows = Math.floor((max - min) / step)
  if (!Number.isFinite(rows) || rows < 1 || rows > 400) return []

  const out: [Vec2, Vec2][] = []
  for (let row = 1; row <= rows; row += 1) {
    const y = min + row * step
    const crossings: number[] = []
    for (let i = 0; i < local.length; i += 1) {
      const a = local[i]
      const b = local[(i + 1) % local.length]
      if (a.y === b.y) continue
      const lo = Math.min(a.y, b.y)
      const hi = Math.max(a.y, b.y)
      if (y < lo || y >= hi) continue
      crossings.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    crossings.sort((p, q) => p - q)
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const x0 = crossings[i]
      const x1 = crossings[i + 1]
      if (x1 - x0 < 1e-6) continue
      out.push([
        { x: x0 * cos - y * sin, y: x0 * sin + y * cos },
        { x: x1 * cos - y * sin, y: x1 * sin + y * cos },
      ])
    }
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* what it costs, and how it arrives                                           */
/* -------------------------------------------------------------------------- */

/**
 * What holding this construct draws from the reserve, 0 to 1. Proportional to
 * the area it encloses — a wall costs what a wall costs.
 */
export function constructCost(outline: Vec2Stroke): number {
  const area = polygonArea(outline)
  if (!Number.isFinite(area) || area <= 0) return 0
  return clamp(area / COST_AREA, 0, 1)
}

/**
 * How solid a construct is at `age` seconds, over a life of `duration`: in
 * over the first fifth, held, then let go over the last third. Outside its own
 * life it is nothing at all, which is what makes it safe to leave on screen.
 */
export function constructSettle(age: number, duration: number): number {
  const life = Math.max(1e-3, finite(duration, 1))
  const t = finite(age, -1) / life
  if (!(t > 0) || t >= 1) return 0
  const smooth = (u: number) => u * u * (3 - 2 * u)
  if (t < 0.2) return smooth(t / 0.2)
  if (t > 0.7) return smooth(clamp((1 - t) / 0.3, 0, 1))
  return 1
}

/* -------------------------------------------------------------------------- */
/* the whole gesture                                                           */
/* -------------------------------------------------------------------------- */

export interface ForgeOptions {
  /** Force the archetype instead of classifying — the demo's archetype picker. */
  archetype?: ConstructArchetype
  /** Fill spacing. Default: a ninth of the stroke's long span. */
  spacing?: number
  /** Fill rake, in degrees, relative to the stroke's own axis. Default 34. */
  rake?: number
  /** Scales the construct about the stroke's centre. Default 1. */
  scale?: number
}

export interface ForgedConstruct extends StrokeVerdict {
  frame: StrokeFrame
  outline: Vec2[]
  lattice: [Vec2, Vec2][]
  /** What holding it draws from the reserve, 0 to 1. */
  cost: number
}

/** A pointer path, all the way to something drawable. */
export function forgeConstruct(
  points: Vec2Stroke,
  { archetype, spacing, rake = 34, scale = 1 }: ForgeOptions = {},
): ForgedConstruct {
  const frame = strokeFrame(points)
  const verdict = classifyStroke(frame)
  const chosen = archetype && unitOutlines[archetype] ? archetype : verdict.archetype
  const outline = constructOutline(chosen, frame, { scale })
  const gap = finite(spacing ?? 0, 0) > 0 ? (spacing as number) : Math.max(4, frame.along / 9)
  return {
    ...verdict,
    archetype: chosen,
    frame,
    outline,
    lattice: constructLattice(outline, { spacing: gap, angle: frame.angle + rake }),
    cost: constructCost(outline),
  }
}
