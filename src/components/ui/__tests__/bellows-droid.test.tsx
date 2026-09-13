import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { BellowsDroid, bellowsGoal, bellowsProfile } from "@/components/ui/bellows-droid"

afterEach(cleanup)

describe("bellows profile", () => {
  it("conserves volume: taller is narrower, and radius squared times height holds", () => {
    const flat = bellowsProfile(0)
    const full = bellowsProfile(1)

    expect(full.height).toBeGreaterThan(flat.height)
    expect(full.radius).toBeLessThan(flat.radius)
    for (const inflation of [0, 0.25, 0.5, 0.75, 1]) {
      const shell = bellowsProfile(inflation)
      expect(shell.radius ** 2 * shell.height).toBeCloseTo(flat.radius ** 2 * flat.height, 6)
    }
  })

  it("gathers the crown and unwinds the pleat twist as it fills", () => {
    expect(bellowsProfile(1).crown).toBeLessThan(bellowsProfile(0).crown)
    expect(bellowsProfile(1).twist).toBeLessThan(bellowsProfile(0).twist)
  })

  it("clamps out-of-range input and takes the half-inflated pose for nonsense", () => {
    expect(bellowsProfile(4).height).toBe(bellowsProfile(1).height)
    expect(bellowsProfile(-2).height).toBe(bellowsProfile(0).height)
    expect(bellowsProfile(Number.NaN).inflation).toBe(0.5)
  })
})

describe("bellows behaviours", () => {
  it("stays inside the stroke, repeats whole cycles, and parks on bad input", () => {
    for (const behavior of ["breathe", "settle", "startle", "static"] as const) {
      for (let i = 0; i <= 20; i++) {
        const value = bellowsGoal(behavior, i / 20)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      expect(bellowsGoal(behavior, 0.3)).toBeCloseTo(bellowsGoal(behavior, 3.3), 10)
      expect(bellowsGoal(behavior, Number.NaN)).toBe(bellowsGoal(behavior, 0))
    }
    expect(bellowsGoal("static", 0.4)).toBe(0.5)
  })

  it("fills slowly and dumps quickly on settle, and flinches on startle", () => {
    // The dump is the short leg of the cycle: it loses more in 0.1 than it gained.
    const gained = bellowsGoal("settle", 0.6) - bellowsGoal("settle", 0.5)
    const lost = bellowsGoal("settle", 0.82) - bellowsGoal("settle", 0.72)
    expect(gained).toBeGreaterThan(0)
    expect(lost).toBeLessThan(-gained)
    expect(bellowsGoal("startle", 0.18)).toBeLessThan(bellowsGoal("startle", 0.4) - 0.3)
  })
})

describe("bellows droid", () => {
  it("reshapes the whole machine from the one inflation axis", () => {
    const { container, rerender } = render(<BellowsDroid inflation={0.1} />)
    const shell = container.querySelector("[data-shell]")!.getAttribute("d")
    const crown = container.querySelector("[data-crown]")!.getAttribute("transform")
    const optic = container.querySelector('[data-optic="left"]')!.getAttribute("transform")
    const vent = container.querySelector("[data-aperture] rect")!.getAttribute("height")

    rerender(<BellowsDroid inflation={0.9} />)

    expect(container.querySelector("[data-shell]")!.getAttribute("d")).not.toBe(shell)
    expect(container.querySelector("[data-crown]")!.getAttribute("transform")).not.toBe(crown)
    expect(container.querySelector('[data-optic="left"]')!.getAttribute("transform")).not.toBe(optic)
    expect(container.querySelector("[data-aperture] rect")!.getAttribute("height")).not.toBe(vent)
  })

  it("draws the pleats it is asked for and says how full it is", () => {
    const { container, getByRole } = render(<BellowsDroid inflation={0.75} pleats={9} />)
    expect(container.querySelectorAll("[data-pleat]").length).toBeGreaterThan(0)
    expect(container.querySelectorAll("[data-pleat]").length).toBeLessThanOrEqual(9)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Bellows droid")
    expect(getByRole("img").getAttribute("aria-label")).toContain("75")
  })

  it("turns the camera on one geometry, and shows the face only where it is", () => {
    const front = render(<BellowsDroid inflation={0.6} view="front" />)
    expect(front.container.querySelector("[data-aperture]")).not.toBeNull()
    expect(front.container.querySelectorAll("[data-optic]").length).toBe(2)
    const shell = front.container.querySelector("[data-shell]")!.getAttribute("d")
    const pleats = front.container.querySelector("[data-pleat]")!.getAttribute("d")

    for (const view of ["plan", "profile", "iso"] as const) {
      const { container } = render(<BellowsDroid inflation={0.6} view={view} />)
      expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
      expect(container.querySelector("[data-pleat]")!.getAttribute("d")).not.toBe(pleats)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    }

    // A body of revolution has the same outline from the front and the side —
    // what changes is which pleats face you and whether there is a face at all.
    const profile = render(<BellowsDroid inflation={0.6} view="profile" />)
    expect(profile.container.querySelector("[data-shell]")!.getAttribute("d")).toBe(shell)
    expect(profile.container.querySelector("[data-aperture]")).toBeNull()

    // Looking straight down, the silhouette is the widest circle and the face
    // is edge-on to nothing: every pleat is visible and none of the panels are.
    const plan = render(<BellowsDroid inflation={0.6} view="plan" />)
    expect(plan.container.querySelector("[data-shell]")!.getAttribute("d")).not.toBe(shell)
    expect(plan.container.querySelector("[data-aperture]")).toBeNull()
    expect(plan.container.querySelectorAll("[data-optic]").length).toBe(0)
    expect(plan.container.querySelectorAll("[data-pleat]").length).toBe(7)

    // A pod's barrel belongs to its lens. Edge-on, with no face to see, it is
    // a bezel inside the shell — it must never paint over the silhouette, or
    // it reads as a hole in the dome.
    const order = (root: Element) =>
      Array.from(root.querySelectorAll("[data-barrel], [data-shell]")).map((el) =>
        el.hasAttribute("data-shell") ? "shell" : "barrel",
      )
    expect(profile.container.querySelectorAll("[data-barrel]").length).toBe(2)
    expect(order(profile.container).indexOf("shell")).toBe(2)
    expect(order(front.container).at(-1)).toBe("barrel")

    const iso = render(<BellowsDroid inflation={0.6} view="iso" />)
    expect(iso.container.querySelector("[data-shell]")!.getAttribute("d")).not.toBe(shell)
    expect(iso.container.querySelectorAll("[data-optic]").length).toBe(2)
  })

  it("renders the neutral pose for nonsense input and keeps a colour override", () => {
    const { container, getByRole } = render(
      <BellowsDroid inflation={Number.NaN} pleats={Number.NaN} color="#ff00aa" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("img").getAttribute("aria-label")).toContain("50")
    expect(container.innerHTML).toContain("#ff00aa")
  })

  it("is a slider when it is interactive, and the arrow keys work it", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <BellowsDroid interactive animate={false} onInflationChange={(value) => seen.push(value)} />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuemin")).toBe("0")
    expect(svg.getAttribute("aria-valuemax")).toBe("100")
    expect(svg.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(svg, { key: "ArrowUp" })
    fireEvent.keyDown(svg, { key: "End" })
    fireEvent.keyDown(svg, { key: "Home" })

    expect(seen).toEqual([0.55, 1, 0])
  })
})
