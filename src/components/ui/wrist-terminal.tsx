"use client"

/**
 * wrist-terminal — a wrist display, its digital crown, and the band it hangs on.
 *
 * Two mechanisms, both solved. The crown is a rotary input divided into
 * detents: it is geared to the dial, so one turn of the crown is one pass of
 * the face's ticks and the pointer can never disagree with the reading.
 *
 * The band is a constant-pitch chain — the link count and the pitch are fixed
 * and only the curvature changes — so opening it cannot make the strap longer.
 * The crown's ribs are cylinder surface, drawn only where they face you, which
 * is what makes it read as turning from every camera.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { bandLinks, detent, panelTransform } from "@/lib/robocn/device"
import { clamp, convexHull2, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
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

const VIEW_WIDTH = 150
const VIEW_HEIGHT = 196
const ORIGIN = { x: 75, y: 100 }

/** World units: x starboard, y up, z toward the back (into the wrist). */
const CASE_HALF_W = 22
const CASE_HALF_H = 26
const CASE_HALF_T = 5.6
const BAND_HALF_W = 15
const BAND_PITCH = 6.4
const CROWN_R = 3.6
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 540
const NATIVE_VIEW: RobotView = "front"

const frames: Record<RobotView, { zoom: number; dx: number; dy: number }> = {
  plan: { zoom: 0.9, dx: 0, dy: 0 },
  front: { zoom: 1, dx: 0, dy: 0 },
  profile: { zoom: 1, dx: 14, dy: 0 },
  iso: { zoom: 0.88, dx: 10, dy: 0 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type TerminalBehavior = "dial" | "pulse" | "static"
export type TerminalScreen = "dial" | "rings" | "off"

export interface WristTerminalProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled crown rotation in degrees. Omit to run `behavior`. */
  crown?: number
  /** What the crown does when `crown` is not supplied. */
  behavior?: TerminalBehavior
  /** Detents in one turn of the crown, clamped 4–24. */
  ticks?: number
  /** How far the band is closed, 0 hanging open to 1 round a wrist. */
  closure?: number
  /** Links in each half of the band, clamped 4–12. */
  links?: number
  /** Where the camera stands. One terminal, four projections. */
  view?: RobotView
  /** Turns of the crown per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the face to work the crown, or arrow-key it a detent at a time. */
  interactive?: boolean
  onCrownChange?: (crown: number) => void
  /** What the display is showing. Structure only — no application artwork. */
  screen?: TerminalScreen
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function WristTerminal({
  crown,
  behavior = "dial",
  ticks = 12,
  closure = 0.75,
  links = 7,
  view = NATIVE_VIEW,
  speed = 0.2,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onCrownChange,
  screen = "dial",
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
}: WristTerminalProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const count = Number.isFinite(ticks) ? clamp(Math.round(ticks), 4, 24) : 12
  const step = 360 / count
  const linkCount = Number.isFinite(links) ? clamp(Math.round(links), 4, 12) : 7
  const shut = Number.isFinite(closure) ? clamp(closure, 0, 1) : 0.75
  const controlled = crown !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(crown) ? (crown as number) : 0) : held
  const goal = React.useCallback((clock: number) => terminalGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const turn = Number.isFinite(motion.value) ? motion.value : 0
  const dial = detent(turn, count, step)

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.front

  const centre = {
    x: ORIGIN.x + frame.dx,
    y: ORIGIN.y + frame.dy,
  }
  // Read through a ref: closing over the angle would rebind the pointer
  // listeners every animation frame, and the drag would lose its pointer.
  const live = React.useRef({ centre, turn })
  React.useEffect(() => {
    live.current = { centre, turn }
  })
  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onCrownChange?.(next)
    },
    [onCrownChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const { centre: at, turn: now } = live.current
        const thumb = toDegrees(
          Math.atan2(unit.y * VIEW_HEIGHT - at.y, unit.x * VIEW_WIDTH - at.x),
        )
        // Unwrap onto the turn the crown is already on.
        apply(thumb + Math.round((now - thumb) / 360) * 360)
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  // The band curls in the wrist's own cross-section — the plane the arm runs
  // through — so its 2D coordinates are (back, down) and its width is world x.
  const upper = bandLinks(linkCount, BAND_PITCH, shut, { heading: -90, curl: 15 })
  const lower = bandLinks(linkCount, BAND_PITCH, shut, { heading: 90, curl: -15 })
  /** Where each band leaves the case: its lug, not the case's middle. */
  const lugs = { upper: -CASE_HALF_H + 3, lower: CASE_HALF_H - 3 }
  /** One link: a slab a whole pitch long, so consecutive links abut. */
  const bandPiece = (point: Vec2, angle: number, lug: number) => {
    const a = toRadians(angle)
    const along = { x: Math.cos(a) * BAND_PITCH * 0.52, y: Math.sin(a) * BAND_PITCH * 0.52 }
    const corners = [-1, 1].flatMap((end) =>
      [-1, 1].map((side) => ({
        z: point.x + along.x * end,
        y: point.y + lug + along.y * end,
        x: side * BAND_HALF_W,
      })),
    )
    const hull = convexHull2(corners.map((c) => camera.project(c.x, -c.y, c.z)))
    return {
      d: hull.length
        ? `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
        : "",
      depth: camera.depth(0, -(point.y + lug), point.x),
    }
  }

  const face = panelTransform(
    camera,
    { x: CASE_HALF_W, y: CASE_HALF_H, z: -CASE_HALF_T },
    { x: -CASE_HALF_W, y: CASE_HALF_H, z: -CASE_HALF_T },
    { x: CASE_HALF_W, y: -CASE_HALF_H, z: -CASE_HALF_T },
    CASE_HALF_W * 2,
    CASE_HALF_H * 2,
  )
  const showFace = face.facing > 0.16
  const body = extrudedPath(
    roundedFootprint(CASE_HALF_W, CASE_HALF_T, 4, 4),
    camera,
    CASE_HALF_H,
    -CASE_HALF_H,
  )

  // The crown: a cylinder on the case's starboard side, its axis along x. The
  // ribs are surface, so only the ones turned toward the camera are drawn.
  const crownInner = camera.project(-CASE_HALF_W, 5, 0)
  const crownOuter = camera.project(-CASE_HALF_W - 6.6, 5, 0)
  const ribs = Array.from({ length: 12 }, (_, index) => {
    const a = toRadians(turn + index * 30)
    const y = 5 + Math.cos(a) * CROWN_R
    const z = Math.sin(a) * CROWN_R
    return {
      depth: camera.depth(0, y, z),
      a: camera.project(-CASE_HALF_W - 0.6, y, z),
      b: camera.project(-CASE_HALF_W - 6.2, y, z),
    }
  })
  const axisDepth = camera.depth(0, 5, 0)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)

  // The band wraps away from the camera, so the near links have to paint last
  // or a closed band draws itself inside out.
  const band = (name: "upper" | "lower", chain: typeof upper) => (
    <g data-band={name}>
      {chain
        .map((link, index) => ({ index, ...bandPiece(link.position, link.angle, lugs[name]) }))
        .sort((a, b) => a.depth - b.depth)
        .map((link) => (
          <path
            key={link.index}
            data-link={link.index}
            d={link.d}
            {...(link.index % 2 ? machined : cast)}
          />
        ))}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Wrist terminal, detent ${dial.index + 1} of ${count}, band ${Math.round(shut * 100)} percent closed, ${screen} screen, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 1 : undefined}
      aria-valuemax={interactive ? count : undefined}
      aria-valuenow={interactive ? dial.index + 1 : undefined}
      aria-valuetext={interactive ? `detent ${dial.index + 1} of ${count}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
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
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      {...props}
    >
      <g transform={`translate(${px(centre.x)} ${px(centre.y)}) scale(${frame.zoom})`}>
        {band("upper", upper)}
        {band("lower", lower)}

        <g data-crown data-rotation={px(turn)}>
          <path d={capsulePath(crownInner, crownOuter, CROWN_R)} {...machined} />
          {ribs
            .filter((rib) => rib.depth <= axisDepth)
            .map((rib, index) => (
              <path
                key={index}
                d={`M ${px(rib.a.x)} ${px(rib.a.y)} L ${px(rib.b.x)} ${px(rib.b.y)}`}
                stroke={palette.dark}
                strokeWidth={0.9}
                opacity={0.7}
              />
            ))}
        </g>

        <path data-body d={body} {...shell} />
        {showFace && (
          <g data-face transform={face.transform}>
            <rect data-screen x={3.4} y={3.4} width={px(CASE_HALF_W * 2 - 6.8)} height={px(CASE_HALF_H * 2 - 6.8)} rx={6} {...glass} />
            {screen !== "off" && (
              <ScreenContent
                screen={screen}
                palette={palette}
                ticks={count}
                index={dial.index}
                offset={dial.offset / count}
              />
            )}
          </g>
        )}
        {!showFace && (
          <circle
            data-sensor
            cx={px(camera.project(0, 0, CASE_HALF_T).x)}
            cy={px(camera.project(0, 0, CASE_HALF_T).y)}
            r={7}
            {...cast}
          />
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {`${dial.index + 1}/${count} · BAND ${Math.round(shut * 100)}%`}
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

/** Structure drawn in palette roles, never an application's own artwork. */
function ScreenContent({
  screen,
  palette,
  ticks,
  index,
  offset,
}: {
  screen: TerminalScreen
  palette: ReturnType<typeof resolveRobotPalette>
  ticks: number
  index: number
  offset: number
}) {
  const cx = CASE_HALF_W
  const cy = CASE_HALF_H
  if (screen === "rings") {
    return (
      <g data-rings>
        {[16, 12, 8].map((r, ring) => {
          const circumference = 2 * Math.PI * r
          const swept = circumference * clamp(offset * (1 + ring * 0.3), 0, 1)
          return (
            <React.Fragment key={r}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.metal} strokeWidth={3} opacity={0.22} />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={ring === 0 ? palette.accent : palette.metal}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={`${px(swept)} ${px(circumference)}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={ring === 0 ? 1 : 0.65}
              />
            </React.Fragment>
          )
        })}
      </g>
    )
  }
  const hand = index * (360 / ticks) - 90
  return (
    <g data-dial>
      {Array.from({ length: ticks }, (_, i) => {
        const a = toRadians(i * (360 / ticks) - 90)
        const lit = i === index
        return (
          <rect
            key={i}
            data-tick={i}
            x={px(cx + Math.cos(a) * 16 - 1.1)}
            y={px(cy + Math.sin(a) * 16 - 1.1)}
            width={2.2}
            height={2.2}
            rx={1.1}
            fill={lit ? palette.accent : palette.metal}
            opacity={lit ? 1 : 0.45}
          />
        )
      })}
      <path
        data-hand
        d={`M ${cx} ${cy} L ${px(cx + Math.cos(toRadians(hand)) * 12)} ${px(cy + Math.sin(toRadians(hand)) * 12)}`}
        stroke={palette.accent}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={1.8} fill={palette.metal} />
      <rect x={px(cx - 9)} y={px(cy + 6)} width={18} height={2} rx={1} fill={palette.metal} opacity={0.35} />
    </g>
  )
}

/**
 * Crown rotation at `clock`, in degrees. `dial` runs it round a turn a cycle;
 * `pulse` works the quarter turn a finger checking something does. Both are
 * unwrapped, so the drawing never spins a whole turn backwards.
 */
export function terminalGoal(behavior: TerminalBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "pulse") return Math.sin(clock * Math.PI * 2) * 90
  return clock * 360
}

export { WristTerminal }
