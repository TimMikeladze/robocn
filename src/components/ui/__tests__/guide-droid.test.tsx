import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GuideDroid, guideDroidPose } from "@/components/ui/guide-droid"

afterEach(cleanup)

describe("guide droid", () => {
  it("lifts the shell and stretches the leg springs with hover height", () => {
    const { container, rerender } = render(<GuideDroid height={0} animate={false} />)
    const shell = container.querySelector("[data-shell]")!.getAttribute("transform")
    const leg = container.querySelector('[data-leg="left"] path')!.getAttribute("d")
    const foot = container.querySelector('[data-foot="left"]')!.getAttribute("transform")

    rerender(<GuideDroid height={1} animate={false} />)

    expect(container.querySelector("[data-shell]")!.getAttribute("transform")).not.toBe(shell)
    expect(container.querySelector('[data-leg="left"] path')!.getAttribute("d")).not.toBe(leg)
    // The feet hang further below the body the harder the rotor is pulling.
    expect(container.querySelector('[data-foot="left"]')!.getAttribute("transform")).not.toBe(foot)
  })

  it("counts the rotor blades, swaps the limb linkage, and lights the grille", () => {
    const { container, rerender } = render(
      <GuideDroid height={0.5} animate={false} blades={2} limbs="coil" voice={0} />,
    )
    expect(container.querySelectorAll("[data-rotor] [data-blade]")).toHaveLength(2)
    expect(container.querySelector('[data-arm="left"]')!.getAttribute("data-limb")).toBe("coil")
    expect(container.querySelectorAll("[data-grille] [data-lit]")).toHaveLength(0)

    rerender(<GuideDroid height={0.5} animate={false} blades={5} limbs="strut" voice={1} />)

    expect(container.querySelectorAll("[data-rotor] [data-blade]")).toHaveLength(5)
    expect(container.querySelector('[data-arm="left"]')!.getAttribute("data-limb")).toBe("strut")
    expect(container.querySelectorAll("[data-grille] [data-lit]").length).toBeGreaterThan(0)
  })

  it("names its state, height and view, and reads back as a slider when interactive", () => {
    const { getByRole, rerender } = render(
      <GuideDroid height={0.5} animate={false} interactive={false} view="iso" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Guide droid")
    expect(label).toContain("50 percent")
    expect(label).toContain("isometric")

    rerender(<GuideDroid height={0.25} animate={false} interactive />)

    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
  })

  it("flies from the keyboard and reports every change", () => {
    const onHeightChange = vi.fn()
    const { getByRole } = render(
      <GuideDroid height={0.5} animate={false} onHeightChange={onHeightChange} />,
    )
    const slider = getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowUp" })
    expect(onHeightChange).toHaveBeenLastCalledWith(0.6)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onHeightChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onHeightChange).toHaveBeenLastCalledWith(1)
  })

  it("flies to a press and lets go of it on release", () => {
    const onHeightChange = vi.fn()
    const { getByRole, container } = render(
      <GuideDroid animate={false} behavior="settle" onHeightChange={onHeightChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 232 }) as DOMRect
    const parked = container.querySelector("[data-shell]")!.getAttribute("transform")

    // A quarter of the way down the box is the top of the envelope.
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 58, pointerId: 1 })

    expect(onHeightChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
    expect(container.querySelector("[data-shell]")!.getAttribute("transform")).not.toBe(parked)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    // Released, it is back on the behaviour's own height.
    expect(container.querySelector("[data-shell]")!.getAttribute("transform")).toBe(parked)
  })

  it("renders a neutral machine from invalid input", () => {
    const { container, getByRole } = render(
      <GuideDroid
        animate={false}
        height={Number.NaN}
        rotorAngle={Number.NaN}
        voice={Number.NaN}
        blades={Number.NaN}
        speed={Number.NaN}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("slider").getAttribute("aria-label")).toContain("Guide droid")
  })

  it("keeps the behaviour sampler inside its own limits", () => {
    for (const behavior of ["hover", "beckon", "settle", "static"] as const) {
      for (let clock = 0; clock < 4; clock += 0.125) {
        const pose = guideDroidPose(behavior, clock)
        expect(pose.lift).toBeGreaterThanOrEqual(0)
        expect(pose.lift).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.sway)).toBeLessThanOrEqual(1)
        expect(pose.voice).toBeGreaterThanOrEqual(0)
        expect(pose.voice).toBeLessThanOrEqual(1)
        expect(pose.wave).toBeGreaterThanOrEqual(0)
        expect(pose.wave).toBeLessThanOrEqual(1)
      }
    }
    // Only `beckon` talks and waves; `settle` has the weight on its feet.
    expect(guideDroidPose("beckon", 0.5).wave).toBeGreaterThan(0)
    expect(guideDroidPose("hover", 0.5).wave).toBe(0)
    expect(guideDroidPose("settle", 0.5).lift).toBeLessThan(0.2)
    expect(guideDroidPose("hover", Number.NaN)).toEqual(guideDroidPose("hover", 0))
  })
})
