"use client"

/**
 * gramophone-horn — the acoustic deck, a century before the electric one.
 *
 * Everything here comes off one number: how wound the mainspring is. The
 * governor holds the platter at its rate while the spring has torque to spare
 * and lets it sag once it has not, the flyweights stand out with the square of
 * the speed, and winding is the crank — turns of the handle are the wind.
 *
 * The horn is an exponential flare, modelled as a stack of rings on one axis
 * and projected, so it foreshortens honestly instead of being drawn per angle.
 * The arm runs on the same solver the electric deck uses, which is how its
 * tracking error can be reported rather than quietly ignored: an acoustic arm
 * has no alignment geometry at all and the number says so.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toDegrees, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  governorPose,
  groovePose,
  grooveSpiralPath,
  hornProfile,
  tonearmPose,
  type TonearmGeometry,
} from "@/lib/robocn/sound"
import {
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  slabPath,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_W = 140
const VIEW_H = 170

/** World units: x starboard, y up, z toward the back. The horn faces −z. */
const CASE_HALF = 32
const CASE_TOP = 42
const PLATTER_TOP = 48
const RECORD_TOP = 48.8
const PLATTER_R = 30
const RECORD_R = 28
const GROOVE_OUTER = 26
const GROOVE_INNER = 11

/** A straight acoustic arm: pivoted on the back edge, barely any offset. */
const ARM: TonearmGeometry = { mounting: 30, effective: 36, offset: 14 }
const ARM_BEARING = 90
const ELBOW = { x: 0, y: 58, z: 30 }
/** How far the horn rises out of the elbow. */
const HORN_PITCH = 34
const HORN = { throat: 4.4, mouth: 26, length: 64 }
/** Turns of the handle for a full wind. */
const CRANK_TURNS = 3
const CRANK = { x: CASE_HALF, y: 20, z: 10 }
/** Revolutions of the platter in one cycle of the spring. */
const PLATTER_TURNS = 13
/** Wind per second while easing back after the crank is let go. */
const SLEW_RATE = 1.6
const NATIVE_VIEW: RobotView = "profile"

const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.88 }
const frames: Record<RobotView, Vec2> = {
  plan: { x: 70, y: 92 },
  front: { x: 70, y: 128 },
  profile: { x: 66, y: 128 },
  iso: { x: 66, y: 124 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type GramophoneBehavior = "play" | "crank" | "static"

export interface GramophoneHornProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled wind, 0 run right down to 1 fully wound. */
  wind?: number
  /** What the spring does when `wind` is not supplied. */
  behavior?: GramophoneBehavior
  /** Where the soundbox is standing, 0 lead-in to 1 run-out. */
  progress?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Cycles of the spring per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the crank to wind it, or arrow-key it. */
  interactive?: boolean
  onWindChange?: (wind: number) => void
  /** Show the mechanism through the case's side panel. */
  showMechanism?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GramophoneHorn({
  wind,
  behavior = "play",
  progress = 0.3,
  view = NATIVE_VIEW,
  speed = 0.1,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onWindChange,
  showMechanism = true,
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
}: GramophoneHornProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = wind !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? clamp(Number.isFinite(wind) ? (wind as number) : 0, 0, 1) : held
  const goal = React.useCallback((clock: number) => gramophoneGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const wound = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)
  const governor = governorPose(wound)
  // The platter's angle is the clock times the regulated speed — what you see
  // when the spring sags — not an integral of it. There is no spring model.
  const spin = motion.clock * 360 * PLATTER_TURNS * governor.speed
  const crankAngle = wound * 360 * CRANK_TURNS

  const side = groovePose(progress, {
    outer: GROOVE_OUTER,
    inner: GROOVE_INNER,
    pitch: (GROOVE_OUTER - GROOVE_INNER) / 40,
  })
  const arm = tonearmPose(side.radius, ARM)

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const origin = frames[view] ?? frames.profile

  const live = React.useRef({ centre: { x: 0, y: 0 }, wound })
  React.useEffect(() => {
    const projected = camera.project(CRANK.x + 8, CRANK.y, CRANK.z)
    live.current = {
      centre: { x: origin.x + projected.x * fit, y: origin.y + projected.y * fit },
      wound,
    }
  })
  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onWindChange?.(bounded)
    },
    [onWindChange],
  )
  const press = React.useRef<{ from: number; at: number } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const { centre, wound: now } = live.current
        const pointer = toDegrees(
          Math.atan2(unit.y * VIEW_H - centre.y, unit.x * VIEW_W - centre.x),
        )
        if (!press.current) {
          press.current = { from: now, at: pointer }
          return
        }
        let swept = pointer - press.current.at
        swept -= 360 * Math.round(swept / 360)
        apply(press.current.from + swept / (360 * CRANK_TURNS))
        press.current = { from: press.current.from + swept / (360 * CRANK_TURNS), at: pointer }
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setHeld(null)
    }, []),
  })

  const shell = robotSurface("shell", variant, palette)
  const flare = robotSurface("shell", variant, palette, 0.5)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const vinyl = variant === "solid" ? { fill: palette.dark } : robotSurface("dark", variant, palette, 0.7)
  const mouthFill = variant === "solid" ? { fill: palette.dark, opacity: 0.85 } : cast

  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)
  const line = (a: Vec3, b: Vec3) => {
    const from = project(a)
    const to = project(b)
    return `M ${px(from.x)} ${px(from.y)} L ${px(to.x)} ${px(to.y)}`
  }

  // The arm sweeps in the horizontal plane and descends to the record, so its
  // two ends are world points and the tube between them is a taper.
  const onDeck = (point: Vec2, y: number): Vec3 => {
    const turn = toRadians(ARM_BEARING)
    return {
      x: point.x * Math.cos(turn) - point.y * Math.sin(turn),
      y,
      z: point.x * Math.sin(turn) + point.y * Math.cos(turn),
    }
  }
  const elbow = onDeck(arm.pivot, ELBOW.y)
  const soundbox = onDeck(arm.stylus, RECORD_TOP + 6)
  const taper = taperPath(camera, elbow, soundbox, 5.4, 2.8)

  const sections = hornProfile(HORN, 13)
  const axis = { x: 0, y: Math.sin(toRadians(HORN_PITCH)), z: -Math.cos(toRadians(HORN_PITCH)) }
  const rings = sections.map((section) =>
    hornRing(
      {
        x: elbow.x + axis.x * section.along,
        y: elbow.y + axis.y * section.along,
        z: elbow.z + axis.z * section.along,
      },
      section.radius,
      axis,
    ),
  )
  const mouth = rings.at(-1)!

  const shaftOut = { x: CRANK.x + 9, y: CRANK.y, z: CRANK.z }
  const crankTurn = toRadians(crankAngle)
  const web = {
    x: shaftOut.x,
    y: CRANK.y + Math.cos(crankTurn) * 9,
    z: CRANK.z + Math.sin(crankTurn) * 9,
  }
  const knob = { x: web.x + 5, y: web.y, z: web.z }
  const reading = Math.round(wound * 100)
  const rpm = Math.round(78 * governor.speed)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Gramophone, ${reading} percent wound, ${governor.stalled ? "run down" : `${rpm} rpm`}, tracking error ${Math.round(arm.trackingError)} degrees, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? reading : undefined}
      aria-valuetext={interactive ? `${reading} percent wound` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply(wound + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
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
          <path d={`M 8 ${px(origin.y)} H ${VIEW_W - 8}`} strokeDasharray="2 3" />
          <path d={`M ${px(origin.x)} 8 V ${VIEW_H - 22}`} strokeDasharray="2 3" />
        </g>
      )}

      <g data-view={view} transform={`translate(${px(origin.x)} ${px(origin.y)}) scale(${px(fit)})`}>
        <g data-case>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <path
                key={`${sx}-${sz}`}
                d={extrudedPath(
                  circleFootprint(sx * (CASE_HALF - 7), sz * (CASE_HALF - 7), 4, 8),
                  camera,
                  0,
                  -5,
                )}
                {...cast}
              />
            )),
          )}
          <path
            d={extrudedPath(roundedFootprint(CASE_HALF, CASE_HALF, 5, 4), camera, CASE_TOP, 0)}
            {...shell}
          />
          {showMechanism && (
            <g data-mechanism transform={camera.wall(CASE_HALF + 0.3, 90)}>
              <rect x={-24} y={-40} width={46} height={30} rx={3} {...cast} />
              <g data-spring transform="translate(10 -25)">
                <circle r={10} {...machined} />
                <path
                  d={spiralPath(9, 1.8 + wound * 3.4)}
                  fill="none"
                  stroke={palette.dark}
                  strokeWidth={0.8}
                  opacity={0.8}
                />
              </g>
              <g data-governor data-spread={px(governor.spread)} transform="translate(-13 -22)">
                <path d="M 0 12 V -10" stroke={palette.metal} strokeWidth={1.6} />
                {[-1, 1].map((arm2) => {
                  const swing = toRadians(governor.angle) * arm2
                  const tip = { x: Math.sin(swing) * 9, y: -10 + Math.cos(swing) * 9 }
                  return (
                    <g key={arm2} data-weight={arm2 > 0 ? "right" : "left"}>
                      <path
                        d={`M 0 -10 L ${px(tip.x)} ${px(tip.y)}`}
                        stroke={palette.metal}
                        strokeWidth={1.1}
                      />
                      <circle cx={px(tip.x)} cy={px(tip.y)} r={2.4} {...cast} />
                    </g>
                  )
                })}
                <rect x={-4} y={10} width={8} height={3} rx={1} {...machined} />
              </g>
            </g>
          )}
        </g>

        <g data-crank data-angle={px(crankAngle)}>
          <path d={line({ x: CRANK.x - 2, y: CRANK.y, z: CRANK.z }, shaftOut)} stroke={palette.metal} strokeWidth={3} strokeLinecap="round" />
          <path d={line(shaftOut, web)} stroke={palette.metal} strokeWidth={2.4} strokeLinecap="round" />
          <path d={line(web, knob)} stroke={palette.dark} strokeWidth={3.4} strokeLinecap="round" />
        </g>

        <path
          d={extrudedPath(circleFootprint(0, 0, PLATTER_R, 20), camera, PLATTER_TOP, CASE_TOP)}
          {...machined}
        />
        <g
          data-platter
          data-spin={px(spin)}
          transform={`${camera.plane(RECORD_TOP)} rotate(${px(spin)})`}
        >
          <g data-record>
            <circle r={RECORD_R} {...vinyl} />
            <path
              d={grooveSpiralPath({ outer: GROOVE_OUTER, inner: GROOVE_INNER, pitch: 1 }, 11, 24)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={0.3}
              opacity={0.32}
            />
            <circle r={9} {...shell} />
            <circle r={5} fill="none" stroke={palette.dark} strokeWidth={0.5} opacity={0.5} />
          </g>
          <circle r={1.3} {...cast} />
        </g>

        <g data-tonearm data-angle={px(arm.angle)}>
          <path d={taper} {...machined} />
          <circle cx={px(project(elbow).x)} cy={px(project(elbow).y)} r={5} {...cast} />
          <g data-soundbox transform={`translate(${px(project(soundbox).x)} ${px(project(soundbox).y)})`}>
            <circle r={6.6} {...cast} />
            <circle r={4} {...machined} />
            <circle r={1.4} fill={palette.dark} />
            <path d="M 0 4 L 0 8" stroke={palette.accent} strokeWidth={1.6} strokeLinecap="round" />
          </g>
        </g>

        <g data-horn data-sections={rings.length}>
          {rings.slice(0, -1).map((ring, index) => (
            <path key={index} d={slabPath([...ring, ...rings[index + 1]!], camera)} {...flare} />
          ))}
          <path d={slabPath(mouth, camera)} {...mouthFill} />
          <path
            d={slabPath(
              mouth.map((point) => ({
                x: point.x * 0.88,
                y: elbow.y + (point.y - elbow.y) * 0.88,
                z: elbow.z + (point.z - elbow.z) * 0.88,
              })),
              camera,
            )}
            fill="none"
            stroke={palette.metal}
            strokeWidth={0.6}
            opacity={0.5}
          />
        </g>
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_W / 2} y={VIEW_H - 10} fontSize={5}>
          {`WIND ${reading}% · ${governor.stalled ? "RUN DOWN" : `${rpm} RPM`} · ERR ${Math.round(arm.trackingError)}°`}
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

/** A ring of points round `centre`, square to `axis`: one section of the horn. */
function hornRing(centre: Vec3, radius: number, axis: Vec3, steps = 16): Vec3[] {
  // The axis lies in the y–z plane, so x is already perpendicular to it.
  const right = { x: 1, y: 0, z: 0 }
  const up = { x: 0, y: -axis.z, z: axis.y }
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const a = Math.cos(angle) * radius
    const b = Math.sin(angle) * radius
    return {
      x: centre.x + right.x * a + up.x * b,
      y: centre.y + right.y * a + up.y * b,
      z: centre.z + right.z * a + up.z * b,
    }
  })
}

/** A tube that narrows from one end to the other, projected. */
function taperPath(camera: RobotCamera, from: Vec3, to: Vec3, wide: number, narrow: number) {
  const a = camera.project(from.x, from.y, from.z)
  const b = camera.project(to.x, to.y, to.z)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const span = Math.hypot(dx, dy) || 1
  const nx = -dy / span
  const ny = dx / span
  return [
    `M ${px(a.x + nx * wide)} ${px(a.y + ny * wide)}`,
    `L ${px(b.x + nx * narrow)} ${px(b.y + ny * narrow)}`,
    `L ${px(b.x - nx * narrow)} ${px(b.y - ny * narrow)}`,
    `L ${px(a.x - nx * wide)} ${px(a.y - ny * wide)}`,
    "Z",
  ].join(" ")
}

/** The mainspring's coil, as a drawing: more turns the more it is wound. */
function spiralPath(radius: number, turns: number, steps = 96) {
  const laps = Math.max(0.5, turns)
  const total = Math.max(8, Math.round(steps))
  const points: string[] = []
  for (let step = 0; step <= total; step += 1) {
    const at = step / total
    const r = radius * (0.28 + 0.72 * at)
    const angle = at * laps * Math.PI * 2
    points.push(`${step ? "L" : "M"} ${px(Math.cos(angle) * r)} ${px(Math.sin(angle) * r)}`)
  }
  return points.join(" ")
}

/**
 * How wound the spring is at `clock`. `play` runs it down over three quarters
 * of the cycle and winds it back up in the last quarter — a whole mechanical
 * cycle, so it repeats. `crank` walks it up and back down the range a hand on
 * the handle covers. `static` parks it wound and still.
 */
export function gramophoneGoal(behavior: GramophoneBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 1
  const at = ((clock % 1) + 1) % 1
  if (behavior === "crank") return at < 0.5 ? at * 2 : 2 - at * 2
  return at < 0.75 ? 1 - at / 0.75 : (at - 0.75) / 0.25
}

export { GramophoneHorn }
