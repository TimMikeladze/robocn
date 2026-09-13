"use client"

/**
 * robot-leg — a hip, a knee and an ankle solved to wherever the foot has to be.
 *
 * The foot is the input and the joints are the output: `solveLeg` breaks the
 * knee forward out of the hip-to-ankle line, the way the joint a person has
 * does, and the two strut actuators are drawn between the points the solver
 * produced — so their stroke is a consequence of the pose rather than an
 * illustration of one.
 *
 * Grabbing it hands you the foot. Everything above answers.
 *
 * The ankle here levels the sole against the floor and lifts the toes as the
 * foot clears it; the heel-to-toe roll through a stance is `robot-foot`'s job,
 * and this leg borrows it only while it is running the stride itself.
 */

import * as React from "react"

import { useEasedPoint } from "@/hooks/use-robot-arm"
import { useRobotDrag } from "@/hooks/use-robot-motion"
import {
  chainAngles2,
  clamp,
  distance2,
  lerp,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  footPoints,
  rollPoint,
  solveLeg,
  strideCycle,
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

export type LegBehavior = "stride" | "squat" | "kick" | "static"

const VIEW_WIDTH = 170
const VIEW_HEIGHT = 230
/** World origin on screen: the floor, under the hip. */
const CENTRE = { x: 66, y: 196 }
const SCALE = 1.7
/** World units per second while the foot eases back into the behaviour. */
const SLEW_RATE = 90
const NATIVE_VIEW: RobotView = "profile"

const P = defaultProportions
const HALF_WIDTH = 7.5
/** Pelvis stub above the hip joint. */
const PELVIS = 16

const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.9 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const sole: Vec2[] = [
  { x: -P.heel, y: -P.ankle },
  { x: -P.heel - 1.2, y: -P.ankle + 3.4 },
  { x: 2, y: -P.ankle + 9 },
  { x: P.sole - 1, y: -P.ankle + 5.5 },
  { x: P.sole + 1, y: -P.ankle },
]

const toePlate: Vec2[] = [
  { x: -1.5, y: 0 },
  { x: P.toe, y: 0 },
  { x: P.toe - 1.6, y: 2.8 },
  { x: -1.5, y: 4.6 },
]

export interface RobotLegProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /**
   * Controlled ankle, in leg world units: `x` toward the nose, `y` up from the
   * floor. Supplying it stops the loop and solves to it.
   */
  target?: Vec2
  /** Controlled hip height, 0 crouched to 1 standing tall. */
  stance?: number
  /** What the leg does when `target` is not supplied. */
  behavior?: LegBehavior
  /** Stride length and foot clearance, each 0 to 1. */
  stride?: number
  lift?: number
  /** A leg is handed; `left` is `right` mirrored across the machine's axis. */
  side?: SkeletonSide
  /** Where the camera stands. One leg, four projections. */
  view?: RobotView
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the foot anywhere; the hip and knee solve to it. */
  interactive?: boolean
  onTargetChange?: (target: Vec2) => void
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotLeg({
  target,
  stance,
  behavior = "stride",
  stride = 0.7,
  lift = 0.6,
  side = "right",
  view = NATIVE_VIEW,
  speed = 0.6,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTargetChange,
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
}: RobotLegProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<Vec2 | null>(null)

  const controlled =
    target !== undefined && Number.isFinite(target.x) && Number.isFinite(target.y)
  const path = React.useCallback(
    (clock: number) => legFoot(behavior, clock * Math.sign(speed || 1), { stride, lift }),
    [behavior, stride, lift, speed],
  )
  const pinned: Vec2 | null = controlled
    ? { x: clamp(target!.x, -70, 70), y: clamp(target!.y, 0, 110) }
    : held
  const goal: Vec2 | ((clock: number) => Vec2) | null = pinned ?? path
  const eased = useEasedPoint(goal, legFoot(behavior, phase, { stride, lift }), {
    // A grabbed foot tracks the pointer; a released one returns like a servo.
    speed: held ? 1600 : Math.max(SLEW_RATE, Math.abs(speed) * 90),
    animate: animate && !controlled && (behavior !== "static" || held !== null),
    paused,
    phase,
  })
  // A supplied target, and a held one, win outright: the loop keeps running
  // underneath so releasing eases back into whatever it has moved on to.
  const foot = pinned ?? eased.point

  const driven = !controlled && held === null
  const height = Number.isFinite(stance)
    ? clamp(stance as number, 0, 1)
    : driven
      ? legStance(behavior, eased.clock * Math.sign(speed || 1))
      : legStance(behavior, phase)
  const hipHeight = lerp(P.hip * 0.55, P.hip, height)

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const mirror = side === "left" ? -1 : 1
  const at = (forward: number, up: number, lateral = 0): Vec3 => ({
    x: lateral * mirror,
    y: up,
    z: -forward,
  })
  const to = (point: Vec2, lateral = 0): Vec2 => {
    const world = at(point.x, point.y, lateral)
    return camera.project(world.x, world.y, world.z)
  }
  const solid = (outline: Vec2[], halfWidth = HALF_WIDTH) =>
    slabPath(
      outline.flatMap((point) => [
        at(point.x, point.y, -halfWidth),
        at(point.x, point.y, halfWidth),
      ]),
      camera,
    )
  const turnedSolid = (outline: Vec2[], about: Vec2, degrees: number, halfWidth = HALF_WIDTH) =>
    solid(
      outline.map((point) =>
        rollPoint({ x: point.x + about.x, y: point.y + about.y }, about, degrees),
      ),
      halfWidth,
    )

  const apply = React.useCallback(
    (next: Vec2) => {
      const bounded = { x: clamp(next.x, -60, 60), y: clamp(next.y, 0, 100) }
      setHeld(bounded)
      onTargetChange?.(bounded)
    },
    [onTargetChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Screen box back into leg world units, undoing the frame's own transform.
    onDrag: React.useCallback((unit: Vec2) => {
      const scale = SCALE * (fits[view] ?? 1)
      apply({
        x: ((unit.x * VIEW_WIDTH - CENTRE.x) / scale) * mirror,
        y: (CENTRE.y - unit.y * VIEW_HEIGHT) / scale,
      })
    }, [apply, view, mirror]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const [hip, knee, ankle] = solveLeg({ x: 0, y: hipHeight }, foot, P.femur, P.tibia)
  // Planted, the ankle holds the sole level; lifted, it brings the toes up.
  const clearance = Math.max(0, ankle.y - P.ankle)
  const angle = driven
    ? strideCycle(gaitOf(behavior), eased.clock * Math.sign(speed || 1), { stride, lift }).angle
    : -clamp(clearance * 0.7, 0, 13)
  const { ball, toeAngle } = footPoints(ankle, angle, P)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // Struts: one from the pelvis down to the thigh, one from the thigh across
  // the knee to the shin. Both are drawn between solved points.
  const struts: Array<[string, Vec2, Vec2]> = [
    [
      "hip",
      { x: -9, y: hipHeight + PELVIS - 3 },
      lerp2(hip, knee, 0.42),
    ],
    ["knee", lerp2(hip, knee, 0.72), lerp2(knee, ankle, 0.3)],
  ]

  const bend = Math.round(Math.abs(chainAngles2([hip, knee, ankle])[1] ?? 0))

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot ${side} leg, ${behavior} behaviour, knee bent ${bend} degrees, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 180 : undefined}
      aria-valuenow={interactive ? bend : undefined}
      aria-valuetext={interactive ? `knee bent ${bend} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const step = event.shiftKey ? 9 : 3
        const from = held ?? foot
        if (event.key === "ArrowRight") apply({ x: from.x + step, y: from.y })
        else if (event.key === "ArrowLeft") apply({ x: from.x - step, y: from.y })
        else if (event.key === "ArrowUp") apply({ x: from.x, y: from.y + step })
        else if (event.key === "ArrowDown") apply({ x: from.x, y: from.y - step })
        else if (event.key === "Home") setHeld(null)
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
      <g data-leg transform={`translate(${CENTRE.x} ${CENTRE.y}) scale(${px(SCALE * fit)})`}>
        {showGround && (
          <path
            data-ground
            d={`M ${px(to({ x: -48, y: 0 }).x)} ${px(to({ x: -48, y: 0 }).y)} L ${px(to({ x: 56, y: 0 }).x)} ${px(to({ x: 56, y: 0 }).y)}`}
            stroke={palette.dark}
            strokeWidth={0.9}
            opacity={0.45}
            fill="none"
          />
        )}

        <g data-hip>
          <path
            d={solid(
              [
                { x: -10, y: hipHeight - 5 },
                { x: 8, y: hipHeight - 3 },
                { x: 11, y: hipHeight + 7 },
                { x: 6, y: hipHeight + PELVIS },
                { x: -13, y: hipHeight + PELVIS },
                { x: -14, y: hipHeight + 6 },
              ],
              HALF_WIDTH + 2.5,
            )}
            {...shell}
          />
          <path
            d={solid(
              [
                { x: -9, y: hipHeight + PELVIS - 5 },
                { x: 3, y: hipHeight + PELVIS - 4 },
                { x: 3, y: hipHeight + PELVIS + 1 },
                { x: -9, y: hipHeight + PELVIS + 1 },
              ],
              HALF_WIDTH + 4,
            )}
            {...cast}
          />
        </g>

        {struts.map(([name, from, into]) => {
          const span = Math.max(distance2(from, into), 1e-3)
          const body = Math.min(span * 0.55, 17)
          const rod = lerp2(from, into, body / span)
          return (
            <g key={name} data-actuator={name}>
              <path d={capsulePath(to(from), to(rod), 2.9)} {...cast} />
              <path d={capsulePath(to(rod), to(into), 1.3)} {...machined} />
            </g>
          )
        })}

        <path data-femur d={capsulePath(to(hip), to(knee), 7.4)} {...shell} />
        <path data-tibia d={capsulePath(to(knee), to(ankle), 6)} {...machined} />
        <path
          data-shin
          d={solid(
            [
              lerp2(knee, ankle, 0.16),
              lerp2(knee, ankle, 0.9),
              { x: lerp2(knee, ankle, 0.85).x + 5, y: lerp2(knee, ankle, 0.85).y },
              { x: lerp2(knee, ankle, 0.22).x + 6, y: lerp2(knee, ankle, 0.22).y },
            ],
            4.5,
          )}
          {...shell}
        />

        <path data-sole d={turnedSolid(sole, ankle, angle)} {...shell} />
        <path data-toe d={turnedSolid(toePlate, ball, toeAngle, HALF_WIDTH - 1)} {...machined} />

        <g data-joint="knee">
          <circle cx={px(to(knee).x)} cy={px(to(knee).y)} r={5.6} {...machined} />
          <circle cx={px(to(knee).x)} cy={px(to(knee).y)} r={2.3} fill={palette.dark} />
        </g>
        <g data-joint="hip">
          <circle cx={px(to(hip).x)} cy={px(to(hip).y)} r={5.2} {...machined} />
          <circle cx={px(to(hip).x)} cy={px(to(hip).y)} r={2.1} fill={palette.dark} />
        </g>
        <g data-ankle>
          <circle cx={px(to(ankle).x)} cy={px(to(ankle).y)} r={4.2} {...machined} />
          <circle cx={px(to(ankle).x)} cy={px(to(ankle).y)} r={1.8} fill={palette.dark} />
        </g>
        <circle
          data-foot
          cx={px(to(foot).x)}
          cy={px(to(foot).y)}
          r={2.2}
          fill={palette.accent}
          opacity={dragging || held ? 1 : 0.5}
        />

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.4} opacity={0.7}>
            <path
              d={`M ${px(to({ x: 0, y: 0 }).x)} ${px(to({ x: 0, y: 0 }).y)} L ${px(to({ x: 0, y: hipHeight + PELVIS }).x)} ${px(to({ x: 0, y: hipHeight + PELVIS }).y)}`}
              strokeDasharray="2 3"
            />
          </g>
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={212} fontSize={5}>
          {`KNEE ${bend}° / HIP ${px(hipHeight).toFixed(0)} / FOOT ${px(foot.x).toFixed(0)},${px(foot.y).toFixed(0)}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={221} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
})

const gaitOf = (behavior: LegBehavior) => (behavior === "kick" ? "march" : "walk")

/** Where the foot should be at `clock`, in leg world units. */
export function legFoot(
  behavior: LegBehavior,
  clock: number,
  { stride = 0.7, lift = 0.6 }: { stride?: number; lift?: number } = {},
): Vec2 {
  if (!Number.isFinite(clock) || behavior === "static" || behavior === "squat") {
    return { x: 0, y: P.ankle }
  }
  if (behavior === "kick") {
    const t = ((clock % 1) + 1) % 1
    const swing = Math.sin(t * Math.PI * 2)
    return { x: 30 * swing, y: P.ankle + 34 * Math.max(0, swing) }
  }
  const sample = strideCycle("walk", clock, { stride, lift })
  return { x: sample.forward, y: sample.height }
}

/** Hip height at `clock`, 0 crouched to 1 standing tall. */
export function legStance(behavior: LegBehavior, clock: number) {
  if (!Number.isFinite(clock) || behavior !== "squat") return 1
  const t = ((clock % 1) + 1) % 1
  return 0.28 + 0.72 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2))
}

export { RobotLeg }
