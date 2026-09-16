import { describe, expect, it } from "vitest"

import {
  boreCavity,
  boreDuty,
  boreFractures,
  boreSpall,
  cageRatio,
  rollAngle,
  defaultBoreSpec,
  defaultBoreWall,
  specificEnergy,
  spoilHeap,
  stallTorque,
} from "@/lib/robocn/boring"

const finitePoint = (p: { x: number; y: number }) =>
  Number.isFinite(p.x) && Number.isFinite(p.y)

describe("bore duty", () => {
  it("penetrates faster into softer material, at the same power", () => {
    const soft = boreDuty({ ...defaultBoreSpec, hardness: 0.1 })
    const hard = boreDuty({ ...defaultBoreSpec, hardness: 0.6 })

    expect(soft.turning && hard.turning).toBe(true)
    expect(soft.rate).toBeGreaterThan(hard.rate)
    expect(specificEnergy(0.1)).toBeLessThan(specificEnergy(0.6))
  })

  it("stalls when the face demands more torque than the drive has", () => {
    const duty = boreDuty({ ...defaultBoreSpec, hardness: 1, torque: 0.2 })

    expect(0.2).toBeLessThan(stallTorque(1))
    expect(duty.turning).toBe(false)
    expect(duty.rate).toBe(0)
    expect(duty.advancePerRev).toBe(0)
  })

  it("shares the advance out between the cutters", () => {
    const duty = boreDuty({ ...defaultBoreSpec, cutters: 8 })

    expect(duty.advancePerRev).toBeCloseTo(duty.rate / defaultBoreSpec.rev, 6)
    expect(duty.chip).toBeCloseTo(duty.advancePerRev / 8, 6)
    expect(duty.flow).toBeCloseTo(
      Math.PI * defaultBoreSpec.radius ** 2 * duty.rate,
      6,
    )
  })

  it("gives a stalled duty for rubbish rather than NaN", () => {
    const duty = boreDuty({ radius: Number.NaN, rev: Number.POSITIVE_INFINITY, torque: Number.NaN })

    for (const value of [duty.rate, duty.advancePerRev, duty.chip, duty.flow, duty.power]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })
})

describe("bore cavity", () => {
  it("cuts nothing before the crown reaches the face", () => {
    const cut = boreCavity(-5)

    expect(cut.hole).toHaveLength(0)
    expect(cut.volume).toBe(0)
    expect(cut.through).toBe(false)
  })

  it("leaves a cone-bottomed hole part way in, and a full-gauge one once through", () => {
    const { radius } = defaultBoreSpec
    const { thickness, axis } = defaultBoreWall

    const part = boreCavity(thickness / 2)
    const widest = Math.max(...part.hole.map((p) => p.y - axis))
    // The crown is a point, the mouth is gauge.
    expect(widest).toBeCloseTo(radius, 6)
    expect(part.exitRadius).toBe(0)
    expect(part.through).toBe(false)

    const done = boreCavity(thickness + radius * 2)
    expect(done.through).toBe(true)
    expect(done.breakthrough).toBe(1)
    expect(done.exitRadius).toBeCloseTo(radius, 6)
  })

  it("never charges for material outside the slab", () => {
    const { radius } = defaultBoreSpec
    const { thickness } = defaultBoreWall
    const full = Math.PI * radius * radius * thickness

    expect(boreCavity(thickness * 10).volume).toBeCloseTo(full, 4)
    // Monotonic: driving further can only remove more, never less.
    let last = -1
    for (let depth = 0; depth <= thickness * 1.5; depth += thickness / 12) {
      const volume = boreCavity(depth).volume
      expect(volume).toBeGreaterThanOrEqual(last)
      expect(volume).toBeLessThanOrEqual(full + 1e-6)
      last = volume
    }
  })

  it("stays finite for rubbish input", () => {
    const cut = boreCavity(Number.NaN, { radius: Number.NaN }, { thickness: Number.NaN })

    expect(Number.isFinite(cut.volume)).toBe(true)
    expect(cut.outline.every(finitePoint)).toBe(true)
    expect(cut.hole.every(finitePoint)).toBe(true)
  })
})

describe("spoil", () => {
  it("heaps exactly the volume that came out of the wall", () => {
    const repose = 34
    const heap = spoilHeap(9000, repose)
    const cone = (Math.PI * heap.radius ** 2 * heap.height) / 3

    expect(cone).toBeCloseTo(9000, 3)
    expect(heap.height / heap.radius).toBeCloseTo(Math.tan((repose * Math.PI) / 180), 6)
  })

  it("grows as a cube root, and vanishes at zero", () => {
    const one = spoilHeap(1000).radius
    const eight = spoilHeap(8000).radius

    expect(eight / one).toBeCloseTo(2, 6)
    expect(spoilHeap(0).radius).toBe(0)
    expect(spoilHeap(Number.NaN).outline.every(finitePoint)).toBe(true)
  })
})

describe("spall", () => {
  it("is ballistic and deterministic in the clock", () => {
    const a = boreSpall(0.3, 1, defaultBoreSpec, { count: 6 })
    const b = boreSpall(0.3, 1, defaultBoreSpec, { count: 6 })

    expect(a).toEqual(b)
    expect(a).toHaveLength(6)
    // A fragment falls: later in its own life it is lower than at launch.
    const young = boreSpall(0, 1, defaultBoreSpec, { count: 1, life: 1, speed: 0, gravity: -100 })[0]
    const old = boreSpall(0.9, 1, defaultBoreSpec, { count: 1, life: 1, speed: 0, gravity: -100 })[0]
    expect(old.y).toBeLessThan(young.y)
  })

  it("throws nothing off a head that is not cutting", () => {
    expect(boreSpall(0.4, 0, defaultBoreSpec)).toHaveLength(0)
    expect(boreSpall(Number.NaN, 1, defaultBoreSpec, { count: 4 }).every(
      (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.depth),
    )).toBe(true)
  })
})

describe("fractures and bearings", () => {
  it("cracks only once something has been cut, and further into harder material", () => {
    expect(boreFractures({ depth: 0, breakthrough: 0 })).toHaveLength(0)

    const soft = boreFractures({ depth: 30, breakthrough: 0 }, { hardness: 0.1 }, {}, 6)
    const hard = boreFractures({ depth: 30, breakthrough: 0 }, { hardness: 0.9 }, {}, 6)
    const reach = (list: ReturnType<typeof boreFractures>) =>
      Math.max(...list.map((f) => Math.abs(f.points.at(-1)!.y - f.points[0].y)))

    expect(reach(hard)).toBeGreaterThan(reach(soft))
    expect(soft.every((f) => f.points.every(finitePoint))).toBe(true)
  })

  it("rolls a wheel exactly as far as the machine moved", () => {
    const radius = 30
    // One circumference of travel is exactly one turn, and it turns the way a
    // wheel rolling forward turns.
    expect(rollAngle(2 * Math.PI * radius, radius)).toBeCloseTo(-360, 6)
    expect(rollAngle(0, radius)).toBe(-0)
    expect(rollAngle(96, radius)).toBeCloseTo(-(96 / radius) * (180 / Math.PI), 6)
    expect(Number.isFinite(rollAngle(Number.NaN, Number.NaN))).toBe(true)
  })

  it("orbits a bearing cage at just under half shaft speed", () => {
    // A roller a quarter of the pitch diameter across: (1 − 0.25)/2.
    expect(cageRatio(5, 20)).toBeCloseTo(0.375, 6)
    expect(cageRatio(0, 20)).toBeCloseTo(0.5, 6)
    expect(cageRatio(Number.NaN, Number.NaN)).toBeGreaterThan(0)
  })
})
