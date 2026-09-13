"use client"

/**
 * planetary-gearbox — a reduction stage with its face off.
 *
 * The teeth are geometry, not decoration: the sun drives the planets and the
 * planets drive nothing, because the ring is held — which is what makes the
 * carrier the output and gives the reduction `1 + ring/sun`. Every phase in
 * the drawing comes out of `transmission.ts`, so the sun cannot turn without
 * the planets turning the right way at the right rate, and the ring provably
 * does not move at all.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import type { Vec2 } from "@/lib/robocn/kinematics"
import {
  aboutPoint,
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
import { gearPath, planetaryPose, planetaryTrain } from "@/lib/robocn/transmission"
import { cn } from "@/lib/utils"

const VIEW = 180
/** The output axis, in view units. Drags are measured from here. */
const CENTRE = { x: 90, y: 84 }
/** Pitch radius of the ring, which sets the module every other gear uses. */
const RING_PITCH = 58
const RIM = 68
const CASE = 76
/** Degrees of input shaft per second while slewing to a new position. */
const SLEW_RATE = 280
/** A press that sweeps less than this is a click, not a wind. */
const CLICK_SLOP = 3
/** Drawn face on, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"
/** Depths the face never had to give, toward the reader. */
const CASE_BACK = -18
const OUTPUT_OUT = -38
const INPUT_OUT = 28

const fits: Record<RobotView, number> = { plan: 0.88, front: 1, profile: 0.88, iso: 0.84 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type GearboxBehavior = "run" | "jog" | "static"

export interface PlanetaryGearboxProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled input shaft angle in degrees. Omit to run `behavior`. */
  angle?: number
  /** What the input shaft does when `angle` is not supplied. */
  behavior?: GearboxBehavior
  /** Where the camera stands. One gearbox, four projections. */
  view?: RobotView
  /** Input turns per second running, or half-turn steps per second jogging. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the centre to wind the input, or arrow-key it. */
  interactive?: boolean
  onAngleChange?: (angle: number) => void
  /** Teeth on the sun, clamped to 8–40. */
  sunTeeth?: number
  /** Teeth on each planet. Raised to the nearest count that assembles. */
  planetTeeth?: number
  /** Planets, clamped to 3–5. */
  planets?: number
  showHousing?: boolean
  showRatio?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function PlanetaryGearbox({
  angle,
  behavior = "run",
  view = NATIVE_VIEW,
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onAngleChange,
  sunTeeth = 16,
  planetTeeth = 12,
  planets = 3,
  showHousing = true,
  showRatio = true,
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
}: PlanetaryGearboxProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const train = planetaryTrain(sunTeeth, planetTeeth, planets)
  const controlled = angle !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(angle) ? angle : 0) : held
  const goal = React.useCallback((clock: number) => gearboxGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    // Running has to keep up with its own goal; jogging gets the slew rate,
    // which is what leaves a dwell between steps.
    rate: behavior === "run" ? Math.max(SLEW_RATE, Math.abs(speed) * 720) : SLEW_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const input = Number.isFinite(motion.value) ? motion.value : 0
  const pose = planetaryPose(train, input)

  const apply = React.useCallback(
    (next: number) => {
      setHeld(next)
      onAngleChange?.(wrap360(next))
    },
    [onAngleChange, setHeld],
  )

  // Winding: the pointer's swept angle is added to where the shaft was.
  const press = React.useRef<{ from: number; at: number; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        const dx = unit.x * VIEW - CENTRE.x
        const dy = unit.y * VIEW - CENTRE.y
        if (Math.hypot(dx, dy) < 6) return
        const pointer = (Math.atan2(dx, -dy) * 180) / Math.PI
        if (!press.current) {
          press.current = { from: motion.value, at: pointer, moved: false }
          return
        }
        const swept = wrapSigned(pointer - press.current.at)
        if (Math.abs(swept) > CLICK_SLOP) press.current.moved = true
        if (press.current.moved) apply(press.current.from + swept)
      },
      [apply, motion.value],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
    }, []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // One module for the whole train, so a pitch radius is just its tooth count.
  const pitchModule = RING_PITCH / train.ring
  const sunRadius = pitchModule * train.sun
  const planetRadius = pitchModule * train.planet
  const carrierRadius = sunRadius + planetRadius
  const tooth = { addendum: pitchModule * 0.9, dedendum: pitchModule * 1.1 }
  const readout = px(wrap360(input))
  const output = px(wrap360(pose.carrier))
  const ratio = px(train.ratio)

  // The drawing is the gearbox's own face, so it goes through `wall` where it
  // already stands and comes out untouched straight on. The case barrel and
  // the two shafts are the depth the face could never show.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(), CENTRE.x, CENTRE.y)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point on the face, `depth` units toward the reader. */
  const at = (dx: number, dy: number, depth = 0) => camera.project(-dx, -dy, -depth)
  /** A cylinder on the machine's axis, between two depths. */
  const cyl = (radius: number, from: number, to: number) =>
    capsulePath(at(0, 0, from), at(0, 0, to), radius)
  /** A block through the machine: a footprint on the floor of the drawing. */
  const slab = (dx: number, halfWidth: number, halfDepth: number, top: number, bottom: number) =>
    extrudedPath(
      roundedFootprint(halfWidth, halfDepth, 2, 4).map((p) => ({ x: p.x - dx, y: p.y })),
      camera,
      -top,
      -bottom,
    )

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Planetary gearbox, ${train.planets} planets, ${ratio} to 1 reduction, input ${readout} degrees, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `input ${readout} degrees, output ${output} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 30 : 10, 90)
        if (delta !== 0) apply(motion.value + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 180 180"
      width={width}
      height={width}
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
      <g transform={`translate(90 84) ${fit === 1 ? "" : `scale(${fit})`}`.trimEnd()}>
        {offAxis && (
          <g data-solids>
            <path d={cyl(11, OUTPUT_OUT, CASE_BACK)} {...machined} />
            {showHousing && (
              <>
                <path d={cyl(CASE, CASE_BACK, 0)} {...cast} />
                <path d={slab(0, CASE + 6, 9, CASE - 4, CASE + 4)} {...cast} />
              </>
            )}
            <path d={cyl(RIM, CASE_BACK + 3, 0)} {...machined} />
          </g>
        )}

        <Frame {...frame}>
          <g data-gearbox>
            {showHousing && (
              <g data-housing>
                <circle r={CASE} {...cast} />
                {[0, 60, 120, 180, 240, 300].map((degrees) => (
                  <g key={degrees} transform={`rotate(${degrees})`}>
                    <circle cx={CASE - 5} r={3.6} {...machined} />
                    <circle cx={CASE - 5} r={1.6} fill={palette.dark} />
                  </g>
                ))}
              </g>
            )}
            <g data-ring transform={`rotate(${px(pose.ring)})`}>
              <path
                d={gearPath(train.ring, RING_PITCH, { ...tooth, rim: RIM })}
                fillRule="evenodd"
                {...machined}
              />
            </g>
            <g data-carrier transform={`rotate(${px(pose.carrier)})`}>
              {Array.from({ length: train.planets }, (_, i) => {
                const bearing = (i * 360) / train.planets
                const arm = {
                  x: Math.cos((bearing * Math.PI) / 180) * carrierRadius,
                  y: Math.sin((bearing * Math.PI) / 180) * carrierRadius,
                }
                return <path key={i} d={capsulePath({ x: 0, y: 0 }, arm, 7)} {...cast} />
              })}
              <circle r={sunRadius * 0.55 + 7} {...cast} />
              <path
                d={`M ${px(carrierRadius - 5)} 0 h 10`}
                stroke={palette.accent}
                strokeWidth={2}
                fill="none"
              />
            </g>
            {pose.planets.map((planet, i) => {
              const a = (planet.bearing * Math.PI) / 180
              return (
                <g
                  key={i}
                  data-planet={i}
                  transform={`translate(${px(Math.cos(a) * carrierRadius)} ${px(Math.sin(a) * carrierRadius)})`}
                >
                  <g transform={`rotate(${px(planet.angle)})`}>
                    <path d={gearPath(train.planet, planetRadius, tooth)} {...shell} />
                    <path
                      d={`M 0 0 L ${px(planetRadius - pitchModule)} 0`}
                      stroke={palette.dark}
                      strokeWidth={1}
                    />
                  </g>
                  <circle r={Math.max(2.5, planetRadius * 0.26)} {...machined} />
                </g>
              )
            })}
            <g data-sun transform={`rotate(${px(input)})`}>
              <path d={gearPath(train.sun, sunRadius, tooth)} {...machined} />
              <circle r={sunRadius * 0.5} {...cast} />
              <path
                d={`M ${px(sunRadius * 0.5 - 1)} -2 h 3 v 4 h -3 Z`}
                fill={palette.accent}
              />
            </g>
            {variant === "blueprint" && (
              <g fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.7}>
                <circle r={px(sunRadius)} />
                <circle r={px(carrierRadius)} />
                <circle r={RING_PITCH} />
              </g>
            )}
          </g>
        </Frame>

        {offAxis && (
          <g data-shaft>
            <path d={cyl(10, 0, INPUT_OUT)} {...machined} />
            <path d={cyl(4, INPUT_OUT - 2, INPUT_OUT + 8)} {...cast} />
          </g>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        {showRatio && (
          <text x={90} y={169} fontSize={5}>
            {`${train.sun}:${train.planet}:${train.ring} / ${ratio}:1`}
          </text>
        )}
        {label && (
          <text x={90} y={177} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/**
 * Where the input shaft is aiming at `clock`. `jog` is a deliberate staircase:
 * the slew rate is what draws the move between steps, the way a stepper index
 * actually gets there.
 */
export function gearboxGoal(behavior: GearboxBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "jog") return Math.floor(clock) * 180
  return clock * 360
}

/** Degrees folded into 0..360. Non-finite input parks at zero. */
const wrap360 = (value: number) => (Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0)

/** The same bearing as the shortest signed turn, -180..180. */
const wrapSigned = (value: number) => {
  const wrapped = wrap360(value)
  return wrapped > 180 ? wrapped - 360 : wrapped
}

export { PlanetaryGearbox }
