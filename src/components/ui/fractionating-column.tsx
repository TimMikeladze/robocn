"use client"

/**
 * fractionating-column — a vessel whose axis is its trays.
 *
 * `trays` is the count axis this family adds, and it is not decoration: the
 * tray spacing, the tray-ring seams welded round the shell, and the heights the
 * side draws are taken from are all derived from it, so asking for more trays
 * rebuilds the same column with closer separation rather than drawing a
 * different picture.
 *
 * The shell is a body of revolution, so the seams and the platform rings come
 * out exact from every camera. The draws are real nozzles with real valves; the
 * `cut` is which one is running, and the accent follows it.
 *
 * The temperature strip is an *illustrated* gradient and the flash zone is a
 * marker on it. Nothing here computes a flash, a separation, a composition, a
 * temperature or a rate.
 */

import * as React from "react"

import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  boxCorners,
  circleFootprint,
  elevationDraft,
  extrudedPath,
  fitTransform,
  frustumPath,
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

export type ColumnBehavior = "run" | "swing" | "static"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 300
const NATIVE_VIEW: RobotView = "front"

const RADIUS = 34
const SKIRT = 30
const SHELL_TOP = 250
const HEAD = 22
/** The four side draws, lightest at the top. */
const DRAWS = ["naphtha", "kerosene", "diesel", "gas oil"] as const

const ENVELOPE = boxCorners({ x: -96, y: 0, z: -60 }, { x: 96, y: 300, z: 60 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface FractionatingColumnProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled heat into the column, 0 to 1. It moves the flash zone. */
  heat?: number
  onHeatChange?: (heat: number) => void
  behavior?: ColumnBehavior
  /** Trays in the shell, 6 to 24. Sets the spacing and the seam count. */
  trays?: number
  /** Which side draw is running, 0 lightest. */
  cut?: number
  /** The overhead drum, the reflux line, and the reboiler at the bottom. */
  showCircuits?: boolean
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

function FractionatingColumn({
  heat,
  onHeatChange,
  behavior = "run",
  trays = 14,
  cut = 1,
  showCircuits = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.18,
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
}: FractionatingColumnProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = heat !== undefined
  const decks = Number.isFinite(trays) ? clamp(Math.round(trays), 6, 24) : 14
  const running = Number.isFinite(cut) ? clamp(Math.round(cut), 0, DRAWS.length - 1) : 1

  const hold = controlled ? (Number.isFinite(heat) ? clamp(heat as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => columnHeat(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.5,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const fire = clamp(motion.value, 0, 1)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onHeatChange?.(bounded)
    },
    [onHeatChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // Trays fill the shell above the flash zone; their spacing is the axis.
  const flash = lerp(SKIRT + 24, SKIRT + 96, fire)
  const trayAt = (index: number) =>
    lerp(flash + 8, SHELL_TOP - 12, decks === 1 ? 0.5 : index / (decks - 1))
  const drawAt = (index: number) =>
    trayAt(Math.round(lerp(decks - 2, 1, index / Math.max(1, DRAWS.length - 1))))
  const percent = Math.round(fire * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Fractionating column, ${decks} trays, drawing ${DRAWS[running]}, ${percent} percent heat, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(fire) : undefined}
      aria-valuetext={interactive ? `${percent} percent heat` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(fire + delta)
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
          <path
            data-ground
            d={extrudedPath(circleFootprint(0, 0, 52, 20), camera, 0, 0)}
            fill={palette.dark}
            opacity={0.12}
          />
        )}

        {/* Skirt, shell, and the head on top of it. */}
        <path d={extrudedPath(circleFootprint(0, 0, RADIUS + 4, 20), camera, SKIRT, 0)} {...cast} />
        <path data-shell d={extrudedPath(circleFootprint(0, 0, RADIUS, 20), camera, SHELL_TOP, SKIRT)} {...shell} />
        <path
          d={frustumPath(
            circleFootprint(0, 0, RADIUS, 20),
            circleFootprint(0, 0, RADIUS * 0.42, 14),
            camera,
            SHELL_TOP,
            SHELL_TOP + HEAD,
          )}
          {...shell}
        />

        {/* Tray seams: one weld ring per tray, on the surface of revolution. */}
        {Array.from({ length: decks }, (_, index) => index).map((index) => (
          <g key={index} data-tray={index} transform={camera.plane(trayAt(index)) || undefined}>
            <circle r={RADIUS} fill="none" stroke={palette.dark} strokeWidth={0.9} opacity={0.4} />
          </g>
        ))}

        {/* Flash zone, where the feed comes in. */}
        <g data-flash data-height={px(flash)}>
          <g transform={camera.plane(flash) || undefined}>
            <circle r={RADIUS + 1} fill="none" stroke={palette.accent} strokeWidth={3.4} opacity={0.75} />
          </g>
          <path d={box(-RADIUS - 26, flash - 5, -RADIUS + 2, flash + 5, 6)} {...machined} />
          <path
            data-feed
            d={line([{ x: -RADIUS - 24, y: flash }, { x: -78, y: flash }, { x: -78, y: 12 }])}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </g>

        {/* Side draws: a nozzle, a valve, and a line off to the right. */}
        {DRAWS.map((name, index) => {
          const y = drawAt(index)
          const live = index === running
          return (
            <g key={name} data-draw={index} data-live={live ? "true" : "false"}>
              <path d={box(RADIUS - 2, y - 4, RADIUS + 20, y + 4, 5)} {...machined} />
              <path d={disc({ x: RADIUS + 24, y }, 6, 5)} {...cast} />
              <path
                d={line([{ x: RADIUS + 28, y }, { x: 72 + index * 4, y }, { x: 72 + index * 4, y: 14 }])}
                fill="none"
                stroke={live ? palette.accent : palette.metal}
                strokeWidth={live ? 3.2 : 1.8}
                opacity={live ? 0.95 : 0.55}
                strokeLinecap="round"
              />
            </g>
          )
        })}

        {/* Platform rings and the caged ladder between them. */}
        {[SKIRT + 46, SKIRT + 112, SKIRT + 178].map((y) => (
          <g key={y} transform={camera.plane(y) || undefined}>
            <circle r={RADIUS + 12} fill="none" stroke={palette.metal} strokeWidth={2.6} />
          </g>
        ))}
        <path d={bar({ x: -RADIUS - 8, y: SKIRT }, { x: -RADIUS - 8, y: SHELL_TOP - 20 }, 1.4, 1.4, 30)} {...machined} />

        {showCircuits && (
          <>
            {/* Overhead: vapour out of the head, drum, reflux back. */}
            <g data-overhead>
              <path
                d={line([{ x: 0, y: SHELL_TOP + HEAD }, { x: 0, y: SHELL_TOP + HEAD + 16 }, { x: 62, y: SHELL_TOP + HEAD + 16 }])}
                fill="none"
                stroke={palette.metal}
                strokeWidth={3.4}
              />
              <path d={box(52, SHELL_TOP - 6, 92, SHELL_TOP + 14, 14)} {...shell} />
              <path
                d={line([{ x: 72, y: SHELL_TOP - 6 }, { x: 72, y: 16 }])}
                fill="none"
                stroke={palette.accent}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </g>
            {/* Reboiler at the bottom, returning to the flash zone. */}
            <g data-reboiler>
              <path d={box(-84, 18, -46, 40, 12)} {...shell} />
              <path
                d={line([{ x: -46, y: 30 }, { x: -RADIUS - 6, y: 30 }, { x: -RADIUS - 6, y: SKIRT + 10 }])}
                fill="none"
                stroke={palette.accent}
                strokeWidth={2.6}
                opacity={0.5 + fire * 0.5}
                strokeLinecap="round"
              />
            </g>
          </>
        )}

        {/* Skin temperature strip: hot at the bottom, with the flash marked. */}
        <path d={box(RADIUS + 6, SKIRT + 4, RADIUS + 12, SHELL_TOP - 8, 3, -28)} {...cast} />
        <path d={box(RADIUS + 7, SKIRT + 5, RADIUS + 11, flash, 2.4, -28)} fill={palette.accent} opacity={0.75} />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: SHELL_TOP + HEAD + 26 }).x)}
            y={px(to({ x: 0, y: SHELL_TOP + HEAD + 26 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${decks} trays · ${DRAWS[running]}`}
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
 * Heat at `clock`. `run` holds a steady case with a slow drift; `swing` is the
 * column being pushed from one cut point to another and back.
 */
export function columnHeat(behavior: ColumnBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.52
  const t = ((clock % 1) + 1) % 1
  if (behavior === "swing") return 0.12 + (1 - Math.abs(2 * t - 1)) * 0.82
  return 0.52 + Math.sin(t * Math.PI * 2) * 0.09
}

export { FractionatingColumn }
