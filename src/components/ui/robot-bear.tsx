"use client"

/**
 * robot-bear — the machine that stands up, and the arithmetic that lets it.
 *
 * Every other quadruped in this set stands on points: a pad at the end of each
 * chain, four dots on a line, nothing that could be called a base. This one is
 * **plantigrade** — `solveSole` puts a rigid heel-to-toe segment on the floor
 * and solves the leg to the ankle that placement produces — so each foot is an
 * *interval*, and `solveSupport` unions them into a base of support with edges.
 *
 * That is what makes `rear` a mechanism rather than a pose. Taking it up lifts
 * the forelimbs, so the base collapses from four soles to two, and tips the
 * whole body about the hip, so the centre of mass travels forward out over a
 * base that just got much shorter. Left alone the margin goes negative and the
 * animal falls on its face; `balance` hands the correction to the arithmetic,
 * which slides the body back over its own feet until the margin is positive
 * again. Rear it with `balance` at 0 and it topples, and says so.
 *
 * The hump is the second derived part: it swells with the load on the
 * forelimbs, because that is the muscle that drives them.
 *
 * Design note: docs/ursine-robots.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  plantigradeStep,
  solveSole,
  solveSupport,
  type SolePose,
  type SupportContact,
} from "@/lib/robocn/bear"
import {
  clamp,
  lerp,
  lerp2,
  rotate2,
  solveChain2,
  toDegrees,
  toRadians,
  type Vec2,
} from "@/lib/robocn/kinematics"
import { solveSpine, spineLimits, type SpinePose } from "@/lib/robocn/spine"
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
import { cn } from "@/lib/utils"

export type BearBehavior = "amble" | "rear" | "forage" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/** Where the hip stands in the frame, and the floor underneath it. */
const ORIGIN = 74
const GROUND = 140
/** Half the track: the limbs are either side of the trunk. */
const HALF_TRACK = 15

/** Croup to withers along the back. A bear is short-coupled and very deep. */
const TRUNK = 56
/** Femur then tibia to the ankle, and the sole below it. Short, heavy columns. */
const HIND = [20, 18] as const
const HIND_SOLE = { heel: 7, toe: 12, ankle: 5 } as const
/** Humerus then radius, and the shorter forefoot. */
const FORE = [18, 16] as const
const FORE_SOLE = { heel: 5, toe: 10, ankle: 4.5 } as const
/** Cervical chain: withers to the poll. Short and thick — the head rides low. */
const NECK = [9, 8] as const

/** Where each sole stands along the floor when the animal is square. */
const HIND_STANCE = 2
const FORE_STANCE = 48
/** Hip height standing square, fully crouched, and reared. */
const STAND = 41
const CROUCH = 32
const REARED = 45
/** How far a full rear tips the whole animal about its hip, in degrees. */
const REAR_PITCH = 64
/** How far the balance rule may slide the body over its own feet. */
const SHIFT_LIMIT = 22
/** Hump height over the withers, unloaded and at a full forelimb load. */
const HUMP = { min: 2, max: 11 } as const
/** The share one forelimb carries standing square; the hump is measured against it. */
const RESTING_FORE = 0.29
/** Units per second the rear eases back at when a drag is released. */
const REAR_RATE = 1.1

/** How far the camera pulls back so the machine still fits a frame drawn for one view. */
const fits: Record<RobotView, number> = { plan: 0.78, front: 0.9, profile: 1, iso: 0.82 }
/** Framing only, in viewBox units: the hip sits at the tail end of a long body. */
const framing: Record<RobotView, number> = { plan: -16, front: 0, profile: 0, iso: -8 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface BearLeg extends SolePose {
  id: LegId
  side: "left" | "right"
  fore: boolean
  /** Share of the standing weight this sole is carrying, 0 in the air. */
  load: number
}

/**
 * The lateral-sequence walk. A bear moves the two limbs on one side close
 * together — near hind, then near fore a tenth of a stride later — which is the
 * rolling amble it is known for, and which no diagonal walker in this set does.
 */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "hind-left", side: "left", fore: false, offset: 0 },
  { id: "fore-left", side: "left", fore: true, offset: 0.12 },
  { id: "hind-right", side: "right", fore: false, offset: 0.5 },
  { id: "fore-right", side: "right", fore: true, offset: 0.62 },
]

export interface RobotBearProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when nothing is driving it. */
  behavior?: BearBehavior
  /** Controlled stride fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Strides, or rises, per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  offset?: number
  /** 0 on four soles to 1 standing on the hind pair. Omit and the behavior works it. */
  rear?: number
  /** How much of the body's carriage the balance rule takes, 0 scripted to 1 derived. */
  balance?: number
  /** Back curvature, −1 hollowed to 1 roached. Omit and the behavior sets it. */
  arch?: number
  /** Leg fold, 0 standing tall to 1 down on the hocks. Omit and the behavior decides. */
  crouch?: number
  /** Hump height in world units. Omit and the forelimb load drives it. */
  hump?: number
  /** How hard the near forepaw rakes the floor, 0–1. */
  dig?: number
  /** Ears, −1 flattened back to 1 pricked. Omit and the behavior sets them. */
  ears?: number
  /** Head and eye aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** Drag up and down to rear it; the head tracks the pointer. */
  interactive?: boolean
  onRearChange?: (rear: number) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the soles carrying weight. */
  showContacts?: boolean
  /** Draw the base of support, the centre of mass, and the margin between them. */
  showSupport?: boolean
  label?: string
}

function RobotBear({
  behavior = "amble",
  phase,
  view = NATIVE_VIEW,
  speed = 0.4,
  animate = true,
  paused = false,
  offset = 0,
  rear,
  balance,
  arch,
  crouch,
  hump,
  dig,
  ears,
  gaze,
  interactive = true,
  onRearChange,
  size = "md",
  variant = "solid",
  showGround = true,
  showContacts = false,
  showSupport = false,
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
}: RobotBearProps) {
  const controlledRear = rear !== undefined
  const controlledPhase = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlledRear ? finiteClamp(rear, 0, 1, 0) : held

  const rate = Number.isFinite(speed) ? speed : 0
  const goal = React.useCallback(
    (seconds: number) => bearBehaviorPose(behavior, seconds).stance(seconds * rate).rear,
    [behavior, rate],
  )
  const motion = useRobotScalar(goal, {
    rate: REAR_RATE,
    hold,
    speed: 1,
    paused,
    phase: offset,
    animate: animate && !controlledPhase && behavior !== "static",
  })
  const clock = motion.clock
  const scripted = bearBehaviorPose(behavior, clock)
  const cycle = controlledPhase ? (Number.isFinite(phase) ? phase : 0) : clock * rate
  const stance = scripted.stance(cycle)
  // A controlled `rear` wins; a grabbed one is next; a controlled cycle is a
  // still, so the scripted rise at that cycle is the answer. Otherwise the
  // eased scalar, which is what makes a release settle rather than snap.
  const rise = finiteClamp(
    controlledRear ? rear : controlledPhase ? stance.rear : motion.value,
    0,
    1,
    0,
  )

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Number(clamp(next, 0, 1).toFixed(3))
      setHeld(bounded)
      onRearChange?.(bounded)
    },
    [onRearChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && !controlledRear,
    // The top three-quarters of the box is the whole range: a gesture worth making.
    onDrag: React.useCallback((unit: Vec2) => apply((0.85 - unit.y) / 0.7), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp((unit.x - 0.5) * 2.2, -1, 1),
        y: clamp((0.5 - unit.y) * 2, -1, 1),
      }),
      [],
    ),
  })

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const weight = finiteClamp(balance ?? scripted.balance, 0, 1, scripted.balance)
  const rake = finiteClamp(dig ?? stance.dig, 0, 1, stance.dig)
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const earAim = finiteClamp(ears ?? scripted.ears, -1, 1, 0)

  /* ---- the back, tipped about the hip ------------------------------------ */

  const hipHeight = lerp(lerp(STAND, CROUCH, fold), REARED, rise)
  // A bear holds a topline, so the same restrained curvature the dog and the
  // fox use: positive roaches the back, negative hollows it.
  const curvature = bow * 0.2
  // Half the solver's arc, run back from the croup, puts the crown in the
  // middle with both ends level; the rear rides on top of it.
  const tilt = -(curvature * spineLimits.turn) / 2 + rise * REAR_PITCH
  const pitched = tiltPose(
    solveSpine({
      // Ten segments rather than six: the hump is a curve on the topline, and
      // six joints draw it as a corner.
      segments: 10,
      length: TRUNK,
      phase: cycle,
      amplitude: scripted.flex,
      waves: 0.8,
      taper: 0.15,
      turn: curvature,
    }),
    tilt,
  )
  // Re-hanging the chain on its last joint is what makes the rear a rotation
  // about the hip: the croup is the one point that does not move.
  const croup = pitched.joints[pitched.joints.length - 1].position
  /** The trunk in hip-relative units, before the balance rule slides it. */
  const local = (index: number): Vec2 => ({
    x: pitched.joints[index].position.x - croup.x,
    y: pitched.joints[index].position.y - croup.y + hipHeight,
  })

  /* ---- where the mass is, and where the feet are -------------------------- */

  // A weighted mean over the trunk and the head. Crude by design: it is a
  // static centre of mass, not an inertia tensor, and the docs say so.
  const massPoints = pitched.joints.map((joint, index) => ({
    point: local(index),
    weight: 1 + 0.5 * Math.sin(Math.PI * joint.s),
  }))
  const crest = pitched.joints[0].angle
  const localWithers = local(0)
  const headAt = alongBody(localWithers, crest, 24, 15)
  massPoints.push({ point: headAt, weight: 1.6 })
  const massTotal = massPoints.reduce((sum, entry) => sum + entry.weight, 0)
  const comLocal = {
    x: massPoints.reduce((sum, entry) => sum + entry.point.x * entry.weight, 0) / massTotal,
    y: massPoints.reduce((sum, entry) => sum + entry.point.y * entry.weight, 0) / massTotal,
  }

  // The feet are placed in the world, and they stay where they are put: the
  // body is what slides over them.
  const steps = legPlan.map(({ id, fore, offset: legOffset }) => {
    const walking = stance.stride >= 0 && stance.stride <= 1.5
    const step = walking
      ? plantigradeStep(stance.stride + legOffset, { reach: fore ? 11 : 13, clearance: 9 })
      : { plant: { x: 0, y: 0 }, pivot: "flat" as const, pitch: 0, roll: "flat" as const, contact: true }
    const digging = fore && id === "fore-left" ? rake : 0
    const nominal = fore ? FORE_STANCE : HIND_STANCE
    return {
      id,
      x: nominal + step.plant.x + digging * 7,
      y: step.plant.y,
      pivot: step.pivot,
      pitch: step.pitch - digging * 22,
      airborne: !step.contact,
    }
  })

  /** What each sole would cover if it is on the floor, before any leg is solved. */
  const intended: SupportContact[] = steps.map((step, index) => {
    const sole = legPlan[index].fore ? FORE_SOLE : HIND_SOLE
    const lifted = step.airborne || (legPlan[index].fore && rise > 0.06)
    if (lifted) return { id: step.id, span: null }
    const back = step.pivot === "heel" ? step.x : step.x - (step.pivot === "toe" ? sole.heel + sole.toe : sole.heel)
    return { id: step.id, span: [back, back + sole.heel + sole.toe] }
  })
  const preview = solveSupport(intended, comLocal.x)
  const centre = preview.span ? (preview.span[0] + preview.span[1]) / 2 : comLocal.x
  // The balance rule: slide the whole body back over its own feet until the
  // centre of mass is where the base of support can hold it. Proportional, with
  // no gain and no lag — a rule, not a controller.
  const shift = clamp(centre - comLocal.x, -SHIFT_LIMIT, SHIFT_LIMIT) * weight
  const hip: Vec2 = { x: shift, y: hipHeight }
  const spinePoint = (index: number): Vec2 => {
    const point = local(index)
    return { x: point.x + shift, y: point.y }
  }
  const withers = spinePoint(0)
  const com = { x: comLocal.x + shift, y: comLocal.y }

  // Where the shoulder rides: one joint back from the withers and down the
  // body's own normal, so the trunk carries it through the rear.
  const thorax = pitched.joints[1]
  const under = toRadians(thorax.angle + 90)
  const shoulder: Vec2 = {
    x: spinePoint(1).x - Math.cos(under) * 8,
    y: spinePoint(1).y - Math.sin(under) * 8,
  }

  /* ---- four plantigrade limbs -------------------------------------------- */

  const soles = legPlan.map(({ id, fore }, index) => {
    const step = steps[index]
    const root = fore ? shoulder : hip
    const links = fore ? FORE : HIND
    const sole = fore ? FORE_SOLE : HIND_SOLE
    // A reared forelimb has no floor to reach for, so it draws in under the
    // chest instead of hanging at full stretch. Keyed to `rear`, not the clock.
    const tuck = fore
      ? { x: shoulder.x + 9, y: Math.max(8, shoulder.y - 24) }
      : { x: step.x, y: step.y }
    const drawIn = fore ? rise : 0
    return solveSole({
      hip: root,
      plant: { x: lerp(step.x, tuck.x, drawIn), y: lerp(step.y, tuck.y, drawIn) },
      pivot: step.pivot,
      pitch: lerp(step.pitch, -52, drawIn),
      femur: links[0],
      tibia: links[1],
      heel: sole.heel,
      toe: sole.toe,
      ankle: sole.ankle,
      bend: fore ? "down" : "up",
    })
  })

  const support = solveSupport(
    soles.map((sole, index) => ({ id: legPlan[index].id, span: sole.span })),
    com.x,
  )
  const legs: BearLeg[] = soles.map((sole, index) => ({
    ...sole,
    id: legPlan[index].id,
    side: legPlan[index].side,
    fore: legPlan[index].fore,
    load: support.loads[legPlan[index].id] ?? 0,
  }))

  // The hump is the muscle that drives the foreleg into the ground, so it is an
  // output of what the forelegs are carrying — flat when they carry nothing.
  const foreLoad = legs
    .filter((leg) => leg.fore)
    .reduce((sum, leg) => Math.max(sum, leg.load), 0)
  const humpHeight = finiteClamp(
    hump ?? lerp(HUMP.min, HUMP.max, clamp(foreLoad / RESTING_FORE, 0, 1)),
    0,
    14,
    HUMP.min,
  )

  /* ---- neck solved to the poll, head hung off the end of it --------------- */

  // A bear's neck is short and thick and the head is carried *below* the hump,
  // which is what puts the highest point of the animal over its shoulders.
  const nape = alongBody(withers, crest, 2, 4)
  const target = alongBody(withers, crest, 19, 2 - rise * 2)
  const [, cervical, poll] = solveChain2(nape, target, [...NECK], { bend: "up" })
  const headTilt = toDegrees(Math.atan2(poll.y - cervical.y, poll.x - cervical.x)) + aim * 7 - 12

  /* ---- paint -------------------------------------------------------------- */

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const supportColor = support.stable ? palette.accent : palette.shell

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const slide = framing[view] ?? 0
  const face = aboutPoint(camera.wall(0, 90), ORIGIN, GROUND, fit)
  const framed = [slide ? `translate(0 ${px(slide)})` : "", face].filter(Boolean).join(" ")
  const Frame = (framed ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = framed ? { transform: framed } : {}
  /** A point in the animal's own frame, `across` units off the centre plane. */
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)

  // The topline: level over a deep body, with the hump standing over the
  // withers as the highest point on the animal.
  const backline = (s: number) =>
    13.5 + 2.5 * s + humpHeight * Math.exp(-((s - 0.2) ** 2) / 0.014)
  const bellyline = (s: number) =>
    s < 0.42 ? lerp(17, 13, s / 0.42) : lerp(13, 16.5, (s - 0.42) / 0.58)

  const readout = Math.round(rise * 100)
  const state = dragging
    ? "reared by hand"
    : rise > 0.55
      ? "standing on its hind legs"
      : behavior === "amble"
        ? "ambling"
        : behavior === "forage"
          ? "foraging"
          : behavior === "rear"
            ? "rearing"
            : "standing"

  /** One limb, in the animal's own y-up frame. */
  function legDrawing(leg: BearLeg) {
    const far = leg.side === "right"
    const shift2 = far ? -7 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift2, y: p.y })
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.52 : 1}>
        <path d={capsulePath(move(leg.hip), move(leg.knee), leg.fore ? 8 : 9)} {...shell} />
        <path d={capsulePath(move(leg.knee), move(leg.ankle), leg.fore ? 6.4 : 7)} {...machined} />
        {/* The sole: a segment on the floor, which is the whole claim. */}
        <g data-sole={leg.id} data-contact-state={leg.contact}>
          <path d={capsulePath(move(leg.heel), move(leg.toe), 3.6)} {...cast} />
          {/* Claws, on the toe end, drawn not solved. */}
          {[0.6, 0.78, 0.96].map((t) => {
            const nose = lerp2(move(leg.heel), move(leg.toe), t)
            return (
              <circle key={t} cx={px(nose.x + 1.4)} cy={px(nose.y - 1.2)} r={0.9} fill={palette.metal} />
            )
          })}
        </g>
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.knee).x)}
          cy={px(move(leg.knee).y)}
          r={4}
          {...cast}
        />
        <circle
          data-joint={`${leg.id}-ankle`}
          cx={px(move(leg.ankle).x)}
          cy={px(move(leg.ankle).y)}
          r={3}
          {...cast}
        />
        {leg.fore && (
          <circle
            data-joint={`${leg.id}-shoulder`}
            cx={px(move(leg.hip).x)}
            cy={px(move(leg.hip).y)}
            r={3.6}
            {...cast}
          />
        )}
        {showContacts && leg.span && (
          <rect
            data-contact
            x={px(Math.min(leg.span[0], leg.span[1]) + shift2)}
            y={-2.4}
            width={px(Math.max(1.6, Math.abs(leg.span[1] - leg.span[0])))}
            height={2}
            rx={1}
            fill={palette.accent}
            opacity={px(0.3 + 0.6 * leg.load)}
          />
        )}
        {/* A sole that cannot make the floor is drawn as what it is. */}
        {!leg.reached && leg.fore && (
          <circle cx={px(move(leg.toe).x)} cy={px(move(leg.toe).y)} r={1.3} fill={palette.metal} opacity={0.5} />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot bear, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent reared` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox="0 0 230 168"
      width={width}
      height={px((width * 168) / 230)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || controlledRear || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(rise + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d={`M 10 ${GROUND} H 220 M ${ORIGIN} 14 V ${GROUND + 12}`} strokeDasharray="2 3" />
          {/* The reach the forelimb fold is keyed to. */}
          <circle
            cx={px(ORIGIN + shoulder.x)}
            cy={px(GROUND - shoulder.y)}
            r={px(FORE[0] + FORE[1])}
            strokeDasharray="3 4"
          />
        </g>
      )}

      {showGround && (
        <g data-ground>
          <path d={`M 12 ${GROUND} H 218`} stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={px(ORIGIN + 24)}
            cy={GROUND + 3}
            rx={px(48 - rise * 17)}
            ry={4.4}
            fill={palette.dark}
            opacity={0.15}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${px(GROUND + slide)}) scale(${px(fit)})`}>
          {pitched.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 5, 5).map((p) => ({
              x: p.x,
              y: p.y - midX,
            }))
            return (
              <path
                key={index}
                d={extrudedPath(footprint, camera, midY + backline(joint.s) * 0.55, midY - bellyline(joint.s) * 0.55)}
                {...shell}
              />
            )
          })}
          {([-HALF_TRACK, HALF_TRACK] as const).map((across) => (
            <g key={across}>
              {legs.map((leg) => (
                <g key={leg.id}>
                  <path
                    d={capsulePath(at(leg.hip, across * 0.7), at(leg.knee, across), leg.fore ? 6.4 : 7.4)}
                    {...shell}
                  />
                  <path d={capsulePath(at(leg.knee, across), at(leg.ankle, across), leg.fore ? 5 : 5.6)} {...machined} />
                  {/* The sole as a rectangle on the floor rather than a line:
                      the one thing only an off-axis camera can say. */}
                  <path
                    d={extrudedPath(
                      roundedFootprint(leg.fore ? 4.6 : 5.6, (leg.fore ? FORE_SOLE.heel + FORE_SOLE.toe : HIND_SOLE.heel + HIND_SOLE.toe) / 2, 2, 2).map((p) => ({
                        x: p.x + across,
                        y: p.y - (leg.heel.x + leg.toe.x) / 2,
                      })),
                      camera,
                      (leg.heel.y + leg.toe.y) / 2 + 1.6,
                      (leg.heel.y + leg.toe.y) / 2 - 1.6,
                    )}
                    {...cast}
                  />
                </g>
              ))}
            </g>
          ))}
          <path d={capsulePath(at(nape), at(cervical), 7)} {...machined} />
          <path d={capsulePath(at(cervical), at(poll), 6)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(7.5, 12, 5, 5).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 7,
              poll.y - 7,
            )}
            {...shell}
          />
        </g>
      )}

      <Frame {...frame}>
        {/* The drawing works in the animal's own frame: x forward, y up. */}
        <g data-bear data-view={view} data-rear={px(rise)} transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}>
          {legs.filter((leg) => leg.side === "right").map(legDrawing)}

          <g data-trunk>
            {/* The two ends of the barrel as solids, so the rump is round and
                the shoulder is heavy rather than the outline tapering to a point. */}
            {([0, pitched.joints.length - 1] as const).map((index) => {
              const joint = pitched.joints[index]
              const place = spinePoint(index)
              const normal = toRadians(joint.angle + 90)
              const radius = (backline(joint.s) + bellyline(joint.s)) / 2
              const nudge = (backline(joint.s) - bellyline(joint.s)) / 2
              return (
                <circle
                  key={index}
                  cx={px(place.x + Math.cos(normal) * nudge)}
                  cy={px(place.y + Math.sin(normal) * nudge)}
                  r={px(radius)}
                  {...shell}
                />
              )
            })}
            <path data-spine d={bodyOutline(pitched, spinePoint, backline, bellyline)} {...shell} />
            {/* The hump, marked: it is a mechanism, not a shape. */}
            <path
              data-hump
              d={humpPath(pitched, spinePoint, backline, humpHeight)}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.9}
              opacity={0.3}
            />
            {/* One seam down the flank, and nothing more. */}
            <path
              d={offsetLine(pitched, spinePoint, (t) => -(7 - 3 * Math.sin(Math.PI * t)))}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.7}
              opacity={0.25}
            />
          </g>

          <path data-neck d={capsulePath(nape, cervical, 7)} {...machined} />
          <path d={capsulePath(cervical, poll, 6)} {...machined} />

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            {/* Small round ears set well back — the bear's whole head signature. */}
            {/* Small round ears, set wide on the back of a broad skull: with the
                muzzle they are the whole signature at 150px. */}
            <g data-ears>
              {([
                { id: "left" as const, across: 2.5, opacity: 1 },
                { id: "right" as const, across: -4.5, opacity: 0.55 },
              ]).map(({ id, across, opacity }) => (
                <g key={id} opacity={opacity}>
                  <circle
                    data-ear={id}
                    cx={px(-5.5 + across * 0.4 - earAim * 1.4)}
                    cy={px(8.5 + across * 0.5 + earAim * 1.4)}
                    r={4.6}
                    {...shell}
                  />
                  <circle
                    cx={px(-4.6 + across * 0.4 - earAim * 1.4)}
                    cy={px(8.2 + across * 0.5 + earAim * 1.4)}
                    r={2.3}
                    {...cast}
                  />
                </g>
              ))}
            </g>
            {/* Broad deep skull, and a short blunt muzzle straight off the front
                of it — not a wedge and not a snout. */}
            <path d="M -10 -6.5 Q -11.5 8 -1 10 Q 9 9.5 12 4.5 Q 14 -1.5 10.5 -7 Q 3 -11 -3.5 -11 Q -9.5 -10.5 -10 -6.5 Z" {...shell} />
            <path data-muzzle d="M 10 -6 Q 19.5 -5.6 21 -2 L 21 2.6 Q 19 5.4 10 5.6 Z" {...machined} />
            <path d="M 10 2 Q 16.5 2.6 20.5 3 L 20.5 4.4 Q 15.5 5 10 4.8 Z" {...cast} />
            <ellipse cx={20.2} cy={-1.6} rx={2.1} ry={2.4} fill={palette.dark} />
            <g data-eyes>
              <g transform="translate(1.2 3.4)" opacity={0.5}>
                <circle r={2} {...cast} />
                <circle cx={px(0.7 + aim * 0.8)} r={0.95} fill={palette.accent} />
              </g>
              <g transform="translate(4.8 0.4)">
                <circle r={2.4} {...cast} />
                <circle cx={px(0.9 + aim * 1.1)} r={1.25} fill={palette.accent} />
              </g>
            </g>
          </g>

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          <g data-joints>
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={5.4} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={2} fill={palette.metal} />
          </g>

          {showSupport && (
            <g data-support data-stable={support.stable}>
              {support.span && (
                <rect
                  x={px(support.span[0])}
                  y={-4.6}
                  width={px(Math.max(1.5, support.span[1] - support.span[0]))}
                  height={2.2}
                  rx={1.1}
                  fill={supportColor}
                  opacity={0.75}
                />
              )}
              {/* The plumb line: where the mass is, against the base holding it. */}
              <path
                data-com
                d={`M ${px(com.x)} ${px(com.y)} V 0`}
                stroke={supportColor}
                strokeWidth={0.8}
                strokeDasharray="2 2.5"
                fill="none"
                opacity={0.8}
              />
              <circle cx={px(com.x)} cy={px(com.y)} r={3} fill="none" stroke={supportColor} strokeWidth={1.2} />
              <circle cx={px(com.x)} cy={px(com.y)} r={1} fill={supportColor} />
            </g>
          )}
        </g>
      </Frame>

      {label && (
        <text x={115} y={162} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* drawing helpers                                                             */
/* -------------------------------------------------------------------------- */

/** The same pose turned bodily about its nose, tangents and all. */
function tiltPose(pose: SpinePose, degrees: number): SpinePose {
  if (!degrees) return pose
  const radians = toRadians(degrees)
  const joints = pose.joints.map((joint) => ({
    ...joint,
    position: rotate2(joint.position, radians),
    angle: joint.angle + degrees,
  }))
  return { ...pose, joints, head: joints[0], tail: joints[joints.length - 1] }
}

/**
 * A point `forward` along a body axis and `up` its normal — the frame every
 * part hung off the trunk is placed in, and what carries the head through a rear.
 */
function alongBody(origin: Vec2, degrees: number, forward: number, up: number): Vec2 {
  const a = toRadians(degrees)
  return {
    x: origin.x + Math.cos(a) * forward - Math.sin(a) * up,
    y: origin.y + Math.sin(a) * forward + Math.cos(a) * up,
  }
}

/** The spine's own line, offset along each joint's normal and left open. */
function offsetLine(pose: SpinePose, place: (index: number) => Vec2, width: (s: number) => number) {
  return pose.joints
    .map((joint, index) => {
      const normal = toRadians(joint.angle + 90)
      const at = place(index)
      const w = width(joint.s)
      return `${index ? "L" : "M"} ${px(at.x + Math.cos(normal) * w)} ${px(at.y + Math.sin(normal) * w)}`
    })
    .join(" ")
}

/** Joints offset by a different amount each side, closed into one path. */
function bodyOutline(
  pose: SpinePose,
  place: (index: number) => Vec2,
  top: (s: number) => number,
  under: (s: number) => number,
) {
  const above: string[] = []
  const below: string[] = []
  pose.joints.forEach((joint, index) => {
    const normal = toRadians(joint.angle + 90)
    const nx = Math.cos(normal)
    const ny = Math.sin(normal)
    const at = place(index)
    const a = top(joint.s)
    const b = under(joint.s)
    above.push(`${above.length ? "L" : "M"} ${px(at.x + nx * a)} ${px(at.y + ny * a)}`)
    below.unshift(`L ${px(at.x - nx * b)} ${px(at.y - ny * b)}`)
  })
  return [...above, ...below, "Z"].join(" ")
}

/** The crest of the hump alone, sampled finer than the spine's own joints. */
function humpPath(
  pose: SpinePose,
  place: (index: number) => Vec2,
  top: (s: number) => number,
  height: number,
) {
  if (height <= 0) return ""
  const points: string[] = []
  for (let step = 0; step <= 10; step += 1) {
    const s = (step / 10) * 0.45
    const index = Math.min(pose.joints.length - 1, s * (pose.joints.length - 1))
    const low = Math.floor(index)
    const high = Math.min(pose.joints.length - 1, low + 1)
    const t = index - low
    const a = place(low)
    const b = place(high)
    const joint = pose.joints[low]
    const normal = toRadians(joint.angle + 90)
    const at = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
    const w = top(s) - 1.4
    points.push(`${points.length ? "L" : "M"} ${px(at.x + Math.cos(normal) * w)} ${px(at.y + Math.sin(normal) * w)}`)
  }
  return points.join(" ")
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

export interface BearStance {
  /** 0 on four soles to 1 standing on the hind pair. */
  rear: number
  /** Back curvature, −1 hollow to 1 roached. */
  arch: number
  /** Leg fold, 0 tall to 1 down on the hocks. */
  crouch: number
  /** How hard the near forepaw rakes, 0–1. */
  dig: number
  /** Where the footfall cycle has got to. Above 1.5 the feet are planted. */
  stride: number
}

export interface BearPose {
  gaze: number
  ears: number
  /** How much of the carriage the balance rule takes, 0–1. */
  balance: number
  /** Spine wave amplitude, 0–1. A bear's back barely moves. */
  flex: number
  stance: (cycle: number) => BearStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function bearBehaviorPose(behavior: BearBehavior, clock: number): BearPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Up onto the hind soles, a sway at the top while the balance rule holds
    // the margin, and back down. The signature of the whole family.
    case "rear":
      return {
        gaze: 0.25 * Math.sin(time * 0.7),
        ears: 0.8,
        balance: 1,
        flex: 0.04,
        stance: (cycle) => {
          const t = wrap(cycle)
          const up = Math.sin(Math.PI * clamp((t - 0.12) / 0.76, 0, 1)) ** 0.7
          return {
            rear: clamp(up, 0, 1),
            arch: -0.12 * up,
            crouch: clamp(0.3 - 0.3 * up, 0, 1),
            dig: 0,
            stride: 2,
          }
        },
      }
    // Head down over the floor with one forepaw working: the hump is loaded
    // through the whole of it, which is the point of drawing it this way.
    case "forage":
      return {
        gaze: -0.55 + 0.1 * Math.sin(time * 0.9),
        ears: 0.2,
        balance: 0.6,
        flex: 0.05,
        stance: (cycle) => ({
          rear: 0,
          arch: 0.3,
          crouch: 0.55,
          dig: 0.5 + 0.5 * Math.sin(2 * Math.PI * wrap(cycle)),
          stride: 2,
        }),
      }
    case "static":
      return {
        gaze: 0,
        ears: 0.4,
        balance: 0.5,
        flex: 0,
        stance: () => ({ rear: 0, arch: 0, crouch: 0.18, dig: 0, stride: 2 }),
      }
    // The amble: a lateral-sequence plantigrade walk, every sole rolling heel
    // to toe. The stride is the cycle, so one cycle is one stride.
    default:
      return {
        gaze: 0.15 * Math.sin(time * 0.5),
        ears: 0.55,
        balance: 0.8,
        flex: 0.06,
        stance: (cycle) => ({
          rear: 0,
          // The roll of a lateral-sequence walk, taken out on the topline.
          arch: 0.08 * Math.sin(2 * Math.PI * wrap(cycle)),
          crouch: 0.22,
          dig: 0,
          stride: wrap(cycle),
        }),
      }
  }
}

export { RobotBear }
