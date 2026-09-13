"use client"

/**
 * slab-handset — a touchscreen handset, and the two things it actually does.
 *
 * `turn` rotates it about its own vertical axis, so the machine is modelled
 * once and every camera gets it honestly: past a quarter turn the screen is
 * edge on, and past a half turn you are looking at the back and its camera
 * array. Nothing is redrawn per angle.
 *
 * `orientation` is the other mechanism: rolling the slab a quarter turn in its
 * own plane swaps its width for its height *and* re-lays the display out,
 * because that is what the device does rather than rotating a picture.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { panelTransform } from "@/lib/robocn/device"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
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

const VIEW_WIDTH = 170
const VIEW_HEIGHT = 200
const ORIGIN = { x: 85, y: 158 }

/** World units: x starboard, y up, z toward the back. */
const HALF_W = 31
const HALF_H = 59
const HALF_T = 4.6
/** Height of the slab's middle above the desk, so it stands in the frame. */
const CENTRE_Y = 64
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 420
const NATIVE_VIEW: RobotView = "front"

const frames: Record<RobotView, { zoom: number; dx: number; dy: number }> = {
  plan: { zoom: 0.92, dx: 0, dy: -58 },
  front: { zoom: 0.94, dx: 0, dy: 0 },
  profile: { zoom: 0.94, dx: 0, dy: 0 },
  iso: { zoom: 0.8, dx: 4, dy: -2 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type HandsetBehavior = "turn" | "nudge" | "static"
export type HandsetScreen = "home" | "call" | "map" | "off"
export type HandsetOrientation = "portrait" | "landscape"

export interface SlabHandsetProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled rotation about the handset's own vertical axis, degrees. */
  turn?: number
  /** What the handset does when `turn` is not supplied. */
  behavior?: HandsetBehavior
  /** Which way up it is held. Landscape swaps the slab and re-lays the display. */
  orientation?: HandsetOrientation
  /** Where the camera stands. One handset, four projections. */
  view?: RobotView
  /** Revolutions per second, or nudges per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the frame to turn it, or arrow-key it. */
  interactive?: boolean
  onTurnChange?: (turn: number) => void
  /** What the display is showing. Structure only — no application artwork. */
  screen?: HandsetScreen
  /** Lenses in the rear camera array, clamped 1–4. */
  lenses?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function SlabHandset({
  turn,
  behavior = "turn",
  orientation = "portrait",
  view = NATIVE_VIEW,
  speed = 0.14,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTurnChange,
  screen = "home",
  lenses = 3,
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
}: SlabHandsetProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = turn !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(turn) ? (turn as number) : 0) : held
  const goal = React.useCallback((clock: number) => handsetGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const spin = Number.isFinite(motion.value) ? motion.value : 0
  /** The same attitude, said the short way round. */
  const heading = ((((spin % 360) + 540) % 360) - 180)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onTurnChange?.(next)
    },
    [onTurnChange, setHeld],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Across the frame is round the axis: the whole width is one revolution.
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.5) * 360), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  // A quarter turn in its own plane leaves a rectangular slab axis-aligned; it
  // only swaps which dimension is which, and the display is laid out again.
  const landscape = orientation === "landscape"
  const halfW = landscape ? HALF_H : HALF_W
  const halfH = landscape ? HALF_W : HALF_H

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.front
  const rad = (spin * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  /** Device coordinates — across, up, toward the back — into world units. */
  const world = (u: number, v: number, w: number) => ({
    x: u * cos - w * sin,
    y: CENTRE_Y + v,
    z: u * sin + w * cos,
  })

  const faceCorner = world(halfW, halfH, -HALF_T)
  const face = panelTransform(
    camera,
    faceCorner,
    world(-halfW, halfH, -HALF_T),
    world(halfW, -halfH, -HALF_T),
    halfW * 2,
    halfH * 2,
  )
  const rear = panelTransform(
    camera,
    world(-halfW, halfH, HALF_T),
    world(halfW, halfH, HALF_T),
    world(-halfW, -halfH, HALF_T),
    halfW * 2,
    halfH * 2,
  )
  const showFace = face.facing > 0.16
  const showRear = rear.facing > 0.16

  const body = extrudedPath(
    roundedFootprint(halfW, HALF_T, 3.6, 4),
    camera,
    CENTRE_Y + halfH,
    CENTRE_Y - halfH,
    spin,
  )

  /** A side key, on the slab's own edge, drawn where the camera puts it. */
  const sideKey = (side: number, from: number, to: number) => {
    const a = world(side * (halfW + 0.6), from, 0)
    const b = world(side * (halfW + 0.6), to, 0)
    return capsulePath(camera.project(a.x, a.y, a.z), camera.project(b.x, b.y, b.z), 1.5)
  }

  const count = Number.isFinite(lenses) ? clamp(Math.round(lenses), 1, 4) : 3
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const glass = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.8)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Slab handset, ${orientation}, turned ${Math.round(heading)} degrees, ${showRear ? "back toward you" : "screen toward you"}, ${screen} screen, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -180 : undefined}
      aria-valuemax={interactive ? 180 : undefined}
      aria-valuenow={interactive ? Math.round(heading) : undefined}
      aria-valuetext={interactive ? `${Math.round(heading)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 30 : 10, 45)
        if (delta !== 0) apply(spin + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(180)
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
      <g transform={`translate(${px(ORIGIN.x + frame.dx)} ${px(ORIGIN.y + frame.dy)}) scale(${frame.zoom})`}>
        <path data-body data-turn={px(spin)} d={body} {...shell} />
        {/* From nose-on the slab's starboard side appears on the viewer's
            left, so the power key sits to port to read on the right. */}
        <path data-button="power" d={sideKey(-1, 14, 34)} {...cast} />
        <path data-button="volume" d={sideKey(1, 20, 34)} {...cast} />
        <path data-button="volume" d={sideKey(1, 2, 16)} {...cast} />

        {showFace && (
          <g data-face transform={face.transform}>
            <rect data-screen x={2.6} y={2.6} width={px(halfW * 2 - 5.2)} height={px(halfH * 2 - 5.2)} rx={4} {...glass} />
            {screen !== "off" && (
              <ScreenContent screen={screen} palette={palette} w={halfW * 2} h={halfH * 2} />
            )}
            <rect
              x={px(halfW - 9)}
              y={px(halfH * 2 - 7)}
              width={18}
              height={1.6}
              rx={0.8}
              fill={palette.metal}
              opacity={0.75}
            />
          </g>
        )}
        {showRear && (
          <g data-rear transform={rear.transform}>
            <g data-camera>
              <rect x={6} y={6} width={px(Math.min(30, halfW))} height={px(Math.min(30, halfW))} rx={6} {...machined} />
              {Array.from({ length: count }, (_, index) => {
                const side = Math.min(30, halfW)
                const columns = count > 2 ? 2 : 1
                const cx = 6 + side * (columns === 1 ? 0.5 : 0.3 + (index % 2) * 0.42)
                const cy = 6 + side * (count > 2 ? 0.3 + Math.floor(index / 2) * 0.42 : 0.28 + index * 0.44)
                return (
                  <g key={index} data-lens={index}>
                    <circle cx={px(cx)} cy={px(cy)} r={px(side * 0.15)} {...cast} />
                    <circle cx={px(cx)} cy={px(cy)} r={px(side * 0.07)} fill={palette.accent} opacity={0.7} />
                  </g>
                )
              })}
            </g>
            {/* The induction coil, which is the only other thing on a back. */}
            <g data-coil>
              {[1, 0.62].map((ring) => (
                <circle
                  key={ring}
                  cx={px(halfW)}
                  cy={px(halfH)}
                  r={px(Math.min(9, halfW * 0.22) * ring)}
                  fill="none"
                  stroke={palette.metal}
                  strokeWidth={0.9}
                  opacity={0.5}
                />
              ))}
            </g>
          </g>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5}>
          {`${Math.round(heading)}° / ${orientation.toUpperCase()}`}
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

/** Structure drawn in palette roles, laid out for the shape it is given. */
function ScreenContent({
  screen,
  palette,
  w,
  h,
}: {
  screen: HandsetScreen
  palette: ReturnType<typeof resolveRobotPalette>
  w: number
  h: number
}) {
  const pad = 7
  const inner = { w: w - pad * 2, h: h - pad * 2 }
  if (screen === "call") {
    return (
      <g>
        <circle cx={px(w / 2)} cy={px(pad + inner.h * 0.26)} r={px(Math.min(inner.w, inner.h) * 0.17)} fill={palette.metal} opacity={0.35} />
        <rect x={px(w / 2 - inner.w * 0.26)} y={px(pad + inner.h * 0.46)} width={px(inner.w * 0.52)} height={3.2} rx={1.6} fill={palette.metal} opacity={0.6} />
        <rect x={px(w / 2 - inner.w * 0.16)} y={px(pad + inner.h * 0.55)} width={px(inner.w * 0.32)} height={2.4} rx={1.2} fill={palette.metal} opacity={0.35} />
        {[-1, 1].map((side) => (
          <circle
            key={side}
            cx={px(w / 2 + side * inner.w * 0.22)}
            cy={px(pad + inner.h * 0.82)}
            r={px(Math.min(inner.w, inner.h) * 0.1)}
            fill={side > 0 ? palette.accent : palette.metal}
            opacity={side > 0 ? 1 : 0.5}
          />
        ))}
      </g>
    )
  }
  if (screen === "map") {
    return (
      <g>
        {[0.25, 0.5, 0.75].map((t) => (
          <React.Fragment key={t}>
            <path d={`M ${px(pad)} ${px(pad + inner.h * t)} H ${px(pad + inner.w)}`} stroke={palette.metal} strokeWidth={0.7} opacity={0.25} />
            <path d={`M ${px(pad + inner.w * t)} ${px(pad)} V ${px(pad + inner.h)}`} stroke={palette.metal} strokeWidth={0.7} opacity={0.25} />
          </React.Fragment>
        ))}
        <path
          d={`M ${px(pad + inner.w * 0.15)} ${px(pad + inner.h * 0.85)} L ${px(pad + inner.w * 0.4)} ${px(pad + inner.h * 0.62)} L ${px(pad + inner.w * 0.38)} ${px(pad + inner.h * 0.36)} L ${px(pad + inner.w * 0.78)} ${px(pad + inner.h * 0.18)}`}
          fill="none"
          stroke={palette.accent}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={px(pad + inner.w * 0.15)} cy={px(pad + inner.h * 0.85)} r={2.6} fill={palette.metal} />
      </g>
    )
  }
  const columns = w > h ? 7 : 4
  const rowCount = w > h ? 3 : 6
  const cell = Math.min(inner.w / columns, inner.h / (rowCount + 1))
  const tile = cell * 0.68
  return (
    <g data-tiles>
      {Array.from({ length: columns * rowCount }, (_, index) => (
        <rect
          key={index}
          x={px(pad + (inner.w - columns * cell) / 2 + (index % columns) * cell + (cell - tile) / 2)}
          y={px(pad + cell * 0.4 + Math.floor(index / columns) * cell)}
          width={px(tile)}
          height={px(tile)}
          rx={px(tile * 0.26)}
          fill={index === columns + 1 ? palette.accent : palette.metal}
          opacity={index === columns + 1 ? 1 : 0.4}
        />
      ))}
      <rect
        x={px(pad + inner.w * 0.12)}
        y={px(pad + inner.h - cell * 0.9)}
        width={px(inner.w * 0.76)}
        height={px(cell * 0.75)}
        rx={px(cell * 0.24)}
        fill={palette.metal}
        opacity={0.2}
      />
    </g>
  )
}

/**
 * Attitude at `clock`, in degrees. `turn` walks it right round so every face
 * comes past; `nudge` works the small range a hand holding it does. Both are
 * unwrapped, so the drawing never spins a whole turn backwards.
 */
export function handsetGoal(behavior: HandsetBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "nudge") return Math.sin(clock * Math.PI * 2) * 28
  return clock * 360
}

export { SlabHandset }
