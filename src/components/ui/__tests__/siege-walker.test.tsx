import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SiegeWalker, siegeBehaviorPose } from "@/components/ui/siege-walker"

afterEach(cleanup)

const hull = (container: HTMLElement) =>
  container.querySelector('[data-hull] [data-part="body"]')!.getAttribute("d")
const leg = (container: HTMLElement, id: number) =>
  container.querySelector(`[data-leg="${id}"] [data-part="tibia"]`)!.getAttribute("d")

describe("siege walker", () => {
  it("walks all four legs through a cycle that repeats", () => {
    const { container, rerender } = render(<SiegeWalker animate={false} gait="walk" stride={0} />)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    const planted = leg(container, 0)

    rerender(<SiegeWalker animate={false} gait="walk" stride={0.35} />)
    expect(leg(container, 0)).not.toBe(planted)

    rerender(<SiegeWalker animate={false} gait="walk" stride={1} />)
    expect(leg(container, 0)).toBe(planted)
  })

  it("walks nearly level, and cannot pace at all", () => {
    const { container, rerender } = render(
      <SiegeWalker animate={false} gait="walk" stride={0.1} showSupport />,
    )
    const walking = container.querySelector("svg")!
    // Three or four feet down still contain the mass, so it barely rolls.
    expect(container.querySelectorAll("[data-contact]").length).toBeGreaterThanOrEqual(3)
    expect(Math.abs(Number(walking.getAttribute("aria-valuenow")))).toBeLessThan(40)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")

    // Pace swings both legs of a side: the support is a line it cannot reach.
    rerender(<SiegeWalker animate={false} gait="pace" stride={0.25} showSupport />)
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(2)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("false")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/off balance/)
  })

  it("leans where it is pushed, and the hull goes with it", () => {
    const { container, rerender } = render(
      <SiegeWalker animate={false} gait="stand" lean={{ x: 0, y: 0 }} />,
    )
    const level = hull(container)

    rerender(<SiegeWalker animate={false} gait="stand" lean={{ x: 1, y: 0 }} />)
    expect(hull(container)).not.toBe(level)
    expect(Number(container.querySelector("svg")!.getAttribute("aria-valuenow"))).toBe(100)
  })

  it("swings the head where it is told to look", () => {
    const { container, rerender } = render(
      <SiegeWalker animate={false} gait="stand" track={false} look={{ x: -1, y: 0 }} />,
    )
    const away = container.querySelector('[data-head] [data-part="skull"]')!.getAttribute("d")
    expect(container.querySelector("[data-head]")!.getAttribute("data-yaw")).toBe("-30")

    rerender(<SiegeWalker animate={false} gait="stand" track={false} look={{ x: 1, y: 0 }} />)
    expect(container.querySelector('[data-head] [data-part="skull"]')!.getAttribute("d")).not.toBe(away)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/^Siege walker/)
  })

  it("renders a neutral stance from invalid input", () => {
    const { container } = render(
      <SiegeWalker
        animate={false}
        gait={"bound" as never}
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
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(4)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")
  })

  it("takes a colour override without touching the theme", () => {
    const { container } = render(<SiegeWalker animate={false} gait="stand" color="rgb(1, 2, 3)" />)
    expect(container.innerHTML).toContain("rgb(1, 2, 3)")
  })

  it("hands the machine over when it is interactive", () => {
    const { container, rerender } = render(<SiegeWalker animate={false} interactive={false} />)
    expect(container.querySelector("svg")!.getAttribute("role")).toBe("img")

    rerender(<SiegeWalker animate={false} interactive />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuetext")).toMatch(/roll/)
  })
})

describe("siegeBehaviorPose", () => {
  it("names a gait for every behaviour and stands still when told to", () => {
    expect(siegeBehaviorPose("march", 0).gait).toBe("walk")
    expect(siegeBehaviorPose("haul", 0).gait).toBe("creep")
    expect(siegeBehaviorPose("pace", 0).gait).toBe("pace")
    expect(siegeBehaviorPose("halt", 0).rate).toBe(0)
    expect(siegeBehaviorPose("static", 0)).toEqual(siegeBehaviorPose("static", 6.25))
    expect(siegeBehaviorPose("static", Number.NaN).gait).toBe("stand")
  })

  it("never asks for a pose outside its own limits", () => {
    for (const behavior of ["march", "haul", "pace", "halt", "static"] as const) {
      for (const clock of [0, 1.3, 5.5, 17, 33.75]) {
        const script = siegeBehaviorPose(behavior, clock)
        expect(script.height).toBeGreaterThanOrEqual(0)
        expect(script.height).toBeLessThanOrEqual(1)
        expect(Math.abs(script.gaze.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(script.gaze.y)).toBeLessThanOrEqual(1)
      }
    }
  })
})
