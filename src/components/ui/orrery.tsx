"use client"

/**
 * orrery — the machine that carries the bodies, and the one that makes
 * Kepler's laws visible rather than merely correct.
 *
 * Each body is on a radial arm from the hub, and the arm's length *is* the
 * orbital radius. That is the whole trick: on an ellipse the radius changes, so
 * the arm really does telescope in and out over a year, and the body runs at
 * periapsis and loiters at apoapsis because `orbitalState` solves Kepler's
 * equation rather than sliding an angle round at a constant rate. The orbit
 * paths are drawn with the hub at a *focus*, which is where the star is, not
 * at the centre of the ellipse.
 *
 * The periods are not free either: they come from the third law,
 * `T ∝ a^{3/2}`, so an outer body is slow because it is far out.
 *
 * Drawn from above, where the ellipses read true. There is no gravity here: the
 * bodies do not pull on each other and the elements are the caller's.
 *
 * Design note: docs/celestial-bodies.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { orbitPath, orbitalState, type OrbitalElements } from "@/lib/robocn/celestial"
import {
  aboutPoint,
  capsulePath,
  circleFootprint,
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_SIZE = 200
const ORIGIN = { x: 100, y: 100 }
/** Read from above, where an ellipse is an ellipse. */
const NATIVE_VIEW: RobotView = "plan"

/** The pillar, below the orbital plane. */
const BASE_RADIUS = 15
const BASE_HEIGHT = 9
const COLUMN_RADIUS = 4.4
const COLUMN_DROP = 42
const HUB_RADIUS = 8
/** The first orbit, and the step out to each one after it. */
const FIRST_ORBIT = 22
const ORBIT_STEP = 13.5
/** The base period, in years, for a body at `FIRST_ORBIT`. */
const BASE_PERIOD = 1
/** Years travelled per second while it returns to its behaviour. */
const EPOCH_RATE = 3.2
/** Full turns of the drag across the frame. */
const DRAG_YEARS = 24

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const framing: Record<RobotView, { zoom: number; rise: number }> = {
  plan: { zoom: 1, rise: 0 },
  front: { zoom: 0.94, rise: 12 },
  profile: { zoom: 0.94, rise: 12 },
  iso: { zoom: 0.94, rise: 8 },
}

export type OrreryBehavior = "run" | "jog" | "static"

export interface OrreryProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. Plan is where the ellipses read true. */
  view?: RobotView
  /** Controlled epoch, in years. Stops the loop. */
  epoch?: number
  /** What the train does when `epoch` is not supplied. */
  behavior?: OrreryBehavior
  /** Cycles per second: one turn of the innermost body. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag round the hub to wind time on, or arrow-key it. */
  interactive?: boolean
  onEpochChange?: (epoch: number) => void
  /** Bodies on the train. Clamped 1–6. */
  bodies?: number
  /** How eccentric the orbits are, 0 circular to 1 as far as the set goes. */
  eccentricity?: number
  /** Degrees the outermost orbit is tilted out of the plane. */
  inclination?: number
  /** Draw the orbit paths. */
  showOrbits?: boolean
  /** Draw the hub train that the arms are geared to. */
  showGears?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function Orrery({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  epoch,
  behavior = "run",
  speed = 0.14,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onEpochChange,
  bodies = 4,
  eccentricity = 0.45,
  inclination = 7,
  showOrbits = true,
  showGears = true,
  signal = "ready",
  label,
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
}: OrreryProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled = epoch !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const hold = controlled ? (Number.isFinite(epoch) ? epoch : 0) : held
  const goal = React.useCallback((clock: number) => orreryGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: EPOCH_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Number.isFinite(next) ? next : 0
      setHeld(bounded)
      onEpochChange?.(bounded)
    },
    [onEpochChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply((unit.x - 0.5) * DRAG_YEARS), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const time = Number.isFinite(motion.value) ? motion.value : 0
  const count = Math.round(clamp(Number.isFinite(bodies) ? bodies : 4, 1, 6))
  const spread = clamp(Number.isFinite(eccentricity) ? eccentricity : 0, 0, 1)
  const tilt = clamp(Number.isFinite(inclination) ? inclination : 0, -60, 60)

  const camera = robotCamera(view)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const at = (point: Vec3): Vec2 => {
    const screen = camera.project(point.x, point.y, point.z)
    return { x: ORIGIN.x + screen.x, y: ORIGIN.y + screen.y }
  }
  const hub = at({ x: 0, y: 0, z: 0 })

  const train = Array.from({ length: count }, (_, index) => {
    const semiMajor = FIRST_ORBIT + index * ORBIT_STEP
    const elements: OrbitalElements = {
      semiMajor,
      // Every orbit a different shape, all scaled by the one knob.
      eccentricity: spread * (0.12 + 0.62 * (((index * 5) % 7) / 7)),
      // The outermost is tilted the most, which is what makes the train read
      // as a stack of planes rather than one.
      inclination: (tilt * (index + 1)) / count,
      node: index * 47,
      periapsis: index * 63,
      // Kepler's third law: the period is the size of the orbit, not a choice.
      period: BASE_PERIOD * Math.pow(semiMajor / FIRST_ORBIT, 1.5),
      epoch: index * 83,
    }
    const state = orbitalState(elements, time)
    return {
      index,
      elements,
      state,
      radius: 5.4 - index * 0.55,
      screen: at(state.position),
      depth: camera.depth(state.position.x, state.position.y, state.position.z),
      path: linePath([...orbitPath(elements, 128), orbitPath(elements, 128)[0]].map(at)),
      // The hub train, drawn as a real horizontal circle so it foreshortens
      // with everything else instead of staying a circle off-axis.
      gear: (() => {
        const ring = circleFootprint(0, 0, HUB_RADIUS + 2.6 + index * 2.4, 40).map((point) =>
          at({ x: point.x, y: 0, z: point.y }),
        )
        return linePath([...ring, ring[0]])
      })(),
    }
  })
  const sorted = [...train].sort((a, b) => a.depth - b.depth)

  const plinth = extrudedPath(
    circleFootprint(0, 0, BASE_RADIUS, 24),
    camera,
    -COLUMN_DROP + BASE_HEIGHT,
    -COLUMN_DROP,
  )
  const column = capsulePath(
    at({ x: 0, y: -COLUMN_DROP + BASE_HEIGHT, z: 0 }),
    hub,
    COLUMN_RADIUS,
  )

  const readout = Math.round(time * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Orrery, ${count} bodies at year ${readout}, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? -DRAG_YEARS / 2 : undefined}
      aria-valuemax={interactive ? DRAG_YEARS / 2 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `year ${readout}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 1 : 0.25, 2)
        if (delta !== 0) apply(time + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(BASE_PERIOD / 2)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
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
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d="M 8 100 H 192 M 100 8 V 192" strokeDasharray="2 3" />
          <text
            x={192}
            y={16}
            textAnchor="end"
            fontFamily="ui-monospace, monospace"
            fontSize={5}
            fill={palette.grid}
            stroke="none"
          >
            {`YEAR ${readout}`}
          </text>
        </g>
      )}

      <g
        data-frame
        data-view={view}
        transform={aboutPoint(
          framing[view]?.rise ? `translate(0 ${framing[view].rise})` : "",
          ORIGIN.x,
          ORIGIN.y,
          framing[view]?.zoom ?? 1,
        )}
      >
        {/* `extrudedPath` works about the viewBox origin, so the plinth is
            carried out to where the machine actually stands. */}
        <g transform={`translate(${ORIGIN.x} ${ORIGIN.y})`}>
          <path data-base d={plinth} {...cast} />
        </g>
        <path data-column d={column} {...machined} />

        {showOrbits &&
          train.map((body) => (
            <path
              key={body.index}
              data-orbit={body.index}
              d={body.path}
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.6}
              strokeDasharray="3 2.5"
              opacity={0.5}
            />
          ))}

        {showGears && (
          <g data-train>
            {train.map((body) => (
              <path
                key={body.index}
                data-gear={body.index}
                d={body.gear}
                fill="none"
                stroke={palette.metal}
                strokeWidth={1}
                opacity={0.45}
              />
            ))}
          </g>
        )}

        {sorted.map((body) => (
          <g key={body.index}>
            {/* The arm is the orbital radius. It really does telescope. */}
            <path
              data-arm={body.index}
              d={capsulePath(hub, body.screen, 1.3)}
              {...machined}
              opacity={0.9}
            />
            <circle
              data-body={body.index}
              cx={px(body.screen.x)}
              cy={px(body.screen.y)}
              r={px(body.radius)}
              {...(body.index % 2 === 0 ? shell : cast)}
            />
          </g>
        ))}

        <g data-hub>
          <circle cx={px(hub.x)} cy={px(hub.y)} r={HUB_RADIUS} fill={palette.accent} />
          <circle
            cx={px(hub.x)}
            cy={px(hub.y)}
            r={px(HUB_RADIUS * 1.5)}
            fill={palette.glow}
            opacity={0.16}
          />
          <circle
            cx={px(hub.x)}
            cy={px(hub.y)}
            r={px(HUB_RADIUS * 0.45)}
            fill={palette.shell}
            opacity={0.5}
          />
        </g>

        <circle
          data-lamp
          cx={px(at({ x: 0, y: -COLUMN_DROP + BASE_HEIGHT + 2, z: -BASE_RADIUS * 0.6 }).x)}
          cy={px(at({ x: 0, y: -COLUMN_DROP + BASE_HEIGHT + 2, z: -BASE_RADIUS * 0.6 }).y)}
          r={2.2}
          fill={signalColor}
          className={signal === "ready" ? "robocn-pulse" : undefined}
        />
      </g>

      {label && (
        <text
          x={100}
          y={194}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

/** What year the train is aiming to be at, at `clock`. */
export function orreryGoal(behavior: OrreryBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  switch (behavior) {
    case "run":
      return clock * BASE_PERIOD
    // A year at a time, with a dwell: the way a geared model is wound on.
    case "jog":
      return Math.floor(clock) * BASE_PERIOD
    default:
      return 0
  }
}

/** An open polyline: an orbit, a dimension line. */
function linePath(points: readonly Vec2[]): string {
  if (points.length < 2) return ""
  return points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")
}

export { Orrery }
