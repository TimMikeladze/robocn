"use client"

/**
 * turntable-deck — a belt-drive deck, its record, and the arm that tracks it.
 *
 * The spiral gears the arm to the platter: one revolution moves the stylus in
 * by exactly one groove pitch, so progress and platter angle are one number at
 * two scales rather than two animations that drift apart. The arm angle is then
 * solved from the groove radius — a triangle with two fixed sides — and the
 * tracking error falls out of it and goes in the readout.
 *
 * Grab the platter and it scrubs: the stylus walks back out up the spiral and
 * the error changes with it.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  grooveProgress,
  groovePose,
  grooveSpiralPath,
  tonearmPose,
  type TonearmGeometry,
} from "@/lib/robocn/sound"
import {
  capsulePath,
  circleFootprint,
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

const VIEW_W = 200
const VIEW_H = 190

/** World units: x starboard, y up, z toward the back. The front edge is −z. */
const SPINDLE = { x: -20, z: 0 }
const PLINTH = { x0: -76, x1: 60, z0: -56, z1: 64 }
const PLATTER_R = 52
const RECORD_R = 48
const GROOVE_OUTER = 46
const GROOVE_INNER = 19
const LABEL_R = 15.5
/** Where the arm is bolted: the bearing of the pivot from the spindle. */
const ARM_BEARING = 40
/** A nine-inch arm, scaled by the record: mounting, effective length, offset. */
const ARM: TonearmGeometry = { mounting: 69.4, effective: 75.4, offset: 24.2 }
/** Where the arm parks when it is on its rest, as a radius from the spindle. */
const REST_RADIUS = 60

const FLOOR = 0
const PLINTH_TOP = 14
const PLATTER_TOP = 20
const RECORD_TOP = 20.8
const ARM_Y = 27
/** How far the cue lever picks the arm up off the record. */
const CUE_LIFT = 3.4

/** Revolutions per second the platter slews at while easing back into a drag. */
const SLEW_RATE = 7
/** The deck is drawn from straight above; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "plan"

const rpms = [33, 45, 78] as const
export type DeckRpm = (typeof rpms)[number]

const fits: Record<RobotView, number> = { plan: 1, front: 0.95, profile: 0.95, iso: 0.92 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type TurntableBehavior = "play" | "scratch" | "static"
/** Where the arm is: in the groove, picked up over it, or on its rest. */
export type TurntableCue = "play" | "lift" | "rest"

export interface TurntableDeckProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled position through the side, 0 lead-in to 1 run-out. */
  progress?: number
  /** What the deck does when `progress` is not supplied. */
  behavior?: TurntableBehavior
  /** Where the arm is standing. `rest` parks it off the record entirely. */
  cue?: TurntableCue
  /** The speed selector. Scales the platter against the 33 rpm default. */
  rpm?: DeckRpm
  /**
   * Revolutions of the platter in a whole side. A real one is several hundred;
   * the default is what makes the arm's walk watchable. The gearing is exact
   * for whatever you set.
   */
  turnsPerSide?: number
  /** Where the camera stands. One deck, four projections. */
  view?: RobotView
  /** Platter revolutions per second at 33 rpm. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the platter to scrub, or arrow-key it a revolution at a time. */
  interactive?: boolean
  onProgressChange?: (progress: number) => void
  showGrooves?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function TurntableDeck({
  progress,
  behavior = "play",
  cue = "play",
  rpm = 33,
  turnsPerSide = 40,
  view = NATIVE_VIEW,
  speed = 0.55,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onProgressChange,
  showGrooves = true,
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
}: TurntableDeckProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const sideTurns = Number.isFinite(turnsPerSide) ? clamp(Math.round(turnsPerSide), 2, 400) : 40
  const selector: DeckRpm = rpms.includes(rpm) ? rpm : 33
  const groove = {
    outer: GROOVE_OUTER,
    inner: GROOVE_INNER,
    pitch: (GROOVE_OUTER - GROOVE_INNER) / sideTurns,
  }
  const controlled = progress !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  // The scalar is platter revolutions; progress is the same number, geared.
  const hold = controlled
    ? clamp(Number.isFinite(progress) ? (progress as number) : 0, 0, 1) * sideTurns
    : held
  const goal = React.useCallback((clock: number) => deckGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed: speed * (selector / rpms[0]),
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const turns = Number.isFinite(motion.value) ? motion.value : 0
  const spin = turns * 360
  // Controlled, the progress given is the position; running, it is the platter's
  // revolutions folded back into one side, because the spiral repeats.
  const at = controlled
    ? clamp(Number.isFinite(progress) ? (progress as number) : 0, 0, 1)
    : (((turns % sideTurns) + sideTurns) % sideTurns) / sideTurns
  const side = groovePose(at, groove)

  // On its rest the arm is parked outside the record; otherwise it is wherever
  // the groove has carried it.
  const parked = cue === "rest"
  const arm = tonearmPose(parked ? REST_RADIUS : side.radius, ARM)
  const armY = ARM_Y + (cue === "play" ? 0 : CUE_LIFT)
  const reading = Math.round(at * 100)

  const live = React.useRef({ centre: { x: 0, y: 0 }, turns })
  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onProgressChange?.(clamp(next / sideTurns, 0, 1))
    },
    [onProgressChange, sideTurns],
  )
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const { centre, turns: now } = live.current
        const dx = unit.x * VIEW_W - centre.x
        const dy = unit.y * VIEW_H - centre.y
        if (Math.hypot(dx, dy) < 5) return
        const pointer = toDegrees(Math.atan2(dy, dx))
        if (!press.current) {
          press.current = { from: now, at: pointer }
          return
        }
        let swept = pointer - press.current.at
        swept -= 360 * Math.round(swept / 360)
        apply(press.current.from + swept / 360)
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const centre = {
    x: (PLINTH.x0 + PLINTH.x1) / 2,
    z: (PLINTH.z0 + PLINTH.z1) / 2,
  }
  const origin = { x: VIEW_W / 2 - centre.x * fit, y: VIEW_H / 2 - 6 - centre.z * fit }
  React.useEffect(() => {
    const projected = camera.project(SPINDLE.x, PLATTER_TOP, SPINDLE.z)
    live.current = {
      centre: { x: origin.x + projected.x * fit, y: origin.y + projected.y * fit },
      turns,
    }
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const vinyl = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.7)

  const solid = (footprint: Vec2[], top: number, bottom: number) =>
    extrudedPath(footprint, camera, top, bottom)
  const shift = (footprint: Vec2[], x: number, z: number) =>
    footprint.map((point) => ({ x: point.x + x, y: point.y + z }))

  const plinthFoot = shift(
    roundedFootprint((PLINTH.x1 - PLINTH.x0) / 2, (PLINTH.z1 - PLINTH.z0) / 2, 9, 5),
    centre.x,
    centre.z,
  )
  const feet: Vec2[] = [
    { x: PLINTH.x0 + 12, y: PLINTH.z0 + 12 },
    { x: PLINTH.x1 - 12, y: PLINTH.z0 + 12 },
    { x: PLINTH.x0 + 12, y: PLINTH.z1 - 12 },
    { x: PLINTH.x1 - 12, y: PLINTH.z1 - 12 },
  ]
  const bearing = toRadians(ARM_BEARING)
  const pivotWorld = {
    x: SPINDLE.x + Math.cos(bearing) * ARM.mounting,
    z: SPINDLE.z + Math.sin(bearing) * ARM.mounting,
  }
  const motorWorld = { x: PLINTH.x0 + 17, z: PLINTH.z1 - 19 }
  /** A point in the arm's own frame, turned onto the plinth. */
  const onDeck = (point: Vec2) => ({
    x: SPINDLE.x + point.x * Math.cos(bearing) - point.y * Math.sin(bearing),
    z: SPINDLE.z + point.x * Math.sin(bearing) + point.y * Math.cos(bearing),
  })

  /** The arm is drawn in the solver's own frame and turned onto the plinth. */
  const armFrame = `${camera.plane(armY)} translate(${px(SPINDLE.x)} ${px(SPINDLE.z)}) rotate(${ARM_BEARING})`
  const counterweight = {
    x: arm.pivot.x - (arm.stylus.x - arm.pivot.x) * 0.22,
    y: arm.pivot.y - (arm.stylus.y - arm.pivot.y) * 0.22,
  }
  const armAngle = toDegrees(Math.atan2(arm.stylus.y - arm.pivot.y, arm.stylus.x - arm.pivot.x))
  // The cartridge is twisted out of the arm's axis by the offset angle, so the
  // tube ends at the headshell collar and the stylus sits forward of it — which
  // is what puts the stylus exactly on the groove the solver asked for.
  const cartridge = toRadians(armAngle + ARM.offset)
  const collar = {
    x: arm.stylus.x - Math.cos(cartridge) * 10,
    y: arm.stylus.y - Math.sin(cartridge) * 10,
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Turntable deck, ${selector} rpm, ${reading} percent through the side, arm ${cue === "play" ? "in the groove" : cue === "lift" ? "cued up" : "on its rest"}, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? reading : undefined}
      aria-valuetext={interactive ? `${reading} percent through the side` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 5 : 1, sideTurns / 8)
        if (delta !== 0) apply(turns + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(sideTurns)
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
          <path d={`M 10 ${VIEW_H / 2 - 6} H ${VIEW_W - 10}`} strokeDasharray="2 3" />
          <path d={`M ${VIEW_W / 2} 10 V ${VIEW_H - 26}`} strokeDasharray="2 3" />
        </g>
      )}

      <g data-view={view} transform={`translate(${px(origin.x)} ${px(origin.y)}) scale(${px(fit)})`}>
        {offAxis && (
          <g data-solids>
            {feet.map((foot) => (
              <path key={`${foot.x}-${foot.y}`} d={solid(circleFootprint(foot.x, foot.y, 5, 10), FLOOR, FLOOR - 4)} {...cast} />
            ))}
            <path data-plinth d={solid(plinthFoot, PLINTH_TOP, FLOOR)} {...shell} />
            <path d={solid(circleFootprint(motorWorld.x, motorWorld.z, 9, 12), PLINTH_TOP + 4, PLINTH_TOP)} {...machined} />
            <path d={solid(circleFootprint(SPINDLE.x, SPINDLE.z, PLATTER_R, 24), PLATTER_TOP, PLINTH_TOP)} {...machined} />
            <path d={solid(circleFootprint(pivotWorld.x, pivotWorld.z, 6.5, 12), armY + 1, PLINTH_TOP)} {...cast} />
            <path d={solid(circleFootprint(SPINDLE.x, SPINDLE.z, 1.6, 8), RECORD_TOP + 6, PLATTER_TOP)} {...machined} />
            {/* The counterweight is a drum on the end of the tube, not a disc. */}
            <path
              d={solid(
                circleFootprint(onDeck(counterweight).x, onDeck(counterweight).z, 5, 10),
                armY + 4,
                armY - 4,
              )}
              {...cast}
            />
          </g>
        )}

        <g data-deck transform={camera.plane(PLINTH_TOP)}>
          <rect
            x={px(PLINTH.x0)}
            y={px(PLINTH.z0)}
            width={px(PLINTH.x1 - PLINTH.x0)}
            height={px(PLINTH.z1 - PLINTH.z0)}
            rx={9}
            {...shell}
          />
          <rect
            x={px(PLINTH.x0 + 5)}
            y={px(PLINTH.z0 + 5)}
            width={px(PLINTH.x1 - PLINTH.x0 - 10)}
            height={px(PLINTH.z1 - PLINTH.z0 - 10)}
            rx={6}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.5}
            opacity={0.5}
          />

          <g data-belt>
            <rect x={px(motorWorld.x - 11)} y={px(motorWorld.z - 11)} width={22} height={22} rx={4} {...cast} />
            <circle data-motor cx={px(motorWorld.x)} cy={px(motorWorld.z)} r={6} {...machined} />
            <circle cx={px(motorWorld.x)} cy={px(motorWorld.z)} r={2} fill={palette.dark} />
            {[-1, 1].map((side) => {
              // The belt runs to the sub-platter: two straight tangents.
              const from = { x: motorWorld.x, z: motorWorld.z }
              const to = { x: SPINDLE.x, z: SPINDLE.z }
              const dx = to.x - from.x
              const dz = to.z - from.z
              const len = Math.hypot(dx, dz) || 1
              const nx = (-dz / len) * side
              const nz = (dx / len) * side
              return (
                <path
                  key={side}
                  d={`M ${px(from.x + nx * 6)} ${px(from.z + nz * 6)} L ${px(to.x + nx * 24)} ${px(to.z + nz * 24)}`}
                  stroke={palette.dark}
                  strokeWidth={1.4}
                  fill="none"
                  opacity={0.75}
                />
              )
            })}
          </g>

          <g data-selector transform={`translate(${px(PLINTH.x1 - 42)} ${px(PLINTH.z0 + 16)})`}>
            {rpms.map((value, index) => (
              <g key={value} transform={`translate(0 ${px(index * 13)})`}>
                <rect x={-9} y={-5} width={26} height={10} rx={2.5} {...cast} />
                <circle
                  cx={-4}
                  cy={0}
                  r={2.4}
                  fill={value === selector ? palette.accent : palette.metal}
                  opacity={value === selector ? 1 : 0.45}
                />
                <text
                  x={4}
                  y={2}
                  fontFamily="ui-monospace, monospace"
                  fontSize={5}
                  fill={palette.foreground}
                  opacity={0.85}
                >
                  {value}
                </text>
              </g>
            ))}
          </g>

          <g data-pitch transform={`translate(${px(PLINTH.x0 + 13)} ${px(PLINTH.z0 + 25)})`}>
            <rect x={-5} y={-17} width={10} height={34} rx={3} {...cast} />
            <path d="M 0 -13 V 13" stroke={palette.metal} strokeWidth={0.6} />
            <rect x={-7} y={-2.5} width={14} height={5} rx={1.5} {...machined} />
          </g>
        </g>

        <g
          data-platter
          data-spin={px(spin)}
          transform={`${camera.plane(PLATTER_TOP)} translate(${px(SPINDLE.x)} ${px(SPINDLE.z)}) rotate(${px(spin)})`}
        >
          <circle r={PLATTER_R} {...machined} />
          {/* The strobe ring: what the rotation is actually read off. */}
          {Array.from({ length: 48 }, (_, index) => (
            <rect
              key={index}
              x={-0.7}
              y={-PLATTER_R + 1.2}
              width={1.4}
              height={3}
              rx={0.5}
              fill={palette.dark}
              opacity={0.55}
              transform={`rotate(${px((index * 360) / 48)})`}
            />
          ))}
          <g data-record>
            <circle r={RECORD_R} {...vinyl} />
            {showGrooves && (
              <path
                d={grooveSpiralPath(groove, 16, 28)}
                fill="none"
                stroke={palette.metal}
                strokeWidth={0.3}
                opacity={0.35}
              />
            )}
            <circle r={GROOVE_OUTER} fill="none" stroke={palette.metal} strokeWidth={0.4} opacity={0.3} />
            <circle r={LABEL_R} {...shell} />
            <circle r={LABEL_R - 4} fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.5} />
            <circle r={LABEL_R - 8} fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.5} />
            <rect x={-6} y={-1} width={12} height={2} rx={1} fill={palette.dark} opacity={0.45} />
          </g>
          <circle r={1.6} {...cast} />
        </g>

        <g data-tonearm data-angle={px(arm.angle)} transform={armFrame}>
          <circle data-rest cx={px(REST_POST.x)} cy={px(REST_POST.y)} r={4.5} {...cast} />
          <path d={capsulePath(counterweight, collar, 1.5)} {...machined} />
          <circle cx={px(counterweight.x)} cy={px(counterweight.y)} r={5.5} {...cast} />
          <circle cx={px(arm.pivot.x)} cy={px(arm.pivot.y)} r={6.5} {...cast} />
          <circle cx={px(arm.pivot.x)} cy={px(arm.pivot.y)} r={2.6} {...machined} />
          <g data-cue transform={`translate(${px(arm.pivot.x - 9)} ${px(arm.pivot.y + 7)})`}>
            <rect x={-2} y={-4} width={4} height={8} rx={1.5} {...cast} />
            <rect
              x={-1.2}
              y={cue === "play" ? 0 : -5}
              width={2.4}
              height={5}
              rx={1}
              fill={cue === "play" ? palette.metal : palette.accent}
            />
          </g>
          <g
            data-headshell
            transform={`translate(${px(arm.stylus.x)} ${px(arm.stylus.y)}) rotate(${px(armAngle + ARM.offset)})`}
          >
            <rect x={-12} y={-3.4} width={12} height={6.8} rx={1.6} {...shell} />
            <rect x={-9} y={-2.4} width={7} height={4.8} rx={1} {...cast} />
            <path
              data-stylus
              d="M -2 0 L 0 0"
              stroke={cue === "play" ? palette.accent : palette.metal}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_W / 2} y={VIEW_H - 10} fontSize={5}>
          {`${selector} RPM · ${reading}% · ERR ${px(arm.trackingError)}°`}
        </text>
        {label && (
          <text x={VIEW_W / 2} y={VIEW_H - 3} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** The arm rest, in the solver's frame: where the arm parks, off the record. */
const REST_POST = tonearmPose(REST_RADIUS, ARM).stylus

/**
 * Platter revolutions at `clock`. `play` runs the side through; `scratch` rocks
 * the platter back and forth over a slow crawl forward, which is what carries
 * the stylus back up the spiral.
 */
export function deckGoal(behavior: TurntableBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "scratch") return clock * 0.3 + Math.sin(clock * Math.PI * 2) * 1.6
  return clock
}

/** Where the stylus is standing, as a radius, at a given progress through a side. */
export function deckRadius(progress: number, turnsPerSide = 40) {
  const turns = Number.isFinite(turnsPerSide) ? clamp(Math.round(turnsPerSide), 2, 400) : 40
  return groovePose(progress, {
    outer: GROOVE_OUTER,
    inner: GROOVE_INNER,
    pitch: (GROOVE_OUTER - GROOVE_INNER) / turns,
  }).radius
}

/** The inverse, for a caller that knows where the stylus is standing. */
export function deckProgress(radius: number) {
  return grooveProgress(radius, { outer: GROOVE_OUTER, inner: GROOVE_INNER, pitch: 1 })
}

export { TurntableDeck }
