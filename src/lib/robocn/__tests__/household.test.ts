import { describe, expect, it } from "vitest"

import {
  extractionFlow,
  hoistPose,
  sectionalPanels,
  sectionalTrack,
  slatPose,
  springPressure,
  suspensionPose,
  swingPose,
  tumbleCycle,
  tumbleItems,
  tumblePose,
} from "@/lib/robocn/household"

describe("swingPose", () => {
  it("keeps the leaf's width at every angle", () => {
    for (const open of [0, 0.2, 0.5, 0.8, 1]) {
      const pose = swingPose(open, { width: 40, maxAngle: 110 })
      expect(Math.hypot(pose.edge.x, pose.edge.depth)).toBeCloseTo(40, 6)
    }
  })

  it("reports how much of itself a front camera still sees", () => {
    expect(swingPose(0, { width: 40 }).facing).toBeCloseTo(1, 6)
    const square = swingPose(1, { width: 40, maxAngle: 90 })
    expect(square.facing).toBeCloseTo(0, 6)
    expect(square.reach).toBeCloseTo(40, 6)
  })

  it("opens the other way and survives rubbish", () => {
    expect(swingPose(1, { width: 40, maxAngle: 90, side: -1 }).edge.x).toBeCloseTo(0, 6)
    expect(swingPose(0.5, { width: 40, side: -1 }).edge.x).toBeLessThan(0)
    const broken = swingPose(Number.NaN, { width: Number.NaN })
    expect(broken.open).toBe(0)
    expect(Number.isFinite(broken.edge.x)).toBe(true)
  })
})

describe("sectionalPanels", () => {
  const options = { panels: 4, opening: 80, radius: 18, headroom: 90 }

  it("keeps every panel its own height, at every travel", () => {
    for (const travel of [0, 0.15, 0.37, 0.62, 0.9, 1]) {
      for (const panel of sectionalPanels(travel, options)) {
        expect(Math.hypot(panel.b.x - panel.a.x, panel.b.y - panel.a.y)).toBeCloseTo(20, 4)
      }
    }
  })

  it("stands the curtain up shut and lays it flat open", () => {
    for (const panel of sectionalPanels(0, options)) {
      expect(panel.angle).toBeCloseTo(90, 3)
      expect(panel.a.x).toBeCloseTo(0, 6)
    }
    for (const panel of sectionalPanels(1, options)) {
      expect(Math.abs(panel.angle)).toBeLessThan(1)
    }
  })

  it("runs the track from the floor to the back of the head", () => {
    const track = sectionalTrack(options, 16)
    expect(track[0]).toEqual({ x: 0, y: 0 })
    expect(track.at(-1)!.y).toBeCloseTo(98, 6)
    expect(track.at(-1)!.x).toBeGreaterThan(80)
  })

  it("degrades rather than throwing", () => {
    const panels = sectionalPanels(Number.NaN, { panels: 0, opening: Number.NaN })
    expect(panels).toHaveLength(1)
    expect(Number.isFinite(panels[0].a.y)).toBe(true)
  })
})

describe("tumblePose", () => {
  it("finds a release angle below a Froude number of one", () => {
    const wash = tumblePose(50, { radius: 0.25 })
    expect(wash.froude).toBeLessThan(1)
    expect(wash.release).not.toBeNull()
    expect(wash.release!).toBeGreaterThan(0)
    expect(wash.regime).toBe("cataracting")
  })

  it("pins the load to the wall at and above one", () => {
    const spin = tumblePose(1200, { radius: 0.25 })
    expect(spin.froude).toBeGreaterThan(1)
    expect(spin.release).toBeNull()
    expect(spin.regime).toBe("centrifuging")
  })

  it("leaves the wall near the horizontal when it is barely turning", () => {
    const slow = tumblePose(15, { radius: 0.25 })
    expect(slow.release!).toBeGreaterThan(80)
    expect(slow.regime).toBe("cascading")
  })
})

describe("tumbleItems", () => {
  const drum = { radius: 0.25, itemRadius: 0.03 }

  it("keeps the whole load inside the drum through a wash", () => {
    for (let step = 0; step < 40; step += 1) {
      for (const item of tumbleItems(step * 0.05, 48, 6, drum)) {
        expect(Math.hypot(item.position.x, item.position.y)).toBeLessThanOrEqual(0.221)
      }
    }
  })

  it("throws part of the load at a wash speed and none of it at a spin", () => {
    const washing = Array.from({ length: 40 }, (_, step) =>
      tumbleItems(step * 0.04, 48, 6, drum).some((item) => item.airborne),
    )
    expect(washing.some(Boolean)).toBe(true)

    const spinning = Array.from({ length: 40 }, (_, step) =>
      tumbleItems(step * 0.02, 1000, 6, drum),
    ).flat()
    expect(spinning.every((item) => !item.airborne)).toBe(true)
    for (const item of spinning) {
      expect(Math.hypot(item.position.x, item.position.y)).toBeCloseTo(0.22, 6)
    }
  })

  it("lands the fall back on the wall", () => {
    const cycle = tumbleCycle(48, drum)!
    expect(cycle.flightTime).toBeGreaterThan(0)
    expect(cycle.rideTime).toBeGreaterThan(0)
    expect(cycle.period).toBeCloseTo(cycle.rideTime + cycle.flightTime, 9)
    // Landing is on the descending side, below the release point.
    expect(cycle.pickup).toBeGreaterThan(60)
    expect(cycle.pickup).toBeLessThan(300)
  })

  it("has no cycle when the drum is stopped or centrifuging", () => {
    expect(tumbleCycle(0, drum)).toBeNull()
    expect(tumbleCycle(1200, drum)).toBeNull()
    expect(tumbleItems(Number.NaN, 48, 3, drum).every((i) => Number.isFinite(i.position.x))).toBe(true)
  })
})

describe("suspensionPose", () => {
  const options = { critical: 300, imbalance: 4, damping: 0.06 }

  it("is worse at the critical speed than well above it", () => {
    const below = suspensionPose(120, options)
    const at = suspensionPose(300, options)
    const above = suspensionPose(1200, options)
    expect(at.amplitude).toBeGreaterThan(below.amplitude * 3)
    expect(at.amplitude).toBeGreaterThan(above.amplitude * 3)
    expect(at.resonant).toBe(true)
    expect(above.resonant).toBe(false)
  })

  it("settles to the imbalance itself once it is supercritical", () => {
    expect(suspensionPose(6000, options).amplitude).toBeCloseTo(4, 1)
    expect(suspensionPose(0, options).amplitude).toBe(0)
  })

  it("lags the heavy spot by a quarter turn at resonance", () => {
    expect(suspensionPose(300, options).phase).toBeCloseTo(90, 4)
  })
})

describe("hoistPose", () => {
  const options = { travel: 180, sheave: 220, spacing: 30, carHeight: 20, weightHeight: 12 }

  it("keeps the rope the same length wherever the car stands", () => {
    const lengths = [0, 0.25, 0.5, 0.75, 1].map((at) => hoistPose(at, options).length)
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 9)
  })

  it("drops the counterweight exactly as far as the car rises", () => {
    const low = hoistPose(0.1, options)
    const high = hoistPose(0.9, options)
    expect(high.car.y - low.car.y).toBeCloseTo(low.counterweight.y - high.counterweight.y, 9)
  })

  it("clamps a position outside its travel", () => {
    expect(hoistPose(4, options).car.y).toBeCloseTo(180, 9)
    expect(hoistPose(Number.NaN, options).car.y).toBeCloseTo(0, 9)
  })
})

describe("slatPose", () => {
  it("runs one day from midnight to midnight", () => {
    expect(slatPose(0).night).toBe(true)
    expect(slatPose(0.5).night).toBe(false)
    expect(slatPose(0.5).altitude).toBeCloseTo(62, 6)
    expect(slatPose(0.25).altitude).toBeCloseTo(0, 6)
    expect(slatPose(0.3).azimuth).toBeLessThan(0)
    expect(slatPose(0.7).azimuth).toBeGreaterThan(0)
  })

  it("turns the blades to the sun and says when it cannot", () => {
    const noon = slatPose(0.5, { minTilt: -70, maxTilt: 70 })
    expect(noon.tilt).toBeCloseTo(0, 6)
    expect(noon.clamped).toBe(false)
    const late = slatPose(0.72, { minTilt: -70, maxTilt: 70 })
    expect(late.tilt).toBe(70)
    expect(late.clamped).toBe(true)
  })

  it("covers most of the opening when the blades are square to it", () => {
    expect(slatPose(0.5, { width: 12, pitch: 12 }).shade).toBeCloseTo(1, 6)
    expect(slatPose(0.5, { width: 6, pitch: 12 }).shade).toBeCloseTo(0.5, 6)
    expect(slatPose(0.75, { width: 12, pitch: 12, maxTilt: 90 }).shade).toBeLessThan(0.01)
  })
})

describe("extraction", () => {
  it("passes nothing below the threshold and Darcy above it", () => {
    expect(extractionFlow(1, { resistance: 2, threshold: 2 })).toBe(0)
    expect(extractionFlow(6, { resistance: 2, threshold: 2 })).toBeCloseTo(2, 9)
    expect(extractionFlow(Number.NaN, { resistance: 2 })).toBe(0)
  })

  it("pays the spring's force back as it extends", () => {
    const hard = springPressure(20, { rate: 1.2, preload: 2, area: 2 })
    const soft = springPressure(4, { rate: 1.2, preload: 2, area: 2 })
    expect(hard).toBeGreaterThan(soft)
    expect(springPressure(0, { rate: 1.2, preload: 2, area: 2 })).toBeCloseTo(1, 9)
    expect(springPressure(-5, { rate: 1.2, preload: 0, area: 2 })).toBe(0)
  })
})
