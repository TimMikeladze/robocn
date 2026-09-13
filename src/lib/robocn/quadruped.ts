/** Planar two-link legs and illustrative footfall cycles for a quadruped. */
import { solveChain2, type Vec2 } from "@/lib/robocn/kinematics"

export type QuadrupedGait = "stand" | "walk" | "trot"
export type QuadrupedLegId = "front-left" | "front-right" | "rear-left" | "rear-right"

export interface QuadrupedOptions {
  gait?: QuadrupedGait
  /** Cycle fraction; wraps in either direction. */
  phase?: number
  /** Normalized body height, stride length, and foot lift, each clamped to 0–1. */
  height?: number
  stride?: number
  lift?: number
}

export interface QuadrupedLeg {
  id: QuadrupedLegId
  side: "left" | "right"
  hip: Vec2
  knee: Vec2
  foot: Vec2
  /** Whether the solved foot is on the ground plane (y = 0). */
  contact: boolean
}

export interface QuadrupedPose {
  gait: QuadrupedGait
  /** Hip height in world units, 36–54. */
  height: number
  legs: QuadrupedLeg[]
}

const unit = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
const wrap = (value: number) => Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0
const ids: QuadrupedLegId[] = ["front-left", "front-right", "rear-left", "rear-right"]

/**
 * Each leg solves in its own sagittal plane. x points toward the front, y up.
 * Links are 30 and 28 units; bounded controls keep every requested foot reachable.
 * Walk uses staggered quarter-cycle swings; trot moves diagonal pairs together.
 * This computes poses, not body balance, dynamics, or terrain contact forces.
 */
export function solveQuadruped({ gait = "stand", phase = 0, height = 0.5, stride = 0.6, lift = 0.5 }: QuadrupedOptions = {}): QuadrupedPose {
  const hipHeight = 36 + 18 * unit(height, 0.5)
  const reach = 12 * unit(stride, 0.6)
  const clearance = 14 * unit(lift, 0.5)
  const cycle = wrap(phase)
  const offsets = gait === "trot" ? [0, 0.5, 0.5, 0] : [0, 0.5, 0.75, 0.25]
  const duty = gait === "trot" ? 0.5 : 0.75

  const legs = ids.map((id, index): QuadrupedLeg => {
    const front = index < 2
    const hip = { x: front ? 28 : -28, y: hipHeight }
    const t = wrap(cycle + offsets[index])
    let x = 0
    let y = 0
    if (gait !== "stand") {
      if (t < duty) {
        x = reach * (1 - 2 * t / duty)
      } else {
        const swing = (t - duty) / (1 - duty)
        x = -reach * Math.cos(Math.PI * swing)
        y = clearance * Math.sin(Math.PI * swing)
      }
    }
    const [root, knee, foot] = solveChain2(hip, { x: hip.x + x, y }, [30, 28], { bend: front ? "down" : "up" })
    return { id, side: index % 2 === 0 ? "left" : "right", hip: root, knee, foot, contact: foot.y < 1e-7 }
  })
  return { gait, height: hipHeight, legs }
}
