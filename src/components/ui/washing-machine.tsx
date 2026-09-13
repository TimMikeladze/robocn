"use client"

/**
 * washing-machine — one drum, and one dimensionless number deciding what it is
 * doing.
 *
 * A body on the drum wall leaves it where gravity can no longer hold it there:
 * `cos α = ω²r/g`. Below a Froude number of one the load is thrown and falls on
 * a real ballistic arc; at or above it there is no release angle at all and the
 * load is pinned to the wall. Wash and spin are not two animations here — they
 * are `tumblePose` either side of one.
 *
 * The tub is hung on springs, so it answers an out-of-balance load the way a
 * rotor on a flexible mount does: quiet below its critical speed, violent at
 * it, and calm again above it. It is the only machine in the set that is worse
 * at one input than at a larger one, and driving it up through resonance by
 * hand is the point of `interactive`.
 *
 * A top-loading machine has a vertical axis, where gravity never lifts the load
 * at all: there the agitator moves it and the tumble release does not apply.
 * Said plainly here and in the docs, rather than reusing the maths where it does
 * not hold.
 *
 * Water, suds, heat and the wash itself are drawing. Nothing here models a
 * fluid, a detergent, a temperature or a fabric.
 */

import * as React from "react"

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { detent } from "@/lib/robocn/device"
import { suspensionPose, swingPose, tumbleItems, tumblePose } from "@/lib/robocn/household"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  boxCorners,
  elevationDraft,
  elevationPoint,
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
import { cn } from "@/lib/utils"

export type WashingBehavior = "cycle" | "spin" | "dry" | "static"
export type WashingLoading = "front" | "top"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 220
const NATIVE_VIEW: RobotView = "front"

const HALF = 50
const TOP = 118
const DEPTH = 26
const FOOT = 5
const FACE = 0.5

/** The drum, and what a drawing unit is worth in metres. */
const DRUM_X = 0
const DRUM_Y = 56
const DRUM_R = 23
const BEZEL_R = 30
/** A domestic drum is about a quarter of a metre in radius. */
const DRUM_METRES = 0.25
const SCALE = DRUM_R / DRUM_METRES
const ITEM_METRES = 0.035

/** Suspension: where it resonates, how far out of balance it is, how damped. */
const CRITICAL_RPM = 320
const IMBALANCE = 0.95
const DAMPING = 0.07

/** Above this the pump has emptied it — a spin never runs in water. */
const DRAIN_RPM = 300
/** The programme dial: eight positions, 30 degrees apart. */
const PROGRAMMES = 8
const DETENT_DEGREES = 30

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface WashingMachineProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled drum speed in rpm. Supplying it stops the loop. */
  rpm?: number
  onRpmChange?: (rpm: number) => void
  behavior?: WashingBehavior
  loading?: WashingLoading
  /** Items in the drum, 0–10. */
  load?: number
  /** Water in the drum, 0 to 1. Forced to nothing once the drum is spinning. */
  water?: number
  /** Door or lid opening, 0 shut to 1 at its stop. */
  door?: number
  /** Programme position on the dial, 0 to 7. */
  programme?: number
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

function WashingMachine({
  rpm,
  onRpmChange,
  behavior = "cycle",
  loading = "front",
  load = 5,
  water,
  door = 0,
  programme = 2,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.14,
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
}: WashingMachineProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = rpm !== undefined

  const items = Number.isFinite(load) ? clamp(Math.round(load), 0, 10) : 5
  const hold = controlled ? (Number.isFinite(rpm) ? clamp(rpm as number, 0, 1600) : 0) : held
  const goal = React.useCallback((clock: number) => washRpm(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 900,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const turning = clamp(motion.value, 0, 1600)
  const wet = clamp(
    water !== undefined && Number.isFinite(water) ? water : washWater(behavior, turning),
    0,
    1,
  ) * (turning > DRAIN_RPM ? 0 : 1)
  const open = Number.isFinite(door) ? clamp(door, 0, 1) : 0

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1600))
      setHeld(bounded)
      onRpmChange?.(bounded)
    },
    [onRpmChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Across the frame is the whole speed range: drag it up through resonance.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x * 1600), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })
  // Report the speed the drum is really at, to ten rpm, however it got there.
  const reported = React.useRef(-1)
  React.useEffect(() => {
    const at = Math.round(turning / 10) * 10
    if (reported.current === at) return
    reported.current = at
    onRpmChange?.(at)
  }, [turning, onRpmChange])

  const camera = robotCamera(view)
  const envelope = boxCorners(
    { x: -(HALF + 6), y: 0, z: -(DEPTH + 6) },
    { x: HALF + 6, y: TOP + (loading === "top" ? 46 : 6), z: DEPTH + 34 },
  )
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, box, bar, disc } = elevationDraft(camera, "front")

  const wash = (value: number) => (variant === "outline" || variant === "wire" ? 0 : value)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The drum, the load in it, and the tub the whole lot hangs from.
  const drum = tumblePose(turning, { radius: DRUM_METRES, itemRadius: ITEM_METRES })
  const shake = suspensionPose(turning, {
    critical: CRITICAL_RPM,
    imbalance: IMBALANCE,
    damping: DAMPING,
  })
  // The angle is the clock times the speed rather than its integral, so a
  // changed speed changes the rate from now rather than replaying history.
  const spinAngle = motion.clock * turning * 6
  const whirl = (spinAngle * Math.PI) / 180
  const offset: Vec2 = {
    x: Math.cos(whirl) * shake.amplitude,
    y: Math.sin(whirl) * shake.amplitude,
  }
  const centre: Vec2 = { x: DRUM_X + offset.x, y: DRUM_Y + offset.y }
  const vertical = loading === "top"
  const contents = vertical
    ? []
    : tumbleItems(motion.clock, turning, items, {
        radius: DRUM_METRES,
        itemRadius: ITEM_METRES,
      })

  const dial = detent(programme * DETENT_DEGREES, PROGRAMMES, DETENT_DEGREES)
  const lid = swingPose(open, { width: DEPTH * 2, maxAngle: 78 })
  const running = turning > 1

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `${vertical ? "Top" : "Front"} loading washing machine, drum at ${Math.round(turning)} rpm, ${drum.regime}, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1600 : undefined}
      aria-valuenow={interactive ? Math.round(turning) : undefined}
      aria-valuetext={interactive ? `${Math.round(turning)} rpm, ${drum.regime}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 40, 200)
        if (delta !== 0) apply(turning + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1600)
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
          d={`M 8 ${VIEW_HEIGHT - 14} H ${VIEW_WIDTH - 8}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.45}
        />
      )}

      <g data-machine data-view={view} transform={frame || undefined}>
        {showGround && (
          <path
            data-ground
            d={box(-HALF - 3, 0, HALF + 3, 0.4, DEPTH + 3)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {/* Case, feet, and the control panel across the top. */}
        <path data-case d={box(-HALF, FOOT, HALF, TOP, DEPTH)} {...shell} />
        <path d={box(-HALF, FOOT, HALF, TOP, FACE, DEPTH)} {...shell} />
        <path d={box(-HALF + 4, 0, -HALF + 12, FOOT, 5, DEPTH - 8)} {...cast} />
        <path d={box(HALF - 12, 0, HALF - 4, FOOT, 5, DEPTH - 8)} {...cast} />

        <g data-panel>
          <path d={box(-HALF + 2, TOP - 18, HALF - 2, TOP - 2, FACE, DEPTH)} {...cast} />
          <path
            data-display
            d={box(-14, TOP - 14, 14, TOP - 6, FACE, DEPTH + 0.3)}
            fill={running ? palette.accent : palette.metal}
            fillOpacity={wash(running ? 0.9 : 0.45)}
          />
          <g data-dial data-index={dial.index}>
            <path d={disc({ x: HALF - 14, y: TOP - 10 }, 6, FACE, DEPTH + 0.3)} {...machined} />
            <path
              d={bar(
                { x: HALF - 14, y: TOP - 10 },
                dialTip({ x: HALF - 14, y: TOP - 10 }, programme),
                0.8,
                FACE,
                DEPTH + 0.6,
              )}
              fill={palette.accent}
              stroke={palette.dark}
              strokeWidth={0.3}
            />
          </g>
          {/* The detergent drawer, pulled out by the programme's own dose. */}
          <path
            data-drawer
            d={box(-HALF + 6, TOP - 15, -HALF + 28, TOP - 5, 3, DEPTH + 2)}
            {...machined}
          />
        </g>

        {vertical ? (
          <g data-lid data-open={px(open)}>
            {/* Only a camera that can see down the mouth gets the inside of it:
                from the front a lidded tub is a closed box, and drawing its
                drum there would be drawing through steel. */}
            {open > 0.15 && camera.flatten > 0.3 && (
              <g data-mouth transform={camera.plane(TOP - 4) || undefined}>
                <circle
                  data-drum
                  data-regime={drum.regime}
                  cy={8}
                  r={HALF - 14}
                  fill={palette.dark}
                  fillOpacity={wash(0.5)}
                  stroke={palette.dark}
                  strokeWidth={0.6}
                />
                <circle cy={8} r={HALF - 18} fill="none" stroke={palette.metal} strokeWidth={0.8} opacity={0.6} />
                <circle data-agitator cy={8} r={7} {...machined} />
                <path
                  d={`M 0 1 L 0 ${9 - (HALF - 19)} M 6 12 L ${HALF - 19} 20`}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={1.4}
                  opacity={0.8}
                />
              </g>
            )}
            <path d={lidPath(camera, lid)} {...shell} />
          </g>
        ) : (
          <g data-tub data-offset={px(shake.amplitude)}>
            {/* Springs to the case corners and dampers to the base: the stroke
                you can see is the displacement the suspension is answering. */}
            <path
              data-spring="left"
              d={bar({ x: -HALF + 8, y: TOP - 22 }, { x: centre.x - 16, y: centre.y + 16 }, 1.4, 3)}
              {...machined}
            />
            <path
              data-spring="right"
              d={bar({ x: HALF - 8, y: TOP - 22 }, { x: centre.x + 16, y: centre.y + 16 }, 1.4, 3)}
              {...machined}
            />
            <path
              data-damper="left"
              d={bar({ x: -HALF + 14, y: FOOT + 4 }, { x: centre.x - 14, y: centre.y - 16 }, 1.8, 3)}
              {...cast}
            />
            <path
              data-damper="right"
              d={bar({ x: HALF - 14, y: FOOT + 4 }, { x: centre.x + 14, y: centre.y - 16 }, 1.8, 3)}
              {...cast}
            />

            <path d={disc(centre, BEZEL_R, DEPTH - 4)} {...machined} />
            <path
              data-drum
              data-regime={drum.regime}
              d={disc(centre, DRUM_R + 1, FACE, DEPTH - 2)}
              fill={palette.dark}
              fillOpacity={wash(0.62)}
              stroke={palette.dark}
              strokeWidth={0.6}
            />

            {/* Water sits in the bottom of the drum until the pump runs. */}
            {wet > 0.02 && (
              <path
                data-water
                d={waterPath(to, centre, wet)}
                fill={palette.accent}
                fillOpacity={wash(0.55)}
              />
            )}

            {/* Three lifters on the wall, and the load they are throwing. */}
            {[0, 120, 240].map((at) => {
              const angle = ((at + spinAngle) * Math.PI) / 180
              const foot: Vec2 = {
                x: centre.x + Math.sin(angle) * DRUM_R,
                y: centre.y + Math.cos(angle) * DRUM_R,
              }
              const tip: Vec2 = {
                x: centre.x + Math.sin(angle) * (DRUM_R - 5),
                y: centre.y + Math.cos(angle) * (DRUM_R - 5),
              }
              return <path key={at} data-lifter d={bar(foot, tip, 1.6, DEPTH - 6)} {...machined} />
            })}
            {contents.map((item) => (
              <path
                key={item.index}
                data-item={item.index}
                data-airborne={item.airborne ? "true" : "false"}
                d={disc(
                  {
                    x: centre.x + item.position.x * SCALE,
                    y: centre.y + item.position.y * SCALE,
                  },
                  ITEM_METRES * SCALE,
                  2,
                  DEPTH - 8,
                )}
                fill={palette.shell}
                fillOpacity={wash(0.95)}
                stroke={palette.dark}
                strokeWidth={0.4}
              />
            ))}

            {/* The glass door: a round leaf hinged down one side, so it keeps
                its diameter and foreshortens into an ellipse as it opens. */}
            <path
              data-door
              data-open={px(open)}
              d={portholePath(camera, centre, swingPose(open, { width: (DRUM_R + 3) * 2, maxAngle: 105, side: -1 }))}
              fill={palette.metal}
              fillOpacity={wash(0.16)}
              stroke={palette.metal}
              strokeWidth={1.6}
            />
            <path
              d={bar(
                { x: centre.x + BEZEL_R - 2, y: centre.y + 4 },
                { x: centre.x + BEZEL_R + 2, y: centre.y + 4 },
                2.4,
                2,
              )}
              {...cast}
            />
          </g>
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 0, y: TOP + 4 }).x)}
            y={px(to({ x: 0, y: TOP + 4 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${Math.round(turning)} rpm · Fr ${drum.froude.toFixed(2)}`}
          </text>
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

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

/** Where the dial's index mark points for a programme position. */
function dialTip(centre: Vec2, programme: number): Vec2 {
  const index = Number.isFinite(programme) ? Math.round(programme) : 0
  const angle = ((index * DETENT_DEGREES - 90) * Math.PI) / 180
  return { x: centre.x + Math.cos(angle) * 4.6, y: centre.y + Math.sin(angle) * 4.6 }
}

/** The water standing in the bottom of the drum: a chord, filled. */
function waterPath(
  to: ReturnType<typeof elevationDraft>["point"],
  centre: Vec2,
  level: number,
): string {
  const depth = clamp(level, 0, 1) * DRUM_R * 1.2
  const surface = centre.y - DRUM_R + depth
  const half = Math.sqrt(Math.max(0, DRUM_R * DRUM_R - (surface - centre.y) ** 2))
  const steps = 14
  const points = [
    { x: centre.x - half, y: surface },
    { x: centre.x + half, y: surface },
    ...Array.from({ length: steps }, (_, index) => {
      const angle = Math.acos(clamp((surface - centre.y) / DRUM_R, -1, 1))
      const t = angle + (index / (steps - 1)) * (2 * Math.PI - 2 * angle)
      return { x: centre.x + Math.sin(t) * DRUM_R, y: centre.y + Math.cos(t) * DRUM_R }
    }),
  ]
  return `${points
    .map((point, index) => {
      const screen = to(point, DEPTH - 4)
      return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
    })
    .join(" ")} Z`
}

/**
 * The porthole door: a disc hinged down one side. Its rim is sampled in the
 * leaf's own plane and projected, so the door keeps its diameter at every angle
 * and comes out as the ellipse a turned disc really is.
 */
function portholePath(
  camera: ReturnType<typeof robotCamera>,
  centre: Vec2,
  pose: ReturnType<typeof swingPose>,
): string {
  const radius = DRUM_R + 3
  const hinge = centre.x + radius
  const width = radius * 2
  const ux = pose.edge.x / width
  const ud = pose.edge.depth / width
  const steps = 28
  const points = Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const along = radius + Math.cos(angle) * radius
    const rise = Math.sin(angle) * radius
    const screen = camera.project(
      ...(() => {
        const world = elevationPoint(
          { x: hinge + ux * along, y: centre.y + rise },
          DEPTH + 1 + ud * along,
          "front",
        )
        return [world.x, world.y, world.z] as const
      })(),
    )
    return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
  })
  return `${points.join(" ")} Z`
}

/** The lid: a leaf hinged along the back edge of the top, opening upward. */
function lidPath(
  camera: ReturnType<typeof robotCamera>,
  pose: ReturnType<typeof swingPose>,
): string {
  // The leaf's own width runs out of the machine in depth, and its swing lifts
  // the free edge: the same solve as a door, about a horizontal hinge.
  const corners: Vec3[] = []
  for (const x of [-HALF + 2, HALF - 2]) {
    for (const [depth, y] of [
      [-DEPTH, TOP],
      [-DEPTH + pose.edge.x, TOP + pose.edge.depth],
    ] as const) {
      corners.push(elevationPoint({ x, y }, depth, "front"))
      corners.push(elevationPoint({ x, y: y + 2 }, depth, "front"))
    }
  }
  return slabPath(corners, camera)
}

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Drum speed at `clock`. `cycle` is a whole programme — a tumbling wash, a
 * pause, then the spin ramping up through the suspension's critical speed and
 * coasting down through it again — and `spin` is that ramp on its own.
 */
export function washRpm(behavior: WashingBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 48
  const t = ((clock % 1) + 1) % 1
  if (behavior === "dry") return 52
  if (behavior === "spin") {
    if (t < 0.45) return (t / 0.45) * 1400
    if (t < 0.75) return 1400
    return 1400 * (1 - (t - 0.75) / 0.25)
  }
  if (t < 0.34) return 46
  if (t < 0.4) return 0
  if (t < 0.46) return 52
  if (t < 0.54) return 0
  if (t < 0.78) return ((t - 0.54) / 0.24) * 1350
  if (t < 0.9) return 1350
  return 1350 * (1 - (t - 0.9) / 0.1)
}

/** How much water is in the drum for a behaviour, before the pump runs. */
export function washWater(behavior: WashingBehavior, rpm: number): number {
  if (!Number.isFinite(rpm) || rpm > DRAIN_RPM) return 0
  if (behavior === "dry" || behavior === "spin") return 0
  return 0.34
}

export { WashingMachine }
