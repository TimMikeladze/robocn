"use client"

/**
 * robot-soccer-ball — a truncated icosahedron, inflated.
 *
 * The panels are not drawn. Truncate a regular icosahedron at exactly one third
 * of every edge and all sixty vertices land the same distance from the centre;
 * that is the Archimedean solid, twelve pentagons where the old vertices were
 * and twenty hexagons on the old faces. Push the vertices out onto the sphere,
 * subdivide each edge along its great circle, and the panels bulge the way an
 * inflated ball's do. Each one carries its own normal, so the far side of the
 * ball is culled and a panel straddling the horizon is clipped onto the limb
 * rather than folded across the front.
 *
 * `roll` is the honest one: the ball's turn is `θ = s / r`, so the panels come
 * round *because* it travelled, and rolling it backwards unrolls them. Grab it
 * and drag, and the same relation holds under your finger. `bend` is the other
 * equation — a vertical spin axis, so `ω × v` points sideways and the ball
 * leaves the line it was struck along; the dashed line is the same kick with
 * the spin taken out, so the gap between them is the bend.
 *
 * The maths is in `src/lib/robocn/sport.ts` — pure, no React, tested on its
 * own. No air: nothing decays, and the Magnus term is held at its release
 * value, which makes the whole flight one quadratic.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  applyFrame,
  clipToLimb,
  dribbleAt,
  flightAt,
  rollTurns,
  soccerPanels,
  sphereSilhouette,
  spinFrame,
  type SpherePanel,
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
export type SoccerBallBehavior = "roll" | "bend" | "juggle" | "spin" | "static"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 200
const NATIVE_VIEW: RobotView = "profile"

/** The bottom strip the readout sits in; the drawing is fitted above it. */
const TEXT_ROOM = 30
const RADIUS = 21
/** How far the ball rolls each way, and where a struck ball starts. */
const TRAVEL = 60
const KICK_FROM: Vec3 = { x: 0, y: 0, z: 62 }
const KICK_SPEED = 150
const KICK_LAUNCH = 34
const KICK_GRAVITY = 168
const KICK_TIME = 1
/** Eight turns a second about a standing axis: that is what bends a free kick. */
const KICK_SPIN = { rate: 8, axis: { x: 0, y: 1, z: 0 } }
const MAGNUS = 0.0048
const SPIN_TURNS = 1.1
/**
 * The ground is a *plane*, so it is drawn as one. A line along a single world
 * axis collapses to a stick the moment the camera looks down that axis — which
 * is exactly what a side elevation does — where a patch foreshortens into a
 * parallelogram from every angle and never degenerates.
 */
const GROUND_PATCH: Vec2[] = [
  { x: -92, y: 88 },
  { x: 92, y: 88 },
  { x: 92, y: -88 },
  { x: -92, y: -88 },
]
/**
 * What every camera has to fit: the roll both ways, the kick from strike to
 * landing, the juggle's apex, and the ball's own radius around all of it.
 */
const ENVELOPE = boxCorners({ x: -92, y: 0, z: -92 }, { x: 92, y: 102, z: 92 })

const kickOptions = {
  speed: KICK_SPEED,
  launch: KICK_LAUNCH,
  gravity: KICK_GRAVITY,
  magnus: MAGNUS,
  from: KICK_FROM,
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const descriptions: Record<SoccerBallBehavior, string> = {
  roll: "rolling without slipping",
  bend: "bending off the line it was struck along",
  juggle: "being juggled",
  spin: "held up and turning",
  static: "held still",
}

/** Which way the camera lies from the ball: the gradient of its own depth. */
function viewDirection(camera: RobotCamera): Vec3 {
  return { x: camera.depth(1, 0, 0), y: camera.depth(0, 1, 0), z: camera.depth(0, 0, 1) }
}

export interface SoccerPose {
  /** Centre of the ball; `y` is the height of its underside above the floor. */
  position: Vec3
  /** Revolutions turned about `axis`. */
  turns: number
  axis: Vec3
  airborne: boolean
}

const ROLL_AXIS: Vec3 = { x: 0, y: 0, z: -1 }
const REST: SoccerPose = {
  position: { x: 0, y: 0, z: 0 },
  turns: 0,
  axis: ROLL_AXIS,
  airborne: false,
}

/** Where a ball that has rolled `drift` sits, and how far round it has gone. */
export const rolledTo = (drift: number): SoccerPose => ({
  position: { x: drift, y: 0, z: 0 },
  turns: rollTurns(drift, RADIUS),
  axis: ROLL_AXIS,
  airborne: false,
})

/**
 * Every behaviour is a pure function of the clock, exported so motion is tested
 * by sampling it rather than by faking animation frames.
 */
export function soccerPose(behavior: SoccerBallBehavior, clock: number): SoccerPose {
  if (!Number.isFinite(clock)) return REST
  switch (behavior) {
    case "roll":
      // Rolling both ways, and the turn follows the travel in both directions.
      return rolledTo(TRAVEL * Math.sin(Math.PI * 2 * clock))
    case "bend": {
      const along = ((clock % 1) + 1) % 1
      const flight = flightAt(along * KICK_TIME, { ...kickOptions, spin: KICK_SPIN })
      return {
        position: flight.position,
        turns: flight.turns,
        axis: KICK_SPIN.axis,
        airborne: true,
      }
    }
    case "juggle": {
      const state = dribbleAt(clock, { apex: TRAVEL * 0.9 })
      return {
        position: { x: 0, y: state.height, z: 0 },
        turns: clock * SPIN_TURNS * 0.4,
        axis: { x: 1, y: 0.2, z: 0 },
        airborne: true,
      }
    }
    case "spin":
      return {
        position: { x: 0, y: RADIUS * 0.9, z: 0 },
        turns: clock * SPIN_TURNS,
        axis: { x: 0.24, y: 1, z: 0.1 },
        airborne: true,
      }
    default:
      return REST
  }
}

export interface RobotSoccerBallProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Controlled roll, 0 at the far left to 1 at the far right. Supplying it
   * stops the loop — and the ball still turns exactly as far as it moved.
   */
  travel?: number
  onTravelChange?: (travel: number) => void
  behavior?: SoccerBallBehavior
  showGround?: boolean
  /**
   * Draw the kick, and the same kick with the spin taken out. It comes off the
   * moment someone takes the ball in hand — a rolled ball is not on that arc,
   * and drawing a trajectory the object is not following is a lie.
   */
  showPath?: boolean
  panels?: boolean
  /** Where the camera stands. `plan` is where a bend reads. */
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

function RobotSoccerBall({
  travel,
  onTravelChange,
  behavior = "roll",
  showGround = true,
  showPath = true,
  panels = true,
  view = NATIVE_VIEW,
  speed = 0.35,
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
}: RobotSoccerBallProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = travel !== undefined

  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase,
  })
  const pinned = controlled
    ? Number.isFinite(travel) ? clamp(travel as number, 0, 1) : 0.5
    : held
  const pose =
    pinned === null ? soccerPose(behavior, clock) : rolledTo(lerp(-TRAVEL, TRAVEL, pinned))

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onTravelChange?.(bounded)
    },
    [onTravelChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const fitted = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - TEXT_ROOM)
  const look = viewDirection(camera)
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  const centre: Vec3 = {
    x: pose.position.x,
    y: pose.position.y + RADIUS,
    z: pose.position.z,
  }
  const place = (point: Vec3): Vec3 => ({
    x: centre.x + point.x,
    y: centre.y + point.y,
    z: centre.z + point.z,
  })

  const frame = spinFrame(pose.axis, pose.turns)
  const outline = sphereSilhouette(RADIUS, look, 96).map((p) => to(place(p)))

  // Only the panels the camera can see, limb-most first so a clipped sliver
  // paints under the panel it belongs beside rather than over it.
  const facing = PANELS.map((panel) => ({
    panel,
    towards: dot(applyFrame(frame, panel.centre), look),
  }))
    .filter((entry) => entry.towards > -0.08)
    .sort((a, b) => a.towards - b.towards)

  const sample = (withSpin: boolean) =>
    Array.from({ length: 29 }, (_, index) =>
      to(
        flightAt((index / 28) * KICK_TIME, {
          ...kickOptions,
          spin: withSpin ? KICK_SPIN : { rate: 0, axis: KICK_SPIN.axis },
        }).position,
      ),
    )

  const shell = robotSurface("shell", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const seamPaint = {
    stroke: variant === "wire" ? palette.grid : palette.dark,
    strokeWidth: variant === "solid" ? 0.9 : 0.7,
    strokeLinejoin: "round" as const,
  }

  const rolled = Math.round(pose.turns * 360)
  const percent = Math.round(clamp((pose.position.x + TRAVEL) / (2 * TRAVEL), 0, 1) * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Robot soccer ball, ${descriptions[behavior] ?? descriptions.static}, ${rolled} degrees round, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(percent / 100) : undefined}
      aria-valuetext={interactive ? `${rolled} degrees round` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.2)
        if (delta !== 0) apply(percent / 100 + delta)
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
        {showGround && (
          <>
            <path
              data-ground
              d={line(GROUND_PATCH.map((corner) => to({ x: corner.x, y: 0, z: corner.y })), true)}
              fill={variant === "solid" ? palette.dark : "none"}
              fillOpacity={0.07}
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.45}
            />
            <ellipse
              data-shadow
              cx={px(to({ x: centre.x, y: 0, z: centre.z }).x)}
              cy={px(to({ x: centre.x, y: 0, z: centre.z }).y)}
              rx={px(RADIUS * 0.92)}
              ry={px(2 + (RADIUS - 5) * camera.flatten)}
              fill={palette.dark}
              opacity={px(clamp(0.2 - pose.position.y * 0.002, 0.05, 0.2))}
            />
          </>
        )}

        {showPath && behavior === "bend" && pinned === null && (
          <>
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
          <path data-shell d={line(outline, true)} {...shell} />

          {panels &&
            facing.map(({ panel }, index) => (
              <path
                key={index}
                data-panel={panel.kind}
                d={line(
                  panel.vertices.map((vertex) =>
                    to(place(scaled(clipToLimb(applyFrame(frame, vertex), look), RADIUS))),
                  ),
                  true,
                )}
                {...(panel.kind === "pentagon" ? cast : shell)}
                {...seamPaint}
              />
            ))}

          {variant === "solid" && (
            <ellipse
              data-highlight
              cx={px(to(place({ x: -RADIUS * 0.34, y: RADIUS * 0.46, z: RADIUS * 0.5 })).x)}
              cy={px(to(place({ x: -RADIUS * 0.34, y: RADIUS * 0.46, z: RADIUS * 0.5 })).y)}
              rx={6}
              ry={4}
              fill={palette.glow}
              opacity={0.14}
            />
          )}
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 15} fontSize={5.5}>
          {`${behavior.toUpperCase()} / 32 PANELS / ${rolled}°`}
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

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const scaled = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s })

/** Cut once: the solid is the same one every time. */
const PANELS: SpherePanel[] = soccerPanels(3)

export { RobotSoccerBall }
