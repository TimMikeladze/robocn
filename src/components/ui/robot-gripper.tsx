"use client"

/**
 * robot-gripper — an end effector on its own.
 *
 * The jaws of `robot-arm`, drawn big enough to be the subject rather than the
 * detail at the end of a limb: a clamp for an empty state, a status icon for a
 * cell that is holding something, a control for an opening you own.
 */

import * as React from "react"

import { clamp } from "@/lib/robocn/kinematics"
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

const VIEW = 120
/** Jaw travel either side of the centre line, in view units. */
const TRAVEL = 13

export type GripperFingers = "parallel" | "angular"

export interface RobotGripperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** How far open, 0 closed to 1 wide. Out-of-range and non-finite values clamp. */
  opening?: number
  /**
   * Jaw shape. Parallel fingers stay square to the part; angular fingers close
   * onto a round one.
   */
  fingers?: GripperFingers
  /** Draw a part clamped between the jaws. */
  holding?: boolean
  /** Powered: the status lamp pulses. */
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
}

function RobotGripper({
  opening = 0.6,
  fingers = "parallel",
  holding = false,
  active = false,
  variant = "solid",
  size = "md",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  "aria-label": ariaLabel,
  ...props
}: RobotGripperProps) {
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
  // A slider bound straight to this prop can hand over NaN; clamp before the
  // number reaches any geometry, or the whole drawing disappears.
  const open = Number.isFinite(opening) ? clamp(opening, 0, 1) : 0
  const offset = px(open * TRAVEL)

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? `Robot gripper, ${Math.round(open * 100)}% open`}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={width}
      height={width}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {/* Tool flange and wrist: what it bolts to. */}
      <rect x={44} y={8} width={32} height={7} rx={2} {...metalSurface} />
      <rect x={38} y={15} width={44} height={26} rx={5} {...shell} />
      {[46, 60, 74].map((x) => (
        <circle key={x} cx={x} cy={20} r={2.2} fill={palette.metal} opacity={0.75} />
      ))}
      <rect x={30} y={41} width={60} height={12} rx={4} {...darkSurface} />

      {/* Rails the jaws ride on. */}
      <rect x={34} y={53} width={52} height={4} rx={2} {...metalSurface} />

      {[-1, 1].map((side) => (
        <g
          key={side}
          data-jaw={side < 0 ? "left" : "right"}
          transform={`translate(${px(side * offset)} 0)`}
        >
          <rect
            x={side < 0 ? 44 : 62}
            y={55}
            width={14}
            height={12}
            rx={3}
            {...darkSurface}
          />
          <path d={fingerPath(side, fingers)} {...metalSurface} />
          {/* Grip pad: the face that actually touches the part. */}
          <rect
            x={side < 0 ? 55 : 60}
            y={fingers === "parallel" ? 72 : 78}
            width={5}
            height={fingers === "parallel" ? 22 : 14}
            rx={1.5}
            fill={palette.dark}
            opacity={0.85}
          />
        </g>
      ))}

      {holding ? (
        <rect
          x={48}
          y={78}
          width={24}
          height={20}
          rx={3}
          fill={palette.accent}
          opacity={0.9}
        />
      ) : null}

      <circle
        cx={60}
        cy={28}
        r={3.4}
        fill={palette.glow}
        className={active ? "robocn-pulse" : undefined}
      />
    </svg>
  )
}

/**
 * Jaw outline. Parallel fingers drop straight so the faces stay square to the
 * part; angular fingers swing in, which is how you hold something round.
 */
function fingerPath(side: number, fingers: GripperFingers) {
  const sign = side < 0 ? 1 : -1
  const root = side < 0 ? 51 : 69
  if (fingers === "parallel") {
    return [
      `M ${px(root - sign * 5)} 64`,
      `L ${px(root + sign * 5)} 64`,
      `L ${px(root + sign * 5)} 98`,
      `L ${px(root - sign * 5)} 98`,
      "Z",
    ].join(" ")
  }
  return [
    `M ${px(root - sign * 5)} 64`,
    `L ${px(root + sign * 5)} 64`,
    `L ${px(root + sign * 9)} 86`,
    `L ${px(root + sign * 2)} 96`,
    `L ${px(root - sign * 4)} 92`,
    "Z",
  ].join(" ")
}

export { RobotGripper }
