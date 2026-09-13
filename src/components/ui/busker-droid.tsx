"use client"

/**
 * busker-droid — a one-machine band.
 *
 * Every other droid in the set is posed or follows something. This one is
 * driven by data: a step pattern, one row per voice, exactly the pattern a
 * music box carries as pins on its barrel. `combLift` raises the beater as the
 * step comes round and drops it the instant the step arrives, which is the same
 * discontinuity that plucks a tine — a sequencer is a pinned barrel unrolled.
 *
 * The arms are solved, not posed. Each works in the vertical plane that
 * contains its shoulder and the thing it is hitting, so the elbow is a
 * two-link solution to a real target and a target out of reach straightens the
 * arm rather than stretching it.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  solveElbow2,
  toRadians,
  type Bend,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import { barrelStep, combLift, combRelease, pinBarrel } from "@/lib/robocn/sound"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_W = 150
const VIEW_H = 168

/** World units: x starboard, y up, z toward the back. The droid faces −z. */
const STAND_Z = 16
const HIP_Y = 46
const SHOULDER = { x: 15, y: 80, z: STAND_Z }
const UPPER = 19
const FORE = 19
const HEAD_Y = 94

/** The kit, in front of the machine. */
const KICK = { x: 0, y: 15, z: -18, radius: 15, depth: 9 }
const SNARE = { x: -25, y: 50, z: -4, radius: 11 }
const CYMBAL = { x: 26, y: 62, z: -6, radius: 13, tilt: 18 }
/** How far a beater is raised before it comes down. */
const SWING = 15
/** How far back the pedal's beater is drawn, degrees. */
const PEDAL_SWING = 46

/** Voices, in pattern-row order. */
const VOICES = ["kick", "snare", "cymbal"] as const
/** Plain alternating figures, written for this file. */
const DEFAULT_PATTERN = [
  "x...x...x...x...",
  "....x.......x...",
  "..x...x...x...x.",
]

/** Steps per second while easing back after the pattern is scrubbed by hand. */
const SLEW_RATE = 26
const NATIVE_VIEW: RobotView = "front"

const fits: Record<RobotView, number> = { plan: 0.92, front: 1, profile: 1, iso: 0.94 }
const frames: Record<RobotView, Vec2> = {
  plan: { x: 75, y: 74 },
  front: { x: 75, y: 136 },
  profile: { x: 78, y: 136 },
  iso: { x: 72, y: 130 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type BuskerBehavior = "groove" | "fill" | "static"

export interface BuskerDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position through the pattern, in steps. Omit to run `behavior`. */
  beat?: number
  /** What it plays when `beat` is not supplied. */
  behavior?: BuskerBehavior
  /** One row per voice — kick, snare, cymbal. Any non-blank character is a hit. */
  pattern?: readonly string[]
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Passes of the whole pattern per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to scrub the pattern, or arrow-key it a step at a time. */
  interactive?: boolean
  onBeatChange?: (beat: number) => void
  /** The step now under the beaters, 0-based. */
  onStepChange?: (step: number) => void
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BuskerDroid({
  beat,
  behavior = "groove",
  pattern = DEFAULT_PATTERN,
  view = NATIVE_VIEW,
  speed = 0.55,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onBeatChange,
  onStepChange,
  showGround = true,
  label,
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  ...props
}: BuskerDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const barrel = pinBarrel(
    (Array.isArray(pattern) ? pattern : DEFAULT_PATTERN).slice(0, VOICES.length),
  )
  const steps = barrel.steps

  const controlled = beat !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(beat) ? (beat as number) : 0) : held
  const goal = React.useCallback(
    (clock: number) => buskerGoal(behavior, clock, steps),
    [behavior, steps],
  )
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const position = Number.isFinite(motion.value) ? motion.value : 0
  const step = barrelStep(barrel, position)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onBeatChange?.(next)
      if (steps > 0) onStepChange?.(((Math.floor(next) % steps) + steps) % steps)
    },
    [steps, onBeatChange, onStepChange],
  )
  const live = React.useRef(position)
  React.useEffect(() => {
    live.current = position
  })
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: live.current, at: unit.x }
          return
        }
        // The whole width of the frame is one pass of the pattern.
        apply(press.current.from + (unit.x - press.current.at) * Math.max(1, steps))
      },
      [apply, steps],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const origin = frames[view] ?? frames.front

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)
  const lift = (voice: number) => combLift(barrel, voice, position)
  const ring = (voice: number) => combRelease(barrel, voice, position, { tail: 2.4 })

  // Each arm reaches a beater tip that stands above its target by the lift.
  const arms = ([
    { side: "left", sign: -1, voice: 1, target: SNARE, bend: "down" as Bend },
    { side: "right", sign: 1, voice: 2, target: CYMBAL, bend: "down" as Bend },
  ] as const).map((arm) => {
    const shoulder = { x: SHOULDER.x * arm.sign, y: SHOULDER.y, z: SHOULDER.z }
    const raised = lift(arm.voice) * SWING
    const tip = { x: arm.target.x, y: arm.target.y + 5 + raised, z: arm.target.z }
    const chain = solvePlanarArm(shoulder, tip, UPPER, FORE, arm.bend)
    return { ...arm, shoulder, tip, raised, elbow: chain.elbow, hand: chain.hand }
  })

  // The pedal beater swings back with the lift and comes down on the head.
  const pedal = toRadians(lift(0) * PEDAL_SWING)
  const pedalPivot = { x: 0, y: 5, z: KICK.z - KICK.depth - 12 }
  const beaterTip = {
    x: 0,
    y: pedalPivot.y + Math.cos(pedal) * 22,
    z: pedalPivot.z + Math.sin(pedal) * 22,
  }
  // The head drops on the kick and comes back up: the machine keeps time.
  const nod = ring(0) * 3.4
  const bob = ring(0) * 1.6

  const groundY = 0
  const reading = `${steps ? step + 1 : 0}/${steps}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Busker droid, ${VOICES.length} voices, step ${reading}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 1 : undefined}
      aria-valuemax={interactive ? Math.max(1, steps) : undefined}
      aria-valuenow={interactive ? step + 1 : undefined}
      aria-valuetext={interactive ? `step ${reading}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 1, 4)
        if (delta !== 0) apply(Math.round(position) + delta)
        else if (event.key === "Home") apply(0)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={px((width * VIEW_H) / VIEW_W)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d={`M 8 ${px(origin.y)} H ${VIEW_W - 8}`} strokeDasharray="2 3" />
          <path d={`M ${px(origin.x)} 10 V ${VIEW_H - 24}`} strokeDasharray="2 3" />
        </g>
      )}

      <g data-view={view} transform={`translate(${px(origin.x)} ${px(origin.y)}) scale(${px(fit)})`}>
        {showGround && (
          <ellipse
            cx={px(project({ x: 0, y: groundY, z: 0 }).x)}
            cy={px(project({ x: 0, y: groundY, z: 0 }).y)}
            rx={46}
            ry={px(6 + 34 * camera.flatten)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-frame transform={`translate(0 ${px(bob)})`}>
          {/* Legs: the right foot works the pedal, the left one stands. */}
          {[-1, 1].map((sign) => (
            <path
              key={sign}
              data-leg={sign < 0 ? "left" : "right"}
              d={capsulePath(
                flat(project({ x: 9 * sign, y: HIP_Y, z: STAND_Z })),
                flat(project({ x: 12 * sign, y: 5, z: STAND_Z + (sign > 0 ? -8 : 2) })),
                4,
              )}
              {...machined}
            />
          ))}
          <path
            data-torso
            d={extrudedPath(
              roundedFootprint(12, 8, 4, 4).map((point) => ({ x: point.x, y: point.y + STAND_Z })),
              camera,
              SHOULDER.y + 4,
              HIP_Y - 4,
            )}
            {...shell}
          />
          <path
            data-waist
            d={extrudedPath(
              roundedFootprint(9, 6, 3, 3).map((point) => ({ x: point.x, y: point.y + STAND_Z })),
              camera,
              HIP_Y + 2,
              HIP_Y - 6,
            )}
            {...cast}
          />

          <g data-head data-nod={px(nod)}>
            <path
              d={capsulePath(
                flat(project({ x: 0, y: SHOULDER.y + 3, z: STAND_Z })),
                flat(project({ x: 0, y: HEAD_Y - 8 + nod, z: STAND_Z })),
                3.2,
              )}
              {...machined}
            />
            <path
              d={extrudedPath(
                roundedFootprint(9, 7, 4, 4).map((point) => ({ x: point.x, y: point.y + STAND_Z })),
                camera,
                HEAD_Y + 7 + nod,
                HEAD_Y - 7 + nod,
              )}
              {...shell}
            />
            {/* One lamp bar, lit on the beat. */}
            <path
              data-lamp
              d={capsulePath(
                flat(project({ x: -5, y: HEAD_Y + 1 + nod, z: STAND_Z - 7 })),
                flat(project({ x: 5, y: HEAD_Y + 1 + nod, z: STAND_Z - 7 })),
                1.8,
              )}
              fill={ring(2) > 0.3 ? palette.accent : palette.metal}
              opacity={ring(2) > 0.3 ? 1 : 0.7}
            />
          </g>

          {arms.map((arm) => (
            <g key={arm.side} data-arm={arm.side} data-lift={px(arm.raised)}>
              <path
                d={capsulePath(flat(project(arm.shoulder)), flat(project(arm.elbow)), 3.4)}
                {...shell}
              />
              <path
                d={capsulePath(flat(project(arm.elbow)), flat(project(arm.hand)), 2.8)}
                {...machined}
              />
              <circle
                data-joint={`${arm.side}-elbow`}
                cx={px(project(arm.elbow).x)}
                cy={px(project(arm.elbow).y)}
                r={3}
                {...cast}
              />
              <circle
                cx={px(project(arm.shoulder).x)}
                cy={px(project(arm.shoulder).y)}
                r={3.6}
                {...cast}
              />
              {/* The stick: hand to the head it is about to hit. */}
              <path
                data-beater={arm.voice === 1 ? "snare" : "cymbal"}
                d={capsulePath(
                  flat(project(arm.hand)),
                  flat(project({ x: arm.target.x, y: arm.target.y + arm.raised, z: arm.target.z })),
                  1.3,
                )}
                {...cast}
              />
            </g>
          ))}
        </g>

        {/* The kit. The kick lies on its side; the snare stands on a post. */}
        <g data-kit>
          <path
            d={capsulePath(
              flat(project({ x: SNARE.x, y: SNARE.y - SNARE.radius, z: SNARE.z })),
              flat(project({ x: SNARE.x, y: 2, z: SNARE.z })),
              2,
            )}
            {...machined}
          />
          <path
            d={capsulePath(
              flat(project({ x: CYMBAL.x, y: CYMBAL.y, z: CYMBAL.z })),
              flat(project({ x: CYMBAL.x, y: 2, z: CYMBAL.z })),
              1.6,
            )}
            {...machined}
          />

          <g data-drum="kick">
            <path
              d={slabPath(
                [
                  ...axisRing({ ...KICK, z: KICK.z - KICK.depth }, KICK.radius, "z"),
                  ...axisRing({ ...KICK, z: KICK.z + KICK.depth }, KICK.radius, "z"),
                ],
                camera,
              )}
              {...shell}
            />
            <path
              d={slabPath(axisRing({ ...KICK, z: KICK.z - KICK.depth }, KICK.radius, "z"), camera)}
              {...machined}
            />
            <path
              d={slabPath(
                axisRing({ ...KICK, z: KICK.z - KICK.depth - 0.4 }, KICK.radius * 0.42, "z"),
                camera,
              )}
              {...cast}
            />
            {/* The hoop round the head, with its tension lugs. */}
            {Array.from({ length: 8 }, (_, index) => {
              const angle = (index / 8) * Math.PI * 2
              const at = {
                x: KICK.x + Math.cos(angle) * (KICK.radius - 2),
                y: KICK.y + Math.sin(angle) * (KICK.radius - 2),
                z: KICK.z - KICK.depth - 0.6,
              }
              return (
                <circle
                  key={index}
                  cx={px(project(at).x)}
                  cy={px(project(at).y)}
                  r={1.2}
                  fill={palette.dark}
                  opacity={0.6}
                />
              )
            })}
          </g>

          <g data-drum="snare">
            <path
              d={extrudedPath(
                circleFootprint(SNARE.x, SNARE.z, SNARE.radius, 14),
                camera,
                SNARE.y + 6,
                SNARE.y - 6,
              )}
              {...shell}
            />
            <path
              d={slabPath(axisRing({ ...SNARE, y: SNARE.y + 6 }, SNARE.radius, "y"), camera)}
              {...machined}
            />
          </g>

          <g data-cymbal>
            <path d={slabPath(axisRing(CYMBAL, CYMBAL.radius, "y", CYMBAL.tilt), camera)} {...machined} />
            <path
              d={slabPath(axisRing(CYMBAL, CYMBAL.radius * 0.62, "y", CYMBAL.tilt), camera)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.5}
              opacity={0.45}
            />
            {/* The bell, which is what says cymbal rather than plate. */}
            <path
              d={slabPath(
                axisRing({ ...CYMBAL, y: CYMBAL.y + 3 }, CYMBAL.radius * 0.26, "y", CYMBAL.tilt),
                camera,
              )}
              {...cast}
            />
          </g>
        </g>

        <g data-pedal data-swing={px((pedal * 180) / Math.PI)}>
          <path
            d={capsulePath(
              flat(project(pedalPivot)),
              flat(project({ x: 0, y: 2, z: pedalPivot.z - 14 })),
              3,
            )}
            {...cast}
          />
          <path
            d={capsulePath(flat(project(pedalPivot)), flat(project(beaterTip)), 1.6)}
            {...machined}
          />
          <circle cx={px(project(beaterTip).x)} cy={px(project(beaterTip).y)} r={3.2} {...cast} />
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_W / 2} y={VIEW_H - 10} fontSize={5}>
          {`STEP ${reading} · ${VOICES.join(" ").toUpperCase()}`}
        </text>
        {label && (
          <text x={VIEW_W / 2} y={VIEW_H - 3} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const flat = (point: Vec2): Vec2 => ({ x: px(point.x), y: px(point.y) })

/**
 * A two-link arm solved in the vertical plane that contains its shoulder and
 * its target, which is the plane the arm actually swings in. Out of reach, the
 * solver clamps: the arm straightens rather than stretching.
 */
function solvePlanarArm(
  shoulder: Vec3,
  target: Vec3,
  upper: number,
  fore: number,
  bend: Bend,
): { elbow: Vec3; hand: Vec3 } {
  const dx = target.x - shoulder.x
  const dz = target.z - shoulder.z
  const run = Math.hypot(dx, dz)
  const ux = run > 1e-6 ? dx / run : 0
  const uz = run > 1e-6 ? dz / run : 0
  const elbow2 = solveElbow2({ x: 0, y: shoulder.y }, { x: run, y: target.y }, upper, fore, bend)
  const restore = (point: Vec2): Vec3 => ({
    x: shoulder.x + ux * point.x,
    y: point.y,
    z: shoulder.z + uz * point.x,
  })
  return { elbow: restore(elbow2), hand: restore({ x: run, y: target.y }) }
}

/** A ring of points square to one world axis, optionally tipped about z. */
function axisRing(
  centre: Vec3,
  radius: number,
  axis: "y" | "z",
  tilt = 0,
  steps = 16,
): Vec3[] {
  const lean = toRadians(tilt)
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const a = Math.cos(angle) * radius
    const b = Math.sin(angle) * radius
    if (axis === "z") return { x: centre.x + a, y: centre.y + b, z: centre.z }
    // A horizontal disc, tipped about its own z axis: the cymbal's lean.
    return {
      x: centre.x + a * Math.cos(lean),
      y: centre.y + a * Math.sin(lean),
      z: centre.z + b,
    }
  })
}

/**
 * Position through the pattern at `clock`, in steps. `groove` plays it once a
 * cycle; `fill` runs it at double time. Both are unwrapped, so the beaters
 * never jump backwards through a bar.
 */
export function buskerGoal(behavior: BuskerBehavior, clock: number, steps: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const span = Number.isFinite(steps) ? Math.max(0, steps) : 0
  return clock * span * (behavior === "fill" ? 2 : 1)
}

export { BuskerDroid }
