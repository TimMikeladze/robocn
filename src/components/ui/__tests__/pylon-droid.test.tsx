import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PylonDroid, pylonDroidPose } from "@/components/ui/pylon-droid"

afterEach(cleanup)

describe("pylon droid", () => {
  it("stands the plate up: chassis, cap, legs and strut all ride deploy", () => {
    const { container, rerender } = render(<PylonDroid deploy={0} animate={false} />)
    const chassis = container.querySelector("[data-chassis]")!.getAttribute("transform")
    const cap = container.querySelector("[data-cap]")!.getAttribute("transform")
    const leg = container.querySelector('[data-leg="left"] path')!.getAttribute("d")
    const strut = container.querySelector("[data-strut] path")!.getAttribute("d")

    rerender(<PylonDroid deploy={1} animate={false} />)

    expect(container.querySelector("[data-chassis]")!.getAttribute("transform")).not.toBe(chassis)
    expect(container.querySelector("[data-cap]")!.getAttribute("transform")).not.toBe(cap)
    expect(container.querySelector('[data-leg="left"] path')!.getAttribute("d")).not.toBe(leg)
    expect(container.querySelector("[data-strut] path")!.getAttribute("d")).not.toBe(strut)
  })

  it("keeps every limb inside the triangle while it is stowed", () => {
    const { container } = render(<PylonDroid deploy={0} animate={false} stance="wide" />)
    const feet = [...container.querySelectorAll("[data-foot]")].map((node) =>
      node.getAttribute("data-y"),
    )
    // Stowed feet are tucked up off the ground, not standing on it.
    for (const y of feet) expect(Number(y)).toBeGreaterThan(0)
    // The waist is shut, so the core is there but nothing of it is lit.
    expect(container.querySelector("[data-core]")).not.toBeNull()
    expect(container.querySelectorAll("[data-grille] [data-lit]")).toHaveLength(0)
  })

  it("lights the core as the waist opens", () => {
    const { container } = render(<PylonDroid deploy={1} animate={false} />)
    expect(container.querySelectorAll("[data-grille] [data-lit]").length).toBeGreaterThan(0)
  })

  it("names its state, deployment and view, and reads back as a slider", () => {
    const { getByRole, rerender } = render(
      <PylonDroid deploy={0.5} animate={false} interactive={false} view="iso" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Pylon droid")
    expect(label).toContain("50 percent")
    expect(label).toContain("isometric")

    rerender(<PylonDroid deploy={0.25} animate={false} interactive />)

    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
  })

  it("deploys from the keyboard and reports every change", () => {
    const onDeployChange = vi.fn()
    const { getByRole } = render(
      <PylonDroid deploy={0.5} animate={false} onDeployChange={onDeployChange} />,
    )
    const slider = getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowUp" })
    expect(onDeployChange).toHaveBeenLastCalledWith(0.6)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onDeployChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onDeployChange).toHaveBeenLastCalledWith(1)
  })

  it("renders a neutral machine from invalid input", () => {
    const { container, getByRole } = render(
      <PylonDroid
        animate={false}
        deploy={Number.NaN}
        speed={Number.NaN}
        look={{ x: Number.NaN, y: Number.NaN }}
        // @ts-expect-error a stale union value from a consumer must degrade, not throw
        stance="sideways"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("slider").getAttribute("aria-label")).toContain("Pylon droid")
  })

  it("takes a colour override", () => {
    const { container } = render(<PylonDroid deploy={1} animate={false} color="#ff00aa" />)
    expect(container.innerHTML).toContain("#ff00aa")
  })

  it("keeps the behaviour sampler inside its own limits", () => {
    for (const behavior of ["deploy", "survey", "stow", "static"] as const) {
      for (let clock = 0; clock < 4; clock += 0.125) {
        const pose = pylonDroidPose(behavior, clock)
        expect(pose.deploy).toBeGreaterThanOrEqual(0)
        expect(pose.deploy).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.pan)).toBeLessThanOrEqual(1)
      }
    }
    // The duty cycle stands up, holds, and sits back down inside one turn.
    expect(pylonDroidPose("deploy", 0).deploy).toBe(0)
    expect(pylonDroidPose("deploy", 0.5).deploy).toBe(1)
    expect(pylonDroidPose("deploy", 0.98).deploy).toBe(0)
    // Whole cycles repeat in both directions.
    expect(pylonDroidPose("deploy", 2.4).deploy).toBeCloseTo(pylonDroidPose("deploy", 0.4).deploy)
    expect(pylonDroidPose("deploy", -1.6).deploy).toBeCloseTo(pylonDroidPose("deploy", 0.4).deploy)
    expect(pylonDroidPose("survey", 0.3).deploy).toBeGreaterThan(0.8)
    expect(pylonDroidPose("stow", 0.3).deploy).toBeLessThan(0.1)
    expect(pylonDroidPose("survey", Number.NaN)).toEqual(pylonDroidPose("survey", 0))
  })
})
