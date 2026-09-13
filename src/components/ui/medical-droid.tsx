"use client"

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"

import { clamp } from "@/lib/robocn/kinematics"
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
  type RobotPalette,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type MedicalDroidTool = "none" | "scanner" | "injector" | "clamp" | "probe"
export type MedicalDroidBehavior = "diagnose" | "monitor" | "idle" | "static"

/** The droid is drawn standing straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where it stands in the frame, and the depths a front elevation never had
 *  to give: the column is a tapered body of revolution, not a flat panel. */
const CENTRE = 95
const GROUND = 190
const BODY_DEEP = 15
const ARM_DEEP = 9

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface MedicalDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Head turn in degrees. Omit and it watches its patient — or you. */
  /** Where the camera stands. One droid, four projections. */
  view?: RobotView
  headAngle?: number
  leftTool?: MedicalDroidTool
  rightTool?: MedicalDroidTool
  /** Diagnostic progress, 0 to 1. Omit and `behavior` runs the scan. */
  diagnostic?: number
  /** What it does unattended: run a scan, watch the readout, or wait. */
  behavior?: MedicalDroidBehavior
  /** Scans per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** The head follows the pointer, and a click starts the scan again. */
  interactive?: boolean
  onDiagnosticRestart?: () => void
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function ToolEnd({
  tool,
  side,
  palette,
  variant,
}: {
  tool: MedicalDroidTool
  side: -1 | 1
  palette: RobotPalette
  variant: RobotVariant
}) {
  if (tool === "none") return null
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  return (
    <g data-tool={tool}>
      {tool === "scanner" && (
        <g>
          <path d={`M 0 0 L ${side * 16} -8 L ${side * 19} 2 L ${side * 4} 9 Z`} {...machined} />
          <path d={`M ${side * 7} -1 L ${side * 15} -4`} stroke={palette.accent} strokeWidth={2} />
        </g>
      )}
      {tool === "injector" && (
        <g>
          <rect x={side < 0 ? -16 : 0} y={-5} width={16} height={10} rx={3} {...machined} />
          <path d={`M ${side * 16} 0 H ${side * 29}`} stroke={palette.accent} strokeWidth={1.4} />
        </g>
      )}
      {tool === "clamp" && (
        <g>
          <circle r={5} {...cast} />
          <path d={`M ${side * 3} -2 L ${side * 15} -10 M ${side * 3} 2 L ${side * 15} 10`} stroke={palette.accent} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )}
      {tool === "probe" && (
        <g>
          <path d={`M 0 0 H ${side * 24}`} stroke={palette.metal} strokeWidth={3} strokeLinecap="round" />
          <circle cx={side * 26} r={3} fill={palette.accent} />
        </g>
      )}
    </g>
  )
}

function MedicalDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  headAngle,
  leftTool = "scanner",
  rightTool = "probe",
  diagnostic,
  behavior = "diagnose",
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onDiagnosticRestart,
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
  onPointerDown,
  ...props
}: MedicalDroidProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({ speed, animate: animate && behavior !== "static", paused, phase })
  // A click runs the scan again from the top, rather than jumping it.
  const [restartedAt, setRestartedAt] = React.useState(0)
  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && headAngle === undefined && !paused,
    toWorld: React.useCallback((unit: { x: number; y: number }) => ({
      x: (unit.x - 0.5) * 2,
      y: (unit.y - 0.5) * 2,
    }), []),
  })
  const scripted = medicalDroidPose(behavior, clock - restartedAt)
  const turn = finiteClamp(
    headAngle ?? (pointer.target ? clamp(pointer.target.x, -1, 1) * 55 : scripted.head),
    -60,
    60,
  )
  const level = finiteClamp(diagnostic ?? scripted.level, 0, 1)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor = signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal
  // The drawing is a front elevation, so it goes through `wall` where the
  // droid stands and comes out untouched straight on. The column is a tapered
  // body of revolution rather than a flat panel, and the two instrument arms
  // reach forward out of it — neither of which one elevation could say.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, GROUND)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const at = (x: number, y: number, deep = 0) => camera.project(-x, -y, -deep)
  const solid = (halfWidth: number, deep: number, top: number, bottom: number, x = 0) =>
    extrudedPath(
      roundedFootprint(halfWidth, deep, Math.min(halfWidth, deep) * 0.4, 5).map(point => ({
        x: point.x - x,
        y: point.y,
      })),
      camera, -top, -bottom,
    )


  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Medical droid, diagnostic ${Math.round(level * 100)} percent, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setRestartedAt(clock)
        onDiagnosticRestart?.()
      }}
      viewBox="0 0 190 220"
      width={width}
      height={px(width * 1.16)}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 13 197 H 177 M 95 12 V 204" strokeDasharray="2 3" />
          <circle cx={95} cy={106} r={76} strokeDasharray="2 3" />
        </g>
      )}
      {showGround && <ellipse cx={95} cy={196} rx={50} ry={6} fill={palette.dark} opacity={0.14} />}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND})`}>
        <path d={solid(39, BODY_DEEP + 2, 18, 0)} {...cast} />
        <path d={solid(32, BODY_DEEP, 76, 18)} {...shell} />
        {([-1, 1] as const).map(side => (
          <g key={side} data-arm={side < 0 ? "left" : "right"}>
            <path
              d={capsulePath(at(side * 34, -65, side * ARM_DEEP), at(side * 54, -35, side * ARM_DEEP + 6), 4.5)}
              {...machined}
            />
          </g>
        ))}
        <path d={solid(8, 7, 103, 75)} {...machined} />
        <path d={solid(17, 14, 140, 100, turn * 0.13)} {...shell} />
      </g>}
      <Frame {...frame}>
      <g data-view={view} transform="translate(95 190)">
        <path d="M -32 -76 L -39 -18 H 39 L 32 -76 Z" {...shell} />
        <rect x={-28} y={-67} width={56} height={39} rx={5} {...machined} />
        <rect x={-20} y={-58} width={40} height={13} rx={3} {...cast} />
        <rect data-diagnostic x={-17} y={-55} width={px(34 * level)} height={7} rx={2} fill={signalColor} />
        <path d="M -18 -37 H 18" stroke={palette.dark} strokeWidth={2} strokeDasharray="3 3" />
        <circle cx={-23} cy={-17} r={4} fill={signalColor} />
        <circle cx={23} cy={-17} r={4} {...cast} />
        <rect x={-23} y={-8} width={46} height={10} rx={4} {...cast} />
        <path d="M -17 2 L -26 12 H 26 L 17 2" {...machined} />

        {[-1, 1].map((side) => {
          const tool = side < 0 ? leftTool : rightTool
          return (
            <g key={side} data-arm={side < 0 ? "left" : "right"} transform={`translate(${side * 34} -65)`}>
              <circle r={7} {...cast} />
              <path d={`M ${side * 2} 3 L ${side * 20} 30`} stroke={palette.dark} strokeWidth={9} strokeLinecap="round" />
              <path d={`M ${side * 2} 3 L ${side * 20} 30`} stroke={palette.metal} strokeWidth={5} strokeLinecap="round" />
              <circle cx={side * 20} cy={30} r={6} {...cast} />
              <g transform={`translate(${side * 20} 30)`}>
                <ToolEnd tool={tool} side={side as -1 | 1} palette={palette} variant={variant} />
              </g>
            </g>
          )
        })}

        <rect x={-8} y={-103} width={16} height={28} rx={5} {...machined} />
        <g data-head transform={`translate(${px(turn * 0.13)} -120) rotate(${px(turn * 0.08)})`}>
          <path d="M -29 -22 H 29 V 18 Q 0 27 -29 18 Z" {...shell} />
          <rect x={-22} y={-14} width={44} height={19} rx={5} {...cast} />
          <circle cx={-10} cy={-5} r={6} fill={palette.accent} />
          <circle cx={-10} cy={-5} r={2.5} fill={palette.dark} />
          <path d="M 3 -10 H 17 M 3 -4 H 17 M 3 2 H 13" stroke={palette.metal} strokeWidth={2} />
          <path d="M -12 13 H 12" stroke={palette.dark} strokeWidth={2} />
        </g>
      </g>
      </Frame>
      {label && <text x={95} y={214} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { MedicalDroid }

/**
 * A scan is a sweep of the readout that finishes and holds, not a bar that
 * loops: the machine reads, reaches its answer, and keeps it on the display
 * until something asks it to look again.
 */
export function medicalDroidPose(behavior: MedicalDroidBehavior, clock: number) {
  const t = Number.isFinite(clock) ? Math.max(0, clock) : 0
  switch (behavior) {
    case "monitor":
      return { level: 0.5 + Math.sin(t * Math.PI * 2) * 0.28, head: Math.sin(t * Math.PI * 0.7) * 14 }
    case "idle":
      return { level: 0.12, head: Math.sin(t * Math.PI * 0.45) * 8 }
    case "static":
      return { level: 0.65, head: 0 }
    default: {
      // Ramp to a result over the first cycle, then hold it and look up.
      const level = Math.min(1, t)
      return { level, head: level < 1 ? -22 + Math.sin(t * Math.PI * 3) * 6 : Math.sin(t * Math.PI * 0.6) * 16 }
    }
  }
}
