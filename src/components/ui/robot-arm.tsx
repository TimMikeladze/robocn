"use client"

/**
 * robot-arm — an articulated industrial arm drawn as SVG.
 *
 * Any number of links, eight end effectors, four paint styles, four mounts.
 * The pose comes from the shared kinematics core, so the same target produces
 * the same arm here and in `robot-arm-3d`.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotDrag } from "@/hooks/use-robot-motion"
import {
  useRobotArm,
  type RobotArmPose,
  type RobotTarget,
} from "@/hooks/use-robot-arm"
import {
  add2,
  chainMinReach,
  chainReach,
  forwardChain2,
  normalize2,
  scale2,
  sub2,
  toDegrees,
  type Bend,
  type Vec2,
} from "@/lib/robocn/kinematics"
import {
  capsulePath,
  circleFootprint,
  extrudedPath,
  labelTransform,
  linkRole,
  px,
  mountTransform,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotBehavior,
  type RobotMount,
  type RobotPalette,
  type RobotPaletteProps,
  type RobotSize,
  type RobotTool,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/* World units. Geometry is authored once in here and only ever scaled. */
const VIEW_WIDTH = 132
const VIEW_HEIGHT = 118
const FLOOR = 14
const SHOULDER_LIFT = 13
const DEFAULT_REACH = 64
/** The arm is drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"
/** Half the width of the castings across the machine, which side elevation
 *  never showed: the limbs are tubes and the shoulder is a can. */
const ACROSS = 3.6
/** Half the base plate and pedestal across the machine. */
const PLATE_ACROSS = 13
const PEDESTAL_ACROSS = 8.5

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotArmProps
  extends Omit<React.ComponentProps<"svg">, "color" | "target">,
    RobotPaletteProps {
  /** Relative link lengths, shoulder outward. Scaled to fill `reach`. */
  links?: number[]
  /** Total stretch in world units; the view is 132 x 118 with the base centred. */
  reach?: number
  /**
   * Controlled tool-tip goal in world units, base at (0, 0). Pass a function
   * of elapsed seconds to script a path.
   */
  target?: RobotTarget
  /**
   * Drive the arm forward instead: one angle per link, in degrees, each
   * relative to the previous segment. Overrides `target` and `behavior`.
   */
  angles?: number[]
  /** What drives the tip when `target` is null. */
  behavior?: RobotBehavior
  /** Which way the elbow breaks. */
  bend?: Bend
  tool?: RobotTool
  /** Where the camera stands. One arm, four projections. */
  view?: RobotView
  /** Jaw opening, 0 closed to 1 wide. Defaults to reacting to `active`. */
  grip?: number
  /** Tool running: sparks, spray, a spinning blade. Defaults to "while moving". */
  active?: boolean
  variant?: RobotVariant
  size?: RobotSize | number
  /** Limb weight multiplier. */
  thickness?: number
  mount?: RobotMount
  /** Tip travel in world units per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of phase offset, so a row of arms breaks step. */
  phase?: number
  /** Stencilled onto the base plate. */
  label?: string
  showBase?: boolean
  showCable?: boolean
  /** Dashed arcs for the inner and outer limits of the workspace. */
  showEnvelope?: boolean
  /** Joint angle readouts. On by default in the blueprint variant. */
  showAngles?: boolean
  showGrid?: boolean
  /** Called whenever the pose changes — handy for wiring readouts. */
  onPose?: (pose: RobotArmPose) => void
  /**
   * Press and drag the frame to send the tip there; release and the arm goes
   * back to its behaviour. This is also the only way an arm is reachable on a
   * touch device, where there is no pointer to follow.
   */
  interactive?: boolean
  /** The dragged goal in world units, and null on release. */
  onTargetChange?: (target: Vec2 | null) => void
}

function RobotArm({
  links = [1, 0.82, 0.34],
  reach = DEFAULT_REACH,
  target = null,
  angles,
  behavior = "idle",
  bend = "up",
  tool = "gripper",
  view = NATIVE_VIEW,
  grip,
  active,
  variant = "solid",
  size = "md",
  thickness = 1,
  mount = "floor",
  speed,
  animate = true,
  paused = false,
  phase = 0,
  label,
  showBase = true,
  showCable = true,
  showEnvelope = false,
  showAngles,
  showGrid,
  onPose,
  interactive = false,
  onTargetChange,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  ...props
}: RobotArmProps) {
  const uid = React.useId().replace(/[:]/g, "")
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
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const blueprint = variant === "blueprint"
  const annotate = showAngles ?? blueprint
  const gridded = showGrid ?? blueprint

  // Link ratios are scaled to the requested reach, so `links` stays a shape
  // description and `reach` stays the only length anyone has to think about.
  const scaled = React.useMemo(() => {
    const total = links.reduce((sum, link) => sum + Math.max(link, 0.01), 0)
    return links.map((link) => (Math.max(link, 0.01) / total) * reach)
  }, [links, reach])

  const root = React.useMemo<Vec2>(() => ({ x: 0, y: SHOULDER_LIFT }), [])

  const svgRef = React.useRef<SVGSVGElement>(null)
  const toWorld = React.useCallback((unit: Vec2) => toWorldUnits(unit, mount), [mount])
  const pointer = usePointerTarget(svgRef, {
    enabled: behavior === "pointer" && !paused,
    toWorld,
  })

  // A press beats both the behaviour and the hover: whoever is touching the
  // arm is driving it.
  const [held, setHeld] = React.useState<Vec2 | null>(null)
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive && !angles,
    onDrag: React.useCallback((unit) => {
      const to = toWorld(unit)
      setHeld(to)
      onTargetChange?.(to)
    }, [toWorld, onTargetChange, setHeld]),
    onDragEnd: React.useCallback(() => {
      setHeld(null)
      onTargetChange?.(null)
    }, [onTargetChange, setHeld]),
  })

  const pose = useRobotArm({
    links: scaled,
    root,
    target: held ?? (behavior === "pointer" ? (target ?? pointer.target) : target),
    behavior,
    bend,
    speed,
    animate,
    paused,
    phase,
  })

  React.useEffect(() => {
    onPose?.(pose)
  }, [onPose, pose])

  // Forward kinematics wins when angles are supplied: the arm is then driven
  // joint by joint, which is what a control panel wants.
  const driven = React.useMemo(
    () => (angles ? forwardChain2(root, angles, scaled) : null),
    [angles, root, scaled],
  )
  const engaged = active ?? (driven ? false : pose.moving)
  const joints = driven ?? pose.joints
  const tip = joints[joints.length - 1]
  const wrist = joints[joints.length - 2] ?? root
  const heading = Math.atan2(tip.y - wrist.y, tip.x - wrist.x)
  const weight = thickness * (reach / DEFAULT_REACH)
  const rootWeight = 3.1 * weight
  const tipWeight = 1.9 * weight

  // One arm, four cameras. The drawing is a section through the machine's own
  // vertical plane, so it goes through `wall` and comes out untouched in side
  // elevation; the castings around it are solids that only read off-axis.
  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const sagittal = camera.wall(0, 90, true)
  /** A point in the drawing, `across` units out from the centre plane. */
  const at = (p: Vec2, across = 0) => {
    const point = camera.project(across, p.y, -p.x)
    return { x: point.x, y: -point.y }
  }
  const limbRadius = (index: number) =>
    rootWeight + ((tipWeight - rootWeight) * index) / Math.max(1, scaled.length - 1)
  /** A cylinder lying across the machine: the hull of its two end circles. */
  const can = (p: Vec2, radius: number, half = ACROSS) =>
    capsulePath(at(p, -half), at(p, half), radius)

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Robotic arm with ${scaled.length} links and a ${tool} end effector, ${viewNames[view] ?? viewNames.profile}`}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width={width}
      height={height}
      className={cn(
        "select-none overflow-hidden",
        interactive && !angles && "cursor-grab touch-none",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <defs>
        <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern
          id={`${uid}-grid`}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 8 0 L 0 0 0 8"
            fill="none"
            stroke={palette.grid}
            strokeWidth="0.3"
            opacity="0.35"
          />
        </pattern>
      </defs>

      {gridded ? (
        <rect
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          fill={`url(#${uid}-grid)`}
        />
      ) : null}

      {offAxis ? (
        <g
          data-solids
          transform={mountTransform(mount, VIEW_WIDTH, VIEW_HEIGHT, FLOOR)}
        >
          {showBase ? (
            <>
              <path
                d={extrudedPath(roundedFootprint(PLATE_ACROSS, 17, 4, 5), camera, 3.5, -2, 0, true)}
                {...robotSurface("dark", variant, palette, weight)}
              />
              <path
                d={extrudedPath(roundedFootprint(PEDESTAL_ACROSS, 10, 3, 4), camera, SHOULDER_LIFT, 3, 0, true)}
                {...robotSurface("shell", variant, palette, weight)}
              />
            </>
          ) : null}
          {scaled.map((_, index) => (
            <path
              key={index}
              d={capsulePath(at(joints[index]), at(joints[index + 1]), px(limbRadius(index)))}
              {...robotSurface(linkRole(index), variant, palette, weight)}
            />
          ))}
          {joints.map((joint, index) => (
            <path
              key={index}
              d={can(joint, px((rootWeight + 1.2) * (index ? 1 - (index - 1) * 0.12 : 1.2)))}
              {...robotSurface("dark", variant, palette, weight)}
            />
          ))}
          <path
            d={extrudedPath(circleFootprint(0, -tip.x, 2.6 * weight, 10), camera, tip.y + 2.2 * weight, tip.y - 2.2 * weight, 0, true)}
            {...robotSurface("metal", variant, palette, weight)}
          />
        </g>
      ) : null}

      <g
        data-view={view}
        transform={[mountTransform(mount, VIEW_WIDTH, VIEW_HEIGHT, FLOOR), sagittal]
          .filter(Boolean)
          .join(" ")}
      >
        {showEnvelope ? (
          <Envelope root={root} links={scaled} palette={palette} />
        ) : null}

        {showBase ? (
          <Base
            palette={palette}
            variant={variant}
            weight={weight}
            label={label}
            mount={mount}
            accentLit={engaged}
          />
        ) : null}

        {showCable ? (
          <Cable joints={joints} palette={palette} weight={weight} />
        ) : null}

        {scaled.map((_, index) => (
          <Limb
            key={index}
            a={joints[index]}
            b={joints[index + 1]}
            radius={
              rootWeight +
              ((tipWeight - rootWeight) * index) / Math.max(1, scaled.length - 1)
            }
            role={linkRole(index)}
            variant={variant}
            palette={palette}
            weight={weight}
          />
        ))}

        {joints.slice(1, -1).map((joint, index) => (
          <Joint
            key={index}
            at={joint}
            radius={(rootWeight + 0.9) * (1 - index * 0.12)}
            variant={variant}
            palette={palette}
            weight={weight}
          />
        ))}

        <Joint
          at={joints[0]}
          radius={rootWeight + 1.8}
          variant={variant}
          palette={palette}
          weight={weight}
          shoulder
        />

        <g
          transform={`translate(${px(tip.x)} ${px(tip.y)}) rotate(${px(toDegrees(heading))})`}
        >
          <ToolHead
            tool={tool}
            palette={palette}
            variant={variant}
            weight={weight}
            grip={grip ?? (engaged ? 0.18 : 0.7)}
            engaged={engaged}
            glowId={`${uid}-glow`}
          />
        </g>

        {annotate ? (
          <Annotations
            joints={joints}
            angles={angles ?? pose.angles}
            palette={palette}
            mount={mount}
            weight={weight}
          />
        ) : null}
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* parts                                                                       */
/* -------------------------------------------------------------------------- */

function Limb({
  a,
  b,
  radius,
  role,
  variant,
  palette,
  weight,
}: {
  a: Vec2
  b: Vec2
  radius: number
  role: ReturnType<typeof linkRole>
  variant: RobotVariant
  palette: RobotPalette
  weight: number
}) {
  const surface = robotSurface(role, variant, palette, weight)
  const inner = normalize2(sub2(b, a), { x: 1, y: 0 })
  const shrink = scale2(inner, radius * 0.55)
  return (
    <g>
      <path d={capsulePath(a, b, radius)} {...surface} />
      {variant === "solid" ? (
        // A thin lighter core reads as a machined channel down the limb.
        <path
          d={capsulePath(add2(a, shrink), sub2(b, shrink), radius * 0.34)}
          fill={role === "shell" ? palette.metal : palette.dark}
          opacity={0.55}
        />
      ) : null}
    </g>
  )
}

function Joint({
  at,
  radius,
  variant,
  palette,
  weight,
  shoulder = false,
}: {
  at: Vec2
  radius: number
  variant: RobotVariant
  palette: RobotPalette
  weight: number
  shoulder?: boolean
}) {
  const surface = robotSurface("dark", variant, palette, weight)
  return (
    <g transform={`translate(${px(at.x)} ${px(at.y)})`}>
      <circle r={px(radius)} {...surface} stroke={palette.dark} strokeWidth={0.5 * weight} />
      <circle
        r={px(radius * 0.45)}
        fill={variant === "solid" ? palette.metal : "none"}
        stroke={palette.metal}
        strokeWidth={0.5 * weight}
        opacity={0.9}
      />
      {shoulder ? (
        <circle r={px(radius * 0.16)} fill={palette.metal} opacity={0.8} />
      ) : null}
    </g>
  )
}

function Base({
  palette,
  variant,
  weight,
  label,
  mount,
  accentLit,
}: {
  palette: RobotPalette
  variant: RobotVariant
  weight: number
  label?: string
  mount: RobotMount
  accentLit: boolean
}) {
  const dark = robotSurface("dark", variant, palette, weight)
  const shell = robotSurface("shell", variant, palette, weight)
  return (
    <g>
      <rect
        x={-17}
        y={-2}
        width={34}
        height={5.5}
        rx={2}
        {...dark}
        stroke={palette.dark}
        strokeWidth={0.6 * weight}
      />
      {[-13.5, -7, 7, 13.5].map((x) => (
        <circle key={x} cx={x} cy={0.8} r={1.1} fill={palette.metal} opacity={0.85} />
      ))}
      <path
        d={`M -11 3 L 11 3 L 8 ${SHOULDER_LIFT} L -8 ${SHOULDER_LIFT} Z`}
        {...shell}
      />
      <rect
        x={-8.5}
        y={SHOULDER_LIFT - 3.4}
        width={17}
        height={2.2}
        rx={1}
        fill={palette.accent}
        opacity={accentLit ? 1 : 0.55}
      />
      {label ? (
        <g transform={`translate(0 6.5) ${labelTransform(mount)}`}>
          <text
            textAnchor="middle"
            fontSize={3.6}
            fontFamily="ui-monospace, monospace"
            letterSpacing="0.4"
            fill={palette.metal}
          >
            {label}
          </text>
        </g>
      ) : null}
    </g>
  )
}

/** Loom running from the base to the wrist, sagging under its own weight. */
function Cable({
  joints,
  palette,
  weight,
}: {
  joints: Vec2[]
  palette: RobotPalette
  weight: number
}) {
  const start = { x: -6, y: SHOULDER_LIFT - 1 }
  const end = joints[joints.length - 2] ?? joints[0]
  const mid = joints[Math.max(1, Math.floor(joints.length / 2))]
  return (
    <path
      d={`M ${px(start.x)} ${px(start.y)} Q ${px(mid.x - 5)} ${px(mid.y - 8)} ${px(end.x)} ${px(end.y)}`}
      fill="none"
      stroke={palette.dark}
      strokeWidth={1.1 * weight}
      strokeLinecap="round"
      opacity={0.75}
    />
  )
}

function Envelope({
  root,
  links,
  palette,
}: {
  root: Vec2
  links: number[]
  palette: RobotPalette
}) {
  const outer = chainReach(links)
  const inner = chainMinReach(links)
  return (
    <g
      fill="none"
      stroke={palette.grid}
      strokeWidth={0.4}
      strokeDasharray="2 2"
      opacity={0.7}
    >
      <circle cx={px(root.x)} cy={px(root.y)} r={px(outer)} />
      {inner > 0.5 ? <circle cx={px(root.x)} cy={px(root.y)} r={px(inner)} /> : null}
    </g>
  )
}

/**
 * End effectors. Drawn in the wrist frame: +x runs out along the last link, so
 * a tool never has to know how the arm got there.
 */
function ToolHead({
  tool,
  palette,
  variant,
  weight,
  grip,
  engaged,
  glowId,
}: {
  tool: RobotTool
  palette: RobotPalette
  variant: RobotVariant
  weight: number
  grip: number
  engaged: boolean
  glowId: string
}) {
  const metal = robotSurface("metal", variant, palette, weight)
  const dark = robotSurface("dark", variant, palette, weight)
  const jaw = 1.6 + grip * 3.4

  return (
    <g>
      <rect x={-1.4} y={-3} width={4.4} height={6} rx={1.2} {...dark} />
      <rect x={2.4} y={-2.2} width={1.6} height={4.4} rx={0.6} {...metal} />

      {tool === "gripper" ? (
        <g>
          {[1, -1].map((side) => (
            <path
              key={side}
              d={`M 4 ${side * 1.2} L ${7.4} ${side * jaw} L ${9.6} ${side * (jaw - 0.5)} L ${9.6} ${side * (jaw + 1.1)} L ${6.6} ${side * (jaw + 1.4)} L 4 ${side * 2.6} Z`}
              {...metal}
            />
          ))}
        </g>
      ) : null}

      {tool === "welder" ? (
        <g>
          <path d="M 4 -1.6 L 9 -0.5 L 9 0.5 L 4 1.6 Z" {...metal} />
          {engaged ? (
            <g filter={`url(#${glowId})`}>
              <circle cx={10.2} cy={0} r={1.5} fill={palette.glow} />
              {[0, 1, 2, 3].map((i) => (
                <circle
                  key={i}
                  className="robocn-spark"
                  cx={10}
                  cy={(i - 1.5) * 0.9}
                  r={0.5}
                  fill={palette.glow}
                  style={{ animationDelay: `${i * -0.17}s` }}
                />
              ))}
            </g>
          ) : null}
        </g>
      ) : null}

      {tool === "painter" ? (
        <g>
          <path d="M 4 -1.9 L 8.6 -0.8 L 8.6 0.8 L 4 1.9 Z" {...metal} />
          <rect x={0.4} y={-4.6} width={2.6} height={2.4} rx={0.8} {...metal} />
          {engaged ? (
            <g>
              <path
                d="M 8.8 -0.7 L 15 -3.4 L 15 3.4 L 8.8 0.7 Z"
                fill={palette.accent}
                opacity={0.16}
              />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <circle
                  key={i}
                  className="robocn-spray"
                  cx={9}
                  cy={(i % 3) - 1}
                  r={0.45}
                  fill={palette.accent}
                  style={{ animationDelay: `${i * -0.14}s` }}
                />
              ))}
            </g>
          ) : null}
        </g>
      ) : null}

      {tool === "cutter" ? (
        <g transform="translate(7.4 0)">
          <g
            className={engaged ? "robocn-spin" : undefined}
            style={{ transformOrigin: "0px 0px" }}
          >
            <circle r={3.4} {...metal} />
            <circle
              r={3.4}
              fill="none"
              stroke={palette.dark}
              strokeWidth={0.8}
              strokeDasharray="1.4 1.4"
            />
          </g>
          <circle r={0.9} fill={palette.dark} />
        </g>
      ) : null}

      {tool === "scanner" ? (
        <g>
          <circle cx={6.4} cy={0} r={2.6} fill="none" stroke={palette.accent} strokeWidth={0.9} />
          {engaged ? (
            <g className="robocn-scan" style={{ transformOrigin: "6.4px 0px" }}>
              <path
                d="M 6.4 0 L 14 -4 L 14 4 Z"
                fill={palette.accent}
                opacity={0.18}
              />
            </g>
          ) : null}
        </g>
      ) : null}

      {tool === "vacuum" ? (
        <g>
          <rect x={4} y={-1.4} width={2.4} height={2.8} rx={0.6} {...metal} />
          <path d="M 6.4 -3.4 L 9.8 -2 L 9.8 2 L 6.4 3.4 Z" {...dark} />
          <ellipse cx={10} cy={0} rx={0.9} ry={3.2} fill={palette.dark} opacity={0.9} />
        </g>
      ) : null}

      {tool === "magnet" ? (
        <g>
          <path
            d="M 4.2 -3.4 A 4 4 0 0 1 4.2 3.4 L 4.2 1.4 A 2 2 0 0 0 4.2 -1.4 Z"
            {...metal}
          />
          <rect x={3.4} y={-3.6} width={1.4} height={2.2} fill={palette.accent} />
          <rect x={3.4} y={1.4} width={1.4} height={2.2} fill={palette.dark} />
        </g>
      ) : null}

      <circle
        cx={-1.8}
        cy={0}
        r={engaged ? 1.15 : 0.85}
        fill={palette.glow}
        className={engaged ? "robocn-pulse" : undefined}
        filter={engaged ? `url(#${glowId})` : undefined}
      />
    </g>
  )
}

function Annotations({
  joints,
  angles,
  palette,
  mount,
  weight,
}: {
  joints: Vec2[]
  angles: number[]
  palette: RobotPalette
  mount: RobotMount
  weight: number
}) {
  const tip = joints[joints.length - 1]
  return (
    <g>
      {joints.slice(0, -1).map((joint, index) => (
        <g
          key={index}
          transform={`translate(${px(joint.x + 5)} ${px(joint.y + 5)}) ${labelTransform(mount)}`}
        >
          <text
            fontSize={3.4}
            fontFamily="ui-monospace, monospace"
            fill={palette.grid}
          >
            {`J${index + 1} ${angles[index]?.toFixed(0) ?? 0}°`}
          </text>
        </g>
      ))}
      <g
        stroke={palette.accent}
        strokeWidth={0.4 * weight}
        opacity={0.8}
        fill="none"
      >
        <path d={`M ${px(tip.x - 5)} ${px(tip.y)} H ${px(tip.x + 5)}`} />
        <path d={`M ${px(tip.x)} ${px(tip.y - 5)} V ${px(tip.y + 5)}`} />
        <circle cx={px(tip.x)} cy={px(tip.y)} r={2.6} strokeDasharray="1.2 1.2" />
      </g>
      <g transform={`translate(${px(tip.x + 6)} ${px(tip.y - 6)}) ${labelTransform(mount)}`}>
        <text
          fontSize={3.2}
          fontFamily="ui-monospace, monospace"
          fill={palette.accent}
        >
          {`${tip.x.toFixed(0)}, ${tip.y.toFixed(0)}`}
        </text>
      </g>
    </g>
  )
}

/* -------------------------------------------------------------------------- */
/* pointer mapping                                                             */
/* -------------------------------------------------------------------------- */

/** Inverse of {@link mountTransform}: a point in the box, in robot coordinates. */
function toWorldUnits(unit: Vec2, mount: RobotMount): Vec2 {
  const sx = unit.x * VIEW_WIDTH
  const sy = unit.y * VIEW_HEIGHT
  switch (mount) {
    case "ceiling":
      return { x: sx - VIEW_WIDTH / 2, y: sy - FLOOR }
    case "wall-left":
      return { x: VIEW_HEIGHT / 2 - sy, y: sx - FLOOR }
    case "wall-right":
      return { x: VIEW_HEIGHT / 2 - sy, y: VIEW_WIDTH - FLOOR - sx }
    default:
      return { x: sx - VIEW_WIDTH / 2, y: VIEW_HEIGHT - FLOOR - sy }
  }
}

export {
  RobotArm,
  FLOOR as ROBOT_ARM_FLOOR,
  VIEW_HEIGHT as ROBOT_ARM_VIEW_HEIGHT,
  VIEW_WIDTH as ROBOT_ARM_VIEW_WIDTH,
}
