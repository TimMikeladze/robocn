"use client"

/**
 * reachy-mini — a companion robot head on a six-rod parallel platform.
 *
 * The linkage is the honest part: six legs solved with real Stewart platform
 * inverse kinematics and projected through the shared isometric helper. The
 * head shell is an illustration that takes its roll, yaw and pitch from the
 * same pose, so the drawing and the mechanism never disagree about where the
 * robot is looking.
 *
 * Left alone the platform breathes, scans the room, or nods. Watch it while
 * you move the pointer and the whole head comes round, not just the pupils —
 * six leg lengths resolve for every frame of it. Click and it nods back.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, isometric, isometricDepth, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultStewartGeometry,
  solveStewart,
  type StewartGeometry,
  type StewartPose,
} from "@/lib/robocn/stewart"
import {
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

/** Proportions that fit the drawing's frame; override any of them. */
const headGeometry: StewartGeometry = {
  ...defaultStewartGeometry,
  baseRadius: 24,
  platformRadius: 18,
  height: 30,
  travel: 9,
}

/** Slight spin so the rods read as an X on both sides rather than head-on. */
/** The robot is drawn in its own axonometric; that is what `iso` means here. */
const axonometric = { spin: 60, tilt: 0.32 }
const NATIVE_VIEW: RobotView = "iso"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}


export type ReachyBehavior = "idle" | "scan" | "nod" | "static"

export interface ReachyMiniProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps,
    StewartPose {
  /** What the platform does with any axis you have not supplied. */
  behavior?: ReachyBehavior
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a shelf of heads breaks step. */
  phase?: number
  /** Turn the head toward the pointer, and nod when clicked. */
  interactive?: boolean
  onNod?: () => void
  /** Where the camera stands. One robot, four projections. */
  view?: RobotView
  size?: RobotSize | number
  variant?: RobotVariant
  /** Pupil aim in −1..1 on both axes. Set it to drive the gaze yourself. */
  look?: Vec2 | null
  /** Follow the pointer anywhere on the page while `look` is null. */
  track?: boolean
  blink?: boolean
  /** Antenna angles in degrees; positive leans a wire outward. */
  antennaLeft?: number
  antennaRight?: number
  /** Draw the six rods and their bearings. */
  showLinkage?: boolean
  showGround?: boolean
  label?: string
  geometry?: Partial<StewartGeometry>
}

function ReachyMini({
  sway, heave, surge, roll, pitch, yaw,
  behavior = "idle", speed = 0.35, animate = true, paused = false, phase = 0,
  interactive = true, onNod,
  view = NATIVE_VIEW,
  size = "md", variant = "solid", look = null, track = true, blink = true,
  antennaLeft, antennaRight, showLinkage = true, showGround = true, label, geometry,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: ReachyMiniProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed,
    animate: animate && behavior !== "static",
    paused,
    phase,
  })

  // A nod is one damped swing of the pitch axis, so the linkage does the work
  // rather than a transform on the shell.
  const [nodded, setNodded] = React.useState<number | null>(null)
  const since = nodded === null ? Infinity : (clock - nodded) / Math.max(speed, 0.01)
  const nudge = since >= 0 && since < 1.2 ? Math.exp(-since * 3.4) * Math.sin(since * 11) * 17 : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: (track || interactive) && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((point: Vec2) => {
      const x = (point.x - 0.5) * 2
      const y = (point.y - 0.5) * 2
      const distance = Math.hypot(x, y) || 1
      const limit = Math.min(1, distance) / distance
      return { x: x * limit, y: y * limit }
    }, []),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const pupil = { x: clamp(gaze.x, -1, 1) * 4.5, y: clamp(gaze.y, -1, 1) * 3.5 }

  // Anything you have not supplied comes from the behaviour, or from the
  // pointer: the head turns to what it is looking at.
  const scripted = reachyBehaviorPose(behavior, clock)
  const watching = track && !look && pointer.target ? pointer.target : null
  const pose: StewartPose = {
    sway: bound(sway ?? scripted.sway, 10),
    heave: bound(heave ?? scripted.heave, 8),
    surge: bound(surge ?? scripted.surge, 10),
    roll: bound(roll ?? scripted.roll, 24),
    pitch: bound((pitch ?? (watching ? watching.y * 17 : scripted.pitch)) + nudge, 24),
    yaw: bound(yaw ?? (watching ? watching.x * 26 : scripted.yaw), 30),
  }
  const solution = solveStewart(pose, { ...headGeometry, ...geometry })
  // The whole robot is already modelled in world units, so a view is only a
  // change of projection: `iso` keeps its own axonometric, and the other three
  // take the shared orthographic camera. Isometric coordinates run z toward
  // the viewer and the group draws y up.
  const camera = robotCamera(view)
  const orthographic = view !== NATIVE_VIEW
  const flat = (v: Vec3): Vec2 => {
    if (!orthographic) return isometric(v, axonometric)
    const point = camera.project(v.x, v.y, -v.z)
    return { x: point.x, y: -point.y }
  }
  // Both report how near the camera a point is, so the rods sort the same way
  // under either projection: negative is behind the platform, positive in front.
  const toward = (v: Vec3) =>
    orthographic ? camera.depth(v.x, v.y, -v.z) : isometricDepth(v, axonometric)
  const center = flat(solution.center)

  // Yaw and pitch are shown by moving and foreshortening the face, since the
  // shell is a drawing rather than a solved surface.
  const turn = pose.yaw ?? 0
  const nod = pose.pitch ?? 0
  const faceShift = { x: turn * 0.55, y: -nod * 0.4 }
  const squeeze = { x: 1 - Math.abs(turn) / 170, y: 1 - Math.abs(nod) / 220 }

  const rods = solution.legs
    .map(leg => ({
      leg,
      base: flat(leg.base),
      top: flat(leg.platform),
      depth: toward(leg.platform) + toward(leg.base),
    }))
    .sort((a, b) => a.depth - b.depth)
  const behind = rods.filter(rod => rod.depth < 0)
  const infront = rods.filter(rod => rod.depth >= 0)

  const rod = (item: (typeof rods)[number]) => (
    <g key={item.leg.id} data-rod={item.leg.id} opacity={item.depth < 0 ? 0.55 : 1}>
      <line x1={px(item.base.x)} y1={px(item.base.y)} x2={px(item.top.x)} y2={px(item.top.y)}
        stroke={palette.dark} strokeWidth={3.2} strokeLinecap="round" />
      <line x1={px(item.base.x)} y1={px(item.base.y)} x2={px(item.top.x)} y2={px(item.top.y)}
        stroke={item.leg.withinLimits ? palette.metal : palette.accent} strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={px(item.base.x)} cy={px(item.base.y)} r={2.1} fill={palette.dark} />
    </g>
  )

  // The antennas trail the head: a wire does not turn with the servo.
  const spring = -turn * 0.5 + nudge * 0.6
  const antenna = (side: -1 | 1, angle: number) => (
    <g data-antenna={side < 0 ? "left" : "right"}
      transform={`translate(${px(side * 21)} 59) rotate(${px(bound(-side * angle, 45))})`}>
      <path d={`M 0 0 q ${side * 3} 9 ${side * 2} 17`} fill="none" stroke={palette.dark} strokeWidth={1.5} strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map(i => (
        <ellipse key={i} cx={px(side * 2)} cy={px(19 + i * 3.2)} rx={3.4} ry={1.5}
          fill="none" stroke={palette.dark} strokeWidth={1.3} />
      ))}
      <circle cx={px(side * 2)} cy={38} r={2.2} fill={palette.accent} />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Companion robot, head yaw ${Math.round(pose.yaw ?? 0)} degrees, ${viewNames[view] ?? viewNames.iso}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setNodded(clock)
        onNod?.()
      }}
      viewBox="0 0 200 200"
      width={width}
      height={width}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g data-view={view} transform="translate(100 182) scale(1 -1)">
        {showGround && <ellipse cx={0} cy={1} rx={48} ry={5.5} fill={palette.dark} opacity={0.14} />}

        {/* Body: a speaker barrel the platform bolts to. */}
        <path d="M -41 0 C -41 22 -37 42 -27 54 L 27 54 C 37 42 41 22 41 0 Z" {...shell} />
        {variant !== "wire" && [12, 21, 30, 39].map((y, i) => (
          <rect key={y} x={px(-26 + i * 2.6)} y={y} width={px(52 - i * 5.2)} height={3.4} rx={1.7}
            fill={palette.dark} opacity={0.28} />
        ))}
        <path d="M -41 0 h 82" stroke={palette.dark} strokeWidth={1.2} fill="none" opacity={0.5} />
        <ellipse cx={0} cy={54} rx={27} ry={8} {...machined} />

        {showLinkage && behind.map(rod)}
        {showLinkage && <ellipse data-platform cx={px(center.x)} cy={px(center.y)} rx={19} ry={6.4} {...cast} />}
        {showLinkage && infront.map(rod)}

        {/* Head. Roll turns the whole shell; yaw and pitch move the face. */}
        <g data-head transform={`translate(${px(center.x)} ${px(center.y)}) rotate(${px(-(pose.roll ?? 0))})`}>
          <rect x={-16} y={-2} width={32} height={13} rx={4} {...cast} />
          <rect x={-38} y={9} width={76} height={56} rx={23} {...shell} />
          <g transform={`translate(${px(faceShift.x)} ${px(faceShift.y + 36)}) scale(${px(squeeze.x)} ${px(squeeze.y)})`}>
            <rect x={-14} y={-2.2} width={28} height={4.4} rx={2.2} {...cast} />
            {[-1, 1].map(side => (
              <g key={side} data-eye={side < 0 ? "left" : "right"}>
                <circle cx={px(side * 19)} cy={0} r={14.5} {...cast} />
                <g className={blink ? "robocn-blink" : undefined} style={{ transformOrigin: `${px(side * 19)}px 0px` }}>
                  <circle cx={px(side * 19 + pupil.x)} cy={px(pupil.y)} r={6.4} fill={palette.accent} opacity={0.85} />
                  <circle cx={px(side * 19 + pupil.x)} cy={px(pupil.y)} r={3} fill={palette.dark} />
                  <circle cx={px(side * 19 + pupil.x + 2.4)} cy={px(pupil.y + 3)} r={1.8} fill={palette.metal} opacity={0.85} />
                </g>
              </g>
            ))}
          </g>
          {antenna(-1, antennaLeft ?? spring)}
          {antenna(1, antennaRight ?? -spring)}
        </g>
      </g>
      {!solution.reachable && (
        <circle data-fault cx={186} cy={14} r={4} fill={palette.accent} className="robocn-pulse" />
      )}
      {label && (
        <text x={100} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const bound = (value: number, limit: number) =>
  Number.isFinite(value) ? clamp(value, -limit, limit) : 0

/**
 * The pose the platform holds on its own. Idle is breathing — a slow heave
 * with a little sway under it; scan sweeps the yaw across the room and dips
 * the pitch at the ends of the sweep; nod is the repeated version of the one
 * a click asks for.
 */
export function reachyBehaviorPose(behavior: ReachyBehavior, clock: number): Required<StewartPose> {
  const t = Number.isFinite(clock) ? clock * Math.PI * 2 : 0
  switch (behavior) {
    case "scan":
      return {
        sway: Math.sin(t) * 3,
        heave: 0,
        surge: 0,
        roll: Math.sin(t) * 4,
        pitch: Math.cos(t * 2) * 5,
        yaw: Math.sin(t) * 26,
      }
    case "nod":
      return { sway: 0, heave: Math.sin(t * 2) * 1.6, surge: 0, roll: 0, pitch: Math.sin(t * 2) * 14, yaw: 0 }
    case "static":
      return { sway: 0, heave: 0, surge: 0, roll: 0, pitch: 0, yaw: 0 }
    default:
      return {
        sway: Math.sin(t * 0.42) * 2.4,
        heave: Math.sin(t * 0.9) * 1.5,
        surge: Math.cos(t * 0.31) * 1.8,
        roll: Math.sin(t * 0.37) * 2.6,
        pitch: Math.sin(t * 0.53) * 3.4,
        yaw: Math.sin(t * 0.29) * 7,
      }
  }
}

export { ReachyMini }
