"use client"

/**
 * reachy-mini — a companion robot head on a six-rod parallel platform.
 *
 * The linkage is the honest part: six legs solved with real Stewart platform
 * inverse kinematics and projected through the shared isometric helper. The
 * head shell is an illustration that takes its roll, yaw and pitch from the
 * same pose, so the drawing and the mechanism never disagree about where the
 * robot is looking.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { clamp, isometric, isometricDepth, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultStewartGeometry,
  solveStewart,
  type StewartGeometry,
  type StewartPose,
} from "@/lib/robocn/stewart"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** Proportions that fit the drawing's frame; override any of them. */
const headGeometry: StewartGeometry = {
  ...defaultStewartGeometry,
  baseRadius: 24,
  platformRadius: 18,
  height: 30,
  travel: 9,
}

/** Slight spin so the rods read as an X on both sides rather than head-on. */
const view = { spin: 60, tilt: 0.32 }

export interface ReachyMiniProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps,
    StewartPose {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Pupil aim in −1..1 on both axes. Set it to drive the gaze yourself. */
  look?: Vec2 | null
  /** Follow the pointer anywhere on the page while `look` is null. */
  track?: boolean
  blink?: boolean
  /** Antenna angles in degrees; positive leans a wire outward. */
  antennaLeft?: number
  antennaRight?: number
  /** Draw the six rods and their bearings. */
  showLinkage?: boolean
  showGround?: boolean
  label?: string
  geometry?: Partial<StewartGeometry>
}

function ReachyMini({
  sway = 0, heave = 0, surge = 0, roll = 0, pitch = 0, yaw = 0,
  size = "md", variant = "solid", look = null, track = true, blink = true,
  antennaLeft = 0, antennaRight = 0, showLinkage = true, showGround = true, label, geometry,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style, ...props
}: ReachyMiniProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // Clamp what the drawing can show; the solver itself takes any pose and
  // reports the ones a real platform could not hold.
  const pose: StewartPose = {
    sway: bound(sway, 10),
    heave: bound(heave, 8),
    surge: bound(surge, 10),
    roll: bound(roll, 24),
    pitch: bound(pitch, 24),
    yaw: bound(yaw, 30),
  }
  const solution = solveStewart(pose, { ...headGeometry, ...geometry })
  const flat = (v: Vec3) => isometric(v, view)
  const center = flat(solution.center)

  const svgRef = React.useRef<SVGSVGElement>(null)
  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((point: Vec2) => {
      const x = (point.x - 0.5) * 2
      const y = (point.y - 0.5) * 2
      const distance = Math.hypot(x, y) || 1
      const limit = Math.min(1, distance) / distance
      return { x: x * limit, y: y * limit }
    }, []),
  })
  const gaze = look ?? pointer.target ?? { x: 0, y: 0 }
  const pupil = { x: clamp(gaze.x, -1, 1) * 4.5, y: clamp(gaze.y, -1, 1) * 3.5 }

  // Yaw and pitch are shown by moving and foreshortening the face, since the
  // shell is a drawing rather than a solved surface.
  const turn = pose.yaw ?? 0
  const nod = pose.pitch ?? 0
  const faceShift = { x: turn * 0.55, y: -nod * 0.4 }
  const squeeze = { x: 1 - Math.abs(turn) / 170, y: 1 - Math.abs(nod) / 220 }

  const rods = solution.legs
    .map(leg => ({
      leg,
      base: flat(leg.base),
      top: flat(leg.platform),
      depth: isometricDepth(leg.platform, view) + isometricDepth(leg.base, view),
    }))
    .sort((a, b) => a.depth - b.depth)
  const behind = rods.filter(rod => rod.depth < 0)
  const infront = rods.filter(rod => rod.depth >= 0)

  const rod = (item: (typeof rods)[number]) => (
    <g key={item.leg.id} data-rod={item.leg.id} opacity={item.depth < 0 ? 0.55 : 1}>
      <line x1={px(item.base.x)} y1={px(item.base.y)} x2={px(item.top.x)} y2={px(item.top.y)}
        stroke={palette.dark} strokeWidth={3.2} strokeLinecap="round" />
      <line x1={px(item.base.x)} y1={px(item.base.y)} x2={px(item.top.x)} y2={px(item.top.y)}
        stroke={item.leg.withinLimits ? palette.metal : palette.accent} strokeWidth={1.7} strokeLinecap="round" />
      <circle cx={px(item.base.x)} cy={px(item.base.y)} r={2.1} fill={palette.dark} />
    </g>
  )

  const antenna = (side: -1 | 1, angle: number) => (
    <g data-antenna={side < 0 ? "left" : "right"}
      transform={`translate(${px(side * 21)} 59) rotate(${px(bound(-side * angle, 45))})`}>
      <path d={`M 0 0 q ${side * 3} 9 ${side * 2} 17`} fill="none" stroke={palette.dark} strokeWidth={1.5} strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map(i => (
        <ellipse key={i} cx={px(side * 2)} cy={px(19 + i * 3.2)} rx={3.4} ry={1.5}
          fill="none" stroke={palette.dark} strokeWidth={1.3} />
      ))}
      <circle cx={px(side * 2)} cy={38} r={2.2} fill={palette.accent} />
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Companion robot, head yaw ${Math.round(pose.yaw ?? 0)} degrees`}
      viewBox="0 0 200 200"
      width={width}
      height={width}
      className={cn("max-w-full select-none", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g transform="translate(100 182) scale(1 -1)">
        {showGround && <ellipse cx={0} cy={1} rx={48} ry={5.5} fill={palette.dark} opacity={0.14} />}

        {/* Body: a speaker barrel the platform bolts to. */}
        <path d="M -41 0 C -41 22 -37 42 -27 54 L 27 54 C 37 42 41 22 41 0 Z" {...shell} />
        {variant !== "wire" && [12, 21, 30, 39].map((y, i) => (
          <rect key={y} x={px(-26 + i * 2.6)} y={y} width={px(52 - i * 5.2)} height={3.4} rx={1.7}
            fill={palette.dark} opacity={0.28} />
        ))}
        <path d="M -41 0 h 82" stroke={palette.dark} strokeWidth={1.2} fill="none" opacity={0.5} />
        <ellipse cx={0} cy={54} rx={27} ry={8} {...machined} />

        {showLinkage && behind.map(rod)}
        {showLinkage && <ellipse data-platform cx={px(center.x)} cy={px(center.y)} rx={19} ry={6.4} {...cast} />}
        {showLinkage && infront.map(rod)}

        {/* Head. Roll turns the whole shell; yaw and pitch move the face. */}
        <g data-head transform={`translate(${px(center.x)} ${px(center.y)}) rotate(${px(-(pose.roll ?? 0))})`}>
          <rect x={-16} y={-2} width={32} height={13} rx={4} {...cast} />
          <rect x={-38} y={9} width={76} height={56} rx={23} {...shell} />
          <g transform={`translate(${px(faceShift.x)} ${px(faceShift.y + 36)}) scale(${px(squeeze.x)} ${px(squeeze.y)})`}>
            <rect x={-14} y={-2.2} width={28} height={4.4} rx={2.2} {...cast} />
            {[-1, 1].map(side => (
              <g key={side} data-eye={side < 0 ? "left" : "right"}>
                <circle cx={px(side * 19)} cy={0} r={14.5} {...cast} />
                <g className={blink ? "robocn-blink" : undefined} style={{ transformOrigin: `${px(side * 19)}px 0px` }}>
                  <circle cx={px(side * 19 + pupil.x)} cy={px(pupil.y)} r={6.4} fill={palette.accent} opacity={0.85} />
                  <circle cx={px(side * 19 + pupil.x)} cy={px(pupil.y)} r={3} fill={palette.dark} />
                  <circle cx={px(side * 19 + pupil.x + 2.4)} cy={px(pupil.y + 3)} r={1.8} fill={palette.metal} opacity={0.85} />
                </g>
              </g>
            ))}
          </g>
          {antenna(-1, antennaLeft)}
          {antenna(1, antennaRight)}
        </g>
      </g>
      {!solution.reachable && (
        <circle data-fault cx={186} cy={14} r={4} fill={palette.accent} className="robocn-pulse" />
      )}
      {label && (
        <text x={100} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={5} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const bound = (value: number, limit: number) =>
  Number.isFinite(value) ? clamp(value, -limit, limit) : 0

export { ReachyMini }
