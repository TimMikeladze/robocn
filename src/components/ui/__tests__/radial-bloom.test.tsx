import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  RadialBloom,
  bloomGoal,
  ramStroke,
  type BloomBehavior,
} from "@/components/ui/radial-bloom"

const blade = (container: HTMLElement, ram = 0) =>
  container.querySelector(`[data-ram="${ram}"] [data-blade]`)!.getAttribute("d")

describe("radial bloom", () => {
  it("drives every ram out of its hub as extension rises", () => {
    const { container, rerender } = render(<RadialBloom extension={0} rams={12} />)
    expect(container.querySelectorAll("[data-ram]")).toHaveLength(12)
    const closed = blade(container)
    const otherClosed = blade(container, 5)

    rerender(<RadialBloom extension={1} rams={12} />)
    const open = blade(container)

    expect(open).not.toBe(closed)
    expect(blade(container, 5)).not.toBe(otherClosed)
    // Closed, every tip is at the same radius; open, they are not — the rams
    // have different strokes, which is where the ragged star comes from.
    expect(container.querySelector("[data-hub]")).not.toBeNull()
  })

  it("reaches further at full extension than at rest", () => {
    const reach = (extension: number) => {
      const { container, unmount } = render(
        <RadialBloom extension={extension} rams={12} pitch={0} />,
      )
      const d = blade(container)!
      const radii = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(
        ([, x, y]) => Math.hypot(Number(x) - 110, Number(y) - 110),
      )
      unmount()
      return Math.max(...radii)
    }
    expect(reach(1)).toBeGreaterThan(reach(0) + 30)
  })

  it("takes a vector of strokes and lets the vector set the ram count", () => {
    const { container } = render(<RadialBloom strokes={[1, 0, 0.5, 0.2, 0.9]} />)
    expect(container.querySelectorAll("[data-ram]")).toHaveLength(5)
    expect(blade(container, 0)).not.toBe(blade(container, 1))
  })

  it("turns the whole array on spin without changing a ram", () => {
    const { container, rerender } = render(<RadialBloom extension={0.6} spin={0} />)
    const first = blade(container)
    rerender(<RadialBloom extension={0.6} spin={30} />)
    expect(blade(container)).not.toBe(first)
  })

  it("projects one geometry through all four cameras", () => {
    const { container, rerender } = render(<RadialBloom extension={0.8} view="plan" />)
    const plan = blade(container)
    for (const view of ["front", "profile", "iso"] as const) {
      rerender(<RadialBloom extension={0.8} view={view} />)
      expect(blade(container)).not.toBe(plan)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    }
  })

  it("renders a stable neutral machine on invalid input", () => {
    const { container, getByRole, rerender } = render(
      <RadialBloom extension={Number.NaN} rams={1000} pitch={Number.NaN} spin={Number.NaN} />,
    )
    expect(container.querySelectorAll("[data-ram]")).toHaveLength(24)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)

    rerender(<RadialBloom strokes={[Number.NaN, 1, Number.POSITIVE_INFINITY]} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)

    rerender(<RadialBloom rams={0} aria-label="Bare hub" />)
    expect(container.querySelectorAll("[data-ram]")).toHaveLength(0)
    expect(getByRole("img", { name: "Bare hub" })).toBeTruthy()
  })

  it("names itself, its extension and its view, and becomes a slider when grabbable", () => {
    const { container, getByRole, rerender } = render(
      <RadialBloom extension={0.5} rams={9} view="iso" />,
    )
    expect(
      getByRole("img").getAttribute("aria-label"),
    ).toMatch(/Radial bloom, 9 rams at 50% extension, isometric view/)

    rerender(<RadialBloom extension={0.5} interactive />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("50")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
    expect(container.querySelector("svg")!.getAttribute("class")).toContain("touch-none")
  })

  it("takes a colour override through the palette", () => {
    const { container } = render(<RadialBloom extension={1} color="#ff0000" />)
    expect(container.innerHTML).toContain("#ff0000")
  })
})

describe("radial bloom behaviours", () => {
  const behaviors: BloomBehavior[] = ["bloom", "ripple", "index", "flutter", "static"]

  it("stays inside the stroke range and repeats every whole cycle", () => {
    for (const behavior of behaviors) {
      for (const clock of [0, 0.17, 0.4, 0.63, 0.85]) {
        const goal = bloomGoal(behavior, clock)
        expect(goal).toBeGreaterThanOrEqual(0)
        expect(goal).toBeLessThanOrEqual(1)
        expect(bloomGoal(behavior, clock + 3)).toBeCloseTo(goal, 6)
        expect(bloomGoal(behavior, clock - 2)).toBeCloseTo(goal, 6)

        for (const index of [0, 3, 11]) {
          const stroke = ramStroke(behavior, goal, clock, index, 12)
          expect(stroke).toBeGreaterThanOrEqual(0)
          expect(stroke).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("spreads the rams apart on ripple and index, and moves them together on bloom", () => {
    const spread = (behavior: BloomBehavior, clock: number) => {
      const strokes = Array.from({ length: 12 }, (_, i) =>
        ramStroke(behavior, 0.8, clock, i, 12),
      )
      return Math.max(...strokes) - Math.min(...strokes)
    }
    expect(spread("bloom", 0.3)).toBe(0)
    expect(spread("ripple", 0.3)).toBeGreaterThan(0.2)
    expect(spread("index", 0.3)).toBeGreaterThan(0.4)
    expect(spread("flutter", 0.3)).toBeGreaterThan(0)
  })

  it("falls back to the neutral pose on a bad clock or a bad union value", () => {
    expect(bloomGoal("static", Number.NaN)).toBe(bloomGoal("static", 0))
    expect(bloomGoal("bloom", Number.NaN)).toBe(bloomGoal("static", 0))
    expect(ramStroke("ripple", Number.NaN, 0.2, 0, 12)).toBe(0)
    expect(ramStroke("bloom", 0.5, Number.NaN, 0, 12)).toBe(0.5)
    expect(ramStroke("ripple", 0.5, 0.2, Number.NaN, Number.NaN)).toBeGreaterThanOrEqual(0)
  })
})
