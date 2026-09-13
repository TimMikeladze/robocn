"use client"

/**
 * gantry-arm — a cartesian gantry: two columns, a travelling beam, a head.
 *
 * No inverse kinematics to speak of, which is exactly the point — the axes are
 * independent, so the head takes the dog-leg path a real machine takes rather
 * than the arc an arm would sweep. Good for plotters, pick-and-place, CNC.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useEasedPoint, type RobotTarget } from "@/hooks/use-robot-arm"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotBehavior,
  type RobotPaletteProps,
  type RobotSize,
  type RobotTool,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 132
const VIEW_HEIGHT = 118
const FLOOR = 14
const SPAN = 52
const TOP = 88
const HEAD_DROP = 11

export interface GantryArmProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /** Controlled head position. `x` runs ±52, `y` from the bed up to ~76. */
  target?: RobotTarget
  behavior?: RobotBehavior
  tool?: RobotTool
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
  thickness?: number
  /** Axis feed rate, world units per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  /** Draw where the head has been — turns the gantry into a plotter. */
  trail?: boolean
  /** How many trail points to keep. */
  trailLength?: number
  showBed?: boolean
  showRulers?: boolean
}

function GantryArm({
  target = null,
  behavior = "sweep",
  tool = "painter",
  active,
  variant = "solid",
  size = "md",
  thickness = 1,
  speed = 70,
  animate = true,
  paused = false,
  phase = 0,
  label,
  trail = false,
  trailLength = 90,
  showBed = true,
  showRulers,
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
}: GantryArmProps) {
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
  const weight = thickness
  const rulers = showRulers ?? variant === "blueprint"

  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !paused,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp(unit.x * VIEW_WIDTH - VIEW_WIDTH / 2, -SPAN + 6, SPAN - 6),
        y: clamp(VIEW_HEIGHT - FLOOR - unit.y * VIEW_HEIGHT, 8, TOP - HEAD_DROP - 6),
      }),
      [],
    ),
  })

  const goal: RobotTarget = (() => {
    if (target) return target
    if (behavior === "pointer") return pointer.target
    if (behavior === "static") return { x: 0, y: 34 }
    if (behavior === "orbit") {
      return (clock: number) => ({
        x: Math.cos(clock * 0.8) * SPAN * 0.7,
        y: 38 + Math.sin(clock * 0.8) * 22,
      })
    }
    if (behavior === "idle") {
      return (clock: number) => ({
        x: Math.sin(clock * 0.5) * 6,
        y: 34 + Math.sin(clock * 0.35) * 3,
      })
    }
    // Raster: sweep the long axis, step the short one. Plotters do this.
    return (clock: number) => ({
      x: Math.sin(clock * 0.9) * SPAN * 0.78,
      y: 20 + ((clock * 5) % 46),
    })
  })()

  const eased = useEasedPoint(goal, { x: 0, y: 34 }, { speed, animate, paused, phase })
  const head = eased.point
  const beamY = clamp(head.y + HEAD_DROP, 22, TOP - 4)
  const engaged = active ?? eased.moving

  // The trail is drawing output, not state anything re-renders from: it is
  // written straight to the polyline so a long plot costs no extra renders.
  const trailPoints = React.useRef<Vec2[]>([])
  const trailLine = React.useRef<SVGPolylineElement>(null)
  React.useEffect(() => {
    if (!trail) {
      trailPoints.current = []
    } else {
      const last = trailPoints.current[trailPoints.current.length - 1]
      if (!last || Math.hypot(last.x - head.x, last.y - head.y) > 0.8) {
        trailPoints.current = [...trailPoints.current, { x: head.x, y: head.y }].slice(
          -trailLength,
        )
      }
    }
    trailLine.current?.setAttribute(
      "points",
      trailPoints.current.map((point) => `${px(point.x)},${px(point.y)}`).join(" "),
    )
  }, [trail, trailLength, head.x, head.y])

  const shell = robotSurface("shell", variant, palette, weight)
  const metalSurface = robotSurface("metal", variant, palette, weight)
  const darkSurface = robotSurface("dark", variant, palette, weight)

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Cartesian gantry machine with a ${tool} head`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g transform={`translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT - FLOOR}) scale(1 -1)`}>
        {showBed ? (
          <g>
            <rect
              x={-SPAN - 6}
              y={-6}
              width={(SPAN + 6) * 2}
              height={8}
              rx={1.5}
              {...darkSurface}
            />
            <rect
              x={-SPAN + 2}
              y={2}
              width={(SPAN - 2) * 2}
              height={5}
              rx={1}
              {...metalSurface}
            />
            {Array.from({ length: 13 }, (_, i) => -SPAN + 4 + i * 8).map((x) => (
              <line
                key={x}
                x1={x}
                y1={2.4}
                x2={x}
                y2={6.6}
                stroke={palette.grid}
                strokeWidth={0.3}
                opacity={0.6}
              />
            ))}
          </g>
        ) : null}

        {trail ? (
          <polyline
            ref={trailLine}
            fill="none"
            stroke={palette.accent}
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ) : null}

        {[-1, 1].map((side) => (
          <g key={side}>
            <path
              d={capsulePath(
                { x: side * SPAN, y: 4 },
                { x: side * SPAN, y: TOP },
                2.4 * weight,
              )}
              {...metalSurface}
            />
            {/* Carriage riding the column at the beam's height. */}
            <rect
              x={px(side * SPAN - 4)}
              y={px(beamY - 4)}
              width={8}
              height={8}
              rx={1.6}
              {...darkSurface}
            />
          </g>
        ))}

        <path
          d={capsulePath(
            { x: -SPAN, y: beamY },
            { x: SPAN, y: beamY },
            3.2 * weight,
          )}
          {...shell}
        />

        <g transform={`translate(${px(head.x)} ${px(beamY)})`}>
          <rect x={-6} y={-4.6} width={12} height={9} rx={2} {...darkSurface} />
          <rect
            x={-1.8}
            y={px(-HEAD_DROP)}
            width={3.6}
            height={px(HEAD_DROP)}
            rx={1}
            {...metalSurface}
          />
          <g transform={`translate(0 ${px(-HEAD_DROP)})`}>
            <path d="M -2.6 0 L 2.6 0 L 1.2 -4.2 L -1.2 -4.2 Z" {...darkSurface} />
            {tool === "gripper"
              ? [-1, 1].map((side) => (
                  <rect
                    key={side}
                    x={px(side * 1.8 - 0.5)}
                    y={-6.6}
                    width={1}
                    height={2.8}
                    rx={0.4}
                    {...metalSurface}
                  />
                ))
              : null}
            <circle
              r={engaged ? 1.5 : 1}
              cy={-5}
              fill={palette.glow}
              className={engaged ? "robocn-pulse" : undefined}
            />
          </g>
        </g>

        {rulers ? (
          <g
            fontFamily="ui-monospace, monospace"
            fontSize={3.2}
            fill={palette.grid}
          >
            <g transform={`translate(${px(head.x + 4)} ${px(beamY + 8)}) scale(1 -1)`}>
              <text fill={palette.accent}>
                {`X ${head.x.toFixed(0)}  Y ${head.y.toFixed(0)}`}
              </text>
            </g>
            <line
              x1={-SPAN}
              y1={TOP + 5}
              x2={px(head.x)}
              y2={TOP + 5}
              stroke={palette.accent}
              strokeWidth={0.4}
              strokeDasharray="1.5 1.5"
            />
          </g>
        ) : null}

        {label ? (
          <g transform={`translate(0 -10) scale(1 -1)`}>
            <text
              textAnchor="middle"
              fontSize={3.8}
              fontFamily="ui-monospace, monospace"
              letterSpacing="0.4"
              fill={palette.grid}
            >
              {label}
            </text>
          </g>
        ) : null}
      </g>
    </svg>
  )
}

export { GantryArm }
