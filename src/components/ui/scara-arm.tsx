"use client"

/**
 * scara-arm — a SCARA cell seen from directly above.
 *
 * Two rotary links in one horizontal plane and a vertical spindle, which is
 * the arm you actually find over a pick-and-place line. The plan view is the
 * view that matters for one: you read the swept area straight off it.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import {
  useRobotArm,
  type RobotArmPose,
  type RobotTarget,
} from "@/hooks/use-robot-arm"
import {
  chainMinReach,
  chainReach,
  type Bend,
  type Vec2,
} from "@/lib/robocn/kinematics"
import {
  capsulePath,
  linkRole,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotBehavior,
  type RobotPaletteProps,
  type RobotSurface,
  type RobotSize,
  type RobotTool,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 132
const VIEW_HEIGHT = 118
const DEFAULT_REACH = 46

export interface ScaraArmProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /** Relative lengths of the two rotary links. */
  links?: number[]
  reach?: number
  /** Controlled tip position in the plane, base at (0, 0). */
  target?: RobotTarget
  behavior?: RobotBehavior
  /** Which way the elbow folds. Real cells are handed; so is this. */
  bend?: Bend
  /** Spindle extension, 0 fully retracted to 1 fully down. */
  z?: number
  tool?: RobotTool
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
  thickness?: number
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  /** Dashed annulus for the swept area. */
  showEnvelope?: boolean
  /** Offset silhouette on the table, which is how the Z height reads. */
  showShadow?: boolean
  showAngles?: boolean
  onPose?: (pose: RobotArmPose) => void
}

function ScaraArm({
  links = [1, 0.85],
  reach = DEFAULT_REACH,
  target = null,
  behavior = "orbit",
  bend = "up",
  z = 0.35,
  tool = "vacuum",
  active,
  variant = "solid",
  size = "md",
  thickness = 1,
  speed,
  animate = true,
  paused = false,
  phase = 0,
  label,
  showEnvelope = true,
  showShadow = true,
  showAngles,
  onPose,
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
}: ScaraArmProps) {
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const width = resolveRobotSize(size)
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const annotate = showAngles ?? variant === "blueprint"

  const scaled = React.useMemo(() => {
    const total = links.reduce((sum, link) => sum + Math.max(link, 0.01), 0)
    return links.map((link) => (Math.max(link, 0.01) / total) * reach)
  }, [links, reach])

  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !paused,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: unit.x * VIEW_WIDTH - VIEW_WIDTH / 2,
        y: VIEW_HEIGHT / 2 - unit.y * VIEW_HEIGHT,
      }),
      [],
    ),
  })

  const pose = useRobotArm({
    links: scaled,
    target: behavior === "pointer" ? (target ?? pointer.target) : target,
    behavior,
    bend,
    speed,
    animate,
    paused,
    phase,
  })

  React.useEffect(() => {
    onPose?.(pose)
  }, [onPose, pose])

  const [shoulder, elbow, tip] = [pose.joints[0], pose.joints[1], pose.tip]
  const engaged = active ?? pose.moving
  const weight = thickness * (reach / DEFAULT_REACH)
  const drop = 3 + z * 7

  const limbs = (offset: number, override?: Partial<RobotSurface>) =>
    scaled.map((_, index) => {
      const a = pose.joints[index]
      const b = pose.joints[index + 1]
      const role = linkRole(index)
      const surface = robotSurface(role, variant, palette, weight)
      return (
        <path
          key={index}
          d={capsulePath(
            { x: a.x + offset, y: a.y - offset },
            { x: b.x + offset, y: b.y - offset },
            (4.4 - index * 0.9) * weight,
          )}
          {...surface}
          {...(override ?? {})}
        />
      )
    })

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`SCARA robot arm seen from above, carrying a ${tool}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn("select-none overflow-hidden", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g transform={`translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2}) scale(1 -1)`}>
        {showEnvelope ? (
          <g
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.4}
            strokeDasharray="2 2"
            opacity={0.7}
          >
            <circle r={px(chainReach(scaled))} />
            {chainMinReach(scaled) > 0.5 ? (
              <circle r={px(chainMinReach(scaled))} />
            ) : null}
          </g>
        ) : null}

        {showShadow && variant === "solid" ? (
          <g opacity={0.12}>
            {limbs(drop, { fill: palette.dark, stroke: "none" })}
            <circle
              cx={px(tip.x + drop)}
              cy={px(tip.y - drop)}
              r={px(5 * weight)}
              fill={palette.dark}
            />
          </g>
        ) : null}

        {/* Column: the fixed post everything rotates around. */}
        <circle r={px(11 * weight)} {...robotSurface("dark", variant, palette, weight)} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            cx={px(Math.cos((i * Math.PI) / 3) * 8.6 * weight)}
            cy={px(Math.sin((i * Math.PI) / 3) * 8.6 * weight)}
            r={px(0.9 * weight)}
            fill={palette.metal}
            opacity={0.8}
          />
        ))}

        {limbs(0)}

        <circle
          cx={px(elbow.x)}
          cy={px(elbow.y)}
          r={px(4.4 * weight)}
          {...robotSurface("dark", variant, palette, weight)}
        />
        <circle
          cx={px(shoulder.x)}
          cy={px(shoulder.y)}
          r={px(6 * weight)}
          fill={variant === "solid" ? palette.metal : "none"}
          stroke={palette.dark}
          strokeWidth={0.6 * weight}
        />

        {/* Spindle head. The rings close in as the Z axis drives down. */}
        <g transform={`translate(${px(tip.x)} ${px(tip.y)})`}>
          <circle
            r={px(5.4 * weight)}
            {...robotSurface("metal", variant, palette, weight)}
          />
          <circle
            r={px((2 + (1 - z) * 2.6) * weight)}
            fill="none"
            stroke={palette.accent}
            strokeWidth={0.9 * weight}
            className={engaged ? "robocn-pulse" : undefined}
          />
          {tool === "gripper"
            ? [-1, 1].map((side) => (
                <rect
                  key={side}
                  x={px(side * 4 - 0.8)}
                  y={-2}
                  width={1.6}
                  height={4}
                  rx={0.6}
                  fill={palette.metal}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
              ))
            : null}
          {tool === "vacuum" ? (
            <circle r={px(1.5 * weight)} fill={palette.dark} />
          ) : null}
          {tool === "scanner" ? (
            <circle
              r={px(7.6 * weight)}
              fill="none"
              stroke={palette.accent}
              strokeWidth={0.5}
              strokeDasharray="1.5 2"
            />
          ) : null}
        </g>

        {annotate ? (
          <g fill={palette.grid} fontFamily="ui-monospace, monospace" fontSize={3.4}>
            <g transform={`translate(${px(shoulder.x + 7)} ${px(shoulder.y - 7)}) scale(1 -1)`}>
              <text>{`J1 ${pose.angles[0]?.toFixed(0) ?? 0}°`}</text>
            </g>
            <g transform={`translate(${px(elbow.x + 6)} ${px(elbow.y - 6)}) scale(1 -1)`}>
              <text>{`J2 ${pose.angles[1]?.toFixed(0) ?? 0}°`}</text>
            </g>
            <g transform={`translate(${px(tip.x + 7)} ${px(tip.y + 9)}) scale(1 -1)`}>
              <text fill={palette.accent}>{`Z ${(z * 100).toFixed(0)}%`}</text>
            </g>
          </g>
        ) : null}

        {label ? (
          <g transform={`translate(0 ${-VIEW_HEIGHT / 2 + 8}) scale(1 -1)`}>
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

export { ScaraArm }
