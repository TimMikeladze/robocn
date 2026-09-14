import { describe, expect, it } from "vitest"

import {
  blendFace,
  defaultHeadGeometry,
  ellipsoidOutline,
  faceExpressions,
  faceShape,
  onFace,
  rotateHead,
  solveFace,
} from "@/lib/robocn/face"
import { robotCamera } from "@/lib/robocn/style"

describe("face shapes", () => {
  it("gives every expression a shape, and keeps neutral at rest", () => {
    for (const expression of faceExpressions) {
      const shape = faceShape(expression)
      expect(Number.isFinite(shape.jaw)).toBe(true)
      expect(Number.isFinite(shape.left.browInner)).toBe(true)
    }
    const neutral = faceShape("neutral")
    expect(neutral.jaw).toBe(0)
    expect(neutral.left.lipCorner).toBe(0)
    expect(neutral.right.lipCorner).toBe(0)
  })

  it("raises the corners for joy and drops them for sorrow", () => {
    expect(faceShape("joy").left.lipCorner).toBeGreaterThan(0)
    expect(faceShape("sorrow").left.lipCorner).toBeLessThan(0)
    // Sorrow lifts the inner brow; anger drives it down. That pair is the
    // whole difference between the two upper faces.
    expect(faceShape("sorrow").left.browInner).toBeGreaterThan(0)
    expect(faceShape("anger").left.browInner).toBeLessThan(0)
  })

  it("makes doubt asymmetric — one brow up, the other level", () => {
    const doubt = faceShape("doubt")
    expect(doubt.left.browOuter).not.toBeCloseTo(doubt.right.browOuter)
  })
})

describe("solveFace", () => {
  it("scales the whole channel vector with intensity", () => {
    const full = solveFace({ expression: "joy", intensity: 1 })
    const half = solveFace({ expression: "joy", intensity: 0.5 })
    expect(half.left.lipCorner).toBeCloseTo(full.left.lipCorner * 0.5, 5)
    expect(half.intensity).toBe(0.5)
  })

  it("adds blink and speech on top of the expression instead of replacing it", () => {
    const smiling = solveFace({ expression: "joy" })
    const talking = solveFace({ expression: "joy", speech: 1, blink: 1 })
    expect(talking.jaw).toBeGreaterThan(smiling.jaw)
    expect(talking.left.lidUpper).toBeGreaterThan(smiling.left.lidUpper)
    // Still smiling while it talks.
    expect(talking.left.lipCorner).toBeGreaterThan(0)
  })

  it("lets an explicit channel win over the expression", () => {
    const solution = solveFace({ expression: "sorrow", channels: { jaw: 0.8, left: { browOuter: -1 } } })
    expect(solution.jaw).toBeCloseTo(0.8, 5)
    expect(solution.left.browOuter).toBeCloseTo(-1, 5)
    expect(solution.right.browOuter).not.toBeCloseTo(-1, 5)
  })

  it("clamps every channel and falls back to the defaults on junk", () => {
    const solution = solveFace({
      expression: "surprise",
      intensity: Number.NaN,
      gaze: { x: 9, y: Number.POSITIVE_INFINITY },
      channels: { jaw: 40 },
    })
    expect(solution.jaw).toBe(1)
    expect(solution.gaze.x).toBe(1)
    expect(solution.gaze.y).toBe(0)
    // A non-finite intensity is the documented default, not a dead face.
    expect(solution.intensity).toBe(1)
  })

  it("reports a servo stroke per channel and flags the ones out of travel", () => {
    const roomy = solveFace({ expression: "surprise" })
    expect(roomy.actuators.length).toBeGreaterThanOrEqual(16)
    expect(roomy.withinLimits).toBe(true)

    const cramped = solveFace({ expression: "surprise" }, { ...defaultHeadGeometry, travel: 0.2 })
    expect(cramped.withinLimits).toBe(false)
    expect(cramped.actuators.some((actuator) => !actuator.withinLimits)).toBe(true)
  })
})

describe("blendFace", () => {
  it("walks channel by channel between two shapes", () => {
    const mixed = blendFace(faceShape("neutral"), faceShape("joy"), 0.5)
    expect(mixed.left.lipCorner).toBeCloseTo(faceShape("joy").left.lipCorner * 0.5, 5)
    expect(blendFace(faceShape("anger"), faceShape("joy"), 0).left.browInner).toBeCloseTo(
      faceShape("anger").left.browInner,
      5,
    )
  })
})

describe("head geometry", () => {
  it("puts a face point on the ellipsoid, in front of the skull", () => {
    const radii = { x: 38, y: 46, z: 40 }
    const nose = onFace(0, 0, radii)
    expect(nose.z).toBeCloseTo(-40, 5)
    const temple = onFace(30, 0, radii)
    expect(temple.z).toBeGreaterThan(nose.z)
    // Outside the silhouette collapses onto the equator rather than NaN.
    expect(onFace(999, 0, radii).z).toBe(-0)
    expect(Number.isFinite(onFace(Number.NaN, 0, radii).z)).toBe(true)
  })

  it("rotates a head point through yaw, pitch and roll", () => {
    const front = { x: 0, y: 0, z: -10 }
    expect(rotateHead(front, { yaw: 90, pitch: 0, roll: 0 }).x).toBeCloseTo(-10, 5)
    expect(rotateHead(front, { yaw: 0, pitch: 90, roll: 0 }).y).toBeCloseTo(10, 5)
    expect(rotateHead(front, { yaw: Number.NaN, pitch: 0, roll: 0 })).toEqual(front)
  })

  it("projects the skull to an exact ellipse that turns with the neck", () => {
    const radii = { x: 38, y: 46, z: 40 }
    const camera = robotCamera("front")
    const rest = ellipsoidOutline(radii, { yaw: 0, pitch: 0, roll: 0 }, camera)
    // Face-on, the silhouette is the x/y section: no rotation to speak of.
    expect(rest.rx).toBeGreaterThan(46)
    expect(rest.ry).toBeCloseTo(38, 3)

    const rolled = ellipsoidOutline(radii, { yaw: 0, pitch: 0, roll: 30 }, camera)
    expect(Math.abs(rolled.angle - rest.angle)).toBeGreaterThan(5)

    // Side on, the silhouette is the z/y section, so it gets deeper.
    const side = ellipsoidOutline(radii, { yaw: 0, pitch: 0, roll: 0 }, robotCamera("profile"))
    expect(Math.min(side.rx, side.ry)).toBeCloseTo(40, 3)
  })
})
