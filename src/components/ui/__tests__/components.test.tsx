import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotFace } from "@/components/ui/robot-face"
import { RobotLoader } from "@/components/ui/robot-loader"
import { ScaraArm } from "@/components/ui/scara-arm"

describe("robot-arm", () => {
  it("renders an accessible drawing that names its end effector", () => {
    render(<RobotArm tool="welder" behavior="static" />)
    const svg = screen.getByRole("img")
    expect(svg.getAttribute("aria-label")).toContain("welder")
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(3)
  })

  it("draws one limb per link", () => {
    const { container, rerender } = render(
      <RobotArm links={[1, 1]} behavior="static" showBase={false} showCable={false} />,
    )
    const count = (root: HTMLElement) =>
      root.querySelectorAll("path[d^='M']").length
    const two = count(container)
    rerender(
      <RobotArm
        links={[1, 1, 1, 1]}
        behavior="static"
        showBase={false}
        showCable={false}
      />,
    )
    expect(count(container)).toBeGreaterThan(two)
  })

  it("poses from angles when driven forward", () => {
    const { container } = render(<RobotArm angles={[90, 0, 0]} showAngles />)
    expect(container.textContent).toContain("J1 90°")
  })

  it("takes a colour override without touching the theme", () => {
    const { container } = render(
      <RobotArm color="#ff0000" behavior="static" variant="solid" />,
    )
    expect(container.innerHTML).toContain("#ff0000")
  })
})

describe("the rest of the set", () => {
  it("each machine renders a labelled drawing", () => {
    for (const machine of [
      <ScaraArm key="scara" behavior="static" />,
      <DeltaArm key="delta" behavior="static" />,
      <GantryArm key="gantry" behavior="static" />,
      <RobotFace key="face" mood="happy" />,
    ]) {
      const { getByRole, unmount } = render(machine)
      expect(getByRole("img").getAttribute("aria-label")).toBeTruthy()
      unmount()
    }
  })

  it("the loader announces progress", () => {
    const { getByRole, unmount } = render(<RobotLoader value={62} />)
    const svg = getByRole("img")
    expect(svg.getAttribute("aria-busy")).toBe("true")
    expect(svg.getAttribute("aria-label")).toContain("62 percent")
    unmount()

    render(<RobotLoader />)
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("working")
  })
})
