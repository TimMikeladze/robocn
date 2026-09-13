import { describe, expect, it } from "vitest"

import {
  GRAVITY,
  ballFrame,
  ballLaces,
  ballNormal,
  ballPoint,
  ballSilhouette,
  ballTip,
  defaultBall,
  flightAttitude,
  helmetOutline,
  kickFlight,
  launcherExit,
  routeLength,
  routeNames,
  routePath,
  playerSpine,
  playerUpperBody,
  sampleRoute,
  sledDeflection,
  sledSlide,
  stanceGeometry,
  stancePitch,
} from "@/lib/robocn/gridiron"

const length = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z)
const dot = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => a.x * b.x + a.y * b.y + a.z * b.z

describe("the ball", () => {
  it("keeps an orthonormal frame through any attitude", () => {
    const frame = ballFrame({ yaw: 37, pitch: -22, roll: 194 })
    expect(length(frame.u)).toBeCloseTo(1, 10)
    expect(length(frame.v)).toBeCloseTo(1, 10)
    expect(length(frame.w)).toBeCloseTo(1, 10)
    expect(dot(frame.u, frame.v)).toBeCloseTo(0, 10)
    expect(dot(frame.u, frame.w)).toBeCloseTo(0, 10)
    expect(dot(frame.v, frame.w)).toBeCloseTo(0, 10)
  })

  it("points the nose downfield at rest and turns it with the yaw", () => {
    expect(ballFrame().u.z).toBeCloseTo(-1, 10)
    // Yawing right swings the nose toward +x.
    expect(ballFrame({ yaw: 90 }).u.x).toBeCloseTo(1, 10)
    // Pitching up lifts it.
    expect(ballFrame({ pitch: 90 }).u.y).toBeCloseTo(1, 10)
  })

  it("puts every surface point on the spheroid it says it is", () => {
    const frame = ballFrame({ yaw: 18, pitch: 31, roll: 77 })
    for (const s of [-0.9, -0.3, 0, 0.55, 1]) {
      for (const theta of [0, 47, 180, 300]) {
        const p = ballPoint(frame, defaultBall, s, theta)
        const along = dot(p, frame.u) / defaultBall.long
        const across =
          Math.hypot(dot(p, frame.v), dot(p, frame.w)) / defaultBall.waist
        expect(along * along + across * across).toBeCloseTo(1, 8)
      }
    }
  })

  it("draws the end-on silhouette as a circle of the waist radius", () => {
    const frame = ballFrame()
    // Looking straight down the long axis: every outline point is `waist` out.
    const outline = ballSilhouette(frame, defaultBall, { x: 0, y: 0, z: 1 }, 24)
    for (const point of outline) {
      expect(length(point)).toBeCloseTo(defaultBall.waist, 8)
      // ...and none of it is along the axis.
      expect(dot(point, frame.u)).toBeCloseTo(0, 8)
    }
  })

  it("draws the broadside silhouette out to the full length", () => {
    const outline = ballSilhouette(ballFrame(), defaultBall, { x: 1, y: 0, z: 0 }, 64)
    const reach = Math.max(...outline.map(length))
    expect(reach).toBeCloseTo(defaultBall.long, 6)
    expect(Math.min(...outline.map(length))).toBeCloseTo(defaultBall.waist, 6)
  })

  it("keeps the silhouette's normals perpendicular to the view, which is what makes it the outline", () => {
    const frame = ballFrame({ yaw: 25, pitch: -14, roll: 61 })
    const view = { x: 0.3, y: 0.5, z: 0.81 }
    const outline = ballSilhouette(frame, defaultBall, view, 16)
    const unitView = {
      x: view.x / length(view),
      y: view.y / length(view),
      z: view.z / length(view),
    }
    for (const point of outline) {
      // Recover (s, theta) for the point and take the real normal there.
      const s = dot(point, frame.u) / defaultBall.long
      const theta = (Math.atan2(dot(point, frame.v), dot(point, frame.w)) * 180) / Math.PI
      expect(dot(ballNormal(frame, defaultBall, s, theta), unitView)).toBeCloseTo(0, 6)
    }
  })

  it("takes the laces round the back as the ball rolls", () => {
    // Laces sit on the `w` meridian, which at rest points up: so look down.
    const view = { x: 0, y: 1, z: 0 }
    const front = ballLaces(ballFrame({ roll: 0 }), defaultBall, view, 6)
    const back = ballLaces(ballFrame({ roll: 180 }), defaultBall, view, 6)
    expect(front.every((lace) => lace.facing > 0)).toBe(true)
    expect(back.every((lace) => lace.facing < 0)).toBe(true)
  })

  it("puts the tips on the long axis", () => {
    const frame = ballFrame({ yaw: 40, pitch: 20 })
    expect(length(ballTip(frame, defaultBall, 1))).toBeCloseTo(defaultBall.long, 10)
    expect(dot(ballTip(frame, defaultBall, -1), frame.u)).toBeCloseTo(-defaultBall.long, 8)
  })

  it("falls back to a neutral shape on rubbish input", () => {
    const frame = ballFrame({ yaw: Number.NaN, pitch: Number.NaN, roll: Number.NaN })
    expect(frame.u.z).toBeCloseTo(-1, 10)
    const p = ballPoint(frame, { long: Number.NaN, waist: 0 }, Number.NaN, Number.NaN)
    expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true)
  })
})

describe("flight attitudes", () => {
  it("rolls a spiral a whole number of turns per cycle", () => {
    const start = flightAttitude("spiral", 0, { spin: 6 })
    const end = flightAttitude("spiral", 1, { spin: 6 })
    expect(start.roll).toBe(0)
    // A whole cycle is the spin count in turns, and it wraps back to the start.
    expect(end.roll).toBe(start.roll)
    expect(flightAttitude("spiral", 0.5, { spin: 6 }).roll).toBeCloseTo(1080, 8)
  })

  it("keeps a spiral's cone tighter than a wobble's", () => {
    const spiral = flightAttitude("spiral", 0.25, {})
    const wobble = flightAttitude("wobble", 0.25, {})
    expect(Math.hypot(spiral.yaw, spiral.pitch)).toBeLessThan(
      Math.hypot(wobble.yaw, wobble.pitch),
    )
  })

  it("tumbles end over end with no roll", () => {
    expect(flightAttitude("tumble", 0.25, {}).pitch).toBeCloseTo(90, 8)
    expect(flightAttitude("tumble", 0.25, {}).roll).toBe(0)
  })

  it("holds still when asked, and on a NaN clock", () => {
    expect(flightAttitude("hold", 0.7, { pitch: 12 })).toEqual({ yaw: 0, pitch: 12, roll: 0 })
    expect(flightAttitude("spiral", Number.NaN, {}).roll).toBe(0)
  })
})

describe("ballistics", () => {
  it("lands where the parabola says, and agrees with the closed form", () => {
    const flight = kickFlight({ speed: 24, angle: 45, height: 0 })
    expect(flight.hangTime).toBeCloseTo((2 * 24 * Math.sin(Math.PI / 4)) / GRAVITY, 8)
    expect(flight.range).toBeCloseTo((24 * 24) / GRAVITY, 6)
    expect(flight.at(flight.hangTime).y).toBeCloseTo(0, 8)
  })

  it("throws furthest at forty five degrees off the ground", () => {
    const ranges = [30, 40, 45, 50, 60].map(
      (angle) => kickFlight({ speed: 20, angle }).range,
    )
    expect(Math.max(...ranges)).toBe(ranges[2])
  })

  it("trades range for hang time as the angle steepens, which is the whole point of a punt", () => {
    const flat = kickFlight({ speed: 26, angle: 32 })
    const high = kickFlight({ speed: 26, angle: 62 })
    expect(high.hangTime).toBeGreaterThan(flat.hangTime)
    expect(high.range).toBeLessThan(flat.range)
  })

  it("puts the apex halfway along a flat launch and holds it after landing", () => {
    const flight = kickFlight({ speed: 22, angle: 50 })
    expect(flight.apexTime).toBeCloseTo(flight.hangTime / 2, 8)
    expect(flight.apex).toBeCloseTo(flight.at(flight.apexTime).y, 8)
    expect(flight.at(flight.hangTime * 4).x).toBeCloseTo(flight.range, 8)
  })

  it("comes down at the angle it went up, from the ground", () => {
    const flight = kickFlight({ speed: 25, angle: 38 })
    expect(flight.impactAngle).toBeCloseTo(38, 6)
  })

  it("survives nonsense", () => {
    const flight = kickFlight({ speed: Number.NaN, angle: Number.NaN, gravity: 0 })
    expect(Number.isFinite(flight.range)).toBe(true)
    expect(Number.isFinite(flight.hangTime)).toBe(true)
  })
})

describe("the wheel launcher", () => {
  it("throws matched wheels flat and fast, with no spin", () => {
    const exit = launcherExit({ top: 40, bottom: 40, wheelRadius: 5 })
    expect(exit.spin).toBeCloseTo(0, 10)
    expect(exit.speed).toBeCloseTo(2 * Math.PI * 5 * 40, 8)
    expect(exit.bias).toBe(0)
  })

  it("makes topspin when the top wheel is the faster one", () => {
    expect(launcherExit({ top: 50, bottom: 20 }).spin).toBeGreaterThan(0)
    expect(launcherExit({ top: 20, bottom: 50 }).spin).toBeLessThan(0)
  })

  it("gives the spin as the surface difference over the ball's circumference", () => {
    const exit = launcherExit({ top: 45, bottom: 15, wheelRadius: 4, ballRadius: 2 })
    expect(exit.spin).toBeCloseTo(
      (exit.topSurface - exit.bottomSurface) / (2 * Math.PI * 2 * 2),
      8,
    )
  })

  it("reports one wheel stopped as full bias", () => {
    expect(launcherExit({ top: 30, bottom: 0 }).bias).toBeCloseTo(1, 10)
    expect(launcherExit({ top: 0, bottom: 0 }).bias).toBe(0)
  })
})

describe("the route tree", () => {
  it("gives every named route a path with real length", () => {
    for (const name of routeNames) {
      const path = routePath(name, { depth: 12 })
      expect(path.length).toBeGreaterThanOrEqual(2)
      expect(routeLength(path)).toBeGreaterThan(5)
    }
  })

  it("breaks a slant inside and an out outside, and mirrors on the side", () => {
    const slant = routePath("slant", { depth: 12 })
    const out = routePath("out", { depth: 12 })
    expect(slant[slant.length - 1].x).toBeLessThan(0)
    expect(out[out.length - 1].x).toBeGreaterThan(0)
    const mirrored = routePath("out", { depth: 12, side: -1 })
    expect(mirrored[mirrored.length - 1].x).toBeCloseTo(-out[out.length - 1].x, 10)
  })

  it("walks the runner along it by arc length", () => {
    const path = routePath("corner", { depth: 14 })
    const total = routeLength(path)
    expect(sampleRoute(path, 0).progress).toBe(0)
    expect(sampleRoute(path, total).progress).toBeCloseTo(1, 10)
    const half = sampleRoute(path, total / 2)
    expect(half.progress).toBeCloseTo(0.5, 8)
    // Clamped at both ends rather than running off the polyline.
    expect(sampleRoute(path, -20).point).toEqual(path[0])
    expect(sampleRoute(path, total * 3).progress).toBeCloseTo(1, 10)
  })

  it("heads straight downfield off the line, and turns at the break", () => {
    const path = routePath("out", { depth: 12 })
    expect(sampleRoute(path, 2).heading).toBeCloseTo(0, 8)
    expect(sampleRoute(path, 2).breaking).toBe(0)
    // Just past the corner at the top of the stem.
    const atBreak = sampleRoute(path, routeLength(path.slice(0, 2)) + 0.3)
    expect(atBreak.turn).toBeGreaterThan(0)
    // The same break, mirrored, leans the other way.
    const mirrored = routePath("out", { depth: 12, side: -1 })
    expect(
      sampleRoute(mirrored, routeLength(mirrored.slice(0, 2)) + 0.3).turn,
    ).toBeLessThan(0)
  })

  it("degenerates safely", () => {
    expect(sampleRoute([], 4).progress).toBe(0)
    expect(sampleRoute([{ x: 1, y: 1 }], 4).point).toEqual({ x: 1, y: 1 })
    expect(sampleRoute(routePath("go"), Number.NaN).progress).toBe(0)
  })
})

describe("stances", () => {
  it("only puts a hand down in a three-point stance, and loads it", () => {
    const down = stanceGeometry("three-point")
    expect(down.downHand).not.toBeNull()
    expect(down.handLoad).toBeGreaterThan(0)
    for (const name of ["two-point", "set", "upright"] as const) {
      expect(stanceGeometry(name).downHand).toBeNull()
      expect(stanceGeometry(name).handLoad).toBe(0)
    }
  })

  it("stands taller and squarer the further up the stance is", () => {
    const three = stanceGeometry("three-point")
    const two = stanceGeometry("two-point")
    const up = stanceGeometry("upright")
    expect(three.crouch).toBeLessThan(two.crouch)
    expect(two.crouch).toBeLessThan(up.crouch)
    expect(three.lean).toBeGreaterThan(two.lean)
    expect(two.lean).toBeGreaterThan(up.lean)
  })

  it("makes the flat back an output of the hand being on the turf", () => {
    const hand = { x: 9, y: 2.5, z: -40 }
    const lean = stancePitch({ hipHeight: 55, spine: 56, arm: 56, hand, shoulderSpan: 19 })
    // The shoulder ends up exactly one arm from the hand, which is the point.
    const column = playerSpine({ base: { x: 0, y: 55, z: 0 }, length: 56, segments: 7, lean })
    const shoulder = column[column.length - 1]
    expect(
      Math.hypot(shoulder.x + 19 - hand.x, shoulder.y - hand.y, shoulder.z - hand.z),
    ).toBeCloseTo(56, 3)
    // And that pitch really does lay the back flat: shoulders level with hips.
    expect(lean).toBeGreaterThan(80)
    expect(Math.abs(shoulder.y - 55)).toBeLessThan(6)
  })

  it("reaches a hand already within reach without pitching at all", () => {
    expect(stancePitch({ hipHeight: 55, spine: 56, arm: 56, hand: { x: 0, y: 60, z: -10 } })).toBe(0)
  })

  it("keeps the column's segments equal and its chord at the pitch asked for", () => {
    const column = playerSpine({ base: { x: 0, y: 40, z: 0 }, length: 56, segments: 7, lean: 90, arch: 18 })
    const steps = column.slice(1).map((point, index) =>
      Math.hypot(point.x - column[index].x, point.y - column[index].y, point.z - column[index].z),
    )
    for (const step of steps) expect(step).toBeCloseTo(56 / 7, 8)
    // Chord at 90 degrees from vertical: the shoulders end level with the sacrum.
    const shoulder = column[column.length - 1]
    expect(shoulder.y).toBeCloseTo(40, 6)
    expect(shoulder.z).toBeLessThan(-50)
  })

  it("hands back a head frame whose axes are orthonormal at any pitch", () => {
    const body = playerUpperBody({
      pelvis: { x: 0, y: 55, z: 0 },
      lean: 92,
      twist: 18,
      gazePitch: 68,
      gazeYaw: -12,
    })
    const dot = (a: typeof body.nose, b: typeof body.nose) => a.x * b.x + a.y * b.y + a.z * b.z
    for (const axis of [body.nose, body.up, body.right]) {
      expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 8)
    }
    expect(dot(body.nose, body.up)).toBeCloseTo(0, 8)
    expect(dot(body.nose, body.right)).toBeCloseTo(0, 8)
    // Looking up out of a flat back puts the crown above the neck again.
    expect(body.head.y).toBeGreaterThan(body.neck.y)
  })

  it("falls back to upright for an unknown stance", () => {
    // @ts-expect-error — a stale prop from a consumer must degrade, not crash.
    expect(stanceGeometry("nonsense").stance).toBe("upright")
  })
})

describe("the sled", () => {
  it("does not move until the load beats the preload", () => {
    expect(sledDeflection(0)).toBe(0)
    expect(sledDeflection(1)).toBe(0)
    expect(sledDeflection(40)).toBeGreaterThan(0)
  })

  it("balances the load's moment against the spring's at the angle it returns", () => {
    const options = { arm: 26, stiffness: 620, preload: 6 }
    const load = 60
    const theta = (sledDeflection(load, options) * Math.PI) / 180
    expect(load * options.arm * Math.cos(theta)).toBeCloseTo(
      options.stiffness * (theta + (options.preload * Math.PI) / 180),
      4,
    )
  })

  it("gives ground grudgingly: the last degrees cost more than the first", () => {
    const first = sledDeflection(40) - sledDeflection(20)
    const later = sledDeflection(100) - sledDeflection(80)
    expect(sledDeflection(100)).toBeGreaterThan(sledDeflection(40))
    expect(later).toBeLessThan(first)
    expect(sledDeflection(1e6)).toBeLessThan(90)
  })

  it("holds the frame still below the friction threshold", () => {
    const still = sledSlide(4, { weight: 10, friction: 0.6 })
    expect(still.sliding).toBe(false)
    expect(still.acceleration).toBe(0)
    const going = sledSlide(10, { weight: 10, friction: 0.6, mass: 2 })
    expect(going.sliding).toBe(true)
    expect(going.acceleration).toBeCloseTo((10 - 6) / 2, 10)
  })

  it("survives nonsense", () => {
    expect(sledDeflection(Number.NaN)).toBe(0)
    expect(sledSlide(Number.NaN, { weight: Number.NaN }).acceleration).toBe(0)
  })
})

describe("the kit", () => {
  it("closes the helmet shell around its own radius", () => {
    const shell = helmetOutline(12)
    expect(shell.length).toBeGreaterThan(8)
    for (const point of shell) {
      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(12 * 1.05)
    }
    // Scaling the radius scales the outline and nothing else.
    expect(helmetOutline(24)[0].x).toBeCloseTo(shell[0].x * 2, 10)
  })
})
