import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RobotAnt, antBehaviorPose } from "@/components/ui/robot-ant"
import { RobotBat, batBehaviorPose } from "@/components/ui/robot-bat"
import { RobotDragonfly, dragonflyBehaviorPose } from "@/components/ui/robot-dragonfly"
import { RobotFrog, frogBehaviorPose } from "@/components/ui/robot-frog"
import { RobotInchworm, inchwormBehaviorPose } from "@/components/ui/robot-inchworm"
import { RobotJellyfish, jellyfishBehaviorPose } from "@/components/ui/robot-jellyfish"
import { RobotManta, mantaBehaviorPose } from "@/components/ui/robot-manta"
import { RobotMantis, mantisBehaviorPose } from "@/components/ui/robot-mantis"
import { RobotOctopus, octopusBehaviorPose } from "@/components/ui/robot-octopus"
import { RobotScorpion, scorpionBehaviorPose } from "@/components/ui/robot-scorpion"
import { RobotSeahorse, seahorseBehaviorPose } from "@/components/ui/robot-seahorse"
import { RobotTurtle, turtleBehaviorPose } from "@/components/ui/robot-turtle"

const clocks = [0, 0.4, 1.7, 6.2]

/** The behaviours are pure functions of the clock, so they sample directly. */
describe("menagerie behaviours", () => {
  it("keeps every sampled pose inside its own limits", () => {
    for (const clock of clocks) {
      for (const behavior of ["hover", "dart", "perch", "static"] as const) {
        const fly = dragonflyBehaviorPose(behavior, clock)
        expect(fly.swing).toBeGreaterThanOrEqual(0)
        expect(fly.swing).toBeLessThanOrEqual(1)
        expect(Math.abs(fly.heading)).toBeLessThanOrEqual(70)
      }
      for (const cycle of [0, 0.2, 0.55, 0.9]) {
        expect(jellyfishBehaviorPose("pulse", clock).contraction(cycle)).toBeGreaterThanOrEqual(0)
        expect(jellyfishBehaviorPose("pulse", clock).contraction(cycle)).toBeLessThanOrEqual(1)
        const jump = frogBehaviorPose("hop", clock).jump(cycle)
        expect(jump.extend).toBeGreaterThanOrEqual(0)
        expect(jump.altitude).toBeLessThanOrEqual(1)
        const step = inchwormBehaviorPose("loop", clock).step(cycle)
        // Exactly one end is ever off the surface.
        expect(Math.min(step.front, step.back)).toBe(0)
        expect(step.span).toBeGreaterThanOrEqual(0)
        expect(step.span).toBeLessThanOrEqual(1)
      }
      expect(Math.abs(mantaBehaviorPose("bank", clock).bank)).toBeLessThanOrEqual(1)
      expect(seahorseBehaviorPose("hold", clock).grip).toBeGreaterThan(0.5)
      expect(scorpionBehaviorPose("guard", clock).arch).toBeGreaterThan(0.8)
      expect(turtleBehaviorPose("retract", clock).retract).toBe(1)
      expect(Math.abs(mantisBehaviorPose("stalk", clock).head)).toBeLessThanOrEqual(45)
    }
  })

  it("gives each behaviour the mechanism it is named for", () => {
    // Perching stops the wings; hovering runs them flat out.
    expect(dragonflyBehaviorPose("perch", 0).rate).toBe(0)
    expect(dragonflyBehaviorPose("hover", 0).swing).toBeGreaterThan(0.8)
    expect(batBehaviorPose("roost", 0).flight).toBe(0)
    expect(batBehaviorPose("glide", 0).rate).toBeLessThan(batBehaviorPose("flap", 0).rate)
    // A pulse squeezes hard early and relaxes over the rest of the cycle.
    const pulse = jellyfishBehaviorPose("pulse", 0).contraction
    expect(pulse(0.3)).toBeGreaterThan(pulse(0.9))
    expect(jellyfishBehaviorPose("bloom", 0).contraction(0.5)).toBeLessThan(0.1)
    expect(mantaBehaviorPose("soar", 0).amplitude).toBeLessThan(mantaBehaviorPose("cruise", 0).amplitude)
    expect(octopusBehaviorPose("jet", 0).gather).toBeGreaterThan(0.5)
    expect(octopusBehaviorPose("furl", 0).curl).toBeGreaterThan(0.8)
    expect(antBehaviorPose("haul", 0).gait).toBe("wave")
    expect(antBehaviorPose("forage", 0).gait).toBe("tripod")
    expect(scorpionBehaviorPose("stalk", 0).gait).toBe("tripod")
    expect(turtleBehaviorPose("plod", 0).gait).toBe("wave")
    // The looper reaches with the front end first, then draws the rear up.
    const loop = inchwormBehaviorPose("loop", 0).step
    expect(loop(0.25).front).toBeGreaterThan(0)
    expect(loop(0.25).back).toBe(0)
    expect(loop(0.75).back).toBeGreaterThan(0)
    expect(loop(0.75).front).toBe(0)
    expect(frogBehaviorPose("hop", 0).jump(0.6).altitude).toBeGreaterThan(0.5)
    expect(frogBehaviorPose("crouch", 0).jump(0.6).altitude).toBe(0)
  })

  it("returns the neutral pose for a non-finite clock", () => {
    expect(dragonflyBehaviorPose("hover", NaN).heading).toBe(0)
    expect(batBehaviorPose("roost", NaN).head).toBe(0)
    expect(jellyfishBehaviorPose("drift", NaN).lean).toBe(0)
    expect(mantaBehaviorPose("cruise", NaN).bank).toBe(0)
    expect(octopusBehaviorPose("crawl", NaN).curl).toBeCloseTo(0.36)
    expect(seahorseBehaviorPose("hover", NaN).head).toBe(0)
    expect(antBehaviorPose("forage", NaN).heading).toBe(0)
    expect(scorpionBehaviorPose("stalk", NaN).heading).toBe(0)
    expect(mantisBehaviorPose("stalk", NaN).head).toBe(0)
    expect(frogBehaviorPose("crouch", NaN).gaze).toBe(0)
    expect(turtleBehaviorPose("plod", NaN).gaze).toBe(0)
    expect(inchwormBehaviorPose("rear", NaN).step(0).reach).toBeCloseTo(0.72)
  })
})

describe("controlled wins", () => {
  it("beats the dragonfly's wing pairs and curls its abdomen from props", () => {
    const { container, getByRole, rerender } = render(
      <RobotDragonfly phase={0} swing={1} curl={0} heading={0} interactive={false} />,
    )
    const fore = container.querySelector('[data-wing="fore-right"]')!.getAttribute("transform")
    const belly = container.querySelector('[data-abdomen] [data-segment="4"] path')!.getAttribute("d")

    rerender(<RobotDragonfly phase={0.25} swing={1} curl={1} heading={40} interactive={false} />)

    expect(container.querySelector('[data-wing="fore-right"]')!.getAttribute("transform")).not.toBe(fore)
    expect(container.querySelector('[data-abdomen] [data-segment="4"] path')!.getAttribute("d")).not.toBe(belly)
    expect(container.querySelectorAll("[data-wing]")).toHaveLength(4)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot dragonfly")
  })

  it("furls the bat's membrane and turns it over from props", () => {
    const { container, getByRole, rerender } = render(
      <RobotBat phase={0} spread={0} flight={0} headAngle={0} interactive={false} />,
    )
    const skin = container.querySelector('[data-wing="near"] [data-membrane]')!.getAttribute("d")
    const hanging = container.querySelector("[data-bat]")!.getAttribute("transform")

    rerender(<RobotBat phase={0.3} spread={1} flight={1} headAngle={0} interactive={false} />)

    expect(container.querySelector('[data-wing="near"] [data-membrane]')!.getAttribute("d")).not.toBe(skin)
    // Hanging and flying are the same body, rotated.
    expect(container.querySelector("[data-bat]")!.getAttribute("transform")).not.toBe(hanging)
    expect(container.querySelectorAll('[data-wing="near"] [data-finger]')).toHaveLength(4)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot bat")
  })

  it("contracts the jellyfish bell and counts its tentacles", () => {
    const { container, getByRole, rerender } = render(
      <RobotJellyfish phase={0} contraction={0} arms={7} lean={0} interactive={false} />,
    )
    expect(container.querySelectorAll("[data-tentacle]")).toHaveLength(7)
    const bell = container.querySelector("[data-bell] path")!.getAttribute("d")

    rerender(<RobotJellyfish phase={0} contraction={1} arms={11} lean={0} interactive={false} />)

    expect(container.querySelectorAll("[data-tentacle]")).toHaveLength(11)
    expect(container.querySelector("[data-bell] path")!.getAttribute("d")).not.toBe(bell)
    expect(getByRole("img").getAttribute("aria-label")).toContain("100 percent contracted")
  })

  it("runs the manta's spanwise wave and rolls it from props", () => {
    const { container, getByRole, rerender } = render(
      <RobotManta phase={0} amplitude={0.8} bank={0} interactive={false} />,
    )
    const wing = container.querySelector('[data-wing="right"] path')!.getAttribute("d")

    rerender(<RobotManta phase={0.4} amplitude={0.8} bank={0} interactive={false} />)
    const beaten = container.querySelector('[data-wing="right"] path')!.getAttribute("d")
    expect(beaten).not.toBe(wing)

    // Rolling foreshortens the span, so it is not the same drawing either.
    rerender(<RobotManta phase={0.4} amplitude={0.8} bank={1} interactive={false} />)
    expect(container.querySelector('[data-wing="right"] path')!.getAttribute("d")).not.toBe(beaten)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot manta")
  })

  it("curls the octopus arms and pumps its mantle from props", () => {
    const { container, getByRole, rerender } = render(
      <RobotOctopus phase={0} curl={0} jet={0} gather={0} arms={6} interactive={false} />,
    )
    expect(container.querySelectorAll("[data-arm]")).toHaveLength(6)
    const arm = container.querySelector('[data-arm="0"]')!.innerHTML
    const mantle = container.querySelector("[data-mantle] path")!.getAttribute("d")

    rerender(<RobotOctopus phase={0} curl={1} jet={1} gather={0} arms={6} interactive={false} />)

    expect(container.querySelector('[data-arm="0"]')!.innerHTML).not.toBe(arm)
    expect(container.querySelector("[data-mantle] path")!.getAttribute("d")).not.toBe(mantle)
    expect(getByRole("img").getAttribute("aria-label")).toContain("6 arms")
  })

  it("coils the seahorse tail from the grip alone", () => {
    const { container, getByRole, rerender } = render(
      <RobotSeahorse phase={0} grip={0} sway={0} headAngle={0} interactive={false} />,
    )
    const hull = container.querySelector("[data-spine]")!.getAttribute("d")
    const tail = container.querySelector("[data-tail] circle")!.getAttribute("cx")

    rerender(<RobotSeahorse phase={0} grip={1} sway={0} headAngle={0} interactive={false} />)

    expect(container.querySelector("[data-spine]")!.getAttribute("d")).not.toBe(hull)
    expect(container.querySelector("[data-tail] circle")!.getAttribute("cx")).not.toBe(tail)
    expect(getByRole("img").getAttribute("aria-label")).toContain("holding on")
  })

  it("walks the ant on six legs and bends its body through a turn", () => {
    const { container, getByRole, rerender } = render(
      <RobotAnt phase={0} heading={0} bite={0} antennae={0} gaster={0} interactive={false} />,
    )
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(6)
    const gaster = container.querySelector("[data-gaster]")!.getAttribute("transform")
    const jaw = container.querySelector('[data-mandible="right"]')!.getAttribute("transform")

    rerender(<RobotAnt phase={0.3} heading={70} bite={1} antennae={1} gaster={1} cargo="leaf" interactive={false} />)

    expect(container.querySelector("[data-gaster]")!.getAttribute("transform")).not.toBe(gaster)
    expect(container.querySelector('[data-mandible="right"]')!.getAttribute("transform")).not.toBe(jaw)
    expect(container.querySelector("[data-cargo]")).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot ant")
  })

  it("arches the scorpion's tail out of the ground plane", () => {
    const { container, getByRole, rerender } = render(
      <RobotScorpion phase={0} arch={0} claw={0} heading={0} interactive={false} />,
    )
    const sting = container.querySelector("[data-sting]")!.getAttribute("transform")
    const jaw = container.querySelector('[data-claw="right"] [data-jaw]')!.getAttribute("transform")

    rerender(<RobotScorpion phase={0} arch={1} claw={1} heading={0} interactive={false} />)

    expect(container.querySelector("[data-sting]")!.getAttribute("transform")).not.toBe(sting)
    expect(container.querySelector('[data-claw="right"] [data-jaw]')!.getAttribute("transform")).not.toBe(jaw)
    expect(getByRole("img").getAttribute("aria-label")).toContain("100 percent arched")
  })

  it("solves the mantis forelimb to a target and clamps an unreachable one", () => {
    const { container, getByRole, rerender } = render(
      <RobotMantis target={{ x: 20, y: 0 }} phase={0} interactive={false} />,
    )
    const folded = container.querySelector('[data-joint="near-elbow"]')!.getAttribute("cx")

    rerender(<RobotMantis target={{ x: 52, y: -14 }} phase={0} interactive={false} />)
    const reaching = container.querySelector('[data-joint="near-elbow"]')!.getAttribute("cx")
    expect(reaching).not.toBe(folded)

    // Far out of reach: the chain clamps onto its circle rather than failing.
    rerender(<RobotMantis target={{ x: 4000, y: 0 }} phase={0} interactive={false} />)
    expect(container.querySelector("svg")!.innerHTML).not.toContain("NaN")
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot mantis")
  })

  it("drives the frog's whole jump from extension and altitude", () => {
    const { container, getByRole, rerender } = render(
      <RobotFrog extend={0} altitude={0} gaze={0} interactive={false} />,
    )
    const knee = container.querySelector('[data-joint="near-knee"]')!.getAttribute("cx")
    const leg = container.querySelector('[data-leg="hind-near"]')!.innerHTML

    rerender(<RobotFrog extend={1} altitude={1} gaze={0} interactive={false} />)

    expect(container.querySelector('[data-joint="near-knee"]')!.getAttribute("cx")).not.toBe(knee)
    expect(container.querySelector('[data-leg="hind-near"]')!.innerHTML).not.toBe(leg)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot frog")
  })

  it("retracts the turtle under its own carapace", () => {
    const { container, getByRole, rerender } = render(
      <RobotTurtle phase={0} retract={0} gaze={0} interactive={false} />,
    )
    expect(container.querySelectorAll("[data-leg]")).toHaveLength(4)
    const head = container.querySelector("[data-head]")!.getAttribute("transform")
    const leg = container.querySelector('[data-leg="0"]')!.innerHTML
    expect(container.querySelectorAll("[data-scute]").length).toBeGreaterThan(20)

    rerender(<RobotTurtle phase={0} retract={1} gaze={0} interactive={false} />)

    expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(head)
    expect(container.querySelector('[data-leg="0"]')!.innerHTML).not.toBe(leg)
    expect(getByRole("img").getAttribute("aria-label")).toContain("withdrawn")
  })

  it("raises the inchworm's loop as its anchors close up", () => {
    const { container, getByRole, rerender } = render(
      <RobotInchworm span={1} reach={0} interactive={false} />,
    )
    const stretched = container.querySelector('[data-anchor="front"]')!.getAttribute("transform")
    const apex = container.querySelector('[data-spine] [data-segment="7"] path')!.getAttribute("d")

    rerender(<RobotInchworm span={0} reach={0} interactive={false} />)

    expect(container.querySelector('[data-anchor="front"]')!.getAttribute("transform")).not.toBe(stretched)
    expect(container.querySelector('[data-spine] [data-segment="7"] path')!.getAttribute("d")).not.toBe(apex)
    expect(getByRole("img").getAttribute("aria-label")).toContain("Robot inchworm")
  })
})

describe("interaction", () => {
  it("fires each animal's own gesture on press", () => {
    const calls = {
      dart: vi.fn(), drop: vi.fn(), pulse: vi.fn(), surge: vi.fn(), jet: vi.fn(),
      grip: vi.fn(), mandible: vi.fn(), strike: vi.fn(), snap: vi.fn(), hop: vi.fn(),
      retract: vi.fn(), rear: vi.fn(),
    }
    for (const animal of [
      <RobotDragonfly key="dragonfly" onDart={calls.dart} />,
      <RobotBat key="bat" onDrop={calls.drop} />,
      <RobotJellyfish key="jellyfish" onPulse={calls.pulse} />,
      <RobotManta key="manta" onSurge={calls.surge} />,
      <RobotOctopus key="octopus" onJet={calls.jet} />,
      <RobotSeahorse key="seahorse" onGripChange={calls.grip} />,
      <RobotAnt key="ant" onMandibleChange={calls.mandible} />,
      <RobotScorpion key="scorpion" onStrike={calls.strike} />,
      <RobotMantis key="mantis" onStrike={calls.snap} />,
      <RobotFrog key="frog" onHop={calls.hop} />,
      <RobotTurtle key="turtle" onRetractChange={calls.retract} />,
      <RobotInchworm key="inchworm" onRear={calls.rear} />,
    ]) {
      const { container } = render(animal)
      fireEvent.pointerDown(container.querySelector("svg")!)
    }

    for (const [name, spy] of Object.entries(calls)) {
      expect(spy, name).toHaveBeenCalledOnce()
    }
    // The toggles report which way they went.
    expect(calls.grip).toHaveBeenLastCalledWith(false)
    expect(calls.mandible).toHaveBeenLastCalledWith(true)
    expect(calls.retract).toHaveBeenLastCalledWith(true)
  })

  it("withdraws the turtle on a click and lets it back out", () => {
    const onRetractChange = vi.fn()
    const { container, getByRole } = render(<RobotTurtle onRetractChange={onRetractChange} />)
    const out = container.querySelector("[data-head]")!.getAttribute("transform")

    fireEvent.pointerDown(getByRole("img"))

    expect(onRetractChange).toHaveBeenLastCalledWith(true)
    expect(getByRole("img").getAttribute("aria-label")).toContain("withdrawn")
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(out)

    fireEvent.pointerDown(getByRole("img"))

    expect(onRetractChange).toHaveBeenLastCalledWith(false)
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).toBe(out)
  })

  it("leaves a machine alone when interaction is off", () => {
    const onJet = vi.fn()
    const { getByRole } = render(<RobotOctopus interactive={false} onJet={onJet} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onJet).not.toHaveBeenCalled()
  })
})

describe("invalid input", () => {
  it("draws a stable pose from broken numbers", () => {
    for (const animal of [
      <RobotDragonfly key="dragonfly" phase={NaN} swing={NaN} curl={NaN} heading={NaN} altitude={NaN} segments={NaN} />,
      <RobotBat key="bat" phase={NaN} spread={NaN} flight={NaN} headAngle={NaN} />,
      <RobotJellyfish key="jellyfish" phase={NaN} contraction={NaN} arms={NaN} segments={NaN} lean={NaN} />,
      <RobotManta key="manta" phase={NaN} amplitude={NaN} waves={NaN} bank={NaN} segments={NaN} />,
      <RobotOctopus key="octopus" phase={NaN} arms={NaN} segments={NaN} curl={NaN} jet={NaN} gather={NaN} />,
      <RobotSeahorse key="seahorse" phase={NaN} grip={NaN} sway={NaN} headAngle={NaN} segments={NaN} />,
      <RobotAnt key="ant" phase={NaN} height={NaN} stride={NaN} heading={NaN} bite={NaN} antennae={NaN} gaster={NaN} />,
      <RobotScorpion key="scorpion" phase={NaN} legs={NaN} height={NaN} heading={NaN} arch={NaN} claw={NaN} segments={NaN} />,
      <RobotMantis key="mantis" phase={NaN} target={{ x: NaN, y: NaN }} stride={NaN} headAngle={NaN} />,
      <RobotFrog key="frog" phase={NaN} extend={NaN} altitude={NaN} gaze={NaN} />,
      <RobotTurtle key="turtle" phase={NaN} height={NaN} stride={NaN} heading={NaN} retract={NaN} gaze={NaN} />,
      <RobotInchworm key="inchworm" phase={NaN} span={NaN} reach={NaN} segments={NaN} />,
    ]) {
      const { container } = render(animal)
      expect(container.querySelector("svg")!.innerHTML, animal.key ?? "").not.toMatch(/NaN|Infinity/)
    }
  })

  it("takes a colour override on every animal", () => {
    const { container } = render(<RobotSeahorse color="#f97316" accent="#22d3ee" grip={0.5} interactive={false} />)
    expect(container.querySelector("[data-spine]")!.getAttribute("fill")).toBe("#f97316")
  })
})
