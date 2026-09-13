"use client"

/**
 * robot-snake — a serpentine crawler seen from above.
 *
 * One `solveSpine` wave runs the whole machine: even swing for serpentine
 * travel, half the body lifted for sidewinding, a constant curvature for the
 * coil. The hull is the spine offset either side, the plates are its joints,
 * and the head is carried by the first joint's angle. It turns its head toward
 * the pointer, and strikes when clicked.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine, spineOutline, type SpineJoint } from "@/lib/robocn/spine"
import {
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

/** Seconds a strike takes to throw and recover. */
const STRIKE = 0.75

export type SnakeBehavior = "serpentine" | "sidewind" | "coil" | "static"

/** The crawler is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotSnakeProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** What it does when `phase` is not supplied. */
  /** Where the camera stands. One crawler, four projections. */
  view?: RobotView
  behavior?: SnakeBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Wave cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a nest of them breaks step. */
  offset?: number
  /** Peak body swing, 0–1. Omit and the behavior sets it. */
  amplitude?: number
  /** Wave crests along the body, 0.25–3. */
  waves?: number
  /** Steady turn, −1..1. Omit and the head follows the pointer. */
  turn?: number
  /** Peak ground clearance on the lifted half of the wave, 0–1. */
  lift?: number
  /** Links in the body, 4–24. */
  segments?: number
  /** Watch the pointer, and strike when poked. */
  interactive?: boolean
  onStrike?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the segments carrying weight. */
  showContacts?: boolean
  label?: string
}

/** Body length in world units, and the half-width behind the head. */
const LENGTH = 168
const GIRTH = 8.5

function RobotSnake({
  behavior = "serpentine", phase, view = NATIVE_VIEW, speed = 0.6, animate = true, paused = false, offset = 0,
  amplitude, waves, turn, lift, segments = 16,
  interactive = true, onStrike,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotSnakeProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A strike throws the head out and pulls it back: the body flattens for the
  // lunge, then the wave returns.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const strike = since >= 0 && since < STRIKE ? Math.sin((since / STRIKE) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && turn === undefined && !paused,
    within: "element",
    persist: false,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((0.5 - unit.y) * 2.2, -1, 1),
    }), []),
  })

  const scripted = snakeBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const pose = solveSpine({
    segments,
    length: LENGTH,
    phase: cycle,
    // Flattening the wave is what makes the lunge read as a lunge.
    amplitude: clamp((amplitude ?? scripted.amplitude) * (1 - strike * 0.75), 0, 1),
    waves: waves ?? scripted.waves,
    taper: scripted.taper,
    turn: clamp((turn ?? pointer.target?.y ?? 0) * 0.4 + scripted.turn, -1, 1),
    lift: lift ?? scripted.lift,
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const head = pose.head
  const lifted = pose.joints.some((joint) => !joint.contact)
  // The tongue flicks on its own clock, the way a snake's does.
  const tongue = Math.max(0, Math.sin(clock * 3.1)) ** 6
  // Plan view is the identity projection. The spine solver already reports a
  // clearance for every joint, so sidewinding is genuinely off the ground
  // rather than shaded to look it: off-axis the body is a chain of tubes at
  // the heights the solver gives, and the lifted half of it is visibly clear.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  // The snake lies along the frame with its head at the right-hand end, so a
  // camera that mirrors the long axis would swing the body out of the frame.
  // Anchor the head at the other end in those views instead: the camera moves,
  // the machine does not.
  const anchor = px((view === "front" || view === "iso" ? 34 : 202) + strike * 12)
  const at = (joint: SpineJoint) =>
    camera.project(joint.position.x, joint.clearance + bodyWidth(joint.s) * 0.5, -joint.position.y)


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot snake, ${strike > 0.05 ? "striking" : behavior === "static" ? "still" : behavior}, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 240 200"
      width={width}
      height={px(width * 0.833)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onStrike?.()
      }}
      {...props}
    >
      {showGround && (
        <g stroke={palette.grid} strokeWidth={0.5} opacity={variant === "blueprint" ? 0.5 : 0.28} fill="none">
          {[40, 80, 120, 160].map((y) => (
            <path key={y} d={`M 16 ${y} H 224`} strokeDasharray="3 6" />
          ))}
        </g>
      )}

      {/* Plan view: the nose sits at the origin pointing along +x, y up. */}
      {offAxis && <g data-solids transform={`translate(${anchor} 104)`}>
        {pose.joints.slice(0, -1).map((joint, index) => (
          <path
            key={joint.s}
            data-segment={index}
            d={capsulePath(at(joint), at(pose.joints[index + 1]), px(bodyWidth(joint.s) * 0.5))}
            {...(joint.contact ? shell : machined)}
          />
        ))}
      </g>}
      <g data-snake data-view={view} transform={`translate(${anchor} 104) ${ground} scale(1 -1)`.replace(/\s+/g, " ")}>
        {/* Anything off the ground throws a shadow: that is what sidewinding looks like from above. */}
        {lifted && (
          <path
            data-shadow
            d={spineOutline(pose, (s) => bodyWidth(s) * 0.9)}
            fill={palette.dark}
            opacity={0.16}
            transform="translate(4 -4)"
          />
        )}
        <path data-spine d={spineOutline(pose, bodyWidth)} {...shell} />

        <g stroke={palette.dark} strokeWidth={0.75} fill="none" opacity={0.5}>
          {pose.joints.slice(1, -1).map((joint, index) => (
            <path key={index} data-plate={index} d={chevron(joint)} />
          ))}
        </g>
        <path
          data-dorsal
          d={pose.joints
            .map((joint, index) => `${index ? "L" : "M"} ${px(joint.position.x)} ${px(joint.position.y)}`)
            .join(" ")}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1}
          strokeDasharray="5 5"
          opacity={0.5}
        />
        {showContacts && (
          <g data-contacts>
            {pose.joints
              .filter((joint) => joint.contact && joint.s > 0.08)
              .map((joint) => (
                <circle
                  key={joint.s}
                  cx={px(joint.position.x)}
                  cy={px(joint.position.y)}
                  r={1.3}
                  fill={palette.accent}
                  opacity={0.55}
                />
              ))}
          </g>
        )}

        <g data-head transform={`translate(${px(head.position.x)} ${px(head.position.y)}) rotate(${px(head.angle)})`}>
          <path d="M 15 0 Q 12 6.5 4 9 L -12 8.5 L -12 -8.5 L 4 -9 Q 12 -6.5 15 0 Z" {...machined} />
          {/* Face plate across the snout, with the optics either side of it. */}
          <path d="M 13 0 Q 10 4.6 3 6 L -3 6 L -3 -6 L 3 -6 Q 10 -4.6 13 0 Z" {...cast} />
          <circle cx={0} cy={7} r={2.3} fill={palette.accent} />
          <circle cx={0} cy={-7} r={2.3} fill={palette.accent} />
          <circle cx={0.8} cy={7} r={1} fill={palette.dark} />
          <circle cx={0.8} cy={-7} r={1} fill={palette.dark} />
          {tongue > 0.02 && (
            <path
              data-tongue
              d={`M 13 0 L ${px(13 + 9 * tongue)} 0 m 0 0 l 4 2.6 m -4 -2.6 l 4 -2.6`}
              fill="none"
              stroke={palette.glow}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          )}
          <path d="M -12 6 L -12 -6" stroke={palette.dark} strokeWidth={1.2} />
        </g>
      </g>

      {label && (
        <text x={120} y={192} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5.5} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** Even down the body, then a taper into the tail tip. */
function bodyWidth(s: number) {
  return GIRTH * (1 - 0.82 * Math.pow(clamp(s, 0, 1), 2.1))
}

/** A plate chevron across one joint, pointing forward. */
function chevron(joint: SpineJoint) {
  const normal = ((joint.angle + 90) * Math.PI) / 180
  const along = (joint.angle * Math.PI) / 180
  const w = bodyWidth(joint.s) * 0.85
  const { x, y } = joint.position
  const nose = { x: x + Math.cos(along) * 2.6, y: y + Math.sin(along) * 2.6 }
  return [
    `M ${px(x + Math.cos(normal) * w)} ${px(y + Math.sin(normal) * w)}`,
    `L ${px(nose.x)} ${px(nose.y)}`,
    `L ${px(x - Math.cos(normal) * w)} ${px(y - Math.sin(normal) * w)}`,
  ].join(" ")
}

/** Three ways of getting about, and one of doing nothing. */
export function snakeBehaviorPose(behavior: SnakeBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Alternate sections lifted clear, which is how a sidewinder crosses sand.
    case "sidewind":
      return { amplitude: 0.95, waves: 1.15, taper: 0, turn: 0, lift: 1 }
    // Curled and breathing, the resting pose.
    case "coil":
      return { amplitude: 0.1, waves: 0.5, taper: -0.3, turn: 0.92 + 0.05 * Math.sin(time * 0.8), lift: 0 }
    case "static":
      return { amplitude: 0.7, waves: 1.5, taper: 0, turn: 0, lift: 0 }
    default:
      return { amplitude: 0.78, waves: 1.5, taper: -0.15, turn: 0, lift: 0 }
  }
}

export { RobotSnake }
