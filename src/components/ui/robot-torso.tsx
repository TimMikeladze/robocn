"use client"

/**
 * robot-torso — a pelvis, a column of vertebrae, and the cage they carry.
 *
 * The spine is `spineCurve` from `skeleton-kinematics`: equal segments from the
 * sacrum to the shoulder line, each carrying its share of the lean plus a fixed
 * lordotic shape, and each carrying its share of the twist. Leaning and
 * twisting therefore move the shoulders without stretching the back — every
 * vertebra is the same distance from the one below it in every pose.
 *
 * The ribs are hoops hung off the thoracic vertebrae and drawn in the
 * transverse plane, so they foreshorten into the ellipses a cage actually makes
 * from a raised camera instead of staying drawn-on arcs. `breath` opens them
 * along the machine's depth more than across its width, which is the direction
 * a pump moves a cage.
 *
 * There is no balance and no mass here. `lean` is a number someone typed.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { defaultProportions, spineCurve } from "@/lib/robocn/skeleton"
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

export type TorsoBehavior = "breathe" | "twist" | "static"

const VIEW_WIDTH = 190
const VIEW_HEIGHT = 220
/** World origin on screen: the sacrum, where the column starts. */
const CENTRE = { x: 95, y: 166 }
const SCALE = 1.75
const SLEW_RATE = 1.2
const NATIVE_VIEW: RobotView = "front"

const P = defaultProportions
/** Half-width and half-depth of the widest rib hoop. */
const RIB_WIDTH = 22
const RIB_DEPTH = 15
/** Where the cage sits on the column, as spine fractions. */
const RIB_FROM = 0.4
const RIB_TO = 0.94

const fits: Record<RobotView, number> = { plan: 1, front: 1, profile: 1, iso: 0.88 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotTorsoProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled pitch in degrees, positive leaning toward the nose. */
  lean?: number
  /** Controlled shoulder counter-rotation against the pelvis, in degrees. */
  twist?: number
  /** Controlled lateral roll in degrees, positive toward the machine's right. */
  sway?: number
  /** Controlled cage expansion, 0 empty to 1 full. */
  breath?: number
  /** What the torso does when none of the pose props are supplied. */
  behavior?: TorsoBehavior
  /** How many rib hoops the cage is built from. */
  ribs?: number
  /** Where the camera stands. One torso, four projections. */
  view?: RobotView
  /** Breaths, or twists, per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag across to twist and up and down to lean. */
  interactive?: boolean
  onLeanChange?: (lean: number) => void
  onTwistChange?: (twist: number) => void
  /** Draw the pelvis casting and its hip sockets. */
  showHips?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function RobotTorso({
  lean,
  twist,
  sway,
  breath,
  behavior = "breathe",
  ribs = 7,
  view = NATIVE_VIEW,
  speed = 0.35,
  animate = true,
  paused = false,
  phase = 0,
  interactive = false,
  onLeanChange,
  onTwistChange,
  showHips = true,
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
}: RobotTorsoProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [grabbed, setGrabbed] = React.useState<{ lean: number; twist: number } | null>(null)

  const controlled = lean !== undefined || twist !== undefined || breath !== undefined
  const hold = controlled ? finite(breath, 0.3) : grabbed ? 0.3 : null
  const goal = React.useCallback((clock: number) => torsoBreath(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: Math.max(SLEW_RATE, Math.abs(speed) * 4),
    hold: hold === null ? null : clamp(hold, 0, 1),
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const open = clamp(Number.isFinite(motion.value) ? motion.value : 0, 0, 1)

  const pitch = clamp(
    lean !== undefined ? finite(lean, 0) : (grabbed?.lean ?? torsoLean(behavior, motion.clock)),
    -35,
    45,
  )
  const turn = clamp(
    twist !== undefined ? finite(twist, 0) : (grabbed?.twist ?? torsoTwist(behavior, motion.clock)),
    -40,
    40,
  )
  const roll = clamp(finite(sway, 0), -25, 25)

  const setPose = React.useCallback(
    (next: { lean: number; twist: number }) => {
      const bounded = {
        lean: clamp(next.lean, -35, 45),
        twist: clamp(next.twist, -40, 40),
      }
      setGrabbed(bounded)
      onLeanChange?.(bounded.lean)
      onTwistChange?.(bounded.twist)
    },
    [onLeanChange, onTwistChange, setGrabbed],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback(
      (unit: Vec2) => setPose({ lean: (unit.y - 0.5) * 70, twist: (unit.x - 0.5) * 80 }),
      [setPose],
    ),
    onDragEnd: React.useCallback(() => {}, []),
  })

  const sacrum: Vec3 = { x: 0, y: 0, z: 0 }
  const spine = spineCurve({
    base: sacrum,
    length: P.spine,
    segments: Math.max(3, Math.min(12, Math.round(finite(ribs, 7) + 2))),
    lean: pitch,
    twist: turn,
  })
  const shoulders = spine[spine.length - 1]

  const camera = robotCamera(view)
  const fit = fits[view] ?? 1
  /** Lateral sway is a roll of the whole column about the sacrum. */
  const lean2 = (point: Vec3): Vec3 => {
    if (!roll) return point
    const a = toRadians(roll)
    const c = Math.cos(a)
    const s = Math.sin(a)
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c, z: point.z }
  }
  const to = (point: Vec3): Vec2 => {
    const p = lean2(point)
    return camera.project(p.x, p.y, p.z)
  }
  const box = (centre: Vec3, hx: number, hy: number, hz: number) =>
    slabPath(
      [-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) =>
            lean2({
              x: centre.x + sx * hx,
              y: centre.y + sy * hy,
              z: centre.z + sz * hz,
            }),
          ),
        ),
      ),
      camera,
    )
  const link = (a: Vec3, b: Vec3, radius: number) => capsulePath(to(a), to(b), radius)

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  /** A hoop is an outline, not a solid: paint its stroke, never its inside. */
  const hoop = (weight: number) => {
    const surface = robotSurface("shell", variant, palette)
    return {
      fill: "none",
      stroke: variant === "wire" ? palette.grid : palette.shell,
      strokeWidth: variant === "solid" ? weight : surface.strokeWidth,
      strokeDasharray: surface.strokeDasharray,
      strokeLinejoin: "round" as const,
    }
  }

  const count = Math.max(3, Math.min(10, Math.round(finite(ribs, 7))))
  const spineAt = (fraction: number): Vec3 => {
    const t = clamp(fraction, 0, 1) * (spine.length - 1)
    const i = Math.min(spine.length - 2, Math.floor(t))
    const f = t - i
    return {
      x: lerp(spine[i].x, spine[i + 1].x, f),
      y: lerp(spine[i].y, spine[i + 1].y, f),
      z: lerp(spine[i].z, spine[i + 1].z, f),
    }
  }
  const yawAt = (fraction: number) => turn * clamp(fraction, 0, 1)

  // Each rib is a pair of open arcs leaving its own vertebra, sweeping out and
  // round, and descending as they come forward — which is what makes a front
  // elevation of a cage read as ribs rather than as a stack of rings. The
  // lowest hoops float: they fall away further and stop short of the midline.
  const cage = Array.from({ length: count }, (_, index) => {
    const k = count === 1 ? 0 : index / (count - 1)
    const fraction = lerp(RIB_FROM, RIB_TO, k)
    const centre = spineAt(fraction)
    const profile = 0.42 + 0.58 * Math.sin(Math.PI * (0.16 + 0.78 * (1 - k)))
    const half = RIB_WIDTH * profile * (1 + 0.09 * open)
    const deep = RIB_DEPTH * profile * (1 + 0.24 * open)
    const yaw = toRadians(yawAt(fraction))
    const floating = clamp((0.24 - k) / 0.24, 0, 1)
    /** How far short of the front midline this hoop stops, in radians. */
    const gap = lerp(0.2, 0.85, floating)
    const drop = lerp(5, 8.5, floating) * (1 + 0.12 * open)
    const place = (a: number): Vec3 => {
      const x = Math.sin(a) * half
      // `a` runs from the vertebra at the back round to the front midline.
      const z = -Math.cos(a) * deep
      return {
        x: centre.x + x * Math.cos(yaw) - z * Math.sin(yaw),
        y: centre.y + 1.6 * open - drop * (1 - Math.abs(a) / Math.PI),
        z: centre.z + x * Math.sin(yaw) + z * Math.cos(yaw),
      }
    }
    // The arc starts just off the midline at the back, so a rib is a rib and
    // not a ring seen through itself.
    const arc = (sign: number) =>
      Array.from({ length: 13 }, (_, step) => place(lerp(Math.PI * 0.93, gap, step / 12) * sign))
    return {
      index,
      k,
      floating,
      centre,
      left: arc(-1),
      right: arc(1),
      front: place(gap * 0.999),
    }
  })
  const attached = cage.filter((rib) => rib.floating < 0.5)
  const sternumTop = attached.length ? attached[attached.length - 1].front : shoulders
  const sternumFoot = attached.length ? attached[0].front : spineAt(RIB_FROM)

  const yoke = (sign: number): Vec3 => {
    const yaw = toRadians(turn)
    const span = sign * P.shoulderSpan
    return {
      x: shoulders.x + span * Math.cos(yaw),
      y: shoulders.y,
      z: shoulders.z + span * Math.sin(yaw),
    }
  }
  const left = yoke(-1)
  const right = yoke(1)
  const neckTop: Vec3 = { x: shoulders.x, y: shoulders.y + P.neck, z: shoulders.z - P.neck * 0.14 }
  const hip = (sign: number): Vec3 => ({ x: sign * P.hipSpan, y: -9, z: 1 })

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot torso, leaning ${Math.round(pitch)} degrees and twisted ${Math.round(turn)} degrees, ${count} rib hoops, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? -40 : undefined}
      aria-valuemax={interactive ? 40 : undefined}
      aria-valuenow={interactive ? Math.round(turn) : undefined}
      aria-valuetext={interactive ? `twisted ${Math.round(turn)} degrees, leaning ${Math.round(pitch)}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 4, 12)
        const sideways = event.key === "ArrowLeft" || event.key === "ArrowRight"
        if (delta !== 0) {
          setPose({
            lean: pitch + (sideways ? 0 : delta),
            twist: turn + (sideways ? delta : 0),
          })
        } else if (event.key === "Home") setPose({ lean: 0, twist: 0 })
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setGrabbed(null)
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
      <g data-torso transform={`translate(${CENTRE.x} ${CENTRE.y}) scale(${px(SCALE * fit)})`}>
        {showHips && (
          <g data-pelvis>
            <path d={box({ x: 0, y: -7, z: 0 }, 15, 9.5, 9)} {...shell} />
            <path d={box({ x: 0, y: 2.5, z: 0 }, 10, 5, 7)} {...machined} />
            {[-1, 1].map((sign) => (
              <circle
                key={sign}
                data-socket={sign < 0 ? "left" : "right"}
                cx={px(to(hip(sign)).x)}
                cy={px(to(hip(sign)).y)}
                r={3.8}
                {...cast}
              />
            ))}
          </g>
        )}

        <g data-spine>
          {spine.map((vertebra, index) => (
            <g key={index} data-vertebra={index}>
              {index > 0 && (
                <path d={link(spine[index - 1], vertebra, 2.2)} {...cast} />
              )}
              <path d={box(vertebra, 3.6, 1.9, 3)} {...machined} />
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
                  {...hoop(3.1)}
                />
              ))}
            </g>
          ))}
        </g>

        <g data-sternum>
          <path d={link(sternumFoot, sternumTop, 4.4)} {...machined} />
          <path d={box(sternumTop, 5, 3.4, 2.6)} {...shell} />
          <circle
            cx={px(to(midpoint(sternumFoot, sternumTop)).x)}
            cy={px(to(midpoint(sternumFoot, sternumTop)).y)}
            r={3.6}
            fill={palette.accent}
            fillOpacity={px(0.35 + open * 0.65)}
          />
        </g>

        <g data-shoulders>
          <path d={link(left, right, 3.4)} {...machined} />
          {[
            ["left", left],
            ["right", right],
          ].map(([name, point]) => (
            <g key={name as string} data-shoulder={name as string}>
              <path d={box(point as Vec3, 6, 4.6, 6)} {...shell} />
              <circle
                cx={px(to(point as Vec3).x)}
                cy={px(to(point as Vec3).y)}
                r={3.6}
                {...cast}
              />
            </g>
          ))}
        </g>

        <g data-neck>
          <path d={link(shoulders, neckTop, 4.2)} {...machined} />
          <path d={box(neckTop, 5.5, 2.2, 4.5)} {...cast} />
        </g>

        {variant === "blueprint" && (
          <g fill="none" stroke={palette.grid} strokeWidth={0.4} opacity={0.7}>
            <path
              d={`M ${px(to({ x: 0, y: -18, z: 0 }).x)} ${px(to({ x: 0, y: -18, z: 0 }).y)} L ${px(to({ x: 0, y: P.spine + P.neck + 6, z: 0 }).x)} ${px(to({ x: 0, y: P.spine + P.neck + 6, z: 0 }).y)}`}
              strokeDasharray="2 3"
            />
          </g>
        )}
      </g>

      <g fontFamily="ui-monospace, monospace" textAnchor="middle" fill={palette.foreground}>
        <text x={VIEW_WIDTH / 2} y={205} fontSize={5}>
          {`LEAN ${Math.round(pitch)}° / TWIST ${Math.round(turn)}° / BREATH ${Math.round(open * 100)}%`}
        </text>
        {label && (
          <text x={VIEW_WIDTH / 2} y={214} fontSize={4.5}>
            {label}
          </text>
        )}
      </g>
    </svg>
  )
}

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
})

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/** Cage expansion at `clock`: in for a third of the cycle, out for the rest. */
export function torsoBreath(behavior: TorsoBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.3
  if (behavior === "twist") return 0.35
  const t = ((clock % 1) + 1) % 1
  return t < 0.38 ? t / 0.38 : 1 - (t - 0.38) / 0.62
}

/** Shoulder counter-rotation at `clock`, in degrees. */
export function torsoTwist(behavior: TorsoBehavior, clock: number) {
  if (behavior !== "twist" || !Number.isFinite(clock)) return 0
  return Math.sin(((clock % 1) + 1) % 1 * Math.PI * 2) * 32
}

/** Whole-column pitch at `clock`, in degrees. */
export function torsoLean(behavior: TorsoBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "twist") return 6
  return 3 + Math.sin(((clock % 1) + 1) % 1 * Math.PI * 2) * 2.5
}

export { RobotTorso }
