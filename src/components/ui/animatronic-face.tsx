"use client"

/**
 * animatronic-face — an expressive humanoid head, driven as servo channels.
 *
 * The set already has a flat mood panel (`robot-face`) and a companion head on
 * a solved platform (`reachy-mini`). This is the third and the expressive one:
 * brows, lids, cheeks, nose, lip corners and jaw are each a servo, and an
 * expression is a blend of their targets rather than a swap of artwork. Nothing
 * below branches on an expression name — the drawing reads channels.
 *
 * The head is one geometry. The skull is an ellipsoid whose silhouette projects
 * to an exact ellipse; every feature is a curve drawn in the face's own chart
 * and pushed onto that surface, so the brow wraps the temple and the far eye
 * turns away on its own. Four cameras, no per-angle artwork.
 *
 * Design note: `docs/animatronic-face.md`.
 */

import * as React from "react"

import { usePointerTarget } from "@/hooks/use-pointer-target"
import { useRobotClock } from "@/hooks/use-robot-motion"
import { clamp, type Vec2, type Vec3 } from "@/lib/robocn/kinematics"
import {
  blendFace,
  defaultHeadGeometry,
  ellipsoidOutline,
  faceShape,
  onFace,
  restPose,
  rotateHead,
  solveFace,
  type FaceChannels,
  type FaceExpression,
  type FaceSide,
  type HeadGeometry,
  type HeadPose,
} from "@/lib/robocn/face"
import {
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

const NATIVE_VIEW: RobotView = "front"

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/** Where the face sits on the skull, in the chart the artwork is drawn in. */
const EYE_X = 13
const EYE_Y = 12
/** The eyeball, not a socket: the recessed band around it is the socket. */
const EYE_R = 7
const BROW_Y = 27
const MOUTH_Y = -24
/** The jaw hinges on a real axis through the ear servos. */
const HINGE: Vec3 = { x: 0, y: 4, z: 18 }
const JAW_SWING = 15

export type AnimatronicBehavior = "idle" | "converse" | "listen" | "emote" | "static"

export interface AnimatronicFaceProps
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Which expression the rig drives toward. Omit and the behaviour picks. */
  expression?: FaceExpression
  /** How far it drives there, 0..1. */
  intensity?: number
  /** What the head does with anything you have not supplied. */
  behavior?: AnimatronicBehavior
  /** Cycles per second. */
  speed?: number
  animate?: boolean
  paused?: boolean
  /** Seconds of offset, so a row of heads breaks step. */
  phase?: number
  /** Lid closure on top of the expression, 0..1. Omit and it blinks on its own. */
  blink?: number
  /** Speech level, 0..1: opens the jaw and works the lips. */
  speech?: number
  /** Neck angles in degrees. Omit and the head turns toward the pointer. */
  yaw?: number
  pitch?: number
  roll?: number
  /** Pupil aim in −1..1 on both axes. Set it to drive the gaze yourself. */
  look?: Vec2 | null
  /** Follow the pointer anywhere on the page while `look` is null. */
  track?: boolean
  /** Turn the head toward the pointer, and react when clicked. */
  interactive?: boolean
  onReact?: () => void
  /** Drive individual servos. These win over the expression. */
  channels?: Partial<FaceChannels> & { left?: Partial<FaceSide>; right?: Partial<FaceSide> }
  /** Draw the push-rods behind the face. */
  showActuators?: boolean
  showNeck?: boolean
  showGround?: boolean
  /** Where the camera stands. One head, four projections. */
  view?: RobotView
  size?: RobotSize | number
  variant?: RobotVariant
  label?: string
  geometry?: Partial<HeadGeometry>
}

function AnimatronicFace({
  expression,
  intensity,
  behavior = "idle",
  speed = 0.3,
  animate = true,
  paused = false,
  phase = 0,
  blink,
  speech,
  yaw,
  pitch,
  roll,
  look = null,
  track = true,
  interactive = true,
  onReact,
  channels,
  showActuators = false,
  showNeck = true,
  showGround = true,
  view = NATIVE_VIEW,
  size = "md",
  variant = "solid",
  label,
  geometry,
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  onPointerDown,
  ...props
}: AnimatronicFaceProps) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const shell = robotSurface("shell", variant, palette, 1.4)
  const plate = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  const rig: HeadGeometry = { ...defaultHeadGeometry, ...geometry, radii: { ...defaultHeadGeometry.radii, ...geometry?.radii } }
  const radii = rig.radii

  const svgRef = React.useRef<SVGSVGElement>(null)
  const clock = useRobotClock({
    speed,
    animate: animate && behavior !== "static",
    paused,
    phase,
  })

  const pointer = usePointerTarget(svgRef, {
    enabled: (track || interactive) && !look,
    within: "window",
    persist: true,
    toWorld: React.useCallback((point: Vec2) => {
      const x = (point.x - 0.5) * 2
      const y = (point.y - 0.5) * 2
      const distance = Math.hypot(x, y) || 1
      const limit = Math.min(1, distance) / distance
      return { x: x * limit, y: y * limit }
    }, []),
  })

  // A poke is one damped swing: the head starts, blinks, and warms up. It rides
  // the same decaying ring the rest of the set uses.
  const [poked, setPoked] = React.useState<number | null>(null)
  const since = poked === null ? Infinity : (clock - poked) / Math.max(speed, 0.01)
  const react = since >= 0 && since < 1.4 ? Math.exp(-since * 2.6) : 0
  const startle = react * Math.cos(since * 9)

  const drive = faceBehaviorDrive(behavior, clock)
  const watching = (track || interactive) && !look ? pointer.target : null
  const gaze = look ?? watching ?? drive.gaze

  // A reaction warms whatever the face is already doing toward joy, rather than
  // replacing it, so a poke mid-sentence still reads as the same head.
  const base: FaceExpression | FaceChannels = expression ?? drive.expression
  const shape: FaceExpression | FaceChannels =
    react > 0.01
      ? blendFace(typeof base === "string" ? faceShape(base) : base, faceShape("joy"), react * 0.7)
      : base

  const solution = solveFace(
    {
      expression: shape,
      intensity: intensity ?? drive.intensity,
      gaze,
      blink: blink ?? Math.max(drive.blink, react > 0.15 && since < 0.35 ? 1 : 0),
      speech: speech ?? drive.speech,
      channels,
    },
    rig,
  )

  const pose: HeadPose = {
    yaw: bound(yaw ?? (watching ? watching.x * 26 : drive.pose.yaw), 34),
    pitch: bound((pitch ?? (watching ? -watching.y * 16 : drive.pose.pitch)) + startle * 5, 28),
    roll: bound((roll ?? drive.pose.roll) + startle * 3, 26),
  }
  const offset: Vec3 = { x: 0, y: drive.pose.heave - react * 2.2, z: 0 }

  const camera = robotCamera(view)
  // The camera is linear, so its coefficients are the direction toward it —
  // which is all the visibility test needs.
  const toCamera = {
    x: camera.depth(1, 0, 0),
    y: camera.depth(0, 1, 0),
    z: camera.depth(0, 0, 1),
  }

  const toScreen = (point: Vec3): Vec2 => {
    const turned = rotateHead(point, pose)
    return camera.project(turned.x + offset.x, turned.y + offset.y, turned.z + offset.z)
  }
  /** Chart coordinates -> a point on the skull -> the screen. */
  const skin = (u: number, v: number, outset = 0) => onFace(u, v, radii, outset)
  const chart = (point: Vec2, outset = 0) => toScreen(skin(point.x, point.y, outset))

  /**
   * The jaw is a hinge: its points swing about the ear axis before anything
   * else touches them. The axis sits behind and above the mouth, so opening
   * carries the whole plate — and the lower lip with it — down and back.
   */
  const swing = -(solution.jaw * JAW_SWING * Math.PI) / 180
  const hinged = (point: Vec3): Vec3 => {
    const y = point.y - HINGE.y
    const z = point.z - HINGE.z
    const c = Math.cos(swing)
    const s = Math.sin(swing)
    return { x: point.x, y: HINGE.y + y * c - z * s, z: HINGE.z + y * s + z * c }
  }
  const jawChart = (point: Vec2, outset = 0) => toScreen(hinged(skin(point.x, point.y, outset)))

  const trace = (points: Vec2[], project: (p: Vec2, outset?: number) => Vec2, outset = 0, close = true) => {
    const path = points
      .map((point, index) => {
        const screen = project(point, outset)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")
    return close ? `${path} Z` : path
  }

  /** The same, for a part that leaves the surface — the nose has volume. */
  const trace3 = (points: Vec3[], close = true) => {
    const path = points
      .map((point, index) => {
        const screen = toScreen(point)
        return `${index ? "L" : "M"} ${px(screen.x)} ${px(screen.y)}`
      })
      .join(" ")
    return close ? `${path} Z` : path
  }

  /**
   * How squarely a patch of the face meets the camera. The ellipsoid's normal
   * against the view direction, so the far eye turns away by itself and the
   * whole face fades out looking straight down at the crown.
   */
  const facing = (u: number, v: number) => {
    const point = skin(u, v)
    const normal = { x: point.x / radii.x ** 2, y: point.y / radii.y ** 2, z: point.z / radii.z ** 2 }
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1
    const turned = rotateHead(
      { x: normal.x / length, y: normal.y / length, z: normal.z / length },
      pose,
    )
    return turned.x * toCamera.x + turned.y * toCamera.y + turned.z * toCamera.z
  }
  const seen = (u: number, v: number) => px(clamp((facing(u, v) - 0.02) * 5, 0, 1))
  /**
   * Centreline parts — nose, mouth, jaw — sit on the median plane, so the
   * normal test is the wrong question for them: seen from the side they are not
   * turned away, they are edge-on, and the projection already collapses them to
   * a line. They fade only once the head has actually turned its back.
   */
  const forward = rotateHead({ x: 0, y: 0, z: -1 }, pose)
  const ahead = forward.x * toCamera.x + forward.y * toCamera.y + forward.z * toCamera.z
  /** The nose has volume, so it survives being seen edge-on. */
  const median = px(clamp((ahead + 0.25) * 3, 0, 1))
  /** The mouth and the jaw are flat on the face, so edge-on they are a trace. */
  const medianFlat = px(clamp(ahead * 2.2 + 0.12, 0, 1))

  const skull = ellipsoidOutline(radii, pose, camera, offset)
  const ring = (cx: number, cy: number, rx: number, ry: number, count = 22, from = 0, sweep = Math.PI * 2) =>
    Array.from({ length: count }, (_, index) => {
      const angle = from + (index / (count - 1 || 1)) * sweep
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }
    })

  /**
   * A rounded panel in the face chart. Corners are real arcs, so the panel
   * wraps the skull instead of creasing when the head turns.
   */
  const panel = (cx: number, cy: number, halfW: number, halfH: number, corner: number, per = 5) => {
    const r = Math.max(0, Math.min(corner, halfW, halfH))
    const centers: [number, number, number][] = [
      [cx + halfW - r, cy + halfH - r, 0],
      [cx - halfW + r, cy + halfH - r, Math.PI / 2],
      [cx - halfW + r, cy - halfH + r, Math.PI],
      [cx + halfW - r, cy - halfH + r, (Math.PI * 3) / 2],
    ]
    return centers.flatMap(([ox, oy, from]) =>
      Array.from({ length: per }, (_, index) => {
        const angle = from + (index / (per - 1)) * (Math.PI / 2)
        return { x: ox + Math.cos(angle) * r, y: oy + Math.sin(angle) * r }
      }),
    )
  }

  /**
   * The eye band: a recess milled across the face. It is what makes the lids
   * work — a lid painted in the band's own colour is invisible while the eye is
   * open and reads as a shutter the moment it starts to close.
   */
  const band = (
    <path data-band opacity={seen(0, EYE_Y)} d={trace(panel(0, EYE_Y, 26, 9.5, 8, 6), chart, 0.25)} {...cast} />
  )

  const eye = (sign: -1 | 1) => {
    const channel = sign < 0 ? solution.left : solution.right
    const cx = sign * EYE_X
    // A lid closes from above the eye to just past its centre; retracted, it
    // sits clear of the ball, which is what widens a surprised eye.
    const lidTop = EYE_Y + EYE_R * 1.05 - channel.lidUpper * (EYE_R * 2.1)
    const lidBottom = EYE_Y - EYE_R * 1.05 + channel.lidLower * (EYE_R * 1.35)
    const pupil = { x: cx + solution.gaze.x * 3.2, y: EYE_Y - solution.gaze.y * 2.8 }
    const lid = (name: string, edge: number, over: boolean) => (
      <g data-lid={name}>
        <path
          d={trace(
            [
              { x: cx - EYE_R * 1.16, y: edge },
              ...ring(cx, EYE_Y, EYE_R * 1.16, EYE_R * 1.3, 12, Math.PI, over ? -Math.PI : Math.PI),
              { x: cx + EYE_R * 1.16, y: edge },
            ],
            chart,
            1.9,
          )}
          fill={variant === "solid" ? palette.dark : "none"}
          stroke={variant === "solid" ? "none" : palette.grid}
          strokeWidth={0.7}
        />
        {/* The lash line: only the closing edge is drawn, and only once the
            lid has actually come over the ball. */}
        <path
          d={trace([{ x: cx - EYE_R * 1.1, y: edge }, { x: cx, y: edge + (over ? -0.9 : 0.9) }, { x: cx + EYE_R * 1.1, y: edge }], chart, 2.1, false)}
          fill="none"
          stroke={palette.metal}
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={px(clamp((over ? channel.lidUpper : channel.lidLower) * 2 - 0.2, 0, 0.7))}
        />
      </g>
    )
    return (
      <g key={sign} data-eye={sign < 0 ? "left" : "right"} opacity={seen(cx, EYE_Y)}>
        <path d={trace(ring(cx, EYE_Y, EYE_R, EYE_R), chart, 0.9)} fill={palette.metal} stroke={palette.dark} strokeWidth={0.7} opacity={variant === "solid" ? 1 : 0.35} />
        <path d={trace(ring(pupil.x, pupil.y, 4.2, 4.2, 18), chart, 1.3)} fill={palette.accent} stroke="none" opacity={0.92} />
        <path d={trace(ring(pupil.x, pupil.y, 2, 2, 14), chart, 1.5)} fill={palette.dark} stroke="none" />
        <path d={trace(ring(pupil.x + 1.5, pupil.y + 1.7, 1, 1, 10), chart, 1.7)} fill={palette.metal} stroke="none" opacity={0.9} />
        {lid(sign < 0 ? "left-upper" : "right-upper", lidTop, true)}
        {lid(sign < 0 ? "left-lower" : "right-lower", lidBottom, false)}
      </g>
    )
  }

  const brow = (sign: -1 | 1) => {
    const channel = sign < 0 ? solution.left : solution.right
    const inner = BROW_Y + channel.browInner * 6
    const outer = BROW_Y + channel.browOuter * 7
    const points = Array.from({ length: 6 }, (_, index) => {
      const t = index / 5
      return {
        x: sign * (5 + t * 20),
        // A brow is an arch, so the middle rides above the chord between the tips.
        y: inner + (outer - inner) * t + Math.sin(t * Math.PI) * 2,
      }
    })
    return (
      <path
        key={sign}
        data-brow={sign < 0 ? "left" : "right"}
        opacity={seen(sign * 15, BROW_Y)}
        d={trace(points, chart, 2.2, false)}
        fill="none"
        stroke={palette.dark}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
    )
  }

  /**
   * The cheek is a crease, not a pad: the fold that deepens beside the nose
   * when the plate under it lifts. A line does what a panel could not — it
   * reads as the face moving rather than as something stuck on it.
   */
  const cheek = (sign: -1 | 1) => {
    const channel = sign < 0 ? solution.left : solution.right
    const lift = channel.cheek
    const points = [
      { x: sign * (6.5 + lift * 0.8), y: -12 + lift * 2 },
      { x: sign * (11 + lift * 2.2), y: -18 + lift * 1.6 },
      { x: sign * (13.5 + lift * 2.6), y: -25 + lift * 1.2 },
    ]
    return (
      <path
        key={sign}
        data-cheek={sign < 0 ? "left" : "right"}
        opacity={px(clamp(seen(sign * 11, -18) * (0.18 + lift * 0.62), 0, 1))}
        d={trace(points, chart, 0.8, false)}
        fill="none"
        stroke={palette.dark}
        strokeWidth={1.5 + lift}
        strokeLinecap="round"
      />
    )
  }

  // The nose is the one feature with volume: a wedge standing off the skull, so
  // it breaks the silhouette in profile instead of being a line that vanishes.
  // Two facets, one lit and one shadowed, from the same three points.
  const noseLift = solution.noseWrinkle * 2.6
  const bridge = skin(0, -1.5 + noseLift, 0.5)
  const tip: Vec3 = { x: 0, y: -10.5 + noseLift, z: -(radii.z * 0.97 + 6) }
  const wing = (sign: -1 | 1): Vec3 => {
    const seat = skin(sign * 4.2, -13.6 + noseLift, 1)
    return { ...seat, z: seat.z - 1.5 }
  }
  const nose = (
    <g data-nose opacity={median}>
      <path d={trace3([bridge, wing(-1), tip])} fill={palette.dark} stroke="none" opacity={variant === "solid" ? 0.35 : 0} />
      <path d={trace3([bridge, tip, wing(1)])} fill={palette.shell} stroke={palette.dark} strokeWidth={0.7} opacity={variant === "solid" ? 1 : 0} />
      <path d={trace3([bridge, wing(-1), tip, wing(1)])} fill="none" stroke={palette.dark} strokeWidth={1.1} opacity={0.75} />
      {[-1, 1].map((nostril) => (
        <path key={nostril} d={trace(ring(nostril * 2.9, -14.6 + noseLift, 1.1, 0.7, 10), chart, 1.6)} fill={palette.dark} stroke="none" opacity={0.85} />
      ))}
      {solution.noseWrinkle > 0.15 &&
        [0, 1].map((line) => (
          <path
            key={line}
            d={trace([{ x: -6.5 - line * 2, y: -4 + line * 3 + noseLift }, { x: -3.2 - line, y: -2 + line * 3 + noseLift }], chart, 1.7, false)}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1}
            opacity={solution.noseWrinkle * 0.8}
          />
        ))}
    </g>
  )

  // The corners are their own servos, so a lopsided mouth costs nothing. The
  // cavity is cut into the skull and the jaw plate covers it, so the mouth
  // opens because the hinge moved the plate off it — not because a second
  // mouth was drawn.
  const halfWidth = 13 - solution.lipPucker * 4
  const cornerLeft = { x: -halfWidth, y: MOUTH_Y + solution.left.lipCorner * 5 }
  const cornerRight = { x: halfWidth, y: MOUTH_Y + solution.right.lipCorner * 5 }
  const upperLip = [
    cornerLeft,
    { x: -halfWidth * 0.45, y: MOUTH_Y + 2.2 - solution.lipPress * 1.3 },
    { x: 0, y: MOUTH_Y + 1 - solution.lipPress * 1.1 },
    { x: halfWidth * 0.45, y: MOUTH_Y + 2.2 - solution.lipPress * 1.3 },
    cornerRight,
  ]
  // Deep enough that the plate is still in front of it at full swing, so the
  // gap that opens is the cavity rather than the back of the head.
  const cavity = [
    ...upperLip,
    { x: halfWidth * 0.92, y: MOUTH_Y - 6 },
    { x: halfWidth * 0.62, y: MOUTH_Y - 12 },
    { x: 0, y: MOUTH_Y - 14 },
    { x: -halfWidth * 0.62, y: MOUTH_Y - 12 },
    { x: -halfWidth * 0.92, y: MOUTH_Y - 6 },
  ]
  const lowerLip = [
    cornerRight,
    { x: halfWidth * 0.45, y: MOUTH_Y - 2.4 + solution.lipPress * 1.5 },
    { x: 0, y: MOUTH_Y - 3.2 + solution.lipPress * 1.7 },
    { x: -halfWidth * 0.45, y: MOUTH_Y - 2.4 + solution.lipPress * 1.5 },
    cornerLeft,
  ]

  /** The jaw plate. Its top edge runs under the upper lip when it is shut. */
  const jawOutline = [
    { x: -26, y: -12 },
    { x: -19, y: -21 },
    { x: -9, y: -25.4 },
    { x: 0, y: -26.6 },
    { x: 9, y: -25.4 },
    { x: 19, y: -21 },
    { x: 26, y: -12 },
    { x: 29.5, y: -17 },
    { x: 27, y: -26 },
    { x: 20.5, y: -31 },
    { x: 12, y: -35.5 },
    { x: 0, y: -37.6 },
    { x: -12, y: -35.5 },
    { x: -20.5, y: -31 },
    { x: -27, y: -26 },
    { x: -29.5, y: -17 },
  ]
  /** The seam the plate parts along — the top edge alone, drawn heavier. */
  const jawSeam = jawOutline.slice(0, 7)

  const mouth = (
    <g data-mouth opacity={medianFlat}>
      <path data-cavity d={trace(cavity, chart, 0.15)} {...cast} />
      <path data-jaw d={trace(jawOutline, jawChart, 0.55)} {...shell} />
      <path d={trace(jawSeam, jawChart, 0.75, false)} fill="none" stroke={palette.dark} strokeWidth={0.9} strokeLinecap="round" opacity={0.22} />
      <path d={trace(upperLip, chart, 1.2, false)} fill="none" stroke={palette.dark} strokeWidth={2.1} strokeLinecap="round" opacity={px(1 - solution.jaw * 0.9)} />
      <path d={trace(upperLip, chart, 1.3, false)} fill="none" stroke={palette.metal} strokeWidth={1.8} strokeLinecap="round" opacity={px(solution.jaw * 0.9)} />
      <path d={trace(lowerLip, jawChart, 1.2, false)} fill="none" stroke={palette.dark} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
    </g>
  )


  /** One push-rod per servo, from the frame ring to the part it drives. */
  const anchors: Record<string, Vec2> = {
    "left.browInner": { x: -6, y: BROW_Y },
    "left.browOuter": { x: -26, y: BROW_Y + 2 },
    "left.lidUpper": { x: -EYE_X, y: EYE_Y + EYE_R },
    "left.lidLower": { x: -EYE_X, y: EYE_Y - EYE_R },
    "left.cheek": { x: -11, y: -18 },
    "left.lipCorner": cornerLeft,
    "right.browInner": { x: 6, y: BROW_Y },
    "right.browOuter": { x: 26, y: BROW_Y + 2 },
    "right.lidUpper": { x: EYE_X, y: EYE_Y + EYE_R },
    "right.lidLower": { x: EYE_X, y: EYE_Y - EYE_R },
    "right.cheek": { x: 11, y: -18 },
    "right.lipCorner": cornerRight,
    noseWrinkle: { x: 0, y: -10 + noseLift },
    lipPress: { x: 0, y: MOUTH_Y + 1 },
    lipPucker: { x: 0, y: MOUTH_Y - 4 },
    jaw: { x: 0, y: -31 },
  }
  const rods = solution.actuators
    .map((actuator) => {
      const anchor = anchors[actuator.id]
      if (!anchor) return null
      const tip = actuator.id === "jaw" ? jawChart(anchor, 0.5) : chart(anchor, 0.5)
      const frame = toScreen(
        rotateHead({ x: anchor.x * 0.72, y: anchor.y * 0.72, z: radii.z * 0.45 }, restPose),
      )
      return { actuator, tip, frame }
    })
    .filter((rod): rod is NonNullable<typeof rod> => rod !== null)

  const housing = (sign: -1 | 1) => {
    const anchor = rotateHead({ x: sign * radii.x * 0.97, y: -2, z: 13 }, pose)
    const center = { x: anchor.x + offset.x, y: anchor.y + offset.y, z: anchor.z + offset.z }
    const shape = ellipsoidOutline({ x: 3.5, y: 8, z: 8 }, pose, camera, center)
    const core = ellipsoidOutline({ x: 3.5, y: 4, z: 4 }, pose, camera, center)
    const depth = camera.depth(anchor.x, anchor.y, anchor.z) - camera.depth(offset.x, offset.y, offset.z)
    const turn = `rotate(${px(shape.angle)} ${px(shape.cx)} ${px(shape.cy)})`
    return (
      <g key={sign} data-servo={sign < 0 ? "left" : "right"} opacity={px(clamp(depth * 0.25 + 0.5, 0.12, 1))}>
        <ellipse cx={px(shape.cx)} cy={px(shape.cy)} rx={px(shape.rx)} ry={px(shape.ry)} transform={turn} {...plate} />
        <ellipse cx={px(core.cx)} cy={px(core.cy)} rx={px(core.rx)} ry={px(core.ry)} transform={turn} fill={palette.dark} stroke="none" opacity={0.55} />
      </g>
    )
  }

  const column = (radiusX: number, radiusY: number, radiusZ: number, y: number) => {
    const shape = ellipsoidOutline({ x: radiusX, y: radiusY, z: radiusZ }, restPose, camera, { x: 0, y, z: 0 })
    return { cx: px(shape.cx), cy: px(shape.cy), rx: px(shape.rx), ry: px(shape.ry), angle: px(shape.angle) }
  }
  const neck = column(15, 13, 14, -48)
  const shoulders = column(36, 10, 24, -64)
  const shadow = column(44, 0.4, 30, -76)

  // A behaviour part-way between two expressions has no name of its own, so the
  // label falls back to what is driving it rather than saying "blend".
  const name: string = expression ?? (typeof drive.expression === "string" ? drive.expression : behavior)

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={`Animatronic face, ${name} at ${Math.round(solution.intensity * 100)} percent, neck yaw ${Math.round(pose.yaw)} degrees, ${viewNames[view] ?? viewNames.front}`}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (!interactive || event.defaultPrevented) return
        setPoked(clock)
        onReact?.()
      }}
      viewBox="0 0 200 200"
      width={width}
      height={width}
      className={cn("max-w-full select-none", interactive && "cursor-pointer", className)}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      <g data-view={view} transform="translate(100 86)">
        {showGround && <ellipse cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry={Math.max(shadow.ry, 2)} fill={palette.dark} opacity={0.14} />}

        {showNeck && (
          <g data-neck>
            <ellipse cx={shoulders.cx} cy={shoulders.cy} rx={shoulders.rx} ry={shoulders.ry} transform={`rotate(${shoulders.angle} ${shoulders.cx} ${shoulders.cy})`} {...cast} />
            <ellipse cx={neck.cx} cy={neck.cy} rx={neck.rx} ry={neck.ry} transform={`rotate(${neck.angle} ${neck.cx} ${neck.cy})`} {...plate} />
          </g>
        )}

        {showActuators &&
          rods.map(({ actuator, tip, frame }) => (
            <g key={actuator.id} data-actuator={actuator.id}>
              <line
                x1={px(frame.x)}
                y1={px(frame.y)}
                x2={px(tip.x)}
                y2={px(tip.y)}
                stroke={actuator.withinLimits ? palette.metal : palette.accent}
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.75}
              />
              <circle cx={px(frame.x)} cy={px(frame.y)} r={1.6} fill={palette.dark} />
            </g>
          ))}

        <g data-head>
          <ellipse
            data-skull
            cx={px(skull.cx)}
            cy={px(skull.cy)}
            rx={px(skull.rx)}
            ry={px(skull.ry)}
            transform={`rotate(${px(skull.angle)} ${px(skull.cx)} ${px(skull.cy)})`}
            {...shell}
          />
          {/* A crown seam: a real meridian over the skull, so it curves with the
              head from every angle rather than outlining the drawing. */}
          <path
            data-seam
            d={Array.from({ length: 18 }, (_, index) => {
              const angle = Math.PI * 0.34 + (index / 17) * Math.PI * 0.62
              const point = toScreen({ x: 0, y: radii.y * Math.sin(angle), z: -radii.z * Math.cos(angle) })
              return `${index ? "L" : "M"} ${px(point.x)} ${px(point.y)}`
            }).join(" ")}
            fill="none"
            stroke={palette.dark}
            strokeWidth={0.9}
            opacity={0.3}
          />
          {/* The two edges that make a profile read as a face: a brow ridge and
              a set chin, both standing off the skull the way the nose does. */}
          <path
            data-ridge
            d={trace3(
              [-1, -0.5, 0, 0.5, 1].map((t) => {
                const seat = skin(t * 26, 21 - Math.abs(t) * 4, 0)
                return { ...seat, z: seat.z - 2.6 * (1 - t * t * 0.7) }
              }),
              false,
            )}
            fill="none"
            stroke={palette.dark}
            strokeWidth={1}
            opacity={0.28}
          />
          {housing(-1)}
          {housing(1)}
          {[-1, 1].map((sign) => cheek(sign as -1 | 1))}
          {band}
          {[-1, 1].map((sign) => eye(sign as -1 | 1))}
          {[-1, 1].map((sign) => brow(sign as -1 | 1))}
          {nose}
          {mouth}
        </g>
      </g>

      {!solution.withinLimits && (
        <circle data-fault cx={186} cy={14} r={4} fill={palette.accent} className="robocn-pulse" />
      )}
      {label && (
        <text x={100} y={194} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={6} fill={palette.foreground}>
          {label}
        </text>
      )}
    </svg>
  )
}

const bound = (value: number, limit: number) =>
  Number.isFinite(value) ? clamp(value, -limit, limit) : 0

export interface FaceDrive {
  expression: FaceExpression | FaceChannels
  intensity: number
  blink: number
  speech: number
  gaze: Vec2
  pose: HeadPose & { heave: number }
}

/** The expressions `emote` walks, in the order it walks them. */
const parade: FaceExpression[] = ["neutral", "joy", "surprise", "doubt", "sorrow", "anger", "disgust", "fear"]

/**
 * An irregular blink. A clean sine blinks like a metronome, which reads as a
 * fault; warping the phase with a slower sine breaks the rhythm for one term.
 */
export function faceBlink(clock: number): number {
  if (!Number.isFinite(clock)) return 0
  const wave = clock * 1.1 + Math.sin(clock * 0.43) * 0.4
  const cycle = wave - Math.floor(wave)
  return cycle < 0.12 ? Math.sin((cycle / 0.12) * Math.PI) : 0
}

/**
 * What the head does on its own: a pure function of the clock, so the tests
 * read the motion instead of faking animation frames.
 *
 * `idle` breathes and glances about. `converse` runs a speech envelope through
 * the jaw and nods on phrase boundaries. `listen` holds the gaze, lifts the
 * brows and tilts. `emote` eases the whole expression set past the camera.
 */
export function faceBehaviorDrive(behavior: AnimatronicBehavior, clock: number): FaceDrive {
  const t = Number.isFinite(clock) ? clock : 0
  const turn = t * Math.PI * 2
  const still: FaceDrive = {
    expression: "neutral",
    intensity: 1,
    blink: 0,
    speech: 0,
    gaze: { x: 0, y: 0 },
    pose: { yaw: 0, pitch: 0, roll: 0, heave: 0 },
  }
  if (behavior === "static") return still

  switch (behavior) {
    case "converse": {
      // Syllables on top of a phrase envelope, so the jaw stops between
      // sentences instead of chattering at one rate.
      const phrase = Math.max(0, Math.sin(turn * 0.37))
      const syllable = Math.abs(Math.sin(turn * 3.1)) * 0.7 + Math.abs(Math.sin(turn * 4.7)) * 0.3
      return {
        expression: blendFace(faceShape("neutral"), faceShape("joy"), 0.25 + Math.sin(turn * 0.5) * 0.15),
        intensity: 1,
        blink: faceBlink(t),
        speech: phrase * syllable,
        gaze: { x: Math.sin(turn * 0.61) * 0.35, y: Math.sin(turn * 0.29) * 0.2 },
        pose: {
          yaw: Math.sin(turn * 0.33) * 9,
          pitch: Math.sin(turn * 0.74) * 5 - phrase * 3,
          roll: Math.sin(turn * 0.21) * 3,
          heave: Math.sin(turn * 0.9) * 0.8,
        },
      }
    }
    case "listen":
      return {
        expression: blendFace(faceShape("neutral"), faceShape("doubt"), 0.4),
        intensity: 0.8,
        blink: faceBlink(t * 0.8),
        speech: 0,
        gaze: { x: Math.sin(turn * 0.23) * 0.2, y: -0.1 },
        pose: {
          yaw: Math.sin(turn * 0.19) * 5,
          pitch: -4 + Math.max(0, Math.sin(turn * 0.8)) * 7,
          roll: 8 + Math.sin(turn * 0.27) * 3,
          heave: Math.sin(turn * 0.8) * 0.7,
        },
      }
    case "emote": {
      const step = Math.floor(t) % parade.length
      const next = (step + 1) % parade.length
      const fraction = t - Math.floor(t)
      // Hold the pose, then ease to the next one over the last third.
      const eased = fraction < 0.66 ? 0 : (1 - Math.cos(((fraction - 0.66) / 0.34) * Math.PI)) / 2
      return {
        expression: blendFace(faceShape(parade[step]), faceShape(parade[next]), eased),
        intensity: 1,
        blink: faceBlink(t),
        speech: 0,
        gaze: { x: Math.sin(turn * 0.4) * 0.3, y: Math.sin(turn * 0.7) * 0.2 },
        pose: {
          yaw: Math.sin(turn * 0.31) * 8,
          pitch: Math.sin(turn * 0.53) * 5,
          roll: Math.sin(turn * 0.23) * 4,
          heave: Math.sin(turn * 0.9) * 1,
        },
      }
    }
    default:
      return {
        // Never quite at rest: a dead-still neutral reads as switched off, so
        // idle drifts a little way toward pleased and back.
        expression: blendFace(faceShape("neutral"), faceShape("joy"), 0.16 + Math.sin(turn * 0.27) * 0.1),
        intensity: 1,
        blink: faceBlink(t),
        speech: 0,
        // Micro-saccades: the eyes flick and hold rather than sweeping.
        gaze: {
          x: Math.sin(turn * 0.31) * 0.35 + Math.sin(turn * 1.7) * 0.08,
          y: Math.sin(turn * 0.47) * 0.22,
        },
        pose: {
          yaw: Math.sin(turn * 0.23) * 6,
          pitch: Math.sin(turn * 0.41) * 3,
          roll: Math.sin(turn * 0.17) * 2.5,
          heave: Math.sin(turn * 0.9) * 1.2,
        },
      }
  }
}

export { AnimatronicFace }
