import { describe, expect, it } from "vitest"

import { distance3 } from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  footPoints,
  footRoll,
  solveLeg,
  solveSkeleton,
  spineCurve,
  strideCycle,
  type SkeletonGait,
} from "@/lib/robocn/skeleton"

const gaits: SkeletonGait[] = ["stand", "walk", "run", "march"]
const phases = [0, 0.13, 0.25, 0.37, 0.5, 0.62, 0.75, 0.88, 0.999]

describe("skeleton kinematics", () => {
  it("keeps every bone the same length through every gait and phase", () => {
    const p = defaultProportions
    for (const gait of gaits) {
      for (const phase of phases) {
        const pose = solveSkeleton({ gait, phase, stride: 1, lift: 1, lean: 20, twist: 25 })
        expect(pose.legs).toHaveLength(2)
        expect(pose.arms).toHaveLength(2)
        for (const leg of pose.legs) {
          expect(distance3(leg.hip, leg.knee)).toBeCloseTo(p.femur, 6)
          expect(distance3(leg.knee, leg.ankle)).toBeCloseTo(p.tibia, 6)
        }
        for (const arm of pose.arms) {
          expect(distance3(arm.shoulder, arm.elbow)).toBeCloseTo(p.humerus, 6)
          expect(distance3(arm.elbow, arm.wrist)).toBeCloseTo(p.forearm, 6)
        }
        // Equal vertebrae: leaning and twisting must not stretch the back.
        const step = p.spine / p.vertebrae
        for (let i = 1; i < pose.spine.length; i++) {
          expect(distance3(pose.spine[i - 1], pose.spine[i])).toBeCloseTo(step, 4)
        }
      }
    }
  })

  it("never drives a foot through the floor, and reports the flight a run has", () => {
    for (const gait of gaits) {
      for (const phase of phases) {
        const pose = solveSkeleton({ gait, phase, stride: 1, lift: 1 })
        for (const leg of pose.legs) {
          for (const point of [leg.heel, leg.ball, leg.toe, leg.ankle]) {
            expect(point.y).toBeGreaterThan(-0.001)
          }
        }
      }
    }
    // A duty factor under a half means the two stances stop overlapping.
    const airborne = phases.filter(
      (phase) => !solveSkeleton({ gait: "run", phase }).grounded,
    )
    expect(airborne.length).toBeGreaterThan(0)
    expect(phases.every((phase) => solveSkeleton({ gait: "walk", phase }).grounded)).toBe(true)
    expect(solveSkeleton({ gait: "stand", phase: 0.4 }).grounded).toBe(true)
  })

  it("rolls the foot heel to toe through a stance, moving the load with it", () => {
    const strike = footRoll(0.02)
    const flat = footRoll(0.4)
    const off = footRoll(0.98)
    expect(strike.angle).toBeLessThan(0)
    expect(flat.angle).toBe(0)
    expect(off.angle).toBeGreaterThan(20)

    // Heel carries at contact, the whole sole in the middle, the toe at push-off.
    expect(strike.heelLoad).toBe(1)
    expect(strike.ballLoad).toBeLessThan(1)
    expect(flat.contact).toBe(1)
    expect(off.heelLoad).toBe(0)
    expect(off.toeLoad).toBeGreaterThan(0.8)

    // A swinging foot bears nothing and holds its toes up to clear.
    const swinging = footRoll(-1.5)
    expect(swinging.contact).toBe(0)
    expect(swinging.angle).toBeLessThan(0)
  })

  it("plants the stance foot on the floor and lifts the swinging one over it", () => {
    const planted: number[] = []
    for (let t = 0; t < 0.6; t += 0.05) {
      const sample = strideCycle("walk", t, { stride: 1, lift: 1 })
      expect(sample.contact).toBeGreaterThan(0)
      planted.push(sample.forward)
    }
    // The planted foot slides steadily backward under the body.
    for (let i = 1; i < planted.length; i++) {
      expect(planted[i]).toBeLessThan(planted[i - 1])
    }
    const swing = strideCycle("walk", 0.81, { stride: 1, lift: 1 })
    expect(swing.contact).toBe(0)
    expect(swing.height).toBeGreaterThan(defaultProportions.ankle + 4)
  })

  it("breaks the knee forward and the elbow backward", () => {
    const pose = solveSkeleton({ gait: "walk", phase: 0.8, stride: 1 })
    for (const leg of pose.legs) {
      // The machine faces -z, so a forward knee is in front of the hip-ankle line.
      const midpoint = (leg.hip.z + leg.ankle.z) / 2
      expect(leg.knee.z).toBeLessThan(midpoint)
    }
    for (const arm of pose.arms) {
      const midpoint = (arm.shoulder.z + arm.wrist.z) / 2
      expect(arm.elbow.z).toBeGreaterThan(midpoint)
    }
  })

  it("solves both arms to a reach target when it is given one", () => {
    const target = { x: 0, y: 132, z: -46 }
    const pose = solveSkeleton({ gait: "stand", reach: target })
    for (const arm of pose.arms) {
      expect(distance3(arm.wrist, target)).toBeLessThan(1)
    }
    const swinging = solveSkeleton({ gait: "stand", reach: null })
    expect(distance3(swinging.arms[0].wrist, target)).toBeGreaterThan(10)
  })

  it("crouches by lowering the hips without shortening the legs", () => {
    const tall = solveSkeleton({ stance: 1 })
    const low = solveSkeleton({ stance: 0 })
    expect(low.hipHeight).toBeLessThan(tall.hipHeight * 0.75)
    expect(distance3(low.legs[0].hip, low.legs[0].knee)).toBeCloseTo(
      distance3(tall.legs[0].hip, tall.legs[0].knee),
      6,
    )
  })

  it("stays finite on nonsense and falls back to standing", () => {
    const pose = solveSkeleton({
      // @ts-expect-error a stale gait from a consumer must degrade, not throw.
      gait: "sprint",
      phase: Number.NaN,
      stance: Number.POSITIVE_INFINITY,
      stride: Number.NaN,
      lean: Number.NaN,
      gazeYaw: Number.NaN,
      reach: { x: Number.NaN, y: 0, z: 0 },
    })
    expect(pose.gait).toBe("stand")
    const points = [
      pose.pelvis,
      pose.shoulders,
      pose.neck,
      pose.head,
      ...pose.spine,
      ...pose.legs.flatMap((leg) => [leg.hip, leg.knee, leg.ankle, leg.heel, leg.ball, leg.toe]),
      ...pose.arms.flatMap((arm) => [arm.shoulder, arm.elbow, arm.wrist]),
    ]
    for (const point of points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(Number.isFinite(point.z)).toBe(true)
    }
  })

  it("solves a leg and a foot on their own, for the machines that are only that", () => {
    const [hip, knee, ankle] = solveLeg({ x: 0, y: 88 }, { x: 6, y: 7 }, 44, 42)
    expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(44, 6)
    expect(Math.hypot(ankle.x - knee.x, ankle.y - knee.y)).toBeCloseTo(42, 6)
    expect(knee.x).toBeGreaterThan(hip.x)

    const flat = footPoints({ x: 0, y: 7 }, 0)
    expect(flat.heel.y).toBeCloseTo(0, 6)
    expect(flat.toe.y).toBeCloseTo(0, 6)
    expect(flat.toe.x).toBeGreaterThan(flat.ball.x)
    // At push-off the ankle rides up over the ball; the toe hinge extends
    // instead of the toe being driven into the floor.
    const { sole, ankle: ankleHeight } = defaultProportions
    const raised =
      sole * Math.sin((28 * Math.PI) / 180) + ankleHeight * Math.cos((28 * Math.PI) / 180)
    const lifted = footPoints({ x: 0, y: raised }, 28)
    expect(lifted.heel.y).toBeGreaterThan(flat.heel.y)
    expect(lifted.ball.y).toBeCloseTo(0, 6)
    expect(lifted.toe.y).toBeCloseTo(0, 6)
    expect(lifted.toeAngle).toBe(0)
    // Rolling back onto the heel picks the whole foot up together.
    const rocked = footPoints({ x: 0, y: 7 }, -13)
    expect(rocked.toeAngle).toBe(-13)
    expect(rocked.toe.y).toBeGreaterThan(2)
  })

  it("stacks a spine whose lean moves the shoulders and whose twist turns them", () => {
    const base = { x: 0, y: 88, z: 0 }
    const upright = spineCurve({ base, length: 56, segments: 7, lean: 0, twist: 0 })
    const leaning = spineCurve({ base, length: 56, segments: 7, lean: 35, twist: 0 })
    const turned = spineCurve({ base, length: 56, segments: 7, lean: 0, twist: 40 })
    expect(upright).toHaveLength(8)
    // Leaning forward takes the shoulders toward the nose, which is -z.
    expect(leaning[7].z).toBeLessThan(upright[7].z - 10)
    expect(leaning[7].y).toBeLessThan(upright[7].y)
    // A twist turns the column about the vertical without moving the sacrum.
    expect(turned[0]).toEqual(upright[0])
    expect(Math.abs(turned[7].x)).toBeGreaterThan(Math.abs(upright[7].x))
  })
})
