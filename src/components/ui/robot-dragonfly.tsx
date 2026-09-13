"use client"

/**
 * robot-dragonfly — a four-winged flyer seen from above.
 *
 * The mechanism is the wing pairs: fore and hind beat half a cycle apart, the
 * way a real dragonfly's do, which is what lets it hold station instead of
 * bobbing through every stroke. A beating wing is foreshortened in plan by the
 * cosine of its own stroke angle rather than redrawn, so the beat is a fact
 * about the geometry from every camera. The abdomen is a `solveSpine` chain
 * that flicks and curls. It yaws toward the pointer, and a click darts.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine } from "@/lib/robocn/spine"
import {
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

/** Seconds a poked dart takes to decay back into whatever it was doing. */
const DART = 1.2
/** Peak stroke angle off the horizontal, in degrees. */
const STROKE = 68
/** How much of a raised joint's height shows as a screen offset in plan view. */
const RELIEF = 0.4
/** Where the wings and the body ride above the ground plane. */
const WING_PLANE = 20
const BODY_PLANE = 15

export type DragonflyBehavior = "hover" | "dart" | "perch" | "static"

/** The flyer is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotDragonflyProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One flyer, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: DragonflyBehavior
  /** Controlled wingbeat fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Wingbeats per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a swarm breaks step. */
  offset?: number
  /** Stroke amplitude, 0 wings held flat to 1 the full beat. Omit and the behavior sets it. */
  swing?: number
  /** Abdomen curl out of the wing plane, 0 straight to 1 hooked under. Omit and the behavior sets it. */
  curl?: number
  /** Body yaw in degrees, −70..70. Omit and it turns toward the pointer. */
  heading?: number
  /** Height above the ground, 0–1. Omit and the behavior decides. */
  altitude?: number
  /** Links in the abdomen, 3–24. */
  segments?: number
  /** Yaw toward the pointer, and dart when clicked. */
  interactive?: boolean
  onDart?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  /** The ground shadow, and the reed it perches on. */
  showGround?: boolean
  label?: string
}

/** Span and chord of each wing pair, in world units. */
const WINGS = [
  { pair: "fore", root: 13, span: 64, chord: 13, offset: 0 },
  { pair: "hind", root: 1, span: 58, chord: 15, offset: 0.5 },
] as const

/** Abdomen contour length, and the half-width at the thorax. */
const ABDOMEN = 86
const GIRTH = 5.4

function RobotDragonfly({
  behavior = "hover", phase, view = NATIVE_VIEW, speed = 4, animate = true, paused = false, offset = 0,
  swing, curl, heading, altitude, segments = 9,
  interactive = true, onDart,
  size = "md", variant = "solid", showGround = true, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotDragonflyProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  // A poke is one burst: the beat spikes, the body swings, and both decay.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : clock - poked
  const burst = since >= 0 && since < DART ? Math.exp(-since * 3.2) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && heading === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = dragonflyBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed * lerp(scripted.rate, 1.7, burst)
  const beat = Number.isFinite(cycle) ? cycle : 0
  const depth = finiteClamp(lerp(swing ?? scripted.swing, 1, burst), 0, 1, scripted.swing)
  const hook = finiteClamp(curl ?? scripted.curl, 0, 1, scripted.curl)
  const rise = finiteClamp(altitude ?? scripted.altitude, 0, 1, scripted.altitude)
  const yaw = finiteClamp(
    heading ?? (pointer.target ? pointer.target.x * 60 : scripted.heading),
    -70, 70, 0,
  )

  // The abdomen trails the thorax: a gentle wave with the swing at the tip,
  // plus a curl that takes the last third of it out of the wing plane.
  const spine = solveSpine({
    segments,
    length: ABDOMEN,
    phase: beat * 0.25,
    amplitude: 0.16 * depth + burst * 0.2,
    waves: 0.6,
    taper: 0.9,
    turn: clamp(-yaw / 140, -1, 1),
  })
  /** Height of the abdomen at station `s`: the curl lifts the back of it. */
  const droop = (s: number) => -hook * 30 * s * s

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane()
  const state = burst > 0.05 ? "darting" : behavior === "static" ? "still" : behavior === "hover" ? "hovering" : behavior === "perch" ? "perched" : behavior

  /** Stroke angle of one wing pair at the current beat, in degrees. */
  const strokeAngle = (pairOffset: number) =>
    STROKE * depth * Math.sin(2 * Math.PI * (beat + pairOffset))

  /** Abdomen joint in drawing coordinates: x starboard, y toward the nose. */
  const bead = (index: number) => {
    const joint = spine.joints[index]
    return { x: joint.position.y, y: -8 + joint.position.x, s: joint.s }
  }
  /** Abdomen half-width at station `s`: thick at the waist, a point at the tip. */
  const belly = (s: number) => GIRTH * (0.35 + 0.65 * Math.pow(1 - s, 0.8))

  /** A point in the plan drawing, at `height` above the ground. */
  const at = (p: { x: number; y: number }, height: number) =>
    camera.project(p.x, height, -p.y)

  /**
   * One wing. It is a flat plate in a plane that tilts through the stroke, so
   * in plan it keeps its chord and loses span by the cosine of the angle —
   * the projection, not a second drawing.
   */
  function wing(side: 1 | -1, index: 0 | 1) {
    const { pair, root, span, chord, offset: pairOffset } = WINGS[index]
    const angle = strokeAngle(pairOffset)
    const foreshorten = Math.cos(toRadians(angle))
    // The wing also sweeps a little fore and aft through the stroke, which is
    // what stops the two pairs reading as one rigid cross.
    const sweep = 9 * Math.cos(2 * Math.PI * (beat + pairOffset)) * depth
    const reach = span * foreshorten
    return (
      <g
        key={`${pair}-${side}`}
        data-wing={`${pair}-${side === 1 ? "right" : "left"}`}
        transform={`translate(${px(side * 7)} ${root}) rotate(${px(-side * sweep)})`}
        opacity={px(0.62 + 0.3 * Math.abs(foreshorten))}
      >
        <path
          d={`M 0 ${px(-chord * 0.28)} Q ${px(side * reach * 0.45)} ${px(-chord * 0.6)} ${px(side * reach)} ${px(-chord * 0.16)} Q ${px(side * reach * 0.5)} ${px(chord * 0.5)} 0 ${px(chord * 0.3)} Z`}
          {...machined}
          fillOpacity={variant === "solid" ? 0.42 : undefined}
        />
        {/* Venation: the spars that make the membrane a structure. */}
        <g stroke={palette.dark} strokeWidth={0.55} opacity={0.55} fill="none">
          <path d={`M 0 ${px(-chord * 0.26)} L ${px(side * reach * 0.97)} ${px(-chord * 0.16)}`} />
          {[0.25, 0.48, 0.71].map((t) => (
            <path
              key={t}
              d={`M ${px(side * reach * t)} ${px(-chord * (0.45 - t * 0.28))} L ${px(side * reach * t)} ${px(chord * (0.4 - t * 0.3))}`}
            />
          ))}
        </g>
        <circle cx={0} cy={0} r={2.4} {...cast} />
        {/* Pterostigma: the weight near the leading edge of the tip. */}
        <rect x={px(side * reach * 0.82)} y={px(-chord * 0.32)} width={px(reach * 0.1)} height={2.4} rx={1} fill={palette.accent} opacity={0.85} />
      </g>
    )
  }

  const wingSolid = (side: 1 | -1, index: 0 | 1) => {
    const { pair, root, span, chord, offset: pairOffset } = WINGS[index]
    const angle = toRadians(strokeAngle(pairOffset))
    const hinge = { x: side * 7, y: root }
    const tip = {
      x: side * (7 + span * Math.cos(angle)),
      y: root,
    }
    return (
      <path
        key={`${pair}-${side}`}
        data-wing={`${pair}-${side === 1 ? "right" : "left"}`}
        d={capsulePath(
          at(hinge, WING_PLANE + rise * 26),
          at(tip, WING_PLANE + rise * 26 + span * Math.sin(angle)),
          px(chord * 0.32),
        )}
        {...machined}
        fillOpacity={variant === "solid" ? 0.42 : undefined}
      />
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot dragonfly, ${state}, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 240 210"
      width={width}
      height={px(width * 210 / 240)}
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
          <path d="M 12 104 H 228 M 120 12 V 196" strokeDasharray="2 3" />
          <circle cx={120} cy={104} r={71} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <ellipse cx={120} cy={116} rx={px(52 - rise * 20)} ry={px(16 - rise * 6)} fill={palette.dark} opacity={px(0.14 - rise * 0.08)} />
          {rise < 0.06 && <path d="M 120 150 Q 128 176 118 200" fill="none" stroke={palette.grid} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />}
        </g>
      )}

      {offAxis && <g data-solids transform={`translate(120 ${px(104 - rise * 10)})`}>
        {([-1, 1] as const).flatMap((side) => [wingSolid(side, 1), wingSolid(side, 0)])}
        {spine.joints.slice(0, -1).map((_, index) => {
          const a = bead(index)
          const b = bead(index + 1)
          return (
            <path
              key={index}
              data-segment={index}
              d={capsulePath(
                at(a, BODY_PLANE + rise * 26 + droop(a.s)),
                at(b, BODY_PLANE + rise * 26 + droop(b.s)),
                px(belly(a.s)),
              )}
              {...shell}
            />
          )
        })}
        <path
          d={extrudedPath(circleFootprint(0, -5, 10, 12), camera, BODY_PLANE + rise * 26 + 7, BODY_PLANE + rise * 26 - 7)}
          {...shell}
        />
        <path
          d={extrudedPath(circleFootprint(0, -26, 8, 12), camera, BODY_PLANE + rise * 26 + 7, BODY_PLANE + rise * 26 - 6)}
          {...cast}
        />
      </g>}

      <g
        data-dragonfly
        data-view={view}
        transform={`translate(120 ${px(104 - rise * 10)}) ${ground} scale(1 -1) rotate(${px(-yaw)})`.replace(/\s+/g, " ")}
      >
        <g data-abdomen>
          {spine.joints.slice(0, -1).map((_, index) => {
            const a = bead(index)
            const b = bead(index + 1)
            return (
              <g key={index} data-segment={index}>
                <path
                  d={capsulePath(
                    { x: a.x, y: a.y - droop(a.s) * RELIEF },
                    { x: b.x, y: b.y - droop(b.s) * RELIEF },
                    px(belly(a.s)),
                  )}
                  {...(index % 2 === 0 ? shell : machined)}
                />
              </g>
            )
          })}
          {/* Cerci: the two prongs on the tip. */}
          <path
            d={`M ${px(bead(spine.joints.length - 1).x - 2)} ${px(bead(spine.joints.length - 1).y - droop(1) * RELIEF - 4)} l -1.5 -5 m 5 5 l 1.5 -5`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>

        <g data-legs stroke={palette.dark} strokeWidth={1.7} strokeLinecap="round" fill="none" opacity={0.8}>
          {([-1, 1] as const).map((side) =>
            [0, 1, 2].map((index) => (
              <path
                key={`${side}-${index}`}
                d={`M ${px(side * 6)} ${px(6 - index * 6)} q ${px(side * 8)} ${px(4 + index * 2)} ${px(side * 6)} ${px(13 + index * 3)}`}
              />
            )),
          )}
        </g>

        <g data-thorax>
          <path d="M -9 -8 Q -11 12 -6 19 L 6 19 Q 11 12 9 -8 Z" {...shell} />
          <path d="M -7 4 H 7 M -8 10 H 8" stroke={palette.dark} strokeWidth={0.8} opacity={0.45} fill="none" />
          <rect x={-4} y={-5} width={8} height={9} rx={2} {...cast} />
          <circle cx={0} cy={0.5} r={1.8} fill={palette.accent} />
        </g>

        {([-1, 1] as const).flatMap((side) => [wing(side, 1), wing(side, 0)])}

        <g data-head transform={`translate(0 24) rotate(${px(-yaw * 0.25)})`}>
          <circle cx={0} cy={0} r={7.5} {...cast} />
          {/* Compound eyes: nearly the whole head, which is what a dragonfly is. */}
          {([-1, 1] as const).map((side) => (
            <g key={side} data-eye={side === 1 ? "right" : "left"}>
              <circle cx={px(side * 5.4)} cy={2.4} r={5.6} {...machined} />
              <circle cx={px(side * 6.2)} cy={3.4} r={2.6} fill={palette.accent} opacity={0.9} />
            </g>
          ))}
          <path d="M -2 8 l -1.5 5 M 2 8 l 1.5 5" stroke={palette.metal} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        </g>

        {burst > 0.05 && (
          <g data-wake opacity={px(burst * 0.55)} fill="none" stroke={palette.glow} strokeWidth={1}>
            {[0, 1, 2].map((index) => (
              <path key={index} d={`M ${px(-16 - index * 5)} ${px(-40 - index * 10)} q 16 -7 32 0`} />
            ))}
          </g>
        )}
      </g>

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

/** What it does with no timeline on it: hold station, burst about, or sit. */
export function dragonflyBehaviorPose(behavior: DragonflyBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Burst travel: hard beats and a hard turn, then a coast on slower wings.
    case "dart": {
      const surge = Math.pow(Math.max(0, Math.sin(time * 0.7)), 3)
      return {
        rate: 0.55 + surge * 1.6,
        swing: 0.5 + 0.5 * surge,
        curl: 0.1,
        altitude: 0.6 + 0.3 * surge,
        heading: 46 * Math.sin(time * 0.7),
      }
    }
    // Perched: wings held out flat, abdomen hooked under, nothing beating.
    case "perch":
      return { rate: 0, swing: 0, curl: 0.62, altitude: 0, heading: 14 * Math.sin(time * 0.3) }
    case "static":
      return { rate: 0, swing: 0.55, curl: 0.12, altitude: 0.7, heading: 0 }
    // Station-keeping: the pairs beat flat out and the body barely moves.
    default:
      return {
        rate: 1,
        swing: 0.88,
        curl: 0.14 + 0.06 * Math.sin(time * 0.8),
        altitude: 0.72 + 0.05 * Math.sin(time * 1.1),
        heading: 12 * Math.sin(time * 0.4),
      }
  }
}

export { RobotDragonfly }
