"use client"

/**
 * tripod-droid — a stubby three-legged survey walker.
 *
 * Three legs is the whole point. Lift one and the base of support collapses
 * from a triangle to a line, so the machine has to move its own mass onto that
 * line before it can take a step. `solveTripod` schedules the load, works out
 * where the body has to stand to hold it, and reports how much room is left;
 * this file draws the consequence. Push the body past its feet with the
 * pointer and the margin goes negative — nothing here fakes that.
 *
 * Modelled once in world units — x starboard, y up, z toward the viewer —
 * and projected through `robotCamera(view)`, so the chamfered slab, the face
 * marks and the solved legs are one geometry from all four angles.
 *
 * Design note: docs/tripod-droid.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useEasedPoint } from "@/hooks/use-robot-arm"
import { useRobotDrag } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { solveTripod, type TripodGait, type TripodLeg } from "@/lib/robocn/tripod"
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
  roundedFootprint,
  slabPath,
  type RobotCamera,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** How fast a released body eases back into the gait, in lean units a second. */
const LEAN_RATE = 2.4

/** The slab, in world units: half width, half depth, chamfer, body height. */
const BODY = { halfWidth: 50, halfDepth: 30, chamfer: 8, corner: 10, height: 62 } as const
/** Just proud of the nose, so the face marks sit on the front panel. */
const FACE = 0.4
const STUB = { inner: 50, outer: 61, bottom: 29, top: 37, halfDepth: 6 } as const

/** The whole box the machine works inside, so no camera crops it. */
const ENVELOPE = boxCorners({ x: -82, y: -2, z: -51 }, { x: 82, y: 91, z: 51 })
const WIDTH = 204
const HEIGHT = 186

/** The walker is drawn head-on; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "front"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type TripodBehavior = "trundle" | "scurry" | "survey" | "settle" | "static"

export interface TripodDroidProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Where the camera stands. One walker, four projections. */
  view?: RobotView
  /** What it does when `stride` is not supplied. */
  behavior?: TripodBehavior
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: TripodGait
  /** Controlled gait cycle, 0–1. Supplying it stops the clock. */
  stride?: number
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a row of them breaks step. */
  phase?: number
  /** Normalized ride height, foot travel and swing clearance, each 0–1. */
  height?: number
  step?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose, 90 to starboard. */
  heading?: number
  /**
   * Controlled body offset over the feet, −1..1 on each axis. Supplying it
   * beats the drag, and the gait still runs underneath.
   */
  lean?: Vec2 | null
  onLeanChange?: (lean: Vec2) => void
  /** Press and drag to push the body over its feet; arrow keys nudge it. */
  interactive?: boolean
  /** Controlled optic aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** Follow the page pointer while `look` is null. */
  track?: boolean
  /** Draw the support polygon, the loaded feet and the centre of mass. */
  showSupport?: boolean
  size?: RobotSize | number
  variant?: RobotVariant
  showGround?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
}

function TripodDroid({
  view = NATIVE_VIEW,
  behavior = "trundle",
  gait,
  stride,
  speed = 0.45,
  animate = true,
  paused = false,
  phase = 0,
  height,
  step,
  lift = 0.5,
  heading,
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
}: TripodDroidProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const controlled = lean !== undefined && lean !== null
  const [held, setHeld] = React.useState<Vec2 | null>(null)

  // A controlled lean and the pointer pin the body the same way; letting go
  // eases it back into whatever the gait has moved on to.
  const pinX = controlled ? finiteClamp(lean.x, -1, 1, 0) : 0
  const pinY = controlled ? finiteClamp(lean.y, -1, 1, 0) : 0
  const pinned = React.useMemo(
    () => (controlled ? { x: pinX, y: pinY } : held),
    [controlled, pinX, pinY, held],
  )
  // A behaviour that does nothing needs no clock, so the target is a point and
  // the loop settles to no renders at all rather than ticking under a still machine.
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
  // pushed to starboard pushes the body that way from every camera — including
  // plan view, where starboard is on the other side of the picture.
  const ground = React.useRef({
    camera: robotCamera(view),
    sway: 20,
    frame: { dx: 0, dy: 0, scale: 1 },
    /** Screen point the body's own centre rests at, which is the drag's zero. */
    anchor: { x: 0, y: 0 },
  })
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2, rect: DOMRect) => {
      const { camera, sway, frame, anchor } = ground.current
      // The drawing is letterboxed inside the element by xMidYMid meet.
      const fit = Math.min(rect.width / WIDTH, rect.height / HEIGHT)
      const box = {
        x: (unit.x * rect.width - (rect.width - WIDTH * fit) / 2) / fit,
        y: (unit.y * rect.height - (rect.height - HEIGHT * fit) / 2) / fit,
      }
      const point = groundPoint(
        camera,
        (box.x - frame.dx) / frame.scale - anchor.x,
        (box.y - frame.dy) / frame.scale - anchor.y,
      )
      const reach = Math.max(1, sway)
      apply({ x: point.x / reach, y: point.y / reach })
    }, [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && look === null && !paused,
    within: "element",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({ x: clamp((unit.x - 0.5) * 2, -1, 1), y: clamp((unit.y - 0.5) * 2, -1, 1) }),
      [],
    ),
  })

  const script = tripodBehaviorPose(behavior, motion.clock)
  const cycle = stride !== undefined ? finite(stride, 0) : motion.clock * speed * script.rate
  const pose = solveTripod({
    gait: gait ?? script.gait,
    phase: cycle,
    height: height ?? script.height,
    step: step ?? script.step,
    lift,
    heading: heading ?? script.heading,
    lean: bias,
  })

  const aim = look ?? pointer.target ?? script.gaze
  const gaze = { x: finiteClamp(aim.x, -1, 1, 0), y: finiteClamp(aim.y, -1, 1, 0) }

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const rendered = resolveRobotSize(size)
  const width = Number.isFinite(rendered) ? rendered : robotSizes.md
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const trim = robotSurface("metal", variant, palette, 0.7)
  // The machine reports itself: off balance lights the warning colour whatever
  // `signal` was asked for, because that is a fact and not a decoration.
  const alarmed = !pose.stable
  const lampColor = alarmed || signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const frame = fitFrame(ENVELOPE, camera, WIDTH, HEIGHT, 8)
  const sway = pose.sway
  const anchorY = pose.height + BODY.height / 2
  React.useEffect(() => {
    ground.current = { camera, sway, frame, anchor: camera.project(0, anchorY, 0) }
  }, [camera, sway, frame, anchorY])
  /** Local axes: x starboard, y up, z toward the viewer. */
  const at = (x: number, y: number, z = 0) => camera.project(-x, y, -z)
  const depthOf = (x: number, y: number, z: number) => camera.depth(-x, y, -z)
  const corner = (x: number, y: number, z: number): Vec3 => ({ x: -x, y, z: -z })
  const solid = (corners: readonly Vec3[]) => slabPath(corners, camera)
  /** A flat rectangle standing on the nose panel, which is where the face is. */
  const panel = (x0: number, x1: number, y0: number, y1: number, z: number) =>
    solid([
      corner(x0, y0, z),
      corner(x1, y0, z),
      corner(x1, y1, z),
      corner(x0, y1, z),
    ])

  /* --------------------------------------------------------------- body */

  const cx = pose.centre.x
  const cz = pose.centre.y
  const floor = pose.height
  const roof = floor + BODY.height
  const wide = roundedFootprint(BODY.halfWidth, BODY.halfDepth, BODY.corner, 5)
  const narrow = roundedFootprint(
    BODY.halfWidth - BODY.chamfer,
    BODY.halfDepth - BODY.chamfer,
    BODY.corner - 3,
    5,
  )
  const ring = (footprint: readonly Vec2[], y: number) =>
    footprint.map((point) => corner(cx + point.x, y, cz + point.y))
  const faceZ = cz + BODY.halfDepth + FACE
  // Anything nearer the camera than the whole slab is draws in front of it;
  // everything else is either inside it or behind, and draws first.
  const bodyNear = Math.max(
    ...[-1, 1].flatMap((sx) =>
      [floor, roof].flatMap((y) =>
        [-1, 1].map((sz) => depthOf(cx + sx * BODY.halfWidth, y, cz + sz * BODY.halfDepth)),
      ),
    ),
  )
  /** A flat rectangle lying on the roof, which is all plan view can see. */
  const deck = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    solid([corner(x0, y, z0), corner(x1, y, z0), corner(x1, y, z1), corner(x0, y, z1)])
  /** The same standing on a flank, which is all the side elevation can see. */
  const flank = (side: 1 | -1, z0: number, z1: number, y0: number, y1: number) => {
    const x = cx + side * (BODY.halfWidth + FACE)
    return solid([corner(x, y0, z0), corner(x, y0, z1), corner(x, y1, z1), corner(x, y1, z0)])
  }

  /* --------------------------------------------------------------- legs */

  const legDrawing = (leg: TripodLeg) => {
    const hip = at(leg.hip.x, floor, leg.hip.y)
    const knee = at(leg.knee.x, leg.kneeHeight, leg.knee.y)
    const foot = at(leg.foot.x, leg.clearance, leg.foot.y)
    return (
      <g key={leg.id} data-leg={leg.id} data-name={leg.name} opacity={leg.contact ? 1 : 0.9}>
        <path data-part="femur" d={capsulePath(hip, knee, 4.4)} {...shell} />
        <path data-part="tibia" d={capsulePath(knee, foot, 4.6)} {...machined} />
        <circle cx={px(hip.x)} cy={px(hip.y)} r={4.6} {...cast} />
        <circle data-knee cx={px(knee.x)} cy={px(knee.y)} r={3.6} {...cast} />
        <circle cx={px(knee.x)} cy={px(knee.y)} r={1.1} fill={palette.metal} />
        <ellipse data-foot cx={px(foot.x)} cy={px(foot.y)} rx={4.2} ry={px(Math.max(1.2, 4.2 * camera.flatten))} {...cast} />
      </g>
    )
  }

  /* -------------------------------------------------------------- stubs */

  /** A nub on a lateral hinge at the beam, lifting on the side it leans to. */
  const stubDrawing = (side: 1 | -1) => {
    const swing = clamp(bias.x * side * 26 + (pose.stable ? 0 : side * 6), -34, 34)
    const pivot = { x: side * STUB.inner, y: (STUB.bottom + STUB.top) / 2 + floor }
    const turn = (toRadians(swing) * side)
    const hinge = (x: number, y: number): Vec2 => {
      const dx = x - pivot.x
      const dy = y - pivot.y
      return {
        x: pivot.x + dx * Math.cos(turn) - dy * Math.sin(turn),
        y: pivot.y + dx * Math.sin(turn) + dy * Math.cos(turn),
      }
    }
    const box = ([
      [side * STUB.inner, STUB.bottom],
      [side * STUB.outer, STUB.bottom],
      [side * STUB.outer, STUB.top],
      [side * STUB.inner, STUB.top],
    ] as const).flatMap(([x, y]) => {
      const turned = hinge(x, y + floor)
      return [
        corner(cx + turned.x, turned.y, cz + STUB.halfDepth),
        corner(cx + turned.x, turned.y, cz - STUB.halfDepth),
      ]
    })
    return (
      <path
        key={side}
        data-stub={side === 1 ? "right" : "left"}
        d={solid(box)}
        {...machined}
      />
    )
  }
  const stubDepth = (side: 1 | -1) =>
    depthOf(cx + side * STUB.outer, floor + (STUB.bottom + STUB.top) / 2, cz)

  /* ------------------------------------------------------------ readouts */

  const contacts = pose.legs.filter((leg) => leg.contact)
  const centreMark = at(pose.centre.x, 0, pose.centre.y)
  const marginText = `${pose.margin >= 0 ? "" : "−"}${Math.abs(pose.margin).toFixed(1)}`
  const leanText = `${Math.round(bias.x * 100)} percent starboard, ${Math.round(bias.y * 100)} percent forward`
  const state = dragging
    ? "held"
    : pose.gait === "stand"
      ? "standing"
      : pose.gait === "pivot"
        ? "turning on the spot"
        : `walking, ${pose.gait}`

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Tripod droid, ${state}, ${pose.stable ? "balanced" : "off balance"}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -100 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(bias.x * 100) : undefined}
      aria-valuetext={interactive ? `lean ${leanText}, stability margin ${marginText}` : undefined}
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
          case "ArrowUp": next.y -= nudge; break
          case "ArrowDown": next.y += nudge; break
          case "Home": next.x = 0; next.y = 0; break
          case "End": next.y = 1; break
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
      <g data-droid data-view={view} transform={frame.transform || undefined}>
        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
            <path
              d={`M ${px(at(-78, 0, 0).x)} ${px(at(-78, 0, 0).y)} L ${px(at(78, 0, 0).x)} ${px(at(78, 0, 0).y)}`}
              strokeDasharray="3 3"
            />
            {/* How far the body is allowed to move over its own feet. */}
            <ellipse
              data-sway
              cx={px(at(0, 0, 0).x)}
              cy={px(at(0, 0, 0).y)}
              rx={px(pose.sway)}
              ry={px(Math.max(0.8, pose.sway * camera.flatten))}
              strokeDasharray="2 3"
            />
          </g>
        )}

        {showGround && (
          <ellipse
            cx={px(at(cx, 0, cz).x)}
            cy={px(at(cx, 0, cz).y)}
            rx={46}
            ry={px(Math.max(2.4, 40 * camera.flatten))}
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

        {pose.legs.filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) <= bodyNear).map(legDrawing)}
        {([-1, 1] as const).filter((side) => stubDepth(side) <= bodyNear).map(stubDrawing)}

        <g data-body>
          {/* Three stacked solids, so the chamfer is geometry and not paint. */}
          <path
            data-part="skirt"
            d={solid([...ring(narrow, floor), ...ring(wide, floor + BODY.chamfer)])}
            {...shell}
          />
          <path
            data-part="core"
            d={solid([...ring(wide, floor + BODY.chamfer), ...ring(wide, roof - BODY.chamfer)])}
            {...shell}
          />
          <path
            data-part="crown"
            d={solid([...ring(wide, roof - BODY.chamfer), ...ring(narrow, roof)])}
            {...shell}
          />

          {/* Roof and flanks, so the machine still reads from above and side on. */}
          <path data-part="hatch" d={deck(cx - 18, cx + 18, cz - 11, cz + 11, roof + FACE)} {...trim} />
          <path data-part="beacon" d={deck(cx - 4, cx + 4, cz - 20, cz - 14, roof + FACE)} fill={lampColor} stroke="none" />
          {([-1, 1] as const).map((side) =>
            [16, 21, 26].map((y) => (
              <path key={`${side}-${y}`} d={flank(side, cz - 9, cz + 9, floor + y, floor + y + 2.2)} {...cast} />
            )),
          )}

          <g data-face>
            {/* Two slot optics, a vent stack and one lamp: the rest is noise. */}
            {[9, 13, 17].map((row) => (
              <path key={row} d={panel(cx - 10, cx + 10, floor + row, floor + row + 2.2, faceZ)} {...cast} />
            ))}
            <path
              data-lamp
              d={panel(cx - 6.5, cx + 6.5, floor + 24, floor + 27, faceZ)}
              fill={lampColor}
              stroke="none"
            />

            {([-1, 1] as const).map((side) => {
              const centreX = cx + side * 16
              return (
                <g key={side} data-optic={side === -1 ? "left" : "right"}>
                  <path
                    data-part="slot"
                    d={panel(centreX - 5, centreX + 5, floor + 38, floor + 58, faceZ)}
                    {...cast}
                  />
                  <path
                    data-part="pupil"
                    d={panel(
                      centreX - 3 + gaze.x * 1.6,
                      centreX + 3 + gaze.x * 1.6,
                      floor + 44.5 - gaze.y * 4.5,
                      floor + 51.5 - gaze.y * 4.5,
                      faceZ + 0.3,
                    )}
                    fill={palette.accent}
                    stroke="none"
                    opacity={script.blink}
                  />
                </g>
              )
            })}
          </g>
        </g>

        {pose.legs.filter((leg) => depthOf(leg.foot.x, 0, leg.foot.y) > bodyNear).map(legDrawing)}
        {([-1, 1] as const).filter((side) => stubDepth(side) > bodyNear).map(stubDrawing)}

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
                  r={px(2.6 + leg.load * 5)}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={1.1}
                />
              )
            })}
            <g data-centre data-stable={String(pose.stable)}>
              <circle
                cx={px(centreMark.x)}
                cy={px(centreMark.y)}
                r={3}
                fill={pose.stable ? palette.accent : palette.shell}
              />
              <path
                d={`M ${px(centreMark.x - 7)} ${px(centreMark.y)} H ${px(centreMark.x + 7)}`}
                stroke={pose.stable ? palette.accent : palette.shell}
                strokeWidth={0.9}
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

/** How much a squashed axis is held back, in units of the basis it lives in. */
const DAMPING = 0.15

/**
 * Which way a drag across the drawing pushes the body, in plan coordinates.
 *
 * A horizontal plane projects affinely, so the camera turns it into two basis
 * vectors and the drag is those two solved for. Inverting them exactly would
 * make an axis the camera barely shows — fore and aft in front elevation, where
 * it is nearly edge-on — swing the machine end to end for a few pixels, so this
 * is the damped least-squares solve instead: `(JᵀJ + λI)⁻¹ Jᵀ`, which gives a
 * squashed axis a proportionally small answer rather than an enormous one. It
 * is the same thing a manipulator does near a singularity, and for the same
 * reason.
 */
function groundPoint(camera: RobotCamera, x: number, y: number): Vec2 {
  const origin = camera.project(0, 0, 0)
  const across = camera.project(-1, 0, 0)
  const along = camera.project(0, 0, -1)
  const e1 = { x: across.x - origin.x, y: across.y - origin.y }
  const e2 = { x: along.x - origin.x, y: along.y - origin.y }
  const a = e1.x * e1.x + e1.y * e1.y + DAMPING
  const b = e1.x * e2.x + e1.y * e2.y
  const c = e2.x * e2.x + e2.y * e2.y + DAMPING
  const det = a * c - b * b
  if (Math.abs(det) < 1e-9) return { x: 0, y: 0 }
  const p = e1.x * x + e1.y * y
  const q = e2.x * x + e2.y * y
  return { x: (c * p - b * q) / det, y: (a * q - b * p) / det }
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const finite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
/** A control that has to survive a consumer handing it `NaN`. */
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/**
 * What it does with no timeline on it. Every behaviour is a pure function of
 * the clock, so the cycle can be sampled in a test without faking frames.
 */
export function tripodBehaviorPose(behavior: TripodBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  // One blink a few seconds, quick, and never quite on the beat of the gait.
  const beat = ((time * 0.31) % 1 + 1) % 1
  const blink = beat > 0.94 ? 0.15 : 1
  switch (behavior) {
    // Head down and quick: two feet off at once, which it cannot hold.
    case "scurry":
      return {
        gait: "amble" as TripodGait,
        rate: 2.1,
        heading: 0,
        height: 0.22,
        step: 0.95,
        gaze: { x: 0, y: -0.5 },
        blink,
      }
    // Turning on the spot, looking around as it goes.
    case "survey":
      return {
        gait: "pivot" as TripodGait,
        rate: 1,
        heading: 0,
        height: 0.5,
        step: 0.6,
        gaze: { x: 0.8 * Math.sin(time * 0.9), y: 0.2 * Math.sin(time * 0.5) },
        blink,
      }
    // Parked, breathing on its legs.
    case "settle":
      return {
        gait: "stand" as TripodGait,
        rate: 0,
        heading: 0,
        height: 0.45 + 0.12 * Math.sin(time * 1.1),
        step: 0.6,
        gaze: { x: 0.35 * Math.sin(time * 0.6), y: 0.25 * Math.sin(time * 0.37) },
        blink,
      }
    case "static":
      return {
        gait: "stand" as TripodGait,
        rate: 0,
        heading: 0,
        height: 0.43,
        step: 0.6,
        gaze: { x: 0, y: 0 },
        blink: 1,
      }
    // Ambling about its business, wandering off course and back.
    default:
      return {
        gait: "creep" as TripodGait,
        rate: 1,
        heading: 34 * Math.sin(time * 0.23),
        height: 0.4,
        step: 0.72,
        gaze: { x: 0.5 * Math.sin(time * 0.41), y: 0.2 * Math.cos(time * 0.29) },
        blink,
      }
  }
}

export { TripodDroid }
