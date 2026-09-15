import { describe, expect, it } from "vitest"

import {
  assemblyEnvelope,
  explodeAssembly,
  explodeFraction,
  type AssemblyPart,
} from "@/lib/robocn/assembly"

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

describe("the envelope it needs", () => {
  const seated = { min: { x: -10, y: 0, z: -10 }, max: { x: 10, y: 40, z: 10 } }

  it("is exactly the seated box while the assembly is seated", () => {
    expect(assemblyEnvelope(stack, 0, seated)).toEqual(seated)
  })

  it("grows only along the axes parts actually travel, and only with progress", () => {
    const apart = assemblyEnvelope(stack, 1, seated)
    // The stack only goes up, so nothing but the ceiling moves.
    expect(apart.max.y).toBeCloseTo(seated.max.y + 30, 6)
    expect(apart.min.y).toBe(seated.min.y)
    expect(apart.max.x).toBe(seated.max.x)
    expect(apart.min.z).toBe(seated.min.z)
    expect(assemblyEnvelope(stack, 0.5, seated).max.y).toBeCloseTo(seated.max.y + 15, 6)
  })

  it("opens both sides for a handed pair", () => {
    const pair: AssemblyPart[] = [
      { id: "port", axis: { x: -1, y: 0, z: 0 }, travel: 12, order: 0 },
      { id: "starboard", axis: { x: 1, y: 0, z: 0 }, travel: 12, order: 0 },
    ]
    const apart = assemblyEnvelope(pair, 1, seated)
    expect(apart.min.x).toBeCloseTo(seated.min.x - 12, 6)
    expect(apart.max.x).toBeCloseTo(seated.max.x + 12, 6)
  })
})
