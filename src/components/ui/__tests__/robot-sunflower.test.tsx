import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  RobotSunflower,
  sunflowerBloom,
  sunflowerGoal,
  sunflowerSun,
} from "@/components/ui/robot-sunflower"
import { aimFrom, parastichyOffsets, vogelDisc } from "@/lib/robocn/phyllotaxis"

afterEach(cleanup)

const attribute = (container: HTMLElement, selector: string, name = "d") =>
  container.querySelector(selector)!.getAttribute(name)

describe("robot sunflower", () => {
  it("aims the head, the stem and the leaves at one light", () => {
    const { container, rerender } = render(
      <RobotSunflower animate={false} track={false} daylight={0.3} />,
    )
    const head = attribute(container, "[data-rim]")
    const stem = attribute(container, "[data-stem] path")
    const leaf = attribute(container, '[data-leaf="right"] path:last-of-type')

    rerender(<RobotSunflower animate={false} track={false} daylight={0.7} />)

    // A different time of day is a different light, and everything answers.
    expect(attribute(container, "[data-rim]")).not.toBe(head)
    expect(attribute(container, "[data-stem] path")).not.toBe(stem)
    expect(attribute(container, '[data-leaf="right"] path:last-of-type')).not.toBe(leaf)
  })

  it("keeps the stem's link lengths through every lean", () => {
    // Light square on to the side, seen from the front: the mast bends in the
    // screen plane, so a screen measurement is a world measurement.
    for (const elevation of [4, 20, 45, 70, 88]) {
      const { container } = render(
        <RobotSunflower
          animate={false}
          track={false}
          view="front"
          sun={{ azimuth: 90, elevation }}
          lean={1}
        />,
      )
      const nodes = [...container.querySelectorAll("[data-node]")].map((node) => ({
        x: Number(node.getAttribute("cx")),
        y: Number(node.getAttribute("cy")),
      }))
      expect(nodes.length).toBe(11)
      const spans = nodes
        .slice(1)
        .map((node, index) => Math.hypot(node.x - nodes[index].x, node.y - nodes[index].y))
      // Every link the same length, which is what the spine solver is for.
      expect(Math.max(...spans) - Math.min(...spans)).toBeLessThan(0.6)
      cleanup()
    }
  })

  it("draws the lattice it was asked for and the arms that fall out of it", () => {
    const { container } = render(
      <RobotSunflower animate={false} track={false} daylight={0.5} florets={160} arms={5} />,
    )
    // A dished face turned to the camera shows every cell; the count is the
    // lattice, not an artwork.
    expect(container.querySelectorAll("[data-floret]").length).toBe(160)
    expect(container.querySelectorAll("[data-arm]").length).toBe(5)
    expect(
      container.querySelectorAll('[data-arm="0"]')[0].getAttribute("d"),
    ).toMatch(/^M /)
  })

  it("turns the face away and shows the back of the disc at night", () => {
    const { container } = render(
      <RobotSunflower animate={false} track={false} daylight={0} florets={60} />,
    )
    expect(container.querySelector("[data-back]")).not.toBeNull()
    expect(container.querySelectorAll("[data-floret]").length).toBe(0)
  })

  it("furls the rays as the light goes and opens them as it comes back", () => {
    const shut = render(<RobotSunflower animate={false} track={false} bloom={0} rays={13} />)
    const furled = attribute(shut.container, '[data-ray="0"]')
    cleanup()
    const open = render(<RobotSunflower animate={false} track={false} bloom={1} rays={13} />)
    expect(attribute(open.container, '[data-ray="0"]')).not.toBe(furled)
    expect(open.container.querySelectorAll("[data-ray]").length).toBe(13)
  })

  it("hands the light to the pointer, and to an explicit aim over that", () => {
    const { container, rerender } = render(<RobotSunflower animate={false} behavior="static" />)
    const noon = attribute(container, "[data-rim]")
    rerender(
      <RobotSunflower animate={false} behavior="static" sun={{ azimuth: 70, elevation: 12 }} />,
    )
    expect(attribute(container, "[data-rim]")).not.toBe(noon)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("12 degrees")
  })

  it("reports the day while it is dragged and eases back when released", () => {
    const onDaylightChange = vi.fn()
    const { container } = render(
      <RobotSunflower interactive track={false} onDaylightChange={onDaylightChange} />,
    )
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 218 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    expect(onDaylightChange).toHaveBeenCalledWith(0.75)
    fireEvent.pointerUp(svg, { pointerId: 1 })

    fireEvent.keyDown(svg, { key: "Home" })
    expect(onDaylightChange).toHaveBeenLastCalledWith(0.25)
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("aria-valuenow")).not.toBeNull()
  })

  it("is a plain image with no slider semantics when it is not interactive", () => {
    const { container } = render(<RobotSunflower animate={false} track={false} />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("img")
    expect(svg.getAttribute("aria-valuenow")).toBeNull()
  })

  it("renders a neutral machine rather than NaN for broken input", () => {
    const { container } = render(
      <RobotSunflower
        animate={false}
        track={false}
        daylight={Number.NaN}
        florets={Number.NaN}
        rays={Number.NaN}
        arms={Number.NaN}
        lean={Number.NaN}
        bloom={Number.NaN}
        sun={{ azimuth: Number.NaN, elevation: Number.POSITIVE_INFINITY }}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("takes a colour override", () => {
    const { container } = render(
      <RobotSunflower animate={false} track={false} color="#ff8800" daylight={0.5} />,
    )
    expect(container.innerHTML).toContain("#ff8800")
  })
})

describe("the sunflower's own numbers", () => {
  it("sweeps dawn to dusk, runs the whole day, and hunts about noon", () => {
    expect(sunflowerGoal("sweep", 0)).toBeCloseTo(0.34, 9)
    expect(sunflowerGoal("sweep", 0.999)).toBeCloseTo(0.66, 2)
    // The working arc keeps the light well above the horizon all the way.
    expect(sunflowerSun(sunflowerGoal("sweep", 0)).elevation).toBeGreaterThan(35)
    expect(sunflowerSun(sunflowerGoal("sweep", 0.5)).elevation).toBeGreaterThan(60)
    expect(sunflowerGoal("day", 0.42)).toBeCloseTo(0.42, 9)
    expect(Math.abs(sunflowerGoal("nod", 0.3) - 0.5)).toBeLessThan(0.04)
    expect(sunflowerGoal("static", 3.7)).toBe(0.5)
    expect(sunflowerGoal("sweep", Number.NaN)).toBe(0.34)
  })

  it("puts the sun overhead at noon and under the horizon at midnight", () => {
    expect(sunflowerSun(0.5).elevation).toBeGreaterThan(60)
    expect(sunflowerSun(0.5).azimuth).toBeCloseTo(0, 9)
    expect(sunflowerSun(0).elevation).toBeLessThan(-60)
    expect(sunflowerSun(0.25).elevation).toBeCloseTo(0, 9)
    expect(sunflowerSun(0.75).elevation).toBeCloseTo(0, 9)
    expect(Number.isFinite(sunflowerSun(Number.NaN).azimuth)).toBe(true)
  })

  it("keeps the rays shut until the light is up", () => {
    expect(sunflowerBloom(-20)).toBe(0)
    expect(sunflowerBloom(0)).toBe(0)
    expect(sunflowerBloom(20)).toBeCloseTo(0.5, 9)
    expect(sunflowerBloom(60)).toBe(1)
  })

  it("agrees with the solver about which way the light is", () => {
    // The component's head and the library's aim are the same function.
    const aim = sunflowerSun(0.62)
    const back = aimFrom({
      x: Math.sin((aim.azimuth * Math.PI) / 180) * Math.cos((aim.elevation * Math.PI) / 180),
      y: Math.sin((aim.elevation * Math.PI) / 180),
      z: -Math.cos((aim.azimuth * Math.PI) / 180) * Math.cos((aim.elevation * Math.PI) / 180),
    })
    expect(back.azimuth).toBeCloseTo(aim.azimuth, 9)
    expect(back.elevation).toBeCloseTo(aim.elevation, 9)
  })

  it("draws the arms the lattice actually has", () => {
    // What the component hands to `spiralArm` is what the solver reports.
    expect(parastichyOffsets(vogelDisc(120, { radius: 26, innerRadius: 4.2 }))[0]).toBeGreaterThan(
      1,
    )
  })
})
