"use client"

/**
 * robot-dog — a quadruped whose shoulder floats.
 *
 * `robot-cat` hangs both leg roots off one solved spine. A dog has no
 * clavicle: the hip is still a spine joint, but the shoulder is the far end of
 * a scapula that pivots on the ribcage and swings with the stride, which is
 * where a trot's reach comes from. Two more mechanisms are geometry rather
 * than artwork — the tail is solved in the *transverse* plane, so the wag runs
 * perpendicular to the side elevation it is drawn in, and the neck is a solved
 * two-link chain, so the nose can reach the floor while the withers stay where
 * the legs put them. `solveSpine` twice and `solveChain2` five times. Click and
 * it barks.
 *
 * Design note: docs/robot-dog.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, lerp, rotate2, solveChain2, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import { solveSpine, type SpinePose } from "@/lib/robocn/spine"
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

export type DogBehavior = "trot" | "sniff" | "sit" | "alert" | "static"

/** Seconds one poked bark takes, lift to settle. */
const BARK = 0.62

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/** Where the withers stand in the frame, and the floor underneath. */
const ORIGIN = 148
const GROUND = 136
/** Half the track: the legs are either side of the trunk. */
const HALF_TRACK = 9.5

/** Withers to croup along the back, and the tail hung off it. */
const TRUNK = 58
const TAIL = 44
/** The shoulder blade, then humerus and radius to the carpus, then the pastern. */
const SCAPULA = 15
const FORE = [16, 15] as const
const PASTERN = 7
/** Femur then tibia to the hock, and the rigid metatarsus below it. */
const HIND = [18, 16] as const
const META = 14
/** Cervical chain: withers to the poll, solved. */
const NECK = [16, 13] as const
/** Where the scapula stands at rest, and how far the stride swings it. */
const SCAPULA_SET = 16
const SCAPULA_SWING = 13
/** How far the suspension of a trot, or a bark's bounce, lifts the machine. */
const LIFT = 11

/** How far the camera pulls back so the machine still fits a frame drawn for one view. */
const fits: Record<RobotView, number> = { plan: 0.9, front: 1, profile: 1, iso: 0.95 }

/**
 * Where the animal's own origin lands in the frame. Looking straight down it
 * cannot be the floor line the elevations stand on: nose to tail tip is most of
 * the frame's height once the camera is overhead, so the anchor moves up.
 */
const anchors: Record<RobotView, { x: number; y: number }> = {
  plan: { x: ORIGIN, y: 56 },
  front: { x: ORIGIN, y: GROUND },
  profile: { x: ORIGIN, y: GROUND },
  iso: { x: ORIGIN, y: GROUND },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The side elevation's own camera, kept at module scope. The tail's motion is
 * out of the plane the machine is drawn in, so even the native drawing has to
 * project it rather than plot it flat.
 */
const sideCamera = robotCamera(NATIVE_VIEW)

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface DogLeg {
  id: LegId
  side: "left" | "right"
  fore: boolean
  /** Thorax pivot for a foreleg; the hip itself for a hind leg. */
  root: Vec2
  /** Far end of the scapula. The hip has nothing above it, so it is the root. */
  shoulder: Vec2
  /** Elbow, or stifle. */
  mid: Vec2
  /** Carpus, or hock. */
  joint: Vec2
  paw: Vec2
  contact: boolean
}

/** Which leg is which, and where in the stride it sits. A trot: diagonal
 *  pairs, so fore-left lands with hind-right. */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "fore-left", side: "left", fore: true, offset: 0 },
  { id: "fore-right", side: "right", fore: true, offset: 0.5 },
  { id: "hind-left", side: "left", fore: false, offset: 0.5 },
  { id: "hind-right", side: "right", fore: false, offset: 0 },
]

export interface RobotDogProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: DogBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Cycles per second: one stride per cycle at a trot. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  offset?: number
  /** Back curvature, −1 hollowed into the play bow to 1 roached. Omit and the behavior sets it. */
  arch?: number
  /** How far the legs are folded, 0 standing tall to 1 flattened. Omit and the behavior decides. */
  crouch?: number
  /** Tail carriage, −1 tucked under to 1 straight up. Omit and the behavior decides. */
  tail?: number
  /** Where the tail is in its swing, −1 to 1 across the centre plane. Omit and it wags. */
  wag?: number
  /** How low the head is carried, 0 up and level to 1 nose on the floor. */
  nose?: number
  /** Ears, −1 folded back to 1 pricked forward. Omit and they answer the pointer. */
  ears?: number
  /** Head and eye aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** The head, ears and eyes track the pointer, the wag picks up, and a click barks. */
  interactive?: boolean
  onBark?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the paws carrying weight. */
  showContacts?: boolean
  label?: string
}

function RobotDog({
  behavior = "trot", phase, view = NATIVE_VIEW, speed = 0.7, animate = true, paused = false, offset = 0,
  arch, crouch, tail, wag, nose, ears, gaze,
  interactive = true, onBark,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotDogProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [barked, setBarked] = React.useState<number | null>(null)
  const since = barked === null ? Infinity : clock - barked
  const poked = since >= 0 && since < BARK

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = dogBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  const stance = scripted.stance(beat)
  // A poked bark rides on top of whatever the behaviour is doing, eased out at
  // the end so the machine settles rather than snapping back.
  const bark = poked ? dogBark(since / BARK) : null
  const blend = poked ? Math.min(1, (BARK - since) / 0.16) : 0

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const haunch = clamp(stance.haunch, 0, 1)
  const point = clamp(stance.point, 0, 1)
  const rise = clamp(stance.altitude + (bark ? bark.lift * blend : 0), 0, 1)
  const carriage = finiteClamp(tail ?? stance.tail, -1, 1, stance.tail)
  const droop = finiteClamp(
    nose ?? clamp(stance.nose + (bark ? bark.nose * blend : 0), 0, 1),
    0, 1, stance.nose,
  )
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const earAim = finiteClamp(
    ears ?? (pointer.target ? 1 : scripted.ears) + (bark ? bark.ears * blend : 0),
    -1, 1, 0,
  )
  const jaw = clamp(scripted.jaw + (bark ? bark.jaw * blend : 0), 0, 1)
  // Wagging is the one thing a watched dog does more of, not less.
  const energy = clamp(scripted.wag + (pointer.target ? 0.3 : 0) + (bark ? bark.wag * blend : 0), 0, 1)
  const swing = finiteClamp(
    wag ?? Math.sin(2 * Math.PI * beat * scripted.wagRate) * energy,
    -1, 1, 0,
  )

  /* ---- the back, and the hip it carries ---------------------------------- */

  const withersHeight = lerp(54, 34, fold) + rise * LIFT
  // `turn` is a constant curvature over the body. Half the cat's scaling,
  // because a dog holds a topline where a cat arches: positive roaches the
  // back, negative hollows it into the play bow.
  const curvature = bow * 0.22
  // The solver's arc starts level at the withers and curves away, which would
  // drop the hindquarters rather than bow the back; tilting the whole chain by
  // half its own arc puts the crown in the middle with both ends level. The
  // same rotation, run the other way, folds the croup down when it sits.
  const tilt = -(curvature * spineTurnLimit) / 2 + haunch * 34
  const back = tiltPose(
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
  const spinePoint = (index: number): Vec2 => ({
    x: back.joints[index].position.x,
    y: back.joints[index].position.y + withersHeight,
  })
  const pelvis = spinePoint(back.joints.length - 1)

  // Where the shoulder blade hangs: a little back from the withers and down
  // the body's own normal, so it rides the ribcage rather than the spine.
  const thorax = back.joints[1]
  const under = toRadians(thorax.angle + 90)
  const pivot: Vec2 = {
    x: thorax.position.x - Math.cos(under) * 7,
    y: thorax.position.y - Math.sin(under) * 7 + withersHeight,
  }

  /* ---- four legs: two solved from a swinging blade, two from the hip ------ */

  const gait = scripted.rate
  const metaAngle = lerp(14, 44, fold) + haunch * 46
  const legs: DogLeg[] = legPlan.map(({ id, side, fore, offset: legOffset }) => {
    const stride = beat * gait + legOffset
    // Duty 0.5: a trot has two feet down and a moment with none.
    const step = gait > 0 ? footfall(stride, 11, 7) : { x: 0, y: 0 }
    // The point lifts and tucks one forefoot, and nothing else.
    const lifted = id === "fore-left" ? point : 0
    const paw: Vec2 = {
      x: (fore ? pivot.x + 1 : pelvis.x + 2 + haunch * 26) + step.x + lifted * 5,
      y: step.y + rise * LIFT + lifted * 11,
    }
    if (fore) {
      // The blade swings on the ribcage with its own leg's stride; its far end
      // is the shoulder, and the humerus and radius are solved from there.
      const blade = SCAPULA_SET - fold * 6 +
        (gait > 0 ? SCAPULA_SWING * Math.cos(2 * Math.PI * wrap(stride)) : 0)
      const set = toRadians(blade)
      const shoulder: Vec2 = {
        x: pivot.x + Math.sin(set) * SCAPULA,
        y: pivot.y - Math.cos(set) * SCAPULA,
      }
      const [, elbow, carpus] = solveChain2(shoulder, { x: paw.x, y: paw.y + PASTERN }, [...FORE], { bend: "down" })
      return {
        id, side, fore, root: pivot, shoulder, mid: elbow, joint: carpus,
        paw: { x: carpus.x, y: carpus.y - PASTERN },
        contact: step.y < 1e-6 && lifted < 0.05,
      }
    }
    // The hock is where the free parameter of a three-link hind limb is spent:
    // the metatarsus is carried at a scripted angle that opens with the crouch,
    // and the femur and tibia are solved to it.
    const hock: Vec2 = {
      x: paw.x - Math.sin(toRadians(metaAngle)) * META,
      y: paw.y + Math.cos(toRadians(metaAngle)) * META,
    }
    const [, stifle, heel] = solveChain2(pelvis, hock, [...HIND], { bend: "up" })
    return {
      id, side, fore, root: pelvis, shoulder: pelvis, mid: stifle, joint: heel,
      paw: { x: heel.x + Math.sin(toRadians(metaAngle)) * META, y: Math.max(0, heel.y - Math.cos(toRadians(metaAngle)) * META) },
      contact: step.y < 1e-6,
    }
  })

  /* ---- the tail: solved across the centre plane, then carried ------------- */

  const tailPose = solveSpine({
    segments: 8,
    length: TAIL,
    phase: beat * 1.6,
    amplitude: scripted.lash,
    waves: 0.9,
    taper: 1,
    turn: swing * 0.55,
  })
  // One rigid rotation of the whole solved curve about the animal's lateral
  // axis. Link lengths therefore hold exactly, the carriage is a straight
  // line, and the curve inside it stays lateral — which is what a wag is.
  const carry = toRadians(-back.tail.angle + carriage * 62)
  const tailLine: Solid[] = tailPose.joints.map((joint) => ({
    forward: pelvis.x + joint.position.x * Math.cos(carry),
    // A tail lies along the floor; it does not go through it.
    up: Math.max(2, pelvis.y - joint.position.x * Math.sin(carry)),
    across: joint.position.y,
  }))

  /* ---- neck solved to the poll, head hung off the end of it --------------- */

  const nape: Vec2 = { x: 4, y: withersHeight + 5 }
  const target: Vec2 = {
    x: nape.x + lerp(22, 19, droop),
    y: lerp(withersHeight + 20, 30, droop),
  }
  const [, crest, poll] = solveChain2(nape, target, [...NECK], { bend: "up" })
  // The poll is a joint of its own: a dog carries its head at an angle to the
  // neck rather than along it, so this is a rule and the chain above is not.
  const headTilt = lerp(-10, -66, droop) + aim * 6
  // Where the muzzle centre lands once the head is carried, so the off-axis
  // solids can draw the half of the head that says dog from above.
  const facing = toRadians(headTilt)
  const snout: Vec2 = {
    x: poll.x + Math.cos(facing) * 14,
    y: poll.y + Math.sin(facing) * 14,
  }

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const anchor = anchors[view] ?? anchors.profile
  const face = aboutPoint(camera.wall(0, 90), anchor.x, anchor.y, fit)
  const Frame = (face ? "g" : React.Fragment) as React.FC<{
    transform?: string
    children?: React.ReactNode
  }>
  const frame = face ? { transform: face } : {}
  /** A point in the animal's own frame, `across` units off the centre plane. */
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  /** The same for a point that already knows how far off the plane it is. */
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)
  /**
   * A three-dimensional point in the flat side-elevation drawing. Exact for
   * the native camera, which is what the flat artwork is in every view.
   */
  const flat = (p: Solid): Vec2 => {
    const screen = sideCamera.project(p.across, p.up, -p.forward)
    return { x: screen.x, y: -screen.y }
  }

  const state = poked
    ? "barking"
    : behavior === "sniff"
      ? "sniffing"
      : behavior === "sit"
        ? "sitting"
        : behavior === "alert"
          ? "on point"
          : behavior === "trot"
            ? "trotting"
            : "still"

  /** One leg, in the animal's own y-up frame. */
  function legDrawing(leg: DogLeg) {
    const far = leg.side === "right"
    const shift = far ? -6 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y })
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.5 : 1}>
        {leg.fore && (
          <path
            data-scapula={leg.side}
            d={capsulePath(move(leg.root), move(leg.shoulder), 5.2)}
            {...shell}
          />
        )}
        <path d={capsulePath(move(leg.shoulder), move(leg.mid), leg.fore ? 4.6 : 5.8)} {...shell} />
        <path d={capsulePath(move(leg.mid), move(leg.joint), leg.fore ? 3.2 : 3.6)} {...machined} />
        <path d={capsulePath(move(leg.joint), move(leg.paw), 2.6)} {...cast} />
        {/* The paw: a flat pad on the floor, toes forward. */}
        <rect x={px(move(leg.paw).x - 3.6)} y={px(move(leg.paw).y)} width={10} height={4} rx={2} {...machined} />
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.mid).x)} cy={px(move(leg.mid).y)} r={3.4} {...cast}
        />
        <circle cx={px(move(leg.joint).x)} cy={px(move(leg.joint).y)} r={2.6} {...cast} />
        {leg.fore && (
          <circle data-joint={`${leg.id}-shoulder`} cx={px(move(leg.shoulder).x)} cy={px(move(leg.shoulder).y)} r={3} {...cast} />
        )}
        {showContacts && leg.contact && (
          <ellipse data-contact cx={px(move(leg.paw).x + 2)} cy={1.4} rx={6} ry={1.2} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }

  /** The tail: projected, never plotted, because it swings out of the page. */
  function tailDrawing(project: (p: Solid) => Vec2) {
    const points = tailLine.map(project)
    return (
      <g data-tail>
        {points.slice(0, -1).map((joint, index) => (
          <path
            key={index}
            d={capsulePath(joint, points[index + 1], lerp(4.6, 1.8, index / (points.length - 1)))}
            {...machined}
          />
        ))}
        {/* Banding: two or three marks per part, no more. */}
        {points.filter((_, index) => index % 3 === 1).map((joint, index) => (
          <circle key={index} cx={px(joint.x)} cy={px(joint.y)} r={2.2} {...cast} />
        ))}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot dog, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 250 170"
      width={width}
      height={px((width * 170) / 250)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setBarked(clock)
        onBark?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 136 H 238 M 148 14 V 154" strokeDasharray="2 3" />
          <circle cx={px(ORIGIN + pivot.x)} cy={px(GROUND - pivot.y)} r={px(SCAPULA + FORE[0] + FORE[1])} strokeDasharray="3 4" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 14 136 H 236" stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={px(ORIGIN - 28)}
            cy={139}
            rx={px(50 - rise * 12)}
            ry={px(4.5 - rise * 1.6)}
            fill={palette.dark}
            opacity={px(0.16 - rise * 0.06)}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${px(anchor.x)} ${px(anchor.y)}) scale(${px(fit)})`}>
          {/* The trunk, one extruded footprint per spine segment, so the
              topline survives the projection instead of flattening to a box. */}
          {back.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 4, 4).map((p) => ({ x: p.x, y: p.y - midX }))
            return <path key={index} d={extrudedPath(footprint, camera, midY + 9, midY - 9)} {...shell} />
          })}
          {([-HALF_TRACK, HALF_TRACK] as const).map((across) => (
            <g key={across}>
              {legs.map((leg) => (
                <g key={leg.id}>
                  {leg.fore && <path d={capsulePath(at(leg.root, across * 0.7), at(leg.shoulder, across), 5)} {...shell} />}
                  <path d={capsulePath(at(leg.shoulder, across), at(leg.mid, across), leg.fore ? 4.8 : 6)} {...shell} />
                  <path d={capsulePath(at(leg.mid, across), at(leg.joint, across), leg.fore ? 3.4 : 4)} {...machined} />
                  <path d={capsulePath(at(leg.joint, across), at(leg.paw, across), 2.7)} {...cast} />
                </g>
              ))}
            </g>
          ))}
          {tailDrawing(solid)}
          {/* The neck, so the head is joined to the body off-axis too. */}
          <path d={capsulePath(at(nape), at(crest), 5.6)} {...machined} />
          <path d={capsulePath(at(crest), at(poll), 4.6)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(7.5, 11, 5, 5).map((p) => ({ x: p.x, y: p.y - poll.x - 3 })),
              camera,
              poll.y + 7,
              poll.y - 7,
            )}
            {...shell}
          />
          {/* The muzzle is the half of the head that says dog from above. */}
          <path
            d={extrudedPath(
              roundedFootprint(4, 7, 3, 3).map((p) => ({ x: p.x, y: p.y - snout.x })),
              camera,
              snout.y + 3.5,
              snout.y - 3.5,
            )}
            {...machined}
          />
        </g>
      )}

      <Frame {...frame}>
        {/* The drawing works in the animal's own frame: x forward, y up. */}
        <g data-dog data-view={view} transform={`translate(${px(anchor.x)} ${px(anchor.y)}) scale(1 -1)`}>
          {legs.filter((leg) => leg.side === "right").map(legDrawing)}
          {tailDrawing(flat)}

          <g data-trunk>
            {/* The barrel is the solver's own output: level topline, deep
                chest, tucked loin — no artwork to keep in step with it. */}
            <g transform={`translate(0 ${px(withersHeight)})`}>
              {([0, back.joints.length - 1] as const).map((index) => {
                const joint = back.joints[index]
                const normal = toRadians(joint.angle + 90)
                const radius = (backline(joint.s) + bellyline(joint.s)) / 2
                const shift = (backline(joint.s) - bellyline(joint.s)) / 2
                return (
                  <circle
                    key={index}
                    cx={px(joint.position.x + Math.cos(normal) * shift)}
                    cy={px(joint.position.y + Math.sin(normal) * shift)}
                    r={px(radius)}
                    {...shell}
                  />
                )
              })}
              <path data-spine d={bodyOutline(back, backline, bellyline)} {...shell} />
              {/* Two seams down the flank, and nothing more. */}
              <g fill="none" stroke={palette.dark} strokeWidth={0.7} opacity={0.26}>
                <path d={offsetLine(back, (t) => 4.5 - 1.5 * Math.sin(Math.PI * t))} />
                <path d={offsetLine(back, (t) => -(7 - 3 * Math.sin(Math.PI * t)))} />
              </g>
            </g>
          </g>

          {/* The neck: two solved links, so the nose can reach the floor. */}
          <path data-neck d={capsulePath(nape, crest, 5.6)} {...machined} />
          <path d={capsulePath(crest, poll, 4.6)} {...machined} />

          <g data-head transform={`translate(${px(poll.x)} ${px(poll.y)}) rotate(${px(headTilt)})`}>
            {/* The skull sits forward of the poll, and the long muzzle in front
                of that is what makes the silhouette read at 150px. */}
            <path d="M -6 -7 Q -7 8 2 9 Q 9 9 12 5 Q 14 0 11 -5 Q 5 -9 0 -9 Q -5 -9 -6 -7 Z" {...shell} />
            <path d="M 9 -5 Q 20 -5 21.5 -1.5 L 21.5 1.5 Q 19 3.5 9 4 Z" {...machined} />
            <g data-jaw transform={`translate(9.5 2.4) rotate(${px(-jaw * 22)})`}>
              <path d="M 0 -1.6 Q 9 -1.8 11 0.2 Q 9 1.8 0 2 Z" {...cast} />
            </g>
            <circle cx={20.6} cy={-1} r={1.9} fill={palette.dark} />
            <g data-eyes>
              <g transform="translate(0.4 2.2)" opacity={0.55}>
                <circle r={2.3} {...cast} />
                <circle cx={px(0.8 + aim * 0.9)} r={1.1} fill={palette.accent} />
              </g>
              <g transform="translate(4.4 1.2)">
                <circle r={2.9} {...cast} />
                <circle cx={px(1 + aim * 1.2)} r={1.5} fill={palette.accent} />
              </g>
            </g>
            {/* Both ears work together on one number: pricked up at 1, folded
                back along the neck at −1. The far one is set back and dimmed. */}
            {([-1, 1] as const).map((depth) => (
              <g
                key={depth}
                data-ear={depth < 0 ? "right" : "left"}
                opacity={depth < 0 ? 0.6 : 1}
                transform={`translate(${px(-1 + depth * 3)} ${px(7 - depth * 0.4)}) rotate(${px(lerp(118, 6, (earAim + 1) / 2))})`}
              >
                <path d="M 0 0 Q -3 5.5 -1.4 9.6 Q 2.6 10.4 4.6 6 Q 5.4 2.4 3.4 0 Z" {...shell} />
                <path d="M 0.5 2.2 Q -0.6 5.6 0.2 8 Q 2.2 8.2 3 5.6 Z" {...machined} />
              </g>
            ))}
          </g>

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          {/* The two joints the machine turns on, drawn last so they sit over
              the limbs they carry: one on the spine, one on the ribcage. */}
          <g data-joints>
            {([pivot, pelvis] as const).map((joint, index) => (
              <g key={index}>
                <circle cx={px(joint.x)} cy={px(joint.y)} r={4.6} {...cast} />
                <circle cx={px(joint.x)} cy={px(joint.y)} r={1.8} fill={palette.metal} />
              </g>
            ))}
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

/**
 * The barrel, withers to croup. A dog is not a tube: the topline is level and
 * rises a little over the loin, the chest is deep at the front, the belly tucks
 * behind the ribs and the croup comes back down over the hind legs.
 */
const backline = (s: number) => 11 + 0.8 * s
const bellyline = (s: number) =>
  s < 0.5 ? lerp(15.5, 9.5, s / 0.5) : lerp(9.5, 12.5, (s - 0.5) / 0.5)

/** Peak curvature `solveSpine` puts on a body at `turn` 1, in degrees. */
const spineTurnLimit = 180

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

/** The spine's own line, offset `width` along each joint's normal and left
 *  open: the flank seam, which a closed ribbon draws as a pointed loop. */
function offsetLine(pose: SpinePose, width: (s: number) => number) {
  return pose.joints
    .map((joint, index) => {
      const normal = toRadians(joint.angle + 90)
      const w = width(joint.s)
      return `${index ? "L" : "M"} ${px(joint.position.x + Math.cos(normal) * w)} ${px(joint.position.y + Math.sin(normal) * w)}`
    })
    .join(" ")
}

/** Joints offset by a different amount each side, closed into one path. */
function bodyOutline(pose: SpinePose, top: (s: number) => number, under: (s: number) => number) {
  const above: string[] = []
  const below: string[] = []
  for (const joint of pose.joints) {
    const normal = toRadians(joint.angle + 90)
    const nx = Math.cos(normal)
    const ny = Math.sin(normal)
    const a = top(joint.s)
    const b = under(joint.s)
    above.push(`${above.length ? "L" : "M"} ${px(joint.position.x + nx * a)} ${px(joint.position.y + ny * a)}`)
    below.unshift(`L ${px(joint.position.x - nx * b)} ${px(joint.position.y - ny * b)}`)
  }
  return [...above, ...below, "Z"].join(" ")
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

/** The one gesture a click fires, as offsets on whatever else it was doing. */
export function dogBark(t: number): {
  lift: number
  jaw: number
  nose: number
  ears: number
  wag: number
} {
  const u = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  const pulse = Math.sin(Math.PI * Math.min(1, u * 1.3))
  return {
    // A short bounce off the forehand, over before the bark is.
    lift: 0.5 * Math.max(0, Math.sin(Math.PI * Math.min(1, u * 2.2))),
    // Two syllables: the jaw opens, shuts, opens smaller.
    jaw: Math.abs(Math.sin(Math.PI * u * 2)) * (u < 0.5 ? 1 : 0.55),
    // The head comes up, which is the nose axis run backwards.
    nose: -0.4 * pulse,
    ears: 0.45 * pulse,
    wag: 0.5 * pulse,
  }
}

export interface DogStance {
  /** Back curvature, −1 hollow to 1 roached. */
  arch: number
  /** Leg fold, 0 tall to 1 flat. */
  crouch: number
  /** Extra hind fold: 1 puts the croup on the floor. */
  haunch: number
  /** Tail carriage, −1 tucked to 1 up. */
  tail: number
  /** How low the head is carried, 0 level to 1 nose on the floor. */
  nose: number
  /** One forefoot lifted and tucked, 0–1. The point. */
  point: number
  /** Height off the floor, 0–1. */
  altitude: number
}

export interface DogPose {
  gaze: number
  ears: number
  /** Jaw opening, 0 shut to 1 open. */
  jaw: number
  /** Wag amplitude, 0–1, across the centre plane. */
  wag: number
  /** Wag cycles per unit of the stride cycle. */
  wagRate: number
  /** Tail wave amplitude, 0–1: the whip that trails the wag. */
  lash: number
  /** Stride cycles per unit of the cycle; 0 plants the feet. */
  rate: number
  /** Spine wave amplitude, 0–1. Nearly spent: a stiff back is what a trot is for. */
  flex: number
  /** The posture at a point in the cycle — the trot's suspension is the reason. */
  stance: (cycle: number) => DogStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function dogBehaviorPose(behavior: DogBehavior, clock: number): DogPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Nose down, forequarters low, quartering the ground at half a trot.
    case "sniff":
      return {
        gaze: 0.5 * Math.sin(time * 1.7),
        ears: -0.15,
        jaw: 0,
        wag: 0.4,
        wagRate: 1.6,
        lash: 0.3,
        rate: 0.55,
        flex: 0.05,
        stance: () => ({
          arch: 0.14,
          crouch: 0.42,
          haunch: 0,
          tail: 0.12,
          nose: 0.92 + 0.06 * Math.sin(time * 3.1),
          point: 0,
          altitude: 0,
        }),
      }
    // Sitting: croup on the floor, forelegs straight, tail sweeping behind it.
    case "sit":
      return {
        gaze: 0.5 * Math.sin(time * 0.5),
        ears: 0.7 + 0.2 * Math.sin(time * 1.2),
        jaw: 0.12 + 0.12 * Math.max(0, Math.sin(time * 2.3)),
        wag: 0.85,
        wagRate: 3.2,
        lash: 0.45,
        rate: 0,
        flex: 0,
        stance: () => ({
          arch: 0.2,
          crouch: 0.28,
          haunch: 1,
          tail: -0.15,
          nose: 0.06,
          point: 0,
          altitude: 0,
        }),
      }
    // The point: level back, one forefoot up and tucked, tail straight out.
    case "alert":
      return {
        gaze: 0.08 * Math.sin(time * 0.8),
        ears: 1,
        jaw: 0,
        wag: 0.1,
        wagRate: 1,
        lash: 0.1,
        rate: 0,
        flex: 0,
        stance: () => ({
          arch: -0.06,
          crouch: 0.12,
          haunch: 0,
          tail: 0.62 + 0.03 * Math.sin(time * 1.6),
          nose: 0.1,
          point: 0.85,
          altitude: 0,
        }),
      }
    case "static":
      return {
        gaze: 0,
        ears: 0.55,
        jaw: 0,
        wag: 0,
        wagRate: 0,
        lash: 0,
        rate: 0,
        flex: 0,
        stance: () => ({ arch: 0, crouch: 0.3, haunch: 0, tail: 0.3, nose: 0.18, point: 0, altitude: 0 }),
      }
    // Trotting: diagonal pairs, a stiff back, and the body bobbing on the
    // suspension rather than a travelling wave.
    default:
      return {
        gaze: 0.18 * Math.sin(time * 0.6),
        ears: 0.75,
        jaw: 0.18,
        wag: 0.55,
        wagRate: 2.4,
        lash: 0.4,
        rate: 1,
        flex: 0.04,
        stance: (cycle) => ({
          arch: 0.04,
          crouch: 0.24,
          haunch: 0,
          tail: 0.5,
          nose: 0.16,
          point: 0,
          // Two suspensions per stride: one after each diagonal pair leaves.
          altitude: 0.16 * Math.max(0, Math.sin(2 * Math.PI * (2 * wrap(cycle) + 0.25))),
        }),
      }
  }
}

export { RobotDog }
