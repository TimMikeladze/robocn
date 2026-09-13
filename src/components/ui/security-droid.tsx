"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

export type SecurityDroidPose = "stand" | "patrol" | "guard"

export interface SecurityDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  pose?: SecurityDroidPose
  headAngle?: number
  look?: Vec2 | null
  track?: boolean
  alert?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: how far the body, limbs and head reach through the picture. */
const CENTRE = 90
const GROUND = 207
const BODY_DEEP = 12
const LIMB_DEEP = 7

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const poses: Record<SecurityDroidPose, { lean: number; leftLeg: number; rightLeg: number; arms: number }> = {
  stand: { lean: 0, leftLeg: -2, rightLeg: 2, arms: 3 },
  patrol: { lean: -4, leftLeg: -10, rightLeg: 11, arms: 14 },
  guard: { lean: 2, leftLeg: 5, rightLeg: -5, arms: -18 },
}

function SecurityDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  pose = "stand",
  headAngle = 0,
  look = null,
  track = true,
  alert = false,
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
  ...props
}: SecurityDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const stance = poses[pose] ?? poses.stand
  const turn = finiteClamp(headAngle, -70, 70)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((unit.y - 0.5) * 2, -1, 1),
    }), []),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const sensorX = clamp(gaze.x, -1, 1) * 8
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = alert || signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
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
  const frame = face ? { transform: face } : {}
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
      aria-label={`Security droid, ${pose} pose${alert ? ", alert" : ""}, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 180 240"
      width={width}
      height={px(width * 1.33)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 14 217 H 166 M 90 8 V 223" strokeDasharray="2 3" />
          <path d="M 29 20 H 151 V 214 H 29 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={90} cy={216} rx={48} ry={6} fill={palette.dark} opacity={0.14} />}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {([-1, 1] as const).map(side => {
          const [hip, knee, ankle] = chain(side * 18, -69, side * LIMB_DEEP, [
            { angle: side < 0 ? stance.leftLeg : stance.rightLeg, length: 54 },
            { angle: side < 0 ? stance.leftLeg : stance.rightLeg, length: 56 },
          ])
          return (
            <g key={side} data-leg={side < 0 ? "left" : "right"}>
              <path d={capsulePath(hip, knee, 7)} {...shell} />
              <path d={capsulePath(knee, ankle, 6)} {...machined} />
            </g>
          )
        })}
        {([-1, 1] as const).map(side => {
          const [shoulder, elbow, wrist] = chain(side * 36, -135, side * BODY_DEEP, [
            { angle: side * stance.arms, length: 53 },
            { angle: side * stance.arms, length: 40 },
          ])
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"}>
              <path d={capsulePath(shoulder, elbow, 7)} {...shell} />
              <path d={capsulePath(elbow, wrist, 6)} {...machined} />
            </g>
          )
        })}
        <path d={solid(32, BODY_DEEP, 151, 69)} {...cast} />
        <path d={solid(24, BODY_DEEP - 2, 132, 79)} {...shell} />
        <path d={solid(9, 8, 178, 148)} {...machined} />
        <path d={solid(19, 15, 200, 160, turn * 0.12)} {...shell} />
      </g>}
      <Frame {...frame}>
      <g data-frame data-view={view} transform={`translate(90 207) rotate(${stance.lean})`}>
        {[-1, 1].map((side) => (
          <g key={side} data-leg={side < 0 ? "left" : "right"} transform={`translate(${side * 18} -69) rotate(${side < 0 ? stance.leftLeg : stance.rightLeg})`}>
            <rect x={-7} y={0} width={14} height={53} rx={5} {...cast} />
            <circle cy={54} r={7.5} {...machined} />
            <rect x={-6} y={54} width={12} height={56} rx={5} {...shell} />
            <path d="M -8 108 H 15 Q 23 108 23 115 H -9 Z" {...cast} />
          </g>
        ))}

        <path d="M -34 -137 L -27 -69 Q 0 -56 27 -69 L 34 -137 L 20 -151 H -20 Z" {...cast} />
        <path d="M -24 -132 L -18 -79 Q 0 -70 18 -79 L 24 -132 Z" {...shell} />
        <path d="M -16 -121 H 16 V -91 H -16 Z" {...machined} />
        <path d="M -10 -115 H 10 M -10 -106 H 10 M -10 -97 H 10" stroke={palette.dark} strokeWidth={2} />
        <circle cx={0} cy={-81} r={7} fill={signalColor} />

        {[-1, 1].map((side) => (
          <g key={side} data-arm={side < 0 ? "left" : "right"} transform={`translate(${side * 36} -135) rotate(${side * stance.arms})`}>
            <circle r={9} {...machined} />
            <rect x={-7} y={0} width={14} height={52} rx={5} {...cast} />
            <circle cy={53} r={7} {...machined} />
            <rect x={-6} y={53} width={12} height={51} rx={5} {...shell} />
            <path d="M -7 104 L -9 114 M -2 104 L -3 116 M 3 104 L 4 115 M 7 104 L 10 112" stroke={palette.dark} strokeWidth={2} strokeLinecap="round" />
          </g>
        ))}

        <rect x={-8} y={-160} width={16} height={18} rx={4} {...machined} />
        <g data-head transform={`translate(${px(turn * 0.12)} -178) rotate(${px(turn * 0.07)})`}>
          <path d="M -25 -15 H 25 L 20 17 H -20 Z" {...shell} />
          <rect x={-19} y={-7} width={38} height={13} rx={4} {...cast} />
          <rect data-sensor x={px(-6 + sensorX)} y={-4} width={12} height={7} rx={3.5} fill={signalColor} />
          <path d="M -14 12 H 14" stroke={palette.metal} strokeWidth={2} />
          {alert && <circle data-alert cx={20} cy={-12} r={4} fill={palette.accent} className="robocn-pulse" />}
        </g>
      </g>
      </Frame>
      {label && <text x={90} y={234} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { SecurityDroid }
