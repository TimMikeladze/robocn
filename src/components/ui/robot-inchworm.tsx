"use client"

/**
 * robot-inchworm — a looper in side elevation.
 *
 * Every other crawler here moves by a wave travelling down its body. This one
 * has no wave at all: it plants one end, arches, reaches with the other, plants
 * that, and drags the first up. The arch is the interesting part — the body is
 * a fixed contour length, so the height of the loop is *implied* by how far
 * apart the two anchors are. Rather than draw that, it solves for it: a short
 * bisection on the spine's `turn` finds the arc whose chord is exactly the
 * current span. Shorten the span and the loop rises because it has nowhere
 * else to go. Click and it rears up.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine, type SpinePose } from "@/lib/robocn/spine"
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

/** Seconds a rear-up lasts before it settles back onto the surface. */
const REAR = 2.2

export type InchwormBehavior = "loop" | "rear" | "measure" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the body width: the prolegs are either side of it. */
const HALF_SPAN = 5
const CENTRE = 128
const GROUND = 150

/** Body contour length, and the span it opens and closes between. */
const BODY = 118
const SPAN = { closed: 78, open: 108 } as const

const fits: Record<RobotView, number> = { plan: 0.86, front: 0.86, profile: 1, iso: 0.96 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotInchwormProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One crawler, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: InchwormBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Loops per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a row of them breaks step. */
  offset?: number
  /** Anchor separation, 0 drawn right up to 1 stretched out. Omit and the behavior sets it. */
  span?: number
  /** How far the front end is lifted off the surface, 0–1. Omit and the behavior decides. */
  reach?: number
  /** Links in the body, 3–24. */
  segments?: number
  /** The front end reaches toward the pointer, and a click rears it up. */
  interactive?: boolean
  onRear?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The surface, and the marks that show it travelling over it. */
  showGround?: boolean
  label?: string
}

/**
 * The `turn` whose arc of length `BODY` spans `chord`. The chord falls
 * monotonically as the arch tightens, so a dozen bisections lands well inside
 * the width of a drawn line.
 */
function archFor(chord: number, segments: number) {
  const spanOf = (turn: number) => {
    const pose = solveSpine({ segments, length: BODY, amplitude: 0, turn })
    return Math.hypot(pose.tail.position.x, pose.tail.position.y)
  }
  if (chord >= spanOf(0.02)) return 0.02
  if (chord <= spanOf(1)) return 1
  let low = 0.02
  let high = 1
  for (let pass = 0; pass < 12; pass += 1) {
    const mid = (low + high) / 2
    if (spanOf(mid) > chord) low = mid
    else high = mid
  }
  return (low + high) / 2
}

function RobotInchworm({
  behavior = "loop", phase, view = NATIVE_VIEW, speed = 0.4, animate = true, paused = false, offset = 0,
  span, reach, segments = 14,
  interactive = true, onRear,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotInchwormProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [reared, setReared] = React.useState<number | null>(null)
  const since = reared === null ? Infinity : clock - reared
  const upright = since >= 0 && since < REAR ? Math.sin((since / REAR) * Math.PI) ** 0.6 : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && reach === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = inchwormBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  const step = scripted.step(beat)

  const stretch = finiteClamp(span ?? step.span, 0, 1, step.span)
  const lift = finiteClamp(
    clamp((reach ?? Math.max(step.reach, pointer.target ? Math.max(0, pointer.target.y) * 0.7 : 0)) + upright * 0.9, 0, 1),
    0, 1, step.reach,
  )
  const links = Number.isFinite(segments) ? Math.round(clamp(segments, 3, 24)) : 14

  // Both feet on the surface unless one of them is swinging or reared.
  const gap = lerp(SPAN.closed, SPAN.open, stretch)
  const rearFoot: Vec2 = { x: -gap / 2, y: step.back * 12 }
  const frontFoot: Vec2 = { x: gap / 2, y: step.front * 14 + lift * 76 }
  const chord = Math.hypot(frontFoot.x - rearFoot.x, frontFoot.y - rearFoot.y)

  const pose: SpinePose = solveSpine({
    segments: links,
    length: BODY,
    amplitude: 0,
    turn: archFor(Math.min(chord, BODY * 0.995), links),
  })

  // Place the solved arc so its nose lands on the front foot and its tail on
  // the rear one, then flip it if the loop came out on the wrong side.
  const raw = pose.tail.position
  const solverAngle = Math.atan2(raw.y, raw.x)
  const wanted = Math.atan2(rearFoot.y - frontFoot.y, rearFoot.x - frontFoot.x)
  const mid = pose.joints[Math.round(pose.joints.length / 2)].position
  const flip = mid.y * Math.cos(solverAngle) - mid.x * Math.sin(solverAngle) > 0 ? -1 : 1
  const spin = wanted - flip * solverAngle
  const cs = Math.cos(spin)
  const sn = Math.sin(spin)
  /** A solver point, placed in the drawing: y up in the animal, y down on screen. */
  const place = (p: Vec2): Vec2 => {
    const x = p.x
    const y = p.y * flip
    return { x: frontFoot.x + x * cs - y * sn, y: -(frontFoot.y + x * sn + y * cs) }
  }
  const body = pose.joints.map((joint) => place(joint.position))
  /** Body half-width: thickest just behind the head, tapering to the clasper. */
  const girth = (s: number) => 4 + 4.4 * Math.pow(1 - s, 0.6) * Math.min(1, 0.5 + s / 0.08)

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A drawing point — x forward, y down — `across` units out. */
  const at = (p: Vec2, across = 0) => camera.project(across, -p.y, -p.x)

  // The body's own tangent, but never nosing through the surface it stands on.
  const heading = clamp(
    Math.atan2(body[0].y - body[1].y, body[0].x - body[1].x) * (180 / Math.PI),
    -110,
    8,
  )
  // The surface slides under it: the animal walks, the frame does not travel.
  const drift = ((beat * 34) % 26 + 26) % 26

  const state = upright > 0.05 ? "reared up" : behavior === "static" ? "still" : behavior === "rear" ? "reared up" : behavior === "measure" ? "measuring" : "looping"

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot inchworm, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 256 180"
      width={width}
      height={px(width * 180 / 256)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setReared(clock)
        onRear?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 150 H 244 M 128 14 V 166" strokeDasharray="2 3" />
          <path
            d={`M ${px(CENTRE + rearFoot.x)} ${px(GROUND - rearFoot.y)} L ${px(CENTRE + frontFoot.x)} ${px(GROUND - frontFoot.y)}`}
            strokeDasharray="4 3"
          />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 10 150 H 246" stroke={palette.grid} strokeWidth={0.9} fill="none" />
          <g stroke={palette.grid} strokeWidth={0.7} opacity={0.5} fill="none">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
              <path key={index} d={`M ${px(10 + index * 26 - drift)} 150 v 6`} />
            ))}
          </g>
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND}) scale(${fit})`}>
        {body.slice(0, -1).map((point, index) => (
          <path
            key={index}
            data-segment={index}
            d={capsulePath(at(point), at(body[index + 1]), px(girth(pose.joints[index].s) * 0.85))}
            {...(index % 2 === 0 ? shell : machined)}
          />
        ))}
        {([-HALF_SPAN, HALF_SPAN] as const).map((across) => (
          <path
            key={across}
            d={capsulePath(at({ x: rearFoot.x, y: -rearFoot.y }, across), at({ x: rearFoot.x, y: 0 }, across), 2)}
            {...cast}
          />
        ))}
      </g>}

      <Frame {...frame}>
        <g data-inchworm data-view={view} transform={`translate(${CENTRE} ${GROUND})`}>
          <g data-spine>
            {body.slice(0, -1).map((point, index) => (
              <g key={index} data-segment={index}>
                <path
                  d={capsulePath(point, body[index + 1], px(girth(pose.joints[index].s)))}
                  {...(index % 2 === 0 ? shell : machined)}
                />
                {/* One plate seam per solved joint, so the plating bends with it. */}
                {index > 0 && (
                  <circle cx={px(point.x)} cy={px(point.y)} r={px(girth(pose.joints[index].s) * 0.42)} fill={palette.dark} opacity={0.35} />
                )}
              </g>
            ))}
          </g>

          {/* Claspers: the rear pair take the load while the front end reaches. */}
          <g data-anchor="rear" transform={`translate(${px(-gap / 2)} ${px(-rearFoot.y)})`}>
            <path d="M -6 -4 Q 0 6 6 -4 Z" {...cast} />
            {[-3, 0, 3].map((x) => (
              <path key={x} d={`M ${x} 1 v 5`} stroke={palette.metal} strokeWidth={1.6} strokeLinecap="round" fill="none" />
            ))}
            <circle cx={0} cy={-6} r={1.8} fill={palette.accent} opacity={px(0.4 + (1 - step.back) * 0.5)} />
          </g>

          <g data-anchor="front" transform={`translate(${px(gap / 2)} ${px(-frontFoot.y)})`}>
            <path d="M -5 -4 Q 0 5 5 -4 Z" {...cast} />
            {[-2.5, 2.5].map((x) => (
              <path key={x} d={`M ${x} 0 v 5`} stroke={palette.metal} strokeWidth={1.6} strokeLinecap="round" fill="none" />
            ))}
          </g>

          <g data-head transform={`translate(${px(body[0].x)} ${px(body[0].y)}) rotate(${px(heading)})`}>
            <path d="M 0 0 Q 9 -6 14 0 Q 9 6 0 0 Z" {...machined} />
            <circle cx={9} cy={-2.4} r={2} {...cast} />
            <circle cx={9.4} cy={-2.6} r={1} fill={palette.accent} />
            <circle cx={9} cy={2.4} r={2} {...cast} />
            <g data-eyes>
              <circle cx={5} cy={0} r={1.4} fill={palette.glow} opacity={0.85} />
            </g>
            {/* Two short feelers on the front of the capsule. */}
            <path d="M 13 -2 q 7 -3 10 -8 M 13 2 q 7 3 10 8" fill="none" stroke={palette.metal} strokeWidth={1.2} strokeLinecap="round" />
          </g>
        </g>
      </Frame>

      {label && (
        <text x={128} y={174} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
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
 * What it does with no timeline on it. `step` is a function of the cycle: the
 * span, and which of the two ends is off the surface.
 */
export function inchwormBehaviorPose(behavior: InchwormBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Front end right up, casting about for something to hold on to.
    case "rear":
      return {
        step: (cycle: number) => ({
          span: 0.1,
          // Casting about: a slow sweep on the clock, with the cycle riding on it.
          reach: clamp(0.72 + 0.16 * Math.sin(time * 1.3) + 0.06 * Math.sin(2 * Math.PI * cycle), 0, 1),
          front: 0,
          back: 0,
        }),
      }
    // The same loop, slowly and with a taller arch: pacing something out.
    case "measure":
      return {
        step: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          const reaching = t < 0.5
          const u = reaching ? t / 0.5 : (t - 0.5) / 0.5
          const eased = (1 - Math.cos(Math.PI * u)) / 2
          return {
            span: reaching ? eased * 0.7 : 0.7 * (1 - eased),
            reach: 0,
            front: reaching ? Math.sin(Math.PI * u) : 0,
            back: reaching ? 0 : Math.sin(Math.PI * u),
          }
        },
      }
    case "static":
      return { step: () => ({ span: 0.35, reach: 0, front: 0, back: 0 }) }
    // Anchor, arch, reach, plant, draw up. Exactly one end is ever loose.
    default:
      return {
        step: (cycle: number) => {
          const t = ((cycle % 1) + 1) % 1
          const reaching = t < 0.5
          const u = reaching ? t / 0.5 : (t - 0.5) / 0.5
          const eased = (1 - Math.cos(Math.PI * u)) / 2
          return {
            span: reaching ? eased : 1 - eased,
            reach: 0,
            front: reaching ? Math.sin(Math.PI * u) : 0,
            back: reaching ? 0 : Math.sin(Math.PI * u),
          }
        },
      }
  }
}

export { RobotInchworm }
