"use client"

/**
 * robot-horse — the gait is the mechanism, and the load is what it produces.
 *
 * Five machines in this set already have four legs on the floor, and all five
 * answer *what moves a leg root*. This one does not ask that. Its back is a
 * plain solved topline and its withers are the anchor. What is new is
 * underneath: a **named gait is a real footfall sequence** — `solveGait` gives
 * the touchdown instant of every limb, counts the beat from them, and works out
 * what share of the standing weight each grounded foot is carrying.
 *
 * That share then drives two things nobody sets. **The fetlock is a spring**:
 * the pastern's angle is `fetlockSink(load)`, so a loaded limb visibly sinks
 * and a swinging one recoils, and what you are watching is the support pattern
 * made visible. **The neck is a balance beam**: its carriage answers the
 * forehand's loading, so a walking horse nods once a stride and a trotting one
 * barely nods, out of the same arithmetic rather than two scripts. Drag across
 * it and you scrub the stride one footfall at a time.
 *
 * Design note: docs/equine-robots.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  clamp,
  lerp,
  lerp2,
  normalize2,
  rotate2,
  solveChain2,
  toDegrees,
  toRadians,
  type Vec2,
} from "@/lib/robocn/kinematics"
import {
  fetlockSink,
  solveGait,
  type EquineGait,
  type GaitLead,
  type GaitLeg,
  type GaitLegId,
  type GaitPose,
} from "@/lib/robocn/gait"
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

export type HorseBehavior = "walk" | "trot" | "canter" | "gallop" | "graze" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/** Where the body's centre stands in the frame, and the floor underneath it. */
const ORIGIN = 118
const GROUND = 150
const BOX = { width: 260, height: 180 } as const
/** Half the track: the legs are either side of the trunk. */
const HALF_TRACK = 11

/** Withers to croup along the back, and how high the withers stand. */
const TRUNK = 52
const WITHERS = 74
/** Humerus then radius to the knee, and the rigid cannon below it. */
const FORE = [22, 24] as const
const FORE_CANNON = 17
/** Femur then tibia to the hock, and the rigid metatarsus below it. */
const HIND = [23, 24] as const
const HIND_CANNON = 20
/** The pastern: the one link in the limb whose angle is an output. */
const PASTERN = 10
/** How far off the horizontal an unloaded pastern stands, in degrees. */
const PASTERN_REST = 58
/** Cervical chain: withers to the poll, solved. */
const NECK = [24, 19] as const
/** Where the poll is put, relative to the body axis: head to the floor, head up. */
const NECK_ANGLE = { down: -85, up: 68 } as const
/** And how far out, kept close to the chain's own reach so the crest arches
 *  instead of folding. */
const NECK_SPAN = { down: 40, up: 38.5 } as const
/** The dock and the skirt hung off the croup. */
const TAIL = 52
/** Where the dock leaves the croup, in degrees off the body's own axis:
 *  hanging at rest, clamped under the quarters, or flagged out behind. */
const TAIL_SET = { rest: 78, clamped: 108, flagged: 2 } as const
/** How far a full suspension lifts the whole machine, in world units. */
const RISE = 14
/** How far the neck's carriage swings between a loaded and an unloaded forehand. */
const NOD = 1.8
/** Half the span between the ear axes, and the ear itself. */
const EAR_ACROSS = 3.8
const EAR_HEIGHT = 8.5
const EAR_HALF = 2.9

/** How far the camera pulls back so the machine still fits a frame drawn for one view. */
const fits: Record<RobotView, number> = { plan: 1.2, front: 1.15, profile: 1, iso: 0.95 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** How the beat count reads out loud. */
const beatNames = ["", "one-beat", "two-beat", "three-beat", "four-beat"] as const

/**
 * The side elevation's own camera, kept at module scope. The ears pan out of
 * the plane the machine is drawn in, so even the native drawing projects them.
 */
const sideCamera = robotCamera(NATIVE_VIEW)

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface HorseLimb {
  id: GaitLegId
  side: "left" | "right"
  fore: boolean
  /** Share of the body's weight this limb is carrying, 0–1. */
  load: number
  contact: boolean
  /** Shoulder, or hip. */
  root: Vec2
  /** Elbow, or stifle. */
  mid: Vec2
  /** Knee, or hock — the top of the cannon. */
  knee: Vec2
  /** The sprung joint: its height over the hoof is `fetlockSink(load)` and
   *  nothing else. */
  fetlock: Vec2
  hoof: Vec2
}

export interface RobotHorseProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: HorseBehavior
  /** Footfall pattern, overriding the one the behavior picked. `pace` is only reachable here. */
  gait?: EquineGait
  /** Which foreleg lands last. Only the canter and the gallop have a lead. */
  lead?: GaitLead
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Strides per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a string of them breaks step. */
  offset?: number
  /** Back curvature, −1 hollowed to 1 roached. Omit and the behavior sets it. */
  arch?: number
  /** Leg fold, 0 standing tall to 1 dropped. Omit and the behavior decides. */
  crouch?: number
  /** Scripted neck carriage, −1 head to the floor to 1 head up. What the balance moves. */
  neck?: number
  /** How much of the carriage the forehand's load takes, 0 scripted to 1 fully derived. */
  balance?: number
  /** Tail carriage, −1 clamped down to 1 flagged up. Omit and the behavior sets it. */
  tail?: number
  /** Ears, −1 pinned back to 1 pricked forward. Omit and they answer the pointer. */
  ears?: number
  /** Head and eye aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** Drag across to scrub the stride; arrows step it. The head tracks the pointer. */
  interactive?: boolean
  onPhaseChange?: (phase: number) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the hooves carrying weight. */
  showContacts?: boolean
  label?: string
}

function RobotHorse({
  behavior = "walk", gait, lead = "right", phase, view = NATIVE_VIEW,
  speed = 0.6, animate = true, paused = false, offset = 0,
  arch, crouch, neck, balance, tail, ears, gaze,
  interactive = true, onPhaseChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  role, tabIndex, onKeyDown, onBlur, ...props
}: RobotHorseProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [scrubbed, setScrubbed] = React.useState<number | null>(null)

  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && scrubbed === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const scripted = horseBehaviorPose(behavior, clock)
  const beat = controlled
    ? finiteClamp(phase, -1e6, 1e6, 0)
    : (scrubbed ?? clock * (Number.isFinite(speed) ? speed : 0))
  const cycle = wrap(beat)
  const stance = scripted.stance(cycle)

  const apply = React.useCallback(
    (next: number) => {
      const wrapped = wrap(next)
      setScrubbed(wrapped)
      onPhaseChange?.(wrapped)
    },
    [onPhaseChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // The width of the box is one whole stride, so a person can walk it
    // through the footfalls one at a time.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  /* ---- the gait: who is down, and what each of them is carrying ---------- */

  const walking = gait ?? scripted.gait
  const pose = solveGait({
    gait: walking,
    phase: cycle,
    lead,
    stride: scripted.stride,
    lift: scripted.lift,
  })
  // What the forehand is carrying right now, against what it carries standing
  // square. That difference is the whole of the nod.
  const foreLoad = pose.legs.reduce((sum, leg) => (leg.fore ? sum + leg.load : sum), 0)
  const nod = NOD * (foreLoad - pose.forehand)

  /* ---- the back, anchored at the withers --------------------------------- */

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const rise = clamp(stance.altitude, 0, 1) * RISE
  // A horse holds a topline: the same restrained scaling the dog and the fox
  // use, positive roaching the back and negative hollowing it.
  const curvature = bow * 0.2
  // Half the solver's arc, run back, puts the crown in the middle with both
  // ends level instead of dropping one of them.
  const tilt = -(curvature * spineLimits.turn) / 2
  const back = tiltPose(
    solveSpine({
      segments: 6,
      length: TRUNK,
      phase: cycle,
      amplitude: scripted.flex,
      waves: 0.7,
      taper: 0.35,
      turn: curvature,
    }),
    tilt,
  )
  // The withers are the anchor: the solved chain is re-hung on its first joint,
  // so the croup is what the arch and the stride move.
  const withersHeight = lerp(WITHERS, WITHERS - 12, fold) + rise
  const nose = back.joints[0].position
  const spinePoint = (index: number): Vec2 => ({
    x: back.joints[index].position.x - nose.x + 16,
    y: back.joints[index].position.y - nose.y + withersHeight,
  })
  const last = back.joints.length - 1
  const withersAt = spinePoint(0)
  const croup = spinePoint(last)

  /** A point `down` world units below the back line at spine joint `index`. */
  const underBack = (index: number, down: number): Vec2 => {
    const normal = toRadians(back.joints[index].angle + 90)
    const at = spinePoint(index)
    return { x: at.x - Math.cos(normal) * down, y: at.y - Math.sin(normal) * down }
  }
  const shoulder = underBack(1, 9)
  const hip = underBack(5, 8)

  /* ---- four limbs, each with one joint nobody sets ------------------------ */

  const metaAngle = lerp(22, 40, fold)
  const limbs: HorseLimb[] = pose.legs.map((leg) => solveLimb(leg, shoulder, hip, metaAngle, rise))

  /* ---- the neck: solved, and carried by the forehand's load --------------- */

  const scriptedNeck = finiteClamp(neck ?? stance.neck, -1, 1, stance.neck)
  const weight = finiteClamp(balance ?? scripted.balance, 0, 1, scripted.balance)
  const carriage = clamp(scriptedNeck + nod * weight, -1, 1)
  const crestAngle = back.joints[0].angle
  const nape = alongBody(withersAt, crestAngle, 5, 8)
  // The target is set in polar terms, at very nearly the chain's full reach:
  // a two-link neck asked for a point well inside its own reach folds into a
  // loop rather than arching, and an arched crest is the whole silhouette.
  const carried = (carriage + 1) / 2
  const reach = alongBody(
    nape,
    crestAngle + lerp(NECK_ANGLE.down, NECK_ANGLE.up, carried),
    lerp(NECK_SPAN.down, NECK_SPAN.up, carried),
    0,
  )
  const [, crest, poll] = solveChain2(nape, reach, [...NECK], { bend: "down" })
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  // The head hangs off the poll: a horse carries its face well below the line
  // of its own neck, which is what the offset is.
  const headTilt = toDegrees(Math.atan2(poll.y - crest.y, poll.x - crest.x)) + aim * 7 - 24

  /* ---- mane and tail ----------------------------------------------------- */

  // The mane is a ribbon on the neck's own line, so it follows the solved chain
  // rather than having to be kept in step with it.
  const crestLine = sampleRibbon([nape, crest, lerp2(crest, poll, 0.84)], 9)
  const maneJoints = crestLine.map((point, index) => {
    const s = index / (crestLine.length - 1)
    const before = crestLine[Math.max(0, index - 1)]
    const after = crestLine[Math.min(crestLine.length - 1, index + 1)]
    // The crest's own outward normal, so the mane sits on the top line of the
    // neck at any carriage instead of always standing straight up.
    const normal = normalize2({ x: -(after.y - before.y), y: after.x - before.x }, { x: 0, y: 1 })
    const streamed = scripted.mane * Math.sin(Math.PI * 2 * (cycle * 1.5 - s * 0.6)) * (0.3 + s * 0.7)
    // Measured from the crest line, so the ribbon starts at the neck's own
    // surface: the inner edge is the neck, the outer edge is the hair.
    const out = lerp(6.5, 2.6, s) + streamed * 1.8
    return { x: point.x + normal.x * out, y: point.y + normal.y * out }
  })

  const tailCarriage = finiteClamp(tail ?? scripted.tail, -1, 1, scripted.tail)
  const skirt = solveSpine({
    segments: 7,
    length: TAIL,
    phase: cycle * 1.4,
    amplitude: clamp(scripted.mane * 0.8, 0, 1) * 0.5,
    waves: 0.9,
    taper: 1,
    turn: lerp(0.42, -0.12, (tailCarriage + 1) / 2),
  })
  // A tail hangs by default and has to be carried to come up, so the two
  // halves of the range are not the same size.
  const tailTurn = back.joints[last].angle + (tailCarriage >= 0
    ? lerp(TAIL_SET.rest, TAIL_SET.flagged, tailCarriage)
    : lerp(TAIL_SET.rest, TAIL_SET.clamped, -tailCarriage))
  const tailJoints = skirt.joints.map((joint) => {
    const point = rotate2(joint.position, toRadians(tailTurn))
    // A tail hangs; it does not go through the floor.
    return { x: point.x + croup.x, y: Math.max(1.5, point.y + croup.y) }
  })

  /* ---- ears -------------------------------------------------------------- */

  const earAim = finiteClamp(ears ?? (pointer.target ? 1 : scripted.ears), -1, 1, 0)
  // Pricked forward, or rotated back and flattened onto the poll.
  const earTip = lerp(-34, 16, (earAim + 1) / 2)
  const earPan = lerp(26, 4, (earAim + 1) / 2)

  /* ---- paint ------------------------------------------------------------- */

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), ORIGIN, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the animal's own frame, `across` units off the centre plane. */
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  /** The same for a point that already knows how far off the plane it is. */
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)
  /** A three-dimensional point in the flat side-elevation drawing. */
  const flat = (p: Solid): Vec2 => {
    const screen = sideCamera.project(p.across, p.up, -p.forward)
    return { x: screen.x, y: -screen.y }
  }

  const readout = Math.round(cycle * 100)
  const state = behavior === "graze"
    ? "grazing"
    : walking === "halt"
      ? "standing square"
      : `at a ${walking}`
  const gaitPhrase = pose.beats > 0
    ? `${beatNames[pose.beats] ?? `${pose.beats}-beat`} ${walking}${pose.leadLeg ? ` on the ${pose.lead} lead` : ""}, ${readout} percent through its stride`
    : "four feet down"

  /** One ear's outline, in the animal's own three-space frame. */
  function earOutline(across: number): Solid[] {
    const pan = toRadians(across > 0 ? earPan : -earPan)
    const t = toRadians(earTip)
    // An ear is a funnel, not a plate: its outline stands in the plane that
    // contains the vertical and the direction it faces, so panning it round
    // foreshortens the triangle instead of leaving it flat to the camera.
    const side = { forward: Math.cos(pan), up: 0, across: Math.sin(pan) }
    const up = {
      forward: -Math.cos(pan) * Math.sin(t),
      up: Math.cos(t),
      across: -Math.sin(pan) * Math.sin(t),
    }
    const base = alongBody(poll, headTilt, -1.5, 4.5)
    const point = (along: number, out: number): Solid => ({
      forward: base.x + up.forward * along + side.forward * out,
      up: base.y + up.up * along + side.up * out,
      across: across + up.across * along + side.across * out,
    })
    return [point(0, -EAR_HALF), point(EAR_HEIGHT, EAR_HALF * 0.18), point(0, EAR_HALF)]
  }

  /** One limb, in the animal's own y-up frame. */
  function limbDrawing(limb: HorseLimb) {
    const far = limb.side === "right"
    const shift = far ? -7 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y })
    return (
      <g
        key={limb.id}
        data-leg={limb.id}
        data-load={px(limb.load)}
        opacity={far ? 0.5 : 1}
      >
        <path d={capsulePath(move(limb.root), move(limb.mid), limb.fore ? 5.4 : 6.6)} {...shell} />
        <path d={capsulePath(move(limb.mid), move(limb.knee), limb.fore ? 3.8 : 4.4)} {...machined} />
        {/* The cannon, then the pastern, which is the sprung one. */}
        <path d={capsulePath(move(limb.knee), move(limb.fetlock), 2.4)} {...cast} />
        <path data-pastern={limb.id} d={capsulePath(move(limb.fetlock), move(limb.hoof), 2.1)} {...machined} />
        {/* The hoof: a wedge on the floor, toe forward. */}
        <path
          d={`M ${px(move(limb.hoof).x - 3.4)} ${px(move(limb.hoof).y + 1.2)} L ${px(move(limb.hoof).x + 3.6)} ${px(move(limb.hoof).y + 1.6)} L ${px(move(limb.hoof).x + 3.2)} ${px(move(limb.hoof).y - 2.6)} L ${px(move(limb.hoof).x - 3)} ${px(move(limb.hoof).y - 2.6)} Z`}
          {...cast}
        />
        <circle data-hoof={limb.id} cx={px(move(limb.hoof).x)} cy={px(move(limb.hoof).y)} r={0.01} fill="none" />
        <circle
          data-joint={`${limb.id}-${limb.fore ? "elbow" : "stifle"}`}
          cx={px(move(limb.mid).x)} cy={px(move(limb.mid).y)} r={3.4} {...cast}
        />
        <circle cx={px(move(limb.knee).x)} cy={px(move(limb.knee).y)} r={2.6} {...cast} />
        {/* The joint no one sets: it sits where the load puts it, and lights
            in proportion to what it is carrying. */}
        <circle data-fetlock={limb.id} cx={px(move(limb.fetlock).x)} cy={px(move(limb.fetlock).y)} r={2.6} {...cast} />
        {limb.load > 0 && (
          <circle
            cx={px(move(limb.fetlock).x)} cy={px(move(limb.fetlock).y)} r={px(0.7 + limb.load * 1.2)}
            fill={palette.accent}
          />
        )}
        {showContacts && limb.contact && (
          <ellipse data-contact cx={px(move(limb.hoof).x)} cy={1.2} rx={5} ry={1.1} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot horse, ${state}, ${gaitPhrase}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent through the stride` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      width={width}
      height={px((width * BOX.height) / BOX.width)}
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
        if (!interactive || event.defaultPrevented) return
        const step = event.shiftKey ? 0.15 : 0.05
        if (event.key === "ArrowRight" || event.key === "ArrowUp") apply(cycle + step)
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") apply(cycle - step)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") setScrubbed(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging && !controlled) setScrubbed(null)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d={`M 12 ${GROUND} H ${BOX.width - 12} M ${ORIGIN} 14 V ${GROUND + 16}`} strokeDasharray="2 3" />
          {/* The stride, marked out under the machine: one box is one cycle. */}
          <path
            data-stride
            d={`M 20 ${GROUND + 12} H ${px(20 + (BOX.width - 40) * cycle)}`}
            strokeDasharray="1 2"
          />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d={`M 14 ${GROUND} H ${BOX.width - 14}`} stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={ORIGIN}
            cy={px(GROUND + 3)}
            rx={px(54 - rise * 0.8)}
            ry={px(4.6 - rise * 0.1)}
            fill={palette.dark}
            opacity={px(0.16 - rise * 0.004)}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${px(fit)})`}>
          {/* The barrel, one extruded footprint per spine segment, so the
              topline survives the projection instead of flattening to a box. */}
          {back.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 5, 4).map((p) => ({ x: p.x, y: p.y - midX }))
            return <path key={index} d={extrudedPath(footprint, camera, midY + 10, midY - 11)} {...shell} />
          })}
          {/* Each limb on its own side of the centre plane, so a plan or a
              front elevation shows the real splay of the stride rather than
              four legs stacked in one line. */}
          {limbs.map((limb) => {
            const across = limb.side === "left" ? HALF_TRACK : -HALF_TRACK
            return (
              <g key={limb.id}>
                <path d={capsulePath(at(limb.root, across * 0.6), at(limb.mid, across), limb.fore ? 5.4 : 6.6)} {...shell} />
                <path d={capsulePath(at(limb.mid, across), at(limb.knee, across), limb.fore ? 3.8 : 4.4)} {...machined} />
                <path d={capsulePath(at(limb.knee, across), at(limb.fetlock, across), 2.4)} {...cast} />
                <path d={capsulePath(at(limb.fetlock, across), at(limb.hoof, across), 2.1)} {...machined} />
              </g>
            )
          })}
          {/* The neck and the skull as solids, and the tail as a tapering tube. */}
          <path d={capsulePath(at(nape), at(crest), 9)} {...machined} />
          <path d={capsulePath(at(crest), at(poll), 6.2)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(5.5, 15, 5, 5).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 5,
              poll.y - 6,
            )}
            {...shell}
          />
          {tailJoints.slice(0, -1).map((joint, index) => (
            <path
              key={index}
              d={capsulePath(at(joint), at(tailJoints[index + 1]), px(4 * (1 - (index / (tailJoints.length - 1)) ** 1.6) + 1.2))}
              {...machined}
            />
          ))}
        </g>
      )}

      <Frame {...frame}>
        {/* The drawing works in the animal's own frame: x forward, y up. */}
        <g data-horse data-view={view} transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}>
          {limbs.filter((limb) => limb.side === "right").map(limbDrawing)}

          <g data-tail>
            {tailJoints.slice(0, -1).map((joint, index) => (
              <path
                key={index}
                d={capsulePath(joint, tailJoints[index + 1], px(4 * (1 - (index / (tailJoints.length - 1)) ** 1.6) + 1.2))}
                {...machined}
              />
            ))}
            <circle cx={px(croup.x)} cy={px(croup.y)} r={3.4} {...cast} />
          </g>

          <g data-trunk>
            {/* The barrel is the solver's output: level topline, deep girth, a
                croup that comes back down over the hind legs. */}
            {([0, last] as const).map((index) => {
              const joint = back.joints[index]
              const place = spinePoint(index)
              const normal = toRadians(joint.angle + 90)
              const radius = (backline(joint.s) + girth(joint.s)) / 2
              const nudge = (backline(joint.s) - girth(joint.s)) / 2
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
            <path data-spine d={bodyOutline(back, spinePoint, backline, girth)} {...shell} />
            {/* Two seams down the flank, and nothing more. */}
            <g fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.24}>
              <path d={offsetLine(back, spinePoint, (t) => 4.5 - 1.6 * Math.sin(Math.PI * t))} />
              <path d={offsetLine(back, spinePoint, (t) => -(8 - 3 * Math.sin(Math.PI * t)))} />
            </g>
          </g>

          {/* The neck: two solved links, and the mane riding the crest. */}
          <path data-neck d={capsulePath(nape, crest, 9)} {...machined} />
          <path d={capsulePath(crest, poll, 6.2)} {...machined} />
          <path
            data-mane
            d={`${maneJoints.map((joint, index) => `${index ? "L" : "M"} ${px(joint.x)} ${px(joint.y)}`).join(" ")} ${[...crestLine].reverse().map((joint) => `L ${px(joint.x)} ${px(joint.y)}`).join(" ")} Z`}
            {...cast}
          />

          <g data-ears>
            {([-EAR_ACROSS, EAR_ACROSS] as const).map((across) => (
              <path
                key={across}
                data-ear={across > 0 ? "left" : "right"}
                d={polygon(earOutline(across).map(view === NATIVE_VIEW ? flat : solid))}
                opacity={across > 0 ? 1 : 0.62}
                {...shell}
              />
            ))}
          </g>

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            {/* The poll is the top-rear corner of the skull, not its centre:
                a head hangs off the end of the neck. */}
            <g transform="translate(1 -3) scale(0.98)">
            {/* A long head: deep at the jowl, straight down the face, and
                nearly as long again in front of the eye. */}
            {/* One head: jowl, face and muzzle in a single outline, because a
                horse's head has no break in it. The dark band is the muzzle
                itself, which is the only part that is another colour. */}
            <path
              d="M -8 -9 Q -12 7 -1.5 9.5 Q 7 9.5 11 5.5 Q 18 4.6 26 3.4 Q 29.5 2.6 29.5 -0.6 Q 29.5 -4.4 25.5 -5.4 Q 17 -7.4 10 -7.4 L 9.5 -6 Q 4 -11.5 -3 -11.5 Q -7.5 -11.5 -8 -9 Z"
              {...shell}
            />
            <path d="M 22 -6.4 Q 29.5 -5 29.5 -0.6 Q 29.5 2.6 25.8 3.5 Q 22.5 4 21.5 3.8 Q 24 0.6 22 -6.4 Z" {...cast} />
            <circle cx={25.4} cy={-1.4} r={1.7} fill={palette.metal} />
            {/* The jowl and the cheekbone, which are what give the head its edge. */}
            <path d="M -6.5 -1.5 Q 1.5 -4 7 -0.5 Q 1.5 2.5 -5.5 1.5 Z" fill={palette.dark} opacity={0.18} stroke="none" />
            <path d="M 10.5 -6.6 L 11 5.4" fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.3} />
            <g data-eyes>
              <g transform="translate(-3.4 -5)" opacity={0.5}>
                <circle r={2.4} {...cast} />
                <circle cx={px(0.8 + aim * 0.9)} r={1.1} fill={palette.accent} />
              </g>
              <g transform="translate(1.8 -5.6)">
                <circle r={3.1} {...cast} />
                <circle cx={px(1 + aim * 1.2)} r={1.5} fill={palette.accent} />
              </g>
            </g>
            </g>
          </g>

          {limbs.filter((limb) => limb.side === "left").map(limbDrawing)}

          <g data-joints>
            <circle data-joint="withers" cx={px(withersAt.x)} cy={px(withersAt.y)} r={3} {...cast} />
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={4.6} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={1.8} fill={palette.metal} />
            <circle data-joint="poll" cx={px(poll.x)} cy={px(poll.y)} r={2.6} {...cast} />
          </g>
        </g>
      </Frame>

      {label && (
        <text x={BOX.width / 2} y={BOX.height - 6} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
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
 * One limb, built from the hoof upwards, which is the only order the sprung
 * fetlock can be built in: the pastern's angle comes from the load, so the
 * fetlock's place is known before anything above it is, and the chain above is
 * then solved to it.
 */
function solveLimb(
  leg: GaitLeg,
  shoulder: Vec2,
  hip: Vec2,
  metaAngle: number,
  rise: number,
): HorseLimb {
  const root = leg.fore ? shoulder : hip
  const hoof: Vec2 = {
    x: (leg.fore ? shoulder.x - 1 : hip.x + 3) + leg.foot.x,
    y: leg.foot.y + rise,
  }
  // The one angle nobody sets: a loaded pastern flattens toward the floor and
  // a free one stands back up.
  const pastern = toRadians(PASTERN_REST - fetlockSink(leg.load))
  const fetlock: Vec2 = {
    x: hoof.x - Math.cos(pastern) * PASTERN,
    y: hoof.y + Math.sin(pastern) * PASTERN,
  }
  if (leg.fore) {
    // The knee carries the cannon straight up off the fetlock, and the humerus
    // and radius solve to it.
    const knee: Vec2 = { x: fetlock.x + 1.5, y: fetlock.y + FORE_CANNON }
    const [, elbow] = solveChain2(root, knee, [...FORE], { bend: "down" })
    return { id: leg.id, side: leg.side, fore: true, load: leg.load, contact: leg.contact && rise < 0.5, root, mid: elbow, knee, fetlock, hoof }
  }
  // The hock is where the free parameter of a three-link hind limb is spent:
  // the metatarsus stands at an angle that opens with the crouch, and the femur
  // and tibia solve to it.
  const hock: Vec2 = {
    x: fetlock.x - Math.sin(toRadians(metaAngle)) * HIND_CANNON,
    y: fetlock.y + Math.cos(toRadians(metaAngle)) * HIND_CANNON,
  }
  const [, stifle] = solveChain2(root, hock, [...HIND], { bend: "up" })
  return { id: leg.id, side: leg.side, fore: false, load: leg.load, contact: leg.contact && rise < 0.5, root, mid: stifle, knee: hock, fetlock, hoof }
}

/** The barrel, withers to croup: level topline, deep girth, a tucked flank. */
const backline = (s: number) => 8.5 + 3.5 * s * s
const girth = (s: number) =>
  s < 0.35 ? lerp(15.5, 11.5, s / 0.35) : lerp(11.5, 16, (s - 0.35) / 0.65)

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

/** A point `forward` along a body axis and `up` its normal. */
function alongBody(origin: Vec2, degrees: number, forward: number, up: number): Vec2 {
  const a = toRadians(degrees)
  return {
    x: origin.x + Math.cos(a) * forward - Math.sin(a) * up,
    y: origin.y + Math.sin(a) * forward + Math.cos(a) * up,
  }
}

/** A polyline resampled to `count` evenly spaced points along its own length. */
function sampleRibbon(points: Vec2[], count: number): Vec2[] {
  const spans = points.slice(0, -1).map((point, index) => Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y))
  const total = spans.reduce((sum, span) => sum + span, 0)
  if (total < 1e-6) return Array.from({ length: count }, () => points[0])
  return Array.from({ length: count }, (_, step) => {
    let walk = (step / (count - 1)) * total
    for (let index = 0; index < spans.length; index += 1) {
      if (walk <= spans[index] || index === spans.length - 1) {
        const t = spans[index] < 1e-6 ? 0 : clamp(walk / spans[index], 0, 1)
        return {
          x: lerp(points[index].x, points[index + 1].x, t),
          y: lerp(points[index].y, points[index + 1].y, t),
        }
      }
      walk -= spans[index]
    }
    return points[points.length - 1]
  })
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

const polygon = (points: Vec2[]) =>
  `${points.map((p, index) => `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`

/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value as number, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

export interface HorseStance {
  /** Back curvature, −1 hollow to 1 roached. */
  arch: number
  /** Leg fold, 0 tall to 1 dropped. */
  crouch: number
  /** Scripted neck carriage, −1 head to the floor to 1 head up. */
  neck: number
  /** Height off the floor through a suspension, 0–1. */
  altitude: number
}

export interface HorsePose {
  /** The footfall pattern this behaviour runs. */
  gait: EquineGait
  gaze: number
  ears: number
  tail: number
  /** How much of the neck's carriage the forehand's load takes, 0–1. */
  balance: number
  /** Normalized foot travel, 0–1. */
  stride: number
  /** Normalized swing height, 0–1. */
  lift: number
  /** Mane and tail wave amplitude, 0–1. */
  mane: number
  /** Spine wave amplitude, 0–1. A horse holds a topline, so it is nearly spent. */
  flex: number
  stance: (cycle: number) => HorseStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function horseBehaviorPose(behavior: HorseBehavior, clock: number): HorsePose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Two beats, diagonal pairs, with a suspension between each. The back is
    // level and there is almost nothing for the nod to do, which is exactly
    // what a trot looks like.
    case "trot":
      return {
        gait: "trot",
        gaze: 0.12 * Math.sin(time * 0.7),
        ears: 0.8,
        tail: 0.35,
        balance: 0.25,
        stride: 0.72,
        lift: 0.6,
        mane: 0.35,
        flex: 0.04,
        stance: (cycle) => ({
          arch: 0.02,
          crouch: 0.16,
          neck: 0.66,
          // Two suspensions a stride: one after each diagonal leaves.
          altitude: 0.1 * Math.max(0, Math.sin(2 * Math.PI * (2 * wrap(cycle) + 0.22))),
        }),
      }
    // Three beats on a lead, and the one gait where the whole body rises and
    // falls once a stride.
    case "canter":
      return {
        gait: "canter",
        gaze: 0.1 * Math.sin(time * 0.8),
        ears: 0.85,
        tail: 0.5,
        balance: 0.45,
        stride: 0.85,
        lift: 0.7,
        mane: 0.6,
        flex: 0.08,
        stance: (cycle) => {
          const t = wrap(cycle)
          return {
            arch: 0.12 * Math.sin(2 * Math.PI * t),
            crouch: 0.14,
            neck: 0.62,
            altitude: 0.42 * Math.max(0, Math.sin(Math.PI * clamp((t - 0.72) / 0.3, 0, 1))),
          }
        },
      }
    // Four beats, the longest stride, and everything streaming.
    case "gallop":
      return {
        gait: "gallop",
        gaze: 0.06 * Math.sin(time * 0.9),
        ears: 0.55,
        tail: 0.8,
        balance: 0.55,
        stride: 1,
        lift: 0.85,
        mane: 1,
        flex: 0.12,
        stance: (cycle) => {
          const t = wrap(cycle)
          return {
            arch: 0.2 * Math.sin(2 * Math.PI * t),
            crouch: 0.1,
            neck: 0.46,
            altitude: 0.6 * Math.max(0, Math.sin(Math.PI * clamp((t - 0.78) / 0.26, 0, 1))),
          }
        },
      }
    // Halted with the head right down, and the odd shift of weight.
    case "graze":
      return {
        gait: "halt",
        gaze: 0.08 * Math.sin(time * 0.4),
        ears: -0.2,
        tail: 0.15,
        balance: 0,
        stride: 0,
        lift: 0,
        mane: 0.08,
        flex: 0.02,
        stance: () => ({
          arch: -0.12,
          crouch: 0.1,
          neck: -0.95,
          altitude: 0,
        }),
      }
    case "static":
      return {
        gait: "halt",
        gaze: 0,
        ears: 0.5,
        tail: 0.2,
        balance: 0,
        stride: 0,
        lift: 0,
        mane: 0,
        flex: 0,
        stance: () => ({ arch: 0, crouch: 0.12, neck: 0.68, altitude: 0 }),
      }
    // The signature: four beats in a lateral sequence, never off the floor,
    // and the neck nodding once a stride because the forehand loads and
    // unloads once a stride. Nobody scripts that nod.
    default:
      return {
        gait: "walk",
        gaze: 0.16 * Math.sin(time * 0.5),
        ears: 0.7,
        tail: 0.25,
        balance: 1,
        stride: 0.55,
        lift: 0.45,
        mane: 0.2,
        flex: 0.03,
        stance: () => ({ arch: 0, crouch: 0.14, neck: 0.62, altitude: 0 }),
      }
  }
}

export { RobotHorse }
