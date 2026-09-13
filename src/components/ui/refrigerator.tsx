"use client"

/**
 * refrigerator — a cabinet whose doors are solved, and an inside worth opening.
 *
 * A leaf hinged on a vertical edge is a flat panel at an attitude, so the door
 * goes through `swingPose` for its free edge and `panelTransform` for its own
 * artwork: the handle and the display ride the leaf, foreshorten as it opens,
 * and vanish when it is edge-on. Nothing is drawn twice for a second camera.
 *
 * The lamp is a real door switch: it makes at a stated angle, so the inside
 * lights the moment the seal breaks rather than when an animation says so. The
 * interior — shelves, drawers, what is on them — is a second drawing, revealed
 * by the swing.
 *
 * There is no thermodynamics here. The compressor duty cycle is a pattern on
 * the clock, the temperatures on the display are labels, and nothing computes a
 * heat load, a defrost or a door-open penalty.
 */

import * as React from "react"

import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import { panelPath, panelTransform } from "@/lib/robocn/device"
import { swingPose } from "@/lib/robocn/household"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  boxCorners,
  elevationDraft,
  elevationPoint,
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

export type RefrigeratorBehavior = "service" | "idle" | "static"
export type RefrigeratorLayout = "top-freezer" | "side-by-side" | "single"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 250
const NATIVE_VIEW: RobotView = "front"

const HALF = 40
const DEPTH = 26
const FOOT = 4
const TOP = 162
/** Where the two compartments meet in a top-freezer cabinet. */
const SPLIT = 104
const GASKET = 4
const FACE = 0.5
/** How far a door can swing before it hits its stop. */
const MAX_ANGLE = 110
/** The door switch makes here: past this the lamp is on. */
const SWITCH = 0.05
/** A door is a slab, not a sheet: this is what gives it an edge off-axis. */
const LEAF_THICKNESS = 4

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RefrigeratorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled fresh-food door, 0 shut to 1 at its stop. Stops the loop. */
  door?: number
  onDoorChange?: (door: number) => void
  /** Controlled freezer door. Independent of the fresh one. */
  freezer?: number
  behavior?: RefrigeratorBehavior
  layout?: RefrigeratorLayout
  /** Shelves in the fresh compartment, 2–5. */
  shelves?: number
  /** Draw the condenser coil and the compressor at the back. */
  showPlant?: boolean
  showGround?: boolean
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function Refrigerator({
  door,
  onDoorChange,
  freezer,
  behavior = "service",
  layout = "top-freezer",
  shelves = 3,
  showPlant = true,
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.18,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
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
}: RefrigeratorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = door !== undefined

  const racks = Number.isFinite(shelves) ? clamp(Math.round(shelves), 2, 5) : 3
  const hold = controlled ? (Number.isFinite(door) ? clamp(door as number, 0, 1) : 0) : held
  const goal = React.useCallback(
    (clock: number) => fridgeDoor(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: 1.6,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const fresh = clamp(motion.value, 0, 1)
  const cold = clamp(
    freezer !== undefined && Number.isFinite(freezer)
      ? freezer
      : fridgeFreezer(behavior, motion.clock),
    0,
    1,
  )
  const running = fridgeDuty(motion.clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onDoorChange?.(bounded)
    },
    [onDoorChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })
  // Report the door as the behaviour swings it, not only under a pointer.
  const reported = React.useRef(-1)
  React.useEffect(() => {
    const at = Math.round(fresh * 100) / 100
    if (reported.current === at) return
    reported.current = at
    onDoorChange?.(at)
  }, [fresh, onDoorChange])

  const camera = robotCamera(view)
  const envelope = boxCorners(
    { x: -(HALF + 10), y: 0, z: -(DEPTH + 6) },
    { x: HALF + 10, y: TOP + 8, z: DEPTH + HALF * 1.4 },
  )
  const frame = fitTransform(envelope, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { point: to, box, bar, disc } = elevationDraft(camera, "front")

  const wash = (value: number) => (variant === "outline" || variant === "wire" ? 0 : value)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const leaves = doorLeaves(layout, fresh, cold)
  const lamp = leaves.some((leaf) => leaf.compartment === "fresh" && leaf.open > SWITCH)
  const frozenLamp = leaves.some((leaf) => leaf.compartment === "freezer" && leaf.open > SWITCH)

  const percent = Math.round(fresh * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Refrigerator, ${layout.replace("-", " ")}, door ${percent} percent open, ${viewNames[view] ?? viewNames.front}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(fresh) : undefined}
      aria-valuetext={interactive ? `door ${percent} percent open` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(fresh + delta)
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
        <path
          d={`M 8 ${VIEW_HEIGHT - 14} H ${VIEW_WIDTH - 8}`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.45}
        />
      )}

      <g data-cabinet data-view={view} transform={frame || undefined}>
        {showGround && (
          <path
            data-ground
            d={box(-HALF - 4, 0, HALF + 4, 0.4, DEPTH + 4)}
            fill={palette.dark}
            opacity={0.14}
          />
        )}

        {/* Plant at the back: the coil and the compressor that runs it. */}
        {showPlant && (
          <g data-plant>
            <path
              data-coil
              d={coilPath(to, -DEPTH - 3)}
              fill="none"
              stroke={palette.metal}
              strokeWidth={1}
              opacity={0.75}
            />
            <path
              data-compressor
              d={disc({ x: -18, y: 14 }, 9, 7, -DEPTH + 6)}
              fill={running ? palette.accent : palette.metal}
              fillOpacity={wash(running ? 0.6 : 1)}
              stroke={palette.dark}
              strokeWidth={0.6}
            />
          </g>
        )}

        {/* Carcass: the box, then the lit cavity inside it. */}
        <path data-carcass d={box(-HALF, FOOT, HALF, TOP, DEPTH)} {...shell} />
        <path
          data-cavity
          d={box(-HALF + 3, FOOT + 3, HALF - 3, TOP - 3, FACE, DEPTH - 3)}
          fill={lamp || frozenLamp ? palette.metal : palette.dark}
          fillOpacity={wash(lamp || frozenLamp ? 0.6 : 0.72)}
          stroke={palette.dark}
          strokeWidth={0.5}
        />

        {/* Shelves, drawer and what is on them: only worth drawing once a door
            is open far enough to see past the leaf. */}
        {(lamp || frozenLamp) && (
          <g data-interior>
            {layout === "top-freezer" && (
              <path
                d={box(-HALF + 3, SPLIT, HALF - 3, SPLIT + GASKET, FACE, DEPTH - 4)}
                {...cast}
              />
            )}
            {Array.from({ length: racks }, (_, index) => {
              // The fresh compartment is the whole cabinet unless a freezer is
              // sitting on top of it, so the shelves have to know the layout.
              const ceiling = layout === "top-freezer" ? SPLIT : TOP - 6
              const y = FOOT + 26 + (index * (ceiling - FOOT - 40)) / racks
              return (
                <path
                  key={index}
                  data-shelf={index}
                  d={box(-HALF + 6, y, HALF - 6, y + 1.4, FACE, DEPTH - 6)}
                  {...machined}
                />
              )
            })}
            <path
              data-drawer
              d={box(-HALF + 6, FOOT + 6, HALF - 6, FOOT + 22, FACE, DEPTH - 5)}
              fill={palette.metal}
              fillOpacity={wash(0.45)}
              stroke={palette.dark}
              strokeWidth={0.5}
            />
            {[-22, -6, 12].map((x, index) => (
              <path
                key={x}
                d={box(x, FOOT + 28 + index * 0.5, x + 9, FOOT + 44, FACE, DEPTH - 8)}
                fill={palette.accent}
                fillOpacity={wash(0.7)}
                stroke={palette.dark}
                strokeWidth={0.4}
              />
            ))}
            <circle
              data-lamp
              cx={px(to({ x: 0, y: SPLIT - 8 }, DEPTH - 5).x)}
              cy={px(to({ x: 0, y: SPLIT - 8 }, DEPTH - 5).y)}
              r={2.6}
              fill={palette.accent}
            />
          </g>
        )}

        {/* The doors themselves, each a solved leaf with its own artwork. */}
        {leaves.map((leaf) => {
          const pose = swingPose(leaf.open, {
            width: leaf.width,
            maxAngle: MAX_ANGLE,
            side: leaf.side,
          })
          const hinge = { x: leaf.hinge, y: leaf.top }
          // The leaf's own x runs the way a reader of it sees it — left to
          // right on screen when the door is shut — so `facing` is positive for
          // its front face and turns negative only when it has swung past the
          // camera and shown its inside.
          const edge = { x: leaf.hinge + pose.edge.x, depth: DEPTH + pose.edge.depth }
          const near = leaf.side === -1 ? edge : { x: leaf.hinge, depth: DEPTH }
          const far = leaf.side === -1 ? { x: leaf.hinge, depth: DEPTH } : edge
          const corner = elevationPoint({ x: near.x, y: leaf.top }, near.depth, "front")
          const along = elevationPoint({ x: far.x, y: leaf.top }, far.depth, "front")
          const down = elevationPoint({ x: near.x, y: leaf.bottom }, near.depth, "front")
          const height = leaf.top - leaf.bottom
          const panel = panelTransform(camera, corner, along, down, leaf.width, height)
          const slab = leafSlab(camera, hinge, leaf, pose, height)
          return (
            <g key={leaf.key} data-door={leaf.key} data-open={px(leaf.open)}>
              <path d={slab} {...shell} />
              <path d={panelPath(camera, corner as Vec3, along as Vec3, down as Vec3)} {...shell} />
              {panel.facing > 0.12 && (
                <g transform={panel.transform || undefined}>
                  <rect
                    x={leaf.width * 0.08}
                    y={height * 0.06}
                    width={leaf.width * 0.84}
                    height={height * 0.88}
                    fill="none"
                    stroke={palette.dark}
                    strokeWidth={0.5}
                    opacity={0.35}
                  />
                  <rect
                    data-handle
                    x={leaf.side === 1 ? leaf.width * 0.78 : leaf.width * 0.12}
                    y={height * 0.12}
                    width={leaf.width * 0.1}
                    height={height * 0.42}
                    rx={leaf.width * 0.05}
                    fill={palette.metal}
                    stroke={palette.dark}
                    strokeWidth={0.4}
                  />
                  {leaf.compartment === "fresh" && (
                    <rect
                      data-display
                      x={leaf.width * 0.2}
                      y={height * 0.06}
                      width={leaf.width * 0.3}
                      height={height * 0.07}
                      fill={palette.accent}
                      fillOpacity={wash(running ? 0.9 : 0.5)}
                    />
                  )}
                </g>
              )}
            </g>
          )
        })}

        {/* The kick plate the cabinet stands on. */}
        <path data-plinth d={box(-HALF + 3, 0, HALF - 3, FOOT, DEPTH - 3)} {...cast} />

        {variant === "blueprint" && (
          <>
            <path
              d={bar(
                { x: HALF + 6, y: FOOT },
                { x: HALF + 6, y: TOP },
                0.2,
                0.2,
              )}
              fill="none"
              stroke={palette.grid}
              strokeWidth={0.5}
              strokeDasharray="2 2"
            />
            <text
              x={px(to({ x: 0, y: TOP + 6 }).x)}
              y={px(to({ x: 0, y: TOP + 6 }).y)}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={6}
              fill={palette.foreground}
            >
              {`${Math.round(fresh * MAX_ANGLE)}°`}
            </text>
          </>
        )}
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

/* -------------------------------------------------------------------------- */
/* geometry                                                                    */
/* -------------------------------------------------------------------------- */

interface Leaf {
  key: string
  compartment: "fresh" | "freezer"
  /** Hinge edge, in the drawing's own x. */
  hinge: number
  /** Which way the free edge sweeps. */
  side: 1 | -1
  width: number
  top: number
  bottom: number
  open: number
}

/** Which leaves a layout has, and how far each of them is open. */
function doorLeaves(
  layout: RefrigeratorLayout,
  fresh: number,
  freezer: number,
): Leaf[] {
  if (layout === "side-by-side") {
    return [
      { key: "freezer", compartment: "freezer", hinge: -HALF, side: 1, width: HALF, top: TOP - 2, bottom: FOOT + 2, open: freezer },
      { key: "fresh", compartment: "fresh", hinge: HALF, side: -1, width: HALF, top: TOP - 2, bottom: FOOT + 2, open: fresh },
    ]
  }
  if (layout === "single") {
    return [
      { key: "fresh", compartment: "fresh", hinge: HALF, side: -1, width: HALF * 2, top: TOP - 2, bottom: FOOT + 2, open: fresh },
    ]
  }
  return [
    { key: "freezer", compartment: "freezer", hinge: HALF, side: -1, width: HALF * 2, top: TOP - 2, bottom: SPLIT + GASKET, open: freezer },
    { key: "fresh", compartment: "fresh", hinge: HALF, side: -1, width: HALF * 2, top: SPLIT, bottom: FOOT + 2, open: fresh },
  ]
}

/**
 * The door as the slab it is: the leaf's face, and the same face `LEAF_THICKNESS`
 * behind it along its own normal. That is what puts an edge on a door seen from
 * anywhere but square on.
 */
function leafSlab(
  camera: ReturnType<typeof robotCamera>,
  hinge: Vec2,
  leaf: Leaf,
  pose: ReturnType<typeof swingPose>,
  height: number,
): string {
  const width = Math.max(1e-6, leaf.width)
  // Along the leaf, then its normal in the (x, depth) plane.
  const ux = pose.edge.x / width
  const ud = pose.edge.depth / width
  const nx = -ud * LEAF_THICKNESS
  const nd = ux * LEAF_THICKNESS
  const corners: Vec3[] = []
  for (const along of [0, width]) {
    for (const back of [0, 1]) {
      for (const y of [hinge.y, hinge.y - height]) {
        corners.push(
          elevationPoint(
            { x: hinge.x + ux * along + nx * back, y },
            DEPTH + ud * along + nd * back,
            "front",
          ),
        )
      }
    }
  }
  return slabPath(corners, camera)
}

/** The condenser serpentine on the back panel: drawing, and it says so. */
function coilPath(
  to: ReturnType<typeof elevationDraft>["point"],
  depth: number,
): string {
  const rows = 7
  return Array.from({ length: rows }, (_, index) => {
    const y = 30 + index * 16
    const left = index % 2 === 0
    const a = to({ x: left ? -HALF + 6 : HALF - 6, y }, depth)
    const b = to({ x: left ? HALF - 6 : -HALF + 6, y }, depth)
    return `${index ? "L" : "M"} ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`
  }).join(" ")
}

/* -------------------------------------------------------------------------- */
/* behaviours                                                                  */
/* -------------------------------------------------------------------------- */

/** The fresh-food door through a service cycle: open, stand open, shut. */
export function fridgeDoor(behavior: RefrigeratorBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0.55
  if (behavior === "idle") return 0
  const t = ((clock % 1) + 1) % 1
  if (t < 0.12) return t / 0.12
  if (t < 0.34) return 1
  if (t < 0.46) return 1 - (t - 0.34) / 0.12
  return 0
}

/** The freezer door, opened after the fresh one and never at the same time. */
export function fridgeFreezer(behavior: RefrigeratorBehavior, clock: number): number {
  if (behavior !== "service" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (t < 0.58) return 0
  if (t < 0.66) return (t - 0.58) / 0.08
  if (t < 0.82) return 1
  if (t < 0.9) return 1 - (t - 0.82) / 0.08
  return 0
}

/**
 * Whether the compressor is running. A duty cycle on the clock, not a
 * thermostat: nothing here knows what temperature anything is.
 */
export function fridgeDuty(clock: number): boolean {
  if (!Number.isFinite(clock)) return false
  return (((clock * 1.7) % 1) + 1) % 1 < 0.45
}

export { Refrigerator }
