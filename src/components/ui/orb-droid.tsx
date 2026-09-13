"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export interface OrbDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  headAngle?: number
  bodyAngle?: number
  look?: Vec2 | null
  track?: boolean
  antenna?: "single" | "twin" | "none"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function OrbDroid({
  size = "md",
  variant = "solid",
  headAngle = 0,
  bodyAngle = 0,
  look = null,
  track = true,
  antenna = "twin",
  signal = "ready",
  showGround = true,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  ...props
}: OrbDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const headTurn = finiteClamp(headAngle, -65, 65)
  const bodyTurn = finite(bodyAngle)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((unit.y - 0.5) * 2, -1, 1),
    }), []),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const eye = { x: clamp(gaze.x, -1, 1) * 4, y: clamp(gaze.y, -1, 1) * 2.5 }
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const clipId = `orb-${React.useId().replace(/:/g, "")}`

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Orb droid, body rotation ${Math.round(bodyTurn)} degrees`}
      viewBox="0 0 190 190"
      width={width}
      height={width}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <defs><clipPath id={clipId}><circle cx={95} cy={111} r={53} /></clipPath></defs>
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 16 164 H 174 M 95 18 V 174" strokeDasharray="2 3" />
          <circle cx={95} cy={111} r={68} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={95} cy={166} rx={57} ry={7} fill={palette.dark} opacity={0.14} />}

      <g data-body transform={`rotate(${px(bodyTurn)} 95 111)`}>
        <circle cx={95} cy={111} r={53} {...shell} />
        <g clipPath={`url(#${clipId})`} fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.75}>
          <path d="M 42 111 H 148 M 95 58 V 164" />
          <ellipse cx={95} cy={111} rx={22} ry={53} />
          <ellipse cx={95} cy={111} rx={53} ry={22} />
          <path d="M 57 74 L 133 148 M 133 74 L 57 148" />
        </g>
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 95 111) translate(95 72)`}>
            <rect x={-8} y={-5} width={16} height={10} rx={2.5} {...machined} />
            <circle r={2.6} fill={angle === 0 ? signalColor : palette.dark} />
          </g>
        ))}
      </g>

      <g data-head transform={`translate(${px(headTurn * 0.13)} 0) rotate(${px(headTurn * 0.16)} 95 67)`}>
        <path d="M 59 75 Q 60 43 95 38 Q 130 43 131 75 Q 95 88 59 75 Z" {...machined} />
        <path d="M 61 72 Q 95 82 129 72" fill="none" stroke={palette.dark} strokeWidth={2} />
        <rect x={75} y={51} width={40} height={19} rx={7} {...cast} />
        <circle cx={px(95 + eye.x)} cy={px(60 + eye.y)} r={7.5} fill={palette.accent} />
        <circle data-eye cx={px(95 + eye.x)} cy={px(60 + eye.y)} r={3.5} fill={palette.dark} />
        <circle cx={px(97 + eye.x)} cy={px(58 + eye.y)} r={1.4} fill={palette.metal} />
        <circle cx={68} cy={66} r={4} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
        {antenna !== "none" && (
          <g data-antenna={antenna} stroke={palette.dark} strokeLinecap="round">
            <path d="M 117 48 L 122 24" strokeWidth={1.8} />
            <circle cx={122} cy={22} r={2.6} fill={signalColor} strokeWidth={1} />
            {antenna === "twin" && <path d="M 108 43 L 106 30" strokeWidth={1.4} />}
          </g>
        )}
      </g>
      {label && <text x={95} y={184} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finite = (value: number) => Number.isFinite(value) ? value : 0
const finiteClamp = (value: number, min: number, max: number) => clamp(finite(value), min, max)

export { OrbDroid }
