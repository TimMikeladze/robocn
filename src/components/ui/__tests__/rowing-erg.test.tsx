import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { RowingErg, rowingErgPhase, rowingErgTempo } from "@/components/ui/rowing-erg"

afterEach(cleanup)

const label = (container: HTMLElement) =>
  container.querySelector("svg")!.getAttribute("aria-label")!
const num = (container: HTMLElement, selector: string, attribute: string) =>
  Number(container.querySelector(selector)!.getAttribute(attribute))

describe("rowing-erg", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<RowingErg animate={false} strokePhase={0} />)
    const catchAt = num(container, "[data-handle]", "data-x")

    rerender(<RowingErg animate={false} strokePhase={0.35} />)

    expect(num(container, "[data-handle]", "data-x")).toBeGreaterThan(catchAt)
    expect(num(container, "[data-seat]", "data-x")).toBeGreaterThan(0)
  })

  it("takes the drag factor from the vent and reports it", () => {
    const at = (vent: number) => {
      const { container, unmount } = render(<RowingErg animate={false} strokePhase={0.3} vent={vent} />)
      const value = {
        drag: num(container, "[data-vent]", "data-drag-factor"),
        label: label(container),
      }
      unmount()
      return value
    }

    expect(at(1).drag).toBeGreaterThan(at(0).drag)
    expect(at(0.5).label).toMatch(/damper vent 50 percent for a drag factor of/)
    expect(at(0.5).label).toMatch(/strokes a minute/)
  })

  it("engages the clutch on the drive and coasts on the recovery", () => {
    const engaged = (strokePhase: number) => {
      const { container, unmount } = render(<RowingErg animate={false} strokePhase={strokePhase} />)
      const value = container.querySelector("[data-chain]")!.hasAttribute("data-engaged")
      unmount()
      return value
    }

    expect(engaged(0.2)).toBe(true)
    expect(engaged(0.8)).toBe(false)
  })

  it("turns the fan by the wheel's own speed, not by the clock", () => {
    const spin = (strokePhase: number) => {
      const { container, unmount } = render(<RowingErg animate={false} strokePhase={strokePhase} />)
      const value = num(container, "[data-flywheel]", "data-spin")
      unmount()
      return value
    }

    // The wheel is spun up through the drive and coasts afterwards, so equal
    // slices of the stroke are very unequal slices of the turning.
    const drive = spin(0.3) - spin(0.15)
    const recovery = spin(0.9) - spin(0.75)
    expect(drive).toBeGreaterThan(0)
    expect(recovery).toBeGreaterThan(0)
    expect(drive).toBeGreaterThan(recovery * 1.5)
  })

  it("finds the window where the handle and the seat travel opposite ways", () => {
    const opposedAt = (strokePhase: number) => {
      const { container, unmount } = render(<RowingErg animate={false} strokePhase={strokePhase} />)
      const value = container.querySelector("[data-travel]")!.hasAttribute("data-opposed")
      unmount()
      return value
    }

    // At the catch the slide is still coming forward while the chain has gone
    // taut; by mid-drive both are going the same way.
    expect(opposedAt(0.02)).toBe(true)
    expect(opposedAt(0.25)).toBe(false)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <RowingErg animate={false} strokePhase={Number.NaN} vent={Number.NaN} speed={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<RowingErg animate={false} />)
    expect(label(container)).toMatch(/Rowing erg/i)

    rerender(<RowingErg animate={false} view="iso" />)
    expect(label(container)).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<RowingErg animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(rowingErgPhase("static", 0.4)).toBe(0.32)
    expect(rowingErgPhase("row", Number.NaN)).toBe(0.32)
    // Unwrapped, so the easing never has to cross a seam backwards.
    expect(rowingErgPhase("row", 2)).toBeGreaterThan(rowingErgPhase("row", 1))
    // Sprinting is a faster rate, not a different shape — which is why it is
    // heavier: the drag factor is the vent's, and the force goes as speed².
    expect(rowingErgTempo("sprint")).toBeGreaterThan(rowingErgTempo("row"))
    expect(rowingErgTempo("paddle")).toBeLessThan(rowingErgTempo("row"))
    expect(rowingErgPhase("sprint", 1)).toBeCloseTo(rowingErgTempo("sprint"), 9)
  })

  it("makes the handle heavier at a higher rate, on the same drag factor", () => {
    const at = (speed: number) => {
      const { container, unmount } = render(
        <RowingErg animate={false} strokePhase={0.22} speed={speed} />,
      )
      const value = {
        drag: num(container, "[data-vent]", "data-drag-factor"),
        wheel: num(container, "[data-flywheel]", "data-speed"),
      }
      unmount()
      return value
    }

    expect(at(0.8).wheel).toBeGreaterThan(at(0.4).wheel)
    expect(at(0.8).drag).toBeCloseTo(at(0.4).drag, 9)
  })
})
