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

  it("moves the whole tubing string only when it is not anchored", () => {
    const barrel = (container: HTMLElement) =>
      container.querySelector("[data-barrel] path")!.getAttribute("d")
    const set = (container: HTMLElement) =>
      container.querySelector("[data-tubing-anchor]")!.getAttribute("data-set")

    // On bottom the rods are carrying nothing, so an unanchored string is at
    // the same length an anchored one is and the drawing is identical.
    const bottom = render(<RodPump animate={false} cycle={0} condition="full" />)
    const bottomFree = render(<RodPump animate={false} cycle={0} condition="unanchored" />)
    expect(barrel(bottomFree.container)).toBe(barrel(bottom.container))
    expect(set(bottom.container)).toBe("1")
    expect(set(bottomFree.container)).toBe("0")
    cleanup()

    // At the top the column is all on the rods, the string has shortened, and
    // the barrel has chased the plunger up the hole.
    const top = render(<RodPump animate={false} cycle={0.5} condition="full" />)
    const topFree = render(<RodPump animate={false} cycle={0.5} condition="unanchored" />)
    expect(barrel(topFree.container)).not.toBe(barrel(top.container))
    // And the pump swept less of the stroke than the plunger travelled.
    expect(
      Number(topFree.container.querySelector("[data-card]")!.getAttribute("data-swept")),
    ).toBeLessThan(0.9)
  })

  it("draws the well down when the pump takes fluid in, and never past its intake", () => {
    const level = (node: HTMLElement) =>
      Number(node.querySelector("[data-annulus]")!.getAttribute("data-level"))

    const bottom = render(<RodPump animate={false} cycle={0} />)
    const top = render(<RodPump animate={false} cycle={0.5} />)

    // The barrel is full at the top of the stroke, and that came out of the
    // annulus; it comes back over the downstroke.
    expect(level(top.container)).toBeLessThan(level(bottom.container))
    cleanup()

    // A level that started above the mud anchor's ports stays above them, so a
    // sound pump keeps its feed however hard it pulls.
    // It has drawn down — but it stopped at the ports instead of going the
    // whole 8% of the window the full drawdown would have taken it.
    const shallow = render(<RodPump animate={false} cycle={0.5} fluidLevel={0.2} />)
    expect(level(shallow.container)).toBeLessThan(0.2)
    expect(level(shallow.container)).toBeGreaterThan(0.14)
    expect(shallow.container.querySelector("[data-mud-anchor]")!.getAttribute("data-fed")).toBe("1")
  })

  it("takes the fluid the long way round the mud anchor, and only while it is drawing", () => {
    // Up the stroke the standing valve is open and the well is coming in
    // through the ports, down the annulus and back up the dip tube.
    const drawing = render(<RodPump animate={false} cycle={0.25} />)
    expect(drawing.container.querySelector("[data-anchor-flow]")).not.toBeNull()
    cleanup()

    // Coming down nothing goes past the standing valve, so nothing moves in it.
    const pushing = render(<RodPump animate={false} cycle={0.75} />)
    expect(pushing.container.querySelector("[data-anchor-flow]")).toBeNull()
  })

  it("keeps the formation flowing in all cycle, and only stops it on a full column", () => {
    const rate = (node: HTMLElement) =>
      Number(node.querySelector("[data-inflow]")!.getAttribute("data-rate"))

    // Both halves of the stroke: the reservoir does not know about the valves.
    const up = render(<RodPump animate={false} cycle={0.25} />)
    const down = render(<RodPump animate={false} cycle={0.75} />)
    expect(rate(up.container)).toBeGreaterThan(0)
    expect(rate(down.container)).toBeGreaterThan(0)
    cleanup()

    // What does stop it is the level coming back up and killing the drawdown.
    const low = render(<RodPump animate={false} cycle={0.25} fluidLevel={0.4} />)
    const high = render(<RodPump animate={false} cycle={0.25} fluidLevel={0.95} />)
    expect(rate(high.container)).toBeLessThan(rate(low.container))
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
