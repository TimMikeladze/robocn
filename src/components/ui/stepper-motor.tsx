"use client"

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
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

export type StepperMotorBehavior = "step" | "run" | "static"

export interface StepperMotorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  step?: number
  onStepChange?: (step: number) => void
  steps?: 4 | 6 | 8 | 12
  detent?: boolean
  behavior?: StepperMotorBehavior
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

const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }
const wrapStep = (value: number, count: number) => ((Math.round(value) % count) + count) % count

function StepperMotor({
  step, onStepChange, steps = 8, detent = true, behavior = "step", speed = 1,
  phase = 0, paused = false, animate = true, interactive = false, showField = true,
  label, view = "front", size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props
}: StepperMotorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const ref = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = step !== undefined
  const hold = controlled ? (Number.isFinite(step) ? wrapStep(step, steps) : 0) : held
  const goal = React.useCallback((clock: number) => stepperMotorGoal(behavior, clock, steps), [behavior, steps])
  const motion = useRobotScalar(goal, { hold, rate: 20, speed, phase, paused, animate: animate && !controlled && behavior !== "static" })
  const index = wrapStep(motion.value, steps)
  const rotation = index * 360 / steps
  const apply = React.useCallback((next: number) => {
    const wrapped = wrapStep(next, steps)
    setHeld(wrapped)
    onStepChange?.(wrapped)
  }, [onStepChange, steps])
  const dragging = useRobotDrag(ref, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => apply(Math.atan2(unit.y * 200 - 100, unit.x * 220 - 110) * steps / (Math.PI * 2)), [apply, steps]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const face = aboutPoint(robotCamera(view).wall(), 110, 100, view === "profile" ? 0.92 : 1)
  const phaseActive = index % 4

  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Stepper motor, step ${index} of ${steps}, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? steps - 1 : undefined} aria-valuenow={interactive ? index : undefined} aria-valuetext={interactive ? `step ${index} of ${steps}` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 1, 2); if (delta) apply(index + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(steps - 1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 100 H 208 M 110 8 V 190" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <rect x={24} y={15} width={172} height={170} rx={13} {...shell} />
      {[0, 1, 2, 3].map((phaseIndex) => {
        const degrees = phaseIndex * 90
        return <g key={phaseIndex} data-phase={phaseIndex} transform={`rotate(${degrees} 110 100)`}><path d="M 93 24 H 127 L 121 62 H 99 Z" {...(phaseIndex === phaseActive ? machined : cast)} /><path d="M 101 30 H 119 M 100 38 H 120 M 99 46 H 121" stroke={phaseIndex === phaseActive ? palette.accent : palette.metal} strokeWidth={2} /></g>
      })}
      <circle cx={110} cy={100} r={56} {...cast} />
      {showField && <circle cx={110} cy={100} r={62} fill="none" stroke={palette.glow} strokeWidth={2} strokeDasharray="5 5" opacity={0.5} transform={`rotate(${phaseActive * 90} 110 100)`} />}
      <g data-rotor transform={`rotate(${px(rotation)} 110 100)`}>
        <path d={Array.from({ length: steps }, (_, tooth) => { const a = tooth * Math.PI * 2 / steps; const b = a + Math.PI / steps * 0.42; const r0 = 35; const r1 = 48; const x0 = 110 + Math.cos(a) * r0; const y0 = 100 + Math.sin(a) * r0; const x1 = 110 + Math.cos(a) * r1; const y1 = 100 + Math.sin(a) * r1; const x2 = 110 + Math.cos(b) * r1; const y2 = 100 + Math.sin(b) * r1; const x3 = 110 + Math.cos(b) * r0; const y3 = 100 + Math.sin(b) * r0; return `M ${px(x0)} ${px(y0)} L ${px(x1)} ${px(y1)} L ${px(x2)} ${px(y2)} L ${px(x3)} ${px(y3)} Z` }).join(" ")} {...machined} />
        <circle cx={110} cy={100} r={35} {...machined} />
        <path d="M 110 65 L 119 82 H 101 Z" fill={palette.accent} />
        <circle cx={110} cy={100} r={12} {...shell} />
        {Array.from({ length: steps }, (_, tooth) => <circle key={tooth} data-tooth={tooth} cx={110} cy={52} r={1.2} fill={palette.dark} transform={`rotate(${tooth * 360 / steps} 110 100)`} />)}
      </g>
      {detent && <g fill={palette.accent} opacity={0.6}>{Array.from({ length: steps }, (_, tooth) => <circle key={tooth} cx={110} cy={169} r={1.8} transform={`rotate(${tooth * 360 / steps} 110 100)`} />)}</g>}
      <g data-index data-step={index}><path d="M 106 8 H 114 L 110 19 Z" fill={palette.accent} /></g>
    </g>
    {label && <text x={110} y={198} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}

export function stepperMotorGoal(behavior: StepperMotorBehavior, clock: number, steps: number) {
  if (behavior === "static") return 0
  const count = Math.max(1, Math.round(Number.isFinite(steps) ? steps : 8))
  const safe = Number.isFinite(clock) ? clock : 0
  const t = ((safe % 1) + 1) % 1
  if (behavior === "step") return Math.floor(t * count)
  return Math.floor(Math.max(0, safe) * count) % count
}

export { StepperMotor }
