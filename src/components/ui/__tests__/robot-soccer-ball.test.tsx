import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RobotSoccerBall, rolledTo, soccerPose } from "@/components/ui/robot-soccer-ball"

afterEach(cleanup)

const shellOf = (container: HTMLElement) =>
  container.querySelector("[data-shell]")!.getAttribute("d")

describe("robot-soccer-ball", () => {
  it("rolls the ball across when the controlled travel changes", () => {
    const { container, rerender } = render(<RobotSoccerBall animate={false} travel={0} />)
    const left = shellOf(container)
    const panel = container.querySelector("[data-panel]")!.getAttribute("d")

    rerender(<RobotSoccerBall animate={false} travel={1} />)

    expect(shellOf(container)).not.toBe(left)
    // The panels turned with it, which is the whole point of rolling.
    expect(container.querySelector("[data-panel]")!.getAttribute("d")).not.toBe(panel)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RobotSoccerBall animate={false} travel={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RobotSoccerBall animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Robot soccer ball/i)

    rerender(<RobotSoccerBall animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RobotSoccerBall animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("draws only the panels the camera can see", () => {
    const { container } = render(<RobotSoccerBall animate={false} travel={0.5} />)
    const drawn = container.querySelectorAll("[data-panel]")
    // Half a truncated icosahedron, give or take the ones on the limb.
    expect(drawn.length).toBeGreaterThan(8)
    expect(drawn.length).toBeLessThan(32)
    expect(container.querySelectorAll('[data-panel="pentagon"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-panel="hexagon"]').length).toBeGreaterThan(0)
  })

  it("shows the bend against the line the kick was struck along", () => {
    const { container } = render(<RobotSoccerBall animate={false} behavior="bend" view="plan" />)
    expect(container.querySelector("[data-path]")!.getAttribute("d")).not.toBe(
      container.querySelector("[data-datum]")!.getAttribute("d"),
    )
  })

  it("takes the kick off the drawing once the ball is in hand", () => {
    const { container, rerender } = render(<RobotSoccerBall animate={false} behavior="bend" view="plan" />)
    expect(container.querySelector("[data-path]")).not.toBeNull()

    // Rolled by hand, the ball is not on that arc — so the arc is not drawn.
    rerender(<RobotSoccerBall animate={false} behavior="bend" view="plan" travel={0.7} />)
    expect(container.querySelector("[data-path]")).toBeNull()
    expect(container.querySelector("[data-datum]")).toBeNull()
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(soccerPose("static", 0.4).turns).toBe(0)
    expect(soccerPose("roll", Number.NaN).turns).toBe(0)
    // A whole cycle comes back to where it started.
    expect(soccerPose("roll", 1).position.x).toBeCloseTo(soccerPose("roll", 2).position.x, 6)
    // Rolling is θ = s / r, in both directions, with nothing else in it.
    const out = rolledTo(42)
    expect(out.turns).toBeCloseTo(42 / (2 * Math.PI * 21), 9)
    expect(rolledTo(-42).turns).toBeCloseTo(-out.turns, 9)
    // A bend leaves the ground and keeps turning about a standing axis.
    expect(soccerPose("bend", 0.5).airborne).toBe(true)
    expect(soccerPose("bend", 0.5).axis.y).toBe(1)
  })
})
