"use client"

/**
 * rowing-erg — the one machine in this family with real dynamics.
 *
 * A fan flywheel is retarded by `k·ω²`, and the damper vent sets `k`: open it,
 * more air reaches the cage, `k` rises, and so does the **drag factor** `k / I`
 * — the number a rower actually reads off a monitor. The chain drives the wheel
 * through a one-way clutch, so while the chain is faster than the rim the wheel
 * is *driven* and the handle holds `k·ω² / sprocket`. That is why an erg gets
 * harder the faster it is pulled rather than the further, and why the vent
 * changes the force without changing how fast the wheel can be spun.
 *
 * Drop below rim speed and the clutch lets go; the wheel then coasts on drag
 * alone, `dω/dt = −k·ω²/I`, all the way round to the next catch. The fan is
 * drawn where the **integral of its own speed** puts it — it is not spun at a
 * rate anyone picked.
 *
 * Handle and seat travel in opposite directions over one window of the stroke:
 * the slide is still coming forward at the catch when the chain has already
 * gone taut. `counterPhase` reports how much of the cycle that is, measured off
 * the samples rather than asserted, and the machine carries it as a data hook.
 *
 * The mechanism is solved in `src/lib/robocn/gym.ts` — pure, no React, tested on
 * its own. `solveErgCycle` integrates one stroke repeatedly until the speed it
 * starts at is the speed it ends at, so what is drawn is the steady state and
 * not a spin-up; the component memoises that cycle and samples it by phase,
 * which is what keeps every behaviour a pure function of the clock.
 *
 * Illustrated: there is no rower. The handle and seat schedules are chosen ramps
 * with the sequencing a coach would recognise — legs, body, arms, and the
 * reverse coming back — and everything downstream of them is integrated from
 * those ramps. No bearing friction, no chain mass, no stretch.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, type Vec2 } from "@/lib/robocn/kinematics"
import { defaultErgGeometry, ergAt, solveErgCycle, type ErgGeometry } from "@/lib/robocn/gym"
import {
  boxCorners,
  elevationDraft,
  fitTransform,
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

/** What the machine does with nobody driving it. Always includes `static`. */
export type RowingErgBehavior = "row" | "sprint" | "paddle" | "static"

const VIEW_WIDTH = 260
const VIEW_HEIGHT = 144
const NATIVE_VIEW: RobotView = "profile"

/** World units. x along the drawing, y up from the ground, z out of the plane. */
const ENVELOPE = boxCorners({ x: -30, y: 0, z: -106 }, { x: 30, y: 124, z: 112 })

/** The fan's axle, and the sprocket the chain is wound on. */
const AXLE: Vec2 = { x: -76, y: 68 }
const FAN_RADIUS = 36
const SPROCKET: Vec2 = { x: -76, y: 68 }
/** The chain's line: a straight horizontal run from the sprocket to the hands. */
const CHAIN_Y = 56
/** Where the handle and the seat sit at the catch, and the rail they run on. */
const HANDLE_HOME = -22
const SEAT_HOME = 10
const RAIL: [Vec2, Vec2] = [
  { x: -30, y: 34 },
  { x: 96, y: 30 },
]
const BLADES = 8

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap01 = (value: number) =>
  Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0

/**
 * How hard the stroke is being taken, as a multiplier on the rate. This is the
 * whole difference between the behaviours, and it is a *physical* difference:
 * the drag factor is a property of the vent, so rowing harder does not change
 * it — it changes the speed, and the force goes as the square of that.
 */
export function rowingErgTempo(behavior: RowingErgBehavior): number {
  switch (behavior) {
    case "sprint":
      return 1.7
    case "paddle":
      return 0.62
    default:
      return 1
  }
}

/**
 * Where in the stroke the machine is at `clock`, **unwrapped**, so the easing
 * never has to cross a seam and rewind a stroke. Every behaviour is a pure
 * function of the clock, exported so motion can be tested by sampling it rather
 * than by faking animation frames.
 */
export function rowingErgPhase(behavior: RowingErgBehavior, clock: number): number {
  // Parked a third of the way down the drive, where the chain is taut and the
  // wheel is being driven — the pose that shows the machine doing its job.
  if (behavior === "static" || !Number.isFinite(clock)) return 0.32
  return clock * rowingErgTempo(behavior)
}

export interface RowingErgProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position in the stroke: 0 at the catch, round to 1 at the next. Supplying it stops the loop. */
  strokePhase?: number
  onStrokePhaseChange?: (strokePhase: number) => void
  behavior?: RowingErgBehavior
  /**
   * The damper vent, 0 shut to 1 wide open: how much air reaches the cage. It
   * sets the drag factor, and the drag factor is what the label reports.
   */
  vent?: number
  /** Draw the chain and the handle's run. */
  showChain?: boolean
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
  view?: RobotView
  /** Strokes per second. This is a real rate: the dynamics are solved at it. */
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RowingErg({
  strokePhase,
  onStrokePhaseChange,
  behavior = "row",
  vent = 0.5,
  showChain = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.4,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
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
  "aria-label": ariaLabel,
  ...props
}: RowingErgProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = strokePhase !== undefined

  const hold = controlled ? (Number.isFinite(strokePhase) ? (strokePhase as number) : 0) : held
  const goal = React.useCallback((clock: number) => rowingErgPhase(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    // Fast enough to keep up with its own goal, or the stroke lags behind and
    // the seat stops matching the handle.
    rate: Math.max(1.4, Math.abs(speed) * 6),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const at = wrap01(motion.value)
  // Whole strokes finished, so the fan keeps turning across the seam instead of
  // snapping back to where it stood at the last catch.
  const strokes = Math.max(0, Math.floor(motion.value))

  const geometry: ErgGeometry = React.useMemo(
    () => ({
      ...defaultErgGeometry,
      vent: clamp(Number.isFinite(vent) ? vent : 0.5, 0, 1),
      // The rate the dynamics are solved at is the rate the drawing runs at, so
      // pulling the speed up really does make the handle heavier.
      rate: Math.max(0.05, Math.abs(Number.isFinite(speed) ? speed : 0.4)) * rowingErgTempo(behavior),
    }),
    [vent, speed, behavior],
  )
  // Solved once per geometry, not once per frame: the cycle is the machine's
  // steady state and has nothing to do with which frame this is.
  const cycle = React.useMemo(() => solveErgCycle(geometry), [geometry])
  const sample = ergAt(cycle, at)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = wrap01(next)
      setHeld(bounded)
      onStrokePhaseChange?.(bounded)
    },
    [onStrokePhaseChange],
  )
  const dragging = useRobotDrag(svgRef, {
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /* -------------------------------------------------- where everything sits */

  const handleX = HANDLE_HOME + sample.handle
  const seatX = SEAT_HOME + sample.seat
  const railAt = (x: number) => {
    const t = clamp((x - RAIL[0].x) / (RAIL[1].x - RAIL[0].x), 0, 1)
    return { x, y: RAIL[0].y + (RAIL[1].y - RAIL[0].y) * t }
  }
  const seat = railAt(seatX)
  // The fan is where the integral of its own speed has left it.
  const spin = toDegrees(sample.wheelAngle) + strokes * cycle.turnsPerStroke * 360
  const blades = Array.from({ length: BLADES }, (_, index) => (index * 360) / BLADES + spin)

  // The vent's own travel across the face of the cage.
  const ventAt = AXLE.y + 22 - geometry.vent * 34
  const opposed = sample.handleRate * sample.seatRate < 0
  // Arrow lengths are normalised against the stroke's own fastest handle, so a
  // slow-but-moving part still draws one. Without that the counter-travel
  // window — where both rates are small — would show only one of its two arrows.
  const quickest = Math.max(
    1e-6,
    ...cycle.samples.map((entry) => Math.abs(entry.handleRate)),
  )
  const arrow = (rate: number) =>
    Math.abs(rate) < 1e-6
      ? 0
      : Math.sign(rate) * (6 + 15 * Math.min(1, Math.abs(rate) / quickest))

  const dragFactor = Math.round(cycle.dragFactor * 1000) / 1000
  const rate = Math.round(cycle.strokeRate)
  const force = Math.round(sample.force)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Rowing erg, damper vent ${Math.round(geometry.vent * 100)} percent for a drag factor of ${dragFactor}, ${rate} strokes a minute, ${sample.engaged ? `chain driving the wheel at ${force} on the handle` : "coasting on the recovery"}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(at) : undefined}
      aria-valuetext={
        interactive ? `${Math.round(at * 100)} percent through the stroke, drag factor ${dragFactor}` : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.02, 0.1)
        if (delta !== 0) apply(at + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(0.5)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
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
      {...props}
    >
      {variant === "blueprint" && (
        <path
          d={`M 10 ${VIEW_HEIGHT - 20} H ${VIEW_WIDTH - 10}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={solid([{ x: -118, y: 0 }, { x: 100, y: 0 }], 30)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -118, y: 0 }, { x: 100, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-frame>
          {/* Front feet under the cage, and the rear foot under the rail. */}
          <path d={box(-114, 0, -44, 9, 26)} {...cast} />
          <path d={box(80, 0, 98, 8, 20)} {...cast} />
          <path d={bar({ x: 88, y: 8 }, { x: 88, y: 31 }, 4, 5)} {...shell} />
          {/* The monorail the seat runs on. */}
          <path data-rail d={bar(RAIL[0], RAIL[1], 3.4, 7)} {...machined} />
          {/* Footplates, fixed: the person moves, these do not. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-footplate
              d={bar({ x: -30, y: 18 }, { x: -20, y: 48 }, 6.5, 6, side * 13)}
              {...shell}
            />
          ))}
        </g>

        {/* The fan, in its cage. Drawn where the integral of ω has left it. */}
        <g data-flywheel data-speed={px(sample.speed)} data-spin={px(spin)}>
          <path d={disc(AXLE, FAN_RADIUS + 7, 15)} {...shell} />
          <path d={disc(AXLE, FAN_RADIUS + 1, 16)} {...cast} />
          {blades.map((angle) => {
            const radians = (angle * Math.PI) / 180
            const inner = {
              x: AXLE.x + Math.cos(radians) * 9,
              y: AXLE.y + Math.sin(radians) * 9,
            }
            const outer = {
              x: AXLE.x + Math.cos(radians) * FAN_RADIUS,
              y: AXLE.y + Math.sin(radians) * FAN_RADIUS,
            }
            return (
              <path key={px(angle)} data-blade d={bar(inner, outer, 3.4, 2, 6)} {...machined} />
            )
          })}
          <path d={disc(AXLE, 8, 8)} {...cast} />
          {/* The cage's guard ribs, which do not turn. */}
          {[0, 45, 90, 135].map((angle) => {
            const radians = (angle * Math.PI) / 180
            return (
              <path
                key={angle}
                d={line(
                  [
                    { x: AXLE.x - Math.cos(radians) * (FAN_RADIUS + 4), y: AXLE.y - Math.sin(radians) * (FAN_RADIUS + 4) },
                    { x: AXLE.x + Math.cos(radians) * (FAN_RADIUS + 4), y: AXLE.y + Math.sin(radians) * (FAN_RADIUS + 4) },
                  ],
                  17,
                )}
                fill="none"
                stroke={palette.metal}
                strokeWidth={1.2}
                opacity={0.55}
              />
            )
          })}
        </g>

        {/* The damper vent: the one control that moves the drag factor. */}
        <g data-vent data-drag-factor={px(cycle.dragFactor)}>
          <path d={box(-46, AXLE.y - 14, -38, AXLE.y + 24, 4, 17)} {...cast} />
          <path d={bar({ x: -50, y: ventAt }, { x: -34, y: ventAt }, 2.6, 2.6, 19)} {...shell} />
          <path d={disc({ x: -42, y: ventAt }, 2.4, 2.4, 21)} fill={palette.accent} stroke="none" />
        </g>

        {/* The chain, on its one-way clutch, and the handle on the end of it. */}
        {showChain && (
          <g data-chain data-engaged={sample.engaged ? "" : undefined}>
            <path d={disc(SPROCKET, 9, 3, 22)} {...machined} />
            <path
              d={line([{ x: SPROCKET.x, y: CHAIN_Y }, { x: handleX, y: CHAIN_Y }], 22)}
              fill="none"
              stroke={sample.engaged ? palette.accent : palette.metal}
              strokeWidth={2.2}
              strokeLinecap="round"
              opacity={sample.engaged ? 1 : 0.6}
            />
          </g>
        )}

        {/* The handle, seen end-on: a grip bar across the machine. */}
        <g data-handle data-x={px(handleX)} data-rate={px(sample.handleRate)}>
          <path d={bar({ x: handleX, y: CHAIN_Y - 11 }, { x: handleX, y: CHAIN_Y + 11 }, 3.4, 15)} {...shell} />
          <path d={bar({ x: handleX - 4, y: CHAIN_Y }, { x: handleX + 4, y: CHAIN_Y }, 2, 4)} {...cast} />
          <path d={disc({ x: handleX, y: CHAIN_Y }, 3, 16)} fill={palette.accent} stroke="none" />
        </g>

        <g data-seat data-x={px(seatX)} data-rate={px(sample.seatRate)}>
          <path d={box(seat.x - 16, seat.y + 5, seat.x + 16, seat.y + 13, 14)} {...shell} />
          <path d={box(seat.x - 7, seat.y + 1, seat.x + 7, seat.y + 6, 9)} {...cast} />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={disc({ x: seat.x + side * 9, y: seat.y + 1 }, 2.4, 1.6, side * 8)}
              {...machined}
            />
          ))}
        </g>

        {/*
          Which way each of them is going. In the window at the catch they point
          opposite ways, which is the sequencing and not a drawn flourish.
        */}
        <g data-travel data-opposed={opposed ? "" : undefined} opacity={0.9}>
          {([
            ["handle", handleX, CHAIN_Y + 15, sample.handleRate] as const,
            ["seat", seatX, seat.y + 19, sample.seatRate] as const,
          ]).map(([name, x, y, speed]) => {
            const reach = arrow(speed)
            if (reach === 0) return null
            return (
              <path
                key={name}
                data-arrow={name}
                d={line([{ x, y }, { x: x + reach, y }], 24)}
                fill="none"
                stroke={opposed ? palette.accent : palette.foreground}
                strokeWidth={opposed ? 2 : 1.2}
                strokeLinecap="round"
                opacity={opposed ? 1 : 0.45}
              />
            )
          })}
        </g>

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 20, y: 104 }).x)}
            y={px(to({ x: 20, y: 104 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={7}
            fill={palette.foreground}
          >
            {`df ${dragFactor} · ${rate} spm`}
          </text>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 6}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

export { RowingErg }
