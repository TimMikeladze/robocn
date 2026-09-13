/**
 * robocn — kinematics core.
 *
 * Dependency-free inverse and forward kinematics shared by every robocn
 * component. No React, no three.js: the SVG arms and the WebGL rig call the
 * same functions, so a pose looks identical in 2D and 3D.
 */

export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/* -------------------------------------------------------------------------- */
/* scalars                                                                     */
/* -------------------------------------------------------------------------- */

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const toDegrees = (radians: number) => (radians * 180) / Math.PI

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/* -------------------------------------------------------------------------- */
/* vectors                                                                     */
/* -------------------------------------------------------------------------- */

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y })
export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const scale2 = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const length2 = (a: Vec2) => Math.hypot(a.x, a.y)
export const distance2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
})

/** Unit vector, falling back to `fallback` when the input has no direction. */
export function normalize2(a: Vec2, fallback: Vec2 = { x: 0, y: 1 }): Vec2 {
  const l = length2(a)
  return l < 1e-9 ? { ...fallback } : { x: a.x / l, y: a.y / l }
}

/** Counter-clockwise perpendicular. */
export const perpendicular2 = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x })

export function rotate2(a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })
export const add3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
})
export const scale3 = (a: Vec3, s: number): Vec3 => ({
  x: a.x * s,
  y: a.y * s,
  z: a.z * s,
})
export const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
export const length3 = (a: Vec3) => Math.hypot(a.x, a.y, a.z)
export const distance3 = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
})

export function normalize3(a: Vec3, fallback: Vec3 = { x: 0, y: 1, z: 0 }): Vec3 {
  const l = length3(a)
  return l < 1e-9 ? { ...fallback } : { x: a.x / l, y: a.y / l, z: a.z / l }
}

/* -------------------------------------------------------------------------- */
/* reach                                                                       */
/* -------------------------------------------------------------------------- */

/** Farthest a chain can stretch: the sum of its links. */
export const chainReach = (links: number[]) =>
  links.reduce((total, link) => total + link, 0)

/**
 * Closest a chain can fold. One link dominating the rest leaves a dead zone
 * around the shoulder that no pose can enter.
 */
export function chainMinReach(links: number[]) {
  if (links.length === 0) return 0
  const longest = Math.max(...links)
  return Math.max(0, longest * 2 - chainReach(links))
}

/**
 * Pull a target onto the annulus the chain can actually touch. Out-of-reach
 * targets stretch the arm toward them instead of leaving the pose undefined.
 */
export function clampToReach2(root: Vec2, target: Vec2, links: number[]): Vec2 {
  const delta = sub2(target, root)
  const span = length2(delta)
  const max = chainReach(links) * 0.9999
  const min = chainMinReach(links) * 1.0001
  if (span >= min && span <= max) return { ...target }
  const direction = normalize2(delta)
  return add2(root, scale2(direction, clamp(span, min, max)))
}

export function clampToReach3(root: Vec3, target: Vec3, links: number[]): Vec3 {
  const delta = sub3(target, root)
  const span = length3(delta)
  const max = chainReach(links) * 0.9999
  const min = chainMinReach(links) * 1.0001
  if (span >= min && span <= max) return { ...target }
  const direction = normalize3(delta)
  return add3(root, scale3(direction, clamp(span, min, max)))
}

/* -------------------------------------------------------------------------- */
/* two-link (analytic)                                                         */
/* -------------------------------------------------------------------------- */

/** Which side of the shoulder-to-target line the elbow breaks toward. */
export type Bend = "up" | "down"

/**
 * Law-of-cosines elbow for a two-link planar arm. Cheaper than iterating and,
 * unlike a solver, it gives the same industrial pose every frame.
 */
export function solveElbow2(
  root: Vec2,
  target: Vec2,
  upper: number,
  fore: number,
  bend: Bend = "up",
): Vec2 {
  const delta = sub2(target, root)
  const span = clamp(
    length2(delta),
    Math.abs(upper - fore) + 1e-6,
    upper + fore - 1e-6,
  )
  const direction = normalize2(delta)
  const along = (upper * upper - fore * fore + span * span) / (2 * span)
  const height = Math.sqrt(Math.max(0, upper * upper - along * along))
  const side = scale2(perpendicular2(direction), bend === "up" ? 1 : -1)
  return add2(add2(root, scale2(direction, along)), scale2(side, height))
}

/** The 3D twin: the elbow is lifted toward `up` rather than to a side. */
export function solveElbow3(
  root: Vec3,
  target: Vec3,
  upper: number,
  fore: number,
  up: Vec3 = { x: 0, y: 1, z: 0 },
): Vec3 {
  const delta = sub3(target, root)
  const span = clamp(
    length3(delta),
    Math.abs(upper - fore) + 1e-6,
    upper + fore - 1e-6,
  )
  const direction = normalize3(delta)
  const along = (upper * upper - fore * fore + span * span) / (2 * span)
  const height = Math.sqrt(Math.max(0, upper * upper - along * along))
  // Component of `up` perpendicular to the reach direction; if the arm points
  // straight up there is no such component, so break toward any normal.
  let side = sub3(up, scale3(direction, dot3(up, direction)))
  if (length3(side) < 1e-6) {
    side = sub3({ x: 0, y: 0, z: 1 }, scale3(direction, direction.z))
  }
  side = normalize3(side)
  return add3(add3(root, scale3(direction, along)), scale3(side, height))
}

/* -------------------------------------------------------------------------- */
/* n-link (FABRIK)                                                             */
/* -------------------------------------------------------------------------- */

export interface ChainOptions2 {
  /** Previous pose. Seeding keeps animation from snapping between solutions. */
  seed?: Vec2[]
  bend?: Bend
  iterations?: number
  tolerance?: number
}

/**
 * Joint positions from shoulder to tool tip, one more than there are links.
 * Two links take the analytic path; longer chains run FABRIK.
 */
export function solveChain2(
  root: Vec2,
  target: Vec2,
  links: number[],
  options: ChainOptions2 = {},
): Vec2[] {
  const { seed, bend = "up", iterations = 12, tolerance = 0.01 } = options
  if (links.length === 0) return [{ ...root }]
  const goal = clampToReach2(root, target, links)
  if (links.length === 1) {
    const direction = normalize2(sub2(goal, root))
    return [{ ...root }, add2(root, scale2(direction, links[0]))]
  }
  if (links.length === 2) {
    return [
      { ...root },
      solveElbow2(root, goal, links[0], links[1], bend),
      { ...goal },
    ]
  }

  const joints =
    seed && seed.length === links.length + 1
      ? seed.map((joint) => ({ ...joint }))
      : arcPose2(root, goal, links, bend)

  for (let pass = 0; pass < iterations; pass++) {
    // Backward: pin the tip to the goal and walk the chain home.
    joints[joints.length - 1] = { ...goal }
    for (let i = links.length - 1; i >= 0; i--) {
      const direction = normalize2(sub2(joints[i], joints[i + 1]))
      joints[i] = add2(joints[i + 1], scale2(direction, links[i]))
    }
    // Forward: pin the shoulder to the root and walk back out.
    joints[0] = { ...root }
    for (let i = 0; i < links.length; i++) {
      const direction = normalize2(sub2(joints[i + 1], joints[i]))
      joints[i + 1] = add2(joints[i], scale2(direction, links[i]))
    }
    if (distance2(joints[joints.length - 1], goal) < tolerance) break
  }
  return joints
}

/** Bowed starting pose, so an unseeded chain breaks toward `bend` on frame one. */
function arcPose2(root: Vec2, target: Vec2, links: number[], bend: Bend): Vec2[] {
  const total = chainReach(links)
  const delta = sub2(target, root)
  const span = Math.max(1e-4, length2(delta))
  const direction = scale2(delta, 1 / span)
  const side = scale2(perpendicular2(direction), bend === "up" ? 1 : -1)
  const bulge = Math.sqrt(Math.max(0, total * total - span * span)) * 0.5
  const joints: Vec2[] = [{ ...root }]
  let walked = 0
  for (const link of links) {
    walked += link
    const t = walked / total
    joints.push(
      add2(
        add2(root, scale2(direction, Math.min(span, total) * t)),
        scale2(side, Math.sin(Math.PI * t) * bulge),
      ),
    )
  }
  return joints
}

export interface ChainOptions3 {
  seed?: Vec3[]
  /** Axis the elbows bulge toward. */
  up?: Vec3
  iterations?: number
  tolerance?: number
}

export function solveChain3(
  root: Vec3,
  target: Vec3,
  links: number[],
  options: ChainOptions3 = {},
): Vec3[] {
  const {
    seed,
    up = { x: 0, y: 1, z: 0 },
    iterations = 12,
    tolerance = 0.01,
  } = options
  if (links.length === 0) return [{ ...root }]
  const goal = clampToReach3(root, target, links)
  if (links.length === 1) {
    const direction = normalize3(sub3(goal, root), up)
    return [{ ...root }, add3(root, scale3(direction, links[0]))]
  }
  if (links.length === 2) {
    return [
      { ...root },
      solveElbow3(root, goal, links[0], links[1], up),
      { ...goal },
    ]
  }

  const joints =
    seed && seed.length === links.length + 1
      ? seed.map((joint) => ({ ...joint }))
      : arcPose3(root, goal, links, up)

  for (let pass = 0; pass < iterations; pass++) {
    joints[joints.length - 1] = { ...goal }
    for (let i = links.length - 1; i >= 0; i--) {
      const direction = normalize3(sub3(joints[i], joints[i + 1]), up)
      joints[i] = add3(joints[i + 1], scale3(direction, links[i]))
    }
    joints[0] = { ...root }
    for (let i = 0; i < links.length; i++) {
      const direction = normalize3(sub3(joints[i + 1], joints[i]), up)
      joints[i + 1] = add3(joints[i], scale3(direction, links[i]))
    }
    if (distance3(joints[joints.length - 1], goal) < tolerance) break
  }
  return joints
}

function arcPose3(root: Vec3, target: Vec3, links: number[], up: Vec3): Vec3[] {
  const total = chainReach(links)
  const delta = sub3(target, root)
  const span = Math.max(1e-4, length3(delta))
  const direction = scale3(delta, 1 / span)
  let side = sub3(up, scale3(direction, dot3(up, direction)))
  if (length3(side) < 1e-6) side = { x: 0, y: 0, z: 1 }
  side = normalize3(side)
  const bulge = Math.sqrt(Math.max(0, total * total - span * span)) * 0.5
  const joints: Vec3[] = [{ ...root }]
  let walked = 0
  for (const link of links) {
    walked += link
    const t = walked / total
    joints.push(
      add3(
        add3(root, scale3(direction, Math.min(span, total) * t)),
        scale3(side, Math.sin(Math.PI * t) * bulge),
      ),
    )
  }
  return joints
}

/* -------------------------------------------------------------------------- */
/* forward kinematics                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Joint positions from joint angles. `angles[i]` is measured in degrees
 * relative to the previous segment; the first is relative to the +x axis.
 */
export function forwardChain2(
  root: Vec2,
  angles: number[],
  links: number[],
): Vec2[] {
  const joints: Vec2[] = [{ ...root }]
  let heading = 0
  for (let i = 0; i < links.length; i++) {
    heading += toRadians(angles[i] ?? 0)
    joints.push(
      add2(joints[i], {
        x: Math.cos(heading) * links[i],
        y: Math.sin(heading) * links[i],
      }),
    )
  }
  return joints
}

/** The inverse of {@link forwardChain2}: relative joint angles in degrees. */
export function chainAngles2(joints: Vec2[]): number[] {
  const angles: number[] = []
  let previous = 0
  for (let i = 0; i < joints.length - 1; i++) {
    const delta = sub2(joints[i + 1], joints[i])
    const heading = Math.atan2(delta.y, delta.x)
    angles.push(toDegrees(heading - previous))
    previous = heading
  }
  return angles
}

/** Link lengths implied by a pose — useful when a pose is authored by hand. */
export const chainLinks2 = (joints: Vec2[]) =>
  joints.slice(1).map((joint, i) => distance2(joints[i], joint))

/* -------------------------------------------------------------------------- */
/* delta (parallel) robot                                                      */
/* -------------------------------------------------------------------------- */

export interface DeltaGeometry {
  /** Side length of the fixed triangle the motors sit on. */
  base: number
  /** Side length of the moving platform triangle. */
  platform: number
  /** Driven upper arm ("bicep") length. */
  upper: number
  /** Passive parallelogram forearm length. */
  lower: number
}

export interface DeltaArm {
  /** Motor axis on the fixed triangle. */
  anchor: Vec3
  /** Elbow where the bicep meets the forearm. */
  elbow: Vec3
  /** Corner of the moving platform this arm drives. */
  platform: Vec3
  /** Bicep angle in degrees, 0 horizontal, positive lifting. */
  angle: number
}

export interface DeltaPose {
  arms: DeltaArm[]
  center: Vec3
  /** False when the target sits outside the workspace; the pose then clamps. */
  reachable: boolean
}

const TAN30 = Math.tan(Math.PI / 6)

/**
 * Closed-form delta IK. Solved once per arm in that arm's own YZ plane (the
 * classic formulation), then rotated back by 0°, 120° and 240°. `y` is up;
 * the platform hangs below the base, so useful targets have negative `y`.
 */
export function solveDelta(target: Vec3, geometry: DeltaGeometry): DeltaPose {
  const arms: DeltaArm[] = []
  let reachable = true
  for (let i = 0; i < 3; i++) {
    const spin = (-i * 2 * Math.PI) / 3
    const local = rotateY(target, spin)
    const solved = deltaArmYZ(local, geometry)
    if (!solved.reachable) reachable = false
    const back = -spin
    arms.push({
      anchor: rotateY(solved.anchor, back),
      elbow: rotateY(solved.elbow, back),
      platform: rotateY(solved.platform, back),
      angle: solved.angle,
    })
  }
  return { arms, center: { ...target }, reachable }
}

function rotateY(v: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c }
}

function deltaArmYZ(target: Vec3, geometry: DeltaGeometry) {
  const { base, platform, upper, lower } = geometry
  // Work in the arm's plane: `z` across, `y` down the column, `x` out of plane.
  const anchorZ = -0.5 * TAN30 * base
  const platformZ = target.z - 0.5 * TAN30 * platform
  const anchor: Vec3 = { x: 0, y: 0, z: anchorZ }
  const attach: Vec3 = { x: target.x, y: target.y, z: platformZ }

  // Elbow lies where the bicep circle meets the sphere of forearm length around
  // the platform corner, projected into the arm plane.
  const height = target.y === 0 ? -1e-6 : target.y
  const a =
    (target.x * target.x +
      platformZ * platformZ +
      height * height +
      upper * upper -
      lower * lower -
      anchorZ * anchorZ) /
    (2 * height)
  const b = (anchorZ - platformZ) / height
  const discriminant = -((a + b * anchorZ) ** 2) + upper * upper * (b * b + 1)
  if (discriminant < 0) {
    // Out of workspace: fold the bicep straight at the platform corner instead.
    const direction = normalize3(sub3(attach, anchor), { x: 0, y: -1, z: 0 })
    const elbow = add3(anchor, scale3(direction, upper))
    return {
      anchor,
      elbow,
      platform: attach,
      angle: toDegrees(Math.atan2(-elbow.y, elbow.z - anchorZ)),
      reachable: false,
    }
  }
  const elbowZ = (anchorZ - a * b - Math.sqrt(discriminant)) / (b * b + 1)
  const elbowY = a + b * elbowZ
  const elbow: Vec3 = { x: 0, y: elbowY, z: elbowZ }
  return {
    anchor,
    elbow,
    platform: attach,
    angle: toDegrees(Math.atan2(-elbowY, elbowZ - anchorZ)),
    reachable: true,
  }
}

/* -------------------------------------------------------------------------- */
/* projection                                                                  */
/* -------------------------------------------------------------------------- */

export interface IsometricOptions {
  /** Rotation about the vertical axis, in degrees. */
  spin?: number
  /** How far the view tips over, 0 flat-on, 1 top-down. */
  tilt?: number
}

/**
 * Flatten a 3D point for SVG. Right-handed, `y` up in world space and down on
 * screen, so the result drops straight into a y-up drawing group.
 */
export function isometric(v: Vec3, options: IsometricOptions = {}): Vec2 {
  const { spin = 35, tilt = 0.5 } = options
  const radians = toRadians(spin)
  const x = v.x * Math.cos(radians) + v.z * Math.sin(radians)
  return { x, y: v.y * (1 - tilt * 0.35) + isometricDepth(v, options) * tilt }
}

/** How far back a point sits under the same projection — use it to sort parts. */
export function isometricDepth(v: Vec3, options: IsometricOptions = {}) {
  const radians = toRadians(options.spin ?? 35)
  return v.z * Math.cos(radians) - v.x * Math.sin(radians)
}

/**
 * Smallest convex outline containing the points, as a closed ring. Used to find
 * the silhouette of a solid part once it is projected — the shape a footprint
 * and its own extruded copy make together.
 */
export function convexHull2(points: readonly Vec2[]): Vec2[] {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length < 3) return sorted
  const turn = (o: Vec2, a: Vec2, b: Vec2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const chain = (input: Vec2[]) => {
    const out: Vec2[] = []
    for (const p of input) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) {
        out.pop()
      }
      out.push(p)
    }
    return out
  }
  const lower = chain(sorted)
  const upper = chain([...sorted].reverse())
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}
