/**
 * robocn — gridiron geometry.
 *
 * The maths behind the football family: the ball, what happens to it in the
 * air, the two machines that put it there, the route tree the receiver runs,
 * and the plated kit all four players wear.
 *
 * World axes are the skeleton's, because the players *are* `solveSkeleton`:
 * `x` the machine's right, `y` up, `z` behind it. A player faces `-z`, so
 * downfield is `-z` and the floor is `y = 0`. Lengths that leave this file for
 * a trajectory or a route are **yards**, and times are seconds; a component
 * scales them into its own viewBox once.
 *
 * The ball is a prolate spheroid — semi-axis `long` down its own axis, `waist`
 * across — and two things follow from writing it that way rather than drawing
 * an oval:
 *
 * - Its silhouette is exact from any angle. With the surface as `p = R M q` for
 *   a unit `q`, the normal is `R M⁻¹ q`, so the outline is the great circle of
 *   the unit sphere whose pole is `M⁻¹ Rᵀ d` pushed back out through `R M`.
 *   End-on that degenerates to a circle of radius `waist`, which is what the
 *   ball looks like coming at you, and nothing special-cases it.
 * - The laces are *on the surface*, each with a real normal, so spinning the
 *   ball takes them round the back instead of sliding them across the front.
 *
 * What is not here: air. Every trajectory is drag-free, which is a real
 * parabola of a ball that does not exist. It is exact, and it is optimistic.
 * There is also no contact, no defender, no rule and no clock.
 */

import {
  clamp,
  lerp,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"
import {
  defaultProportions,
  type SkeletonProportions,
} from "@/lib/robocn/skeleton"

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/** A length: finite, and never zero or negative. */
const span = (value: number | undefined, fallback: number) =>
  Math.max(1e-6, Math.abs(finite(value, fallback)))

const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const unit = (v: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length < 1e-9
    ? fallback
    : { x: v.x / length, y: v.y / length, z: v.z / length }
}

/** `a·x + b·y + c·z` for a frame's three columns. */
const combine = (u: Vec3, v: Vec3, w: Vec3, a: number, b: number, c: number): Vec3 => ({
  x: u.x * a + v.x * b + w.x * c,
  y: u.y * a + v.y * b + w.y * c,
  z: u.z * a + v.z * b + w.z * c,
})

/** Rotate `p` about the unit axis `k` by `degrees` — Rodrigues, written out. */
function turnAbout(p: Vec3, k: Vec3, degrees: number): Vec3 {
  const a = toRadians(finite(degrees, 0))
  const c = Math.cos(a)
  const s = Math.sin(a)
  const kp = cross(k, p)
  const kd = dot(k, p) * (1 - c)
  return {
    x: p.x * c + kp.x * s + k.x * kd,
    y: p.y * c + kp.y * s + k.y * kd,
    z: p.z * c + kp.z * s + k.z * kd,
  }
}

/* -------------------------------------------------------------------------- */
/* the ball                                                                    */
/* -------------------------------------------------------------------------- */

/** Semi-axes of the prolate spheroid: along its own axis, and across it. */
export interface BallShape {
  long: number
  waist: number
}

/**
 * Eleven inches by six and three quarters across the middle, kept as a ratio
 * rather than a real measurement — the components pick their own scale.
 */
export const defaultBall: BallShape = { long: 15, waist: 8.6 }

/** Nose direction and roll, in degrees. Yaw turns the nose right, pitch up. */
export interface BallAttitude {
  yaw: number
  pitch: number
  roll: number
}

/** The ball's own axes in world space: `u` the long axis, `v` and `w` across. */
export interface BallFrame {
  /** Nose direction — the long axis. */
  u: Vec3
  /** The ball's right, at zero roll. */
  v: Vec3
  /** The ball's up, at zero roll. The laces sit on the `w` meridian. */
  w: Vec3
}

const shapeOf = (shape: Partial<BallShape> | undefined): BallShape => ({
  long: span(shape?.long, defaultBall.long),
  waist: span(shape?.waist, defaultBall.waist),
})

/**
 * The ball's frame from its attitude: yaw about the world vertical, then pitch
 * about the yawed cross axis, then roll about the long axis it ends up with.
 * At rest the nose points downfield (`-z`) and the laces face up.
 */
export function ballFrame(attitude: Partial<BallAttitude> = {}): BallFrame {
  const yaw = finite(attitude.yaw, 0)
  const pitch = finite(attitude.pitch, 0)
  const roll = finite(attitude.roll, 0)

  const up: Vec3 = { x: 0, y: 1, z: 0 }
  // Negated: the nose points down `-z`, so a positive turn about the world
  // vertical has to swing it toward `+x` for "yaw right" to mean right.
  let u = turnAbout({ x: 0, y: 0, z: -1 }, up, -yaw)
  const v = turnAbout({ x: 1, y: 0, z: 0 }, up, -yaw)
  let w = { x: 0, y: 1, z: 0 }

  u = turnAbout(u, v, pitch)
  w = turnAbout(w, v, pitch)

  const axis = unit(u, { x: 0, y: 0, z: -1 })
  return {
    u: axis,
    v: turnAbout(v, axis, roll),
    w: turnAbout(w, axis, roll),
  }
}

/**
 * A point on the surface. `s` runs -1 at the tail to 1 at the nose; `theta` is
 * degrees round the long axis, 0 on the lace meridian.
 */
export function ballPoint(
  frame: BallFrame,
  shape: Partial<BallShape>,
  s: number,
  theta: number,
): Vec3 {
  const { long, waist } = shapeOf(shape)
  const along = clamp(finite(s, 0), -1, 1)
  const ring = Math.sqrt(Math.max(0, 1 - along * along))
  const a = toRadians(finite(theta, 0))
  return combine(
    frame.u,
    frame.v,
    frame.w,
    long * along,
    waist * ring * Math.sin(a),
    waist * ring * Math.cos(a),
  )
}

/** The outward normal at the same surface point. */
export function ballNormal(
  frame: BallFrame,
  shape: Partial<BallShape>,
  s: number,
  theta: number,
): Vec3 {
  const { long, waist } = shapeOf(shape)
  const along = clamp(finite(s, 0), -1, 1)
  const ring = Math.sqrt(Math.max(0, 1 - along * along))
  const a = toRadians(finite(theta, 0))
  return unit(
    combine(
      frame.u,
      frame.v,
      frame.w,
      along / long,
      (ring * Math.sin(a)) / waist,
      (ring * Math.cos(a)) / waist,
    ),
    frame.u,
  )
}

/** Either tip: `+1` the nose, `-1` the tail. */
export function ballTip(frame: BallFrame, shape: Partial<BallShape>, end: number): Vec3 {
  const { long } = shapeOf(shape)
  const sign = finite(end, 1) < 0 ? -1 : 1
  return { x: frame.u.x * long * sign, y: frame.u.y * long * sign, z: frame.u.z * long * sign }
}

/**
 * The silhouette, exactly. `viewDir` points from the ball toward the camera.
 *
 * The outline of an ellipsoid under orthographic projection is a *central*
 * section, not the equator: the set of surface points whose normal is
 * perpendicular to the view. Written as `p = R M q`, the normal is `R M⁻¹ q`,
 * so those `q` are the great circle with pole `M⁻¹ Rᵀ d`. Sampling that circle
 * and pushing it back through `R M` is the outline, and it collapses to a
 * circle of radius `waist` when the ball is end-on.
 */
export function ballSilhouette(
  frame: BallFrame,
  shape: Partial<BallShape>,
  viewDir: Vec3,
  steps = 48,
): Vec3[] {
  const { long, waist } = shapeOf(shape)
  const d = unit(viewDir, { x: 0, y: 0, z: 1 })
  // The view direction in the ball's own axes, scaled by M⁻¹.
  const pole = unit(
    { x: dot(d, frame.u) / long, y: dot(d, frame.v) / waist, z: dot(d, frame.w) / waist },
    { x: 1, y: 0, z: 0 },
  )
  // Any two unit vectors perpendicular to the pole span the great circle.
  const seed: Vec3 = Math.abs(pole.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const e1 = unit(cross(pole, seed))
  const e2 = unit(cross(pole, e1))
  const count = Math.max(8, Math.round(finite(steps, 48)))
  return Array.from({ length: count }, (_, index) => {
    const a = (index / count) * Math.PI * 2
    const qx = e1.x * Math.cos(a) + e2.x * Math.sin(a)
    const qy = e1.y * Math.cos(a) + e2.y * Math.sin(a)
    const qz = e1.z * Math.cos(a) + e2.z * Math.sin(a)
    return combine(frame.u, frame.v, frame.w, long * qx, waist * qy, waist * qz)
  })
}

/** A surface point with the sign of its own visibility. */
export interface BallMark {
  point: Vec3
  /** Positive when the camera can see this bit of skin. */
  facing: number
}

const markAt = (
  frame: BallFrame,
  shape: Partial<BallShape>,
  view: Vec3,
  s: number,
  theta: number,
): BallMark => ({
  point: ballPoint(frame, shape, s, theta),
  facing: dot(ballNormal(frame, shape, s, theta), view),
})

/** The lace panel's centre line: the `theta = 0` meridian, nose to tail. */
export function ballSeam(
  frame: BallFrame,
  shape: Partial<BallShape>,
  viewDir: Vec3,
  steps = 24,
): BallMark[] {
  const view = unit(viewDir, { x: 0, y: 0, z: 1 })
  const count = Math.max(4, Math.round(finite(steps, 24)))
  return Array.from({ length: count }, (_, index) =>
    markAt(frame, shape, view, lerp(-0.82, 0.82, index / (count - 1)), 0),
  )
}

/** One stitch across the seam. */
export interface BallLace {
  a: Vec3
  b: Vec3
  facing: number
}

/** The cross stitches, straddling the seam over the middle third of the ball. */
export function ballLaces(
  frame: BallFrame,
  shape: Partial<BallShape>,
  viewDir: Vec3,
  count = 8,
  reach = 16,
): BallLace[] {
  const view = unit(viewDir, { x: 0, y: 0, z: 1 })
  const stitches = Math.max(2, Math.round(finite(count, 8)))
  const arc = clamp(finite(reach, 16), 2, 60)
  return Array.from({ length: stitches }, (_, index) => {
    const s = lerp(-0.36, 0.36, index / (stitches - 1))
    return {
      a: ballPoint(frame, shape, s, -arc),
      b: ballPoint(frame, shape, s, arc),
      facing: dot(ballNormal(frame, shape, s, 0), view),
    }
  })
}

/** The two bands round the ball near its ends, as rings of marks. */
export function ballStripes(
  frame: BallFrame,
  shape: Partial<BallShape>,
  viewDir: Vec3,
  at = 0.6,
  steps = 28,
): BallMark[][] {
  const view = unit(viewDir, { x: 0, y: 0, z: 1 })
  const where = clamp(finite(at, 0.6), 0.1, 0.95)
  const count = Math.max(6, Math.round(finite(steps, 28)))
  return [where, -where].map((s) =>
    Array.from({ length: count }, (_, index) =>
      markAt(frame, shape, view, s, (index / count) * 360),
    ),
  )
}

/* -------------------------------------------------------------------------- */
/* what the ball does in the air                                               */
/* -------------------------------------------------------------------------- */

export type BallFlight = "spiral" | "wobble" | "tumble" | "snap" | "hold"

export interface FlightOptions {
  /** Turns about the long axis per cycle. */
  spin?: number
  /** Half-angle of the precession cone, in degrees. */
  wobble?: number
  /** The attitude the flight is built around. */
  pitch?: number
  yaw?: number
  /** Roll for the flights that do not drive it themselves. */
  roll?: number
}

/**
 * The ball's attitude at cycle time `t`, as a pure function of the clock.
 *
 * A spiral and a wobble are the same mechanism with different numbers: the
 * nose walks round a cone while the ball rolls about it, and the cone is
 * narrow and the roll fast in one case, open and slow in the other. The
 * precession runs at a third of the roll rate, which is why a good spiral's
 * nose drifts rather than strobes. A tumble takes the roll off and pitches the
 * whole ball end over end instead.
 */
export function flightAttitude(
  flight: BallFlight,
  t: number,
  options: FlightOptions = {},
): BallAttitude {
  const cycle = wrap(t)
  const pitch = finite(options.pitch, 0)
  const yaw = finite(options.yaw, 0)
  const spin = finite(options.spin, 6)
  const cone = finite(options.wobble, 0)

  switch (flight) {
    case "spiral": {
      const nose = 2 * Math.PI * cycle * (spin / 3)
      const open = cone || 4
      return {
        yaw: yaw + open * Math.cos(nose),
        pitch: pitch + open * Math.sin(nose),
        roll: cycle * 360 * spin,
      }
    }
    case "wobble": {
      const slow = finite(options.spin, 2)
      const nose = 2 * Math.PI * cycle * (slow / 3)
      const open = cone || 24
      return {
        yaw: yaw + open * Math.cos(nose),
        pitch: pitch + open * Math.sin(nose * 1.6),
        roll: cycle * 360 * slow,
      }
    }
    case "tumble":
      return { yaw, pitch: pitch + cycle * 360, roll: finite(options.roll, 0) }
    case "snap": {
      // Off the turf and spinning up: the roll arrives quadratically and the
      // nose comes round from lying across the field to pointing back.
      const rise = Math.min(1, cycle * 2)
      return {
        yaw: lerp(yaw + 88, yaw, rise),
        pitch: lerp(pitch - 16, pitch, rise),
        roll: cycle * cycle * 360 * spin,
      }
    }
    default:
      return { yaw, pitch, roll: finite(options.roll, 0) }
  }
}

/* -------------------------------------------------------------------------- */
/* ballistics                                                                  */
/* -------------------------------------------------------------------------- */

/** Yards per second squared: 9.81 m/s² in the unit the rest of this file uses. */
export const GRAVITY = 10.73

export interface KickOptions {
  /** Launch speed, yards per second. */
  speed?: number
  /** Launch angle above the horizontal, in degrees. */
  angle?: number
  /** Launch height above the ground, in yards. */
  height?: number
  gravity?: number
}

export interface FlightPoint {
  x: number
  y: number
  vx: number
  vy: number
  /** Velocity direction in degrees above the horizontal. */
  heading: number
}

export interface KickFlight {
  speed: number
  angle: number
  height: number
  gravity: number
  /** Seconds from launch to the ball coming back to the ground. */
  hangTime: number
  /** Horizontal distance covered in that time, in yards. */
  range: number
  /** Highest point of the arc, in yards. */
  apex: number
  apexTime: number
  /** Degrees below the horizontal as it lands. */
  impactAngle: number
  /** The ball `t` seconds after launch. Past the landing it stays landed. */
  at(t: number): FlightPoint
  /** The whole arc as a polyline, launch to landing. */
  path(steps?: number): Vec2[]
}

/**
 * A drag-free parabola: exact for a ball in a vacuum, and optimistic for one
 * in air. Everything else about the flight — the hang time, the range, the
 * angle it comes down at — is read off that one curve rather than typed in.
 */
export function kickFlight({
  speed = 24,
  angle = 42,
  height = 0,
  gravity = GRAVITY,
}: KickOptions = {}): KickFlight {
  const v = Math.max(0, finite(speed, 24))
  const a = clamp(finite(angle, 42), -85, 89)
  const y0 = Math.max(0, finite(height, 0))
  const g = span(gravity, GRAVITY)
  const vx = v * Math.cos(toRadians(a))
  const vy = v * Math.sin(toRadians(a))
  // y(t) = y0 + vy t − ½gt², solved for the positive root.
  const hangTime = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * y0))) / g
  const apexTime = Math.max(0, vy / g)
  const apex = y0 + (vy > 0 ? (vy * vy) / (2 * g) : 0)
  const landingVy = vy - g * hangTime
  const at = (t: number): FlightPoint => {
    const time = clamp(finite(t, 0), 0, hangTime)
    const nowVy = vy - g * time
    return {
      x: vx * time,
      y: Math.max(0, y0 + vy * time - 0.5 * g * time * time),
      vx,
      vy: nowVy,
      heading: (Math.atan2(nowVy, vx) * 180) / Math.PI,
    }
  }
  return {
    speed: v,
    angle: a,
    height: y0,
    gravity: g,
    hangTime,
    range: vx * hangTime,
    apex,
    apexTime,
    impactAngle: (Math.atan2(-landingVy, vx) * 180) / Math.PI,
    at,
    path(steps = 32) {
      const count = Math.max(2, Math.round(finite(steps, 32)))
      return Array.from({ length: count + 1 }, (_, index) => {
        const point = at((index / count) * hangTime)
        return { x: point.x, y: point.y }
      })
    },
  }
}

/* -------------------------------------------------------------------------- */
/* the wheel launcher                                                          */
/* -------------------------------------------------------------------------- */

export interface LauncherOptions {
  /** Wheel speeds in turns per second, both driving the ball forward. */
  top?: number
  bottom?: number
  wheelRadius?: number
  ballRadius?: number
}

export interface LauncherExit {
  /** Length units per second: the mean of the two contact speeds. */
  speed: number
  /** Turns per second, positive topspin. */
  spin: number
  topSurface: number
  bottomSurface: number
  /** 0 when the wheels are matched, 1 when one is stopped and the other is not. */
  bias: number
}

/**
 * Two counter-rotating wheels squeezing a ball between them. With no slip at
 * either contact the ball's centre leaves at the mean of the two surface
 * speeds and turns at their difference over its own diameter — so matched
 * wheels throw it flat and fast, and a mismatch trades speed for spin. Both
 * numbers come out of the same pair of inputs; neither is decoration.
 */
export function launcherExit({
  top = 30,
  bottom = 30,
  wheelRadius = 5,
  ballRadius = 2.6,
}: LauncherOptions = {}): LauncherExit {
  const r = span(wheelRadius, 5)
  const ball = span(ballRadius, 2.6)
  const topRate = finite(top, 30)
  const bottomRate = finite(bottom, 30)
  const topSurface = 2 * Math.PI * r * topRate
  const bottomSurface = 2 * Math.PI * r * bottomRate
  const fastest = Math.max(Math.abs(topRate), Math.abs(bottomRate))
  return {
    speed: (topSurface + bottomSurface) / 2,
    spin: (topSurface - bottomSurface) / (2 * ball * 2 * Math.PI),
    topSurface,
    bottomSurface,
    bias: fastest < 1e-6 ? 0 : clamp(Math.abs(topRate - bottomRate) / fastest, 0, 1),
  }
}

/* -------------------------------------------------------------------------- */
/* the route tree                                                              */
/* -------------------------------------------------------------------------- */

export type RouteName =
  | "go"
  | "hitch"
  | "slant"
  | "flat"
  | "out"
  | "in"
  | "curl"
  | "comeback"
  | "post"
  | "corner"
  | "wheel"

export const routeNames: readonly RouteName[] = [
  "go",
  "hitch",
  "slant",
  "flat",
  "out",
  "in",
  "curl",
  "comeback",
  "post",
  "corner",
  "wheel",
]

export interface RouteOptions {
  /** How deep the break is, in yards. */
  depth?: number
  /** `1` aligned to the machine's right, `-1` mirrors the whole route. */
  side?: number
  /** Starting offset from the middle, in yards. */
  split?: number
}

/**
 * A route as a polyline in yards. `x` runs toward the sideline the receiver
 * started on, `y` downfield from the line of scrimmage. Outside breaks are
 * positive `x` and inside breaks negative, so mirroring the whole tree is one
 * sign.
 */
export function routePath(route: RouteName, options: RouteOptions = {}): Vec2[] {
  const d = clamp(finite(options.depth, 12), 2, 60)
  const side = finite(options.side, 1) < 0 ? -1 : 1
  const split = finite(options.split, 0)

  const legs: Record<RouteName, Vec2[]> = {
    go: [{ x: 0, y: 0 }, { x: 0, y: d + 6 }],
    hitch: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: 0.6, y: d - 2.4 }],
    slant: [{ x: 0, y: 0 }, { x: 0, y: 2.6 }, { x: -d * 0.72, y: 2.6 + d * 0.72 }],
    flat: [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: d * 0.9, y: 4.4 }],
    out: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: d * 0.6, y: d + 0.6 }],
    in: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: -d * 0.6, y: d + 0.6 }],
    curl: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: -d * 0.2, y: d - 2.4 }],
    comeback: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: d * 0.24, y: d - 3.2 }],
    post: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: -d * 0.66, y: d + d * 0.66 }],
    corner: [{ x: 0, y: 0 }, { x: 0, y: d }, { x: d * 0.58, y: d + d * 0.58 }],
    wheel: [
      { x: 0, y: 0 },
      { x: 0, y: 1.6 },
      { x: d * 0.42, y: 3.6 },
      { x: d * 0.5, y: d + 5 },
    ],
  }

  return (legs[route] ?? legs.go).map((point) => ({
    x: split + point.x * side,
    y: point.y,
  }))
}

/** Total run, in yards. */
export function routeLength(path: readonly Vec2[]): number {
  let total = 0
  for (let index = 1; index < path.length; index += 1) {
    total += Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y)
  }
  return total
}

export interface RouteSample {
  point: Vec2
  /** Degrees, 0 straight downfield, positive turning toward `+x`. */
  heading: number
  /** Which leg of the route is being run. */
  leg: number
  /** 0 at the line of scrimmage, 1 at the end of the route. */
  progress: number
  /** Signed turn being taken here, -1 to 1. */
  turn: number
  /** How hard: the same number without its sign. */
  breaking: number
}

/**
 * Where the runner is after `distance` yards, and what he is doing with his
 * body when he gets there. A break is a corner in the polyline, so `turn` is
 * the exterior angle at the nearest one faded in over the `blend` yards either
 * side of it — which is the lean, without anyone typing a lean.
 */
export function sampleRoute(
  path: readonly Vec2[],
  distance: number,
  blend = 2.4,
): RouteSample {
  const flat: RouteSample = {
    point: path[0] ?? { x: 0, y: 0 },
    heading: 0,
    leg: 0,
    progress: 0,
    turn: 0,
    breaking: 0,
  }
  if (path.length < 2) return flat

  const total = routeLength(path)
  if (total < 1e-6) return flat
  const along = clamp(finite(distance, 0), 0, total)

  let travelled = 0
  let leg = path.length - 2
  let within = 0
  let legLength = 1
  for (let index = 1; index < path.length; index += 1) {
    const step = Math.hypot(
      path[index].x - path[index - 1].x,
      path[index].y - path[index - 1].y,
    )
    if (along <= travelled + step || index === path.length - 1) {
      leg = index - 1
      within = along - travelled
      legLength = Math.max(1e-6, step)
      break
    }
    travelled += step
  }

  const a = path[leg]
  const b = path[leg + 1]
  const t = clamp(within / legLength, 0, 1)
  const headingOf = (from: Vec2, to: Vec2) =>
    (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
  const heading = headingOf(a, b)

  // The nearest corner, and how close we are to it in yards.
  const fade = Math.max(1e-6, finite(blend, 2.4))
  let turn = 0
  const cornerBefore = leg > 0 ? within : Infinity
  const cornerAfter = leg + 2 < path.length ? legLength - within : Infinity
  if (cornerBefore <= cornerAfter && cornerBefore < fade) {
    const delta = angleDelta(headingOf(path[leg - 1], a), heading)
    turn = (delta / 90) * (1 - cornerBefore / fade)
  } else if (cornerAfter < fade) {
    const delta = angleDelta(heading, headingOf(b, path[leg + 2]))
    turn = (delta / 90) * (1 - cornerAfter / fade)
  }
  const bounded = clamp(turn, -1, 1)

  return {
    point: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) },
    heading,
    leg,
    progress: along / total,
    turn: bounded,
    breaking: Math.abs(bounded),
  }
}

/** Shortest signed difference between two headings, in degrees. */
function angleDelta(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

/* -------------------------------------------------------------------------- */
/* stances                                                                     */
/* -------------------------------------------------------------------------- */

export type GridironStance = "three-point" | "two-point" | "upright" | "set"

export interface StanceGeometry {
  stance: GridironStance
  /** Hip height, 0 to 1, ready for `solveSkeleton`. */
  crouch: number
  /**
   * Column pitch from vertical when nothing else decides it. A stance with a
   * hand on the turf ignores this: `stancePitch` works the pitch out instead.
   */
  lean: number
  /** Cycle fraction to freeze the walk at, which is what staggers the feet. */
  step: number
  /** Where the down hand goes in the body frame, or null when both are up. */
  downHand: Vec3 | null
  /** Where the other hand rests. */
  offHand: Vec3
  /** Share of the body on the down hand, 0 when nothing is. */
  handLoad: number
}

/**
 * The four postures the players stand in.
 *
 * The three-point stance is the interesting one, and the two numbers that make
 * it are the crouch and the hand on the turf. The feet are staggered by
 * freezing the walk solver at a cycle fraction where one foot has just landed
 * and the other is still on its toe — a real sample of the gait rather than a
 * second pose table.
 */
export function stanceGeometry(
  stance: GridironStance,
  options: { reach?: number } = {},
): StanceGeometry {
  const reach = clamp(finite(options.reach, 1), 0.5, 1.5)
  switch (stance) {
    case "three-point":
      return {
        stance,
        crouch: 0.14,
        lean: 88,
        step: 0.06,
        downHand: { x: 9, y: 2.5, z: -40 * reach },
        offHand: { x: -13, y: 20, z: -20 },
        handLoad: 0.26,
      }
    case "two-point":
      return {
        stance,
        crouch: 0.44,
        lean: 42,
        step: 0.06,
        downHand: null,
        offHand: { x: -13, y: 40, z: -26 },
        handLoad: 0,
      }
    case "set":
      return {
        stance,
        crouch: 0.66,
        lean: 22,
        step: 0.04,
        downHand: null,
        offHand: { x: -14, y: 62, z: -24 },
        handLoad: 0,
      }
    default:
      return {
        stance: "upright",
        crouch: 1,
        lean: 4,
        step: 0,
        downHand: null,
        offHand: { x: -16, y: 62, z: -8 },
        handLoad: 0,
      }
  }
}

export interface PlayerSpineOptions {
  /** Sacrum, in world space. */
  base: Vec3
  /** Sacrum to the shoulder line. */
  length: number
  segments?: number
  /** Pitch of the column's **chord** from vertical, positive toward the nose. */
  lean: number
  /** Total curvature across the column, in degrees. A back is not a stick. */
  arch?: number
  /** Shoulders against the pelvis, in degrees. */
  twist?: number
}

/**
 * The column this family stands its shoulders on: equal segments swept through
 * a constant curvature, centred so the **chord** comes out at exactly `lean`.
 *
 * `spineCurve` in `skeleton-kinematics` accumulates its pitch down the column
 * instead, which puts the chord at about half the number asked for — correct
 * for a machine standing up, and wrong here, where the interesting fact about
 * a stance is that the back is flat and the shoulders are level with the hips.
 * Making the chord the number is what lets `stancePitch` solve for it.
 */
export function playerSpine({
  base,
  length,
  segments = 7,
  lean,
  arch = 18,
  twist = 0,
}: PlayerSpineOptions): Vec3[] {
  const count = Math.max(2, Math.round(finite(segments, 7)))
  const step = span(length, 56) / count
  const pitch = clamp(finite(lean, 0), -60, 130)
  const bend = clamp(finite(arch, 18), -60, 60)
  const turn = clamp(finite(twist, 0), -70, 70)
  const start: Vec3 = {
    x: finite(base?.x, 0),
    y: finite(base?.y, 0),
    z: finite(base?.z, 0),
  }
  const points: Vec3[] = [start]
  for (let index = 0; index < count; index += 1) {
    const heading = pitch - bend / 2 + (bend * (index + 0.5)) / count
    const yaw = toRadians((turn * (index + 1)) / count)
    const rise = Math.cos(toRadians(heading))
    const run = Math.sin(toRadians(heading))
    const previous = points[index]
    points.push({
      x: previous.x + run * Math.sin(yaw) * step,
      y: previous.y + rise * step,
      z: previous.z - run * Math.cos(yaw) * step,
    })
  }
  return points
}

export interface StancePitchOptions {
  /** Hip joint height above the floor. */
  hipHeight: number
  /** Sacrum to the shoulder line. */
  spine: number
  /** Shoulder to fingertip: humerus plus forearm. */
  arm: number
  /** The hand, already on the turf, in the body frame. */
  hand: Vec3
  /** Half the shoulder span, for the shoulder the hand belongs to. */
  shoulderSpan?: number
  segments?: number
  arch?: number
}

/**
 * The column pitch that puts the shoulder exactly one arm's length from a hand
 * already on the turf — so the flat back of a three-point stance is an output
 * of the hand being down, not a number someone typed.
 *
 * The shoulder swings forward and drops as the column pitches, so the distance
 * to a fixed hand falls monotonically until the shoulder reaches it; that is
 * one crossing, and a bisection finds it. It works on the same `playerSpine`
 * the drawing uses, so the answer is the pitch that is actually drawn rather
 * than one off a simplified column.
 */
export function stancePitch({
  hipHeight,
  spine,
  arm,
  hand,
  shoulderSpan = 0,
  segments = 7,
  arch = 18,
}: StancePitchOptions): number {
  const hip = finite(hipHeight, 60)
  const limb = span(arm, 56)
  const target: Vec3 = {
    x: finite(hand?.x, 0),
    y: finite(hand?.y, 0),
    z: finite(hand?.z, 0),
  }
  const across = finite(shoulderSpan, 0)
  const gap = (degrees: number) => {
    const column = playerSpine({
      base: { x: 0, y: hip, z: 0 },
      length: spine,
      segments,
      lean: degrees,
      arch,
    })
    const shoulder = column[column.length - 1]
    return (
      Math.hypot(shoulder.x + across - target.x, shoulder.y - target.y, shoulder.z - target.z) -
      limb
    )
  }
  if (gap(0) <= 0) return 0
  if (gap(120) > 0) return 120
  let low = 0
  let high = 120
  for (let step = 0; step < 40; step += 1) {
    const mid = (low + high) / 2
    if (gap(mid) > 0) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/* -------------------------------------------------------------------------- */
/* the upper body                                                              */
/* -------------------------------------------------------------------------- */

export interface UpperBodyOptions {
  /** Pelvis in world space; `solveSkeleton` produces it. */
  pelvis: Vec3
  /** Column pitch from vertical, positive toward the nose. */
  lean: number
  /** Shoulders against the pelvis, in degrees. */
  twist?: number
  /** Head pitch relative to the column, positive looking up. */
  gazePitch?: number
  gazeYaw?: number
  /** Total curvature across the column, in degrees. */
  arch?: number
  proportions?: SkeletonProportions
}

export interface UpperBody {
  /** Vertebra centres, sacrum first, shoulder line last. */
  spine: Vec3[]
  shoulders: Vec3
  shoulderYaw: number
  neck: Vec3
  head: Vec3
  /** The head's own axes, so a helmet lays onto it as a solid. */
  nose: Vec3
  up: Vec3
  right: Vec3
}

/**
 * The column and the head for a player, on the same equal-segment spine the
 * skeleton uses — but pitched as far as the stance asks for rather than as far
 * as a standing machine would ever go, and handing back the head's own axes so
 * the helmet can be laid on it instead of drawn beside it.
 */
export function playerUpperBody({
  pelvis,
  lean,
  twist = 0,
  gazePitch = 0,
  gazeYaw = 0,
  arch = 18,
  proportions = defaultProportions,
}: UpperBodyOptions): UpperBody {
  const p = proportions
  const base: Vec3 = {
    x: finite(pelvis?.x, 0),
    y: finite(pelvis?.y, 0),
    z: finite(pelvis?.z, 0),
  }
  const pitch = clamp(finite(lean, 0), -45, 120)
  const turn = clamp(finite(twist, 0), -70, 70)
  const spine = playerSpine({
    base,
    length: p.spine,
    segments: Math.max(2, Math.round(finite(p.vertebrae, 7))),
    lean: pitch,
    arch,
    twist: turn,
  })
  const shoulders = spine[spine.length - 1]
  const below = spine[spine.length - 2]
  // Degrees from straight up, positive toward the nose.
  const heading = (Math.atan2(below.z - shoulders.z, shoulders.y - below.y) * 180) / Math.PI
  const look = heading - clamp(finite(gazePitch, 0), -60, 110)
  const advance = (from: Vec3, degrees: number, distance: number): Vec3 => {
    const a = toRadians(degrees)
    return {
      x: from.x,
      y: from.y + Math.cos(a) * distance,
      z: from.z - Math.sin(a) * distance,
    }
  }
  const neck = advance(shoulders, heading, p.neck)
  const head = advance(neck, look, p.skull * 0.62)
  const up = unit({ x: head.x - neck.x, y: head.y - neck.y, z: head.z - neck.z }, {
    x: 0,
    y: 1,
    z: 0,
  })
  const across = turnAbout(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    -(turn + clamp(finite(gazeYaw, 0), -70, 70)),
  )
  const nose = unit(cross(up, across), { x: 0, y: 0, z: -1 })
  return { spine, shoulders, shoulderYaw: turn, neck, head, nose, up, right: unit(cross(nose, up)) }
}

/* -------------------------------------------------------------------------- */
/* the sled                                                                    */
/* -------------------------------------------------------------------------- */

export interface SledArm {
  /** Pivot to pad centre. */
  arm: number
  /** Return spring rate, torque per radian. */
  stiffness: number
  /** Spring wind-up already in it at rest, in degrees. */
  preload: number
}

export const defaultSledArm: SledArm = { arm: 26, stiffness: 2600, preload: 6 }

/**
 * How far a pad swings back under a load pushing square on it, in degrees.
 *
 * Static equilibrium about the pivot: the load's moment falls off as `cos θ`
 * while the spring's climbs linearly in `θ`, so there is exactly one crossing
 * and a bisection finds it. That is why the last few degrees cost so much more
 * than the first few — the pad is running out of leverage at the same time as
 * the spring is winding up.
 */
export function sledDeflection(load: number, options: Partial<SledArm> = {}): number {
  const geometry: SledArm = {
    arm: span(options.arm, defaultSledArm.arm),
    stiffness: span(options.stiffness, defaultSledArm.stiffness),
    preload: Math.abs(finite(options.preload, defaultSledArm.preload)),
  }
  const force = Math.max(0, finite(load, 0))
  const preload = toRadians(geometry.preload)
  const moment = (theta: number) =>
    force * geometry.arm * Math.cos(theta) - geometry.stiffness * (theta + preload)

  if (moment(0) <= 0) return 0
  let low = 0
  let high = Math.PI / 2
  for (let step = 0; step < 48; step += 1) {
    const mid = (low + high) / 2
    if (moment(mid) > 0) low = mid
    else high = mid
  }
  return ((low + high) / 2) * (180 / Math.PI)
}

export interface SledSlide {
  /** Drive the frame will not move under, in the same units as `drive`. */
  threshold: number
  /** What it accelerates at once it does move. */
  acceleration: number
  sliding: boolean
}

/**
 * The frame itself. Nothing happens at all until the drive beats the static
 * friction under the skids; past that, the surplus is what accelerates it.
 */
export function sledSlide(
  drive: number,
  { weight = 1, friction = 0.62, mass = 1 }: { weight?: number; friction?: number; mass?: number } = {},
): SledSlide {
  const load = Math.max(0, finite(weight, 1))
  const mu = Math.max(0, finite(friction, 0.62))
  const m = span(mass, 1)
  const push = Math.max(0, finite(drive, 0))
  const threshold = mu * load
  return {
    threshold,
    acceleration: Math.max(0, (push - threshold) / m),
    sliding: push > threshold,
  }
}

/* -------------------------------------------------------------------------- */
/* the kit                                                                     */
/* -------------------------------------------------------------------------- */

export type FacemaskStyle = "cage" | "bar" | "shield"

/**
 * The helmet shell in profile, in the head's own sagittal frame: `x` toward
 * the nose, `y` up, origin at the centre of the head. A closed outline, so it
 * extrudes into a solid from any camera.
 *
 * Shared so all four players wear the same shell. It is illustration — nothing
 * about it is solved — and it is the last thing in this file that is not.
 */
export function helmetOutline(radius: number): Vec2[] {
  const r = span(radius, 12)
  const shell: Vec2[] = [
    { x: 0.9, y: 0.26 },
    { x: 0.66, y: 0.78 },
    { x: 0.18, y: 1.0 },
    { x: -0.4, y: 0.88 },
    { x: -0.84, y: 0.46 },
    { x: -0.96, y: -0.04 },
    { x: -0.88, y: -0.46 },
    { x: -0.54, y: -0.72 },
    { x: -0.08, y: -0.8 },
    { x: 0.36, y: -0.74 },
    { x: 0.66, y: -0.54 },
    { x: 0.84, y: -0.22 },
    { x: 0.94, y: 0.02 },
  ]
  return shell.map((point) => ({ x: point.x * r, y: point.y * r }))
}

/** Where the ear hole sits on that shell, same frame. */
export function helmetEar(radius: number): Vec2 {
  const r = span(radius, 12)
  return { x: -0.24 * r, y: -0.18 * r }
}

/** The facemask as bars across the face opening, in the same frame. */
export function facemaskBars(radius: number, style: FacemaskStyle = "cage"): [Vec2, Vec2][] {
  const r = span(radius, 12)
  const at = (x: number, y: number): Vec2 => ({ x: x * r, y: y * r })
  const horizontals: Record<FacemaskStyle, number[]> = {
    cage: [-0.62, -0.34, -0.04],
    bar: [-0.5, -0.12],
    shield: [-0.58],
  }
  const bars: [Vec2, Vec2][] = (horizontals[style] ?? horizontals.cage).map((y) => [
    at(0.52, y * 1.06),
    at(1.12, y * 0.78),
  ])
  if (style === "cage") bars.push([at(1.13, -0.62), at(1.0, 0.06)])
  if (style === "shield") bars.push([at(0.58, 0.02), at(1.14, -0.2)], [at(1.14, -0.2), at(1.1, -0.55)])
  return bars
}

/**
 * The shoulder pad footprint in plan: `x` across the machine, `y` aft. Wide at
 * the shoulders, notched at the neck, and tucked at the back.
 */
export function shoulderYoke(halfSpan: number, depth: number): Vec2[] {
  const half = span(halfSpan, 26)
  const deep = span(depth, 15)
  return [
    { x: 0.16 * half, y: -0.86 * deep },
    { x: 0.62 * half, y: -0.78 * deep },
    { x: 0.95 * half, y: -0.34 * deep },
    { x: 1.0 * half, y: 0.22 * deep },
    { x: 0.82 * half, y: 0.78 * deep },
    { x: 0.3 * half, y: 1.0 * deep },
    { x: -0.3 * half, y: 1.0 * deep },
    { x: -0.82 * half, y: 0.78 * deep },
    { x: -1.0 * half, y: 0.22 * deep },
    { x: -0.95 * half, y: -0.34 * deep },
    { x: -0.62 * half, y: -0.78 * deep },
    { x: -0.16 * half, y: -0.86 * deep },
    { x: -0.13 * half, y: -0.52 * deep },
    { x: 0.13 * half, y: -0.52 * deep },
  ]
}

/** A rounded plate — thigh, knee, chest — as a closed outline about its centre. */
export function padOutline(halfWidth: number, halfHeight: number, steps = 14): Vec2[] {
  const w = span(halfWidth, 6)
  const h = span(halfHeight, 8)
  const count = Math.max(6, Math.round(finite(steps, 14)))
  return Array.from({ length: count }, (_, index) => {
    const a = (index / count) * Math.PI * 2
    // Squared off rather than elliptical: a pad is a plate, not a bubble.
    const c = Math.cos(a)
    const s = Math.sin(a)
    const k = 0.72
    return {
      x: w * Math.sign(c) * Math.abs(c) ** k,
      y: h * Math.sign(s) * Math.abs(s) ** k,
    }
  })
}
