import { describe, expect, it } from "vitest"

import {
  cycleForTravel,
  defaultPumpGeometry,
  fluidLoad,
  plungerArea,
  plungerTravel,
  pumpCard,
  pumpDisplacement,
  pumpLoad,
  pumpRegime,
  pumpState,
  pumpValves,
  ballLift,
  BALL_FLOAT,
  chamberPressure,
  solveRodPump,
  strokeDirection,
  svOpenTravel,
  tvOpenTravel,
  valveFlow,
  volumetricEfficiency,
  type PumpCondition,
} from "@/lib/robocn/rodpump"

const CONDITIONS: PumpCondition[] = ["full", "gas", "pound", "tv-leak", "sv-leak", "tagging"]

describe("rodpump — the stroke", () => {
  it("puts the plunger on bottom at the start of the cycle and on top at the half", () => {
    expect(plungerTravel(0)).toBeCloseTo(0, 6)
    expect(plungerTravel(0.25)).toBeCloseTo(0.5, 6)
    expect(plungerTravel(0.5)).toBeCloseTo(1, 6)
    expect(plungerTravel(0.75)).toBeCloseTo(0.5, 6)
  })

  it("repeats whole cycles in both directions", () => {
    for (const phase of [0.1, 0.37, 0.62, 0.94]) {
      expect(plungerTravel(phase + 3)).toBeCloseTo(plungerTravel(phase), 6)
      expect(plungerTravel(phase - 2)).toBeCloseTo(plungerTravel(phase), 6)
    }
  })

  it("is on the upstroke over the first half and the downstroke over the second", () => {
    expect(strokeDirection(0.2)).toBe(1)
    expect(strokeDirection(0.8)).toBe(-1)
    expect(strokeDirection(1.2)).toBe(1)
  })

  it("gives the bottom of the stroke for a non-finite cycle", () => {
    expect(plungerTravel(Number.NaN)).toBe(0)
    expect(strokeDirection(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("rodpump — the field formulas", () => {
  it("computes the fluid load as 0.34 D squared G L", () => {
    // A 1.75 in plunger lifting 0.9 gravity fluid 4200 ft.
    expect(fluidLoad(defaultPumpGeometry)).toBeCloseTo(0.34 * 1.75 ** 2 * 0.9 * 4200, 4)
  })

  it("scales the fluid load with the square of the plunger bore", () => {
    const small = fluidLoad({ ...defaultPumpGeometry, plungerDiameter: 1.25 })
    const large = fluidLoad({ ...defaultPumpGeometry, plungerDiameter: 2.5 })

    expect(large / small).toBeCloseTo(4, 6)
  })

  it("computes the plunger area", () => {
    expect(plungerArea(defaultPumpGeometry)).toBeCloseTo(Math.PI * 0.875 ** 2, 4)
  })

  it("computes displacement as 0.1166 D squared S N, and produces only the fillage", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.6 }
    const { displacement, production } = pumpDisplacement(geometry)

    expect(displacement).toBeCloseTo(0.1166 * 1.75 ** 2 * 86 * 8, 3)
    expect(production).toBeCloseTo(displacement * 0.6, 6)
  })

  it("never returns a negative or non-finite quantity from rubbish input", () => {
    const rubbish = {
      ...defaultPumpGeometry,
      plungerDiameter: Number.NaN,
      netLift: Number.NEGATIVE_INFINITY,
      strokeLength: -12,
      fillage: 4,
    }

    expect(Number.isFinite(fluidLoad(rubbish))).toBe(true)
    expect(fluidLoad(rubbish)).toBeGreaterThanOrEqual(0)
    const { displacement, production } = pumpDisplacement(rubbish)
    expect(Number.isFinite(displacement)).toBe(true)
    expect(production).toBeLessThanOrEqual(displacement)
  })
})

describe("rodpump — the card", () => {
  it("carries the fluid load up and nothing down, for a full pump", () => {
    const card = (cycle: number) => pumpLoad(cycle, "full", defaultPumpGeometry)

    expect(card(0.25)).toBeCloseTo(1, 2) // mid-upstroke: the column is on the rods
    expect(card(0.75)).toBeCloseTo(0, 2) // mid-downstroke: it is on the tubing
    expect(card(0.002)).toBeLessThan(0.5) // the pick-up has not finished
  })

  it("holds full load down to the liquid level and then drops, under fluid pound", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.55 }
    // Travel 0.8 on the downstroke is still above the liquid: the plunger is
    // falling through a void with the whole column still on the rods.
    const above = pumpLoad(cycleForTravel(0.8, 0.75), "pound", geometry)
    const below = pumpLoad(cycleForTravel(0.35, 0.75), "pound", geometry)

    expect(above).toBeGreaterThan(0.9)
    expect(below).toBeLessThan(0.1)
    expect(tvOpenTravel(pumpRegime("pound", geometry))).toBeCloseTo(0.55, 6)
  })

  it("picks up late as well, when the gas below has to be expanded first", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.5 }
    const at = (travel: number, condition: PumpCondition) =>
      pumpLoad(cycleForTravel(travel, 0.25), condition, geometry)

    // A barrel that fills is carrying the column within a few percent of the
    // stroke; a gassy one is still giving the clearance gas its volume back, so
    // the standing valve has not lifted and the pick-up is drawn out behind it.
    expect(svOpenTravel(pumpRegime("gas", geometry))).toBeGreaterThan(0.05)
    expect(svOpenTravel(pumpRegime("full", geometry))).toBeLessThan(0.01)
    expect(at(0.04, "gas")).toBeLessThan(at(0.04, "full") - 0.15)
    expect(at(0.25, "gas")).toBeGreaterThan(0.95)
  })

  it("bleeds the load off gradually under gas interference, and opens the valve higher", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.55 }
    const gas = pumpRegime("gas", geometry)
    const pound = pumpRegime("pound", geometry)

    // Gas below the plunger compresses, so the travelling valve opens above the
    // liquid instead of on contact with it.
    expect(tvOpenTravel(gas)).toBeGreaterThan(tvOpenTravel(pound))
    // And the load comes off over that travel instead of all at once.
    const at = (travel: number) => pumpLoad(cycleForTravel(travel, 0.75), "gas", geometry)
    expect(at(0.95)).toBeGreaterThan(at(0.85))
    expect(at(0.85)).toBeGreaterThan(at(0.72))
    expect(at(0.5)).toBeCloseTo(0, 2)
  })

  it("degenerates to the full card when the barrel fills, for both gassy conditions", () => {
    const full = { ...defaultPumpGeometry, fillage: 1 }
    for (const condition of ["gas", "pound"] as const) {
      for (const cycle of [0.12, 0.3, 0.55, 0.7, 0.9]) {
        expect(pumpLoad(cycle, condition, full)).toBeCloseTo(
          pumpLoad(cycle, "full", full),
          1,
        )
      }
    }
  })

  it("cannot carry the whole column to the top when the travelling valve slips", () => {
    const geometry = { ...defaultPumpGeometry, leak: 0.5 }
    const top = pumpLoad(cycleForTravel(0.98, 0.25), "tv-leak", geometry)
    const early = pumpLoad(cycleForTravel(0.2, 0.25), "tv-leak", geometry)

    expect(top).toBeLessThan(early)
    expect(top).toBeCloseTo(1 - 0.5 * 0.98, 1)
  })

  it("keeps load on the rods at the bottom when the standing valve leaks back", () => {
    const geometry = { ...defaultPumpGeometry, leak: 0.5 }
    const leaky = pumpLoad(cycleForTravel(0.03, 0.75), "sv-leak", geometry)
    const sound = pumpLoad(cycleForTravel(0.03, 0.75), "full", geometry)

    expect(leaky).toBeGreaterThan(sound + 0.05)
  })

  it("spikes above the fluid load only at the bottom, when the plunger tags", () => {
    const geometry = defaultPumpGeometry
    const bottom = pumpLoad(0, "tagging", geometry)
    const middle = pumpLoad(0.25, "tagging", geometry)

    expect(bottom).toBeGreaterThan(1)
    expect(middle).toBeCloseTo(pumpLoad(0.25, "full", geometry), 6)
  })

  it("closes the card, keeps every sample finite, and reports its own peak", () => {
    for (const condition of CONDITIONS) {
      const card = pumpCard(condition, { ...defaultPumpGeometry, fillage: 0.6 })

      expect(card.points.length).toBeGreaterThan(24)
      expect(card.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
      expect(card.points.every((p) => p.x >= 0 && p.x <= 1)).toBe(true)
      expect(card.peak).toBeGreaterThan(0.5)
      expect(Math.max(...card.points.map((p) => p.y))).toBeCloseTo(card.peak, 6)
      // The dot rides the card it was sampled from.
      const first = card.points[0]
      expect(first.x).toBeCloseTo(plungerTravel(0), 6)
      expect(first.y).toBeCloseTo(pumpLoad(0, condition, { ...defaultPumpGeometry, fillage: 0.6 }), 6)
    }
  })

  it("encloses area — a card that is a line is a pump doing no work", () => {
    for (const condition of CONDITIONS) {
      const { points } = pumpCard(condition, { ...defaultPumpGeometry, fillage: 0.6 })
      const area = points.reduce((sum, p, index) => {
        const next = points[(index + 1) % points.length]
        return sum + (p.x * next.y - next.x * p.y)
      }, 0)

      // Right along the top under load and back left along the bottom: a
      // dynamometer card is traversed clockwise, so the shoelace sum is
      // negative, and its magnitude is the work the plunger did.
      expect(area / 2).toBeLessThan(-0.2)
    }
  })
})

describe("rodpump — the valves", () => {
  it("passes the plunger's rate through the standing valve going up", () => {
    const valves = pumpValves(0.25, "full", defaultPumpGeometry)

    expect(valves.travellingFlow).toBe(0)
    expect(valves.standingFlow).toBeCloseTo(1, 2) // mid-upstroke: peak rate
    expect(valves.direction).toBe(1)
  })

  it("passes it through the travelling valve coming down", () => {
    const valves = pumpValves(0.75, "full", defaultPumpGeometry)

    expect(valves.travellingFlow).toBeCloseTo(1, 2)
    expect(valves.standingFlow).toBe(0)
    expect(valves.direction).toBe(-1)
  })

  it("rides a ball up its cage on the flow instead of switching it", () => {
    const lifts = Array.from({ length: 200 }, (_, index) =>
      pumpValves(index / 200, "full", defaultPumpGeometry).standing,
    )

    // Off its seat somewhere in between for a real part of the stroke, rather
    // than only ever at one end or the other.
    expect(lifts.filter((lift) => lift > 0.05 && lift < 0.95).length).toBeGreaterThan(8)
    expect(Math.max(...lifts)).toBeCloseTo(1, 6)
    expect(Math.min(...lifts)).toBe(0)
    // Cracking open is a pressure force and is quick; settling back is the flow
    // dying under it, and that has to be gradual or the ball is a switch again.
    const closing = lifts.slice(0, 100).filter((lift, index, all) => index > 0 && lift < all[index - 1])
    const steps = closing.map((lift, index) => (index ? Math.abs(lift - closing[index - 1]) : 0))
    expect(closing.length).toBeGreaterThan(12)
    expect(Math.max(...steps)).toBeLessThan(0.1)
  })

  it("sets the lift from the flow, saturating at the cage", () => {
    expect(ballLift(0)).toBe(0)
    expect(ballLift(BALL_FLOAT / 2)).toBeCloseTo(0.5, 6)
    expect(ballLift(BALL_FLOAT * 4)).toBe(1)
    expect(ballLift(-BALL_FLOAT)).toBe(1) // direction is the caller's business
    expect(ballLift(Number.NaN)).toBe(0)
  })

  it("holds the travelling valve shut, and moves nothing, through a fluid pound", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.5 }
    // Falling through the void: no flow, so the ball stays on its seat.
    const falling = pumpValves(cycleForTravel(0.8, 0.75), "pound", geometry)
    expect(falling.travellingFlow).toBe(0)
    expect(falling.travelling).toBe(0)
    // Then it finds the liquid, at whatever rate the plunger is already doing.
    const landed = pumpValves(cycleForTravel(0.3, 0.75), "pound", geometry)
    expect(landed.travellingFlow).toBeGreaterThan(0.5)
    expect(landed.travelling).toBe(1)
  })

  it("delays the standing valve while the gas below the plunger expands", () => {
    const gassy = { ...defaultPumpGeometry, fillage: 0.5 }

    expect(pumpValves(cycleForTravel(0.02, 0.25), "gas", gassy).standingFlow).toBe(0)
    expect(pumpValves(cycleForTravel(0.4, 0.25), "gas", gassy).standingFlow).toBeGreaterThan(0.5)
    // A barrel that fills has no gas to expand, so the valve lifts at once.
    expect(pumpValves(cycleForTravel(0.2, 0.25), "full", gassy).standingFlow).toBeGreaterThan(0.5)
  })

  it("charges the barrel to the fillage and no further", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.45 }

    expect(pumpValves(0.5, "pound", geometry).charge).toBeCloseTo(0.45, 2)
    expect(pumpValves(0, "pound", geometry).charge).toBeCloseTo(0, 2)
    // Falling through the void, the liquid stays where it is until contact.
    expect(pumpValves(cycleForTravel(0.7, 0.75), "pound", geometry).charge).toBeCloseTo(0.45, 2)
    expect(pumpValves(cycleForTravel(0.2, 0.75), "pound", geometry).charge).toBeCloseTo(0.2, 2)
  })

  it("keeps every flow finite and signed the one way it can go", () => {
    for (const condition of CONDITIONS) {
      for (let index = 0; index < 120; index += 1) {
        const flow = valveFlow(index / 120, condition, { ...defaultPumpGeometry, fillage: 0.6 })
        expect(Number.isFinite(flow.travelling) && Number.isFinite(flow.standing)).toBe(true)
        expect(flow.travelling).toBeGreaterThanOrEqual(0)
        expect(flow.standing).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe("rodpump — the chamber the two valves share", () => {
  it("runs between intake and discharge pressure and never outside", () => {
    for (const condition of CONDITIONS) {
      for (let index = 0; index < 200; index += 1) {
        const p = chamberPressure(index / 200, condition, { ...defaultPumpGeometry, fillage: 0.6 })
        expect(Number.isFinite(p)).toBe(true)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    }
  })

  it("falls to intake going up and rises to discharge coming down", () => {
    const at = (cycle: number) => chamberPressure(cycle, "full", defaultPumpGeometry)

    expect(at(0)).toBeCloseTo(1, 2) // on bottom, still holding the discharge column
    expect(at(0.25)).toBeCloseTo(0, 2) // mid-upstroke, drawing off the formation
    expect(at(0.75)).toBeCloseTo(1, 2) // mid-downstroke, pushing through the plunger
  })

  it("never lets both balls pass at once — one chamber cannot be at both pressures", () => {
    for (const condition of CONDITIONS) {
      for (let index = 0; index < 240; index += 1) {
        const flow = valveFlow(index / 240, condition, { ...defaultPumpGeometry, fillage: 0.6 })
        expect(flow.travelling * flow.standing).toBe(0)
      }
    }
  })

  it("holds both balls down for longer the more gas there is to shift", () => {
    const shut = (condition: PumpCondition, fill: number) =>
      Array.from({ length: 400 }, (_, index) =>
        pumpState(index / 400, condition, { ...defaultPumpGeometry, fillage: fill }),
      ).filter((state) => state === "picking-up" || state === "releasing").length

    // A barrel that fills transfers at each end almost the instant the plunger
    // reverses: there is nothing between the liquid and the plunger to shift.
    // A pounding one has to fall through its void before anything happens.
    expect(shut("full", 1)).toBeLessThan(shut("pound", 0.5))
    // And a gassy one is worse than either, because gas is the only one of the
    // three that has to be *compressed* on the way down and *expanded* on the
    // way back up — both balls down at both ends, for a fifth of the stroke.
    expect(shut("pound", 0.5)).toBeLessThan(shut("gas", 0.5))
  })

  it("names all four sides of the card", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.5 }
    const seen = new Set(
      Array.from({ length: 400 }, (_, index) => pumpState(index / 400, "gas", geometry)),
    )

    expect(seen).toEqual(new Set(["picking-up", "filling", "releasing", "discharging"]))
  })
})

describe("rodpump — what actually reaches surface", () => {
  it("takes fillage, valve slip and backflow off the swept volume", () => {
    const geometry = { ...defaultPumpGeometry, fillage: 0.5, leak: 0.5 }

    expect(volumetricEfficiency(pumpRegime("full", geometry))).toBeCloseTo(1, 6)
    // A gassy pump only fills to its fillage.
    expect(volumetricEfficiency(pumpRegime("gas", geometry))).toBeCloseTo(0.5, 6)
    // A valve that no longer seals fills fully and still delivers less.
    expect(volumetricEfficiency(pumpRegime("tv-leak", geometry))).toBeCloseTo(0.5, 6)
    expect(volumetricEfficiency(pumpRegime("sv-leak", geometry))).toBeLessThan(0.9)
  })

  it("reports the production the pump is losing, not the one it displaces", () => {
    const geometry = { ...defaultPumpGeometry, leak: 0.5 }
    const sound = solveRodPump(0.25, "full", geometry)
    const leaky = solveRodPump(0.25, "tv-leak", geometry)

    expect(leaky.displacement).toBeCloseTo(sound.displacement, 6)
    expect(leaky.production).toBeCloseTo(sound.production * 0.5, 6)
    expect(leaky.efficiency).toBeCloseTo(0.5, 6)
  })
})

describe("rodpump — the pose", () => {
  it("reports the load in pounds against the solved fluid load", () => {
    const pose = solveRodPump(0.25, "full", defaultPumpGeometry)

    expect(pose.fluidLoad).toBeCloseTo(fluidLoad(defaultPumpGeometry), 6)
    expect(pose.rodLoad).toBeCloseTo(pose.load * pose.fluidLoad, 6)
    expect(pose.travel).toBeCloseTo(0.5, 6)
  })

  it("survives rubbish input with a finite pose at the bottom of the stroke", () => {
    const pose = solveRodPump(Number.NaN, "full", {
      ...defaultPumpGeometry,
      fillage: Number.NaN,
      intakeRatio: Number.NEGATIVE_INFINITY,
      leak: Number.NaN,
    })

    for (const value of [pose.travel, pose.load, pose.charge, pose.rodLoad, pose.production]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(pose.travel).toBe(0)
  })

  it("falls back to the full-pump regime for an unknown condition", () => {
    const rogue = solveRodPump(0.25, "wildcat" as PumpCondition, defaultPumpGeometry)

    expect(rogue.load).toBeCloseTo(solveRodPump(0.25, "full", defaultPumpGeometry).load, 6)
  })
})

describe("rodpump — driving it by hand", () => {
  it("finds the cycle that puts the plunger at a travel", () => {
    for (const travel of [0, 0.2, 0.5, 0.85, 1]) {
      expect(plungerTravel(cycleForTravel(travel, 0.25))).toBeCloseTo(travel, 6)
    }
  })

  it("stays on the branch it is already on", () => {
    // Mid-upstroke, asked for a travel further up: keep going up.
    expect(cycleForTravel(0.8, 0.3)).toBeLessThan(0.5)
    // Just over the top and asked to come down: turn over rather than reverse.
    expect(cycleForTravel(0.9, 0.52)).toBeGreaterThan(0.5)
  })

  it("clamps a travel outside the stroke instead of failing", () => {
    expect(Number.isFinite(cycleForTravel(4, 0.25))).toBe(true)
    expect(plungerTravel(cycleForTravel(-3, 0.25))).toBeCloseTo(0, 6)
    expect(Number.isFinite(cycleForTravel(Number.NaN, Number.NaN))).toBe(true)
  })
})
