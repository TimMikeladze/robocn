import { describe, expect, it } from "vitest"

import {
  easeInOutCubic,
  flatMask,
  FLAT_CAMERA,
  lerpCamera,
  pointerToWorld3D,
  seamOpacity,
  seamPercent,
  solidMask,
  SOLID_CAMERA,
} from "@/lib/transition"

describe("easeInOutCubic", () => {
  it("pins the ends and passes through the middle", () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6)
  })

  it("clamps out-of-range progress", () => {
    expect(easeInOutCubic(-2)).toBe(0)
    expect(easeInOutCubic(4)).toBe(1)
  })
})

describe("the seam", () => {
  it("starts above the stage and ends below it, so both rests are clean", () => {
    expect(seamPercent(0)).toBeLessThan(0)
    expect(seamPercent(1)).toBeGreaterThan(100)
  })

  it("hides the scan line at rest and shows it mid-wipe", () => {
    expect(seamOpacity(0)).toBe(0)
    expect(seamOpacity(1)).toBeCloseTo(0, 6)
    expect(seamOpacity(0.5)).toBeCloseTo(1, 6)
  })
})

describe("masks", () => {
  it("are complementary: the drawing below the seam, the rig above it", () => {
    const seam = seamPercent(0.5)
    expect(flatMask(seam)).toBe(
      "linear-gradient(to bottom, transparent 45.00%, #000 55.00%)",
    )
    expect(solidMask(seam)).toBe(
      "linear-gradient(to bottom, #000 45.00%, transparent 55.00%)",
    )
  })
})

describe("lerpCamera", () => {
  it("dollies from the flat view to the three-quarter one", () => {
    expect(lerpCamera(0)).toEqual(FLAT_CAMERA)
    expect(lerpCamera(1)).toEqual(SOLID_CAMERA)
  })

  it("widens the field of view on the way", () => {
    const mid = lerpCamera(0.5)
    expect(mid.fov).toBeGreaterThan(FLAT_CAMERA.fov)
    expect(mid.fov).toBeLessThan(SOLID_CAMERA.fov)
  })
})

describe("pointerToWorld3D", () => {
  it("maps the stage box into the rig's world, centre to centre", () => {
    const centre = pointerToWorld3D({ x: 0.5, y: 0.5 }, 2.4)
    expect(centre.x).toBeCloseTo(0, 6)
    expect(centre.y).toBeGreaterThan(0)

    const right = pointerToWorld3D({ x: 1, y: 0.5 }, 2.4)
    expect(right.x).toBeCloseTo(2.4 * 0.95, 6)
  })

  it("puts a high pointer above a low one", () => {
    const high = pointerToWorld3D({ x: 0.5, y: 0 }, 2.4)
    const low = pointerToWorld3D({ x: 0.5, y: 1 }, 2.4)
    expect(high.y).toBeGreaterThan(low.y)
  })
})
