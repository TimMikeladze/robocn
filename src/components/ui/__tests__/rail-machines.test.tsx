import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  PantographCollector,
  pantographLift,
} from "@/components/ui/pantograph-collector"
import { RailBogie, bogieBrake, bogieRun } from "@/components/ui/rail-bogie"
import {
  RailLocomotive,
  locomotiveCurve,
  locomotivePan,
} from "@/components/ui/rail-locomotive"
import { RailTurnout, turnoutThrow } from "@/components/ui/rail-turnout"

/**
 * The rail family: docs/rail-machines.md.
 *
 * The same three things are asserted per machine — a controlled axis moves the
 * mechanism it names, the accessible label says what it is and where the camera
 * stands, and nonsense on any numeric axis renders a pose rather than reaching
 * the DOM. Motion is sampled through the exported behaviour functions rather
 * than through faked frames.
 */

afterEach(cleanup)

const attribute = (container: HTMLElement, selector: string, name = "d") =>
  container.querySelector(selector)?.getAttribute(name) ?? null

/** Nothing a projection produced may reach the DOM as NaN. */
const clean = (container: HTMLElement) => {
  for (const element of container.querySelectorAll("*")) {
    for (const attr of element.attributes) {
      expect(attr.value, `${element.tagName}.${attr.name}`).not.toContain("NaN")
    }
  }
}

describe("rail locomotive", () => {
  it("throws the body's middle in and its ends out, and not at all on the straight", () => {
    const { container, rerender } = render(
      <RailLocomotive curve={0} cars={1} animate={false} />,
    )
    const frame = container.querySelector("[data-curve]")!
    expect(frame.getAttribute("data-centre-throw")).toBe("0")
    expect(frame.getAttribute("data-end-throw")).toBe("0")

    rerender(<RailLocomotive curve={10} cars={1} animate={false} />)
    const centre = Number(
      container.querySelector("[data-curve]")!.getAttribute("data-centre-throw"),
    )
    const end = Number(
      container.querySelector("[data-curve]")!.getAttribute("data-end-throw"),
    )
    expect(centre).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(centre)
  })

  it("yaws the two bogies opposite ways, and mirrors them round a curve the other way", () => {
    const { container, rerender } = render(
      <RailLocomotive curve={8} cars={0} animate={false} />,
    )
    const lead = Number(attribute(container, '[data-bogie="locomotive-lead"]', "data-yaw"))
    const trail = Number(attribute(container, '[data-bogie="locomotive-trail"]', "data-yaw"))
    expect(lead).toBeGreaterThan(0)
    expect(trail).toBeCloseTo(-lead, 5)

    rerender(<RailLocomotive curve={-8} cars={0} animate={false} />)
    expect(
      Number(attribute(container, '[data-bogie="locomotive-lead"]', "data-yaw")),
    ).toBeCloseTo(-lead, 5)
  })

  it("puts every car on the curve, so the whole train bends", () => {
    const { container, rerender } = render(
      <RailLocomotive curve={0} cars={2} view="plan" animate={false} />,
    )
    expect(container.querySelectorAll("[data-vehicle]")).toHaveLength(3)
    const car = attribute(container, '[data-vehicle="car-1"] [data-body]')

    rerender(<RailLocomotive curve={10} cars={2} view="plan" animate={false} />)
    expect(attribute(container, '[data-vehicle="car-1"] [data-body]')).not.toBe(car)
    clean(container)
  })

  it("works the collector and reports where it is", () => {
    const { container, rerender } = render(
      <RailLocomotive pantograph="stowed" cars={0} curve={0} animate={false} />,
    )
    const stowed = attribute(container, "[data-upper-arm]")
    expect(attribute(container, "[data-pantograph]", "data-height")).toBe("0")

    rerender(<RailLocomotive pantograph="raised" cars={0} curve={0} animate={false} />)
    expect(attribute(container, "[data-upper-arm]")).not.toBe(stowed)
    expect(attribute(container, "[data-pantograph]", "data-height")).toBe("1")
  })

  it("names itself and its camera, and projects a different drawing per view", () => {
    const { container, getByRole, rerender } = render(
      <RailLocomotive curve={6} cars={1} view="profile" animate={false} />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("side elevation")
    const profile = attribute(container, "[data-vehicle='locomotive'] [data-body]")

    rerender(<RailLocomotive curve={6} cars={1} view="plan" animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
    expect(attribute(container, "[data-vehicle='locomotive'] [data-body]")).not.toBe(profile)
  })

  it("renders a straight, whole train from nonsense", () => {
    const { container, getByRole } = render(
      <RailLocomotive
        curve={Number.NaN}
        cars={Number.NaN}
        view={"sideways" as never}
        animate={false}
      />,
    )
    expect(container.querySelector("[data-curve]")!.getAttribute("data-curve")).toBe("0")
    expect(getByRole("img")).toBeTruthy()
    clean(container)
  })

  it("takes a drag and reports the track it is being asked for", () => {
    const onCurveChange = vi.fn()
    const { getByRole } = render(
      <RailLocomotive interactive onCurveChange={onCurveChange} animate={false} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect
    svg.setPointerCapture = () => {}
    svg.releasePointerCapture = () => {}
    fireEvent.pointerDown(svg, { clientX: 180, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 180, clientY: 50, pointerId: 1 })
    expect(onCurveChange).toHaveBeenCalled()
    expect(onCurveChange.mock.lastCall?.[0]).toBeGreaterThan(0)

    fireEvent.keyDown(svg, { key: "Home" })
    expect(onCurveChange.mock.lastCall?.[0]).toBe(0)
  })
})

describe("rail bogie", () => {
  it("hunts because it is coned, and stops dead when it is not", () => {
    const { container, rerender } = render(
      <RailBogie travel={4} conicity={0.12} animate={false} />,
    )
    const lateral = Number(attribute(container, '[data-wheelset="lead"]', "data-lateral"))
    const yaw = Number(attribute(container, '[data-wheelset="lead"]', "data-yaw"))
    expect(Math.abs(lateral)).toBeGreaterThan(0)
    expect(Math.abs(yaw)).toBeGreaterThan(0)

    rerender(<RailBogie travel={4} conicity={0} animate={false} />)
    expect(attribute(container, '[data-wheelset="lead"]', "data-lateral")).toBe("0")
    expect(attribute(container, '[data-wheelset="lead"]', "data-yaw")).toBe("0")
    expect(attribute(container, "[data-travel]", "data-wavelength")).toBe("infinite")
  })

  it("moves both wheelsets and the frame when the run moves", () => {
    const { container, rerender } = render(<RailBogie travel={0} animate={false} />)
    const lead = attribute(container, '[data-wheelset="lead"] [data-axle]')
    const frame = attribute(container, "[data-frame]", "data-lateral")

    rerender(<RailBogie travel={9} animate={false} />)
    expect(attribute(container, '[data-wheelset="lead"] [data-axle]')).not.toBe(lead)
    expect(attribute(container, "[data-frame]", "data-lateral")).not.toBe(frame)
  })

  it("splays the wheelsets against each other on a curve", () => {
    const { container } = render(<RailBogie behavior="curve" conicity={0} animate={false} />)
    const lead = Number(attribute(container, '[data-wheelset="lead"]', "data-yaw"))
    const trail = Number(attribute(container, '[data-wheelset="trail"]', "data-yaw"))
    expect(lead).toBeGreaterThan(0)
    expect(trail).toBeCloseTo(-lead, 5)
  })

  it("brings the shoes onto the treads", () => {
    const { container, rerender } = render(<RailBogie travel={3} brake={0} animate={false} />)
    const off = attribute(container, '[data-brake="lead-port"]')

    rerender(<RailBogie travel={3} brake={1} animate={false} />)
    expect(attribute(container, '[data-brake="lead-port"]')).not.toBe(off)
    expect(attribute(container, '[data-brake="lead-port"]', "data-application")).toBe("1")
  })

  it("names itself, its wavelength and its camera", () => {
    const { getByRole, rerender } = render(<RailBogie travel={2} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
    expect(getByRole("img").getAttribute("aria-label")).toContain("hunting wavelength")

    rerender(<RailBogie travel={2} conicity={0} view="iso" animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(getByRole("img").getAttribute("aria-label")).toContain("cylindrical treads")
  })

  it("renders a neutral bogie from nonsense", () => {
    const { container, getByRole } = render(
      <RailBogie
        travel={Number.NaN}
        conicity={Number.NaN}
        amplitude={Number.NaN}
        animate={false}
      />,
    )
    expect(attribute(container, "[data-travel]", "data-travel")).toBe("0")
    expect(getByRole("img")).toBeTruthy()
    clean(container)
  })
})

describe("pantograph collector", () => {
  it("spends reach to buy height: the knee folds in as the pan rises", () => {
    const { container, rerender } = render(
      <PantographCollector height={0} along={0} animate={false} />,
    )
    const low = attribute(container, '[data-joint="knee"]')
    const stowed = Number(attribute(container, "[data-height]", "data-working-height"))

    rerender(<PantographCollector height={1} along={0} animate={false} />)
    expect(attribute(container, '[data-joint="knee"]')).not.toBe(low)
    expect(
      Number(attribute(container, "[data-height]", "data-working-height")),
    ).toBeGreaterThan(stowed)
  })

  it("levels the head at the wire and tips it at the bottom of the travel", () => {
    const { container, rerender } = render(
      <PantographCollector height={1} along={0} animate={false} />,
    )
    expect(
      Math.abs(Number(attribute(container, "[data-pan]", "data-attitude"))),
    ).toBeLessThan(0.5)

    rerender(<PantographCollector height={0} along={0} animate={false} />)
    expect(
      Math.abs(Number(attribute(container, "[data-pan]", "data-attitude"))),
    ).toBeGreaterThan(0.5)
  })

  it("walks the wire across the strip as it runs", () => {
    // Front is the view the stagger reads in: it is a lateral offset, so side
    // on it barely moves the contact and head on it moves it across the strip.
    const { container, rerender } = render(
      <PantographCollector height={1} along={0} view="front" animate={false} />,
    )
    const start = attribute(container, "[data-wire]")
    const contact = Number(attribute(container, "[data-contact]", "cx"))

    rerender(<PantographCollector height={1} along={35} view="front" animate={false} />)
    expect(attribute(container, "[data-wire]")).not.toBe(start)
    // Half a span later the wire has crossed to the other side of the strip.
    expect(Number(attribute(container, "[data-contact]", "cx"))).not.toBe(contact)
    expect(
      Math.sign(Number(attribute(container, "[data-contact]", "cx"))),
    ).not.toBe(Math.sign(contact))
  })

  it("names itself, whether it is on the wire, and its camera", () => {
    const { getByRole, rerender } = render(
      <PantographCollector height={1} view="front" animate={false} />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("front elevation")
    expect(getByRole("img").getAttribute("aria-label")).toContain("on the wire")

    rerender(<PantographCollector height={0} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("clear of the wire")
  })

  it("stows from nonsense rather than breaking the linkage", () => {
    const { container, getByRole } = render(
      <PantographCollector height={Number.NaN} along={Number.NaN} animate={false} />,
    )
    expect(attribute(container, "[data-height]", "data-height")).toBe("0")
    expect(getByRole("img")).toBeTruthy()
    clean(container)
  })
})

describe("rail turnout", () => {
  it("ties the blades to one bar, so the gaps sum to the throw", () => {
    const { container, rerender } = render(
      <RailTurnout throwPosition={0} animate={false} />,
    )
    const normal = Number(attribute(container, '[data-blade="normal"]', "data-gap"))
    const reverse = Number(attribute(container, '[data-blade="reverse"]', "data-gap"))
    expect(normal).toBe(0)
    expect(reverse).toBeGreaterThan(0)

    rerender(<RailTurnout throwPosition={1} animate={false} />)
    expect(Number(attribute(container, '[data-blade="normal"]', "data-gap"))).toBeCloseTo(
      reverse,
      5,
    )
    expect(Number(attribute(container, '[data-blade="reverse"]', "data-gap"))).toBe(0)
  })

  it("sets no route at all in mid stroke, and says so", () => {
    const onRouteChange = vi.fn()
    const { container, getByRole, rerender } = render(
      <RailTurnout throwPosition={0} onRouteChange={onRouteChange} animate={false} />,
    )
    expect(attribute(container, "[data-route]", "data-route")).toBe("normal")

    rerender(
      <RailTurnout throwPosition={0.5} onRouteChange={onRouteChange} animate={false} />,
    )
    expect(attribute(container, "[data-route]", "data-route")).toBe("unset")
    expect(getByRole("img").getAttribute("aria-label")).toContain("no route set")
    expect(onRouteChange).toHaveBeenCalledWith("unset")

    rerender(
      <RailTurnout throwPosition={1} onRouteChange={onRouteChange} animate={false} />,
    )
    expect(onRouteChange).toHaveBeenLastCalledWith("reverse")
  })

  it("takes the whole geometry from the turnout number", () => {
    const { container, rerender } = render(
      <RailTurnout throwPosition={1} number={4} animate={false} />,
    )
    const sharp = Number(attribute(container, "[data-route]", "data-crossing-angle"))
    const route = attribute(container, "[data-diverging='left']")

    rerender(<RailTurnout throwPosition={1} number={10} animate={false} />)
    expect(
      Number(attribute(container, "[data-route]", "data-crossing-angle")),
    ).toBeLessThan(sharp)
    expect(attribute(container, "[data-diverging='left']")).not.toBe(route)
  })

  it("mirrors for a left-hand turnout", () => {
    const { container, rerender } = render(
      <RailTurnout throwPosition={1} hand="right" animate={false} />,
    )
    const right = attribute(container, "[data-crossing]")

    rerender(<RailTurnout throwPosition={1} hand="left" animate={false} />)
    expect(attribute(container, "[data-crossing]")).not.toBe(right)
  })

  it("names itself, its number and its camera, and survives nonsense", () => {
    const { container, getByRole } = render(
      <RailTurnout
        throwPosition={Number.NaN}
        number={Number.NaN}
        view="iso"
        animate={false}
      />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(getByRole("img").getAttribute("aria-label")).toContain("normal route set")
    clean(container)
  })
})

describe("the behaviour samplers", () => {
  it("winds the line both ways and holds the depot straight", () => {
    const samples = Array.from({ length: 40 }, (_, i) => locomotiveCurve("line", i / 8))
    expect(Math.max(...samples)).toBeGreaterThan(3)
    expect(Math.min(...samples)).toBeLessThan(-3)
    expect(locomotiveCurve("depot", 0.4)).toBe(0)
    expect(locomotiveCurve("static", 0.4)).toBe(0)
    expect(locomotiveCurve("line", Number.NaN)).toBe(0)
    // The crossover closes without a jump: a whole cycle comes back to itself.
    expect(locomotiveCurve("yard", 1)).toBeCloseTo(locomotiveCurve("yard", 0), 6)
  })

  it("only works the collector at the depot", () => {
    expect(locomotivePan("line", 0.3)).toBe(1)
    expect(locomotivePan("depot", 0.05)).toBe(0)
    expect(locomotivePan("depot", 0.5)).toBe(1)
    expect(locomotivePan("static", Number.NaN)).toBe(1)
    expect(locomotivePan("depot", Number.NaN)).toBe(0)
  })

  it("runs the bogie out and back, and works the shoes only when braking", () => {
    expect(bogieRun("hunt", 0)).toBe(0)
    expect(bogieRun("hunt", 0.5)).toBeGreaterThan(bogieRun("hunt", 0.25))
    expect(bogieRun("hunt", 1)).toBeCloseTo(bogieRun("hunt", 0), 6)
    expect(bogieRun("static", 0.5)).toBe(0)
    expect(bogieBrake("hunt", 0.5)).toBe(0)
    expect(bogieBrake("brake", 0.6)).toBeGreaterThan(0)
    expect(bogieBrake("brake", 0.7)).toBe(1)
  })

  it("raises the collector, holds it running, and keeps it stowed", () => {
    expect(pantographLift("raise", 0.02)).toBe(0)
    expect(pantographLift("raise", 0.5)).toBe(1)
    expect(pantographLift("raise", 0.99)).toBe(0)
    expect(pantographLift("run", 0.3)).toBeGreaterThan(0.85)
    expect(pantographLift("stow", 0.3)).toBe(0)
    expect(pantographLift("static", Number.NaN)).toBe(1)
  })

  it("runs the point machine through its duty cycle and never leaves the stroke", () => {
    expect(turnoutThrow("route", 0.2)).toBe(0)
    expect(turnoutThrow("route", 0.6)).toBe(1)
    expect(turnoutThrow("route", 1)).toBeCloseTo(turnoutThrow("route", 0), 6)
    for (let step = 0; step <= 40; step += 1) {
      const value = turnoutThrow("route", step / 40)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
    // Creep never gets anywhere near detection at the reverse end.
    const creep = Array.from({ length: 20 }, (_, i) => turnoutThrow("creep", i / 20))
    expect(Math.max(...creep)).toBeLessThan(0.3)
    expect(turnoutThrow("static", 0.5)).toBe(0)
  })
})
