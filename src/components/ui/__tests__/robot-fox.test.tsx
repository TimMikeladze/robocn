import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  RobotFox,
  foxBehaviorPose,
  foxDive,
  foxEarBearing,
  type FoxBehavior,
} from "@/components/ui/robot-fox"

const behaviors: FoxBehavior[] = ["mouse", "trot", "listen", "curl", "static"]

describe("fox behaviours", () => {
  it("keeps every sampled stance inside its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 6.2]) {
      for (const behavior of behaviors) {
        const pose = foxBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.bearing)).toBeLessThanOrEqual(1)
        expect(pose.range).toBeGreaterThanOrEqual(0)
        expect(pose.range).toBeLessThanOrEqual(1)
        expect(pose.counterweight).toBeGreaterThanOrEqual(0)
        expect(pose.counterweight).toBeLessThanOrEqual(1)
        for (const cycle of [0, 0.2, 0.37, 0.5, 0.62, 0.8, 0.99]) {
          const stance = pose.stance(cycle)
          expect(Math.abs(stance.pitch), `${behavior} pitch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.tail), `${behavior} tail`).toBeLessThanOrEqual(1)
          expect(stance.altitude, `${behavior} altitude`).toBeGreaterThanOrEqual(0)
          expect(stance.altitude, `${behavior} altitude`).toBeLessThanOrEqual(1)
          expect(Number.isFinite(stance.stride), `${behavior} stride`).toBe(true)
        }
      }
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // The mouse is the only behaviour that rears and then dives: the pitch has
    // to reach well above zero and well below it inside one cycle.
    const mouse = foxBehaviorPose("mouse", 0)
    const pitches = [0, 0.1, 0.3, 0.45, 0.52, 0.6, 0.7, 0.85, 0.95].map((t) => mouse.stance(t).pitch)
    expect(Math.max(...pitches)).toBeGreaterThan(0.5)
    expect(Math.min(...pitches)).toBeLessThan(-0.4)
    // And it is the one that hands the tail over to the body entirely.
    expect(mouse.counterweight).toBe(1)

    // The trot walks; nothing else does. The back stays level and the brush is
    // nearly its own master again.
    const trot = foxBehaviorPose("trot", 0)
    expect(trot.stance(0.5).stride).not.toBe(trot.stance(0).stride)
    expect(Math.abs(trot.stance(0.3).pitch)).toBeLessThan(0.2)
    expect(trot.counterweight).toBeLessThan(0.5)

    // Listening plants the feet and works the ears across the frame.
    const listen = foxBehaviorPose("listen", 0)
    expect(listen.stance(0).stride).toBe(listen.stance(0.7).stride)
    expect(listen.ears).toBeGreaterThan(0.8)
    expect(foxBehaviorPose("listen", 0).bearing).not.toBe(foxBehaviorPose("listen", 1.4).bearing)

    // Curled up: croup on the floor, and the counterweight off — a sleeping
    // animal is not balancing anything.
    const curl = foxBehaviorPose("curl", 0)
    expect(curl.stance(0).haunch).toBe(1)
    expect(curl.counterweight).toBe(0)
    expect(curl.stance(0).tail).toBeGreaterThan(0.5)

    expect(foxBehaviorPose("static", 0).stance(0).altitude).toBe(0)
    expect(foxBehaviorPose("static", 0).stance(0).pitch).toBe(0)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(foxBehaviorPose("mouse", Number.NaN).gaze).toBe(0)
    expect(foxBehaviorPose("listen", Number.NaN).bearing).toBe(foxBehaviorPose("listen", 0).bearing)
    expect(foxBehaviorPose("trot", Number.NaN).stance(0).pitch).toBe(
      foxBehaviorPose("trot", 0).stance(0).pitch,
    )
  })

  it("keeps the dive inside its limits and neutral for a non-finite clock", () => {
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const dive = foxDive(t)
      expect(Math.abs(dive.pitch)).toBeLessThanOrEqual(1)
      expect(dive.lift).toBeGreaterThanOrEqual(0)
      expect(dive.lift).toBeLessThanOrEqual(1)
    }
    // It rears before it dives, which is the whole gesture.
    const arc = [0, 0.15, 0.3, 0.45, 0.6, 0.8].map((t) => foxDive(t).pitch)
    expect(Math.max(...arc)).toBeGreaterThan(0.3)
    expect(Math.min(...arc)).toBeLessThan(-0.3)
    expect(foxDive(Number.NaN)).toEqual(foxDive(0))
  })
})

describe("fox ears", () => {
  it("converges both ears on one point, and the disparity closes with the range", () => {
    const far = foxEarBearing(0, 0)
    const near = foxEarBearing(0, 1)
    // Dead ahead, the two pans are equal and opposite.
    expect(far.left).toBeCloseTo(-far.right, 6)
    // A closer quarry makes the axes converge harder.
    expect(Math.abs(near.disparity)).toBeGreaterThan(Math.abs(far.disparity))
    // And a quarry to one side swings both ears the same way.
    const side = foxEarBearing(1, 0.5)
    expect(side.left).toBeGreaterThan(foxEarBearing(-1, 0.5).left)
    expect(side.right).toBeGreaterThan(foxEarBearing(-1, 0.5).right)
  })

  it("is neutral for invalid input", () => {
    expect(foxEarBearing(Number.NaN, Number.NaN)).toEqual(foxEarBearing(0, 0))
  })
})

describe("robot fox", () => {
  it("tips the whole body about the hip, and the forelegs answer for it", () => {
    const { container, rerender } = render(
      <RobotFox behavior="static" pitch={0} crouch={0.3} interactive={false} />,
    )
    const hipAt = () => {
      const marker = container.querySelector('[data-joint="hip"]')!
      return [marker.getAttribute("cx"), marker.getAttribute("cy")].join()
    }
    const spine = container.querySelector("[data-spine]")!.getAttribute("d")
    const fore = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")
    const shoulder = container.querySelector('[data-joint="fore-left-shoulder"]')!.getAttribute("cy")
    const hip = hipAt()

    rerender(<RobotFox behavior="static" pitch={0.9} crouch={0.3} interactive={false} />)

    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(spine)
    // The shoulder is carried by the trunk, so tipping the body takes it up —
    // the drawing frame is y-up, so that is a larger cy.
    expect(
      Number(container.querySelector('[data-joint="fore-left-shoulder"]')!.getAttribute("cy")),
    ).toBeGreaterThan(Number(shoulder))
    // …and the foreleg has to answer for it.
    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).not.toBe(fore)
    // The hip is the joint the whole animal turns about: it does not move.
    expect(hipAt()).toBe(hip)
  })

  it("folds the foreleg once the floor is out of its reach", () => {
    const reachOf = (pitch: number) => {
      const { container, unmount } = render(
        <RobotFox behavior="static" pitch={pitch} crouch={0} interactive={false} showGround={false} />,
      )
      const paw = container.querySelector('[data-leg="fore-left"] rect')!
      const shoulder = container.querySelector('[data-joint="fore-left-shoulder"]')!
      const span = Math.hypot(
        Number(paw.getAttribute("x")) - Number(shoulder.getAttribute("cx")),
        Number(paw.getAttribute("y")) - Number(shoulder.getAttribute("cy")),
      )
      unmount()
      return span
    }
    // Standing, the foreleg is run out to the floor. Reared right up, the floor
    // is unreachable and the limb draws in rather than dangling at full stretch.
    expect(reachOf(1)).toBeLessThan(reachOf(0))
  })

  it("hands the brush to the body when the counterweight is on", () => {
    // With the counterweight off the carriage is whatever it was given; with it
    // on, the same carriage prop is overridden by the pitch.
    const { container, rerender } = render(
      <RobotFox behavior="static" pitch={0.8} tail={0.6} counterweight={0} interactive={false} />,
    )
    const scripted = container.querySelector("[data-brush]")!.innerHTML

    rerender(
      <RobotFox behavior="static" pitch={0.8} tail={0.6} counterweight={1} interactive={false} />,
    )
    const balanced = container.querySelector("[data-brush]")!.innerHTML
    expect(balanced).not.toBe(scripted)

    // And with it on, the brush answers the pitch rather than the prop.
    rerender(
      <RobotFox behavior="static" pitch={-0.8} tail={0.6} counterweight={1} interactive={false} />,
    )
    expect(container.querySelector("[data-brush]")!.innerHTML).not.toBe(balanced)
  })

  it("pans the two ears independently onto one bearing", () => {
    const { container, rerender } = render(
      <RobotFox behavior="static" bearing={-1} range={0.9} interactive={false} />,
    )
    const left = container.querySelector('[data-ear="left"]')!.getAttribute("d")
    const right = container.querySelector('[data-ear="right"]')!.getAttribute("d")
    expect(left).not.toBe(right)

    rerender(<RobotFox behavior="static" bearing={1} range={0.9} interactive={false} />)
    expect(container.querySelector('[data-ear="left"]')!.getAttribute("d")).not.toBe(left)
    expect(container.querySelector('[data-ear="right"]')!.getAttribute("d")).not.toBe(right)

    // Range is its own axis: the same bearing at a different distance is a
    // different pair of pans, because the ears are a fixed span apart.
    rerender(<RobotFox behavior="static" bearing={1} range={0} interactive={false} />)
    expect(container.querySelector('[data-ear="left"]')!.getAttribute("d")).not.toBe(
      container.querySelector('[data-ear="right"]')!.getAttribute("d"),
    )
  })

  it("takes the ears and the gaze, and says what it is doing", () => {
    const { container, getByRole, rerender } = render(
      <RobotFox behavior="static" ears={1} gaze={0} interactive={false} />,
    )
    const ear = container.querySelector("[data-ears]")!.innerHTML
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/Robot fox, still, side elevation/)

    rerender(<RobotFox behavior="static" ears={-1} gaze={0} interactive={false} />)
    expect(container.querySelector("[data-ears]")!.innerHTML).not.toBe(ear)

    rerender(<RobotFox behavior="listen" interactive={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/listening/)
  })

  it("dives on a click only while it is interactive", () => {
    const onDive = vi.fn()
    const { getByRole, rerender } = render(<RobotFox behavior="static" onDive={onDive} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onDive).toHaveBeenCalledTimes(1)

    rerender(<RobotFox behavior="static" onDive={onDive} interactive={false} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onDive).toHaveBeenCalledTimes(1)
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotFox
        behavior={"skulk" as FoxBehavior}
        pitch={Number.NaN}
        arch={Number.NaN}
        crouch={Number.NaN}
        tail={Number.NaN}
        counterweight={Number.NaN}
        ears={Number.NaN}
        bearing={Number.NaN}
        range={Number.NaN}
        gaze={Number.NaN}
        phase={Number.NaN}
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    expect(container.querySelectorAll("[data-ear]")).toHaveLength(2)
  })

  it("keeps the blueprint's own annotations finite, in every view", () => {
    // The reach circle and the sight line are drawn only here, so the neutral
    // pose above never exercises them.
    for (const view of ["plan", "front", "profile", "iso"] as const) {
      const { container, unmount } = render(
        <RobotFox
          view={view}
          variant="blueprint"
          behavior="static"
          pitch={Number.NaN}
          bearing={Number.NaN}
          range={Number.NaN}
          interactive={false}
        />,
      )
      expect(container.innerHTML, view).not.toMatch(/NaN|Infinity/)
      expect(container.querySelector("[data-bearing]"), view).not.toBeNull()
      unmount()
    }
  })
})
