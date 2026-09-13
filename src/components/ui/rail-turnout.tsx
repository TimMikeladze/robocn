"use client"

/**
 * rail-turnout — the points, and the fact that a route is a *state* rather
 * than a setting.
 *
 * Two switch blades share one throw bar, so they are not independent: the open
 * gap is exactly the throw less the closed one, and moving either moves both.
 * What decides which way a train goes is not a boolean somebody set — it is
 * detection, a tolerance on how close the closed blade actually is to its
 * stock rail. Stop the machine half way and there is no route set at all, and
 * that is the state a signaller sees.
 *
 * The rest is the turnout number. `N` is the crossing's rate of divergence —
 * one across for `N` along — so the crossing angle is `atan(1/N)`, and the
 * diverging route is the arc that leaves the straight tangentially at the toe
 * and arrives at exactly that angle over the lead. Everything else, the radius
 * and the offset at the crossing, follows. It is drawn to scale, which is why
 * a bigger number comes out flatter: a real turnout is a long shallow thing.
 *
 * Illustrated and not solved: rail sections, the check rails' own geometry,
 * and the point machine's internals. No forces, no locking, no interlocking,
 * and nothing runs over it.
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
import { bladePose, turnoutGeometry, turnoutPoint } from "@/lib/robocn/rail"
import { cn } from "@/lib/utils"

const VIEW_WIDTH = 120
const VIEW_HEIGHT = 264
const NATIVE_VIEW: RobotView = "plan"

/** The turnout in world units: x starboard, y up from the sleepers, z aft. */
const HALF_GAUGE = 9
const RAIL_HALF_WIDTH = 1.6
const RAIL_HEIGHT = 2.6
/** The switch, as a share of the lead: a real one is about a quarter of it. */
const HEEL_SHARE = 0.3
const APPROACH = 26
const RUN_ON = 46
/** How far the blade at the toe moves between the two routes. */
const THROW = 7
const DETECTION = 1.4
const MACHINE_OFFSET = HALF_GAUGE + 20

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export type RailTurnoutBehavior = "route" | "creep" | "static"

export interface RailTurnoutProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Blade position, 0 normal to 1 reverse. Supplying it stops the loop. */
  throwPosition?: number
  onThrowChange?: (position: number) => void
  /** Fires when detection makes or breaks, which is when the route really changes. */
  onRouteChange?: (route: "normal" | "reverse" | "unset") => void
  /** What the point machine does when `throwPosition` is not supplied. */
  behavior?: RailTurnoutBehavior
  /** Turnout number: one across for N along. Bigger is shallower and faster. */
  number?: number
  /** Which way the diverging route goes. */
  hand?: "left" | "right"
  view?: RobotView
  /** The sleepers under it, long through the switch. */
  showSleepers?: boolean
  /** Light the route that is set, and the detection lamp on the machine. */
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

function RailTurnout({
  throwPosition,
  onThrowChange,
  onRouteChange,
  behavior = "route",
  number: turnoutNumber = 5,
  hand = "right",
  view = NATIVE_VIEW,
  showSleepers = true,
  active,
  interactive = false,
  speed = 0.28,
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
}: RailTurnoutProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = throwPosition !== undefined

  const hold = controlled
    ? Number.isFinite(throwPosition) ? clamp(throwPosition as number, 0, 1) : 0
    : held
  const goal = React.useCallback(
    (clock: number) => turnoutThrow(behavior, clock),
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: 1.1,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const position = clamp(motion.value, 0, 1)
  const blades = bladePose(position, THROW, DETECTION)

  // The route is what detection says, so it is reported when detection makes
  // or breaks rather than on every frame the blades move.
  const lastRoute = React.useRef(blades.route)
  React.useEffect(() => {
    if (lastRoute.current === blades.route) return
    lastRoute.current = blades.route
    onRouteChange?.(blades.route)
  }, [blades.route, onRouteChange])

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 1000) / 1000
      setHeld(bounded)
      onThrowChange?.(bounded)
    },
    [onThrowChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  /* ---- the geometry the turnout number buys ---- */

  const spec = clamp(Number.isFinite(turnoutNumber) ? turnoutNumber : 5, 3, 12)
  // Gauge is the invariant, not the lead: the number then fixes the radius,
  // and the lead — which is why a bigger number draws as a longer machine.
  const geometry = turnoutGeometry(spec, HALF_GAUGE * 2)
  const lead = geometry.lead
  const heel = lead * HEEL_SHARE
  const end = lead + RUN_ON
  const side = hand === "left" ? -1 : 1
  const crossingRadians = toRadians(geometry.crossingAngle)

  /** The diverging route's centreline, `s` past the toe, in world units. */
  const diverging = (s: number): Vec3 => {
    const point = turnoutPoint(s, geometry)
    return { x: side * point.y, y: 0, z: -point.x }
  }
  /** Its heading at `s`: the arc's tangent until the crossing, then constant. */
  const divergingHeading = (s: number) =>
    s >= geometry.lead ? crossingRadians : Math.asin(clamp(s / geometry.radius, -1, 1))

  const camera = robotCamera(view)
  const endOffset = turnoutPoint(end, geometry).y + HALF_GAUGE + 6
  const fit = fitTransform(
    boxCorners(
      {
        x: side > 0 ? -(MACHINE_OFFSET + 11) : -endOffset,
        y: -3,
        z: -end,
      },
      {
        x: side > 0 ? endOffset : MACHINE_OFFSET + 11,
        y: 12,
        z: APPROACH,
      },
    ),
    camera,
    VIEW_WIDTH,
    VIEW_HEIGHT,
  )

  const project = (point: Vec3) => camera.project(point.x, point.y, point.z)
  /** A rail: the ribbon its head makes, drawn where the head actually is. */
  const rail = (centre: Vec3[], halfWidth: number | ((t: number) => number) = RAIL_HALF_WIDTH) => {
    if (centre.length < 2) return ""
    const left: Vec2[] = []
    const right: Vec2[] = []
    for (let index = 0; index < centre.length; index += 1) {
      const before = centre[Math.max(0, index - 1)]
      const after = centre[Math.min(centre.length - 1, index + 1)]
      const dx = after.x - before.x
      const dz = after.z - before.z
      const length = Math.hypot(dx, dz) || 1
      // Normal in the horizontal plane, so the ribbon keeps its width through
      // the curve rather than pinching on the inside of it.
      const wide =
        typeof halfWidth === "function"
          ? halfWidth(index / (centre.length - 1))
          : halfWidth
      const nx = (-dz / length) * wide
      const nz = (dx / length) * wide
      const point = centre[index]
      left.push(project({ x: point.x + nx, y: RAIL_HEIGHT, z: point.z + nz }))
      right.push(project({ x: point.x - nx, y: RAIL_HEIGHT, z: point.z - nz }))
    }
    return `${[...left, ...right.reverse()]
      .map((point, index) => `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`)
      .join(" ")} Z`
  }
  const polyline = (points: Vec3[]) =>
    points
      .map((point, index) => {
        const at = project(point)
        return `${index ? "L" : "M"} ${px(at.x)} ${px(at.y)}`
      })
      .join(" ")
  const box = (x0: number, z0: number, x1: number, z1: number, bottom: number, top: number) =>
    slabPath(
      [
        { x: x0, z: z0 },
        { x: x1, z: z0 },
        { x: x1, z: z1 },
        { x: x0, z: z1 },
      ].flatMap((corner) => [
        { x: corner.x, y: bottom, z: corner.z },
        { x: corner.x, y: top, z: corner.z },
      ]),
      camera,
    )

  /** A switch blade is full section at the heel and a point at the toe. */
  const taper = (t: number) => RAIL_HALF_WIDTH * (1 - t * 0.86)

  const SLEEPERS = Math.round((APPROACH + end) / 13) + 1
  const SAMPLES = 26
  /** The diverging route, sampled from the toe to the end of the run-on. */
  const divergingCentre = Array.from({ length: SAMPLES }, (_, index) =>
    diverging((end * index) / (SAMPLES - 1)),
  )
  /** One of its rails: offset along the normal to its own heading. */
  const divergingRail = (offset: number) =>
    Array.from({ length: SAMPLES }, (_, index) => {
      const s = (end * index) / (SAMPLES - 1)
      const centre = diverging(s)
      const heading = divergingHeading(s)
      // Normal to the route's own tangent, so the gauge is held through the
      // curve rather than measured square to the straight.
      return {
        x: centre.x + offset * Math.cos(heading),
        y: 0,
        z: centre.z + offset * side * Math.sin(heading),
      }
    })

  const straight = (offset: number): Vec3[] => [
    { x: offset, y: 0, z: APPROACH },
    { x: offset, y: 0, z: -end },
  ]

  /**
   * A switch blade: hinged at the heel, tapering to a point at the toe, and
   * standing off its stock rail by the gap the throw bar has left it.
   */
  const blade = (stock: number, gap: number): Vec3[] =>
    Array.from({ length: 10 }, (_, index) => {
      const t = index / 9
      // t = 0 at the heel, where it is hinged on its stock rail; t = 1 at the
      // toe, which is the end the throw bar actually moves.
      return {
        x: stock - Math.sign(stock || 1) * gap * t,
        y: 0,
        z: -heel + heel * t,
      }
    })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const lit = active ?? blades.detected
  const liveColor = lit ? palette.accent : palette.metal

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        `Rail turnout, one in ${Math.round(spec)}, ${hand} hand, ${
          blades.route === "unset" ? "no route set" : `${blades.route} route set`
        }, ${viewNames[view] ?? viewNames.plan}`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(position) : undefined}
      aria-valuetext={
        interactive
          ? blades.route === "unset"
            ? "blades in mid stroke, no route set"
            : `${blades.route} route set`
          : undefined
      }
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, event.shiftKey ? 0.25 : 0.1, 0.5)
        if (delta !== 0) apply(position + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else if (event.key === "Escape") setHeld(null)
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
      <g
        data-view={view}
        data-throw={px(position)}
        data-route={blades.route}
        data-crossing-angle={px(geometry.crossingAngle)}
        transform={fit || undefined}
      >
        {showSleepers && (
          <g data-sleepers>
            {Array.from({ length: SLEEPERS }, (_, index) => {
              const z = APPROACH - (index * (APPROACH + end)) / (SLEEPERS - 1)
              // Through the switch and the crossing the sleepers have to carry
              // both routes, so they run out under the diverging one.
              const past = Math.max(0, -z)
              const out = past > 0 ? turnoutPoint(past, geometry).y : 0
              const far = side > 0 ? side * out + HALF_GAUGE + 5 : -(HALF_GAUGE + 5)
              const near = side > 0 ? -(HALF_GAUGE + 5) : side * out - HALF_GAUGE - 5
              return (
                <path
                  key={index}
                  data-sleeper={index}
                  d={box(near, z - 2.4, far, z + 2.4, 0, 1.4)}
                  fill={palette.dark}
                  fillOpacity={variant === "solid" ? 0.24 : 0.1}
                  stroke="none"
                />
              )
            })}
          </g>
        )}

        {/* The route that is set, drawn through the switch as the path a train
            would actually take. Nothing is lit while the blades are in mid
            stroke, because then nothing is set. */}
        <path
          data-route-path={blades.route}
          d={polyline(
            blades.route === "reverse"
              ? [{ x: 0, y: 0, z: APPROACH }, ...divergingCentre]
              : blades.route === "normal"
                ? straight(0)
                : [],
          )}
          fill="none"
          stroke={lit ? palette.glow : "none"}
          strokeWidth={2 * HALF_GAUGE}
          strokeOpacity={0.16}
          strokeLinecap="butt"
        />

        <g data-rails>
          {[-1, 1].map((rank) => (
            <path
              key={rank}
              data-stock={rank < 0 ? "left" : "right"}
              d={rail(straight(rank * HALF_GAUGE))}
              {...machined}
            />
          ))}
          {[-1, 1].map((rank) => (
            <path
              key={rank}
              data-diverging={rank < 0 ? "left" : "right"}
              d={rail(divergingRail(rank * HALF_GAUGE))}
              {...machined}
            />
          ))}
        </g>

        <g data-switch>
          {/* Two blades on one bar: the gaps sum to the throw, always. */}
          {/* The blade against the stock rail on the diverging side is the one
              that has to be home for the *straight* route: closed, it holds the
              wheel on the stock rail; open, the wheel drops into the curve. */}
          <path
            data-blade="normal"
            data-gap={px(blades.normalGap)}
            d={rail(blade(side * HALF_GAUGE, blades.normalGap), taper)}
            fill={blades.normalGap <= DETECTION ? liveColor : palette.metal}
            fillOpacity={variant === "solid" ? 1 : 0.35}
            stroke={palette.dark}
            strokeWidth={0.5}
          />
          <path
            data-blade="reverse"
            data-gap={px(blades.reverseGap)}
            d={rail(blade(-side * HALF_GAUGE, blades.reverseGap), taper)}
            fill={blades.reverseGap <= DETECTION ? liveColor : palette.metal}
            fillOpacity={variant === "solid" ? 1 : 0.35}
            stroke={palette.dark}
            strokeWidth={0.5}
          />
          {/* The throw bar: what makes the two gaps one number. */}
          <path
            data-throw-bar
            data-travel={px(blades.travel)}
            d={box(-MACHINE_OFFSET + 6, -3.4, HALF_GAUGE + 3, 0.6, 1.4, 3.6)}
            {...cast}
          />
          <path
            data-detection-rod
            d={box(-MACHINE_OFFSET + 6, 7, HALF_GAUGE + 3, 9.6, 1.4, 3)}
            fill={palette.metal}
            fillOpacity={variant === "solid" ? 0.85 : 0.3}
            stroke={palette.dark}
            strokeWidth={0.4}
          />
        </g>

        <g data-machine>
          <path
            d={box(-MACHINE_OFFSET - 10, -12, -MACHINE_OFFSET + 8, 16, 0, 9)}
            {...shell}
          />
          <path
            data-detection
            d={box(-MACHINE_OFFSET - 5, -6, -MACHINE_OFFSET + 3, 2, 9, 11)}
            fill={liveColor}
            fillOpacity={variant === "solid" ? 1 : 0.35}
            stroke={palette.dark}
            strokeWidth={0.4}
          />
        </g>

        <g data-crossing-work>
          {/* The crossing: where the diverging route's near rail cuts the
              straight route's, at exactly the angle the number gives. */}
          <path
            data-crossing
            d={box(
              side * HALF_GAUGE - 7,
              -lead - 15,
              side * HALF_GAUGE + 7,
              -lead + 15,
              0,
              RAIL_HEIGHT + 0.6,
            )}
            {...cast}
          />
          {/* Check rails, which hold the far wheel while the near one crosses. */}
          <path
            data-check="through"
            d={rail(
              [
                { x: -side * (HALF_GAUGE - 3.4), y: 0, z: -lead + 28 },
                { x: -side * (HALF_GAUGE - 3.4), y: 0, z: -lead - 28 },
              ],
              RAIL_HALF_WIDTH * 0.7,
            )}
            {...machined}
          />
          <path
            data-check="diverging"
            d={rail(
              [-28, 0, 28].map((step) => {
                const at = diverging(lead + step)
                const heading = divergingHeading(lead + step)
                const inboard = -(HALF_GAUGE - 3.4)
                return {
                  x: at.x + inboard * Math.cos(heading),
                  y: 0,
                  z: at.z + inboard * side * Math.sin(heading),
                }
              }),
              RAIL_HALF_WIDTH * 0.7,
            )}
            {...machined}
          />
        </g>

        {variant === "blueprint" && (
          <g data-annotation fill="none" stroke={palette.grid} strokeWidth={0.5} opacity={0.7}>
            {/* The tangent the diverging route leaves on, and the angle it
                arrives at: the two facts the turnout number fixes. */}
            <path d={polyline(straight(0))} strokeDasharray="3 4" />
            <path
              d={polyline([
                diverging(lead),
                {
                  x: side * (geometry.offset + 52 * Math.tan(crossingRadians)),
                  y: 0,
                  z: -lead - 52,
                },
              ])}
              strokeDasharray="2 3"
            />
          </g>
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

/** Where the point machine has the blades at `clock`, 0 normal to 1 reverse. */
export function turnoutThrow(behavior: RailTurnoutBehavior, clock: number): number {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const cycle = ((clock % 1) + 1) % 1
  if (behavior === "creep") {
    // Working the blade around the point of detection, which is where a point
    // machine that cannot quite make its route spends its time.
    return 0.06 + Math.max(0, Math.sin(clock * Math.PI * 2)) * 0.1
  }
  // Set, dwell, throw, dwell: a point machine's whole duty cycle.
  if (cycle < 0.34) return 0
  if (cycle < 0.46) return (cycle - 0.34) / 0.12
  if (cycle < 0.84) return 1
  return 1 - (cycle - 0.84) / 0.16
}

export { RailTurnout }
