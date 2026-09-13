"use client"

/**
 * robot-ant — a six-legged forager seen from above.
 *
 * The spider's carapace is one rigid plate. This body is three sections on a
 * short `solveSpine` chain, so head, thorax and gaster swing through a turn
 * one after the other instead of pivoting as a slab — the difference you can
 * see the moment it changes course. The legs are the shared `solveHexapod`
 * gait at six. Antennae track the pointer, and a click works the mandibles.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveHexapod, type HexapodGait, type HexapodLeg } from "@/lib/robocn/hexapod"
import { solveSpine, type SpineJoint } from "@/lib/robocn/spine"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
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

export type AntBehavior = "forage" | "haul" | "idle" | "static"
export type AntCargo = "none" | "crumb" | "leaf"

/** The forager is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4
/** Where the head end of the body chain sits, ahead of the leg hub. */
const NOSE = 24

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotAntProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One forager, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: AntBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: HexapodGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a column breaks step. */
  offset?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose. */
  heading?: number
  /** Mandible opening, 0 shut and 1 wide. Omit and the behavior works them. */
  bite?: number
  /** Antenna aim, −1..1. Omit and they follow the pointer. */
  antennae?: number
  /** What it is carrying over its head. */
  cargo?: AntCargo
  /** Gaster lift, 0 level to 1 cocked up. Omit and the behavior sets it. */
  gaster?: number
  /** The antennae track the pointer, and a click works the mandibles. */
  interactive?: boolean
  onMandibleChange?: (open: boolean) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the feet carrying weight. */
  showContacts?: boolean
  label?: string
}

/** Nose-to-gaster contour length of the body chain. */
const BODY = 62

function RobotAnt({
  behavior = "forage", gait, phase, view = NATIVE_VIEW, speed = 1.1, animate = true, paused = false, offset = 0,
  height = 0.5, stride = 0.66, lift = 0.5, heading, bite, antennae, cargo = "none", gaster,
  interactive = true, onMandibleChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotAntProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [open, setOpen] = React.useState(false)

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && antennae === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = antBehaviorPose(behavior, clock)
  const course = Number.isFinite(heading) ? (heading as number) : scripted.heading
  const cycle = controlled ? phase : clock * speed * scripted.rate

  const pose = solveHexapod({
    legs: 6,
    gait: gait ?? scripted.gait,
    phase: cycle,
    height: clamp(height + scripted.bob, 0, 1),
    stride,
    lift,
    heading: 0,
    radius: 12,
    fan: 132,
    spread: 0.82,
    femur: 19,
    tibia: 23,
  })

  // Three sections on one chain: a turn runs down the body rather than
  // pivoting the whole animal at once.
  const spine = solveSpine({
    segments: 6,
    length: BODY,
    phase: cycle * 0.5,
    amplitude: 0.1,
    waves: 0.5,
    taper: 0.4,
    turn: clamp(course / 90, -1, 1),
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const gape = finiteClamp(bite ?? (open ? 1 : scripted.bite), 0, 1, 0.2)
  const aim = finiteClamp(antennae ?? pointer.target?.x ?? scripted.antennae, -1, 1, 0)
  const cock = finiteClamp(gaster ?? scripted.gaster, 0, 1, 0)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()

  /** A body joint in drawing coordinates: x starboard, y toward the nose. */
  const bead = (joint: SpineJoint) => ({ x: joint.position.y, y: NOSE + joint.position.x, s: joint.s })
  /** The gaster rides above the plane when it is cocked up. */
  const rise = (s: number) => (s < 0.6 ? 0 : cock * 16 * (s - 0.6) / 0.4)
  const section = (s: number) => bead(spine.joints[Math.round(clamp(s, 0, 1) * (spine.joints.length - 1))])
  /** Heading of the body at station `s`, as a drawing rotation. */
  const facing = (s: number) =>
    -spine.joints[Math.round(clamp(s, 0, 1) * (spine.joints.length - 1))].angle

  const head = section(0.02)
  const thorax = section(0.36)
  const waist = section(0.62)
  const belly = section(0.86)

  /** A point in the plan drawing at `height` above the ground. */
  const at = (p: { x: number; y: number }, h: number) => camera.project(p.x, h, -p.y)

  function legDrawing(leg: HexapodLeg) {
    const knee = { x: leg.knee.x, y: leg.knee.y - leg.kneeHeight * RELIEF }
    const foot = { x: leg.foot.x, y: leg.foot.y - leg.clearance * RELIEF }
    return (
      <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
        <path d={capsulePath(leg.hip, knee, 2.4)} {...machined} />
        <path d={capsulePath(knee, foot, 1.5)} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={2} {...cast} />
        <circle cx={px(foot.x)} cy={px(foot.y)} r={1.3} fill={palette.dark} />
        {showContacts && leg.contact && (
          <circle data-contact cx={px(leg.foot.x)} cy={px(leg.foot.y)} r={3} fill="none" stroke={palette.accent} strokeWidth={1} />
        )}
      </g>
    )
  }

  const state = behavior === "static" ? "still" : behavior === "haul" ? "hauling" : behavior === "idle" ? "idle" : "foraging"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot ant, ${state}, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 230 220"
      width={width}
      height={px(width * 220 / 230)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = !open
        setOpen(next)
        onMandibleChange?.(next)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 108 H 218 M 115 14 V 200" strokeDasharray="2 3" />
          <path d={`M 115 108 l ${px(Math.sin(toRadians(course)) * 58)} ${px(-Math.cos(toRadians(course)) * 58)}`} strokeDasharray="4 3" />
        </g>
      )}
      {showGround && <ellipse cx={115} cy={108} rx={78} ry={62} fill={palette.dark} opacity={0.05} />}

      {offAxis && <g data-solids transform="translate(115 108)">
        {pose.legs.map((leg) => (
          <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
            <path d={capsulePath(at(leg.hip, pose.height), at(leg.knee, leg.kneeHeight), 2.4)} {...machined} />
            <path d={capsulePath(at(leg.knee, leg.kneeHeight), at(leg.foot, leg.clearance), 1.5)} {...cast} />
          </g>
        ))}
        {spine.joints.slice(0, -1).map((joint, index) => {
          const a = bead(joint)
          const b = bead(spine.joints[index + 1])
          return (
            <path
              key={index}
              data-segment={index}
              d={capsulePath(at(a, pose.height + rise(a.s)), at(b, pose.height + rise(b.s)), px(3 + 5 * Math.pow(a.s, 1.4)))}
              {...shell}
            />
          )
        })}
        <path d={extrudedPath(circleFootprint(head.x, head.y, 9, 12), camera, pose.height + 8, pose.height - 5)} {...cast} />
      </g>}

      <g
        data-ant
        data-view={view}
        transform={`translate(115 108) ${ground} scale(1 -1)`.replace(/\s+/g, " ")}
      >
        {pose.legs.map(legDrawing)}

        <g data-gaster transform={`translate(${px(belly.x)} ${px(belly.y - rise(belly.s) * RELIEF)}) rotate(${px(facing(0.86))})`}>
          <ellipse cx={0} cy={-4} rx={px(11 - cock * 1.5)} ry={px(14 - cock * 2)} {...shell} />
          <g stroke={palette.dark} strokeWidth={0.8} opacity={0.4} fill="none">
            <path d="M -9 -1 Q 0 -4 9 -1" />
            <path d="M -8 -8 Q 0 -11 8 -8" />
          </g>
          <circle cx={0} cy={-15} r={2} fill={palette.accent} opacity={0.85} />
        </g>

        {/* Petiole: the one-node waist that makes it read as an ant. */}
        <g data-waist>
          <path d={capsulePath({ x: waist.x, y: waist.y }, { x: belly.x, y: belly.y - rise(belly.s) * RELIEF + 8 }, 2.6)} {...machined} />
          <circle cx={px(waist.x)} cy={px(waist.y)} r={3} {...cast} />
        </g>

        <g data-thorax transform={`translate(${px(thorax.x)} ${px(thorax.y)}) rotate(${px(facing(0.36))})`}>
          <path d="M -8 -12 Q -10 6 -5 13 L 5 13 Q 10 6 8 -12 Q 0 -16 -8 -12 Z" {...shell} />
          <path d="M -7 0 H 7 M -6 7 H 6" stroke={palette.dark} strokeWidth={0.8} opacity={0.4} fill="none" />
          <circle cx={0} cy={4} r={2} fill={palette.accent} opacity={0.9} />
        </g>

        <g data-head transform={`translate(${px(head.x)} ${px(head.y)}) rotate(${px(facing(0.02) - aim * 8)})`}>
          <path d="M -9 -6 Q -10 8 0 11 Q 10 8 9 -6 Q 0 -10 -9 -6 Z" {...cast} />
          {([-1, 1] as const).map((side) => (
            <circle key={side} data-eye={side === 1 ? "right" : "left"} cx={px(side * 6)} cy={4} r={2.6} {...machined} />
          ))}
          <circle cx={0} cy={2} r={1.6} fill={palette.accent} opacity={0.85} />

          <g data-antennae>
            {([-1, 1] as const).map((side) => (
              <g key={side} data-antenna={side === 1 ? "right" : "left"} transform={`translate(${px(side * 5)} 9) rotate(${px(-side * 18 - aim * 26)})`}>
                {/* Elbowed: a long scape, then the club. */}
                <path d="M 0 0 V 13" stroke={palette.metal} strokeWidth={1.8} strokeLinecap="round" fill="none" />
                <g transform={`translate(0 13) rotate(${px(-side * 26)})`}>
                  <path d="M 0 0 V 10" stroke={palette.metal} strokeWidth={1.5} strokeLinecap="round" fill="none" />
                  <circle cx={0} cy={11} r={1.8} fill={palette.accent} />
                </g>
              </g>
            ))}
          </g>

          <g data-mandibles>
            {([-1, 1] as const).map((side) => (
              <g key={side} data-mandible={side === 1 ? "right" : "left"} transform={`translate(${px(side * 5)} 9) rotate(${px(side * (10 + gape * 34))})`}>
                <path d="M 0 0 Q 2 7 0 12 Q -3 7 -2 0 Z" {...machined} />
              </g>
            ))}
          </g>

          {cargo !== "none" && (
            <g data-cargo transform="translate(0 20)">
              {cargo === "leaf" ? (
                <path d="M 0 -10 Q 18 -4 0 14 Q -18 -4 0 -10 Z" {...shell} opacity={0.9} />
              ) : (
                <rect x={-8} y={-8} width={16} height={16} rx={3} {...machined} />
              )}
              <circle cx={0} cy={0} r={1.6} fill={palette.accent} opacity={0.7} />
            </g>
          )}
        </g>
      </g>

      {label && (
        <text x={115} y={212} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: forage, haul, or stand and feel about. */
export function antBehaviorPose(behavior: AntBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Carrying: slower, one leg at a time, and the gaster cocked up as ballast.
    case "haul":
      return {
        gait: "wave" as HexapodGait,
        rate: 0.6,
        heading: 20 * Math.sin(time * 0.22),
        bob: 0.02 * Math.sin(time * 5),
        bite: 1,
        antennae: 0.25 * Math.sin(time * 0.7),
        gaster: 0.8,
      }
    case "idle":
      return {
        gait: "stand" as HexapodGait,
        rate: 0,
        heading: 0,
        bob: 0.03 * Math.sin(time * 1.1),
        bite: 0.15 + 0.15 * Math.sin(time * 1.9),
        antennae: 0.8 * Math.sin(time * 1.4),
        gaster: 0.1,
      }
    case "static":
      return { gait: "stand" as HexapodGait, rate: 0, heading: 0, bob: 0, bite: 0.2, antennae: 0, gaster: 0 }
    // Foraging: quick tripod, casting left and right for a trail.
    default:
      return {
        gait: "tripod" as HexapodGait,
        rate: 1,
        heading: 46 * Math.sin(time * 0.35),
        bob: 0.025 * Math.sin(time * 8),
        bite: 0.2 + 0.1 * Math.sin(time * 3),
        antennae: lerp(-1, 1, (Math.sin(time * 2.1) + 1) / 2),
        gaster: 0.15,
      }
  }
}

export { RobotAnt }
