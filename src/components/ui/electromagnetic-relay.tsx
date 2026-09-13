"use client"

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { coilWinding } from "@/lib/robocn/electromagnetism"
import { clamp } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type ElectromagneticRelayBehavior = "switch" | "pulse" | "static"

export interface ElectromagneticRelayProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  energized?: number
  onEnergizedChange?: (energized: number) => void
  poles?: 1 | 2
  normally?: "open" | "closed"
  behavior?: ElectromagneticRelayBehavior
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  showField?: boolean
  label?: string
  view?: RobotView
  size?: RobotSize | number
  variant?: RobotVariant
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view",
}
const coil = coilWinding({ turns: 8, length: 54, radius: 10, samplesPerTurn: 4, axis: "y" })
const coilPath = coil.map((point, index) => `${index ? "L" : "M"} ${px(62 + point.x)} ${px(83 + point.y)}`).join(" ")

function ElectromagneticRelay({
  energized,
  onEnergizedChange,
  poles = 1,
  normally = "open",
  behavior = "switch",
  speed = 0.45,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  showField = true,
  label,
  view = "profile",
  size = "md",
  variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props
}: ElectromagneticRelayProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = energized !== undefined
  const hold = controlled ? (Number.isFinite(energized) ? clamp(energized, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => electromagneticRelayGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, { hold, rate: 3, speed, phase, paused, animate: animate && !controlled && behavior !== "static" })
  const value = clamp(motion.value, 0, 1)
  const apply = React.useCallback((next: number) => {
    const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
    setHeld(bounded)
    onEnergizedChange?.(bounded)
  }, [onEnergizedChange, setHeld])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })
  const closed = normally === "closed" ? value < 0.5 : value >= 0.5
  const angle = -17 + value * 17
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const camera = robotCamera(view)
  const face = aboutPoint(camera.wall(0, 90), 120, 112, view === "plan" ? 0.94 : 1)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={ariaLabel ?? `Electromagnetic relay, ${Math.round(value * 100)} percent energized, ${viewNames[view]}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(value) : undefined}
      aria-valuetext={interactive ? `${Math.round(value * 100)} percent energized` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.15)
        if (delta) apply(value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else if (event.key === " " || event.key === "Enter") apply(value < 0.5 ? 1 : 0)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }}
      viewBox="0 0 240 170"
      width={width}
      height={px(width * 170 / 240)}
      className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && <path d="M 13 139 H 227 M 120 16 V 148" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
      <g data-view={view} transform={face || undefined}>
        <rect x={20} y={28} width={200} height={112} rx={9} {...shell} opacity={view === "plan" ? 0.35 : 1} />
        <rect x={34} y={43} width={61} height={81} rx={5} {...cast} />
        <path data-coil d={coilPath} fill="none" stroke={palette.shell} strokeWidth={4} strokeLinecap="round" />
        <path d="M 50 127 V 145 M 76 127 V 145" stroke={palette.accent} strokeWidth={2.5} />
        <circle cx={111} cy={96} r={8} {...cast} />
        <g data-armature transform={`rotate(${px(angle)} 111 96)`}>
          <rect x={104} y={88} width={88} height={13} rx={5} {...machined} />
          <path d="M 112 88 L 94 73" stroke={palette.metal} strokeWidth={3} />
          <circle cx={191} cy={94.5} r={5} fill={palette.accent} />
        </g>
        <path data-spring d={`M 112 107 C 120 ${120 - value * 7}, 132 ${120 - value * 7}, 140 108`} fill="none" stroke={palette.metal} strokeWidth={2.2} />
        {Array.from({ length: poles }, (_, index) => {
          const y = 58 + index * 42
          const targetY = closed ? y + 7 : y
          return (
            <g key={index} data-contact={index} data-closed={closed}>
              <path d={`M 171 ${y} H 205`} stroke={palette.dark} strokeWidth={4} strokeLinecap="round" />
              <path d={`M 145 ${y + 13} L 187 ${targetY}`} stroke={closed ? palette.accent : palette.metal} strokeWidth={3} strokeLinecap="round" />
              <circle cx={187} cy={targetY} r={4} {...cast} />
              <path d={`M 205 ${y} V ${y - 13}`} stroke={palette.accent} strokeWidth={2} />
            </g>
          )
        })}
        {showField && value > 0.03 && <g data-field fill="none" stroke={palette.glow} opacity={0.25 + value * 0.55}><path d="M 27 84 C 27 17 103 17 103 84 S 27 151 27 84" /><path d="M 39 84 C 39 32 92 32 92 84 S 39 136 39 84" /></g>}
      </g>
      {label && <text x={120} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export function electromagneticRelayGoal(behavior: ElectromagneticRelayBehavior, clock: number) {
  if (behavior === "static") return 0
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  if (behavior === "pulse") return t < 0.2 ? t / 0.2 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
  return t < 0.45 ? 0 : t < 0.55 ? (t - 0.45) * 10 : t < 0.9 ? 1 : 1 - (t - 0.9) * 10
}

export { ElectromagneticRelay }
