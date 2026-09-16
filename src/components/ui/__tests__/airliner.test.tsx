import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Airliner, airlinerPose } from "@/components/ui/airliner"

afterEach(cleanup)

const d = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

describe("airliner", () => {
  it("moves every part when the teardown changes", () => {
    const { container, rerender } = render(<Airliner animate={false} explode={0} />)
    const seated = {
      radome: d(container, '[data-fuselage="radome"] path'),
      wing: d(container, '[data-wing="starboard"]'),
      fin: d(container, "[data-fin]"),
    }

    rerender(<Airliner animate={false} explode={1} />)

    expect(d(container, '[data-fuselage="radome"] path')).not.toBe(seated.radome)
    expect(d(container, '[data-wing="starboard"]')).not.toBe(seated.wing)
    expect(d(container, "[data-fin]")).not.toBe(seated.fin)
    // Apart, every part draws a leader back to where it sits.
    expect(container.querySelectorAll("[data-leader]").length).toBeGreaterThan(8)
  })

  it("puts the gear down and the flaps out as the configuration comes in", () => {
    const { container, rerender } = render(<Airliner animate={false} configuration={0} />)
    const clean = {
      gear: d(container, '[data-gear="nose"] [data-leg]'),
      flap: d(container, '[data-flap="starboard"]'),
      slat: d(container, '[data-slat="starboard"]'),
    }

    rerender(<Airliner animate={false} configuration={1} />)

    expect(d(container, '[data-gear="nose"] [data-leg]')).not.toBe(clean.gear)
    expect(d(container, '[data-flap="starboard"]')).not.toBe(clean.flap)
    expect(d(container, '[data-slat="starboard"]')).not.toBe(clean.slat)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/gear down/)
  })

  it("turns to any angle at all, not only the four named views", () => {
    const { container, rerender } = render(<Airliner animate={false} />)
    const straight = d(container, '[data-wing="starboard"]')

    rerender(<Airliner animate={false} azimuth={37} elevation={-12} />)

    expect(d(container, '[data-wing="starboard"]')).not.toBe(straight)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/turned 37/)
  })

  it("opens the reader's side of the skin and shows what is behind it", () => {
    const { container, rerender } = render(<Airliner animate={false} cutaway={0} />)
    const closed = container.querySelectorAll("[data-fuselage]").length
    expect(container.querySelectorAll("[data-cabin]")).toHaveLength(0)

    rerender(<Airliner animate={false} cutaway={1} />)

    expect(container.querySelectorAll("[data-fuselage]").length).toBeLessThan(closed)
    expect(container.querySelectorAll("[data-cabin]").length).toBeGreaterThan(10)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      <Airliner
        animate={false}
        explode={Number.NaN}
        azimuth={Number.POSITIVE_INFINITY}
        // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
        behavior="nonsense"
        roll={Number.NaN}
      />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<Airliner animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/Airliner/i)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)

    rerender(<Airliner animate={false} view="profile" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/side elevation/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("profile")
  })

  it("takes a colour override", () => {
    const { container } = render(<Airliner animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(airlinerPose("static", 0.4)).toEqual(airlinerPose("static", 0.9))
    expect(airlinerPose("cruise", Number.NaN).roll).toBe(0)
    // A whole cycle comes back to where it started, forwards and backwards.
    expect(airlinerPose("cruise", 1).roll).toBeCloseTo(airlinerPose("cruise", 2).roll, 6)
    expect(airlinerPose("service", -0.25).explode).toBeCloseTo(
      airlinerPose("service", 0.75).explode,
      6,
    )
    // Service goes out and comes back; the turntable only ever goes round.
    expect(airlinerPose("service", 0.5).explode).toBeCloseTo(1, 6)
    expect(airlinerPose("service", 0).explode).toBe(0)
    expect(airlinerPose("turntable", 0.5).spin).toBeCloseTo(180, 6)
    expect(airlinerPose("approach", 0.3).configuration).toBe(1)
  })
})
