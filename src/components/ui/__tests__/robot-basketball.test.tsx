import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RobotBasketball, basketballPose } from "@/components/ui/robot-basketball"

afterEach(cleanup)

const shellOf = (container: HTMLElement) =>
  container.querySelector("[data-shell]")!.getAttribute("d")

describe("robot-basketball", () => {
  it("lifts the ball off the floor when the controlled height changes", () => {
    const { container, rerender } = render(<RobotBasketball animate={false} height={0} />)
    const down = shellOf(container)

    rerender(<RobotBasketball animate={false} height={1} />)

    expect(shellOf(container)).not.toBe(down)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RobotBasketball animate={false} height={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RobotBasketball animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Robot basketball/i)

    rerender(<RobotBasketball animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RobotBasketball animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("cuts eight panels out of three seams, and hides the far half", () => {
    const { container } = render(<RobotBasketball animate={false} height={0.5} />)
    const seams = container.querySelectorAll("[data-seam]")
    // Three curves, each of which may be split into more than one visible run.
    expect(seams.length).toBeGreaterThanOrEqual(3)
    for (const seam of seams) expect(seam.getAttribute("d")).not.toMatch(/NaN/)
  })

  it("brings the paddle down to meet the ball only when something drives it", () => {
    const { container, rerender } = render(<RobotBasketball animate={false} behavior="dribble" />)
    expect(container.querySelector("[data-paddle]")).not.toBeNull()

    rerender(<RobotBasketball animate={false} behavior="drop" />)
    expect(container.querySelector("[data-paddle]")).toBeNull()
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(basketballPose("static", 0.4).height).toBe(0)
    expect(basketballPose("dribble", Number.NaN).height).toBe(0)
    // A whole cycle comes back to where it started.
    expect(basketballPose("dribble", 1).height).toBeCloseTo(basketballPose("dribble", 2).height, 6)
    // The dribble is a real arch: on the floor at the ends, highest in the middle.
    expect(basketballPose("dribble", 0.5).height).toBeGreaterThan(basketballPose("dribble", 0.1).height)
    // The drop runs down its ladder, so the apexes get lower across the cycle.
    const peak = (from: number, to: number) =>
      Math.max(
        ...Array.from({ length: 80 }, (_, index) =>
          basketballPose("drop", from + ((to - from) * index) / 79).height,
        ),
      )
    expect(peak(0, 0.25)).toBeGreaterThan(peak(0.25, 0.5))
    expect(peak(0.25, 0.5)).toBeGreaterThan(peak(0.5, 0.75))
    // Travelling, it rolls: the turn it has made goes with how far it has gone.
    const moved = basketballPose("travel", 1)
    expect(moved.drift).toBeGreaterThan(0)
    expect(moved.turns).toBeCloseTo(moved.drift / (2 * Math.PI * 23), 6)
    // The paddle only exists where something is driving the ball.
    expect(basketballPose("dribble", 0.3).paddle).not.toBeNull()
    expect(basketballPose("drop", 0.3).paddle).toBeNull()
  })
})
