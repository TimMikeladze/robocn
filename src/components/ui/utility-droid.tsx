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

export type UtilityDroidSeries = "workshop" | "navigator" | "rescue"
export type UtilityDroidTool = "none" | "interface" | "gripper" | "scanner"
export type UtilityDroidLegMode = "two" | "three"
export type DroidSignal = "idle" | "ready" | "warning"

export interface UtilityDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  series?: UtilityDroidSeries
  dome?: "round" | "flat" | "faceted"
  legMode?: UtilityDroidLegMode
  headAngle?: number
  tool?: UtilityDroidTool
  toolExtension?: number
  signal?: DroidSignal
  showGround?: boolean
  label?: string
}

function UtilityDroid({
  size = "md",
  variant = "solid",
  series = "workshop",
  dome = "faceted",
  legMode = "three",
  headAngle = 0,
  tool = "interface",
  toolExtension = 0,
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
}: UtilityDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const angle = finiteClamp(headAngle, -150, 150)
  const extension = finiteClamp(toolExtension, 0, 1)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const legs = legMode === "three" ? [-1, 0, 1] : [-1, 1]

  return (
    <svg
      role="img"
      aria-label={`Utility droid, ${series} series, ${legMode}-leg chassis`}
      viewBox="0 0 180 220"
      width={width}
      height={px(width * 1.22)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g stroke={palette.grid} strokeWidth={0.55} opacity={0.45} fill="none">
          <path d="M 18 196 H 162 M 90 18 V 204" strokeDasharray="2 3" />
          <circle cx={90} cy={105} r={72} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={90} cy={195} rx={62} ry={7} fill={palette.dark} opacity={0.13} />}

      <g transform="translate(90 190)">
        {legs.map((side, index) => {
          const center = side === 0
          const x = center ? 0 : side * 36
          const lean = center ? 0 : side * 12
          return (
            <g key={`${side}-${index}`} data-leg={center ? "center" : side < 0 ? "left" : "right"}>
              <path d={`M ${x + lean * 0.3} -53 L ${x + lean} -10`} stroke={palette.dark} strokeWidth={11} strokeLinecap="round" />
              <path d={`M ${x + lean * 0.3} -53 L ${x + lean} -10`} stroke={palette.metal} strokeWidth={6.5} strokeLinecap="round" />
              <circle cx={x + lean * 0.3} cy={-53} r={6} {...cast} />
              <path d={`M ${x + lean - 14} -8 H ${x + lean + 14} L ${x + lean + 18} -2 H ${x + lean - 17} Z`} {...shell} />
              <circle cx={x + lean} cy={-3} r={3.4} {...machined} />
            </g>
          )
        })}

        <g data-body>
          <path d="M -40 -132 Q -42 -87 -33 -45 Q 0 -34 33 -45 Q 42 -87 40 -132 Z" {...shell} />
          <path d="M -40 -116 H 40 M -38 -72 H 38" stroke={palette.dark} strokeWidth={1.2} opacity={0.7} />
          <rect x={-29} y={-107} width={58} height={29} rx={4} {...machined} />
          {series === "workshop" && (
            <g data-series="workshop">
              {[-18, -6, 6, 18].map((x) => <rect key={x} x={x - 3} y={-100} width={6} height={15} rx={1.5} {...cast} />)}
            </g>
          )}
          {series === "navigator" && (
            <g data-series="navigator">
              <circle cx={0} cy={-93} r={10} {...cast} />
              <path d="M -20 -83 H 20" stroke={palette.accent} strokeWidth={2} strokeDasharray="3 3" />
            </g>
          )}
          {series === "rescue" && (
            <g data-series="rescue">
              <path d="M -6 -104 H 6 V -98 H 12 V -86 H 6 V -80 H -6 V -86 H -12 V -98 H -6 Z" fill={palette.accent} opacity={variant === "wire" ? 0 : 0.85} />
            </g>
          )}
          <circle cx={-27} cy={-59} r={4} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
          <circle cx={-16} cy={-59} r={3} {...machined} />
          <rect x={5} y={-64} width={24} height={10} rx={2} {...cast} />
        </g>

        <g
          data-dome
          data-dome-shape={dome}
          transform={`translate(0 -132) rotate(${px(angle * 0.12)})`}
        >
          {dome === "round" ? (
            <path d="M -40 0 A 40 37 0 0 1 40 0 Z" {...shell} />
          ) : dome === "flat" ? (
            <path d="M -39 0 L -29 -27 H 29 L 39 0 Z" {...shell} />
          ) : (
            <path d="M -40 0 L -31 -24 L -15 -36 H 18 L 34 -20 L 40 0 Z" {...shell} />
          )}
          <path d="M -39 0 H 39" stroke={palette.dark} strokeWidth={2} />
          <g transform={`translate(${px(angle * 0.17)} 0)`}>
            <rect x={-10} y={-24} width={20} height={12} rx={3} {...cast} />
            <circle cx={0} cy={-18} r={4.2} fill={palette.accent} />
            <circle cx={1.4} cy={-19.4} r={1.2} fill={palette.metal} />
          </g>
          <path d="M 21 -9 V -37" stroke={palette.dark} strokeWidth={1.7} />
          <circle cx={21} cy={-39} r={2.4} fill={signalColor} />
        </g>

        {tool !== "none" && (
          <g
            data-tool={tool}
            transform={`translate(${px(37 + extension * 22)} -91)`}
          >
            <path d={`M ${px(-extension * 22)} 0 H 0`} stroke={palette.dark} strokeWidth={7} strokeLinecap="round" />
            <path d={`M ${px(-extension * 22)} 0 H 0`} stroke={palette.metal} strokeWidth={3.5} strokeLinecap="round" />
            {tool === "interface" && <rect x={0} y={-8} width={7} height={16} rx={2} {...cast} />}
            {tool === "scanner" && <path d="M 0 -8 L 13 -5 V 5 L 0 8 Z" {...machined} />}
            {tool === "gripper" && (
              <g>
                <circle r={5} {...cast} />
                <path d="M 4 -2 L 13 -8 M 4 2 L 13 8" stroke={palette.accent} strokeWidth={2.5} strokeLinecap="round" />
              </g>
            )}
          </g>
        )}
      </g>
      {label && <text x={90} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { UtilityDroid }
