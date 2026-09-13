import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MonolithDroid, monolithDroidPose } from "@/components/ui/monolith-droid"

afterEach(cleanup)

const outer = (container: HTMLElement) =>
  container.querySelector('[data-slab="0"][data-part="slab"]')!.getAttribute("d")

describe("monolith droid", () => {
  it("swings the slabs out of the column as it opens", () => {
    const { container, rerender } = render(<MonolithDroid splay={0} stride={0} animate={false} />)
    const closed = outer(container)
    const closedInner = container.querySelector('[data-slab="1"][data-part="slab"]')!.getAttribute("d")

    rerender(<MonolithDroid splay={1} stride={0} animate={false} />)

    expect(outer(container)).not.toBe(closed)
    // The inner slabs swing less than the outer ones, and the fan is one hinge.
    expect(container.querySelector('[data-slab="1"][data-part="slab"]')!.getAttribute("d")).not.toBe(closedInner)
  })

  it("strides with alternate slabs half a cycle apart", () => {
    const { container, rerender } = render(<MonolithDroid splay={0.6} stride={0} animate={false} />)
    const planted = outer(container)

    rerender(<MonolithDroid splay={0.6} stride={0.25} animate={false} />)
    expect(outer(container)).not.toBe(planted)

    // A whole cycle later the column is back where it started.
    rerender(<MonolithDroid splay={0.6} stride={1} animate={false} />)
    expect(outer(container)).toBe(planted)
  })

  it("counts the slabs and lights the readout", () => {
    const { container, rerender } = render(
      <MonolithDroid splay={0.6} stride={0} animate={false} slabs={4} panel={0} />,
    )
    expect(container.querySelectorAll('[data-part="slab"][data-facet="front"]')).toHaveLength(4)
    expect(container.querySelectorAll("[data-panel] [data-lit]")).toHaveLength(0)

    rerender(<MonolithDroid splay={0.6} stride={0} animate={false} slabs={6} panel={1} />)

    expect(container.querySelectorAll('[data-part="slab"][data-facet="front"]')).toHaveLength(6)
    expect(container.querySelectorAll("[data-panel] [data-lit]").length).toBeGreaterThan(0)
  })

  it("shows only the end caps from straight above, and both faces from iso", () => {
    // Closed and mid-stride: every slab is upright, so nothing but the caps
    // can face a camera looking straight down.
    const { container, rerender } = render(
      <MonolithDroid splay={0} stride={0.25} animate={false} view="plan" />,
    )
    expect(container.querySelectorAll('[data-part="slab"][data-facet="front"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-part="slab"][data-facet="top"]')).toHaveLength(4)

    rerender(<MonolithDroid splay={0} stride={0.25} animate={false} view="iso" />)

    expect(container.querySelectorAll('[data-part="slab"][data-facet="front"]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-part="slab"][data-facet="right"]')).toHaveLength(4)
  })

  it("names its state, opening and view, and reads back as a slider when interactive", () => {
    const { getByRole, rerender } = render(
      <MonolithDroid splay={0.5} animate={false} interactive={false} view="iso" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Monolith droid")
    expect(label).toContain("50 percent open")
    expect(label).toContain("isometric")

    rerender(<MonolithDroid splay={0.25} animate={false} interactive />)

    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
  })

  it("opens from the keyboard and reports every change", () => {
    const onSplayChange = vi.fn()
    const { getByRole } = render(
      <MonolithDroid splay={0.5} animate={false} onSplayChange={onSplayChange} />,
    )
    const slider = getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowUp" })
    expect(onSplayChange).toHaveBeenLastCalledWith(0.6)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onSplayChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onSplayChange).toHaveBeenLastCalledWith(1)
  })

  it("opens to a press and lets go of it on release", () => {
    const onSplayChange = vi.fn()
    const { getByRole, container } = render(
      <MonolithDroid animate={false} behavior="brief" onSplayChange={onSplayChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 232 }) as DOMRect
    const parked = outer(container)

    // The edge of the box is the far end of the range.
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 116, pointerId: 1 })

    expect(onSplayChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
    expect(outer(container)).not.toBe(parked)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    expect(outer(container)).toBe(parked)
  })

  it("takes a colour override onto the slab faces", () => {
    const { container } = render(
      <MonolithDroid splay={0.6} stride={0} animate={false} color="#f97316" />,
    )
    expect(
      container.querySelector('[data-part="slab"][data-facet="front"]')!.getAttribute("fill"),
    ).toBe("#f97316")
  })

  it("renders a neutral machine from invalid input", () => {
    const { container, getByRole } = render(
      <MonolithDroid
        animate={false}
        splay={Number.NaN}
        stride={Number.NaN}
        panel={Number.NaN}
        lean={Number.NaN}
        slabs={Number.NaN}
        speed={Number.NaN}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("slider").getAttribute("aria-label")).toContain("Monolith droid")
    expect(container.querySelectorAll('[data-part="slab"][data-facet="front"]')).toHaveLength(4)
  })

  it("keeps the behaviour sampler inside its own limits", () => {
    for (const behavior of ["walk", "unfold", "brief", "static"] as const) {
      for (let clock = 0; clock < 4; clock += 0.125) {
        const pose = monolithDroidPose(behavior, clock)
        expect(pose.splay).toBeGreaterThanOrEqual(0)
        expect(pose.splay).toBeLessThanOrEqual(1)
        expect(pose.step).toBeGreaterThanOrEqual(0)
        expect(pose.step).toBeLessThan(1)
        expect(pose.panel).toBeGreaterThanOrEqual(0)
        expect(pose.panel).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.lean)).toBeLessThanOrEqual(14)
      }
    }
    // Only `walk` strides, and only `brief` talks.
    expect(monolithDroidPose("walk", 0.25).gait).toBe(1)
    expect(monolithDroidPose("unfold", 0.25).gait).toBe(0)
    expect(monolithDroidPose("brief", 0.25).panel).toBeGreaterThan(0)
    expect(monolithDroidPose("walk", 0.25).panel).toBe(0)
    // The column closes at the top of the unfold cycle.
    expect(monolithDroidPose("unfold", 0).splay).toBeCloseTo(0)
    expect(monolithDroidPose("walk", Number.NaN)).toEqual(monolithDroidPose("walk", 0))
  })
})
