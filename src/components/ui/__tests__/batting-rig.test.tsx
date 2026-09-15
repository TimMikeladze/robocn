import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BattingRig, battingRigPhase } from "@/components/ui/batting-rig"

afterEach(cleanup)

const batOf = (container: HTMLElement) =>
  container.querySelector("[data-bat] path")!.getAttribute("d")

const readout = (container: HTMLElement) => container.querySelector("text")!.textContent!

describe("batting-rig", () => {
  it("swings the bat when the controlled phase changes", () => {
    const { container, rerender } = render(<BattingRig animate={false} swing={0} />)
    const loaded = batOf(container)

    rerender(<BattingRig animate={false} swing={1} />)

    expect(batOf(container)).not.toBe(loaded)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <BattingRig animate={false} swing={Number.NaN} stance={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<BattingRig animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Batting rig/i)

    rerender(<BattingRig animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<BattingRig animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("lets the stance decide where on the barrel the ball arrives", () => {
    const { container, rerender } = render(<BattingRig animate={false} swing={0.52} stance={34} />)
    const square = readout(container)

    // Standing right on top of the line jams it on the handle.
    rerender(<BattingRig animate={false} swing={0.52} stance={22} />)
    const jammed = readout(container)
    // Standing well off it puts the ball on the end of the bat.
    rerender(<BattingRig animate={false} swing={0.52} stance={44} />)
    const ended = readout(container)

    expect(jammed).not.toBe(square)
    expect(ended).not.toBe(square)
    // Both of them cost exit speed against the stance that finds the sweet spot.
    const exit = (text: string) => Number(text.match(/EXIT (\d+)/)![1])
    expect(exit(square)).toBeGreaterThan(exit(jammed))
    expect(exit(square)).toBeGreaterThan(exit(ended))
  })

  it("puts the ball on its line before contact and on the exit ray after", () => {
    const { container, rerender } = render(<BattingRig animate={false} swing={0.1} />)
    const arriving = container.querySelector("[data-ball]")!.getAttribute("cy")

    rerender(<BattingRig animate={false} swing={0.9} />)

    expect(container.querySelector("[data-ball]")!.getAttribute("cy")).not.toBe(arriving)
    expect(container.querySelector("[data-exit]")).not.toBeNull()
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(battingRigPhase("static", 0.4)).toBe(0)
    expect(battingRigPhase("swing", Number.NaN)).toBe(0)
    // A whole cycle comes back to where it started.
    expect(battingRigPhase("swing", 1)).toBeCloseTo(battingRigPhase("swing", 2), 9)
    expect(battingRigPhase("swing", 0.25)).toBeLessThan(battingRigPhase("swing", 0.75))
    // Neither of the two that hold back ever reaches contact.
    for (let index = 0; index <= 40; index += 1) {
      expect(battingRigPhase("load", index / 40)).toBeLessThan(0.52)
      expect(battingRigPhase("check", index / 40)).toBeLessThan(0.52)
    }
  })
})
