import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CourierDroid } from "@/components/ui/courier-droid"
import { InfantryDroid } from "@/components/ui/infantry-droid"
import { MedicalDroid } from "@/components/ui/medical-droid"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ProbeDroid } from "@/components/ui/probe-droid"
import { ProtocolDroid } from "@/components/ui/protocol-droid"
import { SecurityDroid } from "@/components/ui/security-droid"
import { UtilityDroid } from "@/components/ui/utility-droid"

describe("droid collection", () => {
  it("changes the utility dome and deployed tool from controlled props", () => {
    const { container, getByRole, rerender } = render(
      <UtilityDroid headAngle={0} tool="interface" toolExtension={0} />,
    )
    const dome = container.querySelector("[data-dome]")!.getAttribute("transform")

    rerender(<UtilityDroid headAngle={45} tool="gripper" toolExtension={1} />)

    expect(container.querySelector("[data-dome]")!.getAttribute("transform")).not.toBe(dome)
    expect(container.querySelector('[data-tool="gripper"]')).not.toBeNull()
    expect(getByRole("img").getAttribute("aria-label")).toContain("Utility droid")
  })

  it("rotates the orb shell independently from its stabilized head", () => {
    const { container, rerender } = render(
      <OrbDroid track={false} bodyAngle={0} headAngle={0} look={{ x: -1, y: 0 }} />,
    )
    const shell = container.querySelector("[data-body]")!.getAttribute("transform")
    const head = container.querySelector("[data-head]")!.getAttribute("transform")
    const eye = container.querySelector("[data-eye]")!.getAttribute("cx")

    rerender(<OrbDroid track={false} bodyAngle={90} headAngle={30} look={{ x: 1, y: 0 }} />)

    expect(container.querySelector("[data-body]")!.getAttribute("transform")).not.toBe(shell)
    expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(head)
    expect(container.querySelector("[data-eye]")!.getAttribute("cx")).not.toBe(eye)
  })

  it("poses the protocol droid and exposes its articulated joints", () => {
    const { container, rerender } = render(<ProtocolDroid pose="formal" gesture="none" />)
    const arm = container.querySelector('[data-arm="right"]')!.getAttribute("transform")

    rerender(<ProtocolDroid pose="converse" gesture="explain" exposed />)

    expect(container.querySelector('[data-arm="right"]')!.getAttribute("transform")).not.toBe(arm)
    expect(container.querySelector("[data-wiring]")).not.toBeNull()
    expect(container.querySelectorAll("[data-joint]").length).toBeGreaterThanOrEqual(6)
  })

  it("changes security posture and alert sensor state", () => {
    const { container, rerender } = render(
      <SecurityDroid track={false} pose="stand" alert={false} />,
    )
    const stance = container.querySelector("[data-frame]")!.getAttribute("transform")

    rerender(<SecurityDroid track={false} pose="patrol" alert />)

    expect(container.querySelector("[data-frame]")!.getAttribute("transform")).not.toBe(stance)
    expect(container.querySelector("[data-alert]")).not.toBeNull()
  })

  it("renders selected medical tools and diagnostic level", () => {
    const { container, rerender } = render(
      <MedicalDroid leftTool="scanner" rightTool="injector" diagnostic={0.2} />,
    )
    expect(container.querySelector('[data-tool="scanner"]')).not.toBeNull()
    const meter = container.querySelector("[data-diagnostic]")!.getAttribute("width")

    rerender(<MedicalDroid leftTool="clamp" rightTool="probe" diagnostic={0.9} />)

    expect(container.querySelector('[data-tool="clamp"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="probe"]')).not.toBeNull()
    expect(container.querySelector("[data-diagnostic]")!.getAttribute("width")).not.toBe(meter)
  })

  it("supports light and heavy infantry frames with controlled poses", () => {
    const { container, rerender } = render(
      <InfantryDroid frame="light" pose="march" equipment="pack" />,
    )
    expect(container.querySelector('[data-frame="light"]')).not.toBeNull()

    rerender(<InfantryDroid frame="heavy" pose="guard" equipment="shield" />)

    expect(container.querySelector('[data-frame="heavy"]')).not.toBeNull()
    expect(container.querySelector('[data-equipment="shield"]')).not.toBeNull()
  })

  it("controls probe hover, scanner, and appendage count", () => {
    const { container, rerender } = render(
      <ProbeDroid hover={0} scanAngle={-20} appendages={3} />,
    )
    const pod = container.querySelector("[data-pod]")!.getAttribute("transform")
    expect(container.querySelectorAll("[data-appendage]")).toHaveLength(3)

    rerender(<ProbeDroid hover={1} scanAngle={20} appendages={6} active />)

    expect(container.querySelector("[data-pod]")!.getAttribute("transform")).not.toBe(pod)
    expect(container.querySelectorAll("[data-appendage]")).toHaveLength(6)
    expect(container.querySelector("[data-scan]")).not.toBeNull()
  })

  it("steers the courier wheels and carries an optional pod", () => {
    const { container, rerender } = render(
      <CourierDroid steering={-25} travel={0} cargo="none" />,
    )
    const wheel = container.querySelector('[data-wheel="front"]')!.getAttribute("transform")

    rerender(<CourierDroid steering={25} travel={0.5} cargo="pod" />)

    expect(container.querySelector('[data-wheel="front"]')!.getAttribute("transform")).not.toBe(wheel)
    expect(container.querySelector('[data-cargo="pod"]')).not.toBeNull()
  })

  it("honors shared styling, sizing, and accessible-name overrides", () => {
    const { container, getByRole } = render(
      <ProbeDroid
        size={280}
        variant="blueprint"
        color="#abcdef"
        aria-label="Outer rim survey unit"
      />,
    )

    expect(getByRole("img", { name: "Outer rim survey unit" }).getAttribute("width")).toBe("280")
    expect(container.innerHTML).toContain("#abcdef")
  })

  it("falls back to neutral angles for non-finite sensor input", () => {
    const utility = render(<UtilityDroid headAngle={Number.NaN} />)
    expect(utility.container.querySelector("[data-dome]")!.getAttribute("transform")).toContain("rotate(0)")
    utility.unmount()

    const medical = render(<MedicalDroid headAngle={Number.POSITIVE_INFINITY} />)
    expect(medical.container.querySelector("[data-head]")!.getAttribute("transform")).toBe("translate(0 -120) rotate(0)")
    medical.unmount()

    const probe = render(<ProbeDroid scanAngle={Number.NaN} />)
    expect(probe.container.querySelector("[data-scanner]")!.getAttribute("transform")).toBe("rotate(0 0 -10)")
  })
})
