"use client"

/**
 * Live demos for the docs pages. One per registry item, keyed by doc slug.
 *
 * `demos` below is an override, not a prerequisite: read it through `demoFor`,
 * which falls back to the machine itself with a variant and view switch when
 * nobody has written a bench for it. An item that ships without a demo is then
 * still demonstrable the day it lands. Notes: `docs/gallery-coverage.md`.
 */

import * as React from "react"

import { AstromechDroid, type AstromechAntenna, type AstromechBehavior, type AstromechDome, type AstromechFeet, type AstromechLivery, type AstromechTool } from "@/components/ui/astromech-droid"
import { AttendantDroid, type AttendantDroidBehavior, type AttendantDroidBuild, type AttendantDroidFace, type AttendantDroidHands, type AttendantDroidPlating, type AttendantDroidPose } from "@/components/ui/attendant-droid"
import { BellowsDroid, type BellowsAperture, type BellowsBehavior, type BellowsOptics } from "@/components/ui/bellows-droid"
import { RobotAvocado, type AvocadoBehavior, type AvocadoStone } from "@/components/ui/robot-avocado"
import { RobotStrawberry, type StrawberryBehavior } from "@/components/ui/robot-strawberry"
import { RobotTomato, type TomatoBehavior } from "@/components/ui/robot-tomato"
import { CasingDroid, type CasingDroidBehavior, type CasingDroidCollar, type CasingDroidDome, type CasingDroidEmitter, type CasingDroidLamps, type CasingDroidManipulator, type CasingDroidSkirt } from "@/components/ui/casing-droid"
import { CyberTrooper, type CyberTrooperBehavior, type CyberTrooperBuild, type CyberTrooperChest, type CyberTrooperHelmet, type CyberTrooperPose, type CyberTrooperVisor } from "@/components/ui/cyber-trooper"
import { CourierDroid, type CourierDroidCargo , type CourierDroidBehavior} from "@/components/ui/courier-droid"
import { CustodianDroid, type CustodianDroidBehavior } from "@/components/ui/custodian-droid"
import { GuideDroid, type GuideDroidBehavior, type GuideDroidLimbs } from "@/components/ui/guide-droid"
import { RobotHound, type RobotHoundBehavior, type RobotHoundEars, type RobotHoundProbe } from "@/components/ui/robot-hound"
import { MonolithDroid, type MonolithDroidBehavior } from "@/components/ui/monolith-droid"
import { TripodDroid, type TripodBehavior } from "@/components/ui/tripod-droid"
import { ScoutWalker, type ScoutWalkerBehavior, type ScoutWalkerGait } from "@/components/ui/scout-walker"
import { SiegeWalker, type SiegeWalkerBehavior, type SiegeWalkerGait } from "@/components/ui/siege-walker"
import { PylonDroid, type PylonDroidBehavior, type PylonDroidStance } from "@/components/ui/pylon-droid"
import { SentinelConsole, type SentinelBehavior } from "@/components/ui/sentinel-console"
import { InfantryDroid, type InfantryDroidEquipment, type InfantryDroidFrame, type InfantryDroidPose , type InfantryDroidBehavior} from "@/components/ui/infantry-droid"
import { MedicalDroid, type MedicalDroidTool , type MedicalDroidBehavior} from "@/components/ui/medical-droid"
import { MicroDuck, type DuckBehavior } from "@/components/ui/micro-duck"
import { OrbDroid, type OrbDroidBehavior } from "@/components/ui/orb-droid"
import { ProbeDroid , type ProbeDroidBehavior} from "@/components/ui/probe-droid"
import { ProtocolDroid, type ProtocolDroidGesture, type ProtocolDroidPose , type ProtocolDroidBehavior} from "@/components/ui/protocol-droid"
import type { DuckGait } from "@/lib/robocn/duck"
import { ReachyMini, type ReachyBehavior } from "@/components/ui/reachy-mini"
import { AnimatronicFace, type AnimatronicBehavior } from "@/components/ui/animatronic-face"
import { defaultHeadGeometry, solveFace, type FaceExpression } from "@/lib/robocn/face"
import { SecurityDroid, type SecurityDroidBehavior, type SecurityDroidPose } from "@/components/ui/security-droid"
import { UtilityDroid, type UtilityDroidSeries, type UtilityDroidTool , type UtilityDroidBehavior} from "@/components/ui/utility-droid"
import { defaultStewartGeometry, solveStewart } from "@/lib/robocn/stewart"
import { RobotQuadruped, type QuadrupedBehavior } from "@/components/ui/robot-quadruped"
import { RobotBird, type BirdBehavior } from "@/components/ui/robot-bird"
import { RobotCrab, type CrabBehavior } from "@/components/ui/robot-crab"
import { RobotFish, type FishBehavior } from "@/components/ui/robot-fish"
import { RobotSnake, type SnakeBehavior } from "@/components/ui/robot-snake"
import { RobotSpider, type SpiderBehavior } from "@/components/ui/robot-spider"
import { RobotAnt, type AntBehavior, type AntCargo } from "@/components/ui/robot-ant"
import { RobotBat, type BatBehavior } from "@/components/ui/robot-bat"
import { RobotDragonfly, type DragonflyBehavior } from "@/components/ui/robot-dragonfly"
import { BallHopper, type BallHopperBehavior } from "@/components/ui/ball-hopper"
import { RobotFrog, type FrogBehavior } from "@/components/ui/robot-frog"
import { SpringHopper, type SpringHopperBehavior } from "@/components/ui/spring-hopper"
import { RobotCat, type CatBehavior } from "@/components/ui/robot-cat"
import { RobotDog, type DogBehavior } from "@/components/ui/robot-dog"
import { RobotFox, type FoxBehavior } from "@/components/ui/robot-fox"
import { RobotBear, type BearBehavior } from "@/components/ui/robot-bear"
import { RobotPolarBear, type PolarBearBehavior } from "@/components/ui/robot-polar-bear"
import { RobotPanda, type PandaBehavior } from "@/components/ui/robot-panda"
import { RobotHorse, type HorseBehavior } from "@/components/ui/robot-horse"
import { RobotCamel, type CamelBehavior } from "@/components/ui/robot-camel"
import { RobotPegasus, type PegasusBehavior } from "@/components/ui/robot-pegasus"
import type { EquineGait, GaitLead } from "@/lib/robocn/gait"
import { RobotInchworm, type InchwormBehavior } from "@/components/ui/robot-inchworm"
import { RobotJellyfish, type JellyfishBehavior } from "@/components/ui/robot-jellyfish"
import { RobotManta, type MantaBehavior } from "@/components/ui/robot-manta"
import { RobotMantis, type MantisBehavior } from "@/components/ui/robot-mantis"
import { RobotOctopus, type OctopusBehavior } from "@/components/ui/robot-octopus"
import { RobotScorpion, type ScorpionBehavior } from "@/components/ui/robot-scorpion"
import { RobotSeahorse, type SeahorseBehavior } from "@/components/ui/robot-seahorse"
import { RobotTurtle, type TurtleBehavior } from "@/components/ui/robot-turtle"
import type { HexapodGait } from "@/lib/robocn/hexapod"
import type { QuadrupedGait } from "@/lib/robocn/quadruped"
import { LinearActuator, type ActuatorBehavior } from "@/components/ui/linear-actuator"
import { ServoMotor, type ServoBehavior, type ServoHorn } from "@/components/ui/servo-motor"
import { RadialBloom, type BloomBehavior } from "@/components/ui/radial-bloom"
import { SolenoidValve, type SolenoidValveBehavior } from "@/components/ui/solenoid-valve"
import { ElectromagneticRelay, type ElectromagneticRelayBehavior } from "@/components/ui/electromagnetic-relay"
import { InductionMotor, type InductionMotorBehavior } from "@/components/ui/induction-motor"
import { StepperMotor, type StepperMotorBehavior } from "@/components/ui/stepper-motor"
import { VoiceCoilActuator, type VoiceCoilBehavior } from "@/components/ui/voice-coil-actuator"
import { MagneticBearing, type MagneticBearingBehavior } from "@/components/ui/magnetic-bearing"
import { EddyCurrentBrake, type EddyCurrentBrakeBehavior } from "@/components/ui/eddy-current-brake"
import { MaglevCarriage, type MaglevCarriageBehavior, type MaglevPayload } from "@/components/ui/maglev-carriage"
import { MagneticGripper, type MagneticGripperBehavior, type MagneticWorkpiece } from "@/components/ui/magnetic-gripper"
import { InductiveSensor, type InductiveSensorBehavior, type InductiveTarget } from "@/components/ui/inductive-sensor"
import { Resolver, type ResolverBehavior } from "@/components/ui/resolver"
import { TransformerCore, type TransformerBehavior, type TransformerCoreShape, type TransformerTurns } from "@/components/ui/transformer-core"
import { RotaryTable, type RotaryBehavior } from "@/components/ui/rotary-table"
import { RobotRover, type RoverBehavior } from "@/components/ui/robot-rover"
import { RobotDrone, type DroneBehavior } from "@/components/ui/robot-drone"
import { LidarScan, type LidarBehavior, type LidarSample } from "@/components/ui/lidar-scan"

import { ClamshellLaptop, type LaptopBehavior, type LaptopScreen } from "@/components/ui/clamshell-laptop"
import { SlateTablet, type TabletBehavior, type TabletScreen } from "@/components/ui/slate-tablet"
import { WheelPlayer, type PlayerBehavior, type PlayerScreen } from "@/components/ui/wheel-player"
import { TurntableDeck, type DeckRpm, type TurntableBehavior, type TurntableCue } from "@/components/ui/turntable-deck"
import { GramophoneHorn, type GramophoneBehavior } from "@/components/ui/gramophone-horn"
import { MusicBoxDrum, type MusicBoxBehavior } from "@/components/ui/music-box-drum"
import {
  RobotGrandPiano,
  type GrandPianoBehavior,
  type GrandPianoPedal,
} from "@/components/ui/robot-grand-piano"
import { BuskerDroid, type BuskerBehavior } from "@/components/ui/busker-droid"
import { SlabHandset, type HandsetBehavior, type HandsetOrientation, type HandsetScreen } from "@/components/ui/slab-handset"
import { FoldingHandset, type FoldBehavior, type FoldCover, type FoldScreen } from "@/components/ui/folding-handset"
import { WristTerminal, type TerminalBehavior, type TerminalScreen } from "@/components/ui/wrist-terminal"
import { KeySwitch, type KeySwitchAction, type KeySwitchBehavior } from "@/components/ui/key-switch"
import { RobotKeypad, type KeypadBehavior, type KeypadOutcome } from "@/components/ui/robot-keypad"
import { RobotKeyboard, type KeyboardBehavior, type KeyboardLayoutName, type KeycapSculpt } from "@/components/ui/robot-keyboard"
import { InputTerminal, type InputTerminalBehavior, type InputTerminalScreen } from "@/components/ui/input-terminal"
import { ArmFabricator } from "@/components/ui/arm-fabricator"
import { DroneFabricator } from "@/components/ui/drone-fabricator"
import { Fabricator } from "@/components/ui/fabricator"
import { VoxelForm } from "@/components/ui/voxel-form"
import type { VoxelBehavior, VoxelShape } from "@/lib/robocn/voxel"

import { RobotSunflower, type SunflowerBehavior } from "@/components/ui/robot-sunflower"
import { RobotCactus, cactusArmPose, type CactusBehavior } from "@/components/ui/robot-cactus"
import { CelestialPlanet, type PlanetBehavior, type PlanetSurface } from "@/components/ui/celestial-planet"
import { CelestialMoon, type MoonBehavior } from "@/components/ui/celestial-moon"
import { CelestialStar, type StarBehavior, type StarClass } from "@/components/ui/celestial-star"
import { CelestialAsteroid, type AsteroidBehavior, type AsteroidBody } from "@/components/ui/celestial-asteroid"
import { Orrery, type OrreryBehavior } from "@/components/ui/orrery"
import { BattleStation, type StationBehavior } from "@/components/ui/battle-station"
import { DebrisField, type DebrisBehavior } from "@/components/ui/debris-field"
import { RobotGripper, type GripperBehavior } from "@/components/ui/robot-gripper"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"

import { ArmControls } from "@/components/ui/arm-controls"
import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotFace, type FaceBehavior, type RobotMood } from "@/components/ui/robot-face"
import { RobotLoader } from "@/components/ui/robot-loader"
import { RobotStage } from "@/components/ui/robot-stage"
import { ScaraArm } from "@/components/ui/scara-arm"
import { PlanetaryGearbox, type GearboxBehavior } from "@/components/ui/planetary-gearbox"
import { BeltDrive, type BeltDriveBehavior } from "@/components/ui/belt-drive"
import { CableCarrier, type CableCarrierBehavior } from "@/components/ui/cable-carrier"
import { MecanumWheel, type MecanumBehavior, type MecanumHand } from "@/components/ui/mecanum-wheel"
import { ToolChanger, type ToolChangerBehavior, type ToolChangerTool } from "@/components/ui/tool-changer"
import { SuctionGripper, type SuctionBehavior } from "@/components/ui/suction-gripper"
import { RobotHand, type HandBehavior, type HandGrasp } from "@/components/ui/robot-hand"
import { RobotFoot, type FootBehavior } from "@/components/ui/robot-foot"
import { RobotLeg, type LegBehavior } from "@/components/ui/robot-leg"
import { RobotTorso, type TorsoBehavior } from "@/components/ui/robot-torso"
import { RobotSkeleton, type SkeletonBehavior } from "@/components/ui/robot-skeleton"
import type { SkeletonGait } from "@/lib/robocn/skeleton"
import { MotionPlatform, type MotionPlatformBehavior, type MotionPlatformPayload } from "@/components/ui/motion-platform"
import { Pumpjack, type PumpjackBalance, type PumpjackBehavior } from "@/components/ui/pumpjack"
import { DrillingDerrick, type DerrickBehavior, type DerrickLines } from "@/components/ui/drilling-derrick"
import { MudPump, type MudPumpBehavior, type MudPumpCylinders } from "@/components/ui/mud-pump"
import { WellheadTree, type WellheadBehavior, type WellheadService } from "@/components/ui/wellhead-tree"
import { StorageTank, type StorageTankBehavior, type StorageTankRoof } from "@/components/ui/storage-tank"
import { OilTanker, type OilTankerBehavior } from "@/components/ui/oil-tanker"
import { TankerTruck, tankerTruckLevel, type TankerTruckBehavior } from "@/components/ui/tanker-truck"
import { FlareStack, type FlareStackBehavior } from "@/components/ui/flare-stack"
import { FractionatingColumn, type ColumnBehavior } from "@/components/ui/fractionating-column"
import { JackupRig, type JackupBehavior } from "@/components/ui/jackup-rig"
import { RobotCar, type CarBehavior } from "@/components/ui/robot-car"
import { TransitBus, type TransitBusBehavior } from "@/components/ui/transit-bus"
import { RailLocomotive, type RailLocomotiveBehavior, type RailLocomotivePantograph } from "@/components/ui/rail-locomotive"
import { RailBogie, type RailBogieBehavior } from "@/components/ui/rail-bogie"
import { PantographCollector, type PantographBehavior } from "@/components/ui/pantograph-collector"
import { RailTurnout, type RailTurnoutBehavior } from "@/components/ui/rail-turnout"
import { bladePose, bogieRide, curveRadius, klingelWavelength, turnoutGeometry } from "@/lib/robocn/rail"
import { CargoPlane, type CargoPlaneBehavior } from "@/components/ui/cargo-plane"
import { HydrofoilCraft, type HydrofoilBehavior } from "@/components/ui/hydrofoil-craft"
import { LaunchVehicle, type LaunchVehicleBehavior } from "@/components/ui/launch-vehicle"
import { StrikeStarfighter, type StarfighterBehavior } from "@/components/ui/strike-starfighter"
import { IonInterceptor, type InterceptorBehavior } from "@/components/ui/ion-interceptor"
import {
  ackermann,
  coordinatedBank,
  foilRise,
  hitchAngle,
  pitchProgram,
  stackDeltaV,
} from "@/lib/robocn/vehicle"
import { GabledHouse, type GabledHouseBehavior } from "@/components/ui/gabled-house"
import { TowerBlock, type TowerBlockBehavior, type TowerBlockCrown } from "@/components/ui/tower-block"
import { EspressoMachine, type EspressoBehavior } from "@/components/ui/espresso-machine"
import { Refrigerator, type RefrigeratorBehavior, type RefrigeratorLayout } from "@/components/ui/refrigerator"
import { WashingMachine, type WashingBehavior, type WashingLoading } from "@/components/ui/washing-machine"
import { galleryEntries } from "@/components/site/gallery.generated"
import { Segmented } from "@/components/site/segmented"
import { BallLauncher, type LauncherBehavior } from "@/components/ui/ball-launcher"
import { BlockingSled, type SledBehavior } from "@/components/ui/blocking-sled"
import { GridironKicker, type KickStyle, type KickerBehavior } from "@/components/ui/gridiron-kicker"
import { GridironLineman, type LinemanBehavior } from "@/components/ui/gridiron-lineman"
import { GridironQuarterback, type QuarterbackBehavior } from "@/components/ui/gridiron-quarterback"
import { GridironReceiver, type ReceiverBehavior } from "@/components/ui/gridiron-receiver"
import { RobotFootball, type FootballBehavior } from "@/components/ui/robot-football"
import { routeNames, type FacemaskStyle, type GridironStance, type RouteName } from "@/lib/robocn/gridiron"
import { Slider } from "@/components/ui/slider"
import { oklchToHex } from "@/lib/robocn/color"
import {
  chainAngles2,
  chainReach,
  solveChain2,
  type Vec2,
} from "@/lib/robocn/kinematics"
import { dropTimings, hopTimings } from "@/lib/robocn/hopper"
import type {
  RobotBehavior,
  RobotMount,
  RobotTool,
  RobotVariant,
  RobotView,
} from "@/lib/robocn/style"

const variants: RobotVariant[] = ["solid", "outline", "blueprint", "wire"]
const views: RobotView[] = ["plan", "front", "profile", "iso"]
const GRASPS = ["open", "pinch", "tripod", "power", "hook", "point", "lateral"] as const
const behaviors: RobotBehavior[] = ["idle", "pointer", "orbit", "sweep", "static"]
const tools: RobotTool[] = [
  "gripper",
  "welder",
  "painter",
  "cutter",
  "scanner",
  "vacuum",
  "magnet",
  "none",
]
const mounts: RobotMount[] = ["floor", "ceiling", "wall-left", "wall-right"]
const swatches = ["default", "violet", "lime", "steel", "rose"] as const

const swatchPalette: Record<
  (typeof swatches)[number],
  { color?: string; accent?: string }
> = {
  default: {},
  violet: { color: "oklch(0.58 0.2 292)", accent: "oklch(0.83 0.16 92)" },
  lime: { color: "oklch(0.78 0.17 128)", accent: "oklch(0.55 0.2 27)" },
  steel: { color: "oklch(0.62 0.03 250)", accent: "oklch(0.75 0.14 220)" },
  rose: { color: "oklch(0.65 0.2 15)", accent: "oklch(0.85 0.14 195)" },
}

/** Shared chrome: the machine on the left, the axes you can change on the right. */
function Bench({
  children,
  controls,
}: {
  children: React.ReactNode
  controls?: React.ReactNode
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
      <div className="flex min-h-72 items-center justify-center overflow-hidden p-4">
        {children}
      </div>
      {controls ? (
        <div className="flex flex-col gap-2.5 border-t border-border p-4 md:w-64 md:border-t-0 md:border-l">
          {controls}
        </div>
      ) : null}
    </div>
  )
}

/** A line of instruction under the controls: what to try with the pointer. */
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>
}

function Readout({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-[11px]">
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right tabular-nums">{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) =>
          onChange(Array.isArray(next) ? next[0] : (next as number))
        }
        aria-label={label}
        className="flex-1"
      />
      <span className="w-10 text-right font-mono text-[11px] tabular-nums">
        {format ? format(value) : value}
      </span>
    </div>
  )
}

function RobotArmDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [tool, setTool] = React.useState<RobotTool>("welder")
  const [behavior, setBehavior] = React.useState<RobotBehavior>("pointer")
  const [mount, setMount] = React.useState<RobotMount>("floor")
  const [swatch, setSwatch] = React.useState<(typeof swatches)[number]>("default")
  const [links, setLinks] = React.useState(3)

  const shape = [1, 0.82, 0.34, 0.28, 0.24].slice(0, links)

  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented label="tool" value={tool} options={tools} onChange={setTool} />
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <Segmented label="mount" value={mount} options={mounts} onChange={setMount} />
          <Segmented label="colour" value={swatch} options={swatches} onChange={setSwatch} />
          <NumberControl label="links" value={links} min={1} max={5} onChange={setLinks} />
          <Hint>
            Press and drag inside the frame to drive the tip yourself; let go and the arm
            picks its motion back up. That press is also how a touch screen reaches it.
          </Hint>
        </>
      }
    >
      <RobotArm
        view={view}
        key={mount}
        links={shape}
        variant={variant}
        tool={tool}
        behavior={behavior}
        mount={mount}
        size={380}
        interactive
        showEnvelope={variant !== "solid"}
        label="RC-01"
        {...swatchPalette[swatch]}
      />
    </Bench>
  )
}

function RobotArm3DDemo() {
  const [tool, setTool] = React.useState<RobotTool>("welder")
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [links, setLinks] = React.useState(3)
  const [wireframe, setWireframe] = React.useState<"off" | "on">("off")

  return (
    <Bench
      controls={
        <>
          <Segmented label="tool" value={tool} options={tools} onChange={setTool} />
          <Segmented
            label="motion"
            value={behavior}
            options={["idle", "orbit", "sweep", "pointer", "static"] as const}
            onChange={(next) => setBehavior(next as RobotBehavior)}
          />
          <Segmented
            label="wire"
            value={wireframe}
            options={["off", "on"] as const}
            onChange={setWireframe}
          />
          <NumberControl label="links" value={links} min={2} max={5} onChange={setLinks} />
          <p className="text-[11px] text-muted-foreground">
            Drag to orbit the camera.
          </p>
        </>
      }
    >
      <RobotStage className="h-80 w-full" floor="grid">
        <RobotArm3D
          interactive
          links={[1, 0.82, 0.34, 0.3, 0.26].slice(0, links)}
          tool={tool}
          behavior={behavior}
          wireframe={wireframe === "on"}
        />
      </RobotStage>
    </Bench>
  )
}

function RobotStageDemo() {
  const [floor, setFloor] = React.useState<"grid" | "shadow" | "none">("shadow")
  const [rotate, setRotate] = React.useState<"off" | "on">("on")

  return (
    <Bench
      controls={
        <>
          <Segmented
            label="floor"
            value={floor}
            options={["grid", "shadow", "none"] as const}
            onChange={setFloor}
          />
          <Segmented
            label="rotate"
            value={rotate}
            options={["off", "on"] as const}
            onChange={setRotate}
          />
          <Hint>
            Auto-rotation stops while the pointer is over the stage. Press the floor
            and the arm reaches for that spot; drag anywhere else to orbit.
          </Hint>
        </>
      }
    >
      <RobotStage className="h-80 w-full" floor={floor} autoRotate={rotate === "on"}>
        <RobotArm3D behavior="idle" tool="gripper" interactive />
      </RobotStage>
    </Bench>
  )
}

function ScaraArmDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [z, setZ] = React.useState(0.35)
  const [tool, setTool] = React.useState<RobotTool>("vacuum")
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")

  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="tool"
            value={tool}
            options={["vacuum", "gripper", "scanner", "none"] as const}
            onChange={(next) => setTool(next as RobotTool)}
          />
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <NumberControl
            label="z"
            value={z}
            min={0}
            max={1}
            step={0.01}
            onChange={setZ}
            format={(value) => `${Math.round(value * 100)}%`}
          />
        </>
      }
    >
      <ScaraArm
        view={view}
        interactive
        size={360}
        z={z}
        tool={tool}
        behavior={behavior}
        variant={variant}
        label="SCARA / 02"
      />
    </Bench>
  )
}

function DeltaArmDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [spin, setSpin] = React.useState(32)
  const [tilt, setTilt] = React.useState(0.45)
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [upper, setUpper] = React.useState(17)

  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented
            label="motion"
            value={behavior}
            options={["orbit", "sweep", "idle", "pointer", "static"] as const}
            onChange={(next) => setBehavior(next as RobotBehavior)}
          />
          <NumberControl label="spin" value={spin} min={0} max={90} onChange={setSpin} />
          <NumberControl
            label="tilt"
            value={tilt}
            min={0.1}
            max={0.9}
            step={0.01}
            onChange={setTilt}
            format={(value) => value.toFixed(2)}
          />
          <NumberControl label="bicep" value={upper} min={10} max={30} onChange={setUpper} />
        </>
      }
    >
      <DeltaArm
        view={view}
        interactive
        size={360}
        spin={spin}
        tilt={tilt}
        behavior={behavior}
        geometry={{ upper }}
        showTarget
      />
    </Bench>
  )
}

function GantryArmDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [behavior, setBehavior] = React.useState<RobotBehavior>("sweep")
  const [trail, setTrail] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")

  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <Segmented label="trail" value={trail} options={["on", "off"] as const} onChange={setTrail} />
        </>
      }
    >
      <GantryArm
        view={view}
        interactive
        size={380}
        behavior={behavior}
        variant={variant}
        trail={trail === "on"}
        label="GANTRY / 03"
      />
    </Bench>
  )
}

function RobotFaceDemo() {
  const [mood, setMood] = React.useState<RobotMood>("curious")
  const [track, setTrack] = React.useState<"on" | "off">("on")
  const [idle, setIdle] = React.useState<FaceBehavior>("wander")

  return (
    <Bench
      controls={
        <>
          <Segmented
            label="mood"
            value={mood}
            options={
              ["idle", "happy", "curious", "focused", "error", "sleeping"] as const
            }
            onChange={(next) => setMood(next as RobotMood)}
          />
          <Segmented label="track" value={track} options={["on", "off"] as const} onChange={setTrack} />
          <Segmented label="idle" value={idle} options={["wander", "scan", "still"] as const} onChange={setIdle} />
          <Hint>
            The eyes follow your pointer anywhere on the page — and wander on their own
            when it is away. Poke the face and it flinches.
          </Hint>
        </>
      }
    >
      <RobotFace mood={mood} track={track === "on"} behavior={idle} size={240} label="RC-01" />
    </Bench>
  )
}

function RobotLoaderDemo() {
  const [mode, setMode] = React.useState<"indeterminate" | "value">("indeterminate")
  const [value, setValue] = React.useState(45)
  const [hover, setHover] = React.useState<"run" | "pause">("pause")

  return (
    <Bench
      controls={
        <>
          <Segmented
            label="mode"
            value={mode}
            options={["indeterminate", "value"] as const}
            onChange={setMode}
          />
          {mode === "value" ? (
            <NumberControl
              label="value"
              value={value}
              min={0}
              max={100}
              onChange={setValue}
              format={(next) => `${next}%`}
            />
          ) : null}
          <Segmented
            label="on hover"
            value={hover}
            options={["pause", "run"] as const}
            onChange={setHover}
          />
          <Hint>Hold the pointer over the cell to stop it mid-cycle.</Hint>
        </>
      }
    >
      <RobotLoader
        size={360}
        value={mode === "value" ? value : undefined}
        pauseOnHover={hover === "pause"}
        label={mode === "value" ? `${value}%` : "Working"}
      />
    </Bench>
  )
}

function ArmControlsDemo() {
  const home = [64, -72, -26]
  const [angles, setAngles] = React.useState(home)
  const [tool, setTool] = React.useState<RobotTool>("gripper")
  const links = [30, 24, 10]
  const tip = React.useMemo(() => {
    const joints = solveChain2({ x: 0, y: 13 }, { x: 0, y: 0 }, links)
    return joints
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid gap-6 p-4 md:grid-cols-[1fr_19rem] md:items-center">
      <div className="flex justify-center">
        <RobotArm angles={angles} tool={tool} size={300} showAngles label="RC-01" />
      </div>
      <ArmControls
        className="max-w-none"
        angles={angles}
        onAnglesChange={setAngles}
        tool={tool}
        onToolChange={setTool}
        onReset={() => setAngles(home)}
        playable
        limits={[
          [0, 180],
          [-150, 20],
          [-120, 120],
        ]}
        readouts={[{ label: "joints", value: String(tip.length - 1) }]}
        description="Forward kinematics: each slider is a joint. Run drives them for you; touching one stops it."
      />
    </div>
  )
}

function ResolverDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<ResolverBehavior>("turn"); const [channels, setChannels] = React.useState<"on" | "off">("on")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["turn", "sweep", "static"]} onChange={setBehavior} /><Segmented label="channels" value={channels} options={["on", "off"]} onChange={setChannels} /><Hint>Wind the transformer rotor; the bars below are ideal sine and cosine channels.</Hint></>}><Resolver size={340} view={view} variant={variant} behavior={behavior} showChannels={channels === "on"} interactive label="RS-01" /></Bench>
}

function TransformerCoreDemo() {
  const [view, setView] = React.useState<RobotView>("iso"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<TransformerBehavior>("alternate"); const [core, setCore] = React.useState<TransformerCoreShape>("ei"); const [turns, setTurns] = React.useState<TransformerTurns>("step-down")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["alternate", "pulse", "static"]} onChange={setBehavior} /><Segmented label="core" value={core} options={["ei", "toroid"]} onChange={setCore} /><Segmented label="ratio" value={turns} options={["step-down", "equal", "step-up"]} onChange={setTurns} /><Hint>Scrub electrical phase to reverse the qualitative flux arrow; winding density shows the selected ratio.</Hint></>}><TransformerCore size={360} view={view} variant={variant} behavior={behavior} core={core} turns={turns} interactive label="TX-01" /></Bench>
}

function MagneticGripperDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<MagneticGripperBehavior>("pick"); const [workpiece, setWorkpiece] = React.useState<MagneticWorkpiece>("plate")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["pick", "hold", "static"]} onChange={setBehavior} /><Segmented label="part" value={workpiece} options={["plate", "bar", "none"]} onChange={setWorkpiece} /><Hint>Drag through field strength; the workpiece stays parked until the pole shoes capture it.</Hint></>}><MagneticGripper size={340} view={view} variant={variant} behavior={behavior} workpiece={workpiece} interactive label="MAG-02" /></Bench>
}

function InductiveSensorDemo() {
  const [view, setView] = React.useState<RobotView>("profile"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<InductiveSensorBehavior>("approach"); const [target, setTarget] = React.useState<InductiveTarget>("tooth")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["approach", "inspect", "static"]} onChange={setBehavior} /><Segmented label="target" value={target} options={["plate", "tooth", "none"]} onChange={setTarget} /><Hint>Drag the target through the lobe. Choosing none always reports clear.</Hint></>}><InductiveSensor size={370} view={view} variant={variant} behavior={behavior} target={target} interactive label="IS-18" /></Bench>
}

function EddyCurrentBrakeDemo() {
  const [view, setView] = React.useState<RobotView>("iso"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<EddyCurrentBrakeBehavior>("brake"); const [slots, setSlots] = React.useState<"0" | "6" | "12">("6")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["brake", "feather", "static"]} onChange={setBehavior} /><Segmented label="slots" value={slots} options={["0", "6", "12"]} onChange={setSlots} /><Hint>Drag the magnet array across the spinning disc; the marks identify the overlap without claiming torque or heat.</Hint></>}><EddyCurrentBrake size={340} view={view} variant={variant} behavior={behavior} slots={Number(slots) as 0 | 6 | 12} interactive label="ECB-06" /></Bench>
}

function MaglevCarriageDemo() {
  const [view, setView] = React.useState<RobotView>("profile"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<MaglevCarriageBehavior>("shuttle"); const [payload, setPayload] = React.useState<MaglevPayload>("bin")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["shuttle", "hover", "static"]} onChange={setBehavior} /><Segmented label="payload" value={payload} options={["deck", "bin", "robot"]} onChange={setPayload} /><Hint>Drag the payload along the segmented stator; the air gap stays fixed.</Hint></>}><MaglevCarriage size={390} view={view} variant={variant} behavior={behavior} payload={payload} interactive label="ML-01" /></Bench>
}

function VoiceCoilActuatorDemo() {
  const [view, setView] = React.useState<RobotView>("profile"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<VoiceCoilBehavior>("oscillate"); const [travel, setTravel] = React.useState(42)
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["oscillate", "pulse", "static"]} onChange={setBehavior} /><NumberControl label="travel" value={travel} min={20} max={60} onChange={setTravel} /><Hint>Drag the carriage through the fixed annular gap; arrow keys move it in tenths.</Hint></>}><VoiceCoilActuator size={360} view={view} variant={variant} behavior={behavior} travel={travel} interactive label="VC-42" /></Bench>
}

function MagneticBearingDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<MagneticBearingBehavior>("balance"); const [axis, setAxis] = React.useState<"x" | "y">("x")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["balance", "disturb", "static"]} onChange={setBehavior} /><Segmented label="axis" value={axis} options={["x", "y"]} onChange={setAxis} /><Hint>Displace the rotor and watch the opposing coils exchange correction emphasis.</Hint></>}><MagneticBearing size={340} view={view} variant={variant} behavior={behavior} axis={axis} interactive label="MB-04" /></Bench>
}

function InductionMotorDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<InductionMotorBehavior>("slip")
  const [poles, setPoles] = React.useState<"2" | "4" | "6">("4")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["run", "slip", "static"]} onChange={setBehavior} /><Segmented label="poles" value={poles} options={["2", "4", "6"]} onChange={setPoles} /><Hint>Wind the squirrel cage directly; the field marker shows the ideal three-phase resultant.</Hint></>}><InductionMotor size={340} view={view} variant={variant} behavior={behavior} poles={Number(poles) as 2 | 4 | 6} interactive label="IM-3Φ" /></Bench>
}

function StepperMotorDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<StepperMotorBehavior>("step")
  const [steps, setSteps] = React.useState<"4" | "6" | "8" | "12">("8")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["step", "run", "static"]} onChange={setBehavior} /><Segmented label="steps" value={steps} options={["4", "6", "8", "12"]} onChange={setSteps} /><Hint>Drag around the hub or use arrow keys; the rotor always lands on an integer tooth index.</Hint></>}><StepperMotor size={340} view={view} variant={variant} behavior={behavior} steps={Number(steps) as 4 | 6 | 8 | 12} interactive label="STP-08" /></Bench>
}

function SolenoidValveDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<SolenoidValveBehavior>("cycle")
  const [ports, setPorts] = React.useState<"2" | "3">("3")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["cycle", "pulse", "static"]} onChange={setBehavior} /><Segmented label="ports" value={ports} options={["2", "3"]} onChange={setPorts} /><Hint>Drag the plunger or use the arrow keys; release it and the valve returns to its duty cycle.</Hint></>}><SolenoidValve size={360} view={view} variant={variant} behavior={behavior} ports={Number(ports) as 2 | 3} interactive label="SV-24" /></Bench>
}

function ElectromagneticRelayDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<ElectromagneticRelayBehavior>("switch")
  const [poles, setPoles] = React.useState<"1" | "2">("2")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["switch", "pulse", "static"]} onChange={setBehavior} /><Segmented label="poles" value={poles} options={["1", "2"]} onChange={setPoles} /><Hint>Drag, arrow-key, or press Enter to pull the armature and watch both contacts switch.</Hint></>}><ElectromagneticRelay size={360} view={view} variant={variant} behavior={behavior} poles={Number(poles) as 1 | 2} interactive label="K1" /></Bench>
}

function KinematicsDemo() {
  const [count, setCount] = React.useState(4)
  const links = React.useMemo(
    () => Array.from({ length: count }, (_, i) => 34 - i * 5),
    [count],
  )
  const [target, setTarget] = React.useState<Vec2>({ x: 30, y: 40 })
  const joints = solveChain2({ x: 0, y: 0 }, target, links)
  const angles = chainAngles2(joints)

  return (
    <Bench
      controls={
        <>
          <NumberControl label="links" value={count} min={1} max={6} onChange={setCount} />
          <NumberControl
            label="x"
            value={target.x}
            min={-70}
            max={70}
            onChange={(x) => setTarget((current) => ({ ...current, x }))}
          />
          <NumberControl
            label="y"
            value={target.y}
            min={-20}
            max={80}
            onChange={(y) => setTarget((current) => ({ ...current, y }))}
          />
          <Readout
            rows={[
              ["reach", chainReach(links).toFixed(0)],
              ["angles", angles.map((angle) => angle.toFixed(0)).join(" ")],
            ]}
          />
        </>
      }
    >
      <svg viewBox="-80 -20 160 110" width={320} height={220} className="overflow-visible">
        <g transform="scale(1 -1) translate(0 -80)">
          <circle cx={0} cy={0} r={chainReach(links)} fill="none" stroke="var(--datum)" strokeDasharray="2 2" />
          <polyline
            points={joints.map((joint) => `${joint.x},${joint.y}`).join(" ")}
            fill="none"
            stroke="var(--robot-shell)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {joints.map((joint, index) => (
            <circle
              key={index}
              cx={joint.x}
              cy={joint.y}
              r={2.4}
              fill={index === joints.length - 1 ? "var(--robot-accent)" : "var(--robot-dark)"}
            />
          ))}
          <circle cx={target.x} cy={target.y} r={4} fill="none" stroke="var(--robot-accent)" strokeDasharray="1.5 1.5" />
        </g>
      </svg>
    </Bench>
  )
}

function StyleDemo() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-col items-center gap-2">
          <RobotArm variant={variant} size={150} behavior="static" showEnvelope />
          <span className="font-mono text-[11px] text-muted-foreground">{variant}</span>
        </div>
      ))}
    </div>
  )
}

function ColorDemo() {
  const values = [
    "oklch(0.72 0.17 47)",
    "oklch(0.74 0.012 250)",
    "oklch(0.32 0.02 250)",
    "oklch(0.72 0.15 176)",
  ]
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2">
      {values.map((value) => {
        const hex = oklchToHex(value)
        return (
          <div key={value} className="flex items-center gap-3 border border-border p-2">
            <span
              className="size-8 shrink-0 border border-border"
              style={{ background: value }}
            />
            <div className="min-w-0 font-mono text-[11px]">
              <div className="truncate">{value}</div>
              <div className="text-muted-foreground">{hex}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UseRobotArmDemo() {
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [pose, setPose] = React.useState<{ tip: Vec2; angles: number[] } | null>(null)
  const onPose = React.useCallback(
    (next: { tip: Vec2; angles: number[] }) => setPose(next),
    [],
  )

  return (
    <Bench
      controls={
        <>
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <Readout
            rows={[
              ["tip x", pose ? pose.tip.x.toFixed(1) : "—"],
              ["tip y", pose ? pose.tip.y.toFixed(1) : "—"],
              [
                "angles",
                pose ? pose.angles.map((angle) => angle.toFixed(0)).join(" ") : "—",
              ],
            ]}
          />
        </>
      }
    >
      <RobotArm size={360} behavior={behavior} onPose={onPose} tool="scanner" />
    </Bench>
  )
}

function UsePointerTargetDemo() {
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <RobotArm size={320} behavior="pointer" tool="scanner" showAngles showEnvelope />
      <p className="text-[13px] text-muted-foreground">
        Move the pointer over the panel. Leave it and the arm falls back to its
        rest pose.
      </p>
    </div>
  )
}


function RobotGripperDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [opening, setOpening] = React.useState(0.5)
  const [drive, setDrive] = React.useState<GripperBehavior | "manual">("cycle")
  const [fingers, setFingers] = React.useState<"parallel" | "angular">("parallel")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [active, setActive] = React.useState<"off" | "on">("on")
  return <Bench controls={<>
    <Segmented label="view" value={view} options={views} onChange={setView} />
    <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
    <Segmented label="drive" value={drive} options={["cycle", "flex", "static", "manual"] as const} onChange={setDrive} />
    <Segmented label="fingers" value={fingers} options={["parallel", "angular"] as const} onChange={setFingers} />
    <Segmented label="active" value={active} options={["off", "on"] as const} onChange={setActive} />
    {drive === "manual" ? <NumberControl label="opening" value={opening} min={0} max={1} step={0.01} onChange={setOpening} format={value => `${Math.round(value * 100)}%`} /> : null}
    <Hint>Drag a jaw or tap the drawing — it yields while you hold it, then picks the cycle back up.</Hint>
  </>}><RobotGripper view={view} size={320} {...(drive === "manual" ? { opening } : { behavior: drive })}
    interactive onOpeningChange={setOpening} fingers={fingers} variant={variant} active={active === "on"} /></Bench>
}

function ConveyorBeltDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [position, setPosition] = React.useState(0.25)
  const [drive, setDrive] = React.useState<"running" | "manual">("running")
  const [parts, setParts] = React.useState(3)
  const [direction, setDirection] = React.useState<"left" | "right">("right")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return <Bench controls={<>
    <Segmented label="view" value={view} options={views} onChange={setView} />
    <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
    <Segmented label="direction" value={direction} options={["left", "right"] as const} onChange={setDirection} />
    <Segmented label="drive" value={drive} options={["running", "manual"] as const} onChange={setDrive} />
    {drive === "manual" ? <NumberControl label="travel" value={position} min={-1} max={1} step={0.01} onChange={setPosition} format={value => `${value.toFixed(2)} rev`} /> : null}
    <NumberControl label="parts" value={parts} min={0} max={12} onChange={setParts} />
    <Hint>Drag the belt to scrub the line; the part under your finger stays under it.</Hint>
  </>}><ConveyorBelt view={view} size={420} {...(drive === "manual" ? { position } : null)} interactive onPositionChange={setPosition}
    parts={parts} direction={direction} variant={variant} label="FEED / 05" /></Bench>
}

function RobotRoverDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<RoverBehavior | "manual">("patrol")
  const [heading, setHeading] = React.useState(25)
  const [steering, setSteering] = React.useState(15)
  const [travel, setTravel] = React.useState(0)
  const [wheels, setWheels] = React.useState<"4" | "6">("6")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="wheels" value={wheels} options={["4", "6"] as const} onChange={setWheels} />
      <Segmented label="drive" value={drive} options={["patrol", "wander", "pointer", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
        <NumberControl label="steer" value={steering} min={-45} max={45} onChange={setSteering} format={value => `${value}°`} />
        <NumberControl label="travel" value={travel} min={0} max={1} step={0.01} onChange={setTravel} format={value => value.toFixed(2)} />
      </> : <Hint>Press anywhere in the frame to send it a bearing. The front wheels steer by how far it still has to turn.</Hint>}
    </>}>
      <RobotRover view={view} size={340} wheels={wheels === "4" ? 4 : 6} variant={variant} label="ROVER / 06"
        {...(drive === "manual"
          ? { heading, steering, wheelTravel: travel, active: true }
          : { behavior: drive })}
        interactive onHeadingChange={setHeading} />
    </Bench>
  )
}

function RobotDroneDemo() {
  const [drive, setDrive] = React.useState<DroneBehavior | "manual">("hover")
  const [heading, setHeading] = React.useState(0)
  const [angle, setAngle] = React.useState(25)
  const [rotors, setRotors] = React.useState<"4" | "6">("4")
  const [guards, setGuards] = React.useState<"on" | "off">("on")
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="rotors" value={rotors} options={["4", "6"] as const} onChange={setRotors} />
      <Segmented label="guards" value={guards} options={["on", "off"] as const} onChange={setGuards} />
      <Segmented label="drive" value={drive} options={["hover", "orbit", "pointer", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
        <NumberControl label="blades" value={angle} min={0} max={360} onChange={setAngle} format={value => `${value}°`} />
      </> : <Hint>{drive === "pointer" ? "Move the pointer over the frame, or press and drag it." : "Press and drag to fly it yourself; let go and it resumes."}</Hint>}
      <p className="text-[11px] text-muted-foreground">One airframe, four cameras: the same parts are projected, not redrawn.</p>
    </>}>
      <RobotDrone size={340} view={view} rotors={rotors === "4" ? 4 : 6} guards={guards === "on"} variant={variant} interactive label="FLIGHT / 07"
        {...(drive === "manual" ? { heading, rotorAngle: angle, behavior: "static" as const, active: true } : { behavior: drive })} />
    </Bench>
  )
}

// A deterministic rectangular room in metres, with a closer obstacle on one side.
// These are demo data; the installable component never invents sensor returns.
const roomSamples = Array.from({ length: 120 }, (_, i) => {
  const angle = i * 3
  const radians = angle * Math.PI / 180
  const wall = Math.min(7 / Math.max(Math.abs(Math.sin(radians)), 0.001), 5 / Math.max(Math.abs(Math.cos(radians)), 0.001))
  return { angle, distance: angle >= 45 && angle <= 75 ? 3.5 : wall }
})

function LidarScanDemo() {
  const [drive, setDrive] = React.useState<LidarBehavior | "manual">("sweep")
  const [reading, setReading] = React.useState<LidarSample | null>(null)
  const [heading, setHeading] = React.useState(0)
  const [scanAngle, setScanAngle] = React.useState(60)
  const [range, setRange] = React.useState(10)
  const [rays, setRays] = React.useState<"on" | "off">("off")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="rays" value={rays} options={["off", "on"] as const} onChange={setRays} />
      <Segmented label="scan" value={drive} options={["sweep", "pointer", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
      {drive === "manual" ? <NumberControl label="ray" value={scanAngle} min={0} max={360} onChange={setScanAngle} format={value => `${value}°`} /> : null}
      <NumberControl label="range" value={range} min={3} max={15} step={0.5} onChange={setRange} format={value => `${value} m`} />
      <Readout rows={[["return", reading ? `${Math.round(reading.angle)}° · ${reading.distance.toFixed(1)} m` : "—"]]} />
      <p className="text-[11px] text-muted-foreground">Sample data: a 14 × 10 m room and one nearby obstacle. Returns light as the ray passes and fade behind it; hover one to read it off.</p>
    </>}>
      <LidarScan size={340} samples={roomSamples} heading={heading} maxRange={range} showRays={rays === "on"} variant={variant}
        {...(drive === "manual" ? { scanAngle } : { behavior: drive })}
        interactive onSampleHover={setReading} label={`RANGE ${range} m`} />
    </Bench>
  )
}

function RotaryTableDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<RotaryBehavior | "manual">("index")
  const [angle, setAngle] = React.useState(30)
  const [station, setStation] = React.useState(0)
  const [stations, setStations] = React.useState(6)
  const [loaded, setLoaded] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="loaded" value={loaded} options={["on", "off"] as const} onChange={setLoaded} />
      <Segmented label="drive" value={drive} options={["index", "spin", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="stations" value={stations} min={0} max={12} onChange={setStations} />
      {drive === "manual" ? <>
        <NumberControl label="angle" value={angle} min={0} max={360} onChange={setAngle} format={value => `${value}°`} />
        <button type="button" disabled={stations === 0}
          onClick={() => setAngle(current => ((Math.floor(current / (360 / stations) + 1e-9) + 1) * 360 / stations) % 360)}
          className="border border-border px-3 py-2 text-[12px] hover:border-foreground disabled:opacity-40">
          Next station
        </button>
      </> : <Hint>Drag the platter to spin it, or click a fixture to bring it round to the pointer.</Hint>}
      <Readout rows={[["station", String(station)]]} />
    </>}>
      <RotaryTable view={view} size={340} stations={stations} loaded={loaded === "on"} variant={variant} label="INDEX / 08"
        {...(drive === "manual" ? { angle } : { behavior: drive })}
        interactive onStationChange={setStation} />
    </Bench>
  )
}

function LinearActuatorDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<ActuatorBehavior | "manual">("cycle")
  const [extension, setExtension] = React.useState(0.5)
  const [cutaway, setCutaway] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="cutaway" value={cutaway} options={["on", "off"] as const} onChange={setCutaway} />
      <Segmented label="drive" value={drive} options={["cycle", "breathe", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <NumberControl label="stroke" value={extension} min={0} max={1} step={0.01} onChange={setExtension} format={value => `${Math.round(value * 100)}%`} /> : null}
      <Hint>Drag the rod along its stroke, or focus it and use the arrow keys.</Hint>
    </>}>
      <LinearActuator view={view} size={420} cutaway={cutaway === "on"} variant={variant} label="STROKE / 09"
        {...(drive === "manual" ? { extension } : { behavior: drive })}
        interactive onExtensionChange={setExtension} />
    </Bench>
  )
}

/** A twelve-value reading, shown as machined travel rather than as bars. */
const bloomVector = [1, 0.35, 0.82, 0.2, 0.95, 0.5, 0.7, 0.28, 0.9, 0.42, 0.6, 0.75]

function RadialBloomDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<BloomBehavior | "manual" | "vector">("flutter")
  const [rams, setRams] = React.useState(12)
  const [pitch, setPitch] = React.useState(13)
  const [spin, setSpin] = React.useState(0)
  const [extension, setExtension] = React.useState(0.7)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["bloom", "ripple", "index", "flutter", "static", "manual", "vector"] as const} onChange={setDrive} />
      <NumberControl label="rams" value={rams} min={0} max={24} onChange={setRams} />
      <NumberControl label="pitch" value={pitch} min={0} max={40} onChange={setPitch} format={v => `${v}°`} />
      <NumberControl label="spin" value={spin} min={0} max={360} step={5} onChange={setSpin} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="extension" value={extension} min={0} max={1} step={0.02} onChange={setExtension} format={v => `${Math.round(v * 100)}%`} />
        : drive === "vector"
          ? <Hint>Every ram is on its own number. A non-finite reading leaves that ram closed rather than clamping it onto the ring.</Hint>
          : <Hint>Drag out from the hub to pull the array open, or arrow-key it. Let go and it eases back into the behaviour.</Hint>}
    </>}>
      <RadialBloom view={view} size={330} variant={variant} rams={rams} pitch={pitch} spin={spin}
        label="BLOOM / 12R" interactive onExtensionChange={setExtension}
        {...(drive === "manual"
          ? { extension }
          : drive === "vector"
            ? { strokes: bloomVector.slice(0, rams) }
            : { behavior: drive })} />
    </Bench>
  )
}

function ServoMotorDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<ServoBehavior | "manual">("sweep")
  const [angle, setAngle] = React.useState(30)
  const [horn, setHorn] = React.useState<ServoHorn>("double")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="horn" value={horn} options={["single", "double", "cross"] as const} onChange={setHorn} />
      <Segmented label="drive" value={drive} options={["sweep", "step", "hunt", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <NumberControl label="angle" value={angle} min={-180} max={180} onChange={setAngle} format={value => `${value}°`} /> : null}
      <Hint>Drag around the hub to aim the horn. Step shows the slew rate: the goal jumps, the servo does not.</Hint>
    </>}>
      <ServoMotor view={view} size={290} horn={horn} variant={variant} label="SERVO / 10"
        {...(drive === "manual" ? { angle } : { behavior: drive })}
        interactive onAngleChange={setAngle} />
    </Bench>
  )
}

function RobotQuadrupedDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<QuadrupedBehavior | "manual">("trot")
  const [gait, setGait] = React.useState<QuadrupedGait>("trot")
  const [phase, setPhase] = React.useState(0.65)
  const [height, setHeight] = React.useState(0.5)
  const [stride, setStride] = React.useState(0.6)
  const [lift, setLift] = React.useState(0.5)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["walk", "trot", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="gait" value={gait} options={["stand", "walk", "trot"] as const} onChange={setGait} />
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Bring the pointer over it and it gets up; click and it sits down.</Hint>}
      <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="lift" value={lift} min={0} max={1} step={0.01} onChange={setLift} format={value => `${Math.round(value * 100)}%`} />
      <p className="text-[11px] text-muted-foreground">Scrub the cycle to inspect footfall timing. Coloured marks identify feet on the ground.</p>
    </>}>
      <RobotQuadruped view={view} size={420} height={height} stride={stride} lift={lift} variant={variant} showContacts label="QUAD / 11"
        {...(drive === "manual" ? { gait, phase } : { behavior: drive })} />
    </Bench>
  )
}

function MicroDuckDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<DuckBehavior | "manual">("walk")
  const [gait, setGait] = React.useState<DuckGait>("walk")
  const [phase, setPhase] = React.useState(0.3)
  const [height, setHeight] = React.useState(0.55)
  const [gaze, setGaze] = React.useState(0.2)
  const [beak, setBeak] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["walk", "idle", "peck", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="gait" value={gait} options={["stand", "walk", "strut"] as const} onChange={setGait} />
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="gaze" value={gaze} min={-1} max={1} step={0.05} onChange={setGaze} format={value => value.toFixed(2)} />
        <NumberControl label="beak" value={beak} min={0} max={1} step={0.05} onChange={setBeak} format={value => `${Math.round(value * 34)}°`} />
      </> : <Hint>It watches your pointer. Poke it and it quacks — the beak snaps and the head rings down.</Hint>}
      <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <p className="text-[11px] text-muted-foreground">Gaze swings the neck between a peck and a craned-up pose on a constant radius. Coloured marks show the foot carrying weight.</p>
    </>}>
      <MicroDuck view={view} size={300} height={height} variant={variant} showContacts label="DUCK / 12"
        {...(drive === "manual" ? { gait, phase, gaze, beak } : { behavior: drive })} />
    </Bench>
  )
}

function ReachyMiniDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [drive, setDrive] = React.useState<ReachyBehavior | "manual">("idle")
  const [yaw, setYaw] = React.useState(14)
  const [pitch, setPitch] = React.useState(-6)
  const [roll, setRoll] = React.useState(0)
  const [heave, setHeave] = React.useState(0)
  const [travel, setTravel] = React.useState(9)
  const [linkage, setLinkage] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const solution = solveStewart({ yaw, pitch, roll, heave }, { ...defaultStewartGeometry, baseRadius: 24, platformRadius: 18, height: 30, travel })
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="linkage" value={linkage} options={["on", "off"] as const} onChange={setLinkage} />
      <Segmented label="drive" value={drive} options={["idle", "scan", "nod", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="yaw" value={yaw} min={-30} max={30} onChange={setYaw} format={value => `${value}°`} />
        <NumberControl label="pitch" value={pitch} min={-24} max={24} onChange={setPitch} format={value => `${value}°`} />
        <NumberControl label="roll" value={roll} min={-24} max={24} onChange={setRoll} format={value => `${value}°`} />
        <NumberControl label="heave" value={heave} min={-8} max={8} step={0.5} onChange={setHeave} format={value => `${value} u`} />
      </> : <Hint>The head turns to follow your pointer, not just the pupils. Click and it nods.</Hint>}
      <NumberControl label="travel" value={travel} min={2} max={12} step={0.5} onChange={setTravel} format={value => `±${value} u`} />
      <Readout rows={[
        ["longest leg", `${Math.max(...solution.legs.map(leg => leg.length)).toFixed(1)} u`],
        ["max stroke", `${Math.max(...solution.legs.map(leg => Math.abs(leg.stroke))).toFixed(1)} u`],
        ["reachable", solution.reachable ? "yes" : "no"],
      ]} />
      <p className="text-[11px] text-muted-foreground">Six leg lengths come from real Stewart platform IK. Lower the travel until a rod turns accent-coloured and the fault lamp lights.</p>
    </>}>
      <ReachyMini view={view} size={320} geometry={{ travel }} showLinkage={linkage === "on"} variant={variant} label="MINI / 13"
        {...(drive === "manual" ? { yaw, pitch, roll, heave, track: false } : { behavior: drive })} />
    </Bench>
  )
}

const expressions: FaceExpression[] = ["neutral", "joy", "surprise", "sorrow", "anger", "fear", "disgust", "doubt", "sleep"]

function AnimatronicFaceDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<AnimatronicBehavior | "manual">("emote")
  const [expression, setExpression] = React.useState<FaceExpression>("doubt")
  const [intensity, setIntensity] = React.useState(0.85)
  const [speech, setSpeech] = React.useState(0)
  const [jaw, setJaw] = React.useState(0)
  const [travel, setTravel] = React.useState(6)
  const [rods, setRods] = React.useState<"on" | "off">("off")
  const manual = drive === "manual"
  const solution = solveFace(
    { expression, intensity, speech, channels: jaw ? { jaw } : undefined },
    { ...defaultHeadGeometry, travel },
  )
  const worst = solution.actuators.reduce((a, b) => (Math.abs(a.stroke) >= Math.abs(b.stroke) ? a : b))
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="rods" value={rods} options={["off", "on"] as const} onChange={setRods} />
      <Segmented label="drive" value={drive} options={["idle", "converse", "listen", "emote", "manual"] as const} onChange={setDrive} />
      {manual ? <>
        <Segmented label="expression" value={expression} options={expressions} onChange={setExpression} />
        <NumberControl label="intensity" value={intensity} min={0} max={1} step={0.01} onChange={setIntensity} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="speech" value={speech} min={0} max={1} step={0.01} onChange={setSpeech} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="jaw" value={jaw} min={0} max={1} step={0.01} onChange={setJaw} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The head turns to follow your pointer, not just the pupils. Click and it starts, blinks, and warms up.</Hint>}
      <NumberControl label="travel" value={travel} min={1} max={8} step={0.5} onChange={setTravel} format={value => `${value} u`} />
      <Readout rows={[
        ["busiest servo", worst.id],
        ["stroke", `${worst.stroke.toFixed(1)} u`],
        ["within travel", solution.withinLimits ? "yes" : "no"],
      ]} />
      <Hint>An expression is a blend of sixteen servo channels, not a second drawing. Lower the travel until a rod turns accent-coloured and the fault lamp lights.</Hint>
    </>}>
      <AnimatronicFace view={view} size={320} variant={variant} showActuators={rods === "on"} geometry={{ travel }} label="FACE / 07"
        {...(manual ? { expression, intensity, speech, channels: jaw ? { jaw } : undefined, behavior: "static" as const, track: false } : { behavior: drive })} />
    </Bench>
  )
}

function UtilityDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [series, setSeries] = React.useState<UtilityDroidSeries>("navigator")
  const [tool, setTool] = React.useState<UtilityDroidTool>("scanner")
  const [drive, setDrive] = React.useState<UtilityDroidBehavior | "manual">("work")
  const [headAngle, setHeadAngle] = React.useState(24)
  const [extension, setExtension] = React.useState(0.65)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="series" value={series} options={["workshop", "navigator", "rescue"] as const} onChange={setSeries} />
      <Segmented label="tool" value={tool} options={["none", "interface", "gripper", "scanner"] as const} onChange={setTool} />
      <Segmented label="drive" value={drive} options={["work", "scan", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="head" value={headAngle} min={-150} max={150} onChange={setHeadAngle} format={value => `${value}°`} />
        <NumberControl label="extend" value={extension} min={0} max={1} step={0.01} onChange={setExtension} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Bring the pointer over it and the dome turns to you.</Hint>}
    </>}>
      <UtilityDroid view={view} size={330} series={series} tool={tool} variant={variant} label="UTILITY / 14"
        {...(drive === "manual" ? { headAngle, toolExtension: extension, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function OrbDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<OrbDroidBehavior | "manual">("roll")
  const [bodyAngle, setBodyAngle] = React.useState(35)
  const [headAngle, setHeadAngle] = React.useState(-12)
  const [antenna, setAntenna] = React.useState<"single" | "twin" | "none">("twin")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="antenna" value={antenna} options={["single", "twin", "none"] as const} onChange={setAntenna} />
      <Segmented label="drive" value={drive} options={["roll", "rock", "survey", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="body" value={bodyAngle} min={-180} max={180} onChange={setBodyAngle} format={value => `${value}°`} />
        <NumberControl label="head" value={headAngle} min={-65} max={65} onChange={setHeadAngle} format={value => `${value}°`} />
      </> : <Hint>The drive sphere turns and the cap stays upright. Move the pointer to aim the optic.</Hint>}
      <p className="text-[11px] text-muted-foreground">Rolling is the mechanism: one clock drives the shell continuously and the head only as far as a real gimbal would let it sway.</p>
    </>}>
      <OrbDroid view={view} size={330} antenna={antenna} variant={variant} label="ORB / 15"
        {...(drive === "manual" ? { bodyAngle, headAngle } : { behavior: drive })} />
    </Bench>
  )
}

function BellowsDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<BellowsBehavior | "manual">("breathe")
  const [inflation, setInflation] = React.useState(0.7)
  const [pleats, setPleats] = React.useState(7)
  const [optics, setOptics] = React.useState<BellowsOptics>("pair")
  const [aperture, setAperture] = React.useState<BellowsAperture>("grille")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="optics" value={optics} options={["pair", "single", "none"] as const} onChange={setOptics} />
      <Segmented label="vent" value={aperture} options={["grille", "iris", "none"] as const} onChange={setAperture} />
      <NumberControl label="pleats" value={pleats} min={4} max={12} onChange={setPleats} />
      <Segmented label="drive" value={drive} options={["breathe", "settle", "startle", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="fill" value={inflation} min={0} max={1} step={0.01} onChange={setInflation} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag the shell up and down to fill it, or focus it and use the arrow keys. Let go and it eases back into the cycle.</Hint>}
      <Readout rows={[["fill", `${Math.round(inflation * 100)}%`]]} />
    </>}>
      <BellowsDroid view={view} size={320} pleats={pleats} optics={optics} aperture={aperture} variant={variant} label="BELLOWS / 01"
        {...(drive === "manual" ? { inflation } : { behavior: drive })}
        interactive onInflationChange={setInflation} />
    </Bench>
  )
}

function RobotAvocadoDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<AvocadoBehavior | "manual">("present")
  const [open, setOpen] = React.useState(0.7)
  const [bearing, setBearing] = React.useState(24)
  const [stone, setStone] = React.useState<AvocadoStone>("optic")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="stone" value={stone} options={["optic", "core", "none"] as const} onChange={setStone} />
      <NumberControl label="bearing" value={bearing} min={-180} max={180} onChange={setBearing} format={value => `${value}°`} />
      <Segmented label="drive" value={drive} options={["present", "ajar", "scan", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="open" value={open} min={0} max={1} step={0.01} onChange={setOpen} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag either way out of the middle to part the shell, or focus it and use the arrows. Let go and it eases back into the cycle.</Hint>}
      <Readout rows={[["open", `${Math.round(open * 100)}%`]]} />
    </>}>
      <RobotAvocado view={view} size={320} variant={variant} stone={stone} bearing={bearing} label="AVOCADO / 01"
        interactive onOpenChange={setOpen}
        {...(drive === "manual" ? { open, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotStrawberryDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<StrawberryBehavior | "manual">("unfurl")
  const [bloom, setBloom] = React.useState(0.65)
  const [seeds, setSeeds] = React.useState(26)
  const [blades, setBlades] = React.useState(6)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="seeds" value={seeds} min={10} max={48} onChange={setSeeds} />
      <NumberControl label="blades" value={blades} min={3} max={9} onChange={setBlades} />
      <Segmented label="drive" value={drive} options={["unfurl", "probe", "furl", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="bloom" value={bloom} min={0} max={1} step={0.01} onChange={setBloom} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag up and down to work the calyx — the blades come down and the studs run out together — or focus it and use the arrows.</Hint>}
      <Readout rows={[["bloom", `${Math.round(bloom * 100)}%`]]} />
    </>}>
      <RobotStrawberry view={view} size={320} variant={variant} seeds={seeds} blades={blades} label="BERRY / 02"
        interactive onBloomChange={setBloom}
        {...(drive === "manual" ? { bloom, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotTomatoDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TomatoBehavior | "manual">("sway")
  const [swing, setSwing] = React.useState(14)
  const [ripeness, setRipeness] = React.useState(0.72)
  const [lobes, setLobes] = React.useState(6)
  const [sepals, setSepals] = React.useState(5)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="ripeness" value={ripeness} min={0} max={1} step={0.01} onChange={setRipeness} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="lobes" value={lobes} min={4} max={9} onChange={setLobes} />
      <NumberControl label="sepals" value={sepals} min={0} max={8} onChange={setSepals} />
      <Segmented label="drive" value={drive} options={["sway", "settle", "sort", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="swing" value={swing} min={-34} max={34} onChange={setSwing} format={value => `${value}°`} />
        : <Hint>Drag across to swing it under its clamp — it follows the pointer from every camera — or focus it and use the arrows.</Hint>}
      <Readout rows={[["swing", `${Math.round(swing)}°`], ["ripe", `${Math.round(ripeness * 100)}%`]]} />
    </>}>
      <RobotTomato view={view} size={320} variant={variant} ripeness={ripeness} lobes={lobes} sepals={sepals} label="TOMATO / 03"
        interactive onSwingChange={setSwing}
        {...(drive === "manual" ? { swing, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function ProtocolDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [pose, setPose] = React.useState<ProtocolDroidPose>("converse")
  const [gesture, setGesture] = React.useState<ProtocolDroidGesture>("explain")
  const [headAngle, setHeadAngle] = React.useState(10)
  const [drive, setDrive] = React.useState<ProtocolDroidBehavior | "manual">("converse")
  const [exposed, setExposed] = React.useState<"closed" | "exposed">("closed")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="pose" value={pose} options={["formal", "converse", "cautious"] as const} onChange={setPose} />
      <Segmented label="torso" value={exposed} options={["closed", "exposed"] as const} onChange={setExposed} />
      <Segmented label="drive" value={drive} options={["converse", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="gesture" value={gesture} options={["none", "explain", "greet", "point"] as const} onChange={setGesture} />
        <NumberControl label="head" value={headAngle} min={-55} max={55} onChange={setHeadAngle} format={value => `${value}°`} />
      </> : <Hint>Click it to move the conversation on a gesture.</Hint>}
    </>}>
      <ProtocolDroid view={view} size={300} pose={pose} exposed={exposed === "exposed"} variant={variant} label="PROTOCOL / 16"
        {...(drive === "manual" ? { gesture, headAngle, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function SecurityDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<SecurityDroidBehavior | "manual">("patrol")
  const [pose, setPose] = React.useState<SecurityDroidPose>("guard")
  const [headAngle, setHeadAngle] = React.useState(-8)
  const [alert, setAlert] = React.useState<"clear" | "alert">("clear")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["patrol", "alert", "idle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="state" value={alert} options={["clear", "alert"] as const} onChange={setAlert} />
      {drive === "manual" ? <>
        <Segmented label="pose" value={pose} options={["stand", "patrol", "guard"] as const} onChange={setPose} />
        <NumberControl label="head" value={headAngle} min={-70} max={70} onChange={setHeadAngle} format={value => `${value}°`} />
      </> : <Hint>The sensor bar tracks the pointer unless a controlled look is supplied.</Hint>}
      <p className="text-[11px] text-muted-foreground">Alert overrides the behaviour: it stands the frame to guard and shortens the scan, whatever the drive says.</p>
    </>}>
      <SecurityDroid view={view} size={300} alert={alert === "alert"} variant={variant} label="SECURITY / 17"
        {...(drive === "manual" ? { pose, headAngle } : { behavior: drive })} />
    </Bench>
  )
}

function MedicalDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [leftTool, setLeftTool] = React.useState<MedicalDroidTool>("scanner")
  const [rightTool, setRightTool] = React.useState<MedicalDroidTool>("injector")
  const [diagnostic, setDiagnostic] = React.useState(0.78)
  const [drive, setDrive] = React.useState<MedicalDroidBehavior | "manual">("diagnose")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const medicalTools = ["none", "scanner", "injector", "clamp", "probe"] as const
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="left" value={leftTool} options={medicalTools} onChange={setLeftTool} />
      <Segmented label="right" value={rightTool} options={medicalTools} onChange={setRightTool} />
      <Segmented label="drive" value={drive} options={["diagnose", "monitor", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="diagnose" value={diagnostic} min={0} max={1} step={0.01} onChange={setDiagnostic} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Click it to run the scan again from the top.</Hint>}
    </>}>
      <MedicalDroid view={view} size={330} leftTool={leftTool} rightTool={rightTool} variant={variant} label="MEDICAL / 18"
        {...(drive === "manual" ? { diagnostic, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function InfantryDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [frame, setFrame] = React.useState<InfantryDroidFrame>("light")
  const [pose, setPose] = React.useState<InfantryDroidPose>("march")
  const [drive, setDrive] = React.useState<InfantryDroidBehavior | "manual">("patrol")
  const [equipment, setEquipment] = React.useState<InfantryDroidEquipment>("pack")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="frame" value={frame} options={["light", "heavy"] as const} onChange={setFrame} />
      <Segmented label="module" value={equipment} options={["none", "pack", "scanner", "shield"] as const} onChange={setEquipment} />
      <Segmented label="drive" value={drive} options={["patrol", "alert", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <Segmented label="pose" value={pose} options={["stand", "march", "guard", "disabled"] as const} onChange={setPose} />
        : <Hint>The head follows the pointer; click to put it on guard.</Hint>}
    </>}>
      <InfantryDroid view={view} size={300} frame={frame} equipment={equipment} variant={variant} label="INFANTRY / 19"
        {...(drive === "manual" ? { pose, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function ProbeDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [hover, setHover] = React.useState(0.65)
  const [scanAngle, setScanAngle] = React.useState(16)
  const [appendages, setAppendages] = React.useState(5)
  const [drive, setDrive] = React.useState<ProbeDroidBehavior | "manual">("hover")
  const [active, setActive] = React.useState<"idle" | "scan">("scan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="sensor" value={active} options={["idle", "scan"] as const} onChange={setActive} />
      <Segmented label="drive" value={drive} options={["hover", "scan", "pointer", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="hover" value={hover} min={0} max={1} step={0.01} onChange={setHover} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="scan" value={scanAngle} min={-65} max={65} onChange={setScanAngle} format={value => `${value}°`} />
      </> : <Hint>Move the pointer across it and the sensor comes round.</Hint>}
      <NumberControl label="arms" value={appendages} min={3} max={6} onChange={setAppendages} />
    </>}>
      <ProbeDroid view={view} size={340} appendages={appendages} active={active === "scan"} variant={variant} label="PROBE / 20"
        {...(drive === "manual" ? { hover, scanAngle, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CourierDroidDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [heading, setHeading] = React.useState(18)
  const [steering, setSteering] = React.useState(12)
  const [travel, setTravel] = React.useState(0.35)
  const [drive, setDrive] = React.useState<CourierDroidBehavior | "manual">("deliver")
  const [cargo, setCargo] = React.useState<CourierDroidCargo>("pod")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="cargo" value={cargo} options={["none", "pod", "crate", "tools"] as const} onChange={setCargo} />
      <Segmented label="drive" value={drive} options={["deliver", "patrol", "pointer", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="heading" value={heading} min={-180} max={180} onChange={setHeading} format={value => `${value}°`} />
        <NumberControl label="steer" value={steering} min={-45} max={45} onChange={setSteering} format={value => `${value}°`} />
        <NumberControl label="travel" value={travel} min={0} max={1} step={0.01} onChange={setTravel} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>It comes round to face the pointer when it is over the frame.</Hint>}
    </>}>
      <CourierDroid view={view} size={360} cargo={cargo} variant={variant} label="COURIER / 21"
        {...(drive === "manual" ? { heading, steering, travel, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CasingDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [skirt, setSkirt] = React.useState<CasingDroidSkirt>("banded")
  const [dome, setDome] = React.useState<CasingDroidDome>("round")
  const [collar, setCollar] = React.useState<CasingDroidCollar>("slats")
  const [manipulator, setManipulator] = React.useState<CasingDroidManipulator>("suction")
  const [emitter, setEmitter] = React.useState<CasingDroidEmitter>("array")
  const [lamps, setLamps] = React.useState<CasingDroidLamps>("pair")
  const [rows, setRows] = React.useState(3)
  const [columns, setColumns] = React.useState(4)
  const [neckRings, setNeckRings] = React.useState(3)
  const [stalkLength, setStalkLength] = React.useState(1)
  const [drive, setDrive] = React.useState<CasingDroidBehavior | "manual">("patrol")
  const [domeAngle, setDomeAngle] = React.useState(35)
  const [eyeElevation, setEyeElevation] = React.useState(-8)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="skirt" value={skirt} options={["banded", "smooth", "ribbed"] as const} onChange={setSkirt} />
      <Segmented label="dome" value={dome} options={["round", "flat", "faceted"] as const} onChange={setDome} />
      <Segmented label="collar" value={collar} options={["slats", "mesh", "plain"] as const} onChange={setCollar} />
      <Segmented label="lamps" value={lamps} options={["none", "pair", "quad"] as const} onChange={setLamps} />
      <Segmented label="tool" value={manipulator} options={["none", "suction", "clamp", "probe"] as const} onChange={setManipulator} />
      <Segmented label="emitter" value={emitter} options={["none", "rod", "dish", "array"] as const} onChange={setEmitter} />
      <NumberControl label="rows" value={rows} min={2} max={4} onChange={setRows} />
      <NumberControl label="studs" value={columns} min={3} max={6} onChange={setColumns} />
      <NumberControl label="rings" value={neckRings} min={2} max={5} onChange={setNeckRings} />
      <NumberControl label="stalk" value={stalkLength} min={0.5} max={1.8} step={0.05} onChange={setStalkLength} format={value => `${value.toFixed(2)}×`} />
      <Segmented label="drive" value={drive} options={["patrol", "survey", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="dome°" value={domeAngle} min={-180} max={180} onChange={setDomeAngle} format={value => `${value}°`} />
        <NumberControl label="eye" value={eyeElevation} min={-28} max={28} onChange={setEyeElevation} format={value => `${value}°`} />
      </> : <Hint>Bring the pointer over it and the eyestalk comes round to you.</Hint>}
    </>}>
      <CasingDroid view={view} size={330} skirt={skirt} dome={dome} collar={collar} lamps={lamps} manipulator={manipulator}
        emitter={emitter} hemisphereRows={rows} hemisphereColumns={columns} neckRings={neckRings}
        stalkLength={stalkLength} variant={variant} label="CASING / 22"
        {...(drive === "manual" ? { domeAngle, eyeElevation, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function AstromechDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [legMode, setLegMode] = React.useState<"tripod" | "bipod">("tripod")
  const [dome, setDome] = React.useState<AstromechDome>("round")
  const [livery, setLivery] = React.useState<AstromechLivery>("banded")
  const [feet, setFeet] = React.useState<AstromechFeet>("skid")
  const [antenna, setAntenna] = React.useState<AstromechAntenna>("none")
  const [ports, setPorts] = React.useState(2)
  const [tool, setTool] = React.useState<AstromechTool>("welder")
  const [drive, setDrive] = React.useState<AstromechBehavior | "manual">("work")
  const [domeAngle, setDomeAngle] = React.useState(45)
  const [holo, setHolo] = React.useState(0.8)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="chassis" value={legMode} options={["tripod", "bipod"] as const} onChange={setLegMode} />
      <Segmented label="dome" value={dome} options={["round", "flat", "faceted"] as const} onChange={setDome} />
      <Segmented label="livery" value={livery} options={["plain", "banded", "paneled"] as const} onChange={setLivery} />
      <Segmented label="feet" value={feet} options={["skid", "wheel", "tread"] as const} onChange={setFeet} />
      <Segmented label="antenna" value={antenna} options={["none", "whip", "dish"] as const} onChange={setAntenna} />
      <Segmented label="tool" value={tool} options={["none", "probe", "welder", "periscope"] as const} onChange={setTool} />
      <NumberControl label="ports" value={ports} min={1} max={3} onChange={setPorts} />
      <Segmented label="drive" value={drive} options={["work", "roam", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="dome°" value={domeAngle} min={-180} max={180} onChange={setDomeAngle} format={value => `${value}°`} />
        <NumberControl label="holo" value={holo} min={0} max={1} step={0.01} onChange={setHolo} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The dome comes round to the pointer; the work cycle opens the panel on its own.</Hint>}
    </>}>
      <AstromechDroid view={view} size={330} legMode={legMode} dome={dome} livery={livery} feet={feet} antenna={antenna}
        ports={ports} tool={tool} variant={variant} label="ASTROMECH / 23"
        {...(drive === "manual" ? { domeAngle, holo, panel: true, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function AttendantDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [plating, setPlating] = React.useState<AttendantDroidPlating>("full")
  const [build, setBuild] = React.useState<AttendantDroidBuild>("standard")
  const [face, setFace] = React.useState<AttendantDroidFace>("grille")
  const [hands, setHands] = React.useState<AttendantDroidHands>("fingers")
  const [collar, setCollar] = React.useState<"collar" | "bare-neck">("collar")
  const [drive, setDrive] = React.useState<AttendantDroidBehavior | "manual">("attend")
  const [pose, setPose] = React.useState<AttendantDroidPose>("present")
  const [headAngle, setHeadAngle] = React.useState(16)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="plating" value={plating} options={["full", "partial", "bare"] as const} onChange={setPlating} />
      <Segmented label="build" value={build} options={["slim", "standard", "heavy"] as const} onChange={setBuild} />
      <Segmented label="face" value={face} options={["grille", "visor", "lamps"] as const} onChange={setFace} />
      <Segmented label="hands" value={hands} options={["fingers", "clamp", "mitt"] as const} onChange={setHands} />
      <Segmented label="neck" value={collar} options={["collar", "bare-neck"] as const} onChange={setCollar} />
      <Segmented label="drive" value={drive} options={["attend", "fret", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="pose" value={pose} options={["attention", "bow", "present", "alarm"] as const} onChange={setPose} />
        <NumberControl label="head" value={headAngle} min={-45} max={45} onChange={setHeadAngle} format={value => `${value}°`} />
      </> : <Hint>The head turns to the pointer, and a click moves it on to its next courtesy.</Hint>}
    </>}>
      <AttendantDroid view={view} size={300} plating={plating} build={build} face={face} hands={hands}
        collar={collar === "collar"} variant={variant} label="ATTENDANT / 24"
        {...(drive === "manual" ? { pose, headAngle, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function CyberTrooperDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [chestUnit, setChestUnit] = React.useState<CyberTrooperChest>("core")
  const [helmet, setHelmet] = React.useState<CyberTrooperHelmet>("slab")
  const [build, setBuild] = React.useState<CyberTrooperBuild>("standard")
  const [visor, setVisor] = React.useState<CyberTrooperVisor>("lamps")
  const [shoulders, setShoulders] = React.useState<"pauldron" | "flush">("pauldron")
  const [handles, setHandles] = React.useState<"handles" | "plain">("handles")
  const [jaw, setJaw] = React.useState<"jaw" | "smooth">("jaw")
  const [drive, setDrive] = React.useState<CyberTrooperBehavior | "manual">("march")
  const [pose, setPose] = React.useState<CyberTrooperPose>("march")
  const [power, setPower] = React.useState(0.62)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="helmet" value={helmet} options={["slab", "domed", "crested"] as const} onChange={setHelmet} />
      <Segmented label="visor" value={visor} options={["lamps", "slit", "bar"] as const} onChange={setVisor} />
      <Segmented label="build" value={build} options={["standard", "heavy"] as const} onChange={setBuild} />
      <Segmented label="chest" value={chestUnit} options={["bar", "vent", "core"] as const} onChange={setChestUnit} />
      <Segmented label="shoulder" value={shoulders} options={["pauldron", "flush"] as const} onChange={setShoulders} />
      <Segmented label="handles" value={handles} options={["handles", "plain"] as const} onChange={setHandles} />
      <Segmented label="jaw" value={jaw} options={["jaw", "smooth"] as const} onChange={setJaw} />
      <Segmented label="drive" value={drive} options={["march", "advance", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="pose" value={pose} options={["stand", "march", "reach", "powerdown"] as const} onChange={setPose} />
        <NumberControl label="power" value={power} min={0} max={1} step={0.01} onChange={setPower} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Click it to cut the power, and click again to bring it back.</Hint>}
    </>}>
      <CyberTrooper view={view} size={300} chestUnit={chestUnit} helmet={helmet} build={build} visor={visor}
        shoulders={shoulders} jaw={jaw === "jaw"} handles={handles === "handles"} variant={variant} label="TROOPER / 25"
        {...(drive === "manual" ? { pose, power, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function RobotHoundDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<RobotHoundBehavior | "manual">("seek")
  const [attention, setAttention] = React.useState(0.6)
  const [ears, setEars] = React.useState<RobotHoundEars>("dish")
  const [probe, setProbe] = React.useState<RobotHoundProbe>("whip")
  const [skirt, setSkirt] = React.useState<"flared" | "straight">("flared")
  const [keys, setKeys] = React.useState(4)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="ears" value={ears} options={["dish", "vane", "none"] as const} onChange={setEars} />
      <Segmented label="probe" value={probe} options={["whip", "mast", "none"] as const} onChange={setProbe} />
      <Segmented label="skirt" value={skirt} options={["flared", "straight"] as const} onChange={setSkirt} />
      <NumberControl label="keys" value={keys} min={3} max={8} onChange={setKeys} />
      <Segmented label="drive" value={drive} options={["seek", "alert", "idle", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="attention" value={attention} min={0} max={1} step={0.01} onChange={setAttention} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag up and down to bring its head up — the collar runs out, the ears prick and the probe rises with it, and it eases back into the behaviour when you let go. It watches you the whole time.</Hint>}
      <Readout rows={[["attention", `${Math.round(attention * 100)}%`]]} />
    </>}>
      <RobotHound view={view} size={320} variant={variant} ears={ears} probe={probe} skirt={skirt} keys={keys} label="HOUND / 09"
        interactive onAttentionChange={setAttention}
        {...(drive === "manual" ? { attention, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function GuideDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<GuideDroidBehavior | "manual">("hover")
  const [height, setHeight] = React.useState(0.6)
  const [limbs, setLimbs] = React.useState<GuideDroidLimbs>("coil")
  const [blades, setBlades] = React.useState(2)
  const [voice, setVoice] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="limbs" value={limbs} options={["coil", "strut"] as const} onChange={setLimbs} />
      <NumberControl label="blades" value={blades} min={2} max={6} onChange={setBlades} />
      <NumberControl label="voice" value={voice} min={0} max={1} step={0.05} onChange={setVoice} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="drive" value={drive} options={["hover", "beckon", "settle", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag it up and down to fly it — the springs stretch as it climbs and it eases back into the behaviour when you let go.</Hint>}
    </>}>
      <GuideDroid view={view} size={300} blades={blades} limbs={limbs} voice={voice} variant={variant} label="GUIDE / 07"
        interactive onHeightChange={setHeight}
        {...(drive === "manual" ? { height, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function MonolithDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<MonolithDroidBehavior | "manual">("walk")
  const [splay, setSplay] = React.useState(0.62)
  const [slabs, setSlabs] = React.useState(4)
  const [stride, setStride] = React.useState(0.25)
  const [panel, setPanel] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="slabs" value={slabs} min={3} max={6} onChange={setSlabs} />
      <NumberControl label="panel" value={panel} min={0} max={1} step={0.05} onChange={setPanel} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="drive" value={drive} options={["walk", "unfold", "brief", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <>
            <NumberControl label="splay" value={splay} min={0} max={1} step={0.01} onChange={setSplay} format={value => `${Math.round(value * 100)}%`} />
            <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
          </>
        : <Hint>Drag across it to pull the column open, or focus it and use the arrow keys. It eases back into the behaviour when you let go.</Hint>}
      <Readout rows={[["splay", `${Math.round(splay * 100)}%`]]} />
    </>}>
      <MonolithDroid view={view} size={300} slabs={slabs} panel={panel} variant={variant} label="MONOLITH / 04"
        interactive onSplayChange={setSplay}
        {...(drive === "manual" ? { splay, stride, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function TripodDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TripodBehavior | "manual">("trundle")
  const [height, setHeight] = React.useState(0.4)
  const [stride, setStride] = React.useState(0.35)
  const [lean, setLean] = React.useState({ x: 0, y: 0 })
  const [support, setSupport] = React.useState(true)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["trundle", "scurry", "survey", "settle", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="height" value={height} min={0} max={1} step={0.02} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag across it to push the body over its feet, or focus it and use the arrow keys — far enough and the centre of mass leaves the support and the lamp turns. It eases back into the gait when you let go.</Hint>}
      <Segmented label="support" value={support ? "show" : "hide"} options={["show", "hide"] as const} onChange={value => setSupport(value === "show")} />
      <Readout rows={[
        ["lean x", `${Math.round(lean.x * 100)}%`],
        ["lean y", `${Math.round(lean.y * 100)}%`],
      ]} />
    </>}>
      <TripodDroid view={view} size={300} variant={variant} height={height} showSupport={support} label="TRIPOD / 03"
        interactive onLeanChange={setLean}
        {...(drive === "manual"
          ? { gait: "creep" as const, stride, behavior: "static" as const }
          : { behavior: drive })} />
    </Bench>
  )
}
function ScoutWalkerDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<ScoutWalkerBehavior | "manual">("patrol")
  const [gait, setGait] = React.useState<ScoutWalkerGait>("walk")
  const [height, setHeight] = React.useState(0.55)
  const [stride, setStride] = React.useState(0.25)
  const [lean, setLean] = React.useState({ x: 0, y: 0 })
  const [support, setSupport] = React.useState(true)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["patrol", "advance", "watch", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <>
            <Segmented label="gait" value={gait} options={["stand", "walk", "stride"] as const} onChange={setGait} />
            <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
          </>
        : <Hint>Drag across it to push the cab off its feet, or focus it and use the arrow keys — past the roll stop the mass leaves the support and the lamp turns. It eases back into the gait when you let go.</Hint>}
      <NumberControl label="height" value={height} min={0} max={1} step={0.02} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="support" value={support ? "show" : "hide"} options={["show", "hide"] as const} onChange={value => setSupport(value === "show")} />
      <Readout rows={[
        ["lean x", `${Math.round(lean.x * 100)}%`],
        ["lean y", `${Math.round(lean.y * 100)}%`],
      ]} />
    </>}>
      <ScoutWalker view={view} size={300} variant={variant} height={height} showSupport={support} label="SCOUT / 02"
        interactive onLeanChange={setLean}
        {...(drive === "manual" ? { gait, stride, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function SiegeWalkerDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SiegeWalkerBehavior | "manual">("march")
  const [gait, setGait] = React.useState<SiegeWalkerGait>("walk")
  const [height, setHeight] = React.useState(0.55)
  const [stride, setStride] = React.useState(0.2)
  const [lean, setLean] = React.useState({ x: 0, y: 0 })
  const [support, setSupport] = React.useState(true)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["march", "haul", "pace", "halt", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <>
            <Segmented label="gait" value={gait} options={["stand", "walk", "creep", "pace"] as const} onChange={setGait} />
            <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
          </>
        : <Hint>March and haul keep three feet down, so the hull stays near level. Pace swings both legs of a side together and the support becomes a line it cannot roll far enough to reach. Drag across it to push the hull off its feet.</Hint>}
      <NumberControl label="height" value={height} min={0} max={1} step={0.02} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="support" value={support ? "show" : "hide"} options={["show", "hide"] as const} onChange={value => setSupport(value === "show")} />
      <Readout rows={[
        ["lean x", `${Math.round(lean.x * 100)}%`],
        ["lean y", `${Math.round(lean.y * 100)}%`],
      ]} />
    </>}>
      <SiegeWalker view={view} size={360} variant={variant} height={height} showSupport={support} label="SIEGE / 01"
        interactive onLeanChange={setLean}
        {...(drive === "manual" ? { gait, stride, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function CustodianDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<CustodianDroidBehavior | "manual">("watch")
  const [open, setOpen] = React.useState(0.35)
  const [plates, setPlates] = React.useState(6)
  const [voice, setVoice] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="plates" value={plates} min={4} max={10} onChange={setPlates} />
      <NumberControl label="voice" value={voice} min={0} max={1} step={0.05} onChange={setVoice} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="drive" value={drive} options={["watch", "survey", "alert", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="open" value={open} min={0} max={1} step={0.01} onChange={setOpen} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag across it to run the armour out on its rails, or focus it and use the arrow keys. The optic watches you the whole time, and the shell eases back into the behaviour when you let go.</Hint>}
      <Readout rows={[["shell", `${Math.round(open * 100)}%`]]} />
    </>}>
      <CustodianDroid view={view} size={300} plates={plates} voice={voice} variant={variant} label="CUSTODIAN / 11"
        interactive onOpenChange={setOpen}
        {...(drive === "manual" ? { open, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function SentinelConsoleDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SentinelBehavior | "manual">("watch")
  const [aperture, setAperture] = React.useState(0.55)
  const [blades, setBlades] = React.useState(8)
  const [voice, setVoice] = React.useState(0)
  const [bulkhead, setBulkhead] = React.useState<"set in" | "bare">("set in")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="blades" value={blades} min={4} max={10} onChange={setBlades} />
      <NumberControl label="voice" value={voice} min={0} max={1} step={0.05} onChange={setVoice} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="wall" value={bulkhead} options={["set in", "bare"] as const} onChange={setBulkhead} />
      <Segmented label="drive" value={drive} options={["watch", "listen", "speak", "alert", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="aperture" value={aperture} min={0} max={1} step={0.01} onChange={setAperture} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag across the lens to work the iris, or focus it and use the arrow keys. It watches you the whole time, and eases back into the behaviour when you let go.</Hint>}
      <Readout rows={[["aperture", `${Math.round(aperture * 100)}%`]]} />
    </>}>
      <SentinelConsole view={view} size={260} blades={blades} voice={voice} variant={variant}
        showBulkhead={bulkhead === "set in"} plate="SENTINEL 7" label="SENTINEL / 09"
        interactive onApertureChange={setAperture}
        {...(drive === "manual" ? { aperture, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function PylonDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<PylonDroidBehavior | "manual">("deploy")
  const [deploy, setDeploy] = React.useState(0.6)
  const [stance, setStance] = React.useState<PylonDroidStance>("narrow")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="stance" value={stance} options={["narrow", "wide"] as const} onChange={setStance} />
      <Segmented label="drive" value={drive} options={["deploy", "survey", "stow", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="deploy" value={deploy} min={0} max={1} step={0.01} onChange={setDeploy} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag it up and down to stand it up — at zero every limb is folded inside the triangle, and it eases back into the behaviour when you let go.</Hint>}
    </>}>
      <PylonDroid view={view} size={300} stance={stance} variant={variant} label="PYLON / 11"
        interactive onDeployChange={setDeploy}
        {...(drive === "manual" ? { deploy, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}
function RobotFishDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<FishBehavior | "manual">("cruise")
  const [phase, setPhase] = React.useState(0.3)
  const [amplitude, setAmplitude] = React.useState(0.6)
  const [waves, setWaves] = React.useState(1.2)
  const [turn, setTurn] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["cruise", "dart", "hover", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="swing" value={amplitude} min={0} max={1} step={0.01} onChange={setAmplitude} format={value => `${Math.round(value * 52)}°`} />
        <NumberControl label="waves" value={waves} min={0.25} max={3} step={0.05} onChange={setWaves} format={value => value.toFixed(2)} />
        <NumberControl label="turn" value={turn} min={-1} max={1} step={0.05} onChange={setTurn} format={value => value.toFixed(2)} />
      </> : <Hint>It turns toward your pointer. Click it and it darts off, then settles back into the beat.</Hint>}
      <p className="text-[11px] text-muted-foreground">The hull is the solved spine offset either side, so the outline is the wave rather than artwork beside it.</p>
    </>}>
      <RobotFish view={view} size={360} variant={variant} label="FISH / 22"
        {...(drive === "manual" ? { phase, amplitude, waves, turn } : { behavior: drive })} />
    </Bench>
  )
}

function RobotSnakeDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<SnakeBehavior | "manual">("serpentine")
  const [phase, setPhase] = React.useState(0.2)
  const [amplitude, setAmplitude] = React.useState(0.8)
  const [waves, setWaves] = React.useState(1.5)
  const [lift, setLift] = React.useState(0)
  const [contacts, setContacts] = React.useState<"off" | "on">("off")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["serpentine", "sidewind", "coil", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="swing" value={amplitude} min={0} max={1} step={0.01} onChange={setAmplitude} format={value => `${Math.round(value * 52)}°`} />
        <NumberControl label="waves" value={waves} min={0.25} max={3} step={0.05} onChange={setWaves} format={value => value.toFixed(2)} />
        <NumberControl label="lift" value={lift} min={0} max={1} step={0.05} onChange={setLift} format={value => `${Math.round(value * 7)}u`} />
      </> : <Hint>The head follows your pointer. Click it and it strikes — the wave flattens for the lunge and comes back.</Hint>}
      <Segmented label="contacts" value={contacts} options={["off", "on"] as const} onChange={setContacts} />
      <p className="text-[11px] text-muted-foreground">Lifted sections cast an offset shadow and drop out of the contact marks: that is sidewinding.</p>
    </>}>
      <RobotSnake view={view} size={360} variant={variant} showContacts={contacts === "on"} label="SNAKE / 23"
        {...(drive === "manual" ? { phase, amplitude, waves, lift } : { behavior: drive })} />
    </Bench>
  )
}

function RobotSpiderDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<SpiderBehavior | "manual">("walk")
  const [gait, setGait] = React.useState<HexapodGait>("tripod")
  const [phase, setPhase] = React.useState(0.2)
  const [legs, setLegs] = React.useState(8)
  const [height, setHeight] = React.useState(0.55)
  const [contacts, setContacts] = React.useState<"off" | "on">("off")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["walk", "skitter", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <Segmented label="gait" value={gait} options={["stand", "tripod", "wave", "ripple"] as const} onChange={setGait} />
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>It faces your pointer and walks while you watch it. Click to drop it into a crouch.</Hint>}
      <NumberControl label="legs" value={legs} min={4} max={10} step={2} onChange={setLegs} />
      <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(8 + value * 22)}u`} />
      <Segmented label="contacts" value={contacts} options={["off", "on"] as const} onChange={setContacts} />
    </>}>
      <RobotSpider view={view} size={330} legs={legs} height={height} variant={variant} showContacts={contacts === "on"} label="SPIDER / 24"
        {...(drive === "manual" ? { gait, phase, heading: 0 } : { behavior: drive })} />
    </Bench>
  )
}

function RobotCrabDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<CrabBehavior | "manual">("scuttle")
  const [phase, setPhase] = React.useState(0.2)
  const [heading, setHeading] = React.useState(90)
  const [claw, setClaw] = React.useState(0.6)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["scuttle", "idle", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="course" value={heading} min={0} max={360} step={5} onChange={setHeading} format={value => `${value}°`} />
        <NumberControl label="claw" value={claw} min={0} max={1} step={0.05} onChange={setClaw} format={value => `${Math.round(value * 38)}°`} />
      </> : <Hint>The eyestalks track your pointer. Click and both claws snap shut, then fall open.</Hint>}
      <p className="text-[11px] text-muted-foreground">The carapace never turns — only the course handed to the gait solver does.</p>
    </>}>
      <RobotCrab view={view} size={360} variant={variant} label="CRAB / 25"
        {...(drive === "manual" ? { phase, heading, claw, gait: "tripod" as HexapodGait } : { behavior: drive })} />
    </Bench>
  )
}

function RobotBirdDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<BirdBehavior | "manual">("perch")
  const [phase, setPhase] = React.useState(0.25)
  const [spread, setSpread] = React.useState(1)
  const [tail, setTail] = React.useState(0.6)
  const [altitude, setAltitude] = React.useState(0.5)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["perch", "flap", "glide", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="beat" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="spread" value={spread} min={0} max={1} step={0.01} onChange={setSpread} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="tail" value={tail} min={0} max={1} step={0.01} onChange={setTail} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="height" value={altitude} min={0} max={1} step={0.01} onChange={setAltitude} format={value => `${Math.round(value * 30)}u`} />
      </> : <Hint>Its head follows your pointer. Click it and it launches, then settles back onto the perch.</Hint>}
      <p className="text-[11px] text-muted-foreground">Spread interpolates the whole three-link wing between tucked and extended, so folding and beating are one mechanism.</p>
    </>}>
      <RobotBird view={view} size={330} variant={variant} label="BIRD / 26"
        {...(drive === "manual" ? { phase, spread, tail, altitude } : { behavior: drive })} />
    </Bench>
  )
}

const voxelShapes: VoxelShape[] = ["sphere", "block", "pyramid", "gear", "vessel", "lattice"]

/** Every fabricator shares one set of axes, so they share one control panel. */
function useVoxelBench(defaults: { shape: VoxelShape; view?: RobotView }) {
  const [drive, setDrive] = React.useState<VoxelBehavior | "manual">("build")
  const [shape, setShape] = React.useState<VoxelShape>(defaults.shape)
  const [view, setView] = React.useState<RobotView>(defaults.view ?? "iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [resolution, setResolution] = React.useState(6)
  const [progress, setProgress] = React.useState(0.55)
  const controls = (
    <>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="shape" value={shape} options={voxelShapes} onChange={setShape} />
      <Segmented label="drive" value={drive} options={["build", "layer", "refine", "idle", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="build" value={progress} min={0} max={1} step={0.01} onChange={setProgress} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Press and drag up and down to lay or strip material; let go and it carries on from there. Arrow keys step one layer.</Hint>}
      <NumberControl label="voxels" value={resolution} min={2} max={14} onChange={setResolution} format={value => `${value}³`} />
      {drive === "refine" && <p className="text-[11px] text-muted-foreground">Refine drives the resolution itself — move the voxels slider to take it over.</p>}
    </>
  )
  const machine = {
    variant, view, shape, interactive: true,
    ...(drive === "manual" ? { progress, resolution } : { behavior: drive }),
    ...(drive === "refine" ? null : { resolution }),
  } as const
  return { controls, machine }
}

function FabricatorDemo() {
  const [enclosure, setEnclosure] = React.useState<"on" | "off">("on")
  const { controls, machine } = useVoxelBench({ shape: "lattice" })
  return (
    <Bench controls={<>
      {controls}
      <Segmented label="frame" value={enclosure} options={["on", "off"] as const} onChange={setEnclosure} />
      <p className="text-[11px] text-muted-foreground">The object is a field sampled at this resolution, not a stored model: the same solid is rebuilt out of smaller cells. High resolutions draw a lot of paths.</p>
    </>}>
      <Fabricator size={360} showEnclosure={enclosure === "on"} label="FABRICATOR / 27" {...machine} />
    </Bench>
  )
}

function VoxelFormDemo() {
  const [plate, setPlate] = React.useState<"on" | "off">("on")
  const { controls, machine } = useVoxelBench({ shape: "gear" })
  return (
    <Bench controls={<>
      {controls}
      <Segmented label="plate" value={plate} options={["on", "off"] as const} onChange={setPlate} />
      <p className="text-[11px] text-muted-foreground">The workpiece with no machine around it — the same solid every fabricator in the set builds.</p>
    </>}>
      <VoxelForm size={330} showPlate={plate === "on"} label="FORM / 28" {...machine} />
    </Bench>
  )
}

function ArmFabricatorDemo() {
  const [elbow, setElbow] = React.useState<"up" | "down">("up")
  const { controls, machine } = useVoxelBench({ shape: "gear" })
  return (
    <Bench controls={<>
      {controls}
      <Segmented label="elbow" value={elbow} options={["up", "down"] as const} onChange={setElbow} />
      <p className="text-[11px] text-muted-foreground">The turret yaws at the cell being laid; the shoulder and elbow are solved for it. Both elbow sides reach the same tip.</p>
    </>}>
      <ArmFabricator size={380} elbow={elbow} label="ARM FAB / 29" {...machine} />
    </Bench>
  )
}

function DroneFabricatorDemo() {
  const [pods, setPods] = React.useState(4)
  const { controls, machine } = useVoxelBench({ shape: "vessel" })
  return (
    <Bench controls={<>
      {controls}
      <NumberControl label="pods" value={pods} min={3} max={6} onChange={setPods} />
      <p className="text-[11px] text-muted-foreground">No rails and no reach envelope: the platform flies to each cell and banks toward the next one.</p>
    </>}>
      <DroneFabricator size={360} pods={pods} label="FLY FAB / 30" {...machine} />
    </Bench>
  )
}

function RobotDragonflyDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<DragonflyBehavior | "manual">("hover")
  const [phase, setPhase] = React.useState(0.2)
  const [swing, setSwing] = React.useState(0.9)
  const [curl, setCurl] = React.useState(0.2)
  const [heading, setHeading] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["hover", "dart", "perch", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="beat" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="swing" value={swing} min={0} max={1} step={0.01} onChange={setSwing} format={value => `${Math.round(value * 68)}°`} />
        <NumberControl label="curl" value={curl} min={0} max={1} step={0.01} onChange={setCurl} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="yaw" value={heading} min={-70} max={70} step={1} onChange={setHeading} format={value => `${value}°`} />
      </> : <Hint>It yaws toward your pointer. Click and it darts.</Hint>}
      <p className="text-[11px] text-muted-foreground">Fore and hind wings beat half a cycle apart. A wing loses span to the cosine of its own stroke angle.</p>
    </>}>
      <RobotDragonfly view={view} size={340} variant={variant} label="ODONATA / 04"
        {...(drive === "manual" ? { phase, swing, curl, heading } : { behavior: drive })} />
    </Bench>
  )
}

function RobotBatDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<BatBehavior | "manual">("roost")
  const [phase, setPhase] = React.useState(0.25)
  const [spread, setSpread] = React.useState(1)
  const [flight, setFlight] = React.useState(1)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["roost", "flap", "glide", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="beat" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="spread" value={spread} min={0} max={1} step={0.01} onChange={setSpread} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="flight" value={flight} min={0} max={1} step={0.01} onChange={setFlight} format={value => (value < 0.5 ? "hanging" : "airborne")} />
      </> : <Hint>The head tracks your pointer. Click and it drops off the beam.</Hint>}
      <p className="text-[11px] text-muted-foreground">The membrane is drawn through the finger-strut tips, so furling deforms one surface.</p>
    </>}>
      <RobotBat view={view} size={340} variant={variant} label="CHIRO / 02"
        {...(drive === "manual" ? { phase, spread, flight } : { behavior: drive })} />
    </Bench>
  )
}

function RobotJellyfishDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<JellyfishBehavior | "manual">("pulse")
  const [phase, setPhase] = React.useState(0.15)
  const [contraction, setContraction] = React.useState(0.7)
  const [arms, setArms] = React.useState(9)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["pulse", "drift", "bloom", "manual"] as const} onChange={setDrive} />
      <NumberControl label="arms" value={arms} min={3} max={16} step={1} onChange={setArms} />
      {drive === "manual" ? <>
        <NumberControl label="cycle" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="squeeze" value={contraction} min={0} max={1} step={0.01} onChange={setContraction} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The curtain leans toward your pointer. Click and the bell contracts hard.</Hint>}
      <p className="text-[11px] text-muted-foreground">One number narrows, deepens and flares the whole bell. It squeezes fast and relaxes slow.</p>
    </>}>
      <RobotJellyfish view={view} size={330} variant={variant} arms={arms} label="MEDUSA / 09"
        {...(drive === "manual" ? { phase, contraction } : { behavior: drive })} />
    </Bench>
  )
}

function RobotMantaDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<MantaBehavior | "manual">("cruise")
  const [phase, setPhase] = React.useState(0.3)
  const [amplitude, setAmplitude] = React.useState(0.6)
  const [bank, setBank] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["cruise", "soar", "bank", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="beat" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="swing" value={amplitude} min={0} max={1} step={0.01} onChange={setAmplitude} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="roll" value={bank} min={-1} max={1} step={0.05} onChange={setBank} format={value => `${Math.round(value * 34)}°`} />
      </> : <Hint>It banks toward your pointer. Click and it surges.</Hint>}
      <p className="text-[11px] text-muted-foreground">The wave runs root to tip across the span, not nose to tail. Rolling foreshortens the span for real.</p>
    </>}>
      <RobotManta view={view} size={350} variant={variant} label="MOBULA / 11"
        {...(drive === "manual" ? { phase, amplitude, bank } : { behavior: drive })} />
    </Bench>
  )
}

function RobotOctopusDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [drive, setDrive] = React.useState<OctopusBehavior | "manual">("crawl")
  const [phase, setPhase] = React.useState(0.25)
  const [curl, setCurl] = React.useState(0.45)
  const [jet, setJet] = React.useState(0.2)
  const [arms, setArms] = React.useState(8)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["crawl", "jet", "furl", "manual"] as const} onChange={setDrive} />
      <NumberControl label="arms" value={arms} min={4} max={10} step={1} onChange={setArms} />
      {drive === "manual" ? <>
        <NumberControl label="cycle" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="curl" value={curl} min={0} max={1} step={0.01} onChange={setCurl} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="jet" value={jet} min={0} max={1} step={0.01} onChange={setJet} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The arms nearest your pointer straighten toward it. Click and it jets.</Hint>}
      <p className="text-[11px] text-muted-foreground">Eight spines, each on its own phase, mounted on a ring — turn the camera and the ring shows.</p>
    </>}>
      <RobotOctopus view={view} size={330} variant={variant} arms={arms} label="CEPHALO / 08"
        {...(drive === "manual" ? { phase, curl, jet } : { behavior: drive })} />
    </Bench>
  )
}

function RobotSeahorseDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<SeahorseBehavior | "manual">("hold")
  const [phase, setPhase] = React.useState(0.2)
  const [grip, setGrip] = React.useState(0.9)
  const [sway, setSway] = React.useState(0.2)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["hold", "hover", "drift", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="cycle" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="grip" value={grip} min={0} max={1} step={0.01} onChange={setGrip} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="sway" value={sway} min={0} max={1} step={0.01} onChange={setSway} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The head tilts to your pointer. Click and it lets go of the holdfast.</Hint>}
      <p className="text-[11px] text-muted-foreground">Grip and steer are one control: the tail is the rudder taken to the stop.</p>
    </>}>
      <RobotSeahorse view={view} size={300} variant={variant} label="HIPPO / 03"
        {...(drive === "manual" ? { phase, grip, sway } : { behavior: drive })} />
    </Bench>
  )
}

function RobotAntDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<AntBehavior | "manual">("forage")
  const [phase, setPhase] = React.useState(0.3)
  const [heading, setHeading] = React.useState(0)
  const [bite, setBite] = React.useState(0.4)
  const [cargo, setCargo] = React.useState<AntCargo>("none")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["forage", "haul", "idle", "manual"] as const} onChange={setDrive} />
      <Segmented label="cargo" value={cargo} options={["none", "crumb", "leaf"] as const} onChange={setCargo} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="course" value={heading} min={-90} max={90} step={1} onChange={setHeading} format={value => `${value}°`} />
        <NumberControl label="jaws" value={bite} min={0} max={1} step={0.05} onChange={setBite} format={value => `${Math.round(value * 34)}°`} />
      </> : <Hint>The antennae track your pointer. Click and the mandibles work.</Hint>}
      <p className="text-[11px] text-muted-foreground">The course bends the body chain, so the head turns before the gaster follows.</p>
    </>}>
      <RobotAnt view={view} size={340} variant={variant} cargo={cargo} label="FORMICA / 06"
        {...(drive === "manual" ? { phase, heading, bite, gait: "tripod" as HexapodGait } : { behavior: drive })} />
    </Bench>
  )
}

function RobotScorpionDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<ScorpionBehavior | "manual">("stalk")
  const [phase, setPhase] = React.useState(0.3)
  const [arch, setArch] = React.useState(0.7)
  const [claw, setClaw] = React.useState(0.6)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["stalk", "guard", "strike", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="arch" value={arch} min={0} max={1} step={0.01} onChange={setArch} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="claw" value={claw} min={0} max={1} step={0.05} onChange={setClaw} format={value => `${Math.round(value * 26)}°`} />
      </> : <Hint>It turns toward your pointer. Click and the tail whips over.</Hint>}
      <p className="text-[11px] text-muted-foreground">The tail is solved in the sagittal plane: arching it raises the real height, so the plan footprint curls forward.</p>
    </>}>
      <RobotScorpion view={view} size={350} variant={variant} label="SCORPIO / 07"
        {...(drive === "manual" ? { phase, arch, claw, heading: 0, gait: "tripod" as HexapodGait } : { behavior: drive })} />
    </Bench>
  )
}

function RobotMantisDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<MantisBehavior | "manual">("stalk")
  const [reach, setReach] = React.useState(40)
  const [rise, setRise] = React.useState(-10)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["stalk", "strike", "groom", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="reach" value={reach} min={-20} max={80} step={1} onChange={setReach} />
        <NumberControl label="rise" value={rise} min={-40} max={50} step={1} onChange={setRise} />
      </> : <Hint>The forelimbs reach for your pointer. Click and they snap out past it.</Hint>}
      <p className="text-[11px] text-muted-foreground">A two-link chain solved to a real target. Out of reach clamps onto the circle rather than failing.</p>
    </>}>
      <RobotMantis view={view} size={350} variant={variant} label="MANTIS / 01"
        {...(drive === "manual" ? { target: { x: reach, y: rise } } : { behavior: drive })} />
    </Bench>
  )
}

function RobotCatDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<CatBehavior | "manual">("prowl")
  const [arch, setArch] = React.useState(0.6)
  const [crouch, setCrouch] = React.useState(0.3)
  const [tail, setTail] = React.useState(0.7)
  const [ears, setEars] = React.useState(0.8)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["prowl", "pounce", "arch", "sit", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="arch" value={arch} min={-1} max={1} step={0.01} onChange={setArch} format={value => value.toFixed(2)} />
        <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="tail" value={tail} min={-1} max={1} step={0.01} onChange={setTail} format={value => value.toFixed(2)} />
        <NumberControl label="ears" value={ears} min={-1} max={1} step={0.01} onChange={setEars} format={value => value.toFixed(2)} />
      </> : <Hint>The head, ears and eyes follow your pointer. Click and it pounces.</Hint>}
      <p className="text-[11px] text-muted-foreground">The shoulder and the hip are the two ends of one solved spine, so the arch moves the leg roots and the legs are solved from wherever it puts them.</p>
    </>}>
      <RobotCat view={view} size={360} variant={variant} label="FELIS / 13"
        {...(drive === "manual" ? { arch, crouch, tail, ears } : { behavior: drive })} />
    </Bench>
  )
}

function RobotDogDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<DogBehavior | "manual">("trot")
  const [arch, setArch] = React.useState(0)
  const [crouch, setCrouch] = React.useState(0.25)
  const [tail, setTail] = React.useState(0.5)
  const [wag, setWag] = React.useState(-0.7)
  const [nose, setNose] = React.useState(0.2)
  const [ears, setEars] = React.useState(0.8)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["trot", "sniff", "sit", "alert", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="arch" value={arch} min={-1} max={1} step={0.01} onChange={setArch} format={value => value.toFixed(2)} />
        <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="nose" value={nose} min={0} max={1} step={0.01} onChange={setNose} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="tail" value={tail} min={-1} max={1} step={0.01} onChange={setTail} format={value => value.toFixed(2)} />
        <NumberControl label="wag" value={wag} min={-1} max={1} step={0.01} onChange={setWag} format={value => value.toFixed(2)} />
        <NumberControl label="ears" value={ears} min={-1} max={1} step={0.01} onChange={setEars} format={value => value.toFixed(2)} />
      </> : <Hint>The head, ears and eyes follow your pointer, and the wag picks up. Click and it barks.</Hint>}
      <p className="text-[11px] text-muted-foreground">The hip is a spine joint; the shoulder is the far end of a scapula that swings on the ribcage. The tail is solved across the centre plane, so turn the camera to plan and the wag opens out.</p>
    </>}>
      <RobotDog view={view} size={360} variant={variant} label="CANIS / 07"
        {...(drive === "manual" ? { arch, crouch, tail, wag, nose, ears } : { behavior: drive })} />
    </Bench>
  )
}

function RobotPolarBearDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<PolarBearBehavior | "manual">("swim")
  const [swim, setSwim] = React.useState(0.5)
  const [neck, setNeck] = React.useState(0.2)
  const [crouch, setCrouch] = React.useState(0.2)
  const [strokes, setStrokes] = React.useState(1)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["swim", "plod", "stalk", "rear", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="swim" value={swim} min={0} max={1} step={0.01} onChange={setSwim} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="neck" value={neck} min={-1} max={1} step={0.01} onChange={setNeck} format={value => value.toFixed(2)} />
        <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Drag up and down to work the handover: the floor at the bottom of the box, afloat at the top.</Hint>}
      <NumberControl label="strokes" value={strokes} min={0.25} max={4} step={0.25} onChange={setStrokes} format={value => `${value}×`} />
      <p className="text-[11px] text-muted-foreground">One number moves the weight from four soles to the water. The forelimbs do not switch animation — the same solve follows the paw onto a stroke path.</p>
    </>}>
      <RobotPolarBear view={view} size={360} variant={variant} strokes={strokes} showContacts label="URSUS / 02"
        {...(drive === "manual" ? { swim, neck, crouch, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotPandaDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<PandaBehavior | "manual">("feed")
  const [sit, setSit] = React.useState(1)
  const [grip, setGrip] = React.useState(0.8)
  const [stalkWidth, setStalkWidth] = React.useState(6)
  const [support, setSupport] = React.useState(false)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["feed", "sit", "amble", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="sit" value={sit} min={0} max={1} step={0.01} onChange={setSit} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Your pointer is the stalk: both forepaws are solved to wherever it is, and a click takes a bite.</Hint>}
      <NumberControl label="grip" value={grip} min={0} max={1} step={0.01} onChange={setGrip} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="stalk" value={stalkWidth} min={0} max={9} step={0.5} onChange={setStalkWidth} format={value => `${value}u`} />
      <Segmented label="support" value={support ? "on" : "off"} options={["on", "off"] as const} onChange={value => setSupport(value === "on")} />
      <p className="text-[11px] text-muted-foreground">A fatter stalk rides the thumb further open at the same grip — the pad gap is an output. Sitting puts a third contact on the floor, which is what the two forelimbs are freed by.</p>
    </>}>
      <RobotPanda view={view} size={340} variant={variant} grip={grip} stalkWidth={stalkWidth} showSupport={support} label="URSUS / 03"
        {...(drive === "manual" ? { sit, behavior: "sit" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotBearDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<BearBehavior | "manual">("rear")
  const [rear, setRear] = React.useState(0.8)
  const [balance, setBalance] = React.useState(1)
  const [crouch, setCrouch] = React.useState(0.2)
  const [arch, setArch] = React.useState(0)
  const [dig, setDig] = React.useState(0)
  const [support, setSupport] = React.useState(true)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["amble", "rear", "forage", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="rear" value={rear} min={0} max={1} step={0.01} onChange={setRear} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="balance" value={balance} min={0} max={1} step={0.01} onChange={setBalance} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="arch" value={arch} min={-1} max={1} step={0.01} onChange={setArch} format={value => value.toFixed(2)} />
        <NumberControl label="dig" value={dig} min={0} max={1} step={0.01} onChange={setDig} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>Drag up and down to rear it — arrows step 10%, Home and End are the floor and full height. The head follows your pointer.</Hint>}
      <Segmented label="support" value={support ? "on" : "off"} options={["on", "off"] as const} onChange={value => setSupport(value === "on")} />
      <p className="text-[11px] text-muted-foreground">Rearing takes the base of support from four soles to two. Take balance to 0 at a full rear and the centre of mass leaves the base: the marker goes red, because that pose falls over.</p>
    </>}>
      <RobotBear view={view} size={360} variant={variant} showSupport={support} label="URSUS / 01"
        {...(drive === "manual" ? { rear, balance, crouch, arch, dig, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotFoxDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<FoxBehavior | "manual">("mouse")
  const [pitch, setPitch] = React.useState(0.6)
  const [crouch, setCrouch] = React.useState(0.22)
  const [tail, setTail] = React.useState(0.4)
  const [counterweight, setCounterweight] = React.useState(1)
  const [bearing, setBearing] = React.useState(-0.4)
  const [range, setRange] = React.useState(0.8)
  const [ears, setEars] = React.useState(0.9)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["mouse", "trot", "listen", "curl", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="pitch" value={pitch} min={-1} max={1} step={0.01} onChange={setPitch} format={value => value.toFixed(2)} />
        <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="tail" value={tail} min={-1} max={1} step={0.01} onChange={setTail} format={value => value.toFixed(2)} />
        <NumberControl label="counterweight" value={counterweight} min={0} max={1} step={0.01} onChange={setCounterweight} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="bearing" value={bearing} min={-1} max={1} step={0.01} onChange={setBearing} format={value => `${Math.round(value * 75)}\u00b0`} />
        <NumberControl label="range" value={range} min={0} max={1} step={0.01} onChange={setRange} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="ears" value={ears} min={-1} max={1} step={0.01} onChange={setEars} format={value => value.toFixed(2)} />
      </> : <Hint>Your pointer is the quarry: both ears pan onto it, and they converge as it comes down the frame. Click and it dives.</Hint>}
      <p className="text-[11px] text-muted-foreground">The hip is the one joint the pitch does not move. Take the counterweight to 100% and the brush stops being something you set and becomes something the body does.</p>
    </>}>
      <RobotFox view={view} size={360} variant={variant} label="VULPES / 09"
        {...(drive === "manual" ? { pitch, crouch, tail, counterweight, bearing, range, ears } : { behavior: drive })} />
    </Bench>
  )
}

function RobotHorseDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<HorseBehavior>("walk")
  const [gait, setGait] = React.useState<EquineGait | "behavior">("behavior")
  const [lead, setLead] = React.useState<GaitLead>("right")
  const [balance, setBalance] = React.useState(1)
  const [neck, setNeck] = React.useState(0.62)
  const [tail, setTail] = React.useState(0.3)
  const [crouch, setCrouch] = React.useState(0.14)
  const [contacts, setContacts] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="behavior" value={drive} options={["walk", "trot", "canter", "gallop", "graze", "static"] as const} onChange={setDrive} />
      <Segmented label="gait" value={gait} options={["behavior", "halt", "walk", "trot", "pace", "canter", "gallop"] as const} onChange={setGait} />
      <Segmented label="lead" value={lead} options={["right", "left"] as const} onChange={setLead} />
      <NumberControl label="balance" value={balance} min={0} max={1} step={0.01} onChange={setBalance} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="neck" value={neck} min={-1} max={1} step={0.01} onChange={setNeck} format={value => value.toFixed(2)} />
      <NumberControl label="tail" value={tail} min={-1} max={1} step={0.01} onChange={setTail} format={value => value.toFixed(2)} />
      <NumberControl label="crouch" value={crouch} min={0} max={1} step={0.01} onChange={setCrouch} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="contacts" value={contacts} options={["on", "off"] as const} onChange={setContacts} />
      <Hint>Drag across it to scrub the stride one footfall at a time; arrows step it, End hands it back. The head follows your pointer.</Hint>
      <p className="text-[11px] text-muted-foreground">A gait here is a set of touchdown instants, and the beat is counted off them — a pace is a trot&apos;s two beats on the other diagonal. Watch a fetlock: nobody sets that joint, it sits where the load puts it. Take the balance to 0 and the nod stops, because the nod is the forehand loading.</p>
    </>}>
      <RobotHorse view={view} size={380} variant={variant} behavior={drive} lead={lead}
        balance={balance} neck={neck} tail={tail} crouch={crouch} showContacts={contacts === "on"}
        label="EQUUS / 01" {...(gait === "behavior" ? {} : { gait })} />
    </Bench>
  )
}

function RobotPegasusDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<PegasusBehavior | "manual">("launch")
  const [lift, setLift] = React.useState(0.5)
  const [spread, setSpread] = React.useState(0.9)
  const [beat, setBeat] = React.useState(0.15)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["launch", "canter", "soar", "hover", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="lift" value={lift} min={0} max={1} step={0.01} onChange={setLift} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="spread" value={spread} min={0} max={1} step={0.01} onChange={setSpread} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="beat" value={beat} min={0} max={1} step={0.01} onChange={setBeat} format={value => value.toFixed(2)} />
      </> : <Hint>Drag up and down to work the handover: the fetlocks let go, the legs fold, the stride dies away and the wings take it. The head follows your pointer.</Hint>}
      <p className="text-[11px] text-muted-foreground">One number splits the animal&apos;s weight between its legs and its wings, and four things answer it at once. Switch to plan or front to see the span — a side elevation foreshortens it, which is what a side elevation of a wing does.</p>
    </>}>
      <RobotPegasus view={view} size={400} variant={variant} label="PEGASUS / 02"
        {...(drive === "manual" ? { lift, spread, beat, gait: "canter" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotCamelDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<CamelBehavior>("pace")
  const [ground, setGround] = React.useState(0.85)
  const [reserve, setReserve] = React.useState(0.8)
  const [contacts, setContacts] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="behavior" value={drive} options={["pace", "walk", "trot", "couch", "static"] as const} onChange={setDrive} />
      <NumberControl label="ground" value={ground} min={0} max={1} step={0.01} onChange={setGround} format={value => value < 0.2 ? "rock" : value > 0.7 ? "sand" : `${Math.round(value * 100)}%`} />
      <NumberControl label="reserve" value={reserve} min={0} max={1} step={0.01} onChange={setReserve} format={value => `${Math.round(value * 100)}%`} />
      <Segmented label="contacts" value={contacts} options={["on", "off"] as const} onChange={setContacts} />
      <Hint>Drag up and down to work the ground: firm at the top, soft at the bottom, so dragging down is sinking.</Hint>
      <p className="text-[11px] text-muted-foreground">Only the feet carrying weight go into the sand, each as deep as what it carries — and the pad opens under that load, which drops its pressure and is why it does not go deeper. Switch to trot and the roll all but stops: a trot&apos;s support is diagonal, a pace&apos;s is all on one side.</p>
    </>}>
      <RobotCamel view={view} size={380} variant={variant} behavior={drive}
        ground={ground} reserve={reserve} showContacts={contacts === "on"} label="CAMELUS / 03" />
    </Bench>
  )
}

function SpringHopperDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SpringHopperBehavior | "manual">("hop")
  const [compression, setCompression] = React.useState(0.5)
  const [stiffness, setStiffness] = React.useState(40)
  const [height, setHeight] = React.useState(0.5)
  const timings = hopTimings({ height, stiffness })
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["hop", "bound", "pump", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="stiffness" value={stiffness} min={4} max={200} step={2} onChange={setStiffness} />
      <NumberControl label="height" value={height} min={0} max={1} step={0.05} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="load" value={compression} min={0} max={1} step={0.01} onChange={setCompression} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag down inside the frame to load the spring, then let go. Soften the spring under a tall hop and it bottoms out on its own coils.</Hint>}
      <Readout rows={[
        ["contact", `${timings.contact.toFixed(2)}s`],
        ["flight", `${timings.flight.toFixed(2)}s`],
        ["duty", `${Math.round(timings.duty * 100)}%`],
      ]} />
      <Hint>Neither of those times is a control: both fall out of the drop height and the spring rate.</Hint>
    </>}>
      <SpringHopper view={view} size={320} variant={variant} stiffness={stiffness} height={height}
        label="HOPPER / 01" interactive
        {...(drive === "manual" ? { compression } : { behavior: drive })} />
    </Bench>
  )
}

function BallHopperDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<BallHopperBehavior | "manual">("bounce")
  const [altitude, setAltitude] = React.useState(0.7)
  const [restitution, setRestitution] = React.useState(0.66)
  const [stiffness, setStiffness] = React.useState(40)
  const bounces = dropTimings({ height: 0.6, stiffness, restitution }).bounces
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["bounce", "settle", "skitter", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="restitution" value={restitution} min={0} max={1} step={0.02} onChange={setRestitution} format={value => value.toFixed(2)} />
      <NumberControl label="stiffness" value={stiffness} min={4} max={200} step={2} onChange={setStiffness} />
      {drive === "manual"
        ? <NumberControl label="altitude" value={altitude} min={0} max={1} step={0.01} onChange={setAltitude} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag up inside the frame to lift it, then let go. Try `settle` — it bounces lower each time and sits down.</Hint>}
      <Readout rows={[["bounces to rest", `${bounces}`]]} />
      <Hint>The shell keeps its volume: flattened on impact, it has to get exactly that much wider — which reads as a wider ball in plan view.</Hint>
    </>}>
      <BallHopper view={view} size={300} variant={variant} restitution={restitution} stiffness={stiffness}
        label="BALL / 02" interactive
        {...(drive === "manual" ? { altitude } : { behavior: drive })} />
    </Bench>
  )
}

function RobotFrogDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<FrogBehavior | "manual">("crouch")
  const [extend, setExtend] = React.useState(0.6)
  const [altitude, setAltitude] = React.useState(0.4)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["crouch", "hop", "swim", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="extend" value={extend} min={0} max={1} step={0.01} onChange={setExtend} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="height" value={altitude} min={0} max={1} step={0.01} onChange={setAltitude} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The eyes track your pointer. Click and it jumps.</Hint>}
      <p className="text-[11px] text-muted-foreground">Two numbers are the whole animal: the knee is solved from the hip and the ankle at every point of the jump.</p>
    </>}>
      <RobotFrog view={view} size={340} variant={variant} label="ANURA / 05"
        {...(drive === "manual" ? { extend, altitude } : { behavior: drive })} />
    </Bench>
  )
}

function RobotTurtleDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [drive, setDrive] = React.useState<TurtleBehavior | "manual">("plod")
  const [phase, setPhase] = React.useState(0.3)
  const [retract, setRetract] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["plod", "bask", "retract", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
        <NumberControl label="retract" value={retract} min={0} max={1} step={0.01} onChange={setRetract} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The head tracks your pointer. Click and everything comes in.</Hint>}
      <p className="text-[11px] text-muted-foreground">The shell is drawn after the limbs, so withdrawing is geometry rather than a fade.</p>
    </>}>
      <RobotTurtle view={view} size={340} variant={variant} label="TESTUDO / 12"
        {...(drive === "manual" ? { phase, retract, gait: "wave" as HexapodGait } : { behavior: drive })} />
    </Bench>
  )
}

function RobotInchwormDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [drive, setDrive] = React.useState<InchwormBehavior | "manual">("loop")
  const [span, setSpan] = React.useState(0.3)
  const [reach, setReach] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["loop", "rear", "measure", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="span" value={span} min={0} max={1} step={0.01} onChange={setSpan} format={value => `${Math.round(78 + value * 30)}u`} />
        <NumberControl label="reach" value={reach} min={0} max={1} step={0.01} onChange={setReach} format={value => `${Math.round(value * 100)}%`} />
      </> : <Hint>The front end lifts toward your pointer. Click and it rears right up.</Hint>}
      <p className="text-[11px] text-muted-foreground">Close the span and the loop rises: the body is a fixed length, and the arch is solved from the chord.</p>
    </>}>
      <RobotInchworm view={view} size={340} variant={variant} label="GEOMETRA / 10"
        {...(drive === "manual" ? { span, reach } : { behavior: drive })} />
    </Bench>
  )
}


function PlanetaryGearboxDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<GearboxBehavior | "manual">("run")
  const [angle, setAngle] = React.useState(60)
  const [sun, setSun] = React.useState(16)
  const [planet, setPlanet] = React.useState(12)
  const [planets, setPlanets] = React.useState(3)
  const [housing, setHousing] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["run", "jog", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="housing" value={housing} options={["on", "off"] as const} onChange={setHousing} />
      <NumberControl label="sun" value={sun} min={8} max={40} onChange={setSun} format={v => `${v}T`} />
      <NumberControl label="planet" value={planet} min={6} max={40} onChange={setPlanet} format={v => `${v}T`} />
      <NumberControl label="planets" value={planets} min={3} max={5} onChange={setPlanets} />
      {drive === "manual"
        ? <NumberControl label="input" value={angle} min={0} max={720} onChange={setAngle} format={v => `${v}°`} />
        : <Hint>Drag round the centre to wind the input shaft. The ring never moves.</Hint>}
    </>}>
      <PlanetaryGearbox view={view} size={320} variant={variant} sunTeeth={sun} planetTeeth={planet}
        planets={planets} showHousing={housing === "on"} label="STAGE / 01"
        {...(drive === "manual" ? { angle } : { behavior: drive })} interactive />
    </Bench>
  )
}

function BeltDriveDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<BeltDriveBehavior | "manual">("run")
  const [travel, setTravel] = React.useState(0.5)
  const [driveTeeth, setDriveTeeth] = React.useState(18)
  const [drivenTeeth, setDrivenTeeth] = React.useState(30)
  const [tension, setTension] = React.useState(45)
  const [idler, setIdler] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["run", "shuttle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="idler" value={idler} options={["on", "off"] as const} onChange={setIdler} />
      <NumberControl label="drive" value={driveTeeth} min={10} max={48} onChange={setDriveTeeth} format={v => `${v}T`} />
      <NumberControl label="driven" value={drivenTeeth} min={10} max={48} onChange={setDrivenTeeth} format={v => `${v}T`} />
      <NumberControl label="tension" value={tension} min={0} max={100} onChange={setTension} format={v => `${v}%`} />
      {drive === "manual"
        ? <NumberControl label="travel" value={travel} min={-3} max={3} step={0.05} onChange={setTravel} format={v => `${v.toFixed(2)} turns`} />
        : <Hint>Drag the belt along its run. Wind the idler down and the belt gets longer.</Hint>}
    </>}>
      <BeltDrive view={view} size={340} variant={variant} driveTeeth={driveTeeth} drivenTeeth={drivenTeeth}
        tension={tension / 100} showIdler={idler === "on"} label="DRIVE / 02"
        {...(drive === "manual" ? { travel } : { behavior: drive })} interactive />
    </Bench>
  )
}

function CableCarrierDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<CableCarrierBehavior | "manual">("cycle")
  const [travel, setTravel] = React.useState(40)
  const [links, setLinks] = React.useState(26)
  const [cables, setCables] = React.useState(3)
  const [rail, setRail] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["cycle", "creep", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="rail" value={rail} options={["on", "off"] as const} onChange={setRail} />
      <NumberControl label="links" value={links} min={8} max={40} onChange={setLinks} />
      <NumberControl label="cables" value={cables} min={0} max={4} onChange={setCables} />
      {drive === "manual"
        ? <NumberControl label="travel" value={travel} min={0} max={100} onChange={setTravel} format={v => `${v}%`} />
        : <Hint>Drag the carriage. The fold follows at exactly half its speed.</Hint>}
    </>}>
      <CableCarrier view={view} size={360} variant={variant} links={links} cables={cables}
        showRail={rail === "on"} label="AXIS / 03"
        {...(drive === "manual" ? { travel: travel / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function MecanumWheelDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<MecanumBehavior | "manual">("roll")
  const [angle, setAngle] = React.useState(30)
  const [hand, setHand] = React.useState<MecanumHand>("right")
  const [rollers, setRollers] = React.useState(9)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="hand" value={hand} options={["left", "right"] as const} onChange={setHand} />
      <Segmented label="drive" value={drive} options={["roll", "crab", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="rollers" value={rollers} min={6} max={14} onChange={setRollers} />
      {drive === "manual"
        ? <NumberControl label="hub" value={angle} min={0} max={360} onChange={setAngle} format={v => `${v}°`} />
        : <Hint>Drag round the hub to spin it. Flip the hand and the roller skew reverses.</Hint>}
    </>}>
      <MecanumWheel view={view} size={320} variant={variant} hand={hand} rollers={rollers} label="CORNER / 04"
        {...(drive === "manual" ? { angle } : { behavior: drive })} interactive />
    </Bench>
  )
}

function ToolChangerDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<ToolChangerBehavior | "manual">("dock")
  const [engagement, setEngagement] = React.useState(100)
  const [tool, setTool] = React.useState<ToolChangerTool>("gripper")
  const [balls, setBalls] = React.useState(6)
  const [dock, setDock] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="tool" value={tool} options={["gripper", "spindle", "vacuum", "none"] as const} onChange={setTool} />
      <Segmented label="drive" value={drive} options={["dock", "latch", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="dock" value={dock} options={["on", "off"] as const} onChange={setDock} />
      <NumberControl label="balls" value={balls} min={3} max={8} onChange={setBalls} />
      {drive === "manual"
        ? <NumberControl label="engage" value={engagement} min={0} max={100} onChange={setEngagement} format={v => `${v}%`} />
        : <Hint>Drag the tool half up to the coupler. Past 60% the piston drives the lock.</Hint>}
    </>}>
      <ToolChanger view={view} size={280} variant={variant} tool={tool} balls={balls}
        showDock={dock === "on"} label="CHANGER / 05"
        {...(drive === "manual" ? { engagement: engagement / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function SuctionGripperDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SuctionBehavior | "manual">("cycle")
  const [descent, setDescent] = React.useState(90)
  const [cups, setCups] = React.useState(5)
  const [vacuum, setVacuum] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["cycle", "breathe", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="vacuum" value={vacuum} options={["on", "off"] as const} onChange={setVacuum} />
      <NumberControl label="cups" value={cups} min={2} max={8} onChange={setCups} />
      {drive === "manual"
        ? <NumberControl label="descent" value={descent} min={0} max={100} onChange={setDescent} format={v => `${v}%`} />
        : <Hint>Drag the bar down. Past contact the stroke goes into the bellows, not the axis.</Hint>}
    </>}>
      <SuctionGripper view={view} size={340} variant={variant} cups={cups} vacuum={vacuum === "on"}
        label="PICK / 06"
        {...(drive === "manual" ? { descent: descent / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function RobotHandDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<HandBehavior | "manual">("grip")
  const [curl, setCurl] = React.useState(75)
  const [grasp, setGrasp] = React.useState<HandGrasp>("pinch")
  const [side, setSide] = React.useState<"left" | "right">("right")
  const [spread, setSpread] = React.useState(0)
  const [wristPitch, setWristPitch] = React.useState(0)
  const [wrist, setWrist] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="grasp" value={grasp} options={GRASPS} onChange={setGrasp} />
      <Segmented label="hand" value={side} options={["left", "right"] as const} onChange={setSide} />
      <Segmented label="drive" value={drive} options={["grip", "wave", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="cuff" value={wrist} options={["on", "off"] as const} onChange={setWrist} />
      <NumberControl label="spread" value={spread} min={-100} max={100} onChange={setSpread} format={v => `${v}%`} />
      <NumberControl label="wrist" value={wristPitch} min={-70} max={70} onChange={setWristPitch} format={v => `${v}\u00B0`} />
      {drive === "manual"
        ? <NumberControl label="curl" value={curl} min={0} max={100} onChange={setCurl} format={v => `${v}%`} />
        : <Hint>Drag up and down to close the hand; click to step to the next grasp. A curled hand reads best from iso or profile — pointed at the camera it foreshortens into stubs, which is what a real one does.</Hint>}
      <Readout rows={[["grasp", grasp], ["hand", side]]} />
    </>}>
      <RobotHand view={view} size={300} variant={variant} grasp={grasp} side={side}
        spread={spread / 100} wristPitch={wristPitch} showWrist={wrist === "on"}
        label="HAND / 07"
        {...(drive === "manual" ? { curl: curl / 100 } : { behavior: drive })}
        interactive onGraspChange={setGrasp} />
    </Bench>
  )
}

function RobotFootDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<FootBehavior | "manual">("step")
  const [roll, setRoll] = React.useState(45)
  const [side, setSide] = React.useState<"left" | "right">("right")
  const [load, setLoad] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="foot" value={side} options={["left", "right"] as const} onChange={setSide} />
      <Segmented label="drive" value={drive} options={["step", "rock", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="load" value={load} options={["on", "off"] as const} onChange={setLoad} />
      {drive === "manual"
        ? <NumberControl label="roll" value={roll} min={0} max={100} onChange={setRoll} format={v => `${v}%`} />
        : <Hint>Drag left and right to roll the foot from heel strike to toe-off. The toe plate is hinged at the ball, so pushing off lifts the heel rather than burying the toe.</Hint>}
    </>}>
      <RobotFoot view={view} size={320} variant={variant} side={side} showLoad={load === "on"}
        label="FOOT / 01"
        {...(drive === "manual" ? { roll: roll / 100 } : { behavior: drive })}
        interactive />
    </Bench>
  )
}

function RobotLegDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<LegBehavior>("stride")
  const [side, setSide] = React.useState<"left" | "right">("right")
  const [stride, setStride] = React.useState(70)
  const [lift, setLift] = React.useState(60)
  const [target, setTarget] = React.useState({ x: 0, y: 7 })
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="leg" value={side} options={["left", "right"] as const} onChange={setSide} />
      <Segmented label="drive" value={behavior} options={["stride", "squat", "kick", "static"] as const} onChange={setBehavior} />
      <NumberControl label="stride" value={stride} min={0} max={100} onChange={setStride} format={v => `${v}%`} />
      <NumberControl label="lift" value={lift} min={0} max={100} onChange={setLift} format={v => `${v}%`} />
      <Hint>Drag anywhere in the frame and the foot follows your pointer; the hip and knee solve to it, and letting go eases the leg back into its cycle.</Hint>
      <Readout rows={[["foot", `${Math.round(target.x)}, ${Math.round(target.y)}`]]} />
    </>}>
      <RobotLeg view={view} size={300} variant={variant} side={side} behavior={behavior}
        stride={stride / 100} lift={lift / 100} label="LEG / 02"
        interactive onTargetChange={setTarget} />
    </Bench>
  )
}

function RobotTorsoDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TorsoBehavior | "manual">("breathe")
  const [lean, setLean] = React.useState(8)
  const [twist, setTwist] = React.useState(0)
  const [sway, setSway] = React.useState(0)
  const [breath, setBreath] = React.useState(60)
  const [ribs, setRibs] = React.useState(7)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["breathe", "twist", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="ribs" value={ribs} min={3} max={10} onChange={setRibs} />
      <NumberControl label="sway" value={sway} min={-25} max={25} onChange={setSway} format={v => `${v}\u00B0`} />
      {drive === "manual" ? <>
        <NumberControl label="lean" value={lean} min={-35} max={45} onChange={setLean} format={v => `${v}\u00B0`} />
        <NumberControl label="twist" value={twist} min={-40} max={40} onChange={setTwist} format={v => `${v}\u00B0`} />
        <NumberControl label="breath" value={breath} min={0} max={100} onChange={setBreath} format={v => `${v}%`} />
      </> : <Hint>Drag across the frame to twist the shoulders against the hips and up and down to lean. Every vertebra keeps its length whatever you do to it.</Hint>}
    </>}>
      <RobotTorso view={view} size={300} variant={variant} ribs={ribs} sway={sway}
        label="TORSO / 03"
        {...(drive === "manual"
          ? { lean, twist, breath: breath / 100 }
          : { behavior: drive })}
        interactive />
    </Bench>
  )
}

function RobotSkeletonDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SkeletonBehavior | "manual">("walk")
  const [gait, setGait] = React.useState<SkeletonGait>("walk")
  const [phase, setPhase] = React.useState(20)
  const [stance, setStance] = React.useState(100)
  const [stride, setStride] = React.useState(70)
  const [grasp, setGrasp] = React.useState<HandGrasp>("open")
  const [grip, setGrip] = React.useState(25)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["walk", "run", "march", "idle", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" && <Segmented label="gait" value={gait} options={["stand", "walk", "run", "march"] as const} onChange={setGait} />}
      <Segmented label="grasp" value={grasp} options={GRASPS} onChange={setGrasp} />
      <NumberControl label="stance" value={stance} min={0} max={100} onChange={setStance} format={v => `${v}%`} />
      <NumberControl label="stride" value={stride} min={0} max={100} onChange={setStride} format={v => `${v}%`} />
      <NumberControl label="grip" value={grip} min={0} max={100} onChange={setGrip} format={v => `${v}%`} />
      {drive === "manual"
        ? <NumberControl label="phase" value={phase} min={0} max={99} onChange={setPhase} format={v => `${v}%`} />
        : <Hint>Drag across the frame to scrub the gait by hand. Run drops the duty factor under a half, which is what puts both feet in the air — the readout says so when it happens.</Hint>}
    </>}>
      <RobotSkeleton view={view} size={300} variant={variant} stance={stance / 100}
        stride={stride / 100} grasp={grasp} grip={grip / 100} label="FRAME / 05"
        {...(drive === "manual" ? { gait, phase: phase / 100 } : { behavior: drive })}
        interactive />
    </Bench>
  )
}
function MotionPlatformDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<MotionPlatformBehavior | "manual">("sway")
  const [roll, setRoll] = React.useState(12)
  const [pitch, setPitch] = React.useState(-6)
  const [heave, setHeave] = React.useState(6)
  const [payload, setPayload] = React.useState<MotionPlatformPayload>("deck")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="payload" value={payload} options={["deck", "camera", "none"] as const} onChange={setPayload} />
      <Segmented label="drive" value={drive} options={["settle", "sway", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual" ? <>
        <NumberControl label="roll" value={roll} min={-24} max={24} onChange={setRoll} format={v => `${v}°`} />
        <NumberControl label="pitch" value={pitch} min={-24} max={24} onChange={setPitch} format={v => `${v}°`} />
        <NumberControl label="heave" value={heave} min={-16} max={16} onChange={setHeave} />
      </> : <Hint>Drag the deck to tip it. Ask for more than the legs have and it says so.</Hint>}
    </>}>
      <MotionPlatform view={view} size={340} variant={variant} payload={payload} label="BASE / 08"
        {...(drive === "manual" ? { roll, pitch, heave } : { behavior: drive })} interactive />
    </Bench>
  )
}

function ClamshellLaptopDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<LaptopBehavior | "manual">("open")
  const [lid, setLid] = React.useState(105)
  const [travel, setTravel] = React.useState(135)
  const [screen, setScreen] = React.useState<LaptopScreen>("desktop")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["desktop", "code", "media", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["open", "adjust", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="travel" value={travel} min={90} max={150} onChange={setTravel} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="lid" value={lid} min={0} max={150} onChange={setLid} format={v => `${v}°`} />
        : <Hint>Drag up inside the frame to lift the lid. It stops at the travel the hinge has, and the screen only draws from a camera that can see it.</Hint>}
    </>}>
      <ClamshellLaptop view={view} size={330} variant={variant} screen={screen} travel={travel}
        label="CLAMSHELL / 01"
        {...(drive === "manual" ? { lid } : { behavior: drive })} interactive />
    </Bench>
  )
}

function SlateTabletDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TabletBehavior | "manual">("prop")
  const [recline, setRecline] = React.useState(70)
  const [leg, setLeg] = React.useState(46)
  const [screen, setScreen] = React.useState<TabletScreen>("sketch")
  const [stylus, setStylus] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["home", "sketch", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["prop", "sketch", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="stylus" value={stylus} options={["on", "off"] as const} onChange={setStylus} />
      <NumberControl label="leg" value={leg} min={20} max={80} onChange={setLeg} />
      {drive === "manual"
        ? <NumberControl label="recline" value={recline} min={0} max={100} onChange={setRecline} format={v => `${v}%`} />
        : <Hint>Drag the slate back. Wind the leg down past what the tilt needs and the stand folds instead of stretching.</Hint>}
    </>}>
      <SlateTablet view={view} size={320} variant={variant} screen={screen} leg={leg} stylus={stylus === "on"}
        label="SLATE / 02"
        {...(drive === "manual" ? { recline: recline / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function WheelPlayerDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<PlayerBehavior | "manual">("seek")
  const [rotation, setRotation] = React.useState(110)
  const [rows, setRows] = React.useState(8)
  const [screen, setScreen] = React.useState<PlayerScreen>("list")
  const [hold, setHold] = React.useState<"off" | "on">("off")
  const [row, setRow] = React.useState(2)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["list", "now-playing", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["scroll", "seek", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="hold" value={hold} options={["off", "on"] as const} onChange={setHold} />
      <NumberControl label="rows" value={rows} min={3} max={12} onChange={setRows} />
      {drive === "manual"
        ? <NumberControl label="wheel" value={rotation} min={-360} max={360} onChange={setRotation} format={v => `${v}°`} />
        : <Hint>Drag round the wheel with a thumb. One turn is one pass of the list, and hold takes the wheel away from everything at once.</Hint>}
      <Readout rows={[["row", `${row + 1} / ${rows}`]]} />
    </>}>
      <WheelPlayer view={view} size={230} variant={variant} screen={screen} rows={rows} locked={hold === "on"}
        label="PLAYER / 03" onRowChange={setRow}
        {...(drive === "manual" ? { rotation } : { behavior: drive })} interactive />
    </Bench>
  )
}

function SlabHandsetDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<HandsetBehavior | "manual">("nudge")
  const [turn, setTurn] = React.useState(0)
  const [orientation, setOrientation] = React.useState<HandsetOrientation>("portrait")
  const [screen, setScreen] = React.useState<HandsetScreen>("home")
  const [lenses, setLenses] = React.useState(3)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="hold" value={orientation} options={["portrait", "landscape"] as const} onChange={setOrientation} />
      <Segmented label="screen" value={screen} options={["home", "call", "map", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["turn", "nudge", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="lenses" value={lenses} min={1} max={4} onChange={setLenses} />
      {drive === "manual"
        ? <NumberControl label="turn" value={turn} min={-180} max={180} onChange={setTurn} format={v => `${v}°`} />
        : <Hint>Drag across the frame to turn it over — the whole width is one revolution. Edge on at a quarter, back toward you at a half.</Hint>}
    </>}>
      <SlabHandset view={view} size={250} variant={variant} screen={screen} orientation={orientation} lenses={lenses}
        label="HANDSET / 04"
        {...(drive === "manual" ? { turn } : { behavior: drive })} interactive />
    </Bench>
  )
}

function FoldingHandsetDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<FoldBehavior | "manual">("unfold")
  const [fold, setFold] = React.useState(108)
  const [travel, setTravel] = React.useState(180)
  const [radius, setRadius] = React.useState(3)
  const [screen, setScreen] = React.useState<FoldScreen>("split")
  const [cover, setCover] = React.useState<FoldCover>("clock")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["canvas", "split", "gallery", "off"] as const} onChange={setScreen} />
      <Segmented label="cover" value={cover} options={["clock", "alerts", "off"] as const} onChange={setCover} />
      <Segmented label="drive" value={drive} options={["unfold", "flex", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="travel" value={travel} min={90} max={180} onChange={setTravel} format={v => `${v}°`} />
      <NumberControl label="bend" value={radius} min={2} max={14} onChange={setRadius} />
      {drive === "manual"
        ? <NumberControl label="fold" value={fold} min={0} max={180} onChange={setFold} format={v => `${v}°`} />
        : <Hint>Drag up inside the frame to open it. Wind the bend radius up and watch the display give the length back to the crease — past what the leaves have, it says pinched.</Hint>}
    </>}>
      <FoldingHandset view={view} size={330} variant={variant} screen={screen} cover={cover} travel={travel} radius={radius}
        label="FOLD / 06"
        {...(drive === "manual" ? { fold } : { behavior: drive })} interactive />
    </Bench>
  )
}

function WristTerminalDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TerminalBehavior | "manual">("pulse")
  const [crown, setCrown] = React.useState(90)
  const [ticks, setTicks] = React.useState(12)
  const [closure, setClosure] = React.useState(75)
  const [links, setLinks] = React.useState(7)
  const [screen, setScreen] = React.useState<TerminalScreen>("dial")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["dial", "rings", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["dial", "pulse", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="ticks" value={ticks} min={4} max={24} onChange={setTicks} />
      <NumberControl label="links" value={links} min={4} max={12} onChange={setLinks} />
      <NumberControl label="band" value={closure} min={0} max={100} onChange={setClosure} format={v => `${v}%`} />
      {drive === "manual"
        ? <NumberControl label="crown" value={crown} min={-360} max={360} onChange={setCrown} format={v => `${v}°`} />
        : <Hint>Drag round the face to work the crown. Open the band right up: it keeps its links and its length, it only straightens out.</Hint>}
    </>}>
      <WristTerminal view={view} size={230} variant={variant} screen={screen} ticks={ticks} links={links}
        closure={closure / 100} label="TERMINAL / 05"
        {...(drive === "manual" ? { crown } : { behavior: drive })} interactive />
    </Bench>
  )
}


function TurntableDeckDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TurntableBehavior | "manual">("play")
  const [progress, setProgress] = React.useState(0.25)
  const [cue, setCue] = React.useState<TurntableCue>("play")
  const [rpm, setRpm] = React.useState<"33" | "45" | "78">("33")
  const [at, setAt] = React.useState(0.25)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["play", "scratch", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="cue" value={cue} options={["play", "lift", "rest"] as const} onChange={setCue} />
      <Segmented label="rpm" value={rpm} options={["33", "45", "78"] as const} onChange={setRpm} />
      {drive === "manual"
        ? <NumberControl label="side" value={progress} min={0} max={1} step={0.01} onChange={setProgress} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag the platter to scrub. The stylus walks back out up the spiral, because the groove gears the arm to the platter.</Hint>}
      <Readout rows={[["side", `${Math.round(at * 100)}%`]]} />
    </>}>
      <TurntableDeck view={view} size={300} variant={variant} cue={cue} rpm={Number(rpm) as DeckRpm}
        label="DECK / 01" onProgressChange={setAt}
        {...(drive === "manual" ? { progress } : { behavior: drive })} interactive />
    </Bench>
  )
}

function GramophoneHornDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<GramophoneBehavior | "manual">("play")
  const [wind, setWind] = React.useState(0.7)
  const [progress, setProgress] = React.useState(0.3)
  const [mechanism, setMechanism] = React.useState<"on" | "off">("on")
  const [wound, setWound] = React.useState(0.7)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["play", "crank", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="mechanism" value={mechanism} options={["on", "off"] as const} onChange={setMechanism} />
      <NumberControl label="side" value={progress} min={0} max={1} step={0.05} onChange={setProgress} format={v => `${Math.round(v * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="wind" value={wind} min={0} max={1} step={0.02} onChange={setWind} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag round the crank to wind it — three turns is a full wind. Let it run down and the governor stops holding the speed up.</Hint>}
      <Readout rows={[["wind", `${Math.round(wound * 100)}%`]]} />
    </>}>
      <GramophoneHorn view={view} size={280} variant={variant} progress={progress}
        showMechanism={mechanism === "on"} label="HORN / 01" onWindChange={setWound}
        {...(drive === "manual" ? { wind } : { behavior: drive })} interactive />
    </Bench>
  )
}

function MusicBoxDrumDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<MusicBoxBehavior | "manual">("play")
  const [turn, setTurn] = React.useState(90)
  const [tines, setTines] = React.useState(12)
  const [fly, setFly] = React.useState<"on" | "off">("on")
  const [step, setStep] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["play", "cadence", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="fly" value={fly} options={["on", "off"] as const} onChange={setFly} />
      <NumberControl label="tines" value={tines} min={4} max={20} onChange={setTines} />
      {drive === "manual"
        ? <NumberControl label="barrel" value={turn} min={0} max={360} onChange={setTurn} format={v => `${v}°`} />
        : <Hint>Drag across to crank the barrel by hand. A pin bends its tine right up to the step and lets go on it — that is the pluck.</Hint>}
      <Readout rows={[["step", `${step + 1}`]]} />
    </>}>
      <MusicBoxDrum view={view} size={300} variant={variant} tines={tines}
        showFly={fly === "on"} label="BOX / 01" onStepChange={setStep}
        {...(drive === "manual" ? { turn } : { behavior: drive })} interactive />
    </Bench>
  )
}

/** Plain alternating figures, written for this bench. */
const buskerPatterns = {
  four: ["x...x...x...x...", "....x.......x...", "..x...x...x...x."],
  shuffle: ["x..x..x..x..x...", "......x.......x.", "x.x.x.x.x.x.x.x."],
  sparse: ["x.......x.......", "........x.......", "....x.......x..."],
} as const

/** Plain figures, written for this bench. */
const pianoRolls = {
  chord: {
    roll: ["x.......x.......", "..x.......x.....", "....x.......x...", "......x.......x.", ".x...x...x...x..", "...x...x...x...x"],
    lanes: [16, 28, 35, 40, 47, 52],
  },
  scale: {
    roll: ["x...............", "..x.............", "....x...........", "......x.........", "........x.......", "..........x.....", "............x...", "..............x."],
    lanes: [24, 26, 28, 29, 31, 33, 35, 36],
  },
  octaves: {
    roll: ["x...x...x...x...", "x...x...x...x...", "..x...x...x...x.", "..x...x...x...x."],
    lanes: [15, 39, 27, 51],
  },
} as const

function RobotGrandPianoDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<GrandPianoBehavior | "manual">("perform")
  const [figure, setFigure] = React.useState<keyof typeof pianoRolls>("chord")
  const [lid, setLid] = React.useState<"closed" | "half" | "full">("full")
  const [pedal, setPedal] = React.useState<GrandPianoPedal>("none")
  const [notes, setNotes] = React.useState(88)
  const [beat, setBeat] = React.useState(4)
  const [step, setStep] = React.useState(0)
  const figures = pianoRolls[figure] ?? pianoRolls.chord
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["perform", "rubato", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="roll" value={figure} options={["chord", "scale", "octaves"] as const} onChange={setFigure} />
      <Segmented label="lid" value={lid} options={["closed", "half", "full"] as const} onChange={setLid} />
      <Segmented label="pedal" value={pedal} options={["none", "damper", "shift"] as const} onChange={setPedal} />
      <NumberControl label="notes" value={notes} min={12} max={88} step={4} onChange={setNotes} />
      {drive === "manual"
        ? <NumberControl label="roll" value={beat} min={0} max={16} onChange={setBeat} format={v => `step ${v + 1}`} />
        : <Hint>Drag across to scrub the roll. Watch a hammer stop short of its string — the jack lets go before the blow, and the check catches it on the way back.</Hint>}
      <Readout rows={[["step", `${step + 1}`]]} />
    </>}>
      <RobotGrandPiano view={view} size={330} variant={variant} notes={notes}
        roll={figures.roll} lanes={figures.lanes} lid={lid} pedal={pedal}
        label="GRAND / 01" onStepChange={setStep}
        {...(drive === "manual" ? { beat } : { behavior: drive })} interactive />
    </Bench>
  )
}

function BuskerDroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<BuskerBehavior | "manual">("groove")
  const [beat, setBeat] = React.useState(0)
  const [figure, setFigure] = React.useState<keyof typeof buskerPatterns>("four")
  const [step, setStep] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["groove", "fill", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="figure" value={figure} options={["four", "shuffle", "sparse"] as const} onChange={setFigure} />
      {drive === "manual"
        ? <NumberControl label="beat" value={beat} min={0} max={16} step={0.25} onChange={setBeat} />
        : <Hint>Drag across to scrub the bar. The beaters come up slowly and drop on the step, which is the same curve that plucks a music box.</Hint>}
      <Readout rows={[["step", `${step + 1} / 16`]]} />
    </>}>
      <BuskerDroid view={view} size={300} variant={variant} pattern={buskerPatterns[figure]}
        label="BUSKER / 01" onStepChange={setStep}
        {...(drive === "manual" ? { beat } : { behavior: drive })} interactive />
    </Bench>
  )
}

function KeySwitchDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<KeySwitchBehavior | "manual">("tap")
  const [action, setAction] = React.useState<KeySwitchAction>("tactile")
  const [press, setPress] = React.useState(55)
  const [travel, setTravel] = React.useState(4)
  const [closed, setClosed] = React.useState(false)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="action" value={action} options={["linear", "tactile", "clicky"] as const} onChange={setAction} />
      <Segmented label="drive" value={drive} options={["tap", "flutter", "hold", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="travel" value={travel} min={2} max={6} step={0.5} onChange={setTravel} format={v => `${v}u`} />
      {drive === "manual"
        ? <NumberControl label="press" value={press} min={0} max={100} onChange={setPress} format={v => `${v}%`} />
        : <Hint>Drag down the cap to press it. The contact closes halfway down and stays closed until you come back up past the reset — which is what <code>flutter</code> is there to show.</Hint>}
      <Readout rows={[["contact", closed ? "closed" : "open"]]} />
    </>}>
      <KeySwitch view={view} size={300} variant={variant} action={action} travel={travel}
        label="SWITCH / 01" onActuatedChange={setClosed}
        {...(drive === "manual" ? { press: press / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function RobotKeypadDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<KeypadBehavior | "manual">("entry")
  const [outcome, setOutcome] = React.useState<KeypadOutcome>("granted")
  const [rows, setRows] = React.useState(4)
  const [columns, setColumns] = React.useState(3)
  const [rake, setRake] = React.useState(22)
  const [typed, setTyped] = React.useState(45)
  const [scan, setScan] = React.useState(true)
  const [digits, setDigits] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["entry", "scan", "idle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="answer" value={outcome} options={["granted", "denied"] as const} onChange={setOutcome} />
      <Segmented label="scan" value={scan ? "on" : "off"} options={["on", "off"] as const} onChange={(next) => setScan(next === "on")} />
      <NumberControl label="rows" value={rows} min={3} max={5} onChange={setRows} />
      <NumberControl label="columns" value={columns} min={3} max={4} onChange={setColumns} />
      <NumberControl label="rake" value={rake} min={0} max={40} onChange={setRake} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="entry" value={typed} min={0} max={100} onChange={setTyped} format={v => `${v}%`} />
        : <Hint>Drag across the face to scrub the entry. Take the rake to zero and watch the machine lose its own travel — that is what the angle is for.</Hint>}
      <Readout rows={[["digits", String(digits)]]} />
    </>}>
      <RobotKeypad view={view} size={320} variant={variant} rows={rows} columns={columns} rake={rake}
        outcome={outcome} showScan={scan} code="4813" label="ENTRY / 02" onEntryChange={setDigits}
        {...(drive === "manual" ? { typed: typed / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function RobotKeyboardDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<KeyboardBehavior | "manual">("type")
  const [layout, setLayout] = React.useState<KeyboardLayoutName>("compact")
  const [profile, setProfile] = React.useState<KeycapSculpt>("sculpted")
  const [rake, setRake] = React.useState(6)
  const [strokes, setStrokes] = React.useState(16)
  const [typed, setTyped] = React.useState(35)
  const [scan, setScan] = React.useState(false)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="layout" value={layout} options={["compact", "extended", "split"] as const} onChange={setLayout} />
      <Segmented label="caps" value={profile} options={["sculpted", "flat"] as const} onChange={setProfile} />
      <Segmented label="drive" value={drive} options={["type", "ripple", "scan", "idle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="scan" value={scan ? "on" : "off"} options={["on", "off"] as const} onChange={(next) => setScan(next === "on")} />
      <NumberControl label="strokes" value={strokes} min={4} max={40} onChange={setStrokes} />
      <NumberControl label="rake" value={rake} min={0} max={16} onChange={setRake} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="passage" value={typed} min={0} max={100} onChange={setTyped} format={v => `${v}%`} />
        : <Hint>Drag across the deck to scrub the passage. Take it to <code>profile</code> and switch the caps to flat: the sculpt is the whole difference.</Hint>}
    </>}>
      <RobotKeyboard view={view} size={340} variant={variant} layout={layout} profile={profile}
        rake={rake} strokes={strokes} showScan={scan} label="DECK / 03"
        {...(drive === "manual" ? { typed: typed / 100 } : { behavior: drive })} interactive />
    </Bench>
  )
}

function InputTerminalDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<InputTerminalBehavior | "manual">("session")
  const [screen, setScreen] = React.useState<InputTerminalScreen>("query")
  const [lines, setLines] = React.useState(7)
  const [cant, setCant] = React.useState(18)
  const [typed, setTyped] = React.useState(45)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="screen" value={screen} options={["boot", "log", "query", "off"] as const} onChange={setScreen} />
      <Segmented label="drive" value={drive} options={["session", "query", "idle", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="lines" value={lines} min={4} max={12} onChange={setLines} />
      <NumberControl label="cant" value={cant} min={6} max={45} onChange={setCant} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="passage" value={typed} min={0} max={100} onChange={setTyped} format={v => `${v}%`} />
        : <Hint>Drag down the frame to lay the head back — it keeps typing while you hold it, because the passage is the other mechanism.</Hint>}
    </>}>
      <InputTerminal view={view} size={320} variant={variant} screen={screen} lines={lines}
        label="CONSOLE / 04" cant={cant}
        {...(drive === "manual" ? { typed: typed / 100 } : { behavior: drive })} interactive
        onCantChange={setCant} />
    </Bench>
  )
}

/** Written benches ignore it; the generated one needs it to know what to draw. */
/* -------------------------------------------------------------------------- */
/* the oil field                                                               */
/* -------------------------------------------------------------------------- */

function PumpjackDemo() {
  const [view, setView] = React.useState<RobotView>("profile"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<PumpjackBehavior>("pump"); const [balance, setBalance] = React.useState<PumpjackBalance>("crank")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["pump", "slow", "static"]} onChange={setBehavior} /><Segmented label="balance" value={balance} options={["crank", "beam", "air"]} onChange={setBalance} /><Hint>Drag anywhere round the gearbox to turn the crank by hand. The beam and the rod stroke are what the four-bar produces.</Hint></>}><Pumpjack size={360} view={view} variant={variant} behavior={behavior} balance={balance} interactive label="BP-04" /></Bench>
}

function DrillingDerrickDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<DerrickBehavior>("trip"); const [lines, setLines] = React.useState<"4" | "6" | "8" | "12">("6")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["trip", "drill", "static"]} onChange={setBehavior} /><Segmented label="lines" value={lines} options={["4", "6", "8", "12"]} onChange={setLines} /><Hint>Drag the block up and down the mast. More lines means more drum turns for the same lift — watch the drum.</Hint></>}><DrillingDerrick size={300} view={view} variant={variant} behavior={behavior} lines={Number(lines) as DerrickLines} interactive label="RIG-11" /></Bench>
}

function MudPumpDemo() {
  const [view, setView] = React.useState<RobotView>("iso"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<MudPumpBehavior>("stroke"); const [cylinders, setCylinders] = React.useState<"1" | "2" | "3">("3")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["stroke", "surge", "static"]} onChange={setBehavior} /><Segmented label="cylinders" value={cylinders} options={["1", "2", "3"]} onChange={setCylinders} /><Hint>Turn the crankshaft by hand. The discharge mark is the sum of the solved piston velocities, not a hydraulic model.</Hint></>}><MudPump size={380} view={view} variant={variant} behavior={behavior} cylinders={Number(cylinders) as MudPumpCylinders} interactive label="MP-07" /></Bench>
}

function WellheadTreeDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<WellheadBehavior>("throttle"); const [service, setService] = React.useState<WellheadService>("production"); const [pressure, setPressure] = React.useState(58)
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["throttle", "shut-in", "static"]} onChange={setBehavior} /><Segmented label="service" value={service} options={["production", "shut-in", "kill"]} onChange={setService} /><NumberControl label="gauge" value={pressure} min={0} max={100} onChange={setPressure} format={(v) => `${v}%`} /><Hint>Drag the choke open and shut. The gauge is a reading you supply — the tree never infers pressure from anything.</Hint></>}><WellheadTree size={280} view={view} variant={variant} behavior={behavior} service={service} pressure={pressure / 100} interactive label="XT-02" /></Bench>
}

function StorageTankDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<StorageTankBehavior>("fill"); const [roof, setRoof] = React.useState<StorageTankRoof>("floating"); const [courses, setCourses] = React.useState(4)
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["fill", "draw", "static"]} onChange={setBehavior} /><Segmented label="roof" value={roof} options={["floating", "fixed"]} onChange={setRoof} /><NumberControl label="courses" value={courses} min={2} max={8} onChange={setCourses} /><Hint>Drag the level. The rolling ladder keeps its length, so its angle is solved from wherever the roof is.</Hint></>}><StorageTank size={340} view={view} variant={variant} behavior={behavior} roof={roof} courses={courses} interactive label="TK-114" /></Bench>
}

function OilTankerDemo() {
  const [view, setView] = React.useState<RobotView>("profile"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<OilTankerBehavior>("laden"); const [tanks, setTanks] = React.useState(6)
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["laden", "swell", "static"]} onChange={setBehavior} /><NumberControl label="tanks" value={tanks} min={2} max={10} onChange={setTanks} /><Hint>Drag her down through the waterline. The boot top and the load line are painted on the hull, so they go under with her.</Hint></>}><OilTanker size={400} view={view} variant={variant} behavior={behavior} tanks={tanks} interactive label="CRUDE CARRIER" /></Bench>
}

function TankerTruckDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<TankerTruckBehavior>("manoeuvre")
  const [compartments, setCompartments] = React.useState(4)
  const [steer, setSteer] = React.useState(14)
  const [pinned, setPinned] = React.useState(false)
  const [hitch, setHitch] = React.useState(30)
  // The truck's own geometry: steer axle to drive tandem, the kingpin just
  // ahead of the tandem, and the trailer's own wheelbase behind it.
  const solved = -hitchAngle(steer, { wheelbase: 74, track: 37, hitch: -14 }, 150)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["haul", "manoeuvre", "discharge", "static"] as const}
            onChange={setBehavior}
          />
          <NumberControl label="pots" value={compartments} min={2} max={6} onChange={setCompartments} />
          <Segmented
            label="hitch"
            value={pinned ? "pinned" : "solved"}
            options={["solved", "pinned"] as const}
            onChange={(next) => setPinned(next === "pinned")}
          />
          {pinned ? (
            <NumberControl label="yaw" value={hitch} min={-60} max={60} onChange={setHitch} format={(v) => `${v}°`} />
          ) : (
            <NumberControl label="steer" value={steer} min={-26} max={26} onChange={setSteer} format={(v) => `${v}°`} />
          )}
          <Hint>
            Steer the tractor and switch to plan: the trailer&rsquo;s angle is solved from
            the turn, so it off-tracks inside the tractor&rsquo;s line. Pin the hitch to
            override it.
          </Hint>
          <Readout
            rows={[
              ["articulation", `${(pinned ? hitch : solved).toFixed(1)}°`],
              ["load", `${Math.round(tankerTruckLevel(behavior, 0) * 100)}%`],
            ]}
          />
        </>
      }
    >
      <TankerTruck
        size={400}
        view={view}
        variant={variant}
        behavior={behavior}
        compartments={compartments}
        steer={pinned ? undefined : steer}
        hitch={pinned ? hitch : undefined}
        interactive
        label="RT-26"
      />
    </Bench>
  )
}

function FlareStackDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<FlareStackBehavior>("flare"); const [wind, setWind] = React.useState(14)
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["flare", "pilot", "static"]} onChange={setBehavior} /><NumberControl label="wind" value={wind} min={-50} max={50} onChange={setWind} format={(v) => `${v}°`} /><Hint>Drag the flow to the tip. The plume is drawn, not burned: its length is a proportion, never a rate.</Hint></>}><FlareStack size={300} view={view} variant={variant} behavior={behavior} wind={wind} interactive label="FL-01" /></Bench>
}

function FractionatingColumnDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<ColumnBehavior>("run"); const [trays, setTrays] = React.useState(14); const [cut, setCut] = React.useState<"0" | "1" | "2" | "3">("1")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["run", "swing", "static"]} onChange={setBehavior} /><NumberControl label="trays" value={trays} min={6} max={24} onChange={setTrays} /><Segmented label="cut" value={cut} options={["0", "1", "2", "3"]} onChange={setCut} /><Hint>Raise the tray count and the whole column rebuilds at a closer spacing. Drag the heat and the flash zone moves.</Hint></>}><FractionatingColumn size={300} view={view} variant={variant} behavior={behavior} trays={trays} cut={Number(cut)} interactive label="CDU-1" /></Bench>
}

function JackupRigDemo() {
  const [view, setView] = React.useState<RobotView>("front"); const [variant, setVariant] = React.useState<RobotVariant>("solid"); const [behavior, setBehavior] = React.useState<JackupBehavior>("jack"); const [legs, setLegs] = React.useState<"3" | "4">("3")
  return <Bench controls={<><Segmented label="view" value={view} options={views} onChange={setView} /><Segmented label="variant" value={variant} options={variants} onChange={setVariant} /><Segmented label="motion" value={behavior} options={["jack", "preload", "static"]} onChange={setBehavior} /><Segmented label="legs" value={legs} options={["3", "4"]} onChange={setLegs} /><Hint>Drag the hull up its legs. The stick-up above the deck is whatever the air gap has not used — one number, both halves.</Hint></>}><JackupRig size={320} view={view} variant={variant} behavior={behavior} legs={Number(legs) as 3 | 4} interactive label="JU-70" /></Bench>
}

function RobotSunflowerDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SunflowerBehavior | "manual">("sweep")
  const [daylight, setDaylight] = React.useState(0.5)
  const [florets, setFlorets] = React.useState(120)
  const [rays, setRays] = React.useState(21)
  const [arms, setArms] = React.useState(8)
  const [light, setLight] = React.useState<"pointer" | "arc">("arc")
  const hour = `${String(Math.floor(daylight * 24)).padStart(2, "0")}:${String(
    Math.floor(((daylight * 24) % 1) * 60),
  ).padStart(2, "0")}`
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="florets" value={florets} min={12} max={320} onChange={setFlorets} />
      <NumberControl label="rays" value={rays} min={0} max={48} onChange={setRays} />
      <NumberControl label="arms" value={arms} min={0} max={24} onChange={setArms} />
      <Segmented label="light" value={light} options={["arc", "pointer"] as const} onChange={setLight} />
      <Segmented label="drive" value={drive} options={["sweep", "day", "nod", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="daylight" value={daylight} min={0} max={1} step={0.01} onChange={setDaylight} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag across it to scrub the day, or focus it and use the arrow keys. With the light on the pointer, the head, the mast and the leaf panels all come round to wherever you are.</Hint>}
      <Readout rows={[["clock", hour], ["spiral", `${arms} arms`]]} />
    </>}>
      <RobotSunflower view={view} size={320} variant={variant} florets={florets} rays={rays} arms={arms}
        track={light === "pointer"} label="SUNFLOWER / 01"
        interactive onDaylightChange={setDaylight}
        {...(drive === "manual" ? { daylight, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function RobotCactusDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<CactusBehavior | "manual">("flower")
  const [bloom, setBloom] = React.useState(0.6)
  const [ribs, setRibs] = React.useState(13)
  const [areoles, setAreoles] = React.useState(4)
  const [spines, setSpines] = React.useState(6)
  const [arms, setArms] = React.useState(2)
  const [petals, setPetals] = React.useState(16)
  const [attention, setAttention] = React.useState<"pointer" | "wander">("pointer")
  const pose = cactusArmPose(bloom)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="ribs" value={ribs} min={5} max={28} onChange={setRibs} />
      <NumberControl label="areoles" value={areoles} min={0} max={12} onChange={setAreoles} />
      <NumberControl label="spines" value={spines} min={0} max={10} onChange={setSpines} />
      <NumberControl label="arms" value={arms} min={0} max={4} onChange={setArms} />
      <NumberControl label="petals" value={petals} min={0} max={36} onChange={setPetals} />
      <Segmented label="attention" value={attention} options={["pointer", "wander"] as const} onChange={setAttention} />
      <Segmented label="drive" value={drive} options={["breathe", "flower", "reach", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="bloom" value={bloom} min={0} max={1} step={0.01} onChange={setBloom} format={value => `${Math.round(value * 100)}%`} />
        : <Hint>Drag up and down to work the flowering, or focus it and use the arrow keys. With attention on the pointer the whole column leans toward you and carries the arms and the flower with it.</Hint>}
      <Readout rows={[["lift", `${Math.round(pose.lift * 100)}%`], ["curl", `${Math.round(pose.curl * 100)}%`]]} />
    </>}>
      <RobotCactus view={view} size={300} variant={variant} ribs={ribs} areoles={areoles}
        spines={spines} arms={arms} petals={petals} label="CACTUS / 01"
        track={attention === "pointer"}
        interactive onBloomChange={setBloom}
        {...(drive === "manual" ? { bloom, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CelestialPlanetDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<PlanetBehavior | "manual">("rotate")
  const [spin, setSpin] = React.useState(40)
  const [surface, setSurface] = React.useState<PlanetSurface>("banded")
  const [tilt, setTilt] = React.useState(24)
  const [sun, setSun] = React.useState(28)
  const [moons, setMoons] = React.useState(1)
  const [rings, setRings] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="world" value={surface} options={["terrestrial", "banded", "ice", "molten"] as const} onChange={setSurface} />
      <Segmented label="rings" value={rings} options={["on", "off"] as const} onChange={setRings} />
      <NumberControl label="tilt" value={tilt} min={-90} max={90} onChange={setTilt} format={v => `${v}°`} />
      <NumberControl label="sun" value={sun} min={-180} max={180} onChange={setSun} format={v => `${v}°`} />
      <NumberControl label="moons" value={moons} min={0} max={3} onChange={setMoons} />
      <Segmented label="drive" value={drive} options={["rotate", "orbit", "tumble", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="spin" value={spin} min={-360} max={360} onChange={setSpin} format={v => `${v}°`} />
        : <Hint>Drag across the globe to turn it. Watch a ring pass behind the body and come out the other side — it is cut where the silhouette crosses it, not painted over.</Hint>}
    </>}>
      <CelestialPlanet view={view} size={320} variant={variant} surface={surface} tilt={tilt} sun={sun}
        moons={moons} rings={rings === "on"} label="PLANET / 01"
        interactive onSpinChange={setSpin}
        {...(drive === "manual" ? { spin, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CelestialMoonDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<MoonBehavior | "manual">("cycle")
  const [phase, setPhase] = React.useState(0.25)
  const [craters, setCraters] = React.useState(46)
  const [maria, setMaria] = React.useState(3)
  const [libration, setLibration] = React.useState(1)
  const names = ["new", "waxing crescent", "first quarter", "waxing gibbous", "full", "waning gibbous", "last quarter", "waning crescent"]
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="craters" value={craters} min={0} max={200} onChange={setCraters} />
      <NumberControl label="maria" value={maria} min={0} max={6} onChange={setMaria} />
      <NumberControl label="libration" value={libration} min={0} max={1} step={0.05} onChange={setLibration} format={v => `${Math.round(v * 100)}%`} />
      <Segmented label="drive" value={drive} options={["cycle", "libration", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across it to scrub the lunation. Nothing draws a crescent here: it is the terminator circle, projected, which is why it flips the right way at quarter.</Hint>}
      <Readout rows={[["phase", names[Math.round(phase * 8) % 8]]]} />
    </>}>
      <CelestialMoon view={view} size={320} variant={variant} craters={craters} maria={maria}
        libration={libration} label="MOON / 02"
        interactive onPhaseChange={setPhase}
        {...(drive === "manual" ? { phase, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CelestialStarDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<StarBehavior | "manual">("flare")
  const [activity, setActivity] = React.useState(0.5)
  const [kind, setKind] = React.useState<StarClass>("main-sequence")
  const [shells, setShells] = React.useState(8)
  const [spots, setSpots] = React.useState(5)
  const [prominences, setProminences] = React.useState(3)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="class" value={kind} options={["dwarf", "main-sequence", "giant"] as const} onChange={setKind} />
      <NumberControl label="shells" value={shells} min={3} max={20} onChange={setShells} />
      <NumberControl label="spots" value={spots} min={0} max={12} onChange={setSpots} />
      <NumberControl label="loops" value={prominences} min={0} max={8} onChange={setProminences} />
      <Segmented label="drive" value={drive} options={["flare", "rotate", "pulse", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="activity" value={activity} min={0} max={1} step={0.01} onChange={setActivity} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across it to work the activity. Switch the class and watch the edge: a giant darkens toward the limb far harder than a dwarf, because the coefficient in the law is different.</Hint>}
    </>}>
      <CelestialStar view={view} size={320} variant={variant} kind={kind} shells={shells}
        spots={spots} prominences={prominences} label="STAR / 03"
        interactive onActivityChange={setActivity}
        {...(drive === "manual" ? { activity, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function CelestialAsteroidDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<AsteroidBehavior | "manual">("tumble")
  const [tumble, setTumble] = React.useState(40)
  const [body, setBody] = React.useState<AsteroidBody>("rubble")
  const [seed, setSeed] = React.useState(9)
  const [craters, setCraters] = React.useState(18)
  const [moonlet, setMoonlet] = React.useState<"on" | "off">("off")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="body" value={body} options={["rubble", "monolith", "contact"] as const} onChange={setBody} />
      <NumberControl label="seed" value={seed} min={1} max={24} onChange={setSeed} />
      <NumberControl label="craters" value={craters} min={0} max={80} onChange={setCraters} />
      <Segmented label="moonlet" value={moonlet} options={["off", "on"] as const} onChange={setMoonlet} />
      <Segmented label="drive" value={drive} options={["tumble", "spin", "drift", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="tumble" value={tumble} min={-360} max={360} onChange={setTumble} format={v => `${v}°`} />
        : <Hint>Drag across it to turn it. This is the only body here whose outline changes as it goes round — the shape is a radius field, not a circle with a texture on it.</Hint>}
    </>}>
      <CelestialAsteroid view={view} size={320} variant={variant} body={body} seed={seed}
        craters={craters} moonlet={moonlet === "on"} label="ASTEROID / 04"
        interactive onTumbleChange={setTumble}
        {...(drive === "manual" ? { tumble, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

function OrreryDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<OrreryBehavior | "manual">("run")
  const [epoch, setEpoch] = React.useState(0)
  const [bodies, setBodies] = React.useState(4)
  const [eccentricity, setEccentricity] = React.useState(45)
  const [inclination, setInclination] = React.useState(7)
  const [orbits, setOrbits] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="bodies" value={bodies} min={1} max={6} onChange={setBodies} />
      <NumberControl label="eccent." value={eccentricity} min={0} max={100} onChange={setEccentricity} format={v => `${v}%`} />
      <NumberControl label="inclin." value={inclination} min={-60} max={60} onChange={setInclination} format={v => `${v}°`} />
      <Segmented label="orbits" value={orbits} options={["on", "off"] as const} onChange={setOrbits} />
      <Segmented label="drive" value={drive} options={["run", "jog", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="year" value={epoch} min={-12} max={12} step={0.05} onChange={setEpoch} format={v => `${v.toFixed(1)}`} />
        : <Hint>Drag across it to wind time on. Wind the eccentricity up and watch an arm telescope: its length is the orbital radius, and the body runs at periapsis and loiters at apoapsis.</Hint>}
      <Readout rows={[["year", epoch.toFixed(2)]]} />
    </>}>
      <Orrery view={view} size={320} variant={variant} bodies={bodies}
        eccentricity={eccentricity / 100} inclination={inclination} showOrbits={orbits === "on"}
        label="ORRERY / 05"
        interactive onEpochChange={setEpoch}
        {...(drive === "manual" ? { epoch, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

/* -------------------------------------------------------------------------- */
/* vehicles — docs/vehicle-robots.md                                           */
/* -------------------------------------------------------------------------- */

function RobotCarDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<CarBehavior>("cruise")
  const [steer, setSteer] = React.useState(26)
  const [roughness, setRoughness] = React.useState(0.35)
  const [driven, setDriven] = React.useState(true)
  // The car's own geometry, so the readout is the machine's answer and not a guess.
  const rack = ackermann(steer, { wheelbase: 126, track: 76 })
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["cruise", "slalom", "park", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="steer"
            value={driven ? "held" : "loop"}
            options={["held", "loop"] as const}
            onChange={(next) => setDriven(next === "held")}
          />
          {driven ? (
            <NumberControl label="angle" value={steer} min={-60} max={60} onChange={setSteer} format={(v) => `${v}°`} />
          ) : null}
          <NumberControl
            label="road"
            value={roughness}
            min={0}
            max={1}
            step={0.05}
            onChange={setRoughness}
            format={(v) => v.toFixed(2)}
          />
          <Hint>
            One steering number, two wheel angles. Switch to plan and watch the inner wheel
            crank harder than the outer one — or drag across the car to steer it yourself.
          </Hint>
          <Readout
            rows={[
              ["inner", `${rack.inner.toFixed(1)}°`],
              ["outer", `${rack.outer.toFixed(1)}°`],
              ["radius", Number.isFinite(rack.radius) ? `${Math.round(rack.radius)} u` : "∞"],
            ]}
          />
        </>
      }
    >
      <RobotCar
        size={330}
        view={view}
        variant={variant}
        behavior={behavior}
        steer={driven ? steer : undefined}
        onSteerChange={setSteer}
        roughness={roughness}
        interactive
        label="CAR / 01"
      />
    </Bench>
  )
}

function TransitBusDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<TransitBusBehavior>("route")
  const [steer, setSteer] = React.useState(30)
  const [doors, setDoors] = React.useState(0)
  const [articulated, setArticulated] = React.useState(true)
  // The bus's own geometry: front axle to drive axle, the pivot behind the
  // drive axle, and the trailer's own wheelbase behind that.
  const bend = articulated
    ? hitchAngle(steer, { wheelbase: 88, track: 29, hitch: 34 }, 58)
    : 0
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["route", "service", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="body"
            value={articulated ? "bendy" : "rigid"}
            options={["bendy", "rigid"] as const}
            onChange={(next) => setArticulated(next === "bendy")}
          />
          <NumberControl label="steer" value={steer} min={-42} max={42} onChange={setSteer} format={(v) => `${v}°`} />
          <NumberControl
            label="doors"
            value={doors}
            min={0}
            max={1}
            step={0.05}
            onChange={setDoors}
            format={(v) => v.toFixed(2)}
          />
          <Hint>
            The rear section is solved, not set. Open the doors and she kneels on the
            same number — a bus kneels to open.
          </Hint>
          <Readout
            rows={[
              ["articulation", `${bend.toFixed(1)}°`],
              ["kneel", `${(doors * 3.4).toFixed(1)} u`],
            ]}
          />
        </>
      }
    >
      <TransitBus
        size={420}
        view={view}
        variant={variant}
        behavior={behavior}
        steer={steer}
        doors={doors}
        articulated={articulated}
        interactive
        label="BUS / 02"
      />
    </Bench>
  )
}

function CargoPlaneDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<CargoPlaneBehavior>("circuit")
  const [turn, setTurn] = React.useState(3)
  const [airspeed, setAirspeed] = React.useState(110)
  const [engines, setEngines] = React.useState<2 | 4>(4)
  const [config, setConfig] = React.useState(0)
  const radius = turn === 0 ? Infinity : airspeed / ((Math.abs(turn) * Math.PI) / 180)
  const bank = coordinatedBank(airspeed, radius)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["cruise", "circuit", "approach", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="engines"
            value={engines === 4 ? "four" : "two"}
            options={["four", "two"] as const}
            onChange={(next) => setEngines(next === "four" ? 4 : 2)}
          />
          <NumberControl label="turn" value={turn} min={-6} max={6} step={0.5} onChange={setTurn} format={(v) => `${v}°/s`} />
          <NumberControl label="speed" value={airspeed} min={40} max={220} step={5} onChange={setAirspeed} format={(v) => `${v}`} />
          <NumberControl
            label="config"
            value={config}
            min={0}
            max={1}
            step={0.05}
            onChange={setConfig}
            format={(v) => v.toFixed(2)}
          />
          <Hint>
            The same commanded turn banks further at speed — the radius is v/ω and the turn is
            coordinated. Dirty it up and the flaps, gear and ramp all come out.
          </Hint>
          <Readout
            rows={[
              ["radius", Number.isFinite(radius) ? `${Math.round(radius)} m` : "∞"],
              ["bank", `${bank.toFixed(1)}°`],
            ]}
          />
        </>
      }
    >
      <CargoPlane
        size={330}
        view={view}
        variant={variant}
        behavior={behavior}
        turn={turn}
        airspeed={airspeed}
        engines={engines}
        configuration={config}
        interactive
        label="FREIGHT / 03"
      />
    </Bench>
  )
}

function HydrofoilCraftDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<HydrofoilBehavior>("takeoff")
  const [knots, setKnots] = React.useState(34)
  const [takeoff, setTakeoff] = React.useState(18)
  const [driven, setDriven] = React.useState(true)
  const rise = foilRise(knots, takeoff)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["takeoff", "foilborne", "moor", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="throttle"
            value={driven ? "held" : "loop"}
            options={["held", "loop"] as const}
            onChange={(next) => setDriven(next === "held")}
          />
          {driven ? (
            <NumberControl label="knots" value={knots} min={0} max={60} onChange={setKnots} />
          ) : null}
          <NumberControl label="takeoff" value={takeoff} min={6} max={40} onChange={setTakeoff} />
          <Hint>
            Below takeoff she is hullborne and rides the swell. Above it the wetted part of each
            foil limb — the accent — is what the lift equation has just taken away.
          </Hint>
          <Readout
            rows={[
              ["rise", `${Math.round(rise * 100)}%`],
              ["wetted", `${Math.round((1 - rise) * 100)}%`],
            ]}
          />
        </>
      }
    >
      <HydrofoilCraft
        size={340}
        view={view}
        variant={variant}
        behavior={behavior}
        knots={driven ? knots : undefined}
        onKnotsChange={setKnots}
        takeoffSpeed={takeoff}
        interactive
        label="FOIL / 04"
      />
    </Bench>
  )
}

function LaunchVehicleDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<LaunchVehicleBehavior>("ascent")
  const [ascent, setAscent] = React.useState(0.3)
  const [engines, setEngines] = React.useState<5 | 9>(9)
  const [driven, setDriven] = React.useState(true)
  const staged = ascent >= 0.54
  const stages = [
    { massRatio: 3.4, exhaustVelocity: 2900 },
    { massRatio: 5.2, exhaustVelocity: 3350 },
  ]
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["ascent", "hold", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="cluster"
            value={engines === 9 ? "nine" : "five"}
            options={["nine", "five"] as const}
            onChange={(next) => setEngines(next === "nine" ? 9 : 5)}
          />
          <Segmented
            label="ascent"
            value={driven ? "held" : "loop"}
            options={["held", "loop"] as const}
            onChange={(next) => setDriven(next === "held")}
          />
          {driven ? (
            <NumberControl
              label="flown"
              value={ascent}
              min={0}
              max={1}
              step={0.02}
              onChange={setAscent}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          ) : null}
          <Hint>
            Scrub the ascent. The stack flies the pitch program, the engines carry whatever it
            has not taken up, and the Δv drops the moment the booster lets go.
          </Hint>
          <Readout
            rows={[
              ["pitch", `${Math.round(pitchProgram(Math.max(0, ascent - 0.05)))}°`],
              ["Δv left", `${Math.round(stackDeltaV(staged ? stages.slice(1) : stages))} m/s`],
            ]}
          />
        </>
      }
    >
      <LaunchVehicle
        size={380}
        view={view}
        variant={variant}
        behavior={behavior}
        ascent={driven ? ascent : undefined}
        onAscentChange={setAscent}
        engines={engines}
        interactive
        label="LV / 05"
      />
    </Bench>
  )
}

function StrikeStarfighterDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<StarfighterBehavior>("patrol")
  const [foils, setFoils] = React.useState(1)
  const [bank, setBank] = React.useState(0)
  const [driven, setDriven] = React.useState(true)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["patrol", "attack", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="foils"
            value={driven ? "held" : "loop"}
            options={["held", "loop"] as const}
            onChange={(next) => setDriven(next === "held")}
          />
          {driven ? (
            <NumberControl
              label="open"
              value={foils}
              min={0}
              max={1}
              step={0.05}
              onChange={setFoils}
              format={(v) => v.toFixed(2)}
            />
          ) : null}
          <NumberControl label="bank" value={bank} min={-70} max={70} onChange={setBank} format={(v) => `${v}°`} />
          <Hint>
            Front is where the X is; plan is the same hinge seen from above. The engines and
            tip cannons are carried on the panels, so opening the foils spreads them.
          </Hint>
        </>
      }
    >
      <StrikeStarfighter
        size={330}
        view={view}
        variant={variant}
        behavior={behavior}
        foils={driven ? foils : undefined}
        onFoilsChange={setFoils}
        bank={bank}
        interactive
        label="SF / 06"
      />
    </Bench>
  )
}

function IonInterceptorDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<InterceptorBehavior>("patrol")
  const [pitch, setPitch] = React.useState(0)
  const [yaw, setYaw] = React.useState(0)
  const [ribs, setRibs] = React.useState(3)
  const [driven, setDriven] = React.useState(true)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["patrol", "intercept", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="panels"
            value={driven ? "held" : "loop"}
            options={["held", "loop"] as const}
            onChange={(next) => setDriven(next === "held")}
          />
          {driven ? (
            <NumberControl label="pitch" value={pitch} min={-80} max={80} onChange={setPitch} format={(v) => `${v}°`} />
          ) : null}
          <NumberControl label="yaw" value={yaw} min={-55} max={55} onChange={setYaw} format={(v) => `${v}°`} />
          <NumberControl label="ribs" value={ribs} min={0} max={6} onChange={setRibs} />
          <Hint>
            Square to the camera the panels are hexagons; from straight above they are lines.
            Yaw turns the pod inside the pylons, and the viewport goes with it.
          </Hint>
        </>
      }
    >
      <IonInterceptor
        size={320}
        view={view}
        variant={variant}
        behavior={behavior}
        panelPitch={driven ? pitch : undefined}
        onPanelPitchChange={setPitch}
        yaw={yaw}
        ribs={ribs}
        interactive
        label="II / 07"
      />
    </Bench>
  )
}

function BattleStationDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<StationBehavior | "manual">("detonate")
  const [breakup, setBreakup] = React.useState(0.3)
  const [charge, setCharge] = React.useState(80)
  const [courses, setCourses] = React.useState(9)
  const [perCourse, setPerCourse] = React.useState(12)
  const [plating, setPlating] = React.useState(100)
  const [trench, setTrench] = React.useState<"on" | "off">("on")
  const [emitters, setEmitters] = React.useState(8)
  const [spread, setSpread] = React.useState(75)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="courses" value={courses} min={3} max={21} onChange={setCourses} />
      <NumberControl label="plates" value={perCourse} min={4} max={28} onChange={setPerCourse} />
      <NumberControl label="plating" value={plating} min={0} max={100} onChange={setPlating} format={v => `${v}%`} />
      <Segmented label="trench" value={trench} options={["on", "off"] as const} onChange={setTrench} />
      <NumberControl label="emitters" value={emitters} min={0} max={16} onChange={setEmitters} />
      <NumberControl label="spread" value={spread} min={0} max={300} onChange={setSpread} format={v => `${(v / 100).toFixed(2)}r`} />
      <Segmented label="drive" value={drive} options={["detonate", "charge", "patrol", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <>
            <NumberControl label="breakup" value={breakup} min={0} max={1} step={0.01} onChange={setBreakup} format={v => `${Math.round(v * 100)}%`} />
            <NumberControl label="charge" value={charge} min={0} max={100} onChange={setCharge} format={v => `${v}%`} />
          </>
        : <Hint>Drag across it to take the breakup. Put it back at zero and the sphere reassembles exactly — the plates are a real tiling, and the intact hull is not a second drawing. Drop the plating to watch the courses come off and the ribs show.</Hint>}
      <Readout rows={drive === "manual"
        ? [["breakup", `${Math.round(breakup * 100)}%`], ["plates", `${courses} × ~${perCourse}`]]
        : [["plates", `${courses} × ~${perCourse}`], ["areas", "sum to 1"]]} />
    </>}>
      <BattleStation view={view} size={320} variant={variant} courses={courses} perCourse={perCourse}
        plating={plating / 100} trench={trench === "on"} emitters={emitters} spread={spread / 100}
        label="STATION / 01"
        interactive onBreakupChange={setBreakup}
        {...(drive === "manual"
          ? { breakup, charge: charge / 100, behavior: "static" as const }
          : { behavior: drive })} />
    </Bench>
  )
}

function DebrisFieldDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<DebrisBehavior | "manual">("drift")
  const [spread, setSpread] = React.useState(0.55)
  const [courses, setCourses] = React.useState(6)
  const [perCourse, setPerCourse] = React.useState(9)
  const [reach, setReach] = React.useState(130)
  const [trails, setTrails] = React.useState<"on" | "off">("off")
  const [shock, setShock] = React.useState<"on" | "off">("on")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <NumberControl label="courses" value={courses} min={2} max={14} onChange={setCourses} />
      <NumberControl label="pieces" value={perCourse} min={2} max={20} onChange={setPerCourse} />
      <NumberControl label="reach" value={reach} min={0} max={600} onChange={setReach} format={v => `${(v / 100).toFixed(1)}r`} />
      <Segmented label="trails" value={trails} options={["off", "on"] as const} onChange={setTrails} />
      <Segmented label="shock" value={shock} options={["on", "off"] as const} onChange={setShock} />
      <Segmented label="drive" value={drive} options={["drift", "burst", "tumble", "static", "manual"] as const} onChange={setDrive} />
      {drive === "manual"
        ? <NumberControl label="spread" value={spread} min={0} max={1} step={0.01} onChange={setSpread} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across it to scrub the scatter, and turn the trails on: they are straight because the solver makes them so. Switch the camera and watch which fragments come out in front — the order is a depth sort, not artwork.</Hint>}
    </>}>
      <DebrisField view={view} size={320} variant={variant} courses={courses} perCourse={perCourse}
        reach={reach / 100} showTrails={trails === "on"} showShock={shock === "on"}
        label="DEBRIS / 02"
        interactive onSpreadChange={setSpread}
        {...(drive === "manual" ? { spread, behavior: "static" as const } : { behavior: drive })} />
    </Bench>
  )
}

export interface DemoProps {
  slug: string
}


function GabledHouseDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<GabledHouseBehavior | "manual">("arrive")
  const [sun, setSun] = React.useState(0.42)
  const [storeys, setStoreys] = React.useState(2)
  const [pitch, setPitch] = React.useState(38)
  const [garage, setGarage] = React.useState(0.6)
  const [at, setAt] = React.useState(0.42)
  const hour = `${String(Math.floor(at * 24)).padStart(2, "0")}:${String(Math.floor(((at * 24) % 1) * 60)).padStart(2, "0")}`
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="day" value={drive} options={["day", "arrive", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="storeys" value={storeys} min={1} max={3} onChange={setStoreys} />
      <NumberControl label="pitch" value={pitch} min={10} max={55} onChange={setPitch} format={v => `${v}°`} />
      <NumberControl label="garage" value={garage} min={0} max={1} step={0.05} onChange={setGarage} format={v => `${Math.round(v * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="sun" value={sun} min={0} max={1} step={0.01} onChange={setSun} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to run the day by hand — the frame&apos;s width is one day. The fins and the array face the sun, and say so when they hit their stops.</Hint>}
      <Readout rows={[["time", hour]]} />
    </>}>
      <GabledHouse view={view} size={330} variant={variant} storeys={storeys} pitch={pitch}
        garage={garage} label="HOUSE / 01" onSunChange={setAt}
        {...(drive === "manual" ? { sun } : { behavior: drive })} interactive />
    </Bench>
  )
}

function TowerBlockDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<TowerBlockBehavior | "manual">("service")
  const [carriage, setCarriage] = React.useState(0.5)
  const [storeys, setStoreys] = React.useState(12)
  const [occupancy, setOccupancy] = React.useState(0.55)
  const [crown, setCrown] = React.useState<TowerBlockCrown>("mast")
  const [cutaway, setCutaway] = React.useState<"on" | "off">("on")
  const [floor, setFloor] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="lift" value={drive} options={["service", "night", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="crown" value={crown} options={["mast", "plant", "none"] as const} onChange={setCrown} />
      <Segmented label="shaft" value={cutaway} options={["on", "off"] as const} onChange={setCutaway} />
      <NumberControl label="storeys" value={storeys} min={4} max={24} onChange={setStoreys} />
      <NumberControl label="lived in" value={occupancy} min={0} max={1} step={0.05} onChange={setOccupancy} format={v => `${Math.round(v * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="car" value={carriage} min={0} max={1} step={0.01} onChange={setCarriage} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag up and down to take the car. The counterweight falls exactly as far as it rises — the rope cannot stretch.</Hint>}
      <Readout rows={[["storey", `${floor}`]]} />
    </>}>
      <TowerBlock view={view} size={300} variant={variant} storeys={storeys} occupancy={occupancy}
        crown={crown} cutaway={cutaway === "on"} label="TOWER / 01" onFloorChange={setFloor}
        {...(drive === "manual" ? { carriage } : { behavior: drive })} interactive />
    </Bench>
  )
}

function EspressoMachineDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<EspressoBehavior | "manual">("pull")
  const [shot, setShot] = React.useState(0.4)
  const [cups, setCups] = React.useState<"1" | "2">("1")
  const [wand, setWand] = React.useState(18)
  const [cutaway, setCutaway] = React.useState<"on" | "off">("on")
  const [bar, setBar] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["pull", "steam", "idle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="cups" value={cups} options={["1", "2"] as const} onChange={setCups} />
      <Segmented label="group" value={cutaway} options={["on", "off"] as const} onChange={setCutaway} />
      <NumberControl label="wand" value={wand} min={-40} max={40} onChange={setWand} format={v => `${v}°`} />
      {drive === "manual"
        ? <NumberControl label="shot" value={shot} min={0} max={1} step={0.01} onChange={setShot} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag down the frame to pull the lever. The gauge falls through the shot because the spring is paying its force back.</Hint>}
      <Readout rows={[["group", `${bar.toFixed(1)} bar`]]} />
    </>}>
      <EspressoMachine view={view} size={320} variant={variant} cups={cups === "2" ? 2 : 1}
        wand={wand} cutaway={cutaway === "on"} label="LEVER / 01" onPressureChange={setBar}
        {...(drive === "manual" ? { shot } : { behavior: drive })} interactive />
    </Bench>
  )
}

function RefrigeratorDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<RefrigeratorBehavior | "manual">("service")
  const [layout, setLayout] = React.useState<RefrigeratorLayout>("top-freezer")
  const [door, setDoor] = React.useState(0.6)
  const [freezer, setFreezer] = React.useState(0)
  const [shelves, setShelves] = React.useState(3)
  const [at, setAt] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="doors" value={drive} options={["service", "idle", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="layout" value={layout} options={["top-freezer", "side-by-side", "single"] as const} onChange={setLayout} />
      <NumberControl label="shelves" value={shelves} min={2} max={5} onChange={setShelves} />
      <NumberControl label="freezer" value={freezer} min={0} max={1} step={0.05} onChange={setFreezer} format={v => `${Math.round(v * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="door" value={door} min={0} max={1} step={0.05} onChange={setDoor} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to swing the fresh door. The lamp is a real switch: it makes the moment the seal breaks.</Hint>}
      <Readout rows={[["door", `${Math.round(at * 110)}°`]]} />
    </>}>
      <Refrigerator view={view} size={290} variant={variant} layout={layout} shelves={shelves}
        freezer={freezer} label="COLD / 01" onDoorChange={setAt}
        {...(drive === "manual" ? { door } : { behavior: drive })} interactive />
    </Bench>
  )
}

function WashingMachineDemo() {
  const [view, setView] = React.useState<RobotView>("front")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<WashingBehavior | "manual">("cycle")
  const [loading, setLoading] = React.useState<WashingLoading>("front")
  const [rpm, setRpm] = React.useState(320)
  const [load, setLoad] = React.useState(6)
  const [door, setDoor] = React.useState(0)
  const [at, setAt] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="cycle" value={drive} options={["cycle", "spin", "dry", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="loading" value={loading} options={["front", "top"] as const} onChange={setLoading} />
      <NumberControl label="load" value={load} min={0} max={10} onChange={setLoad} />
      <NumberControl label="door" value={door} min={0} max={1} step={0.05} onChange={setDoor} format={v => `${Math.round(v * 100)}%`} />
      {drive === "manual"
        ? <NumberControl label="rpm" value={rpm} min={0} max={1600} step={10} onChange={setRpm} />
        : <Hint>Drag across to run the drum up through 320 rpm — that is where the suspension resonates, and it is calm again above it.</Hint>}
      <Readout rows={[["drum", `${Math.round(at)} rpm`]]} />
    </>}>
      <WashingMachine view={view} size={300} variant={variant} loading={loading} load={load}
        door={door} label="WASH / 01" onRpmChange={setAt}
        {...(drive === "manual" ? { rpm } : { behavior: drive })} interactive />
    </Bench>
  )
}

function RailLocomotiveDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<RailLocomotiveBehavior>("line")
  const [curve, setCurve] = React.useState(7)
  const [cars, setCars] = React.useState(1)
  const [pantograph, setPantograph] = React.useState<RailLocomotivePantograph>("auto")
  const ride = bogieRide(curve === 0 ? Infinity : curveRadius(curve, 88), {
    pivotSpacing: 88,
    halfLength: 66,
  })
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["line", "yard", "depot", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented
            label="pan"
            value={pantograph}
            options={["auto", "raised", "stowed"] as const}
            onChange={setPantograph}
          />
          <NumberControl label="curve" value={curve} min={-10} max={10} step={0.5} onChange={setCurve} format={(v) => `${v}°`} />
          <NumberControl label="cars" value={cars} min={0} max={4} onChange={setCars} />
          <Hint>
            Nothing on board steers. Bend the track and the bogies take the tangent
            under their own pivots — the body is only the chord between them.
          </Hint>
          <Readout
            rows={[
              ["radius", curve === 0 ? "straight" : `${Math.round(ride.radius)} u`],
              ["centre throw", `${ride.centreThrow.toFixed(1)} u`],
              ["end throw", `${ride.endThrow.toFixed(1)} u`],
            ]}
          />
        </>
      }
    >
      <RailLocomotive
        view={view}
        size={320}
        variant={variant}
        curve={curve}
        cars={cars}
        pantograph={pantograph}
        behavior={behavior}
        showThrow
        label="CLASS / 90"
        interactive
        onCurveChange={setCurve}
      />
    </Bench>
  )
}

function RailBogieDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<RailBogieBehavior>("hunt")
  const [travel, setTravel] = React.useState(6)
  const [conicity, setConicity] = React.useState(0.1)
  const wavelength = klingelWavelength({ wheelRadius: 19, halfGauge: 33, conicity })
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["hunt", "curve", "brake", "static"] as const}
            onChange={setBehavior}
          />
          <NumberControl label="run" value={travel} min={0} max={40} step={0.5} onChange={setTravel} format={(v) => `${v}d`} />
          <NumberControl
            label="conicity"
            value={conicity}
            min={0}
            max={0.4}
            step={0.01}
            onChange={setConicity}
            format={(v) => v.toFixed(2)}
          />
          <Hint>
            Take the cone to zero and the weave stops dead — nothing was driving it
            but the shape of the tread.
          </Hint>
          <Readout
            rows={[
              [
                "wavelength",
                Number.isFinite(wavelength) ? `${Math.round(wavelength / 38)} d` : "infinite",
              ],
            ]}
          />
        </>
      }
    >
      <RailBogie
        view={view}
        size={300}
        variant={variant}
        travel={travel}
        conicity={conicity}
        behavior={behavior}
        label="BOGIE / B5"
        interactive
        onTravelChange={setTravel}
      />
    </Bench>
  )
}

function PantographCollectorDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<PantographBehavior>("raise")
  const [height, setHeight] = React.useState(1)
  const [along, setAlong] = React.useState(24)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["raise", "run", "stow", "static"] as const}
            onChange={setBehavior}
          />
          <NumberControl label="height" value={height} min={0} max={1} step={0.02} onChange={setHeight} format={(v) => `${Math.round(v * 100)}%`} />
          <NumberControl label="along" value={along} min={0} max={140} onChange={setAlong} />
          <Hint>
            Height is bought with reach: the knee folds in as the pan goes up. Front
            is where the stagger reads — the contact walks across the strip.
          </Hint>
        </>
      }
    >
      <PantographCollector
        view={view}
        size={300}
        variant={variant}
        height={height}
        along={along}
        behavior={behavior}
        label="COLLECTOR / SA"
        interactive
        onHeightChange={setHeight}
      />
    </Bench>
  )
}

function RailTurnoutDemo() {
  const [view, setView] = React.useState<RobotView>("plan")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<RailTurnoutBehavior>("route")
  const [position, setPosition] = React.useState(1)
  const [number, setNumber] = React.useState(5)
  const [hand, setHand] = React.useState<"left" | "right">("right")
  const geometry = turnoutGeometry(number, 18)
  const blades = bladePose(position, 7, 1.4)
  return (
    <Bench
      controls={
        <>
          <Segmented label="view" value={view} options={views} onChange={setView} />
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented
            label="motion"
            value={behavior}
            options={["route", "creep", "static"] as const}
            onChange={setBehavior}
          />
          <Segmented label="hand" value={hand} options={["left", "right"] as const} onChange={setHand} />
          <NumberControl label="throw" value={position} min={0} max={1} step={0.02} onChange={setPosition} format={(v) => v.toFixed(2)} />
          <NumberControl label="number" value={number} min={3} max={12} onChange={setNumber} format={(v) => `1:${v}`} />
          <Hint>
            Stop it half way and there is no route at all — the route is detection,
            not a setting. A bigger number is a longer, flatter turnout, to scale.
          </Hint>
          <Readout
            rows={[
              ["route", blades.route],
              ["crossing", `${geometry.crossingAngle.toFixed(1)}°`],
              ["lead", `${Math.round(geometry.lead)} u`],
            ]}
          />
        </>
      }
    >
      <RailTurnout
        view={view}
        size={230}
        variant={variant}
        throwPosition={position}
        number={number}
        hand={hand}
        behavior={behavior}
        label="TURNOUT / 1:5"
        interactive
        onThrowChange={setPosition}
      />
    </Bench>
  )
}

const masks: FacemaskStyle[] = ["cage", "bar", "shield"]

function RobotFootballDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<FootballBehavior | "manual">("spiral")
  const [spin, setSpin] = React.useState(6)
  const [roll, setRoll] = React.useState(40)
  const [pitch, setPitch] = React.useState(10)
  const [yaw, setYaw] = React.useState(0)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="flight" value={drive} options={["spiral", "wobble", "tumble", "snap", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="spin" value={spin} min={0} max={16} onChange={setSpin} format={v => `${v}/cyc`} />
      {drive === "manual" ? <>
        <NumberControl label="yaw" value={yaw} min={-180} max={180} onChange={setYaw} format={v => `${v}°`} />
        <NumberControl label="pitch" value={pitch} min={-90} max={90} onChange={setPitch} format={v => `${v}°`} />
        <NumberControl label="roll" value={roll} min={0} max={360} onChange={setRoll} format={v => `${v}°`} />
      </> : <Hint>Drag across to roll it and up or down to pitch it. Nose-on the outline is a circle, because the outline is the ellipsoid&apos;s own central section — and the laces go round the back rather than sliding across the front.</Hint>}
    </>}>
      <RobotFootball view={view} size={320} variant={variant} spin={spin} label="BALL / 01"
        {...(drive === "manual" ? { yaw, pitch, roll } : { behavior: drive })} interactive />
    </Bench>
  )
}

function GridironLinemanDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<LinemanBehavior | "manual">("snap")
  const [stance, setStance] = React.useState<GridironStance>("three-point")
  const [fire, setFire] = React.useState(0.3)
  const [padLevel, setPadLevel] = React.useState(50)
  const [mask, setMask] = React.useState<FacemaskStyle>("cage")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="stance" value={stance} options={["three-point", "two-point", "set", "upright"] as const} onChange={setStance} />
      <Segmented label="drive" value={drive} options={["snap", "drive", "pull", "set", "static", "manual"] as const} onChange={setDrive} />
      <Segmented label="mask" value={mask} options={masks} onChange={setMask} />
      <NumberControl label="pad level" value={padLevel} min={0} max={100} onChange={setPadLevel} format={v => `${v}%`} />
      {drive === "manual"
        ? <NumberControl label="fire" value={fire} min={0} max={1} step={0.02} onChange={setFire} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to work the snap. Only the three-point stance puts a hand on the turf, and the flat back is the column pitch that being down there implies — nobody typed it.</Hint>}
    </>}>
      <GridironLineman view={view} size={320} variant={variant} stance={stance} mask={mask}
        padLevel={padLevel / 100} number="74" label="LINE / 74"
        {...(drive === "manual" ? { fire } : { behavior: drive })} interactive />
    </Bench>
  )
}

function GridironQuarterbackDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<QuarterbackBehavior | "manual">("throw")
  const [release, setRelease] = React.useState(0.55)
  const [steps, setSteps] = React.useState(5)
  const [velocity, setVelocity] = React.useState(27)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["throw", "drop", "scramble", "set", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="steps" value={steps} min={1} max={9} onChange={setSteps} />
      <NumberControl label="velocity" value={velocity} min={12} max={40} onChange={setVelocity} format={v => `${v} yd/s`} />
      {drive === "manual"
        ? <NumberControl label="release" value={release} min={0} max={1} step={0.02} onChange={setRelease} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to work the throw. The ball leaves on the velocity the hand had, so the release angle comes off the swing; the rest of the flight is off the frame and on the readout.</Hint>}
    </>}>
      <GridironQuarterback view={view} size={320} variant={variant} steps={steps} velocity={velocity}
        number="09" label="POCKET / 09"
        {...(drive === "manual" ? { release } : { behavior: drive })} interactive />
    </Bench>
  )
}

function GridironReceiverDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<ReceiverBehavior | "manual">("route")
  const [route, setRoute] = React.useState<RouteName>("post")
  const [depth, setDepth] = React.useState(12)
  const [side, setSide] = React.useState(1)
  const [distance, setDistance] = React.useState(12)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="route" value={route} options={routeNames} onChange={setRoute} />
      <Segmented label="drive" value={drive} options={["route", "release", "catch", "idle", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="depth" value={depth} min={4} max={24} onChange={setDepth} format={v => `${v} yd`} />
      <NumberControl label="side" value={side} min={-1} max={1} step={2} onChange={setSide} format={v => (v < 0 ? "left" : "right")} />
      {drive === "manual"
        ? <NumberControl label="distance" value={distance} min={0} max={36} step={0.5} onChange={setDistance} format={v => `${v} yd`} />
        : <Hint>Drag across to run the route by hand. The lean is the exterior angle at the break, so changing the route changes the pose without touching the drawing.</Hint>}
    </>}>
      <GridironReceiver view={view} size={340} variant={variant} route={route} depth={depth} side={side}
        number="88" label="ROUTE / 88"
        {...(drive === "manual" ? { distance } : { behavior: drive })} interactive />
    </Bench>
  )
}

function GridironKickerDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<KickerBehavior | "manual">("kick")
  const [kick, setKick] = React.useState<KickStyle>("place")
  const [power, setPower] = React.useState(85)
  const [distance, setDistance] = React.useState(35)
  const [swing, setSwing] = React.useState(0.5)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="kick" value={kick} options={["place", "punt", "kickoff"] as const} onChange={setKick} />
      <Segmented label="drive" value={drive} options={["kick", "approach", "set", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="power" value={power} min={20} max={110} onChange={setPower} format={v => `${v}%`} />
      <NumberControl label="uprights" value={distance} min={10} max={60} onChange={setDistance} format={v => `${v} yd`} />
      {drive === "manual"
        ? <NumberControl label="swing" value={swing} min={0} max={1} step={0.02} onChange={setSwing} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to work the swing. Whether it clears is the ball&apos;s height where the bar is — push the uprights out far enough and it says SHORT.</Hint>}
    </>}>
      <GridironKicker view={view} size={340} variant={variant} kick={kick} power={power / 100}
        distance={distance} number="03" label="KICK / 03"
        {...(drive === "manual" ? { swing } : { behavior: drive })} interactive />
    </Bench>
  )
}

function BlockingSledDemo() {
  const [view, setView] = React.useState<RobotView>("iso")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<SledBehavior | "manual">("drive")
  const [pads, setPads] = React.useState(3)
  const [stiffness, setStiffness] = React.useState(2600)
  const [weight, setWeight] = React.useState(220)
  const [load, setLoad] = React.useState(0.6)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["drive", "hit", "recoil", "idle", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="pads" value={pads} min={1} max={5} onChange={setPads} />
      <NumberControl label="spring" value={stiffness} min={800} max={6000} step={100} onChange={setStiffness} />
      <NumberControl label="weight" value={weight} min={60} max={600} step={10} onChange={setWeight} />
      {drive === "manual"
        ? <NumberControl label="load" value={load} min={0} max={1} step={0.02} onChange={setLoad} format={v => `${Math.round(v * 100)}%`} />
        : <Hint>Drag across to lean on it. The last few degrees cost far more than the first few, and the frame does not move at all until the drive beats the friction under the skids.</Hint>}
    </>}>
      <BlockingSled view={view} size={340} variant={variant} pads={pads} stiffness={stiffness}
        weight={weight} label="SLED / 05"
        {...(drive === "manual" ? { load } : { behavior: drive })} interactive />
    </Bench>
  )
}

function BallLauncherDemo() {
  const [view, setView] = React.useState<RobotView>("profile")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [drive, setDrive] = React.useState<LauncherBehavior | "manual">("feed")
  const [top, setTop] = React.useState(40)
  const [bottom, setBottom] = React.useState(20)
  const [elevation, setElevation] = React.useState(26)
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="drive" value={drive} options={["feed", "spin", "idle", "static", "manual"] as const} onChange={setDrive} />
      <NumberControl label="elevation" value={elevation} min={-10} max={70} onChange={setElevation} format={v => `${v}°`} />
      {drive === "manual" ? <>
        <NumberControl label="top" value={top} min={0} max={60} onChange={setTop} format={v => `${v}/s`} />
        <NumberControl label="bottom" value={bottom} min={0} max={60} onChange={setBottom} format={v => `${v}/s`} />
      </> : <Hint>Drag up and down to bias the wheels. Matched, it throws flat and fast with no spin; every turn of mismatch trades exit speed for rotation, and both numbers are on the readout.</Hint>}
    </>}>
      <BallLauncher view={view} size={330} variant={variant} elevation={elevation} label="FEED / 02"
        {...(drive === "manual" ? { top, bottom, behavior: "feed" as const } : { behavior: drive })} interactive />
    </Bench>
  )
}

export const demos: Record<string, React.ComponentType<DemoProps>> = {
  "robot-football": RobotFootballDemo,
  "gridiron-geometry": RobotFootballDemo,
  "gridiron-lineman": GridironLinemanDemo,
  "gridiron-quarterback": GridironQuarterbackDemo,
  "gridiron-receiver": GridironReceiverDemo,
  "gridiron-kicker": GridironKickerDemo,
  "blocking-sled": BlockingSledDemo,
  "ball-launcher": BallLauncherDemo,
  "gabled-house": GabledHouseDemo,
  "tower-block": TowerBlockDemo,
  "espresso-machine": EspressoMachineDemo,
  refrigerator: RefrigeratorDemo,
  "washing-machine": WashingMachineDemo,
  "household-geometry": WashingMachineDemo,
  "robot-sunflower": RobotSunflowerDemo,
  "phyllotaxis-geometry": RobotSunflowerDemo,
  "robot-cactus": RobotCactusDemo,
  "cactus-geometry": RobotCactusDemo,
  "celestial-planet": CelestialPlanetDemo,
  "celestial-moon": CelestialMoonDemo,
  "celestial-star": CelestialStarDemo,
  "celestial-asteroid": CelestialAsteroidDemo,
  orrery: OrreryDemo,
  "celestial-geometry": OrreryDemo,
  "battle-station": BattleStationDemo,
  "debris-field": DebrisFieldDemo,
  "hull-geometry": BattleStationDemo,
  pumpjack: PumpjackDemo,
  "drilling-derrick": DrillingDerrickDemo,
  "mud-pump": MudPumpDemo,
  "wellhead-tree": WellheadTreeDemo,
  "storage-tank": StorageTankDemo,
  "oil-tanker": OilTankerDemo,
  "tanker-truck": TankerTruckDemo,
  "flare-stack": FlareStackDemo,
  "fractionating-column": FractionatingColumnDemo,
  "jackup-rig": JackupRigDemo,
  "linkage-geometry": PumpjackDemo,
  "turntable-deck": TurntableDeckDemo,
  "gramophone-horn": GramophoneHornDemo,
  "music-box-drum": MusicBoxDrumDemo,
  "busker-droid": BuskerDroidDemo,
  "sound-geometry": TurntableDeckDemo,
  "robot-grand-piano": RobotGrandPianoDemo,
  "piano-geometry": RobotGrandPianoDemo,
  "clamshell-laptop": ClamshellLaptopDemo,
  "slate-tablet": SlateTabletDemo,
  "wheel-player": WheelPlayerDemo,
  "slab-handset": SlabHandsetDemo,
  "folding-handset": FoldingHandsetDemo,
  "wrist-terminal": WristTerminalDemo,
  "key-switch": KeySwitchDemo,
  "robot-keypad": RobotKeypadDemo,
  "robot-keyboard": RobotKeyboardDemo,
  "input-terminal": InputTerminalDemo,
  "keyboard-geometry": RobotKeyboardDemo,
  "device-geometry": ClamshellLaptopDemo,
  "planetary-gearbox": PlanetaryGearboxDemo,
  "belt-drive": BeltDriveDemo,
  "cable-carrier": CableCarrierDemo,
  "mecanum-wheel": MecanumWheelDemo,
  "tool-changer": ToolChangerDemo,
  "suction-gripper": SuctionGripperDemo,
  "robot-hand": RobotHandDemo,
  "hand-kinematics": RobotHandDemo,
  "robot-foot": RobotFootDemo,
  "robot-leg": RobotLegDemo,
  "robot-torso": RobotTorsoDemo,
  "robot-skeleton": RobotSkeletonDemo,
  "skeleton-kinematics": RobotSkeletonDemo,
  "motion-platform": MotionPlatformDemo,
  "transmission-geometry": PlanetaryGearboxDemo,
  fabricator: FabricatorDemo,
  "voxel-form": VoxelFormDemo,
  "arm-fabricator": ArmFabricatorDemo,
  "drone-fabricator": DroneFabricatorDemo,
  "voxel-geometry": VoxelFormDemo,
  "utility-droid": UtilityDroidDemo,
  "orb-droid": OrbDroidDemo,
  "bellows-droid": BellowsDroidDemo,
  "robot-avocado": RobotAvocadoDemo,
  "robot-strawberry": RobotStrawberryDemo,
  "robot-tomato": RobotTomatoDemo,
  "produce-geometry": RobotStrawberryDemo,
  "protocol-droid": ProtocolDroidDemo,
  "security-droid": SecurityDroidDemo,
  "medical-droid": MedicalDroidDemo,
  "infantry-droid": InfantryDroidDemo,
  "probe-droid": ProbeDroidDemo,
  "courier-droid": CourierDroidDemo,
  "casing-droid": CasingDroidDemo,
  "astromech-droid": AstromechDroidDemo,
  "attendant-droid": AttendantDroidDemo,
  "cyber-trooper": CyberTrooperDemo,
  "robot-hound": RobotHoundDemo,
  "guide-droid": GuideDroidDemo,
  "monolith-droid": MonolithDroidDemo,
  "pylon-droid": PylonDroidDemo,
  "custodian-droid": CustodianDroidDemo,
  "sentinel-console": SentinelConsoleDemo,
  "robot-fish": RobotFishDemo,
  "robot-snake": RobotSnakeDemo,
  "spine-kinematics": RobotSnakeDemo,
  "robot-spider": RobotSpiderDemo,
  "robot-crab": RobotCrabDemo,
  "hexapod-kinematics": RobotSpiderDemo,
  "tripod-droid": TripodDroidDemo,
  "tripod-kinematics": TripodDroidDemo,
  "scout-walker": ScoutWalkerDemo,
  "siege-walker": SiegeWalkerDemo,
  "walker-kinematics": SiegeWalkerDemo,
  "robot-bird": RobotBirdDemo,
  "robot-dragonfly": RobotDragonflyDemo,
  "robot-bat": RobotBatDemo,
  "robot-jellyfish": RobotJellyfishDemo,
  "robot-manta": RobotMantaDemo,
  "robot-octopus": RobotOctopusDemo,
  "robot-seahorse": RobotSeahorseDemo,
  "robot-ant": RobotAntDemo,
  "robot-scorpion": RobotScorpionDemo,
  "robot-mantis": RobotMantisDemo,
  "robot-frog": RobotFrogDemo,
  "spring-hopper": SpringHopperDemo,
  "ball-hopper": BallHopperDemo,
  "hopper-dynamics": SpringHopperDemo,
  "robot-cat": RobotCatDemo,
  "robot-dog": RobotDogDemo,
  "robot-fox": RobotFoxDemo,
  "robot-bear": RobotBearDemo,
  "robot-polar-bear": RobotPolarBearDemo,
  "robot-panda": RobotPandaDemo,
  "bear-kinematics": RobotBearDemo,
  "robot-horse": RobotHorseDemo,
  "robot-pegasus": RobotPegasusDemo,
  "robot-camel": RobotCamelDemo,
  "gait-kinematics": RobotHorseDemo,
  "robot-turtle": RobotTurtleDemo,
  "robot-inchworm": RobotInchwormDemo,
  "micro-duck": MicroDuckDemo,
  "duck-kinematics": MicroDuckDemo,
  "reachy-mini": ReachyMiniDemo,
  "animatronic-face": AnimatronicFaceDemo,
  "face-actuation": AnimatronicFaceDemo,
  "stewart-kinematics": ReachyMiniDemo,
  "robot-quadruped": RobotQuadrupedDemo,
  "quadruped-kinematics": RobotQuadrupedDemo,
  "linear-actuator": LinearActuatorDemo,
  "servo-motor": ServoMotorDemo,
  "radial-bloom": RadialBloomDemo,
  "rotary-table": RotaryTableDemo,
  "robot-rover": RobotRoverDemo,
  "robot-drone": RobotDroneDemo,
  "lidar-scan": LidarScanDemo,
  "robot-car": RobotCarDemo,
  "transit-bus": TransitBusDemo,
  "rail-locomotive": RailLocomotiveDemo,
  "rail-bogie": RailBogieDemo,
  "pantograph-collector": PantographCollectorDemo,
  "rail-turnout": RailTurnoutDemo,
  "rail-geometry": RailLocomotiveDemo,
  "cargo-plane": CargoPlaneDemo,
  "hydrofoil-craft": HydrofoilCraftDemo,
  "launch-vehicle": LaunchVehicleDemo,
  "strike-starfighter": StrikeStarfighterDemo,
  "ion-interceptor": IonInterceptorDemo,
  "vehicle-geometry": RobotCarDemo,
  "robot-gripper": RobotGripperDemo,
  "conveyor-belt": ConveyorBeltDemo,
  "robot-arm": RobotArmDemo,
  "robot-arm-3d": RobotArm3DDemo,
  "robot-stage": RobotStageDemo,
  "scara-arm": ScaraArmDemo,
  "delta-arm": DeltaArmDemo,
  "gantry-arm": GantryArmDemo,
  "robot-face": RobotFaceDemo,
  "robot-loader": RobotLoaderDemo,
  "arm-controls": ArmControlsDemo,
  "robot-kinematics": KinematicsDemo,
  "electromagnetism-geometry": ServoMotorDemo,
  "induction-motor": InductionMotorDemo,
  "stepper-motor": StepperMotorDemo,
  "voice-coil-actuator": VoiceCoilActuatorDemo,
  "magnetic-bearing": MagneticBearingDemo,
  "eddy-current-brake": EddyCurrentBrakeDemo,
  "maglev-carriage": MaglevCarriageDemo,
  "magnetic-gripper": MagneticGripperDemo,
  "inductive-sensor": InductiveSensorDemo,
  "resolver": ResolverDemo,
  "transformer-core": TransformerCoreDemo,
  "solenoid-valve": SolenoidValveDemo,
  "electromagnetic-relay": ElectromagneticRelayDemo,
  "robot-style": StyleDemo,
  "robot-color": ColorDemo,
  "use-robot-arm": UseRobotArmDemo,
  "use-pointer-target": UsePointerTargetDemo,
}

/**
 * The bench an item gets when nobody has written one: the machine at size, its
 * own behaviour running, and the two switches every machine in the registry
 * answers to. Deliberately plain — a written demo beats it, and it beats the
 * empty panel that used to be there.
 */
function AutoDemo({ slug }: DemoProps) {
  const entry = galleryEntries[slug]
  const [variant, setVariant] = React.useState<RobotVariant>(
    entry?.blueprint ? "blueprint" : "solid",
  )
  const [view, setView] = React.useState<RobotView>("front")
  const Machine = entry?.component
  if (!Machine) return null
  if (slug.startsWith("robotic-")) {
    return (
      <div className="flex min-h-72 items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-2xl">
          <Machine />
        </div>
      </div>
    )
  }
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Hint>
        {entry.draws === slug
          ? "Running its own cycle. Every prop it takes is on the props table below."
          : "Drawn by the machine this file solves for, so you can see the maths move."}
      </Hint>
    </>}>
      {/* `view` is not universal — a machine drawn in one projection ignores
          it rather than failing, which is the same contract the props table
          documents. */}
      <Machine size={320} variant={variant} {...({ view } as { view?: RobotView })} />
    </Bench>
  )
}

/**
 * Every registry item, mapped to the bench that demonstrates it: the written
 * one where there is one, and the generated one everywhere else.
 *
 * A record rather than a function on purpose. Manufacturing a component per
 * slug would reset the bench's state on every render, and the React Compiler
 * rule refuses the call site outright — so both branches are module-level
 * components and the lookup is an index.
 */
export const demoBySlug: Record<string, React.ComponentType<DemoProps>> = {
  ...Object.fromEntries(
    Object.entries(galleryEntries)
      .filter(([, entry]) => entry.component)
      .map(([slug]) => [slug, AutoDemo]),
  ),
  ...demos,
}

/** The bench for a doc slug, or null for a page that demonstrates nothing. */
export function demoFor(slug: string): React.ComponentType<DemoProps> | null {
  return demoBySlug[slug] ?? null
}
