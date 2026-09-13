"use client"

/**
 * robot-panda — the bear that sits down to use its hands, and why that is a
 * mechanism rather than a pose.
 *
 * `robot-bear` rears and loses most of its base of support. This one does the
 * opposite. **`sit` puts a third contact on the floor**: the pelvis comes down
 * behind the hind soles with a span of its own, so `solveSupport` gets three
 * intervals instead of two, the base runs from the toes to behind the seat, and
 * the margin goes strongly positive. That is the arithmetic statement of why an
 * animal sits down to work: it buys a base wide enough that the forelimbs are
 * not holding it up any more, and both of them come free in the same moment.
 *
 * What they come free for is the second mechanism. The sixth digit is an
 * enlarged wrist bone opposing the other five, and the **pad gap is an output**:
 * a fatter stalk rides the thumb further open at the same `grip`, and closing on
 * nothing brings the pads together. The stalk is a real target — both forepaws
 * are solved to it — so moving it moves the whole forelimb chain.
 *
 * Design note: docs/ursine-robots.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
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

export type PandaBehavior = "feed" | "sit" | "amble" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const ORIGIN = 74
const GROUND = 142
const HALF_TRACK = 14

/** Croup to withers. Short-coupled and very round. */
const TRUNK = 48
const HIND = [19, 17] as const
const HIND_SOLE = { heel: 6, toe: 11, ankle: 4.5 } as const
const FORE = [18, 16] as const
const FORE_SOLE = { heel: 5, toe: 10, ankle: 4 } as const
/** A short thick neck: the head sits almost on the shoulders. */
const NECK = [9, 8] as const

const HIND_STANCE = 2
const FORE_STANCE = 42
const STAND = 38
const CROUCH = 30
/** Hip height sitting, before the seat is rested on the floor. */
const SEATED = 13
/** How far sitting tips the trunk up about the hip, in degrees. */
const SIT_PITCH = 54
/** Where the hind soles go as it sits: out in front, the way a seated bear's do. */
const SIT_FOOT = 26
/** The pelvis block that becomes the third contact, behind and below the hip. */
const ISCHIUM = { back: 9, down: 11, half: 7 } as const
/** How far the balance rule may slide the body over its own feet. */
const SHIFT_LIMIT = 18

/** Widest the pseudo-thumb opens against the digits, in world units. */
const PAD_MAX = 9
/** How far the thumb swings between closed and fully open, in degrees. */
const THUMB = { closed: 8, open: 52 } as const

const fits: Record<RobotView, number> = { plan: 0.8, front: 0.92, profile: 1, iso: 0.84 }
const framing: Record<RobotView, number> = { plan: -12, front: 0, profile: 0, iso: -6 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

interface PandaLeg extends SolePose {
  id: LegId
  side: "left" | "right"
  fore: boolean
  load: number
}

/** The same lateral sequence the other two bears walk on. */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "hind-left", side: "left", fore: false, offset: 0 },
  { id: "fore-left", side: "left", fore: true, offset: 0.12 },
  { id: "hind-right", side: "right", fore: false, offset: 0.5 },
  { id: "fore-right", side: "right", fore: true, offset: 0.62 },
]

export interface RobotPandaProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  behavior?: PandaBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** 0 standing to 1 down on the seat. Omit and the behavior works it. */
  sit?: number
  /** How far the pseudo-thumb is closed on the digits, 0–1. */
  grip?: number
  /** Stalk diameter in world units, 0–9. What the thumb has to open around. */
  stalkWidth?: number
  /** Where the stalk is, in the animal's own frame: x forward, y up. Omit and
   *  the pointer is the stalk. */
  stalk?: Vec2
  /** Jaw opening, 0 shut to 1 wide. Omit and the behavior chews. */
  chew?: number
  arch?: number
  crouch?: number
  gaze?: number
  /** How much of the carriage the balance rule takes, 0 scripted to 1 derived. */
  balance?: number
  /** The pointer is the stalk, both forepaws solve to it, and a click bites. */
  interactive?: boolean
  onStalkChange?: (stalk: Vec2) => void
  onBite?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  /** Draw the base of support — the one machine here where you can watch it bought. */
  showSupport?: boolean
  label?: string
}

function RobotPanda({
  behavior = "feed",
  phase,
  view = NATIVE_VIEW,
  speed = 0.35,
  animate = true,
  paused = false,
  offset = 0,
  sit,
  grip,
  stalkWidth = 5,
  stalk,
  chew,
  arch,
  crouch,
  gaze,
  balance,
  interactive = true,
  onStalkChange,
  onBite,
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
  onPointerDown,
  ...props
}: RobotPandaProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [bitten, setBitten] = React.useState<number | null>(null)
  const since = bitten === null ? Infinity : clock - bitten
  const biting = since >= 0 && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) : 0

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && stalk === undefined && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        // The animal's own frame: x forward from the hip, y up off the floor.
        x: clamp(unit.x * 220 - ORIGIN, 8, 78),
        y: clamp(GROUND - unit.y * 170, 6, 78),
      }),
      [],
    ),
  })

  const rate = Number.isFinite(speed) ? speed : 0
  const scripted = pandaBehaviorPose(behavior, clock)
  const cycle = controlled ? (Number.isFinite(phase) ? phase : 0) : clock * rate
  const stance = scripted.stance(cycle)

  const seatDrive = finiteClamp(sit ?? stance.sit, 0, 1, stance.sit)
  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const weight = finiteClamp(balance ?? scripted.balance, 0, 1, scripted.balance)
  const aim = finiteClamp(gaze ?? scripted.gaze, -1, 1, 0)
  const close = finiteClamp(grip ?? stance.grip, 0, 1, stance.grip)
  const jaw = clamp(finiteClamp(chew ?? stance.chew, 0, 1, stance.chew) + biting * 0.6, 0, 1)
  const caliper = finiteClamp(stalkWidth, 0, PAD_MAX, 5)

  /**
   * The grip, and the number that is an output of it. The pads open to `gap`;
   * a stalk wider than the gap rides the thumb further open, which is what
   * makes the pad an answer to what is being held rather than to the dial.
   */
  const gap = PAD_MAX * (1 - close)
  const pad = Math.max(gap, caliper)
  const held = caliper > 0 && caliper >= gap
  // The thumb is only in play when the paw is being used as a hand: planted, it
  // lies along the sole with the other digits.
  const thumbAngle = lerp(
    THUMB.closed,
    lerp(THUMB.closed, THUMB.open, clamp(pad / PAD_MAX, 0, 1)),
    seatDrive,
  )

  /* ---- the body, tipped back onto its seat -------------------------------- */

  const hipBase = lerp(lerp(STAND, CROUCH, fold), SEATED, seatDrive)
  const curvature = bow * 0.22
  const tilt = -(curvature * spineLimits.turn) / 2 + seatDrive * SIT_PITCH
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

  // The pelvis is rigid on the body, so where its underside ends up is a
  // consequence of the tilt. If it would go through the floor, the whole animal
  // rests on it instead — which is what sitting down is.
  const seatLocal = alongBody({ x: 0, y: hipBase }, tilt, -ISCHIUM.back, -ISCHIUM.down)
  const hipHeight = hipBase + Math.max(0, -seatLocal.y)
  const local = (index: number): Vec2 => ({
    x: pitched.joints[index].position.x - croup.x,
    y: pitched.joints[index].position.y - croup.y + hipHeight,
  })

  const massPoints = pitched.joints.map((joint, index) => ({
    point: local(index),
    weight: 1 + 0.7 * Math.sin(Math.PI * joint.s),
  }))
  const crest = pitched.joints[0].angle
  const localWithers = local(0)
  massPoints.push({ point: alongBody(localWithers, crest, 18, 10), weight: 1.8 })
  const massTotal = massPoints.reduce((sum, entry) => sum + entry.weight, 0)
  const comLocal = {
    x: massPoints.reduce((sum, entry) => sum + entry.point.x * entry.weight, 0) / massTotal,
    y: massPoints.reduce((sum, entry) => sum + entry.point.y * entry.weight, 0) / massTotal,
  }

  const hindRoom = Math.sqrt(
    Math.max(0, (HIND[0] + HIND[1]) ** 2 - (hipHeight - HIND_SOLE.ankle) ** 2),
  )

  const steps = legPlan.map(({ id, fore, offset: legOffset }) => {
    const walking = stance.stride >= 0 && stance.stride <= 1.5
    const step = walking
      ? plantigradeStep(stance.stride + legOffset, { reach: fore ? 10 : 11, clearance: 8 })
      : { plant: { x: 0, y: 0 }, pivot: "flat" as const, pitch: 0, roll: "flat" as const, contact: true }
    // Sitting runs the hind legs out in front, which is where a seated bear's
    // feet go and is also what puts the soles at the front of the new base.
    const nominal = fore ? FORE_STANCE : lerp(HIND_STANCE, Math.min(SIT_FOOT, hindRoom), seatDrive)
    return {
      id,
      x: nominal + step.plant.x * (fore ? 1 : 1 - seatDrive),
      y: step.plant.y,
      pivot: step.pivot,
      pitch: lerp(step.pitch, 26, fore ? 0 : seatDrive),
      airborne: !step.contact,
    }
  })

  /** Where the stalk stands, in the animal's own frame. */
  const target: Vec2 = {
    x: finiteClamp(stalk?.x ?? pointer.target?.x ?? stance.stalk.x, 0, 90, stance.stalk.x),
    y: finiteClamp(stalk?.y ?? pointer.target?.y ?? stance.stalk.y, 0, 90, stance.stalk.y),
  }

  /** The seat's own contact interval, and whether it is actually down. */
  const seatPoint = alongBody({ x: 0, y: hipHeight }, tilt, -ISCHIUM.back, -ISCHIUM.down)
  const seated = seatPoint.y <= 0.5

  const intended: SupportContact[] = steps.map((step, index) => {
    const sole = legPlan[index].fore ? FORE_SOLE : HIND_SOLE
    const lifted = step.airborne || (legPlan[index].fore && seatDrive > 0.35)
    if (lifted) return { id: step.id, span: null }
    const back =
      step.pivot === "heel" ? step.x : step.x - (step.pivot === "toe" ? sole.heel + sole.toe : sole.heel)
    return { id: step.id, span: [back, back + sole.heel + sole.toe] }
  })
  const preview = solveSupport(
    seated ? [...intended, { id: "seat", span: [seatPoint.x - ISCHIUM.half, seatPoint.x + ISCHIUM.half] }] : intended,
    comLocal.x,
  )
  const centre = preview.span ? (preview.span[0] + preview.span[1]) / 2 : comLocal.x
  const hindFoot = (steps[0].x + steps[2].x) / 2
  const shift = clamp(
    clamp(centre - comLocal.x, -SHIFT_LIMIT, SHIFT_LIMIT) * weight,
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
  const seat = { x: seatPoint.x + shift, y: seatPoint.y }

  const thorax = pitched.joints[1]
  const under = toRadians(thorax.angle + 90)
  const shoulder: Vec2 = {
    x: spinePoint(1).x - Math.cos(under) * 7,
    y: spinePoint(1).y - Math.sin(under) * 7,
  }

  /* ---- four limbs: two on the floor, two on the stalk --------------------- */

  const soles = legPlan.map(({ id, fore }, index) => {
    const step = steps[index]
    const root = fore ? shoulder : hip
    const links = fore ? FORE : HIND
    const sole = fore ? FORE_SOLE : HIND_SOLE
    // Sitting frees the forelimbs, and what they go to is the stalk: the two
    // paws stack on it the way a pair of hands do.
    const gripPoint: Vec2 = { x: target.x, y: target.y + (id === "fore-left" ? 0 : -11) }
    const plant = fore ? lerp2({ x: step.x, y: step.y }, gripPoint, seatDrive) : { x: step.x, y: step.y }
    return solveSole({
      hip: root,
      plant,
      pivot: step.pivot,
      // A gripping paw faces the stalk rather than the floor.
      pitch: fore ? lerp(step.pitch, -74, seatDrive) : step.pitch,
      femur: links[0],
      tibia: links[1],
      heel: sole.heel,
      toe: sole.toe,
      ankle: sole.ankle,
      bend: fore ? "down" : "up",
    })
  })

  const contacts: SupportContact[] = soles.map((sole, index) => ({
    id: legPlan[index].id,
    span: sole.span,
  }))
  if (seated) {
    contacts.push({ id: "seat", span: [seat.x - ISCHIUM.half, seat.x + ISCHIUM.half] })
  }
  const support = solveSupport(contacts, com.x)
  const legs: PandaLeg[] = soles.map((sole, index) => ({
    ...sole,
    id: legPlan[index].id,
    side: legPlan[index].side,
    fore: legPlan[index].fore,
    load: support.loads[legPlan[index].id] ?? 0,
  }))

  /* ---- the head: round, and carried almost on the shoulders ---------------- */

  const nape = alongBody(withers, crest, 1, 5)
  const headTarget = alongBody(withers, crest, 17, 7)
  const [, cervical, poll] = solveChain2(nape, headTarget, [...NECK], { bend: "up" })
  // The head tips toward the stalk once it is up near the muzzle, which is the
  // only thing in this machine that answers the target without being solved to it.
  const toStalk = toDegrees(Math.atan2(target.y - poll.y, target.x - poll.x))
  const near = clamp(1 - Math.hypot(target.x - poll.x, target.y - poll.y) / 34, 0, 1)
  const headTilt =
    lerp(
      toDegrees(Math.atan2(poll.y - cervical.y, poll.x - cervical.x)) - 8,
      clamp(toStalk, -55, 55),
      near * seatDrive * 0.7,
    ) + aim * 6

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
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)

  /** Round all the way: this animal is a barrel with a level topline. */
  const backline = (s: number) => 13.5 + 2 * Math.sin(Math.PI * s)
  const bellyline = (s: number) => 12.5 + 2.5 * Math.sin(Math.PI * s)

  const state =
    behavior === "amble" && seatDrive < 0.3
      ? "ambling"
      : seatDrive > 0.5
        ? held
          ? "sitting, holding a stalk"
          : "sitting"
        : "standing"

  function legDrawing(leg: PandaLeg) {
    const far = leg.side === "right"
    const nudge = far ? -6 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + nudge, y: p.y })
    const paw = lerp2(move(leg.heel), move(leg.toe), 0.5)
    const along = toDegrees(Math.atan2(leg.toe.y - leg.heel.y, leg.toe.x - leg.heel.x))
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.55 : 1}>
        {/* Shell then machined, the way the other two bears are painted: this
            animal's dark markings are the ears, the patches and the saddle, and
            a limb painted in the shadow role vanishes in a dark theme. */}
        <path d={capsulePath(move(leg.hip), move(leg.knee), leg.fore ? 7.6 : 8.6)} {...shell} />
        <path d={capsulePath(move(leg.knee), move(leg.ankle), leg.fore ? 6.2 : 6.8)} {...machined} />
        <g data-sole={leg.id} data-contact-state={leg.contact}>
          <path d={capsulePath(move(leg.heel), move(leg.toe), 3.6)} {...cast} />
        </g>
        {/* The sixth digit: a wrist bone opposing the other five, opened by
            whatever is between them. */}
        {leg.fore && (
          <g
            data-thumb={leg.side}
            transform={`translate(${px(paw.x)} ${px(paw.y)}) rotate(${px(along)})`}
          >
            <path
              d={capsulePath({ x: -1, y: 0 }, { x: -1 + Math.cos(toRadians(thumbAngle)) * 7, y: -Math.sin(toRadians(thumbAngle)) * 7 }, 2.4)}
              {...machined}
            />
            <circle cx={px(-1 + Math.cos(toRadians(thumbAngle)) * 7)} cy={px(-Math.sin(toRadians(thumbAngle)) * 7)} r={1.6} {...shell} />
          </g>
        )}
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.knee).x)}
          cy={px(move(leg.knee).y)}
          r={3.8}
          {...cast}
        />
        <circle data-joint={`${leg.id}-ankle`} cx={px(move(leg.ankle).x)} cy={px(move(leg.ankle).y)} r={2.9} {...cast} />
        {leg.fore && (
          <circle data-joint={`${leg.id}-shoulder`} cx={px(move(leg.hip).x)} cy={px(move(leg.hip).y)} r={3.4} {...cast} />
        )}
        {showContacts && leg.span && (
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
      role="img"
      aria-label={`Robot panda, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 220 170"
      width={width}
      height={px((width * 170) / 220)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer touch-none", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setBitten(clock)
        onBite?.()
        onStalkChange?.(target)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d={`M 10 ${GROUND} H 210 M ${ORIGIN} 14 V ${GROUND + 12}`} strokeDasharray="2 3" />
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
          <path d={`M 12 ${GROUND} H 208`} stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse cx={px(ORIGIN + 20)} cy={GROUND + 3} rx={44} ry={4.4} fill={palette.dark} opacity={0.15} />
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
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 6, 6).map((p) => ({
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
                  <path d={capsulePath(at(leg.hip, across * 0.7), at(leg.knee, across), leg.fore ? 7.6 : 8.6)} {...shell} />
                  <path d={capsulePath(at(leg.knee, across), at(leg.ankle, across), leg.fore ? 6.2 : 6.8)} {...machined} />
                  <path
                    d={extrudedPath(
                      roundedFootprint(
                        leg.fore ? 5 : 5.6,
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
          <path
            d={extrudedPath(
              roundedFootprint(8, 9, 6, 6).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 8,
              poll.y - 8,
            )}
            {...shell}
          />
        </g>
      )}

      <Frame {...frame}>
        <g
          data-panda
          data-view={view}
          data-sit={px(seatDrive)}
          data-grip={px(close)}
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
            {/* The shoulder saddle: this animal's markings are a band over the
                forequarters, so it is drawn as plating rather than paint. */}
            <path
              d={saddlePath(pitched, spinePoint, backline, bellyline)}
              {...cast}
              opacity={variant === "solid" ? 0.85 : 1}
            />
          </g>

          {/* The pelvis block that becomes the third contact. */}
          <g data-seat data-down={seated}>
            <rect
              x={px(seat.x - ISCHIUM.half)}
              y={px(Math.max(0, seat.y))}
              width={px(ISCHIUM.half * 2)}
              height={6}
              rx={2.6}
              {...cast}
            />
          </g>

          <path data-neck d={capsulePath(nape, cervical, 6.6)} {...machined} />

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            {/* Big round ears, high and wide: with the round skull they are the
                whole silhouette at 150px. */}
            <g data-ears>
              {([
                { id: "left" as const, across: 3, opacity: 1 },
                { id: "right" as const, across: -5, opacity: 0.55 },
              ]).map(({ id, across, opacity }) => (
                <g key={id} opacity={opacity}>
                  <circle data-ear={id} cx={px(-6 + across * 0.35)} cy={px(9 + across * 0.4)} r={5.4} {...cast} />
                  <circle cx={px(-5.4 + across * 0.35)} cy={px(8.6 + across * 0.4)} r={2.6} {...machined} />
                </g>
              ))}
            </g>
            {/* A round skull and a very short muzzle — the opposite of the
                brown bear's long one, and the reason this reads as itself. */}
            <circle r={12} {...shell} />
            {/* Short and deep: a panda's muzzle is a stub on a round head, and
                a long one turns the whole silhouette into somebody else's. */}
            <path data-muzzle d="M 8 -6 Q 14.5 -5.4 15.2 -1.6 L 15.2 2.4 Q 14 5.6 8 6 Z" {...machined} />
            <ellipse cx={14.4} cy={-1.6} rx={2.3} ry={2.5} fill={palette.dark} />
            {/* The jaw, hinged under the muzzle. */}
            <path
              data-jaw
              transform={`translate(8 1.6) rotate(${px(jaw * 22)})`}
              d="M 0 -1.8 Q 6 -1.4 7 0.8 L 7 2.6 Q 5.5 4.4 0 4.6 Z"
              {...cast}
            />
            <g data-eyes>
              {/* Patches, not paint: the dark field around each optic is a
                  panel, so a theme change takes it with everything else. */}
              <g transform="translate(2 3.6) rotate(-18)" opacity={0.5}>
                <ellipse rx={4} ry={3} {...cast} />
                <circle cx={px(0.6 + aim * 0.8)} r={1.1} fill={palette.accent} />
              </g>
              <g transform="translate(5.4 0.6) rotate(-18)">
                <ellipse rx={4.6} ry={3.4} {...cast} />
                <circle cx={px(0.8 + aim * 1)} r={1.4} fill={palette.accent} />
              </g>
            </g>
          </g>

          {/* The stalk: in front of the body and behind the near forelimb, so the
              paws close over it and the trunk does not hide it. */}
          {seatDrive > 0.05 && (
            <g data-stalk opacity={px(Math.min(1, seatDrive * 2))}>
              <rect
                x={px(target.x - caliper / 2)}
                y={0}
                width={px(Math.max(1, caliper))}
                height={px(Math.max(6, target.y + 26))}
                rx={px(Math.max(0.6, caliper / 2))}
                {...machined}
              />
              {[0.32, 0.62, 0.9].map((t) => (
                <rect
                  key={t}
                  x={px(target.x - caliper / 2 - 0.6)}
                  y={px((target.y + 26) * t)}
                  width={px(Math.max(2, caliper + 1.2))}
                  height={1.4}
                  rx={0.7}
                  {...cast}
                />
              ))}
            </g>
          )}

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          <g data-joints>
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={4.8} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={1.9} fill={palette.metal} />
          </g>

          {showSupport && (
            <g data-support data-stable={support.stable} data-margin={px(support.margin)} data-base={support.span ? px(support.span[1] - support.span[0]) : 0}>
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
        <text x={110} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

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

/** The band over the forequarters: the body outline, clipped to the shoulders. */
function saddlePath(
  pose: SpinePose,
  place: (index: number) => Vec2,
  top: (s: number) => number,
  under: (s: number) => number,
) {
  const above: string[] = []
  const below: string[] = []
  pose.joints
    .filter((joint) => joint.s <= 0.42)
    .forEach((joint, index) => {
      const normal = toRadians(joint.angle + 90)
      const nx = Math.cos(normal)
      const ny = Math.sin(normal)
      const at = place(index)
      above.push(`${above.length ? "L" : "M"} ${px(at.x + nx * top(joint.s))} ${px(at.y + ny * top(joint.s))}`)
      below.unshift(`L ${px(at.x - nx * under(joint.s))} ${px(at.y - ny * under(joint.s))}`)
    })
  return above.length ? [...above, ...below, "Z"].join(" ") : ""
}

const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

export interface PandaStance {
  /** 0 standing to 1 down on the seat. */
  sit: number
  /** How far the pseudo-thumb is closed, 0–1. */
  grip: number
  /** Jaw opening, 0 shut to 1 wide. */
  chew: number
  arch: number
  crouch: number
  /** Where the stalk is, in the animal's own frame. */
  stalk: Vec2
  /** Where the footfall cycle has got to. Above 1.5 the feet are planted. */
  stride: number
}

export interface PandaPose {
  gaze: number
  balance: number
  flex: number
  stance: (cycle: number) => PandaStance
}

/** What it does with no timeline on it. Pure in the clock. */
export function pandaBehaviorPose(behavior: PandaBehavior, clock: number): PandaPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Down on the seat with both forelimbs free and nothing in them.
    case "sit":
      return {
        gaze: 0.2 * Math.sin(time * 0.5),
        balance: 1,
        flex: 0.03,
        stance: () => ({
          sit: 1,
          grip: 0.15,
          chew: 0,
          arch: 0.1,
          crouch: 0.2,
          stalk: { x: 34, y: 30 },
          stride: 2,
        }),
      }
    // On all fours: the lateral-sequence plantigrade walk the family shares.
    case "amble":
      return {
        gaze: 0.12 * Math.sin(time * 0.5),
        balance: 0.8,
        flex: 0.05,
        stance: (cycle) => ({
          sit: 0,
          grip: 0,
          chew: 0,
          arch: 0.05 * Math.sin(2 * Math.PI * wrap(cycle)),
          crouch: 0.2,
          stalk: { x: 40, y: 10 },
          stride: wrap(cycle),
        }),
      }
    case "static":
      return {
        gaze: 0,
        balance: 0.5,
        flex: 0,
        stance: () => ({
          sit: 0,
          grip: 0,
          chew: 0,
          arch: 0,
          crouch: 0.15,
          stalk: { x: 40, y: 10 },
          stride: 2,
        }),
      }
    // The signature: sits, closes the thumb on the stalk, brings it up to the
    // muzzle and works the jaw, then lets it back down.
    default:
      return {
        gaze: 0.1 * Math.sin(time * 0.6),
        balance: 1,
        flex: 0.03,
        stance: (cycle) => {
          const t = wrap(cycle)
          const lift = Math.sin(Math.PI * clamp((t - 0.15) / 0.7, 0, 1))
          const bite = clamp((t - 0.35) / 0.3, 0, 1) * clamp((0.8 - t) / 0.2, 0, 1)
          return {
            sit: 1,
            grip: clamp(0.2 + 0.8 * clamp(t / 0.18, 0, 1), 0, 1),
            chew: bite * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t)),
            arch: 0.12,
            crouch: 0.2,
            // Up the front of the animal and back down: the stalk is the thing
            // being moved, and both forelimbs are solved to wherever it is.
            stalk: { x: 32 - lift * 6, y: 20 + lift * 24 },
            stride: 2,
          }
        },
      }
  }
}

export { RobotPanda }
