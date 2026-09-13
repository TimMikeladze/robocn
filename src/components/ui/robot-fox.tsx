"use client"

/**
 * robot-fox — a quadruped whose attitude is the mechanism.
 *
 * Three machines here hang legs off a solved spine, and they answer the same
 * question three ways. `robot-cat`: the back arches and both leg roots move.
 * `robot-dog`: the hip is a spine joint and the shoulder swings on a blade.
 * This one: **the whole animal tips.** `pitch` rotates the entire modelled
 * body about its own hip — the one joint it does not move — so the withers
 * swing up and the forelegs answer for it, and once the floor is past their
 * reach they fold rather than dangle, because the arithmetic says they cannot
 * be put down. Two more mechanisms are geometry rather than artwork: the brush
 * is an *output*, its carriage derived from the pitch and the rate the pitch is
 * changing at, and the two ears pan independently onto one point, so their axes
 * converge and the disparity between them is a real number. `solveSpine` twice
 * and `solveChain2` five times. Click and it dives.
 *
 * Design note: docs/robot-fox.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, rotate2, solveChain2, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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

export type FoxBehavior = "mouse" | "trot" | "listen" | "curl" | "static"

/** Seconds one poked dive takes, rear to recovery. */
const DIVE = 1.05

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/** Where the hip stands in the frame, and the floor underneath it. */
const ORIGIN = 116
const GROUND = 136
/** Half the track: the legs are either side of the trunk. */
const HALF_TRACK = 8

/** Withers to croup along the back, and the brush hung off the croup. */
const TRUNK = 54
const BRUSH = 50
/** Humerus then radius to the carpus, and the rigid pastern below it. */
const FORE = [15, 13] as const
const PASTERN = 6
/** Femur then tibia to the hock, and the rigid metatarsus below it. */
const HIND = [17, 14] as const
const META = 12
/** Cervical chain: withers to the poll, solved. */
const NECK = [13, 11] as const
/** How far a full rear tips the whole animal about its hip, in degrees. */
const PITCH_LIMIT = 46
/** How far the suspension of a trot, or a dive, lifts the machine. */
const LIFT = 26
/** Half the span between the two ear axes: the baseline the disparity is over. */
const EAR_ACROSS = 4
/** The ear itself: tall, because it is the sensor. */
const EAR_HEIGHT = 16
const EAR_HALF = 6.2
/** How far off the nose axis `bearing` 1 puts the quarry, in degrees. */
const BEARING_LIMIT = 75

/** How far the camera pulls back so the machine still fits a frame drawn for one view. */
const fits: Record<RobotView, number> = { plan: 0.92, front: 1, profile: 1, iso: 0.95 }

/**
 * Framing only, in viewBox units, and no part of the geometry. The hip is the
 * anchor this animal is built on, which puts it at the tail end of a body that
 * is mostly in front of it; the cameras that lay that length down the frame
 * would run it off one edge with the other left empty. This slides the finished
 * projection so it uses the whole drawing.
 */
const framing: Record<RobotView, number> = { plan: -24, front: 0, profile: 0, iso: -6 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The side elevation's own camera, kept at module scope. The ears pan out of
 * the plane the machine is drawn in, so even the native drawing has to project
 * them rather than plot them flat.
 */
const sideCamera = robotCamera(NATIVE_VIEW)

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface FoxLeg {
  id: LegId
  side: "left" | "right"
  fore: boolean
  /** The shoulder, carried by the tipping trunk, or the hip, which is fixed. */
  root: Vec2
  /** Elbow, or stifle. */
  mid: Vec2
  /** Carpus, or hock. */
  joint: Vec2
  paw: Vec2
  contact: boolean
  /** How far past its own reach of the floor this limb has been taken, 0–1. */
  folded: number
}

/** Which leg is which, and where in the stride it sits. The canid trot:
 *  diagonal pairs, so fore-left lands with hind-right. */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "fore-left", side: "left", fore: true, offset: 0 },
  { id: "fore-right", side: "right", fore: true, offset: 0.5 },
  { id: "hind-left", side: "left", fore: false, offset: 0.5 },
  { id: "hind-right", side: "right", fore: false, offset: 0 },
]

export interface RobotFoxProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: FoxBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Cycles per second: one stride per cycle at a trot, one hunt per cycle mousing. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  offset?: number
  /** Body attitude, −1 nose to the floor to 1 reared onto the hind legs. The
   *  whole animal turns about its hip. Omit and the behavior sets it. */
  pitch?: number
  /** Back curvature, −1 hollowed to 1 roached. Omit and the behavior sets it. */
  arch?: number
  /** How far the legs are folded, 0 standing tall to 1 flattened. Omit and the behavior decides. */
  crouch?: number
  /** Tail carriage, −1 tucked under to 1 straight up. What the counterweight overrides. */
  tail?: number
  /** How much of the carriage the body takes, 0 scripted to 1 pure counterweight. */
  counterweight?: number
  /** Ears, −1 folded back to 1 pricked forward. Omit and they answer the pointer. */
  ears?: number
  /** Where the quarry is across the nose axis, −1..1. Both ears pan onto it. */
  bearing?: number
  /** How close the quarry is, 0 far off to 1 right in front. It is what makes
   *  the two ear axes converge. Omit and the pointer's height sets it. */
  range?: number
  /** Head and eye aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** The eyes track the pointer, the pointer is the quarry, and a click dives. */
  interactive?: boolean
  onDive?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the paws carrying weight. */
  showContacts?: boolean
  label?: string
}

function RobotFox({
  behavior = "mouse", phase, view = NATIVE_VIEW, speed = 0.5, animate = true, paused = false, offset = 0,
  pitch, arch, crouch, tail, counterweight, ears, bearing, range, gaze,
  interactive = true, onDive,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotFoxProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [dived, setDived] = React.useState<number | null>(null)
  const since = dived === null ? Infinity : clock - dived
  const poked = since >= 0 && since < DIVE

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = foxBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  const stance = scripted.stance(beat)
  // A poked dive rides on top of whatever the behaviour is doing, eased out at
  // the end so the animal settles rather than snapping back.
  const dive = poked ? foxDive(since / DIVE) : null
  const blend = poked ? Math.min(1, (DIVE - since) / 0.2) : 0

  /**
   * The body's attitude at any point in the cycle, gesture and all. Pure, so
   * the counterweight can sample it either side of now and get a rate without
   * carrying anything across renders.
   */
  const pitchAtCycle = (at: number, elapsed: number) => {
    const base = scripted.stance(at).pitch
    const poke = elapsed >= 0 && elapsed < DIVE
      ? foxDive(elapsed / DIVE).pitch * Math.min(1, (DIVE - elapsed) / 0.2)
      : 0
    return clamp(base + poke, -1, 1)
  }

  const rate = Number.isFinite(speed) ? speed : 0
  const now = finiteClamp(pitch ?? pitchAtCycle(beat, since), -1, 1, 0)
  // A controlled pitch, or a controlled phase, is a still: there is no motion
  // anyone can know the rate of, so the counterweight works from the angle
  // alone. Otherwise take it analytically, a few milliseconds either side.
  const swinging = !controlled && pitch === undefined
  const pitchRate = swinging
    ? (pitchAtCycle(beat + STEP * rate, since + STEP) - pitchAtCycle(beat - STEP * rate, since - STEP)) / (2 * STEP)
    : 0

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const haunch = clamp(stance.haunch, 0, 1)
  const rise = clamp(stance.altitude + (dive ? dive.lift * blend : 0), 0, 1)
  const weight = finiteClamp(counterweight ?? scripted.counterweight, 0, 1, scripted.counterweight)
  const scriptedTail = finiteClamp(tail ?? stance.tail, -1, 1, stance.tail)
  // What the brush is for: it opposes the attitude, and leads the turn a little
  // rather than trailing it, which is the difference between a counterweight
  // and a pendulum. A proportional rule, not an inertia tensor.
  const balance = clamp(-now * 0.95 - clamp(pitchRate * 0.06, -0.5, 0.5), -1, 1)
  const carriage = lerp(scriptedTail, balance, weight)

  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const earAim = finiteClamp(ears ?? (pointer.target ? 1 : scripted.ears), -1, 1, 0)
  const sight = finiteClamp(bearing ?? pointer.target?.x ?? scripted.bearing, -1, 1, 0)
  const near = finiteClamp(
    range ?? (pointer.target ? clamp(0.5 - pointer.target.y * 0.5, 0, 1) : scripted.range),
    0, 1, scripted.range,
  )

  /* ---- the back, tipped about the hip ------------------------------------ */

  const hipHeight = lerp(36, 24, fold) * (1 - haunch * 0.72) + rise * LIFT
  // `turn` is a constant curvature over the body. A fox holds a topline the way
  // a dog does, so the same restrained scaling: positive roaches it, negative
  // hollows it.
  const curvature = bow * 0.24
  // The solver's arc starts level at the nose and curves away, which would drop
  // one end rather than bowing the middle; half the arc, run back, puts the
  // crown in the middle with both ends level. The pitch rides on top of it, and
  // is the thing this machine is for.
  const tilt = -(curvature * spineLimits.turn) / 2 + now * PITCH_LIMIT
  const pitched = tiltPose(
    solveSpine({
      segments: 6,
      length: TRUNK,
      phase: beat,
      amplitude: scripted.flex,
      waves: 0.8,
      taper: 0.2,
      turn: curvature,
    }),
    tilt,
  )
  // The hip is the anchor. Re-hanging the solved chain on its *last* joint is
  // what makes the pitch a rotation about the hip: the croup is the one point
  // that does not move, and the withers swing about it.
  const croup = pitched.joints[pitched.joints.length - 1].position
  const hip: Vec2 = { x: 0, y: hipHeight }
  const spinePoint = (index: number): Vec2 => ({
    x: pitched.joints[index].position.x - croup.x + hip.x,
    y: pitched.joints[index].position.y - croup.y + hip.y,
  })
  const withers = spinePoint(0)

  // Where the shoulder rides: one joint back from the withers and down the
  // body's own normal, so it is carried by the trunk rather than the spine line.
  const thorax = pitched.joints[1]
  const under = toRadians(thorax.angle + 90)
  const shoulder: Vec2 = {
    x: spinePoint(1).x - Math.cos(under) * 6,
    y: spinePoint(1).y - Math.sin(under) * 6,
  }

  /* ---- four legs: two on a tipping trunk, two on the fixed hip ----------- */

  const metaAngle = lerp(14, 44, fold) + haunch * 30
  const foreReach = FORE[0] + FORE[1]
  const legs: FoxLeg[] = legPlan.map(({ id, side, fore, offset: legOffset }) => {
    const step = footfall(stance.stride + legOffset, 11, 7)
    const floor: Vec2 = {
      x: (fore ? shoulder.x - 1 : hip.x + 2 + haunch * 18) + step.x,
      y: step.y + rise * LIFT,
    }
    if (fore) {
      // The wrist is what the chain solves to; a rigid pastern carries it down.
      const wrist: Vec2 = { x: floor.x, y: floor.y + PASTERN }
      const span = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y)
      // Past its own reach of the floor the limb has nowhere to stand, so it
      // draws in under the chest instead of dangling at full stretch. The fold
      // starts exactly at the reach limit and deepens with how far past it the
      // body has taken the shoulder.
      const folded = clamp((span - foreReach) / 12, 0, 1)
      const drawn = folded > 0 ? foreReach * lerp(1, 0.52, folded) : span
      const scale = span > 1e-6 ? drawn / span : 0
      const target: Vec2 = {
        x: shoulder.x + (wrist.x - shoulder.x) * scale,
        y: shoulder.y + (wrist.y - shoulder.y) * scale,
      }
      const [, elbow, carpus] = solveChain2(shoulder, target, [...FORE], { bend: "down" })
      return {
        id, side, fore, root: shoulder, mid: elbow, joint: carpus,
        paw: { x: carpus.x, y: carpus.y - PASTERN },
        contact: folded < 0.02 && step.y < 1e-6 && rise < 0.02,
        folded,
      }
    }
    // The hock is where the free parameter of a three-link hind limb is spent:
    // the metatarsus is carried at a scripted angle that opens with the crouch,
    // and the femur and tibia are solved to it.
    const hock: Vec2 = {
      x: floor.x - Math.sin(toRadians(metaAngle)) * META,
      y: floor.y + Math.cos(toRadians(metaAngle)) * META,
    }
    const [, stifle, heel] = solveChain2(hip, hock, [...HIND], { bend: "up" })
    return {
      id, side, fore, root: hip, mid: stifle, joint: heel,
      paw: {
        x: heel.x + Math.sin(toRadians(metaAngle)) * META,
        y: Math.max(0, heel.y - Math.cos(toRadians(metaAngle)) * META),
      },
      contact: step.y < 1e-6 && rise < 0.02,
      folded: 0,
    }
  })

  /* ---- the brush, hung off the hip and carried by the body ---------------- */

  const brush = solveSpine({
    segments: 8,
    length: BRUSH,
    phase: beat * 1.5,
    amplitude: clamp(scripted.lash + Math.min(0.5, Math.abs(pitchRate) * 0.05) * weight, 0, 1) * 0.6,
    waves: 1,
    taper: 1,
    turn: carriage * 0.45,
  })
  // It leaves the croup continuing the back, then lifts by its carriage.
  const brushTurn = pitched.tail.angle - carriage * 70
  const brushJoints = brush.joints.map((joint) => {
    const point = rotate2(joint.position, toRadians(brushTurn))
    // A tail lies along the floor; it does not go through it.
    return { x: point.x + hip.x, y: Math.max(2, point.y + hip.y) }
  })

  /* ---- neck solved to the poll, head hung off the end of it --------------- */

  const crestAngle = pitched.joints[0].angle
  const nape = alongBody(withers, crestAngle, -2, 5)
  const target = alongBody(withers, crestAngle, 20, 17)
  const [, crest, poll] = solveChain2(nape, target, [...NECK], { bend: "up" })
  const headTilt = toDegrees(Math.atan2(poll.y - crest.y, poll.x - crest.x)) + aim * 6 - 34

  /* ---- the ears: two axes onto one point --------------------------------- */

  const heard = foxEarBearing(sight, near)
  const tip = lerp(78, -6, (earAim + 1) / 2)
  const earRoots: { id: "left" | "right"; across: number; pan: number }[] = [
    { id: "right", across: -EAR_ACROSS, pan: heard.right },
    { id: "left", across: EAR_ACROSS, pan: heard.left },
  ]

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

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
  /** The same for a point that already knows how far off the plane it is. */
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)
  /**
   * A three-dimensional point in the flat side-elevation drawing. Exact for the
   * native camera, which is what the flat artwork is in every view.
   */
  const flat = (p: Solid): Vec2 => {
    const screen = sideCamera.project(p.across, p.up, -p.forward)
    return { x: screen.x, y: -screen.y }
  }

  /** One ear's outline, in the animal's own three-space frame. */
  function earOutline(across: number, pan: number): Solid[] {
    const a = toRadians(pan)
    const t = toRadians(tip)
    // An ear is a funnel, not a plate, so its outline stands in the plane that
    // contains the vertical and the direction it faces. At rest that plane is
    // the animal's own and the side elevation shows the whole triangle; panned
    // onto a quarry off to one side the ear turns across the centre plane and
    // foreshortens, which is what a profile should say about an ear that has
    // turned away. `up` is world-up tipped back inside the same plane by the
    // fold, so the triangle stays a triangle at any pan and any fold.
    const side = { forward: Math.cos(a), up: 0, across: Math.sin(a) }
    const up = {
      forward: -Math.cos(a) * Math.sin(t),
      up: Math.cos(t),
      across: -Math.sin(a) * Math.sin(t),
    }
    // Set on the back of the skull, and the far one carried forward the way the
    // far legs are: in a side elevation a symmetric pair lands on top of itself,
    // and the rest of this machine already separates them to be read.
    const base = alongBody(poll, headTilt, across < 0 ? -8.5 : -6, 3.5)
    const point = (along: number, out: number): Solid => ({
      forward: base.x + up.forward * along + side.forward * out,
      up: base.y + up.up * along + side.up * out,
      across: across + up.across * along + side.across * out,
    })
    return [point(0, -EAR_HALF), point(EAR_HEIGHT, EAR_HALF * 0.22), point(0, EAR_HALF)]
  }

  const state = poked
    ? "diving"
    : behavior === "trot"
      ? "trotting"
      : behavior === "listen"
        ? "listening"
        : behavior === "curl"
          ? "curled up"
          : behavior === "mouse"
            ? "mousing"
            : "still"

  /** One leg, in the animal's own y-up frame. */
  function legDrawing(leg: FoxLeg) {
    const far = leg.side === "right"
    const shift = far ? -6 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y })
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.5 : 1}>
        <path d={capsulePath(move(leg.root), move(leg.mid), leg.fore ? 4.4 : 5.4)} {...shell} />
        <path d={capsulePath(move(leg.mid), move(leg.joint), leg.fore ? 3 : 3.4)} {...machined} />
        <path d={capsulePath(move(leg.joint), move(leg.paw), 2.4)} {...cast} />
        {/* The paw: a flat pad on the floor, toes forward. */}
        <rect x={px(move(leg.paw).x - 3.4)} y={px(move(leg.paw).y)} width={9} height={3.6} rx={1.8} {...machined} />
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.mid).x)} cy={px(move(leg.mid).y)} r={3.2} {...cast}
        />
        <circle cx={px(move(leg.joint).x)} cy={px(move(leg.joint).y)} r={2.4} {...cast} />
        {leg.fore && (
          <circle
            data-joint={`${leg.id}-shoulder`}
            cx={px(move(leg.root).x)} cy={px(move(leg.root).y)} r={2.9} {...cast}
          />
        )}
        {showContacts && leg.contact && (
          <ellipse data-contact cx={px(move(leg.paw).x + 1.8)} cy={1.4} rx={5.6} ry={1.2} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }

  /**
   * The brush: fat for most of its length and then tipped, which is the one
   * thing that reads as a fox at 150px.
   */
  function brushDrawing() {
    return (
      <g data-brush>
        {brushJoints.slice(0, -1).map((joint, index) => (
          <path
            key={index}
            d={capsulePath(joint, brushJoints[index + 1], px(5 * (1 - (index / (brushJoints.length - 1)) ** 2.6) + 1.5))}
            {...machined}
          />
        ))}
        {/* Banding: two or three marks per part, no more. */}
        {brushJoints.filter((_, index) => index % 3 === 1).map((joint, index) => (
          <circle key={index} cx={px(joint.x)} cy={px(joint.y)} r={2.1} {...cast} />
        ))}
        <circle
          cx={px(brushJoints[brushJoints.length - 1].x)}
          cy={px(brushJoints[brushJoints.length - 1].y)}
          r={2.4}
          {...shell}
        />
      </g>
    )
  }

  /** Both ears, projected, because their motion is out of the page. */
  function earDrawing(project: (p: Solid) => Vec2) {
    return (
      <g data-ears>
        {earRoots.map(({ id, across, pan }) => {
          const rim = earOutline(across, pan).map(project)
          return (
            <g key={id} opacity={id === "right" ? 0.62 : 1}>
              <path data-ear={id} d={polygon(rim)} {...shell} />
              {/* The concha: the same triangle drawn in toward its own centre,
                  so it stays inside the rim at every pan instead of crossing
                  itself when the projection foreshortens the ear. */}
              <path d={polygon(inset(rim, 0.58))} {...machined} />
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot fox, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 250 170"
      width={width}
      height={px((width * 170) / 250)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setDived(clock)
        onDive?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 136 H 238 M 116 14 V 154" strokeDasharray="2 3" />
          {/* The reach the fold is keyed to: past this circle the floor cannot
              be stood on, and the foreleg draws in. */}
          <circle cx={px(ORIGIN + shoulder.x)} cy={px(GROUND - shoulder.y)} r={px(foreReach)} strokeDasharray="3 4" />
          {/* The sight line the two ears are panned onto. */}
          <path
            data-bearing
            d={sightLine(poll, heard.quarry, view === NATIVE_VIEW ? flat : solid, ORIGIN, GROUND, fit)}
            strokeDasharray="1 3"
          />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 14 136 H 236" stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={px(ORIGIN + 6)}
            cy={139}
            rx={px(46 - rise * 14)}
            ry={px(4.5 - rise * 1.8)}
            fill={palette.dark}
            opacity={px(0.16 - rise * 0.07)}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${px(GROUND + slide)}) scale(${px(fit)})`}>
          {/* The trunk, one extruded footprint per spine segment, so the topline
              survives the tip instead of flattening into a box. */}
          {pitched.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 4, 4).map((p) => ({ x: p.x, y: p.y - midX }))
            return <path key={index} d={extrudedPath(footprint, camera, midY + 8, midY - 8)} {...shell} />
          })}
          {([-HALF_TRACK, HALF_TRACK] as const).map((across) => (
            <g key={across}>
              {legs.map((leg) => (
                <g key={leg.id}>
                  <path d={capsulePath(at(leg.root, across * 0.7), at(leg.mid, across), leg.fore ? 4.6 : 5.6)} {...shell} />
                  <path d={capsulePath(at(leg.mid, across), at(leg.joint, across), leg.fore ? 3.2 : 3.6)} {...machined} />
                  <path d={capsulePath(at(leg.joint, across), at(leg.paw, across), 2.5)} {...cast} />
                </g>
              ))}
            </g>
          ))}
          {/* The brush as a tube that thickens before it tips. */}
          {brushJoints.slice(0, -1).map((joint, index) => (
            <path
              key={index}
              d={capsulePath(at(joint), at(brushJoints[index + 1]), px(5 * (1 - (index / (brushJoints.length - 1)) ** 2.6) + 1.5))}
              {...machined}
            />
          ))}
          {/* The neck, so the skull is carried rather than left floating off
              the end of the body once the camera drops the vertical. */}
          <path d={capsulePath(at(nape), at(crest), 5.2)} {...machined} />
          <path d={capsulePath(at(crest), at(poll), 4.4)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(6.5, 11, 5, 5).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 6,
              poll.y - 6,
            )}
            {...shell}
          />
          {/* Projected, not billboarded: the plan and isometric cameras are the
              only ones that can show the two ear axes converging. */}
          {earDrawing(solid)}
        </g>
      )}

      <Frame {...frame}>
        {/* The drawing works in the animal's own frame: x forward, y up. */}
        <g data-fox data-view={view} transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}>
          {legs.filter((leg) => leg.side === "right").map(legDrawing)}
          {brushDrawing()}

          <g data-trunk>
            {/* The barrel is the solver's own output: level topline, shallow
                chest, long tucked loin — no artwork to keep in step with it. */}
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
            {/* Two seams down the flank, and nothing more. */}
            <g fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.26}>
              <path d={offsetLine(pitched, spinePoint, (t) => 3.8 - 1.4 * Math.sin(Math.PI * t))} />
              <path d={offsetLine(pitched, spinePoint, (t) => -(6 - 2.6 * Math.sin(Math.PI * t)))} />
            </g>
          </g>

          {/* The neck: two solved links, so the head rides the rear. */}
          <path data-neck d={capsulePath(nape, crest, 5.2)} {...machined} />
          <path d={capsulePath(crest, poll, 4.4)} {...machined} />

          {earDrawing(flat)}

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            {/* A narrow wedge skull and the long sharp muzzle in front of it. */}
            <path d="M -7 -6 Q -8 6 -1 7 Q 6 7 9 3.5 Q 11 -1 8 -4.5 Q 2.5 -8 -2 -8 Q -6.5 -8 -7 -6 Z" {...shell} />
            <path d="M 7.5 -3.4 Q 20 -3.6 21.5 -0.4 L 21.5 1.2 Q 19 2.4 7.5 3 Z" {...machined} />
            <path d="M 7.5 1 Q 17 1.4 20.5 1.6 L 20.5 2.4 Q 16 2.6 7.5 2.6 Z" {...cast} />
            <circle cx={20.6} cy={-0.6} r={1.5} fill={palette.dark} />
            <g data-eyes>
              <g transform="translate(-0.6 1.2)" opacity={0.55}>
                <circle r={2.1} {...cast} />
                <circle cx={px(0.8 + aim * 0.9)} r={1} fill={palette.accent} />
              </g>
              <g transform="translate(3.2 0.4)">
                <circle r={2.7} {...cast} />
                <circle cx={px(1 + aim * 1.2)} r={1.4} fill={palette.accent} />
              </g>
            </g>
          </g>

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          {/* The hip, drawn last and marked, because it is the joint the whole
              animal turns about. */}
          <g data-joints>
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={4.4} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={1.7} fill={palette.metal} />
          </g>
        </g>
      </Frame>

      {label && (
        <text x={125} y={164} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/** Seconds either side of now the counterweight samples the pitch at. */
const STEP = 0.008

/**
 * The barrel, withers to croup. A fox is low and long: the topline is level,
 * the chest is shallower than a dog's, the loin tucks hard and the croup comes
 * back down over the hind legs.
 */
const backline = (s: number) => 9.5 + 0.6 * s
const bellyline = (s: number) =>
  s < 0.5 ? lerp(12.5, 7.5, s / 0.5) : lerp(7.5, 10.5, (s - 0.5) / 0.5)

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
 * A point `forward` along a body axis and `up` its normal. The spine solver's
 * headings point nose-ward, so this is the frame every part hung off the body
 * is placed in, and it is what carries the head and the ears through a rear.
 */
function alongBody(origin: Vec2, degrees: number, forward: number, up: number): Vec2 {
  const a = toRadians(degrees)
  return {
    x: origin.x + Math.cos(a) * forward - Math.sin(a) * up,
    y: origin.y + Math.sin(a) * forward + Math.cos(a) * up,
  }
}

/** The spine's own line, offset `width` along each joint's normal and left
 *  open: the flank seam, which a closed ribbon draws as a pointed loop. */
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

const polygon = (points: Vec2[]) =>
  `${points.map((p, index) => `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`

/** A polygon drawn in toward its own centroid: `k` 1 is the shape itself. */
function inset(points: Vec2[], k: number): Vec2[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length
  return points.map((p) => ({ x: lerp(cx, p.x, k), y: lerp(cy, p.y, k) }))
}

/** The blueprint sight line, poll to quarry, through whichever camera is on. */
function sightLine(
  poll: Vec2,
  quarry: { forward: number; across: number },
  project: (p: Solid) => Vec2,
  originX: number,
  originY: number,
  fit: number,
) {
  const head = project({ forward: poll.x, up: poll.y, across: 0 })
  const mark = project({ forward: poll.x + quarry.forward, up: poll.y, across: quarry.across })
  const to = (p: Vec2) => `${px(originX + p.x * fit)} ${px(originY - p.y * fit)}`
  return `M ${to(head)} L ${to(mark)}`
}

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/**
 * Where one paw is in its own stride: carried backwards through the stance,
 * arced forward with ground clearance through the swing. Duty 0.5 is the trot
 * — two feet down, diagonally paired, and a moment with none.
 */
function footfall(cycle: number, reach: number, clearance: number): Vec2 {
  const t = wrap(cycle)
  const duty = 0.5
  if (t < duty) return { x: reach * (1 - (2 * t) / duty), y: 0 }
  const swing = (t - duty) / (1 - duty)
  return { x: -reach * Math.cos(Math.PI * swing), y: clearance * Math.sin(Math.PI * swing) }
}

/**
 * Both ear axes onto one quarry, and the disparity between them.
 *
 * The quarry is placed in the animal's plan frame by `bearing` — across the
 * nose axis, ±`BEARING_LIMIT` — and `range`, 0 far off to 1 right in front.
 * Each ear then pans to face it from its own place on a fixed baseline, so the
 * two axes converge: the disparity grows as the quarry closes and goes to zero
 * as it opens, which is the whole reason for having two ears a span apart.
 *
 * Angles are degrees, positive turning toward the left ear.
 */
export function foxEarBearing(bearing: number, range: number): {
  left: number
  right: number
  disparity: number
  quarry: { forward: number; across: number }
} {
  const across = Number.isFinite(bearing) ? clamp(bearing, -1, 1) : 0
  const close = Number.isFinite(range) ? clamp(range, 0, 1) : 0
  const distance = lerp(70, 16, close)
  const azimuth = toRadians(across * BEARING_LIMIT)
  const quarry = {
    forward: Math.cos(azimuth) * distance,
    across: Math.sin(azimuth) * distance,
  }
  const pan = (from: number) => toDegrees(Math.atan2(quarry.across - from, quarry.forward))
  const left = pan(EAR_ACROSS)
  const right = pan(-EAR_ACROSS)
  return { left, right, disparity: left - right, quarry }
}

/** The one gesture a click fires: rear, then over the top and nose-first down. */
export function foxDive(t: number): { pitch: number; lift: number } {
  const u = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  const rear = Math.sin(Math.PI * clamp(u / 0.45, 0, 1))
  const over = Math.sin(Math.PI * clamp((u - 0.4) / 0.6, 0, 1))
  return {
    pitch: 0.85 * rear - 0.9 * over,
    // Off the floor between the rear and the landing, and no longer.
    lift: 0.7 * Math.sin(Math.PI * clamp((u - 0.45) / 0.45, 0, 1)),
  }
}

export interface FoxStance {
  /** Body attitude, −1 nose down to 1 reared. The whole animal turns about the hip. */
  pitch: number
  /** Back curvature, −1 hollow to 1 roached. */
  arch: number
  /** Leg fold, 0 tall to 1 flat. */
  crouch: number
  /** Extra hind fold: 1 puts the croup on the floor. */
  haunch: number
  /** Scripted tail carriage, −1 tucked to 1 up. What the counterweight overrides. */
  tail: number
  /** Height off the floor, 0–1. */
  altitude: number
  /** Where the footfall cycle has got to. Held constant and the feet are planted. */
  stride: number
}

export interface FoxPose {
  gaze: number
  ears: number
  /** Where the quarry is across the nose axis, −1..1. */
  bearing: number
  /** How close the quarry is, 0 far to 1 in front. */
  range: number
  /** How much of the tail's carriage the body takes, 0–1. */
  counterweight: number
  /** Brush wave amplitude, 0–1: the whip in a tail that has just been thrown. */
  lash: number
  /** Spine wave amplitude, 0–1. Nearly spent: a canid trot is what a stiff back is for. */
  flex: number
  stance: (cycle: number) => FoxStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function foxBehaviorPose(behavior: FoxBehavior, clock: number): FoxPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // The straight-line canid trot: level back, diagonal pairs, the brush
    // streaming out behind and very little for the counterweight to do.
    case "trot":
      return {
        gaze: 0.18 * Math.sin(time * 0.6),
        ears: 0.8,
        bearing: 0.2 * Math.sin(time * 0.9),
        range: 0.3,
        counterweight: 0.25,
        lash: 0.3,
        flex: 0.05,
        stance: (cycle) => ({
          pitch: 0.05 * Math.sin(2 * Math.PI * 2 * wrap(cycle)),
          arch: 0.04,
          crouch: 0.26,
          haunch: 0,
          tail: 0.35,
          // Two suspensions per stride: one after each diagonal pair leaves.
          altitude: 0.14 * Math.max(0, Math.sin(2 * Math.PI * (2 * wrap(cycle) + 0.25))),
          stride: cycle,
        }),
      }
    // Planted and still, both ears working a bearing across the frame. The one
    // behaviour where the ears are the mechanism.
    case "listen":
      return {
        gaze: 0.3 * Math.sin(time * 0.8),
        ears: 1,
        bearing: 0.75 * Math.sin(time * 0.8),
        range: 0.55 + 0.35 * Math.sin(time * 0.5),
        counterweight: 0.5,
        lash: 0.12,
        flex: 0,
        stance: () => ({
          pitch: -0.06,
          arch: -0.04,
          crouch: 0.34,
          haunch: 0,
          tail: 0.25,
          altitude: 0,
          stride: 2,
        }),
      }
    // Down and asleep: croup folded, nose tucked, the brush right round over the
    // face. A sleeping fox is not balancing anything, so the counterweight is off.
    case "curl":
      return {
        gaze: 0.05 * Math.sin(time * 0.4),
        ears: -0.6,
        bearing: 0,
        range: 0.2,
        counterweight: 0,
        lash: 0.06,
        flex: 0.03,
        stance: () => ({
          pitch: 0.18,
          arch: 0.35,
          crouch: 0.9,
          haunch: 1,
          tail: 0.85,
          altitude: 0,
          stride: 2,
        }),
      }
    case "static":
      return {
        gaze: 0,
        ears: 0.55,
        bearing: 0,
        range: 0.35,
        counterweight: 0.35,
        lash: 0,
        flex: 0,
        stance: () => ({
          pitch: 0,
          arch: 0,
          crouch: 0.24,
          haunch: 0,
          tail: 0.3,
          altitude: 0,
          stride: 2,
        }),
      }
    // The mousing leap. Stalk in low, freeze, rear onto the hind legs, pitch
    // right over and dive nose-first, land on the forefeet and recover. The
    // pitch does all of it and the brush answers for it.
    default:
      return {
        gaze: 0.2 * Math.sin(time * 0.7),
        ears: 0.9,
        bearing: 0.15 * Math.sin(time * 0.9),
        range: 0.7,
        counterweight: 1,
        lash: 0.25,
        flex: 0.05,
        stance: (cycle) => {
          const t = wrap(cycle)
          const rear = Math.sin(Math.PI * clamp((t - 0.36) / 0.26, 0, 1))
          const over = Math.sin(Math.PI * clamp((t - 0.56) / 0.34, 0, 1))
          return {
            pitch: 0.9 * rear - 0.95 * over,
            arch: clamp(-0.1 + 0.3 * rear - 0.34 * over, -1, 1),
            crouch: clamp(0.62 - 0.4 * rear - 0.34 * over, 0, 1),
            haunch: 0,
            tail: 0.3,
            altitude: 0.55 * Math.sin(Math.PI * clamp((t - 0.58) / 0.3, 0, 1)),
            // It creeps in and then freezes: the stalk is the only part of the
            // hunt the feet move in.
            stride: (Math.min(t, 0.3) / 0.3) * 2,
          }
        },
      }
  }
}

export { RobotFox }
