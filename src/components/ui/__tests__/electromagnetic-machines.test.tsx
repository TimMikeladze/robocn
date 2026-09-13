import { fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  ElectromagneticRelay,
  electromagneticRelayGoal,
} from "@/components/ui/electromagnetic-relay"
import {
  SolenoidValve,
  solenoidValveGoal,
} from "@/components/ui/solenoid-valve"
import { InductionMotor, inductionMotorGoal } from "@/components/ui/induction-motor"
import { StepperMotor, stepperMotorGoal } from "@/components/ui/stepper-motor"
import { VoiceCoilActuator, voiceCoilGoal } from "@/components/ui/voice-coil-actuator"
import { MagneticBearing, magneticBearingGoal } from "@/components/ui/magnetic-bearing"

afterEach(() => vi.restoreAllMocks())

describe("solenoid valve", () => {
  it("moves the plunger and flow route from the controlled position", () => {
    const { container, rerender } = render(<SolenoidValve position={0} />)
    const parked = container.querySelector("[data-plunger]")?.getAttribute("transform")
    rerender(<SolenoidValve position={1} />)
    expect(container.querySelector("[data-plunger]")?.getAttribute("transform")).not.toBe(parked)
    expect(container.querySelector("[data-flow]")?.getAttribute("data-open")).toBe("true")
  })

  it("uses its neutral pose for invalid position and exposes an overridable label", () => {
    const neutral = render(<SolenoidValve position={0} />)
    const invalid = render(<SolenoidValve position={Infinity} aria-label="Pneumatic inlet valve" />)
    expect(invalid.container.querySelector("[data-plunger]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-plunger]")?.getAttribute("transform"))
    expect(invalid.getByRole("img", { name: "Pneumatic inlet valve" })).toBeTruthy()
  })

  it("samples bounded finite automatic positions", () => {
    for (const behavior of ["cycle", "pulse", "static"] as const) {
      for (const clock of [0, 0.2, 0.7, 10, Infinity]) {
        expect(solenoidValveGoal(behavior, clock)).toBeGreaterThanOrEqual(0)
        expect(solenoidValveGoal(behavior, clock)).toBeLessThanOrEqual(1)
      }
    }
  })

  it("reports keyboard interaction through onPositionChange", () => {
    const onPositionChange = vi.fn()
    const { getByRole } = render(
      <SolenoidValve position={0.25} interactive onPositionChange={onPositionChange} />,
    )
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" })
    expect(onPositionChange).toHaveBeenLastCalledWith(0.3)
  })
})

describe("electromagnetic relay", () => {
  it("pulls the armature and switches both poles when energized", () => {
    const { container, rerender } = render(<ElectromagneticRelay energized={0} poles={2} />)
    const released = container.querySelector("[data-armature]")?.getAttribute("transform")
    rerender(<ElectromagneticRelay energized={1} poles={2} />)
    expect(container.querySelector("[data-armature]")?.getAttribute("transform")).not.toBe(released)
    expect(container.querySelectorAll("[data-contact]")).toHaveLength(2)
    expect(container.querySelector("[data-contact]")?.getAttribute("data-closed")).toBe("true")
  })

  it("inverts normally closed contacts and neutralizes invalid energy", () => {
    const neutral = render(<ElectromagneticRelay energized={0} normally="closed" />)
    expect(neutral.container.querySelector("[data-contact]")?.getAttribute("data-closed")).toBe("true")
    const invalid = render(<ElectromagneticRelay energized={Number.NaN} normally="closed" />)
    expect(invalid.container.querySelector("[data-armature]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-armature]")?.getAttribute("transform"))
  })

  it("samples bounded finite automatic energy", () => {
    for (const behavior of ["switch", "pulse", "static"] as const) {
      for (const clock of [0, 0.25, 0.8, 5, Infinity]) {
        expect(electromagneticRelayGoal(behavior, clock)).toBeGreaterThanOrEqual(0)
        expect(electromagneticRelayGoal(behavior, clock)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("induction motor", () => {
  it("rotates the cage rotor without moving the stator phases", () => {
    const { container, rerender } = render(<InductionMotor angle={0} poles={4} />)
    const stator = container.querySelector("[data-stator-phase]")?.outerHTML
    const rotor = container.querySelector("[data-rotor]")?.getAttribute("transform")
    rerender(<InductionMotor angle={90} poles={4} />)
    expect(container.querySelector("[data-rotor]")?.getAttribute("transform")).not.toBe(rotor)
    expect(container.querySelector("[data-stator-phase]")?.outerHTML).toBe(stator)
    expect(container.querySelectorAll("[data-cage-bar]").length).toBeGreaterThan(5)
  })

  it("neutralizes invalid rotor angles and samples finite rotation", () => {
    const neutral = render(<InductionMotor angle={0} />)
    const invalid = render(<InductionMotor angle={Infinity} />)
    expect(invalid.container.querySelector("[data-rotor]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-rotor]")?.getAttribute("transform"))
    for (const behavior of ["run", "slip", "static"] as const) {
      expect(Number.isFinite(inductionMotorGoal(behavior, Infinity))).toBe(true)
    }
  })
})

describe("stepper motor", () => {
  it("indexes the rotor to discrete teeth and exposes the active phases", () => {
    const { container, rerender } = render(<StepperMotor step={0} steps={8} />)
    const rotor = container.querySelector("[data-rotor]")?.getAttribute("transform")
    rerender(<StepperMotor step={3} steps={8} />)
    expect(container.querySelector("[data-rotor]")?.getAttribute("transform")).not.toBe(rotor)
    expect(container.querySelectorAll("[data-phase]").length).toBeGreaterThanOrEqual(4)
    expect(container.querySelector("[data-index]")?.getAttribute("data-step")).toBe("3")
  })

  it("wraps integer steps and uses step zero for invalid input", () => {
    expect(render(<StepperMotor step={9} steps={8} />).container.querySelector("[data-index]")?.getAttribute("data-step")).toBe("1")
    expect(render(<StepperMotor step={Number.NaN} steps={8} />).container.querySelector("[data-index]")?.getAttribute("data-step")).toBe("0")
    for (const behavior of ["step", "run", "static"] as const) {
      const value = stepperMotorGoal(behavior, Infinity, 8)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(8)
    }
  })

  it("reports one discrete keyboard step", () => {
    const onStepChange = vi.fn()
    const { getByRole } = render(<StepperMotor step={2} steps={8} interactive onStepChange={onStepChange} />)
    fireEvent.keyDown(getByRole("slider"), { key: "ArrowRight" })
    expect(onStepChange).toHaveBeenLastCalledWith(3)
  })
})

describe("voice-coil actuator", () => {
  it("moves its coil and carriage bidirectionally through a fixed gap", () => {
    const { container, rerender } = render(<VoiceCoilActuator position={-1} />)
    const gap = container.querySelector("[data-gap]")?.outerHTML
    const carriage = container.querySelector("[data-carriage]")?.getAttribute("transform")
    rerender(<VoiceCoilActuator position={1} />)
    expect(container.querySelector("[data-carriage]")?.getAttribute("transform")).not.toBe(carriage)
    expect(container.querySelector("[data-gap]")?.outerHTML).toBe(gap)
    expect(container.querySelector("[data-coil]")?.getAttribute("transform"))
      .toBe(container.querySelector("[data-carriage]")?.getAttribute("transform"))
  })

  it("neutralizes invalid position and samples within bipolar travel", () => {
    const neutral = render(<VoiceCoilActuator position={0} />)
    const invalid = render(<VoiceCoilActuator position={Infinity} />)
    expect(invalid.container.querySelector("[data-carriage]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-carriage]")?.getAttribute("transform"))
    for (const behavior of ["oscillate", "pulse", "static"] as const) {
      expect(Math.abs(voiceCoilGoal(behavior, Infinity))).toBeLessThanOrEqual(1)
    }
  })
})

describe("magnetic bearing", () => {
  it("displaces the unsupported rotor and emphasizes the opposing correction coils", () => {
    const { container, rerender } = render(<MagneticBearing offset={-1} axis="x" />)
    const rotor = container.querySelector("[data-rotor]")?.getAttribute("transform")
    const left = container.querySelector('[data-coil="left"]')?.getAttribute("opacity")
    rerender(<MagneticBearing offset={1} axis="x" />)
    expect(container.querySelector("[data-rotor]")?.getAttribute("transform")).not.toBe(rotor)
    expect(container.querySelector('[data-coil="left"]')?.getAttribute("opacity")).not.toBe(left)
    expect(container.querySelectorAll("[data-gap]")).toHaveLength(4)
  })

  it("neutralizes invalid offset and samples finite bipolar correction", () => {
    const neutral = render(<MagneticBearing offset={0} />)
    const invalid = render(<MagneticBearing offset={Number.NaN} />)
    expect(invalid.container.querySelector("[data-rotor]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-rotor]")?.getAttribute("transform"))
    for (const behavior of ["balance", "disturb", "static"] as const) {
      expect(Math.abs(magneticBearingGoal(behavior, Infinity))).toBeLessThanOrEqual(1)
    }
  })
})
