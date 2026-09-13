"use client"

/**
 * tool-changer — the coupler between a wrist and whatever it is holding.
 *
 * The only machine in the set that comes apart. `engagement` runs one axis
 * through two stages the drawing keeps separate: the tool half closes the gap
 * and seats on the spigot, and only then does the piston drive the lock balls
 * out into their groove. Nothing is drawn "locked" — the balls are where the
 * piston has pushed them.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
  capsulePath,
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

const VIEW_WIDTH = 150
const VIEW_HEIGHT = 212
const CENTRE = { x: 75, y: 96 }
/** How far the tool half hangs below its seat when the coupler is parked. */
const GAP = 26
/** Engagement at which the halves are seated and the lock can start. */
const SEAT = 0.6
/** Engagement (0–1) per second while easing back into the behaviour. */
const SLEW_RATE = 0.85
/** Drawn face on, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

const fits: Record<RobotView, number> = { plan: 0.9, front: 1, profile: 0.9, iso: 0.88 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type ToolChangerBehavior = "dock" | "latch" | "static"
export type ToolChangerTool = "gripper" | "spindle" | "vacuum" | "none"

export interface ToolChangerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled engagement, 0 parked to 1 locked. Omit to run `behavior`. */
  engagement?: number
  /** What the coupler does when `engagement` is not supplied. */
  behavior?: ToolChangerBehavior
  /** Where the camera stands. One coupler, four projections. */
  view?: RobotView
  /** Dock cycles per second, or latch cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the tool half up to the coupler, or arrow-key it. */
  interactive?: boolean
  onEngagementChange?: (engagement: number) => void
  /** What is hanging off the tool half. */
  tool?: ToolChangerTool
  /** Lock balls round the spigot, clamped to 3–8. */
  balls?: number
  showDock?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ToolChanger({
  engagement,
  behavior = "dock",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onEngagementChange,
  tool = "gripper",
  balls = 6,
  showDock = true,
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
}: ToolChangerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = engagement !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(engagement) ? clamp(engagement, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => changerGoal(behavior, clock), [behavior])
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
      onEngagementChange?.(bounded)
    },
    [onEngagementChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      // Up the frame is toward the coupler, so up is engagement.
      (unit: Vec2) => apply(1 - (unit.y * VIEW_HEIGHT - 74) / 74),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // Two stages on one axis: close the gap, then drive the lock.
  const approach = clamp(at01 / SEAT, 0, 1)
  const lock = clamp((at01 - SEAT) / (1 - SEAT), 0, 1)
  const drop = px((1 - approach) * GAP)
  const count = Number.isFinite(balls) ? clamp(Math.round(balls), 3, 8) : 6
  const ballOut = 15.5 + lock * 4
  const piston = 62 + lock * 14
  const state = lock >= 1 ? "locked" : approach >= 1 ? "seated" : "parked"
  const readout = Math.round(at01 * 100)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE.x, CENTRE.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const at = (dx: number, dy: number, depth = 0) => {
    const p = camera.project(CENTRE.x - dx, CENTRE.y - dy, -depth)
    return { x: CENTRE.x + p.x, y: CENTRE.y + p.y }
  }
  /** A barrel on the coupler's own axis, between two heights. */
  const barrel = (radius: number, top: number, bottom: number) =>
    capsulePath(at(CENTRE.x, top, 0), at(CENTRE.x, bottom, 0), radius)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Tool changer, ${state}, ${readout} percent engaged, ${tool} tool, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% engaged, ${state}` : undefined}
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
      viewBox="0 0 150 212"
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
          <g data-solids>
            <path d={barrel(35, 30, 40)} {...machined} />
            <path d={barrel(27, 40, 88)} {...cast} />
            <path d={barrel(17, 88, 104)} {...machined} />
            <path d={barrel(27, px(104 + drop), px(142 + drop))} {...shell} />
          </g>
        )}

        <Frame {...frame}>
          <g data-changer>
            {showDock && (
              <g data-dock>
                {[-1, 1].map((side) => (
                  <g key={side}>
                    <rect x={side < 0 ? 14 : 114} y={118} width={22} height={7} rx={2.5} {...cast} />
                    <rect x={side < 0 ? 14 : 129} y={118} width={7} height={44} rx={2.5} {...machined} />
                  </g>
                ))}
              </g>
            )}

            <g data-half="robot">
              <rect x={40} y={26} width={70} height={13} rx={3} {...machined} />
              {[46, 60, 90, 104].map((x) => (
                <circle key={x} cx={x} cy={32.5} r={2.4} fill={palette.dark} />
              ))}
              <rect x={48} y={39} width={54} height={48} rx={5} {...cast} />
              <rect x={53} y={45} width={44} height={9} rx={2} {...machined} />
              <path d="M 56 60 h 38 M 56 66 h 38" stroke={palette.metal} strokeWidth={1.1} />
              <rect x={58} y={87} width={34} height={17} rx={2} {...machined} />
              <path d="M 58 104 L 63 110 H 87 L 92 104 Z" {...machined} />
              <g data-piston>
                <rect x={70} y={46} width={10} height={px(piston - 46)} rx={3} {...shell} />
                <rect x={66} y={px(piston - 6)} width={18} height={8} rx={2} {...cast} />
              </g>
              <g data-lock data-locked={lock >= 1 ? "true" : "false"}>
                {Array.from({ length: count }, (_, i) => {
                  // The balls sit round the spigot; the face shows them spread
                  // across it, which is what the elevation of a bolt circle is.
                  const spread = count > 1 ? (i / (count - 1)) * 2 - 1 : 0
                  const x = px(75 + spread * ballOut)
                  return (
                    <g key={i} data-ball={i}>
                      <circle cx={x} cy={97} r={3.2} {...machined} />
                      {lock > 0.5 && <circle cx={x} cy={97} r={1.5} fill={palette.accent} />}
                    </g>
                  )
                })}
              </g>
              <circle cx={75} cy={45} r={3} fill={lock >= 1 ? palette.accent : palette.metal} />
            </g>

            <g data-half="tool" transform={`translate(0 ${drop})`}>
              <rect x={56} y={100} width={38} height={8} rx={2} {...machined} />
              <rect x={48} y={106} width={54} height={36} rx={5} {...shell} />
              <rect x={54} y={112} width={42} height={7} rx={2} {...cast} />
              {[60, 90].map((x) => (
                <circle key={x} cx={x} cy={134} r={2.2} fill={palette.dark} />
              ))}
              <g data-tool={tool}>
                {tool === "gripper" && (
                  <>
                    <rect x={64} y={142} width={22} height={9} rx={2} {...cast} />
                    {[-1, 1].map((side) => (
                      <path
                        key={side}
                        d={capsulePath(
                          { x: 75 + side * 8, y: 151 },
                          { x: 75 + side * 13, y: 170 },
                          3.4,
                        )}
                        {...machined}
                      />
                    ))}
                  </>
                )}
                {tool === "spindle" && (
                  <>
                    <rect x={66} y={142} width={18} height={20} rx={3} {...cast} />
                    <path d="M 71 162 L 79 162 L 76 176 H 74 Z" {...machined} />
                    <circle cx={75} cy={176} r={2} fill={palette.accent} />
                  </>
                )}
                {tool === "vacuum" && (
                  <>
                    <rect x={69} y={142} width={12} height={12} rx={2} {...cast} />
                    <path d="M 63 154 H 87 L 81 168 H 69 Z" {...machined} />
                    <path d="M 69 168 H 81" stroke={palette.accent} strokeWidth={2} />
                  </>
                )}
              </g>
            </g>

            {variant === "blueprint" && (
              <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
                <path d="M 75 18 V 182" strokeDasharray="6 2 2 2" />
                <path d={`M 112 104 V ${px(104 + drop)}`} strokeDasharray="2 2" />
              </g>
            )}
          </g>
        </Frame>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={75} y={200} fontSize={5}>
          {`${state.toUpperCase()} / ${readout}%`}
        </text>
        {label && (
          <text x={75} y={208} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/**
 * Engagement at `clock`. `dock` runs the whole change — approach, lock, hold,
 * release; `latch` only works the lock, leaving the halves seated.
 */
export function changerGoal(behavior: ToolChangerBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "latch") return t < 0.5 ? 1 : SEAT
  if (t < 0.3) return (t / 0.3) * SEAT
  if (t < 0.45) return SEAT + ((t - 0.3) / 0.15) * (1 - SEAT)
  if (t < 0.75) return 1
  if (t < 0.9) return 1 - ((t - 0.75) / 0.15) * (1 - SEAT)
  return SEAT - ((t - 0.9) / 0.1) * SEAT
}

export { ToolChanger }
