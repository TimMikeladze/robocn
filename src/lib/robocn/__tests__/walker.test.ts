import { describe, expect, it } from "vitest"

import {
  solveWalker,
  supportMargin,
  walkerGaits,
  walkerHullPoint,
  type WalkerGait,
  type WalkerPose,
} from "@/lib/robocn/walker"

const phases = [0, 0.12, 0.25, 0.37, 0.5, 0.63, 0.75, 0.88, 0.999]

/** Femur and tibia live in the leg's own vertical plane, not in the plan view. */
function linkLengths(leg: WalkerPose["legs"][number]) {
  return {
    hipToKnee: Math.hypot(
      Math.hypot(leg.knee.x - leg.hip.x, leg.knee.y - leg.hip.y),
      leg.hipHeight - leg.kneeHeight,
    ),
    kneeToFoot: Math.hypot(
      Math.hypot(leg.foot.x - leg.knee.x, leg.foot.y - leg.knee.y),
      leg.kneeHeight - leg.clearance,
    ),
  }
}

describe("solveWalker", () => {
  it("holds femur and tibia lengths across every gait, height and phase", () => {
    for (const legs of [2, 4] as const) {
      for (const gait of walkerGaits(legs)) {
        for (const height of [0, 0.5, 1]) {
          for (const phase of phases) {
            const pose = solveWalker({ legs, gait, height, phase, step: 1, lift: 1 })
            expect(pose.legs).toHaveLength(legs)
            for (const leg of pose.legs) {
              const { hipToKnee, kneeToFoot } = linkLengths(leg)
              const where = `${legs} ${gait} ${height} ${phase} leg ${leg.id}`
              expect(hipToKnee, `${where} femur`).toBeCloseTo(pose.femur, 6)
              expect(kneeToFoot, `${where} tibia`).toBeCloseTo(pose.tibia, 6)
            }
          }
        }
      }
    }
  })

  it("carries the whole body on the feet that are down", () => {
    for (const legs of [2, 4] as const) {
      for (const gait of walkerGaits(legs)) {
        for (const phase of phases) {
          const pose = solveWalker({ legs, gait, phase })
          const total = pose.legs.reduce((sum, leg) => sum + leg.load, 0)
          expect(total, `${legs} ${gait} ${phase}`).toBeCloseTo(pose.airborne ? 0 : 1, 9)
          for (const leg of pose.legs) {
            if (leg.clearance > 0) expect(leg.load).toBe(0)
            if (leg.load > 0) expect(leg.contact).toBe(true)
          }
        }
      }
    }
  })

  it("buys every offset of the mass with attitude, and nothing else", () => {
    // The relation the whole family is built on, checked against the pose it
    // came out of rather than against the input that went in.
    for (const legs of [2, 4] as const) {
      for (const gait of walkerGaits(legs)) {
        for (const phase of phases) {
          const pose = solveWalker({ legs, gait, phase })
          expect(pose.centre.x).toBeCloseTo(pose.hull * Math.sin((pose.roll * Math.PI) / 180), 9)
          // Pitch is measured on the already-rolled hull, so the fore-aft
          // reach is what the roll left of its height.
          expect(pose.centre.y).toBeCloseTo(
            pose.hull * Math.cos((pose.roll * Math.PI) / 180) * Math.sin((pose.pitch * Math.PI) / 180),
            9,
          )
          expect(Math.abs(pose.roll)).toBeLessThanOrEqual(pose.rollLimit + 1e-9)
          expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(pose.pitchLimit + 1e-9)
        }
      }
    }
  })

  it("rolls because one foot is down, not because it was told to", () => {
    // A biped in single support has to get its mass over the stance foot; in
    // double support it is already between them and stands level.
    const single = solveWalker({ legs: 2, gait: "walk", phase: 0.3 })
    expect(single.support).toHaveLength(1)
    expect(Math.abs(single.roll)).toBeGreaterThan(10)
    expect(single.centre.x).toBeCloseTo(single.support[0].x, 6)
    expect(single.stable).toBe(true)

    const double = solveWalker({ legs: 2, gait: "walk", phase: 0 })
    expect(double.support).toHaveLength(2)
    expect(double.roll).toBeCloseTo(0, 9)

    // A taller hull reaches the same foot with less roll — static geometry, and
    // the docs say it is not a claim about a tall machine in motion.
    const tall = solveWalker({ legs: 2, gait: "walk", phase: 0.3, hull: 60, rollLimit: 60 })
    expect(Math.abs(tall.roll)).toBeLessThan(Math.abs(single.roll))
  })

  it("walks a quadruped nearly level, and cannot pace one at all", () => {
    // Four feet, or three of them, still contain the mass: no attitude needed.
    for (const phase of phases) {
      const pose = solveWalker({ legs: 4, gait: "walk", phase })
      expect(pose.support.length, `walk at ${phase}`).toBeGreaterThanOrEqual(3)
      expect(Math.abs(pose.roll), `roll at ${phase}`).toBeLessThan(4)
      expect(pose.stable, `stable at ${phase}`).toBe(true)
    }

    // Pace swings both legs of a side together, so the support collapses to a
    // line down one flank that the hull cannot roll far enough to reach.
    const paced = phases.map((phase) => solveWalker({ legs: 4, gait: "pace", phase }))
    expect(paced.some((pose) => !pose.stable)).toBe(true)
    const worst = paced.find((pose) => !pose.stable)!
    expect(Math.abs(worst.roll)).toBeCloseTo(worst.rollLimit, 6)
    expect(worst.margin).toBeLessThan(0)
  })

  it("reports a flight phase instead of hiding it", () => {
    const strides = Array.from({ length: 200 }, (_, index) =>
      solveWalker({ legs: 2, gait: "stride", phase: index / 200 }),
    )
    const flying = strides.filter((pose) => pose.airborne)
    expect(flying.length).toBeGreaterThan(0)
    for (const pose of flying) {
      expect(pose.support).toHaveLength(0)
      expect(pose.stable).toBe(false)
      // Nothing to be inside of, so no margin is claimed either way.
      expect(pose.margin).toBe(0)
      expect(pose.legs.every((leg) => leg.load === 0)).toBe(true)
    }
    // A walk keeps a real double support and never leaves the floor.
    expect(
      Array.from({ length: 200 }, (_, index) =>
        solveWalker({ legs: 2, gait: "walk", phase: index / 200 }),
      ).some((pose) => pose.airborne),
    ).toBe(false)
  })

  it("drops the hip on the side it rolls onto", () => {
    const pose = solveWalker({ legs: 2, gait: "walk", phase: 0.3 })
    const starboard = pose.legs.find((leg) => leg.name === "starboard")!
    const port = pose.legs.find((leg) => leg.name === "port")!
    // Positive roll is starboard-down, and the hips are bolted to the hull.
    expect(pose.roll).toBeGreaterThan(0)
    expect(starboard.hipHeight).toBeLessThan(pose.ride)
    expect(port.hipHeight).toBeGreaterThan(pose.ride)
    expect((starboard.hipHeight + port.hipHeight) / 2).toBeCloseTo(pose.ride, 6)
  })

  it("hands the load to the foot the mass is standing over", () => {
    const pose = solveWalker({ legs: 4, gait: "stand" })
    // Square and level: the four feet split the body evenly.
    for (const leg of pose.legs) expect(leg.load).toBeCloseTo(0.25, 6)

    // Pushed to starboard, that side takes more of it — and the far side less.
    const pushed = solveWalker({ legs: 4, gait: "stand", lean: { x: 1, y: 0 } })
    const near = pushed.legs.filter((leg) => leg.foot.x > 0)
    const far = pushed.legs.filter((leg) => leg.foot.x < 0)
    expect(near.reduce((sum, leg) => sum + leg.load, 0)).toBeGreaterThan(0.5)
    expect(far.reduce((sum, leg) => sum + leg.load, 0)).toBeLessThan(0.5)
    expect(pushed.roll).toBeCloseTo(pushed.rollLimit, 6)
  })

  it("stands square, level and inside its own feet", () => {
    const pose = solveWalker({ legs: 4, gait: "stand" })
    expect(pose.legs.every((leg) => leg.contact)).toBe(true)
    expect(pose.roll).toBe(0)
    expect(pose.pitch).toBe(0)
    expect(pose.margin).toBeGreaterThan(0)
    expect(pose.airborne).toBe(false)
    expect(pose.stable).toBe(true)
  })

  it("stops the ride height where the legs stop reaching", () => {
    const tall = solveWalker({ legs: 4, gait: "walk", height: 1 })
    // Short legs get a low machine rather than a foot they cannot hold.
    const stubby = solveWalker({ legs: 4, gait: "walk", height: 1, femur: 14, tibia: 14 })
    expect(stubby.ride).toBeLessThan(tall.ride)
    expect(stubby.legs.every((leg) => leg.hipHeight > 0)).toBe(true)
  })

  it("only offers a leg count the gaits it has", () => {
    expect(walkerGaits(2)).toEqual(["stand", "walk", "stride"])
    expect(walkerGaits(4)).toEqual(["stand", "walk", "creep", "pace"])
    // A quadruped gait on a biped is not drawn as nonsense; it stands.
    expect(solveWalker({ legs: 2, gait: "pace", phase: 0.3 }).gait).toBe("stand")
    expect(solveWalker({ legs: 4, gait: "stride", phase: 0.3 }).gait).toBe("stand")
  })

  it("repeats every whole cycle, in both directions", () => {
    const at = (phase: number) => JSON.stringify(solveWalker({ legs: 4, gait: "walk", phase }))
    expect(at(2.25)).toBe(at(0.25))
    expect(at(-0.75)).toBe(at(0.25))
  })

  it("renders a neutral stance from garbage input", () => {
    for (const legs of [2, 4] as const) {
      const pose = solveWalker({
        legs,
        gait: "sideways" as WalkerGait,
        phase: Number.NaN,
        height: Number.NaN,
        step: Number.POSITIVE_INFINITY,
        lift: Number.NaN,
        femur: Number.NaN,
        tibia: Number.NaN,
        hull: Number.NaN,
        halfWidth: Number.NaN,
        halfLength: Number.NaN,
        rollLimit: Number.NaN,
        pitchLimit: Number.NaN,
        inset: Number.NaN,
        lean: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      })
      expect(JSON.stringify(pose)).not.toMatch(/null|NaN/)
      expect(pose.gait).toBe("stand")
      expect(pose.legs.every((leg) => leg.contact)).toBe(true)
      expect(pose.stable).toBe(true)
    }
    // An impossible leg count is a quadruped rather than an exception.
    expect(solveWalker({ legs: 7 as never }).count).toBe(4)
  })
})

describe("walkerHullPoint", () => {
  it("puts a hull-mounted part on the same machine the hips are on", () => {
    // The drawing and the solve share one transform; this is that contract.
    const pose = solveWalker({ legs: 4, gait: "pace", phase: 0.2 })
    for (const leg of pose.legs) {
      const home = {
        x: Math.sign(leg.foot.x) * 22,
        y: 0,
        z: leg.name.startsWith("fore") ? 40 : -40,
      }
      const point = walkerHullPoint(pose, home)
      expect(point.x).toBeCloseTo(leg.hip.x, 9)
      expect(point.z).toBeCloseTo(leg.hip.y, 9)
      expect(point.y).toBeCloseTo(leg.hipHeight, 9)
    }
    // The mass is the hull's own point at `hull` above the hips.
    const mass = walkerHullPoint(pose, { x: 0, y: pose.hull, z: 0 })
    expect(mass.x).toBeCloseTo(pose.centre.x, 9)
    expect(mass.z).toBeCloseTo(pose.centre.y, 9)
    // Garbage in is the hip centre, not NaN.
    expect(walkerHullPoint(pose, { x: Number.NaN, y: Number.NaN, z: Number.NaN })).toEqual({
      x: 0,
      y: pose.ride,
      z: 0,
    })
  })
})

describe("supportMargin", () => {
  it("is positive inside a polygon, zero at best on a line, and negative outside", () => {
    const square = [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ]
    expect(supportMargin({ x: 0, y: 0 }, square)).toBeCloseTo(10, 9)
    expect(supportMargin({ x: 9, y: 0 }, square)).toBeCloseTo(1, 9)
    expect(supportMargin({ x: 14, y: 0 }, square)).toBeCloseTo(-4, 9)
    // Winding does not change the answer.
    expect(supportMargin({ x: 0, y: 0 }, [...square].reverse())).toBeCloseTo(10, 9)

    const line = [
      { x: -10, y: 0 },
      { x: 10, y: 0 },
    ]
    expect(supportMargin({ x: 0, y: 0 }, line)).toBeCloseTo(0, 9)
    expect(supportMargin({ x: 0, y: 3 }, line)).toBeCloseTo(-3, 9)
    expect(supportMargin({ x: 4, y: 0 }, [{ x: 0, y: 0 }])).toBeCloseTo(-4, 9)
    expect(supportMargin({ x: 4, y: 0 }, [])).toBe(0)
  })
})
