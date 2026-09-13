import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import {
  IRIS_GEOMETRY,
  SentinelConsole,
  irisBladePoints,
  irisOpening,
  sentinelPose,
} from "@/components/ui/sentinel-console"

afterEach(cleanup)

describe("the iris", () => {
  it("solves the swing that puts the blade edges on the asked-for bore", () => {
    const { pivot, edge, arm } = IRIS_GEOMETRY
    for (const aperture of [0, 0.2, 0.5, 0.8, 1]) {
      const iris = irisOpening(aperture)
      // The blade's edge centre runs a circle of radius `arm` about its pin, so
      // its distance from the axis is the law of cosines — and the bore is that
      // distance less the edge radius. This is the forward direction of the
      // solve the component runs backwards.
      const distance = Math.sqrt(
        pivot ** 2 + arm ** 2 + 2 * pivot * arm * Math.cos((iris.swing * Math.PI) / 180),
      )
      expect(distance - edge).toBeCloseTo(iris.radius, 6)
    }
  })

  it("opens and closes monotonically over its whole stroke", () => {
    let previous = -Infinity
    for (let step = 0; step <= 10; step++) {
      const iris = irisOpening(step / 10)
      expect(iris.radius).toBeGreaterThan(previous)
      previous = iris.radius
    }
    expect(irisOpening(1).radius).toBeGreaterThan(irisOpening(0).radius * 3)
    // Closed is a pinhole, never a negative or vanished bore.
    expect(irisOpening(0).radius).toBeGreaterThan(0)
  })

  it("clamps nonsense to the half-open bore and keeps every blade one shape", () => {
    expect(irisOpening(4).radius).toBe(irisOpening(1).radius)
    expect(irisOpening(-2).radius).toBe(irisOpening(0).radius)
    expect(irisOpening(Number.NaN).aperture).toBe(0.5)

    const iris = irisOpening(0.4)
    const first = irisBladePoints(iris, 0, 8)
    const second = irisBladePoints(iris, 1, 8)
    expect(first.length).toBe(second.length)
    // One leaf, eight times, 45 degrees apart: the radii match term for term.
    for (let index = 0; index < first.length; index++) {
      expect(Math.hypot(second[index].x, second[index].y)).toBeCloseTo(
        Math.hypot(first[index].x, first[index].y),
        6,
      )
    }
  })
})

/** Ray casting, so a blade can be asked what it actually covers. */
function covers(polygon: { x: number; y: number }[], point: { x: number; y: number }) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}

/** The bearing of one blade's edge centre: where its material comes closest. */
function bladeBearing(iris: { swing: number }, index: number, count: number) {
  const { pivot, arm } = IRIS_GEOMETRY
  const pin = (index / count) * Math.PI * 2
  const swung = pin + (iris.swing * Math.PI) / 180
  return Math.atan2(
    pivot * Math.sin(pin) + arm * Math.sin(swung),
    pivot * Math.cos(pin) + arm * Math.cos(swung),
  )
}

describe("the blades", () => {
  it("bound the opening from outside it and never cross it", () => {
    for (const aperture of [0, 0.35, 0.7]) {
      const iris = irisOpening(aperture)
      const blades = Array.from({ length: 8 }, (_, index) => irisBladePoints(iris, index, 8))

      for (const [index, blade] of blades.entries()) {
        // Nothing is painted over the optical axis — that would be a shutter,
        // not a diaphragm, and it is exactly what a wrong-way arc produces.
        expect(covers(blade, { x: 0, y: 0 })).toBe(false)
        // Every vertex sits on or outside the solved bore.
        for (const point of blade) {
          expect(Math.hypot(point.x, point.y)).toBeGreaterThanOrEqual(iris.radius - 1e-6)
        }
        // And the material starts right where the bore ends.
        const bearing = bladeBearing(iris, index, 8)
        const outside = {
          x: Math.cos(bearing) * (iris.radius + 1),
          y: Math.sin(bearing) * (iris.radius + 1),
        }
        const inside = {
          x: Math.cos(bearing) * (iris.radius - 1),
          y: Math.sin(bearing) * (iris.radius - 1),
        }
        expect(covers(blade, outside)).toBe(true)
        expect(blades.some((other) => covers(other, inside))).toBe(false)
      }
    }
  })
})

describe("sentinel behaviours", () => {
  it("stays inside its stops, repeats whole cycles, and parks on bad input", () => {
    for (const behavior of ["watch", "listen", "speak", "alert", "static"] as const) {
      for (let step = 0; step <= 24; step++) {
        const pose = sentinelPose(behavior, step / 24)
        expect(Math.abs(pose.pan)).toBeLessThanOrEqual(18)
        expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(12)
        expect(pose.aperture).toBeGreaterThanOrEqual(0)
        expect(pose.aperture).toBeLessThanOrEqual(1)
        expect(pose.voice).toBeGreaterThanOrEqual(0)
        expect(pose.voice).toBeLessThanOrEqual(1)
      }
      expect(sentinelPose(behavior, 0.3).pan).toBeCloseTo(sentinelPose(behavior, 3.3).pan, 10)
      expect(sentinelPose(behavior, Number.NaN)).toEqual(sentinelPose(behavior, 0))
    }
  })

  it("gives each behaviour the aperture and the voice its job needs", () => {
    // Listening opens up; an alert stops down hard. Only speaking talks.
    expect(sentinelPose("listen", 0.4).aperture).toBeGreaterThan(
      sentinelPose("watch", 0.4).aperture,
    )
    expect(sentinelPose("alert", 0.4).aperture).toBeLessThan(sentinelPose("watch", 0.4).aperture)
    expect(sentinelPose("watch", 0.4).voice).toBe(0)
    expect(sentinelPose("listen", 0.4).voice).toBe(0)
    const loudest = Array.from({ length: 40 }, (_, i) => sentinelPose("speak", i / 40).voice)
    expect(Math.max(...loudest)).toBeGreaterThan(0.5)
    expect(Math.min(...loudest)).toBeLessThan(0.1)
    expect(sentinelPose("static", 0.7)).toEqual(sentinelPose("static", 0.2))
  })
})

describe("sentinel console", () => {
  it("works the iris from the one aperture axis", () => {
    const { container, rerender } = render(<SentinelConsole aperture={0.1} blades={8} />)
    expect(container.querySelectorAll("[data-blade]")).toHaveLength(8)
    const blade = container.querySelector('[data-blade="0"]')!.getAttribute("d")
    const bore = container.querySelector("[data-iris] [data-bore]")!.getAttribute("r")

    rerender(<SentinelConsole aperture={0.9} blades={8} />)

    expect(container.querySelector('[data-blade="0"]')!.getAttribute("d")).not.toBe(blade)
    expect(
      Number(container.querySelector("[data-iris] [data-bore]")!.getAttribute("r")),
    ).toBeGreaterThan(Number(bore))
  })

  it("turns the optic as a body, not a pupil sliding in a hole", () => {
    const { container, rerender } = render(
      <SentinelConsole aperture={0.6} track={false} look={{ x: 0, y: 0 }} />,
    )
    const cell = container.querySelector("[data-cell]")!.getAttribute("transform")
    const bezel = container.querySelector("[data-bezel]")!.getAttribute("d")
    const pupil = container.querySelector("[data-pupil]")!.getAttribute("d")

    rerender(<SentinelConsole aperture={0.6} track={false} look={{ x: 0.8, y: -0.5 }} />)

    // The whole cell turns: its bezel foreshortens and the glass rides with it.
    expect(container.querySelector("[data-cell]")!.getAttribute("transform")).not.toBe(cell)
    expect(container.querySelector("[data-bezel]")!.getAttribute("d")).not.toBe(bezel)
    expect(container.querySelector("[data-pupil]")!.getAttribute("d")).not.toBe(pupil)
    expect(container.querySelectorAll("[data-trunnion]")).toHaveLength(2)
  })

  it("lights the grille from the voice level and names itself", () => {
    const quiet = render(<SentinelConsole aperture={0.5} voice={0} interactive={false} />)
    const loud = render(<SentinelConsole aperture={0.5} voice={1} interactive={false} />)
    const lit = (view: HTMLElement) => view.querySelectorAll('[data-bar][data-lit="true"]').length

    expect(lit(quiet.container)).toBe(0)
    expect(lit(loud.container)).toBeGreaterThan(0)
    const named = loud.container.querySelector("svg")!.getAttribute("aria-label")!
    expect(named).toContain("Sentinel console")
    expect(named).toContain("50")
    expect(named).toContain("front elevation")
  })

  it("shows the face only where there is a face to see", () => {
    const front = render(<SentinelConsole aperture={0.5} view="front" />)
    expect(front.container.querySelectorAll("[data-blade]").length).toBeGreaterThan(0)
    expect(front.container.querySelector("[data-grille]")).not.toBeNull()
    const housing = front.container.querySelector("[data-housing]")!.getAttribute("d")

    for (const view of ["plan", "profile", "iso"] as const) {
      const { container } = render(<SentinelConsole aperture={0.5} view={view} />)
      expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
      expect(container.querySelector("[data-housing]")!.getAttribute("d")).not.toBe(housing)
      expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    }

    // Edge-on, the face collapses — and the depth of the fixture is what is left.
    const profile = render(<SentinelConsole aperture={0.5} view="profile" />)
    expect(profile.container.querySelectorAll("[data-blade]")).toHaveLength(0)
    expect(profile.container.querySelector("[data-grille]")).toBeNull()
    expect(profile.container.querySelector("[data-conduit]")).not.toBeNull()

    const iso = render(<SentinelConsole aperture={0.5} view="iso" />)
    expect(iso.container.querySelectorAll("[data-blade]").length).toBeGreaterThan(0)
    expect(iso.container.querySelector("[data-conduit]")).not.toBeNull()
  })

  it("renders the neutral pose for nonsense input and keeps a colour override", () => {
    const { container, getByRole } = render(
      <SentinelConsole
        aperture={Number.NaN}
        blades={Number.NaN}
        voice={Number.NaN}
        look={{ x: Number.NaN, y: Number.NaN }}
        track={false}
        interactive={false}
        color="#ff00aa"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(getByRole("img").getAttribute("aria-label")).toContain("50")
    expect(container.innerHTML).toContain("#ff00aa")
    expect(container.querySelectorAll("[data-blade]")).toHaveLength(8)
  })

  it("is a slider when it is interactive, and the arrow keys stop it down", () => {
    const seen: number[] = []
    const { getByRole } = render(
      <SentinelConsole
        interactive
        animate={false}
        behavior="static"
        onApertureChange={(value) => seen.push(value)}
      />,
    )
    const svg = getByRole("slider")
    expect(svg.getAttribute("aria-valuemin")).toBe("0")
    expect(svg.getAttribute("aria-valuemax")).toBe("100")
    expect(svg.getAttribute("tabindex")).toBe("0")

    fireEvent.keyDown(svg, { key: "ArrowRight" })
    fireEvent.keyDown(svg, { key: "End" })
    fireEvent.keyDown(svg, { key: "Home" })

    expect(seen).toEqual([0.6, 1, 0])
  })
})
