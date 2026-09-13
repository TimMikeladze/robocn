"use client"

/**
 * key-switch — one mechanical keyswitch, sectioned.
 *
 * The only machine in the set whose output is **discrete**. Everything else
 * reports a number; this reports a contact that is either closed or not, and
 * the point it closes at is partway down a continuous travel with overtravel
 * left after it. It also has real hysteresis: the leaf resets higher than it
 * actuated, which is what stops a switch chattering when a finger rests on it.
 *
 * The cutaway is a drawing in the machine's own fore-aft plane, pushed through
 * the camera. From `plan` and `front` that plane is edge on — a line, which is
 * what a section seen from the side is — so from those two the switch is drawn
 * as the solids it is made of, and the cap's travel is still what moves.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { keyTravel, pressCurve } from "@/lib/robocn/keyboard"
import { clamp } from "@/lib/robocn/kinematics"
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

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 190
/** Where the machine's own origin — the middle of its base, on the board — sits. */
const ORIGIN = { x: 100, y: 150 }

/** Drawing units of cap travel per world unit of it. */
const TRAVEL_SCALE = 4
/**
 * The switch in elevation, as heights above the board. One drawing unit is one
 * world unit, so the same numbers place the solids for the cameras that cannot
 * see the section.
 */
const FLOOR_Y = 4
const HOUSING_Y = 54
const COLLAR_Y = 74
const CAP_BODY = 24
/** Elevation `y` of a height above the board. */
const up = (height: number) => ORIGIN.y - height
const FLOOR = up(FLOOR_Y)
const CAVITY_TOP = up(HOUSING_Y - 4)
/** Percent per second while easing back into the behaviour. */
const SLEW_RATE = 6
const NATIVE_VIEW: RobotView = "profile"

/** The cutaway is legible from these two; edge on from the other two. */
const sectionViews = new Set<RobotView>(["profile", "iso"])

const frames: Record<RobotView, { zoom: number; dy: number }> = {
  plan: { zoom: 0.88, dy: -52 },
  front: { zoom: 1, dy: -4 },
  profile: { zoom: 1, dy: 0 },
  iso: { zoom: 0.86, dy: -10 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type KeySwitchBehavior = "tap" | "flutter" | "hold" | "static"
export type KeySwitchAction = "linear" | "tactile" | "clicky"

export interface KeySwitchProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled press, 0 at rest to 1 bottomed out. Omit to run `behavior`. */
  press?: number
  /** What the stem does when `press` is not supplied. */
  behavior?: KeySwitchBehavior
  /** What the stem's leg does on the way down. */
  action?: KeySwitchAction
  /** Full travel of the stem in world units. Clamped to 2–6. */
  travel?: number
  /** How far down the contact closes, world units. Clamped inside the travel. */
  actuation?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Strokes per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the cap down, or arrow-key it. */
  interactive?: boolean
  onPressChange?: (press: number) => void
  /** Fires when the contact closes or opens — never once per frame. */
  onActuatedChange?: (closed: boolean) => void
  showBoard?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function KeySwitch({
  press,
  behavior = "tap",
  action = "tactile",
  travel = 4,
  actuation,
  view = NATIVE_VIEW,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onPressChange,
  onActuatedChange,
  showBoard = true,
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
}: KeySwitchProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  /** The leaf's own memory. It is why this switch has hysteresis. */
  const [closed, setClosed] = React.useState(false)

  const controlled = press !== undefined
  const hold = controlled ? (Number.isFinite(press) ? clamp(press, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => keySwitchGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const value = clamp(motion.value, 0, 1)

  const stroke = clamp(Number.isFinite(travel) ? travel : 4, 2, 6)
  const close = clamp(Number.isFinite(actuation ?? Number.NaN) ? actuation! : stroke / 2, 0.2, stroke)
  const pose = keyTravel(value, {
    travel: stroke,
    actuation: close,
    reset: close - stroke * 0.1,
    closed,
  })

  React.useEffect(() => {
    if (pose.actuated === closed) return
    setClosed(pose.actuated)
    onActuatedChange?.(pose.actuated)
  }, [pose.actuated, closed, onActuatedChange])

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onPressChange?.(bounded)
    },
    [onPressChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Down the frame presses it, which is the way a finger does.
    onDrag: React.useCallback((unit: { y: number }) => apply((unit.y - 0.26) / 0.34), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const frame = frames[view] ?? frames.profile
  const sectioned = sectionViews.has(view)
  /** How far everything that moves has moved, in drawing units. */
  const shift = px(pose.fraction * stroke * TRAVEL_SCALE)
  const full = stroke * TRAVEL_SCALE
  /** Where the cap's underside sits once the contact has closed. */
  const trip = px((close / stroke) * full)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const coil = robotSurface("metal", variant, palette, 0.7)

  // The cap rides `full` above the housing at rest and lands on it bottomed
  // out, so a longer-travel switch really does stand its cap higher.
  const capBase = up(COLLAR_Y) - full
  const skirtBottom = FLOOR - full
  const skirtTop = skirtBottom - 34
  const legBottom = FLOOR - full - 6
  const legTop = legBottom - 40

  // The spring: a zigzag between the stem's inner ceiling and the cavity floor,
  // so its pitch closes up as the stem comes down rather than the coil sliding.
  const springTop = skirtTop + 6 + Number(shift)
  const coils = 6
  const springPath = Array.from({ length: coils * 2 + 1 }, (_, index) => {
    const y = springTop + ((FLOOR - springTop) * index) / (coils * 2)
    const x = 100 + (index % 2 === 0 ? 0 : index % 4 === 1 ? 12 : -12)
    return `${index ? "L" : "M"} ${px(x)} ${px(y)}`
  }).join(" ")

  // The leg the stem carries down past the leaf. A tactile leg has a lobe on
  // it, a clicky one drives a separate jacket, and a linear one is a plain bar.
  const legPath =
    action === "tactile"
      ? `M 112 ${px(legTop)} H 119 V ${px(legTop + 14)} L 124 ${px(legTop + 21)} L 119 ${px(legTop + 28)} V ${px(legBottom)} H 112 Z`
      : `M 112 ${px(legTop)} H 119 V ${px(legBottom)} H 112 Z`
  /** The jacket takes up its slack before the stem carries it down. */
  const jacketShift = px(Math.max(0, Number(shift) - full * 0.28))

  // The leaf is the discrete part: held off the fixed contact by the leg, and
  // sprung onto it the moment the leg's waist comes past.
  const tip = pose.actuated ? 126 : 117
  const leafPath = `M 122 ${px(FLOOR)} V 134 Q ${px(tip)} 126 ${px(tip)} 110`

  const capFootprint = roundedFootprint(19, 19, 3, 4)
  const solids = (
    <g data-solid>
      <path d={extrudedPath(roundedFootprint(18, 18, 2.5, 3), camera, HOUSING_Y, FLOOR_Y - 4)} {...cast} />
      <g data-housing transform={camera.plane(HOUSING_Y)}>
        <rect x={-18} y={-18} width={36} height={36} rx={2.5} {...cast} />
        <rect x={-7} y={-7} width={14} height={14} rx={1.5} {...machined} />
      </g>
      <path d={extrudedPath(roundedFootprint(7, 7, 1.5, 3), camera, COLLAR_Y, HOUSING_Y)} {...machined} />
      <g data-face transform={camera.wall(18) || undefined} opacity={0.8}>
        <path
          d={`M -14 ${-HOUSING_Y + 10} H 14 M -14 ${-HOUSING_Y + 40} H 14`}
          fill="none"
          stroke={palette.metal}
          strokeWidth={1.1}
          opacity={0.5}
        />
        <rect x={-6} y={-26} width={12} height={14} rx={1.4} {...machined} fillOpacity={0.35} />
      </g>
      <g data-keycap>
        <path
          d={extrudedPath(capFootprint, camera, px(COLLAR_Y + full + CAP_BODY - Number(shift)), px(COLLAR_Y + full - Number(shift)))}
          {...shell}
        />
        <g transform={camera.plane(px(COLLAR_Y + full + CAP_BODY - Number(shift)))}>
          <rect x={-16} y={-16} width={32} height={32} rx={3} {...shell} />
          <path d="M -11 -3 Q 0 3 11 -3" fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.45} />
        </g>
      </g>
    </g>
  )

  const section = (
    <g data-section>
      <path
        data-housing
        d={`M 64 ${px(FLOOR + 4)} V ${px(up(HOUSING_Y) + 3)} Q 64 ${px(up(HOUSING_Y))} 68 ${px(up(HOUSING_Y))} H 84 V ${px(up(COLLAR_Y) + 3)} Q 84 ${px(up(COLLAR_Y))} 88 ${px(up(COLLAR_Y))} H 112 Q 116 ${px(up(COLLAR_Y))} 116 ${px(up(COLLAR_Y) + 3)} V ${px(up(HOUSING_Y))} H 132 Q 136 ${px(up(HOUSING_Y))} 136 ${px(up(HOUSING_Y) + 3)} V ${px(FLOOR + 4)} Z`}
        {...cast}
      />
      {/* The cavity the stem runs in, cut open. */}
      <path
        d={`M 70 ${px(FLOOR)} V ${px(CAVITY_TOP)} H 130 V ${px(FLOOR)} Z`}
        {...cast}
        fillOpacity={variant === "solid" ? 0.45 : cast.fillOpacity}
      />
      {/* The housing's centre pole, which the spring sits around. */}
      <rect x={96} y={px(FLOOR - 22)} width={8} height={22} {...machined} fillOpacity={0.6} />
      <g data-contact data-closed={pose.actuated}>
        <rect x={126} y={px(FLOOR - 38)} width={3.5} height={38} {...machined} />
        <path
          d={leafPath}
          fill="none"
          stroke={pose.actuated ? palette.accent : palette.metal}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <g data-stem transform={`translate(0 ${shift})`}>
        {/* The skirt: open at the bottom, and it lands on the floor at the end
            of the travel — which is what bottoming out is. */}
        <path
          d={`M 84 ${px(skirtBottom)} V ${px(skirtTop + 4)} Q 84 ${px(skirtTop)} 88 ${px(skirtTop)} H 112 Q 116 ${px(skirtTop)} 116 ${px(skirtTop + 4)} V ${px(skirtBottom)} H 108 V ${px(skirtTop + 6)} H 92 V ${px(skirtBottom)} Z`}
          {...machined}
        />
        <rect x={94} y={px(capBase)} width={12} height={px(skirtTop - capBase + 6)} {...machined} />
        <path data-leg d={legPath} {...machined} />
      </g>
      <path data-spring d={springPath} fill="none" stroke={coil.stroke} strokeWidth={2.4} strokeLinejoin="round" />
      {action === "clicky" && (
        <g data-jacket transform={`translate(0 ${jacketShift})`}>
          <rect x={102} y={px(legTop + 4)} width={10} height={20} rx={1.6} {...shell} />
        </g>
      )}
      <g data-keycap transform={`translate(0 ${shift})`}>
        <path
          d={`M 62 ${px(capBase)} H 138 L 130 ${px(capBase - CAP_BODY)} Q 130 ${px(capBase - CAP_BODY - 3)} 126 ${px(capBase - CAP_BODY - 3)} H 74 Q 70 ${px(capBase - CAP_BODY - 3)} 70 ${px(capBase - CAP_BODY)} Z`}
          {...shell}
        />
        <path
          d={`M 74 ${px(capBase - CAP_BODY + 2)} Q 100 ${px(capBase - CAP_BODY + 9)} 126 ${px(capBase - CAP_BODY + 2)}`}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.6}
          opacity={0.5}
        />
      </g>
    </g>
  )

  const readout = Math.round(pose.fraction * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Key switch, ${action} action, ${readout} percent pressed, contact ${pose.actuated ? "closed" : "open"}, ${viewNames[view] ?? viewNames.profile}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(pose.fraction) : undefined}
      aria-valuetext={interactive ? `${readout} percent pressed` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(pose.fraction + delta)
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
      <g
        data-switch
        data-view={view}
        data-press={px(pose.fraction)}
        transform={`translate(0 ${px(frame.dy)})`}
      >
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.6} opacity={0.7}>
            <path d={`M 24 ${FLOOR + 4} H 176`} strokeDasharray="6 2 2 2" />
            {/* The travel, and where in it the contact closes. */}
            <path d={`M 40 ${px(up(COLLAR_Y) - full)} H 58 M 40 ${px(up(COLLAR_Y))} H 58 M 49 ${px(up(COLLAR_Y) - full)} V ${px(up(COLLAR_Y))}`} />
            <path d={`M 40 ${px(up(COLLAR_Y) - full + trip)} H 58`} strokeDasharray="3 2" stroke={palette.accent} />
            <text x={36} y={px(up(COLLAR_Y) - full / 2)} textAnchor="end" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.grid}>
              {`${px(stroke)}`}
            </text>
          </g>
        )}
        <g transform={aboutPoint("", ORIGIN.x, ORIGIN.y, frame.zoom) || undefined}>
          {showBoard && (
            <g data-board transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
              <path d={extrudedPath(roundedFootprint(46, 46, 2, 3), camera, 0, -3)} {...machined} fillOpacity={0.4} />
            </g>
          )}
          {sectioned ? (
            <g transform={aboutPoint(camera.wall(0, 90), ORIGIN.x, ORIGIN.y) || undefined}>{section}</g>
          ) : (
            <g transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>{solids}</g>
          )}
          {sectioned && (
            <g data-pins transform={`translate(${ORIGIN.x} ${ORIGIN.y})`} opacity={0.9}>
              <path d={extrudedPath(roundedFootprint(3, 3, 1, 2), camera, 0, -9)} {...machined} />
            </g>
          )}
        </g>
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 9} fontSize={5.5}>
          {`${pose.actuated ? "CLOSED" : "OPEN"} / ${readout}%`}
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
 * Press at `clock`, 0..1. `tap` is one whole keystroke a cycle on the shared
 * stroke curve; `flutter` works the band round the actuation point, where the
 * hysteresis is what stops the contact chattering; `hold` presses and stays
 * down for most of the cycle.
 */
export function keySwitchGoal(behavior: KeySwitchBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "flutter") return 0.5 + Math.sin(t * Math.PI * 2 * 3) * 0.12
  if (behavior === "hold") {
    if (t < 0.12) return t / 0.12
    if (t < 0.86) return 1
    return Math.max(0, 1 - (t - 0.86) / 0.14)
  }
  return pressCurve(t)
}

export { KeySwitch }
