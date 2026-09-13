import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RobotHound, robotHoundPose } from "@/components/ui/robot-hound"

afterEach(cleanup)

const path = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

describe("robot hound", () => {
  it("runs the neck out, lifts the head, pricks the ears and raises the probe on one number", () => {
    const { container, rerender } = render(
      <RobotHound attention={0} animate={false} track={false} />,
    )
    const neck = path(container, "[data-neck] [data-rib='0']")
    const head = path(container, "[data-head] path")
    const ear = path(container, '[data-ear="left"] path')
    const probe = path(container, "[data-probe] path")
    // Stowed, the visor is dark.
    expect(container.querySelector("[data-visor] [data-lit]")).toBeNull()

    rerender(<RobotHound attention={1} animate={false} track={false} />)

    expect(path(container, "[data-neck] [data-rib='0']")).not.toBe(neck)
    expect(path(container, "[data-head] path")).not.toBe(head)
    expect(path(container, '[data-ear="left"] path')).not.toBe(ear)
    expect(path(container, "[data-probe] path")).not.toBe(probe)
    expect(container.querySelector("[data-visor] [data-lit]")).not.toBeNull()
  })

  it("turns the head to a look without changing its posture", () => {
    const { container, rerender } = render(
      <RobotHound attention={0.5} animate={false} track={false} look={{ x: -1, y: 0 }} />,
    )
    const head = path(container, "[data-head] path")
    const neck = path(container, "[data-neck] [data-rib='0']")

    rerender(<RobotHound attention={0.5} animate={false} track={false} look={{ x: 1, y: 0 }} />)

    expect(path(container, "[data-head] path")).not.toBe(head)
    // The collar is a linear extension: yaw happens at the head, not in it.
    expect(path(container, "[data-neck] [data-rib='0']")).toBe(neck)
  })

  it("counts the keypad, swaps the pods and the boom, and squares off the skirt", () => {
    const { container, rerender } = render(
      <RobotHound attention={0.5} animate={false} track={false} keys={4} ears="dish" probe="whip" />,
    )
    expect(container.querySelectorAll("[data-keypad] [data-key]")).toHaveLength(12)
    expect(container.querySelector("[data-probe]")!.getAttribute("data-kind")).toBe("whip")
    const chassis = path(container, "[data-chassis] path:nth-of-type(2)")

    rerender(
      <RobotHound
        attention={0.5}
        animate={false}
        track={false}
        keys={6}
        ears="none"
        probe="none"
        skirt="straight"
      />,
    )

    expect(container.querySelectorAll("[data-keypad] [data-key]")).toHaveLength(18)
    expect(container.querySelector('[data-ear="left"]')).toBeNull()
    expect(container.querySelector("[data-probe]")).toBeNull()
    expect(path(container, "[data-chassis] path:nth-of-type(2)")).not.toBe(chassis)
  })

  it("names its state, attention and view, and reads back as a slider when interactive", () => {
    const { getByRole, rerender } = render(
      <RobotHound attention={0.5} animate={false} interactive={false} view="iso" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Robot hound")
    expect(label).toContain("50 percent")
    expect(label).toContain("isometric")

    rerender(<RobotHound attention={0.25} animate={false} interactive />)

    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
  })

  it("works from the keyboard and reports every change", () => {
    const onAttentionChange = vi.fn()
    const { getByRole } = render(
      <RobotHound attention={0.5} animate={false} onAttentionChange={onAttentionChange} />,
    )
    const slider = getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowUp" })
    expect(onAttentionChange).toHaveBeenLastCalledWith(0.6)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onAttentionChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onAttentionChange).toHaveBeenLastCalledWith(1)
  })

  it("comes up to a press and settles back on release", () => {
    const onAttentionChange = vi.fn()
    const { getByRole, container } = render(
      <RobotHound animate={false} behavior="idle" track={false} onAttentionChange={onAttentionChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 210, height: 150 }) as DOMRect
    const settled = path(container, "[data-head] path")

    // A quarter of the way down the box is the top of the range.
    fireEvent.pointerDown(svg, { clientX: 105, clientY: 37.5, pointerId: 1 })

    expect(onAttentionChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
    expect(path(container, "[data-head] path")).not.toBe(settled)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    expect(path(container, "[data-head] path")).toBe(settled)
  })

  it("renders a neutral machine from invalid input", () => {
    const { container, getByRole } = render(
      <RobotHound
        animate={false}
        attention={Number.NaN}
        keys={Number.NaN}
        speed={Number.NaN}
        look={{ x: Number.NaN, y: Number.POSITIVE_INFINITY }}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("slider").getAttribute("aria-label")).toContain("Robot hound")
  })

  it("keeps the behaviour sampler inside its own limits", () => {
    for (const behavior of ["seek", "alert", "idle", "static"] as const) {
      for (let clock = 0; clock < 4; clock += 0.125) {
        const pose = robotHoundPose(behavior, clock)
        expect(pose.attention).toBeGreaterThanOrEqual(0)
        expect(pose.attention).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.sweep)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.wag)).toBeLessThanOrEqual(1)
      }
    }
    // Alert holds its head up; idle has it down; only seek casts the full width.
    expect(robotHoundPose("alert", 0.5).attention).toBeGreaterThan(0.8)
    expect(robotHoundPose("idle", 0.5).attention).toBeLessThan(0.2)
    expect(Math.abs(robotHoundPose("seek", 1 / 3).sweep)).toBeGreaterThan(0.5)
    expect(robotHoundPose("static", 2)).toEqual({ attention: 0.5, sweep: 0, wag: 0 })
    expect(robotHoundPose("seek", Number.NaN)).toEqual(robotHoundPose("seek", 0))
  })
})
