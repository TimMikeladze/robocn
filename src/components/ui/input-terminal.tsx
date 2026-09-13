"use client"

/**
 * input-terminal — a console you type at.
 *
 * The only machine in the set where **one mechanism drives another**: the keys
 * it strikes are what puts glyphs on its screen. Everything else here has one
 * mechanism, or several that are independent; this one has a head on a hinge
 * and a key deck, and the deck's output is the head's input.
 *
 * Two scalars, so two controlled props. `cant` is the one you grab — a head
 * held by hand keeps typing underneath it, which is what pinning a value while
 * the clock runs on is for. `behavior="static"` or `animate={false}` parks both.
 *
 * It computes nothing. The screen draws structure — a status band, filled
 * lines, a block cursor — and never text: no encoding, no shell, no output.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  capSolid,
  codeStrikes,
  deckFrame,
  deckPanel,
  keyboardLayout,
  strokePresses,
} from "@/lib/robocn/keyboard"
import { clamp, toRadians } from "@/lib/robocn/kinematics"
import {
  boxCorners,
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
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 240
const VIEW_HEIGHT = 210

/**
 * The head: where it is hinged, how big it is, and how thick. The hinge sits up
 * a column at the back of the case rather than on the deck's own edge, which is
 * what makes this a bench console and not a machine that folds shut.
 */
const HINGE = { y: 30, z: 28 }
const COLUMN_HALF_WIDTH = 15
const COLUMN_HALF_DEPTH = 7
const HEAD_HEIGHT = 60
const HEAD_WIDTH = 92
const HEAD_THICK = 6
/** How far the head can be tipped back from upright, degrees. */
const CANT_MIN = 6
const CANT_MAX = 45
/** Where a session leaves the head once it has set it. */
export const WORK_CANT = 18

/** The key deck under it: four rows of ten, on a shallow rake. */
const DECK_ROWS = 4
const DECK_COLUMNS = 10
const UNIT = 9.4
const GAP = 1.4
const DECK_RAKE = 12
const DECK = { y: 13, z: -24 }
const CAP = { height: 4.6, travel: 2.2, body: 3, taper: 0.86 }

/** The case, in world units: x starboard, y up, z toward the back. */
const BASE_HALF_WIDTH = 66
const BASE_FRONT = -58
const BASE_BACK = 40
const BASE_TOP = 7

/** Keystrokes in one passage, and glyphs each one puts on the screen. */
const STROKES = 18
/** Degrees per second while easing the head back into the behaviour. */
const SLEW_RATE = 26

const NATIVE_VIEW: RobotView = "front"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type InputTerminalBehavior = "session" | "query" | "idle" | "static"
export type InputTerminalScreen = "boot" | "log" | "query" | "off"

export interface InputTerminalProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled head cant, degrees back from upright. Clamped to 6–45. */
  cant?: number
  /** Controlled position through the passage, 0 to 1. */
  typed?: number
  /** What the head and the keys do when they are not supplied. */
  behavior?: InputTerminalBehavior
  /** What the display is showing. Structure only — never text. */
  screen?: InputTerminalScreen
  /** Lines the screen holds, rounded and clamped to 4–12. */
  lines?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Sessions per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up the frame to tip the head, or arrow-key it. */
  interactive?: boolean
  onCantChange?: (cant: number) => void
  showDesk?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function InputTerminal({
  cant,
  typed,
  behavior = "session",
  screen = "query",
  lines = 7,
  view = NATIVE_VIEW,
  speed = 0.2,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onCantChange,
  showDesk = true,
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
}: InputTerminalProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const headHeld = cant !== undefined
  const typedHeld = typed !== undefined
  const hold = headHeld
    ? Number.isFinite(cant)
      ? clamp(cant, CANT_MIN, CANT_MAX)
      : WORK_CANT
    : held
  const goal = React.useCallback((clock: number) => terminalCant(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    // The loop runs while *either* mechanism is still the machine's own, which
    // is what lets a head held by hand keep typing underneath.
    animate: animate && !(headHeld && typedHeld) && behavior !== "static",
    paused,
    phase,
  })
  const tip = clamp(motion.value, CANT_MIN, CANT_MAX)
  const at = typedHeld
    ? Number.isFinite(typed)
      ? clamp(typed, 0, 1)
      : 0
    : terminalTyped(behavior, motion.clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, CANT_MIN, CANT_MAX))
      setHeld(bounded)
      onCantChange?.(bounded)
    },
    [onCantChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Down the frame lays the head back, the way a hand on the bezel does.
    onDrag: React.useCallback(
      (unit: { y: number }) => apply(CANT_MIN + unit.y * (CANT_MAX - CANT_MIN) * 1.4),
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)

  // The key deck, and the passage its keys are struck through.
  const deck = keyboardLayout(
    Array.from({ length: DECK_ROWS }, () => Array.from({ length: DECK_COLUMNS }, () => 1)),
    { unit: UNIT, gap: GAP },
  )
  const deckFace = deckFrame({ x: 0, y: DECK.y, z: DECK.z }, DECK_RAKE)
  const strikes = passageStrikes(deck.keys.length)
  const presses = strokePresses(strikes, deck.keys.length, at, { dwell: 0.05 })

  // The head, as a plane standing off the hinge: `cant` is the angle from
  // upright, so the frame's own rake is its complement.
  const headRake = 90 - tip
  const theta = toRadians(headRake)
  const up = { y: Math.sin(theta), z: Math.cos(theta) }
  const headMid = {
    y: HINGE.y + (up.y * HEAD_HEIGHT) / 2,
    z: HINGE.z + (up.z * HEAD_HEIGHT) / 2,
  }
  const headFace = deckFrame({ x: 0, y: headMid.y, z: headMid.z }, headRake)
  const glass = deckPanel(camera, headFace, 0, 0, HEAD_WIDTH - 10, HEAD_HEIGHT - 10, 0.6)
  const facing = glass.facing > 0.05

  const rows = clamp(Math.round(Number.isFinite(lines) ? lines : 7) || 7, 4, 12)
  const lit = screen !== "off"
  // One passage fills the screen: the glyph count is the coupling, and the
  // cursor sits wherever the keys have got to.
  const glyphs = Math.round(at * rows * GLYPHS_PER_LINE)
  const full = Math.min(rows, Math.floor(glyphs / GLYPHS_PER_LINE))
  const partial = glyphs - full * GLYPHS_PER_LINE
  const blink = Math.floor(Math.abs(motion.clock) * 2) % 2 === 0

  const shell = robotSurface("shell", variant, palette)
  const plate = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const capPaint = robotSurface("dark", variant, palette, 0.6)
  const capEdge = variant === "solid" ? palette.metal : capPaint.stroke
  const capEdgeWidth = variant === "solid" ? 0.5 : capPaint.strokeWidth

  const body = slabPath(
    [
      { x: -BASE_HALF_WIDTH, y: 0, z: BASE_FRONT },
      { x: BASE_HALF_WIDTH, y: 0, z: BASE_FRONT },
      { x: -BASE_HALF_WIDTH, y: 0, z: BASE_BACK },
      { x: BASE_HALF_WIDTH, y: 0, z: BASE_BACK },
      { x: -BASE_HALF_WIDTH, y: BASE_TOP, z: BASE_FRONT },
      { x: BASE_HALF_WIDTH, y: BASE_TOP, z: BASE_FRONT },
      { x: -BASE_HALF_WIDTH, y: BASE_TOP + 9, z: BASE_BACK },
      { x: BASE_HALF_WIDTH, y: BASE_TOP + 9, z: BASE_BACK },
    ],
    camera,
  )

  // The head as a solid: its face, and the same face pushed back along its own
  // normal. The hull of the two is the slab, seen edge on from the side.
  const corner = (across: number, along: number, out: number) => {
    const point = {
      x: across,
      y: headMid.y + up.y * along + headFace.n.y * out,
      z: headMid.z + up.z * along + headFace.n.z * out,
    }
    return point
  }
  const half = { w: HEAD_WIDTH / 2, h: HEAD_HEIGHT / 2 }
  const headSolid = slabPath(
    ([-half.w, half.w] as const).flatMap((x) =>
      ([-half.h, half.h] as const).flatMap((y) =>
        ([0, -HEAD_THICK] as const).map((out) => corner(x, y, out)),
      ),
    ),
    camera,
  )
  const column = slabPath(
    ([-COLUMN_HALF_WIDTH, COLUMN_HALF_WIDTH] as const).flatMap((x) =>
      ([-COLUMN_HALF_DEPTH, COLUMN_HALF_DEPTH] as const).flatMap((dz) =>
        ([BASE_TOP + 2, HINGE.y] as const).map((y) => ({ x, y, z: HINGE.z + dz })),
      ),
    ),
    camera,
  )
  const hinge = slabPath(
    ([-COLUMN_HALF_WIDTH - 5, COLUMN_HALF_WIDTH + 5] as const).flatMap((x) =>
      ([-5, 5] as const).flatMap((dz) =>
        ([-5, 5] as const).map((dy) => ({ x, y: HINGE.y + dy, z: HINGE.z + dz })),
      ),
    ),
    camera,
  )

  const deckPlate = deckPanel(camera, deckFace, 0, 0, deck.width + 14, deck.depth + 14, 0.3)
  const deckUp = deckPlate.facing > 0.04

  const ordered = deck.keys
    .map((key) => ({ key, depth: camera.depth(key.x, DECK.y, -key.y) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ key }) => key)

  // Whichever of the head and the deck is nearer the camera paints last.
  const headNearer =
    camera.depth(0, headMid.y, headMid.z) > camera.depth(0, DECK.y, DECK.z)

  const envelope = boxCorners(
    { x: -BASE_HALF_WIDTH - 2, y: -2, z: BASE_FRONT - 2 },
    { x: BASE_HALF_WIDTH + 2, y: HINGE.y + HEAD_HEIGHT + 6, z: BASE_BACK + 22 },
  )
  const fit = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT - 20, 8, 1.3)

  const headGroup = (
    <g data-head data-cant={px(tip)}>
      <path d={headSolid} {...shell} />
      {facing && (
        <g data-screen data-content={screen} transform={glass.transform}>
          <rect
            x={0}
            y={0}
            width={px(HEAD_WIDTH - 10)}
            height={px(HEAD_HEIGHT - 10)}
            rx={2}
            {...cast}
          />
          {lit && (
            <ScreenContent
              screen={screen}
              rows={rows}
              full={full}
              partial={partial}
              blink={blink}
              palette={palette}
              width={HEAD_WIDTH - 10}
              height={HEAD_HEIGHT - 10}
            />
          )}
          {!lit && (
            <circle
              data-standby
              cx={px(HEAD_WIDTH - 18)}
              cy={px(HEAD_HEIGHT - 18)}
              r={1.8}
              fill={palette.metal}
              opacity={0.5}
            />
          )}
        </g>
      )}
    </g>
  )

  const deckGroup = (
    <g data-deck>
      {deckUp && (
        <g transform={deckPlate.transform}>
          <rect
            x={0}
            y={0}
            width={px(deck.width + 14)}
            height={px(deck.depth + 14)}
            rx={3}
            {...plate}
            fillOpacity={variant === "solid" ? 0.5 : plate.fillOpacity}
          />
          <circle data-lamp="power" cx={7} cy={5.5} r={1.7} fill={palette.accent} />
          <circle
            data-lamp="link"
            cx={13}
            cy={5.5}
            r={1.7}
            fill={at > 0 ? palette.glow : palette.metal}
            opacity={at > 0 ? 1 : 0.5}
          />
        </g>
      )}
      {ordered.map((key) => {
        const press = clamp(presses[key.index] ?? 0, 0, 1)
        return (
          <path
            key={key.index}
            data-key={key.index}
            data-down={press > 0.5}
            d={capSolid(camera, deckFace, key, press, CAP)}
            {...capPaint}
            stroke={press > 0.5 ? palette.accent : capEdge}
            strokeWidth={press > 0.5 ? 1.2 : capEdgeWidth}
            strokeOpacity={press > 0.5 ? 1 : variant === "solid" ? 0.4 : undefined}
          />
        )
      })}
    </g>
  )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Input terminal, head canted ${Math.round(tip)} degrees, ${screen} screen, ${full} of ${rows} lines, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? CANT_MIN : undefined}
      aria-valuemax={interactive ? CANT_MAX : undefined}
      aria-valuenow={interactive ? Math.round(tip) : undefined}
      aria-valuetext={interactive ? `${Math.round(tip)} degrees back` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 10 : 3, 15)
        if (delta !== 0) apply(tip + delta)
        else if (event.key === "Home") apply(CANT_MIN)
        else if (event.key === "End") apply(CANT_MAX)
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
      <g data-terminal data-view={view} transform={fit || undefined}>
        {showDesk && (
          <path
            data-desk
            d={slabPath(
              [
                { x: -BASE_HALF_WIDTH - 6, y: 0, z: BASE_FRONT - 6 },
                { x: BASE_HALF_WIDTH + 6, y: 0, z: BASE_FRONT - 6 },
                { x: -BASE_HALF_WIDTH - 6, y: 0, z: BASE_BACK + 6 },
                { x: BASE_HALF_WIDTH + 6, y: 0, z: BASE_BACK + 6 },
              ],
              camera,
            )}
            fill={palette.dark}
            opacity={0.13}
          />
        )}
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.7} opacity={0.6}>
            <path
              d={`M ${px(camera.project(-BASE_HALF_WIDTH - 14, HINGE.y, HINGE.z).x)} ${px(camera.project(-BASE_HALF_WIDTH - 14, HINGE.y, HINGE.z).y)} L ${px(camera.project(BASE_HALF_WIDTH + 14, HINGE.y, HINGE.z).x)} ${px(camera.project(BASE_HALF_WIDTH + 14, HINGE.y, HINGE.z).y)}`}
              strokeDasharray="6 2 2 2"
            />
          </g>
        )}
        <path data-body d={body} {...shell} />
        <path data-column d={column} {...plate} />
        <path data-hinge d={hinge} {...cast} />
        {headNearer ? (
          <>
            {deckGroup}
            {headGroup}
          </>
        ) : (
          <>
            {headGroup}
            {deckGroup}
          </>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5.5}>
          {`${screen.toUpperCase()} / ${full}/${rows} LINES / ${Math.round(tip)}°`}
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

/** Glyph cells one line of the screen holds. The coupling is counted in these. */
const GLYPHS_PER_LINE = 22

/**
 * What is on the display: a status band, the lines the keys have filled, and a
 * block cursor after the last of them. Structure in palette roles — never text,
 * and never anyone's interface.
 */
function ScreenContent({
  screen,
  rows,
  full,
  partial,
  blink,
  palette,
  width,
  height,
}: {
  screen: InputTerminalScreen
  rows: number
  full: number
  partial: number
  blink: boolean
  palette: ReturnType<typeof resolveRobotPalette>
  width: number
  height: number
}) {
  const margin = 5
  const band = 6
  const area = height - margin * 2 - band - 3
  const step = area / rows
  const cell = (width - margin * 2 - (screen === "log" ? 12 : 6)) / GLYPHS_PER_LINE
  const left = margin + (screen === "log" ? 12 : 6)
  const lineY = (row: number) => margin + band + 3 + row * step
  return (
    <g>
      <rect
        x={margin}
        y={margin}
        width={px(width - margin * 2)}
        height={band}
        rx={1}
        fill={palette.metal}
        opacity={0.3}
      />
      {screen === "boot" && (
        <rect
          x={margin + 1}
          y={margin + 1.5}
          width={px((width - margin * 2 - 2) * Math.min(1, (full + 1) / rows))}
          height={3}
          rx={1.5}
          fill={palette.accent}
          opacity={0.8}
        />
      )}
      {Array.from({ length: rows }, (_, row) => {
        const done = row < full
        const current = row === full
        const glyphs = done ? GLYPHS_PER_LINE : current ? partial : 0
        return (
          <g key={row} data-line={row} data-filled={done}>
            {screen === "query" && (glyphs > 0 || current) && (
              <rect
                x={margin}
                y={px(lineY(row) + step * 0.2)}
                width={3}
                height={px(step * 0.45)}
                fill={palette.accent}
                opacity={0.8}
              />
            )}
            {screen === "log" && glyphs > 0 && (
              <rect
                x={margin}
                y={px(lineY(row) + step * 0.25)}
                width={9}
                height={px(step * 0.36)}
                rx={0.8}
                fill={palette.metal}
                opacity={0.35}
              />
            )}
            {glyphs > 0 && (
              <rect
                x={px(left)}
                y={px(lineY(row) + step * 0.25)}
                width={px(glyphs * cell)}
                height={px(step * 0.36)}
                rx={0.8}
                fill={done ? palette.metal : palette.accent}
                opacity={done ? 0.55 : 0.9}
              />
            )}
          </g>
        )
      })}
      {full < rows && blink && (
        <rect
          data-cursor
          x={px(left + partial * cell + 1)}
          y={px(lineY(full) + step * 0.2)}
          width={px(cell)}
          height={px(step * 0.46)}
          fill={palette.accent}
        />
      )}
      {full >= rows && (
        <rect
          data-cursor
          x={px(left)}
          y={px(lineY(rows - 1) + step * 0.9)}
          width={px(cell)}
          height={px(step * 0.36)}
          fill={palette.accent}
          opacity={blink ? 1 : 0.3}
        />
      )}
    </g>
  )
}

/** The passage the deck types: a fixed rhythm, so the same terminal types alike. */
function passageStrikes(keys: number) {
  let seed = 11
  const indices = Array.from({ length: STROKES }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % Math.max(1, keys)
  })
  return codeStrikes(indices, keys, { start: 0.12, end: 0.96 })
}

/**
 * Head cant at `clock`, degrees back from upright. A `session` sets the head
 * before it types under it and lays it back at the end; everything else leaves
 * it at the working angle, which is where a controlled head starts from too.
 */
export function terminalCant(behavior: InputTerminalBehavior, clock: number): number {
  if (behavior === "static" || behavior === "query" || !Number.isFinite(clock)) return WORK_CANT
  const t = ((clock % 1) + 1) % 1
  if (behavior === "idle") return WORK_CANT + Math.sin(t * Math.PI * 2) * 1.5
  if (t < 0.12) return CANT_MAX - ((CANT_MAX - WORK_CANT) * t) / 0.12
  if (t < 0.9) return WORK_CANT
  return WORK_CANT + ((CANT_MAX - WORK_CANT) * (t - 0.9)) / 0.1
}

/**
 * Position through the passage at `clock`, 0..1. A `session` types only once
 * the head is set; `query` types the moment it starts; `idle` types nothing.
 */
export function terminalTyped(behavior: InputTerminalBehavior, clock: number): number {
  if (behavior === "static" || behavior === "idle" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "query") return Math.min(1, t / 0.86)
  if (t < 0.14) return 0
  return Math.min(1, (t - 0.14) / 0.72)
}

export { InputTerminal }
