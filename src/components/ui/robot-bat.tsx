"use client"

/**
 * robot-bat — a membrane flyer in side elevation.
 *
 * Where the bird carries separate feather plates, this carries one skin. The
 * arm is a three-link chain — humerus, forearm, hand — and four finger struts
 * fan off the wrist; the membrane is drawn *through* the strut tips, so
 * furling and beating deform one surface instead of swapping artwork. It
 * roosts head-down and rights itself as it takes to the air, which is the same
 * body rotated, not a second drawing. Click and it drops off the beam.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

/** Seconds a drop keeps it airborne before it climbs back to the beam. */
const DROP = 3.2

export type BatBehavior = "roost" | "flap" | "glide" | "static"

/** The bat is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the shoulder width: the wings are either side of the torso. */
const HALF_SPAN = 6
const CENTRE = 118
/** Where the shoulder rides, hanging from the beam and out in the air. */
const HUNG = 46
const FLYING = 112

const fits: Record<RobotView, number> = { plan: 0.74, front: 0.9, profile: 1, iso: 0.94 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotBatProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One bat, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: BatBehavior
  /** Controlled wingbeat fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Wingbeats per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a colony breaks step. */
  offset?: number
  /** Wing extension, 0 furled against the body to 1 spread. Omit and the behavior sets it. */
  spread?: number
  /** 0 hanging head-down from the beam, 1 airborne and the right way up. Omit and the behavior decides. */
  flight?: number
  /** Head turn in degrees, −40..40. Omit and it follows the pointer. */
  headAngle?: number
  /** Track the pointer, and drop off the beam when clicked. */
  interactive?: boolean
  onDrop?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The roosting beam. */
  showGround?: boolean
  label?: string
}

/** Arm segment lengths, and the four finger struts off the wrist. */
const ARM = { humerus: 19, forearm: 27, hand: 9 } as const
const FINGERS = [33, 36, 31, 23] as const

/** Where a point lands after travelling `length` at `degrees`. */
const advance = (from: Vec2, degrees: number, length: number): Vec2 => ({
  x: from.x + Math.cos(toRadians(degrees)) * length,
  y: from.y + Math.sin(toRadians(degrees)) * length,
})

function RobotBat({
  behavior = "roost", phase, view = NATIVE_VIEW, speed = 2.2, animate = true, paused = false, offset = 0,
  spread, flight, headAngle,
  interactive = true, onDrop,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotBatProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A drop is one sortie: off the beam, a circuit on hard beats, back up.
  const [dropped, setDropped] = React.useState<number | null>(null)
  const since = dropped === null ? Infinity : clock - dropped
  const sortie = since >= 0 && since < DROP ? Math.sin((since / DROP) * Math.PI) ** 0.6 : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((0.5 - unit.y) * 2.2, -1, 1),
    }), []),
  })

  const scripted = batBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * lerp(scripted.rate, 1.4, sortie)
  const beat = Math.sin(2 * Math.PI * (Number.isFinite(cycle) ? cycle : 0))
  const down = Math.max(0, -beat)

  const open = finiteClamp(lerp(spread ?? scripted.spread, 1, sortie), 0, 1, scripted.spread)
  const air = finiteClamp(lerp(flight ?? scripted.flight, 1, sortie), 0, 1, scripted.flight)
  const look = finiteClamp(headAngle ?? (pointer.target ? pointer.target.y * 32 : scripted.head), -40, 40, 0)

  // Hanging and flying are the same body, turned over. Everything below is
  // written for the flying pose and rotated back into the roost.
  const roll = 180 * (1 - air)
  const shoulderY = lerp(HUNG, FLYING, air) - open * beat * 5

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /**
   * The whole wing as points: three links out to the wrist, then the finger
   * struts. The membrane is the boundary they describe, so there is nothing to
   * keep in step with them.
   */
  const wingPoints = (() => {
    // Backwards along the flank, lifted by the beat, and closing up as it furls.
    const a0 = 180 - lerp(6, 26 * beat, open)
    const a1 = a0 + lerp(150, -20 - 26 * down, open)
    const a2 = a1 + lerp(-165, 14 + 18 * down, open)
    const shoulder: Vec2 = { x: 0, y: 0 }
    const elbow = advance(shoulder, a0, ARM.humerus)
    const wrist = advance(elbow, a1, ARM.forearm)
    const thumb = advance(wrist, a2 - 46, ARM.hand)
    const tips = FINGERS.map((length, index) =>
      advance(wrist, a2 + lerp(6 + index * 3, 16 + index * 26, open), length * lerp(0.5, 1, open)),
    )
    return { shoulder, elbow, wrist, thumb, tips }
  })()

  /** The skin: leading edge out to the tips, scalloped back to the ankle. */
  const membrane = (() => {
    const { shoulder, elbow, tips } = wingPoints
    const ankle: Vec2 = { x: -6, y: lerp(6, 26, open) }
    const parts = [`M ${px(shoulder.x)} ${px(shoulder.y)}`, `Q ${px(elbow.x)} ${px(elbow.y - 5)} ${px(tips[0].x)} ${px(tips[0].y)}`]
    for (let index = 1; index < tips.length; index += 1) {
      const from = tips[index - 1]
      const to = tips[index]
      // A bat's trailing edge scallops in between the struts.
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
      const pull = 0.16 * Math.hypot(to.x - from.x, to.y - from.y)
      parts.push(`Q ${px(mid.x - pull)} ${px(mid.y - pull)} ${px(to.x)} ${px(to.y)}`)
    }
    parts.push(`Q ${px((tips[3].x + ankle.x) / 2 + 4)} ${px((tips[3].y + ankle.y) / 2 - 3)} ${px(ankle.x)} ${px(ankle.y)}`)
    parts.push("Z")
    return parts.join(" ")
  })()

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, shoulderY, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the bat's own frame — x forward, y down — `across` units out. */
  const at = (p: Vec2, across = 0) => camera.project(across, -p.y, -p.x)

  const state = sortie > 0.05 ? "dropping off the beam" : behavior === "static" ? "still" : behavior === "roost" ? "roosting" : behavior === "flap" ? "flapping" : behavior

  /** One wing, drawn from the shoulder out. `depth` sends the far one back. */
  function wing(depth: boolean) {
    const { elbow, wrist, thumb, tips } = wingPoints
    return (
      <g data-wing={depth ? "far" : "near"} opacity={depth ? 0.45 : 1} transform={depth ? "translate(-3 2)" : undefined}>
        <path data-membrane d={membrane} {...machined} fillOpacity={variant === "solid" ? 0.5 : undefined} />
        <path d={capsulePath({ x: 0, y: 0 }, elbow, 3.6)} {...shell} />
        <path d={capsulePath(elbow, wrist, 2.9)} {...shell} />
        <path d={capsulePath(wrist, thumb, 1.8)} {...cast} />
        {tips.map((tip, index) => (
          <path key={index} data-finger={index} d={capsulePath(wrist, tip, px(1.7 - index * 0.18))} {...cast} />
        ))}
        <circle cx={0} cy={0} r={3.2} {...cast} />
        <circle cx={px(elbow.x)} cy={px(elbow.y)} r={2.6} {...cast} />
        <circle cx={px(wrist.x)} cy={px(wrist.y)} r={2.4} {...machined} />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot bat, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 240 210"
      width={width}
      height={px(width * 210 / 240)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setDropped(clock)
        onDrop?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 104 H 228 M 118 14 V 196" strokeDasharray="2 3" />
          <circle cx={118} cy={px(shoulderY)} r={64} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <g data-roost>
          <rect x={22} y={14} width={196} height={8} rx={2} {...machined} />
          <path d="M 40 22 v 6 M 196 22 v 6" stroke={palette.dark} strokeWidth={2} />
          <ellipse cx={118} cy={px(shoulderY + 46)} rx={px(30 * air)} ry={px(4 * air)} fill={palette.dark} opacity={px(0.1 * air)} />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${px(shoulderY)}) scale(${fit})`}>
        {[-HALF_SPAN, HALF_SPAN].map((across) => (
          <path
            key={across}
            data-wing-solid={across > 0 ? "right" : "left"}
            d={capsulePath(at(wingPoints.shoulder, across), at(wingPoints.tips[1], across * 4.2), 3.4)}
            {...machined}
          />
        ))}
        <path
          d={extrudedPath(roundedFootprint(HALF_SPAN + 1.5, 22, 6, 5), camera, 16, -22)}
          {...shell}
        />
        <path d={capsulePath(at({ x: 0, y: -20 }, 0), at({ x: -4, y: -34 }, 0), 5)} {...cast} />
      </g>}

      <Frame {...frame}>
        <g data-bat data-view={view} transform={`translate(${CENTRE} ${px(shoulderY)}) rotate(${px(roll)})`}>
          {wing(true)}

          <g data-body>
            <path d="M -4 -16 Q 10 -10 9 6 Q 7 22 0 26 Q -8 20 -9 4 Q -10 -10 -4 -16 Z" {...shell} />
            <path d="M -6 -2 Q 0 2 6 -2 M -6 8 Q 0 12 6 8" fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.45} />
            <rect x={-4} y={-8} width={8} height={11} rx={2.5} {...cast} />
            <circle cx={0} cy={-2.5} r={1.8} fill={palette.accent} />
          </g>

          {/* Feet: hooked over the beam when it hangs, tucked when it flies. */}
          <g data-feet transform={`translate(0 ${px(26 - air * 2)})`}>
            {[-4, 4].map((x) => (
              <path
                key={x}
                d={air > 0.5 ? `M ${x} 0 q ${x} 6 ${x * 0.4} 10` : `M ${x} 0 q ${x * 0.6} 7 ${x * 2.2} 6 q 2 -3 -1 -5`}
                fill="none"
                stroke={palette.metal}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            ))}
          </g>

          <g data-head transform={`translate(2 -22) rotate(${px(look * 0.5)})`}>
            <path d="M -7 4 Q -8 -8 0 -11 Q 8 -8 7 4 Q 0 9 -7 4 Z" {...machined} />
            {/* Ears: the sensor the animal is really built around. */}
            <g data-ears>
              {([-1, 1] as const).map((side) => (
                <g key={side} transform={`translate(${px(side * 5)} -8) rotate(${px(side * (14 + look * 0.3))})`}>
                  <path d="M 0 0 Q -3.5 -9 -1 -17 Q 3 -11 3.5 0 Z" {...shell} />
                  <path d="M 0 -3 Q 0.5 -9 0 -13" fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.6} />
                </g>
              ))}
            </g>
            {([-1, 1] as const).map((side) => (
              <circle key={side} cx={px(side * 3)} cy={-1} r={1.7} fill={palette.accent} />
            ))}
            {/* Nose leaf: the emitter. */}
            <path d="M 0 3 L -2.4 8 L 2.4 8 Z" {...cast} />
            <circle cx={0} cy={7} r={1.1} fill={palette.glow} opacity={0.9} />
          </g>

          {wing(false)}
        </g>
      </Frame>

      {label && (
        <text x={120} y={204} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: hang, beat, or hold the skin out. */
export function batBehaviorPose(behavior: BatBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "flap":
      return { spread: 1, flight: 1, rate: 1, head: 8 * Math.sin(time * 0.7) }
    // Gliding is the skin held: the beat all but stops.
    case "glide":
      return { spread: 0.93, flight: 1, rate: 0.09, head: 5 * Math.sin(time * 0.45) }
    case "static":
      return { spread: 0.55, flight: 1, rate: 0, head: 0 }
    // Roosting: furled, head down, and the odd sway on the beam.
    default:
      return {
        spread: 0.1 + 0.03 * Math.sin(time * 0.9),
        flight: 0,
        rate: 0.25,
        head: 22 * Math.sin(time * 0.4),
      }
  }
}

export { RobotBat }
