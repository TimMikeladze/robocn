"use client"

/**
 * storage-tank — a tank whose roof has no fixed height.
 *
 * An external floating roof rides on the liquid, and everything attached to it
 * moves too. The rolling ladder is the mechanism that makes that legible: it is
 * hinged at the top of the shell and its wheels rest on the deck, so its length
 * is constant and its angle is solved from wherever the roof is. Fill the tank
 * and the ladder lies down; empty it and the ladder stands up.
 *
 * The shell is a body of revolution, so its silhouette, its course seams, its
 * wind girder and its spiral stairway are all one geometry projected — no view
 * has its own drawing. With a `fixed` roof the level only shows on the gauge,
 * which is exactly the trade a cone-roof tank makes.
 *
 * No volume, mass, vapour, temperature or capacity is computed. `level` is a
 * proportion of the drawn shell height.
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

export type StorageTankBehavior = "fill" | "draw" | "static"
export type StorageTankRoof = "floating" | "fixed"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 210
const NATIVE_VIEW: RobotView = "front"

const RADIUS = 100
const BASE = 8
const TOP = 76
/** Where the roof sits empty and full. */
const ROOF_LOW = BASE + 8
const ROOF_HIGH = TOP - 8
/** Rolling ladder: hinged at the shell top, wheels on the deck. */
const LADDER_HINGE: Vec2 = { x: -RADIUS + 8, y: TOP + 4 }
const LADDER = 126

const ENVELOPE = boxCorners({ x: -118, y: 0, z: -118 }, { x: 118, y: 106, z: 118 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface StorageTankProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled liquid level, 0 empty to 1 full. Supplying it stops the loop. */
  level?: number
  onLevelChange?: (level: number) => void
  behavior?: StorageTankBehavior
  roof?: StorageTankRoof
  /** Shell courses drawn as seams up the tank. */
  courses?: number
  /** The spiral stairway up the outside of the shell. */
  showStair?: boolean
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

function StorageTank({
  level,
  onLevelChange,
  behavior = "fill",
  roof = "floating",
  courses = 4,
  showStair = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.2,
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
}: StorageTankProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = level !== undefined
  const seams = Number.isFinite(courses) ? clamp(Math.round(courses), 2, 8) : 4

  const hold = controlled ? (Number.isFinite(level) ? clamp(level as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => storageTankLevel(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.55,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const full = clamp(motion.value, 0, 1)
  const roofY = lerp(ROOF_LOW, ROOF_HIGH, full)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onLevelChange?.(bounded)
    },
    [onLevelChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const ring = circleFootprint(0, 0, RADIUS, 28)
  // The near half of the shell is what hides the far side of the roof. Looking
  // straight down it has no visible height, so there is nothing to hide.
  const nearWall = ring.filter((point) => camera.depth(point.x, 0, point.y) >= 0)
  const occluding = camera.lift > 0.02

  // The ladder keeps its length; only its angle answers the roof.
  const drop = LADDER_HINGE.y - roofY
  const run = Math.sqrt(Math.max(0, LADDER * LADDER - drop * drop))
  const wheel: Vec2 = { x: clamp(LADDER_HINGE.x + run, -RADIUS + 8, RADIUS - 8), y: roofY }

  const percent = Math.round(full * 100)
  const gaugeTop = lerp(BASE + 6, TOP - 6, full)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Storage tank with a ${roof} roof, ${percent} percent full, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(full) : undefined}
      aria-valuetext={interactive ? `${percent} percent full` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(full + delta)
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
          <path
            data-ground
            d={extrudedPath(circleFootprint(0, 0, 116, 24), camera, 0, 0)}
            fill={palette.dark}
            opacity={0.12}
          />
        )}

        {/* Ring pad and the shell standing on it. */}
        <path d={extrudedPath(circleFootprint(0, 0, 110, 24), camera, BASE, 0)} {...cast} />
        <path data-shell d={extrudedPath(ring, camera, TOP, BASE)} {...shell} />

        {/* The open top, then what is inside it. */}
        <g transform={camera.plane(TOP) || undefined}>
          <circle r={RADIUS - 2} fill={palette.dark} opacity={0.55} />
        </g>

        {roof === "floating" ? (
          <g data-roof data-height={px(roofY)}>
            <g transform={camera.plane(roofY) || undefined}>
              <circle r={RADIUS - 5} {...machined} />
              <circle data-seal r={RADIUS - 5} fill="none" stroke={palette.accent} strokeWidth={3} opacity={0.7} />
              {[0, 60, 120].map((spoke) => (
                <path
                  key={spoke}
                  d={`M ${px(Math.cos((spoke * Math.PI) / 180) * (RADIUS - 8))} ${px(Math.sin((spoke * Math.PI) / 180) * (RADIUS - 8))} L ${px(-Math.cos((spoke * Math.PI) / 180) * (RADIUS - 8))} ${px(-Math.sin((spoke * Math.PI) / 180) * (RADIUS - 8))}`}
                  stroke={palette.dark}
                  strokeWidth={1.1}
                  opacity={0.5}
                />
              ))}
              <circle r={9} {...cast} />
            </g>
            <path d={bar(LADDER_HINGE, wheel, 2.4, 7)} {...machined} />
            <path data-ladder d={disc(wheel, 4, 6)} {...cast} />
          </g>
        ) : (
          <g data-roof data-height={px(TOP)}>
            <path
              d={frustumPath(
                circleFootprint(0, 0, RADIUS - 1, 24),
                circleFootprint(0, 0, 10, 12),
                camera,
                TOP,
                TOP + 22,
              )}
              {...shell}
            />
            <path d={disc({ x: 0, y: TOP + 26 }, 7, 7)} {...machined} />
          </g>
        )}

        {occluding && <path d={extrudedPath(nearWall, camera, TOP, BASE)} {...shell} />}

        {/* Course seams and the wind girder, all on the same surface. */}
        {Array.from({ length: seams - 1 }, (_, index) => BASE + ((index + 1) * (TOP - BASE)) / seams).map((y) => (
          <g key={y} transform={camera.plane(y) || undefined}>
            <circle r={RADIUS} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.35} />
          </g>
        ))}
        <g transform={camera.plane(TOP) || undefined}>
          <circle r={RADIUS + 5} fill="none" stroke={palette.metal} strokeWidth={3} />
        </g>

        {showStair && (
          <path
            data-stair
            d={Array.from({ length: 44 }, (_, index) => {
              const t = index / 43
              const angle = -130 + t * 320
              const screen = camera.project(
                Math.cos((angle * Math.PI) / 180) * (RADIUS + 5),
                lerp(BASE, TOP, t),
                Math.sin((angle * Math.PI) / 180) * (RADIUS + 5),
              )
              return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
            }).join(" ")}
            fill="none"
            stroke={palette.metal}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        )}

        {/* Gauge board: the level, read off the outside of the shell. */}
        <g data-gauge>
          <path d={box(RADIUS + 6, BASE, RADIUS + 14, TOP, 4)} {...cast} />
          <path data-liquid d={box(RADIUS + 8, BASE + 4, RADIUS + 12, gaugeTop, 3)} fill={palette.accent} />
          <path d={disc({ x: RADIUS + 10, y: gaugeTop }, 5, 4)} {...machined} />
        </g>

        {/* Inlet nozzle and the line it feeds. */}
        <path d={box(-RADIUS - 22, BASE + 6, -RADIUS + 2, BASE + 18, 7)} {...machined} />
        <path
          d={line([{ x: -RADIUS - 20, y: BASE + 12 }, { x: -RADIUS - 40, y: BASE + 12 }])}
          fill="none"
          stroke={palette.accent}
          strokeWidth={4}
          strokeLinecap="round"
        />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: TOP + 26 }).x)}
            y={px(to({ x: 0, y: TOP + 26 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${percent}%`}
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

/**
 * Liquid level at `clock`. `fill` runs a tank up and back down; `draw` is the
 * other half of a tank's life — a slow steady draw-off, then a fast refill.
 */
export function storageTankLevel(behavior: StorageTankBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.62
  const t = ((clock % 1) + 1) % 1
  if (behavior === "draw") {
    return t < 0.78 ? 0.94 - (t / 0.78) * 0.8 : 0.14 + ((t - 0.78) / 0.22) * 0.8
  }
  return 0.08 + (1 - Math.abs(2 * t - 1)) * 0.86
}

/** Where the rolling ladder's wheels stand for a level: the solved contact. */
export function storageTankLadder(level: number) {
  const full = Number.isFinite(level) ? clamp(level, 0, 1) : 0
  const roofY = lerp(ROOF_LOW, ROOF_HIGH, full)
  const drop = LADDER_HINGE.y - roofY
  const run = Math.sqrt(Math.max(0, LADDER * LADDER - drop * drop))
  return { x: clamp(LADDER_HINGE.x + run, -RADIUS + 8, RADIUS - 8), y: roofY }
}

export { StorageTank }
