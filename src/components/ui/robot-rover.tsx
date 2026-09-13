"use client"

import * as React from "react"

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

export interface RobotRoverProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Clockwise degrees from the top of the drawing. */
  heading?: number
  /** Front-wheel steering in degrees, clamped to -45..45. */
  steering?: number
  wheels?: 4 | 6
  /** Controlled tread travel. Whole turns produce the same drawing. */
  wheelTravel?: number
  showSensor?: boolean
  active?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotRover({
  heading = 0, steering = 0, wheels = 4, wheelTravel = 0,
  showSensor = true, active = false, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, ...props
}: RobotRoverProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const angle = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0
  const steer = Number.isFinite(steering) ? Math.max(-45, Math.min(45, steering)) : 0
  const travel = Number.isFinite(wheelTravel) ? ((wheelTravel % 1) + 1) % 1 : 0
  const axles = wheels === 6 ? [-32, 0, 32] : [-32, 32]
  const wheelClip = `rover-wheel-${React.useId().replace(/:/g, "")}`
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  return (
    <svg role="img" aria-label={`${axles.length * 2}-wheel robot rover, heading ${Math.round(angle)} degrees`}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", className)} style={{ color: palette.foreground, ...style }} {...props}>
      <defs><clipPath id={wheelClip}><rect x={-8} y={-16} width={16} height={32} rx={4} /></clipPath></defs>
      {variant === "blueprint" && <g stroke={palette.grid} strokeWidth={0.5} opacity={0.5}>
        <circle cx={90} cy={90} r={72} fill="none" strokeDasharray="2 3" />
        <path d="M 90 12 V 168 M 12 90 H 168" strokeDasharray="2 3" />
      </g>}
      <g data-chassis transform={`translate(90 90) rotate(${px(angle)})`}>
        {axles.map((y, axle) => <g key={y}>
          <rect x={-43} y={y - 3} width={86} height={6} rx={2} {...machined} />
          {[-1, 1].map(side => <g key={side} data-wheel={`${axle}-${side}`}
            data-steering={axle === 0 ? steer : 0}
            transform={`translate(${side * 43} ${y}) rotate(${axle === 0 ? px(steer) : 0})`}>
            <rect x={-8} y={-16} width={16} height={32} rx={4} {...cast} />
            <g clipPath={`url(#${wheelClip})`}>
              <g data-tread transform={`translate(0 ${px(travel * 6)})`} stroke={palette.metal} strokeWidth={1} opacity={0.65}>
                {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M -6 ${i * 6 - 21} h 12`} />)}
              </g>
            </g>
          </g>)}
        </g>)}
        <rect x={-30} y={-48} width={60} height={96} rx={12} {...shell} />
        <rect x={-23} y={-40} width={46} height={13} rx={4} {...cast} />
        {[-17, 17].map(x => <rect key={x} x={x - 4} y={-37} width={8} height={4} rx={1} fill={active ? palette.accent : palette.metal} />)}
        <rect x={-22} y={-15} width={44} height={42} rx={5} {...machined} />
        {[-13, -6, 1, 8].map(y => <path key={y} d={`M -13 ${y + 10} h 26`} stroke={palette.dark} strokeWidth={2} />)}
        {showSensor && <g>
          <circle cy={-11} r={13} {...cast} />
          <circle cy={-11} r={9} {...shell} />
          <circle cy={-11} r={4} fill={palette.accent} />
          <path d="M 0 -13 v -7" stroke={palette.dark} strokeWidth={1.5} />
        </g>}
        <path d="M -7 -22 L 0 -27 L 7 -22" fill="none" stroke={palette.accent} strokeWidth={1.5} />
        <rect x={-21} y={37} width={42} height={5} rx={2} {...cast} />
        {[-24, 24].flatMap(x => [-23, 31].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={palette.dark} />))}
      </g>
      {label && <text x={90} y={176} textAnchor="middle" fontSize={5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { RobotRover }
