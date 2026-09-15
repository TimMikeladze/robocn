"use client"

/**
 * robot-baseball — a pitched ball, with the seam and the break both solved.
 *
 * The ball is a sphere, which is the easy part; what makes a baseball a
 * baseball is the seam, and that is a closed figure-eight lying *exactly* on
 * the surface — `x = a·cos t + b·cos 3t`, `y = a·sin t − b·sin 3t`,
 * `z = 2√(ab)·sin 2t`, whose radius works out to `a + b` for every `t`. So the
 * ball turning carries the seam round the back and brings it out the other
 * side, and the far half is culled rather than painted over the near one.
 *
 * The flight is `a = g + (S/m)(ω × v)`. Each pitch is a spin rate and an axis
 * and nothing else: a four-seam fastball holds itself up on backspin, a
 * curveball's topspin drives it past gravity, a slider's axis stands up so the
 * break goes sideways, and a knuckler barely turns so nothing happens to it.
 * The dashed line is the same pitch with the spin taken out, so the gap between
 * the two *is* the break rather than a number someone typed.
 *
 * The maths is in `src/lib/robocn/sport.ts` — pure, no React, tested on its
 * own. What is illustrated here: there is no air, so nothing decays and the
 * Magnus term is held at its release value, which makes the whole flight one
 * quadratic. Over the sixty feet this is drawn at, that is smaller than the
 * seam it is drawn with.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  baseballSeam,
  flightAt,
  pitchNames,
  pitchSpin,
  sphereSilhouette,
  spinFrame,
  surfaceCurve,
  visibleRuns,
  type PitchName,
} from "@/lib/robocn/sport"
import {
  boxCorners,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the ball does with nobody driving it. Always includes `static`. */
export type BaseballBehavior = PitchName | "spin" | "static"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 170
/** The bottom strip the readout sits in; the drawing is fitted above it. */
const TEXT_ROOM = 30
const NATIVE_VIEW: RobotView = "profile"

/** World units from the hand to the plate, and how long the ball takes. */
const RANGE = 92
const FLIGHT_TIME = 0.45
const BALL_RADIUS = 15
/**
 * Gravity and the Magnus coefficient in *these* units. The shape of every curve
 * belongs to the equation; only its size on the page belongs to the drawing,
 * and both are set so a drag-free sag and a real ball's break come out at about
 * the share of the flight they do over sixty feet.
 */
const GRAVITY = 210
const MAGNUS = 0.0024
/** Released this far nose-up, which is roughly what gravity takes back. */
const LAUNCH = 13
const GROUND = -34
/**
 * The turf is a *plane*, so it is drawn as one. A line along a single world
 * axis collapses to a stick the moment the camera looks down that axis — which
 * is exactly what the plan view does to a line drawn down the flight.
 */
const TURF_PATCH: Vec2[] = [
  { x: -26, y: 16 },
  { x: 26, y: 16 },
  { x: 26, y: -112 },
  { x: -26, y: -112 },
]
/** The box every camera has to fit: the whole flight, the ball, and the turf. */
const ENVELOPE = boxCorners({ x: -28, y: GROUND, z: -112 }, { x: 28, y: 34, z: 20 })
/** The drawing is never blown up past this, so the ball keeps a readable size. */
const MAX_SCALE = 1.45
/** Revolutions per second of clock when the ball is just turning on the spot. */
const SPIN_TURNS = 0.9

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation, the batter's view",
  profile: "side elevation",
  iso: "isometric view",
}

const descriptions: Record<BaseballBehavior, string> = {
  fastball: "four-seam fastball, riding on backspin",
  curveball: "curveball, diving on topspin",
  slider: "slider, breaking sideways on a standing axis",
  sinker: "sinker, running arm-side",
  knuckler: "knuckler, barely turning",
  spin: "turning on the spot",
  static: "held still",
}

/** Which way the camera lies from the ball: the gradient of its own depth. */
function viewDirection(camera: RobotCamera): Vec3 {
  return { x: camera.depth(1, 0, 0), y: camera.depth(0, 1, 0), z: camera.depth(0, 0, 1) }
}

export interface BaseballPose {
  /** How far along the pitch, 0 at release and 1 at the plate. */
  along: number
  /** Revolutions the ball has turned, for the seam to follow. */
  turns: number
}

/**
 * Every behaviour is a pure function of the clock, exported so motion is tested
 * by sampling it rather than by faking animation frames.
 */
export function baseballPose(behavior: BaseballBehavior, clock: number): BaseballPose {
  if (!Number.isFinite(clock)) return { along: 0, turns: 0 }
  if (behavior === "spin") return { along: 0, turns: clock * SPIN_TURNS }
  if (!pitchNames.includes(behavior as PitchName)) return { along: 0, turns: 0 }
  const along = ((clock % 1) + 1) % 1
  return { along, turns: pitchSpin(behavior as PitchName).rate * along * FLIGHT_TIME }
}

/**
 * The pitch a behaviour throws. The two that are not pitches hold a fastball,
 * and so does anything that is not in the union at all — a stale prop from a
 * consumer should degrade, not draw nonsense.
 */
export const baseballPitch = (behavior: BaseballBehavior): PitchName =>
  pitchNames.includes(behavior as PitchName) ? (behavior as PitchName) : "fastball"

export interface RobotBaseballProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position along the pitch, 0 to 1. Supplying it stops the loop. */
  along?: number
  onAlongChange?: (along: number) => void
  behavior?: BaseballBehavior
  /**
   * Draw the solved flight, and the same pitch with the spin taken out. The
   * two behaviours that throw nothing — `spin` and `static` — never draw one.
   */
  showPath?: boolean
  showGround?: boolean
  seam?: boolean
  /** Where the camera stands. `front` is the batter's view, where break reads. */
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

function RobotBaseball({
  along,
  onAlongChange,
  behavior = "fastball",
  showPath = true,
  showGround = true,
  seam = true,
  view = NATIVE_VIEW,
  speed = 0.5,
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
}: RobotBaseballProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = along !== undefined

  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase,
  })
  const running = baseballPose(behavior, clock)
  const pinned = controlled
    ? Number.isFinite(along) ? clamp(along as number, 0, 1) : 0
    : held
  const pose: BaseballPose =
    pinned === null
      ? running
      : { along: pinned, turns: pitchSpin(baseballPitch(behavior)).rate * pinned * FLIGHT_TIME }

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onAlongChange?.(bounded)
    },
    [onAlongChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pitch = baseballPitch(behavior)
  const spin = pitchSpin(pitch)
  const options = {
    speed: RANGE / FLIGHT_TIME,
    launch: LAUNCH,
    gravity: GRAVITY,
    magnus: MAGNUS,
    spin,
  }
  const flight = flightAt(pose.along * FLIGHT_TIME, options)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - TEXT_ROOM, 8, MAX_SCALE)
  const look = viewDirection(camera)
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`
  const shift = (point: Vec3): Vec3 => ({
    x: point.x + flight.position.x,
    y: point.y + flight.position.y,
    z: point.z + flight.position.z,
  })

  // The seam turns about the pitch's own spin axis, so what the camera sees of
  // it is a consequence of the pitch rather than a second animation.
  const attitude = spinFrame(spin.axis, pose.turns)
  const outline = sphereSilhouette(BALL_RADIUS, look, 48).map((p) => to(shift(p)))
  const stitching = surfaceCurve(attitude, BALL_RADIUS, SEAM, look)
  /** Where the flight actually ends, which is where the plate belongs. */
  const plate = flightAt(FLIGHT_TIME, options).position

  const sample = (withSpin: boolean) =>
    Array.from({ length: 33 }, (_, index) =>
      to(
        flightAt((index / 32) * FLIGHT_TIME, {
          ...options,
          spin: withSpin ? spin : { rate: 0, axis: spin.axis },
        }).position,
      ),
    )

  const shell = robotSurface("shell", variant, palette)
  const seamPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.accent,
    strokeWidth: variant === "solid" ? 1.9 : 1.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  const broke = Math.round(flight.break * 10) / 10
  // `spin` turns on the spot and `static` does nothing, so neither of them gets
  // to quote a pitch's spin rate or its break.
  const thrown = behavior === "spin" || behavior === "static" ? behavior : pitch
  const caption =
    behavior === "static"
      ? "STATIC / HELD"
      : behavior === "spin"
        ? `SPIN / ${SPIN_TURNS} REV·S`
        : `${thrown.toUpperCase()} / ${Math.round(spin.rate)} REV·S / ${broke} BREAK`
  const percent = Math.round(pose.along * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Robot baseball, ${descriptions[behavior] ?? descriptions.static}, ${percent} percent to the plate, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pose.along) : undefined}
      aria-valuetext={interactive ? `${percent} percent to the plate` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.2)
        if (delta !== 0) apply(pose.along + delta)
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
      <g data-view={view} data-pitch={pitch} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={line(TURF_PATCH.map((corner) => to({ x: corner.x, y: GROUND, z: corner.y })), true)}
              fill={variant === "solid" ? palette.dark : "none"}
              fillOpacity={0.07}
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.45}
            />
            <path
              data-plate
              d={line(PLATE.map((p) => to({ x: p.x, y: GROUND, z: plate.z + p.y })), true)}
              fill={palette.dark}
              opacity={0.28}
            />
          </>
        )}

        {/* Neither of the two behaviours that are not pitches has a flight, so
            neither gets one drawn beside it. */}
        {showPath && behavior !== "spin" && behavior !== "static" && (
          <>
            {/* The same pitch with the spin taken out: the gap is the break. */}
            <path
              data-datum
              d={line(sample(false))}
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.8}
              strokeDasharray="3 3"
              opacity={0.75}
            />
            <path
              data-path
              d={line(sample(true))}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.3}
              strokeLinecap="round"
              opacity={0.85}
            />
          </>
        )}

        <g data-ball>
          {showGround && (
            <ellipse
              data-shadow
              cx={px(to({ x: 0, y: GROUND, z: flight.position.z }).x)}
              cy={px(to({ x: 0, y: GROUND, z: flight.position.z }).y)}
              rx={px(BALL_RADIUS * 0.72)}
              ry={px(1.6 + (BALL_RADIUS - 5) * camera.flatten)}
              fill={palette.dark}
              opacity={0.16}
            />
          )}

          <path data-shell d={line(outline, true)} {...shell} />

          {seam &&
            visibleRuns(stitching).map((run, part) => (
              <path
                key={part}
                data-seam={part}
                d={line(run.map((mark) => to(shift(mark.point))))}
                {...seamPaint}
              />
            ))}

          {variant === "solid" && (
            <ellipse
              data-highlight
              cx={px(to(shift({ x: -BALL_RADIUS * 0.3, y: BALL_RADIUS * 0.4, z: BALL_RADIUS * 0.5 })).x)}
              cy={px(to(shift({ x: -BALL_RADIUS * 0.3, y: BALL_RADIUS * 0.4, z: BALL_RADIUS * 0.5 })).y)}
              rx={6}
              ry={4}
              fill={palette.glow}
              opacity={0.16}
            />
          )}
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 16} fontSize={5.5}>
          {caption}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 7} fontSize={4.8} opacity={0.75}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Sampled once: the seam is the same curve on every ball ever drawn. */
const SEAM = baseballSeam(0.3, 132)

/** Home plate, in the ground plane: x across, y downrange from the point. */
const PLATE: Vec2[] = [
  { x: -8, y: -8 },
  { x: 8, y: -8 },
  { x: 8, y: 0 },
  { x: 0, y: 8 },
  { x: -8, y: 0 },
]

export { RobotBaseball }
