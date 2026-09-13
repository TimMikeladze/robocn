"use client"

/**
 * orb-droid — a ball with the drive inside it.
 *
 * The shell turns and the head does not: a stabilised platform on a rolling
 * body is the whole mechanism, so the two are separate channels driven from
 * one clock. Supply `bodyAngle` or `headAngle` and that channel is yours;
 * leave both and it runs `behavior`.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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

/** The droid is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the heights the elevation implied. */
const CENTRE = 95
const GROUND = 164
const BODY_RADIUS = 53
const HEAD_TOP = 126
const HEAD_FLOOR = 84
const HEAD_RADIUS = 36

/** How far the camera pulls back so the machine still fits a frame that was
 *  drawn for one view. One in the view it was drawn in. */
const fits: Record<RobotView, number> = { plan: 0.82, front: 1, profile: 0.95, iso: 0.93 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type OrbDroidBehavior = "roll" | "rock" | "survey" | "static"

export interface OrbDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  /** Controlled head rotation in degrees. Omit to run `behavior`. */
  headAngle?: number
  /** Controlled shell rotation in degrees. Omit to run `behavior`. */
  bodyAngle?: number
  /** What the droid does when neither angle is supplied. */
  behavior?: OrbDroidBehavior
  /** Cycles per second: one revolution, one rock, one sweep. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  look?: Vec2 | null
  track?: boolean
  antenna?: "single" | "twin" | "none"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function OrbDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  headAngle,
  bodyAngle,
  behavior = "roll",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  look = null,
  track = true,
  antenna = "twin",
  signal = "ready",
  showGround = true,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  ...props
}: OrbDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  // Both channels pinned means nothing reads the clock, so do not run one.
  const controlled = headAngle !== undefined && bodyAngle !== undefined
  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const scripted = orbDroidPose(behavior, clock)
  const headTurn = finiteClamp(headAngle ?? scripted.head, -65, 65)
  const bodyTurn = finite(bodyAngle ?? scripted.body)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((unit.y - 0.5) * 2, -1, 1),
    }), []),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const eye = { x: clamp(gaze.x, -1, 1) * 4, y: clamp(gaze.y, -1, 1) * 2.5 }
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const clipId = `orb-${React.useId().replace(/:/g, "")}`

  // A ball is the same circle from every angle, so the body needs no second
  // drawing; everything painted on it is elevation artwork and goes through
  // `wall`. The head is a dome, which only reads as one off the front.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const rise = (y: number) => GROUND - y
  const at = (x: number, y: number, deep = 0) =>
    camera.project(-x, rise(y), -deep)

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Orb droid, body rotation ${Math.round(bodyTurn)} degrees, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 190 190"
      width={width}
      height={width}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <defs><clipPath id={clipId}><circle cx={95} cy={111} r={53} /></clipPath></defs>
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 16 164 H 174 M 95 18 V 174" strokeDasharray="2 3" />
          <circle cx={95} cy={111} r={68} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={95} cy={166} rx={57} ry={7} fill={palette.dark} opacity={0.14} />}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND}) scale(${fit})`}>
        <circle cx={px(at(0, 111).x)} cy={px(at(0, 111).y)} r={BODY_RADIUS} {...shell} />
        <path
          d={extrudedPath(circleFootprint(0, 0, HEAD_RADIUS, 14), camera, HEAD_TOP, HEAD_FLOOR)}
          {...machined}
        />
        {antenna !== "none" && (
          <path d={capsulePath(at(22, 48), at(27, 24), 1.5)} fill={palette.dark} stroke="none" />
        )}
      </g>}
      <Frame {...frame}>
      <g data-body data-view={view} transform={`rotate(${px(bodyTurn)} 95 111)`}>
        <circle cx={95} cy={111} r={53} {...shell} />
        <g clipPath={`url(#${clipId})`} fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.75}>
          <path d="M 42 111 H 148 M 95 58 V 164" />
          <ellipse cx={95} cy={111} rx={22} ry={53} />
          <ellipse cx={95} cy={111} rx={53} ry={22} />
          <path d="M 57 74 L 133 148 M 133 74 L 57 148" />
        </g>
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 95 111) translate(95 72)`}>
            <rect x={-8} y={-5} width={16} height={10} rx={2.5} {...machined} />
            <circle r={2.6} fill={angle === 0 ? signalColor : palette.dark} />
          </g>
        ))}
      </g>

      <g data-head transform={`translate(${px(headTurn * 0.13)} 0) rotate(${px(headTurn * 0.16)} 95 67)`}>
        <path d="M 59 75 Q 60 43 95 38 Q 130 43 131 75 Q 95 88 59 75 Z" {...machined} />
        <path d="M 61 72 Q 95 82 129 72" fill="none" stroke={palette.dark} strokeWidth={2} />
        <rect x={75} y={51} width={40} height={19} rx={7} {...cast} />
        {/* One node over the whole optic, so a caller driving gaze from an
            animation loop writes one transform instead of six attributes. */}
        <g data-optic>
          <circle cx={px(95 + eye.x)} cy={px(60 + eye.y)} r={7.5} fill={palette.accent} />
          <circle data-eye cx={px(95 + eye.x)} cy={px(60 + eye.y)} r={3.5} fill={palette.dark} />
          <circle cx={px(97 + eye.x)} cy={px(58 + eye.y)} r={1.4} fill={palette.metal} />
        </g>
        <circle cx={68} cy={66} r={4} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
        {antenna !== "none" && (
          <g data-antenna={antenna} stroke={palette.dark} strokeLinecap="round">
            <path d="M 117 48 L 122 24" strokeWidth={1.8} />
            <circle cx={122} cy={22} r={2.6} fill={signalColor} strokeWidth={1} />
            {antenna === "twin" && <path d="M 108 43 L 106 30" strokeWidth={1.4} />}
          </g>
        )}
      </g>
      </Frame>
      {label && <text x={95} y={184} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

/**
 * What the shell and the head are doing at `clock`, in degrees. Rolling turns
 * the shell continuously while the head holds level but for the sway a real
 * gimbal would not quite take out; rocking is the same machine stationary; a
 * survey barely moves the shell and sweeps the optic across the room.
 */
export function orbDroidPose(behavior: OrbDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  const turn = Math.PI * 2 * t
  switch (behavior) {
    case "rock":
      return { body: Math.sin(turn) * 30, head: Math.sin(turn + 0.7) * -11 }
    case "survey":
      // Triangle rather than sine: a scan holds its rate across the sweep and
      // only slows at the two ends, which is what a search pattern looks like.
      return { body: Math.sin(turn * 0.5) * 7, head: (Math.abs(((t * 0.5) % 1) * 4 - 2) - 1) * 58 }
    case "static":
      return { body: 0, head: 0 }
    default:
      return { body: t * 360, head: Math.sin(turn) * 7 }
  }
}

const finite = (value: number) => Number.isFinite(value) ? value : 0
const finiteClamp = (value: number, min: number, max: number) => clamp(finite(value), min, max)

export { OrbDroid }
