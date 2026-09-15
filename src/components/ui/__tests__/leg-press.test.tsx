import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { LegPress, legPressTravel } from "@/components/ui/leg-press"

afterEach(cleanup)

const label = (container: HTMLElement) =>
  container.querySelector("svg")!.getAttribute("aria-label")!
const load = (container: HTMLElement) =>
  Number(container.querySelector("[data-sled]")!.getAttribute("data-load"))

const at = (props: Record<string, unknown>) => {
  const { container, unmount } = render(<LegPress animate={false} {...props} />)
  const value = { load: load(container), label: label(container) }
  unmount()
  return value
}

describe("leg-press", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<LegPress animate={false} travel={0} />)
    const racked = container.querySelector("[data-sled]")!.getAttribute("data-along")

    rerender(<LegPress animate={false} travel={1} />)

    expect(container.querySelector("[data-sled]")!.getAttribute("data-along")).not.toBe(racked)
  })

  it("loads the sled with the component along the rails, and nothing else", () => {
    // Three discs a side at twenty apiece is 120 on the sled.
    expect(at({ travel: 0.5, railAngle: 30 }).load).toBeCloseTo(60, 6)
    expect(at({ travel: 0.5, railAngle: 90 }).load).toBeCloseTo(120, 6)
    expect(at({ travel: 0.5, railAngle: 0 }).load).toBeCloseTo(0, 6)
  })

  it("does not change the load as the sled travels — only the frame does that", () => {
    expect(at({ travel: 0 }).load).toBeCloseTo(at({ travel: 1 }).load, 9)
  })

  it("puts the rail angle and the share it passes on in the label", () => {
    expect(at({ travel: 0.5, railAngle: 30 }).label).toMatch(/rails at 30 degrees/)
    expect(at({ travel: 0.5, railAngle: 30 }).label).toMatch(/120 on the sled and 60 of it along the rails — 50 percent/)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <LegPress animate={false} travel={Number.NaN} railAngle={Number.NaN} plates={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<LegPress animate={false} />)
    expect(label(container)).toMatch(/Leg press/i)

    rerender(<LegPress animate={false} view="iso" />)
    expect(label(container)).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<LegPress animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(legPressTravel("static", 0.4)).toBe(0.45)
    expect(legPressTravel("press", Number.NaN)).toBe(0.45)
    expect(legPressTravel("press", 1)).toBeCloseTo(legPressTravel("press", 2), 9)
    expect(legPressTravel("partials", 1)).toBeCloseTo(legPressTravel("partials", 2), 9)
    for (const behavior of ["press", "partials", "hold"] as const) {
      for (let clock = 0; clock < 1; clock += 0.05) {
        const value = legPressTravel(behavior, clock)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})
