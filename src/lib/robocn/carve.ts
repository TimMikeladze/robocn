/**
 * carve-geometry — taking material *out* of a curved shell, and the light that
 * then gets out with it.
 *
 * `produce-geometry` revolves a profile and puts things on the skin: a stud, a
 * blade, a seam. Nothing in the set takes anything out of one. A carved opening
 * is a different problem in three ways, and this is those three:
 *
 * - **Authored flat, lived curved.** An outline is drawn the way a person draws
 *   a face — a triangle here, a grin there — in *shell coordinates* `{u, v}`:
 *   `u` degrees of azimuth from the front of the machine, `v` the station up the
 *   profile. {@link wrapOutline} sends every vertex through the same
 *   `profilePoint` the shell itself is drawn with, so a cut lands on the skin by
 *   construction and rides the furrows instead of floating over them.
 * - **Carving is progress along a perimeter.** A knife goes in at one point and
 *   travels round the outline: {@link carveTrace} returns the part of the loop
 *   cut so far, to the exact point the knife has reached. The loop closes at 1
 *   and only then is the plug free.
 * - **The light is paid for by the hole.** {@link lightThrough} sums the open
 *   area — measured on the wrapped polygon in world units, not in the flat
 *   authoring space — and returns the fraction of the flame that escapes and,
 *   per cut, a spill along that cut's own surface normal, reaching `√intensity`
 *   of full range because illuminance goes as the inverse square.
 *
 * {@link flameAt} is the only dynamics here: a deterministic flicker that leans
 * and guts in a draught, so a lantern with its lid off burns differently from a
 * closed one. Pure in the clock, so it is tested by sampling.
 *
 * World axes are the set's own — `x` starboard, `y` up, `z` aft — and the front
 * of the machine, where `u = 0`, is `-z`. There is no combustion model, no
 * radiosity and no thickness model beyond a constant wall. Design note:
 * docs/carved-lanterns.md.
 */

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  profilePoint,
  surfaceNormal,
  type ProduceProfile,
  type ProduceSurfaceOptions,
} from "@/lib/robocn/produce"

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const ZERO: Vec3 = { x: 0, y: 0, z: 0 }

/* -------------------------------------------------------------------------- */
/* shell coordinates                                                           */
/* -------------------------------------------------------------------------- */

/** A point on the skin: `u` degrees of azimuth from the front, `v` station 0..1. */
export interface ShellPoint {
  u: number
  v: number
}

/** A closed outline in shell coordinates, without the first point repeated. */
export interface CarveOutline {
  id: string
  points: ShellPoint[]
}

export interface CarveOptions extends ProduceSurfaceOptions {
  /** Degrees added to every `u`: which way the face is turned on the body. */
  spin?: number
}

/**
 * Shell `u` as a `produce-geometry` azimuth. Azimuth 0 there is `+z`, the tail;
 * the front of a machine is `-z`, so the face starts half a turn round, and
 * positive `u` runs to starboard from it.
 */
export const shellAzimuth = (u: number, spin = 0) =>
  180 - (finite(u, 0) + finite(spin, 0))

/** An outline wrapped onto the skin — every vertex on the surface it was cut from. */
export function wrapOutline(
  profile: ProduceProfile,
  points: readonly ShellPoint[],
  options: CarveOptions = {},
): Vec3[] {
  const list = Array.isArray(points) ? points : []
  return list.map((point) =>
    profilePoint(
      profile,
      clamp(finite(point?.v, 0), 0, 1),
      shellAzimuth(finite(point?.u, 0), options.spin),
      options,
    ),
  )
}

/* -------------------------------------------------------------------------- */
/* a cut                                                                       */
/* -------------------------------------------------------------------------- */

export interface ShellCutOptions extends CarveOptions {
  /** How thick the shell is: how far inside the rim the plug's own face sits. */
  wall?: number
}

/** One opening: where its rim runs, what falls out of it, and how big it is. */
export interface ShellCut {
  id: string
  /** The outline on the outer skin. */
  rim: Vec3[]
  /** The same loop one wall in — the piece of shell the cut frees. */
  plug: Vec3[]
  centroid: Vec3
  /** Outward surface normal at the centroid, unit length. */
  normal: Vec3
  /** Area of the opening in world units, measured on the wrapped polygon. */
  area: number
  perimeter: number
  /** Where the cut sits on the skin, for anything that needs to sort by it. */
  station: number
  azimuth: number
}

const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const norm = (v: Vec3, fallback: Vec3 = { x: 0, y: 0, z: -1 }): Vec3 => {
  const x = finite(v?.x, 0)
  const y = finite(v?.y, 0)
  const z = finite(v?.z, 0)
  const length = Math.hypot(x, y, z)
  return length > 1e-9 ? { x: x / length, y: y / length, z: z / length } : { ...fallback }
}

/** The length of a closed loop, including the edge back to where it started. */
export function cutPerimeter(points: readonly Vec3[]): number {
  const list = Array.isArray(points) ? points : []
  if (list.length < 2) return 0
  let total = 0
  for (let index = 0; index < list.length; index++) {
    const a = list[index]
    const b = list[(index + 1) % list.length]
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

/**
 * An outline as an opening in the shell: the rim on the skin, the plug one wall
 * inside it, and the area of the hole.
 *
 * The area is measured on the *wrapped* polygon — a fan of triangles from the
 * centroid, summed as half the cross product — so it is the area of the hole in
 * world units rather than of the flat drawing it was authored as. That matters
 * downstream: the light that gets out is paid for in those units.
 */
export function shellCut(
  profile: ProduceProfile,
  outline: CarveOutline,
  { wall = 2.5, ...options }: ShellCutOptions = {},
): ShellCut {
  const id = outline?.id ?? "cut"
  const points = Array.isArray(outline?.points) ? outline.points : []
  const station = clamp(mean(points.map((point) => finite(point?.v, 0))), 0, 1)
  const azimuth = mean(points.map((point) => finite(point?.u, 0)))
  const normal = norm(
    surfaceNormal(profile, station, shellAzimuth(azimuth, options.spin)),
  )

  if (points.length < 3) {
    const rim = wrapOutline(profile, points, options)
    return {
      id,
      rim,
      plug: rim.map((point) => ({ ...point })),
      centroid: rim[0] ? { ...rim[0] } : { ...ZERO },
      normal,
      area: 0,
      perimeter: 0,
      station,
      azimuth,
    }
  }

  const rim = wrapOutline(profile, points, options)
  const centroid: Vec3 = {
    x: mean(rim.map((point) => point.x)),
    y: mean(rim.map((point) => point.y)),
    z: mean(rim.map((point) => point.z)),
  }

  // Each vertex goes in along the skin's own normal *there*, so the plug is the
  // shape of the hole rather than a copy of it shrunk toward the middle.
  const depth = Math.max(0, finite(wall, 2.5))
  const plug = rim.map((point, index) => {
    const source = points[index]
    const local = norm(
      surfaceNormal(
        profile,
        clamp(finite(source?.v, station), 0, 1),
        shellAzimuth(finite(source?.u, azimuth), options.spin),
      ),
      normal,
    )
    return {
      x: point.x - local.x * depth,
      y: point.y - local.y * depth,
      z: point.z - local.z * depth,
    }
  })

  let area = 0
  for (let index = 0; index < rim.length; index++) {
    const a = sub(rim[index], centroid)
    const b = sub(rim[(index + 1) % rim.length], centroid)
    const c = cross(a, b)
    area += Math.hypot(c.x, c.y, c.z) / 2
  }

  return {
    id,
    rim,
    plug,
    centroid,
    normal,
    area: finite(area, 0),
    perimeter: cutPerimeter(rim),
    station,
    azimuth,
  }
}

/* -------------------------------------------------------------------------- */
/* carving                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The part of a closed rim that has been cut at `progress` — the loop walked
 * from its first vertex, ending exactly where the knife has reached rather than
 * at the nearest vertex. Nothing at 0; the whole loop, closed, at 1.
 */
export function carveTrace(points: readonly Vec3[], progress: number): Vec3[] {
  const list = Array.isArray(points) ? points : []
  const t = clamp(finite(progress, 0), 0, 1)
  if (list.length < 2 || t <= 0) return []
  if (t >= 1) return [...list.map((point) => ({ ...point })), { ...list[0] }]

  const perimeter = cutPerimeter(list)
  if (!(perimeter > 0)) return []
  const target = perimeter * t

  const trace: Vec3[] = [{ ...list[0] }]
  let travelled = 0
  for (let index = 0; index < list.length; index++) {
    const a = list[index]
    const b = list[(index + 1) % list.length]
    const span = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (travelled + span >= target) {
      const share = span > 0 ? (target - travelled) / span : 0
      trace.push({
        x: a.x + (b.x - a.x) * share,
        y: a.y + (b.y - a.y) * share,
        z: a.z + (b.z - a.z) * share,
      })
      return trace
    }
    travelled += span
    trace.push({ ...b })
  }
  return trace
}

/** When one feature's cut starts and finishes, on the shared progress. */
export interface CarveWindow {
  start: number
  end: number
}

/**
 * The slice of `progress` the feature at `index` is being cut over. The same
 * schedule {@link carveStage} runs on, exposed because what happens *after* a
 * feature is finished — its plug dropping away — needs to know when that was.
 */
export function carveWindow(index: number, count: number, overlap = 0.12): CarveWindow {
  const total = Math.max(1, Math.round(finite(count, 1)))
  const rank = clamp(Math.round(finite(index, 0)), 0, total - 1)
  if (total === 1) return { start: 0, end: 1 }
  const blend = clamp(finite(overlap, 0.12), 0, 1)
  const window = (1 / total) * (1 - blend) + blend
  const stride = (1 - window) / (total - 1)
  const start = rank * stride
  return { start, end: Math.min(1, start + window) }
}

/**
 * How far through its own cut the feature at `index` is, when `count` features
 * are cut one after another over one `progress`.
 *
 * Sequential by default rather than simultaneous: a person cuts an eye, then
 * the other eye, then the mouth, and the next one starts as the last plug drops
 * — which is what `overlap` buys.
 */
export function carveStage(
  index: number,
  count: number,
  progress: number,
  overlap = 0.12,
): number {
  const total = Math.max(1, Math.round(finite(count, 1)))
  const rank = clamp(Math.round(finite(index, 0)), 0, total - 1)
  const t = clamp(finite(progress, 0), 0, 1)
  if (total === 1) return t
  const blend = clamp(finite(overlap, 0.12), 0, 1)
  const window = (1 / total) * (1 - blend) + blend
  const stride = (1 - window) / (total - 1)
  return clamp((t - rank * stride) / window, 0, 1)
}

/* -------------------------------------------------------------------------- */
/* the generators                                                              */
/* -------------------------------------------------------------------------- */

export interface WedgeOptions {
  id: string
  u: number
  v: number
  /** Degrees of azimuth the wedge spans. */
  width: number
  /** Stations it spans. */
  height: number
  /** Corners: 3 is the triangle an eye or a nose is cut as. */
  sides?: number
  /** Degrees the outline is turned about its own centre. */
  tilt?: number
  /** Turn it point-up instead of point-down. */
  flip?: boolean
}

/**
 * An eye, or a nose: a regular fan of `sides` corners, point down, scaled into
 * its own patch of shell and turned about its own centre. Authored in a square
 * normalised space first, so `tilt` means the same thing whatever the aspect.
 */
export function wedgeCut({
  id,
  u,
  v,
  width,
  height,
  sides = 3,
  tilt = 0,
  flip = false,
}: WedgeOptions): CarveOutline {
  const corners = Math.max(3, Math.round(finite(sides, 3)))
  const turn = (finite(tilt, 0) * Math.PI) / 180
  const halfWidth = Math.abs(finite(width, 0)) / 2
  const halfHeight = Math.abs(finite(height, 0)) / 2
  const sense = flip ? -1 : 1
  return {
    id,
    points: Array.from({ length: corners }, (_, index) => {
      // Start at the bottom so an odd fan reads as a point-down triangle.
      const angle = -Math.PI / 2 + (index / corners) * Math.PI * 2
      const x = Math.cos(angle)
      const y = Math.sin(angle) * sense
      return {
        u: finite(u, 0) + (x * Math.cos(turn) - y * Math.sin(turn)) * halfWidth,
        v: clamp(finite(v, 0) + (x * Math.sin(turn) + y * Math.cos(turn)) * halfHeight, 0, 1),
      }
    }),
  }
}

export interface ToothedMouthOptions {
  id: string
  u: number
  v: number
  width: number
  height: number
  /** Tabs left standing on the top edge. The bottom edge gets the gaps. */
  teeth?: number
  /** How far a tooth reaches across the band, 0 none to 1 the whole of it. */
  bite?: number
  /** How wide a tooth is at its root, as a fraction of its cell. */
  tooth?: number
  /** How far the middle of the mouth drops: positive grins, negative frowns. */
  sag?: number
}

/**
 * A grin: a band with `teeth` triangular tabs left standing on the top edge and
 * the same again on the bottom, offset half a tooth so the two rows interlock
 * rather than meet. Because the rows stand at different azimuths, a tooth can
 * reach right across the band without the outline ever crossing itself — which
 * is the difference between a mouth with teeth in it and a zig-zag ribbon.
 *
 * The tab count is the input, so a four-tooth grin and a nine-tooth grin are
 * the same function.
 */
export function toothedMouth({
  id,
  u,
  v,
  width,
  height,
  teeth = 4,
  bite = 0.72,
  tooth = 0.46,
  sag = 0,
}: ToothedMouthOptions): CarveOutline {
  const count = clamp(Math.round(finite(teeth, 4)), 1, 24)
  const span = Math.abs(finite(width, 0))
  const half = span / 2
  const tall = Math.abs(finite(height, 0))
  const reach = clamp(finite(bite, 0.72), 0, 0.95) * tall
  const drop = finite(sag, 0)
  const centre = finite(u, 0)
  const middle = finite(v, 0)
  const cell = span / count
  const root = (clamp(finite(tooth, 0.46), 0.05, 0.9) * cell) / 2

  // The mouth follows the face round: the ends ride up, the middle drops.
  const lip = (offset: number, edge: 1 | -1) => {
    const across = span > 0 ? clamp(offset / half, -1, 1) : 0
    return clamp(middle + (edge * tall) / 2 - drop * (1 - across * across), 0, 1)
  }
  const at = (offset: number, edge: 1 | -1, into = 0): ShellPoint => ({
    u: centre + offset,
    v: clamp(lip(offset, edge) - edge * into, 0, 1),
  })

  const points: ShellPoint[] = [at(-half, 1)]
  // Top edge, left to right: a tab hanging into the middle of each cell.
  for (let index = 0; index < count; index++) {
    const apex = -half + (index + 0.5) * cell
    points.push(at(apex - root, 1), at(apex, 1, reach), at(apex + root, 1))
  }
  points.push(at(half, 1), at(half, -1))
  // Bottom edge, right to left, its tabs standing under the gaps above.
  for (let index = count - 1; index >= 0; index--) {
    const apex = -half + index * cell + cell
    if (apex + root >= half) continue
    points.push(at(apex + root, -1), at(apex, -1, reach), at(apex - root, -1))
  }
  points.push(at(-half, -1))

  return { id, points }
}

export interface ScallopedRimOptions {
  id: string
  /** The station the rim runs round. */
  v: number
  scallops?: number
  /** How far a scallop rises and falls, in stations. */
  amplitude?: number
  /** Samples per scallop. */
  steps?: number
  /** How much deeper the key notch is cut than a scallop crest, as a multiple of the scallop. Under 2 and a trough is deeper than the key, so the lid has more than one seat. */
  key?: number
  /** Degrees either side of the front the key notch spans. */
  keyArc?: number
}

/**
 * The lid cut: a closed ring at one station with a zig-zag in it, and one notch
 * at the front cut deeper than any scallop — the key, which is what makes a lid
 * seat in exactly one orientation instead of spinning freely on its own rim.
 */
export function scallopedRim({
  id,
  v,
  scallops = 7,
  amplitude = 0.02,
  steps = 5,
  key = 3.2,
  keyArc = 11,
}: ScallopedRimOptions): CarveOutline {
  const waves = clamp(Math.round(finite(scallops, 7)), 2, 24)
  const rise = Math.abs(finite(amplitude, 0.02))
  const samples = Math.max(2, Math.round(finite(steps, 5)))
  const notch = Math.max(0, finite(key, 3.2)) * rise
  const arc = Math.max(1, Math.abs(finite(keyArc, 11)))
  const station = clamp(finite(v, 0.8), 0, 1)
  const count = waves * samples

  return {
    id,
    points: Array.from({ length: count }, (_, index) => {
      const u = -180 + (360 * index) / count
      const scallop = Math.cos((waves * u * Math.PI) / 180) * rise
      const keyed = notch * Math.max(0, 1 - Math.abs(u) / arc)
      return { u, v: clamp(station + scallop - keyed, 0, 1) }
    }),
  }
}

/* -------------------------------------------------------------------------- */
/* the faces                                                                   */
/* -------------------------------------------------------------------------- */

export type FaceName = "classic" | "grin" | "scowl" | "sly" | "blank"

export interface FaceOptions {
  /** Teeth left standing in the mouth. */
  teeth?: number
  /** Stations the whole face slides up or down the body. */
  lift?: number
}

/**
 * The faces the set ships, in **cut order** — eyes first, mouth last, the way a
 * person cuts one. Every feature is a generator call rather than a drawing, so
 * a face is a set of numbers and a nine-tooth grin costs nothing to ask for.
 * `blank` is no face at all, for a shell somebody is going to cut by hand.
 */
export function facePattern(name: FaceName = "classic", options: FaceOptions = {}): CarveOutline[] {
  const teeth = clamp(Math.round(finite(options?.teeth ?? 4, 4)), 1, 12)
  const lift = clamp(finite(options?.lift ?? 0, 0), -0.3, 0.3)
  const at = (v: number) => clamp(v + lift, 0.05, 0.95)

  switch (name) {
    // Nothing cut at all: a gourd for somebody to carve themselves.
    case "blank":
      return []
    case "grin":
      return [
        wedgeCut({ id: "eye-port", u: -24, v: at(0.66), width: 25, height: 0.14, sides: 6, tilt: 8 }),
        wedgeCut({ id: "eye-starboard", u: 24, v: at(0.66), width: 25, height: 0.14, sides: 6, tilt: -8 }),
        wedgeCut({ id: "nose", u: 0, v: at(0.56), width: 13, height: 0.08, flip: true }),
        toothedMouth({ id: "mouth", u: 0, v: at(0.44), width: 102, height: 0.2, teeth: teeth + 2, bite: 0.62, tooth: 0.38, sag: 0.05 }),
      ]
    case "scowl":
      return [
        wedgeCut({ id: "eye-port", u: -23, v: at(0.66), width: 27, height: 0.14, tilt: -26 }),
        wedgeCut({ id: "eye-starboard", u: 23, v: at(0.66), width: 27, height: 0.14, tilt: 26 }),
        wedgeCut({ id: "nose", u: 0, v: at(0.56), width: 15, height: 0.09, tilt: 180 }),
        toothedMouth({ id: "mouth", u: 0, v: at(0.45), width: 82, height: 0.17, teeth, bite: 0.8, tooth: 0.55, sag: -0.04 }),
      ]
    case "sly":
      return [
        wedgeCut({ id: "eye-port", u: -25, v: at(0.65), width: 28, height: 0.08, tilt: -14 }),
        wedgeCut({ id: "eye-starboard", u: 22, v: at(0.67), width: 21, height: 0.16, sides: 4, tilt: 30 }),
        wedgeCut({ id: "nose", u: 2, v: at(0.56), width: 12, height: 0.08, flip: true, tilt: 12 }),
        toothedMouth({ id: "mouth", u: 6, v: at(0.45), width: 78, height: 0.17, teeth, bite: 0.68, sag: 0.06 }),
      ]
    default:
      return [
        wedgeCut({ id: "eye-port", u: -24, v: at(0.67), width: 27, height: 0.18 }),
        wedgeCut({ id: "eye-starboard", u: 24, v: at(0.67), width: 27, height: 0.18 }),
        wedgeCut({ id: "nose", u: 0, v: at(0.56), width: 14, height: 0.09, flip: true }),
        toothedMouth({ id: "mouth", u: 0, v: at(0.45), width: 88, height: 0.19, teeth, bite: 0.72, sag: 0.035 }),
      ]
  }
}

/* -------------------------------------------------------------------------- */
/* picking, and cutting by hand                                                */
/* -------------------------------------------------------------------------- */

/** Where a pointer landed on the skin, and how sure that is. */
export interface ShellPick {
  /** Whether anything on the near face was within `tolerance` of the target. */
  hit: boolean
  u: number
  v: number
  point: Vec3
  normal: Vec3
  /** How far the projected surface point missed, in the projection's own units. */
  distance: number
}

export interface PickOptions extends CarveOptions {
  /**
   * Which way the camera is looking, as the depth of a direction: only surface
   * whose normal comes back positive is considered, so a pointer never lands on
   * the back of the shell it is pointing at.
   */
  depth?: (vector: Vec3) => number
  /** Samples round the axis, and up the profile, in the coarse pass. */
  steps?: number
  rings?: number
  /** How close counts as a hit, in the projection's units. */
  tolerance?: number
  /**
   * Where the last pick landed. A projection is not one-to-one — near the limb
   * two places on the near face can sit under the same pixel — so a drag that
   * ignored where it just was would jump between them. The seed breaks those
   * ties in favour of staying put, and never overrides a clearly better match.
   */
  seed?: ShellPoint
  /** How hard the seed pulls, in projection units per whole turn away from it. */
  seedBias?: number
}

/**
 * The point on the skin under a projected position — the inverse of drawing it.
 *
 * There is no closed form: the surface is a lobed body of revolution behind an
 * arbitrary projection, so this is a coarse sweep of the near face followed by
 * four halving refinements about the best sample. Each refinement is a 5 × 5
 * grid over a window that halves, so the answer lands well inside a pixel long
 * before it runs out of rounds — and it is a *search*, not a formula, which is
 * why it reports the distance it settled at rather than claiming a hit.
 */
export function pickShell(
  profile: ProduceProfile,
  project: (point: Vec3) => Vec2,
  target: Vec2,
  {
    depth,
    steps = 72,
    rings = 36,
    tolerance = 8,
    seed,
    seedBias = 2.5,
    ...options
  }: PickOptions = {},
): ShellPick {
  const aimed = Number.isFinite(target?.x) && Number.isFinite(target?.y)
  const wanted = { x: finite(target?.x, 0), y: finite(target?.y, 0) }
  const from = clamp(finite(options.from ?? 0, 0), 0, 1)
  const to = clamp(finite(options.to ?? 1, 1), 0, 1)
  const around = Math.max(8, Math.round(finite(steps, 72)))
  const up = Math.max(4, Math.round(finite(rings, 36)))

  const pull = Math.max(0, finite(seedBias, 2.5))
  const anchor = seed
    ? { u: finite(seed.u, 0), v: clamp(finite(seed.v, 0.5), 0, 1) }
    : null
  const miss = (u: number, v: number) => {
    const normal = surfaceNormal(profile, v, shellAzimuth(u, options.spin))
    if (depth && !(depth(normal) > 0)) return Number.POSITIVE_INFINITY
    const screen = project(
      profilePoint(profile, v, shellAzimuth(u, options.spin), options),
    )
    const gap = Math.hypot(screen.x - wanted.x, screen.y - wanted.y)
    if (!anchor) return gap
    // Shortest way round: 350° and 10° are twenty degrees apart.
    const turn = Math.abs(((((u - anchor.u) % 360) + 540) % 360) - 180) / 360
    return gap + pull * Math.hypot(turn, anchor.v - v)
  }

  // The coarse pass keeps several *separated* candidates rather than one best:
  // a projection folds the near face over itself near the limb, and the cell
  // that wins on a 5° grid is not always the one the true answer is in.
  const candidates: { u: number; v: number; miss: number }[] = []
  const KEEP = 4
  const consider = (u: number, v: number, distance: number) => {
    if (!Number.isFinite(distance)) return
    const apartFrom = (other: { u: number; v: number }) =>
      Math.abs(((((u - other.u) % 360) + 540) % 360) - 180) > 12 ||
      Math.abs(v - other.v) > 0.06
    const near = candidates.findIndex((entry) => !apartFrom(entry))
    if (near >= 0) {
      if (distance < candidates[near].miss) candidates[near] = { u, v, miss: distance }
    } else if (candidates.length < KEEP) {
      candidates.push({ u, v, miss: distance })
    } else {
      let worst = 0
      for (let index = 1; index < candidates.length; index++) {
        if (candidates[index].miss > candidates[worst].miss) worst = index
      }
      if (distance < candidates[worst].miss) candidates[worst] = { u, v, miss: distance }
    }
  }

  for (let ring = 0; ring <= up; ring++) {
    const v = from + ((to - from) * ring) / up
    for (let step = 0; step < around; step++) {
      const u = -180 + (360 * step) / around
      consider(u, v, miss(u, v))
    }
  }

  let bestU = 0
  let bestV = (from + to) / 2
  let best = Number.POSITIVE_INFINITY
  // Refine: the coarse pass only has to land each candidate in the right cell.
  for (const candidate of candidates) {
    let u = candidate.u
    let v = candidate.v
    let distance = candidate.miss
    let windowU = 360 / around
    let windowV = (to - from) / up
    for (let round = 0; round < 5; round++) {
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const tryU = u + (i * windowU) / 2
          const tryV = clamp(v + (j * windowV) / 2, from, to)
          const tried = miss(tryU, tryV)
          if (tried < distance) {
            distance = tried
            u = tryU
            v = tryV
          }
        }
      }
      windowU /= 2
      windowV /= 2
    }
    if (distance < best) {
      best = distance
      bestU = u
      bestV = v
    }
  }

  const u = ((((bestU + 180) % 360) + 360) % 360) - 180
  return {
    hit: aimed && Number.isFinite(best) && best <= Math.abs(finite(tolerance, 8)),
    u,
    v: bestV,
    point: profilePoint(profile, bestV, shellAzimuth(u, options.spin), options),
    normal: norm(surfaceNormal(profile, bestV, shellAzimuth(u, options.spin))),
    distance: Number.isFinite(best) ? best : Number.POSITIVE_INFINITY,
  }
}

export interface StrokeOptions {
  /**
   * How many degrees of `u` are as long, on the skin, as one station of `v` —
   * the metric that makes a nib round on the shell rather than round in the
   * authoring space. Larger means the shell is wide for its height.
   */
  aspect?: number
  /** Nib width, in stations. */
  width?: number
  /** Points in each end cap. */
  capSteps?: number
}

/**
 * The outline a knife of some width leaves, drawn along a path across the skin.
 *
 * A stroke is offset to both sides in a space where `u` and `v` are the same
 * length — otherwise a nib that is round at the equator is a slot at the crown
 * — and closed with a round cap at each end, so a single tap is a disc and a
 * drag is a slot with hemispherical ends. Consecutive points closer together
 * than a third of the nib are dropped, because the jitter between two pointer
 * samples is what turns an offset ribbon inside out.
 */
export function strokeOutline(
  points: readonly ShellPoint[],
  { aspect = 4, width = 0.05, capSteps = 7 }: StrokeOptions = {},
): ShellPoint[] {
  const scale = Math.max(1e-6, Math.abs(finite(aspect, 4)))
  const half = Math.max(1e-4, Math.abs(finite(width, 0.05)) / 2)
  const caps = Math.max(2, Math.round(finite(capSteps, 7)))
  // Into a square space: x is u scaled to v's units, y is v.
  const path: Vec2[] = []
  for (const point of Array.isArray(points) ? points : []) {
    const next = { x: finite(point?.u, 0) / scale, y: clamp(finite(point?.v, 0), 0, 1) }
    const last = path[path.length - 1]
    if (!last || Math.hypot(next.x - last.x, next.y - last.y) > half * 0.66) {
      path.push(next)
    }
  }
  if (path.length === 0) return []

  const out = (point: Vec2): ShellPoint => ({ u: point.x * scale, v: clamp(point.y, 0, 1) })
  const arc = (centre: Vec2, fromAngle: number, sweep: number): Vec2[] =>
    Array.from({ length: caps }, (_, index) => {
      const angle = fromAngle + (sweep * index) / (caps - 1)
      return {
        x: centre.x + Math.cos(angle) * half,
        y: centre.y + Math.sin(angle) * half,
      }
    })

  // A tap: one disc, which is what a single press cuts.
  if (path.length === 1) {
    return arc(path[0], 0, Math.PI * 2 * ((caps * 2 - 1) / (caps * 2))).map(out)
  }

  const heading = (index: number) => {
    const a = path[Math.max(0, index - (index === path.length - 1 ? 1 : 0))]
    const b = path[Math.min(path.length - 1, index + (index === path.length - 1 ? 0 : 1))]
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    return Number.isFinite(angle) ? angle : 0
  }

  const left: Vec2[] = []
  const right: Vec2[] = []
  for (let index = 0; index < path.length; index++) {
    const angle = heading(index)
    const nx = -Math.sin(angle) * half
    const ny = Math.cos(angle) * half
    left.push({ x: path[index].x + nx, y: path[index].y + ny })
    right.push({ x: path[index].x - nx, y: path[index].y - ny })
  }
  const head = heading(path.length - 1)
  const tail = heading(0)
  return [
    ...left,
    ...arc(path[path.length - 1], head + Math.PI / 2, -Math.PI),
    ...right.reverse(),
    ...arc(path[0], tail - Math.PI / 2, -Math.PI),
  ].map(out)
}

/**
 * How many degrees of azimuth are as long as one station of the profile, at a
 * given station — the `aspect` {@link strokeOutline} wants, taken from the
 * shell itself rather than guessed.
 */
export function shellAspect(profile: ProduceProfile, v: number): number {
  const station = clamp(finite(v, 0.5), 0, 1)
  const step = 1e-3
  const low = profile(Math.max(0, station - step))
  const high = profile(Math.min(1, station + step))
  const rise = Math.abs(finite(high?.height, 0) - finite(low?.height, 0)) / (2 * step)
  const radius = Math.max(1e-6, finite(profile(station)?.radius, 1))
  const perDegree = (radius * Math.PI) / 180
  return Math.max(1e-6, rise > 0 ? rise / perDegree : 1 / perDegree)
}

/* -------------------------------------------------------------------------- */
/* the light that gets out                                                     */
/* -------------------------------------------------------------------------- */

/** An opening, as far as the light is concerned. */
export interface CutAperture {
  id: string
  /** Area of the whole opening, in world units. */
  area: number
  /** How much of it is actually cut through, 0 to 1. */
  open: number
  centroid: Vec3
  normal: Vec3
}

/** What comes out of one opening. */
export interface CutSpill {
  id: string
  /** Its share of the light that gets out at all; the shares sum to one. */
  share: number
  /** What it is passing: the flame, times that share. */
  intensity: number
  reach: number
  halfWidth: number
  direction: Vec3
  origin: Vec3
}

export interface ShellLightOptions {
  /** Surface area of the whole shell — `lateralArea` of the profile. */
  shellArea: number
  /** Half-angle of a spill at full intensity, in degrees. */
  spread?: number
  /** How far a spill reaches at full intensity. */
  length?: number
}

export interface ShellLight {
  /** How much hole there is, in world units. */
  openArea: number
  /**
   * The fraction of the flame that leaves the shell: for a source in the middle
   * of a closed shell, the share of its solid angle the holes cover.
   */
  escape: number
  spills: CutSpill[]
}

/**
 * The light through the cuts. Nothing is invented: a shell with no cuts in it
 * emits nothing however hard the candle burns, and the cuts divide one flame
 * between them by area rather than each getting a whole one.
 *
 * Reach is inverse-square — a fixed threshold is met at `√intensity` of the
 * full-power distance — so the mouth throws further than an eye by the square
 * root of the area between them, not by the ratio itself.
 */
export function lightThrough(
  apertures: readonly CutAperture[],
  flame: number,
  { shellArea, spread = 24, length = 90 }: ShellLightOptions,
): ShellLight {
  const list = (Array.isArray(apertures) ? apertures : []).map((aperture) => ({
    id: aperture?.id ?? "cut",
    open:
      Math.max(0, finite(aperture?.area, 0)) * clamp(finite(aperture?.open, 0), 0, 1),
    centroid: {
      x: finite(aperture?.centroid?.x, 0),
      y: finite(aperture?.centroid?.y, 0),
      z: finite(aperture?.centroid?.z, 0),
    },
    normal: norm(aperture?.normal),
  }))
  const openArea = list.reduce((sum, aperture) => sum + aperture.open, 0)
  const skin = Math.max(0, finite(shellArea, 0))
  const burn = clamp(finite(flame, 0), 0, 1)
  const throwLength = Math.max(0, finite(length, 90))
  const half = (Math.abs(finite(spread, 24)) * Math.PI) / 180

  return {
    openArea,
    escape: skin > 0 ? clamp(openArea / skin, 0, 1) : 0,
    spills: list.map((aperture) => {
      const share = openArea > 0 ? aperture.open / openArea : 0
      const intensity = clamp(burn * share, 0, 1)
      const reach = throwLength * Math.sqrt(intensity)
      return {
        id: aperture.id,
        share,
        intensity,
        reach,
        halfWidth: Math.tan(half) * reach,
        direction: aperture.normal,
        origin: aperture.centroid,
      }
    }),
  }
}

/* -------------------------------------------------------------------------- */
/* the flame                                                                   */
/* -------------------------------------------------------------------------- */

export interface FlameOptions {
  /**
   * How much air is getting at it, 0 shut to 1 wide open. Taking a lid off is a
   * draught: the flame leans, shortens and dims.
   */
  draught?: number
}

export interface FlameState {
  /** What the flame is putting out, 0 to 1. */
  intensity: number
  /** How tall it is standing, as a multiple of its still height. */
  height: number
  /** Degrees it leans from vertical, positive to starboard. */
  lean: number
}

/**
 * The candle at `clock`. Three incommensurate sines, so the flicker never lands
 * on a beat and never repeats over any cycle a viewer can spot, and every term
 * is a pure function of the clock — which is what lets the tests sample it
 * rather than fake animation frames.
 */
export function flameAt(clock: number, { draught = 0 }: FlameOptions = {}): FlameState {
  const t = finite(clock, 0)
  const air = clamp(finite(draught, 0), 0, 1)
  const flicker =
    0.5 +
    0.5 *
      (0.55 * Math.sin(t * 7.7) +
        0.32 * Math.sin(t * 13.31 + 1.7) +
        0.13 * Math.sin(t * 23.13 + 0.4))
  // A draught both robs the flame and shakes it: the shake is what a person
  // actually reads as "the lid is off".
  const gust = 0.8 + 0.2 * Math.sin(t * 5.1)
  return {
    intensity: clamp(0.58 + 0.38 * flicker - 0.34 * air, 0, 1),
    height: (0.82 + 0.3 * flicker) * (1 - 0.42 * air),
    lean: air * 28 * gust + 1.5 * Math.sin(t * 3.3) * (0.3 + 0.7 * air),
  }
}
