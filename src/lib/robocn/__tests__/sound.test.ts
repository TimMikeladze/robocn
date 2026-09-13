import { describe, expect, it } from "vitest"

import { distance2 } from "@/lib/robocn/kinematics"
import {
  barrelStep,
  combLift,
  combRelease,
  combTines,
  flareRate,
  governorPose,
  grooveProgress,
  groovePose,
  grooveSpiralPath,
  grooveTurns,
  hornProfile,
  hornRadius,
  pinBarrel,
  tonearmNulls,
  tonearmPose,
  type TonearmGeometry,
} from "@/lib/robocn/sound"

/** A nine-inch arm set up the way one actually is, in millimetres. */
const arm: TonearmGeometry = { mounting: 220.3, effective: 239.3, offset: 24.2 }
const record = { outer: 146, inner: 60, pitch: 0.12 }

describe("groovePose", () => {
  it("gears the stylus to the platter: one pitch inward per revolution", () => {
    const turns = grooveTurns(record)
    expect(turns).toBeCloseTo((146 - 60) / 0.12, 6)

    const start = groovePose(0, record)
    const end = groovePose(1, record)
    expect(start.radius).toBeCloseTo(146, 6)
    expect(end.radius).toBeCloseTo(60, 6)
    expect(end.revolutions).toBeCloseTo(turns, 6)
    expect(start.remaining).toBeCloseTo(turns, 6)

    // One revolution in is exactly one groove pitch in.
    const oneTurn = groovePose(1 / turns, record)
    expect(146 - oneTurn.radius).toBeCloseTo(0.12, 6)
  })

  it("walks monotonically inward and inverts back to the same progress", () => {
    let previous = Number.POSITIVE_INFINITY
    for (let at = 0; at <= 1; at += 0.05) {
      const pose = groovePose(at, record)
      expect(pose.radius).toBeLessThan(previous)
      expect(grooveProgress(pose.radius, record)).toBeCloseTo(at, 6)
      previous = pose.radius
    }
  })

  it("clamps the run and stays neutral on nonsense", () => {
    expect(groovePose(4, record).progress).toBe(1)
    expect(groovePose(-2, record).progress).toBe(0)
    expect(groovePose(Number.NaN, record).progress).toBe(0)
    expect(grooveTurns({ outer: 10, inner: 20, pitch: 0 })).toBe(0)
    expect(grooveSpiralPath(record, 3, 8)).toMatch(/^M /)
    expect(grooveSpiralPath(record, 0)).toBe("")
    expect(grooveSpiralPath(record, 3, 8)).not.toMatch(/NaN/)
  })
})

describe("tonearmPose", () => {
  it("keeps the arm's own length at every radius it can reach", () => {
    for (let radius = 60; radius <= 146; radius += 2) {
      const pose = tonearmPose(radius, arm)
      expect(distance2(pose.pivot, pose.stylus)).toBeCloseTo(arm.effective, 6)
      expect(distance2({ x: 0, y: 0 }, pose.stylus)).toBeCloseTo(radius, 6)
      expect(pose.offGroove).toBe(false)
    }
    expect(tonearmPose(60, arm).overhang).toBeCloseTo(19, 6)
  })

  it("swings the arm outward as the groove radius grows", () => {
    expect(tonearmPose(60, arm).angle).toBeLessThan(tonearmPose(146, arm).angle)
  })

  it("nulls exactly twice and holds the error under two degrees between", () => {
    const nulls = tonearmNulls(arm, 60, 146)
    expect(nulls).toHaveLength(2)
    for (const radius of nulls) {
      expect(radius).toBeGreaterThan(60)
      expect(radius).toBeLessThan(146)
      expect(Math.abs(tonearmPose(radius, arm).trackingError)).toBeLessThan(1e-6)
    }
    // Between the nulls the cartridge leans the other way, which is the point.
    const between = tonearmPose((nulls[0]! + nulls[1]!) / 2, arm).trackingError
    expect(between).toBeLessThan(0)
    for (let radius = 60; radius <= 146; radius += 1) {
      expect(Math.abs(tonearmPose(radius, arm).trackingError)).toBeLessThan(2)
    }
  })

  it("reports an arm set up badly rather than hiding it", () => {
    // No overhang and no offset: the classic acoustic arm, and it is awful.
    const acoustic: TonearmGeometry = { mounting: 200, effective: 200, offset: 0 }
    expect(tonearmNulls(acoustic, 60, 146)).toHaveLength(0)
    expect(Math.abs(tonearmPose(60, acoustic).trackingError)).toBeGreaterThan(5)
  })

  it("clamps a radius the arm cannot reach and says so", () => {
    const short: TonearmGeometry = { mounting: 100, effective: 40, offset: 20 }
    const pose = tonearmPose(10, short)
    expect(pose.offGroove).toBe(true)
    expect(pose.radius).toBeCloseTo(60, 6)
    expect(Number.isFinite(pose.stylus.x)).toBe(true)
  })

  it("stays neutral on nonsense", () => {
    const pose = tonearmPose(Number.NaN, { mounting: Number.NaN, effective: Number.NaN, offset: Number.NaN })
    expect(Number.isFinite(pose.angle)).toBe(true)
    expect(Number.isFinite(pose.stylus.y)).toBe(true)
    expect(Number.isFinite(pose.trackingError)).toBe(true)
  })
})

describe("hornProfile", () => {
  it("doubles its area over a constant distance along the axis", () => {
    const horn = { throat: 6, mouth: 48, length: 90 }
    expect(hornRadius(0, horn)).toBeCloseTo(6, 6)
    expect(hornRadius(90, horn)).toBeCloseTo(48, 6)

    // Exponential: equal axial steps multiply the area by the same factor.
    const double = Math.LN2 / 2 / flareRate(horn)
    for (const along of [0, 20, 40]) {
      const grown = hornRadius(along + double, horn) ** 2
      expect(grown / hornRadius(along, horn) ** 2).toBeCloseTo(2, 6)
    }
    // A cone is a different machine: the radius, not the area, is linear.
    const cone = { throat: 6, mouth: 48, length: 90, flare: "conical" as const }
    expect(hornRadius(45, cone)).toBeCloseTo(27, 6)
    expect(hornRadius(45, horn)).toBeLessThan(27)
    expect(flareRate(cone)).toBe(0)
  })

  it("samples throat to mouth, monotonically, and survives nonsense", () => {
    const sections = hornProfile({ throat: 6, mouth: 48, length: 90 }, 10)
    expect(sections).toHaveLength(10)
    expect(sections[0]!.along).toBe(0)
    expect(sections.at(-1)!.radius).toBeCloseTo(48, 6)
    sections.forEach((section, index) => {
      if (index) expect(section.radius).toBeGreaterThan(sections[index - 1]!.radius)
    })
    const broken = hornProfile({ throat: Number.NaN, mouth: 0, length: Number.NaN })
    expect(broken.every((section) => Number.isFinite(section.radius))).toBe(true)
  })
})

describe("governorPose", () => {
  it("holds the speed while the spring has torque and sags once it does not", () => {
    expect(governorPose(1).speed).toBe(1)
    expect(governorPose(0.5).speed).toBe(1)
    expect(governorPose(0.3).speed).toBeCloseTo(1, 6)
    expect(governorPose(0.15).speed).toBeCloseTo(0.5, 6)
    expect(governorPose(0).speed).toBe(0)
    expect(governorPose(0).stalled).toBe(true)
    expect(governorPose(0.15).governing).toBe(false)
  })

  it("stands the flyweights out with the square of the speed, up to the stop", () => {
    expect(governorPose(0.15).spread).toBeCloseTo(0.25, 6)
    expect(governorPose(0.075).spread).toBeCloseTo(0.0625, 6)
    expect(governorPose(1).spread).toBe(1)
    expect(governorPose(1).angle).toBeCloseTo(46, 6)
    expect(governorPose(0).angle).toBeCloseTo(8, 6)
    expect(governorPose(Number.NaN).speed).toBe(0)
  })
})

describe("combTines", () => {
  it("tunes by length: an octave up is one over root two", () => {
    const tines = combTines(15, { longest: 40 })
    expect(tines[0]!.length).toBeCloseTo(40, 6)
    expect(tines[0]!.semitones).toBe(0)
    // Seven diatonic degrees to the octave, so tine 7 is 12 semitones up.
    expect(tines[7]!.semitones).toBe(12)
    expect(tines[7]!.length).toBeCloseTo(40 / Math.SQRT2, 6)
    expect(tines[14]!.length).toBeCloseTo(40 / 2, 6)
    tines.forEach((tine, index) => {
      if (index) expect(tine.length).toBeLessThan(tines[index - 1]!.length)
    })
  })

  it("takes a scale, and nothing at all, without complaining", () => {
    expect(combTines(4, { scale: [0, 7] })[2]!.semitones).toBe(12)
    expect(combTines(4, { scale: [0, 7] })[3]!.semitones).toBe(19)
    expect(combTines(0)).toHaveLength(0)
    expect(combTines(Number.NaN)).toHaveLength(0)
  })
})

describe("pinBarrel", () => {
  const barrel = pinBarrel(["x...x...", "..x...x.", "........"])

  it("reads the pattern as pins and ignores the blanks", () => {
    expect(barrel.steps).toBe(8)
    expect(barrel.tines).toBe(3)
    expect(barrel.pins).toHaveLength(4)
    expect(barrel.pins[0]).toEqual({ tine: 0, step: 0, angle: 0 })
    expect(barrel.pins[2]).toEqual({ tine: 1, step: 2, angle: 90 })
    expect(barrel.pins.some((pin) => pin.tine === 2)).toBe(false)
  })

  it("lifts a tine as the pin comes round, then lets go", () => {
    // Full lift exactly at the pin, and free immediately after it: the pluck.
    expect(combLift(barrel, 0, 4)).toBeCloseTo(1, 6)
    expect(combLift(barrel, 0, 4.01)).toBe(0)
    expect(combLift(barrel, 0, 3.65)).toBeCloseTo(0.5, 6)
    expect(combLift(barrel, 0, 2)).toBe(0)
    // A tine with no pins never moves, however far the barrel turns.
    expect(combLift(barrel, 2, 4)).toBe(0)
    // And the barrel wraps: turn after turn hits the same pins.
    expect(combLift(barrel, 0, 4 + 8 * 3)).toBeCloseTo(1, 6)
    expect(combLift(barrel, 0, -8 + 4)).toBeCloseTo(1, 6)
  })

  it("rings the tine down after the release", () => {
    expect(combRelease(barrel, 1, 2)).toBeCloseTo(1, 6)
    expect(combRelease(barrel, 1, 3)).toBeCloseTo(0.5, 6)
    expect(combRelease(barrel, 1, 4.5)).toBe(0)
    expect(combRelease(barrel, 2, 2)).toBe(0)
  })

  it("reports the step under the comb, and survives an empty pattern", () => {
    expect(barrelStep(barrel, 3.7)).toBe(3)
    expect(barrelStep(barrel, 11.2)).toBe(3)
    expect(barrelStep(barrel, -0.5)).toBe(7)
    expect(barrelStep(barrel, Number.NaN)).toBe(0)

    const empty = pinBarrel([])
    expect(empty.steps).toBe(0)
    expect(combLift(empty, 0, 2)).toBe(0)
    expect(barrelStep(empty, 3)).toBe(0)
  })
})
