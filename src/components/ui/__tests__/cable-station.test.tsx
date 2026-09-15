import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { CableStation, cableStationDraw } from "@/components/ui/cable-station"

afterEach(cleanup)

const label = (container: HTMLElement) =>
  container.querySelector("svg")!.getAttribute("aria-label")!

describe("cable-station", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<CableStation animate={false} draw={0} />)
    const racked = container.querySelector("[data-cable]")!.getAttribute("d")
    const stack = container.querySelector("[data-stack]")!.getAttribute("data-rise")

    rerender(<CableStation animate={false} draw={1} />)

    expect(container.querySelector("[data-cable]")!.getAttribute("d")).not.toBe(racked)
    expect(container.querySelector("[data-stack]")!.getAttribute("data-rise")).not.toBe(stack)
  })

  it("shares the draw between the lines, so the same pull lifts the same height", () => {
    const riseOn = (lines: number, draw = 0.5) => {
      const { container, unmount } = render(
        <CableStation animate={false} draw={draw} lines={lines} />,
      )
      const rise = Number(container.querySelector("[data-stack]")!.getAttribute("data-rise"))
      unmount()
      return rise
    }

    // A full pull is a full stack whatever the reeving — it just takes `lines`
    // times as much rope through the hands to get there.
    expect(riseOn(1)).toBeCloseTo(riseOn(2), 6)
    expect(riseOn(2)).toBeCloseTo(riseOn(3), 6)
    expect(riseOn(2)).toBeGreaterThan(0)
  })

  it("runs out of post before it runs out of headroom at heavy reeving", () => {
    const riseOn = (lines: number) => {
      const { container, unmount } = render(
        <CableStation animate={false} draw={1} lines={lines} />,
      )
      const rise = Number(container.querySelector("[data-stack]")!.getAttribute("data-rise"))
      unmount()
      return rise
    }

    // Three lines still fit down the post; six want more rope than there is
    // frame, so the pull bottoms out and the stack never reaches the crown.
    expect(riseOn(3)).toBeCloseTo(riseOn(2), 6)
    expect(riseOn(6)).toBeLessThan(riseOn(2))
  })

  it("reports the advantage and the handle force rather than taking them", () => {
    const { container, rerender } = render(
      <CableStation animate={false} draw={0.4} pin={5} plateWeight={5} lines={2} />,
    )
    // Six plates at five apiece, over two lines.
    expect(label(container)).toMatch(/6 of 10 plates selected at 30/)
    expect(label(container)).toMatch(/mechanical advantage of 2, so the handle holds 15/)

    rerender(<CableStation animate={false} draw={0.4} pin={5} plateWeight={5} lines={4} />)
    expect(label(container)).toMatch(/mechanical advantage of 4, so the handle holds 7.5/)
  })

  it("splits the stack at the pin", () => {
    const { container } = render(<CableStation animate={false} draw={0.5} pin={2} />)

    expect(container.querySelectorAll("[data-plate]")).toHaveLength(10)
    expect(container.querySelectorAll("[data-plate][data-rising]")).toHaveLength(3)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <CableStation animate={false} draw={Number.NaN} pin={Number.NaN} lines={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<CableStation animate={false} />)
    expect(label(container)).toMatch(/Cable station/i)

    rerender(<CableStation animate={false} view="iso" />)
    expect(label(container)).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<CableStation animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(cableStationDraw("static", 0.4)).toBe(0.35)
    expect(cableStationDraw("press", Number.NaN)).toBe(0.35)
    // A whole cycle comes back to where it started.
    expect(cableStationDraw("press", 1)).toBeCloseTo(cableStationDraw("press", 2), 9)
    expect(cableStationDraw("pyramid", 1)).toBeCloseTo(cableStationDraw("pyramid", 2), 9)
    for (const behavior of ["press", "pyramid", "hold"] as const) {
      for (let clock = 0; clock < 1; clock += 0.05) {
        const value = cableStationDraw(behavior, clock)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })
})
