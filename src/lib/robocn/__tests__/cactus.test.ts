import { describe, expect, it } from "vitest"

import {
  areoleSites,
  cactusBearing,
  corollaPetals,
  limbPoint,
  limbRing,
  ribCrest,
  ribFactor,
  ribRoll,
  rollToward,
  skinNormal,
  solveCactusLimb,
  spineFan,
  stationAt,
} from "@/lib/robocn/cactus"
import type { Vec3 } from "@/lib/robocn/kinematics"

const gap = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const size = (a: Vec3) => Math.hypot(a.x, a.y, a.z)

describe("the limb", () => {
  it("is exactly as long bent as it was straight", () => {
    // The whole reason the angle is integrated and the joints are walked.
    for (const sweep of [0, 20, 88, 180, -60]) {
      for (const elbow of [0.1, 0.34, 0.8]) {
        const limb = solveCactusLimb({
          length: 54,
          segments: 12,
          emergence: 88,
          sweep,
          elbow,
          spread: 0.2,
        })
        const run = limb.stations
          .slice(1)
          .reduce((total, station, index) => total + gap(station.centre, limb.stations[index].centre), 0)
        expect(run).toBeCloseTo(54, 6)
        // And every link the same, not just the total.
        const links = limb.stations
          .slice(1)
          .map((station, index) => gap(station.centre, limb.stations[index].centre))
        expect(Math.max(...links) - Math.min(...links)).toBeLessThan(1e-9)
      }
    }
  })

  it("ends vertical when the sweep takes back the emergence, whatever the elbow", () => {
    for (const elbow of [0.05, 0.34, 0.7, 0.95]) {
      const limb = solveCactusLimb({ emergence: 88, sweep: 88, elbow, spread: 0.25 })
      expect(limb.tip.angle).toBeCloseTo(0, 9)
      expect(limb.tip.tangent.y).toBeCloseTo(1, 9)
      // And it left the base flat, which is what makes it an elbow.
      expect(limb.base.angle).toBeCloseTo(88, 9)
    }
  })

  it("carries an orthonormal frame, with the binormal constant along it", () => {
    const limb = solveCactusLimb({ emergence: 90, sweep: 90, bearing: 37 })
    for (const station of limb.stations) {
      expect(size(station.tangent)).toBeCloseTo(1, 9)
      expect(size(station.normal)).toBeCloseTo(1, 9)
      expect(size(station.binormal)).toBeCloseTo(1, 9)
      const dot =
        station.tangent.x * station.normal.x +
        station.tangent.y * station.normal.y +
        station.tangent.z * station.normal.z
      expect(dot).toBeCloseTo(0, 9)
      // One bending plane means one binormal: a rib cannot drift round the limb.
      expect(gap(station.binormal, limb.base.binormal)).toBeCloseTo(0, 9)
    }
  })

  it("bends in the plane of its bearing, and nowhere else", () => {
    const limb = solveCactusLimb({ emergence: 70, sweep: 40, bearing: 120, length: 60 })
    const out = cactusBearing(120)
    for (const station of limb.stations) {
      // Everything off the vertical is along the bearing: no sideways drift.
      const across = station.centre.x * out.z - station.centre.z * out.x
      expect(across).toBeCloseTo(0, 9)
    }
  })

  it("interpolates a station and keeps the frame orthonormal there", () => {
    const limb = solveCactusLimb({ emergence: 88, sweep: 88, length: 50 })
    const mid = stationAt(limb, 0.47)
    expect(size(mid.tangent)).toBeCloseTo(1, 9)
    expect(mid.distance).toBeCloseTo(0.47 * 50, 0)
    expect(stationAt(limb, 0).centre).toEqual(limb.base.centre)
    expect(gap(stationAt(limb, 1).centre, limb.tip.centre)).toBeCloseTo(0, 9)
    expect(Number.isFinite(stationAt(limb, Number.NaN).radius)).toBe(true)
  })

  it("degrades rather than throws on broken input", () => {
    const limb = solveCactusLimb({
      length: Number.NaN,
      segments: Number.NaN,
      emergence: Number.POSITIVE_INFINITY,
      sweep: Number.NaN,
      radius: () => Number.NaN,
    })
    expect(limb.stations.every((s) => Number.isFinite(s.centre.x) && Number.isFinite(s.radius))).toBe(true)
  })
})

describe("the skin", () => {
  it("puts a crest at every 360/ribs and a furrow between them", () => {
    expect(ribFactor(0, 12, 0.3)).toBeCloseTo(1, 9)
    expect(ribFactor(30, 12, 0.3)).toBeCloseTo(1, 9)
    expect(ribFactor(15, 12, 0.3)).toBeCloseTo(0.7, 9)
    // Too few ribs, or no depth, and it is round.
    expect(ribFactor(15, 1, 0.3)).toBe(1)
    expect(ribFactor(15, 12, 0)).toBe(1)
    expect(ribFactor(Number.NaN, 12, 0.3)).toBeCloseTo(1, 9)
  })

  it("draws a crest as a line on the surface, at the full radius", () => {
    const limb = solveCactusLimb({ emergence: 0, sweep: -12, length: 100, radius: () => 10 })
    const ribs = { ribs: 9, depth: 0.25, roll: 0 }
    const crest = ribCrest(limb, 3, ribs)
    expect(crest).toHaveLength(limb.stations.length)
    crest.forEach((point, index) => {
      // Every crest point stands exactly the radius off its own centreline.
      expect(gap(point, limb.stations[index].centre)).toBeCloseTo(10, 6)
    })
    // A point between crests is inside it.
    const furrow = limbPoint(limb.base, ribRoll(3, 9) + 20, ribs)
    expect(gap(furrow, limb.base.centre)).toBeLessThan(10)
  })

  it("keeps the ring closed and every point inside the radius", () => {
    const limb = solveCactusLimb({ radius: () => 8 })
    const ring = limbRing(limb.base, { ribs: 11, depth: 0.4, steps: 33 })
    expect(ring).toHaveLength(33)
    for (const point of ring) {
      const reach = gap(point, limb.base.centre)
      expect(reach).toBeLessThanOrEqual(8 + 1e-9)
      // Never inside the deepest furrow the modulation can cut.
      expect(reach).toBeGreaterThanOrEqual(8 * (1 - 0.4) - 1e-9)
    }
  })

  it("leans the normal up the taper as the limb narrows", () => {
    // A column that narrows toward the crown: the skin there faces up and out.
    const limb = solveCactusLimb({
      emergence: 0,
      sweep: 0,
      length: 100,
      radius: (s) => 14 - 10 * s,
    })
    const waist = skinNormal(limb, 0.5, 0)
    const crown = skinNormal(limb, 0.95, 0)
    expect(size(crown)).toBeCloseTo(1, 9)
    expect(crown.y).toBeGreaterThan(waist.y)
    expect(crown.y).toBeGreaterThan(0)
    // A straight-sided limb has no lean to take: the normal is purely radial.
    const straight = solveCactusLimb({ emergence: 0, sweep: 0, radius: () => 10 })
    expect(skinNormal(straight, 0.5, 0).y).toBeCloseTo(0, 6)
  })
})

describe("what grows on it", () => {
  it("lays areoles on the crests, staggered on alternate ribs", () => {
    const limb = solveCactusLimb({ length: 100, radius: () => 10 })
    const ribs = { ribs: 8, depth: 0.2, roll: 0 }
    const pads = areoleSites(limb, { ...ribs, perRib: 5, from: 0.1, to: 0.9 })
    expect(pads).toHaveLength(40)
    for (const pad of pads) {
      expect(pad.roll).toBeCloseTo(ribRoll(pad.rib, 8), 9)
      // On the crest means at the full radius.
      expect(gap(pad.position, stationAt(limb, pad.s).centre)).toBeCloseTo(10, 6)
      expect(size(pad.normal)).toBeCloseTo(1, 9)
    }
    const even = pads.filter((pad) => pad.rib === 0).map((pad) => pad.s)
    const odd = pads.filter((pad) => pad.rib === 1).map((pad) => pad.s)
    expect(odd[0]).toBeGreaterThan(even[0])
    // Evenly spaced within a rib, which is what "by arc" means here.
    const steps = even.slice(1).map((s, index) => s - even[index])
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(1e-9)
  })

  it("takes no areoles when there is nothing to put them on", () => {
    const limb = solveCactusLimb()
    expect(areoleSites(limb, { ribs: 0, perRib: 4 })).toEqual([])
    expect(areoleSites(limb, { ribs: 8, perRib: 0 })).toEqual([])
  })

  it("fans rigid needles on a cone about the pad's own normal", () => {
    const limb = solveCactusLimb({ length: 100, radius: () => 10 })
    const [pad] = areoleSites(limb, { ribs: 8, depth: 0.2, perRib: 1 })
    const fan = spineFan(pad, { count: 7, length: 5, spread: 60, centre: true })
    expect(fan).toHaveLength(8)
    for (const needle of fan) {
      expect(gap(needle.root, needle.tip)).toBeCloseTo(5, 9)
      expect(needle.root).toEqual(pad.position)
    }
    const angle = (needle: (typeof fan)[number]) => {
      const direction = {
        x: (needle.tip.x - needle.root.x) / 5,
        y: (needle.tip.y - needle.root.y) / 5,
        z: (needle.tip.z - needle.root.z) / 5,
      }
      const dot =
        direction.x * pad.normal.x + direction.y * pad.normal.y + direction.z * pad.normal.z
      return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI
    }
    // The centre needle stands straight out; the rest sit exactly on the cone.
    expect(angle(fan[0])).toBeCloseTo(0, 6)
    for (const needle of fan.slice(1)) expect(angle(needle)).toBeCloseTo(60, 6)
  })
})

describe("the corolla", () => {
  it("keeps every petal rigid at every pitch", () => {
    const limb = solveCactusLimb({ length: 100, radius: () => 4 })
    for (const pitch of [-10, 0, 45, 84]) {
      const petals = corollaPetals(12, limb.tip, {
        radius: 3,
        length: 13,
        width: 5,
        pitch,
        rise: 2,
      })
      expect(petals).toHaveLength(12)
      for (const petal of petals) expect(gap(petal.root, petal.tip)).toBeCloseTo(13, 9)
    }
  })

  it("shuts into a bud that is taller than it is wide, and opens past flat", () => {
    const limb = solveCactusLimb({ length: 100, radius: () => 4 })
    const options = { radius: 3, length: 13, width: 5, rise: 2 }
    const shut = corollaPetals(12, limb.tip, { ...options, pitch: 78 })
    const wide = corollaPetals(12, limb.tip, { ...options, pitch: -6 })
    const spread = (petals: typeof shut) =>
      Math.max(...petals.map((petal) => Math.hypot(petal.tip.x, petal.tip.z)))
    const height = (petals: typeof shut) => Math.max(...petals.map((petal) => petal.tip.y))
    expect(spread(wide)).toBeGreaterThan(spread(shut) * 2)
    expect(height(shut)).toBeGreaterThan(height(wide))
    expect(corollaPetals(0, limb.tip, options)).toEqual([])
  })
})

describe("seating an arm on a column", () => {
  it("reports the roll on the limb that faces a world azimuth", () => {
    const column = solveCactusLimb({ emergence: 0, sweep: 0, bearing: 0, radius: () => 10 })
    for (const azimuth of [0, 64, -116, 172]) {
      const roll = rollToward(column.base, azimuth)
      const seat = limbPoint(column.base, roll, { ribs: 0, depth: 0 })
      const out = cactusBearing(azimuth)
      // The seat is exactly where that bearing leaves the column.
      expect(seat.x).toBeCloseTo(out.x * 10, 6)
      expect(seat.z).toBeCloseTo(out.z * 10, 6)
    }
  })
})
