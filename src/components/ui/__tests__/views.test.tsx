import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { RobotView } from "@/lib/robocn/style"

import { AstromechDroid } from "@/components/ui/astromech-droid"
import { AttendantDroid } from "@/components/ui/attendant-droid"
import { BellowsDroid } from "@/components/ui/bellows-droid"
import { CasingDroid } from "@/components/ui/casing-droid"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"
import { CourierDroid } from "@/components/ui/courier-droid"
import { CyberTrooper } from "@/components/ui/cyber-trooper"
import { CustodianDroid } from "@/components/ui/custodian-droid"
import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { GuideDroid } from "@/components/ui/guide-droid"
import { RobotHorse } from "@/components/ui/robot-horse"
import { RobotHound } from "@/components/ui/robot-hound"
import { InfantryDroid } from "@/components/ui/infantry-droid"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { MedicalDroid } from "@/components/ui/medical-droid"
import { MicroDuck } from "@/components/ui/micro-duck"
import { MonolithDroid } from "@/components/ui/monolith-droid"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ProbeDroid } from "@/components/ui/probe-droid"
import { ProtocolDroid } from "@/components/ui/protocol-droid"
import { PylonDroid } from "@/components/ui/pylon-droid"
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
import { RobotAnt } from "@/components/ui/robot-ant"
import { RobotBat } from "@/components/ui/robot-bat"
import { RobotDragonfly } from "@/components/ui/robot-dragonfly"
import { RobotCat } from "@/components/ui/robot-cat"
import { RobotDog } from "@/components/ui/robot-dog"
import { RobotFox } from "@/components/ui/robot-fox"
import { RobotFrog } from "@/components/ui/robot-frog"
import { RobotInchworm } from "@/components/ui/robot-inchworm"
import { RobotJellyfish } from "@/components/ui/robot-jellyfish"
import { RobotManta } from "@/components/ui/robot-manta"
import { RobotMantis } from "@/components/ui/robot-mantis"
import { RobotOctopus } from "@/components/ui/robot-octopus"
import { RobotScorpion } from "@/components/ui/robot-scorpion"
import { RobotSeahorse } from "@/components/ui/robot-seahorse"
import { RobotTurtle } from "@/components/ui/robot-turtle"
import { RotaryTable } from "@/components/ui/rotary-table"
import { ScaraArm } from "@/components/ui/scara-arm"
import { SecurityDroid } from "@/components/ui/security-droid"
import { SentinelConsole } from "@/components/ui/sentinel-console"
import { ServoMotor } from "@/components/ui/servo-motor"
import { SolenoidValve } from "@/components/ui/solenoid-valve"
import { ElectromagneticRelay } from "@/components/ui/electromagnetic-relay"
import { InductionMotor } from "@/components/ui/induction-motor"
import { StepperMotor } from "@/components/ui/stepper-motor"
import { VoiceCoilActuator } from "@/components/ui/voice-coil-actuator"
import { MagneticBearing } from "@/components/ui/magnetic-bearing"
import { EddyCurrentBrake } from "@/components/ui/eddy-current-brake"
import { MaglevCarriage } from "@/components/ui/maglev-carriage"
import { MagneticGripper } from "@/components/ui/magnetic-gripper"
import { InductiveSensor } from "@/components/ui/inductive-sensor"
import { Resolver } from "@/components/ui/resolver"
import { TransformerCore } from "@/components/ui/transformer-core"
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
  "solenoid-valve": (view) => <SolenoidValve animate={false} position={0.65} view={view} />,
  "electromagnetic-relay": (view) => <ElectromagneticRelay animate={false} energized={0.8} view={view} />,
  "induction-motor": (view) => <InductionMotor animate={false} angle={38} view={view} />,
  "stepper-motor": (view) => <StepperMotor animate={false} step={3} view={view} />,
  "voice-coil-actuator": (view) => <VoiceCoilActuator animate={false} position={0.55} view={view} />,
  "magnetic-bearing": (view) => <MagneticBearing animate={false} offset={0.45} view={view} />,
  "eddy-current-brake": (view) => <EddyCurrentBrake animate={false} engagement={0.7} discAngle={28} view={view} />,
  "maglev-carriage": (view) => <MaglevCarriage animate={false} travel={0.62} view={view} />,
  "magnetic-gripper": (view) => <MagneticGripper animate={false} strength={0.78} view={view} />,
  "inductive-sensor": (view) => <InductiveSensor animate={false} distance={0.22} view={view} />,
  "resolver": (view) => <Resolver animate={false} angle={42} view={view} />,
  "transformer-core": (view) => <TransformerCore animate={false} phase={0.3} view={view} />,
  "rotary-table": (view) => <RotaryTable animate={false} angle={24} view={view} />,
  "robot-rover": (view) => <RobotRover animate={false} heading={20} steering={12} wheelTravel={0.2} view={view} />,
  "courier-droid": (view) => <CourierDroid animate={false} heading={20} steering={12} view={view} />,
  "orb-droid": (view) => <OrbDroid look={{ x: 0.3, y: -0.2 }} track={false} view={view} />,
  "probe-droid": (view) => <ProbeDroid animate={false} hover={0.5} view={view} />,
  "robot-quadruped": (view) => <RobotQuadruped animate={false} phase={0.25} view={view} />,
  "micro-duck": (view) => <MicroDuck animate={false} phase={0.25} view={view} />,
  "robot-spider": (view) => <RobotSpider animate={false} phase={0.25} view={view} />,
  "robot-crab": (view) => <RobotCrab animate={false} phase={0.25} view={view} />,
  "robot-bird": (view) => <RobotBird animate={false} phase={0.25} view={view} />,
  "robot-dragonfly": (view) => <RobotDragonfly animate={false} phase={0.25} view={view} />,
  "robot-bat": (view) => <RobotBat animate={false} phase={0.25} view={view} />,
  "robot-jellyfish": (view) => <RobotJellyfish animate={false} phase={0.25} view={view} />,
  "robot-manta": (view) => <RobotManta animate={false} phase={0.25} view={view} />,
  "robot-octopus": (view) => <RobotOctopus animate={false} phase={0.25} view={view} />,
  "robot-seahorse": (view) => <RobotSeahorse animate={false} phase={0.25} view={view} />,
  "robot-ant": (view) => <RobotAnt animate={false} phase={0.25} view={view} />,
  "robot-scorpion": (view) => <RobotScorpion animate={false} phase={0.25} view={view} />,
  "robot-mantis": (view) => <RobotMantis animate={false} phase={0.25} target={{ x: 40, y: -10 }} view={view} />,
  "robot-frog": (view) => <RobotFrog animate={false} phase={0.25} view={view} />,
  "robot-cat": (view) => <RobotCat animate={false} phase={0.25} view={view} />,
  "robot-dog": (view) => <RobotDog animate={false} phase={0.25} view={view} />,
  "robot-fox": (view) => <RobotFox animate={false} phase={0.25} view={view} />,
  "robot-horse": (view) => <RobotHorse animate={false} phase={0.25} interactive={false} view={view} />,
  "robot-turtle": (view) => <RobotTurtle animate={false} phase={0.25} view={view} />,
  "robot-inchworm": (view) => <RobotInchworm animate={false} phase={0.25} view={view} />,
  "robot-fish": (view) => <RobotFish animate={false} phase={0.25} view={view} />,
  "robot-snake": (view) => <RobotSnake animate={false} phase={0.25} view={view} />,
  "protocol-droid": (view) => <ProtocolDroid animate={false} view={view} />,
  "security-droid": (view) => <SecurityDroid view={view} />,
  "medical-droid": (view) => <MedicalDroid animate={false} view={view} />,
  "infantry-droid": (view) => <InfantryDroid animate={false} view={view} />,
  "attendant-droid": (view) => <AttendantDroid animate={false} view={view} />,
  "cyber-trooper": (view) => <CyberTrooper animate={false} view={view} />,
  "utility-droid": (view) => <UtilityDroid animate={false} view={view} />,
  "astromech-droid": (view) => <AstromechDroid animate={false} view={view} />,
  "casing-droid": (view) => <CasingDroid animate={false} view={view} />,
  "pylon-droid": (view) => <PylonDroid animate={false} deploy={0.7} stance="wide" track={false} look={{ x: 0.3, y: -0.2 }} view={view} />,
  "robot-hound": (view) => <RobotHound animate={false} attention={0.7} track={false} look={{ x: 0.3, y: -0.2 }} view={view} />,
  "guide-droid": (view) => <GuideDroid animate={false} height={0.6} rotorAngle={24} voice={0.4} track={false} look={{ x: 0.3, y: -0.2 }} view={view} />,
  "monolith-droid": (view) => <MonolithDroid animate={false} splay={0.6} stride={0.25} panel={0.5} lean={0} view={view} />,
  "custodian-droid": (view) => <CustodianDroid animate={false} open={0.55} voice={0.4} track={false} look={{ x: 0.3, y: -0.2 }} view={view} />,
  "sentinel-console": (view) => <SentinelConsole animate={false} aperture={0.55} voice={0.4} track={false} look={{ x: 0.3, y: -0.2 }} view={view} />,
  "bellows-droid": (view) => <BellowsDroid animate={false} inflation={0.62} pleats={7} view={view} />,
  "reachy-mini": (view) => <ReachyMini animate={false} view={view} />,
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
  "solenoid-valve": "profile",
  "electromagnetic-relay": "profile",
  "induction-motor": "front",
  "stepper-motor": "front",
  "voice-coil-actuator": "profile",
  "magnetic-bearing": "front",
  "eddy-current-brake": "iso",
  "maglev-carriage": "profile",
  "magnetic-gripper": "front",
  "inductive-sensor": "profile",
  "resolver": "front",
  "transformer-core": "iso",
  "rotary-table": "plan",
  "robot-rover": "plan",
  "courier-droid": "plan",
  "orb-droid": "front",
  "probe-droid": "front",
  "robot-quadruped": "profile",
  "micro-duck": "profile",
  "robot-spider": "plan",
  "robot-crab": "plan",
  "robot-bird": "profile",
  "robot-dragonfly": "plan",
  "robot-bat": "profile",
  "robot-jellyfish": "front",
  "robot-manta": "plan",
  "robot-octopus": "front",
  "robot-seahorse": "profile",
  "robot-ant": "plan",
  "robot-scorpion": "plan",
  "robot-mantis": "profile",
  "robot-frog": "profile",
  "robot-cat": "profile",
  "robot-dog": "profile",
  "robot-fox": "profile",
  "robot-horse": "profile",
  "robot-turtle": "plan",
  "robot-inchworm": "profile",
  "robot-fish": "profile",
  "robot-snake": "plan",
  "protocol-droid": "front",
  "security-droid": "front",
  "medical-droid": "front",
  "infantry-droid": "front",
  "attendant-droid": "front",
  "cyber-trooper": "front",
  "utility-droid": "front",
  "astromech-droid": "front",
  "casing-droid": "front",
  "robot-hound": "profile",
  "guide-droid": "front",
  "monolith-droid": "front",
  "pylon-droid": "front",
  "custodian-droid": "front",
  "sentinel-console": "front",
  "bellows-droid": "front",
  "reachy-mini": "iso",
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
