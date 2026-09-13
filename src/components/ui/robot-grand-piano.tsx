"use client"

/**
 * robot-grand-piano — a player grand, and the action under it.
 *
 * The notes are a roll: one row per lane, any non-blank character a
 * perforation, and `lanes` says which key each row strikes — so three rows can
 * be a chord rather than three neighbours. A perforation comes round, the key
 * goes down, and the jack drives the hammer until its toe meets the let-off
 * button. From there the hammer covers the last of the blow with nothing behind
 * it, because you cannot hold a hammer against a string; on the way back the
 * check catches it part-way down and holds it there while the key is still
 * down. `combLift` is the approach and `combRelease` the ring, the same pair
 * the music box plucks a comb with.
 *
 * Everything in plan is derived from the scale. Each string runs from its
 * agraffe — one strike point in front of the hammer line — to its bridge pin
 * one speaking length behind it, so the curve of the bridge and, offset outward
 * from it, the bent side of the case both fall out of the lengths.
 *
 * Travels are drawn magnified: a key dips a three-hundredth of a concert
 * grand's length, which at this size is nothing at all. Every ratio, the
 * escapement and the check are solved life-size and reported unmagnified on the
 * `data-*` hooks.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  damperLift,
  hammerPose,
  lidPose,
  pianoKeys,
  pianoLayout,
  type LidStage,
} from "@/lib/robocn/piano"
import { barrelStep, combLift, combRelease, pinBarrel } from "@/lib/robocn/sound"
import {
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

const VIEW_W = 132
const VIEW_H = 124

/**
 * World units: x starboard — which is the bass side and the spine — y up, z
 * from the front of the case toward the tail. That puts the keyboard nose-up in
 * plan and makes `front` the player's own view, bass on the left.
 */
const CASE = { halfWidth: 21, margin: 3.5, strike: 20, top: 10.5, bottom: 0, floor: -22 }
/** Where the strings stand, and where the soundboard sits under them. */
const STRINGS = { y: 8, cross: 1.4, board: 4 }
/** The keyboard, down in its well: the naturals' ends and the balance rail. */
const KEYS = { front: 0.8, back: 5.6, balance: 3.6, y: 6, thick: 0.9 }
/** The action, at its true stations along the case. */
const ACTION = { flange: 10.6, damper: 24 }
/** Life-size figures: a ten millimetre dip throwing a hammer 47 millimetres. */
const REGULATION = { dip: 0.33, blow: 1.56, letOff: 0.066, shank: 4.14, lever: 7 }
/**
 * Drawing magnification for the travels alone. Nothing about the ratios, the
 * escapement or the check changes with it; it only makes them visible.
 */
const MAGNIFY = 2.2
/** Steps a string is left ringing after its hammer has struck it. */
const RING = 2.6
/** Steps per second while easing back after the roll is let go. */
const SLEW_RATE = 26
const NATIVE_VIEW: RobotView = "plan"

const fits: Record<RobotView, number> = { plan: 1.25, front: 1.2, profile: 1.25, iso: 1 }
const frames: Record<RobotView, Vec2> = {
  plan: { x: 66, y: 5 },
  front: { x: 66, y: 84 },
  profile: { x: 112, y: 72 },
  iso: { x: 89, y: 84 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** A broken chord and a scale, written for this file. */
const DEFAULT_ROLL = [
  "x.......x.......",
  "..x.......x.....",
  "....x.......x...",
  "......x.......x.",
  ".x...x...x...x..",
  "...x...x...x...x",
]
/** Which key each lane of the default roll strikes, low to high. */
const DEFAULT_LANES = [16, 28, 35, 40, 47, 52]

export type GrandPianoBehavior = "perform" | "rubato" | "static"
export type GrandPianoPedal = "none" | "damper" | "shift"

export interface RobotGrandPianoProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position through the roll, in steps. Omit to run `behavior`. */
  beat?: number
  /** What the roll does when `beat` is not supplied. */
  behavior?: GrandPianoBehavior
  /** Notes in the compass, rounded and clamped to 12–88. */
  notes?: number
  /** One row per lane; any non-blank character is a perforation at that step. */
  roll?: readonly string[]
  /** Which key each lane strikes, as an index into the compass. */
  lanes?: readonly number[]
  /** Where the lid stands. The angle is solved from its prop stick. */
  lid?: LidStage
  /** The pedals: sustain takes every damper off, una corda shifts the action. */
  pedal?: GrandPianoPedal
  /** Where the camera stands. One instrument, four projections. */
  view?: RobotView
  /** Passes of the whole roll per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to scrub the roll, or arrow-key it a note at a time. */
  interactive?: boolean
  onBeatChange?: (beat: number) => void
  /** The step now under the reading bar, 0-based. */
  onStepChange?: (step: number) => void
  showLegs?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotGrandPiano({
  beat,
  behavior = "perform",
  notes = 88,
  roll = DEFAULT_ROLL,
  lanes = DEFAULT_LANES,
  lid = "full",
  pedal = "none",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onBeatChange,
  onStepChange,
  showLegs = true,
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
}: RobotGrandPianoProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const compass = Number.isFinite(notes) ? clamp(Math.round(notes), 12, 88) : 88

  // An empty or malformed roll is a piano that runs and plays nothing.
  const rows = Array.isArray(roll) ? roll : DEFAULT_ROLL
  const barrel = pinBarrel(rows)
  const voices = Array.from({ length: barrel.tines }, (_, lane) => {
    const key = Array.isArray(lanes) ? lanes[lane] : undefined
    return Number.isFinite(key) ? clamp(Math.round(key as number), 0, compass - 1) : -1
  })

  const controlled = beat !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(beat) ? (beat as number) : 0) : held
  const steps = barrel.steps
  const goal = React.useCallback(
    (clock: number) => grandPianoGoal(behavior, clock, steps),
    [behavior, steps],
  )
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const position = Number.isFinite(motion.value) ? motion.value : 0
  const step = barrelStep(barrel, position)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onBeatChange?.(next)
      if (steps > 0) {
        const at = Math.floor(next)
        onStepChange?.(((at % steps) + steps) % steps)
      }
    },
    [steps, onBeatChange, onStepChange],
  )
  const live = React.useRef(position)
  React.useEffect(() => {
    live.current = position
  })
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = { from: live.current, at: unit.x }
          return
        }
        // The whole width of the frame is one pass of the roll.
        apply(press.current.from + (unit.x - press.current.at) * Math.max(1, steps))
      },
      [apply, steps],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  /* -- the instrument ------------------------------------------------------ */

  const layout = pianoLayout({
    notes: compass,
    shortest: 1.7,
    longest: 62,
    strike: CASE.strike,
    halfWidth: CASE.halfWidth,
    margin: CASE.margin,
    front: 0,
    pins: 2.6,
    tail: 12,
    overstrung: Math.max(2, Math.round(compass * 0.2)),
    hitch: 2.4,
  })
  const keys = pianoKeys(compass, { span: CASE.halfWidth * 2 - 2, length: KEYS.back - KEYS.front })
  const edge = CASE.halfWidth + CASE.margin
  const stand = lidPose(lid === "closed" || lid === "half" ? lid : "full", { width: edge * 2 })
  const sustain = pedal === "damper" ? 1 : 0
  // Una corda slides the whole action toward the treble by one string spacing.
  const shift = pedal === "shift" ? (CASE.halfWidth * 2) / Math.max(1, compass - 1) : 0
  /** The top notes of a grand carry no dampers at all. */
  const damped = Math.max(0, compass - Math.round(compass * 0.23))

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const origin = frames[view] ?? frames.plan
  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  /** One note's state, from the roll. */
  const voiceOf = (key: number) => {
    let lift = 0
    let ring = 0
    for (let lane = 0; lane < voices.length; lane += 1) {
      if (voices[lane] !== key) continue
      lift = Math.max(lift, combLift(barrel, lane, position))
      ring = Math.max(ring, combRelease(barrel, lane, position, { tail: RING }))
    }
    return { lift, ring }
  }

  const notesState = layout.strings.map((string) => {
    const { lift, ring } = voiceOf(string.index)
    const pose = hammerPose(lift, ring, REGULATION)
    const damper = string.index < damped
    const open = damperLift(pose.press, { pedal: sustain })
    return {
      string,
      pose,
      damper,
      open,
      // A string only goes on speaking while its damper is off it.
      sounding: ring > 0 && (!damper || open > 0.5) ? ring : 0,
    }
  })
  const sounding = notesState.reduce((total, note) => total + (note.sounding > 0 ? 1 : 0), 0)
  const reading = `${steps ? step + 1 : 0}/${steps}`

  /* -- the drawing --------------------------------------------------------- */

  const outline = (points: readonly Vec3[], close = true) =>
    `${points
      .map((point, index) => {
        const screen = project(point)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  const raise = (points: readonly Vec2[], y: number): Vec3[] =>
    points.map((point) => ({ x: point.x, y, z: point.y }))

  /**
   * The walls of a prism standing on a plan outline, drawn as a section: the
   * walls between the camera and the inside are cut away, so the harp and the
   * action read from every angle instead of from behind a rim.
   */
  const walls = (points: readonly Vec2[], top: number, bottom: number) =>
    points.flatMap((point, index) => {
      const next = points[(index + 1) % points.length]!
      const mid = { x: (point.x + next.x) / 2, z: (point.y + next.y) / 2 }
      const dx = next.x - point.x
      const dz = next.y - point.y
      const run = Math.hypot(dx, dz)
      if (run < 1e-6) return []
      const out = { x: dz / run, z: -dx / run }
      const facing =
        camera.depth(mid.x + out.x, top, mid.z + out.z) - camera.depth(mid.x, top, mid.z)
      if (facing > 0) return []
      return [
        slabPath(
          [
            { x: point.x, y: top, z: point.y },
            { x: next.x, y: top, z: next.y },
            { x: point.x, y: bottom, z: point.y },
            { x: next.x, y: bottom, z: next.y },
          ],
          camera,
        ),
      ]
    })

  /** A box in world space, from its two opposite corners. */
  const box = (a: Vec3, b: Vec3) =>
    slabPath(
      [a.y, b.y].flatMap((y) => [
        { x: a.x, y, z: a.z },
        { x: b.x, y, z: a.z },
        { x: a.x, y, z: b.z },
        { x: b.x, y, z: b.z },
      ]),
      camera,
    )

  const soundboard = layout.rim.map((point) => ({
    x: point.x * 0.93,
    y: point.y * 0.97 + layout.depth * 0.015,
  }))

  const lidAngle = toRadians(stand.angle)
  /** The lid is the case outline turned about the hinge that runs up the spine. */
  const onLid = (point: Vec2): Vec3 => {
    const reach = edge - point.x
    return {
      x: edge - reach * Math.cos(lidAngle),
      y: CASE.top + reach * Math.sin(lidAngle),
      z: point.y,
    }
  }

  const keyOf = (index: number) => keys[index] ?? keys[0]!
  const legs: Vec2[] = [
    { x: edge - 6, y: layout.depth - 7 },
    { x: -edge + 4.5, y: 5 },
    { x: edge - 4.5, y: 5 },
  ]

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot grand piano, ${compass} notes, step ${reading}, ${sounding} sounding, lid ${lid}, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 1 : undefined}
      aria-valuemax={interactive ? Math.max(1, steps) : undefined}
      aria-valuenow={interactive ? step + 1 : undefined}
      aria-valuetext={interactive ? `step ${reading}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 1, 4)
        if (delta !== 0) apply(Math.round(position) + delta)
        else if (event.key === "Home") apply(0)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={px((width * VIEW_H) / VIEW_W)}
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
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M 8 ${px(origin.y)} H ${VIEW_W - 8} M ${px(origin.x)} 8 V ${VIEW_H - 14}`}
            strokeDasharray="2 3"
          />
        </g>
      )}

      <g data-view={view} transform={`translate(${px(origin.x)} ${px(origin.y)}) scale(${px(fit)})`}>
        {showLegs && (
          <g>
            {legs.map((leg, index) => (
              <path
                key={index}
                data-leg={index}
                d={box(
                  { x: leg.x - 1.6, y: CASE.floor, z: leg.y - 1.6 },
                  { x: leg.x + 1.6, y: CASE.bottom, z: leg.y + 1.6 },
                )}
                {...cast}
              />
            ))}
            <g data-lyre>
              <path
                d={box(
                  { x: -3.6, y: CASE.floor * 0.55, z: 1.6 },
                  { x: 3.6, y: CASE.bottom, z: 2.8 },
                )}
                {...cast}
              />
              {(["shift", "sostenuto", "damper"] as const).map((name, index) => {
                const down =
                  (name === "damper" && pedal === "damper") || (name === "shift" && pedal === "shift")
                const y = CASE.floor * 0.55 + (down ? 1 : 0)
                return (
                  <path
                    key={name}
                    data-pedal={name}
                    d={slabPath(
                      [
                        { x: -3 + index * 3, y, z: 0.4 },
                        { x: -1.6 + index * 3, y, z: 0.4 },
                        { x: -3 + index * 3, y: y + 0.8, z: 4 },
                        { x: -1.6 + index * 3, y: y + 0.8, z: 4 },
                      ],
                      camera,
                    )}
                    fill={down ? palette.accent : palette.metal}
                    stroke={palette.dark}
                    strokeWidth={0.4}
                  />
                )
              })}
            </g>
          </g>
        )}

        <g data-rim>
          <path d={outline(raise(layout.rim, CASE.bottom))} {...cast} />
          {walls(layout.rim, CASE.top, CASE.bottom).map((wall, index) => (
            <path key={index} d={wall} {...cast} />
          ))}
          <path d={outline(raise(layout.rim, CASE.top))} {...shell} />
        </g>

        <path data-soundboard d={outline(raise(soundboard, STRINGS.board))} {...machined} />

        {/* The plate: the struts that carry the pull of the strings. Each one
            stops where the bent side comes in to meet it, so the plate is the
            shape of the case rather than a rectangle laid over it. */}
        <g data-plate>
          {[0.3, 0.46, 0.62].map((across) => {
            const x = (0.5 - across) * CASE.halfWidth * 2
            const reach = layout.rim.find((point) => point.x > x)?.y ?? layout.depth
            return (
              <path
                key={across}
                d={slabPath(
                  [
                    { x: x - 1.1, y: STRINGS.y + 0.7, z: CASE.strike + 2 },
                    { x: x + 1.1, y: STRINGS.y + 0.7, z: CASE.strike + 2 },
                    { x: x - 1.1, y: STRINGS.y + 0.7, z: reach - CASE.margin },
                    { x: x + 1.1, y: STRINGS.y + 0.7, z: reach - CASE.margin },
                  ],
                  camera,
                )}
                {...machined}
                opacity={0.85}
              />
            )
          })}
        </g>

        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path
            data-bridge="long"
            d={outline(raise(layout.bridge, STRINGS.board + 1.4), false)}
            stroke={palette.dark}
            strokeWidth={1.6}
          />
          {layout.bassBridge.length > 1 && (
            <path
              data-bridge="bass"
              d={outline(raise(layout.bassBridge, STRINGS.board + 1.4 + STRINGS.cross), false)}
              stroke={palette.dark}
              strokeWidth={1.6}
            />
          )}
          <path
            data-capo
            d={outline(raise(layout.capo, STRINGS.y + 0.6), false)}
            stroke={palette.metal}
            strokeWidth={1.1}
          />
        </g>

        <g data-strings>
          {notesState.map(({ string, sounding: ring }) => {
            const y = STRINGS.y + (string.crossed ? STRINGS.cross : 0)
            return (
              <path
                key={string.index}
                data-string={string.index}
                data-sounding={ring > 0 ? px(ring) : undefined}
                d={outline(
                  [string.pin, string.agraffe, string.bridge, string.hitchPin].map((point) => ({
                    x: point.x,
                    y,
                    z: point.y,
                  })),
                  false,
                )}
                fill="none"
                stroke={ring > 0 ? palette.accent : string.wound ? palette.dark : palette.metal}
                strokeWidth={string.wound ? 0.95 : 0.5}
                strokeLinecap="round"
                opacity={ring > 0 ? 1 : 0.85}
              />
            )
          })}
        </g>

        <g data-action data-shift={px(shift)}>
          {notesState.map(({ string, pose, damper, open }) => {
            const key = keyOf(string.index)
            const x = key.x + shift
            const rest = STRINGS.y - REGULATION.blow * MAGNIFY
            const head = rest + (pose.travel / REGULATION.blow) * REGULATION.blow * MAGNIFY
            const half = Math.max(0.28, key.width * 0.4)
            return (
              <g key={string.index}>
                <path
                  data-hammer={string.index}
                  data-travel={px(pose.travel)}
                  d={outline([
                    { x: x - 0.22, y: rest - 2.4, z: ACTION.flange },
                    { x: x + 0.22, y: rest - 2.4, z: ACTION.flange },
                    { x: x + 0.22, y: head, z: CASE.strike - 1.2 },
                    { x: x - 0.22, y: head, z: CASE.strike - 1.2 },
                  ])}
                  {...cast}
                />
                <path
                  d={box(
                    { x: x - half, y: head - 1.2, z: CASE.strike - 1.9 },
                    { x: x + half, y: head + 0.4, z: CASE.strike - 0.5 },
                  )}
                  fill={pose.contact ? palette.accent : palette.shell}
                  stroke={palette.dark}
                  strokeWidth={0.3}
                />
                {damper && (
                  <path
                    data-damper={string.index}
                    data-lift={px(open)}
                    d={box(
                      { x: x - half, y: STRINGS.y + open * MAGNIFY * 0.6, z: ACTION.damper - 0.7 },
                      { x: x + half, y: STRINGS.y + open * MAGNIFY * 0.6 + 1.4, z: ACTION.damper + 0.7 },
                    )}
                    fill={open > 0.5 ? palette.accent : palette.dark}
                    stroke={palette.dark}
                    strokeWidth={0.28}
                  />
                )}
              </g>
            )
          })}
        </g>

        <g data-keyboard>
          {notesState.map(({ string, pose }) => {
            const key = keyOf(string.index)
            const half = key.width * 0.44
            const drop = pose.press * REGULATION.dip * MAGNIFY
            // The key is a lever on its balance rail: the front goes down by
            // the dip and the back comes up, which is what lifts the capstan.
            const rock = (z: number) =>
              KEYS.y - (drop * (KEYS.balance - z)) / (KEYS.balance - KEYS.front)
            const nose = KEYS.back - key.length
            return (
              <path
                key={string.index}
                data-key={string.index}
                data-dip={px(pose.dip)}
                d={slabPath(
                  (
                    [
                      [nose, rock(nose)],
                      [KEYS.back, rock(KEYS.back)],
                    ] as const
                  ).flatMap(([z, top]) =>
                    [top - KEYS.thick, top].flatMap((y) => [
                      { x: key.x - half, y, z },
                      { x: key.x + half, y, z },
                    ]),
                  ),
                  camera,
                )}
                fill={key.natural ? palette.shell : palette.dark}
                stroke={palette.dark}
                strokeWidth={0.28}
              />
            )
          })}
        </g>

        {stand.angle > 0 && (
          <g data-lid data-angle={px(stand.angle)}>
            {/* Seen from above a raised lid covers most of the instrument, so
                it is drawn as the plate it is and the harp reads through it. */}
            <path d={outline(layout.rim.map((point) => onLid(point)))} {...shell} opacity={0.5} />
            <path
              data-prop
              d={outline(
                [
                  { x: edge - stand.foot, y: CASE.top, z: 9 },
                  {
                    x: edge - stand.notch * Math.cos(lidAngle),
                    y: CASE.top + stand.notch * Math.sin(lidAngle),
                    z: 9,
                  },
                ],
                false,
              )}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          </g>
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_W / 2} y={VIEW_H - 9} fontSize={5}>
          {`STEP ${reading} · ${sounding} SOUNDING`}
        </text>
        {label && (
          <text x={VIEW_W / 2} y={VIEW_H - 2.5} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/**
 * Position through the roll at `clock`, in steps. `perform` runs it at one pass
 * a cycle; `rubato` is the same pass with the rate swelling and easing inside
 * it, and it never runs backwards.
 */
export function grandPianoGoal(behavior: GrandPianoBehavior, clock: number, steps: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const span = Number.isFinite(steps) ? Math.max(0, steps) : 0
  if (behavior === "rubato") return clock * span + Math.sin(clock * Math.PI * 2) * span * 0.08
  return clock * span
}

export { RobotGrandPiano }
