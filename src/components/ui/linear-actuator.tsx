"use client"

/**
 * linear-actuator — a cylinder that strokes.
 *
 * Left alone it runs its own duty cycle: extend, dwell at full, retract,
 * dwell. Give it `extension` and it is a readout instead. Turn on
 * `interactive` and the rod becomes a handle — drag it along its stroke, and
 * let go to watch it ease back into the cycle.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { aboutPoint, capsulePath, extrudedPath, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, roundedFootprint, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 180
/** Where the rod eye sits retracted, and how far it travels. */
const ROD_HOME = 115
const ROD_TRAVEL = 48
/** Stroke fractions per second while easing back from a grab. */
const RETURN_RATE = 3
/** The cylinder is drawn from the side; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** The machine's own origin in the frame: the axis of the barrel. */
const CENTRE = 66
const DATUM = 45

/** How far the camera pulls back so the machine still fits a frame that
 *  was drawn for one view. One in the view it was drawn in. */
const fits: Record<RobotView, number> = { plan: 0.52, front: 0.95, profile: 1, iso: 0.76 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}


export type ActuatorBehavior = "cycle" | "breathe" | "static"

export interface LinearActuatorProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled stroke, 0 retracted to 1 extended. Omit to run `behavior`. */
  extension?: number
  /** What the cylinder does when `extension` is not supplied. */
  behavior?: ActuatorBehavior
  /** Where the camera stands. One cylinder, four projections. */
  view?: RobotView
  /** Duty cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a bank of cylinders breaks step. */
  phase?: number
  /** Drag the rod, or arrow-key it. Reports through `onExtensionChange`. */
  interactive?: boolean
  onExtensionChange?: (extension: number) => void
  /** Reveal the piston through the cylinder wall. */
  cutaway?: boolean
  showRuler?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function LinearActuator({
  extension, behavior = "cycle", view = NATIVE_VIEW, speed = 0.32, animate = true, paused = false, phase = 0,
  interactive = false, onExtensionChange,
  cutaway = false, showRuler = true, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  role, tabIndex, onKeyDown, onBlur, ...props
}: LinearActuatorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = extension !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled
    ? (Number.isFinite(extension) ? clamp(extension, 0, 1) : 0)
    : held
  const goal = React.useCallback(
    (clock: number) => strokeGoal(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: RETURN_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const value = clamp(motion.value, 0, 1)
  const travel = px(value * ROD_TRAVEL)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onExtensionChange?.(bounded)
    },
    [onExtensionChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit) => apply((unit.x * VIEW_WIDTH - ROD_HOME) / ROD_TRAVEL),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const percent = Math.round(value * 100)

  // The drawing is a side elevation, so it goes through `wall` where it
  // already stands and comes out untouched from the side. A cylinder is round
  // in section, which only reads once the camera comes off that axis: the
  // barrel, the rod and the end flanges are tubes down the machine's axis.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, DATUM, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const rise = (y: number) => DATUM - y
  const at = (x: number, y: number, across = 0) =>
    camera.project(across, rise(y), CENTRE - x)
  /** A tube down the machine's axis, from frame x `x0` to `x1`. */
  const tube = (x0: number, x1: number, y: number, radius: number) =>
    capsulePath(at(x0, y), at(x1, y), radius)
  /** A block, `wide` either side of the centre plane. */
  const slab = (x0: number, x1: number, wide: number, top: number, bottom: number) =>
    extrudedPath(
      roundedFootprint(wide, Math.abs(x1 - x0) / 2, 1, 4).map((point) => ({
        x: point.x,
        y: point.y + CENTRE - (x0 + x1) / 2,
      })),
      camera,
      rise(top),
      rise(bottom),
    )

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Linear actuator, ${percent}% extended, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent}% extended` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        // Tab away and the cylinder goes back to work.
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 180 100" width={width} height={width * 100 / 180}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} data-view={view} {...props}>
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${DATUM}) scale(${fit})`}>
        <path d={tube(16, 28, 45, 7)} {...machined} />
        <path d={tube(28, 104, 45, 17)} {...shell} />
        {[30, 101].map(x => <path key={x} d={tube(x - 4, x + 4, 45, 20)} {...cast} />)}
        {[40, 88].map(x => <path key={x} d={slab(x - 3, x + 3, 3, 17, 28)} {...machined} />)}
        <path d={tube(42 + travel, 115 + travel, 45, 3)} {...machined} />
        <path d={tube(106 + travel, 118 + travel, 45, 7)} {...shell} />
      </g>}
      <Frame {...frame}>
      <g data-rod transform={`translate(${travel} 0)`}>
        <rect x={42} y={42} width={66} height={6} rx={1} {...machined} />
        <path d="M 106 38 H 115 A 7 7 0 0 1 115 52 H 106 Z" {...shell} />
        <circle cx={115} cy={45} r={3.2} {...cast} />
      </g>
      <g data-housing>
        <path d="M 28 38 H 16 A 7 7 0 0 0 16 52 H 28 Z" {...machined} />
        <circle cx={16} cy={45} r={3.2} {...cast} />
        <rect x={28} y={28} width={76} height={34} rx={4} {...shell} fillOpacity={cutaway ? 0.12 : shell.fillOpacity} />
        <rect x={26} y={25} width={8} height={40} rx={2} {...cast} />
        <rect x={97} y={25} width={8} height={40} rx={2} {...cast} />
        {[30, 60].map(y => <g key={y}>
          <path d={`M 30 ${y} H 101`} stroke={palette.metal} strokeWidth={1.5} />
          {[30, 101].map(x => <circle key={x} cx={x} cy={y} r={1.8} fill={palette.metal} />)}
        </g>)}
        {[40, 88].map(x => <g key={x}>
          <rect x={x - 3} y={20} width={6} height={8} rx={1} {...machined} />
          <rect x={x - 2} y={17} width={4} height={4} rx={1} {...cast} />
        </g>)}
      </g>
      {cutaway && <g data-piston transform={`translate(${travel} 0)`}>
        <rect x={38} y={32} width={8} height={26} rx={1} {...machined} />
        <path d="M 40 32 V 58 M 44 32 V 58" stroke={palette.dark} strokeWidth={1} />
      </g>}
      {showRuler && <g stroke={palette.grid} strokeWidth={0.5} fill={palette.foreground}>
        <path d="M 115 69 v 8 m 0 -4 h 48 m 0 -4 v 8" />
        {[0, 12, 24, 36, 48].map(x => <path key={x} d={`M ${115 + x} 73 v 3`} />)}
        <path d={`M ${115 + travel - 2} 68 l 2 3 2 -3 Z`} fill={palette.accent} stroke="none" />
        <text x={139} y={85} stroke="none" textAnchor="middle" fontSize={4} fontFamily="ui-monospace, monospace">{percent}% STROKE</text>
      </g>}
      </Frame>
      {label && <text x={90} y={97} textAnchor="middle" fontSize={4.5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

/** Fold a running clock into one cycle. */
const cycleOf = (clock: number) => (Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0)

/** Smoothstep, so each leg of the stroke starts and stops like a cylinder. */
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * Where the rod should be at `clock`. The duty cycle is the shape a real
 * cylinder draws: a stroke out, a dwell at the end of travel, a stroke back,
 * and a dwell before it goes again.
 */
export function strokeGoal(behavior: ActuatorBehavior, clock: number) {
  if (behavior === "static") return 0.5
  const t = cycleOf(clock)
  if (behavior === "breathe") return 0.5 - Math.cos(t * Math.PI * 2) * 0.5
  if (t < 0.35) return ease(t / 0.35)
  if (t < 0.5) return 1
  if (t < 0.85) return 1 - ease((t - 0.5) / 0.35)
  return 0
}

export { LinearActuator }
