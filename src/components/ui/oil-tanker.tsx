"use client"

/**
 * oil-tanker — the only machine in the set whose ground plane cuts through it.
 *
 * Everything else stands on the floor. A tanker floats in it, and `cargo` moves
 * the hull down through the waterline: the boot-top band, the draft marks and
 * the load line are painted on the *hull*, so loading her carries them under
 * while the sea line stays where it is. That is the whole axis.
 *
 * `swell` adds a heave and a trim taken straight off the clock; both turn the
 * whole hull about amidships, so the masts, the house and the manifold go with
 * it rather than being animated apart.
 *
 * The draft is a drawn proportion of a drawn hull. Nothing here solves
 * displacement, buoyancy, trim, stability, tonnage or a hull form.
 */

import * as React from "react"

import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
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

export type OilTankerBehavior = "laden" | "swell" | "static"

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 170
const NATIVE_VIEW: RobotView = "profile"

/** Hull, in its own frame: the keel at 0, the main deck at DEPTH. */
const DEPTH = 54
const STERN = 14
const BOW = 286
const HALF_BEAM = 26
/** How far she sits down between light and fully laden. */
const LIGHT_DRAFT = 14
const LADEN_DRAFT = 36
const MID = (STERN + BOW) / 2

const ENVELOPE = boxCorners({ x: -48, y: -40, z: -310 }, { x: 48, y: 116, z: 14 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Sheer line of the hull, in hull coordinates: keel at 0, deck at DEPTH. */
const hullOutline: Vec2[] = [
  { x: STERN, y: DEPTH },
  { x: STERN - 2, y: DEPTH - 12 },
  { x: STERN + 2, y: 6 },
  { x: STERN + 20, y: 0 },
  { x: BOW - 40, y: 0 },
  { x: BOW - 8, y: 5 },
  { x: BOW - 2, y: 14 },
  { x: BOW, y: DEPTH },
]

export interface OilTankerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled cargo, 0 in ballast to 1 fully laden. Supplying it stops the loop. */
  cargo?: number
  onCargoChange?: (cargo: number) => void
  behavior?: OilTankerBehavior
  /** Cargo tanks across the deck, which is also how many hatches are drawn. */
  tanks?: number
  /** The midship manifold, its hoses, and the cargo gauges beside it. */
  showManifold?: boolean
  /** The sea, and the hull's shadow in it. */
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

function OilTanker({
  cargo,
  onCargoChange,
  behavior = "laden",
  tanks = 6,
  showManifold = true,
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
}: OilTankerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = cargo !== undefined
  const holds = Number.isFinite(tanks) ? clamp(Math.round(tanks), 2, 10) : 6

  const hold = controlled ? (Number.isFinite(cargo) ? clamp(cargo as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => oilTankerCargo(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.45,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const laden = clamp(motion.value, 0, 1)
  const draft = lerp(LIGHT_DRAFT, LADEN_DRAFT, laden)
  // The sea is the datum, so the hull is what moves: everything is drawn in
  // hull coordinates and the whole ship is lifted to put her keel under water.
  const float = -draft
  const swell = behavior === "swell" && !controlled
  const heave = swell ? Math.sin(motion.clock * Math.PI * 2) * 2.4 : 0
  const trim = swell ? Math.sin(motion.clock * Math.PI * 2 + 1.1) * 1.6 : 0

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onCargoChange?.(bounded)
    },
    [onCargoChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const percent = Math.round(laden * 100)
  const hatches = Array.from({ length: holds }, (_, index) =>
    lerp(STERN + 82, BOW - 34, holds === 1 ? 0.5 : index / (holds - 1)),
  )
  // Afloat: the rigid motion of the hull, applied in the hull's own plane so
  // every camera sees the same ship rather than a rotated picture of one.
  const tilt = (trim * Math.PI) / 180
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const afloat = (point: Vec2): Vec2 => {
    const dx = point.x - MID
    const dy = point.y - DEPTH / 2
    return {
      x: MID + dx * cos - dy * sin,
      y: DEPTH / 2 + dx * sin + dy * cos + float + heave,
    }
  }
  const hsolid = (outline: Vec2[], halfDepth: number, offset = 0) =>
    solid(outline.map(afloat), halfDepth, offset)
  const hbox = (x0: number, y0: number, x1: number, y1: number, halfDepth: number, offset = 0) =>
    hsolid([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], halfDepth, offset)
  const hbar = (a: Vec2, b: Vec2, halfWidth: number, halfDepth: number, offset = 0) =>
    bar(afloat(a), afloat(b), halfWidth, halfDepth, offset)
  const hdisc = (centre: Vec2, radius: number, halfDepth: number, offset = 0) =>
    disc(afloat(centre), radius, halfDepth, offset)
  const hline = (points: Vec2[], depth = 0) => line(points.map(afloat), depth)
  const hpoint = (point: Vec2, depth = 0) => to(afloat(point), depth)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Crude oil tanker, ${percent} percent laden, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(laden) : undefined}
      aria-valuetext={interactive ? `${percent} percent laden` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(laden + delta)
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
          d={`M 8 ${VIEW_HEIGHT - 20} H ${VIEW_WIDTH - 8}`}
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
            data-sea
            d={solid([{ x: STERN - 26, y: 0 }, { x: BOW + 20, y: 0 }], 32)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-hull data-draft={px(draft)}>
          {/* Hull, then the boot top painted on it: the band that goes under. */}
          <path d={hsolid(hullOutline, HALF_BEAM)} {...shell} />
          <path
            data-boot
            d={hsolid(
              [
                { x: STERN + 4, y: LIGHT_DRAFT - 8 },
                { x: BOW - 6, y: LIGHT_DRAFT - 8 },
                { x: BOW - 6, y: LADEN_DRAFT + 3 },
                { x: STERN + 4, y: LADEN_DRAFT + 3 },
              ],
              HALF_BEAM + 0.4,
            )}
            {...cast}
          />
          <path d={hdisc({ x: BOW - 16, y: 8 }, 9, HALF_BEAM - 12)} {...shell} />

          {/* Draft marks forward and the load line amidships. */}
          {[8, 16, 24, 32, 40].map((mark) => (
            <path
              key={mark}
              d={hline([{ x: BOW - 16, y: mark }, { x: BOW - 8, y: mark }], HALF_BEAM + 0.6)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.4}
            />
          ))}
          <path d={hdisc({ x: MID - 26, y: 26 }, 6, HALF_BEAM + 0.6)} fill="none" stroke={palette.metal} strokeWidth={1.4} />
          <path
            d={hline([{ x: MID - 38, y: 26 }, { x: MID - 14, y: 26 }], HALF_BEAM + 0.6)}
            fill="none"
            stroke={palette.metal}
            strokeWidth={1.4}
          />

          {/* Main deck, tank hatches, and the trunk running forward. */}
          <path d={hbox(STERN, DEPTH, BOW, DEPTH + 4, HALF_BEAM)} {...machined} />
          {hatches.map((x) => (
            <path key={x} d={hdisc({ x, y: DEPTH + 8 }, 6, 6)} {...cast} />
          ))}
          <path d={hbox(STERN + 70, DEPTH + 4, BOW - 26, DEPTH + 7, 9)} {...cast} />

          {/* Accommodation, funnel and the masts. */}
          <g data-house>
            <path d={hbox(STERN + 12, DEPTH + 4, STERN + 60, DEPTH + 38, 22)} {...shell} />
            <path d={hbox(STERN + 16, DEPTH + 38, STERN + 52, DEPTH + 52, 24)} {...shell} />
            <path
              d={hline([{ x: STERN + 18, y: DEPTH + 46 }, { x: STERN + 50, y: DEPTH + 46 }], 25)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={4}
            />
            <path d={hbox(STERN + 24, DEPTH + 52, STERN + 44, DEPTH + 72, 12)} {...cast} />
          </g>
          <path d={hbar({ x: BOW - 46, y: DEPTH + 4 }, { x: BOW - 46, y: DEPTH + 38 }, 1.6, 1.6)} {...machined} />

          {showManifold && (
            <g data-manifold>
              <path d={hbox(MID - 16, DEPTH + 4, MID + 16, DEPTH + 12, 26)} {...cast} />
              <path d={hbar({ x: MID, y: DEPTH + 12 }, { x: MID, y: DEPTH + 34 }, 2.4, 2.4)} {...machined} />
              <path
                d={`${hline([{ x: MID, y: DEPTH + 32 }], 26)} Q ${px(hpoint({ x: MID + 4, y: DEPTH + 18 }, 44).x)} ${px(hpoint({ x: MID + 4, y: DEPTH + 18 }, 44).y)} ${px(hpoint({ x: MID + 2, y: LADEN_DRAFT }, 46).x)} ${px(hpoint({ x: MID + 2, y: LADEN_DRAFT }, 46).y)}`}
                fill="none"
                stroke={palette.accent}
                strokeWidth={3.2}
                strokeLinecap="round"
              />
              {/* Cargo gauges: how full she is, read off the control room. */}
              <g data-cargo data-level={px(laden)}>
                <path d={hbox(MID - 30, DEPTH + 6, MID - 20, DEPTH + 26, 4, -22)} {...cast} />
                <path
                  d={hbox(MID - 28, DEPTH + 8, MID - 22, DEPTH + 8 + laden * 16, 3, -22)}
                  fill={palette.accent}
                />
              </g>
            </g>
          )}
        </g>

        {/* The sea is the datum: it is drawn after the hull, and cuts it. */}
        {showGround && (
          <path
            data-waterline
            d={line([{ x: STERN - 26, y: 0 }, { x: BOW + 20, y: 0 }])}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            opacity={0.7}
          />
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: MID, y: -22 }).x)}
            y={px(to({ x: MID, y: -22 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`draft ${px(draft)}`}
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
 * How laden she is at `clock`. `laden` is a whole port call — load, carry,
 * discharge; `swell` holds her cargo and lets the sea do the moving.
 */
export function oilTankerCargo(behavior: OilTankerBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.72
  if (behavior === "swell") return 0.66
  const t = ((clock % 1) + 1) % 1
  if (t < 0.28) return 0.06 + (t / 0.28) * 0.88
  if (t < 0.62) return 0.94
  if (t < 0.88) return 0.94 - ((t - 0.62) / 0.26) * 0.88
  return 0.06
}

export { OilTanker }
