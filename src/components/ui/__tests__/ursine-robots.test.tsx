import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { RobotBear, bearBehaviorPose, type BearBehavior } from "@/components/ui/robot-bear"

const bearBehaviors: BearBehavior[] = ["amble", "rear", "forage", "static"]

/** The behaviours are pure functions of the clock, so they sample directly. */
describe("bear behaviours", () => {
  it("keeps every sampled stance inside its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 6.2]) {
      for (const behavior of bearBehaviors) {
        const pose = bearBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        expect(pose.balance).toBeGreaterThanOrEqual(0)
        expect(pose.balance).toBeLessThanOrEqual(1)
        for (const cycle of [0, 0.2, 0.45, 0.6, 0.85, 0.99]) {
          const stance = pose.stance(cycle)
          expect(stance.rear, `${behavior} rear`).toBeGreaterThanOrEqual(0)
          expect(stance.rear, `${behavior} rear`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(stance.dig, `${behavior} dig`).toBeGreaterThanOrEqual(0)
          expect(Number.isFinite(stance.stride), `${behavior} stride`).toBe(true)
        }
      }
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // Rearing is the only behaviour that stands up, and it hands the carriage
    // to the balance rule entirely.
    const rearing = bearBehaviorPose("rear", 0)
    const rise = [0, 0.2, 0.5, 0.7, 0.95].map((t) => rearing.stance(t).rear)
    expect(Math.max(...rise)).toBeGreaterThan(0.85)
    expect(Math.min(...rise)).toBeLessThan(0.2)
    expect(rearing.balance).toBe(1)

    // The amble walks; nothing else does.
    const amble = bearBehaviorPose("amble", 0)
    expect(amble.stance(0.5).stride).not.toBe(amble.stance(0).stride)
    expect(amble.stance(0.5).rear).toBe(0)
    expect(bearBehaviorPose("static", 0).stance(0.5).stride).toBeGreaterThan(1.5)

    // Foraging is the only one that works the forepaw.
    const forage = bearBehaviorPose("forage", 0)
    expect(Math.max(...[0, 0.25, 0.5, 0.75].map((t) => forage.stance(t).dig))).toBeGreaterThan(0.8)
    expect(forage.gaze).toBeLessThan(0)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(bearBehaviorPose("amble", Number.NaN).gaze).toBe(0)
    expect(bearBehaviorPose("rear", Number.NaN).stance(0).rear).toBe(
      bearBehaviorPose("rear", 0).stance(0).rear,
    )
  })
})

describe("robot bear", () => {
  it("stands on soles: four of them, each a segment on the floor", () => {
    const { container } = render(<RobotBear behavior="static" rear={0} interactive={false} showContacts />)
    expect(container.querySelectorAll("[data-sole]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    // A flat sole covers an interval, not a point.
    const contacts = [...container.querySelectorAll("[data-contact]")]
    expect(contacts.length).toBeGreaterThanOrEqual(4)
    for (const mark of contacts) {
      expect(Number(mark.getAttribute("width"))).toBeGreaterThan(4)
    }
  })

  it("lifts the forelimbs and shortens the base of support when it rears", () => {
    const spanOf = (rear: number) => {
      const { container, unmount } = render(
        <RobotBear behavior="static" rear={rear} balance={1} interactive={false} showSupport />,
      )
      const bar = container.querySelector("[data-support] rect")!
      const width = Number(bar.getAttribute("width"))
      const fore = container.querySelector('[data-sole="fore-left"]')!.getAttribute("data-contact-state")
      unmount()
      return { width, fore }
    }
    const down = spanOf(0)
    const up = spanOf(1)

    expect(down.fore).toBe("flat")
    expect(up.fore).toBe("airborne")
    // Four soles make a long base; two make a short one.
    expect(up.width).toBeLessThan(down.width / 2)
  })

  it("keeps the mass over the feet when the balance rule is on, and topples when it is not", () => {
    const stableAt = (balance: number) => {
      const { container, unmount } = render(
        <RobotBear behavior="static" rear={1} balance={balance} interactive={false} showSupport />,
      )
      const group = container.querySelector("[data-support]")!
      const state = group.getAttribute("data-stable")
      const com = Number(container.querySelector("[data-com]")!.getAttribute("d")!.split(" ")[1])
      unmount()
      return { state, com }
    }
    const held = stableAt(1)
    const loose = stableAt(0)

    expect(held.state).toBe("true")
    expect(loose.state).toBe("false")
    // Holding the margin means bringing the mass back over the hind soles.
    expect(held.com).toBeLessThan(loose.com)
  })

  it("swells the hump with the load on the forelimbs, and flattens it when they carry nothing", () => {
    const { container, rerender } = render(
      <RobotBear behavior="static" rear={0} balance={1} interactive={false} />,
    )
    const loaded = container.querySelector("[data-hump]")!.getAttribute("d")

    rerender(<RobotBear behavior="static" rear={1} balance={1} interactive={false} />)
    const unloaded = container.querySelector("[data-hump]")!.getAttribute("d")
    expect(unloaded).not.toBe(loaded)

    // And an explicit hump overrides the mechanism.
    rerender(<RobotBear behavior="static" rear={0} hump={12} interactive={false} />)
    expect(container.querySelector("[data-hump]")!.getAttribute("d")).not.toBe(loaded)
  })

  it("takes the gaze and the ears, and says what it is doing", () => {
    const { container, getByRole, rerender } = render(
      <RobotBear behavior="static" gaze={-1} ears={1} interactive={false} />,
    )
    const ears = container.querySelector("[data-ears]")!.innerHTML
    const eyes = container.querySelector("[data-eyes]")!.innerHTML
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/Robot bear, standing, side elevation/)

    rerender(<RobotBear behavior="static" gaze={1} ears={-1} interactive={false} />)
    expect(container.querySelector("[data-ears]")!.innerHTML).not.toBe(ears)
    expect(container.querySelector("[data-eyes]")!.innerHTML).not.toBe(eyes)

    rerender(<RobotBear behavior="static" rear={1} interactive={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/standing on its hind legs/)
  })

  it("hands a person the rear as a slider", () => {
    const { getByRole } = render(<RobotBear behavior="static" rear={0.4} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("40")
    expect(slider.getAttribute("aria-valuetext")).toBe("40 percent reared")
    expect(slider.getAttribute("tabindex")).toBe("0")
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotBear
        behavior={"hibernate" as BearBehavior}
        rear={Number.NaN}
        balance={Number.NaN}
        arch={Number.NaN}
        crouch={Number.NaN}
        hump={Number.NaN}
        dig={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        phase={Number.NaN}
        speed={Number.NaN}
        interactive={false}
        showSupport
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-sole]")).toHaveLength(4)
  })
})
