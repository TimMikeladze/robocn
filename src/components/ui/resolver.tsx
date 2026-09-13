"use client"

import * as React from "react"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { resolverSignals } from "@/lib/robocn/electromagnetism"
import { aboutPoint, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type ResolverBehavior = "turn" | "sweep" | "static"
export interface ResolverProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps { angle?: number; onAngleChange?: (angle: number) => void; excitation?: number; showChannels?: boolean; behavior?: ResolverBehavior; speed?: number; phase?: number; paused?: boolean; animate?: boolean; interactive?: boolean; showField?: boolean; label?: string; view?: RobotView; size?: RobotSize | number; variant?: RobotVariant }
const names: Record<RobotView, string> = { plan: "plan view", front: "front elevation", profile: "side elevation", iso: "isometric view" }
const wrap = (value: number) => ((value % 360) + 360) % 360

function Resolver({ angle, onAngleChange, excitation = 1, showChannels = true, behavior = "turn", speed = 0.2, phase = 0, paused = false, animate = true, interactive = false, showField = true, label, view = "front", size = "md", variant = "solid", color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props }: ResolverProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride }); const width = resolveRobotSize(size); const ref = React.useRef<SVGSVGElement>(null); const [held, setHeld] = React.useState<number | null>(null); const controlled = angle !== undefined
  const hold = controlled ? (Number.isFinite(angle) ? wrap(angle) : 0) : held; const goal = React.useCallback((clock: number) => resolverGoal(behavior, clock), [behavior]); const motion = useRobotScalar(goal, { hold, rate: 420, speed, phase, paused, animate: animate && !controlled && behavior !== "static" }); const rotation = wrap(motion.value); const drive = Number.isFinite(excitation) ? Math.max(-1, Math.min(1, excitation)) : 1; const signals = resolverSignals(rotation, drive)
  const apply = React.useCallback((next: number) => { const bounded = Math.round(wrap(next) * 100) / 100; setHeld(bounded); onAngleChange?.(bounded) }, [onAngleChange]); const dragging = useRobotDrag(ref, { enabled: interactive, onDrag: React.useCallback((unit) => apply(Math.atan2(unit.y * 200 - 91, unit.x * 220 - 110) * 180 / Math.PI), [apply]), onDragEnd: React.useCallback(() => setHeld(null), []) })
  const shell = robotSurface("shell", variant, palette); const machined = robotSurface("metal", variant, palette); const cast = robotSurface("dark", variant, palette); const face = aboutPoint(robotCamera(view).wall(), 110, 91, view === "profile" ? 0.92 : 1)
  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Resolver, ${Math.round(rotation)} degrees, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 360 : undefined} aria-valuenow={interactive ? px(rotation) : undefined} aria-valuetext={interactive ? `${Math.round(rotation)} degrees` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 5, 15); if (delta) apply(rotation + delta); else if (event.key === "Home") apply(0); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <path d="M 12 91 H 208 M 110 8 V 186" stroke={palette.grid} strokeWidth={0.6} strokeDasharray="3 4" />}
    <g data-view={view} transform={face || undefined}>
      <circle cx={110} cy={91} r={78} {...shell} /><circle cx={110} cy={91} r={64} {...cast} />
      <g data-secondary="sine"><path d="M 68 28 Q 110 9 152 28 M 68 154 Q 110 173 152 154" fill="none" stroke={palette.metal} strokeWidth={9} /><path d="M 74 31 Q 110 16 146 31 M 74 151 Q 110 166 146 151" fill="none" stroke={palette.accent} strokeWidth={2} /></g>
      <g data-secondary="cosine"><path d="M 47 49 Q 27 91 47 133 M 173 49 Q 193 91 173 133" fill="none" stroke={palette.metal} strokeWidth={9} /><path d="M 51 55 Q 35 91 51 127 M 169 55 Q 185 91 169 127" fill="none" stroke={palette.accent} strokeWidth={2} /></g>
      <g data-rotor transform={`rotate(${px(rotation)} 110 91)`}><ellipse data-primary cx={110} cy={91} rx={24} ry={48} {...machined} /><path d="M 96 55 Q 110 45 124 55 M 94 65 Q 110 54 126 65 M 94 117 Q 110 128 126 117 M 96 127 Q 110 137 124 127" fill="none" stroke={palette.accent} strokeWidth={2.5} /><circle cx={110} cy={91} r={12} {...cast} /><path d="M 110 79 V 91 H 122" stroke={palette.shell} strokeWidth={2} /></g>
      {showField && <g data-field transform={`rotate(${px(rotation)} 110 91)`} fill="none" stroke={palette.glow} opacity={0.5}><ellipse cx={110} cy={91} rx={34} ry={55} strokeDasharray="4 4" /></g>}
    </g>
    {showChannels && <g transform="translate(45 177)"><g data-channel="sine" data-value={px(signals.sine)}><rect width={58} height={8} rx={3} {...cast} /><rect x={29} width={px(signals.sine * 29)} height={8} fill={palette.accent} /></g><g data-channel="cosine" data-value={px(signals.cosine)} transform="translate(72 0)"><rect width={58} height={8} rx={3} {...cast} /><rect x={29} width={px(signals.cosine * 29)} height={8} fill={palette.shell} /></g></g>}
    {label && <text x={110} y={198} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}
export function resolverGoal(behavior: ResolverBehavior, clock: number) { if (behavior === "static") return 0; const safe = Number.isFinite(clock) ? clock : 0; return behavior === "sweep" ? Math.sin(safe * Math.PI * 2) * 120 : safe * 360 }
export { Resolver }
