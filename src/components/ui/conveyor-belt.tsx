"use client"

/**
 * conveyor-belt — the line the robots work over.
 *
 * Parts ride a looping belt. Leave it alone and it runs; drive `position` and
 * it becomes a readout — a queue, a build pipeline, a progress bar with
 * something physical on it. Interactive, it is a jog wheel: drag the belt to
 * scrub the line back and forth, let go and it carries on.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp } from "@/lib/robocn/kinematics"
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
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 76
const BELT_LEFT = 18
const BELT_RIGHT = 182
const BELT_TOP = 34
/** More parts than this stop reading as parts, so the belt caps here. */
/** The line is drawn from the side; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** How wide the bed is across the line — a number a side elevation never
 *  had to have — and the frame's own origin. */
const BED_ACROSS = 17
const CENTRE = VIEW_WIDTH / 2
const DATUM = BELT_TOP + 4

/** How far the camera pulls back so the machine still fits a frame that
 *  was drawn for one view. One in the view it was drawn in. */
const fits: Record<RobotView, number> = { plan: 0.4, front: 0.85, profile: 1, iso: 0.6 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const MAX_PARTS = 12
const DEFAULT_PARTS = 3

export interface ConveyorBeltProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Belt phase. Whole turns are equivalent, so 0.25, 1.25 and -0.75 all draw
   * the same belt. Leave it out and the belt runs on its own.
   */
  position?: number
  /** How many parts ride the belt, 0 to 12. */
  parts?: number
  /** Where the camera stands. One line, four projections. */
  view?: RobotView
  /** Turns per second when uncontrolled. */
  speed?: number
  animate?: boolean
  /** Freeze the belt where it stands. */
  paused?: boolean
  /** Turns of offset, so a bank of belts breaks step. */
  phase?: number
  /** Drag the belt to scrub it, or arrow-key it. */
  interactive?: boolean
  onPositionChange?: (position: number) => void
  /** Which way the parts travel. */
  direction?: "right" | "left"
  variant?: RobotVariant
  size?: RobotSize | number
  label?: string
}

function ConveyorBelt({
  position,
  parts = DEFAULT_PARTS,
  speed = 0.12,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onPositionChange,
  direction = "right",
  view = NATIVE_VIEW,
  variant = "solid",
  size = "md",
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
  ...props
}: ConveyorBeltProps) {
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
  const controlled = position !== undefined
  const count = Number.isFinite(parts)
    ? Math.round(clamp(parts, 0, MAX_PARTS))
    : DEFAULT_PARTS

  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? (position as number) : held
  // The belt's goal is simply the clock: one turn per `speed` seconds. Easing
  // only shows up on release, carrying a scrubbed belt back up to line speed.
  const motion = useRobotScalar((clock) => clock, {
    rate: Math.max(1, Math.abs(speed) * 4),
    hold,
    speed,
    animate: animate && !controlled,
    paused,
    phase,
  })

  const apply = React.useCallback((next: number) => {
    setHeld(next)
    onPositionChange?.(next)
  }, [onPositionChange, setHeld])
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => {
      if (!press.current) {
        press.current = { from: motion.value, at: unit.x }
        return
      }
      // One belt length per frame width, so the part under the finger stays
      // under the finger.
      const swept = (unit.x - press.current.at) * (direction === "left" ? -1 : 1)
      apply(press.current.from + swept)
    }, [apply, direction, motion.value]),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, [setHeld]),
  })

  // One turn is one belt length: whole turns wrap away so a controlled belt is
  // the same drawing at 0.25, 1.25 and -0.75.
  const turn = wrap(motion.value)
  const travel = direction === "left" ? -turn : turn

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)
  const span = BELT_RIGHT - BELT_LEFT

  // The drawing is a side elevation of the line, so it goes through `wall`
  // where it already stands and comes out untouched from the side. A conveyor
  // is a bed, though: its width across the line, the rollers as cylinders and
  // the two side frames only exist once the camera comes round.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE, DATUM, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** Frame coordinates in, world height out: y runs down the drawing. */
  const rise = (y: number) => DATUM - y
  /** A point on the machine, `across` units out from the centre plane. */
  const at = (x: number, y: number, across = 0) =>
    camera.project(across, rise(y), CENTRE - x)
  /** A slab from frame x `x0` to `x1`, `wide` either side of the centre plane. */
  const slab = (x0: number, x1: number, wide: number, top: number, bottom: number) =>
    extrudedPath(
      roundedFootprint(wide, Math.abs(x1 - x0) / 2, 2, 4).map((point) => ({
        x: point.x,
        y: point.y + CENTRE - (x0 + x1) / 2,
      })),
      camera,
      rise(top),
      rise(bottom),
    )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Conveyor belt carrying ${count} ${count === 1 ? "part" : "parts"}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(turn * 100) : undefined}
      aria-valuetext={interactive ? `${Math.round(turn * 100)}% along the belt` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn(
        "select-none overflow-hidden",
        interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      {...props}
    >
      {offAxis ? (
        <g data-solids transform={`translate(${CENTRE} ${DATUM}) scale(${fit})`}>
          <path d={slab(10, VIEW_WIDTH - 10, BED_ACROSS, BELT_TOP + 6, BELT_TOP + 16)} {...shell} />
          {[28, VIEW_WIDTH - 28].map((x) => (
            <path key={x} d={slab(x - 3, x + 3, BED_ACROSS - 3, BELT_TOP + 16, VIEW_HEIGHT - 8)} {...darkSurface} />
          ))}
          <path d={slab(16, VIEW_WIDTH - 16, BED_ACROSS, VIEW_HEIGHT - 8, VIEW_HEIGHT - 4)} {...darkSurface} />
          <path d={slab(BELT_LEFT, BELT_RIGHT, BED_ACROSS - 2, BELT_TOP, BELT_TOP + 8)} {...darkSurface} />
          {[BELT_LEFT, BELT_RIGHT].map((x) => (
            <path
              key={x}
              d={capsulePath(at(x, BELT_TOP + 4, -BED_ACROSS), at(x, BELT_TOP + 4, BED_ACROSS), 7)}
              {...metalSurface}
            />
          ))}
          {Array.from({ length: count }).map((_, index) => {
            const x = lerp(BELT_LEFT, BELT_RIGHT, wrap(index / Math.max(count, 1) + travel))
            return <path key={index} d={slab(x - 9, x + 9, 8, BELT_TOP - 16, BELT_TOP)} {...shell} />
          })}
        </g>
      ) : null}
      <Frame {...frame}>
      {/* Frame and legs. */}
      <rect x={10} y={BELT_TOP + 6} width={VIEW_WIDTH - 20} height={10} rx={3} {...shell} />
      {[28, VIEW_WIDTH - 28].map((x) => (
        <rect key={x} x={x - 3} y={BELT_TOP + 16} width={6} height={20} rx={2} {...darkSurface} />
      ))}
      <rect x={16} y={VIEW_HEIGHT - 8} width={VIEW_WIDTH - 32} height={4} rx={2} {...darkSurface} />

      {/* Belt surface, with the drive rollers at either end. */}
      <rect x={BELT_LEFT} y={BELT_TOP} width={span} height={8} rx={4} {...darkSurface} />
      {[BELT_LEFT, BELT_RIGHT].map((x) => (
        <g key={x} transform={`translate(${x} ${BELT_TOP + 4})`}>
          <circle r={7} {...metalSurface} />
          <g transform={`rotate(${px(travel * 360)})`}>
            <line
              x1={-4.5}
              y1={0}
              x2={4.5}
              y2={0}
              stroke={palette.dark}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </g>
        </g>
      ))}

      {/* Cleats: the tell that the belt is moving rather than the parts. */}
      {Array.from({ length: 11 }).map((_, index) => {
        const t = wrap(index / 11 + travel)
        return (
          <line
            key={index}
            x1={px(lerp(BELT_LEFT, BELT_RIGHT, t))}
            y1={BELT_TOP + 1.5}
            x2={px(lerp(BELT_LEFT, BELT_RIGHT, t))}
            y2={BELT_TOP + 6.5}
            stroke={palette.metal}
            strokeWidth={1}
            opacity={0.5}
          />
        )
      })}

      {Array.from({ length: count }).map((_, index) => {
        const t = wrap(index / Math.max(count, 1) + travel)
        return (
          <g
            key={index}
            data-part={index}
            transform={`translate(${px(lerp(BELT_LEFT, BELT_RIGHT, t))} ${BELT_TOP})`}
          >
            <rect x={-9} y={-16} width={18} height={16} rx={2.5} {...shell} />
            <rect x={-5} y={-12} width={10} height={8} rx={1.5} fill={palette.accent} opacity={0.9} />
          </g>
        )
      })}

      {label ? (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 14}
          textAnchor="middle"
          fontSize={7}
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.4"
          fill={palette.grid}
        >
          {label}
        </text>
      ) : null}
      </Frame>
    </svg>
  )
}

/** Fold any number of turns into 0..1. Non-finite input parks the belt at 0. */
function wrap(value: number) {
  if (!Number.isFinite(value)) return 0
  return ((value % 1) + 1) % 1
}

export { ConveyorBelt }
