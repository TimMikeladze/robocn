"use client"

/**
 * flare-stack — the one machine in the family that is a process rather than a
 * mechanism.
 *
 * Everything solid here is modelled: the knockout drum on its saddles, the
 * derrick-supported riser, the tip with its wind shield, the steam ring and the
 * pilots. The plume is *illustrated* — `flow` sets its length and the lobes it
 * is drawn from, and `wind` leans it — and that is stated here, in the docs
 * `notes`, and nowhere is it presented as combustion.
 *
 * Nothing computes heat, radiation, smoke, composition, velocity or flame
 * length from a rate. `flow` is a proportion of the drawn plume.
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

export type FlareStackBehavior = "flare" | "pilot" | "static"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 300
const NATIVE_VIEW: RobotView = "front"

const TIP = 216
const RISER_R = 7
const DERRICK_TOP = 190
const BASE_SPREAD = 34
const TOP_SPREAD = 13

const ENVELOPE = boxCorners({ x: -84, y: 0, z: -50 }, { x: 84, y: 340, z: 50 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface FlareStackProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled flow to the tip, 0 pilots only to 1 full. Stops the loop. */
  flow?: number
  onFlowChange?: (flow: number) => void
  behavior?: FlareStackBehavior
  /** Lean on the plume, in degrees from vertical. */
  wind?: number
  /** The knockout drum and the header running up to the riser. */
  showKnockout?: boolean
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

function FlareStack({
  flow,
  onFlowChange,
  behavior = "flare",
  wind = 14,
  showKnockout = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.5,
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
}: FlareStackProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = flow !== undefined
  const lean = Number.isFinite(wind) ? clamp(wind, -50, 50) : 0

  const hold = controlled ? (Number.isFinite(flow) ? clamp(flow as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => flareStackFlow(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.4,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const rate = clamp(motion.value, 0, 1)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onFlowChange?.(bounded)
    },
    [onFlowChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** The plume: three lobes off the tip, all leaning the same way. */
  const height = 18 + rate * 96
  const plume = (scale: number, spread: number): Vec2[] => {
    const root = { x: 0, y: TIP + 14 }
    const nose = rigidPoint(root, 90 - lean, height * scale)
    const waist = rigidPoint(root, 90 - lean, height * scale * 0.45)
    return [
      { x: root.x - spread, y: root.y },
      rigidPoint(waist, 90 - lean, 0, spread * 1.15),
      nose,
      rigidPoint(waist, 90 - lean, 0, -spread * 1.15),
      { x: root.x + spread, y: root.y },
    ]
  }
  const percent = Math.round(rate * 100)
  const girts = [40, 76, 112, 148, 184]
  const spreadAt = (y: number) =>
    lerp(BASE_SPREAD, TOP_SPREAD, clamp((y - 8) / (DERRICK_TOP - 8), 0, 1))

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Flare stack, ${percent} percent flow to the tip, plume leaning ${px(lean)} degrees, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(rate) : undefined}
      aria-valuetext={interactive ? `${percent} percent flow` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(rate + delta)
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
            <path data-ground d={solid([{ x: -80, y: 0 }, { x: 80, y: 0 }], 46)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: -80, y: 0 }, { x: 80, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {showKnockout && (
          <g data-knockout>
            <path d={box(-76, 18, -26, 46, 16)} {...shell} />
            <path d={box(-70, 6, -60, 18, 8)} {...cast} />
            <path d={box(-42, 6, -32, 18, 8)} {...cast} />
            <path
              d={line([{ x: -26, y: 34 }, { x: -10, y: 34 }, { x: -10, y: 74 }])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={3.4}
              strokeLinecap="round"
            />
            <path d={disc({ x: -51, y: 52 }, 6, 6)} {...machined} />
          </g>
        )}

        {/* The derrick that holds the riser up. */}
        <g data-boom>
          {[-1, 1].map((side) =>
            [-26, 26].map((offset) => (
              <path
                key={`${side}:${offset}`}
                d={bar({ x: side * BASE_SPREAD, y: 6 }, { x: side * TOP_SPREAD, y: DERRICK_TOP }, 2.2, 2.6, offset)}
                {...machined}
              />
            )),
          )}
          {girts.map((y) => (
            <path key={y} d={bar({ x: -spreadAt(y), y }, { x: spreadAt(y), y }, 1.5, 1.8, 26)} {...machined} />
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
                26,
              )}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1}
              opacity={0.7}
            />
          ))}
        </g>

        {/* Riser, tip, wind shield, steam ring, pilots. */}
        <path data-riser d={box(-RISER_R, 8, RISER_R, TIP, RISER_R)} {...machined} />
        <g data-tip>
          <path d={box(-12, TIP - 12, 12, TIP + 14, 12)} {...cast} />
          <path d={box(-15, TIP + 6, 15, TIP + 14, 15)} {...shell} />
          <g transform={camera.plane(TIP + 2) || undefined}>
            <circle r={19} fill="none" stroke={palette.metal} strokeWidth={2.4} />
          </g>
          {[-1, 1].map((side) => (
            <g key={side} data-pilot>
              <path d={bar({ x: side * 19, y: TIP - 6 }, { x: side * 15, y: TIP + 12 }, 1.6, 1.6)} {...machined} />
              <path d={disc({ x: side * 15, y: TIP + 15 }, 3, 3)} fill={palette.accent} />
            </g>
          ))}
        </g>

        {/* The plume. Drawn, not burned. */}
        <g data-plume data-flow={px(rate)} opacity={0.92}>
          <path d={line(plume(1, 13), 0, true)} fill={palette.glow} opacity={0.22} />
          <path d={line(plume(0.74, 9), 0, true)} fill={palette.accent} opacity={0.55} />
          <path d={line(plume(0.4, 5.5), 0, true)} fill={palette.accent} />
        </g>

        {/* Access ladder, on the near face where it can be seen. */}
        <path d={bar({ x: -BASE_SPREAD + 6, y: 8 }, { x: -TOP_SPREAD + 4, y: DERRICK_TOP }, 1.2, 1.2, 30)} {...machined} />

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 46, y: TIP }).x)}
            y={px(to({ x: 46, y: TIP }).y)}
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
 * Flow to the tip at `clock`. `flare` is a relief event — a fast rise and a
 * long decay; `pilot` is the rest of the year, pilots lit and nothing else.
 */
export function flareStackFlow(behavior: FlareStackBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.5
  const t = ((clock % 1) + 1) % 1
  if (behavior === "pilot") return 0.05 + Math.sin(t * Math.PI * 2) * 0.03
  return t < 0.14 ? t / 0.14 : 0.12 + Math.exp(-(t - 0.14) * 3.4) * 0.88
}

export { FlareStack }
