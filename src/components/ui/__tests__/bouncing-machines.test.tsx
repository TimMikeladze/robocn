import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  SpringHopper,
  springHopperPose,
  type SpringHopperBehavior,
} from "@/components/ui/spring-hopper"
import { hopTimings } from "@/lib/robocn/hopper"
import type { RobotView } from "@/lib/robocn/style"

afterEach(cleanup)

const attr = (container: HTMLElement, selector: string, name: string) =>
  container.querySelector(selector)?.getAttribute(name) ?? ""

describe("spring hopper", () => {
  it("loads the spring and drops the body when compression is driven", () => {
    const { container, rerender } = render(<SpringHopper compression={0} />)
    const free = attr(container, "[data-spring]", "d")
    const standing = attr(container, "[data-body]", "transform")
    expect(attr(container, "[data-hopper]", "data-contact")).toBe("stance")

    rerender(<SpringHopper compression={1} />)

    expect(attr(container, "[data-spring]", "d")).not.toBe(free)
    expect(attr(container, "[data-body]", "transform")).not.toBe(standing)
    // Loading the spring can only lower the body: you cannot drag it airborne.
    const loaded = Number(/translate\([-\d.]+ ([-\d.]+)\)/.exec(attr(container, "[data-body]", "transform"))?.[1])
    const rest = Number(/translate\([-\d.]+ ([-\d.]+)\)/.exec(standing)?.[1])
    expect(loaded).toBeGreaterThan(rest)
  })

  it("keeps the coil count and cannot crush the spring through its own wire", () => {
    const coils = (node: HTMLElement) => (attr(node, "[data-spring]", "d").match(/L/g) ?? []).length
    const { container, rerender } = render(<SpringHopper compression={0} />)
    const open = coils(container)
    const openLength = attr(container, "[data-spring]", "d").length

    rerender(<SpringHopper compression={1} stiffness={4} height={1} />)

    expect(coils(container)).toBe(open)
    expect(attr(container, "[data-spring]", "d").length).toBeGreaterThan(openLength / 2)
    expect(container.querySelector("[data-spring]")?.getAttribute("data-bottomed")).toBe("true")
  })

  it("leaves the ground on the behaviour's own cycle and reports which regime it is in", () => {
    const { duty } = hopTimings({})
    const stance = springHopperPose("hop", duty / 2)
    const air = springHopperPose("hop", duty + (1 - duty) / 2)

    expect(stance.contact).toBe(true)
    expect(stance.compression).toBeGreaterThan(0)
    expect(air.contact).toBe(false)
    expect(air.altitude).toBeGreaterThan(0.3)
    // Pumping never leaves the ground, which is the whole point of it.
    for (const phase of [0, 0.2, 0.5, 0.8]) {
      expect(springHopperPose("pump", phase).contact).toBe(true)
      expect(springHopperPose("pump", phase).altitude).toBeLessThanOrEqual(0)
    }
    expect(springHopperPose("static", 0.4)).toEqual(springHopperPose("static", 0.9))
    expect(springHopperPose("hop", Number.NaN).contact).toBe(true)
  })

  it("swings the leg only in the air, and turns the reaction wheel against it", () => {
    const { container, rerender } = render(<SpringHopper behavior="static" animate={false} />)
    const planted = attr(container, "[data-hip]", "transform")
    const wheel = attr(container, "[data-gyro]", "transform")

    rerender(<SpringHopper behavior="bound" phase={0.62} animate={false} />)

    expect(attr(container, "[data-hopper]", "data-contact")).toBe("flight")
    expect(attr(container, "[data-hip]", "transform")).not.toBe(planted)
    expect(attr(container, "[data-gyro]", "transform")).not.toBe(wheel)
  })

  it("projects one machine through four cameras and names the view", () => {
    const seen = new Set<string>()
    for (const view of ["profile", "front", "plan", "iso"] as RobotView[]) {
      const { container } = render(<SpringHopper view={view} compression={0.4} />)
      seen.add(attr(container, "[data-foot]", "d"))
      expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(
        view === "profile" ? "side elevation" : view === "front" ? "front elevation" : view === "plan" ? "plan view" : "isometric",
      )
      cleanup()
    }
    expect(seen.size).toBe(4)
  })

  it("is a slider you can load with the keyboard, and survives nonsense input", () => {
    const onCompressionChange = vi.fn()
    const { container } = render(
      <SpringHopper interactive compression={0.2} onCompressionChange={onCompressionChange} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("aria-valuenow")).toBe("20")

    fireEvent.keyDown(svg, { key: "ArrowUp" })
    expect(onCompressionChange).toHaveBeenCalledWith(0.25)
    fireEvent.keyDown(svg, { key: "End" })
    expect(onCompressionChange).toHaveBeenLastCalledWith(1)

    cleanup()
    const bad = render(
      <SpringHopper compression={Number.NaN} height={Number.NaN} stiffness={Number.NaN} label="X" />,
    )
    expect(bad.container.querySelector("[data-spring]")?.getAttribute("d")).toMatch(/^M /)
    expect(bad.container.querySelector("svg")?.getAttribute("aria-label")).toContain("Spring hopper")
  })

  it("takes a colour override through the palette, not a hardcoded fill", () => {
    const { container } = render(<SpringHopper color="#ff0088" variant="solid" />)
    expect(container.innerHTML).toContain("#ff0088")
  })
})

describe("spring hopper behaviours", () => {
  it("samples every behaviour as a pure function of the clock", () => {
    for (const behavior of ["hop", "bound", "pump", "static"] as SpringHopperBehavior[]) {
      for (const clock of [0, 0.33, 1.5, 7.25]) {
        const pose = springHopperPose(behavior, clock)
        expect(Number.isFinite(pose.altitude)).toBe(true)
        expect(pose.squeeze).toBeGreaterThanOrEqual(0)
        expect(pose.squeeze).toBeLessThanOrEqual(1)
        // Whole cycles repeat, in both directions.
        expect(springHopperPose(behavior, clock + 1).altitude).toBeCloseTo(pose.altitude, 6)
        expect(springHopperPose(behavior, clock - 1).altitude).toBeCloseTo(pose.altitude, 6)
      }
    }
    expect(springHopperPose("bound", 0.5).altitude).toBeGreaterThan(springHopperPose("hop", 0.5).altitude)
  })
})
