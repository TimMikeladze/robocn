"use client"

/**
 * motion-platform — six actuators and a deck.
 *
 * The same closed-form Stewart IK that poses a companion head, put to the job
 * the mechanism was invented for. Every leg length comes out of `solveStewart`,
 * so the deck is drawn through its own solved anchors rather than as a tilted
 * picture, and the payload stands on the plate's real normal. A leg asked for
 * more stroke than it has says so instead of stretching: that is the number
 * that tells you whether a pose is reachable at all.
 */

import * as React from "react"

import { clamp, convexHull2, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { useRobotDrag, useRobotScalar, arrowStep } from "@/hooks/use-robot-motion"
import {
  capsulePath,
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
import { solveStewart, type StewartGeometry } from "@/lib/robocn/stewart"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 180
/** World origin: the centre of the fixed base ring. */
const CENTRE = { x: 95, y: 122 }
/** Degrees per second while easing back into the behaviour. */
const SLEW_RATE = 46
const CLICK_SLOP = 0.02
/** Drawn three-quarter, which is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "iso"

/** A machine, not a desk toy: longer legs, more stroke, a deck on top. */
const GEOMETRY: StewartGeometry = {
  baseRadius: 46,
  platformRadius: 34,
  baseSpread: 54,
  platformSpread: 38,
  height: 52,
  travel: 17,
}

const fits: Record<RobotView, number> = { plan: 0.86, front: 0.94, profile: 0.94, iso: 1 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type MotionPlatformBehavior = "settle" | "sway" | "static"
export type MotionPlatformPayload = "deck" | "camera" | "none"

export interface MotionPlatformProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled roll in degrees. Supplying any pose prop stops the loop. */
  roll?: number
  /** Controlled pitch in degrees. */
  pitch?: number
  /** Controlled yaw in degrees. */
  yaw?: number
  /** Controlled rise above the resting height, in world units. */
  heave?: number
  /** Controlled sideways offset, in world units. */
  sway?: number
  /** Controlled fore-aft offset, in world units. */
  surge?: number
  /** What the deck does when no pose prop is supplied. */
  behavior?: MotionPlatformBehavior
  /** Where the camera stands. One platform, four projections. */
  view?: RobotView
  /** Pose cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag the deck to tip it: across for roll, up and down for pitch. */
  interactive?: boolean
  onPoseChange?: (pose: { roll: number; pitch: number }) => void
  /** What is bolted to the deck. */
  payload?: MotionPlatformPayload
  showStroke?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function MotionPlatform({
  roll,
  pitch,
  yaw,
  heave,
  sway,
  surge,
  behavior = "settle",
  view = NATIVE_VIEW,
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onPoseChange,
  payload = "deck",
  showStroke = true,
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
}: MotionPlatformProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const controlled =
    roll !== undefined ||
    pitch !== undefined ||
    yaw !== undefined ||
    heave !== undefined ||
    sway !== undefined ||
    surge !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [grabbed, setGrabbed] = React.useState<{ roll: number; pitch: number } | null>(null)

  const running = animate && !controlled && behavior !== "static"
  const rollGoal = React.useCallback((clock: number) => platformPose(behavior, clock).roll, [behavior])
  const pitchGoal = React.useCallback((clock: number) => platformPose(behavior, clock).pitch, [behavior])
  const options = { rate: SLEW_RATE, speed, animate: running, paused, phase }
  const rollMotion = useRobotScalar(rollGoal, {
    ...options,
    hold: controlled ? finite(roll) : (grabbed?.roll ?? null),
  })
  const pitchMotion = useRobotScalar(pitchGoal, {
    ...options,
    hold: controlled ? finite(pitch) : (grabbed?.pitch ?? null),
  })
  // Everything that is not grabbed rides the same clock, so the pose stays one
  // pose rather than two loops drifting apart.
  const cycle = platformPose(controlled || !running ? "static" : behavior, rollMotion.clock)
  const pose = {
    roll: clamp(rollMotion.value, -24, 24),
    pitch: clamp(pitchMotion.value, -24, 24),
    yaw: controlled ? finite(yaw) : cycle.yaw,
    heave: controlled ? finite(heave) : cycle.heave,
    sway: controlled ? finite(sway) : cycle.sway,
    surge: controlled ? finite(surge) : cycle.surge,
  }
  const solution = solveStewart(pose, GEOMETRY)

  const apply = React.useCallback(
    (next: { roll: number; pitch: number }) => {
      const bounded = { roll: clamp(next.roll, -24, 24), pitch: clamp(next.pitch, -24, 24) }
      setGrabbed(bounded)
      onPoseChange?.(bounded)
    },
    [onPoseChange, setGrabbed],
  )
  const press = React.useRef<{ from: Vec2; at: Vec2; moved: boolean } | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => {
        if (!press.current) {
          press.current = {
            from: { x: rollMotion.value, y: pitchMotion.value },
            at: unit,
            moved: false,
          }
          return
        }
        const dx = unit.x - press.current.at.x
        const dy = unit.y - press.current.at.y
        if (Math.hypot(dx, dy) > CLICK_SLOP) press.current.moved = true
        if (press.current.moved) {
          apply({
            roll: press.current.from.x + dx * 70,
            pitch: press.current.from.y + dy * 70,
          })
        }
      },
      [apply, rollMotion.value, pitchMotion.value],
    ),
    onDragEnd: React.useCallback(() => {
      press.current = null
      setGrabbed(null)
    }, [setGrabbed]),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const to = (p: Vec3): Vec2 => camera.project(p.x, p.y, p.z)

  // The deck is drawn through its own solved anchors, so it tips because the
  // legs did, not because a transform was applied to a picture of it.
  const top = solution.legs.map((leg) => leg.platform)
  const normal = plateNormal(top)
  const deckPoints = top.map(to)
  const underside = top.map((p) => to(offset(p, normal, -5)))
  const deck = hullPath([...deckPoints, ...underside])
  const centre = solution.center
  const worst = solution.legs.reduce((most, leg) => Math.max(most, Math.abs(leg.stroke)), 0)
  const readout = px(worst)

  const legs = solution.legs
    .map((leg) => ({ ...leg, depth: camera.depth(leg.base.x, leg.base.y, leg.base.z) }))
    .sort((a, b) => a.depth - b.depth)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Motion platform, roll ${px(pose.roll)} degrees, pitch ${px(pose.pitch)} degrees, longest stroke ${readout} of ${GEOMETRY.travel} units, ${solution.reachable ? "within travel" : "over travel"}, ${viewNames[view] ?? viewNames.iso}`}
      aria-valuemin={interactive ? -24 : undefined}
      aria-valuemax={interactive ? 24 : undefined}
      aria-valuenow={interactive ? px(pose.roll) : undefined}
      aria-valuetext={
        interactive ? `roll ${px(pose.roll)} degrees, pitch ${px(pose.pitch)} degrees` : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 4, 12)
        const sideways = event.key === "ArrowLeft" || event.key === "ArrowRight"
        if (delta !== 0) {
          apply({
            roll: rollMotion.value + (sideways ? delta : 0),
            pitch: pitchMotion.value + (sideways ? 0 : delta),
          })
        } else if (event.key === "Home") apply({ roll: 0, pitch: 0 })
        else if (event.key === "Escape") setGrabbed(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setGrabbed(null)
      }}
      viewBox="0 0 190 180"
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
      data-view={view}
      {...props}
    >
      <g
        data-platform
        transform={`translate(${CENTRE.x} ${CENTRE.y}) ${fit === 1 ? "" : `scale(${fit})`}`.trimEnd()}
      >
        <g data-base>
          <path
            d={hullPath(
              Array.from({ length: 18 }, (_, i) => {
                const a = (i / 18) * Math.PI * 2
                const r = GEOMETRY.baseRadius + 9
                return to({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r })
              }).concat(
                Array.from({ length: 18 }, (_, i) => {
                  const a = (i / 18) * Math.PI * 2
                  const r = GEOMETRY.baseRadius + 9
                  return to({ x: Math.sin(a) * r, y: -8, z: Math.cos(a) * r })
                }),
              ),
            )}
            {...cast}
          />
          <path
            d={hullPath(
              Array.from({ length: 24 }, (_, i) => {
                const a = (i / 24) * Math.PI * 2
                const r = GEOMETRY.baseRadius + 5
                return to({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r })
              }),
            )}
            {...machined}
          />
          {solution.legs.map((leg) => (
            <circle
              key={leg.id}
              cx={px(to(leg.base).x)}
              cy={px(to(leg.base).y)}
              r={4}
              {...cast}
            />
          ))}
        </g>

        {legs.map((leg) => {
          const along = { x: leg.platform.x - leg.base.x, y: leg.platform.y - leg.base.y, z: leg.platform.z - leg.base.z }
          const body = {
            x: leg.base.x + along.x * 0.55,
            y: leg.base.y + along.y * 0.55,
            z: leg.base.z + along.z * 0.55,
          }
          return (
            <g key={leg.id} data-leg={leg.id} data-fault={leg.withinLimits ? "false" : "true"}>
              <path d={capsulePath(to(leg.base), to(body), 5.2)} {...cast} />
              <path
                d={capsulePath(to(body), to(leg.platform), 2.8)}
                {...(leg.withinLimits ? machined : { ...machined, stroke: palette.accent, strokeWidth: 1.6 })}
              />
              <circle cx={px(to(leg.platform).x)} cy={px(to(leg.platform).y)} r={3} {...cast} />
            </g>
          )
        })}

        <g data-deck>
          <path d={deck} {...shell} />
          <path d={hullPath(deckPoints)} fill="none" stroke={palette.dark} strokeWidth={0.9} />
          {payload === "deck" && (
            <path
              d={hullPath([
                ...top.map((p) => to(offset(shrink(p, centre, 0.66), normal, 6))),
                ...top.map((p) => to(offset(shrink(p, centre, 0.66), normal, 18))),
              ])}
              {...machined}
            />
          )}
          {payload === "camera" && (
            <g data-payload>
              <path
                d={capsulePath(
                  to(offset(centre, normal, 6)),
                  to(offset(centre, normal, 26)),
                  9,
                )}
                {...machined}
              />
              <circle
                cx={px(to(offset(centre, normal, 27)).x)}
                cy={px(to(offset(centre, normal, 27)).y)}
                r={5}
                fill={palette.accent}
              />
            </g>
          )}
          <circle
            cx={px(to(offset(centre, normal, 1)).x)}
            cy={px(to(offset(centre, normal, 1)).y)}
            r={3}
            fill={solution.reachable ? palette.accent : palette.shell}
          />
        </g>

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
            <path
              d={hullPath(
                Array.from({ length: 24 }, (_, i) => {
                  const a = (i / 24) * Math.PI * 2
                  return to({ x: Math.sin(a) * GEOMETRY.baseRadius, y: 0, z: Math.cos(a) * GEOMETRY.baseRadius })
                }),
              )}
              strokeDasharray="2 3"
            />
            <path
              d={`M ${px(to({ x: 0, y: 0, z: 0 }).x)} ${px(to({ x: 0, y: 0, z: 0 }).y)} L ${px(to(centre).x)} ${px(to(centre).y)}`}
              strokeDasharray="4 2"
            />
          </g>
        )}
      </g>
      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        {showStroke && (
          <text x={95} y={168} fontSize={5}>
            {`R ${px(pose.roll)}° P ${px(pose.pitch)}° / STROKE ${readout}/${GEOMETRY.travel}${solution.reachable ? "" : " OVER"}`}
          </text>
        )}
        {label && (
          <text x={95} y={176} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/** The whole six-axis pose at `clock`. `sway` is the big one; `settle` is the
 *  small continuous correction a loaded platform actually spends its life on. */
export function platformPose(behavior: MotionPlatformBehavior, clock: number) {
  const rest = { roll: 0, pitch: 0, yaw: 0, heave: 0, sway: 0, surge: 0 }
  if (behavior === "static" || !Number.isFinite(clock)) return rest
  const t = clock * Math.PI * 2
  if (behavior === "sway") {
    return {
      roll: Math.sin(t) * 15,
      pitch: Math.sin(t * 0.75 + 1.1) * 12,
      yaw: Math.sin(t * 0.5) * 9,
      heave: Math.sin(t * 1.5) * 7,
      sway: Math.sin(t * 0.6 + 0.4) * 7,
      surge: Math.cos(t * 0.8) * 6,
    }
  }
  return {
    roll: Math.sin(t * 1.3) * 4.5,
    pitch: Math.sin(t * 0.9 + 0.8) * 3.5,
    yaw: Math.sin(t * 0.7) * 2.5,
    heave: Math.sin(t) * 3,
    sway: Math.sin(t * 1.1 + 2) * 2,
    surge: Math.cos(t * 0.6) * 2,
  }
}

const finite = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? value : 0

/** The deck's own normal, taken from three of its solved anchors. */
function plateNormal(points: Vec3[]): Vec3 {
  const [a, b, c] = [points[0], points[2], points[4]]
  if (!a || !b || !c) return { x: 0, y: 1, z: 0 }
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
  const n = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  }
  const length = Math.hypot(n.x, n.y, n.z)
  if (!(length > 0)) return { x: 0, y: 1, z: 0 }
  const sign = n.y < 0 ? -1 : 1
  return { x: (n.x / length) * sign, y: (n.y / length) * sign, z: (n.z / length) * sign }
}

const offset = (p: Vec3, direction: Vec3, distance: number): Vec3 => ({
  x: p.x + direction.x * distance,
  y: p.y + direction.y * distance,
  z: p.z + direction.z * distance,
})

const shrink = (p: Vec3, about: Vec3, factor: number): Vec3 => ({
  x: about.x + (p.x - about.x) * factor,
  y: about.y + (p.y - about.y) * factor,
  z: about.z + (p.z - about.z) * factor,
})

function hullPath(points: Vec2[]) {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

export { MotionPlatform }
