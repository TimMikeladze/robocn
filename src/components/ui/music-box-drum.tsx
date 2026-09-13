"use client"

/**
 * music-box-drum — a pinned barrel and the comb it plucks.
 *
 * The notes are data on the cylinder: a pattern, one row per tine, any
 * non-blank character a pin. A pin comes round, bends its tine further and
 * further, and at the moment it reaches the tip it lets go — that discontinuity
 * is the pluck, and it is the same `combLift` the busker droid raises a beater
 * with, because a step sequencer is this barrel unrolled flat.
 *
 * The comb is tuned by length: a cantilever's frequency goes as one over the
 * length squared, so an octave up is one over root two the length. The tips all
 * stand in a line along the barrel and the roots step away from it, which is
 * what makes the fan a curve rather than a taper.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  barrelStep,
  combLift,
  combRelease,
  combTines,
  pinBarrel,
} from "@/lib/robocn/sound"
import {
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  slabPath,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_W = 125
const VIEW_H = 108

/** World units: x starboard, y up, z toward the back. The barrel lies along x. */
const PLATE = { x0: -48, x1: 48, z0: -26, z1: 38, top: 5 }
const BARREL = { y: 21, z: -8, radius: 12, x0: -32, x1: 32 }
/** Where every tine tip stands: on the barrel's surface, at the comb's side. */
const TIP_Z = BARREL.z + BARREL.radius
const COMB_X = 30
const LONGEST_TINE = 22
/** How far a pin bends a tine before it lets go. */
const TINE_BEND = 4.4
/** Pin height above the barrel's surface. */
const PIN_RISE = 2.6
/** Turns of the fly for one turn of the barrel: the air brake runs fast. */
const FLY_RATIO = 9
/** Degrees per second while easing back after the barrel is let go. */
const SLEW_RATE = 420
const NATIVE_VIEW: RobotView = "plan"

/** Plain alternating figures, written for this file. */
const DEFAULT_PATTERN = [
  "x.......x.......",
  "....x.......x...",
  "..x.......x.....",
  "......x.......x.",
  ".x.......x......",
  ".....x.......x..",
  "...x.......x....",
  ".......x.......x",
  "x...x...x...x...",
  "..x...x...x...x.",
  "....x.......x...",
  "......x...x.....",
]

const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.9 }
const frames: Record<RobotView, Vec2> = {
  plan: { x: 62, y: 40 },
  front: { x: 62, y: 66 },
  profile: { x: 68, y: 62 },
  iso: { x: 60, y: 58 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type MusicBoxBehavior = "play" | "cadence" | "static"

export interface MusicBoxDrumProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled barrel rotation in degrees. Omit to run `behavior`. */
  turn?: number
  /** What the barrel does when `turn` is not supplied. */
  behavior?: MusicBoxBehavior
  /** Tines on the comb, rounded and clamped to 4–20. */
  tines?: number
  /** One row per tine; any non-blank character is a pin at that step. */
  pattern?: readonly string[]
  /** Where the camera stands. One movement, four projections. */
  view?: RobotView
  /** Revolutions of the barrel per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to turn the barrel by hand, or arrow-key it a step at a time. */
  interactive?: boolean
  onTurnChange?: (turn: number) => void
  /** The step now standing under the comb, 0-based. */
  onStepChange?: (step: number) => void
  showFly?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function MusicBoxDrum({
  turn,
  behavior = "play",
  tines = 12,
  pattern = DEFAULT_PATTERN,
  view = NATIVE_VIEW,
  speed = 0.12,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTurnChange,
  onStepChange,
  showFly = true,
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
}: MusicBoxDrumProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const count = Number.isFinite(tines) ? clamp(Math.round(tines), 4, 20) : 12
  // An empty pattern is a barrel with no pins, not a reason to fall back.
  const rows = (Array.isArray(pattern) ? pattern : DEFAULT_PATTERN).slice(0, count)
  const barrel = pinBarrel(rows)
  const comb = combTines(count, { longest: LONGEST_TINE })
  const pitch = count > 1 ? (COMB_X * 2) / (count - 1) : 0

  const controlled = turn !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(turn) ? (turn as number) : 0) : held
  const goal = React.useCallback((clock: number) => musicBoxGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const rotation = Number.isFinite(motion.value) ? motion.value : 0
  const steps = barrel.steps
  const position = steps > 0 ? (rotation / 360) * steps : 0
  const step = barrelStep(barrel, position)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onTurnChange?.(next)
      // The step count is what the callback needs, not the barrel itself.
      if (steps > 0) {
        const at = Math.floor((next / 360) * steps)
        onStepChange?.(((at % steps) + steps) % steps)
      }
    },
    [steps, onStepChange, onTurnChange],
  )
  const live = React.useRef(rotation)
  React.useEffect(() => {
    live.current = rotation
  })
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: live.current, at: unit.x }
          return
        }
        // The whole width of the frame is one revolution of the barrel.
        apply(press.current.from + (unit.x - press.current.at) * 360)
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const origin = frames[view] ?? frames.plan

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)
  const depth = (point: Vec3) => camera.depth(point.x, point.y, point.z)
  const tineX = (index: number) => -COMB_X + index * pitch
  /** A tine: root on the comb's stepped base, tip on the barrel, bent by a pin. */
  const tine = (index: number) => {
    const lift = combLift(barrel, index, position)
    const length = comb[index]?.length ?? LONGEST_TINE
    const x = tineX(index)
    return {
      lift,
      ring: combRelease(barrel, index, position),
      root: { x, y: BARREL.y, z: TIP_Z + length },
      tip: { x, y: BARREL.y - lift * TINE_BEND, z: TIP_Z },
    }
  }

  // The barrel is a cylinder on the x axis: one hull over its two end rings.
  const flyTurn = rotation * FLY_RATIO
  const reading = `${steps ? step + 1 : 0}/${steps}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Music box movement, ${count} tines, step ${reading}, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 1 : undefined}
      aria-valuemax={interactive ? Math.max(1, steps) : undefined}
      aria-valuenow={interactive ? step + 1 : undefined}
      aria-valuetext={interactive ? `step ${reading}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const degreesPerStep = steps > 0 ? 360 / steps : 45
        const delta = arrowStep(event.key, degreesPerStep, degreesPerStep * 4)
        if (delta !== 0) apply(Math.round((rotation + delta) / degreesPerStep) * degreesPerStep)
        else if (event.key === "Home") apply(0)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={px((width * VIEW_H) / VIEW_W)}
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
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d={`M 8 ${px(origin.y)} H ${VIEW_W - 8}`} strokeDasharray="2 3" />
        </g>
      )}

      <g data-view={view} transform={`translate(${px(origin.x)} ${px(origin.y)}) scale(${px(fit)})`}>
        <path
          data-bedplate
          d={extrudedPath(
            roundedFootprint((PLATE.x1 - PLATE.x0) / 2, (PLATE.z1 - PLATE.z0) / 2, 4, 4).map(
              (point) => ({
                x: point.x + (PLATE.x0 + PLATE.x1) / 2,
                y: point.y + (PLATE.z0 + PLATE.z1) / 2,
              }),
            ),
            camera,
            PLATE.top,
            0,
          )}
          {...shell}
        />

        {/* The bearings the barrel runs in, one at each end. */}
        {[BARREL.x0 - 5, BARREL.x1 + 5].map((x) => (
          <path
            key={x}
            d={extrudedPath(
              roundedFootprint(3, 5, 1.5, 3).map((point) => ({
                x: point.x + x,
                y: point.y + BARREL.z,
              })),
              camera,
              BARREL.y + 3,
              PLATE.top,
            )}
            {...cast}
          />
        ))}

        {/* The great wheel the mainspring drives the barrel through. It stands
            beyond the far bearing, so it is painted before the barrel. */}
        <g data-wheel>
          {Array.from({ length: 16 }, (_, index) => {
            const angle = (index / 16) * Math.PI * 2
            return (
              <path
                key={index}
                d={segment(
                  camera,
                  pinAt(angle, 8, PLATE.x0 + 7),
                  pinAt(angle, 11, PLATE.x0 + 7),
                )}
                stroke={palette.metal}
                strokeWidth={1.4}
              />
            )
          })}
          <path d={slabPath(ringX(PLATE.x0 + 7, 9), camera)} {...machined} />
          <path d={slabPath(ringX(PLATE.x0 + 7, 3), camera)} {...cast} />
        </g>

        <g data-barrel data-turn={px(rotation)}>
          <path d={slabPath([...ringX(BARREL.x0), ...ringX(BARREL.x1)], camera)} {...machined} />
          {/* The end you can see, so the barrel reads as a drum and not a plank. */}
          <path
            d={slabPath(
              depth(pinAt(0, 0, BARREL.x1)) > depth(pinAt(0, 0, BARREL.x0))
                ? ringX(BARREL.x1)
                : ringX(BARREL.x0),
              camera,
            )}
            {...cast}
          />
          {barrel.pins.map((pin) => {
            if (pin.tine >= count) return null
            const angle = toRadians(pin.angle - rotation)
            const x = tineX(pin.tine)
            const base = pinAt(angle, BARREL.radius, x)
            // Only the pins on the side of the barrel you can see.
            if (depth(base) < depth(pinAt(0, 0, x))) return null
            const head = pinAt(angle, BARREL.radius + PIN_RISE, x)
            const from = project(base)
            const to = project(head)
            return (
              <path
                key={`${pin.tine}-${pin.step}`}
                data-pin={`${pin.tine}-${pin.step}`}
                d={`M ${px(from.x)} ${px(from.y)} L ${px(to.x)} ${px(to.y)}`}
                stroke={palette.dark}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        <g data-comb>
          {/* The base steps away from the barrel, because the tips must line up. */}
          {comb.map((entry) => (
            <path
              key={entry.index}
              d={combStep(camera, entry.length, tineX(entry.index), pitch)}
              {...cast}
            />
          ))}
          {comb.map((entry) => {
            const shape = tine(entry.index)
            const root = project(shape.root)
            const tip = project(shape.tip)
            return (
              <path
                key={entry.index}
                data-tine={entry.index}
                data-lift={px(shape.lift)}
                d={`M ${px(root.x)} ${px(root.y)} L ${px(tip.x)} ${px(tip.y)}`}
                stroke={shape.ring > 0.35 ? palette.accent : palette.metal}
                strokeWidth={2}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {showFly && (
          <g data-fly data-turn={px(flyTurn)}>
            <path
              d={segment(camera, pinAt(0, 0, BARREL.x1 + 5), pinAt(0, 0, PLATE.x1 - 4))}
              stroke={palette.metal}
              strokeWidth={1.4}
            />
            {[0, 180].map((offset) => {
              const angle = toRadians(flyTurn + offset)
              return (
                <path
                  key={offset}
                  d={slabPath(
                    [
                      pinAt(angle, 2, PLATE.x1 - 10),
                      pinAt(angle, 11, PLATE.x1 - 10),
                      pinAt(angle, 11, PLATE.x1 - 4),
                      pinAt(angle, 2, PLATE.x1 - 4),
                    ],
                    camera,
                  )}
                  {...machined}
                />
              )
            })}
          </g>
        )}

      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_W / 2} y={VIEW_H - 10} fontSize={5}>
          {`STEP ${reading} · ${count} TINES`}
        </text>
        {label && (
          <text x={VIEW_W / 2} y={VIEW_H - 3} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** A point `reach` from the barrel's axis at `angle`, at station `x` along it. */
function pinAt(angle: number, reach: number, x: number): Vec3 {
  return {
    x,
    y: BARREL.y + Math.sin(angle) * reach,
    z: BARREL.z + Math.cos(angle) * reach,
  }
}

/** A ring of points square to the barrel's axis, at one station along it. */
function ringX(x: number, radius = BARREL.radius, steps = 18): Vec3[] {
  return Array.from({ length: steps }, (_, index) =>
    pinAt((index / steps) * Math.PI * 2, radius, x),
  )
}

const segment = (camera: RobotCamera, from: Vec3, to: Vec3) => {
  const a = camera.project(from.x, from.y, from.z)
  const b = camera.project(to.x, to.y, to.z)
  return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
}

/** One tine's step of the comb's base: the longer the tine, the further back. */
function combStep(camera: RobotCamera, length: number, x: number, pitch: number) {
  const half = Math.max(1.5, pitch / 2)
  const back = TIP_Z + LONGEST_TINE + 8
  return slabPath(
    [BARREL.y + 2.5, BARREL.y - 4.5].flatMap((y) => [
      { x: x - half, y, z: TIP_Z + length },
      { x: x + half, y, z: TIP_Z + length },
      { x: x - half, y, z: back },
      { x: x + half, y, z: back },
    ]),
    camera,
  )
}

/**
 * Barrel rotation at `clock`, in degrees. `play` turns it steadily; `cadence`
 * is a governor hunting — the barrel swells and eases within each revolution
 * without ever running backwards.
 */
export function musicBoxGoal(behavior: MusicBoxBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "cadence") return clock * 360 + Math.sin(clock * Math.PI * 2) * 26
  return clock * 360
}

export { MusicBoxDrum }
