"use client"

/** Live demos for the docs pages. One per registry item, keyed by doc slug. */

import * as React from "react"

import { AstromechDroid, type AstromechAntenna, type AstromechBehavior, type AstromechDome, type AstromechFeet, type AstromechLivery, type AstromechTool } from "@/components/ui/astromech-droid"
import { AttendantDroid, type AttendantDroidBehavior, type AttendantDroidBuild, type AttendantDroidFace, type AttendantDroidHands, type AttendantDroidPlating, type AttendantDroidPose } from "@/components/ui/attendant-droid"
import { CasingDroid, type CasingDroidBehavior, type CasingDroidCollar, type CasingDroidDome, type CasingDroidEmitter, type CasingDroidLamps, type CasingDroidManipulator, type CasingDroidSkirt } from "@/components/ui/casing-droid"
import { CyberTrooper, type CyberTrooperBehavior, type CyberTrooperBuild, type CyberTrooperChest, type CyberTrooperHelmet, type CyberTrooperPose, type CyberTrooperVisor } from "@/components/ui/cyber-trooper"
import { CourierDroid, type CourierDroidCargo , type CourierDroidBehavior} from "@/components/ui/courier-droid"
import { InfantryDroid, type InfantryDroidEquipment, type InfantryDroidFrame, type InfantryDroidPose , type InfantryDroidBehavior} from "@/components/ui/infantry-droid"
import { MedicalDroid, type MedicalDroidTool , type MedicalDroidBehavior} from "@/components/ui/medical-droid"
import { MicroDuck, type DuckBehavior } from "@/components/ui/micro-duck"
import { OrbDroid } from "@/components/ui/orb-droid"
import { ProbeDroid , type ProbeDroidBehavior} from "@/components/ui/probe-droid"
import { ProtocolDroid, type ProtocolDroidGesture, type ProtocolDroidPose , type ProtocolDroidBehavior} from "@/components/ui/protocol-droid"
import type { DuckGait } from "@/lib/robocn/duck"
import { ReachyMini, type ReachyBehavior } from "@/components/ui/reachy-mini"
import { SecurityDroid, type SecurityDroidPose } from "@/components/ui/security-droid"
import { UtilityDroid, type UtilityDroidSeries, type UtilityDroidTool , type UtilityDroidBehavior} from "@/components/ui/utility-droid"
import { defaultStewartGeometry, solveStewart } from "@/lib/robocn/stewart"
import { RobotQuadruped, type QuadrupedBehavior } from "@/components/ui/robot-quadruped"
import { RobotBird, type BirdBehavior } from "@/components/ui/robot-bird"
import { RobotCrab, type CrabBehavior } from "@/components/ui/robot-crab"
import { RobotFish, type FishBehavior } from "@/components/ui/robot-fish"
import { RobotSnake, type SnakeBehavior } from "@/components/ui/robot-snake"
import { RobotSpider, type SpiderBehavior } from "@/components/ui/robot-spider"
import type { HexapodGait } from "@/lib/robocn/hexapod"
import type { QuadrupedGait } from "@/lib/robocn/quadruped"
import { LinearActuator, type ActuatorBehavior } from "@/components/ui/linear-actuator"
import { ServoMotor, type ServoBehavior, type ServoHorn } from "@/components/ui/servo-motor"
import { RotaryTable, type RotaryBehavior } from "@/components/ui/rotary-table"
import { RobotRover, type RoverBehavior } from "@/components/ui/robot-rover"
import { RobotDrone, type DroneBehavior } from "@/components/ui/robot-drone"
import { LidarScan, type LidarBehavior, type LidarSample } from "@/components/ui/lidar-scan"

import { ArmFabricator } from "@/components/ui/arm-fabricator"
import { DroneFabricator } from "@/components/ui/drone-fabricator"
import { Fabricator } from "@/components/ui/fabricator"
import { VoxelForm } from "@/components/ui/voxel-form"
import type { VoxelBehavior, VoxelShape } from "@/lib/robocn/voxel"

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
import { Segmented } from "@/components/site/segmented"
import { Slider } from "@/components/ui/slider"
import { oklchToHex } from "@/lib/robocn/color"
import {
  chainAngles2,
  chainReach,
  solveChain2,
  type Vec2,
} from "@/lib/robocn/kinematics"
import type {
  RobotBehavior,
  RobotMount,
  RobotTool,
  RobotVariant,
  RobotView,
} from "@/lib/robocn/style"

const variants: RobotVariant[] = ["solid", "outline", "blueprint", "wire"]
const views: RobotView[] = ["plan", "front", "profile", "iso"]
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
  const [bodyAngle, setBodyAngle] = React.useState(35)
  const [headAngle, setHeadAngle] = React.useState(-12)
  const [antenna, setAntenna] = React.useState<"single" | "twin" | "none">("twin")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="antenna" value={antenna} options={["single", "twin", "none"] as const} onChange={setAntenna} />
      <NumberControl label="body" value={bodyAngle} min={-180} max={180} onChange={setBodyAngle} format={value => `${value}°`} />
      <NumberControl label="head" value={headAngle} min={-65} max={65} onChange={setHeadAngle} format={value => `${value}°`} />
      <p className="text-[11px] text-muted-foreground">The drive sphere turns independently while the cap stays upright. Move the pointer to aim the optic.</p>
    </>}>
      <OrbDroid view={view} size={330} bodyAngle={bodyAngle} headAngle={headAngle} antenna={antenna} variant={variant} label="ORB / 15" />
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
  const [pose, setPose] = React.useState<SecurityDroidPose>("guard")
  const [headAngle, setHeadAngle] = React.useState(-8)
  const [alert, setAlert] = React.useState<"clear" | "alert">("clear")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="pose" value={pose} options={["stand", "patrol", "guard"] as const} onChange={setPose} />
      <Segmented label="state" value={alert} options={["clear", "alert"] as const} onChange={setAlert} />
      <NumberControl label="head" value={headAngle} min={-70} max={70} onChange={setHeadAngle} format={value => `${value}°`} />
      <p className="text-[11px] text-muted-foreground">The sensor bar tracks the pointer unless a controlled look is supplied.</p>
    </>}>
      <SecurityDroid view={view} size={300} pose={pose} headAngle={headAngle} alert={alert === "alert"} variant={variant} label="SECURITY / 17" />
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

export const demos: Record<string, React.ComponentType> = {
  fabricator: FabricatorDemo,
  "voxel-form": VoxelFormDemo,
  "arm-fabricator": ArmFabricatorDemo,
  "drone-fabricator": DroneFabricatorDemo,
  "voxel-geometry": VoxelFormDemo,
  "utility-droid": UtilityDroidDemo,
  "orb-droid": OrbDroidDemo,
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
  "robot-fish": RobotFishDemo,
  "robot-snake": RobotSnakeDemo,
  "spine-kinematics": RobotSnakeDemo,
  "robot-spider": RobotSpiderDemo,
  "robot-crab": RobotCrabDemo,
  "hexapod-kinematics": RobotSpiderDemo,
  "robot-bird": RobotBirdDemo,
  "micro-duck": MicroDuckDemo,
  "duck-kinematics": MicroDuckDemo,
  "reachy-mini": ReachyMiniDemo,
  "stewart-kinematics": ReachyMiniDemo,
  "robot-quadruped": RobotQuadrupedDemo,
  "quadruped-kinematics": RobotQuadrupedDemo,
  "linear-actuator": LinearActuatorDemo,
  "servo-motor": ServoMotorDemo,
  "rotary-table": RotaryTableDemo,
  "robot-rover": RobotRoverDemo,
  "robot-drone": RobotDroneDemo,
  "lidar-scan": LidarScanDemo,
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
  "robot-style": StyleDemo,
  "robot-color": ColorDemo,
  "use-robot-arm": UseRobotArmDemo,
  "use-pointer-target": UsePointerTargetDemo,
}
