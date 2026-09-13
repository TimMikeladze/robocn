"use client"

/**
 * belt-drive — a toothed belt between two pulleys, with a tensioner.
 *
 * Not the conveyor: nothing rides on this belt, it transmits. The path is the
 * taut one — external tangents and real wrap angles from `transmission.ts` —
 * so moving the idler lengthens the belt and changes how much of each pulley
 * it holds. Teeth march by arc length, which is what makes the driven pulley
 * turn at the ratio the tooth counts actually give rather than at a number
 * typed into the drawing.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  capsulePath,
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
import { beltLayout, beltSample, gearPath } from "@/lib/robocn/transmission"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 150
const CENTRE = { x: 100, y: 74 }
/** Pitch radius per tooth. The belt pitch is `2π × MODULE`. */
const MODULE = 1.15
const DRIVE = { x: 52, y: 68 }
const DRIVEN = { x: 148, y: 68 }
const IDLER = { x: 100, top: 104, travel: 16, radius: 9 }
/** Turns of the drive pulley across the full width of the drawing. */
const DRAG_TURNS = 1.6
/** Belt travel, in drive turns per second, while slewing back to the loop. */
const SLEW_RATE = 1.4
/** Drawn face on, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
const PLATE_BACK = -12
const PULLEY_FRONT = 9

const fits: Record<RobotView, number> = { plan: 0.92, front: 1, profile: 0.92, iso: 0.88 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type BeltDriveBehavior = "run" | "shuttle" | "static"

export interface BeltDriveProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled belt travel, in turns of the drive pulley. Omit to run `behavior`. */
  travel?: number
  /** What the belt does when `travel` is not supplied. */
  behavior?: BeltDriveBehavior
  /** Where the camera stands. One drive, four projections. */
  view?: RobotView
  /** Drive turns per second, or shuttles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the belt along its run, or arrow-key it. */
  interactive?: boolean
  onTravelChange?: (travel: number) => void
  /** Teeth on the driving pulley, clamped to 10–48. */
  driveTeeth?: number
  /** Teeth on the driven pulley, clamped to 10–48. */
  drivenTeeth?: number
  /** How far the idler is wound down its slot, 0–1. Lengthens the belt. */
  tension?: number
  showIdler?: boolean
  showPlate?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BeltDrive({
  travel,
  behavior = "run",
  view = NATIVE_VIEW,
  speed = 0.35,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTravelChange,
  driveTeeth = 18,
  drivenTeeth = 30,
  tension = 0.45,
  showIdler = true,
  showPlate = true,
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
}: BeltDriveProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = travel !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(travel) ? travel : 0) : held
  const goal = React.useCallback((clock: number) => beltGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 6),
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const turns = Number.isFinite(motion.value) ? motion.value : 0

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onTravelChange?.(next)
    },
    [onTravelChange, setHeld],
  )
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: motion.value, at: unit.x }
          return
        }
        apply(press.current.from + (unit.x - press.current.at) * DRAG_TURNS)
      },
      [apply, motion.value],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
    }, []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const drive = teethOf(driveTeeth)
  const driven = teethOf(drivenTeeth)
  const driveRadius = drive * MODULE
  const drivenRadius = driven * MODULE
  const wind = Number.isFinite(tension) ? clamp(tension, 0, 1) : 0
  const idlerY = IDLER.top + wind * IDLER.travel

  const pulleys = [
    { x: DRIVE.x, y: DRIVE.y, radius: driveRadius },
    { x: DRIVEN.x, y: DRIVEN.y, radius: drivenRadius },
    ...(showIdler ? [{ x: IDLER.x, y: idlerY, radius: IDLER.radius }] : []),
  ]
  const belt = beltLayout(pulleys)
  const pitch = 2 * Math.PI * MODULE
  const along = turns * 2 * Math.PI * driveRadius
  const teeth = belt.length > 0 ? Math.min(96, Math.floor(belt.length / pitch)) : 0
  const driveAngle = turns * 360
  const drivenAngle = turns * 360 * (drive / driven)
  const idlerAngle = -turns * 360 * (driveRadius / IDLER.radius)
  const ratio = px(driven / drive)

  // The drawing is the drive's own face, so it goes through `wall` where it
  // already stands. The pulleys, the plate and the shafts have a depth that
  // only reads once the camera comes round.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE.x, CENTRE.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const at = (dx: number, dy: number, depth = 0) => {
    const p = camera.project(CENTRE.x - dx, CENTRE.y - dy, -depth)
    return { x: CENTRE.x + p.x, y: CENTRE.y + p.y }
  }
  const cyl = (dx: number, dy: number, radius: number, from: number, to: number) =>
    capsulePath(at(dx, dy, from), at(dx, dy, to), radius)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Belt drive, ${drive} to ${driven} teeth, ${ratio} to 1 reduction, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? px(wrap360(driveAngle)) : undefined}
      aria-valuetext={
        interactive
          ? `drive ${px(wrap360(driveAngle))} degrees, driven ${px(wrap360(drivenAngle))} degrees`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.05, 0.5)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 200 150"
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
      data-view={view}
      {...props}
    >
      <g
        transform={
          fit === 1 ? undefined : `translate(${CENTRE.x} ${CENTRE.y}) scale(${fit}) translate(${-CENTRE.x} ${-CENTRE.y})`
        }
      >
        {offAxis && (
          <g data-solids>
            {showPlate && (
              <path
                d={capsulePath(at(DRIVE.x, DRIVE.y, PLATE_BACK), at(DRIVEN.x, DRIVEN.y, PLATE_BACK), 46)}
                {...cast}
              />
            )}
            <path d={cyl(DRIVE.x, DRIVE.y, driveRadius, PLATE_BACK + 2, PULLEY_FRONT)} {...machined} />
            <path d={cyl(DRIVEN.x, DRIVEN.y, drivenRadius, PLATE_BACK + 2, PULLEY_FRONT)} {...machined} />
            {showIdler && (
              <path d={cyl(IDLER.x, idlerY, IDLER.radius, PLATE_BACK + 2, PULLEY_FRONT)} {...machined} />
            )}
            <path d={cyl(DRIVE.x, DRIVE.y, 5, PULLEY_FRONT, PULLEY_FRONT + 18)} {...cast} />
          </g>
        )}

        <Frame {...frame}>
          <g data-drive>
            {showPlate && (
              <g data-plate>
                <path
                  d={capsulePath(DRIVE, DRIVEN, 46)}
                  {...cast}
                  fillOpacity={variant === "solid" ? 0.35 : undefined}
                />
                {[DRIVE, DRIVEN].map((p) => (
                  <circle key={p.x} cx={p.x} cy={p.y} r={5} {...machined} />
                ))}
              </g>
            )}
            {showIdler && (
              <g data-slot>
                <rect
                  x={IDLER.x - 4}
                  y={IDLER.top - 8}
                  width={8}
                  height={IDLER.travel + 16}
                  rx={4}
                  {...cast}
                />
                <path
                  d={`M ${IDLER.x} ${IDLER.top - 4} V ${IDLER.top + IDLER.travel + 4}`}
                  stroke={palette.grid}
                  strokeWidth={0.6}
                  strokeDasharray="2 2"
                />
              </g>
            )}

            <path data-belt d={belt.d} fill="none" stroke={palette.metal} strokeWidth={8} strokeLinejoin="round" />
            <path d={belt.d} fill="none" stroke={palette.dark} strokeWidth={5.6} strokeLinejoin="round" />
            <g data-teeth stroke={palette.metal} strokeWidth={1.3} strokeLinecap="round">
              {Array.from({ length: teeth }, (_, i) => {
                const on = beltSample(belt, i * pitch + along)
                const inward = ((on.heading + 90) * Math.PI) / 180
                return (
                  <path
                    key={i}
                    d={`M ${px(on.x)} ${px(on.y)} l ${px(Math.cos(inward) * 3.4)} ${px(Math.sin(inward) * 3.4)}`}
                  />
                )
              })}
            </g>

            <g data-pulley="driven" transform={`translate(${DRIVEN.x} ${DRIVEN.y})`}>
              <circle r={drivenRadius + 3} {...machined} />
              <g transform={`rotate(${px(drivenAngle)})`}>
                <path
                  d={gearPath(driven, drivenRadius, { addendum: MODULE * 0.5, dedendum: MODULE * 0.5, width: 0.28 })}
                  {...shell}
                />
                <path d={`M 0 0 L ${px(drivenRadius - 4)} 0`} stroke={palette.dark} strokeWidth={1.2} />
              </g>
              <circle r={drivenRadius * 0.34} {...cast} />
              <circle r={4} {...machined} />
            </g>
            <g data-pulley="drive" transform={`translate(${DRIVE.x} ${DRIVE.y})`}>
              <circle r={driveRadius + 3} {...machined} />
              <g transform={`rotate(${px(driveAngle)})`}>
                <path
                  d={gearPath(drive, driveRadius, { addendum: MODULE * 0.5, dedendum: MODULE * 0.5, width: 0.28 })}
                  {...shell}
                />
                <path d={`M 0 0 L ${px(driveRadius - 4)} 0`} stroke={palette.accent} strokeWidth={1.6} />
              </g>
              <circle r={driveRadius * 0.36} {...cast} />
              <circle r={4} {...machined} />
            </g>
            {showIdler && (
              <g data-idler transform={`translate(${IDLER.x} ${px(idlerY)})`}>
                <circle r={IDLER.radius} {...cast} />
                <g transform={`rotate(${px(idlerAngle)})`}>
                  <path d={`M 0 0 L ${IDLER.radius - 2} 0`} stroke={palette.metal} strokeWidth={1.2} />
                </g>
                <circle r={3} {...machined} />
              </g>
            )}
            {variant === "blueprint" && (
              <g fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.7}>
                <circle cx={DRIVE.x} cy={DRIVE.y} r={px(driveRadius)} />
                <circle cx={DRIVEN.x} cy={DRIVEN.y} r={px(drivenRadius)} />
                <path d={`M ${DRIVE.x} ${DRIVE.y} H ${DRIVEN.x}`} />
              </g>
            )}
          </g>
        </Frame>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={100} y={140} fontSize={5}>
          {`${drive}T:${driven}T / ${ratio}:1 / BELT ${px(belt.length)}`}
        </text>
        {label && (
          <text x={100} y={147} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Belt travel in drive turns at `clock`. `shuttle` runs it back and forth. */
export function beltGoal(behavior: BeltDriveBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "shuttle") return Math.sin(clock * Math.PI * 2) * 0.8
  return clock
}

const teethOf = (teeth: number) =>
  Number.isFinite(teeth) ? clamp(Math.round(teeth), 10, 48) : 18

const wrap360 = (value: number) => (Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0)

export { BeltDrive }
