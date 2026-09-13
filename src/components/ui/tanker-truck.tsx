"use client"

/**
 * tanker-truck — two bodies on one kingpin.
 *
 * The tractor and the trailer are separate rigid bodies, and `hitch` turns the
 * trailer about the kingpin's *vertical* axis — a real yaw in world space, not
 * a rotation of the drawing. So the barrel foreshortens in side elevation as it
 * jackknifes, swings properly in plan, and both cameras are looking at the same
 * truck.
 *
 * Compartments empty from the rear, which is the order a road tanker actually
 * discharges in, and each one's contents are read off the cabinet gauges rather
 * than drawn through the shell of an opaque barrel.
 *
 * No suspension, mass, load transfer, steering geometry or fluid is computed.
 */

import * as React from "react"

import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
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
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type TankerTruckBehavior = "haul" | "discharge" | "static"

const VIEW_WIDTH = 310
const VIEW_HEIGHT = 160
const NATIVE_VIEW: RobotView = "profile"

const WHEEL = 15
const DECK = 32
const KINGPIN = 122
const BARREL_FRONT = 128
const BARREL_BACK = 282
const BARREL_Y = 64
const BARREL_R = 26
const HALF_TRACK = 22

const ENVELOPE = boxCorners({ x: -48, y: 0, z: -300 }, { x: 48, y: 112, z: 0 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface TankerTruckProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled cargo, 0 empty to 1 full. Supplying it stops the loop. */
  level?: number
  onLevelChange?: (level: number) => void
  behavior?: TankerTruckBehavior
  /** Bulkheaded compartments, which empty from the rear. */
  compartments?: number
  /** Trailer yaw about the kingpin, in degrees. */
  hitch?: number
  /** The discharge cabinet, its hose reel, and the compartment gauges. */
  showCabinet?: boolean
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

function TankerTruck({
  level,
  onLevelChange,
  behavior = "haul",
  compartments = 4,
  hitch = 0,
  showCabinet = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.24,
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
}: TankerTruckProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = level !== undefined
  const holds = Number.isFinite(compartments) ? clamp(Math.round(compartments), 2, 6) : 4
  const yaw = Number.isFinite(hitch) ? clamp(hitch, -60, 60) : 0

  const hold = controlled ? (Number.isFinite(level) ? clamp(level as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => tankerTruckLevel(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 0.5,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const full = clamp(motion.value, 0, 1)
  // Rolling only while she is hauling, and only off the clock.
  const roll = behavior === "haul" && !controlled ? motion.clock * 360 : 0

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, path: line, solid, box, bar, disc } = elevationDraft(camera, "profile")

  // The trailer, yawed about the kingpin's vertical axis. A profile drawing
  // point plus its depth becomes a world point, turned in the horizontal plane.
  const turn = toRadians(yaw)
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const swung = (point: Vec2, depth: number): Vec3 => {
    const forward = point.x - KINGPIN
    return {
      x: depth * cos - forward * sin,
      y: point.y,
      z: -KINGPIN - (depth * sin + forward * cos),
    }
  }
  const ySolid = (outline: Vec2[], halfDepth: number, offset = 0) =>
    slabPath(
      outline.flatMap((point) => [swung(point, offset + halfDepth), swung(point, offset - halfDepth)]),
      camera,
    )
  const yBox = (x0: number, y0: number, x1: number, y1: number, halfDepth: number, offset = 0) =>
    ySolid([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], halfDepth, offset)
  const yDisc = (centre: Vec2, radius: number, halfDepth: number, offset = 0) =>
    ySolid(
      Array.from({ length: 20 }, (_, index) => {
        const angle = (index / 20) * Math.PI * 2
        return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius }
      }),
      halfDepth,
      offset,
    )
  const yLine = (points: Vec2[], depth = 0) =>
    points
      .map((point, index) => {
        const world = swung(point, depth)
        const screen = camera.project(world.x, world.y, world.z)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onLevelChange?.(bounded)
    },
    [onLevelChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** The barrel in side elevation: a long capsule with dished ends. */
  const barrel: Vec2[] = [
    { x: BARREL_FRONT + 6, y: BARREL_Y + BARREL_R },
    { x: BARREL_BACK - 6, y: BARREL_Y + BARREL_R },
    { x: BARREL_BACK, y: BARREL_Y + BARREL_R - 8 },
    { x: BARREL_BACK, y: BARREL_Y - BARREL_R + 8 },
    { x: BARREL_BACK - 6, y: BARREL_Y - BARREL_R },
    { x: BARREL_FRONT + 6, y: BARREL_Y - BARREL_R },
    { x: BARREL_FRONT, y: BARREL_Y - BARREL_R + 8 },
    { x: BARREL_FRONT, y: BARREL_Y + BARREL_R - 8 },
  ]
  /** Compartments discharge from the rear, so the last one empties first. */
  const charge = (index: number) =>
    clamp(full * holds - (holds - 1 - index), 0, 1)
  const bulkheads = Array.from({ length: holds - 1 }, (_, index) =>
    lerp(BARREL_FRONT, BARREL_BACK, (index + 1) / holds),
  )
  const domes = Array.from({ length: holds }, (_, index) =>
    lerp(BARREL_FRONT, BARREL_BACK, (index + 0.5) / holds),
  )
  const wheels: Array<[number, boolean]> = [
    [44, true],
    [86, false],
    [108, false],
    [206, false],
    [236, false],
  ]
  const percent = Math.round(full * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Road tanker, ${holds} compartments ${percent} percent full, hitch at ${px(yaw)} degrees, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(full) : undefined}
      aria-valuetext={interactive ? `${percent} percent full` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(full + delta)
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
          <>
            <path data-ground d={solid([{ x: 10, y: 0 }, { x: 296, y: 0 }], 34)} fill={palette.dark} opacity={0.12} />
            <path d={line([{ x: 10, y: 0 }, { x: 296, y: 0 }])} fill="none" stroke={palette.dark} strokeWidth={1} opacity={0.5} />
          </>
        )}

        {/* Tractor: chassis, cab, stack, and the fifth wheel under the kingpin. */}
        <g data-tractor>
          <path d={box(30, DECK - 5, KINGPIN + 8, DECK, 20)} {...cast} />
          <path d={box(26, DECK, 84, DECK + 46, 21)} {...shell} />
          <path d={box(30, DECK + 24, 80, DECK + 42, 22)} {...cast} />
          <path d={box(86, DECK, 108, DECK + 34, 18)} {...shell} />
          <path d={bar({ x: 92, y: DECK + 34 }, { x: 92, y: DECK + 68 }, 3, 3, 17)} {...machined} />
          <path d={box(KINGPIN - 16, DECK, KINGPIN + 10, DECK + 5, 16)} {...machined} />
        </g>

        {/* Trailer: everything from here turns about the kingpin. */}
        <g data-trailer data-hitch={px(yaw)}>
          <path d={yBox(KINGPIN - 12, DECK - 2, BARREL_BACK - 10, DECK + 4, 18)} {...cast} />
          <path data-barrel d={ySolid(barrel, HALF_TRACK)} {...shell} />
          {bulkheads.map((x) => (
            <path
              key={x}
              d={yLine([{ x, y: BARREL_Y - BARREL_R + 2 }, { x, y: BARREL_Y + BARREL_R - 2 }], HALF_TRACK)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.2}
              opacity={0.5}
            />
          ))}
          {domes.map((x, index) => (
            <g key={x}>
              <path d={yDisc({ x, y: BARREL_Y + BARREL_R + 3 }, 7, 7)} {...machined} />
              <path
                d={yLine([{ x: x - 5, y: BARREL_Y + BARREL_R + 6 }, { x: x + 5, y: BARREL_Y + BARREL_R + 6 }], 8)}
                fill="none"
                stroke={charge(index) > 0.02 ? palette.accent : palette.metal}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </g>
          ))}
          <path
            d={yLine([{ x: BARREL_FRONT + 4, y: BARREL_Y + BARREL_R + 12 }, { x: BARREL_BACK - 4, y: BARREL_Y + BARREL_R + 12 }], HALF_TRACK - 3)}
            fill="none"
            stroke={palette.metal}
            strokeWidth={2.4}
          />
          <path d={yBox(146, DECK - 2, 152, 6, 4, 0)} {...machined} />

          {showCabinet && (
            <g data-cabinet>
              <path d={yBox(168, 12, 212, DECK, 8, HALF_TRACK - 6)} {...cast} />
              <path d={yDisc({ x: 224, y: 24 }, 10, 4, HALF_TRACK - 4)} {...machined} />
              {Array.from({ length: holds }, (_, index) => (
                <g key={index} data-compartment={index}>
                  <path d={yBox(174 + index * 9, 16, 179 + index * 9, 28, 2, HALF_TRACK - 1)} {...machined} />
                  <path
                    d={yBox(175 + index * 9, 17, 178 + index * 9, 17 + charge(index) * 10, 1.6, HALF_TRACK - 0.6)}
                    fill={palette.accent}
                  />
                </g>
              ))}
            </g>
          )}
        </g>

        {/* Wheels. The tractor's stay put; the trailer's turn with the hitch. */}
        {wheels.flatMap(([x, steer], index) =>
          [-1, 1].map((side) => {
            const trailer = x > KINGPIN
            const hub = { x, y: WHEEL }
            const offset = side * (HALF_TRACK - 5)
            const spoke = trailer ? 0 : roll
            const rim: Vec2[] = [
              { x: x - Math.cos(toRadians(spoke)) * (WHEEL - 5), y: WHEEL - Math.sin(toRadians(spoke)) * (WHEEL - 5) },
              { x: x + Math.cos(toRadians(spoke)) * (WHEEL - 5), y: WHEEL + Math.sin(toRadians(spoke)) * (WHEEL - 5) },
            ]
            return (
              <g key={`${index}:${side}`} data-wheel={index}>
                <path d={trailer ? yDisc(hub, WHEEL, 5, offset) : disc(hub, WHEEL, 5, offset)} {...cast} />
                <path d={trailer ? yDisc(hub, WHEEL - 6, 6, offset) : disc(hub, WHEEL - 6, 6, offset)} {...machined} />
                <path
                  d={trailer ? yLine(rim, offset + side * 1.5) : line(rim, offset + side * 1.5)}
                  fill="none"
                  stroke={steer ? palette.accent : palette.dark}
                  strokeWidth={1.6}
                />
              </g>
            )
          }),
        )}

        {variant === "blueprint" && (
          <text
            x={px(to({ x: 200, y: 106 }).x)}
            y={px(to({ x: 200, y: 106 }).y)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={6}
            fill={palette.foreground}
          >
            {`${percent}% · ${px(yaw)}°`}
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
 * Cargo at `clock`. `haul` runs a full barrel down the road and back to the
 * rack; `discharge` is a delivery round — a drop, a pause, another drop.
 */
export function tankerTruckLevel(behavior: TankerTruckBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.75
  const t = ((clock % 1) + 1) % 1
  if (behavior === "discharge") return clamp(1 - Math.floor(t * 4 + 1) / 4 + 0.12, 0, 1)
  return 0.86
}

export { TankerTruck }
