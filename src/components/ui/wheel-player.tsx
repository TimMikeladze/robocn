"use client"

/**
 * wheel-player — a pocket media player, and the click wheel that drives it.
 *
 * The wheel is geared to the list: one full turn is exactly one pass of it,
 * however many rows there are, so `rotation` and the highlighted row can never
 * disagree. Scroll off the top and you land on the bottom — the detents wrap
 * in both directions rather than stopping at a negative row.
 *
 * The hold switch is a real interlock: with it on the wheel takes no pointer,
 * no key and no behaviour, which is what the switch on the top edge is for.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { detent, listWindow, panelTransform, wheelSegment } from "@/lib/robocn/device"
import { clamp, toDegrees, type Vec2 } from "@/lib/robocn/kinematics"
import {
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 130
const VIEW_HEIGHT = 208
const ORIGIN = { x: 65, y: 160 }

/** World units: x starboard, y up, z toward the back. */
const HALF_W = 34
const BODY_H = 112
const HALF_T = 6.5
/** Face coordinates: the front panel is 68 across and 112 down. */
const FACE_W = HALF_W * 2
const WHEEL = { x: 34, y: 80, r: 24, hub: 9 }
/** How many rows the display can show at once. */
const VISIBLE = 5
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 720
const NATIVE_VIEW: RobotView = "front"

/** How long the list is, as a pure function of the prop. */
const listRows = (rows: number) =>
  Number.isFinite(rows) ? clamp(Math.round(rows), 3, 12) : 8

const frames: Record<RobotView, { zoom: number; dx: number; dy: number }> = {
  plan: { zoom: 1, dx: 0, dy: -56 },
  front: { zoom: 0.96, dx: 0, dy: 0 },
  profile: { zoom: 0.96, dx: 0, dy: 0 },
  iso: { zoom: 0.88, dx: 6, dy: -4 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type PlayerBehavior = "scroll" | "seek" | "static"
export type PlayerScreen = "list" | "now-playing" | "off"

export interface WheelPlayerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled wheel rotation in degrees. Omit to run `behavior`. */
  rotation?: number
  /** What the wheel does when `rotation` is not supplied. */
  behavior?: PlayerBehavior
  /** Rows in the list, clamped 3–12. One turn of the wheel covers all of them. */
  rows?: number
  /** The hold switch. On, nothing moves the wheel. */
  locked?: boolean
  /** Where the camera stands. One player, four projections. */
  view?: RobotView
  /** Turns of the wheel per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the wheel, or arrow-key it a row at a time. */
  interactive?: boolean
  onRotationChange?: (rotation: number) => void
  onRowChange?: (row: number) => void
  /** What the display is showing. Structure only — no application artwork. */
  screen?: PlayerScreen
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function WheelPlayer({
  rotation,
  behavior = "scroll",
  rows = 8,
  locked = false,
  view = NATIVE_VIEW,
  speed = 0.22,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onRotationChange,
  onRowChange,
  screen = "list",
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
}: WheelPlayerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const count = listRows(rows)
  /** One full turn is one pass of the list, whatever its length. */
  const step = 360 / count
  const controlled = rotation !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled
    ? Number.isFinite(rotation)
      ? (rotation as number)
      : 0
    : locked
      ? 0
      : held
  const goal = React.useCallback((clock: number) => playerGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && !locked && behavior !== "static",
    paused,
    phase,
  })
  const turn = Number.isFinite(motion.value) ? motion.value : 0
  const wheel = detent(turn, count, step)
  const segment = wheelSegment(turn)

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.front
  const face = panelTransform(
    camera,
    { x: HALF_W, y: BODY_H, z: -HALF_T },
    { x: -HALF_W, y: BODY_H, z: -HALF_T },
    { x: HALF_W, y: 0, z: -HALF_T },
    FACE_W,
    BODY_H,
  )
  const showFace = face.facing > 0.18

  /** The wheel's hub, in viewBox units, so a drag can be measured about it. */
  const hubWorld = camera.project(0, BODY_H - WHEEL.y, -HALF_T)
  const hub = {
    x: ORIGIN.x + frame.dx + hubWorld.x * frame.zoom,
    y: ORIGIN.y + frame.dy + hubWorld.y * frame.zoom,
  }
  // The drag reads the hub and the current angle through a ref. Closing over
  // them instead would rebind the pointer listeners on every animation frame,
  // and the drag would lose the pointer it had captured after the first move.
  const grab = React.useRef({ hub, turn })
  React.useEffect(() => {
    grab.current = { hub, turn }
  })

  const apply = React.useCallback(
    (next: number) => {
      if (locked) return
      const list = listRows(rows)
      setHeld(next)
      onRotationChange?.(next)
      onRowChange?.(detent(next, list, 360 / list).index)
    },
    [locked, onRotationChange, onRowChange, rows, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && !locked,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const { hub: at, turn: now } = grab.current
        const point = { x: unit.x * VIEW_WIDTH, y: unit.y * VIEW_HEIGHT }
        const thumb = toDegrees(Math.atan2(point.y - at.y, point.x - at.x))
        // Unwrap onto the turn the wheel is already on, so dragging past the
        // top of the list carries on instead of spinning a whole turn back.
        apply(thumb + Math.round((now - thumb) / 360) * 360)
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const body = extrudedPath(roundedFootprint(HALF_W, HALF_T, 3.5, 4), camera, BODY_H, 0)
  const visible = listWindow(wheel.index, count, VISIBLE)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)
  const live = locked ? palette.metal : palette.accent

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Wheel player, row ${wheel.index + 1} of ${count}, ${locked ? "hold on" : segment ?? "wheel centred"}, ${screen} screen, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 1 : undefined}
      aria-valuemax={interactive ? count : undefined}
      aria-valuenow={interactive ? wheel.index + 1 : undefined}
      aria-valuetext={interactive ? `row ${wheel.index + 1} of ${count}` : undefined}
      aria-disabled={interactive && locked ? true : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || locked || event.defaultPrevented) return
        const delta = arrowStep(event.key, step, step * 3)
        if (delta !== 0) apply(turn + delta)
        else if (event.key === "Home") apply(0)
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
        interactive && !locked &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      {...props}
    >
      <g transform={`translate(${px(ORIGIN.x + frame.dx)} ${px(ORIGIN.y + frame.dy)}) scale(${frame.zoom})`}>
        <path data-body d={body} {...shell} />
        {/* The hold switch and the jack, on the top edge — the only thing a
            plan camera can see of a handheld. */}
        <g data-top transform={camera.plane(BODY_H)}>
          <rect x={-16} y={-2.6} width={12} height={5.2} rx={1.6} {...cast} />
          <rect data-lock x={locked ? -13 : -15.4} y={-1.6} width={5} height={3.2} rx={1.2} fill={locked ? palette.accent : palette.metal} />
          <circle cx={12} cy={0} r={3} {...cast} />
        </g>
        {showFace && (
          <g data-face transform={face.transform}>
            <rect x={3} y={3} width={62} height={106} rx={4} {...machined} fillOpacity={variant === "solid" ? 0.45 : undefined} />
            <rect data-screen x={6} y={7} width={56} height={44} rx={2} {...glass} />
            {screen !== "off" && (
              <ScreenContent
                screen={screen}
                palette={palette}
                rows={count}
                index={wheel.index}
                visible={visible}
                progress={wheel.offset / count}
              />
            )}

            <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.r} {...cast} />
            <g data-wheel data-rotation={px(turn)} transform={`rotate(${px(turn)} ${WHEEL.x} ${WHEEL.y})`}>
              <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.r - 1.5} {...machined} />
              {Array.from({ length: count }, (_, i) => {
                const a = (i / count) * Math.PI * 2 - Math.PI / 2
                return (
                  <circle
                    key={i}
                    data-notch={i}
                    cx={px(WHEEL.x + Math.cos(a) * (WHEEL.r - 4.5))}
                    cy={px(WHEEL.y + Math.sin(a) * (WHEEL.r - 4.5))}
                    r={i === 0 ? 1.7 : 0.8}
                    fill={i === 0 ? live : palette.dark}
                    opacity={i === 0 ? 1 : 0.4}
                  />
                )
              })}
            </g>
            <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.hub} {...cast} />
            <circle cx={WHEEL.x} cy={WHEEL.y} r={WHEEL.hub - 3} fill={palette.metal} opacity={0.35} />
            <Keys segment={segment} palette={palette} live={live} />
          </g>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {locked ? "HOLD" : `${wheel.index + 1}/${count} · ${(segment ?? "—").toUpperCase()}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 2.5} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** The four keys round the wheel; the one under the thumb is live. */
function Keys({
  segment,
  palette,
  live,
}: {
  segment: ReturnType<typeof wheelSegment>
  palette: ReturnType<typeof resolveRobotPalette>
  live: string
}) {
  const tint = (name: string) => (segment === name ? live : palette.dark)
  return (
    <g data-keys data-segment={segment ?? "none"}>
      <rect x={WHEEL.x - 7} y={WHEEL.y - WHEEL.r + 4.4} width={14} height={2.2} rx={1.1} fill={tint("menu")} opacity={0.85} />
      <g fill={tint("next")}>
        <path d={`M ${WHEEL.x + WHEEL.r - 9} ${WHEEL.y - 3} l 4 3 l -4 3 Z`} />
        <path d={`M ${WHEEL.x + WHEEL.r - 5.5} ${WHEEL.y - 3} l 4 3 l -4 3 Z`} />
      </g>
      <g fill={tint("previous")}>
        <path d={`M ${WHEEL.x - WHEEL.r + 9} ${WHEEL.y - 3} l -4 3 l 4 3 Z`} />
        <path d={`M ${WHEEL.x - WHEEL.r + 5.5} ${WHEEL.y - 3} l -4 3 l 4 3 Z`} />
      </g>
      <g fill={tint("play")}>
        <path d={`M ${WHEEL.x - 5} ${WHEEL.y + WHEEL.r - 8} l 4.4 3 l -4.4 3 Z`} />
        <rect x={WHEEL.x + 1.4} y={WHEEL.y + WHEEL.r - 8} width={1.6} height={6} />
        <rect x={WHEEL.x + 4.2} y={WHEEL.y + WHEEL.r - 8} width={1.6} height={6} />
      </g>
    </g>
  )
}

/** Structure drawn in palette roles, never an application's own artwork. */
function ScreenContent({
  screen,
  palette,
  rows,
  index,
  visible,
  progress,
}: {
  screen: PlayerScreen
  palette: ReturnType<typeof resolveRobotPalette>
  rows: number
  index: number
  visible: number[]
  progress: number
}) {
  if (screen === "now-playing") {
    return (
      <g>
        <rect x={10} y={12} width={24} height={24} rx={2} fill={palette.metal} opacity={0.3} />
        {[9, 6, 3].map((r) => (
          <circle key={r} cx={22} cy={24} r={r} fill="none" stroke={palette.metal} strokeWidth={0.8} opacity={0.6} />
        ))}
        <circle cx={22} cy={24} r={1.4} fill={palette.accent} />
        {[24, 18, 14].map((run, i) => (
          <rect key={run} x={38} y={14 + i * 6} width={run} height={2.6} rx={1.3} fill={i === 0 ? palette.accent : palette.metal} opacity={i === 0 ? 1 : 0.5} />
        ))}
        <rect x={10} y={42} width={48} height={2.4} rx={1.2} fill={palette.metal} opacity={0.35} />
        <rect x={10} y={42} width={px(Math.max(1, 48 * progress))} height={2.4} rx={1.2} fill={palette.accent} />
      </g>
    )
  }
  return (
    <g data-list>
      <rect x={9} y={10} width={50} height={4} rx={1} fill={palette.metal} opacity={0.35} />
      {visible.map((row, slot) => (
        <g key={row} data-row={row} data-selected={row === index ? "true" : "false"}>
          <rect
            x={9}
            y={17 + slot * 7}
            width={50}
            height={5.6}
            rx={1.2}
            fill={row === index ? palette.accent : palette.metal}
            opacity={row === index ? 1 : 0.22}
          />
          <rect
            x={11}
            y={19 + slot * 7}
            width={px(16 + ((row * 13) % 27))}
            height={1.8}
            rx={0.9}
            fill={row === index ? palette.dark : palette.metal}
            opacity={row === index ? 0.75 : 0.65}
          />
        </g>
      ))}
      <rect x={60.4} y={px(17 + (index / Math.max(1, rows - 1)) * (35 - 8))} width={1.4} height={8} rx={0.7} fill={palette.metal} opacity={0.6} />
    </g>
  )
}

/**
 * Wheel rotation at `clock`, in degrees. `scroll` runs the list past at a turn
 * a cycle; `seek` works back and forth the way a thumb hunting for a track
 * does. Both are unwrapped, so the drawing never spins a whole turn backwards
 * to reach the next row.
 */
export function playerGoal(behavior: PlayerBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "seek") return Math.sin(clock * Math.PI * 2) * 150
  return clock * 360
}

export { WheelPlayer }
