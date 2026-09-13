/**
 * Geometry and ideal phase relationships shared by the electromagnetic
 * machines. This module deliberately contains no React and no field, force,
 * torque, thermal, or circuit simulation.
 */

import type { Vec3 } from "@/lib/robocn/kinematics"

export interface CoilWindingOptions {
  turns: number
  length: number
  radius: number
  samplesPerTurn?: number
  center?: Vec3
  axis?: "x" | "y" | "z"
}

export interface ThreePhaseField {
  phases: [number, number, number]
  /** Mechanical field angle in degrees, wrapped to 0..360. */
  angle: number
  /** Magnitude of the balanced two-dimensional resultant. */
  magnitude: number
}

export interface ResolverSignals {
  sine: number
  cosine: number
}

const finite = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback

const boundedInteger = (value: number, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(finite(value, fallback))))

const wrapped = (value: number, period: number) => {
  const safe = finite(value, 0)
  return ((safe % period) + period) % period
}

/** Sample a fixed-envelope helical winding along one world-space axis. */
export function coilWinding(options: CoilWindingOptions): Vec3[] {
  const turns = boundedInteger(options.turns, 4, 1, 64)
  const samplesPerTurn = boundedInteger(options.samplesPerTurn ?? 8, 8, 2, 64)
  const samples = turns * samplesPerTurn
  const length = Math.abs(finite(options.length, 20))
  const radius = Math.abs(finite(options.radius, 5))
  const supplied = options.center ?? { x: 0, y: 0, z: 0 }
  const center = {
    x: finite(supplied.x, 0),
    y: finite(supplied.y, 0),
    z: finite(supplied.z, 0),
  }
  const axis = options.axis ?? "x"

  return Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples
    // Reuse zero at the seam so the two endpoints are byte-stable instead of
    // exposing Math.sin/cos drift at an integer number of turns.
    const turnPhase = index === samples ? 0 : progress * turns * Math.PI * 2
    const axial = (progress - 0.5) * length
    const radialA = Math.cos(turnPhase) * radius
    const radialB = Math.sin(turnPhase) * radius
    if (axis === "y") {
      return { x: center.x + radialA, y: center.y + axial, z: center.z + radialB }
    }
    if (axis === "z") {
      return { x: center.x + radialA, y: center.y + radialB, z: center.z + axial }
    }
    return { x: center.x + axial, y: center.y + radialA, z: center.z + radialB }
  })
}

/**
 * Sum an ideal balanced three-phase stator. `phase` is an electrical cycle;
 * `poles` converts the electrical result to mechanical angle.
 */
export function threePhaseField(phase: number, poles = 2): ThreePhaseField {
  const electrical = wrapped(phase, 1) * Math.PI * 2
  const axes = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3] as const
  const phases = axes.map((axis) => Math.cos(electrical - axis)) as [number, number, number]
  const x = phases.reduce((sum, amplitude, index) => sum + amplitude * Math.cos(axes[index]), 0)
  const y = phases.reduce((sum, amplitude, index) => sum + amplitude * Math.sin(axes[index]), 0)
  const poleCount = boundedInteger(poles, 2, 2, 64)
  const polePairs = poleCount / 2
  const electricalAngle = wrapped((Math.atan2(y, x) * 180) / Math.PI, 360)

  return {
    phases,
    angle: electricalAngle / polePairs,
    magnitude: Math.hypot(x, y),
  }
}

/** Ideal sine and cosine secondary channels from a rotary transformer. */
export function resolverSignals(angle: number, excitation = 1): ResolverSignals {
  const radians = (wrapped(angle, 360) * Math.PI) / 180
  const drive = Math.min(1, Math.max(-1, finite(excitation, 1)))
  const sine = Math.sin(radians) * drive
  const cosine = Math.cos(radians) * drive
  return {
    sine: Math.abs(sine) < 1e-12 ? 0 : sine,
    cosine: Math.abs(cosine) < 1e-12 ? 0 : cosine,
  }
}
