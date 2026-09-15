import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { RobotView } from "@/lib/robocn/style"
import {
  PUMPJACK_SERVICE_ANGLE,
  Pumpjack,
  pumpjackCarrier,
  pumpjackCrank,
  pumpjackParts,
  pumpjackService,
} from "@/components/ui/pumpjack"
import { DrillingDerrick, derrickHoist } from "@/components/ui/drilling-derrick"
import { MudPump, mudPumpCrank, mudPumpFlow } from "@/components/ui/mud-pump"
import { WellheadTree, wellheadChoke } from "@/components/ui/wellhead-tree"
import { StorageTank, storageTankLadder, storageTankLevel } from "@/components/ui/storage-tank"
import { OilTanker, oilTankerCargo } from "@/components/ui/oil-tanker"
import {
  TankerTruck,
  tankerTruckLevel,
  tankerTruckRoadSpeed,
  tankerTruckSteer,
} from "@/components/ui/tanker-truck"
import { FlareStack, flareStackFlow } from "@/components/ui/flare-stack"
import { FractionatingColumn, columnHeat } from "@/components/ui/fractionating-column"
import { JackupRig, jackupElevation } from "@/components/ui/jackup-rig"

afterEach(cleanup)

const transform = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)?.getAttribute("d") ?? null

const hasNaN = (container: HTMLElement) =>
  container.querySelector("svg")!.innerHTML.includes("NaN")

describe("pumpjack", () => {
  it("turns the whole loop when the crank turns", () => {
    const { container, rerender } = render(<Pumpjack animate={false} crankAngle={0} />)
    const beam = container.querySelector("[data-beam]")!.getAttribute("data-angle")
    const pitman = transform(container, "[data-pitman]")
    const rod = container.querySelector("[data-rod]")!.getAttribute("data-position")

    rerender(<Pumpjack animate={false} crankAngle={90} />)

    expect(container.querySelector("[data-beam]")!.getAttribute("data-angle")).not.toBe(beam)
    expect(transform(container, "[data-pitman]")).not.toBe(pitman)
    expect(container.querySelector("[data-rod]")!.getAttribute("data-position")).not.toBe(rod)
  })

  it("moves the carrier bar by the arc the horsehead has rolled through", () => {
    // Half a turn of the crank is one full stroke, up and back down again.
    const samples = Array.from({ length: 72 }, (_, index) => pumpjackCarrier(index * 5))
    const top = Math.max(...samples)
    const bottom = Math.min(...samples)
    expect(top - bottom).toBeGreaterThan(30)
    // The stroke repeats exactly once a revolution.
    expect(pumpjackCarrier(360)).toBeCloseTo(pumpjackCarrier(0), 6)
    expect(pumpjackCarrier(Number.NaN)).toBeCloseTo(pumpjackCarrier(0), 6)
  })

  it("carries the counterweight where the balance says", () => {
    const { container, rerender } = render(<Pumpjack animate={false} crankAngle={40} balance="crank" />)
    const onCrank = transform(container, "[data-counterweight]")

    rerender(<Pumpjack animate={false} crankAngle={40} balance="beam" />)
    expect(transform(container, "[data-counterweight]")).not.toBe(onCrank)

    rerender(<Pumpjack animate={false} crankAngle={40} balance="air" />)
    expect(container.querySelector("[data-counterweight]")).not.toBeNull()
  })


  it("comes apart in the reverse of the order it went together, and seats again exactly", () => {
    const { container, rerender } = render(<Pumpjack animate={false} crankAngle={0} explode={0} />)
    // Seated is seated: no part carries a displacement at all.
    expect(container.querySelectorAll("[data-part][transform]").length).toBe(0)
    const beamSeated = transform(container, "[data-horsehead]")

    rerender(<Pumpjack animate={false} crankAngle={0} explode={1} view="iso" />)
    const apart = container.querySelectorAll("[data-part][transform]")
    expect(apart.length).toBeGreaterThan(6)

    // The rod is the first thing off, the post among the last.
    const rank = (id: string) =>
      Number(container.querySelector(`[data-part="${id}"]`)!.getAttribute("data-rank"))
    expect(rank("rod")).toBeLessThan(rank("pitman-port"))
    expect(rank("pitman-port")).toBeLessThan(rank("crank-port"))
    expect(rank("crank-port")).toBeLessThan(rank("beam"))
    expect(rank("beam")).toBeLessThan(rank("post"))

    rerender(<Pumpjack animate={false} crankAngle={0} explode={0} />)
    expect(container.querySelectorAll("[data-part][transform]").length).toBe(0)
    expect(transform(container, "[data-horsehead]")).toBe(beamSeated)
  })

  it("parks the linkage level before it takes anything apart", () => {
    // The service angle is scanned, not typed: it really does level the beam.
    expect(Math.abs(pumpjackService().beamAngle)).toBeLessThan(0.25)

    const { container } = render(<Pumpjack animate={false} explode={1} />)
    expect(Number(container.querySelector("[data-beam]")!.getAttribute("data-angle"))).toBeCloseTo(0, 1)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("apart")
  })

  it("takes the handed pairs off sideways and leaves the well alone", () => {
    const lateral = pumpjackParts().filter((part) => Math.abs(part.axis.x) > 0.5)
    expect(lateral.map((part) => part.id).sort()).toEqual([
      "crank-port", "crank-starboard",
      "pitman-port", "pitman-starboard",
      "weight-port", "weight-starboard",
    ])
    // Handed: the two sides leave along opposite axes.
    const port = lateral.find((part) => part.id === "pitman-port")!
    const starboard = lateral.find((part) => part.id === "pitman-starboard")!
    expect(Math.sign(port.axis.x)).toBe(-Math.sign(starboard.axis.x))
    // The wellhead is the well, not the pump: it is not in the assembly.
    expect(pumpjackParts().some((part) => part.id === "wellhead")).toBe(false)
  })

  it("draws leaders back to the seat only while it is apart", () => {
    const { container, rerender } = render(<Pumpjack animate={false} explode={0} showLeaders />)
    expect(container.querySelectorAll("[data-leader]").length).toBe(0)

    rerender(<Pumpjack animate={false} explode={0.8} showLeaders view="iso" />)
    expect(container.querySelectorAll("[data-leader]").length).toBeGreaterThan(4)

    rerender(<Pumpjack animate={false} explode={0.8} showLeaders={false} view="iso" />)
    expect(container.querySelectorAll("[data-leader]").length).toBe(0)
  })

  it("renders a seated machine for rubbish explode input", () => {
    const { container } = render(<Pumpjack animate={false} crankAngle={0} explode={Number.NaN} />)
    expect(hasNaN(container)).toBe(false)
    expect(container.querySelectorAll("[data-part][transform]").length).toBe(0)
    expect(PUMPJACK_SERVICE_ANGLE).toBeGreaterThanOrEqual(0)
    expect(PUMPJACK_SERVICE_ANGLE).toBeLessThan(360)
  })

  it("hands a person the teardown when that is the axis asked for", () => {
    const onExplode = vi.fn()
    const { container } = render(
      <Pumpjack animate={false} control="explode" interactive onExplodeChange={onExplode} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("aria-valuemax")).toBe("100")
    svg.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
    expect(onExplode).toHaveBeenCalledWith(1)
    expect(svg.getAttribute("aria-valuetext")).toContain("percent apart")
  })

  it("names itself, its crank and its view", () => {
    const { container } = render(<Pumpjack animate={false} crankAngle={120} view="iso" />)
    const label = container.querySelector("svg")!.getAttribute("aria-label")!
    expect(label).toContain("Beam pump")
    expect(label).toContain("120 degrees")
    expect(label).toContain("isometric")
  })

  it("reports the crank from the keyboard and stops when interaction is off", () => {
    const onChange = vi.fn()
    const { container, rerender } = render(
      <Pumpjack animate={false} crankAngle={0} interactive onCrankAngleChange={onChange} />,
    )
    const svg = container.querySelector("svg")!
    expect(svg.getAttribute("role")).toBe("slider")
    svg.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    expect(onChange).toHaveBeenCalledWith(5)

    onChange.mockClear()
    rerender(<Pumpjack animate={false} crankAngle={0} onCrankAngleChange={onChange} />)
    container.querySelector("svg")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    )
    expect(onChange).not.toHaveBeenCalled()
  })

  it("draws a stable pose for a non-finite crank angle", () => {
    const { container } = render(<Pumpjack animate={false} crankAngle={Number.NaN} />)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples pump as one revolution a cycle and slow as a duty cycle", () => {
    expect(pumpjackCrank("pump", 1) - pumpjackCrank("pump", 0)).toBeCloseTo(360, 6)
    expect(pumpjackCrank("static", 0.4)).toBe(0)
    expect(pumpjackCrank("pump", Number.NaN)).toBe(0)
    // Two turns in the first 60% of the cycle, then a rest.
    expect(pumpjackCrank("slow", 0.6)).toBeCloseTo(720, 6)
    expect(pumpjackCrank("slow", 0.9)).toBeCloseTo(720, 6)
    expect(pumpjackCrank("slow", 1.3) - pumpjackCrank("slow", 1)).toBeGreaterThan(0)
  })
})

describe("drilling derrick", () => {
  it("lowers the block and turns the drum to do it", () => {
    const { container, rerender } = render(<DrillingDerrick animate={false} hoist={0.9} />)
    const high = container.querySelector("[data-block]")!.getAttribute("data-height")!
    const turns = container.querySelector("[data-drum]")!.getAttribute("data-turns")!

    rerender(<DrillingDerrick animate={false} hoist={0.2} />)

    expect(Number(container.querySelector("[data-block]")!.getAttribute("data-height"))).toBeLessThan(Number(high))
    expect(Number(container.querySelector("[data-drum]")!.getAttribute("data-turns"))).toBeGreaterThan(Number(turns))
  })

  it("makes the drum work harder the more lines are strung", () => {
    const { container, rerender } = render(<DrillingDerrick animate={false} hoist={0.3} lines={4} />)
    const four = Number(container.querySelector("[data-drum]")!.getAttribute("data-turns"))
    const block = container.querySelector("[data-block]")!.getAttribute("data-height")

    rerender(<DrillingDerrick animate={false} hoist={0.3} lines={12} />)

    // Same block height, three times the drum: that is the advantage, drawn.
    expect(container.querySelector("[data-block]")!.getAttribute("data-height")).toBe(block)
    expect(Number(container.querySelector("[data-drum]")!.getAttribute("data-turns"))).toBeCloseTo(four * 3, 1)
  })

  it("reeves one fall per line", () => {
    for (const lines of [4, 8, 12] as const) {
      const { container } = render(<DrillingDerrick animate={false} hoist={0.5} lines={lines} />)
      const rope = container.querySelector("[data-falls]")!
      expect(rope.getAttribute("data-lines")).toBe(String(lines))
      expect(rope.getAttribute("d")!.match(/[ML]/g)).toHaveLength(lines + 1)
      cleanup()
    }
  })

  it("names itself and stays finite for nonsense input", () => {
    const { container } = render(<DrillingDerrick animate={false} hoist={Number.NaN} view="plan" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("Drilling derrick")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("plan view")
    expect(hasNaN(container)).toBe(false)
  })

  it("samples trip across the mast and drill as a slow feed", () => {
    const trip = [0, 0.25, 0.5, 0.75].map((t) => derrickHoist("trip", t))
    expect(Math.max(...trip)).toBeLessThanOrEqual(1)
    expect(Math.min(...trip)).toBeGreaterThanOrEqual(0)
    expect(derrickHoist("drill", 0.1)).toBeGreaterThan(derrickHoist("drill", 0.7))
    expect(derrickHoist("static", 0.4)).toBe(derrickHoist("static", Number.NaN))
  })
})

describe("mud pump", () => {
  it("puts each cylinder at its own point in the cycle", () => {
    const { container } = render(<MudPump animate={false} crankAngle={40} cylinders={3} />)
    const pistons = [...container.querySelectorAll("[data-piston]")].map((node) =>
      Number(node.getAttribute("data-position")),
    )
    expect(pistons).toHaveLength(3)
    expect(new Set(pistons.map((value) => value.toFixed(2))).size).toBe(3)
  })

  it("turns every cylinder when the crankshaft turns", () => {
    const { container, rerender } = render(<MudPump animate={false} crankAngle={0} />)
    const before = [...container.querySelectorAll("[data-piston]")].map((n) => n.getAttribute("data-position"))
    rerender(<MudPump animate={false} crankAngle={70} />)
    const after = [...container.querySelectorAll("[data-piston]")].map((n) => n.getAttribute("data-position"))
    expect(after).not.toEqual(before)
  })

  it("gets a steadier discharge the more cylinders it has", () => {
    const ripple = (count: number) => {
      const samples = Array.from({ length: 180 }, (_, index) => mudPumpFlow(index * 2, count))
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
      return (Math.max(...samples) - Math.min(...samples)) / mean
    }
    expect(ripple(3)).toBeLessThan(ripple(2))
    expect(ripple(2)).toBeLessThan(ripple(1))
    expect(mudPumpFlow(Number.NaN, 3)).toBeGreaterThanOrEqual(0)
  })

  it("draws only the cylinders it was asked for, and stays finite", () => {
    const { container, rerender } = render(<MudPump animate={false} crankAngle={20} cylinders={1} />)
    expect(container.querySelectorAll("[data-cylinder]")).toHaveLength(1)
    rerender(<MudPump animate={false} crankAngle={Number.NaN} cylinders={2} />)
    expect(container.querySelectorAll("[data-cylinder]")).toHaveLength(2)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples stroke as one revolution and surge as an uneven one", () => {
    expect(mudPumpCrank("stroke", 1) - mudPumpCrank("stroke", 0)).toBeCloseTo(360, 6)
    expect(mudPumpCrank("surge", 0.25)).not.toBeCloseTo(mudPumpCrank("stroke", 0.25), 1)
    expect(mudPumpCrank("static", 0.6)).toBe(0)
    expect(mudPumpCrank("surge", Number.NaN)).toBe(0)
  })
})

describe("wellhead tree", () => {
  it("lines the valves up for the service it is asked for", () => {
    const open = (container: HTMLElement, name: string) =>
      container.querySelector(`[data-valve="${name}"]`)!.getAttribute("data-open")

    const { container, rerender } = render(<WellheadTree animate={false} choke={0.6} service="production" />)
    expect(open(container, "master")).toBe("true")
    expect(open(container, "wing-right")).toBe("true")
    expect(open(container, "wing-left")).toBe("false")
    expect(container.querySelector("[data-flow]")).not.toBeNull()

    rerender(<WellheadTree animate={false} choke={0.6} service="shut-in" />)
    expect(open(container, "master")).toBe("false")
    // Shut the master and nothing above it is live, choke or no choke.
    expect(container.querySelector("[data-flow]")).toBeNull()

    rerender(<WellheadTree animate={false} choke={0.6} service="kill" />)
    expect(open(container, "wing-left")).toBe("true")
    expect(open(container, "wing-right")).toBe("false")
  })

  it("moves the choke and nothing else when the choke moves", () => {
    const { container, rerender } = render(<WellheadTree animate={false} choke={0.1} />)
    const shut = container.querySelector("[data-choke]")!.getAttribute("data-opening")
    const gauge = container.querySelector("[data-gauge]")!.getAttribute("data-reading")

    rerender(<WellheadTree animate={false} choke={0.9} />)

    expect(container.querySelector("[data-choke]")!.getAttribute("data-opening")).not.toBe(shut)
    // The gauge is a supplied reading, never inferred from the choke.
    expect(container.querySelector("[data-gauge]")!.getAttribute("data-reading")).toBe(gauge)
  })

  it("points the needle only at the reading it is given", () => {
    const { container, rerender } = render(<WellheadTree animate={false} choke={0.5} pressure={0.2} />)
    const low = container.querySelector("[data-gauge]")!.getAttribute("data-reading")
    rerender(<WellheadTree animate={false} choke={0.5} pressure={0.8} />)
    expect(container.querySelector("[data-gauge]")!.getAttribute("data-reading")).not.toBe(low)
    rerender(<WellheadTree animate={false} choke={0.5} pressure={Number.NaN} />)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples throttle across the range and shut-in down to nothing", () => {
    expect(wellheadChoke("throttle", 0.5)).toBeGreaterThan(wellheadChoke("throttle", 0))
    expect(wellheadChoke("shut-in", 0.9)).toBe(0)
    expect(wellheadChoke("static", 0.3)).toBe(wellheadChoke("static", Number.NaN))
  })
})

describe("storage tank", () => {
  it("floats the roof on the liquid and lays the ladder down with it", () => {
    const { container, rerender } = render(<StorageTank animate={false} level={0.1} />)
    const low = Number(container.querySelector("[data-roof]")!.getAttribute("data-height"))
    const ladder = container.querySelector("[data-ladder]")!.getAttribute("d")

    rerender(<StorageTank animate={false} level={0.9} />)

    expect(Number(container.querySelector("[data-roof]")!.getAttribute("data-height"))).toBeGreaterThan(low)
    expect(container.querySelector("[data-ladder]")!.getAttribute("d")).not.toBe(ladder)
  })

  it("keeps the ladder's length whatever the level", () => {
    const reaches = [0.1, 0.3, 0.5, 0.7, 0.9].map((level) => storageTankLadder(level).reach)
    for (const reach of reaches) expect(reach).toBeCloseTo(reaches[0], 6)
    expect(storageTankLadder(Number.NaN).reach).toBeGreaterThan(0)
  })

  it("parks a fixed roof at the top and leaves the level on the gauge", () => {
    const { container, rerender } = render(<StorageTank animate={false} level={0.2} roof="fixed" />)
    const top = container.querySelector("[data-roof]")!.getAttribute("data-height")
    const gauge = container.querySelector("[data-liquid]")!.getAttribute("d")

    rerender(<StorageTank animate={false} level={0.8} roof="fixed" />)

    expect(container.querySelector("[data-roof]")!.getAttribute("data-height")).toBe(top)
    expect(container.querySelector("[data-liquid]")!.getAttribute("d")).not.toBe(gauge)
  })

  it("names itself and survives nonsense", () => {
    const { container } = render(<StorageTank animate={false} level={Number.NaN} courses={Number.NaN} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("Storage tank")
    expect(hasNaN(container)).toBe(false)
  })

  it("samples fill up and back, and draw as a slow run-down", () => {
    expect(storageTankLevel("fill", 0.5)).toBeGreaterThan(storageTankLevel("fill", 0))
    expect(storageTankLevel("draw", 0.1)).toBeGreaterThan(storageTankLevel("draw", 0.7))
    expect(storageTankLevel("static", 0.4)).toBe(storageTankLevel("static", Number.NaN))
  })
})

describe("oil tanker", () => {
  it("sinks the hull into the water as she loads, and leaves the sea where it is", () => {
    const { container, rerender } = render(<OilTanker animate={false} cargo={0} />)
    const light = Number(container.querySelector("[data-hull]")!.getAttribute("data-draft"))
    const sea = container.querySelector("[data-waterline]")!.getAttribute("d")
    const boot = container.querySelector("[data-boot]")!.getAttribute("d")

    rerender(<OilTanker animate={false} cargo={1} />)

    expect(Number(container.querySelector("[data-hull]")!.getAttribute("data-draft"))).toBeGreaterThan(light)
    expect(container.querySelector("[data-waterline]")!.getAttribute("d")).toBe(sea)
    // The boot top is painted on the hull, so it goes under with her.
    expect(container.querySelector("[data-boot]")!.getAttribute("d")).not.toBe(boot)
  })

  it("draws a hatch per tank and reports the cargo", () => {
    const { container } = render(<OilTanker animate={false} cargo={0.5} tanks={9} />)
    expect(container.querySelector("[data-cargo]")!.getAttribute("data-level")).toBe("0.5")
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("50 percent laden")
  })

  it("stays finite for nonsense cargo and a silly tank count", () => {
    const { container } = render(<OilTanker animate={false} cargo={Number.NaN} tanks={Number.NaN} view="iso" />)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples a whole port call, and holds her cargo in a swell", () => {
    expect(oilTankerCargo("laden", 0.45)).toBeGreaterThan(oilTankerCargo("laden", 0))
    expect(oilTankerCargo("swell", 0.2)).toBe(oilTankerCargo("swell", 0.8))
    expect(oilTankerCargo("static", 0.3)).toBe(oilTankerCargo("static", Number.NaN))
  })
})

describe("tanker truck", () => {
  it("yaws the trailer about the kingpin without moving the tractor", () => {
    const { container, rerender } = render(<TankerTruck animate={false} level={0.7} hitch={0} />)
    const barrel = container.querySelector("[data-barrel]")!.getAttribute("d")
    const cab = container.querySelector("[data-tractor]")!.innerHTML

    rerender(<TankerTruck animate={false} level={0.7} hitch={40} />)

    expect(container.querySelector("[data-barrel]")!.getAttribute("d")).not.toBe(barrel)
    expect(container.querySelector("[data-tractor]")!.innerHTML).toBe(cab)
    expect(container.querySelector("[data-trailer]")!.getAttribute("data-hitch")).toBe("40")
  })

  it("solves the trailer's angle from the steer, and signs it with the turn", () => {
    const { container, rerender } = render(<TankerTruck animate={false} steer={0} />)
    expect(container.querySelector("[data-trailer]")!.getAttribute("data-hitch")).toBe("0")

    rerender(<TankerTruck animate={false} steer={40} />)
    const right = Number(container.querySelector("[data-trailer]")!.getAttribute("data-hitch"))
    expect(Math.abs(right)).toBeGreaterThan(5)

    rerender(<TankerTruck animate={false} steer={-40} />)
    expect(
      Number(container.querySelector("[data-trailer]")!.getAttribute("data-hitch")),
    ).toBeCloseTo(-right, 1)
  })

  it("lets a supplied hitch override the solution", () => {
    const { container } = render(<TankerTruck animate={false} steer={40} hitch={12} />)
    expect(container.querySelector("[data-trailer]")!.getAttribute("data-hitch")).toBe("12")
  })

  it("turns the inner steer wheel harder than the outer one", () => {
    const { container } = render(<TankerTruck animate={false} steer={30} />)
    const left = Number(
      container.querySelector('[data-wheel="steer-left"]')!.getAttribute("data-angle"),
    )
    const right = Number(
      container.querySelector('[data-wheel="steer-right"]')!.getAttribute("data-angle"),
    )
    // Starboard turn: the off-side wheel is the inside one.
    expect(right).toBeGreaterThan(left)
    expect(
      container.querySelector('[data-wheel="drive-1-left"]')!.getAttribute("data-angle"),
    ).toBe("0")
  })

  it("samples a rack that only the yard manoeuvre really works, and a road that stops", () => {
    expect(Math.abs(tankerTruckSteer("manoeuvre", 0.5))).toBeGreaterThan(
      Math.abs(tankerTruckSteer("haul", 0.5)),
    )
    expect(tankerTruckSteer("discharge", 0.4)).toBe(0)
    expect(tankerTruckSteer("static", 0.4)).toBe(tankerTruckSteer("static", Number.NaN))
    expect(tankerTruckRoadSpeed("haul")).toBeGreaterThan(tankerTruckRoadSpeed("manoeuvre"))
    expect(tankerTruckRoadSpeed("discharge")).toBe(0)
    expect(tankerTruckRoadSpeed("static")).toBe(0)
  })

  it("empties the compartments from the rear", () => {
    const { container } = render(<TankerTruck animate={false} level={0.5} compartments={4} />)
    const gauges = [...container.querySelectorAll("[data-compartment]")]
    expect(gauges).toHaveLength(4)
    // Half a load leaves the front pots full and the rear ones empty.
    const filled = gauges.map((node) => node.querySelectorAll("path").length)
    expect(filled.every((count) => count === 2)).toBe(true)
    const heights = gauges.map((node) => node.querySelectorAll("path")[1].getAttribute("d"))
    expect(new Set(heights).size).toBeGreaterThan(1)
    // Half a load leaves the front pots full and the rear ones empty, which is
    // the order a road tanker actually discharges in. The dome collars say so
    // without having to measure a gauge.
    const collars = [...container.querySelectorAll("[data-charged]")].map((node) =>
      node.getAttribute("data-charged"),
    )
    expect(collars).toEqual(["true", "true", "false", "false"])
  })

  it("clamps a silly hitch and stays finite", () => {
    const { container } = render(
      <TankerTruck animate={false} level={Number.NaN} hitch={Number.NaN} compartments={99} view="plan" />,
    )
    expect(container.querySelector("[data-trailer]")!.getAttribute("data-hitch")).toBe("0")
    expect(container.querySelectorAll("[data-compartment]")).toHaveLength(6)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples a full haul and a delivery round that steps down", () => {
    expect(tankerTruckLevel("haul", 0.3)).toBe(tankerTruckLevel("haul", 0.9))
    expect(tankerTruckLevel("discharge", 0.1)).toBeGreaterThan(tankerTruckLevel("discharge", 0.9))
    expect(tankerTruckLevel("static", 0.2)).toBe(tankerTruckLevel("static", Number.NaN))
  })
})

describe("flare stack", () => {
  it("grows the plume with the flow and leans it with the wind", () => {
    const { container, rerender } = render(<FlareStack animate={false} flow={0.1} wind={0} />)
    const low = container.querySelector("[data-plume]")!.innerHTML

    rerender(<FlareStack animate={false} flow={0.95} wind={0} />)
    const high = container.querySelector("[data-plume]")!.innerHTML
    expect(high).not.toBe(low)

    rerender(<FlareStack animate={false} flow={0.95} wind={40} />)
    expect(container.querySelector("[data-plume]")!.innerHTML).not.toBe(high)
  })

  it("keeps the pilots lit however little is flowing", () => {
    const { container } = render(<FlareStack animate={false} flow={0} />)
    expect(container.querySelectorAll("[data-pilot]")).toHaveLength(2)
    expect(container.querySelector("[data-plume]")!.getAttribute("data-flow")).toBe("0")
  })

  it("names itself, its flow and its lean, and clamps nonsense", () => {
    const { container } = render(<FlareStack animate={false} flow={Number.NaN} wind={Number.NaN} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("Flare stack")
    expect(hasNaN(container)).toBe(false)
  })

  it("samples a relief event that decays, and pilots that do not", () => {
    expect(flareStackFlow("flare", 0.14)).toBeCloseTo(1, 6)
    expect(flareStackFlow("flare", 0.8)).toBeLessThan(flareStackFlow("flare", 0.3))
    expect(flareStackFlow("pilot", 0.5)).toBeLessThan(0.12)
    expect(flareStackFlow("static", 0.2)).toBe(flareStackFlow("static", Number.NaN))
  })
})

describe("fractionating column", () => {
  it("rebuilds the column when the tray count changes", () => {
    const { container, rerender } = render(<FractionatingColumn animate={false} heat={0.5} trays={8} />)
    expect(container.querySelectorAll("[data-tray]")).toHaveLength(8)
    const first = container.querySelector('[data-tray="0"]')!.getAttribute("transform")

    rerender(<FractionatingColumn animate={false} heat={0.5} trays={20} />)

    expect(container.querySelectorAll("[data-tray]")).toHaveLength(20)
    expect(container.querySelector('[data-tray="0"]')!.getAttribute("transform")).toBe(first)
    // Closer spacing: the top tray of twenty sits where the top of eight did.
    expect(container.querySelector('[data-tray="19"]')!.getAttribute("transform")).not.toBeNull()
  })

  it("runs exactly one draw at a time", () => {
    const { container, rerender } = render(<FractionatingColumn animate={false} heat={0.5} cut={0} />)
    const live = () => [...container.querySelectorAll("[data-draw]")].filter((n) => n.getAttribute("data-live") === "true")
    expect(live()).toHaveLength(1)
    expect(live()[0].getAttribute("data-draw")).toBe("0")

    rerender(<FractionatingColumn animate={false} heat={0.5} cut={3} />)
    expect(live()[0].getAttribute("data-draw")).toBe("3")
  })

  it("moves the flash zone with the heat", () => {
    const { container, rerender } = render(<FractionatingColumn animate={false} heat={0.1} />)
    const cool = Number(container.querySelector("[data-flash]")!.getAttribute("data-height"))
    rerender(<FractionatingColumn animate={false} heat={0.9} />)
    expect(Number(container.querySelector("[data-flash]")!.getAttribute("data-height"))).toBeGreaterThan(cool)
  })

  it("clamps a silly tray count and a nonsense cut", () => {
    const { container } = render(
      <FractionatingColumn animate={false} heat={Number.NaN} trays={200} cut={99} view="plan" />,
    )
    expect(container.querySelectorAll("[data-tray]")).toHaveLength(24)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples a steady run and a swing between cut points", () => {
    const run = [0, 0.25, 0.5, 0.75].map((t) => columnHeat("run", t))
    expect(Math.max(...run) - Math.min(...run)).toBeLessThan(0.25)
    expect(columnHeat("swing", 0.5)).toBeGreaterThan(columnHeat("swing", 0))
    expect(columnHeat("static", 0.3)).toBe(columnHeat("static", Number.NaN))
  })
})

describe("jack-up rig", () => {
  it("climbs the hull up legs that do not move", () => {
    const { container, rerender } = render(<JackupRig animate={false} elevation={0.05} />)
    const low = container.querySelector("[data-hull]")!.getAttribute("data-elevation")
    const legs = [...container.querySelectorAll("[data-leg]")].map((node) => node.innerHTML)

    rerender(<JackupRig animate={false} elevation={0.95} />)

    expect(container.querySelector("[data-hull]")!.getAttribute("data-elevation")).not.toBe(low)
    // The legs are what the hull climbs: they stay exactly where they were.
    expect([...container.querySelectorAll("[data-leg]")].map((node) => node.innerHTML)).toEqual(legs)
  })

  it("stands on the number of legs it was given", () => {
    const { container, rerender } = render(<JackupRig animate={false} elevation={0.7} legs={3} />)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(3)
    expect(container.querySelectorAll("[data-jack]")).toHaveLength(3)
    rerender(<JackupRig animate={false} elevation={0.7} legs={4} />)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain("4 legs")
  })

  it("stays finite for a nonsense elevation", () => {
    const { container } = render(<JackupRig animate={false} elevation={Number.NaN} view="iso" />)
    expect(hasNaN(container)).toBe(false)
  })

  it("samples a full move and a preload that stays clear of the water", () => {
    expect(jackupElevation("jack", 0.5)).toBeGreaterThan(jackupElevation("jack", 0))
    const preload = [0, 0.25, 0.5, 0.75].map((t) => jackupElevation("preload", t))
    expect(Math.min(...preload)).toBeGreaterThan(0.5)
    expect(jackupElevation("static", 0.2)).toBe(jackupElevation("static", Number.NaN))
  })
})

describe("the family's shared contract", () => {
  /** Every machine, posed and parked, as a function of the axes under test. */
  type Extra = { color?: string; view?: RobotView }
  const machines: Array<[string, (extra: Extra) => React.ReactElement]> = [
    ["pumpjack", (extra) => <Pumpjack animate={false} crankAngle={30} {...extra} />],
    ["drilling-derrick", (extra) => <DrillingDerrick animate={false} hoist={0.5} {...extra} />],
    ["mud-pump", (extra) => <MudPump animate={false} crankAngle={30} {...extra} />],
    ["wellhead-tree", (extra) => <WellheadTree animate={false} choke={0.5} {...extra} />],
    ["storage-tank", (extra) => <StorageTank animate={false} level={0.5} {...extra} />],
    ["oil-tanker", (extra) => <OilTanker animate={false} cargo={0.5} {...extra} />],
    ["tanker-truck", (extra) => <TankerTruck animate={false} level={0.5} {...extra} />],
    ["flare-stack", (extra) => <FlareStack animate={false} flow={0.5} {...extra} />],
    ["fractionating-column", (extra) => <FractionatingColumn animate={false} heat={0.5} {...extra} />],
    ["jackup-rig", (extra) => <JackupRig animate={false} elevation={0.5} {...extra} />],
  ]

  it.each(machines)("%s takes a colour override", (_name, make) => {
    const { container } = render(make({ color: "#123456" }))
    expect(container.querySelector("svg")!.innerHTML).toContain("#123456")
  })

  it.each(machines)("%s draws something different from every camera", (_name, make) => {
    const drawing = (view: RobotView) => {
      const { container } = render(make({ view }))
      const html = container.querySelector("svg")!.innerHTML.replaceAll(/ data-view="[a-z]+"/g, "")
      cleanup()
      return html
    }
    const views: RobotView[] = ["plan", "front", "profile", "iso"]
    expect(new Set(views.map(drawing)).size).toBe(4)
  })
})
