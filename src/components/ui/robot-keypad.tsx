"use client"

/**
 * robot-keypad — a raked bench entry pad.
 *
 * The only machine in the set with a **scanned matrix**: its state is spread
 * over a grid that is read one row at a time, so "which key is down" and "which
 * key is being looked at" are two different things and both are drawn.
 *
 * The rake is the reason it reads at all. A key face flat on the bench travels
 * straight into a front camera and shows nothing; tipped up, the same press
 * moves its cap down the screen. `rake` is therefore geometry rather than
 * decoration — it sets the wedge's back height, and the caps stand on the face
 * as boxes and press along its normal.
 *
 * It checks nothing. `outcome` is what it has been told to answer with; there
 * is no code comparison, no lockout, no timing and no encoding anywhere here.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  capFace,
  capSolid,
  codeStrikes,
  deckFrame,
  deckPanel,
  keyboardLayout,
  matrixScan,
  strokePresses,
  type KeyPlacement,
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
const VIEW_HEIGHT = 200

/** Key pitch and the gap swallowed between caps, world units. */
const UNIT = 22
const GAP = 3.5
/** Cap height above the face, and how far one goes down. */
const CAP_HEIGHT = 7
const CAP_TRAVEL = 3.4
/** The readout strip across the back of the face. */
const READOUT = 26
const MARGIN = 9
/** Height of the front lip, which is what the wedge is raked up from. */
const LIP = 10
/** Matrix scans per cycle of the clock. A matrix is read far faster than typed. */
const SCAN_RATE = 6
/** Entry per second while easing back into the behaviour. */
const SLEW_RATE = 3
const NATIVE_VIEW: RobotView = "front"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type KeypadBehavior = "entry" | "scan" | "idle" | "static"
export type KeypadOutcome = "granted" | "denied"
type KeypadState = "idle" | "entry" | "scan" | KeypadOutcome

export interface RobotKeypadProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /**
   * Controlled position through the entry, 0 to 1. Omit to run `behavior`.
   * Named `typed` rather than `stroke` because `stroke` is an SVG attribute.
   */
  typed?: number
  /** What the keys do when `typed` is not supplied. */
  behavior?: KeypadBehavior
  /** The characters it enters, in order. Anything not on a cap is dropped. */
  code?: string
  /** What it answers with once the entry is in. It checks nothing. */
  outcome?: KeypadOutcome
  /** Rows in the matrix, rounded and clamped to 3–5. */
  rows?: number
  /** Columns in the matrix, rounded and clamped to 3–4. */
  columns?: number
  /** How far the key face is tipped up from the bench, degrees. Clamped 0–40. */
  rake?: number
  /** Draw the row rails and the cell the scan is reading. */
  showScan?: boolean
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Entries per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the face to scrub the entry, or arrow-key it a digit at a time. */
  interactive?: boolean
  onTypedChange?: (typed: number) => void
  /** Fires when the number of digits taken changes — not once per frame. */
  onEntryChange?: (digits: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotKeypad({
  typed,
  behavior = "entry",
  code = "4813",
  outcome = "granted",
  rows = 4,
  columns = 3,
  rake = 22,
  showScan = false,
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTypedChange,
  onEntryChange,
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
}: RobotKeypadProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = typed !== undefined
  const hold = controlled ? (Number.isFinite(typed) ? clamp(typed, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => keypadGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const at = clamp(motion.value, 0, 1)

  const rowCount = clamp(Math.round(Number.isFinite(rows) ? rows : 4) || 4, 3, 5)
  const columnCount = clamp(Math.round(Number.isFinite(columns) ? columns : 3) || 3, 3, 4)
  const legends = keypadLegends(rowCount, columnCount)
  const deck = keyboardLayout(
    Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => 1)),
    { unit: UNIT, gap: GAP },
  )

  // Which keys the entry strikes, and where in the passage each one lands.
  const wanted = [...code]
    .map((character) => legends.indexOf(character))
    .filter((index) => index >= 0)
  const strikes = codeStrikes(wanted, deck.keys.length)
  const presses = strokePresses(strikes, deck.keys.length, at, { dwell: 0.1 })
  const taken = strikes.filter((strike) => at >= strike.at).length
  const answered = strikes.length > 0 && at > strikes[strikes.length - 1].at + 0.06
  const state: KeypadState =
    behavior === "scan" && !controlled
      ? "scan"
      : answered
        ? outcome
        : taken > 0
          ? "entry"
          : "idle"

  const reported = React.useRef<number | null>(null)
  React.useEffect(() => {
    const last = reported.current
    reported.current = taken
    if (last !== null && last !== taken) onEntryChange?.(taken)
  }, [taken, onEntryChange])

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onTypedChange?.(bounded)
    },
    [onTypedChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: { x: number }) => apply((unit.x - 0.12) / 0.76), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // The wedge. `rake` sets how far the back stands up, so the whole body is a
  // consequence of the one angle rather than a drawing that happens to look
  // tipped — and the face it carries is a plane the caps stand on.
  const tip = clamp(Number.isFinite(rake) ? rake : 22, 0, 40)
  const faceLength = deck.depth + READOUT + MARGIN * 3
  const faceWidth = Math.max(deck.width + MARGIN * 2, 78)
  const theta = toRadians(tip)
  const rise = faceLength * Math.sin(theta)
  const halfDepth = (faceLength * Math.cos(theta)) / 2
  const halfWidth = faceWidth / 2 + 6
  const backTop = LIP + rise
  const frame = deckFrame({ x: 0, y: LIP + rise / 2, z: 0 }, tip)

  const camera = robotCamera(view)
  const cap = { height: CAP_HEIGHT, travel: CAP_TRAVEL, body: 5, taper: 0.86 }
  /** Deck `y` of the middle of the key field, with the readout behind it. */
  const fieldY = faceLength / 2 - MARGIN - deck.depth / 2
  const readoutY = -faceLength / 2 + MARGIN + READOUT / 2
  // Column 0 is the operator's left-hand key. From where they stand — which is
  // where the `front` camera stands — screen-left is the machine's starboard,
  // so the columns run from +x to -x and the legends read 1 2 3 across.
  const placed = deck.keys.map((key) => ({ ...key, x: -key.x, y: key.y + fieldY }))

  const scan = matrixScan(motion.clock * SCAN_RATE, rowCount, columnCount)

  const shell = robotSurface("shell", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const capPaint = robotSurface("dark", variant, palette, 0.7)
  const plate = robotSurface("metal", variant, palette)

  const lamp =
    state === "granted"
      ? palette.accent
      : state === "denied"
        ? palette.shell
        : state === "entry" || state === "scan"
          ? palette.glow
          : palette.metal

  const body = slabPath(
    [
      { x: -halfWidth, y: 0, z: -halfDepth },
      { x: halfWidth, y: 0, z: -halfDepth },
      { x: -halfWidth, y: 0, z: halfDepth },
      { x: halfWidth, y: 0, z: halfDepth },
      { x: -halfWidth, y: LIP, z: -halfDepth },
      { x: halfWidth, y: LIP, z: -halfDepth },
      { x: -halfWidth, y: backTop, z: halfDepth },
      { x: halfWidth, y: backTop, z: halfDepth },
    ],
    camera,
  )

  const facePanel = deckPanel(camera, frame, 0, 0, faceWidth, faceLength, 0.4)
  const readoutPanel = deckPanel(camera, frame, 0, readoutY, deck.width, READOUT - 6, 1.2)
  const faceUp = facePanel.facing > 0.04

  // Keys nearer the camera paint last, which is the whole of the draw order on
  // a deck: from a low camera the front row stands in front of the back rows.
  const ordered = placed
    .map((key) => ({ key, depth: camera.depth(key.x, frame.origin.y, -key.y) }))
    .sort((a, b) => a.depth - b.depth)
    .map((entry) => entry.key)

  const envelope = boxCorners(
    { x: -halfWidth - 3, y: -2, z: -halfDepth - 3 },
    { x: halfWidth + 3, y: backTop + CAP_HEIGHT + 8, z: halfDepth + 3 },
  )
  const fit = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT - 20, 10, 1.4)

  const readout = `${taken}/${strikes.length || 0}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Entry keypad, ${rowCount} by ${columnCount} matrix, ${taken} of ${strikes.length} digits entered, ${state}, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(at) : undefined}
      aria-valuetext={interactive ? `${taken} of ${strikes.length} digits entered` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const step = strikes.length > 0 ? 1 / strikes.length : 0.2
        const delta = arrowStep(event.key, step, step * 2)
        if (delta !== 0) apply(at + delta)
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
      <g data-keypad data-view={view} data-state={state} transform={fit || undefined}>
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.7} opacity={0.6}>
            <path
              d={`M ${px(camera.project(-halfWidth - 14, 0, halfDepth).x)} ${px(camera.project(-halfWidth - 14, 0, halfDepth).y)} L ${px(camera.project(halfWidth + 14, 0, halfDepth).x)} ${px(camera.project(halfWidth + 14, 0, halfDepth).y)}`}
              strokeDasharray="7 2 2 2"
            />
          </g>
        )}
        <path data-body d={body} {...shell} />
        {faceUp && (
          <>
            <g data-face transform={facePanel.transform}>
              <rect x={0} y={0} width={px(faceWidth)} height={px(faceLength)} rx={4} {...plate} fillOpacity={variant === "solid" ? 0.55 : plate.fillOpacity} />
              {(showScan || variant === "blueprint") && (
                <g data-scan data-row={scan.row} data-cell={scan.cell} strokeWidth={1.4}>
                  {Array.from({ length: rowCount }, (_, row) => {
                    const y = faceLength / 2 + fieldY + deck.keys[row * columnCount].y - deck.depth / 2 + UNIT / 2
                    const lit = row === scan.row
                    return (
                      <path
                        key={row}
                        d={`M ${px(faceWidth / 2 - deck.width / 2 - MARGIN + 2)} ${px(y)} H ${px(faceWidth / 2 + deck.width / 2 + MARGIN - 2)}`}
                        stroke={lit ? palette.accent : palette.grid}
                        opacity={lit ? 0.9 : 0.35}
                      />
                    )
                  })}
                </g>
              )}
            </g>
            <g data-readout transform={readoutPanel.transform}>
              <rect x={0} y={0} width={px(deck.width)} height={px(READOUT - 6)} rx={3} {...cast} />
              {strikes.map((strike, index) => (
                <circle
                  key={strike.index + index}
                  data-dot={index}
                  data-filled={index < taken}
                  cx={px(deck.width / 2 - (strikes.length - 1) * 5 + index * 10)}
                  cy={px((READOUT - 6) / 2)}
                  r={2.8}
                  fill={index < taken ? lamp : palette.metal}
                  opacity={index < taken ? 1 : 0.35}
                />
              ))}
              <circle data-lamp data-state={state} cx={px(deck.width - 7)} cy={px((READOUT - 6) / 2)} r={3.2} fill={lamp} />
            </g>
          </>
        )}
        {ordered.map((key) => (
          <Cap
            key={key.index}
            placement={key}
            legend={legends[key.index] ?? ""}
            press={presses[key.index] ?? 0}
            scanned={scan.cell === key.index && (showScan || behavior === "scan")}
            camera={camera}
            frame={frame}
            cap={cap}
            paint={capPaint}
            palette={palette}
            faceUp={faceUp}
          />
        ))}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5.5}>
          {`${state.toUpperCase()} / ${readout}`}
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

/** One cap: a box standing on the face, and its legend riding the press down. */
function Cap({
  placement,
  legend,
  press,
  scanned,
  camera,
  frame,
  cap,
  paint,
  palette,
  faceUp,
}: {
  placement: KeyPlacement
  legend: string
  press: number
  scanned: boolean
  camera: ReturnType<typeof robotCamera>
  frame: ReturnType<typeof deckFrame>
  cap: { height: number; travel: number; body: number; taper: number }
  paint: ReturnType<typeof robotSurface>
  palette: ReturnType<typeof resolveRobotPalette>
  faceUp: boolean
}) {
  const down = clamp(press, 0, 1)
  const face = capFace(camera, frame, placement, down, cap)
  const readable = faceUp && face.facing > 0.1 && legend !== ""
  return (
    <g data-key={placement.index} data-down={down > 0.5} data-legend={legend} data-row={placement.row}>
      <path
        d={capSolid(camera, frame, placement, down, cap)}
        {...paint}
        stroke={scanned ? palette.glow : paint.stroke}
        strokeWidth={scanned ? 1.6 : paint.strokeWidth}
      />
      {readable && (
        <g transform={face.transform}>
          <text
            x={px(placement.width * cap.taper * 0.5)}
            y={px(placement.depth * cap.taper * 0.5)}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="ui-monospace, monospace"
            fontSize={9}
            fill={down > 0.5 ? palette.accent : palette.metal}
          >
            {legend}
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * The legends, generated rather than listed: digits up the deck, a clear, a zero
 * and an enter across the last row, and lettered keys once the digits run out —
 * so a wider matrix never draws the same legend twice. Glyphs, not a key set
 * that belongs to anyone.
 */
export function keypadLegends(rows: number, columns: number): string[] {
  const lastRow = (rows - 1) * columns
  let digit = 1
  let letter = 0
  return Array.from({ length: rows * columns }, (_, index) => {
    if (index >= lastRow) {
      const column = index - lastRow
      if (column === 0) return "×"
      if (column === 1) return "0"
      if (column === 2) return "↵"
    } else if (digit <= 9) {
      return String(digit++)
    }
    return KEYPAD_SYMBOLS[letter++] ?? ""
  })
}

/** The extra keys a wider matrix gets, once the digits have run out. */
const KEYPAD_SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"]

/**
 * Position through the entry at `clock`, 0..1. `entry` works through the
 * passage, holds the answer, and clears by the end of the cycle; `scan` and
 * `idle` press nothing, because on those the matrix is what is moving.
 */
export function keypadGoal(behavior: KeypadBehavior, clock: number): number {
  if (behavior !== "entry" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (t < 0.72) return t / 0.72
  if (t < 0.92) return 1
  return 0
}

export { RobotKeypad }
