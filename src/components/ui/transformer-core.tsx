"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type TransformerBehavior = "alternate" | "pulse" | "static"
export type TransformerCoreShape = "ei" | "toroid"
export type TransformerTurns = "step-down" | "equal" | "step-up"
export interface TransformerCoreProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps { phase?: number; onPhaseChange?: (phase: number) => void; core?: TransformerCoreShape; turns?: TransformerTurns; behavior?: TransformerBehavior; speed?: number; paused?: boolean; animate?: boolean; interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant }
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }
const wrap = (value: number) => ((value % 1) + 1) % 1

function TransformerCore({ phase, onPhaseChange, core = "ei", turns = "equal", behavior = "alternate", speed = 0.4, paused = false, animate = true, interactive = false, showField = true, label, view = "iso", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: TransformerCoreProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size); const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = phase !== undefined
  const hold = controlled ? (Number.isFinite(phase) ? wrap(phase) : 0) : held; const goal = React.useCallback((clock: number) => transformerGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 3, speed, phase: 0, paused, animate: animate && !controlled && behavior !== "static" }); const value = wrap(motion.value); const amplitude = Math.cos(value * Math.PI * 2); const direction = amplitude >= 0 ? "forward" : "reverse"
  const apply = React.useCallback((next: number) => { const bounded = Math.round(wrap(next) * 100) / 100; setHeld(bounded); onPhaseChange?.(bounded) }, [onPhaseChange]); const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply(unit.x), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const camera = robotCamera(view); const face = aboutPoint(camera.wall(), 120, 92, view === "profile" ? 0.92 : 1)
  const primaryCount = turns === "step-down" ? 12 : turns === "step-up" ? 6 : 9; const secondaryCount = turns === "step-up" ? 12 : turns === "step-down" ? 6 : 9
  const winding = (x: number, count: number, side: "primary" | "secondary") => <g data-primary={side === "primary" || undefined} data-secondary={side === "secondary" || undefined}>{Array.from({ length: count }, (_, index) => { const y = 47 + index * 88 / Math.max(1, count - 1); return <path key={index} data-turn={index} d={`M ${x - 12} ${px(y)} Q ${x} ${px(y - 6)} ${x + 12} ${px(y)}`} fill="none" stroke={side === "primary" ? palette.accent : palette.shell} strokeWidth={2.6} /> })}</g>
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Transformer core, ${Math.round(value * 100)} percent phase, ${turns}, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent electrical phase` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.05, 0.15); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 240 190" width={width} height={px(width * 190 / 240)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 92 H 228 M 120 8 V 174" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      {core === "ei" ? <g data-core="ei"><path d="M 43 25 H 197 V 49 H 68 V 137 H 197 V 161 H 43 Z" {...cast} /><rect x={107} y={48} width={26} height={90} {...machined} />{winding(82, primaryCount, "primary")}{winding(158, secondaryCount, "secondary")}</g> : <g data-core="toroid"><circle cx={120} cy={93} r={67} {...cast} /><circle cx={120} cy={93} r={36} fill={palette.foreground} opacity={variant === "solid" ? 0.08 : 0} />{winding(77, primaryCount, "primary")}{winding(163, secondaryCount, "secondary")}</g>}
      {showField && <g data-flux data-phase={px(value)} data-direction={direction} fill="none" stroke={palette.glow} opacity={0.25 + Math.abs(amplitude) * 0.65}><path d={direction === "forward" ? "M 73 65 H 120 V 39 H 176 M 168 33 L 176 39 L 168 45 M 176 121 H 120 V 147 H 73" : "M 176 65 H 120 V 39 H 73 M 81 33 L 73 39 L 81 45 M 73 121 H 120 V 147 H 176"} strokeWidth={2.5} strokeDasharray="6 4" /></g>}
      <path d="M 72 169 V 181 M 88 169 V 181 M 152 169 V 181 M 168 169 V 181" stroke={palette.metal} strokeWidth={3} />
      <circle cx={120} cy={93} r={5} fill={amplitude >= 0 ? palette.accent : palette.shell} />
    </g>{label && <text x={120} y={187} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function transformerGoal(behavior: TransformerBehavior, clock: number) { if (behavior === "static") return 0; const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0; return behavior === "pulse" ? (t < 0.5 ? 0 : 0.5) : t }
export { TransformerCore }
