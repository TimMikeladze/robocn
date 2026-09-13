"use client"

/**
 * cable-carrier — the energy chain that feeds a moving axis.
 *
 * The chain cannot change length, so when the carriage moves the fold has to
 * take up half of it. That single constraint is the whole mechanism and it is
 * solved in `transmission.ts`, which means the links are placed by arc length
 * along the real path rather than drawn in three poses and interpolated: at
 * any travel the pitch between neighbours is the same right round the bend.
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
import { carrierLinks } from "@/lib/robocn/transmission"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 112
const CENTRE = { x: 105, y: 62 }
/** The anchored run, the travel along it, and the fold that joins the two. */
const ANCHOR = 22
const SPAN = 150
const RADIUS = 11
const LOWER = 82
const UPPER = LOWER - RADIUS * 2
/** Rail the carriage runs on, above the chain. */
const RAIL = 30
/** Travel (0–1) per second while easing back into the loop. */
const SLEW_RATE = 0.5
/** Drawn from the side, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
const HALF_DEPTH = 9

const fits: Record<RobotView, number> = { plan: 0.9, front: 0.9, profile: 1, iso: 0.86 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type CableCarrierBehavior = "cycle" | "creep" | "static"

export interface CableCarrierProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled carriage travel, 0–1 along the run. Omit to run `behavior`. */
  travel?: number
  /** What the carriage does when `travel` is not supplied. */
  behavior?: CableCarrierBehavior
  /** Where the camera stands. One carrier, four projections. */
  view?: RobotView
  /** Full strokes per second, or creep cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the carriage along its rail, or arrow-key it. */
  interactive?: boolean
  onTravelChange?: (travel: number) => void
  /** Links in the chain, clamped to 8–40. The pitch follows from the length. */
  links?: number
  /** Strands run through the chain, clamped to 0–4. */
  cables?: number
  showRail?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function CableCarrier({
  travel,
  behavior = "cycle",
  view = NATIVE_VIEW,
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTravelChange,
  links = 26,
  cables = 3,
  showRail = true,
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
}: CableCarrierProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = travel !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(travel) ? clamp(travel, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => carrierGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 3),
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
      onTravelChange?.(bounded)
    },
    [onTravelChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x * VIEW_WIDTH - ANCHOR) / SPAN),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // Link count is the axis; the pitch is whatever the fixed length divides into.
  const count = Number.isFinite(links) ? clamp(Math.round(links), 8, 40) : 26
  const strands = Number.isFinite(cables) ? clamp(Math.round(cables), 0, 4) : 3
  // One throwaway link just to read the fixed chain length back out of the solver.
  const preview = carrierLinks(0, { anchor: ANCHOR, span: SPAN, radius: RADIUS, pitch: 1e6 })
  const pitch = preview.length / count
  const pose = carrierLinks(at01, { anchor: ANCHOR, span: SPAN, radius: RADIUS, pitch })
  const plate = Math.min(pitch * 0.86, 11)
  const readout = Math.round(at01 * 100)

  // The drawing is a side elevation, so it goes through `wall(0, 90)` where it
  // already stands: the run lies along the machine's own fore-aft axis and the
  // chain is as wide as its plates, which is the depth the side never showed.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), CENTRE.x, CENTRE.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A beam lying along the run: world x is depth, world z runs with the drawing. */
  const beam = (x0: number, x1: number, top: number, bottom: number, halfDepth = HALF_DEPTH) => {
    const a = x0 - CENTRE.x
    const b = x1 - CENTRE.x
    return extrudedPath(
      roundedFootprint(halfDepth, Math.abs(b - a) / 2, 2, 4).map((p) => ({
        x: p.x,
        y: p.y - (a + b) / 2,
      })),
      camera,
      -(top - CENTRE.y),
      -(bottom - CENTRE.y),
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Cable carrier, ${count} links, carriage at ${readout} percent of travel, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% of travel` : undefined}
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
      viewBox="0 0 210 112"
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
            <path d={beam(12, 198, LOWER + 8, LOWER + 16, HALF_DEPTH + 4)} {...cast} />
            {showRail && <path d={beam(14, 196, RAIL, RAIL + 6, 5)} {...machined} />}
            <path
              d={beam(px(pose.carriage) - 12, px(pose.carriage) + 12, RAIL + 2, UPPER, 7)}
              {...shell}
            />
          </g>
        )}

        <Frame {...frame}>
          <g data-carrier>
            <g data-trough>
              <rect x={12} y={LOWER + 8} width={186} height={8} rx={2} {...cast} />
              <path
                d={`M 12 ${LOWER + 8} H 198`}
                stroke={palette.metal}
                strokeWidth={1}
                fill="none"
              />
            </g>
            {showRail && (
              <g data-rail>
                <rect x={14} y={RAIL} width={182} height={6} rx={3} {...machined} />
                <path d={`M 14 ${RAIL + 3} H 196`} stroke={palette.dark} strokeWidth={1} />
              </g>
            )}

            <g data-anchor>
              <rect x={ANCHOR - 10} y={LOWER - 7} width={13} height={16} rx={2} {...cast} />
              <circle cx={ANCHOR - 4} cy={LOWER} r={2} {...machined} />
            </g>

            <g data-chain transform={`translate(0 ${LOWER})`}>
              {pose.links.map((link) => (
                <g
                  key={link.index}
                  data-link={link.index}
                  transform={`translate(${px(link.x)} ${px(link.y)}) rotate(${px(link.angle)})`}
                >
                  <rect x={px(-plate / 2)} y={-5.5} width={px(plate)} height={11} rx={2} {...shell} />
                  <rect x={px(-plate / 2 + 0.6)} y={-2.6} width={px(plate - 1.2)} height={5.2} rx={1.4} {...cast} />
                  <circle cx={px(-plate / 2 + 1.4)} r={1.1} fill={palette.metal} />
                </g>
              ))}
              {strands > 0 && (
                <g data-cable fill="none" strokeWidth={1.1} strokeLinecap="round">
                  {Array.from({ length: strands }, (_, s) => {
                    const offset = (s - (strands - 1) / 2) * 1.7
                    const d = pose.links
                      .map((link, i) => {
                        const a = (link.angle * Math.PI) / 180
                        const x = link.x - Math.sin(a) * offset
                        const y = link.y + Math.cos(a) * offset
                        return `${i ? "L" : "M"} ${px(x)} ${px(y)}`
                      })
                      .join(" ")
                    return (
                      <path
                        key={s}
                        d={d}
                        stroke={s === 0 ? palette.accent : s === 1 ? palette.metal : palette.dark}
                      />
                    )
                  })}
                </g>
              )}
            </g>

            <g data-carriage transform={`translate(${px(pose.carriage)} 0)`}>
              <rect x={-7} y={UPPER - 4} width={16} height={9} rx={2} {...cast} />
              <rect x={-9} y={RAIL + 2} width={18} height={px(UPPER - RAIL - 4)} rx={3} {...shell} />
              <rect x={-13} y={RAIL - 2} width={26} height={10} rx={3} {...machined} />
              <circle cy={RAIL + 3} r={2} fill={palette.accent} />
            </g>

            {variant === "blueprint" && (
              <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
                <path d={`M ${px(pose.bend)} ${LOWER - 30} V ${LOWER + 20}`} strokeDasharray="2 3" />
                <circle cx={px(pose.bend)} cy={UPPER + RADIUS} r={RADIUS} strokeDasharray="2 3" />
                <path d={`M ${ANCHOR} ${LOWER + 22} H ${px(pose.carriage)}`} />
              </g>
            )}
          </g>
        </Frame>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={105} y={104} fontSize={5}>
          {`${readout}% / ${count} LINKS / CHAIN ${px(pose.length)}`}
        </text>
        {label && (
          <text x={105} y={110} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Carriage travel, 0–1, at `clock`. `cycle` dwells at each end of the stroke. */
export function carrierGoal(behavior: CableCarrierBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "creep") return 0.5 + Math.sin(t * Math.PI * 2) * 0.12
  // Out, dwell, back, dwell.
  if (t < 0.4) return t / 0.4
  if (t < 0.5) return 1
  if (t < 0.9) return 1 - (t - 0.5) / 0.4
  return 0
}

export { CableCarrier }
