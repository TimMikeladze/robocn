"use client"

/**
 * robot-cat — a quadruped whose body is the mechanism.
 *
 * Everything else in the set with legs bolts them to a rigid body. Here the
 * shoulder is joint 0 of a solved spine and the hip is its last joint, so
 * arching the back moves both leg roots and the legs have to answer for it.
 * `solveSpine` twice — the back and the tail — and `solveChain2` four times,
 * once per leg. Click and it pounces.
 *
 * Design note: docs/robot-cat.md.
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

export type CatBehavior = "prowl" | "pounce" | "arch" | "sit" | "static"

/** Seconds one poked pounce takes, load to landing. */
const POUNCE = 1

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/** Where the shoulder stands in the frame, and the floor it stands on. */
const ORIGIN = 150
const GROUND = 136
/** Half the track: the legs are either side of the trunk. */
const HALF_TRACK = 9

/** Shoulder to pelvis along the back, and the tail hung off it. */
const TRUNK = 52
const TAIL = 56
/** Scapula-humerus then forearm, and the rigid pastern below the wrist. */
const FORE = [18, 15] as const
const PASTERN = 7
/** Femur then tibia, and the rigid metatarsus from the hock to the paw. */
const HIND = [17, 15] as const
const META = 15
/** How far a pounce lifts the whole animal off the floor. */
const LEAP = 34

/** How far the camera pulls back so the machine still fits a frame drawn for one view. */
const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.95 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

type LegId = "fore-left" | "fore-right" | "hind-left" | "hind-right"

interface CatLeg {
  id: LegId
  side: "left" | "right"
  fore: boolean
  root: Vec2
  /** Shoulder → elbow → wrist, or hip → stifle → hock. */
  mid: Vec2
  joint: Vec2
  paw: Vec2
  contact: boolean
}

/** Which leg is which, and where in the stride it sits. A lateral-sequence
 *  walk: the hind foot lands, then the fore foot on the same side. */
const legPlan: { id: LegId; side: "left" | "right"; fore: boolean; offset: number }[] = [
  { id: "fore-left", side: "left", fore: true, offset: 0.5 },
  { id: "fore-right", side: "right", fore: true, offset: 0 },
  { id: "hind-left", side: "left", fore: false, offset: 0.75 },
  { id: "hind-right", side: "right", fore: false, offset: 0.25 },
]

export interface RobotCatProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Where the camera stands. One animal, four projections. */
  view?: RobotView
  /** What it does when `phase` is not supplied. */
  behavior?: CatBehavior
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  /** Cycles per second: one stride prowling, one pounce pouncing. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a litter of them breaks step. */
  offset?: number
  /** Back curvature, −1 hollowed into the stretch to 1 arched. Omit and the behavior sets it. */
  arch?: number
  /** How far the legs are folded, 0 standing tall to 1 flattened. Omit and the behavior decides. */
  crouch?: number
  /** Tail carriage, −1 tucked under to 1 straight up. Omit and the behavior decides. */
  tail?: number
  /** Ears, −1 flat back to 1 pricked forward. Omit and they answer the pointer. */
  ears?: number
  /** Head and eye aim, −1..1. Omit and it follows the pointer. */
  gaze?: number
  /** The head, ears and eyes track the pointer, and a click pounces. */
  interactive?: boolean
  onPounce?: () => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  /** Mark the paws carrying weight. */
  showContacts?: boolean
  label?: string
}

function RobotCat({
  behavior = "prowl", phase, view = NATIVE_VIEW, speed = 0.55, animate = true, paused = false, offset = 0,
  arch, crouch, tail, ears, gaze,
  interactive = true, onPounce,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  onPointerDown, ...props
}: RobotCatProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })

  const [pounced, setPounced] = React.useState<number | null>(null)
  const since = pounced === null ? Infinity : clock - pounced
  const poked = since >= 0 && since < POUNCE

  const pointer = usePointerTarget(svgRef, {
    enabled: interactive && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback((unit: Vec2) => ({
      x: clamp((unit.x - 0.5) * 2.2, -1, 1),
      y: clamp((0.5 - unit.y) * 2, -1, 1),
    }), []),
  })

  const scripted = catBehaviorPose(behavior, clock)
  const cycle = controlled ? phase : clock * speed
  const beat = Number.isFinite(cycle) ? cycle : 0
  // A poked pounce is the pounce script run once from where the click landed,
  // eased out at the end so the animal settles rather than snapping back.
  const gesture = poked ? catBehaviorPose("pounce", clock).stance(since / POUNCE) : null
  const blend = poked ? Math.min(1, (POUNCE - since) / 0.18) : 0
  const scriptedStance = scripted.stance(beat)
  const stance = gesture
    ? {
        arch: lerp(scriptedStance.arch, gesture.arch, blend),
        crouch: lerp(scriptedStance.crouch, gesture.crouch, blend),
        haunch: lerp(scriptedStance.haunch, gesture.haunch, blend),
        tail: lerp(scriptedStance.tail, gesture.tail, blend),
        altitude: lerp(scriptedStance.altitude, gesture.altitude, blend),
      }
    : scriptedStance

  const bow = finiteClamp(arch ?? stance.arch, -1, 1, stance.arch)
  const fold = finiteClamp(crouch ?? stance.crouch, 0, 1, stance.crouch)
  const haunch = clamp(stance.haunch, 0, 1)
  const carriage = finiteClamp(tail ?? stance.tail, -1, 1, stance.tail)
  const rise = clamp(stance.altitude, 0, 1)
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const earAim = finiteClamp(ears ?? (pointer.target ? 1 : scripted.ears), -1, 1, 0)

  /* ---- the back, and the two leg roots it carries ------------------------ */

  const shoulderHeight = lerp(46, 26, fold) + rise * LEAP
  // `turn` is a constant curvature over the body, which is exactly a back:
  // positive bows it up, negative hollows it. Scaled down because the solver's
  // full range over a 58-unit back is a hoop rather than a cat.
  const curvature = bow * 0.42
  // The solver's arc starts level at the nose and curves away, which would drop
  // the hindquarters instead of bowing the back. Tilting the whole chain by
  // half the arc puts the crown in the middle, both ends level, and the same
  // rotation carries the rear down onto its haunches when it sits.
  const tilt = -(curvature * spineTurnLimit) / 2 + haunch * 16
  const back = tiltPose(
    solveSpine({
      segments: 6,
      length: TRUNK,
      phase: beat,
      amplitude: scripted.flex,
      waves: 0.6,
      taper: 0.15,
      turn: curvature,
    }),
    tilt,
  )
  const shoulder: Vec2 = { x: 0, y: shoulderHeight }
  const spinePoint = (index: number): Vec2 => ({
    x: back.joints[index].position.x,
    y: back.joints[index].position.y + shoulderHeight,
  })
  const pelvis = spinePoint(back.joints.length - 1)

  /* ---- four legs, each solved from the root the spine handed it ---------- */

  const airborne = rise > 0.02
  const gait = scripted.rate
  const metaAngle = lerp(12, 46, fold) + haunch * 34
  const legs: CatLeg[] = legPlan.map(({ id, side, fore, offset: legOffset }) => {
    const step = gait > 0 ? footfall(beat * gait + legOffset, 10, 8) : { x: 0, y: 0 }
    const nominal = fore ? 4 : pelvis.x + 2 + haunch * 20
    const lift = rise * LEAP * (fore ? 0.85 : 1)
    const paw: Vec2 = {
      x: nominal + step.x + (airborne ? (fore ? 9 : -11) * rise : 0),
      y: step.y + lift,
    }
    const root = fore ? shoulder : pelvis
    if (fore) {
      // Wrist first, then a rigid pastern down to the paw: the elbow breaks
      // backwards, which is the way a cat's foreleg folds.
      const [, elbow, wrist] = solveChain2(root, { x: paw.x, y: paw.y + PASTERN }, [...FORE], { bend: "down" })
      return { id, side, fore, root, mid: elbow, joint: wrist, paw: { x: wrist.x, y: wrist.y - PASTERN }, contact: paw.y < 1e-6 }
    }
    // The hock is where the free parameter of a three-link hind limb is spent:
    // the metatarsus is carried at a scripted angle that opens with the crouch,
    // and the femur and tibia are solved to it.
    const hock: Vec2 = {
      x: paw.x - Math.sin(toRadians(metaAngle)) * META,
      y: paw.y + Math.cos(toRadians(metaAngle)) * META,
    }
    const [, stifle, heel] = solveChain2(root, hock, [...HIND], { bend: "up" })
    return {
      id, side, fore, root, mid: stifle, joint: heel,
      paw: { x: heel.x + Math.sin(toRadians(metaAngle)) * META, y: Math.max(0, heel.y - Math.cos(toRadians(metaAngle)) * META) },
      contact: paw.y < 1e-6,
    }
  })

  /* ---- the tail, a second spine hung off the pelvis ---------------------- */

  const tailPose = solveSpine({
    segments: 8,
    length: TAIL,
    phase: beat * 1.6,
    amplitude: scripted.lash * 0.55,
    waves: 1.1,
    taper: 1,
    turn: carriage * 0.5,
  })
  // It leaves the pelvis continuing the back, then lifts by its carriage.
  const tailTurn = back.tail.angle - carriage * 70
  const tailJoints = tailPose.joints.map((joint) => {
    const point = rotate2(joint.position, toRadians(tailTurn))
    // A tail lies on the floor; it does not go through it.
    return { x: point.x + pelvis.x, y: Math.max(2, point.y + pelvis.y) }
  })

  /* ---- head on a short neck --------------------------------------------- */

  const neck: Vec2 = { x: 5, y: shoulderHeight + 7 }
  const neckAngle = lerp(18, -14, fold) + aim * 5 - rise * 8
  const skull: Vec2 = {
    x: neck.x + Math.cos(toRadians(neckAngle)) * 15,
    y: neck.y + Math.sin(toRadians(neckAngle)) * 15,
  }
  const headTilt = neckAngle * 0.5 + aim * 7

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

  const state = poked
    ? "pouncing"
    : behavior === "arch"
      ? "arched"
      : behavior === "sit"
        ? "sitting"
        : behavior === "pounce"
          ? "pouncing"
          : behavior === "prowl"
            ? "prowling"
            : "still"

  /** One leg, in the animal's own y-up frame. */
  function legDrawing(leg: CatLeg) {
    const far = leg.side === "right"
    const shift = far ? -6 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y })
    const upper = leg.fore ? 4.6 : 5.4
    return (
      <g key={leg.id} data-leg={leg.id} opacity={far ? 0.5 : 1}>
        <path d={capsulePath(move(leg.root), move(leg.mid), upper)} {...shell} />
        <path d={capsulePath(move(leg.mid), move(leg.joint), leg.fore ? 3.2 : 3.6)} {...machined} />
        <path d={capsulePath(move(leg.joint), move(leg.paw), 2.5)} {...cast} />
        {/* The paw: a flat pad sitting on the floor, toes forward. */}
        <rect x={px(move(leg.paw).x - 3.5)} y={px(move(leg.paw).y)} width={10} height={4} rx={2} {...machined} />
        <circle
          data-joint={`${leg.id}-${leg.fore ? "elbow" : "stifle"}`}
          cx={px(move(leg.mid).x)} cy={px(move(leg.mid).y)} r={3.4} {...cast}
        />
        <circle cx={px(move(leg.joint).x)} cy={px(move(leg.joint).y)} r={2.6} {...cast} />
        {showContacts && leg.contact && (
          <ellipse data-contact cx={px(move(leg.paw).x + 2)} cy={1.4} rx={6} ry={1.2} fill={palette.accent} opacity={0.6} />
        )}
      </g>
    )
  }

  /** The tail, drawn as a tapering run of capsules down the solved joints. */
  function tailDrawing() {
    return (
      <g data-tail>
        {tailJoints.slice(0, -1).map((joint, index) => (
          <path
            key={index}
            d={capsulePath(joint, tailJoints[index + 1], lerp(4.4, 1.7, index / (tailJoints.length - 1)))}
            {...machined}
          />
        ))}
        {/* Banding: two or three marks per part, no more. */}
        {tailJoints.filter((_, index) => index % 3 === 1).map((joint, index) => (
          <circle key={index} cx={px(joint.x)} cy={px(joint.y)} r={2.2} {...cast} />
        ))}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robot cat, ${state}, ${viewNames[view] ?? viewNames.profile}`}
      viewBox="0 0 250 170"
      width={width}
      height={px((width * 170) / 250)}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPounced(clock)
        onPounce?.()
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.4}>
          <path d="M 12 136 H 238 M 150 14 V 154" strokeDasharray="2 3" />
          <circle cx={ORIGIN} cy={px(GROUND - shoulderHeight)} r={px(FORE[0] + FORE[1])} strokeDasharray="3 4" />
        </g>
      )}
      {showGround && (
        <g data-ground>
          <path d="M 14 136 H 236" stroke={palette.grid} strokeWidth={0.8} fill="none" />
          <ellipse
            cx={px(ORIGIN - 26)}
            cy={139}
            rx={px(46 - rise * 16)}
            ry={px(4.5 - rise * 2)}
            fill={palette.dark}
            opacity={px(0.16 - rise * 0.08)}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${px(fit)})`}>
          {/* The trunk, one extruded footprint per spine segment, so the arch
              survives the projection instead of being flattened into a box. */}
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
                  <path d={capsulePath(at(leg.root, across * 0.7), at(leg.mid, across), leg.fore ? 5 : 6)} {...shell} />
                  <path d={capsulePath(at(leg.mid, across), at(leg.joint, across), leg.fore ? 3.4 : 4)} {...machined} />
                  <path d={capsulePath(at(leg.joint, across), at(leg.paw, across), 2.6)} {...cast} />
                </g>
              ))}
            </g>
          ))}
          {tailJoints.slice(0, -1).map((joint, index) => (
            <path
              key={index}
              d={capsulePath(at(joint), at(tailJoints[index + 1]), lerp(4.2, 1.6, index / (tailJoints.length - 1)))}
              {...machined}
            />
          ))}
          <path
            d={extrudedPath(
              roundedFootprint(8, 11, 6, 5).map((p) => ({ x: p.x, y: p.y - skull.x })),
              camera,
              skull.y + 8,
              skull.y - 8,
            )}
            {...shell}
          />
        </g>
      )}

      <Frame {...frame}>
        {/* The drawing works in the animal's own frame: x forward, y up. */}
        <g data-cat data-view={view} transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}>
          {legs.filter((leg) => leg.side === "right").map(legDrawing)}
          {tailDrawing()}

          <g data-trunk>
            {/* The barrel is the solver's own output, waisted between a deep
                chest and a heavy rump — no artwork to keep in step with it. */}
            <g transform={`translate(0 ${px(shoulderHeight)})`}>
              {/* Rounded off at both ends, so the barrel reads as a chest and a
                  rump rather than a cut length of tube. */}
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
                <path d={offsetLine(back, (t) => -(6 - 2.5 * Math.sin(Math.PI * t)))} />
              </g>
            </g>
          </g>

          {/* Neck, then the skull on the end of it. */}
          <path d={capsulePath(neck, skull, 5.2)} {...machined} />

          <g data-head transform={`translate(${px(skull.x)} ${px(skull.y)}) rotate(${px(headTilt)})`}>
            <path d="M -9 -7 Q -10 7 -2 8 Q 9 8 13 3 Q 15 -2 12 -5 Q 5 -9 -2 -9 Q -8 -9 -9 -7 Z" {...shell} />
            {/* The muzzle, which is what makes the silhouette read at 150px. */}
            <path d="M 8 -3 Q 15 -3 15 1 Q 15 4 9 4 Z" {...machined} />
            <path d="M 13.5 1 l 1.8 0" stroke={palette.dark} strokeWidth={1.2} fill="none" />
            {/* One eye in profile, with the far one showing past the muzzle. */}
            <g data-eyes>
              <g transform="translate(0.5 1.6)" opacity={0.55}>
                <circle r={2.4} {...cast} />
                <circle cx={px(0.8 + aim * 0.9)} r={1.2} fill={palette.accent} />
              </g>
              <g transform="translate(5 0.5)">
                <circle r={3} {...cast} />
                <circle cx={px(1 + aim * 1.2)} r={1.6} fill={palette.accent} />
              </g>
            </g>
            {/* Whiskers: drawn, not solved. */}
            <g stroke={palette.metal} strokeWidth={0.6} opacity={0.6} fill="none">
              <path d="M 14 -2 l 9 -4 M 14 0 l 10 0 M 14 2 l 9 4" />
            </g>
            {/* Both ears swivel together on one number: forward at 1, flat
                back at −1. The far one is set back and dimmed for depth. */}
            {([-1, 1] as const).map((depth) => (
              <g
                key={depth}
                data-ear={depth < 0 ? "right" : "left"}
                opacity={depth < 0 ? 0.6 : 1}
                transform={`translate(${px(-6 + depth * 3.4)} ${px(4.8 - depth * 0.4)}) rotate(${px(lerp(58, -10, (earAim + 1) / 2))})`}
              >
                <path d="M 0 0 L 2.2 12.5 L 8.2 2.2 Z" {...shell} />
                <path d="M 2.4 2.8 L 3.2 8.4 L 5.6 3.2 Z" {...machined} />
              </g>
            ))}
          </g>

          {legs.filter((leg) => leg.side === "left").map(legDrawing)}

          {/* The two joints the whole machine turns on, drawn last so they sit
              over the limbs they carry — and they are spine joints, not
              points on a box. */}
          <g data-joints>
            {([shoulder, pelvis] as const).map((joint, index) => (
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
 * The barrel, nose to tail. A cat is not a tube: the back is a level line, the
 * chest is deep, the waist tucks behind the ribs and the rump carries the hind
 * legs. So the two sides get their own profile and the outline is offset off
 * the solved spine either way — still the solver's output, not artwork.
 */
const backline = (s: number) => 10.5 + 1.8 * s
const bellyline = (s: number) => 13.5 - 4.4 * Math.sin(Math.PI * s)

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
 * arced forward with ground clearance through the swing. Duty 0.75 keeps three
 * feet down, which is the lateral-sequence walk a stalking cat uses.
 */
function footfall(cycle: number, reach: number, clearance: number): Vec2 {
  const t = wrap(cycle)
  const duty = 0.75
  if (t < duty) return { x: reach * (1 - (2 * t) / duty), y: 0 }
  const swing = (t - duty) / (1 - duty)
  return { x: -reach * Math.cos(Math.PI * swing), y: clearance * Math.sin(Math.PI * swing) }
}

export interface CatStance {
  /** Back curvature, −1 hollow to 1 arched. */
  arch: number
  /** Leg fold, 0 tall to 1 flat. */
  crouch: number
  /** Extra hind fold: 1 puts the hocks on the floor. */
  haunch: number
  /** Tail carriage, −1 tucked to 1 up. */
  tail: number
  /** Height off the floor, 0–1. */
  altitude: number
}

export interface CatPose {
  gaze: number
  ears: number
  /** Tail wave amplitude, 0–1. */
  lash: number
  /** Stride cycles per unit of the cycle; 0 plants the feet. */
  rate: number
  /** Spine wave amplitude, 0–1. The bound, which a walk does not have. */
  flex: number
  /** The posture at a point in the cycle — the pounce is the whole reason. */
  stance: (cycle: number) => CatStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function catBehaviorPose(behavior: CatBehavior, clock: number): CatPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Load, wiggle, launch, fly, land, absorb — one cycle.
    case "pounce":
      return {
        gaze: 0.15 * Math.sin(time * 0.9),
        ears: 1,
        lash: 0.5,
        rate: 0,
        flex: 0.05,
        stance: (cycle) => {
          const t = wrap(cycle)
          if (t < 0.34) {
            // Loading: down onto the haunches, back rounding, with the
            // hindquarters' waggle riding on top of it.
            const u = t / 0.34
            return {
              arch: lerp(0.1, 0.46, u),
              crouch: lerp(0.35, 0.92, u) + 0.03 * Math.sin(u * 22),
              haunch: 0,
              tail: lerp(-0.2, 0.35, u),
              altitude: 0,
            }
          }
          if (t < 0.46) {
            // Launch: the back snaps from rounded to hollow as it extends.
            const u = (t - 0.34) / 0.12
            return { arch: lerp(0.46, -0.34, u), crouch: lerp(0.92, 0.06, u), haunch: 0, tail: lerp(0.35, 0.8, u), altitude: 0.45 * u * u }
          }
          if (t < 0.78) {
            const u = (t - 0.46) / 0.32
            return {
              arch: lerp(-0.34, 0.12, u),
              crouch: lerp(0.06, 0.3, u),
              haunch: 0,
              tail: 0.8 - 0.3 * u,
              altitude: 0.45 + 0.55 * Math.sin(Math.PI * u),
            }
          }
          // Absorbing the landing.
          const u = (t - 0.78) / 0.22
          return { arch: lerp(0.24, 0.08, u), crouch: lerp(0.66, 0.35, u), haunch: 0, tail: lerp(0.5, -0.1, u), altitude: 0.2 * (1 - u) }
        },
      }
    // The startle: curvature at its limit, legs stiff, tail up, ears flat.
    case "arch":
      return {
        gaze: 0.1 * Math.sin(time * 1.4),
        ears: -0.9,
        lash: 0.22,
        rate: 0,
        flex: 0,
        stance: () => ({
          arch: 0.78 + 0.06 * Math.sin(time * 2),
          crouch: 0.16,
          haunch: 0,
          tail: 0.92,
          altitude: 0,
        }),
      }
    // Sitting: haunches on the floor, forelegs straight, tail curled forward.
    case "sit":
      return {
        gaze: 0.55 * Math.sin(time * 0.45),
        ears: 0.75 + 0.2 * Math.sin(time * 1.1),
        lash: 0.12,
        rate: 0,
        flex: 0,
        stance: () => ({
          arch: 0.26 + 0.03 * Math.sin(time * 1.6),
          crouch: 0.3,
          haunch: 1,
          tail: -0.55,
          altitude: 0,
        }),
      }
    case "static":
      return {
        gaze: 0,
        ears: 0.6,
        lash: 0,
        rate: 0,
        flex: 0,
        stance: () => ({ arch: 0, crouch: 0.32, haunch: 0, tail: -0.1, altitude: 0 }),
      }
    // Prowling: low, level, deliberate, ears forward, tail sweeping behind.
    default:
      return {
        gaze: 0.3 * Math.sin(time * 0.5),
        ears: 0.9,
        lash: 0.38,
        rate: 1,
        flex: 0.09,
        stance: () => ({
          arch: -0.06 + 0.04 * Math.sin(time * 1.2),
          crouch: 0.34,
          haunch: 0,
          tail: -0.3,
          altitude: 0,
        }),
      }
  }
}

export { RobotCat }
