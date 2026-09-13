import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RobotDog, dogBark, dogBehaviorPose, type DogBehavior } from "@/components/ui/robot-dog"

const behaviors: DogBehavior[] = ["trot", "sniff", "sit", "alert", "static"]

describe("dog behaviours", () => {
  it("keeps every sampled stance inside its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 6.2]) {
      for (const behavior of behaviors) {
        const pose = dogBehaviorPose(behavior, clock)
        expect(Math.abs(pose.gaze)).toBeLessThanOrEqual(1)
        expect(Math.abs(pose.ears)).toBeLessThanOrEqual(1)
        expect(pose.wag).toBeGreaterThanOrEqual(0)
        expect(pose.wag).toBeLessThanOrEqual(1)
        expect(pose.jaw).toBeGreaterThanOrEqual(0)
        expect(pose.jaw).toBeLessThanOrEqual(1)
        for (const cycle of [0, 0.2, 0.37, 0.5, 0.8, 0.99]) {
          const stance = pose.stance(cycle)
          expect(Math.abs(stance.arch), `${behavior} arch`).toBeLessThanOrEqual(1)
          expect(stance.crouch, `${behavior} crouch`).toBeGreaterThanOrEqual(0)
          expect(stance.crouch, `${behavior} crouch`).toBeLessThanOrEqual(1)
          expect(Math.abs(stance.tail), `${behavior} tail`).toBeLessThanOrEqual(1)
          expect(stance.nose, `${behavior} nose`).toBeGreaterThanOrEqual(0)
          expect(stance.nose, `${behavior} nose`).toBeLessThanOrEqual(1)
          expect(stance.altitude, `${behavior} altitude`).toBeGreaterThanOrEqual(0)
          expect(stance.altitude, `${behavior} altitude`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // The trot is the only gait with a suspension bob, and it is the fast one.
    const trot = dogBehaviorPose("trot", 0)
    expect(trot.rate).toBe(1)
    expect(Math.max(...[0, 0.12, 0.25, 0.37, 0.5].map((t) => trot.stance(t).altitude))).toBeGreaterThan(0)

    // Sniffing puts the nose on the floor and walks slower than a trot.
    expect(dogBehaviorPose("sniff", 0).stance(0).nose).toBeGreaterThan(0.8)
    expect(dogBehaviorPose("sniff", 0).rate).toBeLessThan(trot.rate)

    // Sitting folds the croup down and plants the feet, and the tail keeps going.
    expect(dogBehaviorPose("sit", 0).rate).toBe(0)
    expect(dogBehaviorPose("sit", 0).stance(0).haunch).toBe(1)
    expect(dogBehaviorPose("sit", 0).wag).toBeGreaterThan(0.5)

    // The point: a forefoot up, ears full forward, tail out.
    expect(dogBehaviorPose("alert", 0).stance(0).point).toBeGreaterThan(0.5)
    expect(dogBehaviorPose("alert", 0).ears).toBeGreaterThan(0.8)

    expect(dogBehaviorPose("static", 0).stance(0).altitude).toBe(0)
    expect(dogBehaviorPose("static", 0).wag).toBe(0)
  })

  it("keeps the bark inside its limits, and neutral for a non-finite clock", () => {
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      const bark = dogBark(t)
      expect(bark.jaw).toBeGreaterThanOrEqual(0)
      expect(bark.jaw).toBeLessThanOrEqual(1)
      expect(bark.lift).toBeGreaterThanOrEqual(0)
      expect(bark.lift).toBeLessThanOrEqual(1)
    }
    expect(dogBark(Number.NaN)).toEqual(dogBark(0))
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(dogBehaviorPose("trot", Number.NaN).gaze).toBe(0)
    expect(dogBehaviorPose("sniff", Number.NaN).gaze).toBe(0)
    expect(dogBehaviorPose("sit", Number.NaN).stance(0).tail).toBe(dogBehaviorPose("sit", 0).stance(0).tail)
  })
})

describe("robot dog", () => {
  it("swings the scapula with the stride, and the foreleg answers for it", () => {
    const { container, rerender } = render(
      <RobotDog behavior="trot" phase={0} interactive={false} />,
    )
    const scapula = container.querySelector('[data-scapula="left"]')!.getAttribute("d")
    const fore = container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")

    rerender(<RobotDog behavior="trot" phase={0.4} interactive={false} />)

    expect(container.querySelector('[data-scapula="left"]')!.getAttribute("d")).not.toBe(scapula)
    expect(container.querySelector('[data-leg="fore-left"] path')!.getAttribute("d")).not.toBe(fore)
  })

  it("arches the back and moves the hip with it, without touching the scapula pivot's stride", () => {
    const { container, rerender } = render(
      <RobotDog behavior="static" arch={0} crouch={0.3} interactive={false} />,
    )
    const spine = container.querySelector("[data-spine]")!.getAttribute("d")
    const hind = container.querySelector('[data-leg="hind-left"] path')!.getAttribute("d")

    rerender(<RobotDog behavior="static" arch={0.9} crouch={0.3} interactive={false} />)

    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(spine)
    expect(container.querySelector('[data-leg="hind-left"] path')!.getAttribute("d")).not.toBe(hind)
  })

  it("solves the neck to put the nose on the floor", () => {
    const { container, rerender } = render(
      <RobotDog behavior="static" nose={0} interactive={false} />,
    )
    const neck = container.querySelector("[data-neck]")!.getAttribute("d")
    const head = container.querySelector("[data-head]")!.getAttribute("transform")

    rerender(<RobotDog behavior="static" nose={1} interactive={false} />)

    expect(container.querySelector("[data-neck]")!.getAttribute("d")).not.toBe(neck)
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(head)
  })

  it("wags the tail across the centre plane, and carries it on its own axis", () => {
    const { container, rerender } = render(
      <RobotDog behavior="static" wag={-1} tail={0.5} interactive={false} />,
    )
    const swung = container.querySelector("[data-tail]")!.innerHTML

    rerender(<RobotDog behavior="static" wag={1} tail={0.5} interactive={false} />)
    const other = container.querySelector("[data-tail]")!.innerHTML
    expect(other).not.toBe(swung)

    rerender(<RobotDog behavior="static" wag={1} tail={-1} interactive={false} />)
    expect(container.querySelector("[data-tail]")!.innerHTML).not.toBe(other)
  })

  it("takes the ears and the gaze, and says what it is doing", () => {
    const { container, getByRole, rerender } = render(
      <RobotDog behavior="static" ears={1} gaze={0} interactive={false} />,
    )
    const ear = container.querySelector('[data-ear="left"]')!.getAttribute("transform")
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/Robot dog, still, side elevation/)

    rerender(<RobotDog behavior="static" ears={-1} gaze={0} interactive={false} />)
    expect(container.querySelector('[data-ear="left"]')!.getAttribute("transform")).not.toBe(ear)

    rerender(<RobotDog behavior="sniff" interactive={false} />)
    expect(getByRole("img").getAttribute("aria-label")).toMatch(/sniffing/)
  })

  it("barks on a click only while it is interactive", () => {
    const onBark = vi.fn()
    const { getByRole, rerender } = render(<RobotDog behavior="static" onBark={onBark} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onBark).toHaveBeenCalledTimes(1)

    rerender(<RobotDog behavior="static" onBark={onBark} interactive={false} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onBark).toHaveBeenCalledTimes(1)
  })

  it("renders a stable neutral pose for invalid input", () => {
    const { container } = render(
      <RobotDog
        behavior={"lope" as DogBehavior}
        arch={Number.NaN}
        crouch={Number.NaN}
        tail={Number.NaN}
        wag={Number.NaN}
        nose={Number.NaN}
        ears={Number.NaN}
        gaze={Number.NaN}
        phase={Number.NaN}
        interactive={false}
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
  })
})
