"use client"

/**
 * ball-launcher — two wheels, and the two numbers they make.
 *
 * A ball squeezed between counter-rotating wheels leaves with the **mean** of
 * the two contact speeds and turns at their **difference** over its own
 * diameter. That is the whole machine: matched wheels throw it flat and fast
 * with no spin, and every turn of mismatch trades exit speed for rotation.
 * Both numbers come out of `launcherExit` off the same pair of inputs, and
 * both are on the readout — neither is decoration, and neither was typed in.
 *
 * The wheels really are drawn at the speeds they are given: the spokes index by
 * the clock times the rate, so a wheel at half speed visibly turns at half
 * speed and the drum you can see is the drum in the sum.
 *
 * No slip, no compression, no air. A real launcher loses some of the contact
 * speed to the ball skidding through the gap, and a real ball slows down; this
 * one reports the ideal, which is the number the machine is set to.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  ballFrame,
  ballLaces,
  ballSilhouette,
  launcherExit,
} from "@/lib/robocn/gridiron"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  elevationDraft,
  fitFrame,
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

export type LauncherBehavior = "feed" | "spin" | "idle" | "static"

const VIEW_WIDTH = 240
const VIEW_HEIGHT = 190
const NATIVE_VIEW: RobotView = "profile"
const ENVELOPE = boxCorners({ x: -44, y: 0, z: -76 }, { x: 44, y: 108, z: 56 })

/** Drawing frame: `x` toward the muzzle, `y` up from the floor. */
const HUB: Vec2 = { x: -2, y: 58 }
const WHEEL_RADIUS = 16
/** The gap the ball is squeezed through, in drawing units. */
const GAP = 15
const BALL_RADIUS = 9
/** Drawing units in a yard, so the readout can be honest about its units. */
const YARD = 42

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/**
 * Where the ball is in the feed cycle at clock time `t`: negative behind the
 * wheels in the chute, 0 in the gap, positive gone. A pure function of the
 * clock, so a test can sample it instead of faking frames.
 */
export function launcherFeed(behavior: LauncherBehavior, t: number): number {
  const cycle = wrap(t)
  switch (behavior) {
    case "feed":
      // Down the chute, through the gap, away — then the next one.
      return -1 + cycle * 2.4
    case "spin":
      // Wheels up to speed with nothing going through them.
      return -1.4
    case "idle":
      return -1.4
    default:
      return -1.4
  }
}

const viewDirection = (camera: RobotCamera) => ({
  x: camera.depth(1, 0, 0),
  y: camera.depth(0, 1, 0),
  z: camera.depth(0, 0, 1),
})

export interface BallLauncherProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Top wheel speed, turns per second. */
  top?: number
  /** Bottom wheel speed, turns per second. Mismatch is spin. */
  bottom?: number
  /** What the machine does. */
  behavior?: LauncherBehavior
  /** Barrel elevation in degrees above the horizontal. */
  elevation?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up and down to bias the wheels, which is to dial the spin in. */
  interactive?: boolean
  onWheelsChange?: (wheels: { top: number; bottom: number }) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BallLauncher({
  top,
  bottom,
  behavior = "feed",
  elevation = 26,
  view = NATIVE_VIEW,
  showGround = true,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onWheelsChange,
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
}: BallLauncherProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<{ top: number; bottom: number } | null>(null)

  const controlled = top !== undefined || bottom !== undefined
  const setTop = controlled ? rate(top, 34) : (held?.top ?? 34)
  const setBottom = controlled ? rate(bottom, 34) : (held?.bottom ?? 22)
  const running = behavior !== "static" && behavior !== "idle"
  const clock = useRobotClock({
    speed,
    animate: animate && behavior !== "static",
    paused,
    phase,
  })

  // The exit conditions are what the machine is *set* to, so a parked machine
  // still reports them and a person dialling the wheels in sees the numbers
  // move. Only the drawn rotation and the feed stop when it is not running.
  const exit = launcherExit({
    top: setTop,
    bottom: setBottom,
    wheelRadius: WHEEL_RADIUS,
    ballRadius: BALL_RADIUS,
  })
  const feed = launcherFeed(behavior, clock)
  const pitch = clamp(Number.isFinite(elevation) ? elevation : 26, -10, 70)

  const apply = React.useCallback(
    (bias: number) => {
      // One grab dials the difference: the mean stays, the split moves.
      const mean = 28
      const next = {
        top: clamp(mean + bias * 26, 0, 60),
        bottom: clamp(mean - bias * 26, 0, 60),
      }
      setHeld(next)
      onWheelsChange?.(next)
    },
    [onWheelsChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(0.5 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - 24, 10, 1.1)
  const { point: to, path: line, box, bar, disc } = elevationDraft(camera, "profile")
  const look = viewDirection(camera)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // The barrel axis: everything in the head is laid out along it, so elevating
  // the machine moves the wheels, the chute and the muzzle together.
  const a = toRadians(pitch)
  const axis = { x: Math.cos(a), y: Math.sin(a) }
  const across = { x: -Math.sin(a), y: Math.cos(a) }
  const along = (down: number, side: number): Vec2 => ({
    x: HUB.x + axis.x * down + across.x * side,
    y: HUB.y + axis.y * down + across.y * side,
  })
  const offset = WHEEL_RADIUS + GAP / 2
  const topHub = along(0, offset)
  const bottomHub = along(0, -offset)
  const muzzle = along(WHEEL_RADIUS + 10, 0)

  /** A wheel with its spokes indexed by its own rate, so speed is visible. */
  const wheel = (centre: Vec2, turns: number, sign: number, key: string) => {
    const turn = wrap(clock * turns * sign) * 360
    return (
      <g key={key} data-wheel={key}>
        <path d={disc(centre, WHEEL_RADIUS, 7, 0, 22)} {...machined} />
        <path d={disc(centre, WHEEL_RADIUS * 0.34, 7.6, 0, 12)} {...cast} />
        {Array.from({ length: 6 }, (_, index) => {
          const at = toRadians(turn + index * 60)
          const inner: Vec2 = {
            x: centre.x + Math.cos(at) * WHEEL_RADIUS * 0.36,
            y: centre.y + Math.sin(at) * WHEEL_RADIUS * 0.36,
          }
          const outer: Vec2 = {
            x: centre.x + Math.cos(at) * WHEEL_RADIUS * 0.88,
            y: centre.y + Math.sin(at) * WHEEL_RADIUS * 0.88,
          }
          return (
            <path
              key={index}
              data-spoke={index}
              d={line([inner, outer], 7.4)}
              fill="none"
              stroke={variant === "wire" ? palette.grid : palette.dark}
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.75}
            />
          )
        })}
      </g>
    )
  }

  /* The ball: in the chute, in the gap, or on its way out along the axis. */
  const travel = feed * (WHEEL_RADIUS + 26)
  const ballAt = along(travel, 0)
  const gone = feed > 0.1
  const spheroid = ballFrame({
    pitch,
    yaw: 90,
    roll: gone ? clock * exit.spin * 360 : 0,
  })
  const ballShape = { long: BALL_RADIUS * 1.7, waist: BALL_RADIUS }
  const surface = (point: { x: number; y: number; z: number }) =>
    to({ x: ballAt.x - point.z, y: ballAt.y + point.y }, point.x)
  const ballOutline = ballSilhouette(spheroid, ballShape, look, 26).map(surface)
  const ballMarks = ballLaces(spheroid, ballShape, look, 5, 14)

  const spinName = Math.abs(exit.spin) < 0.2 ? "FLAT" : exit.spin > 0 ? "TOPSPIN" : "BACKSPIN"
  const exitSpeed = exit.speed / YARD

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Ball launcher, wheels at ${Math.round(setTop)} and ${Math.round(setBottom)} turns a second, ${exitSpeed.toFixed(0)} yards a second exit with ${Math.abs(exit.spin).toFixed(0)} turns a second of ${spinName.toLowerCase()}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? -100 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(exit.bias * 100 * Math.sign(exit.spin || 1)) : undefined}
      aria-valuetext={interactive ? `${spinName.toLowerCase()}, ${Math.abs(exit.spin).toFixed(0)} turns a second` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const bias = (setTop - setBottom) / 52
        if (event.key === "ArrowUp" || event.key === "ArrowRight") apply(bias + 0.08)
        else if (event.key === "ArrowDown" || event.key === "ArrowLeft") apply(bias - 0.08)
        else if (event.key === "Home") apply(0)
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
      <g data-machine transform={frame.transform}>
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0 }, 0).x)}
            cy={px(to({ x: 0, y: 0 }, 0).y)}
            rx={40}
            ry={px(5 + 5 * camera.flatten)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        <g data-tripod>
          {[
            { foot: { x: -30, y: 0 }, depth: 0 },
            { foot: { x: 18, y: 0 }, depth: 22 },
            { foot: { x: 18, y: 0 }, depth: -22 },
          ].map((leg, index) => (
            <path
              key={index}
              data-leg={index}
              d={bar({ x: HUB.x, y: HUB.y - 12 }, leg.foot, 2.6, 2.6, leg.depth)}
              {...machined}
            />
          ))}
          <path d={box(-8, HUB.y - 18, 6, HUB.y - 8, 12)} {...cast} />
        </g>

        <g data-head>
          {/* The case the wheels turn inside, laid along the barrel axis. */}
          <path
            d={bar(along(-20, offset), along(8, offset), WHEEL_RADIUS * 0.48, 11)}
            {...shell}
          />
          <path
            d={bar(along(-20, -offset), along(8, -offset), WHEEL_RADIUS * 0.48, 11)}
            {...shell}
          />

          <g data-chute>
            <path d={bar(along(-52, 0), along(-WHEEL_RADIUS - 2, 0), 10, 9)} {...machined} />
            <path d={line([along(-52, 10), along(-WHEEL_RADIUS, 10)], 9)} fill="none" stroke={palette.dark} strokeWidth={0.8} opacity={0.6} />
          </g>

          {wheel(topHub, running ? setTop : 0, -1, "top")}
          {wheel(bottomHub, running ? setBottom : 0, 1, "bottom")}

          <path
            data-muzzle
            d={bar(along(WHEEL_RADIUS + 2, 0), muzzle, GAP / 2 + 2, 10)}
            {...cast}
          />
        </g>

        <g data-ball data-away={gone ? "" : undefined}>
          <path
            d={`${ballOutline.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`}
            {...robotSurface("dark", variant, palette)}
          />
          {ballMarks.map((stitch, index) =>
            stitch.facing > 0 ? (
              <line
                key={index}
                data-lace={index}
                x1={px(surface(stitch.a).x)}
                y1={px(surface(stitch.a).y)}
                x2={px(surface(stitch.b).x)}
                y2={px(surface(stitch.b).y)}
                stroke={palette.accent}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            ) : null,
          )}
        </g>

        {/* The exit line: where the ball leaves, at the elevation it leaves on. */}
        <path
          data-exit
          d={line([muzzle, along(WHEEL_RADIUS + 52, 0)], 0)}
          fill="none"
          stroke={palette.accent}
          strokeWidth={0.9}
          strokeDasharray="3 3"
          opacity={px(running ? 0.55 : 0.2)}
        />
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 13} fontSize={5}>
          {`${Math.round(setTop)}/${Math.round(setBottom)} REV·S / ${exitSpeed.toFixed(0)} YD·S / ${Math.abs(exit.spin).toFixed(0)} ${spinName}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 4} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const rate = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 120) : fallback

export { BallLauncher }
