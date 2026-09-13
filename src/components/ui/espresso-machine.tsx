"use client"

/**
 * espresso-machine — a spring-lever group, drawn as the linkage it is.
 *
 * The lever is a crank, the link is a connecting rod and the piston is the
 * slider, so `solveSliderCrank` gives the piston position and the whole shot
 * follows from it: pulling the lever down raises the piston and compresses the
 * spring, and the spring paying its force back is the pressure. That is why the
 * gauge falls through the shot — a declining profile is what a spring does, not
 * a curve anybody drew.
 *
 * `shot` is the progress of one pull, 0 to 1: a fast charge, then the long
 * extraction as the spring returns. Making it one number is what keeps the
 * whole machine a pure function of its input — the stream runs because the
 * piston is descending, not because a timer said so.
 *
 * Flow is Darcy's law through the puck and nothing more. There is no
 * temperature, no crema, no dose, no grind and no acoustics: the steam plume,
 * the sight glass and the cup's meniscus are drawing.
 */

import * as React from "react"

import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSliderCrank } from "@/lib/robocn/linkage"
import { extractionFlow, springPressure } from "@/lib/robocn/household"
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

export type EspressoBehavior = "pull" | "steam" | "idle" | "static"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "front"

const FACE = 0.5
/** Body, group column and the tray they all stand on. */
const BODY_LEFT = -54
const BODY_RIGHT = 14
const BODY_TOP = 66
const BODY_DEPTH = 22
const TRAY = 7
const COLUMN_LEFT = 14
const COLUMN_RIGHT = 42
const COLUMN_DEPTH = 15

/** The group: cylinder, piston, spring, and the lever over it. */
const GROUP_X = 28
const CYLINDER_TOP = 60
const CYLINDER_BOTTOM = 26
const CYLINDER_R = 7
const PIVOT: Vec2 = { x: GROUP_X, y: 64 }
const CRANK = 9
const ROD = 26
const LEVER = 30
/** Lever angles: up at rest, down at the end of the pull. */
const LEVER_REST = 68
const LEVER_PULLED = -6

/** Spring: force per unit of compression, and the piston it pushes on. */
const SPRING_RATE = 1.05
const SPRING_PRELOAD = 1.4
const PISTON_AREA = 1.55
/** Below this the puck holds and nothing comes through. */
const THRESHOLD = 1.6
const RESISTANCE = 1.05

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface EspressoMachineProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled progress through one pull, 0 to 1. Supplying it stops the loop. */
  shot?: number
  onShotChange?: (shot: number) => void
  /** Group pressure in bar, whenever it changes. */
  onPressureChange?: (bar: number) => void
  behavior?: EspressoBehavior
  /** Cups under the spout. Two splits one basket, which is what a double does. */
  cups?: 1 | 2
  /** Steam wand angle in degrees from vertical, -40 to 40. */
  wand?: number
  /** Cut the group open so the piston, the spring and the rod are visible. */
  cutaway?: boolean
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

function EspressoMachine({
  shot,
  onShotChange,
  onPressureChange,
  behavior = "pull",
  cups = 1,
  wand = 18,
  cutaway = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.22,
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
}: EspressoMachineProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = shot !== undefined

  const hold = controlled ? (Number.isFinite(shot) ? clamp(shot as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => espressoShot(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 2.2,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const at = clamp(motion.value, 0, 1)
  const steaming = behavior === "steam" && !controlled

  const pull = espressoLever(at)
  const leverAngle = lerp(LEVER_REST, LEVER_PULLED, pull)
  // The lever is the crank, the link is the rod, the piston is the slider.
  const crank = solveSliderCrank(leverAngle + 270, { crank: CRANK, rod: ROD })
  const pistonY = PIVOT.y - crank.slider
  const pin: Vec2 = {
    x: PIVOT.x - Math.cos((leverAngle * Math.PI) / 180) * CRANK,
    y: PIVOT.y - Math.sin((leverAngle * Math.PI) / 180) * CRANK,
  }
  const handle: Vec2 = {
    x: PIVOT.x + Math.cos((leverAngle * Math.PI) / 180) * LEVER,
    y: PIVOT.y + Math.sin((leverAngle * Math.PI) / 180) * LEVER,
  }

  const bar = espressoPressure(at)
  const pouring = espressoPouring(at)
  const poured = espressoYield(at)

  const reported = React.useRef(-1)
  React.useEffect(() => {
    const rounded = Math.round(bar * 10) / 10
    if (reported.current === rounded) return
    reported.current = rounded
    onPressureChange?.(rounded)
  }, [bar, onPressureChange])

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onShotChange?.(bounded)
    },
    [onShotChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Down the frame is down the lever: pulling drags the shot through.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const envelope = boxCorners(
    { x: -(COLUMN_RIGHT + 22), y: 0, z: -(BODY_DEPTH + 8) },
    { x: -(BODY_LEFT - 16), y: 100, z: BODY_DEPTH + 8 },
  )
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, box, bar: member, disc } = elevationDraft(camera, "front")

  const wash = (value: number) => (variant === "outline" || variant === "wire" ? 0 : value)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const tilt = Number.isFinite(wand) ? clamp(wand, -40, 40) : 18
  const wandFoot: Vec2 = {
    x: BODY_LEFT - 4 - Math.sin((tilt * Math.PI) / 180) * 26,
    y: 40 - Math.cos((tilt * Math.PI) / 180) * 26,
  }

  const spout = CYLINDER_BOTTOM - 8
  const cupTop = TRAY + 13
  const cupCentres = cups === 2 ? [GROUP_X - 9, GROUP_X + 9] : [GROUP_X]

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Lever espresso machine, ${bar.toFixed(1)} bar at the group, ${pouring ? "pouring" : "not pouring"}, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(at) : undefined}
      aria-valuetext={interactive ? `${bar.toFixed(1)} bar` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.15)
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

      <g data-machine data-view={view} transform={frame || undefined}>
        {showGround && (
          <path
            data-ground
            d={box(BODY_LEFT - 6, 0, COLUMN_RIGHT + 6, 0.4, BODY_DEPTH + 5)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {/* Drip tray, body, and the column that carries the group. */}
        <path d={box(BODY_LEFT - 2, 2, COLUMN_RIGHT + 2, TRAY, BODY_DEPTH)} {...cast} />
        <path
          d={line(
            [
              { x: BODY_LEFT + 4, y: TRAY - 1 },
              { x: COLUMN_RIGHT - 4, y: TRAY - 1 },
            ],
            BODY_DEPTH * 0.5,
          )}
          fill="none"
          stroke={palette.metal}
          strokeWidth={0.9}
          opacity={0.7}
        />
        <path data-body d={box(BODY_LEFT, TRAY, BODY_RIGHT, BODY_TOP, BODY_DEPTH)} {...shell} />
        <path d={box(BODY_LEFT, TRAY, BODY_RIGHT, BODY_TOP, FACE, BODY_DEPTH)} {...shell} />
        <path
          data-column
          d={box(COLUMN_LEFT, TRAY, COLUMN_RIGHT, BODY_TOP + 2, COLUMN_DEPTH)}
          {...shell}
        />
        <path d={box(COLUMN_LEFT, TRAY, COLUMN_RIGHT, BODY_TOP + 2, FACE, COLUMN_DEPTH)} {...shell} />
        {/* Cup warmer rail across the top of the body. */}
        <path d={box(BODY_LEFT + 6, BODY_TOP, BODY_RIGHT - 6, BODY_TOP + 2, BODY_DEPTH - 8)} {...machined} />

        {/* Machined detail: the seam across the case and the brew switch. */}
        <path
          d={line([{ x: BODY_LEFT + 3, y: 58 }, { x: BODY_RIGHT - 3, y: 58 }], BODY_DEPTH + FACE)}
          fill="none"
          stroke={palette.dark}
          strokeWidth={0.6}
          opacity={0.4}
        />
        <path d={disc({ x: -4, y: 52 }, 3.2, FACE, BODY_DEPTH)} {...cast} />
        <path
          d={disc({ x: -4, y: 52 }, 1.6, FACE, BODY_DEPTH + 0.3)}
          fill={pouring ? palette.accent : palette.metal}
        />

        {/* Boiler: sight glass on the left, gauge on the front. */}
        <g data-boiler>
          <path
            d={box(BODY_LEFT + 4, 18, BODY_LEFT + 9, 54, FACE, BODY_DEPTH)}
            fill={palette.dark}
            fillOpacity={wash(0.35)}
            stroke={palette.dark}
            strokeWidth={0.5}
          />
          <path
            data-level
            d={box(BODY_LEFT + 5, 19, BODY_LEFT + 8, 41, FACE, BODY_DEPTH + 0.2)}
            fill={palette.accent}
            fillOpacity={wash(0.75)}
          />
        </g>
        <g data-gauge>
          <path d={disc({ x: -22, y: 44 }, 11, FACE, BODY_DEPTH)} {...machined} />
          <path d={disc({ x: -22, y: 44 }, 8.4, FACE, BODY_DEPTH + 0.3)} fill={palette.dark} fillOpacity={wash(0.5)} />
          <path
            data-needle
            data-bar={px(bar)}
            d={member(
              { x: -22, y: 44 },
              needleTip({ x: -22, y: 44 }, bar),
              0.9,
              FACE,
              BODY_DEPTH + 0.5,
            )}
            fill={palette.accent}
            stroke={palette.dark}
            strokeWidth={0.4}
          />
        </g>

        {/* Steam wand and its tap. */}
        <g data-wand data-tilt={px(tilt)}>
          <path d={member({ x: BODY_LEFT + 1, y: 44 }, { x: BODY_LEFT - 4, y: 40 }, 2.2, 4)} {...machined} />
          <path d={member({ x: BODY_LEFT - 4, y: 40 }, wandFoot, 1.3, 2)} {...machined} />
          {steaming && (
            <path
              data-steam
              d={disc(
                { x: wandFoot.x - 2, y: wandFoot.y - 5 },
                5.5,
                3,
              )}
              fill={palette.glow}
              opacity={wash(0.22)}
            />
          )}
        </g>

        {/* The group: cylinder, spring, piston, rod, lever. */}
        <g data-group>
          <path
            d={box(GROUP_X - CYLINDER_R - 2, CYLINDER_BOTTOM - 3, GROUP_X + CYLINDER_R + 2, CYLINDER_TOP + 3, CYLINDER_R)}
            {...machined}
          />
          {cutaway && (
            <>
              <path
                d={box(GROUP_X - CYLINDER_R, CYLINDER_BOTTOM, GROUP_X + CYLINDER_R, CYLINDER_TOP, FACE, CYLINDER_R)}
                fill={palette.dark}
                fillOpacity={wash(variant === "blueprint" ? 0.12 : 0.45)}
                stroke={palette.dark}
                strokeWidth={0.5}
              />
              <path
                data-spring
                d={springPath(to, GROUP_X, pistonY + 3, CYLINDER_TOP - 1, CYLINDER_R - 2, CYLINDER_R)}
                fill="none"
                stroke={palette.metal}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <path
                data-piston
                data-height={px(pistonY)}
                d={box(GROUP_X - CYLINDER_R + 1, pistonY - 2, GROUP_X + CYLINDER_R - 1, pistonY + 3, CYLINDER_R - 1)}
                {...cast}
              />
              {/* Water under the piston, which is what is about to be pushed. */}
              <path
                d={box(GROUP_X - CYLINDER_R + 1, CYLINDER_BOTTOM + 1, GROUP_X + CYLINDER_R - 1, pistonY - 2, FACE, CYLINDER_R - 1)}
                fill={palette.accent}
                fillOpacity={wash(0.4)}
              />
            </>
          )}
          <path data-rod d={member(pin, { x: GROUP_X, y: pistonY + 2 }, 1.2, 2)} {...machined} />
          <path d={disc(PIVOT, 3.4, 3)} {...cast} />
          <path
            data-lever
            data-angle={px(leverAngle)}
            d={member(pin, handle, 1.8, 2.6)}
            {...machined}
          />
          <path d={disc(handle, 3.2, 3.4)} {...cast} />
        </g>

        {/* Portafilter, spout, stream and cup. */}
        <path
          data-portafilter
          d={box(GROUP_X - CYLINDER_R - 1, CYLINDER_BOTTOM - 7, GROUP_X + CYLINDER_R + 1, CYLINDER_BOTTOM - 2, CYLINDER_R)}
          {...cast}
        />
        <path
          d={member(
            { x: GROUP_X + CYLINDER_R, y: CYLINDER_BOTTOM - 4 },
            { x: GROUP_X + CYLINDER_R + 16, y: CYLINDER_BOTTOM - 7 },
            2,
            2.4,
          )}
          {...shell}
        />
        {cupCentres.map((centre) => (
          <g key={centre} data-cup={px(poured)}>
            <path d={box(centre - 7, cupTop - 13, centre + 7, cupTop, 6)} {...machined} />
            <path
              data-fill
              d={box(
                centre - 6,
                cupTop - 12,
                centre + 6,
                cupTop - 12 + poured * 10,
                FACE,
                5.6,
              )}
              fill={palette.accent}
              fillOpacity={wash(0.9)}
            />
            <path
              d={box(centre - 7, cupTop - 13, centre + 7, cupTop - 11.4, FACE, 6.2)}
              {...machined}
            />
            {pouring && (
              <path
                data-stream
                d={box(centre - 1.1, cupTop - 12 + poured * 10, centre + 1.1, spout, FACE, 2)}
                fill={palette.accent}
                fillOpacity={wash(0.85)}
              />
            )}
          </g>
        ))}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: GROUP_X, y: 92 }).x)}
            y={px(to({ x: GROUP_X, y: 92 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${bar.toFixed(1)} bar`}
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
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

/** The gauge needle: 0 bar at 210°, 12 bar at -30°, the way a dial reads. */
function needleTip(centre: Vec2, bar: number): Vec2 {
  const fraction = clamp(Number.isFinite(bar) ? bar / 12 : 0, 0, 1)
  const angle = ((210 - fraction * 240) * Math.PI) / 180
  return { x: centre.x + Math.cos(angle) * 7.6, y: centre.y + Math.sin(angle) * 7.6 }
}

/**
 * The spring, as a zig-zag between two heights. The turns are fixed and the
 * length is not, so a compressed spring really does bunch up.
 */
function springPath(
  to: ReturnType<typeof elevationDraft>["point"],
  x: number,
  bottom: number,
  top: number,
  half: number,
  depth: number,
): string {
  const turns = 6
  const span = Math.max(1, top - bottom)
  return Array.from({ length: turns * 2 + 1 }, (_, index) => {
    const point = to(
      { x: x + (index % 2 === 0 ? -half : half), y: bottom + (index / (turns * 2)) * span },
      depth,
    )
    return `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`
  }).join(" ")
}

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

/** Where the machine is in a pull at `clock`. */
export function espressoShot(behavior: EspressoBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.45
  if (behavior === "idle" || behavior === "steam") return 0
  return ((clock % 1) + 1) % 1
}

/** Charge point: before this the lever is coming down, after it the spring returns. */
const CHARGE = 0.18
const RELEASE_END = 0.95

/**
 * How far the lever is pulled down, from the progress of a shot: a fast charge
 * to the stop, then the long return as the spring drives the piston through the
 * puck. One number in, the whole linkage out.
 */
export function espressoLever(shot: number): number {
  if (!Number.isFinite(shot)) return 0
  const at = clamp(shot, 0, 1)
  if (at <= CHARGE) return at / CHARGE
  if (at >= RELEASE_END) return 0
  return 1 - (at - CHARGE) / (RELEASE_END - CHARGE)
}

/**
 * Group pressure in bar: the spring's force over the piston area. It peaks at
 * the end of the charge and declines through the extraction, because that is
 * what a spring does as it extends.
 */
export function espressoPressure(shot: number): number {
  const compression = espressoLever(shot) * 12
  return springPressure(compression, {
    rate: SPRING_RATE,
    preload: SPRING_PRELOAD,
    area: PISTON_AREA,
  })
}

/** True while the piston is descending and the puck is passing water. */
export function espressoPouring(shot: number): boolean {
  if (!Number.isFinite(shot)) return false
  const at = clamp(shot, 0, 1)
  return at > CHARGE && at < RELEASE_END && espressoPressure(at) > THRESHOLD
}

/**
 * What is in the cup, 0 to 1 of a full one: the flow integrated over the part
 * of the shot that has happened. Sampled rather than accumulated, so it is the
 * same number for the same `shot` however you got there.
 */
export function espressoYield(shot: number, samples = 48): number {
  if (!Number.isFinite(shot)) return 0
  const at = clamp(shot, 0, 1)
  if (at <= CHARGE) return 0
  const steps = Math.max(2, Math.round(samples))
  const width = (at - CHARGE) / steps
  let total = 0
  for (let index = 0; index < steps; index += 1) {
    const point = CHARGE + (index + 0.5) * width
    if (!espressoPouring(point)) continue
    total += extractionFlow(espressoPressure(point), {
      resistance: RESISTANCE,
      threshold: THRESHOLD,
    }) * width
  }
  return clamp(total / 2.5, 0, 1)
}

export { EspressoMachine }
