import { describe, expect, it } from "vitest"

import {
  GOLDEN_ANGLE,
  aimDirection,
  aimFrom,
  discDish,
  framePoint,
  parastichyOffsets,
  rayFlorets,
  spiralArm,
  trackerFrame,
  vogelDisc,
} from "@/lib/robocn/phyllotaxis"

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]

const dot = (a: { x: number; y: number; z: number }, b: typeof a) =>
  a.x * b.x + a.y * b.y + a.z * b.z
const norm = (a: { x: number; y: number; z: number }) => Math.hypot(a.x, a.y, a.z)

describe("the golden-angle disc", () => {
  it("turns by the golden angle and steps out as the square root", () => {
    const sites = vogelDisc(200, { radius: 60 })
    expect(sites).toHaveLength(200)
    for (let index = 1; index < sites.length; index++) {
      expect(sites[index].angle - sites[index - 1].angle).toBeCloseTo(GOLDEN_ANGLE, 9)
    }
    // radius² runs linearly in the index, which is what √n means.
    const first = sites[0].radius ** 2
    const last = sites[199].radius ** 2
    expect(sites[99].radius ** 2).toBeCloseTo(first + (last - first) * (99 / 199), 6)
    expect(sites[199].radius).toBeLessThanOrEqual(60)
  })

  it("puts the same number of sites on every equal area of the face", () => {
    const sites = vogelDisc(400, { radius: 1 })
    // Half the radius is a quarter of the area, so a quarter of the florets.
    const inside = sites.filter((site) => site.radius <= 0.5).length
    expect(Math.abs(inside - 100)).toBeLessThanOrEqual(1)
  })

  it("leaves the eye bare when an inner radius is given", () => {
    const sites = vogelDisc(120, { radius: 50, innerRadius: 14 })
    expect(Math.min(...sites.map((site) => site.radius))).toBeGreaterThanOrEqual(14)
    expect(Math.max(...sites.map((site) => site.radius))).toBeLessThanOrEqual(50)
  })

  it("survives a broken count and a broken radius", () => {
    expect(vogelDisc(Number.NaN, { radius: 30 })).toEqual([])
    expect(vogelDisc(-5)).toEqual([])
    const sites = vogelDisc(6, { radius: Number.NaN })
    expect(sites.every((site) => Number.isFinite(site.position.x))).toBe(true)
  })
})

describe("parastichies", () => {
  // The claim the whole lattice rests on: nobody placed spiral arms, and the
  // arms that are there are counted by consecutive Fibonacci numbers.
  it.each([80, 100, 144, 200, 300, 400, 600])(
    "finds consecutive Fibonacci arm counts in %i florets",
    (count) => {
      const [low, high] = parastichyOffsets(vogelDisc(count, { radius: 60 }))
      const index = FIBONACCI.indexOf(low)
      expect(index, `${low} is not a Fibonacci number`).toBeGreaterThanOrEqual(0)
      expect(high).toBe(FIBONACCI[index + 1])
    },
  )

  it("walks an arm outward without repeating a site", () => {
    const sites = vogelDisc(300, { radius: 60 })
    const [step] = parastichyOffsets(sites)
    const arm = spiralArm(sites, 0, step)
    expect(arm.length).toBe(Math.ceil(300 / step))
    for (let index = 1; index < arm.length; index++) {
      expect(arm[index].radius).toBeGreaterThan(arm[index - 1].radius)
      expect(arm[index].index - arm[index - 1].index).toBe(step)
    }
  })

  it("reports nothing for a lattice too small to have arms", () => {
    expect(parastichyOffsets(vogelDisc(5))).toEqual([])
  })
})

describe("the dish", () => {
  it("is flat with a unit face normal when there is no dish", () => {
    const flat = discDish({ radius: 30, angle: 40 }, { dish: 0, extent: 40 })
    expect(flat.offset).toBe(0)
    expect(flat.normal).toEqual({ x: -0, y: -0, z: 1 })
  })

  it("leads at the rim and leans its normals inward", () => {
    const options = { dish: 6, extent: 40 }
    expect(discDish({ radius: 0, angle: 0 }, options).offset).toBe(0)
    expect(discDish({ radius: 40, angle: 0 }, options).offset).toBeCloseTo(6, 9)
    const rim = discDish({ radius: 40, angle: 0 }, options)
    expect(norm(rim.normal)).toBeCloseTo(1, 12)
    // Angle 0 is +x, so an inward lean is a negative x component.
    expect(rim.normal.x).toBeLessThan(0)
  })

  it("agrees with the slope of its own surface", () => {
    const options = { dish: 5, extent: 30 }
    const step = 1e-4
    const below = discDish({ radius: 18 - step, angle: 0 }, options).offset
    const above = discDish({ radius: 18 + step, angle: 0 }, options).offset
    const slope = (above - below) / (2 * step)
    const normal = discDish({ radius: 18, angle: 0 }, options).normal
    expect(normal.x / normal.z).toBeCloseTo(-slope, 6)
  })
})

describe("the aim", () => {
  it("faces the front camera when it is level and square on", () => {
    expect(aimDirection({ azimuth: 0, elevation: 0 })).toEqual({ x: 0, y: 0, z: -1 })
    expect(aimDirection({ azimuth: 0, elevation: 90 }).y).toBeCloseTo(1, 12)
  })

  it.each([
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 3, z: -4 },
    { x: -2, y: -1, z: 2 },
    { x: 0.3, y: 0.9, z: 0.1 },
  ])("round trips the direction %o", (direction) => {
    const back = aimDirection(aimFrom(direction))
    const length = norm(direction)
    expect(back.x).toBeCloseTo(direction.x / length, 9)
    expect(back.y).toBeCloseTo(direction.y / length, 9)
    expect(back.z).toBeCloseTo(direction.z / length, 9)
  })

  it("parks level rather than returning NaN for a direction with no direction", () => {
    expect(aimFrom({ x: 0, y: 0, z: 0 })).toEqual({ azimuth: 0, elevation: 0 })
    expect(aimFrom({ x: Number.NaN, y: 0, z: 0 })).toEqual({ azimuth: 0, elevation: 0 })
  })
})

describe("the tracker frame", () => {
  it.each([
    { azimuth: 0, elevation: 0 },
    { azimuth: 47, elevation: 21 },
    { azimuth: -130, elevation: -38 },
    { azimuth: 200, elevation: 89 },
  ])("stays orthonormal and right-handed at %o", (aim) => {
    const frame = trackerFrame(aim)
    for (const axis of [frame.right, frame.up, frame.forward]) {
      expect(norm(axis)).toBeCloseTo(1, 12)
    }
    expect(dot(frame.right, frame.up)).toBeCloseTo(0, 12)
    expect(dot(frame.right, frame.forward)).toBeCloseTo(0, 12)
    expect(dot(frame.up, frame.forward)).toBeCloseTo(0, 12)
    // right × forward = up closes the set the way the head is built.
    const cross = {
      x: frame.right.y * frame.forward.z - frame.right.z * frame.forward.y,
      y: frame.right.z * frame.forward.x - frame.right.x * frame.forward.z,
      z: frame.right.x * frame.forward.y - frame.right.y * frame.forward.x,
    }
    expect(cross.x).toBeCloseTo(frame.up.x, 12)
    expect(cross.y).toBeCloseTo(frame.up.y, 12)
    expect(cross.z).toBeCloseTo(frame.up.z, 12)
    // The yaw ring stays level however far the head pitches.
    expect(frame.right.y).toBe(0)
  })

  it("looks exactly along the aim it was given", () => {
    const aim = { azimuth: 62, elevation: -17 }
    expect(trackerFrame(aim).forward).toEqual(aimDirection(aim))
  })

  it("places a point in the head's frame without changing its length", () => {
    const frame = trackerFrame({ azimuth: 33, elevation: 54 })
    const local = { x: 4, y: -7, z: 2 }
    const origin = { x: 10, y: 20, z: -5 }
    const placed = framePoint(frame, origin, local)
    expect(
      Math.hypot(placed.x - origin.x, placed.y - origin.y, placed.z - origin.z),
    ).toBeCloseTo(norm(local), 9)
  })
})

describe("ray florets", () => {
  it("keeps its length at every pitch and spaces them evenly", () => {
    for (const pitch of [-40, 0, 25, 70]) {
      const rays = rayFlorets(13, { radius: 20, length: 12, width: 5, pitch })
      expect(rays).toHaveLength(13)
      for (const ray of rays) {
        expect(
          Math.hypot(ray.tip.x - ray.root.x, ray.tip.y - ray.root.y, ray.tip.z - ray.root.z),
        ).toBeCloseTo(12, 9)
        expect(Math.hypot(ray.root.x, ray.root.y)).toBeCloseTo(20, 9)
        expect(ray.corners).toHaveLength(4)
      }
      expect(rays[1].angle - rays[0].angle).toBeCloseTo(360 / 13, 9)
    }
  })

  it("lifts the tips out of the face when it is pitched up", () => {
    expect(rayFlorets(8, { radius: 20, length: 12, width: 5, pitch: 0 })[0].tip.z).toBe(0)
    expect(
      rayFlorets(8, { radius: 20, length: 12, width: 5, pitch: 50 })[0].tip.z,
    ).toBeGreaterThan(0)
  })

  it("returns nothing rather than NaN for a broken count", () => {
    expect(rayFlorets(Number.NaN, { radius: 20, length: 12, width: 5 })).toEqual([])
  })
})
