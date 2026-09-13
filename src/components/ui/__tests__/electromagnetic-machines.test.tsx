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
