"use client"

/**
 * robot-car — an autonomous road car, and the steering rack under it.
 *
 * `robot-rover` turns its front wheels by how much heading it still has to
 * cover. A car cannot: its two front wheels run on circles half a track apart,
 * so the same rack has to turn them through *different* angles or one of them
 * scrubs. That is the whole machine. `steer` is the angle the centreline would
 * need, and `ackermann()` answers with the two the wheels actually take — which
 * is why the plan view shows the inner wheel cranked harder than the outer one.
 *
 * Two more things fall out of the same number. The turn radius gives the
 * lateral acceleration, and the body leans a stated fraction of it — outward,
 * the way a car rolls, not inward like an aircraft. And the road under the
 * wheels is a surface: the body takes the least-squares line through its axle
 * contacts, so it heaves and pitches while each damper keeps the difference.
 *
 * Nothing here integrates a path. There is no tyre model, no roll stiffness and
 * no weight transfer; the road is an illustrative profile and says so.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
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
import {
  MAX_STEER,
  ackermann,
  axleRide,
  coordinatedBank,
  roadProfile,
  rollPoint,
  wheelSolid,
} from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 280
const VIEW_HEIGHT = 160
const NATIVE_VIEW: RobotView = "profile"

/** The car, in its own profile: ground at y = 0, nose toward +x. */
const REAR_AXLE = 48
const FRONT_AXLE = 168
const WHEELBASE = FRONT_AXLE - REAR_AXLE
const TRACK = 62
const HALF_TRACK = TRACK / 2
const WHEEL_RADIUS = 19
const WHEEL_HALF_WIDTH = 6.5
const HALF_BEAM = 38
const CABIN_BEAM = 30
const MID = (REAR_AXLE + FRONT_AXLE) / 2
/** The height the body rolls and pitches about. */
const RIDE_HEIGHT = 26

/**
 * Drawing units to metres. The car is 4.4 m over its 215 units of length, and
 * the lean needs a real speed and a real radius to come from.
 */
const METRES = 4.4 / 215
/** A town speed, in metres per second, for the lateral acceleration. */
const ROAD_SPEED = 13
/** How much of the lateral-acceleration angle the springs give away. */
const ROLL_GAIN = 0.55
const MAX_ROLL = 7
/** Degrees of rack per second while it eases back into a behaviour. */
const RACK_RATE = 55

const ENVELOPE = boxCorners(
  { x: -46, y: -16, z: -228 },
  { x: 46, y: 104, z: 8 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** The lower body: sills, bumpers, and the shoulder line over the arches. */
const TUB: Vec2[] = [
  { x: 6, y: 30 },
  { x: 8, y: 44 },
  { x: 34, y: 50 },
  { x: 172, y: 50 },
  { x: 198, y: 44 },
  { x: 214, y: 34 },
  { x: 212, y: 21 },
  { x: 190, y: 16 },
  { x: 34, y: 16 },
  { x: 8, y: 21 },
]

/** The greenhouse, narrower than the body and set in from both ends. */
const CABIN: Vec2[] = [
  { x: 64, y: 48 },
  { x: 84, y: 78 },
  { x: 142, y: 80 },
  { x: 164, y: 48 },
]

export type CarBehavior = "cruise" | "slalom" | "park" | "static"

export interface RobotCarProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Centreline steering angle in degrees, positive to starboard. Supplying it stops the loop. */
  steer?: number
  onSteerChange?: (steer: number) => void
  /** What the rack does when `steer` is not supplied. */
  behavior?: CarBehavior
  /** Where the camera stands. Plan is where the two front wheels disagree. */
  view?: RobotView
  /** How rough the road under the wheels is, 0 (glass) to 1. */
  roughness?: number
  /** The roof sensor drum. */
  showSensor?: boolean
  /** The road surface, and the shadow on it. */
  showGround?: boolean
  /** Light the lamps. Omit and they light while it is driving. */
  active?: boolean
  /** Press and drag across the car to steer it; arrow keys turn the rack. */
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotCar({
  steer,
  onSteerChange,
  behavior = "cruise",
  view = NATIVE_VIEW,
  roughness = 0.35,
  showSensor = true,
  showGround = true,
  active,
  interactive = false,
  speed = 0.35,
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
}: RobotCarProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = steer !== undefined

  const hold = controlled
    ? Number.isFinite(steer) ? clamp(steer as number, -MAX_STEER, MAX_STEER) : 0
    : held
  const goal = React.useCallback((clock: number) => carSteer(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: RACK_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const rackAngle = clamp(motion.value, -MAX_STEER, MAX_STEER)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, -MAX_STEER, MAX_STEER) * 10) / 10
      setHeld(bounded)
      onSteerChange?.(bounded)
    },
    [onSteerChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * MAX_STEER),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // One steering number, two wheel angles, one turn radius — and the lean the
  // radius implies, thrown outward the way a car rolls.
  const rack = ackermann(rackAngle, { wheelbase: WHEELBASE, track: TRACK })
  const lean = coordinatedBank(ROAD_SPEED, rack.radius * METRES)
  const roll = -rack.sign * Math.min(lean * ROLL_GAIN, MAX_ROLL)

  // The road passes underneath; the wheels follow it and the body takes the
  // line through them.
  const rough = Number.isFinite(roughness) ? clamp(roughness, 0, 1) : 0
  const travel = motion.clock * carRoadSpeed(behavior)
  const surface = React.useCallback(
    (x: number) => roadProfile(x + travel, rough * 3.4),
    [travel, rough],
  )
  const ride = axleRide(surface, [REAR_AXLE, FRONT_AXLE])
  const lift = ride.heave + Math.tan(toRadians(ride.pitch)) * MID
  const pitch = toRadians(ride.pitch)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)

  /** A drawing point carried by the body: pitched, heaved, then rolled. */
  const world = React.useCallback(
    (point: Vec2, depth: number): Vec3 => {
      const dx = point.x - MID
      const dy = point.y - RIDE_HEIGHT
      const posed = {
        x: MID + dx * cosPitch - dy * sinPitch,
        y: RIDE_HEIGHT + dx * sinPitch + dy * cosPitch + lift,
      }
      return rollPoint(posed, depth, roll, RIDE_HEIGHT + lift)
    },
    [cosPitch, sinPitch, lift, roll],
  )

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const solid = (outline: Vec2[], halfDepth: number, offset = 0) =>
    slabPath(
      outline.flatMap((point) => [
        world(point, offset + halfDepth),
        world(point, offset - halfDepth),
      ]),
      camera,
    )
  const face = (points: Vec2[], depth: number, close = false) =>
    `${points
      .map((point, index) => {
        const corner = world(point, depth)
        const screen = camera.project(corner.x, corner.y, corner.z)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  // The wheels are not carried by the body: they stand on the road, which is
  // the only reason the dampers have anything to do.
  const wheels = ([
    ["rear-left", REAR_AXLE, -HALF_TRACK, 0],
    ["rear-right", REAR_AXLE, HALF_TRACK, 0],
    ["front-left", FRONT_AXLE, -HALF_TRACK, rack.left],
    ["front-right", FRONT_AXLE, HALF_TRACK, rack.right],
  ] as const).map(([name, axle, side, angle]) => {
    const centre: Vec3 = {
      x: side,
      y: surface(axle) + WHEEL_RADIUS,
      z: -axle,
    }
    return {
      name,
      angle,
      centre,
      depth: camera.depth(centre.x, centre.y, centre.z),
      rim: slabPath(wheelSolid(centre, WHEEL_RADIUS, WHEEL_HALF_WIDTH, angle, 18), camera),
      hub: slabPath(wheelSolid(centre, WHEEL_RADIUS * 0.44, WHEEL_HALF_WIDTH + 0.6, angle, 12), camera),
    }
  })
  const bodyDepth = camera.depth(0, RIDE_HEIGHT + lift, -MID)
  const spin = (travel / WHEEL_RADIUS) * (180 / Math.PI)

  /** A point on a wheel's rim, in the wheel's own steered plane. */
  const rimPoint = (centre: Vec3, radius: number, degrees: number, angle: number) => {
    const turn = toRadians(angle)
    const along = toRadians(degrees)
    const corner = {
      x: centre.x + Math.sin(turn) * Math.cos(along) * radius,
      y: centre.y + Math.sin(along) * radius,
      z: centre.z - Math.cos(turn) * Math.cos(along) * radius,
    }
    return camera.project(corner.x, corner.y, corner.z)
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const driving = !controlled && behavior !== "static" && animate && !paused
  const lamps = active ?? driving
  const readout = Math.round(rackAngle)

  const wheel = (entry: (typeof wheels)[number]) => (
    <g key={entry.name} data-wheel={entry.name} data-angle={px(entry.angle)}>
      <path d={entry.rim} {...cast} />
      <path d={entry.hub} {...machined} />
      {[0, 60, 120].map((offset) => {
        const from = rimPoint(entry.centre, WHEEL_RADIUS * 0.44, spin + offset, entry.angle)
        const to = rimPoint(entry.centre, WHEEL_RADIUS * 0.92, spin + offset, entry.angle)
        return (
          <path
            key={offset}
            d={`M ${px(from.x)} ${px(from.y)} L ${px(to.x)} ${px(to.y)}`}
            fill="none"
            stroke={palette.metal}
            strokeWidth={1.3}
            opacity={0.7}
          />
        )
      })}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Autonomous road car, steering ${readout} degrees, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? -MAX_STEER : undefined}
      aria-valuemax={interactive ? MAX_STEER : undefined}
      aria-valuenow={interactive ? px(rackAngle) : undefined}
      aria-valuetext={interactive ? `steering ${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 10 : 4, 20)
        if (delta !== 0) apply(rackAngle + delta)
        else if (event.key === "Home") apply(0)
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
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M 10 ${VIEW_HEIGHT - 26} H ${VIEW_WIDTH - 10}`}
            strokeDasharray="3 4"
          />
        </g>
      )}

      <g data-view={view} data-steer={px(rackAngle)} data-roll={px(roll)} transform={frame || undefined}>
        {showGround &&
          [-(HALF_TRACK + 10), HALF_TRACK + 10].map((edge) => (
            <path
              key={edge}
              data-road={edge < 0 ? "port" : "starboard"}
              d={Array.from({ length: 34 }, (_, index) => {
                const x = -16 + (index / 33) * 252
                const screen = camera.project(edge, surface(x), -x)
                return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
              }).join(" ")}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.4}
              opacity={0.4}
            />
          ))}

        {wheels.filter((entry) => entry.depth <= bodyDepth).map(wheel)}

        <g data-body data-pitch={px(ride.pitch)}>
          {/* Dampers: whatever travel the body did not take is visible here,
              because the top end is on the body and the bottom is on the road. */}
          {[REAR_AXLE, FRONT_AXLE].flatMap((axle, index) =>
            [-HALF_TRACK, HALF_TRACK].map((side) => {
              const top = world({ x: axle, y: 46 }, side)
              const mount = camera.project(top.x, top.y, top.z)
              const hub = camera.project(side, surface(axle) + WHEEL_RADIUS, -axle)
              return (
                <path
                  key={`${axle}-${side}`}
                  data-damper={`${index === 0 ? "rear" : "front"}-${side < 0 ? "left" : "right"}`}
                  d={`M ${px(mount.x)} ${px(mount.y)} L ${px(hub.x)} ${px(hub.y)}`}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            }),
          )}

          <path d={solid(TUB, HALF_BEAM)} {...shell} />
          {/* Sill shadow and the shoulder seam: two marks, drawn on the face. */}
          <path
            d={face([{ x: 22, y: 22 }, { x: 196, y: 22 }], HALF_BEAM + 0.4)}
            fill="none"
            stroke={palette.dark}
            strokeWidth={2}
            opacity={0.55}
          />
          <path
            d={face([{ x: 18, y: 44 }, { x: 200, y: 44 }], HALF_BEAM + 0.4)}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1}
            opacity={0.4}
          />

          <g data-cabin>
            <path d={solid(CABIN, CABIN_BEAM)} {...machined} />
            <path
              data-glass
              d={face(
                [
                  { x: 76, y: 50 },
                  { x: 90, y: 74 },
                  { x: 136, y: 76 },
                  { x: 152, y: 50 },
                ],
                CABIN_BEAM + 0.4,
                true,
              )}
              fill={palette.dark}
              opacity={0.55}
            />
            <path
              d={face([{ x: 112, y: 50 }, { x: 112, y: 75 }], CABIN_BEAM + 0.6)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.2}
            />
          </g>

          {showSensor && (
            <g data-sensor>
              <path
                d={solid(
                  [
                    { x: 104, y: 80 },
                    { x: 124, y: 80 },
                    { x: 124, y: 94 },
                    { x: 104, y: 94 },
                  ],
                  9,
                )}
                {...cast}
              />
              <path
                d={face([{ x: 104, y: 88 }, { x: 124, y: 88 }], 9.4)}
                fill="none"
                stroke={lamps ? palette.accent : palette.metal}
                strokeWidth={2.4}
              />
            </g>
          )}

          {/* Lamps, fore and aft, painted on the ends of the body. */}
          <path
            data-lamp="front"
            d={face([{ x: 209, y: 26 }, { x: 212, y: 32 }], HALF_BEAM - 6)}
            fill="none"
            stroke={lamps ? palette.accent : palette.metal}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <path
            data-lamp="rear"
            d={face([{ x: 8, y: 30 }, { x: 9, y: 38 }], HALF_BEAM - 6)}
            fill="none"
            stroke={lamps ? palette.shell : palette.metal}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </g>

        {/* The rack itself: one bar across the axle, turning both wheels. */}
        <path
          data-rack
          d={(() => {
            const arm = (side: number, angle: number) => {
              const turn = toRadians(angle)
              return {
                x: side - Math.sin(turn) * 9,
                y: surface(FRONT_AXLE) + WHEEL_RADIUS,
                z: -FRONT_AXLE + Math.cos(turn) * 9,
              }
            }
            const left = arm(-HALF_TRACK, rack.left)
            const right = arm(HALF_TRACK, rack.right)
            const a = camera.project(left.x, left.y, left.z)
            const b = camera.project(right.x, right.y, right.z)
            return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
          })()}
          fill="none"
          stroke={palette.metal}
          strokeWidth={2.2}
        />

        {wheels.filter((entry) => entry.depth > bodyDepth).map(wheel)}
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
 * The steering angle the rack is asking for at `clock`, in degrees. A cruise
 * is lane-keeping, a slalom is a real weave, and parking runs to full lock and
 * back.
 */
export function carSteer(behavior: CarBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  switch (behavior) {
    case "slalom":
      return Math.sin(t) * 34
    case "park":
      // Near-square: on the lock, off the lock, with the rack rate drawing the
      // sweep between them.
      return Math.tanh(Math.sin(t) * 3) * 48
    default:
      return Math.sin(t) * 8 + Math.sin(t * 0.63) * 4
  }
}

/** How fast the road passes under the wheels, in drawing units per second. */
export function carRoadSpeed(behavior: CarBehavior): number {
  switch (behavior) {
    case "slalom":
      return 70
    case "park":
      return 14
    case "static":
      return 0
    default:
      return 96
  }
}

export { RobotCar }
