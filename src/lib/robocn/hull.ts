/**
 * hull-geometry — a plated body, and what happens when it lets go.
 *
 * Four things the set had no maths for:
 *
 * - **A tiling of a sphere into plates.** Equal-area latitude courses, each cut
 *   into equal longitudes, with the plate count per course tracking the cosine
 *   of the latitude so a polar plate is not a sliver. The areas sum to exactly
 *   one sphere, which is the whole point: a hull with a gap in it is not a hull.
 * - **A fracture front.** A body coming apart is not a body scaled up. The
 *   rupture is somewhere, and the plates nearest it let go first while the far
 *   side is still whole — so `progress` drives a front sweeping over the
 *   surface, and a plate's own travel starts when the front arrives.
 * - **Straight-line travel that never comes back.** A released plate moves off
 *   in one direction and keeps going. The direction is a blend of straight out
 *   and away from the rupture, and both of those have a non-negative component
 *   along the plate's own normal, which is what makes the distance from the
 *   centre monotone in `progress` however the blend is set.
 * - **A paraboloid, and its focus.** A dish focuses because of its shape. Here
 *   the shape is `z = r²/(4f)` and the focus is `r²/(4d)` from the vertex, so a
 *   ray parallel to the axis reflected at *any* point on the surface passes
 *   through it. The emitters converge because the surface does.
 *
 * Latitude and longitude are degrees, and directions are unit vectors in the
 * body's own frame with the pole on `y` — the same convention
 * `celestial-geometry` uses, so a component hands these straight to
 * `surfacePoint` and the plating turns with the body for free.
 *
 * There is no structural model here, no mass, no energy and no collision: the
 * plates pass through each other's paths because nothing is stopping them, and
 * `progress` runs backwards as happily as forwards. Design note:
 * docs/battle-station.md.
 */

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"

const DEG = Math.PI / 180
const TAU = Math.PI * 2

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const unit3 = (v: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 => {
  const x = finite(v?.x, 0)
  const y = finite(v?.y, 0)
  const z = finite(v?.z, 0)
  const length = Math.hypot(x, y, z)
  return length > 1e-12 ? { x: x / length, y: y / length, z: z / length } : { ...fallback }
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

/** The unit direction at a latitude and longitude, pole on `y`. */
export function direction(latitude: number, longitude: number): Vec3 {
  const lat = clamp(finite(latitude, 0), -90, 90) * DEG
  const lon = finite(longitude, 0) * DEG
  const ring = Math.cos(lat)
  return { x: ring * Math.cos(lon), y: Math.sin(lat), z: ring * Math.sin(lon) }
}

/* -------------------------------------------------------------------------- */
/* the plating                                                                 */
/* -------------------------------------------------------------------------- */

/** One armour plate: the patch of hull between two parallels and two meridians. */
export interface HullPlate {
  index: number
  /** Which course it belongs to, counted from the south pole. */
  course: number
  /** Where it sits in its own course. */
  seat: number
  /** Degrees: the parallels bounding it. */
  south: number
  north: number
  /** Degrees: the meridians bounding it. `east` is always greater than `west`. */
  west: number
  east: number
  /** Degrees: the centre of the plate, by area on the course and by longitude. */
  latitude: number
  longitude: number
  /** The fraction of the whole sphere this plate covers. They sum to exactly 1. */
  area: number
}

export interface HullOptions {
  /**
   * Plates round the equator. Every other course gets that number scaled by the
   * cosine of its own latitude, so the plates stay about square.
   */
  perCourse?: number
  /** Degrees the whole pattern is turned about the pole, so seams can be aimed. */
  offset?: number
}

/** The most plates the tiling will build, so a caller cannot ask for a million. */
export const MAX_PLATES = 900

/**
 * The tiling. Courses are cut by **equal area** — `sin(latitude)` stepped
 * uniformly from pole to pole — so every course is exactly `1/courses` of the
 * sphere whatever the count, and dividing it into equal longitudes gives plates
 * whose areas sum to exactly one sphere.
 *
 * That sum is the invariant the tests hold this to, and it is the reason the
 * courses are not stepped in latitude: equal *angles* would make the polar
 * courses a fraction of the equatorial ones and the plate count would have
 * nothing honest to track.
 */
export function hullPlates(courses: number, options: HullOptions = {}): HullPlate[] {
  const bands = Math.round(clamp(finite(courses, 6), 1, 40))
  const equator = Math.round(clamp(finite(options.perCourse ?? 10, 10), 1, 64))
  const turn = finite(options.offset ?? 0, 0)
  const plates: HullPlate[] = []
  let index = 0

  for (let course = 0; course < bands; course++) {
    // Equal area: the band between these two sines is exactly 1/bands of the
    // sphere, because the area of a zone depends only on its height.
    const sinSouth = -1 + (2 * course) / bands
    const sinNorth = -1 + (2 * (course + 1)) / bands
    const south = (Math.asin(clamp(sinSouth, -1, 1)) * 180) / Math.PI
    const north = (Math.asin(clamp(sinNorth, -1, 1)) * 180) / Math.PI
    // The latitude that halves the band's own area, not its angular span.
    const latitude = (Math.asin(clamp((sinSouth + sinNorth) / 2, -1, 1)) * 180) / Math.PI
    // Plates stay about square: a course's circumference goes with the cosine.
    const seats = Math.max(1, Math.round(equator * Math.cos(latitude * DEG)))
    const span = 360 / seats
    for (let seat = 0; seat < seats; seat++) {
      if (index >= MAX_PLATES) return plates
      const west = turn + seat * span
      plates.push({
        index: index++,
        course,
        seat,
        south,
        north,
        west,
        east: west + span,
        latitude,
        longitude: west + span / 2,
        area: 1 / (bands * seats),
      })
    }
  }
  return plates
}

/** The unit direction of a plate's centre: where it sits on the intact hull. */
export const plateNormal = (plate: HullPlate): Vec3 =>
  direction(plate?.latitude ?? 0, plate?.longitude ?? 0)

/**
 * A plate's boundary, as latitude/longitude pairs: along the south parallel
 * west to east, up the east meridian, back along the north, down the west.
 *
 * `steps` per edge, because a parallel is a curve on the body and a straight
 * line between its ends would cut the corner — visibly, on a wide plate.
 */
export function plateOutline(
  plate: HullPlate,
  steps = 4,
): { latitude: number; longitude: number }[] {
  const count = Math.max(1, Math.round(finite(steps, 4)))
  const south = finite(plate?.south, 0)
  const north = finite(plate?.north, 0)
  const west = finite(plate?.west, 0)
  const east = finite(plate?.east, 0)
  const ring: { latitude: number; longitude: number }[] = []
  for (let step = 0; step < count; step++) {
    ring.push({ latitude: south, longitude: west + ((east - west) * step) / count })
  }
  for (let step = 0; step < count; step++) {
    ring.push({ latitude: south + ((north - south) * step) / count, longitude: east })
  }
  for (let step = 0; step < count; step++) {
    ring.push({ latitude: north, longitude: east - ((east - west) * step) / count })
  }
  for (let step = 0; step < count; step++) {
    ring.push({ latitude: north - ((north - south) * step) / count, longitude: west })
  }
  return ring
}

/* -------------------------------------------------------------------------- */
/* the breakup                                                                 */
/* -------------------------------------------------------------------------- */

export interface BurstOptions {
  /** Where the hull ruptures, as a direction in the body's own frame. */
  origin?: Vec3
  /** How far a plate travels by the end, in radii. Clamped 0–40. */
  spread?: number
  /**
   * 0 sends every plate straight out from the centre; 1 sends it away from the
   * rupture point. Both are outward, which is what keeps the travel monotone.
   */
  focus?: number
  /** Degrees a plate turns by the end. Clamped 0–3600. */
  tumble?: number
  /**
   * How much of the burst the front takes to cross the body, 0 to 1. At 0 every
   * plate lets go at once; at 1 the far side only starts as the burst ends.
   */
  front?: number
  /** Any integer. The same seed is the same breakup, every render. */
  seed?: number
}

export interface PlateBurst {
  /** 0 until the front reaches this plate, 1 by the end of the burst. */
  release: number
  /**
   * The plate's centre in radii: exactly `plateNormal` at rest, and never
   * closer to the origin than that at any later progress.
   */
  offset: Vec3
  /** How far the centre is from the body's own centre, in radii. 1 at rest. */
  distance: number
  /** Degrees the plate has turned about its own axis. */
  spin: number
  /** That axis, unit, and fixed for the plate. */
  axis: Vec3
}

/** Deterministic per-plate jitter: the same plate is the same fragment always. */
function scatter(index: number, seed: number, salt: number) {
  let state = ((Math.round(index) + 1) * 73856093) ^ ((Math.round(seed) + 1) * 19349663) ^ (salt * 83492791)
  state = (state ^ (state >>> 13)) >>> 0
  state = Math.imul(state, 1274126177) >>> 0
  return ((state ^ (state >>> 16)) >>> 0) / 4294967296
}

/**
 * Where one plate is, `progress` of the way through the burst.
 *
 * The front is the mechanism. A plate's angular distance from the rupture sets
 * when it lets go; after that it travels in a straight line, so the hull peels
 * open from one point rather than inflating. And because both candidate travel
 * directions — straight out, and away from the rupture — have a non-negative
 * component along the plate's own normal, `|offset|² = 1 + 2s(v·n) + s²` is
 * monotone in the travel `s`, so nothing ever moves back in.
 */
export function burst(
  plate: HullPlate,
  progress: number,
  options: BurstOptions = {},
): PlateBurst {
  const rest = plateNormal(plate)
  const index = Math.round(finite(plate?.index, 0))
  const seed = Math.round(finite(options.seed ?? 1, 1))
  const t = clamp(finite(progress, 0), 0, 1)
  const spread = clamp(finite(options.spread ?? 1.6, 1.6), 0, 40)
  const blend = clamp(finite(options.focus ?? 0.45, 0.45), 0, 1)
  const twist = clamp(finite(options.tumble ?? 240, 240), 0, 3600)
  const width = clamp(finite(options.front ?? 0.6, 0.6), 0, 1)
  const origin = unit3(options.origin ?? { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -1 })

  // When the front gets here: 0 at the rupture, `width` at the far side.
  const arrival = (Math.acos(clamp(dot(rest, origin), -1, 1)) / Math.PI) * width
  const release = t <= arrival ? 0 : (t - arrival) / Math.max(1e-6, 1 - arrival)

  // Away from the rupture point. Degenerate exactly at it, where straight out
  // is the same answer anyway.
  const away = unit3(
    { x: rest.x - origin.x, y: rest.y - origin.y, z: rest.z - origin.z },
    rest,
  )
  const travelDirection = unit3(
    {
      x: rest.x * (1 - blend) + away.x * blend,
      y: rest.y * (1 - blend) + away.y * blend,
      z: rest.z * (1 - blend) + away.z * blend,
    },
    rest,
  )
  // Not one expanding shell: each plate gets its own share of the speed.
  const kick = 0.55 + scatter(index, seed, 1) * 0.9
  const travel = release * spread * kick
  const offset = {
    x: rest.x + travelDirection.x * travel,
    y: rest.y + travelDirection.y * travel,
    z: rest.z + travelDirection.z * travel,
  }

  const spinAxis = unit3(
    {
      x: scatter(index, seed, 2) - 0.5,
      y: scatter(index, seed, 3) - 0.5,
      z: scatter(index, seed, 4) - 0.5,
    },
    cross3(rest, { x: 0, y: 1, z: 0 }),
  )
  return {
    release,
    offset,
    distance: Math.hypot(offset.x, offset.y, offset.z),
    spin: release * twist * (0.4 + scatter(index, seed, 5) * 1.2) * (scatter(index, seed, 6) < 0.5 ? -1 : 1),
    axis: spinAxis,
  }
}

/**
 * A real circle of radius `radius` in the plane through `centre` normal to
 * `axis`. Every point is exactly `radius` from the centre and square to the
 * axis, so the shock front projects to an ellipse without anything drawing one.
 */
export function shockRing(
  centre: Vec3,
  axis: Vec3,
  radius: number,
  steps = 48,
): Vec3[] {
  const count = Math.max(3, Math.round(finite(steps, 48)))
  const r = Math.max(0, finite(radius, 0))
  const normal = unit3(axis, { x: 0, y: 0, z: -1 })
  const reference: Vec3 =
    Math.abs(normal.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const a = unit3(cross3(reference, normal), { x: 1, y: 0, z: 0 })
  const b = cross3(normal, a)
  const cx = finite(centre?.x, 0)
  const cy = finite(centre?.y, 0)
  const cz = finite(centre?.z, 0)
  return Array.from({ length: count }, (_, step) => {
    const angle = (step / count) * TAU
    const ca = Math.cos(angle) * r
    const cb = Math.sin(angle) * r
    return { x: cx + a.x * ca + b.x * cb, y: cy + a.y * ca + b.y * cb, z: cz + a.z * ca + b.z * cb }
  })
}

/* -------------------------------------------------------------------------- */
/* the dish                                                                    */
/* -------------------------------------------------------------------------- */

/** A paraboloid bowl, from its rim radius and how deep it is at the axis. */
export interface DishSurface {
  radius: number
  depth: number
  /** `r² / 4d`, measured from the vertex along the axis. */
  focus: number
}

export function dish(radius: number, depth: number): DishSurface {
  const r = Math.max(1e-6, Math.abs(finite(radius, 1)))
  const d = Math.max(1e-6, Math.abs(finite(depth, 0.25)))
  return { radius: r, depth: d, focus: (r * r) / (4 * d) }
}

/**
 * A point on the bowl at a fraction `u` of the way out to the rim, in the
 * bowl's own axial plane: `x` out from the axis, `y` along it from the vertex.
 */
export function dishProfile(surface: DishSurface, u: number): Vec2 {
  const f = Math.max(1e-9, finite(surface?.focus, 1))
  const r = clamp(finite(u, 0), -1, 1) * Math.max(0, finite(surface?.radius, 1))
  return { x: r, y: (r * r) / (4 * f) }
}

/**
 * The outward unit normal on that bowl, in the same plane — outward meaning
 * away from the concave side, which is the side the focus is on.
 *
 * This is the function the whole dish rests on: reflecting an incoming ray
 * about it at *any* `u` sends the ray through the focus, which is why the
 * emitter rays in a drawing can be solved rather than aimed by hand.
 */
export function dishNormal(surface: DishSurface, u: number): Vec2 {
  const f = Math.max(1e-9, finite(surface?.focus, 1))
  const r = clamp(finite(u, 0), -1, 1) * Math.max(0, finite(surface?.radius, 1))
  // Surface y = r²/4f, so the upward normal is (−r/2f, 1), normalised.
  const nx = -r / (2 * f)
  const length = Math.hypot(nx, 1)
  return { x: nx / length, y: 1 / length }
}

/** Where the focus sits in that same axial plane. */
export const dishFocalPoint = (surface: DishSurface): Vec2 => ({
  x: 0,
  y: Math.max(1e-9, finite(surface?.focus, 1)),
})
