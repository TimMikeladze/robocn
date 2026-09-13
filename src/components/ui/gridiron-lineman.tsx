"use client"

/**
 * gridiron-lineman — the machine that plays the game from the floor.
 *
 * The interesting thing about a three-point stance is that it is a *four*
 * contact stance: the down hand is on the turf carrying real load, which is
 * what lets the body pitch over far enough that it has to be there. So the
 * hand is not artwork — `stanceGeometry` hands over a target in the body frame,
 * the arm is solved to it, and the same number that puts it there is the share
 * of the machine standing on it.
 *
 * Everything below the shoulders is `solveSkeleton` from `skeleton-kinematics`,
 * the same solver `robot-skeleton` ships: legs solved in their own sagittal
 * planes to the ankle the stride asks for, feet rolling heel to toe, an
 * equal-segment spine. The arms are taken out of the swing and solved to their
 * own targets, because in this stance they are doing two different jobs.
 *
 * The armour is illustration. The helmet shell, the facemask, the shoulder
 * yoke and the pads are outlines from `gridiron-geometry` so all four players
 * wear the same kit, but nothing about them is load-bearing and no part of the
 * drawing is a team, a livery or a person.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  facemaskBars,
  helmetEar,
  helmetOutline,
  padOutline,
  playerUpperBody,
  shoulderYoke,
  stanceGeometry,
  stancePitch,
  type FacemaskStyle,
  type GridironStance,
} from "@/lib/robocn/gridiron"
import {
  clamp,
  lerp,
  normalize3,
  solveElbow3,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  solveSkeleton,
  type SkeletonLeg,
} from "@/lib/robocn/skeleton"
import {
  boxCorners,
  capsulePath,
  fitFrame,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type LinemanBehavior = "snap" | "drive" | "pull" | "set" | "static"

const VIEW_WIDTH = 230
const VIEW_HEIGHT = 210
const NATIVE_VIEW: RobotView = "profile"
const P = defaultProportions
/** The box the machine works inside, so the framing never breathes. */
const ENVELOPE = boxCorners({ x: -46, y: 0, z: -76 }, { x: 46, y: 142, z: 46 })

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface LinemanPose {
  /** 0 down in the stance, 1 at full extension out of it. */
  fire: number
  /** Gait cycle for the feet. */
  step: number
  /** Extra body rotation, for the one assignment that goes sideways. */
  turn: number
  /** How far the whole machine is driving forward, in world units. */
  drive: number
}

const smooth = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/**
 * What the machine is doing at clock time `t`, as a pure function of the clock.
 *
 * A snap is the whole sequence: still in the stance, fire out of it, drive,
 * and reset. `drive` and `pull` are that sequence's middle held open so the
 * feet keep working, which is what those two assignments actually are.
 */
export function linemanPose(behavior: LinemanBehavior, t: number): LinemanPose {
  const cycle = wrap(t)
  switch (behavior) {
    case "snap": {
      // Still, fire, hold the extension, then settle back down.
      const fire = cycle < 0.16 ? 0 : cycle < 0.44 ? smooth((cycle - 0.16) / 0.28) : cycle < 0.8 ? 1 : 1 - smooth((cycle - 0.8) / 0.2)
      return {
        fire,
        step: cycle < 0.16 ? 0 : wrap((cycle - 0.16) * 1.2),
        turn: 0,
        drive: fire * 14,
      }
    }
    case "drive":
      return { fire: 1, step: cycle, turn: 0, drive: 14 }
    case "pull":
      return {
        fire: 0.55,
        step: cycle,
        // Pulling turns the shoulders across the machine's own line.
        turn: Math.sin(2 * Math.PI * cycle) * 22,
        drive: 8,
      }
    case "set":
      // Not still: a set machine breathes, and that is the only motion.
      return { fire: 0.04 + Math.sin(2 * Math.PI * cycle) * 0.035, step: 0, turn: 0, drive: 0 }
    default:
      return { fire: 0, step: 0, turn: 0, drive: 0 }
  }
}

export interface GridironLinemanProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled fire: 0 in the stance, 1 at full extension. Stops the loop. */
  fire?: number
  /** What the machine does when `fire` is not supplied. */
  behavior?: LinemanBehavior
  stance?: GridironStance
  /** How low it plays, 0 to 1. Lower means a deeper crouch and more lean. */
  padLevel?: number
  mask?: FacemaskStyle
  /** Two characters on the chest plate. A caller's string, never a real one. */
  number?: string
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a line of them does not fire together. */
  offset?: number
  /** Drag across to work the snap by hand. */
  interactive?: boolean
  onFireChange?: (fire: number) => void
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GridironLineman({
  fire,
  behavior = "snap",
  stance = "three-point",
  padLevel = 0.5,
  mask = "cage",
  number = "",
  view = NATIVE_VIEW,
  speed = 0.4,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onFireChange,
  showGround = true,
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
  ...props
}: GridironLinemanProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = fire !== undefined
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const running = linemanPose(behavior, clock * speed)
  const extension = controlled
    ? (Number.isFinite(fire) ? clamp(fire!, 0, 1) : 0)
    : (held ?? running.fire)
  // Driving the machine by hand drives the whole sequence, not just the arms.
  const motion: LinemanPose =
    controlled || held !== null
      ? { fire: extension, step: extension * 0.5, turn: 0, drive: extension * 14 }
      : running

  const low = clamp(Number.isFinite(padLevel) ? padLevel : 0.5, 0, 1)
  const posture = stanceGeometry(stance)
  // Playing low is a deeper crouch; firing out of the stance stands it up.
  const crouch = clamp(posture.crouch - low * 0.12 + motion.fire * 0.42, 0, 1)

  const pose = solveSkeleton({
    gait: "walk",
    phase: posture.step + motion.step,
    stance: crouch,
    stride: 0.3 + motion.fire * 0.34,
    lift: 0.28,
    // The column is built below rather than here: a stance pitches further
    // than a standing machine ever does, and `solveSkeleton` rightly says so.
    lean: 0,
    proportions: P,
  })

  /* The flat back of a three-point stance is not typed in. The hand is on the
     turf, and `stancePitch` returns the column pitch that leaves the shoulder
     exactly one arm's length from it. Firing out of the stance interpolates
     that pitch back toward a driving posture. */
  const armReach = P.humerus + P.forearm
  const stanceLean = posture.downHand
    ? stancePitch({
        hipHeight: pose.pelvis.y,
        spine: P.spine,
        arm: armReach,
        hand: posture.downHand,
        shoulderSpan: P.shoulderSpan,
      })
    : posture.lean
  const lean = lerp(stanceLean + low * 4, 16, motion.fire)
  const body = playerUpperBody({
    pelvis: pose.pelvis,
    lean,
    twist: motion.turn,
    // The head comes up out of the column, which is the one thing a machine in
    // a stance has to do to see anything at all.
    gazePitch: lean - 24,
    gazeYaw: motion.turn * 0.5,
    proportions: P,
  })

  /* The arms do two different jobs, so they are solved to two targets rather
     than left in the gait's swing. In the stance one hand is on the turf; out
     of it, both punch forward at chest height. */
  const punchY = body.shoulders.y - 4
  const punchZ = body.shoulders.z - 34
  const target = (side: "left" | "right"): Vec3 => {
    const sign = side === "right" ? 1 : -1
    const rest: Vec3 =
      posture.downHand && side === "right"
        ? posture.downHand
        : { x: sign * Math.abs(posture.offHand.x), y: posture.offHand.y, z: posture.offHand.z }
    const punch: Vec3 = { x: sign * 15, y: punchY, z: punchZ }
    return {
      x: lerp(rest.x, punch.x, motion.fire),
      y: lerp(rest.y, punch.y, motion.fire),
      z: lerp(rest.z, punch.z, motion.fire),
    }
  }

  const sides: ("left" | "right")[] = ["left", "right"]
  const arms = sides.map((side) => {
    const sign = side === "right" ? 1 : -1
    const shoulder: Vec3 = {
      x: body.shoulders.x + body.right.x * sign * P.shoulderSpan,
      y: body.shoulders.y + body.right.y * sign * P.shoulderSpan,
      z: body.shoulders.z + body.right.z * sign * P.shoulderSpan,
    }
    const wrist = target(side)
    const elbow = solveElbow3(shoulder, wrist, P.humerus, P.forearm, {
      x: sign,
      y: -0.5,
      z: 0.5,
    })
    return { side, shoulder, elbow, wrist }
  })
  const downHand =
    posture.downHand && motion.fire < 0.5
      ? (arms.find((arm) => arm.side === "right")?.wrist ?? null)
      : null
  const handLoad = posture.handLoad * (1 - clamp(motion.fire * 2, 0, 1))

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onFireChange?.(bounded)
    },
    [onFireChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - 26, 10, 1.15)
  // The whole machine travels forward as it drives. Everything below works in
  // camera space and the fit transform puts it in the frame, so one uniform
  // scale carries the geometry and the line weights together.
  const push = motion.drive
  const place = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: point.z - push })
  const to = (point: Vec3): Vec2 => {
    const shifted = place(point)
    return camera.project(shifted.x, shifted.y, shifted.z)
  }
  const depthOf = (point: Vec3) => {
    const shifted = place(point)
    return camera.depth(shifted.x, shifted.y, shifted.z)
  }
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)
  const solid = (corners: readonly Vec3[]) => slabPath(corners.map(place), camera)
  const box = (centre: Vec3, hx: number, hy: number, hz: number, spin = 0) =>
    solid(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) => {
            const local = turnY({ x: sx * hx, y: sy * hy, z: sz * hz }, spin)
            return {
              x: centre.x + local.x,
              y: centre.y + local.y,
              z: centre.z + local.z,
            }
          }),
        ),
      ),
    )
  /** A plan footprint standing between two heights. */
  const extrude = (footprint: readonly Vec2[], top: number, bottom: number) =>
    solid(
      footprint.flatMap((point) => [
        { x: point.x, y: top, z: point.y },
        { x: point.x, y: bottom, z: point.y },
      ]),
    )
  /** A flat plate hung on a joint, facing the machine's nose. */
  const plateAt = (outline: readonly Vec2[], at: Vec3) =>
    solid(
      outline.flatMap((point) => [
        { x: at.x + point.x, y: at.y + point.y, z: at.z - 5 },
        { x: at.x + point.x, y: at.y + point.y, z: at.z - 1 },
      ]),
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plate = robotSurface("shell", variant, palette, 1.3)

  const { nose, up, right } = body
  const skull = P.skull * 0.62
  /** A point of the sagittal helmet drawing, out at `side` across the machine. */
  const onHead = (point: Vec2, side = 0): Vec3 => ({
    x: body.head.x + nose.x * point.x + up.x * point.y + right.x * side,
    y: body.head.y + nose.y * point.x + up.y * point.y + right.y * side,
    z: body.head.z + nose.z * point.x + up.z * point.y + right.z * side,
  })

  const helmetSolid = solid(
    helmetOutline(skull).flatMap((point) => [
      onHead(point, skull * 0.78),
      onHead(point, -skull * 0.78),
    ]),
  )
  const ear = onHead(helmetEar(skull), skull * 0.79)
  const bars = facemaskBars(skull, mask)

  const legPart = (leg: SkeletonLeg) => (
    <g key={`leg-${leg.side}`} data-leg={leg.side}>
      <path d={link(leg.hip, leg.knee, 6.2)} {...shell} />
      <path
        data-pad={`${leg.side}-thigh`}
        d={box(midpoint(leg.hip, leg.knee), 6.4, 10, 6, 0)}
        {...plate}
      />
      <path d={link(leg.knee, leg.ankle, 4.6)} {...machined} />
      <path
        data-pad={`${leg.side}-knee`}
        d={plateAt(padOutline(4.6, 4.2), leg.knee)}
        {...cast}
      />
      <g data-foot={leg.side}>
        <path d={link(leg.heel, leg.ball, 3.6)} {...shell} />
        <path d={link(leg.ball, leg.toe, 2.6)} {...machined} />
        {/* Cleats: the only reason a machine this heavy gets any drive at all. */}
        {[leg.heel, leg.ball, leg.toe].map((stud, index) => (
          <circle
            key={index}
            data-cleat={`${leg.side}-${index}`}
            cx={px(to({ ...stud, y: stud.y - 2 }).x)}
            cy={px(to({ ...stud, y: stud.y - 2 }).y)}
            r={1.5}
            fill={palette.dark}
            opacity={0.8}
          />
        ))}
      </g>
      {leg.contact > 0 && (
        <circle
          data-contact={leg.side}
          cx={px(to(leg.ball).x)}
          cy={px(to(leg.ball).y)}
          r={2.4}
          fill={palette.accent}
          fillOpacity={px(0.2 + leg.contact * 0.7)}
        />
      )}
    </g>
  )

  const armPart = (arm: (typeof arms)[number]) => (
    <g key={`arm-${arm.side}`} data-arm={arm.side}>
      <path d={link(arm.shoulder, arm.elbow, 5.2)} {...shell} />
      <path d={link(arm.elbow, arm.wrist, 4.2)} {...machined} />
      <circle
        cx={px(to(arm.elbow).x)}
        cy={px(to(arm.elbow).y)}
        r={3.4}
        {...cast}
      />
      <path data-hand={arm.side} d={box(arm.wrist, 3.4, 3.4, 4.4)} {...cast} />
    </g>
  )

  const legs = [...pose.legs].sort((a, b) => depthOf(a.hip) - depthOf(b.hip))
  const ordered = [...arms].sort((a, b) => depthOf(a.shoulder) - depthOf(b.shoulder))
  const yoke = shoulderYoke(P.shoulderSpan * 1.7, 14).map((point) => {
    const turned = turnY({ x: point.x, y: 0, z: point.y }, body.shoulderYaw)
    return { x: body.shoulders.x + turned.x, y: body.shoulders.z + turned.z }
  })
  /* Which way the chest faces: perpendicular to the column inside the sagittal
     plane, so the plate lands on the front of the machine in every posture —
     downward in a stance, forward once it stands up. */
  const spineDir = normalize3(
    {
      x: body.shoulders.x - pose.pelvis.x,
      y: body.shoulders.y - pose.pelvis.y,
      z: body.shoulders.z - pose.pelvis.z,
    },
    { x: 0, y: 1, z: 0 },
  )
  const torsoFront = normalize3(
    {
      x: spineDir.y * right.z - spineDir.z * right.y,
      y: spineDir.z * right.x - spineDir.x * right.z,
      z: spineDir.x * right.y - spineDir.y * right.x,
    },
    { x: 0, y: 0, z: -1 },
  )
  const spineMid = midpoint(body.spine[Math.max(1, body.spine.length - 3)], body.shoulders)
  const chest: Vec3 = {
    x: spineMid.x + torsoFront.x * 7,
    y: spineMid.y + torsoFront.y * 7,
    z: spineMid.z + torsoFront.z * 7,
  }
  const chestFacing = camera.depth(nose.x, nose.y, nose.z) > 0
  const readout = Math.round(extension * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Gridiron lineman, ${stance.replace("-", " ")} stance, ${readout} percent out of it${downHand ? ", one hand on the turf" : ""}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% out of the stance` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (event.key === "ArrowRight" || event.key === "ArrowUp") apply(extension + 0.06)
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") apply(extension - 0.06)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") setHeld(null)
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
      data-view={view}
      data-stance={stance}
      {...props}
    >
      <g data-machine transform={frame.transform}>
      {showGround && (
        <ellipse
          data-ground
          cx={px(to({ x: 0, y: 0, z: 0 }).x)}
          cy={px(to({ x: 0, y: 0, z: 0 }).y)}
          rx={40}
          ry={px(5 + 4 * camera.flatten)}
          fill={palette.dark}
          opacity={0.15}
        />
      )}

      {legPart(legs[0])}
      {armPart(ordered[0])}

      <g data-pelvis>
        <path d={box({ ...pose.pelvis, y: pose.pelvis.y - 4 }, 15, 9, 9, pose.pelvisYaw)} {...shell} />
      </g>

      <g data-spine>
        {body.spine.map((vertebra, index) =>
          index > 0 ? (
            <path key={index} d={link(body.spine[index - 1], vertebra, 7.4)} {...shell} />
          ) : null,
        )}
      </g>

      <g data-pads>
        <path
          data-shoulder-pad="yoke"
          d={extrude(yoke, body.shoulders.y + 7, body.shoulders.y - 9)}
          {...plate}
        />
        <path data-chest d={box(chest, 12, 7, 5, body.shoulderYaw)} {...machined} />
        {number && chestFacing && (
          <text
            x={px(to(chest).x)}
            y={px(to(chest).y + 3)}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={11}
            fill={palette.dark}
            opacity={0.85}
          >
            {number.slice(0, 2)}
          </text>
        )}
      </g>

      <g data-helmet>
        <path d={helmetSolid} {...shell} />
        <circle
          cx={px(to(ear).x)}
          cy={px(to(ear).y)}
          r={2.8}
          fill={palette.dark}
          opacity={0.6}
        />
        <g
          data-facemask
          fill="none"
          stroke={variant === "wire" ? palette.grid : palette.metal}
          strokeWidth={1.5}
          strokeLinecap="round"
        >
          {bars.map((bar, index) => {
            const a = to(onHead(bar[0], 0))
            const b = to(onHead(bar[1], 0))
            return <path key={index} d={`M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`} />
          })}
        </g>
      </g>

      {armPart(ordered[1])}
      {legPart(legs[1])}

      {downHand && (
        <circle
          data-down-hand
          cx={px(to({ ...downHand, y: 0 }).x)}
          cy={px(to({ ...downHand, y: 0 }).y)}
          r={3.6}
          fill={palette.accent}
          fillOpacity={px(0.25 + handLoad * 2)}
        />
      )}

      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.4} opacity={0.7}>
          <path
            d={`M ${px(to({ x: -54, y: 0, z: 0 }).x)} ${px(to({ x: -54, y: 0, z: 0 }).y)} L ${px(to({ x: 54, y: 0, z: 0 }).x)} ${px(to({ x: 54, y: 0, z: 0 }).y)}`}
            strokeDasharray="2 3"
          />
        </g>
      )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 14} fontSize={5}>
          {`${behavior.toUpperCase()} / ${readout}% OUT / ${downHand ? `HAND ${Math.round(handLoad * 100)}%` : "HANDS UP"}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 5} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})

/** Turn a point about the vertical, in degrees. */
function turnY(point: Vec3, degrees: number): Vec3 {
  const a = (clamp(Number.isFinite(degrees) ? degrees : 0, -180, 180) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c }
}

export { GridironLineman }
