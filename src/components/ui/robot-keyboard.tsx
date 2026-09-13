"use client"

/**
 * robot-keyboard — a whole key deck.
 *
 * The only machine in the set whose parts are **placed by a unit grid**: rows
 * are specified in units — 1u, 1.25u, 6.25u — laid out on one pitch, and the
 * stagger falls out of the widths the way it does on a real board rather than
 * being nudged into place. Its caps are sculpted per row, so the deck has a
 * genuine profile in elevation instead of being a flat plate, and every cap is
 * a solid standing on the deck plane that presses along its normal.
 *
 * `split` is the same rows cut down the middle and turned about the deck's
 * centre, which is a change to where the keys *are* rather than a second
 * drawing of a keyboard.
 *
 * The caps are blank. A passage is a rhythm across the deck, not text: nothing
 * here encodes a character, and no key set belonging to anyone is reproduced.
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
  keycapProfile,
  matrixScan,
  pressCurve,
  strokePresses,
  type KeyPlacement,
  type KeyStrike,
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

const VIEW_WIDTH = 260
const VIEW_HEIGHT = 190

/** Key pitch and the gap swallowed between caps, world units. */
const UNIT = 14
const GAP = 1.6
const CAP_TRAVEL = 2.6
const CAP_BODY = 4
/** How far the two halves of a split board are turned, and pushed apart. */
const SPLAY = 11
const SPLIT_GAP = 12
/** The case: a margin round the deck and the height of its front lip. */
const BEZEL = 8
const LIP = 12
/** Matrix scans per cycle of the clock. */
const SCAN_RATE = 5
/** Passage per second while easing back into the behaviour. */
const SLEW_RATE = 2.5
const NATIVE_VIEW: RobotView = "iso"

/** A 60% deck, in unit widths. Every row comes to fifteen. */
const COMPACT: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
]
/**
 * The split deck: the same rows, except that a 6.25u space cannot belong to one
 * half of a board that has been cut down the middle, so it becomes two thumb
 * keys of half the width. Everything else is where it was.
 */
const SPLIT: number[][] = COMPACT.map((row, index) =>
  index === COMPACT.length - 1
    ? [1.25, 1.25, 1.25, 3.125, 3.125, 1.25, 1.25, 1.25, 1.25]
    : row,
)

/** The same deck with a function row on top and a four-column block beside it. */
const EXTENDED: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  ...COMPACT,
].map((row) => [...row, 1, 1, 1, 1])

/** Which row a hand rests on, and the two keys that carry the bumps. */
const HOME_ROW = 2
const HOME_COLUMNS = [4, 7]

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type KeyboardBehavior = "type" | "ripple" | "scan" | "idle" | "static"
export type KeyboardLayoutName = "compact" | "extended" | "split"
export type KeycapSculpt = "sculpted" | "flat"

export interface RobotKeyboardProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position through the passage, 0 to 1. Omit to run `behavior`. */
  typed?: number
  /** What the deck does when `typed` is not supplied. */
  behavior?: KeyboardBehavior
  /** Which deck it is. `split` cuts the same rows and turns the halves apart. */
  layout?: KeyboardLayoutName
  /** Whether the rows are sculpted or the caps are all one height. */
  profile?: KeycapSculpt
  /** Keystrokes in the passage, rounded and clamped to 4–40. */
  strokes?: number
  /** How far the case is tipped up from the desk, degrees. Clamped 0–16. */
  rake?: number
  /** Light the caps that are down. */
  backlight?: boolean
  /** Draw the row rails and the cell the scan is reading. */
  showScan?: boolean
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Passages per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across the deck to scrub the passage, or arrow-key it a stroke at a time. */
  interactive?: boolean
  onTypedChange?: (typed: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotKeyboard({
  typed,
  behavior = "type",
  layout = "compact",
  profile = "sculpted",
  strokes = 16,
  rake = 6,
  backlight = true,
  showScan = false,
  view = NATIVE_VIEW,
  speed = 0.22,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onTypedChange,
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
}: RobotKeyboardProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = typed !== undefined
  const hold = controlled ? (Number.isFinite(typed) ? clamp(typed, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => keyboardGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const at = clamp(motion.value, 0, 1)

  const deckName: KeyboardLayoutName =
    layout === "extended" || layout === "split" ? layout : "compact"
  const spec = deckName === "extended" ? EXTENDED : deckName === "split" ? SPLIT : COMPACT
  const deck = keyboardLayout(spec, { unit: UNIT, gap: GAP })
  const sculpted = profile !== "flat"

  // Where every cap actually sits. A split board turns each half about the
  // deck's own centre and pushes it out, so the keys move rather than the
  // picture being redrawn — and each cap carries the turn as its own spin.
  const placed = deck.keys.map((key) => {
    const row = keycapProfile(key.row, deck.rows, 6)
    const cap = {
      height: sculpted ? row.rise : 6,
      tilt: sculpted ? row.tilt : 0,
      travel: CAP_TRAVEL,
      body: CAP_BODY,
      taper: 0.86,
      spin: 0,
    }
    if (deckName !== "split") return { key, cap, side: null as "left" | "right" | null }
    const side = key.x < 0 ? "left" : "right"
    const turn = key.x < 0 ? SPLAY : -SPLAY
    const theta = toRadians(turn)
    const cs = Math.cos(theta)
    const sn = Math.sin(theta)
    const shift = (key.x < 0 ? -1 : 1) * (SPLIT_GAP / 2)
    return {
      key: {
        ...key,
        x: key.x * cs - key.y * sn + shift,
        y: key.x * sn + key.y * cs,
      },
      cap: { ...cap, spin: turn },
      side: side as "left" | "right",
    }
  })

  // The passage: a deterministic rhythm of keystrokes across the deck. Nothing
  // here encodes text — the caps are blank, and so is the intent.
  const count = clamp(Math.round(Number.isFinite(strokes) ? strokes : 16) || 16, 4, 40)
  const strikes = passageStrikes(count, deck.keys.length)
  const wave = deckName === "split" ? deck.width + SPLIT_GAP : deck.width
  const typing = controlled || behavior === "type"
  const presses = typing
    ? strokePresses(strikes, deck.keys.length, at, { dwell: 0.06 })
    : behavior === "ripple"
      ? placed.map(({ key }) => keyboardRipple(motion.clock, (key.x + wave / 2) / wave))
      : new Array<number>(deck.keys.length).fill(0)

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
    onDrag: React.useCallback((unit: { x: number }) => apply((unit.x - 0.1) / 0.8), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // The case, sized from where the keys actually ended up rather than from the
  // spec, so a splayed board gets a case that still contains it.
  const spread = placed.reduce(
    (box, { key }) => ({
      x: Math.max(box.x, Math.abs(key.x) + key.width / 2),
      y: Math.max(box.y, Math.abs(key.y) + key.depth / 2),
    }),
    { x: 0, y: 0 },
  )
  const faceWidth = (spread.x + BEZEL) * 2
  const faceLength = (spread.y + BEZEL) * 2
  const tip = clamp(Number.isFinite(rake) ? rake : 6, 0, 16)
  const theta = toRadians(tip)
  const rise = faceLength * Math.sin(theta)
  const halfDepth = (faceLength * Math.cos(theta)) / 2
  const halfWidth = faceWidth / 2
  const backTop = LIP + rise
  const frame = deckFrame({ x: 0, y: LIP + rise / 2, z: 0 }, tip)

  const camera = robotCamera(view)
  const scan = matrixScan(motion.clock * SCAN_RATE, deck.rows, Math.max(...spec.map((row) => row.length)))

  const shell = robotSurface("shell", variant, palette)
  const plate = robotSurface("metal", variant, palette)
  const capPaint = robotSurface("dark", variant, palette, 0.6)
  // A cap's outline: the drawn equivalent of the shadow gap between two caps.
  // The `dark` role carries no outline by design, and without one an iso camera
  // turns sixty caps into one dark slab.
  const capEdge = variant === "solid" ? palette.metal : capPaint.stroke
  const capEdgeWidth = variant === "solid" ? 0.5 : capPaint.strokeWidth

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
  const facePanel = deckPanel(camera, frame, 0, 0, faceWidth, faceLength, 0.3)
  const faceUp = facePanel.facing > 0.04

  const ordered = placed
    .map((entry) => ({ entry, depth: camera.depth(entry.key.x, frame.origin.y, -entry.key.y) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ entry }) => entry)

  const envelope = boxCorners(
    { x: -halfWidth - 2, y: -2, z: -halfDepth - 2 },
    { x: halfWidth + 2, y: backTop + 14, z: halfDepth + 2 },
  )
  const fit = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT - 20, 8, 1.6)

  const down = presses.filter((press) => press > 0.5).length
  const state = typing ? "typing" : behavior

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Keyboard deck, ${deckName} layout, ${deck.keys.length} keys, ${sculpted ? "sculpted" : "flat"} profile, ${down} down, ${viewNames[view] ?? viewNames.iso}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(at) : undefined}
      aria-valuetext={interactive ? `${Math.round(at * 100)} percent through the passage` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const step = 1 / count
        const delta = arrowStep(event.key, step, step * 3)
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
      <g data-deck data-view={view} data-layout={deckName} transform={fit || undefined}>
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.7} opacity={0.6}>
            <path
              d={`M ${px(camera.project(-halfWidth - 12, 0, halfDepth).x)} ${px(camera.project(-halfWidth - 12, 0, halfDepth).y)} L ${px(camera.project(halfWidth + 12, 0, halfDepth).x)} ${px(camera.project(halfWidth + 12, 0, halfDepth).y)}`}
              strokeDasharray="7 2 2 2"
            />
          </g>
        )}
        <path data-body d={body} {...shell} />
        {faceUp && (
          <g data-face transform={facePanel.transform}>
            <rect
              x={0}
              y={0}
              width={px(faceWidth)}
              height={px(faceLength)}
              rx={3}
              {...plate}
              fillOpacity={variant === "solid" ? 0.5 : plate.fillOpacity}
            />
            {(showScan || variant === "blueprint") && (
              <g data-scan data-row={scan.row} data-cell={scan.cell} strokeWidth={1.1}>
                {Array.from({ length: deck.rows }, (_, row) => {
                  const y = faceLength / 2 + (row + 0.5) * UNIT - deck.depth / 2
                  const lit = row === scan.row
                  return (
                    <g key={row} opacity={lit ? 0.9 : 0.28}>
                      <path
                        d={`M ${px(BEZEL / 2)} ${px(y)} H ${px(faceWidth - BEZEL / 2)}`}
                        stroke={lit ? palette.accent : palette.grid}
                      />
                      {lit &&
                        [BEZEL / 2, faceWidth - BEZEL / 2].map((x) => (
                          <circle key={x} cx={px(x)} cy={px(y)} r={1.6} fill={palette.accent} stroke="none" />
                        ))}
                    </g>
                  )
                })}
              </g>
            )}
          </g>
        )}
        {ordered.map(({ key, cap, side }) => {
          const press = clamp(presses[key.index] ?? 0, 0, 1)
          const home = key.row === HOME_ROW && HOME_COLUMNS.includes(key.column)
          const lit = backlight && press > 0.5
          const read = scan.cell === key.index && (showScan || behavior === "scan")
          const face = capFace(camera, frame, key, press, cap)
          return (
            <g
              key={key.index}
              data-key={key.index}
              data-down={press > 0.5}
              data-row={key.row}
              {...(side ? { "data-half": side } : {})}
            >
              <path
                d={capSolid(camera, frame, key, press, cap)}
                {...capPaint}
                stroke={read ? palette.glow : capEdge}
                strokeWidth={read ? 1.4 : capEdgeWidth}
                strokeOpacity={read ? 1 : variant === "solid" ? 0.4 : undefined}
              />
              {face && face.facing > 0.08 && (
                <g data-legend transform={face.transform}>
                  {variant === "solid" && (
                    <rect
                      x={0}
                      y={0}
                      width={px(key.width * 0.86)}
                      height={px(key.depth * 0.86)}
                      rx={1}
                      fill={palette.metal}
                      opacity={0.1}
                    />
                  )}
                  {lit && (
                    <rect
                      data-backlight
                      x={px(key.width * 0.22)}
                      y={px(key.depth * 0.3)}
                      width={px(key.width * 0.42)}
                      height={px(key.depth * 0.25)}
                      rx={1}
                      fill={palette.accent}
                      opacity={0.85}
                    />
                  )}
                  {home && (
                    <rect
                      data-home
                      x={px(key.width * 0.3)}
                      y={px(key.depth * 0.66)}
                      width={px(key.width * 0.3)}
                      height={1.2}
                      rx={0.6}
                      fill={palette.metal}
                      opacity={0.8}
                    />
                  )}
                </g>
              )}
            </g>
          )
        })}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5.5}>
          {`${deckName.toUpperCase()} / ${deck.keys.length} KEYS / ${state.toUpperCase()}`}
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

/**
 * The passage: `strokes` keystrokes spread evenly across it, on keys chosen by
 * a fixed sequence so the same board always types the same rhythm. It is a
 * rhythm and nothing more — no text, no layout, no encoding.
 */
export function passageStrikes(strokes: number, keys: number): KeyStrike[] {
  const deck = Math.max(0, Math.round(strokes))
  if (deck === 0 || keys <= 0) return []
  let seed = 7
  const indices = Array.from({ length: deck }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % keys
  })
  return codeStrikes(indices, keys, { start: 0.05, end: 0.95 })
}

/**
 * How far a key at `across` — 0 at one end of the deck, 1 at the other — is
 * pressed by the self-test wave at `clock`. One bump crossing the board, not
 * every key at once.
 */
export function keyboardRipple(clock: number, across: number): number {
  if (!Number.isFinite(clock) || !Number.isFinite(across)) return 0
  const lead = (((clock % 1) + 1) % 1) * 1.3 - 0.15
  const t = (lead - clamp(across, 0, 1)) / 0.16
  return t >= 0 && t <= 1 ? pressCurve(t) : 0
}

/**
 * Position through the passage at `clock`, 0..1. Only `type` uses it: `ripple`
 * and `scan` are functions of the clock itself rather than of a passage, and
 * `idle` types nothing at all.
 */
export function keyboardGoal(behavior: KeyboardBehavior, clock: number): number {
  if (behavior !== "type" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  return Math.min(1, t / 0.88)
}

export type { KeyPlacement }
export { RobotKeyboard }
