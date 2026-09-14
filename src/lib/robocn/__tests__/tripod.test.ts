import { describe, expect, it } from "vitest"

import { solveTripod, type TripodGait, type TripodPose } from "@/lib/robocn/tripod"

const gaits: TripodGait[] = ["stand", "creep", "amble", "pivot"]
const phases = [0, 0.17, 0.33, 0.5, 0.66, 0.83, 0.999]

/** Femur and tibia live in the leg's own vertical plane, not in the plan view. */
function linkLengths(pose: TripodPose, leg: TripodPose["legs"][number]) {
  return {
    hipToKnee: Math.hypot(
      Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y),
      pose.height - leg.kneeHeight,
    ),
    kneeToFoot: Math.hypot(
      Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y),
      leg.kneeHeight - leg.clearance,
    ),
  }
}

describe("solveTripod", () => {
  it("holds femur and tibia lengths across every gait, height and phase", () => {
    for (const gait of gaits) {
      for (const height of [0, 0.5, 1]) {
        for (const phase of phases) {
          const pose = solveTripod({ gait, height, phase, step: 1, lift: 1 })
          expect(pose.legs).toHaveLength(3)
          for (const leg of pose.legs) {
            const { hipToKnee, kneeToFoot } = linkLengths(pose, leg)
            expect(hipToKnee, `${gait} ${height} ${phase} leg ${leg.id} femur`).toBeCloseTo(pose.femur, 6)
            expect(kneeToFoot, `${gait} ${height} ${phase} leg ${leg.id} tibia`).toBeCloseTo(pose.tibia, 6)
          }
        }
      }
    }
  })

  it("carries the whole body on the feet that are down", () => {
    for (const gait of gaits) {
      for (const phase of phases) {
        const pose = solveTripod({ gait, phase })
        const total = pose.legs.reduce((sum, leg) => sum + leg.load, 0)
        expect(total, `${gait} ${phase}`).toBeCloseTo(1, 9)
        // A foot in the air carries nothing, and a loaded foot is on the ground.
        for (const leg of pose.legs) {
          if (leg.clearance > 0) expect(leg.load).toBe(0)
          if (leg.load > 0) expect(leg.contact).toBe(true)
        }
      }
    }
  })

  it("puts the body at the load-weighted mean of its contacts while it can reach it", () => {
    // Creep stays inside the sway limit, so the clamp never bites and the
    // static condition holds exactly.
    for (const phase of phases) {
      const pose = solveTripod({ gait: "creep", phase })
      const mean = pose.legs.reduce(
        (sum, leg) => ({ x: sum.x + leg.foot.x * leg.load, y: sum.y + leg.foot.y * leg.load }),
        { x: 0, y: 0 },
      )
      expect(pose.centre.x, `x at ${phase}`).toBeCloseTo(mean.x, 9)
      expect(pose.centre.y, `y at ${phase}`).toBeCloseTo(mean.y, 9)
      expect(pose.stable, `stable at ${phase}`).toBe(true)
    }
  })

  it("loses the support polygon when the gait asks for more sway than it has", () => {
    // Amble takes two feet off at once, so the body is asked to stand over a
    // single contact well outside the sway its legs allow: the clamp bites and
    // the centre of mass leaves the support.
    const stubby = phases.map((phase) => solveTripod({ gait: "amble", phase }))
    expect(stubby.some((pose) => !pose.stable)).toBe(true)
    expect(stubby.some((pose) => pose.margin < 0)).toBe(true)

    // Longer legs buy the reach to get there, and the same gait holds on.
    const rangy = phases.map((phase) => solveTripod({ gait: "amble", phase, femur: 60, tibia: 70 }))
    expect(rangy.every((pose) => pose.margin >= -1e-6)).toBe(true)
    expect(rangy[0].sway).toBeGreaterThan(stubby[0].sway)
  })

  it("stops the body where the legs stop reaching", () => {
    // Sway is not a free number: it is what is left of the leg once a planted
    // foot has been paid for, so standing tall leaves less of it than crouching.
    const crouched = solveTripod({ gait: "creep", height: 0 })
    const tall = solveTripod({ gait: "creep", height: 1 })
    expect(crouched.sway).toBeGreaterThan(tall.sway)
    // Asking for more than that is still capped; asking for less is honoured.
    expect(solveTripod({ gait: "creep", sway: 500 }).sway).toBeCloseTo(solveTripod({ gait: "creep" }).sway, 9)
    expect(solveTripod({ gait: "creep", sway: 2 }).sway).toBe(2)
  })

  it("stands with the body inside the triangle and every foot down", () => {
    const pose = solveTripod({ gait: "stand" })
    expect(pose.legs.every((leg) => leg.contact)).toBe(true)
    expect(pose.support).toHaveLength(3)
    expect(pose.margin).toBeGreaterThan(0)
    expect(pose.centre.x).toBeCloseTo(0, 9)
    expect(pose.centre.y).toBeCloseTo(0, 9)
    expect(pose.yaw).toBe(0)
  })

  it("turns the body on the spot in pivot and leaves it facing forward otherwise", () => {
    expect(solveTripod({ gait: "pivot", phase: 0.5, turn: 60 }).yaw).toBeCloseTo(30, 6)
    expect(solveTripod({ gait: "pivot", phase: 1 }).yaw).toBe(0)
    expect(solveTripod({ gait: "creep", phase: 0.5 }).yaw).toBe(0)
  })

  it("walks where the heading points", () => {
    const nose = solveTripod({ gait: "creep", phase: 0.85, heading: 0 })
    const beam = solveTripod({ gait: "creep", phase: 0.85, heading: 90 })
    const swingNose = nose.legs.find((leg) => !leg.contact)!
    const swingBeam = beam.legs.find((leg) => leg.id === swingNose.id)!
    expect(swingBeam.foot.x).not.toBeCloseTo(swingNose.foot.x, 3)
  })

  it("moves the body under a lean and clamps it to the sway disc", () => {
    const centred = solveTripod({ gait: "stand" })
    const pushed = solveTripod({ gait: "stand", lean: { x: 0, y: 1 } })
    expect(pushed.centre.y).toBeCloseTo(centred.sway, 6)
    // The hips are bolted to the body, so they go with it.
    expect(pushed.legs[0].hip.y - centred.legs[0].hip.y).toBeCloseTo(centred.sway, 6)
    // Pushed to the stop it is past the line between its two forefeet.
    expect(pushed.stable).toBe(false)
    // Halfway there it is still over them.
    expect(solveTripod({ gait: "stand", lean: { x: 0, y: 0.5 } }).stable).toBe(true)

    // Beyond the disc it is still on the disc.
    const far = solveTripod({ gait: "stand", lean: { x: 8, y: -8 } })
    expect(Math.hypot(far.centre.x, far.centre.y)).toBeCloseTo(far.sway, 6)
  })

  it("repeats every whole cycle, in both directions", () => {
    const at = (phase: number) => JSON.stringify(solveTripod({ gait: "creep", phase }))
    expect(at(2.25)).toBe(at(0.25))
    expect(at(-0.75)).toBe(at(0.25))
  })

  it("renders a neutral stance from garbage input", () => {
    const pose = solveTripod({
      gait: "sideways" as TripodGait,
      phase: Number.NaN,
      height: Number.NaN,
      step: Number.POSITIVE_INFINITY,
      lift: Number.NaN,
      heading: Number.NaN,
      femur: Number.NaN,
      tibia: Number.NaN,
      turn: Number.NaN,
      sway: Number.NaN,
      lean: { x: Number.NaN, y: Number.NaN },
    })
    expect(JSON.stringify(pose)).not.toMatch(/null|NaN/)
    expect(pose.legs.every((leg) => leg.contact)).toBe(true)
    expect(pose.margin).toBeGreaterThan(0)
  })
})
