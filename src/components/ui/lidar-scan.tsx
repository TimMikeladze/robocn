"use client"

/**
 * lidar-scan — a polar range display.
 *
 * The ray sweeps on its own, and the returns light as it passes them and fade
 * behind it, which is what a scanning sensor actually looks like: the data is
 * not drawn all at once, it is drawn as it arrives. Interactive, the plot is
 * readable — hover a return and it reports its bearing and distance.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import type { Vec2 } from "@/lib/robocn/kinematics"
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

const VIEW = 180
/** Outer ring, in view units. */
const PLOT = 72
/** Degrees of sweep a return stays lit for before it settles to its floor. */
const TRAIL = 150
/** How close the pointer has to be to a return to pick it, in view units. */
const PICK_RADIUS = 9

export interface LidarSample {
  /** Clockwise degrees from the sensor's forward direction. */
  angle: number
  /** Nonnegative distance in the same units as maxRange. */
  distance: number
}

export type LidarBehavior = "sweep" | "pointer" | "static"

export interface LidarScanProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  samples?: readonly LidarSample[]
  /** Range represented by the outer ring. Invalid or nonpositive values use 10. */
  maxRange?: number
  /** Clockwise sensor heading in degrees. Rotates returns and scan ray together. */
  heading?: number
  /** Controlled scan-ray angle relative to the sensor. Omit to run `behavior`. */
  scanAngle?: number
  /** What the ray does when `scanAngle` is not supplied. */
  behavior?: LidarBehavior
  /** Sweeps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Hover a return to pick it out and read it off. */
  interactive?: boolean
  onSampleHover?: (sample: LidarSample | null) => void
  /** Draw the ray at all. */
  showRay?: boolean
  showRays?: boolean
  showRings?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function LidarScan({
  samples = [], maxRange = 10, heading = 0, scanAngle,
  behavior = "sweep", speed = 0.35, animate = true, paused = false, phase = 0,
  interactive = false, onSampleHover,
  showRay = true, showRays = false, showRings = true,
  label, size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, ...props
}: LidarScanProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const range = Number.isFinite(maxRange) && maxRange > 0 ? maxRange : 10
  const rotation = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : 0
  const svgRef = React.useRef<SVGSVGElement>(null)

  const points = samples
    .filter(sample => Number.isFinite(sample.angle) && Number.isFinite(sample.distance) && sample.distance >= 0 && sample.distance <= range)
    .map(sample => {
      const angle = (sample.angle % 360) * Math.PI / 180
      const radius = sample.distance / range * PLOT
      return {
        sample,
        bearing: ((sample.angle % 360) + 360) % 360,
        x: px(Math.sin(angle) * radius),
        y: px(-Math.cos(angle) * radius),
      }
    })

  const controlled = scanAngle !== undefined
  const pointer = usePointerTarget(svgRef, {
    enabled: (interactive || behavior === "pointer") && !paused,
    // Pointer position in sensor coordinates: the plot is rotated by the
    // sensor's heading, so the reading has to be rotated back out of it.
    toWorld: React.useCallback((unit: Vec2) => {
      const local = { x: unit.x * VIEW - VIEW / 2, y: unit.y * VIEW - VIEW / 2 }
      const turn = -rotation * Math.PI / 180
      return {
        x: local.x * Math.cos(turn) - local.y * Math.sin(turn),
        y: local.x * Math.sin(turn) + local.y * Math.cos(turn),
      }
    }, [rotation]),
  })
  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && behavior === "sweep",
    paused,
    phase,
  })
  const aimed = pointer.target
    ? (Math.atan2(pointer.target.x, -pointer.target.y) * 180) / Math.PI
    : 0
  const ray = controlled
    ? (Number.isFinite(scanAngle) ? ((scanAngle % 360) + 360) % 360 : null)
    : behavior === "static"
      ? 0
      : behavior === "pointer"
        ? ((aimed % 360) + 360) % 360
        : ((clock * 360 % 360) + 360) % 360

  // The return nearest the pointer, so a plot can be read rather than admired.
  const picked = interactive && pointer.target
    ? points.reduce<{ point: (typeof points)[number]; gap: number } | null>((best, point) => {
        const gap = Math.hypot(point.x - pointer.target!.x, point.y - pointer.target!.y)
        return gap < PICK_RADIUS && (!best || gap < best.gap) ? { point, gap } : best
      }, null)?.point ?? null
    : null
  const hovered = picked?.sample ?? null
  const reported = React.useRef<LidarSample | null>(null)
  React.useEffect(() => {
    if (reported.current === hovered) return
    reported.current = hovered
    onSampleHover?.(hovered)
  }, [hovered, onSampleHover])

  return (
    <svg ref={svgRef} role="img"
      aria-label={`Lidar scan, ${points.length} returns, range ${range}`}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-crosshair", className)}
      style={{ color: palette.foreground, ...style }} {...props}>
      <g transform="translate(90 90)">
        <circle r={76} {...robotSurface("dark", variant, palette)} />
        {showRings && <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.6}>
          {[18, 36, 54, 72].map(radius => <circle key={radius} r={radius} />)}
          <path d="M -72 0 h 144 M 0 -72 v 144" strokeDasharray="2 3" />
        </g>}
        {Array.from({ length: 36 }, (_, i) => <path key={i} d={`M 0 -${i % 3 === 0 ? 69 : 71} V -74`}
          transform={`rotate(${i * 10})`} stroke={palette.grid} strokeWidth={0.6} />)}
        <g data-scan transform={`rotate(${px(rotation)})`}>
          {showRay && ray !== null && <g data-beam transform={`rotate(${px(ray)})`}>
            <path d="M 0 0 L -18.63 -69.55 A 72 72 0 0 1 0 -72 Z" fill={palette.accent} opacity={0.12} />
            <path d="M 0 0 V -72" stroke={palette.accent} strokeWidth={1} />
          </g>}
          {showRays && <g stroke={palette.accent} strokeWidth={0.35} opacity={0.25}>
            {points.map((point, i) => <line key={i} data-ray x1={0} y1={0} x2={point.x} y2={point.y} />)}
          </g>}
          {points.map((point, i) => {
            const freshness = ray === null ? 1 : returnFreshness(ray, point.bearing)
            const lit = point === picked
            return (
              <circle key={i} data-return cx={point.x} cy={point.y}
                r={px(lit ? 3 : 1.5 + freshness * 1.1)}
                fill={palette.accent}
                opacity={px(lit ? 1 : 0.3 + freshness * 0.7)} />
            )
          })}
          <circle r={5} {...robotSurface("shell", variant, palette)} />
          <path d="M -2 -1 L 0 -4 L 2 -1" fill="none" stroke={palette.foreground} strokeWidth={0.8} />
        </g>
      </g>
      <g fill={palette.foreground} fontFamily="ui-monospace, monospace" fontSize={4} textAnchor="middle">
        <text x={90} y={9}>0°</text><text x={173} y={91}>90°</text>
        <text x={7} y={91}>270°</text>
        <text x={90} y={174}>
          {hovered
            ? `${Math.round(((hovered.angle % 360) + 360) % 360)}° · ${round(hovered.distance)}`
            : label ?? `RANGE ${range}`}
        </text>
      </g>
    </svg>
  )
}

/**
 * How recently the ray passed a bearing, 1 just swept to 0 long gone. The
 * floor is deliberate: returns stay faintly visible so the plot is still a
 * map between passes.
 */
export function returnFreshness(ray: number, bearing: number) {
  const behind = ((ray - bearing) % 360 + 360) % 360
  return behind > TRAIL ? 0 : 1 - behind / TRAIL
}

const round = (value: number) => Number(value.toFixed(1))

export { LidarScan }
