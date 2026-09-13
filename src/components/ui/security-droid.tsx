"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type SecurityDroidPose = "stand" | "patrol" | "guard"

export interface SecurityDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  pose?: SecurityDroidPose
  headAngle?: number
  look?: Vec2 | null
  track?: boolean
  alert?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

const poses: Record<SecurityDroidPose, { lean: number; leftLeg: number; rightLeg: number; arms: number }> = {
  stand: { lean: 0, leftLeg: -2, rightLeg: 2, arms: 3 },
  patrol: { lean: -4, leftLeg: -10, rightLeg: 11, arms: 14 },
  guard: { lean: 2, leftLeg: 5, rightLeg: -5, arms: -18 },
}

function SecurityDroid({
  size = "md",
  variant = "solid",
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

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Security droid, ${pose} pose${alert ? ", alert" : ""}`}
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
      <g data-frame transform={`translate(90 207) rotate(${stance.lean})`}>
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
      {label && <text x={90} y={234} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { SecurityDroid }
