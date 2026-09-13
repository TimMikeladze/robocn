"use client"

/**
 * robot-mantis — the one animal here with somewhere to reach.
 *
 * Every other machine in the menagerie is a trajectory. The raptorial
 * forelimbs are a two-link chain solved with `solveChain2` to a real target —
 * the pointer while it is watched, a scripted point otherwise — so the strike
 * is inverse kinematics, and a goal outside the reach clamps onto the
 * reachable circle the way every arm in the registry does. The four walking
 * legs are solved chains too, planted on the ground. Click and it snaps.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, solveChain2, type Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  capsulePath,
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

/** Seconds a snapped strike takes to shoot out and fold back. */
const SNAP = 0.7

export type MantisBehavior = "stalk" | "strike" | "groom" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the body width: the limbs are either side of the thorax. */
const HALF_SPAN = 6
const ORIGIN = 106
const GROUND = 168

const fits: Record<RobotView, number> = { plan: 0.78, front: 0.9, profile: 1, iso: 0.94 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotMantisProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: MantisBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair break step. */
  offset?: number
  /**
   * Where the forelimbs reach, in the animal's own units: x forward from the
   * shoulder, y up. Supplying it stops the pointer and the behavior.
   */
  target?: Vec2
  /** Walking-leg travel, 0–1. */
  stride?: number
  /** Head turn in degrees, −45..45. Omit and it follows the pointer. */
  headAngle?: number
  /** The forelimbs reach for the pointer, and a click snaps the strike. */
  interactive?: boolean
  onStrike?: () => void
  onTargetChange?: (target: Vec2) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  label?: string
}

/** Raptorial forelimb: femur then tibia, in world units. */
const FORELIMB = [31, 27] as const
/** Walking leg: femur then tibia. */
const WALKER = [24, 26] as const
/** Where the forelimbs mount, in the animal's frame. */
const SHOULDER: Vec2 = { x: 16, y: 62 }
/** Hips of the four walking legs, front pair first. */
const HIPS: Vec2[] = [
  { x: -6, y: 32 },
  { x: -30, y: 28 },
]

function RobotMantis({
  behavior = "stalk", phase, view = NATIVE_VIEW, speed = 0.8, animate = true, paused = false, offset = 0,
  target, stride = 0.5, headAngle,
  interactive = true, onStrike, onTargetChange,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotMantisProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [snapped, setSnapped] = React.useState<number | null>(null)
  const since = snapped === null ? Infinity : clock - snapped
  const lunge = since >= 0 && since < SNAP ? Math.sin((since / SNAP) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && target === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      // The animal's own frame: x forward from the origin, y up.
      x: unit.x * 260 - ORIGIN,
      y: GROUND - unit.y * 200,
    }), []),
  })

  const scripted = mantisBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  const look = finiteClamp(headAngle ?? scripted.head, -45, 45, 0)

  // The goal: what you supplied, else the pointer, else the script — pushed
  // out by a snap. `solveChain2` clamps anything out of reach onto the circle.
  const scriptedGoal = scripted.target(beat)
  const raw = target ?? (pointer.target ? { x: pointer.target.x - SHOULDER.x, y: pointer.target.y - SHOULDER.y } : scriptedGoal)
  const goal: Vec2 = {
    x: safe(raw?.x, scriptedGoal.x) + lunge * 26,
    y: safe(raw?.y, scriptedGoal.y) - lunge * 6,
  }

  React.useEffect(() => {
    onTargetChange?.(goal)
    // Reporting the goal is a side effect of moving, not of every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px(goal.x), px(goal.y)])

  const [, elbow, claw] = solveChain2(
    SHOULDER,
    { x: SHOULDER.x + goal.x, y: SHOULDER.y + goal.y },
    [...FORELIMB],
    { bend: "up" },
  )

  const travel = finiteClamp(stride, 0, 1, 0.5) * 11 * scripted.walk
  const legs = HIPS.flatMap((hip, pair) =>
    ([1, -1] as const).map((side) => {
      const step = ((beat * scripted.walk + pair * 0.5 + (side < 0 ? 0.25 : 0)) % 1 + 1) % 1
      const swinging = step > 0.6
      const along = swinging ? -travel * Math.cos(Math.PI * ((step - 0.6) / 0.4)) : travel * (1 - step / 0.3)
      const clearance = swinging ? 9 * Math.sin(Math.PI * ((step - 0.6) / 0.4)) : 0
      const [, knee, foot] = solveChain2(
        hip,
        { x: hip.x - 9 + along, y: clearance },
        [...WALKER],
        // The foot plants behind the hip, so the high knee is the "down" side.
        { bend: "down" },
      )
      return { id: `${pair}-${side > 0 ? "near" : "far"}`, side, hip, knee, foot, contact: clearance < 1e-7 }
    }),
  )

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), ORIGIN, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the animal's frame — x forward, y up — `across` units out. */
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  /** The same point in the flat elevation, which draws with y down. */
  const flat = (p: Vec2): Vec2 => ({ x: p.x, y: -p.y })

  const state = lunge > 0.05 ? "striking" : behavior === "static" ? "still" : behavior === "groom" ? "grooming" : behavior === "strike" ? "striking" : "stalking"

  /** One raptorial forelimb. `depth` sends the far one behind the body. */
  function forelimb(depth: boolean) {
    const shoulder = flat(SHOULDER)
    const bend = flat(elbow)
    const grip = flat(claw)
    return (
      <g data-forelimb={depth ? "far" : "near"} opacity={depth ? 0.5 : 1} transform={depth ? "translate(-3 2)" : undefined}>
        <path d={capsulePath(shoulder, bend, 4.2)} {...shell} />
        <path d={capsulePath(bend, grip, 3.2)} {...machined} />
        {/* Spines down the inside of the femur: the trap the tibia closes on. */}
        <g stroke={palette.dark} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.8}>
          {[0.3, 0.5, 0.7, 0.88].map((t) => {
            const a = { x: lerp(shoulder.x, bend.x, t), y: lerp(shoulder.y, bend.y, t) }
            return <path key={t} d={`M ${px(a.x)} ${px(a.y)} l 0 5`} />
          })}
        </g>
        <circle data-joint={depth ? "far-elbow" : "near-elbow"} cx={px(bend.x)} cy={px(bend.y)} r={3.4} {...cast} />
        <circle cx={px(shoulder.x)} cy={px(shoulder.y)} r={3.8} {...cast} />
        {/* The hook on the end of the tibia. */}
        <path d={`M ${px(grip.x)} ${px(grip.y)} l 5 4 l -2 -6 Z`} {...cast} />
        <circle cx={px(grip.x)} cy={px(grip.y)} r={2} fill={palette.accent} />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot mantis, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 260 200"
      width={width}
      height={px(width * 200 / 260)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setSnapped(clock)
        onStrike?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 168 H 248 M 106 16 V 186" strokeDasharray="2 3" />
          <circle cx={px(ORIGIN + SHOULDER.x)} cy={px(GROUND - SHOULDER.y)} r={px(FORELIMB[0] + FORELIMB[1])} strokeDasharray="3 4" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 14 168 H 246" stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse cx={ORIGIN} cy={170} rx={62} ry={4} fill={palette.dark} opacity={0.12} />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${fit})`}>
        {([-HALF_SPAN, HALF_SPAN] as const).map((across) => (
          <g key={across}>
            <path d={capsulePath(at(SHOULDER, across), at(elbow, across * 1.6), 3.6)} {...shell} />
            <path d={capsulePath(at(elbow, across * 1.6), at(claw, across * 0.6), 2.8)} {...machined} />
          </g>
        ))}
        {legs.map((leg) => (
          <g key={leg.id} data-leg={leg.id}>
            <path d={capsulePath(at(leg.hip, leg.side * HALF_SPAN), at(leg.knee, leg.side * HALF_SPAN * 2), 2.4)} {...machined} />
            <path d={capsulePath(at(leg.knee, leg.side * HALF_SPAN * 2), at(leg.foot, leg.side * HALF_SPAN * 2.4), 1.6)} {...cast} />
          </g>
        ))}
        <path d={extrudedPath(roundedFootprint(HALF_SPAN + 1, 34, 7, 5), camera, 36, 22)} {...shell} />
      </g>}

      <Frame {...frame}>
        <g data-mantis data-view={view} transform={`translate(${ORIGIN} ${GROUND})`}>
          {forelimb(true)}

          {legs.filter((leg) => leg.side < 0).map((leg) => (
            <g key={leg.id} data-leg={leg.id} opacity={0.5}>
              <path d={capsulePath(flat(leg.hip), flat(leg.knee), 2.4)} {...machined} />
              <path d={capsulePath(flat(leg.knee), flat(leg.foot), 1.6)} {...cast} />
            </g>
          ))}

          <g data-abdomen>
            <path d="M -6 -34 Q -22 -40 -56 -32 Q -74 -27 -76 -18 Q -64 -12 -46 -16 Q -20 -22 -6 -24 Z" {...shell} />
            <g stroke={palette.dark} strokeWidth={0.8} opacity={0.4} fill="none">
              {[-16, -30, -44, -58].map((x) => (
                <path key={x} d={`M ${x} -37 q 3 9 1 16`} />
              ))}
            </g>
            {/* The folded flight wings lie along the back. */}
            <path d="M -8 -38 Q -34 -44 -60 -34" fill="none" stroke={palette.metal} strokeWidth={2.4} opacity={0.75} />
          </g>

          <g data-prothorax>
            <path d="M 4 -30 Q 20 -46 22 -66 L 12 -68 Q 8 -48 -6 -34 Z" {...shell} />
            <path d="M 8 -36 Q 18 -50 18 -64" fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.5} />
            <circle cx={12} cy={-56} r={2} fill={palette.accent} opacity={0.85} />
          </g>

          <g data-head transform={`translate(18 -70) rotate(${px(-look * 0.6)})`}>
            {/* The triangular head every mantis is recognised by. */}
            <path d="M -9 4 L 9 2 L 2 -12 Z" {...machined} />
            {([-1, 1] as const).map((side) => (
              <g key={side} data-eye={side === 1 ? "front" : "back"}>
                <circle cx={px(side * 5 + 1)} cy={px(-3 - side)} r={3.6} {...cast} />
                <circle cx={px(side * 5 + 1.6)} cy={px(-3.6 - side)} r={1.8} fill={palette.accent} />
              </g>
            ))}
            <g data-antenna>
              <path d="M 5 -10 q 14 -10 24 -6" fill="none" stroke={palette.metal} strokeWidth={1.4} strokeLinecap="round" />
              <path d="M -1 -12 q 6 -14 18 -16" fill="none" stroke={palette.metal} strokeWidth={1.4} strokeLinecap="round" />
            </g>
            <path d="M -4 4 L 2 9 L 6 3" fill="none" stroke={palette.dark} strokeWidth={1} />
          </g>

          {legs.filter((leg) => leg.side > 0).map((leg) => (
            <g key={leg.id} data-leg={leg.id}>
              <path d={capsulePath(flat(leg.hip), flat(leg.knee), 2.6)} {...machined} />
              <path d={capsulePath(flat(leg.knee), flat(leg.foot), 1.7)} {...cast} />
              <circle cx={px(leg.knee.x)} cy={px(-leg.knee.y)} r={2.2} {...cast} />
            </g>
          ))}

          {forelimb(false)}
        </g>
      </Frame>

      {label && (
        <text x={130} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const safe = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

/**
 * What it does with no timeline on it. `target` is a function of the cycle,
 * because where the forelimbs are pointing is the behaviour.
 */
export function mantisBehaviorPose(behavior: MantisBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // The strike itself: folded, loaded, shot out, folded again.
    case "strike":
      return {
        walk: 0,
        head: 6 * Math.sin(time * 0.6),
        target: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          const out = t < 0.15 ? Math.sin((t / 0.15) * (Math.PI / 2)) : Math.pow(1 - (t - 0.15) / 0.85, 2.2)
          return { x: lerp(12, 50, out), y: lerp(-6, -20, out) }
        },
      }
    // Cleaning the forelimb across the head, one side at a time.
    case "groom":
      return {
        walk: 0,
        head: 18 * Math.sin(time * 0.8),
        target: (cycle: number) => ({
          x: 8 + 6 * Math.sin(2 * Math.PI * cycle),
          y: 10 + 6 * Math.cos(2 * Math.PI * cycle),
        }),
      }
    case "static":
      return { walk: 0, head: 0, target: () => ({ x: 18, y: -8 }) }
    // Stalking: folded up under the head, swaying, waiting.
    default:
      return {
        walk: 0.35,
        head: 26 * Math.sin(time * 0.45),
        target: (cycle: number) => ({
          x: 14 + 4 * Math.sin(2 * Math.PI * cycle * 0.5),
          y: -2 + 3 * Math.sin(2 * Math.PI * cycle * 0.5 + 1),
        }),
      }
  }
}

export { RobotMantis }
