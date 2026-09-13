"use client"

/**
 * robot-football — the ball, modelled rather than drawn.
 *
 * It is a prolate spheroid, so its outline is the ellipsoid's own central
 * section and not an oval someone tuned: end-on it is a circle of the waist
 * radius, broadside it reaches the full length, and every angle between comes
 * out of the same two numbers. The laces are stitches on the surface with real
 * normals, which is why a spiral takes them round the back and brings them out
 * the other side instead of sliding them across the front.
 *
 * The seams and bands are drawn only where the camera can see them — each mark
 * carries the sign of its own normal against the view — so nothing is painted
 * on the far side of the ball and left showing.
 *
 * There is no air in here. The ball spins and precesses; it does not decay, and
 * a component that throws it gets a drag-free parabola.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  ballFrame,
  ballLaces,
  ballPoint,
  ballSeam,
  ballSilhouette,
  ballStripes,
  ballTip,
  defaultBall,
  flightAttitude,
  type BallFlight,
  type BallMark,
} from "@/lib/robocn/gridiron"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
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

export type FootballBehavior = BallFlight | "static"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 150
const CENTRE: Vec2 = { x: 100, y: 68 }
const SCALE = 3.9
const NATIVE_VIEW: RobotView = "profile"
/** How far the ball lifts off the turf through a snap, in world units. */
const SNAP_RISE = 9

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Which way the camera lies from the ball: the gradient of its own depth. */
function viewDirection(camera: RobotCamera): Vec3 {
  return {
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  }
}

/**
 * The runs of a ring the camera can actually see. A band round the ball is
 * visible over an arc, not everywhere, and splitting it into runs is what
 * keeps the far half off the drawing.
 */
function visibleRuns(marks: readonly BallMark[], closed = true): BallMark[][] {
  const runs: BallMark[][] = []
  let current: BallMark[] = []
  const count = marks.length
  for (let index = 0; index < count; index += 1) {
    const mark = marks[index]
    if (mark.facing > 0) current.push(mark)
    else if (current.length) {
      runs.push(current)
      current = []
    }
  }
  if (current.length) runs.push(current)
  if (closed && runs.length === 1 && runs[0].length === count && count > 2) {
    // Nose-on, a band round the ball is a complete circle: close it.
    return [[...runs[0], runs[0][0]]]
  }
  // A closed ring whose first and last points are both visible is one run.
  if (closed && runs.length > 1 && marks[0]?.facing > 0 && marks[count - 1]?.facing > 0) {
    const first = runs.shift()
    runs[runs.length - 1] = [...runs[runs.length - 1], ...(first ?? [])]
  }
  return runs.filter((run) => run.length > 1)
}

export interface RobotFootballProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled roll about the long axis, in degrees. Any of the three stops the loop. */
  roll?: number
  /** Controlled nose attitude, in degrees. */
  pitch?: number
  yaw?: number
  /** What the ball does when it is not being driven. */
  behavior?: FootballBehavior
  /** Turns about the long axis per cycle. */
  spin?: number
  /** Half-angle of the precession cone, in degrees. Omit and the flight picks one. */
  wobble?: number
  /** Where the camera stands. One ball, four projections. */
  view?: RobotView
  laces?: boolean
  stripes?: boolean
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to roll it, up and down to pitch it. */
  interactive?: boolean
  onAttitudeChange?: (attitude: { yaw: number; pitch: number; roll: number }) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotFootball({
  roll,
  pitch,
  yaw,
  behavior = "spiral",
  spin = 6,
  wobble,
  view = NATIVE_VIEW,
  laces = true,
  stripes = true,
  showGround = true,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onAttitudeChange,
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
  ...props
}: RobotFootballProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<{ roll: number; pitch: number } | null>(null)

  const controlled = roll !== undefined || pitch !== undefined || yaw !== undefined
  const flight: BallFlight = behavior === "static" ? "hold" : behavior
  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase,
  })

  const running = flightAttitude(flight, clock, { spin, wobble })
  const attitude = {
    yaw: controlled ? finiteClamp(yaw ?? 0, -180, 180) : running.yaw,
    pitch: controlled
      ? finiteClamp(pitch ?? 0, -180, 180)
      : (held?.pitch ?? running.pitch),
    roll: controlled ? finiteClamp(roll ?? 0, -3600, 3600) : (held?.roll ?? running.roll),
  }

  const apply = React.useCallback(
    (next: { roll: number; pitch: number }) => {
      const bounded = {
        roll: clamp(next.roll, -3600, 3600),
        pitch: clamp(next.pitch, -90, 90),
      }
      setHeld(bounded)
      onAttitudeChange?.({ yaw: 0, ...bounded })
    },
    [onAttitudeChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => apply({ roll: (unit.x - 0.5) * 720, pitch: (0.5 - unit.y) * 120 }),
      [apply],
    ),
    onDragEnd: React.useCallback(() => {}, []),
  })

  const camera = robotCamera(view)
  const look = viewDirection(camera)
  const frame = ballFrame(attitude)
  // The snap is the one flight that leaves the ground, so it is the one that
  // moves the ball in the frame rather than only turning it.
  const rise =
    flight === "snap" && !controlled
      ? Math.sin(Math.PI * Math.min(1, ((clock % 1) + 1) % 1 * 1.7)) * SNAP_RISE
      : 0

  const to = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y + rise, point.z)
    return { x: CENTRE.x + screen.x * SCALE, y: CENTRE.y + screen.y * SCALE }
  }
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  const outline = ballSilhouette(frame, defaultBall, look, 56).map(to)
  const seam = ballSeam(frame, defaultBall, look, 26)
  const bands = ballStripes(frame, defaultBall, look, 0.62, 30)
  const stitches = ballLaces(frame, defaultBall, look, 8, 15)
  const nose = to(ballTip(frame, defaultBall, 1))
  const tail = to(ballTip(frame, defaultBall, -1))

  const shell = robotSurface("shell", variant, palette)
  const seamPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.dark,
    strokeWidth: variant === "solid" ? 1.6 : 1,
    strokeLinecap: "round" as const,
  }
  const bandPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.metal,
    strokeWidth: variant === "solid" ? 3.2 : 1.1,
    strokeLinecap: "round" as const,
  }
  const lacePaint = {
    stroke: variant === "wire" ? palette.grid : palette.accent,
    strokeWidth: variant === "solid" ? 2 : 1.1,
    strokeLinecap: "round" as const,
  }

  const turns = Math.round(Math.abs(spin) * Math.abs(speed) * 10) / 10
  const readout = `${Math.round(attitude.pitch)}° / ${Math.round(((attitude.roll % 360) + 360) % 360)}°`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot football, ${describe(behavior)}, ${readout} attitude, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? -90 : undefined}
      aria-valuemax={interactive ? 90 : undefined}
      aria-valuenow={interactive ? Math.round(attitude.pitch) : undefined}
      aria-valuetext={interactive ? `nose ${Math.round(attitude.pitch)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const current = held ?? { roll: attitude.roll, pitch: attitude.pitch }
        if (event.key === "ArrowRight") apply({ ...current, roll: current.roll + 15 })
        else if (event.key === "ArrowLeft") apply({ ...current, roll: current.roll - 15 })
        else if (event.key === "ArrowUp") apply({ ...current, pitch: current.pitch + 6 })
        else if (event.key === "ArrowDown") apply({ ...current, pitch: current.pitch - 6 })
        else if (event.key === "Home") apply({ roll: 0, pitch: 0 })
        else if (event.key === "End") setHeld(null)
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
      data-view={view}
      {...props}
    >
      {showGround && (
        <ellipse
          data-ground
          cx={CENTRE.x}
          cy={px(CENTRE.y + defaultBall.waist * SCALE + 14)}
          rx={px(defaultBall.long * SCALE * 0.5)}
          ry={px(4 + 2 * camera.flatten)}
          fill={palette.dark}
          opacity={px(clamp(0.18 - rise * 0.012, 0.05, 0.18))}
        />
      )}

      <g data-ball data-flight={behavior}>
        <path data-shell d={line(outline, true)} {...shell} />

        {stripes &&
          bands.map((ring, index) =>
            visibleRuns(ring).map((run, part) => (
              <path
                key={`${index}-${part}`}
                data-stripe={index}
                d={line(run.map((mark) => to(mark.point)))}
                {...bandPaint}
              />
            )),
          )}

        {visibleRuns(seam, false).map((run, part) => (
          <path key={part} data-seam d={line(run.map((mark) => to(mark.point)))} {...seamPaint} />
        ))}

        {laces &&
          stitches.map((stitch, index) =>
            stitch.facing > 0 ? (
              <line
                key={index}
                data-lace={index}
                x1={px(to(stitch.a).x)}
                y1={px(to(stitch.a).y)}
                x2={px(to(stitch.b).x)}
                y2={px(to(stitch.b).y)}
                {...lacePaint}
              />
            ) : null,
          )}

        {/* The tips are the one place the outline has a corner, so they get a
            collar rather than being left as a point. */}
        <circle data-nose cx={px(nose.x)} cy={px(nose.y)} r={2.2} fill={palette.dark} opacity={0.55} />
        <circle data-tail cx={px(tail.x)} cy={px(tail.y)} r={2.2} fill={palette.dark} opacity={0.3} />

        {variant === "solid" && (
          <ellipse
            data-highlight
            cx={px(to(ballPoint(frame, defaultBall, 0.18, -58)).x)}
            cy={px(to(ballPoint(frame, defaultBall, 0.18, -58)).y)}
            rx={9}
            ry={5}
            fill={palette.glow}
            opacity={0.14}
          />
        )}
      </g>

      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.6}>
          <path
            d={`M ${px(nose.x)} ${px(nose.y)} L ${px(tail.x)} ${px(tail.y)}`}
            strokeDasharray="3 3"
          />
        </g>
      )}

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={132} fontSize={5}>
          {`${behavior.toUpperCase()} / ${readout} / ${turns} REV·S`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={141} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const descriptions: Record<FootballBehavior, string> = {
  spiral: "spinning on a tight spiral",
  wobble: "wobbling on an open cone",
  tumble: "tumbling end over end",
  snap: "coming off the turf",
  hold: "held still",
  static: "held still",
}

const describe = (behavior: FootballBehavior) =>
  descriptions[behavior] ?? descriptions.static

const finiteClamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : 0

export { RobotFootball }
