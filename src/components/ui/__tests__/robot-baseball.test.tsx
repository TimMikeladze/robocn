import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RobotBaseball, baseballPitch, baseballPose } from "@/components/ui/robot-baseball"

afterEach(cleanup)

const shellOf = (container: HTMLElement) =>
  container.querySelector("[data-shell]")!.getAttribute("d")

describe("robot-baseball", () => {
  it("moves the ball down the flight when the controlled value changes", () => {
    const { container, rerender } = render(<RobotBaseball animate={false} along={0} />)
    const released = shellOf(container)

    rerender(<RobotBaseball animate={false} along={1} />)

    expect(shellOf(container)).not.toBe(released)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RobotBaseball animate={false} along={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelector("[data-pitch]")!.getAttribute("data-pitch")).toBe("fastball")
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RobotBaseball animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Robot baseball/i)

    rerender(<RobotBaseball animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RobotBaseball animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("breaks a curveball off the line a spinless pitch flies", () => {
    const { container } = render(<RobotBaseball animate={false} behavior="curveball" along={1} />)
    const solved = container.querySelector("[data-path]")!.getAttribute("d")
    const datum = container.querySelector("[data-datum]")!.getAttribute("d")

    // Same release, same gravity: everything between them is the spin.
    expect(solved).not.toBe(datum)
  })

  it("carries the seam round the back as the ball turns", () => {
    const { container, rerender } = render(<RobotBaseball animate={false} along={0} behavior="fastball" />)
    const first = container.querySelector("[data-seam]")!.getAttribute("d")

    rerender(<RobotBaseball animate={false} along={0.5} behavior="fastball" />)

    expect(container.querySelector("[data-seam]")!.getAttribute("d")).not.toBe(first)
  })

  it("does not let the two behaviours that are not pitches quote a pitch", () => {
    const caption = (container: HTMLElement) => container.querySelector("text")!.textContent!
    const { container, rerender } = render(<RobotBaseball animate={false} behavior="fastball" along={0.5} />)
    expect(caption(container)).toMatch(/FASTBALL .* BREAK/)

    rerender(<RobotBaseball animate={false} behavior="spin" />)
    expect(caption(container)).not.toMatch(/BREAK|FASTBALL/)

    rerender(<RobotBaseball animate={false} behavior="static" />)
    expect(caption(container)).not.toMatch(/BREAK|REV/)
  })

  it("draws no flight for the behaviours that throw nothing", () => {
    const { container, rerender } = render(<RobotBaseball animate={false} behavior="slider" />)
    expect(container.querySelector("[data-path]")).not.toBeNull()

    for (const behavior of ["spin", "static"] as const) {
      rerender(<RobotBaseball animate={false} behavior={behavior} />)
      expect(container.querySelector("[data-path]")).toBeNull()
      expect(container.querySelector("[data-datum]")).toBeNull()
    }
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(baseballPose("static", 0.4)).toEqual({ along: 0, turns: 0 })
    expect(baseballPose("fastball", Number.NaN)).toEqual({ along: 0, turns: 0 })
    // A whole cycle comes back to where it started.
    expect(baseballPose("slider", 1).along).toBeCloseTo(baseballPose("slider", 2).along, 9)
    // A pitch leaves the hand and reaches the plate.
    expect(baseballPose("curveball", 0.25).along).toBeLessThan(baseballPose("curveball", 0.75).along)
    // Turning on the spot goes nowhere, but does not stop turning.
    expect(baseballPose("spin", 2).along).toBe(0)
    expect(baseballPose("spin", 2).turns).toBeGreaterThan(baseballPose("spin", 1).turns)
    expect(baseballPitch("spin")).toBe("fastball")
  })
})
