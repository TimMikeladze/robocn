"use client"

/**
 * arm-fabricator — the same build, on an articulated arm instead of a gantry.
 *
 * The gantry `fabricator` gets to the work by moving three axes that are
 * already lined up with it. This one has to reach: the turret yaws toward the
 * cell being laid, and the shoulder and elbow are solved for it with the
 * analytic two-link elbow in the arm's own vertical plane. The goal is clamped
 * onto the reachable sphere before it is solved, so both links always hold the
 * lengths they claim; a cell the arm cannot get to shows as a longer beam, not
 * as a stretched forearm.
 *
 * What is solved: the yaw, the shoulder and the elbow. What is illustrated:
 * the wrist, which holds the nozzle vertical because that is how a deposition
 * head works, rather than being solved for an orientation.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, clampToReach2, solveElbow2, toDegrees, toRadians, type Vec2 } from "@/lib/robocn/kinematics"
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
const HALF = 24
const PLATE_HALF = 30
const PLATE_DROP = 6
/** Where the pedestal stands, and how high the shoulder sits on it. */
const BASE = { x: -46, z: 0 }
const SHOULDER_Y = 14
/**
 * Upper arm and forearm, sized so every cell in the volume is inside the
 * reachable sphere from where the pedestal stands — an arm that spends the
 * whole build clamped to its own limit is a badly placed arm.
 */
const UPPER = 52
const FORE = 44
const NOZZLE_DROP = 12
/** Nozzle standoff above the cell being laid. */
const STANDOFF = 6
/** Where the wrist parks when there is nothing left to lay. */
const HOME = { x: -14, y: 56, z: 0 }
const BUILD_RATE = 0.6

/** Screen position of the world origin, chosen so each view fills the frame. */
const anchors: Record<RobotView, Vec2> = {
  plan: { x: 120, y: 95 },
  front: { x: 90, y: 127 },
  profile: { x: 105, y: 129 },
  iso: { x: 93, y: 127 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface ArmFabricatorProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  shape?: VoxelShape
  /** Voxels along one edge, clamped to 2–14. Animated under `refine`. */
  resolution?: number
  /** Controlled build fraction, 0–1. Omit it and the arm runs `behavior`. */
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
  /** Which way the elbow breaks. */
  elbow?: "up" | "down"
  showPlate?: boolean
  showGround?: boolean
  showReadout?: boolean
  signal?: "idle" | "ready" | "warning"
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ArmFabricator({
  shape = "gear", resolution, progress, behavior = "build", speed = 0.12,
  animate = true, paused = false, phase = 0,
  interactive = false, onProgressChange,
  view = "iso", elbow = "up", showPlate = true, showGround = true, showReadout = true,
  signal, label, size = "md", variant = "solid",
  color, accent, metal, dark, glow, grid, palette: paletteOverride,
  className, style, role, tabIndex, onKeyDown, onBlur, ...props
}: ArmFabricatorProps) {
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
  // The nozzle sits above the cell; the wrist sits above the nozzle, because a
  // deposition head points straight down.
  const commanded = cell
    ? { x: cell.x, y: cell.top + STANDOFF + NOZZLE_DROP, z: cell.z }
    : HOME

  // Plan-view bearing from the pedestal to the work: the yaw axis.
  const reachX = commanded.x - BASE.x
  const reachZ = commanded.z - BASE.z
  const span = Math.hypot(reachX, reachZ)
  const bearing = span < 1e-3 ? { x: 0, y: -1 } : { x: reachX / span, y: reachZ / span }
  const shoulderPlane = { x: 0, y: SHOULDER_Y }
  // Shoulder and elbow are solved in the arm's own vertical plane, where the
  // horizontal axis is that bearing and the vertical axis is world height. The
  // goal is clamped onto the reachable sphere first, so the drawn links are
  // the lengths they claim to be even when the cell is out of reach — the
  // shortfall shows as a longer beam, not as a stretched forearm.
  const goalPlane = clampToReach2(shoulderPlane, { x: span, y: commanded.y }, [UPPER, FORE])
  const planar = solveElbow2(
    shoulderPlane,
    goalPlane,
    UPPER,
    FORE,
    elbow === "down" ? "down" : "up",
  )
  /** Lift a point in the arm's plane back out into the world. */
  const outOfPlane = (point: Vec2) => ({
    x: BASE.x + bearing.x * point.x,
    y: point.y,
    z: BASE.z + bearing.y * point.x,
  })
  const inPlane = (point: Vec2) => {
    const world = outOfPlane(point)
    return at(world.x, world.y, world.z)
  }

  const wrist = outOfPlane(goalPlane)
  const elbowWorld = outOfPlane(planar)
  const shoulder = inPlane(shoulderPlane)
  const elbowAt = inPlane(planar)
  const wristAt = inPlane(goalPlane)
  const spout = at(wrist.x, wrist.y - NOZZLE_DROP, wrist.z)
  const target = cell ? at(cell.x, cell.top, cell.z) : spout
  /** Degrees the turret is turned, so the yaw axis is a visible mechanism. */
  const yaw = px(toDegrees(Math.atan2(-bearing.x, bearing.y)))

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
  const pedestal = extrudedPath(roundedFootprint(13, 13, 5, 5).map((point) => ({
    x: point.x + BASE.x, y: point.y + BASE.z,
  })), camera, 7, -PLATE_DROP)
  const column = extrudedPath(roundedFootprint(7, 7, 3, 4).map((point) => ({
    x: point.x + BASE.x, y: point.y + BASE.z,
  })), camera, 8, 5)
  // The turret: the yaw axis, drawn so the base visibly faces the work. The
  // footprint is turned about its own centre before it is moved onto the
  // pedestal — `extrudedPath`'s own spin turns about the world origin, which
  // would swing the turret away from the machine it is bolted to.
  const turret = extrudedPath(
    turned(roundedFootprint(8, 13, 4, 4), yaw, BASE),
    camera, SHOULDER_Y + 4, 7,
  )
  const nozzle = extrudedPath([
    { x: wrist.x - 2.6, y: wrist.z - 2.6 }, { x: wrist.x + 2.6, y: wrist.z - 2.6 },
    { x: wrist.x + 2.6, y: wrist.z + 2.6 }, { x: wrist.x - 2.6, y: wrist.z + 2.6 },
  ], camera, wrist.y - NOZZLE_DROP + 6, wrist.y - NOZZLE_DROP)
  const shadow = at(0, -PLATE_DROP, 0)

  const percent = Math.round(built * 100)

  // Paint order against the workpiece: reaching over the far side of the solid
  // puts the arm behind it, which is the one place a fixed order reads wrong.
  const reach = camera.depth(elbowWorld.x, elbowWorld.y, elbowWorld.z)
  const behind = voxels.length > 0 && reach < Math.max(...voxels.map((voxel) => voxel.depth))
  const arm = (
    <g data-arm>
      <path d={line(shoulder, elbowAt)} stroke={palette.dark} strokeWidth={11} strokeLinecap="round" />
      <path d={line(shoulder, elbowAt)} stroke={palette.shell} strokeWidth={7} strokeLinecap="round" />
      <path d={line(elbowAt, wristAt)} stroke={palette.dark} strokeWidth={9} strokeLinecap="round" />
      <path d={line(elbowAt, wristAt)} stroke={palette.metal} strokeWidth={5.5} strokeLinecap="round" />
      <circle data-joint="shoulder" cx={px(shoulder.x)} cy={px(shoulder.y)} r={5.5} fill={palette.dark} />
      <circle data-joint="elbow" cx={px(elbowAt.x)} cy={px(elbowAt.y)} r={4.6} fill={palette.dark} />
      <circle data-joint="wrist" cx={px(wristAt.x)} cy={px(wristAt.y)} r={3.8} fill={palette.dark} />
      <path d={line(wristAt, spout)} stroke={palette.metal} strokeWidth={4} strokeLinecap="round" />
      <path data-nozzle d={nozzle} {...shell} />
      <circle data-lamp cx={px(shoulder.x)} cy={px(shoulder.y)} r={2} fill={lamp} />
    </g>
  )

  return (
    <svg ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Arm fabricator building a ${solid.shape}, ${solid.resolution} voxels per edge, ${percent} per cent complete, ${viewNames[view] ?? viewNames.iso}`}
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
      viewBox="0 0 210 190" width={width} height={px(width * 190 / 210)}
      className={cn("max-w-full select-none", interactive && "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]", dragging && "cursor-grabbing", className)}
      style={{ color: palette.foreground, ...style }} {...props}>

      <g data-cell data-view={view} transform={`translate(${px(anchor.x)} ${px(anchor.y)})`}>
        {showGround && variant !== "wire" && (
          <ellipse data-shadow cx={px(shadow.x)} cy={px(shadow.y + 4)}
            rx={PLATE_HALF + 4} ry={px((PLATE_HALF + 4) * Math.max(0.12, camera.flatten))}
            fill={palette.dark} opacity={0.12} />
        )}

        {variant === "blueprint" && (
          <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} strokeDasharray="2 3" opacity={0.55}>
            {/* Reach: the sphere the arm can actually get the nozzle into. */}
            <path d={line(shoulder, elbowAt)} />
            <path d={line(elbowAt, wristAt)} />
            <path d={outline([
              at(-HALF, HALF * 2, -HALF), at(HALF, HALF * 2, -HALF),
              at(HALF, HALF * 2, HALF), at(-HALF, HALF * 2, HALF),
            ])} />
          </g>
        )}

        {showPlate && (
          <g data-plate>
            <path d={extrudedPath(plateFootprint, camera, 0, -PLATE_DROP)} {...cast} />
            <path d={outline(plateFootprint.map((point) => camera.project(point.x, 0, point.y)))} {...machined} />
            <path d={outline([
              at(-HALF, 0.1, -HALF), at(HALF, 0.1, -HALF), at(HALF, 0.1, HALF), at(-HALF, 0.1, HALF),
            ])} fill="none" stroke={palette.grid} strokeWidth={0.7} strokeDasharray="3 2" />
          </g>
        )}

        <g data-base>
          <path d={pedestal} {...cast} />
          <path d={column} {...machined} />
          <path data-turret data-yaw={yaw} d={turret} {...shell} />
        </g>

        {behind && arm}

        <g data-workpiece>
          {voxels.map((voxel) => (
            <React.Fragment key={voxel.id}>
              <path data-voxel data-layer={voxel.layer} d={voxel.hull} {...shell} strokeWidth={stroke} />
              {shade && <path d={voxel.hull} fill={palette.dark} opacity={0.2} />}
              {voxel.cap && <path data-face="top" d={voxel.cap} {...shell} strokeWidth={stroke} />}
            </React.Fragment>
          ))}
        </g>

        {!behind && arm}

        {cell && variant !== "wire" && (
          <g data-beam>
            <path d={line(spout, target)} stroke={palette.glow} strokeWidth={4} strokeLinecap="round" opacity={0.25} />
            <path d={line(spout, target)} stroke={palette.accent} strokeWidth={1.4} strokeLinecap="round" />
          </g>
        )}
      </g>

      {showReadout && (
        <text data-readout x={105} y={180} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={5.5} fill={palette.foreground}>{`${percent}% · ${solid.resolution}³`}</text>
      )}
      {label && (
        <text x={105} y={187} textAnchor="middle" fontFamily="ui-monospace, monospace"
          fontSize={4.5} fill={palette.foreground} opacity={0.75}>{label}</text>
      )}
    </svg>
  )
}

/**
 * A footprint turned about its own centre and then set down at an offset.
 * `extrudedPath` can spin a footprint, but about the world origin, which is
 * only what you want for a part that is already centred there.
 */
const turned = (points: Vec2[], degrees: number, offset: { x: number; z: number }): Vec2[] => {
  const angle = toRadians(degrees)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map((point) => ({
    x: point.x * cos - point.y * sin + offset.x,
    y: point.x * sin + point.y * cos + offset.z,
  }))
}

const outline = (points: Vec2[]) =>
  `${points.map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`).join(" ")} Z`

export { ArmFabricator }
