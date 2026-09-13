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

export interface ProbeDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  hover?: number
  scanAngle?: number
  appendages?: number
  active?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function ProbeDroid({
  size = "md",
  variant = "solid",
  hover = 0.5,
  scanAngle = 0,
  appendages = 5,
  active = false,
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
}: ProbeDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const lift = finiteClamp(hover, 0, 1)
  const scan = finiteClamp(scanAngle, -65, 65)
  const armCount = Number.isFinite(appendages) ? Math.round(clamp(appendages, 3, 6)) : 5
  const y = 87 - lift * 18
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  return (
    <svg
      role="img"
      aria-label={`Probe droid, ${armCount} appendages, hover ${Math.round(lift * 100)} percent`}
      viewBox="0 0 200 220"
      width={width}
      height={px(width * 1.1)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 14 194 H 186 M 100 15 V 202" strokeDasharray="2 3" />
          <circle cx={100} cy={98} r={82} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={100} cy={193} rx={px(50 - lift * 8)} ry={px(7 - lift * 2)} fill={palette.dark} opacity={px(0.2 - lift * 0.07)} />}
      <g data-pod transform={`translate(100 ${px(y)})`}>
        {Array.from({ length: armCount }, (_, index) => {
          const spread = armCount === 1 ? 0 : -52 + (index * 104) / (armCount - 1)
          const side = spread < 0 ? -1 : 1
          const length = 55 + (index % 3) * 8
          return (
            <g key={index} data-appendage={index} transform={`translate(${px(spread * 0.55)} 31) rotate(${px(spread * 0.42)})`}>
              <path d={`M 0 0 Q ${side * 10} ${length * 0.42} ${side * 5} ${length}`} fill="none" stroke={palette.dark} strokeWidth={7} strokeLinecap="round" />
              <path d={`M 0 0 Q ${side * 10} ${length * 0.42} ${side * 5} ${length}`} fill="none" stroke={palette.metal} strokeWidth={3.5} strokeLinecap="round" />
              <circle cx={side * 5} cy={length} r={5} {...cast} />
              {index % 3 === 0 && <path d={`M ${side * 5} ${length + 4} l ${side * 8} 14 m -${side * 8} -14 l ${-side * 5} 15`} stroke={palette.accent} strokeWidth={2} strokeLinecap="round" />}
              {index % 3 === 1 && <path d={`M ${side * 5} ${length + 4} v 18`} stroke={palette.metal} strokeWidth={2.5} strokeLinecap="round" />}
              {index % 3 === 2 && <circle cx={side * 5} cy={length + 13} r={7} fill="none" stroke={palette.accent} strokeWidth={2} />}
            </g>
          )
        })}

        <path d="M -54 -10 Q -45 -42 0 -48 Q 45 -42 54 -10 L 42 30 Q 0 48 -42 30 Z" {...cast} />
        <path d="M -47 -9 Q -37 -33 0 -37 Q 37 -33 47 -9 L 36 20 Q 0 34 -36 20 Z" {...shell} />
        <ellipse cx={0} cy={-8} rx={43} ry={23} {...machined} />
        <g data-scanner transform={`rotate(${px(scan)} 0 -10)`}>
          <circle cx={0} cy={-10} r={15} {...cast} />
          <circle cx={0} cy={-10} r={9} fill={palette.accent} />
          <circle cx={2} cy={-12} r={3.5} fill={palette.dark} />
          <path d="M 0 -24 V -45" stroke={palette.dark} strokeWidth={2.5} />
          <path d="M -10 -46 Q 0 -53 10 -46" fill="none" stroke={palette.metal} strokeWidth={3} />
        </g>
        <circle cx={-31} cy={3} r={6} {...cast} />
        <circle cx={-31} cy={3} r={3} fill={signalColor} />
        <circle cx={31} cy={3} r={8} {...cast} />
        <circle cx={31} cy={3} r={4} fill={palette.metal} />
        {active && (
          <path
            data-scan
            d={`M ${px(scan * 0.2)} -17 L ${px(82 + scan * 0.25)} -48 L ${px(68 + scan * 0.2)} 12 Z`}
            fill={palette.glow}
            opacity={0.14}
            className="robocn-pulse"
          />
        )}
      </g>
      {label && <text x={100} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { ProbeDroid }
