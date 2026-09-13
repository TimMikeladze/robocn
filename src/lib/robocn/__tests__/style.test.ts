import { describe, expect, it } from "vitest"

import { convexHull2 } from "@/lib/robocn/kinematics"
import { circleFootprint, extrudedPath, robotCamera, roundedFootprint } from "@/lib/robocn/style"

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
