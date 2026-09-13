import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { courierDroidPose } from "@/components/ui/courier-droid"
import { InfantryDroid, infantryDroidPose } from "@/components/ui/infantry-droid"
import { MedicalDroid, medicalDroidPose } from "@/components/ui/medical-droid"
import { ProbeDroid, probeDroidPose } from "@/components/ui/probe-droid"
import { ProtocolDroid, protocolDroidPose } from "@/components/ui/protocol-droid"
import { OrbDroid, orbDroidPose } from "@/components/ui/orb-droid"
import { SecurityDroid, securityDroidPose } from "@/components/ui/security-droid"
import { UtilityDroid, utilityDroidPose } from "@/components/ui/utility-droid"

/** Each droid's routine is a pure function of the clock, so it samples directly. */
describe("droid behaviours", () => {
  it("works the utility droid's tool out and stows it again", () => {
    expect(utilityDroidPose("work", 0).tool).toBe(0)
    expect(utilityDroidPose("work", 0.5).tool).toBe(1)
    expect(utilityDroidPose("work", 0.95).tool).toBe(0)
    // The dome turns to the bench for the first half of the job.
    expect(utilityDroidPose("work", 0.2).head).toBeLessThan(0)
    expect(utilityDroidPose("scan", 0.25).head).toBeCloseTo(140, 5)
    expect(utilityDroidPose("static", 3)).toEqual({ head: 0, tool: 0 })
    expect(utilityDroidPose("work", NaN).tool).toBe(0)
  })

  it("bobs the probe droid on hover and holds its height to scan", () => {
    expect(probeDroidPose("hover", 0.25).lift).toBeCloseTo(0.82, 5)
    expect(probeDroidPose("hover", 0.75).lift).toBeCloseTo(0.18, 5)
    expect(probeDroidPose("scan", 0.25).scan).toBeCloseTo(62, 5)
    // Scanning keeps station rather than bobbing while it looks.
    expect(probeDroidPose("scan", 0.25).lift).toBe(probeDroidPose("scan", 0.75).lift)
  })

  it("runs the medical scan to a result and keeps it there", () => {
    expect(medicalDroidPose("diagnose", 0).level).toBe(0)
    expect(medicalDroidPose("diagnose", 0.5).level).toBe(0.5)
    expect(medicalDroidPose("diagnose", 1).level).toBe(1)
    expect(medicalDroidPose("diagnose", 8).level).toBe(1)
    // A restart winds the clock back, so a negative sample is the start again.
    expect(medicalDroidPose("diagnose", -2).level).toBe(0)
    expect(medicalDroidPose("idle", 3).level).toBeLessThan(0.2)
  })

  it("marches the infantry droid and stands it to guard when alert", () => {
    expect(infantryDroidPose("patrol", 0.3).pose).toBe("march")
    expect(infantryDroidPose("alert", 0.3).pose).toBe("guard")
    expect(infantryDroidPose("idle", 0.3).pose).toBe("stand")
    // An alert head snaps about faster than a patrolling one sweeps.
    expect(Math.abs(infantryDroidPose("alert", 0.125).head)).toBeGreaterThan(
      Math.abs(infantryDroidPose("patrol", 0.125).head),
    )
  })

  it("takes the protocol droid through its gestures a beat at a time", () => {
    expect(protocolDroidPose("converse", 0).gesture).toBe("none")
    expect(protocolDroidPose("converse", 1.2).gesture).toBe("greet")
    expect(protocolDroidPose("converse", 2.6).gesture).toBe("explain")
    expect(protocolDroidPose("converse", 3.9).gesture).toBe("point")
    // Four beats later it is back at the start of the conversation.
    expect(protocolDroidPose("converse", 4.2).gesture).toBe("none")
    expect(protocolDroidPose("idle", 9).gesture).toBe("none")
  })

  it("rolls the orb droid's shell without carrying its head round", () => {
    // A full turn of the shell per cycle is the mechanism; the head only sways.
    expect(orbDroidPose("roll", 0).body).toBe(0)
    expect(orbDroidPose("roll", 1).body).toBe(360)
    expect(Math.abs(orbDroidPose("roll", 0.25).head)).toBeLessThan(10)
    // Rocking is the same machine going nowhere, so the shell comes back.
    expect(orbDroidPose("rock", 0).body).toBeCloseTo(0, 5)
    expect(orbDroidPose("rock", 0.25).body).toBeCloseTo(30, 5)
    expect(orbDroidPose("rock", 0.5).body).toBeCloseTo(0, 5)
    // A survey sweeps the optic to both stops and barely turns the ball.
    const sweep = [0, 0.5, 1, 1.5].map((t) => orbDroidPose("survey", t).head)
    expect(Math.max(...sweep)).toBeGreaterThan(50)
    expect(Math.min(...sweep)).toBeLessThan(-50)
    expect(Math.abs(orbDroidPose("survey", 0.5).body)).toBeLessThan(10)
    expect(orbDroidPose("static", 7)).toEqual({ body: 0, head: 0 })
    expect(orbDroidPose("roll", NaN)).toEqual({ body: 0, head: 0 })
  })

  it("walks the security droid's beat and stands it to guard when alert", () => {
    expect(securityDroidPose("patrol", 0.3).pose).toBe("patrol")
    expect(securityDroidPose("alert", 0.3).pose).toBe("guard")
    expect(securityDroidPose("idle", 0.3).pose).toBe("stand")
    // An alert scan turns faster than a patrol sweep of the same length.
    expect(Math.abs(securityDroidPose("alert", 0.125).head)).toBeGreaterThan(
      Math.abs(securityDroidPose("patrol", 0.125).head),
    )
    expect(securityDroidPose("static", 4)).toEqual({ pose: "stand", head: 0 })
  })

  it("drives the courier droid in legs and corners", () => {
    expect(courierDroidPose("deliver", 0, null).heading).toBe(0)
    // Mid-leg it holds its bearing; at the corner it is part-way round.
    expect(courierDroidPose("deliver", 0.5, null).heading).toBe(0)
    expect(courierDroidPose("deliver", 0.9, null).heading).toBeCloseTo(45, 5)
    expect(courierDroidPose("deliver", 1.5, null).heading).toBe(90)
    // Steering is only up while it is actually turning.
    expect(courierDroidPose("deliver", 0.5, null).steer).toBe(0)
    expect(courierDroidPose("deliver", 0.9, null).steer).toBeGreaterThan(0)
    expect(courierDroidPose("pointer", 2, 143).heading).toBe(143)
    expect(courierDroidPose("static", 5, null)).toEqual({ heading: 0, steer: 0, travel: 0 })
  })
})

describe("posing overrides the beat", () => {
  it("lets the orb droid's channels be taken one at a time", () => {
    // Pinning the shell leaves the head on the clock, which is the whole point
    // of two channels: a controlled ball can still look around.
    const { container, rerender } = render(<OrbDroid animate={false} bodyAngle={72} />)
    expect(container.querySelector("[data-body]")?.getAttribute("transform")).toContain("72")
    rerender(<OrbDroid animate={false} bodyAngle={72} headAngle={40} />)
    expect(container.querySelector("[data-head]")?.getAttribute("transform")).toContain(
      String(Math.round(40 * 0.16 * 100) / 100),
    )
  })

  it("keeps the security droid's stance when one is supplied", () => {
    const { getByRole } = render(<SecurityDroid animate={false} pose="stand" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("stand pose")
  })

  it("takes its stance from the behaviour when none is", () => {
    const { getByRole } = render(<SecurityDroid animate={false} behavior="alert" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("guard pose")
  })
})

describe("droid interaction", () => {
  it("puts the infantry droid on guard when it is clicked, and stands it down again", () => {
    const onPoseChange = vi.fn()
    const { getByRole } = render(<InfantryDroid animate={false} onPoseChange={onPoseChange} />)
    const svg = getByRole("img")
    expect(svg.getAttribute("aria-label")).toContain("march")
    fireEvent.pointerDown(svg)
    expect(onPoseChange).toHaveBeenLastCalledWith("guard")
    expect(svg.getAttribute("aria-label")).toContain("guard")
    fireEvent.pointerDown(svg)
    expect(onPoseChange).toHaveBeenLastCalledWith("stand")
  })

  it("moves the protocol droid on a gesture per click", () => {
    const onGestureChange = vi.fn()
    const { getByRole } = render(<ProtocolDroid animate={false} onGestureChange={onGestureChange} />)
    const svg = getByRole("img")
    expect(svg.getAttribute("aria-label")).toContain("none gesture")
    fireEvent.pointerDown(svg)
    expect(onGestureChange).toHaveBeenLastCalledWith("greet")
    expect(svg.getAttribute("aria-label")).toContain("greet gesture")
  })

  it("restarts the medical scan on a click", () => {
    const onDiagnosticRestart = vi.fn()
    const { getByRole } = render(<MedicalDroid onDiagnosticRestart={onDiagnosticRestart} />)
    fireEvent.pointerDown(getByRole("img"))
    expect(onDiagnosticRestart).toHaveBeenCalledTimes(1)
  })

  it("keeps controlled values over the behaviour", () => {
    const { getByRole, rerender } = render(<UtilityDroid headAngle={40} toolExtension={0.25} behavior="scan" />)
    const label = getByRole("img").getAttribute("aria-label")
    rerender(<UtilityDroid headAngle={40} toolExtension={0.25} behavior="work" speed={9} />)
    expect(getByRole("img").getAttribute("aria-label")).toBe(label)
    // And a non-finite value still draws a machine, not a hole.
    rerender(<ProbeDroid hover={NaN} scanAngle={Infinity} behavior="static" />)
    expect(getByRole("img").innerHTML).not.toMatch(/NaN|Infinity/)
  })
})
