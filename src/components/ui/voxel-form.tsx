"use client"

/**
 * voxel-form — the workpiece on its own, with no machine around it.
 *
 * Every fabricator in the set builds one of these. Pulled out as its own
 * component it is the object itself: a continuous occupancy field sampled at
 * `resolution` and drawn as vector cells, so it can sit in a hero, a card or a
 * loading state without a gantry bolted to it.
 *
 * Modelled once in world units — x starboard, y up, z toward the tail — and
 * pushed through `robotCamera(view)`.
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
  voxelSolid,
  type VoxelBehavior,
  type VoxelShape,
} from "@/lib/robocn/voxel"
import { cn } from "@/lib/utils"

const VIEW = 160
/** Build volume: half-extent in x and z, so the solid runs y 0 to 2 × HALF. */
const HALF = 40
const PLATE_HALF = 46
const PLATE_DROP = 6
/** Build fraction per second while the form catches up with its goal. */
const BUILD_RATE = 0.6

/** Screen position of the world origin, chosen so each view fills the frame. */
const anchors: Record<RobotView, number> = {
  plan: 80,
  front: 119,
  profile: 119,
  iso: 116,
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface VoxelFormProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Which field to sample. */
  shape?: VoxelShape
  /** Voxels along one edge, clamped to 2–14. Animated under `refine`. */
  resolution?: number
  /** Controlled build fraction, 0–1. Omit it and the form runs `behavior`. */
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
  /** The plate the form stands on. Off, and it floats. */
  showPlate?: boolean
  showGround?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function VoxelForm({
  shape = "sphere", resolution, progress, behavior = "build", speed = 0.14,
  animate = true, paused = false, phase = 0,
  interactive = false, onProgressChange,
  view = "iso", showPlate = true, showGround = true, label,
  size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: VoxelFormProps) {
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
  const voxels = React.useMemo(
    () => voxelPaths(part.surface, solid.resolution, camera, HALF),
    [part, solid, camera],
  )

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const shade = variant === "solid" && tipped
  const stroke = px(Math.max(0.2, 3 / solid.resolution))
  const plateFootprint = roundedFootprint(PLATE_HALF, PLATE_HALF, 8, 5)
  const percent = Math.round(built * 100)
  const origin = camera.project(0, -PLATE_DROP, 0)

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Voxel form: a ${solid.shape} at ${solid.resolution} voxels per edge, ${percent} per cent complete, ${viewNames[view] ?? viewNames.iso}`}
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
      viewBox="0 0 160 160" width={width} height={width}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>

      {showGround && variant !== "wire" && (
        <ellipse data-shadow cx={px(VIEW / 2 + origin.x)} cy={px(anchor + origin.y + 4)}
          rx={PLATE_HALF} ry={px(PLATE_HALF * Math.max(0.12, camera.flatten))}
          fill={palette.dark} opacity={0.12} />
      )}

      <g data-form data-view={view} transform={`translate(${VIEW / 2} ${px(anchor)})`}>
        {showPlate && (
          <g data-plate>
            <path d={extrudedPath(plateFootprint, camera, 0, -PLATE_DROP)} {...cast} />
            <path d={outline(plateFootprint.map((point) => camera.project(point.x, 0, point.y)))} {...machined} />
          </g>
        )}
        {variant === "blueprint" && (
          <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.6}>
            {[0, HALF * 2].map((y) => (
              <path key={y} d={outline([
                camera.project(-HALF, y, -HALF), camera.project(HALF, y, -HALF),
                camera.project(HALF, y, HALF), camera.project(-HALF, y, HALF),
              ])} />
            ))}
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
      </g>

      {label && (
        <text x={80} y={155} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={5} fill={palette.foreground}>{label}</text>
      )}
    </svg>
  )
}

const outline = (points: Vec2[]) =>
  `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`

export { VoxelForm }
