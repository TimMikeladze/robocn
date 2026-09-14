"use client"

/**
 * scout-walker — a two-legged reconnaissance walker.
 *
 * The mass is a cab a long way above the hips, and a cab bolted to its hips
 * cannot slide sideways: it rolls. With one foot down the support polygon *is*
 * that foot, so every step is paid for by rolling the whole machine over the
 * leg that is staying put. `solveWalker` works out how much attitude that
 * costs, and this file draws the consequence — head-on, which is the view the
 * rolling is in.
 *
 * Modelled once in world units — x starboard, y up, z toward the nose — with
 * every hull-mounted part going through `walkerHullPoint` so the cab and the
 * solved hips are on the same machine, and the whole thing projected through
 * `robotCamera(view)`.
 *
 * Design note: docs/armoured-walkers.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useEasedPoint } from "@/hooks/use-robot-arm"
import { useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  solveWalker,
  walkerHullPoint,
  type WalkerGait,
  type WalkerLeg,
  type WalkerPose,
} from "@/lib/robocn/walker"
import {
  boxCorners,
  capsulePath,
  fitFrame,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSizes,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** How fast a released hull eases back into the gait, in lean units a second. */
const LEAN_RATE = 2.6

/** The cab, in hull-local units: origin at the hip centre, y up, z toward the nose. */
const CAB = {
  chin: { halfWidth: 22, bottom: 11, top: 22, back: -15, front: 25 },
  core: { halfWidth: 25, bottom: 22, top: 45, back: -20, front: 20 },
  crown: { halfWidth: 18, bottom: 45, top: 49, back: -14, front: 14 },
  pack: { halfWidth: 15, bottom: 25, top: 41, back: -30, front: -20 },
} as const
/** The beam the two hips hang off. */
const YOKE = { halfWidth: 21, bottom: -8, top: 6, halfDepth: 9 } as const
/** Just proud of a face, so a mark sits on the panel rather than inside it. */
const SKIN = 0.4
/** The footplate: a flat pad that stays level with the floor. */
const PLATE = { halfWidth: 7.5, fore: 12, aft: 8, height: 3 } as const

/** The whole box the machine works inside, so no camera crops it. */
const ENVELOPE = boxCorners({ x: -54, y: -2, z: -56 }, { x: 54, y: 112, z: 56 })
const WIDTH = 196
const HEIGHT = 208

/** The roll is the mechanism, and a front elevation is where a roll lives. */
const NATIVE_VIEW: RobotView = "front"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type ScoutWalkerBehavior = "patrol" | "advance" | "watch" | "static"

export type ScoutWalkerGait = Extract<WalkerGait, "stand" | "walk" | "stride">

export interface ScoutWalkerProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Where the camera stands. One walker, four projections. */
  view?: RobotView
  /** What it does when `stride` is not supplied. */
  behavior?: ScoutWalkerBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: ScoutWalkerGait
  /** Controlled gait cycle, 0–1. Supplying it stops the clock. */
  stride?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  phase?: number
  /** Normalized ride height, foot travel and swing clearance, each 0–1. */
  height?: number
  step?: number
  lift?: number
  /**
   * Controlled attitude push, −1..1 of each stop: x rolls it, y pitches it.
   * Supplying it beats the drag, and the gait still runs underneath.
   */
  lean?: Vec2 | null
  onLeanChange?: (lean: Vec2) => void
  /** Press and drag to push the cab off its feet; arrow keys nudge it. */
  interactive?: boolean
  /** Controlled aim in −1..1: x yaws the cab, y tips the chin pods. */
  look?: Vec2 | null
  /** Follow the page pointer while `look` is null. */
  track?: boolean
  /** Draw the support, the loaded feet, and the mass over its plumb line. */
  showSupport?: boolean
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function ScoutWalker({
  view = NATIVE_VIEW,
  behavior = "patrol",
  gait,
  stride,
  speed = 0.5,
  animate = true,
  paused = false,
  phase = 0,
  height,
  step,
  lift = 0.55,
  lean,
  onLeanChange,
  interactive = true,
  look = null,
  track = true,
  showSupport = false,
  size = "md",
  variant = "solid",
  showGround = true,
  signal = "ready",
  label,
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
}: ScoutWalkerProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const controlled = lean !== undefined && lean !== null
  const [held, setHeld] = React.useState<Vec2 | null>(null)

  const pinX = controlled ? finiteClamp(lean.x, -1, 1, 0) : 0
  const pinY = controlled ? finiteClamp(lean.y, -1, 1, 0) : 0
  const pinned = React.useMemo(
    () => (controlled ? { x: pinX, y: pinY } : held),
    [controlled, pinX, pinY, held],
  )
  // A behaviour that does nothing needs no clock, so the target is a point and
  // the loop settles to no renders rather than ticking under a still machine.
  const running = behavior !== "static"
  const goal = React.useCallback((): Vec2 => pinned ?? { x: 0, y: 0 }, [pinned])
  const motion = useEasedPoint(running ? goal : (pinned ?? { x: 0, y: 0 }), { x: 0, y: 0 }, {
    speed: LEAN_RATE,
    animate,
    paused,
    phase,
  })
  const bias: Vec2 = controlled && pinned ? pinned : motion.point

  const apply = React.useCallback(
    (next: Vec2) => {
      const bounded = { x: finiteClamp(next.x, -1, 1, 0), y: finiteClamp(next.y, -1, 1, 0) }
      setHeld(bounded)
      onLeanChange?.(bounded)
    },
    [onLeanChange],
  )
  // The drag works in the drawing rather than in the machine, so a pointer
  // pushed to starboard pushes the cab that way from every camera — including
  // plan view, where starboard is on the other side of the picture.
  const ground = React.useRef({
    camera: robotCamera(view),
    reach: { x: 17, y: 10 },
    frame: { dx: 0, dy: 0, scale: 1 },
  })
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unitPoint: Vec2, rect: DOMRect) => {
        const { camera, reach, frame } = ground.current
        // The drawing is letterboxed inside the element by xMidYMid meet.
        const fit = Math.min(rect.width / WIDTH, rect.height / HEIGHT)
        const box = {
          x: (unitPoint.x * rect.width - (rect.width - WIDTH * fit) / 2) / fit,
          y: (unitPoint.y * rect.height - (rect.height - HEIGHT * fit) / 2) / fit,
        }
        const point = groundPoint(
          camera,
          (box.x - frame.dx) / frame.scale,
          (box.y - frame.dy) / frame.scale,
        )
        apply({ x: point.x / Math.max(1, reach.x), y: point.y / Math.max(1, reach.y) })
      },
      [apply],
    ),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && look === null && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback(
      (unitPoint: Vec2) => ({
        x: clamp((unitPoint.x - 0.5) * 2, -1, 1),
        y: clamp((unitPoint.y - 0.5) * 2, -1, 1),
      }),
      [],
    ),
  })

  const script = scoutBehaviorPose(behavior, motion.clock)
  const cycle = stride !== undefined ? finite(stride, 0) : motion.clock * speed * script.rate
  const pose = solveWalker({
    legs: 2,
    gait: gait ?? script.gait,
    phase: cycle,
    height: height ?? script.height,
    step: step ?? script.step,
    lift,
    lean: bias,
  })

  const aim = look ?? pointer.target ?? script.gaze
  const gaze = { x: finiteClamp(aim.x, -1, 1, 0), y: finiteClamp(aim.y, -1, 1, 0) }
  /** The cab turns on the hips; the chin pods take the rest of the aim. */
  const yaw = gaze.x * 34

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const rendered = resolveRobotSize(size)
  const width = Number.isFinite(rendered) ? rendered : robotSizes.md
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const trim = robotSurface("metal", variant, palette, 0.7)
  // The machine reports itself: off its feet lights the warning colour whatever
  // `signal` was asked for, because that is a fact and not a decoration.
  const alarmed = !pose.stable
  const lampColor =
    alarmed || signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, WIDTH, HEIGHT, 8)
  const reachX = pose.hull * Math.sin((pose.rollLimit * Math.PI) / 180)
  const reachY = pose.hull * Math.sin((pose.pitchLimit * Math.PI) / 180)
  React.useEffect(() => {
    ground.current = { camera, reach: { x: reachX, y: reachY }, frame }
  }, [camera, reachX, reachY, frame])

  /** World axes: x starboard, y up, z toward the nose. */
  const at = (x: number, y: number, z = 0) => camera.project(-x, y, -z)
  const depthOf = (x: number, y: number, z: number) => camera.depth(-x, y, -z)
  const corner = (point: Vec3): Vec3 => ({ x: -point.x, y: point.y, z: -point.z })
  /** A hull point: yawed on the hips, then carried by the hull's attitude. */
  const onHull = (x: number, y: number, z: number): Vec3 => {
    const turn = (yaw * Math.PI) / 180
    return walkerHullPoint(pose, {
      x: x * Math.cos(turn) + z * Math.sin(turn),
      y,
      z: z * Math.cos(turn) - x * Math.sin(turn),
    })
  }
  const hullSolid = (points: readonly Vec3[]) =>
    slabPath(points.map((point) => corner(onHull(point.x, point.y, point.z))), camera)
  /** A rectangular box in hull-local units, drawn as the solid it is. */
  const boxOf = (
    halfWidth: number,
    bottom: number,
    top: number,
    back: number,
    front: number,
  ): Vec3[] =>
    [-halfWidth, halfWidth].flatMap((x) =>
      [bottom, top].flatMap((y) => [back, front].map((z) => ({ x, y, z }))),
    )
  /** A flat mark standing on a face of the cab, which foreshortens like one. */
  const face = (x0: number, x1: number, y0: number, y1: number, z: number): Vec3[] => [
    { x: x0, y: y0, z },
    { x: x1, y: y0, z },
    { x: x1, y: y1, z },
    { x: x0, y: y1, z },
  ]

  /* ---------------------------------------------------------------- legs */

  const legDrawing = (leg: WalkerLeg) => {
    const hip = at(leg.hip.x, leg.hipHeight, leg.hip.y)
    const knee = at(leg.knee.x, leg.kneeHeight, leg.knee.y)
    const ankle = at(leg.foot.x, leg.clearance + PLATE.height, leg.foot.y)
    const plate = [-PLATE.halfWidth, PLATE.halfWidth].flatMap((x) =>
      [leg.clearance, leg.clearance + PLATE.height].flatMap((y) =>
        [-PLATE.aft, PLATE.fore].map((z) =>
          corner({ x: leg.foot.x + x, y, z: leg.foot.y + z }),
        ),
      ),
    )
    return (
      <g key={leg.id} data-leg={leg.id} data-name={leg.name} data-contact-state={String(leg.contact)}>
        <path data-part="femur" d={capsulePath(hip, knee, 6.4)} {...shell} />
        <path data-part="tibia" d={capsulePath(knee, ankle, 5)} {...machined} />
        <circle cx={px(hip.x)} cy={px(hip.y)} r={5.4} {...cast} />
        <circle data-knee cx={px(knee.x)} cy={px(knee.y)} r={4.2} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={1.2} fill={palette.metal} />
        <path data-part="foot" d={slabPath(plate, camera)} {...cast} />
      </g>
    )
  }

  /* ---------------------------------------------------------------- cab */

  const cabNear = Math.max(
    ...boxOf(CAB.core.halfWidth, CAB.chin.bottom, CAB.crown.top, CAB.pack.back, CAB.chin.front).map(
      (point) => {
        const world = onHull(point.x, point.y, point.z)
        return depthOf(world.x, world.y, world.z)
      },
    ),
  )
  const mass = walkerHullPoint(pose, { x: 0, y: pose.hull, z: 0 })
  const massPoint = at(mass.x, mass.y, mass.z)
  const plumb = at(pose.centre.x, 0, pose.centre.y)

  /* ------------------------------------------------------------- readouts */

  const contacts = pose.legs.filter((leg) => leg.contact)
  const attitude = `roll ${Math.round(pose.roll)} degrees, pitch ${Math.round(pose.pitch)} degrees`
  const state = dragging
    ? "held"
    : pose.airborne
      ? "in the air"
      : pose.gait === "stand"
        ? "standing"
        : `walking, ${pose.gait}`
  const balance = pose.airborne ? "airborne" : pose.stable ? "balanced" : "off balance"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Scout walker, ${state}, ${balance}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -100 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round((pose.roll / Math.max(1, pose.rollLimit)) * 100) : undefined}
      aria-valuetext={interactive ? `${attitude}, ${balance}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={width}
      height={px((width * HEIGHT) / WIDTH)}
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
        const nudge = event.shiftKey ? 0.25 : 0.1
        const next = { ...bias }
        switch (event.key) {
          case "ArrowRight": next.x += nudge; break
          case "ArrowLeft": next.x -= nudge; break
          case "ArrowUp": next.y += nudge; break
          case "ArrowDown": next.y -= nudge; break
          case "Home": next.x = 0; next.y = 0; break
          case "End": next.x = 1; break
          default: return
        }
        apply(next)
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      {...props}
    >
      <g data-walker data-view={view} transform={frame.transform || undefined}>
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
            <path
              d={`M ${px(at(-50, 0, 0).x)} ${px(at(-50, 0, 0).y)} L ${px(at(50, 0, 0).x)} ${px(at(50, 0, 0).y)}`}
              strokeDasharray="3 3"
            />
            {/* How far the mass can be moved before the attitude stops bite. */}
            <ellipse
              data-reach
              cx={px(at(0, 0, 0).x)}
              cy={px(at(0, 0, 0).y)}
              rx={px(reachX)}
              ry={px(Math.max(0.8, reachY * camera.flatten + reachX * camera.flatten))}
              strokeDasharray="2 3"
            />
          </g>
        )}

        {showGround && (
          <ellipse
            cx={px(at(0, 0, 0).x)}
            cy={px(at(0, 0, 0).y)}
            rx={38}
            ry={px(Math.max(2.4, 34 * camera.flatten))}
            fill={palette.dark}
            opacity={0.13}
          />
        )}

        {showSupport && contacts.length > 1 && (
          <path
            data-support
            d={contacts
              .map((leg, index) => {
                const point = at(leg.foot.x, 0, leg.foot.y)
                return `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`
              })
              .join(" ")}
            fill="none"
            stroke={pose.stable ? palette.accent : palette.shell}
            strokeWidth={1.1}
            strokeDasharray="4 3"
          />
        )}

        {pose.legs
          .filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) <= cabNear)
          .map(legDrawing)}

        <g data-cab data-yaw={px(yaw)}>
          <path data-part="yoke" d={hullSolid(boxOf(YOKE.halfWidth, YOKE.bottom, YOKE.top, -YOKE.halfDepth, YOKE.halfDepth))} {...cast} />
          <path data-part="pack" d={hullSolid(boxOf(CAB.pack.halfWidth, CAB.pack.bottom, CAB.pack.top, CAB.pack.back, CAB.pack.front))} {...trim} />
          <path data-part="chin" d={hullSolid(boxOf(CAB.chin.halfWidth, CAB.chin.bottom, CAB.chin.top, CAB.chin.back, CAB.chin.front))} {...shell} />
          <path data-part="core" d={hullSolid(boxOf(CAB.core.halfWidth, CAB.core.bottom, CAB.core.top, CAB.core.back, CAB.core.front))} {...shell} />
          <path data-part="crown" d={hullSolid(boxOf(CAB.crown.halfWidth, CAB.crown.bottom, CAB.crown.top, CAB.crown.back, CAB.crown.front))} {...trim} />

          {/* Two blister pods under the chin, which tip with the aim. */}
          {([-1, 1] as const).map((side) => {
            const drop = -gaze.y * 3
            return (
              <path
                key={side}
                data-pod={side === 1 ? "starboard" : "port"}
                d={hullSolid(
                  [5.5, 16.5].flatMap((across) =>
                    [CAB.chin.bottom - 7 + drop, CAB.chin.bottom + 1 + drop].flatMap((y) =>
                      [CAB.chin.front - 9, CAB.chin.front + 4].map((z) => ({
                        x: side * across,
                        y,
                        z,
                      })),
                    ),
                  ),
                )}
                {...machined}
              />
            )
          })}

          {/* Flat marks on the cab's own faces: they foreshorten, as marks do. */}
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              data-part="viewport"
              d={hullSolid(
                face(side * 4, side * 19, CAB.core.bottom + 8, CAB.core.bottom + 17, CAB.core.front + SKIN),
              )}
              fill={palette.dark}
              stroke="none"
            />
          ))}
          <path
            data-lamp
            d={hullSolid(face(-4.5, 4.5, CAB.core.top - 6, CAB.core.top - 2, CAB.core.front + SKIN))}
            fill={lampColor}
            stroke="none"
          />
          {[0, 6].map((row) => (
            <path
              key={row}
              data-part="louvre"
              d={hullSolid(
                [-1, 1].flatMap((sx) =>
                  [CAB.core.bottom + 4 + row, CAB.core.bottom + 7 + row].flatMap((y) =>
                    [-7, 7].map((z) => ({ x: sx * (CAB.core.halfWidth + SKIN), y, z })),
                  ),
                ),
              )}
              {...cast}
            />
          ))}
          {/* A whip aerial: the one part that reads from directly above. */}
          <path
            data-part="aerial"
            d={capsulePath(
              (() => {
                const base = onHull(8, CAB.crown.top, -9)
                return at(base.x, base.y, base.z)
              })(),
              (() => {
                const tip = onHull(8, CAB.crown.top + 19, -13)
                return at(tip.x, tip.y, tip.z)
              })(),
              1.1,
            )}
            {...machined}
          />
        </g>

        {pose.legs
          .filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) > cabNear)
          .map(legDrawing)}

        {showSupport && (
          <g>
            {contacts.map((leg) => {
              const point = at(leg.foot.x, 0, leg.foot.y)
              return (
                <circle
                  key={leg.id}
                  data-contact={leg.name}
                  cx={px(point.x)}
                  cy={px(point.y)}
                  r={px(2.6 + leg.load * 6)}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={1.1}
                />
              )
            })}
            {/* The mass, and the plumb line that says where it falls. */}
            <g data-centre data-stable={String(pose.stable)}>
              <path
                d={`M ${px(massPoint.x)} ${px(massPoint.y)} L ${px(plumb.x)} ${px(plumb.y)}`}
                stroke={pose.stable ? palette.accent : palette.shell}
                strokeWidth={0.9}
                strokeDasharray="2 2"
                fill="none"
              />
              <circle
                cx={px(massPoint.x)}
                cy={px(massPoint.y)}
                r={3}
                fill={pose.stable ? palette.accent : palette.shell}
              />
              <circle
                cx={px(plumb.x)}
                cy={px(plumb.y)}
                r={2}
                fill="none"
                stroke={pose.stable ? palette.accent : palette.shell}
                strokeWidth={1}
              />
            </g>
          </g>
        )}
      </g>

      {label && (
        <text
          x={WIDTH / 2}
          y={HEIGHT - 7}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

/**
 * Where a point in the drawing lands on the floor, in plan coordinates.
 *
 * The ground plane projects affinely, so the two basis vectors the camera makes
 * of it invert exactly — no trigonometry, and no chance of disagreeing with the
 * projection it has to be the inverse of.
 */
function groundPoint(camera: ReturnType<typeof robotCamera>, x: number, y: number): Vec2 {
  const origin = camera.project(0, 0, 0)
  const across = camera.project(-1, 0, 0)
  const along = camera.project(0, 0, -1)
  const e1 = { x: across.x - origin.x, y: across.y - origin.y }
  const e2 = { x: along.x - origin.x, y: along.y - origin.y }
  const det = e1.x * e2.y - e1.y * e2.x
  if (Math.abs(det) < 1e-9) return { x: 0, y: 0 }
  return {
    x: (x * e2.y - y * e2.x) / det,
    y: (-x * e1.y + y * e1.x) / det,
  }
}

const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/**
 * What it does with no timeline on it. Every behaviour is a pure function of
 * the clock, so the cycle can be sampled in a test without faking frames.
 */
export function scoutBehaviorPose(behavior: ScoutWalkerBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Head down and quick, on a gait with a flight phase it cannot hold.
    case "advance":
      return {
        gait: "stride" as ScoutWalkerGait,
        rate: 1.9,
        height: 0.3,
        step: 1,
        gaze: { x: 0.1 * Math.sin(time * 0.7), y: -0.4 },
      }
    // Parked, scanning, breathing on its legs.
    case "watch":
      return {
        gait: "stand" as ScoutWalkerGait,
        rate: 0,
        height: 0.55 + 0.1 * Math.sin(time * 1.05),
        step: 0.7,
        gaze: { x: 0.85 * Math.sin(time * 0.42), y: 0.25 * Math.sin(time * 0.27) },
      }
    case "static":
      return {
        gait: "stand" as ScoutWalkerGait,
        rate: 0,
        height: 0.5,
        step: 0.7,
        gaze: { x: 0, y: 0 },
      }
    // Pacing a line, looking around as it goes.
    default:
      return {
        gait: "walk" as ScoutWalkerGait,
        rate: 1,
        height: 0.55,
        step: 0.78,
        gaze: { x: 0.55 * Math.sin(time * 0.33), y: 0.2 * Math.cos(time * 0.21) },
      }
  }
}

export { ScoutWalker }
export type { WalkerPose as ScoutWalkerPose }
