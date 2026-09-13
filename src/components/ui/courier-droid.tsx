"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type CourierDroidCargo = "none" | "pod" | "crate" | "tools"
export type CourierDroidBehavior = "deliver" | "patrol" | "pointer" | "static"

/** The droid is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** Heights the plan view never had to name. */
const WHEEL_RADIUS = 17
const HALF_TRACK = 10
const BODY_FLOOR = 10
const BODY_TOP = 40
const CARGO_TOP = 62

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface CourierDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Clockwise heading in degrees. Omit and `behavior` drives it. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  heading?: number
  /** Front-wheel steering, −45..45 degrees. Omit and it steers into its own turns. */
  steering?: number
  /** Wheel travel in turns. Omit and the wheels roll as it drives. */
  travel?: number
  /** What it does when nobody is driving: a delivery run, a beat, or you. */
  behavior?: CourierDroidBehavior
  /** Legs of the route per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** It comes round to face the pointer. */
  interactive?: boolean
  cargo?: CourierDroidCargo
  antenna?: "whip" | "dish" | "none"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function CourierDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  heading,
  steering,
  travel,
  behavior = "deliver",
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  cargo = "none",
  antenna = "whip",
  signal = "ready",
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
  ...props
}: CourierDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  const pointer = usePointerTarget(svgRef, {
    enabled: (interactive || behavior === "pointer") && heading === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const bearing = pointer.target
    ? (Math.atan2(pointer.target.x, -pointer.target.y) * 180) / Math.PI
    : null
  const scripted = courierDroidPose(behavior, clock, bearing)
  const turn = finite(heading ?? scripted.heading)
  // Steering is the turn it is part-way through, not a second animation.
  const steer = finiteClamp(steering ?? scripted.steer, -45, 45)
  const tread = wrap(travel ?? scripted.travel)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  const clipId = `courier-${React.useId().replace(/:/g, "")}`

  // The drawing is the ground plane the droid runs on, so it goes through
  // `plane` and comes out untouched from above — heading included. The wheels
  // are cylinders and the body a box, neither of which plan view ever had.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const ground = camera.plane(0, turn)
  const spin = toRadians(turn)
  const cos = Math.cos(spin)
  const sin = Math.sin(spin)
  const at = (x: number, z: number, y: number) =>
    camera.project(x * cos - z * sin, y, x * sin + z * cos)
  const solid = (footprint: Vec2[], top: number, bottom: number) =>
    extrudedPath(footprint, camera, top, bottom, turn)

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Courier droid, heading ${Math.round(((turn % 360) + 360) % 360)} degrees, ${viewNames[view] ?? viewNames.plan}`}
      viewBox="0 0 210 170"
      width={width}
      height={px(width * 0.81)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <defs><clipPath id={clipId}><rect x={-10} y={-17} width={20} height={34} rx={5} /></clipPath></defs>
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 16 145 H 194 M 105 12 V 151" strokeDasharray="2 3" />
          <circle cx={105} cy={87} r={70} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={105} cy={138} rx={70} ry={7} fill={palette.dark} opacity={0.14} />}
      {offAxis && <g data-solids transform="translate(105 91)">
        {[-1, 1].flatMap((side) => [-1, 1].map((axle) => (
          <path
            key={`${side}-${axle}`}
            d={capsulePath(
              at(side * 48 - HALF_TRACK, axle * 28, WHEEL_RADIUS),
              at(side * 48 + HALF_TRACK, axle * 28, WHEEL_RADIUS),
              WHEEL_RADIUS,
            )}
            {...cast}
          />
        )))}
        <path d={solid(roundedFootprint(47, 48, 13, 5), BODY_TOP, BODY_FLOOR)} {...shell} />
        <path d={solid(roundedFootprint(29, 11, 5, 4).map(p => ({ x: p.x, y: p.y - 7 })), BODY_TOP + 6, BODY_TOP)} {...cast} />
        {cargo !== "none" && (
          <path d={solid(roundedFootprint(24, 20, 4, 4).map(p => ({ x: p.x, y: p.y + 9 })), CARGO_TOP, BODY_TOP)} {...shell} />
        )}
        {antenna !== "none" && (
          <path d={capsulePath(at(31, -40, BODY_TOP), at(31, -40, CARGO_TOP + 14), 1.6)} stroke="none" fill={palette.dark} />
        )}
      </g>}
      <g data-chassis data-view={view} transform={`translate(105 91) ${ground}`}>
        {[-1, 1].flatMap((side) => [-1, 1].map((axle) => {
          const front = axle < 0
          const x = side * 48
          const y = axle * 28
          const wheelTurn = front ? steer : 0
          return (
            <g
              key={`${side}-${axle}`}
              data-wheel={front && side > 0 ? "front" : `${front ? "front" : "rear"}-${side < 0 ? "left" : "right"}`}
              transform={`translate(${x} ${y}) rotate(${px(wheelTurn)})`}
            >
              <rect x={-10} y={-17} width={20} height={34} rx={5} {...cast} />
              <g clipPath={`url(#${clipId})`} transform={`translate(0 ${px(tread * 7)})`} stroke={palette.metal} strokeWidth={1.3}>
                {[-21, -14, -7, 0, 7, 14, 21].map((offset) => <path key={offset} d={`M -8 ${offset} H 8`} />)}
              </g>
            </g>
          )
        }))}
        <path d="M -47 -36 L -34 -48 H 34 L 47 -36 V 36 L 34 48 H -34 L -47 36 Z" {...shell} />
        <path d="M -38 -27 L -27 -37 H 27 L 38 -27 V 15 H -38 Z" {...machined} />
        <rect x={-29} y={-18} width={58} height={22} rx={5} {...cast} />
        <path d="M -21 -11 H 21 M -21 -4 H 21" stroke={palette.metal} strokeWidth={2} />
        <circle cx={-31} cy={26} r={5} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
        <rect x={-19} y={21} width={38} height={9} rx={3} {...cast} />
        <path d="M -8 -42 L 0 -50 L 8 -42" fill="none" stroke={palette.accent} strokeWidth={2} />

        {cargo !== "none" && (
          <g data-cargo={cargo} transform="translate(0 9)">
            {cargo === "pod" && <path d="M -24 -13 Q -20 -30 0 -32 Q 20 -30 24 -13 V 7 H -24 Z" {...shell} />}
            {cargo === "crate" && <g><rect x={-24} y={-28} width={48} height={35} rx={3} {...shell} /><path d="M -20 -24 L 20 3 M 20 -24 L -20 3" stroke={palette.dark} strokeWidth={2} /></g>}
            {cargo === "tools" && <g><rect x={-25} y={-20} width={50} height={27} rx={5} {...cast} />{[-15, 0, 15].map((x) => <circle key={x} cx={x} cy={-7} r={6} {...machined} />)}</g>}
          </g>
        )}

        {antenna !== "none" && (
          <g data-antenna={antenna}>
            {antenna === "whip" ? (
              <g><path d="M 30 -35 Q 38 -56 32 -72" fill="none" stroke={palette.dark} strokeWidth={1.8} /><circle cx={32} cy={-74} r={2.5} fill={signalColor} /></g>
            ) : (
              <g transform="translate(31 -40)"><path d="M 0 0 V -19" stroke={palette.dark} strokeWidth={2} /><path d="M -11 -19 Q 0 -8 11 -19 Q 0 -28 -11 -19 Z" {...machined} /></g>
            )}
          </g>
        )}
      </g>
      {label && <text x={105} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finite = (value: number) => Number.isFinite(value) ? value : 0
const finiteClamp = (value: number, min: number, max: number) => clamp(finite(value), min, max)
const wrap = (value: number) => ((finite(value) % 1) + 1) % 1

export { CourierDroid }

/**
 * The route. A delivery run is straight legs and square corners with the
 * wheels turning the whole way; a patrol is the same idea, tighter; pointing
 * is it coming round to face you. The steer is whatever is left of the turn,
 * which is what makes it read as steering rather than sliding.
 */
export function courierDroidPose(
  behavior: CourierDroidBehavior,
  clock: number,
  bearing: number | null,
) {
  const t = Number.isFinite(clock) ? clock : 0
  if (behavior === "static") return { heading: 0, steer: 0, travel: 0 }
  if (behavior === "pointer") {
    const goal = bearing ?? 0
    return { heading: goal, steer: 0, travel: t * 1.2 }
  }
  const leg = behavior === "patrol" ? 0.5 : 1
  const cycle = t / leg
  const corner = Math.floor(cycle)
  const into = cycle - corner
  // The last fifth of each leg is the corner itself.
  const turning = Math.max(0, (into - 0.8) / 0.2)
  const quarter = behavior === "patrol" ? 90 : 90
  return {
    heading: corner * quarter + turning * quarter,
    steer: turning > 0 ? 38 : bearing !== null ? 0 : 0,
    travel: t * 1.35,
  }
}
