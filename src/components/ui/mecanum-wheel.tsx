"use client"

/**
 * mecanum-wheel — a wheel whose rollers do the steering.
 *
 * The rollers are modelled, not drawn: each barrel sits on the rim with its
 * axis tilted 45° out of the wheel plane, and both of its ends are projected
 * through the shared camera. That is why the skew reverses when you flip the
 * hand and why it is invisible dead-on and obvious in `iso` — which is exactly
 * what the part is for. A holonomic base needs one of each hand per corner.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
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

const VIEW = 160
const CENTRE = { x: 80, y: 76 }
/** Rim radius the roller centres sit on. */
const RIM = 54
const ROLLER_RADIUS = 8.5
const ROLLER_LENGTH = 34
/** Degrees of hub per second while slewing back to the behaviour. */
const SLEW_RATE = 300
const CLICK_SLOP = 3
/** Drawn disc-on from starboard, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const fits: Record<RobotView, number> = { plan: 0.92, front: 0.92, profile: 1, iso: 0.9 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type MecanumBehavior = "roll" | "crab" | "static"
export type MecanumHand = "left" | "right"

export interface MecanumWheelProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled hub angle in degrees. Omit to run `behavior`. */
  angle?: number
  /** What the hub does when `angle` is not supplied. */
  behavior?: MecanumBehavior
  /** Where the camera stands. One wheel, four projections. */
  view?: RobotView
  /** Hub turns per second rolling, or crab cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the hub to spin it, or arrow-key it. */
  interactive?: boolean
  onAngleChange?: (angle: number) => void
  /** Which way the rollers lean. A base needs both. */
  hand?: MecanumHand
  /** Barrel rollers round the rim, clamped to 6–14. */
  rollers?: number
  showHub?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function MecanumWheel({
  angle,
  behavior = "roll",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onAngleChange,
  hand = "right",
  rollers = 9,
  showHub = true,
  label,
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  ...props
}: MecanumWheelProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = angle !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(angle) ? angle : 0) : held
  const goal = React.useCallback((clock: number) => mecanumGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: behavior === "roll" ? Math.max(SLEW_RATE, Math.abs(speed) * 720) : SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const spin = Number.isFinite(motion.value) ? motion.value : 0

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onAngleChange?.(wrap360(next))
    },
    [onAngleChange, setHeld],
  )
  const press = React.useRef<{ from: number; at: number; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const dx = unit.x * VIEW - CENTRE.x
        const dy = unit.y * VIEW - CENTRE.y
        if (Math.hypot(dx, dy) < 8) return
        const pointer = (Math.atan2(dx, -dy) * 180) / Math.PI
        if (!press.current) {
          press.current = { from: motion.value, at: pointer, moved: false }
          return
        }
        const swept = wrapSigned(pointer - press.current.at)
        if (Math.abs(swept) > CLICK_SLOP) press.current.moved = true
        if (press.current.moved) apply(press.current.from + swept)
      },
      [apply, motion.value],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
    }, []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const count = Number.isFinite(rollers) ? clamp(Math.round(rollers), 6, 14) : 9
  const lean = hand === "left" ? -45 : 45
  const half = ROLLER_LENGTH / 2
  const halfWidth = px(half * Math.cos(toRadians(45)))
  const readout = px(wrap360(spin))

  // World frame: x is the axle (starboard), the wheel turns in the y–z plane.
  // Screen is whatever the shared camera makes of it, in every view.
  const camera = robotCamera(view)
  const to = (p: Vec3): Vec2 => camera.project(p.x, p.y, p.z)
  const barrels = Array.from({ length: count }, (_, i) => {
    const psi = toRadians(spin + (i * 360) / count)
    const centre: Vec3 = { x: 0, y: Math.cos(psi) * RIM, z: -Math.sin(psi) * RIM }
    // The roller axis: 45° out of the wheel plane, toward the rim tangent.
    const tangent: Vec3 = { x: 0, y: -Math.sin(psi), z: -Math.cos(psi) }
    const tilt = toRadians(lean)
    const axis: Vec3 = {
      x: Math.cos(tilt),
      y: Math.sin(tilt) * tangent.y,
      z: Math.sin(tilt) * tangent.z,
    }
    const a = to({ x: centre.x - axis.x * half, y: centre.y - axis.y * half, z: centre.z - axis.z * half })
    const b = to({ x: centre.x + axis.x * half, y: centre.y + axis.y * half, z: centre.z + axis.z * half })
    return { index: i, a, b, depth: camera.depth(centre.x, centre.y, centre.z) }
  })
  const hubDepth = camera.depth(0, 0, 0)
  const far = barrels.filter((barrel) => barrel.depth <= hubDepth)
  const near = barrels.filter((barrel) => barrel.depth > hubDepth)
  /** A disc on the axle, drawn as the capsule between its two faces. */
  const disc = (radius: number, from: number, toDepth: number) =>
    capsulePath(to({ x: from, y: 0, z: 0 }), to({ x: toDepth, y: 0, z: 0 }), radius)

  const roller = (barrel: (typeof barrels)[number]) => (
    <g key={barrel.index} data-roller={barrel.index}>
      <path d={capsulePath(barrel.a, barrel.b, ROLLER_RADIUS)} {...shell} />
      <path
        d={`M ${px(barrel.a.x)} ${px(barrel.a.y)} L ${px(barrel.b.x)} ${px(barrel.b.y)}`}
        stroke={palette.dark}
        strokeWidth={0.8}
        opacity={0.5}
        fill="none"
      />
      <circle cx={px(barrel.a.x)} cy={px(barrel.a.y)} r={2} {...machined} />
      <circle cx={px(barrel.b.x)} cy={px(barrel.b.y)} r={2} {...machined} />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Mecanum wheel, ${hand} hand, ${count} rollers, hub at ${readout} degrees, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 30 : 10, 90)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 160 160"
      width={width}
      height={width}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      {...props}
    >
      <g
        data-wheel
        transform={`translate(${CENTRE.x} ${CENTRE.y}) ${fits[view] === 1 ? "" : `scale(${fits[view] ?? 1})`}`.trimEnd()}
      >
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.6}>
            <circle r={RIM} strokeDasharray="2 3" />
            <path d={`M ${-RIM - 14} 0 H ${RIM + 14}`} strokeDasharray="6 2 2 2" />
          </g>
        )}
        {far.map(roller)}
        {showHub && (
          <g data-hub>
            <path d={disc(RIM - ROLLER_RADIUS - 2, -halfWidth, halfWidth)} {...cast} />
            <path
              d={disc(RIM - ROLLER_RADIUS - 6, -halfWidth - 1, halfWidth + 1)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.6}
            />
            {Array.from({ length: 6 }, (_, i) => {
              const psi = toRadians(spin + i * 60)
              const rim = RIM - ROLLER_RADIUS - 6
              const a = to({ x: halfWidth + 2, y: Math.cos(psi) * 9, z: -Math.sin(psi) * 9 })
              const b = to({ x: halfWidth + 2, y: Math.cos(psi) * rim, z: -Math.sin(psi) * rim })
              return <path key={i} d={capsulePath(a, b, 3.4)} {...shell} />
            })}
            <path d={disc(8, -halfWidth - 1, halfWidth + 1)} {...machined} />
            <path d={disc(4, halfWidth + 1, halfWidth + 13)} {...cast} />
            <circle
              cx={px(to({ x: halfWidth + 13, y: 0, z: 0 }).x)}
              cy={px(to({ x: halfWidth + 13, y: 0, z: 0 }).y)}
              r={2.6}
              fill={palette.accent}
            />
          </g>
        )}
        {near.map(roller)}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={80} y={148} fontSize={5}>
          {`${hand.toUpperCase()} HAND / ${count} ROLLERS / ${readout}°`}
        </text>
        {label && (
          <text x={80} y={156} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Hub angle at `clock`. `crab` reverses each half cycle, the way a holonomic
 *  base drives one corner when it goes sideways instead of forward. */
export function mecanumGoal(behavior: MecanumBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "crab") return Math.sin(clock * Math.PI * 2) * 180
  return clock * 360
}

const wrap360 = (value: number) => (Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0)

const wrapSigned = (value: number) => {
  const wrapped = wrap360(value)
  return wrapped > 180 ? wrapped - 360 : wrapped
}

export { MecanumWheel }
