import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RobotBird, birdBehaviorPose } from "@/components/ui/robot-bird"
import { RobotCrab, crabBehaviorPose } from "@/components/ui/robot-crab"
import { RobotFish, fishBehaviorPose } from "@/components/ui/robot-fish"
import { RobotSnake, snakeBehaviorPose } from "@/components/ui/robot-snake"
import { RobotSpider, spiderBehaviorPose } from "@/components/ui/robot-spider"

/** The behaviours are pure functions of the clock, so they sample directly. */
describe("animal behaviours", () => {
  it("keeps every sampled pose inside its own limits", () => {
    for (const clock of [0, 0.4, 1.7, 6.2]) {
      for (const behavior of ["cruise", "dart", "hover", "static"] as const) {
        const fish = fishBehaviorPose(behavior, clock)
        expect(fish.amplitude).toBeGreaterThanOrEqual(0)
        expect(fish.amplitude).toBeLessThanOrEqual(1)
        expect(Math.abs(fish.fin)).toBeLessThanOrEqual(45)
      }
      const coil = snakeBehaviorPose("coil", clock)
      expect(Math.abs(coil.turn)).toBeLessThanOrEqual(1)
      expect(snakeBehaviorPose("sidewind", clock).lift).toBe(1)

      const crab = crabBehaviorPose("scuttle", clock)
      expect(crab.claw).toBeGreaterThanOrEqual(0)
      expect(crab.claw).toBeLessThanOrEqual(1)
      expect([90, 270]).toContain(crab.heading)

      const bird = birdBehaviorPose("perch", clock)
      expect(bird.spread).toBeLessThanOrEqual(0.2)
      expect(Math.abs(bird.head)).toBeLessThanOrEqual(40)
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // Darting is burst and glide: the swing is not constant across the cycle.
    const swings = [0, 0.5, 1, 1.5, 2].map((clock) => fishBehaviorPose("dart", clock).amplitude)
    expect(Math.max(...swings) - Math.min(...swings)).toBeGreaterThan(0.3)
    expect(fishBehaviorPose("hover", 0).amplitude).toBeLessThan(fishBehaviorPose("cruise", 0).amplitude)

    expect(spiderBehaviorPose("walk", 0).gait).toBe("tripod")
    expect(spiderBehaviorPose("skitter", 0).gait).toBe("ripple")
    expect(spiderBehaviorPose("skitter", 0).rate).toBeGreaterThan(spiderBehaviorPose("walk", 0).rate)
    expect(spiderBehaviorPose("idle", 0).rate).toBe(0)
    expect(crabBehaviorPose("idle", 0).gait).toBe("stand")
    expect(birdBehaviorPose("glide", 0).rate).toBeLessThan(birdBehaviorPose("flap", 0).rate)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(fishBehaviorPose("cruise", NaN).fin).toBe(0)
    expect(spiderBehaviorPose("walk", NaN).facing).toBe(0)
    expect(crabBehaviorPose("scuttle", NaN).eyes).toBe(0)
    expect(birdBehaviorPose("perch", NaN).head).toBe(0)
  })
})

describe("controlled wins", () => {
  it("beats the fish's tail and turns its body from props alone", () => {
    const { container, getByRole, rerender } = render(
      <RobotFish phase={0} turn={0} amplitude={0.8} interactive={false} />,
    )
    const tail = container.querySelector("[data-tail]")!.getAttribute("transform")
    const hull = container.querySelector("[data-spine]")!.getAttribute("d")

    rerender(<RobotFish phase={0.35} turn={0.9} amplitude={0.8} interactive={false} />)

    expect(container.querySelector("[data-tail]")!.getAttribute("transform")).not.toBe(tail)
    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(hull)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot fish")
  })

  it("runs the snake's wave and lifts it clear when it sidewinds", () => {
    const { container, rerender } = render(
      <RobotSnake phase={0} lift={0} showContacts interactive={false} />,
    )
    const body = container.querySelector("[data-spine]")!.getAttribute("d")
    expect(container.querySelector("[data-shadow]")).toBeNull()
    expect(container.querySelectorAll("[data-contacts] circle").length).toBeGreaterThan(0)

    rerender(<RobotSnake phase={0.3} lift={1} showContacts interactive={false} />)

    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(body)
    expect(container.querySelector("[data-shadow]")).not.toBeNull()
  })

  it("walks the spider on a controlled phase and counts its legs", () => {
    const { container, getByRole, rerender } = render(
      <RobotSpider phase={0} gait="tripod" heading={0} interactive={false} />,
    )
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(8)
    const leg = container.querySelector('[data-leg="0"]')!.innerHTML

    rerender(<RobotSpider phase={0.4} gait="tripod" heading={0} legs={6} interactive={false} />)

    expect(container.querySelectorAll("[data-leg]")).toHaveLength(6)
    expect(container.querySelector('[data-leg="0"]')!.innerHTML).not.toBe(leg)
    expect(getByRole("img").getAttribute("aria-label")).toContain("tripod")
  })

  it("opens the crab's claws and aims its eyestalks from props", () => {
    const { container, rerender } = render(
      <RobotCrab phase={0} claw={0} eyes={-1} interactive={false} />,
    )
    const jaw = container.querySelector('[data-claw="right"] [data-jaw]')!.getAttribute("transform")
    const eyes = container.querySelector("[data-eyes] g")!.getAttribute("transform")

    rerender(<RobotCrab phase={0} claw={1} eyes={1} interactive={false} />)

    expect(container.querySelector('[data-claw="right"] [data-jaw]')!.getAttribute("transform")).not.toBe(jaw)
    expect(container.querySelector("[data-eyes] g")!.getAttribute("transform")).not.toBe(eyes)
  })

  it("spreads the bird's wings and fans its tail from props", () => {
    const { container, getByRole, rerender } = render(
      <RobotBird phase={0} spread={0} tail={0} headAngle={0} interactive={false} />,
    )
    const wing = container.querySelector('[data-wing="near"]')!.getAttribute("transform")
    const feathers = container.querySelector('[data-wing="near"] [data-feather="4"]')!.getAttribute("transform")

    rerender(<RobotBird phase={0.25} spread={1} tail={1} headAngle={30} interactive={false} />)

    expect(container.querySelector('[data-wing="near"]')!.getAttribute("transform")).not.toBe(wing)
    expect(container.querySelector('[data-wing="near"] [data-feather="4"]')!.getAttribute("transform")).not.toBe(feathers)
    expect(container.querySelectorAll('[data-wing="near"] [data-feather]')).toHaveLength(5)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot bird")
  })
})

describe("interaction", () => {
  it("reports a dart, a strike, a snap and a takeoff on press", () => {
    const onDart = vi.fn()
    const onStrike = vi.fn()
    const onSnap = vi.fn()
    const onTakeoff = vi.fn()
    for (const animal of [
      <RobotFish key="fish" onDart={onDart} />,
      <RobotSnake key="snake" onStrike={onStrike} />,
      <RobotCrab key="crab" onSnap={onSnap} />,
      <RobotBird key="bird" onTakeoff={onTakeoff} />,
    ]) {
      const { container } = render(animal)
      fireEvent.pointerDown(container.querySelector("svg")!)
    }

    expect(onDart).toHaveBeenCalledOnce()
    expect(onStrike).toHaveBeenCalledOnce()
    expect(onSnap).toHaveBeenCalledOnce()
    expect(onTakeoff).toHaveBeenCalledOnce()
  })

  it("crouches the spider on a click and stands it back up", () => {
    const onCrouchChange = vi.fn()
    const { container, getByRole } = render(<RobotSpider onCrouchChange={onCrouchChange} />)
    const standing = container.querySelector("[data-body]")!.getAttribute("transform")

    fireEvent.pointerDown(getByRole("img"))

    expect(onCrouchChange).toHaveBeenLastCalledWith(true)
    expect(getByRole("img").getAttribute("aria-label")).toContain("crouched")
    expect(container.querySelector("[data-body]")!.getAttribute("transform")).not.toBe(standing)

    fireEvent.pointerDown(getByRole("img"))

    expect(onCrouchChange).toHaveBeenLastCalledWith(false)
    expect(container.querySelector("[data-body]")!.getAttribute("transform")).toBe(standing)
  })

  it("leaves a machine alone when interaction is off", () => {
    const onDart = vi.fn()
    const { getByRole } = render(<RobotFish interactive={false} onDart={onDart} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onDart).not.toHaveBeenCalled()
  })
})

describe("invalid input", () => {
  it("draws a stable pose from broken numbers", () => {
    for (const animal of [
      <RobotFish key="fish" phase={NaN} amplitude={NaN} waves={NaN} turn={NaN} segments={NaN} />,
      <RobotSnake key="snake" phase={NaN} amplitude={NaN} lift={NaN} segments={NaN} />,
      <RobotSpider key="spider" phase={NaN} height={NaN} stride={NaN} legs={NaN} heading={NaN} />,
      <RobotCrab key="crab" phase={NaN} claw={NaN} eyes={NaN} heading={NaN} />,
      <RobotBird key="bird" phase={NaN} spread={NaN} tail={NaN} headAngle={NaN} />,
    ]) {
      const { container } = render(animal)
      expect(container.querySelector("svg")!.innerHTML).not.toContain("NaN")
    }
  })
})
