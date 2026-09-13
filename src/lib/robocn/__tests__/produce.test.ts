import { describe, expect, it } from "vitest"

import {
  bladeRing,
  goldenLattice,
  GOLDEN_ANGLE,
  halfShell,
  hingeRotate,
  lateralArea,
  latitudeRing,
  lobeFactor,
  meridianLine,
  profilePoint,
  revolveProfile,
  surfaceNormal,
  widestSection,
  type ProduceProfile,
} from "@/lib/robocn/produce"

/** A cylinder: equal area in equal parameter, so the lattice is easy to check. */
const cylinder: ProduceProfile = (t) => ({ height: 100 * t, radius: 20 })
/** A cone standing on its point: area grows with the square of the parameter. */
const cone: ProduceProfile = (t) => ({ height: 100 * t, radius: 30 * t })
/** A berry: wide shoulder, tapered tip, the shape the strawberry uses. */
const berry: ProduceProfile = (t) => ({
  height: 90 * t,
  radius: 34 * Math.pow(Math.sin(Math.PI * (0.06 + 0.44 * t)), 1.1),
})

const radiusOf = (point: { x: number; z: number }) => Math.hypot(point.x, point.z)

describe("surface of revolution", () => {
  it("puts every sample at the profile's own radius and height", () => {
    for (const ring of [0, 0.25, 0.5, 1]) {
      const section = berry(ring)
      for (const azimuth of [0, 37, 180, 305]) {
        const point = profilePoint(berry, ring, azimuth)
        expect(radiusOf(point)).toBeCloseTo(section.radius, 9)
        expect(point.y).toBeCloseTo(section.height, 9)
      }
    }
    const surface = revolveProfile(cylinder, { rings: 4, meridians: 8 })
    expect(surface).toHaveLength(5 * 8)
    for (const point of surface) expect(radiusOf(point)).toBeCloseTo(20, 9)
  })

  it("cuts furrows where the lobes say, and nowhere else", () => {
    expect(lobeFactor(0, 6, 0.2)).toBeCloseTo(1, 9)
    expect(lobeFactor(30, 6, 0.2)).toBeCloseTo(0.8, 9)
    expect(lobeFactor(60, 6, 0.2)).toBeCloseTo(1, 9)
    // No lobes, or no depth, is the plain surface.
    expect(lobeFactor(30, 0, 0.2)).toBe(1)
    expect(lobeFactor(30, 6, 0)).toBe(1)

    const lobed = profilePoint(cylinder, 0.5, 30, { lobes: 6, lobeDepth: 0.2 })
    expect(radiusOf(lobed)).toBeCloseTo(16, 9)
  })

  it("hands back closed latitudes, open meridians and the widest station", () => {
    expect(latitudeRing(berry, 0.4, {}, 12)).toHaveLength(12)
    expect(meridianLine(berry, 40, { rings: 6 })).toHaveLength(7)
    const widest = widestSection(berry)
    expect(widest.radius).toBeGreaterThan(berry(0).radius)
    expect(widest.radius).toBeGreaterThanOrEqual(berry(1).radius)
  })

  it("normals stand out of the skin and lean with the profile", () => {
    // Straight-sided: the normal is horizontal, and turns with the azimuth.
    const side = surfaceNormal(cylinder, 0.5, 90)
    expect(side.y).toBeCloseTo(0, 9)
    expect(side.x).toBeCloseTo(1, 6)
    // A cone flaring upward leans its normal down and out.
    const flare = surfaceNormal(cone, 0.5, 0)
    expect(flare.y).toBeLessThan(0)
    expect(flare.z).toBeGreaterThan(0)
    expect(Math.hypot(flare.x, flare.y, flare.z)).toBeCloseTo(1, 9)
  })
})

describe("golden lattice", () => {
  it("turns by the golden angle between one site and the next", () => {
    const sites = goldenLattice(berry, 24)
    expect(sites).toHaveLength(24)
    for (let index = 1; index < sites.length; index++) {
      const step = ((sites[index].azimuth - sites[index - 1].azimuth) % 360 + 360) % 360
      expect(step).toBeCloseTo(GOLDEN_ANGLE % 360, 6)
    }
    expect(GOLDEN_ANGLE).toBeCloseTo(137.507764, 5)
  })

  it("spaces the sites by area, not by parameter", () => {
    // A cone's area grows as t²: half the sites belong above t = 1/√2.
    const sites = goldenLattice(cone, 200)
    const upper = sites.filter((site) => site.t > Math.SQRT1_2).length
    expect(upper).toBeGreaterThan(90)
    expect(upper).toBeLessThan(110)

    // Every band gets its share of the skin, to within a site.
    const total = lateralArea(berry)
    for (const [from, to] of [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]) {
      const expected = (lateralArea(berry, from, to) / total) * 120
      const found = goldenLattice(berry, 120).filter(
        (site) => site.t >= from && site.t < to,
      ).length
      expect(Math.abs(found - expected)).toBeLessThanOrEqual(1.5)
    }
  })

  it("sits every site on the surface, pointing out of it", () => {
    for (const site of goldenLattice(berry, 40, { lobes: 0 })) {
      expect(radiusOf(site.position)).toBeCloseTo(berry(site.t).radius, 6)
      expect(Math.hypot(site.normal.x, site.normal.y, site.normal.z)).toBeCloseTo(1, 9)
    }
  })

  it("gives nothing back for no sites, or a profile with no surface", () => {
    expect(goldenLattice(berry, 0)).toEqual([])
    expect(goldenLattice(berry, Number.NaN)).toEqual([])
    expect(goldenLattice(() => ({ height: 0, radius: 0 }), 10)).toEqual([])
  })
})

describe("split shell and its hinge", () => {
  it("mirrors one half onto the other, point for point", () => {
    const right = halfShell(berry, "right", { rings: 5, meridians: 6 })
    const left = halfShell(berry, "left", { rings: 5, meridians: 6 })
    expect(right).toHaveLength(6 * 7)
    expect(left).toHaveLength(right.length)
    right.forEach((point, index) => {
      expect(left[index].x).toBeCloseTo(-point.x, 9)
      expect(left[index].y).toBeCloseTo(point.y, 9)
      expect(left[index].z).toBeCloseTo(point.z, 9)
    })
    // And both halves are on the surface the closed shell draws.
    for (const point of [...right, ...left]) {
      const ring = point.y / 90
      expect(radiusOf(point)).toBeCloseTo(berry(ring).radius, 6)
    }
  })

  it("swings about a vertical pin without stretching the shell", () => {
    const hinge = { origin: { x: 0, y: 0, z: -18 }, axis: { x: 0, y: 1, z: 0 } }
    const half = halfShell(berry, "right", { rings: 4, meridians: 4 })
    const swung = hingeRotate(half, hinge, 34)

    expect(hingeRotate(half, hinge, 0)).toEqual(half)
    half.forEach((point, index) => {
      const before = Math.hypot(point.x - 0, point.z + 18)
      const after = Math.hypot(swung[index].x - 0, swung[index].z + 18)
      expect(after).toBeCloseTo(before, 9)
      // A vertical pin turns the shell without lifting it.
      expect(swung[index].y).toBeCloseTo(point.y, 9)
    })
    expect(swung.some((point, index) => Math.abs(point.x - half[index].x) > 1)).toBe(true)
  })

  it("tilts a half outward about a rod on the floor, the way a bivalve opens", () => {
    const hinge = { origin: { x: 0, y: 8, z: 0 }, axis: { x: 0, y: 0, z: 1 } }
    const half = halfShell(berry, "right", { rings: 4, meridians: 4 })
    const tilted = hingeRotate(half, hinge, -30)

    half.forEach((point, index) => {
      const before = Math.hypot(point.x, point.y - 8)
      const after = Math.hypot(tilted[index].x, tilted[index].y - 8)
      expect(after).toBeCloseTo(before, 9)
      // A rod along the fore-aft axis cannot move anything fore or aft.
      expect(tilted[index].z).toBeCloseTo(point.z, 9)
    })
    // The crown leans out and comes down; the shell is not stretched doing it.
    const crown = half.length - 1
    expect(tilted[crown].x).toBeGreaterThan(half[crown].x)
    expect(tilted[crown].y).toBeLessThan(half[crown].y)
  })

  it("refuses to turn about nothing, and takes a nonsense angle as shut", () => {
    const hinge = { origin: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 0, z: 0 } }
    const half = halfShell(berry, "right", { rings: 2, meridians: 2 })
    expect(hingeRotate(half, hinge, 40)).toEqual(half)
    expect(
      hingeRotate(half, { origin: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 1, z: 0 } }, Number.NaN),
    ).toEqual(half)
  })
})

describe("blade ring", () => {
  it("keeps the blade's length at every pitch, and spaces them evenly", () => {
    for (const pitch of [-70, -20, 0, 45, 90]) {
      const blades = bladeRing(5, { radius: 22, height: 60, length: 18, width: 9, pitch })
      expect(blades).toHaveLength(5)
      blades.forEach((blade, index) => {
        const reach = Math.hypot(
          blade.tip.x - blade.root.x,
          blade.tip.y - blade.root.y,
          blade.tip.z - blade.root.z,
        )
        expect(reach).toBeCloseTo(18, 9)
        expect(blade.azimuth).toBeCloseTo((index / 5) * 360, 9)
        expect(Math.hypot(blade.root.x, blade.root.z)).toBeCloseTo(22, 9)
        expect(blade.corners).toHaveLength(4)
      })
    }
  })

  it("stands the blades up or folds them down, and tapers the tip", () => {
    const up = bladeRing(4, { radius: 20, height: 50, length: 16, width: 8, pitch: 60 })
    const down = bladeRing(4, { radius: 20, height: 50, length: 16, width: 8, pitch: -60 })
    expect(up[0].tip.y).toBeGreaterThan(up[0].root.y)
    expect(down[0].tip.y).toBeLessThan(down[0].root.y)
    // Folded down it reaches further out than it does standing up.
    expect(Math.hypot(down[0].tip.x, down[0].tip.z)).toBeCloseTo(
      Math.hypot(up[0].tip.x, up[0].tip.z),
      6,
    )

    const [blade] = bladeRing(1, { radius: 20, height: 0, length: 16, width: 10, taper: 0.4, pitch: 0 })
    const rootWidth = Math.hypot(
      blade.corners[0].x - blade.corners[3].x,
      blade.corners[0].z - blade.corners[3].z,
    )
    const tipWidth = Math.hypot(
      blade.corners[1].x - blade.corners[2].x,
      blade.corners[1].z - blade.corners[2].z,
    )
    expect(rootWidth).toBeCloseTo(10, 9)
    expect(tipWidth).toBeCloseTo(4, 9)
  })

  it("takes nonsense without drawing nonsense", () => {
    expect(bladeRing(0, { radius: 10, length: 4, width: 2 })).toEqual([])
    expect(bladeRing(Number.NaN, { radius: 10, length: 4, width: 2 })).toEqual([])
    const blades = bladeRing(3, {
      radius: Number.NaN,
      length: Number.NaN,
      width: Number.NaN,
      pitch: Number.NaN,
    })
    for (const blade of blades) {
      for (const corner of blade.corners) {
        expect(Number.isFinite(corner.x)).toBe(true)
        expect(Number.isFinite(corner.y)).toBe(true)
        expect(Number.isFinite(corner.z)).toBe(true)
      }
    }
  })
})
