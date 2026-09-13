/**
 * robocn — device geometry.
 *
 * The mechanisms in a machine you carry. Four closures and a wrap, none of
 * which a drawing is allowed to fake: a hinge that keeps the lid's length, a
 * kickstand whose foot has to reach the desk, a rotary input divided into
 * detents that wraps in both directions, and a band that keeps its link count
 * and its pitch however far it is opened.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * dynamics — there is no friction in the hinge, no detent force on the crown
 * and no material in the band. Geometry only.
 */

import {
  clamp,
  lerp,
  normalize2,
  scale2,
  toDegrees,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import { px, type RobotCamera } from "@/lib/robocn/style"

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

/** Wrap into `[0, span)`, for negatives as well as positives. */
const wrap = (value: number, span: number) =>
  span > 0 ? ((value % span) + span) % span : 0

/* -------------------------------------------------------------------------- */
/* the hinge                                                                   */
/* -------------------------------------------------------------------------- */

export interface HingePose {
  /** Lid angle actually used: clamped travel, degrees from shut. */
  angle: number
  /** The hinge itself, at the origin. Everything else is relative to it. */
  pivot: Vec2
  /** Far edge of the base, lying on the desk toward the front of the machine. */
  baseFar: Vec2
  /** Top edge of the lid. Always `lid` away from the pivot. */
  lidTop: Vec2
  /**
   * How much of the screen faces the front of the machine: 0 shut, 1 standing
   * vertical. It is what a front camera sees of the display.
   */
  facing: number
  /** True once the lid has passed vertical, so its back is toward the front. */
  overCentre: boolean
}

export interface HingeOptions {
  /** How far the lid opens. Real clamshells stop between 120° and 140°. */
  maxAngle?: number
}

/**
 * One revolute joint in side elevation, drawn in SVG coordinates: `x` runs
 * toward the back of the machine and `y` down. The base lies on the desk in
 * `-x` and the lid rotates up out of it, so at 0° the lid lies over the base
 * and at 90° it stands straight up.
 *
 * The lid's length is preserved by construction, which is the whole reason the
 * hinge is solved rather than tweened between a shut picture and an open one.
 */
export function hingePose(
  angle: number,
  base: number,
  lid: number,
  { maxAngle = 135 }: HingeOptions = {},
): HingePose {
  const limit = Math.max(0, finite(maxAngle, 135))
  const open = clamp(finite(angle, 0), 0, limit)
  const reach = Math.max(0, finite(lid, 0))
  const run = Math.max(0, finite(base, 0))
  const theta = toRadians(open)
  return {
    angle: open,
    pivot: { x: 0, y: 0 },
    baseFar: { x: -run, y: 0 },
    lidTop: { x: -reach * Math.cos(theta), y: -reach * Math.sin(theta) },
    facing: Math.sin(theta),
    overCentre: open > 90,
  }
}

/* -------------------------------------------------------------------------- */
/* the kickstand                                                               */
/* -------------------------------------------------------------------------- */

export interface StandPose {
  /** How far the slate leans back from vertical, degrees. */
  tilt: number
  /** Top edge of the slate; its bottom edge is the origin, on the desk. */
  top: Vec2
  /** Where the stand is hinged to the back of the slate. */
  hinge: Vec2
  /** Where the stand's foot lands. On the desk unless the stand is folded. */
  foot: Vec2
  /** Angle between the stand and the back of the slate, degrees. */
  spread: number
  /**
   * True when the leg is too short to reach the desk at this tilt. The stand
   * stays folded flat against the slate rather than being stretched — the same
   * honesty `motion-platform` gives a leg that has run out of travel.
   */
  folded: boolean
}

export interface StandOptions {
  /** Tilt at `recline` 0 and at 1, degrees from vertical. */
  minTilt?: number
  maxTilt?: number
}

/**
 * A propped slate, in side elevation and SVG coordinates: the bottom edge sits
 * at the origin on the desk, `x` runs toward the back and `y` down.
 *
 * `recline` is the one axis, and it moves two things: the slate's tilt, and the
 * stand that has to close the triangle under it. The foot is placed by solving
 * for the desk rather than by drawing — given the drop from the hinge to the
 * desk, the horizontal run is whatever is left of the leg.
 */
export function standPose(
  recline: number,
  slate: number,
  leg: number,
  mount: number,
  { minTilt = 18, maxTilt = 68 }: StandOptions = {},
): StandPose {
  const at = clamp(finite(recline, 0), 0, 1)
  const tilt = lerp(finite(minTilt, 18), finite(maxTilt, 68), at)
  const length = Math.max(0, finite(slate, 0))
  const reach = Math.max(0, finite(leg, 0))
  const up = Math.max(0, finite(mount, 0))

  const theta = toRadians(tilt)
  // Up the back of the slate: back is +x, up is -y.
  const axis: Vec2 = { x: Math.sin(theta), y: -Math.cos(theta) }
  const top = scale2(axis, length)
  const hinge = scale2(axis, up)
  // The drop the leg has to cover to touch the desk.
  const drop = -hinge.y
  const folded = reach < drop

  const foot = folded
    ? // Nothing to solve: the stand lies back along the slate.
      { x: hinge.x - axis.x * reach, y: hinge.y - axis.y * reach }
    : { x: hinge.x + Math.sqrt(Math.max(0, reach * reach - drop * drop)), y: 0 }

  const down = normalize2({ x: -axis.x, y: -axis.y }, { x: 0, y: 1 })
  const legDir = normalize2({ x: foot.x - hinge.x, y: foot.y - hinge.y }, down)
  const spread = toDegrees(
    Math.acos(clamp(down.x * legDir.x + down.y * legDir.y, -1, 1)),
  )

  return { tilt, top, hinge, foot, spread: folded ? 0 : spread, folded }
}

/* -------------------------------------------------------------------------- */
/* rotary detents                                                              */
/* -------------------------------------------------------------------------- */

export interface DetentPose {
  /** Which step the input has landed on, always inside `0..steps-1`. */
  index: number
  /** Where it is between steps: `index` plus a fraction, wrapped. */
  offset: number
  /** Whole turns of the whole list, signed and unwrapped. */
  turns: number
}

/**
 * A rotary input divided into steps. The click wheel and the digital crown are
 * the same mechanism at different scales, so they share this: `degreesPerStep`
 * of rotation advances one step, and a full list wraps in both directions —
 * scrolling off the top lands on the bottom rather than on a negative row.
 */
export function detent(rotation: number, steps: number, degreesPerStep: number): DetentPose {
  const count = Math.max(1, Math.round(finite(steps, 1)) || 1)
  const step = Math.abs(finite(degreesPerStep, 30)) || 30
  const turned = finite(rotation, 0)
  const offset = wrap(turned / step, count)
  return { index: Math.min(count - 1, Math.floor(offset)), offset, turns: turned / (count * step) }
}

export type WheelSegment = "menu" | "next" | "play" | "previous"

/** Clockwise from the top, the way the four keys sit on a click wheel. */
const segments: WheelSegment[] = ["next", "play", "previous", "menu"]

/**
 * Which quarter of the ring a thumb at this angle is on. Angles are SVG
 * degrees — clockwise from `+x` — so the top of the wheel is −90.
 */
export function wheelSegment(degrees: number): WheelSegment | null {
  if (!Number.isFinite(degrees)) return null
  return segments[Math.floor(wrap(degrees + 45, 360) / 90)] ?? null
}

/* -------------------------------------------------------------------------- */
/* the band                                                                    */
/* -------------------------------------------------------------------------- */

export interface BandLink {
  position: Vec2
  /** Direction of this link, SVG degrees. */
  angle: number
}

export interface BandOptions {
  /** Direction the first link leaves the case in, SVG degrees. Default 90, down. */
  heading?: number
  /** Degrees each link turns relative to the last when fully closed. */
  curl?: number
}

/**
 * A link band as a constant-pitch chain: the count and the pitch are fixed and
 * the curvature varies, so opening the band cannot make the strap longer.
 * `closure` runs 0 (hanging straight) to 1 (curled round a wrist).
 *
 * It is the travelling-wave trick `spine-kinematics` uses — integrate a heading
 * instead of moving joints — applied to a bracelet.
 */
export function bandLinks(
  count: number,
  pitch: number,
  closure: number,
  { heading = 90, curl = 16 }: BandOptions = {},
): BandLink[] {
  const links = clamp(Math.round(finite(count, 8)) || 8, 2, 24)
  const span = Math.max(0, finite(pitch, 4))
  const turn = clamp(finite(closure, 0), 0, 1) * finite(curl, 16)
  const start = finite(heading, 90)

  const result: BandLink[] = []
  let position: Vec2 = { x: 0, y: 0 }
  for (let i = 0; i < links; i += 1) {
    const angle = start + turn * i
    result.push({ position, angle })
    const a = toRadians(angle)
    position = { x: position.x + Math.cos(a) * span, y: position.y + Math.sin(a) * span }
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* the screen                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The rows a fixed-height list shows with `index` selected: the window slides
 * to keep the selection near the middle and stops at both ends, so a scrolling
 * list never draws a blank row it does not have.
 */
export function listWindow(index: number, rows: number, visible: number): number[] {
  const total = Math.max(0, Math.round(finite(rows, 0)))
  const window = Math.max(1, Math.round(finite(visible, 1)))
  if (total <= window) return Array.from({ length: total }, (_, i) => i)
  const first = clamp(
    Math.round(finite(index, 0)) - Math.floor((window - 1) / 2),
    0,
    total - window,
  )
  return Array.from({ length: window }, (_, i) => first + i)
}

/* -------------------------------------------------------------------------- */
/* panels                                                                      */
/* -------------------------------------------------------------------------- */

export interface PanelProjection {
  /**
   * SVG transform placing artwork drawn in the panel's own coordinates —
   * `0,0` at its top-left corner, running to `width, height` — onto the screen.
   */
  transform: string
  /**
   * Signed area the panel projects to, as a fraction of its own. Positive is
   * its front face toward the camera, negative its back, zero edge on. It is
   * what decides whether a screen is drawn at all.
   */
  facing: number
}

/**
 * A flat panel at any attitude, projected. The four cameras are linear, so a
 * panel's projection is an affine map and one matrix carries the whole of its
 * artwork — a screen's rows, a keyboard's keys, a dial's ticks — with no
 * per-view redrawing.
 *
 * Pass the three world corners that define it: where its own `(0, 0)` sits,
 * where `(width, 0)` sits, and where `(0, height)` sits. Local axes follow
 * what a reader of the panel sees rather than the world — a screen facing the
 * front camera runs its own left-to-right from `+x` to `−x`, because from
 * nose-on the machine's starboard side is on your left.
 *
 * A lid, a propped slate and a turned handset all put a screen on a plane that
 * is neither horizontal nor vertical, which is why `camera.plane` and
 * `camera.wall` are not enough on their own.
 */
export function panelTransform(
  camera: RobotCamera,
  corner: Vec3,
  along: Vec3,
  down: Vec3,
  width: number,
  height: number,
): PanelProjection {
  const w = finite(width, 0)
  const h = finite(height, 0)
  const o = camera.project(finite(corner.x, 0), finite(corner.y, 0), finite(corner.z, 0))
  const a = camera.project(finite(along.x, 0), finite(along.y, 0), finite(along.z, 0))
  const d = camera.project(finite(down.x, 0), finite(down.y, 0), finite(down.z, 0))
  if (!w || !h) return { transform: "", facing: 0 }
  const ux = (a.x - o.x) / w
  const uy = (a.y - o.y) / w
  const vx = (d.x - o.x) / h
  const vy = (d.y - o.y) / h
  return {
    transform: `matrix(${px(ux)} ${px(uy)} ${px(vx)} ${px(vy)} ${px(o.x)} ${px(o.y)})`,
    facing: ux * vy - uy * vx,
  }
}

/** The four corners of a panel, projected: its outline, in draw order. */
export function panelPath(
  camera: RobotCamera,
  corner: Vec3,
  along: Vec3,
  down: Vec3,
): string {
  const at = (p: Vec3) =>
    camera.project(finite(p.x, 0), finite(p.y, 0), finite(p.z, 0))
  const o = at(corner)
  const a = at(along)
  const d = at(down)
  const far = { x: a.x + d.x - o.x, y: a.y + d.y - o.y }
  return `M ${px(o.x)} ${px(o.y)} L ${px(a.x)} ${px(a.y)} L ${px(far.x)} ${px(far.y)} L ${px(d.x)} ${px(d.y)} Z`
}
