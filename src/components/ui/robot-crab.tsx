"use client"

/**
 * robot-crab — a sideways walker seen from above.
 *
 * The same `solveHexapod` the spider walks on, turned 90°: the body keeps
 * facing forward while the feet travel across it, which is the whole
 * difference between a spider's gait and a crab's. Two hinged claws and a pair
 * of eyestalks are its own. It watches the pointer down the stalks, and snaps
 * both claws when clicked.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveHexapod, type HexapodGait, type HexapodLeg } from "@/lib/robocn/hexapod"
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

/** Seconds a snapped claw takes to shut and open again. */
const SNAP = 0.5

export type CrabBehavior = "scuttle" | "idle" | "static"

/** The walker is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotCrabProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** What it does when `phase` is not supplied. */
  /** Where the camera stands. One walker, four projections. */
  view?: RobotView
  behavior?: CrabBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: HexapodGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a colony of them breaks step. */
  offset?: number
  /** Walking legs, rounded to an even number and clamped 4–10. The claws are extra. */
  legs?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Travel direction in degrees across the body: 90 walks to starboard. */
  heading?: number
  /** Claw opening, 0 shut and 1 wide. Omit and the behavior works them. */
  claw?: number
  /** Eyestalk aim, −1..1. Omit and the stalks follow the pointer. */
  eyes?: number
  /** Track the pointer down the stalks, and snap when clicked. */
  interactive?: boolean
  onSnap?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the feet carrying weight. */
  showContacts?: boolean
  label?: string
}

/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4

function RobotCrab({
  behavior = "scuttle", gait, phase, view = NATIVE_VIEW, speed = 1, animate = true, paused = false, offset = 0,
  legs = 8, height = 0.4, stride = 0.7, lift = 0.55, heading, claw, eyes,
  interactive = true, onSnap,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotCrabProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A snap shuts both claws hard and lets them fall open again.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const snap = since >= 0 && since < SNAP ? Math.sin((since / SNAP) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && eyes === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: (0.5 - unit.y) * 2,
    }), []),
  })

  const scripted = crabBehaviorPose(behavior, clock)
  const pose = solveHexapod({
    legs,
    gait: gait ?? scripted.gait,
    phase: controlled ? phase : clock * speed * scripted.rate,
    height: clamp(height + scripted.bob, 0, 1),
    stride,
    lift,
    // Feet travel across the body while the carapace keeps facing forward.
    heading: heading ?? scripted.heading,
    radius: 22,
    fan: 148,
    spread: 0.84,
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const gape = finiteClamp((claw ?? scripted.claw) * (1 - snap), 0, 1, 0.4)
  const aim = finiteClamp(eyes ?? pointer.target?.x ?? scripted.eyes, -1, 1, 0)
  const course = Number.isFinite(heading) ? (heading as number) : scripted.heading

  function legDrawing(leg: HexapodLeg) {
    const knee = { x: leg.knee.x, y: leg.knee.y - leg.kneeHeight * RELIEF }
    const foot = { x: leg.foot.x, y: leg.foot.y - leg.clearance * RELIEF }
    return (
      <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
        {!leg.contact && (
          <ellipse cx={px(leg.foot.x)} cy={px(leg.foot.y)} rx={3} ry={2} fill={palette.dark} opacity={0.18} />
        )}
        <path d={capsulePath(leg.hip, knee, 3.4)} {...shell} />
        <path d={capsulePath(knee, foot, 2.1)} {...machined} />
        <circle cx={px(leg.hip.x)} cy={px(leg.hip.y)} r={3.6} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={2.9} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={1} fill={palette.metal} />
        <circle cx={px(foot.x)} cy={px(foot.y)} r={1.7} fill={palette.dark} />
        {showContacts && leg.contact && (
          <circle data-contact cx={px(leg.foot.x)} cy={px(leg.foot.y)} r={3.4} fill="none" stroke={palette.accent} strokeWidth={1.1} />
        )}
      </g>
    )
  }

  /**
   * A cheliped off the front corner of the shell: upper arm out, forearm
   * forward, then a pincer whose upper jaw is the one moving part.
   */
  function clawDrawing(side: 1 | -1) {
    const name = side === 1 ? "right" : "left"
    const shoulder = { x: side * 38, y: 2 }
    const elbow = { x: side * 62, y: 14 }
    const wrist = { x: side * 56, y: 33 }
    // Both prongs sit either side of the claw axis; only the upper one moves.
    const open = 7 + gape * 30
    return (
      <g data-claw={name}>
        <path d={capsulePath(shoulder, elbow, 4.6)} {...shell} />
        <path d={capsulePath(elbow, wrist, 3.6)} {...machined} />
        <circle cx={px(shoulder.x)} cy={px(shoulder.y)} r={4} {...cast} />
        <circle cx={px(elbow.x)} cy={px(elbow.y)} r={4.2} {...cast} />
        {/* The claw axis rakes out and forward, the way a crab carries one. */}
        <g transform={`translate(${px(wrist.x)} ${px(wrist.y)}) rotate(${px(side * -34)})`}>
          <path d="M -6.5 -3 Q -8 9 0 13 Q 8 9 6.5 -3 Z" {...shell} />
          <g transform={`rotate(${px(-open)})`}>
            <path d="M -3 7 L -2.4 25 L 2.6 23 L 3 8 Z" {...cast} />
          </g>
          <g data-jaw transform={`rotate(${px(open)})`}>
            <path d="M -3 7 L -2.4 25 L 2.6 23 L 3 8 Z" {...machined} />
          </g>
          <circle cx={0} cy={2} r={2.2} fill={palette.accent} />
        </g>
      </g>
    )
  }
  // Plan view is the identity projection. The gait solver reports a height for
  // every knee and a clearance for every foot, so off-axis the legs are the
  // solve itself; the carapace is a shell with a real thickness, and the
  // chelipeds are tubes rather than outlines.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  const at = (p: { x: number; y: number }, height: number) =>
    camera.project(p.x, height, -p.y)
  const legSolid = (leg: HexapodLeg) => (
    <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
      <path d={capsulePath(at(leg.hip, pose.height), at(leg.knee, leg.kneeHeight), 3.4)} {...shell} />
      <path d={capsulePath(at(leg.knee, leg.kneeHeight), at(leg.foot, leg.clearance), 2.1)} {...machined} />
    </g>
  )
  const clawSolid = (side: 1 | -1) => (
    <g key={side} data-claw={side === 1 ? "right" : "left"}>
      <path d={capsulePath(at({ x: side * 38, y: 2 }, pose.height), at({ x: side * 62, y: 14 }, pose.height + 2), 3.4)} {...shell} />
      <path d={capsulePath(at({ x: side * 62, y: 14 }, pose.height + 2), at({ x: side * 56, y: 33 }, pose.height), 3)} {...machined} />
    </g>
  )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot crab, ${behavior === "static" ? "still" : behavior}, claws ${Math.round(gape * 100)} percent open, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 240 200"
      width={width}
      height={px(width * 200 / 240)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onSnap?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 14 96 H 226 M 120 12 V 180" strokeDasharray="2 3" />
          <path d={`M 120 96 l ${px(Math.sin((course * Math.PI) / 180) * 60)} ${px(-Math.cos((course * Math.PI) / 180) * 60)}`} strokeDasharray="4 3" />
        </g>
      )}
      {showGround && <ellipse cx={120} cy={96} rx={86} ry={62} fill={palette.dark} opacity={0.06} />}

      {/* Plan view: x starboard, y toward the nose. The carapace never turns. */}
      {offAxis && <g data-solids transform="translate(120 96)">
        {pose.legs.map(legSolid)}
        {[-1, 1].map(side => clawSolid(side as 1 | -1))}
        <path
          d={extrudedPath(roundedFootprint(46, 25, 16, 7).map(point => ({ x: point.x, y: point.y })), camera, pose.height + 8, pose.height - 6)}
          {...shell}
        />
        <path
          d={extrudedPath(circleFootprint(0, -15, 14, 12), camera, pose.height + 12, pose.height + 6)}
          {...machined}
        />
      </g>}
      <g data-crab data-view={view} transform={`translate(120 96) ${ground} scale(1 -1)`.replace(/\s+/g, " ")}>
        {pose.legs.map(legDrawing)}

        <g data-body>
          {/* Carapace: wide, low, and notched at the front for the stalks. */}
          <path
            d="M -46 -4 Q -44 -21 -24 -25 L 24 -25 Q 44 -21 46 -4 Q 42 14 22 20 L 14 20 L 11 25 L -11 25 L -14 20 L -22 20 Q -42 14 -46 -4 Z"
            {...shell}
          />
          <path d="M -34 -12 Q 0 -19 34 -12" fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.45} />
          <path d="M -30 7 Q 0 12 30 7" fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.35} />
          {/* Rear vent stack. */}
          <rect x={-14} y={-19} width={28} height={9} rx={2.5} {...machined} />
          {[-9, -3, 3, 9].map((x) => (
            <line key={x} x1={x} y1={-17.5} x2={x} y2={-11.5} stroke={palette.dark} strokeWidth={0.8} opacity={0.6} />
          ))}
          {/* Shoulder spikes, where the chelipeds mount. */}
          <path d="M -46 -2 l -8 -4 l 7 6 Z" {...cast} />
          <path d="M 46 -2 l 8 -4 l -7 6 Z" {...cast} />
          <circle cx={-18} cy={2} r={2.4} fill={palette.accent} opacity={0.85} />
          <circle cx={18} cy={2} r={2.4} fill={palette.accent} opacity={0.85} />

          <g data-eyes>
            {[-1, 1].map((side) => (
              <g key={side} transform={`translate(${side * 8} 20) rotate(${px(-aim * 24)})`}>
                <path d="M 0 0 V 12" stroke={palette.metal} strokeWidth={2.8} strokeLinecap="round" />
                <circle cx={0} cy={14.5} r={3.6} {...cast} />
                <circle cx={px(aim * 1.2)} cy={15.1} r={1.8} fill={palette.accent} />
              </g>
            ))}
          </g>
        </g>

        {clawDrawing(-1)}
        {clawDrawing(1)}
      </g>

      {label && (
        <text x={120} y={192} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: scuttle one way then the other, or wave its claws. */
export function crabBehaviorPose(behavior: CrabBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Claw display: a slow open and shut, on the spot.
    case "idle":
      return {
        gait: "stand" as HexapodGait,
        rate: 0,
        heading: 90,
        bob: 0.05 * Math.sin(time * 1.2),
        claw: 0.5 + 0.5 * Math.sin(time * 1.6),
        eyes: 0.5 * Math.sin(time * 0.6),
      }
    case "static":
      return { gait: "stand" as HexapodGait, rate: 0, heading: 90, bob: 0, claw: 0.4, eyes: 0 }
    // Runs to starboard, stops, runs back: a crab never commits for long.
    default: {
      const leg = Math.sin(time * 0.45)
      return {
        gait: "tripod" as HexapodGait,
        rate: Math.sign(leg) || 1,
        heading: leg >= 0 ? 90 : 270,
        bob: 0.03 * Math.sin(time * 7),
        claw: 0.25 + 0.2 * Math.sin(time * 2.3),
        eyes: 0.6 * Math.sin(time * 0.9),
      }
    }
  }
}

export { RobotCrab }
