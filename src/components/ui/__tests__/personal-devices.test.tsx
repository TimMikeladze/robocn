import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ClamshellLaptop, laptopGoal } from "@/components/ui/clamshell-laptop"
import { SlateTablet, tabletGoal } from "@/components/ui/slate-tablet"
import { SlabHandset, handsetGoal } from "@/components/ui/slab-handset"
import { WheelPlayer, playerGoal } from "@/components/ui/wheel-player"
import { WristTerminal, terminalGoal } from "@/components/ui/wrist-terminal"

const shape = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

describe("clamshell laptop", () => {
  it("swings the lid on its hinge and keeps the lid's own length", () => {
    const { container, rerender } = render(<ClamshellLaptop lid={0} />)
    const shut = shape(container, "[data-lid] path")
    expect(container.querySelector("[data-lid]")!.getAttribute("data-angle")).toBe("0")

    rerender(<ClamshellLaptop lid={110} />)

    expect(shape(container, "[data-lid] path")).not.toBe(shut)
    expect(container.querySelector("[data-lid]")!.getAttribute("data-angle")).toBe("110")
    expect(container.querySelector("[data-hinge]")).not.toBeNull()
  })

  it("draws the screen only from a camera that can actually see it", () => {
    const { container, rerender } = render(
      <ClamshellLaptop lid={100} screen="code" view="front" />,
    )
    expect(container.querySelector("[data-screen]")).not.toBeNull()

    // Shut, the display is face down on the keyboard.
    rerender(<ClamshellLaptop lid={0} screen="code" view="front" />)
    expect(container.querySelector("[data-screen]")).toBeNull()

    // Side on, the display is a line. Neither is worth drawing.
    rerender(<ClamshellLaptop lid={100} screen="code" view="profile" />)
    expect(container.querySelector("[data-screen]")).toBeNull()

    // Leaned right back, a plan camera is looking straight at it.
    rerender(<ClamshellLaptop lid={135} screen="code" view="plan" />)
    expect(container.querySelector("[data-screen]")).not.toBeNull()
  })

  it("stops the lid at the travel the hinge has and says so", () => {
    const { container, getByRole } = render(<ClamshellLaptop lid={135} travel={100} />)
    expect(container.querySelector("[data-lid]")!.getAttribute("data-angle")).toBe("100")
    expect(getByRole("img").getAttribute("aria-label")).toContain("100 degrees")
  })

  it("lays the keyboard out and names the view", () => {
    const { container, getByRole } = render(<ClamshellLaptop lid={105} view="plan" />)
    expect(container.querySelectorAll("[data-key]").length).toBeGreaterThanOrEqual(40)
    expect(container.querySelector("[data-trackpad]")).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
  })

  it("projects a different drawing from a different camera", () => {
    const { container, rerender } = render(<ClamshellLaptop lid={105} view="profile" />)
    const profile = shape(container, "[data-body]")
    rerender(<ClamshellLaptop lid={105} view="iso" />)
    expect(shape(container, "[data-body]")).not.toBe(profile)
  })

  it("is a slider you can open by hand when it is interactive", () => {
    const { getByRole } = render(<ClamshellLaptop interactive lid={90} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("90")
    expect(slider.getAttribute("aria-valuemax")).toBe("135")
    expect(slider.getAttribute("tabindex")).toBe("0")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <ClamshellLaptop lid={Number.NaN} travel={Number.NaN} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs its lid from the clock, and parks shut when static", () => {
    expect(laptopGoal("static", 0.4)).toBe(0)
    expect(laptopGoal("open", Number.NaN)).toBe(0)
    expect(laptopGoal("open", 0.05)).toBeGreaterThan(0)
    expect(laptopGoal("open", 0.5)).toBeCloseTo(laptopGoal("open", 1.5), 6)
    // Working angle, then shut again by the end of the cycle.
    expect(laptopGoal("open", 0.5)).toBeGreaterThan(90)
    expect(laptopGoal("open", 0.99)).toBeLessThan(10)
    expect(laptopGoal("adjust", 0.25)).toBeGreaterThan(80)
  })
})

describe("slate tablet", () => {
  it("leans the slate back and walks the stand's foot out with it", () => {
    const { container, rerender } = render(<SlateTablet recline={0} />)
    const flat = shape(container, "[data-body]")
    const stand = shape(container, "[data-stand]")

    rerender(<SlateTablet recline={1} />)

    expect(shape(container, "[data-body]")).not.toBe(flat)
    expect(shape(container, "[data-stand]")).not.toBe(stand)
    expect(container.querySelector("[data-stand]")!.getAttribute("data-folded")).toBe("false")
  })

  it("folds a stand whose leg cannot reach the desk instead of stretching it", () => {
    const { container, getByRole } = render(<SlateTablet recline={0} leg={22} />)
    expect(container.querySelector("[data-stand]")!.getAttribute("data-folded")).toBe("true")
    expect(getByRole("img").getAttribute("aria-label")).toContain("stand folded")
  })

  it("docks the stylus only when it is asked for", () => {
    const { container, rerender } = render(<SlateTablet recline={0.6} stylus />)
    expect(container.querySelector("[data-stylus]")).not.toBeNull()
    rerender(<SlateTablet recline={0.6} stylus={false} />)
    expect(container.querySelector("[data-stylus]")).toBeNull()
  })

  it("projects a different drawing from a different camera and names it", () => {
    const { container, getByRole, rerender } = render(<SlateTablet recline={0.6} view="profile" />)
    const profile = shape(container, "[data-body]")
    rerender(<SlateTablet recline={0.6} view="plan" />)
    expect(shape(container, "[data-body]")).not.toBe(profile)
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
  })

  it("is a slider you can prop up by hand when it is interactive", () => {
    const { getByRole } = render(<SlateTablet interactive recline={0.4} />)
    expect(getByRole("slider").getAttribute("aria-valuenow")).toBe("40")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <SlateTablet recline={Number.NaN} leg={Number.NaN} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs its recline from the clock and parks upright when static", () => {
    expect(tabletGoal("static", 0.3)).toBe(0)
    expect(tabletGoal("prop", Number.NaN)).toBe(0)
    expect(tabletGoal("prop", 0.4)).toBeCloseTo(tabletGoal("prop", 1.4), 6)
    expect(tabletGoal("prop", 0.4)).toBeGreaterThan(tabletGoal("prop", 0.02))
    for (const t of [0, 0.2, 0.45, 0.7, 0.95]) {
      expect(tabletGoal("sketch", t)).toBeGreaterThanOrEqual(0)
      expect(tabletGoal("sketch", t)).toBeLessThanOrEqual(1)
    }
  })
})

describe("wheel player", () => {
  it("turns the wheel and moves the selected row with it", () => {
    const { container, rerender } = render(<WheelPlayer rotation={0} rows={8} view="front" />)
    expect(container.querySelector('[data-row="0"]')!.getAttribute("data-selected")).toBe("true")

    rerender(<WheelPlayer rotation={135} rows={8} view="front" />)

    // Eight rows, so a row every 45 degrees: 135 is row three.
    expect(container.querySelector('[data-row="3"]')!.getAttribute("data-selected")).toBe("true")
    expect(container.querySelector("[data-wheel]")!.getAttribute("data-rotation")).toBe("135")
  })

  it("wraps the list in both directions rather than running off the end", () => {
    const { container, rerender } = render(<WheelPlayer rotation={-45} rows={8} view="front" />)
    expect(container.querySelector('[data-row="7"]')!.getAttribute("data-selected")).toBe("true")
    rerender(<WheelPlayer rotation={360} rows={8} view="front" />)
    expect(container.querySelector('[data-row="0"]')!.getAttribute("data-selected")).toBe("true")
  })

  it("lights the key the thumb is on", () => {
    const { container, rerender } = render(<WheelPlayer rotation={-90} view="front" />)
    expect(container.querySelector("[data-keys]")!.getAttribute("data-segment")).toBe("menu")
    rerender(<WheelPlayer rotation={90} view="front" />)
    expect(container.querySelector("[data-keys]")!.getAttribute("data-segment")).toBe("play")
  })

  it("locks out the wheel when hold is on", () => {
    const onRotationChange = vi.fn()
    const { getByRole } = render(
      <WheelPlayer interactive locked rows={6} onRotationChange={onRotationChange} />,
    )
    const slider = getByRole("slider")
    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onRotationChange).not.toHaveBeenCalled()
    expect(slider.getAttribute("aria-disabled")).toBe("true")
    expect(slider.getAttribute("aria-label")).toContain("hold on")
  })

  it("steps one row per arrow key and reports both the angle and the row", () => {
    const onRotationChange = vi.fn()
    const onRowChange = vi.fn()
    const { getByRole } = render(
      <WheelPlayer
        interactive
        rotation={0}
        rows={6}
        onRotationChange={onRotationChange}
        onRowChange={onRowChange}
      />,
    )
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" })
    expect(onRotationChange).toHaveBeenCalledWith(60)
    expect(onRowChange).toHaveBeenCalledWith(1)
  })

  it("drops the face when the camera cannot see it, and keeps the top edge", () => {
    const { container, getByRole } = render(<WheelPlayer rotation={0} view="plan" />)
    expect(container.querySelector("[data-face]")).toBeNull()
    expect(container.querySelector("[data-top]")).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <WheelPlayer rotation={Number.NaN} rows={Number.NaN} color="#aabbcc" view="front" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs the wheel from the clock and parks it when static", () => {
    expect(playerGoal("static", 0.4)).toBe(0)
    expect(playerGoal("scroll", Number.NaN)).toBe(0)
    expect(playerGoal("scroll", 1)).toBe(360)
    expect(playerGoal("scroll", 2)).toBe(720)
    expect(playerGoal("seek", 0.25)).toBeCloseTo(150, 6)
    expect(playerGoal("seek", 0.75)).toBeCloseTo(-150, 6)
  })
})

describe("slab handset", () => {
  it("turns the slab and shows the back once it is past a half turn", () => {
    const { container, rerender } = render(<SlabHandset turn={0} view="front" />)
    const key = shape(container, '[data-button="power"]')
    expect(container.querySelector("[data-face]")).not.toBeNull()
    expect(container.querySelector("[data-rear]")).toBeNull()

    rerender(<SlabHandset turn={180} view="front" />)

    // A rectangular slab keeps its silhouette through a half turn — what
    // changes is which face is toward you and which side the keys are on.
    expect(container.querySelector("[data-body]")!.getAttribute("data-turn")).toBe("180")
    expect(shape(container, '[data-button="power"]')).not.toBe(key)
    expect(container.querySelector("[data-face]")).toBeNull()
    expect(container.querySelector("[data-camera]")).not.toBeNull()
  })

  it("turns edge on to a quarter, which narrows the silhouette", () => {
    const { container, rerender } = render(<SlabHandset turn={0} view="front" />)
    const flat = shape(container, "[data-body]")
    rerender(<SlabHandset turn={90} view="front" />)
    expect(shape(container, "[data-body]")).not.toBe(flat)
  })

  it("shows neither face edge on, a quarter turn round", () => {
    const { container } = render(<SlabHandset turn={90} view="front" />)
    expect(container.querySelector("[data-face]")).toBeNull()
    expect(container.querySelector("[data-rear]")).toBeNull()
  })

  it("re-lays the display out for the shape it is held in", () => {
    const { container, rerender } = render(<SlabHandset turn={0} orientation="portrait" view="front" />)
    const portrait = container.querySelectorAll("[data-tiles] rect").length

    rerender(<SlabHandset turn={0} orientation="landscape" view="front" />)

    // Not a rotated picture: the grid itself is a different grid.
    expect(container.querySelectorAll("[data-tiles] rect").length).not.toBe(portrait)
    expect(container.querySelector("[data-body]")!.getAttribute("d")).toBeTruthy()
  })

  it("carries its side keys and the lens count it was asked for", () => {
    const { container } = render(<SlabHandset turn={180} lenses={4} view="front" />)
    expect(container.querySelectorAll("[data-lens]")).toHaveLength(4)
    expect(container.querySelector('[data-button="power"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-button="volume"]')).toHaveLength(2)
  })

  it("names the view and reports the heading the short way round", () => {
    const { getByRole } = render(<SlabHandset turn={400} view="iso" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(getByRole("img").getAttribute("aria-label")).toContain("turned 40 degrees")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <SlabHandset turn={Number.NaN} lenses={Number.NaN} color="#aabbcc" view="front" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs its attitude from the clock and parks facing you when static", () => {
    expect(handsetGoal("static", 0.4)).toBe(0)
    expect(handsetGoal("turn", Number.NaN)).toBe(0)
    expect(handsetGoal("turn", 1)).toBe(360)
    expect(handsetGoal("nudge", 0.25)).toBeCloseTo(28, 6)
  })
})

describe("wrist terminal", () => {
  it("turns the crown and moves the dial's detent with it", () => {
    const { container, rerender } = render(<WristTerminal crown={0} ticks={12} view="front" />)
    expect(container.querySelector('[data-tick="0"]')!.getAttribute("fill")).not.toBe(
      container.querySelector('[data-tick="1"]')!.getAttribute("fill"),
    )
    const hand = shape(container, "[data-hand]")

    rerender(<WristTerminal crown={90} ticks={12} view="front" />)

    expect(shape(container, "[data-hand]")).not.toBe(hand)
    expect(container.querySelector("[data-crown]")!.getAttribute("data-rotation")).toBe("90")
  })

  it("keeps the band's link count however far it is opened", () => {
    const { container, rerender } = render(<WristTerminal crown={0} links={7} closure={1} />)
    const closed = shape(container, '[data-band="upper"] [data-link="6"]')
    expect(container.querySelectorAll('[data-band="upper"] [data-link]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-band="lower"] [data-link]')).toHaveLength(7)

    rerender(<WristTerminal crown={0} links={7} closure={0} />)

    expect(container.querySelectorAll('[data-band="upper"] [data-link]')).toHaveLength(7)
    expect(shape(container, '[data-band="upper"] [data-link="6"]')).not.toBe(closed)
  })

  it("shows only the crown ribs that are turned toward the camera", () => {
    const { container } = render(<WristTerminal crown={0} view="front" />)
    const lit = container.querySelectorAll("[data-crown] path").length
    // The barrel plus the half of twelve ribs facing you, never all twelve.
    expect(lit).toBeGreaterThan(1)
    expect(lit).toBeLessThan(13)
  })

  it("drops the face when the camera is behind it", () => {
    const { container } = render(<WristTerminal crown={0} view="plan" />)
    expect(container.querySelector("[data-face]")).toBeNull()
    expect(container.querySelector("[data-sensor]")).not.toBeNull()
  })

  it("steps one detent per arrow key", () => {
    const onCrownChange = vi.fn()
    const { getByRole } = render(
      <WristTerminal interactive crown={0} ticks={8} onCrownChange={onCrownChange} />,
    )
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" })
    expect(onCrownChange).toHaveBeenCalledWith(45)
    expect(getByRole("slider").getAttribute("aria-valuemax")).toBe("8")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <WristTerminal
        crown={Number.NaN}
        ticks={Number.NaN}
        closure={Number.NaN}
        links={Number.NaN}
        color="#aabbcc"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs the crown from the clock and parks it when static", () => {
    expect(terminalGoal("static", 0.4)).toBe(0)
    expect(terminalGoal("dial", Number.NaN)).toBe(0)
    expect(terminalGoal("dial", 1)).toBe(360)
    expect(terminalGoal("pulse", 0.25)).toBeCloseTo(90, 6)
    expect(terminalGoal("pulse", 0.75)).toBeCloseTo(-90, 6)
  })
})
