import { describe, expect, it } from "vitest"

import {
  ackermann,
  axleRide,
  coordinatedBank,
  foilLift,
  foilRise,
  hitchAngle,
  pitchProgram,
  roadProfile,
  rollPoint,
  stackDeltaV,
  tsiolkovsky,
  wheelSolid,
} from "@/lib/robocn/vehicle"

const CAR = { wheelbase: 60, track: 34 }

describe("ackermann steering", () => {
  it("runs straight with no angle at all and an infinite radius", () => {
    const pose = ackermann(0, CAR)
    expect(pose.left).toBe(0)
    expect(pose.right).toBe(0)
    expect(pose.radius).toBe(Infinity)
    expect(pose.sign).toBe(0)
  })

  it("turns the inner wheel harder than the outer one", () => {
    const pose = ackermann(25, CAR)
    expect(pose.inner).toBeGreaterThan(25)
    expect(pose.outer).toBeLessThan(25)
    // Starboard turn: the off-side wheel is the inner one.
    expect(pose.right).toBeCloseTo(pose.inner, 6)
    expect(pose.left).toBeCloseTo(pose.outer, 6)
  })

  it("mirrors exactly about the straight-ahead position", () => {
    const right = ackermann(18, CAR)
    const left = ackermann(-18, CAR)
    expect(left.left).toBeCloseTo(-right.right, 6)
    expect(left.right).toBeCloseTo(-right.left, 6)
    expect(left.radius).toBeCloseTo(right.radius, 6)
  })

  it("puts the turn centre on the rear axle's line", () => {
    // radius = wheelbase / tan(steer) is the whole relation; check it holds.
    const pose = ackermann(30, CAR)
    expect(pose.radius).toBeCloseTo(60 / Math.tan(Math.PI / 6), 6)
  })

  it("gives both wheels the same angle when there is no track at all", () => {
    const pose = ackermann(20, { wheelbase: 60, track: 0 })
    expect(pose.inner).toBeCloseTo(20, 6)
    expect(pose.outer).toBeCloseTo(20, 6)
  })

  it("is neutral for nonsense input rather than throwing", () => {
    expect(ackermann(Number.NaN, CAR).left).toBe(0)
    const broken = ackermann(20, { wheelbase: Number.NaN, track: Number.NaN })
    expect(Number.isFinite(broken.inner)).toBe(true)
    expect(Number.isFinite(broken.outer)).toBe(true)
  })
})

describe("articulation", () => {
  const tractor = { wheelbase: 58, track: 30, hitch: 12 }

  it("trails straight behind when the tractor is straight", () => {
    expect(hitchAngle(0, tractor, 40)).toBe(0)
  })

  it("bends further the harder the tractor turns, and takes its sign", () => {
    const gentle = hitchAngle(10, tractor, 40)
    const hard = hitchAngle(30, tractor, 40)
    expect(gentle).toBeGreaterThan(0)
    expect(hard).toBeGreaterThan(gentle)
    expect(hitchAngle(-30, tractor, 40)).toBeCloseTo(-hard, 6)
  })

  it("bends further behind a shorter towed section", () => {
    expect(hitchAngle(20, tractor, 24)).toBeLessThan(hitchAngle(20, tractor, 44))
  })

  it("stays finite past the jackknife", () => {
    const folded = hitchAngle(60, tractor, 200)
    expect(Number.isFinite(folded)).toBe(true)
    expect(Math.abs(folded)).toBeLessThanOrEqual(180)
  })
})

describe("coordinated bank", () => {
  it("is wings level in a straight line", () => {
    expect(coordinatedBank(80, Infinity)).toBe(0)
    expect(coordinatedBank(0, 500)).toBe(0)
  })

  it("banks with the square of the speed", () => {
    // tan doubles four times over when the speed doubles.
    const slow = Math.tan((coordinatedBank(50, 400) * Math.PI) / 180)
    const fast = Math.tan((coordinatedBank(100, 400) * Math.PI) / 180)
    expect(fast / slow).toBeCloseTo(4, 6)
  })

  it("banks less in a wider turn", () => {
    expect(coordinatedBank(80, 900)).toBeLessThan(coordinatedBank(80, 300))
  })
})

describe("a body on its axles", () => {
  it("sits level on a level surface", () => {
    const ride = axleRide(() => 3, [-20, 20])
    expect(ride.heave).toBeCloseTo(3, 6)
    expect(ride.pitch).toBeCloseTo(0, 6)
    expect(ride.travel.every((value) => Math.abs(value) < 1e-9)).toBe(true)
  })

  it("pitches nose-up on a rising surface and absorbs nothing", () => {
    const ride = axleRide((x) => x * 0.25, [-20, 20])
    expect(ride.pitch).toBeCloseTo((Math.atan(0.25) * 180) / Math.PI, 6)
    expect(ride.travel.every((value) => Math.abs(value) < 1e-9)).toBe(true)
  })

  it("takes a bump between the axles as travel, not as body motion", () => {
    const ride = axleRide((x) => (x === 0 ? 6 : 0), [-20, 0, 20])
    expect(ride.pitch).toBeCloseTo(0, 6)
    expect(ride.travel[1]).toBeGreaterThan(0)
    // Least squares: the deflections sum to nothing.
    expect(ride.travel.reduce((total, value) => total + value, 0)).toBeCloseTo(0, 6)
  })

  it("handles one axle, and none", () => {
    expect(axleRide(() => 4, [10]).heave).toBeCloseTo(4, 6)
    expect(axleRide(() => 4, []).travel).toEqual([])
  })

  it("keeps the illustrative road finite for nonsense input", () => {
    expect(Number.isFinite(roadProfile(Number.NaN))).toBe(true)
    expect(Number.isFinite(roadProfile(10, 1, 0))).toBe(true)
  })
})

describe("the rocket equation", () => {
  it("is the logarithm of the mass ratio", () => {
    expect(tsiolkovsky(Math.E, 3000)).toBeCloseTo(3000, 6)
  })

  it("has nothing to give at or below a ratio of one", () => {
    expect(tsiolkovsky(1, 3000)).toBe(0)
    expect(tsiolkovsky(0.5, 3000)).toBe(0)
    expect(tsiolkovsky(Number.NaN, 3000)).toBe(0)
  })

  it("adds across the stages still attached", () => {
    const stages = [
      { massRatio: 3, exhaustVelocity: 2800 },
      { massRatio: 5, exhaustVelocity: 3400 },
    ]
    expect(stackDeltaV(stages)).toBeCloseTo(
      tsiolkovsky(3, 2800) + tsiolkovsky(5, 3400),
      6,
    )
    expect(stackDeltaV(stages.slice(1))).toBeLessThan(stackDeltaV(stages))
    expect(stackDeltaV([])).toBe(0)
  })

  it("flies the pitch program from vertical to horizontal, monotonically", () => {
    expect(pitchProgram(0)).toBe(0)
    expect(pitchProgram(1)).toBeCloseTo(90, 6)
    let previous = -1
    for (let step = 0; step <= 20; step += 1) {
      const pitch = pitchProgram(step / 20)
      expect(pitch).toBeGreaterThanOrEqual(previous)
      previous = pitch
    }
    expect(pitchProgram(Number.NaN)).toBe(0)
  })
})

describe("foils", () => {
  it("lifts with the square of speed", () => {
    expect(foilLift(10, 2) / foilLift(5, 2)).toBeCloseTo(4, 6)
    expect(foilLift(0, 2)).toBe(0)
  })

  it("stays hullborne below the takeoff speed", () => {
    expect(foilRise(4, 8)).toBe(0)
    expect(foilRise(8, 8)).toBe(0)
  })

  it("rises as the immersed area falls away with 1/v²", () => {
    expect(foilRise(16, 8)).toBeCloseTo(0.75, 6)
    expect(foilRise(24, 8)).toBeCloseTo(1 - 1 / 9, 6)
    expect(foilRise(1e6, 8)).toBeLessThanOrEqual(1)
    expect(foilRise(Number.NaN, 8)).toBe(0)
  })
})

describe("a steered wheel as a solid", () => {
  it("keeps its radius and its width whatever the steer", () => {
    const corners = wheelSolid({ x: 0, y: 10, z: 0 }, 10, 4, 30, 8)
    expect(corners).toHaveLength(16)
    for (const corner of corners) {
      // The disc is round about its own centre in the wheel's plane; the width
      // is the only thing that takes it off that circle.
      const radial = Math.hypot(corner.x, corner.y - 10, corner.z)
      expect(radial).toBeLessThanOrEqual(Math.hypot(10, 4) + 1e-9)
      expect(Number.isFinite(radial)).toBe(true)
    }
  })

  it("turns the wheel's plane about the vertical", () => {
    const straight = wheelSolid({ x: 0, y: 8, z: 0 }, 8, 3, 0, 8)
    const steered = wheelSolid({ x: 0, y: 8, z: 0 }, 8, 3, 35, 8)
    // Straight ahead the disc lies in the fore-aft plane, so nothing but the
    // width leaves x = 0. Steered, the rim itself does.
    expect(Math.max(...straight.map((c) => Math.abs(c.x)))).toBeCloseTo(3, 6)
    expect(Math.max(...steered.map((c) => Math.abs(c.x)))).toBeGreaterThan(3)
  })

  it("survives nonsense without producing NaN corners", () => {
    const corners = wheelSolid(
      { x: Number.NaN, y: Number.NaN, z: 0 },
      Number.NaN,
      Number.NaN,
      Number.NaN,
      4,
    )
    expect(corners.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y))).toBe(true)
  })
})

describe("rolling an elevation into the world", () => {
  it("is the identity drawing when nothing is banked", () => {
    const point = rollPoint({ x: 40, y: 12 }, 6, 0)
    expect(point).toEqual({ x: 6, y: 12, z: -40 })
  })

  it("puts the starboard side down for a positive bank", () => {
    const starboard = rollPoint({ x: 0, y: 0 }, 10, 30)
    expect(starboard.y).toBeLessThan(0)
    const port = rollPoint({ x: 0, y: 0 }, -10, 30)
    expect(port.y).toBeGreaterThan(0)
  })

  it("is a rigid rotation: every length survives it", () => {
    const a = rollPoint({ x: 0, y: 20 }, 12, 47, 14)
    const b = rollPoint({ x: 0, y: -8 }, -5, 47, 14)
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeCloseTo(
      Math.hypot(12 - -5, 20 - -8),
      6,
    )
  })

  it("never emits NaN for nonsense", () => {
    const point = rollPoint({ x: Number.NaN, y: Number.NaN }, Number.NaN, Number.NaN)
    expect(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)).toBe(true)
  })
})
