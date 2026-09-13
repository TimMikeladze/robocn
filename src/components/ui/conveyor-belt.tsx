"use client"

/**
 * conveyor-belt — the line the robots work over.
 *
 * Parts ride a looping belt. Leave it alone and it runs; drive `position` and
 * it becomes a readout — a queue, a build pipeline, a progress bar with
 * something physical on it.
 */

import * as React from "react"

import { clamp, lerp } from "@/lib/robocn/kinematics"
import {
  prefersReducedMotion,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const media = window.matchMedia("(prefers-reduced-motion: reduce)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 76
const BELT_LEFT = 18
const BELT_RIGHT = 182
const BELT_TOP = 34
/** More parts than this stop reading as parts, so the belt caps here. */
const MAX_PARTS = 12
const DEFAULT_PARTS = 3

export interface ConveyorBeltProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Belt phase. Whole turns are equivalent, so 0.25, 1.25 and -0.75 all draw
   * the same belt. Leave it out and the belt runs on its own.
   */
  position?: number
  /** How many parts ride the belt, 0 to 12. */
  parts?: number
  /** Turns per second when uncontrolled. */
  speed?: number
  animate?: boolean
  /** Which way the parts travel. */
  direction?: "right" | "left"
  variant?: RobotVariant
  size?: RobotSize | number
  label?: string
}

function ConveyorBelt({
  position,
  parts = DEFAULT_PARTS,
  speed = 0.12,
  animate = true,
  direction = "right",
  variant = "solid",
  size = "md",
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
}: ConveyorBeltProps) {
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const width = resolveRobotSize(size)
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const controlled = position !== undefined
  const count = Number.isFinite(parts)
    ? Math.round(clamp(parts, 0, MAX_PARTS))
    : DEFAULT_PARTS

  const reduced = React.useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
  const [clock, setClock] = React.useState(0)
  React.useEffect(() => {
    if (controlled || !animate || reduced || !Number.isFinite(speed) || speed === 0) return
    let last = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const delta = Math.min(0.05, (now - last) / 1000)
      last = now
      setClock((current) => current + delta * speed)
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [controlled, animate, speed, reduced])

  // One turn is one belt length: whole turns wrap away so a controlled belt is
  // the same drawing at 0.25, 1.25 and -0.75.
  const phase = wrap(controlled ? (position as number) : clock)
  const travel = direction === "left" ? -phase : phase

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)
  const span = BELT_RIGHT - BELT_LEFT

  return (
    <svg
      role="img"
      aria-label={`Conveyor belt carrying ${count} ${count === 1 ? "part" : "parts"}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {/* Frame and legs. */}
      <rect x={10} y={BELT_TOP + 6} width={VIEW_WIDTH - 20} height={10} rx={3} {...shell} />
      {[28, VIEW_WIDTH - 28].map((x) => (
        <rect key={x} x={x - 3} y={BELT_TOP + 16} width={6} height={20} rx={2} {...darkSurface} />
      ))}
      <rect x={16} y={VIEW_HEIGHT - 8} width={VIEW_WIDTH - 32} height={4} rx={2} {...darkSurface} />

      {/* Belt surface, with the drive rollers at either end. */}
      <rect x={BELT_LEFT} y={BELT_TOP} width={span} height={8} rx={4} {...darkSurface} />
      {[BELT_LEFT, BELT_RIGHT].map((x) => (
        <g key={x} transform={`translate(${x} ${BELT_TOP + 4})`}>
          <circle r={7} {...metalSurface} />
          <g transform={`rotate(${px(travel * 360)})`}>
            <line
              x1={-4.5}
              y1={0}
              x2={4.5}
              y2={0}
              stroke={palette.dark}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}

      {/* Cleats: the tell that the belt is moving rather than the parts. */}
      {Array.from({ length: 11 }).map((_, index) => {
        const t = wrap(index / 11 + travel)
        return (
          <line
            key={index}
            x1={px(lerp(BELT_LEFT, BELT_RIGHT, t))}
            y1={BELT_TOP + 1.5}
            x2={px(lerp(BELT_LEFT, BELT_RIGHT, t))}
            y2={BELT_TOP + 6.5}
            stroke={palette.metal}
            strokeWidth={1}
            opacity={0.5}
          />
        )
      })}

      {Array.from({ length: count }).map((_, index) => {
        const t = wrap(index / Math.max(count, 1) + travel)
        return (
          <g
            key={index}
            data-part={index}
            transform={`translate(${px(lerp(BELT_LEFT, BELT_RIGHT, t))} ${BELT_TOP})`}
          >
            <rect x={-9} y={-16} width={18} height={16} rx={2.5} {...shell} />
            <rect x={-5} y={-12} width={10} height={8} rx={1.5} fill={palette.accent} opacity={0.9} />
          </g>
        )
      })}

      {label ? (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 14}
          textAnchor="middle"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.4"
          fill={palette.grid}
        >
          {label}
        </text>
      ) : null}
    </svg>
  )
}

/** Fold any number of turns into 0..1. Non-finite input parks the belt at 0. */
function wrap(value: number) {
  if (!Number.isFinite(value)) return 0
  return ((value % 1) + 1) % 1
}

export { ConveyorBelt }
