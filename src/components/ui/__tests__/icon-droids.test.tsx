import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AstromechDroid, astromechDroidPose } from "@/components/ui/astromech-droid"
import { AttendantDroid, attendantDroidPose } from "@/components/ui/attendant-droid"
import { CasingDroid, casingDroidPose } from "@/components/ui/casing-droid"
import { px } from "@/lib/robocn/style"
import { CyberTrooper, cyberTrooperPose } from "@/components/ui/cyber-trooper"

describe("icon-archetype droids", () => {
  it("swings the casing eyestalk with the dome and swaps the manipulator", () => {
    const { container, getByRole, rerender } = render(
      <CasingDroid domeAngle={0} eyeElevation={0} manipulator="suction" />,
    )
    const stalk = container.querySelector("[data-eyestalk]")!.getAttribute("transform")

    rerender(<CasingDroid domeAngle={70} eyeElevation={20} manipulator="clamp" />)

    expect(container.querySelector("[data-eyestalk]")!.getAttribute("transform")).not.toBe(stalk)
    expect(container.querySelector('[data-manipulator="clamp"]')).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("Casing droid")
  })

  it("wraps casing heading and clamps hemisphere rows", () => {
    const { container } = render(<CasingDroid domeAngle={0} hemisphereRows={9} />)
    const rows = container.querySelectorAll("[data-skirt] circle").length

    const wrapped = render(<CasingDroid domeAngle={360} hemisphereRows={4} />)

    // 360° is the same heading as 0°, and nine rows is clamped to the same four.
    expect(wrapped.container.querySelector("[data-dome]")!.getAttribute("transform")).toBe(
      container.querySelector("[data-dome]")!.getAttribute("transform"),
    )
    expect(wrapped.container.querySelectorAll("[data-skirt] circle").length).toBe(rows)
  })

  it("changes astromech ride height, dome aim, and deployed instrument", () => {
    const { container, rerender } = render(
      <AstromechDroid legMode="tripod" domeAngle={0} panel={false} tool="none" holo={0} />,
    )
    const body = container.querySelector("[data-body]")!.getAttribute("transform")
    const eye = container.querySelector("[data-eye]")!.getAttribute("cx")
    expect(container.querySelector("[data-holo]")).toBeNull()

    rerender(<AstromechDroid legMode="bipod" domeAngle={80} panel tool="welder" holo={0.9} />)

    expect(container.querySelector("[data-body]")!.getAttribute("transform")).not.toBe(body)
    expect(container.querySelector("[data-eye]")!.getAttribute("cx")).not.toBe(eye)
    expect(container.querySelector('[data-panel="open"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="welder"]')).not.toBeNull()
    expect(container.querySelector("[data-holo]")).not.toBeNull()
  })

  it("raises the astromech periscope from the dome without opening the panel", () => {
    const { container } = render(<AstromechDroid tool="periscope" panel={false} />)
    expect(container.querySelector('[data-dome] [data-tool="periscope"]')).not.toBeNull()
  })

  it("poses the attendant droid and strips its plating back to the loom", () => {
    const { container, rerender } = render(
      <AttendantDroid pose="attention" plating="full" speaking={false} />,
    )
    const arm = container.querySelector('[data-arm="right"]')!.getAttribute("transform")
    expect(container.querySelector('[data-loom="torso"]')).toBeNull()

    rerender(<AttendantDroid pose="alarm" plating="bare" speaking />)

    expect(container.querySelector('[data-arm="right"]')!.getAttribute("transform")).not.toBe(arm)
    expect(container.querySelector('[data-plating="bare"]')).not.toBeNull()
    expect(container.querySelector('[data-loom="torso"]')).not.toBeNull()
    expect(container.querySelectorAll("[data-joint]").length).toBeGreaterThanOrEqual(6)
  })

  it("marches the cyber trooper and bounds its power meter", () => {
    const { container, rerender } = render(
      <CyberTrooper pose="stand" chestUnit="bar" power={0} handles />,
    )
    const frame = container.querySelector("[data-frame]")!.getAttribute("transform")
    const empty = Number(container.querySelector("[data-power]")!.getAttribute("width"))
    expect(container.querySelector('[data-handle="left"]')).not.toBeNull()

    rerender(<CyberTrooper pose="march" chestUnit="core" power={5} handles={false} />)

    const full = Number(container.querySelector("[data-power]")!.getAttribute("width"))
    expect(container.querySelector("[data-frame]")!.getAttribute("transform")).not.toBe(frame)
    expect(full).toBeGreaterThan(empty)
    expect(full).toBeLessThanOrEqual(28)
    expect(container.querySelector('[data-chest="core"]')).not.toBeNull()
    expect(container.querySelector('[data-handle="left"]')).toBeNull()
  })

  it("falls back to a finite pose when given non-numeric input", () => {
    const { container } = render(<CyberTrooper headAngle={Number.NaN} power={Number.NaN} />)
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).toBe(
      "translate(0 -172) rotate(0)",
    )
    expect(container.querySelector("[data-power]")!.getAttribute("width")).toBe("1")
  })

  it("rebuilds casing hardware from the shape props", () => {
    const { container, rerender } = render(
      <CasingDroid dome="round" collar="slats" lamps="pair" emitter="array" hemisphereColumns={4} neckRings={3} />,
    )
    expect(container.querySelector('[data-dome-shape="round"]')).not.toBeNull()
    expect(container.querySelectorAll("[data-lamp]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-neck-ring]")).toHaveLength(3)
    const studs = container.querySelectorAll("[data-skirt] circle").length

    rerender(
      <CasingDroid dome="faceted" collar="mesh" lamps="quad" emitter="dish" hemisphereColumns={6} neckRings={5} />,
    )

    expect(container.querySelector('[data-dome-shape="faceted"]')).not.toBeNull()
    expect(container.querySelector('[data-collar="mesh"]')).not.toBeNull()
    expect(container.querySelector('[data-emitter="dish"]')).not.toBeNull()
    expect(container.querySelectorAll("[data-lamp]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-neck-ring]")).toHaveLength(5)
    expect(container.querySelectorAll("[data-skirt] circle").length).toBeGreaterThan(studs)
  })

  it("clamps casing counts and stalk reach instead of drawing nothing", () => {
    const { container } = render(
      <CasingDroid hemisphereColumns={99} neckRings={-4} stalkLength={12} lamps="none" emitter="none" />,
    )
    // Six studs per row is the cap; two rings is the floor.
    expect(container.querySelectorAll("[data-neck-ring]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-lamp]")).toHaveLength(0)
    expect(container.querySelector("[data-emitter]")).toBeNull()
    const stalk = container.querySelector("[data-eyestalk] rect")!.getAttribute("width")
    expect(Number(stalk)).toBeLessThanOrEqual(px(28 * 1.8))
  })

  it("rebuilds astromech hardware from the shape props", () => {
    const { container, rerender } = render(
      <AstromechDroid dome="round" livery="banded" feet="skid" antenna="none" ports={2} />,
    )
    expect(container.querySelectorAll("[data-port]")).toHaveLength(2)
    expect(container.querySelector("[data-antenna]")).toBeNull()
    const feet = container.querySelectorAll("[data-foot]").length

    rerender(<AstromechDroid dome="flat" livery="paneled" feet="tread" antenna="dish" ports={3} />)

    expect(container.querySelector('[data-dome-shape="flat"]')).not.toBeNull()
    expect(container.querySelector('[data-livery="paneled"]')).not.toBeNull()
    expect(container.querySelector('[data-antenna="dish"]')).not.toBeNull()
    expect(container.querySelectorAll("[data-port]")).toHaveLength(3)
    expect(container.querySelectorAll("[data-foot]").length).toBeGreaterThan(feet)
  })

  it("widens the attendant frame without moving its joints vertically", () => {
    const { container, rerender } = render(<AttendantDroid build="standard" behavior="static" />)
    const slim = container.querySelector('[data-arm="right"]')!.getAttribute("transform")!

    rerender(<AttendantDroid build="heavy" face="visor" hands="clamp" collar={false} behavior="static" />)

    const heavy = container.querySelector('[data-arm="right"]')!.getAttribute("transform")!
    expect(heavy).not.toBe(slim)
    // Build only widens: the shoulder height is unchanged.
    expect(heavy).toContain("-117")
    expect(container.querySelector('[data-face="visor"]')).not.toBeNull()
    expect(container.querySelector('[data-hand="clamp"]')).not.toBeNull()
    expect(container.querySelector("[data-collar]")).toBeNull()
  })

  it("reshapes the trooper head and shoulders", () => {
    const { container, rerender } = render(
      <CyberTrooper behavior="static" helmet="slab" visor="lamps" shoulders="pauldron" jaw />,
    )
    expect(container.querySelectorAll('[data-visor="lamps"] rect')).toHaveLength(2)
    expect(container.querySelector("[data-pauldron]")).not.toBeNull()
    expect(container.querySelector("[data-jaw]")).not.toBeNull()

    rerender(
      <CyberTrooper behavior="static" helmet="crested" visor="slit" shoulders="flush" jaw={false} build="heavy" />,
    )

    expect(container.querySelector('[data-helmet="crested"]')).not.toBeNull()
    expect(container.querySelector('[data-visor="slit"]')).not.toBeNull()
    expect(container.querySelector("[data-pauldron]")).toBeNull()
    expect(container.querySelector("[data-jaw]")).toBeNull()
    expect(container.querySelector('[data-build="heavy"]')).not.toBeNull()
  })

  it("keeps controlled values exactly as given while a behaviour is running", () => {
    const { container } = render(<CasingDroid behavior="survey" domeAngle={0} eyeElevation={0} />)
    // Controlled wins: a supplied angle renders the parked eyestalk, not the sweep.
    expect(container.querySelector("[data-eyestalk]")!.getAttribute("transform")).toBe(
      "translate(0 -6) rotate(0)",
    )
  })

  it("cuts and restores trooper power on click", () => {
    const changes: number[] = []
    const { container, getByRole } = render(
      <CyberTrooper behavior="static" onPowerChange={(value) => changes.push(value)} />,
    )

    fireEvent.pointerDown(getByRole("img"))
    expect(container.querySelector("[data-power]")!.getAttribute("width")).toBe("1")
    expect(getByRole("img").getAttribute("aria-label")).toContain("powerdown")

    fireEvent.pointerDown(getByRole("img"))
    expect(Number(container.querySelector("[data-power]")!.getAttribute("width"))).toBeGreaterThan(1)
    expect(changes).toEqual([0, 0.7])
  })

  it("steps the attendant droid on to its next pose when clicked", () => {
    const poses: string[] = []
    const { getByRole } = render(
      <AttendantDroid behavior="static" onPoseChange={(pose) => poses.push(pose)} />,
    )

    fireEvent.pointerDown(getByRole("img"))
    fireEvent.pointerDown(getByRole("img"))

    expect(poses).toEqual(["present", "bow"])
    expect(getByRole("img").getAttribute("aria-label")).toContain("bow")
  })
})

/** The behaviours are pure functions of the clock, so they sample directly. */
describe("icon-droid behaviour profiles", () => {
  it("holds each casing bearing, swings to the next, and parks when static", () => {
    expect(casingDroidPose("patrol", 0).dome).toBe(-70)
    expect(casingDroidPose("patrol", 0.7).dome).toBe(70)
    // Whole cycles repeat.
    expect(casingDroidPose("patrol", 1.7).dome).toBe(casingDroidPose("patrol", 0.7).dome)
    expect(Math.abs(casingDroidPose("survey", 0.25).dome)).toBeCloseTo(165, 5)
    expect(casingDroidPose("static", 9)).toEqual({ dome: 0, eye: 0 })
    expect(casingDroidPose("patrol", NaN).dome).toBe(-70)
  })

  it("opens the astromech panel and fades the projection through the work cycle", () => {
    expect(astromechDroidPose("work", 0).panel).toBe(false)
    expect(astromechDroidPose("work", 0.6).panel).toBe(true)
    expect(astromechDroidPose("work", 0.6).holo).toBe(1)
    expect(astromechDroidPose("work", 0).holo).toBe(0)
    expect(astromechDroidPose("static", 4)).toEqual({ dome: 0, lean: 0, panel: false, holo: 0 })
  })

  it("works the attendant through its courtesies and the trooper through its charge", () => {
    expect(attendantDroidPose("attend", 0).pose).toBe("attention")
    expect(attendantDroidPose("attend", 0.3).pose).toBe("present")
    expect(attendantDroidPose("static", 3)).toEqual({ pose: "attention", head: 0, speaking: false })

    expect(cyberTrooperPose("march", 0.1).pose).toBe("march")
    expect(cyberTrooperPose("march", 0.9).pose).toBe("stand")
    // Marching spends the reserve; standing puts it back.
    expect(cyberTrooperPose("march", 0.7).power).toBeLessThan(cyberTrooperPose("march", 0.1).power)
    expect(cyberTrooperPose("static", 2).power).toBe(0.7)
  })
})
