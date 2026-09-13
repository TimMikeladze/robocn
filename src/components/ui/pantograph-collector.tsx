"use client"

/**
 * pantograph-collector — a single-arm roof current collector, and the closed
 * loop that keeps its head level.
 *
 * Height and reach are not independent here. The head rides the workspace of a
 * two-link chain, so asking for height spends reach: the knee folds in and the
 * pan travels back over its own base as it goes up, and past full extension it
 * simply cannot go higher. That is the mechanism, and it is why a pantograph
 * has a working range rather than a stroke.
 *
 * The head's attitude is a second loop, not a second animation. A control rod
 * runs from the lower arm to a lever on the head, so the head's angle is
 * whatever assembles that loop at this height — flat where the levelling was
 * set, and visibly tipping at the ends of the travel. Nothing here pins it to
 * horizontal.
 *
 * Above it, the contact wire is strung with the stagger that makes a carbon
 * strip wear across its width instead of grooving in one place, and the
 * contact point is where the wire actually crosses the strip.
 *
 * Illustrated and not solved: the stagger pattern, and the wire itself, which
 * is a straight run rather than a catenary. No uplift, no contact force, no
 * arc, and nothing travels.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  circleFootprint,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { pantographPose, wireStagger } from "@/lib/robocn/rail"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "profile"

/** The collector in its own profile: roof at y = 0, the vehicle's nose at +x. */
const LOWER_ARM = 54
const UPPER_ARM = 46
const BASE_HEIGHT = 9
const HALF_PAN = 34
const ROOF_HALF_WIDTH = 40
const ROOF_HALF_LENGTH = 62
/** The wire, and the span between the masts that stagger it. */
const WIRE_HEIGHT = 112
const WIRE_RUN = 74
const STAGGER = 16
const SPAN = 70

const GEOMETRY = {
  lowerArm: LOWER_ARM,
  upperArm: UPPER_ARM,
  baseHeight: BASE_HEIGHT,
  rod: 40,
  lever: 11,
  rodAnchor: 0.45,
  designHeight: WIRE_HEIGHT - 6,
}
const STOWED = BASE_HEIGHT + Math.abs(LOWER_ARM - UPPER_ARM) + 4
const FULL = WIRE_HEIGHT - 6
/** Units of working height per second while it eases back into a behaviour. */
const LIFT_RATE = 70

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type PantographBehavior = "raise" | "run" | "stow" | "static"

export interface PantographCollectorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Working height, 0 stowed to 1 at the wire. Supplying it stops the loop. */
  height?: number
  onHeightChange?: (height: number) => void
  /** What the collector does when `height` is not supplied. */
  behavior?: PantographBehavior
  /** How far along the run the collector is: what walks the contact across the strip. Omit and the clock runs it. */
  along?: number
  view?: RobotView
  /** The contact wire, its masts, and the stagger it is strung with. */
  showWire?: boolean
  /** The roof it is mounted on. */
  showRoof?: boolean
  /** Light the strip where it is on the wire. Omit and it lights on contact. */
  active?: boolean
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function PantographCollector({
  height,
  onHeightChange,
  behavior = "raise",
  along,
  view = NATIVE_VIEW,
  showWire = true,
  showRoof = true,
  active,
  interactive = false,
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
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
}: PantographCollectorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = height !== undefined

  const hold = controlled
    ? Number.isFinite(height) ? clamp(height as number, 0, 1) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => pantographLift(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: LIFT_RATE / (FULL - STOWED),
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const lift = clamp(motion.value, 0, 1)
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const run = along === undefined ? clock * SPAN : Number.isFinite(along) ? along : 0

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onHeightChange?.(bounded)
    },
    [onHeightChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pose = pantographPose(STOWED + (FULL - STOWED) * lift, GEOMETRY)
  // The wire zig-zags across the track, so the contact point walks across the
  // strip as the vehicle runs — which is the whole reason for the stagger.
  const stagger = wireStagger(run, STAGGER, SPAN)
  const touching = pose.workingHeight >= WIRE_HEIGHT - 10
  const live = active ?? touching

  const camera = robotCamera(view)
  const fit = fitTransform(
    boxCorners(
      { x: -(HALF_PAN + 16), y: -8, z: -WIRE_RUN },
      { x: HALF_PAN + 16, y: WIRE_HEIGHT + 16, z: WIRE_RUN },
    ),
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
  )

  /**
   * A drawing point of the profile elevation, lifted into the world. Drawing
   * x runs along the vehicle (toward the nose, +x here) and `depth` is out of
   * the plane toward starboard, so one drawing serves all four cameras.
   */
  const place = (point: Vec2, depth: number): Vec3 => ({
    x: depth,
    y: point.y,
    z: -point.x,
  })
  const screen = (point: Vec2, depth: number) => {
    const corner = place(point, depth)
    return camera.project(corner.x, corner.y, corner.z)
  }
  const line = (points: [Vec2, number][]) =>
    points
      .map(([point, depth], index) => {
        const at = screen(point, depth)
        return `${index ? "L" : "M"} ${px(at.x)} ${px(at.y)}`
      })
      .join(" ")
  /** A member in the drawing plane, `halfWidth` across it and `halfDepth` out. */
  const bar = (a: Vec2, b: Vec2, halfWidth: number, halfDepth: number, offset = 0) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    return slabPath(
      [
        { x: a.x - uy * halfWidth - ux * halfWidth, y: a.y + ux * halfWidth - uy * halfWidth },
        { x: a.x + uy * halfWidth - ux * halfWidth, y: a.y - ux * halfWidth - uy * halfWidth },
        { x: b.x + uy * halfWidth + ux * halfWidth, y: b.y - ux * halfWidth + uy * halfWidth },
        { x: b.x - uy * halfWidth + ux * halfWidth, y: b.y + ux * halfWidth + uy * halfWidth },
      ].flatMap((corner) => [
        place(corner, offset + halfDepth),
        place(corner, offset - halfDepth),
      ]),
      camera,
    )
  }
  /** A box standing in the drawing plane. */
  const box = (x0: number, y0: number, x1: number, y1: number, halfDepth: number, offset = 0) =>
    slabPath(
      [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ].flatMap((corner) => [
        place(corner, offset + halfDepth),
        place(corner, offset - halfDepth),
      ]),
      camera,
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** The strip, tilted by the attitude the levelling loop produced. */
  const tilt = clamp(pose.attitude, -30, 30)
  const cos = Math.cos((tilt * Math.PI) / 180)
  const sin = Math.sin((tilt * Math.PI) / 180)
  const onStrip = (offset: number, rise: number): Vec2 => ({
    x: pose.head.x + offset * cos - rise * sin,
    y: pose.head.y + offset * sin + rise * cos,
  })
  const readout = Math.round(lift * 100)

  /** The masts within sight, in the vehicle's own frame as it runs past them. */
  const nearest = Math.round(run / SPAN)
  const masts = [-2, -1, 0, 1, 2]
    .map((step) => {
      const world = (nearest + step) * SPAN
      return {
        world,
        x: world - run,
        side: wireStagger(world, 1, SPAN) < 0 ? -1 : 1,
      }
    })
    .filter((mast) => Math.abs(mast.x) <= WIRE_RUN + 3)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Pantograph collector, ${readout} percent of working height, ${
          touching ? "on the wire" : "clear of the wire"
        }, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(lift) : undefined}
      aria-valuetext={interactive ? `${readout} percent raised` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(lift + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else if (event.key === "Escape") setHeld(null)
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
      <g
        data-view={view}
        data-height={px(lift)}
        data-working-height={px(pose.workingHeight)}
        data-reachable={pose.reachable ? "true" : "false"}
        transform={fit || undefined}
      >
        {variant === "blueprint" && (
          <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.6}>
            {/* The workspace the head is confined to: it cannot leave this. */}
            <path
              d={line([
                [{ x: 0, y: BASE_HEIGHT + Math.abs(LOWER_ARM - UPPER_ARM) }, 0],
                [{ x: 0, y: BASE_HEIGHT + LOWER_ARM + UPPER_ARM }, 0],
              ])}
              strokeDasharray="3 4"
            />
          </g>
        )}

        {showRoof && (
          <g data-roof>
            <path
              d={box(-ROOF_HALF_LENGTH, -7, ROOF_HALF_LENGTH, 0, ROOF_HALF_WIDTH)}
              {...shell}
            />
            {/* Insulators: the collector is live, so it stands off the roof. */}
            {[-1, 1].map((side) => (
              <path
                key={side}
                data-insulator={side < 0 ? "aft" : "fore"}
                d={box(side * 17 - 5, 0, side * 17 + 5, BASE_HEIGHT - 2, 9, 0)}
                {...cast}
              />
            ))}
            <path
              data-base
              d={box(-24, BASE_HEIGHT - 2, 24, BASE_HEIGHT + 2, 13)}
              {...machined}
            />
          </g>
        )}

        {showWire && (
          <g data-wire-run>
            {/* The masts stand still and the vehicle runs past them, so which
                side the next one is on alternates — and the wire is registered
                to it, which is where the stagger comes from. */}
            {masts.map((mast) => (
              <g key={mast.world} data-mast={px(mast.world)} data-side={mast.side < 0 ? "port" : "starboard"}>
                <path
                  d={box(
                    mast.x - 2.6,
                    0,
                    mast.x + 2.6,
                    WIRE_HEIGHT + 10,
                    2.6,
                    mast.side * (HALF_PAN + 13),
                  )}
                  {...machined}
                />
                <path
                  data-registration
                  d={line([
                    [{ x: mast.x, y: WIRE_HEIGHT + 8 }, mast.side * (HALF_PAN + 13)],
                    [{ x: mast.x, y: WIRE_HEIGHT }, mast.side * STAGGER],
                  ])}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </g>
            ))}
            <path
              data-wire
              d={line(
                Array.from({ length: 25 }, (_, index) => {
                  const x = -WIRE_RUN + (index * (WIRE_RUN * 2)) / 24
                  return [
                    { x, y: WIRE_HEIGHT },
                    wireStagger(run + x, STAGGER, SPAN),
                  ] as [Vec2, number]
                }),
              )}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.6}
            />
          </g>
        )}

        <g data-arm>
          <path
            data-lower-arm
            d={bar(pose.base, pose.knee, 3.4, 3.4)}
            {...machined}
          />
          <path data-upper-arm d={bar(pose.knee, pose.head, 2.4, 2.4)} {...machined} />
          {/* The control rod: the loop that decides the head's attitude. */}
          <path
            data-rod
            d={bar(pose.rodAnchor, pose.leverEnd, 1.1, 1.1, 5)}
            {...cast}
          />
          <path
            data-lever
            d={bar(pose.head, pose.leverEnd, 1.4, 1.4, 5)}
            {...cast}
          />
          {[
            { name: "base", at: pose.base, radius: 4.4 },
            { name: "knee", at: pose.knee, radius: 4 },
            { name: "head-pivot", at: pose.head, radius: 3.2 },
          ].map((joint) => (
            <path
              key={joint.name}
              data-joint={joint.name}
              d={slabPath(
                circleFootprint(0, 0, joint.radius, 12).flatMap((point) => [
                  place({ x: joint.at.x + point.x, y: joint.at.y + point.y }, 4.4),
                  place({ x: joint.at.x + point.x, y: joint.at.y + point.y }, -4.4),
                ]),
                camera,
              )}
              {...cast}
            />
          ))}
        </g>

        <g data-pan data-attitude={px(pose.attitude)}>
          {/* The head: two carbon strips on a bow, with the horns turned down
              so a wire running off the end is led back on rather than caught. */}
          {[-5.5, 5.5].map((offset) => (
            <path
              key={offset}
              data-strip={offset < 0 ? "aft" : "fore"}
              d={slabPath(
                [
                  onStrip(offset - 2, 3),
                  onStrip(offset + 2, 3),
                  onStrip(offset + 2, 6),
                  onStrip(offset - 2, 6),
                ].flatMap((corner) => [place(corner, HALF_PAN), place(corner, -HALF_PAN)]),
                camera,
              )}
              fill={live ? palette.accent : palette.metal}
              fillOpacity={variant === "solid" ? 1 : 0.3}
              stroke={palette.dark}
              strokeWidth={0.5}
            />
          ))}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-horn={side < 0 ? "port" : "starboard"}
              d={line([
                [onStrip(-7.5, 4.5), side * HALF_PAN],
                [onStrip(-4, 0), side * (HALF_PAN + 7)],
                [onStrip(4, 0), side * (HALF_PAN + 7)],
                [onStrip(7.5, 4.5), side * HALF_PAN],
              ])}
              fill="none"
              stroke={palette.metal}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <path
            data-bow
            d={bar(onStrip(-7, 1.5), onStrip(7, 1.5), 1.6, HALF_PAN * 0.42)}
            {...machined}
          />
        </g>

        {showWire && touching && (
          <circle
            data-contact
            cx={px(screen(onStrip(0, 6), stagger).x)}
            cy={px(screen(onStrip(0, 6), stagger).y)}
            r={2.6}
            fill={palette.glow}
            opacity={0.95}
          />
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 5}
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

/** Where the collector is at `clock`, 0 stowed to 1 at full working height. */
export function pantographLift(behavior: PantographBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return behavior === "stow" ? 0 : 1
  const cycle = ((clock % 1) + 1) % 1
  if (behavior === "run") {
    // Up and holding: a collector at work only breathes against the wire.
    return 0.94 + Math.sin(clock * Math.PI * 2 * 3) * 0.03
  }
  if (behavior === "stow") {
    // Down, bar the one moment it is put up and brought straight back.
    if (cycle < 0.72) return 0
    if (cycle < 0.82) return (cycle - 0.72) / 0.1
    if (cycle < 0.9) return 1
    return 1 - (cycle - 0.9) / 0.1
  }
  // raise: up, work under the wire, and back down.
  if (cycle < 0.1) return 0
  if (cycle < 0.32) return (cycle - 0.1) / 0.22
  if (cycle < 0.72) return 1
  if (cycle < 0.92) return 1 - (cycle - 0.72) / 0.2
  return 0
}

export { PantographCollector }
