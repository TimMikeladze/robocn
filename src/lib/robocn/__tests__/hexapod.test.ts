import { describe, expect, it } from "vitest"

import { solveHexapod, type HexapodGait, type HexapodPose } from "@/lib/robocn/hexapod"

/** Femur and tibia live in the leg's own vertical plane, not in the plan view. */
function linkLengths(pose: HexapodPose, leg: HexapodPose["legs"][number]) {
  const hipToKnee = Math.hypot(
    Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y),
    pose.height - leg.kneeHeight,
  )
  const kneeToFoot = Math.hypot(
    Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y),
    leg.kneeHeight - leg.clearance,
  )
  return { hipToKnee, kneeToFoot }
}

describe("solveHexapod", () => {
  it("holds femur and tibia lengths across gaits, heights and phases", () => {
    for (const gait of ["stand", "tripod", "wave", "ripple"] as HexapodGait[]) {
      for (const height of [0, 0.5, 1]) {
        for (const phase of [0, 0.3, 0.7, 0.999]) {
          const pose = solveHexapod({ gait, height, phase, stride: 1, lift: 1 })
          for (const leg of pose.legs) {
            const { hipToKnee, kneeToFoot } = linkLengths(pose, leg)
            expect(hipToKnee, `${gait} ${height} ${phase} leg ${leg.id} femur`).toBeCloseTo(pose.femur, 6)
            expect(kneeToFoot, `${gait} ${height} ${phase} leg ${leg.id} tibia`).toBeCloseTo(pose.tibia, 6)
          }
        }
      }
    }
  })

  it("rounds the leg count to an even number inside its range", () => {
    expect(solveHexapod({ legs: 6 }).legs).toHaveLength(6)
    expect(solveHexapod({ legs: 40 }).legs).toHaveLength(10)
    expect(solveHexapod({ legs: 1 }).legs).toHaveLength(4)
    expect(solveHexapod({ legs: Number.NaN }).legs).toHaveLength(8)
    expect(solveHexapod({ legs: 6 }).legs.filter((leg) => leg.side === "left")).toHaveLength(3)
  })

  it("keeps the body supported through the cycle", () => {
    for (const phase of [0.15, 0.4, 0.55, 0.8, 0.95]) {
      const tripod = solveHexapod({ gait: "tripod", phase, stride: 1, lift: 1 })
      expect(tripod.legs.filter((leg) => leg.contact).length, `tripod ${phase}`).toBe(4)

      const wave = solveHexapod({ gait: "wave", phase, stride: 1, lift: 1 })
      expect(wave.legs.filter((leg) => leg.contact).length, `wave ${phase}`).toBeGreaterThanOrEqual(7)
    }
    // Every foot is down at the instant a swing starts, which is the handover.
    expect(solveHexapod({ gait: "tripod", phase: 0, stride: 1, lift: 1 }).legs.every((leg) => leg.contact)).toBe(true)
    expect(solveHexapod({ gait: "stand" }).legs.every((leg) => leg.contact)).toBe(true)
  })

  it("walks along the heading it is given", () => {
    const forward = solveHexapod({ gait: "tripod", phase: 0, stride: 1, heading: 0 })
    const sideways = solveHexapod({ gait: "tripod", phase: 0, stride: 1, heading: 90 })
    const stood = solveHexapod({ gait: "stand", stride: 1 })
    const travelled = (pose: typeof forward, index: number) => ({
      x: pose.legs[index].foot.x - stood.legs[index].foot.x,
      y: pose.legs[index].foot.y - stood.legs[index].foot.y,
    })
    // The same leg at the same phase moves the same distance, turned 90°.
    const ahead = travelled(forward, 0)
    const across = travelled(sideways, 0)
    expect(Math.hypot(ahead.x, ahead.y)).toBeCloseTo(Math.hypot(across.x, across.y), 9)
    expect(Math.abs(ahead.x)).toBeLessThan(1e-9)
    expect(Math.abs(across.y)).toBeLessThan(1e-9)
    expect(Math.abs(across.x)).toBeGreaterThan(1)
  })

  it("wraps the phase and recovers from non-finite controls", () => {
    const base = solveHexapod({ gait: "tripod", phase: 0.25 })
    for (const phase of [1.25, -0.75]) {
      expect(solveHexapod({ gait: "tripod", phase }).legs[0].foot.x).toBeCloseTo(base.legs[0].foot.x, 9)
    }
    const broken = solveHexapod({
      phase: Number.NaN, height: Number.NaN, stride: Number.NaN,
      lift: Number.NaN, heading: Number.NaN, radius: Number.NaN, femur: Number.NaN,
    })
    expect(broken.height).toBeCloseTo(19, 9)
    for (const leg of broken.legs) {
      expect(Number.isFinite(leg.foot.x) && Number.isFinite(leg.foot.y)).toBe(true)
    }
  })

  it("plants the feet within reach at any body height", () => {
    for (const height of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = solveHexapod({ height, spread: 1, gait: "tripod", phase: 0.2, stride: 1 })
      for (const leg of pose.legs) {
        const span = Math.hypot(
          Math.hypot(leg.foot.x - leg.hip.x, leg.foot.y - leg.hip.y),
          pose.height - leg.clearance,
        )
        expect(span, `height ${height} leg ${leg.id}`).toBeLessThanOrEqual(pose.femur + pose.tibia)
      }
    }
  })
})
