/**
 * phyllotaxis-geometry — the golden-angle disc, and the two-axis aim that
 * points it at something.
 *
 * Two ideas, both of them things the set did not have:
 *
 * - a **lattice whose structure is a consequence rather than a decision**. Sites
 *   are placed by one rule — turn `137.507…°` and step out as `√n` — and the
 *   spiral arms everyone sees in a sunflower head are then *found* in the
 *   result by `parastichyOffsets`, which reports the index steps whose
 *   neighbours are closest. Those steps come out consecutive Fibonacci numbers
 *   because the angle says so, not because anything here chose them;
 * - a **two-axis aim solved from a direction**. The light is a vector;
 *   `aimFrom` turns it into an azimuth and an elevation, `trackerFrame` turns
 *   the pair back into the head's own axes, and `framePoint` writes geometry in
 *   that frame. Because the round trip is exact, every part carried on the head
 *   agrees about where the light is.
 *
 * World axes are the set's: `x` starboard, `y` up, `z` toward the tail, with
 * machines facing `−z`. Azimuth 0 therefore faces the `front` camera and
 * elevation 90 is straight up.
 *
 * Nothing here models a plant or the sun. Design note:
 * docs/heliotropic-collector.md.
 */

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"

/** The angle a sunflower turns between one floret and the next, in degrees. */
export const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5))

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

/* -------------------------------------------------------------------------- */
/* the lattice                                                                 */
/* -------------------------------------------------------------------------- */

/** One floret site, in the disc's own plane: `x` right, `y` up the face. */
export interface PhyllotaxisSite {
  index: number
  /** Distance from the centre of the disc, in world units. */
  radius: number
  /** Degrees round the face, unwrapped, so arm 0 keeps climbing. */
  angle: number
  position: Vec2
}

export interface VogelDiscOptions {
  /** Radius of the outermost site. */
  radius?: number
  /** Sites closer in than this are never placed — the bare eye of the head. */
  innerRadius?: number
  /** Turns the whole pattern, in degrees. */
  rotation?: number
}

/**
 * The lattice: `angle = n · 137.507…°`, `radius = √(n + ½)` scaled to fit.
 *
 * The square root is the whole point. Area inside a radius goes as `r²`, so a
 * radius stepping as `√n` puts the same number of sites in every annulus of
 * equal area — the florets are evenly spread over the *face* rather than over
 * the parameter, which is what stops them piling up in the middle.
 */
export function vogelDisc(
  count: number,
  { radius = 1, innerRadius = 0, rotation = 0 }: VogelDiscOptions = {},
): PhyllotaxisSite[] {
  const sites = Math.max(0, Math.round(finite(count, 0)))
  if (sites === 0) return []
  const outer = Math.max(0, finite(radius, 1))
  const inner = clamp(finite(innerRadius, 0), 0, outer)
  const turn = finite(rotation, 0)
  // Equal area per site between the two radii: r² runs linearly in n.
  const span = outer * outer - inner * inner
  return Array.from({ length: sites }, (_, index) => {
    const r = Math.sqrt(inner * inner + (span * (index + 0.5)) / sites)
    const angle = turn + index * GOLDEN_ANGLE
    const a = (angle * Math.PI) / 180
    return {
      index,
      radius: r,
      angle,
      position: { x: r * Math.cos(a), y: r * Math.sin(a) },
    }
  })
}

/**
 * The index steps that are nearest neighbours — the spiral-arm families.
 *
 * Take a site well away from the eye and the rim, measure the distance to
 * `index ± k` for every small `k`, and keep the `k`s whose neighbour is
 * closest. Those are the steps that trace a visible arm, and on a golden-angle
 * disc they come out as consecutive Fibonacci numbers. Nothing in here knows
 * that; it is what the angle does.
 */
export function parastichyOffsets(
  sites: readonly PhyllotaxisSite[],
  families = 2,
): number[] {
  const wanted = Math.max(1, Math.round(finite(families, 2)))
  if (sites.length < 8) return []
  // Two thirds out: past the crowded eye, inside the rim where a site loses
  // half its neighbours to the edge.
  const pivot = Math.min(sites.length - 2, Math.max(3, Math.round(sites.length * 0.66)))
  const origin = sites[pivot]
  const reach = Math.min(pivot, sites.length - pivot - 1)
  const measured: { step: number; distance: number }[] = []
  for (let step = 1; step <= reach; step++) {
    const before = sites[pivot - step]
    const after = sites[pivot + step]
    const distance = Math.min(gap(origin, before), gap(origin, after))
    measured.push({ step, distance })
  }
  measured.sort((a, b) => a.distance - b.distance)
  return measured
    .slice(0, wanted)
    .map((entry) => entry.step)
    .sort((a, b) => a - b)
}

const gap = (a: PhyllotaxisSite, b: PhyllotaxisSite) =>
  Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)

/**
 * One spiral arm: the chain of sites stepping by `step` from `start`. Drawn,
 * this is the curve the eye already sees in the lattice.
 */
export function spiralArm(
  sites: readonly PhyllotaxisSite[],
  start: number,
  step: number,
): PhyllotaxisSite[] {
  const stride = Math.max(1, Math.round(finite(step, 1)))
  const from = Math.max(0, Math.round(finite(start, 0)))
  const arm: PhyllotaxisSite[] = []
  for (let index = from; index < sites.length; index += stride) arm.push(sites[index])
  return arm
}

/* -------------------------------------------------------------------------- */
/* the dish                                                                    */
/* -------------------------------------------------------------------------- */

export interface DiscDishOptions {
  /** How far the rim leads the centre, in world units. Zero is a flat face. */
  dish?: number
  /** Radius the dish depth is quoted at. */
  extent?: number
}

/** Where a site sits on the dished face, and which way that patch of face looks. */
export interface DiscDishPoint {
  /** Along the face normal: positive is toward the light. */
  offset: number
  /** Unit normal in the disc's own frame — `x`, `y` in the face, `z` out of it. */
  normal: Vec3
}

/**
 * The shallow paraboloid the florets are set into: `offset = dish · (r/extent)²`.
 *
 * The rim leading the centre is what makes it a dish, and it is why every
 * floret's normal leans inward — a head aimed at the light has its edge cells
 * looking slightly across it, which is visible the moment the head turns away.
 */
export function discDish(
  site: { radius: number; angle: number },
  { dish = 0, extent = 1 }: DiscDishOptions = {},
): DiscDishPoint {
  const depth = finite(dish, 0)
  const scale = Math.max(1e-6, finite(extent, 1))
  const r = Math.max(0, finite(site?.radius, 0))
  const a = (finite(site?.angle, 0) * Math.PI) / 180
  const offset = (depth * r * r) / (scale * scale)
  // Surface z = f(r) has normal ∝ (−f'(r)·r̂, 1); f'(r) = 2·depth·r/extent².
  const slope = (2 * depth * r) / (scale * scale)
  const length = Math.hypot(slope, 1)
  return {
    offset,
    normal: {
      x: (-slope * Math.cos(a)) / length,
      y: (-slope * Math.sin(a)) / length,
      z: 1 / length,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* the aim                                                                     */
/* -------------------------------------------------------------------------- */

/** Where a two-axis tracker stands: yaw about the vertical, then pitch. */
export interface TrackerAim {
  /** Degrees clockwise from the face (`−z`), seen from above. */
  azimuth: number
  /** Degrees above the horizon, −90 to 90. */
  elevation: number
}

/** The neutral aim: straight at the front camera, level. */
export const levelAim: TrackerAim = { azimuth: 0, elevation: 0 }

/** Where a tracker has to stand to look along `direction`. */
export function aimFrom(direction: Vec3): TrackerAim {
  const x = finite(direction?.x, 0)
  const y = finite(direction?.y, 0)
  const z = finite(direction?.z, 0)
  const length = Math.hypot(x, y, z)
  // A direction with no direction in it is not an aim: park level and facing.
  if (!(length > 1e-9)) return { ...levelAim }
  return {
    azimuth: (Math.atan2(x, -z) * 180) / Math.PI,
    elevation: (Math.asin(clamp(y / length, -1, 1)) * 180) / Math.PI,
  }
}

/** The unit direction a tracker at `aim` is looking along. */
export function aimDirection(aim: TrackerAim): Vec3 {
  const a = (finite(aim?.azimuth, 0) * Math.PI) / 180
  const e = (clamp(finite(aim?.elevation, 0), -90, 90) * Math.PI) / 180
  const ce = Math.cos(e)
  return { x: Math.sin(a) * ce, y: Math.sin(e), z: -Math.cos(a) * ce }
}

/** The head's own axes, in the world. */
export interface TrackerFrame {
  right: Vec3
  up: Vec3
  forward: Vec3
}

/**
 * The frame a head carried on that aim works in: `forward` is exactly
 * `aimDirection(aim)`, `right` stays horizontal — a tracker's yaw ring is
 * level however far it pitches — and `up` closes the right-handed set, so
 * `right × forward = up`.
 */
export function trackerFrame(aim: TrackerAim): TrackerFrame {
  const a = (finite(aim?.azimuth, 0) * Math.PI) / 180
  const forward = aimDirection(aim)
  const right = { x: Math.cos(a), y: 0, z: Math.sin(a) }
  return {
    right,
    up: {
      x: right.y * forward.z - right.z * forward.y,
      y: right.z * forward.x - right.x * forward.z,
      z: right.x * forward.y - right.y * forward.x,
    },
    forward,
  }
}

/** A point written in the head's own frame, placed in the world. */
export function framePoint(frame: TrackerFrame, origin: Vec3, local: Vec3): Vec3 {
  const x = finite(local?.x, 0)
  const y = finite(local?.y, 0)
  const z = finite(local?.z, 0)
  return {
    x: finite(origin?.x, 0) + frame.right.x * x + frame.up.x * y + frame.forward.x * z,
    y: finite(origin?.y, 0) + frame.right.y * x + frame.up.y * y + frame.forward.y * z,
    z: finite(origin?.z, 0) + frame.right.z * x + frame.up.z * y + frame.forward.z * z,
  }
}

/** A direction written in the head's own frame, turned into the world. */
export const frameDirection = (frame: TrackerFrame, local: Vec3): Vec3 =>
  framePoint(frame, { x: 0, y: 0, z: 0 }, local)

/* -------------------------------------------------------------------------- */
/* the rays                                                                    */
/* -------------------------------------------------------------------------- */

export interface RayFloretOptions {
  /** Radius of the rim they are hinged on. */
  radius: number
  length: number
  /** Blade width at the root. */
  width: number
  /** Tip width as a fraction of the root. */
  taper?: number
  /** Degrees out of the face: positive lifts the tips toward the light. */
  pitch?: number
  /** Azimuth of the first ray, in degrees. */
  start?: number
}

/** One petal, in the disc's own frame: `x`, `y` in the face, `z` out of it. */
export interface RayFloret {
  index: number
  angle: number
  root: Vec3
  tip: Vec3
  /** Root-left, tip-left, tip-right, root-right. */
  corners: Vec3[]
}

/**
 * Petals hinged on the rim. The blade is rigid — its length is exact at every
 * pitch, which is the difference between a hinge and a picture of one — so
 * furling the head shortens the *silhouette* rather than the petal.
 */
export function rayFlorets(count: number, options: RayFloretOptions): RayFloret[] {
  const rays = Math.max(0, Math.round(finite(count, 0)))
  if (rays === 0) return []
  const radius = Math.max(0, finite(options?.radius, 0))
  const length = Math.max(0, finite(options?.length, 0))
  const width = Math.max(0, finite(options?.width, 0))
  const taper = clamp(finite(options?.taper ?? 0.4, 0.4), 0, 2)
  const pitch = clamp(finite(options?.pitch ?? 0, 0), -180, 180)
  const start = finite(options?.start ?? 0, 0)
  const rise = (pitch * Math.PI) / 180
  const reach = Math.cos(rise) * length
  const climb = Math.sin(rise) * length

  return Array.from({ length: rays }, (_, index) => {
    const angle = start + (index / rays) * 360
    const a = (angle * Math.PI) / 180
    const out = { x: Math.cos(a), y: Math.sin(a) }
    const across = { x: -Math.sin(a), y: Math.cos(a) }
    const root: Vec3 = { x: out.x * radius, y: out.y * radius, z: 0 }
    const tip: Vec3 = {
      x: root.x + out.x * reach,
      y: root.y + out.y * reach,
      z: climb,
    }
    const half = width / 2
    const tipHalf = half * taper
    return {
      index,
      angle,
      root,
      tip,
      corners: [
        { x: root.x + across.x * half, y: root.y + across.y * half, z: root.z },
        { x: tip.x + across.x * tipHalf, y: tip.y + across.y * tipHalf, z: tip.z },
        { x: tip.x - across.x * tipHalf, y: tip.y - across.y * tipHalf, z: tip.z },
        { x: root.x - across.x * half, y: root.y - across.y * half, z: root.z },
      ],
    }
  })
}
