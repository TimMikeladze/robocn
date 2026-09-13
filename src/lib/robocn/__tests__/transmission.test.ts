import { describe, expect, it } from "vitest"

import {
  beltLayout,
  beltSample,
  carrierLinks,
  gearPath,
  meshAngle,
  planetaryPose,
  planetaryTrain,
} from "@/lib/robocn/transmission"

/** Two angles are the same mesh phase if they differ by whole teeth. */
const samePhase = (a: number, b: number, teeth: number) => {
  const pitch = 360 / teeth
  const gap = (((a - b) % pitch) + pitch) % pitch
  return Math.min(gap, pitch - gap)
}

describe("gear geometry", () => {
  it("draws one closed outline per tooth and clamps absurd counts", () => {
    const path = gearPath(12, 30)
    // Four corners per tooth, one move, the rest lines.
    expect(path.match(/L /g)).toHaveLength(12 * 4 - 1)
    expect(path.endsWith("Z")).toBe(true)
    expect(gearPath(2, 30).match(/L /g)).toHaveLength(6 * 4 - 1)
    expect(gearPath(NaN, NaN)).not.toMatch(/NaN/)
  })

  it("cuts a ring gear's teeth out of its rim", () => {
    const ring = gearPath(40, 60, { rim: 70 })
    expect(ring.match(/A /g)).toHaveLength(2)
    expect(ring.match(/Z/g)).toHaveLength(2)
  })
})

describe("meshing", () => {
  it("counter-rotates an external pair at the tooth ratio", () => {
    const before = meshAngle(12, 0, 36, 0)
    const after = meshAngle(12, 30, 36, 0)
    expect(after - before).toBeCloseTo(-30 * (12 / 36), 6)
  })

  it("puts a tooth of one gear into a space of the other at the line of centres", () => {
    // Driver presenting a tooth straight at the driven gear.
    const driven = meshAngle(12, 40, 20, 40)
    // The driven gear's own tooth nearest the contact is half a pitch away.
    expect(samePhase(driven, 40 + 180, 20)).toBeCloseTo(360 / 20 / 2, 6)
  })

  it("turns a ring the same way as the pinion running inside it", () => {
    const before = meshAngle(12, 0, 48, 0, true)
    const after = meshAngle(12, 24, 48, 0, true)
    expect(after - before).toBeCloseTo(24 * (12 / 48), 6)
  })
})

describe("planetary trains", () => {
  it("only returns tooth counts that assemble, and the ratio they give", () => {
    for (const planets of [3, 4, 5]) {
      for (let sun = 8; sun <= 40; sun += 1) {
        const train = planetaryTrain(sun, 13, planets)
        expect(train.ring).toBe(train.sun + 2 * train.planet)
        expect((train.sun + train.ring) % train.planets, `${sun}/${planets}`).toBe(0)
        expect(train.ratio).toBeCloseTo(1 + train.ring / train.sun, 9)
      }
    }
  })

  it("caps the planets so neighbours cannot overlap", () => {
    const train = planetaryTrain(10, 40, 5)
    const carrier = train.sun + train.planet
    // Centre spacing between neighbours, in tooth units, against their size.
    expect(2 * carrier * Math.sin(Math.PI / 5)).toBeGreaterThan(2 * train.planet)
  })

  it("holds the ring still while the sun drives the carrier down the ratio", () => {
    const train = planetaryTrain(18, 12, 3)
    const rest = planetaryPose(train, 0)
    for (const sun of [37, 90, -145, 720]) {
      const pose = planetaryPose(train, sun)
      expect(pose.carrier).toBeCloseTo(sun / train.ratio, 9)
      expect(samePhase(pose.ring, rest.ring, train.ring)).toBeCloseTo(0, 6)
    }
  })

  it("meshes every planet with the ring at the same phase", () => {
    const train = planetaryTrain(24, 16, 4)
    const pose = planetaryPose(train, 61)
    for (const planet of pose.planets) {
      const ring = meshAngle(train.planet, planet.angle, train.ring, planet.bearing, true)
      expect(samePhase(ring, pose.ring, train.ring)).toBeCloseTo(0, 6)
    }
  })

  it("survives nonsense", () => {
    const train = planetaryTrain(NaN, Infinity, 0)
    expect(Number.isFinite(train.ratio)).toBe(true)
    expect(Number.isFinite(planetaryPose(train, NaN).carrier)).toBe(true)
  })
})

describe("belts", () => {
  it("wraps two equal pulleys in the closed-form length", () => {
    const layout = beltLayout([
      { x: 0, y: 0, radius: 10 },
      { x: 60, y: 0, radius: 10 },
    ])
    expect(layout.length).toBeCloseTo(2 * 60 + 2 * Math.PI * 10, 6)
    expect(layout.wraps).toEqual([180, 180])
  })

  it("takes more wrap on the big pulley and less on the small one", () => {
    const layout = beltLayout([
      { x: 0, y: 0, radius: 20 },
      { x: 70, y: 0, radius: 8 },
    ])
    expect(layout.wraps[0]).toBeGreaterThan(180)
    expect(layout.wraps[1]).toBeLessThan(180)
    expect(layout.wraps[0] + layout.wraps[1]).toBeCloseTo(360, 6)
  })

  it("adds up: the segments are the length, whatever the pulley count", () => {
    const layout = beltLayout([
      { x: 0, y: 0, radius: 18 },
      { x: 80, y: 10, radius: 9 },
      { x: 40, y: 55, radius: 6 },
    ])
    const total = layout.segments.reduce((sum, segment) => sum + segment.length, 0)
    expect(total).toBeCloseTo(layout.length, 6)
    expect(layout.d.startsWith("M")).toBe(true)
  })

  it("samples a point on the belt, wrapping whole laps and rejecting nonsense", () => {
    const layout = beltLayout([
      { x: 0, y: 0, radius: 10 },
      { x: 60, y: 0, radius: 10 },
    ])
    const at = beltSample(layout, 12)
    expect(beltSample(layout, 12 + layout.length).x).toBeCloseTo(at.x, 6)
    expect(beltSample(layout, 12 + layout.length).y).toBeCloseTo(at.y, 6)
    expect(Number.isFinite(beltSample(layout, NaN).x)).toBe(true)
    // Every sample sits on a pulley or on a straight run between them.
    for (let d = 0; d < layout.length; d += 3) {
      const p = beltSample(layout, d)
      const near = Math.min(Math.hypot(p.x, p.y), Math.hypot(p.x - 60, p.y))
      expect(Math.abs(p.y)).toBeLessThanOrEqual(10.001)
      expect(near).toBeGreaterThanOrEqual(9.999)
    }
  })

  it("declines to route a belt round fewer than two pulleys", () => {
    expect(beltLayout([{ x: 0, y: 0, radius: 10 }]).length).toBe(0)
    expect(beltLayout([]).d).toBe("")
  })
})

describe("energy chain", () => {
  const geometry = { anchor: -60, span: 120, radius: 9, pitch: 7 }

  it("keeps its length and its link count at every travel", () => {
    const rest = carrierLinks(0, geometry)
    for (const travel of [0.25, 0.5, 0.75, 1]) {
      const pose = carrierLinks(travel, geometry)
      expect(pose.length).toBeCloseTo(rest.length, 9)
      expect(pose.links).toHaveLength(rest.links.length)
    }
  })

  it("moves the fold at half the carriage", () => {
    const a = carrierLinks(0.2, geometry)
    const b = carrierLinks(0.8, geometry)
    expect(b.bend - a.bend).toBeCloseTo((b.carriage - a.carriage) / 2, 6)
  })

  it("holds the pitch between neighbouring links right round the bend", () => {
    const { links } = carrierLinks(0.45, geometry)
    for (let i = 1; i < links.length; i += 1) {
      const gap = Math.hypot(links[i].x - links[i - 1].x, links[i].y - links[i - 1].y)
      // Chords across the bend are a little shorter than the arc pitch.
      expect(gap).toBeGreaterThan(geometry.pitch * 0.9)
      expect(gap).toBeLessThanOrEqual(geometry.pitch + 1e-6)
    }
  })

  it("runs the chain on two levels a bend apart and clamps invalid travel", () => {
    const pose = carrierLinks(2, geometry)
    expect(pose.carriage).toBeCloseTo(geometry.anchor + geometry.span, 9)
    const levels = pose.links.map((link) => link.y)
    expect(Math.min(...levels)).toBeCloseTo(-2 * geometry.radius, 1)
    expect(Math.max(...levels)).toBeCloseTo(0, 1)
    expect(carrierLinks(NaN, geometry).carriage).toBeCloseTo(geometry.anchor, 9)
  })
})
