"use client"

/**
 * robot-seahorse — an upright swimmer in side elevation.
 *
 * One `solveSpine` chain does two jobs the fish never asked of it: it stands
 * the body on end, and its `turn` *is* the prehensile grip — winding the tail
 * round a holdfast is the same control as steering, taken to the stop. The
 * hull is the solver's own joints offset along their normals, and the bony
 * rings are drawn on the joints, so the plating cannot drift out of step with
 * the bend. The dorsal fin flutters an order faster than the body moves, which
 * is the whole of a seahorse's propulsion. Click and it lets go.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine, type SpineJoint } from "@/lib/robocn/spine"
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

export type SeahorseBehavior = "hold" | "hover" | "drift" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Where the base of the head sits in the frame. */
const CENTRE = 84
const CROWN = 56
/** Half the body's thickness across, for the off-axis tubes. */
const HALF_SPAN = 7

const fits: Record<RobotView, number> = { plan: 0.66, front: 0.92, profile: 1, iso: 0.94 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotSeahorseProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One swimmer, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: SeahorseBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Body cycles per second. The dorsal fin runs far faster. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair break step. */
  offset?: number
  /** Tail grip, 0 straight to 1 wound round the holdfast. Omit and the behavior sets it. */
  grip?: number
  /** Body sway, 0–1. Omit and the behavior sets it. */
  sway?: number
  /** Head tilt in degrees, −35..35. Omit and it follows the pointer. */
  headAngle?: number
  /** Links in the body, 3–24. */
  segments?: number
  /** The head tilts to the pointer, and a click grips or lets go. */
  interactive?: boolean
  onGripChange?: (gripped: boolean) => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The holdfast it winds its tail around. */
  showGround?: boolean
  label?: string
}

/** Body contour length, nose of the spine to tail tip. */
const BODY = 138

/** Half the body's depth at station `s`: a deep chest running out to the tail. */
const halfWidth = (s: number) => {
  const t = clamp(s, 0, 1)
  return 1.6 + 12.5 * Math.pow(1 - t, 1.15) * Math.min(1, 0.4 + t / 0.1)
}

function RobotSeahorse({
  behavior = "hold", phase, view = NATIVE_VIEW, speed = 0.5, animate = true, paused = false, offset = 0,
  grip, sway, headAngle, segments = 14,
  interactive = true, onGripChange,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotSeahorseProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [released, setReleased] = React.useState(false)

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((0.5 - unit.y) * 2.2, -1, 1),
    }), []),
  })

  const scripted = seahorseBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * scripted.rate
  const beat = Number.isFinite(cycle) ? cycle : 0
  const hold = finiteClamp(grip ?? (released ? 0.08 : scripted.grip), 0, 1, scripted.grip)
  const wobble = finiteClamp(sway ?? scripted.sway, 0, 1, scripted.sway)
  const look = finiteClamp(headAngle ?? (pointer.target ? pointer.target.y * 28 : scripted.head), -35, 35, 0)
  // The fin beats on its own clock: three cycles for every one of the body's.
  const flutter = Math.sin(2 * Math.PI * beat * 6)

  const pose = solveSpine({
    segments,
    length: BODY,
    phase: beat,
    amplitude: wobble * 0.35,
    waves: 0.55,
    // The swing belongs to the middle of the body; head and tail hold still.
    taper: 0.3,
    // The grip is the steer, taken to the stop: a full coil is a full turn.
    turn: clamp(-0.16 - hold * 0.82, -1, 1),
  })

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /**
   * The solver runs its body along −x; the seahorse stands on end, so a joint
   * at `p` lands `−p.x` below the head and `p.y` across it.
   */
  const place = (p: Vec2) => ({ x: p.y, y: -p.x })
  /** The body's normal at a joint, in drawing space, after that quarter turn. */
  const normal = (joint: SpineJoint) => ({
    x: Math.cos(toRadians(joint.angle)),
    y: Math.sin(toRadians(joint.angle)),
  })
  const edge = (joint: SpineJoint, side: 1 | -1, out = 0) => {
    const n = normal(joint)
    const w = (halfWidth(joint.s) + out) * side
    const p = place(joint.position)
    return { x: p.x + n.x * w, y: p.y + n.y * w }
  }

  const hull = (() => {
    const front = pose.joints.map((joint, index) => {
      const p = edge(joint, 1)
      return `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`
    })
    const back = pose.joints
      .slice()
      .reverse()
      .map((joint) => {
        const p = edge(joint, -1)
        return `L ${px(p.x)} ${px(p.y)}`
      })
    return [...front, ...back, "Z"].join(" ")
  })()

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, CROWN, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A drawing offset from the crown — x forward, y down — `across` units out. */
  const at = (p: Vec2, across = 0) => camera.project(across, -p.y, -p.x)

  const state = behavior === "static" ? "still" : hold > 0.5 ? "holding on" : behavior === "drift" ? "drifting" : "hovering"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot seahorse, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 190 240"
      width={width}
      height={px(width * 240 / 190)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const next = !released
        setReleased(next)
        onGripChange?.(!next)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 120 H 178 M 84 12 V 226" strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <g data-holdfast>
          <path d="M 132 232 Q 124 150 130 40" fill="none" stroke={palette.grid} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
          <path d="M 132 232 Q 124 150 130 40" fill="none" stroke={palette.dark} strokeWidth={1} strokeDasharray="3 7" opacity={0.35} />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${CROWN}) scale(${fit})`}>
        {pose.joints.slice(0, -1).map((joint, index) => (
          <path
            key={index}
            data-segment={index}
            d={capsulePath(
              at(place(joint.position)),
              at(place(pose.joints[index + 1].position)),
              px(Math.max(1.2, halfWidth(joint.s) * 0.72)),
            )}
            {...(index % 2 === 0 ? shell : machined)}
          />
        ))}
        {/* The dorsal fin is a plate standing in the sagittal plane. */}
        {[-HALF_SPAN * 0.3, HALF_SPAN * 0.3].map((across) => (
          <path
            key={across}
            d={capsulePath(at(edge(pose.joints[Math.round(pose.joints.length * 0.34)], -1), across), at(edge(pose.joints[Math.round(pose.joints.length * 0.34)], -1, 16), across), 1.6)}
            {...cast}
          />
        ))}
        <path d={capsulePath(at({ x: 0, y: -6 }, 0), at({ x: 22, y: -14 }, 0), 4)} {...cast} />
      </g>}

      <Frame {...frame}>
        <g data-seahorse data-view={view} transform={`translate(${CENTRE} ${CROWN})`}>
          {/* Dorsal fin: a rib fan on the back edge, running at its own rate. */}
          <g data-dorsal>
            {[0.3, 0.38, 0.46, 0.54].map((s, index) => {
              const joint = pose.joints[Math.round(s * (pose.joints.length - 1))]
              const root = edge(joint, -1)
              const n = normal(joint)
              const height = 15 - index * 1.4
              const wave = flutter * (3 + index * 0.6) * (index % 2 === 0 ? 1 : -1)
              return (
                <path
                  key={s}
                  data-rib={index}
                  d={`M ${px(root.x)} ${px(root.y)} L ${px(root.x - n.x * height + wave * 0.4)} ${px(root.y - n.y * height + wave)}`}
                  stroke={palette.metal}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.85}
                />
              )
            })}
            <path
              d={pose.joints
                .filter((joint) => joint.s >= 0.28 && joint.s <= 0.58)
                .map((joint, index) => {
                  const n = normal(joint)
                  const root = edge(joint, -1, 13 + flutter * 2.5 * (index % 2 === 0 ? 1 : -1))
                  return `${index ? "L" : "M"} ${px(root.x - n.x * 0)} ${px(root.y - n.y * 0)}`
                })
                .join(" ")}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.2}
              opacity={0.7}
            />
          </g>

          <path data-spine d={hull} {...shell} />

          {/* Bony rings: one per solved joint, so the plating bends with it. */}
          <g stroke={palette.dark} strokeWidth={0.8} opacity={0.45} fill="none">
            {pose.joints.slice(1, -1).map((joint, index) => {
              const a = edge(joint, 1, -0.8)
              const b = edge(joint, -1, -0.8)
              return <path key={index} data-ring={index} d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`} />
            })}
          </g>

          <g data-pectoral>
            {(() => {
              const joint = pose.joints[Math.round(0.1 * (pose.joints.length - 1))]
              const root = edge(joint, 1)
              return (
                <path
                  d={`M ${px(root.x)} ${px(root.y)} q ${px(9 + flutter * 2)} 3 ${px(12)} 10 q ${px(-8)} -2 ${px(-12)} -4 Z`}
                  {...machined}
                />
              )
            })()}
          </g>

          {/* Tail tip: the hook that actually takes the load. */}
          <g data-tail>
            <circle
              cx={px(place(pose.tail.position).x)}
              cy={px(place(pose.tail.position).y)}
              r={2.4}
              fill={palette.accent}
              opacity={0.9}
            />
          </g>

          <g data-head transform={`rotate(${px(look * 0.6)})`}>
            <path d="M -9 -4 Q -11 -18 0 -22 Q 12 -19 12 -6 Q 6 2 -4 2 Z" {...machined} />
            {/* Snout: the pipette it feeds with. */}
            <path data-snout d="M 10 -14 L 30 -9 L 30 -3 L 10 -6 Z" {...cast} />
            <circle cx={29} cy={-6} r={1.6} fill={palette.glow} opacity={0.9} />
            <circle data-eye cx={2} cy={-11} r={3.6} {...cast} />
            <circle cx={2.8} cy={-11.4} r={1.9} fill={palette.accent} />
            {/* Coronet: the crown every seahorse carries its own pattern on. */}
            <g data-crown>
              <path d="M -6 -20 l -1 -9 l 5 5 l 2 -8 l 3 8 l 4 -5 l -1 8 Z" {...shell} />
            </g>
            <path d="M -8 -2 Q -2 1 4 -2" fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.5} />
          </g>
        </g>
      </Frame>

      {label && (
        <text x={95} y={234} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: hold on, hang, or ride the current. */
export function seahorseBehaviorPose(behavior: SeahorseBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Off the holdfast, station-keeping on the dorsal fin alone.
    case "hover":
      return { grip: 0.16, sway: 0.28, rate: 1, head: 12 * Math.sin(time * 0.5) }
    // Loose in the water, going where it is put.
    case "drift":
      return { grip: 0.05, sway: 0.62, rate: 0.6, head: 20 * Math.sin(time * 0.28) }
    case "static":
      return { grip: 0.7, sway: 0.15, rate: 0, head: 0 }
    default:
      return {
        grip: lerp(0.82, 0.95, (Math.sin(time * 0.4) + 1) / 2),
        sway: 0.14,
        rate: 1,
        head: 16 * Math.sin(time * 0.35),
      }
  }
}

export { RobotSeahorse }
