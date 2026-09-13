/**
 * robocn — transmission geometry.
 *
 * Where the flexible thing goes, and where the teeth are. Four mechanisms that
 * every machine shop drawing has and that nothing else in the set solves: a
 * gear's outline, the phase that makes two gears mesh, the taut path of a belt
 * around a set of pulleys, and an energy chain folded over its own bend.
 *
 * Pure functions over plain objects. No React, no dependencies, no dynamics —
 * there is no torque, tension, backlash or friction here, only geometry.
 */

import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"

/* -------------------------------------------------------------------------- */
/* gears                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Angles are SVG degrees: clockwise from the +x axis, so a value handed to
 * `rotate()` and a value handed to these functions mean the same thing.
 */
const point = (cx: number, cy: number, radius: number, degrees: number): Vec2 => {
  const a = toRadians(degrees)
  return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius }
}

const round = (value: number) => Number(value.toFixed(3))

export interface GearPathOptions {
  /** How far the tooth tip stands above the pitch circle. Default `radius/12`. */
  addendum?: number
  /** How far the root falls below it. Default `addendum * 1.2`. */
  dedendum?: number
  /** Teeth pointing inward from a rim of this radius: a ring gear. */
  rim?: number
  /** Tooth width at the tip, as a fraction of the circular pitch. */
  width?: number
}

/** Teeth are clamped to a range that can actually be drawn and meshed. */
export const gearTeeth = (teeth: number) =>
  Number.isFinite(teeth) ? clamp(Math.round(teeth), 6, 160) : 12

/**
 * One gear's outline: `teeth` trapezoidal teeth on a pitch circle, tooth zero
 * centred on the +x axis so a group `rotate()` is the gear's own angle.
 *
 * With `rim`, the teeth point inward and the path is an annulus — the rim
 * circle plus the toothed bore, wound so `fill-rule="evenodd"` cuts the bore
 * out. That is the ring gear of a planetary set.
 */
export function gearPath(teeth: number, pitchRadius: number, options: GearPathOptions = {}) {
  const count = gearTeeth(teeth)
  const radius = Number.isFinite(pitchRadius) ? Math.max(1, pitchRadius) : 10
  const addendum = Math.max(0.2, options.addendum ?? radius / 12)
  const dedendum = Math.max(0.2, options.dedendum ?? addendum * 1.2)
  const width = clamp(options.width ?? 0.42, 0.15, 0.48)
  const inward = options.rim !== undefined
  // A ring gear's teeth grow inward from the pitch circle, so the tooth sits
  // at the smaller radius and the root at the larger one.
  const tip = radius + addendum
  const root = radius - dedendum
  const outer = inward ? root : tip
  const inner = inward ? tip : root
  const pitch = 360 / count
  const tipHalf = pitch * width
  const rootHalf = pitch * 0.5

  const corners: Vec2[] = []
  for (let i = 0; i < count; i += 1) {
    const centre = i * pitch
    // Root, flank up, across the tip, flank down, root again.
    corners.push(point(0, 0, inner, centre - rootHalf + pitch * 0.06))
    corners.push(point(0, 0, outer, centre - tipHalf))
    corners.push(point(0, 0, outer, centre + tipHalf))
    corners.push(point(0, 0, inner, centre + rootHalf - pitch * 0.06))
  }
  const bore = `${corners
    .map((p, i) => `${i ? "L" : "M"} ${round(p.x)} ${round(p.y)}`)
    .join(" ")} Z`
  if (!inward) return bore
  const r = round(Math.max(radius + addendum + 1, options.rim ?? radius * 1.18))
  return `M ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 Z ${bore}`
}

/**
 * The angle the driven gear has to stand at for its teeth to sit in the
 * driver's spaces, given where it is: `bearing` is the direction from the
 * driver's centre to the driven gear's, in SVG degrees.
 *
 * Differentiating it gives the ratio for free — `-N₁/N₂` for an external pair,
 * `+N₁/N₂` for a pinion running inside a ring.
 */
export function meshAngle(
  driverTeeth: number,
  driverAngle: number,
  drivenTeeth: number,
  bearing: number,
  internal = false,
): number {
  const n1 = gearTeeth(driverTeeth)
  const n2 = gearTeeth(drivenTeeth)
  const angle = Number.isFinite(driverAngle) ? driverAngle : 0
  const to = Number.isFinite(bearing) ? bearing : 0
  const half = 180 / n2
  if (internal) {
    // `bearing` runs from the ring's centre out to the pinion.
    return to + half + (angle - to) * (n1 / n2)
  }
  return to + 180 + half + (to - angle) * (n1 / n2)
}

/* -------------------------------------------------------------------------- */
/* planetary trains                                                            */
/* -------------------------------------------------------------------------- */

export interface PlanetaryTrain {
  sun: number
  planet: number
  ring: number
  /** Equally spaced planets. */
  planets: number
  /** Reduction from the sun to the carrier, with the ring held: `1 + ring/sun`. */
  ratio: number
}

/**
 * Tooth counts that actually assemble. Two constraints do the work, and both
 * are the reason a real gearbox cannot take any numbers you like:
 *
 * - the ring is `sun + 2 × planet`, so the planets reach across the annulus;
 * - `(sun + ring)` must divide by the planet count, or equally spaced planets
 *   cannot all present a tooth to the ring's spaces at once.
 *
 * `planet` is raised to the nearest count that satisfies the second, and
 * capped so neighbouring planets do not overlap.
 */
export function planetaryTrain(
  sunTeeth: number,
  planetTeeth: number,
  planets: number,
): PlanetaryTrain {
  const count = Number.isFinite(planets) ? clamp(Math.round(planets), 3, 5) : 3
  const sun = Number.isFinite(sunTeeth) ? clamp(Math.round(sunTeeth), 8, 40) : 16
  const asked = Number.isFinite(planetTeeth) ? clamp(Math.round(planetTeeth), 6, 40) : 12
  // Adjacent planets sit on a carrier of radius ∝ (sun + planet) and are
  // themselves ∝ planet across; this is the largest that still clears.
  const gap = Math.sin(Math.PI / count)
  const cap = clamp(Math.floor((sun * gap) / Math.max(0.05, 1 - gap)) - 1, 6, 40)
  const start = clamp(asked, 6, cap)
  const assembles = (teeth: number) => (2 * (sun + teeth)) % count === 0
  let planet = start
  if (!assembles(planet)) {
    // Up to the cap first, then back down — never past the clearance limit.
    for (let p = start + 1; p <= cap; p += 1) if (assembles(p)) { planet = p; break }
    for (let p = start - 1; p >= 6 && !assembles(planet); p -= 1) if (assembles(p)) planet = p
  }
  const ring = sun + 2 * planet
  return { sun, planet, ring, planets: count, ratio: 1 + ring / sun }
}

export interface PlanetaryPose {
  /** Input shaft angle, in degrees. */
  sun: number
  /** Output: the carrier, turning `ratio` times slower and the same way. */
  carrier: number
  /** Held still — and the maths says so: this does not move with the sun. */
  ring: number
  planets: { bearing: number; angle: number }[]
}

/** Where every member of a fixed-ring train stands when the sun is at `sunAngle`. */
export function planetaryPose(train: PlanetaryTrain, sunAngle: number): PlanetaryPose {
  const sun = Number.isFinite(sunAngle) ? sunAngle : 0
  const carrier = sun / train.ratio
  const planets = Array.from({ length: train.planets }, (_, i) => {
    const bearing = carrier + (i * 360) / train.planets
    return { bearing, angle: meshAngle(train.sun, sun, train.planet, bearing) }
  })
  const first = planets[0]
  return {
    sun,
    carrier,
    ring: meshAngle(train.planet, first.angle, train.ring, first.bearing, true),
    planets,
  }
}

/* -------------------------------------------------------------------------- */
/* belts                                                                       */
/* -------------------------------------------------------------------------- */

export interface Pulley {
  x: number
  y: number
  radius: number
}

export type BeltSegment =
  | { kind: "span"; from: Vec2; to: Vec2; length: number; heading: number }
  | {
      kind: "wrap"
      centre: Vec2
      radius: number
      /** Normal angles, in SVG degrees; the belt runs from `from` to `to` clockwise. */
      from: number
      to: number
      length: number
    }

export interface BeltLayout {
  segments: BeltSegment[]
  /** Wrap angle at each pulley, in degrees, in the order they were given. */
  wraps: number[]
  /** Total belt length: the spans plus the wraps. */
  length: number
  d: string
}

const wrapPositive = (degrees: number) => ((degrees % 360) + 360) % 360

/**
 * The taut path of a belt round a loop of pulleys, taken in the order given
 * and wrapping every one the same way — the outline of the set, which is what
 * a belt with nothing pushing it out of line does.
 *
 * Two pulleys of radius `r` at centres `L` apart give `2L + 2πr`, which is the
 * closed form the tests hold this to.
 */
export function beltLayout(pulleys: readonly Pulley[]): BeltLayout {
  const wheels = pulleys
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.radius > 0)
    .map((p) => ({ x: p.x, y: p.y, radius: p.radius }))
  if (wheels.length < 2) {
    return { segments: [], wraps: wheels.map(() => 0), length: 0, d: "" }
  }

  // The outward normal of the tangent leaving `i` for the next wheel. Both
  // touch points share it, which is what makes the tangent external.
  const normals = wheels.map((a, i) => {
    const b = wheels[(i + 1) % wheels.length]
    const span = Math.hypot(b.x - a.x, b.y - a.y)
    const bearing = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    const cosine = span > 0 ? clamp((a.radius - b.radius) / span, -1, 1) : 0
    return bearing - (Math.acos(cosine) * 180) / Math.PI
  })

  const segments: BeltSegment[] = []
  const wraps: number[] = []
  for (let i = 0; i < wheels.length; i += 1) {
    const wheel = wheels[i]
    const incoming = normals[(i - 1 + wheels.length) % wheels.length]
    const outgoing = normals[i]
    const sweep = wrapPositive(outgoing - incoming)
    wraps[i] = sweep
    segments.push({
      kind: "wrap",
      centre: { x: wheel.x, y: wheel.y },
      radius: wheel.radius,
      from: incoming,
      to: incoming + sweep,
      length: toRadians(sweep) * wheel.radius,
    })
    const next = wheels[(i + 1) % wheels.length]
    const from = point(wheel.x, wheel.y, wheel.radius, outgoing)
    const to = point(next.x, next.y, next.radius, outgoing)
    segments.push({
      kind: "span",
      from,
      to,
      length: Math.hypot(to.x - from.x, to.y - from.y),
      heading: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    })
  }

  const length = segments.reduce((total, segment) => total + segment.length, 0)
  const d = segments
    .map((segment, i) => {
      if (segment.kind === "span") return `L ${round(segment.to.x)} ${round(segment.to.y)}`
      const start = point(segment.centre.x, segment.centre.y, segment.radius, segment.from)
      const end = point(segment.centre.x, segment.centre.y, segment.radius, segment.to)
      const large = segment.to - segment.from > 180 ? 1 : 0
      const move = i === 0 ? `M ${round(start.x)} ${round(start.y)} ` : ""
      return `${move}A ${round(segment.radius)} ${round(segment.radius)} 0 ${large} 1 ${round(end.x)} ${round(end.y)}`
    })
    .join(" ")

  return { segments, wraps, length, d: d ? `${d} Z` : "" }
}

/** A point on the belt and the direction it is travelling, at an arc length. */
export function beltSample(layout: BeltLayout, distance: number) {
  if (!layout.length) return { x: 0, y: 0, heading: 0 }
  const along = Number.isFinite(distance)
    ? ((distance % layout.length) + layout.length) % layout.length
    : 0
  let walked = 0
  for (const segment of layout.segments) {
    if (walked + segment.length >= along || segment === layout.segments.at(-1)) {
      const t = segment.length > 0 ? (along - walked) / segment.length : 0
      if (segment.kind === "span") {
        return {
          x: segment.from.x + (segment.to.x - segment.from.x) * t,
          y: segment.from.y + (segment.to.y - segment.from.y) * t,
          heading: segment.heading,
        }
      }
      const angle = segment.from + (segment.to - segment.from) * t
      const at = point(segment.centre.x, segment.centre.y, segment.radius, angle)
      return { x: at.x, y: at.y, heading: angle + 90 }
    }
    walked += segment.length
  }
  return { x: 0, y: 0, heading: 0 }
}

/* -------------------------------------------------------------------------- */
/* energy chain                                                                */
/* -------------------------------------------------------------------------- */

export interface CarrierGeometry {
  /** Where the fixed end is anchored, in drawing units along the run. */
  anchor: number
  /** How far the carriage can travel from the anchor. */
  span: number
  /** Bend radius. The two runs sit `2 × radius` apart. */
  radius: number
  /** Link pitch along the chain. */
  pitch: number
}

export interface CarrierLink {
  index: number
  x: number
  y: number
  /** Direction of travel along the chain, in SVG degrees. */
  angle: number
}

export interface CarrierPose {
  links: CarrierLink[]
  /** Chain length: constant, which is the whole mechanism. */
  length: number
  /** Where the fold sits. It moves at half the carriage's rate. */
  bend: number
  carriage: number
}

/**
 * An energy chain folded over itself: a fixed run out from the anchor, a 180°
 * bend, and a moving run back to the carriage on the upper level.
 *
 * The chain cannot change length, so the bend has to take up half of whatever
 * the carriage does — that single fact is the mechanism, and it falls straight
 * out of solving `(bend − anchor) + πr + (bend − carriage) = length`.
 */
export function carrierLinks(travel: number, geometry: CarrierGeometry): CarrierPose {
  const radius = Number.isFinite(geometry.radius) ? Math.max(1, geometry.radius) : 8
  const span = Number.isFinite(geometry.span) ? Math.max(0, geometry.span) : 0
  const anchor = Number.isFinite(geometry.anchor) ? geometry.anchor : 0
  const pitch = Number.isFinite(geometry.pitch) ? Math.max(1, geometry.pitch) : 6
  const at = Number.isFinite(travel) ? clamp(travel, 0, 1) : 0

  const arc = Math.PI * radius
  // Enough slack that the fold never runs into the carriage at full travel.
  const length = arc + span + radius * 2
  const carriage = anchor + at * span
  const bend = (length - arc + anchor + carriage) / 2
  const lower = bend - anchor

  const count = Math.max(1, Math.floor(length / pitch))
  const links = Array.from({ length: count }, (_, index) => {
    const s = (index + 0.5) * pitch
    if (s <= lower) return { index, x: anchor + s, y: 0, angle: 0 }
    if (s <= lower + arc) {
      // Round the fold: from the lower run, over the top, onto the upper one.
      const degrees = 90 - ((s - lower) / radius) * (180 / Math.PI)
      const on = point(bend, -radius, radius, degrees)
      return { index, x: on.x, y: on.y, angle: degrees - 90 }
    }
    return { index, x: bend - (s - lower - arc), y: -2 * radius, angle: 180 }
  })

  return { links, length, bend, carriage }
}
