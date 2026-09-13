"use client"

/**
 * tower-block — a residential tower with the lift left visible.
 *
 * The storey count is the axis: it sets the height, the facade grid, the lift's
 * travel and how far the counterweight has to fall. The car and the weight hang
 * on one rope over one sheave, so the weight rises exactly as far as the car
 * drops — `hoistPose` reports the rope length precisely so that can be checked
 * rather than believed.
 *
 * The lit windows are a fixed deterministic pattern scaled by `occupancy`, not
 * a simulation of anybody: the same storey and column light up at the same
 * occupancy every time. There is no dispatching, no call queue and no traffic
 * model — the car runs a pattern, and the docs say so.
 */

import * as React from "react"

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import { hoistPose } from "@/lib/robocn/household"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
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

export type TowerBlockBehavior = "service" | "night" | "static"
export type TowerBlockCrown = "mast" | "plant" | "none"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 250
const NATIVE_VIEW: RobotView = "front"

const STOREY = 9
const HALF_WIDTH = 42
const DEPTH = 24
/** The podium the tower stands on, wider and deeper than the shaft above it. */
const PODIUM = 16
const PODIUM_HALF = 54
const PODIUM_DEPTH = 30

/** The shaft, cut into the right-hand bay of the plan. */
const SHAFT_X = 24
const SHAFT_HALF = 13
const CAR_HEIGHT = 7
const WEIGHT_HEIGHT = 5

/** Windows per storey, across the facade. */
const BAYS = 6

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface TowerBlockProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled lift position, 0 at the bottom stop to 1 at the top. */
  carriage?: number
  onCarriageChange?: (carriage: number) => void
  /** The storey the car is standing at, 0-based, whenever it changes. */
  onFloorChange?: (floor: number) => void
  behavior?: TowerBlockBehavior
  /** Storeys above the podium, rounded and clamped to 4–24. */
  storeys?: number
  /** How much of the building is in, 0 to 1. Drives the lit pattern only. */
  occupancy?: number
  /** Cut the shaft open so the car, the ropes and the weight are visible. */
  cutaway?: boolean
  crown?: TowerBlockCrown
  showGround?: boolean
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function TowerBlock({
  carriage,
  onCarriageChange,
  onFloorChange,
  behavior = "service",
  storeys = 12,
  occupancy = 0.55,
  cutaway = true,
  crown = "mast",
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.16,
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
}: TowerBlockProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = carriage !== undefined

  const floors = Number.isFinite(storeys) ? clamp(Math.round(storeys), 4, 24) : 12
  const hold = controlled ? (Number.isFinite(carriage) ? clamp(carriage as number, 0, 1) : 0) : held
  const goal = React.useCallback(
    (clock: number) => towerCarriage(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: 0.55,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const at = clamp(motion.value, 0, 1)
  const inhabited = clamp(
    Number.isFinite(occupancy) ? occupancy : 0.55,
    0,
    1,
  ) * (behavior === "night" ? towerNight(motion.clock) : 1)

  const top = PODIUM + floors * STOREY
  const travel = top - PODIUM - CAR_HEIGHT - 8
  // The sheave hangs in the head of the shaft, under the plant deck, which is
  // where the machine room of a roped lift actually is.
  const sheave = top - 3
  const hoist = hoistPose(at, {
    travel,
    sheave,
    spacing: SHAFT_HALF,
    carHeight: CAR_HEIGHT,
    weightHeight: WEIGHT_HEIGHT,
    base: PODIUM + 2,
  })
  const floor = Math.round((at * travel) / STOREY)

  // Report the storey the car is standing at, not every pixel it passes.
  const reported = React.useRef(-1)
  React.useEffect(() => {
    if (reported.current === floor) return
    reported.current = floor
    onFloorChange?.(floor)
  }, [floor, onFloorChange])

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onCarriageChange?.(bounded)
    },
    [onCarriageChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const envelope = boxCorners(
    { x: -(PODIUM_HALF + 4), y: 0, z: -(PODIUM_DEPTH + 4) },
    { x: PODIUM_HALF + 4, y: top + (crown === "mast" ? 30 : 12), z: PODIUM_DEPTH + 4 },
  )
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, box, bar } = elevationDraft(camera, "front")

  const wash = (value: number) => (variant === "outline" || variant === "wire" ? 0 : value)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const FACE = 0.5

  // The aviation lamp is the one thing here on a clock of its own.
  const beacon = crown !== "none" && Math.sin(motion.clock * Math.PI * 4) > 0

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Tower block of ${floors} storeys, lift at storey ${floor}, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(at) : undefined}
      aria-valuetext={interactive ? `storey ${floor} of ${floors}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 1 / Math.max(1, floors), 0.25)
        if (delta !== 0) apply(at + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
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
          d={`M 8 ${VIEW_HEIGHT - 14} H ${VIEW_WIDTH - 8}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.45}
        />
      )}

      <g data-tower data-view={view} transform={frame || undefined}>
        {showGround && (
          <path
            data-ground
            d={box(-PODIUM_HALF - 6, 0, PODIUM_HALF + 6, 0.4, PODIUM_DEPTH + 6)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {/* Podium, shaft of the building, and the front face over each. */}
        <path data-podium d={box(-PODIUM_HALF, 0, PODIUM_HALF, PODIUM, PODIUM_DEPTH)} {...cast} />
        <path data-body d={box(-HALF_WIDTH, PODIUM, HALF_WIDTH, top, DEPTH)} {...shell} />
        <path d={box(-HALF_WIDTH, PODIUM, HALF_WIDTH, top, FACE, DEPTH)} {...shell} />

        {/* Storey lines and the windows they carry. */}
        {Array.from({ length: floors }, (_, storey) => (
          <g key={storey} data-storey={storey}>
            <path
              d={line(
                [
                  { x: -HALF_WIDTH, y: PODIUM + storey * STOREY },
                  { x: HALF_WIDTH, y: PODIUM + storey * STOREY },
                ],
                DEPTH + FACE,
              )}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.5}
              opacity={0.35}
            />
            {Array.from({ length: BAYS }, (_, bay) => {
              const x = -HALF_WIDTH + 5 + bay * ((HALF_WIDTH * 2 - 10) / BAYS)
              const shaftBay = cutaway && x + 4 > SHAFT_X - SHAFT_HALF - 2
              if (shaftBay) return null
              const on = towerLit(storey, bay, inhabited)
              return (
                <path
                  key={bay}
                  data-window={on ? "lit" : "dark"}
                  d={box(
                    x,
                    PODIUM + storey * STOREY + 1.8,
                    x + ((HALF_WIDTH * 2 - 10) / BAYS) - 3.6,
                    PODIUM + (storey + 1) * STOREY - 3.4,
                    FACE,
                    DEPTH,
                  )}
                  fill={on ? palette.accent : palette.dark}
                  fillOpacity={wash(on ? 0.85 : 0.3)}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
              )
            })}
          </g>
        ))}

        {/* The shaft: the void, the landing doors, the car, the weight, the rope. */}
        {cutaway && (
          <g data-shaft>
            <path
              d={box(
                SHAFT_X - SHAFT_HALF,
                PODIUM,
                SHAFT_X + SHAFT_HALF,
                top,
                FACE,
                DEPTH,
              )}
              fill={palette.dark}
              fillOpacity={wash(variant === "blueprint" ? 0.12 : 0.72)}
              stroke={palette.dark}
              strokeWidth={0.6}
            />
            {Array.from({ length: floors }, (_, storey) => (
              <path
                key={storey}
                data-landing={storey}
                d={line(
                  [
                    { x: SHAFT_X - SHAFT_HALF + 1, y: PODIUM + 2 + storey * STOREY },
                    { x: SHAFT_X + SHAFT_HALF - 1, y: PODIUM + 2 + storey * STOREY },
                  ],
                  DEPTH + FACE,
                )}
                fill="none"
                stroke={storey === floor ? palette.accent : palette.metal}
                strokeWidth={storey === floor ? 1.4 : 0.6}
                opacity={storey === floor ? 0.95 : 0.5}
              />
            ))}

            <path
              data-rope
              d={line(
                hoist.rope.map((point) => ({ x: SHAFT_X + point.x, y: point.y })),
                DEPTH - 2,
              )}
              fill="none"
              stroke={palette.metal}
              strokeWidth={0.9}
            />
            <path
              data-sheave
              d={bar(
                { x: SHAFT_X - SHAFT_HALF / 2, y: sheave },
                { x: SHAFT_X + SHAFT_HALF / 2, y: sheave },
                1.6,
                4,
              )}
              {...machined}
            />
            <path
              data-lift-car
              data-floor={floor}
              d={box(
                SHAFT_X + hoist.car.x - 5,
                hoist.car.y,
                SHAFT_X + hoist.car.x + 5,
                hoist.car.y + CAR_HEIGHT,
                5,
                DEPTH - 6,
              )}
              {...machined}
            />
            <path
              d={line(
                [
                  { x: SHAFT_X + hoist.car.x, y: hoist.car.y + 1 },
                  { x: SHAFT_X + hoist.car.x, y: hoist.car.y + CAR_HEIGHT - 1 },
                ],
                DEPTH - 1,
              )}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1}
              opacity={0.9}
            />
            <path
              data-counterweight
              d={box(
                SHAFT_X + hoist.counterweight.x - 2.6,
                hoist.counterweight.y,
                SHAFT_X + hoist.counterweight.x + 2.6,
                hoist.counterweight.y + WEIGHT_HEIGHT,
                3,
                DEPTH - 8,
              )}
              {...cast}
            />
          </g>
        )}

        {/* Crown: a plant enclosure, or the mast and its lamp. */}
        {crown !== "none" && (
          <g data-crown={crown}>
            <path d={box(-HALF_WIDTH + 6, top, HALF_WIDTH - 6, top + 5, DEPTH - 4)} {...cast} />
            {crown === "mast" && (
              <>
                <path
                  d={bar({ x: -14, y: top + 5 }, { x: -14, y: top + 26 }, 1, 1.4)}
                  {...machined}
                />
                <circle
                  data-lamp={beacon ? "on" : "off"}
                  cx={px(to({ x: -14, y: top + 28 }).x)}
                  cy={px(to({ x: -14, y: top + 28 }).y)}
                  r={2.6}
                  fill={beacon ? palette.accent : palette.metal}
                  opacity={beacon ? 1 : 0.6}
                />
              </>
            )}
          </g>
        )}

        {/* Entrance canopy on the podium: where the tower meets the street. */}
        <path
          data-canopy
          d={box(-24, PODIUM - 4, 24, PODIUM - 2, 5, PODIUM_DEPTH + 3)}
          {...machined}
        />
        <path
          d={box(-16, 0, 16, PODIUM - 5, FACE, PODIUM_DEPTH)}
          fill={palette.accent}
          fillOpacity={wash(0.5)}
          stroke={palette.dark}
          strokeWidth={0.5}
        />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: top + (crown === "mast" ? 34 : 10) }).x)}
            y={px(to({ x: 0, y: top + (crown === "mast" ? 34 : 10) }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${floors} × ${STOREY} · L${floor}`}
          </text>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 5}
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

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Where the car is at `clock`. `service` runs it up the building and back with
 * a dwell at each end — the shape of a lift answering calls, not a lift on a
 * sine wave — and `night` parks it at the ground between two late calls.
 */
export function towerCarriage(behavior: TowerBlockBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.35
  const t = ((clock % 1) + 1) % 1
  if (behavior === "night") {
    if (t < 0.12) return t / 0.12
    if (t < 0.3) return 1
    if (t < 0.42) return 1 - (t - 0.3) / 0.12
    return 0
  }
  if (t < 0.06) return 0
  if (t < 0.44) return (t - 0.06) / 0.38
  if (t < 0.56) return 1
  if (t < 0.94) return 1 - (t - 0.56) / 0.38
  return 0
}

/** How much of the building is still in, over a night. */
export function towerNight(clock: number): number {
  if (!Number.isFinite(clock)) return 1
  const t = ((clock % 1) + 1) % 1
  return 0.25 + 0.75 * (1 - t)
}

/**
 * Whether one window is lit. A fixed pattern scaled by occupancy, so the same
 * flat is lit at the same occupancy every render — nothing here is random, and
 * nothing here models a person.
 */
export function towerLit(storey: number, bay: number, occupancy: number): boolean {
  if (!Number.isFinite(occupancy) || occupancy <= 0) return false
  const hash = (Math.round(storey) * 73 + Math.round(bay) * 151 + 29) % 97
  return hash / 97 < clamp(occupancy, 0, 1)
}

export { TowerBlock }
