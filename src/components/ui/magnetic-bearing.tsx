"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MagneticBearingBehavior = "balance" | "disturb" | "static"
export interface MagneticBearingProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  offset?: number; onOffsetChange?: (offset: number) => void; axis?: "x" | "y"
  behavior?: MagneticBearingBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean
  interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant
}
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }

function MagneticBearing({ offset, onOffsetChange, axis = "x", behavior = "balance", speed = 0.7, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "front", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: MagneticBearingProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size)
  const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = offset !== undefined
  const hold = controlled ? (Number.isFinite(offset) ? clamp(offset, -1, 1) : 0) : held
  const goal = React.useCallback((clock: number) => magneticBearingGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 3, speed, phase, paused, animate: animate && !controlled && behavior !== "static" }); const value = clamp(motion.value, -1, 1)
  const apply = React.useCallback((next: number) => { const bounded = Math.round(clamp(next, -1, 1) * 100) / 100; setHeld(bounded); onOffsetChange?.(bounded) }, [onOffsetChange])
  const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply(axis === "x" ? (unit.x - 0.5) * 2.4 : (unit.y - 0.5) * 2.4), [apply, axis]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const face = aboutPoint(robotCamera(view).wall(), 110, 100, view === "profile" ? 0.92 : 1)
  const dx = axis === "x" ? value * 12 : 0; const dy = axis === "y" ? value * 12 : 0
  const left = axis === "x" ? 0.3 + (value + 1) * 0.35 : 0.5; const right = axis === "x" ? 1 - value * 0.35 : 0.5; const top = axis === "y" ? 0.65 + value * 0.35 : 0.5; const bottom = axis === "y" ? 0.65 - value * 0.35 : 0.5
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Magnetic bearing, ${Math.round(value * 100)} percent ${axis} offset, ${names[view]}`} aria-valuemin={interactive ? -1 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent offset` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.1, 0.3); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 100 H 208 M 110 8 V 190" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <circle cx={110} cy={100} r={84} {...shell} /><circle cx={110} cy={100} r={65} {...cast} />
      {([[-1, 0, "left", left], [1, 0, "right", right], [0, -1, "top", top], [0, 1, "bottom", bottom]] as const).map(([x, y, side, opacity]) => <g key={side} data-coil={side} opacity={px(opacity)} transform={`translate(${110 + x * 57} ${100 + y * 57}) rotate(${x ? x * 90 : y > 0 ? 180 : 0})`}><path d="M -17 -13 H 17 L 12 19 H -12 Z" {...machined} /><path d="M -12 -7 H 12 M -13 0 H 13 M -14 7 H 14" stroke={palette.accent} strokeWidth={2} /></g>)}
      {([[-1, 0], [1, 0], [0, -1], [0, 1]] as const).map(([x, y], index) => <path key={index} data-gap={index} d={`M ${110 + x * 40} ${100 + y * 40} L ${110 + x * 49} ${100 + y * 49}`} stroke={palette.grid} strokeWidth={2} strokeDasharray="2 2" />)}
      <g data-rotor transform={`translate(${px(dx)} ${px(dy)})`}><circle cx={110} cy={100} r={34} {...machined} /><circle cx={110} cy={100} r={20} {...cast} /><circle cx={110} cy={100} r={8} {...shell} /><path d="M 110 67 V 79" stroke={palette.accent} strokeWidth={3} /></g>
      <path data-axis={axis} d={axis === "x" ? "M 72 100 H 148" : "M 110 62 V 138"} stroke={palette.grid} strokeWidth={0.8} strokeDasharray="3 3" />
      {showField && <g data-field fill="none" stroke={palette.glow} opacity={0.5}><circle cx={110} cy={100} r={43} strokeDasharray="4 4" /><circle cx={110} cy={100} r={51} strokeDasharray="2 5" /></g>}
    </g>{label && <text x={110} y={197} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function magneticBearingGoal(behavior: MagneticBearingBehavior, clock: number) { if (behavior === "static") return 0; const t = Number.isFinite(clock) ? clock : 0; return behavior === "disturb" ? Math.sin(t * Math.PI * 2) * 0.82 : Math.sin(t * Math.PI * 4) * 0.08 + Math.sin(t * Math.PI * 7) * 0.03 }
export { MagneticBearing }
