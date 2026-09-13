"use client"

/**
 * robot-drone — a multirotor, drawn from any of four angles.
 *
 * The rotors spin whenever anything else does, and everything else comes off
 * one flight path: `hover` drifts and bobs on the spot, `orbit` flies a circle
 * and banks into it, `pointer` chases the cursor. Heading is taken from the
 * direction of travel rather than animated separately, so the aircraft always
 * flies the way it is pointing.
 *
 * The airframe is modelled once in world units — x starboard, y up, z toward
 * the tail — and pushed through `robotCamera(view)`. Plan view is the identity
 * projection, so the top-down drawing is the one it always had; the other views
 * foreshorten the same parts instead of redrawing them.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotDrag } from "@/hooks/use-robot-motion"
import { useEasedPoint } from "@/hooks/use-robot-arm"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
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

const VIEW = 180
/** How far the aircraft may stray from the centre of the frame. */
const RANGE = 34
/** Blade degrees per second. */
const ROTOR_RATE = 900
/** View units per second the aircraft flies. */
const FLIGHT_SPEED = 95
/** Arm length: fuselage centre to motor. */
const ARM = 52
/** How far the propeller discs sit above the arms. */
const ROTOR_RISE = 5
/** Fuselage deck and belly, a hull apart. */
const DECK = 10
const BELLY = -7
/** The ground the shadow falls on. Only reads once the camera tips over. */
const GROUND = -34
/** World height the bob covers, so the aircraft rises in the tipped views too. */
const BOB_RISE = 280

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type DroneBehavior = "hover" | "orbit" | "pointer" | "static"

export interface RobotDroneProps
  extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  rotors?: 4 | 6
  /** Which way the camera looks at the aircraft. */
  view?: RobotView
  /** What the aircraft flies when it is not being driven. */
  behavior?: DroneBehavior
  /** Orbits or drift cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Press and drag to fly the aircraft; arrow keys nudge it. */
  interactive?: boolean
  onHeadingChange?: (heading: number) => void
  /** Clockwise heading in degrees. Omit and it follows its flight path. */
  heading?: number
  /** Controlled blade angle in degrees. Omit and the rotors spin. */
  rotorAngle?: number
  guards?: boolean
  /** Illuminate the fuselage lamp. Omit and it lights while airborne. */
  active?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotDrone({
  rotors = 4, view = "plan", behavior = "hover", speed = 0.2, animate = true, paused = false, phase = 0,
  interactive = false, onHeadingChange,
  heading, rotorAngle, guards = true, active,
  label, size = "md", variant = "solid", color, accent, metal, dark, glow, grid,
  palette: paletteOverride, className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: RobotDroneProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<Vec2 | null>(null)

  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !paused,
    toWorld: React.useCallback((unit: Vec2) => bound({
      x: (unit.x - 0.5) * VIEW,
      y: (unit.y - 0.5) * VIEW,
    }), []),
  })
  const commanded = held ?? (behavior === "pointer" ? pointer.target : null)
  const path = React.useCallback(
    (clock: number) => commanded ?? droneGoal(behavior, clock * speed),
    [behavior, speed, commanded],
  )
  const flight = useEasedPoint(path, { x: 0, y: 0 }, {
    speed: FLIGHT_SPEED,
    animate: animate && behavior !== "static",
    paused,
    phase,
  })
  const cycles = flight.clock * speed
  const drift = flight.point

  const controlledHeading = heading !== undefined
  const bearing = controlledHeading
    ? (Number.isFinite(heading) ? heading : 0)
    : commanded
      ? degrees(commanded)
      : droneHeading(behavior, cycles)
  const headingAngle = ((bearing % 360) + 360) % 360

  const apply = React.useCallback((next: Vec2) => {
    const to = bound(next)
    setHeld(to)
    onHeadingChange?.(((degrees(to) % 360) + 360) % 360)
  }, [onHeadingChange, setHeld])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit) => apply({
      x: (unit.x - 0.5) * VIEW,
      y: (unit.y - 0.5) * VIEW,
    }), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const airborne = animate && !paused && behavior !== "static"
  const blade = rotorAngle !== undefined
    ? (Number.isFinite(rotorAngle) ? ((rotorAngle % 360) + 360) % 360 : 0)
    : ((flight.clock * ROTOR_RATE % 360) + 360) % 360
  // Altitude, read as size: the aircraft grows a little as it rises, and its
  // shadow slides out from under it. A tipped camera also takes it as height.
  const bob = airborne ? Math.sin(cycles * Math.PI * 2 * 1.6) * 0.025 : 0
  const lamp = active ?? airborne

  const camera = robotCamera(view)
  const turn = toRadians(headingAngle)
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  /** A point on the airframe: yawed by the heading, then projected. */
  const at = (x: number, y: number, z: number) =>
    camera.project(x * cos - z * sin, y, x * sin + z * cos)
  const depthAt = (x: number, y: number, z: number) =>
    camera.depth(x * cos - z * sin, y, x * sin + z * cos)
  const line = (a: Vec2, b: Vec2) => `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`

  const count = rotors === 6 ? 6 : 4
  const hubs = Array.from({ length: count }, (_, index) => {
    const angle = toRadians(index * 360 / count + (count === 4 ? 45 : 30))
    const x = Math.sin(angle) * ARM
    const z = -Math.cos(angle) * ARM
    return {
      index,
      hub: at(x, ROTOR_RISE, z),
      foot: at(x, 0, z),
      can: extrudedPath(ring(x, z, 5.5), camera, ROTOR_RISE, -1, headingAngle),
      depth: depthAt(x, ROTOR_RISE, z),
    }
  })
  // The fuselage sorts the rotors: the ones behind it are painted first.
  const deckDepth = camera.depth(0, DECK, 0)
  const behind = hubs.filter(rotor => rotor.depth <= deckDepth)
  const ahead = hubs.filter(rotor => rotor.depth > deckDepth)
  const footprint = roundedFootprint(16, 25, 12, 9)
  const fuselage = extrudedPath(footprint, camera, DECK, BELLY, headingAngle)
  // The deck repainted over the hull, so the sides can take a shading pass
  // without dulling the top. Both collapse to the same outline in plan.
  const deckFace = extrudedPath(footprint, camera, DECK, DECK, headingAngle)
  const tipped = camera.lift > 0.01
  const pod = extrudedPath(
    roundedFootprint(6, 3.5, 2).map(point => ({ x: point.x, y: point.y + 24.5 })),
    camera, BELLY + 2, -15, headingAngle,
  )
  const deck = camera.plane(DECK, headingAngle)
  const rotorPlane = camera.plane(0, headingAngle)
  const origin = at(0, 0, 0)

  const shadow = camera.project(drift.x * 1.1, GROUND, drift.y * 1.1)
  const lifted = camera.project(drift.x, bob * BOB_RISE, drift.y)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const rotor = ({ index, hub, can, depth }: (typeof hubs)[number]) => (
    // Behind the fuselage and off the vertical: sit back the way a far rod does.
    <g key={index} data-rotor={index} opacity={tipped && depth <= deckDepth ? 0.62 : 1}>
      <path d={can} {...cast} />
      <g transform={`translate(${px(hub.x)} ${px(hub.y)}) ${rotorPlane}`.trimEnd()}>
        {guards && <g data-guard fill="none" stroke={palette.metal} strokeWidth={1.5}>
          <circle r={22} /><path d="M -22 0 h 44 M 0 -22 v 44" strokeWidth={0.7} />
        </g>}
        <circle r={6} {...cast} />
        <g data-propeller transform={`rotate(${px(blade * (index % 2 ? -1 : 1))})`}>
          <path d="M -3 -2 C -21 -12 -23 -2 -15 2 L -3 3 Z M 3 2 C 21 12 23 2 15 -2 L 3 -3 Z" {...machined} />
        </g>
        <circle r={3} {...shell} />
        <circle r={1} fill={palette.dark} />
      </g>
    </g>
  )

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`${count}-rotor drone, heading ${Math.round(headingAngle)} degrees, ${viewNames[view] ?? viewNames.plan}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 360 : undefined}
      aria-valuenow={interactive ? px(headingAngle) : undefined}
      aria-valuetext={interactive ? `heading ${Math.round(headingAngle)} degrees` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        // Arrows fly the aircraft rather than turn it: up is away from you.
        const from = held ?? drift
        const step = event.shiftKey ? 18 : 8
        const horizontal = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0
        const vertical = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0
        if (horizontal !== 0 || vertical !== 0) apply({ x: from.x + horizontal, y: from.y + vertical })
        else if (event.key === "Home" || event.key === "Escape") setHeld(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 180 180" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>
      {variant === "blueprint" && <g fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3">
        {view === "plan"
          ? <><circle cx={90} cy={90} r={76} /><path d="M 90 9 V 171 M 9 90 H 171" /></>
          : <path d={`M 9 ${px(90 - GROUND * camera.lift)} H 171 M 90 9 V 171`} />}
      </g>}
      {variant !== "wire" && (
        <ellipse data-shadow cx={px(90 + shadow.x)} cy={px(90 + shadow.y + 8)}
          rx={px(46 * (1 - bob))} ry={px(42 * (1 - bob) * camera.flatten)}
          fill={palette.dark} opacity={0.1} />
      )}
      <g data-aircraft data-view={view}
        transform={`translate(${px(90 + lifted.x)} ${px(90 + lifted.y)}) scale(${px(1 + bob)})`}>
        <g data-gear opacity={tipped ? 1 : 0.9}>
          {[-1, 1].map(side => <g key={side}>
            {[-11, 13].map(z => <path key={z} d={line(at(side * 8, BELLY, z), at(side * 15, -22, z))}
              stroke={palette.dark} strokeWidth={3} strokeLinecap="round" />)}
            <path d={line(at(side * 15, -22, -15), at(side * 15, -22, 17))}
              stroke={palette.metal} strokeWidth={3.5} strokeLinecap="round" />
          </g>)}
        </g>
        {hubs.map(({ index, foot }) => <g key={index}>
          <path d={line(origin, foot)} stroke={palette.dark} strokeWidth={10} strokeLinecap="round" />
          <path d={line(origin, foot)} stroke={palette.shell} strokeWidth={6} strokeLinecap="round" />
        </g>)}
        {behind.map(rotor)}
        <path d={pod} {...cast} />
        <path d={fuselage} {...shell} />
        {tipped && variant === "solid" && <>
          <path d={fuselage} fill={palette.dark} opacity={0.18} />
          <path d={deckFace} {...shell} />
        </>}
        <g data-deck transform={deck}>
          <rect x={-10} y={-10} width={20} height={25} rx={4} {...cast} />
          <path d="M -6 -16 L 0 -22 L 6 -16" fill="none" stroke={palette.accent} strokeWidth={2} />
          <rect x={-6} y={21} width={12} height={7} rx={2} {...machined} />
          <circle cy={26} r={3} fill={palette.dark} />
          <circle cy={8} r={2.5} fill={lamp ? palette.accent : palette.metal} />
          {[-4, 0, 4].map(y => <path key={y} d={`M -5 ${y - 2} h 10`} stroke={palette.metal} strokeWidth={1} />)}
        </g>
        {ahead.map(rotor)}
      </g>
      {label && <text x={90} y={176} textAnchor="middle" fontSize={5} fontFamily="ui-monospace, monospace" fill={palette.foreground}>{label}</text>}
    </svg>
  )
}

/** A circle of footprint points, for the parts that are round in plan. */
const ring = (x: number, z: number, radius: number, steps = 12): Vec2[] =>
  Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2
    return { x: x + Math.cos(angle) * radius, y: z + Math.sin(angle) * radius }
  })

/** Keep the aircraft inside its frame. */
const bound = (point: Vec2): Vec2 => ({
  x: Number.isFinite(point.x) ? clamp(point.x, -RANGE, RANGE) : 0,
  y: Number.isFinite(point.y) ? clamp(point.y, -RANGE, RANGE) : 0,
})

const degrees = (to: Vec2) => (Math.atan2(to.x, -to.y) * 180) / Math.PI

/** Where the aircraft should be after `cycles` of its flight path. */
export function droneGoal(behavior: DroneBehavior, cycles: number): Vec2 {
  if (behavior === "static" || !Number.isFinite(cycles)) return { x: 0, y: 0 }
  const t = cycles * Math.PI * 2
  if (behavior === "orbit") {
    return { x: Math.sin(t) * 28, y: -Math.cos(t) * 28 }
  }
  if (behavior === "pointer") return { x: 0, y: 0 }
  return { x: Math.sin(t * 0.8) * 7, y: Math.cos(t * 0.55) * 6 }
}

/** Which way the nose points on that path: along the track, for an orbit. */
export function droneHeading(behavior: DroneBehavior, cycles: number) {
  if (behavior === "static" || !Number.isFinite(cycles)) return 0
  if (behavior === "orbit") return cycles * 360 + 90
  if (behavior === "pointer") return 0
  return Math.sin(cycles * Math.PI * 2 * 0.45) * 14
}

export { RobotDrone }
