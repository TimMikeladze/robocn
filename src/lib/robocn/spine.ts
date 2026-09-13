/** A serpenoid travelling-wave body: the spine a fish swims with and a snake crawls on. */
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

export interface SpineOptions {
  /** Links in the body; the pose returns one more joint than this. Clamped 3–24. */
  segments?: number
  /** Nose-to-tail contour length in world units. */
  length?: number
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Peak body swing, 0–1, where 1 is 52° off the axis. */
  amplitude?: number
  /** Wave crests along the body, clamped 0.25–3. */
  waves?: number
  /** Amplitude envelope: 1 piles the swing at the tail, −1 at the head, 0 spreads it evenly. */
  taper?: number
  /** Steady turn, −1..1, as a constant curvature over the body. 1 is a half circle. */
  turn?: number
  /** Peak ground clearance, 0–1, on the half of the wave that is lifted. */
  lift?: number
}

export interface SpineJoint {
  position: Vec2
  /**
   * Heading of the body at this joint, in degrees, 0 pointing along the nose
   * axis. Rotate artwork — a head, a fin, a scale plate — by this.
   */
  angle: number
  /** Distance along the body, 0 at the nose and 1 at the tail. */
  s: number
  /** Height above the ground plane in world units. */
  clearance: number
  contact: boolean
}

export interface SpinePose {
  joints: SpineJoint[]
  /** Length of one link; every link is the same. */
  link: number
  head: SpineJoint
  tail: SpineJoint
}

/** Body swing at `amplitude` 1, and the clearance at `lift` 1, in degrees and world units. */
export const spineLimits = { swing: 52, turn: 180, clearance: 7 } as const

const unit = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : fallback
const signed = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, -1, 1) : fallback
const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)

/**
 * The body's tangent angle is a travelling sine along its own length —
 *
 *     θ(s) = amplitude · env(s) · cos(2π(waves · s − phase)) + turn · s
 *
 * — and the joints are walked off that angle from the nose backwards, one fixed
 * link at a time. Integrating the angle rather than displacing joints is what
 * keeps every link exactly the same length at every phase, and a crest travels
 * head to tail as `phase` rises, the way it does on a swimming fish.
 *
 * The nose sits at the origin pointing along +x, and the body runs back toward
 * −x. These are illustrative trajectories: no thrust, no drag, no balance.
 */
export function solveSpine({
  segments = 12,
  length = 120,
  phase = 0,
  amplitude = 0.6,
  waves = 1,
  taper = 0,
  turn = 0,
  lift = 0,
}: SpineOptions = {}): SpinePose {
  const count = Number.isFinite(segments) ? Math.round(clamp(segments, 3, 24)) : 12
  const span = Number.isFinite(length) ? clamp(length, 10, 1000) : 120
  const swing = spineLimits.swing * unit(amplitude, 0.6)
  const crests = Number.isFinite(waves) ? clamp(waves, 0.25, 3) : 1
  const bias = signed(taper, 0)
  const arc = spineLimits.turn * signed(turn, 0)
  const clearance = spineLimits.clearance * unit(lift, 0)
  const cycle = wrap(phase)
  const link = span / count

  const joints: SpineJoint[] = []
  let cursor: Vec2 = { x: 0, y: 0 }
  for (let index = 0; index <= count; index += 1) {
    const s = index / count
    const wave = 2 * Math.PI * (crests * s - cycle)
    const angle = swing * envelope(s, bias) * Math.cos(wave) + arc * s
    // Lifted where the wave is swinging one way, planted where it swings the
    // other: sidewinding, and flat on the floor when `lift` is zero.
    const height = clearance * Math.max(0, Math.sin(wave))
    joints.push({
      position: cursor,
      angle,
      s,
      clearance: height,
      contact: height < 1e-7,
    })
    // Tailwards is the nose heading turned around, so the body trails behind.
    const heading = toRadians(angle + 180)
    cursor = {
      x: cursor.x + Math.cos(heading) * link,
      y: cursor.y + Math.sin(heading) * link,
    }
  }

  return { joints, link, head: joints[0], tail: joints[joints.length - 1] }
}

/** Where the swing is spent: `bias` 1 all at the tail, −1 all at the head. */
function envelope(s: number, bias: number) {
  return bias >= 0 ? 1 - bias + bias * s : 1 + bias - bias * (1 - s)
}

/**
 * The outline of a body drawn on a spine: the joints offset either side by
 * `halfWidth(s)`, closed into one path. The silhouette is then the solver's
 * output rather than artwork that has to be kept in step with it.
 */
export function spineOutline(
  pose: SpinePose,
  halfWidth: (s: number) => number,
  round = 2,
): string {
  const left: Vec2[] = []
  const right: Vec2[] = []
  for (const joint of pose.joints) {
    const normal = toRadians(joint.angle + 90)
    const width = Math.max(0, halfWidth(joint.s))
    const offset = { x: Math.cos(normal) * width, y: Math.sin(normal) * width }
    left.push({ x: joint.position.x + offset.x, y: joint.position.y + offset.y })
    right.push({ x: joint.position.x - offset.x, y: joint.position.y - offset.y })
  }
  const fix = (value: number) => Number(value.toFixed(round))
  const forward = left.map((p, i) => `${i ? "L" : "M"} ${fix(p.x)} ${fix(p.y)}`)
  const back = right.reverse().map((p) => `L ${fix(p.x)} ${fix(p.y)}`)
  return [...forward, ...back, "Z"].join(" ")
}
