/**
 * assembly-geometry — taking a machine apart in the order it was put together.
 *
 * Coming apart is not a body scaled up, and it is not one motion shared by
 * every part either. Each part was fitted along an axis, in an order, and the
 * teardown is that order reversed: the last thing on goes first, and a part
 * does not start moving until the parts fitted after it are already on their
 * way out. At `progress` 0 every offset is exactly the zero vector — the
 * assembly is not nearly back together, it is back together — and at 1 every
 * part is exactly its own clearance away.
 *
 * Parts sharing an `order` are one **stage** and leave together: a whole course
 * of ribs, a handed pair of pitmans. The schedule counts stages rather than
 * parts, so adding a second pitman does not slow the teardown down.
 *
 * World axes are the set's own — `x` starboard, `y` up, `z` aft — and offsets
 * come back in them, which matters: projection is linear, so a world offset
 * projects to a pure screen offset and one schedule serves all four cameras.
 *
 * There is no collision model and no fastener model. Parts pass through each
 * other's paths the way they do in every exploded drawing, and `progress` runs
 * backwards as happily as forwards.
 *
 * Design note: docs/power-lantern.md, docs/pumpjack-teardown.md.
 */

import { clamp, type Vec3 } from "@/lib/robocn/kinematics"

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const unit3 = (v: Vec3 | undefined, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 => {
  const x = finite(v?.x ?? 0, 0)
  const y = finite(v?.y ?? 0, 0)
  const z = finite(v?.z ?? 0, 0)
  const length = Math.hypot(x, y, z)
  return length > 1e-12
    ? { x: x / length, y: y / length, z: z / length }
    : { ...fallback }
}

/** One part of an assembly, and how it was put on. */
export interface AssemblyPart {
  /** Stable name. Comes back on the exploded part, and makes a good `data-part`. */
  id: string
  /**
   * The direction it was fitted along, in world units. Need not be a unit
   * vector; a zero-length axis falls back to straight up.
   */
  axis: Vec3
  /** How far it has to travel to be clear of everything under it. */
  travel: number
  /** When it was fitted. 0 is the first part on the bench, and the last off. */
  order: number
}

/** A part of the assembly at some point in the teardown. */
export interface ExplodedPart extends AssemblyPart {
  /** Its unit fit axis. */
  direction: Vec3
  /** Where it stands in the teardown: 0 is the first part off. */
  rank: number
  /** How far through its own travel it is, 0 seated to 1 clear. */
  fraction: number
  /** How far it has actually moved, in world units. */
  distance: number
  /** Its offset from where it sits assembled, in world units. */
  offset: Vec3
}

export interface ExplodeOptions {
  /**
   * How much the parts' travel windows overlap, 0 to 1. At 0 the teardown is
   * strictly sequential — nothing moves until the part above it is clear. At 1
   * every part moves through the whole of `progress` together, which is the
   * shell-expanding look this is deliberately not. Default 0.45.
   */
  overlap?: number
}

/**
 * The fraction of its own travel the part at `rank` has made at `progress`.
 * Rank 0 leaves first. Pure, and the schedule {@link explodeAssembly} runs on.
 */
export function explodeFraction(
  rank: number,
  count: number,
  progress: number,
  overlap = 0.45,
): number {
  const total = Math.max(1, Math.round(finite(count, 1)))
  const index = clamp(Math.round(finite(rank, 0)), 0, total - 1)
  const t = clamp(finite(progress, 0), 0, 1)
  if (total === 1) return t
  // The window every part gets, between one part at a time and all at once.
  const blend = clamp(finite(overlap, 0.45), 0, 1)
  const window = (1 / total) * (1 - blend) + blend
  const stride = (1 - window) / (total - 1)
  return clamp((t - index * stride) / window, 0, 1)
}

/**
 * The assembly at `progress`, taken apart in the reverse of the order it was
 * fitted. The last part on is rank 0 and moves first; the first part on is the
 * last rank and moves last, which is what makes this read as a teardown.
 */
export function explodeAssembly(
  parts: readonly AssemblyPart[],
  progress: number,
  { overlap = 0.45 }: ExplodeOptions = {},
): ExplodedPart[] {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : []
  if (list.length === 0) return []
  // Removal order is fitting order reversed, counted in *stages* rather than in
  // parts: everything fitted at the same time — a whole course of ribs — is one
  // stage, and leaves together.
  const stages = [...new Set(list.map((part) => finite(part.order, 0)))].sort(
    (a, b) => a - b,
  )
  const count = stages.length
  const rankOf = new Map<number, number>()
  stages.forEach((order, position) => {
    rankOf.set(order, count - 1 - position)
  })

  return list.map((part) => {
    const rank = rankOf.get(finite(part.order, 0)) ?? 0
    const direction = unit3(part.axis)
    const travel = Math.max(0, finite(part.travel, 0))
    const fraction = explodeFraction(rank, count, progress, overlap)
    const distance = travel * fraction
    return {
      ...part,
      direction,
      rank,
      fraction,
      distance,
      offset: {
        x: direction.x * distance,
        y: direction.y * distance,
        z: direction.z * distance,
      },
    }
  })
}


/**
 * The world-space box an assembly needs at `progress`, given the box it needs
 * seated. Every part travels in a straight line, so the room the teardown wants
 * is the seated box grown by the furthest travel along each axis — and growing
 * it by `progress` alone means a frame fitted to it zooms out as the machine
 * comes apart and at no other time. Feeding it a pose would make the framing
 * breathe, which is the thing `fitFrame` exists to avoid.
 */
export function assemblyEnvelope(
  parts: readonly AssemblyPart[],
  progress: number,
  seated: { min: Vec3; max: Vec3 },
): { min: Vec3; max: Vec3 } {
  const t = clamp(finite(progress, 0), 0, 1)
  const min = { ...seated.min }
  const max = { ...seated.max }
  for (const part of Array.isArray(parts) ? parts.filter(Boolean) : []) {
    const direction = unit3(part.axis)
    const travel = Math.max(0, finite(part.travel, 0)) * t
    const reach = { x: direction.x * travel, y: direction.y * travel, z: direction.z * travel }
    min.x = Math.min(min.x, seated.min.x + reach.x)
    min.y = Math.min(min.y, seated.min.y + reach.y)
    min.z = Math.min(min.z, seated.min.z + reach.z)
    max.x = Math.max(max.x, seated.max.x + reach.x)
    max.y = Math.max(max.y, seated.max.y + reach.y)
    max.z = Math.max(max.z, seated.max.z + reach.z)
  }
  return { min, max }
}
