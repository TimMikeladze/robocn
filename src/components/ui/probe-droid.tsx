"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp, toRadians } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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

export type ProbeDroidBehavior = "hover" | "scan" | "pointer" | "static"

/** The droid is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where the pod hangs in the frame, and how far out the appendages are
 *  socketed — the front elevation spread them across the picture, but they
 *  are really set round the pod. */
const CENTRE = 100
const ARM_RING = 30

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface ProbeDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  size?: RobotSize | number
  variant?: RobotVariant
  /** Height above its own shadow, 0 to 1. Omit and it flies itself. */
  hover?: number
  /** Sensor bearing in degrees, clamped to −65..65. Omit and `behavior` aims it. */
  scanAngle?: number
  /** What it does when it is not being flown. */
  behavior?: ProbeDroidBehavior
  /** Bob and sweep cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The sensor comes round to the pointer. */
  interactive?: boolean
  appendages?: number
  active?: boolean
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function ProbeDroid({
  view = NATIVE_VIEW,
  size = "md",
  variant = "solid",
  hover,
  scanAngle,
  behavior = "hover",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  appendages = 5,
  active = false,
  signal = "idle",
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
}: ProbeDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  const pointer = usePointerTarget(svgRef, {
    enabled: (interactive || behavior === "pointer") && scanAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = probeDroidPose(behavior, clock)
  const lift = finiteClamp(hover ?? scripted.lift, 0, 1)
  const scan = finiteClamp(
    scanAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 65 : scripted.scan),
    -65,
    65,
  )
  const armCount = Number.isFinite(appendages) ? Math.round(clamp(appendages, 3, 6)) : 5
  const y = 87 - lift * 18
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  // The drawing is a front elevation of the pod, so it goes through `wall` and
  // comes out untouched straight on. A probe is a body of revolution with its
  // appendages set round it rather than side by side, which is the thing the
  // one elevation could not say: off the front they are tubes on a ring.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the pod's own frame: x right, y down, and `deep` at the reader. */
  const at = (x: number, py: number, deep = 0) => camera.project(-x, -py, -deep)
  /** Where an appendage is socketed, given the angle it is set at. */
  const socket = (degrees: number, radius: number, py: number) => {
    const azimuth = toRadians(degrees)
    return at(Math.sin(azimuth) * radius, py, -Math.cos(azimuth) * radius)
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Probe droid, ${armCount} appendages, hover ${Math.round(lift * 100)} percent, ${viewNames[view] ?? viewNames.front}`}
      viewBox="0 0 200 220"
      width={width}
      height={px(width * 1.1)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 14 194 H 186 M 100 15 V 202" strokeDasharray="2 3" />
          <circle cx={100} cy={98} r={82} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={100} cy={193} rx={px(50 - lift * 8)} ry={px(7 - lift * 2)} fill={palette.dark} opacity={px(0.2 - lift * 0.07)} />}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${px(y)})`}>
        {Array.from({ length: armCount }, (_, index) => {
          const spread = armCount === 1 ? 0 : -52 + (index * 104) / (armCount - 1)
          const length = 55 + (index % 3) * 8
          return (
            <path
              key={index}
              d={capsulePath(
                socket(spread * 1.7, ARM_RING, 26),
                socket(spread * 1.7, ARM_RING + 6, 26 + length),
                3.5,
              )}
              {...cast}
            />
          )
        })}
        <path d={extrudedPath(circleFootprint(0, 0, 54, 16), camera, 10, -30)} {...cast} />
        <path d={extrudedPath(circleFootprint(0, 0, 45, 16), camera, 37, 4)} {...shell} />
        <path d={capsulePath(at(0, -10), at(0, -10, 22), 15)} {...cast} />
        <path d={capsulePath(at(0, -24), at(0, -50), 2.5)} fill={palette.dark} stroke="none" />
      </g>}
      <Frame {...frame}>
      <g data-pod data-view={view} transform={`translate(100 ${px(y)})`}>
        {Array.from({ length: armCount }, (_, index) => {
          const spread = armCount === 1 ? 0 : -52 + (index * 104) / (armCount - 1)
          const side = spread < 0 ? -1 : 1
          const length = 55 + (index % 3) * 8
          return (
            <g key={index} data-appendage={index} transform={`translate(${px(spread * 0.55)} 31) rotate(${px(spread * 0.42)})`}>
              <path d={`M 0 0 Q ${side * 10} ${length * 0.42} ${side * 5} ${length}`} fill="none" stroke={palette.dark} strokeWidth={7} strokeLinecap="round" />
              <path d={`M 0 0 Q ${side * 10} ${length * 0.42} ${side * 5} ${length}`} fill="none" stroke={palette.metal} strokeWidth={3.5} strokeLinecap="round" />
              <circle cx={side * 5} cy={length} r={5} {...cast} />
              {index % 3 === 0 && <path d={`M ${side * 5} ${length + 4} l ${side * 8} 14 m -${side * 8} -14 l ${-side * 5} 15`} stroke={palette.accent} strokeWidth={2} strokeLinecap="round" />}
              {index % 3 === 1 && <path d={`M ${side * 5} ${length + 4} v 18`} stroke={palette.metal} strokeWidth={2.5} strokeLinecap="round" />}
              {index % 3 === 2 && <circle cx={side * 5} cy={length + 13} r={7} fill="none" stroke={palette.accent} strokeWidth={2} />}
            </g>
          )
        })}

        <path d="M -54 -10 Q -45 -42 0 -48 Q 45 -42 54 -10 L 42 30 Q 0 48 -42 30 Z" {...cast} />
        <path d="M -47 -9 Q -37 -33 0 -37 Q 37 -33 47 -9 L 36 20 Q 0 34 -36 20 Z" {...shell} />
        <ellipse cx={0} cy={-8} rx={43} ry={23} {...machined} />
        <g data-scanner transform={`rotate(${px(scan)} 0 -10)`}>
          <circle cx={0} cy={-10} r={15} {...cast} />
          <circle cx={0} cy={-10} r={9} fill={palette.accent} />
          <circle cx={2} cy={-12} r={3.5} fill={palette.dark} />
          <path d="M 0 -24 V -45" stroke={palette.dark} strokeWidth={2.5} />
          <path d="M -10 -46 Q 0 -53 10 -46" fill="none" stroke={palette.metal} strokeWidth={3} />
        </g>
        <circle cx={-31} cy={3} r={6} {...cast} />
        <circle cx={-31} cy={3} r={3} fill={signalColor} />
        <circle cx={31} cy={3} r={8} {...cast} />
        <circle cx={31} cy={3} r={4} fill={palette.metal} />
        {active && (
          <path
            data-scan
            d={`M ${px(scan * 0.2)} -17 L ${px(82 + scan * 0.25)} -48 L ${px(68 + scan * 0.2)} 12 Z`}
            fill={palette.glow}
            opacity={0.14}
            className="robocn-pulse"
          />
        )}
      </g>
      </Frame>
      {label && <text x={100} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { ProbeDroid }

/**
 * Station-keeping. A hovering probe rides its repulsors up and down with the
 * sensor barely moving; a scanning one sweeps the sensor across its arc and
 * holds its height, the way something looking for you would.
 */
export function probeDroidPose(behavior: ProbeDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    case "scan":
      return { lift: 0.62, scan: Math.sin(t * Math.PI * 2) * 62 }
    case "pointer":
      return { lift: 0.5 + Math.sin(t * Math.PI * 2) * 0.14, scan: 0 }
    case "static":
      return { lift: 0.5, scan: 0 }
    default:
      return {
        lift: 0.5 + Math.sin(t * Math.PI * 2) * 0.32,
        scan: Math.sin(t * Math.PI * 0.9) * 12,
      }
  }
}
