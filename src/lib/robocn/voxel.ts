/**
 * Voxel geometry — continuous occupancy fields, sampled into buildable cells.
 *
 * A shape here is not a mesh or a stored grid: it is a function over the unit
 * cube, `voxelOccupies(shape, u, v, w)`. Sampling it at resolution N gives the
 * cells a fabricator would deposit, and the sampled solid converges on the
 * field as N grows — the resolution ceiling below is a drawing budget, not a
 * limit of the geometry.
 *
 * Coordinates are normalised to [-1, 1] with `v` up, matching the world axes
 * the rest of robocn draws in: x starboard, y up, z toward the tail.
 */

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { extrudedPath, px, type RobotCamera } from "@/lib/robocn/style"

export type VoxelShape =
  | "sphere"
  | "block"
  | "pyramid"
  | "gear"
  | "vessel"
  | "lattice"

/** Cells along one edge. The ceiling is quadratic in drawn paths, so it is low. */
export const VOXEL_MIN_RESOLUTION = 2
export const VOXEL_MAX_RESOLUTION = 14
export const VOXEL_DEFAULT_RESOLUTION = 6

const shapes = new Set<VoxelShape>([
  "sphere",
  "block",
  "pyramid",
  "gear",
  "vessel",
  "lattice",
])

/** Integer grid indices, 0 to `resolution - 1`, with `y` counting up. */
export interface VoxelCell {
  x: number
  y: number
  z: number
}

/** A laid cell with at least one open face, and whether the open one is the top. */
export interface VoxelSurface extends VoxelCell {
  /** Nothing sits on this cell yet, so its upper face reads as the lit one. */
  top: boolean
}

export interface VoxelSolidOptions {
  shape?: VoxelShape
  /** Cells along one edge, rounded and clamped. */
  resolution?: number
}

export interface VoxelSolid {
  shape: VoxelShape
  resolution: number
  /** Cell edge length in normalised units, so the solid keeps its size. */
  size: number
  /** Every occupied cell, in deposition order: layer by layer, serpentine across each. */
  cells: readonly VoxelCell[]
  /** How many layers carry material. */
  layers: number
}

export interface VoxelBuild {
  /** Cells laid so far. */
  laid: number
  /** The layer being worked; equals `solid.layers` once the build is complete. */
  layer: number
  /** The cell under the nozzle, or null when there is nothing left to lay. */
  active: VoxelCell | null
  /** The laid cells worth drawing: everything buried inside is invisible anyway. */
  surface: readonly VoxelSurface[]
}

/** Round a requested resolution into the buildable range. */
export function voxelResolution(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return VOXEL_DEFAULT_RESOLUTION
  return clamp(Math.round(value), VOXEL_MIN_RESOLUTION, VOXEL_MAX_RESOLUTION)
}

/**
 * The field itself. `u`, `v`, `w` run -1 to 1 with `v` up; anything outside the
 * cube, or not a number, is empty.
 */
export function voxelOccupies(
  shape: VoxelShape,
  u: number,
  v: number,
  w: number,
): boolean {
  if (!Number.isFinite(u) || !Number.isFinite(v) || !Number.isFinite(w)) return false
  if (Math.abs(u) > 1 || Math.abs(v) > 1 || Math.abs(w) > 1) return false
  const radius = Math.hypot(u, w)
  switch (shape) {
    case "block": {
      // A box with its corners taken off, so the silhouette is not a plain cube.
      const box = Math.max(Math.abs(u), Math.abs(v), Math.abs(w)) <= 0.86
      return box && Math.abs(u) + Math.abs(v) + Math.abs(w) <= 2
    }
    case "pyramid": {
      if (v < -0.95 || v > 0.85) return false
      const rise = (v + 0.95) / 1.8
      return Math.max(Math.abs(u), Math.abs(w)) <= 0.9 * (1 - rise)
    }
    case "gear": {
      if (Math.abs(v) > 0.55) return false
      // Square teeth rather than an involute: six of them still read at N = 6.
      const tooth = Math.cos(Math.atan2(w, u) * 6) >= 0 ? 0.82 : 0.6
      return radius >= 0.24 && radius <= tooth
    }
    case "vessel": {
      // An open cup: a solid base under an annular wall.
      if (Math.abs(v) > 0.92 || radius > 0.72) return false
      return radius >= 0.5 || v <= -0.55
    }
    case "lattice": {
      // An open-cell frame: material only where two of the three axes are out
      // near the wall, which is every edge of the cell and nothing between.
      // Periodic struts would be truer to the name and useless here — a thin
      // repeating feature aliases against the sample grid and can vanish
      // outright at some resolutions. A band on each axis samples honestly at
      // every one of them.
      if (Math.max(Math.abs(u), Math.abs(v), Math.abs(w)) > 0.95) return false
      return [u, v, w].filter((axis) => Math.abs(axis) > 0.6).length >= 2
    }
    default:
      return Math.hypot(u, v, w) <= 0.92
  }
}

/** A cell's centre in normalised coordinates, -1 to 1 on each axis. */
export function voxelCenter(cell: VoxelCell, resolution: number): Vec3 {
  const at = (index: number) => ((index + 0.5) / resolution) * 2 - 1
  return { x: at(cell.x), y: at(cell.y), z: at(cell.z) }
}

/**
 * Sample a shape into the cells a head would lay, in the order it would lay
 * them: bottom layer first, and serpentine across each layer the way a
 * deposition head rasters. That order is the whole cursor — progress is an
 * index into this array, and the cell at that index is the one being worked.
 */
export function voxelSolid({
  shape = "sphere",
  resolution,
}: VoxelSolidOptions = {}): VoxelSolid {
  const form = shapes.has(shape) ? shape : "sphere"
  const size = voxelResolution(resolution)
  const at = (index: number) => ((index + 0.5) / size) * 2 - 1

  const cells: VoxelCell[] = []
  const layers = new Set<number>()
  for (let y = 0; y < size; y += 1) {
    for (let z = 0; z < size; z += 1) {
      const row: VoxelCell[] = []
      for (let x = 0; x < size; x += 1) {
        if (voxelOccupies(form, at(x), at(y), at(z))) row.push({ x, y, z })
      }
      // Alternate rows run the other way, so the head never flies home empty.
      if (z % 2 === 1) row.reverse()
      for (const cell of row) {
        cells.push(cell)
        layers.add(y)
      }
    }
  }

  // Too coarse to resolve the shape at all: lay the middle cell rather than
  // hand back an empty plate.
  if (cells.length === 0) {
    const middle = Math.floor(size / 2)
    cells.push({ x: middle, y: 0, z: middle })
    layers.add(0)
  }

  return { shape: form, resolution: size, size: 2 / size, cells, layers: layers.size }
}

/** How many cells a 0–1 build progress has laid. Rubbish empties the plate. */
export function voxelLaid(solid: VoxelSolid, progress: number) {
  if (!Number.isFinite(progress)) return 0
  return clamp(Math.round(progress * solid.cells.length), 0, solid.cells.length)
}

const key = (x: number, y: number, z: number) => `${x}|${y}|${z}`

/**
 * The visible state of a part-built solid. Only cells with an open face are
 * returned: a buried cell is painted over by its neighbours anyway, and
 * dropping them turns a cubic path count into a quadratic one.
 */
export function voxelBuild(solid: VoxelSolid, laid: number): VoxelBuild {
  const count = clamp(
    Number.isFinite(laid) ? Math.round(laid) : 0,
    0,
    solid.cells.length,
  )
  const built = new Set<string>()
  for (let index = 0; index < count; index += 1) {
    const cell = solid.cells[index]
    built.add(key(cell.x, cell.y, cell.z))
  }

  const surface: VoxelSurface[] = []
  for (let index = 0; index < count; index += 1) {
    const { x, y, z } = solid.cells[index]
    const top = !built.has(key(x, y + 1, z))
    const open =
      top ||
      !built.has(key(x + 1, y, z)) ||
      !built.has(key(x - 1, y, z)) ||
      !built.has(key(x, y - 1, z)) ||
      !built.has(key(x, y, z + 1)) ||
      !built.has(key(x, y, z - 1))
    if (open) surface.push({ x, y, z, top })
  }

  const active = count < solid.cells.length ? solid.cells[count] : null
  return { laid: count, layer: active ? active.y : solid.layers, active, surface }
}

/* -------------------------------------------------------------------------- */
/* placing a cell in the world                                                 */
/* -------------------------------------------------------------------------- */

export interface VoxelSite extends Vec3 {
  /** World height of the cell's upper face — where a nozzle aims. */
  top: number
  /** Half a cell edge in world units. */
  grain: number
}

/**
 * Where a cell sits in a build volume of half-extent `extent`, centred on the
 * origin in x and z and rising from y = 0. Every fabricator in the set places
 * its workpiece with this, so a cell means the same thing to a gantry, an arm
 * and a flyer.
 */
export function voxelSite(cell: VoxelCell, resolution: number, extent: number): VoxelSite {
  const centre = voxelCenter(cell, resolution)
  const grain = extent / resolution
  const y = (centre.y + 1) * extent
  return { x: centre.x * extent, y, z: centre.z * extent, top: y + grain, grain }
}

export interface VoxelPath {
  id: string
  /** Grid layer, for styling or testing by height. */
  layer: number
  /** The cell's silhouette: its footprint extruded between its two faces. */
  hull: string
  /** The upper face, when nothing sits on the cell. Null otherwise. */
  cap: string | null
  /** Toward the camera. Paint in ascending order. */
  depth: number
}

/**
 * The drawn form of a part-built solid: one silhouette per visible cell, plus
 * a top face for the exposed ones, sorted back to front. Pure geometry — the
 * caller decides how to paint it.
 */
export function voxelPaths(
  surface: readonly VoxelSurface[],
  resolution: number,
  camera: RobotCamera,
  extent: number,
): VoxelPath[] {
  const grain = extent / resolution
  return surface
    .map((cell) => {
      const site = voxelSite(cell, resolution, extent)
      const corners = cellFootprint(site.x, site.z, grain)
      return {
        id: `${cell.x}-${cell.y}-${cell.z}`,
        layer: cell.y,
        hull: extrudedPath(corners, camera, site.y + grain, site.y - grain),
        cap: cell.top
          ? outline(corners.map((corner) => camera.project(corner.x, site.y + grain, corner.y)))
          : null,
        depth: camera.depth(site.x, site.y, site.z),
      }
    })
    .sort((a, b) => a.depth - b.depth)
}

/** A cell's plan-view footprint: x starboard, y toward the tail. */
const cellFootprint = (x: number, z: number, half: number): Vec2[] => [
  { x: x - half, y: z - half },
  { x: x + half, y: z - half },
  { x: x + half, y: z + half },
  { x: x - half, y: z + half },
]

const outline = (points: Vec2[]) =>
  `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`

/* -------------------------------------------------------------------------- */
/* the build cycle                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What a fabricator does when nothing is driving it. Shared across every
 * machine in the family, so the vocabulary is the same whichever body is
 * carrying the nozzle.
 */
export type VoxelBehavior = "build" | "layer" | "refine" | "idle" | "static"

/**
 * Where the build line should be after `cycles`. `build` lays the object and
 * holds it finished — the caller's rate limiter turns the wrap back to zero
 * into the plate stripping down, which is what clearing it looks like.
 */
export function voxelGoal(behavior: VoxelBehavior, cycles: number) {
  if (!Number.isFinite(cycles)) return 1
  const t = ((cycles % 1) + 1) % 1
  switch (behavior) {
    case "build":
      return t < 0.72 ? t / 0.72 : 1
    // Hold near the middle of the object and work one layer across it.
    case "layer":
      return 0.46 + t * 0.1
    default:
      return 1
  }
}

/**
 * The resolution `refine` walks through: coarse to fine and back, so the same
 * object is rebuilt out of smaller voxels without its size changing.
 */
export function voxelRefine(cycles: number) {
  if (!Number.isFinite(cycles)) return VOXEL_DEFAULT_RESOLUTION
  const t = ((cycles % 1) + 1) % 1
  const triangle = t < 0.5 ? t * 2 : 2 - t * 2
  return VOXEL_MIN_RESOLUTION + 1 + triangle * (VOXEL_MAX_RESOLUTION - VOXEL_MIN_RESOLUTION - 3)
}
