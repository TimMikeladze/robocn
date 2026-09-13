import { describe, expect, it } from "vitest"

import {
  coilWinding,
  resolverSignals,
  threePhaseField,
} from "@/lib/robocn/electromagnetism"

describe("coilWinding", () => {
  it("keeps a winding inside its requested physical envelope", () => {
    const points = coilWinding({ turns: 4, length: 20, radius: 5 })

    expect(points).toHaveLength(33)
    expect(points[0]).toEqual({ x: -10, y: 5, z: 0 })
    expect(points.at(-1)).toEqual({ x: 10, y: 5, z: 0 })
    expect(Math.max(...points.map((point) => Math.hypot(point.y, point.z)))).toBeCloseTo(5, 10)
  })

  it("changes axis and centre without changing the helix dimensions", () => {
    const points = coilWinding({
      turns: 2,
      length: 12,
      radius: 3,
      samplesPerTurn: 4,
      axis: "y",
      center: { x: 2, y: 4, z: -3 },
    })

    expect(points).toHaveLength(9)
    expect(points[0]).toEqual({ x: 5, y: -2, z: -3 })
    expect(points.at(-1)).toEqual({ x: 5, y: 10, z: -3 })
  })

  it("returns a stable finite winding for invalid options", () => {
    const points = coilWinding({ turns: Infinity, length: Number.NaN, radius: -Infinity })
    expect(points.length).toBeGreaterThan(1)
    expect(points.flatMap(({ x, y, z }) => [x, y, z]).every(Number.isFinite)).toBe(true)
  })
})

describe("threePhaseField", () => {
  it("keeps balanced phase windings 120 electrical degrees apart", () => {
    const field = threePhaseField(0)
    expect(field.phases[0]).toBeCloseTo(1, 10)
    expect(field.phases[1]).toBeCloseTo(-0.5, 10)
    expect(field.phases[2]).toBeCloseTo(-0.5, 10)
    expect(field.magnitude).toBeCloseTo(1.5, 10)
    expect(field.angle).toBeCloseTo(0, 10)
  })

  it("rotates the resultant once per electrical cycle and accounts for pole pairs", () => {
    expect(threePhaseField(0.25, 2).angle).toBeCloseTo(90, 10)
    expect(threePhaseField(0.25, 4).angle).toBeCloseTo(45, 10)
    expect(threePhaseField(0.5, 6).angle).toBeCloseTo(60, 10)
  })

  it("uses a stable zero phase for invalid input", () => {
    expect(threePhaseField(Infinity)).toEqual(threePhaseField(0))
  })
})

describe("resolverSignals", () => {
  it("returns ideal quadrature channels scaled by excitation", () => {
    expect(resolverSignals(0)).toEqual({ sine: 0, cosine: 1 })
    expect(resolverSignals(90).sine).toBeCloseTo(1, 10)
    expect(resolverSignals(90).cosine).toBeCloseTo(0, 10)
    expect(resolverSignals(30, 0.5).sine).toBeCloseTo(0.25, 10)
    expect(resolverSignals(30, 0.5).cosine).toBeCloseTo(Math.sqrt(3) / 4, 10)
  })

  it("uses neutral finite inputs when angle or excitation is invalid", () => {
    expect(resolverSignals(Number.NaN, Infinity)).toEqual({ sine: 0, cosine: 1 })
  })
})
