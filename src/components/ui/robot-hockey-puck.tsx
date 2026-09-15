"use client"

/**
 * robot-hockey-puck — a cylinder on ice, and friction that is a straight line.
 *
 * Everything else in this family is a sphere; this one is not, and that is what
 * it is for. A cylinder's silhouette under any camera is the convex hull of its
 * two rims projected — exact face-on, exact edge-on and exact everywhere
 * between, with nothing special-cased. Looking down at the ice it is a disc;
 * tip the camera and the same two rims give you the slab.
 *
 * Friction on ice is Coulomb, which means the deceleration is `μg` *whatever
 * the speed*. Three things fall out of that and all three are drawn: the puck
 * loses speed along a straight line, the distance it has left is exactly
 * `v²/2μg`, and a board that takes `e` of its speed therefore takes `e²` of the
 * distance it had left. So the whole track — every leg, every reflection, the
 * point it stops at — is solved once in closed form, and the clock only says
 * where along it the puck is. Change the heading and the whole track re-solves,
 * bounces and all.
 *
 * The maths is in `src/lib/robocn/sport.ts` — pure, no React, tested on its
 * own. What is illustrated: the spin bleeds off with the speed because the ice
 * takes both, which is the right shape but not a solved moment; and the boards
 * are a specular reflection, so a puck never leaves one at an angle it did not
 * arrive at.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultPuck,
  defaultRink,
  puckRim,
  puckSilhouette,
  slideAt,
  slideTrack,
  spinFrame,
  type SlideOptions,
} from "@/lib/robocn/sport"
import {
  boxCorners,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the puck does with nobody driving it. Always includes `static`. */
export type HockeyPuckBehavior = "slap" | "wrist" | "dump" | "spin" | "static"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 240
const NATIVE_VIEW: RobotView = "plan"

/** The bottom strip the readout sits in; the drawing is fitted above it. */
const TEXT_ROOM = 30
/** How high the boards stand, so they read once the camera tips. */
const BOARDS = 9
/** What every camera has to fit: the whole rink, boards and all. */
const ENVELOPE = boxCorners(
  { x: -defaultRink.halfWidth, y: 0, z: -defaultRink.halfLength },
  { x: defaultRink.halfWidth, y: BOARDS, z: defaultRink.halfLength },
)
/** In these units, so a hard shot crosses the rink and a soft one does not. */
const ICE_GRAVITY = 1000
const SPIN_TURNS = 1.4

const shots: Record<HockeyPuckBehavior, SlideOptions> = {
  slap: {
    start: { x: -26, y: 70 },
    heading: 13,
    speed: 170,
    friction: 0.05,
    board: 0.72,
    bounces: 3,
  },
  wrist: {
    start: { x: 24, y: 72 },
    heading: -17,
    speed: 110,
    friction: 0.06,
    board: 0.66,
    bounces: 2,
  },
  dump: {
    start: { x: -40, y: 76 },
    heading: 36,
    speed: 150,
    friction: 0.04,
    board: 0.76,
    bounces: 4,
  },
  spin: { start: { x: 0, y: 0 }, heading: 0, speed: 0, friction: 0.05, bounces: 0 },
  static: { start: { x: 0, y: 0 }, heading: 0, speed: 0, friction: 0.05, bounces: 0 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const descriptions: Record<HockeyPuckBehavior, string> = {
  slap: "slapped hard, off three boards",
  wrist: "a wrist shot that runs out of ice",
  dump: "dumped into the corner",
  spin: "turning on the spot",
  static: "held still",
}

/** Which way the camera lies from the puck: the gradient of its own depth. */
function viewDirection(camera: RobotCamera): Vec3 {
  return { x: camera.depth(1, 0, 0), y: camera.depth(0, 1, 0), z: camera.depth(0, 0, 1) }
}

export interface PuckPose {
  /** How far along the whole solved track, 0 to 1. */
  along: number
  /** Revolutions turned on the spot, for the shots that do not travel. */
  turns: number
}

/**
 * Every behaviour is a pure function of the clock, exported so motion is tested
 * by sampling it rather than by faking animation frames.
 */
export function puckPose(behavior: HockeyPuckBehavior, clock: number): PuckPose {
  if (!Number.isFinite(clock)) return { along: 0, turns: 0 }
  if (behavior === "spin") return { along: 0, turns: clock * SPIN_TURNS }
  if (!(behavior in shots) || behavior === "static") return { along: 0, turns: 0 }
  return { along: ((clock % 1) + 1) % 1, turns: 0 }
}

/**
 * The shot a behaviour takes, with the ice it is taken on already in it.
 *
 * The rink the *slide* is solved against is inset by the puck's own radius: a
 * puck turns at the board when its edge arrives, not when its centre does, and
 * solving on the boards themselves buries half of it in the wall.
 */
export const puckShot = (behavior: HockeyPuckBehavior): SlideOptions => ({
  ...(shots[behavior] ?? shots.static),
  gravity: ICE_GRAVITY,
  rink: {
    halfWidth: defaultRink.halfWidth - defaultPuck.radius,
    halfLength: defaultRink.halfLength - defaultPuck.radius,
  },
})

export interface RobotHockeyPuckProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position along the solved track, 0 to 1. Stops the loop. */
  along?: number
  onAlongChange?: (along: number) => void
  behavior?: HockeyPuckBehavior
  /** Degrees off straight up the ice. The whole track re-solves around it. */
  heading?: number
  showRink?: boolean
  /** Draw the solved track, boards and all. */
  showTrack?: boolean
  /** Where the camera stands. Defaults to the view it was drawn in. */
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

function RobotHockeyPuck({
  along,
  onAlongChange,
  behavior = "slap",
  heading,
  showRink = true,
  showTrack = true,
  view = NATIVE_VIEW,
  speed = 0.32,
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
}: RobotHockeyPuckProps) {
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
  const running = puckPose(behavior, clock)
  const pinned = controlled
    ? Number.isFinite(along) ? clamp(along as number, 0, 1) : 0
    : held
  const pose: PuckPose = pinned === null ? running : { along: pinned, turns: running.turns }

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

  const shot = puckShot(behavior)
  const track = slideTrack(
    heading === undefined || !Number.isFinite(heading)
      ? shot
      : { ...shot, heading: clamp(heading, -80, 80) },
  )
  const state = slideAt(track, pose.along * track.duration, 1.1)

  const camera = robotCamera(view)
  const fitted = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - TEXT_ROOM)
  const look = viewDirection(camera)
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  /** Ice-plane coordinates: `x` across the rink, `y` up it. */
  const onIce = (point: Vec2, height = 0) => to({ x: point.x, y: height, z: point.y })
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  // The puck lies flat, so its axis is world up and the spin turns it in the
  // ice plane — which is what carries the knurl round.
  const frame = spinFrame({ x: 0, y: 1, z: 0 }, state.turns + pose.turns)
  const centre: Vec3 = { x: state.point.x, y: defaultPuck.halfHeight, z: state.point.y }
  const place = (point: Vec3): Vec2 =>
    to({ x: centre.x + point.x, y: centre.y + point.y, z: centre.z + point.z })

  const outline = puckSilhouette(frame, defaultPuck, place, 40)
  const topRim = puckRim(frame, defaultPuck, 1, 40).map(place)
  // A knurl tick is only drawn where its own bit of the edge faces the camera.
  const knurl = Array.from({ length: 28 }, (_, index) => {
    const a = (index / 28) * Math.PI * 2
    const radial: Vec3 = {
      x: frame.u.x * Math.cos(a) + frame.w.x * Math.sin(a),
      y: frame.u.y * Math.cos(a) + frame.w.y * Math.sin(a),
      z: frame.u.z * Math.cos(a) + frame.w.z * Math.sin(a),
    }
    const facing = radial.x * look.x + radial.y * look.y + radial.z * look.z
    const at = (height: number): Vec3 => ({
      x: radial.x * defaultPuck.radius + frame.v.x * height,
      y: radial.y * defaultPuck.radius + frame.v.y * height,
      z: radial.z * defaultPuck.radius + frame.v.z * height,
    })
    return { facing, a: place(at(defaultPuck.halfHeight)), b: place(at(-defaultPuck.halfHeight)) }
  })

  const rink = roundedFootprint(defaultRink.halfWidth, defaultRink.halfLength, 26, 6)
  const trackPath = [track.legs[0]?.from ?? state.point, ...track.legs.map((leg) => leg.to)]

  const shell = robotSurface("shell", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const percent = Math.round(pose.along * 100)
  const carrying = Math.round(state.speed)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Robot hockey puck, ${descriptions[behavior] ?? descriptions.static}, ${percent} percent along its track, ${viewNames[view] ?? viewNames.plan}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pose.along) : undefined}
      aria-valuetext={interactive ? `${percent} percent along its track` : undefined}
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
      <g data-view={view} data-behavior={behavior} transform={fitted || undefined}>
        {showRink && (
          <g data-rink>
            <path
              data-ice
              d={line(rink.map((p) => onIce(p)), true)}
              fill={variant === "solid" ? palette.grid : "none"}
              stroke={variant === "solid" ? "none" : palette.grid}
              strokeWidth={0.6}
              opacity={variant === "solid" ? 0.1 : 0.4}
            />
            <path
              data-board
              d={line(rink.map((p) => onIce(p, BOARDS)), true)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.4}
              opacity={0.55}
            />
            {/* The boards themselves, so the rink is a box once the camera tips. */}
            {rink.map((p, index) => (
              <path
                key={index}
                d={line([onIce(p), onIce(p, BOARDS)])}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.7}
                opacity={0.3}
              />
            ))}
            <path
              data-centre
              d={line([
                onIce({ x: -defaultRink.halfWidth, y: 0 }),
                onIce({ x: defaultRink.halfWidth, y: 0 }),
              ])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1}
              opacity={0.4}
            />
            <path
              data-goal
              d={line([
                onIce({ x: -15, y: -62 }),
                onIce({ x: -15, y: -70 }),
                onIce({ x: 15, y: -70 }),
                onIce({ x: 15, y: -62 }),
              ])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.4}
              opacity={0.65}
            />
          </g>
        )}

        {showTrack && (
          <>
            <path
              data-track
              d={line(trackPath.map((p) => onIce(p)))}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeDasharray="5 3"
              opacity={0.8}
            />
            {/* Where it stops, which friction decided rather than the drawing. */}
            <circle
              data-stop
              cx={px(onIce(track.legs[track.legs.length - 1]?.to ?? state.point).x)}
              cy={px(onIce(track.legs[track.legs.length - 1]?.to ?? state.point).y)}
              r={2.2}
              fill="none"
              stroke={palette.metal}
              strokeWidth={0.8}
              opacity={0.7}
            />
          </>
        )}

        <g data-puck>
          <ellipse
            data-shadow
            cx={px(onIce(state.point).x)}
            cy={px(onIce(state.point).y)}
            rx={px(defaultPuck.radius * 0.95)}
            ry={px(1.5 + (defaultPuck.radius - 3) * camera.flatten)}
            fill={palette.dark}
            opacity={0.18}
          />
          <path data-shell d={line(outline, true)} {...cast} />
          {knurl.map((tick, index) =>
            tick.facing > 0 ? (
              <path
                key={index}
                data-knurl={index}
                d={line([tick.a, tick.b])}
                fill="none"
                stroke={palette.metal}
                strokeWidth={0.7}
                opacity={0.5}
              />
            ) : null,
          )}
          {/* The top face, which is only a face when the camera can see it. */}
          {camera.flatten > 0.05 && (
            <>
              <path data-face d={line(topRim, true)} {...shell} opacity={0.9} />
              {/* Ribs on the face, because from straight above the rim knurl is
                  edge-on and the puck would turn without showing it. */}
              {FACE_MARKS.map((mark, index) => (
                <path
                  key={index}
                  data-face-rib={index}
                  d={line(
                    mark.map((point) =>
                      place({
                        x:
                          frame.u.x * point.x * defaultPuck.radius +
                          frame.w.x * point.y * defaultPuck.radius +
                          frame.v.x * defaultPuck.halfHeight,
                        y:
                          frame.u.y * point.x * defaultPuck.radius +
                          frame.w.y * point.y * defaultPuck.radius +
                          frame.v.y * defaultPuck.halfHeight,
                        z:
                          frame.u.z * point.x * defaultPuck.radius +
                          frame.w.z * point.y * defaultPuck.radius +
                          frame.v.z * defaultPuck.halfHeight,
                      }),
                    ),
                  )}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={0.9}
                  opacity={px(clamp(camera.flatten, 0.25, 0.8))}
                />
              ))}
            </>
          )}
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 15} fontSize={5.5}>
          {`${behavior.toUpperCase()} / ${track.legs.length - 1} BOARDS / ${carrying} U·S`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 6} fontSize={4.8} opacity={0.75}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** Six ribs on the face, in the puck's own unit coordinates. */
const FACE_MARKS: Vec2[][] = Array.from({ length: 6 }, (_, index) => {
  const a = (index / 6) * Math.PI * 2
  return [
    { x: Math.cos(a) * 0.34, y: Math.sin(a) * 0.34 },
    { x: Math.cos(a) * 0.78, y: Math.sin(a) * 0.78 },
  ]
})

export { RobotHockeyPuck }
