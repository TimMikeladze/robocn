import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RobotGripper } from "@/components/ui/robot-gripper"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"

describe("robot gripper", () => {
  it("moves both jaws symmetrically and reports the clamped opening", () => {
    const { getByRole, container, rerender } = render(<RobotGripper opening={0} />)
    const closed = container.querySelector('[data-jaw="left"]')!.getAttribute("transform")
    rerender(<RobotGripper opening={1} />)
    expect(container.querySelector('[data-jaw="left"]')!.getAttribute("transform")).not.toBe(closed)
    expect(getByRole("img").getAttribute("aria-label")).toContain("100%")
    rerender(<RobotGripper opening={-2} />)
    expect(container.querySelector('[data-jaw="left"]')!.getAttribute("transform")).toBe(closed)
    rerender(<RobotGripper opening={NaN} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("changes finger geometry and allows accessible naming and palette overrides", () => {
    const { container, getByRole, rerender } = render(<RobotGripper fingers="parallel" />)
    const parallel = container.querySelector('[data-jaw="left"] path')!.getAttribute("d")
    rerender(<RobotGripper fingers="angular" color="#aabbcc" aria-label="Fixture clamp" />)
    expect(container.querySelector('[data-jaw="left"] path')!.getAttribute("d")).not.toBe(parallel)
    expect(getByRole("img").getAttribute("aria-label")).toBe("Fixture clamp")
    expect(container.innerHTML).toContain("#aabbcc")
  })
})

describe("conveyor belt", () => {
  it("wraps a controlled belt position in either direction", () => {
    const { container, rerender } = render(<ConveyorBelt position={0.25} />)
    const positions = () => Array.from(container.querySelectorAll('[data-part]')).map(el => el.getAttribute("transform"))
    const first = positions()
    rerender(<ConveyorBelt position={1.25} />)
    expect(positions()).toEqual(first)
    rerender(<ConveyorBelt position={-0.75} />)
    expect(positions()).toEqual(first)
    rerender(<ConveyorBelt position={0.5} />)
    expect(positions()).not.toEqual(first)
  })

  it("supports empty belts and bounds invalid quantities and coordinates", () => {
    const { container, rerender } = render(<ConveyorBelt parts={0} />)
    expect(container.querySelectorAll('[data-part]')).toHaveLength(0)
    rerender(<ConveyorBelt parts={1000000} position={Infinity} />)
    expect(container.querySelectorAll('[data-part]')).toHaveLength(12)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    rerender(<ConveyorBelt parts={NaN} />)
    expect(container.querySelectorAll('[data-part]')).toHaveLength(3)
  })
})
