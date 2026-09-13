"use client"

/**
 * rail-locomotive — an electric locomotive and the train behind it, placed by
 * the track rather than steered along it.
 *
 * Nothing on board steers. Bend the track and every pose in the drawing is an
 * answer to it: each bogie sits on the curve and takes the tangent under its
 * own pivot, each body is the straight chord between its two pivots, and the
 * sideways throw follows — the middle of a vehicle swings *inside* the curve
 * and its ends swing *outside*, which is the whole reason a long vehicle is a
 * clearance problem. Both numbers are solved, reported on the drawing, and go
 * to zero on straight track without a special case.
 *
 * On the roof, a pantograph on the same linkage `pantograph-collector` ships
 * standalone; underneath, the bogies are the ones `rail-bogie` draws on its
 * own. The consist is the same body repeated, each vehicle placed at its own
 * arc position, so the train genuinely bends along the curve instead of being
 * drawn bent.
 *
 * No dynamics: no traction, no braking, no cant, no transition spirals, and
 * nothing travels. The curve is a steady state.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
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
  bodyOffset,
  bogieRide,
  curveRadius,
  pantographPose,
  trackCurvature,
} from "@/lib/robocn/rail"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 158
const NATIVE_VIEW: RobotView = "profile"

/** The locomotive in its own profile: rail head at y = 0, nose toward +x. */
const HALF_LENGTH = 66
const PIVOT_SPACING = 88
const FLOOR = 21
const ROOF = 64
const CAB_RAKE = 13
const HALF_BEAM = 17
const WHEEL_RADIUS = 10
const WHEEL_HALF_WIDTH = 3.4
const BOGIE_WHEELBASE = 30
const HALF_GAUGE = 11
/** Between the buffer faces of two vehicles. */
const COUPLING_GAP = 13
const MAX_CURVE = 10
/** Degrees of track turn per second while the curve eases back into a behaviour. */
const CURVE_RATE = 9
const MAX_CARS = 4

const PAN_GEOMETRY = {
  lowerArm: 30,
  upperArm: 26,
  baseHeight: ROOF + 3,
  rod: 22,
  lever: 6,
  rodAnchor: 0.45,
  designHeight: ROOF + 3 + 46,
}
const PAN_STOWED = PAN_GEOMETRY.baseHeight + 9
const PAN_RAISED = PAN_GEOMETRY.baseHeight + 46

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Half-beam at a height: the body tucks in at the solebar and at the roof. */
const beamAt = (y: number) =>
  HALF_BEAM - Math.max(0, FLOOR + 6 - y) * 0.22 - Math.max(0, y - (ROOF - 7)) * 0.34

/** One vehicle's profile outline: a body with a raked end at each cab. */
const bodyOutline = (rakeFront: number, rakeBack: number): Vec2[] => [
  { x: -HALF_LENGTH, y: FLOOR },
  { x: -HALF_LENGTH, y: ROOF - rakeBack },
  { x: -HALF_LENGTH + rakeBack, y: ROOF },
  { x: HALF_LENGTH - rakeFront, y: ROOF },
  { x: HALF_LENGTH, y: ROOF - rakeFront },
  { x: HALF_LENGTH, y: FLOOR },
]

/** An outline turned about one of its own points, in the drawing plane. */
function tiltAbout(outline: Vec2[], about: Vec2, degrees: number): Vec2[] {
  const angle = (clamp(degrees, -45, 45) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return outline.map((point) => {
    const dx = point.x - about.x
    const dy = point.y - about.y
    return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos }
  })
}

export type RailLocomotiveBehavior = "line" | "yard" | "depot" | "static"
export type RailLocomotivePantograph = "auto" | "raised" | "stowed"

export interface RailLocomotiveProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Degrees the track turns through under one bogie-centre spacing, positive
   * to starboard, clamped to ±10. Supplying it stops the loop.
   */
  curve?: number
  onCurveChange?: (curve: number) => void
  /** What the line does when `curve` is not supplied. */
  behavior?: RailLocomotiveBehavior
  /** Trailing vehicles behind the locomotive, 0–4. */
  cars?: number
  /** The roof collector: up, down, or whatever the behaviour is doing. */
  pantograph?: RailLocomotivePantograph
  view?: RobotView
  /** The rails and sleepers the train is standing on. */
  showTrack?: boolean
  /** Call out the solved centre and end throw as dimension lines. Blueprint does by default. */
  showThrow?: boolean
  /** Light the headlight and the line indicators. Omit and it lights under power. */
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

function RailLocomotive({
  curve,
  onCurveChange,
  behavior = "line",
  cars = 1,
  pantograph = "auto",
  view = NATIVE_VIEW,
  showTrack = true,
  showThrow,
  active,
  interactive = false,
  speed = 0.22,
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
}: RailLocomotiveProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = curve !== undefined

  const hold = controlled
    ? Number.isFinite(curve) ? clamp(curve as number, -MAX_CURVE, MAX_CURVE) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => locomotiveCurve(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: CURVE_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const turn = clamp(motion.value, -MAX_CURVE, MAX_CURVE)
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const lift =
    pantograph === "raised" ? 1
    : pantograph === "stowed" ? 0
    : locomotivePan(behavior, clock)
  const consist = Math.round(clamp(Number.isFinite(cars) ? cars : 1, 0, MAX_CARS))

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, -MAX_CURVE, MAX_CURVE) * 10) / 10
      setHeld(bounded)
      onCurveChange?.(bounded)
    },
    [onCurveChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply((unit.x - 0.5) * 2 * MAX_CURVE),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---- the track, and what it does to every vehicle on it ---- */

  const radius = curveRadius(turn, PIVOT_SPACING)
  const sign = turn === 0 ? 0 : turn > 0 ? 1 : -1
  const ride = bogieRide(sign === 0 ? Infinity : radius * sign, {
    pivotSpacing: PIVOT_SPACING,
    halfLength: HALF_LENGTH,
  })
  const pitch = HALF_LENGTH * 2 + COUPLING_GAP

  /**
   * The track, as arc length from the leading vehicle's centre. Curving to
   * starboard puts the centre of the curve at +x, and the train runs toward
   * −z, so a straight track is the z axis and the curve bends away from it by
   * exactly `R(1 − cos φ)`.
   */
  const trackPoint = (s: number): { point: Vec3; forward: Vec2 } => {
    if (sign === 0 || !Number.isFinite(radius)) {
      return { point: { x: 0, y: 0, z: -s }, forward: { x: 0, y: -1 } }
    }
    const phi = s / radius
    return {
      point: {
        x: sign * radius * (1 - Math.cos(phi)),
        y: 0,
        z: -radius * Math.sin(phi),
      },
      // d/ds of the above, which is a unit vector by construction.
      forward: { x: sign * Math.sin(phi), y: -Math.cos(phi) },
    }
  }

  /**
   * A vehicle's own frame: the chord between its two pivots. The body is not
   * placed on the curve — it is placed on the line between two points that
   * are, which is what throws its middle in and its ends out.
   */
  const vehicleFrame = (centre: number) => {
    const lead = trackPoint(centre + PIVOT_SPACING / 2)
    const trail = trackPoint(centre - PIVOT_SPACING / 2)
    const dx = lead.point.x - trail.point.x
    const dz = lead.point.z - trail.point.z
    const span = Math.hypot(dx, dz) || 1
    const forward = { x: dx / span, z: dz / span }
    // Starboard of a body heading `forward`.
    const right = { x: -forward.z, z: forward.x }
    const mid = {
      x: (lead.point.x + trail.point.x) / 2,
      z: (lead.point.z + trail.point.z) / 2,
    }
    const place = (point: Vec2, depth: number): Vec3 => ({
      x: mid.x + forward.x * point.x + right.x * depth,
      y: point.y,
      z: mid.z + forward.z * point.x + right.z * depth,
    })
    return { place, lead, trail }
  }

  /** A bogie's own frame: it sits on the track, so it takes the tangent there. */
  const bogieFrame = (at: { point: Vec3; forward: Vec2 }) => {
    const forward = { x: at.forward.x, z: at.forward.y }
    const right = { x: -forward.z, z: forward.x }
    return (point: Vec2, depth: number): Vec3 => ({
      x: at.point.x + forward.x * point.x + right.x * depth,
      y: point.y,
      z: at.point.z + forward.z * point.x + right.z * depth,
    })
  }

  const camera = robotCamera(view)
  const reach = pitch * consist + HALF_LENGTH + 18
  // The envelope is the union of the whole track range this consist can be put
  // on — straight, and hard over either way — so the framing is fixed per
  // configuration and never breathes as the curve works. The nose sits at −z
  // and the train trails off toward +z, so it is asymmetric the same way.
  const envelope = React.useMemo(() => {
    const nose = -(HALF_LENGTH + 18)
    const side = HALF_BEAM + 6
    let minX = -side
    let maxX = side
    const worst = curveRadius(MAX_CURVE, PIVOT_SPACING)
    for (let index = 0; index <= 24; index += 1) {
      const s = nose + ((reach - nose) * index) / 24
      const swing = worst * (1 - Math.cos(Math.min(Math.PI, Math.abs(s) / worst)))
      minX = Math.min(minX, -swing - side)
      maxX = Math.max(maxX, swing + side)
    }
    return boxCorners(
      { x: minX, y: -6, z: nose },
      { x: maxX, y: PAN_RAISED + 8, z: reach },
    )
  }, [reach])
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)

  /** The drafting helpers, for one placed frame. */
  const draft = (place: (point: Vec2, depth: number) => Vec3) => ({
    place,
    solid: (outline: Vec2[], beam: (y: number) => number, offset = 0) =>
      slabPath(
        outline.flatMap((point) => [
          place(point, offset + beam(point.y)),
          place(point, offset - beam(point.y)),
        ]),
        camera,
      ),
    bar: (a: Vec2, b: Vec2, halfWidth: number, halfDepth: number, offset = 0) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = Math.hypot(dx, dy) || 1
      const ux = dx / length
      const uy = dy / length
      const corners: Vec2[] = [
        { x: a.x - uy * halfWidth - ux * halfWidth, y: a.y + ux * halfWidth - uy * halfWidth },
        { x: a.x + uy * halfWidth - ux * halfWidth, y: a.y - ux * halfWidth - uy * halfWidth },
        { x: b.x + uy * halfWidth + ux * halfWidth, y: b.y - ux * halfWidth + uy * halfWidth },
        { x: b.x - uy * halfWidth + ux * halfWidth, y: b.y + ux * halfWidth + uy * halfWidth },
      ]
      return slabPath(
        corners.flatMap((corner) => [
          place(corner, offset + halfDepth),
          place(corner, offset - halfDepth),
        ]),
        camera,
      )
    },
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
    depth: (point: Vec2, offset = 0) => {
      const corner = place(point, offset)
      return camera.depth(corner.x, corner.y, corner.z)
    },
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const powered = active ?? lift > 0.5

  /** A wheel: a disc standing in the bogie's own plane. */
  const wheel = (
    place: (point: Vec2, depth: number) => Vec3,
    at: number,
    side: number,
  ) =>
    slabPath(
      Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2
        return {
          x: at + Math.cos(angle) * WHEEL_RADIUS,
          y: WHEEL_RADIUS + Math.sin(angle) * WHEEL_RADIUS,
        }
      }).flatMap((point) => [
        place(point, side * HALF_GAUGE + WHEEL_HALF_WIDTH),
        place(point, side * HALF_GAUGE - WHEEL_HALF_WIDTH),
      ]),
      camera,
    )

  const vehicles = Array.from({ length: consist + 1 }, (_, index) => {
    const centre = -index * pitch
    const { place, lead, trail } = vehicleFrame(centre)
    return {
      index,
      centre,
      body: draft(place),
      lead: draft(bogieFrame(lead)),
      trail: draft(bogieFrame(trail)),
      depth: (() => {
        const corner = place({ x: 0, y: ROOF }, 0)
        return camera.depth(corner.x, corner.y, corner.z)
      })(),
    }
  }).sort((a, b) => a.depth - b.depth)

  const pan = pantographPose(PAN_STOWED + (PAN_RAISED - PAN_STOWED) * lift, PAN_GEOMETRY)

  const bogie = (
    place: ReturnType<typeof draft>,
    name: string,
    yaw: number,
    driven: boolean,
  ) => (
    <g key={name} data-bogie={name} data-yaw={px(yaw)}>
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-wheel={`${name}-trail-${side < 0 ? "port" : "starboard"}`}
          d={wheel(place.place, -BOGIE_WHEELBASE / 2, side)}
          {...cast}
        />
      ))}
      <path
        d={place.solid(
          [
            { x: -BOGIE_WHEELBASE / 2 - 9, y: WHEEL_RADIUS - 3 },
            { x: BOGIE_WHEELBASE / 2 + 9, y: WHEEL_RADIUS - 3 },
            { x: BOGIE_WHEELBASE / 2 + 9, y: FLOOR - 2 },
            { x: -BOGIE_WHEELBASE / 2 - 9, y: FLOOR - 2 },
          ],
          () => HALF_GAUGE - 1.5,
        )}
        {...machined}
      />
      {driven && (
        <path
          data-motor={name}
          d={place.solid(
            [
              { x: -5, y: WHEEL_RADIUS - 3 },
              { x: 6, y: WHEEL_RADIUS - 3 },
              { x: 6, y: WHEEL_RADIUS + 6 },
              { x: -5, y: WHEEL_RADIUS + 6 },
            ],
            () => HALF_GAUGE - 4,
          )}
          {...cast}
        />
      )}
      {[-1, 1].map((side) => (
        <path
          key={side}
          data-wheel={`${name}-lead-${side < 0 ? "port" : "starboard"}`}
          d={wheel(place.place, BOGIE_WHEELBASE / 2, side)}
          {...cast}
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
        `Rail locomotive and ${consist} ${consist === 1 ? "car" : "cars"}, track turning ${Math.round(turn)} degrees under a bogie spacing, pantograph ${lift > 0.5 ? "raised" : "stowed"}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? -MAX_CURVE : undefined}
      aria-valuemax={interactive ? MAX_CURVE : undefined}
      aria-valuenow={interactive ? px(turn) : undefined}
      aria-valuetext={interactive ? `track turning ${Math.round(turn)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 3 : 1, 7)
        if (delta !== 0) apply(turn + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(MAX_CURVE)
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
          <path d={`M 10 ${VIEW_HEIGHT - 20} H ${VIEW_WIDTH - 10}`} strokeDasharray="3 4" />
        </g>
      )}

      <g
        data-view={view}
        data-curve={px(turn)}
        data-centre-throw={px(ride.centreThrow)}
        data-end-throw={px(ride.endThrow)}
        data-pantograph-height={px(lift)}
        transform={frame || undefined}
      >
        {showTrack && (
          <g data-track fill="none" stroke={palette.dark} opacity={0.42}>
            {[-1, 1].map((side) => (
              <path
                key={side}
                data-rail={side < 0 ? "port" : "starboard"}
                d={(() => {
                  const samples = 44
                  const from = HALF_LENGTH + 18
                  const to = -(pitch * consist + HALF_LENGTH + 18)
                  return Array.from({ length: samples }, (_, index) => {
                    const s = from + ((to - from) * index) / (samples - 1)
                    const at = trackPoint(s)
                    const right = { x: -at.forward.y, z: at.forward.x }
                    const point = camera.project(
                      at.point.x + right.x * side * HALF_GAUGE,
                      0,
                      at.point.z + right.z * side * HALF_GAUGE,
                    )
                    return `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`
                  }).join(" ")
                })()}
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}

        {vehicles.map((vehicle) => {
          const leading = vehicle.index === 0
          const outline = leading
            ? bodyOutline(CAB_RAKE, 5)
            : bodyOutline(5, 5)
          const name = leading ? "locomotive" : `car-${vehicle.index - 1}`
          const bodyDepth = vehicle.body.depth({ x: 0, y: (FLOOR + ROOF) / 2 })
          const near = (place: ReturnType<typeof draft>) =>
            place.depth({ x: 0, y: WHEEL_RADIUS }) > bodyDepth
          return (
            <g key={name} data-vehicle={name} data-throw={px(bodyOffset(HALF_LENGTH, ride.radius, PIVOT_SPACING))}>
              {!near(vehicle.lead) &&
                bogie(vehicle.lead, `${name}-lead`, ride.bogies[0].yaw, leading)}
              {!near(vehicle.trail) &&
                bogie(vehicle.trail, `${name}-trail`, ride.bogies[1].yaw, leading)}

              {/* Couplers, drawn behind the body: the gap the vehicles keep. */}
              {(leading || vehicle.index < consist) && (
                <path
                  data-coupler={name}
                  d={vehicle.body.solid(
                    [
                      { x: -HALF_LENGTH - COUPLING_GAP / 2, y: FLOOR - 6 },
                      { x: -HALF_LENGTH, y: FLOOR - 6 },
                      { x: -HALF_LENGTH, y: FLOOR - 1 },
                      { x: -HALF_LENGTH - COUPLING_GAP / 2, y: FLOOR - 1 },
                    ],
                    () => 2.6,
                  )}
                  {...machined}
                />
              )}

              {/* Solebar: a member down each side of the underframe, so it is a
                  band in elevation and two lines from above — not a floor. */}
              {[-1, 1].map((side) => (
                <path
                  key={side}
                  data-solebar={side < 0 ? "port" : "starboard"}
                  d={vehicle.body.solid(
                    [
                      { x: -HALF_LENGTH, y: FLOOR - 3.5 },
                      { x: HALF_LENGTH, y: FLOOR - 3.5 },
                      { x: HALF_LENGTH, y: FLOOR + 1 },
                      { x: -HALF_LENGTH, y: FLOOR + 1 },
                    ],
                    () => 1.2,
                    side * (HALF_BEAM - 2),
                  )}
                  {...cast}
                />
              ))}
              <path data-body={name} d={vehicle.body.solid(outline, beamAt)} {...shell} />


              {/* The window band, and on a carriage the doors that break it. */}
              <path
                data-glazing={name}
                d={vehicle.body.face(
                  [
                    { x: -HALF_LENGTH + 10, y: ROOF - 22 },
                    { x: HALF_LENGTH - (leading ? CAB_RAKE + 12 : 10), y: ROOF - 22 },
                    { x: HALF_LENGTH - (leading ? CAB_RAKE + 12 : 10), y: ROOF - 9 },
                    { x: -HALF_LENGTH + 10, y: ROOF - 9 },
                  ],
                  (y) => beamAt(y) + 0.4,
                  true,
                )}
                {...cast}
              />
              {!leading &&
                [-30, 30].map((at) => (
                  <path
                    key={at}
                    data-door={`${name}-${at}`}
                    d={vehicle.body.face(
                      [
                        { x: at - 6, y: FLOOR + 2 },
                        { x: at + 6, y: FLOOR + 2 },
                        { x: at + 6, y: ROOF - 6 },
                        { x: at - 6, y: ROOF - 6 },
                      ],
                      (y) => beamAt(y) + 0.5,
                      true,
                    )}
                    fill="none"
                    stroke={palette.dark}
                    strokeWidth={1.1}
                    opacity={0.5}
                  />
                ))}

              {leading && (
                <>
                  {/* The cab: a raked screen, and the light under it. */}
                  <path
                    data-cab
                    d={vehicle.body.face(
                      [
                        { x: HALF_LENGTH - CAB_RAKE, y: ROOF - 2 },
                        { x: HALF_LENGTH - 2, y: ROOF - CAB_RAKE },
                        { x: HALF_LENGTH - 2, y: ROOF - 22 },
                        { x: HALF_LENGTH - CAB_RAKE - 3, y: ROOF - 22 },
                      ],
                      (y) => beamAt(y) + 0.5,
                      true,
                    )}
                    {...cast}
                  />
                  <path
                    data-lamp="head"
                    d={vehicle.body.across(
                      { x: HALF_LENGTH - 1, y: ROOF - 28 },
                      -(beamAt(ROOF - 28) - 4),
                      beamAt(ROOF - 28) - 4,
                    )}
                    fill="none"
                    stroke={powered ? palette.accent : palette.metal}
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={powered ? 1 : 0.5}
                  />
                  {/* Louvres: the machine room breathing, three marks not thirty. */}
                  {[-34, -22, -10].map((at) => (
                    <path
                      key={at}
                      d={vehicle.body.face(
                        [
                          { x: at, y: FLOOR + 6 },
                          { x: at, y: ROOF - 26 },
                        ],
                        (y) => beamAt(y) + 0.4,
                      )}
                      fill="none"
                      stroke={palette.dark}
                      strokeWidth={1.4}
                      opacity={0.45}
                    />
                  ))}
                  {/* Roof kit: insulators, then the collector on top of them. */}
                  {[-46, 40].map((at) => (
                    <path
                      key={at}
                      d={vehicle.body.solid(
                        [
                          { x: at - 5, y: ROOF },
                          { x: at + 5, y: ROOF },
                          { x: at + 5, y: ROOF + 4 },
                          { x: at - 5, y: ROOF + 4 },
                        ],
                        () => beamAt(ROOF) - 3,
                      )}
                      {...machined}
                    />
                  ))}
                  <g data-pantograph data-height={px(lift)}>
                    <path
                      d={vehicle.body.solid(
                        [
                          { x: -16, y: ROOF },
                          { x: 16, y: ROOF },
                          { x: 16, y: PAN_GEOMETRY.baseHeight },
                          { x: -16, y: PAN_GEOMETRY.baseHeight },
                        ],
                        () => beamAt(ROOF) - 4,
                      )}
                      {...cast}
                    />
                    <path
                      data-lower-arm
                      d={vehicle.body.bar(pan.base, pan.knee, 1.9, 2.6)}
                      {...machined}
                    />
                    <path
                      data-upper-arm
                      d={vehicle.body.bar(pan.knee, pan.head, 1.4, 2)}
                      {...machined}
                    />
                    <path
                      data-knee
                      d={vehicle.body.bar(pan.knee, pan.knee, 2.6, 3.2)}
                      {...cast}
                    />
                    <path
                      data-pan-rod
                      d={vehicle.body.face([pan.rodAnchor, pan.leverEnd], () => 0)}
                      fill="none"
                      stroke={palette.dark}
                      strokeWidth={1}
                      opacity={0.8}
                    />
                    <g data-pan data-attitude={px(pan.attitude)}>
                      {/* The head is a strip across the track, tilted by the
                          attitude the levelling loop produced — level at the
                          height it was set for, and visibly not at the ends. */}
                      <path
                        data-strip
                        d={vehicle.body.solid(
                          tiltAbout(
                            [
                              { x: pan.head.x - 7, y: pan.head.y },
                              { x: pan.head.x + 7, y: pan.head.y },
                              { x: pan.head.x + 7, y: pan.head.y + 2.6 },
                              { x: pan.head.x - 7, y: pan.head.y + 2.6 },
                            ],
                            pan.head,
                            pan.attitude,
                          ),
                          () => beamAt(ROOF) - 3,
                        )}
                        fill={powered ? palette.accent : palette.metal}
                        stroke={palette.dark}
                        strokeWidth={0.5}
                      />
                      {/* The horns: the ends of the strip turned down, so a
                          wire running off the side is led back on. */}
                      {[-1, 1].map((side) => (
                        <path
                          key={side}
                          data-horn={side < 0 ? "port" : "starboard"}
                          d={vehicle.body.face(
                            [
                              { x: pan.head.x - 6, y: pan.head.y + 2.6 },
                              { x: pan.head.x + 6, y: pan.head.y + 2.6 },
                            ],
                            () => side * (beamAt(ROOF) - 3),
                          )}
                          fill="none"
                          stroke={palette.metal}
                          strokeWidth={1.6}
                          strokeLinecap="round"
                        />
                      ))}
                    </g>
                  </g>
                </>
              )}

              {near(vehicle.lead) &&
                bogie(vehicle.lead, `${name}-lead`, ride.bogies[0].yaw, leading)}
              {near(vehicle.trail) &&
                bogie(vehicle.trail, `${name}-trail`, ride.bogies[1].yaw, leading)}
            </g>
          )
        })}

        {(showThrow ?? variant === "blueprint") && ride.sign !== 0 && (
          <g data-throw-marks fill="none" stroke={palette.grid} strokeWidth={0.7} opacity={0.9}>
            {/* The two clearance numbers, drawn where they are measured: the
                middle of the leading body, and its leading corner. */}
            {(() => {
              const { place } = vehicleFrame(0)
              const mark = (x: number) => {
                const on = place({ x, y: FLOOR - 7 }, 0)
                const track = trackPoint(x).point
                const a = camera.project(on.x, on.y, on.z)
                const b = camera.project(track.x, 0, track.z)
                return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
              }
              return (
                <>
                  <path data-throw-centre d={mark(0)} strokeDasharray="2 2" />
                  <path data-throw-end d={mark(HALF_LENGTH)} strokeDasharray="2 2" />
                </>
              )
            })()}
          </g>
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

/** How hard the track is turning at `clock`, in degrees under a bogie spacing. */
export function locomotiveCurve(
  behavior: RailLocomotiveBehavior,
  clock: number,
): number {
  if (behavior === "static" || behavior === "depot" || !Number.isFinite(clock)) return 0
  if (behavior === "yard") {
    // A crossover: hard over one way, held, then hard over the other.
    const cycle = ((clock % 1) + 1) % 1
    if (cycle < 0.3) return MAX_CURVE
    if (cycle < 0.5) return MAX_CURVE * (1 - (cycle - 0.3) / 0.1)
    if (cycle < 0.8) return -MAX_CURVE
    return -MAX_CURVE * (1 - (cycle - 0.8) / 0.1)
  }
  return trackCurvature(clock, MAX_CURVE)
}

/**
 * Where the roof collector is at `clock`, 0 stowed to 1 at the wire. Under
 * power it is simply up; the depot is where a pantograph is actually worked,
 * so that is the behaviour that runs it.
 */
export function locomotivePan(
  behavior: RailLocomotiveBehavior,
  clock: number,
): number {
  if (behavior === "static" || !Number.isFinite(clock)) {
    return behavior === "depot" ? 0 : 1
  }
  if (behavior !== "depot") return 1
  // Preparation: stowed, run up to the wire, hold there, and back down.
  const cycle = ((clock % 1) + 1) % 1
  if (cycle < 0.18) return 0
  if (cycle < 0.38) return (cycle - 0.18) / 0.2
  if (cycle < 0.72) return 1
  if (cycle < 0.92) return 1 - (cycle - 0.72) / 0.2
  return 0
}

export { RailLocomotive }
