import { describe, expect, it } from "vitest"

import {
  VOXEL_MAX_RESOLUTION,
  VOXEL_MIN_RESOLUTION,
  voxelBuild,
  voxelCenter,
  voxelGoal,
  voxelLaid,
  voxelOccupies,
  voxelPaths,
  voxelRefine,
  voxelResolution,
  voxelSite,
  voxelSolid,
  type VoxelBehavior,
  type VoxelShape,
} from "@/lib/robocn/voxel"
import { robotCamera } from "@/lib/robocn/style"

const shapes: VoxelShape[] = ["sphere", "block", "pyramid", "gear", "vessel", "lattice"]

/** Occupied fraction of the unit cube, sampled on a grid of `steps` per edge. */
function fill(shape: VoxelShape, steps: number) {
  let hits = 0
  for (let ix = 0; ix < steps; ix += 1) {
    for (let iy = 0; iy < steps; iy += 1) {
      for (let iz = 0; iz < steps; iz += 1) {
        const at = (i: number) => ((i + 0.5) / steps) * 2 - 1
        if (voxelOccupies(shape, at(ix), at(iy), at(iz))) hits += 1
      }
    }
  }
  return hits / steps ** 3
}

describe("voxelOccupies", () => {
  it("converges on the analytic volume as the sampling gets finer", () => {
    // The field is continuous, so the clamp on `resolution` is a draw budget
    // rather than a limit of the geometry: sample it as fine as you like.
    const exact = ((4 / 3) * Math.PI * 0.92 ** 3) / 8
    // Midpoint sampling of a curved surface is not monotone cell by cell — a
    // coarse grid can land lucky — so compare bands rather than single N.
    const error = (steps: number[]) =>
      steps.reduce((sum, steps) => sum + Math.abs(fill("sphere", steps) - exact), 0) /
      steps.length
    const coarse = error([3, 5, 7, 9])
    const fine = error([20, 24, 28, 32])
    const finer = error([48, 56, 64, 72])
    expect(fine).toBeLessThan(coarse)
    expect(finer).toBeLessThan(fine)
    expect(finer).toBeLessThan(0.002)
  })

  it("gives every shape something to build, and nothing outside the cube", () => {
    for (const shape of shapes) {
      const fraction = fill(shape, 20)
      expect(fraction, shape).toBeGreaterThan(0.05)
      expect(fraction, shape).toBeLessThan(0.95)
      expect(voxelOccupies(shape, 1.4, 0, 0), shape).toBe(false)
      expect(voxelOccupies(shape, 0, Number.NaN, 0), shape).toBe(false)
    }
  })

  it("hollows the vessel and leaves the lattice mostly air", () => {
    // An open cup: solid near the base, air up the middle.
    expect(voxelOccupies("vessel", 0, -0.8, 0)).toBe(true)
    expect(voxelOccupies("vessel", 0, 0.5, 0)).toBe(false)
    expect(voxelOccupies("vessel", 0.6, 0.5, 0)).toBe(true)
    expect(fill("lattice", 24)).toBeLessThan(0.5)
    // A bore down the middle of the gear, teeth out at the rim.
    expect(voxelOccupies("gear", 0, 0, 0)).toBe(false)
    expect(voxelOccupies("gear", 0.4, 0, 0)).toBe(true)
  })
})

describe("voxelResolution", () => {
  it("rounds into range and falls back on rubbish", () => {
    expect(voxelResolution(7.4)).toBe(7)
    expect(voxelResolution(0)).toBe(VOXEL_MIN_RESOLUTION)
    expect(voxelResolution(400)).toBe(VOXEL_MAX_RESOLUTION)
    expect(voxelResolution(Number.NaN)).toBeGreaterThanOrEqual(VOXEL_MIN_RESOLUTION)
    expect(voxelResolution(undefined)).toBe(voxelResolution(Number.NaN))
  })
})

describe("voxelSolid", () => {
  it("lays cells bottom up, one layer at a time, serpentine across each", () => {
    const solid = voxelSolid({ shape: "block", resolution: 6 })
    expect(solid.cells.length).toBeGreaterThan(0)
    expect(solid.layers).toBeGreaterThan(0)
    let previous = solid.cells[0]
    for (const cell of solid.cells.slice(1)) {
      expect(cell.y).toBeGreaterThanOrEqual(previous.y)
      if (cell.y === previous.y) expect(cell.z).toBeGreaterThanOrEqual(previous.z)
      previous = cell
    }
    // Serpentine: the first row runs one way, the next runs back.
    const first = solid.cells.filter((cell) => cell.y === 0 && cell.z === solid.cells[0].z)
    const second = solid.cells.filter((cell) => cell.y === 0 && cell.z === solid.cells[0].z + 1)
    expect(first.at(-1)!.x).toBeGreaterThan(first[0].x)
    expect(second.at(-1)!.x).toBeLessThan(second[0].x)
  })

  it("keeps every cell inside the grid and holds the shape's scale across resolutions", () => {
    for (const shape of shapes) {
      for (const resolution of [3, 6, 11]) {
        const solid = voxelSolid({ shape, resolution })
        for (const cell of solid.cells) {
          for (const axis of [cell.x, cell.y, cell.z]) {
            expect(Number.isInteger(axis), shape).toBe(true)
            expect(axis, shape).toBeGreaterThanOrEqual(0)
            expect(axis, shape).toBeLessThan(resolution)
          }
        }
        expect(solid.size, `${shape} ${resolution}`).toBeCloseTo(2 / resolution, 10)
      }
    }
  })

  it("normalises bad input instead of throwing", () => {
    const solid = voxelSolid({ shape: "banana" as VoxelShape, resolution: Number.NaN })
    expect(solid.cells.length).toBeGreaterThan(0)
    expect(solid.shape).toBe("sphere")
  })
})

describe("voxelLaid and voxelBuild", () => {
  const solid = voxelSolid({ shape: "sphere", resolution: 7 })

  it("maps progress onto the deposition sequence and clamps rubbish to empty", () => {
    expect(voxelLaid(solid, 0)).toBe(0)
    expect(voxelLaid(solid, 1)).toBe(solid.cells.length)
    expect(voxelLaid(solid, 0.5)).toBe(Math.round(solid.cells.length / 2))
    expect(voxelLaid(solid, 4)).toBe(solid.cells.length)
    expect(voxelLaid(solid, Number.NaN)).toBe(0)
  })

  it("puts the cursor on the next cell and retires it once the build is complete", () => {
    const part = voxelBuild(solid, 12)
    expect(part.laid).toBe(12)
    expect(part.active).toEqual(solid.cells[12])
    expect(part.layer).toBe(solid.cells[12].y)

    const done = voxelBuild(solid, solid.cells.length)
    expect(done.active).toBeNull()
    expect(done.layer).toBe(solid.layers)
    expect(voxelBuild(solid, 0).surface).toHaveLength(0)
  })

  it("draws only the cells with an exposed face, and flags the ones with an open top", () => {
    const done = voxelBuild(solid, solid.cells.length)
    expect(done.surface.length).toBeGreaterThan(0)
    expect(done.surface.length).toBeLessThan(solid.cells.length)

    const laid = new Set(solid.cells.map((cell) => key(cell.x, cell.y, cell.z)))
    const shown = new Set(done.surface.map((cell) => key(cell.x, cell.y, cell.z)))
    for (const cell of solid.cells) {
      const buried = neighbours(cell).every((n) => laid.has(key(n.x, n.y, n.z)))
      expect(shown.has(key(cell.x, cell.y, cell.z)), `${cell.x},${cell.y},${cell.z}`).toBe(!buried)
    }
    for (const cell of done.surface) {
      expect(cell.top).toBe(!laid.has(key(cell.x, cell.y + 1, cell.z)))
    }
  })

  it("exposes the top of a part-built solid, so the build line is visible", () => {
    // Half-way up a sphere, nothing sits on the highest layer laid so far.
    const half = voxelBuild(solid, voxelLaid(solid, 0.5))
    const highest = Math.max(...half.surface.map((cell) => cell.y))
    const crown = half.surface.filter((cell) => cell.y === highest)
    expect(crown.length).toBeGreaterThan(0)
    expect(crown.every((cell) => cell.top)).toBe(true)
    expect(half.active?.y).toBeGreaterThanOrEqual(highest)
  })
})

describe("voxelCenter", () => {
  it("places cells across the unit cube, centred on the grid", () => {
    expect(voxelCenter({ x: 0, y: 0, z: 0 }, 2)).toEqual({ x: -0.5, y: -0.5, z: -0.5 })
    expect(voxelCenter({ x: 1, y: 1, z: 1 }, 2)).toEqual({ x: 0.5, y: 0.5, z: 0.5 })
    expect(voxelCenter({ x: 2, y: 2, z: 2 }, 5).x).toBeCloseTo(0, 10)
  })
})

const key = (x: number, y: number, z: number) => `${x}|${y}|${z}`
const neighbours = ({ x, y, z }: { x: number; y: number; z: number }) => [
  { x: x + 1, y, z }, { x: x - 1, y, z },
  { x, y: y + 1, z }, { x, y: y - 1, z },
  { x, y, z: z + 1 }, { x, y, z: z - 1 },
]

describe("voxelSite and voxelPaths", () => {
  const solid = voxelSolid({ shape: "block", resolution: 6 })
  const part = voxelBuild(solid, solid.cells.length)

  it("places cells across a build volume that keeps its size at any resolution", () => {
    for (const resolution of [3, 6, 12]) {
      const form = voxelSolid({ shape: "block", resolution })
      const sites = form.cells.map((cell) => voxelSite(cell, resolution, 30))
      const far = Math.max(...sites.map((site) => Math.abs(site.x) + site.grain))
      const tall = Math.max(...sites.map((site) => site.top))
      // Smaller cells, same object: the solid still fills the same 60-unit box.
      expect(sites[0].grain, `${resolution}`).toBeCloseTo(30 / resolution, 10)
      expect(far, `${resolution}`).toBeLessThanOrEqual(30.001)
      expect(tall, `${resolution}`).toBeGreaterThan(50)
      expect(tall, `${resolution}`).toBeLessThanOrEqual(60.001)
    }
  })

  it("draws one hull per visible cell, caps only the open tops, and sorts back to front", () => {
    const camera = robotCamera("iso")
    const paths = voxelPaths(part.surface, solid.resolution, camera, 30)
    expect(paths).toHaveLength(part.surface.length)
    expect(paths.filter((path) => path.cap !== null)).toHaveLength(
      part.surface.filter((cell) => cell.top).length,
    )
    for (const path of paths) expect(path.hull.startsWith("M")).toBe(true)
    const depths = paths.map((path) => path.depth)
    expect([...depths].sort((a, b) => a - b)).toEqual(depths)
  })

  it("collapses to the plan footprint looking straight down", () => {
    // Plan is the identity projection, so a cell's silhouette is its footprint
    // and its cap is the same square — the drawing gains nothing from height.
    const paths = voxelPaths(part.surface, solid.resolution, robotCamera("plan"), 30)
    const capped = paths.find((path) => path.cap !== null)!
    expect(capped.cap).toBe(capped.hull)
    const iso = voxelPaths(part.surface, solid.resolution, robotCamera("iso"), 30)
    expect(iso.find((path) => path.id === capped.id)!.hull).not.toBe(capped.hull)
  })
})

describe("the build cycle", () => {
  it("ramps the build line, holds it finished, and repeats every cycle", () => {
    expect(voxelGoal("build", 0)).toBe(0)
    expect(voxelGoal("build", 0.36)).toBeCloseTo(0.5, 6)
    expect(voxelGoal("build", 0.72)).toBe(1)
    expect(voxelGoal("build", 0.95)).toBe(1)
    expect(voxelGoal("build", 3.36)).toBeCloseTo(voxelGoal("build", 0.36), 6)
    expect(voxelGoal("build", -0.64)).toBeCloseTo(voxelGoal("build", 0.36), 6)
  })

  it("holds one layer for `layer`, and a finished object for the rest", () => {
    expect(voxelGoal("layer", 0)).toBeCloseTo(0.46, 6)
    expect(voxelGoal("layer", 0.5)).toBeCloseTo(0.51, 6)
    for (const behavior of ["idle", "static"] as VoxelBehavior[]) {
      expect(voxelGoal(behavior, 0.4), behavior).toBe(1)
    }
    expect(voxelGoal("build", Number.NaN)).toBe(1)
  })

  it("walks the resolution coarse to fine and back for `refine`", () => {
    const coarse = voxelRefine(0)
    const fine = voxelRefine(0.5)
    expect(fine).toBeGreaterThan(coarse)
    expect(voxelRefine(1)).toBeCloseTo(coarse, 6)
    expect(fine).toBeLessThanOrEqual(VOXEL_MAX_RESOLUTION)
    expect(voxelRefine(Number.NaN)).toBeGreaterThan(1)
  })
})
