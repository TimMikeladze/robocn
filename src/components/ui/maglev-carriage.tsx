"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MaglevCarriageBehavior = "shuttle" | "hover" | "static"
export type MaglevPayload = "deck" | "bin" | "robot"
export interface MaglevCarriageProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  travel?: number; onTravelChange?: (travel: number) => void; payload?: MaglevPayload
  behavior?: MaglevCarriageBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean; interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant
}
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }

function MaglevCarriage({ travel, onTravelChange, payload = "deck", behavior = "shuttle", speed = 0.3, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "profile", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: MaglevCarriageProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size); const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = travel !== undefined
  const hold = controlled ? (Number.isFinite(travel) ? clamp(travel, 0, 1) : 0.5) : held; const goal = React.useCallback((clock: number) => maglevCarriageGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 1.8, speed, phase, paused, animate: animate && !controlled && behavior !== "static" }); const value = clamp(motion.value, 0, 1)
  const apply = React.useCallback((next: number) => { const bounded = Math.round(clamp(next, 0, 1) * 100) / 100; setHeld(bounded); onTravelChange?.(bounded) }, [onTravelChange]); const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply((unit.x - 0.1) / 0.8), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const face = aboutPoint(robotCamera(view).wall(0, 90), 130, 115, view === "plan" ? 0.94 : 1); const x = 45 + value * 170
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Maglev carriage, ${Math.round(value * 100)} percent travel, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent travel` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.05, 0.15); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 260 180" width={width} height={px(width * 180 / 260)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 145 H 248 M 130 12 V 164" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <g data-track><rect x={15} y={119} width={230} height={31} rx={7} {...cast} />{Array.from({ length: 14 }, (_, index) => <rect key={index} data-stator={index} x={25 + index * 16} y={125} width={11} height={18} rx={2} {...(Math.abs(25 + index * 16 - x) < 32 ? shell : machined)} />)}<path d="M 20 153 H 240" stroke={palette.metal} strokeWidth={5} /></g>
      <g data-air-gap><path d="M 25 110 H 235" stroke={palette.grid} strokeWidth={2} strokeDasharray="3 4" /><path d="M 25 115 H 235" stroke={palette.grid} strokeWidth={0.8} /></g>
      <g data-carriage transform={`translate(${px(x - 130)} 0)`}><path d="M 86 82 H 174 L 164 108 H 96 Z" {...shell} /><rect x={96} y={102} width={68} height={9} rx={4} {...machined} />{showField && <g data-field fill="none" stroke={palette.glow} opacity={0.6}><path d="M 103 112 q 8 12 16 0 M 121 112 q 8 12 16 0 M 139 112 q 8 12 16 0" /></g>}{payload === "bin" && <path data-payload="bin" d="M 104 48 H 156 L 150 82 H 110 Z" {...cast} />}{payload === "robot" && <g data-payload="robot"><rect x={116} y={45} width={28} height={37} rx={7} {...cast} /><circle cx={130} cy={39} r={13} {...shell} /><circle cx={135} cy={37} r={3} fill={palette.accent} /></g>}{payload === "deck" && <rect data-payload="deck" x={95} y={72} width={70} height={10} rx={4} {...machined} />}</g>
    </g>{label && <text x={130} y={175} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function maglevCarriageGoal(behavior: MaglevCarriageBehavior, clock: number) { if (behavior === "static") return 0.5; const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0; return behavior === "hover" ? 0.5 + Math.sin(t * Math.PI * 2) * 0.08 : 0.5 - 0.5 * Math.cos(t * Math.PI * 2) }
export { MaglevCarriage }
