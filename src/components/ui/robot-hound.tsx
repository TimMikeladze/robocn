"use client"

/**
 * robot-hound — a boxy companion tracker on a concealed drive.
 *
 * The only animal in the set with no legs: it travels on rollers tucked under
 * a flared skirt, so everything it has to say it says with its head. One
 * number says it — `attention` runs the concertina neck out, lifts the nose,
 * pricks the ear dishes, raises the probe and lights the visor — and the ribs
 * of the collar are laid along the live axis between the deck and the head, so
 * the neck is the readout for how far the head has come out rather than an
 * ornament.
 *
 * Everything is modelled once in world units — x starboard, y up, z toward the
 * tail, nose at −z — and projected. The head is a box that pitches and yaws,
 * so its outline is the hull of its own eight corners; the ear dishes, the eye
 * and the collar ribs are circles sampled in their own planes, which is what
 * makes them ellipses from every other angle.
 *
 * Design note: docs/robot-hound.md.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, convexHull2, lerp, toRadians, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  capsulePath,
  extrudedPath,
  frustumPath,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  roundedFootprint,
  type RobotPaletteProps,
  type RobotSurface,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What it does with no `attention` on it. */
export type RobotHoundBehavior = "seek" | "alert" | "idle" | "static"
/** The pair of sensor pods on the back of the head. */
export type RobotHoundEars = "dish" | "vane" | "none"
/** The boom off the tail end of the chassis. */
export type RobotHoundProbe = "whip" | "mast" | "none"

/** Drawn in side elevation; that is the camera it defaults to. */
const NATIVE_VIEW: RobotView = "profile"

/* The frame. Everything below is world units about the point on the floor
   under the middle of the chassis: x starboard, y up, z toward the tail. */
const CENTRE = 93
const FLOOR = 124
const BOX = { width: 210, height: 150 }

/** The chassis: a frustum off a drive plinth, both centred 2 units aft. */
const DRIVE = 6
const DECK = 44
const HULL_BIAS = 2
const HULL_BOTTOM = { half: 32, length: 40, radius: 8 }
const HULL_TOP = { half: 21, length: 32, radius: 6 }
const PLINTH = { half: 24, length: 34, radius: 6 }
const ROLLER = { radius: 6, track: 24, at: [-18, 22] as const }

/** The neck: a linear extension, leaning forward out of the front of the deck. */
const NECK = { y: 40, z: -30, angle: 20, ribs: 6 }
const NECK_STROKE = { stowed: 3, run: 16 }

/** The head, in its own frame: u forward from the neck joint, v up, w across. */
const HEAD = {
  back: -7,
  nose: 43,
  backTop: 22,
  backBottom: -2,
  noseTop: 12,
  noseBottom: 6,
  backHalf: 14,
  noseHalf: 10,
}
const EAR = { u: 0, v: 20, w: 10, stalk: 10, dish: 8 }
const VISOR = { from: 16, to: 38, half: 7 }
const EYE = { u: 13, v: 12, radius: 5 }
const PROBE = { y: DECK, z: 36, stowed: 30, run: 52, sections: [0.42, 0.33, 0.25] }

/** How far the head turns to the pointer, and how much the probe wags. */
const YAW = 38
const WAG = 14
/** Attention units per second while easing back into the behaviour. */
const ATTENTION_RATE = 1.1
/** Degrees of roller per second of clock. */
const ROLLER_RATE = 260

/**
 * Where the camera stands, and how far it pulls back and recentres so a
 * machine this long still sits in a frame drawn for one view. The native view
 * is untouched.
 */
const frames: Record<RobotView, { x: number; y: number; zoom: number }> = {
  profile: { x: 0, y: 0, zoom: 1 },
  plan: { x: 12, y: -46, zoom: 0.74 },
  front: { x: 12, y: -4, zoom: 1 },
  iso: { x: 6, y: -20, zoom: 0.84 },
}

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

export interface RobotHoundProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  /** Where the camera stands. One hound, four projections. */
  view?: RobotView
  /**
   * How alert it is, 0 stowed to 1 up on the scent. Supplying it stops the
   * loop; the neck, head, ears, probe and visor all ride it either way.
   */
  attention?: number
  /** What it does when `attention` is not supplied. */
  behavior?: RobotHoundBehavior
  /** Cycles per second: one cast of the head, one breath of the idle. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a pair of them breaks step. */
  phase?: number
  /** Drag its head up and down, or work it from the arrow keys. */
  interactive?: boolean
  onAttentionChange?: (attention: number) => void
  /** Controlled head aim in −1..1; overrides pointer tracking. */
  look?: Vec2 | null
  /** The head turns to the page pointer while `look` is null. */
  track?: boolean
  /** The sensor pods on the back of the head. */
  ears?: RobotHoundEars
  /** The boom off the tail: a telescoping whip, a rigid mast, or nothing. */
  probe?: RobotHoundProbe
  /** Keypad columns across the deck, clamped to 3–8. */
  keys?: number
  /** A flared skirt, or straight sides. */
  skirt?: "flared" | "straight"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

function RobotHound({
  size = "md",
  variant = "solid",
  view = NATIVE_VIEW,
  attention,
  behavior = "seek",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  interactive = true,
  onAttentionChange,
  look = null,
  track = true,
  ears = "dish",
  probe = "whip",
  keys = 4,
  skirt = "flared",
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
}: RobotHoundProps) {
  const controlled = attention !== undefined
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const hold = controlled ? finiteClamp(attention, 0, 1, 0.5) : held

  const goal = React.useCallback(
    (clock: number) => robotHoundPose(behavior, clock).attention,
    [behavior],
  )
  const motion = useRobotScalar(goal, {
    rate: ATTENTION_RATE,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const alert = finiteClamp(motion.value, 0, 1, 0.5)
  const scripted = robotHoundPose(behavior, motion.clock)

  const apply = React.useCallback(
    (next: number) => {
      const bounded = round3(clamp(next, 0, 1))
      setHeld(bounded)
      onAttentionChange?.(bounded)
    },
    [onAttentionChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // The top half of the box is the whole range: a gesture worth making.
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
  const aim = look ?? pointer.target

  /* ---------------------------------------------------------------- pose */

  // One number: the neck runs out, the nose comes up, the ears prick, the
  // probe rises and the visor lights.
  const stretch = lerp(NECK_STROKE.stowed, NECK_STROKE.run, alert)
  const earTilt = lerp(55, -20, alert)
  // The dishes toe out as they come up, which is also what stops them being
  // edge-on — a dish whose axis stays in the centre plane is a line in profile.
  const earSplay = lerp(18, 40, alert)
  const probeRise = lerp(16, 46, alert)
  const probeOut = lerp(PROBE.stowed, PROBE.run, alert)
  // Attention is the machine's own posture; the pointer is what it is looking
  // at. They are independent, so it can notice you from a stow.
  const yaw = aim ? clamp(finite(aim.x), -1, 1) * YAW : clamp(scripted.sweep, -1, 1) * YAW
  const pitch = clamp(
    lerp(-28, 2, alert) - (aim ? clamp(finite(aim.y), -1, 1) * 5 : 0),
    -34,
    12,
  )
  const wag = clamp(scripted.wag, -1, 1) * WAG
  const rollerAngle = (((motion.clock * ROLLER_RATE) % 360) + 360) % 360

  const keyColumns = Number.isFinite(keys) ? Math.round(clamp(keys, 3, 8)) : 4

  /* -------------------------------------------------------------- camera */

  const camera = robotCamera(view)
  const fit = frames[view] ?? frames.profile
  /** Screen point of a world point. */
  const at = (p: Vec3) => camera.project(p.x, p.y, p.z)
  const outline = (points: readonly Vec3[]) => hullPath(points.map(at))
  const face = (points: readonly Vec3[]) =>
    points
      .map((p, index) => {
        const s = at(p)
        return `${index ? "L" : "M"} ${px(s.x)} ${px(s.y)}`
      })
      .join(" ") + " Z"

  /* ------------------------------------------------------------- machine */

  const neckBase: Vec3 = { x: 0, y: NECK.y, z: NECK.z }
  const neckAxis: Vec3 = {
    x: 0,
    y: Math.sin(toRadians(NECK.angle)),
    z: -Math.cos(toRadians(NECK.angle)),
  }
  const headRoot = along(neckBase, neckAxis, stretch)

  // The head's own axes, pitched then yawed, so a point in its frame is one
  // sum away from the world.
  const cy = Math.cos(toRadians(yaw))
  const sy = Math.sin(toRadians(yaw))
  const cp = Math.cos(toRadians(pitch))
  const sp = Math.sin(toRadians(pitch))
  const forward: Vec3 = { x: sy * cp, y: sp, z: -cy * cp }
  const above: Vec3 = { x: -sy * sp, y: cp, z: cy * sp }
  const across: Vec3 = { x: cy, y: 0, z: sy }
  const headPoint = (u: number, v: number, w = 0): Vec3 => ({
    x: headRoot.x + forward.x * u + above.x * v + across.x * w,
    y: headRoot.y + forward.y * u + above.y * v + across.y * w,
    z: headRoot.z + forward.z * u + above.z * v + across.z * w,
  })
  /** The sloping top of the head, which the visor sits on. */
  const crown = (u: number) =>
    lerp(HEAD.backTop, HEAD.noseTop, (u - HEAD.back) / (HEAD.nose - HEAD.back))
  const halfAt = (u: number) =>
    lerp(HEAD.backHalf, HEAD.noseHalf, (u - HEAD.back) / (HEAD.nose - HEAD.back))

  const headCorners: Vec3[] = [HEAD.back, HEAD.nose].flatMap((u) => {
    const top = u === HEAD.back ? HEAD.backTop : HEAD.noseTop
    const bottom = u === HEAD.back ? HEAD.backBottom : HEAD.noseBottom
    const half = halfAt(u)
    return [
      headPoint(u, top, half),
      headPoint(u, top, -half),
      headPoint(u, bottom, half),
      headPoint(u, bottom, -half),
    ]
  })
  const headMiddle = headPoint((HEAD.back + HEAD.nose) / 2, 11)

  const earPods = ([-1, 1] as const).map((side) => {
    // The stalk lays back when it is stowed and stands up on the scent.
    const tilt = toRadians(earTilt)
    const direction = unit3({
      x: forward.x * -Math.sin(tilt) + above.x * Math.cos(tilt),
      y: forward.y * -Math.sin(tilt) + above.y * Math.cos(tilt),
      z: forward.z * -Math.sin(tilt) + above.z * Math.cos(tilt),
    })
    const root = headPoint(EAR.u, EAR.v, side * EAR.w)
    const centre = along(root, direction, EAR.stalk)
    const facing = unit3(along(direction, across, side * Math.tan(toRadians(earSplay))))
    return {
      name: side === -1 ? "left" : "right",
      side,
      root,
      centre,
      direction,
      facing,
      depth: camera.depth(centre.x, centre.y, centre.z),
    }
  })

  const probeAxis: Vec3 = {
    x: Math.sin(toRadians(wag)) * Math.cos(toRadians(probeRise)),
    y: Math.sin(toRadians(probeRise)),
    z: Math.cos(toRadians(wag)) * Math.cos(toRadians(probeRise)),
  }
  const probeRoot: Vec3 = { x: 0, y: PROBE.y, z: PROBE.z }
  const probeSections = PROBE.sections.map((share, index) => {
    const before = PROBE.sections.slice(0, index).reduce((sum, part) => sum + part, 0)
    return {
      index,
      a: along(probeRoot, probeAxis, probeOut * before),
      b: along(probeRoot, probeAxis, probeOut * (before + share)),
      radius: probe === "mast" ? 2 : 2.4 - index * 0.6,
    }
  })
  const probeTip = probeSections[probeSections.length - 1].b

  const rollers = ([-1, 1] as const).flatMap((side) =>
    ROLLER.at.map((z, index) => {
      const centre: Vec3 = { x: side * ROLLER.track, y: ROLLER.radius, z }
      return {
        id: `${side === -1 ? "left" : "right"}-${index}`,
        centre,
        depth: camera.depth(centre.x, centre.y, centre.z),
      }
    }),
  )
  const bodyDepth = camera.depth(0, DECK / 2, HULL_BIAS)

  const bottom = shiftFootprint(
    roundedFootprint(HULL_BOTTOM.half, HULL_BOTTOM.length, HULL_BOTTOM.radius),
    HULL_BIAS,
  )
  const top = shiftFootprint(
    skirt === "straight"
      ? roundedFootprint(HULL_BOTTOM.half, HULL_BOTTOM.length, HULL_BOTTOM.radius)
      : roundedFootprint(HULL_TOP.half, HULL_TOP.length, HULL_TOP.radius),
    HULL_BIAS,
  )
  const plinth = shiftFootprint(
    roundedFootprint(PLINTH.half, PLINTH.length, PLINTH.radius),
    HULL_BIAS,
  )

  /* ---------------------------------------------------------------- paint */

  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)
  const fine = robotSurface("metal", variant, palette, 0.7)
  const live = robotSurface("accent", variant, palette, 0.7)
  const signalColor =
    signal === "warning" ? palette.shell : signal === "ready" ? palette.accent : palette.metal

  const state = dragging
    ? "led by hand"
    : behavior === "static"
      ? "parked"
      : behavior === "alert"
        ? "alert"
        : behavior === "idle"
          ? "settled"
          : "casting"
  const readout = Math.round(alert * 100)

  const ring = (centre: Vec3, axis: Vec3, radius: number, steps = 14) =>
    face(ringPoints(centre, axis, radius, steps))
  const rod = (a: Vec3, b: Vec3, radius: number) => capsulePath(at(a), at(b), radius)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={`Robot hound, ${state}, attention ${readout} percent, ${viewNames[view] ?? viewNames.profile}`}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? readout : undefined}
      aria-valuetext={interactive ? `${readout} percent attention` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      viewBox={`0 0 ${BOX.width} ${BOX.height}`}
      width={width}
      height={px((width * BOX.height) / BOX.width)}
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
        if (delta !== 0) apply(alert + delta)
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
          <path d={`M 10 ${FLOOR} H ${BOX.width - 10}`} strokeDasharray="2 3" />
          <path
            d={`M ${px(CENTRE + at(neckBase).x)} ${px(FLOOR + at(neckBase).y)} L ${px(CENTRE + at(headRoot).x)} ${px(FLOOR + at(headRoot).y)}`}
            strokeDasharray="3 2"
          />
        </g>
      )}

      <g
        transform={`translate(${px(CENTRE + fit.x)} ${px(FLOOR + fit.y)})${fit.zoom === 1 ? "" : ` scale(${px(fit.zoom)})`}`}
      >
        {showGround && (
          <g data-contact transform={camera.plane()}>
            <ellipse
              cy={-8}
              rx={px(46 + alert * 4)}
              ry={34}
              fill={palette.dark}
              opacity={0.14}
            />
          </g>
        )}

        {/* The drive: rollers on the far side, then the body over them, then
            the near ones — so the skirt hides all but the tread. */}
        {rollers
          .filter((roller) => roller.depth <= bodyDepth)
          .map((roller) => (
            <Roller key={roller.id} id={roller.id} centre={roller.centre} angle={rollerAngle} ring={ring} rod={rod} cast={cast} fine={fine} />
          ))}

        <g data-chassis>
          <path data-drive d={extrudedPath(plinth, camera, DRIVE, 0)} {...cast} />
          <path d={frustumPath(bottom, top, camera, DRIVE, DECK)} {...shell} />
          {/* Two belt lines round the flank: the panel joins, and the only
              marks on a body this plain. */}
          {[0.34, 0.62].map((t) => {
            const height = lerp(DRIVE, DECK, t)
            const band = lerpFootprint(bottom, top, t)
            return (
              <path
                key={t}
                data-seam={t}
                d={frustumPath(band, band, camera, height, height)}
                fill="none"
                stroke={palette.dark}
                strokeWidth={0.8}
                opacity={0.38}
              />
            )
          })}
        </g>

        {/* Deck furniture is flat artwork in the horizontal plane, so one
            drawing serves every camera. */}
        <g data-keypad transform={camera.plane(DECK)}>
          <rect x={-15} y={2} width={30} height={28} rx={2.5} {...cast} />
          {Array.from({ length: keyColumns * 3 }, (_, index) => {
            const column = index % keyColumns
            const row = Math.floor(index / keyColumns)
            const cell = 26 / keyColumns
            return (
              <rect
                key={index}
                data-key={index}
                x={px(-13 + column * cell + 0.6)}
                y={px(4 + row * 8)}
                width={px(cell - 1.2)}
                height={6}
                rx={1}
                fill={index % 3 === 0 ? signalColor : palette.metal}
                opacity={index % 3 === 0 ? 0.9 : 0.6}
              />
            )
          })}
          <circle
            cx={0}
            cy={-16}
            r={2.2}
            fill={signalColor}
            className={signal === "ready" ? "robocn-pulse" : undefined}
          />
          {/* Louvres over the drive bay. */}
          <g stroke={palette.dark} strokeWidth={0.9} opacity={0.45} strokeLinecap="round">
            <path d="M -12 -26 h 24 M -12 -22 h 24 M -12 -18 h 24" />
          </g>
        </g>

        {rollers
          .filter((roller) => roller.depth > bodyDepth)
          .map((roller) => (
            <Roller key={roller.id} id={roller.id} centre={roller.centre} angle={rollerAngle} ring={ring} rod={rod} cast={cast} fine={fine} />
          ))}

        {probe !== "none" && (
          <g data-probe data-kind={probe}>
            {probeSections.map((section) => (
              <React.Fragment key={section.index}>
                <path d={rod(section.a, section.b, section.radius)} {...machined} />
                {section.index > 0 && (
                  <path d={ring(section.a, probeAxis, section.radius + 1, 10)} {...cast} />
                )}
              </React.Fragment>
            ))}
            {probe === "mast" ? (
              <path
                d={rod(
                  offset3(probeSections[2].a, across, -7),
                  offset3(probeSections[2].a, across, 7),
                  1.4,
                )}
                {...machined}
              />
            ) : (
              <circle cx={px(at(probeTip).x)} cy={px(at(probeTip).y)} r={3} {...machined} />
            )}
          </g>
        )}

        {/* The collar: rings on the live axis between the deck and the head,
            so their spacing is the extension rather than a drawn pleat. */}
        <g data-neck>
          <path d={rod(neckBase, headRoot, 7)} {...cast} />
          {Array.from({ length: NECK.ribs }, (_, index) => {
            const t = (index + 0.5) / NECK.ribs
            return (
              <path
                key={index}
                data-rib={index}
                d={ring(along(neckBase, neckAxis, stretch * t), neckAxis, px(lerp(13.5, 10, t)), 12)}
                {...fine}
              />
            )
          })}
          {/* The tag that hangs under the collar. */}
          <circle
            cx={px(at(offset3(headRoot, { x: 0, y: -1, z: 0 }, 9)).x)}
            cy={px(at(offset3(headRoot, { x: 0, y: -1, z: 0 }, 9)).y)}
            r={2.4}
            {...machined}
          />
        </g>

        {earPods
          .filter((pod) => ears !== "none" && pod.depth <= camera.depth(headMiddle.x, headMiddle.y, headMiddle.z))
          .map((pod) => (
            <Ear key={pod.name} pod={pod} kind={ears} ring={ring} rod={rod} face={face} machined={machined} fine={fine} cast={cast} />
          ))}

        <g data-hound data-view={view}>
          <g data-head>
            <path d={outline(headCorners)} {...shell} />
            {/* The visor well over the snout, and the bar that lights in it. */}
            <g data-visor>
              <path
                d={face([
                  headPoint(VISOR.from, crown(VISOR.from) + 0.3, -VISOR.half),
                  headPoint(VISOR.to, crown(VISOR.to) + 0.3, -VISOR.half),
                  headPoint(VISOR.to, crown(VISOR.to) + 0.3, VISOR.half),
                  headPoint(VISOR.from, crown(VISOR.from) + 0.3, VISOR.half),
                ])}
                {...cast}
              />
              {[0.2, 0.4, 0.6, 0.8].map((t) => {
                const u = lerp(VISOR.from + 1, VISOR.to - 1, t)
                return (
                  <path
                    key={t}
                    d={face([
                      headPoint(u - 0.5, crown(u) + 0.5, -VISOR.half + 1.6),
                      headPoint(u + 0.5, crown(u) + 0.5, -VISOR.half + 1.6),
                      headPoint(u + 0.5, crown(u) + 0.5, VISOR.half - 1.6),
                      headPoint(u - 0.5, crown(u) + 0.5, VISOR.half - 1.6),
                    ])}
                    fill={palette.metal}
                    opacity={0.45}
                  />
                )
              })}
              {alert > 0.02 && (
                <path
                  data-lit
                  d={face(litBar(alert).map(([u, w]) => headPoint(u, crown(u) + 0.7, w)))}
                  {...live}
                />
              )}
            </g>
            {/* The nose plate, its recess, and the lamp set into it. */}
            <path
              d={face([
                headPoint(HEAD.nose + 0.4, HEAD.noseBottom + 1, -8.5),
                headPoint(HEAD.nose + 0.4, HEAD.noseTop - 1, -8.5),
                headPoint(HEAD.nose + 0.4, HEAD.noseTop - 1, 8.5),
                headPoint(HEAD.nose + 0.4, HEAD.noseBottom + 1, 8.5),
              ])}
              {...machined}
            />
            <path
              d={ring(headPoint(HEAD.nose + 0.8, (HEAD.noseTop + HEAD.noseBottom) / 2), forward, 4, 12)}
              {...cast}
            />
            <path
              d={ring(headPoint(HEAD.nose + 1.1, (HEAD.noseTop + HEAD.noseBottom) / 2), forward, 2.4, 12)}
              fill={signalColor}
              opacity={0.9}
            />
            {/* The eye, on whichever cheek is toward the camera. */}
            <g data-eye>
              {(() => {
                const side =
                  camera.depth(across.x, 0, across.z) >= 0 ? halfAt(EYE.u) + 0.4 : -halfAt(EYE.u) - 0.4
                const centre = headPoint(EYE.u, EYE.v, side)
                return (
                  <>
                    <path d={ring(centre, across, EYE.radius)} {...machined} />
                    <path d={ring(offset3(centre, across, Math.sign(side) * 0.3), across, EYE.radius - 1.5)} fill={palette.dark} opacity={0.9} />
                    <path d={ring(offset3(centre, across, Math.sign(side) * 0.6), across, EYE.radius - 3)} fill={palette.glow} />
                  </>
                )
              })()}
            </g>
          </g>
        </g>

        {earPods
          .filter((pod) => ears !== "none" && pod.depth > camera.depth(headMiddle.x, headMiddle.y, headMiddle.z))
          .map((pod) => (
            <Ear key={pod.name} pod={pod} kind={ears} ring={ring} rod={rod} face={face} machined={machined} fine={fine} cast={cast} />
          ))}
      </g>

      {label && (
        <text
          x={BOX.width / 2}
          y={BOX.height - 5}
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

/* ------------------------------------------------------------------ parts */

/** A drive roller: a disc in a vertical plane, so it is a line in plan view. */
function Roller({
  id,
  centre,
  angle,
  ring,
  rod,
  cast,
  fine,
}: {
  id: string
  centre: Vec3
  angle: number
  ring: (centre: Vec3, axis: Vec3, radius: number, steps?: number) => string
  rod: (a: Vec3, b: Vec3, radius: number) => string
  cast: RobotSurface
  fine: RobotSurface
}) {
  const axis: Vec3 = { x: 1, y: 0, z: 0 }
  return (
    <g data-roller={id}>
      <path d={ring(centre, axis, ROLLER.radius)} {...cast} />
      {[0, 90].map((step) => {
        const a = toRadians(angle + step)
        const spoke: Vec3 = {
          x: 0,
          y: Math.cos(a) * (ROLLER.radius - 1.4),
          z: Math.sin(a) * (ROLLER.radius - 1.4),
        }
        return (
          <path
            key={step}
            d={rod(
              { x: centre.x, y: centre.y - spoke.y, z: centre.z - spoke.z },
              { x: centre.x, y: centre.y + spoke.y, z: centre.z + spoke.z },
              0.7,
            )}
            {...fine}
          />
        )
      })}
      <path d={ring(centre, axis, 1.8, 10)} {...fine} />
    </g>
  )
}

/** A sensor pod: a stalk, and a dish or a vane on the end of it. */
function Ear({
  pod,
  kind,
  ring,
  rod,
  face,
  machined,
  fine,
  cast,
}: {
  pod: { name: string; root: Vec3; centre: Vec3; direction: Vec3; facing: Vec3 }
  kind: RobotHoundEars
  ring: (centre: Vec3, axis: Vec3, radius: number, steps?: number) => string
  rod: (a: Vec3, b: Vec3, radius: number) => string
  face: (points: readonly Vec3[]) => string
  machined: RobotSurface
  fine: RobotSurface
  cast: RobotSurface
}) {
  return (
    <g data-ear={pod.name}>
      <path d={rod(pod.root, pod.centre, 1.6)} {...machined} />
      {kind === "dish" ? (
        <>
          <path d={ring(pod.centre, pod.facing, EAR.dish)} {...machined} />
          <path d={ring(pod.centre, pod.facing, EAR.dish - 2.6)} {...cast} />
          <path d={rod(pod.centre, along(pod.centre, pod.facing, 4.5), 0.9)} {...fine} />
        </>
      ) : (
        <path
          d={face([
            offset3(offset3(pod.centre, pod.facing, -1.4), pod.direction, -7),
            offset3(offset3(pod.centre, pod.facing, -1.4), pod.direction, 7),
            offset3(offset3(pod.centre, pod.facing, 1.4), pod.direction, 7),
            offset3(offset3(pod.centre, pod.facing, 1.4), pod.direction, -7),
          ])}
          {...machined}
        />
      )}
    </g>
  )
}

/* ------------------------------------------------------------------ maths */

const finite = (value: number) => (Number.isFinite(value) ? value : 0)
const finiteClamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback
const round3 = (value: number) => Math.round(value * 1000) / 1000

const along = (from: Vec3, axis: Vec3, distance: number): Vec3 => ({
  x: from.x + axis.x * distance,
  y: from.y + axis.y * distance,
  z: from.z + axis.z * distance,
})
const offset3 = along

const unit3 = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length > 1e-6 ? { x: v.x / length, y: v.y / length, z: v.z / length } : { x: 0, y: 1, z: 0 }
}

const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

/**
 * A circle in the plane through `centre` normal to `axis`. Sampling it in its
 * own plane and projecting the samples is what makes a dish an ellipse from
 * every other angle instead of a circle drawn on the screen.
 */
function ringPoints(centre: Vec3, axis: Vec3, radius: number, steps = 14): Vec3[] {
  const n = unit3(axis)
  const seed = Math.abs(n.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const e1 = unit3(cross3(seed, n))
  const e2 = cross3(n, e1)
  const r = Number.isFinite(radius) ? Math.abs(radius) : 1
  return Array.from({ length: Math.max(3, Math.round(steps)) }, (_, index) => {
    const angle = (index / Math.max(3, Math.round(steps))) * Math.PI * 2
    const cos = Math.cos(angle) * r
    const sin = Math.sin(angle) * r
    return {
      x: centre.x + e1.x * cos + e2.x * sin,
      y: centre.y + e1.y * cos + e2.y * sin,
      z: centre.z + e1.z * cos + e2.z * sin,
    }
  })
}

/** The outline round a set of projected points: any solid, from any angle. */
function hullPath(points: readonly Vec2[]): string {
  const hull = convexHull2(points)
  if (hull.length < 3) return ""
  return `${hull.map((p, i) => `${i ? "L" : "M"} ${px(p.x)} ${px(p.y)}`).join(" ")} Z`
}

/** Footprints are plan-view: x starboard, y toward the tail. */
const shiftFootprint = (footprint: readonly Vec2[], dz: number): Vec2[] =>
  footprint.map((point) => ({ x: point.x, y: point.y + dz }))
/** The footprint part-way up a frustum: what a belt line round it traces. */
const lerpFootprint = (a: readonly Vec2[], b: readonly Vec2[], t: number): Vec2[] =>
  a.map((point, index) => ({
    x: lerp(point.x, (b[index] ?? point).x, t),
    y: lerp(point.y, (b[index] ?? point).y, t),
  }))

/** The lit part of the visor bar, as (u, w) corners of one quad. */
const litBar = (fraction: number): [number, number][] => {
  const end = VISOR.from + 1 + (VISOR.to - VISOR.from - 2) * clamp(fraction, 0, 1)
  const half = VISOR.half - 2
  return [
    [VISOR.from + 1, -half],
    [end, -half],
    [end, half],
    [VISOR.from + 1, half],
  ]
}

/**
 * What it does with no attention on it. `attention` is the posture the loop
 * eases toward, `sweep` the head's own cast when nothing is tracking it, and
 * `wag` the lateral swing of the probe. All illustrative: nothing here is a
 * drive model, and the hound detects nothing.
 */
export function robotHoundPose(behavior: RobotHoundBehavior, clock: number) {
  const time = Number.isFinite(clock) ? clock : 0
  switch (behavior) {
    // Found something: head up, holding it, with the tremor of a machine
    // working hard to keep still.
    case "alert":
      return {
        attention: 0.88 + 0.04 * Math.sin(time * Math.PI * 4),
        sweep: 0.06 * Math.sin(time * Math.PI * 5),
        wag: 0.3 * Math.sin(time * Math.PI * 6),
      }
    // Settled on its skirt, ticking over.
    case "idle":
      return {
        attention: 0.12 + 0.07 * Math.sin(time * Math.PI * 2),
        sweep: 0.2 * Math.sin(time * Math.PI * 0.5),
        wag: 0.12 * Math.sin(time * Math.PI * 1.1),
      }
    case "static":
      return { attention: 0.5, sweep: 0, wag: 0 }
    // Quartering: the head casts the full width of the ground ahead of it
    // while the posture rises and falls on the scent.
    default:
      return {
        attention: 0.5 + 0.18 * Math.sin(time * Math.PI * 2),
        sweep: Math.sin(time * Math.PI * 1.5),
        wag: 0.5 * Math.sin(time * Math.PI * 3),
      }
  }
}

export { RobotHound }
