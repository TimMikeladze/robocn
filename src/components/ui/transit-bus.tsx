"use client"

/**
 * transit-bus — an articulated city bus, and the hitch it bends on.
 *
 * The rear section's angle is not an input. Steer the front axle and the
 * trailer's angle is *solved*: the pivot rides a circle behind the drive axle,
 * the trailing axle cannot slide sideways, and those two facts fix the angle
 * between the sections. That is why the tail swings out of a turn on its own,
 * and why coming out of one leaves the bus straight without anything unwinding.
 *
 * Two more mechanisms, both visible: plug doors whose leaves stand off the side
 * before they part, and a kneel — which is not a separate axis, because a bus
 * kneels to open. The doors' own number lowers the body, rolls it toward the
 * kerb, and stops the wheels, because a bus with its doors open is standing.
 *
 * The body is an assembly, not one hull: `slabPath` is a convex hull, so the
 * skirt is drawn as segments between the arches and the arches are the gaps
 * left over. Proportions are an 18 m bus — 3.5 m to the roof, 1.3 m wheels —
 * rather than the double-decker the first draft had. Refit: docs/vehicle-refit.md.
 *
 * No dynamics: no tyre model, no load, no swept-path envelope. The articulation
 * is the steady state, not an integrated manoeuvre.
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
  ackermann,
  hitchAngle,
  rollPoint,
  wheelSolid,
} from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 106
const NATIVE_VIEW: RobotView = "profile"

/**
 * The bus in its own profile: ground at y = 0, nose toward +x. 18 m over 256
 * units, so a unit is 70 mm and the stations below are real ones.
 */
const NOSE = 252
const TAIL = -4
const PIVOT = 92
const FRONT_AXLE = 214
const DRIVE_AXLE = 126
const TRAILER_AXLE = 34
const WHEELBASE = FRONT_AXLE - DRIVE_AXLE
const TRACK = 29
const HALF_TRACK = TRACK / 2
const WHEEL_RADIUS = 9
const WHEEL_HALF_WIDTH = 3.4
/** The arch each wheel runs in: the gap between two skirt segments. */
const ARCH_RADIUS = 11.5

/** Heights, ground up: skirt, floor, window sill, window head, roof. */
const SKIRT = 7
const FLOOR = 14
const SILL = 28
const HEAD = 43
const ROOF = 50
/** How far the body drops, and how far it rolls, with the doors fully open. */
const KNEEL_DROP = 3.4
const KNEEL_ROLL = 2
/** Degrees of rack per second while it eases back into a behaviour. */
const RACK_RATE = 34
const BUS_MAX_STEER = 42

const ENVELOPE = boxCorners(
  { x: -34, y: -3, z: -262 },
  { x: 34, y: 60, z: 14 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * Half-beam at a drawing point. A bus tumblehomes in at the skirt and again at
 * the cant rail, and the nose is drawn in from the sides — which is what makes
 * the front elevation read as a bus rather than as a shipping container. Drawn
 * at 3.1 m rather than a true 2.55 m: a 7:1 plan in a 2:1 frame is a hairline,
 * and the refit note says so out loud.
 */
const BEAM = 22
const beamAt = (point: Vec2) =>
  BEAM -
  Math.max(0, FLOOR + 4 - point.y) * 0.3 -
  Math.max(0, point.y - HEAD) * 0.34 -
  Math.max(0, point.x - (NOSE - 10)) * 0.5

/** One section's body, from the arch line to the roof. */
const section = (from: number, to: number, rake: number): Vec2[] => [
  { x: from, y: SKIRT + 12 },
  { x: from, y: ROOF - rake },
  { x: from + rake, y: ROOF },
  { x: to - rake, y: ROOF },
  { x: to, y: ROOF - rake },
  { x: to, y: SKIRT + 12 },
]

/**
 * The driver's end. A city bus is a box everywhere except here: the screen is
 * raked back over the driver and the roof runs on past it, which is the one
 * line that says which way round the bus is.
 */
const NOSE_RAKE = 13
const cabEnd = (from: number): Vec2[] => [
  { x: from, y: SKIRT + 12 },
  { x: from, y: ROOF - 5 },
  { x: from + 5, y: ROOF },
  { x: NOSE - NOSE_RAKE, y: ROOF },
  { x: NOSE - 2, y: HEAD - 2 },
  { x: NOSE, y: SILL - 6 },
  { x: NOSE, y: SKIRT + 12 },
]

/**
 * The skirt below the body, cut into the runs between the wheel arches. The
 * arches are what is left over: holes in the drawing, because nothing is asked
 * to cover them.
 */
const skirtRuns = (from: number, to: number, axles: number[]): Vec2[][] => {
  const edges = [from, ...axles.flatMap((axle) => [axle - ARCH_RADIUS, axle + ARCH_RADIUS]), to]
  const runs: Vec2[][] = []
  for (let index = 0; index < edges.length; index += 2) {
    const a = edges[index]
    const b = edges[index + 1]
    if (b - a < 1) continue
    runs.push([
      { x: a, y: SKIRT },
      { x: b, y: SKIRT },
      { x: b, y: SKIRT + 13 },
      { x: a, y: SKIRT + 13 },
    ])
  }
  return runs
}

/** The underside, so an arch reads as a hole into the bus and not into white. */
const underFloor = (from: number, to: number): Vec2[] => [
  { x: from + 2, y: SKIRT + 2 },
  { x: to - 2, y: SKIRT + 2 },
  { x: to - 2, y: SKIRT + 13 },
  { x: from + 2, y: SKIRT + 13 },
]

/** Where the glass goes on one section, with the doors taken out of it. */
const windowBays = (from: number, to: number, gaps: Array<[number, number]>) => {
  const bays: Array<[number, number]> = []
  let at = from
  for (const [start, end] of gaps.sort((a, b) => a[0] - b[0])) {
    if (start - at > 6) bays.push([at, start])
    at = Math.max(at, end)
  }
  if (to - at > 6) bays.push([at, to])
  // Each run is divided into bays of about 1.6 m, which is what a bus pillar
  // spacing actually is, rather than one long strip of glass.
  return bays.flatMap(([start, end]) => {
    const count = Math.max(1, Math.round((end - start) / 23))
    const step = (end - start) / count
    return Array.from({ length: count }, (_, index) => [
      start + index * step + 1.4,
      start + (index + 1) * step - 1.4,
    ] as [number, number])
  })
}

export type TransitBusBehavior = "route" | "service" | "static"

export interface TransitBusProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Front-axle steering in degrees, positive to starboard. Supplying it stops the loop. */
  steer?: number
  onSteerChange?: (steer: number) => void
  /** Doors, 0 shut to 1 open. The bus kneels and stops on the same number. */
  doors?: number
  /** What the bus does when `steer` is not supplied. */
  behavior?: TransitBusBehavior
  /** A rear section on a turntable, or one rigid body. */
  articulated?: boolean
  view?: RobotView
  showGround?: boolean
  /** Light the destination sign and the door edges. Omit and they light in service. */
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

function TransitBus({
  steer,
  onSteerChange,
  doors,
  behavior = "route",
  articulated = true,
  view = NATIVE_VIEW,
  showGround = true,
  active,
  interactive = false,
  speed = 0.3,
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
}: TransitBusProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = steer !== undefined

  const hold = controlled
    ? Number.isFinite(steer) ? clamp(steer as number, -BUS_MAX_STEER, BUS_MAX_STEER) : 0
    : held
  const goal = React.useCallback((clock: number) => busSteer(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: RACK_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const rackAngle = clamp(motion.value, -BUS_MAX_STEER, BUS_MAX_STEER)
  // A non-finite phase parks the clock at NaN; nothing derived from it may
  // reach the DOM, so the road stands still instead.
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const open = doors !== undefined
    ? Number.isFinite(doors) ? clamp(doors, 0, 1) : 0
    : busDoors(behavior, clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, -BUS_MAX_STEER, BUS_MAX_STEER) * 10) / 10
      setHeld(bounded)
      onSteerChange?.(bounded)
    },
    [onSteerChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * BUS_MAX_STEER),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const rack = ackermann(rackAngle, { wheelbase: WHEELBASE, track: TRACK })
  // The trailer lags the turn, so its heading is the articulation to port of
  // the tractor's — which is what throws the tail out on the outside.
  const bend = articulated
    ? -hitchAngle(
        rackAngle,
        { wheelbase: WHEELBASE, track: TRACK, hitch: DRIVE_AXLE - PIVOT },
        PIVOT - TRAILER_AXLE,
      )
    : 0

  const camera = robotCamera(view)
  const kneel = open * KNEEL_DROP
  const heel = open * KNEEL_ROLL
  // How far the road has gone by. A bus standing at a stop does not roll, so
  // the wheels are stopped by the same number that opens the doors.
  const travel = clock * busRoadSpeed(behavior) * (1 - open)
  const spin = (travel / WHEEL_RADIUS) * (180 / Math.PI)

  /** A drawing point on the tractor: kneeled, then rolled toward the kerb. */
  const body = React.useCallback(
    (point: Vec2, depth: number): Vec3 =>
      rollPoint({ x: point.x, y: point.y - kneel }, depth, heel, FLOOR),
    [kneel, heel],
  )
  const bendRad = toRadians(bend)
  const cosBend = Math.cos(bendRad)
  const sinBend = Math.sin(bendRad)
  /** The same, then yawed about the turntable: the rear section. */
  const towed = React.useCallback(
    (point: Vec2, depth: number): Vec3 => {
      const base = rollPoint({ x: point.x, y: point.y - kneel }, depth, heel, FLOOR)
      const dz = base.z + PIVOT
      return {
        x: base.x * cosBend + dz * sinBend,
        y: base.y,
        z: -PIVOT - base.x * sinBend + dz * cosBend,
      }
    },
    [kneel, heel, cosBend, sinBend],
  )

  /**
   * The frame has to hold the rear section where the articulation puts it, or
   * the plan view clips the tail off the moment the bus turns.
   */
  const frame = fitTransform(
    [
      ...ENVELOPE,
      ...(articulated
        ? [
            { x: TAIL, y: 0 },
            { x: TAIL, y: ROOF + 4 },
            { x: PIVOT, y: 0 },
            { x: PIVOT, y: ROOF + 4 },
          ].flatMap((point) => [towed(point, BEAM), towed(point, -BEAM)])
        : []),
    ],
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
  )

  const draft = (place: (point: Vec2, depth: number) => Vec3) => ({
    solid: (outline: Vec2[], beam: (point: Vec2) => number, offset = 0) =>
      slabPath(
        outline.flatMap((point) => [
          place(point, offset + beam(point)),
          place(point, offset - beam(point)),
        ]),
        camera,
      ),
    /** A flat panel standing across the machine: a screen, a blind, a bumper. */
    panel: (points: Vec2[], from: number, to: number) =>
      slabPath(points.flatMap((point) => [place(point, from), place(point, to)]), camera),
    face: (points: Vec2[], depth: (point: Vec2) => number, close = false) =>
      `${points
        .map((point, index) => {
          const corner = place(point, depth(point))
          const screen = camera.project(corner.x, corner.y, corner.z)
          return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
        })
        .join(" ")}${close ? " Z" : ""}`,
    across: (point: Vec2, from: number, to: number) => {
      const a = place(point, from)
      const b = place(point, to)
      const start = camera.project(a.x, a.y, a.z)
      const end = camera.project(b.x, b.y, b.z)
      return `M ${px(start.x)} ${px(start.y)} L ${px(end.x)} ${px(end.y)}`
    },
  })
  const front = draft(body)
  const rear = draft(towed)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const serving = active ?? open > 0.05
  const readout = Math.round(rackAngle)

  const wheels = [
    { name: "front-left", axle: FRONT_AXLE, side: -HALF_TRACK, angle: rack.left, place: body },
    { name: "front-right", axle: FRONT_AXLE, side: HALF_TRACK, angle: rack.right, place: body },
    { name: "drive-left", axle: DRIVE_AXLE, side: -HALF_TRACK, angle: 0, place: body },
    { name: "drive-right", axle: DRIVE_AXLE, side: HALF_TRACK, angle: 0, place: body },
    ...(articulated
      ? [
          { name: "trailer-left", axle: TRAILER_AXLE, side: -HALF_TRACK, angle: 0, place: towed },
          { name: "trailer-right", axle: TRAILER_AXLE, side: HALF_TRACK, angle: 0, place: towed },
        ]
      : []),
  ].map((entry) => {
    // The wheel stands on the road, so it takes the section's yaw but not its
    // kneel: the body comes down to it.
    const hub = entry.place({ x: entry.axle, y: WHEEL_RADIUS + kneel }, entry.side)
    const yaw = entry.place === towed ? bend : 0
    return {
      ...entry,
      hub,
      yaw,
      depth: camera.depth(hub.x, hub.y, hub.z),
      tyre: slabPath(
        wheelSolid(hub, WHEEL_RADIUS, WHEEL_HALF_WIDTH, entry.angle + yaw, 18),
        camera,
      ),
      rim: slabPath(
        wheelSolid(hub, WHEEL_RADIUS * 0.6, WHEEL_HALF_WIDTH + 0.5, entry.angle + yaw, 12),
        camera,
      ),
    }
  })
  const bodyDepth = camera.depth(0, FLOOR, -PIVOT)

  /** A point on a wheel's rim, in its own steered plane, so the nuts turn. */
  const rimPoint = (hub: Vec3, radius: number, degrees: number, angle: number) => {
    const turn = toRadians(angle)
    const along = toRadians(degrees)
    const corner = {
      x: hub.x + Math.sin(turn) * Math.cos(along) * radius,
      y: hub.y + Math.sin(along) * radius,
      z: hub.z - Math.cos(turn) * Math.cos(along) * radius,
    }
    return camera.project(corner.x, corner.y, corner.z)
  }

  const wheel = (entry: (typeof wheels)[number]) => (
    <g key={entry.name} data-wheel={entry.name} data-angle={px(entry.angle)}>
      <path d={entry.tyre} {...cast} />
      <path d={entry.rim} {...machined} />
      {[0, 90, 180, 270].map((offset) => {
        const at = rimPoint(entry.hub, WHEEL_RADIUS * 0.36, spin + offset, entry.angle + entry.yaw)
        const to = rimPoint(entry.hub, WHEEL_RADIUS * 0.52, spin + offset, entry.angle + entry.yaw)
        return (
          <path
            key={offset}
            d={`M ${px(at.x)} ${px(at.y)} L ${px(to.x)} ${px(to.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={0.6}
          />
        )
      })}
    </g>
  )

  /**
   * A plug door: the leaves stand off the side, then part inside the aperture.
   * The aperture is the dark recess, the leaves are the two thin panels on the
   * face of it, and they are glazed above the waist like the rest of the side.
   */
  const door = (place: typeof front, name: string, at: number, half: number) => {
    const stand = beamAt({ x: at, y: SILL }) + open * 3
    const slide = open * (half - 1)
    return (
      <g key={name} data-door={name} data-open={px(open)}>
        <path
          d={place.face(
            [
              { x: at - half, y: FLOOR - 1 },
              { x: at + half, y: FLOOR - 1 },
              { x: at + half, y: HEAD },
              { x: at - half, y: HEAD },
            ],
            (point) => beamAt(point) + 0.3,
            true,
          )}
          fill={palette.dark}
          opacity={0.62}
        />
        {[-1, 1].map((leaf) => (
          <g key={leaf}>
            <path
              data-leaf={`${name}-${leaf < 0 ? "aft" : "fore"}`}
              d={place.solid(
                [
                  { x: at + leaf * slide, y: FLOOR - 1 },
                  { x: at + leaf * (slide + half), y: FLOOR - 1 },
                  { x: at + leaf * (slide + half), y: HEAD },
                  { x: at + leaf * slide, y: HEAD },
                ],
                () => 0.9,
                stand,
              )}
              {...machined}
            />
            <path
              d={place.face(
                [
                  { x: at + leaf * (slide + 1.6), y: SILL },
                  { x: at + leaf * (slide + half - 1.6), y: SILL },
                  { x: at + leaf * (slide + half - 1.6), y: HEAD - 2 },
                  { x: at + leaf * (slide + 1.6), y: HEAD - 2 },
                ],
                () => stand + 1.2,
                true,
              )}
              fill={palette.dark}
              opacity={0.5}
            />
            <path
              d={place.face(
                [
                  { x: at + leaf * slide, y: FLOOR },
                  { x: at + leaf * slide, y: HEAD - 1 },
                ],
                () => stand + 1.2,
              )}
              fill="none"
              stroke={serving ? palette.accent : palette.metal}
              strokeWidth={1.4}
              opacity={serving ? 0.9 : 0.5}
            />
          </g>
        ))}
      </g>
    )
  }

  /** The glazing on one section: a row of bays with the pillars between them. */
  const glazing = (
    place: typeof front,
    name: string,
    from: number,
    to: number,
    gaps: Array<[number, number]>,
  ) => (
    <g key={name} data-glazing={name}>
      {windowBays(from, to, gaps).map(([start, end]) => (
        <path
          key={start}
          d={place.face(
            [
              { x: start, y: SILL },
              { x: end, y: SILL },
              { x: end, y: HEAD - 1 },
              { x: start, y: HEAD - 1 },
            ],
            (point) => beamAt(point) + 0.4,
            true,
          )}
          fill={palette.dark}
          opacity={0.55}
        />
      ))}
    </g>
  )

  const tractorFrom = articulated ? PIVOT + 6 : TAIL
  const tractorAxles = articulated ? [DRIVE_AXLE, FRONT_AXLE] : [TRAILER_AXLE, DRIVE_AXLE, FRONT_AXLE]

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `${articulated ? "Articulated" : "Rigid"} transit bus, steering ${readout} degrees, doors ${Math.round(open * 100)} percent open, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? -BUS_MAX_STEER : undefined}
      aria-valuemax={interactive ? BUS_MAX_STEER : undefined}
      aria-valuenow={interactive ? px(rackAngle) : undefined}
      aria-valuetext={interactive ? `steering ${readout} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 8 : 3, 15)
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
          <path d={`M 10 ${VIEW_HEIGHT - 18} H ${VIEW_WIDTH - 10}`} strokeDasharray="3 4" />
        </g>
      )}

      <g
        data-view={view}
        data-steer={px(rackAngle)}
        data-hitch={px(bend)}
        data-kneel={px(kneel)}
        transform={frame || undefined}
      >
        {showGround && (
          <g data-ground>
            <path
              d={slabPath(
                [
                  { x: -(HALF_TRACK + 14), y: -0.4, z: 18 },
                  { x: HALF_TRACK + 17, y: -0.4, z: 18 },
                  { x: HALF_TRACK + 17, y: -0.4, z: -266 },
                  { x: -(HALF_TRACK + 14), y: -0.4, z: -266 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.07}
            />
            {/* The kerb, and the stop it pulls up to. */}
            <path
              data-kerb
              d={slabPath(
                [
                  { x: HALF_TRACK + 17, y: 0, z: 10 },
                  { x: HALF_TRACK + 22, y: 0, z: 10 },
                  { x: HALF_TRACK + 22, y: 1.6, z: -258 },
                  { x: HALF_TRACK + 17, y: 1.6, z: -258 },
                ],
                camera,
              )}
              fill={palette.metal}
              stroke="none"
              opacity={0.55}
            />
            <path
              data-shadow
              d={slabPath(
                [
                  { x: -BEAM, y: 0.2, z: 2 },
                  { x: BEAM, y: 0.2, z: 2 },
                  { x: BEAM, y: 0.2, z: -NOSE + 4 },
                  { x: -BEAM, y: 0.2, z: -NOSE + 4 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.14}
            />
          </g>
        )}

        {wheels.filter((entry) => entry.depth <= bodyDepth).map(wheel)}

        {articulated && (
          <g data-trailer>
            <path d={rear.solid(underFloor(TAIL, PIVOT - 6), () => BEAM - 7)} {...cast} />
            {skirtRuns(TAIL, PIVOT - 6, [TRAILER_AXLE]).map((run, index) => (
              <path key={index} d={rear.solid(run, () => BEAM - 1)} {...shell} />
            ))}
            {[TRAILER_AXLE].map((axle) => (
              <path
                key={axle}
                data-arch={axle}
                d={rear.face(
                  [
                    { x: axle - ARCH_RADIUS, y: SKIRT },
                    { x: axle - ARCH_RADIUS, y: SKIRT + 13 },
                    { x: axle + ARCH_RADIUS, y: SKIRT + 13 },
                    { x: axle + ARCH_RADIUS, y: SKIRT },
                  ],
                  () => BEAM - 0.6,
                )}
                fill="none"
                stroke={shell.stroke}
                strokeWidth={1.1}
              />
            ))}
            <path d={rear.solid(section(TAIL, PIVOT - 6, 5), beamAt)} {...shell} />
            {glazing(rear, "trailer", TAIL + 6, PIVOT - 12, [[46, 66]])}
            {door(rear, "rear", 56, 10)}
            <path
              data-vent
              d={rear.face(
                [
                  { x: TAIL + 5, y: SILL - 9 },
                  { x: TAIL + 26, y: SILL - 9 },
                  { x: TAIL + 26, y: SILL - 3 },
                  { x: TAIL + 5, y: SILL - 3 },
                ],
                (point) => beamAt(point) + 0.4,
                true,
              )}
              fill={palette.dark}
              opacity={0.4}
            />
            {/* The back of the bus: a lamp cluster either side of the panel. */}
            {[-1, 1].map((side) => (
              <path
                key={side}
                data-lamp={side < 0 ? "rear-left" : "rear-right"}
                d={rear.panel(
                  [
                    { x: TAIL + 0.5, y: 18 },
                    { x: TAIL + 0.5, y: 28 },
                  ],
                  side * 9,
                  side * (BEAM - 4),
                )}
                fill={serving ? palette.accent : palette.metal}
                opacity={serving ? 0.85 : 0.6}
              />
            ))}
            <path
              data-engine
              d={rear.solid(
                [
                  { x: TAIL + 2, y: ROOF },
                  { x: TAIL + 30, y: ROOF },
                  { x: TAIL + 30, y: ROOF + 4 },
                  { x: TAIL + 2, y: ROOF + 4 },
                ],
                () => BEAM - 7,
              )}
              {...machined}
            />
          </g>
        )}

        <g data-tractor>
          <path d={front.solid(underFloor(tractorFrom, NOSE), () => BEAM - 7)} {...cast} />
          {skirtRuns(tractorFrom, NOSE, tractorAxles).map((run, index) => (
            <path key={index} d={front.solid(run, () => BEAM - 1)} {...shell} />
          ))}
          {tractorAxles.map((axle) => (
            <path
              key={axle}
              data-arch={axle}
              d={front.face(
                [
                  { x: axle - ARCH_RADIUS, y: SKIRT },
                  { x: axle - ARCH_RADIUS, y: SKIRT + 13 },
                  { x: axle + ARCH_RADIUS, y: SKIRT + 13 },
                  { x: axle + ARCH_RADIUS, y: SKIRT },
                ],
                () => BEAM - 0.6,
              )}
              fill="none"
              stroke={shell.stroke}
              strokeWidth={1.1}
            />
          ))}
          <path d={front.solid(cabEnd(tractorFrom), beamAt)} {...shell} />
          {glazing(
            front,
            "tractor",
            tractorFrom + 6,
            NOSE - 26,
            articulated ? [[146, 168], [225, 243]] : [[46, 66], [146, 168], [225, 243]],
          )}
          {/* The screen, raked back over the driver, and the blind above it. */}
          <path
            data-screen
            d={front.panel(
              [
                { x: NOSE - 3, y: SILL - 3 },
                { x: NOSE - NOSE_RAKE, y: HEAD + 1 },
              ],
              -(BEAM - 2.5),
              BEAM - 2.5,
            )}
            fill={palette.dark}
            opacity={0.85}
          />
          <path
            data-sign
            d={front.panel(
              [
                { x: NOSE - NOSE_RAKE - 1, y: HEAD + 1 },
                { x: NOSE - NOSE_RAKE - 1, y: ROOF - 2 },
              ],
              -(BEAM - 6),
              BEAM - 6,
            )}
            fill={serving ? palette.accent : palette.metal}
            opacity={serving ? 0.9 : 0.55}
          />
          {/* The front face: a bumper across, and a lamp at each corner. */}
          <path
            data-bumper
            d={front.solid(
              [
                { x: NOSE - 7, y: FLOOR - 3 },
                { x: NOSE - 1, y: FLOOR - 1 },
                { x: NOSE - 1, y: FLOOR + 5 },
                { x: NOSE - 7, y: FLOOR + 5 },
              ],
              () => BEAM - 3,
            )}
            {...cast}
          />
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-lamp={side < 0 ? "front-left" : "front-right"}
              d={front.panel(
                [
                  { x: NOSE - 1, y: FLOOR + 5 },
                  { x: NOSE - 1, y: FLOOR + 11 },
                ],
                side * (BEAM - 12),
                side * (BEAM - 4),
              )}
              fill={palette.accent}
              opacity={serving ? 0.95 : 0.6}
            />
          ))}
          {/* Mirrors, on arms either side of the screen. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-mirror={side < 0 ? "left" : "right"}
              d={front.solid(
                [
                  { x: NOSE - 15, y: HEAD - 11 },
                  { x: NOSE - 10, y: HEAD - 11 },
                  { x: NOSE - 10, y: HEAD - 4 },
                  { x: NOSE - 15, y: HEAD - 4 },
                ],
                () => 1.4,
                side * (BEAM + 3),
              )}
              {...cast}
            />
          ))}
          {door(front, "centre", 157, 11)}
          {door(front, "front", 234, 9)}
          {/* Roof kit: the pods a low-floor bus has to put up there. */}
          {[PIVOT + 46, PIVOT + 92].map((at) => (
            <path
              key={at}
              data-pod={at}
              d={front.solid(
                [
                  { x: at - 18, y: ROOF - 1 },
                  { x: at + 18, y: ROOF - 1 },
                  { x: at + 16, y: ROOF + 4 },
                  { x: at - 16, y: ROOF + 4 },
                ],
                () => BEAM - 7,
              )}
              {...machined}
            />
          ))}
        </g>

        {articulated && (
          <g data-bellows>
            {/* The concertina, drawn last because it is the nearest thing in
                the gap: a dark sleeve, and ribs that belong half to each
                section, so the fold opens on the outside of the bend. */}
            <path
              d={front.solid(
                [
                  { x: PIVOT, y: SKIRT + 1 },
                  { x: PIVOT + 6.5, y: SKIRT + 1 },
                  { x: PIVOT + 6.5, y: ROOF - 2 },
                  { x: PIVOT, y: ROOF - 2 },
                ],
                () => BEAM - 2,
              )}
              {...cast}
            />
            <path
              d={rear.solid(
                [
                  { x: PIVOT - 6.5, y: SKIRT + 1 },
                  { x: PIVOT, y: SKIRT + 1 },
                  { x: PIVOT, y: ROOF - 2 },
                  { x: PIVOT - 6.5, y: ROOF - 2 },
                ],
                () => BEAM - 2,
              )}
              {...cast}
            />
            {/* One rib per fold. Each belongs to the section it is nearer, so
                the concertina opens on the outside of a bend and closes on the
                inside without anything being told to. */}
            {[5.5, 3.5, 1.5, -1.5, -3.5, -5.5].map((offset) => {
              const place = offset > 0 ? front : rear
              return (
                <path
                  key={offset}
                  data-rib={offset}
                  d={place.solid(
                    [
                      { x: PIVOT + offset - 0.5, y: SKIRT + 8 },
                      { x: PIVOT + offset + 0.5, y: SKIRT + 8 },
                      { x: PIVOT + offset + 0.5, y: ROOF - 1 },
                      { x: PIVOT + offset - 0.5, y: ROOF - 1 },
                    ],
                    () => BEAM - 0.4,
                  )}
                  {...machined}
                />
              )
            })}
          </g>
        )}

        {wheels.filter((entry) => entry.depth > bodyDepth).map(wheel)}
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

/** The steering the bus is asking for at `clock`: a route, or a stop. */
export function busSteer(behavior: TransitBusBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  if (behavior === "service") {
    // Pulling in, then away from the kerb: one corner each way, and straight
    // while it is standing.
    return Math.sin(t) * 26 * Math.max(0, Math.cos(t * 0.5))
  }
  return Math.sin(t) * 18 + Math.sin(t * 0.41) * 9
}

/** How far the doors are open at `clock`, 0 to 1. Only service opens them. */
export function busDoors(behavior: TransitBusBehavior, clock: number): number {
  if (behavior !== "service" || !Number.isFinite(clock)) return 0
  // Shut, open, stand, shut — the doors are the slow part of a stop.
  const cycle = ((clock * 0.5) % 1 + 1) % 1
  if (cycle < 0.3) return 0
  if (cycle < 0.42) return (cycle - 0.3) / 0.12
  if (cycle < 0.72) return 1
  if (cycle < 0.84) return 1 - (cycle - 0.72) / 0.12
  return 0
}

/**
 * How fast the road goes by, in drawing units per second, before the doors
 * take it away. The wheels are driven off this, so a bus at a stop with its
 * doors open is stopped rather than rolling on the spot.
 */
export function busRoadSpeed(behavior: TransitBusBehavior): number {
  switch (behavior) {
    case "service":
      return 26
    case "static":
      return 0
    default:
      return 44
  }
}

export { TransitBus }
