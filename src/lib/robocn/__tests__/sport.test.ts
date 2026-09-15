import { describe, expect, it } from "vitest"

import {
  barrelRadius,
  baseballSeam,
  basketballSeams,
  bounceAt,
  bounceDuration,
  clipToLimb,
  contactSquash,
  defaultBat,
  dribbleAt,
  effectiveMass,
  flightAt,
  identityFrame,
  pitchSpin,
  type PitchName,
  puckRim,
  puckSilhouette,
  rollTurns,
  slideAt,
  slideTrack,
  soccerPanels,
  sphereSilhouette,
  spinFrame,
  surfaceCurve,
  sweetSpot,
  swingAngle,
  swingImpact,
  visibleRuns,
} from "@/lib/robocn/sport"

const length = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z)

describe("sport-geometry — orientation", () => {
  it("keeps the frame orthonormal through any spin", () => {
    const frame = spinFrame({ x: 0.4, y: 1, z: -0.2 }, 0.37)
    for (const axis of [frame.u, frame.v, frame.w]) expect(length(axis)).toBeCloseTo(1, 9)
    expect(frame.u.x * frame.v.x + frame.u.y * frame.v.y + frame.u.z * frame.v.z).toBeCloseTo(0, 9)
    expect(frame.v.x * frame.w.x + frame.v.y * frame.w.y + frame.v.z * frame.w.z).toBeCloseTo(0, 9)
  })

  it("comes back to where it started after a whole turn", () => {
    const frame = spinFrame({ x: 1, y: 0, z: 0 }, 1)
    expect(frame.v.y).toBeCloseTo(1, 9)
    expect(frame.w.z).toBeCloseTo(1, 9)
  })

  it("gives the neutral frame for a rubbish axis", () => {
    const frame = spinFrame({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, Number.NaN)
    for (const axis of [frame.u, frame.v, frame.w]) expect(Number.isFinite(length(axis))).toBe(true)
  })
})

describe("sport-geometry — the markings are on the sphere", () => {
  it("puts every point of the baseball seam exactly on the surface", () => {
    for (const shape of [0.05, 0.28, 0.5]) {
      for (const point of baseballSeam(shape, 64)) expect(length(point)).toBeCloseTo(1, 9)
    }
  })

  it("closes the seam into one figure-eight rather than two loops", () => {
    const seam = baseballSeam(0.28, 128)
    const first = seam[0]
    const last = seam[seam.length - 1]
    // The curve is closed: the last sample is one step from the first.
    expect(Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z)).toBeLessThan(0.2)
    // It leaves the equator, which is what makes it a seam and not a great circle.
    expect(Math.max(...seam.map((p) => Math.abs(p.y)))).toBeGreaterThan(0.5)
  })

  it("cuts the basketball into eight panels with three curves", () => {
    const seams = basketballSeams(30, 48)
    expect(seams).toHaveLength(3)
    for (const seam of seams) {
      for (const point of seam) expect(length(point)).toBeCloseTo(1, 9)
    }
  })

  it("builds the soccer ball as a truncated icosahedron", () => {
    const panels = soccerPanels(1)
    expect(panels).toHaveLength(32)
    expect(panels.filter((panel) => panel.kind === "pentagon")).toHaveLength(12)
    expect(panels.filter((panel) => panel.kind === "hexagon")).toHaveLength(20)
    for (const panel of panels) {
      expect(panel.vertices).toHaveLength(panel.kind === "pentagon" ? 5 : 6)
      for (const vertex of panel.vertices) expect(length(vertex)).toBeCloseTo(1, 9)
      expect(length(panel.centre)).toBeCloseTo(1, 9)
    }
  })

  it("subdivides panel edges along great circles, still on the sphere", () => {
    for (const panel of soccerPanels(3)) {
      expect(panel.vertices).toHaveLength(panel.kind === "pentagon" ? 15 : 18)
      for (const vertex of panel.vertices) expect(length(vertex)).toBeCloseTo(1, 9)
    }
  })
})

describe("sport-geometry — what the camera can see", () => {
  const look = { x: 0, y: 0, z: 1 }

  it("hides the half of a ring that has gone round the back", () => {
    const ring = Array.from({ length: 36 }, (_, index) => {
      const a = (index / 36) * Math.PI * 2
      return { x: Math.cos(a), y: 0, z: Math.sin(a) }
    })
    const marks = surfaceCurve(identityFrame, 10, ring, look)
    expect(marks.filter((mark) => mark.facing > 0).length).toBe(18)
    const runs = visibleRuns(marks)
    expect(runs).toHaveLength(1)
    expect(runs[0].length).toBeLessThan(marks.length)
  })

  it("closes a ring nothing hides into a complete circle", () => {
    const equator = Array.from({ length: 24 }, (_, index) => {
      const a = (index / 24) * Math.PI * 2
      return { x: Math.cos(a), y: Math.sin(a), z: 0.2 }
    })
    const runs = visibleRuns(surfaceCurve(identityFrame, 10, equator, look))
    expect(runs).toHaveLength(1)
    expect(runs[0]).toHaveLength(25)
  })

  it("pulls a direction that has gone round the back onto the limb", () => {
    const clipped = clipToLimb({ x: 0.2, y: 0, z: -1 }, look)
    expect(length(clipped)).toBeCloseTo(1, 9)
    expect(clipped.z).toBeCloseTo(0, 9)
    // Something already in front is left alone.
    expect(clipToLimb({ x: 0, y: 0, z: 1 }, look).z).toBeCloseTo(1, 9)
  })

  it("draws a sphere's outline perpendicular to the view, at its full radius", () => {
    for (const point of sphereSilhouette(14, { x: 0.3, y: 1, z: 0.4 }, 32)) {
      expect(length(point)).toBeCloseTo(14, 9)
      expect(point.x * 0.3 + point.y * 1 + point.z * 0.4).toBeCloseTo(0, 6)
    }
  })
})

describe("sport-geometry — the puck", () => {
  it("hulls the two rims into one silhouette, whatever the angle", () => {
    const flat = puckSilhouette(identityFrame, {}, (p) => ({ x: p.x, y: p.z }))
    // Seen down its own axis it is a circle of the full radius.
    for (const point of flat) expect(Math.hypot(point.x, point.y)).toBeCloseTo(12, 6)

    const edge = puckSilhouette(identityFrame, {}, (p) => ({ x: p.x, y: -p.y }))
    const widest = Math.max(...edge.map((point) => point.x))
    const tallest = Math.max(...edge.map((point) => point.y))
    // Edge-on it is the rectangle: full width, and only the two half heights.
    expect(widest).toBeCloseTo(12, 6)
    expect(tallest).toBeCloseTo(3.4, 6)
  })

  it("stands its two rims a full height apart", () => {
    const top = puckRim(identityFrame, {}, 1, 8)
    const bottom = puckRim(identityFrame, {}, -1, 8)
    expect(top[0].y - bottom[0].y).toBeCloseTo(6.8, 9)
  })
})

describe("sport-geometry — the restitution ladder", () => {
  const options = { drop: 100, restitution: 0.7, gravity: 10 }
  const fall = Math.sqrt((2 * options.drop) / options.gravity)

  it("starts at the apex and arrives at the floor", () => {
    expect(bounceAt(0, options).height).toBeCloseTo(100, 9)
    expect(bounceAt(fall, options).height).toBeCloseTo(0, 6)
  })

  it("makes every apex the last one times e squared", () => {
    // The first flight's apex sits half a flight after the first impact.
    const first = bounceAt(fall + 0.7 * fall, options)
    expect(first.height).toBeCloseTo(100 * 0.7 ** 2, 6)
    expect(first.bounce).toBe(1)

    const second = bounceAt(fall + 2 * 0.7 * fall + 0.7 ** 2 * fall, options)
    expect(second.height).toBeCloseTo(100 * 0.7 ** 4, 6)
    expect(second.bounce).toBe(2)
  })

  it("settles at t0(1 + e)/(1 - e) and stays there", () => {
    const total = bounceDuration(options)
    expect(total).toBeCloseTo((fall * 1.7) / 0.3, 9)
    const after = bounceAt(total + 5, options)
    expect(after.settled).toBe(true)
    expect(after.height).toBe(0)
  })

  it("never puts the ball below the floor, sampled across the whole fall", () => {
    const total = bounceDuration(options)
    for (let index = 0; index <= 400; index += 1) {
      const state = bounceAt((total * index) / 400, options)
      expect(state.height).toBeGreaterThan(-1e-6)
      expect(Number.isFinite(state.height)).toBe(true)
    }
  })

  it("degrades rather than throwing on rubbish", () => {
    const state = bounceAt(Number.NaN, { drop: Number.NaN, restitution: 4, gravity: 0 })
    expect(Number.isFinite(state.height)).toBe(true)
    expect(Number.isFinite(bounceDuration({ restitution: 1 }))).toBe(true)
  })

  it("dribbles a real parabola that repeats every cycle", () => {
    expect(dribbleAt(0, { apex: 40 }).height).toBeCloseTo(0, 9)
    expect(dribbleAt(0.5, { apex: 40 }).height).toBeCloseTo(40, 9)
    expect(dribbleAt(1.25, { apex: 40 }).height).toBeCloseTo(dribbleAt(0.25, { apex: 40 }).height, 9)
    // The paddle never ends up inside the ball.
    for (let index = 0; index <= 40; index += 1) {
      const state = dribbleAt(index / 40, { apex: 40 })
      expect(state.paddle).toBeGreaterThanOrEqual(state.height - 1e-9)
    }
  })

  it("squashes harder the harder it lands, and never inverts the ball", () => {
    expect(contactSquash(1, 12)).toBeGreaterThan(contactSquash(1, 3))
    expect(contactSquash(0, 12)).toBe(0)
    expect(contactSquash(1, 1e6)).toBeLessThanOrEqual(0.45)
  })
})

describe("sport-geometry — flight", () => {
  it("throws a plain parabola when nothing is spinning", () => {
    const options = { speed: 40, spin: { rate: 0, axis: { x: 1, y: 0, z: 0 } }, gravity: 10 }
    const state = flightAt(0.5, options)
    expect(state.position.z).toBeCloseTo(-20, 9)
    expect(state.position.y).toBeCloseTo(-1.25, 9)
    expect(state.break).toBeCloseTo(0, 9)
  })

  it("breaks each pitch the way its own spin says it should", () => {
    const at = (pitch: PitchName) => flightAt(0.42, { speed: 38, spin: pitchSpin(pitch) })
    const dead = flightAt(0.42, { speed: 38, spin: { rate: 0, axis: { x: 1, y: 0, z: 0 } } })

    // Backspin holds a fastball up; topspin drives a curveball down.
    expect(at("fastball").position.y).toBeGreaterThan(dead.position.y)
    expect(at("curveball").position.y).toBeLessThan(dead.position.y)
    // A slider's axis stands up, so its break is sideways rather than vertical.
    expect(Math.abs(at("slider").position.x)).toBeGreaterThan(Math.abs(at("fastball").position.x))
    // A knuckler barely turns, so there is almost nothing to break it.
    expect(at("knuckler").break).toBeLessThan(at("fastball").break * 0.1)
  })

  it("counts the turns the seams have to follow", () => {
    expect(flightAt(2, { spin: { rate: 12, axis: { x: 1, y: 0, z: 0 } } }).turns).toBeCloseTo(24, 9)
  })

  it("rolls without slipping", () => {
    expect(rollTurns(2 * Math.PI * 7, 7)).toBeCloseTo(1, 9)
    expect(Number.isFinite(rollTurns(10, 0))).toBe(true)
  })
})

describe("sport-geometry — the slide", () => {
  const options = { speed: 30, friction: 0.05, gravity: 10, bounces: 0, heading: 0 }

  it("stops exactly where v squared over 2 mu g says", () => {
    const track = slideTrack({ ...options, rink: { halfWidth: 1e6, halfLength: 1e6 } })
    expect(track.deceleration).toBeCloseTo(0.5, 9)
    expect(track.distance).toBeCloseTo(900, 6)
    expect(track.duration).toBeCloseTo(60, 6)
    expect(slideAt(track, 1e4).speed).toBe(0)
  })

  it("slows at a constant rate whatever the speed", () => {
    const track = slideTrack({ ...options, rink: { halfWidth: 1e6, halfLength: 1e6 } })
    expect(slideAt(track, 10).speed).toBeCloseTo(25, 6)
    expect(slideAt(track, 20).speed).toBeCloseTo(20, 6)
  })

  it("reflects off the boards and loses e of the speed doing it", () => {
    const track = slideTrack({
      speed: 30,
      friction: 0.05,
      gravity: 10,
      heading: 0,
      board: 0.5,
      bounces: 2,
      start: { x: 0, y: 0 },
      rink: { halfWidth: 40, halfLength: 60 },
    })
    expect(track.legs.length).toBeGreaterThan(1)
    // Heading flips about the board it hit.
    expect(Math.abs(track.legs[1].heading)).toBeCloseTo(180, 6)
    // A board takes e of the speed, so e² of the distance that was left.
    const first = track.legs[0]
    const carried = Math.sqrt(first.speed ** 2 - 2 * track.deceleration * first.length)
    expect(track.legs[1].speed).toBeCloseTo(carried * 0.5, 6)
  })

  it("keeps the puck inside the boards for the whole slide", () => {
    const track = slideTrack({
      speed: 60,
      friction: 0.02,
      gravity: 10,
      heading: 34,
      bounces: 6,
      rink: { halfWidth: 40, halfLength: 60 },
    })
    for (let index = 0; index <= 200; index += 1) {
      const state = slideAt(track, (track.duration * index) / 200)
      expect(Math.abs(state.point.x)).toBeLessThanOrEqual(40 + 1e-6)
      expect(Math.abs(state.point.y)).toBeLessThanOrEqual(60 + 1e-6)
    }
  })

  it("turns the puck in proportion to how far it has come, boards and all", () => {
    const track = slideTrack({
      speed: 60,
      friction: 0.02,
      gravity: 10,
      heading: 34,
      bounces: 6,
      rink: { halfWidth: 40, halfLength: 60 },
    })
    // Spin bleeds with the speed, so the turns are the distance, scaled.
    const end = slideAt(track, track.duration * 2, 2)
    expect(end.turns).toBeCloseTo((2 * track.distance) / 60, 6)
    // And it only ever goes one way.
    let last = -1
    for (let index = 0; index <= 60; index += 1) {
      const turns = slideAt(track, (track.duration * index) / 60, 2).turns
      expect(turns).toBeGreaterThanOrEqual(last)
      last = turns
    }
  })

  it("degrades rather than throwing on rubbish", () => {
    const track = slideTrack({ speed: Number.NaN, friction: Number.NaN, bounces: Number.NaN })
    const state = slideAt(track, Number.NaN)
    expect(Number.isFinite(state.point.x) && Number.isFinite(state.point.y)).toBe(true)
    expect(Number.isFinite(state.turns)).toBe(true)
  })
})

describe("sport-geometry — the bat", () => {
  it("recovers the elastic wall when the bat is infinitely heavy", () => {
    const heavy = { ...defaultBat, mass: 1e9, moment: 1e12, centre: 40 }
    const result = swingImpact({
      bat: heavy,
      contact: 40,
      swingRate: 1 / (2 * Math.PI),
      pitchSpeed: 30,
      restitution: 1,
    })
    // v_bat = ω·r = 40 here, so v_out → v_pitch + 2·v_bat.
    expect(result.batSpeed).toBeCloseTo(40, 6)
    expect(result.exitSpeed).toBeCloseTo(30 + 80, 3)
  })

  it("gives the whole bat at the centre of mass and almost none at the tip", () => {
    expect(effectiveMass(defaultBat, defaultBat.centre)).toBeCloseTo(defaultBat.mass, 9)
    expect(effectiveMass(defaultBat, defaultBat.length)).toBeLessThan(defaultBat.mass)
    expect(effectiveMass(defaultBat, 0)).toBeLessThan(effectiveMass(defaultBat, defaultBat.centre))
  })

  it("finds a sweet spot out past the centre of mass but short of the tip", () => {
    const best = sweetSpot({ swingRate: 5, pitchSpeed: 38 })
    expect(best.contact).toBeGreaterThan(defaultBat.centre)
    expect(best.contact).toBeLessThan(defaultBat.length)
    // Nothing on the barrel beats it, which is what makes it the sweet spot.
    for (const contact of [40, 50, 60, 70, 80, 86]) {
      expect(swingImpact({ contact, swingRate: 5, pitchSpeed: 38 }).exitSpeed).toBeLessThanOrEqual(
        best.exitSpeed + 1e-9,
      )
    }
  })

  it("reports contact off the end as less than its best", () => {
    const best = sweetSpot({ swingRate: 5, pitchSpeed: 38 })
    expect(swingImpact({ contact: best.contact, swingRate: 5, pitchSpeed: 38 }).sweetness).toBeCloseTo(1, 6)
    expect(swingImpact({ contact: 30, swingRate: 5, pitchSpeed: 38 }).sweetness).toBeLessThan(0.9)
  })

  it("sweeps a swing that passes through the zone once per cycle", () => {
    expect(swingAngle(0)).toBeCloseTo(-120, 6)
    expect(swingAngle(1)).toBeCloseTo(swingAngle(2), 9)
    expect(swingAngle(0.2)).toBeLessThan(swingAngle(0.52))
    expect(swingAngle(0.52)).toBeLessThan(swingAngle(0.9))
    expect(swingAngle(Number.NaN)).toBeCloseTo(-120, 6)
  })

  it("keeps the barrel profile inside its own dimensions", () => {
    for (let index = 0; index <= 20; index += 1) {
      const radius = barrelRadius(defaultBat, index / 20)
      expect(radius).toBeGreaterThan(0)
      expect(radius).toBeLessThanOrEqual(defaultBat.barrel + 1e-9)
    }
  })
})

describe("sport-geometry — the contact pulse", () => {
  const options = { drop: 100, restitution: 0.7, gravity: 10, contact: 0.2 }
  const fall = Math.sqrt(20)

  it("peaks at an impact and falls away either side of it", () => {
    expect(bounceAt(fall, options).contact).toBeCloseTo(1, 6)
    // Squash builds on the way in and releases on the way out, not one or the other.
    expect(bounceAt(fall - 0.1, options).contact).toBeCloseTo(0.5, 6)
    expect(bounceAt(fall + 0.1, options).contact).toBeCloseTo(0.5, 6)
    // And there is none of it in the middle of a flight.
    expect(bounceAt(fall * 0.5, options).contact).toBe(0)
  })
})
