import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { CrossTrainer, crossTrainerCrank } from "@/components/ui/cross-trainer"

afterEach(cleanup)

const label = (container: HTMLElement) =>
  container.querySelector("svg")!.getAttribute("aria-label")!
const stride = (container: HTMLElement) =>
  Number(container.querySelector("[data-foot-path]")!.getAttribute("data-stride"))
const feet = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-footpad]")].map((node) =>
    Number(node.getAttribute("data-foot-x")),
  )

describe("cross-trainer", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<CrossTrainer animate={false} crankAngle={0} />)
    const start = container.querySelector("[data-pedal-arm] path")!.getAttribute("d")

    rerender(<CrossTrainer animate={false} crankAngle={90} />)

    expect(container.querySelector("[data-pedal-arm] path")!.getAttribute("d")).not.toBe(start)
  })

  it("runs the two sides half a revolution apart, off the one crank", () => {
    const { container, rerender } = render(<CrossTrainer animate={false} crankAngle={40} />)
    const [near, far] = feet(container)

    rerender(<CrossTrainer animate={false} crankAngle={220} />)
    const [swapped] = feet(container)

    // Turning the crank half a turn puts the near foot where the far one was.
    expect(swapped).toBeCloseTo(far, 6)
    expect(near).not.toBeCloseTo(far, 1)
  })

  it("reports a stride that is the path's own, not the crank's diameter", () => {
    const { container, rerender } = render(<CrossTrainer animate={false} crankAngle={0} crank={36} />)
    const base = stride(container)

    expect(base).toBeGreaterThan(36 * 2)
    expect(label(container)).toMatch(/stride /)

    rerender(<CrossTrainer animate={false} crankAngle={0} crank={44} />)
    expect(stride(container)).toBeGreaterThan(base)
  })

  it("keeps the stride fixed as the crank turns — it belongs to the linkage", () => {
    const { container, rerender } = render(<CrossTrainer animate={false} crankAngle={12} />)
    const base = stride(container)

    rerender(<CrossTrainer animate={false} crankAngle={200} />)
    expect(stride(container)).toBeCloseTo(base, 9)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <CrossTrainer animate={false} crankAngle={Number.NaN} crank={Number.NaN} coupler={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<CrossTrainer animate={false} />)
    expect(label(container)).toMatch(/Cross trainer/i)

    rerender(<CrossTrainer animate={false} view="iso" />)
    expect(label(container)).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<CrossTrainer animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(crossTrainerCrank("static", 0.4)).toBe(210)
    expect(crossTrainerCrank("stride", Number.NaN)).toBe(210)
    // Unwrapped, so the easing never has to cross a seam backwards.
    expect(crossTrainerCrank("stride", 2)).toBeGreaterThan(crossTrainerCrank("stride", 1))
    expect(crossTrainerCrank("sprint", 2)).toBeGreaterThan(crossTrainerCrank("sprint", 1))
    // Coasting slows without stopping or reversing.
    const early = crossTrainerCrank("coast", 1) - crossTrainerCrank("coast", 0.5)
    const late = crossTrainerCrank("coast", 5) - crossTrainerCrank("coast", 4.5)
    expect(late).toBeGreaterThan(0)
    expect(late).toBeLessThan(early)
  })
})
