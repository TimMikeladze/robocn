import { describe, expect, it } from "vitest"

import {
  bandCell,
  cageRibs,
  chargeSegments,
  conduitBeads,
  emissionBeam,
  explodeAssembly,
  explodeFraction,
  glyphBars,
  recital,
  reserveState,
  stepCharge,
  type AssemblyPart,
} from "@/lib/robocn/lantern"

const UP_AXIS = { x: 0, y: 1, z: 0 }

/** A four-part stack: fitted bottom up, so it comes apart top down. */
const stack: AssemblyPart[] = [
  { id: "base", axis: { x: 0, y: 1, z: 0 }, travel: 0, order: 0 },
  { id: "body", axis: { x: 0, y: 1, z: 0 }, travel: 10, order: 1 },
  { id: "hood", axis: { x: 0, y: 1, z: 0 }, travel: 20, order: 2 },
  { id: "cap", axis: { x: 0, y: 1, z: 0 }, travel: 30, order: 3 },
]

const at = (progress: number, overlap?: number) =>
  Object.fromEntries(
    explodeAssembly(stack, progress, overlap === undefined ? undefined : { overlap }).map(
      (part) => [part.id, part],
    ),
  )

describe("the exploded assembly", () => {
  it("reassembles exactly, not nearly", () => {
    // The whole point of the axis: seated is the zero vector, not a small one.
    for (const part of explodeAssembly(stack, 0)) {
      expect(part.offset).toEqual({ x: 0, y: 0, z: 0 })
      expect(part.distance).toBe(0)
      expect(part.fraction).toBe(0)
    }
  })

  it("puts every part exactly its own clearance away when it is all the way apart", () => {
    for (const part of explodeAssembly(stack, 1)) {
      expect(part.fraction).toBe(1)
      expect(part.distance).toBeCloseTo(part.travel, 12)
      expect(part.offset.y).toBeCloseTo(part.travel, 12)
    }
  })

  it("takes it apart in the reverse of the order it was fitted", () => {
    const parts = explodeAssembly(stack, 0.3)
    const rank = Object.fromEntries(parts.map((part) => [part.id, part.rank]))
    expect(rank).toEqual({ cap: 0, hood: 1, body: 2, base: 3 })

    // At every progress, a part fitted later is at least as far out as one
    // fitted earlier — the teardown never runs out of order.
    for (let t = 0; t <= 1; t += 0.05) {
      const now = at(t)
      expect(now.cap.fraction).toBeGreaterThanOrEqual(now.hood.fraction)
      expect(now.hood.fraction).toBeGreaterThanOrEqual(now.body.fraction)
      expect(now.body.fraction).toBeGreaterThanOrEqual(now.base.fraction)
    }
  })

  it("never moves a part backwards as the teardown runs", () => {
    let previous = at(0)
    for (let t = 0.02; t <= 1; t += 0.02) {
      const now = at(t)
      for (const id of ["cap", "hood", "body", "base"]) {
        expect(now[id].fraction).toBeGreaterThanOrEqual(previous[id].fraction)
      }
      previous = now
    }
  })

  it("is strictly sequential with no overlap, and simultaneous with full overlap", () => {
    // Sequential: the cap is clear before the hood has moved at all.
    const sequential = at(0.25, 0)
    expect(sequential.cap.fraction).toBe(1)
    expect(sequential.hood.fraction).toBe(0)

    // Together: every part is at the same fraction of its own travel.
    const together = at(0.4, 1)
    expect(together.cap.fraction).toBeCloseTo(0.4, 12)
    expect(together.hood.fraction).toBeCloseTo(0.4, 12)
    expect(together.base.fraction).toBeCloseTo(0.4, 12)
  })

  it("moves each part along its own axis, normalised", () => {
    const ribs: AssemblyPart[] = [
      { id: "left", axis: { x: -3, y: 0, z: 0 }, travel: 12, order: 0 },
      { id: "aft", axis: { x: 0, y: 0, z: 5 }, travel: 12, order: 0 },
    ]
    const [left, aft] = explodeAssembly(ribs, 1)
    expect(left.offset.x).toBeCloseTo(-12, 12)
    expect(left.offset.y).toBeCloseTo(0, 12)
    expect(aft.offset.z).toBeCloseTo(12, 12)
    expect(aft.offset.x).toBeCloseTo(0, 12)

    // Parts fitted together are one stage of the teardown, so they leave
    // together at every progress rather than staggering among themselves.
    for (const t of [0.15, 0.4, 0.62, 0.9]) {
      const [a, b] = explodeAssembly(ribs, t)
      expect(a.fraction).toBe(b.fraction)
      expect(a.rank).toBe(b.rank)
    }
    // A course of ribs inside a stack counts as one stage, not as N.
    const stacked = explodeAssembly(
      [
        { id: "floor", axis: UP_AXIS, travel: 0, order: 0 },
        { id: "rib-a", axis: { x: 1, y: 0, z: 0 }, travel: 9, order: 1 },
        { id: "rib-b", axis: { x: -1, y: 0, z: 0 }, travel: 9, order: 1 },
        { id: "lid", axis: UP_AXIS, travel: 9, order: 2 },
      ],
      0.5,
    )
    expect(stacked.map((part) => part.rank)).toEqual([2, 1, 1, 0])
  })

  it("degrades instead of throwing on rubbish", () => {
    for (const part of explodeAssembly(stack, Number.NaN)) {
      expect(part.offset).toEqual({ x: 0, y: 0, z: 0 })
    }
    expect(explodeAssembly([], 0.5)).toEqual([])
    const [only] = explodeAssembly(
      [{ id: "x", axis: { x: 0, y: 0, z: 0 }, travel: Number.NaN, order: 0 }],
      1,
    )
    // A zero axis falls back to straight up, and a rubbish travel is no travel.
    expect(only.direction).toEqual({ x: 0, y: 1, z: 0 })
    expect(only.distance).toBe(0)
    expect(explodeFraction(9, 4, 2)).toBe(1)
  })
})

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
