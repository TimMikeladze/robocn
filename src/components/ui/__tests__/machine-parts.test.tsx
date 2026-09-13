import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BeltDrive, beltGoal } from "@/components/ui/belt-drive"
import { CableCarrier, carrierGoal } from "@/components/ui/cable-carrier"
import { MecanumWheel, mecanumGoal } from "@/components/ui/mecanum-wheel"
import { MotionPlatform, platformPose } from "@/components/ui/motion-platform"
import { handGoal, handWave } from "@/components/ui/robot-hand"
import { PlanetaryGearbox, gearboxGoal } from "@/components/ui/planetary-gearbox"
import { SuctionGripper, suctionGoal, suctionSeal } from "@/components/ui/suction-gripper"
import { ToolChanger, changerGoal } from "@/components/ui/tool-changer"

const transform = (container: HTMLElement, selector: string) =>
  container.querySelector(selector)!.getAttribute("transform")

describe("planetary gearbox", () => {
  it("turns the planets and the carrier from the input, and holds the ring", () => {
    const { container, rerender } = render(<PlanetaryGearbox angle={0} />)
    const ring = transform(container, "[data-ring]")
    const carrier = transform(container, "[data-carrier]")
    const planet = transform(container, '[data-planet="0"]')

    rerender(<PlanetaryGearbox angle={140} />)

    expect(transform(container, "[data-ring]")).toBe(ring)
    expect(transform(container, "[data-carrier]")).not.toBe(carrier)
    expect(transform(container, '[data-planet="0"]')).not.toBe(planet)
  })

  it("reports the tooth counts it actually assembled and the reduction", () => {
    const { getByRole, container } = render(
      <PlanetaryGearbox angle={30} sunTeeth={18} planetTeeth={12} planets={3} />,
    )
    // 18 + 2×12 = 42 ring; (18 + 42) / 3 assembles; 1 + 42/18 = 3.33.
    expect(container.textContent).toContain("18:12:42")
    expect(getByRole("img").getAttribute("aria-label")).toContain("3.33 to 1")
    expect(container.querySelectorAll("[data-planet]")).toHaveLength(3)
  })

  it("draws five planets and names the view", () => {
    const { container, getByRole } = render(
      <PlanetaryGearbox angle={0} planets={5} view="iso" />,
    )
    expect(container.querySelectorAll("[data-planet]")).toHaveLength(5)
    expect(container.querySelector("[data-solids]")).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <PlanetaryGearbox angle={NaN} sunTeeth={NaN} planets={Infinity} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })
})

describe("belt drive", () => {
  it("turns the driven pulley at the tooth ratio and marches the belt teeth", () => {
    const { container, rerender } = render(<BeltDrive travel={0} driveTeeth={18} drivenTeeth={36} />)
    const teeth = () => container.querySelector("[data-teeth] path")!.getAttribute("d")
    const first = teeth()
    // One drive turn is half a turn of a pulley with twice the teeth.
    rerender(<BeltDrive travel={1} driveTeeth={18} drivenTeeth={36} />)
    expect(container.querySelector('[data-pulley="drive"] g')!.getAttribute("transform")).toBe("rotate(360)")
    expect(container.querySelector('[data-pulley="driven"] g')!.getAttribute("transform")).toBe("rotate(180)")
    expect(teeth()).not.toBe(first)
  })

  it("lengthens the belt when the idler is wound down, and can lose the idler", () => {
    const { container, rerender, getByRole } = render(<BeltDrive travel={0} tension={0} />)
    const slack = container.querySelector("[data-belt]")!.getAttribute("d")
    rerender(<BeltDrive travel={0} tension={1} />)
    expect(container.querySelector("[data-belt]")!.getAttribute("d")).not.toBe(slack)
    expect(getByRole("img").getAttribute("aria-label")).toContain("1.67 to 1")
    rerender(<BeltDrive travel={0} showIdler={false} />)
    expect(container.querySelector("[data-idler]")).toBeNull()
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(
      <BeltDrive travel={NaN} driveTeeth={NaN} drivenTeeth={Infinity} tension={NaN} color="#aabbcc" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })
})

describe("cable carrier", () => {
  it("moves the carriage and the fold, keeping every link", () => {
    const { container, rerender } = render(<CableCarrier travel={0} links={20} />)
    const carriage = () => container.querySelector("[data-carriage]")!.getAttribute("transform")
    const parked = carriage()
    expect(container.querySelectorAll("[data-link]")).toHaveLength(20)

    rerender(<CableCarrier travel={1} links={20} />)

    expect(carriage()).not.toBe(parked)
    expect(container.querySelectorAll("[data-link]")).toHaveLength(20)
  })

  it("clamps travel, counts strands, and names the view", () => {
    const { container, getByRole, rerender } = render(<CableCarrier travel={4} cables={4} view="iso" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("100 percent")
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(container.querySelectorAll("[data-cable] path")).toHaveLength(4)
    rerender(<CableCarrier travel={0.5} cables={0} />)
    expect(container.querySelector("[data-cable]")).toBeNull()
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<CableCarrier travel={NaN} links={NaN} cables={Infinity} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("mecanum wheel", () => {
  it("reverses the roller skew with the hand and spins with the hub", () => {
    const { container, rerender } = render(<MecanumWheel angle={0} hand="right" rollers={8} />)
    const roller = () => container.querySelector('[data-roller="0"] path')!.getAttribute("d")
    const right = roller()
    expect(container.querySelectorAll("[data-roller]")).toHaveLength(8)

    rerender(<MecanumWheel angle={0} hand="left" rollers={8} view="iso" />)
    const left = roller()
    expect(left).not.toBe(right)

    rerender(<MecanumWheel angle={40} hand="left" rollers={8} view="iso" />)
    expect(roller()).not.toBe(left)
  })

  it("names the hand and the view, and clamps the roller count", () => {
    const { container, getByRole } = render(<MecanumWheel angle={0} rollers={200} view="plan" />)
    expect(container.querySelectorAll("[data-roller]")).toHaveLength(14)
    expect(getByRole("img").getAttribute("aria-label")).toContain("right hand")
    expect(getByRole("img").getAttribute("aria-label")).toContain("plan view")
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<MecanumWheel angle={NaN} rollers={NaN} color="#aabbcc" />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })
})

describe("tool changer", () => {
  it("closes the gap first, then drives the lock balls out", () => {
    const { container, rerender, getByRole } = render(<ToolChanger engagement={0} />)
    const half = () => container.querySelector('[data-half="tool"]')!.getAttribute("transform")
    const ball = () => container.querySelector('[data-ball="0"] circle')!.getAttribute("cx")
    const parked = half()
    const out = ball()

    rerender(<ToolChanger engagement={0.6} />)
    expect(half()).not.toBe(parked)
    expect(ball()).toBe(out)
    expect(getByRole("img").getAttribute("aria-label")).toContain("seated")

    const seated = half()
    rerender(<ToolChanger engagement={1} />)
    // Seated already: the halves stay put and only the lock moves.
    expect(half()).toBe(seated)
    expect(ball()).not.toBe(out)
    expect(getByRole("img").getAttribute("aria-label")).toContain("locked")
  })

  it("swaps the tool and can lose the dock", () => {
    const { container, rerender } = render(<ToolChanger engagement={1} tool="gripper" />)
    expect(container.querySelector('[data-tool="gripper"]')).not.toBeNull()
    rerender(<ToolChanger engagement={1} tool="spindle" showDock={false} />)
    expect(container.querySelector('[data-tool="spindle"]')).not.toBeNull()
    expect(container.querySelector("[data-dock]")).toBeNull()
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<ToolChanger engagement={NaN} balls={Infinity} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("suction gripper", () => {
  it("stops the head at contact and puts the rest of the stroke into the bellows", () => {
    const { container, rerender } = render(<SuctionGripper descent={0} />)
    const head = () => container.querySelector("[data-head]")!.getAttribute("transform")
    const bellows = () => container.querySelector("[data-bellows] rect")!.getAttribute("height")
    const raised = head()

    rerender(<SuctionGripper descent={46 / 55} />)
    const down = head()
    const open = bellows()
    expect(down).not.toBe(raised)

    rerender(<SuctionGripper descent={1} />)
    expect(head()).toBe(down)
    expect(bellows()).not.toBe(open)
  })

  it("carries the sheet on the lips only while the line is live", () => {
    const { container, rerender, getByRole } = render(
      <SuctionGripper descent={0} holding vacuum cups={4} />,
    )
    const sheet = () => container.querySelector("[data-sheet]")!.getAttribute("y")
    const lifted = sheet()
    expect(container.querySelectorAll("[data-cup]")).toHaveLength(4)
    expect(getByRole("img").getAttribute("aria-label")).toContain("holding a sheet")

    rerender(<SuctionGripper descent={0} holding vacuum={false} cups={4} />)
    expect(sheet()).not.toBe(lifted)
    expect(getByRole("img").getAttribute("aria-label")).toContain("empty")
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<SuctionGripper descent={NaN} cups={NaN} />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("motion platform", () => {
  it("tips the deck by moving its legs, and reports the longest stroke", () => {
    const { container, rerender, getByRole } = render(<MotionPlatform roll={0} pitch={0} />)
    const leg = () => container.querySelector('[data-leg="0"] path')!.getAttribute("d")
    const deck = () => container.querySelector("[data-deck] path")!.getAttribute("d")
    const level = { leg: leg(), deck: deck() }
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(6)

    rerender(<MotionPlatform roll={14} pitch={-8} />)

    expect(leg()).not.toBe(level.leg)
    expect(deck()).not.toBe(level.deck)
    expect(getByRole("img").getAttribute("aria-label")).toContain("roll 14 degrees")
  })

  it("says when a pose asks a leg for more stroke than it has", () => {
    const { getByRole, container, rerender } = render(<MotionPlatform roll={0} heave={0} />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("within travel")
    expect(container.querySelectorAll('[data-fault="true"]')).toHaveLength(0)

    rerender(<MotionPlatform heave={60} />)

    expect(getByRole("img").getAttribute("aria-label")).toContain("over travel")
    expect(container.querySelectorAll('[data-fault="true"]').length).toBeGreaterThan(0)
  })

  it("stays neutral on nonsense", () => {
    const { container } = render(<MotionPlatform roll={NaN} heave={Infinity} payload="camera" />)
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })
})

describe("behaviour samplers", () => {
  const samples = (f: (clock: number) => number) =>
    Array.from({ length: 24 }, (_, i) => f(i / 24))

  it("winds the gearbox forward and jogs it in steps", () => {
    expect(gearboxGoal("run", 0.5)).toBe(180)
    expect(gearboxGoal("run", 1.5)).toBe(540)
    expect(gearboxGoal("jog", 0.9)).toBe(0)
    expect(gearboxGoal("jog", 1.2)).toBe(180)
    expect(gearboxGoal("static", 9)).toBe(0)
    expect(gearboxGoal("run", NaN)).toBe(0)
  })

  it("runs the belt one way and shuttles it both", () => {
    expect(beltGoal("run", 2.5)).toBe(2.5)
    const shuttle = samples((c) => beltGoal("shuttle", c))
    expect(Math.max(...shuttle)).toBeCloseTo(0.8, 6)
    expect(Math.min(...shuttle)).toBeCloseTo(-0.8, 6)
    expect(beltGoal("shuttle", NaN)).toBe(0)
  })

  it("keeps every stroke inside its own range", () => {
    for (const value of [
      ...samples((c) => carrierGoal("cycle", c)),
      ...samples((c) => carrierGoal("creep", c)),
      ...samples((c) => suctionGoal("cycle", c)),
      ...samples((c) => suctionGoal("breathe", c)),
      ...samples((c) => changerGoal("dock", c)),
      ...samples((c) => changerGoal("latch", c)),
      ...samples((c) => handGoal("grip", c)),
      ...samples((c) => handWave(c, 2)),
    ]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
    // A whole cycle repeats, in both directions.
    expect(carrierGoal("cycle", 1.3)).toBeCloseTo(carrierGoal("cycle", 0.3), 9)
    expect(suctionGoal("cycle", -0.7)).toBeCloseTo(suctionGoal("cycle", 0.3), 9)
  })

  it("seats the coupler before it locks, and latches without unseating", () => {
    expect(changerGoal("dock", 0.15)).toBeLessThanOrEqual(0.6)
    expect(changerGoal("dock", 0.5)).toBe(1)
    expect(Math.min(...samples((c) => changerGoal("latch", c)))).toBeCloseTo(0.6, 9)
  })

  it("seals the suction line only across the carrying half of the cycle", () => {
    expect(suctionSeal("cycle", 0.1)).toBe(false)
    expect(suctionSeal("cycle", 0.45)).toBe(true)
    expect(suctionSeal("cycle", 0.9)).toBe(false)
    expect(suctionSeal("breathe", 0.45)).toBe(false)
    expect(suctionSeal("cycle", NaN)).toBe(false)
  })

  it("crabs the wheel within a turn and rolls it past one", () => {
    expect(Math.max(...samples((c) => mecanumGoal("crab", c)))).toBeCloseTo(180, 6)
    expect(mecanumGoal("roll", 2)).toBe(720)
    expect(mecanumGoal("static", 2)).toBe(0)
  })

  it("sways the platform harder than it settles, and rests when static", () => {
    const excursion = (behavior: "settle" | "sway") =>
      Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(platformPose(behavior, i / 40).roll)))
    expect(excursion("sway")).toBeGreaterThan(excursion("settle"))
    expect(platformPose("static", 0.4)).toEqual(platformPose("sway", NaN))
  })
})
