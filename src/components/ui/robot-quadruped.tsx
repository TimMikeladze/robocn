"use client"

import type * as React from "react"
import { solveQuadruped, type QuadrupedLeg, type QuadrupedOptions } from "@/lib/robocn/quadruped"
import { capsulePath, px, resolveRobotPalette, resolveRobotSize, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export interface RobotQuadrupedProps extends Omit<React.ComponentProps<"svg">, "color" | "height">, RobotPaletteProps, QuadrupedOptions {
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  label?: string
}

function RobotQuadruped({
  gait = "stand", phase = 0, height = 0.5, stride = 0.6, lift = 0.5,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, ...props
}: RobotQuadrupedProps) {
  const pose = solveQuadruped({ gait, phase, height, stride, lift })
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const bodyY = 120 - pose.height

  function legDrawing(leg: QuadrupedLeg) {
    const far = leg.side === "right"
    return (
      <g key={leg.id} data-leg={leg.id} transform={`translate(${far ? 106 : 91} ${far ? 111 : 122}) scale(1 -1)`} opacity={far ? 0.55 : 1}>
        <path d={capsulePath(leg.hip, leg.knee, 3.8)} {...shell} />
        <path d={capsulePath(leg.knee, leg.foot, 2.6)} {...machined} />
        {[leg.hip, leg.knee].map((joint, i) => <g key={i}>
          <circle cx={px(joint.x)} cy={px(joint.y)} r={i === 0 ? 5.5 : 4} {...cast} />
          <circle cx={px(joint.x)} cy={px(joint.y)} r={1.6} fill={palette.metal} />
        </g>)}
        <rect x={px(leg.foot.x - 5)} y={px(leg.foot.y - 1.5)} width={10} height={3} rx={1.5} {...cast} />
        {showContacts && leg.contact && <ellipse data-contact cx={px(leg.foot.x)} cy={-3} rx={7} ry={1.3} fill={palette.accent} opacity={0.6} />}
      </g>
    )
  }

  return (
    <svg role="img" aria-label={`Quadruped robot, ${gait} pose`}
      viewBox="0 0 200 150" width={width} height={width * 0.75}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      {showGround && <g stroke={palette.grid} strokeWidth={0.5} opacity={0.5}>
        <path d="M 25 126 H 176 M 42 110 H 190 M 25 126 L 42 110 M 176 126 L 190 110" fill="none" />
        {variant === "blueprint" && [50, 75, 100, 125, 150].map(x => <path key={x} d={`M ${x} 126 l 16 -16`} strokeDasharray="1 2" />)}
      </g>}
      {pose.legs.filter(leg => leg.side === "right").map(legDrawing)}
      <g>
        <path d={`M 51 ${bodyY - 20} L 66 ${bodyY - 31} H 146 L 131 ${bodyY - 20} Z`} {...machined} />
        <path d={`M 131 ${bodyY - 20} L 146 ${bodyY - 31} V ${bodyY - 7} L 131 ${bodyY + 4} Z`} {...cast} />
        <rect x={51} y={bodyY - 20} width={80} height={24} rx={5} {...shell} />
        <rect x={73} y={bodyY - 15} width={35} height={14} rx={3} {...cast} />
        {[79, 85, 91, 97, 103].map(x => <line key={x} x1={x} y1={bodyY - 12} x2={x} y2={bodyY - 4} stroke={palette.metal} strokeWidth={1} />)}
        <path d={`M 67 ${bodyY - 23} l 8 -5 h 44 l -8 5 Z`} {...shell} />
        <rect x={134} y={bodyY - 22} width={23} height={13} rx={4} {...shell} />
        <rect x={145} y={bodyY - 19} width={11} height={7} rx={2} {...cast} />
        <circle cx={152} cy={bodyY - 15.5} r={1.5} fill={palette.accent} />
        <circle cx={62} cy={bodyY - 8} r={2} fill={palette.accent} />
      </g>
      {pose.legs.filter(leg => leg.side === "left").map(legDrawing)}
      {label && <text x={100} y={145} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={4.5} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { RobotQuadruped }
