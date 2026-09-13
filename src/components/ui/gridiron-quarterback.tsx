"use client"

/**
 * gridiron-quarterback — the machine that puts the ball in the air.
 *
 * The throw is one number. `release` runs from the ball cocked behind the ear
 * to the follow-through across the body, and the hand travels the arc between
 * those two points; the arm is `solveElbow3` to wherever that is, so the elbow
 * is an output rather than a keyframe. The ball is in the hand until the
 * release point of that arc and on its own trajectory afterwards, and the
 * velocity it leaves with is the velocity the hand had — the release angle on
 * the readout is the direction of the last bit of the swing, not a constant.
 *
 * Everything below the shoulders is `solveSkeleton` from `skeleton-kinematics`;
 * the column is `playerUpperBody`, whose chord is the pitch, so the machine can
 * lean away from the throw without its back stretching.
 *
 * What is *not* drawn is the rest of the flight. The machine is about two yards
 * tall and the pass goes twenty, so drawing both at one scale makes one of them
 * invisible: the ball leaves the hand on the real parabola and exits the frame,
 * and the readout carries the range and the hang time `kickFlight` produced.
 * There is no air in that parabola — it is drag-free, so it flatters the throw.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  ballFrame,
  ballLaces,
  ballSilhouette,
  defaultBall,
  facemaskBars,
  helmetEar,
  helmetOutline,
  kickFlight,
  padOutline,
  playerUpperBody,
  shoulderYoke,
  type FacemaskStyle,
} from "@/lib/robocn/gridiron"
import {
  clamp,
  lerp,
  normalize3,
  solveElbow3,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import { defaultProportions, solveSkeleton, type SkeletonLeg } from "@/lib/robocn/skeleton"
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
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type QuarterbackBehavior = "drop" | "throw" | "scramble" | "set" | "static"

const VIEW_WIDTH = 230
const VIEW_HEIGHT = 224
const NATIVE_VIEW: RobotView = "profile"
const P = defaultProportions
const ENVELOPE = boxCorners({ x: -42, y: 0, z: -54 }, { x: 42, y: 186, z: 62 })
/** World units in a yard: the machine is a shade under two yards tall. */
const YARD = 78
/** Where along the swing the ball leaves the hand. */
const RELEASE_AT = 0.55
/** Seconds of real flight the tail of the cycle covers. */
const SHOWN_FLIGHT = 0.11

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const smooth = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

export interface QuarterbackPose {
  /** How far back into the pocket, in world units. */
  depth: number
  /** The swing: 0 cocked, `RELEASE_AT` at the release, 1 through it. */
  swing: number
  /** Gait cycle for the feet. */
  step: number
  /** Sideways drift, for the one behaviour that leaves the pocket. */
  slide: number
}

/**
 * What the machine is doing at clock time `t`, as a pure function of the clock.
 * A throw is a drop, a plant, a swing and a reset; the other behaviours are
 * pieces of that sequence held open.
 */
export function quarterbackPose(
  behavior: QuarterbackBehavior,
  t: number,
  steps = 5,
): QuarterbackPose {
  const cycle = wrap(t)
  const drop = clamp(Number.isFinite(steps) ? steps : 5, 1, 9) * 9
  switch (behavior) {
    case "throw": {
      const back = cycle < 0.34 ? smooth(cycle / 0.34) : 1
      const swing = cycle < 0.38 ? 0 : smooth((cycle - 0.38) / 0.34)
      return {
        depth: drop * back * (cycle > 0.86 ? 1 - smooth((cycle - 0.86) / 0.14) : 1),
        swing,
        step: cycle < 0.34 ? wrap(cycle * 2.4) : 0,
        slide: 0,
      }
    }
    case "drop":
      return {
        depth: drop * (cycle < 0.55 ? smooth(cycle / 0.55) : 1 - smooth((cycle - 0.7) / 0.3)),
        swing: 0,
        step: wrap(cycle * 2.4),
        slide: 0,
      }
    case "scramble":
      return {
        depth: drop * 0.6,
        swing: 0,
        step: cycle,
        // Out of the pocket and back: the only behaviour that moves sideways.
        slide: Math.sin(2 * Math.PI * cycle) * 26,
      }
    case "set":
      // Ball at the chest, weight shifting: still, but not a diagram.
      return { depth: drop * 0.8, swing: 0, step: 0, slide: Math.sin(2 * Math.PI * cycle) * 3 }
    default:
      return { depth: 0, swing: 0, step: 0, slide: 0 }
  }
}

/** Which way the camera lies: the gradient of the camera's own depth. */
const viewDirection = (camera: RobotCamera): Vec3 => ({
  x: camera.depth(1, 0, 0),
  y: camera.depth(0, 1, 0),
  z: camera.depth(0, 0, 1),
})

export interface GridironQuarterbackProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled swing: 0 cocked, 1 through the follow-through. Stops the loop. */
  release?: number
  /** What the machine does when `release` is not supplied. */
  behavior?: QuarterbackBehavior
  /** Steps of the drop-back. */
  steps?: number
  /** Release speed in yards per second. A hard pass is about 27. */
  velocity?: number
  mask?: FacemaskStyle
  /** Two characters on the chest plate. A caller's string, never a real one. */
  number?: string
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  showBall?: boolean
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** Drag across to work the throw by hand. */
  interactive?: boolean
  onReleaseChange?: (release: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GridironQuarterback({
  release,
  behavior = "throw",
  steps = 5,
  velocity = 27,
  mask = "cage",
  number = "",
  view = NATIVE_VIEW,
  showBall = true,
  showGround = true,
  speed = 0.4,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onReleaseChange,
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
}: GridironQuarterbackProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = release !== undefined
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const running = quarterbackPose(behavior, clock * speed, steps)
  const swung = controlled
    ? (Number.isFinite(release) ? clamp(release!, 0, 1) : 0)
    : (held ?? running.swing)
  const motion: QuarterbackPose =
    controlled || held !== null
      ? { ...running, swing: swung, depth: running.depth || 40 }
      : running

  const pose = solveSkeleton({
    gait: motion.step > 0 ? "walk" : "stand",
    phase: motion.step,
    stance: 0.84 - motion.swing * 0.08,
    stride: 0.5,
    lift: 0.35,
    lean: 0,
    proportions: P,
  })
  // Throwing turns the shoulders through the ball and leans the machine into
  // the front foot, so both come off the same number.
  const twist = lerp(34, -30, clamp(motion.swing, 0, 1))
  const lean = lerp(-4, 16, clamp(motion.swing, 0, 1))
  const body = playerUpperBody({
    pelvis: pose.pelvis,
    lean,
    twist,
    gazePitch: lean + 6,
    gazeYaw: twist * 0.45,
    proportions: P,
  })

  /* The swing: three points the hand passes through. Cocked behind the ear,
     out in front at the release, and down across the body afterwards. The
     elbow is never placed — it is whatever `solveElbow3` makes of the hand. */
  const shoulderAt = (side: "left" | "right"): Vec3 => {
    const sign = side === "right" ? 1 : -1
    return {
      x: body.shoulders.x + body.right.x * sign * P.shoulderSpan,
      y: body.shoulders.y + body.right.y * sign * P.shoulderSpan,
      z: body.shoulders.z + body.right.z * sign * P.shoulderSpan,
    }
  }
  const cocked: Vec3 = { x: 24, y: body.shoulders.y + 15, z: body.shoulders.z + 18 }
  const released: Vec3 = { x: 15, y: body.shoulders.y + 24, z: body.shoulders.z - 28 }
  const through: Vec3 = { x: -12, y: body.shoulders.y - 22, z: body.shoulders.z - 24 }
  const along = (fraction: number): Vec3 => {
    const t = clamp(fraction, 0, 1)
    return t <= RELEASE_AT
      ? mix(cocked, released, t / RELEASE_AT)
      : mix(released, through, (t - RELEASE_AT) / (1 - RELEASE_AT))
  }
  const throwHand = along(motion.swing)
  // The release velocity is the velocity of the swing, sampled at the release.
  const justBefore = along(RELEASE_AT - 0.06)
  const launchDir = normalize3(
    { x: released.x - justBefore.x, y: released.y - justBefore.y, z: released.z - justBefore.z },
    { x: 0, y: 0.3, z: -1 },
  )
  const launchAngle =
    (Math.atan2(launchDir.y, Math.hypot(launchDir.x, launchDir.z)) * 180) / Math.PI
  const flight = kickFlight({
    speed: Math.max(1, Number.isFinite(velocity) ? velocity : 27),
    angle: launchAngle,
    height: released.y / YARD,
  })

  const offHand: Vec3 = mix(
    { x: -16, y: body.shoulders.y - 6, z: body.shoulders.z - 16 },
    { x: -22, y: body.shoulders.y - 14, z: body.shoulders.z + 6 },
    clamp(motion.swing, 0, 1),
  )
  const arms = (["left", "right"] as const).map((side) => {
    const sign = side === "right" ? 1 : -1
    const shoulder = shoulderAt(side)
    const wrist = side === "right" ? throwHand : offHand
    return {
      side,
      shoulder,
      wrist,
      elbow: solveElbow3(shoulder, wrist, P.humerus, P.forearm, { x: sign, y: -0.8, z: 0.4 }),
    }
  })

  /* Once the ball is gone it is on the parabola, and a slice of that parabola
     is what the frame can hold. */
  const gone = motion.swing > RELEASE_AT
  const sinceRelease = gone
    ? ((motion.swing - RELEASE_AT) / (1 - RELEASE_AT)) * SHOWN_FLIGHT
    : 0
  const shot = flight.at(sinceRelease)
  const heading = { x: launchDir.x, z: launchDir.z }
  const spread = Math.max(1e-6, Math.hypot(heading.x, heading.z))
  const ballAt: Vec3 = gone
    ? {
        x: released.x + ((heading.x / spread) * shot.x * YARD),
        y: shot.y * YARD,
        z: released.z + ((heading.z / spread) * shot.x * YARD),
      }
    : throwHand
  const ballSpin = gone ? sinceRelease * 9 : motion.swing * 0.6

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onReleaseChange?.(bounded)
    },
    [onReleaseChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT - 26, 10, 1.05)
  const back = motion.depth
  const place = (point: Vec3): Vec3 => ({
    x: point.x + motion.slide,
    y: point.y,
    z: point.z + back,
  })
  const to = (point: Vec3): Vec2 => {
    const at = place(point)
    return camera.project(at.x, at.y, at.z)
  }
  const depthOf = (point: Vec3) => {
    const at = place(point)
    return camera.depth(at.x, at.y, at.z)
  }
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)
  const solid = (corners: readonly Vec3[]) => slabPath(corners.map(place), camera)
  const box = (centre: Vec3, hx: number, hy: number, hz: number, spin = 0) =>
    solid(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) => {
            const local = turnY({ x: sx * hx, y: sy * hy, z: sz * hz }, spin)
            return { x: centre.x + local.x, y: centre.y + local.y, z: centre.z + local.z }
          }),
        ),
      ),
    )
  const extrude = (footprint: readonly Vec2[], top: number, bottom: number) =>
    solid(
      footprint.flatMap((point) => [
        { x: point.x, y: top, z: point.y },
        { x: point.x, y: bottom, z: point.y },
      ]),
    )
  const plateAt = (outline: readonly Vec2[], at: Vec3) =>
    solid(
      outline.flatMap((point) => [
        { x: at.x + point.x, y: at.y + point.y, z: at.z - 5 },
        { x: at.x + point.x, y: at.y + point.y, z: at.z - 1 },
      ]),
    )
  const line = (points: readonly Vec2[], close = false) =>
    `${points.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")}${close ? " Z" : ""}`

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const plate = robotSurface("shell", variant, palette, 1.3)

  const { nose, up, right } = body
  const skull = P.skull * 0.62
  const onHead = (point: Vec2, side = 0): Vec3 => ({
    x: body.head.x + nose.x * point.x + up.x * point.y + right.x * side,
    y: body.head.y + nose.y * point.x + up.y * point.y + right.y * side,
    z: body.head.z + nose.z * point.x + up.z * point.y + right.z * side,
  })
  const helmetSolid = solid(
    helmetOutline(skull).flatMap((point) => [onHead(point, skull * 0.78), onHead(point, -skull * 0.78)]),
  )
  const ear = onHead(helmetEar(skull), skull * 0.79)
  const bars = facemaskBars(skull, mask)

  // The ball, carried or thrown: the same prolate spheroid `robot-football` is.
  const look = viewDirection(camera)
  const carried = ballFrame({
    yaw: gone ? (Math.atan2(heading.x, -heading.z) * 180) / Math.PI : twist * 0.6,
    pitch: gone ? launchAngle : 24,
    roll: ballSpin * 360,
  })
  const ballShape = { long: defaultBall.long * 0.8, waist: defaultBall.waist * 0.8 }
  const ballOutline = ballSilhouette(carried, ballShape, look, 28).map((point) =>
    to({ x: ballAt.x + point.x, y: ballAt.y + point.y, z: ballAt.z + point.z }),
  )
  const ballLaceMarks = ballLaces(carried, ballShape, look, 5, 14)

  const legPart = (leg: SkeletonLeg) => (
    <g key={`leg-${leg.side}`} data-leg={leg.side}>
      <path d={link(leg.hip, leg.knee, 6)} {...shell} />
      <path d={link(leg.knee, leg.ankle, 4.4)} {...machined} />
      <path data-pad={`${leg.side}-knee`} d={plateAt(padOutline(4.4, 4), leg.knee)} {...cast} />
      <g data-foot={leg.side}>
        <path d={link(leg.heel, leg.ball, 3.4)} {...shell} />
        <path d={link(leg.ball, leg.toe, 2.4)} {...machined} />
      </g>
    </g>
  )

  const armPart = (arm: (typeof arms)[number]) => (
    <g key={`arm-${arm.side}`} data-arm={arm.side} {...(arm.side === "right" ? { "data-throw-arm": "" } : null)}>
      <path d={link(arm.shoulder, arm.elbow, 5)} {...shell} />
      <path d={link(arm.elbow, arm.wrist, 4)} {...machined} />
      <circle cx={px(to(arm.elbow).x)} cy={px(to(arm.elbow).y)} r={3.2} {...cast} />
      <path data-hand={arm.side} d={box(arm.wrist, 3.2, 3.2, 4)} {...cast} />
    </g>
  )

  const legs = [...pose.legs].sort((a, b) => depthOf(a.hip) - depthOf(b.hip))
  const ordered = [...arms].sort((a, b) => depthOf(a.shoulder) - depthOf(b.shoulder))
  const yoke = shoulderYoke(P.shoulderSpan * 1.7, 14).map((point) => {
    const turned = turnY({ x: point.x, y: 0, z: point.y }, body.shoulderYaw)
    return { x: body.shoulders.x + turned.x, y: body.shoulders.z + turned.z }
  })
  const spineDir = normalize3(
    {
      x: body.shoulders.x - pose.pelvis.x,
      y: body.shoulders.y - pose.pelvis.y,
      z: body.shoulders.z - pose.pelvis.z,
    },
    { x: 0, y: 1, z: 0 },
  )
  const torsoFront = normalize3(cross3(spineDir, right), { x: 0, y: 0, z: -1 })
  const spineMid = midpoint(body.spine[Math.max(1, body.spine.length - 3)], body.shoulders)
  const chest: Vec3 = {
    x: spineMid.x + torsoFront.x * 7,
    y: spineMid.y + torsoFront.y * 7,
    z: spineMid.z + torsoFront.z * 7,
  }
  const chestFacing = camera.depth(torsoFront.x, torsoFront.y, torsoFront.z) > 0
  const readout = Math.round(swung * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Gridiron quarterback, ${gone ? "ball away" : "ball in hand"}, ${readout} percent through the throw, ${Math.round(flight.range)} yard range, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% through the throw` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (event.key === "ArrowRight" || event.key === "ArrowUp") apply(swung + 0.05)
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") apply(swung - 0.05)
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
      {...props}
    >
      <g data-machine transform={frame.transform}>
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0, z: 0 }).x)}
            cy={px(to({ x: 0, y: 0, z: 0 }).y)}
            rx={32}
            ry={px(5 + 4 * camera.flatten)}
            fill={palette.dark}
            opacity={0.15}
          />
        )}

        {/* Where the machine set up, so a drop-back reads as travel. */}
        <g data-pocket fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={line([
              camera.project(-26, 0.5, back - 2),
              camera.project(26, 0.5, back - 2),
            ])}
            strokeDasharray="3 3"
          />
        </g>

        {legPart(legs[0])}
        {armPart(ordered[0])}

        <g data-pelvis>
          <path d={box({ ...pose.pelvis, y: pose.pelvis.y - 4 }, 14, 9, 8, pose.pelvisYaw)} {...shell} />
        </g>

        <g data-spine>
          {body.spine.map((vertebra, index) =>
            index > 0 ? (
              <path key={index} d={link(body.spine[index - 1], vertebra, 6.8)} {...shell} />
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
          <circle cx={px(to(ear).x)} cy={px(to(ear).y)} r={2.6} fill={palette.dark} opacity={0.6} />
          <g
            data-facemask
            fill="none"
            stroke={variant === "wire" ? palette.grid : palette.metal}
            strokeWidth={1.4}
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

        {showBall && (
          <g data-ball data-away={gone ? "" : undefined}>
            <path d={line(ballOutline, true)} {...robotSurface("dark", variant, palette)} />
            {ballLaceMarks.map((stitch, index) =>
              stitch.facing > 0 ? (
                <line
                  key={index}
                  data-lace={index}
                  x1={px(to({ x: ballAt.x + stitch.a.x, y: ballAt.y + stitch.a.y, z: ballAt.z + stitch.a.z }).x)}
                  y1={px(to({ x: ballAt.x + stitch.a.x, y: ballAt.y + stitch.a.y, z: ballAt.z + stitch.a.z }).y)}
                  x2={px(to({ x: ballAt.x + stitch.b.x, y: ballAt.y + stitch.b.y, z: ballAt.z + stitch.b.z }).x)}
                  y2={px(to({ x: ballAt.x + stitch.b.x, y: ballAt.y + stitch.b.y, z: ballAt.z + stitch.b.z }).y)}
                  stroke={palette.accent}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              ) : null,
            )}
          </g>
        )}

        {gone && (
          <path
            data-release
            d={line(
              Array.from({ length: 10 }, (_, index) => {
                const at = flight.at((index / 9) * sinceRelease)
                return to({
                  x: released.x + (heading.x / spread) * at.x * YARD,
                  y: at.y * YARD,
                  z: released.z + (heading.z / spread) * at.x * YARD,
                })
              }),
            )}
            fill="none"
            stroke={palette.accent}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.55}
          />
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 14} fontSize={5}>
          {`${behavior.toUpperCase()} / ${readout}% / ${Math.round(launchAngle)}° / ${Math.round(flight.range)} YD / ${flight.hangTime.toFixed(1)} S`}
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

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, clamp(t, 0, 1)),
  y: lerp(a.y, b.y, clamp(t, 0, 1)),
  z: lerp(a.z, b.z, clamp(t, 0, 1)),
})

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function turnY(point: Vec3, degrees: number): Vec3 {
  const a = (clamp(Number.isFinite(degrees) ? degrees : 0, -180, 180) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c }
}

export { GridironQuarterback }
