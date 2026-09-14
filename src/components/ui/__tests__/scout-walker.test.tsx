import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ScoutWalker, scoutBehaviorPose } from "@/components/ui/scout-walker"

afterEach(cleanup)

const cab = (container: HTMLElement) =>
  container.querySelector('[data-cab] [data-part="core"]')!.getAttribute("d")
const leg = (container: HTMLElement, id: number) =>
  container.querySelector(`[data-leg="${id}"] [data-part="tibia"]`)!.getAttribute("d")

describe("scout walker", () => {
  it("walks: the cycle moves the legs and rolls the cab over them", () => {
    const { container, rerender } = render(<ScoutWalker animate={false} gait="walk" stride={0} />)
    const planted = leg(container, 0)
    const level = cab(container)

    // A quarter cycle in it is standing on one foot, which it has to roll onto.
    rerender(<ScoutWalker animate={false} gait="walk" stride={0.25} />)
    expect(leg(container, 0)).not.toBe(planted)
    expect(cab(container)).not.toBe(level)
    expect(container.querySelector("svg")!.getAttribute("aria-valuenow")).not.toBe("0")

    // A whole cycle later it is back where it started.
    rerender(<ScoutWalker animate={false} gait="walk" stride={1} />)
    expect(leg(container, 0)).toBe(planted)
    expect(cab(container)).toBe(level)
  })

  it("reports the balance it is actually holding", () => {
    const { container, rerender } = render(
      <ScoutWalker animate={false} gait="stand" showSupport />,
    )
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(2)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")

    // Pushed to the stop, the mass is past the foot it was standing over.
    rerender(<ScoutWalker animate={false} gait="stand" lean={{ x: 1, y: 0 }} showSupport />)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("false")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/off balance/)

    // A stride leaves the floor, and it says so rather than claiming a margin.
    rerender(<ScoutWalker animate={false} gait="stride" stride={0.47} showSupport />)
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(0)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/airborne/)
  })

  it("yaws the cab where it is told to look", () => {
    const { container, rerender } = render(
      <ScoutWalker animate={false} gait="stand" track={false} look={{ x: -1, y: 0 }} />,
    )
    const away = cab(container)
    expect(container.querySelector("[data-cab]")!.getAttribute("data-yaw")).toBe("-34")

    rerender(<ScoutWalker animate={false} gait="stand" track={false} look={{ x: 1, y: 0 }} />)
    expect(cab(container)).not.toBe(away)
    expect(container.querySelector("[data-cab]")!.getAttribute("data-yaw")).toBe("34")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/^Scout walker/)
  })

  it("renders a neutral stance from invalid input", () => {
    const { container } = render(
      <ScoutWalker
        animate={false}
        gait={"gallop" as never}
        behavior={"skip" as never}
        stride={Number.NaN}
        lean={{ x: Number.NaN, y: Number.POSITIVE_INFINITY }}
        height={Number.NaN}
        look={{ x: Number.NaN, y: Number.NaN }}
        size={Number.NaN}
        showSupport
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(2)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")
  })

  it("takes a colour override without touching the theme", () => {
    const { container } = render(<ScoutWalker animate={false} gait="stand" color="rgb(1, 2, 3)" />)
    expect(container.innerHTML).toContain("rgb(1, 2, 3)")
  })

  it("hands the machine over when it is interactive", () => {
    const { container, rerender } = render(<ScoutWalker animate={false} interactive={false} />)
    expect(container.querySelector("svg")!.getAttribute("role")).toBe("img")

    rerender(<ScoutWalker animate={false} interactive />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuetext")).toMatch(/roll/)
  })
})

describe("scoutBehaviorPose", () => {
  it("names a gait for every behaviour and stands still when told to", () => {
    expect(scoutBehaviorPose("patrol", 0).gait).toBe("walk")
    expect(scoutBehaviorPose("advance", 0).gait).toBe("stride")
    expect(scoutBehaviorPose("watch", 0).rate).toBe(0)
    expect(scoutBehaviorPose("static", 0)).toEqual(scoutBehaviorPose("static", 9.5))
    expect(scoutBehaviorPose("static", Number.NaN).gait).toBe("stand")
  })

  it("never asks for a pose outside its own limits", () => {
    for (const behavior of ["patrol", "advance", "watch", "static"] as const) {
      for (const clock of [0, 0.9, 3.4, 11, 40.25]) {
        const script = scoutBehaviorPose(behavior, clock)
        expect(script.height).toBeGreaterThanOrEqual(0)
        expect(script.height).toBeLessThanOrEqual(1)
        expect(Math.abs(script.gaze.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(script.gaze.y)).toBeLessThanOrEqual(1)
      }
    }
  })
})
