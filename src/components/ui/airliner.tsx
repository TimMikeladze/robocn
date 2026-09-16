"use client"

/**
 * airliner — a four-engine double-deck widebody, and the two things you can do
 * to an aeroplane on a stand: walk all the way round it, and take it to bits.
 *
 * Every other machine in the set has four cameras. This one has all of them:
 * `view` still picks the four the set names, and `azimuth` / `elevation` then
 * turn the camera to any angle at all on top of that. Which forces the thing
 * nothing else here needed — **a real painter's sort**. At 40° the starboard
 * wing is in front of the body and at 220° it is behind it, so every drawable
 * is emitted with the depth of its own centroid and the whole set is ordered
 * once a frame. No fixed draw order can be right at both.
 *
 * The skin is built as **longitudinal panels** rather than as a silhouette. A
 * fuselage with an upper deck is not a convex body — the crown fairs back down
 * behind the hump — so one hull would cut that corner off. Panels also give the
 * cutaway for free: a panel knows which way it faces, so `cutaway` drops the
 * ones facing the reader and the frames, decks, seats and cargo behind them are
 * simply there. Turn the aircraft and the cut follows the camera, which is what
 * a cutaway drawing has always done.
 *
 * **Solved**: the undercarriage. Each of the five legs swings about a fixed
 * trunnion with a two-part side stay that folds as it goes, and the stay's knee
 * is an elbow solve — `gearRetraction` in `src/lib/robocn/airframe.ts`. The
 * teardown is `explodeAssembly` from `assembly-geometry`: stages, not parts, so
 * a handed pair leaves together and nothing moves before what was fitted after
 * it is clear. The surfaces come from `controlMix`, which holds the rules a big
 * aeroplane really flies by — the slats lead the flaps, the outboard ailerons
 * lock out with the flaps up, the roll spoilers rise on the down-going wing.
 *
 * **Illustrated**: everything else. The loft is a loft, the aerofoil is a
 * thickness distribution and not a section anyone would fly, and the engines
 * are drawn rather than modelled. Nothing here computes lift, drag, load factor
 * or a stall, and the aircraft does not travel — it turns on a stand and comes
 * apart on a bench.
 *
 * Design note: docs/airliner.md.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  assemblyEnvelope,
  explodeAssembly,
  type AssemblyPart,
} from "@/lib/robocn/assembly"
import {
  controlMix,
  defaultFuselageLoft,
  defaultWingPlanform,
  fuselageRing,
  fuselageSection,
  gearRetraction,
  wingStation,
  type GearGeometry,
  type GearPose,
  type WingPlanform,
  type WingStation,
} from "@/lib/robocn/airframe"
import { clamp, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  fitFrame,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotCameraAt,
  robotSurface,
  robotViews,
  slabPath,
  type RobotPaletteProps,
  type RobotRole,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/* the frame                                                                   */
/* -------------------------------------------------------------------------- */

const VIEW_WIDTH = 300
const VIEW_HEIGHT = 240
/** Three-quarter from above: the sweep, the hump and all four engines at once. */
const NATIVE_VIEW: RobotView = "iso"

/** Degrees of camera swing per view width of pointer travel. */
const ORBIT_SWEEP = 300
const ORBIT_RISE = 150
const ORBIT_STEP = 9
/** Past this the camera is under the floor, looking up through its own ground. */
const ELEVATION_LIMIT = 88

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/* -------------------------------------------------------------------------- */
/* world geometry — x starboard, y up from the ground, z aft, nose at -z        */
/* -------------------------------------------------------------------------- */

const LOFT = defaultFuselageLoft
const PLAN = defaultWingPlanform

const RING_STEPS = 16
const ZERO: Vec3 = { x: 0, y: 0, z: 0 }

/** Where the light comes from. Fixed to the machine, never to the camera. */
const LIGHT: Vec3 = { x: -0.32, y: 0.91, z: -0.26 }

/** Where the barrel is cut into sections that come apart. */
const RADOME_END = -102
const FORWARD_END = -34
const CENTRE_END = 28
const AFT_END = 62

/** The floors, as heights above the ground. */
const MAIN_DECK = LOFT.centre - 3.4
const UPPER_DECK = LOFT.centre + 3.2
const CARGO_DECK = LOFT.centre - 8.6

/** The fin, standing on the tail. */
const FIN_BASE = LOFT.centre + LOFT.radius - 1
const FIN_PLAN: WingPlanform = {
  span: 32,
  root: 0,
  kink: 0.5,
  rootChord: 46,
  kinkChord: 32,
  tipChord: 17,
  sweep: 46,
  dihedral: 0,
  leading: 50,
  height: 0,
  twist: 0,
}

/** The tailplane, low on the upswept part of the body. */
const TAIL_PLAN: WingPlanform = {
  span: 38,
  root: 5,
  kink: 0.5,
  rootChord: 27,
  kinkChord: 19,
  tipChord: 9,
  sweep: 33,
  dihedral: 7,
  leading: 72,
  height: fuselageSection(80).centre,
  twist: 0,
}

/** Where the moving surfaces sit on the wing, as fractions of the half-span. */
const SLAT_FROM = 0.06
const FLAP_INNER: [number, number] = [0.1, 0.32]
const FLAP_OUTER: [number, number] = [0.46, 0.7]
const AILERON_INNER: [number, number] = [0.34, 0.44]
const AILERON_OUTER: [number, number] = [0.74, 0.95]
const SPOILER_FROM = 0.12
const SPOILER_TO = 0.7
/** Chord fractions: the slat, the box between them, and the trailing edge. */
const SLAT_CHORD = 0.14
const FLAP_CHORD = 0.73
const SPOILER_CHORD: [number, number] = [0.56, 0.72]
/** Where the engines hang, as fractions of the half-span. */
const ENGINE_STATIONS = [0.27, 0.56]

/* -------------------------------------------------------------------------- */
/* small vector work the drawing needs and the solver has no business owning    */
/* -------------------------------------------------------------------------- */

const finite = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

const fraction = (value: number | undefined, fallback = 0) =>
  clamp(finite(value, fallback), 0, 1)

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

const scale3 = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

const norm3 = (a: Vec3): Vec3 => {
  const length = Math.hypot(a.x, a.y, a.z)
  return length > 1e-9
    ? { x: a.x / length, y: a.y / length, z: a.z / length }
    : { x: 0, y: 1, z: 0 }
}

const centroid = (points: readonly Vec3[]): Vec3 => {
  if (points.length === 0) return { ...ZERO }
  let x = 0
  let y = 0
  let z = 0
  for (const point of points) {
    x += point.x
    y += point.y
    z += point.z
  }
  return { x: x / points.length, y: y / points.length, z: z / points.length }
}

/** An axis-aligned box as its eight corners, ready to hull. */
const boxSolid = (centre: Vec3, half: Vec3): Vec3[] =>
  [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sy) =>
      [-1, 1].map((sz) => ({
        x: centre.x + half.x * sx,
        y: centre.y + half.y * sy,
        z: centre.z + half.z * sz,
      })),
    ),
  )

/** A circle standing in the plane perpendicular to `axis`. */
function ringAbout(centre: Vec3, axis: Vec3, radius: number, steps = 12): Vec3[] {
  const n = norm3(axis)
  const seed = Math.abs(n.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const u = norm3(cross3(n, seed))
  const v = cross3(n, u)
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    const c = Math.cos(angle) * radius
    const s = Math.sin(angle) * radius
    return {
      x: centre.x + u.x * c + v.x * s,
      y: centre.y + u.y * c + v.y * s,
      z: centre.z + u.z * c + v.z * s,
    }
  })
}

/** A short cylinder: a wheel, a fan case, a nacelle bay, a leg. */
const tube = (
  from: Vec3,
  to: Vec3,
  radiusFrom: number,
  radiusTo = radiusFrom,
  steps = 12,
): Vec3[] => {
  const axis = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  return [...ringAbout(from, axis, radiusFrom, steps), ...ringAbout(to, axis, radiusTo, steps)]
}

/* -------------------------------------------------------------------------- */
/* the fuselage skin, as longitudinal panels                                    */
/* -------------------------------------------------------------------------- */

/** Stations between two z, `bias` above 1 crowding them toward `from`. */
const stations = (from: number, to: number, count: number, bias = 1): number[] =>
  Array.from({ length: count }, (_, index) => {
    const u = index / (count - 1)
    return from + (to - from) * u ** bias
  })

/** The same, crowded toward `to` instead. */
const stationsToward = (from: number, to: number, count: number, bias = 1.5): number[] =>
  Array.from({ length: count }, (_, index) => {
    const u = index / (count - 1)
    return from + (to - from) * (1 - (1 - u) ** bias)
  })

interface SkinPanel {
  /** The outline: nose to tail along one seam, back along the next. */
  points: Vec3[]
  /** Which way it faces, as a unit vector out of the body. */
  normal: Vec3
  centre: Vec3
}

interface BodySection {
  id: string
  /** The assembly part it belongs to. */
  part: string
  stations: number[]
  panels: SkinPanel[]
}

function bodySection(id: string, list: number[]): BodySection {
  const rings = list.map((z) => fuselageRing(fuselageSection(z, LOFT), RING_STEPS))
  const middle = rings[Math.floor(rings.length / 2)]
  const axis = fuselageSection(list[Math.floor(list.length / 2)], LOFT)
  const panels: SkinPanel[] = Array.from({ length: RING_STEPS }, (_, seam) => {
    const next = (seam + 1) % RING_STEPS
    const points = [
      ...rings.map((ring) => ring[seam]),
      ...[...rings].reverse().map((ring) => ring[next]),
    ]
    const a = middle[seam]
    const b = middle[next]
    return {
      points,
      // Out of the body at the middle station, which is what the cutaway culls on.
      normal: norm3({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - axis.centre, z: 0 }),
      centre: centroid(points),
    }
  })
  return { id, part: id, stations: list, panels }
}

const BODY_SECTIONS: BodySection[] = [
  bodySection("radome", stations(LOFT.nose, RADOME_END, 6, 1.6)),
  bodySection("forward", stations(RADOME_END, FORWARD_END, 9)),
  bodySection("centre", stations(FORWARD_END, CENTRE_END, 6)),
  bodySection("aft", stations(CENTRE_END, AFT_END, 4)),
  bodySection("tailcone", stationsToward(AFT_END, LOFT.tail, 8)),
]

/** The frames inside the shell, every other station and never at a closed end. */
const BODY_FRAMES = BODY_SECTIONS.flatMap((section) =>
  section.stations
    .filter((_, index) => index % 2 === 1)
    .map((z) => ({ part: section.part, ring: fuselageRing(fuselageSection(z, LOFT), RING_STEPS) })),
).filter((frame) => frame.ring.some((point) => Math.abs(point.x) > 1.5))

/* -------------------------------------------------------------------------- */
/* lifting surfaces — one planform, every panel cut out of it                   */
/* -------------------------------------------------------------------------- */

/** Thickness distribution, peaking at 1 near a quarter chord. */
const foilThickness = (c: number) => {
  const u = clamp(c, 0, 1)
  return 4.4 * (Math.sqrt(u) - u) * (1 - 0.34 * u)
}

/** Camber line, zero at both ends. */
const foilCamber = (c: number) => Math.sin(Math.PI * clamp(c, 0, 1) ** 0.9)

const CHORD_STEPS = [0, 0.12, 0.3, 0.55, 0.8, 1]

interface LiftingSurface {
  plan: WingPlanform
  /** Thickness ratio at the root and at the tip. */
  root: number
  tip: number
  /** A planform point plus an out-of-plane offset, in the world. */
  place: (station: WingStation, z: number, offset: number) => Vec3
}

interface PanelOptions {
  /** Degrees about the hinge at `chordFrom`, carrying the far edge toward `+offset`. */
  deflect?: number
  /** Travel along the chord, positive aft. */
  shift?: number
  /** Travel out of the plane, positive toward `+offset`. */
  drop?: number
  /** A fixed half-thickness instead of the aerofoil's own — a plate, a spoiler. */
  plate?: number
  /** Where the panel sits out of the chord line, in world units. */
  lift?: number
}

/**
 * The corner cloud of one patch of a lifting surface, between two spanwise
 * stations and two chord fractions. Deflection is a rotation about the hinge at
 * `chordFrom`, in the surface's own plane — which is why the same function
 * draws a flap on a wing and a rudder on a fin, and why a slat is written with
 * its chord range reversed: its hinge is the edge nearest the wing.
 */
function surfacePanel(
  surface: LiftingSurface,
  from: number,
  to: number,
  chordFrom: number,
  chordTo: number,
  options: PanelOptions = {},
): Vec3[] {
  const angle = toRadians(finite(options.deflect, 0))
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const shift = finite(options.shift, 0)
  const drop = finite(options.drop, 0)
  const lift = finite(options.lift, 0)
  const points: Vec3[] = []
  for (const t of [from, to]) {
    const station = wingStation(t, surface.plan)
    const ratio = lerp(surface.root, surface.tip, clamp(t, 0, 1))
    const hinge = station.leading + station.chord * chordFrom
    for (const step of CHORD_STEPS) {
      const c = lerp(chordFrom, chordTo, step)
      const half =
        options.plate !== undefined
          ? options.plate
          : 0.5 * ratio * station.chord * foilThickness(c)
      const mid = 0.22 * ratio * station.chord * foilCamber(c) + lift
      const dz = station.leading + station.chord * c - hinge
      for (const side of [1, -1]) {
        const off = mid + half * side
        points.push(
          surface.place(
            station,
            hinge + shift + dz * cos - off * sin,
            drop + dz * sin + off * cos,
          ),
        )
      }
    }
  }
  return points
}

const wingSurfaceFor = (side: 1 | -1): LiftingSurface => ({
  plan: PLAN,
  root: 0.13,
  tip: 0.09,
  place: (station, z, offset) => ({ x: station.x * side, y: station.y + offset, z }),
})

const WING: Record<"port" | "starboard", LiftingSurface> = {
  starboard: wingSurfaceFor(1),
  port: wingSurfaceFor(-1),
}

const FIN: LiftingSurface = {
  plan: FIN_PLAN,
  root: 0.11,
  tip: 0.09,
  place: (station, z, offset) => ({ x: offset, y: FIN_BASE + station.x, z }),
}

const tailSurfaceFor = (side: 1 | -1): LiftingSurface => ({
  plan: TAIL_PLAN,
  root: 0.11,
  tip: 0.09,
  place: (station, z, offset) => ({ x: station.x * side, y: station.y + offset, z }),
})

const TAILPLANE: Record<"port" | "starboard", LiftingSurface> = {
  starboard: tailSurfaceFor(1),
  port: tailSurfaceFor(-1),
}

/** The winglet, canted out of the vertical at the tip of each wing. */
const WINGLET_CANT = 22
const WING_TIP = wingStation(1, PLAN)

const wingletFor = (side: 1 | -1): LiftingSurface => {
  const lean = Math.sin(toRadians(WINGLET_CANT))
  const rise = Math.cos(toRadians(WINGLET_CANT))
  return {
    plan: {
      span: 14,
      root: 0,
      kink: 0.5,
      rootChord: 12,
      kinkChord: 9,
      tipChord: 5,
      sweep: 50,
      dihedral: 0,
      leading: WING_TIP.leading + WING_TIP.chord * 0.2,
      height: 0,
      twist: 0,
    },
    root: 0.11,
    tip: 0.09,
    place: (station, z, offset) => ({
      x: (WING_TIP.x + station.x * lean + offset * rise) * side,
      y: WING_TIP.y + station.x * rise - offset * lean,
      z,
    }),
  }
}

const WINGLET: Record<"port" | "starboard", LiftingSurface> = {
  starboard: wingletFor(1),
  port: wingletFor(-1),
}

/** The wing box, in strips, between the slat and the flap. */
const WING_STRIPS = Array.from({ length: 7 }, (_, index) => [index / 7, (index + 1) / 7] as const)
/** The fin and the tailplane, likewise. */
const FIN_STRIPS = Array.from({ length: 4 }, (_, index) => [index / 4, (index + 1) / 4] as const)

/** The belly fairing over the wing root: an elongated lens on the keel. */
const fairingRing = (z: number, halfWidth: number, centre: number, halfHeight: number): Vec3[] =>
  Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2
    return { x: halfWidth * Math.sin(angle), y: centre + halfHeight * Math.cos(angle), z }
  })

const WING_FAIRING = [
  ...fairingRing(-48, 6, 15, 5),
  ...fairingRing(-22, 15, 13.5, 7),
  ...fairingRing(6, 15.5, 13.5, 7.5),
  ...fairingRing(34, 8, 15, 5.5),
]

/* -------------------------------------------------------------------------- */
/* the engines                                                                  */
/* -------------------------------------------------------------------------- */

interface Nacelle {
  id: string
  index: string
  root: Vec3
  inlet: Vec3
  fan: Vec3
  core: Vec3
  exhaust: Vec3
  radius: number
}

const NACELLE_RADIUS = 5.6

const nacelleAt = (t: number, side: 1 | -1, index: number): Nacelle => {
  const station = wingStation(t, PLAN)
  const hang = station.y - 9.2
  const lip = station.leading - 24
  return {
    id: `engine-${index}`,
    index: String(index),
    root: { x: station.x * side, y: station.y - 1, z: station.leading + station.chord * 0.2 },
    inlet: { x: station.x * side, y: hang, z: lip },
    fan: { x: station.x * side, y: hang, z: lip + 13 },
    core: { x: station.x * side, y: hang + 0.6, z: lip + 22 },
    exhaust: { x: station.x * side, y: hang + 1.1, z: lip + 31 },
    radius: NACELLE_RADIUS,
  }
}

const NACELLES: Nacelle[] = [
  nacelleAt(ENGINE_STATIONS[0], -1, 1),
  nacelleAt(ENGINE_STATIONS[1], -1, 2),
  nacelleAt(ENGINE_STATIONS[1], 1, 3),
  nacelleAt(ENGINE_STATIONS[0], 1, 4),
]

/* -------------------------------------------------------------------------- */
/* the undercarriage                                                            */
/* -------------------------------------------------------------------------- */

interface GearUnit {
  id: string
  label: string
  geometry: GearGeometry
}

const WING_GEAR_STATION = 0.275
const WHEEL_RADIUS = 2.1

const wingGearTrunnion = (side: 1 | -1): Vec3 => {
  const station = wingStation(WING_GEAR_STATION, PLAN)
  return { x: station.x * side, y: station.y - 1.6, z: station.leading + station.chord * 0.78 }
}

/**
 * Five units, and the stays are laid out so that gear-down is the pose a stay
 * is *for*: anchor, knee and foot nearly in one line, which is what a lock
 * looks like. Folded, the knee breaks well clear of the leg.
 */
const GEAR_UNITS: GearUnit[] = [
  {
    id: "gear-nose",
    label: "nose",
    geometry: {
      trunnion: { x: 0, y: 12, z: -84 },
      leg: 10,
      fold: "forward",
      side: 1,
      sweep: 86,
      anchor: { x: 5, y: 5.5 },
      stayUpper: 6.8,
      stayLower: 6,
      stayFoot: 0.6,
      bend: "up",
      doorSwing: 78,
      bogieTilt: 0,
      wheel: WHEEL_RADIUS,
      axles: 1,
      axleSpacing: 0,
      wheels: 2,
      track: 3.4,
    },
  },
  ...([-1, 1] as const).map((side) => ({
    id: side === 1 ? "gear-wing-starboard" : "gear-wing-port",
    label: side === 1 ? "starboard wing" : "port wing",
    geometry: {
      trunnion: wingGearTrunnion(side),
      leg: 14.7,
      fold: "inboard" as const,
      side,
      sweep: 88,
      anchor: { x: 6, y: 6 },
      stayUpper: 9,
      stayLower: 8,
      stayFoot: 0.62,
      bend: "up" as const,
      doorSwing: 82,
      bogieTilt: 12,
      wheel: WHEEL_RADIUS,
      axles: 2,
      axleSpacing: 6.4,
      wheels: 2,
      track: 5.6,
    },
  })),
  ...([-1, 1] as const).map((side) => ({
    id: side === 1 ? "gear-body-starboard" : "gear-body-port",
    label: side === 1 ? "starboard body" : "port body",
    geometry: {
      trunnion: { x: 9.5 * side, y: 12.6, z: 24 },
      leg: 10.5,
      fold: "forward" as const,
      side,
      sweep: 84,
      anchor: { x: 5, y: 5.5 },
      stayUpper: 7,
      stayLower: 6,
      stayFoot: 0.6,
      bend: "up" as const,
      doorSwing: 74,
      bogieTilt: 12,
      wheel: WHEEL_RADIUS,
      axles: 2,
      axleSpacing: 6.4,
      wheels: 2,
      track: 5.6,
    },
  })),
]

/** Where every wheel on one bogie sits, and which way its axle points. */
function bogieWheels(unit: GearUnit, pose: GearPose): { centre: Vec3; axis: Vec3 }[] {
  const g = unit.geometry
  const swing = toRadians(pose.legAngle + pose.tilt)
  const cos = Math.cos(swing)
  const sin = Math.sin(swing)
  const hand = g.fold === "aft" ? -1 : 1
  // The beam runs along the leg's own perpendicular; the axles cross it.
  const beam: Vec3 =
    g.fold === "inboard" ? { x: 0, y: 0, z: 1 } : { x: 0, y: -sin * hand, z: cos * hand }
  const axis: Vec3 =
    g.fold === "inboard" ? { x: -g.side * cos, y: -sin, z: 0 } : { x: 1, y: 0, z: 0 }
  const spread = (count: number, gap: number) =>
    Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * gap)
  return spread(g.axles, g.axleSpacing).flatMap((along) =>
    spread(g.wheels, g.track).map((across) => ({
      centre: add(add(pose.axle, scale3(beam, along)), scale3(axis, across)),
      axis,
    })),
  )
}

/* -------------------------------------------------------------------------- */
/* the cabin                                                                    */
/* -------------------------------------------------------------------------- */

interface CabinPiece {
  id: string
  solid: Vec3[]
  role: RobotRole
  weight: number
}

const deckSlab = (
  id: string,
  from: number,
  to: number,
  y: number,
  halfWidth: number,
): CabinPiece => ({
  id,
  solid: boxSolid(
    { x: 0, y: y - 0.5, z: (from + to) / 2 },
    { x: halfWidth, y: 0.5, z: (to - from) / 2 },
  ),
  role: "metal",
  weight: 0.7,
})

const seatBlock = (id: string, z: number, y: number, halfWidth: number): CabinPiece => ({
  id,
  solid: boxSolid({ x: 0, y: y + 1.9, z }, { x: halfWidth, y: 1.4, z: 1.5 }),
  role: "dark",
  weight: 0.5,
})

const CABIN: CabinPiece[] = [
  deckSlab("deck-main", -92, 58, MAIN_DECK, 9.2),
  deckSlab("deck-upper", -104, -30, UPPER_DECK, 6.2),
  deckSlab("deck-cargo", -76, 48, CARGO_DECK, 7.4),
  {
    id: "flight-deck",
    solid: boxSolid({ x: 0, y: UPPER_DECK + 2.2, z: -106 }, { x: 4.2, y: 2.2, z: 5 }),
    role: "accent",
    weight: 0.6,
  },
  ...Array.from({ length: 14 }, (_, index) =>
    seatBlock(`seat-main-${index}`, -86 + index * 10.2, MAIN_DECK, 8.2),
  ),
  ...Array.from({ length: 6 }, (_, index) =>
    seatBlock(`seat-upper-${index}`, -94 + index * 10, UPPER_DECK, 5.2),
  ),
  // Freight, contoured to the belly, fore and aft of the wing box.
  ...[-70, -58, -46, 20, 32, 44].flatMap((z) =>
    ([-1, 1] as const).map((side) => ({
      id: `cargo-${z}-${side}`,
      solid: boxSolid({ x: 3.6 * side, y: CARGO_DECK + 3, z }, { x: 3.2, y: 2.6, z: 4.6 }),
      role: "shell" as RobotRole,
      weight: 0.5,
    })),
  ),
]

/* -------------------------------------------------------------------------- */
/* the teardown                                                                 */
/* -------------------------------------------------------------------------- */

const AIRLINER_PARTS: AssemblyPart[] = [
  { id: "centre", axis: { x: 0, y: 1, z: 0 }, travel: 0, order: 0 },
  { id: "forward", axis: { x: 0, y: 0, z: -1 }, travel: 44, order: 1 },
  { id: "aft", axis: { x: 0, y: 0, z: 1 }, travel: 40, order: 1 },
  { id: "radome", axis: { x: 0, y: 0, z: -1 }, travel: 74, order: 2 },
  { id: "tailcone", axis: { x: 0, y: 0.1, z: 1 }, travel: 66, order: 2 },
  { id: "wing-port", axis: { x: -1, y: 0.12, z: 0 }, travel: 52, order: 3 },
  { id: "wing-starboard", axis: { x: 1, y: 0.12, z: 0 }, travel: 52, order: 3 },
  { id: "fin", axis: { x: 0, y: 1, z: 0 }, travel: 42, order: 4 },
  { id: "tailplane-port", axis: { x: -1, y: 0.12, z: 0 }, travel: 40, order: 5 },
  { id: "tailplane-starboard", axis: { x: 1, y: 0.12, z: 0 }, travel: 40, order: 5 },
  { id: "rudder", axis: { x: 0, y: 0.3, z: 1 }, travel: 26, order: 6 },
  { id: "elevator-port", axis: { x: -0.2, y: 0, z: 1 }, travel: 26, order: 6 },
  { id: "elevator-starboard", axis: { x: 0.2, y: 0, z: 1 }, travel: 26, order: 6 },
  ...NACELLES.map((nacelle) => ({
    id: `pylon-${nacelle.index}`,
    axis: { x: 0, y: -1, z: 0 },
    travel: 24,
    order: 7,
  })),
  ...NACELLES.map((nacelle) => ({
    id: nacelle.id,
    axis: { x: 0, y: -0.2, z: -1 },
    travel: 36,
    order: 8,
  })),
  ...(["port", "starboard"] as const).flatMap((hand) => {
    const side = hand === "starboard" ? 1 : -1
    return [
      { id: `slat-${hand}`, axis: { x: 0.1 * side, y: -0.25, z: -1 }, travel: 22, order: 9 },
      { id: `flap-${hand}`, axis: { x: 0.1 * side, y: -0.25, z: 1 }, travel: 22, order: 9 },
      { id: `aileron-${hand}`, axis: { x: 0.35 * side, y: 0, z: 1 }, travel: 22, order: 9 },
      { id: `spoiler-${hand}`, axis: { x: 0, y: 1, z: 0.2 }, travel: 22, order: 9 },
      { id: `winglet-${hand}`, axis: { x: 0.4 * side, y: 1, z: 0 }, travel: 22, order: 9 },
    ]
  }),
  ...GEAR_UNITS.map((unit) => ({
    id: unit.id,
    axis: { x: 0, y: -1, z: 0 },
    travel: 34,
    order: 10,
  })),
  { id: "cabin", axis: { x: 0, y: -1, z: 0 }, travel: 48, order: 11 },
]

/** The box the seated aeroplane needs. The teardown grows it from here. */
const SEATED = {
  min: { x: -PLAN.span - 10, y: 0, z: LOFT.nose - 6 },
  max: { x: PLAN.span + 10, y: FIN_BASE + FIN_PLAN.span + 6, z: LOFT.tail + 6 },
}

/* -------------------------------------------------------------------------- */
/* the behaviours — pure functions of the clock                                 */
/* -------------------------------------------------------------------------- */

/** What the aeroplane does with nobody driving it. Always includes `static`. */
export type AirlinerBehavior =
  | "cruise"
  | "approach"
  | "departure"
  | "turntable"
  | "service"
  | "static"

/** Everything a behaviour drives, at one instant. */
export interface AirlinerPose {
  /** 0 clean to 1 fully dirty: slats, flaps and gear, in that order. */
  configuration: number
  /** 0 seated to 1 every part its own clearance away. */
  explode: number
  /** Degrees, nose-up positive. */
  pitch: number
  /** Degrees, starboard wing down positive. */
  roll: number
  /** Degrees, nose right positive. */
  yaw: number
  /** The speedbrake lever, 0 to 1. */
  speedbrake: number
  /** Degrees the camera has been carried round the machine. */
  spin: number
}

const PARKED: AirlinerPose = {
  configuration: 0,
  explode: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  speedbrake: 0,
  spin: 0,
}

/** A triangle: out over the first half of the cycle and back over the second. */
const there = (t: number) => (t < 0.5 ? t * 2 : 2 - t * 2)

/**
 * The whole aeroplane at `clock`, sampled rather than driven, so every
 * behaviour is testable without faking a single animation frame.
 */
export function airlinerPose(behavior: AirlinerBehavior, clock: number): AirlinerPose {
  if (!Number.isFinite(clock)) return { ...PARKED }
  const t = ((clock % 1) + 1) % 1
  const wave = Math.sin(clock * Math.PI * 2)
  switch (behavior) {
    case "cruise":
      // Clean, and holding a lazy wing-over each way.
      return { ...PARKED, roll: wave * 7, yaw: wave * 1.2, pitch: wave * 0.8 }
    case "approach":
      return {
        ...PARKED,
        configuration: 1,
        pitch: 2.6 + wave * 0.9,
        roll: Math.sin(clock * Math.PI * 2 + 1) * 3.5,
        yaw: wave * 2,
      }
    case "departure":
      // Everything coming in: the gear first, then the flaps.
      return {
        ...PARKED,
        configuration: clamp(1 - t * 1.25, 0, 1),
        pitch: 7 * (1 - t) + 1,
        roll: wave * 2.5,
      }
    case "turntable":
      return { ...PARKED, spin: t * 360 }
    case "service":
      // On a bench, turning slowly, coming apart and going back together.
      return { ...PARKED, configuration: 1, explode: there(t), spin: t * 180 }
    default:
      return { ...PARKED }
  }
}

/* -------------------------------------------------------------------------- */
/* seats and leaders                                                            */
/* -------------------------------------------------------------------------- */

/** Which body section a station belongs to, for a window's own offset. */
function sectionPartAt(z: number): string {
  if (z <= RADOME_END) return "radome"
  if (z <= FORWARD_END) return "forward"
  if (z <= CENTRE_END) return "centre"
  if (z <= AFT_END) return "aft"
  return "tailcone"
}

const BODY_SPANS: Record<string, [number, number]> = {
  radome: [LOFT.nose, RADOME_END],
  forward: [RADOME_END, FORWARD_END],
  centre: [FORWARD_END, CENTRE_END],
  aft: [CENTRE_END, AFT_END],
  tailcone: [AFT_END, LOFT.tail],
}

const handOf = (id: string) => (id.endsWith("starboard") ? 1 : -1)

/** Roughly where a part sits when it is seated, which is where its leader ends. */
function seatOf(id: string): Vec3 {
  if (id.startsWith("wing-")) {
    const station = wingStation(0.5, PLAN)
    return {
      x: station.x * handOf(id),
      y: station.y,
      z: station.leading + station.chord / 2,
    }
  }
  if (id.startsWith("engine-") || id.startsWith("pylon-")) {
    const nacelle = NACELLES.find((item) => item.index === id.slice(-1))
    return nacelle ? { ...nacelle.fan } : { ...ZERO }
  }
  if (id.startsWith("gear-")) {
    const unit = GEAR_UNITS.find((item) => item.id === id)
    return unit ? { ...unit.geometry.trunnion } : { ...ZERO }
  }
  if (id === "fin") return { x: 0, y: FIN_BASE + 16, z: FIN_PLAN.leading + 30 }
  if (id === "rudder") return { x: 0, y: FIN_BASE + 14, z: FIN_PLAN.leading + 50 }
  if (id.startsWith("tailplane-") || id.startsWith("elevator-")) {
    const station = wingStation(0.5, TAIL_PLAN)
    return {
      x: station.x * handOf(id),
      y: station.y,
      z: station.leading + station.chord / 2,
    }
  }
  if (
    id.startsWith("slat-") ||
    id.startsWith("flap-") ||
    id.startsWith("aileron-") ||
    id.startsWith("spoiler-") ||
    id.startsWith("winglet-")
  ) {
    const station = wingStation(0.6, PLAN)
    return {
      x: station.x * handOf(id),
      y: station.y,
      z: station.leading + station.chord / 2,
    }
  }
  if (id === "cabin") return { x: 0, y: MAIN_DECK, z: -20 }
  const span = BODY_SPANS[id]
  if (!span) return { ...ZERO }
  const z = (span[0] + span[1]) / 2
  return { x: 0, y: fuselageSection(z, LOFT).centre, z }
}

/* -------------------------------------------------------------------------- */
/* the component                                                                */
/* -------------------------------------------------------------------------- */

/** What a drag does: turn the aeroplane, take it apart, or work the lever. */
export type AirlinerControl = "orbit" | "explode" | "configuration"

export interface AirlinerOrbit {
  azimuth: number
  elevation: number
}

export interface AirlinerProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One aeroplane, four named projections. */
  view?: RobotView
  /**
   * Degrees the camera swings round the machine, on top of `view`. Any angle at
   * all, and it wraps: the far side is 180 either way.
   */
  azimuth?: number
  /** Degrees the camera rises above the view's own elevation, clamped to ±88. */
  elevation?: number
  onOrbitChange?: (orbit: AirlinerOrbit) => void
  /** Controlled teardown, 0 seated to 1 every part clear. Supplying it stops the loop. */
  explode?: number
  onExplodeChange?: (explode: number) => void
  /** How much the parts overlap, 0 strictly one stage at a time to 1 all together. */
  explodeOverlap?: number
  /** Dashed leaders from each part back to its seat while it is apart. */
  showLeaders?: boolean
  /** Controlled flap lever, 0 clean to 1 dirty. It runs the slats and the gear too. */
  configuration?: number
  onConfigurationChange?: (configuration: number) => void
  /** The legs on their own, 0 up to 1 down, when they should not follow the lever. */
  gear?: number
  /** Commands, in degrees. They go through the mixer, never straight onto a surface. */
  pitch?: number
  roll?: number
  yaw?: number
  /** The speedbrake lever, 0 to 1. */
  speedbrake?: number
  /** Open the reader's side of the skin, 0 closed to 1 fully cut away. */
  cutaway?: number
  /** Decks, seats and freight. Only drawn once the skin is open or apart. */
  showCabin?: boolean
  /** Frames inside the shell, likewise. */
  showStructure?: boolean
  behavior?: AirlinerBehavior
  control?: AirlinerControl
  /** Light the navigation lamps and the beacons. */
  active?: boolean
  showGround?: boolean
  interactive?: boolean
  /** Cycles per second: one teardown, one turn of the table, one circuit. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
}

/** Shortest way round: a camera turned 370 degrees is turned 10. */
const wrapTurn = (degrees: number) => ((finite(degrees, 0) % 360) + 360) % 360

/** One thing to draw, and how far from the reader it stands. */
interface Piece {
  key: string
  depth: number
  node: React.ReactNode
}

function Airliner({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  azimuth,
  elevation,
  onOrbitChange,
  explode,
  onExplodeChange,
  explodeOverlap = 0.45,
  showLeaders = true,
  configuration,
  onConfigurationChange,
  gear,
  pitch,
  roll,
  yaw,
  speedbrake,
  cutaway = 0,
  showCabin = true,
  showStructure = true,
  behavior = "cruise",
  control = "orbit",
  active = true,
  showGround = true,
  interactive = false,
  speed = 0.24,
  animate = true,
  paused = false,
  phase = 0,
  label,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: AirlinerProps) {
  const palette = resolveRobotPalette({
    color,
    accent,
    metal,
    dark,
    glow,
    grid,
    palette: paletteOverride,
  })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlledExplode = explode !== undefined
  const controlledConfiguration = configuration !== undefined
  // The loop eases whichever channel a person can hold; the other is sampled
  // from the behaviour off the same clock.
  const grabsConfiguration = control === "configuration"
  const pinned = grabsConfiguration
    ? controlledConfiguration
      ? fraction(configuration)
      : held
    : controlledExplode
      ? fraction(explode)
      : held

  const goal = React.useCallback(
    (clock: number) => {
      const pose = airlinerPose(behavior, clock)
      return grabsConfiguration ? pose.configuration : pose.explode
    },
    [behavior, grabsConfiguration],
  )
  const motion = useRobotScalar(goal, {
    rate: grabsConfiguration ? 0.55 : 0.5,
    hold: pinned,
    speed,
    paused,
    phase,
    animate: animate && behavior !== "static" && !(controlledExplode && controlledConfiguration),
  })
  const sampled = airlinerPose(behavior, motion.clock)

  const apart = controlledExplode
    ? fraction(explode)
    : grabsConfiguration
      ? sampled.explode
      : clamp(motion.value, 0, 1)
  const lever = controlledConfiguration
    ? fraction(configuration)
    : grabsConfiguration
      ? clamp(motion.value, 0, 1)
      : sampled.configuration

  /* Exploding parks the aeroplane. An offset from a seat that is itself moving
     means nothing, so the surfaces go neutral and the gear goes down over the
     first sixth of the teardown. */
  const parked = clamp(apart / 0.16, 0, 1)
  const mix = controlMix({
    pitch: lerp(finite(pitch, sampled.pitch), 0, parked),
    roll: lerp(finite(roll, sampled.roll), 0, parked),
    yaw: lerp(finite(yaw, sampled.yaw), 0, parked),
    configuration: lerp(lever, 1, parked),
    speedbrake: lerp(fraction(speedbrake, sampled.speedbrake), 0, parked),
  })
  const legs = gear !== undefined ? fraction(gear) : Math.max(mix.gear, parked)
  /** The solver runs on retraction, so a leg that is down is zero. */
  const retraction = 1 - legs

  /* The camera: the view's own angles, plus however far it has been turned. */
  const [turned, setTurned] = React.useState<AirlinerOrbit>({ azimuth: 0, elevation: 0 })
  const orbit: AirlinerOrbit = {
    azimuth: azimuth !== undefined ? finite(azimuth, 0) : turned.azimuth + sampled.spin,
    elevation: clamp(
      elevation !== undefined ? finite(elevation, 0) : turned.elevation,
      -ELEVATION_LIMIT,
      ELEVATION_LIMIT,
    ),
  }
  const stance = robotViews[view] ?? robotViews.iso
  const swung = wrapTurn(orbit.azimuth)
  const camera =
    swung === 0 && orbit.elevation === 0
      ? robotCamera(view)
      : robotCameraAt(
          stance.azimuth + swung,
          clamp(stance.elevation + orbit.elevation, -90, 90),
          view,
        )

  /* The teardown, and the frame it needs. The envelope is grown by `explode`
     alone, so the framing zooms out when the machine comes apart and never
     breathes with a surface or a leg. */
  const exploded = explodeAssembly(AIRLINER_PARTS, apart, {
    overlap: clamp(finite(explodeOverlap, 0.45), 0, 1),
  })
  const offsets = new Map(exploded.map((part) => [part.id, part.offset]))
  const offsetOf = (id: string): Vec3 => offsets.get(id) ?? ZERO
  const envelope = assemblyEnvelope(AIRLINER_PARTS, apart, SEATED)
  const frame = fitFrame(
    boxCorners(envelope.min, envelope.max),
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    10,
    1.3,
  )

  /* Projection. Every drawable goes through these and nothing else. */
  const at = (point: Vec3, offset: Vec3 = ZERO): Vec2 =>
    camera.project(point.x + offset.x, point.y + offset.y, point.z + offset.z)
  const depthAt = (point: Vec3, offset: Vec3 = ZERO) =>
    camera.depth(point.x + offset.x, point.y + offset.y, point.z + offset.z)
  const hull = (points: readonly Vec3[], offset: Vec3 = ZERO) =>
    slabPath(
      points.map((point) => add(point, offset)),
      camera,
    )
  const outline = (points: readonly Vec3[], offset: Vec3 = ZERO) => {
    if (points.length === 0) return ""
    const drawn = points.map((point) => at(point, offset))
    return `${drawn.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
  }

  /** Which way the camera looks, so a panel knows whether it faces the reader. */
  const sight = norm3({
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  })
  const facing = (normal: Vec3) => normal.x * sight.x + normal.y * sight.y + normal.z * sight.z
  const cut = fraction(cutaway)
  /** Above this, a panel stands between the reader and the inside, so it opens.
   * At a full cut that is exactly the near hemisphere, and no more. */
  const cutThreshold = 1 - cut
  /** Nothing inside the shell is drawn while the shell is closed and opaque. */
  const inside = cut > 0.001 || apart > 0.001 || variant !== "solid"

  const shell = robotSurface("shell", variant, palette)
  const skin = robotSurface("shell", variant, palette, 0.55)
  const machined = robotSurface("metal", variant, palette, 0.7)
  const cast = robotSurface("dark", variant, palette, 0.7)
  const fine = robotSurface("metal", variant, palette, 0.45)

  const pieces: Piece[] = []
  const emit = (
    key: string,
    points: readonly Vec3[],
    offset: Vec3,
    node: React.ReactNode,
    bias = 0,
  ) => {
    pieces.push({ key, depth: depthAt(centroid(points), offset) + bias, node })
  }

  /* ---- the skin ---------------------------------------------------------- */

  for (const section of BODY_SECTIONS) {
    const offset = offsetOf(section.part)
    section.panels.forEach((panel, index) => {
      const face = facing(panel.normal)
      const path = outline(panel.points, offset)
      // A cut panel is not deleted: its outline stays, so the silhouette of the
      // aeroplane survives the reader's side being opened.
      if (cut > 0 && face > cutThreshold) {
        emit(
          `${section.id}-cut-${index}`,
          panel.points,
          offset,
          <path
            data-cut-panel={`${section.id}-${index}`}
            d={path}
            fill="none"
            stroke={palette.metal}
            strokeWidth={0.4}
            opacity={0.32}
          />,
        )
        return
      }
      // Flat paint with no shading reads as a corrugated tube rather than a
      // body, so every panel carries a wash from a fixed light. Fixed, not from
      // the camera: a fuselage should not change which side of it is lit when
      // the reader walks round it.
      const lit =
        panel.normal.x * LIGHT.x + panel.normal.y * LIGHT.y + panel.normal.z * LIGHT.z
      const shade = variant === "solid" ? (1 - lit) * 0.13 : 0
      emit(
        `${section.id}-skin-${index}`,
        panel.points,
        offset,
        <g data-fuselage={section.id} data-panel={index}>
          <path d={path} {...skin} />
          {shade > 0 && <path d={path} fill={palette.dark} stroke="none" opacity={px(shade)} />}
        </g>,
      )
    })
  }

  if (showStructure && inside) {
    BODY_FRAMES.forEach((ring, index) => {
      const offset = offsetOf(ring.part)
      emit(
        `frame-${index}`,
        ring.ring,
        offset,
        <path
          data-frame-ring={index}
          d={outline(ring.ring, offset)}
          fill="none"
          stroke={palette.metal}
          strokeWidth={0.7}
          opacity={0.7}
        />,
      )
    })
  }

  /* ---- windows, on the skin and following its curvature ------------------ */

  const windowBand = (id: string, from: number, to: number, angle: number, side: 1 | -1) => {
    const marks: string[] = []
    const seen: Vec3[] = []
    const theta = toRadians(angle)
    const lobe = Math.max(0, Math.cos(theta)) ** 1.25
    for (let z = from; z <= to; z += 7.4) {
      const section = fuselageSection(z, LOFT)
      if (section.radius < 5) continue
      const point: Vec3 = {
        x: section.radius * Math.sin(theta) * (1 - 0.2 * section.humpFraction * lobe) * side,
        y: section.centre + section.radius * Math.cos(theta) + section.hump * lobe,
        z,
      }
      if (facing(norm3({ x: point.x, y: point.y - section.centre, z: 0 })) < 0.15) continue
      const offset = offsetOf(sectionPartAt(z))
      marks.push(
        outline(
          [
            { ...point, z: z - 1.4 },
            { ...point, z: z + 1.4 },
            { x: point.x, y: point.y - 1.4, z: z + 1.4 },
            { x: point.x, y: point.y - 1.4, z: z - 1.4 },
          ],
          offset,
        ),
      )
      seen.push(add(point, offset))
    }
    if (seen.length === 0) return
    pieces.push({
      key: `windows-${id}`,
      depth: depthAt(centroid(seen)) + 1.6,
      node: (
        <path
          data-windows={id}
          d={marks.join(" ")}
          fill={palette.dark}
          stroke="none"
          opacity={0.85}
        />
      ),
    })
  }

  for (const side of [-1, 1] as const) {
    windowBand(`main-${side === 1 ? "starboard" : "port"}`, -90, 56, 88, side)
    windowBand(`upper-${side === 1 ? "starboard" : "port"}`, -96, -34, 50, side)
  }

  /* ---- the wing, and everything hinged to it ----------------------------- */

  const fairingOffset = offsetOf("centre")
  emit(
    "wing-fairing",
    WING_FAIRING,
    fairingOffset,
    <path data-fairing d={hull(WING_FAIRING, fairingOffset)} {...shell} />,
  )

  for (const hand of ["port", "starboard"] as const) {
    const side = hand === "starboard" ? 1 : -1
    const surface = WING[hand]
    const wingOffset = offsetOf(`wing-${hand}`)

    WING_STRIPS.forEach(([from, to], index) => {
      const solid = surfacePanel(surface, from, to, SLAT_CHORD, FLAP_CHORD)
      emit(
        `wing-${hand}-${index}`,
        solid,
        wingOffset,
        <path data-wing={hand} data-strip={index} d={hull(solid, wingOffset)} {...shell} />,
      )
    })

    // Leading-edge slats. The chord range is reversed because the hinge is the
    // edge nearest the wing, which is what drops the nose of the slat.
    const slatOffset = offsetOf(`slat-${hand}`)
    for (let index = 0; index < 5; index += 1) {
      const from = lerp(SLAT_FROM, 1, index / 5)
      const to = lerp(SLAT_FROM, 1, (index + 1) / 5)
      const solid = surfacePanel(surface, from, to, SLAT_CHORD, 0, {
        deflect: mix.slat,
        shift: -mix.slatExtension * 3.4,
        drop: -mix.slatExtension * 1.2,
      })
      emit(
        `slat-${hand}-${index}`,
        solid,
        slatOffset,
        <path data-slat={hand} data-bay={index} d={hull(solid, slatOffset)} {...machined} />,
      )
    }

    // Fowler flaps: aft first, then down.
    const flapOffset = offsetOf(`flap-${hand}`)
    for (const [index, range] of [FLAP_INNER, FLAP_OUTER].entries()) {
      const solid = surfacePanel(surface, range[0], range[1], FLAP_CHORD, 1, {
        deflect: -mix.flap,
        shift: mix.flapExtension * 9,
        drop: -mix.flapExtension * 2.2,
      })
      emit(
        `flap-${hand}-${index}`,
        solid,
        flapOffset,
        <path data-flap={hand} data-bay={index} d={hull(solid, flapOffset)} {...machined} />,
      )
    }

    // Ailerons, differential. The outboard pair is asleep until the flaps are out.
    const aileronOffset = offsetOf(`aileron-${hand}`)
    for (const [index, range] of [AILERON_INNER, AILERON_OUTER].entries()) {
      const demand = index === 0 ? mix.aileronInboard : mix.aileronOutboard
      const solid = surfacePanel(surface, range[0], range[1], FLAP_CHORD, 1, {
        deflect: -demand * side,
      })
      emit(
        `aileron-${hand}-${index}`,
        solid,
        aileronOffset,
        <path data-aileron={hand} data-bay={index} d={hull(solid, aileronOffset)} {...cast} />,
      )
    }

    // Spoilers, on the upper surface only, hinged at their leading edge.
    const spoilerOffset = offsetOf(`spoiler-${hand}`)
    const raised = side === 1 ? mix.spoilerStarboard : mix.spoilerPort
    for (let index = 0; index < 4; index += 1) {
      const from = lerp(SPOILER_FROM, SPOILER_TO, index / 4)
      const to = lerp(SPOILER_FROM, SPOILER_TO, (index + 1) / 4) - 0.012
      const solid = surfacePanel(surface, from, to, SPOILER_CHORD[0], SPOILER_CHORD[1], {
        deflect: raised,
        plate: 0.4,
        lift: 1.2,
      })
      emit(
        `spoiler-${hand}-${index}`,
        solid,
        spoilerOffset,
        <path data-spoiler={hand} data-bay={index} d={hull(solid, spoilerOffset)} {...fine} />,
        0.6,
      )
    }

    // The winglet, canted out of the vertical at the tip.
    const wingletOffset = offsetOf(`winglet-${hand}`)
    const winglet = surfacePanel(WINGLET[hand], 0, 1, 0, 1)
    emit(
      `winglet-${hand}`,
      winglet,
      wingletOffset,
      <path data-winglet={hand} d={hull(winglet, wingletOffset)} {...shell} />,
    )
  }

  /* ---- the empennage ----------------------------------------------------- */

  const finOffset = offsetOf("fin")
  FIN_STRIPS.forEach(([from, to], index) => {
    const solid = surfacePanel(FIN, from, to, 0, FLAP_CHORD)
    emit(
      `fin-${index}`,
      solid,
      finOffset,
      <path data-fin={index} d={hull(solid, finOffset)} {...shell} />,
    )
  })

  const rudderOffset = offsetOf("rudder")
  ;([[0, 0.5], [0.5, 1]] as const).forEach((range, index) => {
    const solid = surfacePanel(FIN, range[0], range[1], FLAP_CHORD, 1, { deflect: mix.rudder })
    emit(
      `rudder-${index}`,
      solid,
      rudderOffset,
      <path data-rudder={index} d={hull(solid, rudderOffset)} {...cast} />,
    )
  })

  for (const hand of ["port", "starboard"] as const) {
    const surface = TAILPLANE[hand]
    const tailOffset = offsetOf(`tailplane-${hand}`)
    FIN_STRIPS.forEach(([from, to], index) => {
      const solid = surfacePanel(surface, from, to, 0, FLAP_CHORD, { deflect: -mix.stabiliser })
      emit(
        `tailplane-${hand}-${index}`,
        solid,
        tailOffset,
        <path data-tailplane={hand} data-strip={index} d={hull(solid, tailOffset)} {...shell} />,
      )
    })
    const elevatorOffset = offsetOf(`elevator-${hand}`)
    const elevator = surfacePanel(surface, 0.04, 0.96, FLAP_CHORD, 1, {
      deflect: -mix.stabiliser - mix.elevator,
    })
    emit(
      `elevator-${hand}`,
      elevator,
      elevatorOffset,
      <path data-elevator={hand} d={hull(elevator, elevatorOffset)} {...cast} />,
    )
  }

  /* ---- the engines ------------------------------------------------------- */

  for (const nacelle of NACELLES) {
    const pylonOffset = offsetOf(`pylon-${nacelle.index}`)
    const pylon = [
      ...boxSolid(nacelle.root, { x: 1.5, y: 1.6, z: 9 }),
      ...boxSolid(
        { x: nacelle.fan.x, y: nacelle.fan.y + 4.4, z: nacelle.fan.z - 2 },
        { x: 1.5, y: 1.8, z: 6 },
      ),
    ]
    emit(
      `pylon-${nacelle.index}`,
      pylon,
      pylonOffset,
      <path data-pylon={nacelle.index} d={hull(pylon, pylonOffset)} {...cast} />,
    )

    const engineOffset = offsetOf(nacelle.id)
    const inlet = tube(nacelle.inlet, nacelle.fan, nacelle.radius * 0.93, nacelle.radius)
    const cowl = tube(nacelle.fan, nacelle.core, nacelle.radius, nacelle.radius * 0.72)
    const jet = tube(nacelle.core, nacelle.exhaust, nacelle.radius * 0.62, nacelle.radius * 0.4)
    const face = ringAbout(
      nacelle.inlet,
      {
        x: nacelle.exhaust.x - nacelle.inlet.x,
        y: nacelle.exhaust.y - nacelle.inlet.y,
        z: nacelle.exhaust.z - nacelle.inlet.z,
      },
      nacelle.radius * 0.78,
      12,
    )
    emit(
      `${nacelle.id}-body`,
      [...inlet, ...cowl, ...jet],
      engineOffset,
      <g data-engine={nacelle.index}>
        <path d={hull(jet, engineOffset)} {...cast} />
        <path d={hull(cowl, engineOffset)} {...machined} />
        <path d={hull(inlet, engineOffset)} {...shell} />
        <path
          data-fan={nacelle.index}
          d={outline(face, engineOffset)}
          fill={palette.dark}
          stroke={palette.metal}
          strokeWidth={0.5}
          opacity={0.9}
        />
      </g>,
    )
  }

  /* ---- the undercarriage ------------------------------------------------- */

  for (const unit of GEAR_UNITS) {
    const pose = gearRetraction(retraction, unit.geometry)
    const gearOffset = offsetOf(unit.id)
    const wheels = bogieWheels(unit, pose)
    const leg = tube(pose.trunnion, pose.axle, 1.5, 1.1, 8)
    const stayUpper = tube(pose.anchor, pose.knee, 0.8, 0.8, 6)
    const stayLower = tube(pose.knee, pose.foot, 0.8, 0.8, 6)
    emit(
      unit.id,
      [...leg, ...wheels.map((wheel) => wheel.centre)],
      gearOffset,
      <g data-gear={unit.id.replace("gear-", "")}>
        <path data-stay="upper" d={hull(stayUpper, gearOffset)} {...fine} />
        <path data-stay="lower" d={hull(stayLower, gearOffset)} {...fine} />
        <path data-leg d={hull(leg, gearOffset)} {...machined} />
        {wheels.map((wheel, index) => (
          <path
            key={index}
            data-wheel={index}
            d={hull(
              tube(
                add(wheel.centre, scale3(wheel.axis, -1.2)),
                add(wheel.centre, scale3(wheel.axis, 1.2)),
                unit.geometry.wheel,
                unit.geometry.wheel,
                10,
              ),
              gearOffset,
            )}
            {...cast}
          />
        ))}
      </g>,
    )
  }

  /* ---- the cabin --------------------------------------------------------- */

  if (showCabin && inside) {
    const cabinOffset = offsetOf("cabin")
    for (const piece of CABIN) {
      emit(
        piece.id,
        piece.solid,
        cabinOffset,
        <path
          data-cabin={piece.id}
          d={hull(piece.solid, cabinOffset)}
          {...robotSurface(piece.role, variant, palette, piece.weight)}
        />,
      )
    }
  }

  /* ---- the lamps --------------------------------------------------------- */

  if (active) {
    const lamps: { id: string; point: Vec3; part: string }[] = [
      { id: "port", point: { x: -WING_TIP.x, y: WING_TIP.y + 1, z: WING_TIP.leading }, part: "wing-port" },
      { id: "starboard", point: { x: WING_TIP.x, y: WING_TIP.y + 1, z: WING_TIP.leading }, part: "wing-starboard" },
      { id: "tail", point: { x: 0, y: FIN_BASE + FIN_PLAN.span - 2, z: FIN_PLAN.leading + 46 }, part: "fin" },
      { id: "beacon", point: { x: 0, y: fuselageSection(10, LOFT).crown + 1, z: 10 }, part: "centre" },
    ]
    for (const lamp of lamps) {
      const offset = offsetOf(lamp.part)
      const point = at(lamp.point, offset)
      pieces.push({
        key: `lamp-${lamp.id}`,
        depth: depthAt(lamp.point, offset) + 3,
        node: (
          <circle
            data-lamp={lamp.id}
            cx={px(point.x)}
            cy={px(point.y)}
            r={1.6}
            fill={palette.accent}
            opacity={0.95}
          />
        ),
      })
    }
  }

  pieces.sort((a, b) => a.depth - b.depth)

  const leaders =
    showLeaders && apart > 0.001
      ? exploded
          .filter((part) => part.distance > 0.5)
          .map((part) => {
            const seat = seatOf(part.id)
            const from = at(seat, part.offset)
            const to = at(seat)
            return (
              <path
                key={part.id}
                data-leader={part.id}
                d={`M ${px(from.x)} ${px(from.y)} L ${px(to.x)} ${px(to.y)}`}
                fill="none"
                stroke={palette.grid}
                strokeWidth={0.5}
                strokeDasharray="2 2.5"
                opacity={0.5}
              />
            )
          })
      : null

  /* ---- interaction ------------------------------------------------------- */

  // The drag callbacks have to keep the same identity across renders or the
  // listeners rebind every frame, so what they need from this render is handed
  // over through a ref after it commits rather than through their own closure.
  const sceneRef = React.useRef({ control, turned })
  React.useEffect(() => {
    sceneRef.current = { control, turned }
  })
  /** Where the pointer was last, so a turn works on the movement, not the spot. */
  const traceRef = React.useRef<Vec2 | null>(null)
  const modifierRef = React.useRef(false)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      if (sceneRef.current.control === "configuration") onConfigurationChange?.(bounded)
      else onExplodeChange?.(bounded)
    },
    [onConfigurationChange, onExplodeChange],
  )

  const turnTo = React.useCallback(
    (next: AirlinerOrbit) => {
      const bounded = {
        azimuth: wrapTurn(next.azimuth),
        elevation: clamp(finite(next.elevation, 0), -ELEVATION_LIMIT, ELEVATION_LIMIT),
      }
      sceneRef.current = { ...sceneRef.current, turned: bounded }
      setTurned(bounded)
      onOrbitChange?.(bounded)
    },
    [onOrbitChange],
  )

  const onDrag = React.useCallback(
    (point: Vec2) => {
      const scene = sceneRef.current
      // Shift swaps the turntable for the teardown and back, so one pointer
      // reaches both without leaving the drawing.
      const tool =
        scene.control === "orbit"
          ? modifierRef.current
            ? "scalar"
            : "orbit"
          : modifierRef.current
            ? "orbit"
            : "scalar"
      if (tool === "scalar") {
        traceRef.current = null
        apply(point.x)
        return
      }
      const last = traceRef.current
      traceRef.current = point
      if (!last) return
      turnTo({
        azimuth: scene.turned.azimuth - (point.x - last.x) * ORBIT_SWEEP,
        elevation: scene.turned.elevation - (point.y - last.y) * ORBIT_RISE,
      })
    },
    [apply, turnTo],
  )

  const onDragEnd = React.useCallback(() => {
    traceRef.current = null
    setHeld(null)
  }, [])

  const dragging = useRobotDrag(svgRef, { enabled: interactive, onDrag, onDragEnd })

  const holdsScalar = control !== "orbit"
  const current = grabsConfiguration ? lever : apart
  const readout = Math.round(current * 100)
  const apartPercent = Math.round(apart * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? (holdsScalar ? "slider" : "application") : "img")}
      aria-label={
        ariaLabel ??
        `Airliner, ${apartPercent === 0 ? "assembled" : `${apartPercent} percent apart`}, ${
          legs > 0.5 ? "gear down" : "gear up"
        }, flaps ${Math.round(mix.flap)} degrees, ${viewNames[view] ?? viewNames.iso}${
          swung === 0 && orbit.elevation === 0
            ? ""
            : ` turned ${Math.round(swung)} degrees, ${Math.round(orbit.elevation)} degrees above`
        }`
      }
      aria-valuemin={interactive && holdsScalar ? 0 : undefined}
      aria-valuemax={interactive && holdsScalar ? 100 : undefined}
      aria-valuenow={interactive && holdsScalar ? readout : undefined}
      aria-valuetext={
        interactive && holdsScalar
          ? grabsConfiguration
            ? `${readout} percent dirty`
            : `${readout} percent apart`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onPointerDownCapture={(event) => {
        // Read the modifier before the drag listener on the element sees the
        // press, which is what the capture phase is for.
        modifierRef.current = event.shiftKey
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        if (holdsScalar) {
          const delta = arrowStep(event.key, event.shiftKey ? 0.15 : 0.05, 0.25)
          if (delta !== 0) apply(current + delta)
          else if (event.key === "Home") apply(0)
          else if (event.key === "End") apply(1)
          else return
          event.preventDefault()
          return
        }
        const step = event.shiftKey ? ORBIT_STEP * 3 : ORBIT_STEP
        // From the ref, not from this render: two presses in one tick would
        // otherwise both read the same angle and the second would undo the first.
        const from = sceneRef.current.turned
        if (event.key === "ArrowLeft") turnTo({ ...from, azimuth: from.azimuth + step })
        else if (event.key === "ArrowRight") turnTo({ ...from, azimuth: from.azimuth - step })
        else if (event.key === "ArrowUp") turnTo({ ...from, elevation: from.elevation + step })
        else if (event.key === "ArrowDown") turnTo({ ...from, elevation: from.elevation - step })
        else if (event.key === "Home") turnTo({ azimuth: 0, elevation: 0 })
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <path
          d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 16}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-frame data-view={view} data-tool={control} transform={frame.transform || undefined}>
        {showGround && (
          // Drawn in the plan plane and pushed through the camera, so it is the
          // machine's own footprint from every angle rather than a circle that
          // happens to be under it.
          <g transform={camera.plane(0) || undefined} opacity={0.12}>
            <ellipse data-ground cx={0} cy={-6} rx={px(PLAN.span * 0.86)} ry={112} fill={palette.dark} />
          </g>
        )}
        {pieces.map((piece) => (
          <React.Fragment key={piece.key}>{piece.node}</React.Fragment>
        ))}
        {leaders}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 6}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

export { Airliner }
