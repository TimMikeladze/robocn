import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { solveGait } from "@/lib/robocn/gait"

import {
  RobotCamel,
  camelBehaviorPose,
  camelRoll,
  type CamelBehavior,
} from "@/components/ui/robot-camel"

const behaviors: CamelBehavior[] = ["pace", "walk", "trot", "couch", "static"]
const cycle = [0, 0.17, 0.33, 0.5, 0.67, 0.83]

/** How far below the ground line one pad has settled. */
function sinkOf(element: HTMLElement, leg: string) {
  return -Number(element.querySelector(`[data-hoof="${leg}"]`)!.getAttribute("cy"))
}

describe("camel behaviours", () => {
  it("keeps every sampled pose inside its own limits", () => {
    for (const clock of [0, 0.6, 2.3, 7.1]) {
      for (const behavior of behaviors) {
        const pose = camelBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        expect(pose.stride).toBeGreaterThanOrEqual(0)
        expect(pose.stride).toBeLessThanOrEqual(1)
        for (const at of cycle) {
          const stance = pose.stance(at)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.neck), `${behavior} neck`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("gives each behaviour the gait it is named for", () => {
    expect(camelBehaviorPose("pace", 0).gait).toBe("pace")
    expect(camelBehaviorPose("walk", 0).gait).toBe("walk")
    expect(camelBehaviorPose("trot", 0).gait).toBe("trot")
    // Couched is down and halted, with the legs folded right under it.
    expect(camelBehaviorPose("couch", 0).gait).toBe("halt")
    expect(camelBehaviorPose("couch", 0).stance(0).crouch).toBeGreaterThan(0.8)
    expect(camelBehaviorPose("static", 0).gait).toBe("halt")
    expect(camelBehaviorPose("walk", Number.NaN).gaze).toBe(0)
  })
})

describe("the roll a pace makes", () => {
  it("throws the body right over on a pace and barely moves it on a trot", () => {
    // A pace puts both feet of one side down together, so every bit of the
    // animal's weight is on one side and it rolls hard away from it, once each
    // way per stride.
    const paced = cycle.map((phase) => camelRoll("pace", phase))
    expect(Math.max(...paced)).toBeCloseTo(1, 9)
    expect(Math.min(...paced)).toBeCloseTo(-1, 9)

    // A trot's support is diagonal, so all that is ever off-centre is the
    // difference between what the forehand carries and what the hind end does
    // — 0.16 of a body, exactly, at every instant either diagonal is down, and
    // nothing at all in the suspension.
    const residual = 2 * solveGait({ gait: "trot" }).forehand - 1
    for (const phase of cycle) {
      const pose = solveGait({ gait: "trot", phase })
      expect(Math.abs(camelRoll("trot", phase)), `trot at ${phase}`).toBeCloseTo(
        pose.airborne ? 0 : residual,
        9,
      )
    }
    expect(residual).toBeLessThan(0.2)

    // Standing square there is nothing to roll, and a walk — lateral in
    // sequence but never in pairs — rolls somewhere between the two.
    for (const phase of cycle) expect(camelRoll("halt", phase)).toBeCloseTo(0, 9)
    const walked = cycle.map((phase) => Math.abs(camelRoll("walk", phase)))
    expect(Math.max(...walked)).toBeGreaterThan(residual)
    expect(Math.max(...walked)).toBeLessThan(1)
    expect(camelRoll("pace", Number.NaN)).toBe(camelRoll("pace", 0))
  })
})

describe("robot camel", () => {
  it("sinks the loaded feet into soft ground and leaves them on top of hard ground", () => {
    const { container, rerender } = render(
      <RobotCamel gait="pace" phase={0.2} ground={0} interactive={false} animate={false} />,
    )
    const legs = ["fore-left", "fore-right", "hind-left", "hind-right"]
    const loadOf = (leg: string) =>
      Number(container.querySelector(`[data-leg="${leg}"]`)!.getAttribute("data-load"))
    // On rock, every foot that is down is exactly on the line. A foot in the
    // air is above it, which is the swing, not the ground.
    for (const leg of legs.filter((id) => loadOf(id) > 0)) {
      expect(sinkOf(container, leg), `${leg} on rock`).toBeCloseTo(0, 6)
    }

    rerender(<RobotCamel gait="pace" phase={0.2} ground={1} interactive={false} animate={false} />)
    const sunk = legs.filter((leg) => sinkOf(container, leg) > 0.2)
    const loaded = legs.filter((leg) => loadOf(leg) > 0)
    // Exactly the feet carrying weight are the feet in the sand.
    expect(sunk.sort()).toEqual(loaded.sort())
    expect(sunk).toHaveLength(2)
  })

  it("opens the pad under load, and the open pad is what keeps it up", () => {
    const { container, rerender } = render(
      <RobotCamel gait="halt" ground={1} interactive={false} animate={false} />,
    )
    const padWidth = (leg: string) =>
      Number(container.querySelector(`[data-pad="${leg}"]`)!.getAttribute("rx"))
    const standing = padWidth("fore-left")
    const settled = sinkOf(container, "fore-left")

    // A limb in the air carries nothing, so its pad is shut.
    rerender(<RobotCamel gait="trot" phase={0.7} ground={1} interactive={false} animate={false} />)
    const swinging = ["fore-left", "fore-right", "hind-left", "hind-right"].find(
      (leg) => Number(container.querySelector(`[data-leg="${leg}"]`)!.getAttribute("data-load")) === 0,
    )!
    expect(padWidth(swinging)).toBeLessThan(standing)
    expect(standing).toBeGreaterThan(0)
    expect(settled).toBeGreaterThan(0)
  })

  it("slumps the hump as the reserve goes, keeping its base", () => {
    const { container, rerender } = render(
      <RobotCamel behavior="static" reserve={1} interactive={false} animate={false} />,
    )
    const hump = () => container.querySelector("[data-hump]")!.getAttribute("d")!
    const heightOf = () => {
      const ys = [...hump().matchAll(/-?\d+\.?\d*\s(-?\d+\.?\d*)/g)].map((m) => Number(m[1]))
      return Math.max(...ys) - Math.min(...ys)
    }
    const full = heightOf()
    const shape = hump()

    rerender(<RobotCamel behavior="static" reserve={0} interactive={false} animate={false} />)
    expect(hump()).not.toBe(shape)
    // An empty store is lower than a full one, and it is a different shape
    // rather than the same one scaled: it has folded over.
    expect(heightOf()).toBeLessThan(full)
  })

  it("is a slider on the ground, and says what it is standing on", () => {
    const onGroundChange = vi.fn()
    const { getByRole } = render(<RobotCamel behavior="pace" onGroundChange={onGroundChange} />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
    expect(slider.getAttribute("aria-label")).toMatch(/Robot camel/)

    fireEvent.keyDown(slider, { key: "End" })
    expect(onGroundChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(slider, { key: "Home" })
    expect(onGroundChange).toHaveBeenLastCalledWith(0)
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotCamel
        behavior={"amble" as CamelBehavior}
        phase={Number.NaN}
        ground={Number.NaN}
        reserve={Number.NaN}
        arch={Number.NaN}
        crouch={Number.NaN}
        neck={Number.NaN}
        tail={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-pad]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-ear]")).toHaveLength(2)
    expect(container.querySelector("[data-hump]")).not.toBeNull()
  })
})

describe("grabbing the camel", () => {
  it("works the ground down the frame, so dragging down is sinking", () => {
    const onGroundChange = vi.fn()
    const { getByRole, container } = render(<RobotCamel behavior="pace" onGroundChange={onGroundChange} />)
    const svg = getByRole("slider")
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect

    fireEvent.pointerDown(svg, { clientX: 100, clientY: 0, pointerId: 1 })
    expect(onGroundChange).toHaveBeenLastCalledWith(0)
    const onRock = container.querySelector("[data-ground]")!.getAttribute("data-softness")

    fireEvent.pointerMove(svg, { clientX: 100, clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 200, pointerId: 1 })
    expect(onGroundChange).toHaveBeenLastCalledWith(1)
    // And the ground under it actually changed, not just the callback.
    expect(container.querySelector("[data-ground]")!.getAttribute("data-softness")).not.toBe(onRock)
  })
})
