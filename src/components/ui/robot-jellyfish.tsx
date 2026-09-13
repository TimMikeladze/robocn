"use client"

/**
 * robot-jellyfish — a pulsing bell in front elevation.
 *
 * Nothing else in the set moves radially. The bell is a surface of revolution:
 * one contraction number narrows it, deepens it and flares the rim, and the
 * meridians are drawn from that same number rather than tweened between two
 * pictures. Under it hang `arms` tentacles, each its own `solveSpine` chain
 * with a delay down the ring, so the ring ripples instead of swinging as one
 * plate. Click and it contracts hard.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine } from "@/lib/robocn/spine"
import {
  aboutPoint,
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

/** Seconds a poked contraction takes to relax again. */
const PULSE = 1.4

export type JellyfishBehavior = "pulse" | "drift" | "bloom" | "static"

/** The bell is drawn face on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
const CENTRE = 112
/** Where the bell rim sits in the frame. */
const RIM = 88

const fits: Record<RobotView, number> = { plan: 0.72, front: 1, profile: 1, iso: 0.92 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotJellyfishProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One bell, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: JellyfishBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Contractions per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a bloom of them breaks step. */
  offset?: number
  /** Bell contraction, 0 relaxed to 1 squeezed. Omit and the behavior works it. */
  contraction?: number
  /** Tentacles hanging off the rim, 3–16. */
  arms?: number
  /** Links in each tentacle, 3–24. */
  segments?: number
  /** Lean of the tentacle curtain, −1..1. Omit and it follows the pointer. */
  lean?: number
  /** The tentacles lean toward the pointer, and a click contracts the bell. */
  interactive?: boolean
  onPulse?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The water column marks behind it. */
  showGround?: boolean
  label?: string
}

/** Bell radius and depth, relaxed and fully contracted. */
const BELL = { wide: 56, narrow: 41, shallow: 33, deep: 50 } as const
/** Tentacle contour length. */
const TENTACLE = 96

function RobotJellyfish({
  behavior = "pulse", phase, view = NATIVE_VIEW, speed = 0.5, animate = true, paused = false, offset = 0,
  contraction, arms = 9, segments = 10, lean,
  interactive = true, onPulse,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotJellyfishProps) {
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
  const burst = since >= 0 && since < PULSE ? Math.exp(-since * 2.6) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && lean === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = jellyfishBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * scripted.rate
  const beat = Number.isFinite(cycle) ? cycle : 0
  // The contraction is asymmetric: a jellyfish squeezes hard and relaxes slow.
  const squeeze = finiteClamp(
    clamp((contraction ?? scripted.contraction(beat)) + burst * 0.7, 0, 1),
    0, 1, 0.2,
  )
  const tilt = finiteClamp(lean ?? pointer.target?.x ?? scripted.lean, -1, 1, 0)

  const ring = Number.isFinite(arms) ? Math.round(clamp(arms, 3, 16)) : 9
  const radius = lerp(BELL.wide, BELL.narrow, squeeze)
  const depth = lerp(BELL.shallow, BELL.deep, squeeze)
  // Contracting throws the rim outward and up: the margin is the last thing to go.
  const flare = 5 + squeeze * 11

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE, RIM, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A drawing offset from the rim centre, `back` world units away from the camera. */
  const at = (x: number, y: number, back = 0) => camera.project(-x, -y, back)

  /**
   * One tentacle. Its attachment sits on the rim *circle*, so the ones round
   * the back are shorter across the frame and sit behind the bell.
   */
  const tentacles = Array.from({ length: ring }, (_, index) => {
      const around = (index / ring) * Math.PI * 2
      const pose = solveSpine({
        segments,
        length: TENTACLE * lerp(0.72, 1, Math.abs(Math.cos(around))),
        // Each one trails the last: the curtain ripples round the ring.
        phase: beat - index * 0.07,
        amplitude: 0.24 + 0.3 * squeeze,
        waves: 1.3,
        taper: 0.7,
        turn: tilt * 0.5,
      })
      return {
        index,
        pose,
        x: Math.cos(around) * radius,
        z: Math.sin(around) * radius,
        front: Math.sin(around) < 0,
      }
    })

  /** A hanging tentacle: the solver's nose is the attachment, its body falls. */
  const strand = (t: (typeof tentacles)[number]) => (
    <g key={t.index} data-tentacle={t.index} opacity={t.front ? 1 : 0.5}>
      {t.pose.joints.slice(0, -1).map((joint, index) => (
        <path
          key={index}
          d={capsulePath(
            { x: t.x + joint.position.y, y: -joint.position.x },
            { x: t.x + t.pose.joints[index + 1].position.y, y: -t.pose.joints[index + 1].position.x },
            px(Math.max(0.7, 2.6 * (1 - joint.s))),
          )}
          {...(index % 2 === 0 ? machined : cast)}
        />
      ))}
      <circle
        cx={px(t.x + t.pose.tail.position.y)}
        cy={px(-t.pose.tail.position.x)}
        r={1.4}
        fill={palette.accent}
        opacity={0.8}
      />
    </g>
  )

  const state = burst > 0.05 ? "contracting" : behavior === "static" ? "still" : behavior === "pulse" ? "pulsing" : behavior === "bloom" ? "held open" : behavior

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot jellyfish, ${state}, bell ${Math.round(squeeze * 100)} percent contracted, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 224 236"
      width={width}
      height={px(width * 236 / 224)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onPulse?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 88 H 212 M 112 12 V 220" strokeDasharray="2 3" />
          <path d={`M ${px(112 - radius)} 88 H ${px(112 + radius)}`} strokeDasharray="4 3" />
        </g>
      )}
      {showGround && (
        <g stroke={palette.grid} opacity={0.35} fill="none" strokeWidth={0.6}>
          <path d="M 24 20 v 200 M 200 20 v 200" strokeDasharray="3 9" />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${RIM}) scale(${fit})`}>
        {/* The rim is a circle, which only a second camera can show. */}
        <path
          d={`${tentacles.map((t, index) => {
            const p = at(t.x, 0, t.z)
            return `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`
          }).join(" ")} Z`}
          {...machined}
          fillOpacity={variant === "solid" ? 0.25 : undefined}
        />
        {tentacles.map((t) => {
          const top = at(t.x, 0, t.z)
          const tip = at(t.x + t.pose.tail.position.y, t.pose.tail.position.x, t.z)
          return <path key={t.index} data-tentacle={t.index} d={capsulePath(top, tip, 1.4)} {...cast} />
        })}
        <path d={capsulePath(at(0, 0, 0), at(0, depth, 0), px(radius * 0.42))} {...shell} />
      </g>}

      <Frame {...frame}>
        <g data-jellyfish data-view={view} transform={`translate(${CENTRE} ${RIM})`}>
          {tentacles.filter((t) => !t.front).map(strand)}

          <g data-bell>
            <path
              d={[
                `M ${px(-radius)} 0`,
                `C ${px(-radius - flare * 0.3)} ${px(-depth * 1.25)} ${px(radius + flare * 0.3)} ${px(-depth * 1.25)} ${px(radius)} 0`,
                // The margin curls back up under the bell as it squeezes.
                `q ${px(-flare * 0.5)} ${px(flare)} ${px(-flare)} ${px(flare * 0.4)}`,
                `L ${px(-radius + flare)} ${px(flare * 0.4)}`,
                `q ${px(-flare * 0.5)} ${px(-flare * 0.6)} ${px(-flare)} ${px(-flare * 0.4)}`,
                "Z",
              ].join(" ")}
              {...shell}
            />
            {/* Meridians: the same surface, sampled round the axis. */}
            <g fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.4}>
              {[-0.72, -0.38, 0, 0.38, 0.72].map((t) => (
                <path key={t} d={`M ${px(radius * t)} ${px(-depth * (1 - t * t) * 0.96)} Q ${px(radius * t * 1.06)} ${px(-depth * 0.3)} ${px(radius * t)} 0`} />
              ))}
            </g>
            <ellipse cx={0} cy={px(-depth * 0.62)} rx={px(radius * 0.34)} ry={px(depth * 0.22)} {...machined} />
            <circle cx={0} cy={px(-depth * 0.62)} r={px(3 + squeeze * 2)} fill={palette.accent} opacity={0.9} />
            {/* Rhopalia: the sensors round the margin. */}
            {[-0.86, -0.5, 0.5, 0.86].map((t) => (
              <circle key={t} cx={px(radius * t)} cy={px(-2)} r={1.6} fill={palette.glow} opacity={0.85} />
            ))}
          </g>

          <g data-oral>
            {[-1, -0.35, 0.35, 1].map((t, index) => (
              <path
                key={t}
                d={`M ${px(t * 11)} 0 q ${px(t * 8 + tilt * 6)} ${px(16 + index * 2)} ${px(t * 5 + tilt * 14)} ${px(38 + squeeze * 8)}`}
                fill="none"
                stroke={palette.metal}
                strokeWidth={px(3.6 - index * 0.2)}
                strokeLinecap="round"
                opacity={0.75}
              />
            ))}
          </g>

          {tentacles.filter((t) => t.front).map(strand)}
        </g>
      </Frame>

      {label && (
        <text x={112} y={230} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
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
 * What it does with no timeline on it. `contraction` is a function of the
 * cycle rather than a number, because the squeeze is the whole mechanism.
 */
export function jellyfishBehaviorPose(behavior: JellyfishBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Slack: barely any squeeze, and the curtain sways with the water.
    case "drift":
      return { rate: 0.35, lean: 0.42 * Math.sin(time * 0.3), contraction: () => 0.08 }
    // Held open, feeding.
    case "bloom":
      return { rate: 0.2, lean: 0.15 * Math.sin(time * 0.22), contraction: () => 0.02 }
    case "static":
      return { rate: 0, lean: 0, contraction: () => 0.35 }
    // Squeeze hard, relax slow: the asymmetry is what makes it swim.
    default:
      return {
        rate: 1,
        lean: 0.18 * Math.sin(time * 0.35),
        contraction: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          return t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) : Math.pow(1 - (t - 0.3) / 0.7, 1.8)
        },
      }
  }
}

export { RobotJellyfish }
