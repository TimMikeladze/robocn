"use client"

/**
 * drilling-derrick — a mast, a crown, a travelling block, and the rope between
 * them.
 *
 * The block is not positioned; it is *reeved*. `tacklePosition` shares whatever
 * the drum has paid out between the strung lines, so stringing more lines makes
 * the drum turn further for the same lift — the mechanical advantage is visible
 * as rope rather than stated as a number. `tackleReeving` draws the falls
 * themselves, one per line, so the count in the drawing is the count in the
 * maths.
 *
 * The hole, the string below the floor and the mud are illustrated: there is no
 * hook load, no line tension, no rope stretch, no sheave efficiency and no
 * depth anywhere in this file.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { rigidPoint, tacklePosition, tackleReeving } from "@/lib/robocn/linkage"
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

export type DerrickBehavior = "trip" | "drill" | "static"
/** Lines strung between the crown and the travelling block. */
export type DerrickLines = 4 | 6 | 8 | 10 | 12

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 290
const NATIVE_VIEW: RobotView = "front"

const FLOOR = 44
const CROWN = 232
/** Travel limits of the travelling block's sheave axis. */
const BLOCK_TOP = 204
const BLOCK_LOW = 72
const DRUM: Vec2 = { x: 38, y: 62 }
const DRUM_RADIUS = 11
/** Half the mast's width at the floor and at the crown. */
const BASE_SPREAD = 42
const CROWN_SPREAD = 13
const MAST_DEPTH = 30

const ENVELOPE = boxCorners({ x: -66, y: -18, z: -52 }, { x: 66, y: 250, z: 52 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Half-width of the mast at a height: it tapers all the way to the crown. */
const spreadAt = (y: number) =>
  lerp(BASE_SPREAD, CROWN_SPREAD, clamp((y - FLOOR) / (CROWN - FLOOR), 0, 1))

export interface DrillingDerrickProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled block height, 0 at the floor to 1 at the crown. Stops the loop. */
  hoist?: number
  onHoistChange?: (hoist: number) => void
  behavior?: DerrickBehavior
  lines?: DerrickLines
  /** Draw the string below the floor, the hole, and the returning mud. */
  showString?: boolean
  /** Racked stands of pipe standing inside the mast. */
  showRack?: boolean
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

function DrillingDerrick({
  hoist,
  onHoistChange,
  behavior = "trip",
  lines = 6,
  showString = true,
  showRack = true,
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
}: DrillingDerrickProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = hoist !== undefined
  const strung = ([4, 6, 8, 10, 12] as const).includes(lines) ? lines : 6

  const hold = controlled ? (Number.isFinite(hoist) ? clamp(hoist as number, 0, 1) : 0.5) : held
  const goal = React.useCallback((clock: number) => derrickHoist(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.1,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const lift = clamp(motion.value, 0, 1)

  // Turns off the drum for the height asked for; the solver then says where
  // the block actually hangs, so the rope is what puts it there.
  const turns = ((1 - lift) * (BLOCK_TOP - BLOCK_LOW) * strung) / (2 * Math.PI * DRUM_RADIUS)
  const reeved = tacklePosition(turns, {
    lines: strung,
    drumRadius: DRUM_RADIUS,
    topHeight: BLOCK_TOP,
    floorHeight: BLOCK_LOW,
  })
  const blockY = reeved.height
  const drumAngle = -turns * 360

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onHoistChange?.(bounded)
    },
    [onHoistChange],
  )
  const topScreen = px(to({ x: 0, y: BLOCK_TOP }).y)
  const lowScreen = px(to({ x: 0, y: BLOCK_LOW }).y)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const y = unit.y * VIEW_HEIGHT
        apply((y - lowScreen) / (topScreen - lowScreen || 1))
      },
      [apply, topScreen, lowScreen],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const rope = tackleReeving({ x: 0, y: CROWN }, { x: 0, y: blockY }, strung, 4.6)
  /** Girt heights up the mast, and the bay diagonals between them. */
  const girts = Array.from({ length: 7 }, (_, index) => FLOOR + 8 + index * 26)
  const percent = Math.round(lift * 100)

  const legs = (offset: number) =>
    [-1, 1].map((side) => (
      <path
        key={`${offset}:${side}`}
        d={bar(
          { x: side * BASE_SPREAD, y: FLOOR },
          { x: side * CROWN_SPREAD, y: CROWN },
          2.6,
          3,
          offset,
        )}
        {...machined}
      />
    ))

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Drilling derrick, travelling block ${percent} percent up the mast on ${strung} lines, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(lift) : undefined}
      aria-valuetext={interactive ? `block ${percent} percent up the mast` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.15)
        if (delta !== 0) apply(lift + delta)
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
          d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 18}`}
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
            <path data-ground d={solid([{ x: -66, y: 0 }, { x: 66, y: 0 }], 52)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: -66, y: 0 }, { x: 66, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {showString && (
          <g data-hole>
            <path d={box(-9, -18, 9, 0, 9)} fill={palette.dark} opacity={0.55} />
            <path d={box(-3, -18, 3, FLOOR, 3)} {...machined} />
          </g>
        )}

        {/* Substructure and rig floor. */}
        <path data-substructure d={box(-58, 0, 58, FLOOR, 46)} {...cast} />
        <path
          d={line([{ x: -58, y: 2 }, { x: -20, y: FLOOR - 2 }, { x: -58, y: FLOOR - 2 }, { x: -20, y: 2 }], 46)}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.4}
          opacity={0.55}
        />
        <path
          d={line([{ x: 58, y: 2 }, { x: 20, y: FLOOR - 2 }, { x: 58, y: FLOOR - 2 }, { x: 20, y: 2 }], 46)}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.4}
          opacity={0.55}
        />
        <path d={box(-62, FLOOR, 62, FLOOR + 5, 48)} {...shell} />

        {/* The mast: four legs, girts across the bays, and their diagonals. */}
        <g data-mast>
          {legs(MAST_DEPTH)}
          {girts.map((y) => (
            <path key={y} d={bar({ x: -spreadAt(y), y }, { x: spreadAt(y), y }, 1.6, 2, MAST_DEPTH)} {...machined} />
          ))}
          {girts.slice(0, -1).map((y, index) => (
            <path
              key={`brace-${y}`}
              d={line(
                [
                  { x: -spreadAt(y), y },
                  { x: spreadAt(girts[index + 1]), y: girts[index + 1] },
                  { x: -spreadAt(girts[index + 1]), y: girts[index + 1] },
                  { x: spreadAt(y), y },
                ],
                MAST_DEPTH,
              )}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.1}
              opacity={0.75}
            />
          ))}
          {legs(-MAST_DEPTH)}
        </g>

        {showRack && (
          <g data-rack>
            {[0, 1, 2, 3, 4].map((index) => (
              <path
                key={index}
                d={bar({ x: -32 + index * 4.5, y: FLOOR + 5 }, { x: -30 + index * 4.5, y: 172 }, 1.3, 1.3, -20)}
                {...cast}
              />
            ))}
          </g>
        )}

        {/* Crown block. */}
        <g data-crown>
          <path d={box(-CROWN_SPREAD - 4, CROWN - 8, CROWN_SPREAD + 4, CROWN + 10, MAST_DEPTH - 6)} {...shell} />
          <path d={disc({ x: 0, y: CROWN }, 8, 12)} {...cast} />
          <path d={disc({ x: 0, y: CROWN }, 3, 13)} {...machined} />
        </g>

        {/* The rope, then the block it carries. */}
        <path
          data-falls
          data-lines={strung}
          d={line(rope)}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.1}
        />
        <path
          d={line([rope[rope.length - 1], { x: 26, y: CROWN - 12 }, { x: DRUM.x, y: DRUM.y + DRUM_RADIUS }])}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.1}
        />

        <g data-block data-height={px(blockY)}>
          <path d={box(-13, blockY - 9, 13, blockY + 11, 11)} {...shell} />
          <path d={disc({ x: 0, y: blockY }, 7, 9)} {...cast} />
          <path data-hook d={box(-6, blockY - 26, 6, blockY - 8, 6)} {...machined} />
          <path d={disc({ x: 0, y: blockY - 30 }, 6, 6)} {...cast} />
        </g>

        {showString && (
          <g data-string>
            <path d={box(-5, FLOOR, 5, blockY - 30, 5)} {...machined} />
            <path d={box(-11, FLOOR + 3, 11, FLOOR + 12, 11)} {...cast} />
            <path
              data-mud
              d={line([{ x: 11, y: FLOOR + 8 }, { x: 46, y: FLOOR + 8 }, { x: 46, y: FLOOR - 26 }])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Drawworks: the drum whose turns put the block where it is. */}
        <g data-drum data-turns={px(turns)}>
          <path d={box(DRUM.x - 20, FLOOR + 5, DRUM.x + 20, DRUM.y + 4, 18)} {...cast} />
          <path d={disc(DRUM, DRUM_RADIUS, 16)} {...machined} />
          {[0, 60, 120].map((spoke) => (
            <path
              key={spoke}
              d={line([
                rigidPoint(DRUM, drumAngle + spoke, -DRUM_RADIUS),
                rigidPoint(DRUM, drumAngle + spoke, DRUM_RADIUS),
              ], 17)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
            />
          ))}
        </g>

        {/* Standpipe and rotary hose up the near leg. */}
        <path d={bar({ x: -50, y: FLOOR + 4 }, { x: -50, y: 150 }, 2, 2, -MAST_DEPTH)} {...machined} />
        <path
          d={`${line([{ x: -50, y: 150 }], -MAST_DEPTH)} Q ${px(to({ x: -34, y: blockY + 4 }, -12).x)} ${px(to({ x: -34, y: blockY + 4 }, -12).y)} ${px(to({ x: -7, y: blockY - 22 }).x)} ${px(to({ x: -7, y: blockY - 22 }).y)}`}
          fill="none"
          stroke={palette.accent}
          strokeWidth={2.2}
          opacity={0.85}
        />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 34, y: blockY }).x)}
            y={px(to({ x: 34, y: blockY }).y)}
            textAnchor="start"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${strung}× · ${px(reeved.travel)}`}
          </text>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 7}
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

/**
 * Where the block should be at `clock`, 0 at the floor to 1 at the crown.
 *
 * `trip` runs the whole mast, up and back; `drill` is the other thing a block
 * does — a slow feed off the top, then back up to make the next connection.
 */
export function derrickHoist(behavior: DerrickBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.68
  const t = ((clock % 1) + 1) % 1
  if (behavior === "drill") {
    return t < 0.82 ? 0.92 - (t / 0.82) * 0.66 : 0.26 + ((t - 0.82) / 0.18) * 0.66
  }
  return 0.06 + (1 - Math.abs(2 * t - 1)) * 0.88
}

export { DrillingDerrick }
