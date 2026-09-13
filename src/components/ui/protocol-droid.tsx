import type * as React from "react"

import { clamp } from "@/lib/robocn/kinematics"
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

export type ProtocolDroidPose = "formal" | "converse" | "cautious"
export type ProtocolDroidGesture = "none" | "explain" | "greet" | "point"

export interface ProtocolDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  pose?: ProtocolDroidPose
  headAngle?: number
  gesture?: ProtocolDroidGesture
  exposed?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

const poses: Record<ProtocolDroidPose, { lean: number; leftLeg: number; rightLeg: number }> = {
  formal: { lean: 0, leftLeg: 0, rightLeg: 0 },
  converse: { lean: -3, leftLeg: -4, rightLeg: 5 },
  cautious: { lean: 6, leftLeg: 6, rightLeg: -7 },
}

const gestures: Record<ProtocolDroidGesture, { left: number; right: number; forearm: number }> = {
  none: { left: 4, right: -4, forearm: 0 },
  explain: { left: 26, right: -48, forearm: -58 },
  greet: { left: 8, right: -112, forearm: -42 },
  point: { left: 12, right: -72, forearm: 64 },
}

function ProtocolDroid({
  size = "md",
  variant = "solid",
  pose = "formal",
  headAngle = 0,
  gesture = "none",
  exposed = false,
  signal = "ready",
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
}: ProtocolDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const turn = finiteClamp(headAngle, -55, 55)
  const stance = poses[pose] ?? poses.formal
  const arms = gestures[gesture] ?? gestures.none
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  return (
    <svg
      role="img"
      aria-label={`Protocol droid, ${pose} pose, ${gesture} gesture`}
      viewBox="0 0 170 230"
      width={width}
      height={px(width * 1.35)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 12 209 H 158 M 85 8 V 216" strokeDasharray="2 3" />
          <path d="M 24 24 H 146 V 207 H 24 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={207} rx={44} ry={5.5} fill={palette.dark} opacity={0.14} />}

      <g data-frame transform={`translate(85 199) rotate(${stance.lean})`}>
        <g data-leg="left" transform={`translate(-15 -60) rotate(${stance.leftLeg})`}>
          <rect x={-7} y={0} width={14} height={43} rx={6} {...shell} />
          <circle data-joint="left-knee" cy={43} r={7.5} {...cast} />
          <rect x={-6} y={43} width={12} height={45} rx={5} {...machined} />
          <path d="M -8 86 H 13 Q 20 86 20 92 H -9 Z" {...shell} />
        </g>
        <g data-leg="right" transform={`translate(15 -60) rotate(${stance.rightLeg})`}>
          <rect x={-7} y={0} width={14} height={43} rx={6} {...shell} />
          <circle data-joint="right-knee" cy={43} r={7.5} {...cast} />
          <rect x={-6} y={43} width={12} height={45} rx={5} {...machined} />
          <path d="M -8 86 H 13 Q 20 86 20 92 H -9 Z" {...shell} />
        </g>

        <path d="M -25 -110 L -20 -59 Q 0 -49 20 -59 L 25 -110 Z" {...shell} />
        <ellipse cx={0} cy={-59} rx={21} ry={8} {...cast} />
        <g data-torso-panel>
          <path d="M -15 -99 H 15 V -70 Q 0 -62 -15 -70 Z" {...machined} />
          {exposed ? (
            <g data-wiring fill="none" strokeLinecap="round">
              <path d="M -10 -94 C -2 -86 -7 -78 0 -69" stroke={palette.accent} strokeWidth={2} />
              <path d="M 0 -96 C 7 -87 2 -79 9 -70" stroke={palette.dark} strokeWidth={2} />
              <path d="M 8 -94 C 1 -86 8 -79 3 -70" stroke={palette.metal} strokeWidth={1.8} />
            </g>
          ) : (
            <g stroke={palette.dark} strokeWidth={1.4}>
              <path d="M -10 -91 H 10 M -10 -84 H 10 M -10 -77 H 10" />
            </g>
          )}
        </g>
        <circle data-joint="waist" cy={-108} r={8} {...cast} />
        <rect x={-8} y={-124} width={16} height={16} rx={4} {...machined} />

        <g data-arm="left" transform={`translate(-27 -103) rotate(${arms.left})`}>
          <circle data-joint="left-shoulder" r={8} {...cast} />
          <rect x={-6} y={0} width={12} height={38} rx={5} {...shell} />
          <circle data-joint="left-elbow" cy={39} r={6.5} {...cast} />
          <rect x={-5} y={39} width={10} height={37} rx={4} {...machined} />
          <circle cy={78} r={5} {...cast} />
          <path d="M -5 82 Q 0 90 5 82 M 0 82 V 92" fill="none" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" />
        </g>
        <g data-arm="right" transform={`translate(27 -103) rotate(${arms.right})`}>
          <circle data-joint="right-shoulder" r={8} {...cast} />
          <rect x={-6} y={0} width={12} height={38} rx={5} {...shell} />
          <circle data-joint="right-elbow" cy={39} r={6.5} {...cast} />
          <g transform={`translate(0 39) rotate(${arms.forearm})`}>
            <rect x={-5} y={0} width={10} height={37} rx={4} {...machined} />
            <circle cy={39} r={5} {...cast} />
            <path d="M -5 43 Q 0 51 5 43 M 0 43 V 53" fill="none" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>

        <g data-head transform={`translate(${px(turn * 0.13)} -148) rotate(${px(turn * 0.08)})`}>
          <rect x={-20} y={-18} width={40} height={34} rx={8} {...shell} />
          <path d="M -16 -9 H 16 V 7 H -16 Z" {...cast} />
          {[-8, 8].map((x) => (
            <g key={x}>
              <circle cx={x} cy={-2} r={5} fill={signalColor} />
              <circle cx={x + 1} cy={-3} r={1.4} fill={palette.metal} />
            </g>
          ))}
          <path d="M -7 10 H 7 M -4 14 H 4" stroke={palette.dark} strokeWidth={1.4} />
          <rect x={-13} y={16} width={26} height={6} rx={2} {...machined} />
        </g>
      </g>
      {label && <text x={85} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { ProtocolDroid }
