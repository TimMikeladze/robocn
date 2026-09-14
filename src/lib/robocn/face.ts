/**
 * robocn — the animatronic face rig.
 *
 * A real expressive head is not a set of drawings; it is a set of servos. This
 * file is that rig: ten channels, six of them paired left and right, an
 * expression library that names a target for each one, and a solve that mixes
 * intensity, gaze, blink and speech into the vector the drawing reads. Nothing
 * downstream ever branches on an expression name.
 *
 * The second half is the head's geometry. The skull is an ellipsoid, and under
 * an orthographic camera an ellipsoid's silhouette is *exactly* an ellipse — so
 * one `<ellipse>` is correct in every view and under any neck rotation, with no
 * hand-faked artwork per angle. Features live on that same surface.
 *
 * No React, no DOM, no dependencies beyond the shared kinematics and camera.
 */

import { clamp, toDegrees, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import type { RobotCamera } from "@/lib/robocn/style"

const finite = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

/** Channels that have a servo on each side of the face. */
export interface FaceSide {
  /** Inner brow tip. Down is anger, up is sorrow. */
  browInner: number
  /** Outer brow tip. Up is surprise. */
  browOuter: number
  /** Upper lid: −1 retracted wide, 0 open, 1 shut. */
  lidUpper: number
  /** Lower lid raising — the squint that makes a smile read. */
  lidLower: number
  /** Cheek plate lift. */
  cheek: number
  /** Mouth corner. Down is sorrow, up is joy. */
  lipCorner: number
}

/** Channels with a single servo on the centreline. */
export interface FaceCenter {
  /** Nose bridge shortening. */
  noseWrinkle: number
  /** Lips slack (−1) to pressed thin (+1). */
  lipPress: number
  /** Mouth rounding. */
  lipPucker: number
  /** Jaw plate hinging open. */
  jaw: number
}

export interface FaceChannels extends FaceCenter {
  left: FaceSide
  right: FaceSide
}

export type FaceExpression =
  | "neutral"
  | "joy"
  | "surprise"
  | "sorrow"
  | "anger"
  | "fear"
  | "disgust"
  | "doubt"
  | "sleep"

export const faceExpressions: readonly FaceExpression[] = [
  "neutral",
  "joy",
  "surprise",
  "sorrow",
  "anger",
  "fear",
  "disgust",
  "doubt",
  "sleep",
]

const rest: FaceSide = {
  browInner: 0,
  browOuter: 0,
  lidUpper: 0,
  lidLower: 0,
  cheek: 0,
  lipCorner: 0,
}

const still: FaceCenter = { noseWrinkle: 0, lipPress: 0, lipPucker: 0, jaw: 0 }

/**
 * One expression: the target for a side, the target for the centreline, and —
 * only where the face is genuinely lopsided — what the left side does instead.
 * Everything is written at full intensity; `solveFace` scales it.
 */
interface FaceShapeSpec {
  side: Partial<FaceSide>
  center?: Partial<FaceCenter>
  /** Overrides for the left side alone. Asymmetry is a servo, not a redraw. */
  left?: Partial<FaceSide>
}

const shapes: Record<FaceExpression, FaceShapeSpec> = {
  neutral: { side: {} },
  // Duchenne: the lower lid and the cheek are what stop a smile reading as a
  // grimace, so both are driven alongside the corner.
  joy: {
    side: { lipCorner: 0.9, lidLower: 0.55, cheek: 0.75, browOuter: 0.12 },
    center: { jaw: 0.18, lipPress: -0.25 },
  },
  surprise: {
    side: { browInner: 0.85, browOuter: 1, lidUpper: -0.35 },
    center: { jaw: 0.62, lipPucker: 0.2 },
  },
  sorrow: {
    side: { browInner: 0.85, browOuter: -0.3, lipCorner: -0.7, lidUpper: 0.3 },
    center: { lipPress: 0.3 },
  },
  anger: {
    side: { browInner: -0.95, browOuter: -0.35, lidLower: 0.5, lipCorner: -0.3 },
    center: { lipPress: 0.85, noseWrinkle: 0.35 },
  },
  fear: {
    side: { browInner: 0.9, browOuter: 0.55, lidUpper: -0.5, lidLower: 0.25 },
    center: { jaw: 0.4, lipPress: -0.4 },
  },
  disgust: {
    side: { browInner: -0.4, lidLower: 0.6, cheek: 0.5, lipCorner: -0.15 },
    center: { noseWrinkle: 0.95, lipPress: 0.4 },
  },
  // The lopsided one, and the reason the rig is paired at all.
  doubt: {
    side: { browOuter: 0.85, browInner: 0.35, lidLower: 0.15 },
    left: { browOuter: -0.2, browInner: -0.15, lidUpper: 0.25, lidLower: 0.45 },
    center: { lipPress: 0.35, lipPucker: 0.3 },
  },
  sleep: {
    side: { lidUpper: 1, browInner: 0.1, browOuter: -0.15 },
    center: { jaw: 0.12, lipPress: -0.2 },
  },
}

const side = (partial: Partial<FaceSide> | undefined): FaceSide => ({ ...rest, ...partial })

/** The full-intensity channel vector for an expression. */
export function faceShape(expression: FaceExpression): FaceChannels {
  const spec = shapes[expression] ?? shapes.neutral
  const right = side(spec.side)
  return {
    ...still,
    ...spec.center,
    right,
    left: spec.left ? { ...right, ...spec.left } : { ...right },
  }
}

const mixSide = (a: FaceSide, b: FaceSide, t: number): FaceSide => ({
  browInner: a.browInner + (b.browInner - a.browInner) * t,
  browOuter: a.browOuter + (b.browOuter - a.browOuter) * t,
  lidUpper: a.lidUpper + (b.lidUpper - a.lidUpper) * t,
  lidLower: a.lidLower + (b.lidLower - a.lidLower) * t,
  cheek: a.cheek + (b.cheek - a.cheek) * t,
  lipCorner: a.lipCorner + (b.lipCorner - a.lipCorner) * t,
})

/** Channel-by-channel mix of two shapes. `t` 0 is `a`, 1 is `b`. */
export function blendFace(a: FaceChannels, b: FaceChannels, t: number): FaceChannels {
  const mix = clamp(finite(t), 0, 1)
  const lerp = (x: number, y: number) => x + (y - x) * mix
  return {
    left: mixSide(a.left, b.left, mix),
    right: mixSide(a.right, b.right, mix),
    noseWrinkle: lerp(a.noseWrinkle, b.noseWrinkle),
    lipPress: lerp(a.lipPress, b.lipPress),
    lipPucker: lerp(a.lipPucker, b.lipPucker),
    jaw: lerp(a.jaw, b.jaw),
  }
}

export interface FaceActuator {
  /** `left.browInner`, `jaw`, and so on — the servo's name on the rig. */
  id: string
  /** The channel value it was asked to hold, after clamping. */
  value: number
  /** Stroke in world units. */
  stroke: number
  travel: number
  withinLimits: boolean
}

export interface HeadGeometry {
  /** Skull half-axes: across, up, and front to back. */
  radii: Vec3
  /** Servo stroke at full channel deflection, in world units. */
  gain: number
  /** Stroke the servos actually have. */
  travel: number
}

export const defaultHeadGeometry: HeadGeometry = {
  radii: { x: 34, y: 43, z: 38 },
  gain: 6,
  travel: 6,
}

export interface FaceInput {
  /** An expression by name, or a channel vector you blended yourself. */
  expression?: FaceExpression | FaceChannels
  /** How far the rig drives toward it, 0..1. */
  intensity?: number
  /** Pupil aim in −1..1 on both axes. */
  gaze?: Vec2 | null
  /** Lid closure added on top of the expression, 0..1. */
  blink?: number
  /** Speech level, 0..1: opens the jaw and works the lips. */
  speech?: number
  /** Explicit channels, applied last — these win outright. */
  channels?: Partial<FaceCenter> & { left?: Partial<FaceSide>; right?: Partial<FaceSide> }
}

export interface FaceSolution extends FaceChannels {
  intensity: number
  gaze: Vec2
  actuators: FaceActuator[]
  /** False when any servo was asked for more stroke than it has. */
  withinLimits: boolean
}

/**
 * Channels that only ever run one way, so they clamp to 0..1 rather than ±1.
 * `lidUpper` is not one of them: a lid retracts past open, which is what makes
 * surprise and fear read as wide-eyed rather than merely un-blinked.
 */
const unipolar = new Set(["lidLower", "cheek", "noseWrinkle", "lipPucker", "jaw"])

const bound = (key: string, value: number) =>
  unipolar.has(key) ? clamp(finite(value), 0, 1) : clamp(finite(value), -1, 1)

/**
 * Resolve the rig. Expression first, scaled by intensity; blink and speech add
 * on top rather than replacing anything, so a head can be sorrowful, blinking
 * and talking at once; explicit channels win last.
 */
export function solveFace(input: FaceInput = {}, geometry: HeadGeometry = defaultHeadGeometry): FaceSolution {
  const shape =
    typeof input.expression === "object" && input.expression
      ? input.expression
      : faceShape((input.expression as FaceExpression) ?? "neutral")
  const intensity = clamp(finite(input.intensity, 1), 0, 1)
  const blink = clamp(finite(input.blink), 0, 1)
  const speech = clamp(finite(input.speech), 0, 1)

  const scaleSide = (values: FaceSide, overrides?: Partial<FaceSide>): FaceSide => {
    const scaled: FaceSide = {
      browInner: values.browInner * intensity,
      browOuter: values.browOuter * intensity,
      // Blink is a closure the expression cannot argue with, so it takes the
      // larger of the two rather than summing into an impossible lid.
      lidUpper: Math.max(values.lidUpper * intensity, blink),
      lidLower: values.lidLower * intensity,
      cheek: values.cheek * intensity,
      lipCorner: values.lipCorner * intensity,
    }
    const merged = { ...scaled, ...overrides }
    return {
      browInner: bound("browInner", merged.browInner),
      browOuter: bound("browOuter", merged.browOuter),
      lidUpper: bound("lidUpper", merged.lidUpper),
      lidLower: bound("lidLower", merged.lidLower),
      cheek: bound("cheek", merged.cheek),
      lipCorner: bound("lipCorner", merged.lipCorner),
    }
  }

  const left = scaleSide(shape.left, input.channels?.left)
  const right = scaleSide(shape.right, input.channels?.right)

  const center: FaceCenter = {
    // Speech opens the jaw past whatever the expression holds and slackens the
    // lips; a pressed mouth cannot also be speaking.
    jaw: bound("jaw", input.channels?.jaw ?? Math.max(shape.jaw * intensity, speech * 0.8)),
    lipPress: bound("lipPress", input.channels?.lipPress ?? shape.lipPress * intensity - speech * 0.4),
    lipPucker: bound("lipPucker", input.channels?.lipPucker ?? shape.lipPucker * intensity + speech * 0.25),
    noseWrinkle: bound("noseWrinkle", input.channels?.noseWrinkle ?? shape.noseWrinkle * intensity),
  }

  const gain = Math.abs(finite(geometry.gain, defaultHeadGeometry.gain))
  const travel = Math.abs(finite(geometry.travel, defaultHeadGeometry.travel))
  const actuators: FaceActuator[] = []
  const record = (id: string, value: number) => {
    const stroke = Math.abs(value) * gain
    actuators.push({ id, value, stroke, travel, withinLimits: stroke <= travel + 1e-6 })
  }
  for (const [name, values] of [["left", left], ["right", right]] as const) {
    for (const key of Object.keys(rest) as (keyof FaceSide)[]) record(`${name}.${key}`, values[key])
  }
  for (const key of Object.keys(still) as (keyof FaceCenter)[]) record(key, center[key])

  const aim = input.gaze ?? { x: 0, y: 0 }
  return {
    ...center,
    left,
    right,
    intensity,
    gaze: { x: clamp(finite(aim.x), -1, 1), y: clamp(finite(aim.y), -1, 1) },
    actuators,
    withinLimits: actuators.every((actuator) => actuator.withinLimits),
  }
}

/** Neck rotation in degrees. Applied roll, then pitch, then yaw. */
export interface HeadPose {
  yaw: number
  pitch: number
  roll: number
}

export const restPose: HeadPose = { yaw: 0, pitch: 0, roll: 0 }

/**
 * Turn a point of the head through the neck. Roll spins the face in its own
 * plane, pitch nods it, yaw turns it — the order a two-axis neck with a rolled
 * base actually moves in.
 */
export function rotateHead(point: Vec3, pose: HeadPose): Vec3 {
  const roll = toRadians(finite(pose.roll))
  const pitch = toRadians(finite(pose.pitch))
  const yaw = toRadians(finite(pose.yaw))
  const x0 = finite(point.x)
  const y0 = finite(point.y)
  const z0 = finite(point.z)

  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  const x1 = x0 * cr - y0 * sr
  const y1 = x0 * sr + y0 * cr

  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const y2 = y1 * cp - z0 * sp
  const z2 = y1 * sp + z0 * cp

  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  return { x: x1 * cy + z2 * sy, y: y2, z: -x1 * sy + z2 * cy }
}

/**
 * Where a face feature sits on the skull. `x` and `y` place it on the front
 * elevation; `z` comes out of the ellipsoid, so a feature moved outboard also
 * moves back and the brow line curves round the temple on its own. `outset`
 * floats a part clear of the shell. Anything outside the silhouette lands on
 * the equator rather than returning NaN.
 */
export function onFace(x: number, y: number, radii: Vec3, outset = 0): Vec3 {
  const px = finite(x)
  const py = finite(y)
  const rx = Math.abs(finite(radii.x, 1)) || 1
  const ry = Math.abs(finite(radii.y, 1)) || 1
  const rz = Math.abs(finite(radii.z, 1)) || 1
  const remainder = 1 - (px / rx) ** 2 - (py / ry) ** 2
  return { x: px, y: py, z: -(rz + finite(outset)) * Math.sqrt(Math.max(0, remainder)) }
}

export interface EllipseOutline {
  cx: number
  cy: number
  /** Semi-major, semi-minor, and the tilt of the major axis in degrees. */
  rx: number
  ry: number
  angle: number
}

/**
 * The exact silhouette of an ellipsoid seen through an orthographic camera.
 *
 * The camera is linear, so composing it with the neck rotation and the radii
 * gives a 2×3 matrix `A`; the image of the unit sphere under `A` is the ellipse
 * whose shape matrix is `AAᵀ`. Eigen-decomposing that 2×2 gives the two
 * semi-axes and the tilt — no polygon, no hull, no per-view artwork.
 */
export function ellipsoidOutline(
  radii: Vec3,
  pose: HeadPose,
  camera: RobotCamera,
  center: Vec3 = { x: 0, y: 0, z: 0 },
): EllipseOutline {
  const axes: Vec3[] = [
    { x: Math.abs(finite(radii.x)), y: 0, z: 0 },
    { x: 0, y: Math.abs(finite(radii.y)), z: 0 },
    { x: 0, y: 0, z: Math.abs(finite(radii.z)) },
  ]
  const columns = axes.map((axis) => {
    const turned = rotateHead(axis, pose)
    return camera.project(turned.x, turned.y, turned.z)
  })

  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const column of columns) {
    sxx += column.x * column.x
    sxy += column.x * column.y
    syy += column.y * column.y
  }
  const trace = sxx + syy
  const gap = Math.sqrt(Math.max(0, (trace / 2) ** 2 - (sxx * syy - sxy * sxy)))
  const origin = camera.project(finite(center.x), finite(center.y), finite(center.z))
  return {
    cx: origin.x,
    cy: origin.y,
    rx: Math.sqrt(Math.max(0, trace / 2 + gap)),
    ry: Math.sqrt(Math.max(0, trace / 2 - gap)),
    angle: toDegrees(0.5 * Math.atan2(2 * sxy, sxx - syy)),
  }
}
