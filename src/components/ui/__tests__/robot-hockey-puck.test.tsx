import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RobotHockeyPuck, puckPose, puckShot } from "@/components/ui/robot-hockey-puck"

afterEach(cleanup)

const shellOf = (container: HTMLElement) =>
  container.querySelector("[data-puck] [data-shell]")!.getAttribute("d")

/** The bounding box of a path, straight off its own numbers. */
function extent(d: string) {
  const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

describe("robot-hockey-puck", () => {
  it("slides the puck down its track when the controlled value changes", () => {
    const { container, rerender } = render(<RobotHockeyPuck animate={false} along={0} />)
    const struck = shellOf(container)

    rerender(<RobotHockeyPuck animate={false} along={1} />)

    expect(shellOf(container)).not.toBe(struck)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RobotHockeyPuck animate={false} along={Number.NaN} heading={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RobotHockeyPuck animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Robot hockey puck/i)

    rerender(<RobotHockeyPuck animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RobotHockeyPuck animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("re-solves the whole track, bounces and all, when the heading changes", () => {
    const { container, rerender } = render(<RobotHockeyPuck animate={false} along={0} heading={0} />)
    const straight = container.querySelector("[data-track]")!.getAttribute("d")

    rerender(<RobotHockeyPuck animate={false} along={0} heading={40} />)

    expect(container.querySelector("[data-track]")!.getAttribute("d")).not.toBe(straight)
  })

  it("hulls the two rims into a disc looking down and a slab edge-on", () => {
    const { container, rerender } = render(<RobotHockeyPuck animate={false} view="plan" />)
    const disc = extent(shellOf(container)!)
    // Straight down it is a circle: as tall as it is wide.
    expect(disc.height / disc.width).toBeCloseTo(1, 1)

    rerender(<RobotHockeyPuck animate={false} view="front" />)
    const slab = extent(shellOf(container)!)
    // Nearly edge-on the same two rims give the slab, and it is much flatter.
    expect(slab.width).toBeCloseTo(disc.width, 0)
    expect(slab.height).toBeLessThan(disc.height / 2)
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(puckPose("static", 0.4)).toEqual({ along: 0, turns: 0 })
    expect(puckPose("slap", Number.NaN)).toEqual({ along: 0, turns: 0 })
    // A whole cycle comes back to where it started.
    expect(puckPose("slap", 1).along).toBeCloseTo(puckPose("slap", 2).along, 9)
    expect(puckPose("wrist", 0.25).along).toBeLessThan(puckPose("wrist", 0.75).along)
    // Turning on the spot goes nowhere, but does not stop turning.
    expect(puckPose("spin", 2).along).toBe(0)
    expect(puckPose("spin", 2).turns).toBeGreaterThan(puckPose("spin", 1).turns)
    // A slap shot is struck harder and off harder boards than a wrist shot.
    expect(puckShot("slap").speed!).toBeGreaterThan(puckShot("wrist").speed!)
    expect(puckShot("nonsense" as never).speed).toBe(0)
  })
})
