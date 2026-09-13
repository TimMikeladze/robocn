"use client"

/**
 * suction-gripper — a bellows cup bar, and the sheet it picks.
 *
 * `robot-gripper`'s opposite number: no fingers, no pivot, nothing that
 * closes. One axis brings the bar down until the lips touch, and everything
 * past that goes into the bellows rather than into the stroke — which is why
 * the head stops where the part is and the cups keep taking up the difference.
 * A held sheet rides the lips, so the vacuum is visible in where the part is.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 160
const CENTRE = { x: 95, y: 76 }
/** Full stroke of the axis, and the part of it the head can actually travel. */
const STROKE = 55
const CONTACT = 46
/** How far the bellows can be squashed once the lips are down. */
const SQUASH = 9
const BELLOWS = 16
/** Where the lips sit with the head fully raised. */
const LIP = 70
const TABLE = LIP + CONTACT + 5
/** Descent (0–1) per second while easing back into the behaviour. */
const SLEW_RATE = 0.8
/** Drawn face on, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

const fits: Record<RobotView, number> = { plan: 0.92, front: 1, profile: 0.92, iso: 0.88 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type SuctionBehavior = "cycle" | "breathe" | "static"

export interface SuctionGripperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled descent, 0 raised to 1 pressed. Omit to run `behavior`. */
  descent?: number
  /** What the head does when `descent` is not supplied. */
  behavior?: SuctionBehavior
  /** Where the camera stands. One head, four projections. */
  view?: RobotView
  /** Pick cycles per second, or breaths per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the bar down onto the sheet, or arrow-key it. */
  interactive?: boolean
  onDescentChange?: (descent: number) => void
  /** Is the line live at all. With it off the cups never take the sheet. */
  vacuum?: boolean
  /**
   * Override whether the sheet is held. Left out, a controlled head holds once
   * the lips are down, and an uncontrolled one holds for the part of its cycle
   * that follows contact.
   */
  holding?: boolean
  /** Cups on the bar, clamped to 2–8. */
  cups?: number
  showSheet?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function SuctionGripper({
  descent,
  behavior = "cycle",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onDescentChange,
  vacuum = true,
  holding,
  cups = 5,
  showSheet = true,
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
}: SuctionGripperProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = descent !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(descent) ? clamp(descent, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => suctionGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 4),
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const at01 = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onDescentChange?.(bounded)
    },
    [onDescentChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.y * VIEW_HEIGHT - 30) / STROKE),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const count = Number.isFinite(cups) ? clamp(Math.round(cups), 2, 8) : 5
  // The head stops at contact; the rest of the axis goes into the bellows.
  const travel = Math.min(at01 * STROKE, CONTACT)
  const squash = clamp(at01 * STROKE - CONTACT, 0, SQUASH)
  const sealed = controlled || held !== null ? at01 * STROKE >= CONTACT : suctionSeal(behavior, motion.clock)
  const carrying = vacuum && (holding ?? sealed)
  const bellows = BELLOWS - squash
  const lip = LIP + travel
  const sheetTop = carrying ? lip : TABLE - 5
  const readout = Math.round(at01 * 100)
  const spread = count > 1 ? 126 / (count - 1) : 0

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE.x, CENTRE.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A block through the machine, in drawing coordinates. */
  const box = (x0: number, x1: number, top: number, bottom: number, halfDepth: number) =>
    extrudedPath(
      roundedFootprint(Math.abs(x1 - x0) / 2, halfDepth, 2, 4).map((p) => ({
        x: p.x + CENTRE.x - (x0 + x1) / 2,
        y: p.y,
      })),
      camera,
      CENTRE.y - top,
      CENTRE.y - bottom,
    )

  const cupX = (i: number) => px(95 - (spread * (count - 1)) / 2 + i * spread)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Suction gripper, ${count} cups, ${readout} percent down, ${carrying ? "holding a sheet" : "empty"}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% down, ${carrying ? "holding" : "empty"}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(at01 + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 190 160"
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
      data-view={view}
      {...props}
    >
      <g
        transform={
          fit === 1
            ? undefined
            : `translate(${CENTRE.x} ${CENTRE.y}) scale(${fit}) translate(${-CENTRE.x} ${-CENTRE.y})`
        }
      >
        {offAxis && (
          <g data-solids transform={`translate(${CENTRE.x} ${CENTRE.y})`}>
            <path d={box(14, 176, TABLE, TABLE + 12, 22)} {...cast} />
            {showSheet && <path d={box(32, 158, sheetTop, sheetTop + 5, 17)} {...machined} />}
            <path d={box(20, 170, px(28 + travel), px(44 + travel), 11)} {...shell} />
            <path d={box(78, 112, px(14 + travel), px(28 + travel), 8)} {...machined} />
          </g>
        )}

        <Frame {...frame}>
          <g data-gripper>
            <g data-table>
              <rect x={14} y={TABLE} width={162} height={12} rx={2} {...cast} />
              <path
                d={`M 14 ${TABLE} H 176`}
                stroke={palette.metal}
                strokeWidth={1}
                fill="none"
              />
            </g>
            {showSheet && (
              <rect data-sheet x={32} y={px(sheetTop)} width={126} height={5} rx={1.5} {...machined} />
            )}

            <g data-head transform={`translate(0 ${px(travel)})`}>
              <rect x={78} y={14} width={34} height={12} rx={3} {...machined} />
              {[84, 106].map((x) => (
                <circle key={x} cx={x} cy={20} r={2.2} fill={palette.dark} />
              ))}
              <g data-bar>
                <rect x={20} y={28} width={150} height={16} rx={4} {...shell} />
                <path d="M 26 36 H 164" stroke={palette.dark} strokeWidth={0.8} />
              </g>
              <g data-line>
                <g fill="none" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M 24 33 H 18 V 22" stroke={palette.dark} />
                  <path d="M 24 39 H 14 V 24" stroke={vacuum ? palette.accent : palette.metal} />
                </g>
                <rect x={10} y={13} width={14} height={11} rx={2.5} {...cast} />
                <circle cx={17} cy={18.5} r={2.4} fill={vacuum ? palette.accent : palette.metal} />
              </g>
              <g data-gauge transform="translate(170 20)">
                <circle r={8} {...cast} />
                <circle r={5.6} {...machined} />
                <path
                  d="M 0 0 V -4.6"
                  stroke={palette.accent}
                  strokeWidth={1.3}
                  transform={`rotate(${carrying ? -52 : 46})`}
                />
                <circle r={1.3} fill={palette.dark} />
              </g>

              {Array.from({ length: count }, (_, i) => {
                const x = cupX(i)
                const rings = 3
                const ring = bellows / rings
                return (
                  <g key={i} data-cup={i} transform={`translate(${x} 0)`}>
                    <rect x={-3} y={44} width={6} height={px(LIP - BELLOWS - 44)} rx={2} {...machined} />
                    <g data-bellows>
                      {Array.from({ length: rings }, (_, r) => (
                        <rect
                          key={r}
                          x={r % 2 ? -6.5 : -8.5}
                          y={px(LIP - bellows + r * ring)}
                          width={r % 2 ? 13 : 17}
                          height={px(Math.max(0.6, ring))}
                          rx={1.4}
                          {...cast}
                        />
                      ))}
                    </g>
                    <path
                      d={`M -6 ${px(LIP)} H 6 L 8.5 ${px(LIP + 4.5)} H -8.5 Z`}
                      {...shell}
                    />
                    {carrying && (
                      <path
                        d={`M -8.5 ${px(LIP + 5)} H 8.5`}
                        stroke={palette.accent}
                        strokeWidth={1.6}
                      />
                    )}
                  </g>
                )
              })}
            </g>

            {variant === "blueprint" && (
              <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
                <path d={`M 20 ${LIP} H 170`} strokeDasharray="2 3" />
                <path d={`M 178 ${LIP} V ${px(LIP + CONTACT)}`} strokeDasharray="2 2" />
              </g>
            )}
          </g>
        </Frame>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={95} y={150} fontSize={5}>
          {`${count} CUPS / ${readout}% / ${carrying ? "HOLDING" : vacuum ? "OPEN" : "OFF"}`}
        </text>
        {label && (
          <text x={95} y={157} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Descent, 0–1, at `clock`: down onto the sheet, lift, carry, and return. */
export function suctionGoal(behavior: SuctionBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "breathe") return 0.5 + Math.sin(t * Math.PI * 2) * 0.18
  if (t < 0.3) return t / 0.3
  if (t < 0.42) return 1
  if (t < 0.62) return 1 - (t - 0.42) / 0.2
  if (t < 0.78) return 0
  if (t < 0.9) return (t - 0.78) / 0.12
  return 1 - (t - 0.9) / 0.1
}

/** Whether the line is sealed on the sheet at `clock` — from contact until the
 *  cups are back down and let go, which is the half of the cycle that carries. */
export function suctionSeal(behavior: SuctionBehavior, clock: number) {
  if (behavior !== "cycle" || !Number.isFinite(clock)) return false
  const t = ((clock % 1) + 1) % 1
  return t >= 0.3 && t < 0.78
}

export { SuctionGripper }
