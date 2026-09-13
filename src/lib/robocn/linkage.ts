/**
 * robocn — closed-loop linkage geometry.
 *
 * Everything else in the set solves an *open* chain: a shoulder reaching for a
 * target, a spine integrating a tangent, legs hung off a body. These three
 * mechanisms are closed. The crank does not choose where the beam goes — the
 * loop does, and at some geometries the loop cannot be assembled at all.
 *
 * Pure functions over plain `{x, y}`. No React, no dependencies, and no
 * dynamics: nothing here knows about mass, torque, inertia, friction, rope
 * stretch or sheave efficiency.
 */

import { clamp, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, and never negative. */
const span = (value: number, fallback: number) =>
  Math.abs(finite(value, fallback))

/* -------------------------------------------------------------------------- */
/* four-bar                                                                    */
/* -------------------------------------------------------------------------- */

export interface FourBarGeometry {
  /** Horizontal distance from the crank pivot to the rocker pivot. */
  ground: number
  /** How far the rocker pivot stands above the crank pivot. */
  rise?: number
  /** The driven link, turning about the origin. */
  crank: number
  /** The floating link between the crank pin and the rocker. */
  coupler: number
  /** The driven link, turning about the ground pivot. */
  rocker: number
}

export interface FourBarOptions {
  /** Which of the two assemblies to take. Chosen, so it cannot flip frame to frame. */
  branch?: "up" | "down"
}

export interface FourBarPose {
  /** Crank pivot. Always the origin — the loop is written about it. */
  crankPivot: Vec2
  /** Crank pin: the crank–coupler joint. */
  crankPin: Vec2
  /** Coupler pin: the coupler–rocker joint. */
  couplerPin: Vec2
  /** Ground pivot the rocker turns about. */
  rockerPivot: Vec2
  /** Degrees, counter-clockwise from +x, wrapped to 0–360. */
  crankAngle: number
  /** Direction of the coupler, crank pin outward. Degrees. */
  couplerAngle: number
  /** Direction of the rocker, ground pivot outward. Degrees. */
  rockerAngle: number
  /** Angle between coupler and rocker at their shared joint, 0–180 degrees. */
  transmissionAngle: number
  /** False where the loop cannot close at this crank angle; the pose is then stretched. */
  assembled: boolean
}

const wrap360 = (degrees: number) => ((degrees % 360) + 360) % 360

const heading = (from: Vec2, to: Vec2) =>
  wrap360(toDegrees(Math.atan2(to.y - from.y, to.x - from.x)))

/**
 * Solve the loop for one crank angle.
 *
 * The coupler pin is where a circle of radius `coupler` about the crank pin
 * meets a circle of radius `rocker` about the ground pivot, so both link
 * lengths are the construction rather than an approximation that drifts. Where
 * the circles do not meet, the coupler keeps its length and points straight at
 * the ground pivot — a visibly stretched linkage — and `assembled` is false.
 */
export function solveFourBar(
  crankAngle: number,
  geometry: FourBarGeometry,
  { branch = "up" }: FourBarOptions = {},
): FourBarPose {
  const crank = span(geometry.crank, 1)
  const coupler = span(geometry.coupler, 1)
  const rocker = span(geometry.rocker, 1)
  const ground = finite(geometry.ground, 1)
  const rise = finite(geometry.rise ?? 0, 0)
  const angle = wrap360(finite(crankAngle, 0))
  const radians = toRadians(angle)

  const crankPivot: Vec2 = { x: 0, y: 0 }
  const crankPin: Vec2 = {
    x: Math.cos(radians) * crank,
    y: Math.sin(radians) * crank,
  }
  const rockerPivot: Vec2 = { x: ground, y: rise }

  const dx = rockerPivot.x - crankPin.x
  const dy = rockerPivot.y - crankPin.y
  const distance = Math.hypot(dx, dy)

  // Degenerate: the crank pin sits on the ground pivot, so there is no line to
  // measure along. Park the coupler along +x rather than dividing by zero.
  if (distance === 0) {
    const couplerPin = { x: crankPin.x + coupler, y: crankPin.y }
    return {
      crankPivot,
      crankPin,
      couplerPin,
      rockerPivot,
      crankAngle: angle,
      couplerAngle: 0,
      rockerAngle: heading(rockerPivot, couplerPin),
      transmissionAngle: 0,
      assembled: false,
    }
  }

  const ux = dx / distance
  const uy = dy / distance
  const reach =
    (distance * distance + coupler * coupler - rocker * rocker) / (2 * distance)
  const assembled = reach <= coupler && reach >= -coupler
  // Clamped: the coupler holds its length and the rocker is the link that
  // cannot reach, which is what a locked-up linkage looks like.
  const along = clamp(reach, -coupler, coupler)
  const height = assembled ? Math.sqrt(Math.max(0, coupler * coupler - along * along)) : 0
  const side = branch === "down" ? -1 : 1

  const couplerPin: Vec2 = {
    x: crankPin.x + ux * along - uy * height * side,
    y: crankPin.y + uy * along + ux * height * side,
  }

  const couplerAngle = heading(crankPin, couplerPin)
  const rockerAngle = heading(rockerPivot, couplerPin)
  const toCrank = wrap360(couplerAngle + 180)
  const gap = Math.abs(wrap360(toCrank - wrap360(rockerAngle + 180)))

  return {
    crankPivot,
    crankPin,
    couplerPin,
    rockerPivot,
    crankAngle: angle,
    couplerAngle,
    rockerAngle,
    transmissionAngle: gap > 180 ? 360 - gap : gap,
    assembled,
  }
}

/**
 * A point rigidly attached to a link: `along` world units from `origin` in the
 * link's direction, then `offset` units to its left. The horsehead hung off a
 * walking beam, a coupler-mounted tool, a counterweight on a crank.
 */
export function rigidPoint(
  origin: Vec2,
  angle: number,
  along: number,
  offset = 0,
): Vec2 {
  const radians = toRadians(finite(angle, 0))
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const reach = finite(along, 0)
  const side = finite(offset, 0)
  return {
    x: origin.x + cos * reach - sin * side,
    y: origin.y + sin * reach + cos * side,
  }
}

/* -------------------------------------------------------------------------- */
/* slider-crank                                                                */
/* -------------------------------------------------------------------------- */

export interface SliderCrankGeometry {
  crank: number
  /** Connecting rod, crank pin to wrist pin. */
  rod: number
  /** How far the slider's line of travel sits above the crank pivot. */
  offset?: number
}

export interface SliderCrankPose {
  /** Crank pin: the crank–rod joint. */
  pin: Vec2
  /** Wrist pin, on the slider's line of travel. */
  wrist: Vec2
  /** Displacement of the wrist pin along the line of travel. */
  slider: number
  /** Direction of the connecting rod, crank pin outward. Degrees. */
  rodAngle: number
  /** Analytic travel between the two dead centres. */
  stroke: number
  /** False when the rod cannot reach the line of travel at this crank angle. */
  assembled: boolean
}

/**
 * The degenerate four-bar with one link at infinity: a crank turning about the
 * origin, a rod, and a wrist pin constrained to a horizontal line at `offset`.
 * The slider is taken on the +x side, which is where a fluid end sits.
 */
export function solveSliderCrank(
  crankAngle: number,
  geometry: SliderCrankGeometry,
): SliderCrankPose {
  const crank = span(geometry.crank, 1)
  const rod = span(geometry.rod, 2)
  const offset = finite(geometry.offset ?? 0, 0)
  const angle = wrap360(finite(crankAngle, 0))
  const radians = toRadians(angle)

  const pin: Vec2 = {
    x: Math.cos(radians) * crank,
    y: Math.sin(radians) * crank,
  }

  const climb = offset - pin.y
  const assembled = Math.abs(climb) <= rod
  const run = Math.sqrt(Math.max(0, rod * rod - climb * climb))
  const wrist: Vec2 = { x: pin.x + run, y: offset }

  // Both dead centres put the crank and the rod in line, so the extremes are
  // the two collinear triangles rather than a sampled maximum.
  const far = Math.sqrt(Math.max(0, (rod + crank) ** 2 - offset * offset))
  const near = Math.sqrt(Math.max(0, (rod - crank) ** 2 - offset * offset))

  return {
    pin,
    wrist,
    slider: wrist.x,
    rodAngle: heading(pin, wrist),
    stroke: Math.max(0, far - near),
    assembled,
  }
}

/* -------------------------------------------------------------------------- */
/* block and tackle                                                            */
/* -------------------------------------------------------------------------- */

export interface TackleGeometry {
  /** Lines strung between the crown and the travelling block. */
  lines: number
  /** Effective drum radius: one turn pays out 2πr of rope. */
  drumRadius: number
  /** Where the block sits with the rope fully spooled in. */
  topHeight: number
  /** The lowest the block can travel. */
  floorHeight: number
}

export interface TacklePosition {
  /** Height of the travelling block. */
  height: number
  /** How far it has come down from `topHeight`. */
  travel: number
  /** Rope off the drum. */
  payout: number
  /** Mechanical advantage: the line count. */
  advantage: number
  /** True at either end of the travel, where the rope has run out of drawing. */
  atLimit: boolean
}

/**
 * Where the travelling block hangs after `drumTurns` off the drum.
 *
 * The constraint is a constant rope length: whatever the drum pays out is
 * shared between the lines, so the block travels payout ÷ lines and the
 * advantage is the line count. Reeving more lines makes the same drum turn
 * lift less, slower.
 */
export function tacklePosition(
  drumTurns: number,
  geometry: TackleGeometry,
): TacklePosition {
  const lines = Math.max(1, Math.round(finite(geometry.lines, 6)))
  const drumRadius = span(geometry.drumRadius, 1)
  const top = finite(geometry.topHeight, 0)
  const floor = finite(geometry.floorHeight, 0)
  const payout = 2 * Math.PI * drumRadius * finite(drumTurns, 0)
  const travel = payout / lines
  const low = Math.min(top, floor)
  const high = Math.max(top, floor)
  const raw = top - travel
  const height = clamp(raw, low, high)
  return {
    height,
    travel: top - height,
    payout,
    advantage: lines,
    atLimit: raw !== height,
  }
}

/**
 * The rope itself, as one polyline zig-zagging between the crown sheaves and
 * the block sheaves. The first vertex is the dead-line anchor at the crown and
 * the last is the fast line leaving for the drum, so there are exactly `lines`
 * falls between them.
 */
export function tackleReeving(
  crown: Vec2,
  block: Vec2,
  lines: number,
  spacing: number,
): Vec2[] {
  const count = Math.max(1, Math.round(finite(lines, 6)))
  const pitch = span(spacing, 4)
  const crownSheaves = Math.floor(count / 2) + 1
  const blockSheaves = Math.ceil(count / 2)
  const place = (anchor: Vec2, index: number, total: number): Vec2 => ({
    x: anchor.x + (index - (total - 1) / 2) * pitch,
    y: anchor.y,
  })
  return Array.from({ length: count + 1 }, (_, step) =>
    step % 2 === 0
      ? place(crown, step / 2, crownSheaves)
      : place(block, (step - 1) / 2, blockSheaves),
  )
}
