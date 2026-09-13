"use client"

/**
 * strike-starfighter — a split-foil attack fighter: four wings on two hinges.
 *
 * The mechanism is the hinge, not the shape. Cruising, the upper and lower
 * panels lie together and the machine reads as a two-wing fighter; opened, each
 * pair swings about a *fore-aft* axis at its own root until the four of them
 * stand in an X. One number does it, every panel keeps its length and its
 * chord, and the engines and cannons are carried on the panels rather than
 * being drawn where they look right — so opening the foils genuinely spreads
 * the guns and the thrust line apart.
 *
 * `bank` rolls the whole airframe about the same axis, which is why an opened
 * X still reads as an X from any camera: it is one geometry projected, not four
 * drawings.
 *
 * A science-fiction archetype, not a character: no markings, no livery, no
 * franchise. Nothing here is aerodynamic — there is no air.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  boxCorners,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  slabPath,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 250
const VIEW_HEIGHT = 210
const NATIVE_VIEW: RobotView = "front"

/** The airframe in world units: nose at −z, starboard at +x, up at +y. */
const NOSE = -124
const TAIL = 72
const BODY_RADIUS = 10
const ROOT_X = 11
const ROOT_FORE = 6
const ROOT_AFT = 58
const SPAN = 92
/** How far each pair swings off the cruise plane when the foils are open. */
const FOIL_TRAVEL = 21
const MAX_BANK = 70
/** Foil travel per second while it eases back into a behaviour. */
const FOIL_RATE = 0.55

const ENVELOPE = boxCorners(
  { x: -108, y: -58, z: -130 },
  { x: 108, y: 58, z: 78 },
)

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Fuselage radius at a station: a long nose, a barrel, a squared-off tail. */
const bodyRadius = (z: number) => {
  if (z < NOSE + 56) return BODY_RADIUS * (0.28 + 0.72 * ((z - NOSE) / 56))
  if (z > TAIL - 14) return BODY_RADIUS * 0.86
  return BODY_RADIUS
}

export type StarfighterBehavior = "patrol" | "attack" | "static"

export interface StrikeStarfighterProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** The S-foils, 0 closed (cruise) to 1 open (attack). Supplying it stops the loop. */
  foils?: number
  onFoilsChange?: (foils: number) => void
  /** Roll about the fore-aft axis, in degrees. Omit and the behaviour flies it. */
  bank?: number
  behavior?: StarfighterBehavior
  view?: RobotView
  /** Cannons on the four wing tips. */
  showCannons?: boolean
  /** Light the engines and the sensor. Omit and they light unless it is parked. */
  active?: boolean
  interactive?: boolean
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function StrikeStarfighter({
  foils,
  onFoilsChange,
  bank,
  behavior = "patrol",
  view = NATIVE_VIEW,
  showCannons = true,
  active,
  interactive = false,
  speed = 0.25,
  animate = true,
  paused = false,
  phase = 0,
  label,
  size = "md",
  variant = "solid",
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
}: StrikeStarfighterProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = foils !== undefined

  const hold = controlled
    ? Number.isFinite(foils) ? clamp(foils as number, 0, 1) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => starfighterFoils(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: FOIL_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const spread = clamp(motion.value, 0, 1)
  const roll = bank !== undefined
    ? Number.isFinite(bank) ? clamp(bank, -180, 180) : 0
    : clamp(
        starfighterBank(behavior, Number.isFinite(motion.clock) ? motion.clock : 0),
        -MAX_BANK,
        MAX_BANK,
      )

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onFoilsChange?.(bounded)
    },
    [onFoilsChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const bankRad = toRadians(roll)
  const cosBank = Math.cos(bankRad)
  const sinBank = Math.sin(bankRad)
  /** The whole airframe rolls about its own long axis. */
  const banked = (point: Vec3): Vec3 => ({
    x: point.x * cosBank + point.y * sinBank,
    y: -point.x * sinBank + point.y * cosBank,
    z: point.z,
  })
  /** One panel's hinge: a rotation in the cross-section about its own root. */
  const hinge = (rootX: number, degrees: number) => {
    const angle = toRadians(degrees)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return (point: Vec3): Vec3 => {
      const dx = point.x - rootX
      return banked({
        x: rootX + dx * cos - point.y * sin,
        y: dx * sin + point.y * cos,
        z: point.z,
      })
    }
  }

  const solid = (corners: Vec3[], place: (point: Vec3) => Vec3 = banked) =>
    slabPath(corners.map(place), camera)
  const line = (points: Vec3[], place: (point: Vec3) => Vec3 = banked, close = false) =>
    `${points
      .map((point, index) => {
        const moved = place(point)
        const screen = camera.project(moved.x, moved.y, moved.z)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")}${close ? " Z" : ""}`

  /** A body of revolution about the fore-aft axis. */
  const barrel = (from: number, to: number, radius: (z: number) => number, steps = 4) =>
    Array.from({ length: steps + 1 }, (_, index) => from + ((to - from) * index) / steps)
      .flatMap((z) => {
        const r = radius(z)
        return Array.from({ length: 10 }, (_, spoke) => {
          const angle = (spoke / 10) * Math.PI * 2
          return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, z }
        })
      })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lit = active ?? behavior !== "static"

  /** One of the four panels, with everything it carries. */
  const panel = (side: 1 | -1, up: 1 | -1) => {
    const rootX = side * ROOT_X
    // Starboard opens anticlockwise in the cross-section; port is its mirror.
    const place = hinge(rootX, side * up * FOIL_TRAVEL * spread)
    const tipX = side * SPAN
    const name = `${up > 0 ? "upper" : "lower"}-${side > 0 ? "starboard" : "port"}`
    const planform: Vec3[] = [
      { x: rootX, y: 0, z: ROOT_FORE },
      { x: tipX, y: 0, z: ROOT_FORE + 18 },
      { x: tipX, y: 0, z: ROOT_AFT - 12 },
      { x: rootX, y: 0, z: ROOT_AFT },
    ]
    const nacelle = {
      x: side * 34,
      from: ROOT_FORE - 6,
      to: ROOT_AFT + 10,
    }
    return (
      <g key={name} data-foil={name} data-angle={px(side * up * FOIL_TRAVEL * spread)}>
        <path
          d={solid(
            planform.flatMap((corner) => [
              { ...corner, y: up * 1.6 },
              { ...corner, y: up * 0.2 },
            ]),
            place,
          )}
          {...shell}
        />
        <path
          data-engine={name}
          d={solid(
            Array.from({ length: 2 }, (_, index) => (index ? nacelle.to : nacelle.from)).flatMap((z) =>
              Array.from({ length: 8 }, (_, spoke) => {
                const angle = (spoke / 8) * Math.PI * 2
                return {
                  x: nacelle.x + Math.cos(angle) * 7,
                  y: up * 2 + Math.sin(angle) * 7,
                  z,
                }
              }),
            ),
            place,
          )}
          {...machined}
        />
        {lit && (
          <path
            data-exhaust={name}
            d={line(
              [
                { x: nacelle.x, y: up * 2, z: nacelle.to + 1 },
                { x: nacelle.x, y: up * 2, z: nacelle.to + 26 },
              ],
              place,
            )}
            fill="none"
            stroke={palette.accent}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.55}
          />
        )}
        {showCannons && (
          <path
            data-cannon={name}
            d={line(
              [
                { x: tipX - side * 2, y: up * 1, z: ROOT_AFT - 8 },
                { x: tipX - side * 2, y: up * 1, z: ROOT_FORE - 34 },
              ],
              place,
            )}
            fill="none"
            stroke={palette.metal}
            strokeWidth={3.6}
            strokeLinecap="round"
          />
        )}
        <path
          data-hinge={name}
          d={line(
            [
              { x: rootX, y: up * 1, z: ROOT_FORE + 4 },
              { x: rootX + side * 9, y: up * 1, z: ROOT_FORE + 4 },
            ],
            place,
          )}
          fill="none"
          stroke={palette.dark}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Split-foil strike starfighter, foils ${Math.round(spread * 100)} percent open, banked ${Math.round(roll)} degrees, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(spread) : undefined}
      aria-valuetext={interactive ? `foils ${Math.round(spread * 100)} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.25)
        if (delta !== 0) apply(spread + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
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
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path
            d={`M ${VIEW_WIDTH / 2} 8 V ${VIEW_HEIGHT - 8} M 8 ${VIEW_HEIGHT / 2} H ${VIEW_WIDTH - 8}`}
            strokeDasharray="2 3"
          />
        </g>
      )}

      <g data-view={view} data-foils={px(spread)} data-bank={px(roll)} transform={frame || undefined}>
        {panel(-1, -1)}
        {panel(1, -1)}

        <g data-fuselage>
          <path d={solid(barrel(NOSE, TAIL, bodyRadius, 6))} {...shell} />
          <path
            data-canopy
            d={solid(
              [
                { x: -6, y: 7, z: -34 },
                { x: 6, y: 7, z: -34 },
                { x: -6, y: 7, z: 12 },
                { x: 6, y: 7, z: 12 },
                { x: -4, y: 17, z: -24 },
                { x: 4, y: 17, z: -24 },
                { x: -4, y: 17, z: 6 },
                { x: 4, y: 17, z: 6 },
              ],
            )}
            {...cast}
          />
          <path
            data-glass
            d={line(
              [
                { x: -3.4, y: 17.4, z: -22 },
                { x: 3.4, y: 17.4, z: -22 },
                { x: 3.4, y: 17.4, z: 4 },
                { x: -3.4, y: 17.4, z: 4 },
              ],
              banked,
              true,
            )}
            fill={palette.accent}
            opacity={lit ? 0.5 : 0.22}
          />
          <path
            data-sensor
            d={line(
              [
                { x: 0, y: 0, z: NOSE },
                { x: 0, y: 0, z: NOSE - 16 },
              ],
            )}
            fill="none"
            stroke={lit ? palette.accent : palette.metal}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Spine ribs: three marks that give the barrel a length. */}
          {[-58, -18, 26].map((z) => (
            <path
              key={z}
              d={line([
                { x: -bodyRadius(z), y: 0, z },
                { x: bodyRadius(z), y: 0, z },
              ])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1.4}
              opacity={0.45}
            />
          ))}
        </g>

        {panel(-1, 1)}
        {panel(1, 1)}
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 5}
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

/** How far open the S-foils are at `clock`, 0 closed to 1 open. */
export function starfighterFoils(behavior: StarfighterBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  if (behavior === "attack") return 1
  // On patrol they open for a look and close again.
  const cycle = ((clock * 0.5) % 1 + 1) % 1
  return cycle < 0.55 ? 0 : clamp((cycle - 0.6) / 0.15, 0, 1) * (cycle > 0.85 ? 0 : 1)
}

/** The roll the fighter is holding at `clock`, in degrees. */
export function starfighterBank(behavior: StarfighterBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = clock * Math.PI * 2
  return behavior === "attack"
    ? Math.sin(t * 0.8) * 52 + Math.sin(t * 1.7) * 14
    : Math.sin(t * 0.4) * 16
}

export { StrikeStarfighter }
