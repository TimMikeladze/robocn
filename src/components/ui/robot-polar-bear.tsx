"use client"

/**
 * robot-polar-bear — one body, two ways of holding itself up.
 *
 * `robot-bear` spends the plantigrade base of support on standing up. This one
 * spends it on **giving it away.** `swim` is the handover, 0 on the floor to 1
 * afloat, and it is the same load budget:
 *
 *     legLoad(i) = (1 − swim) · supportLoad(i)
 *     buoyancy   = swim
 *
 * One prop, four consequences, all of them arithmetic. The soles unload and the
 * base of support stops mattering. The body rises to the waterline and levels
 * out. The hind limbs stop stepping and trail, because a swimming bear does not
 * kick. And the forelimbs go from standing on the floor to **paddling** — the
 * paw traces a closed stroke, deep on the pull and shallow on the recovery, and
 * `solveChain2` produces the shoulder and elbow from it, so the articulation is
 * an output of the path rather than a pair of scripted angles.
 *
 * The proportions are the rest of it: long body, long neck, small head carried
 * low, no shoulder hump at all. No markings, no paint — a machine reads as this
 * animal from its silhouette or it does not read as it.
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

export type PolarBearBehavior = "plod" | "swim" | "stalk" | "rear" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const ORIGIN = 66
const GROUND = 138
const HALF_TRACK = 14

/** Croup to withers. Longer and lower than the brown bear's. */
const TRUNK = 64
const HIND = [21, 19] as const
const HIND_SOLE = { heel: 8, toe: 14, ankle: 5 } as const
const FORE = [19, 17] as const
/** The forepaw is the paddle, so it is the biggest foot in the set. */
const FORE_SOLE = { heel: 6, toe: 13, ankle: 4.5 } as const
/** A long cervical chain: the neck is this animal's signature. */
const NECK = [13, 11] as const

const HIND_STANCE = 2
const FORE_STANCE = 54
const STAND = 39
const CROUCH = 29
/** Reared, the hind legs are nearly straight: this is what they can reach to. */
const REARED = 43
/** A rear takes the spine near vertical, which is what brings the mass back
 *  over the hind soles rather than out past them. */
const REAR_PITCH = 76
const SHIFT_LIMIT = 22

/** Where the surface sits above the floor, and how deep the hull rides in it. */
const WATER = 34
const DRAFT = 9
/** Stroke reach along the body, pull depth, and the shallower recovery. */
const STROKE = { reach: 17, pull: 20, recovery: 7 } as const
/** Units per second the swim eases back at when a drag is released. */
const SWIM_RATE = 0.9

const fits: Record<RobotView, number> = { plan: 0.74, front: 0.88, profile: 1, iso: 0.8 }
const framing: Record<RobotView, number> = { plan: -14, front: 0, profile: 0, iso: -8 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

interface PolarLeg extends SolePose {
  id: LegId
  side: "left" | "right"
  fore: boolean
  /** Share of the standing weight on this sole, after the water has taken its cut. */
  load: number
}

/** The same lateral sequence the brown bear walks on. */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "hind-left", side: "left", fore: false, offset: 0 },
  { id: "fore-left", side: "left", fore: true, offset: 0.12 },
  { id: "hind-right", side: "right", fore: false, offset: 0.5 },
  { id: "fore-right", side: "right", fore: true, offset: 0.62 },
]

export interface RobotPolarBearProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  behavior?: PolarBearBehavior
  /** Controlled stride, or stroke, fraction. Supplying it stops the internal clock. */
  phase?: number
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** 0 on the floor to 1 afloat. Omit and the behavior works it. */
  swim?: number
  /** Wingbeats of the water: forelimb strokes per cycle. */
  strokes?: number
  /** 0 on four soles to 1 up on the hind pair. Ignored while swimming. */
  rear?: number
  /** How much of the body's carriage the balance rule takes, 0 scripted to 1 derived. */
  balance?: number
  arch?: number
  crouch?: number
  /** Neck carriage, −1 run down below the shoulder to 1 held high. */
  neck?: number
  gaze?: number
  /** Drag up and down to work the handover; the head tracks the pointer. */
  interactive?: boolean
  onSwimChange?: (swim: number) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  /** Draw the base of support, the centre of mass, and the margin between them. */
  showSupport?: boolean
  label?: string
}

function RobotPolarBear({
  behavior = "swim",
  phase,
  view = NATIVE_VIEW,
  speed = 0.45,
  animate = true,
  paused = false,
  offset = 0,
  swim,
  strokes = 1,
  rear,
  balance,
  arch,
  crouch,
  neck,
  gaze,
  interactive = true,
  onSwimChange,
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
}: RobotPolarBearProps) {
  const controlledSwim = swim !== undefined
  const controlledPhase = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlledSwim ? finiteClamp(swim, 0, 1, 0) : held

  const rate = Number.isFinite(speed) ? speed : 0
  const goal = React.useCallback(
    (seconds: number) => polarBearPose(behavior, seconds).stance(seconds * rate).swim,
    [behavior, rate],
  )
  const motion = useRobotScalar(goal, {
    rate: SWIM_RATE,
    hold,
    speed: 1,
    paused,
    phase: offset,
    animate: animate && !controlledPhase && behavior !== "static",
  })
  const clock = motion.clock
  const scripted = polarBearPose(behavior, clock)
  const cycle = controlledPhase ? (Number.isFinite(phase) ? phase : 0) : clock * rate
  const stance = scripted.stance(cycle)
  const afloat = finiteClamp(
    controlledSwim ? swim : controlledPhase ? stance.swim : motion.value,
    0,
    1,
    0,
  )

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Number(clamp(next, 0, 1).toFixed(3))
      setHeld(bounded)
      onSwimChange?.(bounded)
    },
    [onSwimChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && !controlledSwim,
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
  // A swimming animal is not standing on anything, so the rear is shut out of
  // the water rather than blended into it.
  const rise = finiteClamp(rear ?? stance.rear, 0, 1, stance.rear) * (1 - afloat)
  const weight = finiteClamp(balance ?? scripted.balance, 0, 1, scripted.balance)
  const carriage = finiteClamp(neck ?? stance.neck, -1, 1, stance.neck)
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const beats = Number.isFinite(strokes) ? clamp(strokes, 0.25, 4) : 1

  /* ---- the back: on the floor, or level at the waterline ------------------ */

  // Afloat the hull rides *in* the surface at its own draft, not on top of it.
  const hipHeight = lerp(lerp(lerp(STAND, CROUCH, fold), REARED, rise), WATER + DRAFT - 6, afloat)
  const curvature = bow * 0.18
  const tilt = -(curvature * spineLimits.turn) / 2 + rise * REAR_PITCH + afloat * 4
  const pitched = tiltPose(
    solveSpine({
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
  const croup = pitched.joints[pitched.joints.length - 1].position
  const local = (index: number): Vec2 => ({
    x: pitched.joints[index].position.x - croup.x,
    y: pitched.joints[index].position.y - croup.y + hipHeight,
  })

  const massPoints = pitched.joints.map((joint, index) => ({
    point: local(index),
    weight: 1 + 0.4 * Math.sin(Math.PI * joint.s),
  }))
  const crest = pitched.joints[0].angle
  const localWithers = local(0)
  massPoints.push({ point: alongBody(localWithers, crest, 26, 14), weight: 1.3 })
  const massTotal = massPoints.reduce((sum, entry) => sum + entry.weight, 0)
  const comLocal = {
    x: massPoints.reduce((sum, entry) => sum + entry.point.x * entry.weight, 0) / massTotal,
    y: massPoints.reduce((sum, entry) => sum + entry.point.y * entry.weight, 0) / massTotal,
  }

  /* ---- where each foot goes: a step, a trail, or a stroke ----------------- */

  // How far from the hip a hind sole can be put and still make the floor.
  const hindRoom = Math.sqrt(
    Math.max(0, (HIND[0] + HIND[1]) ** 2 - (hipHeight - HIND_SOLE.ankle) ** 2),
  )

  const steps = legPlan.map(({ id, fore, offset: legOffset }) => {
    const walking = stance.stride >= 0 && stance.stride <= 1.5
    const step = walking
      ? plantigradeStep(stance.stride + legOffset, { reach: fore ? 12 : 13, clearance: 9 })
      : { plant: { x: 0, y: 0 }, pivot: "flat" as const, pitch: 0, roll: "flat" as const, contact: true }
    // Standing up, the hind soles step in under the centre of mass, as far as
    // the limb can put them: the first half of the same balance rule.
    const under = clamp(comLocal.x, -hindRoom, hindRoom)
    return {
      id,
      x:
        (fore ? FORE_STANCE : lerp(HIND_STANCE, under, rise * weight)) +
        step.plant.x * (fore ? 1 : 1 - rise),
      y: step.plant.y,
      pivot: step.pivot,
      pitch: step.pitch,
      airborne: !step.contact,
    }
  })

  const preview = solveSupport(
    steps.map((step, index) => {
      const sole = legPlan[index].fore ? FORE_SOLE : HIND_SOLE
      const lifted = step.airborne || (legPlan[index].fore && rise > 0.06)
      if (lifted) return { id: step.id, span: null }
      const back =
        step.pivot === "heel" ? step.x : step.x - (step.pivot === "toe" ? sole.heel + sole.toe : sole.heel)
      return { id: step.id, span: [back, back + sole.heel + sole.toe] as [number, number] }
    }),
    comLocal.x,
  )
  const centre = preview.span ? (preview.span[0] + preview.span[1]) / 2 : comLocal.x
  // The hip cannot leave its own feet behind, so the slide is bounded by the
  // hind limb's reach as well as by how far a body slides.
  const hindFoot = (steps[0].x + steps[2].x) / 2
  const shift = clamp(
    clamp(centre - comLocal.x, -SHIFT_LIMIT, SHIFT_LIMIT) * weight * (1 - afloat),
    hindFoot - hindRoom,
    hindFoot + hindRoom,
  )
  const hip: Vec2 = { x: shift, y: hipHeight }
  const spinePoint = (index: number): Vec2 => {
    const point = local(index)
    return { x: point.x + shift, y: point.y }
  }
  const withers = spinePoint(0)
  const com = { x: comLocal.x + shift, y: comLocal.y }

  const thorax = pitched.joints[1]
  const under = toRadians(thorax.angle + 90)
  const shoulder: Vec2 = {
    x: spinePoint(1).x - Math.cos(under) * 8,
    y: spinePoint(1).y - Math.sin(under) * 8,
  }

  const soles = legPlan.map(({ id, fore }, index) => {
    const step = steps[index]
    const root = fore ? shoulder : hip
    const links = fore ? FORE : HIND
    const sole = fore ? FORE_SOLE : HIND_SOLE
    // Afloat, a forelimb paddles and a hind limb trails: the stroke is the path
    // the paw traces, and the two sides run half a cycle apart.
    const stroke = polarStroke(cycle * beats + (id === "fore-right" ? 0.5 : 0))
    const water: Vec2 = fore
      ? {
          x: shoulder.x + stroke.forward * STROKE.reach,
          y: Math.max(4, shoulder.y - 14 - stroke.depth),
        }
      : { x: hip.x - 16, y: Math.max(4, hip.y - 10) }
    const tuck = fore
      ? { x: shoulder.x + 9, y: Math.max(8, shoulder.y - 24) }
      : { x: step.x, y: step.y }
    const drawIn = fore ? rise : 0
    const dry: Vec2 = { x: lerp(step.x, tuck.x, drawIn), y: lerp(step.y, tuck.y, drawIn) }
    const plant = lerp2(dry, water, afloat)
    const dryPitch = lerp(step.pitch, -52, drawIn)
    // The paddle is held square to the pull, which is what a paddle is for.
    const wetPitch = fore ? lerp(-26, 30, (stroke.forward + 1) / 2) : -18
    return solveSole({
      hip: root,
      plant,
      pivot: step.pivot,
      pitch: lerp(dryPitch, wetPitch, afloat),
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
  // The handover, stated once: what the legs carry is what the water has not
  // taken. `buoyancy` is the rest of the same body.
  const buoyancy = afloat
  const legs: PolarLeg[] = soles.map((sole, index) => ({
    ...sole,
    id: legPlan[index].id,
    side: legPlan[index].side,
    fore: legPlan[index].fore,
    load: (1 - afloat) * (support.loads[legPlan[index].id] ?? 0),
  }))

  /* ---- the long neck, and the small head on the end of it ----------------- */

  const nape = alongBody(withers, crest, 2, 5)
  const target = alongBody(withers, crest, 26, 4 + carriage * 9 - rise * 2)
  const [, cervical, poll] = solveChain2(nape, target, [...NECK], { bend: "up" })
  const headTilt = toDegrees(Math.atan2(poll.y - cervical.y, poll.x - cervical.x)) + aim * 7 - 8

  /* ---- paint -------------------------------------------------------------- */

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const supportColor = support.stable || afloat > 0.5 ? palette.accent : palette.shell

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
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)

  /** Level topline, no hump at all: this animal's shoulder is flat. */
  const backline = (s: number) => 12.5 + 2 * s
  const bellyline = (s: number) =>
    s < 0.45 ? lerp(16, 13, s / 0.45) : lerp(13, 16, (s - 0.45) / 0.55)

  const readout = Math.round(afloat * 100)
  const state = dragging
    ? "worked by hand"
    : afloat > 0.55
      ? "swimming"
      : rise > 0.55
        ? "standing on its hind legs"
        : behavior === "stalk"
          ? "stalking"
          : behavior === "plod"
            ? "plodding"
            : "standing"

  function legDrawing(leg: PolarLeg) {
    const far = leg.side === "right"
    const nudge = far ? -7 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + nudge, y: p.y })
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.52 : 1}>
        <path d={capsulePath(move(leg.hip), move(leg.knee), leg.fore ? 8 : 9)} {...shell} />
        <path d={capsulePath(move(leg.knee), move(leg.ankle), leg.fore ? 6.6 : 7)} {...machined} />
        <g data-sole={leg.id} data-contact-state={leg.contact}>
          <path d={capsulePath(move(leg.heel), move(leg.toe), leg.fore ? 4.2 : 3.8)} {...cast} />
          {[0.62, 0.8, 0.98].map((t) => {
            const claw = lerp2(move(leg.heel), move(leg.toe), t)
            return <circle key={t} cx={px(claw.x + 1.4)} cy={px(claw.y - 1.2)} r={0.9} fill={palette.metal} />
          })}
        </g>
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.knee).x)}
          cy={px(move(leg.knee).y)}
          r={4}
          {...cast}
        />
        <circle data-joint={`${leg.id}-ankle`} cx={px(move(leg.ankle).x)} cy={px(move(leg.ankle).y)} r={3} {...cast} />
        {leg.fore && (
          <circle data-joint={`${leg.id}-shoulder`} cx={px(move(leg.hip).x)} cy={px(move(leg.hip).y)} r={3.6} {...cast} />
        )}
        {leg.fore && afloat > 0.02 && (
          <path
            data-stroke={leg.side}
            d={strokePath(shoulder, nudge)}
            fill="none"
            stroke={palette.accent}
            strokeWidth={0.7}
            strokeDasharray="2 3"
            opacity={px(0.45 * afloat)}
          />
        )}
        {showContacts && leg.span && leg.load > 0.001 && (
          <rect
            data-contact
            x={px(Math.min(leg.span[0], leg.span[1]) + nudge)}
            y={-2.4}
            width={px(Math.max(1.6, Math.abs(leg.span[1] - leg.span[0])))}
            height={2}
            rx={1}
            fill={palette.accent}
            opacity={px(0.3 + 0.6 * leg.load)}
          />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot polar bear, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent afloat` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox="0 0 240 168"
      width={width}
      height={px((width * 168) / 240)}
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
        if (!interactive || controlledSwim || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(afloat + delta)
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
          <path d={`M 10 ${GROUND} H 230 M ${ORIGIN} 14 V ${GROUND + 12}`} strokeDasharray="2 3" />
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
          <path d={`M 12 ${GROUND} H 228`} stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={px(ORIGIN + 26)}
            cy={GROUND + 3}
            rx={px(50 - afloat * 16 - rise * 16)}
            ry={4.4}
            fill={palette.dark}
            opacity={px(0.15 * (1 - afloat))}
          />
        </g>
      )}

      {/* The surface. The hull rides in it, so it is drawn over the body. */}
      {afloat > 0.02 && (
        <g data-waterline opacity={px(Math.min(1, afloat * 2.2))}>
          <rect
            x={10}
            y={px(GROUND - WATER)}
            width={220}
            height={px(WATER)}
            fill={palette.accent}
            opacity={0.08}
          />
          <path
            d={`M 10 ${px(GROUND - WATER)} H 230`}
            stroke={palette.accent}
            strokeWidth={1}
            fill="none"
            opacity={0.6}
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
                  <path d={capsulePath(at(leg.hip, across * 0.7), at(leg.knee, across), leg.fore ? 8 : 9)} {...shell} />
                  <path d={capsulePath(at(leg.knee, across), at(leg.ankle, across), leg.fore ? 6.6 : 7)} {...machined} />
                  {/* The paddle, as a plate rather than a line. */}
                  <path
                    d={extrudedPath(
                      roundedFootprint(
                        leg.fore ? 6 : 6.5,
                        (leg.fore ? FORE_SOLE.heel + FORE_SOLE.toe : HIND_SOLE.heel + HIND_SOLE.toe) / 2,
                        2,
                        2,
                      ).map((p) => ({ x: p.x + across, y: p.y - (leg.heel.x + leg.toe.x) / 2 })),
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
          <path d={capsulePath(at(nape), at(cervical), 6.4)} {...machined} />
          <path d={capsulePath(at(cervical), at(poll), 5.4)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(6.2, 10, 4, 4).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 6,
              poll.y - 6,
            )}
            {...shell}
          />
        </g>
      )}

      <Frame {...frame}>
        <g
          data-polar-bear
          data-view={view}
          data-swim={px(afloat)}
          data-buoyancy={px(buoyancy)}
          transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}
        >
          {legs.filter((leg) => leg.side === "right").map(legDrawing)}

          <g data-trunk>
            {([0, pitched.joints.length - 1] as const).map((index) => {
              const joint = pitched.joints[index]
              const place = spinePoint(index)
              const normal = toRadians(joint.angle + 90)
              const radius = (backline(joint.s) + bellyline(joint.s)) / 2
              const bias = (backline(joint.s) - bellyline(joint.s)) / 2
              return (
                <circle
                  key={index}
                  cx={px(place.x + Math.cos(normal) * bias)}
                  cy={px(place.y + Math.sin(normal) * bias)}
                  r={px(radius)}
                  {...shell}
                />
              )
            })}
            <path data-spine d={bodyOutline(pitched, spinePoint, backline, bellyline)} {...shell} />
            <path
              d={offsetLine(pitched, spinePoint, (t) => -(7 - 3 * Math.sin(Math.PI * t)))}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.7}
              opacity={0.22}
            />
          </g>

          <path data-neck d={capsulePath(nape, cervical, 6.4)} {...machined} />
          <path d={capsulePath(cervical, poll, 5.4)} {...machined} />

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            {/* Small ears, set low and close: a smaller head than the brown
                bear's on a much longer neck is the whole silhouette. */}
            <g data-ears>
              {([
                { id: "left" as const, across: 2, opacity: 1 },
                { id: "right" as const, across: -3.5, opacity: 0.55 },
              ]).map(({ id, across, opacity }) => (
                <g key={id} opacity={opacity}>
                  <circle data-ear={id} cx={px(-4.5 + across * 0.4)} cy={px(6.4 + across * 0.5)} r={3.4} {...shell} />
                  <circle cx={px(-3.8 + across * 0.4)} cy={px(6.2 + across * 0.5)} r={1.7} {...cast} />
                </g>
              ))}
            </g>
            {/* A long straight skull that runs into the muzzle with no stop. */}
            <path d="M -8.5 -5.5 Q -9.5 6.5 -1 8 Q 7 7.5 10 3.5 Q 12 -1.5 9 -6 Q 2.5 -9 -3 -9 Q -8 -9 -8.5 -5.5 Z" {...shell} />
            <path data-muzzle d="M 8.5 -5 Q 20 -4.6 21.5 -1.4 L 21.5 2.2 Q 19.5 4.6 8.5 4.8 Z" {...machined} />
            <path d="M 8.5 1.6 Q 16 2.2 21 2.6 L 21 3.8 Q 15.5 4.2 8.5 4.2 Z" {...cast} />
            <ellipse cx={20.8} cy={-1.2} rx={1.9} ry={2.2} fill={palette.dark} />
            <g data-eyes>
              <g transform="translate(1 2.8)" opacity={0.5}>
                <circle r={1.8} {...cast} />
                <circle cx={px(0.6 + aim * 0.8)} r={0.9} fill={palette.accent} />
              </g>
              <g transform="translate(4.2 0.2)">
                <circle r={2.2} {...cast} />
                <circle cx={px(0.8 + aim * 1.1)} r={1.15} fill={palette.accent} />
              </g>
            </g>
          </g>

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          <g data-joints>
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={5.2} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={2} fill={palette.metal} />
          </g>

          {showSupport && (
            <g data-support data-stable={support.stable} data-afloat={afloat > 0.5} data-margin={px(support.margin)} data-base={support.span ? px(support.span[1] - support.span[0]) : 0}>
              {support.span && afloat < 0.98 && (
                <rect
                  x={px(support.span[0])}
                  y={-4.6}
                  width={px(Math.max(1.5, support.span[1] - support.span[0]))}
                  height={2.2}
                  rx={1.1}
                  fill={supportColor}
                  opacity={px(0.75 * (1 - afloat))}
                />
              )}
              <path
                data-com
                d={`M ${px(com.x)} ${px(com.y)} V ${px(afloat > 0.5 ? WATER : 0)}`}
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
        <text x={120} y={162} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The stroke a forepaw traces, as a fraction of a beat.
 *
 * Forward is a cosine along the body; depth is a sine that pulls deep on the
 * half of the beat that does the work and recovers shallow on the other, which
 * is what makes it a stroke rather than a circle. Pure, so the tests read the
 * path off it rather than off the drawing.
 */
export function polarStroke(t: number): { forward: number; depth: number } {
  const a = 2 * Math.PI * wrap(t)
  const sweep = Math.sin(a)
  return {
    forward: Math.cos(a),
    depth: sweep >= 0 ? STROKE.pull * sweep : STROKE.recovery * sweep,
  }
}

/** The closed stroke, drawn once so a person can see the path the paw is on. */
function strokePath(shoulder: Vec2, nudge: number) {
  const points: string[] = []
  for (let step = 0; step <= 24; step += 1) {
    const stroke = polarStroke(step / 24)
    const x = shoulder.x + nudge + stroke.forward * STROKE.reach
    const y = Math.max(4, shoulder.y - 14 - stroke.depth)
    points.push(`${points.length ? "L" : "M"} ${px(x)} ${px(y)}`)
  }
  return `${points.join(" ")} Z`
}

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

function alongBody(origin: Vec2, degrees: number, forward: number, up: number): Vec2 {
  const a = toRadians(degrees)
  return {
    x: origin.x + Math.cos(a) * forward - Math.sin(a) * up,
    y: origin.y + Math.sin(a) * forward + Math.cos(a) * up,
  }
}

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
    above.push(`${above.length ? "L" : "M"} ${px(at.x + nx * top(joint.s))} ${px(at.y + ny * top(joint.s))}`)
    below.unshift(`L ${px(at.x - nx * under(joint.s))} ${px(at.y - ny * under(joint.s))}`)
  })
  return [...above, ...below, "Z"].join(" ")
}

const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

export interface PolarBearStance {
  /** 0 on the floor to 1 afloat. */
  swim: number
  /** 0 on four soles to 1 up on the hind pair. */
  rear: number
  arch: number
  crouch: number
  /** Neck carriage, −1 run down below the shoulder to 1 held high. */
  neck: number
  /** Where the footfall cycle has got to. Above 1.5 the feet are planted. */
  stride: number
}

export interface PolarBearPose {
  gaze: number
  balance: number
  /** Spine wave amplitude, 0–1. */
  flex: number
  stance: (cycle: number) => PolarBearStance
}

/** What it does with no timeline on it. Pure in the clock. */
export function polarBearPose(behavior: PolarBearBehavior, clock: number): PolarBearPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // On the floor: the lateral-sequence plantigrade walk, head carried low.
    case "plod":
      return {
        gaze: 0.14 * Math.sin(time * 0.5),
        balance: 0.8,
        flex: 0.06,
        stance: (cycle) => ({
          swim: 0,
          rear: 0,
          arch: 0.06 * Math.sin(2 * Math.PI * wrap(cycle)),
          crouch: 0.2,
          neck: -0.2,
          stride: wrap(cycle),
        }),
      }
    // Long, low and slow, with the neck run right down below the shoulder.
    case "stalk":
      return {
        gaze: -0.3 + 0.12 * Math.sin(time * 0.7),
        balance: 0.9,
        flex: 0.04,
        stance: (cycle) => ({
          swim: 0,
          rear: 0,
          arch: -0.18,
          crouch: 0.68,
          neck: -0.95,
          stride: wrap(cycle) * 0.6,
        }),
      }
    case "rear":
      return {
        gaze: 0.25 * Math.sin(time * 0.7),
        balance: 1,
        flex: 0.04,
        stance: (cycle) => {
          const up = Math.sin(Math.PI * clamp((wrap(cycle) - 0.12) / 0.76, 0, 1)) ** 0.7
          return {
            swim: 0,
            rear: clamp(up, 0, 1),
            arch: -0.1 * up,
            crouch: clamp(0.28 - 0.28 * up, 0, 1),
            neck: 0.3,
            stride: 2,
          }
        },
      }
    case "static":
      return {
        gaze: 0,
        balance: 0.5,
        flex: 0,
        stance: () => ({ swim: 0, rear: 0, arch: 0, crouch: 0.16, neck: 0, stride: 2 }),
      }
    // The signature: afloat at the waterline, forelimbs alternating, the hind
    // pair trailing. The feet stop stepping, because nothing is on the floor.
    default:
      return {
        gaze: 0.12 * Math.sin(time * 0.6),
        balance: 0.4,
        flex: 0.14,
        stance: () => ({
          swim: 1,
          rear: 0,
          arch: -0.05,
          crouch: 0.1,
          neck: 0.55,
          stride: 2,
        }),
      }
  }
}

export { RobotPolarBear }
