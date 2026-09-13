"use client"

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { coilWinding } from "@/lib/robocn/electromagnetism"
import { clamp } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type SolenoidValveBehavior = "cycle" | "pulse" | "static"

export interface SolenoidValveProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  position?: number
  onPositionChange?: (position: number) => void
  ports?: 2 | 3
  normally?: "open" | "closed"
  behavior?: SolenoidValveBehavior
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
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const winding = coilWinding({ turns: 9, length: 64, radius: 12, samplesPerTurn: 5 })
const windingPath = winding.map((point, index) => `${index ? "L" : "M"} ${px(82 + point.x)} ${px(79 + point.y)}`).join(" ")

function SolenoidValve({
  position,
  onPositionChange,
  ports = 2,
  normally = "closed",
  behavior = "cycle",
  speed = 0.35,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  showField = true,
  label,
  view = "profile",
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: SolenoidValveProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = position !== undefined
  const supplied = controlled && Number.isFinite(position) ? clamp(position, 0, 1) : controlled ? 0 : held
  const goal = React.useCallback((clock: number) => solenoidValveGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    hold: supplied,
    rate: 2.5,
    speed,
    phase,
    paused,
    animate: animate && !controlled && behavior !== "static",
  })
  const value = clamp(motion.value, 0, 1)
  const apply = React.useCallback((next: number) => {
    const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
    setHeld(bounded)
    onPositionChange?.(bounded)
  }, [onPositionChange])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => apply((unit.x - 0.28) / 0.48), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })
  const open = normally === "open" ? value < 0.5 : value >= 0.5
  const shift = px(value * 42)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const camera = robotCamera(view)
  const face = aboutPoint(camera.wall(0, 90), 120, 105, view === "plan" ? 0.92 : 1)
  const springStart = 151 + value * 42
  const spring = Array.from({ length: 9 }, (_, index) => {
    const x = springStart + ((201 - springStart) * index) / 8
    const y = index === 0 || index === 8 ? 79 : 79 + (index % 2 ? -7 : 7)
    return `${index ? "L" : "M"} ${px(x)} ${y}`
  }).join(" ")

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={ariaLabel ?? `Solenoid valve, ${Math.round(value * 100)} percent, ${viewNames[view]}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(value) : undefined}
      aria-valuetext={interactive ? `${Math.round(value * 100)} percent` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.15)
        if (delta) apply(value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 240 160"
      width={width}
      height={px(width * 2 / 3)}
      className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && <path d="M 12 128 H 228 M 120 18 V 138" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
      {view !== "profile" && (
        <g transform="translate(120 116)" opacity={0.72}>
          <path d={extrudedPath(roundedFootprint(102, 17, 4), camera, 72, 0)} {...shell} />
        </g>
      )}
      <g data-view={view} transform={face || undefined}>
        <rect x={17} y={45} width={206} height={70} rx={9} {...shell} />
        <path d="M 28 58 H 210 M 28 101 H 210" stroke={palette.dark} strokeWidth={2} opacity={0.45} />
        <rect x={42} y={57} width={81} height={44} rx={5} {...cast} />
        <path data-coil d={windingPath} fill="none" stroke={palette.shell} strokeWidth={4} strokeLinecap="round" />
        <path d="M 40 108 V 124 H 126 V 108" fill="none" stroke={palette.metal} strokeWidth={3} />
        <path d="M 49 124 v 12 M 118 124 v 12" stroke={palette.accent} strokeWidth={2} />
        <g data-plunger transform={`translate(${shift} 0)`}>
          <rect x={106} y={70} width={45} height={18} rx={5} {...machined} />
          <path d="M 148 65 V 93" stroke={palette.dark} strokeWidth={5} strokeLinecap="round" />
        </g>
        <path data-spring d={spring} fill="none" stroke={palette.metal} strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={201} y={61} width={11} height={36} rx={3} {...cast} />
        {Array.from({ length: ports }, (_, index) => {
          const x = ports === 2 ? 152 + index * 38 : 143 + index * 29
          return <g key={x} data-port={index}><path d={`M ${x} 113 V 140`} stroke={palette.metal} strokeWidth={9} /><circle cx={x} cy={140} r={6} {...cast} /></g>
        })}
        <path
          data-flow
          data-open={open}
          d={open ? "M 151 132 V 106 Q 151 96 163 96 H 190 V 132" : "M 151 132 V 116 M 190 132 V 116"}
          fill="none"
          stroke={open ? palette.accent : palette.grid}
          strokeWidth={3}
          strokeDasharray={open ? "5 3" : undefined}
        />
        {showField && value > 0.03 && <g data-field fill="none" stroke={palette.glow} opacity={0.25 + value * 0.55} strokeWidth={1.5}><ellipse cx={83} cy={79} rx={50} ry={29} /><ellipse cx={83} cy={79} rx={59} ry={36} /></g>}
      </g>
      {label && <text x={120} y={155} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export function solenoidValveGoal(behavior: SolenoidValveBehavior, clock: number) {
  if (behavior === "static") return 0
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  if (behavior === "pulse") return t < 0.42 ? 0 : t < 0.52 ? (t - 0.42) * 10 : t < 0.84 ? 1 : 1 - (t - 0.84) / 0.16
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2)
}

export { SolenoidValve }
