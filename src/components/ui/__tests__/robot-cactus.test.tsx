import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  RobotCactus,
  cactusArmPose,
  cactusGoal,
  cactusSway,
  cactusWake,
} from "@/components/ui/robot-cactus"
import { solveCactusLimb } from "@/lib/robocn/cactus"

afterEach(cleanup)

const attribute = (container: HTMLElement, selector: string, name = "d") =>
  container.querySelector(selector)!.getAttribute(name)

describe("robot cactus", () => {
  it("lifts and curls the arms and opens the corolla on one number", () => {
    const { container, rerender } = render(
      <RobotCactus animate={false} track={false} bloom={0} />,
    )
    const arm = attribute(container, '[data-limb="left"] [data-skin]')
    const petal = attribute(container, '[data-petal="0"]')
    const column = attribute(container, '[data-limb="column"] [data-skin]')

    rerender(<RobotCactus animate={false} track={false} bloom={1} />)

    expect(attribute(container, '[data-limb="left"] [data-skin]')).not.toBe(arm)
    expect(attribute(container, '[data-petal="0"]')).not.toBe(petal)
    // The column is not driven by the flowering, only carried through it.
    expect(attribute(container, '[data-limb="column"] [data-skin]')).toBe(column)
    expect(container.querySelector("[data-flower]")!.getAttribute("data-open")).toBe("100")
  })

  it("leans the whole column toward the pointer, and carries the arms with it", () => {
    const { container, rerender } = render(
      <RobotCactus animate={false} behavior="static" look={{ x: -0.9, y: 0.4 }} />,
    )
    const left = attribute(container, '[data-limb="column"] [data-skin]')
    const arm = attribute(container, '[data-limb="left"] [data-skin]')

    rerender(<RobotCactus animate={false} behavior="static" look={{ x: 0.9, y: 0.4 }} />)

    expect(attribute(container, '[data-limb="column"] [data-skin]')).not.toBe(left)
    expect(attribute(container, '[data-limb="left"] [data-skin]')).not.toBe(arm)
  })

  it("reports the lean it is holding, which is the hook attention moves", () => {
    const { container, rerender } = render(
      <RobotCactus animate={false} behavior="static" sway={0} look={null} track={false} />,
    )
    const lean = () => container.querySelector("[data-frame]")!.getAttribute("data-lean")
    // Nothing watching and no wander: it stands up straight.
    expect(lean()).toBe("0 0")

    rerender(<RobotCactus animate={false} behavior="static" sway={0} look={{ x: 1, y: 0 }} />)
    const right = lean()!.split(" ").map(Number)
    rerender(<RobotCactus animate={false} behavior="static" sway={0} look={{ x: -1, y: 0 }} />)
    const left = lean()!.split(" ").map(Number)

    // Same amount of lean either side, on opposite bearings.
    expect(right[0]).toBeGreaterThan(1)
    expect(right[0]).toBeCloseTo(left[0], 6)
    expect(right[1]).toBeCloseTo(-left[1], 6)
  })

  it("draws the ribs, areoles and arms it was asked for", () => {
    const { container } = render(
      <RobotCactus animate={false} track={false} bloom={0.6} ribs={9} arms={4} petals={11} />,
    )
    // Facing-culled, so about half the crests of the column are drawn.
    const crests = container.querySelectorAll('[data-limb="column"] [data-rib]').length
    expect(crests).toBeGreaterThan(0)
    expect(crests).toBeLessThan(9)
    expect(container.querySelectorAll("[data-limb]")).toHaveLength(5)
    expect(container.querySelectorAll("[data-petal]")).toHaveLength(11)
    expect(container.querySelectorAll('[data-limb="column"] [data-areole]').length)
      .toBeGreaterThan(0)
  })

  it("takes the spines and the pot away when they are not wanted", () => {
    const { container } = render(
      <RobotCactus animate={false} track={false} areoles={0} spines={0} showPot={false} />,
    )
    expect(container.querySelector("[data-pot]")).toBeNull()
    expect(container.querySelector("[data-lamp]")).toBeNull()
    // The crown ring of areoles survives; none of them carries a fan.
    for (const pad of container.querySelectorAll("[data-areole]")) {
      expect(pad.querySelector("path")).toBeNull()
    }
  })

  it("is one geometry projected, not four drawings", () => {
    const { container, rerender } = render(
      <RobotCactus animate={false} track={false} bloom={0.5} view="front" />,
    )
    const front = attribute(container, '[data-limb="column"] [data-skin]')
    expect(container.querySelector("[data-frame]")!.getAttribute("data-view")).toBe("front")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      "front elevation",
    )

    rerender(<RobotCactus animate={false} track={false} bloom={0.5} view="iso" />)

    expect(attribute(container, '[data-limb="column"] [data-skin]')).not.toBe(front)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      "isometric view",
    )
  })

  it("reports the flowering while it is dragged and eases back when released", () => {
    const onBloomChange = vi.fn()
    const { container } = render(
      <RobotCactus interactive track={false} onBloomChange={onBloomChange} />,
    )
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 200, height: 212 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 53, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 53, pointerId: 1 })
    // A quarter down the frame is three quarters open: up is more.
    expect(onBloomChange).toHaveBeenCalledWith(0.75)
    fireEvent.pointerUp(svg, { pointerId: 1 })

    fireEvent.keyDown(svg, { key: "End" })
    expect(onBloomChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onBloomChange).toHaveBeenLastCalledWith(0)
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("aria-valuenow")).toBe("0")
  })

  it("is a plain image with no slider semantics when it is not interactive", () => {
    const { container } = render(<RobotCactus animate={false} track={false} />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("img")
    expect(svg.getAttribute("aria-valuenow")).toBeNull()
    expect(svg.getAttribute("aria-label")).toMatch(/^Robot cactus, flower \d+ percent open/)
  })

  it("renders a neutral machine rather than NaN for broken input", () => {
    const { container } = render(
      <RobotCactus
        animate={false}
        track={false}
        bloom={Number.NaN}
        ribs={Number.NaN}
        ribDepth={Number.POSITIVE_INFINITY}
        areoles={Number.NaN}
        spines={Number.NaN}
        arms={Number.NaN}
        petals={Number.NaN}
        sway={Number.NaN}
        look={{ x: Number.NaN, y: Number.POSITIVE_INFINITY }}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelector('[data-limb="column"] [data-skin]')).not.toBeNull()
  })

  it("takes a colour override", () => {
    const { container } = render(
      <RobotCactus animate={false} track={false} color="#ff8800" bloom={0.5} />,
    )
    expect(container.innerHTML).toContain("#ff8800")
  })
})

describe("the cactus's own numbers", () => {
  it("idles shut, runs a whole flowering, and keeps reach ajar", () => {
    expect(cactusGoal("breathe", 0)).toBeCloseTo(0.06, 9)
    expect(cactusGoal("breathe", 0.4)).toBeLessThan(0.11)
    expect(cactusGoal("flower", 0)).toBe(0)
    expect(cactusGoal("flower", 0.34)).toBe(1)
    expect(cactusGoal("flower", 0.5)).toBe(1)
    expect(cactusGoal("flower", 0.92)).toBeCloseTo(0, 9)
    // A whole cycle repeats, in both directions.
    expect(cactusGoal("flower", 1.2)).toBeCloseTo(cactusGoal("flower", 0.2), 9)
    expect(cactusGoal("flower", -0.8)).toBeCloseTo(cactusGoal("flower", 0.2), 9)
    expect(cactusGoal("reach", 0)).toBeCloseTo(0.3, 9)
    expect(cactusGoal("reach", 0.5)).toBeCloseTo(0.65, 9)
    expect(cactusGoal("static", 3.7)).toBe(0.5)
    expect(cactusGoal("flower", Number.NaN)).toBe(0)
  })

  it("raises and curls the arms together as it flowers", () => {
    const shut = cactusArmPose(0)
    const wide = cactusArmPose(1)
    expect(wide.lift).toBeGreaterThan(shut.lift)
    expect(wide.curl).toBeGreaterThan(shut.curl)
    for (const pose of [shut, wide, cactusArmPose(Number.NaN)]) {
      expect(pose.lift).toBeGreaterThanOrEqual(0)
      expect(pose.curl).toBeLessThanOrEqual(1)
    }
    // Curl is the fraction of the emergence taken back, so at 1 an arm is
    // vertical. It never quite gets there, which is what stops it looking bent
    // into a hook.
    const arm = solveCactusLimb({ emergence: 88, sweep: 88 * wide.curl })
    expect(arm.tip.angle).toBeGreaterThan(0)
    expect(arm.tip.angle).toBeLessThan(20)
  })

  it("wanders on two rates rather than ticking on one", () => {
    const a = cactusSway(0.4)
    const b = cactusSway(0.4 + Math.PI / 16)
    expect(a.x).not.toBeCloseTo(b.x, 6)
    // Both axes are bounded, and turning the wander off stops it dead.
    for (const clock of [0, 0.3, 1.7, 9]) {
      const drift = cactusSway(clock)
      expect(Math.hypot(drift.x, drift.y)).toBeLessThan(4)
      expect(Math.hypot(cactusSway(clock, 0).x, cactusSway(clock, 0).y)).toBe(0)
    }
    expect(Number.isFinite(cactusSway(Number.NaN).x)).toBe(true)
  })

  it("leans away from the side the pointer is on, and further as it comes down", () => {
    expect(cactusWake(null)).toEqual({ x: 0, y: 0 })
    expect(cactusWake({ x: 1, y: 0 }).x).toBeLessThan(0)
    expect(cactusWake({ x: -1, y: 0 }).x).toBeGreaterThan(0)
    expect(cactusWake({ x: 0, y: 1 }).y).toBeGreaterThan(cactusWake({ x: 0, y: -1 }).y)
    expect(Number.isFinite(cactusWake({ x: Number.NaN, y: 4 }).x)).toBe(true)
  })
})
