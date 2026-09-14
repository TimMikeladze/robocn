"use client"

/**
 * tanker-truck — a tractor unit and a road tanker on one kingpin.
 *
 * The articulation is the mechanism. `steer` turns the front axle, `ackermann()`
 * answers with the two wheel angles, and `hitchAngle()` *solves* what the
 * trailer does about it: the kingpin rides a circle of its own and the bogie
 * cannot slide sideways, so the angle between the units is fixed by the turn
 * rather than chosen. That is why the trailer off-tracks inside the tractor's
 * line, and why coming out of a turn leaves the truck straight. Supplying
 * `hitch` overrides the solution and pins the trailer where you want it.
 *
 * The yaw is real: a rotation about the kingpin's vertical axis in world
 * space, not a rotation of the drawing. So the barrel foreshortens in side
 * elevation as it jackknifes, swings properly in plan, and the bogie goes with
 * it instead of staying behind.
 *
 * Compartments empty from the rear, which is the order a road tanker actually
 * discharges in, and each one's contents are read off the cabinet gauges rather
 * than drawn through the shell of an opaque barrel.
 *
 * Refit note: docs/vehicle-refit.md. No suspension, mass, load transfer or
 * fluid is computed; the articulation is the steady state, not an integrated
 * manoeuvre, and nothing here accumulates where it has driven.
 */

import * as React from "react"

import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
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
import { ackermann, hitchAngle, rollPoint, wheelSolid } from "@/lib/robocn/vehicle"
import { cn } from "@/lib/utils"

export type TankerTruckBehavior = "haul" | "discharge" | "manoeuvre" | "static"

const VIEW_WIDTH = 310
const VIEW_HEIGHT = 150
const NATIVE_VIEW: RobotView = "profile"

/**
 * The truck in its own profile: ground at y = 0, nose toward +x. 16.5 m over
 * 300 units, so a unit is 55 mm and the stations below are real ones.
 */
const NOSE = 300
const STEER_AXLE = 278
const DRIVE_AXLES = [216, 192]
const KINGPIN = 218
const TRAILER_AXLES = [80, 56]
const TAIL = 12

const DRIVE_CENTRE = (DRIVE_AXLES[0] + DRIVE_AXLES[1]) / 2
const BOGIE_CENTRE = (TRAILER_AXLES[0] + TRAILER_AXLES[1]) / 2
const WHEELBASE = STEER_AXLE - DRIVE_CENTRE
const TRAILER_WHEELBASE = KINGPIN - BOGIE_CENTRE

const TRACK = 37
const HALF_TRACK = TRACK / 2
const WHEEL_RADIUS = 10
/** A single steer tyre, and one half of a dual. */
const TYRE_HALF = 3
/** How far apart the two tyres of a dual sit, centre to centre. */
const DUAL_GAP = 7

/** Heights: chassis rail, fifth wheel, deck, cab roof. */
const RAIL = 26
const DECK = 31
const CAB_ROOF = 70
const BARREL_Y = 50
const BARREL_R = 21
const BARREL_FRONT = 236
const BARREL_BACK = 22

/** Half-beam of the widest thing on the truck: 2.55 m over 300 units. */
const BEAM = 23
const MAX_HITCH = 60
/**
 * Past about this much rack there is no steady articulation to solve for at
 * all: the kingpin's circle closes inside the trailer's own wheelbase and the
 * truck is jackknifed. A supplied `hitch` can still be pinned anywhere.
 */
const MAX_TRUCK_STEER = 26

const ENVELOPE = boxCorners({ x: -34, y: -3, z: -306 }, { x: 34, y: 88, z: 6 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The barrel in side elevation: a long cylinder with dished ends. Its beam is
 * the *circle* at that height, so the same outline is a capsule in profile, a
 * disc from the front and a rounded slab in plan — one solid, three cameras.
 */
const barrelOutline = (): Vec2[] => {
  const points: Vec2[] = []
  for (let index = 0; index <= 10; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / 10
    points.push({
      x: BARREL_FRONT - 8 + Math.cos(angle) * 8,
      y: BARREL_Y + Math.sin(angle) * BARREL_R,
    })
  }
  for (let index = 0; index <= 10; index += 1) {
    const angle = Math.PI / 2 + (Math.PI * index) / 10
    points.push({
      x: BARREL_BACK + 8 + Math.cos(angle) * 8,
      y: BARREL_Y + Math.sin(angle) * BARREL_R,
    })
  }
  return points
}
const BARREL = barrelOutline()
const barrelBeam = (point: Vec2) =>
  Math.sqrt(Math.max(0, BARREL_R * BARREL_R - (point.y - BARREL_Y) ** 2))

/** The cab: a flat-fronted sleeper over the front axle. */
const CAB: Vec2[] = [
  { x: 240, y: RAIL - 2 },
  { x: 240, y: CAB_ROOF },
  { x: 294, y: CAB_ROOF },
  { x: NOSE, y: CAB_ROOF - 8 },
  { x: NOSE, y: DECK - 2 },
  { x: 292, y: RAIL - 4 },
]
/** The roof fairing that closes the gap between the cab and the barrel. */
const FAIRING: Vec2[] = [
  { x: 242, y: CAB_ROOF - 2 },
  { x: 292, y: CAB_ROOF - 2 },
  { x: 288, y: CAB_ROOF + 6 },
  { x: 244, y: CAB_ROOF + 11 },
]
const cabBeam = (point: Vec2) => BEAM - Math.max(0, point.y - (CAB_ROOF - 10)) * 0.35

export interface TankerTruckProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled cargo, 0 empty to 1 full. Supplying it stops the loop. */
  level?: number
  onLevelChange?: (level: number) => void
  behavior?: TankerTruckBehavior
  /** Bulkheaded compartments, which empty from the rear. */
  compartments?: number
  /**
   * Front-axle steering in degrees, positive to starboard, clamped to ±26 —
   * past that the kingpin's circle closes inside the trailer's wheelbase and
   * there is no steady articulation to solve for.
   */
  steer?: number
  /**
   * Trailer yaw about the kingpin, in degrees. Omit and it is solved from the
   * steer; supply it and the solution is overridden.
   */
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
  steer,
  hitch,
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
  // A non-finite phase parks the clock at NaN; nothing derived from it may
  // reach the DOM, so the road stands still instead.
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0

  // One steering number for the tractor, and the trailer's own angle solved
  // off it — unless a caller pins the hitch, which the demo and the tests do.
  const rackAngle = steer !== undefined
    ? Number.isFinite(steer) ? clamp(steer, -MAX_TRUCK_STEER, MAX_TRUCK_STEER) : 0
    : tankerTruckSteer(behavior, clock)
  const rack = ackermann(rackAngle, { wheelbase: WHEELBASE, track: TRACK })
  const solved = -hitchAngle(
    rackAngle,
    { wheelbase: WHEELBASE, track: TRACK, hitch: DRIVE_CENTRE - KINGPIN },
    TRAILER_WHEELBASE,
  )
  const yaw = hitch !== undefined
    ? Number.isFinite(hitch) ? clamp(hitch, -MAX_HITCH, MAX_HITCH) : 0
    : clamp(solved, -MAX_HITCH, MAX_HITCH)

  const camera = robotCamera(view)
  const travel = clock * tankerTruckRoadSpeed(behavior)
  const spin = (travel / WHEEL_RADIUS) * (180 / Math.PI)

  /** A drawing point on the tractor. Nothing rolls; the road here is flat. */
  const unit = (point: Vec2, depth: number): Vec3 => rollPoint(point, depth, 0, DECK)
  const turn = toRadians(yaw)
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  /** The same, then yawed about the kingpin: everything aft of the fifth wheel. */
  const towed = (point: Vec2, depth: number): Vec3 => {
    const base = rollPoint(point, depth, 0, DECK)
    const dz = base.z + KINGPIN
    return {
      x: base.x * cos + dz * sin,
      y: base.y,
      z: -KINGPIN - base.x * sin + dz * cos,
    }
  }

  /**
   * The frame has to hold the trailer where it actually is. A semi at forty
   * degrees of articulation puts its tail nearly seven metres off the tractor's
   * line, so a fixed envelope clips it in plan the moment it turns; the swung
   * corners go into the fit and the camera pulls back only when it has to.
   */
  const frame = fitTransform(
    [
      ...ENVELOPE,
      ...[
        { x: TAIL, y: 0 },
        { x: TAIL, y: BARREL_Y + BARREL_R + 6 },
        { x: BARREL_FRONT, y: 0 },
        { x: BARREL_FRONT, y: BARREL_Y + BARREL_R + 6 },
      ].flatMap((point) => [towed(point, BEAM), towed(point, -BEAM)]),
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
    box: (x0: number, y0: number, x1: number, y1: number, half: number, offset = 0) =>
      slabPath(
        [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ].flatMap((point) => [place(point, offset + half), place(point, offset - half)]),
        camera,
      ),
    /** A flat panel standing across the machine: a screen, a grille, a bumper. */
    panel: (points: Vec2[], from: number, to: number) =>
      slabPath(points.flatMap((point) => [place(point, from), place(point, to)]), camera),
    face: (points: Vec2[], depth: number, close = false) =>
      `${points
        .map((point, index) => {
          const corner = place(point, depth)
          const screen = camera.project(corner.x, corner.y, corner.z)
          return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
        })
        .join(" ")}${close ? " Z" : ""}`,
  })
  const front = draft(unit)
  const rear = draft(towed)

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
    onDrag: React.useCallback((unitPoint: Vec2) => apply(1 - unitPoint.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /**
   * Compartments are numbered from the front, and a road tanker discharges
   * from the rear — so compartment `holds - 1` is the one that empties first
   * and the front pot is the last thing left in the barrel.
   */
  const charge = (index: number) => clamp(full * holds - index, 0, 1)
  const bulkheads = Array.from({ length: holds - 1 }, (_, index) =>
    lerp(BARREL_FRONT - 8, BARREL_BACK + 8, (index + 1) / holds),
  )
  const domes = Array.from({ length: holds }, (_, index) =>
    lerp(BARREL_FRONT - 8, BARREL_BACK + 8, (index + 0.5) / holds),
  )
  const percent = Math.round(full * 100)

  /**
   * Every wheel on the truck: which axle it is on, which unit carries it, how
   * far it is steered, and whether it is a dual. Duals are drawn as the two
   * tyres they are — nothing else makes a plan view read as a lorry.
   */
  const wheels = [
    { name: "steer-left", axle: STEER_AXLE, side: -HALF_TRACK, angle: rack.left, dual: false, place: unit },
    { name: "steer-right", axle: STEER_AXLE, side: HALF_TRACK, angle: rack.right, dual: false, place: unit },
    ...DRIVE_AXLES.flatMap((axle, index) =>
      [-1, 1].map((side) => ({
        name: `drive-${index + 1}-${side < 0 ? "left" : "right"}`,
        axle,
        side: side * HALF_TRACK,
        angle: 0,
        dual: true,
        place: unit,
      })),
    ),
    ...TRAILER_AXLES.flatMap((axle, index) =>
      [-1, 1].map((side) => ({
        name: `trailer-${index + 1}-${side < 0 ? "left" : "right"}`,
        axle,
        side: side * HALF_TRACK,
        angle: 0,
        dual: true,
        place: towed,
      })),
    ),
  ].flatMap((entry) => {
    const yawed = entry.place === towed ? yaw : 0
    const offsets = entry.dual ? [-DUAL_GAP / 2, DUAL_GAP / 2] : [0]
    return offsets.map((offset, index) => {
      const hub = entry.place({ x: entry.axle, y: WHEEL_RADIUS }, entry.side + offset)
      return {
        key: `${entry.name}:${index}`,
        name: entry.name,
        angle: entry.angle,
        hub,
        yaw: yawed,
        depth: camera.depth(hub.x, hub.y, hub.z),
        tyre: slabPath(
          wheelSolid(hub, WHEEL_RADIUS, TYRE_HALF, entry.angle + yawed, 18),
          camera,
        ),
        rim: slabPath(
          wheelSolid(hub, WHEEL_RADIUS * 0.56, TYRE_HALF + 0.4, entry.angle + yawed, 12),
          camera,
        ),
      }
    })
  })
  const bodyDepth = camera.depth(0, DECK, -KINGPIN)
  // Which unit is nearer the camera. In side elevation they are level and the
  // order does not matter; in front elevation the cab is the near one and has
  // to be drawn over a barrel that is eleven metres behind it.
  const tractorNearer =
    camera.depth(0, DECK, -(NOSE + BARREL_FRONT) / 2) >=
    camera.depth(0, DECK, -(BARREL_FRONT + BARREL_BACK) / 2)

  /** A point on a wheel's rim, in its own steered plane, so the nuts turn. */
  const rimPoint = (hub: Vec3, radius: number, degrees: number, angle: number) => {
    const steered = toRadians(angle)
    const along = toRadians(degrees)
    return camera.project(
      hub.x + Math.sin(steered) * Math.cos(along) * radius,
      hub.y + Math.sin(along) * radius,
      hub.z - Math.cos(steered) * Math.cos(along) * radius,
    )
  }

  const wheel = (entry: (typeof wheels)[number]) => (
    <g key={entry.key} data-wheel={entry.name} data-angle={px(entry.angle)}>
      <path d={entry.tyre} {...cast} />
      <path d={entry.rim} {...machined} />
      {[0, 120, 240].map((offset) => {
        const at = rimPoint(entry.hub, WHEEL_RADIUS * 0.24, spin + offset, entry.angle + entry.yaw)
        const to = rimPoint(entry.hub, WHEEL_RADIUS * 0.46, spin + offset, entry.angle + entry.yaw)
        return (
          <path
            key={offset}
            d={`M ${px(at.x)} ${px(at.y)} L ${px(to.x)} ${px(to.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.6}
          />
        )
      })}
    </g>
  )

  const tractorUnit = (
    <React.Fragment key="tractorUnit">
    {/* The tractor: chassis rail, fifth wheel, cab, fairing and stack. */}
    <g data-tractor>
      <path d={front.box(150, RAIL, 250, DECK, 14)} {...cast} />
      <path data-fifth-wheel d={front.box(198, DECK - 1, 236, DECK + 3, 15)} {...machined} />
      <path d={front.solid(CAB, cabBeam)} {...shell} />
      <path data-fairing d={front.solid(FAIRING, () => BEAM - 2)} {...shell} />
      {/* The cab side: a door, its window and the step under it, so the side
          elevation has a driver's end and not just a box. */}
      <path
        data-cab-window
        d={front.face(
          [
            { x: 256, y: 50 },
            { x: 288, y: 50 },
            { x: 288, y: CAB_ROOF - 8 },
            { x: 256, y: CAB_ROOF - 8 },
          ],
          BEAM - 1.6,
          true,
        )}
        fill={palette.dark}
        opacity={0.55}
      />
      <path
        d={front.face(
          [
            { x: 252, y: RAIL + 2 },
            { x: 252, y: CAB_ROOF - 5 },
          ],
          BEAM - 1.4,
        )}
        fill="none"
        stroke={palette.dark}
        strokeWidth={0.9}
        opacity={0.4}
      />
      <path data-step d={front.box(260, 6, 282, RAIL - 3, 3, BEAM - 4)} {...cast} />
      <path data-tank d={front.box(196, RAIL - 9, 232, RAIL - 1, 4.5, BEAM - 6)} {...machined} />
      {/* The screen, and the band of the sun visor over it. */}
      <path
        data-screen
        d={front.panel(
          [
            { x: NOSE - 1, y: 46 },
            { x: NOSE - 5, y: CAB_ROOF - 5 },
          ],
          -(BEAM - 3),
          BEAM - 3,
        )}
        fill={palette.dark}
        opacity={0.82}
      />
      <path
        data-grille
        d={front.panel(
          [
            { x: NOSE - 0.5, y: DECK + 2 },
            { x: NOSE - 0.5, y: 42 },
          ],
          -(BEAM - 6),
          BEAM - 6,
        )}
        fill={palette.dark}
        opacity={0.6}
      />
      <path
        data-bumper
        d={front.box(NOSE - 8, RAIL - 6, NOSE - 1, RAIL, BEAM - 2)}
        {...cast}
      />
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-lamp={side < 0 ? "left" : "right"}
          d={front.panel(
            [
              { x: NOSE - 0.5, y: DECK - 4 },
              { x: NOSE - 0.5, y: DECK + 1 },
            ],
            side * (BEAM - 9),
            side * (BEAM - 2),
          )}
          fill={palette.accent}
          opacity={0.9}
        />
      ))}
      {/* Mirrors, on arms either side of the screen. */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-mirror={side < 0 ? "left" : "right"}
          d={front.box(NOSE - 10, 50, NOSE - 6, 64, 1.4, side * (BEAM + 3))}
          {...cast}
        />
      ))}
      {/* The stack, behind the cab and outside the fairing. */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-stack={side < 0 ? "left" : "right"}
          d={front.box(234, RAIL, 239, CAB_ROOF + 6, 2.4, side * (BEAM - 3))}
          {...machined}
        />
      ))}
    </g>
    </React.Fragment>
  )

  const trailerUnit = (
    <React.Fragment key="trailerUnit">
    {/* The trailer: everything from here turns about the kingpin. */}
    <g data-trailer data-hitch={px(yaw)}>
      <path d={rear.box(40, RAIL + 1, 232, DECK, 15)} {...cast} />
      <path data-barrel d={rear.solid(BARREL, barrelBeam)} {...shell} />
      {/* Bulkheads, read on the barrel's own surface. */}
      {bulkheads.map((x) => (
        <path
          key={x}
          data-bulkhead={px(x)}
          d={rear.face(
            [
              { x, y: BARREL_Y - BARREL_R + 3 },
              { x, y: BARREL_Y + BARREL_R - 3 },
            ],
            BARREL_R * 0.82,
          )}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1}
          opacity={0.45}
        />
      ))}
      {/* The catwalk down the spine, and a manlid over each compartment. */}
      <path
        data-catwalk
        d={rear.box(BARREL_BACK + 6, BARREL_Y + BARREL_R - 1, BARREL_FRONT - 6, BARREL_Y + BARREL_R + 1.5, 7)}
        {...machined}
      />
      {domes.map((x, index) => (
        <g key={x} data-dome={index}>
          <path
            d={rear.box(x - 5, BARREL_Y + BARREL_R - 1, x + 5, BARREL_Y + BARREL_R + 4, 5)}
            {...machined}
          />
          <path
            d={rear.box(x - 3.4, BARREL_Y + BARREL_R + 4, x + 3.4, BARREL_Y + BARREL_R + 5.2, 3.4)}
            {...machined}
          />
          <path
            data-charged={charge(index) > 0.02 ? "true" : "false"}
            d={rear.face(
              [
                { x: x - 2.6, y: BARREL_Y + BARREL_R + 5.6 },
                { x: x + 2.6, y: BARREL_Y + BARREL_R + 5.6 },
              ],
              2.4,
            )}
            fill="none"
            stroke={charge(index) > 0.02 ? palette.accent : palette.metal}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={charge(index) > 0.02 ? 0.95 : 0.5}
          />
        </g>
      ))}
      {/* Bogie: a frame under the barrel, with a mudguard over the tyres. */}
      <path data-bogie d={rear.box(44, 14, 94, RAIL + 2, 16)} {...cast} />
      <path
        data-mudguard
        d={rear.box(TRAILER_AXLES[1] - 14, RAIL + 2, TRAILER_AXLES[0] + 14, RAIL + 5, BEAM - 2)}
        {...machined}
      />
      {/* Landing legs, down where the fifth wheel is not. */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-leg={side < 0 ? "left" : "right"}
          d={rear.box(158, 2, 164, DECK - 2, 2, side * 14)}
          {...machined}
        />
      ))}
      {/* Rear underrun bar and the tail lamps on it. */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-underrun-leg={side < 0 ? "left" : "right"}
          d={rear.box(TAIL + 1, 14, TAIL + 5, RAIL + 2, 2, side * (BEAM - 9))}
          {...cast}
        />
      ))}
      <path data-underrun d={rear.box(TAIL, 10, TAIL + 6, 16, BEAM - 3)} {...cast} />
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-lamp={side < 0 ? "rear-left" : "rear-right"}
          d={rear.panel(
            [
              { x: TAIL - 0.5, y: 10 },
              { x: TAIL - 0.5, y: 16 },
            ],
            side * (BEAM - 12),
            side * (BEAM - 4),
          )}
          fill={palette.accent}
          opacity={0.85}
        />
      ))}

      {showCabinet && (
        <g data-cabinet>
          <path d={rear.box(108, 15, 158, DECK - 1, 7, BEAM - 8)} {...cast} />
          <path data-reel d={rear.box(166, 18, 182, 30, 5, BEAM - 8)} {...machined} />
          {Array.from({ length: holds }, (_, index) => {
            const at = 113 + index * (42 / holds)
            return (
              <g key={index} data-compartment={index}>
                <path
                  d={rear.box(at, 19, at + 26 / holds, 28, 1.6, BEAM - 1.2)}
                  {...machined}
                />
                <path
                  d={rear.box(
                    at + 0.6,
                    19.6,
                    at + 26 / holds - 0.6,
                    19.6 + charge(index) * 7.8,
                    1.2,
                    BEAM - 0.8,
                  )}
                  fill={palette.accent}
                  stroke="none"
                />
              </g>
            )
          })}
        </g>
      )}
    </g>
    </React.Fragment>
  )

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
          d={`M 8 ${VIEW_HEIGHT - 18} H ${VIEW_WIDTH - 8}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} data-steer={px(rackAngle)} transform={frame || undefined}>
        {showGround && (
          <g data-ground>
            <path
              d={slabPath(
                [
                  { x: -(HALF_TRACK + 16), y: -0.4, z: 14 },
                  { x: HALF_TRACK + 16, y: -0.4, z: 14 },
                  { x: HALF_TRACK + 16, y: -0.4, z: -312 },
                  { x: -(HALF_TRACK + 16), y: -0.4, z: -312 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.07}
            />
            {Array.from({ length: 6 }, (_, index) => {
              // Dashes standing still in the world while the truck drives past.
              const at = ((index * 62 - travel) % 372 + 372) % 372 - 36
              const a = camera.project(-(HALF_TRACK + 12), -0.3, -at)
              const b = camera.project(-(HALF_TRACK + 12), -0.3, -(at + 28))
              return (
                <path
                  key={index}
                  data-lane-dash
                  d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  opacity={0.75}
                />
              )
            })}
            <path
              data-shadow
              d={slabPath(
                [
                  { x: -BEAM, y: 0.2, z: -TAIL },
                  { x: BEAM, y: 0.2, z: -TAIL },
                  { x: BEAM, y: 0.2, z: -NOSE + 4 },
                  { x: -BEAM, y: 0.2, z: -NOSE + 4 },
                ],
                camera,
              )}
              fill={palette.dark}
              opacity={0.13}
            />
          </g>
        )}

        {wheels.filter((entry) => entry.depth <= bodyDepth).map(wheel)}

        {tractorNearer ? [trailerUnit, tractorUnit] : [tractorUnit, trailerUnit]}

        {wheels.filter((entry) => entry.depth > bodyDepth).map(wheel)}

        {variant === "blueprint" && (
          <text
            x={VIEW_WIDTH / 2}
            y={16}
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
 * Cargo at `clock`. `haul` runs a full barrel down the road, `manoeuvre` runs
 * a nearly full one round a yard, and `discharge` is a delivery round — a drop,
 * a pause, another drop.
 */
export function tankerTruckLevel(behavior: TankerTruckBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.75
  const t = ((clock % 1) + 1) % 1
  if (behavior === "discharge") return clamp(1 - Math.floor(t * 4 + 1) / 4 + 0.12, 0, 1)
  if (behavior === "manoeuvre") return 0.92
  return 0.86
}

/**
 * The steering the tractor is asking for at `clock`, in degrees. Only
 * `manoeuvre` uses much of it — which is the point of it, because the hitch
 * angle is solved from this number and needs something to solve.
 */
export function tankerTruckSteer(behavior: TankerTruckBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  switch (behavior) {
    case "manoeuvre":
      // Fifteen degrees of rack is already forty of articulation on a wheelbase
      // this long; any more and there is no steady state left to draw.
      return Math.sin(t * 0.5) * 15
    case "discharge":
      return 0
    default:
      return Math.sin(t * 0.7) * 7
  }
}

/** How fast the road goes by, in drawing units per second. */
export function tankerTruckRoadSpeed(behavior: TankerTruckBehavior): number {
  switch (behavior) {
    case "manoeuvre":
      return 26
    case "discharge":
    case "static":
      return 0
    default:
      return 90
  }
}

export { TankerTruck }
