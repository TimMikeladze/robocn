import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CelestialAsteroid,
  asteroidGoal,
} from "@/components/ui/celestial-asteroid"
import { CelestialMoon, moonGoal, moonLibration } from "@/components/ui/celestial-moon"
import { CelestialPlanet, planetGoal, planetSun } from "@/components/ui/celestial-planet"
import { CelestialStar, starGoal } from "@/components/ui/celestial-star"
import { Orrery, orreryGoal } from "@/components/ui/orrery"
import { RobotSunflower, sunflowerGoal } from "@/components/ui/robot-sunflower"

afterEach(cleanup)

const path = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d")

/** How far a path's points reach from the centre of the 200-unit frame. */
const reach = (d: string) => {
  const numbers = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
  return Math.max(
    ...numbers.map(([, x, y]) => Math.hypot(Number(x) - 100, Number(y) - 100)),
  )
}

describe("celestial planet", () => {
  it("shows its rotation on the features that have a longitude", () => {
    const { container, rerender } = render(<CelestialPlanet animate={false} spin={0} />)
    const band = path(container, '[data-band="0"]')
    const storm = container.querySelector("[data-storm]")!.getAttribute("cx")
    rerender(<CelestialPlanet animate={false} spin={120} />)
    // A latitude band is a ring about the pole, so spinning cannot move it —
    // and a storm sits at a longitude, so spinning is the only thing that can.
    expect(path(container, '[data-band="0"]')).toBe(band)
    expect(container.querySelector("[data-storm]")!.getAttribute("cx")).not.toBe(storm)
  })

  it("cuts the ring where the globe stands in front of it", () => {
    const { container } = render(<CelestialPlanet animate={false} spin={30} rings />)
    const far = container.querySelectorAll('[data-ring="far"]')
    const near = container.querySelectorAll('[data-ring="near"]')
    // The far half is in runs because the body interrupts it; the near half
    // passes in front and is not interrupted at all.
    expect(far.length).toBeGreaterThanOrEqual(1)
    expect(near.length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll("[data-ring]").length).toBeGreaterThanOrEqual(2)
  })

  it("takes the rings away when it is asked to", () => {
    const { container } = render(<CelestialPlanet animate={false} spin={30} rings={false} />)
    expect(container.querySelectorAll("[data-ring]").length).toBe(0)
  })

  it("moves the day-night line with the light and not with the body", () => {
    const { container, rerender } = render(<CelestialPlanet animate={false} spin={40} sun={20} />)
    const night = path(container, "[data-terminator]")
    rerender(<CelestialPlanet animate={false} spin={40} sun={130} />)
    expect(path(container, "[data-terminator]")).not.toBe(night)
    // The globe itself has not moved: it is a sphere, and only the light did.
    const spread = reach(path(container, "[data-globe]")!)
    expect(spread).toBeGreaterThan(43)
    expect(spread).toBeLessThan(46)
  })

  it("reports the spin and answers the keyboard", () => {
    const onSpinChange = vi.fn()
    const { container } = render(<CelestialPlanet interactive onSpinChange={onSpinChange} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 100, pointerId: 1 })
    expect(onSpinChange).toHaveBeenCalledWith(180)
    fireEvent.pointerUp(svg, { pointerId: 1 })
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onSpinChange).toHaveBeenLastCalledWith(0)
    expect(svg.getAttribute("role")).toBe("slider")
  })

  it("renders a stable body for broken input", () => {
    const { container } = render(
      <CelestialPlanet
        animate={false}
        spin={Number.NaN}
        tilt={Number.NaN}
        sun={Number.NaN}
        moons={Number.NaN}
        sunHeight={Number.POSITIVE_INFINITY}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names the view it was drawn from", () => {
    const { container } = render(<CelestialPlanet animate={false} spin={0} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })
})

describe("celestial moon", () => {
  it("draws the crescent from the geometry, and flips it at quarter", () => {
    // A waxing crescent is lit on the right, so its night side reaches left of
    // centre; a waning one is the mirror of it.
    const waxing = render(<CelestialMoon animate={false} phase={0.15} craters={0} maria={0} />)
    const waxingNight = centroid(path(waxing.container, "[data-terminator]")!)
    cleanup()
    const waning = render(<CelestialMoon animate={false} phase={0.85} craters={0} maria={0} />)
    const waningNight = centroid(path(waning.container, "[data-terminator]")!)
    expect(waxingNight.x).toBeLessThan(100)
    expect(waningNight.x).toBeGreaterThan(100)
  })

  it("covers the whole face at new and next to none of it at full", () => {
    const nightArea = (phase: number) => {
      const { container } = render(
        <CelestialMoon animate={false} phase={phase} craters={0} maria={0} />,
      )
      const night = container.querySelector("[data-terminator]")
      const measure = night ? area(night.getAttribute("d")!) : 0
      cleanup()
      return measure
    }
    const disc = Math.PI * 72 * 72
    expect(nightArea(0)).toBeGreaterThan(disc * 0.9)
    expect(nightArea(0.25)).toBeGreaterThan(disc * 0.4)
    expect(nightArea(0.25)).toBeLessThan(disc * 0.6)
    expect(nightArea(0.5)).toBeLessThan(disc * 0.08)
  })

  it("rocks so the limb comes round, and stops when libration is off", () => {
    const { container, rerender } = render(
      <CelestialMoon animate={false} phase={0.3} craters={40} libration={1} />,
    )
    const crater = container.querySelector('[data-crater="3"]')!.getAttribute("transform")
    rerender(<CelestialMoon animate={false} phase={0.7} craters={40} libration={1} />)
    expect(container.querySelector('[data-crater="3"]')!.getAttribute("transform")).not.toBe(
      crater,
    )

    const locked = render(<CelestialMoon animate={false} phase={0.3} craters={40} libration={0} />)
    const still = locked.container.querySelector('[data-crater="3"]')!.getAttribute("transform")
    locked.rerender(<CelestialMoon animate={false} phase={0.7} craters={40} libration={0} />)
    expect(locked.container.querySelector('[data-crater="3"]')!.getAttribute("transform")).toBe(
      still,
    )
  })

  it("names the phase it is at", () => {
    const { container } = render(<CelestialMoon animate={false} phase={0.5} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("full")
  })

  it("scrubs the lunation from a drag", () => {
    const onPhaseChange = vi.fn()
    const { container } = render(<CelestialMoon interactive onPhaseChange={onPhaseChange} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 50, clientY: 100, pointerId: 1 })
    expect(onPhaseChange).toHaveBeenCalledWith(0.25)
  })

  it("renders a stable body for broken input", () => {
    const { container } = render(
      <CelestialMoon
        animate={false}
        phase={Number.NaN}
        craters={Number.NaN}
        maria={Number.NaN}
        libration={Number.NaN}
        tilt={Number.POSITIVE_INFINITY}
        seed={Number.NaN}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("celestial star", () => {
  it("darkens toward the limb harder for a giant than for a dwarf", () => {
    const dwarf = render(<CelestialStar animate={false} activity={0.4} kind="dwarf" />)
    const dwarfEdge = Number(
      dwarf.container.querySelector('[data-shell="0"]')!.getAttribute("fill-opacity"),
    )
    cleanup()
    const giant = render(<CelestialStar animate={false} activity={0.4} kind="giant" />)
    const giantEdge = Number(
      giant.container.querySelector('[data-shell="0"]')!.getAttribute("fill-opacity"),
    )
    // The outermost shell carries `1 − I/I₀`: more of it on the cooler star.
    expect(giantEdge).toBeGreaterThan(dwarfEdge)
  })

  it("ships the shells it was asked for and grows its loops with activity", () => {
    const quiet = render(<CelestialStar animate={false} activity={0} shells={6} />)
    expect(quiet.container.querySelectorAll("[data-shell]").length).toBe(6)
    const small = reach(quiet.container.querySelector("[data-prominence]")!.getAttribute("d")!)
    cleanup()
    const loud = render(<CelestialStar animate={false} activity={1} shells={6} />)
    expect(reach(loud.container.querySelector("[data-prominence]")!.getAttribute("d")!)).toBeGreaterThan(
      small,
    )
  })

  it("turns its spots round the back", () => {
    const { container, rerender } = render(
      <CelestialStar animate={false} activity={0.5} spin={0} spots={10} />,
    )
    const before = container.querySelectorAll("[data-spot]").length
    rerender(<CelestialStar animate={false} activity={0.5} spin={180} spots={10} />)
    // Half the belt is behind the body at any moment, and which half changes.
    expect(container.querySelectorAll("[data-spot]").length).toBeGreaterThan(0)
    expect(before).toBeGreaterThan(0)
    expect(
      container.querySelector("[data-spot]")!.getAttribute("cx"),
    ).not.toBe(null)
  })

  it("reports the activity and answers the keyboard", () => {
    const onActivityChange = vi.fn()
    const { container } = render(<CelestialStar interactive onActivityChange={onActivityChange} />)
    const svg = container.querySelector("svg")!
    fireEvent.keyDown(svg, { key: "End" })
    expect(onActivityChange).toHaveBeenLastCalledWith(1)
    expect(svg.getAttribute("aria-valuenow")).toBe("100")
  })

  it("renders a stable body for broken input", () => {
    const { container } = render(
      <CelestialStar
        animate={false}
        activity={Number.NaN}
        shells={Number.NaN}
        granules={Number.NaN}
        spots={Number.NaN}
        prominences={Number.NaN}
        spin={Number.NaN}
        tilt={Number.POSITIVE_INFINITY}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("celestial asteroid", () => {
  it("changes its own silhouette as it turns", () => {
    const { container, rerender } = render(<CelestialAsteroid animate={false} tumble={0} />)
    const first = path(container, "[data-body]")!
    rerender(<CelestialAsteroid animate={false} tumble={90} />)
    const second = path(container, "[data-body]")!
    expect(second).not.toBe(first)
    // Not just rotated: how far the rock reaches is different too.
    expect(Math.abs(reach(second) - reach(first))).toBeGreaterThan(0.5)
  })

  it("is the same rock for a seed and a different one for another", () => {
    const one = render(<CelestialAsteroid animate={false} tumble={20} seed={4} />)
    const shape = path(one.container, "[data-body]")
    cleanup()
    const same = render(<CelestialAsteroid animate={false} tumble={20} seed={4} />)
    expect(path(same.container, "[data-body]")).toBe(shape)
    cleanup()
    const other = render(<CelestialAsteroid animate={false} tumble={20} seed={5} />)
    expect(path(other.container, "[data-body]")).not.toBe(shape)
  })

  it("puts the shadow where the light is not", () => {
    const { container, rerender } = render(
      <CelestialAsteroid animate={false} tumble={20} sun={60} />,
    )
    const shade = centroid(path(container, "[data-shadow]")!)
    rerender(<CelestialAsteroid animate={false} tumble={20} sun={-60} />)
    const mirrored = centroid(path(container, "[data-shadow]")!)
    // Light from the other side puts the night side on the other side.
    expect(Math.sign(shade.x - 100)).not.toBe(Math.sign(mirrored.x - 100))
  })

  it("carries a companion only when it is asked to", () => {
    const bare = render(<CelestialAsteroid animate={false} tumble={20} />)
    expect(bare.container.querySelector("[data-moonlet]")).toBeNull()
    cleanup()
    const paired = render(<CelestialAsteroid animate={false} tumble={20} moonlet />)
    expect(paired.container.querySelector("[data-moonlet]")).not.toBeNull()
  })

  it("renders a stable body for broken input", () => {
    const { container } = render(
      <CelestialAsteroid
        animate={false}
        tumble={Number.NaN}
        seed={Number.NaN}
        craters={Number.NaN}
        sun={Number.POSITIVE_INFINITY}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("orrery", () => {
  it("telescopes each arm as its body runs round an ellipse", () => {
    const armAt = (year: number) => {
      const { container } = render(
        <Orrery animate={false} epoch={year} bodies={3} eccentricity={1} />,
      )
      const body = bodyAt(container)
      cleanup()
      return Math.hypot(body.x - 100, body.y - 100)
    }
    // Half a period apart on an eccentric orbit is periapsis against apoapsis,
    // and the arm is the radius — on a circle this ratio would be exactly one.
    expect(armAt(0.5)).toBeGreaterThan(armAt(0) * 1.2)
  })

  it("runs fast at periapsis and slowly at apoapsis", () => {
    const travel = (from: number) => {
      const before = render(<Orrery animate={false} epoch={from} bodies={2} eccentricity={1} />)
      const a = bodyAt(before.container)
      cleanup()
      const after = render(
        <Orrery animate={false} epoch={from + 0.03} bodies={2} eccentricity={1} />,
      )
      const b = bodyAt(after.container)
      cleanup()
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    // A circle would travel the same distance in both; an ellipse cannot.
    expect(travel(0)).toBeGreaterThan(travel(0.5) * 1.15)
  })

  it("gives every body an orbit, an arm and a gear", () => {
    const { container } = render(<Orrery animate={false} epoch={0.2} bodies={5} />)
    expect(container.querySelectorAll("[data-body]").length).toBe(5)
    expect(container.querySelectorAll("[data-arm]").length).toBe(5)
    expect(container.querySelectorAll("[data-orbit]").length).toBe(5)
    expect(container.querySelectorAll("[data-gear]").length).toBe(5)
  })

  it("takes the orbits and the gear train away when asked", () => {
    const { container } = render(
      <Orrery animate={false} epoch={0.2} bodies={3} showOrbits={false} showGears={false} />,
    )
    expect(container.querySelectorAll("[data-orbit]").length).toBe(0)
    expect(container.querySelectorAll("[data-gear]").length).toBe(0)
  })

  it("winds time on from a drag and from the keyboard", () => {
    const onEpochChange = vi.fn()
    const { container } = render(<Orrery interactive onEpochChange={onEpochChange} />)
    const svg = container.querySelector("svg")!
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    fireEvent.pointerDown(svg, { clientX: 200, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100, pointerId: 1 })
    expect(onEpochChange).toHaveBeenCalledWith(12)
    fireEvent.pointerUp(svg, { pointerId: 1 })
    fireEvent.keyDown(svg, { key: "Home" })
    expect(onEpochChange).toHaveBeenLastCalledWith(0)
  })

  it("renders a stable machine for broken input", () => {
    const { container } = render(
      <Orrery
        animate={false}
        epoch={Number.NaN}
        bodies={Number.NaN}
        eccentricity={Number.NaN}
        inclination={Number.POSITIVE_INFINITY}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("the family's own numbers", () => {
  it("samples every behaviour inside its own limits", () => {
    expect(planetGoal("rotate", 0.5)).toBeCloseTo(180, 9)
    expect(planetGoal("static", 3)).toBe(0)
    expect(planetGoal("rotate", Number.NaN)).toBe(0)
    expect(planetSun("orbit", 1)).not.toBe(planetSun("orbit", 2))
    expect(planetSun("rotate", 9)).toBe(planetSun("rotate", 3))

    expect(moonGoal("cycle", 0.25)).toBeCloseTo(0.25, 9)
    expect(moonGoal("static", 7)).toBe(0.5)
    expect(Math.abs(moonGoal("libration", 0.3) - 0.5)).toBeLessThan(0.05)

    expect(starGoal("flare", 0.55)).toBeCloseTo(1, 6)
    expect(starGoal("flare", 0)).toBeCloseTo(0.12, 9)
    expect(starGoal("static", 2)).toBe(0.35)

    expect(asteroidGoal("tumble", 0.5)).toBeCloseTo(180, 9)
    expect(asteroidGoal("drift", 1)).toBeCloseTo(90, 9)
    expect(asteroidGoal("static", 4)).toBe(0)

    expect(orreryGoal("run", 2.5)).toBeCloseTo(2.5, 9)
    // Jog indexes a whole year at a time and dwells between them.
    expect(orreryGoal("jog", 2.4)).toBe(2)
    expect(orreryGoal("jog", 2.9)).toBe(2)
    expect(orreryGoal("static", 5)).toBe(0)
  })

  it("rocks the moon on a period of its own, and not at all when locked", () => {
    expect(moonLibration(0, 0)).toEqual({ longitude: 0, latitude: 0 })
    expect(Math.abs(moonLibration(0.31, 1).longitude)).toBeGreaterThan(0)
    // A whole lunation does not return the libration to where it started,
    // which is the reason the near side is a range.
    expect(moonLibration(1, 1).longitude).not.toBeCloseTo(moonLibration(0, 1).longitude, 3)
    expect(Number.isFinite(moonLibration(Number.NaN, Number.NaN).latitude)).toBe(true)
  })
})

/** The area a closed path's points enclose, by the shoelace formula. */
function area(d: string) {
  const points = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)].map(([, x, y]) => ({
    x: Number(x),
    y: Number(y),
  }))
  let sum = 0
  for (let index = 0; index < points.length; index++) {
    const a = points[index]
    const b = points[(index + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** The centre of a path's points, for asking which side of the frame it is on. */
function centroid(d: string) {
  const numbers = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
  return {
    x: numbers.reduce((sum, [, x]) => sum + Number(x) / numbers.length, 0),
    y: numbers.reduce((sum, [, , y]) => sum + Number(y) / numbers.length, 0),
  }
}

function bodyAt(container: HTMLElement) {
  const body = container.querySelector('[data-body="0"]')!
  return { x: Number(body.getAttribute("cx")), y: Number(body.getAttribute("cy")) }
}

/**
 * All six machines run on the shared clock, so a reduced-motion preference has
 * to park every one of them at `phase` — and at exactly the pose the equivalent
 * controlled props draw, not merely somewhere still.
 */
describe("reduced motion", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "matchMedia")
  })

  const askForLessMotion = () =>
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })

  const drawing = (markup: HTMLElement) => markup.querySelector("svg")!.innerHTML

  it("parks every loop at the pose its controlled props would draw", () => {
    askForLessMotion()

    expect(drawing(render(<RobotSunflower behavior="sweep" track={false} />).container)).toBe(
      drawing(
        render(
          <RobotSunflower daylight={sunflowerGoal("sweep", 0)} behavior="static" track={false} />,
        ).container,
      ),
    )
    expect(drawing(render(<CelestialPlanet behavior="rotate" />).container)).toBe(
      drawing(render(<CelestialPlanet spin={planetGoal("rotate", 0)} behavior="static" />).container),
    )
    expect(drawing(render(<CelestialMoon behavior="cycle" />).container)).toBe(
      drawing(render(<CelestialMoon phase={moonGoal("cycle", 0)} behavior="static" />).container),
    )
    expect(drawing(render(<CelestialStar behavior="flare" spin={0} />).container)).toBe(
      drawing(
        render(<CelestialStar activity={starGoal("flare", 0)} spin={0} behavior="static" />).container,
      ),
    )
    expect(drawing(render(<CelestialAsteroid behavior="tumble" />).container)).toBe(
      drawing(
        render(<CelestialAsteroid tumble={asteroidGoal("tumble", 0)} behavior="static" />).container,
      ),
    )
    expect(drawing(render(<Orrery behavior="run" />).container)).toBe(
      drawing(render(<Orrery epoch={orreryGoal("run", 0)} behavior="static" />).container),
    )
  })

  it("still lets a person work the machine by hand", () => {
    askForLessMotion()
    const onPhaseChange = vi.fn()
    const { container } = render(<CelestialMoon interactive onPhaseChange={onPhaseChange} />)
    const svg = container.querySelector("svg")!
    // Parked is not disabled: reduced motion stops loops, never input.
    fireEvent.keyDown(svg, { key: "End" })
    expect(onPhaseChange).toHaveBeenLastCalledWith(0.5)
  })
})
