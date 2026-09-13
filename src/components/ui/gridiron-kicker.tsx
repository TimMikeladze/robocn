"use client"

/**
 * gridiron-kicker — a leg that meets a ball, and the arc that follows from it.
 *
 * The swing is a path the ankle travels: cocked behind, through the ball,
 * and up into the follow-through. The leg is solved to wherever that path has
 * got to, so the knee is an output. Contact happens at one point on that path,
 * and the ball leaves there — the launch height on the trajectory is the
 * height of the strike, not a constant.
 *
 * Then the two registers, and they are different scales on purpose. The
 * machine is at machine scale; the flight is a **plot** above it at field
 * scale, with the uprights on it at the distance asked for, and the panel says
 * how many yards it spans. A machine is two yards tall and a field goal is
 * thirty-five, so one scale would lose one of them. Whether the kick is good is
 * read off that plot rather than typed in: the ball's height where the bar is,
 * against the height of the bar.
 *
 * The parabola is drag-free. A real ball does not go this far, and the docs
 * say so.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  ballFrame,
  ballLaces,
  ballSilhouette,
  defaultBall,
  facemaskBars,
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
import {
  defaultProportions,
  footPoints,
  solveLeg,
  solveSkeleton,
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
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

export type KickerBehavior = "kick" | "approach" | "set" | "static"
export type KickStyle = "place" | "punt" | "kickoff"

const VIEW_WIDTH = 260
const VIEW_HEIGHT = 232
const NATIVE_VIEW: RobotView = "profile"
const P = defaultProportions
const ENVELOPE = boxCorners({ x: -40, y: 0, z: -54 }, { x: 40, y: 176, z: 54 })
/** The flight plot, in viewBox units. */
const PLOT = { x: 10, y: 10, width: 240, height: 68 }
/** Where the machine sits under it. */
const STAGE = { top: 92, height: 116 }
/** The crossbar, in yards: ten feet. */
const BAR = 10 / 3
/** How far the posts stand above the bar, in yards. */
const POST = 6.7
/** Where in the swing the boot meets the ball. */
const CONTACT = 0.5

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const smooth = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/** The three kicks, and what they do differently. */
const kicks: Record<KickStyle, { speed: number; angle: number; strike: number; hold: boolean }> = {
  // Off the turf, flat and hard.
  place: { speed: 29, angle: 38, strike: 8, hold: true },
  // Dropped from the hands, struck high, and it trades range for hang time.
  punt: { speed: 25, angle: 54, strike: 34, hold: false },
  // Teed up and hit for everything.
  kickoff: { speed: 32, angle: 44, strike: 10, hold: true },
}

export interface KickerSwing {
  /** 0 cocked, `CONTACT` at the strike, 1 through the follow-through. */
  swing: number
  /** Approach steps, as a gait cycle. */
  step: number
  /** How far the machine has walked into the kick, in world units. */
  approach: number
}

/**
 * The swing at clock time `t`, as a pure function of the clock: a couple of
 * steps in, the strike, the follow-through, and a reset.
 */
export function kickerSwing(behavior: KickerBehavior, t: number): KickerSwing {
  const cycle = wrap(t)
  switch (behavior) {
    case "kick": {
      const walk = cycle < 0.36 ? smooth(cycle / 0.36) : 1
      return {
        swing: cycle < 0.36 ? 0 : cycle < 0.78 ? smooth((cycle - 0.36) / 0.42) : 1 - smooth((cycle - 0.82) / 0.18),
        step: cycle < 0.36 ? wrap(cycle * 2.6) : 0,
        approach: walk * 24 * (cycle > 0.86 ? 1 - smooth((cycle - 0.86) / 0.14) : 1),
      }
    }
    case "approach":
      return { swing: 0, step: cycle, approach: 24 * smooth(Math.sin(Math.PI * cycle)) }
    case "set":
      return { swing: 0.02 + Math.sin(2 * Math.PI * cycle) * 0.018, step: 0, approach: 0 }
    default:
      return { swing: 0, step: 0, approach: 0 }
  }
}

const viewDirection = (camera: RobotCamera): Vec3 => ({
  x: camera.depth(1, 0, 0),
  y: camera.depth(0, 1, 0),
  z: camera.depth(0, 0, 1),
})

export interface GridironKickerProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled swing: 0 cocked, 1 through the follow-through. Stops the loop. */
  swing?: number
  /** What the machine does when `swing` is not supplied. */
  behavior?: KickerBehavior
  kick?: KickStyle
  /** How hard, 0 to 1. Scales the launch speed the kick style starts from. */
  power?: number
  /** Launch angle in degrees. Omit and the kick style picks one. */
  angle?: number
  /** Distance to the uprights, in yards. */
  distance?: number
  mask?: FacemaskStyle
  number?: string
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Draw the flight plot beside the machine. */
  showPlot?: boolean
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** Drag across to work the swing by hand. */
  interactive?: boolean
  onSwingChange?: (swing: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GridironKicker({
  swing,
  behavior = "kick",
  kick = "place",
  power = 0.85,
  angle,
  distance = 35,
  mask = "bar",
  number = "",
  view = NATIVE_VIEW,
  showPlot = true,
  showGround = true,
  speed = 0.4,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onSwingChange,
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
}: GridironKickerProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const style_ = kicks[kick] ?? kicks.place
  const controlled = swing !== undefined
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const running = kickerSwing(behavior, clock * speed)
  const swung = controlled
    ? (Number.isFinite(swing) ? clamp(swing!, 0, 1) : 0)
    : (held ?? running.swing)
  const motion: KickerSwing =
    controlled || held !== null ? { swing: swung, step: 0, approach: 24 } : running

  /* The solved flight. The launch height is the height of the strike, so a
     punt starts where the ball was dropped and a placement starts off the
     turf — that is a different trajectory, not a different number typed in. */
  const drive = clamp(Number.isFinite(power) ? power : 0.85, 0.15, 1.2)
  const launchAngle = clamp(
    angle !== undefined && Number.isFinite(angle) ? angle : style_.angle,
    5,
    80,
  )
  const strikeHeight = style_.strike
  const flight = kickFlight({
    speed: style_.speed * drive,
    angle: launchAngle,
    // World units into yards: the machine is a shade under two yards tall.
    height: strikeHeight / 78,
  })
  const posts = clamp(Number.isFinite(distance) ? distance : 35, 5, 70)
  const heightAt = (yards: number) => {
    const forward = Math.max(1e-6, flight.speed * Math.cos((launchAngle * Math.PI) / 180))
    return flight.at(yards / forward).y
  }
  const clears = flight.range >= posts && heightAt(posts) >= BAR

  /* The swing: an ankle path in the sagittal plane. `x` is toward the nose. */
  const cocked: Vec2 = { x: -30, y: 26 }
  const strike: Vec2 = { x: 20, y: strikeHeight }
  const finish: Vec2 = { x: 26, y: 74 }
  const ankleAt = (fraction: number): Vec2 => {
    const t = clamp(fraction, 0, 1)
    return t <= CONTACT
      ? {
          x: lerp(cocked.x, strike.x, t / CONTACT),
          y: lerp(cocked.y, strike.y, t / CONTACT),
        }
      : {
          x: lerp(strike.x, finish.x, (t - CONTACT) / (1 - CONTACT)),
          y: lerp(strike.y, finish.y, (t - CONTACT) / (1 - CONTACT)),
        }
  }

  const pose = solveSkeleton({
    gait: motion.step > 0 ? "walk" : "stand",
    phase: motion.step,
    stance: 0.94 - motion.swing * 0.06,
    stride: 0.6,
    lift: 0.5,
    lean: 0,
    proportions: P,
  })
  const lean = lerp(6, -16, motion.swing)
  const body = playerUpperBody({
    pelvis: pose.pelvis,
    lean,
    twist: -motion.swing * 18,
    gazePitch: lean + 30 - motion.swing * 34,
    proportions: P,
  })

  // The plant leg is the skeleton's own; the kicking leg is solved to the
  // ankle the swing path asks for.
  const plant = pose.legs.find((leg) => leg.side === "left") ?? pose.legs[0]
  const target = ankleAt(motion.swing)
  const [, swingKnee, swingAnkle] = solveLeg(
    { x: 0, y: pose.pelvis.y },
    target,
    P.femur,
    P.tibia,
  )
  const bootAngle = motion.swing < CONTACT ? -22 : 14
  const boot = footPoints(swingAnkle, bootAngle, P)
  const out = (point: Vec2): Vec3 => ({ x: P.hipSpan, y: point.y, z: -point.x })
  const kickLeg = {
    hip: out({ x: 0, y: pose.pelvis.y }),
    knee: out(swingKnee),
    ankle: out(swingAnkle),
    heel: out(boot.heel),
    ball: out(boot.ball),
    toe: out(boot.toe),
  }

  /* Where the ball is: on the tee until contact, then on the parabola. */
  const struck = motion.swing >= CONTACT
  const contactPoint: Vec3 = { x: 0, y: strikeHeight, z: -strike.x }
  const flown = struck ? ((motion.swing - CONTACT) / (1 - CONTACT)) * 0.13 : 0
  const shot = flight.at(flown)
  const ballAt: Vec3 = struck
    ? { x: 0, y: shot.y * 78, z: contactPoint.z - shot.x * 78 }
    : kick === "punt"
      ? { x: -6, y: body.shoulders.y - 18, z: body.shoulders.z - 20 }
      : contactPoint

  const shoulderAt = (which: "left" | "right"): Vec3 => {
    const sign = which === "right" ? 1 : -1
    return {
      x: body.shoulders.x + body.right.x * sign * P.shoulderSpan,
      y: body.shoulders.y + body.right.y * sign * P.shoulderSpan,
      z: body.shoulders.z + body.right.z * sign * P.shoulderSpan,
    }
  }
  const arms = (["left", "right"] as const).map((which) => {
    const sign = which === "right" ? 1 : -1
    const shoulder = shoulderAt(which)
    // Out for balance through the swing, or holding the ball before a punt.
    const holding = kick === "punt" && !struck
    const wrist: Vec3 = holding
      ? { x: ballAt.x + sign * 8, y: ballAt.y, z: ballAt.z + 2 }
      : {
          x: shoulder.x + sign * (18 + motion.swing * 14),
          y: shoulder.y - 14 + motion.swing * 20,
          z: shoulder.z + 4 - motion.swing * 8,
        }
    return {
      which,
      shoulder,
      wrist,
      elbow: solveElbow3(shoulder, wrist, P.humerus, P.forearm, { x: sign, y: -0.9, z: 0.3 }),
    }
  })

  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, 1)
      setHeld(bounded)
      onSwingChange?.(bounded)
    },
    [onSwingChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(
    ENVELOPE,
    camera,
    VIEW_WIDTH,
    showPlot ? STAGE.height : VIEW_HEIGHT - 26,
    8,
    1.15,
  )
  const place = (point: Vec3): Vec3 => ({ x: point.x, y: point.y, z: point.z + motion.approach })
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
  const onHead = (point: Vec2, at = 0): Vec3 => ({
    x: body.head.x + nose.x * point.x + up.x * point.y + right.x * at,
    y: body.head.y + nose.y * point.x + up.y * point.y + right.y * at,
    z: body.head.z + nose.z * point.x + up.z * point.y + right.z * at,
  })
  const helmetSolid = solid(
    helmetOutline(skull).flatMap((point) => [onHead(point, skull * 0.78), onHead(point, -skull * 0.78)]),
  )
  const bars = facemaskBars(skull, mask)

  const look = viewDirection(camera)
  const ballShape = { long: defaultBall.long * 0.8, waist: defaultBall.waist * 0.8 }
  const ballSpin = struck ? flown * 26 : 0
  const spheroid = ballFrame({
    pitch: struck ? shot.heading : 78,
    yaw: 0,
    roll: ballSpin * 360,
  })
  const ballOutline = ballSilhouette(spheroid, ballShape, look, 26).map((point) =>
    to({ x: ballAt.x + point.x, y: ballAt.y + point.y, z: ballAt.z + point.z }),
  )
  const ballMarks = ballLaces(spheroid, ballShape, look, 5, 14)

  const legPart = (leg: {
    hip: Vec3
    knee: Vec3
    ankle: Vec3
    heel: Vec3
    ball: Vec3
    toe: Vec3
  }, which: string) => (
    <g key={which} data-leg={which} {...(which === "right" ? { "data-kick-leg": "" } : { "data-plant-leg": "" })}>
      <path d={link(leg.hip, leg.knee, 5.8)} {...shell} />
      <path d={link(leg.knee, leg.ankle, 4.4)} {...machined} />
      <path data-pad={`${which}-knee`} d={plateAt(padOutline(4.4, 4), leg.knee)} {...cast} />
      <g data-foot={which}>
        <path d={link(leg.heel, leg.ball, 3.4)} {...shell} />
        <path d={link(leg.ball, leg.toe, 2.4)} {...machined} />
      </g>
    </g>
  )

  const yoke = shoulderYoke(P.shoulderSpan * 1.5, 13).map((point) => {
    const spun = turnY({ x: point.x, y: 0, z: point.y }, body.shoulderYaw)
    return { x: body.shoulders.x + spun.x, y: body.shoulders.z + spun.z }
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
    x: spineMid.x + torsoFront.x * 6,
    y: spineMid.y + torsoFront.y * 6,
    z: spineMid.z + torsoFront.z * 6,
  }
  const ordered = [...arms].sort((a, b) => depthOf(a.shoulder) - depthOf(b.shoulder))
  const kickBehind = depthOf(kickLeg.hip) < depthOf(plant.hip)

  /* The flight plot: field scale, its own panel, and the panel says so. */
  // Wide enough for both the uprights and the whole arc, so nothing on the
  // plot runs off the edge of its own panel.
  const plotSpan = Math.max(posts + 6, flight.range + 4)
  const plotRise = Math.max(flight.apex, BAR + POST) * 1.15
  const onPlot = (yards: number, high: number): Vec2 => ({
    x: PLOT.x + 8 + (yards / plotSpan) * (PLOT.width - 16),
    y: PLOT.y + PLOT.height - 9 - (high / plotRise) * (PLOT.height - 16),
  })
  const arc = flight.path(28).map((point) => onPlot(point.x, point.y))
  const barAt = onPlot(posts, BAR)
  const postTop = onPlot(posts, BAR + POST)
  const ballOnPlot = struck ? onPlot(shot.x, shot.y) : onPlot(0, strikeHeight / 78)
  const readout = Math.round(swung * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Gridiron kicker, ${kick} kick, ${readout} percent through the swing, ${Math.round(flight.range)} yard flight, ${flight.hangTime.toFixed(1)} second hang, ${clears ? "clears" : "misses"} the bar at ${Math.round(posts)} yards, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% through the swing` : undefined}
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
      data-kick={kick}
      {...props}
    >
      <g data-machine transform={`translate(0 ${showPlot ? STAGE.top : 0}) ${frame.transform}`}>
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0, z: 0 }).x)}
            cy={px(to({ x: 0, y: 0, z: 0 }).y)}
            rx={30}
            ry={px(5 + 4 * camera.flatten)}
            fill={palette.dark}
            opacity={0.15}
          />
        )}

        {kickBehind && legPart(kickLeg, "right")}
        <g data-arm={ordered[0].which}>
          <path d={link(ordered[0].shoulder, ordered[0].elbow, 4.6)} {...shell} />
          <path d={link(ordered[0].elbow, ordered[0].wrist, 3.8)} {...machined} />
        </g>

        {legPart(plant, "left")}

        <g data-pelvis>
          <path d={box({ ...pose.pelvis, y: pose.pelvis.y - 4 }, 13, 8, 8, pose.pelvisYaw)} {...shell} />
        </g>

        <g data-spine>
          {body.spine.map((vertebra, index) =>
            index > 0 ? (
              <path key={index} d={link(body.spine[index - 1], vertebra, 6.2)} {...shell} />
            ) : null,
          )}
        </g>

        <g data-pads>
          <path
            data-shoulder-pad="yoke"
            d={extrude(yoke, body.shoulders.y + 6, body.shoulders.y - 8)}
            {...plate}
          />
          <path data-chest d={box(chest, 11, 7, 5, body.shoulderYaw)} {...machined} />
          {number && (
            <text
              x={px(to(chest).x)}
              y={px(to(chest).y + 3)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={10}
              fill={palette.dark}
              opacity={0.85}
            >
              {number.slice(0, 2)}
            </text>
          )}
        </g>

        <g data-helmet>
          <path d={helmetSolid} {...shell} />
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

        <g data-arm={ordered[1].which}>
          <path d={link(ordered[1].shoulder, ordered[1].elbow, 4.6)} {...shell} />
          <path d={link(ordered[1].elbow, ordered[1].wrist, 3.8)} {...machined} />
        </g>

        {!kickBehind && legPart(kickLeg, "right")}

        {/* The tee, which is only there for the kicks that use one. */}
        {style_.hold && !struck && (
          <path
            data-tee
            d={box({ x: 0, y: 2, z: contactPoint.z }, 4, 2, 4)}
            {...cast}
          />
        )}

        <g data-ball data-away={struck ? "" : undefined}>
          <path d={line(ballOutline, true)} {...robotSurface("dark", variant, palette)} />
          {ballMarks.map((stitch, index) =>
            stitch.facing > 0 ? (
              <line
                key={index}
                data-lace={index}
                x1={px(to({ x: ballAt.x + stitch.a.x, y: ballAt.y + stitch.a.y, z: ballAt.z + stitch.a.z }).x)}
                y1={px(to({ x: ballAt.x + stitch.a.x, y: ballAt.y + stitch.a.y, z: ballAt.z + stitch.a.z }).y)}
                x2={px(to({ x: ballAt.x + stitch.b.x, y: ballAt.y + stitch.b.y, z: ballAt.z + stitch.b.z }).x)}
                y2={px(to({ x: ballAt.x + stitch.b.x, y: ballAt.y + stitch.b.y, z: ballAt.z + stitch.b.z }).y)}
                stroke={palette.accent}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            ) : null,
          )}
        </g>
      </g>

      {showPlot && (
        <g data-trajectory>
          <rect
            x={PLOT.x}
            y={PLOT.y}
            width={PLOT.width}
            height={PLOT.height}
            rx={3}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.5}
            opacity={0.5}
          />
          <path
            d={`M ${px(onPlot(0, 0).x)} ${px(onPlot(0, 0).y)} L ${px(onPlot(plotSpan, 0).x)} ${px(onPlot(plotSpan, 0).y)}`}
            stroke={palette.grid}
            strokeWidth={0.6}
            opacity={0.8}
          />
          <g data-uprights stroke={variant === "wire" ? palette.grid : palette.metal} strokeWidth={1.4} fill="none" strokeLinecap="round">
            <path d={`M ${px(barAt.x)} ${px(onPlot(posts, 0).y)} L ${px(postTop.x)} ${px(postTop.y)}`} />
            <path
              d={`M ${px(barAt.x - 7)} ${px(barAt.y)} L ${px(barAt.x + 7)} ${px(barAt.y)}`}
              stroke={clears ? palette.accent : palette.metal}
              strokeWidth={2}
            />
          </g>
          <path
            data-arc
            d={arc.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")}
            fill="none"
            stroke={clears ? palette.accent : palette.dark}
            strokeWidth={1.1}
            strokeDasharray="3 3"
            opacity={0.8}
          />
          <circle
            data-plot-ball
            cx={px(ballOnPlot.x)}
            cy={px(ballOnPlot.y)}
            r={2.2}
            fill={palette.accent}
          />
          <text
            x={PLOT.x + PLOT.width / 2}
            y={PLOT.y + PLOT.height + 7}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={4.5}
            fill={palette.foreground}
            opacity={0.75}
          >
            {`FLIGHT PLOT · ${Math.round(plotSpan)} YD ACROSS · DRAG-FREE`}
          </text>
        </g>
      )}

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={VIEW_HEIGHT - 13} fontSize={5}>
          {`${kick.toUpperCase()} / ${readout}% / ${Math.round(flight.range)} YD / ${flight.hangTime.toFixed(1)} S / ${clears ? "CLEARS" : "SHORT"}`}
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

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

function turnY(point: Vec3, degrees: number): Vec3 {
  const a = ((Number.isFinite(degrees) ? clamp(degrees, -180, 180) : 0) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c }
}

export { GridironKicker }
