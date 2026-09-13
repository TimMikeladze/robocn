/** Planar biped legs, a footfall cycle, and an S-curve neck for a duck robot. */
import { solveChain2, type Vec2 } from "@/lib/robocn/kinematics"

export type DuckGait = "stand" | "walk" | "strut"
export type DuckLegId = "left" | "right"

export interface DuckOptions {
  gait?: DuckGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Normalized pelvis height, stride length, and foot lift, each clamped to 0–1. */
  height?: number
  stride?: number
  lift?: number
  /** −1 pecking at the floor, 0 level, 1 craning upward. */
  gaze?: number
  /** Normalized beak opening, 0 shut and 1 wide. */
  beak?: number
}

export interface DuckLeg {
  id: DuckLegId
  hip: Vec2
  knee: Vec2
  /** Where the shank meets the foot plate. */
  ankle: Vec2
  /** Whether the foot plate is down on the ground plane. */
  contact: boolean
}

export interface DuckHead {
  /** Base of the skull, the last neck joint. */
  pivot: Vec2
  /** Skull rotation in degrees, counter-clockwise, 0 with the beak level. */
  angle: number
  /** Lower mandible opening in degrees. */
  beak: number
}

export interface DuckPose {
  gait: DuckGait
  /** Pelvis height in world units, 24–54. */
  height: number
  /** Body pitch in degrees; positive leans the chest forward. */
  lean: number
  pelvis: Vec2
  legs: DuckLeg[]
  /** Four joints from shoulder to skull base. */
  neck: Vec2[]
  head: DuckHead
}

/** Thigh, shank, and the three neck segments, in world units. */
export const duckLinks = { thigh: 26, shank: 28, neck: [13, 13, 11] as const }
/** Ankle height with the foot plate flat on the ground. */
export const duckAnkleHeight = 9

const unit = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
const signed = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : fallback
const wrap = (value: number) => Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0
const ids: DuckLegId[] = ["left", "right"]

/**
 * Legs solve in the sagittal plane: x points forward, y up, origin on the ground
 * between the feet. Knees break rearward, the way a bird's do. Walk keeps a
 * double-support window; strut trades it for a longer swing. The neck is a
 * three-link chain to an anchor swung on a constant radius by `gaze`, so craning
 * up and pecking down cost the same extension.
 *
 * These are illustrative trajectories, not a balance or dynamics model.
 */
export function solveDuck({
  gait = "stand", phase = 0, height = 0.55, stride = 0.6, lift = 0.5, gaze = 0, beak = 0,
}: DuckOptions = {}): DuckPose {
  const hipHeight = 24 + 30 * unit(height, 0.55)
  const reach = 14 * unit(stride, 0.6)
  const clearance = 16 * unit(lift, 0.5)
  const aim = signed(gaze, 0)
  const cycle = wrap(phase)
  const moving = gait !== "stand"
  const duty = gait === "strut" ? 0.52 : 0.62

  // Two steps per cycle, so the pelvis bobs at twice the cycle rate.
  const bob = moving ? -1.8 * Math.cos(4 * Math.PI * cycle) * (0.4 + 0.6 * unit(stride, 0.6)) : 0
  const pelvis: Vec2 = { x: 0, y: hipHeight + bob }
  const lean = moving ? 6 + 6 * unit(stride, 0.6) : 2

  const legs = ids.map((id, index): DuckLeg => {
    const t = wrap(cycle + index * 0.5)
    let x = 0
    let y = 0
    if (moving) {
      if (t < duty) {
        x = reach * (1 - 2 * t / duty)
      } else {
        const swing = (t - duty) / (1 - duty)
        x = -reach * Math.cos(Math.PI * swing)
        y = clearance * Math.sin(Math.PI * swing)
      }
    }
    const [hip, knee, ankle] = solveChain2(
      pelvis,
      { x, y: duckAnkleHeight + y },
      [duckLinks.thigh, duckLinks.shank],
      { bend: "down" },
    )
    return { id, hip, knee, ankle, contact: ankle.y - duckAnkleHeight < 1e-7 }
  })

  // Shoulder sits at the top front of the body, carried by the body's lean.
  const tilt = -lean * Math.PI / 180
  const shoulder = rotateAbout({ x: 10, y: 30 }, tilt, pelvis)
  // Constant radius, swung forward to peck and back to crane upward, plus a
  // fore/aft bob — the head motion that makes a walking bird read as a bird.
  const swung = (33 - 27 * aim + (moving ? 7 * Math.sin(2 * Math.PI * cycle) : 0)) * Math.PI / 180
  const anchor: Vec2 = {
    x: shoulder.x + 31 * Math.sin(swung),
    y: shoulder.y + 31 * Math.cos(swung),
  }
  const neck = solveChain2(shoulder, anchor, [...duckLinks.neck], { bend: "up" })
  const last = neck[neck.length - 1]
  const open = 34 * unit(beak, 0)

  return {
    gait,
    height: hipHeight,
    lean,
    pelvis,
    legs,
    neck,
    // The skull is its own servo rather than a passive end of the chain: level
    // at gaze 0, tipped by gaze, and lifted a little as the beak opens.
    head: { pivot: last, angle: 26 * aim - 3 + open * 0.3, beak: open },
  }
}

function rotateAbout(point: Vec2, radians: number, origin: Vec2): Vec2 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return {
    x: origin.x + point.x * c - point.y * s,
    y: origin.y + point.x * s + point.y * c,
  }
}
