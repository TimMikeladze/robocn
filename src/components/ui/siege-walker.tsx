"use client"

/**
 * siege-walker — a four-legged armoured transport walker.
 *
 * The same machine as the scout, one axis wider. `solveWalker` gives both of
 * them their attitude from the same relation — the mass is a hull above the
 * hips, and moving it costs roll — but four feet at the corners of a long
 * rectangle almost always contain the mass already, so this one walks nearly
 * level while the two-legged one heaves over every step. Ask it to `pace`,
 * swinging both legs of a side together, and the rectangle collapses to a line
 * down one flank that a hull this shape cannot roll far enough to reach: it
 * says so, and the lamp turns.
 *
 * Modelled once in world units — x starboard, y up, z toward the nose — with
 * every hull-mounted part going through `walkerHullPoint`, and projected
 * through `robotCamera(view)`. Side elevation is the view a long hull is in.
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
const LEAN_RATE = 2

/** The hull, in hull-local units: origin at the hip centre, y up, z toward the nose. */
const HULL = {
  belly: { halfWidth: 22, bottom: -2, top: 9, back: -46, front: 40 },
  body: { halfWidth: 26, bottom: 9, top: 40, back: -52, front: 46 },
  deck: { halfWidth: 20, bottom: 40, top: 47, back: -42, front: 30 },
  stack: { halfWidth: 9, bottom: 47, top: 56, back: -36, front: -22 },
} as const
/**
 * The neck: where it leaves the hull, how long, how far it may swing, and the
 * droop it hangs at — the head rides below the hull's nose rather than in front
 * of it, which is what stops a transport walker reading as an arm on a box.
 */
const NECK = { base: { y: 30, z: 44 }, length: 23, droop: 34, yaw: 30, pitch: 20, links: 3 } as const
const HEAD = { halfWidth: 13, halfHeight: 11, halfDepth: 15 } as const
/** Just proud of a face, so a mark sits on the panel rather than inside it. */
const SKIN = 0.4
const PLATE = { halfWidth: 8, fore: 11, aft: 9, height: 3.5 } as const

/** The whole box the machine works inside, so no camera crops it. */
const ENVELOPE = boxCorners({ x: -46, y: -2, z: -78, }, { x: 46, y: 132, z: 108 })
const WIDTH = 232
const HEIGHT = 186

/** A long hull is a side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type SiegeWalkerBehavior = "march" | "haul" | "pace" | "halt" | "static"

export type SiegeWalkerGait = Extract<WalkerGait, "stand" | "walk" | "creep" | "pace">

export interface SiegeWalkerProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Where the camera stands. One walker, four projections. */
  view?: RobotView
  /** What it does when `stride` is not supplied. */
  behavior?: SiegeWalkerBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: SiegeWalkerGait
  /** Controlled gait cycle, 0–1. Supplying it stops the clock. */
  stride?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a column of them breaks step. */
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
  /** Press and drag to push the hull off its feet; arrow keys nudge it. */
  interactive?: boolean
  /** Controlled aim in −1..1: x yaws the head, y raises and lowers it. */
  look?: Vec2 | null
  /** Follow the page pointer while `look` is null. */
  track?: boolean
  /** Draw the support polygon, the loaded feet, and the mass on its plumb line. */
  showSupport?: boolean
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function SiegeWalker({
  view = NATIVE_VIEW,
  behavior = "march",
  gait,
  stride,
  speed = 0.32,
  animate = true,
  paused = false,
  phase = 0,
  height,
  step,
  lift = 0.5,
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
}: SiegeWalkerProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const controlled = lean !== undefined && lean !== null
  const [held, setHeld] = React.useState<Vec2 | null>(null)

  const pinX = controlled ? finiteClamp(lean.x, -1, 1, 0) : 0
  const pinY = controlled ? finiteClamp(lean.y, -1, 1, 0) : 0
  const pinned = React.useMemo(
    () => (controlled ? { x: pinX, y: pinY } : held),
    [controlled, pinX, pinY, held],
  )
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
  // pushed to starboard pushes the hull that way from every camera.
  const ground = React.useRef({
    camera: robotCamera(view),
    reach: { x: 7, y: 6 },
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

  const script = siegeBehaviorPose(behavior, motion.clock)
  const cycle = stride !== undefined ? finite(stride, 0) : motion.clock * speed * script.rate
  const pose = solveWalker({
    legs: 4,
    gait: gait ?? script.gait,
    phase: cycle,
    height: height ?? script.height,
    step: step ?? script.step,
    lift,
    lean: bias,
  })

  const aim = look ?? pointer.target ?? script.gaze
  const gaze = { x: finiteClamp(aim.x, -1, 1, 0), y: finiteClamp(aim.y, -1, 1, 0) }
  const headYaw = gaze.x * NECK.yaw
  const headPitch = -gaze.y * NECK.pitch

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const rendered = resolveRobotSize(size)
  const width = Number.isFinite(rendered) ? rendered : robotSizes.md
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const trim = robotSurface("metal", variant, palette, 0.7)
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
  const onHull = (x: number, y: number, z: number) => walkerHullPoint(pose, { x, y, z })
  const hullSolid = (points: readonly Vec3[]) =>
    slabPath(points.map((point) => corner(onHull(point.x, point.y, point.z))), camera)
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
  const face = (x0: number, x1: number, y0: number, y1: number, z: number): Vec3[] => [
    { x: x0, y: y0, z },
    { x: x1, y: y0, z },
    { x: x1, y: y1, z },
    { x: x0, y: y1, z },
  ]
  /** A flat mark standing on a flank, which is all a front elevation sees. */
  const flank = (side: 1 | -1, z0: number, z1: number, y0: number, y1: number): Vec3[] => {
    const x = side * (HULL.body.halfWidth + SKIN)
    return [
      { x, y: y0, z: z0 },
      { x, y: y0, z: z1 },
      { x, y: y1, z: z1 },
      { x, y: y1, z: z0 },
    ]
  }

  /* ---------------------------------------------------------------- neck */

  const yawRad = (headYaw * Math.PI) / 180
  // The neck hangs at its droop, and the aim swings from there.
  const pitchRad = ((headPitch - NECK.droop) * Math.PI) / 180
  /** A point of the head, in the head's own frame, put back on the hull. */
  const onHead = (x: number, y: number, z: number) => {
    // The head is carried on the end of the neck, and the neck is a direction:
    // yaw about the vertical, then pitch in the plane that yaw left it in.
    // `NECK.length` runs to the middle of the head, not to its face.
    const reach = NECK.length
    const tip = {
      x: Math.sin(yawRad) * Math.cos(pitchRad) * reach,
      y: NECK.base.y + Math.sin(pitchRad) * reach,
      z: NECK.base.z + Math.cos(yawRad) * Math.cos(pitchRad) * reach,
    }
    return onHull(
      tip.x + x * Math.cos(yawRad) + z * Math.sin(yawRad),
      tip.y + y,
      tip.z + z * Math.cos(yawRad) - x * Math.sin(yawRad),
    )
  }
  const headSolid = (points: readonly Vec3[]) =>
    slabPath(points.map((point) => corner(onHead(point.x, point.y, point.z))), camera)
  const neckJoints = Array.from({ length: NECK.links + 1 }, (_, index) => {
    const t = index / NECK.links
    const reach = NECK.length * t
    const local = {
      x: Math.sin(yawRad) * Math.cos(pitchRad) * reach,
      y: NECK.base.y + Math.sin(pitchRad) * reach,
      z: NECK.base.z + Math.cos(yawRad) * Math.cos(pitchRad) * reach,
    }
    const world = onHull(local.x, local.y, local.z)
    return at(world.x, world.y, world.z)
  })

  /* ---------------------------------------------------------------- legs */

  const legDrawing = (leg: WalkerLeg) => {
    const hip = at(leg.hip.x, leg.hipHeight, leg.hip.y)
    const knee = at(leg.knee.x, leg.kneeHeight, leg.knee.y)
    const ankle = at(leg.foot.x, leg.clearance + PLATE.height, leg.foot.y)
    const plate = [-PLATE.halfWidth, PLATE.halfWidth].flatMap((x) =>
      [leg.clearance, leg.clearance + PLATE.height].flatMap((y) =>
        [-PLATE.aft, PLATE.fore].map((z) => corner({ x: leg.foot.x + x, y, z: leg.foot.y + z })),
      ),
    )
    return (
      <g key={leg.id} data-leg={leg.id} data-name={leg.name} data-contact-state={String(leg.contact)}>
        <path data-part="femur" d={capsulePath(hip, knee, 7)} {...shell} />
        <path data-part="tibia" d={capsulePath(knee, ankle, 5.4)} {...machined} />
        <circle cx={px(hip.x)} cy={px(hip.y)} r={6} {...cast} />
        <circle data-knee cx={px(knee.x)} cy={px(knee.y)} r={4.4} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={1.3} fill={palette.metal} />
        <path data-part="foot" d={slabPath(plate, camera)} {...cast} />
      </g>
    )
  }

  const hullNear = Math.max(
    ...boxOf(HULL.body.halfWidth, HULL.belly.bottom, HULL.deck.top, HULL.body.back, HULL.body.front).map(
      (point) => {
        const world = onHull(point.x, point.y, point.z)
        return depthOf(world.x, world.y, world.z)
      },
    ),
  )
  const mass = onHull(0, pose.hull, 0)
  const massPoint = at(mass.x, mass.y, mass.z)
  const plumb = at(pose.centre.x, 0, pose.centre.y)

  /* ------------------------------------------------------------- readouts */

  const contacts = pose.legs.filter((leg) => leg.contact)
  const attitude = `roll ${Math.round(pose.roll)} degrees, pitch ${Math.round(pose.pitch)} degrees`
  const state = dragging
    ? "held"
    : pose.gait === "stand"
      ? "standing"
      : `walking, ${pose.gait}`
  const balance = pose.stable ? "balanced" : "off balance"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Siege walker, ${state}, ${balance}, ${viewNames[view] ?? viewNames.profile}`}
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
              d={`M ${px(at(0, 0, -74).x)} ${px(at(0, 0, -74).y)} L ${px(at(0, 0, 74).x)} ${px(at(0, 0, 74).y)}`}
              strokeDasharray="3 3"
            />
            <ellipse
              data-reach
              cx={px(at(0, 0, 0).x)}
              cy={px(at(0, 0, 0).y)}
              rx={px(Math.max(reachX, reachY))}
              ry={px(Math.max(0.8, Math.max(reachX, reachY) * camera.flatten))}
              strokeDasharray="2 3"
            />
          </g>
        )}

        {showGround && (
          <ellipse
            cx={px(at(0, 0, 0).x)}
            cy={px(at(0, 0, 0).y)}
            rx={62}
            ry={px(Math.max(2.6, 52 * camera.flatten))}
            fill={palette.dark}
            opacity={0.13}
          />
        )}

        {showSupport && contacts.length > 1 && (
          <path
            data-support
            d={`${contacts
              .map((leg, index) => {
                const point = at(leg.foot.x, 0, leg.foot.y)
                return `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`
              })
              .join(" ")}${contacts.length > 2 ? " Z" : ""}`}
            fill="none"
            stroke={pose.stable ? palette.accent : palette.shell}
            strokeWidth={1.1}
            strokeDasharray="4 3"
          />
        )}

        {pose.legs.filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) <= hullNear).map(legDrawing)}

        <g data-hull>
          <path data-part="belly" d={hullSolid(boxOf(HULL.belly.halfWidth, HULL.belly.bottom, HULL.belly.top, HULL.belly.back, HULL.belly.front))} {...cast} />
          <path data-part="body" d={hullSolid(boxOf(HULL.body.halfWidth, HULL.body.bottom, HULL.body.top, HULL.body.back, HULL.body.front))} {...shell} />
          <path data-part="deck" d={hullSolid(boxOf(HULL.deck.halfWidth, HULL.deck.bottom, HULL.deck.top, HULL.deck.back, HULL.deck.front))} {...trim} />
          <path data-part="stack" d={hullSolid(boxOf(HULL.stack.halfWidth, HULL.stack.bottom, HULL.stack.top, HULL.stack.back, HULL.stack.front))} {...machined} />

          {/* Flank plating: flat marks on the hull's own sides. */}
          {([-1, 1] as const).map((side) => (
            <React.Fragment key={side}>
              {/* An armour band along the flank, and the ribs that break it up. */}
              <path
                data-part="band"
                d={hullSolid(flank(side, HULL.body.back + 6, HULL.body.front - 6, HULL.body.bottom + 3, HULL.body.bottom + 11))}
                {...cast}
              />
              {[-40, -26, -12, 2, 16, 30].map((z) => (
                <path
                  key={z}
                  data-part="plating"
                  d={hullSolid(flank(side, z, z + 7, HULL.body.bottom + 13, HULL.body.top - 4))}
                  {...trim}
                />
              ))}
            </React.Fragment>
          ))}
          {/* A hatch on the roof, which is what plan view has to show. */}
          <path
            data-part="hatch"
            d={hullSolid([
              { x: -12, y: HULL.deck.top + SKIN, z: -16 },
              { x: 12, y: HULL.deck.top + SKIN, z: -16 },
              { x: 12, y: HULL.deck.top + SKIN, z: 14 },
              { x: -12, y: HULL.deck.top + SKIN, z: 14 },
            ])}
            {...cast}
          />
          <path
            data-lamp
            d={hullSolid(face(-5, 5, HULL.body.top - 10, HULL.body.top - 5, HULL.body.front + SKIN))}
            fill={lampColor}
            stroke="none"
          />
        </g>

        <g data-neck>
          {neckJoints.slice(0, -1).map((joint, index) => (
            <path
              key={index}
              data-part="vertebra"
              d={capsulePath(joint, neckJoints[index + 1], 5.6 - index * 0.7)}
              {...machined}
            />
          ))}
        </g>

        <g data-head data-yaw={px(headYaw)}>
          <path
            data-part="skull"
            d={headSolid(
              [-HEAD.halfWidth, HEAD.halfWidth].flatMap((x) =>
                [-HEAD.halfHeight, HEAD.halfHeight].flatMap((y) =>
                  [-HEAD.halfDepth, HEAD.halfDepth].map((z) => ({ x, y, z })),
                ),
              ),
            )}
            {...shell}
          />
          {/* A chin pod under the head, and two slot optics on its face. */}
          <path
            data-part="pod"
            d={headSolid(
              [-7, 7].flatMap((x) =>
                [-HEAD.halfHeight - 6, -HEAD.halfHeight + 1].flatMap((y) =>
                  [-2, HEAD.halfDepth + 3].map((z) => ({ x, y, z })),
                ),
              ),
            )}
            {...machined}
          />
          {([-1, 1] as const).map((side) => (
            <path
              key={side}
              data-optic={side === 1 ? "starboard" : "port"}
              d={headSolid([
                { x: side * 2.5, y: -1, z: HEAD.halfDepth + SKIN },
                { x: side * 9, y: -1, z: HEAD.halfDepth + SKIN },
                { x: side * 9, y: 4.5, z: HEAD.halfDepth + SKIN },
                { x: side * 2.5, y: 4.5, z: HEAD.halfDepth + SKIN },
              ])}
              fill={palette.accent}
              stroke="none"
            />
          ))}
        </g>

        {pose.legs.filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) > hullNear).map(legDrawing)}

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
                  r={px(2.4 + leg.load * 7)}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={1.1}
                />
              )
            })}
            <g data-centre data-stable={String(pose.stable)}>
              <path
                d={`M ${px(massPoint.x)} ${px(massPoint.y)} L ${px(plumb.x)} ${px(plumb.y)}`}
                stroke={pose.stable ? palette.accent : palette.shell}
                strokeWidth={0.9}
                strokeDasharray="2 2"
                fill="none"
              />
              <circle cx={px(massPoint.x)} cy={px(massPoint.y)} r={3} fill={pose.stable ? palette.accent : palette.shell} />
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
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/**
 * What it does with no timeline on it. Every behaviour is a pure function of
 * the clock, so the cycle can be sampled in a test without faking frames.
 */
export function siegeBehaviorPose(behavior: SiegeWalkerBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Loaded and slow: three feet down at every instant, and low on its legs.
    case "haul":
      return {
        gait: "creep" as SiegeWalkerGait,
        rate: 0.7,
        height: 0.28,
        step: 0.55,
        gaze: { x: 0.15 * Math.sin(time * 0.3), y: -0.45 },
      }
    // Both legs of a side together, which this hull cannot hold.
    case "pace":
      return {
        gait: "pace" as SiegeWalkerGait,
        rate: 1.5,
        height: 0.6,
        step: 0.9,
        gaze: { x: 0.3 * Math.sin(time * 0.5), y: 0.1 },
      }
    // Parked, scanning.
    case "halt":
      return {
        gait: "stand" as SiegeWalkerGait,
        rate: 0,
        height: 0.55 + 0.06 * Math.sin(time * 0.8),
        step: 0.7,
        gaze: { x: 0.8 * Math.sin(time * 0.36), y: 0.3 * Math.sin(time * 0.23) },
      }
    case "static":
      return {
        gait: "stand" as SiegeWalkerGait,
        rate: 0,
        height: 0.5,
        step: 0.7,
        gaze: { x: 0, y: 0 },
      }
    // Under way: a lateral-sequence walk, head swinging slowly.
    default:
      return {
        gait: "walk" as SiegeWalkerGait,
        rate: 1,
        height: 0.55,
        step: 0.8,
        gaze: { x: 0.45 * Math.sin(time * 0.26), y: 0.15 * Math.cos(time * 0.19) },
      }
  }
}

export { SiegeWalker }
