"use client"

/**
 * robot-foot — one ankle, one toe hinge, and the load moving between them.
 *
 * A foot does not arrive flat. Through a stance the ankle runs dorsiflexed at
 * heel strike, flat through mid-stance and plantarflexed at push-off, and the
 * part actually carrying moves from the heel to the ball to the toe. All of
 * that is `footRoll` from `skeleton-kinematics`; this machine is that function
 * with a chassis drawn around it.
 *
 * The toe plate is hinged at the ball rather than welded to the sole, which is
 * why rolling forward lifts the heel instead of driving the toe into the floor.
 * The ankle strut's length is read off the joint angle, so it is a drawn
 * consequence of the pose rather than an illustration of one.
 *
 * The loads are geometry — which parts of the sole are still on the floor — and
 * not forces. Nothing here weighs anything.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, distance2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  footPoints,
  footRoll,
  rollPoint,
  type SkeletonSide,
} from "@/lib/robocn/skeleton"
import {
  capsulePath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type FootBehavior = "step" | "rock" | "static"

const VIEW_WIDTH = 170
const VIEW_HEIGHT = 140
/** World origin on screen: where the floor meets the ankle's own vertical. */
const CENTRE = { x: 62, y: 104 }
const SCALE = 1.55
/** Fraction of a step the foot spends on the floor. */
const DUTY = 0.72
/** How far the foot rises on the way back. */
const LIFT = 13
/** Stance fraction per second while easing back into the behaviour. */
const SLEW_RATE = 1.6
const NATIVE_VIEW: RobotView = "profile"

const P = defaultProportions
const HALF_WIDTH = 8
/** Ankle joint to the top of the shin stub. */
const SHIN = 46

const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.92 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The chassis between the heel and the ball, measured from the ankle joint it
 * pitches about: `y` runs up from the ankle, so the sole line is `-P.ankle`.
 */
const chassis: Vec2[] = [
  { x: -P.heel, y: -P.ankle },
  { x: -P.heel - 1.5, y: -P.ankle + 3.6 },
  { x: -P.heel + 1, y: -P.ankle + 8.8 },
  { x: 3, y: -P.ankle + 11.5 },
  { x: P.sole - 2, y: -P.ankle + 7.2 },
  { x: P.sole + 1, y: -P.ankle + 2.6 },
  { x: P.sole + 1, y: -P.ankle },
]

/** The toe plate, measured from the ball it hinges on — already on the sole. */
const toePlate: Vec2[] = [
  { x: -1.5, y: 0 },
  { x: P.toe, y: 0 },
  { x: P.toe - 1.8, y: 3.2 },
  { x: -1.5, y: 5.4 },
]

/** A contact pad lying on a sole line at `base`. */
const pad = (from: number, to: number, height: number, base: number): Vec2[] => [
  { x: from, y: base - 0.6 },
  { x: to, y: base - 0.6 },
  { x: to, y: base + height },
  { x: from, y: base + height },
]

export interface RobotFootProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled stance, 0 at heel strike to 1 at toe-off. Omit to run `behavior`. */
  roll?: number
  /** What the foot does when `roll` is not supplied. */
  behavior?: FootBehavior
  /** A foot is handed; `left` is `right` mirrored across the machine's axis. */
  side?: SkeletonSide
  /** Where the camera stands. One foot, four projections. */
  view?: RobotView
  /** Steps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag left and right to roll the foot heel to toe. */
  interactive?: boolean
  onRollChange?: (roll: number) => void
  /** Tint the heel, ball and toe pads by how much of each is still down. */
  showLoad?: boolean
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotFoot({
  roll,
  behavior = "step",
  side = "right",
  view = NATIVE_VIEW,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onRollChange,
  showLoad = true,
  showGround = true,
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
}: RobotFootProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = roll !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  // One scalar carries the whole step, stance and return together; a supplied
  // `roll` pins it inside the stance, where the foot is on the floor.
  const hold = controlled
    ? clamp(Number.isFinite(roll) ? roll : 0, 0, 1) * DUTY
    : held
  const goal = React.useCallback((clock: number) => footGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 4),
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const cycle = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)
  const swinging = cycle > DUTY
  const swing = swinging ? (cycle - DUTY) / (1 - DUTY) : 0
  const stance = swinging ? 1 : cycle / DUTY
  const lift = swinging ? LIFT * Math.sin(Math.PI * swing) : 0

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded * DUTY)
      onRollChange?.(bounded)
    },
    [onRollChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  const load = swinging
    ? { angle: -9, contact: 0, heelLoad: 0, ballLoad: 0, toeLoad: 0 }
    : footRoll(stance)
  // The ankle rides up over whichever part of the sole is still down, so the
  // planted foot never slides and never sinks.
  const pivot: Vec2 =
    load.angle > 0 ? { x: P.sole, y: 0 } : load.angle < 0 ? { x: -P.heel, y: 0 } : { x: 0, y: 0 }
  const ankle = rollPoint({ x: 0, y: P.ankle + lift }, { x: pivot.x, y: lift }, load.angle)
  const { ball, toeAngle } = footPoints(ankle, load.angle, P)

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const mirror = side === "left" ? -1 : 1
  /** Sagittal to world: `forward` is toward the nose, which is -z. */
  const at = (forward: number, up: number, lateral = 0): Vec3 => ({
    x: lateral * mirror,
    y: up,
    z: -forward,
  })
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const flat = (forward: number, up: number) => to(at(forward, up))
  /** A sagittal outline given a width across the machine. */
  const solid = (outline: Vec2[], halfWidth = HALF_WIDTH) =>
    slabPath(
      outline.flatMap((point) => [
        at(point.x, point.y, -halfWidth),
        at(point.x, point.y, halfWidth),
      ]),
      camera,
    )
  const turned = (outline: Vec2[], about: Vec2, degrees: number, halfWidth = HALF_WIDTH) =>
    solid(
      outline.map((point) => rollPoint({ x: point.x + about.x, y: point.y + about.y }, about, degrees)),
      halfWidth,
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The strut between the shin and the heel lug: its length is the joint angle,
  // read off the drawing rather than typed in.
  const anchor = { x: ankle.x - 14, y: ankle.y + 27 }
  const lug = rollPoint({ x: ankle.x - P.heel + 3, y: ankle.y - P.ankle + 8 }, ankle, load.angle)
  const stroke = distance2(anchor, lug)
  const body = Math.min(stroke * 0.62, 22)
  const rodStart: Vec2 = {
    x: anchor.x + ((lug.x - anchor.x) * body) / Math.max(stroke, 1e-3),
    y: anchor.y + ((lug.y - anchor.y) * body) / Math.max(stroke, 1e-3),
  }

  const readout = Math.round(stance * 100)
  const loads: Array<[string, Vec2[], Vec2, number, number]> = [
    ["heel", pad(-P.heel - 1, -P.heel + 6, 2.6, -P.ankle), ankle, load.angle, load.heelLoad],
    ["ball", pad(P.sole - 6, P.sole + 1, 2.6, -P.ankle), ankle, load.angle, load.ballLoad],
    ["toe", pad(2, P.toe, 2.4, 0), ball, toeAngle, load.toeLoad],
  ]

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot ${side} foot, ${swinging ? "swinging clear of the floor" : `${readout} percent through its stance`}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% through the stance` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(stance + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      data-side={side}
      {...props}
    >
      <g transform={`translate(${CENTRE.x} ${CENTRE.y}) scale(${px(SCALE * fit)})`}>
        {showGround && (
          <path
            data-ground
            d={`M ${px(flat(-P.heel - 14, 0).x)} ${px(flat(-P.heel - 14, 0).y)} L ${px(flat(P.sole + P.toe + 12, 0).x)} ${px(flat(P.sole + P.toe + 12, 0).y)}`}
            stroke={palette.dark}
            strokeWidth={0.9}
            opacity={0.45}
            fill="none"
          />
        )}

        <g data-foot>
          <g data-shin>
            <path
              d={capsulePath(
                to(at(ankle.x, ankle.y)),
                to(at(ankle.x - 3, ankle.y + SHIN)),
                6,
              )}
              {...shell}
            />
            <path d={solid([
              { x: ankle.x - 9, y: ankle.y + 16 },
              { x: ankle.x + 3, y: ankle.y + 16 },
              { x: ankle.x + 1, y: ankle.y + SHIN - 2 },
              { x: ankle.x - 10, y: ankle.y + SHIN - 2 },
            ], 5)} {...machined} />
          </g>

          <g data-actuator="ankle">
            <path d={capsulePath(to(at(anchor.x, anchor.y)), to(at(rodStart.x, rodStart.y)), 2.9)} {...cast} />
            <path d={capsulePath(to(at(rodStart.x, rodStart.y)), to(at(lug.x, lug.y)), 1.3)} {...machined} />
            <circle
              cx={px(to(at(anchor.x, anchor.y)).x)}
              cy={px(to(at(anchor.x, anchor.y)).y)}
              r={1.8}
              {...machined}
            />
          </g>

          <path data-sole d={turned(chassis, ankle, load.angle)} {...shell} />
          <path
            data-toe
            d={turned(toePlate, ball, toeAngle, HALF_WIDTH - 1)}
            {...machined}
          />
          <path
            data-heel
            d={turned(pad(-P.heel - 1, -P.heel + 5.5, 3, -P.ankle), ankle, load.angle, HALF_WIDTH - 0.5)}
            {...cast}
          />

          {showLoad &&
            loads.map(([name, outline, about, degrees, amount]) => (
              <path
                key={name}
                data-pad={name}
                d={turned(outline, about, degrees, HALF_WIDTH - 1.5)}
                fill={palette.accent}
                fillOpacity={px(0.12 + amount * 0.78)}
                stroke="none"
              />
            ))}

          <g data-ankle>
            <circle
              cx={px(to(at(ankle.x, ankle.y)).x)}
              cy={px(to(at(ankle.x, ankle.y)).y)}
              r={4.4}
              {...machined}
            />
            <circle
              cx={px(to(at(ankle.x, ankle.y)).x)}
              cy={px(to(at(ankle.x, ankle.y)).y)}
              r={1.9}
              fill={palette.dark}
            />
          </g>
          <circle
            data-joint="toe"
            cx={px(to(at(ball.x, ball.y)).x)}
            cy={px(to(at(ball.x, ball.y)).y)}
            r={2.6}
            {...cast}
          />
        </g>

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.4} opacity={0.7}>
            <path
              d={`M ${px(flat(-P.heel - 10, P.ankle).x)} ${px(flat(-P.heel - 10, P.ankle).y)} L ${px(flat(P.sole + P.toe + 8, P.ankle).x)} ${px(flat(P.sole + P.toe + 8, P.ankle).y)}`}
              strokeDasharray="2 3"
            />
          </g>
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={124} fontSize={5}>
          {`${swinging ? "SWING" : "STANCE"} ${readout}% / ANKLE ${px(load.angle).toFixed(0)}°`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={133} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/**
 * Where the foot is in its step at `clock`: through the stance, then lifted and
 * carried back. `rock` never leaves the floor, so it stays inside the stance.
 */
export function footGoal(behavior: FootBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "rock") return (0.5 + Math.sin(t * Math.PI * 2) * 0.5) * DUTY
  return t
}

export { RobotFoot }
