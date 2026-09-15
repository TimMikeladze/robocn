import { describe, expect, it } from "vitest"

import { convexHull2 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  circleFootprint,
  elevationDisc,
  elevationDraft,
  elevationSolid,
  extrudedPath,
  fitTransform,
  frustumPath,
  robotCamera,
  robotCameraAt,
  robotViews,
  roundedFootprint,
} from "@/lib/robocn/style"

describe("robot camera", () => {
  it("draws plan view as the identity projection", () => {
    const camera = robotCamera("plan")
    expect(camera.project(10, 6, -4)).toEqual({ x: 10, y: -4 })
    expect(camera.plane(12, 0)).toBe("")
    expect(camera.plane(12, 30)).toBe("rotate(30)")
    // Height is depth from straight above, and a disc keeps its full width.
    expect(camera.depth(0, 5, 0)).toBeCloseTo(5)
    expect(camera.lift).toBeCloseTo(0)
    expect(camera.flatten).toBeCloseTo(1)
  })

  it("takes any angle, and lands on the named views at their own angles", () => {
    for (const view of ["plan", "front", "profile", "iso"] as const) {
      const { azimuth, elevation } = robotViews[view]
      const free = robotCameraAt(azimuth, elevation, view)
      const named = robotCamera(view)
      expect(free.project(13, 7, -5)).toEqual(named.project(13, 7, -5))
      expect(free.plane(9, 20)).toBe(named.plane(9, 20))
    }
    // A turn of the camera is a turn of the drawing, and a whole turn is none.
    const front = robotCamera("front")
    const turned = robotCameraAt(180 + 37, 10, "front")
    expect(turned.project(30, 0, 0).x).not.toBeCloseTo(front.project(30, 0, 0).x, 3)
    const wrapped = robotCameraAt(180 + 360, 10, "front").project(30, 12, -8)
    expect(wrapped.x).toBeCloseTo(front.project(30, 12, -8).x, 9)
    expect(wrapped.y).toBeCloseTo(front.project(30, 12, -8).y, 9)
    // Past the pole it holds rather than turning inside out, and rubbish is level.
    expect(robotCameraAt(0, 140, "plan").flatten).toBeCloseTo(1, 6)
    expect(robotCameraAt(Number.NaN, Number.NaN, "front").project(10, 0, 0).x).toBe(10)
  })

  it("tips the horizontal plane over and lifts height off the ground", () => {
    const camera = robotCamera("profile")
    // Looking from starboard: the nose runs to the right of the drawing.
    expect(camera.project(0, 0, -50).x).toBeGreaterThan(40)
    expect(camera.project(0, 20, 0).y).toBeLessThan(-15)
    expect(camera.plane(10, 0)).toMatch(/^matrix\(/)
    expect(camera.flatten).toBeLessThan(0.25)
  })

  it("draws an elevation drawing untouched in its own elevation", () => {
    // Height carries a unit scale so the elevations do not foreshorten it: a
    // machine drawn in front elevation is unchanged at `front`, and one drawn
    // in side elevation is unchanged at `profile`.
    expect(robotCamera("front").wall()).toBe("")
    expect(robotCamera("profile").wall(0, 90)).toBe("")
    expect(robotCamera("front").lift).toBeCloseTo(1)
    expect(robotCamera("profile").project(0, 20, 0).y).toBeCloseTo(-20)
    // Seen edge-on a wall collapses; from above it is a line.
    expect(robotCamera("profile").wall()).toBe("matrix(0 -0.17 0 1 0 0)")
    expect(robotCamera("plan").wall()).toBe("matrix(-1 0 0 0 0 0)")
    // Three-quarter: both faces of a box are foreshortened, neither is lost.
    expect(robotCamera("iso").wall()).toMatch(/^matrix\(0.82 /)
    expect(robotCamera("iso").wall(0, 90)).toMatch(/^matrix\(0.57 /)
  })
})

describe("extruded parts", () => {
  it("collapses to the footprint in plan and gains height when tipped", () => {
    const footprint = roundedFootprint(16, 25, 12, 9)
    const plan = bounds(extrudedPath(footprint, robotCamera("plan"), 12, -8))
    expect(plan.height).toBeCloseTo(50, 0)
    const front = bounds(extrudedPath(footprint, robotCamera("front"), 12, -8))
    // A 20-unit hull seen nearly edge-on is tall, not 50 units deep.
    expect(front.height).toBeGreaterThan(18)
    expect(front.height).toBeLessThan(32)
  })

  it("turns the footprint with the machine", () => {
    const footprint = roundedFootprint(16, 25, 12, 9)
    const camera = robotCamera("plan")
    expect(bounds(extrudedPath(footprint, camera, 0, 0, 90)).width).toBeCloseTo(50, 0)
  })
})

describe("tapered parts", () => {
  it("takes its width from the wider footprint and matches an extrusion when both are equal", () => {
    const wide = roundedFootprint(32, 40, 8)
    const narrow = roundedFootprint(21, 32, 6)
    const camera = robotCamera("plan")
    // In plan a frustum is the hull of both footprints, which is the wider one.
    expect(bounds(frustumPath(wide, narrow, camera, 6, 44)).width).toBeCloseTo(64, 0)
    expect(bounds(frustumPath(narrow, wide, camera, 6, 44)).width).toBeCloseTo(64, 0)
    // And with one footprint it is exactly the prism `extrudedPath` draws.
    expect(frustumPath(wide, wide, robotCamera("iso"), 6, 44)).toBe(
      extrudedPath(wide, robotCamera("iso"), 44, 6),
    )
  })

  it("leans the flank in as it rises", () => {
    const camera = robotCamera("front")
    const wide = roundedFootprint(32, 40, 8)
    const narrow = roundedFootprint(21, 32, 6)
    const taper = bounds(frustumPath(wide, narrow, camera, 0, 40))
    const prism = bounds(frustumPath(wide, wide, camera, 0, 40))
    expect(taper.width).toBeCloseTo(prism.width, 0)
    // Same footprint at the floor, but the top is drawn in, so the far top
    // corner does not reach as high up the drawing as the prism's does.
    expect(taper.height).toBeLessThan(prism.height)
    expect(taper.height).toBeGreaterThan(prism.height - 4)
    expect(frustumPath(wide, narrow, camera, 0, 40)).not.toBe(
      frustumPath(wide, wide, camera, 0, 40),
    )
  })
})

describe("footprints", () => {
  it("samples a circle as a ring that extrudes into a cylinder", () => {
    const footprint = circleFootprint(0, 0, 10, 16)
    expect(footprint).toHaveLength(16)
    expect(bounds(extrudedPath(footprint, robotCamera("plan"), 0, 0)).width).toBeCloseTo(20, 0)
    // Tipped over, the same disc becomes a can: 14 of extrusion plus the
    // depth the disc itself picks up from the camera's elevation.
    expect(bounds(extrudedPath(footprint, robotCamera("front"), 14, 0)).height).toBeCloseTo(17.5, 0)
  })
})

describe("convex hull", () => {
  it("keeps the corners and drops points inside", () => {
    const hull = convexHull2([
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 },
    ])
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 2, y: 2 })
  })
})

function bounds(path: string) {
  const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const xs = numbers.filter((_, i) => i % 2 === 0)
  const ys = numbers.filter((_, i) => i % 2 === 1)
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

describe("elevation drawings", () => {
  it("lifts a link into a box of the right size", () => {
    const corners = elevationSolid({ x: 0, y: 0 }, { x: 20, y: 0 }, 3, 5)
    expect(corners).toHaveLength(8)
    const xs = corners.map((corner) => corner.x)
    const ys = corners.map((corner) => corner.y)
    const zs = corners.map((corner) => corner.z)
    // Depth out of a profile drawing is the world's starboard axis; the
    // drawing's own x runs fore-and-aft, and its y is the world's height.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(6, 6)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(26, 6)
  })

  it("puts depth on the other horizontal axis for a front elevation", () => {
    const corners = elevationSolid({ x: 0, y: 0 }, { x: 20, y: 0 }, 3, 5, "front")
    const xs = corners.map((corner) => corner.x)
    const zs = corners.map((corner) => corner.z)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(26, 6)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(10, 6)
  })

  it("keeps a zero-length link finite", () => {
    const corners = elevationSolid({ x: 4, y: 4 }, { x: 4, y: 4 }, 2, 2)
    expect(corners.every((corner) => Number.isFinite(corner.x + corner.y + corner.z))).toBe(true)
  })

  it("samples a disc as a cylinder of the right diameter", () => {
    const corners = elevationDisc({ x: 0, y: 0 }, 12, 4, "profile", 24)
    expect(corners).toHaveLength(48)
    const zs = corners.map((corner) => corner.z)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(24, 4)
    expect(Math.max(...corners.map((corner) => corner.x))).toBeCloseTo(4, 6)
  })

  it("draws a drafting board that is the identity in its own view", () => {
    const draft = elevationDraft(robotCamera("profile"), "profile")
    const screen = draft.point({ x: 30, y: 40 })
    expect(screen.x).toBeCloseTo(30, 6)
    expect(screen.y).toBeCloseTo(-40, 6)
    expect(draft.path([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe("M 0 0 L 10 0")
    expect(bounds(draft.box(0, 0, 20, 10, 4)).width).toBeCloseTo(20, 4)
  })

  it("offsets a member across the machine without changing its size", () => {
    const draft = elevationDraft(robotCamera("plan"), "profile")
    const centre = draft.bar({ x: 0, y: 0 }, { x: 20, y: 0 }, 2, 3)
    const outboard = draft.bar({ x: 0, y: 0 }, { x: 20, y: 0 }, 2, 3, 18)
    expect(outboard).not.toBe(centre)
    expect(bounds(outboard).width).toBeCloseTo(bounds(centre).width, 4)
  })
})

describe("fitTransform", () => {
  it("never enlarges a machine that already fits", () => {
    const corners = boxCorners({ x: -10, y: 0, z: -10 }, { x: 10, y: 20, z: 10 })
    expect(fitTransform(corners, robotCamera("profile"), 200, 200)).toContain("scale(1)")
  })

  it("shrinks one that does not, and centres it either way", () => {
    const corners = boxCorners({ x: -400, y: 0, z: -400 }, { x: 400, y: 600, z: 400 })
    const transform = fitTransform(corners, robotCamera("iso"), 200, 200)
    expect(transform).toMatch(/scale\(0\.\d+\)/)
    expect(transform.startsWith("translate(")).toBe(true)
  })
})
