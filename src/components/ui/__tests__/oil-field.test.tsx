import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Pumpjack, pumpjackCarrier, pumpjackCrank } from "@/components/ui/pumpjack"

afterEach(cleanup)

const transform = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)?.getAttribute("d") ?? null

const hasNaN = (container: HTMLElement) =>
  container.querySelector("svg")!.innerHTML.includes("NaN")

describe("pumpjack", () => {
  it("turns the whole loop when the crank turns", () => {
    const { container, rerender } = render(<Pumpjack animate={false} crankAngle={0} />)
    const beam = container.querySelector("[data-beam]")!.getAttribute("data-angle")
    const pitman = transform(container, "[data-pitman]")
    const rod = container.querySelector("[data-rod]")!.getAttribute("data-position")

    rerender(<Pumpjack animate={false} crankAngle={90} />)

    expect(container.querySelector("[data-beam]")!.getAttribute("data-angle")).not.toBe(beam)
    expect(transform(container, "[data-pitman]")).not.toBe(pitman)
    expect(container.querySelector("[data-rod]")!.getAttribute("data-position")).not.toBe(rod)
  })

  it("moves the carrier bar by the arc the horsehead has rolled through", () => {
    // Half a turn of the crank is one full stroke, up and back down again.
    const samples = Array.from({ length: 72 }, (_, index) => pumpjackCarrier(index * 5))
    const top = Math.max(...samples)
    const bottom = Math.min(...samples)
    expect(top - bottom).toBeGreaterThan(30)
    // The stroke repeats exactly once a revolution.
    expect(pumpjackCarrier(360)).toBeCloseTo(pumpjackCarrier(0), 6)
    expect(pumpjackCarrier(Number.NaN)).toBeCloseTo(pumpjackCarrier(0), 6)
  })

  it("carries the counterweight where the balance says", () => {
    const { container, rerender } = render(<Pumpjack animate={false} crankAngle={40} balance="crank" />)
    const onCrank = transform(container, "[data-counterweight]")

    rerender(<Pumpjack animate={false} crankAngle={40} balance="beam" />)
    expect(transform(container, "[data-counterweight]")).not.toBe(onCrank)

    rerender(<Pumpjack animate={false} crankAngle={40} balance="air" />)
    expect(container.querySelector("[data-counterweight]")).not.toBeNull()
  })

  it("names itself, its crank and its view", () => {
    const { container } = render(<Pumpjack animate={false} crankAngle={120} view="iso" />)
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("Beam pump")
    expect(label).toContain("120 degrees")
    expect(label).toContain("isometric")
  })

  it("reports the crank from the keyboard and stops when interaction is off", () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <Pumpjack animate={false} crankAngle={0} interactive onCrankAngleChange={onChange} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    svg.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(5)

    onChange.mockClear()
    rerender(<Pumpjack animate={false} crankAngle={0} onCrankAngleChange={onChange} />)
    container.querySelector("svg")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    expect(onChange).not.toHaveBeenCalled()
  })

  it("draws a stable pose for a non-finite crank angle", () => {
    const { container } = render(<Pumpjack animate={false} crankAngle={Number.NaN} />)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples pump as one revolution a cycle and slow as a duty cycle", () => {
    expect(pumpjackCrank("pump", 1) - pumpjackCrank("pump", 0)).toBeCloseTo(360, 6)
    expect(pumpjackCrank("static", 0.4)).toBe(0)
    expect(pumpjackCrank("pump", Number.NaN)).toBe(0)
    // Two turns in the first 60% of the cycle, then a rest.
    expect(pumpjackCrank("slow", 0.6)).toBeCloseTo(720, 6)
    expect(pumpjackCrank("slow", 0.9)).toBeCloseTo(720, 6)
    expect(pumpjackCrank("slow", 1.3) - pumpjackCrank("slow", 1)).toBeGreaterThan(0)
  })
})
