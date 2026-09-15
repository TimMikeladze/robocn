import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ResistanceCam, resistanceCamAngle } from "@/components/ui/resistance-cam"

afterEach(cleanup)

const arm = (container: HTMLElement) =>
  Number(container.querySelector("[data-cam]")!.getAttribute("data-arm"))
const rise = (container: HTMLElement) =>
  Number(container.querySelector("[data-stack]")!.getAttribute("data-rise"))

describe("resistance-cam", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<ResistanceCam animate={false} angle={0} />)
    const down = container.querySelector("[data-lever] path")!.getAttribute("d")

    rerender(<ResistanceCam animate={false} angle={1} />)

    expect(container.querySelector("[data-lever] path")!.getAttribute("d")).not.toBe(down)
  })

  it("changes the moment arm across the sweep, and peaks where the profile does", () => {
    const at = (angle: number) => {
      const { container, unmount } = render(
        <ResistanceCam animate={false} angle={angle} peak={0.5} />,
      )
      const value = arm(container)
      unmount()
      return value
    }

    expect(at(0.5)).toBeGreaterThan(at(0))
    expect(at(0.5)).toBeGreaterThan(at(1))
  })

  it("raises the stack by the integral, not in step with the lever", () => {
    const at = (angle: number) => {
      const { container, unmount } = render(<ResistanceCam animate={false} angle={angle} />)
      const value = rise(container)
      unmount()
      return value
    }
    const quarters = [0, 0.25, 0.5, 0.75, 1].map(at)
    const steps = [1, 2, 3, 4].map((index) => quarters[index] - quarters[index - 1])

    expect(Math.max(...steps)).toBeGreaterThan(Math.min(...steps) * 2)
    expect(at(1)).toBeGreaterThan(0)
  })

  it("turns the cam forward with the lever, as one keyed body", () => {
    const spinAt = (angle: number) => {
      const { container, unmount } = render(<ResistanceCam animate={false} angle={angle} />)
      const value = Number(container.querySelector("[data-cam]")!.getAttribute("data-spin"))
      unmount()
      return value
    }

    expect(spinAt(1)).toBeGreaterThan(spinAt(0.5))
    expect(spinAt(0.5)).toBeGreaterThan(spinAt(0))
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <ResistanceCam animate={false} angle={Number.NaN} peak={Number.NaN} baseRadius={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself, the arm it is holding on, and the camera", () => {
    const { container, rerender } = render(<ResistanceCam animate={false} angle={0.5} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Resistance cam/i)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/moment arm/)

    rerender(<ResistanceCam animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<ResistanceCam animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(resistanceCamAngle("static", 0.4)).toBe(0.42)
    expect(resistanceCamAngle("curl", Number.NaN)).toBe(0.42)
    expect(resistanceCamAngle("curl", 1)).toBeCloseTo(resistanceCamAngle("curl", 2), 9)
    expect(resistanceCamAngle("slow", 1)).toBeCloseTo(resistanceCamAngle("slow", 2), 9)
    for (const behavior of ["curl", "slow", "hold"] as const) {
      for (let clock = 0; clock < 1; clock += 0.05) {
        const value = resistanceCamAngle(behavior, clock)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})
