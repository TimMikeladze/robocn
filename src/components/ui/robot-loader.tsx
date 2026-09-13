"use client"

/**
 * robot-loader — a pick-and-place cycle as a loading indicator.
 *
 * An arm moves parts from the in-tray to the out-tray on a fixed cycle. Left
 * indeterminate it just keeps working; give it `value` and the trays fill up
 * in proportion, so the same component covers "busy" and "62% done".
 *
 * `pauseOnHover` stops the cell under the pointer, which is the only thing
 * anyone ever wants to do to a loading animation: hold it still long enough to
 * look at it.
 */

import * as React from "react"

import { useEasedPoint } from "@/hooks/use-robot-arm"
import { clamp, lerp, solveChain2, type Vec2 } from "@/lib/robocn/kinematics"
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

const VIEW_WIDTH = 132
const VIEW_HEIGHT = 76
const FLOOR = 12
const PICK: Vec2 = { x: -34, y: 12 }
const PLACE: Vec2 = { x: 34, y: 12 }
const LIFT = 34
const LINKS = [26, 22]

export interface RobotLoaderProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Seconds per pick-and-place cycle. */
  cycle?: number
  /** 0..100 fills the out-tray in proportion; omit for an indeterminate loader. */
  value?: number
  /** Parts in a full tray. */
  capacity?: number
  variant?: RobotVariant
  size?: RobotSize | number
  paused?: boolean
  /** Stop the cycle while the pointer is over the cell. */
  pauseOnHover?: boolean
  /** Caption under the cell. */
  label?: string
}

function RobotLoader({
  cycle = 2.6,
  value,
  capacity = 4,
  variant = "solid",
  size = "md",
  paused = false,
  pauseOnHover = false,
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
  onPointerEnter,
  onPointerLeave,
  ...props
}: RobotLoaderProps) {
  const [hovered, setHovered] = React.useState(false)
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

  // The path is already eased keyframe to keyframe, so the point loop only has
  // to follow it; a high feed rate keeps it on the scripted timing.
  const path = React.useCallback(
    (clock: number) => cyclePoint((clock % cycle) / cycle),
    [cycle],
  )
  const eased = useEasedPoint(path, cyclePoint(0), {
    speed: 600,
    paused: paused || (pauseOnHover && hovered),
    animate: true,
  })

  const phase = (eased.clock % cycle) / cycle
  const carrying = phase > 0.28 && phase < 0.72
  const grip = carrying || (phase > 0.22 && phase < 0.78) ? 0.15 : 0.75
  const joints = solveChain2({ x: 0, y: 16 }, eased.point, LINKS, { bend: "up" })
  const done = value === undefined ? null : clamp(value, 0, 100) / 100
  const placed =
    done === null
      ? Math.min(capacity, Math.floor(eased.clock / cycle) % (capacity + 1))
      : Math.round(done * capacity)

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)

  return (
    <svg
      role="img"
      aria-label={
        done === null
          ? "Robot arm moving parts, working"
          : `Robot arm moving parts, ${Math.round(done * 100)} percent complete`
      }
      aria-busy={done === null || done < 1}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (pauseOnHover) setHovered(true)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (pauseOnHover) setHovered(false)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g transform={`translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT - FLOOR}) scale(1 -1)`}>
        {[PICK, PLACE].map((tray, index) => (
          <g key={index}>
            <rect
              x={px(tray.x - 14)}
              y={0}
              width={28}
              height={5}
              rx={1.4}
              {...darkSurface}
            />
            {Array.from({
              length: index === 0 ? capacity - placed : placed,
            }).map((_, slot) => (
              <rect
                key={slot}
                x={px(tray.x - 4.5)}
                y={px(5.5 + slot * 5.4)}
                width={9}
                height={4.6}
                rx={1}
                fill={palette.accent}
                opacity={0.9}
              />
            ))}
          </g>
        ))}

        <rect x={-11} y={-1} width={22} height={5} rx={1.6} {...darkSurface} />
        <path d="M -7 4 L 7 4 L 5 16 L -5 16 Z" {...shell} />

        <path d={capsulePath(joints[0], joints[1], 3)} {...shell} />
        <path d={capsulePath(joints[1], joints[2], 2.2)} {...metalSurface} />
        <circle cx={px(joints[1].x)} cy={px(joints[1].y)} r={3.2} fill={palette.dark} />
        <circle cx={0} cy={16} r={4} fill={palette.dark} />

        <g transform={`translate(${px(joints[2].x)} ${px(joints[2].y)})`}>
          {[-1, 1].map((side) => (
            <rect
              key={side}
              x={px(side * (1.4 + grip * 2.6) - 0.7)}
              y={-5}
              width={1.6}
              height={5}
              rx={0.6}
              {...metalSurface}
            />
          ))}
          {carrying ? (
            <rect x={-4.5} y={-5.4} width={9} height={4.6} rx={1} fill={palette.accent} />
          ) : null}
        </g>

        {label ? (
          <g transform={`translate(0 -8) scale(1 -1)`}>
            <text
              textAnchor="middle"
              fontSize={4.2}
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

/** Smoothstep, so each leg of the cycle starts and stops like a servo. */
const ease = (t: number) => t * t * (3 - 2 * t)

/** Where the gripper is at `t`, one full pick-and-place cycle over 0..1. */
function cyclePoint(t: number): Vec2 {
  const leg = (from: Vec2, to: Vec2, start: number, end: number): Vec2 => {
    const k = ease(clamp((t - start) / (end - start), 0, 1))
    return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k) }
  }
  const overPick = { x: PICK.x, y: LIFT }
  const overPlace = { x: PLACE.x, y: LIFT }
  if (t < 0.18) return leg({ x: 0, y: LIFT }, overPick, 0, 0.18)
  if (t < 0.28) return leg(overPick, PICK, 0.18, 0.28)
  if (t < 0.38) return leg(PICK, overPick, 0.28, 0.38)
  if (t < 0.6) return leg(overPick, overPlace, 0.38, 0.6)
  if (t < 0.7) return leg(overPlace, PLACE, 0.6, 0.7)
  if (t < 0.8) return leg(PLACE, overPlace, 0.7, 0.8)
  return leg(overPlace, { x: 0, y: LIFT }, 0.8, 1)
}

export { RobotLoader }
