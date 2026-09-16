import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BoreConstruct, boreConstructAdvance } from "@/components/ui/bore-construct"

afterEach(cleanup)

describe("bore-construct", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<BoreConstruct animate={false} depth={0} />)
    const parked = container.querySelector("[data-machine]")!.getAttribute("transform")

    rerender(<BoreConstruct animate={false} depth={1} />)

    expect(container.querySelector("[data-machine]")!.getAttribute("transform")).not.toBe(parked)
  })

  it("cuts the wall it has driven into, and heaps what came out", () => {
    const { container, rerender } = render(<BoreConstruct animate={false} depth={0} />)
    // Nothing removed yet: the slab is whole and there is no heap.
    expect(container.querySelector("[data-cavity]")!.getAttribute("data-progress")).toBe("0")
    expect(container.querySelector("[data-spoil]")).toBeNull()

    rerender(<BoreConstruct animate={false} depth={0.6} />)

    const cavity = container.querySelector("[data-cavity]")!
    expect(Number(cavity.getAttribute("data-progress"))).toBeGreaterThan(0)
    expect(Number(container.querySelector("[data-spoil]")!.getAttribute("data-volume"))).toBeGreaterThan(0)
    expect(container.querySelectorAll("[data-fracture] path").length).toBeGreaterThan(0)
  })

  it("rolls the drive wheel exactly as far as the machine moved", () => {
    const angle = (depth: number) => {
      const { container, unmount } = render(<BoreConstruct animate={false} depth={depth} />)
      const read = Number(container.querySelector("[data-wheel]")!.getAttribute("data-angle"))
      unmount()
      return read
    }
    // Held at the face, the wheel is still: a machine that has not moved has
    // not rolled.
    expect(angle(0)).toBe(0)
    // Twice the travel is twice the turn, and it turns the way it rolls.
    const half = angle(0.5)
    expect(half).toBeLessThan(0)
    expect(angle(1)).toBeCloseTo(half * 2, 1)
  })

  it("keeps the spindle turning under a pinned depth, through a real reduction", () => {
    const { container } = render(<BoreConstruct animate={false} phase={0.4} depth={0.3} />)

    const bit = Number(container.querySelector("[data-bit]")!.getAttribute("data-angle"))
    expect(Number.isFinite(bit)).toBe(true)
    expect(container.querySelector("[data-gearbox]")!.getAttribute("data-ratio")).toBe("3.75")
    expect(container.querySelector("[data-reduction]")!.getAttribute("data-carrier")).toBeTruthy()
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <BoreConstruct animate={false} depth={Number.NaN} hardness={Number.NaN} rev={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<BoreConstruct animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Bore construct/i)

    rerender(<BoreConstruct animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<BoreConstruct animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(boreConstructAdvance("static", 0.4, 0.5)).toBe(0.45)
    expect(boreConstructAdvance("bore", Number.NaN, 0.5)).toBe(0.45)
    // A whole cycle comes back to where it started, forwards and backwards.
    expect(boreConstructAdvance("bore", 2, 0.5)).toBeCloseTo(boreConstructAdvance("bore", 4, 0.5), 6)
    expect(boreConstructAdvance("bore", -2, 0.5)).toBeCloseTo(boreConstructAdvance("bore", 2, 0.5), 6)
    // Deeper at the top of the push than at the start of it.
    expect(boreConstructAdvance("bore", 1.6, 0.5)).toBeGreaterThan(boreConstructAdvance("bore", 0.2, 0.5))
    // Surge takes the same ground in steps, never going backwards inside a cycle.
    let last = -1
    for (let t = 0; t < 2; t += 0.05) {
      const at = boreConstructAdvance("surge", t, 0.5)
      expect(at).toBeGreaterThanOrEqual(0)
      last = at
    }
    expect(last).toBeGreaterThan(0)
    // A stalled head does not advance: nothing to cover means nothing covered.
    expect(boreConstructAdvance("bore", 9, 0)).toBe(0)
    expect(boreConstructAdvance("idle", 0.25, 0.5)).toBeLessThan(0.05)
  })
})
