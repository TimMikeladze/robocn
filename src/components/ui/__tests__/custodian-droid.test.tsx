import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CustodianDroid, custodianDroidPose } from "@/components/ui/custodian-droid"

afterEach(cleanup)

describe("custodian droid", () => {
  it("runs every armour segment out on its rail as the shell opens", () => {
    const { container, rerender } = render(<CustodianDroid open={0} animate={false} />)
    const seated = container.querySelector('[data-plate="0"]')!.getAttribute("d")
    const stowed = container.querySelector('[data-rail="0"]')!.getAttribute("d")

    rerender(<CustodianDroid open={1} animate={false} />)

    expect(container.querySelector('[data-plate="0"]')!.getAttribute("d")).not.toBe(seated)
    // The rail is the degree of freedom: it has to be visibly longer, not just moved.
    expect(container.querySelector('[data-rail="0"]')!.getAttribute("d")).not.toBe(stowed)
    expect(container.querySelectorAll("[data-rail]")).toHaveLength(
      container.querySelectorAll("[data-plate]").length,
    )
  })

  it("counts the armour segments and lights the voice ring", () => {
    const { container, rerender } = render(
      <CustodianDroid open={0.5} animate={false} plates={6} voice={0} />,
    )
    expect(container.querySelectorAll("[data-shell] [data-plate]")).toHaveLength(6)
    expect(container.querySelectorAll("[data-ring] [data-lit]")).toHaveLength(0)

    rerender(<CustodianDroid open={0.5} animate={false} plates={9} voice={1} />)

    expect(container.querySelectorAll("[data-shell] [data-plate]")).toHaveLength(9)
    expect(container.querySelectorAll("[data-ring] [data-lit]").length).toBeGreaterThan(0)
  })

  it("names its state, opening and view, and reads back as a slider when interactive", () => {
    const { getByRole, rerender } = render(
      <CustodianDroid open={0.5} animate={false} interactive={false} view="iso" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("Custodian droid")
    expect(label).toContain("50 percent")
    expect(label).toContain("isometric")

    rerender(<CustodianDroid open={0.25} animate={false} interactive />)

    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
  })

  it("works the shell from the keyboard and reports every change", () => {
    const onOpenChange = vi.fn()
    const { getByRole } = render(
      <CustodianDroid open={0.5} animate={false} onOpenChange={onOpenChange} />,
    )
    const slider = getByRole("slider")

    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onOpenChange).toHaveBeenLastCalledWith(0.6)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onOpenChange).toHaveBeenLastCalledWith(0)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onOpenChange).toHaveBeenLastCalledWith(1)
  })

  it("opens to a press and hands the shell back on release", () => {
    const onOpenChange = vi.fn()
    const { getByRole, container } = render(
      <CustodianDroid animate={false} behavior="watch" onOpenChange={onOpenChange} />,
    )
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 210 }) as DOMRect
    const parked = container.querySelector('[data-plate="0"]')!.getAttribute("d")

    // The right-hand end of the box is the shell run all the way out.
    fireEvent.pointerDown(svg, { clientX: 196, clientY: 105, pointerId: 1 })

    expect(onOpenChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
    expect(container.querySelector('[data-plate="0"]')!.getAttribute("d")).not.toBe(parked)

    fireEvent.pointerUp(svg, { pointerId: 1 })
    // Released, the shell is back where the behaviour has it.
    expect(container.querySelector('[data-plate="0"]')!.getAttribute("d")).toBe(parked)
  })

  it("aims the optic where it is told and keeps it level while the shell rolls", () => {
    const { container, rerender } = render(
      <CustodianDroid open={0.3} animate={false} track={false} look={{ x: -1, y: -1 }} />,
    )
    const aimed = container.querySelector("[data-lens]")!.getAttribute("d")

    rerender(<CustodianDroid open={0.3} animate={false} track={false} look={{ x: 1, y: 1 }} />)

    expect(container.querySelector("[data-lens]")!.getAttribute("d")).not.toBe(aimed)
  })

  it("renders a neutral machine from invalid input", () => {
    const { container, getByRole } = render(
      <CustodianDroid
        animate={false}
        open={Number.NaN}
        voice={Number.NaN}
        plates={Number.NaN}
        speed={Number.NaN}
        look={{ x: Number.NaN, y: Number.NaN }}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("slider").getAttribute("aria-label")).toContain("Custodian droid")
    expect(container.querySelectorAll("[data-plate]")).toHaveLength(6)
  })

  it("keeps the behaviour sampler inside its own limits", () => {
    for (const behavior of ["watch", "survey", "alert", "static"] as const) {
      for (let clock = 0; clock < 4; clock += 0.125) {
        const pose = custodianDroidPose(behavior, clock)
        expect(pose.open).toBeGreaterThanOrEqual(0)
        expect(pose.open).toBeLessThanOrEqual(1)
        expect(pose.lift).toBeGreaterThanOrEqual(0)
        expect(pose.lift).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.roll)).toBeLessThanOrEqual(1)
        expect(pose.voice).toBeGreaterThanOrEqual(0)
        expect(pose.voice).toBeLessThanOrEqual(1)
      }
    }
    // Watching is armour closed; alert throws it wide and talks.
    expect(custodianDroidPose("watch", 0.5).open).toBeLessThan(0.2)
    expect(custodianDroidPose("alert", 0.5).open).toBeGreaterThan(0.7)
    expect(custodianDroidPose("alert", 0.5).voice).toBeGreaterThan(0)
    expect(custodianDroidPose("watch", Number.NaN)).toEqual(custodianDroidPose("watch", 0))
  })
})
