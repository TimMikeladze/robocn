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

export interface RotaryTableProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled clockwise platter angle in degrees. Zero aligns the first fixture to the top. */
  angle?: number
  /** Equally spaced fixtures, rounded and clamped to 0–12. */
  stations?: number
  /** Draw a workpiece in each fixture. */
  loaded?: boolean
  showTicks?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RotaryTable({
  angle = 0, stations = 6, loaded = true, showTicks = true, label,
  size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, ...props
}: RotaryTableProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const rotation = Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : 0
  const count = Number.isFinite(stations) ? Math.max(0, Math.min(12, Math.round(stations))) : 6
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  return (
    <svg role="img" aria-label={`Rotary table, ${count} stations, angle ${Math.round(rotation)} degrees`}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      <g transform="translate(90 86)">
        <g data-base>
          <rect x={-57} y={-57} width={114} height={114} rx={10} {...cast} />
          {[-49, 49].flatMap(x => [-49, 49].map(y => <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={4} {...machined} />
            <path d={`M ${x - 2} ${y} h 4`} stroke={palette.dark} strokeWidth={1} />
          </g>))}
          <rect x={47} y={-17} width={31} height={34} rx={5} {...shell} />
          <rect x={68} y={-12} width={9} height={24} rx={2} {...cast} />
          <path d="M 70 -7 h 5 M 70 -2 h 5 M 70 3 h 5 M 70 8 h 5" stroke={palette.metal} strokeWidth={1} />
          <circle r={64} {...cast} />
        </g>
        <g data-platter transform={`rotate(${px(rotation)})`}>
          <circle r={59} {...machined} />
          <circle r={52} fill="none" stroke={palette.dark} strokeWidth={0.5} />
          {showTicks && Array.from({ length: 36 }, (_, i) => <path key={i} d={`M 0 -${i % 3 === 0 ? 53 : 55} V -58`}
            transform={`rotate(${i * 10})`} stroke={palette.dark} strokeWidth={0.7} />)}
          {Array.from({ length: count }, (_, i) => <g key={i} data-fixture={i}
            transform={`rotate(${px(i * 360 / count)}) translate(0 -38)`}>
            <rect x={-10} y={-10} width={20} height={20} rx={3} {...cast} />
            {loaded && <rect x={-6} y={-7} width={12} height={14} rx={2} {...shell} />}
            {[-8, 8].map(x => <rect key={x} x={x - 1.5} y={-4} width={3} height={8} rx={0.5} fill={palette.metal} />)}
          </g>)}
          <circle r={20} {...shell} />
          <circle r={11} {...cast} />
          <circle r={5} {...machined} />
          <path d="M -3 -13 L 0 -17 L 3 -13" fill="none" stroke={palette.accent} strokeWidth={1.5} />
          {[0, 90, 180, 270].map(degrees => <circle key={degrees} cy={15} r={1.5} transform={`rotate(${degrees})`} fill={palette.dark} />)}
        </g>
        <path d="M -4 -72 L 0 -65 L 4 -72 Z" fill={palette.accent} />
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={90} y={163} fontSize={5}>{`${px(rotation)}° / ${count} STATIONS`}</text>
        {label && <text x={90} y={175} fontSize={4.5}>{label}</text>}
      </g>
    </svg>
  )
}

export { RotaryTable }
