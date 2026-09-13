"use client"

import type * as React from "react"

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

export interface RobotDroneProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  rotors?: 4 | 6
  /** Clockwise heading in degrees, zero faces the top. */
  heading?: number
  /** Controlled blade angle in degrees. Adjacent rotors turn opposite ways. */
  rotorAngle?: number
  guards?: boolean
  active?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotDrone({
  rotors = 4, heading = 0, rotorAngle = 0, guards = true, active = false,
  label, size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, ...props
}: RobotDroneProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const headingAngle = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0
  const bladeAngle = Number.isFinite(rotorAngle) ? ((rotorAngle % 360) + 360) % 360 : 0
  const count = rotors === 6 ? 6 : 4
  const hubs = Array.from({ length: count }, (_, i) => {
    const angle = (i * 360 / count + (count === 4 ? 45 : 30)) * Math.PI / 180
    return { x: px(Math.sin(angle) * 52), y: px(-Math.cos(angle) * 52) }
  })
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  return (
    <svg role="img" aria-label={`${count}-rotor drone, heading ${Math.round(headingAngle)} degrees`}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      {variant === "blueprint" && <g fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3">
        <circle cx={90} cy={90} r={76} /><path d="M 90 9 V 171 M 9 90 H 171" />
      </g>}
      <g transform={`translate(90 90) rotate(${px(headingAngle)})`}>
        {hubs.map((hub, i) => <g key={i}>
          <path d={`M 0 0 L ${hub.x} ${hub.y}`} stroke={palette.dark} strokeWidth={10} strokeLinecap="round" />
          <path d={`M 0 0 L ${hub.x} ${hub.y}`} stroke={palette.shell} strokeWidth={6} strokeLinecap="round" />
        </g>)}
        {hubs.map((hub, i) => <g key={i} data-rotor={i} transform={`translate(${hub.x} ${hub.y})`}>
          {guards && <g data-guard fill="none" stroke={palette.metal} strokeWidth={1.5}>
            <circle r={22} /><path d="M -22 0 h 44 M 0 -22 v 44" strokeWidth={0.7} />
          </g>}
          <circle r={6} {...cast} />
          <g data-propeller transform={`rotate(${px(bladeAngle * (i % 2 ? -1 : 1))})`}>
            <path d="M -3 -2 C -21 -12 -23 -2 -15 2 L -3 3 Z M 3 2 C 21 12 23 2 15 -2 L 3 -3 Z" {...machined} />
          </g>
          <circle r={3} {...shell} />
          <circle r={1} fill={palette.dark} />
        </g>)}
        <rect x={-16} y={-25} width={32} height={50} rx={12} {...shell} />
        <rect x={-10} y={-10} width={20} height={25} rx={4} {...cast} />
        <path d="M -6 -16 L 0 -22 L 6 -16" fill="none" stroke={palette.accent} strokeWidth={2} />
        <rect x={-6} y={21} width={12} height={7} rx={2} {...machined} />
        <circle cy={26} r={3} fill={palette.dark} />
        <circle cy={8} r={2.5} fill={active ? palette.accent : palette.metal} />
        {[-4, 0, 4].map(y => <path key={y} d={`M -5 ${y - 2} h 10`} stroke={palette.metal} strokeWidth={1} />)}
      </g>
      {label && <text x={90} y={176} textAnchor="middle" fontSize={5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { RobotDrone }
