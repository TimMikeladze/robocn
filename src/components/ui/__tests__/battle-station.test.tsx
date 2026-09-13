import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BattleStation, stationCharge, stationGoal } from "@/components/ui/battle-station"
import { DebrisField, debrisGoal } from "@/components/ui/debris-field"

afterEach(cleanup)

/** Every coordinate in a path, as points. */
const points = (d: string) =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => ({
    x: Number(x),
    y: Number(y),
  }))

/** How far a drawing reaches from the centre of the 200-unit frame. */
const reach = (nodes: NodeListOf<Element>) =>
  Math.max(
    ...[...nodes].flatMap((node) =>
      points(node.getAttribute("d") ?? "").map((p) => Math.hypot(p.x - 100, p.y - 100)),
    ),
  )

const plateD = (container: HTMLElement, index: number) =>
  container.querySelector(`[data-plate="${index}"]`)?.getAttribute("d") ?? null

describe("battle station", () => {
  it("reassembles exactly: the intact hull is the tiling, not a second drawing", () => {
    const { container, rerender } = render(<BattleStation animate={false} breakup={0} spin={0} />)
    const intact = [...container.querySelectorAll("[data-plate]")].map((node) => [
      node.getAttribute("data-plate"),
      node.getAttribute("d"),
    ])
    expect(intact.length).toBeGreaterThan(20)

    rerender(<BattleStation animate={false} breakup={0.7} spin={0} />)
    expect(plateD(container, Number(intact[0][0]))).not.toBe(intact[0][1])

    // Back to zero: every plate is where the tiling put it, to the last bit.
    rerender(<BattleStation animate={false} breakup={0} spin={0} />)
    for (const [index, d] of intact) {
      expect(plateD(container, Number(index)), `plate ${index}`).toBe(d)
    }
  })

  it("opens from the rupture, so the near side goes before the far side", () => {
    // The rupture is at longitude 0 here, so plates near it are in one half of
    // the drawing; early in the burst only those have moved.
    const seated = (breakup: number) => {
      const { container } = render(
        <BattleStation animate={false} breakup={breakup} spin={0} rupture={0} tilt={0} />,
      )
      const rest = render(<BattleStation animate={false} breakup={0} spin={0} rupture={0} tilt={0} />)
      const moved = [...container.querySelectorAll("[data-plate]")].filter((node) => {
        const index = node.getAttribute("data-plate")
        const still = rest.container.querySelector(`[data-plate="${index}"]`)
        return still && still.getAttribute("d") !== node.getAttribute("d")
      }).length
      const total = container.querySelectorAll("[data-plate]").length
      cleanup()
      return { moved, total }
    }
    const early = seated(0.2)
    const late = seated(0.95)
    expect(early.moved).toBeGreaterThan(0)
    expect(early.moved).toBeLessThan(early.total)
    expect(late.moved).toBeGreaterThan(early.moved)
  })

  it("never draws a plate closer in than it sat", () => {
    let previous = 0
    for (const breakup of [0, 0.25, 0.5, 0.75, 1]) {
      const { container } = render(<BattleStation animate={false} breakup={breakup} spin={0} />)
      const spread = reach(container.querySelectorAll("[data-plate]"))
      expect(spread).toBeGreaterThanOrEqual(previous - 0.5)
      previous = spread
      cleanup()
    }
  })

  it("cuts the trench and the dish out of the plating rather than painting them on", () => {
    const full = render(<BattleStation animate={false} breakup={0} spin={0} trench={false} />)
    const plated = full.container.querySelectorAll("[data-plate]").length
    expect(full.container.querySelector("[data-trench]")).toBeNull()
    cleanup()

    const cut = render(<BattleStation animate={false} breakup={0} spin={0} trench />)
    expect(cut.container.querySelectorAll("[data-plate]").length).toBeLessThan(plated)
    expect(cut.container.querySelector("[data-trench]")).not.toBeNull()
    // The dish bore takes plating with it too: a wider bore takes more.
    const narrow = cut.container.querySelectorAll("[data-plate]").length
    cleanup()
    const wide = render(<BattleStation animate={false} breakup={0} spin={0} dishSpan={46} />)
    expect(wide.container.querySelectorAll("[data-plate]").length).toBeLessThan(narrow)
  })

  it("takes the plating off pole-first and leaves the frame behind", () => {
    const { container, rerender } = render(
      <BattleStation animate={false} breakup={0} spin={0} plating={1} ribs={14} />,
    )
    const full = container.querySelectorAll("[data-plate]").length
    expect(container.querySelectorAll("[data-rib]").length).toBe(14)
    rerender(<BattleStation animate={false} breakup={0} spin={0} plating={0.4} ribs={14} />)
    expect(container.querySelectorAll("[data-plate]").length).toBeLessThan(full)
    // The structure is not plating: it is still all there.
    expect(container.querySelectorAll("[data-rib]").length).toBe(14)
  })

  it("fires the dish from a charge, with every emitter ray landing on the focus", () => {
    const { container, rerender } = render(
      <BattleStation animate={false} breakup={0} spin={0} charge={0} emitters={7} />,
    )
    expect(container.querySelectorAll("[data-emitter]").length).toBe(7)
    expect(container.querySelector("[data-beam]")).toBeNull()

    const focus = container.querySelector("[data-focus]")!
    const target = { x: Number(focus.getAttribute("cx")), y: Number(focus.getAttribute("cy")) }
    for (const ray of container.querySelectorAll("[data-emitter]")) {
      const ends = points(ray.getAttribute("d")!)
      const end = ends.at(-1)!
      // The ray is the reflection about the bowl's own normal; the paraboloid
      // is what makes it arrive here rather than anything aiming it.
      expect(Math.hypot(end.x - target.x, end.y - target.y)).toBeLessThan(0.5)
    }

    rerender(<BattleStation animate={false} breakup={0} spin={0} charge={1} emitters={7} />)
    expect(container.querySelector("[data-beam]")).not.toBeNull()
  })

  it("reports the breakup and answers the keyboard", () => {
    const onBreakupChange = vi.fn()
    const { container } = render(<BattleStation interactive onBreakupChange={onBreakupChange} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    expect(onBreakupChange).toHaveBeenCalledWith(0.75)
    fireEvent.pointerUp(svg, { pointerId: 1 })
    fireEvent.keyDown(svg, { key: "End" })
    expect(onBreakupChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
  })

  it("names what it is and which camera it was drawn from", () => {
    const { container } = render(<BattleStation animate={false} breakup={0.5} view="iso" />)
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("Battle station")
    expect(label).toContain("50 percent broken up")
    expect(label).toMatch(/isometric/)
  })

  it("renders a stable station for broken input", () => {
    const { container } = render(
      <BattleStation
        animate={false}
        breakup={Number.NaN}
        charge={Number.NaN}
        spin={Number.NaN}
        tilt={Number.NaN}
        courses={Number.NaN}
        perCourse={Number.NaN}
        plating={Number.NaN}
        ribs={Number.NaN}
        dishLatitude={Number.NaN}
        dishLongitude={Number.NaN}
        dishSpan={Number.NaN}
        emitters={Number.NaN}
        rupture={Number.NaN}
        spread={Number.POSITIVE_INFINITY}
        seed={Number.NaN}
        sun={Number.NaN}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-plate]").length).toBeGreaterThan(0)
  })
})

describe("debris field", () => {
  it("reassembles the body it came off at zero", () => {
    const { container, rerender } = render(<DebrisField animate={false} spread={0} />)
    const assembled = reach(container.querySelectorAll("[data-fragment]"))
    rerender(<DebrisField animate={false} spread={1} />)
    expect(reach(container.querySelectorAll("[data-fragment]"))).toBeGreaterThan(assembled * 1.5)
  })

  it("paints back to front, and the order is the camera's rather than the tiling's", () => {
    const order = (view: "front" | "profile") => {
      const { container } = render(<DebrisField animate={false} spread={0.6} view={view} />)
      const seen = [...container.querySelectorAll("[data-fragment]")].map((node) =>
        node.getAttribute("data-fragment"),
      )
      cleanup()
      return seen.join(",")
    }
    const front = order("front")
    expect(front).not.toBe(order("profile"))
    // Every fragment is still drawn — the sort is an order, not a cull.
    expect(front.split(",").length).toBeGreaterThan(20)
  })

  it("draws the trajectories only when asked, and only for pieces that have let go", () => {
    const bare = render(<DebrisField animate={false} spread={0.6} />)
    expect(bare.container.querySelector("[data-trail]")).toBeNull()
    cleanup()

    const still = render(<DebrisField animate={false} spread={0} showTrails />)
    expect(still.container.querySelector("[data-trail]")).toBeNull()
    cleanup()

    const flying = render(<DebrisField animate={false} spread={0.6} showTrails />)
    const trails = flying.container.querySelectorAll("[data-trail]")
    expect(trails.length).toBeGreaterThan(0)
    // A trail is a straight line: two points, because the travel is one.
    for (const trail of trails) expect(points(trail.getAttribute("d")!)).toHaveLength(2)
  })

  it("takes the shock away when asked and reports its own count", () => {
    const { container, rerender } = render(
      <DebrisField animate={false} spread={0.5} courses={4} perCourse={6} />,
    )
    const count = container.querySelectorAll("[data-fragment]").length
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      `${count} fragments`,
    )
    expect(container.querySelector("[data-shock]")).not.toBeNull()
    rerender(<DebrisField animate={false} spread={0.5} courses={4} perCourse={6} showShock={false} />)
    expect(container.querySelector("[data-shock]")).toBeNull()
  })

  it("reports the spread from a drag and from the keyboard", () => {
    const onSpreadChange = vi.fn()
    const { container } = render(<DebrisField interactive onSpreadChange={onSpreadChange} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 40, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 100, pointerId: 1 })
    expect(onSpreadChange).toHaveBeenCalledWith(0.2)
    fireEvent.pointerUp(svg, { pointerId: 1 })
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onSpreadChange).toHaveBeenLastCalledWith(0)
  })

  it("renders a stable field for broken input", () => {
    const { container } = render(
      <DebrisField
        animate={false}
        spread={Number.NaN}
        courses={Number.NaN}
        perCourse={Number.NaN}
        reach={Number.POSITIVE_INFINITY}
        rupture={Number.NaN}
        seed={Number.NaN}
        sun={Number.NaN}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-fragment]").length).toBeGreaterThan(0)
  })
})

describe("the family's own numbers", () => {
  it("samples every behaviour inside its own limits", () => {
    // Out and back: intact at both ends of the cycle, wide open in the middle.
    expect(stationGoal("detonate", 0)).toBeCloseTo(0, 12)
    expect(stationGoal("detonate", 0.5)).toBeCloseTo(1, 12)
    expect(stationGoal("detonate", 1)).toBeCloseTo(0, 12)
    expect(stationGoal("patrol", 0.5)).toBe(0)
    expect(stationGoal("charge", 0.5)).toBe(0)
    expect(stationGoal("static", 4)).toBe(0)
    expect(stationGoal("detonate", Number.NaN)).toBe(0)

    expect(stationCharge("charge", 0)).toBeCloseTo(0, 12)
    expect(stationCharge("charge", 0.8)).toBeCloseTo(1, 12)
    expect(stationCharge("charge", 1)).toBeCloseTo(0, 12)
    // Detonate fires first and is cold by the time the hull lets go.
    expect(stationCharge("detonate", 0.22)).toBeCloseTo(1, 12)
    expect(stationCharge("detonate", 0.5)).toBe(0)
    expect(stationCharge("static", 3)).toBe(0.35)
    expect(stationCharge("patrol", Number.NaN)).toBe(0)

    expect(debrisGoal("burst", 0)).toBeCloseTo(0, 12)
    expect(debrisGoal("burst", 0.5)).toBeCloseTo(1, 12)
    expect(debrisGoal("tumble", 7)).toBe(0.82)
    expect(debrisGoal("static", 2)).toBe(0.5)
    expect(debrisGoal("drift", Number.NaN)).toBe(0.5)

    // Whole cycles repeat, in both directions.
    for (const clock of [0.37, 1.37, -0.63]) {
      expect(stationGoal("detonate", clock)).toBeCloseTo(stationGoal("detonate", 0.37), 9)
      expect(debrisGoal("burst", clock)).toBeCloseTo(debrisGoal("burst", 0.37), 9)
    }
  })
})
