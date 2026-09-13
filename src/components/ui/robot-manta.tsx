"use client"

/**
 * robot-manta — a ray seen from above.
 *
 * The fish runs its travelling wave from nose to tail. This one runs the same
 * `solveSpine` across the **span**: the wing root is station 0 and the tip is
 * station 1, so a crest leaves the shoulder and arrives at the wing tip, which
 * is what a ray's flight actually looks like. Banking is a roll about the
 * fore-aft axis, so in plan the span foreshortens by its own cosine rather
 * than being redrawn. Click and it surges.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine } from "@/lib/robocn/spine"
import {
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

/** Seconds a poked surge takes to decay back into the cruise. */
const SURGE = 1.3
/** How much of a raised station's height shows as a screen offset in plan view. */
const RELIEF = 0.42
/** Peak roll, in degrees, at full bank. */
const ROLL = 34

export type MantaBehavior = "cruise" | "soar" | "bank" | "static"

/** The ray is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotMantaProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One ray, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: MantaBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Wingbeats per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a squadron breaks step. */
  offset?: number
  /** Peak wing swing, 0–1. Omit and the behavior sets it. */
  amplitude?: number
  /** Wave crests along the span, 0.25–3. */
  waves?: number
  /** Roll, −1 to port and 1 to starboard. Omit and it banks toward the pointer. */
  bank?: number
  /** Stations along each wing, 3–24. */
  segments?: number
  /** Bank toward the pointer, and surge when clicked. */
  interactive?: boolean
  onSurge?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The seabed shadow underneath. */
  showGround?: boolean
  label?: string
}

/** Half span, in world units. */
const SPAN = 92

/** Leading and trailing edge of the wing at spanwise station `s`. */
const leading = (s: number) => 36 * (1 - s) - 14 * s
const trailing = (s: number) => -34 * Math.pow(1 - s, 0.85) - 14 * s

function RobotManta({
  behavior = "cruise", phase, view = NATIVE_VIEW, speed = 0.55, animate = true, paused = false, offset = 0,
  amplitude, waves, bank, segments = 12,
  interactive = true, onSurge,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotMantaProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const burst = since >= 0 && since < SURGE ? Math.exp(-since * 3) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && bank === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = mantaBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * scripted.rate + burst * 0.4
  const roll = finiteClamp(bank ?? pointer.target?.x ?? scripted.bank, -1, 1, 0)
  // A banked ray turns: the yaw is the bank, not a second control.
  const yaw = roll * 26

  const wing = solveSpine({
    segments,
    length: SPAN,
    phase: cycle,
    amplitude: clamp((amplitude ?? scripted.amplitude) + burst * 0.35, 0, 1),
    waves: waves ?? 0.85,
    // The swing belongs to the tip: the root barely moves on a ray.
    taper: 0.9,
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  const squash = Math.cos(toRadians(ROLL * roll))

  /** One spanwise station: how far out it is, and how high the wave has it. */
  const station = (index: number, side: 1 | -1) => {
    const joint = wing.joints[index]
    const d = -joint.position.x
    const s = joint.s
    // The wave, plus the roll, which raises one tip and drops the other.
    const height = joint.position.y + side * ROLL * roll * 0.5 * s
    return { s, x: side * d * squash, height }
  }

  /** A point in the plan drawing at `height` above the swimming plane. */
  const at = (x: number, y: number, height: number) => camera.project(x, height, -y)

  /** The wing outline: leading edge out to the tip, trailing edge home. */
  function wingPath(side: 1 | -1) {
    const last = wing.joints.length - 1
    const forward: string[] = []
    const back: string[] = []
    for (let index = 0; index <= last; index += 1) {
      const { s, x, height } = station(index, side)
      const lift = height * RELIEF
      forward.push(`${index ? "L" : "M"} ${px(x)} ${px(leading(s) + lift)}`)
      back.unshift(`L ${px(x)} ${px(trailing(s) + lift)}`)
    }
    return [...forward, ...back, "Z"].join(" ")
  }

  /** The spar down the middle of one wing, which is where the wave reads. */
  function sparPath(side: 1 | -1) {
    const last = wing.joints.length - 1
    return wing.joints
      .map((_, index) => {
        const { s, x, height } = station(index, side)
        const mid = (leading(s) + trailing(s)) / 2 + height * RELIEF
        return `${index ? "L" : "M"} ${px(x)} ${px(mid)}`
      })
      .slice(0, last + 1)
      .join(" ")
  }

  const state = burst > 0.05 ? "surging" : behavior === "static" ? "still" : behavior === "cruise" ? "cruising" : behavior === "soar" ? "soaring" : "banking"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot manta, ${state}, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 250 210"
      width={width}
      height={px(width * 210 / 250)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onSurge?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 96 H 238 M 125 12 V 190" strokeDasharray="2 3" />
          <path d={`M 125 96 l ${px(Math.sin(toRadians(yaw)) * 70)} ${px(-Math.cos(toRadians(yaw)) * 70)}`} strokeDasharray="4 3" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <ellipse cx={125} cy={128} rx={px(78 * squash)} ry={26} fill={palette.dark} opacity={0.07} />
        </g>
      )}

      {offAxis && <g data-solids transform="translate(125 96)">
        {([-1, 1] as const).map((side) => (
          <g key={side} data-wing={side === 1 ? "right" : "left"}>
            {wing.joints.slice(0, -1).map((_, index) => {
              const a = station(index, side)
              const b = station(index + 1, side)
              const chord = (leading(a.s) - trailing(a.s)) / 2
              return (
                <path
                  key={index}
                  d={capsulePath(
                    at(a.x, (leading(a.s) + trailing(a.s)) / 2, a.height),
                    at(b.x, (leading(b.s) + trailing(b.s)) / 2, b.height),
                    px(Math.max(1.4, chord * 0.4)),
                  )}
                  {...shell}
                />
              )
            })}
          </g>
        ))}
        <path
          d={extrudedPath(roundedFootprint(22, 34, 14, 6), camera, 7, -7)}
          {...shell}
        />
        <path d={capsulePath(at(0, -34, 0), at(0, -96, 0), 2.2)} {...cast} />
      </g>}

      <g
        data-manta
        data-view={view}
        transform={`translate(125 96) ${ground} scale(1 -1) rotate(${px(-yaw)})`.replace(/\s+/g, " ")}
      >
        {([-1, 1] as const).map((side) => (
          <g key={side} data-wing={side === 1 ? "right" : "left"}>
            <path d={wingPath(side)} {...shell} />
            <path d={sparPath(side)} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.4} />
            {/* Ribs: the structure the wave passes through. */}
            <g fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.28}>
              {[2, 4, 6, 8].map((index) => {
                if (index >= wing.joints.length) return null
                const { s, x, height } = station(index, side)
                const lift = height * RELIEF
                return <path key={index} d={`M ${px(x)} ${px(leading(s) + lift)} L ${px(x)} ${px(trailing(s) + lift)}`} />
              })}
            </g>
          </g>
        ))}

        <g data-tail>
          <path
            d={`M 0 -30 Q ${px(roll * 8)} -58 ${px(roll * 22)} -94`}
            fill="none"
            stroke={palette.metal}
            strokeWidth={3.2}
            strokeLinecap="round"
          />
          <circle cx={px(roll * 22)} cy={-94} r={2} fill={palette.accent} opacity={0.85} />
        </g>

        <g data-body>
          <path d="M -22 -30 Q -26 12 -14 28 L 14 28 Q 26 12 22 -30 Z" {...shell} />
          {/* Gill bars, and the dorsal ridge. */}
          <g stroke={palette.dark} strokeWidth={0.9} opacity={0.4} fill="none">
            {[-14, -6, 2, 10].map((y) => (
              <path key={y} d={`M -17 ${y} H 17`} />
            ))}
          </g>
          <rect x={-6} y={-6} width={12} height={18} rx={3} {...cast} />
          <circle cx={0} cy={3} r={2.2} fill={palette.accent} />
        </g>

        <g data-head>
          <path d="M -15 28 Q 0 40 15 28 Q 10 34 0 35 Q -10 34 -15 28 Z" {...cast} />
          {([-1, 1] as const).map((side) => (
            <g key={side} data-fin={side === 1 ? "right" : "left"}>
              {/* Cephalic fins: the two scoops it herds with, curled in and out. */}
              <path
                d={`M ${px(side * 13)} 28 q ${px(side * (9 + roll * side * 4))} 10 ${px(side * 5)} 20 q ${px(side * -3)} -8 ${px(side * -7)} -14 Z`}
                {...machined}
              />
            </g>
          ))}
          {([-1, 1] as const).map((side) => (
            <circle key={side} data-eye={side === 1 ? "right" : "left"} cx={px(side * 19)} cy={22} r={2.6} {...machined} />
          ))}
        </g>

        {burst > 0.05 && (
          <g data-wake opacity={px(burst * 0.5)} fill="none" stroke={palette.glow} strokeWidth={1}>
            {[0, 1, 2].map((index) => (
              <path key={index} d={`M ${px(-30 - index * 8)} ${px(-44 - index * 12)} q ${px(30 + index * 8)} -10 ${px(60 + index * 16)} 0`} />
            ))}
          </g>
        )}
      </g>

      {label && (
        <text x={125} y={202} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: beat, hold, or roll through a turn. */
export function mantaBehaviorPose(behavior: MantaBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Wings held: the wave all but stops and it glides on momentum.
    case "soar":
      return { amplitude: 0.12, rate: 0.22, bank: 0.1 * Math.sin(time * 0.25) }
    // A long rolling turn, first one way and then the other.
    case "bank":
      return { amplitude: 0.42, rate: 0.85, bank: 0.85 * Math.sin(time * 0.4) }
    case "static":
      return { amplitude: 0.5, rate: 0, bank: 0 }
    default:
      return { amplitude: 0.58, rate: 1, bank: 0.16 * Math.sin(time * 0.3) }
  }
}

export { RobotManta }
