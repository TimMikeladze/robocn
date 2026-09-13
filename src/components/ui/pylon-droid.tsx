"use client"

/**
 * pylon-droid — a survey pylon that stands itself up.
 *
 * Stowed, the machine is one thing: a sharp equilateral plate flat on the
 * ground with every limb folded inside its own outline. `deploy` is the whole
 * machine — it lifts the chassis on two solved legs, swings the aft strut back
 * into a tripod, and splits the plate at the waist so the apex cap rises off a
 * lit core. Nothing else in the set hides inside its own silhouette, and that
 * is what this one is for.
 *
 * Design note: docs/pylon-droid.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import {
  clamp,
  convexHull2,
  lerp,
  solveChain2,
  toDegrees,
  toRadians,
  type Vec2,
} from "@/lib/robocn/kinematics"
import {
  capsulePath,
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
import { cn } from "@/lib/utils"

export type PylonDroidBehavior = "deploy" | "survey" | "stow" | "static"
/** How far out the feet plant once it is standing. */
export type PylonDroidStance = "narrow" | "wide"

/** The plate is the machine, and the plate faces you. */
const NATIVE_VIEW: RobotView = "front"

/* The frame. World units: x starboard, y up from the ground, z toward the
   viewer. The drawing group sits at MID, so ground lands on ORIGIN_Y. */
const CENTRE = 100
const ORIGIN_Y = 148
const MID = 52

/** The plate: an equilateral triangle 124 across, 18 thick. */
const BASE_HALF = 62
const HEIGHT = 107
const DEPTH = 9
/** Both bottom corners are cut back; the apex stays sharp. */
const CHAMFER = 5
/** Where the plate splits, and how far the apex cap climbs its mast. */
const SEAM = 46
const CAP_LIFT = 26
/** How far the chassis climbs off the ground. */
const RISE = 30

const HIP = { x: 34, y: 12 }
const THIGH = 24
const SHIN = 24
/** Stowed, the foot folds down and inboard and the knee tucks under the
 *  waist — the fold that keeps a 48-unit leg inside the outline. */
const FOOT_STOWED = { x: 12, y: 2 }
const FOOT_PLANTED = 50
const WIDE = 5

/** The third contact, hinged on the back face. */
const HINGE = { y: 16, z: -DEPTH }
const STRUT = 52
const STRUT_STOWED = 12
/** The hinge has to be bolted to something: a rib down the back face. */
const RIB = { halfWidth: 11, bottom: 6, top: 44, depth: 17 }
/** Not a tuned number: the angle that puts the pad on the ground. */
const STRUT_PLANTED = toDegrees(Math.acos(clamp(-(HINGE.y + RISE) / STRUT, -1, 1)))

const GRILLE_BARS = 4
/** Deployment units per second while easing back into the behaviour. */
const DEPLOY_RATE = 0.8

/** How far the camera pulls back so the machine still fits the frame. */
const fits: Record<RobotView, number> = { plan: 0.95, front: 1, profile: 0.95, iso: 0.88 }

/** Looking straight down there is no ground line to stand on, so the plan
 *  view hangs its footprint in the middle of the frame instead. */
const origins: Record<RobotView, number> = { plan: 106, front: ORIGIN_Y, profile: ORIGIN_Y, iso: 142 }

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

const stances: Record<PylonDroidStance, number> = { narrow: 0, wide: WIDE }

/** Half the plate's width at a height up it. */
const edgeHalf = (y: number) => Math.max(0, BASE_HALF * (1 - y / HEIGHT))
const SEAM_HALF = edgeHalf(SEAM)

/** The core between the plates. Above the seam it follows the plate's own
 *  taper, because stowed it has to be inside the cap. */
const CORE: readonly Vec2[] = [
  { x: -22, y: 32 },
  { x: 22, y: 32 },
  { x: 22, y: SEAM },
  { x: edgeHalf(82) - 3, y: 82 },
  { x: -(edgeHalf(82) - 3), y: 82 },
  { x: -22, y: SEAM },
]

/** The chassis plate, chamfered at the two ground corners. */
const LOWER: readonly Vec2[] = [
  { x: -(BASE_HALF - CHAMFER), y: 0 },
  { x: BASE_HALF - CHAMFER, y: 0 },
  { x: BASE_HALF - CHAMFER * 0.5, y: CHAMFER * 0.866 },
  { x: SEAM_HALF, y: SEAM },
  { x: -SEAM_HALF, y: SEAM },
  { x: -(BASE_HALF - CHAMFER * 0.5), y: CHAMFER * 0.866 },
]

/** The apex cap: the top of the same triangle, cut at the seam. */
const CAP: readonly Vec2[] = [
  { x: -SEAM_HALF, y: SEAM },
  { x: SEAM_HALF, y: SEAM },
  { x: 0, y: HEIGHT },
]

export interface PylonDroidProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One pylon, four projections. */
  view?: RobotView
  /** 0 stowed flat, 1 standing. Supplying it stops the loop. */
  deploy?: number
  /** What it does when `deploy` is not supplied. */
  behavior?: PylonDroidBehavior
  /** Deployment cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a row of them breaks step. */
  phase?: number
  /** Drag it up and down, or stand it up from the arrow keys. */
  interactive?: boolean
  onDeployChange?: (deploy: number) => void
  /** Controlled optic aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** The optic follows the page pointer while `look` is null. */
  track?: boolean
  /** How wide it plants its feet. */
  stance?: PylonDroidStance
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function PylonDroid({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  deploy,
  behavior = "deploy",
  speed = 0.22,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onDeployChange,
  look = null,
  track = true,
  stance = "narrow",
  signal = "ready",
  showGround = true,
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
  ...props
}: PylonDroidProps) {
  const controlled = deploy !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? finiteClamp(deploy, 0, 1, 0) : held

  const goal = React.useCallback(
    (clock: number) => pylonDroidPose(behavior, clock).deploy,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: DEPLOY_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const stood = finiteClamp(motion.value, 0, 1, 0)
  const scripted = pylonDroidPose(behavior, motion.clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onDeployChange?.(bounded)
    },
    [onDeployChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // The top half of the box is the whole stroke.
    onDrag: React.useCallback((unit: Vec2) => apply((0.75 - unit.y) / 0.5), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: track && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback(
      (unit: Vec2) => ({
        x: clamp((unit.x - 0.5) * 2, -1, 1),
        y: clamp((unit.y - 0.5) * 2, -1, 1),
      }),
      [],
    ),
  })
  const aim = look ?? pointer.target ?? { x: clamp(scripted.pan, -1, 1), y: 0 }
  const iris = { x: clamp(finite(aim.x), -1, 1) * 6, y: clamp(finite(aim.y), -1, 1) * 2 }

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  /* ---------------------------------------------------------------- pose */

  const spread = stances[stance] ?? stances.narrow
  const rise = RISE * stood
  const capLift = CAP_LIFT * stood
  /** The core is powered as the waist opens. */
  const lamp = stood

  const legs = ([-1, 1] as const).map((side) => {
    // Solved on the starboard side and mirrored, so the pair is symmetric.
    const hip = { x: HIP.x, y: HIP.y + rise }
    const foot = {
      x: lerp(FOOT_STOWED.x, FOOT_PLANTED + spread, stood),
      y: lerp(FOOT_STOWED.y, 0, stood),
    }
    // One bend the whole way: the knee swings out as the foot slides out and
    // comes back under the hip as the leg straightens, never flipping side.
    const [, knee, tip] = solveChain2(hip, foot, [THIGH, SHIN], { bend: "down" })
    return {
      side,
      name: side === -1 ? "left" : "right",
      hip: { x: hip.x * side, y: hip.y },
      knee: { x: knee.x * side, y: knee.y },
      tip: { x: tip.x * side, y: tip.y },
    }
  })

  const strutAngle = toRadians(lerp(STRUT_STOWED, STRUT_PLANTED, stood))
  const hinge = { y: HINGE.y + rise, z: HINGE.z }
  const strutTip = {
    y: hinge.y + STRUT * Math.cos(strutAngle),
    z: hinge.z - STRUT * Math.sin(strutAngle),
  }

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const offAxis = view !== NATIVE_VIEW
  const fit = fits[view] ?? 1
  const origin = origins[view] ?? ORIGIN_Y
  /** A world point: x starboard, y up from the ground, z toward the viewer. */
  const at = (x: number, y: number, z = 0): Vec2 => camera.project(-x, y - MID, -z)
  /** Drawing coordinates inside a wall group: x across, y down from MID. */
  const fy = (y: number) => MID - y
  const facePath = (poly: readonly Vec2[]) =>
    `${poly.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(fy(p.y))}`).join(" ")} Z`
  /** The silhouette of a solid: the hull of its projected corners. */
  const hullPath = (points: Vec2[]) => {
    const hull = convexHull2(points)
    if (hull.length < 3) return ""
    return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
  }
  /** A plate as a prism: its two faces, hulled. Exact for a convex outline. */
  const prism = (poly: readonly Vec2[], climb: number) =>
    hullPath(poly.flatMap((p) => [at(p.x, p.y + climb, DEPTH), at(p.x, p.y + climb, -DEPTH)]))
  /** A foot pad standing on the ground at (x, z). */
  const padPath = (x: number, y: number, z: number, halfWidth: number, halfDepth: number) =>
    hullPath(
      roundedFootprint(halfWidth, halfDepth, 2.5, 4).flatMap((p) => [
        at(x + p.x, y + 4, z - p.y),
        at(x + p.x, y, z - p.y),
      ]),
    )

  /** The hinge mount: a rib standing off the back face. */
  const ribPath = hullPath(
    [-RIB.halfWidth, RIB.halfWidth].flatMap((x) =>
      [RIB.bottom + rise, RIB.top + rise].flatMap((y) => [at(x, y, -DEPTH), at(x, y, -RIB.depth)]),
    ),
  )

  const wall = camera.wall(DEPTH)
  const readout = Math.round(stood * 100)
  const state = dragging
    ? "raised by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "survey"
        ? "surveying"
        : behavior === "stow"
          ? "stowed"
          : "deploying"

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Pylon droid, ${state}, ${readout} percent deployed, ${viewNames[view] ?? viewNames.front}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent deployed` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox="0 0 200 232"
      width={width}
      height={px((width * 232) / 200)}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.25)
        if (delta !== 0) apply(stood + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      {...props}
    >
      {variant === "blueprint" && (
        <g fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.45}>
          <path d={`M 14 ${origin + MID} H 186 M ${CENTRE} 26 V 214`} strokeDasharray="2 3" />
          <path
            d={`M 26 ${px(at(0, rise, 0).y + origin)} H 174`}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        </g>
      )}

      <g transform={`translate(${CENTRE} ${origin})${fit === 1 ? "" : ` scale(${fit})`}`}>
        {showGround && (
          <g
            data-contact
            transform={`translate(${px(at(0, 0, 0).x)} ${px(at(0, 0, 0).y)}) ${camera.plane()}`.trimEnd()}
          >
            <ellipse
              rx={px(lerp(58, 56, stood))}
              ry={px(lerp(11, 26, stood))}
              fill={palette.dark}
              opacity={px(0.2 - stood * 0.06)}
            />
          </g>
        )}

        <g data-pylon data-view={view}>
          {/* The aft strut: a plate has no fore-aft base, so it swings one. */}
          <g data-strut>
            <path
              d={capsulePath(at(0, hinge.y, hinge.z), at(0, strutTip.y, strutTip.z), 3.4)}
              {...machined}
            />
            {/* The sleeve the strut swings through. */}
            <path
              d={capsulePath(
                at(0, lerp(hinge.y, strutTip.y, 0.22), lerp(hinge.z, strutTip.z, 0.22)),
                at(0, lerp(hinge.y, strutTip.y, 0.42), lerp(hinge.z, strutTip.z, 0.42)),
                4.6,
              )}
              {...cast}
            />
            <circle cx={px(at(0, hinge.y, hinge.z).x)} cy={px(at(0, hinge.y, hinge.z).y)} r={4} fill={palette.dark} />
            <g data-strut-foot data-y={px(strutTip.y)}>
              <path d={padPath(0, strutTip.y, strutTip.z, 8.5, 10)} {...cast} />
            </g>
          </g>

          {legs.map((leg) => (
            <g key={leg.name} data-leg={leg.name}>
              <path d={capsulePath(at(leg.hip.x, leg.hip.y), at(leg.knee.x, leg.knee.y), 4.2)} {...shell} />
              <path d={capsulePath(at(leg.knee.x, leg.knee.y), at(leg.tip.x, leg.tip.y), 3.4)} {...machined} />
              <circle cx={px(at(leg.knee.x, leg.knee.y).x)} cy={px(at(leg.knee.x, leg.knee.y).y)} r={4.6} fill={palette.dark} />
              <circle cx={px(at(leg.hip.x, leg.hip.y).x)} cy={px(at(leg.hip.x, leg.hip.y).y)} r={4} fill={palette.dark} />
              <g data-foot={leg.name} data-y={px(leg.tip.y)}>
                <path d={padPath(leg.tip.x, leg.tip.y, 0, 10, 12)} {...cast} />
              </g>
            </g>
          ))}

          {/* Off-axis the core is a solid too, and the rib the hinge is bolted
              to only exists away from the plate's own face. */}
          {offAxis && (
            <g data-inner-solids>
              <path d={ribPath} {...machined} />
              <path d={prism(CORE, rise)} {...cast} />
            </g>
          )}

          {/* The core: a box between the plates, its readout on its own front
              face. Only the waist gap ever shows it. */}
          <g data-core transform={wall || undefined}>
            <g transform={`translate(0 ${px(-rise)})`}>
              <path d={facePath(CORE)} {...cast} />
              <path d={capsulePath({ x: -13, y: fy(78) }, { x: -13, y: fy(40) }, 2.4)} {...machined} />
              <path d={capsulePath({ x: 13, y: fy(78) }, { x: 13, y: fy(40) }, 2.4)} {...machined} />
              <path data-mast d={capsulePath({ x: 0, y: fy(78) }, { x: 0, y: fy(40) }, 3.2)} {...machined} />
              {/* Loom between the halves: it has to reach as far as the cap goes. */}
              <path
                d={`M -9 ${fy(44)} C -13 ${fy(56)} -5 ${fy(62)} -8 ${fy(76)}`}
                fill="none"
                stroke={palette.dark}
                strokeWidth={1.6}
                strokeLinecap="round"
                opacity={0.7}
              />
              <g data-grille>
                {Array.from({ length: GRILLE_BARS }, (_, index) => {
                  const lit = (index + 0.5) / GRILLE_BARS < lamp
                  return (
                    <rect
                      key={index}
                      data-bar={index}
                      data-lit={lit ? "" : undefined}
                      x={-11}
                      y={px(fy(50 + index * 6) - 1.6)}
                      width={22}
                      height={3.2}
                      rx={1.2}
                      fill={lit ? signalColor : palette.metal}
                      opacity={lit ? 0.95 : 0.4}
                    />
                  )
                })}
              </g>
            </g>
          </g>

          {/* Off the plate's own axis it is a solid, and the hull of the two
              faces is exactly what a prism's silhouette is. */}
          {offAxis && (
            <g data-solids>
              <path d={prism(LOWER, rise)} {...shell} />
              <path d={prism(CAP, rise + capLift)} {...shell} />
            </g>
          )}

          <g transform={wall || undefined}>
            <g data-chassis transform={`translate(0 ${px(-rise)})`}>
              <path d={facePath(LOWER)} {...shell} />
              <path
                d={facePath(inset(LOWER, 5))}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.8}
                opacity={0.4}
              />
              {/* Deployment marks: which way this thing is going to move. */}
              <g fill="none" stroke={palette.dark} strokeWidth={1.4} opacity={0.35} strokeLinecap="round">
                {[0, 6, 12].map((offset) => (
                  <path key={offset} d={`M -9 ${fy(30 - offset)} L 0 ${fy(24 - offset)} L 9 ${fy(30 - offset)}`} />
                ))}
              </g>
              {/* Service hatch and its latches. */}
              <g data-hatch>
                <rect x={22} y={px(fy(26))} width={22} height={16} rx={2} {...machined} />
                <circle cx={26} cy={px(fy(18))} r={1.2} fill={palette.dark} />
                <circle cx={40} cy={px(fy(18))} r={1.2} fill={palette.dark} />
              </g>
              <g stroke={palette.dark} strokeWidth={0.9} opacity={0.45} strokeLinecap="round" fill="none">
                <path d={`M -44 ${fy(24)} h 18 M -44 ${fy(19)} h 18 M -44 ${fy(14)} h 12`} />
              </g>
              {[-40, -20, 0, 20, 40].map((x) => (
                <circle key={x} cx={x} cy={px(fy(5))} r={1.3} fill={palette.dark} opacity={0.8} />
              ))}
            </g>

            <g data-cap transform={`translate(0 ${px(-(rise + capLift))})`}>
              <path d={facePath(CAP)} {...shell} />
              <path
                d={facePath(inset(CAP, 5))}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.8}
                opacity={0.4}
              />
              <g data-optic>
                <rect x={-17} y={px(fy(72))} width={34} height={11} rx={5} {...cast} />
                <rect
                  data-iris
                  x={px(-5 + iris.x)}
                  y={px(fy(72) + 1.6 + iris.y)}
                  width={10}
                  height={7.8}
                  rx={3.4}
                  fill={palette.accent}
                  opacity={0.92}
                />
                <rect
                  x={px(-2.2 + iris.x)}
                  y={px(fy(72) + 3 + iris.y)}
                  width={4.4}
                  height={5}
                  rx={2}
                  fill={palette.glow}
                />
              </g>
              <path
                d={`M -14 ${fy(78)} H 14`}
                stroke={palette.dark}
                strokeWidth={1.2}
                opacity={0.5}
                strokeLinecap="round"
              />
              <g data-beacon>
                <circle cx={0} cy={px(fy(96))} r={2.2} fill={signalColor} className={signal === "ready" ? "robocn-pulse" : undefined} />
                <rect x={-3.4} y={px(fy(92))} width={6.8} height={4} rx={1.4} {...machined} />
              </g>
              <circle cx={-24} cy={px(fy(50))} r={1.3} fill={palette.dark} opacity={0.8} />
              <circle cx={24} cy={px(fy(50))} r={1.3} fill={palette.dark} opacity={0.8} />
              {variant === "blueprint" && (
                <path
                  d={`M 0 ${fy(HEIGHT)} L 0 ${fy(SEAM)}`}
                  fill="none"
                  stroke={palette.grid}
                  strokeWidth={0.5}
                  strokeDasharray="2 3"
                />
              )}
            </g>
          </g>

          {/* Live, only once the waist has something to show. */}
          {stood > 0.05 && (
            <circle
              cx={px(at(0, SEAM + rise + capLift * 0.5, DEPTH).x)}
              cy={px(at(0, SEAM + rise + capLift * 0.5, DEPTH).y)}
              r={px(1.4 + lamp * 1.4)}
              fill={palette.glow}
              opacity={px(0.25 + lamp * 0.35)}
            />
          )}
        </g>
      </g>

      {label && (
        <text
          x={CENTRE}
          y={226}
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

/* ------------------------------------------------------------------ maths */

const finite = (value: number) => (Number.isFinite(value) ? value : 0)
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const round3 = (value: number) => Math.round(value * 1000) / 1000

/**
 * A convex outline pulled in by a fixed distance: the panel border inside the
 * plate edge. Each vertex moves along the bisector of its two edges, which is
 * exact for a convex polygon.
 */
function inset(poly: readonly Vec2[], by: number): Vec2[] {
  const centroid = poly.reduce((sum, p) => ({ x: sum.x + p.x / poly.length, y: sum.y + p.y / poly.length }), { x: 0, y: 0 })
  return poly.map((p) => {
    const dx = p.x - centroid.x
    const dy = p.y - centroid.y
    const length = Math.hypot(dx, dy) || 1
    const pull = Math.min(by * 1.6, length - 1)
    return { x: p.x - (dx / length) * pull, y: p.y - (dy / length) * pull }
  })
}

/** Smooth both ends of a 0..1 ramp, so the machine does not jerk off the deck. */
const ease = (t: number) => {
  const clamped = clamp(t, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

/**
 * What it does with no deployment on it. `deploy` is the stroke the loop eases
 * toward and `pan` is where the optic looks while nothing is pointing at it.
 * Illustrative: there is no mass, no balance and no ground reaction here.
 */
export function pylonDroidPose(behavior: PylonDroidBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  const cycle = ((time % 1) + 1) % 1
  switch (behavior) {
    // Stood up and working: a breath in the legs and a slow sweep.
    case "survey":
      return {
        deploy: 0.92 + 0.06 * Math.sin(time * Math.PI * 2),
        pan: Math.sin(time * Math.PI * 0.6),
      }
    // Dormant: flat on the deck, with the beacon ticking over.
    case "stow":
      return { deploy: 0.02 + 0.02 * Math.sin(time * Math.PI), pan: 0 }
    case "static":
      return { deploy: 1, pan: 0 }
    // The duty cycle: stand, hold the station, sit back down.
    default:
      return {
        deploy:
          cycle < 0.3
            ? ease(cycle / 0.3)
            : cycle < 0.7
              ? 1
              : cycle < 0.95
                ? ease(1 - (cycle - 0.7) / 0.25)
                : 0,
        pan: 0.4 * Math.sin(time * Math.PI * 2),
      }
  }
}

export { PylonDroid }
