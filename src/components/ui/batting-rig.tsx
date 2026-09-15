"use client"

/**
 * batting-rig — a bat, a ball, and the collision between them, solved.
 *
 * Drawn looking down, because that is the plane the argument lives in. The bat
 * turns about the knob, so the barrel's speed is `ω·r` and climbs all the way
 * to the tip. The mass the ball actually meets does the opposite: a blow away
 * from the centre of mass spins the bat as well as pushing it, so
 * `1/M = 1/m + d²/I` and `M` collapses out at the end. Feed both into
 *
 *     v_out = ((e·M − m)·v_pitch + M(1 + e)·v_bat) / (M + m)
 *
 * and the best contact is neither the centre of mass nor the tip but somewhere
 * between — which is where the sweet spot comes from, rather than being a
 * number someone typed on the barrel. The rig marks it, and marks where this
 * swing is actually meeting the ball.
 *
 * `stance` is the mechanism: how far the rig stands off the line decides where
 * on the barrel the ball arrives, because the bat can only cross the line at
 * one angle. Stand close and it is jammed on the handle; stand off and it is
 * off the end. Both are visibly worse, and the readout says by how much.
 *
 * The maths is in `src/lib/robocn/sport.ts` — pure, no React, tested on its
 * own. Illustrated: the swing's shape through the zone, which is an eased
 * sweep rather than a torque model, and the ball's line, which is straight
 * because a pitch is `robot-baseball`'s job, not this machine's.
 */

import * as React from "react"

import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  barrelRadius,
  defaultBat,
  effectiveMass,
  sweetSpot,
  swingAngle,
  swingImpact,
} from "@/lib/robocn/sport"
import {
  fitTransform,
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

/** What the rig does with nobody driving it. Always includes `static`. */
export type BattingRigBehavior = "swing" | "load" | "check" | "static"

const VIEW_WIDTH = 220
const VIEW_HEIGHT = 240
/** The bottom strip the readout sits in; the drawing is fitted above it. */
const TEXT_ROOM = 30
const NATIVE_VIEW: RobotView = "plan"

/** The swing plane stands this far off the ground, so the tipped views read. */
const SWING_HEIGHT = 30
/** Where the pivot sits down the line from the plate. */
const PIVOT_Z = 8
/** The sweep: cocked behind, through the zone, out into the follow-through. */
const SWING_FROM = -245
const SWING_TO = -45
const CONTACT_AT = 0.52
/** The one angle at which the bat can cross the line, given that sweep. */
const CONTACT_ANGLE = swingAngle(CONTACT_AT, SWING_FROM, SWING_TO, CONTACT_AT)

const PITCH_FROM = -96
/** How far a struck ball is followed before the drawing lets it go. */
const FOLLOW = 96
const PITCH_SPEED = 200
const SWING_RATE = 0.9
const RESTITUTION = 0.5
/**
 * What every camera has to fit. A bounding *box* is far too loose here — its
 * corners are places the machine never reaches, and under a three-quarter
 * camera that wastes most of the frame. So the envelope is the real thing: the
 * circle the bat tip can actually trace, at both ends of the machine's height,
 * plus the ball's line in and the exit ray out.
 */
const ENVELOPE: Vec3[] = [0, SWING_HEIGHT].flatMap((height) => [
  ...Array.from({ length: 32 }, (_, index) => {
    const a = (index / 32) * Math.PI * 2
    return {
      x: 44 + Math.cos(a) * defaultBat.length,
      y: height,
      z: PIVOT_Z + Math.sin(a) * defaultBat.length,
    }
  }),
  { x: 0, y: height, z: PITCH_FROM },
  { x: 84, y: height, z: -116 },
])

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const descriptions: Record<BattingRigBehavior, string> = {
  swing: "swinging through the zone",
  load: "loading and holding short of the zone",
  check: "checking the swing before contact",
  static: "held at the load",
}

/**
 * Every behaviour is a pure function of the clock, exported so motion is tested
 * by sampling it rather than by faking animation frames.
 */
export function battingRigPhase(behavior: BattingRigBehavior, clock: number): number {
  if (!Number.isFinite(clock)) return 0
  const cycle = ((clock % 1) + 1) % 1
  switch (behavior) {
    case "swing":
      return cycle
    case "load":
      // Loads to the edge of the zone and rocks there, never committing.
      return CONTACT_AT * 0.72 * (0.5 - Math.cos(cycle * Math.PI * 2) / 2)
    case "check":
      // Starts the swing and pulls it back short of contact.
      return cycle < 0.5 ? cycle * CONTACT_AT * 1.7 : (1 - cycle) * CONTACT_AT * 1.7
    default:
      return 0
  }
}

/**
 * Where on the barrel a rig standing `stance` off the line meets the ball. The
 * bat crosses the line at exactly one angle, so `r·cos θ = −stance` fixes it,
 * and where you stand is the only thing that moves it.
 */
export function battingContact(stance: number): number {
  const off = clamp(Number.isFinite(stance) ? stance : 34, 22, 44)
  return clamp(
    -off / Math.cos(toRadians(CONTACT_ANGLE)),
    defaultBat.length * 0.3,
    defaultBat.length,
  )
}

/** What that contact does to the ball, and the best this swing could do. */
export function battingImpact(stance: number, swingRate = SWING_RATE) {
  const contact = battingContact(stance)
  const options = {
    bat: defaultBat,
    contact,
    swingRate: clamp(Number.isFinite(swingRate) ? swingRate : SWING_RATE, 0.1, 4),
    pitchSpeed: PITCH_SPEED,
    restitution: RESTITUTION,
  }
  return {
    contact,
    ...swingImpact(options),
    best: sweetSpot(options),
  }
}

export interface RobotBattingRigProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled swing phase, 0 at the load to 1 through the follow. Stops the loop. */
  swing?: number
  onSwingChange?: (swing: number) => void
  behavior?: BattingRigBehavior
  /**
   * How far the rig stands off the line. This is the mechanism: it decides
   * where on the barrel the ball arrives, because the bat crosses the line at
   * one angle and one only.
   */
  stance?: number
  /** Revolutions a second through the zone. */
  swingRate?: number
  /** Mark where this swing does its best work. */
  showSweetSpot?: boolean
  showBall?: boolean
  /** Where the camera stands. Defaults to the view it was drawn in. */
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function BattingRig({
  swing,
  onSwingChange,
  behavior = "swing",
  stance = 34,
  swingRate = SWING_RATE,
  showSweetSpot = true,
  showBall = true,
  view = NATIVE_VIEW,
  speed = 0.5,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
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
}: RobotBattingRigProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = swing !== undefined

  const clock = useRobotClock({
    speed,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase,
  })
  const pinned = controlled
    ? Number.isFinite(swing) ? clamp(swing as number, 0, 1) : 0
    : held
  const cycle = pinned ?? battingRigPhase(behavior, clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onSwingChange?.(bounded)
    },
    [onSwingChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  // Where the rig stands decides where on the barrel the ball arrives.
  const off = clamp(Number.isFinite(stance) ? stance : 34, 22, 44)
  const pivot = { x: off, z: PIVOT_Z }
  const { contact, best, ...impact } = battingImpact(off, swingRate)

  const angle = swingAngle(cycle, SWING_FROM, SWING_TO, CONTACT_AT)
  const radians = toRadians(angle)
  const along = { x: Math.cos(radians), z: Math.sin(radians) }
  const across = { x: -Math.sin(radians), z: Math.cos(radians) }

  const camera = robotCamera(view)
  const fitted = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - TEXT_ROOM)
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  /** A point in the swing plane, from its own flat coordinates. */
  const inPlane = (x: number, z: number, height = SWING_HEIGHT) => to({ x, y: height, z })
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  const onBat = (distance: number, side = 0) => ({
    x: pivot.x + along.x * distance + across.x * side,
    z: pivot.z + along.z * distance + across.z * side,
  })
  // One outline for the whole bat: out along one edge, back along the other.
  const batOutline = [
    ...Array.from({ length: 26 }, (_, index) => {
      const s = index / 25
      const point = onBat(s * defaultBat.length, barrelRadius(defaultBat, s))
      return inPlane(point.x, point.z)
    }),
    ...Array.from({ length: 26 }, (_, index) => {
      const s = 1 - index / 25
      const point = onBat(s * defaultBat.length, -barrelRadius(defaultBat, s))
      return inPlane(point.x, point.z)
    }),
  ]

  const contactAngleRadians = toRadians(CONTACT_ANGLE)
  const meeting = {
    x: pivot.x + Math.cos(contactAngleRadians) * contact,
    z: pivot.z + Math.sin(contactAngleRadians) * contact,
  }
  // The ball leaves along the face normal, which is the way the barrel is
  // moving — so early or late contact sprays it differently, geometrically.
  const exit = { x: -Math.sin(contactAngleRadians), z: Math.cos(contactAngleRadians) }
  const struck = cycle >= CONTACT_AT && behavior !== "check" && behavior !== "load"
  // Followed only as far as the frame goes; the speed is in the readout.
  const flown = Math.min(impact.exitSpeed * (cycle - CONTACT_AT) * 0.55, FOLLOW)
  const ball = struck
    ? { x: meeting.x + exit.x * flown, z: meeting.z + exit.z * flown }
    : {
        x: 0,
        z: lerp(PITCH_FROM, meeting.z, clamp(cycle / CONTACT_AT, 0, 1)),
      }

  const arc = Array.from({ length: 41 }, (_, index) => {
    const a = toRadians(lerp(SWING_FROM, SWING_TO, index / 40))
    return inPlane(pivot.x + Math.cos(a) * contact, pivot.z + Math.sin(a) * contact)
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const sweetness = Math.round(impact.sweetness * 100)
  const readout = `${Math.round(impact.exitSpeed)} U·S`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Batting rig, ${descriptions[behavior] ?? descriptions.static}, contact ${Math.round(contact)} from the knob at ${sweetness} percent of its best, ${viewNames[view] ?? viewNames.plan}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(cycle) : undefined}
      aria-valuetext={interactive ? `${Math.round(cycle * 100)} percent through the swing` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.04, 0.2)
        if (delta !== 0) apply(cycle + delta)
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
      <g data-view={view} data-behavior={behavior} transform={fitted || undefined}>
        <path
          data-plate
          d={line(
            [
              { x: -9, z: 9 },
              { x: 9, z: 9 },
              { x: 9, z: -1 },
              { x: 0, z: -10 },
              { x: -9, z: -1 },
            ].map((p) => to({ x: p.x, y: 0, z: p.z })),
            true,
          )}
          fill={palette.dark}
          opacity={0.25}
        />
        <path
          data-line
          d={line([to({ x: 0, y: 0, z: PITCH_FROM }), to({ x: 0, y: 0, z: 12 })])}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.7}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        <path
          data-arc
          d={line(arc)}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.8}
          strokeDasharray="2 3"
          opacity={0.7}
        />

        {/* The rig itself: a column up to the swing plane, and the pivot on it. */}
        <g data-column>
          <path
            d={line([to({ x: pivot.x, y: 0, z: pivot.z }), inPlane(pivot.x, pivot.z)])}
            fill="none"
            stroke={palette.metal}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
          <circle
            cx={px(to({ x: pivot.x, y: 0, z: pivot.z }).x)}
            cy={px(to({ x: pivot.x, y: 0, z: pivot.z }).y)}
            r={7}
            {...cast}
          />
        </g>

        <g data-bat data-joint="pivot">
          <path d={line(batOutline, true)} {...shell} />
          {/* Small enough that the knob still shows past it in the unfilled
              variants, where the ring would otherwise swallow the bat's end. */}
          <circle
            cx={px(inPlane(pivot.x, pivot.z).x)}
            cy={px(inPlane(pivot.x, pivot.z).y)}
            r={3}
            {...machined}
          />
        </g>

        {showSweetSpot && (
          <g data-sweet>
            {/* Where this swing does its best work, marked on the live barrel. */}
            <circle
              cx={px(inPlane(onBat(best.contact).x, onBat(best.contact).z).x)}
              cy={px(inPlane(onBat(best.contact).x, onBat(best.contact).z).y)}
              r={3.2}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.4}
            />
            <circle
              data-contact
              cx={px(inPlane(onBat(contact).x, onBat(contact).z).x)}
              cy={px(inPlane(onBat(contact).x, onBat(contact).z).y)}
              r={1.7}
              fill={palette.accent}
            />
          </g>
        )}

        {/* The ray belongs to the moment of contact, so it only exists after
            it — otherwise it reads as a line floating beside a bat that has
            not hit anything yet. It is anchored at the meeting point, which is
            marked, rather than at the contact dot travelling with the barrel. */}
        {struck && (
          <g data-exit>
            <path
              d={line([
                inPlane(meeting.x, meeting.z),
                inPlane(
                  meeting.x + exit.x * Math.min(impact.exitSpeed * 0.16, FOLLOW),
                  meeting.z + exit.z * Math.min(impact.exitSpeed * 0.16, FOLLOW),
                ),
              ])}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1.2}
              strokeDasharray="3 3"
              opacity={px(clamp(impact.sweetness, 0.25, 1))}
            />
            <circle
              data-meeting
              cx={px(inPlane(meeting.x, meeting.z).x)}
              cy={px(inPlane(meeting.x, meeting.z).y)}
              r={2.4}
              fill="none"
              stroke={palette.accent}
              strokeWidth={1}
              opacity={0.8}
            />
          </g>
        )}

        {showBall && (
          <circle
            data-ball
            cx={px(inPlane(ball.x, ball.z).x)}
            cy={px(inPlane(ball.x, ball.z).y)}
            r={4.6}
            {...machined}
          />
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 15} fontSize={5.5}>
          {`EXIT ${readout} / M ${Math.round(effectiveMass(defaultBat, contact) * 100) / 100} / ${sweetness}% SWEET`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 6} fontSize={4.8} opacity={0.75}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

export { BattingRig }
