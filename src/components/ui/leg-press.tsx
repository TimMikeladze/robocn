"use client"

/**
 * leg-press — a sled on inclined rails, where the rail angle *is* the
 * resistance.
 *
 * Only the component of the load that lies along the rails resists, so what the
 * sled actually weighs is `W · sin(θ)`: lay the frame at 30° and it hands back
 * half the plates, stand it at 45° and 0.71 of them, and at 0° the plates ride
 * for nothing. This is the one machine in the family where changing the
 * **frame** changes the weight — which is why a number off one leg press does
 * not compare with a number off another.
 *
 * `railAngle` is an input because it is a thing somebody bolted together. The
 * load is not: it comes back out of `solveSled`, and it is in the accessible
 * label rather than in a prop.
 *
 * The mechanism is solved in `src/lib/robocn/gym.ts` — pure, no React, tested on
 * its own. The drawing only reads the pose it produces.
 *
 * Illustrated: frictionless. No rail friction, no roller drag, no bearing loss,
 * and no dynamics — this is what the sled weighs standing still on the rails.
 *
 * Drawn once in the profile elevation and pushed through `robotCamera`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSled, type SledGeometry } from "@/lib/robocn/gym"
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

/** What the machine does with nobody driving it. Always includes `static`. */
export type LegPressBehavior = "press" | "partials" | "hold" | "static"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "profile"


/** Where the rails start, and how much rail there is past the travel. */
const RAIL_FOOT: Vec2 = { x: -40, y: 14 }
const TRAVEL = 96
const RAIL_OVERRUN = 26
const BASE_Y = 12
/** Half the track between the two rails, out of the drawing plane. */
const RAIL_TRACK = 19
/** How long the whole weight is drawn. The along-rail one is `sin(angle)` of it. */
const VECTOR = 42

/**
 * The box the machine stands in, for one frame.
 *
 * It depends on the **rail angle** and on nothing else: the angle is a thing
 * somebody bolted together, so it may change the framing, while the travel is
 * the machine working and may not. Laying the frame down makes it long and low
 * and standing it up makes it tall, and either way the drawing fills its own
 * viewBox instead of floating in a box sized for the steepest frame it could be.
 */
function envelopeFor(railAngle: number) {
  const radians = toRadians(railAngle)
  const top: Vec2 = {
    x: RAIL_FOOT.x + Math.cos(radians) * (TRAVEL + RAIL_OVERRUN),
    y: RAIL_FOOT.y + Math.sin(radians) * (TRAVEL + RAIL_OVERRUN),
  }
  // Drawing x runs along -z, so the box is written the way the camera reads it.
  return boxCorners(
    { x: -34, y: 0, z: -Math.max(62, top.x + 22) },
    { x: 34, y: Math.max(76, top.y + 26), z: 100 },
  )
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * Stroke at `clock`, 0 racked at the bottom to 1 fully extended. Every
 * behaviour is a pure function of the clock, exported so motion can be tested
 * by sampling it rather than by faking animation frames.
 */
export function legPressTravel(behavior: LegPressBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.45
  const t = ((clock % 1) + 1) % 1
  switch (behavior) {
    // Short reps at the top of the range, where the sled is easiest to hold.
    case "partials":
      return 0.62 + 0.3 * (1 - Math.cos(t * Math.PI * 8)) * 0.5
    case "hold":
      return clamp(0.72 + Math.sin(t * Math.PI * 12) * 0.02, 0, 1)
    default:
      return (1 - Math.cos(t * Math.PI * 2)) / 2
  }
}

export interface LegPressProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Controlled travel along the rails, 0 racked at the bottom to 1 fully
   * extended. Supplying it stops the loop. Named for the rails rather than for
   * the rep, because `stroke` is an SVG attribute this component passes through.
   */
  travel?: number
  onTravelChange?: (stroke: number) => void
  behavior?: LegPressBehavior
  /** The rails' inclination from horizontal, in degrees. This is the resistance. */
  railAngle?: number
  /** Discs on the loading horns, per side. */
  plates?: number
  /** What one disc weighs, for the readout. */
  plateWeight?: number
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
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

function LegPress({
  travel,
  onTravelChange,
  behavior = "press",
  railAngle = 38,
  plates = 3,
  plateWeight = 20,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.32,
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
}: LegPressProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = travel !== undefined

  // Controlled wins and pins the value; the clock keeps running underneath, so
  // release reads as the sled coming back down rather than a jump.
  const hold = controlled ? (Number.isFinite(travel) ? clamp(travel as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => legPressTravel(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.4,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const pushed = clamp(motion.value, 0, 1)

  const discs = Math.max(0, Math.round(Number.isFinite(plates) ? plates : 3))
  const perDisc = Math.abs(Number.isFinite(plateWeight) ? plateWeight : 20)
  const sled: SledGeometry = React.useMemo(
    () => ({
      railAngle: Number.isFinite(railAngle) ? railAngle : 38,
      travel: TRAVEL,
      foot: RAIL_FOOT,
      // Two horns, so what is on the sled is twice what is on one of them.
      weight: discs * perDisc * 2,
    }),
    [railAngle, discs, perDisc],
  )
  const pose = solveSled(pushed, sled)

  const camera = robotCamera(view)
  const frame = fitTransform(envelopeFor(pose.railAngle), camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onTravelChange?.(bounded)
    },
    [onTravelChange],
  )
  const dragging = useRobotDrag(svgRef, {
    // `onDrag` must stay in a `useCallback` or the listeners rebind every render.
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /* --------------------------------------------------------- the rail line */

  const radians = toRadians(pose.railAngle)
  const along = (distance: number, offset = 0): Vec2 => ({
    x: RAIL_FOOT.x + Math.cos(radians) * distance - Math.sin(radians) * offset,
    y: RAIL_FOOT.y + Math.sin(radians) * distance + Math.cos(radians) * offset,
  })
  const railTop = along(TRAVEL + RAIL_OVERRUN)
  const carriage = pose.carriage
  // The footplate stands across the rails, so it turns with the frame.
  const plateFoot = along(pose.along, 13)
  const plateHead = along(pose.along, -21)
  const horn = along(pose.along - 12, -4)
  // The two load vectors hang from a point clear under the rails, where the
  // sled is not sitting on top of them.
  const hang = along(pose.along, -26)

  const percent = Math.round(pushed * 100)
  const loaded = Math.round(pose.load * 10) / 10
  const share = Math.round(pose.fraction * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Leg press, rails at ${px(pose.railAngle)} degrees, ${sled.weight} on the sled and ${loaded} of it along the rails — ${share} percent, travel ${percent} percent, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pushed) : undefined}
      aria-valuetext={interactive ? `${percent} percent, sled load ${loaded}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(pushed + delta)
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
          d={`M 10 ${VIEW_HEIGHT - 22} H ${VIEW_WIDTH - 10}`}
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
            <path
              data-ground
              d={solid([{ x: -98, y: 0 }, { x: 60, y: 0 }], 34)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -98, y: 0 }, { x: 60, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-frame>
          <path d={box(-96, 0, 56, BASE_Y, 30)} {...cast} />
          {/* The seat the person is pushing away from. */}
          <path d={box(-92, 26, -52, 35, 17)} {...shell} />
          <path d={bar({ x: -88, y: 30 }, { x: -94, y: 62 }, 4.4, 16)} {...shell} />
          <path d={bar({ x: -72, y: BASE_Y }, { x: -72, y: 26 }, 4, 6)} {...machined} />
          {/* A post under the top of the rails, so the frame carries the sled. */}
          <path
            d={bar({ x: railTop.x - 4, y: BASE_Y }, { x: railTop.x - 4, y: railTop.y }, 4.5, 6)}
            {...shell}
          />
          <path d={bar(RAIL_FOOT, { x: RAIL_FOOT.x, y: BASE_Y }, 5, 7)} {...shell} />
        </g>

        {/* The rails. Their angle is the only thing setting the resistance. */}
        <g data-rails data-angle={px(pose.railAngle)}>
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={bar(RAIL_FOOT, railTop, 2.6, 2.6, side * RAIL_TRACK)}
              {...machined}
            />
          ))}
        </g>

        {/* The sled: carriage, footplate across the rails, and the discs. */}
        <g data-sled data-load={px(pose.load)} data-along={px(pose.along)}>
          <path d={bar(plateFoot, plateHead, 4.6, 16)} {...shell} />
          <path d={bar(along(pose.along - 7, 0), along(pose.along + 7, 0), 7, 17)} {...cast} />
          {[-1, 1].map((side) => (
            <path
              key={side}
              d={bar(
                along(pose.along - 4, 0),
                along(pose.along - 26, 0),
                2.4,
                2.4,
                side * (RAIL_TRACK + 7),
              )}
              {...machined}
            />
          ))}
          {[-1, 1].map((side) =>
            Array.from({ length: discs }, (_, index) => (
              <g key={`${side}:${index}`} data-disc>
                <path
                  d={disc(
                    along(pose.along - 11 - index * 6.5, -4),
                    12 - index * 0.8,
                    2.6,
                    side * (RAIL_TRACK + 8),
                  )}
                  {...(index % 2 === 0 ? shell : machined)}
                />
                <path
                  d={disc(
                    along(pose.along - 11 - index * 6.5, -4),
                    3.4,
                    2.9,
                    side * (RAIL_TRACK + 8),
                  )}
                  {...cast}
                />
              </g>
            )),
          )}
          <path d={disc(horn, 2.6, 2.6, RAIL_TRACK + 8)} fill={palette.accent} stroke="none" />
        </g>

        {/*
          The load along the rails, drawn: the whole weight straight down from
          the carriage, and the part of it the rails actually pass on.
        */}
        <g data-load-lines opacity={variant === "wire" ? 0.6 : 0.85}>
          {/* The whole weight, straight down: the number on the plates. */}
          <path
            d={line([hang, { x: hang.x, y: hang.y - VECTOR }])}
            fill="none"
            stroke={palette.foreground}
            strokeWidth={1}
            strokeDasharray="2.5 2.5"
            opacity={0.55}
          />
          {/* The part of it the rails pass on: `sin(angle)` of the same line. */}
          <path
            data-along-rail
            d={line([hang, along(pose.along - VECTOR * pose.fraction, -26)])}
            fill="none"
            stroke={palette.accent}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path d={disc(hang, 1.8, 1.8)} fill={palette.accent} stroke="none" />
        </g>

        {variant === "blueprint" && (
          <text
            x={px(to({ x: -10, y: 122 }).x)}
            y={px(to({ x: -10, y: 122 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={7}
            fill={palette.foreground}
          >
            {`${px(pose.railAngle)}° · ${share}%`}
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

export { LegPress }
