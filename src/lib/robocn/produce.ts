/**
 * produce-geometry — solids of revolution with a real profile, and the four
 * things the produce robots do to one.
 *
 * A profile is a function of one parameter: how high the surface is and how far
 * it stands off the axis at that station. Everything here works on that and
 * returns plain `{x, y, z}` in world units — `x` starboard, `y` up, `z` toward
 * the tail — so the components own the projection and the paint.
 *
 * Four mechanisms, each with an invariant the tests hold it to:
 *
 * - a **lattice** placed by the golden angle over *equal surface area*, so the
 *   sites are evenly spread on the skin rather than on the parameter;
 * - a **split**: half a surface, and its mirror, which reassemble exactly;
 * - a **hinge**: those halves turned about a vertical axis, keeping every
 *   point's distance to that axis;
 * - a **blade ring**: sepals hinged on a circle, exact in length at any pitch.
 *
 * No crop, ripeness or fruit-mechanics model lives here. Design note:
 * docs/produce-robots.md.
 */

import { clamp, type Vec3 } from "@/lib/robocn/kinematics"

/** The surface at one station: how high it is, and its radius about the axis. */
export interface ProduceSection {
  height: number
  radius: number
}

/** A body of revolution, parameterised 0 (base) to 1 (crown). */
export type ProduceProfile = (t: number) => ProduceSection

export interface ProduceSurfaceOptions {
  /** Stations sampled along the profile. */
  rings?: number
  /** Samples around the axis. */
  meridians?: number
  /** Parameter range to cover, so a skirt or a crown can be left off. */
  from?: number
  to?: number
  /**
   * Azimuthal radius modulation — a lobed fruit, not a sphere with lines on
   * it. Furrows land at odd multiples of 180/lobes.
   */
  lobes?: number
  /** How deep the furrows cut, as a fraction of the radius. */
  lobeDepth?: number
}

/** The angle a sunflower packs its seeds at, in degrees. */
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5))

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

/** The profile, defended: a broken profile gives a stable zero section. */
function sectionAt(profile: ProduceProfile, t: number): ProduceSection {
  const section = profile(clamp(finite(t, 0), 0, 1))
  return {
    height: finite(section?.height, 0),
    radius: Math.max(0, finite(section?.radius, 0)),
  }
}

/** How much of its radius the surface keeps at this azimuth, once lobed. */
export function lobeFactor(azimuth: number, lobes = 0, depth = 0): number {
  const count = Math.round(finite(lobes, 0))
  const cut = clamp(finite(depth, 0), 0, 0.9)
  if (count < 2 || cut === 0) return 1
  return 1 - (cut * (1 - Math.cos((count * finite(azimuth, 0) * Math.PI) / 180))) / 2
}

/** One point on the surface, at station `t` and `azimuth` degrees. */
export function profilePoint(
  profile: ProduceProfile,
  t: number,
  azimuth = 0,
  { lobes = 0, lobeDepth = 0 }: ProduceSurfaceOptions = {},
): Vec3 {
  const section = sectionAt(profile, t)
  const radius = section.radius * lobeFactor(azimuth, lobes, lobeDepth)
  const a = (finite(azimuth, 0) * Math.PI) / 180
  return { x: radius * Math.sin(a), y: section.height, z: radius * Math.cos(a) }
}

/** The whole surface as points: rings × meridians, ready to project and hull. */
export function revolveProfile(
  profile: ProduceProfile,
  options: ProduceSurfaceOptions = {},
): Vec3[] {
  const rings = Math.max(1, Math.round(finite(options.rings ?? 12, 12)))
  const meridians = Math.max(3, Math.round(finite(options.meridians ?? 24, 24)))
  const from = clamp(finite(options.from ?? 0, 0), 0, 1)
  const to = clamp(finite(options.to ?? 1, 1), 0, 1)
  const points: Vec3[] = []
  for (let ring = 0; ring <= rings; ring++) {
    const t = from + ((to - from) * ring) / rings
    for (let step = 0; step < meridians; step++) {
      points.push(profilePoint(profile, t, (step / meridians) * 360, options))
    }
  }
  return points
}

/** The horizontal ring at one station — a latitude, closed. */
export function latitudeRing(
  profile: ProduceProfile,
  t: number,
  options: ProduceSurfaceOptions = {},
  steps = options.meridians ?? 32,
): Vec3[] {
  const count = Math.max(3, Math.round(finite(steps, 32)))
  return Array.from({ length: count }, (_, index) =>
    profilePoint(profile, t, (index / count) * 360, options),
  )
}

/** The vertical line at one azimuth — a furrow, or a seam. */
export function meridianLine(
  profile: ProduceProfile,
  azimuth: number,
  options: ProduceSurfaceOptions = {},
  steps = options.rings ?? 12,
): Vec3[] {
  const count = Math.max(1, Math.round(finite(steps, 12)))
  const from = clamp(finite(options.from ?? 0, 0), 0, 1)
  const to = clamp(finite(options.to ?? 1, 1), 0, 1)
  return Array.from({ length: count + 1 }, (_, index) =>
    profilePoint(profile, from + ((to - from) * index) / count, azimuth, options),
  )
}

/**
 * The outward normal in the meridian plane, then turned to `azimuth`. This is
 * the direction a stud set into the skin extends along, and the vector that
 * decides whether it is facing the camera at all.
 *
 * Taken from the profile itself, so it is the normal of the *unlobed* surface
 * of revolution; the furrows are shallow enough that a stud still stands off
 * its own skin.
 */
export function surfaceNormal(
  profile: ProduceProfile,
  t: number,
  azimuth = 0,
): Vec3 {
  const step = 1e-3
  const station = clamp(finite(t, 0), 0, 1)
  const back = sectionAt(profile, Math.max(0, station - step))
  const forward = sectionAt(profile, Math.min(1, station + step))
  const dr = forward.radius - back.radius
  const dh = forward.height - back.height
  const length = Math.hypot(dr, dh)
  // A degenerate station (a point, a flat cap) has no meridian to be normal
  // to: stand straight out, which is the honest answer on the equator.
  const radial = length > 1e-9 ? dh / length : 1
  const vertical = length > 1e-9 ? -dr / length : 0
  const a = (finite(azimuth, 0) * Math.PI) / 180
  return { x: radial * Math.sin(a), y: vertical, z: radial * Math.cos(a) }
}

/** One site of the lattice: where it sits, and which way it points. */
export interface ProduceLatticeSite {
  index: number
  /** Station on the profile. */
  t: number
  azimuth: number
  position: Vec3
  normal: Vec3
}

/**
 * Sites by the golden angle, spaced by equal lateral surface area.
 *
 * Spacing on the *parameter* would crowd the sites where the profile is steep
 * and thin them where it flares; integrating `2πr ds` and stepping through it
 * evenly is what puts the same number of seeds on the same amount of skin.
 */
export function goldenLattice(
  profile: ProduceProfile,
  count: number,
  options: ProduceSurfaceOptions = {},
): ProduceLatticeSite[] {
  const sites = Math.max(0, Math.round(finite(count, 0)))
  if (sites === 0) return []
  const from = clamp(finite(options.from ?? 0, 0), 0, 1)
  const to = clamp(finite(options.to ?? 1, 1), 0, 1)

  // Cumulative lateral area along the profile, sampled fine enough that the
  // inversion below is smooth for any profile a fruit has.
  const steps = 256
  const stations = [from]
  const cumulative = [0]
  let previous = sectionAt(profile, from)
  let area = 0
  for (let step = 1; step <= steps; step++) {
    const t = from + ((to - from) * step) / steps
    const section = sectionAt(profile, t)
    const slant = Math.hypot(
      section.radius - previous.radius,
      section.height - previous.height,
    )
    area += Math.PI * (section.radius + previous.radius) * slant
    stations.push(t)
    cumulative.push(area)
    previous = section
  }
  if (!(area > 0)) return []

  let cursor = 1
  return Array.from({ length: sites }, (_, index) => {
    const target = ((index + 0.5) / sites) * area
    while (cursor < cumulative.length - 1 && cumulative[cursor] < target) cursor++
    const spanned = cumulative[cursor] - cumulative[cursor - 1]
    const share = spanned > 0 ? (target - cumulative[cursor - 1]) / spanned : 0
    const t = stations[cursor - 1] + (stations[cursor] - stations[cursor - 1]) * share
    const azimuth = ((index * GOLDEN_ANGLE) % 360 + 360) % 360
    return {
      index,
      t,
      azimuth,
      position: profilePoint(profile, t, azimuth, options),
      normal: surfaceNormal(profile, t, azimuth),
    }
  })
}

export type ProduceShellSide = "left" | "right"

/**
 * Half the surface: `right` sweeps azimuth 0..180, `left` is its mirror in the
 * `x = 0` plane, point for point. Cut this way the two halves reassemble into
 * exactly the surface `revolveProfile` draws, which is what makes a closed
 * shell close.
 */
export function halfShell(
  profile: ProduceProfile,
  side: ProduceShellSide = "right",
  options: ProduceSurfaceOptions = {},
): Vec3[] {
  const rings = Math.max(1, Math.round(finite(options.rings ?? 12, 12)))
  const meridians = Math.max(2, Math.round(finite(options.meridians ?? 16, 16)))
  const from = clamp(finite(options.from ?? 0, 0), 0, 1)
  const to = clamp(finite(options.to ?? 1, 1), 0, 1)
  const sense = side === "left" ? -1 : 1
  const points: Vec3[] = []
  for (let ring = 0; ring <= rings; ring++) {
    const t = from + ((to - from) * ring) / rings
    for (let step = 0; step <= meridians; step++) {
      points.push(profilePoint(profile, t, sense * (step / meridians) * 180, options))
    }
  }
  return points
}

/** The line a shell turns on: a point on it, and the direction it runs. */
export interface ProduceHinge {
  origin: Vec3
  /** Any non-zero direction; it is normalised here. */
  axis: Vec3
}

/**
 * Points turned about an arbitrary line — the pin a half shell swings on,
 * whether that is a vertical post behind the machine or a rod along the floor
 * under it. Distance to the line is preserved, so an open shell is the same
 * shell, and zero degrees is the identity rather than the shell plus whatever
 * the arithmetic rounds to.
 */
export function hingeRotate(
  points: readonly Vec3[],
  hinge: ProduceHinge,
  degrees: number,
): Vec3[] {
  const turn = finite(degrees, 0)
  if (turn === 0) return points.map((point) => ({ ...point }))
  const origin = {
    x: finite(hinge?.origin?.x, 0),
    y: finite(hinge?.origin?.y, 0),
    z: finite(hinge?.origin?.z, 0),
  }
  const raw = {
    x: finite(hinge?.axis?.x, 0),
    y: finite(hinge?.axis?.y, 1),
    z: finite(hinge?.axis?.z, 0),
  }
  const length = Math.hypot(raw.x, raw.y, raw.z)
  if (!(length > 1e-9)) return points.map((point) => ({ ...point }))
  const k = { x: raw.x / length, y: raw.y / length, z: raw.z / length }
  const angle = (turn * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map((point) => {
    const v = { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z }
    const cross = {
      x: k.y * v.z - k.z * v.y,
      y: k.z * v.x - k.x * v.z,
      z: k.x * v.y - k.y * v.x,
    }
    const dot = k.x * v.x + k.y * v.y + k.z * v.z
    return {
      x: origin.x + v.x * cos + cross.x * sin + k.x * dot * (1 - cos),
      y: origin.y + v.y * cos + cross.y * sin + k.y * dot * (1 - cos),
      z: origin.z + v.z * cos + cross.z * sin + k.z * dot * (1 - cos),
    }
  })
}

export interface ProduceBladeOptions {
  /** Radius of the ring the blades are hinged on. */
  radius: number
  /** Height of that ring. */
  height?: number
  length: number
  /** Blade width at the root. */
  width: number
  /** Tip width as a fraction of the root. */
  taper?: number
  /** Degrees above horizontal: positive stands them up, negative folds down. */
  pitch?: number
  /** Azimuth of the first blade. */
  start?: number
}

/** One blade: where it is hinged, where it points, and its outline in space. */
export interface ProduceBlade {
  index: number
  azimuth: number
  root: Vec3
  tip: Vec3
  /** Root-starboard, tip-starboard, tip-port, root-port. */
  corners: Vec3[]
}

/**
 * Blades hinged on a ring — a calyx, a landing collar. The blade is rigid: its
 * length is exact at every pitch, which is the difference between a hinge and
 * a drawing of one.
 */
export function bladeRing(count: number, options: ProduceBladeOptions): ProduceBlade[] {
  const blades = Math.max(0, Math.round(finite(count, 0)))
  if (blades === 0) return []
  const radius = Math.max(0, finite(options.radius, 0))
  const height = finite(options.height ?? 0, 0)
  const length = Math.max(0, finite(options.length, 0))
  const width = Math.max(0, finite(options.width, 0))
  const taper = clamp(finite(options.taper ?? 0.35, 0.35), 0, 2)
  const pitch = clamp(finite(options.pitch ?? 0, 0), -180, 180)
  const start = finite(options.start ?? 0, 0)
  const rise = (pitch * Math.PI) / 180

  return Array.from({ length: blades }, (_, index) => {
    const azimuth = start + (index / blades) * 360
    const a = (azimuth * Math.PI) / 180
    // Outward radial, and the horizontal perpendicular the width runs along.
    const out = { x: Math.sin(a), z: Math.cos(a) }
    const across = { x: Math.cos(a), z: -Math.sin(a) }
    const root = { x: out.x * radius, y: height, z: out.z * radius }
    const reach = Math.cos(rise) * length
    const climb = Math.sin(rise) * length
    const tip = {
      x: root.x + out.x * reach,
      y: height + climb,
      z: root.z + out.z * reach,
    }
    const half = width / 2
    const tipHalf = half * taper
    return {
      index,
      azimuth,
      root,
      tip,
      corners: [
        { x: root.x + across.x * half, y: root.y, z: root.z + across.z * half },
        { x: tip.x + across.x * tipHalf, y: tip.y, z: tip.z + across.z * tipHalf },
        { x: tip.x - across.x * tipHalf, y: tip.y, z: tip.z - across.z * tipHalf },
        { x: root.x - across.x * half, y: root.y, z: root.z - across.z * half },
      ],
    }
  })
}

/** Lateral surface area of the profile between two stations. */
export function lateralArea(
  profile: ProduceProfile,
  from = 0,
  to = 1,
  steps = 256,
): number {
  const count = Math.max(1, Math.round(finite(steps, 256)))
  const a = clamp(finite(from, 0), 0, 1)
  const b = clamp(finite(to, 1), 0, 1)
  let previous = sectionAt(profile, a)
  let area = 0
  for (let step = 1; step <= count; step++) {
    const section = sectionAt(profile, a + ((b - a) * step) / count)
    const slant = Math.hypot(
      section.radius - previous.radius,
      section.height - previous.height,
    )
    area += Math.PI * (section.radius + previous.radius) * slant
    previous = section
  }
  return area
}

/** The circumference of the widest station, for anything that has to clear it. */
export function widestSection(profile: ProduceProfile, steps = 64): ProduceSection & { t: number } {
  const count = Math.max(1, Math.round(finite(steps, 64)))
  let best = { ...sectionAt(profile, 0), t: 0 }
  for (let step = 1; step <= count; step++) {
    const t = step / count
    const section = sectionAt(profile, t)
    if (section.radius > best.radius) best = { ...section, t }
  }
  return best
}
