import { describe, expect, it } from "vitest"

import {
  plantigradeStep,
  soleLimits,
  solveSole,
  solveSupport,
  type SupportContact,
} from "@/lib/robocn/bear"

const limb = {
  hip: { x: 0, y: 40 },
  femur: 20,
  tibia: 18,
  heel: 5,
  toe: 9,
  ankle: 4,
} as const

const soleLength = (pose: { heel: { x: number; y: number }; toe: { x: number; y: number } }) =>
  Math.hypot(pose.toe.x - pose.heel.x, pose.toe.y - pose.heel.y)

describe("solveSole", () => {
  it("keeps the sole rigid at every pitch and pivot", () => {
    for (const pitch of [-40, -18, 0, 12, 35]) {
      for (const pivot of ["heel", "flat", "toe"] as const) {
        const pose = solveSole({ ...limb, plant: { x: 2, y: 0 }, pivot, pitch })
        expect(soleLength(pose), `${pivot} @ ${pitch}`).toBeCloseTo(limb.heel + limb.toe, 6)
      }
    }
  })

  it("never puts either end of the sole through the floor", () => {
    for (const pitch of [-50, -20, 0, 20, 50]) {
      for (const pivot of ["heel", "flat", "toe"] as const) {
        const pose = solveSole({ ...limb, plant: { x: 0, y: 0 }, pivot, pitch })
        expect(Math.min(pose.heel.y, pose.toe.y), `${pivot} @ ${pitch}`).toBeGreaterThan(-1e-6)
      }
    }
  })

  it("reports the contact from the geometry, and the span with it", () => {
    const flat = solveSole({ ...limb, plant: { x: 0, y: 0 }, pivot: "flat", pitch: 0 })
    expect(flat.contact).toBe("flat")
    // A flat sole is an interval as long as the sole itself: the whole point.
    expect(flat.span![1] - flat.span![0]).toBeCloseTo(limb.heel + limb.toe, 6)

    const strike = solveSole({ ...limb, plant: { x: 0, y: 0 }, pivot: "heel", pitch: 18 })
    expect(strike.contact).toBe("heel")
    expect(strike.span![0]).toBeCloseTo(strike.span![1], 6)

    const off = solveSole({ ...limb, plant: { x: 0, y: 0 }, pivot: "toe", pitch: -26 })
    expect(off.contact).toBe("toe")
    expect(off.span![0]).toBeCloseTo(off.toe.x, 6)

    const swung = solveSole({ ...limb, plant: { x: 0, y: 9 }, pivot: "flat", pitch: 6 })
    expect(swung.contact).toBe("airborne")
    expect(swung.span).toBeNull()
  })

  it("solves the leg to the ankle the sole placement produced", () => {
    const pose = solveSole({ ...limb, plant: { x: 3, y: 0 }, pivot: "flat", pitch: 0 })
    expect(Math.hypot(pose.knee.x - pose.hip.x, pose.knee.y - pose.hip.y)).toBeCloseTo(limb.femur, 3)
    expect(Math.hypot(pose.ankle.x - pose.knee.x, pose.ankle.y - pose.knee.y)).toBeCloseTo(limb.tibia, 3)
    // The ankle rides its own height above the sole line.
    expect(pose.ankle.y).toBeCloseTo(limb.ankle, 3)
    expect(pose.reached).toBe(true)
  })

  it("refuses to stand on a floor it cannot reach", () => {
    // A hip taken further from the floor than the limb is long.
    const pose = solveSole({ ...limb, hip: { x: 0, y: 70 }, plant: { x: 0, y: 0 }, pivot: "flat" })
    expect(pose.reached).toBe(false)
    expect(pose.contact).toBe("airborne")
    expect(pose.span).toBeNull()
    // And the sole is still rigid and still hung off the ankle it could reach.
    expect(soleLength(pose)).toBeCloseTo(limb.heel + limb.toe, 6)
    expect(pose.ankle.y).toBeGreaterThan(limb.ankle)
  })

  it("renders a finite pose for invalid input", () => {
    const pose = solveSole({
      hip: { x: Number.NaN, y: Number.NaN },
      plant: { x: Number.NaN, y: Number.NaN },
      pivot: "flat",
      pitch: Number.NaN,
      femur: Number.NaN,
      tibia: Number.NaN,
      heel: Number.NaN,
      toe: Number.NaN,
      ankle: Number.NaN,
    })
    for (const point of [pose.hip, pose.knee, pose.ankle, pose.heel, pose.toe]) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true)
    }
  })
})

describe("solveSupport", () => {
  const two: SupportContact[] = [
    { id: "hind", span: [-10, -2] },
    { id: "fore", span: [12, 20] },
  ]

  it("reduces to the lever rule for two contacts", () => {
    // Midpoints at −6 and 16: a centre of mass at 5 is exactly halfway.
    const even = solveSupport(two, 5)
    expect(even.loads.hind).toBeCloseTo(0.5, 6)
    expect(even.loads.fore).toBeCloseTo(0.5, 6)

    const forward = solveSupport(two, 10)
    // Schoolbook: load(hind) = (16 − com) / (16 − −6).
    expect(forward.loads.hind).toBeCloseTo((16 - 10) / 22, 6)
    expect(forward.loads.fore).toBeCloseTo((10 - -6) / 22, 6)
    expect(forward.loads.hind + forward.loads.fore).toBeCloseTo(1, 10)
  })

  it("unions the spans into one base and measures the margin off its edges", () => {
    const pose = solveSupport(two, 5)
    expect(pose.span).toEqual([-10, 20])
    // Dead centre of [−10, 20] is 5.
    expect(pose.margin).toBeCloseTo(1, 6)
    expect(solveSupport(two, 20).margin).toBeCloseTo(0, 6)
    expect(solveSupport(two, 26).margin).toBeLessThan(0)
    expect(solveSupport(two, 26).stable).toBe(false)
    expect(solveSupport(two, 19).stable).toBe(true)
  })

  it("widens the base with a third contact, which is what sitting buys", () => {
    const seated = solveSupport([...two, { id: "seat", span: [-26, -14] }], -6)
    expect(seated.span).toEqual([-26, 20])
    expect(seated.margin).toBeGreaterThan(solveSupport(two, -6).margin)
    expect(Object.values(seated.loads).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10)
  })

  it("gives an airborne contact no load, and no feet no base at all", () => {
    const reared = solveSupport([{ id: "hind", span: [-10, -2] }, { id: "fore", span: null }], -6)
    expect(reared.loads.fore).toBe(0)
    expect(reared.loads.hind).toBeCloseTo(1, 10)
    expect(reared.span).toEqual([-10, -2])

    const airborne = solveSupport([{ id: "hind", span: null }, { id: "fore", span: null }], 0)
    expect(airborne.span).toBeNull()
    expect(airborne.stable).toBe(false)
    expect(Object.values(airborne.loads).every((value) => value === 0)).toBe(true)
  })

  it("never returns a negative load, even with the mass outside the base", () => {
    const toppling = solveSupport(two, 60)
    expect(toppling.stable).toBe(false)
    for (const load of Object.values(toppling.loads)) {
      expect(load).toBeGreaterThanOrEqual(0)
      expect(load).toBeLessThanOrEqual(1)
    }
    expect(Object.values(toppling.loads).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10)
  })

  it("is neutral for invalid input", () => {
    expect(solveSupport(two, Number.NaN).com).toBe(0)
    expect(solveSupport([], 0).span).toBeNull()
  })
})

describe("plantigradeStep", () => {
  it("rolls heel to flat to toe, and only then swings", () => {
    const duty = 0.62
    expect(plantigradeStep(0, { duty }).roll).toBe("strike")
    expect(plantigradeStep(0, { duty }).pivot).toBe("heel")
    expect(plantigradeStep(0, { duty }).pitch).toBeCloseTo(soleLimits.strike, 6)

    const flat = plantigradeStep(duty * 0.4, { duty })
    expect(flat.roll).toBe("flat")
    expect(flat.pitch).toBe(0)
    expect(flat.contact).toBe(true)

    const off = plantigradeStep(duty * 0.95, { duty })
    expect(off.roll).toBe("off")
    expect(off.pivot).toBe("toe")
    expect(off.pitch).toBeLessThan(0)

    const swing = plantigradeStep(duty + (1 - duty) / 2, { duty })
    expect(swing.roll).toBe("swing")
    expect(swing.contact).toBe(false)
    expect(swing.plant.y).toBeGreaterThan(0)
  })

  it("carries the contact backwards through the stance and forwards through the swing", () => {
    const stance = [0, 0.15, 0.3, 0.45, 0.6].map((t) => plantigradeStep(t).plant.x)
    for (let i = 1; i < stance.length; i += 1) expect(stance[i]).toBeLessThan(stance[i - 1])
    expect(plantigradeStep(0.99).plant.x).toBeGreaterThan(plantigradeStep(0.7).plant.x)
  })

  it("stays in its own limits, wraps, and is neutral for a non-finite cycle", () => {
    for (const t of [0, 0.2, 0.5, 0.62, 0.8, 0.999]) {
      const step = plantigradeStep(t, { reach: 12, clearance: 8 })
      expect(Math.abs(step.plant.x)).toBeLessThanOrEqual(12 + 1e-9)
      expect(step.plant.y).toBeGreaterThanOrEqual(0)
      expect(step.plant.y).toBeLessThanOrEqual(8 + 1e-9)
      expect(Math.abs(step.pitch)).toBeLessThanOrEqual(soleLimits.off)
    }
    expect(plantigradeStep(1.25)).toEqual(plantigradeStep(0.25))
    expect(plantigradeStep(-0.75)).toEqual(plantigradeStep(0.25))
    expect(plantigradeStep(Number.NaN)).toEqual(plantigradeStep(0))
  })
})
