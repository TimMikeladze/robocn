/**
 * cactus-geometry — a ribbed limb that bends in its own plane, and everything
 * that is carried on one.
 *
 * One idea, used twice. A limb is a centreline **solved from its curvature**
 * rather than drawn: the tangent angle is integrated along the arc, and the
 * joints are then walked off that angle one fixed link at a time. So the limb
 * is exactly as long at every bend as it was straight, which is the difference
 * between an arm that lifts and a picture of one. A column is the same solver
 * with a gentle sweep, and an arm is the same solver with a tight elbow — one
 * mechanism, not two drawings.
 *
 * Everything else is written in the frame each station carries, so it cannot
 * disagree with the bend:
 *
 * - the **skin** is a ribbed section — the radius modulated by `ribs` crests
 *   round the limb — and a rib crest is therefore a *line on the solved
 *   surface*, not a stripe drawn along a shape;
 * - **areoles** sit on those crests at even arc spacing, alternate ribs
 *   staggered by half a step, each carrying the outward normal of the skin it
 *   is set into — taper included, so a stud near a tapering crown leans out
 *   and up the way the surface does;
 * - **spines** radiate from an areole on a cone about that normal, every
 *   needle exactly its own length at every splay;
 * - **petals** are hinged on a ring in the tip station's own plane and are
 *   rigid, so furling the corolla shortens the silhouette rather than the
 *   petal.
 *
 * World axes are the set's: `x` starboard, `y` up, `z` toward the tail, with
 * machines facing `−z`. Azimuth 0 therefore faces the `front` camera, matching
 * `phyllotaxis.ts`.
 *
 * Nothing here models a plant. There is no growth, no water and no botany —
 * these are trajectories and surfaces. Design note: docs/ribbed-column.md.
 */

import { clamp, type Vec3 } from "@/lib/robocn/kinematics"

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const RAD = Math.PI / 180

/** How far the bend may be spent either side of the elbow, and the turn limits. */
export const cactusLimits = { turn: 360, emergence: 180, ribs: 48 } as const

/* -------------------------------------------------------------------------- */
/* the limb                                                                    */
/* -------------------------------------------------------------------------- */

/** One station on a limb's centreline, and the frame it carries. */
export interface CactusStation {
  /** 0 at the base, 1 at the tip. */
  s: number
  /** Arc length from the base, in world units. */
  distance: number
  centre: Vec3
  /** Unit, along the centreline toward the tip. */
  tangent: Vec3
  /** Unit, in the bending plane, on the outside of the bend. Roll 0. */
  normal: Vec3
  /** Unit, across the bending plane. Constant along a limb, which bends in one. */
  binormal: Vec3
  /** Tube radius here, before the ribs modulate it. */
  radius: number
  /** Tangent angle off vertical, in degrees. */
  angle: number
}

export interface CactusLimb {
  stations: CactusStation[]
  base: CactusStation
  tip: CactusStation
  /** Contour length: the sum of the links, exactly. */
  length: number
  /** Length of one link; every link is the same. */
  link: number
  /** Azimuth of the plane the limb bends in. */
  bearing: number
}

export interface CactusLimbOptions {
  /** Contour length of the centreline. Clamped 1–1000. */
  length?: number
  /** Links in the limb; it returns one more station than this. Clamped 3–32. */
  segments?: number
  /** Where the centreline starts. */
  base?: Vec3
  /** Azimuth of the plane it bends in. 0 faces the front camera. */
  bearing?: number
  /** Tangent angle at the base, degrees off vertical. 0 straight up, 90 flat. */
  emergence?: number
  /**
   * Total turn taken over the limb, in degrees. Positive brings the tangent
   * back toward vertical, so `sweep === emergence` ends the limb straight up.
   */
  sweep?: number
  /** Where along the limb the turn is spent, 0 at the base and 1 at the tip. */
  elbow?: number
  /** How far the turn is spread either side of that. Small is a tight elbow. */
  spread?: number
  /** Tube radius as a function of the station. */
  radius?: (s: number) => number
}

/** The outward horizontal direction of an azimuth: 0 faces the front camera. */
export function cactusBearing(azimuth: number): Vec3 {
  const a = finite(azimuth, 0) * RAD
  return { x: Math.sin(a), y: 0, z: -Math.cos(a) }
}

/**
 * The limb, solved from its curvature.
 *
 *     θ(s) = emergence − sweep · W(s)
 *
 * where `W` is the normalised integral of a bell centred on the elbow, so the
 * whole of `sweep` is spent over the limb however wide the bell is and the
 * bend is concentrated where the elbow says. Joints are then walked off the
 * angle at each link's midpoint, one fixed link at a time — integrating the
 * angle rather than displacing joints is what keeps every link exactly the
 * same length at every bend.
 *
 * The limb bends only in the vertical plane of `bearing`, which is what a
 * column and an arm growing off one actually do, and is why `binormal` is
 * constant along it.
 */
export function solveCactusLimb({
  length = 100,
  segments = 12,
  base = { x: 0, y: 0, z: 0 },
  bearing = 0,
  emergence = 0,
  sweep = 0,
  elbow = 0.35,
  spread = 0.25,
  radius,
}: CactusLimbOptions = {}): CactusLimb {
  const count = Number.isFinite(segments) ? Math.round(clamp(segments, 3, 32)) : 12
  const span = clamp(finite(length, 100), 1, 1000)
  const bear = finite(bearing, 0)
  const start = clamp(finite(emergence, 0), -cactusLimits.emergence, cactusLimits.emergence)
  const turn = clamp(finite(sweep, 0), -cactusLimits.turn, cactusLimits.turn)
  const centre = clamp(finite(elbow, 0.35), 0, 1)
  const width = clamp(finite(spread, 0.25), 0.02, 4)
  const link = span / count
  const out = cactusBearing(bear)
  const gauge = (s: number) => {
    const value = radius ? radius(s) : span * 0.1
    return Math.max(0, finite(value, 0))
  }

  // Where the turn has been spent by `s`. Sampled once, finely, so the joint
  // walk and the midpoints both read the same curve.
  const steps = 192
  const bell = (s: number) => Math.exp(-(((s - centre) / width) ** 2))
  const cumulative: number[] = [0]
  for (let step = 1; step <= steps; step += 1) {
    const a = (step - 1) / steps
    const b = step / steps
    cumulative.push(cumulative[step - 1] + ((bell(a) + bell(b)) / 2) * (1 / steps))
  }
  const total = cumulative[steps]
  const spent = (s: number) => {
    if (!(total > 0)) return clamp(s, 0, 1)
    const at = clamp(s, 0, 1) * steps
    const index = Math.min(steps - 1, Math.floor(at))
    const share = at - index
    return (
      (cumulative[index] + (cumulative[index + 1] - cumulative[index]) * share) / total
    )
  }
  const angleAt = (s: number) => start - turn * spent(s)

  const origin = {
    x: finite(base?.x, 0),
    y: finite(base?.y, 0),
    z: finite(base?.z, 0),
  }
  const stations: CactusStation[] = []
  let cursor = origin
  for (let index = 0; index <= count; index += 1) {
    const s = index / count
    const angle = angleAt(s)
    const t = angle * RAD
    const sin = Math.sin(t)
    const cos = Math.cos(t)
    stations.push({
      s,
      distance: link * index,
      centre: cursor,
      tangent: { x: sin * out.x, y: cos, z: sin * out.z },
      normal: { x: cos * out.x, y: -sin, z: cos * out.z },
      binormal: { x: out.z, y: 0, z: -out.x },
      radius: gauge(s),
      angle,
    })
    if (index === count) break
    // The link takes the angle at its own midpoint, so a tight elbow is not
    // cut across by the joint it happens between.
    const mid = angleAt((index + 0.5) / count) * RAD
    const step = {
      x: Math.sin(mid) * out.x,
      y: Math.cos(mid),
      z: Math.sin(mid) * out.z,
    }
    cursor = {
      x: cursor.x + step.x * link,
      y: cursor.y + step.y * link,
      z: cursor.z + step.z * link,
    }
  }

  return {
    stations,
    base: stations[0],
    tip: stations[stations.length - 1],
    length: span,
    link,
    bearing: bear,
  }
}

/** The station at any `s`, interpolated between the solved ones. */
export function stationAt(limb: CactusLimb, s: number): CactusStation {
  const stations = limb?.stations ?? []
  if (stations.length === 0) {
    return {
      s: 0,
      distance: 0,
      centre: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: -1 },
      binormal: { x: 1, y: 0, z: 0 },
      radius: 0,
      angle: 0,
    }
  }
  const count = stations.length - 1
  const at = clamp(finite(s, 0), 0, 1) * count
  const index = Math.min(count - 1, Math.max(0, Math.floor(at)))
  const share = clamp(at - index, 0, 1)
  const a = stations[index]
  const b = stations[index + 1] ?? a
  const mix = (from: Vec3, to: Vec3): Vec3 => ({
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share,
    z: from.z + (to.z - from.z) * share,
  })
  // The frame is rebuilt from the interpolated angle rather than lerped, so it
  // stays orthonormal wherever it is sampled.
  const angle = a.angle + (b.angle - a.angle) * share
  const t = angle * RAD
  const out = cactusBearing(limb.bearing)
  return {
    s: a.s + (b.s - a.s) * share,
    distance: a.distance + (b.distance - a.distance) * share,
    centre: mix(a.centre, b.centre),
    tangent: { x: Math.sin(t) * out.x, y: Math.cos(t), z: Math.sin(t) * out.z },
    normal: { x: Math.cos(t) * out.x, y: -Math.sin(t), z: Math.cos(t) * out.z },
    binormal: { x: out.z, y: 0, z: -out.x },
    radius: a.radius + (b.radius - a.radius) * share,
    angle,
  }
}

/* -------------------------------------------------------------------------- */
/* the skin                                                                    */
/* -------------------------------------------------------------------------- */

export interface CactusRibOptions {
  /** Rib crests round the limb. Fewer than two leaves it round. */
  ribs?: number
  /** How deep the furrows cut, as a fraction of the radius. Clamped 0–0.9. */
  depth?: number
  /** Turns the rib pattern about the limb, in degrees. */
  roll?: number
}

/**
 * How much of its radius the skin keeps at `angle` degrees round the limb.
 * Crests are exactly 1 and land at every `360/ribs`; the furrows between them
 * are `1 − depth`.
 */
export function ribFactor(angle: number, ribs = 0, depth = 0): number {
  const count = Math.round(finite(ribs, 0))
  const cut = clamp(finite(depth, 0), 0, 0.9)
  if (count < 2 || cut === 0) return 1
  return 1 - (cut * (1 - Math.cos(count * finite(angle, 0) * RAD))) / 2
}

/** The roll angle of one rib crest, in degrees. */
export const ribRoll = (index: number, ribs: number, roll = 0) =>
  finite(roll, 0) + (finite(index, 0) / Math.max(1, Math.round(finite(ribs, 1)))) * 360

/** A point on the skin, `angle` degrees round the limb from the outward normal. */
export function limbPoint(
  station: CactusStation,
  angle: number,
  { ribs = 0, depth = 0, roll = 0 }: CactusRibOptions = {},
): Vec3 {
  const a = finite(angle, 0)
  const reach = Math.max(0, finite(station?.radius, 0)) * ribFactor(a - finite(roll, 0), ribs, depth)
  const c = Math.cos(a * RAD)
  const s = Math.sin(a * RAD)
  const normal = station?.normal ?? { x: 0, y: 0, z: -1 }
  const binormal = station?.binormal ?? { x: 1, y: 0, z: 0 }
  const centre = station?.centre ?? { x: 0, y: 0, z: 0 }
  return {
    x: centre.x + reach * (c * normal.x + s * binormal.x),
    y: centre.y + reach * (c * normal.y + s * binormal.y),
    z: centre.z + reach * (c * normal.z + s * binormal.z),
  }
}

/** The closed cross-section at one station, ribs and all. */
export function limbRing(
  station: CactusStation,
  options: CactusRibOptions & { steps?: number } = {},
): Vec3[] {
  const steps = Math.max(3, Math.round(finite(options.steps ?? 24, 24)))
  return Array.from({ length: steps }, (_, index) =>
    limbPoint(station, (index / steps) * 360, options),
  )
}

/** One rib crest, running the length of the limb: a line on the solved skin. */
export function ribCrest(
  limb: CactusLimb,
  index: number,
  options: CactusRibOptions = {},
): Vec3[] {
  const angle = ribRoll(index, options.ribs ?? 1, options.roll)
  return (limb?.stations ?? []).map((station) => limbPoint(station, angle, options))
}

/* -------------------------------------------------------------------------- */
/* what grows on it                                                            */
/* -------------------------------------------------------------------------- */

/** One areole: a pad set into a rib crest, and the way that patch of skin looks. */
export interface CactusAreole {
  index: number
  /** Which rib crest it sits on. */
  rib: number
  /** Station along the limb. */
  s: number
  /** Roll angle round the limb, in degrees. */
  roll: number
  position: Vec3
  /** Unit outward normal of the skin, taper included. */
  normal: Vec3
}

export interface CactusAreoleOptions extends CactusRibOptions {
  /** Areoles on each crest. */
  perRib?: number
  /** Station range they are spread over. */
  from?: number
  to?: number
  /** Fraction of a step that alternate ribs are offset by. */
  stagger?: number
}

/**
 * Areoles on the rib crests, evenly spaced in station and staggered every other
 * rib, so the pattern is a lattice on the surface rather than a set of rings.
 *
 * The normal is the skin's, not the ring's: the taper of the limb is taken from
 * the radius either side of the station and leant into, which is what makes a
 * pad near a tapering crown point up and out instead of straight sideways. The
 * rib modulation itself is left out of it — the furrows are shallow enough that
 * a pad still stands off its own crest.
 */
export function areoleSites(
  limb: CactusLimb,
  {
    ribs = 0,
    depth = 0,
    roll = 0,
    perRib = 4,
    from = 0.1,
    to = 0.9,
    stagger = 0.5,
  }: CactusAreoleOptions = {},
): CactusAreole[] {
  const crests = Math.round(clamp(finite(ribs, 0), 0, cactusLimits.ribs))
  const rows = Math.max(0, Math.round(finite(perRib, 4)))
  if (crests < 1 || rows < 1) return []
  const start = clamp(finite(from, 0.1), 0, 1)
  const end = clamp(finite(to, 0.9), 0, 1)
  const offset = clamp(finite(stagger, 0.5), 0, 1)
  const span = end - start
  const sites: CactusAreole[] = []
  let index = 0
  for (let rib = 0; rib < crests; rib += 1) {
    const angle = ribRoll(rib, crests, roll)
    const shift = (rib % 2) * offset
    for (let row = 0; row < rows; row += 1) {
      const s = clamp(start + (span * (row + shift * 0.5 + 0.5)) / (rows + offset * 0.5), 0, 1)
      const station = stationAt(limb, s)
      const position = limbPoint(station, angle, { ribs: crests, depth, roll })
      sites.push({
        index,
        rib,
        s,
        roll: angle,
        normal: skinNormal(limb, s, angle),
        position,
      })
      index += 1
    }
  }
  return sites
}

/** The outward unit normal of the skin at one station and roll angle. */
export function skinNormal(limb: CactusLimb, s: number, angle: number): Vec3 {
  const station = stationAt(limb, s)
  const step = 1e-2
  const back = stationAt(limb, clamp(finite(s, 0) - step, 0, 1))
  const forward = stationAt(limb, clamp(finite(s, 0) + step, 0, 1))
  const run = Math.abs(forward.distance - back.distance)
  // dr/ds along the arc: a widening limb leans its normal back down the taper.
  const slope = run > 1e-9 ? (forward.radius - back.radius) / run : 0
  const a = finite(angle, 0) * RAD
  const c = Math.cos(a)
  const sn = Math.sin(a)
  const radial = {
    x: c * station.normal.x + sn * station.binormal.x,
    y: c * station.normal.y + sn * station.binormal.y,
    z: c * station.normal.z + sn * station.binormal.z,
  }
  const raw = {
    x: radial.x - slope * station.tangent.x,
    y: radial.y - slope * station.tangent.y,
    z: radial.z - slope * station.tangent.z,
  }
  const size = Math.hypot(raw.x, raw.y, raw.z)
  return size > 1e-9
    ? { x: raw.x / size, y: raw.y / size, z: raw.z / size }
    : { ...radial }
}

/** One needle: where it is rooted, and where its point is. */
export interface CactusSpine {
  index: number
  root: Vec3
  tip: Vec3
}

export interface CactusSpineOptions {
  /** Needles in the fan. */
  count?: number
  length?: number
  /** Half-angle of the cone they splay on, in degrees. 0 is a single bundle. */
  spread?: number
  /** Azimuth of the first needle round the normal, in degrees. */
  start?: number
  /** A needle standing straight out of the pad, at the centre of the fan. */
  centre?: boolean
}

/**
 * The fan of needles an areole carries: a cone about the skin's own normal,
 * every needle exactly `length` long at every splay. The basis round the normal
 * is taken from the world's vertical, and from the fore-aft axis where the
 * normal is itself vertical, so a fan is deterministic rather than seeded.
 */
export function spineFan(
  areole: CactusAreole,
  { count = 6, length = 5, spread = 62, start = 0, centre = false }: CactusSpineOptions = {},
): CactusSpine[] {
  const needles = Math.max(0, Math.round(finite(count, 6)))
  const reach = Math.max(0, finite(length, 5))
  const splay = clamp(finite(spread, 62), 0, 90) * RAD
  const first = finite(start, 0)
  const root = areole?.position ?? { x: 0, y: 0, z: 0 }
  const normal = areole?.normal ?? { x: 0, y: 1, z: 0 }
  const up = Math.abs(normal.y) > 0.94 ? { x: 0, y: 0, z: -1 } : { x: 0, y: 1, z: 0 }
  const across = {
    x: normal.y * up.z - normal.z * up.y,
    y: normal.z * up.x - normal.x * up.z,
    z: normal.x * up.y - normal.y * up.x,
  }
  const size = Math.hypot(across.x, across.y, across.z)
  const u =
    size > 1e-9
      ? { x: across.x / size, y: across.y / size, z: across.z / size }
      : { x: 1, y: 0, z: 0 }
  const v = {
    x: normal.y * u.z - normal.z * u.y,
    y: normal.z * u.x - normal.x * u.z,
    z: normal.x * u.y - normal.y * u.x,
  }
  const cone = Math.cos(splay)
  const rim = Math.sin(splay)
  const fan: CactusSpine[] = []
  if (centre && reach > 0) {
    fan.push({
      index: -1,
      root,
      tip: {
        x: root.x + normal.x * reach,
        y: root.y + normal.y * reach,
        z: root.z + normal.z * reach,
      },
    })
  }
  for (let index = 0; index < needles; index += 1) {
    const a = (first + (index / needles) * 360) * RAD
    const c = Math.cos(a)
    const s = Math.sin(a)
    const direction = {
      x: cone * normal.x + rim * (c * u.x + s * v.x),
      y: cone * normal.y + rim * (c * u.y + s * v.y),
      z: cone * normal.z + rim * (c * u.z + s * v.z),
    }
    fan.push({
      index,
      root,
      tip: {
        x: root.x + direction.x * reach,
        y: root.y + direction.y * reach,
        z: root.z + direction.z * reach,
      },
    })
  }
  return fan
}

/** One petal, hinged on the ring the corolla stands on. */
export interface CactusPetal {
  index: number
  /** Roll angle round the limb's axis, in degrees. */
  roll: number
  root: Vec3
  tip: Vec3
  /** Root-left, tip-left, tip-right, root-right, in the petal's own plane. */
  corners: Vec3[]
}

export interface CactusCorollaOptions {
  /** Radius of the ring the petals are hinged on. */
  radius: number
  length: number
  /** Petal width at the root. */
  width: number
  /** Tip width as a fraction of the root. */
  taper?: number
  /** Degrees out of the ring's plane: 90 stands them up into a bud, 0 is flat. */
  pitch?: number
  /** Roll of the first petal, in degrees. */
  start?: number
  /** How far above the station the ring sits, along the limb's axis. */
  rise?: number
}

/**
 * Petals hinged on a ring in the station's own plane. The blade is rigid — its
 * length is exact at every pitch — so shutting the corolla into a bud shortens
 * the silhouette rather than the petal, and a half-open flower is the same
 * flower seen from a different angle rather than a smaller one.
 */
export function corollaPetals(
  count: number,
  station: CactusStation,
  {
    radius,
    length,
    width,
    taper = 0.4,
    pitch = 0,
    start = 0,
    rise = 0,
  }: CactusCorollaOptions,
): CactusPetal[] {
  const petals = Math.max(0, Math.round(finite(count, 0)))
  if (petals === 0) return []
  const ring = Math.max(0, finite(radius, 0))
  const blade = Math.max(0, finite(length, 0))
  const chord = Math.max(0, finite(width, 0))
  const tipChord = chord * clamp(finite(taper, 0.4), 0, 2)
  const rake = clamp(finite(pitch, 0), -180, 180) * RAD
  const first = finite(start, 0)
  const lift = finite(rise, 0)
  const normal = station?.normal ?? { x: 0, y: 0, z: -1 }
  const binormal = station?.binormal ?? { x: 1, y: 0, z: 0 }
  const axis = station?.tangent ?? { x: 0, y: 1, z: 0 }
  const origin = station?.centre ?? { x: 0, y: 0, z: 0 }
  const hub = {
    x: origin.x + axis.x * lift,
    y: origin.y + axis.y * lift,
    z: origin.z + axis.z * lift,
  }
  const reach = Math.cos(rake) * blade
  const climb = Math.sin(rake) * blade

  return Array.from({ length: petals }, (_, index) => {
    const roll = first + (index / petals) * 360
    const a = roll * RAD
    const c = Math.cos(a)
    const s = Math.sin(a)
    const out = {
      x: c * normal.x + s * binormal.x,
      y: c * normal.y + s * binormal.y,
      z: c * normal.z + s * binormal.z,
    }
    const side = {
      x: -s * normal.x + c * binormal.x,
      y: -s * normal.y + c * binormal.y,
      z: -s * normal.z + c * binormal.z,
    }
    const root = {
      x: hub.x + out.x * ring,
      y: hub.y + out.y * ring,
      z: hub.z + out.z * ring,
    }
    const tip = {
      x: root.x + out.x * reach + axis.x * climb,
      y: root.y + out.y * reach + axis.y * climb,
      z: root.z + out.z * reach + axis.z * climb,
    }
    const half = chord / 2
    const tipHalf = tipChord / 2
    return {
      index,
      roll,
      root,
      tip,
      corners: [
        { x: root.x + side.x * half, y: root.y + side.y * half, z: root.z + side.z * half },
        { x: tip.x + side.x * tipHalf, y: tip.y + side.y * tipHalf, z: tip.z + side.z * tipHalf },
        { x: tip.x - side.x * tipHalf, y: tip.y - side.y * tipHalf, z: tip.z - side.z * tipHalf },
        { x: root.x - side.x * half, y: root.y - side.y * half, z: root.z - side.z * half },
      ],
    }
  })
}

/** The roll angle on a limb that faces a world azimuth. */
export function rollToward(station: CactusStation, azimuth: number): number {
  const out = cactusBearing(azimuth)
  const normal = station?.normal ?? { x: 0, y: 0, z: -1 }
  const binormal = station?.binormal ?? { x: 1, y: 0, z: 0 }
  const along = out.x * normal.x + out.y * normal.y + out.z * normal.z
  const across = out.x * binormal.x + out.y * binormal.y + out.z * binormal.z
  return (Math.atan2(across, along) * 180) / Math.PI
}
