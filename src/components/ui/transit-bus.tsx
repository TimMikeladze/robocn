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
 * kneels to open. The doors' own number lowers the body and rolls it toward the
 * kerb.
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
const VIEW_HEIGHT = 150
const NATIVE_VIEW: RobotView = "profile"

/** The bus in its own profile: ground at y = 0, nose toward +x. */
const NOSE = 252
const TAIL = -4
const PIVOT = 89
const FRONT_AXLE = 224
const DRIVE_AXLE = 118
const TRAILER_AXLE = 32
const WHEELBASE = FRONT_AXLE - DRIVE_AXLE
const TRACK = 60
const HALF_TRACK = TRACK / 2
const WHEEL_RADIUS = 17
const WHEEL_HALF_WIDTH = 7
const FLOOR = 15
const ROOF = 78
/** How far the body drops, and how far it rolls, with the doors fully open. */
const KNEEL_DROP = 5
const KNEEL_ROLL = 2.4
/** Degrees of rack per second while it eases back into a behaviour. */
const RACK_RATE = 34
const BUS_MAX_STEER = 42

const ENVELOPE = boxCorners(
  { x: -46, y: -4, z: -264 },
  { x: 46, y: 92, z: 16 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Half-beam at a height: a bus tumblehomes in at the sill and the roof. */
const beamAt = (y: number) =>
  30 - Math.max(0, 26 - y) * 0.16 - Math.max(0, y - 66) * 0.22

/** One section's profile outline, from its tail to its nose. */
const section = (from: number, to: number, rake: number): Vec2[] => [
  { x: from, y: FLOOR },
  { x: from, y: ROOF - rake },
  { x: from + rake, y: ROOF },
  { x: to - rake, y: ROOF },
  { x: to, y: ROOF - rake },
  { x: to, y: FLOOR },
]

export type TransitBusBehavior = "route" | "service" | "static"

export interface TransitBusProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Front-axle steering in degrees, positive to starboard. Supplying it stops the loop. */
  steer?: number
  onSteerChange?: (steer: number) => void
  /** Doors, 0 shut to 1 open. The bus kneels on the same number. */
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
  const open = doors !== undefined
    ? Number.isFinite(doors) ? clamp(doors, 0, 1) : 0
    : busDoors(behavior, Number.isFinite(motion.clock) ? motion.clock : 0)

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
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const kneel = open * KNEEL_DROP
  const heel = open * KNEEL_ROLL

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

  const draft = (place: (point: Vec2, depth: number) => Vec3) => ({
    solid: (outline: Vec2[], beam: (y: number) => number, offset = 0) =>
      slabPath(
        outline.flatMap((point) => [
          place(point, offset + beam(point.y)),
          place(point, offset - beam(point.y)),
        ]),
        camera,
      ),
    face: (points: Vec2[], depth: (y: number) => number, close = false) =>
      `${points
        .map((point, index) => {
          const corner = place(point, depth(point.y))
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
      depth: camera.depth(hub.x, hub.y, hub.z),
      rim: slabPath(
        wheelSolid(hub, WHEEL_RADIUS, WHEEL_HALF_WIDTH, entry.angle + yaw, 16),
        camera,
      ),
      cap: slabPath(
        wheelSolid(hub, WHEEL_RADIUS * 0.42, WHEEL_HALF_WIDTH + 0.6, entry.angle + yaw, 10),
        camera,
      ),
    }
  })
  const bodyDepth = camera.depth(0, FLOOR, -PIVOT)

  /** A plug door: the leaves stand off the side, then part inside the aperture. */
  const door = (
    place: typeof front,
    name: string,
    at: number,
    half: number,
  ) => {
    const stand = beamAt(40) + open * 4.5
    const slide = open * (half - 1.5)
    return (
      <g key={name} data-door={name} data-open={px(open)}>
        <path
          d={place.face(
            [
              { x: at - half, y: FLOOR + 3 },
              { x: at + half, y: FLOOR + 3 },
              { x: at + half, y: 66 },
              { x: at - half, y: 66 },
            ],
            () => beamAt(40) + 0.3,
            true,
          )}
          fill={palette.dark}
          opacity={0.5}
        />
        {[-1, 1].map((leaf) => (
          <path
            key={leaf}
            data-leaf={`${name}-${leaf < 0 ? "aft" : "fore"}`}
            d={place.solid(
              [
                { x: at + leaf * slide, y: FLOOR + 3 },
                { x: at + leaf * (slide + half), y: FLOOR + 3 },
                { x: at + leaf * (slide + half), y: 66 },
                { x: at + leaf * slide, y: 66 },
              ],
              () => 1.2,
              stand,
            )}
            {...machined}
          />
        ))}
      </g>
    )
  }

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
          <path d={`M 10 ${VIEW_HEIGHT - 22} H ${VIEW_WIDTH - 10}`} strokeDasharray="3 4" />
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
          <path
            data-kerb
            d={(() => {
              const a = camera.project(HALF_TRACK + 14, 0, 20)
              const b = camera.project(HALF_TRACK + 14, 0, -NOSE - 20)
              return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
            })()}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            opacity={0.4}
          />
        )}

        {wheels.filter((entry) => entry.depth <= bodyDepth).map((entry) => (
          <g key={entry.name} data-wheel={entry.name} data-angle={px(entry.angle)}>
            <path d={entry.rim} {...cast} />
            <path d={entry.cap} {...machined} />
          </g>
        ))}

        {articulated && (
          <g data-trailer>
            <path d={rear.solid(section(TAIL, PIVOT - 6, 8), beamAt)} {...shell} />
            <path
              data-glazing="trailer"
              d={rear.face(
                [
                  { x: TAIL + 8, y: 46 },
                  { x: PIVOT - 14, y: 46 },
                  { x: PIVOT - 14, y: 68 },
                  { x: TAIL + 8, y: 68 },
                ],
                (y) => beamAt(y) + 0.4,
                true,
              )}
              fill={palette.dark}
              opacity={0.55}
            />
            <path
              d={rear.across({ x: TAIL + 2, y: 36 }, -(beamAt(36) - 5), beamAt(36) - 5)}
              fill="none"
              stroke={serving ? palette.shell : palette.metal}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {door(rear, "rear", 28, 11)}
          </g>
        )}

        <g data-tractor>
          <path
            d={front.solid(section(articulated ? PIVOT + 6 : TAIL, NOSE, 8), beamAt)}
            {...shell}
          />
          <path
            data-glazing="tractor"
            d={front.face(
              [
                { x: (articulated ? PIVOT : TAIL) + 16, y: 46 },
                { x: NOSE - 34, y: 46 },
                { x: NOSE - 34, y: 68 },
                { x: (articulated ? PIVOT : TAIL) + 16, y: 68 },
              ],
              (y) => beamAt(y) + 0.4,
              true,
            )}
            fill={palette.dark}
            opacity={0.55}
          />
          {/* The screen, raked back over the driver. */}
          <path
            data-screen
            d={front.face(
              [
                { x: NOSE - 28, y: 42 },
                { x: NOSE - 3, y: 46 },
                { x: NOSE - 3, y: 70 },
                { x: NOSE - 28, y: 70 },
              ],
              (y) => beamAt(y) + 0.4,
              true,
            )}
            fill={palette.dark}
            opacity={0.62}
          />
          <path
            data-sign
            d={front.across({ x: NOSE - 14, y: 74 }, -(beamAt(74) - 6), beamAt(74) - 6)}
            fill="none"
            stroke={serving ? palette.accent : palette.metal}
            strokeWidth={4}
            strokeLinecap="butt"
          />
          <path
            data-lamp="front"
            d={front.across({ x: NOSE - 1, y: 26 }, -(beamAt(26) - 5), beamAt(26) - 5)}
            fill="none"
            stroke={palette.accent}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={serving ? 1 : 0.55}
          />
          {/* Roof kit: the pods a low-floor bus has to put up there. */}
          {[PIVOT + 32, PIVOT + 74].map((at) => (
            <path
              key={at}
              data-pod={at}
              d={front.solid(
                [
                  { x: at - 16, y: ROOF },
                  { x: at + 16, y: ROOF },
                  { x: at + 16, y: ROOF + 7 },
                  { x: at - 16, y: ROOF + 7 },
                ],
                () => beamAt(70) - 4,
              )}
              {...machined}
            />
          ))}
          <path
            d={front.face(
              [
                { x: (articulated ? PIVOT : TAIL) + 10, y: 24 },
                { x: NOSE - 8, y: 24 },
              ],
              (y) => beamAt(y) + 0.4,
            )}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.8}
            opacity={0.5}
          />
          {door(front, "front", NOSE - 44, 10)}
          {door(front, "centre", PIVOT + 44, 11)}
        </g>


        {articulated && (
          <g data-bellows>
            {/* The concertina, drawn last because it is the nearest thing in
                the gap: a dark sleeve, and ribs that belong half to each
                section, so the fold opens on the outside of the bend. */}
            <path
              d={front.solid(
                [
                  { x: PIVOT + 6, y: FLOOR + 1 },
                  { x: PIVOT + 6, y: ROOF - 3 },
                ],
                () => beamAt(46) - 2,
              )}
              {...cast}
            />
            <path
              d={rear.solid(
                [
                  { x: PIVOT - 6, y: FLOOR + 1 },
                  { x: PIVOT - 6, y: ROOF - 3 },
                ],
                () => beamAt(46) - 2,
              )}
              {...cast}
            />
            {[5, 2.5, 0, -2.5, -5].map((offset) => {
              const place = offset > 0 ? front : rear
              return (
                <path
                  key={offset}
                  d={place.solid(
                    [
                      { x: PIVOT + offset, y: FLOOR + 1 },
                      { x: PIVOT + offset, y: ROOF - 3 },
                    ],
                    () => beamAt(46) - 1.4,
                  )}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={1.6}
                  opacity={0.75}
                />
              )
            })}
          </g>
        )}

        {wheels.filter((entry) => entry.depth > bodyDepth).map((entry) => (
          <g key={entry.name} data-wheel={entry.name} data-angle={px(entry.angle)}>
            <path d={entry.rim} {...cast} />
            <path d={entry.cap} {...machined} />
          </g>
        ))}
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

export { TransitBus }
