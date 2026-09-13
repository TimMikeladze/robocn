"use client"

/** Live demos for the docs pages. One per registry item, keyed by doc slug. */

import * as React from "react"

import { MicroDuck } from "@/components/ui/micro-duck"
import type { DuckGait } from "@/lib/robocn/duck"
import { ReachyMini } from "@/components/ui/reachy-mini"
import { defaultStewartGeometry, solveStewart } from "@/lib/robocn/stewart"
import { RobotQuadruped } from "@/components/ui/robot-quadruped"
import type { QuadrupedGait } from "@/lib/robocn/quadruped"
import { LinearActuator } from "@/components/ui/linear-actuator"
import { ServoMotor, type ServoHorn } from "@/components/ui/servo-motor"
import { RotaryTable } from "@/components/ui/rotary-table"
import { RobotRover } from "@/components/ui/robot-rover"
import { RobotDrone } from "@/components/ui/robot-drone"
import { LidarScan } from "@/components/ui/lidar-scan"

import { RobotGripper } from "@/components/ui/robot-gripper"
import { ConveyorBelt } from "@/components/ui/conveyor-belt"

import { ArmControls } from "@/components/ui/arm-controls"
import { DeltaArm } from "@/components/ui/delta-arm"
import { GantryArm } from "@/components/ui/gantry-arm"
import { RobotArm } from "@/components/ui/robot-arm"
import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotFace, type RobotMood } from "@/components/ui/robot-face"
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
} from "@/lib/robocn/style"

const variants: RobotVariant[] = ["solid", "outline", "blueprint", "wire"]
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
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented label="tool" value={tool} options={tools} onChange={setTool} />
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <Segmented label="mount" value={mount} options={mounts} onChange={setMount} />
          <Segmented label="colour" value={swatch} options={swatches} onChange={setSwatch} />
          <NumberControl label="links" value={links} min={1} max={5} onChange={setLinks} />
        </>
      }
    >
      <RobotArm
        key={mount}
        links={shape}
        variant={variant}
        tool={tool}
        behavior={behavior}
        mount={mount}
        size={380}
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
        </>
      }
    >
      <RobotStage className="h-80 w-full" floor={floor} autoRotate={rotate === "on"}>
        <RobotArm3D behavior="idle" tool="gripper" />
      </RobotStage>
    </Bench>
  )
}

function ScaraArmDemo() {
  const [z, setZ] = React.useState(0.35)
  const [tool, setTool] = React.useState<RobotTool>("vacuum")
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")

  return (
    <Bench
      controls={
        <>
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
  const [spin, setSpin] = React.useState(32)
  const [tilt, setTilt] = React.useState(0.45)
  const [behavior, setBehavior] = React.useState<RobotBehavior>("orbit")
  const [upper, setUpper] = React.useState(17)

  return (
    <Bench
      controls={
        <>
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
  const [behavior, setBehavior] = React.useState<RobotBehavior>("sweep")
  const [trail, setTrail] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")

  return (
    <Bench
      controls={
        <>
          <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
          <Segmented label="motion" value={behavior} options={behaviors} onChange={setBehavior} />
          <Segmented label="trail" value={trail} options={["on", "off"] as const} onChange={setTrail} />
        </>
      }
    >
      <GantryArm
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
          <p className="text-[11px] text-muted-foreground">
            The eyes follow your pointer anywhere on the page.
          </p>
        </>
      }
    >
      <RobotFace mood={mood} track={track === "on"} size={240} label="RC-01" />
    </Bench>
  )
}

function RobotLoaderDemo() {
  const [mode, setMode] = React.useState<"indeterminate" | "value">("indeterminate")
  const [value, setValue] = React.useState(45)

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
        </>
      }
    >
      <RobotLoader
        size={360}
        value={mode === "value" ? value : undefined}
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
        limits={[
          [0, 180],
          [-150, 20],
          [-120, 120],
        ]}
        readouts={[{ label: "joints", value: String(tip.length - 1) }]}
        description="Forward kinematics: each slider is a joint."
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
  const [opening, setOpening] = React.useState(0.5)
  const [fingers, setFingers] = React.useState<"parallel" | "angular">("parallel")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [active, setActive] = React.useState<"off" | "on">("on")
  return <Bench controls={<>
    <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
    <Segmented label="fingers" value={fingers} options={["parallel", "angular"] as const} onChange={setFingers} />
    <Segmented label="active" value={active} options={["off", "on"] as const} onChange={setActive} />
    <NumberControl label="opening" value={opening} min={0} max={1} step={0.01} onChange={setOpening} format={value => `${Math.round(value * 100)}%`} />
  </>}><RobotGripper size={320} opening={opening} fingers={fingers} variant={variant} active={active === "on"} /></Bench>
}

function ConveyorBeltDemo() {
  const [position, setPosition] = React.useState(0.25)
  const [parts, setParts] = React.useState(3)
  const [direction, setDirection] = React.useState<"left" | "right">("right")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return <Bench controls={<>
    <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
    <Segmented label="direction" value={direction} options={["left", "right"] as const} onChange={setDirection} />
    <NumberControl label="travel" value={position} min={-1} max={1} step={0.01} onChange={setPosition} format={value => `${value.toFixed(2)} rev`} />
    <NumberControl label="parts" value={parts} min={0} max={12} onChange={setParts} />
  </>}><ConveyorBelt size={420} position={position} parts={parts} direction={direction} variant={variant} label="FEED / 05" /></Bench>
}

function RobotRoverDemo() {
  const [heading, setHeading] = React.useState(25)
  const [steering, setSteering] = React.useState(15)
  const [travel, setTravel] = React.useState(0)
  const [wheels, setWheels] = React.useState<"4" | "6">("6")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="wheels" value={wheels} options={["4", "6"] as const} onChange={setWheels} />
      <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
      <NumberControl label="steer" value={steering} min={-45} max={45} onChange={setSteering} format={value => `${value}°`} />
      <NumberControl label="travel" value={travel} min={0} max={1} step={0.01} onChange={setTravel} format={value => value.toFixed(2)} />
    </>}>
      <RobotRover size={340} wheels={wheels === "4" ? 4 : 6} heading={heading} steering={steering} wheelTravel={travel} variant={variant} active label="ROVER / 06" />
    </Bench>
  )
}

function RobotDroneDemo() {
  const [heading, setHeading] = React.useState(0)
  const [angle, setAngle] = React.useState(25)
  const [rotors, setRotors] = React.useState<"4" | "6">("4")
  const [guards, setGuards] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="rotors" value={rotors} options={["4", "6"] as const} onChange={setRotors} />
      <Segmented label="guards" value={guards} options={["on", "off"] as const} onChange={setGuards} />
      <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
      <NumberControl label="blades" value={angle} min={0} max={360} onChange={setAngle} format={value => `${value}°`} />
    </>}>
      <RobotDrone size={340} rotors={rotors === "4" ? 4 : 6} heading={heading} rotorAngle={angle} guards={guards === "on"} variant={variant} active label="FLIGHT / 07" />
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
  const [heading, setHeading] = React.useState(0)
  const [scanAngle, setScanAngle] = React.useState(60)
  const [range, setRange] = React.useState(10)
  const [rays, setRays] = React.useState<"on" | "off">("off")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="rays" value={rays} options={["off", "on"] as const} onChange={setRays} />
      <NumberControl label="heading" value={heading} min={0} max={360} onChange={setHeading} format={value => `${value}°`} />
      <NumberControl label="scan" value={scanAngle} min={0} max={360} onChange={setScanAngle} format={value => `${value}°`} />
      <NumberControl label="range" value={range} min={3} max={15} step={0.5} onChange={setRange} format={value => `${value} m`} />
      <p className="text-[11px] text-muted-foreground">Sample data: a 14 × 10 m room and one nearby obstacle. Reduce range to filter distant returns.</p>
    </>}>
      <LidarScan size={340} samples={roomSamples} heading={heading} scanAngle={scanAngle} maxRange={range} showRays={rays === "on"} variant={variant} label={`RANGE ${range} m`} />
    </Bench>
  )
}

function RotaryTableDemo() {
  const [angle, setAngle] = React.useState(30)
  const [stations, setStations] = React.useState(6)
  const [loaded, setLoaded] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="loaded" value={loaded} options={["on", "off"] as const} onChange={setLoaded} />
      <NumberControl label="angle" value={angle} min={0} max={360} onChange={setAngle} format={value => `${value}°`} />
      <NumberControl label="stations" value={stations} min={0} max={12} onChange={setStations} />
      <button type="button" disabled={stations === 0}
        onClick={() => setAngle(current => ((Math.floor(current / (360 / stations) + 1e-9) + 1) * 360 / stations) % 360)}
        className="border border-border px-3 py-2 text-[12px] hover:border-foreground disabled:opacity-40">
        Next station
      </button>
    </>}>
      <RotaryTable size={340} angle={angle} stations={stations} loaded={loaded === "on"} variant={variant} label="INDEX / 08" />
    </Bench>
  )
}

function LinearActuatorDemo() {
  const [extension, setExtension] = React.useState(0.5)
  const [cutaway, setCutaway] = React.useState<"on" | "off">("on")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="cutaway" value={cutaway} options={["on", "off"] as const} onChange={setCutaway} />
      <NumberControl label="stroke" value={extension} min={0} max={1} step={0.01} onChange={setExtension} format={value => `${Math.round(value * 100)}%`} />
    </>}>
      <LinearActuator size={420} extension={extension} cutaway={cutaway === "on"} variant={variant} label="STROKE / 09" />
    </Bench>
  )
}

function ServoMotorDemo() {
  const [angle, setAngle] = React.useState(30)
  const [horn, setHorn] = React.useState<ServoHorn>("double")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="horn" value={horn} options={["single", "double", "cross"] as const} onChange={setHorn} />
      <NumberControl label="angle" value={angle} min={-180} max={180} onChange={setAngle} format={value => `${value}°`} />
    </>}>
      <ServoMotor size={290} angle={angle} horn={horn} variant={variant} label="SERVO / 10" />
    </Bench>
  )
}

function RobotQuadrupedDemo() {
  const [gait, setGait] = React.useState<QuadrupedGait>("trot")
  const [phase, setPhase] = React.useState(0.65)
  const [height, setHeight] = React.useState(0.5)
  const [stride, setStride] = React.useState(0.6)
  const [lift, setLift] = React.useState(0.5)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="gait" value={gait} options={["stand", "walk", "trot"] as const} onChange={setGait} />
      <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="stride" value={stride} min={0} max={1} step={0.01} onChange={setStride} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="lift" value={lift} min={0} max={1} step={0.01} onChange={setLift} format={value => `${Math.round(value * 100)}%`} />
      <p className="text-[11px] text-muted-foreground">Scrub the cycle to inspect footfall timing. Coloured marks identify feet on the ground.</p>
    </>}>
      <RobotQuadruped size={420} gait={gait} phase={phase} height={height} stride={stride} lift={lift} variant={variant} showContacts label="QUAD / 11" />
    </Bench>
  )
}

function MicroDuckDemo() {
  const [gait, setGait] = React.useState<DuckGait>("walk")
  const [phase, setPhase] = React.useState(0.3)
  const [height, setHeight] = React.useState(0.55)
  const [gaze, setGaze] = React.useState(0.2)
  const [beak, setBeak] = React.useState(0)
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="gait" value={gait} options={["stand", "walk", "strut"] as const} onChange={setGait} />
      <NumberControl label="phase" value={phase} min={0} max={1} step={0.01} onChange={setPhase} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="height" value={height} min={0} max={1} step={0.01} onChange={setHeight} format={value => `${Math.round(value * 100)}%`} />
      <NumberControl label="gaze" value={gaze} min={-1} max={1} step={0.05} onChange={setGaze} format={value => value.toFixed(2)} />
      <NumberControl label="beak" value={beak} min={0} max={1} step={0.05} onChange={setBeak} format={value => `${Math.round(value * 34)}°`} />
      <p className="text-[11px] text-muted-foreground">Gaze swings the neck between a peck and a craned-up pose on a constant radius. Coloured marks show the foot carrying weight.</p>
    </>}>
      <MicroDuck size={300} gait={gait} phase={phase} height={height} gaze={gaze} beak={beak} variant={variant} showContacts label="DUCK / 12" />
    </Bench>
  )
}

function ReachyMiniDemo() {
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
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="linkage" value={linkage} options={["on", "off"] as const} onChange={setLinkage} />
      <NumberControl label="yaw" value={yaw} min={-30} max={30} onChange={setYaw} format={value => `${value}°`} />
      <NumberControl label="pitch" value={pitch} min={-24} max={24} onChange={setPitch} format={value => `${value}°`} />
      <NumberControl label="roll" value={roll} min={-24} max={24} onChange={setRoll} format={value => `${value}°`} />
      <NumberControl label="heave" value={heave} min={-8} max={8} step={0.5} onChange={setHeave} format={value => `${value} u`} />
      <NumberControl label="travel" value={travel} min={2} max={12} step={0.5} onChange={setTravel} format={value => `±${value} u`} />
      <Readout rows={[
        ["longest leg", `${Math.max(...solution.legs.map(leg => leg.length)).toFixed(1)} u`],
        ["max stroke", `${Math.max(...solution.legs.map(leg => Math.abs(leg.stroke))).toFixed(1)} u`],
        ["reachable", solution.reachable ? "yes" : "no"],
      ]} />
      <p className="text-[11px] text-muted-foreground">Six leg lengths come from real Stewart platform IK. Lower the travel until a rod turns accent-coloured and the fault lamp lights.</p>
    </>}>
      <ReachyMini size={320} yaw={yaw} pitch={pitch} roll={roll} heave={heave} geometry={{ travel }} showLinkage={linkage === "on"} variant={variant} label="MINI / 13" />
    </Bench>
  )
}

export const demos: Record<string, React.ComponentType> = {
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
