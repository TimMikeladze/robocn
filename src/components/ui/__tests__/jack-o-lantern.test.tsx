import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { JackOLantern, jackOLanternPose } from "@/components/ui/jack-o-lantern"

afterEach(cleanup)

describe("jack-o-lantern", () => {
  it("cuts the face one feature at a time as `carve` runs", () => {
    const { container, rerender } = render(<JackOLantern animate={false} carve={0} />)
    expect(container.querySelectorAll("[data-cut]")).toHaveLength(0)

    rerender(<JackOLantern animate={false} carve={0.3} />)
    // Part way through: a groove is being cut, and nothing is open yet.
    expect(container.querySelectorAll("[data-groove]").length).toBeGreaterThan(0)

    rerender(<JackOLantern animate={false} carve={1} />)
    expect(container.querySelectorAll("[data-cut]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-groove]")).toHaveLength(0)
    // A freed plug drops away once the knife has moved on, so a finished face
    // is holes rather than plugs hanging in front of them.
    expect(container.querySelectorAll("[data-plug]").length).toBeLessThan(2)

    // Taken apart, every plug is a part again and holds station off its hole.
    rerender(<JackOLantern animate={false} carve={1} exploded={1} />)
    expect(container.querySelectorAll("[data-plug]")).toHaveLength(4)
  })

  it("takes the lid and the candle off in the reverse of the order they went on", () => {
    const { container, rerender } = render(
      <JackOLantern animate={false} carve={1} exploded={0} />,
    )
    const seated = container.querySelector("[data-lid] path")!.getAttribute("d")
    const stem = container.querySelector("[data-stem] path")!.getAttribute("d")

    rerender(<JackOLantern animate={false} carve={1} exploded={0.1} />)
    // The stem was fitted last, so it is the first thing to move.
    expect(container.querySelector("[data-stem] path")!.getAttribute("d")).not.toBe(stem)
    expect(container.querySelector("[data-lid] path")!.getAttribute("d")).toBe(seated)

    rerender(<JackOLantern animate={false} carve={1} exploded={1} />)
    expect(container.querySelector("[data-lid] path")!.getAttribute("d")).not.toBe(seated)
    expect(container.querySelector("[data-neck]")).not.toBeNull()
  })

  it("emits nothing through an uncarved shell, or with the candle out", () => {
    const { container, rerender } = render(
      <JackOLantern animate={false} carve={0} exploded={0} />,
    )
    expect(container.querySelectorAll("[data-spill]")).toHaveLength(0)

    rerender(<JackOLantern animate={false} carve={1} flame={1} />)
    expect(container.querySelectorAll("[data-spill]").length).toBeGreaterThan(0)
    expect(container.querySelector("[data-flame]")).not.toBeNull()

    rerender(<JackOLantern animate={false} carve={1} lit={false} />)
    expect(container.querySelectorAll("[data-spill]")).toHaveLength(0)
    expect(container.querySelector("[data-flame]")).toBeNull()
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <JackOLantern animate={false} carve={Number.NaN} exploded={Number.NaN} behavior="nonsense" teeth={Number.NaN} lobes={0} />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<JackOLantern animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(
      /Jack-o'-lantern/i,
    )

    rerender(<JackOLantern animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("hands either channel to a person", () => {
    const { container, rerender } = render(
      <JackOLantern animate={false} carve={0.4} control="carve" interactive />,
    )
    const svg = () => container.querySelector("svg")!
    expect(svg().getAttribute("role")).toBe("slider")
    expect(svg().getAttribute("aria-valuenow")).toBe("40")
    expect(svg().getAttribute("aria-valuetext")).toMatch(/carved/)

    rerender(
      <JackOLantern animate={false} exploded={0.6} control="exploded" interactive />,
    )
    expect(svg().getAttribute("aria-valuenow")).toBe("60")
    expect(svg().getAttribute("aria-valuetext")).toMatch(/apart/)
  })

  it("cuts wherever a stroke was drawn, not only where a face is", () => {
    const { container, rerender } = render(
      <JackOLantern animate={false} face="blank" carve={1} />,
    )
    // A blank gourd: nothing is cut, so nothing is open and nothing gets out.
    expect(container.querySelectorAll("[data-cut]")).toHaveLength(0)
    expect(container.querySelectorAll("[data-spill]")).toHaveLength(0)

    rerender(
      <JackOLantern
        animate={false}
        face="blank"
        strokes={[
          { id: "gash", points: [{ u: -20, v: 0.5 }, { u: 5, v: 0.62 }, { u: 25, v: 0.5 }] },
          { id: "nick", points: [{ u: 0, v: 0.3 }] },
        ]}
      />,
    )
    expect(container.querySelector('[data-cut="gash"]')).not.toBeNull()
    // A single tap is a cut too — the nib leaves a disc.
    expect(container.querySelector('[data-cut="nick"]')).not.toBeNull()
    expect(container.querySelectorAll("[data-spill]").length).toBeGreaterThan(0)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(
      /2 cuts by hand/,
    )
  })

  it("turns to any angle the camera is asked for", () => {
    const { container, rerender } = render(<JackOLantern animate={false} carve={1} />)
    const shell = () => container.querySelector("[data-shell] path")!.getAttribute("d")
    const front = shell()

    rerender(<JackOLantern animate={false} carve={1} azimuth={90} />)
    expect(shell()).not.toBe(front)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(
      /turned 90 degrees/,
    )

    // A whole turn is no turn, and the machine is still named by its view.
    rerender(<JackOLantern animate={false} carve={1} azimuth={360} />)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("front")

    // Overhead and underneath are both reachable, and neither throws.
    rerender(<JackOLantern animate={false} carve={1} elevation={80} />)
    const above = shell()
    rerender(<JackOLantern animate={false} carve={1} elevation={-80} />)
    expect(shell()).not.toBe(above)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("orbits on the arrow keys and clears hand cuts on the keyboard", () => {
    const orbits: { azimuth: number; elevation: number }[] = []
    const strokes: unknown[][] = []
    const { container } = render(
      <JackOLantern
        animate={false}
        carve={1}
        interactive
        onOrbitChange={(orbit) => orbits.push(orbit)}
        onStrokesChange={(next) => strokes.push(next)}
        strokes={[{ id: "a", points: [{ u: 0, v: 0.5 }] }]}
      />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("application")

    fireEvent.keyDown(svg, { key: "ArrowRight" })
    fireEvent.keyDown(svg, { key: "ArrowUp" })
    expect(orbits).toHaveLength(2)
    expect(orbits[0].azimuth).toBeGreaterThan(0)
    expect(orbits[1].elevation).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: "Home" })
    expect(orbits[2]).toEqual({ azimuth: 0, elevation: 0 })

    fireEvent.keyDown(svg, { key: "Backspace" })
    expect(strokes[0]).toEqual([])
  })

  it("cuts where a drag goes, and turns where a drag with the turntable goes", () => {
    // jsdom has no layout, and a drag is nothing without one.
    const box = { left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300, x: 0, y: 0 }
    const rect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ ...box, toJSON: () => box } as DOMRect)

    try {
      const cuts: { id: string }[][] = []
      const { container, rerender } = render(
        <JackOLantern
          animate={false}
          face="blank"
          control="cut"
          interactive
          onStrokesChange={(next) => cuts.push(next)}
        />,
      )
      const svg = container.querySelector("svg")!
      expect(container.querySelectorAll("[data-cut]")).toHaveLength(0)

      // A drag across the middle of the shell cuts a slot along it.
      fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 130, clientY: 150 })
      expect(container.querySelectorAll("[data-cut]")).toHaveLength(1)
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: 150, clientY: 150 })
      fireEvent.pointerMove(svg, { pointerId: 1, clientX: 170, clientY: 158 })
      fireEvent.pointerUp(svg, { pointerId: 1, clientX: 170, clientY: 158 })

      expect(cuts).toHaveLength(1)
      expect(cuts[0]).toHaveLength(1)
      expect(cuts[0][0].id).toMatch(/^hand-/)
      expect(container.querySelector(`[data-cut="${cuts[0][0].id}"]`)).not.toBeNull()
      // The light now has somewhere to go.
      expect(container.querySelectorAll("[data-spill]").length).toBeGreaterThan(0)

      // A second stroke is a second cut, not an extension of the first.
      fireEvent.pointerDown(svg, { pointerId: 2, button: 0, clientX: 120, clientY: 120 })
      fireEvent.pointerUp(svg, { pointerId: 2, clientX: 120, clientY: 120 })
      expect(cuts[cuts.length - 1]).toHaveLength(2)

      // The same gesture on the turntable turns the machine instead.
      const orbits: { azimuth: number; elevation: number }[] = []
      rerender(
        <JackOLantern
          animate={false}
          face="blank"
          control="orbit"
          interactive
          onOrbitChange={(next) => orbits.push(next)}
        />,
      )
      fireEvent.pointerDown(svg, { pointerId: 3, button: 0, clientX: 150, clientY: 150 })
      fireEvent.pointerMove(svg, { pointerId: 3, clientX: 210, clientY: 120 })
      fireEvent.pointerUp(svg, { pointerId: 3, clientX: 210, clientY: 120 })
      expect(orbits.length).toBeGreaterThan(0)
      const turn = orbits[orbits.length - 1]
      expect(turn.azimuth).not.toBe(0)
      expect(turn.elevation).toBeGreaterThan(0)
      // Turning is not carving.
      expect(cuts[cuts.length - 1]).toHaveLength(2)

      // Shift swaps the knife for the turntable without changing the tool.
      const swapped: { azimuth: number; elevation: number }[] = []
      rerender(
        <JackOLantern
          animate={false}
          face="blank"
          control="cut"
          interactive
          onStrokesChange={(next) => cuts.push(next)}
          onOrbitChange={(next) => swapped.push(next)}
        />,
      )
      const before = cuts.length
      fireEvent.pointerDown(svg, { pointerId: 4, button: 0, clientX: 150, clientY: 150, shiftKey: true })
      fireEvent.pointerMove(svg, { pointerId: 4, clientX: 90, clientY: 150, shiftKey: true })
      fireEvent.pointerUp(svg, { pointerId: 4, clientX: 90, clientY: 150 })
      expect(swapped.length).toBeGreaterThan(0)
      expect(cuts).toHaveLength(before)
    } finally {
      rect.mockRestore()
    }
  })

  it("takes a colour override", () => {
    const { container } = render(<JackOLantern animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(jackOLanternPose("static", 0.4)).toEqual({ carve: 1, exploded: 0 })
    expect(jackOLanternPose("flicker", 0.7).carve).toBe(1)
    expect(jackOLanternPose("carve", Number.NaN)).toEqual({ carve: 1, exploded: 0 })
    // A whole cycle comes back to where it started, in both directions.
    expect(jackOLanternPose("carve", 1).carve).toBeCloseTo(jackOLanternPose("carve", 2).carve, 6)
    expect(jackOLanternPose("teardown", -0.75).exploded).toBeCloseTo(
      jackOLanternPose("teardown", 0.25).exploded,
      6,
    )
    // The teardown goes out and comes back rather than jumping home.
    expect(jackOLanternPose("teardown", 0.45).exploded).toBe(1)
    expect(jackOLanternPose("teardown", 0.99).exploded).toBe(0)
  })
})
