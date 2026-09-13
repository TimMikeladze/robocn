"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type EddyCurrentBrakeBehavior = "brake" | "feather" | "static"
export interface EddyCurrentBrakeProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  engagement?: number; onEngagementChange?: (engagement: number) => void; discAngle?: number; slots?: 0 | 6 | 12
  behavior?: EddyCurrentBrakeBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean; interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant
}
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }
const wrap = (value: number) => ((value % 360) + 360) % 360

function EddyCurrentBrake({ engagement, onEngagementChange, discAngle, slots = 6, behavior = "brake", speed = 0.35, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "iso", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: EddyCurrentBrakeProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size); const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = engagement !== undefined
  const hold = controlled ? (Number.isFinite(engagement) ? clamp(engagement, 0, 1) : 0) : held; const goal = React.useCallback((clock: number) => eddyBrakeGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 2.5, speed, phase, paused, animate: animate && !controlled && behavior !== "static" }); const value = clamp(motion.value, 0, 1)
  const angle = Number.isFinite(discAngle) ? wrap(discAngle!) : wrap(motion.clock * 360 * (1 - value * 0.72)); const apply = React.useCallback((next: number) => { const bounded = Math.round(clamp(next, 0, 1) * 100) / 100; setHeld(bounded); onEngagementChange?.(bounded) }, [onEngagementChange]); const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply(unit.x), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const camera = robotCamera(view); const plane = aboutPoint(camera.plane(0), 110, 100, view === "profile" ? 0.9 : 1)
  const magnetShift = px((1 - value) * 68)
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Eddy-current brake, ${Math.round(value * 100)} percent engaged, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent engaged` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.05, 0.15); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 100 H 208 M 110 8 V 190" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={plane || undefined}>
      <path d="M 18 170 H 202" stroke={palette.dark} strokeWidth={8} /><rect x={100} y={100} width={20} height={75} rx={6} {...cast} />
      <g data-disc transform={`rotate(${px(angle)} 110 100)`}><circle cx={110} cy={100} r={65} {...machined} /><circle cx={110} cy={100} r={53} fill="none" stroke={palette.dark} strokeWidth={2} /><circle cx={110} cy={100} r={12} {...cast} />{Array.from({ length: slots }, (_, index) => <rect key={index} data-slot={index} x={107} y={42} width={6} height={18} rx={3} fill={palette.dark} transform={`rotate(${index * 360 / Math.max(1, slots)} 110 100)`} />)}</g>
      <g data-magnet transform={`translate(${magnetShift} 0)`}><path d="M 53 30 H 167 V 51 H 75 V 149 H 167 V 170 H 53 Z" {...shell} /><rect x={69} y={48} width={30} height={28} rx={4} {...cast} /><rect x={69} y={124} width={30} height={28} rx={4} {...cast} /><path d="M 75 55 H 93 M 75 63 H 93 M 75 137 H 93 M 75 145 H 93" stroke={palette.accent} strokeWidth={2} /></g>
      <path data-overlap data-engagement={px(value)} d={`M ${px(75 + (1 - value) * 68)} 83 V 117`} stroke={palette.glow} strokeWidth={4} strokeDasharray="3 3" />
      {showField && value > 0.08 && <g data-eddy fill="none" stroke={palette.glow} opacity={0.25 + value * 0.6}>{[-18, 0, 18].map(offset => <path key={offset} d={`M ${110 + offset} 70 c 14 8 14 20 0 28 c -14 8 -14 20 0 28`} />)}</g>}
    </g>{label && <text x={110} y={197} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function eddyBrakeGoal(behavior: EddyCurrentBrakeBehavior, clock: number) { if (behavior === "static") return 0; const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0; return behavior === "feather" ? 0.5 + Math.sin(t * Math.PI * 2) * 0.28 : t < 0.35 ? t / 0.35 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 }
export { EddyCurrentBrake }
