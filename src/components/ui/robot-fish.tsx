"use client"

/**
 * robot-fish — a swimming machine in profile.
 *
 * The body is the solver's output, not artwork: `solveSpine` bends a serpenoid
 * wave with the swing piled at the tail, and the hull is that spine offset to
 * either side. Left alone it cruises, darts or holds station on fins; hand it
 * `phase` and your timeline drives the beat instead. It turns toward the
 * pointer, and a click sends it off in a burst that decays back to a cruise.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine, spineOutline, type SpineJoint, type SpinePose } from "@/lib/robocn/spine"
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

/** Seconds a poked dart takes to decay back into the cruise. */
const DART = 1.1

export type FishBehavior = "cruise" | "dart" | "hover" | "static"

/** The fish is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Where it swims in the frame. */
const CENTRE = 212
const DATUM = 78

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotFishProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** What it does when `phase` is not supplied. */
  /** Where the camera stands. One fish, four projections. */
  view?: RobotView
  behavior?: FishBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Tail beats per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a shoal of them breaks step. */
  offset?: number
  /** Peak body swing, 0–1. Omit and the behavior sets it. */
  amplitude?: number
  /** Wave crests along the body, 0.25–3. */
  waves?: number
  /** Steady turn, −1 nose down to 1 nose up. Omit and it follows the pointer. */
  turn?: number
  /** Links in the body, 4–24. */
  segments?: number
  /** Pectoral fin angle in degrees, −45..45. Omit and the behavior works them. */
  fins?: number
  /** Turn toward the pointer, and dart when clicked. */
  interactive?: boolean
  onDart?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The seabed line and its scatter. */
  showGround?: boolean
  label?: string
}

/** Body length in world units, and the half-width the hull is built from. */
const LENGTH = 150
const GIRTH = 25

function RobotFish({
  behavior = "cruise", phase, view = NATIVE_VIEW, speed = 1.1, animate = true, paused = false, offset = 0,
  amplitude, waves, turn, segments = 16, fins,
  interactive = true, onDart,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotFishProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A poke is one burst: the tail loads up, the fish surges, and both decay
  // back into whatever it was doing.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const burst = since >= 0 && since < DART ? Math.exp(-since * 3.4) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && turn === undefined && !paused,
    within: "element",
    persist: false,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      // Above the fish pulls its nose up, below sends it down.
      y: clamp((0.5 - unit.y) * 2.4, -1, 1),
    }), []),
  })

  const scripted = fishBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * scripted.rate + burst * 0.5
  const pose = solveSpine({
    segments,
    length: LENGTH,
    phase: cycle,
    amplitude: clamp((amplitude ?? scripted.amplitude) + burst * 0.4, 0, 1),
    waves: waves ?? scripted.waves,
    // The beat belongs to the tail: that is what a body wave looks like on a fish.
    taper: 0.82,
    turn: clamp((turn ?? pointer.target?.y ?? scripted.turn) * 0.55, -1, 1),
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const at = (s: number) => pose.joints[Math.round(clamp(s, 0, 1) * (pose.joints.length - 1))]
  const hull = spineOutline(pose, halfWidth)
  const head = pose.head
  const tail = pose.tail
  const pectoral = finiteClamp(fins ?? scripted.fin, -45, 45, 0)
  const state = behavior === "static" ? "holding station" : burst > 0.05 ? "darting" : behavior
  // The drawing is a side elevation, so it goes through `wall` where it swims
  // and comes out untouched from the side. A hull is round in section, which
  // the one elevation could only imply: off-axis the body is a chain of tubes
  // down the solved spine, each as thick as the hull is there.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(0, 90), CENTRE, DATUM)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A solver point — x along the nose axis, y up — `across` units out. */
  const along = (p: { x: number; y: number }, across = 0) =>
    camera.project(across, p.y, -p.x)


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot fish, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 260 160"
      width={width}
      height={px(width * 0.615)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onDart?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 80 H 248 M 130 14 V 146" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <g stroke={palette.grid} opacity={0.45}>
          <path d="M 14 150 H 246" strokeWidth={0.6} strokeDasharray="6 5" fill="none" />
          {[36, 92, 158, 214].map((x, index) => (
            <circle key={x} cx={x} cy={px(146 - index * 1.5)} r={1.4} fill={palette.grid} stroke="none" />
          ))}
        </g>
      )}

      {/* Solver coordinates: nose at the origin pointing along +x, y up. */}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${DATUM})`}>
        {pose.joints.slice(0, -1).map((joint, index) => (
          <path
            key={joint.s}
            data-segment={index}
            d={capsulePath(along(joint.position), along(pose.joints[index + 1].position), px(Math.max(halfWidth(joint.s), 1)))}
            {...shell}
          />
        ))}
        <path d={capsulePath(along(head.position), along(pose.joints[1].position), px(Math.max(halfWidth(0.08), 2)))} {...cast} />
      </g>}
      <Frame {...frame}>
      <g data-fish data-view={view} transform="translate(212 78) scale(1 -1)">
        <g data-tail transform={`translate(${px(tail.position.x)} ${px(tail.position.y)}) rotate(${px(tail.angle)})`}>
          <path d="M 0 0 L -26 19 L -16 0 L -26 -19 Z" {...machined} />
          <path d="M -3 0 L -22 14 M -3 0 L -22 -14" fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.7} />
        </g>

        <path data-fin="dorsal" d={finPath(pose, 0.24, 0.5, 1, 13)} {...machined} />
        <path data-fin="anal" d={finPath(pose, 0.52, 0.7, -1, 8)} {...machined} />

        <path data-spine d={hull} {...shell} />

        {/* Plate seams: one per solved joint, so the hull reads as segments. */}
        <g stroke={palette.dark} strokeWidth={0.7} opacity={0.45} fill="none">
          {pose.joints.slice(2, -1).map((joint, index) => (
            <path key={index} d={seam(joint, 0.82)} />
          ))}
        </g>
        <path
          data-lateral
          d={pose.joints
            .map((joint, index) => `${index ? "L" : "M"} ${px(joint.position.x)} ${px(joint.position.y)}`)
            .join(" ")}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.8}
        />

        <g data-fin="pectoral" transform={`translate(${px(at(0.22).position.x)} ${px(at(0.22).position.y - 4)}) rotate(${px(at(0.22).angle + pectoral)})`}>
          <path d="M 0 0 Q -11 -5 -19 -13 Q -9 -10 0 -4 Z" {...cast} />
        </g>

        <g data-head transform={`translate(${px(head.position.x)} ${px(head.position.y)}) rotate(${px(head.angle)})`}>
          <path d={`M 0 0 Q -10 ${px(halfWidth(0.06))} -22 ${px(halfWidth(0.15))} L -22 ${px(-halfWidth(0.15))} Q -10 ${px(-halfWidth(0.06))} 0 0 Z`} {...cast} />
          <circle cx={-14} cy={7} r={4.6} {...machined} />
          <circle cx={-14} cy={7} r={2.6} fill={palette.accent} />
          <circle cx={-13} cy={7.9} r={1} fill={palette.dark} />
          <path d="M -26 11 Q -31 0 -26 -11" fill="none" stroke={palette.metal} strokeWidth={1.4} />
          <circle cx={-4} cy={-1} r={1.6} fill={palette.glow} opacity={0.9} />
        </g>

        {burst > 0.05 && (
          <g data-wake opacity={px(burst * 0.5)}>
            {[0, 1, 2].map((index) => (
              <circle
                key={index}
                cx={px(tail.position.x - 12 - index * 11)}
                cy={px(tail.position.y + (index % 2 ? 5 : -5))}
                r={px(2.6 - index * 0.6)}
                fill="none"
                stroke={palette.glow}
                strokeWidth={1}
              />
            ))}
          </g>
        )}
      </g>
      </Frame>

      {label && (
        <text x={130} y={156} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5.5} fill={palette.foreground}>
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
 * The hull's half-width: a snout that opens quickly into the deepest section a
 * third of the way back, then a long taper to the peduncle the tail hangs off.
 */
function halfWidth(s: number) {
  const t = clamp(s, 0, 1)
  // Opens fast behind the snout, deepest at the shoulder, then a long run out
  // to the narrow peduncle the tail hangs off.
  const nose = Math.min(1, Math.pow(t / 0.12, 0.55))
  return GIRTH * nose * (0.1 + 0.9 * Math.pow(1 - t, 1.6))
}

/** A seam across the body at one joint, inset from the hull edge. */
function seam(joint: SpineJoint, inset: number) {
  const normal = ((joint.angle + 90) * Math.PI) / 180
  const w = halfWidth(joint.s) * inset
  const dx = Math.cos(normal) * w
  const dy = Math.sin(normal) * w
  const { x, y } = joint.position
  return `M ${px(x + dx)} ${px(y + dy)} L ${px(x - dx)} ${px(y - dy)}`
}

/**
 * A fin riding the hull edge between two stations: a swept triangle whose base
 * sits on the solved outline and whose tip rakes back toward the tail.
 */
function finPath(pose: SpinePose, from: number, to: number, side: 1 | -1, height: number) {
  const last = pose.joints.length - 1
  const pick = (s: number) => pose.joints[Math.round(clamp(s, 0, 1) * last)]
  const edge = (joint: SpineJoint, out = 0) => {
    const normal = ((joint.angle + 90) * Math.PI) / 180
    const w = (halfWidth(joint.s) + out) * side
    return {
      x: joint.position.x + Math.cos(normal) * w,
      y: joint.position.y + Math.sin(normal) * w,
    }
  }
  const root = pick(from)
  const a = edge(root, -1)
  const b = edge(pick(to), -1)
  // The tip stands off the leading half of the base and rakes toward the tail.
  const tip = edge(pick(from + (to - from) * 0.35), height)
  const along = (root.angle * Math.PI) / 180
  const rake = (to - from) * 46
  const apex = { x: tip.x - Math.cos(along) * rake, y: tip.y - Math.sin(along) * rake }
  return [
    `M ${px(a.x)} ${px(a.y)}`,
    `Q ${px(apex.x)} ${px(apex.y)} ${px(b.x)} ${px(b.y)}`,
    "Z",
  ].join(" ")
}

/** What the fish does with no timeline on it: beat, burst, or hold on fins. */
export function fishBehaviorPose(behavior: FishBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Burst and glide: a hard beat, then the body goes slack and coasts.
    case "dart": {
      const surge = Math.pow(Math.max(0, Math.sin(time * 0.85)), 3)
      return { amplitude: 0.12 + 0.72 * surge, waves: 1.25, rate: 0.6 + surge * 1.9, turn: 0, fin: -12 + surge * 20 }
    }
    // Holding station is fin work, with the body barely moving.
    case "hover":
      return { amplitude: 0.14, waves: 0.7, rate: 0.55, turn: 0, fin: 26 * Math.sin(time * 2.2) }
    case "static":
      return { amplitude: 0.45, waves: 1.2, rate: 1, turn: 0, fin: 0 }
    default:
      return { amplitude: 0.5, waves: 1.2, rate: 1, turn: 0, fin: 8 * Math.sin(time * 0.9) }
  }
}

export { RobotFish }
