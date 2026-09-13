"use client"

/**
 * rotary-table — an indexing platter.
 *
 * Uncontrolled it indexes: a station steps up to the pointer, dwells, and the
 * next one follows. The staircase is the goal and the platter's slew rate is
 * what draws the move, so the drawing gets its timing from the mechanism
 * rather than from a keyframe. Interactive, the platter is a dial — spin it,
 * or click a fixture to bring it round to the pointer.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import type { Vec2 } from "@/lib/robocn/kinematics"
import {
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

const VIEW = 180
/** Platter centre in view units; drags are measured from here. */
const CENTRE = { x: 90, y: 86 }
/** Degrees per second the platter slews between stations. */
const INDEX_RATE = 150
/** A press that moves less than this many degrees is a click on a fixture. */
const CLICK_SLOP = 4
/** The table is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"
/** Heights the plan view never had to name: the base slab under the platter,
 *  the platter itself, and the fixtures standing on it. */
const BASE_TOP = 0
const BASE_BOTTOM = -14
const PLATTER_TOP = 7
const FIXTURE_TOP = 17

/** How far the camera pulls back so the table still fits its square frame. */
const fits: Record<RobotView, number> = { plan: 1, front: 0.94, profile: 0.94, iso: 0.9 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type RotaryBehavior = "index" | "spin" | "static"

export interface RotaryTableProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  /** Controlled clockwise platter angle in degrees. Omit to run `behavior`. */
  angle?: number
  /** What the platter does when `angle` is not supplied. */
  behavior?: RotaryBehavior
  /** Where the camera stands. One table, four projections. */
  view?: RobotView
  /** Index steps per second, or turns per second while spinning. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag to spin, click a fixture to index it to the pointer, arrow to step. */
  interactive?: boolean
  onAngleChange?: (angle: number) => void
  /** The station now standing under the fixed pointer. */
  onStationChange?: (station: number) => void
  /** Equally spaced fixtures, rounded and clamped to 0–12. */
  stations?: number
  /** Draw a workpiece in each fixture. */
  loaded?: boolean
  showTicks?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RotaryTable({
  angle, behavior = "index", view = NATIVE_VIEW, speed = 0.5, animate = true, paused = false, phase = 0,
  interactive = false, onAngleChange, onStationChange,
  stations = 6, loaded = true, showTicks = true, label,
  size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: RotaryTableProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const count = Number.isFinite(stations) ? Math.max(0, Math.min(12, Math.round(stations))) : 6
  const step = count > 0 ? 360 / count : 90
  const controlled = angle !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(angle) ? angle : 0) : held
  const goal = React.useCallback(
    (clock: number) => (behavior === "spin" ? clock * 360 : Math.floor(clock) * step),
    [behavior, step],
  )
  const motion = useRobotScalar(goal, {
    // Spinning has to be able to keep up with its own goal; indexing gets the
    // slew rate, which is what makes the dwell read as a dwell.
    rate: behavior === "spin" ? Math.max(INDEX_RATE, Math.abs(speed) * 720) : INDEX_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const rotation = wrap360(motion.value)

  const apply = React.useCallback((next: number) => {
    setHeld(next)
    onAngleChange?.(wrap360(next))
  }, [onAngleChange, setHeld])

  // A press that ends where it started is a click on whatever fixture is
  // under it; anything more is a spin.
  const press = React.useRef<{ from: number; at: number; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => {
      const dx = unit.x * VIEW - CENTRE.x
      const dy = unit.y * VIEW - CENTRE.y
      if (Math.hypot(dx, dy) < 6) return
      const pointer = (Math.atan2(dx, -dy) * 180) / Math.PI
      if (!press.current) {
        press.current = { from: motion.value, at: pointer, moved: false }
        return
      }
      const swept = wrapSigned(pointer - press.current.at)
      if (Math.abs(swept) > CLICK_SLOP) press.current.moved = true
      if (press.current.moved) apply(press.current.from + swept)
    }, [apply, motion.value]),
    onDragEnd: React.useCallback(() => {
      const started = press.current
      press.current = null
      if (!started) return
      if (started.moved || count === 0) {
        if (!started.moved) setHeld(null)
        return
      }
      // Bring the fixture that was pressed round to the index pointer.
      const local = started.at - wrap360(started.from)
      const station = ((Math.round(local / step) % count) + count) % count
      const target = nearestTurn(started.from, -station * step)
      setHeld(target)
      onAngleChange?.(wrap360(target))
      onStationChange?.(station)
    }, [count, step, onAngleChange, onStationChange, setHeld]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const readout = px(rotation)

  // The drawing is the horizontal plane the platter turns in, so it goes
  // through `plane` and comes out untouched from above — the platter's own
  // rotation composes onto it, so a tipped table still indexes truthfully.
  // The base, the platter's thickness and the fixtures are solids.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const zoom = fit === 1 ? "" : `scale(${fit})`
  const deck = camera.plane(PLATTER_TOP, readout)
  const solid = (footprint: Vec2[], top: number, bottom: number, spin = 0) =>
    extrudedPath(footprint, camera, top, bottom, spin)

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Rotary table, ${count} stations, angle ${Math.round(rotation)} degrees, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, step, step * 3)
        if (delta !== 0) {
          const target = Math.round((motion.value + delta) / step) * step
          apply(target)
          if (count > 0) onStationChange?.(((Math.round(-target / step) % count) + count) % count)
        } else if (event.key === "Home") {
          apply(nearestTurn(motion.value, 0))
          onStationChange?.(0)
        } else if (event.key === "Escape") {
          setHeld(null)
        } else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>
      <g data-view={view} transform={`translate(90 86) ${zoom}`.trimEnd()}>
        {offAxis ? (
          <g data-solids>
            <path d={solid(roundedFootprint(57, 57, 10, 5), BASE_TOP, BASE_BOTTOM)} {...cast} />
            <path d={solid(roundedFootprint(15.5, 17, 5, 4).map(p => ({ x: p.x + 62.5, y: p.y })), 6, BASE_BOTTOM + 3)} {...shell} />
            <path d={solid(circleFootprint(0, 0, 64, 20), BASE_TOP, BASE_BOTTOM + 2)} {...cast} />
            <path d={solid(circleFootprint(0, 0, 59, 20), PLATTER_TOP, BASE_TOP)} {...machined} />
            {Array.from({ length: count }, (_, i) => (
              <path
                key={i}
                d={solid(
                  roundedFootprint(10, 10, 3, 4).map(p => ({ x: p.x, y: p.y - 38 })),
                  FIXTURE_TOP,
                  PLATTER_TOP,
                  readout + (i * 360) / count,
                )}
                {...cast}
              />
            ))}
            <path d={solid(circleFootprint(0, 0, 20, 14), FIXTURE_TOP + 3, PLATTER_TOP)} {...shell} />
          </g>
        ) : null}
        <g data-base transform={offAxis ? camera.plane(BASE_TOP) : undefined}>
          <rect x={-57} y={-57} width={114} height={114} rx={10} {...cast} />
          {[-49, 49].flatMap(x => [-49, 49].map(y => <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={4} {...machined} />
            <path d={`M ${x - 2} ${y} h 4`} stroke={palette.dark} strokeWidth={1} />
          </g>))}
          <rect x={47} y={-17} width={31} height={34} rx={5} {...shell} />
          <rect x={68} y={-12} width={9} height={24} rx={2} {...cast} />
          <path d="M 70 -7 h 5 M 70 -2 h 5 M 70 3 h 5 M 70 8 h 5" stroke={palette.metal} strokeWidth={1} />
          <circle r={64} {...cast} />
        </g>
        <g data-platter transform={deck}>
          <circle r={59} {...machined} />
          <circle r={52} fill="none" stroke={palette.dark} strokeWidth={0.5} />
          {showTicks && Array.from({ length: 36 }, (_, i) => <path key={i} d={`M 0 -${i % 3 === 0 ? 53 : 55} V -58`}
            transform={`rotate(${i * 10})`} stroke={palette.dark} strokeWidth={0.7} />)}
          {Array.from({ length: count }, (_, i) => <g key={i} data-fixture={i}
            transform={`rotate(${px(i * 360 / count)}) translate(0 -38)`}>
            <rect x={-10} y={-10} width={20} height={20} rx={3} {...cast} />
            {loaded && <rect x={-6} y={-7} width={12} height={14} rx={2} {...shell} />}
            {[-8, 8].map(x => <rect key={x} x={x - 1.5} y={-4} width={3} height={8} rx={0.5} fill={palette.metal} />)}
          </g>)}
          <circle r={20} {...shell} />
          <circle r={11} {...cast} />
          <circle r={5} {...machined} />
          <path d="M -3 -13 L 0 -17 L 3 -13" fill="none" stroke={palette.accent} strokeWidth={1.5} />
          {[0, 90, 180, 270].map(degrees => <circle key={degrees} cy={15} r={1.5} transform={`rotate(${degrees})`} fill={palette.dark} />)}
        </g>
        <path d="M -4 -72 L 0 -65 L 4 -72 Z" fill={palette.accent} />
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={90} y={163} fontSize={5}>{`${readout}° / ${count} STATIONS`}</text>
        {label && <text x={90} y={175} fontSize={4.5}>{label}</text>}
      </g>
    </svg>
  )
}

/** Degrees folded into 0..360. Non-finite input parks at zero. */
const wrap360 = (value: number) => (Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0)

/** The same bearing expressed as the shortest signed turn, -180..180. */
const wrapSigned = (value: number) => {
  const wrapped = wrap360(value)
  return wrapped > 180 ? wrapped - 360 : wrapped
}

/** `goal` moved into the turn `from` is currently in, so it takes the short way. */
const nearestTurn = (from: number, goal: number) =>
  goal + 360 * Math.round((from - goal) / 360)

export { RotaryTable }
