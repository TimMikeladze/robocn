"use client"

/** Live demos for the docs pages. One per registry item, keyed by doc slug. */

import * as React from "react"

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

export const demos: Record<string, React.ComponentType> = {
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
