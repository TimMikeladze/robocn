"use client"

/**
 * delta-arm — a parallel delta robot, drawn in isometric.
 *
 * Three motors on a fixed plate drive three biceps; three pairs of passive
 * forearms keep the platform level wherever it goes. Solved with the closed-
 * form delta IK rather than an approximation, so the geometry is the real
 * thing — change `geometry` and the arms behave the way that machine would.
 */

import * as React from "react"

import { useEasedPoint, type RobotTarget } from "@/hooks/use-robot-arm"
import { usePointerTarget } from "@/hooks/use-pointer-target"
import {
  isometric,
  isometricDepth,
  solveDelta,
  type DeltaGeometry,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import {
  capsulePath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotBehavior,
  type RobotPaletteProps,
  type RobotSize,
  type RobotTool,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 132
const VIEW_HEIGHT = 118
const PLATE_Y = 30

/**
 * Proportions of a printer-style delta: short biceps on a wide plate, long
 * forearms. Short biceps keep the elbows inside the plate's footprint, which
 * is what makes the machine read as a delta rather than a splayed tripod.
 */
const defaultGeometry: DeltaGeometry = {
  base: 62,
  platform: 18,
  upper: 17,
  lower: 58,
}

export interface DeltaArmProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /** Triangle sides and arm lengths, in world units. */
  geometry?: Partial<DeltaGeometry>
  /**
   * Controlled platform position: `x` and `z` run across the workspace, `y`
   * is how far below the plate it hangs (negative).
   */
  target?: Vec3 | ((clock: number) => Vec3) | null
  behavior?: RobotBehavior
  /** Height the platform holds when a behaviour drives it. */
  height?: number
  tool?: RobotTool
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
  thickness?: number
  /** Viewing angle: rotation about the vertical, then how far the view tips. */
  spin?: number
  tilt?: number
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  showPlate?: boolean
  /** Mark the platform centre with a crosshair and a readout. */
  showTarget?: boolean
}

function DeltaArm({
  geometry: geometryOverride,
  target = null,
  behavior = "orbit",
  height,
  tool = "vacuum",
  active,
  variant = "solid",
  size = "md",
  thickness = 1,
  spin = 32,
  tilt = 0.45,
  speed,
  animate = true,
  paused = false,
  phase = 0,
  label,
  showPlate = true,
  showTarget,
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
}: DeltaArmProps) {
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const geometry = { ...defaultGeometry, ...geometryOverride }
  const width = resolveRobotSize(size)
  const viewHeight = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const weight = thickness
  const rest = height ?? -(geometry.upper + geometry.lower) * 0.74
  const swing = geometry.base * 0.22
  const annotate = showTarget ?? variant === "blueprint"

  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !paused,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: (unit.x - 0.5) * VIEW_WIDTH * 0.6,
        y: -(unit.y * VIEW_HEIGHT - PLATE_Y),
      }),
      [],
    ),
  })

  // The platform moves in a plane, so it eases like any other point; only the
  // depth axis is driven by the behaviour.
  const planar = React.useMemo<RobotTarget>(() => {
    if (typeof target === "function") {
      return (clock: number) => {
        const point = target(clock)
        return { x: point.x, y: point.y }
      }
    }
    if (target) return { x: target.x, y: target.y }
    if (behavior === "pointer" && pointer.target) {
      return { x: pointer.target.x, y: Math.min(-8, pointer.target.y) }
    }
    if (behavior === "static") return { x: 0, y: rest }
    return (clock: number) => ({
      x: Math.cos(clock * (behavior === "sweep" ? 0.7 : 1)) * swing,
      y:
        rest +
        (behavior === "idle" ? Math.sin(clock * 0.8) * 2 : Math.sin(clock * 1.6) * 5),
    })
  }, [target, behavior, pointer.target, rest, swing])

  const eased = useEasedPoint(
    planar,
    { x: 0, y: rest },
    { speed: speed ?? 70, animate, paused, phase },
  )

  const depth = React.useMemo(() => {
    if (typeof target === "function") return target(eased.clock).z
    if (target) return target.z
    if (behavior === "static" || behavior === "pointer") return 0
    return Math.sin(eased.clock * (behavior === "sweep" ? 0.9 : 1)) * swing
  }, [target, behavior, eased.clock, swing])

  const platform: Vec3 = { x: eased.point.x, y: eased.point.y, z: depth }
  const pose = solveDelta(platform, geometry)
  const engaged = active ?? eased.moving
  const project = (v: Vec3) => isometric(v, { spin, tilt })

  // Far arms first: the plate and platform then overlap them correctly.
  const ordered = pose.arms
    .map((arm, index) => ({ arm, index }))
    .sort(
      (a, b) =>
        isometricDepth(b.arm.anchor, { spin }) -
        isometricDepth(a.arm.anchor, { spin }),
    )

  const shell = robotSurface("shell", variant, palette, weight)
  const metalSurface = robotSurface("metal", variant, palette, weight)
  const darkSurface = robotSurface("dark", variant, palette, weight)
  // The plate is drawn as an open frame — the biceps swing out past its edges,
  // and a solid slab would swallow them.
  const plate = `${triangle(geometry.base, { x: 0, y: 0, z: 0 }, project)} Z ${triangle(geometry.base * 0.62, { x: 0, y: 0, z: 0 }, project)} Z`
  const plateRim = `${triangle(geometry.base, { x: 0, y: -3, z: 0 }, project)} Z ${triangle(geometry.base * 0.62, { x: 0, y: -3, z: 0 }, project)} Z`
  const deck = triangle(geometry.platform, platform, project)

  return (
    <svg
      role="img"
      aria-label={`Delta robot with three arms holding a ${tool}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={viewHeight}
      ref={svgRef}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g transform={`translate(${VIEW_WIDTH / 2} ${PLATE_Y}) scale(1 -1)`}>
        {showPlate ? (
          <g>
            {/* Rim first, so the frame sits on a visible thickness. */}
            <path d={plateRim} fillRule="evenodd" {...darkSurface} />
            <path d={plate} fillRule="evenodd" {...metalSurface} />
          </g>
        ) : null}

        {ordered.map(({ arm, index }) => {
          const anchor = project(arm.anchor)
          const elbow = project(arm.elbow)
          const corner = project(arm.platform)
          // Forearms come in parallel pairs — that is what keeps the platform
          // level — so draw both rods, offset across the arm's plane.
          const spread = perpendicularOffset(elbow, corner, 1.6 * weight)
          return (
            <g key={index}>
              <rect
                x={px(anchor.x - 5)}
                y={px(anchor.y - 3.4)}
                width={10}
                height={6.8}
                rx={1.8}
                {...darkSurface}
              />
              <circle cx={px(anchor.x)} cy={px(anchor.y)} r={1.5} fill={palette.metal} />
              <path d={capsulePath(anchor, elbow, 2.6 * weight)} {...shell} />
              {[1, -1].map((side) => (
                <path
                  key={side}
                  d={capsulePath(
                    { x: elbow.x + spread.x * side, y: elbow.y + spread.y * side },
                    { x: corner.x + spread.x * side, y: corner.y + spread.y * side },
                    0.9 * weight,
                  )}
                  {...metalSurface}
                />
              ))}
              <circle
                cx={px(elbow.x)}
                cy={px(elbow.y)}
                r={px(1.9 * weight)}
                fill={palette.dark}
              />
            </g>
          )
        })}

        <path d={`${deck} Z`} {...darkSurface} />
        <g transform={`translate(${px(project(platform).x)} ${px(project(platform).y)})`}>
          {tool === "vacuum" ? (
            <path d="M -3 0 L 3 0 L 1.6 -5 L -1.6 -5 Z" {...darkSurface} />
          ) : null}
          {tool === "gripper"
            ? [-1, 1].map((side) => (
                <rect
                  key={side}
                  x={px(side * 2.4 - 0.7)}
                  y={-5.5}
                  width={1.4}
                  height={5}
                  rx={0.5}
                  {...metalSurface}
                />
              ))
            : null}
          <circle
            r={px(1.5 * weight)}
            cy={-5.4}
            fill={palette.glow}
            className={engaged ? "robocn-pulse" : undefined}
          />
        </g>

        {annotate ? (
          <g fontFamily="ui-monospace, monospace" fontSize={3.4}>
            <g
              transform={`translate(${px(project(platform).x + 7)} ${px(project(platform).y - 2)}) scale(1 -1)`}
            >
              <text fill={pose.reachable ? palette.accent : palette.shell}>
                {pose.reachable
                  ? `${platform.x.toFixed(0)}, ${platform.y.toFixed(0)}, ${platform.z.toFixed(0)}`
                  : "out of workspace"}
              </text>
            </g>
            {pose.arms.map((arm, index) => (
              <g
                key={index}
                transform={`translate(${px(project(arm.anchor).x - 4)} ${px(project(arm.anchor).y + 7)}) scale(1 -1)`}
              >
                <text fill={palette.grid}>{`M${index + 1} ${arm.angle.toFixed(0)}°`}</text>
              </g>
            ))}
          </g>
        ) : null}

        {label ? (
          <g transform={`translate(0 ${-VIEW_HEIGHT + PLATE_Y + 10}) scale(1 -1)`}>
            <text
              textAnchor="middle"
              fontSize={3.8}
              fontFamily="ui-monospace, monospace"
              letterSpacing="0.4"
              fill={palette.grid}
            >
              {label}
            </text>
          </g>
        ) : null}
      </g>
    </svg>
  )
}

/** Projected outline of an equilateral triangle of side `side`, centred on `at`. */
function triangle(side: number, at: Vec3, project: (v: Vec3) => Vec2) {
  const radius = side / Math.sqrt(3)
  return [0, 1, 2]
    .map((i) => {
      // The motors sit at the edge midpoints, 60 degrees off the corners —
      // offset the corners to match, or the plate looks bolted on crooked.
      const angle = (i * 2 * Math.PI) / 3 + Math.PI / 2
      const point = project({
        x: at.x + Math.cos(angle) * radius,
        y: at.y,
        z: at.z + Math.sin(angle) * radius,
      })
      return `${i === 0 ? "M" : "L"} ${px(point.x)} ${px(point.y)}`
    })
    .join(" ")
}

function perpendicularOffset(a: Vec2, b: Vec2, amount: number): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  return { x: (-dy / length) * amount, y: (dx / length) * amount }
}

export { DeltaArm }
