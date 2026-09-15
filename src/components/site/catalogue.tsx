"use client"

/**
 * The landing grid: one card per registry item, all of them, grouped the way
 * the docs index groups them.
 *
 * This file owns only the **art** and the one-clause card line. The title, the
 * group and the order arrive from `docs.ts` through the server page, so a
 * renamed component cannot drift out of sync with its card, and the props
 * tables in `docs.ts` never cross into the client bundle.
 *
 * `art` below is an override, not a prerequisite: an item nobody has posed
 * falls back to its own component with nothing set but a size, which is the
 * pose and the cycle its author already wrote. Nothing in here may be pinned —
 * `catalogue-motion.test.tsx` drives frames at every card and fails the ones
 * that draw the same picture twice. Notes: `docs/gallery-coverage.md`.
 *
 * A Foundations item is a `.ts` file, so its card shows the machine that
 * exercises it drawn in `blueprint` — the register the page already reserves
 * for explaining a mechanism rather than selling one.
 *
 * Every card is a live machine with its own animation frame loop, so the art is
 * mounted only while its card is near the viewport and unmounted again when it
 * leaves: `docs/catalogue-virtualization.md`.
 *
 * Design notes: `docs/landing-catalogue.md`.
 */

import * as React from "react"
import Link from "next/link"

import { CourierDroid } from "@/components/ui/courier-droid"
import { AstromechDroid } from "@/components/ui/astromech-droid"
import { AttendantDroid } from "@/components/ui/attendant-droid"
import { BellowsDroid } from "@/components/ui/bellows-droid"
import { RobotAvocado } from "@/components/ui/robot-avocado"
import { RobotStrawberry } from "@/components/ui/robot-strawberry"
import { RobotTomato } from "@/components/ui/robot-tomato"
import { CasingDroid } from "@/components/ui/casing-droid"
import { CyberTrooper } from "@/components/ui/cyber-trooper"
import { CustodianDroid } from "@/components/ui/custodian-droid"
import { GuideDroid } from "@/components/ui/guide-droid"
import { RobotCamel } from "@/components/ui/robot-camel"
import { RobotHorse } from "@/components/ui/robot-horse"
import { RobotHound } from "@/components/ui/robot-hound"
import { RobotPegasus } from "@/components/ui/robot-pegasus"
import { MonolithDroid } from "@/components/ui/monolith-droid"
import { TripodDroid } from "@/components/ui/tripod-droid"
import { ScoutWalker } from "@/components/ui/scout-walker"
import { SiegeWalker } from "@/components/ui/siege-walker"
import { PylonDroid } from "@/components/ui/pylon-droid"
import { SentinelConsole } from "@/components/ui/sentinel-console"
import { InfantryDroid } from "@/components/ui/infantry-droid"
import { MedicalDroid } from "@/components/ui/medical-droid"
import { MicroDuck } from "@/components/ui/micro-duck"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ProbeDroid } from "@/components/ui/probe-droid"
import { ProtocolDroid } from "@/components/ui/protocol-droid"
import { ReachyMini } from "@/components/ui/reachy-mini"
import { AnimatronicFace } from "@/components/ui/animatronic-face"
import { SecurityDroid } from "@/components/ui/security-droid"
import { UtilityDroid } from "@/components/ui/utility-droid"
import { RobotBird } from "@/components/ui/robot-bird"
import { RobotCrab } from "@/components/ui/robot-crab"
import { RobotFish } from "@/components/ui/robot-fish"
import { RobotSnake } from "@/components/ui/robot-snake"
import { RobotSpider } from "@/components/ui/robot-spider"
import { RobotAnt } from "@/components/ui/robot-ant"
import { RobotBat } from "@/components/ui/robot-bat"
import { RobotDragonfly } from "@/components/ui/robot-dragonfly"
import { BallHopper } from "@/components/ui/ball-hopper"
import { RobotFrog } from "@/components/ui/robot-frog"
import { SpringHopper } from "@/components/ui/spring-hopper"
import { RobotCat } from "@/components/ui/robot-cat"
import { RobotDog } from "@/components/ui/robot-dog"
import { RobotFox } from "@/components/ui/robot-fox"
import { RobotBear } from "@/components/ui/robot-bear"
import { RobotPolarBear } from "@/components/ui/robot-polar-bear"
import { RobotPanda } from "@/components/ui/robot-panda"
import { RobotInchworm } from "@/components/ui/robot-inchworm"
import { RobotJellyfish } from "@/components/ui/robot-jellyfish"
import { RobotManta } from "@/components/ui/robot-manta"
import { RobotMantis } from "@/components/ui/robot-mantis"
import { RobotOctopus } from "@/components/ui/robot-octopus"
import { RobotScorpion } from "@/components/ui/robot-scorpion"
import { RobotSeahorse } from "@/components/ui/robot-seahorse"
import { RobotTurtle } from "@/components/ui/robot-turtle"
import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import { RobotCar } from "@/components/ui/robot-car"
import { TransitBus } from "@/components/ui/transit-bus"
import { RailLocomotive } from "@/components/ui/rail-locomotive"
import { RailBogie } from "@/components/ui/rail-bogie"
import { PantographCollector } from "@/components/ui/pantograph-collector"
import { RailTurnout } from "@/components/ui/rail-turnout"
import { BallLauncher } from "@/components/ui/ball-launcher"
import { BlockingSled } from "@/components/ui/blocking-sled"
import { GridironKicker } from "@/components/ui/gridiron-kicker"
import { GridironLineman } from "@/components/ui/gridiron-lineman"
import { GridironQuarterback } from "@/components/ui/gridiron-quarterback"
import { GridironReceiver } from "@/components/ui/gridiron-receiver"
import { RobotFootball } from "@/components/ui/robot-football"
import { CargoPlane } from "@/components/ui/cargo-plane"
import { HydrofoilCraft } from "@/components/ui/hydrofoil-craft"
import { LaunchVehicle } from "@/components/ui/launch-vehicle"
import { StrikeStarfighter } from "@/components/ui/strike-starfighter"
import { IonInterceptor } from "@/components/ui/ion-interceptor"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { ServoMotor } from "@/components/ui/servo-motor"
import { RadialBloom } from "@/components/ui/radial-bloom"
import { PowerLantern } from "@/components/ui/power-lantern"
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
import { RotaryTable } from "@/components/ui/rotary-table"
import { RobotRover } from "@/components/ui/robot-rover"
import { RobotDrone } from "@/components/ui/robot-drone"
import { LidarScan } from "@/components/ui/lidar-scan"

import { ClamshellLaptop } from "@/components/ui/clamshell-laptop"
import { SlateTablet } from "@/components/ui/slate-tablet"
import { WheelPlayer } from "@/components/ui/wheel-player"
import { TurntableDeck } from "@/components/ui/turntable-deck"
import { GramophoneHorn } from "@/components/ui/gramophone-horn"
import { MusicBoxDrum } from "@/components/ui/music-box-drum"
import { RobotGrandPiano } from "@/components/ui/robot-grand-piano"
import { BuskerDroid } from "@/components/ui/busker-droid"
import { SlabHandset } from "@/components/ui/slab-handset"
import { FoldingHandset } from "@/components/ui/folding-handset"
import { WristTerminal } from "@/components/ui/wrist-terminal"
import { KeySwitch } from "@/components/ui/key-switch"
import { RobotKeypad } from "@/components/ui/robot-keypad"
import { RobotKeyboard } from "@/components/ui/robot-keyboard"
import { InputTerminal } from "@/components/ui/input-terminal"
import { ArmFabricator } from "@/components/ui/arm-fabricator"
import { DroneFabricator } from "@/components/ui/drone-fabricator"
import { Fabricator } from "@/components/ui/fabricator"
import { VoxelForm } from "@/components/ui/voxel-form"
import { RobotGripper } from "@/components/ui/robot-gripper"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"

import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotFace } from "@/components/ui/robot-face"
import { RobotLoader } from "@/components/ui/robot-loader"
import { ScaraArm } from "@/components/ui/scara-arm"
import { BeltDrive } from "@/components/ui/belt-drive"
import { CableCarrier } from "@/components/ui/cable-carrier"
import { MecanumWheel } from "@/components/ui/mecanum-wheel"
import { MotionPlatform } from "@/components/ui/motion-platform"
import { PlanetaryGearbox } from "@/components/ui/planetary-gearbox"
import { RobotHand } from "@/components/ui/robot-hand"
import { RobotFoot } from "@/components/ui/robot-foot"
import { RobotLeg } from "@/components/ui/robot-leg"
import { RobotTorso } from "@/components/ui/robot-torso"
import { RobotSkeleton } from "@/components/ui/robot-skeleton"
import { SuctionGripper } from "@/components/ui/suction-gripper"
import { ToolChanger } from "@/components/ui/tool-changer"
import { RobotSunflower } from "@/components/ui/robot-sunflower"
import { RobotCactus } from "@/components/ui/robot-cactus"
import { CelestialPlanet } from "@/components/ui/celestial-planet"
import { CelestialMoon } from "@/components/ui/celestial-moon"
import { CelestialStar } from "@/components/ui/celestial-star"
import { CelestialAsteroid } from "@/components/ui/celestial-asteroid"
import { Orrery } from "@/components/ui/orrery"
import { BattleStation } from "@/components/ui/battle-station"
import { DebrisField } from "@/components/ui/debris-field"
import { GabledHouse } from "@/components/ui/gabled-house"
import { TowerBlock } from "@/components/ui/tower-block"
import { EspressoMachine } from "@/components/ui/espresso-machine"
import { Refrigerator } from "@/components/ui/refrigerator"
import { WashingMachine } from "@/components/ui/washing-machine"
import { CatalogueStage } from "@/components/site/catalogue-stage"
import { useNearViewport } from "@/components/site/use-near-viewport"
import { Pumpjack } from "@/components/ui/pumpjack"
import { DrillingDerrick } from "@/components/ui/drilling-derrick"
import { MudPump } from "@/components/ui/mud-pump"
import { WellheadTree } from "@/components/ui/wellhead-tree"
import { StorageTank } from "@/components/ui/storage-tank"
import { OilTanker } from "@/components/ui/oil-tanker"
import { TankerTruck } from "@/components/ui/tanker-truck"
import { FlareStack } from "@/components/ui/flare-stack"
import { FractionatingColumn } from "@/components/ui/fractionating-column"
import { JackupRig } from "@/components/ui/jackup-rig"
import { CableStation } from "@/components/ui/cable-station"
import { ResistanceCam } from "@/components/ui/resistance-cam"
import { galleryEntries } from "@/components/site/gallery.generated"
import { Panel } from "@/components/site/panel"

/** Metadata that crosses the server boundary. Everything else stays in `docs.ts`. */
export interface CatalogueCard {
  slug: string
  title: string
  group: string
  /** Falls back to the card line for an item nobody has hand-posed. */
  summary?: string
}

interface Art {
  /** One clause. The docs summary is the two-sentence version. */
  line: string
  art: React.ReactNode
}

const lidarSamples = Array.from({ length: 36 }, (_, i) => ({
  angle: i * 10,
  distance: 5 + 2 * Math.sin(i * 0.7),
}))

/** Keyed by registry item name, which is also the doc slug. */
const art: Record<string, Art> = {
  // The oil field — upstream to downstream, with the product in the accent.
  pumpjack: { line: "A four-bar that turns a crank into a stroke.", art: <Pumpjack size={200} phase={0.3} /> },
  "drilling-derrick": { line: "Mechanical advantage, drawn as rope.", art: <DrillingDerrick size={120} lines={8} phase={0.4} /> },
  "mud-pump": { line: "Three slider-cranks, a third of a turn apart.", art: <MudPump size={230} phase={0.2} /> },
  "wellhead-tree": { line: "Open valves decide which bore is live.", art: <WellheadTree size={140} phase={0.5} /> },
  "storage-tank": { line: "The roof floats, and the ladder answers.", art: <StorageTank size={200} courses={5} phase={0.6} /> },
  "oil-tanker": { line: "The cargo sets how deep she sits.", art: <OilTanker size={280} behavior="swell" phase={0.2} /> },
  "tanker-truck": { line: "Steer the tractor; the trailer\u2019s angle is solved.", art: <TankerTruck size={300} behavior="manoeuvre" phase={0.3} /> },
  "flare-stack": { line: "A plume that is a length, not a rate.", art: <FlareStack size={118} phase={0.25} /> },
  "fractionating-column": { line: "The tray count rebuilds the whole tower.", art: <FractionatingColumn size={124} behavior="swing" trays={18} cut={2} phase={0.4} /> },
  "jackup-rig": { line: "One number: the air gap and the stick-up.", art: <JackupRig size={150} phase={0.35} /> },
  "linkage-geometry": { line: "A four-bar, a slider-crank, and a rope-length constraint.", art: <Pumpjack size={200} variant="blueprint" phase={0.7} /> },
  // Robots
  "utility-droid": { line: "Rotating dome, modular tools, three service series.", art: <UtilityDroid size={150} series="navigator" tool="scanner" /> },
  "orb-droid": { line: "Rolling shell, stabilized head, tracking optic.", art: <OrbDroid size={155} track={false} /> },
  "bellows-droid": { line: "A pleated shell that inflates, and nothing else moves.", art: <BellowsDroid size={160} pleats={7} label="BELLOWS / 01" /> },
  "robot-avocado": { line: "One shell, cut in half, with the stone riding up the gap.", art: <RobotAvocado size={150} interactive={false} /> },
  "robot-strawberry": { line: "Studs placed by the golden angle over its own skin.", art: <RobotStrawberry size={150} seeds={30} interactive={false} /> },
  "robot-tomato": { line: "The one machine here that hangs instead of standing.", art: <RobotTomato size={165} interactive={false} /> },
  "protocol-droid": { line: "Formal humanoid with four expressive gestures.", art: <ProtocolDroid size={128} pose="converse" /> },
  "security-droid": { line: "Tall guard frame with patrol and alert states.", art: <SecurityDroid size={128} alert track={false} /> },
  "medical-droid": { line: "Diagnostic display and modular instrument arms.", art: <MedicalDroid size={150} leftTool="scanner" rightTool="injector" /> },
  "infantry-droid": { line: "Light and heavy frames with controlled poses.", art: <InfantryDroid size={130} frame="light" equipment="pack" /> },
  "probe-droid": { line: "Hovering sensor pod with articulated appendages.", art: <ProbeDroid size={160} appendages={5} active /> },
  "courier-droid": { line: "Compact runner with steering and cargo modules.", art: <CourierDroid size={170} cargo="pod" /> },
  "casing-droid": { line: "Armoured casing, swinging eyestalk, swappable manipulator.", art: <CasingDroid size={150} manipulator="clamp" /> },
  "astromech-droid": { line: "Barrel repair unit with a panel, periscope and holo.", art: <AstromechDroid size={150} tool="welder" /> },
  "attendant-droid": { line: "Plated etiquette humanoid with a vocoder face.", art: <AttendantDroid size={128} /> },
  "cyber-trooper": { line: "Converted frame with handles and a power reserve.", art: <CyberTrooper size={128} chestUnit="core" /> },
  "pylon-droid": { line: "A plate that folds its whole robot inside its outline.", art: <PylonDroid size={158} stance="wide" track={false} interactive={false} /> },
  "robot-hound": { line: "A wedge on a drive, and a head on a collar that runs out.", art: <RobotHound size={215} track={false} interactive={false} /> },
  "guide-droid": { line: "Rotor overhead, hands and feet on springs.", art: <GuideDroid size={150} track={false} interactive={false} /> },
  "monolith-droid": { line: "Four hinged slabs; that is the whole machine.", art: <MonolithDroid size={150} interactive={false} /> },
  "tripod-droid": { line: "Three legs, so it leans onto two before it lifts the third.", art: <TripodDroid size={195} interactive={false} track={false} /> },
  "scout-walker": { line: "One foot down, so the whole cab rolls over onto it.", art: <ScoutWalker size={175} behavior="patrol" phase={0.6} interactive={false} track={false} look={{ x: 0.3, y: 0 }} /> },
  "siege-walker": { line: "Four feet at the corners: it hardly leans at all.", art: <SiegeWalker size={240} behavior="march" phase={0.4} interactive={false} track={false} look={{ x: 0.25, y: 0.1 }} /> },
  "custodian-droid": { line: "Armour on rails: the shell blooms off a lit chassis.", art: <CustodianDroid size={150} track={false} interactive={false} /> },
  "sentinel-console": { line: "A wall fixture that watches: one solved iris, one gimballed optic.", art: <SentinelConsole size={88} track={false} interactive={false} plate="SENTINEL" /> },
  "robot-fish": { line: "A body wave with the beat piled at the tail.", art: <RobotFish size={215} fins={22} interactive={false} showGround={false} /> },
  "robot-snake": { line: "Serpentine, sidewinding, or curled up.", art: <RobotSnake size={195} waves={1.4} interactive={false} showGround={false} /> },
  "robot-spider": { line: "Eight solved legs on a tripod gait.", art: <RobotSpider size={168} gait="tripod" interactive={false} /> },
  "robot-crab": { line: "The same gait, turned sideways, plus claws.", art: <RobotCrab size={205} gait="tripod" interactive={false} /> },
  "robot-bird": { line: "Three-link wings and a fanning tail.", art: <RobotBird size={172} interactive={false} /> },
  "robot-dragonfly": { line: "Two wing pairs, half a cycle apart.", art: <RobotDragonfly size={200} interactive={false} showGround={false} /> },
  "robot-bat": { line: "One skin, drawn through four finger struts.", art: <RobotBat size={190} interactive={false} showGround={false} /> },
  "robot-jellyfish": { line: "A bell that squeezes fast and relaxes slow.", art: <RobotJellyfish size={155} arms={11} interactive={false} showGround={false} /> },
  "robot-manta": { line: "The wave runs across the span, not the body.", art: <RobotManta size={205} interactive={false} showGround={false} /> },
  "robot-octopus": { line: "Eight spines on a ring, each on its own phase.", art: <RobotOctopus size={160} interactive={false} showGround={false} /> },
  "robot-seahorse": { line: "The grip is the steering, taken to the stop.", art: <RobotSeahorse size={135} interactive={false} showGround={false} /> },
  "robot-ant": { line: "Six legs, and three sections on a bending chain.", art: <RobotAnt size={185} heading={26} cargo="leaf" gait="tripod" interactive={false} /> },
  "robot-scorpion": { line: "A tail that leaves the ground plane.", art: <RobotScorpion size={200} gait="tripod" interactive={false} /> },
  "robot-mantis": { line: "Forelimbs solved to a real target.", art: <RobotMantis size={205} interactive={false} /> },
  "robot-frog": { line: "One pair of numbers is the whole jump.", art: <RobotFrog size={190} interactive={false} /> },
  "spring-hopper": { line: "A real spring, with a solid height it can hit.", art: <SpringHopper size={190} behavior="hop" speed={0.9} /> },
  "ball-hopper": { line: "Flattened on impact, it has to get wider.", art: <BallHopper size={178} behavior="bounce" speed={0.8} /> },
  "hopper-dynamics": { line: "Flight is a parabola; stance is a spring.", art: <SpringHopper size={190} behavior="bound" speed={0.7} variant="blueprint" /> },
  "robot-cat": { line: "Four solved legs hung off a back that arches.", art: <RobotCat size={230} interactive={false} /> },
  "robot-dog": { line: "A floating shoulder, a solved neck, and a wag that runs out of the page.", art: <RobotDog size={235} interactive={false} /> },
  "robot-fox": { line: "The whole body tips, and the brush answers for it.", art: <RobotFox size={235} behavior="listen" interactive={false} /> },
  "robot-bear": { line: "Plantigrade soles, so it has a base to stand up over.", art: <RobotBear size={210} behavior="rear" offset={1.1} interactive={false} /> },
  "robot-polar-bear": { line: "One number hands its weight from the soles to the water.", art: <RobotPolarBear size={215} behavior="swim" interactive={false} /> },
  "robot-panda": { line: "Sits down, which is how both hands come free.", art: <RobotPanda size={215} behavior="feed" offset={0.9} interactive={false} /> },
  "bear-kinematics": { line: "The sole, the base of support, and the margin over it.", art: <RobotBear size={210} behavior="rear" offset={1.1} variant="blueprint" showSupport interactive={false} /> },
  "robot-horse": { line: "Real gaits, and a fetlock that sinks under the weight it carries.", art: <RobotHorse size={230} behavior="trot" interactive={false} showContacts /> },
  "robot-pegasus": { line: "One number hands its weight from its legs to its wings.", art: <RobotPegasus size={235} behavior="launch" interactive={false} /> },
  "robot-camel": { line: "The only floor here with a depth, and feet that go into it.", art: <RobotCamel size={235} behavior="pace" ground={0.9} interactive={false} showContacts /> },
  "robot-turtle": { line: "Four legs, and a shell it can vanish into.", art: <RobotTurtle size={175} gait="wave" interactive={false} /> },
  "robot-inchworm": { line: "No wave at all: two anchors and an arch.", art: <RobotInchworm size={200} interactive={false} /> },
  "micro-duck": { line: "A biped that walks, pecks, and quacks.", art: <MicroDuck size={132} gait="walk" /> },
  "reachy-mini": { line: "A head on six solved rods, eyes that follow.", art: <ReachyMini size={165} track={false} /> },
  "animatronic-face": { line: "Every feature is a servo; an expression is a blend of them.", art: <AnimatronicFace size={170} track={false} behavior="emote" speed={0.5} showGround={false} /> },
  "face-actuation": { line: "Sixteen channels, nine expressions, one hinged jaw.", art: <AnimatronicFace size={170} track={false} variant="blueprint" behavior="emote" speed={0.5} showActuators showGround={false} /> },
  "robot-quadruped": { line: "Four solved legs, standing, walking, and trotting.", art: <RobotQuadruped size={240} gait="trot" /> },
  "robot-rover": { line: "Four or six wheels, heading, and steering.", art: <RobotRover size={170} wheels={6} /> },
  "robot-drone": { line: "Four or six rotors, guards, and blade angles.", art: <RobotDrone size={170} /> },
  "robot-car": { line: "One steering number, two different wheel angles.", art: <RobotCar size={170} behavior="slalom" roughness={0.55} /> },
  "transit-bus": { line: "The bend is solved from the steer, and she kneels to open.", art: <TransitBus size={185} behavior="service" /> },
  "rail-locomotive": { line: "Nothing steers it — the track places the whole train.", art: <RailLocomotive size={210} behavior="yard" cars={1} view="iso" /> },
  "rail-bogie": { line: "Coned treads, so it weaves at Klingel's wavelength.", art: <RailBogie size={140} behavior="hunt" conicity={0.16} /> },
  "pantograph-collector": { line: "Height is bought with reach; a rod keeps the head level.", art: <PantographCollector size={170} behavior="raise" /> },
  "rail-turnout": { line: "A route is detection, not a setting.", art: <RailTurnout size={100} behavior="route" /> },
  "rail-geometry": { line: "Throw on a curve, Klingel hunting, a crossing angle.", art: <RailLocomotive size={200} variant="blueprint" behavior="yard" cars={0} view="plan" showThrow /> },
  "robot-football": { line: "The outline is the ellipsoid's own section, not an oval.", art: <RobotFootball size={186} behavior="spiral" speed={0.7} showGround={false} /> },
  "gridiron-lineman": { line: "A hand on the turf is what makes the back flat.", art: <GridironLineman size={190} behavior="snap" speed={0.5} number="74" /> },
  "gridiron-quarterback": { line: "The elbow is an output; the ball leaves on the hand's velocity.", art: <GridironQuarterback size={178} behavior="throw" speed={0.45} number="09" /> },
  "gridiron-receiver": { line: "The lean is the exterior angle at the break.", art: <GridironReceiver size={210} behavior="route" route="post" speed={0.35} number="88" /> },
  "gridiron-kicker": { line: "Clears or short is read off the plot, not declared.", art: <GridironKicker size={212} behavior="kick" speed={0.45} distance={38} /> },
  "blocking-sled": { line: "Static equilibrium, and a frame with a friction threshold.", art: <BlockingSled size={198} behavior="drive" pads={3} speed={0.6} /> },
  "ball-launcher": { line: "Mean of the surface speeds out, difference as spin.", art: <BallLauncher size={190} behavior="feed" speed={0.7} /> },
  "gridiron-geometry": { line: "A prolate spheroid, a parabola, a route tree, a sprung arm.", art: <RobotFootball size={186} variant="blueprint" behavior="tumble" speed={0.5} showGround={false} /> },
  "cargo-plane": { line: "It banks because it was asked to turn.", art: <CargoPlane size={170} behavior="circuit" /> },
  "hydrofoil-craft": { line: "Lift goes as v\u00b2, so the hull climbs out of the water.", art: <HydrofoilCraft size={180} behavior="takeoff" /> },
  "launch-vehicle": { line: "Flies a pitch program, stages, and drops its own \u0394v.", art: <LaunchVehicle size={140} behavior="ascent" showReadout={false} /> },
  "strike-starfighter": { line: "Four wings, two hinges, one X.", art: <StrikeStarfighter size={175} behavior="attack" /> },
  "ion-interceptor": { line: "Hexagons head-on, two lines from above.", art: <IonInterceptor size={165} behavior="intercept" /> },
  "lidar-scan": { line: "Your range data, plotted in polar coordinates.", art: <LidarScan size={160} samples={lidarSamples} /> },
  "robot-face": { line: "Eyes that follow the pointer. Six moods.", art: <RobotFace size={150} mood="curious" /> },
  "robot-loader": { line: "Pick and place as a progress indicator.", art: <RobotLoader size={250} /> },
  "arm-controls": { line: "A teach pendant: one slider per joint, posing the arm forward.", art: <RobotArm size={190} variant="blueprint" showAngles tool="gripper" /> },

  // Machines
  fabricator: { line: "Builds a sampled solid, one vectorized voxel at a time.", art: <Fabricator size={175} resolution={7} shape="lattice" showReadout={false} /> },
  "voxel-form": { line: "The workpiece alone: a field sampled into vector cells.", art: <VoxelForm size={150} resolution={7} shape="gear" showPlate={false} /> },
  "arm-fabricator": { line: "Solved shoulder and elbow, reaching for the cell being laid.", art: <ArmFabricator size={195} resolution={6} shape="pyramid" showReadout={false} /> },
  "drone-fabricator": { line: "A repulsor platform building with no envelope at all.", art: <DroneFabricator size={180} resolution={6} shape="vessel" showReadout={false} /> },
  "linear-actuator": { line: "Controlled stroke and a piston cutaway.", art: <LinearActuator size={240} cutaway /> },
  "servo-motor": { line: "Positional shaft with three horn styles.", art: <ServoMotor size={150} /> },
  "radial-bloom": { line: "Twelve telescopes on one hub, each on its own number.", art: <RadialBloom size={190} speed={0.5} /> },
  "power-lantern": { line: "A ring in the port, taking charge the reservoir is losing.", art: <PowerLantern size={150} behavior="oath" speed={0.28} phase={0.5} plate="LTN-04" /> },
  "assembly-geometry": { line: "Apart in the reverse of the order it was built.", art: <Pumpjack size={210} behavior="service" speed={0.24} phase={0.45} view="iso" variant="blueprint" /> },
  "lantern-geometry": { line: "Apart in the reverse of the order it went together.", art: <PowerLantern size={150} behavior="service" speed={0.22} phase={0.5} variant="blueprint" view="iso" /> },
  "solenoid-valve": { line: "A winding, return spring, plunger, and switched flow path.", art: <SolenoidValve size={210} ports={3} /> },
  "electromagnetic-relay": { line: "A visible armature switching two contact sets.", art: <ElectromagneticRelay size={205} poles={2} /> },
  "induction-motor": { line: "Three phases circling a squirrel-cage rotor.", art: <InductionMotor size={152} poles={4} showField /> },
  "stepper-motor": { line: "Four phase teeth and a rotor that stops on indices.", art: <StepperMotor size={152} steps={8} /> },
  "voice-coil-actuator": { line: "A moving coil crossing a fixed annular magnet gap.", art: <VoiceCoilActuator size={205} /> },
  "magnetic-bearing": { line: "Four correction coils around a suspended rotor.", art: <MagneticBearing size={152} axis="x" /> },
  "eddy-current-brake": { line: "A magnet array braking a disc without touching it.", art: <EddyCurrentBrake size={152} discAngle={25} /> },
  "maglev-carriage": { line: "A payload moving above a segmented linear stator.", art: <MaglevCarriage size={220} payload="bin" /> },
  "magnetic-gripper": { line: "Energized pole shoes lifting a steel workpiece.", art: <MagneticGripper size={152} workpiece="plate" /> },
  "inductive-sensor": { line: "A metal target crossing an oscillator coil's lobe.", art: <InductiveSensor size={205} target="tooth" /> },
  "resolver": { line: "A rotary transformer with sine and cosine channels.", art: <Resolver size={152} showChannels /> },
  "transformer-core": { line: "Coupled windings and reversible flux on one core.", art: <TransformerCore size={170} turns="step-down" /> },
  "rotary-table": { line: "Indexing platter, fixtures, and workpieces.", art: <RotaryTable size={170} /> },
  "turntable-deck": { line: "An arm geared to the platter by the groove it tracks.", art: <TurntableDeck size={168} phase={0.6} /> },
  "gramophone-horn": { line: "A mainspring, its governor, and an exponential horn.", art: <GramophoneHorn size={150} progress={0.35} phase={0.25} /> },
  "music-box-drum": { line: "A pinned barrel bending a comb tuned by length.", art: <MusicBoxDrum size={196} phase={1.2} /> },
  "robot-grand-piano": { line: "A roll, 88 actions, and a hammer that is let go before the blow.", art: <RobotGrandPiano size={200} view="iso" phase={1.4} /> },
  "robot-gripper": { line: "Parallel or angular fingers, controlled opening.", art: <RobotGripper size={170} active /> },
  "conveyor-belt": { line: "Wrapping travel, rollers, and workpieces.", art: <ConveyorBelt size={250} /> },
  "scara-arm": { line: "Plan view, Z spindle, swept area.", art: <ScaraArm size={190} behavior="orbit" z={0.5} phase={1.1} /> },
  "delta-arm": { line: "Three biceps, real parallel kinematics.", art: <DeltaArm size={190} behavior="orbit" phase={0.6} /> },
  "gantry-arm": { line: "Independent axes, plotter trail.", art: <GantryArm size={190} behavior="sweep" trail phase={0.4} /> },

  "planetary-gearbox": { line: "Sun, planets and a held ring, with teeth that mesh.", art: <PlanetaryGearbox size={158} sunTeeth={18} planetTeeth={12} showRatio={false} /> },
  "belt-drive": { line: "Unequal pulleys, a taut belt, an idler to wind down.", art: <BeltDrive size={215} tension={0.62} /> },
  "cable-carrier": { line: "A fold that travels at half the carriage.", art: <CableCarrier size={250} links={24} /> },
  "mecanum-wheel": { line: "Barrel rollers at 45°, in a left hand and a right.", art: <MecanumWheel size={158} hand="left" view="iso" /> },
  "tool-changer": { line: "The one machine here that comes apart.", art: <ToolChanger size={132} tool="spindle" /> },
  "suction-gripper": { line: "Bellows cups, and the sheet riding their lips.", art: <SuctionGripper size={200} /> },
  "robot-hand": { line: "A thumb that really opposes, and the gap it closes.", art: <RobotHand size={168} grasp="pinch" view="iso" /> },
  "robot-foot": { line: "Heel, ball and toe, and the load moving between them.", art: <RobotFoot size={208} /> },
  "robot-leg": { line: "The foot is the input; the hip and knee answer.", art: <RobotLeg size={170} /> },
  "robot-torso": { line: "A column that leans and twists without stretching.", art: <RobotTorso size={176} view="iso" /> },
  "motion-platform": { line: "Six solved legs under a deck that really tips.", art: <MotionPlatform size={198} payload="camera" /> },

  // Arms
  "robot-arm": { line: "Any number of links, eight tools, four mounts.", art: <RobotArm size={190} behavior="idle" tool="gripper" phase={0.2} /> },
  "robot-arm-3d": { line: "The same chain as a real rig, built from primitives.", art: <CatalogueStage floor="shadow" /> },
  "robot-stage": { line: "Lights, contact shadow, grid floor, orbit controls.", art: <CatalogueStage floor="grid" /> },

  // Personal devices — the machines you carry, each posed on its own mechanism.
  "clamshell-laptop": { line: "One solved hinge, and a lid that keeps its length.", art: <ClamshellLaptop size={205} view="iso" screen="code" /> },
  "slate-tablet": { line: "A kickstand whose foot has to reach the desk.", art: <SlateTablet size={205} view="front" screen="sketch" /> },
  "busker-droid": { line: "A droid whose pose comes from a step pattern.", art: <BuskerDroid size={168} phase={0.4} /> },
  "wheel-player": { line: "A click wheel geared to the list it scrolls.", art: <WheelPlayer size={130} rows={8} /> },
  "slab-handset": { line: "One slab, turned: screen, edge, then the array.", art: <SlabHandset size={150} screen="map" /> },
  "folding-handset": { line: "A crease with a radius, and a sheet that keeps its length.", art: <FoldingHandset size={190} behavior="flex" view="front" screen="canvas" /> },
  "wrist-terminal": { line: "A crown geared to the dial, on a band that holds its length.", art: <WristTerminal size={132} closure={0.8} /> },
  "key-switch": { line: "A contact that closes partway down, not at the bottom.", art: <KeySwitch size={150} action="tactile" /> },
  "robot-keypad": { line: "A scanned matrix: the key down and the cell read are not the same.", art: <RobotKeypad size={150} view="iso" showScan /> },
  "robot-keyboard": { line: "Rows in units on one pitch, and caps sculpted per row.", art: <RobotKeyboard size={170} layout="split" /> },
  "input-terminal": { line: "The keys it strikes are what fills its own screen.", art: <InputTerminal size={160} screen="query" /> },

  "robot-skeleton": { line: "A biped whose walk is one duty factor away from a run.", art: <RobotSkeleton size={164} gait="walk" view="profile" /> },

  // Bodies — the things machinery is pointed at, drawn the way machines are.
  "celestial-planet": { line: "A ring the body really stands in front of, and behind.", art: <CelestialPlanet size={168} surface="banded" moons={2} /> },
  "celestial-moon": { line: "The crescent is the terminator, projected.", art: <CelestialMoon size={168} craters={54} /> },
  "celestial-star": { line: "Limb darkening as a law, not a gradient.", art: <CelestialStar size={168} kind="giant" prominences={4} /> },
  "celestial-asteroid": { line: "The one body whose outline changes as it turns.", art: <CelestialAsteroid size={168} body="contact" seed={4} moonlet /> },
  orrery: { line: "Arms whose length is the orbital radius.", art: <Orrery size={176} bodies={5} eccentricity={0.6} /> },
  "battle-station": { line: "A hull that comes apart into the plates it was made of.", art: <BattleStation size={168} behavior="detonate" phase={0.18} courses={9} perCourse={12} spread={0.5} /> },
  "debris-field": { line: "A population, depth-sorted: near covers far.", art: <DebrisField size={168} behavior="drift" showTrails /> },
  "robot-sunflower": { line: "A golden-angle head, aimed at the light by a solved tracker.", art: <RobotSunflower size={176} track={false} florets={140} arms={8} /> },
  "robot-cactus": { line: "A ribbed column and two arms, one continuum limb apiece.", art: <RobotCactus size={172} track={false} behavior="flower" phase={0.25} ribs={11} areoles={3} spines={5} /> },

  // Foundations — the machine that exercises the file, drawn as a drawing.
  "robot-kinematics": { line: "Two-link cosines and FABRIK, with the envelope drawn.", art: <RobotArm size={190} variant="blueprint" behavior="idle" phase={0.9} showEnvelope tool="welder" /> },
  "robot-style": { line: "Palette, size, variant and view, resolved once for every machine.", art: <RobotArm size={190} variant="wire" behavior="orbit" phase={0.4} tool="welder" /> },
  "robot-color": { line: "Resolves a CSS variable to a colour three.js can read.", art: <OrbDroid size={155} track={false} palette={{ shell: "#7c8cff", accent: "#ffd166", metal: "#c8ccd8", dark: "#242a3d" }} /> },
  "duck-kinematics": { line: "Two planar legs and a footfall cycle that keeps one down.", art: <MicroDuck size={132} variant="blueprint" gait="walk" /> },
  // Heaved and tilted on purpose: at rest the head sits down over the rods,
  // which are the whole point of the card.
  "stewart-kinematics": { line: "A head pose in, six leg lengths out.", art: <ReachyMini size={165} variant="blueprint" track={false} blink={false} /> },
  "hand-kinematics": { line: "Five digits, and a thumb on a real saddle joint.", art: <RobotHand size={168} variant="blueprint" grasp="tripod" view="iso" /> },
  "skeleton-kinematics": { line: "A stride, a rolling foot, and a spine that keeps its length.", art: <RobotSkeleton size={164} variant="blueprint" gait="run" stride={1} lift={1} view="profile" /> },
  "quadruped-kinematics": { line: "Four legs, three footfall patterns, every foot reachable.", art: <RobotQuadruped size={240} variant="blueprint" gait="walk" /> },
  "gait-kinematics": { line: "Six footfall sequences, and the beat counted off them.", art: <RobotHorse size={225} variant="blueprint" behavior="canter" interactive={false} showContacts /> },
  "spine-kinematics": { line: "A serpenoid travelling wave with taper and steady turn.", art: <RobotSnake size={195} variant="blueprint" waves={1.4} interactive={false} showGround={false} /> },
  "hexapod-kinematics": { line: "Radial legs, knees solved in each leg's own plane.", art: <RobotSpider size={168} variant="blueprint" gait="ripple" interactive={false} /> },
  "walker-kinematics": { line: "The mass is above the hips, so moving it costs roll.", art: <SiegeWalker size={240} variant="blueprint" behavior="pace" phase={0.3} view="front" showSupport interactive={false} track={false} /> },
  "tripod-kinematics": { line: "The load says where the body has to stand to hold it.", art: <TripodDroid size={195} variant="blueprint" showSupport interactive={false} track={false} /> },
  "device-geometry": { line: "Hinges, kickstands, detents and bands, solved.", art: <SlateTablet size={195} variant="blueprint" view="profile" screen="home" /> },
  "keyboard-geometry": { line: "Travel, hysteresis, a unit-pitch deck and a raked face.", art: <RobotKeyboard size={170} variant="blueprint" showScan /> },
  "sound-geometry": { line: "A spiral groove, and the arm angle it fixes.", art: <TurntableDeck size={190} variant="blueprint" behavior="scratch" phase={0.3} /> },
  "piano-geometry": { line: "An escapement, and the scale the case is drawn around.", art: <RobotGrandPiano size={190} variant="blueprint" view="iso" phase={0.62} /> },
  "produce-geometry": { line: "Profiles revolved, a lattice by area, halves that reassemble.", art: <RobotStrawberry size={150} variant="blueprint" seeds={34} interactive={false} /> },
  "cactus-geometry": { line: "A limb solved from its curvature, as long bent as straight.", art: <RobotCactus size={168} variant="blueprint" track={false} behavior="reach" phase={0.4} ribs={11} areoles={3} spines={5} showPot={false} /> },
  "transmission-geometry": { line: "Meshing teeth, taut belts, and a chain over its bend.", art: <PlanetaryGearbox size={158} variant="blueprint" sunTeeth={20} planetTeeth={14} planets={4} showRatio={false} /> },
  "electromagnetism-geometry": { line: "Windings, three-phase vectors, and resolver quadrature.", art: <InductionMotor size={152} variant="blueprint" poles={4} /> },
  "voxel-geometry": { line: "Occupancy fields turned into cells in deposition order.", art: <VoxelForm size={150} variant="blueprint" resolution={6} shape="lattice" showPlate={false} /> },
  "use-robot-arm": { line: "The solver as a hook: pose an arm without rendering one.", art: <RobotArm size={190} variant="outline" behavior="sweep" phase={0.7} showEnvelope tool="gripper" /> },
  "use-robot-motion": { line: "The clock, the drag and the scalar every machine runs on.", art: <RobotLoader size={250} variant="outline" /> },
  "use-pointer-target": { line: "Pointer position, in the machine's own world units.", art: <RobotFace size={150} variant="outline" mood="curious" /> },
  "phyllotaxis-geometry": { line: "A golden angle, and the Fibonacci arms that fall out of it.", art: <RobotSunflower size={176} variant="blueprint" track={false} florets={150} arms={13} /> },
  "celestial-geometry": { line: "Kepler's equation, ellipses about a focus, and the light.", art: <Orrery size={176} variant="blueprint" bodies={4} inclination={18} /> },
  "hull-geometry": { line: "A tiling that sums to one sphere, and the front that opens it.", art: <BattleStation size={176} variant="blueprint" behavior="detonate" phase={0.3} /> },
  // The household: the building you live in, and the machines inside it.
  "gabled-house": { line: "The ridge is the pitch, and the garage door really runs its track.", art: <GabledHouse size={196} behavior="arrive" storeys={2} pitch={42} phase={0.12} /> },
  "tower-block": { line: "One rope, one sheave: the weight falls as far as the car rises.", art: <TowerBlock size={172} storeys={14} occupancy={0.62} /> },
  "espresso-machine": { line: "A lever, a rod, a piston — and a spring that is the pressure.", art: <EspressoMachine size={196} cups={2} /> },
  "refrigerator": { line: "Solved leaves, and an inside the swing reveals.", art: <Refrigerator size={158} layout="side-by-side" /> },
  "washing-machine": { line: "Thrown below a Froude number of one, pinned above it.", art: <WashingMachine size={172} load={6} /> },
  "household-geometry": { line: "Swings, sectional panels, a tumbling drum and a resonant tub.", art: <WashingMachine size={172} variant="blueprint" behavior="spin" load={6} /> },

  "cable-station": { line: "The pin picks the weight; the reeving decides what you hold.", art: <CableStation size={150} pin={6} phase={0.35} /> },
  "gym-geometry": { line: "Five reasons the felt load is not the selected load.", art: <ResistanceCam size={150} variant="blueprint" phase={0.15} /> },
  "resistance-cam": { line: "The moment arm is the cam radius, so the cam is the resistance curve.", art: <ResistanceCam size={150} phase={0.3} /> },
}

/** Exported for the coverage test — a card that exists nowhere else is a bug. */
export const catalogueSlugs = Object.keys(art)

/** What a fallback card is drawn at: the height of the card's art well. */
const FALLBACK_SIZE = 168

/** The first clause of a registry description, which is what a card has room for. */
const firstClause = (summary: string) => {
  const [sentence] = summary.split(/(?<=\.)\s/)
  return sentence ?? summary
}

/**
 * A card for an item nobody hand-posed: its own component. Machines receive
 * the art-well size; Interfaces render their useful default without machine
 * props, inside an inert wrapper because the whole card is already a link.
 */
export function fallbackArt(card: CatalogueCard): Art | null {
  const entry = galleryEntries[card.slug]
  if (!entry) return null
  const line = card.summary ? firstClause(card.summary) : card.title
  if (!entry.component) return { line, art: <CatalogueStage floor="shadow" /> }
  const Machine = entry.component
  if (card.group === "Interfaces") {
    return {
      line,
      art: (
        <div inert aria-hidden="true" className="pointer-events-none w-full max-w-64 p-4">
          <Machine />
        </div>
      ),
    }
  }
  return {
    line,
    art: <Machine size={FALLBACK_SIZE} {...(entry.blueprint ? { variant: "blueprint" as const } : {})} />,
  }
}

/** The hand-posed card if there is one, and the machine's own pose if not. */
export function cardArt(card: CatalogueCard): Art | null {
  return art[card.slug] ?? fallbackArt(card)
}

/**
 * The posed machine cards, for the animation test. Interfaces use the quiet
 * generated preview above and are intentionally absent from this map.
 */
export const catalogueArt = art

/**
 * Cards mounted before anything is observed, counted down the whole grid rather
 * than per group — the first group is Arms and it is three cards long. Two rows
 * at the widest breakpoint, so the top of the grid is in the server HTML and is
 * painted before hydration rather than after.
 */
const EAGER_CARDS = 6

/**
 * The art well: fixed height whether or not a machine is in it, so a card that
 * has not been scrolled to yet takes up exactly the room it will take up later.
 */
function CardWell({ eager, children }: { eager: boolean; children: React.ReactNode }) {
  const [well, near] = useNearViewport<HTMLDivElement>()

  return (
    <div ref={well} className="flex h-44 items-center justify-center overflow-hidden">
      {eager || near ? children : null}
    </div>
  )
}

function Catalogue({ entries }: { entries: CatalogueCard[] }) {
  const groups = [...new Set(entries.map((entry) => entry.group))]
  const eager = new Set(entries.slice(0, EAGER_CARDS).map((entry) => entry.slug))

  return (
    <div className="space-y-10">
      {groups.map((group) => {
        const cards = entries.filter((entry) => entry.group === group)
        if (!cards.length) return null
        return (
          <section key={group} data-slot="catalogue-group" className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[13px] font-medium text-muted-foreground">{group}</h3>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground opacity-65">
                {cards.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((entry) => {
                const card = cardArt(entry)
                if (!card) return null
                return (
                  <Link
                    key={entry.slug}
                    href={`/docs/${entry.slug}`}
                    className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    <Panel className="flex h-full flex-col transition-colors group-hover:border-foreground">
                      <CardWell eager={eager.has(entry.slug)}>
                        {card.art}
                      </CardWell>
                      <div className="border-t border-border px-4 py-3">
                        <h4 className="text-[14px] font-medium">{entry.title}</h4>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{card.line}</p>
                      </div>
                    </Panel>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export { Catalogue }
