"use client"

/**
 * servo-motor — a positional servo with a horn you can turn.
 *
 * The three uncontrolled behaviors are the three things a servo actually does
 * on a bench: sweep its travel, step between positions, or hunt a degree or
 * two around a setpoint. Grab the horn and it follows the pointer; let go and
 * it slews back at its own rate, which is where the servo feel comes from.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, capsulePath, extrudedPath, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, roundedFootprint, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 160
const VIEW_HEIGHT = 180
/** The output shaft, in view units. Drags are measured from here. */
const HUB = { x: 80, y: 69 }
/** Degrees per second while slewing to a new position. */
const SLEW_RATE = 210
/** Positions the `step` behavior indexes through, in order. */
const STEPS = [-90, 0, 90, 0]
/** The servo is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** How deep the can and the tabs are — a number the front never had to give. */
const CASE_DEEP = 15
const TAB_DEEP = 12

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}


export type ServoHorn = "single" | "double" | "cross"
export type ServoBehavior = "sweep" | "step" | "hunt" | "static"

export interface ServoMotorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled clockwise angle, clamped to -180..180 degrees. Zero points up. */
  angle?: number
  /** What the shaft does when `angle` is not supplied. */
  behavior?: ServoBehavior
  /** Where the camera stands. One servo, four projections. */
  view?: RobotView
  /** Cycles per second: one sweep, one pass through the step positions. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the horn around the hub, or arrow-key it. */
  interactive?: boolean
  onAngleChange?: (angle: number) => void
  horn?: ServoHorn
  showCable?: boolean
  showScale?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ServoMotor({
  angle, behavior = "sweep", view = NATIVE_VIEW, speed = 0.25, animate = true, paused = false, phase = 0,
  interactive = false, onAngleChange,
  horn = "double", showCable = true, showScale = true, label,
  size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: ServoMotorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = angle !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled
    ? (Number.isFinite(angle) ? clamp(angle, -180, 180) : 0)
    : held
  const goal = React.useCallback((clock: number) => servoGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const rotation = clamp(motion.value, -180, 180)

  const apply = React.useCallback((next: number) => {
    const bounded = clamp(next, -180, 180)
    setHeld(bounded)
    onAngleChange?.(bounded)
  }, [onAngleChange, setHeld])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => {
      // Aim the horn at the pointer: clockwise degrees from straight up.
      const dx = unit.x * VIEW_WIDTH - HUB.x
      const dy = unit.y * VIEW_HEIGHT - HUB.y
      if (Math.hypot(dx, dy) < 4) return
      apply((Math.atan2(dx, -dy) * 180) / Math.PI)
    }, [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const arms = horn === "cross" ? [0, 90, 180, 270] : horn === "single" ? [0] : [0, 180]
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const readout = px(rotation)

  // The drawing is a front elevation of the servo, so it goes through `wall`
  // where it already stands and comes out untouched straight on. The can, the
  // mounting tabs, the boss and the horn all have a depth through the machine
  // that only reads once the camera comes round.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), HUB.x, HUB.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const rise = (y: number) => HUB.y - y
  /** A point on the machine, `deep` units toward the reader. */
  const at = (x: number, y: number, deep = 0) =>
    camera.project(HUB.x - x, rise(y), -deep)
  /** A block through the machine, `deep` either side of the mid plane. */
  const box = (x0: number, x1: number, deep: number, top: number, bottom: number) =>
    extrudedPath(
      roundedFootprint(Math.abs(x1 - x0) / 2, deep, 2, 4).map((point) => ({
        x: point.x + HUB.x - (x0 + x1) / 2,
        y: point.y,
      })),
      camera,
      rise(top),
      rise(bottom),
    )
  /** A cylinder standing out of the case toward the reader. */
  const boss = (radius: number, from: number, to: number) =>
    capsulePath(at(HUB.x, HUB.y, from), at(HUB.x, HUB.y, to), radius)

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Servo motor, ${readout} degrees, ${horn} horn, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -180 : undefined}
      aria-valuemax={interactive ? 180 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 15 : 5, 45)
        if (delta !== 0) apply(rotation + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(180)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 160 180" width={width} height={width * 180 / 160}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} data-view={view} {...props}>
      {offAxis && <g data-solids transform={`translate(${HUB.x} ${HUB.y})`}>
        {[47, 121].map(y => <path key={y} d={box(35, 125, TAB_DEEP, y - 7, y + 7)} {...machined} />)}
        <path d={box(49, 111, CASE_DEEP, 35, 135)} {...shell} />
        <path d={box(55, 105, CASE_DEEP - 2, 92, 125)} {...cast} />
        <path d={boss(22, 0, 7)} {...cast} />
        <path d={boss(17, 6, 11)} {...machined} />
        <path d={boss(8, 10, 15)} {...shell} />
      </g>}
      <Frame {...frame}>
      <g data-motor>
        {showCable && <g fill="none" strokeWidth={2}>
          <path d="M 70 133 V 151 Q 70 160 58 160 H 25" stroke={palette.dark} />
          <path d="M 74 133 V 154 Q 74 164 58 164 H 25" stroke={palette.shell} />
          <path d="M 78 133 V 157 Q 78 168 58 168 H 25" stroke={palette.metal} />
          <rect x={18} y={157} width={9} height={14} rx={2} {...cast} />
        </g>}
        <rect x={35} y={40} width={90} height={14} rx={3} {...machined} />
        <rect x={35} y={114} width={90} height={14} rx={3} {...machined} />
        {[43, 117].flatMap(x => [47, 121].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} {...cast} />))}
        <rect x={49} y={35} width={62} height={100} rx={7} {...shell} />
        <rect x={55} y={92} width={50} height={33} rx={3} {...cast} />
        {[100, 107, 114].map(y => <path key={y} d={`M 63 ${y} H 97`} stroke={palette.metal} strokeWidth={1.2} />)}
        <circle cx={80} cy={69} r={22} {...cast} />
        <circle cx={80} cy={69} r={17} {...machined} />
      </g>
      {showScale && <g transform="translate(80 69)" fill="none" stroke={palette.grid} strokeWidth={0.6}>
        <circle r={48} strokeDasharray="1 3" />
        {[-180, -90, 0, 90].map(degrees => <path key={degrees} d="M 0 -45 V -50" transform={`rotate(${degrees})`} />)}
      </g>}
      <g transform="translate(80 69)">
        <g data-horn transform={`rotate(${readout})`}>
          {arms.map(degrees => <g key={degrees} data-horn-arm transform={`rotate(${degrees})`}>
            <path d="M -6 0 L -4 -35 Q 0 -42 4 -35 L 6 0 Z" {...machined} />
            {[16, 24, 32].map(y => <circle key={y} cy={-y} r={1.6} fill={palette.dark} />)}
          </g>)}
          <circle r={8} {...shell} />
          <circle r={3.5} {...cast} />
          <path d="M -2 0 h 4 M 0 -2 v 4" stroke={palette.metal} strokeWidth={0.7} />
          <path d="M -2 -8 L 0 -11 L 2 -8" fill="none" stroke={palette.accent} strokeWidth={1} />
        </g>
      </g>
      </Frame>
      <text x={80} y={149} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>{readout}°</text>
      {label && <text x={90} y={177} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={4.5} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

/**
 * Where the shaft is aiming at `clock`. `step` deliberately returns a square
 * wave: the slew rate in {@link ServoMotorProps.speed}'s loop is what turns it
 * into the travel between positions, the way a real servo gets there.
 */
export function servoGoal(behavior: ServoBehavior, clock: number) {
  if (behavior === "static") return 0
  const t = Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0
  switch (behavior) {
    case "step":
      return STEPS[Math.min(STEPS.length - 1, Math.floor(t * STEPS.length))]
    case "hunt":
      return Math.sin(t * Math.PI * 12) * 1.6 + Math.sin(t * Math.PI * 22) * 0.9
    default:
      return Math.sin(t * Math.PI * 2) * 90
  }
}

export { ServoMotor }
