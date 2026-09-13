"use client"

/**
 * micro-duck — a desk-scale bipedal duck robot.
 *
 * A servo-stack neck over two solved legs, one camera eye, and a hinged beak.
 * Left alone it walks, idles or pecks on its own clock; hand it `phase` and it
 * goes back to being driven by your timeline. It watches the pointer, and it
 * quacks when you poke it — a beak snap and a head bob that decay out, which
 * is the cheapest way to make a drawing feel answerable.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveDuck, type DuckGait, type DuckLeg, type DuckOptions } from "@/lib/robocn/duck"
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

/** Seconds the beak stays open for a quack. */
const QUACK = 0.42

export type DuckBehavior = "walk" | "idle" | "peck" | "static"

/** The duck is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the track. The elevation slid the far leg sideways to fake it; the
 *  legs are really either side of the pelvis. */
const HALF_TRACK = 9
/** Where the duck stands in the frame. */
const CENTRE = 56
const GROUND = 178

/** How far the camera pulls back so the machine still fits a frame that was
 *  drawn for one view. One in the view it was drawn in. */
const fits: Record<RobotView, number> = { plan: 0.88, front: 1, profile: 1, iso: 0.96 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface MicroDuckProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps,
    Omit<DuckOptions, "gait"> {
  /** Footfall pattern. Omit and `behavior` picks one. */
  /** Where the camera stands. One duck, four projections. */
  view?: RobotView
  gait?: DuckGait
  /** What the duck does when `phase` is not supplied. */
  behavior?: DuckBehavior
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a row of ducks breaks step. */
  offset?: number
  /** Watch the pointer, and quack when poked. */
  interactive?: boolean
  onQuack?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  /** The wire loom down the neck. */
  showCable?: boolean
  label?: string
}

function MicroDuck({
  gait, phase, view = NATIVE_VIEW, height = 0.55, stride = 0.6, lift = 0.5, gaze, beak,
  behavior = "idle", speed = 0.7, animate = true, paused = false, offset = 0,
  interactive = true, onQuack,
  size = "md", variant = "solid", showGround = true, showContacts = false, showCable = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: MicroDuckProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A poke is one clean gape with the body ringing down behind it: the beak
  // opens and shuts once, the head keeps bobbing for about a second.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  // Open on the frame of the poke, then close: a snap, not a swell.
  const gape = since >= 0 && since < QUACK ? Math.cos((since / QUACK) * (Math.PI / 2)) : 0
  const ring = since >= 0 && since < 1 ? Math.exp(-since * 4.5) * Math.cos(since * 22) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && gaze === undefined && !paused,
    within: "window",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      // Above the drawing cranes the neck up, below it sends the head down.
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((0.5 - unit.y) * 2.2, -1, 1),
    }), []),
  })

  const scripted = duckBehaviorPose(behavior, clock)
  const resolvedGait = gait ?? (behavior === "walk" ? "walk" : "stand")
  const cycle = controlled ? phase : clock * speed
  const resolvedGaze = clamp(
    (gaze ?? pointer.target?.y ?? scripted.gaze) + ring * 0.18,
    -1,
    1,
  )
  const resolvedBeak = clamp((beak ?? scripted.beak) + gape * 0.95, 0, 1)
  const pose = solveDuck({
    gait: resolvedGait,
    phase: cycle,
    height: clamp(height + scripted.bob + ring * 0.02, 0, 1),
    stride,
    lift,
    gaze: resolvedGaze,
    beak: resolvedBeak,
  })
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const head = pose.head

  // Both legs live in the same sagittal plane, so the far one is nudged back
  // and washed out to read as depth rather than as a doubled drawing.
  function legDrawing(leg: DuckLeg, far: boolean) {
    return (
      <g key={leg.id} data-leg={leg.id} transform={far ? "translate(-9 0)" : undefined} opacity={far ? 0.45 : 1}>
        <path d={capsulePath(leg.hip, leg.knee, 5)} {...shell} />
        <path d={capsulePath(leg.knee, leg.ankle, 3.6)} {...cast} />
        {[leg.hip, leg.knee, leg.ankle].map((joint, i) => (
          <g key={i}>
            <circle cx={px(joint.x)} cy={px(joint.y)} r={i === 0 ? 5.6 : 4.2} {...cast} />
            <circle cx={px(joint.x)} cy={px(joint.y)} r={1.7} fill={palette.metal} />
          </g>
        ))}
        {/* Shoe: a flat plate that stays level whatever the ankle does. */}
        <g transform={`translate(${px(leg.ankle.x)} ${px(leg.ankle.y)})`}>
          <path d="M -9 -9 h 24 q 7 0 7 4 v 2 q 0 3 -4 3 h -27 z" {...shell} />
          <rect x={-9} y={-9} width={31} height={2.8} rx={1.3} fill={palette.accent} stroke={palette.dark} strokeWidth={variant === "solid" ? 0.6 : 0.9} fillOpacity={variant === "outline" || variant === "wire" ? 0 : 1} />
        </g>
        {showContacts && leg.contact && (
          <ellipse data-contact cx={px(leg.ankle.x + 6)} cy={1.2} rx={16} ry={1.6} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }
  // The drawing is a side elevation, so it goes through `wall` where it stands
  // and comes out untouched from the side. The far leg was slid sideways to
  // fake its depth; off-axis both legs are tubes at half a track out, and the
  // body, neck and head are solids.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the duck's own frame — x forward, y up — `across` units out. */
  const at = (p: { x: number; y: number }, across = 0) =>
    camera.project(across, p.y, -p.x)
  const legSolid = (leg: DuckLeg, across: number) => (
    <g key={leg.id} data-leg={leg.id}>
      <path d={capsulePath(at(leg.hip, across), at(leg.knee, across), 5)} {...shell} />
      <path d={capsulePath(at(leg.knee, across), at(leg.ankle, across), 3.6)} {...cast} />
      <path
        d={extrudedPath(
          roundedFootprint(6, 15, 3, 4).map(point => ({ x: point.x + across, y: point.y - leg.ankle.x - 6 })),
          camera, leg.ankle.y + 1.5, leg.ankle.y - 8,
        )}
        {...shell}
      />
    </g>
  )
  const nearAcross = camera.depth(HALF_TRACK, 0, 0) > camera.depth(-HALF_TRACK, 0, 0) ? HALF_TRACK : -HALF_TRACK


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Duck robot, ${resolvedGait} pose, ${viewNames[view] ?? viewNames.profile}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onQuack?.()
      }}
      viewBox="0 0 160 200"
      width={width}
      height={px(width * 1.25)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer touch-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {showGround && (
        <g stroke={palette.grid} strokeWidth={0.6} opacity={0.5} fill="none">
          <path d="M 14 178 H 148" />
          {variant === "blueprint" && [26, 46, 66, 86, 106, 126].map(x => <path key={x} d={`M ${x} 178 l 10 8`} strokeDasharray="1 2" />)}
        </g>
      )}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND}) scale(${fit})`}>
        {legSolid(pose.legs[1], -nearAcross)}
        <path
          d={extrudedPath(
            roundedFootprint(11, 20, 8, 5).map(point => ({ x: point.x, y: point.y - pose.pelvis.x - 3 })),
            camera, pose.pelvis.y + 32, pose.pelvis.y + 1,
          )}
          {...shell}
        />
        {pose.neck.slice(1).map((joint, index) => (
          <path key={index} d={capsulePath(at(pose.neck[index]), at(joint), 4.4)} {...cast} />
        ))}
        <path
          d={extrudedPath(
            roundedFootprint(9, 20, 8, 5).map(point => ({ x: point.x, y: point.y - head.pivot.x - 7 })),
            camera, head.pivot.y + 15, head.pivot.y - 6,
          )}
          {...shell}
        />
        {legSolid(pose.legs[0], nearAcross)}
      </g>}
      <Frame {...frame}>
      <g data-view={view} transform="translate(56 178) scale(1 -1)">
        {legDrawing(pose.legs[1], true)}

        {/* Body, carried by the pelvis and pitched by the lean. */}
        <g transform={`translate(${px(pose.pelvis.x)} ${px(pose.pelvis.y)}) rotate(${px(-pose.lean)})`}>
          <path d="M -22 8 l -13 4 v 9 l 13 4 z" {...machined} />
          <rect x={-23} y={1} width={40} height={31} rx={13} {...shell} />
          <rect x={-14} y={7} width={22} height={18} rx={6} {...cast} />
          {[-9, -3, 3].map(x => <line key={x} x1={x} y1={10} x2={x} y2={22} stroke={palette.metal} strokeWidth={1} opacity={0.8} />)}
          <rect x={5} y={20} width={13} height={9} rx={3.5} {...machined} />
          <circle cx={12} cy={5} r={2} fill={palette.accent} />
        </g>

        {/* Neck: a servo stack, wire loom trailing down its back. */}
        {showCable && (
          <path
            d={`M ${px(pose.neck[0].x - 4)} ${px(pose.neck[0].y - 4)} Q ${px(pose.neck[1].x - 9)} ${px(pose.neck[1].y)} ${px(pose.neck[2].x - 7)} ${px(pose.neck[2].y + 2)} T ${px(head.pivot.x - 5)} ${px(head.pivot.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.75}
          />
        )}
        {pose.neck.slice(1).map((joint, i) => (
          <path key={i} data-neck={i} d={capsulePath(pose.neck[i], joint, 4.4)} {...cast} />
        ))}
        {pose.neck.map((joint, i) => (
          <circle key={i} cx={px(joint.x)} cy={px(joint.y)} r={3.2} fill={palette.metal} opacity={0.9} />
        ))}

        {legDrawing(pose.legs[0], false)}

        <g data-head transform={`translate(${px(head.pivot.x)} ${px(head.pivot.y)}) rotate(${px(head.angle)})`}>
          <rect x={-15} y={-7} width={14} height={18} rx={4} {...cast} />
          <rect x={-13} y={-5} width={41} height={24} rx={10} {...shell} />
          {/* Upper mandible: fixed to the skull, the way a bird's is. */}
          <path d="M -2 -4 h 30 q 6 0 6 2.6 l -1 1.6 q -1 1.4 -6 1.4 h -29 z" {...machined} />
          <g data-beak transform={`rotate(${px(-head.beak)})`}>
            <path d="M 0 -6.4 h 27 q 6 0 6 2.4 l -1.4 1.6 q -1.2 1.2 -5.6 1.2 h -26 z" fill={palette.accent} stroke={palette.dark} strokeWidth={variant === "solid" ? 0.6 : 0.9} fillOpacity={variant === "outline" || variant === "wire" ? 0 : 1} />
          </g>
          <g data-eye>
            <circle cx={12} cy={7.5} r={8} fill={palette.accent} stroke={palette.dark} strokeWidth={0.6} />
            <circle cx={12} cy={7.5} r={4.6} fill={palette.dark} />
            <circle cx={13.8} cy={9.2} r={1.6} fill={palette.metal} opacity={0.9} />
          </g>
          <circle cx={23} cy={12} r={1.8} {...machined} />
          <line x1={-8} y1={14} x2={2} y2={14} stroke={palette.metal} strokeWidth={1} opacity={0.7} />
        </g>
      </g>
      </Frame>
      {label && (
        <text x={80} y={193} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/**
 * What the duck gets up to when nothing is driving it. Walking barely moves
 * its head; idling it looks around and gapes now and then; pecking is a dive
 * to the floor with the beak open at the bottom of it.
 */
export function duckBehaviorPose(behavior: DuckBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "walk":
      return { gaze: Math.sin(t * 1.1) * 0.12, beak: 0, bob: 0 }
    case "peck": {
      const cycle = ((t / 1.7) % 1 + 1) % 1
      const dive = cycle < 0.5 ? Math.sin(cycle * Math.PI * 2) : 0
      return { gaze: -dive, beak: dive > 0.85 ? 1 : 0, bob: -dive * 0.05 }
    }
    case "static":
      return { gaze: 0, beak: 0, bob: 0 }
    default:
      return {
        gaze: Math.sin(t * 0.55) * 0.3,
        // A gape every few seconds rather than a rhythm, so it reads as idle.
        beak: Math.max(0, Math.sin(t * 0.8) - 0.94) * 14,
        bob: Math.sin(t * 0.9) * 0.018,
      }
  }
}

export { MicroDuck }
