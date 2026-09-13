/** Closed-form inverse kinematics for a six-legged Stewart platform. */
import { distance3, toRadians, type Vec3 } from "@/lib/robocn/kinematics"

export interface StewartGeometry {
  /** Anchor ring radius on the fixed base and on the moving platform. */
  baseRadius: number
  platformRadius: number
  /** Angle between the two anchors of a pair, in degrees. */
  baseSpread: number
  platformSpread: number
  /** Platform height above the base at rest. */
  height: number
  /** How far a leg may grow or shrink from its home length before it faults. */
  travel: number
}

/** Proportions of a desk-scale head platform, in world units. */
export const defaultStewartGeometry: StewartGeometry = {
  baseRadius: 22,
  platformRadius: 17,
  baseSpread: 44,
  platformSpread: 34,
  height: 30,
  travel: 9,
}

export interface StewartPose {
  /** Translations in world units: sway is +x, heave is +y, surge is +z toward the viewer. */
  sway?: number
  heave?: number
  surge?: number
  /** Degrees. Roll about z, pitch about x, yaw about y. */
  roll?: number
  pitch?: number
  yaw?: number
}

export interface StewartLeg {
  id: number
  /** Anchor on the fixed base. */
  base: Vec3
  /** Anchor on the moving platform, already posed. */
  platform: Vec3
  length: number
  /** Change from the home length; positive extends. */
  stroke: number
  withinLimits: boolean
}

export interface StewartSolution {
  legs: StewartLeg[]
  /** Platform centre after the pose is applied. */
  center: Vec3
  /** Leg length with the platform at rest. */
  homeLength: number
  /** False when any leg is asked for more stroke than it has. */
  reachable: boolean
}

const finite = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/**
 * Anchors sit in three pairs 120° apart on each ring. Both rings use the same
 * three bearings, and each leg crosses to the far anchor of its pair — the X
 * that gives a hexapod its silhouette and its stiffness.
 */
function ring(radius: number, spread: number, index: number): Vec3 {
  const pair = Math.floor(index / 2)
  const side = index % 2 === 0 ? -1 : 1
  const angle = toRadians(pair * 120 + side * spread / 2)
  return { x: radius * Math.sin(angle), y: 0, z: radius * Math.cos(angle) }
}

/**
 * Rotate then translate each platform anchor and measure back to its base
 * anchor: that distance is the leg length. No iteration, no ambiguity — a
 * parallel machine's IK is the easy direction.
 *
 * Rotations apply yaw about y, then pitch about x, then roll about z. `y` is up
 * and `z` points at the viewer, so a positive pitch tips the platform nose-down.
 */
export function solveStewart(
  pose: StewartPose = {},
  geometry: StewartGeometry = defaultStewartGeometry,
): StewartSolution {
  const { baseRadius, platformRadius, baseSpread, platformSpread, height, travel } = geometry
  const sway = finite(pose.sway)
  const heave = finite(pose.heave)
  const surge = finite(pose.surge)
  const roll = toRadians(finite(pose.roll))
  const pitch = toRadians(finite(pose.pitch))
  const yaw = toRadians(finite(pose.yaw))
  const center: Vec3 = { x: sway, y: height + heave, z: surge }

  // Symmetric by construction, so one leg's rest length is every leg's.
  const homeLength = distance3(
    ring(baseRadius, baseSpread, 0),
    { ...ring(platformRadius, platformSpread, 1), y: height },
  )

  let reachable = true
  const legs = Array.from({ length: 6 }, (_, id): StewartLeg => {
    const base = ring(baseRadius, baseSpread, id)
    // `id ^ 1` is the other anchor of the pair: the leg crosses to it.
    const local = ring(platformRadius, platformSpread, id ^ 1)
    const turned = rotate(local, roll, pitch, yaw)
    const platform: Vec3 = {
      x: center.x + turned.x,
      y: center.y + turned.y,
      z: center.z + turned.z,
    }
    const length = distance3(base, platform)
    const stroke = length - homeLength
    const withinLimits = Math.abs(stroke) <= travel + 1e-9
    if (!withinLimits) reachable = false
    return { id, base, platform, length, stroke, withinLimits }
  })

  return { legs, center, homeLength, reachable }
}

function rotate(v: Vec3, roll: number, pitch: number, yaw: number): Vec3 {
  // Roll about z.
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  const r = { x: v.x * cr - v.y * sr, y: v.x * sr + v.y * cr, z: v.z }
  // Pitch about x.
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const p = { x: r.x, y: r.y * cp - r.z * sp, z: r.y * sp + r.z * cp }
  // Yaw about y.
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  return { x: p.x * cy + p.z * sy, y: p.y, z: -p.x * sy + p.z * cy }
}
