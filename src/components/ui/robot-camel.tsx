"use client"

/**
 * robot-camel — the first machine in the set whose floor is not a line.
 *
 * Every other machine here stands on `y = 0`: a foot is on it or above it and
 * `contact` is a boolean. This one's ground is a **medium with a depth**, and
 * the foot goes into it. `padSpread` opens the pad under load, `footSinkage`
 * turns the pressure that leaves into a depth, and the third term is the one
 * worth having: the spread drops the pressure, so the same animal on the same
 * sand sinks *less* than it would on a foot that did not open. That is the
 * mechanism, and it is two lines of arithmetic off the load the gait solver
 * already produced.
 *
 * Two more things are derived rather than set. **The hump is a store**: as
 * `reserve` goes the height goes but the base does not, and past the middle it
 * folds over, because that is what an empty store does. **The roll is the
 * gait**: a pace is the lateral two-beat, so the support is all on one side and
 * the body rolls away from it once each way per stride — and a trot, being
 * diagonal, rolls exactly zero. Nobody writes either; they fall out of the same
 * load numbers.
 *
 * Design note: docs/robot-camel.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
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
  footSinkage,
  padSpread,
  solveGait,
  type EquineGait,
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

export type CamelBehavior = "pace" | "walk" | "trot" | "couch" | "static"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const ORIGIN = 128
const GROUND = 156
const BOX = { width: 280, height: 200 } as const
const HALF_TRACK = 11

/** A short back on long legs, which is what a desert walker is. */
const TRUNK = 48
const WITHERS = 84
const FORE = [24, 26] as const
const FORE_CANNON = 20
const HIND = [25, 26] as const
const HIND_CANNON = 23
const PASTERN = 9
const PASTERN_REST = 54
/** The unloaded pad, half-width and half-depth, before the load opens it. */
const PAD = { half: 5.4, deep: 2.4 } as const
/** A long neck, carried in an S. */
const NECK = [26, 22] as const
const NECK_ANGLE = { down: -82, up: 72 } as const
const NECK_SPAN = { down: 46, up: 44 } as const
const TAIL = 34
const TAIL_SET = { rest: 86, clamped: 112, flagged: 14 } as const
const EAR_ACROSS = 3.4
const EAR_HEIGHT = 6.5
const EAR_HALF = 2.8

/** The hump at a full reserve: how far it stands off the back, and its base. */
const HUMP = { height: 26, base: 30, lean: 42 } as const
/** How far the roll takes the body over, in degrees, at full lateral support. */
const ROLL = 11

const fits: Record<RobotView, number> = { plan: 1.15, front: 1.1, profile: 1, iso: 0.92 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * The side elevation's own camera, kept at module scope: the ears and the roll
 * both work out of the plane the machine is drawn in.
 */
const sideCamera = robotCamera(NATIVE_VIEW)

/** A point in the animal's own frame: nose-ward, up, and off the centre plane. */
interface Solid {
  forward: number
  up: number
  across: number
}

interface CamelLimb {
  id: GaitLegId
  side: "left" | "right"
  fore: boolean
  load: number
  contact: boolean
  /** How wide the pad has opened, as a multiple of its unloaded width. */
  spread: number
  /** How far below the ground line the pad has settled, in world units. */
  sunk: number
  root: Vec2
  mid: Vec2
  knee: Vec2
  fetlock: Vec2
  pad: Vec2
}

export interface RobotCamelProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  view?: RobotView
  behavior?: CamelBehavior
  /** Footfall pattern, overriding the one the behavior picked. */
  gait?: EquineGait
  /** Controlled cycle fraction. Supplying it stops the internal clock. */
  phase?: number
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** What it is standing on: 0 rock, 1 dry sand. The feet go into it. */
  ground?: number
  /** How much is left in the hump, 1 full and upright to 0 empty and folded over. */
  reserve?: number
  arch?: number
  crouch?: number
  neck?: number
  tail?: number
  ears?: number
  gaze?: number
  /** Drag up and down to work the ground; arrows step it. The head tracks the pointer. */
  interactive?: boolean
  onGroundChange?: (ground: number) => void
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  showContacts?: boolean
  label?: string
}

function RobotCamel({
  behavior = "pace", gait, phase, view = NATIVE_VIEW,
  speed = 0.5, animate = true, paused = false, offset = 0,
  ground, reserve, arch, crouch, neck, tail, ears, gaze,
  interactive = true, onGroundChange,
  size = "md", variant = "solid", showGround = true, showContacts = false, label,
  color, accent, metal, dark, glow, grid, palette: paletteOverride, className, style,
  role, tabIndex, onKeyDown, onBlur, ...props
}: RobotCamelProps) {
  const controlled = phase !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase: offset,
  })
  const scripted = camelBehaviorPose(behavior, clock)
  const rate = Number.isFinite(speed) ? speed : 0
  const cycle = wrap(controlled ? finiteClamp(phase, -1e6, 1e6, 0) : clock * rate)
  const stance = scripted.stance(cycle)

  const soft = finiteClamp(ground ?? held ?? scripted.ground, 0, 1, scripted.ground)
  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onGroundChange?.(bounded)
    },
    [onGroundChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && ground === undefined,
    // Firm at the top of the frame, soft at the bottom, so dragging down is
    // sinking — which is the thing the machine is about.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.y), [apply]),
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

  /* ---- the gait, and the roll that falls out of it ----------------------- */

  const walking = gait ?? scripted.gait
  const pose = solveGait({
    gait: walking,
    phase: cycle,
    stride: scripted.stride,
    lift: scripted.swing,
  })
  const roll = ROLL * sideBias(pose.legs)

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
  const withersHeight = lerp(WITHERS, WITHERS - 34, fold)
  const nose = back.joints[0].position
  const spinePoint = (index: number): Vec2 => ({
    x: back.joints[index].position.x - nose.x + 15,
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
  const shoulder = underBack(1, 8)
  const hip = underBack(5, 7)

  /* ---- four limbs, and the ground they are standing in ------------------- */

  const metaAngle = lerp(24, 46, fold)
  const limbs: CamelLimb[] = pose.legs.map((leg) =>
    solveLimb(leg, shoulder, hip, metaAngle, soft),
  )

  /* ---- the hump: a store, and what an empty one does --------------------- */

  const store = finiteClamp(reserve ?? scripted.reserve, 0, 1, scripted.reserve)
  const humpPath = humpOutline(back, spinePoint, store)

  /* ---- neck, head, tail -------------------------------------------------- */

  const carriage = finiteClamp(neck ?? stance.neck, -1, 1, stance.neck)
  const crestAngle = back.joints[0].angle
  const nape = alongBody(withersAt, crestAngle, 4, 8)
  const reach = alongBody(
    nape,
    crestAngle + lerp(NECK_ANGLE.down, NECK_ANGLE.up, (carriage + 1) / 2),
    lerp(NECK_SPAN.down, NECK_SPAN.up, (carriage + 1) / 2),
    0,
  )
  // The camel's S: the crest breaks the other way from a horse's, which is the
  // ewe neck that reads as this animal and nothing else.
  const [, crest, poll] = solveChain2(nape, reach, [...NECK], { bend: "up" })
  const aim = finiteClamp(gaze ?? pointer.target?.x ?? scripted.gaze, -1, 1, 0)
  const headTilt = toDegrees(Math.atan2(poll.y - crest.y, poll.x - crest.x)) + aim * 7 - 32

  const crestLine = sampleRibbon([nape, crest, lerp2(crest, poll, 0.8)], 9)
  const maneJoints = crestLine.map((point, index) => {
    const s = index / (crestLine.length - 1)
    const before = crestLine[Math.max(0, index - 1)]
    const after = crestLine[Math.min(crestLine.length - 1, index + 1)]
    const normal = normalize2({ x: -(after.y - before.y), y: after.x - before.x }, { x: 0, y: 1 })
    // The throat fringe hangs on the *under* side of the neck, which is where a
    // camel carries it.
    const out = -lerp(2.2, 5.5, s) - scripted.mane * 2 * Math.sin(Math.PI * s)
    return { x: point.x + normal.x * out, y: point.y + normal.y * out }
  })

  const tailCarriage = finiteClamp(tail ?? stance.tail, -1, 1, stance.tail)
  const skirt = solveSpine({
    segments: 6,
    length: TAIL,
    phase: cycle * 1.3,
    amplitude: clamp(scripted.mane, 0, 1) * 0.4,
    waves: 0.9,
    taper: 1,
    turn: lerp(0.4, -0.1, (tailCarriage + 1) / 2),
  })
  const tailTurn = back.joints[last].angle + (tailCarriage >= 0
    ? lerp(TAIL_SET.rest, TAIL_SET.flagged, tailCarriage)
    : lerp(TAIL_SET.rest, TAIL_SET.clamped, -tailCarriage))
  const tailJoints = skirt.joints.map((joint) => {
    const point = rotate2(joint.position, toRadians(tailTurn))
    return { x: point.x + croup.x, y: Math.max(1.5, point.y + croup.y) }
  })

  const earAim = finiteClamp(ears ?? (pointer.target ? 1 : scripted.ears), -1, 1, 0)
  const earTip = lerp(-40, 22, (earAim + 1) / 2)
  const earPan = lerp(34, 10, (earAim + 1) / 2)

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
  const at = (p: Vec2, across = 0) => camera.project(across, p.y, -p.x)
  const solid = (p: Solid) => camera.project(p.across, p.up, -p.forward)
  const flat = (p: Solid): Vec2 => {
    const screen = sideCamera.project(p.across, p.up, -p.forward)
    return { x: screen.x, y: -screen.y }
  }

  const readout = Math.round(soft * 100)
  const state = behavior === "couch"
    ? "couched"
    : walking === "halt"
      ? "standing"
      : `at a ${walking}`
  const footing = soft < 0.2 ? "on hard ground" : soft > 0.7 ? "in soft sand" : "on yielding ground"

  function earOutline(across: number): Solid[] {
    const pan = toRadians(across > 0 ? earPan : -earPan)
    const t = toRadians(earTip)
    const side = { forward: Math.cos(pan), up: 0, across: Math.sin(pan) }
    const up = {
      forward: -Math.cos(pan) * Math.sin(t),
      up: Math.cos(t),
      across: -Math.sin(pan) * Math.sin(t),
    }
    const base = alongBody(poll, headTilt, -2, 4)
    const point = (along: number, out: number): Solid => ({
      forward: base.x + up.forward * along + side.forward * out,
      up: base.y + up.up * along + side.up * out,
      across: across + up.across * along + side.across * out,
    })
    return [point(0, -EAR_HALF), point(EAR_HEIGHT, EAR_HALF * 0.2), point(0, EAR_HALF)]
  }

  /**
   * One limb. The roll is a rotation about the fore-aft axis, so in the flat
   * elevation it reaches the drawing the only way it can: as the two sides at
   * different heights, which is what a roll looks like from the side.
   */
  function limbDrawing(limb: CamelLimb) {
    const far = limb.side === "right"
    const heel = (limb.side === "left" ? 1 : -1) * HALF_TRACK
    const tip = Math.sin(toRadians(roll)) * heel
    const shift = far ? -7 : 0
    const move = (p: Vec2): Vec2 => ({ x: p.x + shift, y: p.y + tip })
    const padHalf = PAD.half * limb.spread
    return (
      <g key={limb.id} data-leg={limb.id} data-load={px(limb.load)} opacity={far ? 0.5 : 1}>
        <path d={capsulePath(move(limb.root), move(limb.mid), limb.fore ? 5.2 : 6.4)} {...shell} />
        <path d={capsulePath(move(limb.mid), move(limb.knee), limb.fore ? 3.6 : 4.2)} {...machined} />
        <path d={capsulePath(move(limb.knee), move(limb.fetlock), 2.3)} {...cast} />
        <path data-pastern={limb.id} d={capsulePath(move(limb.fetlock), move(limb.pad), 2)} {...machined} />
        {/* The pad: it opens under the weight on it, and that is what keeps
            the animal up out of the sand. */}
        <ellipse
          data-pad={limb.id}
          cx={px(move(limb.pad).x)}
          cy={px(move(limb.pad).y)}
          rx={px(padHalf)}
          ry={PAD.deep}
          {...cast}
        />
        <ellipse
          cx={px(move(limb.pad).x)}
          cy={px(move(limb.pad).y + 0.6)}
          rx={px(padHalf * 0.55)}
          ry={1.1}
          fill={palette.metal}
          opacity={0.5}
        />
        <circle data-hoof={limb.id} cx={px(move(limb.pad).x)} cy={px(limb.pad.y)} r={0.01} fill="none" />
        <circle
          data-joint={`${limb.id}-${limb.fore ? "elbow" : "stifle"}`}
          cx={px(move(limb.mid).x)} cy={px(move(limb.mid).y)} r={3.2} {...cast}
        />
        <circle cx={px(move(limb.knee).x)} cy={px(move(limb.knee).y)} r={2.5} {...cast} />
        <circle data-fetlock={limb.id} cx={px(move(limb.fetlock).x)} cy={px(move(limb.fetlock).y)} r={2.4} {...cast} />
        {limb.load > 0 && (
          <circle
            cx={px(move(limb.fetlock).x)} cy={px(move(limb.fetlock).y)} r={px(0.7 + limb.load * 1.1)}
            fill={palette.accent}
          />
        )}
        {/* The ground the pad has pushed aside. Drawn, not displaced. */}
        {limb.sunk > 0.1 && (
          <path
            data-bed
            d={`M ${px(move(limb.pad).x - padHalf - 3)} ${px(tip)} Q ${px(move(limb.pad).x)} ${px(tip - limb.sunk * 1.6)} ${px(move(limb.pad).x + padHalf + 3)} ${px(tip)}`}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.9}
            opacity={0.7}
          />
        )}
        {showContacts && limb.contact && (
          <ellipse data-contact cx={px(move(limb.pad).x)} cy={px(tip + 1)} rx={px(padHalf + 2)} ry={1.2} fill={palette.accent} opacity={0.55} />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot camel, ${state} ${footing}, ${readout} percent soft ground, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent soft ground` : undefined}
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
        if (delta !== 0) apply(soft + delta)
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
          <path d={`M 12 ${GROUND} H ${BOX.width - 12} M ${ORIGIN} 12 V ${GROUND + 14}`} strokeDasharray="2 3" />
          {/* How deep the ground goes at this softness, against the surface. */}
          <path
            data-depth
            d={`M 18 ${GROUND} V ${px(GROUND + soft * 10)}`}
            strokeDasharray="1 2"
          />
        </g>
      )}
      {showGround && (
        <g data-ground data-softness={px(soft)}>
          <path d={`M 14 ${GROUND} H ${BOX.width - 14}`} stroke={palette.grid} strokeWidth={0.8} fill="none" />
          {/* Soft ground reads as a band under the line rather than a hard edge. */}
          {soft > 0.05 && (
            <rect
              x={14}
              y={GROUND}
              width={BOX.width - 28}
              height={px(2 + soft * 9)}
              fill={palette.grid}
              opacity={px(0.08 + soft * 0.12)}
            />
          )}
          <ellipse
            cx={ORIGIN}
            cy={px(GROUND + 3)}
            rx={50}
            ry={4.4}
            fill={palette.dark}
            opacity={0.14}
          />
        </g>
      )}

      {offAxis && (
        <g data-solids transform={`translate(${ORIGIN} ${GROUND}) scale(${px(fit)})`}>
          {back.joints.slice(0, -1).map((joint, index) => {
            const a = spinePoint(index)
            const b = spinePoint(index + 1)
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const halfLength = Math.hypot(b.x - a.x, b.y - a.y) / 2 + 1.5
            const footprint = roundedFootprint(HALF_TRACK, halfLength, 5, 4).map((p) => ({ x: p.x, y: p.y - midX }))
            return <path key={index} d={extrudedPath(footprint, camera, midY + 9, midY - 10)} {...shell} />
          })}
          {limbs.map((limb) => {
            const across = limb.side === "left" ? HALF_TRACK : -HALF_TRACK
            return (
              <g key={limb.id}>
                <path d={capsulePath(at(limb.root, across * 0.6), at(limb.mid, across), limb.fore ? 5.2 : 6.4)} {...shell} />
                <path d={capsulePath(at(limb.mid, across), at(limb.knee, across), limb.fore ? 3.6 : 4.2)} {...machined} />
                <path d={capsulePath(at(limb.knee, across), at(limb.fetlock, across), 2.3)} {...cast} />
                <path d={capsulePath(at(limb.fetlock, across), at(limb.pad, across), 2)} {...machined} />
                {/* The pad is a disc on the ground plane, so its spread is what
                    a plan view is for. */}
                <ellipse
                  cx={px(at(limb.pad, across).x)}
                  cy={px(at(limb.pad, across).y)}
                  rx={px(PAD.half * limb.spread)}
                  ry={px(PAD.half * limb.spread * (0.35 + camera.flatten * 0.65))}
                  {...cast}
                />
              </g>
            )
          })}
          <path d={capsulePath(at(nape), at(crest), 8)} {...machined} />
          <path d={capsulePath(at(crest), at(poll), 5.6)} {...machined} />
          <path
            d={extrudedPath(
              roundedFootprint(5, 12, 4.5, 5).map((p) => ({ x: p.x, y: p.y - poll.x })),
              camera,
              poll.y + 4.5,
              poll.y - 5,
            )}
            {...shell}
          />
        </g>
      )}

      <Frame {...frame}>
        <g
          data-camel
          data-view={view}
          data-roll={px(roll)}
          transform={`translate(${ORIGIN} ${GROUND}) scale(1 -1)`}
        >
          {limbs.filter((limb) => limb.side === "right").map(limbDrawing)}

          <g data-tail>
            {tailJoints.slice(0, -1).map((joint, index) => (
              <path
                key={index}
                d={capsulePath(joint, tailJoints[index + 1], px(3 * (1 - (index / (tailJoints.length - 1)) ** 1.5) + 1))}
                {...machined}
              />
            ))}
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
              <path d={offsetLine(back, spinePoint, (t) => 4 - 1.4 * Math.sin(Math.PI * t))} />
              <path d={offsetLine(back, spinePoint, (t) => -(7 - 2.6 * Math.sin(Math.PI * t)))} />
            </g>
          </g>

          {/* The store. Its height is the reserve; its base is not. */}
          <path data-hump d={humpPath} {...shell} />

          <path data-neck d={capsulePath(nape, crest, 8)} {...machined} />
          <path d={capsulePath(crest, poll, 5.6)} {...machined} />
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
            <g transform="translate(1 -3) scale(0.92)">
              {/* A short deep head with the split lip that reads as this animal. */}
              <path
                d="M -7 -8 Q -11 6 -1 8.5 Q 6 8.5 9.5 5 Q 15 4.2 21 3 Q 24.5 2 24.5 -1 Q 24.5 -4.6 20.5 -5.6 Q 14 -7 8.5 -7 L 8 -5.5 Q 3 -10.5 -2.5 -10.5 Q -6.5 -10.5 -7 -8 Z"
                {...shell}
              />
              <path d="M 17.5 -6.2 Q 24.5 -4.6 24.5 -1 Q 24.5 2 21 2.9 Q 18.5 3.4 17.5 3.2 Q 19.5 0.4 17.5 -6.2 Z" {...cast} />
              <path d="M 20.5 -1.2 L 24.2 -1.2" stroke={palette.metal} strokeWidth={0.9} fill="none" />
              <circle cx={21.4} cy={-3} r={1.4} fill={palette.metal} />
              <path d="M -5.5 -1 Q 2 -3.5 7.5 0 Q 2 3 -4.5 2 Z" fill={palette.dark} opacity={0.18} stroke="none" />
              <g data-eyes>
                <g transform="translate(-2.6 -4.6)" opacity={0.5}>
                  <circle r={2.3} {...cast} />
                  <circle cx={px(0.8 + aim * 0.9)} r={1.1} fill={palette.accent} />
                </g>
                <g transform="translate(2.2 -5)">
                  <circle r={3} {...cast} />
                  <circle cx={px(1 + aim * 1.2)} r={1.4} fill={palette.accent} />
                </g>
              </g>
            </g>
          </g>

          {limbs.filter((limb) => limb.side === "left").map(limbDrawing)}

          <g data-joints>
            <circle data-joint="withers" cx={px(withersAt.x)} cy={px(withersAt.y)} r={3} {...cast} />
            <circle data-joint="hip" cx={px(hip.x)} cy={px(hip.y)} r={4.4} {...cast} />
            <circle cx={px(hip.x)} cy={px(hip.y)} r={1.7} fill={palette.metal} />
            <circle data-joint="poll" cx={px(poll.x)} cy={px(poll.y)} r={2.5} {...cast} />
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
 * One limb, built from the ground up. The pad opens under whatever this limb is
 * carrying, that spread drops its pressure, and the pressure is what takes it
 * into the ground — so the pad's height is `−footSinkage(...)`, which is the
 * only place in the registry a foot goes below the floor on purpose.
 */
function solveLimb(
  leg: GaitLeg,
  shoulder: Vec2,
  hip: Vec2,
  metaAngle: number,
  ground: number,
): CamelLimb {
  const root = leg.fore ? shoulder : hip
  const spread = padSpread(leg.load)
  const sunk = footSinkage(leg.load, ground, spread)
  const pad: Vec2 = {
    x: (leg.fore ? shoulder.x - 1 : hip.x + 3) + leg.foot.x,
    y: leg.foot.y - sunk,
  }
  const pastern = toRadians(PASTERN_REST - fetlockSink(leg.load))
  const fetlock: Vec2 = {
    x: pad.x - Math.cos(pastern) * PASTERN,
    y: pad.y + Math.sin(pastern) * PASTERN,
  }
  if (leg.fore) {
    const knee: Vec2 = { x: fetlock.x + 1.5, y: fetlock.y + FORE_CANNON }
    const [, elbow] = solveChain2(root, knee, [...FORE], { bend: "down" })
    return { id: leg.id, side: leg.side, fore: true, load: leg.load, contact: leg.contact, spread, sunk, root, mid: elbow, knee, fetlock, pad }
  }
  const hock: Vec2 = {
    x: fetlock.x - Math.sin(toRadians(metaAngle)) * HIND_CANNON,
    y: fetlock.y + Math.cos(toRadians(metaAngle)) * HIND_CANNON,
  }
  const [, stifle] = solveChain2(root, hock, [...HIND], { bend: "up" })
  return { id: leg.id, side: leg.side, fore: false, load: leg.load, contact: leg.contact, spread, sunk, root, mid: stifle, knee: hock, fetlock, pad }
}

/**
 * The hump, hung on the topline: an arch whose **height** is the reserve and
 * whose **base is not**, because the skin is still there when the store is
 * empty. Past the middle it leans over, which is what an empty store does.
 *
 * Built by bending the back's own two middle segments, so the fold is the
 * geometry moving rather than one drawing swapped for another.
 */
function humpOutline(
  back: SpinePose,
  place: (index: number) => Vec2,
  reserve: number,
): string {
  const store = clamp(reserve, 0, 1)
  const seat = place(2)
  const axis = toRadians(back.joints[2].angle)
  const up = { x: -Math.sin(axis), y: Math.cos(axis) }
  const along = { x: Math.cos(axis), y: Math.sin(axis) }
  const half = HUMP.base / 2
  const step = (base: Vec2, forward: number, rise: number): Vec2 => ({
    x: base.x + along.x * forward + up.x * rise,
    y: base.y + along.y * forward + up.y * rise,
  })
  // The base is what the reserve does not touch: the skin is still there when
  // the store is empty, so both feet stay exactly where they are.
  const front = step(seat, half, -1)
  const rear = step(seat, -half, -1)
  // The height goes with the store, and the lean comes on only in the bottom
  // half of it — which is where a slack store folds over rather than shrinking
  // any further.
  const height = HUMP.height * (0.18 + 0.82 * store)
  const lean = toRadians(HUMP.lean * (1 - Math.min(1, store * 2)))
  const crown = step(seat, Math.sin(lean) * height, Math.cos(lean) * height)
  // The flank behind the crown is the one that goes slack: its control point
  // drops and draws back as the store empties, which is the fold.
  const slack = 1 - store
  return [
    `M ${px(rear.x)} ${px(rear.y)}`,
    `C ${px(step(rear, -half * 0.5 * slack, height * lerp(0.86, 0.42, slack)).x)} ${px(step(rear, -half * 0.5 * slack, height * lerp(0.86, 0.42, slack)).y)}`,
    `${px(step(crown, -half * 0.62, 0).x)} ${px(step(crown, -half * 0.62, 0).y)}`,
    `${px(crown.x)} ${px(crown.y)}`,
    `C ${px(step(crown, half * 0.5, 0).x)} ${px(step(crown, half * 0.5, 0).y)}`,
    `${px(step(front, 0, height * 0.74).x)} ${px(step(front, 0, height * 0.74).y)}`,
    `${px(front.x)} ${px(front.y)}`,
    "Z",
  ].join(" ")
}

/**
 * How far the support is over to one side, −1 all on the left to 1 all on the
 * right. A pace puts both feet of a side down together and swings to ±1; a
 * trot's support is diagonal and it is exactly 0 at every instant.
 */
function sideBias(legs: readonly GaitLeg[]): number {
  let bias = 0
  for (const leg of legs) bias += (leg.side === "right" ? 1 : -1) * leg.load
  return clamp(bias, -1, 1)
}

/**
 * The roll one gait makes at one instant of its cycle, −1..1. Exported pure,
 * because the claim it carries — a pace rolls and a trot cannot — is the best
 * evidence the gait solver describes something rather than labelling it.
 */
export function camelRoll(gait: EquineGait, phase: number): number {
  // The body rolls *away* from whichever side is holding it up.
  return -sideBias(solveGait({ gait, phase }).legs)
}

/** The barrel: a short deep body carried high, with a hard tuck at the flank. */
const backline = (s: number) => 8 + 2.5 * s * s
const girth = (s: number) =>
  s < 0.4 ? lerp(15, 10, s / 0.4) : lerp(10, 14, (s - 0.4) / 0.6)

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

export interface CamelStance {
  arch: number
  crouch: number
  neck: number
  tail: number
}

export interface CamelPose {
  gait: EquineGait
  gaze: number
  ears: number
  /** What it is standing on when nobody says, 0 rock to 1 sand. */
  ground: number
  /** How much is in the hump when nobody says. */
  reserve: number
  stride: number
  swing: number
  mane: number
  flex: number
  stance: (cycle: number) => CamelStance
}

/**
 * What it does with no timeline on it. Pure in the clock, so the tests sample
 * it directly rather than faking animation frames.
 */
export function camelBehaviorPose(behavior: CamelBehavior, clock: number): CamelPose {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Four beats, the same lateral sequence a horse walks — which rolls, but
    // nothing like a pace does, because the feet of a side are half a beat apart.
    case "walk":
      return {
        gait: "walk",
        gaze: 0.14 * Math.sin(time * 0.5),
        ears: 0.6,
        ground: 0.75,
        reserve: 0.85,
        stride: 0.6,
        swing: 0.5,
        mane: 0.2,
        flex: 0.03,
        stance: () => ({ arch: 0, crouch: 0.12, neck: 0.6, tail: 0.1 }),
      }
    // The control case: diagonal pairs, and therefore no roll at all.
    case "trot":
      return {
        gait: "trot",
        gaze: 0.1 * Math.sin(time * 0.7),
        ears: 0.75,
        ground: 0.6,
        reserve: 0.85,
        stride: 0.78,
        swing: 0.65,
        mane: 0.35,
        flex: 0.04,
        stance: () => ({ arch: 0.03, crouch: 0.1, neck: 0.58, tail: 0.2 }),
      }
    // Down: knees folded right under it, the way one gets down to be loaded.
    case "couch":
      return {
        gait: "halt",
        gaze: 0.06 * Math.sin(time * 0.35),
        ears: -0.3,
        ground: 0.8,
        reserve: 0.8,
        stride: 0,
        swing: 0,
        mane: 0.06,
        flex: 0.02,
        stance: () => ({ arch: 0.2, crouch: 1, neck: 0.35, tail: -0.3 }),
      }
    case "static":
      return {
        gait: "halt",
        gaze: 0,
        ears: 0.45,
        ground: 0.7,
        reserve: 0.9,
        stride: 0,
        swing: 0,
        mane: 0,
        flex: 0,
        stance: () => ({ arch: 0, crouch: 0.1, neck: 0.62, tail: 0 }),
      }
    // The signature: lateral couplets, and the roll that falls out of them.
    default:
      return {
        gait: "pace",
        gaze: 0.12 * Math.sin(time * 0.45),
        ears: 0.65,
        ground: 0.85,
        reserve: 0.8,
        stride: 0.8,
        swing: 0.55,
        mane: 0.4,
        flex: 0.05,
        stance: () => ({ arch: 0.02, crouch: 0.1, neck: 0.64, tail: 0.15 }),
      }
  }
}

export { RobotCamel }
