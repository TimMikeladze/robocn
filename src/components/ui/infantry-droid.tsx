"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp, toRadians } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  capsulePath,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type InfantryDroidFrame = "light" | "heavy"
export type InfantryDroidPose = "stand" | "march" | "guard" | "disabled"
export type InfantryDroidEquipment = "none" | "pack" | "scanner" | "shield"
export type InfantryDroidBehavior = "patrol" | "alert" | "idle" | "static"

export interface InfantryDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  frame?: InfantryDroidFrame
  /** Stance. Omit and `behavior` picks one. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  pose?: InfantryDroidPose
  /** Head turn in degrees. Omit and it looks around on its own. */
  headAngle?: number
  /** What it does on its own: walk a beat, scan for you, or stand easy. */
  behavior?: InfantryDroidBehavior
  /** Sweeps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The head follows the pointer, and a click puts it on guard. */
  interactive?: boolean
  onPoseChange?: (pose: InfantryDroidPose) => void
  equipment?: InfantryDroidEquipment
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: how far the body, limbs and head reach through the picture. */
const CENTRE = 90
const GROUND = 198
const BODY_DEEP = 10
const LIMB_DEEP = 6

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const poses: Record<InfantryDroidPose, { lean: number; leftLeg: number; rightLeg: number; arm: number }> = {
  stand: { lean: 0, leftLeg: -2, rightLeg: 2, arm: 5 },
  march: { lean: -5, leftLeg: -17, rightLeg: 18, arm: 24 },
  guard: { lean: 3, leftLeg: 6, rightLeg: -6, arm: -28 },
  disabled: { lean: 24, leftLeg: -23, rightLeg: 32, arm: 44 },
}

function InfantryDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  frame = "light",
  pose,
  headAngle,
  behavior = "patrol",
  speed = 0.2,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onPoseChange,
  equipment = "none",
  signal = "idle",
  showGround = true,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  onPointerDown,
  ...props
}: InfantryDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  const [guarding, setGuarding] = React.useState(false)
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = infantryDroidPose(guarding ? "alert" : behavior, clock)
  const stanceName = pose ?? scripted.pose
  const stance = poses[stanceName] ?? poses.stand
  const turn = finiteClamp(
    headAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 70 : scripted.head),
    -75,
    75,
  )
  const heavy = frame === "heavy"
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. A humanoid drawn from
  // the front says nothing about its own depth: the torso, pelvis and head
  // become boxes, and the limbs tubes set through the body.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, GROUND)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const faceProps = face ? { transform: face } : {}
  /** A point in the frame, leaned with the body and set `deep` toward us. */
  const at = (x: number, y: number, deep = 0) => {
    const tilt = toRadians(stance.lean)
    return camera.project(
      -(x * Math.cos(tilt) - y * Math.sin(tilt)),
      -(x * Math.sin(tilt) + y * Math.cos(tilt)),
      -deep,
    )
  }
  /** The joints of a limb: each segment turned by its own angle, in order. */
  const chain = (
    ox: number,
    oy: number,
    deep: number,
    segments: readonly { angle: number; length: number }[],
  ) => {
    let x = ox
    let y = oy
    const joints = [at(x, y, deep)]
    for (const segment of segments) {
      const a = toRadians(segment.angle)
      x -= Math.sin(a) * segment.length
      y += Math.cos(a) * segment.length
      joints.push(at(x, y, deep))
    }
    return joints
  }
  const solid = (halfWidth: number, deep: number, top: number, bottom: number, x = 0) =>
    extrudedPath(
      roundedFootprint(halfWidth, deep, Math.min(halfWidth, deep) * 0.4, 4).map(point => ({
        x: point.x - x,
        y: point.y,
      })),
      camera, -top, -bottom,
    )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`${heavy ? "Heavy" : "Light"} infantry droid, ${stanceName} pose, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = !guarding
        setGuarding(next)
        onPoseChange?.(next ? "guard" : "stand")
      }}
      viewBox="0 0 180 230"
      width={width}
      height={px(width * 1.28)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 12 208 H 168 M 90 10 V 215" strokeDasharray="2 3" />
          <circle cx={90} cy={113} r={78} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={90} cy={207} rx={46} ry={6} fill={palette.dark} opacity={0.14} />}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {([-1, 1] as const).map(side => {
          const [hip, knee, ankle] = chain(side * (heavy ? 17 : 13), -61, side * LIMB_DEEP, [
            { angle: side < 0 ? stance.leftLeg : stance.rightLeg, length: 42 },
            { angle: side < 0 ? stance.leftLeg : stance.rightLeg, length: 45 },
          ])
          return (
            <g key={side} data-leg={side < 0 ? "left" : "right"}>
              <path d={capsulePath(hip, knee, 6)} {...shell} />
              <path d={capsulePath(knee, ankle, 5)} {...machined} />
            </g>
          )
        })}
        {([-1, 1] as const).map(side => {
          const [shoulder, elbow, wrist] = chain(side * (heavy ? 35 : 25), -116, side * BODY_DEEP, [
            { angle: side * stance.arm, length: 43 },
            { angle: side * stance.arm, length: 38 },
          ])
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"}>
              <path d={capsulePath(shoulder, elbow, 6)} {...shell} />
              <path d={capsulePath(elbow, wrist, 5)} {...machined} />
            </g>
          )
        })}
        <path d={solid(heavy ? 32 : 22, BODY_DEEP, 126, 61)} {...shell} />
        <path d={solid(heavy ? 26 : 15, BODY_DEEP - 2, 117, 74)} {...cast} />
        <path d={solid(7, 6, 153, 126)} {...machined} />
        <path d={solid(16, 13, 172, 140, turn * 0.11)} {...shell} />
      </g>}
      <Frame {...faceProps}>
      <g data-frame={frame} data-view={view} transform={`translate(90 198) rotate(${stance.lean})`}>
        {[-1, 1].map((side) => (
          <g key={side} data-leg={side < 0 ? "left" : "right"} transform={`translate(${side * (heavy ? 17 : 13)} -61) rotate(${side < 0 ? stance.leftLeg : stance.rightLeg})`}>
            <rect x={-6} y={0} width={12} height={41} rx={4} {...(heavy ? shell : machined)} />
            <circle cy={42} r={heavy ? 8 : 6} {...cast} />
            <rect x={-5} y={42} width={10} height={45} rx={4} {...machined} />
            <path d="M -7 85 H 12 Q 19 85 19 91 H -8 Z" {...(heavy ? shell : cast)} />
          </g>
        ))}

        <path d={heavy ? "M -34 -126 L -29 -61 Q 0 -49 29 -61 L 34 -126 Z" : "M -23 -119 L -18 -62 Q 0 -52 18 -62 L 23 -119 Z"} {...shell} />
        <path d={heavy ? "M -27 -117 H 27 L 20 -74 H -20 Z" : "M -16 -109 H 16 L 12 -72 H -12 Z"} {...cast} />
        <circle cy={-62} r={heavy ? 10 : 7} {...machined} />
        <rect x={-7} y={-138} width={14} height={18} rx={4} {...machined} />

        {[-1, 1].map((side) => (
          <g key={side} data-arm={side < 0 ? "left" : "right"} transform={`translate(${side * (heavy ? 35 : 25)} -116) rotate(${side * stance.arm})`}>
            <circle r={heavy ? 9 : 6.5} {...cast} />
            <rect x={-6} y={0} width={12} height={42} rx={4} {...(heavy ? shell : machined)} />
            <circle cy={43} r={6} {...cast} />
            <rect x={-5} y={43} width={10} height={38} rx={4} {...machined} />
            <path d="M -5 82 L -6 91 M 0 82 V 93 M 5 82 L 6 91" stroke={palette.dark} strokeWidth={2} strokeLinecap="round" />
          </g>
        ))}

        <g data-head transform={`translate(${px(turn * 0.11)} -153) rotate(${px(turn * 0.06)})`}>
          <path d={heavy ? "M -25 -17 H 25 L 20 18 H -20 Z" : "M -20 -14 H 20 L 15 15 H -15 Z"} {...(heavy ? shell : machined)} />
          <rect x={heavy ? -18 : -14} y={-7} width={heavy ? 36 : 28} height={9} rx={3} {...cast} />
          <circle cx={px(turn * 0.08)} cy={-2.5} r={3.5} fill={signalColor} />
          {!heavy && <path d="M 12 -8 L 24 -15" stroke={palette.dark} strokeWidth={2} />}
        </g>

        {equipment !== "none" && (
          <g data-equipment={equipment}>
            {equipment === "pack" && <rect x={heavy ? -38 : -29} y={-111} width={12} height={35} rx={4} {...cast} />}
            {equipment === "scanner" && (
              <g transform="translate(28 -95)">
                <path d="M 0 0 L 22 -9 V 9 Z" {...machined} />
                <circle cx={20} r={3} fill={palette.accent} />
              </g>
            )}
            {equipment === "shield" && <path d="M 34 -118 Q 59 -106 55 -68 Q 46 -51 34 -45 Z" {...shell} />}
          </g>
        )}
      </g>
      </Frame>
      {label && <text x={90} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { InfantryDroid }

/**
 * The beat it walks when nobody is posing it. A patrol marches and looks left
 * and right as it goes; an alert stands to guard and scans in short, quick
 * turns; idle stands easy and barely moves.
 */
export function infantryDroidPose(behavior: InfantryDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "alert":
      return { pose: "guard" as InfantryDroidPose, head: Math.sin(t * Math.PI * 4) * 55 }
    case "idle":
      return { pose: "stand" as InfantryDroidPose, head: Math.sin(t * Math.PI * 0.6) * 12 }
    case "static":
      return { pose: "stand" as InfantryDroidPose, head: 0 }
    default:
      return { pose: "march" as InfantryDroidPose, head: Math.sin(t * Math.PI * 2) * 38 }
  }
}
