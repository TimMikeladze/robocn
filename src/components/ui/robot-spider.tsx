"use client"

/**
 * robot-spider — an eight-legged walker seen from above.
 *
 * `solveHexapod` does the walking: every knee is a two-link solve in its own
 * vertical plane, so femur and tibia hold their length in every pose, and the
 * gait decides which feet are carrying. Left alone it walks, skitters or
 * breathes; hand it `phase` and your timeline drives the cycle. It turns to
 * face the pointer and walks while it is watched, and a click drops it into a
 * crouch.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

export type SpiderBehavior = "walk" | "skitter" | "idle" | "static"

/** The walker is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotSpiderProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** What it does when `phase` is not supplied. */
  /** Where the camera stands. One walker, four projections. */
  view?: RobotView
  behavior?: SpiderBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: HexapodGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a nest of them breaks step. */
  offset?: number
  /** Legs, rounded to an even number and clamped 4–10. */
  legs?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Facing in degrees, clockwise from up. Omit and it turns toward the pointer. */
  heading?: number
  /** Turn to the pointer and walk while watched; click to crouch. */
  interactive?: boolean
  onCrouchChange?: (crouched: boolean) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the feet carrying weight. */
  showContacts?: boolean
  label?: string
}

/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4

function RobotSpider({
  behavior = "walk", gait, phase, view = NATIVE_VIEW, speed = 0.9, animate = true, paused = false, offset = 0,
  legs = 8, height = 0.55, stride = 0.65, lift = 0.5, heading,
  interactive = true, onCrouchChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotSpiderProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [crouched, setCrouched] = React.useState(false)

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && heading === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: (unit.x - 0.5) * 2,
      y: (0.5 - unit.y) * 2,
    }), []),
  })
  // Being watched is what gets it moving: an idle spider walks while the
  // pointer is over it, the way the quadruped does.
  const roused = interactive && pointer.active && !crouched
  const active: SpiderBehavior = crouched
    ? "static"
    : roused && behavior === "idle"
      ? "walk"
      : behavior

  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && active !== "static",
    paused,
    phase: offset,
  })
  const scripted = spiderBehaviorPose(active, clock)
  const resolvedGait = gait ?? scripted.gait
  const aimed = heading ?? (pointer.target ? toDegrees(Math.atan2(pointer.target.x, pointer.target.y)) : scripted.facing)
  const facing = Number.isFinite(aimed) ? aimed : 0

  const pose = solveHexapod({
    legs,
    gait: crouched ? "stand" : resolvedGait,
    phase: controlled ? phase : clock * speed * scripted.rate,
    height: clamp(crouched ? 0.06 : height + scripted.bob, 0, 1),
    stride: crouched ? 0.15 : stride,
    lift,
    // The body turns to face where it is going, so the feet always travel
    // along the nose axis.
    heading: 0,
    radius: 15,
    fan: 152,
    spread: 0.8,
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  // A taller body shows more of itself from directly above.
  const bulk = 0.9 + (pose.height / 30) * 0.18

  function legDrawing(leg: HexapodLeg) {
    const knee = { x: leg.knee.x, y: leg.knee.y - leg.kneeHeight * RELIEF }
    const foot = { x: leg.foot.x, y: leg.foot.y - leg.clearance * RELIEF }
    return (
      <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
        {!leg.contact && (
          <ellipse cx={px(leg.foot.x)} cy={px(leg.foot.y)} rx={3} ry={2} fill={palette.dark} opacity={0.18} />
        )}
        <path d={capsulePath(leg.hip, knee, 3.1)} {...shell} />
        <path d={capsulePath(knee, foot, 2)} {...machined} />
        <circle cx={px(leg.hip.x)} cy={px(leg.hip.y)} r={3.4} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={2.8} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={1} fill={palette.metal} />
        <circle cx={px(foot.x)} cy={px(foot.y)} r={1.6} fill={palette.dark} />
        {showContacts && leg.contact && (
          <circle data-contact cx={px(leg.foot.x)} cy={px(leg.foot.y)} r={3.4} fill="none" stroke={palette.accent} strokeWidth={1.1} />
        )}
      </g>
    )
  }
  // The drawing is the ground plane the spider walks on, so it goes through
  // `plane` and comes out untouched from above, facing included. The gait
  // solver already works in three dimensions — every knee has a height and
  // every foot a clearance — so off-axis the legs are simply the solve, drawn
  // at the heights the plan view could only hint at by sliding them up.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  const spin = toRadians(facing)
  const cos = Math.cos(spin)
  const sin = Math.sin(spin)
  /** A plan point at a height, turned by the machine's facing. */
  const at = (p: { x: number; y: number }, height: number) =>
    camera.project(p.x * cos + p.y * sin, height, -(p.y * cos - p.x * sin))
  const legSolid = (leg: HexapodLeg) => (
    <g key={leg.id} data-leg={leg.id} data-side={leg.side} opacity={leg.contact ? 1 : 0.82}>
      <path d={capsulePath(at(leg.hip, pose.height), at(leg.knee, leg.kneeHeight), 3.1)} {...shell} />
      <path d={capsulePath(at(leg.knee, leg.kneeHeight), at(leg.foot, leg.clearance), 2)} {...machined} />
    </g>
  )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot spider, ${pose.legs.length} legs, ${crouched ? "crouched" : resolvedGait} gait, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 220 220"
      width={width}
      height={width}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setCrouched((current) => {
          onCrouchChange?.(!current)
          return !current
        })
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <circle cx={110} cy={108} r={86} strokeDasharray="2 3" />
          <path d="M 14 108 H 206 M 110 12 V 204" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <ellipse cx={110} cy={108} rx={px(74)} ry={px(72)} fill={palette.dark} opacity={0.06} />
      )}

      {/* Plan view: x starboard, y toward the nose, so the group flips y and
          the whole machine turns to face where it is walking. */}
      {offAxis && <g data-solids transform="translate(110 108)">
        {pose.legs.map(legSolid)}
        <path
          d={extrudedPath(
            roundedFootprint(16 * bulk, 21 * bulk, 12, 6).map(point => ({ x: point.x, y: point.y + 19 * bulk })),
            camera, pose.height + 9, pose.height - 7, facing,
          )}
          {...shell}
        />
        <path
          d={extrudedPath(circleFootprint(0, -6 * bulk, 13 * bulk, 12), camera, pose.height + 5, pose.height - 7, facing)}
          {...machined}
        />
      </g>}
      <g data-spider data-view={view} transform={`translate(110 108) ${ground} rotate(${px(facing)}) scale(1 -1)`.replace(/\s+/g, " ")}>
        {pose.legs.filter((leg) => leg.side === "right").map(legDrawing)}
        {pose.legs.filter((leg) => leg.side === "left").map(legDrawing)}

        <g data-body transform={`scale(${px(bulk)})`}>
          <ellipse cx={0} cy={-19} rx={16} ry={21} {...shell} />
          <path d="M -11 -30 Q 0 -44 11 -30" fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          <path d="M -13 -19 H 13 M -12 -10 H 12" stroke={palette.dark} strokeWidth={0.8} opacity={0.45} />
          <ellipse cx={0} cy={6} rx={13} ry={12} {...machined} />
          <rect x={-7} y={1} width={14} height={9} rx={2} {...cast} />
          {[-4.5, 0, 4.5].map((x) => (
            <line key={x} x1={x} y1={2.5} x2={x} y2={8.5} stroke={palette.metal} strokeWidth={0.9} />
          ))}
          <g data-sensors>
            {[-5.5, -2, 2, 5.5].map((x, index) => (
              <circle key={x} cx={x} cy={index === 1 || index === 2 ? 16 : 14.5} r={index === 1 || index === 2 ? 2.1 : 1.4} fill={palette.accent} opacity={index === 1 || index === 2 ? 1 : 0.6} />
            ))}
          </g>
          <path d="M -9 13 L -15 22" stroke={palette.metal} strokeWidth={2.2} strokeLinecap="round" />
          <path d="M 9 13 L 15 22" stroke={palette.metal} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={0} cy={-36} r={2.4} {...cast} />
          <circle cx={0} cy={-36} r={1.1} fill={palette.glow} />
        </g>
      </g>

      {label && (
        <text x={110} y={212} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** What it does with no timeline on it: pace, scurry, or stand and breathe. */
export function spiderBehaviorPose(behavior: SpiderBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // A fast ripple, the gait a spider actually bolts with.
    case "skitter":
      return { gait: "ripple" as HexapodGait, rate: 2.4, bob: 0.04 * Math.sin(time * 9), facing: 18 * Math.sin(time * 0.7) }
    // Standing: the body rises and settles, which is all a resting one does.
    case "idle":
      return { gait: "stand" as HexapodGait, rate: 0, bob: 0.05 * Math.sin(time * 1.4), facing: 12 * Math.sin(time * 0.35) }
    case "static":
      return { gait: "stand" as HexapodGait, rate: 0, bob: 0, facing: 0 }
    default:
      return { gait: "tripod" as HexapodGait, rate: 1, bob: 0.02 * Math.sin(time * 6), facing: 8 * Math.sin(time * 0.5) }
  }
}

export { RobotSpider }
