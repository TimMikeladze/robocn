import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RobotCat, catBehaviorPose, type CatBehavior } from "@/components/ui/robot-cat"

const behaviors: CatBehavior[] = ["prowl", "pounce", "arch", "sit", "static"]

describe("cat behaviours", () => {
  it("keeps every sampled stance inside its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 6.2]) {
      for (const behavior of behaviors) {
        const pose = catBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        for (const cycle of [0, 0.2, 0.37, 0.5, 0.8, 0.99]) {
          const stance = pose.stance(cycle)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.tail), `${behavior} tail`).toBeLessThanOrEqual(1)
          expect(stance.altitude, `${behavior} altitude`).toBeGreaterThanOrEqual(0)
          expect(stance.altitude, `${behavior} altitude`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // Only the pounce leaves the ground, and it both loads and extends the back.
    const pounce = catBehaviorPose("pounce", 0)
    const heights = [0, 0.2, 0.4, 0.6, 0.8].map((t) => pounce.stance(t).altitude)
    expect(Math.max(...heights)).toBeGreaterThan(0.8)
    expect(pounce.stance(0.3).arch).toBeGreaterThan(0.3)
    expect(pounce.stance(0.46).arch).toBeLessThan(0)

    expect(catBehaviorPose("prowl", 0).rate).toBe(1)
    expect(catBehaviorPose("sit", 0).rate).toBe(0)
    expect(catBehaviorPose("sit", 0).stance(0).haunch).toBe(1)
    expect(catBehaviorPose("arch", 0).stance(0).arch).toBeGreaterThan(0.7)
    expect(catBehaviorPose("arch", 0).ears).toBeLessThan(0)
    expect(catBehaviorPose("static", 0).stance(0).altitude).toBe(0)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(catBehaviorPose("prowl", Number.NaN).gaze).toBe(0)
    expect(catBehaviorPose("sit", Number.NaN).gaze).toBe(0)
    expect(catBehaviorPose("arch", Number.NaN).stance(0).arch).toBe(catBehaviorPose("arch", 0).stance(0).arch)
  })
})

describe("robot cat", () => {
  it("moves the leg roots when the back arches, and the legs with them", () => {
    const { container, getByRole, rerender } = render(
      <RobotCat behavior="static" arch={0} crouch={0.3} interactive={false} />,
    )
    const spine = container.querySelector("[data-spine]")!.getAttribute("d")
    const hind = container.querySelector('[data-leg="hind-left"] path')!.getAttribute("d")
    const fore = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")

    rerender(<RobotCat behavior="static" arch={0.9} crouch={0.3} interactive={false} />)

    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(spine)
    // The hip rides the spine, so the hind leg has to re-solve. The shoulder is
    // spine joint 0 and does not move, which is the asymmetry worth pinning.
    expect(container.querySelector('[data-leg="hind-left"] path')!.getAttribute("d")).not.toBe(hind)
    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).toBe(fore)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot cat")
  })

  it("drives the crouch, the tail and the ears from props alone", () => {
    const { container, rerender } = render(
      <RobotCat behavior="static" crouch={0.1} tail={-0.5} ears={1} gaze={0} interactive={false} />,
    )
    const leg = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")
    const tail = container.querySelector("[data-tail] path")!.getAttribute("d")
    const ear = container.querySelector('[data-ear="left"]')!.getAttribute("transform")

    rerender(<RobotCat behavior="static" crouch={0.9} tail={0.9} ears={-1} gaze={0} interactive={false} />)

    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).not.toBe(leg)
    expect(container.querySelector("[data-tail] path")!.getAttribute("d")).not.toBe(tail)
    expect(container.querySelector('[data-ear="left"]')!.getAttribute("transform")).not.toBe(ear)
  })

  it("walks all four legs on a controlled cycle and marks the loaded paws", () => {
    const { container, rerender } = render(
      <RobotCat behavior="prowl" phase={0} showContacts interactive={false} />,
    )
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-contact]").length).toBeGreaterThan(0)
    const legs = [...container.querySelectorAll("[data-leg] path")].map((node) => node.getAttribute("d"))

    rerender(<RobotCat behavior="prowl" phase={0.4} showContacts interactive={false} />)

    const moved = [...container.querySelectorAll("[data-leg] path")].map((node) => node.getAttribute("d"))
    expect(moved).not.toEqual(legs)
  })

  it("names the view and redraws the body for a tipped camera", () => {
    const { container, getByRole, rerender } = render(
      <RobotCat behavior="static" arch={0.4} interactive={false} />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("side elevation")
    expect(container.querySelector("[data-solids]")).toBeNull()
    const body = container.querySelector("[data-cat]")!.innerHTML

    rerender(<RobotCat behavior="static" arch={0.4} view="iso" interactive={false} />)

    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
    expect(container.querySelector("[data-solids]")).not.toBeNull()
    expect(container.querySelector("[data-cat]")!.getAttribute("data-view")).toBe("iso")
    expect(container.querySelector("[data-cat]")!.innerHTML).toBe(body)
  })

  it("pounces on a click, and only when it is interactive", () => {
    const onPounce = vi.fn()
    const { getByRole, rerender } = render(<RobotCat behavior="static" onPounce={onPounce} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onPounce).toHaveBeenCalledTimes(1)

    rerender(<RobotCat behavior="static" onPounce={onPounce} interactive={false} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onPounce).toHaveBeenCalledTimes(1)
  })

  it("renders a stable pose for invalid input, with a colour override landing", () => {
    const { container, getByRole } = render(
      <RobotCat
        behavior="static"
        arch={Number.NaN}
        crouch={Number.NaN}
        tail={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        phase={Number.NaN}
        color="#ff0088"
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toContain("NaN")
    expect(container.innerHTML).toContain("#ff0088")
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot cat")
  })
})
