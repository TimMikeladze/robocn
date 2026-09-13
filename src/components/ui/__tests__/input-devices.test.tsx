import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { KeySwitch, keySwitchGoal } from "@/components/ui/key-switch"

afterEach(cleanup)

const shape = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

const at = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("transform")

describe("key switch", () => {
  it("drives the stem down its travel and compresses the spring with it", () => {
    const { container, rerender } = render(<KeySwitch press={0} />)
    const rest = at(container, "[data-stem]")
    const spring = shape(container, "[data-spring]")
    expect(container.querySelector("[data-switch]")!.getAttribute("data-press")).toBe("0")

    rerender(<KeySwitch press={1} />)

    expect(at(container, "[data-stem]")).not.toBe(rest)
    expect(shape(container, "[data-spring]")).not.toBe(spring)
    expect(container.querySelector("[data-switch]")!.getAttribute("data-press")).toBe("1")
    expect(container.querySelector("[data-keycap]")).not.toBeNull()
  })

  it("closes the contact partway down rather than at the bottom", () => {
    const closed = (press: number) => {
      const { container } = render(<KeySwitch press={press} travel={4} actuation={2} />)
      const state = container.querySelector("[data-contact]")!.getAttribute("data-closed")
      cleanup()
      return state
    }
    expect(closed(0)).toBe("false")
    expect(closed(0.4)).toBe("false")
    expect(closed(0.55)).toBe("true")
    // Still closed with travel left to give.
    expect(closed(0.7)).toBe("true")
  })

  it("holds the contact through the hysteresis band once it has closed", () => {
    // Down to the actuation point closes it; easing back to a press that would
    // not have closed it leaves it closed, because the leaf resets higher up.
    const { container, rerender } = render(<KeySwitch press={0} travel={4} actuation={2} />)
    expect(container.querySelector("[data-contact]")!.getAttribute("data-closed")).toBe("false")

    rerender(<KeySwitch press={0.6} travel={4} actuation={2} />)
    expect(container.querySelector("[data-contact]")!.getAttribute("data-closed")).toBe("true")

    rerender(<KeySwitch press={0.45} travel={4} actuation={2} />)
    expect(container.querySelector("[data-contact]")!.getAttribute("data-closed")).toBe("true")

    // Below the reset point it opens again.
    rerender(<KeySwitch press={0.2} travel={4} actuation={2} />)
    expect(container.querySelector("[data-contact]")!.getAttribute("data-closed")).toBe("false")
  })

  it("reports the contact closing, not every frame of the travel", () => {
    const onActuatedChange = vi.fn()
    const { rerender } = render(<KeySwitch press={0} onActuatedChange={onActuatedChange} />)
    expect(onActuatedChange).not.toHaveBeenCalled()

    rerender(<KeySwitch press={0.7} onActuatedChange={onActuatedChange} />)
    expect(onActuatedChange).toHaveBeenCalledWith(true)

    rerender(<KeySwitch press={0.9} onActuatedChange={onActuatedChange} />)
    expect(onActuatedChange).toHaveBeenCalledTimes(1)

    rerender(<KeySwitch press={0} onActuatedChange={onActuatedChange} />)
    expect(onActuatedChange).toHaveBeenLastCalledWith(false)
  })

  it("changes the leg for a tactile bump and adds a jacket only for a clicky one", () => {
    const { container, rerender } = render(<KeySwitch press={0.3} action="linear" />)
    const linear = shape(container, "[data-leg]")
    expect(container.querySelector("[data-jacket]")).toBeNull()

    rerender(<KeySwitch press={0.3} action="tactile" />)
    expect(shape(container, "[data-leg]")).not.toBe(linear)
    expect(container.querySelector("[data-jacket]")).toBeNull()

    rerender(<KeySwitch press={0.3} action="clicky" />)
    expect(container.querySelector("[data-jacket]")).not.toBeNull()
  })

  it("scales the travel it draws with the travel it is given", () => {
    const { container, rerender } = render(<KeySwitch press={1} travel={2} />)
    const short = at(container, "[data-stem]")
    rerender(<KeySwitch press={1} travel={6} />)
    expect(at(container, "[data-stem]")).not.toBe(short)
  })

  it("shows the section from a camera that can see it, and the solids from one that cannot", () => {
    const { container, rerender } = render(<KeySwitch press={0.3} view="profile" />)
    expect(container.querySelector("[data-spring]")).not.toBeNull()
    expect(container.querySelector("[data-solid]")).toBeNull()

    // Edge on, the cutaway plane is a line: the switch is drawn as its solids.
    rerender(<KeySwitch press={0.3} view="front" />)
    expect(container.querySelector("[data-spring]")).toBeNull()
    expect(container.querySelector("[data-solid]")).not.toBeNull()
  })

  it("names the view and the state it is in", () => {
    const { container, getByRole, rerender } = render(<KeySwitch press={0.8} view="iso" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(getByRole("img").getAttribute("aria-label")).toContain("closed")
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")

    rerender(<KeySwitch press={0} view="iso" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("open")
  })

  it("is a slider you can press by hand, and arrow keys move it", () => {
    const onPressChange = vi.fn()
    const { getByRole } = render(<KeySwitch interactive onPressChange={onPressChange} press={0.5} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("0.5")
    expect(slider.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(slider, { key: "End" })
    expect(onPressChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(slider, { key: "Home" })
    expect(onPressChange).toHaveBeenLastCalledWith(0)
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <KeySwitch press={Number.NaN} travel={Number.NaN} actuation={Number.NaN} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs the stroke from the clock and parks up when static", () => {
    expect(keySwitchGoal("static", 0.4)).toBe(0)
    expect(keySwitchGoal("tap", Number.NaN)).toBe(0)
    expect(keySwitchGoal("tap", 0)).toBe(0)
    // Down early in the stroke, back up by the end of it.
    expect(keySwitchGoal("tap", 0.25)).toBeCloseTo(1, 6)
    expect(keySwitchGoal("tap", 0.95)).toBeLessThan(0.2)
    expect(keySwitchGoal("tap", 0.3)).toBeCloseTo(keySwitchGoal("tap", 1.3), 6)
    // Flutter works the band round the actuation point without leaving it.
    for (const t of [0, 0.12, 0.37, 0.66, 0.91]) {
      expect(keySwitchGoal("flutter", t)).toBeGreaterThan(0.35)
      expect(keySwitchGoal("flutter", t)).toBeLessThan(0.65)
    }
    // Hold sits at the bottom for most of the cycle.
    expect(keySwitchGoal("hold", 0.5)).toBe(1)
    expect(keySwitchGoal("hold", 0.98)).toBeLessThan(0.5)
  })
})
