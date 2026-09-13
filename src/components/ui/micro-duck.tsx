"use client"

/**
 * micro-duck — a desk-scale bipedal duck robot.
 *
 * A servo-stack neck over two solved legs, one camera eye, and a hinged beak.
 * Everything is controlled: the component has no timer of its own, so a gait
 * cycle comes from your timeline the same way the quadruped's does.
 */

import type * as React from "react"

import { solveDuck, type DuckLeg, type DuckOptions } from "@/lib/robocn/duck"
import {
  capsulePath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export interface MicroDuckProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps,
    DuckOptions {
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  /** The wire loom down the neck. */
  showCable?: boolean
  label?: string
}

function MicroDuck({
  gait = "stand", phase = 0, height = 0.55, stride = 0.6, lift = 0.5, gaze = 0, beak = 0,
  size = "md", variant = "solid", showGround = true, showContacts = false, showCable = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, ...props
}: MicroDuckProps) {
  const pose = solveDuck({ gait, phase, height, stride, lift, gaze, beak })
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const head = pose.head

  // Both legs live in the same sagittal plane, so the far one is nudged back
  // and washed out to read as depth rather than as a doubled drawing.
  function legDrawing(leg: DuckLeg, far: boolean) {
    return (
      <g key={leg.id} data-leg={leg.id} transform={far ? "translate(-9 0)" : undefined} opacity={far ? 0.45 : 1}>
        <path d={capsulePath(leg.hip, leg.knee, 5)} {...shell} />
        <path d={capsulePath(leg.knee, leg.ankle, 3.6)} {...cast} />
        {[leg.hip, leg.knee, leg.ankle].map((joint, i) => (
          <g key={i}>
            <circle cx={px(joint.x)} cy={px(joint.y)} r={i === 0 ? 5.6 : 4.2} {...cast} />
            <circle cx={px(joint.x)} cy={px(joint.y)} r={1.7} fill={palette.metal} />
          </g>
        ))}
        {/* Shoe: a flat plate that stays level whatever the ankle does. */}
        <g transform={`translate(${px(leg.ankle.x)} ${px(leg.ankle.y)})`}>
          <path d="M -9 -9 h 24 q 7 0 7 4 v 2 q 0 3 -4 3 h -27 z" {...shell} />
          <rect x={-9} y={-9} width={31} height={2.8} rx={1.3} fill={palette.accent} stroke={palette.dark} strokeWidth={variant === "solid" ? 0.6 : 0.9} fillOpacity={variant === "outline" || variant === "wire" ? 0 : 1} />
        </g>
        {showContacts && leg.contact && (
          <ellipse data-contact cx={px(leg.ankle.x + 6)} cy={1.2} rx={16} ry={1.6} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }

  return (
    <svg
      role="img"
      aria-label={`Duck robot, ${gait} pose`}
      viewBox="0 0 160 200"
      width={width}
      height={px(width * 1.25)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {showGround && (
        <g stroke={palette.grid} strokeWidth={0.6} opacity={0.5} fill="none">
          <path d="M 14 178 H 148" />
          {variant === "blueprint" && [26, 46, 66, 86, 106, 126].map(x => <path key={x} d={`M ${x} 178 l 10 8`} strokeDasharray="1 2" />)}
        </g>
      )}
      <g transform="translate(56 178) scale(1 -1)">
        {legDrawing(pose.legs[1], true)}

        {/* Body, carried by the pelvis and pitched by the lean. */}
        <g transform={`translate(${px(pose.pelvis.x)} ${px(pose.pelvis.y)}) rotate(${px(-pose.lean)})`}>
          <path d="M -22 8 l -13 4 v 9 l 13 4 z" {...machined} />
          <rect x={-23} y={1} width={40} height={31} rx={13} {...shell} />
          <rect x={-14} y={7} width={22} height={18} rx={6} {...cast} />
          {[-9, -3, 3].map(x => <line key={x} x1={x} y1={10} x2={x} y2={22} stroke={palette.metal} strokeWidth={1} opacity={0.8} />)}
          <rect x={5} y={20} width={13} height={9} rx={3.5} {...machined} />
          <circle cx={12} cy={5} r={2} fill={palette.accent} />
        </g>

        {/* Neck: a servo stack, wire loom trailing down its back. */}
        {showCable && (
          <path
            d={`M ${px(pose.neck[0].x - 4)} ${px(pose.neck[0].y - 4)} Q ${px(pose.neck[1].x - 9)} ${px(pose.neck[1].y)} ${px(pose.neck[2].x - 7)} ${px(pose.neck[2].y + 2)} T ${px(head.pivot.x - 5)} ${px(head.pivot.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.75}
          />
        )}
        {pose.neck.slice(1).map((joint, i) => (
          <path key={i} data-neck={i} d={capsulePath(pose.neck[i], joint, 4.4)} {...cast} />
        ))}
        {pose.neck.map((joint, i) => (
          <circle key={i} cx={px(joint.x)} cy={px(joint.y)} r={3.2} fill={palette.metal} opacity={0.9} />
        ))}

        {legDrawing(pose.legs[0], false)}

        <g data-head transform={`translate(${px(head.pivot.x)} ${px(head.pivot.y)}) rotate(${px(head.angle)})`}>
          <rect x={-15} y={-7} width={14} height={18} rx={4} {...cast} />
          <rect x={-13} y={-5} width={41} height={24} rx={10} {...shell} />
          {/* Upper mandible: fixed to the skull, the way a bird's is. */}
          <path d="M -2 -4 h 30 q 6 0 6 2.6 l -1 1.6 q -1 1.4 -6 1.4 h -29 z" {...machined} />
          <g data-beak transform={`rotate(${px(-head.beak)})`}>
            <path d="M 0 -6.4 h 27 q 6 0 6 2.4 l -1.4 1.6 q -1.2 1.2 -5.6 1.2 h -26 z" fill={palette.accent} stroke={palette.dark} strokeWidth={variant === "solid" ? 0.6 : 0.9} fillOpacity={variant === "outline" || variant === "wire" ? 0 : 1} />
          </g>
          <g data-eye>
            <circle cx={12} cy={7.5} r={8} fill={palette.accent} stroke={palette.dark} strokeWidth={0.6} />
            <circle cx={12} cy={7.5} r={4.6} fill={palette.dark} />
            <circle cx={13.8} cy={9.2} r={1.6} fill={palette.metal} opacity={0.9} />
          </g>
          <circle cx={23} cy={12} r={1.8} {...machined} />
          <line x1={-8} y1={14} x2={2} y2={14} stroke={palette.metal} strokeWidth={1} opacity={0.7} />
        </g>
      </g>
      {label && (
        <text x={80} y={193} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

export { MicroDuck }
