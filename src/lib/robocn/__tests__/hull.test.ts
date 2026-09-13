import { describe, expect, it } from "vitest"

import {
  burst,
  direction,
  dish,
  dishFocalPoint,
  dishNormal,
  dishProfile,
  hullPlates,
  plateNormal,
  plateOutline,
  shockRing,
} from "@/lib/robocn/hull"
import type { Vec3 } from "@/lib/robocn/kinematics"

const norm = (v: Vec3) => Math.hypot(v.x, v.y, v.z)
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z

describe("the plating", () => {
  it("covers the sphere exactly, at every course and plate count", () => {
    // A hull with a gap in it is not a hull. Equal-area courses are what makes
    // this exact rather than nearly right.
    for (const courses of [1, 2, 3, 6, 9, 14, 21]) {
      for (const perCourse of [1, 4, 10, 18]) {
        const plates = hullPlates(courses, { perCourse })
        const total = plates.reduce((sum, plate) => sum + plate.area, 0)
        expect(total, `${courses}×${perCourse}`).toBeCloseTo(1, 12)
      }
    }
  })

  it("gives every course exactly its own share of the sphere", () => {
    const plates = hullPlates(8, { perCourse: 12 })
    for (let course = 0; course < 8; course++) {
      const share = plates
        .filter((plate) => plate.course === course)
        .reduce((sum, plate) => sum + plate.area, 0)
      expect(share).toBeCloseTo(1 / 8, 12)
    }
  })

  it("keeps the plates about square instead of slivering at the poles", () => {
    const plates = hullPlates(11, { perCourse: 16 })
    const seats = (course: number) =>
      plates.filter((plate) => plate.course === course).length
    const equatorial = seats(5)
    const polar = seats(0)
    // The count tracks the cosine, so a polar course carries far fewer plates,
    // and the areas stay within a small factor of each other rather than
    // falling off with the circumference.
    expect(polar).toBeLessThan(equatorial)
    const areas = plates.map((plate) => plate.area)
    expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(3)
  })

  it("tiles without gaps in longitude and hands back closed plate outlines", () => {
    const plates = hullPlates(5, { perCourse: 9, offset: 17 })
    const course = plates.filter((plate) => plate.course === 2)
    for (let seat = 1; seat < course.length; seat++) {
      // Each plate starts exactly where the last one stopped.
      expect(course[seat].west).toBeCloseTo(course[seat - 1].east, 12)
    }
    expect(course.at(-1)!.east - course[0].west).toBeCloseTo(360, 12)

    const outline = plateOutline(course[3], 5)
    expect(outline).toHaveLength(20)
    for (const point of outline) {
      expect(point.latitude).toBeGreaterThanOrEqual(course[3].south - 1e-9)
      expect(point.latitude).toBeLessThanOrEqual(course[3].north + 1e-9)
      expect(point.longitude).toBeGreaterThanOrEqual(course[3].west - 1e-9)
      expect(point.longitude).toBeLessThanOrEqual(course[3].east + 1e-9)
    }
    // And every boundary point is on the unit sphere.
    for (const point of outline) {
      expect(norm(direction(point.latitude, point.longitude))).toBeCloseTo(1, 12)
    }
  })

  it("survives nonsense and still returns a hull", () => {
    const plates = hullPlates(Number.NaN, { perCourse: Number.NaN, offset: Number.NaN })
    expect(plates.length).toBeGreaterThan(0)
    expect(plates.reduce((sum, plate) => sum + plate.area, 0)).toBeCloseTo(1, 12)
    for (const plate of plates) {
      expect(Number.isFinite(plate.latitude)).toBe(true)
      expect(norm(plateNormal(plate))).toBeCloseTo(1, 12)
    }
    expect(hullPlates(-5).length).toBeGreaterThan(0)
  })
})

describe("the breakup", () => {
  const plates = hullPlates(7, { perCourse: 12 })
  const options = { origin: { x: 0, y: 0.3, z: -0.9 }, spread: 2.4, focus: 0.5, front: 0.7, seed: 3 }

  it("puts every plate back exactly where the tiling had it", () => {
    for (const plate of plates) {
      const rest = plateNormal(plate)
      const still = burst(plate, 0, options)
      expect(still.release).toBe(0)
      expect(still.spin).toBeCloseTo(0, 15)
      expect(still.offset.x).toBeCloseTo(rest.x, 15)
      expect(still.offset.y).toBeCloseTo(rest.y, 15)
      expect(still.offset.z).toBeCloseTo(rest.z, 15)
      expect(still.distance).toBeCloseTo(1, 12)
    }
  })

  it("lets the near side go before the far side", () => {
    const origin = { x: 0, y: 0, z: -1 }
    const near = plates.reduce((best, plate) =>
      dot(plateNormal(plate), origin) > dot(plateNormal(best), origin) ? plate : best,
    )
    const far = plates.reduce((best, plate) =>
      dot(plateNormal(plate), origin) < dot(plateNormal(best), origin) ? plate : best,
    )
    const at = (plate: typeof near, t: number) => burst(plate, t, { ...options, origin }).release
    expect(at(near, 0.2)).toBeGreaterThan(0)
    expect(at(far, 0.2)).toBe(0)
    // But the burst is over for everything by the end.
    expect(at(near, 1)).toBeCloseTo(1, 12)
    expect(at(far, 1)).toBeCloseTo(1, 12)
  })

  it("never moves a plate back toward the centre", () => {
    // The one invariant a drawing cannot fake: whatever the focus blend, the
    // travel direction has a non-negative component along the plate's normal.
    for (const blend of [0, 0.3, 0.7, 1]) {
      for (const plate of plates) {
        let previous = 0
        for (let step = 0; step <= 20; step++) {
          const state = burst(plate, step / 20, { ...options, focus: blend })
          expect(state.distance).toBeGreaterThanOrEqual(previous - 1e-12)
          previous = state.distance
        }
        expect(previous).toBeLessThanOrEqual(1 + options.spread * 1.45 + 1e-9)
      }
    }
  })

  it("is the same breakup for a seed and a different one for another", () => {
    const plate = plates[20]
    expect(burst(plate, 0.6, { ...options, seed: 3 })).toEqual(
      burst(plate, 0.6, { ...options, seed: 3 }),
    )
    expect(burst(plate, 0.6, { ...options, seed: 4 }).offset.x).not.toBe(
      burst(plate, 0.6, { ...options, seed: 3 }).offset.x,
    )
    // Plates do not travel as one shell.
    const kicks = plates.map((p) => burst(p, 1, options).distance)
    expect(new Set(kicks.map((k) => k.toFixed(4))).size).toBeGreaterThan(plates.length / 2)
  })

  it("fires everything at once when the front has no width", () => {
    for (const plate of plates) {
      expect(burst(plate, 0.5, { ...options, front: 0 }).release).toBeCloseTo(0.5, 12)
    }
  })

  it("stays finite on nonsense", () => {
    const state = burst(plates[4], Number.NaN, {
      origin: { x: Number.NaN, y: 0, z: 0 },
      spread: Number.POSITIVE_INFINITY,
      focus: Number.NaN,
      tumble: Number.NaN,
      front: Number.NaN,
      seed: Number.NaN,
    })
    for (const value of [state.release, state.distance, state.spin, state.offset.x, state.axis.y]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(norm(state.axis)).toBeCloseTo(1, 12)
  })
})

describe("the shock ring", () => {
  it("is a real circle in the plane it says it is in", () => {
    const centre = { x: 3, y: -1, z: 2 }
    const axis = { x: 0.4, y: 0.8, z: -0.45 }
    const points = shockRing(centre, axis, 5.5, 32)
    expect(points).toHaveLength(32)
    const unitAxis = { x: axis.x, y: axis.y, z: axis.z }
    const length = norm(unitAxis)
    for (const point of points) {
      const spoke = { x: point.x - centre.x, y: point.y - centre.y, z: point.z - centre.z }
      expect(norm(spoke)).toBeCloseTo(5.5, 10)
      expect(dot(spoke, unitAxis) / length).toBeCloseTo(0, 10)
    }
  })

  it("collapses to a point at zero radius and survives nonsense", () => {
    for (const point of shockRing({ x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 0 }, 0, 8)) {
      expect(norm({ x: point.x - 1, y: point.y - 1, z: point.z - 1 })).toBeCloseTo(0, 12)
    }
    const broken = shockRing(
      { x: Number.NaN, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      Number.NaN,
      Number.NaN,
    )
    expect(broken.length).toBeGreaterThanOrEqual(3)
    for (const point of broken) expect(Number.isFinite(point.x)).toBe(true)
  })
})

describe("the dish", () => {
  it("reflects a ray parallel to the axis through the focus, anywhere on the bowl", () => {
    // This is what makes a dish a dish, and it is the reason the emitter rays
    // can be solved rather than aimed.
    for (const [radius, depth] of [[1, 0.25], [40, 9], [18, 3.5], [6, 6]] as const) {
      const bowl = dish(radius, depth)
      const focus = dishFocalPoint(bowl)
      for (const u of [0.05, 0.3, 0.61, 0.88, 1]) {
        const hit = dishProfile(bowl, u)
        const n = dishNormal(bowl, u)
        // Incoming ray runs down the axis, into the bowl.
        const incoming = { x: 0, y: -1 }
        const projection = incoming.x * n.x + incoming.y * n.y
        const out = { x: incoming.x - 2 * projection * n.x, y: incoming.y - 2 * projection * n.y }
        // Where that reflected ray crosses the axis.
        const step = -hit.x / out.x
        expect(hit.y + out.y * step).toBeCloseTo(focus.y, 8)
      }
    }
  })

  it("carries the focal length its rim and depth imply", () => {
    expect(dish(1, 0.25).focus).toBeCloseTo(1, 12)
    expect(dish(40, 10).focus).toBeCloseTo(40, 12)
    // The vertex is on the axis and the rim is exactly `depth` deep.
    const bowl = dish(30, 7)
    expect(dishProfile(bowl, 0)).toEqual({ x: 0, y: 0 })
    expect(dishProfile(bowl, 1).y).toBeCloseTo(7, 10)
    expect(dishNormal(bowl, 0).x).toBeCloseTo(0, 15)
    expect(dishNormal(bowl, 0).y).toBeCloseTo(1, 15)
  })

  it("stays finite on nonsense", () => {
    const bowl = dish(Number.NaN, 0)
    expect(Number.isFinite(bowl.focus)).toBe(true)
    for (const u of [Number.NaN, Number.POSITIVE_INFINITY, 40]) {
      expect(Number.isFinite(dishProfile(bowl, u).y)).toBe(true)
      expect(Number.isFinite(dishNormal(bowl, u).x)).toBe(true)
    }
  })
})
