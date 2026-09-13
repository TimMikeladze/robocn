/**
 * robocn — hand kinematics.
 *
 * Five digits in one hand-local frame: `x` across the palm toward the thumb,
 * `y` up the hand from wrist to fingertip, `z` out of the palm toward whoever
 * is looking at it. The wrist is the origin. A component draws points in that
 * frame and pushes them through the shared camera, so the four views are one
 * projection of one model rather than four drawings.
 *
 * Each finger is a three-link chain posed forward in a plane that is itself
 * rotated about the palm normal by the finger's abduction angle — which is
 * what makes a spread hand a pose rather than a second drawing.
 *
 * The thumb has a real saddle. Two driven degrees of freedom at the
 * carpometacarpal joint — splay across the palm and lift out of it — with the
 * axial roll of the flexion plane coupled to them, which is how the human
 * joint behaves and what makes opposition actually arrive somewhere. The pad
 * distance that falls out of it is reported as `pinch.gap`.
 *
 * No dependencies, no React. Pure functions over plain objects.
 */

import {
  add3,
  clamp,
  distance3,
  forwardChain2,
  lerp,
  scale3,
  toRadians,
  type Vec2,
  type Vec3,
} from "@/lib/robocn/kinematics"

export type HandSide = "left" | "right"

export type HandDigitName = "thumb" | "index" | "middle" | "ring" | "pinky"

/**
 * The seven grips a hand actually makes. `tripod` and `lateral` are the two
 * that only exist once the thumb opposes, so they are also the proof that it
 * does.
 */
export type HandGrasp =
  | "open"
  | "pinch"
  | "tripod"
  | "power"
  | "hook"
  | "point"
  | "lateral"

/** Digit order everywhere in this file, and in every array it takes or returns. */
export const handDigits: HandDigitName[] = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
]

export const handGrasps: HandGrasp[] = [
  "open",
  "pinch",
  "tripod",
  "power",
  "hook",
  "point",
  "lateral",
]

export interface HandGraspProfile {
  /** Closure each digit takes at full curl, thumb first. */
  digits: [number, number, number, number, number]
  /** How far the thumb has come across the palm, 0 alongside to 1 opposed. */
  opposition: number
  /** Finger fan, -1 pressed together to 1 splayed. */
  spread: number
}

/**
 * What each named grip asks of the hand. `curl` scales all three, so a grasp
 * opening up un-opposes the thumb and lets the fingers fall back to the open
 * hand's fan rather than freezing mid-grip.
 */
const graspTable: Record<HandGrasp, HandGraspProfile> = {
  //                thumb index middle ring pinky
  open: { digits: [0, 0, 0, 0, 0], opposition: 0.12, spread: 0.35 },
  pinch: { digits: [0.25, 0.68, 0.9, 0.96, 1], opposition: 1, spread: -0.15 },
  tripod: { digits: [0.3, 0.6, 0.62, 0.95, 1], opposition: 0.9, spread: 0 },
  power: { digits: [0.8, 0.94, 0.96, 0.96, 1], opposition: 0.55, spread: -0.35 },
  hook: { digits: [0.05, 0.95, 1, 1, 1], opposition: 0, spread: -0.5 },
  point: { digits: [0.55, 0, 0.95, 1, 1], opposition: 0.6, spread: -0.4 },
  lateral: { digits: [0.7, 0.85, 0.9, 0.92, 0.95], opposition: 0.35, spread: -0.45 },
}

export const graspProfile = (grasp: HandGrasp): HandGraspProfile =>
  graspTable[grasp] ?? graspTable.open

interface FingerGeometry {
  name: HandDigitName
  /** Knuckle in hand-local units. */
  knuckle: Vec3
  /** Proximal, middle and distal phalanx lengths. */
  links: [number, number, number]
  /** Joint flexion at full closure, in degrees. */
  bends: [number, number, number]
  /** Abduction at rest, degrees toward the thumb side. */
  splay: number
  /** Extra abduction per unit of `spread`. */
  fan: number
  /** How far the knuckle slides toward the middle finger at full closure. */
  converge: number
  radii: [number, number, number]
}

const fingers: FingerGeometry[] = [
  {
    name: "index",
    knuckle: { x: 14, y: 52, z: 1 },
    links: [24, 15, 11],
    bends: [80, 95, 70],
    splay: 7,
    fan: 9,
    converge: -3,
    radii: [5.4, 4.5, 3.6],
  },
  {
    name: "middle",
    knuckle: { x: 0, y: 55, z: 1.5 },
    links: [27, 17, 12],
    bends: [80, 95, 70],
    splay: 0,
    fan: 0,
    converge: -1,
    radii: [5.6, 4.6, 3.7],
  },
  {
    name: "ring",
    knuckle: { x: -13, y: 53, z: 1 },
    links: [25, 16, 11],
    bends: [82, 95, 72],
    splay: -6,
    fan: -8,
    converge: 2,
    radii: [5.2, 4.3, 3.5],
  },
  {
    name: "pinky",
    knuckle: { x: -25, y: 47, z: 0 },
    links: [20, 13, 9],
    bends: [84, 98, 74],
    splay: -12,
    fan: -16,
    converge: 5,
    radii: [4.6, 3.8, 3.1],
  },
]

/**
 * The saddle joint, and the chain hanging off it.
 *
 * Two driven angles place the metacarpal — `splay` across the palm and `lift`
 * out of it — and `roll` turns the flexion plane about that metacarpal. The
 * roll is the axial rotation the human joint carries along with the other two,
 * and it is the one that decides whether flexing the thumb takes the pad
 * forward out of the palm or across it into the fingers. Opposition swings all
 * three at once.
 *
 * A tip pinch sits at the edge of the thumb's workspace, which is why the
 * grasp table closes the thumb so little for it: in a real pinch the thumb is
 * nearly straight and it is the finger that comes to meet it.
 */
const thumb = {
  base: { x: 20, y: 18, z: 6 } as Vec3,
  /** Metacarpal, proximal, distal. */
  links: [20, 15, 11] as [number, number, number],
  /** Flexion at the metacarpophalangeal and interphalangeal joints: even an
   * open thumb carries some, and closure adds the rest. */
  rest: [14, 12] as [number, number],
  range: [50, 44] as [number, number],
  radii: [6, 5, 4] as [number, number, number],
  /** Splay from +y toward +x, and how far opposition swings it. */
  splay: 23,
  splaySwing: -5,
  /** Lift out of the palm plane, and how far opposition adds. */
  lift: 15,
  liftSwing: 25.5,
  /** Axial roll of the flexion plane — the rotation opposition really is. */
  roll: -8,
  rollSwing: -62,
}

/** Wrist to middle fingertip with the hand open, for anyone framing a viewBox. */
export const handLength = fingers[1].knuckle.y + fingers[1].links.reduce((a, b) => a + b, 0)

export interface HandOptions {
  grasp?: HandGrasp
  /** Master closure, 0 open to 1 shut, scaling the grasp. */
  curl?: number
  /**
   * Per-digit closure, thumb first, overriding the grasp for any entry that is
   * a finite number. A hand posed exactly rather than by name.
   */
  digits?: readonly (number | null | undefined)[]
  /** Finger fan, -1 pressed together to 1 splayed. Defaults to the grasp's. */
  spread?: number
  /** Thumb across the palm, 0 alongside to 1 opposed. Defaults to the grasp's. */
  opposition?: number
  /** A hand is handed: `left` is `right` mirrored in x, not a second drawing. */
  side?: HandSide
  /** Wrist flexion in degrees, positive toward the palm. */
  wristPitch?: number
  /** Wrist deviation in degrees, positive toward the thumb. */
  wristYaw?: number
}

export interface HandDigit {
  name: HandDigitName
  /** Knuckle, then one point per joint out to the tip. */
  joints: Vec3[]
  /** Drawn radius of each phalanx, tapering to the tip. */
  radii: number[]
  /** This digit's closure, 0 straight to 1 fully flexed. */
  closure: number
  /** Fingertip. */
  tip: Vec3
  /** The pad behind the tip — the surface that touches things. */
  pad: Vec3
}

export interface HandPose {
  side: HandSide
  grasp: HandGrasp
  curl: number
  opposition: number
  spread: number
  /** Thumb first, then index to pinky. */
  digits: HandDigit[]
  wrist: Vec3
  /** Palm outline in the hand plane, ready to be given a thickness in z. */
  palm: Vec2[]
  /** How far the palm slab stands in front of and behind the hand plane. */
  palmFront: number
  palmBack: number
  /**
   * Thumb pad, index pad, and the distance between them in world units. It is
   * reported, not asserted: a small gap is a pinch shape, not a grip on
   * anything.
   */
  pinch: { thumb: Vec3; finger: Vec3; gap: number }
}

const finite = (value: number | null | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const unit = (value: number | null | undefined, fallback: number) =>
  clamp(finite(value, fallback), 0, 1)

const signed = (value: number | null | undefined, fallback: number) =>
  clamp(finite(value, fallback), -1, 1)

const rotateX = (v: Vec3, degrees: number): Vec3 => {
  const a = toRadians(degrees)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
}

const rotateZ = (v: Vec3, degrees: number): Vec3 => {
  const a = toRadians(degrees)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z }
}

/** Rodrigues: turn `v` about the unit axis `k` by `degrees`. */
function rotateAbout(v: Vec3, k: Vec3, degrees: number): Vec3 {
  const a = toRadians(degrees)
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = k.x * v.x + k.y * v.y + k.z * v.z
  return {
    x: v.x * c + (k.y * v.z - k.z * v.y) * s + k.x * dot * (1 - c),
    y: v.y * c + (k.z * v.x - k.x * v.z) * s + k.y * dot * (1 - c),
    z: v.z * c + (k.x * v.y - k.y * v.x) * s + k.z * dot * (1 - c),
  }
}

const unitVector = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z)
  return length < 1e-9 ? { x: 0, y: 1, z: 0 } : scale3(v, 1 / length)
}

/** The rounded outline of the palm in the hand plane. */
const palmOutline: Vec2[] = [
  { x: 19, y: 8 },
  { x: 23, y: 20 },
  { x: 21, y: 40 },
  { x: 18, y: 54 },
  { x: 4, y: 58 },
  { x: -10, y: 56 },
  { x: -22, y: 51 },
  { x: -28, y: 40 },
  { x: -27, y: 22 },
  { x: -20, y: 6 },
  { x: -6, y: 0 },
  { x: 9, y: 1 },
]

/**
 * A whole hand from a grasp and a closure. Every length in the chain is fixed:
 * closing a digit only changes its joint angles, never its phalanges, which is
 * what the tests hold it to.
 */
export function solveHand({
  grasp = "power",
  curl = 1,
  digits,
  spread,
  opposition,
  side = "right",
  wristPitch = 0,
  wristYaw = 0,
}: HandOptions = {}): HandPose {
  const named = graspProfile(grasp)
  const shut = unit(curl, 1)
  const open = graspTable.open
  const fan = signed(spread, lerp(open.spread, named.spread, shut))
  const oppose = unit(opposition, lerp(open.opposition, named.opposition, shut))
  const mirror = side === "left" ? -1 : 1
  const pitch = clamp(finite(wristPitch, 0), -70, 70)
  const yaw = clamp(finite(wristYaw, 0), -35, 35)

  const closure = handDigits.map((_, index) =>
    unit(digits?.[index], clamp(named.digits[index] * shut, 0, 1)),
  )

  // The wrist turns the whole hand after the digits are solved, so flexing it
  // never changes a grasp.
  const place = (point: Vec3): Vec3 => {
    const turned = rotateX(rotateZ(point, yaw * mirror), pitch)
    return { x: turned.x * mirror, y: turned.y, z: turned.z }
  }

  const solved: HandDigit[] = []

  /**
   * One digit: a chain posed forward in the plane `{along, across}` hung off
   * `base`. Both bases are unit and perpendicular, so every phalanx keeps its
   * length however the plane is turned.
   */
  const digit = (
    name: HandDigitName,
    base: Vec3,
    along: Vec3,
    across: Vec3,
    angles: number[],
    links: number[],
    radii: number[],
    shutDigit: number,
    padOffset: number,
  ): HandDigit => {
    const chain = forwardChain2({ x: 0, y: 0 }, angles, links)
    const lift3 = (joint: Vec2): Vec3 => ({
      x: base.x + along.x * joint.x + across.x * joint.y,
      y: base.y + along.y * joint.x + across.y * joint.y,
      z: base.z + along.z * joint.x + across.z * joint.y,
    })
    const raw = chain.map(lift3)
    // The pad is on the flexion side of the last phalanx — the face the digit
    // closes onto things with.
    const tip = raw[raw.length - 1]
    const previous = raw[raw.length - 2] ?? tip
    const back = unitVector({
      x: previous.x - tip.x,
      y: previous.y - tip.y,
      z: previous.z - tip.z,
    })
    const pad = add3(
      add3(tip, scale3(back, padOffset * 0.7)),
      scale3(across, padOffset * 0.55),
    )
    return {
      name,
      joints: raw.map(place),
      radii: [...radii],
      closure: shutDigit,
      tip: place(tip),
      pad: place(pad),
    }
  }

  // --- thumb: two saddle angles, then a two-hinge chain in the rolled plane --
  const thumbShut = closure[0]
  const splay = thumb.splay + thumb.splaySwing * oppose
  const lift = thumb.lift + thumb.liftSwing * oppose
  const roll = thumb.roll + thumb.rollSwing * oppose
  // Metacarpal direction: swung across the palm, then lifted out of it.
  const alongThumb = unitVector({
    x: Math.sin(toRadians(splay)) * Math.cos(toRadians(lift)),
    y: Math.cos(toRadians(splay)) * Math.cos(toRadians(lift)),
    z: Math.sin(toRadians(lift)),
  })
  // Flexion direction: the palm normal made perpendicular to the metacarpal,
  // then rolled about it. The roll is opposition — it is what turns the pad to
  // face the fingers instead of facing forward.
  const projected = unitVector({
    x: -alongThumb.x * alongThumb.z,
    y: -alongThumb.y * alongThumb.z,
    z: 1 - alongThumb.z * alongThumb.z,
  })
  solved.push(
    digit(
      "thumb",
      thumb.base,
      alongThumb,
      rotateAbout(projected, alongThumb, roll),
      [
        0,
        thumb.rest[0] + thumb.range[0] * thumbShut,
        thumb.rest[1] + thumb.range[1] * thumbShut,
      ],
      thumb.links,
      thumb.radii,
      thumbShut,
      3.2,
    ),
  )

  // --- fingers: a three-link chain in a plane abducted about the palm normal -
  const knuckles: Vec3[] = []
  fingers.forEach((finger, index) => {
    const shutFinger = closure[index + 1]
    const angle = finger.splay + finger.fan * fan
    const base: Vec3 = {
      x: finger.knuckle.x + finger.converge * shutFinger,
      y: finger.knuckle.y,
      z: finger.knuckle.z,
    }
    knuckles.push(place(base))
    solved.push(
      digit(
        finger.name,
        base,
        // Abduction is a turn about the palm normal, so it fans the fingers
        // without taking any of them out of the palm plane.
        { x: Math.sin(toRadians(angle)), y: Math.cos(toRadians(angle)), z: 0 },
        { x: 0, y: 0, z: 1 },
        finger.bends.map((bend) => bend * shutFinger),
        finger.links,
        finger.radii,
        shutFinger,
        2.8,
      ),
    )
  })

  const thumbPad = solved[0].pad
  const indexPad = solved[1].pad

  return {
    side,
    grasp: graspTable[grasp] ? grasp : "open",
    curl: shut,
    opposition: oppose,
    spread: fan,
    digits: solved,
    wrist: place({ x: 0, y: 0, z: 0 }),
    palm: palmOutline.map((point) => ({ x: point.x * mirror, y: point.y })),
    palmFront: 5,
    palmBack: -4.5,
    pinch: {
      thumb: thumbPad,
      finger: indexPad,
      gap: distance3(thumbPad, indexPad),
    },
  }
}

export type HandBehavior = "grip" | "wave" | "static"

/** Closure, 0–1, at `clock`: close onto the grip, hold it, and open again. */
export function handGoal(behavior: HandBehavior, clock: number) {
  if (behavior === "static" || !Number.isFinite(clock)) return 0
  const t = ((clock % 1) + 1) % 1
  if (behavior === "wave") return 0.5
  if (t < 0.3) return t / 0.3
  if (t < 0.62) return 1
  if (t < 0.85) return 1 - (t - 0.62) / 0.23
  return 0
}

/**
 * One digit's closure in the ripple, offset down the hand so it reads as a
 * wave rather than five fingers doing the same thing.
 */
export function handWave(clock: number, digit: number) {
  if (!Number.isFinite(clock)) return 0
  const t = clock - digit * 0.11
  return clamp(0.5 + Math.sin(t * Math.PI * 2) * 0.5, 0, 1)
}
