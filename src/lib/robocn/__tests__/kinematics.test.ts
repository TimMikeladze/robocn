import { describe, expect, it } from "vitest"
import {
  chainAngles2,
  chainLinks2,
  chainMinReach,
  chainReach,
  clampToReach2,
  distance2,
  distance3,
  forwardChain2,
  isometric,
  solveChain2,
  solveChain3,
  solveDelta,
  solveElbow2,
  type Vec2,
} from "../kinematics"

const ROOT: Vec2 = { x: 0, y: 0 }
const LINKS = [30, 24, 16]

/** Every drawn segment must keep its length, or the arm visibly stretches. */
function expectLinkLengths(joints: { x: number; y: number }[], links: number[]) {
  links.forEach((link, i) => {
    expect(distance2(joints[i], joints[i + 1])).toBeCloseTo(link, 2)
  })
}

describe("reach", () => {
  it("sums links for the outer limit and leaves a dead zone for a dominant link", () => {
    expect(chainReach(LINKS)).toBe(70)
    expect(chainMinReach([30, 24, 16])).toBe(0)
    expect(chainMinReach([40, 10])).toBe(30)
  })

  it("pulls unreachable targets onto the annulus instead of failing", () => {
    const far = clampToReach2(ROOT, { x: 500, y: 0 }, LINKS)
    expect(far.x).toBeCloseTo(70, 1)
    const near = clampToReach2(ROOT, { x: 1, y: 0 }, [40, 10])
    expect(near.x).toBeCloseTo(30, 1)
  })
})

describe("two-link elbow", () => {
  it("lands the tip on the target with both links intact", () => {
    const elbow = solveElbow2(ROOT, { x: 30, y: 20 }, 30, 24)
    expect(distance2(ROOT, elbow)).toBeCloseTo(30, 4)
    expect(distance2(elbow, { x: 30, y: 20 })).toBeCloseTo(24, 4)
  })

  it("breaks to opposite sides for the two bend directions", () => {
    const up = solveElbow2(ROOT, { x: 40, y: 0 }, 30, 24, "up")
    const down = solveElbow2(ROOT, { x: 40, y: 0 }, 30, 24, "down")
    expect(up.y).toBeGreaterThan(0)
    expect(down.y).toBeCloseTo(-up.y, 6)
  })
})

describe("solveChain2", () => {
  it("reaches the target and preserves link lengths", () => {
    const joints = solveChain2(ROOT, { x: 35, y: 25 }, LINKS)
    expect(joints).toHaveLength(LINKS.length + 1)
    expect(distance2(joints[joints.length - 1], { x: 35, y: 25 })).toBeLessThan(0.05)
    expectLinkLengths(joints, LINKS)
  })

  it("keeps link lengths even when the target is out of reach", () => {
    const joints = solveChain2(ROOT, { x: 400, y: 300 }, LINKS)
    expectLinkLengths(joints, LINKS)
    expect(distance2(ROOT, joints[joints.length - 1])).toBeCloseTo(70, 0)
  })

  it("stays temporally coherent when seeded with the previous pose", () => {
    let joints = solveChain2(ROOT, { x: 40, y: 10 }, LINKS)
    for (let i = 0; i < 30; i++) {
      const next = solveChain2(ROOT, { x: 40, y: 10 + i * 0.2 }, LINKS, { seed: joints })
      // A solution that flipped to the mirror pose would move joints far.
      expect(distance2(joints[1], next[1])).toBeLessThan(3)
      joints = next
    }
    expectLinkLengths(joints, LINKS)
  })
})

describe("forward kinematics", () => {
  it("round-trips a solved pose through angles and back", () => {
    const joints = solveChain2(ROOT, { x: 20, y: 40 }, LINKS)
    const rebuilt = forwardChain2(ROOT, chainAngles2(joints), chainLinks2(joints))
    joints.forEach((joint, i) => {
      expect(rebuilt[i].x).toBeCloseTo(joint.x, 4)
      expect(rebuilt[i].y).toBeCloseTo(joint.y, 4)
    })
  })
})

describe("solveChain3", () => {
  it("reaches the target with links intact", () => {
    const links = [24, 20, 14]
    const target = { x: 18, y: 26, z: -12 }
    const joints = solveChain3({ x: 0, y: 0, z: 0 }, target, links)
    expect(distance3(joints[joints.length - 1], target)).toBeLessThan(0.05)
    links.forEach((link, i) => {
      expect(distance3(joints[i], joints[i + 1])).toBeCloseTo(link, 2)
    })
  })
})

describe("solveDelta", () => {
  const geometry = { base: 120, platform: 40, upper: 50, lower: 90 }

  it("puts every platform corner on the forearm sphere around its elbow", () => {
    const pose = solveDelta({ x: 12, y: -80, z: -8 }, geometry)
    expect(pose.reachable).toBe(true)
    for (const arm of pose.arms) {
      expect(distance3(arm.anchor, arm.elbow)).toBeCloseTo(geometry.upper, 3)
      expect(distance3(arm.elbow, arm.platform)).toBeCloseTo(geometry.lower, 3)
    }
  })

  it("spaces the three motors 120 degrees apart", () => {
    const pose = solveDelta({ x: 0, y: -90, z: 0 }, geometry)
    const angles = pose.arms.map((arm) =>
      Math.round((Math.atan2(arm.anchor.z, arm.anchor.x) * 180) / Math.PI),
    )
    const spread = angles.map((a) => ((a - angles[0] + 360) % 360)).sort((a, b) => a - b)
    expect(spread).toEqual([0, 120, 240])
  })

  it("reports unreachable targets rather than producing NaN", () => {
    const pose = solveDelta({ x: 0, y: -500, z: 0 }, geometry)
    expect(pose.reachable).toBe(false)
    for (const arm of pose.arms) {
      expect(Number.isFinite(arm.elbow.x + arm.elbow.y + arm.elbow.z)).toBe(true)
    }
  })
})

describe("isometric", () => {
  it("keeps the vertical axis vertical", () => {
    const a = isometric({ x: 0, y: 10, z: 0 })
    const b = isometric({ x: 0, y: 20, z: 0 })
    expect(a.x).toBeCloseTo(0, 6)
    expect(b.y).toBeGreaterThan(a.y)
  })
})
