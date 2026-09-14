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
 * The body is an assembly rather than one hull, because `slabPath` is a convex
 * hull and a car is not convex: three blocks along the bottom with the two arch
 * gaps between them, a fender blister at each wheel station, the upper body
 * over the lot, and the greenhouse on top. The arches are holes in the drawing
 * because nothing was ever asked to cover them. Refit note: docs/vehicle-refit.md.
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

/**
 * The car, in its own profile: ground at y = 0, nose toward +x. A 4.4 m saloon
 * over 215 units, so a unit is 20.5 mm and every station below is a real one.
 */
const TAIL = 2
const NOSE = 215
const REAR_AXLE = 44
const FRONT_AXLE = 170
const WHEELBASE = FRONT_AXLE - REAR_AXLE
const TRACK = 76
const HALF_TRACK = TRACK / 2
const WHEEL_RADIUS = 17
const WHEEL_HALF_WIDTH = 5.5
/**
 * The arch the wheel runs in. Its mouth is the gap between two of the lower
 * blocks — a hole in the drawing, because nothing is asked to cover it — and
 * the band between `ARCH_RADIUS` and `ARCH_LIP` is the fender round it.
 */
const ARCH_RADIUS = 19
const ARCH_LIP = 21.5
const MID = (REAR_AXLE + FRONT_AXLE) / 2

/** Heights, ground up: valance, arch line, window base, shoulder, roof. */
const SILL = 13
const ROCKER_TOP = 21
const WAIST = 38
const BELT = 46
const SHOULDER = 52
const ROOF = 66
/** The height the body rolls and pitches about. */
const RIDE_HEIGHT = 26

/** Half-beams. The fenders stand proud of the doors, which is why it has hips. */
const BODY_HALF = 41
const FENDER_HALF = 42
const SKIRT_HALF = 22

/**
 * Drawing units to metres. The car is 4.4 m over its 215 units of length, and
 * the lean needs a real speed and a real radius to come from.
 */
const METRES = 4.4 / 215
/** A town speed, in metres per second, for the lateral acceleration. */
const ROAD_SPEED = 13
/**
 * How hard it is willing to corner, in g. A car at a real rack angle is not
 * still doing town speed — it has slowed for the corner — and without a cap the
 * lateral acceleration runs to several g and the roll sits on its stop through
 * the whole of a slalom instead of following the steering.
 */
const MAX_LATERAL = 0.6
/**
 * Roll gradient: degrees of body roll per g of lateral acceleration. Five and a
 * half is a saloon on road springs, so the body never leans more than about
 * three and a third degrees.
 */
const ROLL_GRADIENT = 5.5
/** Degrees of rack per second while it eases back into a behaviour. */
const RACK_RATE = 55

/** The box the car works inside. The road runs past it and off the frame. */
const ENVELOPE = boxCorners(
  { x: -50, y: -6, z: -228 },
  { x: 50, y: 92, z: 6 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/* -------------------------------------------------------------------------- */
/* the body, part by part                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Each part is a set of corner points; the hull of them is the part. Only the
 * extremes matter, so the outlines below are corners rather than traced edges.
 */

/** Rear valance and bumper: tail to the mouth of the rear arch. */
const REAR_BLOCK: Vec2[] = [
  { x: TAIL, y: 22 },
  { x: TAIL, y: WAIST },
  { x: REAR_AXLE - ARCH_RADIUS, y: WAIST },
  { x: REAR_AXLE - ARCH_RADIUS, y: SILL + 2 },
  { x: TAIL + 7, y: SILL + 2 },
]

/** The door skin between the two arches. */
const DOOR_BLOCK: Vec2[] = [
  { x: REAR_AXLE + ARCH_RADIUS, y: ROCKER_TOP - 2 },
  { x: FRONT_AXLE - ARCH_RADIUS, y: ROCKER_TOP - 2 },
  { x: FRONT_AXLE - ARCH_RADIUS, y: WAIST },
  { x: REAR_AXLE + ARCH_RADIUS, y: WAIST },
]

/** The rocker under the doors: tucked in, and the one dark thing down there. */
const ROCKER_BLOCK: Vec2[] = [
  { x: REAR_AXLE + ARCH_RADIUS - 2, y: SILL },
  { x: FRONT_AXLE - ARCH_RADIUS + 2, y: SILL },
  { x: FRONT_AXLE - ARCH_RADIUS + 2, y: SILL + 4 },
  { x: REAR_AXLE + ARCH_RADIUS - 2, y: SILL + 4 },
]

/** Front valance, air dam and bumper: the front arch forward to the nose. */
const FRONT_BLOCK: Vec2[] = [
  { x: FRONT_AXLE + ARCH_RADIUS, y: SILL + 2 },
  { x: NOSE - 6, y: SILL + 2 },
  { x: NOSE, y: 21 },
  { x: NOSE, y: WAIST },
  { x: FRONT_AXLE + ARCH_RADIUS, y: WAIST },
]

/**
 * The upper body: one piece from the arch line to the shoulder, with the boot
 * deck and the bonnet both a little below the scuttle — which is the step that
 * stops it reading as a van.
 */
const UPPER: Vec2[] = [
  { x: TAIL, y: WAIST - 2 },
  { x: TAIL, y: 43 },
  { x: TAIL + 18, y: 47 },
  { x: 66, y: SHOULDER },
  { x: 150, y: SHOULDER },
  { x: 194, y: 45 },
  { x: NOSE, y: 40 },
  { x: NOSE, y: WAIST - 2 },
]

/** The greenhouse: raked at both ends, and set in from the body all round. */
const CABIN: Vec2[] = [
  { x: 58, y: SHOULDER - 1 },
  { x: 82, y: ROOF - 2 },
  { x: 134, y: ROOF },
  { x: 160, y: SHOULDER - 1 },
]

/**
 * The fender over one wheel: an arch *band*, cut into segments so the mouth
 * stays open. A single hull round the whole band would fill the arch in, which
 * is exactly what was wrong with the body before the refit.
 */
const archBand = (axle: number, steps = 9): Vec2[][] =>
  Array.from({ length: steps }, (_, index) => {
    const a = Math.PI * (index / steps)
    const b = Math.PI * ((index + 1) / steps)
    return [
      { x: axle + Math.cos(a) * ARCH_RADIUS, y: WHEEL_RADIUS + Math.sin(a) * ARCH_RADIUS },
      { x: axle + Math.cos(b) * ARCH_RADIUS, y: WHEEL_RADIUS + Math.sin(b) * ARCH_RADIUS },
      { x: axle + Math.cos(b) * ARCH_LIP, y: WHEEL_RADIUS + Math.sin(b) * ARCH_LIP },
      { x: axle + Math.cos(a) * ARCH_LIP, y: WHEEL_RADIUS + Math.sin(a) * ARCH_LIP },
    ]
  })

/**
 * Half-beam at a drawing point. A car is not an extrusion: it is widest across
 * the hips, draws in at the sill and the roofline, and the nose and tail are
 * narrower than the doors. Taking the station as well as the height is what
 * makes the plan and the front elevation read as a car rather than as a box.
 */
const bodyBeam = (point: Vec2) => {
  const height = BODY_HALF - Math.max(0, WAIST - point.y) * 0.2 - Math.max(0, point.y - BELT) * 0.6
  const ends = Math.max(0, point.x - 192) * 0.3 + Math.max(0, 22 - point.x) * 0.3
  return Math.max(12, height - ends)
}
const skirtBeam = () => SKIRT_HALF
const fenderBeam = () => FENDER_HALF
const cabinBeam = (point: Vec2) =>
  31 - Math.max(0, point.y - SHOULDER) * 0.3 - Math.max(0, point.x - 130) * 0.12

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
  /** The road surface, its lane markings, and the shadow on it. */
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
  // `coordinatedBank` is atan(v²/rg), so its tangent is the lateral
  // acceleration in g — which is the number a roll gradient is quoted against.
  const lateral = Math.min(
    Math.tan(toRadians(coordinatedBank(ROAD_SPEED, rack.radius * METRES))),
    MAX_LATERAL,
  )
  const roll = -rack.sign * lateral * ROLL_GRADIENT

  // The road passes underneath; the wheels follow it and the body takes the
  // line through them.
  const rough = Number.isFinite(roughness) ? clamp(roughness, 0, 1) : 0
  // A non-finite phase parks the clock at NaN; nothing derived from it may
  // reach the DOM, so the road stands still instead.
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const travel = clock * carRoadSpeed(behavior)
  const surface = (x: number) => roadProfile(x + travel, rough * 3.4)
  const ride = axleRide(surface, [REAR_AXLE, FRONT_AXLE])
  const lift = ride.heave + Math.tan(toRadians(ride.pitch)) * MID
  const pitch = toRadians(ride.pitch)
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)

  /** A drawing point carried by the body: pitched, heaved, then rolled. */
  const world = (point: Vec2, depth: number): Vec3 => {
    const dx = point.x - MID
    const dy = point.y - RIDE_HEIGHT
    const posed = {
      x: MID + dx * cosPitch - dy * sinPitch,
      y: RIDE_HEIGHT + dx * sinPitch + dy * cosPitch + lift,
    }
    return rollPoint(posed, depth, roll, RIDE_HEIGHT + lift)
  }

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  /** A solid whose half-beam follows the station it is cut at. */
  const solid = (outline: Vec2[], beam: (point: Vec2) => number, offset = 0) =>
    slabPath(
      outline.flatMap((point) => [
        world(point, offset + beam(point)),
        world(point, offset - beam(point)),
      ]),
      camera,
    )
  /** A flat panel standing across the machine: a screen, a grille, a lamp bar. */
  const panel = (points: Vec2[], from: number, to: number) =>
    slabPath(
      points.flatMap((point) => [world(point, from), world(point, to)]),
      camera,
    )
  const face = (
    points: Vec2[],
    depth: number | ((point: Vec2) => number),
    close = false,
  ) =>
    `${points
      .map((point, index) => {
        const corner = world(point, typeof depth === "function" ? depth(point) : depth)
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
      tyre: slabPath(wheelSolid(centre, WHEEL_RADIUS, WHEEL_HALF_WIDTH, angle, 20), camera),
      rim: slabPath(
        wheelSolid(centre, WHEEL_RADIUS * 0.66, WHEEL_HALF_WIDTH + 0.5, angle, 16),
        camera,
      ),
      cap: slabPath(
        wheelSolid(centre, WHEEL_RADIUS * 0.22, WHEEL_HALF_WIDTH + 0.9, angle, 10),
        camera,
      ),
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
      <path d={entry.tyre} {...cast} />
      <path d={entry.rim} {...machined} />
      {[0, 72, 144, 216, 288].map((offset) => {
        const from = rimPoint(entry.centre, WHEEL_RADIUS * 0.26, spin + offset, entry.angle)
        const to = rimPoint(entry.centre, WHEEL_RADIUS * 0.6, spin + offset, entry.angle)
        return (
          <path
            key={offset}
            d={`M ${px(from.x)} ${px(from.y)} L ${px(to.x)} ${px(to.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.55}
          />
        )
      })}
      <path d={entry.cap} {...cast} />
    </g>
  )

  /** Everything under the arch line: three blocks, with the two arches between. */
  const underBody = (
    <>
      <path d={solid(REAR_BLOCK, bodyBeam)} {...shell} />
      <path d={solid(DOOR_BLOCK, bodyBeam)} {...shell} />
      <path d={solid(ROCKER_BLOCK, skirtBeam)} {...cast} />
      <path d={solid(FRONT_BLOCK, bodyBeam)} {...shell} />
    </>
  )
  /**
   * The fenders: an arch band per wheel, standing proud of the door skin. The
   * band is filled segment by segment but outlined once, or the seams between
   * the segments read as a fan rather than as one piece of bodywork.
   */
  const fenders = ([["rear", REAR_AXLE], ["front", FRONT_AXLE]] as const).map(
    ([name, axle]) => (
      <g key={name} data-fender={name}>
        {shell.fill !== "none" &&
          archBand(axle).map((segment, index) => (
            <path
              key={index}
              d={solid(segment, fenderBeam)}
              fill={shell.fill}
              fillOpacity={shell.fillOpacity}
              stroke="none"
            />
          ))}
        {/* Only the mouth is outlined. Outlining the band's outer edge too
            draws a ring round the wheel, and at a ten-degree elevation the
            extrusion smears that ring into a flare. */}
        <path
          data-arch={name}
          d={face(
            Array.from({ length: 17 }, (_, index) => {
              const angle = Math.PI * (index / 16)
              return {
                x: axle + Math.cos(angle) * ARCH_LIP,
                y: WHEEL_RADIUS + Math.sin(angle) * ARCH_LIP,
              }
            }),
            FENDER_HALF + 0.2,
          )}
          fill="none"
          stroke={shell.stroke}
          strokeWidth={1.3}
        />
      </g>
    ),
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
        {showGround && (
          <g data-ground>
            {/* The carriageway, and the lane it is in. The markings run with
                the road, which is the only thing that says how fast it goes. */}
            <path
              d={slabPath(
                [
                  { x: -(HALF_TRACK + 17), y: -0.5, z: 24 },
                  { x: HALF_TRACK + 17, y: -0.5, z: 24 },
                  { x: HALF_TRACK + 17, y: -0.5, z: -252 },
                  { x: -(HALF_TRACK + 17), y: -0.5, z: -252 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.06}
            />
            {[-(HALF_TRACK + 16), HALF_TRACK + 16].map((edge) => (
              <path
                key={edge}
                data-road={edge < 0 ? "port" : "starboard"}
                d={Array.from({ length: 30 }, (_, index) => {
                  const x = -20 + (index / 29) * 252
                  const screen = camera.project(edge, surface(x) - 0.6, -x)
                  return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
                }).join(" ")}
                fill="none"
                stroke={palette.dark}
                strokeWidth={1.6}
                opacity={0.45}
              />
            ))}
            {Array.from({ length: 5 }, (_, index) => {
              // Dashes standing still in the world while the car drives past
              // them: the phase is the distance the wheels have turned through.
              const at = ((index * 58 - travel) % 290 + 290) % 290 - 30
              const a = camera.project(-(HALF_TRACK + 13), -0.4, -at)
              const b = camera.project(-(HALF_TRACK + 13), -0.4, -(at + 26))
              return (
                <path
                  key={index}
                  data-lane-dash
                  d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              )
            })}
            <path
              data-shadow
              d={slabPath(
                [
                  { x: -BODY_HALF, y: 0.2, z: -TAIL - 4 },
                  { x: BODY_HALF, y: 0.2, z: -TAIL - 4 },
                  { x: BODY_HALF, y: 0.2, z: -NOSE + 4 },
                  { x: -BODY_HALF, y: 0.2, z: -NOSE + 4 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.16}
            />
          </g>
        )}

        {wheels.filter((entry) => entry.depth <= bodyDepth).map(wheel)}

        <g data-body data-pitch={px(ride.pitch)}>
          {underBody}
          <path d={solid(UPPER, bodyBeam)} {...shell} />

          {/* Dampers: whatever travel the body did not take is visible here,
              because the top end is on the body and the bottom is on the road. */}
          {[REAR_AXLE, FRONT_AXLE].flatMap((axle, index) =>
            [-HALF_TRACK, HALF_TRACK].map((side) => {
              const top = world({ x: axle, y: WAIST + 1 }, side)
              const mount = camera.project(top.x, top.y, top.z)
              const hub = camera.project(side, surface(axle) + WHEEL_RADIUS, -axle)
              return (
                <path
                  key={`${axle}-${side}`}
                  data-damper={`${index === 0 ? "rear" : "front"}-${side < 0 ? "left" : "right"}`}
                  d={`M ${px(mount.x)} ${px(mount.y)} L ${px(hub.x)} ${px(hub.y)}`}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              )
            }),
          )}

          {fenders}
          {/* Shut lines: two doors, a bonnet and a boot, on the door skin. */}
          {[
            [{ x: 64, y: SILL + 4 }, { x: 64, y: SHOULDER - 2 }],
            [{ x: 112, y: SILL + 4 }, { x: 112, y: SHOULDER - 2 }],
            [{ x: 156, y: WAIST }, { x: 156, y: SHOULDER - 1 }],
          ].map((cut, index) => (
            <path
              key={index}
              d={face(cut, (point) => bodyBeam(point) + 0.3)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.9}
              opacity={0.32}
            />
          ))}
          {/* The shoulder crease, which is the line that gives it a waist. */}
          <path
            d={face(
              [{ x: TAIL + 10, y: BELT - 2 }, { x: 150, y: BELT - 1 }, { x: NOSE - 12, y: BELT - 5 }],
              (point) => bodyBeam(point) + 0.3,
            )}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.1}
            opacity={0.4}
          />
          {[88, 126].map((at) => (
            <path
              key={at}
              data-handle={at}
              d={face(
                [{ x: at, y: BELT - 5 }, { x: at + 14, y: BELT - 5 }],
                (point) => bodyBeam(point) + 1.4,
              )}
              fill="none"
              stroke={palette.metal}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ))}

          <g data-cabin>
            <path d={solid(CABIN, cabinBeam)} {...machined} />
            {/* Side glass: two lights with the B-pillar standing between them. */}
            {[
              [
                { x: 74, y: SHOULDER + 1.5 },
                { x: 102, y: SHOULDER + 1.5 },
                { x: 102, y: ROOF - 3 },
                { x: 84, y: ROOF - 3 },
              ],
              [
                { x: 108, y: SHOULDER + 1.5 },
                { x: 144, y: SHOULDER + 1.5 },
                { x: 132, y: ROOF - 2.5 },
                { x: 108, y: ROOF - 2.5 },
              ],
            ].map((light, index) => (
              <path
                key={index}
                data-glass={index === 0 ? "rear" : "front"}
                d={face(light, (point) => cabinBeam(point) + 0.4, true)}
                fill={palette.dark}
                opacity={0.58}
              />
            ))}
            {/* The screen and the backlight stand across the machine, so they
                are a rake in profile and a real pane from the front. */}
            <path
              data-screen
              d={panel(
                [
                  { x: 134, y: ROOF - 1 },
                  { x: 158, y: SHOULDER + 1 },
                ],
                -30,
                30,
              )}
              fill={palette.dark}
              opacity={0.78}
            />
            <path
              data-backlight
              d={panel(
                [
                  { x: 82, y: ROOF - 2 },
                  { x: 58, y: SHOULDER + 1 },
                ],
                -28,
                28,
              )}
              fill={palette.dark}
              opacity={0.66}
            />
          </g>

          {/* Mirrors, on stalks at the A-pillar. Nothing else tells the plan
              view that it is looking at a car. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-mirror={side < 0 ? "left" : "right"}
              d={solid(
                [
                  { x: 150, y: BELT + 1 },
                  { x: 158, y: BELT + 1 },
                  { x: 158, y: BELT + 6 },
                  { x: 150, y: BELT + 6 },
                ],
                () => 3.4,
                side * (BODY_HALF + 4),
              )}
              {...machined}
            />
          ))}

          {showSensor && (
            <g data-sensor>
              <path
                d={solid(
                  [
                    { x: 94, y: ROOF - 1 },
                    { x: 126, y: ROOF - 1 },
                    { x: 126, y: ROOF + 2 },
                    { x: 94, y: ROOF + 2 },
                  ],
                  () => 13,
                )}
                {...machined}
              />
              {/* The drum: a dark band all round, because that is the window
                  the scanner looks out of, and it lights when it is driving. */}
              <path
                d={solid(
                  [
                    { x: 97, y: ROOF + 2 },
                    { x: 123, y: ROOF + 2 },
                    { x: 123, y: ROOF + 7 },
                    { x: 97, y: ROOF + 7 },
                  ],
                  () => 11,
                )}
                {...cast}
              />
              <path
                d={solid(
                  [
                    { x: 96, y: ROOF + 7 },
                    { x: 124, y: ROOF + 7 },
                    { x: 123, y: ROOF + 9.5 },
                    { x: 97, y: ROOF + 9.5 },
                  ],
                  () => 12,
                )}
                {...machined}
              />
              <path
                data-scan
                d={face([{ x: 97, y: ROOF + 4.6 }, { x: 123, y: ROOF + 4.6 }], 11.4)}
                fill="none"
                stroke={lamps ? palette.accent : palette.metal}
                strokeWidth={2.2}
                opacity={lamps ? 0.95 : 0.6}
              />
            </g>
          )}

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

        {/* The nose and the tail. Both stand across the machine, so they read
            from every camera rather than only from the side — and both are
            drawn after the wheels, because in front elevation they are the
            nearest things on the car. */}
        <g data-ends>
          {/* The nose: a grille panel, a lamp either side of it, a bumper bar.
              All three stand across the machine, so they read from every
              camera rather than only from the side. */}
          <path
            data-bumper
            d={solid(
              [
                { x: NOSE - 7, y: 15 },
                { x: NOSE - 0.5, y: 19 },
                { x: NOSE - 0.5, y: 25 },
                { x: NOSE - 7, y: 25 },
              ],
              () => 33,
            )}
            {...cast}
          />
          <path
            data-grille
            d={panel(
              [
                { x: NOSE - 0.5, y: 25 },
                { x: NOSE - 0.5, y: 34 },
              ],
              -29,
              29,
            )}
            fill={palette.dark}
            opacity={0.8}
          />
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-lamp={side < 0 ? "front-left" : "front-right"}
              d={panel(
                [
                  { x: NOSE - 1, y: 27 },
                  { x: NOSE - 1, y: 35 },
                ],
                side * 25,
                side * 38,
              )}
              fill={lamps ? palette.accent : palette.metal}
              opacity={lamps ? 0.95 : 0.7}
            />
          ))}
          {/* A side repeater at each rear corner, so the tail reads in profile
              as well as from behind. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-lamp={side < 0 ? "rear-left" : "rear-right"}
              d={solid(
                [
                  { x: TAIL + 1, y: 34 },
                  { x: TAIL + 13, y: 34 },
                  { x: TAIL + 13, y: 39 },
                  { x: TAIL + 1, y: 39 },
                ],
                () => 1.2,
                side * (bodyBeam({ x: TAIL + 7, y: 36 }) - 1),
              )}
              fill={lamps ? palette.accent : palette.metal}
              opacity={lamps ? 0.9 : 0.65}
            />
          ))}
          {/* The tail: one lamp bar across, because that is what a tail is. */}
          <path
            data-lamp="rear"
            d={panel(
              [
                { x: TAIL + 0.5, y: 33 },
                { x: TAIL + 0.5, y: 39 },
              ],
              -34,
              34,
            )}
            fill={lamps ? palette.accent : palette.metal}
            opacity={lamps ? 0.85 : 0.6}
          />
        </g>
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
