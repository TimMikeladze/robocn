import { describe, expect, it } from "vitest"

import {
  controlMix,
  defaultFuselageLoft,
  defaultGearGeometry,
  defaultWingPlanform,
  fuselageRing,
  fuselageSection,
  gearRetraction,
  wingStation,
  wingSurface,
} from "@/lib/robocn/airframe"

const finite = (value: number) => Number.isFinite(value)

describe("airframe — the fuselage loft", () => {
  it("meets the barrel with no step at either join", () => {
    const { barrel, upsweep, radius } = defaultFuselageLoft
    for (const z of [barrel, upsweep]) {
      const before = fuselageSection(z - 0.01)
      const after = fuselageSection(z + 0.01)
      expect(before.radius).toBeCloseTo(radius, 2)
      expect(after.radius).toBeCloseTo(radius, 2)
      expect(after.centre).toBeCloseTo(before.centre, 2)
    }
  })

  it("closes at the nose and keeps the crown above the centreline everywhere", () => {
    const { nose, tail } = defaultFuselageLoft
    expect(fuselageSection(nose).radius).toBeCloseTo(0, 6)
    for (let z = nose; z <= tail; z += 2) {
      const section = fuselageSection(z)
      expect(section.crown).toBeGreaterThanOrEqual(section.centre)
      expect(section.keel).toBeLessThanOrEqual(section.centre)
      expect(section.radius).toBeGreaterThanOrEqual(0)
    }
  })

  it("stands the upper deck over the forward third and nowhere else", () => {
    const { humpFrom, humpTo, tail } = defaultFuselageLoft
    expect(fuselageSection(humpFrom).humpFraction).toBeCloseTo(1, 2)
    expect(fuselageSection(humpTo).humpFraction).toBeCloseTo(0, 2)
    expect(fuselageSection(0).hump).toBe(0)
    expect(fuselageSection(tail).hump).toBe(0)
  })

  it("sweeps the tail cone up: the keel rises further than the crown", () => {
    const barrel = fuselageSection(0)
    const end = fuselageSection(defaultFuselageLoft.tail)
    expect(end.keel - barrel.keel).toBeGreaterThan(end.crown - barrel.crown)
    expect(end.radius).toBeLessThan(barrel.radius)
  })

  it("rings a section as a closed loop with the deck on top", () => {
    const section = fuselageSection(-60)
    const ring = fuselageRing(section, 16)

    expect(ring).toHaveLength(16)
    // Crown first, then round to starboard.
    expect(ring[0].y).toBeCloseTo(section.crown, 6)
    expect(ring[4].x).toBeGreaterThan(0)
    for (const point of ring) {
      expect(finite(point.x) && finite(point.y) && finite(point.z)).toBe(true)
      expect(point.z).toBeCloseTo(section.z, 6)
      expect(point.y).toBeLessThanOrEqual(section.crown + 1e-6)
      expect(point.y).toBeGreaterThanOrEqual(section.keel - 1e-6)
    }
  })

  it("gives a closed body for rubbish input rather than a negative radius", () => {
    const section = fuselageSection(Number.NaN)
    expect(finite(section.radius) && section.radius >= 0).toBe(true)
    for (const point of fuselageRing(fuselageSection(Number.POSITIVE_INFINITY))) {
      expect(finite(point.x) && finite(point.y) && finite(point.z)).toBe(true)
    }
  })
})

describe("airframe — the wing planform", () => {
  it("runs out monotonically in span, sweep and dihedral", () => {
    let previous = wingStation(0)
    for (let t = 0.05; t <= 1; t += 0.05) {
      const station = wingStation(t)
      expect(station.x).toBeGreaterThan(previous.x)
      expect(station.y).toBeGreaterThan(previous.y)
      expect(station.leading).toBeGreaterThan(previous.leading)
      expect(station.chord).toBeLessThan(previous.chord)
      previous = station
    }
  })

  it("keeps the inboard trailing edge nearly straight and sweeps the outboard one", () => {
    const { kink } = defaultWingPlanform
    const root = wingStation(0)
    const knee = wingStation(kink)
    const tip = wingStation(1)

    const inboard = (knee.trailing - root.trailing) / (knee.x - root.x)
    const outboard = (tip.trailing - knee.trailing) / (tip.x - knee.x)
    expect(Math.abs(inboard)).toBeLessThan(0.15)
    expect(outboard).toBeGreaterThan(0.4)
  })

  it("cuts a surface out of the planform it is on", () => {
    const flap = wingSurface(0.1, 0.32, 0.72, 1)
    const inner = wingStation(0.1)
    const outer = wingStation(0.32)

    expect(flap).toHaveLength(4)
    expect(flap[0].z).toBeCloseTo(inner.leading + inner.chord * 0.72, 6)
    expect(flap[2].z).toBeCloseTo(outer.trailing, 6)
    // The surface rides the wing's own dihedral.
    expect(flap[1].y).toBeGreaterThan(flap[0].y)
  })

  it("clamps a station outside the wing instead of extrapolating off it", () => {
    expect(wingStation(4).t).toBe(1)
    expect(wingStation(-4).t).toBe(0)
    const rubbish = wingStation(Number.NaN)
    expect(finite(rubbish.x) && finite(rubbish.y) && finite(rubbish.chord)).toBe(true)
  })
})

describe("airframe — the undercarriage", () => {
  const geometry = defaultGearGeometry

  it("swings the leg about a trunnion that never moves", () => {
    const down = gearRetraction(0)
    const up = gearRetraction(1)

    expect(up.trunnion).toEqual(down.trunnion)
    // Down and locked: the axle is straight below the trunnion, a leg's length.
    expect(down.axle.y).toBeCloseTo(geometry.trunnion.y - geometry.leg, 6)
    expect(down.axle.z).toBeCloseTo(geometry.trunnion.z, 6)
    // Stowed: it has swung forward and come up.
    expect(up.axle.y).toBeGreaterThan(down.axle.y)
    expect(up.axle.z).toBeLessThan(down.axle.z)
  })

  it("holds both stay links at their own lengths through the whole retraction", () => {
    for (let r = 0; r <= 1; r += 0.05) {
      const pose = gearRetraction(r)
      const upper = Math.hypot(
        pose.knee.y - pose.anchor.y,
        pose.knee.z - pose.anchor.z,
        pose.knee.x - pose.anchor.x,
      )
      const lower = Math.hypot(
        pose.foot.y - pose.knee.y,
        pose.foot.z - pose.knee.z,
        pose.foot.x - pose.knee.x,
      )
      expect(upper).toBeCloseTo(geometry.stayUpper, 4)
      expect(lower).toBeCloseTo(geometry.stayLower, 4)
      expect(pose.reachable).toBe(true)
    }
  })

  it("keeps the foot on the leg, at its own fraction of it", () => {
    for (const r of [0, 0.4, 1]) {
      const pose = gearRetraction(r)
      const legLength = Math.hypot(
        pose.axle.x - pose.trunnion.x,
        pose.axle.y - pose.trunnion.y,
        pose.axle.z - pose.trunnion.z,
      )
      const footLength = Math.hypot(
        pose.foot.x - pose.trunnion.x,
        pose.foot.y - pose.trunnion.y,
        pose.foot.z - pose.trunnion.z,
      )
      expect(legLength).toBeCloseTo(geometry.leg, 6)
      expect(footLength).toBeCloseTo(geometry.leg * geometry.stayFoot, 6)
    }
  })

  it("folds a wing leg toward the centreline, handed by its side", () => {
    const starboard = gearRetraction(1, { fold: "inboard", side: 1, trunnion: { x: 30, y: 20, z: 0 } })
    const port = gearRetraction(1, { fold: "inboard", side: -1, trunnion: { x: -30, y: 20, z: 0 } })

    expect(starboard.axle.x).toBeLessThan(30)
    expect(port.axle.x).toBeGreaterThan(-30)
    expect(starboard.axle.y).toBeCloseTo(port.axle.y, 6)
  })

  it("shuts the door last and tilts the bogie as it goes", () => {
    expect(gearRetraction(0).door).toBeCloseTo(geometry.doorSwing, 6)
    expect(gearRetraction(0.7).door).toBeCloseTo(geometry.doorSwing, 6)
    expect(gearRetraction(1).door).toBeCloseTo(0, 6)
    expect(gearRetraction(0.5).tilt).toBeCloseTo(geometry.bogieTilt / 2, 6)
  })

  it("clamps a stay that cannot reach instead of failing", () => {
    const pose = gearRetraction(0.5, { stayUpper: 1, stayLower: 1 })

    expect(pose.reachable).toBe(false)
    for (const point of [pose.axle, pose.knee, pose.foot, pose.anchor]) {
      expect(finite(point.x) && finite(point.y) && finite(point.z)).toBe(true)
    }
  })

  it("gives a stable pose for a non-finite retraction", () => {
    const pose = gearRetraction(Number.NaN)
    expect(pose.retraction).toBe(0)
    expect(finite(pose.axle.y)).toBe(true)
  })
})

describe("airframe — the control mix", () => {
  it("is clean and neutral with nothing commanded", () => {
    const clean = controlMix()
    expect(clean.flap).toBe(0)
    expect(clean.slat).toBe(0)
    expect(clean.gear).toBe(0)
    expect(clean.elevator).toBe(0)
    expect(clean.aileronOutboard).toBe(0)
    expect(clean.spoilerPort).toBe(0)
  })

  it("runs the slats out ahead of the flaps", () => {
    const early = controlMix({ configuration: 0.25 })
    expect(early.slatExtension).toBeGreaterThan(0.8)
    expect(early.flap).toBeLessThan(2)

    const dirty = controlMix({ configuration: 1 })
    expect(dirty.slatExtension).toBeCloseTo(1, 6)
    expect(dirty.flap).toBeGreaterThan(29)
    expect(dirty.gear).toBeCloseTo(1, 6)
  })

  it("locks the outboard ailerons out with the flaps up", () => {
    const cruise = controlMix({ roll: 8 })
    const approach = controlMix({ roll: 8, configuration: 0.6 })

    expect(cruise.aileronInboard).toBeCloseTo(approach.aileronInboard, 6)
    expect(cruise.aileronOutboard).toBe(0)
    expect(approach.aileronOutboard).toBeCloseTo(approach.aileronInboard, 6)
  })

  it("raises the roll spoilers on the down-going wing only", () => {
    const right = controlMix({ roll: 10 })
    expect(right.spoilerStarboard).toBeGreaterThan(0)
    expect(right.spoilerPort).toBe(0)

    const left = controlMix({ roll: -10 })
    expect(left.spoilerPort).toBeGreaterThan(0)
    expect(left.spoilerStarboard).toBe(0)

    // The speedbrake is the one that puts both sides up together.
    const brake = controlMix({ speedbrake: 1 })
    expect(brake.spoilerPort).toBeCloseTo(brake.spoilerStarboard, 6)
    expect(brake.spoilerPort).toBeGreaterThan(40)
  })

  it("trims the stabiliser with the configuration", () => {
    expect(controlMix({ configuration: 1 }).stabiliser).toBeGreaterThan(
      controlMix({ configuration: 0 }).stabiliser,
    )
  })

  it("gives the clean aeroplane for rubbish commands", () => {
    const mix = controlMix({
      pitch: Number.NaN,
      roll: Number.POSITIVE_INFINITY,
      configuration: Number.NaN,
    })
    for (const value of Object.values(mix)) expect(finite(value)).toBe(true)
    expect(mix.flap).toBe(0)
    expect(mix.elevator).toBe(0)
  })
})
