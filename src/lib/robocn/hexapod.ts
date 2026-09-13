/** Radial many-legged walking: plan-view feet, knees solved in each leg's own vertical plane. */
import { clamp, solveChain2, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

export type HexapodGait = "stand" | "tripod" | "wave" | "ripple"
export type HexapodSide = "left" | "right"

export interface HexapodOptions {
  /** Legs on the body, rounded to an even number and clamped 4–10. */
  legs?: number
  gait?: HexapodGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Normalized body clearance, foot travel, and swing height, each 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** Travel direction in degrees: 0 walks toward the nose, 90 to starboard. */
  heading?: number
  /** Plan-view radius of the carapace the hips are mounted on. */
  radius?: number
  /** How far around the body the hips spread, in degrees. */
  fan?: number
  /**
   * How far out the feet plant, as a fraction of the leg's reach. Capped so a
   * full stride still lands within reach.
   */
  spread?: number
  /** Segment lengths in world units. */
  femur?: number
  tibia?: number
}

export interface HexapodLeg {
  /** Index around the body, front to back down the right side, then the left. */
  id: number
  side: HexapodSide
  /** Plan-view positions: x starboard, y toward the nose. */
  hip: Vec2
  knee: Vec2
  foot: Vec2
  /** Height of the knee above the ground, in world units. */
  kneeHeight: number
  /** Height of the foot above the ground; zero while it carries weight. */
  clearance: number
  contact: boolean
  /** Direction the leg points out of the body, in degrees CCW from starboard. */
  bearing: number
}

export interface HexapodPose {
  gait: HexapodGait
  /** Body height above the ground in world units, 8–30. */
  height: number
  legs: HexapodLeg[]
  femur: number
  tibia: number
}

const unit = (value: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, 0, 1) : fallback
const wrap = (value: number) => (Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0)
const finite = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback

/**
 * Hips sit on the carapace edge at fanned bearings, half to a side. Each foot
 * has a nominal stance point out along its bearing; the gait slides that point
 * along the travel direction — backwards while it carries weight, arcing
 * forward with ground clearance while it swings.
 *
 * The knee is solved rather than drawn: each leg is a two-link chain in its own
 * vertical plane, horizontal distance from hip to foot on one axis and body
 * height on the other, so femur and tibia hold their lengths in every pose. The
 * pose reports the knee's plan position and its height, and the drawing raises
 * it.
 *
 * `heading` is the whole difference between a spider and a crab. These are
 * illustrative trajectories: no balance, no ground reaction, and the body
 * itself never moves — the feet do.
 */
export function solveHexapod({
  legs = 8,
  gait = "stand",
  phase = 0,
  height = 0.5,
  stride = 0.6,
  lift = 0.5,
  heading = 0,
  radius = 16,
  fan = 150,
  spread = 0.78,
  femur = 22,
  tibia = 26,
}: HexapodOptions = {}): HexapodPose {
  const perSide = Number.isFinite(legs) ? Math.max(2, Math.round(clamp(legs, 4, 10) / 2)) : 4
  const upper = finite(femur, 22, 6, 200)
  const lower = finite(tibia, 26, 6, 200)
  const body = 8 + 22 * unit(height, 0.5)
  const hub = finite(radius, 16, 2, 200)
  const arc = finite(fan, 150, 20, 320)
  const travel = 10 * unit(stride, 0.6)
  // Stance is pulled in far enough that a full stride still lands inside the
  // leg's reach, so no foot the gait asks for is ever out of range.
  const room = planarReach(upper + lower, body)
  const reach = Math.min(finite(spread, 0.78, 0.3, 1) * room, Math.max(4, room - travel))
  const clearance = 11 * unit(lift, 0.5)
  const course = Number.isFinite(heading) ? toRadians(heading) : 0
  // Plan view is x starboard, y toward the nose, so a heading of zero walks
  // along +y and 90° along +x.
  const forward: Vec2 = { x: Math.sin(course), y: Math.cos(course) }
  const cycle = wrap(phase)
  const duty = gait === "wave" ? 1 - 1 / (perSide * 2) : gait === "ripple" ? 0.65 : 0.5

  const legsOut: HexapodLeg[] = []
  for (let index = 0; index < perSide * 2; index += 1) {
    const side: HexapodSide = index < perSide ? "right" : "left"
    const rank = index % perSide
    // Bearings fan front to back about the lateral axis, then mirror to port.
    const offsetFromSide = arc / 2 - (rank * arc) / (perSide - 1)
    const bearing = side === "right" ? offsetFromSide : 180 - offsetFromSide
    const direction = toRadians(bearing)
    const out: Vec2 = { x: Math.cos(direction), y: Math.sin(direction) }
    const hip: Vec2 = { x: out.x * hub, y: out.y * hub }
    const stance: Vec2 = { x: hip.x + out.x * reach, y: hip.y + out.y * reach }

    const t = wrap(cycle + gaitOffset(gait, side, rank, perSide))
    let along = 0
    let raise = 0
    if (gait !== "stand") {
      if (t < duty) {
        along = travel * (1 - (2 * t) / duty)
      } else {
        const swing = (t - duty) / (1 - duty)
        along = -travel * Math.cos(Math.PI * swing)
        raise = clearance * Math.sin(Math.PI * swing)
      }
    }
    const foot: Vec2 = {
      x: stance.x + forward.x * along,
      y: stance.y + forward.y * along,
    }

    // Solve in the leg's vertical plane: reach out on one axis, up on the other.
    const span = Math.hypot(foot.x - hip.x, foot.y - hip.y)
    const [, knee] = solveChain2(
      { x: 0, y: body },
      { x: span, y: raise },
      [upper, lower],
      { bend: "up" },
    )
    const kneeOut = span < 1e-9 ? out : { x: (foot.x - hip.x) / span, y: (foot.y - hip.y) / span }

    legsOut.push({
      id: index,
      side,
      hip,
      knee: { x: hip.x + kneeOut.x * knee.x, y: hip.y + kneeOut.y * knee.x },
      foot,
      kneeHeight: knee.y,
      clearance: raise,
      contact: raise < 1e-7,
      bearing,
    })
  }

  return { gait, height: body, legs: legsOut, femur: upper, tibia: lower }
}

/** Where in the cycle a leg swings: the pattern is the gait. */
function gaitOffset(gait: HexapodGait, side: HexapodSide, rank: number, perSide: number) {
  switch (gait) {
    // Alternate legs swing together, so half the body is always planted.
    case "tripod":
      return ((rank + (side === "left" ? 1 : 0)) % 2) * 0.5
    // One leg at a time, back to front down one side and then the other.
    case "wave":
      return (rank + (side === "left" ? perSide : 0)) / (perSide * 2)
    // A delay running down each side, both sides half a cycle apart.
    case "ripple":
      return (rank / perSide) * 0.5 + (side === "left" ? 0.5 : 0)
    default:
      return 0
  }
}

/** How far out a leg can plant while the hip carries the body at `height`. */
function planarReach(span: number, height: number) {
  return Math.sqrt(Math.max(1, span * span - height * height))
}
