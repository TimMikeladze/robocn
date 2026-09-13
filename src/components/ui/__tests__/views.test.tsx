import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { RobotView } from "@/lib/robocn/style"

import { AstromechDroid } from "@/components/ui/astromech-droid"
import { AttendantDroid } from "@/components/ui/attendant-droid"
import { CasingDroid } from "@/components/ui/casing-droid"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"
import { CourierDroid } from "@/components/ui/courier-droid"
import { CyberTrooper } from "@/components/ui/cyber-trooper"
import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { InfantryDroid } from "@/components/ui/infantry-droid"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { MedicalDroid } from "@/components/ui/medical-droid"
import { MicroDuck } from "@/components/ui/micro-duck"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ProbeDroid } from "@/components/ui/probe-droid"
import { ProtocolDroid } from "@/components/ui/protocol-droid"
import { ReachyMini } from "@/components/ui/reachy-mini"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotBird } from "@/components/ui/robot-bird"
import { RobotCrab } from "@/components/ui/robot-crab"
import { RobotFish } from "@/components/ui/robot-fish"
import { RobotGripper } from "@/components/ui/robot-gripper"
import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import { RobotRover } from "@/components/ui/robot-rover"
import { RobotSnake } from "@/components/ui/robot-snake"
import { RobotSpider } from "@/components/ui/robot-spider"
import { RotaryTable } from "@/components/ui/rotary-table"
import { ScaraArm } from "@/components/ui/scara-arm"
import { SecurityDroid } from "@/components/ui/security-droid"
import { ServoMotor } from "@/components/ui/servo-motor"
import { UtilityDroid } from "@/components/ui/utility-droid"

/**
 * The native view is the default, and adding the `view` axis to a machine is
 * not allowed to change it. These fixtures were captured from each component
 * before it gained the axis: if a projection touches the drawing it was
 * already making, the diff shows up here.
 *
 * Everything is rendered parked (`animate={false}`) with every free axis
 * pinned, so the only thing that can move a fixture is the geometry.
 *
 * What is compared is the drawing itself — the root element's own attributes
 * are outside it, because the accessible label has to name the view, and the
 * `data-view` hook is stripped for the same reason. Neither is geometry.
 */
const drawing = (container: HTMLElement) =>
  container
    .querySelector("svg")!
    .innerHTML.replaceAll(/ data-view="[a-z]+"/g, "")
    // React's generated ids count renders, and nothing here is about them.
    .replaceAll(/«[^»]*»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, "id")

const machines: Record<string, (view?: RobotView) => React.ReactElement> = {
  "robot-arm": (view) => <RobotArm animate={false} angles={[38, -66, 30]} view={view} />,
  "scara-arm": (view) => <ScaraArm animate={false} behavior="static" view={view} />,
  "delta-arm": (view) => <DeltaArm animate={false} behavior="static" view={view} />,
  "gantry-arm": (view) => <GantryArm animate={false} behavior="static" view={view} />,
  "robot-gripper": (view) => <RobotGripper animate={false} opening={0.4} view={view} />,
  "conveyor-belt": (view) => <ConveyorBelt animate={false} position={0.3} view={view} />,
  "linear-actuator": (view) => <LinearActuator animate={false} extension={0.6} view={view} />,
  "servo-motor": (view) => <ServoMotor animate={false} angle={35} view={view} />,
  "rotary-table": (view) => <RotaryTable animate={false} angle={24} view={view} />,
  "robot-rover": () => <RobotRover animate={false} heading={20} steering={12} wheelTravel={0.2} />,
  "courier-droid": () => <CourierDroid animate={false} heading={20} steering={12} />,
  "orb-droid": () => <OrbDroid look={{ x: 0.3, y: -0.2 }} track={false} />,
  "probe-droid": () => <ProbeDroid animate={false} hover={0.5} />,
  "robot-quadruped": () => <RobotQuadruped animate={false} phase={0.25} />,
  "micro-duck": () => <MicroDuck animate={false} phase={0.25} />,
  "robot-spider": () => <RobotSpider animate={false} phase={0.25} />,
  "robot-crab": () => <RobotCrab animate={false} phase={0.25} />,
  "robot-bird": () => <RobotBird animate={false} phase={0.25} />,
  "robot-fish": () => <RobotFish animate={false} phase={0.25} />,
  "robot-snake": () => <RobotSnake animate={false} phase={0.25} />,
  "protocol-droid": () => <ProtocolDroid animate={false} />,
  "security-droid": () => <SecurityDroid />,
  "medical-droid": () => <MedicalDroid animate={false} />,
  "infantry-droid": () => <InfantryDroid animate={false} />,
  "attendant-droid": () => <AttendantDroid animate={false} />,
  "cyber-trooper": () => <CyberTrooper animate={false} />,
  "utility-droid": () => <UtilityDroid animate={false} />,
  "astromech-droid": () => <AstromechDroid animate={false} />,
  "casing-droid": () => <CasingDroid animate={false} />,
  "reachy-mini": () => <ReachyMini animate={false} />,
}

/**
 * The camera each machine is drawn in. Everything in here has the axis; the
 * table grows a batch at a time, and the exemptions in docs/views-backfill.md
 * never appear in it.
 */
const natives: Partial<Record<keyof typeof machines, RobotView>> = {
  "robot-arm": "profile",
  "scara-arm": "plan",
  "delta-arm": "iso",
  "gantry-arm": "front",
  "robot-gripper": "front",
  "conveyor-belt": "profile",
  "linear-actuator": "profile",
  "servo-motor": "front",
  "rotary-table": "plan",
}

const tippedFrom = (native: RobotView): RobotView =>
  native === "iso" ? "front" : "iso"

afterEach(cleanup)

describe("native views", () => {
  for (const [name, machine] of Object.entries(machines)) {
    it(`draws ${name} exactly as it did before it had a view axis`, async () => {
      const { container } = render(machine())
      await expect(drawing(container)).toMatchFileSnapshot(
        `./__snapshots__/views/${name}.html`,
      )
    })
  }
})

describe("the view axis", () => {
  for (const [name, native] of Object.entries(natives) as [string, RobotView][]) {
    it(`turns the camera on ${name} without moving the machine`, () => {
      const machine = machines[name]
      const asked = render(machine(native))
      const still = drawing(asked.container)
      // Asking for the native view explicitly is the same drawing as the default.
      expect(still).toBe(drawing(render(machine()).container))
      expect(asked.container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(native)
      cleanup()

      for (const view of ["plan", "front", "profile", "iso"] as const) {
        const { container } = render(machine(view))
        expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe(view)
        expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(
          view === "plan" ? /plan/ : view === "iso" ? /isometric/ : /elevation/,
        )
        expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
        if (view !== native) expect(drawing(container)).not.toBe(still)
        cleanup()
      }
    })
  }
})

describe("the tipped view", () => {
  for (const [name, native] of Object.entries(natives) as [string, RobotView][]) {
    it(`gives ${name} parts that only exist off its own axis`, async () => {
      const { container } = render(machines[name](tippedFrom(native)))
      await expect(drawing(container)).toMatchFileSnapshot(
        `./__snapshots__/views/${name}.${tippedFrom(native)}.html`,
      )
    })
  }
})
