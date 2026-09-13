"use client"

/**
 * spring-hopper — a single-legged hopping rig on a real spring.
 *
 * The set jumps (`robot-frog`) but nothing in it bounces: a jump is a scripted
 * arc, and a bounce is a contact. Here the ground is part of the mechanism.
 * Flight is a parabola and stance is a mass on a linear spring, and `solveHop`
 * in `@/lib/robocn/hopper` decides which one the machine is in — including how
 * long each lasts, which is a consequence of the drop height and the spring
 * rate rather than a duty knob.
 *
 * The spring is drawn as a spring: a sampled helix whose coil count and radius
 * never change, because a real one compresses by twisting its wire. It cannot
 * pass through its own solid height, and when it lands there the machine stops
 * sinking — which you can reach from the demo by softening it under a full-
 * height drop.
 *
 * Solved: the bounce, the stroke, and the coil pitch. Illustrated: the leg
 * swing and the reaction wheel that answers it — a free machine really does
 * turn a wheel against its limb to aim the next landing, but the ratio here is
 * drawn, not an inertia model. Nothing travels across the frame.
 *
 * Design note: docs/bouncing-machines.md
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  hopTimings,
  solveHop,
  springCoils,
  type HopState,
} from "@/lib/robocn/hopper"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  elevationDraft,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotSurface,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type SpringHopperBehavior = "hop" | "bound" | "pump" | "static"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 250
/** Drawn from the side: a hopper leans to steer, and lean reads in profile. */
const NATIVE_VIEW: RobotView = "profile"

/** Drawing units per hop unit. One hop unit is the machine's own apex scale. */
const HOP_SCALE = 70
/** The leg at rest: pad, free spring, then the gimbal pin above it. */
const PAD_THICK = 9
const SPRING_FREE = 56
const HIP_RISE = 14
const BODY_RISE = 16
const COILS = 6
const COIL_RADIUS = 9
const WIRE = 2.4
/** How far the leg swings in the air at full amplitude, in degrees. */
const SWING = 17
/** The reaction wheel turns much further than the limb it answers. */
const WHEEL_GEAR = -7

/** The box the machine moves inside, so the framing cannot breathe as it hops. */
const ENVELOPE = boxCorners(
  { x: -24, y: 0, z: -46 },
  { x: 24, y: HIP_RISE + SPRING_FREE + PAD_THICK + BODY_RISE + 46 + HOP_SCALE, z: 46 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface SpringHopperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One rig, four projections. */
  view?: RobotView
  /** What it does when `compression` is not supplied. */
  behavior?: SpringHopperBehavior
  /**
   * Controlled spring load, 0 free to 1 at the deepest this machine goes.
   * Supplying it stops the loop and plants the machine: you cannot drive it
   * into the air, because on the ground is the only place a spring is loaded.
   */
  compression?: number
  onCompressionChange?: (compression: number) => void
  /** Apex of the hop in hop units, 0–1. */
  height?: number
  /** Spring rate in weights per hop unit, 4–400. Sets the contact time. */
  stiffness?: number
  /** Hops per second. */
  speed?: number
  /** Seconds of offset, so a row of them breaks step. */
  phase?: number
  animate?: boolean
  paused?: boolean
  /** Drag down to load the spring; let go and it hops. */
  interactive?: boolean
  /** Mast lamp: neutral, accent, or shell. */
  signal?: "idle" | "ready" | "warning"
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  label?: string
}

const finiteClamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback

/** A stroke the same colour as the part, through whatever the variant paints. */
const strokeOf = (surface: RobotSurface) =>
  surface.fill === "none" ? surface.stroke : surface.fill

/** Turn a leg point about the hip. Rotating in drawing units, before the camera. */
const swung = (point: Vec2, hip: Vec2, degrees: number): Vec2 => {
  if (degrees === 0) return point
  const angle = toRadians(degrees)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - hip.x
  const dy = point.y - hip.y
  return { x: hip.x + dx * cos - dy * sin, y: hip.y + dx * sin + dy * cos }
}

function SpringHopper({
  view = NATIVE_VIEW,
  behavior = "hop",
  compression,
  onCompressionChange,
  height = 0.5,
  stiffness = 40,
  speed = 0.8,
  phase = 0,
  animate = true,
  paused = false,
  interactive = false,
  signal = "ready",
  size = "md",
  variant = "solid",
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
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: SpringHopperProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const controlled = compression !== undefined
  const [held, setHeld] = React.useState<number | null>(null)

  const apex = finiteClamp(height, 0, 1, 0.5)
  const rate = finiteClamp(stiffness, 4, 400, 40)
  const load = controlled ? finiteClamp(compression, 0, 1, 0) : held

  // One scalar: how much of the drawing the person's hand owns. Pinned at 1
  // while they hold it, eased back to 0 on release while the clock runs on
  // underneath — which is what makes letting go read as a machine resuming.
  const motion = useRobotScalar(RELEASED, {
    rate: 2.4,
    hold: load === null ? null : 1,
    speed,
    phase,
    paused,
    animate: animate && !controlled,
  })
  const grip = clamp(motion.value, 0, 1)

  const scripted = springHopperPose(behavior, motion.clock, { height: apex, stiffness: rate })
  const pose = grip > 0 ? blend(scripted, stanceAt(load ?? 0, apex, rate), grip) : scripted

  const apply = React.useCallback(
    (next: number) => {
      // Rounded: this is a reported value, and 0.25000000000000006 is noise.
      const bounded = Math.round(clamp(Number.isFinite(next) ? next : 0, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onCompressionChange?.(bounded)
    },
    [onCompressionChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Down the frame loads the spring: the gesture a person tries on one.
    onDrag: React.useCallback((unit: Vec2) => apply((unit.y - 0.3) / 0.5), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const timings = hopTimings({ height: apex, stiffness: rate })
  const swing = springHopperSwing(behavior, pose) * (1 - grip)
  const rise = Math.max(0, pose.altitude) * HOP_SCALE
  const coil = springCoils({
    length: SPRING_FREE - pose.compression * HOP_SCALE,
    turns: COILS,
    radius: COIL_RADIUS,
    wire: WIRE,
  })

  const hip: Vec2 = { x: 0, y: PAD_THICK + coil.length + HIP_RISE + rise }
  const bodyY = hip.y + BODY_RISE
  const springTop: Vec2 = { x: 0, y: hip.y - HIP_RISE }
  const springBottom: Vec2 = { x: 0, y: springTop.y - coil.length }
  const padTop = springBottom.y
  const leg = (point: Vec2) => swung(point, hip, swing)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lamp = signal === "warning" ? palette.shell : signal === "idle" ? palette.metal : palette.accent

  // The helix runs up the leg's own axis, so it is built along y and then swung.
  const coilPoints = coil.points.map((point) =>
    leg({ x: point.x, y: springBottom.y + point.y }),
  )
  const pad = [
    { x: -19, y: padTop },
    { x: 19, y: padTop },
    { x: 15, y: padTop - PAD_THICK },
    { x: -15, y: padTop - PAD_THICK },
  ].map(leg)

  // Reaction wheel: the spokes are what make the turn visible at all.
  const wheelCentre: Vec2 = { x: 17, y: bodyY + 2 }
  const wheelAngle = swing * WHEEL_GEAR + motion.clock * 24
  const spokes = Array.from({ length: 3 }, (_, index) => {
    const turn = wheelAngle + index * 60
    const a = swung({ x: wheelCentre.x + 8, y: wheelCentre.y }, wheelCentre, turn)
    const b = swung({ x: wheelCentre.x - 8, y: wheelCentre.y }, wheelCentre, turn)
    return line([a, b], 9)
  }).join(" ")

  const readout = Math.round((grip > 0 ? (load ?? 0) : pose.squeeze) * 100)
  const state = pose.contact ? "stance" : "flight"
  const shadow = 1 - Math.min(0.55, (rise / HOP_SCALE) * 0.9)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Spring hopper, ${state}, spring ${readout} percent loaded, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `spring ${readout} percent loaded` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply((load ?? pose.squeeze) + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
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
      <g data-hopper data-view={view} data-contact={state} transform={frame || undefined}>
        {showGround && (
          <g data-ground>
            <path
              d={solid([{ x: -30 * shadow, y: 0 }, { x: 30 * shadow, y: 0 }], 20 * shadow)}
              fill={palette.dark}
              opacity={px(0.18 * shadow)}
            />
            {/* A horizon from any tilted camera; straight down it parts around
                the machine rather than running through it. */}
            <path
              d={
                camera.lift > 0.02
                  ? line([{ x: -46, y: 0 }, { x: 46, y: 0 }])
                  : `${line([{ x: -46, y: 0 }, { x: -26, y: 0 }])} ${line([{ x: 26, y: 0 }, { x: 46, y: 0 }])}`
              }
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.9}
            />
          </g>
        )}

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.5} strokeDasharray="3 4">
            {/* The two lengths that bound the stroke: free, and solid. */}
            <path d={line([{ x: -34, y: PAD_THICK + SPRING_FREE }, { x: 34, y: PAD_THICK + SPRING_FREE }])} />
            <path d={line([{ x: -26, y: PAD_THICK + coil.solid }, { x: 26, y: PAD_THICK + coil.solid }])} />
            <path d={line([{ x: 0, y: 0 }, { x: 0, y: ENVELOPE[1].y }])} />
          </g>
        )}

        {/* Leg: pad, spring and shaft, all hung off the hip and swung with it. */}
        <g data-hip data-swing={px(swing)}>
          <path data-shaft d={bar(leg({ x: 0, y: hip.y }), leg({ x: 0, y: padTop + 4 }), 3.6, 3.6)} {...machined} />
          <path
            data-spring
            data-bottomed={coil.bottomedOut ? "true" : "false"}
            d={line(coilPoints, 0)}
            fill="none"
            stroke={strokeOf(machined)}
            strokeWidth={WIRE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Spring seats: the cups the coil actually pushes against. */}
          <path d={bar(leg({ x: -12, y: springTop.y }), leg({ x: 12, y: springTop.y }), 2.4, 11)} {...cast} />
          <path d={bar(leg({ x: -13, y: springBottom.y }), leg({ x: 13, y: springBottom.y }), 2.6, 12)} {...cast} />
          <path data-foot d={solid(pad, 13)} {...cast} />
          <path d={line([pad[3], pad[2]], 13)} fill="none" stroke={palette.metal} strokeWidth={1.2} opacity={0.7} />
        </g>

        {/* Hip gimbal: the pin the leg swings about, and the only bearing here. */}
        <path d={disc(hip, 6.5, 14)} {...cast} />
        <path d={disc(hip, 2.6, 15)} {...machined} />

        <g data-body data-height={px(bodyY)}>
          <path d={box(-31, bodyY - 12, 31, bodyY + 14, 16)} {...shell} />
          {/* Guide sleeve: the shaft slides into this, which is the stroke. */}
          <path d={box(-7, bodyY - 17, 7, bodyY - 4, 8)} {...machined} />
          <path d={line([{ x: -24, y: bodyY + 6 }, { x: 24, y: bodyY + 6 }], 16)} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.45} />
          {/* Grille: three slots, and the bolts that hold the deck down. */}
          {[-14, -6, 2].map((x) => (
            <path key={x} d={line([{ x, y: bodyY - 6 }, { x, y: bodyY + 2 }], 17)} fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.5} />
          ))}
          {[-26, 26].map((x) => (
            <path key={x} d={disc({ x, y: bodyY + 11 }, 1.8, 17)} {...machined} />
          ))}
          <path d={box(-18, bodyY + 14, 18, bodyY + 19, 13)} {...machined} />

          <g data-gyro-hub>
            <path d={disc(wheelCentre, 10, 8)} {...machined} />
            <path d={disc(wheelCentre, 3, 10)} {...cast} />
            <path
              data-gyro
              data-angle={px(wheelAngle)}
              d={spokes}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.3}
              opacity={0.75}
            />
          </g>

          <g data-mast>
            <path d={bar({ x: -20, y: bodyY + 19 }, { x: -20, y: bodyY + 38 }, 1.8, 1.8)} {...machined} />
            <path d={disc({ x: -20, y: bodyY + 40 }, 3.4, 3.4)} fill={lamp} stroke="none" />
            <path d={disc({ x: -20, y: bodyY + 40 }, 5.6, 3.4)} fill={palette.glow} opacity={0.35} stroke="none" />
          </g>
        </g>
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 8}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
          {variant === "blueprint" ? ` · duty ${Math.round(timings.duty * 100)}%` : ""}
        </text>
      )}
    </svg>
  )
}

/** Nothing held: the goal the released value eases back to. */
const RELEASED = () => 0

/** Sat on the ground with the spring loaded to `fraction` of its deepest. */
function stanceAt(fraction: number, height: number, stiffness: number): HopState {
  const squeeze = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1)
  const depth = hopTimings({ height, stiffness }).depth
  const compression = squeeze * depth
  return {
    altitude: -compression,
    compression,
    squeeze,
    contact: true,
    velocity: 0,
    load: stiffness * compression,
    bounce: 0,
    resting: false,
  }
}

/** Hand-held pose over behaviour, by however much of it the hand still owns. */
function blend(free: HopState, gripped: HopState, amount: number): HopState {
  const mix = (a: number, b: number) => a + (b - a) * amount
  return {
    altitude: mix(free.altitude, gripped.altitude),
    compression: mix(free.compression, gripped.compression),
    squeeze: mix(free.squeeze, gripped.squeeze),
    contact: amount > 0.5 ? gripped.contact : free.contact,
    velocity: mix(free.velocity, gripped.velocity),
    load: mix(free.load, gripped.load),
    bounce: free.bounce,
    resting: false,
  }
}

/**
 * What the machine does with no hand on it — a pure function of the clock in
 * cycles. `hop` and `bound` are the solved bounce at two drop heights; `pump`
 * never leaves the ground, which is what a person on a pogo stick does before
 * they commit.
 */
export function springHopperPose(
  behavior: SpringHopperBehavior,
  clock: number,
  { height = 0.5, stiffness = 40 }: { height?: number; stiffness?: number } = {},
): HopState {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "bound":
      return solveHop({ phase: time, height: Math.min(1, height * 1.5), stiffness })
    case "pump": {
      const depth = hopTimings({ height, stiffness }).depth
      const cycle = ((time % 1) + 1) % 1
      const squeeze = 0.75 * (1 - Math.cos(2 * Math.PI * cycle)) * 0.5
      const compression = squeeze * depth
      return {
        altitude: -compression,
        compression,
        squeeze,
        contact: true,
        velocity: -0.75 * depth * Math.PI * Math.sin(2 * Math.PI * cycle),
        load: stiffness * compression,
        bounce: 0,
        resting: false,
      }
    }
    case "static": {
      const sag = 1 / stiffness
      const depth = hopTimings({ height, stiffness }).depth
      return {
        altitude: -sag,
        compression: sag,
        squeeze: depth > 0 ? sag / depth : 0,
        contact: true,
        velocity: 0,
        load: 1,
        bounce: 0,
        resting: true,
      }
    }
    default:
      return solveHop({ phase: time, height, stiffness })
  }
}

/**
 * Leg swing, in degrees, forward positive. It is the vertical velocity: the
 * leg trails as the machine rises and reaches out before it lands, and it is
 * pinned at zero on the ground because a planted foot does not move.
 */
export function springHopperSwing(behavior: SpringHopperBehavior, pose: HopState): number {
  if (pose.contact || !Number.isFinite(pose.velocity)) return 0
  const amplitude = behavior === "bound" ? 1 : behavior === "hop" ? 0.45 : 0
  return clamp(pose.velocity * 12, -SWING, SWING) * amplitude
}

export { SpringHopper }
