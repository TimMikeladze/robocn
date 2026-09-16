import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RodPump, rodPumpCycle } from "@/components/ui/rod-pump"

afterEach(cleanup)

const plunger = (container: HTMLElement) =>
  container.querySelector("[data-plunger] path")!.getAttribute("d")

describe("rod-pump", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<RodPump animate={false} cycle={0} />)
    const bottom = plunger(container)

    rerender(<RodPump animate={false} cycle={0.5} />)

    expect(plunger(container)).not.toBe(bottom)
    expect(container.querySelector("[data-plunger]")!.getAttribute("data-travel")).toBe("1")
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RodPump animate={false} cycle={Number.NaN} behavior="nonsense" condition="wildcat"
        geometry={{ fillage: Number.NaN, plungerDiameter: Number.POSITIVE_INFINITY }} />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RodPump animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Rod pump/i)

    rerender(<RodPump animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RodPump animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(rodPumpCycle("static", 0.4)).toBe(0.25)
    expect(rodPumpCycle("pump", Number.NaN)).toBe(0.25)
    // Unwrapped, so the easing never crosses the seam at the bottom of the stroke.
    expect(rodPumpCycle("pump", 3.25) - rodPumpCycle("pump", 2.25)).toBeCloseTo(1, 6)
    // A duty cycle: two strokes, then a rest.
    expect(rodPumpCycle("slow", 0.6)).toBeCloseTo(2, 6)
    expect(rodPumpCycle("slow", 0.9)).toBeCloseTo(2, 6)
    expect(rodPumpCycle("slow", 1.6)).toBeCloseTo(4, 6)
  })

  it("swaps the valves between the two halves of the stroke", () => {
    const { container, rerender } = render(<RodPump animate={false} cycle={0.25} />)
    const lift = (which: string) =>
      Number(container.querySelector(`[data-${which}-valve]`)!.getAttribute("data-open"))

    expect(lift("standing")).toBe(1)
    expect(lift("travelling")).toBe(0)

    rerender(<RodPump animate={false} cycle={0.75} />)

    expect(lift("standing")).toBe(0)
    expect(lift("travelling")).toBe(1)
  })

  it("rides the balls on the flow rather than switching them", () => {
    const ball = (cycle: number) =>
      Number(
        render(<RodPump animate={false} cycle={cycle} />)
          .container.querySelector('[data-ball="standing"]')!
          .closest("[data-standing-valve]")!
          .getAttribute("data-open"),
      )

    // Early on the upstroke the plunger is barely moving, so the ball is barely
    // off its seat; by mid-stroke the flow has carried it to its cage.
    const early = ball(0.035)
    cleanup()
    const mid = ball(0.25)

    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(0.6)
    expect(mid).toBe(1)
  })

  it("draws a different card for each condition, and a reference card beside a fault", () => {
    const { container, rerender } = render(<RodPump animate={false} cycle={0.25} condition="full" />)
    const full = container.querySelector("[data-trace]")!.getAttribute("d")
    expect(container.querySelector("[data-reference]")).toBeNull()

    rerender(<RodPump animate={false} cycle={0.25} condition="pound" geometry={{ fillage: 0.5 }} />)

    expect(container.querySelector("[data-trace]")!.getAttribute("d")).not.toBe(full)
    expect(container.querySelector("[data-reference]")).not.toBeNull()
    expect(container.querySelector("[data-card]")!.getAttribute("data-condition")).toBe("pound")
  })

  it("leaves the plunger falling through a void under fluid pound", () => {
    const { container } = render(
      <RodPump animate={false} cycle={0.6} condition="pound" geometry={{ fillage: 0.4 }} />,
    )
    const valve = container.querySelector("[data-travelling-valve]")!

    // Above the liquid on the downstroke: nothing is going through the valve,
    // so its ball is still on its seat and there is a void between the plunger
    // foot and what the barrel took in.
    expect(valve.getAttribute("data-flow")).toBe("0")
    expect(valve.getAttribute("data-open")).toBe("0")
    expect(container.querySelector("[data-void]")).not.toBeNull()
  })

  it("wears the ball the condition is leaking through, and shows the slip", () => {
    const { container, rerender } = render(
      <RodPump animate={false} cycle={0.25} condition="tv-leak" geometry={{ leak: 0.8 }} />,
    )
    const wear = (which: string) =>
      container.querySelector(`[data-ball="${which}"]`)!.getAttribute("data-wear")

    expect(wear("travelling")).toBe("0.8")
    expect(wear("standing")).toBe("0")

    rerender(<RodPump animate={false} cycle={0.25} condition="full" geometry={{ leak: 0.8 }} />)

    expect(wear("travelling")).toBe("0")
  })

  it("is a slider with a real readout when it is interactive", () => {
    const { container } = render(<RodPump animate={false} cycle={0.25} interactive />)
    const svg = container.querySelector("svg")!

    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuenow")).toBe("0.25")
    expect(svg.getAttribute("aria-valuetext")).toMatch(/upstroke/)
    expect(svg.getAttribute("class")).toContain("touch-none")
  })
})
