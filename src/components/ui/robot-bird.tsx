"use client"

/**
 * robot-bird — a perching flyer in profile.
 *
 * Each wing is a three-link chain — humerus, forearm, hand — carrying fanned
 * feather plates, so extending, folding and beating are all the same mechanism
 * seen at different points of one cycle. Left alone it perches, beats or
 * glides; hand it `phase` and your timeline drives the beat. The head tracks
 * the pointer, and a click launches it into a burst that settles back down.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
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

/** Seconds a launch stays airborne before it settles back onto the perch. */
const LAUNCH = 2.4

export type BirdBehavior = "perch" | "flap" | "glide" | "static"

/** The bird is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the shoulder width. The elevation drew one wing behind the other; they
 *  are really either side of the torso. */
const HALF_SPAN = 7
/** Where the bird sits in the frame. */
const CENTRE = 110
const GROUND = 148

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotBirdProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** What it does when `phase` is not supplied. */
  /** Where the camera stands. One bird, four projections. */
  view?: RobotView
  behavior?: BirdBehavior
  /** Controlled wingbeat fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Wingbeats per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a flock breaks step. */
  offset?: number
  /** Wing extension, 0 folded against the body to 1 spread. Omit and the behavior sets it. */
  spread?: number
  /** Tail fan, 0 closed to 1 spread. Omit and the behavior sets it. */
  tail?: number
  /** Head turn in degrees, −40..40. Omit and it follows the pointer. */
  headAngle?: number
  /** Height above the perch, 0–1. Omit and the behavior decides. */
  altitude?: number
  /** Track the pointer, and take off when clicked. */
  interactive?: boolean
  onTakeoff?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The perch and its shadow. */
  showGround?: boolean
  label?: string
}

/** Wing segment lengths in world units. */
const WING = { humerus: 21, forearm: 25, hand: 13 } as const

function RobotBird({
  behavior = "perch", phase, view = NATIVE_VIEW, speed = 1.6, animate = true, paused = false, offset = 0,
  spread, tail, headAngle, altitude,
  interactive = true, onTakeoff,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotBirdProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A launch is a burst: wings out, hard beats, height, then a settle back.
  const [launched, setLaunched] = React.useState<number | null>(null)
  const since = launched === null ? Infinity : clock - launched
  const burst = since >= 0 && since < LAUNCH ? Math.sin((since / LAUNCH) * Math.PI) ** 0.7 : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      // Above the bird lifts its head, below it looks down.
      y: clamp((0.5 - unit.y) * 2.2, -1, 1),
    }), []),
  })

  const scripted = birdBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * lerp(scripted.rate, 1.5, burst)
  const beat = Math.sin(2 * Math.PI * (Number.isFinite(cycle) ? cycle : 0))
  const upstroke = Math.max(0, beat)

  const open = finiteClamp(lerp(spread ?? scripted.spread, 1, burst), 0, 1, scripted.spread)
  const fan = finiteClamp(lerp(tail ?? scripted.tail, 0.8, burst), 0, 1, scripted.tail)
  const rise = finiteClamp(lerp(altitude ?? scripted.altitude, 1, burst), 0, 1, scripted.altitude)
  const look = finiteClamp(headAngle ?? (pointer.target ? pointer.target.y * 34 : scripted.head), -40, 40, 0)

  // Folded, the chain doubles back along the flank; spread, the same three
  // links beat. Positive angles lift, so the wing rises on the upstroke.
  const shoulder = lerp(-12, -12 + 46 * beat, open)
  // Folded the forearm returns forward and the hand turns back again — the Z
  // a bird's wing makes against its body.
  const elbow = lerp(-160, 9 + 26 * upstroke, open)
  const wrist = lerp(165, -(7 + 19 * upstroke), open)
  const quill = lerp(0.12, 1 - 0.4 * upstroke, open)
  // Tucked feathers stow short, so a folded wing ends at the tail rather than past it.
  const vane = lerp(0.6, 1, open)

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const bodyY = 104 - rise * 30 - (open > 0.4 ? open * beat * 4 : Math.sin(clock * 1.6) * 1.2)
  const perched = rise < 0.04
  const state = burst > 0.05 ? "taking off" : behavior === "static" ? "still" : behavior

  /** One wing, drawn from the shoulder out. `depth` sends the far one back. */
  function wing(depth: boolean) {
    const droop = depth ? 4 : 0
    return (
      <g
        data-wing={depth ? "far" : "near"}
        transform={`translate(2 -4) rotate(${px(shoulder - droop)})`}
        opacity={depth ? 0.5 : 1}
      >
        <path d={capsulePath({ x: 0, y: 0 }, { x: -WING.humerus, y: 0 }, 5)} {...shell} />
        <circle cx={0} cy={0} r={4} {...cast} />
        <g transform={`translate(${-WING.humerus} 0) rotate(${px(elbow)})`}>
          <path d={capsulePath({ x: 0, y: 0 }, { x: -WING.forearm, y: 0 }, 3.8)} {...machined} />
          <circle cx={0} cy={0} r={3.4} {...cast} />
          {/* Secondaries lie along the trailing edge of the forearm. */}
          {[0, 1, 2].map((index) => (
            <g key={index} transform={`translate(${px(-6 - index * 6.5)} 1.5) rotate(${px(10 + index * 4 * quill)})`}>
              <path d={`M 0 -2 Q -10 0 -${px((17 + quill * 4) * vane)} 2 Q -10 6 0 4 Z`} {...cast} />
            </g>
          ))}
          <g transform={`translate(${-WING.forearm} 0) rotate(${px(wrist)})`}>
            <path d={capsulePath({ x: 0, y: 0 }, { x: -WING.hand, y: 0 }, 3.2)} {...machined} />
            <circle cx={0} cy={0} r={2.8} {...cast} />
            {/* Primaries: the fan that opens on the downstroke and closes coming up. */}
            {[0, 1, 2, 3, 4].map((index) => (
              <g
                key={index}
                data-feather={index}
                transform={`translate(${px(-2 - index * 2.6)} ${px(-1 + index * 0.6)}) rotate(${px(4 + index * 7 * quill)})`}
              >
                <path
                  d={`M 0 -3 Q -16 -1 -${px((26 + index * 4 + quill * 10) * vane)} ${px(1 + index * 0.4)} Q -16 5 0 3.5 Z`}
                  {...shell}
                />
              </g>
            ))}
          </g>
        </g>
      </g>
    )
  }
  // The drawing is a side elevation, so it goes through `wall` where it perches
  // and comes out untouched from the side. The wings are either side of the
  // torso rather than one behind the other, and the torso is a solid: both only
  // read once the camera comes round.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(0, 90), CENTRE, GROUND)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the bird's own frame — x forward, y down — `across` units out. */
  const at = (x: number, y: number, across = 0) =>
    camera.project(across, GROUND - (bodyY + y), CENTRE - (CENTRE + x))


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot bird, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 220 180"
      width={width}
      height={px(width * 180 / 220)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setLaunched(clock)
        onTakeoff?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 14 104 H 206 M 110 12 V 160" strokeDasharray="2 3" />
          <circle cx={110} cy={px(bodyY)} r={62} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <g data-perch>
          <ellipse cx={112} cy={158} rx={px(34 - rise * 14)} ry={px(3.4 - rise)} fill={palette.dark} opacity={px(0.18 - rise * 0.1)} />
          <rect x={40} y={148} width={140} height={6} rx={3} {...machined} />
          <rect x={58} y={154} width={5} height={16} rx={2} {...cast} />
          <rect x={158} y={154} width={5} height={16} rx={2} {...cast} />
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        {[-HALF_SPAN, HALF_SPAN].map(across => (
          <path
            key={across}
            data-wing-solid={across > 0 ? "right" : "left"}
            d={capsulePath(at(-6, 0, across), at(-6 - WING.humerus * open, -4, across * 2.4), 4)}
            {...machined}
          />
        ))}
        <path
          d={extrudedPath(roundedFootprint(HALF_SPAN + 2, 30, 8, 5), camera, GROUND - bodyY + 21, GROUND - bodyY - 21)}
          {...shell}
        />
        {[-4, 4].map(across => (
          <path key={across} d={capsulePath(at(0, 16, across), at(2, 38, across), 2.6)} {...machined} />
        ))}
      </g>}
      <Frame {...frame}>
      <g data-bird data-view={view} transform={`translate(110 ${px(bodyY)})`}>
        <g transform="translate(-6 0)">{wing(true)}</g>

        <g data-tail transform={`translate(-30 6) rotate(${px(8 - rise * 16)})`}>
          {[-2, -1, 0, 1, 2].map((index) => (
            <g key={index} data-tail-feather={index} transform={`rotate(${px(index * 12 * fan)})`}>
              <path
                d={`M 0 -2 Q -14 ${px(-1 + index * 0.5)} -${px(34 + fan * 6)} ${px(index * 1.2)} Q -14 ${px(5 + index * 0.5)} 0 4 Z`}
                {...(index % 2 === 0 ? machined : cast)}
              />
            </g>
          ))}
        </g>

        <g data-torso>
          <ellipse cx={0} cy={0} rx={30} ry={21} {...shell} />
          <path d="M -18 -14 Q 2 -22 20 -12" fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.45} />
          <path d="M -22 6 Q 0 14 22 4" fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.4} />
          <rect x={-8} y={-6} width={17} height={12} rx={3} {...cast} />
          {[-4, 0, 4].map((x) => (
            <line key={x} x1={x} y1={-4} x2={x} y2={4} stroke={palette.metal} strokeWidth={0.9} />
          ))}
          <circle cx={16} cy={2} r={2.2} fill={palette.accent} opacity={0.9} />
        </g>

        {/* Legs: down to the perch when it is standing, tucked back when it is not. */}
        <g data-legs>
          {[-8, 4].map((x, index) => (
            <g key={x} opacity={index === 0 ? 0.65 : 1}>
              {perched ? (
                <>
                  <path d={`M ${x} 16 L ${x + 2} ${px(38 + index)} `} stroke={palette.metal} strokeWidth={2.6} strokeLinecap="round" fill="none" />
                  <path d={`M ${x + 2} ${px(38 + index)} l -6 5 m 6 -5 l 6 5`} stroke={palette.dark} strokeWidth={2} strokeLinecap="round" fill="none" />
                </>
              ) : (
                <path d={`M ${x} 15 q -6 10 -16 12`} stroke={palette.metal} strokeWidth={2.4} strokeLinecap="round" fill="none" />
              )}
            </g>
          ))}
        </g>

        <g data-head transform={`translate(26 -13) rotate(${px(-look * 0.5)})`}>
          <path d={capsulePath({ x: -6, y: 4 }, { x: 2, y: -4 }, 5)} {...machined} />
          <circle cx={9} cy={-9} r={12} {...shell} />
          <path d="M 4 -20 Q 12 -30 20 -24" fill="none" stroke={palette.accent} strokeWidth={2} strokeLinecap="round" />
          <circle cx={13} cy={-12} r={3.6} {...cast} />
          <circle cx={13} cy={-12} r={2} fill={palette.accent} />
          <circle cx={13.8} cy={-12.6} r={0.8} fill={palette.dark} />
          <path data-beak d={`M 19 -7 L ${px(33 + fan)} -4 L 19 -1 Z`} {...cast} />
          <path d="M 19 -4 H 31" stroke={palette.metal} strokeWidth={0.7} opacity={0.7} />
        </g>

        {wing(false)}
      </g>
      </Frame>

      {label && (
        <text x={110} y={176} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/** What it does with no timeline on it: sit, beat, or hold the wings out. */
export function birdBehaviorPose(behavior: BirdBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "flap":
      return { spread: 1, tail: 0.55, altitude: 0.75, rate: 1, head: 6 * Math.sin(time * 0.8) }
    // Gliding is wings held: the beat all but stops and the tail does the trimming.
    case "glide":
      return { spread: 0.92, tail: 0.85, altitude: 0.6, rate: 0.08, head: 4 * Math.sin(time * 0.5) }
    case "static":
      return { spread: 0.12, tail: 0.2, altitude: 0, rate: 0, head: 0 }
    // Perched: folded, with the odd look around.
    default:
      return {
        spread: 0.08,
        tail: 0.18,
        altitude: 0,
        rate: 0.35,
        head: 26 * Math.sin(time * 0.45) * (Math.sin(time * 0.21) > 0 ? 1 : 0.2),
      }
  }
}

export { RobotBird }
