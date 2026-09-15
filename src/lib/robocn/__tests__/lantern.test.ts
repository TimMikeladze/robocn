import { describe, expect, it } from "vitest"

import {
  bandCell,
  cageRibs,
  chargeSegments,
  conduitBeads,
  emissionBeam,
  glyphBars,
  recital,
  reserveState,
  stepCharge,
} from "@/lib/robocn/lantern"

describe("the charge", () => {
  const options = { rate: 0.2, cellCapacity: 0.12, docked: true }

  it("conserves: what leaves the reservoir arrives in the cell", () => {
    const before = { reservoir: 0.8, cell: 0.01 }
    const step = stepCharge(before, 0.3, options)
    expect(step.state.reservoir + step.state.cell).toBeCloseTo(
      before.reservoir + before.cell - step.drawn,
      12,
    )
    expect(step.transferred).toBeCloseTo(before.reservoir - step.state.reservoir, 12)
  })

  it("gives the same state for one big step as for a thousand small ones", () => {
    // Closed form rather than integrated, which is what makes a sampler exact.
    const start = { reservoir: 1, cell: 0 }
    const span = 2.5
    const withDraw = { ...options, draw: 0.15 }
    const once = stepCharge(start, span, withDraw)
    let many = start
    let drawn = 0
    let transferred = 0
    for (let i = 0; i < 1000; i++) {
      const step = stepCharge(many, span / 1000, withDraw)
      many = step.state
      drawn += step.drawn
      transferred += step.transferred
    }
    expect(many.reservoir).toBeCloseTo(once.state.reservoir, 9)
    expect(many.cell).toBeCloseTo(once.state.cell, 9)
    expect(drawn).toBeCloseTo(once.drawn, 9)
    expect(transferred).toBeCloseTo(once.transferred, 9)
  })

  it("stops at the cell's capacity and at an empty reservoir", () => {
    const full = stepCharge({ reservoir: 1, cell: 0 }, 100, options)
    expect(full.state.cell).toBeCloseTo(0.12, 12)
    expect(full.transferred).toBeCloseTo(0.12, 12)

    const empty = stepCharge({ reservoir: 0.05, cell: 0 }, 100, { ...options, draw: 0.4 })
    expect(empty.state.reservoir).toBe(0)
    expect(empty.state.cell + empty.drawn).toBeCloseTo(0.05, 12)
  })

  it("moves nothing with no cell in the dock, and still lets the emitter draw", () => {
    const step = stepCharge({ reservoir: 0.6, cell: 0 }, 1, {
      ...options,
      docked: false,
      draw: 0.1,
    })
    expect(step.transferred).toBe(0)
    expect(step.drawn).toBeCloseTo(0.1, 12)
    expect(step.state.reservoir).toBeCloseTo(0.5, 12)
  })

  it("clamps rubbish into a state that still reads", () => {
    const step = stepCharge(
      { reservoir: Number.NaN, cell: 99 },
      Number.NaN,
      options,
    )
    expect(step.state.reservoir).toBe(0)
    expect(step.state.cell).toBe(0.12)
    expect(step.drawn).toBe(0)
  })

  it("reads the reserve four ways and gauges it without losing any of it", () => {
    expect(reserveState(0)).toBe("depleted")
    expect(reserveState(0.1)).toBe("low")
    expect(reserveState(0.6)).toBe("nominal")
    expect(reserveState(1)).toBe("full")
    expect(reserveState(Number.NaN)).toBe("depleted")

    for (const level of [0, 0.137, 0.5, 0.94, 1]) {
      const segments = chargeSegments(level, 8)
      expect(segments).toHaveLength(8)
      const sum = segments.reduce((total, fill) => total + fill, 0) / 8
      expect(sum).toBeCloseTo(level, 12)
    }
  })
})

describe("the recital", () => {
  it("lights one cell at a time and finishes on the last one", () => {
    const options = { lines: 4, glyphs: 6 }
    expect(recital(0, options).lit).toBe(0)
    expect(recital(0, options).complete).toBe(false)
    expect(recital(0.5, options).lit).toBe(12)
    expect(recital(1, options)).toMatchObject({ lit: 24, complete: true, line: 3, glyph: 5 })

    let previous = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const now = recital(t, options).lit
      expect(now).toBeGreaterThanOrEqual(previous)
      previous = now
    }
  })

  it("keeps the line and glyph inside the band it was given", () => {
    for (const t of [0, 0.3, 0.77, 1, Number.NaN, 4]) {
      const state = recital(t, { lines: 3, glyphs: 5 })
      expect(state.line).toBeGreaterThanOrEqual(0)
      expect(state.line).toBeLessThan(3)
      expect(state.glyph).toBeGreaterThanOrEqual(0)
      expect(state.glyph).toBeLessThan(5)
      expect(state.total).toBe(15)
    }
  })

  it("draws abstract marks that are the same every time and not all the same", () => {
    expect(glyphBars(3)).toEqual(glyphBars(3))
    const first = glyphBars(1)
    const second = glyphBars(2)
    expect(first).not.toEqual(second)
    for (const bar of [...first, ...second, ...glyphBars(Number.NaN)]) {
      expect(bar).toBeGreaterThan(0)
      expect(bar).toBeLessThanOrEqual(1)
    }
  })
})

describe("the cage and the column", () => {
  it("leaves a bay facing the front rather than a rib", () => {
    for (const count of [4, 6, 7, 12]) {
      const ribs = cageRibs(count, 22)
      expect(ribs).toHaveLength(count)
      // Front is -z: no rib sits on it.
      const frontmost = ribs.reduce((a, b) => (a.z < b.z ? a : b))
      expect(Math.abs(frontmost.x)).toBeGreaterThan(0.5)
      for (const rib of ribs) {
        expect(Math.hypot(rib.x, rib.z)).toBeCloseTo(22, 9)
      }
    }
    expect(cageRibs(99).length).toBe(16)
  })

  it("cuts a band cell as a closed arc between two radii", () => {
    const cell = bandCell(0, 24, 8, 3)
    expect(cell.length).toBeGreaterThanOrEqual(8)
    const radii = cell.map((point) => Math.hypot(point.x, point.y))
    expect(Math.max(...radii)).toBeCloseTo(24, 9)
    expect(Math.min(...radii)).toBeCloseTo(21, 9)
    // Angle 0 is the front, which is -z, and the footprint's y is aft.
    expect(cell[0].y).toBeLessThan(0)
  })

  it("prices reach by the inverse-square law and refuses to emit on an empty reserve", () => {
    const full = emissionBeam(1, 1, { length: 120, spread: 7 })
    const quarter = emissionBeam(1, 0.25, { length: 120, spread: 7 })
    expect(full.length).toBeCloseTo(120, 9)
    // A quarter of the power is half the distance, not a quarter of it.
    expect(quarter.length).toBeCloseTo(60, 9)
    expect(quarter.halfWidth / quarter.length).toBeCloseTo(full.halfWidth / full.length, 9)

    expect(emissionBeam(0, 1).intensity).toBe(0)
    expect(emissionBeam(0, 1).length).toBe(0)
    // The reserve is a ceiling, not a multiplier.
    expect(emissionBeam(0.3, 1).intensity).toBeCloseTo(0.3, 12)
    expect(emissionBeam(0.9, 0.4).intensity).toBeCloseTo(0.4, 12)
    expect(emissionBeam(Number.NaN, Number.NaN).intensity).toBe(0)
  })

  it("holds the conduit still when nothing is flowing", () => {
    expect(conduitBeads(0, 3.4, 4)).toEqual([0, 0.25, 0.5, 0.75])
    const moving = conduitBeads(1, 0.5, 4)
    expect(moving).not.toEqual([0, 0.25, 0.5, 0.75])
    for (const bead of moving) {
      expect(bead).toBeGreaterThanOrEqual(0)
      expect(bead).toBeLessThan(1)
    }
  })
})
