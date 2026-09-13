"use client"

/**
 * robot-pegasus — one body, two ways of holding it up, and the number between.
 *
 * Nothing else in the registry negotiates between two support systems.
 * `robot-bird` beats its wings; six machines walk; none of them hands its
 * weight from one to the other. `lift` is that handover, and it is the same
 * load budget the horse already spends: the legs carry `1 − lift` of the body
 * and the wings carry `lift`. Take it up and four things happen for one reason
 * — the fetlocks recoil because the load driving them has gone, the body rises
 * off the ground line, the legs run out of floor inside their own reach and
 * fold in under the chest, and the gait's stride fades out while the wingbeat
 * fades in. One prop, four consequences, all of them arithmetic.
 *
 * The wing itself is the other new thing. `robot-bird` scripts its shoulder,
 * elbow and wrist angles through the beat. Here the **wingtip traces a path**
 * — a 1:2 Lissajous, which is the figure of eight a wingtip actually makes,
 * forward on the downstroke and back on the upstroke — and the three bones are
 * solved to it with `solveChain3`, in three space, so the articulation is an
 * output and folding the wing is nothing more than `spread` going to zero.
 *
 * Design note: docs/equine-robots.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  clamp,
  distance3,
  lerp,
  lerp2,
  normalize2,
  rotate2,
  solveChain2,
  solveChain3,
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

export type PegasusBehavior = "launch" | "canter" | "soar" | "hover" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const ORIGIN = 150
const GROUND = 180
const BOX = { width: 300, height: 225 } as const
const HALF_TRACK = 11

/** Withers to croup along the back, and how high the withers stand on the floor. */
const TRUNK = 52
const WITHERS = 74
const FORE = [22, 24] as const
const FORE_CANNON = 17
const HIND = [23, 24] as const
const HIND_CANNON = 20
const PASTERN = 10
const PASTERN_REST = 58
const NECK = [24, 19] as const
const NECK_ANGLE = { down: -85, up: 68 } as const
const NECK_SPAN = { down: 40, up: 38.5 } as const
const TAIL = 52
const TAIL_SET = { rest: 78, clamped: 108, flagged: 2 } as const
const EAR_ACROSS = 3.8
const EAR_HEIGHT = 8.5
const EAR_HALF = 2.9

/** How far a full `lift` takes the body off the ground line, in world units. */
const FLY_RISE = 40
/** And the extra a suspension adds while it is still on the floor. */
const RISE = 14

/** Humerus, radius, manus. Exported so the tests can hold them to their lengths. */
export const pegasusWingLinks = [19, 21, 28] as const
/** Where the wing roots sit, off the centre plane and above the shoulder. */
const WING_ROOT = { across: 8, up: 9, forward: 2 } as const
/** How far out of the root the tip can be taken, and how far it swings. */
const WING_SPAN = 62
const WING_ELEVATION = 54
const WING_SWEEP = 20
/** The smallest the path ever gets: a furled wing is still a wing. */
const WING_FURLED = 0.16

const fits: Record<RobotView, number> = { plan: 0.88, front: 0.92, profile: 1, iso: 0.86 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The body's flat artwork is authored in side elevation and carried to whatever
 * camera is on by the frame transform, so anything three-dimensional riding on
 * that artwork — the ears — projects through the elevation's own camera first.
 * The wings do not: they go through the real camera, in their own group.
 */
const sideCamera = robotCamera("profile")

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface PegasusLimb {
  id: GaitLegId
  side: "left" | "right"
  fore: boolean
  load: number
  contact: boolean
  /** How far past its own reach of the floor this limb has been taken, 0–1. */
  folded: number
  root: Vec2
  mid: Vec2
  knee: Vec2
  fetlock: Vec2
  hoof: Vec2
}

export interface RobotPegasusProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  view?: RobotView
  behavior?: PegasusBehavior
  /** Footfall pattern for whatever weight is still on the feet. */
  gait?: EquineGait
  lead?: GaitLead
  /** Controlled stride fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Strides per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** The handover: 0 the legs carry the whole animal, 1 the wings do. Omit and
   *  the behavior decides. */
  lift?: number
  /** Wing extension, 0 furled against the body to 1 spread. Omit and the
   *  behavior sets it — it comes up with the lift. */
  spread?: number
  /** Controlled wingbeat fraction. Omit and it runs off the stride. */
  beat?: number
  /** Wingbeats per stride. */
  wingbeats?: number
  arch?: number
  crouch?: number
  neck?: number
  tail?: number
  ears?: number
  gaze?: number
  /** Drag up and down to work the handover; arrows step it. The head tracks the pointer. */
  interactive?: boolean
  onLiftChange?: (lift: number) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  label?: string
}

function RobotPegasus({
  behavior = "launch", gait, lead = "right", phase, view = NATIVE_VIEW,
  speed = 0.5, animate = true, paused = false, offset = 0,
  lift, spread, beat, wingbeats, arch, crouch, neck, tail, ears, gaze,
  interactive = true, onLiftChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  role, tabIndex, onKeyDown, onBlur, ...props
}: RobotPegasusProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })
  const scripted = pegasusBehaviorPose(behavior, clock)
  const rate = Number.isFinite(speed) ? speed : 0
  const cycle = wrap(controlled ? finiteClamp(phase, -1e6, 1e6, 0) : clock * rate)
  const stance = scripted.stance(cycle)

  /* ---- the handover ------------------------------------------------------ */

  const carried = finiteClamp(lift ?? held ?? stance.lift, 0, 1, stance.lift)
  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onLiftChange?.(bounded)
    },
    [onLiftChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && lift === undefined,
    // The height of the box is the whole handover: floor at the bottom, flight
    // at the top, which is the gesture the machine is about.
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
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

  /* ---- what is left on the feet ------------------------------------------ */

  const walking = gait ?? scripted.gait
  const pose = solveGait({
    gait: walking,
    phase: cycle,
    lead,
    // A stride the animal is no longer taking its weight on shortens away.
    stride: scripted.stride * (1 - carried),
    lift: scripted.swing,
  })
  const rise = clamp(stance.altitude, 0, 1) * RISE + carried * FLY_RISE

  /* ---- the back ---------------------------------------------------------- */

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const curvature = bow * 0.2
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
  const withersHeight = lerp(WITHERS, WITHERS - 12, fold) + rise
  const nose = back.joints[0].position
  const spinePoint = (index: number): Vec2 => ({
    x: back.joints[index].position.x - nose.x + 16,
    y: back.joints[index].position.y - nose.y + withersHeight,
  })
  const last = back.joints.length - 1
  const withersAt = spinePoint(0)
  const croup = spinePoint(last)
  const underBack = (index: number, down: number): Vec2 => {
    const normal = toRadians(back.joints[index].angle + 90)
    const at = spinePoint(index)
    return { x: at.x - Math.cos(normal) * down, y: at.y - Math.sin(normal) * down }
  }
  const shoulder = underBack(1, 9)
  const hip = underBack(5, 8)

  /* ---- four limbs, unloading as the wings take over ---------------------- */

  const metaAngle = lerp(22, 40, fold)
  const limbs: PegasusLimb[] = pose.legs.map((leg) =>
    solveLimb(leg, shoulder, hip, metaAngle, rise, 1 - carried),
  )

  /* ---- two wings, each solved to its own tip path ------------------------ */

  const wingBeat = wrap(
    beat ?? cycle * finiteClamp(wingbeats ?? scripted.wingbeats, 0.1, 12, scripted.wingbeats),
  )
  const wingSpread = finiteClamp(spread ?? stance.spread, 0, 1, stance.spread)
  const wingRoot: Solid = {
    forward: spinePoint(1).x + WING_ROOT.forward,
    up: spinePoint(1).y + WING_ROOT.up,
    across: WING_ROOT.across,
  }
  const wings = ([1, -1] as const).map((side) => ({
    side: side > 0 ? ("left" as const) : ("right" as const),
    bones: wingChain(wingBeat, wingSpread, side, wingRoot),
  }))

  /* ---- neck, head, mane, tail -------------------------------------------- */

  const scriptedNeck = finiteClamp(neck ?? stance.neck, -1, 1, stance.neck)
  const crestAngle = back.joints[0].angle
  const nape = alongBody(withersAt, crestAngle, 5, 8)
  const reach = alongBody(
    nape,
    crestAngle + lerp(NECK_ANGLE.down, NECK_ANGLE.up, (scriptedNeck + 1) / 2),
    lerp(NECK_SPAN.down, NECK_SPAN.up, (scriptedNeck + 1) / 2),
    0,
  )
  const [, crest, poll] = solveChain2(nape, reach, [...NECK], { bend: "down" })
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const headTilt = toDegrees(Math.atan2(poll.y - crest.y, poll.x - crest.x)) + aim * 7 - 24

  const crestLine = sampleRibbon([nape, crest, lerp2(crest, poll, 0.84)], 9)
  const maneJoints = crestLine.map((point, index) => {
    const s = index / (crestLine.length - 1)
    const before = crestLine[Math.max(0, index - 1)]
    const after = crestLine[Math.min(crestLine.length - 1, index + 1)]
    const normal = normalize2({ x: -(after.y - before.y), y: after.x - before.x }, { x: 0, y: 1 })
    const streamed = scripted.mane * Math.sin(Math.PI * 2 * (cycle * 1.5 - s * 0.6)) * (0.3 + s * 0.7)
    const out = lerp(6.5, 2.6, s) + streamed * 1.8
    return { x: point.x + normal.x * out, y: point.y + normal.y * out }
  })

  const tailCarriage = finiteClamp(tail ?? stance.tail, -1, 1, stance.tail)
  const skirt = solveSpine({
    segments: 7,
    length: TAIL,
    phase: cycle * 1.4,
    amplitude: clamp(scripted.mane * 0.8, 0, 1) * 0.5,
    waves: 0.9,
    taper: 1,
    turn: lerp(0.42, -0.12, (tailCarriage + 1) / 2),
  })
  const tailTurn = back.joints[last].angle + (tailCarriage >= 0
    ? lerp(TAIL_SET.rest, TAIL_SET.flagged, tailCarriage)
    : lerp(TAIL_SET.rest, TAIL_SET.clamped, -tailCarriage))
  const tailJoints = skirt.joints.map((joint) => {
    const point = rotate2(joint.position, toRadians(tailTurn))
    // Off the floor there is no floor to lie on, so the clamp lifts with it.
    return { x: point.x + croup.x, y: Math.max(1.5 + rise * 0.9, point.y + croup.y) }
  })

  const earAim = finiteClamp(ears ?? (pointer.target ? 1 : scripted.ears), -1, 1, 0)
  const earTip = lerp(-34, 16, (earAim + 1) / 2)
  const earPan = lerp(26, 4, (earAim + 1) / 2)

  /* ---- paint ------------------------------------------------------------- */

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== "profile"
  const fit = fits[view] ?? 1
  const face = aboutPoint(camera.wall(0, 90), ORIGIN, GROUND, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)
  const flat = (p: Solid): Vec2 => {
    const screen = sideCamera.project(p.across, p.up, -p.forward)
    return { x: screen.x, y: -screen.y }
  }
  /** Ears ride the flat drawing, the way the fox's do. */
  const project = flat
  // Which wing is nearer the camera, and so drawn last.
  const wingDepth = (side: 1 | -1) => camera.depth(WING_ROOT.across * side, wingRoot.up, -wingRoot.forward)

  const readout = Math.round(carried * 100)
  const state = carried >= 0.995
    ? "flying"
    : carried <= 0.005
      ? `on the floor ${walking === "halt" ? "standing" : `at a ${walking}`}`
      : "handing its weight to the wings"

  function earOutline(across: number): Solid[] {
    const pan = toRadians(across > 0 ? earPan : -earPan)
    const t = toRadians(earTip)
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

  function limbDrawing(limb: PegasusLimb) {
    const far = limb.side === "right"
    const shift = far ? -7 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y })
    return (
      <g key={limb.id} data-leg={limb.id} data-load={px(limb.load)} opacity={far ? 0.5 : 1}>
        <path d={capsulePath(move(limb.root), move(limb.mid), limb.fore ? 5.4 : 6.6)} {...shell} />
        <path d={capsulePath(move(limb.mid), move(limb.knee), limb.fore ? 3.8 : 4.4)} {...machined} />
        <path d={capsulePath(move(limb.knee), move(limb.fetlock), 2.4)} {...cast} />
        <path data-pastern={limb.id} d={capsulePath(move(limb.fetlock), move(limb.hoof), 2.1)} {...machined} />
        <path
          d={`M ${px(move(limb.hoof).x - 3.4)} ${px(move(limb.hoof).y + 1.2)} L ${px(move(limb.hoof).x + 3.6)} ${px(move(limb.hoof).y + 1.6)} L ${px(move(limb.hoof).x + 3.2)} ${px(move(limb.hoof).y - 2.6)} L ${px(move(limb.hoof).x - 3)} ${px(move(limb.hoof).y - 2.6)} Z`}
          {...cast}
        />
        <circle data-hoof={limb.id} cx={px(move(limb.hoof).x)} cy={px(move(limb.hoof).y)} r={0.01} fill="none" />
        <circle data-joint={`${limb.id}-root`} cx={px(move(limb.root).x)} cy={px(move(limb.root).y)} r={0.01} fill="none" />
        <circle
          data-joint={`${limb.id}-${limb.fore ? "elbow" : "stifle"}`}
          cx={px(move(limb.mid).x)} cy={px(move(limb.mid).y)} r={3.4} {...cast}
        />
        <circle cx={px(move(limb.knee).x)} cy={px(move(limb.knee).y)} r={2.6} {...cast} />
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

  /**
   * One wing: the three solved bones, and the vane carried on them. The
   * primaries hang off the manus and the secondaries off the forearm, so the
   * whole surface is a consequence of where the solver put the spar.
   */
  function wingGroup(wing: (typeof wings)[number], behind: boolean) {
    const [root, elbow, wrist, tip] = wing.bones.joints.map(solid)
    const vane = wing.bones.vane.map(solid)
    return (
      <g
        key={wing.side}
        data-wing={wing.side}
        transform={`translate(${ORIGIN} ${GROUND}) scale(${px(fit)})`}
        opacity={behind ? 0.46 : 0.96}
      >
        <path
          d={`${vane.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`}
          {...machined}
        />
        <path d={capsulePath(root, elbow, 3.6)} {...machined} />
        <path d={capsulePath(elbow, wrist, 2.9)} {...machined} />
        <path d={capsulePath(wrist, tip, 2.2)} {...cast} />
        {/* The feather struts, drawn where the spar actually put them. */}
        <g fill="none" stroke={palette.dark} strokeWidth={0.6} opacity={0.3}>
          {wing.bones.quills.map((quill, index) => {
            const a = project(quill[0])
            const b = project(quill[1])
            return <path key={index} d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`} />
          })}
        </g>
        <circle data-wingtip={wing.side} cx={px(tip.x)} cy={px(tip.y)} r={2} {...cast} />
        <circle cx={px(elbow.x)} cy={px(elbow.y)} r={2.4} {...cast} />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot pegasus, ${state}, ${readout} percent of its weight on the wings, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent of its weight on the wings` : undefined}
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
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(carried + delta)
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
          <path d={`M 12 ${GROUND} H ${BOX.width - 12} M ${ORIGIN} 12 V ${GROUND + 16}`} strokeDasharray="2 3" />
          {/* The handover itself, read off the side of the frame. */}
          <path
            data-handover
            d={`M 18 ${px(GROUND - carried * FLY_RISE)} H 34`}
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
            rx={px(54 - carried * 18)}
            ry={px(4.6 - carried * 1.6)}
            fill={palette.dark}
            opacity={px(0.16 - carried * 0.1)}
          />
        </g>
      )}

      {/* The far wing, behind the whole machine. */}
      {wingGroup(wings[wingDepth(1) <= wingDepth(-1) ? 0 : 1], true)}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${px(fit)})`}>
          {back.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 5, 4).map((p) => ({ x: p.x, y: p.y - midX }))
            return <path key={index} d={extrudedPath(footprint, camera, midY + 10, midY - 11)} {...shell} />
          })}
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
        <g data-pegasus data-view={view} data-lift={px(carried)} transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}>
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
            <g fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.24}>
              <path d={offsetLine(back, spinePoint, (t) => 4.5 - 1.6 * Math.sin(Math.PI * t))} />
              <path d={offsetLine(back, spinePoint, (t) => -(8 - 3 * Math.sin(Math.PI * t)))} />
            </g>
          </g>

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
                d={polygon(earOutline(across).map(project))}
                opacity={across > 0 ? 1 : 0.62}
                {...shell}
              />
            ))}
          </g>

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(-headTilt)})`}>
            <g transform="translate(1 -3) scale(0.98)">
              <path
                d="M -8 -9 Q -12 7 -1.5 9.5 Q 7 9.5 11 5.5 Q 18 4.6 26 3.4 Q 29.5 2.6 29.5 -0.6 Q 29.5 -4.4 25.5 -5.4 Q 17 -7.4 10 -7.4 L 9.5 -6 Q 4 -11.5 -3 -11.5 Q -7.5 -11.5 -8 -9 Z"
                {...shell}
              />
              <path d="M 22 -6.4 Q 29.5 -5 29.5 -0.6 Q 29.5 2.6 25.8 3.5 Q 22.5 4 21.5 3.8 Q 24 0.6 22 -6.4 Z" {...cast} />
              <circle cx={25.4} cy={-1.4} r={1.7} fill={palette.metal} />
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

      {/* And the near one, in front of it. */}
      {wingGroup(wings[wingDepth(1) > wingDepth(-1) ? 0 : 1], false)}

      {label && (
        <text x={BOX.width / 2} y={BOX.height - 6} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* the wing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Where the wingtip is, in the animal's own frame, at one point of the beat.
 *
 * A 1:2 Lissajous — one cycle up and down against two fore and aft — is a
 * figure of eight, which is the path a wingtip actually traces: forward on the
 * downstroke, back on the upstroke. Everything else about the wing is solved to
 * this, so `spread` closing the path is the whole of folding the wing.
 *
 * The returned point is relative to the wing root, with `across` positive to
 * the animal's left.
 */
export function pegasusWingtip(beat: number, spread: number): Solid {
  const t = Number.isFinite(beat) ? ((beat % 1) + 1) % 1 : 0
  const open = lerp(WING_FURLED, 1, Number.isFinite(spread) ? clamp(spread, 0, 1) : 0)
  const elevation = toRadians(WING_ELEVATION * Math.sin(2 * Math.PI * t))
  return {
    across: WING_SPAN * open * Math.cos(elevation),
    up: WING_SPAN * open * Math.sin(elevation),
    forward: WING_SWEEP * open * Math.sin(4 * Math.PI * t),
  }
}

export interface PegasusWingBones {
  /** Root, elbow, wrist, tip — in the wing's own frame, relative to the root. */
  joints: Solid[]
  /** The three solved bone lengths, which never change. */
  lengths: number[]
}

/**
 * The three bones solved to the tip path, in the wing's own frame. Pure, so the
 * tests can hold every bone to its own length at any beat and any spread
 * without rendering anything.
 */
export function pegasusWingBones(beat: number, spread: number): PegasusWingBones {
  const tip = pegasusWingtip(beat, spread)
  // The wing's frame: x across, y up, z nose-ward. The elbow and wrist break
  // toward the tail, which is the way a wing folds.
  const solved = solveChain3(
    { x: 0, y: 0, z: 0 },
    { x: tip.across, y: tip.up, z: tip.forward },
    [...pegasusWingLinks],
    { up: { x: 0, y: 0, z: -1 } },
  )
  return {
    joints: solved.map((joint) => ({ across: joint.x, up: joint.y, forward: joint.z })),
    lengths: solved.slice(0, -1).map((joint, index) => distance3(joint, solved[index + 1])),
  }
}

interface WingChain {
  joints: Solid[]
  /** The outline of the vane, carried on the solved spar. */
  vane: Solid[]
  /** Feather struts, from the spar out to the trailing edge. */
  quills: [Solid, Solid][]
}

/** One wing placed on the body: the solved spar, mirrored for its own side. */
function wingChain(beat: number, spread: number, side: 1 | -1, root: Solid): WingChain {
  const bones = pegasusWingBones(beat, spread)
  const place = (point: Solid): Solid => ({
    forward: root.forward + point.forward,
    up: root.up + point.up,
    across: root.across * side + point.across * side,
  })
  const joints = bones.joints.map(place)
  const [, elbow, wrist, tip] = joints
  // The trailing edge hangs back off the spar, deepest at the elbow and
  // tapering to nothing at the tip — so the vane is where the solver put it.
  const behind = (point: Solid, depth: number): Solid => ({
    forward: point.forward - depth,
    up: point.up - depth * 0.18,
    across: point.across,
  })
  const open = lerp(WING_FURLED, 1, clamp(spread, 0, 1))
  // Chord roughly half the span at the elbow, tapering to nothing at the tip:
  // the shape a wing is, hung on wherever the solver put the spar.
  const vane: Solid[] = [
    joints[0],
    elbow,
    wrist,
    tip,
    behind(tip, 7 * open),
    behind(wrist, 27 * open),
    behind(elbow, 33 * open),
    behind(joints[0], 18 * open),
  ]
  const quills: [Solid, Solid][] = [0.25, 0.5, 0.75].flatMap((t): [Solid, Solid][] => {
    const spar = mixSolid(wrist, tip, t)
    return [[spar, behind(spar, lerp(24, 8, t) * open)]]
  })
  quills.push([mixSolid(elbow, wrist, 0.5), behind(mixSolid(elbow, wrist, 0.5), 30 * open)])
  return { joints, vane, quills }
}

const mixSolid = (a: Solid, b: Solid, t: number): Solid => ({
  forward: lerp(a.forward, b.forward, t),
  up: lerp(a.up, b.up, t),
  across: lerp(a.across, b.across, t),
})

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One limb, built from the hoof upwards. `share` is what is left on the feet
 * after the wings have taken their part, so the sprung pastern recoils as the
 * animal goes up. Once the floor is out of the limb's own reach the target
 * comes back in along the same line, so the leg draws up under the chest
 * instead of dangling — the fold is arithmetic, not a script.
 */
function solveLimb(
  leg: GaitLeg,
  shoulder: Vec2,
  hip: Vec2,
  metaAngle: number,
  rise: number,
  share: number,
): PegasusLimb {
  const root = leg.fore ? shoulder : hip
  const load = leg.load * share
  const pastern = toRadians(PASTERN_REST - fetlockSink(load))
  const links = leg.fore ? FORE : HIND
  const cannon = leg.fore ? FORE_CANNON : HIND_CANNON
  const reach = links[0] + links[1]

  // The floor stays where it is while the body goes up, so the hoof target is
  // simply out of reach past a certain height.
  const floor: Vec2 = { x: (leg.fore ? shoulder.x - 1 : hip.x + 3) + leg.foot.x, y: leg.foot.y }
  const fetlockAt = (hoof: Vec2): Vec2 => ({
    x: hoof.x - Math.cos(pastern) * PASTERN,
    y: hoof.y + Math.sin(pastern) * PASTERN,
  })
  const kneeAt = (fetlock: Vec2): Vec2 =>
    leg.fore
      ? { x: fetlock.x + 1.5, y: fetlock.y + cannon }
      : {
          x: fetlock.x - Math.sin(toRadians(metaAngle)) * cannon,
          y: fetlock.y + Math.cos(toRadians(metaAngle)) * cannon,
        }

  const wanted = kneeAt(fetlockAt(floor))
  const span = Math.hypot(wanted.x - root.x, wanted.y - root.y)
  const folded = clamp((span - reach) / 18, 0, 1)
  const drawn = folded > 0 ? reach * lerp(1, 0.46, folded) : span
  const scale = span > 1e-6 ? drawn / span : 0
  const knee: Vec2 = {
    x: root.x + (wanted.x - root.x) * scale,
    y: root.y + (wanted.y - root.y) * scale,
  }
  // Below the knee the limb is rigid, so it rides wherever the fold put it.
  const fetlock: Vec2 = leg.fore
    ? { x: knee.x - 1.5, y: knee.y - cannon }
    : {
        x: knee.x + Math.sin(toRadians(metaAngle)) * cannon,
        y: knee.y - Math.cos(toRadians(metaAngle)) * cannon,
      }
  const hoof: Vec2 = {
    x: fetlock.x + Math.cos(pastern) * PASTERN,
    y: fetlock.y - Math.sin(pastern) * PASTERN,
  }
  const [, mid] = solveChain2(root, knee, [...links], { bend: leg.fore ? "down" : "up" })
  return {
    id: leg.id,
    side: leg.side,
    fore: leg.fore,
    load,
    contact: leg.contact && folded < 0.02 && rise < 0.5,
    folded,
    root,
    mid,
    knee,
    fetlock,
    hoof,
  }
}

const backline = (s: number) => 8.5 + 3.5 * s * s
const girth = (s: number) =>
  s < 0.35 ? lerp(15.5, 11.5, s / 0.35) : lerp(11.5, 16, (s - 0.35) / 0.65)

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

const polygon = (points: Vec2[]) =>
  `${points.map((p, index) => `${index ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`

const finiteClamp = (value: number | undefined, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value as number, min, max) : fallback

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const round3 = (value: number) => Number(value.toFixed(3))

/* -------------------------------------------------------------------------- */
/* behaviour                                                                   */
/* -------------------------------------------------------------------------- */

export interface PegasusStance {
  /** The handover: 0 on the legs, 1 on the wings. */
  lift: number
  /** Wing extension, 0 furled to 1 spread. */
  spread: number
  arch: number
  crouch: number
  neck: number
  tail: number
  /** Height off the floor through a suspension, before the lift is added, 0–1. */
  altitude: number
}

export interface PegasusPose {
  /** The footfall pattern whatever weight is still on the feet runs. */
  gait: EquineGait
  gaze: number
  ears: number
  /** Normalized foot travel before the handover shortens it, 0–1. */
  stride: number
  /** Normalized swing height. */
  swing: number
  /** Wingbeats per stride. */
  wingbeats: number
  mane: number
  flex: number
  stance: (cycle: number) => PegasusStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function pegasusBehaviorPose(behavior: PegasusBehavior, clock: number): PegasusPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // On the floor, three beats on a lead, wings furled against the body.
    case "canter":
      return {
        gait: "canter",
        gaze: 0.1 * Math.sin(time * 0.8),
        ears: 0.85,
        stride: 0.85,
        swing: 0.7,
        wingbeats: 1,
        mane: 0.6,
        flex: 0.08,
        stance: (cycle) => ({
          lift: 0,
          spread: 0.22 + 0.06 * Math.sin(2 * Math.PI * wrap(cycle)),
          arch: 0.12 * Math.sin(2 * Math.PI * wrap(cycle)),
          crouch: 0.14,
          neck: 0.62,
          tail: 0.5,
          altitude: 0.42 * Math.max(0, Math.sin(Math.PI * clamp((wrap(cycle) - 0.72) / 0.3, 0, 1))),
        }),
      }
    // Wings held out, legs tucked, the whole weight on them and a slow trim.
    case "soar":
      return {
        gait: "halt",
        gaze: 0.14 * Math.sin(time * 0.5),
        ears: 0.4,
        stride: 0,
        swing: 0,
        wingbeats: 0.5,
        mane: 0.8,
        flex: 0.05,
        stance: () => ({
          lift: 1,
          spread: 1,
          arch: -0.08,
          crouch: 0.55,
          neck: 0.72,
          tail: 0.55,
          altitude: 0,
        }),
      }
    // Holding station: everything on the wings, and the beat is what does it.
    case "hover":
      return {
        gait: "halt",
        gaze: 0.2 * Math.sin(time * 0.9),
        ears: 0.7,
        stride: 0,
        swing: 0,
        wingbeats: 3,
        mane: 0.5,
        flex: 0.04,
        stance: () => ({
          lift: 1,
          spread: 0.86,
          arch: 0.16,
          crouch: 0.8,
          neck: 0.8,
          tail: 0.2,
          altitude: 0,
        }),
      }
    case "static":
      return {
        gait: "halt",
        gaze: 0,
        ears: 0.5,
        stride: 0,
        swing: 0,
        wingbeats: 1,
        mane: 0,
        flex: 0,
        stance: () => ({
          lift: 0,
          spread: 0.18,
          arch: 0,
          crouch: 0.12,
          neck: 0.68,
          tail: 0.2,
          altitude: 0,
        }),
      }
    // The signature, and the only behaviour that crosses the handover: canter,
    // gather, and hand the weight over as the wings come up under it.
    default:
      return {
        gait: "gallop",
        gaze: 0.08 * Math.sin(time * 0.7),
        ears: 0.9,
        stride: 1,
        swing: 0.85,
        wingbeats: 1.5,
        mane: 1,
        flex: 0.1,
        stance: (cycle) => {
          const t = wrap(cycle)
          // Two strides' worth in one cycle: run, gather, go. The lift is a
          // smooth ramp, so the two support systems overlap rather than cut.
          const over = smoothstep(clamp((t - 0.34) / 0.34, 0, 1))
          return {
            lift: over,
            spread: lerp(0.3, 1, smoothstep(clamp((t - 0.24) / 0.3, 0, 1))),
            arch: 0.18 * Math.sin(2 * Math.PI * t) * (1 - over),
            crouch: lerp(0.1, 0.62, over),
            neck: lerp(0.5, 0.8, over),
            tail: lerp(0.8, 0.45, over),
            altitude: 0.5 * Math.max(0, Math.sin(Math.PI * clamp((t - 0.12) / 0.24, 0, 1))) * (1 - over),
          }
        },
      }
  }
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

export { RobotPegasus }
