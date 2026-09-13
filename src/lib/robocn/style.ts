/**
 * robocn — shared visual language.
 *
 * Colour, size and form live here so every machine in the set reacts to the
 * same props. Colours resolve prop -> CSS variable -> built-in default, which
 * is what lets one install theme itself while a single arm can still be
 * overridden inline.
 */

import {
  add2,
  convexHull2,
  normalize2,
  perpendicular2,
  scale2,
  sub2,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

export type RobotSize = "xs" | "sm" | "md" | "lg" | "xl"

/** Rendered width in pixels. Geometry is fixed in the viewBox, so this only scales. */
export const robotSizes: Record<RobotSize, number> = {
  xs: 96,
  sm: 144,
  md: 224,
  lg: 320,
  xl: 448,
}

export const resolveRobotSize = (size: RobotSize | number = "md") =>
  typeof size === "number" ? size : robotSizes[size]

/** How a machine is drawn. Geometry never changes — only how it is painted. */
export type RobotVariant = "solid" | "outline" | "blueprint" | "wire"

/** End effector. Robots carry exactly one, and it is visible at a glance. */
export type RobotTool =
  | "gripper"
  | "welder"
  | "painter"
  | "cutter"
  | "scanner"
  | "vacuum"
  | "magnet"
  | "none"

/** What drives the tool tip when the component is not given a `target`. */
export type RobotBehavior = "pointer" | "orbit" | "sweep" | "idle" | "static"

/** Where the machine is bolted down. Flips or rotates the whole rig. */
export type RobotMount = "floor" | "ceiling" | "wall-left" | "wall-right"

export interface RobotPalette {
  /** Painted body panels — the colour people read as "the robot's colour". */
  shell: string
  /** Bare machined metal: collars, bolts, tool bodies. */
  metal: string
  /** Cast joints, base, shadow side. */
  dark: string
  /** Status colour: tip light, active tool, live readouts. */
  accent: string
  /** Emissive halo around the accent. */
  glow: string
  /** Blueprint grid and dimension lines. */
  grid: string
  /** Labels and annotations. */
  foreground: string
}

/**
 * Each role falls back through its own CSS variable, so `--robot-shell` set on
 * `:root` (or on any ancestor) retints every robot underneath it.
 */
export const defaultRobotPalette: RobotPalette = {
  shell: "var(--robot-shell, oklch(0.72 0.17 47))",
  metal: "var(--robot-metal, oklch(0.74 0.012 250))",
  dark: "var(--robot-dark, oklch(0.32 0.02 250))",
  accent: "var(--robot-accent, oklch(0.84 0.15 176))",
  glow: "var(--robot-glow, oklch(0.84 0.15 176))",
  grid: "var(--robot-grid, oklch(0.68 0.02 250))",
  foreground: "var(--robot-foreground, currentColor)",
}

export interface RobotPaletteProps {
  /** Shorthand for the shell colour. */
  color?: string
  accent?: string
  metal?: string
  dark?: string
  glow?: string
  grid?: string
  /** Escape hatch: override any subset of roles at once. */
  palette?: Partial<RobotPalette>
}

export function resolveRobotPalette({
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette,
}: RobotPaletteProps = {}): RobotPalette {
  return {
    ...defaultRobotPalette,
    ...palette,
    ...(color ? { shell: color } : null),
    ...(metal ? { metal } : null),
    ...(dark ? { dark } : null),
    ...(accent ? { accent, glow: glow ?? accent } : null),
    ...(glow ? { glow } : null),
    ...(grid ? { grid } : null),
  }
}

export type RobotRole = "shell" | "metal" | "dark" | "accent"

export interface RobotSurface {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  /** Washes the fill out without touching the outline. */
  fillOpacity?: number
}

/**
 * Paint for one part. `weight` scales the outline with the part's size so a
 * base plate and a bolt do not carry the same line.
 */
export function robotSurface(
  role: RobotRole,
  variant: RobotVariant,
  palette: RobotPalette,
  weight = 1,
): RobotSurface {
  const color = palette[role]
  switch (variant) {
    case "outline":
      return { fill: "none", stroke: color, strokeWidth: 1.1 * weight }
    case "blueprint":
      // Solid technical outline over a washed fill, the way a drawing reads.
      return {
        fill: color,
        stroke: role === "dark" ? palette.grid : color,
        strokeWidth: 0.8 * weight,
        strokeDasharray: role === "dark" ? "2 1.5" : undefined,
        fillOpacity: role === "accent" ? 0.9 : 0.12,
      }
    case "wire":
      return {
        fill: "none",
        stroke: role === "accent" ? color : palette.grid,
        strokeWidth: 0.9 * weight,
      }
    default:
      return {
        fill: color,
        stroke: palette.dark,
        strokeWidth: role === "dark" ? 0 : 0.6 * weight,
      }
  }
}

/** Limb colour alternates down the chain so segments read as separate parts. */
export const linkRole = (index: number): RobotRole =>
  index % 2 === 0 ? "shell" : "metal"

/**
 * Round a coordinate before it reaches the DOM. Trigonometry differs in the
 * last bits between Node and the browser, and unrounded values show up as
 * hydration mismatches; two decimals is also plenty of precision to draw with.
 */
export const px = (value: number) => Number(value.toFixed(2))

/** True when the visitor has asked the OS for less animation. */
export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Transform for the drawing group: origin at the machine's base with `y`
 * pointing up, which is how the kinematics thinks, and mirrored or rotated for
 * the mount. Everything downstream can then be written in robot coordinates.
 */
export function mountTransform(
  mount: RobotMount,
  width: number,
  height: number,
  floor: number,
) {
  switch (mount) {
    // Hanging: mirror the vertical axis only, so the machine reads the same
    // way up-side-down instead of also flipping left to right.
    case "ceiling":
      return `translate(${width / 2} ${floor})`
    case "wall-left":
      return `translate(${floor} ${height / 2}) rotate(-90)`
    case "wall-right":
      return `translate(${width - floor} ${height / 2}) rotate(90) scale(-1 1)`
    default:
      return `translate(${width / 2} ${height - floor}) scale(1 -1)`
  }
}

/**
 * Counter-transform for labels. The drawing group is mirrored or rotated so the
 * geometry can be written the way the kinematics thinks; text has to be turned
 * back the right way up inside it.
 */
export function labelTransform(mount: RobotMount) {
  switch (mount) {
    case "ceiling":
      return ""
    case "wall-left":
      return "rotate(90)"
    case "wall-right":
      return "scale(-1 1) rotate(-90)"
    default:
      return "scale(1 -1)"
  }
}

/**
 * A limb: the rectangle between two joints, capped with a half circle at each
 * end. Every machine in the set is drawn out of these, so a gantry rail and an
 * elbow limb share one silhouette language.
 */
export function capsulePath(a: Vec2, b: Vec2, radius: number) {
  const direction = normalize2(sub2(b, a), { x: 1, y: 0 })
  const side = scale2(perpendicular2(direction), radius)
  const a1 = add2(a, side)
  const b1 = add2(b, side)
  const b2 = sub2(b, side)
  const a2 = sub2(a, side)
  const r = px(radius)
  return [
    `M ${px(a1.x)} ${px(a1.y)}`,
    `L ${px(b1.x)} ${px(b1.y)}`,
    `A ${r} ${r} 0 0 0 ${px(b2.x)} ${px(b2.y)}`,
    `L ${px(a2.x)} ${px(a2.y)}`,
    `A ${r} ${r} 0 0 0 ${px(a1.x)} ${px(a1.y)}`,
    "Z",
  ].join(" ")
}

/* -------------------------------------------------------------------------- */
/* views                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where the camera stands. Geometry never changes between views — a machine is
 * modelled once and projected, so heading, guards and blades stay truthful from
 * every angle instead of being redrawn per view.
 */
export type RobotView = "plan" | "front" | "profile" | "iso"

/**
 * World axes for a viewed machine: `x` starboard, `y` up, `z` toward the tail.
 * Right-handed, and it lands nose-up in plan view, which is how the flat
 * machines were already drawn.
 */
export const robotViews: Record<RobotView, { azimuth: number; elevation: number }> = {
  plan: { azimuth: 0, elevation: 90 },
  front: { azimuth: 180, elevation: 10 },
  profile: { azimuth: 90, elevation: 10 },
  iso: { azimuth: 145, elevation: 26 },
}

export interface RobotCamera {
  view: RobotView
  /** Screen position of a world point, in drawing units. */
  project(x: number, y: number, z: number): Vec2
  /** How far toward the camera a point sits. Bigger draws later. */
  depth(x: number, y: number, z: number): number
  /**
   * SVG transform that lays a plan-view drawing onto the screen at height `y`,
   * turned `spin` degrees clockwise. Anything flat — a guard ring, a propeller,
   * the deck detail — is exact under it, so one piece of artwork serves every
   * view. In plan the transform is the identity.
   *
   * `up` conjugates the transform for a group that has already been mirrored
   * to draw with `y` pointing up, which is how the arms are written.
   */
  plane(y?: number, spin?: number, up?: boolean): string
  /**
   * The same thing for artwork drawn in a *vertical* plane — an elevation
   * drawing. The plane stands `offset` world units toward the viewer and is
   * turned `spin` degrees about the vertical, in the same sense as `plane()`.
   * Drawing coordinates are the elevation's own: x right, y down.
   *
   * `spin` 0 faces the `front` camera and 90 contains the fore-aft axis with
   * the nose to the right, so a front-drawn machine uses `wall()` and a
   * side-drawn one uses `wall(0, 90)`. In its own view the transform is the
   * identity; seen edge-on it is singular and the artwork collapses to a line,
   * which is what a wall seen from the side is.
   */
  wall(offset?: number, spin?: number, up?: boolean): string
  /** Screen rise per world unit of height. Zero looking straight down. */
  lift: number
  /** How much a horizontal disc keeps of its depth. One looking straight down. */
  flatten: number
}

/**
 * The vertical axis carries a constant unit scale, the same in every view, so
 * that height comes out unforeshortened in the two elevations: `ce` is exactly
 * 1 there and still exactly 0 in plan. That is what lets a machine drawn in
 * elevation and a machine drawn in plan each keep its own drawing untouched in
 * its own view while sharing one camera.
 */
const ELEVATION_COS = Math.cos(toRadians(robotViews.front.elevation))

export function robotCamera(view: RobotView = "plan"): RobotCamera {
  const { azimuth, elevation } = robotViews[view] ?? robotViews.plan
  const a = toRadians(azimuth)
  const e = toRadians(elevation)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const ce = Math.cos(e) / ELEVATION_COS
  const se = Math.sin(e)
  const flat = px(ca) === 1 && px(sa) === 0 && px(se) === 1
  return {
    view,
    project: (x, y, z) => ({ x: x * ca - z * sa, y: x * sa * se - y * ce + z * ca * se }),
    depth: (x, y, z) => x * ce * sa + y * se + z * ce * ca,
    plane: (y = 0, spin = 0, up = false) => {
      // Straight down is the identity, so plan-view drawings stay untouched.
      const flip = up ? -1 : 1
      const shift = px(-y * ce) * flip
      const parts = flat
        ? (shift ? [`translate(0 ${shift})`] : [])
        : [`matrix(${px(ca)} ${px(sa * se) * flip} ${px(-sa) * flip} ${px(ca * se)} 0 ${shift})`]
      if (spin) parts.push(`rotate(${px(spin) * flip})`)
      return parts.join(" ")
    },
    wall: (offset = 0, spin = 0, up = false) => {
      const flip = up ? -1 : 1
      const turn = toRadians(spin)
      const cs = Math.cos(turn)
      const sn = Math.sin(turn)
      const a11 = px(sn * sa - cs * ca)
      const a12 = px(-se * (cs * sa + sn * ca))
      const d = px(ce)
      const dx = px(offset * (sn * ca + cs * sa))
      const dy = px(offset * se * (sn * sa - cs * ca))
      // The plane's own view: no transform at all, so the drawing is untouched.
      if (a11 === 1 && a12 === 0 && d === 1 && !dx && !dy) return ""
      return `matrix(${a11} ${a12 * flip} 0 ${d} ${dx} ${dy * flip})`
    },
    lift: ce,
    flatten: se,
  }
}

/**
 * The outline a solid part makes: its plan-view footprint drawn at two heights
 * and wrapped in one hull. A height offset projects to a pure vertical screen
 * offset, so this is exact for any convex footprint and collapses back to the
 * footprint itself in plan view.
 */
export function extrudedPath(
  footprint: readonly Vec2[],
  camera: RobotCamera,
  top: number,
  bottom: number,
  spin = 0,
  /** For a group already mirrored to draw with `y` pointing up. */
  up = false,
): string {
  const turn = toRadians(spin)
  const cs = Math.cos(turn)
  const sn = Math.sin(turn)
  const corners = footprint.flatMap((point) => {
    // Footprint coordinates are plan-view: x starboard, y toward the tail.
    const x = point.x * cs - point.y * sn
    const z = point.x * sn + point.y * cs
    const rise = camera.project(x, top, z)
    const fall = camera.project(x, bottom, z)
    return up
      ? [{ x: rise.x, y: -rise.y }, { x: fall.x, y: -fall.y }]
      : [rise, fall]
  })
  return hullPath(corners)
}

/** The closed outline round a set of projected corners. */
function hullPath(corners: readonly Vec2[]): string {
  const hull = convexHull2(corners)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/**
 * The outline a *tapered* solid makes: two different footprints, one at each
 * height, wrapped in one hull. `extrudedPath` is the special case where both
 * are the same, and this is the general one — a chassis wider at the floor
 * than at the deck, a wedge head, a truncated cone. Exact for any pair of
 * convex footprints, since a height offset projects to a pure vertical screen
 * offset, and it collapses to the hull of the two footprints in plan view.
 */
export function frustumPath(
  bottom: readonly Vec2[],
  top: readonly Vec2[],
  camera: RobotCamera,
  bottomY: number,
  topY: number,
  spin = 0,
  /** For a group already mirrored to draw with `y` pointing up. */
  up = false,
): string {
  const turn = toRadians(spin)
  const cs = Math.cos(turn)
  const sn = Math.sin(turn)
  const corner = (point: Vec2, height: number) => {
    // Footprint coordinates are plan-view: x starboard, y toward the tail.
    const x = point.x * cs - point.y * sn
    const z = point.x * sn + point.y * cs
    const screen = camera.project(x, height, z)
    return up ? { x: screen.x, y: -screen.y } : screen
  }
  return hullPath([
    ...bottom.map((point) => corner(point, bottomY)),
    ...top.map((point) => corner(point, topY)),
  ])
}

/**
 * The silhouette of a solid given its own corners in world space.
 * `extrudedPath` and `frustumPath` are the special cases where the corners come
 * from a plan-view footprint at two heights; this is the general one, for parts
 * that stand in any plane at all — a palm slab, a sole plate, a pitched rib
 * hoop. Exact for a convex solid, which is what these parts are.
 */
export function slabPath(
  corners: readonly Vec3[],
  camera: RobotCamera,
  /** For a group already mirrored to draw with `y` pointing up. */
  up = false,
): string {
  return hullPath(
    corners.map((corner) => {
      const point = camera.project(corner.x, corner.y, corner.z)
      return up ? { x: point.x, y: -point.y } : point
    }),
  )
}

/**
 * A camera transform applied about a point in the drawing rather than about the
 * viewBox origin, so an existing drawing can be pushed through the camera where
 * it already stands. `zoom` pulls the camera back, which is what keeps a
 * machine inside a frame that was drawn for one view. Empty in the machine's
 * own view, so nothing is emitted.
 */
export function aboutPoint(transform: string, x: number, y: number, zoom = 1) {
  if (!transform && zoom === 1) return ""
  const scale = zoom === 1 ? "" : ` scale(${px(zoom)})`
  return `translate(${px(x)} ${px(y)})${scale} ${transform} translate(${px(-x)} ${px(-y)})`.replace(/\s+/g, " ")
}

/** A circle sampled as a ring of points, ready to extrude: the round parts. */
export function circleFootprint(x: number, z: number, radius: number, steps = 12): Vec2[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2
    return { x: x + Math.cos(angle) * radius, y: z + Math.sin(angle) * radius }
  })
}

/** A rounded rectangle sampled as a ring of points, ready to extrude. */
export function roundedFootprint(
  halfWidth: number,
  halfLength: number,
  radius: number,
  steps = 5,
): Vec2[] {
  const r = Math.max(0, Math.min(radius, halfWidth, halfLength))
  const corners: Vec2[] = [
    { x: halfWidth - r, y: halfLength - r },
    { x: -(halfWidth - r), y: halfLength - r },
    { x: -(halfWidth - r), y: -(halfLength - r) },
    { x: halfWidth - r, y: -(halfLength - r) },
  ]
  return corners.flatMap((corner, index) =>
    Array.from({ length: steps }, (_, step) => {
      const angle = ((index * 90 + (step * 90) / (steps - 1)) * Math.PI) / 180
      return { x: corner.x + Math.cos(angle) * r, y: corner.y + Math.sin(angle) * r }
    }),
  )
}

/**
 * The transform that lays a projected envelope into a drawing frame: the
 * largest uniform scale that fits, centred, never enlarging past `maxScale`.
 *
 * Feed it a *fixed* envelope — the whole box the machine moves inside, not its
 * pose this frame — so the framing cannot breathe as the machine works. A
 * machine drawn to fit its native view then stays inside its own frame from
 * every other camera, which is otherwise the first thing a new view breaks.
 */
export function fitTransform(
  corners: readonly Vec3[],
  camera: RobotCamera,
  width: number,
  height: number,
  margin = 8,
  maxScale = 1,
): string {
  if (corners.length === 0) return ""
  const points = corners.map((corner) => camera.project(corner.x, corner.y, corner.z))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = Math.min(
    maxScale,
    (width - margin * 2) / Math.max(1e-6, maxX - minX),
    (height - margin * 2) / Math.max(1e-6, maxY - minY),
  )
  const dx = width / 2 - ((minX + maxX) / 2) * scale
  const dy = height / 2 - ((minY + maxY) / 2) * scale
  return `translate(${px(dx)} ${px(dy)}) scale(${px(scale)})`
}

/** The eight corners of a world-space box, ready for {@link fitTransform}. */
export function boxCorners(
  min: Vec3,
  max: Vec3,
): Vec3[] {
  return [min.x, max.x].flatMap((x) =>
    [min.y, max.y].flatMap((y) => [min.z, max.z].map((z) => ({ x, y, z }))),
  )
}

/* -------------------------------------------------------------------------- */
/* elevation drawings                                                          */
/* -------------------------------------------------------------------------- */

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback

/** A length: finite, and never negative. */
const span = (value: number, fallback: number) => Math.abs(finite(value, fallback))

/**
 * Which elevation a drawing is, in world axes (x starboard, y up, z aft).
 * `profile` lays the drawing's x along the fore-aft axis, `front` across the
 * machine. Depth is then the remaining horizontal axis in both cases.
 */
export type ElevationPlane = "profile" | "front"

/**
 * One drawing point of an elevation, at `depth` out of its plane. Drawing
 * coordinates are the ones the rest of the set uses — x along the drawing, y
 * up from the ground — and positive `depth` is toward the camera.
 */
export function elevationPoint(
  point: Vec2,
  depth: number,
  plane: ElevationPlane = "profile",
): Vec3 {
  const x = finite(point.x, 0)
  const y = finite(point.y, 0)
  const out = finite(depth, 0)
  return plane === "front"
    ? { x: -x, y, z: -out }
    : { x: out, y, z: -x }
}

/**
 * A link solved in an elevation, lifted into the world as the box it really
 * is: `halfWidth` across the link inside the drawing plane, `halfDepth` out of
 * it. Feed the corners to `slabPath` and one geometry serves all four cameras,
 * so a walking beam seen from above is the beam foreshortened by its own tilt
 * rather than a second piece of artwork.
 */
export function elevationSolid(
  a: Vec2,
  b: Vec2,
  halfWidth: number,
  halfDepth: number,
  plane: ElevationPlane = "profile",
): Vec3[] {
  const ax = finite(a.x, 0)
  const ay = finite(a.y, 0)
  const bx = finite(b.x, 0)
  const by = finite(b.y, 0)
  const width = span(halfWidth, 1)
  const depth = span(halfDepth, 1)
  const length = Math.hypot(bx - ax, by - ay)
  // A zero-length link has no direction to take a perpendicular from; give it
  // the drawing's own axes so it still comes out as a square rather than NaN.
  const ux = length === 0 ? 1 : (bx - ax) / length
  const uy = length === 0 ? 0 : (by - ay) / length
  const corners: Vec2[] = [
    { x: ax - uy * width - ux * width, y: ay + ux * width - uy * width },
    { x: ax + uy * width - ux * width, y: ay - ux * width - uy * width },
    { x: bx + uy * width + ux * width, y: by - ux * width + uy * width },
    { x: bx - uy * width + ux * width, y: by + ux * width + uy * width },
  ]
  return corners.flatMap((corner) => [
    elevationPoint(corner, depth, plane),
    elevationPoint(corner, -depth, plane),
  ])
}

/**
 * A disc standing in an elevation — a crank web, a sheave, a drum, a wheel —
 * as the cylinder it is, its axis out of the drawing plane.
 */
export function elevationDisc(
  center: Vec2,
  radius: number,
  halfDepth: number,
  plane: ElevationPlane = "profile",
  steps = 16,
): Vec3[] {
  const cx = finite(center.x, 0)
  const cy = finite(center.y, 0)
  const r = span(radius, 1)
  const depth = span(halfDepth, 1)
  const count = Math.max(3, Math.round(finite(steps, 16)))
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  }).flatMap((point) => [
    elevationPoint(point, depth, plane),
    elevationPoint(point, -depth, plane),
  ])
}

/**
 * The drafting board for one elevation: every helper a machine drawn in a
 * vertical plane needs, already pushed through the camera.
 *
 * Drawing coordinates are the plane's own — x along the drawing, y up from the
 * ground — and `depth` is out of it, toward the camera. So the whole machine is
 * written once, in the elevation it was designed in, and comes out correct from
 * all four cameras: what has real depth is a solid, what is flat detail is a
 * polyline that foreshortens and finally collapses when seen edge-on, which is
 * what a line drawn on a face does.
 */
export interface ElevationDraft {
  /** Screen point of one drawing point. */
  point(point: Vec2, depth?: number): Vec2
  /** A polyline through drawing points, all at the same depth. */
  path(points: readonly Vec2[], depth?: number, close?: boolean): string
  /** The silhouette of an outline swept `±halfDepth` out of the plane. */
  solid(outline: readonly Vec2[], halfDepth: number, offset?: number): string
  /** The same for an axis-aligned rectangle. */
  box(x0: number, y0: number, x1: number, y1: number, halfDepth: number, offset?: number): string
  /** A member between two drawing points, `halfWidth` across it in the plane. */
  bar(a: Vec2, b: Vec2, halfWidth: number, halfDepth: number, offset?: number): string
  /** A disc standing in the drawing plane: a wheel, a sheave, a drum. */
  disc(centre: Vec2, radius: number, halfDepth: number, offset?: number, steps?: number): string
}

export function elevationDraft(
  camera: RobotCamera,
  plane: ElevationPlane = "profile",
): ElevationDraft {
  const project = (corner: Vec3) => camera.project(corner.x, corner.y, corner.z)
  const nudge = (corners: Vec3[], offset: number) =>
    offset === 0
      ? corners
      : corners.map((corner) =>
          plane === "front"
            ? { ...corner, z: corner.z - offset }
            : { ...corner, x: corner.x + offset },
        )
  const point = (value: Vec2, depth = 0) => project(elevationPoint(value, depth, plane))
  return {
    point,
    path: (points, depth = 0, close = false) =>
      `${points
        .map((value, index) => {
          const screen = point(value, depth)
          return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
        })
        .join(" ")}${close ? " Z" : ""}`,
    solid: (outline, halfDepth, offset = 0) =>
      slabPath(
        outline.flatMap((value) => [
          elevationPoint(value, offset + halfDepth, plane),
          elevationPoint(value, offset - halfDepth, plane),
        ]),
        camera,
      ),
    box: (x0, y0, x1, y1, halfDepth, offset = 0) =>
      slabPath(
        [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ].flatMap((value) => [
          elevationPoint(value, offset + halfDepth, plane),
          elevationPoint(value, offset - halfDepth, plane),
        ]),
        camera,
      ),
    bar: (a, b, halfWidth, halfDepth, offset = 0) =>
      slabPath(nudge(elevationSolid(a, b, halfWidth, halfDepth, plane), offset), camera),
    disc: (centre, radius, halfDepth, offset = 0, steps = 20) =>
      slabPath(nudge(elevationDisc(centre, radius, halfDepth, plane, steps), offset), camera),
  }
}
