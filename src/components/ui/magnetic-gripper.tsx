"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MagneticGripperBehavior = "pick" | "hold" | "static"
export type MagneticWorkpiece = "plate" | "bar" | "none"
export interface MagneticGripperProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps { strength?: number; onStrengthChange?: (strength: number) => void; workpiece?: MagneticWorkpiece; behavior?: MagneticGripperBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean; interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant }
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }

function MagneticGripper({ strength, onStrengthChange, workpiece = "plate", behavior = "pick", speed = 0.3, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "front", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: MagneticGripperProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size); const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = strength !== undefined
  const hold = controlled ? (Number.isFinite(strength) ? clamp(strength, 0, 1) : 0) : held; const goal = React.useCallback((clock: number) => magneticGripperGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 2.5, speed, phase, paused, animate: animate && !controlled && behavior !== "static" }); const value = clamp(motion.value, 0, 1)
  const apply = React.useCallback((next: number) => { const bounded = Math.round(clamp(next, 0, 1) * 100) / 100; setHeld(bounded); onStrengthChange?.(bounded) }, [onStrengthChange]); const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply(1 - unit.y), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const face = aboutPoint(robotCamera(view).wall(), 110, 112, view === "profile" ? 0.92 : 1)
  const captured = value >= 0.5; const workY = captured ? 137 - (value - 0.5) * 70 : 154; const workTransform = `translate(0 ${px(workY - 154)})`
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Magnetic gripper, ${Math.round(value * 100)} percent strength, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 1 : undefined} aria-valuenow={interactive ? px(value) : undefined} aria-valuetext={interactive ? `${Math.round(value * 100)} percent field strength` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 0.05, 0.15); if (delta) apply(value + delta); else if (event.key === "Home") apply(0); else if (event.key === "End") apply(1); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 160 H 208 M 110 8 V 186" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <path d="M 103 9 H 117 V 31 H 103 Z" {...cast} /><rect x={55} y={28} width={110} height={56} rx={10} {...shell} /><rect x={68} y={39} width={84} height={34} rx={6} {...cast} />
      <path data-coil d="M 76 47 H 144 M 73 53 H 147 M 72 59 H 148 M 73 65 H 147" stroke={palette.accent} strokeWidth={3} strokeLinecap="round" />
      {[-1, 1].map(side => <g key={side} data-pole={side < 0 ? "left" : "right"}><path d={`M ${110 + side * 28} 78 V 126 H ${110 + side * 50} V 78`} fill="none" stroke={palette.metal} strokeWidth={18} strokeLinejoin="round" /><rect x={side < 0 ? 49 : 145} y={119} width={26} height={13} rx={3} {...machined} /></g>)}
      <g data-field data-strength={px(value)} data-active={value > 0.5}>{showField && <g fill="none" stroke={palette.glow} opacity={0.18 + value * 0.72}><path d="M 62 131 Q 62 146 83 146 H 137 Q 158 146 158 131" /><path d="M 72 131 Q 72 139 88 139 H 132 Q 148 139 148 131" /></g>}</g>
      {workpiece !== "none" && <g data-workpiece={workpiece} data-captured={captured} transform={workTransform}>{workpiece === "plate" ? <rect x={38} y={151} width={144} height={18} rx={4} {...machined} /> : <rect x={63} y={145} width={94} height={28} rx={10} {...machined} />}<path d="M 51 160 H 169" stroke={palette.dark} strokeWidth={1.5} /></g>}
    </g>{label && <text x={110} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function magneticGripperGoal(behavior: MagneticGripperBehavior, clock: number) { if (behavior === "static") return 0; if (behavior === "hold") return 0.82; const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0; return t < 0.25 ? t * 4 : t < 0.65 ? 1 : t < 0.82 ? 1 - (t - 0.65) / 0.17 : 0 }
export { MagneticGripper }
