import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  BallHopper,
  ballHopperPose,
  type BallHopperBehavior,
} from "@/components/ui/ball-hopper"
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
    const standing = Number(attr(container, "[data-body]", "data-height"))
    expect(attr(container, "[data-hopper]", "data-contact")).toBe("stance")

    rerender(<SpringHopper compression={1} />)

    expect(attr(container, "[data-spring]", "d")).not.toBe(free)
    // Loading the spring can only lower the body: you cannot drag it airborne.
    expect(Number(attr(container, "[data-body]", "data-height"))).toBeLessThan(standing)
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
    const planted = attr(container, "[data-shaft]", "d")
    const wheel = attr(container, "[data-gyro]", "d")
    expect(attr(container, "[data-hip]", "data-swing")).toBe("0")

    rerender(<SpringHopper behavior="bound" phase={0.62} animate={false} />)

    expect(attr(container, "[data-hopper]", "data-contact")).toBe("flight")
    expect(Number(attr(container, "[data-hip]", "data-swing"))).not.toBe(0)
    expect(attr(container, "[data-shaft]", "d")).not.toBe(planted)
    expect(attr(container, "[data-gyro]", "d")).not.toBe(wheel)
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

describe("ball hopper", () => {
  it("lifts the shell out of contact when altitude is driven", () => {
    const { container, rerender } = render(<BallHopper altitude={0} />)
    const grounded = Number(attr(container, "[data-shell]", "cy"))
    expect(attr(container, "[data-ball]", "data-contact")).toBe("stance")

    rerender(<BallHopper altitude={1} />)

    expect(attr(container, "[data-ball]", "data-contact")).toBe("flight")
    // Screen y counts down, so rising is a smaller cy.
    expect(Number(attr(container, "[data-shell]", "cy"))).toBeLessThan(grounded)
  })

  it("squashes at constant volume: flattening the shell widens it", () => {
    const { container, rerender } = render(<BallHopper behavior="static" animate={false} />)
    const free = { rx: Number(attr(container, "[data-shell]", "rx")), ry: Number(attr(container, "[data-shell]", "ry")) }

    rerender(<BallHopper behavior="bounce" phase={0.04} animate={false} />)

    const hit = { rx: Number(attr(container, "[data-shell]", "rx")), ry: Number(attr(container, "[data-shell]", "ry")) }
    expect(attr(container, "[data-ball]", "data-contact")).toBe("stance")
    expect(hit.rx).toBeGreaterThan(free.rx)
    expect(hit.ry).toBeLessThan(free.ry)
  })

  it("turns the band, and hides the optic once it has gone round the back", () => {
    const { container, rerender } = render(<BallHopper spin={0} />)
    const seam = attr(container, "[data-seam]", "d")
    const optic = attr(container, "[data-optic] circle", "cx")
    expect(container.querySelector("[data-optic]")).not.toBeNull()

    rerender(<BallHopper spin={40} />)
    expect(attr(container, "[data-seam]", "d")).not.toBe(seam)
    expect(attr(container, "[data-optic] circle", "cx")).not.toBe(optic)

    rerender(<BallHopper spin={180} />)
    // Round the back: a lens you cannot see is not drawn.
    expect(container.querySelector("[data-optic]")).toBeNull()
  })

  it("projects one shell through four cameras and names the view", () => {
    const seen = new Set<string>()
    for (const view of ["front", "profile", "plan", "iso"] as RobotView[]) {
      const { container } = render(<BallHopper view={view} behavior="bounce" phase={0.04} animate={false} />)
      seen.add(`${attr(container, "[data-shell]", "ry")}/${attr(container, "[data-seam]", "d")}`)
      expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(
        view === "profile" ? "side elevation" : view === "front" ? "front elevation" : view === "plan" ? "plan view" : "isometric",
      )
      cleanup()
    }
    // Looking straight down, a squashed ball reads as a wider one, not a flatter one.
    expect(seen.size).toBe(4)
  })

  it("is a slider you can lift with the keyboard, and survives nonsense input", () => {
    const onAltitudeChange = vi.fn()
    const { container } = render(
      <BallHopper interactive altitude={0.4} onAltitudeChange={onAltitudeChange} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("aria-valuenow")).toBe("40")

    fireEvent.keyDown(svg, { key: "ArrowDown" })
    expect(onAltitudeChange).toHaveBeenCalledWith(0.35)
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onAltitudeChange).toHaveBeenLastCalledWith(0)

    cleanup()
    const bad = render(<BallHopper altitude={Number.NaN} spin={Number.NaN} restitution={Number.NaN} />)
    expect(Number(attr(bad.container as HTMLElement, "[data-shell]", "rx"))).toBeGreaterThan(0)
    expect(bad.container.querySelector("svg")?.getAttribute("aria-label")).toContain("Ball hopper")
  })
})

describe("ball hopper behaviours", () => {
  it("bounces, settles to rest, and skitters low", () => {
    const apex = (behavior: BallHopperBehavior, clock: number) => ballHopperPose(behavior, clock).altitude

    // A settle is one whole sequence per cycle: high early, dead by the end.
    expect(apex("settle", 0.08)).toBeGreaterThan(0.2)
    const end = ballHopperPose("settle", 0.95)
    expect(end.resting).toBe(true)
    expect(end.contact).toBe(true)

    // Skittering never gets far off the ground; bouncing does.
    for (const clock of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(apex("skitter", clock)).toBeLessThan(0.2)
    }
    expect(Math.max(...[0.3, 0.5, 0.7].map((clock) => apex("bounce", clock)))).toBeGreaterThan(0.4)

    expect(ballHopperPose("static", 0.2)).toEqual(ballHopperPose("static", 0.9))
    expect(Number.isFinite(ballHopperPose("bounce", Number.NaN).altitude)).toBe(true)
  })
})

describe("grabbing a bouncing machine", () => {
  /** jsdom has no layout, so the box the drag maps into has to be declared. */
  const box = (svg: SVGSVGElement) => {
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    svg.setPointerCapture = () => {}
    svg.releasePointerCapture = () => {}
  }

  it("loads the hopper's spring under the pointer and reports it", () => {
    const onCompressionChange = vi.fn()
    const { container } = render(<SpringHopper interactive onCompressionChange={onCompressionChange} />)
    const svg = container.querySelector("svg") as SVGSVGElement
    box(svg)

    // Down the frame is load: 0.3 of the height is free, 0.8 is fully loaded.
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 110, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 160, pointerId: 1 })

    expect(onCompressionChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
    expect(attr(container, "[data-hopper]", "data-contact")).toBe("stance")
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })

  it("lifts the ball under the pointer and reports it", () => {
    const onAltitudeChange = vi.fn()
    const { container } = render(<BallHopper interactive onAltitudeChange={onAltitudeChange} />)
    const svg = container.querySelector("svg") as SVGSVGElement
    box(svg)

    fireEvent.pointerDown(svg, { clientX: 100, clientY: 160, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 40, pointerId: 1 })

    expect(onAltitudeChange).toHaveBeenLastCalledWith(1)
    expect(attr(container, "[data-ball]", "data-contact")).toBe("flight")
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })

  it("parks both loops when the visitor asks for less motion, without losing the controls", () => {
    const reduced = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.stubGlobal("matchMedia", reduced)
    const frames = vi.spyOn(window, "requestAnimationFrame")

    const hopper = render(<SpringHopper interactive behavior="hop" phase={0.4} />)
    const ball = render(<BallHopper interactive behavior="bounce" phase={0.4} />)

    // Parked means no loop is scheduled at all, and the machine is left at the
    // pose its phase names — which at 0.4 of either cycle is the airborne half.
    expect(frames).not.toHaveBeenCalled()
    expect(attr(hopper.container, "[data-hopper]", "data-contact")).toBe("flight")
    expect(attr(ball.container, "[data-ball]", "data-contact")).toBe("flight")
    // Input is not decoration: it still works.
    expect(hopper.container.querySelector("svg")?.getAttribute("tabindex")).toBe("0")
    expect(ball.container.querySelector("svg")?.getAttribute("role")).toBe("slider")
    vi.unstubAllGlobals()
  })
})
