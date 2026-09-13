import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RobotAvocado, avocadoBearing, avocadoGoal } from "@/components/ui/robot-avocado"
import { RobotStrawberry, strawberryGoal } from "@/components/ui/robot-strawberry"
import { RobotTomato, tomatoGoal } from "@/components/ui/robot-tomato"

afterEach(cleanup)

/** The accessible label of the machine rendered into `container`. */
const label = (container: HTMLElement) =>
  container.querySelector("svg")!.getAttribute("aria-label") ?? ""

describe("robot avocado", () => {
  it("swings both halves, raises the stone and parts the latch from one number", () => {
    const { container, rerender } = render(<RobotAvocado open={0} />)
    const right = container.querySelector('[data-half="right"]')!.getAttribute("d")
    const left = container.querySelector('[data-half="left"]')!.getAttribute("d")
    const stone = container.querySelector("[data-stone]")!.getAttribute("cy")
    const latch = container.querySelector('[data-latch="right"]')!.getAttribute("d")
    // Shut, there is no cut face to see.
    expect(container.querySelectorAll("[data-cut]")).toHaveLength(0)

    rerender(<RobotAvocado open={0.9} />)

    expect(container.querySelector('[data-half="right"]')!.getAttribute("d")).not.toBe(right)
    expect(container.querySelector('[data-half="left"]')!.getAttribute("d")).not.toBe(left)
    expect(
      Number(container.querySelector("[data-stone]")!.getAttribute("cy")),
    ).toBeLessThan(Number(stone))
    expect(container.querySelector('[data-latch="right"]')!.getAttribute("d")).not.toBe(latch)
    expect(container.querySelectorAll("[data-cut]").length).toBeGreaterThan(0)
  })

  it("turns the stone's optic on its own axis, and hides it when it looks away", () => {
    const { container, rerender } = render(<RobotAvocado open={0.9} bearing={0} />)
    const optic = container.querySelector("[data-optic]")!.getAttribute("transform")

    rerender(<RobotAvocado open={0.9} bearing={40} />)
    expect(container.querySelector("[data-optic]")!.getAttribute("transform")).not.toBe(optic)

    rerender(<RobotAvocado open={0.9} bearing={170} />)
    expect(container.querySelector("[data-optic]")).toBeNull()
  })

  it("projects one shell through every camera and names the view", () => {
    const front = render(<RobotAvocado open={0.6} view="front" />)
    const shell = front.container.querySelector('[data-half="right"]')!.getAttribute("d")
    expect(label(front.container)).toContain("front elevation")
    cleanup()

    for (const view of ["plan", "profile", "iso"] as const) {
      const { container } = render(<RobotAvocado open={0.6} view={view} />)
      expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
      expect(container.querySelector('[data-half="right"]')!.getAttribute("d")).not.toBe(shell)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
      expect(label(container)).toMatch(/view|elevation/)
      cleanup()
    }
  })

  it("renders a neutral shell for nonsense and keeps a colour override", () => {
    const { container, getByRole } = render(
      <RobotAvocado open={Number.NaN} bearing={Number.NaN} color="#ff00aa" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("img").getAttribute("aria-label")).toContain("0 percent")
    expect(container.innerHTML).toContain("#ff00aa")
  })

  it("is a slider when interactive, and the keys work the shell", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <RobotAvocado interactive animate={false} onOpenChange={(value) => seen.push(value)} />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuemax")).toBe("100")
    expect(svg.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(svg, { key: "ArrowRight" })
    fireEvent.keyDown(svg, { key: "End" })
    fireEvent.keyDown(svg, { key: "Home" })

    expect(seen).toEqual([0.1, 1, 0])
  })
})

describe("avocado behaviours", () => {
  it("stays inside the stroke, repeats whole cycles, and parks on bad input", () => {
    for (const behavior of ["present", "ajar", "scan", "static"] as const) {
      for (let i = 0; i <= 20; i++) {
        const value = avocadoGoal(behavior, i / 20)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      expect(avocadoGoal(behavior, 0.3)).toBeCloseTo(avocadoGoal(behavior, 3.3), 10)
      expect(avocadoGoal(behavior, Number.NaN)).toBe(avocadoGoal(behavior, 0))
      expect(Math.abs(avocadoBearing(behavior, 0.42))).toBeLessThanOrEqual(180)
    }
    expect(avocadoGoal("static", 0.4)).toBe(0)
    // Present holds the shell wide, ajar never opens far, scan sweeps the optic.
    expect(Math.max(...[0.3, 0.4, 0.5].map((t) => avocadoGoal("present", t)))).toBeGreaterThan(0.8)
    expect(Math.max(...Array.from({ length: 21 }, (_, i) => avocadoGoal("ajar", i / 20)))).toBeLessThan(0.4)
    expect(avocadoBearing("scan", 0.25)).not.toBeCloseTo(avocadoBearing("scan", 0.75), 3)
    expect(avocadoBearing("static", 0.25)).toBe(0)
  })
})

describe("robot strawberry", () => {
  it("opens the calyx and runs the seed studs out from one number", () => {
    const { container, rerender } = render(<RobotStrawberry bloom={0} seeds={24} blades={6} />)
    const blade = container.querySelector('[data-blade="0"]')!.getAttribute("d")
    const studs = container.querySelectorAll("[data-seed]").length
    const stud = container.querySelector("[data-seed]")!.getAttribute("d")

    rerender(<RobotStrawberry bloom={1} seeds={24} blades={6} />)

    expect(container.querySelector('[data-blade="0"]')!.getAttribute("d")).not.toBe(blade)
    expect(container.querySelector("[data-seed]")!.getAttribute("d")).not.toBe(stud)
    // The lattice does not gain or lose sites as the studs run out.
    expect(container.querySelectorAll("[data-seed]").length).toBe(studs)
  })

  it("draws the blades it is asked for and only the studs that face you", () => {
    const { container } = render(<RobotStrawberry bloom={0.6} seeds={40} blades={7} />)
    expect(container.querySelectorAll("[data-blade]")).toHaveLength(7)
    const shown = container.querySelectorAll("[data-seed]").length
    expect(shown).toBeGreaterThan(6)
    // Half a berry's skin faces away, so a front elevation never draws it all.
    expect(shown).toBeLessThan(40)
    expect(container.querySelector("[data-stem]")).not.toBeNull()
    expect(container.querySelector("[data-foot]")).not.toBeNull()
  })

  it("projects one berry through every camera and names the view", () => {
    const front = render(<RobotStrawberry bloom={0.5} view="front" />)
    const body = front.container.querySelector("[data-body]")!.getAttribute("d")
    expect(label(front.container)).toContain("front elevation")
    cleanup()

    for (const view of ["plan", "profile", "iso"] as const) {
      const { container } = render(<RobotStrawberry bloom={0.5} view={view} />)
      expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
      expect(label(container)).toMatch(/view|elevation/)
      if (view !== "profile") {
        expect(container.querySelector("[data-body]")!.getAttribute("d")).not.toBe(body)
      } else {
        // A body of revolution keeps its outline between the two elevations.
        expect(container.querySelector("[data-body]")!.getAttribute("d")).toBe(body)
      }
      cleanup()
    }
  })

  it("renders a neutral berry for nonsense and keeps a colour override", () => {
    const { container } = render(
      <RobotStrawberry bloom={Number.NaN} seeds={Number.NaN} blades={Number.NaN} color="#ff00aa" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(label(container)).toContain("0 percent")
    expect(container.querySelectorAll("[data-blade]").length).toBeGreaterThan(0)
    expect(container.innerHTML).toContain("#ff00aa")
  })

  it("is a slider when interactive, and the keys work the calyx", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <RobotStrawberry interactive animate={false} onBloomChange={(value) => seen.push(value)} />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuemax")).toBe("100")
    fireEvent.keyDown(svg, { key: "ArrowUp" })
    fireEvent.keyDown(svg, { key: "End" })
    fireEvent.keyDown(svg, { key: "Home" })
    expect(seen).toEqual([0.05, 1, 0])
  })
})

describe("strawberry behaviours", () => {
  it("stays inside the stroke, repeats whole cycles, and parks on bad input", () => {
    for (const behavior of ["unfurl", "probe", "furl", "static"] as const) {
      for (let i = 0; i <= 20; i++) {
        const value = strawberryGoal(behavior, i / 20)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      expect(strawberryGoal(behavior, 0.3)).toBeCloseTo(strawberryGoal(behavior, 3.3), 10)
      expect(strawberryGoal(behavior, Number.NaN)).toBe(strawberryGoal(behavior, 0))
    }
    expect(strawberryGoal("static", 0.4)).toBe(0.45)
    // Furl stays shut bar the two moments it cracks; probe works the middle.
    const furled = Array.from({ length: 41 }, (_, i) => strawberryGoal("furl", i / 40))
    expect(Math.min(...furled)).toBeLessThan(0.1)
    expect(Math.max(...furled)).toBeGreaterThan(0.4)
    const probed = Array.from({ length: 41 }, (_, i) => strawberryGoal("probe", i / 40))
    expect(Math.min(...probed)).toBeGreaterThan(0.25)
    expect(Math.max(...probed)).toBeLessThan(0.75)
  })
})

describe("robot tomato", () => {
  it("swings the whole machine under its clamp on a two-hinge stem", () => {
    const { container, rerender } = render(<RobotTomato swing={0} />)
    const body = container.querySelector("[data-body]")!.getAttribute("d")
    const upper = container.querySelector('[data-stem="upper"]')!.getAttribute("d")
    const lower = container.querySelector('[data-stem="lower"]')!.getAttribute("d")
    const hanger = container.querySelector("[data-hanger]")!.getAttribute("d")

    rerender(<RobotTomato swing={30} />)

    expect(container.querySelector("[data-body]")!.getAttribute("d")).not.toBe(body)
    expect(container.querySelector('[data-stem="upper"]')!.getAttribute("d")).not.toBe(upper)
    expect(container.querySelector('[data-stem="lower"]')!.getAttribute("d")).not.toBe(lower)
    // The clamp is bolted to the truss: it does not move with the fruit.
    expect(container.querySelector("[data-hanger]")!.getAttribute("d")).toBe(hanger)
  })

  it("runs the ripening front up the body and says how far it has got", () => {
    const { container, rerender } = render(<RobotTomato swing={0} ripeness={0.2} />)
    const front = container.querySelector("[data-front]")!.getAttribute("d")
    expect(label(container)).toContain("20 percent ripe")

    rerender(<RobotTomato swing={0} ripeness={0.85} />)
    expect(container.querySelector("[data-front]")!.getAttribute("d")).not.toBe(front)
    expect(label(container)).toContain("85 percent ripe")

    // Turned all over is no front at all, rather than a front of nothing —
    // and nothing turned is the whole fruit still wearing the live colour.
    rerender(<RobotTomato swing={0} ripeness={1} />)
    expect(container.querySelector("[data-front]")).toBeNull()
    rerender(<RobotTomato swing={0} ripeness={0} />)
    expect(container.querySelector("[data-front]")!.getAttribute("d")).toBe(
      container.querySelector("[data-body]")!.getAttribute("d"),
    )
  })

  it("cuts the furrows it is asked for and hangs the sepals off the crown", () => {
    const { container } = render(<RobotTomato swing={0} lobes={7} sepals={6} />)
    // Only the furrows on this side of the fruit are drawn.
    const furrows = container.querySelectorAll("[data-lobe]").length
    expect(furrows).toBeGreaterThan(1)
    expect(furrows).toBeLessThanOrEqual(7)
    expect(container.querySelectorAll("[data-sepal]")).toHaveLength(6)
  })

  it("projects one fruit through every camera and names the view", () => {
    const front = render(<RobotTomato swing={12} view="front" />)
    const body = front.container.querySelector("[data-body]")!.getAttribute("d")
    expect(label(front.container)).toContain("front elevation")
    cleanup()

    for (const view of ["plan", "profile", "iso"] as const) {
      const { container } = render(<RobotTomato swing={12} view={view} />)
      expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
      expect(container.querySelector("[data-body]")!.getAttribute("d")).not.toBe(body)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
      expect(label(container)).toMatch(/view|elevation/)
      cleanup()
    }
  })

  it("hangs plumb for nonsense input and keeps a colour override", () => {
    const { container } = render(
      <RobotTomato swing={Number.NaN} ripeness={Number.NaN} lobes={Number.NaN} color="#ff00aa" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(label(container)).toContain("0 degrees")
    expect(container.innerHTML).toContain("#ff00aa")
  })

  it("is a slider when interactive, and the keys swing it", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <RobotTomato interactive animate={false} onSwingChange={(value) => seen.push(value)} />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuemin")).toBe("-34")
    expect(svg.getAttribute("aria-valuemax")).toBe("34")
    fireEvent.keyDown(svg, { key: "ArrowRight" })
    fireEvent.keyDown(svg, { key: "End" })
    fireEvent.keyDown(svg, { key: "Home" })
    expect(seen).toEqual([5, 34, 0])
  })
})

describe("tomato behaviours", () => {
  it("stays inside the swing, repeats whole cycles, and hangs plumb on bad input", () => {
    for (const behavior of ["sway", "settle", "sort", "static"] as const) {
      for (let i = 0; i <= 20; i++) {
        expect(Math.abs(tomatoGoal(behavior, i / 20))).toBeLessThanOrEqual(34)
      }
      expect(tomatoGoal(behavior, 0.3)).toBeCloseTo(tomatoGoal(behavior, 3.3), 10)
      expect(tomatoGoal(behavior, Number.NaN)).toBe(tomatoGoal(behavior, 0))
    }
    expect(tomatoGoal("static", 0.4)).toBe(0)
    // A knock dies away over the cycle; a sway does not.
    const early = Math.abs(tomatoGoal("settle", 0.05))
    const late = Math.abs(tomatoGoal("settle", 0.9))
    expect(late).toBeLessThan(early / 3)
    // Sorting holds it over to one side rather than passing through.
    expect(tomatoGoal("sort", 0.5)).toBeGreaterThan(20)
    expect(tomatoGoal("sort", 0.95)).toBeLessThan(10)
  })
})

describe("grabbing the produce", () => {
  /** A press at a point in the box, with the box pinned to a known size. */
  const press = (svg: Element, x: number, y: number, width = 200, height = 182) => {
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: x, clientY: y, pointerId: 1 })
  }

  it("parts the avocado's shell from either side of the middle, and hands it back", () => {
    const seen: number[] = []
    const { container, getByRole } = render(
      <RobotAvocado interactive animate={false} behavior="static" onOpenChange={(v) => seen.push(v)} />,
    )
    const svg = getByRole("slider")
    const shut = container.querySelector('[data-half="right"]')!.getAttribute("d")

    press(svg, 200, 91)
    expect(seen.at(-1)).toBeCloseTo(1, 6)
    expect(container.querySelector('[data-half="right"]')!.getAttribute("d")).not.toBe(shut)

    // The other side of the middle opens it just the same.
    fireEvent.pointerMove(svg, { clientX: 0, clientY: 91, pointerId: 1 })
    expect(seen.at(-1)).toBeCloseTo(1, 6)
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 91, pointerId: 1 })
    expect(seen.at(-1)).toBe(0)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    expect(container.querySelector('[data-half="right"]')!.getAttribute("d")).toBe(shut)
  })

  it("pulls the strawberry's calyx down with the pointer", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <RobotStrawberry interactive animate={false} behavior="static" onBloomChange={(v) => seen.push(v)} />,
    )
    const svg = getByRole("slider")
    press(svg, 95, 154, 190, 172)
    expect(seen.at(-1)).toBeCloseTo(1, 6)
    fireEvent.pointerMove(svg, { clientX: 95, clientY: 17, pointerId: 1 })
    expect(seen.at(-1)).toBe(0)
  })

  it("swings the tomato the way the pointer went, from every camera", () => {
    /** Mean screen x of a projected path, which is where the fruit is. */
    const middle = (d: string) => {
      const xs = [...d.matchAll(/-?\d+(?:\.\d+)?/g)]
        .map((match) => Number(match[0]))
        .filter((_, index) => index % 2 === 0)
      return xs.reduce((sum, x) => sum + x, 0) / xs.length
    }

    for (const view of ["plan", "front", "profile", "iso"] as const) {
      const seen: number[] = []
      const { container, getByRole } = render(
        <RobotTomato interactive animate={false} behavior="static" view={view} onSwingChange={(v) => seen.push(v)} />,
      )
      const svg = getByRole("slider")
      const plumb = middle(container.querySelector("[data-body]")!.getAttribute("d")!)

      press(svg, 190, 91, 190, 182)

      // Dragging to the right of the box swings the fruit to the right of the
      // screen, whichever way starboard happens to run in this camera.
      expect(Math.abs(seen.at(-1)!)).toBeCloseTo(34, 6)
      expect(middle(container.querySelector("[data-body]")!.getAttribute("d")!)).toBeGreaterThan(plumb)
      cleanup()
    }
  })
})
