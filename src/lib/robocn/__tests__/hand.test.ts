import { describe, expect, it } from "vitest"

import { distance3 } from "@/lib/robocn/kinematics"
import {
  graspProfile,
  handGoal,
  handGrasps,
  handWave,
  solveHand,
  type HandGrasp,
} from "@/lib/robocn/hand"

/** Phalanx lengths, digit by digit, as the solver was given them. */
const phalanges = (pose: ReturnType<typeof solveHand>) =>
  pose.digits.map((digit) =>
    digit.joints.slice(1).map((joint, index) => distance3(digit.joints[index], joint)),
  )

describe("hand kinematics", () => {
  it("keeps every phalanx the same length at every closure, spread and wrist angle", () => {
    const open = phalanges(solveHand({ grasp: "open", curl: 0 }))
    for (const grasp of handGrasps) {
      for (const curl of [0, 0.4, 1]) {
        for (const spread of [-1, 0, 1]) {
          for (const wristPitch of [-60, 0, 55]) {
            const pose = solveHand({ grasp, curl, spread, wristPitch, wristYaw: -20 })
            expect(pose.digits).toHaveLength(5)
            phalanges(pose).forEach((digit, d) =>
              digit.forEach((length, index) =>
                expect(length).toBeCloseTo(open[d][index], 6),
              ),
            )
          }
        }
      }
    }
  })

  it("closes the pinch gap the thumb's saddle joint exists to close", () => {
    const relaxed = solveHand({ grasp: "open", curl: 0 })
    const pinched = solveHand({ grasp: "pinch", curl: 1 })
    const tripod = solveHand({ grasp: "tripod", curl: 1 })
    const hooked = solveHand({ grasp: "hook", curl: 1 })

    expect(pinched.pinch.gap).toBeLessThan(relaxed.pinch.gap * 0.35)
    expect(tripod.pinch.gap).toBeLessThan(relaxed.pinch.gap * 0.5)
    // A hook does not oppose, so its thumb never arrives anywhere near a pad.
    expect(hooked.opposition).toBe(0)
    expect(hooked.pinch.gap).toBeGreaterThan(pinched.pinch.gap * 2)
  })

  it("fans the fingers about the palm normal without moving them out of it", () => {
    const together = solveHand({ grasp: "open", curl: 0, spread: -1 })
    const splayed = solveHand({ grasp: "open", curl: 0, spread: 1 })
    const span = (pose: ReturnType<typeof solveHand>) =>
      pose.digits[4].tip.x - pose.digits[1].tip.x
    // Index is at +x, pinky at -x, so a wider hand is a more negative span.
    expect(span(splayed)).toBeLessThan(span(together))
    for (const pose of [together, splayed]) {
      for (const digit of pose.digits.slice(1)) {
        // Abduction is a rotation about z, so a straight finger stays flat.
        expect(digit.tip.z).toBeCloseTo(digit.joints[0].z, 6)
      }
    }
  })

  it("mirrors a left hand exactly onto a right one", () => {
    const right = solveHand({ grasp: "power", curl: 0.7, side: "right" })
    const left = solveHand({ grasp: "power", curl: 0.7, side: "left" })
    right.digits.forEach((digit, index) => {
      digit.joints.forEach((joint, j) => {
        expect(left.digits[index].joints[j].x).toBeCloseTo(-joint.x, 6)
        expect(left.digits[index].joints[j].y).toBeCloseTo(joint.y, 6)
        expect(left.digits[index].joints[j].z).toBeCloseTo(joint.z, 6)
      })
    })
    expect(left.pinch.gap).toBeCloseTo(right.pinch.gap, 6)
  })

  it("lets a per-digit closure override the named grasp, digit by digit", () => {
    const named = solveHand({ grasp: "power", curl: 1 })
    const posed = solveHand({ grasp: "power", curl: 1, digits: [null, 0, null, null, null] })
    expect(posed.digits[1].closure).toBe(0)
    expect(posed.digits[2].closure).toBeCloseTo(named.digits[2].closure, 6)
    expect(posed.digits[1].tip.y).toBeGreaterThan(named.digits[1].tip.y)
  })

  it("falls back to a neutral open hand on nonsense", () => {
    const pose = solveHand({
      // @ts-expect-error a stale grasp from a consumer must degrade, not throw.
      grasp: "crush",
      curl: Number.NaN,
      spread: Number.POSITIVE_INFINITY,
      wristPitch: Number.NaN,
      digits: [Number.NaN, undefined, null, 4, -2],
    })
    expect(pose.grasp).toBe("open")
    for (const digit of pose.digits) {
      for (const joint of digit.joints) {
        expect(Number.isFinite(joint.x)).toBe(true)
        expect(Number.isFinite(joint.y)).toBe(true)
        expect(Number.isFinite(joint.z)).toBe(true)
      }
      expect(digit.closure).toBeGreaterThanOrEqual(0)
      expect(digit.closure).toBeLessThanOrEqual(1)
    }
    expect(Number.isFinite(pose.pinch.gap)).toBe(true)
  })

  it("names a closure for every digit in every grasp", () => {
    for (const grasp of handGrasps) {
      const profile = graspProfile(grasp as HandGrasp)
      expect(profile.digits).toHaveLength(5)
      expect(profile.opposition).toBeGreaterThanOrEqual(0)
      expect(profile.opposition).toBeLessThanOrEqual(1)
    }
  })

  it("runs the grip loop through a hold and back open, and ripples the wave", () => {
    expect(handGoal("grip", 0)).toBe(0)
    expect(handGoal("grip", 0.45)).toBe(1)
    expect(handGoal("grip", 0.95)).toBe(0)
    expect(handGoal("static", 0.45)).toBe(0)
    expect(handGoal("grip", Number.NaN)).toBe(0)
    // Each digit is a fifth of a cycle behind the one before it.
    expect(handWave(0.25, 0)).not.toBeCloseTo(handWave(0.25, 3), 3)
    expect(handWave(Number.NaN, 2)).toBe(0)
  })
})
