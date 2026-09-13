"use client"

import type * as React from "react"
import { px, resolveRobotPalette, resolveRobotSize, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export interface LinearActuatorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled stroke, 0 retracted to 1 extended. */
  extension?: number
  /** Reveal the piston through the cylinder wall. */
  cutaway?: boolean
  showRuler?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function LinearActuator({
  extension = 0.5, cutaway = false, showRuler = true, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, ...props
}: LinearActuatorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const value = Number.isFinite(extension) ? Math.max(0, Math.min(1, extension)) : 0
  const travel = px(value * 48)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  return (
    <svg role="img" aria-label={`Linear actuator, ${Math.round(value * 100)}% extended`}
      viewBox="0 0 180 100" width={width} height={width * 100 / 180}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      <g data-rod transform={`translate(${travel} 0)`}>
        <rect x={42} y={42} width={66} height={6} rx={1} {...machined} />
        <path d="M 106 38 H 115 A 7 7 0 0 1 115 52 H 106 Z" {...shell} />
        <circle cx={115} cy={45} r={3.2} {...cast} />
      </g>
      <g data-housing>
        <path d="M 28 38 H 16 A 7 7 0 0 0 16 52 H 28 Z" {...machined} />
        <circle cx={16} cy={45} r={3.2} {...cast} />
        <rect x={28} y={28} width={76} height={34} rx={4} {...shell} fillOpacity={cutaway ? 0.12 : shell.fillOpacity} />
        <rect x={26} y={25} width={8} height={40} rx={2} {...cast} />
        <rect x={97} y={25} width={8} height={40} rx={2} {...cast} />
        {[30, 60].map(y => <g key={y}>
          <path d={`M 30 ${y} H 101`} stroke={palette.metal} strokeWidth={1.5} />
          {[30, 101].map(x => <circle key={x} cx={x} cy={y} r={1.8} fill={palette.metal} />)}
        </g>)}
        {[40, 88].map(x => <g key={x}>
          <rect x={x - 3} y={20} width={6} height={8} rx={1} {...machined} />
          <rect x={x - 2} y={17} width={4} height={4} rx={1} {...cast} />
        </g>)}
      </g>
      {cutaway && <g data-piston transform={`translate(${travel} 0)`}>
        <rect x={38} y={32} width={8} height={26} rx={1} {...machined} />
        <path d="M 40 32 V 58 M 44 32 V 58" stroke={palette.dark} strokeWidth={1} />
      </g>}
      {showRuler && <g stroke={palette.grid} strokeWidth={0.5} fill={palette.foreground}>
        <path d="M 115 69 v 8 m 0 -4 h 48 m 0 -4 v 8" />
        {[0, 12, 24, 36, 48].map(x => <path key={x} d={`M ${115 + x} 73 v 3`} />)}
        <path d={`M ${115 + travel - 2} 68 l 2 3 2 -3 Z`} fill={palette.accent} stroke="none" />
        <text x={139} y={85} stroke="none" textAnchor="middle" fontSize={4} fontFamily="ui-monospace, monospace">{Math.round(value * 100)}% STROKE</text>
      </g>}
      {label && <text x={90} y={97} textAnchor="middle" fontSize={4.5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { LinearActuator }
