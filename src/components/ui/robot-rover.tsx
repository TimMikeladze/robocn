"use client"

/**
 * robot-rover — a ground robot, seen from above.
 *
 * Uncontrolled it drives: a patrol of straight legs and square turns, or a
 * wandering drift. The front wheels are not animated separately — they are
 * turned by how far the chassis still has to rotate, which is why the rover
 * reads as steering into its turns rather than sliding through them. Point at
 * it and it comes round to face you.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW = 180
/** Degrees per second the chassis comes round. */
const TURN_RATE = 90
/** Steering angle per degree of heading still to cover. */
const STEER_GAIN = 0.9
/** Wheel turns per second of driving. */
const TREAD_RATE = 1.4
/** The rover is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** Heights the plan view never had to name: the wheels' axis, the chassis
 *  the wheels carry, the upper deck and the sensor head on top of it. */
const WHEEL_RADIUS = 16
const HALF_TRACK = 8
const CHASSIS_FLOOR = 11
const CHASSIS_TOP = 34
const DECK_TOP = 42
const HEAD_TOP = 54

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type RoverBehavior = "patrol" | "wander" | "pointer" | "static"

export interface RobotRoverProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Where the camera stands. One rover, four projections. */
  view?: RobotView
  /** Clockwise degrees from the top of the drawing. Omit to run `behavior`. */
  heading?: number
  /** What the rover does when `heading` is not supplied. */
  behavior?: RoverBehavior
  /** Legs of the patrol per second, or drift cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Press and drag to send the rover a bearing; arrow keys turn it. */
  interactive?: boolean
  onHeadingChange?: (heading: number) => void
  /** Front-wheel steering in degrees, clamped to -45..45. Omit to steer itself. */
  steering?: number
  wheels?: 4 | 6
  /** Controlled tread travel. Whole turns produce the same drawing. */
  wheelTravel?: number
  showSensor?: boolean
  /** Illuminate the front lamps. Omit and they light while it is driving. */
  active?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotRover({
  heading, view = NATIVE_VIEW, behavior = "patrol", speed = 0.3, animate = true, paused = false, phase = 0,
  interactive = false, onHeadingChange,
  steering, wheels = 4, wheelTravel,
  showSensor = true, active, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: RobotRoverProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = heading !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  // Hover aims the rover in pointer mode; a press aims it whatever the mode,
  // which is the only way a touch device can.
  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !controlled && !paused,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: (unit.x - 0.5) * VIEW,
      y: (unit.y - 0.5) * VIEW,
    }), []),
  })
  const bearing = pointer.target ? degrees(pointer.target) : null

  const hold = controlled ? (Number.isFinite(heading) ? heading : 0) : held
  // The goal has to be expressed in the turn the rover is already in, or a
  // patrol that has been round once would unwind itself instead of carrying on.
  const headingRef = React.useRef(hold ?? 0)
  const aim = React.useCallback(
    (clock: number) => roverGoal(behavior, clock, bearing),
    [behavior, bearing],
  )
  const goal = React.useCallback(
    (clock: number) => nearestTurn(headingRef.current, aim(clock)),
    [aim],
  )
  const motion = useRobotScalar(goal, {
    rate: TURN_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const angle = wrap360(motion.value)
  React.useEffect(() => {
    headingRef.current = motion.value
  })

  // Steering is the heading error, not a second animation: the wheels point
  // where the chassis is still trying to get to.
  const error = wrapSigned(aim(motion.clock) - motion.value)
  const steer = steering !== undefined
    ? (Number.isFinite(steering) ? clamp(steering, -45, 45) : 0)
    : clamp(error * STEER_GAIN, -45, 45)
  const driving = !controlled && behavior !== "static" && animate && !paused
  const travel = wheelTravel !== undefined
    ? (Number.isFinite(wheelTravel) ? ((wheelTravel % 1) + 1) % 1 : 0)
    : ((motion.clock * TREAD_RATE % 1) + 1) % 1
  const lamps = active ?? driving

  const apply = React.useCallback((next: number) => {
    setHeld(next)
    onHeadingChange?.(wrap360(next))
  }, [onHeadingChange, setHeld])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => {
      const to = { x: (unit.x - 0.5) * VIEW, y: (unit.y - 0.5) * VIEW }
      if (Math.hypot(to.x, to.y) < 8) return
      apply(nearestTurn(headingRef.current, degrees(to)))
    }, [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const axles = wheels === 6 ? [-32, 0, 32] : [-32, 32]
  const wheelClip = `rover-wheel-${React.useId().replace(/:/g, "")}`
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The drawing is the ground plane the rover drives on, so it goes through
  // `plane` and comes out untouched from above — heading included, since the
  // camera carries the turn. The wheels are cylinders and the chassis a box,
  // neither of which a plan view ever had to have.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane(0, angle)
  const turn = toRadians(angle)
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  /** A point on the rover: turned by its heading, then projected. */
  const at = (x: number, z: number, y: number) =>
    camera.project(x * cos - z * sin, y, x * sin + z * cos)
  const solid = (footprint: Vec2[], top: number, bottom: number) =>
    extrudedPath(footprint, camera, top, bottom, angle)

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`${axles.length * 2}-wheel robot rover, heading ${Math.round(angle)} degrees, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? px(angle) : undefined}
      aria-valuetext={interactive ? `heading ${Math.round(angle)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 45 : 15, 90)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Home") apply(nearestTurn(motion.value, 0))
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>
      <defs><clipPath id={wheelClip}><rect x={-8} y={-16} width={16} height={32} rx={4} /></clipPath></defs>
      {variant === "blueprint" && <g stroke={palette.grid} strokeWidth={0.5} opacity={0.5}>
        <circle cx={90} cy={90} r={72} fill="none" strokeDasharray="2 3" />
        <path d="M 90 12 V 168 M 12 90 H 168" strokeDasharray="2 3" />
      </g>}
      {offAxis && <g data-solids transform="translate(90 90)">
        {axles.map((z, axle) => [-1, 1].map(side => (
          <path
            key={`${axle}-${side}`}
            d={capsulePath(
              at(side * 43 - HALF_TRACK, z, WHEEL_RADIUS),
              at(side * 43 + HALF_TRACK, z, WHEEL_RADIUS),
              WHEEL_RADIUS,
            )}
            {...cast}
          />
        )))}
        {axles.map(z => (
          <path key={z} d={solid(roundedFootprint(43, 3, 1.5, 3).map(p => ({ x: p.x, y: p.y + z })), WHEEL_RADIUS + 3, WHEEL_RADIUS - 3)} {...machined} />
        ))}
        <path d={solid(roundedFootprint(30, 48, 12, 6), CHASSIS_TOP, CHASSIS_FLOOR)} {...shell} />
        <path d={solid(roundedFootprint(23, 21, 5, 4).map(p => ({ x: p.x, y: p.y + 6 })), DECK_TOP, CHASSIS_TOP)} {...machined} />
        {showSensor && (
          <path d={solid(circleFootprint(0, -11, 13, 12), HEAD_TOP, DECK_TOP)} {...cast} />
        )}
      </g>}
      <g data-chassis data-view={view} transform={`translate(90 90) ${ground}`}>
        {axles.map((y, axle) => <g key={y}>
          <rect x={-43} y={y - 3} width={86} height={6} rx={2} {...machined} />
          {[-1, 1].map(side => <g key={side} data-wheel={`${axle}-${side}`}
            data-steering={axle === 0 ? px(steer) : 0}
            transform={`translate(${side * 43} ${y}) rotate(${axle === 0 ? px(steer) : 0})`}>
            <rect x={-8} y={-16} width={16} height={32} rx={4} {...cast} />
            <g clipPath={`url(#${wheelClip})`}>
              <g data-tread transform={`translate(0 ${px(travel * 6)})`} stroke={palette.metal} strokeWidth={1} opacity={0.65}>
                {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M -6 ${i * 6 - 21} h 12`} />)}
              </g>
            </g>
          </g>)}
        </g>)}
        <rect x={-30} y={-48} width={60} height={96} rx={12} {...shell} />
        <rect x={-23} y={-40} width={46} height={13} rx={4} {...cast} />
        {[-17, 17].map(x => <rect key={x} x={x - 4} y={-37} width={8} height={4} rx={1} fill={lamps ? palette.accent : palette.metal} />)}
        <rect x={-22} y={-15} width={44} height={42} rx={5} {...machined} />
        {[-13, -6, 1, 8].map(y => <path key={y} d={`M -13 ${y + 10} h 26`} stroke={palette.dark} strokeWidth={2} />)}
        {showSensor && <g data-sensor transform={`rotate(${px(-error * 0.4)})`}>
          <circle cy={-11} r={13} {...cast} />
          <circle cy={-11} r={9} {...shell} />
          <circle cy={-11} r={4} fill={palette.accent} />
          <path d="M 0 -13 v -7" stroke={palette.dark} strokeWidth={1.5} />
        </g>}
        <path d="M -7 -22 L 0 -27 L 7 -22" fill="none" stroke={palette.accent} strokeWidth={1.5} />
        <rect x={-21} y={37} width={42} height={5} rx={2} {...cast} />
        {[-24, 24].flatMap(x => [-23, 31].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={palette.dark} />))}
      </g>
      {label && <text x={90} y={176} textAnchor="middle" fontSize={5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

/** Clockwise degrees from the top for a vector in drawing coordinates. */
const degrees = (to: Vec2) => (Math.atan2(to.x, -to.y) * 180) / Math.PI

const wrap360 = (value: number) => (Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0)

const wrapSigned = (value: number) => {
  const wrapped = wrap360(value)
  return wrapped > 180 ? wrapped - 360 : wrapped
}

const nearestTurn = (from: number, goal: number) =>
  goal + 360 * Math.round((from - goal) / 360)

/**
 * The bearing the rover is trying to hold at `clock`. Patrol is a staircase —
 * drive, turn a quarter, drive — and the turn rate is what draws the corner.
 */
export function roverGoal(behavior: RoverBehavior, clock: number, bearing: number | null = null) {
  if (behavior === "static") return 0
  if (behavior === "pointer") return bearing ?? 0
  const t = Number.isFinite(clock) ? clock : 0
  if (behavior === "wander") {
    return Math.sin(t * Math.PI * 2) * 55 + Math.sin(t * Math.PI * 4.6) * 22
  }
  return Math.floor(t) * 90
}

export { RobotRover }
