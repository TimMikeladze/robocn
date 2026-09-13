"use client"

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { threePhaseField } from "@/lib/robocn/electromagnetism"
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

export type InductionMotorBehavior = "run" | "slip" | "static"

export interface InductionMotorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  angle?: number
  onAngleChange?: (angle: number) => void
  poles?: 2 | 4 | 6
  slip?: number
  behavior?: InductionMotorBehavior
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
const wrap = (value: number, period = 360) => ((value % period) + period) % period
const point = (radius: number, degrees: number) => {
  const angle = degrees * Math.PI / 180
  return { x: px(110 + Math.cos(angle) * radius), y: px(100 + Math.sin(angle) * radius) }
}

function InductionMotor({
  angle, onAngleChange, poles = 4, slip = 0.06, behavior = "run", speed = 0.25,
  phase = 0, paused = false, animate = true, interactive = false, showField = true,
  label, view = "front", size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, "aria-label": ariaLabel, ...props
}: InductionMotorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const ref = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = angle !== undefined
  const hold = controlled ? (Number.isFinite(angle) ? wrap(angle) : 0) : held
  const goal = React.useCallback((clock: number) => inductionMotorGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, { hold, rate: 540, speed, phase, paused, animate: animate && !controlled && behavior !== "static" })
  const rotation = wrap(motion.value)
  const boundedSlip = Number.isFinite(slip) ? Math.min(0.3, Math.max(0, slip)) : 0.06
  const apply = React.useCallback((next: number) => {
    const wrapped = Math.round(wrap(next) * 100) / 100
    setHeld(wrapped)
    onAngleChange?.(wrapped)
  }, [onAngleChange])
  const dragging = useRobotDrag(ref, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => apply(Math.atan2(unit.y * 200 - 100, unit.x * 220 - 110) * 180 / Math.PI), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })
  const field = threePhaseField((rotation / 360) / Math.max(0.7, 1 - boundedSlip), poles)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const camera = robotCamera(view)
  const face = aboutPoint(camera.wall(), 110, 100, view === "profile" ? 0.92 : 1)

  return <svg ref={ref} role={role ?? (interactive ? "slider" : "img")} aria-label={ariaLabel ?? `Induction motor, ${Math.round(rotation)} degrees, ${poles} poles, ${names[view]}`} aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 360 : undefined} aria-valuenow={interactive ? px(rotation) : undefined} aria-valuetext={interactive ? `${Math.round(rotation)} degrees` : undefined} tabIndex={tabIndex ?? (interactive ? 0 : undefined)} onKeyDown={(event) => { onKeyDown?.(event); if (!interactive || event.defaultPrevented) return; const delta = arrowStep(event.key, 5, 15); if (delta) apply(rotation + delta); else if (event.key === "Home") apply(0); else return; event.preventDefault() }} onBlur={(event) => { onBlur?.(event); if (!dragging) setHeld(null) }} viewBox="0 0 220 200" width={width} height={px(width * 200 / 220)} className={cn("max-w-full select-none", interactive && "touch-none cursor-grab focus-visible:outline-2", dragging && "cursor-grabbing", className)} style={{ color: palette.foreground, ...style }} {...props}>
    {variant === "blueprint" && <g stroke={palette.grid} strokeWidth={0.6} opacity={0.6}><path d="M 12 100 H 208 M 110 8 V 190" strokeDasharray="3 4" /><circle cx={110} cy={100} r={88} fill="none" /></g>}
    <g data-view={view} transform={face || undefined}>
      <circle cx={110} cy={100} r={82} {...shell} />
      <circle cx={110} cy={100} r={69} {...cast} />
      <g data-stator-phase>
        {Array.from({ length: poles * 3 }, (_, index) => {
          const degrees = index * 360 / (poles * 3)
          const p = point(62, degrees)
          return <g key={index} data-phase={index % 3} transform={`rotate(${px(degrees + 90)} ${p.x} ${p.y})`}><rect x={p.x - 7} y={p.y - 14} width={14} height={28} rx={4} {...(index % 3 === 0 ? shell : index % 3 === 1 ? machined : cast)} /><path d={`M ${p.x - 4} ${p.y - 8} H ${p.x + 4} M ${p.x - 4} ${p.y} H ${p.x + 4} M ${p.x - 4} ${p.y + 8} H ${p.x + 4}`} stroke={palette.accent} strokeWidth={1.3} /></g>
        })}
      </g>
      <g data-rotor transform={`rotate(${px(rotation)} 110 100)`}>
        <circle cx={110} cy={100} r={39} {...machined} />
        <circle cx={110} cy={100} r={29} {...cast} />
        {Array.from({ length: 12 }, (_, index) => {
          const p = point(34, index * 30)
          return <circle key={index} data-cage-bar={index} cx={p.x} cy={p.y} r={3.2} fill={palette.accent} />
        })}
        <circle cx={110} cy={100} r={11} {...shell} />
        <path d="M 110 89 V 100 H 121" fill="none" stroke={palette.dark} strokeWidth={2} />
      </g>
      {showField && <g data-field transform={`rotate(${px(field.angle)} 110 100)`} fill="none" stroke={palette.glow} opacity={0.72}><path d="M 110 19 L 103 31 M 110 19 L 117 31" strokeWidth={3} /><ellipse cx={110} cy={100} rx={51} ry={24} strokeDasharray="5 5" /></g>}
      <path d="M 25 177 H 195" stroke={palette.dark} strokeWidth={6} strokeLinecap="round" />
      <path d="M 62 174 V 187 H 158 V 174" fill="none" stroke={palette.metal} strokeWidth={5} />
    </g>
    {label && <text x={110} y={197} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
  </svg>
}

export function inductionMotorGoal(behavior: InductionMotorBehavior, clock: number) {
  if (behavior === "static") return 0
  const safe = Number.isFinite(clock) ? clock : 0
  if (behavior === "slip") return safe * 360 * 0.88 + Math.sin(safe * Math.PI * 2) * 3
  return safe * 360
}

export { InductionMotor }
