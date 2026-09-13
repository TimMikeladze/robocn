import type * as React from "react"

import { clamp } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPalette,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MedicalDroidTool = "none" | "scanner" | "injector" | "clamp" | "probe"

export interface MedicalDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  headAngle?: number
  leftTool?: MedicalDroidTool
  rightTool?: MedicalDroidTool
  diagnostic?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function ToolEnd({
  tool,
  side,
  palette,
  variant,
}: {
  tool: MedicalDroidTool
  side: -1 | 1
  palette: RobotPalette
  variant: RobotVariant
}) {
  if (tool === "none") return null
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  return (
    <g data-tool={tool}>
      {tool === "scanner" && (
        <g>
          <path d={`M 0 0 L ${side * 16} -8 L ${side * 19} 2 L ${side * 4} 9 Z`} {...machined} />
          <path d={`M ${side * 7} -1 L ${side * 15} -4`} stroke={palette.accent} strokeWidth={2} />
        </g>
      )}
      {tool === "injector" && (
        <g>
          <rect x={side < 0 ? -16 : 0} y={-5} width={16} height={10} rx={3} {...machined} />
          <path d={`M ${side * 16} 0 H ${side * 29}`} stroke={palette.accent} strokeWidth={1.4} />
        </g>
      )}
      {tool === "clamp" && (
        <g>
          <circle r={5} {...cast} />
          <path d={`M ${side * 3} -2 L ${side * 15} -10 M ${side * 3} 2 L ${side * 15} 10`} stroke={palette.accent} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )}
      {tool === "probe" && (
        <g>
          <path d={`M 0 0 H ${side * 24}`} stroke={palette.metal} strokeWidth={3} strokeLinecap="round" />
          <circle cx={side * 26} r={3} fill={palette.accent} />
        </g>
      )}
    </g>
  )
}

function MedicalDroid({
  size = "md",
  variant = "solid",
  headAngle = 0,
  leftTool = "scanner",
  rightTool = "probe",
  diagnostic = 0.65,
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
}: MedicalDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const turn = finiteClamp(headAngle, -60, 60)
  const level = finiteClamp(diagnostic, 0, 1)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  return (
    <svg
      role="img"
      aria-label={`Medical droid, diagnostic ${Math.round(level * 100)} percent`}
      viewBox="0 0 190 220"
      width={width}
      height={px(width * 1.16)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 13 197 H 177 M 95 12 V 204" strokeDasharray="2 3" />
          <circle cx={95} cy={106} r={76} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={95} cy={196} rx={50} ry={6} fill={palette.dark} opacity={0.14} />}
      <g transform="translate(95 190)">
        <path d="M -32 -76 L -39 -18 H 39 L 32 -76 Z" {...shell} />
        <rect x={-28} y={-67} width={56} height={39} rx={5} {...machined} />
        <rect x={-20} y={-58} width={40} height={13} rx={3} {...cast} />
        <rect data-diagnostic x={-17} y={-55} width={px(34 * level)} height={7} rx={2} fill={signalColor} />
        <path d="M -18 -37 H 18" stroke={palette.dark} strokeWidth={2} strokeDasharray="3 3" />
        <circle cx={-23} cy={-17} r={4} fill={signalColor} />
        <circle cx={23} cy={-17} r={4} {...cast} />
        <rect x={-23} y={-8} width={46} height={10} rx={4} {...cast} />
        <path d="M -17 2 L -26 12 H 26 L 17 2" {...machined} />

        {[-1, 1].map((side) => {
          const tool = side < 0 ? leftTool : rightTool
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"} transform={`translate(${side * 34} -65)`}>
              <circle r={7} {...cast} />
              <path d={`M ${side * 2} 3 L ${side * 20} 30`} stroke={palette.dark} strokeWidth={9} strokeLinecap="round" />
              <path d={`M ${side * 2} 3 L ${side * 20} 30`} stroke={palette.metal} strokeWidth={5} strokeLinecap="round" />
              <circle cx={side * 20} cy={30} r={6} {...cast} />
              <g transform={`translate(${side * 20} 30)`}>
                <ToolEnd tool={tool} side={side as -1 | 1} palette={palette} variant={variant} />
              </g>
            </g>
          )
        })}

        <rect x={-8} y={-103} width={16} height={28} rx={5} {...machined} />
        <g data-head transform={`translate(${px(turn * 0.13)} -120) rotate(${px(turn * 0.08)})`}>
          <path d="M -29 -22 H 29 V 18 Q 0 27 -29 18 Z" {...shell} />
          <rect x={-22} y={-14} width={44} height={19} rx={5} {...cast} />
          <circle cx={-10} cy={-5} r={6} fill={palette.accent} />
          <circle cx={-10} cy={-5} r={2.5} fill={palette.dark} />
          <path d="M 3 -10 H 17 M 3 -4 H 17 M 3 2 H 13" stroke={palette.metal} strokeWidth={2} />
          <path d="M -12 13 H 12" stroke={palette.dark} strokeWidth={2} />
        </g>
      </g>
      {label && <text x={95} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { MedicalDroid }
