import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ConstructRing,
  conjuredFrame,
  normalizeOrbit,
  constructRingConjuring,
  constructRingReserve,
} from "@/components/ui/construct-ring"

afterEach(cleanup)

/** A pointer path across the field, in viewBox units mapped onto a 260px box. */
const stroke = (svg: SVGSVGElement, points: [number, number][]) => {
  svg.setPointerCapture = vi.fn()
  svg.releasePointerCapture = vi.fn()
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 260, height: 260, right: 260, bottom: 260, x: 0, y: 0 }) as DOMRect
  fireEvent.pointerDown(svg, { clientX: points[0][0], clientY: points[0][1], pointerId: 1 })
  for (const [x, y] of points.slice(1)) {
    fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1 })
  }
  fireEvent.pointerUp(svg, {
    clientX: points.at(-1)![0],
    clientY: points.at(-1)![1],
    pointerId: 1,
  })
}

describe("construct-ring", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<ConstructRing animate={false} exploded={0} />)
    const seated = container.querySelector("[data-lens] path")!.getAttribute("d")

    rerender(<ConstructRing animate={false} exploded={1} />)

    expect(container.querySelector("[data-lens] path")!.getAttribute("d")).not.toBe(seated)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <ConstructRing animate={false} reserve={Number.NaN} exploded={Number.NaN} behavior="nonsense" construct="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself, what it is holding, and the camera it is drawn from", () => {
    const { container, rerender } = render(<ConstructRing animate={false} construct="glove" />)
    const label = () => container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label()).toMatch(/Construct ring/i)
    expect(label()).toMatch(/glove/)

    rerender(<ConstructRing animate={false} view="plan" construct={null} />)
    expect(label()).toMatch(/plan view/)
    expect(label()).toMatch(/no construct/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("plan")
  })

  it("takes a colour override", () => {
    const { container } = render(<ConstructRing animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("forges a drawn stroke into the construct the stroke asks for", () => {
    const onConstructChange = vi.fn()
    const { container } = render(
      <ConstructRing animate={false} drawable onConstructChange={onConstructChange} />,
    )
    const svg = container.querySelector("svg")!

    // A closed round loop in the field: a bubble.
    const circle: [number, number][] = Array.from({ length: 24 }, (_, index) => {
      const t = (index / 24) * Math.PI * 2
      return [130 + Math.cos(t) * 46, 88 + Math.sin(t) * 46]
    })
    stroke(svg, [...circle, circle[0]])

    expect(onConstructChange).toHaveBeenCalledTimes(1)
    expect(onConstructChange.mock.calls[0][0].archetype).toBe("bubble")
    expect(onConstructChange.mock.calls[0][0].cost).toBeGreaterThan(0)
    const held = container.querySelector("[data-construct]")!
    expect(held.getAttribute("data-archetype")).toBe("bubble")
    expect(held.querySelectorAll("[data-lattice] path").length).toBeGreaterThan(1)
  })

  it("reads a long straight stroke as a different construct entirely", () => {
    const onConstructChange = vi.fn()
    const { container } = render(
      <ConstructRing animate={false} drawable onConstructChange={onConstructChange} />,
    )
    stroke(container.querySelector("svg")!, [
      [24, 86],
      [80, 78],
      [150, 66],
      [236, 56],
    ])

    expect(onConstructChange.mock.calls[0][0].archetype).toBe("hammer")
  })

  it("forges from the keyboard, and clears on Escape", () => {
    const { container } = render(<ConstructRing animate={false} drawable behavior="idle" />)
    const svg = container.querySelector("svg")!
    expect(container.querySelector("[data-construct]")).toBeNull()

    fireEvent.keyDown(svg, { key: "Enter" })
    expect(container.querySelector("[data-construct]")).not.toBeNull()

    fireEvent.keyDown(svg, { key: "Escape" })
    expect(container.querySelector("[data-construct]")).toBeNull()
  })

  it("is a slider over its own reserve when interactive and not rotatable", () => {
    const onReserveChange = vi.fn()
    const { container } = render(
      <ConstructRing animate={false} interactive rotatable={false} onReserveChange={onReserveChange} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")

    fireEvent.keyDown(svg, { key: "ArrowUp" })
    expect(onReserveChange).toHaveBeenCalled()
    expect(onReserveChange.mock.calls[0][0]).toBeGreaterThan(0)
  })

  it("turns to any angle on the sphere, by drag and by key", () => {
    const onOrbitChange = vi.fn()
    const { container } = render(
      <ConstructRing animate={false} drawable={false} onOrbitChange={onOrbitChange} />,
    )
    const svg = container.querySelector("svg")!
    const group = () => container.querySelector("[data-view]")!
    const seated = group().getAttribute("data-azimuth")
    const band = () => container.querySelector("[data-band] path")!.getAttribute("d")
    const before = band()

    // A drag across it turns it round; a drag up tips it over.
    stroke(svg, [
      [120, 200],
      [170, 190],
      [220, 150],
    ])
    expect(onOrbitChange).toHaveBeenCalled()
    expect(group().getAttribute("data-azimuth")).not.toBe(seated)
    expect(band()).not.toBe(before)

    // Arrow keys do the same, and Home puts the named view back.
    const turned = group().getAttribute("data-azimuth")
    fireEvent.keyDown(svg, { key: "ArrowRight" })
    expect(group().getAttribute("data-azimuth")).not.toBe(turned)
    fireEvent.keyDown(svg, { key: "Home" })
    expect(group().getAttribute("data-azimuth")).toBe(seated)
    expect(band()).toBe(before)
  })

  it("takes a controlled camera, and names the angle it is turned to", () => {
    const { container, rerender } = render(
      <ConstructRing animate={false} azimuth={40} elevation={20} />,
    )
    const label = () => container.querySelector("svg")!.getAttribute("aria-label")!
    expect(container.querySelector("[data-view]")!.getAttribute("data-azimuth")).toBe("40")
    expect(label()).toMatch(/turned to 40 degrees round and 20 degrees up/)

    // Past the pole it carries over the top rather than stopping at it.
    rerender(<ConstructRing animate={false} azimuth={0} elevation={120} />)
    expect(container.querySelector("[data-view]")!.getAttribute("data-elevation")).toBe("60")
    expect(container.querySelector("[data-view]")!.getAttribute("data-azimuth")).toBe("180")
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("wraps any pair of angles back onto the sphere", () => {
    expect(normalizeOrbit(0, 0)).toEqual({ azimuth: 0, elevation: 0 })
    expect(normalizeOrbit(540, 30)).toEqual({ azimuth: 180, elevation: 30 })
    expect(normalizeOrbit(-900, -10)).toEqual({ azimuth: 180, elevation: -10 })
    // Over the top: down the far side, not stuck at the pole.
    expect(normalizeOrbit(30, 100)).toEqual({ azimuth: -150, elevation: 80 })
    expect(normalizeOrbit(30, -100)).toEqual({ azimuth: -150, elevation: -80 })
    expect(normalizeOrbit(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      azimuth: 0,
      elevation: 0,
    })
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(constructRingReserve("static", 0.4)).toBe(0.7)
    expect(constructRingReserve("conjure", Number.NaN)).toBe(0.7)
    // A whole cycle comes back to where it started.
    expect(constructRingReserve("idle", 1)).toBeCloseTo(constructRingReserve("idle", 2), 6)
    expect(constructRingReserve("charge", 0.5)).toBeGreaterThan(constructRingReserve("charge", 0.1))

    expect(constructRingConjuring("charge", 3).archetype).toBeNull()
    expect(constructRingConjuring("idle", 3).archetype).toBeNull()
    expect(constructRingConjuring("static", 3).settle).toBe(1)
    // The cycle walks the archetype list and comes back round.
    const first = constructRingConjuring("conjure", 0.1)
    const second = constructRingConjuring("conjure", 2)
    expect(first.archetype).not.toBe(second.archetype)
    expect(constructRingConjuring("conjure", Number.NaN).archetype).toBe(first.archetype)

    const frame = conjuredFrame(3)
    expect(Number.isFinite(frame.center.x) && Number.isFinite(frame.along)).toBe(true)
  })
})
