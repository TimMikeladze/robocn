import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CargoPlane, planeConfig, planeTurn } from "@/components/ui/cargo-plane"
import { HydrofoilCraft, craftKnots } from "@/components/ui/hydrofoil-craft"
import { IonInterceptor, interceptorPanels, interceptorYaw } from "@/components/ui/ion-interceptor"
import { LaunchVehicle, launchAscent } from "@/components/ui/launch-vehicle"
import { RobotCar, carRoadSpeed, carSteer } from "@/components/ui/robot-car"
import {
  StrikeStarfighter,
  starfighterBank,
  starfighterFoils,
} from "@/components/ui/strike-starfighter"
import { TransitBus, busDoors, busRoadSpeed, busSteer } from "@/components/ui/transit-bus"

/**
 * The vehicle family: docs/vehicle-robots.md.
 *
 * What is asserted per machine is the same three things — a controlled axis
 * moves the mechanism it names, the accessible label says what it is and where
 * the camera stands, and nonsense on any numeric axis renders a pose instead of
 * reaching the DOM. Motion is sampled through the exported behaviour functions
 * rather than through faked frames.
 */

afterEach(cleanup)

const attribute = (container: HTMLElement, selector: string, name = "d") =>
  container.querySelector(selector)?.getAttribute(name) ?? null

/** Nothing a projection produced may reach the DOM as NaN. */
const clean = (container: HTMLElement) => {
  for (const element of container.querySelectorAll("*")) {
    for (const attr of element.attributes) {
      expect(attr.value, `${element.tagName}.${attr.name}`).not.toContain("NaN")
    }
  }
}

describe("robot car", () => {
  it("turns the inner wheel harder than the outer one", () => {
    const { container } = render(<RobotCar steer={30} roughness={0} animate={false} />)
    const left = Number(attribute(container, '[data-wheel="front-left"]', "data-angle"))
    const right = Number(attribute(container, '[data-wheel="front-right"]', "data-angle"))
    // Starboard turn: the off-side wheel is the inside one.
    expect(right).toBeGreaterThan(left)
    expect(attribute(container, '[data-wheel="rear-left"]', "data-angle")).toBe("0")
  })

  it("moves the wheels and the body when the rack moves", () => {
    const { container, rerender } = render(<RobotCar steer={0} roughness={0} animate={false} />)
    const straight = attribute(container, '[data-wheel="front-right"] path')
    const rack = attribute(container, "[data-rack]")

    rerender(<RobotCar steer={-38} roughness={0} animate={false} />)

    expect(attribute(container, '[data-wheel="front-right"] path')).not.toBe(straight)
    expect(attribute(container, "[data-rack]")).not.toBe(rack)
    // The body leans out of the turn, which is the other thing the radius did.
    expect(Number(container.querySelector("[data-roll]")!.getAttribute("data-roll"))).toBeGreaterThan(0)
  })

  it("puts the body on the road it is given, and takes it off a flat one", () => {
    const { container, rerender } = render(
      <RobotCar steer={0} roughness={0} animate={false} phase={0.3} />,
    )
    expect(attribute(container, "[data-body]", "data-pitch")).toBe("0")

    rerender(<RobotCar steer={0} roughness={1} animate={false} phase={0.3} />)
    expect(Number(attribute(container, "[data-body]", "data-pitch"))).not.toBe(0)
  })

  it("rolls the wheels and the lane markings at the road speed, and parks them", () => {
    expect(carRoadSpeed("cruise")).toBeGreaterThan(carRoadSpeed("park"))
    expect(carRoadSpeed("static")).toBe(0)

    const drawing = (behavior: "cruise" | "static", phase: number) => {
      const { container } = render(
        <RobotCar behavior={behavior} roughness={0} phase={phase} animate={false} />,
      )
      const wheel = container.querySelector('[data-wheel="rear-left"]')!.innerHTML
      const dash = container.querySelector("[data-lane-dash]")!.getAttribute("d")
      cleanup()
      return `${wheel}|${dash}`
    }
    expect(drawing("cruise", 0.1)).not.toBe(drawing("cruise", 0.6))
    // A road that is not moving leaves both of them exactly where they were.
    expect(drawing("static", 0.1)).toBe(drawing("static", 0.6))
  })

  it("names itself and its camera, and projects a different drawing per view", () => {
    const { container, getByRole, rerender } = render(
      <RobotCar steer={20} view="profile" animate={false} />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("side elevation")
    const profile = attribute(container, "[data-body] path")

    rerender(<RobotCar steer={20} view="plan" animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
    expect(attribute(container, "[data-body] path")).not.toBe(profile)
  })

  it("steers from the keyboard and reports it", () => {
    const onSteerChange = vi.fn()
    const { getByRole } = render(
      <RobotCar steer={10} interactive onSteerChange={onSteerChange} animate={false} />,
    )
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" })
    expect(onSteerChange).toHaveBeenCalledWith(14)
    fireEvent.keyDown(getByRole("slider"), { key: "Home" })
    expect(onSteerChange).toHaveBeenLastCalledWith(0)
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <RobotCar steer={Number.NaN} roughness={Number.NaN} phase={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-steer]", "data-steer")).toBe("0")
  })
})

describe("transit bus", () => {
  it("solves the rear section's angle from the steer, and signs it with the turn", () => {
    const { container, rerender } = render(<TransitBus steer={0} doors={0} animate={false} />)
    expect(attribute(container, "[data-hitch]", "data-hitch")).toBe("0")

    rerender(<TransitBus steer={34} doors={0} animate={false} />)
    const right = Number(attribute(container, "[data-hitch]", "data-hitch"))
    expect(Math.abs(right)).toBeGreaterThan(5)

    rerender(<TransitBus steer={-34} doors={0} animate={false} />)
    expect(Number(attribute(container, "[data-hitch]", "data-hitch"))).toBeCloseTo(-right, 1)
  })

  it("has no hitch at all when it is one rigid body", () => {
    const { container } = render(<TransitBus steer={34} doors={0} articulated={false} animate={false} />)
    expect(attribute(container, "[data-hitch]", "data-hitch")).toBe("0")
    expect(container.querySelector("[data-trailer]")).toBeNull()
    expect(container.querySelector("[data-bellows]")).toBeNull()
  })

  it("kneels on the doors' own number", () => {
    const { container, rerender } = render(<TransitBus steer={0} doors={0} animate={false} />)
    expect(attribute(container, "[data-kneel]", "data-kneel")).toBe("0")
    const shut = attribute(container, '[data-leaf="front-fore"]')

    rerender(<TransitBus steer={0} doors={1} animate={false} />)

    expect(Number(attribute(container, "[data-kneel]", "data-kneel"))).toBeGreaterThan(0)
    expect(attribute(container, '[data-leaf="front-fore"]')).not.toBe(shut)
    expect(attribute(container, '[data-door="front"]', "data-open")).toBe("1")
  })

  it("stops the wheels while it is standing with its doors open", () => {
    // The road speed is the same either way; the doors are what takes it away,
    // so a bus at a stop is stopped rather than rolling on the spot.
    expect(busRoadSpeed("route")).toBeGreaterThan(busRoadSpeed("service"))
    expect(busRoadSpeed("static")).toBe(0)

    // Shut, the wheel has turned between two points on the clock; open, it is
    // the same drawing at both, because the doors take the road speed away.
    const spoke = (doors: number, phase: number) => {
      const { container } = render(
        <TransitBus behavior="service" doors={doors} phase={phase} animate={false} />,
      )
      const drawing = container.querySelector('[data-wheel="drive-left"]')!.innerHTML
      cleanup()
      return drawing
    }
    expect(spoke(0, 0.2)).not.toBe(spoke(0, 0.8))
    expect(spoke(1, 0.2)).toBe(spoke(1, 0.8))
  })

  it("names itself, its doors and its camera", () => {
    const { getByRole } = render(<TransitBus steer={0} doors={0.5} view="plan" animate={false} />)
    const label = getByRole("img").getAttribute("aria-label") ?? ""
    expect(label).toContain("Articulated transit bus")
    expect(label).toContain("50 percent open")
    expect(label).toContain("plan view")
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <TransitBus steer={Number.NaN} doors={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-steer]", "data-steer")).toBe("0")
  })
})

describe("cargo plane", () => {
  it("banks further for the same turn at a higher airspeed", () => {
    const { container, rerender } = render(
      <CargoPlane turn={3} airspeed={80} animate={false} />,
    )
    const slow = Math.abs(Number(attribute(container, "[data-bank]", "data-bank")))

    rerender(<CargoPlane turn={3} airspeed={200} animate={false} />)
    expect(Math.abs(Number(attribute(container, "[data-bank]", "data-bank")))).toBeGreaterThan(slow)
  })

  it("is wings level with no turn, and rolls the whole airframe with one", () => {
    const { container, rerender } = render(<CargoPlane turn={0} animate={false} />)
    expect(attribute(container, "[data-bank]", "data-bank")).toBe("0")
    const level = attribute(container, '[data-wing="port"] path')

    rerender(<CargoPlane turn={5} animate={false} />)
    expect(Number(attribute(container, "[data-bank]", "data-bank"))).toBeGreaterThan(0)
    expect(attribute(container, '[data-wing="port"] path')).not.toBe(level)
  })

  it("puts the flaps, the gear and the ramp out together", () => {
    const { container, rerender } = render(<CargoPlane turn={0} configuration={0} animate={false} />)
    expect(container.querySelector("[data-gear]")).toBeNull()
    const clean_ = attribute(container, '[data-flap="port"]')

    rerender(<CargoPlane turn={0} configuration={1} animate={false} />)

    expect(container.querySelector("[data-gear]")).not.toBeNull()
    expect(attribute(container, '[data-flap="port"]')).not.toBe(clean_)
    expect(attribute(container, "[data-ramp]")).not.toBeNull()
  })

  it("carries the roll it has not established on the ailerons, and centres them once it has", () => {
    // Controlled: the bank is pinned at the commanded one, so there is nothing
    // left for the ailerons to do.
    const { container } = render(<CargoPlane turn={4} animate={false} />)
    expect(Math.abs(Number(attribute(container, "[data-aileron]", "data-aileron")))).toBeLessThan(1)
  })

  it("counts its engines in the label and draws them", () => {
    const { container, getByRole } = render(<CargoPlane turn={0} engines={2} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("2-engine")
    expect(container.querySelectorAll("[data-prop]")).toHaveLength(2)
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <CargoPlane turn={Number.NaN} airspeed={Number.NaN} configuration={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-bank]", "data-bank")).toBe("0")
  })
})

describe("hydrofoil craft", () => {
  it("stays hullborne below the takeoff speed and climbs above it", () => {
    const { container, rerender } = render(
      <HydrofoilCraft knots={10} takeoffSpeed={18} animate={false} />,
    )
    expect(attribute(container, "[data-rise]", "data-rise")).toBe("0")
    const down = attribute(container, "[data-hull] path")

    rerender(<HydrofoilCraft knots={40} takeoffSpeed={18} animate={false} />)

    expect(Number(attribute(container, "[data-rise]", "data-rise"))).toBeGreaterThan(0.5)
    expect(attribute(container, "[data-hull] path")).not.toBe(down)
  })

  it("sheds wetted foil as it rises", () => {
    const { container, rerender } = render(
      <HydrofoilCraft knots={20} takeoffSpeed={18} animate={false} />,
    )
    const slow = Number(attribute(container, '[data-foil="fore"]', "data-wetted"))

    rerender(<HydrofoilCraft knots={50} takeoffSpeed={18} animate={false} />)

    expect(Number(attribute(container, '[data-foil="fore"]', "data-wetted"))).toBeLessThan(slow)
  })

  it("raises its own takeoff speed and stays down for it", () => {
    const { container } = render(<HydrofoilCraft knots={30} takeoffSpeed={40} animate={false} />)
    expect(attribute(container, "[data-rise]", "data-rise")).toBe("0")
  })

  it("says how fast it is going and whether it is up", () => {
    const { getByRole, rerender } = render(<HydrofoilCraft knots={6} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("hullborne")
    rerender(<HydrofoilCraft knots={44} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("foilborne")
  })

  it("throttles from the keyboard and reports it", () => {
    const onKnotsChange = vi.fn()
    const { getByRole } = render(
      <HydrofoilCraft knots={20} interactive onKnotsChange={onKnotsChange} animate={false} />,
    )
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowUp" })
    expect(onKnotsChange).toHaveBeenCalledWith(22)
    fireEvent.keyDown(getByRole("slider"), { key: "Home" })
    expect(onKnotsChange).toHaveBeenLastCalledWith(0)
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <HydrofoilCraft knots={Number.NaN} takeoffSpeed={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-rise]", "data-rise")).toBe("0")
  })
})

describe("launch vehicle", () => {
  it("tips over as the ascent runs, and the stack goes with it", () => {
    const { container, rerender } = render(<LaunchVehicle ascent={0} animate={false} />)
    expect(attribute(container, "[data-pitch]", "data-pitch")).toBe("0")
    const upright = attribute(container, '[data-stage="second"] path')

    rerender(<LaunchVehicle ascent={0.7} animate={false} />)

    expect(Number(attribute(container, "[data-pitch]", "data-pitch"))).toBeGreaterThan(20)
    expect(attribute(container, '[data-stage="second"] path')).not.toBe(upright)
  })

  it("stages: the booster becomes a body of its own and the readout drops", () => {
    const { container, rerender } = render(<LaunchVehicle ascent={0.2} animate={false} />)
    expect(container.querySelector('[data-spent="true"]')).toBeNull()
    const before = container.querySelector("[data-readout]")!.textContent ?? ""

    rerender(<LaunchVehicle ascent={0.7} animate={false} />)

    expect(container.querySelector('[data-spent="true"]')).not.toBeNull()
    expect(attribute(container, "[data-separation]", "data-separation")).toBe("1")
    const after = container.querySelector("[data-readout]")!.textContent ?? ""
    expect(after).not.toBe(before)
    expect(after).toContain("STAGE 2")
    // The Δv the vehicle still has is strictly less once half of it is gone.
    const number = (text: string) => Number(/(\d+) m\/s/.exec(text)?.[1] ?? 0)
    expect(number(after)).toBeLessThan(number(before))
  })

  it("clusters the engines it is asked for and gimbals them together", () => {
    const { container, rerender } = render(<LaunchVehicle ascent={0.1} engines={5} animate={false} />)
    expect(container.querySelectorAll("[data-engine]")).toHaveLength(5)

    rerender(<LaunchVehicle ascent={0.1} engines={9} animate={false} />)
    expect(container.querySelectorAll("[data-engine]")).toHaveLength(9)
    expect(container.querySelector("[data-gimbal]")).not.toBeNull()
  })

  it("takes the pad away as it climbs", () => {
    const { container, rerender } = render(<LaunchVehicle ascent={0} animate={false} />)
    expect(container.querySelector("[data-pad]")!.getAttribute("opacity")).toBe("1")
    rerender(<LaunchVehicle ascent={0.5} animate={false} />)
    expect(container.querySelector("[data-pad]")!.getAttribute("opacity")).toBe("0")
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(<LaunchVehicle ascent={Number.NaN} animate={false} />)
    clean(container)
    expect(attribute(container, "[data-ascent]", "data-ascent")).toBe("0")
  })
})

describe("strike starfighter", () => {
  it("opens four panels off one number, in opposite pairs", () => {
    const { container, rerender } = render(
      <StrikeStarfighter foils={0} bank={0} animate={false} />,
    )
    expect(attribute(container, '[data-foil="upper-starboard"]', "data-angle")).toBe("0")
    const closed = attribute(container, '[data-foil="upper-starboard"] path')

    rerender(<StrikeStarfighter foils={1} bank={0} animate={false} />)

    const upper = Number(attribute(container, '[data-foil="upper-starboard"]', "data-angle"))
    const lower = Number(attribute(container, '[data-foil="lower-starboard"]', "data-angle"))
    expect(upper).not.toBe(0)
    expect(lower).toBeCloseTo(-upper, 6)
    expect(attribute(container, '[data-foil="upper-starboard"] path')).not.toBe(closed)
    expect(container.querySelectorAll("[data-foil]")).toHaveLength(4)
  })

  it("carries the engines and the cannons on the panels", () => {
    const { container, rerender } = render(
      <StrikeStarfighter foils={0} bank={0} animate={false} />,
    )
    const engine = attribute(container, '[data-engine="upper-port"]')
    const cannon = attribute(container, '[data-cannon="upper-port"]')

    rerender(<StrikeStarfighter foils={1} bank={0} animate={false} />)

    expect(attribute(container, '[data-engine="upper-port"]')).not.toBe(engine)
    expect(attribute(container, '[data-cannon="upper-port"]')).not.toBe(cannon)
  })

  it("rolls the whole airframe, panels included", () => {
    const { container, rerender } = render(
      <StrikeStarfighter foils={1} bank={0} animate={false} />,
    )
    const level = attribute(container, "[data-fuselage] path")

    rerender(<StrikeStarfighter foils={1} bank={40} animate={false} />)

    expect(attribute(container, "[data-fuselage] path")).not.toBe(level)
    expect(attribute(container, "[data-bank]", "data-bank")).toBe("40")
  })

  it("names the opening, the bank and the camera", () => {
    const { getByRole } = render(
      <StrikeStarfighter foils={0.5} bank={12} view="iso" animate={false} />,
    )
    const label = getByRole("img").getAttribute("aria-label") ?? ""
    expect(label).toContain("50 percent open")
    expect(label).toContain("isometric view")
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <StrikeStarfighter foils={Number.NaN} bank={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-foils]", "data-foils")).toBe("0")
  })
})

describe("ion interceptor", () => {
  it("pitches both panels about their pylons", () => {
    const { container, rerender } = render(
      <IonInterceptor panelPitch={0} yaw={0} animate={false} />,
    )
    const square = attribute(container, '[data-panel="port"] path')

    rerender(<IonInterceptor panelPitch={60} yaw={0} animate={false} />)

    expect(attribute(container, '[data-panel="port"] path')).not.toBe(square)
    expect(attribute(container, '[data-panel="starboard"]', "data-pitch")).toBe("60")
  })

  it("turns the pod inside the pylons without moving them", () => {
    const { container, rerender } = render(
      <IonInterceptor panelPitch={20} yaw={0} animate={false} />,
    )
    const panel = attribute(container, '[data-panel="port"] path')
    const pylon = attribute(container, '[data-pylon="port"]')
    const visor = attribute(container, "[data-visor]")

    rerender(<IonInterceptor panelPitch={20} yaw={45} animate={false} />)

    expect(attribute(container, '[data-panel="port"] path')).toBe(panel)
    expect(attribute(container, '[data-pylon="port"]')).toBe(pylon)
    expect(attribute(container, "[data-visor]")).not.toBe(visor)
    expect(attribute(container, "[data-pod]", "data-angle")).toBe("45")
  })

  it("draws the ribs it is asked for, and none when asked for none", () => {
    const { container, rerender } = render(
      <IonInterceptor panelPitch={0} yaw={0} ribs={5} animate={false} />,
    )
    // Two panels, five ribs each, plus one spar apiece.
    expect(container.querySelectorAll('[data-panel="port"] path').length).toBeGreaterThan(5)

    rerender(<IonInterceptor panelPitch={0} yaw={0} ribs={0} animate={false} />)
    expect(container.querySelectorAll('[data-panel="port"] path')).toHaveLength(3)
  })

  it("renders a pose for nonsense rather than NaN", () => {
    const { container } = render(
      <IonInterceptor panelPitch={Number.NaN} yaw={Number.NaN} ribs={Number.NaN} animate={false} />,
    )
    clean(container)
    expect(attribute(container, "[data-panel-pitch]", "data-panel-pitch")).toBe("0")
  })
})

describe("the behaviour samplers", () => {
  const clocks = Array.from({ length: 24 }, (_, index) => index / 6)

  it("stays inside its own limits and is neutral for a clock that is not a number", () => {
    for (const clock of clocks) {
      expect(Math.abs(carSteer("slalom", clock))).toBeLessThanOrEqual(60)
      expect(Math.abs(carSteer("park", clock))).toBeLessThanOrEqual(60)
      expect(Math.abs(busSteer("route", clock))).toBeLessThanOrEqual(42)
      expect(busDoors("service", clock)).toBeGreaterThanOrEqual(0)
      expect(busDoors("service", clock)).toBeLessThanOrEqual(1)
      expect(Math.abs(planeTurn("circuit", clock))).toBeLessThanOrEqual(6)
      expect(planeConfig("approach", clock)).toBeLessThanOrEqual(1)
      expect(craftKnots("takeoff", clock)).toBeGreaterThanOrEqual(0)
      expect(craftKnots("takeoff", clock)).toBeLessThanOrEqual(60)
      expect(launchAscent("ascent", clock)).toBeGreaterThanOrEqual(0)
      expect(launchAscent("ascent", clock)).toBeLessThanOrEqual(1)
      expect(starfighterFoils("patrol", clock)).toBeGreaterThanOrEqual(0)
      expect(starfighterFoils("patrol", clock)).toBeLessThanOrEqual(1)
      expect(Math.abs(interceptorPanels("intercept", clock))).toBeLessThanOrEqual(80)
      expect(Math.abs(interceptorYaw("intercept", clock))).toBeLessThanOrEqual(55)
    }

    for (const sample of [
      () => carSteer("cruise", Number.NaN),
      () => busSteer("route", Number.NaN),
      () => busDoors("service", Number.NaN),
      () => planeTurn("circuit", Number.NaN),
      () => planeConfig("approach", Number.NaN),
      () => craftKnots("takeoff", Number.NaN),
      () => launchAscent("ascent", Number.NaN),
      () => starfighterFoils("patrol", Number.NaN),
      () => starfighterBank("attack", Number.NaN),
      () => interceptorPanels("intercept", Number.NaN),
      () => interceptorYaw("patrol", Number.NaN),
    ]) {
      expect(sample()).toBe(0)
    }
  })

  it("parks every machine at its neutral value when it is static", () => {
    expect(carSteer("static", 1.7)).toBe(0)
    expect(carRoadSpeed("static")).toBe(0)
    expect(busSteer("static", 1.7)).toBe(0)
    expect(busDoors("route", 1.7)).toBe(0)
    expect(planeTurn("static", 1.7)).toBe(0)
    expect(planeConfig("cruise", 1.7)).toBe(0)
    expect(craftKnots("static", 1.7)).toBe(0)
    expect(launchAscent("hold", 1.7)).toBe(0)
    expect(starfighterFoils("static", 1.7)).toBe(0)
    expect(interceptorPanels("static", 1.7)).toBe(0)
  })

  it("drives the road faster on a cruise than through a parking shuffle", () => {
    expect(carRoadSpeed("cruise")).toBeGreaterThan(carRoadSpeed("park"))
  })

  it("holds the foils open right through an attack", () => {
    for (const clock of clocks) expect(starfighterFoils("attack", clock)).toBe(1)
  })
})

describe("reduced motion", () => {
  it("parks every loop at its phase and keeps the controls working", () => {
    const reduced = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    vi.stubGlobal("matchMedia", reduced)
    const frames = vi.spyOn(window, "requestAnimationFrame")

    const machines = [
      render(<RobotCar interactive behavior="slalom" phase={0.25} />),
      render(<TransitBus interactive behavior="service" phase={0.25} />),
      render(<CargoPlane interactive behavior="circuit" phase={0.25} />),
      render(<HydrofoilCraft interactive behavior="takeoff" phase={0.25} />),
      render(<LaunchVehicle interactive behavior="ascent" phase={0.25} />),
      render(<StrikeStarfighter interactive behavior="attack" phase={0.25} />),
      render(<IonInterceptor interactive behavior="intercept" phase={0.25} />),
    ]

    // Parked means no loop is scheduled at all.
    expect(frames).not.toHaveBeenCalled()
    for (const machine of machines) {
      const svg = machine.container.querySelector("svg")!
      // Input is not decoration: it still works.
      expect(svg.getAttribute("role")).toBe("slider")
      expect(svg.getAttribute("tabindex")).toBe("0")
      clean(machine.container)
    }
    vi.unstubAllGlobals()
  })
})

describe("grabbing a vehicle", () => {
  /** jsdom has no layout, so the box the drag maps into has to be declared. */
  const box = (svg: SVGSVGElement) => {
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
    svg.setPointerCapture = () => {}
    svg.releasePointerCapture = () => {}
  }

  it("steers the car with the pointer, right across the frame", () => {
    const onSteerChange = vi.fn()
    const { container } = render(<RobotCar interactive onSteerChange={onSteerChange} />)
    const svg = container.querySelector("svg") as SVGSVGElement
    box(svg)

    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100, pointerId: 1 })

    expect(onSteerChange).toHaveBeenLastCalledWith(60)
    expect(svg.getAttribute("aria-valuenow")).toBe("60")

    fireEvent.pointerMove(svg, { clientX: 0, clientY: 100, pointerId: 1 })
    expect(onSteerChange).toHaveBeenLastCalledWith(-60)
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })

  it("opens the fighter's foils by dragging up the frame", () => {
    const onFoilsChange = vi.fn()
    const { container } = render(<StrikeStarfighter interactive onFoilsChange={onFoilsChange} />)
    const svg = container.querySelector("svg") as SVGSVGElement
    box(svg)

    fireEvent.pointerDown(svg, { clientX: 100, clientY: 200, pointerId: 1 })
    expect(onFoilsChange).toHaveBeenLastCalledWith(0)
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 0, pointerId: 1 })

    expect(onFoilsChange).toHaveBeenLastCalledWith(1)
    expect(container.querySelector('[data-foil="upper-starboard"]')!.getAttribute("data-angle")).not.toBe("0")
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })

  it("opens the throttle on the hydrofoil and lifts her onto the foils", () => {
    const onKnotsChange = vi.fn()
    const { container } = render(<HydrofoilCraft interactive onKnotsChange={onKnotsChange} />)
    const svg = container.querySelector("svg") as SVGSVGElement
    box(svg)

    fireEvent.pointerDown(svg, { clientX: 0, clientY: 100, pointerId: 1 })
    expect(onKnotsChange).toHaveBeenLastCalledWith(0)
    expect(container.querySelector("[data-rise]")!.getAttribute("data-rise")).toBe("0")

    fireEvent.pointerMove(svg, { clientX: 200, clientY: 100, pointerId: 1 })

    expect(onKnotsChange).toHaveBeenLastCalledWith(60)
    expect(Number(container.querySelector("[data-rise]")!.getAttribute("data-rise"))).toBeGreaterThan(0.8)
    fireEvent.pointerUp(svg, { pointerId: 1 })
  })
})
