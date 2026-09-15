/**
 * sport-geometry — the kit a game is played with.
 *
 * Every ball in this family is the same sphere. What separates them is which
 * equation owns the frame, and each object here gets exactly one: a Magnus term
 * for the pitched ball, a restitution ladder for the bounced one, rolling
 * without slipping for the kicked one, Coulomb friction for the puck, and the
 * bat-ball collision for the thing that hits them. All five are closed forms
 * sampled at a clock rather than integrators, so a component can ask for any
 * instant without having run the ones before it.
 *
 * The markings are *on the surface*. A seam painted on a drawing is a lie the
 * moment the ball turns, so every mark here is a direction on the unit sphere
 * carried through the same rotation as the body, and it carries the sign of its
 * own normal against the camera. The baseball seam is worth the algebra:
 *
 *     x = a·cos t + b·cos 3t,  y = a·sin t − b·sin 3t,  z = 2√(ab)·sin 2t
 *
 * expand `x² + y² + z²` and the `cos 4t` terms cancel exactly when `c² = 4ab`,
 * leaving `(a + b)²`. So the figure-eight lies on a sphere for every `t` at
 * every shape ratio — a proof rather than a tolerance, and it is the test.
 *
 * What is not here: **air**. No drag, no spin decay, no lift coefficient that
 * varies with anything. A curve is a constant-acceleration approximation of a
 * flight that really is not one. Contact is a coefficient, not a deformation —
 * `contactSquash` is illustration, and says so where it is used. There is no
 * rule, no clock and no opponent.
 *
 * Lengths are in whatever units the caller draws in; `gravity` is in those
 * units per second squared, and the defaults are picked so a ball dropped from
 * `drop = 1` behaves like a real one at metre scale. Angles are degrees on the
 * surface and radians inside.
 */

import {
  clamp,
  convexHull2,
  lerp,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/** A length: finite, and never zero or negative. */
const span = (value: number | undefined, fallback: number) =>
  Math.max(1e-6, Math.abs(finite(value, fallback)))

const frac = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const unit = (v: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length < 1e-9
    ? fallback
    : { x: v.x / length, y: v.y / length, z: v.z / length }
}

const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

const safe3 = (v: Partial<Vec3> | undefined, fallback: Vec3): Vec3 => ({
  x: finite(v?.x, fallback.x),
  y: finite(v?.y, fallback.y),
  z: finite(v?.z, fallback.z),
})

/* -------------------------------------------------------------------------- */
/* orientation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A body's own axes in world space — the three columns of its rotation. A
 * direction `q` on the unit sphere sits at `q.x·u + q.y·v + q.z·w`, which is
 * all any of the markings need.
 */
export interface SurfaceFrame {
  u: Vec3
  v: Vec3
  w: Vec3
}

export const identityFrame: SurfaceFrame = {
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 1, z: 0 },
  w: { x: 0, y: 0, z: 1 },
}

/** Rotate `p` about the unit axis `k` by `degrees` — Rodrigues, written out. */
function turnAbout(p: Vec3, k: Vec3, degrees: number): Vec3 {
  const a = toRadians(finite(degrees, 0))
  const c = Math.cos(a)
  const s = Math.sin(a)
  const kp = cross(k, p)
  const kd = dot(k, p) * (1 - c)
  return {
    x: p.x * c + kp.x * s + k.x * kd,
    y: p.y * c + kp.y * s + k.y * kd,
    z: p.z * c + kp.z * s + k.z * kd,
  }
}

/**
 * The frame a body reaches after `turns` revolutions about `axis`. `turns` is
 * revolutions rather than degrees because that is what a spin rate gives you
 * once it has been multiplied by a clock.
 */
export function spinFrame(
  axis: Partial<Vec3> | undefined,
  turns: number,
  base: SurfaceFrame = identityFrame,
): SurfaceFrame {
  const k = unit(safe3(axis, { x: 0, y: 1, z: 0 }), { x: 0, y: 1, z: 0 })
  const degrees = finite(turns, 0) * 360
  return {
    u: turnAbout(base.u, k, degrees),
    v: turnAbout(base.v, k, degrees),
    w: turnAbout(base.w, k, degrees),
  }
}

/** `outer` applied after `inner`, so the body tilts and then spins in its tilt. */
export function composeFrames(outer: SurfaceFrame, inner: SurfaceFrame): SurfaceFrame {
  const map = (q: Vec3) =>
    add(add(scale(outer.u, q.x), scale(outer.v, q.y)), scale(outer.w, q.z))
  return { u: map(inner.u), v: map(inner.v), w: map(inner.w) }
}

/** A direction on the unit sphere carried into world space by a frame. */
export function applyFrame(frame: SurfaceFrame, q: Vec3): Vec3 {
  const d = safe3(q, { x: 0, y: 1, z: 0 })
  return add(add(scale(frame.u, d.x), scale(frame.v, d.y)), scale(frame.w, d.z))
}

/** Degrees off the equator and round it, as a unit direction. */
export function fromLatLon(lat: number, lon: number): Vec3 {
  const phi = toRadians(clamp(finite(lat, 0), -90, 90))
  const theta = toRadians(finite(lon, 0))
  const ring = Math.cos(phi)
  return { x: ring * Math.cos(theta), y: Math.sin(phi), z: ring * Math.sin(theta) }
}

/* -------------------------------------------------------------------------- */
/* the sphere and its markings                                                 */
/* -------------------------------------------------------------------------- */

/** A point on a surface with the sign of its own visibility. */
export interface SurfaceMark {
  point: Vec3
  /** Positive when the camera can see this bit of skin. */
  facing: number
}

/**
 * The silhouette of a sphere, exactly: the great circle perpendicular to the
 * view. Unlike an ellipsoid it needs no frame — a sphere looks the same from
 * everywhere, which is the whole reason the seams have to do the work.
 */
export function sphereSilhouette(radius: number, viewDir: Vec3, steps = 48): Vec3[] {
  const r = span(radius, 1)
  const d = unit(safe3(viewDir, { x: 0, y: 0, z: 1 }), { x: 0, y: 0, z: 1 })
  const seed: Vec3 = Math.abs(d.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const e1 = unit(cross(d, seed))
  const e2 = unit(cross(d, e1))
  const count = Math.max(8, Math.round(finite(steps, 48)))
  return Array.from({ length: count }, (_, index) => {
    const a = (index / count) * Math.PI * 2
    return add(scale(e1, r * Math.cos(a)), scale(e2, r * Math.sin(a)))
  })
}

/**
 * A curve of unit directions carried onto a ball of `radius`, each point
 * carrying `dot(normal, view)` — and on a sphere the outward normal *is* the
 * direction, so visibility is the same dot product that placed the point.
 */
export function surfaceCurve(
  frame: SurfaceFrame,
  radius: number,
  directions: readonly Vec3[],
  viewDir: Vec3,
): SurfaceMark[] {
  const r = span(radius, 1)
  const view = unit(safe3(viewDir, { x: 0, y: 0, z: 1 }), { x: 0, y: 0, z: 1 })
  return directions.map((q) => {
    const normal = applyFrame(frame, q)
    return { point: scale(normal, r), facing: dot(normal, view) }
  })
}

/**
 * The runs of a curve the camera can actually see. A ring round a ball is
 * visible over an arc, not everywhere, and splitting it into runs is what keeps
 * the far half off the drawing rather than painted over the near one.
 */
export function visibleRuns(marks: readonly SurfaceMark[], closed = true): SurfaceMark[][] {
  const runs: SurfaceMark[][] = []
  let current: SurfaceMark[] = []
  const count = marks.length
  for (let index = 0; index < count; index += 1) {
    const mark = marks[index]
    if (mark.facing > 0) current.push(mark)
    else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)
  if (closed && runs.length === 1 && runs[0].length === count && count > 2) {
    // Nothing is hidden: the ring is a complete circle, so close it.
    return [[...runs[0], runs[0][0]]]
  }
  if (closed && runs.length > 1 && marks[0]?.facing > 0 && marks[count - 1]?.facing > 0) {
    const first = runs.shift()
    runs[runs.length - 1] = [...runs[runs.length - 1], ...(first ?? [])]
  }
  return runs.filter((run) => run.length > 1)
}

/**
 * A direction pulled onto the limb if it has gone round the back. Used to clip
 * a panel that straddles the horizon: the part of it the camera cannot see
 * collapses onto the outline instead of folding across the ball.
 */
export function clipToLimb(direction: Vec3, viewDir: Vec3): Vec3 {
  const view = unit(safe3(viewDir, { x: 0, y: 0, z: 1 }), { x: 0, y: 0, z: 1 })
  const q = unit(safe3(direction, { x: 0, y: 1, z: 0 }))
  const behind = dot(q, view)
  if (behind >= 0) return q
  return unit({
    x: q.x - view.x * behind,
    y: q.y - view.y * behind,
    z: q.z - view.z * behind,
  }, q)
}

/* -------------------------------------------------------------------------- */
/* the seams                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The baseball seam: one closed figure-eight that lies exactly on the unit
 * sphere. `shape` is the share of the radius the third harmonic takes — 0 is a
 * plain great circle and 0.5 is the deepest possible excursion.
 */
export function baseballSeam(shape = 0.28, steps = 128): Vec3[] {
  const k = clamp(finite(shape, 0.28), 0, 0.5)
  const a = 1 - k
  const b = k
  const c = 2 * Math.sqrt(a * b)
  const count = Math.max(24, Math.round(finite(steps, 128)))
  return Array.from({ length: count }, (_, index) => {
    const t = (index / count) * Math.PI * 2
    return {
      x: a * Math.cos(t) + b * Math.cos(3 * t),
      y: c * Math.sin(2 * t),
      z: a * Math.sin(t) - b * Math.sin(3 * t),
    }
  })
}

/**
 * The basketball's three closed curves. Two orthogonal great circles cut the
 * sphere into four lunes; the wavy one — `lat = amplitude·sin(2·lon)` — enters
 * each lune on one meridian and leaves on the other, splitting it. Four lunes,
 * eight panels, out of three curves.
 */
export function basketballSeams(amplitude = 30, steps = 72): Vec3[][] {
  const swing = clamp(finite(amplitude, 30), 0, 80)
  const count = Math.max(16, Math.round(finite(steps, 72)))
  const ring = (project: (angle: number) => Vec3) =>
    Array.from({ length: count }, (_, index) => project((index / count) * 360))
  return [
    ring((lon) => fromLatLon(0, lon)),
    ring((lon) => ({ x: Math.cos(toRadians(lon)), y: Math.sin(toRadians(lon)), z: 0 })),
    ring((lon) => fromLatLon(swing * Math.sin(toRadians(2 * lon)), lon)),
  ]
}

/** One face of a panelled ball, as unit directions with its own centre. */
export interface SpherePanel {
  kind: "pentagon" | "hexagon"
  vertices: Vec3[]
  centre: Vec3
}

const PHI = (1 + Math.sqrt(5)) / 2

/** The twelve icosahedron vertices these coordinates give, edge length 2. */
function icosahedronVertices(): Vec3[] {
  const out: Vec3[] = []
  for (const s of [1, -1]) {
    for (const t of [1, -1]) {
      out.push({ x: 0, y: s, z: t * PHI })
      out.push({ x: s, y: t * PHI, z: 0 })
      out.push({ x: t * PHI, y: 0, z: s })
    }
  }
  return out
}

/** Vertices of one spherical polygon, wound the same way round its own centre. */
function windAround(points: readonly Vec3[]): Vec3[] {
  const centre = unit(points.reduce(add, { x: 0, y: 0, z: 0 }))
  const seed = unit({
    x: points[0].x - centre.x * dot(points[0], centre),
    y: points[0].y - centre.y * dot(points[0], centre),
    z: points[0].z - centre.z * dot(points[0], centre),
  })
  const other = cross(centre, seed)
  return [...points].sort(
    (p, q) =>
      Math.atan2(dot(p, other), dot(p, seed)) - Math.atan2(dot(q, other), dot(q, seed)),
  )
}

/** The great-circle arc between two unit directions, as `steps` chords. */
function arc(a: Vec3, b: Vec3, steps: number): Vec3[] {
  if (steps <= 1) return [a]
  return Array.from({ length: steps }, (_, index) =>
    unit({
      x: lerp(a.x, b.x, index / steps),
      y: lerp(a.y, b.y, index / steps),
      z: lerp(a.z, b.z, index / steps),
    }, a),
  )
}

/**
 * The soccer ball, built as a solid rather than drawn. Truncate a regular
 * icosahedron at exactly one third of every edge and all sixty vertices land
 * the same distance from the centre — the Archimedean truncated icosahedron,
 * twelve pentagons round the old vertices and twenty hexagons on the old faces.
 * Pushed out onto the unit sphere and subdivided along great circles, the
 * panels bulge the way an inflated one does.
 */
export function soccerPanels(detail = 3): SpherePanel[] {
  const steps = Math.max(1, Math.min(6, Math.round(finite(detail, 3))))
  const vertices = icosahedronVertices()
  const edge = 2
  const near = (a: Vec3, b: Vec3) =>
    Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - edge) < 1e-6
  const cut = (a: Vec3, b: Vec3): Vec3 =>
    unit({ x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3, z: a.z + (b.z - a.z) / 3 })

  const panels: SpherePanel[] = []
  const build = (kind: SpherePanel["kind"], corners: Vec3[]) => {
    const wound = windAround(corners)
    const outline = wound.flatMap((point, index) =>
      arc(point, wound[(index + 1) % wound.length], steps),
    )
    panels.push({ kind, vertices: outline, centre: unit(wound.reduce(add, { x: 0, y: 0, z: 0 })) })
  }

  // A pentagon per icosahedron vertex: the near truncation point of each of its
  // five edges.
  for (const v of vertices) {
    const corners = vertices.filter((other) => near(v, other)).map((other) => cut(v, other))
    if (corners.length === 5) build("pentagon", corners)
  }

  // A hexagon per icosahedron face: both truncation points of each of its three
  // edges. Faces are the triples that are mutually one edge apart.
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      if (!near(vertices[i], vertices[j])) continue
      for (let k = j + 1; k < vertices.length; k += 1) {
        if (!near(vertices[i], vertices[k]) || !near(vertices[j], vertices[k])) continue
        const [a, b, c] = [vertices[i], vertices[j], vertices[k]]
        build("hexagon", [cut(a, b), cut(b, a), cut(b, c), cut(c, b), cut(c, a), cut(a, c)])
      }
    }
  }

  return panels
}

/* -------------------------------------------------------------------------- */
/* the puck                                                                    */
/* -------------------------------------------------------------------------- */

/** A cylinder: how far across, and how far from the middle to each face. */
export interface PuckShape {
  radius: number
  halfHeight: number
}

export const defaultPuck: PuckShape = { radius: 12, halfHeight: 3.4 }

/**
 * One rim of the puck — `end` is `+1` for the face the axis points out of.
 * The axis is the frame's `v`, so an untouched frame stands the puck flat.
 */
export function puckRim(
  frame: SurfaceFrame,
  shape: Partial<PuckShape> = {},
  end = 1,
  steps = 40,
): Vec3[] {
  const r = span(shape.radius, defaultPuck.radius)
  const h = span(shape.halfHeight, defaultPuck.halfHeight) * (finite(end, 1) < 0 ? -1 : 1)
  const count = Math.max(8, Math.round(finite(steps, 40)))
  return Array.from({ length: count }, (_, index) => {
    const a = (index / count) * Math.PI * 2
    return add(
      scale(frame.v, h),
      add(scale(frame.u, r * Math.cos(a)), scale(frame.w, r * Math.sin(a))),
    )
  })
}

/**
 * The silhouette of a cylinder under any camera: the convex hull of its two
 * rims, projected. Exact face-on, edge-on and everywhere between, with nothing
 * special-cased — which is the only reason the puck gets a `view` at all.
 */
export function puckSilhouette(
  frame: SurfaceFrame,
  shape: Partial<PuckShape>,
  project: (point: Vec3) => Vec2,
  steps = 40,
): Vec2[] {
  const rims = [...puckRim(frame, shape, 1, steps), ...puckRim(frame, shape, -1, steps)]
  return convexHull2(rims.map(project))
}

/* -------------------------------------------------------------------------- */
/* bounce — the restitution ladder                                             */
/* -------------------------------------------------------------------------- */

export interface BounceOptions {
  /** Apex of the first fall, above the floor. */
  drop?: number
  /** Coefficient of restitution. Clamped below 1, or it never settles. */
  restitution?: number
  gravity?: number
  /** Width of the contact pulse, in seconds. Illustration, not physics. */
  contact?: number
}

export interface BounceState {
  height: number
  /** Signed: negative falling. */
  velocity: number
  /** Which flight this is — 0 is the first fall. */
  bounce: number
  /** 1 at an impact, falling to 0 over the contact window. Illustration. */
  contact: number
  /** Speed of the impact this contact pulse belongs to. */
  impact: number
  settled: boolean
}

const bounceParts = (options: BounceOptions) => {
  const drop = span(options.drop, 1)
  const gravity = span(options.gravity, 9.81)
  const restitution = clamp(finite(options.restitution, 0.76), 0, 0.985)
  // The first fall, and the speed it arrives with.
  const fall = Math.sqrt((2 * drop) / gravity)
  return { drop, gravity, restitution, fall, impact: gravity * fall }
}

/** How long a ball takes to stop bouncing: `t₀(1 + e)/(1 − e)`, exactly. */
export function bounceDuration(options: BounceOptions = {}): number {
  const { restitution, fall } = bounceParts(options)
  return (fall * (1 + restitution)) / (1 - restitution)
}

/**
 * Where a dropped ball is at `time`. Each flight is its own parabola and each
 * apex is the last one times `e²`, so the whole sequence is closed form: walk
 * the geometric ladder of flight times until `time` lands inside one. No
 * integration, no drift, and the same answer whether it is asked for the
 * hundredth frame or only the hundredth.
 */
export function bounceAt(time: number, options: BounceOptions = {}): BounceState {
  const { drop, gravity, restitution, fall, impact } = bounceParts(options)
  const window = Math.max(1e-4, Math.abs(finite(options.contact, 0.06)))
  const t = Math.max(0, finite(time, 0))
  const total = (fall * (1 + restitution)) / (1 - restitution)

  /** A triangular pulse either side of an impact. Illustration, not physics. */
  const pulse = (toImpact: number, speed: number) => ({
    contact: clamp(1 - Math.abs(toImpact) / window, 0, 1),
    impact: speed,
  })

  if (t >= total) {
    return { height: 0, velocity: 0, bounce: -1, contact: 0, impact: 0, settled: true }
  }
  if (t < fall) {
    return {
      height: drop - (gravity * t * t) / 2,
      velocity: -gravity * t,
      bounce: 0,
      // Released, not bounced: only the landing at the end of this fall counts.
      ...pulse(fall - t, impact),
      settled: false,
    }
  }

  let start = fall
  let speed = impact * restitution
  let index = 1
  // Each flight is shorter than the last by exactly `e`, so this terminates in
  // log terms — the ladder has already been proved finite by `total`.
  while (index < 512) {
    const duration = (2 * speed) / gravity
    if (t < start + duration) {
      const tau = t - start
      return {
        height: speed * tau - (gravity * tau * tau) / 2,
        velocity: speed - gravity * tau,
        bounce: index,
        // Both ends of a flight are an impact, so the squash builds into one
        // and releases out of the other.
        ...pulse(Math.min(tau, duration - tau), speed),
        settled: false,
      }
    }
    start += duration
    speed *= restitution
    index += 1
  }
  return { height: 0, velocity: 0, bounce: -1, contact: 0, impact: 0, settled: true }
}

export interface DribbleOptions {
  /** Apex of every bounce — a hand puts back exactly what the floor took. */
  apex?: number
  /** Where the paddle waits while the ball is away. */
  reach?: number
}

export interface DribbleState {
  height: number
  velocity: number
  contact: number
  /** Where the driving paddle is, so it meets the ball rather than chasing it. */
  paddle: number
}

/**
 * The periodic bounce: one arch per cycle of the clock. The energy the floor
 * takes is handed straight back, which is the one thing here that is *not*
 * physics — something is putting it in, and that something is illustrated.
 *
 * `height = 4·apex·u(1 − u)` is the exact constant-gravity parabola for a
 * flight that starts and lands on the floor, rewritten in cycles.
 */
export function dribbleAt(cycle: number, options: DribbleOptions = {}): DribbleState {
  const apex = span(options.apex, 1)
  const reach = span(options.reach, apex * 1.35)
  const u = frac(finite(cycle, 0))
  const height = 4 * apex * u * (1 - u)
  return {
    height,
    velocity: 4 * apex * (1 - 2 * u),
    contact: clamp(1 - Math.min(u, 1 - u) * 14, 0, 1),
    // The paddle rides down onto the ball at the top of the arch and pushes.
    paddle: Math.max(height, reach - (reach - apex) * Math.sin(Math.PI * u) ** 2),
  }
}

/**
 * The flattening a ball shows at contact. Illustration: a real ball's contact
 * patch comes out of its inflation pressure and the time it spends on the
 * floor, neither of which is modelled. This is impact speed against a
 * reference, so it reads as heavier when it hits harder.
 */
export function contactSquash(contact: number, impact: number, reference = 6, most = 0.22) {
  const share = clamp(finite(contact, 0), 0, 1)
  const hardness = clamp(Math.abs(finite(impact, 0)) / span(reference, 6), 0, 1)
  return clamp(share * hardness * Math.abs(finite(most, 0.22)), 0, 0.45)
}

/* -------------------------------------------------------------------------- */
/* flight — gravity plus a Magnus term                                         */
/* -------------------------------------------------------------------------- */

export type PitchName = "fastball" | "curveball" | "slider" | "sinker" | "knuckler"

export const pitchNames: readonly PitchName[] = [
  "fastball",
  "curveball",
  "slider",
  "sinker",
  "knuckler",
]

/** Spin rate in revolutions per second, and the axis it turns about. */
export interface PitchSpin {
  rate: number
  axis: Vec3
}

/**
 * What each pitch actually does to the ball. The axis is in flight
 * coordinates — `x` the batter's right, `y` up, `z` back toward the pitcher —
 * so backspin is `+x` and it lifts, topspin is `−x` and it dives.
 */
export function pitchSpin(pitch: PitchName): PitchSpin {
  switch (pitch) {
    case "curveball":
      // Topspin, tipped: the Magnus term points down, so it dives past gravity.
      return { rate: 42, axis: unit({ x: -1, y: -0.35, z: 0 }) }
    case "slider":
      // Nearly a gyroball — the axis stands up, so the break is sideways.
      return { rate: 42, axis: unit({ x: -0.25, y: -1, z: 0.35 }) }
    case "sinker":
      // Little backspin and a lot of run: it holds less of itself up.
      return { rate: 30, axis: unit({ x: 0.35, y: 0.9, z: 0 }) }
    case "knuckler":
      // Barely turning at all, so there is almost nothing to break it.
      return { rate: 0.6, axis: unit({ x: 0.3, y: 0.7, z: 0.4 }) }
    default:
      // Four-seam backspin: the Magnus term is up, and it is the biggest here.
      return { rate: 36, axis: unit({ x: 1, y: 0.15, z: 0 }) }
  }
}

export interface FlightOptions {
  /** Release speed, in the caller's units per second. */
  speed?: number
  /** Degrees above the horizontal at release. */
  launch?: number
  /** Degrees off the straight line downrange at release. */
  aim?: number
  spin?: PitchSpin
  gravity?: number
  /** Lift per unit of spin × speed. Folded into one number on purpose. */
  magnus?: number
  from?: Vec3
}

export interface FlightState {
  position: Vec3
  velocity: Vec3
  /** How far the ball has left the straight line it was thrown along. */
  break: number
  /** The turn count the ball has racked up, for the seams to follow. */
  turns: number
}

/**
 * A pitched ball. Downrange is `−z`, so a ball released at the origin arrives
 * at the plate at negative `z`, and the batter's right is `+x`.
 *
 * The honest bit: the Magnus acceleration is `(S/m)(ω × v)`, which changes as
 * the velocity does. Holding it at its release value makes the whole flight one
 * quadratic — exact for the model, and an approximation of a ball. Over the
 * sixty feet this is drawn at, the difference is smaller than the seam.
 */
export function flightAt(time: number, options: FlightOptions = {}): FlightState {
  const speed = span(options.speed, 40)
  const launch = toRadians(clamp(finite(options.launch, 0), -80, 80))
  const aim = toRadians(clamp(finite(options.aim, 0), -60, 60))
  const gravity = span(options.gravity, 9.81)
  const strength = Math.abs(finite(options.magnus, 0.0012))
  const spin = options.spin ?? pitchSpin("fastball")
  const rate = finite(spin.rate, 0)
  const axis = unit(safe3(spin.axis, { x: 1, y: 0, z: 0 }), { x: 1, y: 0, z: 0 })
  const from = safe3(options.from, { x: 0, y: 0, z: 0 })
  const t = Math.max(0, finite(time, 0))

  const velocity0: Vec3 = {
    x: speed * Math.cos(launch) * Math.sin(aim),
    y: speed * Math.sin(launch),
    z: -speed * Math.cos(launch) * Math.cos(aim),
  }
  // ω × v at release, held constant: the whole flight is then one quadratic.
  const lift = scale(cross(scale(axis, rate * Math.PI * 2), velocity0), strength)
  const acceleration: Vec3 = { x: lift.x, y: lift.y - gravity, z: lift.z }

  const position = add(add(from, scale(velocity0, t)), scale(acceleration, (t * t) / 2))
  const velocity = add(velocity0, scale(acceleration, t))
  // The straight line it would have flown, minus gravity, is the honest datum.
  const sideways = scale(lift, (t * t) / 2)
  return {
    position,
    velocity,
    break: Math.hypot(sideways.x, sideways.y, sideways.z),
    turns: rate * t,
  }
}

/** Rolling without slipping: the turn a wheel of `radius` makes over `distance`. */
export function rollTurns(distance: number, radius: number): number {
  return finite(distance, 0) / (2 * Math.PI * span(radius, 1))
}

/* -------------------------------------------------------------------------- */
/* the slide — Coulomb friction, and boards                                    */
/* -------------------------------------------------------------------------- */

export interface RinkBounds {
  halfWidth: number
  halfLength: number
}

export const defaultRink: RinkBounds = { halfWidth: 58, halfLength: 82 }

export interface SlideOptions {
  start?: Vec2
  /** Degrees clockwise from straight downrange, in the plan drawing. */
  heading?: number
  speed?: number
  /** Coefficient of friction between the puck and the ice. */
  friction?: number
  gravity?: number
  /** What the boards give back. */
  board?: number
  rink?: Partial<RinkBounds>
  bounces?: number
}

/** One straight run between boards: where it starts, how fast, how long. */
export interface SlideLeg {
  from: Vec2
  to: Vec2
  heading: number
  /** Speed entering this leg. */
  speed: number
  length: number
  /** Seconds this leg takes. */
  duration: number
  /** Seconds from the start of the slide to the start of this leg. */
  start: number
}

export interface SlideTrack {
  legs: SlideLeg[]
  /** Deceleration, `μg`, which is constant whatever the speed. */
  deceleration: number
  duration: number
  /** Total path length, which is the thing friction actually limits. */
  distance: number
}

const reflect = (point: Vec2, direction: Vec2, rink: RinkBounds) => {
  let best = Number.POSITIVE_INFINITY
  let normal: Vec2 = { x: 0, y: 0 }
  const test = (distance: number, axis: Vec2) => {
    if (distance > 1e-6 && distance < best) {
      best = distance
      normal = axis
    }
  }
  if (Math.abs(direction.x) > 1e-9) {
    test((rink.halfWidth - point.x) / direction.x, { x: 1, y: 0 })
    test((-rink.halfWidth - point.x) / direction.x, { x: 1, y: 0 })
  }
  if (Math.abs(direction.y) > 1e-9) {
    test((rink.halfLength - point.y) / direction.y, { x: 0, y: 1 })
    test((-rink.halfLength - point.y) / direction.y, { x: 0, y: 1 })
  }
  return { distance: Number.isFinite(best) ? best : 0, normal }
}

/**
 * The whole slide, solved once. Friction on ice is Coulomb — a *constant*
 * deceleration `μg` whatever the speed — so the distance a puck has left is
 * `v²/2μg` and nothing else. Hitting a board turns `v` into `e·v`, which turns
 * the distance left into `e²` of what it was, so each leg is exact in closed
 * form and there is nothing to integrate.
 */
export function slideTrack(options: SlideOptions = {}): SlideTrack {
  const rink: RinkBounds = {
    halfWidth: span(options.rink?.halfWidth, defaultRink.halfWidth),
    halfLength: span(options.rink?.halfLength, defaultRink.halfLength),
  }
  const deceleration = span(
    Math.abs(finite(options.friction, 0.05)) * span(options.gravity, 9.81),
    0.4,
  )
  const board = clamp(finite(options.board, 0.72), 0, 1)
  const limit = Math.max(0, Math.min(12, Math.round(finite(options.bounces, 3))))
  const heading = finite(options.heading, 0)

  let point: Vec2 = {
    x: clamp(finite(options.start?.x, 0), -rink.halfWidth, rink.halfWidth),
    y: clamp(finite(options.start?.y, 0), -rink.halfLength, rink.halfLength),
  }
  const radians = toRadians(heading)
  let direction: Vec2 = { x: Math.sin(radians), y: -Math.cos(radians) }
  let speed = span(options.speed, 30)
  let elapsed = 0

  const legs: SlideLeg[] = []
  for (let index = 0; index <= limit; index += 1) {
    const remaining = (speed * speed) / (2 * deceleration)
    const hit = reflect(point, direction, rink)
    const length = index < limit ? Math.min(remaining, hit.distance) : remaining
    const exit = Math.sqrt(Math.max(0, speed * speed - 2 * deceleration * length))
    const duration = (speed - exit) / deceleration
    const to: Vec2 = { x: point.x + direction.x * length, y: point.y + direction.y * length }
    legs.push({
      from: point,
      to,
      heading: (Math.atan2(direction.x, -direction.y) * 180) / Math.PI,
      speed,
      length,
      duration,
      start: elapsed,
    })
    elapsed += duration
    if (length >= remaining - 1e-9) break
    point = to
    // Specular off the board, and `e` off the speed with it.
    if (hit.normal.x) direction = { x: -direction.x, y: direction.y }
    else direction = { x: direction.x, y: -direction.y }
    speed = exit * board
    if (speed < 1e-4) break
  }

  return {
    legs,
    deceleration,
    duration: elapsed,
    distance: legs.reduce((sum, leg) => sum + leg.length, 0),
  }
}

export interface SlideState {
  point: Vec2
  heading: number
  speed: number
  /** Revolutions the puck has turned about its own axis. */
  turns: number
  stopped: boolean
}

/**
 * Where the puck is at `time`. `spin` is revolutions per second at release, and
 * it bleeds off *with* the speed because the ice takes both — which makes the
 * turns it has made proportional to the distance it has covered, boards and
 * all: `∫ (rate·v/v₀) dt = (rate/v₀)·s`.
 */
export function slideAt(track: SlideTrack, time: number, spin = 0.8): SlideState {
  const t = Math.max(0, finite(time, 0))
  const rate = finite(spin, 0)
  const legs = track.legs
  if (!legs.length) {
    return { point: { x: 0, y: 0 }, heading: 0, speed: 0, turns: 0, stopped: true }
  }
  const reference = Math.max(1e-6, legs[0].speed)
  let travelled = 0
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index]
    const last = index === legs.length - 1
    const tau = t - leg.start
    if (tau < leg.duration || last) {
      const held = clamp(tau, 0, leg.duration)
      const along = leg.speed * held - (track.deceleration * held * held) / 2
      const share = leg.length > 1e-9 ? along / leg.length : 0
      return {
        point: {
          x: lerp(leg.from.x, leg.to.x, share),
          y: lerp(leg.from.y, leg.to.y, share),
        },
        heading: leg.heading,
        speed: Math.max(0, leg.speed - track.deceleration * held),
        turns: (rate * (travelled + along)) / reference,
        stopped: last && tau >= leg.duration,
      }
    }
    travelled += leg.length
  }
  const last = legs[legs.length - 1]
  return {
    point: last.to,
    heading: last.heading,
    speed: 0,
    turns: (rate * track.distance) / reference,
    stopped: true,
  }
}

/* -------------------------------------------------------------------------- */
/* the bat — a collision, and why the sweet spot is where it is                */
/* -------------------------------------------------------------------------- */

export interface BatGeometry {
  /** Knob to tip. The swing pivots at the knob. */
  length: number
  /** Distance from the pivot to the bat's centre of mass. */
  centre: number
  mass: number
  /** Moment of inertia about the centre of mass. */
  moment: number
  /** Barrel radius at the tip, and at the handle. Drawing, not dynamics. */
  barrel: number
  handle: number
}

export const defaultBat: BatGeometry = {
  length: 86,
  centre: 56,
  mass: 0.9,
  moment: 380,
  barrel: 6.2,
  handle: 2.4,
}

/** The bat's half-width `s` of the way from the knob to the tip. */
export function barrelRadius(bat: Partial<BatGeometry>, s: number): number {
  const barrel = span(bat.barrel, defaultBat.barrel)
  const handle = span(bat.handle, defaultBat.handle)
  const at = clamp(finite(s, 0), 0, 1)
  // Knob, then a long thin handle, then the taper into the barrel.
  if (at < 0.06) return lerp(barrel * 0.62, handle, at / 0.06)
  if (at < 0.42) return handle * lerp(1, 1.12, (at - 0.06) / 0.36)
  const into = (at - 0.42) / 0.58
  return lerp(handle * 1.12, barrel, Math.sin((into * Math.PI) / 2))
}

/**
 * The mass the ball actually meets. A bat struck away from its centre of mass
 * gives, because the blow spins it as well as pushing it:
 *
 *     1/M = 1/m + d²/I
 *
 * with `d` the distance from the centre of mass to the contact. At the centre
 * of mass the whole bat resists; out at the tip almost none of it does.
 */
export function effectiveMass(bat: Partial<BatGeometry>, contact: number): number {
  const mass = span(bat.mass, defaultBat.mass)
  const moment = span(bat.moment, defaultBat.moment)
  const centre = span(bat.centre, defaultBat.centre)
  const d = finite(contact, centre) - centre
  return 1 / (1 / mass + (d * d) / moment)
}

export interface ImpactOptions {
  bat?: Partial<BatGeometry>
  /** Distance from the pivot to where the ball meets the bat. */
  contact?: number
  /** Revolutions per second the bat is turning through the zone. */
  swingRate?: number
  /** How fast the ball is coming in. Positive is toward the bat. */
  pitchSpeed?: number
  ballMass?: number
  restitution?: number
}

export interface ImpactResult {
  exitSpeed: number
  /** How fast the bat's surface was moving where the ball met it. */
  batSpeed: number
  effectiveMass: number
  /** Exit speed as a share of the best this swing could have done. */
  sweetness: number
}

const exitSpeedOf = (
  effective: number,
  ballMass: number,
  restitution: number,
  pitchSpeed: number,
  batSpeed: number,
) =>
  ((restitution * effective - ballMass) * pitchSpeed + effective * (1 + restitution) * batSpeed) /
  (effective + ballMass)

/**
 * The collision, which is the whole point of a bat:
 *
 *     v_out = ((e·M − m)·v_pitch + M(1 + e)·v_bat) / (M + m)
 *
 * Run it with `e = 1` and an infinite bat and it gives `v_pitch + 2·v_bat`,
 * which is the elastic wall every physics course starts with. The interesting
 * part is that `M` is *effective* mass and falls away from the centre of mass
 * while `v_bat = ω·r` climbs toward the tip — so the best contact is neither
 * end, and that is where the sweet spot comes from rather than being a number
 * someone typed.
 */
export function swingImpact(options: ImpactOptions = {}): ImpactResult {
  const bat = options.bat ?? defaultBat
  const length = span(bat.length, defaultBat.length)
  const contact = clamp(finite(options.contact, length * 0.78), 0, length)
  const swingRate = finite(options.swingRate, 5)
  const pitchSpeed = Math.max(0, finite(options.pitchSpeed, 38))
  const ballMass = span(options.ballMass, 0.145)
  const restitution = clamp(finite(options.restitution, 0.5), 0, 1)

  const omega = swingRate * Math.PI * 2
  const batSpeed = omega * contact
  const effective = effectiveMass(bat, contact)
  const exitSpeed = exitSpeedOf(effective, ballMass, restitution, pitchSpeed, batSpeed)
  const best = sweetSpot(options).exitSpeed
  return {
    exitSpeed,
    batSpeed,
    effectiveMass: effective,
    sweetness: best > 1e-6 ? clamp(exitSpeed / best, 0, 1) : 0,
  }
}

/**
 * Where on the barrel this swing does its best work — the contact that
 * maximises exit speed, found by sampling the barrel rather than by being
 * declared. Move the swing rate or the pitch and it moves, which is the point.
 */
export function sweetSpot(options: ImpactOptions = {}): { contact: number; exitSpeed: number } {
  const bat = options.bat ?? defaultBat
  const length = span(bat.length, defaultBat.length)
  const ballMass = span(options.ballMass, 0.145)
  const restitution = clamp(finite(options.restitution, 0.5), 0, 1)
  const omega = finite(options.swingRate, 5) * Math.PI * 2
  const pitchSpeed = Math.max(0, finite(options.pitchSpeed, 38))

  let bestContact = length * 0.78
  let bestSpeed = Number.NEGATIVE_INFINITY
  const steps = 96
  for (let index = 0; index <= steps; index += 1) {
    const contact = lerp(length * 0.25, length, index / steps)
    const speed = exitSpeedOf(
      effectiveMass(bat, contact),
      ballMass,
      restitution,
      pitchSpeed,
      omega * contact,
    )
    if (speed > bestSpeed) {
      bestSpeed = speed
      bestContact = contact
    }
  }
  return { contact: bestContact, exitSpeed: bestSpeed }
}

/**
 * The sweep of a swing, as a function of its own phase: a long load, a fast
 * pass through the zone, and a follow-through that slows. `contactAt` is the
 * phase the ball meets the bat, so the drawing and the impact agree about when.
 *
 * The phase is **clamped**, not wrapped — 1 is the end of the follow-through
 * rather than the start of the next load, which is what a caller holding the
 * swing at a value means. A caller running it off a clock wraps the clock.
 */
export function swingAngle(phase: number, from = -120, to = 96, contactAt = 0.52): number {
  const u = clamp(finite(phase, 0), 0, 1)
  const meet = clamp(finite(contactAt, 0.52), 0.08, 0.92)
  const start = finite(from, -120)
  const end = finite(to, 96)
  // Ease in hard over the load, then linear through the zone, then ease out.
  const shaped =
    u < meet
      ? (u / meet) ** 2.4 * 0.62
      : 0.62 + (1 - 0.62) * (1 - (1 - (u - meet) / (1 - meet)) ** 1.8)
  return lerp(start, end, shaped)
}
