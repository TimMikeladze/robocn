import { describe, expect, it } from "vitest"

import {
  bladePose,
  bodyOffset,
  bogieRide,
  curveRadius,
  huntingPose,
  klingelWavelength,
  pantographPose,
  radialYaw,
  trackCurvature,
  turnoutGeometry,
  turnoutPoint,
  wireStagger,
} from "@/lib/robocn/rail"

/**
 * The rail solver: docs/rail-machines.md.
 *
 * What is asserted is the geometry the design note claims, not the drawing —
 * the chord relation the throws come from, Klingel's wavelength and the quarter
 * cycle between lateral and yaw, the pantograph's height-for-reach trade and
 * its clamp, and the turnout number fixing the crossing angle.
 */

const GEOMETRY = { pivotSpacing: 120, halfLength: 95 }

describe("curveRadius", () => {
  it("is straight at zero and exact on the chord relation", () => {
    expect(curveRadius(0, 120)).toBe(Infinity)
    const radius = curveRadius(10, 120)
    // chord = 2R sin(turn/2)
    expect(2 * radius * Math.sin((10 * Math.PI) / 360)).toBeCloseTo(120, 6)
  })

  it("survives nonsense and clamps past the sharpest curve", () => {
    expect(curveRadius(Number.NaN, 120)).toBe(Infinity)
    expect(curveRadius(500, 120)).toBe(curveRadius(20, 120))
  })
})

describe("bogieRide", () => {
  it("places the pivots on the track, so each bogie takes half the turn", () => {
    const radius = curveRadius(12, GEOMETRY.pivotSpacing)
    const ride = bogieRide(radius, GEOMETRY)
    expect(ride.bogies[0].yaw).toBeCloseTo(6, 6)
    expect(ride.bogies[1].yaw).toBeCloseTo(-6, 6)
    expect(ride.bodyYaw).toBe(0)
    expect(ride.sign).toBe(1)
  })

  it("throws the middle in and the ends out, and the ends further", () => {
    const ride = bogieRide(curveRadius(12, GEOMETRY.pivotSpacing), GEOMETRY)
    expect(ride.centreThrow).toBeGreaterThan(0)
    expect(ride.endThrow).toBeGreaterThan(0)
    expect(ride.endThrow).toBeGreaterThan(ride.centreThrow)
    // Both are readings of the one chord, measured outward from the track.
    expect(bodyOffset(0, ride.radius, GEOMETRY.pivotSpacing)).toBeCloseTo(-ride.centreThrow, 6)
    expect(bodyOffset(GEOMETRY.halfLength, ride.radius, GEOMETRY.pivotSpacing)).toBeCloseTo(ride.endThrow, 6)
    // A pivot is on the track itself, so it is thrown neither way.
    expect(bodyOffset(GEOMETRY.pivotSpacing / 2, ride.radius, GEOMETRY.pivotSpacing)).toBeCloseTo(0, 6)
  })

  it("throws further on a sharper curve, and mirrors to port", () => {
    const easy = bogieRide(curveRadius(4, GEOMETRY.pivotSpacing), GEOMETRY)
    const tight = bogieRide(curveRadius(16, GEOMETRY.pivotSpacing), GEOMETRY)
    expect(tight.centreThrow).toBeGreaterThan(easy.centreThrow)

    const port = bogieRide(-curveRadius(16, GEOMETRY.pivotSpacing), GEOMETRY)
    expect(port.sign).toBe(-1)
    expect(port.bogies[0].yaw).toBeCloseTo(-tight.bogies[0].yaw, 6)
  })

  it("is straight on straight track and on nonsense", () => {
    for (const radius of [Infinity, Number.NaN, 0]) {
      const ride = bogieRide(radius, GEOMETRY)
      expect(ride.sign).toBe(0)
      expect(ride.centreThrow).toBe(0)
      expect(ride.endThrow).toBe(0)
      expect(ride.bogies[0].yaw).toBe(0)
    }
  })
})

describe("hunting", () => {
  const wheelset = {
    wheelRadius: 18,
    halfGauge: 24,
    conicity: 0.05,
    flangeClearance: 4,
  }

  it("is Klingel's wavelength, and infinite on a cylindrical tread", () => {
    expect(klingelWavelength(wheelset)).toBeCloseTo(
      2 * Math.PI * Math.sqrt((24 * 18) / 0.05),
      6,
    )
    expect(klingelWavelength({ ...wheelset, conicity: 0 })).toBe(Infinity)
    // Less cone is a longer wavelength: the restoring term is weaker.
    expect(klingelWavelength({ ...wheelset, conicity: 0.02 })).toBeGreaterThan(
      klingelWavelength(wheelset),
    )
  })

  it("runs the lateral and the yaw a quarter cycle apart", () => {
    const lambda = klingelWavelength(wheelset)
    const start = huntingPose(0, 3, wheelset)
    const quarter = huntingPose(lambda / 4, 3, wheelset)
    // Furthest out and not yawed; then through the centre, yawing hardest.
    expect(start.lateral).toBeCloseTo(3, 6)
    expect(start.yaw).toBeCloseTo(0, 6)
    expect(quarter.lateral).toBeCloseTo(0, 6)
    expect(Math.abs(quarter.yaw)).toBeGreaterThan(0.1)
    // And it repeats after exactly one wavelength.
    expect(huntingPose(lambda, 3, wheelset).lateral).toBeCloseTo(start.lateral, 6)
  })

  it("makes the radius difference the restoring term, and stops at the flange", () => {
    const pose = huntingPose(0, 3, wheelset)
    expect(pose.radiusDifference).toBeCloseTo(2 * 0.05 * pose.lateral, 6)
    expect(pose.flanging).toBe(false)

    const hard = huntingPose(0, 9, wheelset)
    expect(hard.lateral).toBeCloseTo(4, 6)
    expect(hard.flanging).toBe(true)
  })

  it("does not move at all with no cone, and survives nonsense", () => {
    expect(huntingPose(3, 3, { ...wheelset, conicity: 0 }).lateral).toBe(0)
    const bad = huntingPose(Number.NaN, Number.NaN, wheelset)
    expect(Number.isFinite(bad.lateral)).toBe(true)
    expect(Number.isFinite(bad.yaw)).toBe(true)
  })

  it("steers radially on a curve and not at all on the straight", () => {
    expect(radialYaw(30, 600)).toBeCloseTo((Math.atan(30 / 600) * 180) / Math.PI, 6)
    expect(radialYaw(30, Infinity)).toBe(0)
  })
})

describe("pantographPose", () => {
  const geometry = {
    lowerArm: 54,
    upperArm: 46,
    baseHeight: 6,
    rod: 40,
    lever: 11,
    rodAnchor: 0.45,
    designHeight: 78,
  }

  it("trades reach for height: the knee folds in as the pan goes up", () => {
    const low = pantographPose(40, geometry)
    const high = pantographPose(92, geometry)
    expect(high.head.y).toBeGreaterThan(low.head.y)
    expect(Math.abs(high.knee.x)).toBeLessThan(Math.abs(low.knee.x))
    // The head is over the base at every height — that is the linkage's job.
    expect(high.head.x).toBeCloseTo(0, 6)
  })

  it("keeps the arms their own length at every height", () => {
    for (const height of [30, 50, 70, 95]) {
      const pose = pantographPose(height, geometry)
      expect(Math.hypot(pose.knee.x - pose.base.x, pose.knee.y - pose.base.y)).toBeCloseTo(54, 6)
      expect(Math.hypot(pose.head.x - pose.knee.x, pose.head.y - pose.knee.y)).toBeCloseTo(46, 6)
      expect(Math.hypot(pose.leverEnd.x - pose.head.x, pose.leverEnd.y - pose.head.y)).toBeCloseTo(11, 6)
    }
  })

  it("clamps past full extension instead of failing", () => {
    const past = pantographPose(400, geometry)
    expect(past.reachable).toBe(false)
    expect(past.workingHeight).toBeLessThanOrEqual(6 + 54 + 46)
    expect(Number.isFinite(past.knee.x)).toBe(true)

    const nonsense = pantographPose(Number.NaN, geometry)
    expect(Number.isFinite(nonsense.workingHeight)).toBe(true)
  })

  it("levels the head where it was set and lets it tip at the ends", () => {
    expect(pantographPose(78, geometry).attitude).toBeCloseTo(0, 6)
    expect(Math.abs(pantographPose(30, geometry).attitude)).toBeGreaterThan(0.5)
  })
})

describe("turnoutGeometry", () => {
  it("takes the crossing angle from the turnout number", () => {
    const eight = turnoutGeometry(8, 20)
    expect(eight.crossingAngle).toBeCloseTo((Math.atan(1 / 8) * 180) / Math.PI, 6)
    // A bigger number is a shallower, longer, faster turnout.
    expect(turnoutGeometry(12, 20).crossingAngle).toBeLessThan(eight.crossingAngle)
    expect(turnoutGeometry(12, 20).radius).toBeGreaterThan(eight.radius)
    expect(turnoutGeometry(12, 20).lead).toBeGreaterThan(eight.lead)
  })

  it("puts the crossing where the inner rails actually meet", () => {
    const geometry = turnoutGeometry(8, 20)
    const alpha = (geometry.crossingAngle * Math.PI) / 180
    // cos α = (R − g)/(R + g) is what fixes the radius, so the offset at the
    // crossing comes out as one gauge whatever the number.
    expect(Math.cos(alpha)).toBeCloseTo((geometry.radius - 10) / (geometry.radius + 10), 6)
    expect(geometry.offset).toBeCloseTo(10 * (1 + Math.cos(alpha)), 6)
    expect(turnoutGeometry(4, 20).offset).toBeCloseTo(geometry.offset, 0)
  })

  it("leaves the straight tangentially and arrives at the crossing angle", () => {
    const geometry = turnoutGeometry(8, 20)
    expect(turnoutPoint(0, geometry)).toEqual({ x: 0, y: 0 })
    // No kink at the toe: the first step off is second order in the distance.
    expect(turnoutPoint(1, geometry).y).toBeLessThan(0.02)
    expect(turnoutPoint(geometry.lead, geometry).y).toBeCloseTo(geometry.offset, 6)
    // Past the crossing it runs straight on at the crossing angle.
    const a = turnoutPoint(geometry.lead + 20, geometry)
    const b = turnoutPoint(geometry.lead + 40, geometry)
    expect((b.y - a.y) / (b.x - a.x)).toBeCloseTo(1 / 8, 6)
  })
})

describe("bladePose", () => {
  it("ties the two blades to one rod, so the gaps sum to the throw", () => {
    for (const position of [0, 0.3, 0.5, 1]) {
      const pose = bladePose(position, 12, 1)
      expect(pose.normalGap + pose.reverseGap).toBeCloseTo(12, 6)
    }
  })

  it("sets a route only inside detection, and has none mid-stroke", () => {
    expect(bladePose(0, 12, 1).route).toBe("normal")
    expect(bladePose(1, 12, 1).route).toBe("reverse")
    const midway = bladePose(0.5, 12, 1)
    expect(midway.route).toBe("unset")
    expect(midway.detected).toBe(false)
    // Just inside the tolerance is still home.
    expect(bladePose(0.05, 12, 1).route).toBe("normal")
  })

  it("clamps nonsense onto the normal end of the stroke", () => {
    expect(bladePose(Number.NaN, 12, 1).route).toBe("normal")
    expect(bladePose(4, 12, 1).route).toBe("reverse")
  })
})

describe("the illustrative shapes", () => {
  it("winds both ways and stays bounded", () => {
    const samples = Array.from({ length: 60 }, (_, i) => trackCurvature(i / 12))
    expect(Math.max(...samples)).toBeGreaterThan(0.4)
    expect(Math.min(...samples)).toBeLessThan(-0.4)
    expect(samples.every((value) => Math.abs(value) <= 1.0001)).toBe(true)
    expect(trackCurvature(Number.NaN)).toBe(0)
  })

  it("staggers the wire across the track and reverses each span", () => {
    expect(wireStagger(0, 6, 40)).toBeCloseTo(-6, 6)
    expect(wireStagger(40, 6, 40)).toBeCloseTo(6, 6)
    expect(wireStagger(80, 6, 40)).toBeCloseTo(-6, 6)
    expect(Number.isFinite(wireStagger(Number.NaN, 6, 40))).toBe(true)
  })
})
