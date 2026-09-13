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

export type InfantryDroidFrame = "light" | "heavy"
export type InfantryDroidPose = "stand" | "march" | "guard" | "disabled"
export type InfantryDroidEquipment = "none" | "pack" | "scanner" | "shield"

export interface InfantryDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  frame?: InfantryDroidFrame
  pose?: InfantryDroidPose
  headAngle?: number
  equipment?: InfantryDroidEquipment
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
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
  frame = "light",
  pose = "stand",
  headAngle = 0,
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
  ...props
}: InfantryDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const stance = poses[pose] ?? poses.stand
  const turn = finiteClamp(headAngle, -75, 75)
  const heavy = frame === "heavy"
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  return (
    <svg
      role="img"
      aria-label={`${heavy ? "Heavy" : "Light"} infantry droid, ${pose} pose`}
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
      <g data-frame={frame} transform={`translate(90 198) rotate(${stance.lean})`}>
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
      {label && <text x={90} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { InfantryDroid }
