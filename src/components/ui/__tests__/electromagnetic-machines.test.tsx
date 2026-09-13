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
import { EddyCurrentBrake, eddyBrakeGoal } from "@/components/ui/eddy-current-brake"
import { MaglevCarriage, maglevCarriageGoal } from "@/components/ui/maglev-carriage"
import { MagneticGripper, magneticGripperGoal } from "@/components/ui/magnetic-gripper"
import { InductiveSensor, inductiveSensorGoal } from "@/components/ui/inductive-sensor"
import { Resolver, resolverGoal } from "@/components/ui/resolver"
import { TransformerCore, transformerGoal } from "@/components/ui/transformer-core"

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

describe("eddy-current brake", () => {
  it("moves the magnet array over the disc without touching its rotation", () => {
    const { container, rerender } = render(<EddyCurrentBrake engagement={0} discAngle={20} slots={6} />)
    const disc = container.querySelector("[data-disc]")?.getAttribute("transform")
    const magnet = container.querySelector("[data-magnet]")?.getAttribute("transform")
    rerender(<EddyCurrentBrake engagement={1} discAngle={20} slots={6} />)
    expect(container.querySelector("[data-magnet]")?.getAttribute("transform")).not.toBe(magnet)
    expect(container.querySelector("[data-disc]")?.getAttribute("transform")).toBe(disc)
    expect(container.querySelectorAll("[data-slot]")).toHaveLength(6)
  })

  it("neutralizes invalid engagement and bounds automatic overlap", () => {
    const neutral = render(<EddyCurrentBrake engagement={0} />)
    const invalid = render(<EddyCurrentBrake engagement={Infinity} />)
    expect(invalid.container.querySelector("[data-magnet]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-magnet]")?.getAttribute("transform"))
    for (const behavior of ["brake", "feather", "static"] as const) {
      expect(eddyBrakeGoal(behavior, Infinity)).toBeGreaterThanOrEqual(0)
      expect(eddyBrakeGoal(behavior, Infinity)).toBeLessThanOrEqual(1)
    }
  })
})

describe("maglev carriage", () => {
  it("moves the carriage along the stator while preserving its air gap", () => {
    const { container, rerender } = render(<MaglevCarriage travel={0} payload="bin" />)
    const gap = container.querySelector("[data-air-gap]")?.outerHTML
    const carriage = container.querySelector("[data-carriage]")?.getAttribute("transform")
    rerender(<MaglevCarriage travel={1} payload="bin" />)
    expect(container.querySelector("[data-carriage]")?.getAttribute("transform")).not.toBe(carriage)
    expect(container.querySelector("[data-air-gap]")?.outerHTML).toBe(gap)
    expect(container.querySelector('[data-payload="bin"]')).toBeTruthy()
  })

  it("parks invalid travel at the centre and samples within the rail", () => {
    const centre = render(<MaglevCarriage travel={0.5} />)
    const invalid = render(<MaglevCarriage travel={Number.NaN} />)
    expect(invalid.container.querySelector("[data-carriage]")?.getAttribute("transform"))
      .toBe(centre.container.querySelector("[data-carriage]")?.getAttribute("transform"))
    for (const behavior of ["shuttle", "hover", "static"] as const) {
      const value = maglevCarriageGoal(behavior, Infinity)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe("magnetic gripper", () => {
  it("captures and lifts a steel workpiece as field strength rises", () => {
    const { container, rerender } = render(<MagneticGripper strength={0} workpiece="plate" />)
    const plate = container.querySelector("[data-workpiece]")?.getAttribute("transform")
    rerender(<MagneticGripper strength={1} workpiece="plate" />)
    expect(container.querySelector("[data-workpiece]")?.getAttribute("transform")).not.toBe(plate)
    expect(container.querySelectorAll("[data-pole]")).toHaveLength(2)
    expect(container.querySelector("[data-field]")?.getAttribute("data-active")).toBe("true")
  })

  it("does not invent a workpiece and neutralizes invalid strength", () => {
    expect(render(<MagneticGripper strength={1} workpiece="none" />).container.querySelector("[data-workpiece]")).toBeNull()
    const neutral = render(<MagneticGripper strength={0} />)
    const invalid = render(<MagneticGripper strength={Infinity} />)
    expect(invalid.container.querySelector("[data-field]")?.getAttribute("data-strength"))
      .toBe(neutral.container.querySelector("[data-field]")?.getAttribute("data-strength"))
    for (const behavior of ["pick", "hold", "static"] as const) {
      expect(magneticGripperGoal(behavior, Infinity)).toBeGreaterThanOrEqual(0)
      expect(magneticGripperGoal(behavior, Infinity)).toBeLessThanOrEqual(1)
    }
  })
})

describe("inductive sensor", () => {
  it("moves the metal target and reports whether it is inside the selected range", () => {
    const { container, rerender } = render(<InductiveSensor distance={1} range={0.4} target="plate" />)
    const far = container.querySelector("[data-target]")?.getAttribute("transform")
    expect(container.querySelector("[data-output]")?.getAttribute("data-detected")).toBe("false")
    rerender(<InductiveSensor distance={0.1} range={0.4} target="plate" />)
    expect(container.querySelector("[data-target]")?.getAttribute("transform")).not.toBe(far)
    expect(container.querySelector("[data-output]")?.getAttribute("data-detected")).toBe("true")
  })

  it("never detects a missing target and treats invalid distance as far", () => {
    expect(render(<InductiveSensor distance={0} target="none" />).container.querySelector("[data-output]")?.getAttribute("data-detected")).toBe("false")
    const far = render(<InductiveSensor distance={1} />)
    const invalid = render(<InductiveSensor distance={Number.NaN} />)
    expect(invalid.container.querySelector("[data-target]")?.getAttribute("transform"))
      .toBe(far.container.querySelector("[data-target]")?.getAttribute("transform"))
    for (const behavior of ["approach", "inspect", "static"] as const) {
      const value = inductiveSensorGoal(behavior, Infinity)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe("resolver", () => {
  it("rotates the transformer rotor and exposes quadrature channel values", () => {
    const { container, rerender } = render(<Resolver angle={0} showChannels />)
    const rotor = container.querySelector("[data-rotor]")?.getAttribute("transform")
    expect(container.querySelector('[data-channel="sine"]')?.getAttribute("data-value")).toBe("0")
    rerender(<Resolver angle={90} showChannels />)
    expect(container.querySelector("[data-rotor]")?.getAttribute("transform")).not.toBe(rotor)
    expect(container.querySelector('[data-channel="sine"]')?.getAttribute("data-value")).toBe("1")
    expect(container.querySelector('[data-channel="cosine"]')?.getAttribute("data-value")).toBe("0")
  })

  it("neutralizes invalid angle and reports rotary keyboard input", () => {
    const neutral = render(<Resolver angle={0} />)
    const invalid = render(<Resolver angle={Infinity} />)
    expect(invalid.container.querySelector("[data-rotor]")?.getAttribute("transform"))
      .toBe(neutral.container.querySelector("[data-rotor]")?.getAttribute("transform"))
    const onAngleChange = vi.fn()
    const interactive = render(<Resolver angle={20} interactive onAngleChange={onAngleChange} />)
    fireEvent.keyDown(interactive.getByRole("slider"), { key: "ArrowRight" })
    expect(onAngleChange).toHaveBeenLastCalledWith(25)
    expect(resolverGoal("turn", Infinity)).toBe(0)
  })
})

describe("transformer core", () => {
  it("reverses flux direction with electrical phase and changes winding density by ratio", () => {
    const { container, rerender } = render(<TransformerCore phase={0} turns="step-down" />)
    const flux = container.querySelector("[data-flux]")?.getAttribute("data-direction")
    const secondaryTurns = container.querySelectorAll('[data-secondary] [data-turn]').length
    rerender(<TransformerCore phase={0.5} turns="step-up" />)
    expect(container.querySelector("[data-flux]")?.getAttribute("data-direction")).not.toBe(flux)
    expect(container.querySelectorAll('[data-secondary] [data-turn]').length).toBeGreaterThan(secondaryTurns)
  })

  it("uses neutral phase for invalid input and samples a finite cycle", () => {
    const neutral = render(<TransformerCore phase={0} />)
    const invalid = render(<TransformerCore phase={Number.NaN} />)
    expect(invalid.container.querySelector("[data-flux]")?.getAttribute("data-phase"))
      .toBe(neutral.container.querySelector("[data-flux]")?.getAttribute("data-phase"))
    for (const behavior of ["alternate", "pulse", "static"] as const) {
      const value = transformerGoal(behavior, Infinity)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
