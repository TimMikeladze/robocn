import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AnimatronicRobot, animatronicRobotIntent } from "@/components/ui/animatronic-robot"

afterEach(cleanup)

const d = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

describe("animatronic-robot", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(
      <AnimatronicRobot animate={false} interactive={false} gait="walk" gaitPhase={0} />,
    )
    const planted = d(container, "[data-leg] path")

    rerender(
      <AnimatronicRobot animate={false} interactive={false} gait="walk" gaitPhase={0.5} />,
    )

    expect(d(container, "[data-leg] path")).not.toBe(planted)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <AnimatronicRobot animate={false} gaitPhase={Number.NaN} lean={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<AnimatronicRobot animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Animatronic robot/i)

    rerender(<AnimatronicRobot animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<AnimatronicRobot animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(animatronicRobotIntent("static", 0.4).speech).toBe(0)
    expect(Number.isFinite(animatronicRobotIntent("converse", Number.NaN).lean)).toBe(true)
    // An unknown routine falls back rather than throwing.
    expect(animatronicRobotIntent("nonsense" as never, 1).gait).toBe("stand")
    expect(animatronicRobotIntent("walk", 1).gait).toBe("walk")
  })

  it("draws the whole machine: legs, arms, hands, cage, chest and face", () => {
    const { container } = render(<AnimatronicRobot animate={false} />)
    for (const hook of [
      "[data-leg='left']",
      "[data-leg='right']",
      "[data-foot='left']",
      "[data-arm='left']",
      "[data-hand='right']",
      "[data-digit='right-thumb']",
      "[data-phalanx='right-index-0']",
      "[data-knuckle='right-index']",
      "[data-palm]",
      "[data-sole]",
      "[data-toe]",
      "[data-actuator='left-knee']",
      "[data-pelvis]",
      "[data-vertebra='0']",
      "[data-rib='0']",
      "[data-chest]",
      "[data-core]",
      "[data-neck]",
      "[data-skull]",
      "[data-eye='left']",
      "[data-brow='right']",
      "[data-jaw]",
    ]) {
      expect(container.querySelector(hook), hook).not.toBeNull()
    }
  })

  it("poses every channel from a prop, over whatever the routine wanted", () => {
    const { container, rerender } = render(
      <AnimatronicRobot animate={false} interactive={false} speech={0} />,
    )
    const shut = d(container, "[data-jaw]")
    rerender(<AnimatronicRobot animate={false} interactive={false} speech={1} />)
    expect(d(container, "[data-jaw]")).not.toBe(shut)

    rerender(<AnimatronicRobot animate={false} interactive={false} grip={0} />)
    const open = d(container, "[data-phalanx='right-index-0']")
    rerender(<AnimatronicRobot animate={false} interactive={false} grip={1} grasp="power" />)
    expect(d(container, "[data-phalanx='right-index-0']")).not.toBe(open)
  })

  it("turns the whole chain toward what it is told to look at", () => {
    const { container, rerender } = render(
      <AnimatronicRobot animate={false} interactive={false} attend={null} />,
    )
    const ahead = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(ahead).toMatch(/straight ahead/)

    rerender(<AnimatronicRobot animate={false} interactive={false} attend={{ x: 1, y: 0 }} />)
    const turned = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(turned).toMatch(/degrees to its left/)
    expect(turned).not.toBe(ahead)
  })

  it("shows the balance it measured, and only when asked", () => {
    const { container, rerender } = render(<AnimatronicRobot animate={false} />)
    expect(container.querySelector("[data-balance]")).toBeNull()

    expect(container.querySelector("[data-pad='left-heel']")).toBeNull()

    rerender(<AnimatronicRobot animate={false} showBalance />)
    expect(container.querySelector("[data-support]")).not.toBeNull()
    // The polygon lies on the floor under the feet; the weight reads over them.
    const parts = Array.from(container.querySelectorAll("[data-animatronic] > g"))
    const support = parts.findIndex((g) => g.getAttribute("data-balance") === "support")
    const weight = parts.findIndex((g) => g.getAttribute("data-balance") === "weight")
    const leg = parts.findIndex((g) => g.hasAttribute("data-leg"))
    expect(support).toBeLessThan(leg)
    expect(weight).toBeGreaterThan(leg)
    // The sole's own load pads come with it: same question, same switch.
    expect(container.querySelector("[data-pad='left-heel']")).not.toBeNull()
    expect(container.querySelector("[data-com]")).not.toBeNull()
    expect(container.querySelector("[data-plumb]")).not.toBeNull()
  })

  it("drops the panels for the bare frame without moving a bone", () => {
    const { container, rerender } = render(
      <AnimatronicRobot animate={false} interactive={false} chassis="shell" />,
    )
    const shellPaths = container.querySelectorAll("[data-arm='left'] path").length
    const knee = d(container, "[data-leg='left'] path")

    rerender(<AnimatronicRobot animate={false} interactive={false} chassis="frame" />)
    expect(container.querySelectorAll("[data-arm='left'] path").length).toBeLessThan(shellPaths)
    // The frame is the same frame: the first bone drawn is unmoved.
    expect(d(container, "[data-leg='left'] path")).not.toBe(knee)
  })

  it("keeps the jaw plate a plate at every angle it is turned to", () => {
    // `onFace` clamps a chart point that has run off the ellipsoid onto the
    // equator. Two of those in one outline collapse onto each other and the
    // plate draws as a folded tangle, so the plate is held to distinct corners.
    for (const attend of [null, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }] as const) {
      for (const view of ["front", "profile", "iso"] as const) {
        const { container } = render(
          <AnimatronicRobot animate={false} interactive={false} view={view} attend={attend} speech={1} />,
        )
        const path = d(container, "[data-jaw]")!
        const corners = path.match(/-?[\d.]+ -?[\d.]+/g)!
        expect(new Set(corners).size, `${view} ${JSON.stringify(attend)}`).toBe(corners.length)
        cleanup()
      }
    }
  })

  it("turns the far ear away with the head instead of leaving it on the cheek", () => {
    const { container, rerender } = render(
      <AnimatronicRobot animate={false} interactive={false} attend={null} />,
    )
    const facing = ["left", "right"].map((side) =>
      Number(container.querySelector(`[data-servo='${side}-ear']`)!.getAttribute("opacity")),
    )
    expect(facing[0]).toBeCloseTo(facing[1], 6)
    // Head-on is where a can standing off the skull breaks the silhouette, so
    // both are drawn; fading them out there was the bug, not the fix.
    expect(Math.min(...facing)).toBeGreaterThan(0.5)

    rerender(<AnimatronicRobot animate={false} interactive={false} attend={{ x: 1, y: 0 }} />)
    const turned = ["left", "right"].map((side) =>
      Number(container.querySelector(`[data-servo='${side}-ear']`)!.getAttribute("opacity")),
    )
    expect(Math.min(...turned)).toBeLessThan(0.05)
    expect(Math.max(...turned)).toBeGreaterThan(0.5)
  })

  it("is a slider when interactive and an image when it is not", () => {
    const { container, rerender } = render(<AnimatronicRobot animate={false} interactive={false} />)
    expect(container.querySelector("svg")!.getAttribute("role")).toBe("img")

    rerender(<AnimatronicRobot animate={false} interactive />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuenow")).not.toBeNull()
    expect(svg.getAttribute("class")).toContain("touch-none")
  })
})
