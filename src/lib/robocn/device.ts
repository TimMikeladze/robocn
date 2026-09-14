/**
 * robocn — device geometry.
 *
 * The mechanisms in a machine you carry. Five closures and a wrap, none of
 * which a drawing is allowed to fake: a hinge that keeps the lid's length, a
 * book fold whose display keeps its own length as it bends, a kickstand whose
 * foot has to reach the desk, a rotary input divided into detents that wraps in
 * both directions, and a band that keeps its link count and its pitch however
 * far it is opened.
 *
 * Pure functions over plain objects. No React, no dependencies, and no
 * dynamics — there is no friction in the hinge, no detent force on the crown,
 * no crease memory in the folding display and no material in the band.
 * Geometry only.
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
/* the book fold                                                               */
/* -------------------------------------------------------------------------- */

export interface FoldLeaf {
  /** Which leaf: −1 to port, +1 to starboard, naming where it lies when flat. */
  side: -1 | 1
  /** Unit direction from the spine outward, along the leaf. */
  axis: Vec2
  /** Unit outward normal of the face the display is bonded to. */
  normal: Vec2
  /** Where the display leaves the bend and becomes straight. */
  root: Vec2
  /** The panel's inner edge, `bare` behind the root, at the spine. */
  hinge: Vec2
  /** The panel's outer, free edge. Always `leaf` from `hinge`, pinched or not. */
  tip: Vec2
  /** Heading of `axis`, degrees from `+x` toward `+y`. */
  heading: number
}

export interface FoldPose {
  /** Fold actually used: clamped travel, degrees. 0 shut, 180 flat. */
  angle: number
  /** How far each leaf has swung back from flat, degrees: `(180 - angle) / 2`. */
  swing: number
  /** Bend radius used. */
  radius: number
  /** Straight display run on each leaf. */
  run: number
  /** Display the bend consumes. `2 * run + arc` is `sheet` at every angle. */
  arc: number
  /** The display's own length: `2 * leaf`, always. */
  sheet: number
  /** Panel the display has peeled off at the spine: `arc / 2`. The cavity. */
  bare: number
  /** Across the mouth of the bend, root to root: `2 * radius` shut, 0 flat. */
  gap: number
  /** The bend, sampled from the port leaf's root to the starboard leaf's. */
  bend: Vec2[]
  /** Port leaf first. */
  leaves: [FoldLeaf, FoldLeaf]
  /** True when the bend has eaten the whole sheet and `run` is clamped to 0. */
  pinched: boolean
}

export interface FoldOptions {
  /** How far the fold opens. 180 is flat. */
  maxAngle?: number
  /** Points sampled along the bend, clamped 3–48. */
  steps?: number
}

/**
 * A book fold — two leaves and the display bent between them — in the plane
 * the fold turns in: `x` across the machine, `y` toward its back. The fold
 * axis is perpendicular to both, so this one plane is the whole mechanism. The
 * leaves close toward the front, so the bend's cavity is at the back and the
 * face that ends up outermost is the one a front camera is looking at.
 *
 * Two facts about a folding display do all the work here. It cannot stretch,
 * and it cannot be creased to a knife edge: it bends through `radius`. So the
 * bend consumes `radius × (180 - angle)` of sheet, that length comes off the
 * panels rather than out of nowhere — the display peels away from the inner
 * end of each leaf, which is the teardrop cavity — and `2 * run + arc` is the
 * sheet's length at every angle.
 *
 * Both leaf planes stay tangent to the bend circle, so the leaves roll around
 * it instead of pivoting on a pin. That is what the cams in a water-drop hinge
 * do, and it is what leaves the shut leaves `2 * radius` apart with the bend
 * tucked inside rather than pinched flat at the spine.
 *
 * The frame is the fold's own: both leaves swing by half the closure, so the
 * pose is symmetric about `+y`. A machine that holds one leaf still turns the
 * whole result by `swing`.
 */
export function foldPose(
  angle: number,
  leaf: number,
  radius: number,
  { maxAngle = 180, steps = 13 }: FoldOptions = {},
): FoldPose {
  const limit = clamp(finite(maxAngle, 180), 0, 180)
  const open = clamp(finite(angle, 0), 0, limit)
  const span = Math.max(0, finite(leaf, 0))
  const r = Math.max(0, finite(radius, 0))
  const swing = (180 - open) / 2
  const sigma = toRadians(swing)
  const sheet = span * 2
  const wanted = r * 2 * sigma
  const pinched = wanted > sheet
  const arc = Math.min(wanted, sheet)
  const run = (sheet - arc) / 2
  const bare = arc / 2

  const count = clamp(Math.round(finite(steps, 13)) || 13, 3, 48)
  const bend = Array.from({ length: count }, (_, index) => {
    // From the port leaf's tangent point round to the starboard leaf's.
    const at = toRadians(90 + swing - (index / (count - 1)) * swing * 2)
    return { x: r * Math.cos(at), y: r * Math.sin(at) }
  })

  const make = (side: -1 | 1): FoldLeaf => {
    // The leaves close toward −y, the front of the machine, so the face that
    // ends up outermost is the one a camera at the front is looking at.
    const axis: Vec2 = { x: side * Math.cos(sigma), y: -Math.sin(sigma) }
    // The tangent point: a radius in from the centre, against the leaf's face.
    const root: Vec2 = { x: side * r * Math.sin(sigma), y: r * Math.cos(sigma) }
    const hinge: Vec2 = { x: root.x - axis.x * bare, y: root.y - axis.y * bare }
    return {
      side,
      axis,
      normal: { x: -side * Math.sin(sigma), y: -Math.cos(sigma) },
      root,
      hinge,
      tip: { x: hinge.x + axis.x * span, y: hinge.y + axis.y * span },
      // `|| 0` so a leaf lying flat reads 180 rather than −180: the sign of
      // a negative zero is not a direction.
      heading: toDegrees(Math.atan2(axis.y || 0, axis.x)),
    }
  }

  return {
    angle: open,
    swing,
    radius: r,
    run,
    arc,
    sheet,
    bare,
    gap: 2 * r * Math.sin(sigma),
    bend,
    leaves: [make(-1), make(1)],
    pinched,
  }
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
