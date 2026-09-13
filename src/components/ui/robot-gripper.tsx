"use client"

/**
 * robot-gripper — an end effector on its own.
 *
 * The jaws of `robot-arm`, drawn big enough to be the subject rather than the
 * detail at the end of a limb: a clamp for an empty state, a status icon for a
 * cell that is holding something, a control for an opening you own.
 *
 * Left alone it works a pick cycle — open, close onto a part, carry it, let it
 * go. Interactive, the jaws are a handle: drag one out to open them, click to
 * toggle, and release to hand the cycle back.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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

const VIEW = 120
/** Jaw travel either side of the centre line, in view units. */
const TRAVEL = 13
/** Openings per second while easing back from a grab. */
const RETURN_RATE = 2.4
/** A press that slides less than this fraction of the frame is a click. */
const CLICK_SLOP = 0.03
/** The tool is drawn straight on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Where the tool's own origin sits in the frame, and the height datum the
 *  solids are measured from. */
const CENTRE = 60
const DATUM = 55

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type GripperFingers = "parallel" | "angular"
export type GripperBehavior = "cycle" | "flex" | "static"

export interface RobotGripperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** How far open, 0 closed to 1 wide. Omit to run `behavior`. */
  opening?: number
  /** What the jaws do when `opening` is not supplied. */
  behavior?: GripperBehavior
  /** Where the camera stands. One tool, four projections. */
  view?: RobotView
  /** Pick cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag a jaw, click to toggle, arrow-key the opening. */
  interactive?: boolean
  onOpeningChange?: (opening: number) => void
  /**
   * Jaw shape. Parallel fingers stay square to the part; angular fingers close
   * onto a round one.
   */
  fingers?: GripperFingers
  /** Draw a part clamped between the jaws. Omit and the cycle carries one. */
  holding?: boolean
  /** Powered: the status lamp pulses. */
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
}

function RobotGripper({
  opening,
  behavior = "cycle",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onOpeningChange,
  fingers = "parallel",
  holding,
  active = false,
  variant = "solid",
  size = "md",
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
}: RobotGripperProps) {
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const width = resolveRobotSize(size)
  const controlled = opening !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  // A slider bound straight to this prop can hand over NaN; clamp before the
  // number reaches any geometry, or the whole drawing disappears.
  const hold = controlled ? (Number.isFinite(opening) ? clamp(opening, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => gripperGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: RETURN_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const open = clamp(motion.value, 0, 1)
  const offset = px(open * TRAVEL)
  // Uncontrolled, the part appears when the jaws close on it and leaves when
  // they open, so the cycle reads as a pick rather than a clamp opening.
  const carrying = holding ?? (!controlled && behavior === "cycle" && gripperCarrying(motion.clock))

  const apply = React.useCallback((next: number) => {
    const bounded = clamp(next, 0, 1)
    setHeld(bounded)
    onOpeningChange?.(bounded)
  }, [onOpeningChange, setHeld])

  const press = React.useRef<{ at: number; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => {
      if (!press.current) {
        press.current = { at: unit.x, moved: false }
        return
      }
      if (Math.abs(unit.x - press.current.at) > CLICK_SLOP) press.current.moved = true
      // Drag a jaw outward and the pair opens with it.
      if (press.current.moved) apply((Math.abs(unit.x * VIEW - VIEW / 2) - 5) / TRAVEL)
    }, [apply]),
    onDragEnd: React.useCallback(() => {
      const started = press.current
      press.current = null
      if (!started) return
      // A tap toggles: closed jaws open, open jaws close.
      if (started.moved) setHeld(null)
      else apply(open > 0.5 ? 0 : 1)
    }, [apply, open, setHeld]),
  })
  const percent = Math.round(open * 100)

  const shell = robotSurface("shell", variant, palette, 1)
  const metalSurface = robotSurface("metal", variant, palette, 1)
  const darkSurface = robotSurface("dark", variant, palette, 1)

  // The drawing is a front elevation of the tool, so it goes through `wall`
  // where it already stands and comes out untouched straight on. The depth of
  // the body, the wrist and the jaw plates is what it never had to show.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const face = aboutPoint(camera.wall(), CENTRE, DATUM)
  // Straight on there is no camera to apply, so there is no element either and
  // the drawing is exactly the one this tool always made.
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** Frame coordinates in, world height out: y runs down the drawing. */
  const rise = (y: number) => DATUM - y
  /** A box `deep` units through, `wide` either side of frame x `x`. */
  const box = (x: number, wide: number, deep: number, top: number, bottom: number) =>
    extrudedPath(
      roundedFootprint(wide, deep, Math.min(wide, deep) * 0.3, 4).map((point) => ({
        x: point.x - (x - CENTRE),
        y: point.y,
      })),
      camera,
      rise(top),
      rise(bottom),
    )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={ariaLabel ?? `Robot gripper, ${percent}% open, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent}% open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(open + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={width}
      height={width}
      className={cn(
        "select-none overflow-hidden",
        interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      data-view={view}
      {...props}
    >
      {offAxis ? (
        <g data-solids transform={`translate(${CENTRE} ${DATUM})`}>
          <path d={box(CENTRE, 16, 15, 8, 15)} {...metalSurface} />
          <path d={box(CENTRE, 22, 13, 15, 41)} {...shell} />
          <path d={box(CENTRE, 30, 10, 41, 53)} {...darkSurface} />
          <path d={box(CENTRE, 26, 7, 53, 57)} {...metalSurface} />
          {[-1, 1].map((side) => (
            <g key={side}>
              <path d={box(CENTRE + side * 9 + side * offset, 7, 8, 55, 67)} {...darkSurface} />
              <path
                d={box(CENTRE + side * 9 + side * offset, 5, 6, 64, fingers === "parallel" ? 98 : 96)}
                {...metalSurface}
              />
            </g>
          ))}
          {carrying ? <path d={box(CENTRE, 12, 10, 78, 98)} fill={palette.accent} opacity={0.9} /> : null}
        </g>
      ) : null}
      <Frame {...frame}>
      {/* Tool flange and wrist: what it bolts to. */}
      <rect x={44} y={8} width={32} height={7} rx={2} {...metalSurface} />
      <rect x={38} y={15} width={44} height={26} rx={5} {...shell} />
      {[46, 60, 74].map((x) => (
        <circle key={x} cx={x} cy={20} r={2.2} fill={palette.metal} opacity={0.75} />
      ))}
      <rect x={30} y={41} width={60} height={12} rx={4} {...darkSurface} />

      {/* Rails the jaws ride on. */}
      <rect x={34} y={53} width={52} height={4} rx={2} {...metalSurface} />

      {[-1, 1].map((side) => (
        <g
          key={side}
          data-jaw={side < 0 ? "left" : "right"}
          transform={`translate(${px(side * offset)} 0)`}
        >
          <rect
            x={side < 0 ? 44 : 62}
            y={55}
            width={14}
            height={12}
            rx={3}
            {...darkSurface}
          />
          <path d={fingerPath(side, fingers)} {...metalSurface} />
          {/* Grip pad: the face that actually touches the part. */}
          <rect
            x={side < 0 ? 55 : 60}
            y={fingers === "parallel" ? 72 : 78}
            width={5}
            height={fingers === "parallel" ? 22 : 14}
            rx={1.5}
            fill={palette.dark}
            opacity={0.85}
          />
        </g>
      ))}

      {carrying ? (
        <rect
          x={48}
          y={78}
          width={24}
          height={20}
          rx={3}
          fill={palette.accent}
          opacity={0.9}
        />
      ) : null}

      <circle
        cx={60}
        cy={28}
        r={3.4}
        fill={palette.glow}
        className={active ? "robocn-pulse" : undefined}
      />
      </Frame>
    </svg>
  )
}

/** Fold a running clock into one pick cycle. */
const cycleOf = (clock: number) => (Number.isFinite(clock) ? ((clock % 1) + 1) % 1 : 0)

const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * How far open the jaws are at `clock`: wide, closing onto a part, carrying
 * it, then releasing. The dwells are where the work happens.
 */
export function gripperGoal(behavior: GripperBehavior, clock: number) {
  if (behavior === "static") return 0.6
  const t = cycleOf(clock)
  if (behavior === "flex") return 0.5 + Math.sin(t * Math.PI * 2) * 0.35
  if (t < 0.2) return 0.9
  if (t < 0.35) return lerp(0.9, 0.12, ease((t - 0.2) / 0.15))
  if (t < 0.75) return 0.12
  if (t < 0.9) return lerp(0.12, 0.9, ease((t - 0.75) / 0.15))
  return 0.9
}

/** True over the closed part of the cycle, when there is a part in the jaws. */
export function gripperCarrying(clock: number) {
  const t = cycleOf(clock)
  return t >= 0.3 && t < 0.8
}

/**
 * Jaw outline. Parallel fingers drop straight so the faces stay square to the
 * part; angular fingers swing in, which is how you hold something round.
 */
function fingerPath(side: number, fingers: GripperFingers) {
  const sign = side < 0 ? 1 : -1
  const root = side < 0 ? 51 : 69
  if (fingers === "parallel") {
    return [
      `M ${px(root - sign * 5)} 64`,
      `L ${px(root + sign * 5)} 64`,
      `L ${px(root + sign * 5)} 98`,
      `L ${px(root - sign * 5)} 98`,
      "Z",
    ].join(" ")
  }
  return [
    `M ${px(root - sign * 5)} 64`,
    `L ${px(root + sign * 5)} 64`,
    `L ${px(root + sign * 9)} 86`,
    `L ${px(root + sign * 2)} 96`,
    `L ${px(root - sign * 4)} 92`,
    "Z",
  ].join(" ")
}

export { RobotGripper }
