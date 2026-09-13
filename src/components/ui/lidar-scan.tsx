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

export interface LidarSample {
  /** Clockwise degrees from the sensor's forward direction. */
  angle: number
  /** Nonnegative distance in the same units as maxRange. */
  distance: number
}

export interface LidarScanProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  samples?: readonly LidarSample[]
  /** Range represented by the outer ring. Invalid or nonpositive values use 10. */
  maxRange?: number
  /** Clockwise sensor heading in degrees. Rotates returns and scan ray together. */
  heading?: number
  /** Controlled scan-ray angle relative to the sensor. Omit to hide the ray. */
  scanAngle?: number
  showRays?: boolean
  showRings?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function LidarScan({
  samples = [], maxRange = 10, heading = 0, scanAngle, showRays = false, showRings = true,
  label, size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, ...props
}: LidarScanProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const range = Number.isFinite(maxRange) && maxRange > 0 ? maxRange : 10
  const rotation = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0
  const points = samples.filter(sample => Number.isFinite(sample.angle) && Number.isFinite(sample.distance) && sample.distance >= 0 && sample.distance <= range)
    .map(sample => {
      const angle = (sample.angle % 360) * Math.PI / 180
      const radius = sample.distance / range * 72
      return { x: px(Math.sin(angle) * radius), y: px(-Math.cos(angle) * radius) }
    })
  const ray = scanAngle !== undefined && Number.isFinite(scanAngle) ? ((scanAngle % 360) + 360) % 360 : null

  return (
    <svg role="img" aria-label={`Lidar scan, ${points.length} returns, range ${range}`}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      <g transform="translate(90 90)">
        <circle r={76} {...robotSurface("dark", variant, palette)} />
        {showRings && <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.6}>
          {[18, 36, 54, 72].map(radius => <circle key={radius} r={radius} />)}
          <path d="M -72 0 h 144 M 0 -72 v 144" strokeDasharray="2 3" />
        </g>}
        {Array.from({ length: 36 }, (_, i) => <path key={i} d={`M 0 -${i % 3 === 0 ? 69 : 71} V -74`}
          transform={`rotate(${i * 10})`} stroke={palette.grid} strokeWidth={0.6} />)}
        <g data-scan transform={`rotate(${px(rotation)})`}>
          {ray !== null && <g transform={`rotate(${px(ray)})`}>
            <path d="M 0 0 L -18.63 -69.55 A 72 72 0 0 1 0 -72 Z" fill={palette.accent} opacity={0.12} />
            <path d="M 0 0 V -72" stroke={palette.accent} strokeWidth={1} />
          </g>}
          {showRays && <g stroke={palette.accent} strokeWidth={0.35} opacity={0.25}>
            {points.map((point, i) => <line key={i} data-ray x1={0} y1={0} x2={point.x} y2={point.y} />)}
          </g>}
          {points.map((point, i) => <circle key={i} data-return cx={point.x} cy={point.y} r={1.5} fill={palette.accent} />)}
          <circle r={5} {...robotSurface("shell", variant, palette)} />
          <path d="M -2 -1 L 0 -4 L 2 -1" fill="none" stroke={palette.foreground} strokeWidth={0.8} />
        </g>
      </g>
      <g fill={palette.foreground} fontFamily="ui-monospace, monospace" fontSize={4} textAnchor="middle">
        <text x={90} y={9}>0°</text><text x={173} y={91}>90°</text>
        <text x={7} y={91}>270°</text><text x={90} y={174}>{label ?? `RANGE ${range}`}</text>
      </g>
    </svg>
  )
}

export { LidarScan }
