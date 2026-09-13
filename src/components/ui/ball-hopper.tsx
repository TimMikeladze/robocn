"use client"

/**
 * ball-hopper — a bounding sensor ball: the machine whose compliance is its own
 * shell.
 *
 * `orb-droid` is already a ball with a drive in it, and the difference is the
 * whole reason this one exists: that one rolls and its shell is rigid, this one
 * leaves the ground on a solved arc and *changes shape* under contact. The
 * bounce comes from `solveHop` / `solveDrop` in `@/lib/robocn/hopper`, and the
 * squash from `squashRadii`, which is an oblate spheroid at constant volume —
 * flatten it and it has to get exactly that much wider.
 *
 * That is also why it is drawn as an ellipse rather than sampled: the
 * orthographic projection of a spheroid is exactly an axis-aligned ellipse,
 * `rx` across and `√(rx²sin²e + ry²cos²e)` up. So in plan view a squashed ball
 * reads as a *wider* one and in elevation as a flatter one, from one geometry,
 * with no artwork per angle.
 *
 * Dropped with `behavior="settle"` it bounces lower each time by the square of
 * the restitution and comes to rest in finite time, which is the honest version
 * of a ball stopping — contact time does not go to zero as the speed does.
 *
 * Solved: the arc, the contact, the sequence, the squash and the projection.
 * Illustrated: the contact patch (a constant-volume spheroid stays tangent to
 * the ground, so the patch is drawn rather than cut), and the yaw, which does
 * not come from the contact. Nothing travels across the frame.
 *
 * Design note: docs/bouncing-machines.md
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  dropTimings,
  hopTimings,
  solveDrop,
  solveHop,
  squashRadii,
  type HopState,
} from "@/lib/robocn/hopper"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type BallHopperBehavior = "bounce" | "settle" | "skitter" | "static"

const VIEW_WIDTH = 210
const VIEW_HEIGHT = 230
/** A sphere reads the same from everywhere, so it defaults to the elevation the squash shows in. */
const NATIVE_VIEW: RobotView = "front"

const RADIUS = 38
/** Drawing units per hop unit. */
const HOP_SCALE = 70
/** How far the shell gives at the hardest impact this machine takes. */
const SQUASH = 0.3
/** The dead beat at the end of a settle, before it is picked up and dropped again. */
const dwellAfter = (settleTime: number) => settleTime * 0.12 + 0.4
/** Lugs round the equator: what makes the yaw visible at all. */
const LUGS = 8

const ENVELOPE = boxCorners(
  { x: -RADIUS - 6, y: 0, z: -RADIUS - 6 },
  { x: RADIUS + 6, y: 2 * RADIUS + HOP_SCALE + 6, z: RADIUS + 6 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface BallHopperProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One shell, four projections. */
  view?: RobotView
  /** What it does when `altitude` is not supplied. */
  behavior?: BallHopperBehavior
  /**
   * Controlled height, 0 on the ground to 1 at the top of its drop. Supplying
   * it stops the loop and holds the ball there — off the ground, so it is not
   * touching and not squashed.
   */
  altitude?: number
  onAltitudeChange?: (altitude: number) => void
  /** Which way the sensor band is facing, in degrees. Omit and it turns as it bounces. */
  spin?: number
  /** Apex of the bounce in hop units, 0–1. */
  height?: number
  /** Shell stiffness in weights per hop unit, 4–400. Sets the contact time. */
  stiffness?: number
  /** Fraction of the landing speed returned at take-off, 0–1. Drives `settle`. */
  restitution?: number
  /** Bounces a second, or settle sequences a second under `behavior="settle"`. */
  speed?: number
  /** Seconds of offset, so a handful of them break step. */
  phase?: number
  animate?: boolean
  paused?: boolean
  /** Drag up to lift it; let go and it drops. */
  interactive?: boolean
  /** Optic lamp: neutral, accent, or shell. */
  signal?: "idle" | "ready" | "warning"
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  label?: string
}

const finiteClamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback

function BallHopper({
  view = NATIVE_VIEW,
  behavior = "bounce",
  altitude,
  onAltitudeChange,
  spin,
  height = 0.6,
  stiffness = 40,
  restitution = 0.66,
  speed = 0.7,
  phase = 0,
  animate = true,
  paused = false,
  interactive = false,
  signal = "ready",
  size = "md",
  variant = "solid",
  showGround = true,
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
  "aria-label": ariaLabel,
  ...props
}: BallHopperProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const controlled = altitude !== undefined
  const [held, setHeld] = React.useState<number | null>(null)

  const apex = finiteClamp(height, 0, 1, 0.6)
  const rate = finiteClamp(stiffness, 4, 400, 40)
  const bounceBack = finiteClamp(restitution, 0, 1, 0.66)
  const lift = controlled ? finiteClamp(altitude, 0, 1, 0) : held

  // One scalar: how much of the ball the person's hand still owns. Pinned while
  // they hold it and eased out on release, with the clock running underneath.
  const motion = useRobotScalar(RELEASED, {
    rate: 2.6,
    hold: lift === null ? null : 1,
    speed,
    phase,
    paused,
    animate: animate && !controlled,
  })
  const grip = clamp(motion.value, 0, 1)

  const scripted = ballHopperPose(behavior, motion.clock, {
    height: apex,
    stiffness: rate,
    restitution: bounceBack,
  })
  const pose = grip > 0 ? blend(scripted, liftedTo(lift ?? 0, apex), grip) : scripted

  const apply = React.useCallback(
    (next: number) => {
      // Rounded: this is a reported value, and 0.35000000000000003 is noise.
      const bounded = Math.round(clamp(Number.isFinite(next) ? next : 0, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onAltitudeChange?.(bounded)
    },
    [onAltitudeChange],
  )

  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // Up the frame lifts it: the gesture a person tries on something droppable.
    onDrag: React.useCallback((unit: Vec2) => apply((0.8 - unit.y) / 0.6), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // The shell: an oblate spheroid at constant volume, projected exactly.
  const squeeze = clamp(pose.squeeze, 0, 1) * SQUASH
  const { rx, ry } = squashRadii(RADIUS, squeeze)
  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  // Orthographic projection of a spheroid: an axis-aligned ellipse, exactly.
  const screenRy = Math.hypot(rx * camera.flatten, ry * camera.lift)
  const bandRy = Math.max(0.4, rx * camera.flatten)
  const centreY = ry + Math.max(0, pose.altitude) * HOP_SCALE
  const centre = camera.project(0, centreY, 0)

  const bearing = finiteClamp(spin, -3600, 3600, ballHopperSpin(behavior, motion.clock))
  // Bearing 0 faces the nose, which is where the `front` camera stands.
  const on = (degrees: number, radius: number, rise: number) => {
    const angle = toRadians(degrees)
    return {
      x: radius * Math.sin(angle),
      y: centreY + rise,
      z: -radius * Math.cos(angle),
    }
  }
  const at = (degrees: number, radius: number, rise: number) => {
    const world = on(degrees, radius, rise)
    return {
      point: camera.project(world.x, world.y, world.z),
      // Bigger than the centre's own depth means this side is facing the camera.
      near: camera.depth(world.x, world.y, world.z) > camera.depth(0, centreY, 0),
    }
  }

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lamp = signal === "warning" ? palette.shell : signal === "idle" ? palette.metal : palette.accent

  const optic = at(bearing, rx * 0.96, ry * 0.12)
  const cap = camera.project(0, centreY + ry * 0.86, 0)
  const mast = camera.project(0, centreY + ry * 1.12, 0)
  // A point on the shell at this height sits on a smaller circle than the
  // equator does — otherwise the detail floats off the silhouette.
  const around = (rise: number) => rx * Math.sqrt(Math.max(0, 1 - (rise / ry) ** 2))
  const vents = [-34, 0, 34]
    .map((offset) => ({ key: offset, a: at(bearing + 180 + offset, around(ry * 0.34) * 0.99, ry * 0.34), b: at(bearing + 180 + offset, around(ry * 0.58) * 0.99, ry * 0.58) }))
    .filter((vent) => vent.a.near)
    .map((vent) => ({ key: vent.key, from: vent.a.point, to: vent.b.point }))
  const lugs = Array.from({ length: LUGS }, (_, index) => ({
    key: index,
    ...at(bearing + (index * 360) / LUGS, rx * 0.99, 0),
  }))
  // The seam is a great circle through the optic: it foreshortens to a line
  // edge-on, which is what a seam drawn on a shell actually does.
  const seamFacing = at(bearing + 90, rx, 0).near || at(bearing - 90, rx, 0).near
  const seam = Array.from({ length: 17 }, (_, index) => {
    const t = -Math.PI / 2 + (index / 16) * Math.PI
    const angle = toRadians(bearing + 90)
    return camera.project(
      rx * Math.sin(angle) * Math.cos(t),
      centreY + ry * Math.sin(t),
      -rx * Math.cos(angle) * Math.cos(t),
    )
  })

  const readout = Math.round((grip > 0 ? (lift ?? 0) : Math.max(0, pose.altitude)) * 100)
  const state = pose.contact ? "stance" : "flight"
  const rise = Math.max(0, pose.altitude)
  const shadow = 1 - Math.min(0.6, rise * 0.9)
  const patch = rx * 0.62 * Math.sqrt(clamp(pose.squeeze, 0, 1))

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Ball hopper, ${state}, ${readout} percent of its drop height, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent of its drop height` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
        if (delta !== 0) apply((lift ?? Math.max(0, pose.altitude)) + delta)
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
      <g data-ball data-view={view} data-contact={state} transform={frame || undefined}>
        {showGround && (
          <g data-ground>
            <ellipse
              cx={0}
              cy={0}
              rx={px(rx * 1.05 * shadow)}
              ry={px(rx * 1.05 * shadow * Math.max(0.08, camera.flatten))}
              fill={palette.dark}
              opacity={px(0.2 * shadow)}
            />
            <path
              d={groundMark(camera, RADIUS + 22)}
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.9}
            />
          </g>
        )}

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.5} strokeDasharray="3 4">
            <circle cx={0} cy={px(camera.project(0, RADIUS, 0).y)} r={RADIUS} />
            <path d={`M 0 ${px(camera.project(0, 2 * RADIUS + HOP_SCALE, 0).y)} L 0 0`} />
          </g>
        )}

        {/* Contact patch. Drawn, not cut: a constant-volume shell stays tangent. */}
        {pose.contact && patch > 0.5 && (
          <ellipse
            data-patch
            cx={0}
            cy={0}
            rx={px(patch)}
            ry={px(Math.max(0.6, patch * camera.flatten))}
            fill={palette.dark}
            opacity={0.35}
          />
        )}

        {/* The far half of the band, before the shell paints over it. */}
        <path
          data-band
          data-near="false"
          d={bandArc(centre, rx, bandRy, false)}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.1}
          opacity={0.35}
        />
        {lugs
          .filter((lug) => !lug.near)
          .map((lug) => (
            <circle key={lug.key} data-lug data-near="false" cx={px(lug.point.x)} cy={px(lug.point.y)} r={2.4} {...cast} opacity={0.45} />
          ))}

        <ellipse data-shell cx={px(centre.x)} cy={px(centre.y)} rx={px(rx)} ry={px(screenRy)} {...shell} />

        {/* Seam, hatch and pole cap: what tells you it is a machine, not a ball. */}
        {seamFacing && (
          <path
            data-seam
            d={seam.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1}
            opacity={0.45}
          />
        )}
        {/* Vents, on the shell's own surface: drawn only where a camera sees them. */}
        {vents.map((vent) => (
          <path
            key={vent.key}
            d={`M ${px(vent.from.x)} ${px(vent.from.y)} L ${px(vent.to.x)} ${px(vent.to.y)}`}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.4}
          />
        ))}
        <ellipse
          data-cap
          cx={px(cap.x)}
          cy={px(cap.y)}
          rx={px(rx * 0.34)}
          ry={px(Math.hypot(rx * 0.34 * camera.flatten, ry * 0.13 * camera.lift))}
          {...machined}
        />
        {/* Antenna: it stands out of the cap, so it vanishes in plan view. */}
        <path
          data-antenna
          d={`M ${px(cap.x)} ${px(cap.y)} L ${px(mast.x)} ${px(mast.y)}`}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={px(mast.x)} cy={px(mast.y)} r={2} {...cast} />

        <path
          data-band
          data-near="true"
          d={bandArc(centre, rx, bandRy, true)}
          fill="none"
          stroke={palette.dark}
          strokeWidth={1.4}
          opacity={0.55}
        />
        {lugs
          .filter((lug) => lug.near)
          .map((lug) => (
            <circle key={lug.key} data-lug data-near="true" cx={px(lug.point.x)} cy={px(lug.point.y)} r={2.8} {...cast} />
          ))}

        {optic.near && (
          <g data-optic>
            <circle cx={px(optic.point.x)} cy={px(optic.point.y)} r={7.6} {...cast} />
            <circle cx={px(optic.point.x)} cy={px(optic.point.y)} r={4.4} {...machined} />
            <circle cx={px(optic.point.x)} cy={px(optic.point.y)} r={2.2} fill={lamp} />
            <circle cx={px(optic.point.x)} cy={px(optic.point.y)} r={9.4} fill={palette.glow} opacity={0.22} />
          </g>
        )}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 8}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
          {variant === "blueprint" ? ` · e ${bounceBack.toFixed(2)}` : ""}
        </text>
      )}
    </svg>
  )
}

/** Nothing held: the goal the released value eases back to. */
const RELEASED = () => 0

/**
 * Half of the band. Looking down on a horizontal ring, the near half is the
 * lower half of its ellipse; straight down there is no near and far, so the
 * whole ring is drawn once.
 */
function bandArc(centre: Vec2, rx: number, ry: number, near: boolean) {
  const left = `${px(centre.x - rx)} ${px(centre.y)}`
  const right = `${px(centre.x + rx)} ${px(centre.y)}`
  if (ry >= rx * 0.999) {
    // Straight down: the ring is a full circle and nothing of it is hidden.
    return near ? `M ${left} A ${px(rx)} ${px(ry)} 0 1 0 ${right} A ${px(rx)} ${px(ry)} 0 1 0 ${left}` : ""
  }
  return `M ${left} A ${px(rx)} ${px(ry)} 0 0 ${near ? 0 : 1} ${right}`
}

/** The ground: a horizon line from any tilted camera, a cross-hair from straight down. */
function groundMark(camera: RobotCamera, reach: number) {
  if (camera.lift > 0.02) {
    const a = camera.project(-reach, 0, 0)
    const b = camera.project(reach, 0, 0)
    return `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
  }
  return `M ${px(-reach)} 0 L ${px(-reach * 0.55)} 0 M ${px(reach * 0.55)} 0 L ${px(reach)} 0 M 0 ${px(-reach)} L 0 ${px(-reach * 0.55)} M 0 ${px(reach * 0.55)} L 0 ${px(reach)}`
}

/** Held in the air at `fraction` of the drop height: not touching, not squashed. */
function liftedTo(fraction: number, height: number): HopState {
  const value = clamp(Number.isFinite(fraction) ? fraction : 0, 0, 1)
  return {
    altitude: value * height,
    compression: 0,
    squeeze: 0,
    contact: value <= 0,
    velocity: 0,
    load: 0,
    bounce: 0,
    resting: false,
  }
}

/** Hand-held pose over behaviour, by however much of it the hand still owns. */
function blend(free: HopState, gripped: HopState, amount: number): HopState {
  const mix = (a: number, b: number) => a + (b - a) * amount
  return {
    altitude: mix(free.altitude, gripped.altitude),
    compression: mix(free.compression, gripped.compression),
    squeeze: mix(free.squeeze, gripped.squeeze),
    contact: amount > 0.5 ? gripped.contact : free.contact,
    velocity: mix(free.velocity, gripped.velocity),
    load: mix(free.load, gripped.load),
    bounce: free.bounce,
    resting: false,
  }
}

/**
 * What it does with no hand on it, as a pure function of the clock in cycles.
 * `settle` is a whole sequence a cycle — dropped, bouncing lower each time by
 * the square of the restitution, then sat still for a moment before it is
 * picked up and dropped again.
 */
export function ballHopperPose(
  behavior: BallHopperBehavior,
  clock: number,
  {
    height = 0.6,
    stiffness = 40,
    restitution = 0.66,
  }: { height?: number; stiffness?: number; restitution?: number } = {},
): HopState {
  const time = Number.isFinite(clock) ? clock : 0
  const cycle = ((time % 1) + 1) % 1
  switch (behavior) {
    case "settle": {
      const { settleTime } = dropTimings({ height, stiffness, restitution })
      return solveDrop({
        time: cycle * (settleTime + dwellAfter(settleTime)),
        height,
        stiffness,
        restitution,
      })
    }
    // Low and fast: four bounces in the time the steady one takes to make one.
    case "skitter":
      return solveHop({ phase: time * 4, height: Math.min(height * 0.22, 0.16), stiffness: stiffness * 1.6 })
    case "static": {
      const sag = 1 / stiffness
      return {
        altitude: -sag,
        compression: sag,
        squeeze: 0,
        contact: true,
        velocity: 0,
        load: 1,
        bounce: 0,
        resting: true,
      }
    }
    default:
      return solveHop({ phase: time, height, stiffness })
  }
}

/**
 * Which way the band is facing, in degrees. A bouncing ball turns; how fast is
 * drawn rather than taken from the contact, which is why `spin` overrides it.
 */
export function ballHopperSpin(behavior: BallHopperBehavior, clock: number): number {
  if (!Number.isFinite(clock) || behavior === "static") return 0
  const turns = behavior === "skitter" ? 140 : behavior === "settle" ? 200 : 96
  return (clock * turns) % 360
}

/** Timings of the steady bounce, for a caller that wants to read the duty factor. */
export const ballHopperTimings = hopTimings

export { BallHopper }
