"use client"

import type * as React from "react"
import { px, resolveRobotPalette, resolveRobotSize, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type ServoHorn = "single" | "double" | "cross"

export interface ServoMotorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled clockwise angle, clamped to -180..180 degrees. Zero points up. */
  angle?: number
  horn?: ServoHorn
  showCable?: boolean
  showScale?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ServoMotor({
  angle = 0, horn = "double", showCable = true, showScale = true, label,
  size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, ...props
}: ServoMotorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const rotation = Number.isFinite(angle) ? Math.max(-180, Math.min(180, angle)) : 0
  const arms = horn === "cross" ? [0, 90, 180, 270] : horn === "single" ? [0] : [0, 180]
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  return (
    <svg role="img" aria-label={`Servo motor, ${px(rotation)} degrees, ${horn} horn`}
      viewBox="0 0 160 180" width={width} height={width * 180 / 160}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      <g data-motor>
        {showCable && <g fill="none" strokeWidth={2}>
          <path d="M 70 133 V 151 Q 70 160 58 160 H 25" stroke={palette.dark} />
          <path d="M 74 133 V 154 Q 74 164 58 164 H 25" stroke={palette.shell} />
          <path d="M 78 133 V 157 Q 78 168 58 168 H 25" stroke={palette.metal} />
          <rect x={18} y={157} width={9} height={14} rx={2} {...cast} />
        </g>}
        <rect x={35} y={40} width={90} height={14} rx={3} {...machined} />
        <rect x={35} y={114} width={90} height={14} rx={3} {...machined} />
        {[43, 117].flatMap(x => [47, 121].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} {...cast} />))}
        <rect x={49} y={35} width={62} height={100} rx={7} {...shell} />
        <rect x={55} y={92} width={50} height={33} rx={3} {...cast} />
        {[100, 107, 114].map(y => <path key={y} d={`M 63 ${y} H 97`} stroke={palette.metal} strokeWidth={1.2} />)}
        <circle cx={80} cy={69} r={22} {...cast} />
        <circle cx={80} cy={69} r={17} {...machined} />
      </g>
      {showScale && <g transform="translate(80 69)" fill="none" stroke={palette.grid} strokeWidth={0.6}>
        <circle r={48} strokeDasharray="1 3" />
        {[-180, -90, 0, 90].map(degrees => <path key={degrees} d="M 0 -45 V -50" transform={`rotate(${degrees})`} />)}
      </g>}
      <g transform="translate(80 69)">
        <g data-horn transform={`rotate(${px(rotation)})`}>
          {arms.map(degrees => <g key={degrees} data-horn-arm transform={`rotate(${degrees})`}>
            <path d="M -6 0 L -4 -35 Q 0 -42 4 -35 L 6 0 Z" {...machined} />
            {[16, 24, 32].map(y => <circle key={y} cy={-y} r={1.6} fill={palette.dark} />)}
          </g>)}
          <circle r={8} {...shell} />
          <circle r={3.5} {...cast} />
          <path d="M -2 0 h 4 M 0 -2 v 4" stroke={palette.metal} strokeWidth={0.7} />
          <path d="M -2 -8 L 0 -11 L 2 -8" fill="none" stroke={palette.accent} strokeWidth={1} />
        </g>
      </g>
      <text x={80} y={149} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>{px(rotation)}°</text>
      {label && <text x={90} y={177} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={4.5} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { ServoMotor }
