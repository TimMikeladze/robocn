import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

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

const machines: Record<string, () => React.ReactElement> = {
  "robot-arm": () => <RobotArm animate={false} angles={[38, -66, 30]} />,
  "scara-arm": () => <ScaraArm animate={false} behavior="static" />,
  "delta-arm": () => <DeltaArm animate={false} behavior="static" />,
  "gantry-arm": () => <GantryArm animate={false} behavior="static" />,
  "robot-gripper": () => <RobotGripper animate={false} opening={0.4} />,
  "conveyor-belt": () => <ConveyorBelt animate={false} position={0.3} />,
  "linear-actuator": () => <LinearActuator animate={false} extension={0.6} />,
  "servo-motor": () => <ServoMotor animate={false} angle={35} />,
  "rotary-table": () => <RotaryTable animate={false} angle={24} />,
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
