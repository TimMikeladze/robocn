import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RobotHorse, horseBehaviorPose, type HorseBehavior } from "@/components/ui/robot-horse"
import {
  RobotPegasus,
  pegasusBehaviorPose,
  pegasusWingBones,
  pegasusWingLinks,
  pegasusWingtip,
  type PegasusBehavior,
} from "@/components/ui/robot-pegasus"

const behaviors: HorseBehavior[] = ["walk", "trot", "canter", "gallop", "graze", "static"]
const cycle = [0, 0.17, 0.33, 0.5, 0.67, 0.83]

/** The height of one leg's fetlock above its own hoof: the pastern's rise, and
 *  nothing else, because both points move with the limb. */
function pastern(element: HTMLElement, leg: string) {
  const fetlock = element.querySelector(`[data-fetlock="${leg}"]`)!
  const hoof = element.querySelector(`[data-hoof="${leg}"]`)!
  return Number(fetlock.getAttribute("cy")) - Number(hoof.getAttribute("cy"))
}

describe("horse behaviours", () => {
  it("keeps every sampled pose inside its own limits", () => {
    for (const clock of [0, 0.6, 2.3, 7.1]) {
      for (const behavior of behaviors) {
        const pose = horseBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.tail)).toBeLessThanOrEqual(1)
        expect(pose.balance).toBeGreaterThanOrEqual(0)
        expect(pose.balance).toBeLessThanOrEqual(1)
        expect(pose.stride).toBeGreaterThanOrEqual(0)
        expect(pose.stride).toBeLessThanOrEqual(1)
        for (const at of cycle) {
          const stance = pose.stance(at)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.neck), `${behavior} neck`).toBeLessThanOrEqual(1)
          expect(stance.altitude, `${behavior} altitude`).toBeGreaterThanOrEqual(0)
          expect(stance.altitude, `${behavior} altitude`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("gives each behaviour the gait it is named for", () => {
    expect(horseBehaviorPose("walk", 0).gait).toBe("walk")
    expect(horseBehaviorPose("trot", 0).gait).toBe("trot")
    expect(horseBehaviorPose("canter", 0).gait).toBe("canter")
    expect(horseBehaviorPose("gallop", 0).gait).toBe("gallop")
    // Grazing and standing are both halted; only one of them has its head down.
    expect(horseBehaviorPose("graze", 0).gait).toBe("halt")
    expect(horseBehaviorPose("static", 0).gait).toBe("halt")
    expect(horseBehaviorPose("graze", 0).stance(0).neck).toBeLessThan(-0.5)
    // The stride lengthens with the gait, and the walk nods hardest.
    expect(horseBehaviorPose("gallop", 0).stride).toBeGreaterThan(horseBehaviorPose("walk", 0).stride)
    expect(horseBehaviorPose("walk", 0).balance).toBeGreaterThan(horseBehaviorPose("trot", 0).balance)
    // Only the two fast gaits leave the floor.
    expect(Math.max(...cycle.map((at) => horseBehaviorPose("gallop", 0).stance(at).altitude))).toBeGreaterThan(0.2)
    expect(Math.max(...cycle.map((at) => horseBehaviorPose("walk", 0).stance(at).altitude))).toBe(0)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(horseBehaviorPose("walk", Number.NaN).gaze).toBe(0)
    expect(horseBehaviorPose("graze", Number.NaN).stance(0).neck).toBe(
      horseBehaviorPose("graze", 0).stance(0).neck,
    )
  })
})

describe("robot horse", () => {
  it("sinks the fetlock under load and lets it back up when the limb is free", () => {
    // At a trot the left fore is planted at 0.2 and swinging at 0.7, and the
    // pastern's rise is the only thing the load touches.
    const { container, rerender } = render(
      <RobotHorse gait="trot" phase={0.2} interactive={false} animate={false} />,
    )
    const loaded = pastern(container, "fore-left")
    expect(container.querySelector('[data-leg="fore-left"]')!.getAttribute("data-load")).not.toBe("0")

    rerender(<RobotHorse gait="trot" phase={0.7} interactive={false} animate={false} />)
    const free = pastern(container, "fore-left")
    expect(container.querySelector('[data-leg="fore-left"]')!.getAttribute("data-load")).toBe("0")
    // A loaded fetlock sits lower over its own hoof than a free one.
    expect(loaded).toBeLessThan(free)

    // Standing square all four carry a share, so all four are sunk — and the
    // forehand, which carries more of the animal, is sunk further than the
    // hind end. Each pair matches its own side exactly.
    rerender(<RobotHorse gait="halt" phase={0} interactive={false} animate={false} />)
    const square = Object.fromEntries(
      ["fore-left", "fore-right", "hind-left", "hind-right"].map((leg) => [leg, pastern(container, leg)]),
    )
    expect(Object.values(square).every((rise) => rise < free)).toBe(true)
    expect(square["fore-left"]).toBeCloseTo(square["fore-right"], 6)
    expect(square["hind-left"]).toBeCloseTo(square["hind-right"], 6)
    expect(square["fore-left"]).toBeLessThan(square["hind-left"])
  })

  it("nods the neck from the load only while the balance is on", () => {
    const poll = (balance: number, phase: number) => {
      const { container, unmount } = render(
        <RobotHorse gait="walk" phase={phase} balance={balance} interactive={false} animate={false} />,
      )
      const y = Number(container.querySelector('[data-joint="poll"]')!.getAttribute("cy"))
      unmount()
      return y
    }
    const swingOf = (balance: number) => {
      const heights = cycle.map((phase) => poll(balance, phase))
      return Math.max(...heights) - Math.min(...heights)
    }
    // With the balance off the head rides the body; with it on it answers the
    // forehand loading and unloading, which is the nod of a walking horse.
    expect(swingOf(1)).toBeGreaterThan(swingOf(0) + 1)
  })

  it("walks the legs through the stride and marks what is carrying weight", () => {
    const { container, rerender } = render(
      <RobotHorse gait="walk" phase={0} showContacts interactive={false} animate={false} />,
    )
    const fore = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    // A walk always has at least two feet down.
    expect(container.querySelectorAll("[data-contact]").length).toBeGreaterThanOrEqual(2)

    rerender(<RobotHorse gait="walk" phase={0.4} showContacts interactive={false} animate={false} />)
    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).not.toBe(fore)
  })

  it("swaps the two sides with the lead, and says which gait it is in", () => {
    const { container, getByRole, rerender } = render(
      <RobotHorse gait="canter" phase={0.3} lead="right" interactive={false} animate={false} />,
    )
    const near = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/three-beat canter/)

    rerender(<RobotHorse gait="canter" phase={0.3} lead="left" interactive={false} animate={false} />)
    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).not.toBe(near)

    rerender(<RobotHorse behavior="walk" phase={0.3} interactive={false} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/four-beat walk/)
    rerender(<RobotHorse behavior="graze" interactive={false} animate={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/grazing/)
  })

  it("takes the ears and the gaze, and scrubs the stride when it is grabbed", () => {
    const onPhaseChange = vi.fn()
    const { container, getByRole, rerender } = render(
      <RobotHorse behavior="walk" ears={1} onPhaseChange={onPhaseChange} />,
    )
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuemin")).toBe("0")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")

    fireEvent.keyDown(slider, { key: "ArrowRight" })
    expect(onPhaseChange).toHaveBeenCalled()
    expect(onPhaseChange.mock.calls.at(-1)![0]).toBeGreaterThan(0)

    const ear = container.querySelector("[data-ears]")!.innerHTML
    rerender(<RobotHorse behavior="walk" ears={-1} onPhaseChange={onPhaseChange} />)
    expect(container.querySelector("[data-ears]")!.innerHTML).not.toBe(ear)
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotHorse
        behavior={"amble" as HorseBehavior}
        phase={Number.NaN}
        arch={Number.NaN}
        crouch={Number.NaN}
        neck={Number.NaN}
        balance={Number.NaN}
        tail={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-fetlock]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-ear]")).toHaveLength(2)
  })
})

/* -------------------------------------------------------------------------- */

const flights: PegasusBehavior[] = ["launch", "canter", "soar", "hover", "static"]

/** How far one hoof is from its own shoulder: the limb's own extension. */
function limbSpan(element: HTMLElement, leg: string) {
  const hoof = element.querySelector(`[data-hoof="${leg}"]`)!
  const root = element.querySelector(`[data-joint="${leg}-root"]`)!
  return Math.hypot(
    Number(hoof.getAttribute("cx")) - Number(root.getAttribute("cx")),
    Number(hoof.getAttribute("cy")) - Number(root.getAttribute("cy")),
  )
}

describe("pegasus behaviours", () => {
  it("keeps every sampled pose inside its own limits", () => {
    for (const clock of [0, 0.6, 2.3, 7.1]) {
      for (const behavior of flights) {
        const pose = pegasusBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(pose.stride).toBeGreaterThanOrEqual(0)
        expect(pose.stride).toBeLessThanOrEqual(1)
        expect(pose.wingbeats).toBeGreaterThan(0)
        for (const at of cycle) {
          const stance = pose.stance(at)
          expect(stance.lift, `${behavior} lift`).toBeGreaterThanOrEqual(0)
          expect(stance.lift, `${behavior} lift`).toBeLessThanOrEqual(1)
          expect(stance.spread, `${behavior} spread`).toBeGreaterThanOrEqual(0)
          expect(stance.spread, `${behavior} spread`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.neck), `${behavior} neck`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("puts each behaviour on the side of the handover it belongs to", () => {
    // On the floor, and in the air, and the one that crosses between them.
    expect(Math.max(...cycle.map((at) => pegasusBehaviorPose("canter", 0).stance(at).lift))).toBe(0)
    expect(Math.min(...cycle.map((at) => pegasusBehaviorPose("soar", 0).stance(at).lift))).toBe(1)
    expect(Math.min(...cycle.map((at) => pegasusBehaviorPose("hover", 0).stance(at).lift))).toBe(1)
    const launch = cycle.map((at) => pegasusBehaviorPose("launch", 0).stance(at).lift)
    expect(Math.min(...launch)).toBeLessThan(0.2)
    expect(Math.max(...launch)).toBeGreaterThan(0.8)
    // A folded wing on the ground, a spread one in the air, and the hover
    // beats fastest because it is holding station on the wings alone.
    expect(pegasusBehaviorPose("static", 0).stance(0).spread).toBeLessThan(0.3)
    expect(pegasusBehaviorPose("soar", 0).stance(0).spread).toBeGreaterThan(0.9)
    expect(pegasusBehaviorPose("hover", 0).wingbeats).toBeGreaterThan(pegasusBehaviorPose("soar", 0).wingbeats)
  })
})

describe("the pegasus wing", () => {
  it("traces a figure of eight: twice fore and aft for every once up and down", () => {
    const samples = Array.from({ length: 64 }, (_, i) => pegasusWingtip(i / 64, 1))
    const crossings = (pick: (p: { forward: number; up: number }) => number) =>
      samples.filter((point, index) => {
        const next = samples[(index + 1) % samples.length]
        return pick(point) <= 0 && pick(next) > 0
      }).length
    expect(crossings((p) => p.up)).toBe(1)
    expect(crossings((p) => p.forward)).toBe(2)
    // The tip really does travel: it is not a point.
    const rise = samples.map((p) => p.up)
    expect(Math.max(...rise) - Math.min(...rise)).toBeGreaterThan(20)
  })

  it("folds the whole path in as the spread closes, and is neutral on nonsense", () => {
    const reachOf = (spread: number) =>
      Math.max(...Array.from({ length: 16 }, (_, i) => Math.abs(pegasusWingtip(i / 16, spread).across)))
    expect(reachOf(0)).toBeLessThan(reachOf(1))
    expect(reachOf(0.5)).toBeLessThan(reachOf(1))
    expect(pegasusWingtip(Number.NaN, Number.NaN)).toEqual(pegasusWingtip(0, 0))
  })

  it("keeps every bone exactly its own length at any beat and any spread", () => {
    for (const spread of [0, 0.3, 0.7, 1]) {
      for (const beat of [0, 0.13, 0.37, 0.5, 0.62, 0.88]) {
        const bones = pegasusWingBones(beat, spread)
        expect(bones.lengths).toHaveLength(3)
        bones.lengths.forEach((length, index) => {
          expect(length, `bone ${index} at ${beat}/${spread}`).toBeCloseTo(pegasusWingLinks[index], 4)
        })
      }
    }
  })
})

describe("robot pegasus", () => {
  it("hands the weight from the legs to the wings", () => {
    const { container, rerender } = render(
      <RobotPegasus lift={0} gait="canter" phase={0.2} interactive={false} animate={false} />,
    )
    const loads = () =>
      [...container.querySelectorAll("[data-leg]")].map((leg) => Number(leg.getAttribute("data-load")))
    const grounded = loads()
    expect(Math.max(...grounded)).toBeGreaterThan(0)
    const withers = Number(container.querySelector('[data-joint="withers"]')!.getAttribute("cy"))
    const span = limbSpan(container, "fore-left")

    rerender(<RobotPegasus lift={1} gait="canter" phase={0.2} interactive={false} animate={false} />)
    // In the air the wings carry all of it, so no foot carries anything…
    expect(loads().every((load) => load === 0)).toBe(true)
    expect(container.querySelector("[data-lift]")!.getAttribute("data-lift")).toBe("1")
    // …the body is off the floor…
    expect(Number(container.querySelector('[data-joint="withers"]')!.getAttribute("cy"))).toBeGreaterThan(withers)
    // …and the legs, with no floor left in reach, fold in under it.
    expect(limbSpan(container, "fore-left")).toBeLessThan(span)

    // Half way across, the legs are carrying half a body between them.
    rerender(<RobotPegasus lift={0.5} gait="canter" phase={0.2} interactive={false} animate={false} />)
    const shared = loads().reduce((sum, load) => sum + load, 0)
    expect(shared).toBeGreaterThan(0.4)
    expect(shared).toBeLessThan(0.6)
  })

  it("beats both wings and draws them from one solved spar", () => {
    const { container, rerender } = render(
      <RobotPegasus lift={1} beat={0} spread={1} interactive={false} animate={false} />,
    )
    expect(container.querySelectorAll("[data-wing]")).toHaveLength(2)
    const left = container.querySelector('[data-wing="left"]')!.innerHTML
    const right = container.querySelector('[data-wing="right"]')!.innerHTML
    expect(left).not.toBe(right)

    rerender(<RobotPegasus lift={1} beat={0.3} spread={1} interactive={false} animate={false} />)
    expect(container.querySelector('[data-wing="left"]')!.innerHTML).not.toBe(left)

    // Furled, the wing is a different drawing from the spread one.
    rerender(<RobotPegasus lift={1} beat={0.3} spread={0} interactive={false} animate={false} />)
    expect(container.querySelector('[data-wing="left"]')!.innerHTML).not.toBe(left)
  })

  it("is a slider on the handover, and says where it is", () => {
    const onLiftChange = vi.fn()
    const { getByRole } = render(<RobotPegasus behavior="soar" onLiftChange={onLiftChange} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
    expect(slider.getAttribute("aria-label")).toMatch(/Robot pegasus/)

    fireEvent.keyDown(slider, { key: "Home" })
    expect(onLiftChange).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(slider, { key: "End" })
    expect(onLiftChange).toHaveBeenLastCalledWith(1)
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotPegasus
        behavior={"swoop" as PegasusBehavior}
        lift={Number.NaN}
        spread={Number.NaN}
        beat={Number.NaN}
        phase={Number.NaN}
        neck={Number.NaN}
        tail={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-wing]")).toHaveLength(2)
    expect(container.querySelectorAll("[data-fetlock]")).toHaveLength(4)
  })
})

/* -------------------------------------------------------------------------- */

/** A drag across a machine whose box jsdom otherwise reports as zero-sized. */
function drag(svg: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect
  fireEvent.pointerDown(svg, { clientX: from.x, clientY: from.y, pointerId: 1 })
  fireEvent.pointerMove(svg, { clientX: to.x, clientY: to.y, pointerId: 1 })
  fireEvent.pointerUp(svg, { clientX: to.x, clientY: to.y, pointerId: 1 })
}

describe("grabbing the equine machines", () => {
  it("scrubs the horse's stride across the frame", () => {
    const onPhaseChange = vi.fn()
    const { getByRole } = render(<RobotHorse behavior="walk" onPhaseChange={onPhaseChange} />)
    // The width of the box is one whole stride, so a quarter across is a
    // quarter through the cycle.
    drag(getByRole("slider"), { x: 20, y: 100 }, { x: 50, y: 100 })
    expect(onPhaseChange).toHaveBeenLastCalledWith(0.25)
    drag(getByRole("slider"), { x: 50, y: 100 }, { x: 150, y: 100 })
    expect(onPhaseChange).toHaveBeenLastCalledWith(0.75)
  })

  it("works the pegasus's handover up and down the frame", () => {
    const onLiftChange = vi.fn()
    const { getByRole } = render(<RobotPegasus behavior="launch" onLiftChange={onLiftChange} />)
    // The bottom of the box is the floor and the top is flight.
    drag(getByRole("slider"), { x: 100, y: 200 }, { x: 100, y: 200 })
    expect(onLiftChange).toHaveBeenLastCalledWith(0)
    drag(getByRole("slider"), { x: 100, y: 100 }, { x: 100, y: 0 })
    expect(onLiftChange).toHaveBeenLastCalledWith(1)
  })

  it("parks every loop under a reduced-motion preference", () => {
    const reduced = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    vi.stubGlobal("matchMedia", reduced)
    try {
      // Parked, the drawing is the same twice over: there is no clock moving
      // underneath it, which is the whole of the preference.
      const horse = render(<RobotHorse behavior="gallop" interactive={false} />)
      const first = horse.container.innerHTML
      horse.rerender(<RobotHorse behavior="gallop" interactive={false} />)
      expect(horse.container.innerHTML).toBe(first)

      const pegasus = render(<RobotPegasus behavior="hover" interactive={false} />)
      const flying = pegasus.container.innerHTML
      pegasus.rerender(<RobotPegasus behavior="hover" interactive={false} />)
      expect(pegasus.container.innerHTML).toBe(flying)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
