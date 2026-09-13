import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { KeySwitch, keySwitchGoal } from "@/components/ui/key-switch"
import { RobotKeypad, keypadGoal } from "@/components/ui/robot-keypad"
import { RobotKeyboard, keyboardGoal, keyboardRipple } from "@/components/ui/robot-keyboard"
import { InputTerminal, WORK_CANT, terminalCant, terminalTyped } from "@/components/ui/input-terminal"

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

describe("robot keypad", () => {
  it("strikes its keys one at a time as the entry runs", () => {
    const { container, rerender } = render(<RobotKeypad typed={0} code="4813" />)
    const downAt = () =>
      [...container.querySelectorAll("[data-key]")]
        .filter((key) => key.getAttribute("data-down") === "true")
        .map((key) => key.getAttribute("data-legend"))

    expect(downAt()).toEqual([])
    rerender(<RobotKeypad typed={0.19} code="4813" />)
    expect(downAt()).toEqual(["4"])
    rerender(<RobotKeypad typed={0.65} code="4813" />)
    expect(downAt()).toEqual(["3"])
  })

  it("fills one readout dot per digit the entry has taken", () => {
    const { container, rerender } = render(<RobotKeypad typed={0} code="4813" />)
    expect(container.querySelectorAll("[data-dot]")).toHaveLength(4)
    const filled = () =>
      [...container.querySelectorAll("[data-dot]")].filter(
        (dot) => dot.getAttribute("data-filled") === "true",
      ).length

    expect(filled()).toBe(0)
    rerender(<RobotKeypad typed={0.4} code="4813" />)
    expect(filled()).toBe(2)
    rerender(<RobotKeypad typed={1} code="4813" />)
    expect(filled()).toBe(4)
  })

  it("answers the entry the way it was told to, and says so", () => {
    const { container, getByRole, rerender } = render(
      <RobotKeypad typed={1} code="4813" outcome="granted" />,
    )
    expect(container.querySelector("[data-lamp]")!.getAttribute("data-state")).toBe("granted")
    expect(getByRole("img").getAttribute("aria-label")).toContain("granted")

    rerender(<RobotKeypad typed={1} code="4813" outcome="denied" />)
    expect(container.querySelector("[data-lamp]")!.getAttribute("data-state")).toBe("denied")
    // Mid-entry it has not answered anything yet.
    rerender(<RobotKeypad typed={0.3} code="4813" outcome="denied" />)
    expect(container.querySelector("[data-lamp]")!.getAttribute("data-state")).toBe("entry")
  })

  it("lays out the matrix it is asked for and scans it a row at a time", () => {
    const { container, rerender } = render(
      <RobotKeypad typed={0} rows={4} columns={3} showScan animate={false} phase={0} />,
    )
    expect(container.querySelectorAll("[data-key]")).toHaveLength(12)
    const first = container.querySelector("[data-scan]")!.getAttribute("data-row")

    rerender(<RobotKeypad typed={0} rows={4} columns={3} showScan animate={false} phase={0.6} />)
    expect(container.querySelector("[data-scan]")!.getAttribute("data-row")).not.toBe(first)

    rerender(<RobotKeypad typed={0} rows={5} columns={4} showScan animate={false} phase={0} />)
    expect(container.querySelectorAll("[data-key]")).toHaveLength(20)
  })

  it("rakes the face, and the rake is what makes a press visible head on", () => {
    const { container, rerender } = render(<RobotKeypad typed={0} rake={0} view="front" />)
    const flat = shape(container, "[data-body]")
    const restingCap = shape(container, '[data-key="0"] path')

    rerender(<RobotKeypad typed={0} rake={34} view="front" />)
    expect(shape(container, "[data-body]")).not.toBe(flat)

    // Raked, the same press moves the cap on screen; flat on the bench it barely can.
    rerender(<RobotKeypad typed={0} rake={34} view="front" />)
    const raked = shape(container, '[data-key="0"] path')
    expect(raked).not.toBe(restingCap)
  })

  it("projects a different drawing from a different camera and names it", () => {
    const { container, getByRole, rerender } = render(<RobotKeypad typed={0.5} view="front" />)
    const front = shape(container, "[data-body]")
    expect(getByRole("img").getAttribute("aria-label")).toContain("front elevation")

    rerender(<RobotKeypad typed={0.5} view="iso" />)
    expect(shape(container, "[data-body]")).not.toBe(front)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("is a slider you can scrub by hand", () => {
    const onTypedChange = vi.fn()
    const { getByRole } = render(
      <RobotKeypad interactive typed={0.5} onTypedChange={onTypedChange} />,
    )
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("0.5")
    fireEvent.keyDown(slider, { key: "Home" })
    expect(onTypedChange).toHaveBeenLastCalledWith(0)
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <RobotKeypad
        typed={Number.NaN}
        rows={Number.NaN}
        columns={Number.NaN}
        rake={Number.NaN}
        code="zz"
        color="#aabbcc"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
    expect(container.querySelectorAll("[data-key]").length).toBeGreaterThan(0)
  })

  it("runs its entry from the clock and parks at the start when static", () => {
    expect(keypadGoal("static", 0.4)).toBe(0)
    expect(keypadGoal("entry", Number.NaN)).toBe(0)
    expect(keypadGoal("idle", 0.5)).toBe(0)
    expect(keypadGoal("entry", 0.5)).toBeGreaterThan(0)
    expect(keypadGoal("entry", 0.5)).toBeCloseTo(keypadGoal("entry", 1.5), 6)
    // It works through the passage and clears again by the end of the cycle.
    expect(keypadGoal("entry", 0.8)).toBe(1)
    expect(keypadGoal("entry", 0.99)).toBe(0)
  })
})

describe("robot keyboard", () => {
  it("lays out the layout it is asked for", () => {
    const { container, rerender } = render(<RobotKeyboard typed={0} layout="compact" />)
    // A 60% deck: five rows, sixty-one keys.
    expect(container.querySelectorAll("[data-key]")).toHaveLength(61)

    rerender(<RobotKeyboard typed={0} layout="extended" />)
    expect(container.querySelectorAll("[data-key]").length).toBeGreaterThan(80)

    // The same rows, save that a 6.25u space cannot belong to one half: it
    // becomes two thumb keys, so a split board has one key more.
    rerender(<RobotKeyboard typed={0} layout="split" />)
    expect(container.querySelectorAll("[data-key]")).toHaveLength(62)
    expect(container.querySelectorAll('[data-half="left"]').length).toBeGreaterThan(20)
    expect(container.querySelectorAll('[data-half="right"]').length).toBeGreaterThan(20)
  })

  it("splays the halves apart, so the same key is not where it was", () => {
    const { container, rerender } = render(<RobotKeyboard typed={0} layout="compact" />)
    const straight = shape(container, '[data-key="0"] path')
    rerender(<RobotKeyboard typed={0} layout="split" />)
    expect(shape(container, '[data-key="0"] path')).not.toBe(straight)
  })

  it("sculpts the rows, and a flat board does not", () => {
    const { container, rerender } = render(<RobotKeyboard typed={0} profile="sculpted" />)
    const sculpted = shape(container, '[data-key="0"] path')
    rerender(<RobotKeyboard typed={0} profile="flat" />)
    expect(shape(container, '[data-key="0"] path')).not.toBe(sculpted)
  })

  it("walks the passage across the deck one key at a time", () => {
    const down = (typed: number) => {
      const { container } = render(<RobotKeyboard typed={typed} strokes={8} />)
      const keys = [...container.querySelectorAll("[data-key]")]
        .filter((key) => key.getAttribute("data-down") === "true")
        .map((key) => key.getAttribute("data-key"))
      cleanup()
      return keys
    }
    expect(down(0)).toEqual([])
    const early = down(0.12)
    const late = down(0.57)
    expect(early).toHaveLength(1)
    expect(late).toHaveLength(1)
    expect(early).not.toEqual(late)
  })

  it("ripples and scans from the clock, with nothing typed", () => {
    const { container, rerender } = render(
      <RobotKeyboard behavior="ripple" animate={false} phase={0.25} />,
    )
    const rippled = [...container.querySelectorAll("[data-key]")].filter(
      (key) => key.getAttribute("data-down") === "true",
    ).length
    expect(rippled).toBeGreaterThan(0)

    rerender(<RobotKeyboard behavior="ripple" animate={false} phase={0.75} />)
    const later = [...container.querySelectorAll("[data-key]")]
      .filter((key) => key.getAttribute("data-down") === "true")
      .map((key) => key.getAttribute("data-key"))
    expect(later.length).toBeGreaterThan(0)

    rerender(<RobotKeyboard behavior="scan" animate={false} phase={0} showScan />)
    const first = container.querySelector("[data-scan]")!.getAttribute("data-row")
    rerender(<RobotKeyboard behavior="scan" animate={false} phase={0.3} showScan />)
    expect(container.querySelector("[data-scan]")!.getAttribute("data-row")).not.toBe(first)
  })

  it("projects a different drawing from a different camera and names it", () => {
    const { container, getByRole, rerender } = render(<RobotKeyboard typed={0.3} view="iso" />)
    const iso = shape(container, "[data-body]")
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")

    rerender(<RobotKeyboard typed={0.3} view="front" />)
    expect(shape(container, "[data-body]")).not.toBe(iso)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("front")
  })

  it("is a slider you can scrub by hand", () => {
    const onTypedChange = vi.fn()
    const { getByRole } = render(
      <RobotKeyboard interactive typed={0.5} onTypedChange={onTypedChange} />,
    )
    expect(getByRole("slider").getAttribute("aria-valuenow")).toBe("0.5")
    fireEvent.keyDown(getByRole("slider"), { key: "End" })
    expect(onTypedChange).toHaveBeenLastCalledWith(1)
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <RobotKeyboard
        typed={Number.NaN}
        strokes={Number.NaN}
        rake={Number.NaN}
        color="#aabbcc"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
    expect(container.querySelectorAll("[data-key]").length).toBeGreaterThan(40)
  })

  it("runs its passage from the clock and parks at the start when static", () => {
    expect(keyboardGoal("static", 0.4)).toBe(0)
    expect(keyboardGoal("ripple", 0.4)).toBe(0)
    expect(keyboardGoal("type", Number.NaN)).toBe(0)
    expect(keyboardGoal("type", 0.5)).toBeGreaterThan(0)
    expect(keyboardGoal("type", 0.95)).toBe(1)
    expect(keyboardGoal("type", 0.4)).toBeCloseTo(keyboardGoal("type", 1.4), 6)
  })

  it("ripples as a wave that crosses the deck, not as every key at once", () => {
    // The wave is a function of where a key sits across the board.
    expect(keyboardRipple(0, 0.5)).toBe(0)
    expect(keyboardRipple(0.5, 0.45)).toBeGreaterThan(0.4)
    expect(keyboardRipple(0.5, 0.95)).toBe(0)
    expect(keyboardRipple(Number.NaN, 0.5)).toBe(0)
  })
})

describe("input terminal", () => {
  it("cants the head on its hinge and says how far", () => {
    const { container, rerender } = render(<InputTerminal cant={10} typed={0} />)
    const upright = shape(container, "[data-head] path")
    expect(container.querySelector("[data-head]")!.getAttribute("data-cant")).toBe("10")
    expect(container.querySelector("[data-hinge]")).not.toBeNull()

    rerender(<InputTerminal cant={44} typed={0} />)
    expect(shape(container, "[data-head] path")).not.toBe(upright)
    expect(container.querySelector("[data-head]")!.getAttribute("data-cant")).toBe("44")

    // It stops where the hinge stops.
    rerender(<InputTerminal cant={200} typed={0} />)
    expect(container.querySelector("[data-head]")!.getAttribute("data-cant")).toBe("45")
  })

  it("puts what the keys strike onto its own screen", () => {
    const { container, rerender } = render(<InputTerminal typed={0} cant={18} />)
    const filled = () =>
      [...container.querySelectorAll("[data-line]")].filter(
        (line) => line.getAttribute("data-filled") === "true",
      ).length

    expect(filled()).toBe(0)
    expect(container.querySelector("[data-cursor]")).not.toBeNull()

    rerender(<InputTerminal typed={0.5} cant={18} />)
    const halfway = filled()
    expect(halfway).toBeGreaterThan(0)

    rerender(<InputTerminal typed={1} cant={18} />)
    expect(filled()).toBeGreaterThan(halfway)
  })

  it("strikes its keys through the same passage", () => {
    const down = (typed: number) => {
      const { container } = render(<InputTerminal typed={typed} cant={18} />)
      const keys = [...container.querySelectorAll("[data-key]")].filter(
        (key) => key.getAttribute("data-down") === "true",
      ).length
      cleanup()
      return keys
    }
    expect(down(0)).toBe(0)
    expect(down(0.22)).toBeGreaterThan(0)
  })

  it("draws no lines at all with the screen off", () => {
    const { container, getByRole } = render(<InputTerminal typed={0.6} screen="off" cant={18} />)
    expect(container.querySelectorAll("[data-line]")).toHaveLength(0)
    expect(container.querySelector("[data-cursor]")).toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("off")
  })

  it("projects a different drawing from a different camera and names it", () => {
    const { container, getByRole, rerender } = render(<InputTerminal typed={0.3} view="front" />)
    const front = shape(container, "[data-body]")
    expect(getByRole("img").getAttribute("aria-label")).toContain("front elevation")

    rerender(<InputTerminal typed={0.3} view="profile" />)
    expect(shape(container, "[data-body]")).not.toBe(front)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("profile")
  })

  it("is a slider you can tip the head with", () => {
    const onCantChange = vi.fn()
    const { getByRole } = render(<InputTerminal interactive cant={20} onCantChange={onCantChange} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("20")
    fireEvent.keyDown(slider, { key: "End" })
    expect(onCantChange).toHaveBeenLastCalledWith(45)
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <InputTerminal cant={Number.NaN} typed={Number.NaN} lines={Number.NaN} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs both mechanisms from the clock and parks them when static", () => {
    expect(terminalCant("static", 0.4)).toBe(WORK_CANT)
    expect(terminalTyped("static", 0.4)).toBe(0)
    expect(terminalCant("session", Number.NaN)).toBe(WORK_CANT)
    expect(terminalTyped("session", Number.NaN)).toBe(0)
    // A session sets the head first, then types under it.
    expect(terminalTyped("session", 0.1)).toBe(0)
    expect(terminalTyped("session", 0.6)).toBeGreaterThan(0)
    expect(terminalTyped("session", 0.6)).toBeCloseTo(terminalTyped("session", 1.6), 6)
    // Query leaves the head where it is and just types.
    expect(terminalCant("query", 0.3)).toBe(WORK_CANT)
    expect(terminalTyped("query", 0.5)).toBeGreaterThan(0)
    // Idle types nothing.
    expect(terminalTyped("idle", 0.5)).toBe(0)
  })
})
