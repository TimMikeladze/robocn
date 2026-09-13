"use client"

/**
 * robot-skeleton — the whole biped, walking.
 *
 * Everything visible is `solveSkeleton`: legs solved in their own sagittal
 * planes to the ankle the stride asks for, a spine of equal segments from the
 * sacrum to the shoulder line, arms swinging half a cycle out of phase with the
 * leg on the same side, and feet that roll heel to toe over a planted sole. The
 * hands are `solveHand` at a quarter scale, so the machine's grip is the same
 * mechanism `robot-hand` ships on its own.
 *
 * `run` differs from `walk` in one number — a duty factor under a half — and
 * that is what produces the moments with neither foot down. The readout says
 * so rather than pretending it does not happen.
 *
 * Not to be confused with shadcn's `skeleton`, which is a loading placeholder.
 * This one has bones.
 *
 * No balance, no mass, no ground reaction. The hip height is a number someone
 * typed; the machine does not fall over because nothing here could.
 */

import * as React from "react"

import { useRobotClock, useRobotDrag } from "@/hooks/use-robot-motion"
import { solveHand, type HandGrasp } from "@/lib/robocn/hand"
import { clamp, lerp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  solveSkeleton,
  type SkeletonArm,
  type SkeletonGait,
  type SkeletonLeg,
} from "@/lib/robocn/skeleton"
import {
  capsulePath,
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

export type SkeletonBehavior = "walk" | "run" | "march" | "idle" | "static"

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 272
/** World origin on screen: the floor, under the pelvis. */
const CENTRE = { x: 88, y: 232 }
const SCALE = 1.25
const NATIVE_VIEW: RobotView = "front"

const P = defaultProportions
/** Hand length is about three quarters of a forearm. */
const HAND_SCALE = 0.19
const RIBS = 6
const RIB_WIDTH = 21
const RIB_DEPTH = 13
const RIB_FROM = 0.4
const RIB_TO = 0.94

const fits: Record<RobotView, number> = { plan: 0.9, front: 1, profile: 1, iso: 0.9 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const gaitOf = (behavior: SkeletonBehavior): SkeletonGait =>
  behavior === "walk" ? "walk" : behavior === "run" ? "run" : behavior === "march" ? "march" : "stand"

export interface RobotSkeletonProps
  extends Omit<React.ComponentProps<"svg">, "color" | "height">,
    RobotPaletteProps {
  /** Controlled cycle fraction. Supplying it stops the loop. */
  phase?: number
  /** Footfall pattern. Omit and `behavior` picks one. */
  gait?: SkeletonGait
  /** What the machine does when `phase` is not supplied. */
  behavior?: SkeletonBehavior
  /** Hip height, 0 crouched to 1 standing tall. */
  stance?: number
  /** Stride length and foot clearance, each 0 to 1. */
  stride?: number
  lift?: number
  /** Whole-column pitch in degrees, positive leaning toward the nose. */
  lean?: number
  /** Extra shoulder rotation against the pelvis, in degrees. */
  twist?: number
  /** Head pitch and yaw in degrees. */
  gazePitch?: number
  gazeYaw?: number
  /** What the hands are doing. */
  grasp?: HandGrasp
  /** Hand closure, 0 open to 1 shut. */
  grip?: number
  /** Where the camera stands. One machine, four projections. */
  view?: RobotView
  /** Gait cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a crowd of them breaks step. */
  offset?: number
  /** Drag across to scrub the gait. */
  interactive?: boolean
  onPhaseChange?: (phase: number) => void
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotSkeleton({
  phase,
  gait,
  behavior = "walk",
  stance = 1,
  stride = 0.7,
  lift = 0.6,
  lean,
  twist = 0,
  gazePitch = 0,
  gazeYaw = 0,
  grasp = "open",
  grip = 0.25,
  view = NATIVE_VIEW,
  speed = 0.55,
  animate = true,
  paused = false,
  offset = 0,
  interactive = false,
  onPhaseChange,
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
}: RobotSkeletonProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [scrubbed, setScrubbed] = React.useState<number | null>(null)

  const controlled = phase !== undefined
  const walking = gait ?? gaitOf(behavior)
  const clock = useRobotClock({
    speed: 1,
    animate: animate && !controlled && scrubbed === null && behavior !== "static",
    paused,
    phase: offset,
  })
  const cycle = controlled
    ? (Number.isFinite(phase) ? phase! : 0)
    : (scrubbed ?? clock * speed)

  // Idling, the only motion is the column rocking a degree or two, which keeps
  // a standing machine from reading as a diagram.
  const idle = behavior === "idle" && !controlled && scrubbed === null
  const pitch = lean !== undefined
    ? lean
    : idle
      ? 2 + Math.sin(clock * 1.3) * 1.6
      : walking === "run"
        ? 11
        : walking === "march"
          ? -3
          : 3

  const pose = solveSkeleton({
    gait: walking,
    phase: cycle,
    stance,
    stride,
    lift,
    lean: pitch,
    twist,
    gazePitch,
    gazeYaw,
    proportions: P,
  })

  const apply = React.useCallback(
    (next: number) => {
      const wrapped = ((next % 1) + 1) % 1
      setScrubbed(wrapped)
      onPhaseChange?.(wrapped)
    },
    [onPhaseChange, setScrubbed],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => {}, []),
  })

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  const to = (point: Vec3): Vec2 => camera.project(point.x, point.y, point.z)
  const depthOf = (point: Vec3) => camera.depth(point.x, point.y, point.z)
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)
  const box = (centre: Vec3, hx: number, hy: number, hz: number) =>
    slabPath(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) => ({
            x: centre.x + sx * hx,
            y: centre.y + sy * hy,
            z: centre.z + sz * hz,
          })),
        ),
      ),
      camera,
    )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const hoopPaint = {
    fill: "none",
    stroke: variant === "wire" ? palette.grid : palette.shell,
    strokeWidth: variant === "solid" ? 2.6 : robotSurface("shell", variant, palette).strokeWidth,
    strokeDasharray: robotSurface("shell", variant, palette).strokeDasharray,
    strokeLinejoin: "round" as const,
  }

  const spineAt = (fraction: number): Vec3 => {
    const t = clamp(fraction, 0, 1) * (pose.spine.length - 1)
    const i = Math.min(pose.spine.length - 2, Math.floor(t))
    const f = t - i
    return {
      x: lerp(pose.spine[i].x, pose.spine[i + 1].x, f),
      y: lerp(pose.spine[i].y, pose.spine[i + 1].y, f),
      z: lerp(pose.spine[i].z, pose.spine[i + 1].z, f),
    }
  }

  // The cage: open arcs leaving each thoracic vertebra and descending as they
  // come forward, which is the shape a rib has.
  const cage = Array.from({ length: RIBS }, (_, index) => {
    const k = index / (RIBS - 1)
    const centre = spineAt(lerp(RIB_FROM, RIB_TO, k))
    const profile = 0.42 + 0.58 * Math.sin(Math.PI * (0.16 + 0.78 * (1 - k)))
    const half = RIB_WIDTH * profile
    const deep = RIB_DEPTH * profile
    const floating = clamp((0.24 - k) / 0.24, 0, 1)
    const gap = lerp(0.2, 0.85, floating)
    const drop = lerp(4.5, 8, floating)
    const yaw = (pose.shoulderYaw * lerp(RIB_FROM, RIB_TO, k) * Math.PI) / 180
    const place = (a: number): Vec3 => {
      const x = Math.sin(a) * half
      const z = -Math.cos(a) * deep
      return {
        x: centre.x + x * Math.cos(yaw) - z * Math.sin(yaw),
        y: centre.y - drop * (1 - Math.abs(a) / Math.PI),
        z: centre.z + x * Math.sin(yaw) + z * Math.cos(yaw),
      }
    }
    const arc = (sign: number) =>
      Array.from({ length: 11 }, (_, step) => place(lerp(Math.PI * 0.93, gap, step / 10) * sign))
    return { index, left: arc(-1), right: arc(1), front: place(gap * 0.999), floating }
  })
  const attached = cage.filter((rib) => rib.floating < 0.5)
  const sternumTop = attached.length ? attached[attached.length - 1].front : pose.shoulders
  const sternumFoot = attached.length ? attached[0].front : spineAt(RIB_FROM)

  const yoke = (arm: SkeletonArm) => arm.shoulder

  /** One hand, solved in its own frame and set on the end of a forearm. */
  const handOf = (arm: SkeletonArm) => {
    const sign = arm.side === "right" ? 1 : -1
    const up = unit({
      x: arm.wrist.x - arm.elbow.x,
      y: arm.wrist.y - arm.elbow.y,
      z: arm.wrist.z - arm.elbow.z,
    })
    // The palm faces the body; the thumb then falls where a hanging hand's does.
    const normal: Vec3 = { x: -sign, y: 0, z: 0 }
    const thumb = cross(up, normal)
    const hand = solveHand({ grasp, curl: grip, side: arm.side })
    const place = (point: Vec3): Vec3 => ({
      x: arm.wrist.x + (thumb.x * point.x + up.x * point.y + normal.x * point.z) * HAND_SCALE,
      y: arm.wrist.y + (thumb.y * point.x + up.y * point.y + normal.y * point.z) * HAND_SCALE,
      z: arm.wrist.z + (thumb.z * point.x + up.z * point.y + normal.z * point.z) * HAND_SCALE,
    })
    return { hand, place }
  }

  const legPart = (leg: SkeletonLeg) => (
    <g key={`leg-${leg.side}`} data-leg={leg.side}>
      <path d={link(leg.hip, leg.knee, 5.4)} {...shell} />
      <path d={link(leg.knee, leg.ankle, 4.4)} {...machined} />
      <g data-foot={leg.side}>
        <path d={link(leg.heel, leg.ball, 3.4)} {...shell} />
        <path d={link(leg.ball, leg.toe, 2.4)} {...machined} />
      </g>
      <circle cx={px(to(leg.knee).x)} cy={px(to(leg.knee).y)} r={3.6} {...cast} />
      <circle cx={px(to(leg.ankle).x)} cy={px(to(leg.ankle).y)} r={2.8} {...cast} />
      {leg.contact > 0 && (
        <circle
          data-contact={leg.side}
          cx={px(to(leg.ball).x)}
          cy={px(to(leg.ball).y)}
          r={2.2}
          fill={palette.accent}
          fillOpacity={px(0.2 + leg.contact * 0.8)}
        />
      )}
    </g>
  )

  const armPart = (arm: SkeletonArm) => {
    const { hand, place } = handOf(arm)
    return (
      <g key={`arm-${arm.side}`} data-arm={arm.side}>
        <path d={link(arm.shoulder, arm.elbow, 4.4)} {...shell} />
        <path d={link(arm.elbow, arm.wrist, 3.6)} {...machined} />
        <circle cx={px(to(arm.elbow).x)} cy={px(to(arm.elbow).y)} r={3.2} {...cast} />
        <g data-hand={arm.side}>
          <path
            d={slabPath(
              hand.palm.flatMap((point) => [
                place({ x: point.x, y: point.y, z: hand.palmFront }),
                place({ x: point.x, y: point.y, z: hand.palmBack }),
              ]),
              camera,
            )}
            {...shell}
          />
          {hand.digits.map((finger) => (
            <path
              key={finger.name}
              data-digit={`${arm.side}-${finger.name}`}
              d={finger.joints
                .slice(0, -1)
                .map((joint, i) =>
                  capsulePath(
                    to(place(joint)),
                    to(place(finger.joints[i + 1])),
                    Math.max(0.9, (finger.radii[i] ?? 3) * HAND_SCALE * 1.5),
                  ),
                )
                .join(" ")}
              {...machined}
            />
          ))}
        </g>
      </g>
    )
  }

  // Draw the far side first, so a swinging limb passes behind the body when the
  // camera says it should.
  const legs = [...pose.legs].sort((a, b) => depthOf(a.hip) - depthOf(b.hip))
  const arms = [...pose.arms].sort((a, b) => depthOf(a.shoulder) - depthOf(b.shoulder))
  const readout = Math.round((((cycle % 1) + 1) % 1) * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot skeleton, ${walking} gait, ${readout} percent through its cycle, ${pose.grounded ? "a foot on the floor" : "both feet clear of the floor"}, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout}% through the ${walking} cycle` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (event.key === "ArrowRight" || event.key === "ArrowUp") apply(cycle + 0.04)
        else if (event.key === "ArrowLeft" || event.key === "ArrowDown") apply(cycle - 0.04)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") setScrubbed(null)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setScrubbed(null)
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
      <g data-skeleton transform={`translate(${CENTRE.x} ${CENTRE.y}) scale(${px(SCALE * fit)})`}>
        {showGround && (
          <ellipse
            data-ground
            cx={px(to({ x: 0, y: 0, z: 0 }).x)}
            cy={px(to({ x: 0, y: 0, z: 0 }).y)}
            rx={34}
            ry={px(6 * Math.max(camera.flatten, 0.12))}
            fill={palette.dark}
            opacity={px(pose.grounded ? 0.16 : 0.07)}
          />
        )}

        {legPart(legs[0])}
        {armPart(arms[0])}

        <g data-pelvis>
          <path d={box({ x: 0, y: pose.pelvis.y - 4, z: 0 }, 14, 8, 8)} {...shell} />
          {pose.legs.map((leg) => (
            <circle
              key={leg.side}
              data-joint={`${leg.side}-hip`}
              cx={px(to(leg.hip).x)}
              cy={px(to(leg.hip).y)}
              r={3.4}
              {...cast}
            />
          ))}
        </g>

        <g data-spine>
          {pose.spine.map((vertebra, index) => (
            <g key={index} data-vertebra={index}>
              {index > 0 && <path d={link(pose.spine[index - 1], vertebra, 1.8)} {...cast} />}
              <path d={box(vertebra, 2.8, 1.4, 2.4)} {...machined} />
            </g>
          ))}
        </g>

        <g data-ribcage>
          {cage.map((rib) => (
            <g key={rib.index} data-rib={rib.index}>
              {[rib.left, rib.right].map((arc, half) => (
                <path
                  key={half}
                  d={arc
                    .map((point, i) => {
                      const at = to(point)
                      return `${i ? "L" : "M"} ${px(at.x)} ${px(at.y)}`
                    })
                    .join(" ")}
                  {...hoopPaint}
                />
              ))}
            </g>
          ))}
        </g>

        <g data-sternum>
          <path d={link(sternumFoot, sternumTop, 3.4)} {...machined} />
          <circle
            cx={px(to(midpoint(sternumFoot, sternumTop)).x)}
            cy={px(to(midpoint(sternumFoot, sternumTop)).y)}
            r={3}
            fill={palette.accent}
          />
        </g>

        <g data-shoulders>
          <path d={link(yoke(pose.arms[0]), yoke(pose.arms[1]), 2.8)} {...machined} />
          {pose.arms.map((arm) => (
            <circle
              key={arm.side}
              data-joint={`${arm.side}-shoulder`}
              cx={px(to(arm.shoulder).x)}
              cy={px(to(arm.shoulder).y)}
              r={3.8}
              {...cast}
            />
          ))}
        </g>

        <g data-skull>
          <path d={link(pose.shoulders, pose.neck, 3.2)} {...machined} />
          <path d={box(pose.head, 6.6, 8, 7.2)} {...shell} />
          <path
            data-optic
            d={box(
              { x: pose.head.x, y: pose.head.y + 1.5, z: pose.head.z - 6.8 },
              4.8,
              1.9,
              1.5,
            )}
            {...cast}
          />
          <circle
            cx={px(to({ x: pose.head.x, y: pose.head.y + 1.5, z: pose.head.z - 8.2 }).x)}
            cy={px(to({ x: pose.head.x, y: pose.head.y + 1.5, z: pose.head.z - 8.2 }).y)}
            r={1.6}
            fill={palette.accent}
          />
        </g>

        {armPart(arms[1])}
        {legPart(legs[1])}

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.4} opacity={0.7}>
            <path
              d={`M ${px(to({ x: -48, y: 0, z: 0 }).x)} ${px(to({ x: -48, y: 0, z: 0 }).y)} L ${px(to({ x: 48, y: 0, z: 0 }).x)} ${px(to({ x: 48, y: 0, z: 0 }).y)}`}
              strokeDasharray="2 3"
            />
          </g>
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={254} fontSize={5}>
          {`${walking.toUpperCase()} / ${readout}% / ${pose.grounded ? "GROUNDED" : "FLIGHT"}`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={263} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const unit = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length < 1e-9 ? { x: 0, y: -1, z: 0 } : { x: v.x / length, y: v.y / length, z: v.z / length }
}

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})

export { RobotSkeleton }
