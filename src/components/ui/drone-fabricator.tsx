"use client"

/**
 * drone-fabricator — the same build, with nothing holding the nozzle up.
 *
 * The gantry runs on rails and the arm reaches from a pedestal; this one has
 * no envelope at all. A repulsor platform flies to the cell being laid, rides
 * a fixed standoff above the build line, and banks into its own travel — so
 * the work volume is bounded by where it can fly rather than by a frame, and
 * a build can start anywhere there is a plate.
 *
 * What is solved: the deposition order, the flight target, and the bank, which
 * is taken from how far the platform still has to travel. What is illustrated:
 * the repulsors — there is no thrust or lift model behind them.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
import {
  extrudedPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import {
  VOXEL_DEFAULT_RESOLUTION,
  voxelBuild,
  voxelGoal,
  voxelLaid,
  voxelPaths,
  voxelRefine,
  voxelResolution,
  voxelSite,
  voxelSolid,
  type VoxelBehavior,
  type VoxelShape,
} from "@/lib/robocn/voxel"
import { cn } from "@/lib/utils"

/** Build volume: half-extent in x and z, so the solid runs y 0 to 2 × HALF. */
const HALF = 28
const PLATE_HALF = 34
const PLATE_DROP = 6
/** How high the platform rides above the cell it is laying. */
const RIDE = 26
/** Where it hovers with nothing left to lay. */
const LOITER = { x: 0, y: HALF * 2 + RIDE + 6, z: 0 }
/** Platform radius, and how far out the repulsor pods sit. */
const DECK = 15
const POD = 22
const BUILD_RATE = 0.6
/** World units of travel that read as a full bank. */
const BANK_SPAN = 26
const BANK_LIMIT = 14

/** Screen y of the world origin, chosen so each view fills the frame. */
const anchors: Record<RobotView, number> = {
  plan: 100,
  front: 141,
  profile: 141,
  iso: 138,
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface DroneFabricatorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  shape?: VoxelShape
  /** Voxels along one edge, clamped to 2–14. Animated under `refine`. */
  resolution?: number
  /** Controlled build fraction, 0–1. Omit it and the platform runs `behavior`. */
  progress?: number
  behavior?: VoxelBehavior
  /** Build cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up and down to lay or strip material; arrow keys step a layer. */
  interactive?: boolean
  onProgressChange?: (progress: number) => void
  view?: RobotView
  /** Repulsor pods around the deck, clamped to 3–6. */
  pods?: number
  showPlate?: boolean
  showGround?: boolean
  showReadout?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function DroneFabricator({
  shape = "vessel", resolution, progress, behavior = "build", speed = 0.12,
  animate = true, paused = false, phase = 0,
  interactive = false, onProgressChange,
  view = "iso", pods = 4, showPlate = true, showGround = true, showReadout = true,
  signal, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: DroneFabricatorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = progress !== undefined
  const hold = controlled
    ? (Number.isFinite(progress) ? clamp(progress, 0, 1) : 0)
    : held
  const goal = React.useCallback((clock: number) => voxelGoal(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: BUILD_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const built = clamp(motion.value, 0, 1)

  const cells = resolution !== undefined
    ? voxelResolution(resolution)
    : behavior === "refine"
      ? voxelResolution(voxelRefine(motion.clock))
      : VOXEL_DEFAULT_RESOLUTION

  const solid = React.useMemo(() => voxelSolid({ shape, resolution: cells }), [shape, cells])
  const laid = voxelLaid(solid, built)
  const part = React.useMemo(() => voxelBuild(solid, laid), [solid, laid])

  const apply = React.useCallback((next: number) => {
    const bounded = clamp(Number.isFinite(next) ? next : 0, 0, 1)
    setHeld(bounded)
    onProgressChange?.(bounded)
  }, [onProgressChange, setHeld])
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const camera = React.useMemo(() => robotCamera(view), [view])
  const anchor = anchors[view] ?? anchors.iso
  const tipped = camera.lift > 0.01
  const at = (x: number, y: number, z: number) => camera.project(x, y, z)
  const line = (a: Vec2, b: Vec2) => `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`

  const cursor = part.active
  const cell = cursor ? voxelSite(cursor, solid.resolution, HALF) : null
  // The platform flies to sit over the cell, at a fixed standoff above it.
  const craft = cell
    ? { x: cell.x, y: cell.top + RIDE, z: cell.z }
    : LOITER
  // The next cell is where it is going; how far it still has to travel is what
  // the platform banks into. No dynamics behind it — just the lean of a body
  // that is about to move.
  const ahead = part.laid + 1 < solid.cells.length
    ? voxelSite(solid.cells[part.laid + 1], solid.resolution, HALF)
    : null
  const bank = ahead
    ? clamp(((ahead.x - craft.x) / BANK_SPAN) * BANK_LIMIT, -BANK_LIMIT, BANK_LIMIT)
    : 0
  const pitch = ahead
    ? clamp(((ahead.z - craft.z) / BANK_SPAN) * BANK_LIMIT, -BANK_LIMIT, BANK_LIMIT)
    : 0

  const count = Number.isFinite(pods) ? clamp(Math.round(pods), 3, 6) : 4
  const arms = Array.from({ length: count }, (_, index) => {
    const angle = toRadians((index * 360) / count + (count % 2 === 0 ? 45 : 0))
    const x = Math.sin(angle) * POD
    const z = -Math.cos(angle) * POD
    // The deck tilts, so a pod on the low side really does sit lower.
    const rise = (-x / POD) * bank * 0.35 + (-z / POD) * pitch * 0.35
    return {
      id: index,
      hub: at(craft.x + x, craft.y + rise, craft.z + z),
      root: at(craft.x + x * 0.35, craft.y, craft.z + z * 0.35),
      wash: at(craft.x + x, craft.y + rise - 9, craft.z + z),
      depth: camera.depth(craft.x + x, craft.y + rise, craft.z + z),
    }
  })
  const deckDepth = camera.depth(craft.x, craft.y, craft.z)

  const voxels = React.useMemo(
    () => voxelPaths(part.surface, solid.resolution, camera, HALF),
    [part, solid, camera],
  )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const shade = variant === "solid" && tipped
  const stroke = px(Math.max(0.2, 3 / solid.resolution))
  const lamp = signal === "warning"
    ? palette.shell
    : signal === "idle"
      ? palette.metal
      : signal === "ready" || cell
        ? palette.accent
        : palette.metal

  const plateFootprint = roundedFootprint(PLATE_HALF, PLATE_HALF, 7, 5)
  const deckFootprint = roundedFootprint(DECK, DECK, 7, 5).map((point) => ({
    x: point.x + craft.x, y: point.y + craft.z,
  }))
  const hull = extrudedPath(deckFootprint, camera, craft.y + 4, craft.y - 4)
  const deckFace = extrudedPath(deckFootprint, camera, craft.y + 4, craft.y + 4)
  const spout = at(craft.x, craft.y - 13, craft.z)
  const nozzle = extrudedPath([
    { x: craft.x - 2.6, y: craft.z - 2.6 }, { x: craft.x + 2.6, y: craft.z - 2.6 },
    { x: craft.x + 2.6, y: craft.z + 2.6 }, { x: craft.x - 2.6, y: craft.z + 2.6 },
  ], camera, craft.y - 4, craft.y - 13)
  const target = cell ? at(cell.x, cell.top, cell.z) : spout
  const drift = at(craft.x, -PLATE_DROP, craft.z)
  const groundAt = at(0, -PLATE_DROP, 0)

  const percent = Math.round(built * 100)

  const pod = ({ id, hub, root, wash }: (typeof arms)[number]) => (
    <g key={id} data-pod={id}>
      <path d={line(root, hub)} stroke={palette.dark} strokeWidth={6} strokeLinecap="round" />
      <path d={line(root, hub)} stroke={palette.metal} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={px(hub.x)} cy={px(hub.y)} r={5} fill={palette.dark} />
      <circle cx={px(hub.x)} cy={px(hub.y)} r={2.6} fill={lamp} />
      {variant !== "wire" && (
        <path data-wash d={line(hub, wash)} stroke={palette.glow} strokeWidth={7}
          strokeLinecap="round" opacity={0.16} />
      )}
    </g>
  )

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Drone fabricator building a ${solid.shape}, ${solid.resolution} voxels per edge, ${percent} per cent complete, ${viewNames[view] ?? viewNames.iso}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} per cent, layer ${Math.min(part.layer + 1, solid.layers)} of ${solid.layers}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const layer = 1 / Math.max(1, solid.layers)
        const delta = arrowStep(event.key, event.shiftKey ? layer * 3 : layer, layer * 5)
        if (delta !== 0) apply(built + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      viewBox="0 0 200 200" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>

      <g data-cell data-view={view} transform={`translate(100 ${px(anchor)})`}>
        {showGround && variant !== "wire" && (
          <>
            <ellipse data-shadow cx={px(groundAt.x)} cy={px(groundAt.y + 4)}
              rx={PLATE_HALF + 4} ry={px((PLATE_HALF + 4) * Math.max(0.12, camera.flatten))}
              fill={palette.dark} opacity={0.12} />
            {/* The platform's own shadow, tracking it across the plate. */}
            <ellipse data-craft-shadow cx={px(drift.x)} cy={px(drift.y + 4)}
              rx={DECK} ry={px(DECK * Math.max(0.1, camera.flatten))}
              fill={palette.dark} opacity={0.1} />
          </>
        )}

        {variant === "blueprint" && (
          <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.55}>
            {[0, HALF * 2].map((y) => (
              <path key={y} d={outline([
                at(-HALF, y, -HALF), at(HALF, y, -HALF), at(HALF, y, HALF), at(-HALF, y, HALF),
              ])} />
            ))}
          </g>
        )}

        {showPlate && (
          <g data-plate>
            <path d={extrudedPath(plateFootprint, camera, 0, -PLATE_DROP)} {...cast} />
            <path d={outline(plateFootprint.map((point) => camera.project(point.x, 0, point.y)))} {...machined} />
          </g>
        )}

        <g data-workpiece>
          {voxels.map((voxel) => (
            <React.Fragment key={voxel.id}>
              <path data-voxel data-layer={voxel.layer} d={voxel.hull} {...shell} strokeWidth={stroke} />
              {shade && <path d={voxel.hull} fill={palette.dark} opacity={0.2} />}
              {voxel.cap && <path data-face="top" d={voxel.cap} {...shell} strokeWidth={stroke} />}
            </React.Fragment>
          ))}
        </g>

        {cell && variant !== "wire" && (
          <g data-beam>
            <path d={line(spout, target)} stroke={palette.glow} strokeWidth={4} strokeLinecap="round" opacity={0.25} />
            <path d={line(spout, target)} stroke={palette.accent} strokeWidth={1.4} strokeLinecap="round" />
          </g>
        )}

        <g data-craft>
          {arms.filter((arm) => arm.depth <= deckDepth).map(pod)}
          <path data-nozzle d={nozzle} {...cast} />
          <path d={hull} {...shell} />
          {tipped && variant === "solid" && (
            <>
              <path d={hull} fill={palette.dark} opacity={0.18} />
              <path d={deckFace} {...shell} />
            </>
          )}
          <g data-deck transform={`translate(${px(at(craft.x, craft.y + 4, craft.z).x)} ${px(at(craft.x, craft.y + 4, craft.z).y)})`}>
            <g transform={camera.plane()}>
              <rect x={-7} y={-9} width={14} height={18} rx={3} {...cast} />
              <rect x={-5} y={-6} width={10} height={5} rx={1.5} {...machined} />
              <circle cy={5} r={2.4} fill={lamp} />
            </g>
          </g>
          {arms.filter((arm) => arm.depth > deckDepth).map(pod)}
        </g>
      </g>

      {showReadout && (
        <text data-readout x={100} y={191} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={5.5} fill={palette.foreground}>{`${percent}% · ${solid.resolution}³`}</text>
      )}
      {label && (
        <text x={100} y={198} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={4.5} fill={palette.foreground} opacity={0.75}>{label}</text>
      )}
    </svg>
  )
}

const outline = (points: Vec2[]) =>
  `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`

export { DroneFabricator }
