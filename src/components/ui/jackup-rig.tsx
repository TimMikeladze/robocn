"use client"

/**
 * jackup-rig — one number that is both the air gap and the leg left below it.
 *
 * The legs have a fixed length. The hull climbs them. So `elevation` raises the
 * deck out of the water and, by exactly the same amount, shortens the stick-up
 * above it — there is no second number and no way for the two halves of the
 * drawing to disagree. Below the water the leg reaches the spudcan on the
 * seabed, which is where it stays once she is preloaded.
 *
 * Legs are trusses in world space and the hull is a solid, so all four cameras
 * are the same rig. The seabed and the water are drawn; nothing computes
 * buoyancy, penetration, punch-through, leg loads or a sea state.
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

export type JackupBehavior = "jack" | "preload" | "static"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 280
const NATIVE_VIEW: RobotView = "front"

/** Sea level is the datum at y = 0; the seabed is below it. */
const SEABED = -56
const LEG_LENGTH = 236
const HULL_DEPTH = 30
const HULL_HALF = 92
/** Hull underside afloat, and jacked right up. */
const AFLOAT = -14
const ELEVATED = 92
const LEG_X = 62
const LEG_DEPTH = 46

const ENVELOPE = boxCorners({ x: -116, y: -66, z: -116 }, { x: 116, y: 244, z: 116 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface JackupRigProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled hull elevation, 0 afloat to 1 jacked right up. Stops the loop. */
  elevation?: number
  onElevationChange?: (elevation: number) => void
  behavior?: JackupBehavior
  /** Legs on the hull: three or four. */
  legs?: 3 | 4
  /** The cantilever and the drilling package skidded out over the stern. */
  showDerrick?: boolean
  /** The water and the seabed. */
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

/** Where each leg stands, in the hull's own plan: x across, y fore and aft. */
const legPlan = (count: number): Vec2[] =>
  count === 4
    ? [
        { x: -LEG_X, y: -LEG_DEPTH },
        { x: LEG_X, y: -LEG_DEPTH },
        { x: -LEG_X, y: LEG_DEPTH },
        { x: LEG_X, y: LEG_DEPTH },
      ]
    : [
        { x: -LEG_X, y: -LEG_DEPTH },
        { x: LEG_X, y: -LEG_DEPTH },
        { x: 0, y: LEG_DEPTH },
      ]

function JackupRig({
  elevation,
  onElevationChange,
  behavior = "jack",
  legs = 3,
  showDerrick = true,
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
}: JackupRigProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = elevation !== undefined
  const count = legs === 4 ? 4 : 3

  const hold = controlled ? (Number.isFinite(elevation) ? clamp(elevation as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => jackupElevation(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.4,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const raised = clamp(motion.value, 0, 1)

  // One number. The hull climbs a fixed leg, so the stick-up above the deck is
  // whatever the hull has not used up.
  const hullBottom = lerp(AFLOAT, ELEVATED, raised)
  const hullTop = hullBottom + HULL_DEPTH
  const legTop = SEABED + LEG_LENGTH
  const stickUp = legTop - hullTop

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "front")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onElevationChange?.(bounded)
    },
    [onElevationChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const stations = legPlan(count)
  const rungs = Array.from({ length: 11 }, (_, index) => SEABED + 8 + index * 22).filter(
    (y) => y < legTop - 6,
  )
  const percent = Math.round(raised * 100)
  // Legs behind the hull are drawn first so the hull hides what it should.
  const order = [...stations].sort((a, b) => camera.depth(-a.x, 0, -a.y) - camera.depth(-b.x, 0, -b.y))

  const legOf = (station: Vec2, key: string) => (
    <g key={key} data-leg={key}>
      <path d={box(station.x - 11, SEABED - 4, station.x + 11, SEABED + 6, 16, -station.y)} {...cast} />
      {[-9, 9].map((side) => (
        <path
          key={side}
          d={bar(
            { x: station.x + side, y: SEABED + 2 },
            { x: station.x + side, y: legTop },
            2,
            2.4,
            -station.y + side,
          )}
          {...machined}
        />
      ))}
      {rungs.map((y) => (
        <path
          key={y}
          d={line(
            [
              { x: station.x - 9, y },
              { x: station.x + 9, y: y + 11 },
              { x: station.x - 9, y: y + 22 },
            ],
            -station.y + 9,
          )}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.2}
          opacity={0.8}
        />
      ))}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Jack-up rig on ${count} legs, hull ${percent} percent elevated, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(raised) : undefined}
      aria-valuetext={interactive ? `hull ${percent} percent elevated` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(raised + delta)
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
            data-seabed
            d={solid([{ x: -112, y: SEABED }, { x: 112, y: SEABED }], 100)}
            fill={palette.dark}
            opacity={0.2}
          />
        )}

        {order.slice(0, count - 1).map((station, index) => legOf(station, `aft-${index}`))}

        {/* Hull: the deck box, the helideck, and the jacking houses on it. */}
        <g data-hull data-elevation={px(raised)}>
          <path d={box(-HULL_HALF, hullBottom, HULL_HALF, hullBottom + 8, 60)} {...cast} />
          <path d={box(-HULL_HALF, hullBottom + 6, HULL_HALF, hullTop, 58)} {...shell} />
          <path
            d={line([{ x: -HULL_HALF + 8, y: hullTop - 8 }, { x: HULL_HALF - 8, y: hullTop - 8 }], 58)}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.2}
            opacity={0.45}
          />
          <g transform={camera.plane(hullTop + 10) || undefined}>
            <circle cx={-76} r={24} {...machined} />
            <circle cx={-76} r={15} fill="none" stroke={palette.dark} strokeWidth={1.6} />
          </g>
          <path d={bar({ x: -76, y: hullTop }, { x: -76, y: hullTop + 10 }, 4, 4, -34)} {...cast} />
          {stations.map((station, index) => (
            <path
              key={index}
              data-jack={index}
              d={box(station.x - 15, hullTop, station.x + 15, hullTop + 16, 18, -station.y)}
              {...machined}
            />
          ))}
        </g>

        {order.slice(count - 1).map((station, index) => legOf(station, `fore-${index}`))}

        {showDerrick && (
          <g data-cantilever>
            <path d={box(28, hullTop, HULL_HALF + 34, hullTop + 8, 22)} {...machined} />
            <path d={box(HULL_HALF + 6, hullTop + 8, HULL_HALF + 30, hullTop + 74, 16)} {...shell} />
            <path
              d={line([
                { x: HULL_HALF + 6, y: hullTop + 8 },
                { x: HULL_HALF + 30, y: hullTop + 74 },
                { x: HULL_HALF + 6, y: hullTop + 74 },
                { x: HULL_HALF + 30, y: hullTop + 8 },
              ], 16)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
              opacity={0.5}
            />
            <path
              data-string
              d={line([{ x: HULL_HALF + 18, y: hullTop + 66 }, { x: HULL_HALF + 18, y: SEABED }])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={2.4}
              opacity={0.8}
            />
          </g>
        )}

        {/* The water is the datum, drawn over the legs it covers. */}
        {showGround && (
          <>
            <path
              data-water
              d={solid([{ x: -112, y: 0 }, { x: 112, y: 0 }], 100)}
              fill={palette.dark}
              opacity={0.14}
            />
            <path
              d={line([{ x: -112, y: 0 }, { x: 112, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.6}
              opacity={0.65}
            />
          </>
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: legTop + 14 }).x)}
            y={px(to({ x: 0, y: legTop + 14 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`air gap ${px(Math.max(0, hullBottom))} · stick-up ${px(Math.max(0, stickUp))}`}
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
 * Hull elevation at `clock`. `jack` is a full move — afloat, up on location,
 * and back down; `preload` is the small settling cycle she does on arrival,
 * with the hull already clear of the water.
 */
export function jackupElevation(behavior: JackupBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.72
  const t = ((clock % 1) + 1) % 1
  if (behavior === "preload") return 0.68 + Math.sin(t * Math.PI * 2) * 0.06
  return 0.04 + (1 - Math.abs(2 * t - 1)) * 0.92
}

export { JackupRig }
