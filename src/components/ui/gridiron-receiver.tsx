"use client"

/**
 * gridiron-receiver — the machine whose pose comes from a path.
 *
 * A route is a polyline in yards, and the runner is a point at an arc length
 * along it. Everything the body does follows from `sampleRoute`: the heading
 * turns the whole machine, the break — the exterior angle at the nearest
 * corner, faded in over the couple of yards either side of it — is the lean,
 * and the distance run is the gait phase. Nobody typed a lean, and changing
 * the route changes the pose without touching the drawing.
 *
 * Two registers, and they are different scales on purpose. The machine is
 * drawn at machine scale, because that is where the lean and the stride are
 * legible; the route sits beside it at field scale as a **map**, with a marker
 * where the machine is on it and the break called out. A twelve-yard route is
 * six machine-heights long, so one scale would make one of the two invisible.
 *
 * Everything below the shoulders is `solveSkeleton` from `skeleton-kinematics`.
 * No defenders, no coverage, no ball in the air unless `catch` puts one there.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import {
  ballFrame,
  ballSilhouette,
  defaultBall,
  facemaskBars,
  helmetEar,
  helmetOutline,
  padOutline,
  playerUpperBody,
  routeLength,
  routePath,
  sampleRoute,
  shoulderYoke,
  type FacemaskStyle,
  type RouteName,
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

export type ReceiverBehavior = "route" | "release" | "catch" | "idle" | "static"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 216
const NATIVE_VIEW: RobotView = "profile"
const P = defaultProportions
const ENVELOPE = boxCorners({ x: -44, y: 0, z: -46 }, { x: 44, y: 178, z: 46 })
/** The route map, in viewBox units. */
const MAP = { x: 8, y: 12, width: 58, height: 130 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

export interface ReceiverRun {
  /** Yards travelled along the route. */
  along: number
  /** How far the hands are up for the ball, 0 to 1. */
  reach: number
}

/**
 * Where along the route the machine is at clock time `t`, as a pure function
 * of the clock. `release` is the first few yards worked back and forth, which
 * is what a machine getting off the line is doing.
 */
export function receiverRun(
  behavior: ReceiverBehavior,
  t: number,
  total: number,
): ReceiverRun {
  const cycle = wrap(t)
  const run = Math.max(1, Number.isFinite(total) ? total : 20)
  switch (behavior) {
    case "route":
      return { along: cycle * run, reach: 0 }
    case "release":
      // Two yards of shuffle, never off the line.
      return { along: 1.2 + Math.sin(2 * Math.PI * cycle) * 1.1, reach: 0 }
    case "catch":
      // Run it, then put the hands up over the last fifth.
      return {
        along: Math.min(1, cycle * 1.25) * run,
        reach: cycle < 0.8 ? 0 : Math.sin(Math.PI * ((cycle - 0.8) / 0.2)),
      }
    case "idle":
      return { along: 0, reach: 0 }
    default:
      return { along: 0, reach: 0 }
  }
}

const viewDirection = (camera: RobotCamera): Vec3 => ({
  x: camera.depth(1, 0, 0),
  y: camera.depth(0, 1, 0),
  z: camera.depth(0, 0, 1),
})

export interface GridironReceiverProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  route?: RouteName
  /** How deep the break is, in yards. */
  depth?: number
  /** `1` aligned right, `-1` mirrors the whole route. */
  side?: number
  /** Controlled yards run along the route. Supplying it stops the loop. */
  distance?: number
  /** What the machine does when `distance` is not supplied. */
  behavior?: ReceiverBehavior
  mask?: FacemaskStyle
  number?: string
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Draw the route map beside the machine. */
  showRoute?: boolean
  showGround?: boolean
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  offset?: number
  /** Drag across to run the route by hand. */
  interactive?: boolean
  onDistanceChange?: (yards: number) => void
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function GridironReceiver({
  route = "post",
  depth = 12,
  side = 1,
  distance,
  behavior = "route",
  mask = "cage",
  number = "",
  view = NATIVE_VIEW,
  showRoute = true,
  showGround = true,
  speed = 0.28,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onDistanceChange,
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
}: GridironReceiverProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const path = routePath(route, { depth, side })
  const total = routeLength(path)

  const controlled = distance !== undefined
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && held === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const running = receiverRun(behavior, clock * speed, total)
  const along = controlled
    ? (Number.isFinite(distance) ? clamp(distance!, 0, total) : 0)
    : (held ?? running.along)
  const reach = controlled || held !== null ? 0 : running.reach
  const sample = sampleRoute(path, along)

  const pose = solveSkeleton({
    gait: behavior === "idle" || behavior === "static" ? "stand" : "run",
    // A stride is about two yards, so the gait phase comes off the distance
    // run rather than off a second clock that could drift away from it.
    phase: along / 2.2,
    stance: 0.92,
    stride: 0.9 - sample.breaking * 0.35,
    lift: 0.8,
    lean: 0,
    proportions: P,
  })
  // Cutting is a lean into the turn, and the turn is the route's own geometry.
  const bank = -sample.turn * 26
  const lean = 14 - sample.breaking * 10
  const body = playerUpperBody({
    pelvis: pose.pelvis,
    lean,
    twist: sample.turn * 22,
    gazePitch: lean + (reach > 0 ? 20 : 4),
    gazeYaw: sample.turn * 30,
    proportions: P,
  })

  const shoulderAt = (which: "left" | "right"): Vec3 => {
    const sign = which === "right" ? 1 : -1
    return {
      x: body.shoulders.x + body.right.x * sign * P.shoulderSpan,
      y: body.shoulders.y + body.right.y * sign * P.shoulderSpan,
      z: body.shoulders.z + body.right.z * sign * P.shoulderSpan,
    }
  }
  // Hands: pumping with the stride, or up in front of the facemask for a ball.
  const catchPoint: Vec3 = {
    x: 0,
    y: body.shoulders.y + 26,
    z: body.shoulders.z - 26,
  }
  const arms = (["left", "right"] as const).map((which) => {
    const sign = which === "right" ? 1 : -1
    const shoulder = shoulderAt(which)
    const swing = Math.sin(2 * Math.PI * (along / 2.2) + (which === "right" ? 0 : Math.PI))
    const pump: Vec3 = {
      x: shoulder.x + sign * 4,
      y: shoulder.y - 26 + swing * 10,
      z: shoulder.z - 18 - swing * 18,
    }
    const wrist: Vec3 = {
      x: lerp(pump.x, catchPoint.x + sign * 7, reach),
      y: lerp(pump.y, catchPoint.y, reach),
      z: lerp(pump.z, catchPoint.z, reach),
    }
    return {
      which,
      shoulder,
      wrist,
      elbow: solveElbow3(shoulder, wrist, P.humerus, P.forearm, { x: sign, y: -0.9, z: 0.3 }),
    }
  })

  // The route's own length is the bound, and it is recomputed from the props
  // inside the handlers rather than closed over: React Compiler will not keep
  // a manual memo whose dependency was derived in the render body.
  const runLength = React.useCallback(
    () => routeLength(routePath(route, { depth, side })),
    [route, depth, side],
  )
  const apply = React.useCallback(
    (next: number) => {
      const bounded = clamp(next, 0, runLength())
      setHeld(bounded)
      onDistanceChange?.(bounded)
    },
    [onDistanceChange, runLength],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x * runLength()), [apply, runLength]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  /* ---------------------------------------------------------------------- */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, VIEW_WIDTH - (showRoute ? MAP.width + 12 : 0), VIEW_HEIGHT - 26, 10, 1)
  const offsetX = showRoute ? MAP.width + 12 : 0
  // The machine turns with the route's heading and banks into the break, both
  // about its own base, so the whole body carries the cut.
  const turned = (point: Vec3): Vec3 => {
    const rolled = turnZ(point, bank)
    return turnY(rolled, sample.heading)
  }
  const to = (point: Vec3): Vec2 => {
    const at = turned(point)
    const screen = camera.project(at.x, at.y, at.z)
    return { x: screen.x, y: screen.y }
  }
  const depthOf = (point: Vec3) => {
    const at = turned(point)
    return camera.depth(at.x, at.y, at.z)
  }
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)
  const solid = (corners: readonly Vec3[]) => slabPath(corners.map(turned), camera)
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
  const ear = onHead(helmetEar(skull), skull * 0.79)

  const look = viewDirection(camera)
  const ballShape = { long: defaultBall.long * 0.8, waist: defaultBall.waist * 0.8 }
  const ballOutline =
    reach > 0.25
      ? ballSilhouette(ballFrame({ pitch: -12, yaw: 20, roll: 40 }), ballShape, look, 24).map(
          (point) =>
            to({ x: catchPoint.x + point.x, y: catchPoint.y + point.y, z: catchPoint.z + point.z }),
        )
      : null

  const legPart = (leg: SkeletonLeg) => (
    <g key={`leg-${leg.side}`} data-leg={leg.side}>
      <path d={link(leg.hip, leg.knee, 5.6)} {...shell} />
      <path d={link(leg.knee, leg.ankle, 4.2)} {...machined} />
      <path data-pad={`${leg.side}-knee`} d={plateAt(padOutline(4.2, 3.8), leg.knee)} {...cast} />
      <g data-foot={leg.side}>
        <path d={link(leg.heel, leg.ball, 3.2)} {...shell} />
        <path d={link(leg.ball, leg.toe, 2.2)} {...machined} />
      </g>
    </g>
  )

  const armPart = (arm: (typeof arms)[number]) => (
    <g key={`arm-${arm.which}`} data-arm={arm.which}>
      <path d={link(arm.shoulder, arm.elbow, 4.6)} {...shell} />
      <path d={link(arm.elbow, arm.wrist, 3.8)} {...machined} />
      <circle cx={px(to(arm.elbow).x)} cy={px(to(arm.elbow).y)} r={3} {...cast} />
      <path data-hand={arm.which} d={box(arm.wrist, 3, 3, 3.8)} {...cast} />
    </g>
  )

  const legs = [...pose.legs].sort((a, b) => depthOf(a.hip) - depthOf(b.hip))
  const ordered = [...arms].sort((a, b) => depthOf(a.shoulder) - depthOf(b.shoulder))
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

  /* The route map: field scale, its own panel, and it says so. */
  const bounds = path.reduce(
    (box2, point) => ({
      minX: Math.min(box2.minX, point.x),
      maxX: Math.max(box2.maxX, point.x),
      minY: Math.min(box2.minY, point.y),
      maxY: Math.max(box2.maxY, point.y),
    }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 },
  )
  const mapScale = Math.min(
    (MAP.width - 12) / Math.max(1, bounds.maxX - bounds.minX),
    (MAP.height - 20) / Math.max(1, bounds.maxY - bounds.minY),
  )
  const onMap = (point: Vec2): Vec2 => ({
    x: MAP.x + MAP.width / 2 + (point.x - (bounds.minX + bounds.maxX) / 2) * mapScale,
    y: MAP.y + MAP.height - 8 - (point.y - bounds.minY) * mapScale,
  })
  const marker = onMap(sample.point)
  const readout = Math.round(along * 10) / 10

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Gridiron receiver running a ${route} route, ${readout} of ${Math.round(total)} yards in, ${sample.breaking > 0.15 ? "cutting" : "running straight"}, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? Math.round(total) : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} yards into the ${route}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (event.key === "ArrowRight" || event.key === "ArrowUp") apply(along + 0.8)
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") apply(along - 0.8)
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
      data-route={route}
      {...props}
    >
      {showRoute && (
        <g data-route-map>
          <rect
            x={MAP.x}
            y={MAP.y}
            width={MAP.width}
            height={MAP.height}
            rx={3}
            fill="none"
            stroke={palette.grid}
            strokeWidth={0.5}
            opacity={0.5}
          />
          {/* The line of scrimmage, and a yard grid to read depth off. */}
          {Array.from({ length: 6 }, (_, index) => {
            const y = onMap({ x: 0, y: bounds.minY + (index * (bounds.maxY - bounds.minY)) / 5 }).y
            return (
              <path
                key={index}
                d={`M ${px(MAP.x + 3)} ${px(y)} L ${px(MAP.x + MAP.width - 3)} ${px(y)}`}
                stroke={palette.grid}
                strokeWidth={0.4}
                opacity={index === 0 ? 0.85 : 0.28}
              />
            )
          })}
          <path
            data-route-line
            d={line(path.map(onMap))}
            fill="none"
            stroke={palette.metal}
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {path.slice(1, -1).map((corner, index) => {
            const at = onMap(corner)
            return (
              <circle
                key={index}
                data-break={index}
                cx={px(at.x)}
                cy={px(at.y)}
                r={1.8}
                fill={palette.dark}
              />
            )
          })}
          <circle
            data-marker
            cx={px(marker.x)}
            cy={px(marker.y)}
            r={px(2.4 + sample.breaking * 1.8)}
            fill={palette.accent}
          />
          <text
            x={MAP.x + MAP.width / 2}
            y={MAP.y + MAP.height + 7}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={4.5}
            fill={palette.foreground}
            opacity={0.75}
          >
            {`${route.toUpperCase()} · ${Math.round(depth)} YD · MAP`}
          </text>
        </g>
      )}

      <g
        data-machine
        data-runner
        transform={`translate(${px(offsetX)} 0) ${frame.transform}`}
      >
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0, z: 0 }).x)}
            cy={px(to({ x: 0, y: 0, z: 0 }).y)}
            rx={30}
            ry={px(5 + 4 * camera.flatten)}
            fill={palette.dark}
            opacity={px(pose.grounded ? 0.15 : 0.06)}
          />
        )}

        {legPart(legs[0])}
        {armPart(ordered[0])}

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
          <circle cx={px(to(ear).x)} cy={px(to(ear).y)} r={2.5} fill={palette.dark} opacity={0.6} />
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

        {ballOutline && (
          <path data-catch d={line(ballOutline, true)} {...robotSurface("dark", variant, palette)} />
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={px(offsetX + (VIEW_WIDTH - offsetX) / 2)} y={VIEW_HEIGHT - 14} fontSize={5}>
          {`${readout} / ${Math.round(total)} YD · ${Math.round(sample.heading)}° · ${sample.breaking > 0.15 ? "BREAK" : "STEM"}`}
        </text>
        {label && (
          <text x={px(offsetX + (VIEW_WIDTH - offsetX) / 2)} y={VIEW_HEIGHT - 5} fontSize={4.5}>
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

const angle = (degrees: number) =>
  ((Number.isFinite(degrees) ? degrees : 0) * Math.PI) / 180

function turnY(point: Vec3, degrees: number): Vec3 {
  const a = angle(clamp(Number.isFinite(degrees) ? degrees : 0, -180, 180))
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c }
}

/** Bank about the fore-aft axis: the lean into a cut. */
function turnZ(point: Vec3, degrees: number): Vec3 {
  const a = angle(clamp(Number.isFinite(degrees) ? degrees : 0, -60, 60))
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c, z: point.z }
}

export { GridironReceiver }
