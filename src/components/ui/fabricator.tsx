"use client"

/**
 * fabricator — an additive build cell that makes its own workpiece.
 *
 * Everything else in the set moves; this one makes something. The object on
 * the plate is not artwork: it is a continuous occupancy field sampled at
 * `resolution` and laid cell by cell, so turning the resolution up builds the
 * same object out of smaller voxels rather than drawing a different picture.
 * Every voxel is an SVG path, so the whole thing scales without pixels.
 *
 * The three axes all come off one number. Deposition order is a serpentine
 * raster through the solid, progress is an index into it, and the cell at that
 * index is where the bridge, the carriage and the quill are pointing — in
 * controlled mode as much as under a behaviour.
 *
 * The cell is modelled once in world units — x starboard, y up, z toward the
 * tail — and pushed through `robotCamera(view)`.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, type Vec2 } from "@/lib/robocn/kinematics"
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

const VIEW = 200
/** Build volume: half-extent in x and z, so the cube runs y 0 to 2 × HALF. */
const HALF = 32
const VOLUME = HALF * 2
/** Build plate, and how far it hangs below the build surface. */
const PLATE_HALF = 39
const PLATE_DROP = 8
/** Enclosure columns and the rails that tie their heads together. */
const POST = 46
const POST_HALF = 2.5
const RAIL_Y = 90
/** The bridge beam the carriage traverses. */
const BRIDGE_Y = 78
/** Nozzle standoff above the cell being laid, and where it parks with none. */
const NOZZLE_GAP = 7
const PARK_Y = 70
/** Build fraction per second while the machine catches up with its goal. */
const BUILD_RATE = 0.6

/** Screen y of the world origin, chosen so each view fills the frame. */
const anchors: Record<RobotView, number> = {
  plan: 100,
  front: 140,
  profile: 140,
  iso: 137,
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface FabricatorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** What the cell is making. Each is a field, sampled — not a stored model. */
  shape?: VoxelShape
  /**
   * Voxels along one edge, clamped to 2–14. Omit it and the machine uses its
   * default, or animates it under the `refine` behavior.
   */
  resolution?: number
  /** Controlled build fraction, 0–1. Omit it and the build runs `behavior`. */
  progress?: number
  /** What the cell does when `progress` is not supplied. */
  behavior?: VoxelBehavior
  /** Build cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  phase?: number
  /** Drag up and down to lay or strip material; arrow keys step a layer. */
  interactive?: boolean
  onProgressChange?: (progress: number) => void
  /** Where the camera stands. */
  view?: RobotView
  /** The columns and rails around the build volume. */
  showEnclosure?: boolean
  showGround?: boolean
  /** The build line readout under the plate. */
  showReadout?: boolean
  /** Status lamp on the carriage. Omit it and it lights while material is landing. */
  signal?: "idle" | "ready" | "warning"
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function Fabricator({
  shape = "sphere", resolution, progress, behavior = "build", speed = 0.12,
  animate = true, paused = false, phase = 0,
  interactive = false, onProgressChange,
  view = "iso", showEnclosure = true, showGround = true, showReadout = true,
  signal, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: FabricatorProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)

  const controlled = progress !== undefined
  const hold = controlled
    ? (Number.isFinite(progress) ? clamp(progress, 0, 1) : 0)
    : held
  const goal = React.useCallback(
    (clock: number) => voxelGoal(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: BUILD_RATE,
    hold,
    speed,
    animate: animate && !controlled && behavior !== "static",
    paused,
    phase,
  })
  const built = clamp(motion.value, 0, 1)

  // `refine` is the one behavior that drives the resolution rather than the
  // build line; a supplied resolution wins over it the way progress does.
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
    // Up is more material, whichever way the camera is looking.
    onDrag: React.useCallback((unit: Vec2) => apply(1 - unit.y), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), [setHeld]),
  })

  const camera = React.useMemo(() => robotCamera(view), [view])
  const anchor = anchors[view] ?? anchors.iso
  const tipped = camera.lift > 0.01
  const at = (x: number, y: number, z: number) => camera.project(x, y, z)
  const line = (a: Vec2, b: Vec2) => `M ${px(a.x)} ${px(a.y)} L ${px(b.x)} ${px(b.y)}`

  const cursor = part.active
  const head = cursor ? voxelSite(cursor, solid.resolution, HALF) : null
  const headX = head ? head.x : 0
  const headZ = head ? head.z : 0
  const crown = head ? head.top : 0
  const nozzleY = head ? crown + NOZZLE_GAP : PARK_Y

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const shade = variant === "solid" && tipped
  const lamp = signal === "warning"
    ? palette.shell
    : signal === "idle"
      ? palette.metal
      : signal === "ready" || head
        ? palette.accent
        : palette.metal

  // One path per drawn cell, painted back to front. Rebuilt only when the laid
  // count, the shape or the camera changes — not every frame.
  const voxels = React.useMemo(
    () => voxelPaths(part.surface, solid.resolution, camera, HALF),
    [part, solid, camera],
  )

  const posts = [-POST, POST].flatMap((x) => [-POST, POST].map((z) => ({
    id: `${x}-${z}`,
    path: extrudedPath(square(x, z, POST_HALF), camera, RAIL_Y, -PLATE_DROP),
    depth: camera.depth(x, 0, z),
  })))
  const plateFootprint = roundedFootprint(PLATE_HALF, PLATE_HALF, 7, 5)
  const bridge = extrudedPath(
    roundedFootprint(POST, 4, 3, 4).map((point) => ({ x: point.x, y: point.y + headZ })),
    camera, BRIDGE_Y + 3.5, BRIDGE_Y - 3.5,
  )
  const carriage = extrudedPath(
    roundedFootprint(7, 6, 2, 4).map((point) => ({ x: point.x + headX, y: point.y + headZ })),
    camera, BRIDGE_Y + 6, BRIDGE_Y - 5,
  )
  const nozzle = extrudedPath(
    square(headX, headZ, 2.6), camera, nozzleY + 6, nozzleY,
  )
  const quillTop = at(headX, BRIDGE_Y - 4, headZ)
  const quillTip = at(headX, nozzleY + 6, headZ)
  const spout = at(headX, nozzleY, headZ)
  const target = head ? at(headX, crown, headZ) : spout
  const shadow = at(0, -PLATE_DROP, 0)

  const percent = Math.round(built * 100)
  const readout = `${percent}% · ${solid.resolution}³`
  const frame = `translate(${VIEW / 2} ${px(anchor)})`

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Voxel fabricator building a ${solid.shape}, ${solid.resolution} voxels per edge, ${percent} per cent complete, ${viewNames[view] ?? viewNames.iso}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? percent : undefined}
      aria-valuetext={interactive ? `${percent} per cent, layer ${Math.min(part.layer + 1, solid.layers)} of ${solid.layers}` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        // Arrows move the build line a whole layer, which is what the machine
        // actually does between passes.
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

      <g data-cell transform={frame}>
      {variant === "blueprint" && (
        <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.6}>
          {/* The build volume itself: the box the field is sampled inside. */}
          {[0, VOLUME].map((y) => (
            <path key={y} d={polygon([
              at(-HALF, y, -HALF), at(HALF, y, -HALF), at(HALF, y, HALF), at(-HALF, y, HALF),
            ])} />
          ))}
          {[-HALF, HALF].flatMap((x) => [-HALF, HALF].map((z) => (
            <path key={`${x}-${z}`} d={line(at(x, 0, z), at(x, VOLUME, z))} />
          )))}
        </g>
      )}

      {showGround && variant !== "wire" && (
        <ellipse data-shadow cx={px(shadow.x)} cy={px(shadow.y + 5)}
          rx={PLATE_HALF + 6} ry={px((PLATE_HALF + 6) * Math.max(0.12, camera.flatten))}
          fill={palette.dark} opacity={0.12} />
      )}

      {showEnclosure && (
        <g data-enclosure="far">
          {posts.filter((post) => post.depth <= 0).map((post) => (
            <path key={post.id} d={post.path} {...cast} opacity={tipped ? 0.7 : 1} />
          ))}
        </g>
      )}

      <g data-plate>
        <path d={extrudedPath(plateFootprint, camera, 0, -PLATE_DROP)} {...cast} />
        <path d={polygon(plateFootprint.map((point) => camera.project(point.x, 0, point.y)))} {...machined} />
        {/* The footprint of the build volume, printed on the plate. */}
        <path d={polygon([
          at(-HALF, 0.1, -HALF), at(HALF, 0.1, -HALF), at(HALF, 0.1, HALF), at(-HALF, 0.1, HALF),
        ])} fill="none" stroke={palette.grid} strokeWidth={0.7} strokeDasharray="3 2" />
      </g>

      <g data-workpiece data-view={view}>
        {voxels.map((voxel) => (
          <React.Fragment key={voxel.id}>
            <path data-voxel data-layer={voxel.layer} d={voxel.hull} {...shell} strokeWidth={px(Math.max(0.2, 3 / solid.resolution))} />
            {shade && <path d={voxel.hull} fill={palette.dark} opacity={0.2} />}
            {voxel.cap && <path data-face="top" d={voxel.cap} {...shell} strokeWidth={px(Math.max(0.2, 3 / solid.resolution))} />}
          </React.Fragment>
        ))}
      </g>

      {head && variant !== "wire" && (
        <g data-beam>
          <path d={line(spout, target)} stroke={palette.glow} strokeWidth={4} strokeLinecap="round" opacity={0.25} />
          <path d={line(spout, target)} stroke={palette.accent} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )}

      <g data-gantry>
        <path data-bridge d={bridge} {...machined} />
        <g data-head>
          {/* The quill: the Y axis, visible as the column that extends. */}
          <path d={line(quillTop, quillTip)} stroke={palette.dark} strokeWidth={7} strokeLinecap="round" />
          <path d={line(quillTop, quillTip)} stroke={palette.metal} strokeWidth={4} strokeLinecap="round" />
          <path data-nozzle d={nozzle} {...shell} />
        </g>
        <path data-carriage d={carriage} {...shell} />
        <circle data-lamp cx={px(at(headX, BRIDGE_Y + 6, headZ).x)} cy={px(at(headX, BRIDGE_Y + 6, headZ).y)} r={2.4} fill={lamp} />
      </g>

      {showEnclosure && (
        <g data-enclosure="near">
          {posts.filter((post) => post.depth > 0).map((post) => (
            <path key={post.id} d={post.path} {...cast} />
          ))}
          {[-POST, POST].map((z) => (
            <path key={`x${z}`} d={extrudedPath(
              roundedFootprint(POST, 2, 1.5, 3).map((point) => ({ x: point.x, y: point.y + z })),
              camera, RAIL_Y, RAIL_Y - 4,
            )} {...cast} />
          ))}
        </g>
      )}

      </g>

      {showReadout && (
        <text data-readout x={100} y={191} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={5.5} fill={palette.foreground}>{readout}</text>
      )}
      {label && (
        <text x={100} y={198} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={4.5} fill={palette.foreground} opacity={0.75}>{label}</text>
      )}
    </svg>
  )
}

/** A cell's plan-view footprint: x starboard, y toward the tail. */
const square = (x: number, z: number, half: number): Vec2[] => [
  { x: x - half, y: z - half },
  { x: x + half, y: z - half },
  { x: x + half, y: z + half },
  { x: x - half, y: z + half },
]

const polygon = (points: Vec2[]) =>
  `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`

export { Fabricator }
