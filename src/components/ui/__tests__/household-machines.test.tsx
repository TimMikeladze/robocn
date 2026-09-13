import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { GabledHouse, houseGarage, houseSun } from "@/components/ui/gabled-house"
import { TowerBlock, towerCarriage, towerLit } from "@/components/ui/tower-block"
import {
  EspressoMachine,
  espressoLever,
  espressoPouring,
  espressoPressure,
  espressoShot,
  espressoYield,
} from "@/components/ui/espresso-machine"
import {
  Refrigerator,
  fridgeDoor,
  fridgeDuty,
  fridgeFreezer,
} from "@/components/ui/refrigerator"
import {
  WashingMachine,
  washRpm,
  washWater,
} from "@/components/ui/washing-machine"

afterEach(cleanup)

const transformOf = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("d") ??
  container.querySelector(selector)!.getAttribute("transform")

describe("gabled-house", () => {
  it("puts the ridge where the pitch says, and the storeys under it", () => {
    const { container, rerender } = render(<GabledHouse sun={0.5} pitch={20} storeys={1} />)
    const shallow = transformOf(container, "[data-roof]")
    const oneStorey = transformOf(container, "[data-body]")

    rerender(<GabledHouse sun={0.5} pitch={50} storeys={1} />)
    expect(transformOf(container, "[data-roof]")).not.toBe(shallow)
    expect(transformOf(container, "[data-body]")).toBe(oneStorey)

    rerender(<GabledHouse sun={0.5} pitch={20} storeys={3} />)
    expect(transformOf(container, "[data-body]")).not.toBe(oneStorey)
    expect(container.querySelectorAll("[data-window]").length).toBe(2 + 3 + 3)
  })

  it("runs the garage door up its track without stretching a panel", () => {
    const { container, rerender } = render(<GabledHouse sun={0.5} garage={0} panels={5} />)
    expect(container.querySelectorAll("[data-panel]")).toHaveLength(5)
    const shut = [...container.querySelectorAll("[data-panel]")].map((p) => p.getAttribute("d"))

    rerender(<GabledHouse sun={0.5} garage={0.6} panels={5} />)
    const part = [...container.querySelectorAll("[data-panel]")].map((p) => p.getAttribute("d"))
    expect(part).not.toEqual(shut)
    expect(container.querySelector("[data-garage]")!.getAttribute("data-travel")).toBe("0.6")
  })

  it("turns the fins and the array to the sun, and lights up at night", () => {
    const { container, rerender } = render(<GabledHouse sun={0.5} />)
    const noon = container.querySelector("[data-fins]")!.getAttribute("data-tilt")
    expect(container.querySelector("[data-sun]")).not.toBeNull()
    expect(container.querySelector("[data-array]")!.getAttribute("data-clamped")).toBe("false")

    rerender(<GabledHouse sun={0.72} />)
    expect(container.querySelector("[data-fins]")!.getAttribute("data-tilt")).not.toBe(noon)
    expect(container.querySelector("[data-array]")!.getAttribute("data-clamped")).toBe("true")

    rerender(<GabledHouse sun={0} />)
    // Night: no sun on the arc, and the lamp is the accent colour.
    expect(container.querySelector("[data-sun]")).toBeNull()
    expect(container.querySelector("[data-lamp]")!.getAttribute("fill")).toContain("--robot-accent")
  })

  it("names itself, the pitch and the time of day", () => {
    const { container } = render(<GabledHouse sun={0.5} storeys={1} pitch={30} view="iso" />)
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("1 storey")
    expect(label).toContain("30 degree roof pitch")
    expect(label).toContain("midday")
    expect(label).toContain("isometric view")
  })

  it("holds a neutral pose for rubbish input", () => {
    const { container } = render(
      <GabledHouse sun={Number.NaN} pitch={Number.NaN} storeys={Number.NaN} garage={Number.NaN} />,
    )
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "")
    expect(paths.some((d) => d.includes("NaN"))).toBe(false)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("2 storeys")
  })

  it("is a slider you can drive when it is interactive", () => {
    const { container } = render(<GabledHouse interactive sun={0.4} />)
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    expect(svg.getAttribute("tabindex")).toBe("0")
    expect(svg.getAttribute("aria-valuenow")).toBe("0.4")
  })
})

describe("household behaviours", () => {
  it("runs one day per turn of the clock and never backwards", () => {
    expect(houseSun("day", 0)).toBe(0.3)
    expect(houseSun("day", 2.2)).toBeCloseTo(2.5, 9)
    expect(houseSun("day", 3)).toBeGreaterThan(houseSun("day", 2.9))
    expect(houseSun("static", 9)).toBe(0.42)
    expect(houseSun("day", Number.NaN)).toBe(0.42)
  })

  it("only opens the garage on the arrival, and shuts it again", () => {
    expect(houseGarage("day", 0.75)).toBe(0)
    expect(houseGarage("arrive", 0.5)).toBe(0)
    expect(houseGarage("arrive", 0.75)).toBeGreaterThan(0.9)
    expect(houseGarage("arrive", 0.9)).toBe(0)
    expect(houseGarage("arrive", Number.NaN)).toBe(0)
  })
})

/** The highest point of a path, in screen coordinates: smaller is higher up. */
const topOf = (d: string) =>
  Math.min(
    ...[...d.matchAll(/-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])),
  )

describe("tower-block", () => {
  it("grows with the storey count", () => {
    const { container, rerender } = render(<TowerBlock carriage={0.5} storeys={6} />)
    expect(container.querySelectorAll("[data-storey]")).toHaveLength(6)
    const short = container.querySelector("[data-body]")!.getAttribute("d")

    rerender(<TowerBlock carriage={0.5} storeys={18} />)
    expect(container.querySelectorAll("[data-storey]")).toHaveLength(18)
    expect(container.querySelector("[data-body]")!.getAttribute("d")).not.toBe(short)
  })

  it("sends the counterweight down as the car goes up", () => {
    const { container, rerender } = render(<TowerBlock carriage={0.1} storeys={10} />)
    const lowCar = topOf(container.querySelector("[data-lift-car]")!.getAttribute("d")!)
    const lowWeight = topOf(container.querySelector("[data-counterweight]")!.getAttribute("d")!)

    rerender(<TowerBlock carriage={0.9} storeys={10} />)
    const highCar = topOf(container.querySelector("[data-lift-car]")!.getAttribute("d")!)
    const highWeight = topOf(container.querySelector("[data-counterweight]")!.getAttribute("d")!)

    // Screen y grows downward: the car rises, the weight falls, by the same amount.
    expect(highCar).toBeLessThan(lowCar)
    expect(highWeight).toBeGreaterThan(lowWeight)
    expect(lowCar - highCar).toBeCloseTo(highWeight - lowWeight, 1)
  })

  it("reports the storey it is standing at, and marks the landing", () => {
    const floors: number[] = []
    const { container, rerender } = render(
      <TowerBlock carriage={0} storeys={10} onFloorChange={(floor) => floors.push(floor)} />,
    )
    rerender(<TowerBlock carriage={1} storeys={10} onFloorChange={(floor) => floors.push(floor)} />)
    expect(floors[0]).toBe(0)
    expect(floors.at(-1)).toBeGreaterThan(5)
    expect(container.querySelector("[data-lift-car]")!.getAttribute("data-floor")).toBe(
      String(floors.at(-1)),
    )
  })

  it("closes the shaft up when it is not cut away", () => {
    const { container } = render(<TowerBlock carriage={0.4} cutaway={false} />)
    expect(container.querySelector("[data-shaft]")).toBeNull()
    expect(container.querySelector("[data-lift-car]")).toBeNull()
  })

  it("names itself and survives rubbish", () => {
    const { container } = render(
      <TowerBlock carriage={Number.NaN} storeys={Number.NaN} occupancy={Number.NaN} view="profile" />,
    )
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("12 storeys")
    expect(label).toContain("side elevation")
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "")
    expect(paths.some((d) => d.includes("NaN"))).toBe(false)
  })
})

describe("tower behaviours", () => {
  it("runs the car up and back with a dwell at each end", () => {
    expect(towerCarriage("service", 0)).toBe(0)
    expect(towerCarriage("service", 0.5)).toBe(1)
    expect(towerCarriage("service", 0.25)).toBeGreaterThan(0.4)
    expect(towerCarriage("service", 0.75)).toBeLessThan(0.6)
    expect(towerCarriage("service", 1.25)).toBeCloseTo(towerCarriage("service", 0.25), 9)
    expect(towerCarriage("static", 3)).toBe(0.35)
    expect(towerCarriage("service", Number.NaN)).toBe(0.35)
  })

  it("lights the same flats at the same occupancy every time", () => {
    expect(towerLit(3, 2, 0)).toBe(false)
    expect(towerLit(3, 2, 1)).toBe(true)
    expect(towerLit(3, 2, 0.6)).toBe(towerLit(3, 2, 0.6))
    const lowCount = grid(0.2)
    const highCount = grid(0.8)
    expect(highCount).toBeGreaterThan(lowCount)
    expect(towerLit(1, 1, Number.NaN)).toBe(false)
  })
})

const grid = (occupancy: number) => {
  let lit = 0
  for (let storey = 0; storey < 12; storey += 1) {
    for (let bay = 0; bay < 6; bay += 1) if (towerLit(storey, bay, occupancy)) lit += 1
  }
  return lit
}

describe("espresso-machine", () => {
  it("raises the piston as the lever comes down", () => {
    const { container, rerender } = render(<EspressoMachine shot={0} />)
    const rest = Number(container.querySelector("[data-piston]")!.getAttribute("data-height"))
    const restAngle = Number(container.querySelector("[data-lever]")!.getAttribute("data-angle"))

    rerender(<EspressoMachine shot={0.18} />)
    const charged = Number(container.querySelector("[data-piston]")!.getAttribute("data-height"))
    const chargedAngle = Number(container.querySelector("[data-lever]")!.getAttribute("data-angle"))

    expect(charged).toBeGreaterThan(rest)
    expect(chargedAngle).toBeLessThan(restAngle)
  })

  it("pours only while the spring is driving the piston down", () => {
    const { container, rerender } = render(<EspressoMachine shot={0.05} />)
    expect(container.querySelector("[data-stream]")).toBeNull()

    rerender(<EspressoMachine shot={0.5} />)
    expect(container.querySelector("[data-stream]")).not.toBeNull()

    rerender(<EspressoMachine shot={1} />)
    expect(container.querySelector("[data-stream]")).toBeNull()
  })

  it("puts a cup under every spout and reports the pressure", () => {
    const pressures: number[] = []
    const { container, rerender } = render(
      <EspressoMachine shot={0.2} cups={2} onPressureChange={(bar) => pressures.push(bar)} />,
    )
    expect(container.querySelectorAll("[data-cup]")).toHaveLength(2)

    rerender(<EspressoMachine shot={0.9} cups={2} onPressureChange={(bar) => pressures.push(bar)} />)
    expect(pressures[0]).toBeGreaterThan(pressures.at(-1)!)
  })

  it("names the pressure and survives rubbish", () => {
    const { container } = render(<EspressoMachine shot={Number.NaN} wand={Number.NaN} view="iso" />)
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("bar at the group")
    expect(label).toContain("isometric view")
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "")
    expect(paths.some((d) => d.includes("NaN"))).toBe(false)
  })
})

describe("espresso behaviours", () => {
  it("charges fast and declines all the way down", () => {
    expect(espressoLever(0)).toBe(0)
    expect(espressoLever(0.18)).toBeCloseTo(1, 6)
    expect(espressoLever(0.56)).toBeCloseTo(0.507, 2)
    expect(espressoLever(1)).toBe(0)

    expect(espressoPressure(0.18)).toBeGreaterThan(8)
    expect(espressoPressure(0.18)).toBeLessThan(10)
    expect(espressoPressure(0.4)).toBeGreaterThan(espressoPressure(0.7))
    expect(espressoPressure(1)).toBeLessThan(1)
    expect(espressoPressure(Number.NaN)).toBeLessThan(1)
  })

  it("fills the cup once, monotonically, and only while it pours", () => {
    expect(espressoYield(0.1)).toBe(0)
    expect(espressoYield(0.5)).toBeGreaterThan(0)
    expect(espressoYield(0.5)).toBeLessThan(espressoYield(0.9))
    expect(espressoYield(1)).toBeGreaterThan(0.85)
    expect(espressoYield(1)).toBeLessThanOrEqual(1)
    expect(espressoPouring(0.1)).toBe(false)
    expect(espressoPouring(0.5)).toBe(true)
    expect(espressoPouring(0.99)).toBe(false)
    expect(espressoShot("idle", 3.2)).toBe(0)
    expect(espressoShot("pull", 2.25)).toBeCloseTo(0.25, 9)
  })
})

describe("refrigerator", () => {
  it("swings the leaf without stretching it, and shows the inside", () => {
    const { container, rerender } = render(<Refrigerator door={0} />)
    const shut = container.querySelector('[data-door="fresh"] path')!.getAttribute("d")
    expect(container.querySelector("[data-interior]")).toBeNull()

    rerender(<Refrigerator door={0.6} />)
    expect(container.querySelector('[data-door="fresh"] path')!.getAttribute("d")).not.toBe(shut)
    expect(container.querySelector("[data-interior]")).not.toBeNull()
    expect(container.querySelector("[data-lamp]")).not.toBeNull()
    expect(container.querySelector('[data-door="fresh"]')!.getAttribute("data-open")).toBe("0.6")
  })

  it("keeps the lamp off until the door switch makes", () => {
    const { container, rerender } = render(<Refrigerator door={0.02} />)
    expect(container.querySelector("[data-lamp]")).toBeNull()
    rerender(<Refrigerator door={0.08} />)
    expect(container.querySelector("[data-lamp]")).not.toBeNull()
  })

  it("gives each layout its own leaves", () => {
    const { container, rerender } = render(<Refrigerator door={0.4} layout="top-freezer" />)
    expect(container.querySelectorAll("[data-door]")).toHaveLength(2)

    rerender(<Refrigerator door={0.4} layout="single" />)
    expect(container.querySelectorAll("[data-door]")).toHaveLength(1)

    rerender(<Refrigerator door={0.4} freezer={0.4} layout="side-by-side" />)
    expect(container.querySelectorAll("[data-door]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-shelf]").length).toBeGreaterThanOrEqual(3)
  })

  it("names the layout and survives rubbish", () => {
    const { container } = render(
      <Refrigerator door={Number.NaN} shelves={Number.NaN} view="plan" layout="single" />,
    )
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("single")
    expect(label).toContain("plan view")
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "")
    expect(paths.some((d) => d.includes("NaN"))).toBe(false)
  })
})

describe("refrigerator behaviours", () => {
  it("opens one door at a time on a service cycle", () => {
    expect(fridgeDoor("service", 0.2)).toBe(1)
    expect(fridgeFreezer("service", 0.2)).toBe(0)
    expect(fridgeFreezer("service", 0.7)).toBe(1)
    expect(fridgeDoor("service", 0.7)).toBe(0)
    expect(fridgeDoor("idle", 0.2)).toBe(0)
    expect(fridgeDoor("static", 0.2)).toBe(0.55)
    expect(fridgeFreezer("idle", 0.7)).toBe(0)
  })

  it("cycles the compressor on the clock and nothing else", () => {
    expect(fridgeDuty(0)).toBe(true)
    expect(fridgeDuty(0.4)).toBe(false)
    expect(fridgeDuty(Number.NaN)).toBe(false)
  })
})

describe("washing-machine", () => {
  it("throws the load at a wash speed and pins it at a spin", () => {
    const { container, rerender } = render(<WashingMachine rpm={48} load={6} phase={0.3} />)
    expect(container.querySelector("[data-drum]")!.getAttribute("data-regime")).toBe("cataracting")
    expect(container.querySelectorAll("[data-item]")).toHaveLength(6)

    rerender(<WashingMachine rpm={1200} load={6} phase={0.3} />)
    expect(container.querySelector("[data-drum]")!.getAttribute("data-regime")).toBe("centrifuging")
    const airborne = [...container.querySelectorAll("[data-item]")].map((item) =>
      item.getAttribute("data-airborne"),
    )
    expect(airborne.every((value) => value === "false")).toBe(true)
  })

  it("is worse at its critical speed than well above it", () => {
    const { container, rerender } = render(<WashingMachine rpm={80} />)
    const quiet = Number(container.querySelector("[data-tub]")!.getAttribute("data-offset"))

    rerender(<WashingMachine rpm={320} />)
    const resonant = Number(container.querySelector("[data-tub]")!.getAttribute("data-offset"))

    rerender(<WashingMachine rpm={1400} />)
    const fast = Number(container.querySelector("[data-tub]")!.getAttribute("data-offset"))

    expect(resonant).toBeGreaterThan(quiet * 3)
    expect(resonant).toBeGreaterThan(fast * 3)
  })

  it("empties the drum before it spins", () => {
    const { container, rerender } = render(<WashingMachine rpm={48} />)
    expect(container.querySelector("[data-water]")).not.toBeNull()
    rerender(<WashingMachine rpm={900} />)
    expect(container.querySelector("[data-water]")).toBeNull()
  })

  it("gives the top loader a lid and a vertical axis, and no solved tumble", () => {
    const { container, rerender } = render(
      <WashingMachine rpm={40} loading="top" door={0.8} view="iso" />,
    )
    expect(container.querySelector("[data-lid]")).not.toBeNull()
    expect(container.querySelector("[data-agitator]")).not.toBeNull()
    expect(container.querySelectorAll("[data-item]")).toHaveLength(0)

    // From the front you cannot see down the mouth, so it is not drawn.
    rerender(<WashingMachine rpm={40} loading="top" door={0.8} view="front" />)
    expect(container.querySelector("[data-mouth]")).toBeNull()
  })

  it("names the speed and the regime, and survives rubbish", () => {
    const { container } = render(
      <WashingMachine rpm={Number.NaN} load={Number.NaN} water={Number.NaN} programme={Number.NaN} />,
    )
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("0 rpm")
    expect(label).toContain("resting")
    const paths = [...container.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "")
    expect(paths.some((d) => d.includes("NaN"))).toBe(false)
  })
})

describe("washing behaviours", () => {
  it("runs a wash, then a spin that passes through resonance", () => {
    expect(washRpm("cycle", 0.1)).toBeLessThan(60)
    expect(washRpm("cycle", 0.85)).toBeGreaterThan(1000)
    expect(washRpm("spin", 0.05)).toBeLessThan(washRpm("spin", 0.4))
    expect(washRpm("spin", 0.99)).toBeLessThan(200)
    expect(washRpm("dry", 0.5)).toBe(52)
    expect(washRpm("static", 9)).toBe(48)
    expect(washRpm("cycle", Number.NaN)).toBe(48)
  })

  it("has no water in it once the pump has run", () => {
    expect(washWater("cycle", 46)).toBeGreaterThan(0)
    expect(washWater("cycle", 900)).toBe(0)
    expect(washWater("dry", 40)).toBe(0)
    expect(washWater("cycle", Number.NaN)).toBe(0)
  })
})

describe("washing-machine door", () => {
  it("swings the porthole open without changing its diameter", () => {
    const { container, rerender } = render(<WashingMachine rpm={0} door={0} />)
    const shut = container.querySelector("[data-door]")!.getAttribute("d")!
    rerender(<WashingMachine rpm={0} door={0.6} />)
    const open = container.querySelector("[data-door]")!.getAttribute("d")!
    expect(open).not.toBe(shut)
    // A turned disc foreshortens: it never gets wider than it was square on.
    const spread = (d: string) => {
      const xs = [...d.matchAll(/[ML] (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]))
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(spread(open)).toBeLessThan(spread(shut) + 0.5)
    expect(container.querySelector("[data-door]")!.getAttribute("data-open")).toBe("0.6")
  })
})

describe("live readouts", () => {
  it("reports what the machine is doing, not only what a pointer did", () => {
    const days: number[] = []
    const { rerender: rerenderHouse } = render(
      <GabledHouse sun={0.4} onSunChange={(sun) => days.push(sun)} />,
    )
    rerenderHouse(<GabledHouse sun={0.7} onSunChange={(sun) => days.push(sun)} />)
    expect(days.at(-1)).toBeCloseTo(0.7, 2)
    cleanup()

    const rpms: number[] = []
    const { rerender: rerenderWasher } = render(
      <WashingMachine rpm={40} onRpmChange={(value) => rpms.push(value)} />,
    )
    rerenderWasher(<WashingMachine rpm={1200} onRpmChange={(value) => rpms.push(value)} />)
    expect(rpms.at(-1)).toBe(1200)
    cleanup()

    const doors: number[] = []
    const { rerender: rerenderFridge } = render(
      <Refrigerator door={0} onDoorChange={(value) => doors.push(value)} />,
    )
    rerenderFridge(<Refrigerator door={0.8} onDoorChange={(value) => doors.push(value)} />)
    expect(doors.at(-1)).toBeCloseTo(0.8, 2)
  })
})

describe("refrigerator door face", () => {
  it("draws the leaf's own furniture while the front of it is in view", () => {
    const { container, rerender } = render(<Refrigerator door={0} />)
    expect(container.querySelectorAll("[data-handle]").length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector("[data-display]")).not.toBeNull()

    // Swung right past the camera, the leaf shows its back: no handle on it.
    rerender(<Refrigerator door={1} freezer={0} />)
    const handles = container.querySelectorAll("[data-handle]").length
    expect(handles).toBeLessThan(2)
  })
})
