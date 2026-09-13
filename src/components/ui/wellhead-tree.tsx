"use client"

/**
 * wellhead-tree — the valve stack that stands on a completed well.
 *
 * `solenoid-valve` is one valve; this is the assembly. Which bore carries
 * product is not decoration: the `service` pose says which valves are open, and
 * the accent is drawn only along the path those open valves actually leave
 * through. Shut the master and nothing above it is live.
 *
 * Every valve shows its state the way a real one does — the stem stands up out
 * of the bonnet when it is open and sits down when it is shut — and the
 * adjustable choke's bean opening sets both the indicator and the width of the
 * flow line leaving it.
 *
 * `pressure` is a reading you supply. The component never infers it from the
 * choke, the service pose, or anything else, and computes no flow, pressure,
 * temperature or rate of any kind.
 */

import * as React from "react"

import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { rigidPoint } from "@/lib/robocn/linkage"
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

export type WellheadBehavior = "throttle" | "shut-in" | "static"
/** What the tree is lined up to do. */
export type WellheadService = "production" | "shut-in" | "kill"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 250
const NATIVE_VIEW: RobotView = "front"

const CROSS = 168
const CHOKE_X = 68
const KILL_X = -68

const ENVELOPE = boxCorners({ x: -96, y: -12, z: -36 }, { x: 96, y: 234, z: 36 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

type ValveName = "master" | "swab" | "wing-left" | "wing-right"

/** Which valves each service pose has open. */
const services: Record<WellheadService, Record<ValveName, boolean>> = {
  production: { master: true, swab: false, "wing-left": false, "wing-right": true },
  "shut-in": { master: false, swab: false, "wing-left": false, "wing-right": false },
  kill: { master: true, swab: false, "wing-left": true, "wing-right": false },
}

export interface WellheadTreeProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled choke opening, 0 shut to 1 wide open. Supplying it stops the loop. */
  choke?: number
  onChokeChange?: (choke: number) => void
  behavior?: WellheadBehavior
  service?: WellheadService
  /**
   * A gauge reading you supply, 0 to 1 of the dial. Never inferred: the tree
   * has no pressure model.
   */
  pressure?: number
  showFlow?: boolean
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

function WellheadTree({
  choke,
  onChokeChange,
  behavior = "throttle",
  service = "production",
  pressure = 0.58,
  showFlow = true,
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
}: WellheadTreeProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = choke !== undefined
  const lineup = services[service] ?? services.production

  const hold = controlled ? (Number.isFinite(choke) ? clamp(choke as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => wellheadChoke(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.8,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const open = clamp(motion.value, 0, 1)
  const dial = Number.isFinite(pressure) ? clamp(pressure, 0, 1) : 0

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onChokeChange?.(bounded)
    },
    [onChokeChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** A gate valve: a body, a rising stem, and the wheel on top of it. */
  const valve = (
    name: ValveName,
    centre: Vec2,
    half: number,
    turned: number,
    isOpen: boolean,
  ) => {
    const stem = rigidPoint(centre, turned, half + 8 + (isOpen ? 20 : 1))
    const bonnet = rigidPoint(centre, turned, half + 2)
    return (
      <g key={name} data-valve={name} data-open={isOpen ? "true" : "false"}>
        <path d={box(centre.x - half, centre.y - half, centre.x + half, centre.y + half, half)} {...shell} />
        <path d={bar(centre, bonnet, half * 0.55, half * 0.55)} {...cast} />
        <path d={bar(bonnet, stem, 2, 2)} {...machined} />
        <path d={disc(stem, 8, 1.6)} {...machined} />
        <path d={disc(stem, 2.6, 2.2)} {...cast} />
      </g>
    )
  }

  const percent = Math.round(open * 100)
  const live = lineup.master && open > 0.02
  const outlet = lineup["wing-right"] ? CHOKE_X : lineup["wing-left"] ? KILL_X : 0
  const needle = rigidPoint({ x: 0, y: 222 }, 210 - dial * 240, 8)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Wellhead tree lined up for ${service}, choke ${percent} percent open, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(open) : undefined}
      aria-valuetext={interactive ? `choke ${percent} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(open + delta)
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
            <path data-ground d={solid([{ x: -92, y: 0 }, { x: 92, y: 0 }], 34)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: -92, y: 0 }, { x: 92, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {/* Casing head and the spools stacked on it. */}
        <path d={box(-12, -12, 12, 6, 12)} fill={palette.dark} opacity={0.55} />
        <path data-casing d={box(-34, 6, 34, 26, 34)} {...cast} />
        <path d={box(-29, 26, 29, 52, 29)} {...shell} />
        <path d={box(-32, 50, 32, 56, 32)} {...machined} />
        <path data-tubing d={box(-26, 56, 26, 84, 26)} {...shell} />
        <path d={box(-29, 82, 29, 88, 29)} {...machined} />

        {/* The production bore, from the hanger up through the tree. */}
        <path d={box(-9, 88, 9, 214, 9)} {...cast} />
        {live && (
          <path
            data-flow
            d={line([{ x: 0, y: 92 }, { x: 0, y: CROSS }])}
            fill="none"
            stroke={palette.accent}
            strokeWidth={5}
            opacity={0.85}
          />
        )}

        {/* Flow cross, with a wing each side. */}
        <path data-cross d={box(-24, CROSS - 16, 24, CROSS + 16, 24)} {...shell} />
        <path d={box(-56, CROSS - 10, 56, CROSS + 10, 10)} {...shell} />

        {valve("master", { x: 0, y: 120 }, 17, 0, lineup.master)}
        {valve("swab", { x: 0, y: 200 }, 14, 0, lineup.swab)}
        {valve("wing-left", { x: -44, y: CROSS }, 13, 180, lineup["wing-left"])}
        {valve("wing-right", { x: 44, y: CROSS }, 13, 0, lineup["wing-right"])}

        {/* Adjustable choke: the bean, its stem, and the opening indicator. */}
        <g data-choke data-opening={px(open)}>
          <path d={box(CHOKE_X - 14, CROSS - 15, CHOKE_X + 14, CROSS + 15, 14)} {...cast} />
          <path d={bar({ x: CHOKE_X, y: CROSS + 14 }, { x: CHOKE_X, y: CROSS + 22 + open * 14 }, 2.4, 2.4)} {...machined} />
          <path d={disc({ x: CHOKE_X, y: CROSS + 26 + open * 14 }, 9, 2)} {...machined} />
          <path
            d={line([
              { x: CHOKE_X - 8, y: CROSS - 9 },
              { x: CHOKE_X - 8, y: lerp(CROSS - 9, CROSS + 9, open) },
            ], 15)}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>

        {/* Kill wing: a blind on the side product does not normally leave by. */}
        <path d={box(KILL_X - 12, CROSS - 12, KILL_X + 12, CROSS + 12, 12)} {...cast} />

        {showFlow && live && outlet !== 0 && (
          <path
            data-outlet
            d={line([
              { x: 0, y: CROSS },
              { x: outlet, y: CROSS },
              { x: outlet * 1.35, y: CROSS },
              { x: outlet * 1.35, y: 16 },
            ])}
            fill="none"
            stroke={palette.accent}
            strokeWidth={2 + open * 4}
            strokeLinecap="round"
            opacity={0.9}
          />
        )}

        {/* Tree cap and the gauge on top of it. */}
        <path d={box(-16, 214, 16, 222, 16)} {...machined} />
        <path data-gauge data-reading={px(dial)} d={disc({ x: 0, y: 228 }, 11, 4)} {...machined} />
        <path d={line([{ x: 0, y: 228 }, needle], 5)} fill="none" stroke={palette.dark} strokeWidth={1.6} strokeLinecap="round" />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 44, y: 208 }).x)}
            y={px(to({ x: 44, y: 208 }).y)}
            textAnchor="start"
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
 * Choke opening at `clock`. `throttle` works the bean across its range;
 * `shut-in` closes it and leaves it closed, which is the other thing a choke
 * spends its life doing.
 */
export function wellheadChoke(behavior: WellheadBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.55
  const t = ((clock % 1) + 1) % 1
  if (behavior === "shut-in") return t < 0.35 ? 0.72 - (t / 0.35) * 0.72 : 0
  return 0.12 + (1 - Math.abs(2 * t - 1)) * 0.8
}

export { WellheadTree }
