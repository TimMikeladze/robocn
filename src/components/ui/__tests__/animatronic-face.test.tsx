import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AnimatronicFace, faceBehaviorDrive, faceBlink } from "@/components/ui/animatronic-face"

afterEach(cleanup)

const attr = (container: HTMLElement, selector: string, name = "d") =>
  container.querySelector(selector)!.getAttribute(name)

describe("animatronic face", () => {
  it("moves the brows, the mouth and the jaw when the expression changes", () => {
    const { container, rerender } = render(
      <AnimatronicFace track={false} behavior="static" expression="neutral" />,
    )
    const brow = attr(container, '[data-brow="left"]')
    const mouth = attr(container, "[data-mouth] path")
    const jaw = attr(container, "[data-jaw]")

    rerender(<AnimatronicFace track={false} behavior="static" expression="surprise" />)

    expect(attr(container, '[data-brow="left"]')).not.toBe(brow)
    expect(attr(container, "[data-mouth] path")).not.toBe(mouth)
    // Surprise opens the jaw, and the jaw is a hinge, so its plate moved too.
    expect(attr(container, "[data-jaw]")).not.toBe(jaw)
  })

  it("scales the same expression with intensity rather than swapping artwork", () => {
    const { container, rerender } = render(
      <AnimatronicFace track={false} behavior="static" expression="joy" intensity={1} />,
    )
    const full = attr(container, "[data-mouth] path")
    rerender(<AnimatronicFace track={false} behavior="static" expression="joy" intensity={0.25} />)
    expect(attr(container, "[data-mouth] path")).not.toBe(full)
    expect(container.querySelectorAll("[data-mouth]")).toHaveLength(1)
  })

  it("drives the two brows apart for an asymmetric expression", () => {
    const { container } = render(
      <AnimatronicFace track={false} behavior="static" expression="doubt" view="front" />,
    )
    // Front-on the head is symmetric, so any difference between the two brow
    // paths is the rig being lopsided rather than the camera.
    const left = attr(container, '[data-brow="left"]')!.replace(/-?\d+\.?\d*/g, (n) => String(Math.abs(Number(n))))
    const right = attr(container, '[data-brow="right"]')!.replace(/-?\d+\.?\d*/g, (n) => String(Math.abs(Number(n))))
    expect(left).not.toBe(right)
  })

  it("closes both lids on a controlled blink and aims the pupils from look", () => {
    const { container, rerender } = render(
      <AnimatronicFace track={false} behavior="static" blink={0} look={{ x: -1, y: -1 }} />,
    )
    const lid = attr(container, '[data-lid="left-upper"] path')
    const pupilLeft = attr(container, '[data-eye="left"] > path:nth-of-type(3)')

    rerender(<AnimatronicFace track={false} behavior="static" blink={1} look={{ x: 1, y: 1 }} />)

    expect(attr(container, '[data-lid="left-upper"] path')).not.toBe(lid)
    expect(attr(container, '[data-eye="left"] > path:nth-of-type(3)')).not.toBe(pupilLeft)
    expect(container.querySelectorAll("[data-lid]")).toHaveLength(4)
  })

  it("turns the whole head with the neck and hides the far eye in profile", () => {
    const { container, rerender } = render(
      <AnimatronicFace track={false} behavior="static" view="front" yaw={0} />,
    )
    const skull = attr(container, "[data-skull]", "rx")
    expect(container.querySelector('[data-eye="left"]')!.getAttribute("opacity")).toBe("1")

    rerender(<AnimatronicFace track={false} behavior="static" view="profile" yaw={0} />)

    expect(attr(container, "[data-skull]", "rx")).not.toBe(skull)
    // Looking from the robot's right, its left eye is round the far side.
    expect(Number(container.querySelector('[data-eye="left"]')!.getAttribute("opacity"))).toBe(0)
    expect(Number(container.querySelector('[data-eye="right"]')!.getAttribute("opacity"))).toBeGreaterThan(0)
  })

  it("draws one push-rod per servo and lights a fault when travel runs out", () => {
    const { container, rerender } = render(
      <AnimatronicFace track={false} behavior="static" expression="surprise" showActuators />,
    )
    expect(container.querySelectorAll("[data-actuator]").length).toBe(16)
    expect(container.querySelector("[data-fault]")).toBeNull()

    rerender(
      <AnimatronicFace track={false} behavior="static" expression="surprise" showActuators geometry={{ travel: 0.2 }} />,
    )
    expect(container.querySelector("[data-fault]")).not.toBeNull()
  })

  it("names the expression, takes a colour, and survives junk input", () => {
    const { container, getByRole } = render(
      <AnimatronicFace
        track={false}
        behavior="static"
        expression="sorrow"
        intensity={Number.NaN}
        yaw={Number.NaN}
        look={{ x: Number.POSITIVE_INFINITY, y: 0 }}
        color="#abcdef"
        size={280}
      />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("sorrow")
    expect(label).toContain("neck yaw 0 degrees")
    expect(container.innerHTML).toContain("#abcdef")
    expect(container.innerHTML).not.toContain("NaN")
    expect(getByRole("img").getAttribute("width")).toBe("280")
  })
})

describe("animatronic face behaviours", () => {
  it("opens the jaw only while conversing", () => {
    const talking = Array.from({ length: 40 }, (_, i) => faceBehaviorDrive("converse", i * 0.07).speech)
    expect(Math.max(...talking)).toBeGreaterThan(0.4)
    expect(faceBehaviorDrive("idle", 0.3).speech).toBe(0)
    expect(faceBehaviorDrive("listen", 0.3).speech).toBe(0)
  })

  it("parks everything on static and on junk clocks", () => {
    const parked = faceBehaviorDrive("static", 12)
    expect(parked.pose).toEqual({ yaw: 0, pitch: 0, roll: 0, heave: 0 })
    expect(parked.blink).toBe(0)
    expect(faceBehaviorDrive("idle", Number.NaN).gaze).toEqual({ x: 0, y: 0 })
  })

  it("eases emote from one expression to the next instead of cutting", () => {
    const held = faceBehaviorDrive("emote", 1.2).expression
    const easing = faceBehaviorDrive("emote", 1.85).expression
    expect(typeof held).toBe("object")
    expect(JSON.stringify(held)).not.toBe(JSON.stringify(easing))
  })

  it("blinks irregularly and never outside 0..1", () => {
    const samples = Array.from({ length: 300 }, (_, i) => faceBlink(i * 0.05))
    expect(Math.max(...samples)).toBeCloseTo(1, 1)
    expect(Math.min(...samples)).toBe(0)
    expect(samples.filter((value) => value > 0).length).toBeGreaterThan(4)
    expect(faceBlink(Number.NaN)).toBe(0)
  })
})
