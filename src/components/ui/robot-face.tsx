"use client"

/**
 * robot-face — a head that watches the pointer.
 *
 * Not a machine that does work: a face for the thing that is doing work.
 * Moods cover the states a product actually needs — waiting, succeeded,
 * thinking, failed, asleep — and the eyes follow the cursor anywhere on the
 * page, which is what makes it read as alive.
 */

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

const VIEW = 120

export type RobotMood =
  | "idle"
  | "happy"
  | "curious"
  | "focused"
  | "error"
  | "sleeping"

export interface RobotFaceProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  mood?: RobotMood
  /** Follow the pointer anywhere on the page. */
  track?: boolean
  /** Look here instead, in -1..1 on both axes. */
  look?: Vec2 | null
  blink?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
  /** Stencilled under the chin. */
  label?: string
  showAntenna?: boolean
}

function RobotFace({
  mood = "idle",
  track = true,
  look = null,
  blink = true,
  variant = "solid",
  size = "md",
  label,
  showAntenna = true,
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
}: RobotFaceProps) {
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
  const asleep = mood === "sleeping"

  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: track && !asleep && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => {
      // Unit coordinates run outside 0..1 once the pointer leaves the box, so
      // clamp the gaze rather than letting the eyes leave their sockets.
      const x = (unit.x - 0.5) * 2
      const y = (unit.y - 0.5) * 2
      const distance = Math.hypot(x, y) || 1
      const limit = Math.min(1, distance) / distance
      return { x: x * limit, y: y * limit }
    }, []),
  })

  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const shift = {
    x: clamp(gaze.x, -1, 1) * 3.4,
    y: clamp(gaze.y, -1, 1) * 2.6,
  }

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)
  const eyeColor = mood === "error" ? palette.shell : palette.accent

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot face, ${mood}`}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={width}
      height={width}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {showAntenna ? (
        <g>
          <line
            x1={60}
            y1={22}
            x2={60}
            y2={11}
            stroke={palette.dark}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle
            cx={60}
            cy={9}
            r={4}
            fill={eyeColor}
            className={asleep ? undefined : "robocn-pulse"}
          />
        </g>
      ) : null}

      {/* Ear plates, behind the head. */}
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={side < 0 ? 8 : 100}
          y={52}
          width={12}
          height={22}
          rx={4}
          {...metalSurface}
        />
      ))}

      <rect x={18} y={20} width={84} height={78} rx={18} {...shell} />
      <rect x={26} y={30} width={68} height={48} rx={12} {...darkSurface} />

      <g className={blink && !asleep ? "robocn-blink" : undefined} style={{ transformOrigin: "60px 52px" }}>
        {asleep ? (
          [-1, 1].map((side) => (
            <path
              key={side}
              d={`M ${60 + side * 18 - 7} 54 q 7 6 14 0`}
              fill="none"
              stroke={eyeColor}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))
        ) : mood === "happy" ? (
          [-1, 1].map((side) => (
            <path
              key={side}
              d={`M ${60 + side * 18 - 8} 56 q 8 -11 16 0`}
              fill="none"
              stroke={eyeColor}
              strokeWidth={3.4}
              strokeLinecap="round"
            />
          ))
        ) : (
          [-1, 1].map((side) => (
            <g key={side}>
              <ellipse
                cx={60 + side * 18}
                cy={52}
                rx={mood === "focused" ? 6 : 8}
                ry={mood === "focused" ? 4.5 : 8.5}
                fill={palette.dark}
                stroke={eyeColor}
                strokeWidth={1.2}
                opacity={0.9}
              />
              <circle
                cx={px(60 + side * 18 + shift.x)}
                cy={px(52 + shift.y)}
                r={mood === "curious" ? 4.4 : 3.6}
                fill={eyeColor}
              />
              <circle
                cx={px(60 + side * 18 + shift.x + 1.2)}
                cy={px(52 + shift.y - 1.2)}
                r={1.1}
                fill={palette.metal}
                opacity={0.9}
              />
            </g>
          ))
        )}
      </g>

      <Mouth mood={mood} palette={palette} />

      {/* Status lamps along the chin. */}
      {[-1, 0, 1].map((slot, index) => (
        <circle
          key={slot}
          cx={60 + slot * 9}
          cy={88}
          r={2.2}
          fill={index === 1 && !asleep ? palette.accent : palette.metal}
          opacity={index === 1 ? 1 : 0.5}
        />
      ))}

      {label ? (
        <text
          x={60}
          y={112}
          textAnchor="middle"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          letterSpacing="1"
          fill={palette.grid}
        >
          {label}
        </text>
      ) : null}
    </svg>
  )
}

function Mouth({ mood, palette }: { mood: RobotMood; palette: ReturnType<typeof resolveRobotPalette> }) {
  const stroke = mood === "error" ? palette.shell : palette.accent
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 3,
    strokeLinecap: "round" as const,
  }
  switch (mood) {
    case "happy":
      return <path d="M 48 66 q 12 10 24 0" {...common} />
    case "error":
      return <path d="M 48 70 q 12 -10 24 0" {...common} />
    case "curious":
      return <circle cx={60} cy={68} r={3.4} fill={stroke} />
    case "focused":
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={49 + i * 6}
              y={64}
              width={3.4}
              height={i % 2 ? 7 : 4}
              rx={1}
              fill={stroke}
              className="robocn-pulse"
              style={{ animationDelay: `${i * -0.2}s` }}
            />
          ))}
        </g>
      )
    case "sleeping":
      return <path d="M 52 68 h 16" {...common} strokeWidth={2.4} />
    default:
      return <path d="M 50 68 h 20" {...common} />
  }
}

export { RobotFace }
