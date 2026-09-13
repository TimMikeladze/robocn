"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp, toRadians } from "@/lib/robocn/kinematics"
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

export type ProtocolDroidPose = "formal" | "converse" | "cautious"
export type ProtocolDroidGesture = "none" | "explain" | "greet" | "point"
export type ProtocolDroidBehavior = "converse" | "idle" | "static"
/** The gestures a conversation cycles through, in order. */
const gestureOrder: ProtocolDroidGesture[] = ["none", "greet", "explain", "point"]

export interface ProtocolDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  pose?: ProtocolDroidPose
  /** Head turn in degrees. Omit and it turns to whoever it is talking to. */
  headAngle?: number
  /** Hands. Omit and `behavior` works through them. */
  gesture?: ProtocolDroidGesture
  /** What it does unattended: hold a conversation, or wait politely. */
  behavior?: ProtocolDroidBehavior
  /** Gestures per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The head turns to the pointer, and a click moves it on to its next gesture. */
  interactive?: boolean
  onGestureChange?: (gesture: ProtocolDroidGesture) => void
  exposed?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: how far the body, limbs and head reach through the picture. */
const CENTRE = 85
const GROUND = 199
const BODY_DEEP = 11
const LIMB_DEEP = 5.5

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const poses: Record<ProtocolDroidPose, { lean: number; leftLeg: number; rightLeg: number }> = {
  formal: { lean: 0, leftLeg: 0, rightLeg: 0 },
  converse: { lean: -3, leftLeg: -4, rightLeg: 5 },
  cautious: { lean: 6, leftLeg: 6, rightLeg: -7 },
}

const gestures: Record<ProtocolDroidGesture, { left: number; right: number; forearm: number }> = {
  none: { left: 4, right: -4, forearm: 0 },
  explain: { left: 26, right: -48, forearm: -58 },
  greet: { left: 8, right: -112, forearm: -42 },
  point: { left: 12, right: -72, forearm: 64 },
}

function ProtocolDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  pose = "formal",
  headAngle,
  gesture,
  behavior = "converse",
  speed = 0.35,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onGestureChange,
  exposed = false,
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
  onPointerDown,
  ...props
}: ProtocolDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  // A click takes the conversation on a step and holds it there.
  const [asked, setAsked] = React.useState<number | null>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = protocolDroidPose(behavior, clock)
  const shown = gesture ?? (asked === null ? scripted.gesture : gestureOrder[asked % gestureOrder.length])
  const turn = finiteClamp(
    headAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 48 : scripted.head),
    -55,
    55,
  )
  const stance = poses[pose] ?? poses.formal
  const arms = gestures[shown] ?? gestures.none
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. A humanoid drawn from
  // the front says nothing about its own depth: the torso, pelvis and head
  // become boxes, and the arms and legs tubes set through the body.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, GROUND)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the frame — x right, y up the drawing is negative — set
   *  `deep` units toward the reader. */
  const at = (x: number, y: number, deep = 0) => {
    const tilt = toRadians(stance.lean)
    const lx = x * Math.cos(tilt) - y * Math.sin(tilt)
    const ly = x * Math.sin(tilt) + y * Math.cos(tilt)
    return camera.project(-lx, -ly, -deep)
  }
  /** The joints of a limb: each segment turned by its own angle, in order. */
  const chain = (
    ox: number,
    oy: number,
    deep: number,
    segments: readonly { angle: number; length: number }[],
  ) => {
    let x = ox
    let y = oy
    const joints = [at(x, y, deep)]
    for (const segment of segments) {
      const a = toRadians(segment.angle)
      x -= Math.sin(a) * segment.length
      y += Math.cos(a) * segment.length
      joints.push(at(x, y, deep))
    }
    return joints
  }
  const solid = (halfWidth: number, deep: number, top: number, bottom: number, x = 0) =>
    extrudedPath(
      roundedFootprint(halfWidth, deep, Math.min(halfWidth, deep) * 0.4, 4).map(point => ({ x: point.x - x, y: point.y })),
      camera, -top, -bottom,
    )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Protocol droid, ${pose} pose, ${shown} gesture, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = (asked === null ? gestureOrder.indexOf(shown) : asked) + 1
        setAsked(next)
        onGestureChange?.(gestureOrder[next % gestureOrder.length])
      }}
      viewBox="0 0 170 230"
      width={width}
      height={px(width * 1.35)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 12 209 H 158 M 85 8 V 216" strokeDasharray="2 3" />
          <path d="M 24 24 H 146 V 207 H 24 Z" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={85} cy={207} rx={44} ry={5.5} fill={palette.dark} opacity={0.14} />}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {([["left", -15, stance.leftLeg, -LIMB_DEEP], ["right", 15, stance.rightLeg, LIMB_DEEP]] as const).map(([name, x, angle, deep]) => {
          const [hip, knee, ankle] = chain(x, -60, deep, [
            { angle, length: 43 },
            { angle, length: 45 },
          ])
          return (
            <g key={name} data-leg={name}>
              <path d={capsulePath(hip, knee, 7)} {...shell} />
              <path d={capsulePath(knee, ankle, 6)} {...machined} />
            </g>
          )
        })}
        {([["left", -27, arms.left, arms.left, -BODY_DEEP], ["right", 27, arms.right, arms.right + arms.forearm, BODY_DEEP]] as const).map(([name, x, upper, lower, deep]) => {
          const [shoulder, elbow, wrist] = chain(x, -103, deep, [
            { angle: upper, length: 39 },
            { angle: lower, length: 39 },
          ])
          return (
            <g key={name} data-arm={name}>
              <path d={capsulePath(shoulder, elbow, 6)} {...shell} />
              <path d={capsulePath(elbow, wrist, 5)} {...machined} />
            </g>
          )
        })}
        <path d={solid(25, BODY_DEEP, 110, 59)} {...shell} />
        <path d={solid(21, BODY_DEEP - 1, 66, 50)} {...cast} />
        <path d={solid(8, 7, 132, 108)} {...machined} />
        <path d={solid(20, 14, 166, 130, turn * 0.13)} {...shell} />
      </g>}
      <Frame {...frame}>
      <g data-frame data-view={view} transform={`translate(85 199) rotate(${stance.lean})`}>
        <g data-leg="left" transform={`translate(-15 -60) rotate(${stance.leftLeg})`}>
          <rect x={-7} y={0} width={14} height={43} rx={6} {...shell} />
          <circle data-joint="left-knee" cy={43} r={7.5} {...cast} />
          <rect x={-6} y={43} width={12} height={45} rx={5} {...machined} />
          <path d="M -8 86 H 13 Q 20 86 20 92 H -9 Z" {...shell} />
        </g>
        <g data-leg="right" transform={`translate(15 -60) rotate(${stance.rightLeg})`}>
          <rect x={-7} y={0} width={14} height={43} rx={6} {...shell} />
          <circle data-joint="right-knee" cy={43} r={7.5} {...cast} />
          <rect x={-6} y={43} width={12} height={45} rx={5} {...machined} />
          <path d="M -8 86 H 13 Q 20 86 20 92 H -9 Z" {...shell} />
        </g>

        <path d="M -25 -110 L -20 -59 Q 0 -49 20 -59 L 25 -110 Z" {...shell} />
        <ellipse cx={0} cy={-59} rx={21} ry={8} {...cast} />
        <g data-torso-panel>
          <path d="M -15 -99 H 15 V -70 Q 0 -62 -15 -70 Z" {...machined} />
          {exposed ? (
            <g data-wiring fill="none" strokeLinecap="round">
              <path d="M -10 -94 C -2 -86 -7 -78 0 -69" stroke={palette.accent} strokeWidth={2} />
              <path d="M 0 -96 C 7 -87 2 -79 9 -70" stroke={palette.dark} strokeWidth={2} />
              <path d="M 8 -94 C 1 -86 8 -79 3 -70" stroke={palette.metal} strokeWidth={1.8} />
            </g>
          ) : (
            <g stroke={palette.dark} strokeWidth={1.4}>
              <path d="M -10 -91 H 10 M -10 -84 H 10 M -10 -77 H 10" />
            </g>
          )}
        </g>
        <circle data-joint="waist" cy={-108} r={8} {...cast} />
        <rect x={-8} y={-124} width={16} height={16} rx={4} {...machined} />

        <g data-arm="left" transform={`translate(-27 -103) rotate(${arms.left})`}>
          <circle data-joint="left-shoulder" r={8} {...cast} />
          <rect x={-6} y={0} width={12} height={38} rx={5} {...shell} />
          <circle data-joint="left-elbow" cy={39} r={6.5} {...cast} />
          <rect x={-5} y={39} width={10} height={37} rx={4} {...machined} />
          <circle cy={78} r={5} {...cast} />
          <path d="M -5 82 Q 0 90 5 82 M 0 82 V 92" fill="none" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" />
        </g>
        <g data-arm="right" transform={`translate(27 -103) rotate(${arms.right})`}>
          <circle data-joint="right-shoulder" r={8} {...cast} />
          <rect x={-6} y={0} width={12} height={38} rx={5} {...shell} />
          <circle data-joint="right-elbow" cy={39} r={6.5} {...cast} />
          <g transform={`translate(0 39) rotate(${arms.forearm})`}>
            <rect x={-5} y={0} width={10} height={37} rx={4} {...machined} />
            <circle cy={39} r={5} {...cast} />
            <path d="M -5 43 Q 0 51 5 43 M 0 43 V 53" fill="none" stroke={palette.metal} strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>

        <g data-head transform={`translate(${px(turn * 0.13)} -148) rotate(${px(turn * 0.08)})`}>
          <rect x={-20} y={-18} width={40} height={34} rx={8} {...shell} />
          <path d="M -16 -9 H 16 V 7 H -16 Z" {...cast} />
          {[-8, 8].map((x) => (
            <g key={x}>
              <circle cx={x} cy={-2} r={5} fill={signalColor} />
              <circle cx={x + 1} cy={-3} r={1.4} fill={palette.metal} />
            </g>
          ))}
          <path d="M -7 10 H 7 M -4 14 H 4" stroke={palette.dark} strokeWidth={1.4} />
          <rect x={-13} y={16} width={26} height={6} rx={2} {...machined} />
        </g>
      </g>
      </Frame>
      {label && <text x={85} y={224} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { ProtocolDroid }

/**
 * One side of a conversation: a gesture at a time, each held long enough to
 * read, with the head turning to whoever is being addressed.
 */
export function protocolDroidPose(behavior: ProtocolDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  if (behavior === "static") return { gesture: "none" as ProtocolDroidGesture, head: 0 }
  if (behavior === "idle") {
    return { gesture: "none" as ProtocolDroidGesture, head: Math.sin(t * Math.PI * 0.5) * 10 }
  }
  const step = Math.floor(((t % gestureOrder.length) + gestureOrder.length) % gestureOrder.length)
  return { gesture: gestureOrder[step], head: Math.sin(t * Math.PI) * 26 }
}
