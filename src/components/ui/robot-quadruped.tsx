"use client"

/**
 * robot-quadruped — a four-legged robot in profile.
 *
 * Uncontrolled it keeps its own cycle: idling it breathes, walking it staggers
 * single-foot swings, trotting it swings diagonal pairs. Interactive, it
 * notices you — bring the pointer over it and it gets up and walks, click and
 * it settles back down.
 */

import * as React from "react"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp } from "@/lib/robocn/kinematics"
import { solveQuadruped, type QuadrupedGait, type QuadrupedLeg, type QuadrupedOptions } from "@/lib/robocn/quadruped"
import { aboutPoint, capsulePath, extrudedPath, px, resolveRobotPalette, resolveRobotSize, robotCamera, robotSurface, roundedFootprint, type RobotPaletteProps, type RobotSize, type RobotVariant, type RobotView } from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type QuadrupedBehavior = "walk" | "trot" | "idle" | "static"

/** The robot is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the track: the elevation drew one pair of legs behind the other, but
 *  they are really either side of the body. */
const HALF_TRACK = 12
/** Where the machine stands in the frame. */
const CENTRE = 100
const GROUND = 126

/** How far the camera pulls back so the machine still fits a frame that was
 *  drawn for one view. One in the view it was drawn in. */
const fits: Record<RobotView, number> = { plan: 0.84, front: 1, profile: 1, iso: 1 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotQuadrupedProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps,
    Omit<QuadrupedOptions, "gait"> {
  /** Footfall pattern. Omit and `behavior` picks one. */
  /** Where the camera stands. One robot, four projections. */
  view?: RobotView
  gait?: QuadrupedGait
  /** What the robot does when `phase` is not supplied. */
  behavior?: QuadrupedBehavior
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pack of them breaks step. */
  offset?: number
  /** Walk when the pointer comes over it, and sit when it is clicked. */
  interactive?: boolean
  onGaitChange?: (gait: QuadrupedGait) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  label?: string
}

function RobotQuadruped({
  gait, phase, view = NATIVE_VIEW, height = 0.5, stride = 0.6, lift = 0.5,
  behavior = "idle", speed = 0.75, animate = true, paused = false, offset = 0,
  interactive = true, onGaitChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerEnter, onPointerLeave, onPointerDown, ...props
}: RobotQuadrupedProps) {
  const controlled = phase !== undefined
  const [noticed, setNoticed] = React.useState(false)
  const [sitting, setSitting] = React.useState(false)

  // Being watched is what gets it up: an idle robot walks while the pointer is
  // over it, and one already walking carries on.
  const roused = interactive && noticed && !sitting
  const active: QuadrupedBehavior = sitting
    ? "static"
    : roused && (behavior === "idle" || behavior === "static")
      ? "walk"
      : behavior
  const resolvedGait: QuadrupedGait =
    gait ?? (active === "walk" ? "walk" : active === "trot" ? "trot" : "stand")

  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && active !== "static",
    paused,
    phase: offset,
  })
  const reported = React.useRef<QuadrupedGait | null>(null)
  React.useEffect(() => {
    if (reported.current === resolvedGait) return
    reported.current = resolvedGait
    onGaitChange?.(resolvedGait)
  }, [resolvedGait, onGaitChange])

  // Standing still, the breath is the only motion: a slow rise and fall at the
  // hips, which is enough to keep the drawing from reading as a diagram.
  const breath = active === "idle" && !controlled ? Math.sin(clock * 1.5) * 0.02 : 0
  const pose = solveQuadruped({
    gait: resolvedGait,
    phase: controlled ? phase : clock * speed,
    height: clamp(sitting ? height * 0.12 : height + breath, 0, 1),
    stride,
    lift,
  })
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const bodyY = 120 - pose.height

  function legDrawing(leg: QuadrupedLeg) {
    const far = leg.side === "right"
    return (
      <g key={leg.id} data-leg={leg.id} transform={`translate(${far ? 106 : 91} ${far ? 111 : 122}) scale(1 -1)`} opacity={far ? 0.55 : 1}>
        <path d={capsulePath(leg.hip, leg.knee, 3.8)} {...shell} />
        <path d={capsulePath(leg.knee, leg.foot, 2.6)} {...machined} />
        {[leg.hip, leg.knee].map((joint, i) => <g key={i}>
          <circle cx={px(joint.x)} cy={px(joint.y)} r={i === 0 ? 5.5 : 4} {...cast} />
          <circle cx={px(joint.x)} cy={px(joint.y)} r={1.6} fill={palette.metal} />
        </g>)}
        <rect x={px(leg.foot.x - 5)} y={px(leg.foot.y - 1.5)} width={10} height={3} rx={1.5} {...cast} />
        {showContacts && leg.contact && <ellipse data-contact cx={px(leg.foot.x)} cy={-3} rx={7} ry={1.3} fill={palette.accent} opacity={0.6} />}
      </g>
    )
  }
  // The drawing is a side elevation, so it goes through `wall` where it stands
  // and comes out untouched from the side. What one elevation could not say is
  // that the legs are either side of the body rather than behind one another:
  // off-axis they are tubes at half a track out, and the body is a box.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the frame, `across` units out from the centre plane. */
  const at = (x: number, y: number, across = 0) =>
    camera.project(across, GROUND - y, CENTRE - x)
  const legSolid = (leg: QuadrupedLeg) => {
    const across = (leg.side === "right" ? 1 : -1) * HALF_TRACK
    const point = (p: { x: number; y: number }) => at(91 + p.x, 122 - p.y, across)
    return (
      <g key={leg.id} data-leg={leg.id}>
        <path d={capsulePath(point(leg.hip), point(leg.knee), 3.8)} {...shell} />
        <path d={capsulePath(point(leg.knee), point(leg.foot), 2.6)} {...machined} />
      </g>
    )
  }
  const nearSide = camera.depth(HALF_TRACK, 0, 0) > camera.depth(-HALF_TRACK, 0, 0) ? "right" : "left"


  return (
    <svg role="img" data-view={view}
      aria-label={`Quadruped robot, ${sitting ? "sitting" : resolvedGait} pose, ${viewNames[view] ?? viewNames.profile}`}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (interactive) setNoticed(true)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (interactive) setNoticed(false)
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setSitting(current => !current)
      }}
      viewBox="0 0 200 150" width={width} height={width * 0.75}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }} {...props}>
      {showGround && <g stroke={palette.grid} strokeWidth={0.5} opacity={0.5}>
        <path d="M 25 126 H 176 M 42 110 H 190 M 25 126 L 42 110 M 176 126 L 190 110" fill="none" />
        {variant === "blueprint" && [50, 75, 100, 125, 150].map(x => <path key={x} d={`M ${x} 126 l 16 -16`} strokeDasharray="1 2" />)}
      </g>}
      {offAxis && <g data-solids transform={`translate(${CENTRE} ${GROUND}) scale(${fit})`}>
        {pose.legs.filter(leg => leg.side !== nearSide).map(legSolid)}
        <path
          d={extrudedPath(roundedFootprint(HALF_TRACK + 2, 53, 5, 4).map(p => ({ x: p.x, y: p.y + CENTRE - 104 })), camera, GROUND - (bodyY - 31), GROUND - (bodyY + 4))}
          {...shell}
        />
        {pose.legs.filter(leg => leg.side === nearSide).map(legSolid)}
      </g>}
      <Frame {...frame}>
      {pose.legs.filter(leg => leg.side === "right").map(legDrawing)}
      <g>
        <path d={`M 51 ${bodyY - 20} L 66 ${bodyY - 31} H 146 L 131 ${bodyY - 20} Z`} {...machined} />
        <path d={`M 131 ${bodyY - 20} L 146 ${bodyY - 31} V ${bodyY - 7} L 131 ${bodyY + 4} Z`} {...cast} />
        <rect x={51} y={bodyY - 20} width={80} height={24} rx={5} {...shell} />
        <rect x={73} y={bodyY - 15} width={35} height={14} rx={3} {...cast} />
        {[79, 85, 91, 97, 103].map(x => <line key={x} x1={x} y1={bodyY - 12} x2={x} y2={bodyY - 4} stroke={palette.metal} strokeWidth={1} />)}
        <path d={`M 67 ${bodyY - 23} l 8 -5 h 44 l -8 5 Z`} {...shell} />
        <rect x={134} y={bodyY - 22} width={23} height={13} rx={4} {...shell} />
        <rect x={145} y={bodyY - 19} width={11} height={7} rx={2} {...cast} />
        <circle cx={152} cy={bodyY - 15.5} r={1.5} fill={palette.accent} />
        <circle cx={62} cy={bodyY - 8} r={2} fill={palette.accent} />
      </g>
      {pose.legs.filter(leg => leg.side === "left").map(legDrawing)}
      </Frame>
      {label && <text x={100} y={145} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={4.5} fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

export { RobotQuadruped }
