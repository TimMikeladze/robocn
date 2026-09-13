"use client"

/**
 * rail-bogie — a powered two-axle bogie, and the only self-excited motion in
 * the set.
 *
 * Nothing commands a wheelset to wander. It wanders because it is *coned*:
 * displace it and the two wheels roll on different radii, which yaws it;
 * yaw it and it runs sideways. That loop has no damping in it, so the wheelset
 * weaves down the track at exactly Klingel's wavelength — a length that
 * depends on the tread, the wheel and the gauge and on nothing else, least of
 * all speed. Take the cone away and the motion stops dead and the wavelength
 * goes to infinity, which is the one control on this machine worth touching.
 *
 * The frame is not animated either: it connects two wheelsets that are each at
 * their own point of the same wave, so its lateral position is their mean and
 * its yaw is the line between them. What the primary suspension has to take is
 * then the difference, and the axleboxes show it.
 *
 * No dynamics: no speed, no creep forces, no damping, no critical speed. The
 * amplitude is an input, because the kinematic solution does not set one —
 * what does set it is the flange, and that is a clamp.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
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
import { huntingPose, klingelWavelength, radialYaw } from "@/lib/robocn/rail"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 190
const NATIVE_VIEW: RobotView = "plan"

/** The bogie in world units: x starboard, y up from the rail head, z aft. */
const HALF_GAUGE = 33
const WHEEL_RADIUS = 19
const WHEEL_HALF_WIDTH = 6
const WHEELBASE = 96
const FRAME_HALF_WIDTH = 48
const FRAME_HALF_LENGTH = 66
const FRAME_TOP = 30
const FRAME_BOTTOM = 21
const RAIL_RUN = 92
const RAIL_HEAD = 3
const FLANGE_CLEARANCE = 8
/** Axlebox centre: outboard of the wheel, under the frame's side beam. */
const AXLEBOX = HALF_GAUGE + WHEEL_HALF_WIDTH + 9
/** Wheel diameters of run per second while the travel eases back into a behaviour. */
const RUN_RATE = 80
const MAX_RUN = 40

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How far the bogie runs into a curve under the `curve` behaviour. A stated radius. */
const CURVE_RADIUS = 520

export type RailBogieBehavior = "hunt" | "curve" | "brake" | "static"

export interface RailBogieProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Distance run, in wheel diameters. Supplying it stops the loop. */
  travel?: number
  onTravelChange?: (travel: number) => void
  /** What the bogie does when `travel` is not supplied. */
  behavior?: RailBogieBehavior
  /**
   * Tread conicity — the tan of the cone angle, 0 to 0.4. This is the whole
   * mechanism: zero is a cylindrical tread and the hunting stops.
   */
  conicity?: number
  /** How far the wheelset wanders before a flange finds a rail, in world units. */
  amplitude?: number
  /** Brake shoes on the treads, 0 off to 1 hard on. Omit and the behaviour works them. */
  brake?: number
  view?: RobotView
  /** The rails and sleepers under it. */
  showTrack?: boolean
  /** Light the traction motor and call out a flanging wheelset. */
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

function RailBogie({
  travel,
  onTravelChange,
  behavior = "hunt",
  conicity = 0.1,
  amplitude = 7,
  brake,
  view = NATIVE_VIEW,
  showTrack = true,
  active,
  interactive = false,
  speed = 0.24,
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
}: RailBogieProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = travel !== undefined

  const hold = controlled
    ? Number.isFinite(travel) ? clamp(travel as number, 0, MAX_RUN) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => bogieRun(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: RUN_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const run = clamp(motion.value, 0, MAX_RUN)
  const clock = Number.isFinite(motion.clock) ? motion.clock : 0
  const shoes = brake !== undefined
    ? Number.isFinite(brake) ? clamp(brake, 0, 1) : 0
    : bogieBrake(behavior, clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, MAX_RUN) * 100) / 100
      setHeld(bounded)
      onTravelChange?.(bounded)
    },
    [onTravelChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x * MAX_RUN), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---- what the cone does ---- */

  const wheelset = {
    wheelRadius: WHEEL_RADIUS,
    halfGauge: HALF_GAUGE,
    conicity: clamp(Number.isFinite(conicity) ? conicity : 0.1, 0, 0.4),
    flangeClearance: FLANGE_CLEARANCE,
  }
  const wander = clamp(Number.isFinite(amplitude) ? amplitude : 7, 0, FLANGE_CLEARANCE * 2)
  const wavelength = klingelWavelength(wheelset)
  const distance = run * WHEEL_RADIUS * 2
  // Braking takes the run out of it, so the weave dies away with the speed.
  const working = wander * (1 - shoes * 0.85)
  // The two wheelsets are a wheelbase apart on one wave, so they are never at
  // the same point of it — which is what yaws the frame as well.
  const lead = huntingPose(distance + WHEELBASE / 2, working, wheelset)
  const trail = huntingPose(distance - WHEELBASE / 2, working, wheelset)
  // On a curve both wheelsets stay on the track and stand *radially* — each
  // square to the radius at its own position — so they splay against each
  // other by twice the half-wheelbase angle.
  const radial = behavior === "curve" && !controlled ? 1 : 0
  const splay = radialYaw(WHEELBASE / 2, CURVE_RADIUS)
  const leadYaw = lead.yaw + radial * splay
  const trailYaw = trail.yaw - radial * splay
  const leadLateral = lead.lateral
  const trailLateral = trail.lateral

  // The frame is not animated: it joins two wheelsets, so it sits on their
  // mean and points along the line between them. On a curve it is the chord
  // between two points that are on the track, so it also stands `R(1 − cos α)`
  // *inside* it — the bogie's own share of the centre throw.
  const insideThrow = CURVE_RADIUS * (1 - Math.cos(WHEELBASE / 2 / CURVE_RADIUS))
  const frameLateral = (leadLateral + trailLateral) / 2 + radial * insideThrow
  const frameYaw = toDegrees(Math.atan2(leadLateral - trailLateral, WHEELBASE))

  const camera = robotCamera(view)
  const fit = fitTransform(
    boxCorners(
      { x: -(FRAME_HALF_WIDTH + 9), y: -2, z: -RAIL_RUN },
      { x: FRAME_HALF_WIDTH + 9, y: FRAME_TOP + 14, z: RAIL_RUN },
    ),
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
  )

  /** A part in a yawed, laterally displaced frame: a wheelset, or the bogie. */
  const framed = (centre: number, lateral: number, yaw: number) => {
    const turn = toRadians(yaw)
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    return (point: Vec3): Vec3 => ({
      x: lateral + point.x * cos + point.z * sin,
      y: point.y,
      z: centre - point.x * sin + point.z * cos,
    })
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const live = active ?? behavior !== "static"

  /** A box in a placed frame. */
  const box = (
    place: (point: Vec3) => Vec3,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    bottom: number,
    top: number,
  ) =>
    slabPath(
      [
        { x: x0, z: z0 },
        { x: x1, z: z0 },
        { x: x1, z: z1 },
        { x: x0, z: z1 },
      ].flatMap((corner) => [
        place({ x: corner.x, y: bottom, z: corner.z }),
        place({ x: corner.x, y: top, z: corner.z }),
      ]),
      camera,
    )

  /** A wheel: a disc standing in the wheel's own plane. */
  const wheelPath = (place: (point: Vec3) => Vec3, side: number) =>
    slabPath(
      Array.from({ length: 18 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2
        return {
          y: WHEEL_RADIUS + Math.sin(angle) * WHEEL_RADIUS,
          z: Math.cos(angle) * WHEEL_RADIUS,
        }
      }).flatMap((point) => [
        place({ x: side * HALF_GAUGE + WHEEL_HALF_WIDTH, y: point.y, z: point.z }),
        place({ x: side * HALF_GAUGE - WHEEL_HALF_WIDTH, y: point.y, z: point.z }),
      ]),
      camera,
    )

  /** A coil spring, drawn as the stack of rings it is. */
  const spring = (place: (point: Vec3) => Vec3, x: number, z: number, radius: number) =>
    [0, 1, 2].map((ring) =>
      slabPath(
        circleFootprint(x, z, radius, 12).map((point) =>
          place({ x: point.x, y: WHEEL_RADIUS + 1 + ring * 2.6, z: point.y }),
        ),
        camera,
      ),
    )

  const wheelsets = [
    {
      name: "lead",
      centre: -WHEELBASE / 2,
      lateral: leadLateral,
      yaw: leadYaw,
      pose: lead,
      driven: true,
    },
    {
      name: "trail",
      centre: WHEELBASE / 2,
      lateral: trailLateral,
      yaw: trailYaw,
      pose: trail,
      driven: false,
    },
  ].map((entry) => ({ ...entry, place: framed(entry.centre, entry.lateral, entry.yaw) }))

  const frame = framed(0, frameLateral, frameYaw)
  const frameDepth = camera.depth(frameLateral, FRAME_BOTTOM, 0)
  /** Is this wheel in front of the frame from where the camera stands? */
  const near = (entry: (typeof wheelsets)[number], side: number) =>
    camera.depth(entry.lateral + side * HALF_GAUGE, WHEEL_RADIUS, entry.centre) > frameDepth
  const rails = [-1, 1].map((side) => ({
    side,
    name: side < 0 ? "port" : "starboard",
    depth: camera.depth(side * HALF_GAUGE, RAIL_HEAD, 0),
    path: box(
      (point: Vec3) => point,
      side * HALF_GAUGE - 3,
      -RAIL_RUN,
      side * HALF_GAUGE + 3,
      RAIL_RUN,
      0,
      RAIL_HEAD,
    ),
  }))
  /** A tread, lit when its flange has found a rail. */
  const tread = (flanging: boolean) => ({
    ...cast,
    fill: flanging && live ? palette.accent : cast.fill,
  })
  const readout = Math.round(run * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Rail bogie, run ${readout} wheel diameters, conicity ${wheelset.conicity.toFixed(2)}, ${
          Number.isFinite(wavelength)
            ? `hunting wavelength ${Math.round(wavelength)} units`
            : "cylindrical treads and no hunting"
        }, ${viewNames[view] ?? viewNames.plan}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? MAX_RUN : undefined}
      aria-valuenow={interactive ? px(run) : undefined}
      aria-valuetext={interactive ? `${readout} wheel diameters run` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 2 : 0.5, 5)
        if (delta !== 0) apply(run + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(MAX_RUN)
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
        data-travel={px(run)}
        data-wavelength={Number.isFinite(wavelength) ? px(wavelength) : "infinite"}
        data-conicity={px(wheelset.conicity)}
        transform={fit || undefined}
      >
        {variant === "blueprint" && (
          <path
            data-centreline
            d={(() => {
              const a = camera.project(0, 0, -RAIL_RUN)
              const b = camera.project(0, 0, RAIL_RUN)
              return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
            })()}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.5}
            strokeDasharray="3 4"
            opacity={0.7}
          />
        )}
        {showTrack && (
          <g data-track>
            {rails
              .filter((rail) => rail.depth <= frameDepth)
              .map((rail) => (
                <path key={rail.side} data-rail={rail.name} d={rail.path} {...machined} />
              ))}
            {[-72, -24, 24, 72].map((at) => (
              <path
                key={at}
                data-sleeper={at}
                d={box((point) => point, -HALF_GAUGE - 13, at - 6, HALF_GAUGE + 13, at + 6, 0, 1.6)}
                fill={palette.dark}
                fillOpacity={variant === "solid" ? 0.28 : 0.12}
                stroke="none"
              />
            ))}
          </g>
        )}

        {wheelsets.map((entry) => (
          <g
            key={entry.name}
            data-wheelset={entry.name}
            data-lateral={px(entry.lateral)}
            data-yaw={px(entry.yaw)}
            data-flanging={entry.pose.flanging ? "true" : "false"}
          >
            {/* The axle: what makes the two wheels one body, and the reason a
                rolling-radius difference has to come out as yaw. */}
            <path
              data-axle={entry.name}
              d={box(entry.place, -AXLEBOX, -3.4, AXLEBOX, 3.4, WHEEL_RADIUS - 3.4, WHEEL_RADIUS + 3.4)}
              {...machined}
            />
            {[-1, 1].map((side) => (
              <g key={side}>
                {!near(entry, side) && (
                  <path
                    data-wheel={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
                    d={wheelPath(entry.place, side)}
                    {...tread(entry.pose.flanging)}
                  />
                )}
                <path
                  data-flange={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
                  d={slabPath(
                    Array.from({ length: 18 }, (_, index) => {
                      const angle = (index / 18) * Math.PI * 2
                      return {
                        y: WHEEL_RADIUS + Math.sin(angle) * (WHEEL_RADIUS + 3),
                        z: Math.cos(angle) * (WHEEL_RADIUS + 3),
                      }
                    }).flatMap((point) => [
                      entry.place({ x: side * (HALF_GAUGE - WHEEL_HALF_WIDTH), y: point.y, z: point.z }),
                      entry.place({ x: side * (HALF_GAUGE - WHEEL_HALF_WIDTH - 2.5), y: point.y, z: point.z }),
                    ]),
                    camera,
                  )}
                  fill={entry.pose.flanging && live ? palette.accent : palette.metal}
                  fillOpacity={variant === "solid" ? 1 : 0.25}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
                {/* Axlebox: the wheelset's only connection to the frame, so
                    this is where the primary suspension's travel shows. */}
                <path
                  data-axlebox={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
                  d={box(
                    entry.place,
                    side * AXLEBOX - 7,
                    -8,
                    side * AXLEBOX + 7,
                    8,
                    WHEEL_RADIUS - 6,
                    WHEEL_RADIUS + 4,
                  )}
                  {...cast}
                />
                {spring(entry.place, side * AXLEBOX, 0, 5.5).map((ring, index) => (
                  <path
                    key={index}
                    data-primary={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
                    d={ring}
                    fill="none"
                    stroke={palette.metal}
                    strokeWidth={1.3}
                  />
                ))}
                {/* Brake shoes, which come onto the tread rather than appear. */}
                <path
                  data-brake={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
                  data-application={px(shoes)}
                  d={box(
                    entry.place,
                    side * HALF_GAUGE - WHEEL_HALF_WIDTH,
                    13.5 - shoes * 2.5,
                    side * HALF_GAUGE + WHEEL_HALF_WIDTH,
                    20.5 - shoes * 2.5,
                    1.5,
                    9.5,
                  )}
                  fill={shoes > 0.05 ? palette.accent : palette.metal}
                  fillOpacity={variant === "solid" ? (shoes > 0.05 ? 1 : 0.8) : 0.3}
                  stroke={palette.dark}
                  strokeWidth={0.5}
                />
              </g>
            ))}
            {entry.driven && (
              <>
                <path
                  data-motor
                  d={box(entry.place, -17, 9, 17, 31, WHEEL_RADIUS - 9, WHEEL_RADIUS + 6)}
                  {...machined}
                />
                <path
                  data-motor-terminal
                  d={box(entry.place, -6, 12, 6, 17, WHEEL_RADIUS + 6, WHEEL_RADIUS + 9)}
                  fill={live ? palette.accent : palette.metal}
                  fillOpacity={variant === "solid" ? 1 : 0.3}
                  stroke={palette.dark}
                  strokeWidth={0.4}
                />
              </>
            )}
          </g>
        ))}

        <g data-frame data-yaw={px(frameYaw)} data-lateral={px(frameLateral)}>
          {/* Two side beams and a transom: an H, which is why the wheelsets
              can yaw against it at all. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-sideframe={side < 0 ? "port" : "starboard"}
              d={box(
                frame,
                side * FRAME_HALF_WIDTH - 8,
                -FRAME_HALF_LENGTH,
                side * FRAME_HALF_WIDTH + 8,
                FRAME_HALF_LENGTH,
                FRAME_BOTTOM,
                FRAME_TOP,
              )}
              {...shell}
            />
          ))}
          <path
            data-transom
            d={box(frame, -FRAME_HALF_WIDTH, -13, FRAME_HALF_WIDTH, 13, FRAME_BOTTOM, FRAME_TOP)}
            {...shell}
          />
          {/* Secondary suspension: what the body above actually rides on. */}
          {[-1, 1].map((side) => (
            <path
              key={side}
              data-secondary={side < 0 ? "port" : "starboard"}
              d={slabPath(
                circleFootprint(side * 26, 0, 12, 14).flatMap((point) => [
                  frame({ x: point.x, y: FRAME_TOP, z: point.y }),
                  frame({ x: point.x, y: FRAME_TOP + 9, z: point.y }),
                ]),
                camera,
              )}
              {...machined}
            />
          ))}
          <path
            data-centre-pivot
            d={slabPath(
              circleFootprint(0, 0, 9, 14).flatMap((point) => [
                frame({ x: point.x, y: FRAME_TOP, z: point.y }),
                frame({ x: point.x, y: FRAME_TOP + 12, z: point.y }),
              ]),
              camera,
            )}
            {...cast}
          />
        </g>

        {showTrack &&
          rails
            .filter((rail) => rail.depth > frameDepth)
            .map((rail) => (
              <path key={rail.side} data-rail={rail.name} d={rail.path} {...machined} />
            ))}

        {/* The wheels that finished up in front of the frame paint over it. */}
        {wheelsets.flatMap((entry) =>
          [-1, 1].filter((side) => near(entry, side)).map((side) => (
            <path
              key={`${entry.name}-${side}`}
              data-wheel={`${entry.name}-${side < 0 ? "port" : "starboard"}`}
              d={wheelPath(entry.place, side)}
              {...tread(entry.pose.flanging)}
            />
          )),
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

/** How far the bogie has run at `clock`, in wheel diameters. */
export function bogieRun(behavior: RailBogieBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const cycle = ((clock % 1) + 1) % 1
  if (behavior === "brake") {
    // Running, then stopping: the run flattens out as the shoes go on.
    return MAX_RUN * (1 - (1 - Math.min(1, cycle / 0.75)) ** 2)
  }
  // Out and back, so the cycle closes without the run ever jumping — the
  // hunting pose is symmetric in distance, so a bench can be run either way.
  return (cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2) * MAX_RUN
}

/** How hard the shoes are on the treads at `clock`, 0 off to 1 hard on. */
export function bogieBrake(behavior: RailBogieBehavior, clock: number): number {
  if (behavior !== "brake" || !Number.isFinite(clock)) return 0
  const cycle = ((clock % 1) + 1) % 1
  if (cycle < 0.15) return 0
  if (cycle < 0.55) return (cycle - 0.15) / 0.4
  if (cycle < 0.85) return 1
  return 1 - (cycle - 0.85) / 0.15
}

export { RailBogie }
