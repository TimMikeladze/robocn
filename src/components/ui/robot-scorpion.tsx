"use client"

/**
 * robot-scorpion — eight legs and a tail that leaves the ground plane.
 *
 * The legs are the shared `solveHexapod` gait, the same one the spider and the
 * crab walk on. The metasoma is what is new: a `solveSpine` chain solved in the
 * animal's *sagittal* plane, so the solver's own `x` is how far back the tail
 * reaches and its `y` is how high — one curve that supplies both the plan
 * footprint and the true height. Arch it and the tail genuinely comes up and
 * over the back rather than being redrawn shorter. Click and it strikes.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveHexapod, type HexapodGait, type HexapodLeg } from "@/lib/robocn/hexapod"
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

/** Seconds a strike takes to whip over and come back. */
const STRIKE = 0.9
/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4

export type ScorpionBehavior = "stalk" | "guard" | "strike" | "static"

/** Drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** Where the tail leaves the body, behind the leg hub. */
const TAIL_ROOT = -26

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotScorpionProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: ScorpionBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: HexapodGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a nest breaks step. */
  offset?: number
  /** Walking legs, rounded to an even number and clamped 4–10. The pedipalps are extra. */
  legs?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose. */
  heading?: number
  /** Tail arch, 0 trailing flat to 1 curled over the back. Omit and the behavior sets it. */
  arch?: number
  /** Pedipalp opening, 0 shut and 1 spread. Omit and the behavior works them. */
  claw?: number
  /** Links in the tail, 3–24. */
  segments?: number
  /** It turns toward the pointer, and a click strikes with the tail. */
  interactive?: boolean
  onStrike?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the feet carrying weight. */
  showContacts?: boolean
  label?: string
}

/** Contour length of the metasoma. */
const TAIL = 108

function RobotScorpion({
  behavior = "stalk", gait, phase, view = NATIVE_VIEW, speed = 0.9, animate = true, paused = false, offset = 0,
  legs = 8, height = 0.5, stride = 0.66, lift = 0.5, heading, arch, claw, segments = 9,
  interactive = true, onStrike,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotScorpionProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [struck, setStruck] = React.useState<number | null>(null)
  const since = struck === null ? Infinity : clock - struck
  const whip = since >= 0 && since < STRIKE ? Math.sin((since / STRIKE) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && heading === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = scorpionBehaviorPose(behavior, clock)
  const course = finiteClamp(
    heading ?? (pointer.target ? pointer.target.x * 55 : scripted.heading),
    -180, 180, 0,
  )
  const cycle = controlled ? phase : clock * speed * scripted.rate
  const beat = Number.isFinite(cycle) ? cycle : 0

  const pose = solveHexapod({
    legs,
    gait: gait ?? scripted.gait,
    phase: cycle,
    height: clamp(height + scripted.bob, 0, 1),
    stride,
    lift,
    heading: 0,
    radius: 17,
    fan: 142,
    spread: 0.82,
    femur: 21,
    tibia: 25,
  })

  const curl = finiteClamp(clamp((arch ?? scripted.arch) + whip * 0.6, 0, 1), 0, 1, scripted.arch)
  const gape = finiteClamp(claw ?? scripted.claw, 0, 1, 0.4)

  // The tail is solved in the sagittal plane: the solver's x is how far back it
  // reaches, its y is how high. One curve, both facts.
  const tail = solveSpine({
    segments,
    length: TAIL,
    phase: cycle,
    amplitude: 0.07,
    waves: 0.5,
    taper: 0.8,
    // Arc from a trailing tail to one curled right over the back.
    turn: clamp(-(0.18 + 0.76 * curl), -1, 1),
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()

  /** A tail joint: how far behind the hub it reaches, and how high it is. */
  const knot = (index: number) => {
    const joint = tail.joints[index]
    return {
      // A small lateral wag, so the tail is not perfectly rigid in plan.
      x: Math.sin(2 * Math.PI * beat) * 3 * joint.s,
      y: TAIL_ROOT + joint.position.x,
      height: pose.height + joint.position.y,
      s: joint.s,
    }
  }
  const tip = knot(tail.joints.length - 1)
  /** A point in the plan drawing at `height` above the ground. */
  const at = (p: { x: number; y: number }, h: number) => camera.project(p.x, h, -p.y)

  function legDrawing(leg: HexapodLeg) {
    const knee = { x: leg.knee.x, y: leg.knee.y - leg.kneeHeight * RELIEF }
    const foot = { x: leg.foot.x, y: leg.foot.y - leg.clearance * RELIEF }
    return (
      <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
        <path d={capsulePath(leg.hip, knee, 3.1)} {...shell} />
        <path d={capsulePath(knee, foot, 1.9)} {...machined} />
        <circle cx={px(leg.hip.x)} cy={px(leg.hip.y)} r={3.2} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={2.5} {...cast} />
        <circle cx={px(foot.x)} cy={px(foot.y)} r={1.5} fill={palette.dark} />
        {showContacts && leg.contact && (
          <circle data-contact cx={px(leg.foot.x)} cy={px(leg.foot.y)} r={3.2} fill="none" stroke={palette.accent} strokeWidth={1} />
        )}
      </g>
    )
  }

  /** A pedipalp: upper arm out, forearm forward, and a pincer that opens. */
  function palp(side: 1 | -1) {
    const name = side === 1 ? "right" : "left"
    const shoulder = { x: side * 14, y: 20 }
    const elbow = { x: side * 32, y: 36 }
    const wrist = { x: side * 26, y: 56 }
    const open = 6 + gape * 26
    return (
      <g data-claw={name}>
        <path d={capsulePath(shoulder, elbow, 4)} {...shell} />
        <path d={capsulePath(elbow, wrist, 3.2)} {...machined} />
        <circle cx={px(elbow.x)} cy={px(elbow.y)} r={3.6} {...cast} />
        <g transform={`translate(${px(wrist.x)} ${px(wrist.y)}) rotate(${px(side * 14)})`}>
          <path d="M -6 -3 Q -7.5 9 0 13 Q 7.5 9 6 -3 Z" {...shell} />
          <g transform={`rotate(${px(-open)})`}>
            <path d="M -2.6 7 L -2 23 L 2.4 21 L 2.8 8 Z" {...cast} />
          </g>
          <g data-jaw transform={`rotate(${px(open)})`}>
            <path d="M -2.6 7 L -2 23 L 2.4 21 L 2.8 8 Z" {...machined} />
          </g>
          <circle cx={0} cy={2} r={2} fill={palette.accent} />
        </g>
      </g>
    )
  }

  const state = whip > 0.05 ? "striking" : behavior === "static" ? "still" : behavior === "guard" ? "on guard" : behavior === "strike" ? "striking" : "stalking"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot scorpion, ${state}, tail ${Math.round(curl * 100)} percent arched, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 250 236"
      width={width}
      height={px(width * 236 / 250)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setStruck(clock)
        onStrike?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 130 H 238 M 125 16 V 214" strokeDasharray="2 3" />
          <path d={`M 125 130 l ${px(Math.sin(toRadians(course)) * 62)} ${px(-Math.cos(toRadians(course)) * 62)}`} strokeDasharray="4 3" />
        </g>
      )}
      {showGround && <ellipse cx={125} cy={130} rx={92} ry={66} fill={palette.dark} opacity={0.05} />}

      {offAxis && <g data-solids transform="translate(125 130)">
        {pose.legs.map((leg) => (
          <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
            <path d={capsulePath(at(leg.hip, pose.height), at(leg.knee, leg.kneeHeight), 3.1)} {...shell} />
            <path d={capsulePath(at(leg.knee, leg.kneeHeight), at(leg.foot, leg.clearance), 1.9)} {...machined} />
          </g>
        ))}
        {tail.joints.slice(0, -1).map((_, index) => {
          const a = knot(index)
          const b = knot(index + 1)
          return (
            <path
              key={index}
              data-segment={index}
              d={capsulePath(at(a, a.height), at(b, b.height), px(4.4 - a.s * 1.6))}
              {...(index % 2 === 0 ? shell : machined)}
            />
          )
        })}
        <path d={extrudedPath(roundedFootprint(17, 26, 9, 6), camera, pose.height + 7, pose.height - 6)} {...shell} />
        {[-1, 1].map((side) => (
          <path
            key={side}
            d={capsulePath(at({ x: side * 14, y: 20 }, pose.height), at({ x: side * 26, y: 56 }, pose.height - 2), 3.4)}
            {...machined}
          />
        ))}
      </g>}

      <g
        data-scorpion
        data-view={view}
        transform={`translate(125 130) ${ground} scale(1 -1) rotate(${px(-course)})`.replace(/\s+/g, " ")}
      >
        {pose.legs.map(legDrawing)}

        {/* The metasoma. Height reads in plan as a shift toward the nose, so an
            arched tail genuinely comes over the back instead of getting longer. */}
        <g data-tail>
          {tail.joints.slice(0, -1).map((_, index) => {
            const a = knot(index)
            const b = knot(index + 1)
            const lift = (h: number) => (h - pose.height) * RELIEF
            return (
              <g key={index} data-segment={index}>
                <path
                  d={capsulePath(
                    { x: a.x, y: a.y + lift(a.height) },
                    { x: b.x, y: b.y + lift(b.height) },
                    px(4.4 - a.s * 1.6),
                  )}
                  {...(index % 2 === 0 ? shell : machined)}
                />
                <circle cx={px(b.x)} cy={px(b.y + lift(b.height))} r={px(2.6 - b.s * 0.8)} {...cast} />
              </g>
            )
          })}
          <g data-sting transform={`translate(${px(tip.x)} ${px(tip.y + (tip.height - pose.height) * RELIEF)})`}>
            <path d="M -4 -3 Q 0 9 4 -3 Q 0 -6 -4 -3 Z" {...cast} />
            <circle cx={0} cy={6} r={1.6} fill={palette.accent} />
            <circle cx={0} cy={6} r={3.4} fill="none" stroke={palette.glow} strokeWidth={0.8} opacity={px(0.2 + curl * 0.5)} />
          </g>
        </g>

        <g data-body>
          <path d="M -17 -26 Q -19 6 -12 24 L 12 24 Q 19 6 17 -26 Q 0 -31 -17 -26 Z" {...shell} />
          <g stroke={palette.dark} strokeWidth={0.9} opacity={0.4} fill="none">
            {[-18, -10, -2, 6, 14].map((y) => (
              <path key={y} d={`M -15 ${y} H 15`} />
            ))}
          </g>
          <rect x={-5} y={4} width={10} height={13} rx={3} {...cast} />
          {/* The median eyes, on the ridge of the carapace. */}
          {([-1, 1] as const).map((side) => (
            <circle key={side} cx={px(side * 3.4)} cy={18} r={1.7} fill={palette.accent} />
          ))}
        </g>

        <g data-chelicerae>
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              d={`M ${px(side * 4)} 24 q ${px(side * 3)} 5 ${px(side * 1)} 8`}
              fill="none"
              stroke={palette.metal}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </g>

        {palp(-1)}
        {palp(1)}
      </g>

      {label && (
        <text x={125} y={228} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: stalk, stand guard, or whip the tail. */
export function scorpionBehaviorPose(behavior: ScorpionBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Standing its ground: tail right up, claws spread, feet planted.
    case "guard":
      return {
        gait: "stand" as HexapodGait,
        rate: 0,
        heading: 24 * Math.sin(time * 0.3),
        bob: 0.04 * Math.sin(time * 1.4),
        arch: 0.92,
        claw: 0.85 + 0.12 * Math.sin(time * 2),
      }
    // A strike is the tail loading and letting go, over and over.
    case "strike": {
      const load = Math.pow(Math.max(0, Math.sin(time * 1.6)), 4)
      return {
        gait: "stand" as HexapodGait,
        rate: 0,
        heading: 0,
        bob: 0.03 * load,
        arch: lerp(0.55, 1, load),
        claw: 0.7,
      }
    }
    case "static":
      return { gait: "stand" as HexapodGait, rate: 0, heading: 0, bob: 0, arch: 0.55, claw: 0.4 }
    // Low and forward, tail half up, casting for something to eat.
    default:
      return {
        gait: "tripod" as HexapodGait,
        rate: 1,
        heading: 34 * Math.sin(time * 0.3),
        bob: 0.02 * Math.sin(time * 6),
        arch: 0.42 + 0.12 * Math.sin(time * 0.8),
        claw: 0.35 + 0.2 * Math.sin(time * 1.1),
      }
  }
}

export { RobotScorpion }
