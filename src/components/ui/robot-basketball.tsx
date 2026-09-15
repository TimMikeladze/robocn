"use client"

/**
 * robot-basketball — eight panels, and a bounce that is arithmetic.
 *
 * The panels are cut the way a real one is: two orthogonal great circles divide
 * the sphere into four lunes, and one wavy closed curve — `lat = A·sin(2·lon)` —
 * enters each lune on one meridian and leaves it on the other, splitting it.
 * Four lunes, eight panels, out of three curves, all of them lying on the
 * surface, so turning the ball takes them round the back instead of sliding
 * them across the front.
 *
 * The bounce is the restitution ladder, closed form: every apex is the last one
 * times `e²` and every flight is the last one times `e`, so the ball can be
 * asked where it is at any instant without having run the instants before it.
 * `drop` plays the whole decay; `dribble` is the periodic version, where a
 * paddle hands back exactly what the floor took — that hand-back is the one
 * thing here that is not physics, and it is drawn as a machine so you can see
 * it happening.
 *
 * The maths is in `src/lib/robocn/sport.ts` — pure, no React, tested on its
 * own. Illustrated, and only illustrated: the squash at contact. A real ball's
 * contact patch comes from its inflation pressure and its dwell time, neither
 * of which is modelled — this is impact speed against a reference, so it reads
 * as heavier when it lands harder.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  basketballSeams,
  bounceAt,
  bounceDuration,
  contactSquash,
  dribbleAt,
  rollTurns,
  sphereSilhouette,
  spinFrame,
  surfaceCurve,
  visibleRuns,
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
export type BasketballBehavior = "dribble" | "travel" | "drop" | "spin" | "static"

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 230
const NATIVE_VIEW: RobotView = "profile"

/** The bottom strip the readout sits in; the drawing is fitted above it. */
const TEXT_ROOM = 30
const RADIUS = 23
const APEX = 112
/** The drop plays out over one cycle, so the ladder is visible end to end. */
const RESTITUTION = 0.76
const GRAVITY = 900
/** How far a travelling ball goes each bounce, and how far it may stray. */
const DRIFT = 58
const SPIN_TURNS = 0.7
/** The landing speed a full squash is measured against, in these units. */
const IMPACT_REFERENCE = 460
/**
 * The floor is a *plane*, so it is drawn as one. A line along a single world
 * axis collapses to a stick the moment the camera looks down that axis — which
 * is exactly what a side elevation does — where a patch foreshortens into a
 * parallelogram from every angle and never degenerates.
 */
const FLOOR_PATCH: Vec2[] = [
  { x: -84, y: 44 },
  { x: 84, y: 44 },
  { x: 84, y: -44 },
  { x: -84, y: -44 },
]
/** What every camera has to fit: the floor, the ball's apex, and the paddle. */
const ENVELOPE = boxCorners({ x: -84, y: 0, z: -44 }, { x: 84, y: 172, z: 44 })

const bounceOptions = { drop: APEX, restitution: RESTITUTION, gravity: GRAVITY, contact: 0.04 }
const SETTLE = bounceDuration(bounceOptions)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const descriptions: Record<BasketballBehavior, string> = {
  dribble: "dribbling on a paddle",
  travel: "bouncing across the floor",
  drop: "dropped, and running down its restitution ladder",
  spin: "held up and turning",
  static: "held still",
}

/** Which way the camera lies from the ball: the gradient of its own depth. */
function viewDirection(camera: RobotCamera): Vec3 {
  return { x: camera.depth(1, 0, 0), y: camera.depth(0, 1, 0), z: camera.depth(0, 0, 1) }
}

export interface BasketballPose {
  /** Bottom of the ball above the floor. */
  height: number
  /** Revolutions turned, for the panels to follow. */
  turns: number
  /** 1 at an impact, decaying to 0 — what the squash is drawn from. */
  contact: number
  /** Speed of the impact that contact belongs to. */
  impact: number
  /** Where the paddle is, or null when nothing is driving the ball. */
  paddle: number | null
  /** How far across the floor the ball has strayed. */
  drift: number
}

const REST: BasketballPose = { height: 0, turns: 0, contact: 0, impact: 0, paddle: null, drift: 0 }

/**
 * Every behaviour is a pure function of the clock, exported so motion is tested
 * by sampling it rather than by faking animation frames.
 */
export function basketballPose(behavior: BasketballBehavior, clock: number): BasketballPose {
  if (!Number.isFinite(clock)) return REST
  switch (behavior) {
    case "dribble": {
      const state = dribbleAt(clock, { apex: APEX, reach: APEX * 1.22 })
      return {
        height: state.height,
        turns: clock * SPIN_TURNS,
        contact: state.contact,
        impact: Math.abs(state.velocity),
        paddle: state.paddle,
        drift: 0,
      }
    }
    case "travel": {
      const state = dribbleAt(clock, { apex: APEX * 0.78, reach: APEX })
      // It rolls on every contact, so the spin it leaves with is the distance
      // it covered over its own circumference.
      const drift = DRIFT * Math.sin((Math.PI * clock) / 2)
      return {
        height: state.height,
        turns: rollTurns(drift, RADIUS),
        contact: state.contact,
        impact: Math.abs(state.velocity),
        paddle: null,
        drift,
      }
    }
    case "drop": {
      const state = bounceAt((((clock % 1) + 1) % 1) * SETTLE, bounceOptions)
      return {
        height: state.height,
        turns: clock * SPIN_TURNS * 0.5,
        contact: state.contact,
        impact: state.impact,
        paddle: null,
        drift: 0,
      }
    }
    case "spin":
      return { ...REST, height: APEX * 0.42, turns: clock * SPIN_TURNS * 1.6 }
    default:
      return REST
  }
}

export interface RobotBasketballProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled height off the floor, 0 down to 1 at the apex. Stops the loop. */
  height?: number
  onHeightChange?: (height: number) => void
  behavior?: BasketballBehavior
  showGround?: boolean
  seams?: boolean
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

function RobotBasketball({
  height,
  onHeightChange,
  behavior = "dribble",
  showGround = true,
  seams = true,
  view = NATIVE_VIEW,
  speed = 0.9,
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
}: RobotBasketballProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = height !== undefined

  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase,
  })
  const running = basketballPose(behavior, clock)
  const pinned = controlled
    ? Number.isFinite(height) ? clamp(height as number, 0, 1) : 0
    : held
  // Picking the ball up stops the bounce: there is no impact to squash from.
  const pose: BasketballPose =
    pinned === null
      ? running
      : { ...REST, height: pinned * APEX, turns: running.turns }

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onHeightChange?.(bounded)
    },
    [onHeightChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const fitted = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - TEXT_ROOM)
  const look = viewDirection(camera)
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  const squash = contactSquash(pose.contact, pose.impact, IMPACT_REFERENCE)
  // Squashed, the ball keeps its footprint on the floor rather than sinking.
  const centre: Vec3 = {
    x: pose.drift,
    y: pose.height + RADIUS * (1 - squash),
    z: 0,
  }
  const place = (point: Vec3): Vec3 => ({
    x: centre.x + point.x * (1 + squash * 0.5),
    y: centre.y + point.y * (1 - squash),
    z: centre.z + point.z * (1 + squash * 0.5),
  })

  const frame = spinFrame({ x: 1, y: 0.22, z: 0 }, pose.turns)
  const outline = sphereSilhouette(RADIUS, look, 52).map((p) => to(place(p)))
  const ribs = SEAMS.map((seam) => surfaceCurve(frame, RADIUS, seam, look))

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const seamPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.dark,
    strokeWidth: variant === "solid" ? 2 : 1.1,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }

  // Bound out of the pose so the narrowing survives into the map below.
  const paddle = pose.paddle
  const readout = `${Math.round((pose.height / APEX) * 100)}%`
  const settled = pose.height < 0.5 && pose.contact < 0.02

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Robot basketball, ${descriptions[behavior] ?? descriptions.static}, ${readout} of the apex, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(clamp(pose.height / APEX, 0, 1)) : undefined}
      aria-valuetext={interactive ? `${readout} of the apex` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.25)
        if (delta !== 0) apply(clamp(pose.height / APEX, 0, 1) + delta)
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
              d={line(FLOOR_PATCH.map((corner) => to({ x: corner.x, y: 0, z: corner.y })), true)}
              fill={variant === "solid" ? palette.dark : "none"}
              fillOpacity={0.07}
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.45}
            />
            {/* The shadow tightens as the ball comes down, which is the only
                cue for height once the camera tips toward plan. */}
            <ellipse
              data-shadow
              cx={px(to({ x: pose.drift, y: 0, z: 0 }).x)}
              cy={px(to({ x: pose.drift, y: 0, z: 0 }).y)}
              rx={px(RADIUS * (0.55 + 0.45 * clamp(1 - pose.height / APEX, 0, 1)))}
              ry={px(2 + (RADIUS - 4) * camera.flatten)}
              fill={palette.dark}
              opacity={px(clamp(0.22 - (pose.height / APEX) * 0.14, 0.05, 0.22))}
            />
          </>
        )}

        {paddle !== null && (
          <g data-paddle>
            <path
              data-plate
              d={line(
                PADDLE_PLATE.map((corner) =>
                  to({ x: pose.drift + corner.x, y: paddle, z: corner.y }),
                ),
                true,
              )}
              {...machined}
            />
            <path
              data-stem
              d={line([
                to({ x: pose.drift, y: paddle, z: 0 }),
                to({ x: pose.drift, y: paddle + 26, z: 0 }),
              ])}
              fill="none"
              stroke={palette.metal}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        )}

        <g data-ball>
          <path data-shell d={line(outline, true)} {...shell} />

          {seams &&
            ribs.map((rib, index) =>
              visibleRuns(rib).map((run, part) => (
                <path
                  key={`${index}-${part}`}
                  data-seam={index}
                  d={line(run.map((mark) => to(place(mark.point))))}
                  {...seamPaint}
                />
              )),
            )}

          {variant === "solid" && (
            <ellipse
              data-highlight
              cx={px(to(place({ x: -RADIUS * 0.34, y: RADIUS * 0.46, z: RADIUS * 0.5 })).x)}
              cy={px(to(place({ x: -RADIUS * 0.34, y: RADIUS * 0.46, z: RADIUS * 0.5 })).y)}
              rx={7}
              ry={4.6}
              fill={palette.glow}
              opacity={0.15}
            />
          )}
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 15} fontSize={5.5}>
          {`${behavior.toUpperCase()} / e ${RESTITUTION} / ${settled ? "DOWN" : readout}`}
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

/** The driving plate, in the floor's own plane so it reads from every camera. */
const PADDLE_PLATE: Vec2[] = [
  { x: -19, y: 11 },
  { x: 19, y: 11 },
  { x: 19, y: -11 },
  { x: -19, y: -11 },
]

/** Cut once: every basketball ever drawn has the same three curves on it. */
const SEAMS = basketballSeams(32, 80)

export { RobotBasketball }
