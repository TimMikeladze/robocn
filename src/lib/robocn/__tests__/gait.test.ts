import { describe, expect, it } from "vitest"

import {
  fetlockSink,
  gaitBeats,
  gaitLoad,
  solveGait,
  type EquineGait,
} from "@/lib/robocn/gait"

const gaits: EquineGait[] = ["halt", "walk", "trot", "pace", "canter", "gallop"]
const cycle = [0, 0.08, 0.17, 0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75, 0.83, 0.92, 0.97]

describe("solveGait", () => {
  it("counts the beat of each gait from its own footfalls", () => {
    // The whole point of the solver: the beat is an output of the offsets, not
    // a label. A walk is four, a trot and a pace two, a canter three, a gallop
    // four — and the pace proves the count alone does not name a gait.
    expect(gaitBeats("halt")).toBe(0)
    expect(gaitBeats("walk")).toBe(4)
    expect(gaitBeats("trot")).toBe(2)
    expect(gaitBeats("pace")).toBe(2)
    expect(gaitBeats("canter")).toBe(3)
    expect(gaitBeats("gallop")).toBe(4)
    for (const gait of gaits) {
      expect(solveGait({ gait }).beats).toBe(gaitBeats(gait))
    }
  })

  it("keeps the load a share of one body, and nothing at all in the air", () => {
    for (const gait of gaits) {
      for (const phase of cycle) {
        const pose = solveGait({ gait, phase })
        const total = pose.legs.reduce((sum, leg) => sum + leg.load, 0)
        for (const leg of pose.legs) {
          expect(leg.load, `${gait} ${leg.id} load`).toBeGreaterThanOrEqual(0)
          expect(leg.load, `${gait} ${leg.id} load`).toBeLessThanOrEqual(1)
          // A limb in the air carries nothing, and a grounded one carries
          // something: that is the whole contract downstream.
          expect(leg.load > 0, `${gait} ${leg.id} at ${phase}`).toBe(leg.contact)
        }
        expect(pose.support).toBe(pose.legs.filter((leg) => leg.contact).length)
        expect(pose.airborne).toBe(pose.support === 0)
        expect(total, `${gait} total at ${phase}`).toBeCloseTo(pose.airborne ? 0 : 1, 9)
      }
    }
  })

  it("gives each gait the support pattern it is named for", () => {
    // A walk never has fewer than two feet down and never leaves the floor.
    for (const phase of cycle) {
      const walk = solveGait({ gait: "walk", phase })
      expect(walk.support, `walk support at ${phase}`).toBeGreaterThanOrEqual(2)
      expect(walk.airborne).toBe(false)
    }
    // A gallop does leave it.
    expect(cycle.some((phase) => solveGait({ gait: "gallop", phase }).airborne)).toBe(true)
    // Halted, all four are down and square.
    const halt = solveGait({ gait: "halt" })
    expect(halt.support).toBe(4)
    expect(halt.legs.every((leg) => leg.load > 0)).toBe(true)
    // The forehand carries more than the hind end, standing square.
    const fore = halt.legs.filter((leg) => leg.fore).reduce((sum, leg) => sum + leg.load, 0)
    expect(fore).toBeGreaterThan(0.5)
    expect(fore).toBeCloseTo(halt.forehand, 9)
  })

  it("mirrors a canter and a gallop about the lead, and ignores it otherwise", () => {
    const mirror = (id: string) => id.replace("left", "tmp").replace("right", "left").replace("tmp", "right")
    for (const gait of ["canter", "gallop"] as const) {
      for (const phase of cycle) {
        const left = solveGait({ gait, phase, lead: "left" })
        const right = solveGait({ gait, phase, lead: "right" })
        expect(left.lead).toBe("left")
        for (const leg of left.legs) {
          const twin = right.legs.find((candidate) => candidate.id === mirror(leg.id))!
          expect(twin.load, `${gait} ${leg.id} at ${phase}`).toBeCloseTo(leg.load, 9)
        }
      }
      // And the lead fore is the last foot to land, which is what a lead is.
      expect(solveGait({ gait, lead: "left" }).leadLeg).toBe("fore-left")
      expect(solveGait({ gait, lead: "right" }).leadLeg).toBe("fore-right")
    }
    // Symmetrical gaits have no lead to swap.
    for (const gait of ["walk", "trot", "pace"] as const) {
      const left = solveGait({ gait, phase: 0.3, lead: "left" })
      const right = solveGait({ gait, phase: 0.3, lead: "right" })
      expect(left.legs.map((leg) => leg.load)).toEqual(right.legs.map((leg) => leg.load))
      expect(left.leadLeg).toBeNull()
    }
  })

  it("puts every swinging foot above the floor and every planted one on it", () => {
    for (const gait of gaits) {
      for (const phase of cycle) {
        for (const leg of solveGait({ gait, phase }).legs) {
          // No foot is ever driven through the floor, and a planted one is on
          // it exactly. A swinging foot touches zero only at the two instants
          // the swing starts and ends, which is what lift-off and touchdown are.
          expect(leg.foot.y, `${gait} ${leg.id}`).toBeGreaterThanOrEqual(0)
          if (leg.contact) expect(leg.foot.y, `${gait} ${leg.id}`).toBe(0)
          expect(Number.isFinite(leg.foot.x)).toBe(true)
        }
      }
      // Mid-swing is genuinely clear of the ground.
      const swinging = solveGait({ gait, phase: 0.5, lift: 1 }).legs.filter((leg) => !leg.contact)
      for (const leg of swinging) {
        if (leg.t > 0.01 && leg.t < 0.99) expect(leg.foot.y, `${gait} ${leg.id}`).toBeGreaterThan(0)
      }
    }
  })

  it("renders a neutral standing pose for invalid input", () => {
    const bad = solveGait({
      gait: "canter" as EquineGait,
      phase: Number.NaN,
      duty: Number.NaN,
      stride: Number.NaN,
      lift: Number.NaN,
    })
    expect(bad.legs.every((leg) => Number.isFinite(leg.load) && Number.isFinite(leg.foot.x))).toBe(true)
    expect(solveGait({ gait: "gait" as EquineGait }).gait).toBe("halt")
    expect(solveGait({ gait: "walk", phase: -0.25 }).legs.map((leg) => leg.load)).toEqual(
      solveGait({ gait: "walk", phase: 0.75 }).legs.map((leg) => leg.load),
    )
  })
})

describe("the sprung fetlock", () => {
  it("sinks in proportion to the load and returns when the limb is free", () => {
    expect(fetlockSink(0)).toBe(0)
    expect(fetlockSink(0.5)).toBeGreaterThan(0)
    expect(fetlockSink(1)).toBeGreaterThan(fetlockSink(0.5))
    // It is a spring, not a hinge: bounded at both ends, neutral on nonsense.
    expect(fetlockSink(4)).toBe(fetlockSink(1))
    expect(fetlockSink(-3)).toBe(0)
    expect(fetlockSink(Number.NaN)).toBe(0)
  })

  it("reads the same load the pose reports", () => {
    const pose = solveGait({ gait: "trot", phase: 0.2 })
    for (const leg of pose.legs) {
      expect(gaitLoad(pose, leg.id)).toBe(leg.load)
    }
    expect(gaitLoad(pose, "fore-middle" as never)).toBe(0)
  })
})
