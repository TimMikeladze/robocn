import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  CELL_CAPACITY,
  lanternBehaviorState,
  PowerLantern,
} from "@/components/ui/power-lantern"

const transformOf = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)?.getAttribute("transform") ?? null

/** The vertical component of a part's explode offset, in drawing units. */
const rise = (container: HTMLElement, selector: string) => {
  const transform = transformOf(container, selector)
  if (!transform) return 0
  const match = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(transform)
  return match ? Number(match[2]) : 0
}

describe("the power lantern comes apart", () => {
  it("moves every part off the assembly and puts it back exactly", () => {
    const { container, rerender } = render(
      <PowerLantern exploded={0} behavior="static" ring="none" />,
    )

    // Seated is seated: no part carries an offset at all.
    for (const part of Array.from(container.querySelectorAll("[data-part]"))) {
      expect(part.getAttribute("transform")).toBeNull()
    }

    rerender(<PowerLantern exploded={0.7} behavior="static" ring="none" />)
    expect(transformOf(container, '[data-part="finial"]')).toBeTruthy()
    expect(transformOf(container, '[data-part="collar"]')).toBeTruthy()
    expect(transformOf(container, '[data-rib="0"]')).toBeTruthy()
    // The base is what everything else comes off: it has nowhere to go.
    expect(transformOf(container, '[data-part="base"]')).toBeNull()

    rerender(<PowerLantern exploded={0} behavior="static" ring="none" />)
    for (const part of Array.from(container.querySelectorAll("[data-part]"))) {
      expect(part.getAttribute("transform")).toBeNull()
    }
  })

  it("takes the port off the face and the crown off the top", () => {
    const { container } = render(<PowerLantern exploded={0.6} behavior="static" view="profile" />)
    // The port was fitted to the face, so it leaves along the face's normal —
    // which is a horizontal move in a side elevation, not a vertical one.
    const port = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(
      transformOf(container, '[data-part="bezel"]') ?? "",
    )!
    const crown = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(
      transformOf(container, '[data-part="finial"]') ?? "",
    )!
    expect(Math.abs(Number(port[1]))).toBeGreaterThan(Math.abs(Number(port[2])))
    expect(Math.abs(Number(crown[2]))).toBeGreaterThan(Math.abs(Number(crown[1])))
  })

  it("takes the crown off before the parts under it", () => {
    const { container } = render(<PowerLantern exploded={0.35} behavior="static" />)
    // Screen y grows downward, so a part travelling up has a negative rise.
    const hanger = rise(container, '[data-part="hanger"]')
    const finial = rise(container, '[data-part="finial"]')
    const collar = rise(container, '[data-part="collar"]')
    expect(hanger).toBeLessThan(finial)
    expect(finial).toBeLessThan(collar)
    expect(collar).toBeLessThanOrEqual(0)
  })
})

describe("the power lantern as a battery", () => {
  it("reads the reserve on the gauge and in the label", () => {
    const { container, rerender } = render(
      <PowerLantern charge={0.5} behavior="static" exploded={0} />,
    )
    const half = Array.from(container.querySelectorAll("[data-segment]")).map((segment) =>
      Number(segment.getAttribute("data-fill")),
    )
    expect(half).toHaveLength(8)
    expect(half.reduce((sum, fill) => sum + fill, 0) / 8).toBeCloseTo(0.5, 6)
    expect(container.querySelector("[data-lantern]")?.getAttribute("data-reserve")).toBe("nominal")

    rerender(<PowerLantern charge={0} behavior="static" exploded={0} />)
    expect(container.querySelector("[data-lantern]")?.getAttribute("data-reserve")).toBe("depleted")
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("0 percent reserve")
  })

  it("docks a ring, shows what is in it, and closes the iris without one", () => {
    const { container, rerender } = render(
      <PowerLantern ring="docked" cell={0.5} charge={0.9} behavior="static" exploded={0} />,
    )
    expect(container.querySelector('[data-part="ring"]')?.getAttribute("data-cell")).toBe("0.5")
    expect(container.querySelector("[data-dock]")?.getAttribute("data-dock")).toBe("docked")
    expect(container.querySelector("[data-iris]")).toBeNull()
    expect(container.querySelector('[data-part="iris"]')?.getAttribute("data-open")).toBe("true")

    rerender(<PowerLantern ring="none" charge={0.9} behavior="static" exploded={0} />)
    expect(container.querySelector('[data-part="ring"]')).toBeNull()
    expect(container.querySelector('[data-part="iris"]')?.getAttribute("data-open")).toBe("false")
    expect(container.querySelector("[data-conduit]")).toBeNull()
  })

  it("lights the collar a glyph at a time as the recital runs", () => {
    const { container, rerender } = render(
      <PowerLantern recital={0} behavior="static" exploded={0} />,
    )
    const lit = () => container.querySelectorAll('[data-glyph][data-lit="true"]').length
    const cells = container.querySelectorAll("[data-glyph]").length
    expect(cells).toBeGreaterThan(4)
    expect(lit()).toBe(0)

    rerender(<PowerLantern recital={0.5} behavior="static" exploded={0} />)
    const half = lit()
    expect(half).toBeGreaterThan(0)

    rerender(<PowerLantern recital={1} behavior="static" exploded={0} />)
    expect(lit()).toBe(cells)
    expect(lit()).toBeGreaterThan(half)
  })

  it("runs the conduit only while charge is actually moving", () => {
    const { container, rerender } = render(
      <PowerLantern ring="docked" cell={0.2} charge={0.8} recital={0.4} behavior="static" exploded={0} />,
    )
    const flowing = Number(container.querySelector("[data-conduit]")?.getAttribute("data-flow"))
    expect(flowing).toBeGreaterThan(0)

    // A full ring stops the conduit even with the transfer switched on.
    rerender(
      <PowerLantern ring="docked" cell={1} charge={0.8} recital={0.4} behavior="static" exploded={0} />,
    )
    expect(Number(container.querySelector("[data-conduit]")?.getAttribute("data-flow"))).toBe(0)
  })

  it("emits only what the reserve can pay for, and reaches by the inverse square", () => {
    const { container, rerender } = render(
      <PowerLantern emission={1} charge={1} behavior="static" exploded={0} />,
    )
    const full = Number(container.querySelector("[data-beam]")?.getAttribute("data-reach"))
    expect(full).toBeGreaterThan(0)

    rerender(<PowerLantern emission={0.25} charge={1} behavior="static" exploded={0} />)
    const quarter = Number(container.querySelector("[data-beam]")?.getAttribute("data-reach"))
    expect(quarter / full).toBeCloseTo(0.5, 2)

    rerender(<PowerLantern emission={1} charge={0} behavior="static" exploded={0} />)
    expect(container.querySelector("[data-beam]")).toBeNull()
  })
})

describe("the power lantern's form", () => {
  it("projects one geometry from four cameras and says which it is", () => {
    const { container, rerender } = render(
      <PowerLantern view="front" exploded={0.4} behavior="static" />,
    )
    const front = container.querySelector('[data-part="finial"] path')?.getAttribute("d")
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("front elevation")

    rerender(<PowerLantern view="iso" exploded={0.4} behavior="static" />)
    expect(container.querySelector('[data-part="finial"] path')?.getAttribute("d")).not.toBe(front)
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("isometric view")
    expect(container.querySelector("[data-lantern]")?.getAttribute("data-view")).toBe("iso")
  })

  it("takes a rib count and a colour override", () => {
    const { container } = render(
      <PowerLantern ribs={10} accent="oklch(0.78 0.21 145)" behavior="static" exploded={0} />,
    )
    expect(container.querySelectorAll("[data-rib]")).toHaveLength(10)
    expect(container.innerHTML).toContain("oklch(0.78 0.21 145)")
  })

  it("renders a neutral, complete machine on rubbish input", () => {
    const { container } = render(
      <PowerLantern
        charge={Number.NaN}
        exploded={Number.NaN}
        cell={Number.NaN}
        recital={Number.NaN}
        emission={Number.NaN}
        ribs={Number.NaN}
        // A stale union value from a consumer should degrade, not throw.
        behavior={"whatever" as never}
        view={"nowhere" as never}
      />,
    )
    expect(container.querySelector("[data-lantern]")).not.toBeNull()
    expect(container.querySelector("[data-lantern]")?.getAttribute("data-charge")).toBe("0")
    expect(container.querySelectorAll("[data-rib]")).toHaveLength(8)
    expect(container.innerHTML).not.toContain("NaN")
    for (const part of Array.from(container.querySelectorAll("[data-part]"))) {
      expect(part.getAttribute("transform")).toBeNull()
    }
    // The port is on the face, so its bore is a circle in the drawing rather
      // than an ellipse seen edge-on: the ring reads wherever the camera is.
    expect(container.querySelector('[data-part="bezel"]')).not.toBeNull()
  })

  it("is a slider when it is interactive, and an image when it is not", () => {
    const { container, rerender } = render(<PowerLantern behavior="static" exploded={0.2} />)
    expect(container.querySelector("svg")?.getAttribute("role")).toBe("img")

    rerender(<PowerLantern interactive behavior="static" exploded={0.2} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("role")).toBe("slider")
    expect(svg?.getAttribute("aria-valuenow")).toBe("0.2")
    expect(svg?.getAttribute("aria-valuetext")).toContain("apart")

    rerender(<PowerLantern interactive control="charge" charge={0.4} behavior="static" />)
    expect(container.querySelector("svg")?.getAttribute("aria-valuetext")).toContain("reserve")
  })
})

describe("the lantern's behaviours", () => {
  it("charges the ring out of the reservoir, losing nothing on the way", () => {
    for (const t of [0, 0.2, 0.55, 0.9]) {
      const state = lanternBehaviorState("charge", t)
      expect(state.charge + state.cell * CELL_CAPACITY).toBeCloseTo(1, 9)
    }
    expect(lanternBehaviorState("charge", 0.9).cell).toBeCloseTo(1, 9)
    expect(lanternBehaviorState("charge", 0).cell).toBe(0)
  })

  it("ends the recital and the transfer together", () => {
    const end = lanternBehaviorState("oath", 0.85)
    expect(end.recital).toBeCloseTo(1, 9)
    expect(end.cell).toBeCloseTo(1, 9)
    const middle = lanternBehaviorState("oath", 0.425)
    expect(middle.recital).toBeCloseTo(0.5, 9)
    expect(middle.cell).toBeCloseTo(0.5, 9)
  })

  it("pays for the beam with the reserve, by the area under the gate", () => {
    const before = lanternBehaviorState("emit", 0.1)
    const after = lanternBehaviorState("emit", 0.9)
    expect(before.emission).toBe(0)
    expect(before.charge).toBe(1)
    expect(after.emission).toBe(0)
    expect(after.charge).toBeLessThan(0.6)
    // Peak power costs no more per unit time than the model says it does.
    expect(lanternBehaviorState("emit", 0.5).emission).toBe(1)
    expect(lanternBehaviorState("emit", 0.5).charge).toBeLessThan(1)
  })

  it("services the assembly all the way apart and exactly back", () => {
    expect(lanternBehaviorState("service", 0).exploded).toBe(0)
    expect(lanternBehaviorState("service", 0.5).exploded).toBeCloseTo(1, 9)
    expect(lanternBehaviorState("service", 1).exploded).toBe(0)
    // Whole cycles repeat, in both directions.
    expect(lanternBehaviorState("service", 2.25)).toEqual(lanternBehaviorState("service", -1.75))
  })

  it("parks on rubbish and on static", () => {
    const rest = lanternBehaviorState("static", 0.4)
    expect(lanternBehaviorState("charge", Number.NaN)).toEqual(rest)
    expect(lanternBehaviorState("idle", 0.4)).toEqual(rest)
    expect(rest.exploded).toBe(0)
    expect(rest.emission).toBe(0)
  })
})
