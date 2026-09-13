import { describe, expect, it } from "vitest"

import { distance2 } from "@/lib/robocn/kinematics"
import { solveSpine, spineOutline } from "@/lib/robocn/spine"

describe("solveSpine", () => {
  it("keeps every link the same length in every pose", () => {
    for (const amplitude of [0, 0.5, 1]) {
      for (const turn of [-1, 0, 1]) {
        for (const phase of [0, 0.25, 0.6, 0.999]) {
          const pose = solveSpine({ segments: 10, length: 120, amplitude, turn, phase, waves: 2 })
          expect(pose.joints).toHaveLength(11)
          expect(pose.link).toBeCloseTo(12, 10)
          for (let i = 1; i < pose.joints.length; i += 1) {
            expect(
              distance2(pose.joints[i - 1].position, pose.joints[i].position),
              `amplitude ${amplitude} turn ${turn} phase ${phase} link ${i}`,
            ).toBeCloseTo(pose.link, 9)
          }
        }
      }
    }
  })

  it("travels a crest from head to tail as the phase rises", () => {
    const head = (phase: number) => solveSpine({ phase, waves: 1, amplitude: 1 }).head.angle
    const mid = (phase: number) => solveSpine({ phase, waves: 1, amplitude: 1 }).joints[6].angle
    // The nose is at its crest at phase 0; halfway down the body it gets there
    // half a cycle later, which is the wave moving backwards along the body.
    expect(head(0)).toBeCloseTo(52, 6)
    expect(mid(0)).toBeLessThan(0)
    expect(mid(0.5)).toBeCloseTo(52, 6)
  })

  it("wraps the phase and ignores non-finite input", () => {
    const base = solveSpine({ phase: 0.3, amplitude: 0.7 })
    expect(solveSpine({ phase: 3.3, amplitude: 0.7 }).head.angle).toBeCloseTo(base.head.angle, 9)
    expect(solveSpine({ phase: -0.7, amplitude: 0.7 }).head.angle).toBeCloseTo(base.head.angle, 9)
    const broken = solveSpine({ phase: Number.NaN, amplitude: Number.NaN, segments: Number.NaN })
    expect(broken.joints).toHaveLength(13)
    expect(Number.isFinite(broken.head.angle)).toBe(true)
  })

  it("spends the swing where the taper puts it", () => {
    const tail = solveSpine({ taper: 1, amplitude: 1, waves: 1 })
    expect(Math.abs(tail.head.angle)).toBeLessThan(1e-9)
    expect(Math.abs(tail.tail.angle)).toBeGreaterThan(10)

    const head = solveSpine({ taper: -1, amplitude: 1, waves: 1 })
    expect(Math.abs(head.head.angle)).toBeGreaterThan(10)
    expect(Math.abs(head.tail.angle)).toBeLessThan(1e-9)
  })

  it("turns the body by a constant curvature and clamps the segment count", () => {
    const straight = solveSpine({ amplitude: 0, turn: 0 })
    expect(straight.tail.angle).toBeCloseTo(0, 9)
    expect(straight.tail.position.y).toBeCloseTo(0, 9)

    const curled = solveSpine({ amplitude: 0, turn: 1 })
    expect(curled.tail.angle).toBeCloseTo(180, 9)
    // A half circle brings the tail back beside the nose rather than behind it.
    expect(Math.abs(curled.tail.position.x)).toBeLessThan(20)

    expect(solveSpine({ segments: 400 }).joints).toHaveLength(25)
    expect(solveSpine({ segments: 1 }).joints).toHaveLength(4)
  })

  it("lifts half the wave off the ground and plants the rest", () => {
    const flat = solveSpine({ lift: 0, amplitude: 1 })
    expect(flat.joints.every((joint) => joint.contact)).toBe(true)

    const winding = solveSpine({ lift: 1, amplitude: 1, waves: 1, phase: 0.1 })
    const lifted = winding.joints.filter((joint) => !joint.contact)
    expect(lifted.length).toBeGreaterThan(0)
    expect(lifted.length).toBeLessThan(winding.joints.length)
    expect(Math.max(...winding.joints.map((joint) => joint.clearance))).toBeLessThanOrEqual(7)
  })
})

describe("spineOutline", () => {
  it("closes a ribbon two points wide per joint", () => {
    const pose = solveSpine({ segments: 4, amplitude: 0.5 })
    const path = spineOutline(pose, () => 5)
    expect(path.startsWith("M ")).toBe(true)
    expect(path.endsWith(" Z")).toBe(true)
    expect(path.match(/[ML]/g)).toHaveLength(10)
  })

  it("offsets each side by the width it is given", () => {
    const pose = solveSpine({ segments: 2, amplitude: 0, length: 60 })
    // Straight body along −x: the first pair sits directly above and below the nose.
    expect(spineOutline(pose, () => 4).startsWith("M 0 4 ")).toBe(true)
  })
})
