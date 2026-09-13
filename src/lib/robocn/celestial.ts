/**
 * celestial-geometry — orbits, illumination and the shape of a body.
 *
 * Five things the set had no maths for:
 *
 * - **Kepler's equation**, solved properly, so a body on an ellipse runs at
 *   periapsis and loiters at apoapsis instead of sliding round at a constant
 *   rate. Everything an orrery does comes off that one root find.
 * - **The terminator**: the great circle where the light grazes a sphere.
 *   Projected, it is an ellipse whose eccentricity is the phase and whose
 *   sense flips at quarter — which is the bit hand-drawn crescents get wrong,
 *   and which nothing here has to draw because it falls out of the circle.
 * - **Illumination**, one number per surface point, zero exactly on the
 *   terminator, so craters and bands agree with the day-night line.
 * - **Limb darkening**, the real law rather than a gradient someone tuned.
 * - **An irregular body**: a radius field over direction, deterministic for a
 *   seed and continuous everywhere, so a lumpy body is a genuine solid whose
 *   silhouette changes as it turns.
 *
 * World axes are the set's: `x` starboard, `y` up, `z` toward the tail, with
 * machines facing `−z`. The reference plane for an orbit is the horizontal
 * `x–z` plane, so an orrery read from `plan` shows its ellipses true.
 *
 * There is no gravity here, no perturbation, no radiative transfer and no
 * ephemeris: the elements are the caller's and the bodies do not pull on each
 * other. Design note: docs/celestial-bodies.md.
 */

import { clamp, type Vec3 } from "@/lib/robocn/kinematics"

const TAU = Math.PI * 2
const DEG = Math.PI / 180

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

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

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

/* -------------------------------------------------------------------------- */
/* orbits                                                                      */
/* -------------------------------------------------------------------------- */

/** Where an orbit is, how eccentric, how tilted, and how long it takes. */
export interface OrbitalElements {
  /** Semi-major axis, in world units. */
  semiMajor: number
  /** 0 is a circle. Clamped below 1, because a parabola is not an orbit. */
  eccentricity?: number
  /** Degrees the orbit plane is tilted out of the horizontal. */
  inclination?: number
  /** Degrees: bearing of the line where the orbit crosses the horizontal. */
  node?: number
  /** Degrees from that line to periapsis, measured in the orbit plane. */
  periapsis?: number
  /** One revolution, in whatever unit `time` is counted in. */
  period?: number
  /** Mean anomaly at time zero, in degrees. */
  epoch?: number
}

/** The most eccentric orbit the solver is held to. */
export const MAX_ECCENTRICITY = 0.97

/**
 * Kepler's equation, `E − e·sin E = M`, for the eccentric anomaly.
 *
 * Safeguarded Newton: the root is always within `e` of `M`, so that bracket is
 * exact, and any step that leaves it is replaced by a bisection. Newton alone
 * wanders near periapsis on a very eccentric orbit; the bracket is what makes
 * this converge for every mean anomaly rather than most of them.
 */
export function solveKepler(meanAnomaly: number, eccentricity = 0): number {
  const e = clamp(finite(eccentricity, 0), 0, MAX_ECCENTRICITY)
  const m = finite(meanAnomaly, 0)
  // Fold into (−π, π]: the equation is odd and 2π-periodic in M.
  const turns = Math.floor((m + Math.PI) / TAU)
  const folded = m - turns * TAU
  if (e === 0) return folded + turns * TAU

  let low = folded - e
  let high = folded + e
  let value = folded + e * Math.sin(folded)
  for (let step = 0; step < 60; step++) {
    const residual = value - e * Math.sin(value) - folded
    if (Math.abs(residual) < 1e-14) break
    if (residual > 0) high = value
    else low = value
    const slope = 1 - e * Math.cos(value)
    const next = slope > 1e-12 ? value - residual / slope : (low + high) / 2
    value = next > low && next < high ? next : (low + high) / 2
  }
  return value + turns * TAU
}

/** Where a body is on its orbit, and how far out. */
export interface OrbitalState {
  position: Vec3
  /** Distance from the focus — the hub — in world units. */
  radius: number
  /** Degrees round the orbit from periapsis. */
  trueAnomaly: number
  /** Degrees; the root the rest of this came from. */
  eccentricAnomaly: number
}

/** The orbit plane's own axes: periapsis-ward, along it, and its normal. */
interface OrbitBasis {
  node: Vec3
  across: Vec3
  normal: Vec3
}

function orbitBasis(inclination: number, node: number): OrbitBasis {
  const n = finite(node, 0) * DEG
  const i = finite(inclination, 0) * DEG
  // The node line, in the horizontal plane, on the set's azimuth convention.
  const line: Vec3 = { x: Math.sin(n), y: 0, z: -Math.cos(n) }
  const level: Vec3 = { x: Math.cos(n), y: 0, z: Math.sin(n) }
  const across: Vec3 = {
    x: level.x * Math.cos(i),
    y: Math.sin(i),
    z: level.z * Math.cos(i),
  }
  return { node: line, across, normal: cross3(line, across) }
}

/**
 * The body at `time`, in world units, with the **focus at the origin** — which
 * is the thing an orrery has to get right: the hub is where the star is, not
 * at the centre of the ellipse.
 */
export function orbitalState(elements: OrbitalElements, time = 0): OrbitalState {
  const a = Math.max(0, finite(elements?.semiMajor, 1))
  const e = clamp(finite(elements?.eccentricity ?? 0, 0), 0, MAX_ECCENTRICITY)
  const period = finite(elements?.period ?? 1, 1) || 1
  const epoch = finite(elements?.epoch ?? 0, 0)
  const argument = finite(elements?.periapsis ?? 0, 0)
  const mean = (epoch + (360 * finite(time, 0)) / period) * DEG
  const eccentric = solveKepler(mean, e)
  const radius = a * (1 - e * Math.cos(eccentric))
  // Half-angle form: stable at every anomaly, unlike acos of the cosine.
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(eccentric / 2),
      Math.sqrt(1 - e) * Math.cos(eccentric / 2),
    )
  const basis = orbitBasis(elements?.inclination ?? 0, elements?.node ?? 0)
  const u = argument * DEG + trueAnomaly
  const cu = Math.cos(u)
  const su = Math.sin(u)
  return {
    position: {
      x: radius * (basis.node.x * cu + basis.across.x * su),
      y: radius * (basis.node.y * cu + basis.across.y * su),
      z: radius * (basis.node.z * cu + basis.across.z * su),
    },
    radius,
    trueAnomaly: (trueAnomaly * 180) / Math.PI,
    eccentricAnomaly: (eccentric * 180) / Math.PI,
  }
}

/**
 * The whole ellipse, stepped in *eccentric* anomaly rather than in time, so the
 * curve is evenly drawn instead of bunching where the body runs.
 */
export function orbitPath(elements: OrbitalElements, steps = 96): Vec3[] {
  const count = Math.max(3, Math.round(finite(steps, 96)))
  const a = Math.max(0, finite(elements?.semiMajor, 1))
  const e = clamp(finite(elements?.eccentricity ?? 0, 0), 0, MAX_ECCENTRICITY)
  const argument = finite(elements?.periapsis ?? 0, 0) * DEG
  const basis = orbitBasis(elements?.inclination ?? 0, elements?.node ?? 0)
  return Array.from({ length: count }, (_, index) => {
    const eccentric = (index / count) * TAU
    const radius = a * (1 - e * Math.cos(eccentric))
    const trueAnomaly =
      2 *
      Math.atan2(
        Math.sqrt(1 + e) * Math.sin(eccentric / 2),
        Math.sqrt(1 - e) * Math.cos(eccentric / 2),
      )
    const u = argument + trueAnomaly
    const cu = Math.cos(u)
    const su = Math.sin(u)
    return {
      x: radius * (basis.node.x * cu + basis.across.x * su),
      y: radius * (basis.node.y * cu + basis.across.y * su),
      z: radius * (basis.node.z * cu + basis.across.z * su),
    }
  })
}

/* -------------------------------------------------------------------------- */
/* the body                                                                    */
/* -------------------------------------------------------------------------- */

/** A body's own axes in the world. `up` is its pole. */
export interface CelestialFrame {
  right: Vec3
  up: Vec3
  forward: Vec3
}

export interface BodyFrameOptions {
  /** Degrees the pole leans out of vertical. */
  tilt?: number
  /** Degrees: the bearing the pole leans toward. */
  precession?: number
  /** Degrees the body has turned about its own pole. */
  spin?: number
}

/** The pole of a body tilted `tilt` degrees toward the bearing `precession`. */
export function spinAxis(tilt = 0, precession = 0): Vec3 {
  const t = clamp(finite(tilt, 0), -180, 180) * DEG
  const p = finite(precession, 0) * DEG
  return {
    x: Math.sin(t) * Math.sin(p),
    y: Math.cos(t),
    z: -Math.sin(t) * Math.cos(p),
  }
}

/**
 * The body's frame: tilt the pole, then turn the body about it.
 *
 * A body turning about one axis while that axis itself turns is the whole
 * mechanism of a tumble — advance `spin` and `precession` at different rates
 * and the silhouette of an irregular body genuinely changes, which a single
 * rotation could never do.
 */
export function bodyFrame({
  tilt = 0,
  precession = 0,
  spin = 0,
}: BodyFrameOptions = {}): CelestialFrame {
  const up = spinAxis(tilt, precession)
  // The machine's facing direction is the reference, so an untilted, unturned
  // body comes out as the identity frame — and the world vertical takes over
  // when the pole has itself lain down along the facing axis.
  const reference: Vec3 = Math.abs(up.z) > 0.99 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: -1 }
  const seed = unit3(cross3(reference, up), { x: 1, y: 0, z: 0 })
  const other = cross3(up, seed)
  const s = finite(spin, 0) * DEG
  const cs = Math.cos(s)
  const sn = Math.sin(s)
  const right: Vec3 = {
    x: seed.x * cs + other.x * sn,
    y: seed.y * cs + other.y * sn,
    z: seed.z * cs + other.z * sn,
  }
  return { right, up, forward: cross3(up, right) }
}

/** A point on the body's surface, at a latitude and longitude that turn with it. */
export function surfacePoint(
  frame: CelestialFrame,
  radius: number,
  latitude: number,
  longitude: number,
): Vec3 {
  const r = Math.max(0, finite(radius, 0))
  const lat = clamp(finite(latitude, 0), -90, 90) * DEG
  const lon = finite(longitude, 0) * DEG
  const ring = Math.cos(lat) * r
  const pole = Math.sin(lat) * r
  const cl = Math.cos(lon)
  const sl = Math.sin(lon)
  return {
    x: ring * (frame.right.x * cl + frame.forward.x * sl) + pole * frame.up.x,
    y: ring * (frame.right.y * cl + frame.forward.y * sl) + pole * frame.up.y,
    z: ring * (frame.right.z * cl + frame.forward.z * sl) + pole * frame.up.z,
  }
}

/** A parallel on that body: an atmospheric band, a spot belt, a ring. */
export function latitudeBand(
  frame: CelestialFrame,
  radius: number,
  latitude: number,
  steps = 48,
): Vec3[] {
  const count = Math.max(3, Math.round(finite(steps, 48)))
  return Array.from({ length: count }, (_, index) =>
    surfacePoint(frame, radius, latitude, (index / count) * 360),
  )
}

/** A meridian on that body: a longitude line from pole to pole. */
export function meridian(
  frame: CelestialFrame,
  radius: number,
  longitude: number,
  steps = 24,
): Vec3[] {
  const count = Math.max(2, Math.round(finite(steps, 24)))
  return Array.from({ length: count + 1 }, (_, index) =>
    surfacePoint(frame, radius, -90 + (180 * index) / count, longitude),
  )
}

/**
 * Points spread evenly over a sphere — craters, granulation cells, spots.
 *
 * The spherical Fibonacci construction: latitude steps by equal *area* and
 * longitude turns by the golden angle, which is why no two sites line up and
 * the cover has no seam or pole cluster.
 */
export function sphereLattice(count: number): Vec3[] {
  const sites = Math.max(0, Math.round(finite(count, 0)))
  if (sites === 0) return []
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: sites }, (_, index) => {
    const y = 1 - (2 * (index + 0.5)) / sites
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = index * golden
    return { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring }
  })
}

/* -------------------------------------------------------------------------- */
/* light                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The day-night line: the great circle where the light grazes the sphere. It
 * is a plain circle in space — it is the *projection* that turns it into the
 * crescent, which is why nothing here has to know what phase it is.
 */
export function terminator(radius: number, sun: Vec3, steps = 64): Vec3[] {
  const count = Math.max(3, Math.round(finite(steps, 64)))
  const r = Math.max(0, finite(radius, 0))
  const light = unit3(sun, { x: 0, y: 0, z: -1 })
  const reference: Vec3 =
    Math.abs(light.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const a = unit3(cross3(reference, light), { x: 1, y: 0, z: 0 })
  const b = cross3(light, a)
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * TAU
    const ca = Math.cos(angle) * r
    const cb = Math.sin(angle) * r
    return { x: a.x * ca + b.x * cb, y: a.y * ca + b.y * cb, z: a.z * ca + b.z * cb }
  })
}

/**
 * How much of the disc a viewer sees is lit, 0 to 1. `sun` and `viewer` both
 * point *away* from the body — toward the light and toward the observer — so
 * the two pointing the same way is a full face and opposite is a new one.
 */
export function phaseFraction(sun: Vec3, viewer: Vec3): number {
  const light = unit3(sun, { x: 0, y: 0, z: -1 })
  const eye = unit3(viewer, { x: 0, y: 0, z: -1 })
  return clamp((1 + dot(light, eye)) / 2, 0, 1)
}

/**
 * How lit one point on the surface is, −1 (midnight) through 0 (exactly on the
 * terminator) to 1 (the light overhead). This is what keeps a crater's shading
 * and the day-night line telling the same story.
 */
export function illumination(point: Vec3, sun: Vec3): number {
  return clamp(dot(unit3(point, { x: 0, y: 1, z: 0 }), unit3(sun, { x: 0, y: 0, z: -1 })), -1, 1)
}

/**
 * Limb darkening: `I/I₀ = 1 − u(1 − μ)`, with `μ` the cosine of the angle
 * between the line of sight and the surface normal — 1 at the centre of the
 * disc, 0 at the limb. A star is dimmer at the edge because the line of sight
 * only reaches the cooler upper layers there, and this is that law, not a
 * gradient tuned to look like it.
 */
export function limbDarkening(mu: number, coefficient = 0.6): number {
  const m = clamp(finite(mu, 1), 0, 1)
  const u = clamp(finite(coefficient, 0.6), 0, 1)
  return 1 - u * (1 - m)
}

/** The cosine of the view angle at a fraction `r` of the way out of a disc. */
export const discMu = (fraction: number) =>
  Math.sqrt(Math.max(0, 1 - clamp(finite(fraction, 0), 0, 1) ** 2))

/* -------------------------------------------------------------------------- */
/* an irregular body                                                           */
/* -------------------------------------------------------------------------- */

export interface LumpyOptions {
  /** How many cosine lobes are summed. Clamped 1–24. */
  lobes?: number
  /** Peak departure from the mean radius, as a fraction. Clamped 0–0.6. */
  depth?: number
  /** Any integer. The same seed is the same rock, every render. */
  seed?: number
}

/** Deterministic, so a rock is the same rock on the server and in the browser. */
function mulberry(seed: number) {
  let state = (Math.round(finite(seed, 1)) || 1) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Lobe {
  direction: Vec3
  weight: number
  frequency: number
}

const lobeCache = new Map<string, Lobe[]>()

function lobesFor(count: number, seed: number): Lobe[] {
  const key = `${count}:${seed}`
  const cached = lobeCache.get(key)
  if (cached) return cached
  const random = mulberry(seed)
  const raw = Array.from({ length: count }, () => {
    const y = 1 - 2 * random()
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = random() * TAU
    return {
      direction: { x: Math.cos(angle) * ring, y, z: Math.sin(angle) * ring },
      weight: 0.4 + random(),
      frequency: 1 + Math.floor(random() * 3),
    }
  })
  // Normalised so the sum of the weights is exactly one: the field is then
  // bounded in ±1 whatever the lobe count, and `depth` means what it says.
  const total = raw.reduce((sum, lobe) => sum + lobe.weight, 0) || 1
  const lobes = raw.map((lobe) => ({ ...lobe, weight: lobe.weight / total }))
  lobeCache.set(key, lobes)
  return lobes
}

/**
 * The radius of an irregular body in a given direction, as a fraction of the
 * mean: a sum of cosine lobes over the angle to each lobe's own axis.
 *
 * `cos(k·θ)` has zero slope at both θ = 0 and θ = π, so the field is smooth
 * across every lobe's axis — there is no seam anywhere on the sphere, which is
 * what stops a tumbling rock flickering as a crease comes round.
 */
export function lumpyRadius(direction: Vec3, options: LumpyOptions = {}): number {
  const count = Math.round(clamp(finite(options.lobes ?? 7, 7), 1, 24))
  const depth = clamp(finite(options.depth ?? 0.25, 0.25), 0, 0.6)
  const seed = Math.round(finite(options.seed ?? 1, 1))
  const d = unit3(direction, { x: 0, y: 1, z: 0 })
  let field = 0
  for (const lobe of lobesFor(count, seed)) {
    const angle = Math.acos(clamp(dot(d, lobe.direction), -1, 1))
    field += lobe.weight * Math.cos(lobe.frequency * angle)
  }
  return 1 + depth * clamp(field, -1, 1)
}

/** That body's surface point in a direction — the radius field, applied. */
export function lumpyPoint(
  direction: Vec3,
  radius: number,
  options: LumpyOptions = {},
): Vec3 {
  const d = unit3(direction, { x: 0, y: 1, z: 0 })
  const r = Math.max(0, finite(radius, 0)) * lumpyRadius(d, options)
  return { x: d.x * r, y: d.y * r, z: d.z * r }
}
