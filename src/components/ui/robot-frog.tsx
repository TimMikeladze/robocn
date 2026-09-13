"use client"

/**
 * robot-frog — a jumper in side elevation.
 *
 * The quadruped walks; this one leaves the ground. The hind legs are two-link
 * chains solved with `solveChain2` from hip to ankle, and the whole jump is one
 * pair of numbers driving them — how far the leg is extended, and how high the
 * body is. Crouching, launching, the airborne trail and the landing absorb are
 * all the same linkage at different points of that pair, so there is no second
 * set of artwork to keep in step. Click and it jumps.
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

/** Seconds one poked jump takes, launch to landing. */
const HOP = 1.1

export type FrogBehavior = "crouch" | "hop" | "swim" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the body width: the legs are either side of the trunk. */
const HALF_SPAN = 9
const ORIGIN = 104
const GROUND = 166

const fits: Record<RobotView, number> = { plan: 0.82, front: 0.94, profile: 1, iso: 0.96 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotFrogProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One jumper, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: FrogBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Jumps per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a chorus breaks step. */
  offset?: number
  /** Hind-leg extension, 0 folded into the crouch to 1 straight. Omit and the behavior sets it. */
  extend?: number
  /** Height above the ground, 0–1. Omit and the behavior decides. */
  altitude?: number
  /** Eye aim, −1..1. Omit and they follow the pointer. */
  gaze?: number
  /** The eyes track the pointer, and a click jumps. */
  interactive?: boolean
  onHop?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  label?: string
}

/** Hind leg: femur then tibia. The foot is rigid on the end of it. */
const HIND = [27, 27] as const
/** Fore leg: humerus then forearm. */
const FORE = [15, 16] as const

function RobotFrog({
  behavior = "crouch", phase, view = NATIVE_VIEW, speed = 0.7, animate = true, paused = false, offset = 0,
  extend, altitude, gaze,
  interactive = true, onHop,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotFrogProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [jumped, setJumped] = React.useState<number | null>(null)
  const since = jumped === null ? Infinity : clock - jumped
  const leap = since >= 0 && since < HOP ? Math.sin((since / HOP) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && gaze === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = frogBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  const jump = scripted.jump(beat)

  const push = finiteClamp(clamp((extend ?? jump.extend) + leap * 0.7, 0, 1), 0, 1, jump.extend)
  const rise = finiteClamp(clamp((altitude ?? jump.altitude) + leap * 0.8, 0, 1), 0, 1, jump.altitude)
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  // The throat runs on its own clock: a call is far faster than a jump.
  const throat = 1 + 0.22 * Math.abs(Math.sin(2 * Math.PI * beat * 7)) * scripted.call

  // Everything below is written in the animal's own frame: x forward, y up.
  const hipHeight = lerp(20, 33, push) + rise * 58
  const hip: Vec2 = { x: -8, y: hipHeight }
  const ankle: Vec2 = {
    x: hip.x - lerp(13, 45, push),
    y: Math.max(2, hip.y - lerp(3, 23, push) - rise * 12),
  }
  // The leg reaches backwards, so the raised knee is the "down" elbow side.
  const [, knee, heel] = solveChain2(hip, ankle, [...HIND], { bend: "down" })
  // The foot is rigid on the ankle: down and back on the ground, trailing in the air.
  const toe: Vec2 = {
    x: heel.x - lerp(6, 20, push),
    y: Math.max(0, heel.y - lerp(9, 2, push) + rise * 6),
  }

  const shoulder: Vec2 = { x: 16, y: hipHeight - 3 }
  const hand: Vec2 = {
    x: shoulder.x + lerp(8, 3, rise),
    y: rise > 0.05 ? shoulder.y - lerp(20, 8, rise) : 0,
  }
  const [, elbow, palm] = solveChain2(shoulder, hand, [...FORE], { bend: "up" })

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
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  /** The elevation draws with y down; the animal thinks with y up. */
  const flat = (p: Vec2): Vec2 => ({ x: p.x, y: -p.y })

  const state = leap > 0.05 ? "jumping" : behavior === "static" ? "still" : behavior === "swim" ? "swimming" : behavior === "hop" ? "jumping" : "crouched"

  /** One hind leg. `depth` sends the far one behind the body. */
  function hindLeg(depth: boolean) {
    const shift = depth ? { x: -3, y: -1 } : { x: 0, y: 0 }
    const move = (p: Vec2) => flat({ x: p.x + shift.x, y: p.y + shift.y })
    return (
      <g data-leg={depth ? "hind-far" : "hind-near"} opacity={depth ? 0.5 : 1}>
        <path d={capsulePath(move(hip), move(knee), 6)} {...shell} />
        <path d={capsulePath(move(knee), move(heel), 4.4)} {...machined} />
        <path d={capsulePath(move(heel), move(toe), 3)} {...cast} />
        {/* Webbing between the long toes. */}
        <path
          d={`M ${px(move(toe).x)} ${px(move(toe).y)} q ${px(-9)} ${px(-2)} ${px(-15)} ${px(3)} q 8 3 15 -3 Z`}
          {...machined}
        />
        <circle data-joint={depth ? "far-knee" : "near-knee"} cx={px(move(knee).x)} cy={px(move(knee).y)} r={4} {...cast} />
        <circle cx={px(move(heel).x)} cy={px(move(heel).y)} r={2.8} {...cast} />
      </g>
    )
  }

  function foreLeg(depth: boolean) {
    const shift = depth ? -3 : 0
    const move = (p: Vec2) => flat({ x: p.x + shift, y: p.y })
    return (
      <g data-leg={depth ? "fore-far" : "fore-near"} opacity={depth ? 0.5 : 1}>
        <path d={capsulePath(move(shoulder), move(elbow), 3.4)} {...machined} />
        <path d={capsulePath(move(elbow), move(palm), 2.6)} {...cast} />
        <path
          d={`M ${px(move(palm).x)} ${px(move(palm).y)} l 7 2 m -7 -2 l 6 -3 m -6 3 l 3 5`}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot frog, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 240 200"
      width={width}
      height={px(width * 200 / 240)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setJumped(clock)
        onHop?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 166 H 228 M 104 16 V 186" strokeDasharray="2 3" />
          <circle cx={px(ORIGIN + hip.x)} cy={px(GROUND - hip.y)} r={px(HIND[0] + HIND[1])} strokeDasharray="3 4" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 14 166 H 226" stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse cx={ORIGIN} cy={169} rx={px(44 - rise * 20)} ry={px(4.5 - rise * 2)} fill={palette.dark} opacity={px(0.16 - rise * 0.09)} />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${fit})`}>
        {([-HALF_SPAN, HALF_SPAN] as const).map((across) => (
          <g key={across}>
            <path d={capsulePath(at(hip, across), at(knee, across * 1.5), 5.4)} {...shell} />
            <path d={capsulePath(at(knee, across * 1.5), at(heel, across * 1.2), 4)} {...machined} />
            <path d={capsulePath(at(heel, across * 1.2), at(toe, across * 1.2), 2.6)} {...cast} />
            <path d={capsulePath(at(shoulder, across * 0.7), at(palm, across * 0.8), 2.6)} {...machined} />
          </g>
        ))}
        <path d={extrudedPath(roundedFootprint(HALF_SPAN + 2, 24, 10, 6), camera, hipHeight + 12, hipHeight - 8)} {...shell} />
      </g>}

      <Frame {...frame}>
        <g data-frog data-view={view} transform={`translate(${ORIGIN} ${GROUND})`}>
          {hindLeg(true)}
          {foreLeg(true)}

          <g data-body transform={`translate(0 ${px(-hipHeight)})`}>
            <path d="M -22 -2 Q -20 -16 -2 -18 Q 20 -18 26 -6 Q 28 8 12 12 L -12 12 Q -24 10 -22 -2 Z" {...shell} />
            <path d="M -16 -10 Q 2 -16 20 -8" fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.4} />
            {/* Dorsal ridge plates. */}
            <g stroke={palette.dark} strokeWidth={0.8} opacity={0.35} fill="none">
              {[-12, -4, 4, 12].map((x) => (
                <path key={x} d={`M ${x} -16 q 2 8 0 14`} />
              ))}
            </g>
            <rect x={-6} y={-8} width={13} height={11} rx={3} {...cast} />
            <circle cx={0.5} cy={-2.5} r={1.9} fill={palette.accent} />
          </g>

          <g data-head transform={`translate(24 ${px(-hipHeight - 8)}) rotate(${px(aim * 6)})`}>
            <path d="M -10 -6 Q 2 -12 16 -4 Q 18 4 10 6 L -8 6 Q -12 0 -10 -6 Z" {...machined} />
            {/* The mouth line every frog is read by. */}
            <path d="M -8 3 Q 4 7 16 -1" fill="none" stroke={palette.dark} strokeWidth={1.1} />
            <g data-eyes>
              {([-1, 1] as const).map((side) => (
                <g key={side} transform={`translate(${px(2 + side * 6)} ${px(-11 + Math.abs(side) * 0)})`} opacity={side < 0 ? 0.75 : 1}>
                  <circle cx={0} cy={0} r={5.4} {...shell} />
                  <circle cx={px(aim * 1.6)} cy={0} r={3} {...cast} />
                  <circle cx={px(aim * 1.6)} cy={0} r={1.5} fill={palette.accent} />
                </g>
              ))}
            </g>
            <circle cx={16} cy={-2} r={1.4} fill={palette.glow} opacity={0.8} />
          </g>

          {/* The vocal sac, on its own far faster clock. */}
          <g data-throat transform={`translate(20 ${px(-hipHeight + 8)})`}>
            <ellipse cx={0} cy={px(4 * throat)} rx={px(11 * throat)} ry={px(7 * throat)} {...machined} opacity={0.9} />
            <path d="M -7 2 Q 0 6 7 2" fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.5} />
          </g>

          {foreLeg(false)}
          {hindLeg(false)}
        </g>
      </Frame>

      {label && (
        <text x={120} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/**
 * What it does with no timeline on it. `jump` is a function of the cycle,
 * because the whole animal is the pair of numbers it returns.
 */
export function frogBehaviorPose(behavior: FrogBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Load, launch, arc, land, absorb — one cycle.
    case "hop":
      return {
        gaze: 0.2 * Math.sin(time * 0.6),
        call: 0,
        jump: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          if (t < 0.24) return { extend: 0.1 * (1 - t / 0.24), altitude: 0 }
          if (t < 0.38) {
            const u = (t - 0.24) / 0.14
            return { extend: u, altitude: 0.35 * u * u }
          }
          if (t < 0.82) {
            const u = (t - 0.38) / 0.44
            return { extend: 1 - 0.35 * u, altitude: 0.35 + 0.65 * Math.sin(Math.PI * u) }
          }
          const u = (t - 0.82) / 0.18
          return { extend: 0.65 * (1 - u), altitude: 0.35 * (1 - u) }
        },
      }
    // A breaststroke kick, held at mid-water.
    case "swim":
      return {
        gaze: 0.3 * Math.sin(time * 0.5),
        call: 0,
        jump: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          return { extend: t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6, altitude: 0.45 }
        },
      }
    case "static":
      return { gaze: 0, call: 0, jump: () => ({ extend: 0.35, altitude: 0 }) }
    // Sitting: folded up, throat going, eyes about.
    default:
      return {
        gaze: 0.7 * Math.sin(time * 0.7),
        call: Math.max(0, Math.sin(time * 0.5)),
        jump: () => ({ extend: 0.08, altitude: 0 }),
      }
  }
}

export { RobotFrog }
