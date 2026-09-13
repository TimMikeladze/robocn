"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type VoiceCoilBehavior = "oscillate" | "pulse" | "static"
export interface VoiceCoilActuatorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  position?: number; onPositionChange?: (position: number) => void; travel?: number
  behavior?: VoiceCoilBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean
  interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant
}
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }

function VoiceCoilActuator({ position, onPositionChange, travel = 42, behavior = "oscillate", speed = 0.5, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "profile", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: VoiceCoilActuatorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const ref = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = position !== undefined
  const hold = controlled ? (Number.isFinite(position) ? clamp(position, -1, 1) : 0) : held
  const goal = React.useCallback((clock: number) => voiceCoilGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, { hold, rate: 4, speed, phase, paused, animate: animate && !controlled && behavior !== "static" })
  const value = clamp(motion.value, -1, 1)
  const span = Number.isFinite(travel) ? clamp(travel, 20, 60) : 42
  const shift = px(value * span / 2)
  const transform = `translate(${shift} 0)`
  const apply = React.useCallback((next: number) => { const bounded = Math.round(clamp(next, -1, 1) * 100) / 100; setHeld(bounded); onPositionChange?.(bounded) }, [onPositionChange])
  const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply((unit.x - 0.5) * 2.5), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette)
  const face = aboutPoint(robotCamera(view).wall(0, 90), 120, 90, view === "plan" ? 0.94 : 1)
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Voice-coil actuator, ${Math.round(value * 100)} percent, ${names[view]}`} aria-valuemin={interactive ? -1 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.1, 0.3); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 240 180" width={width} height={px(width * 0.75)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 90 H 228 M 120 20 V 156" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <path d="M 24 46 H 83 V 62 H 175 V 46 H 216 V 134 H 175 V 118 H 83 V 134 H 24 Z" {...shell} />
      <g data-gap><rect x={77} y={64} width={104} height={52} rx={5} {...cast} /><rect x={89} y={72} width={80} height={36} rx={4} fill={palette.foreground} opacity={variant === "solid" ? 0.08 : 0} /></g>
      <path data-magnet d="M 30 54 H 76 V 126 H 30 Z M 182 54 H 210 V 126 H 182 Z" {...machined} />
      <g data-carriage transform={transform}><rect x={102} y={35} width={36} height={110} rx={7} {...shell} /><path d="M 120 24 V 156" stroke={palette.metal} strokeWidth={8} strokeLinecap="round" /><circle cx={120} cy={24} r={8} {...cast} /><circle cx={120} cy={156} r={8} {...cast} /></g>
      <g data-coil transform={transform}><path d="M 95 69 H 145 M 94 76 H 146 M 93 83 H 147 M 93 97 H 147 M 94 104 H 146 M 95 111 H 145" stroke={palette.accent} strokeWidth={3} strokeLinecap="round" /></g>
      {showField && <g data-field fill="none" stroke={palette.glow} opacity={0.45 + Math.abs(value) * 0.35}><path d="M 70 54 C 104 18 136 18 170 54" /><path d="M 70 126 C 104 162 136 162 170 126" /><path d="M 48 90 H 192" strokeDasharray="5 4" /></g>}
    </g>
    {label && <text x={120} y={176} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function voiceCoilGoal(behavior: VoiceCoilBehavior, clock: number) { if (behavior === "static") return 0; const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0; if (behavior === "pulse") return t < 0.2 ? t * 5 : t < 0.45 ? 1 : t < 0.65 ? 1 - (t - 0.45) * 10 : t < 0.85 ? -1 : -1 + (t - 0.85) / 0.15; return Math.sin(t * Math.PI * 2) }
export { VoiceCoilActuator }
