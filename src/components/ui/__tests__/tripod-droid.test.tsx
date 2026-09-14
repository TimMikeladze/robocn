import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { TripodDroid, tripodBehaviorPose } from "@/components/ui/tripod-droid"

afterEach(cleanup)

const leg = (container: HTMLElement, id: number) =>
  container.querySelector(`[data-leg="${id}"] [data-part="tibia"]`)!.getAttribute("d")
const body = (container: HTMLElement) =>
  container.querySelector('[data-body] [data-part="core"]')!.getAttribute("d")

describe("tripod droid", () => {
  it("walks: the cycle moves the legs and the body over its feet", () => {
    const { container, rerender } = render(
      <TripodDroid animate={false} gait="creep" stride={0} />,
    )
    const planted = leg(container, 0)
    const stood = body(container)

    rerender(<TripodDroid animate={false} gait="creep" stride={0.35} />)
    expect(leg(container, 0)).not.toBe(planted)
    // The body slides over its feet — that is the whole mechanism.
    expect(body(container)).not.toBe(stood)

    // A whole cycle later it is back where it started.
    rerender(<TripodDroid animate={false} gait="creep" stride={1} />)
    expect(leg(container, 0)).toBe(planted)
    expect(body(container)).toBe(stood)
  })

  it("reports the balance it is actually holding", () => {
    const { container, rerender } = render(
      <TripodDroid animate={false} gait="stand" showSupport />,
    )
    expect(container.querySelector("[data-support]")).not.toBeNull()
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(3)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")

    // Amble takes two feet off at once, which is further than a stubby machine
    // can move its body: the centre of mass leaves the support.
    rerender(<TripodDroid animate={false} gait="amble" stride={0.25} showSupport />)
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(1)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("false")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/off balance/)
  })

  it("leans where it is pushed, and the stubs answer", () => {
    const { container, rerender } = render(
      <TripodDroid animate={false} gait="stand" lean={{ x: 0, y: 0 }} />,
    )
    const upright = body(container)
    const stub = container.querySelector('[data-stub="right"]')!.getAttribute("d")

    rerender(<TripodDroid animate={false} gait="stand" lean={{ x: 1, y: 0 }} />)
    expect(body(container)).not.toBe(upright)
    expect(container.querySelector('[data-stub="right"]')!.getAttribute("d")).not.toBe(stub)
  })

  it("aims the optics and names itself", () => {
    const { container, rerender } = render(
      <TripodDroid animate={false} gait="stand" look={{ x: -1, y: 0 }} />,
    )
    const pupil = container.querySelector('[data-optic="left"] [data-part="pupil"]')!.getAttribute("d")

    rerender(<TripodDroid animate={false} gait="stand" look={{ x: 1, y: 0 }} />)
    expect(container.querySelector('[data-optic="left"] [data-part="pupil"]')!.getAttribute("d")).not.toBe(pupil)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/^Tripod droid/)
  })

  it("renders a neutral stance from invalid input", () => {
    const { container } = render(
      <TripodDroid
        animate={false}
        gait={"sideways" as never}
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
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(3)
    expect(container.querySelector("[data-centre]")!.getAttribute("data-stable")).toBe("true")
  })

  it("takes a colour override without touching the theme", () => {
    const { container } = render(
      <TripodDroid animate={false} gait="stand" color="rgb(1, 2, 3)" />,
    )
    expect(container.innerHTML).toContain("rgb(1, 2, 3)")
  })

  it("hands the machine over when it is interactive", () => {
    const { container, rerender } = render(<TripodDroid animate={false} interactive={false} />)
    expect(container.querySelector("svg")!.getAttribute("role")).toBe("img")

    rerender(<TripodDroid animate={false} interactive />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuetext")).toMatch(/lean/)
  })
})

describe("tripodBehaviorPose", () => {
  it("names a gait for every behaviour and stands still when told to", () => {
    expect(tripodBehaviorPose("trundle", 0).gait).toBe("creep")
    expect(tripodBehaviorPose("scurry", 0).gait).toBe("amble")
    expect(tripodBehaviorPose("survey", 0).gait).toBe("pivot")
    expect(tripodBehaviorPose("settle", 0).rate).toBe(0)
    expect(tripodBehaviorPose("static", 0)).toEqual(tripodBehaviorPose("static", 7.3))
    expect(tripodBehaviorPose("static", Number.NaN).gait).toBe("stand")
  })

  it("wanders without ever leaving its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 5, 12.25]) {
      const script = tripodBehaviorPose("trundle", clock)
      expect(Math.abs(script.heading)).toBeLessThanOrEqual(40)
      expect(script.height).toBeGreaterThanOrEqual(0)
      expect(script.height).toBeLessThanOrEqual(1)
      expect(Math.abs(script.gaze.x)).toBeLessThanOrEqual(1)
    }
  })
})
