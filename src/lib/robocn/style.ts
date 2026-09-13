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
  normalize2,
  perpendicular2,
  scale2,
  sub2,
  type Vec2,
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
