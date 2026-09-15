import { describe, expect, it } from "vitest"

import { toRadians } from "@/lib/robocn/kinematics"
import {
  camOutline,
  camProfile,
  camRadius,
  defaultCamGeometry,
  defaultErgGeometry,
  defaultSledGeometry,
  defaultStackGeometry,
  defaultTrainerGeometry,
  ergAt,
  reeveStack,
  solveCam,
  solveErgCycle,
  solveSled,
  solveTrainer,
  trainerFootPath,
} from "@/lib/robocn/gym"

/* -------------------------------------------------------------------------- */

describe("the reeving ratio", () => {
  it("shares the draw between the lines: twice the reeving, half the travel", () => {
    const two = reeveStack(40, { ...defaultStackGeometry, lines: 2 })
    const four = reeveStack(40, { ...defaultStackGeometry, lines: 4 })

    expect(two.rise).toBeCloseTo(20, 9)
    expect(four.rise).toBeCloseTo(10, 9)
    expect(two.advantage).toBe(2)
    expect(four.advantage).toBe(4)
  })

  it("reports the handle force as the selected weight over the advantage", () => {
    const lift = reeveStack(10, { ...defaultStackGeometry, pin: 5, plateWeight: 5, lines: 2 })

    // Six plates ride the pin, at five a plate, through two falling lines.
    expect(lift.selected).toBe(6)
    expect(lift.weight).toBe(30)
    expect(lift.handleForce).toBe(15)
  })

  it("splits the stack at the pin: above it rises, below it stays put", () => {
    const rest = reeveStack(0, { ...defaultStackGeometry, pin: 3 })
    const drawn = reeveStack(30, { ...defaultStackGeometry, pin: 3 })

    expect(drawn.plates.filter((plate) => plate.rising)).toHaveLength(4)
    for (const plate of drawn.plates) {
      const before = rest.plates[plate.index].y
      expect(plate.y - before).toBeCloseTo(plate.rising ? drawn.rise : 0, 9)
    }
  })

  it("stops at the crown rather than lifting the stack through it", () => {
    const geometry = { ...defaultStackGeometry, headroom: 20, lines: 2 }

    expect(reeveStack(40, geometry).rise).toBeCloseTo(20, 9)
    expect(reeveStack(40, geometry).atLimit).toBe(false)
    expect(reeveStack(200, geometry).rise).toBeCloseTo(20, 9)
    expect(reeveStack(200, geometry).atLimit).toBe(true)
  })

  it("survives rubbish: a non-finite draw and a pin off the end of the stack", () => {
    const lift = reeveStack(Number.NaN, { ...defaultStackGeometry, pin: 99 })

    expect(lift.rise).toBe(0)
    expect(lift.pin).toBe(defaultStackGeometry.plates - 1)
    expect(lift.plates.every((plate) => Number.isFinite(plate.y))).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */

describe("the cam radius", () => {
  it("is the moment arm — one number, not two", () => {
    for (const angle of [0, 27, 55, 91, 120]) {
      const pose = solveCam(angle)
      expect(pose.momentArm).toBe(pose.radius)
      expect(pose.radius).toBeCloseTo(camRadius(angle), 12)
    }
  })

  it("peaks where the strength curve does and falls back to the base radius", () => {
    const { baseRadius, peakRadius, peakAngle, sweep } = defaultCamGeometry

    expect(solveCam(peakAngle).radius).toBeCloseTo(peakRadius, 9)
    expect(solveCam(sweep).radius).toBeCloseTo(baseRadius, 9)
    expect(solveCam(0).radius).toBeLessThan(peakRadius)
  })

  it("pays out the integral of r dθ, so the stack does not track the lever", () => {
    const quarter = [0, 30, 60, 90, 120].map((angle) => solveCam(angle).payout)
    const steps = [1, 2, 3, 4].map((index) => quarter[index] - quarter[index - 1])

    // Equal lever steps, very unequal payout: that is the whole mechanism.
    expect(Math.max(...steps)).toBeGreaterThan(Math.min(...steps) * 2)
    // And half the sweep is not half the payout.
    expect(solveCam(60).payout).not.toBeCloseTo(solveCam(120).payout / 2, 2)
  })

  it("integrates a constant-radius cam exactly, which is the case with an answer", () => {
    const round = { ...defaultCamGeometry, baseRadius: 12, peakRadius: 12 }

    expect(solveCam(90, round).payout).toBeCloseTo(12 * toRadians(90), 9)
    expect(solveCam(90, round).linearPayout).toBeCloseTo(12 * toRadians(90), 9)
  })

  it("draws the profile at the radii it solves, so the cam is the curve", () => {
    const steps = 24
    const profile = camProfile(defaultCamGeometry, steps)

    profile.forEach((point, index) => {
      const angle = (index / steps) * defaultCamGeometry.sweep
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(camRadius(angle), 9)
    })
  })

  it("leaves the groove on a tangent, so the moment arm is the radius exactly", () => {
    for (const angle of [0, 27, 55, 91, 120]) {
      const pose = solveCam(angle)
      // Perpendicular distance from the pivot to the run out to the anchor.
      const run = { x: pose.anchor.x - pose.departure.x, y: pose.anchor.y - pose.departure.y }
      const length = Math.hypot(run.x, run.y)
      const perpendicular = Math.abs(pose.departure.x * run.y - pose.departure.y * run.x) / length

      expect(perpendicular).toBeCloseTo(pose.momentArm, 9)
      expect(Math.hypot(pose.departure.x, pose.departure.y)).toBeCloseTo(pose.radius, 9)
    }
  })

  it("turns the profile so the radius reaching the cable is the one it solved", () => {
    for (const angle of [0, 40, 120]) {
      const pose = solveCam(angle)
      const outline = camOutline(pose, defaultCamGeometry, 240)
      const nearest = outline.reduce((best, point) =>
        Math.hypot(point.x - pose.departure.x, point.y - pose.departure.y) <
        Math.hypot(best.x - pose.departure.x, best.y - pose.departure.y)
          ? point
          : best,
      )

      // The point of the outline that has arrived at the departure is the one
      // whose radius the solver reported.
      expect(Math.hypot(nearest.x, nearest.y)).toBeCloseTo(pose.radius, 2)
    }
  })

  it("turns the cam forward with the lever, as a keyed cam does", () => {
    const spins = [0, 30, 60, 90, 120].map((angle) => solveCam(angle).spin)

    for (let index = 1; index < spins.length; index += 1) {
      expect(spins[index]).toBeGreaterThan(spins[index - 1])
    }
    // And it is within a few degrees of the lever's own travel, because the
    // departure point only wanders as far as the radius changes.
    expect(spins[4] - spins[0]).toBeGreaterThan(100)
    expect(spins[4] - spins[0]).toBeLessThan(140)
  })

  it("clamps a lever driven past its stops instead of unwinding the cam", () => {
    expect(solveCam(-40).angle).toBe(0)
    expect(solveCam(1e4).angle).toBe(defaultCamGeometry.sweep)
    expect(solveCam(Number.NaN).payout).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */

describe("the rail angle", () => {
  it("loads the sled with the component along the rails", () => {
    const at = (railAngle: number) => solveSled(1, { ...defaultSledGeometry, railAngle, weight: 100 })

    expect(at(30).load).toBeCloseTo(50, 9)
    expect(at(45).load).toBeCloseTo(70.71, 2)
    expect(at(90).load).toBeCloseTo(100, 9)
  })

  it("carries no load at all on flat rails", () => {
    const flat = solveSled(1, { ...defaultSledGeometry, railAngle: 0, weight: 100 })

    expect(flat.load).toBeCloseTo(0, 9)
    expect(flat.lift).toBeCloseTo(0, 9)
  })

  it("puts the carriage on the rail, at the stroke's share of the travel", () => {
    const pose = solveSled(0.5)
    const [foot, top] = pose.rail

    expect(Math.hypot(pose.carriage.x - foot.x, pose.carriage.y - foot.y)).toBeCloseTo(
      defaultSledGeometry.travel / 2,
      9,
    )
    expect(Math.hypot(top.x - foot.x, top.y - foot.y)).toBeCloseTo(defaultSledGeometry.travel, 9)
  })

  it("clamps the stroke and survives a rubbish rail", () => {
    expect(solveSled(4).stroke).toBe(1)
    expect(solveSled(-4).stroke).toBe(0)
    const rubbish = solveSled(Number.NaN, { ...defaultSledGeometry, railAngle: Number.NaN })
    expect(Number.isFinite(rubbish.load) && Number.isFinite(rubbish.carriage.y)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */

describe("the coupler curve", () => {
  it("closes: a whole turn of the crank comes back to where it started", () => {
    const first = solveTrainer(0).foot
    const round = solveTrainer(360).foot

    expect(round.x).toBeCloseTo(first.x, 9)
    expect(round.y).toBeCloseTo(first.y, 9)
  })

  it("holds the footpad rigidly on the coupler through the whole turn", () => {
    for (let angle = 0; angle < 360; angle += 15) {
      const pose = solveTrainer(angle)
      expect(pose.assembled).toBe(true)
      expect(Math.hypot(pose.foot.x - pose.crankPin.x, pose.foot.y - pose.crankPin.y)).toBeCloseTo(
        Math.hypot(defaultTrainerGeometry.padAlong, defaultTrainerGeometry.padOffset),
        9,
      )
    }
  })

  it("draws a path that is not the crank circle — the linkage amplifies it", () => {
    const path = trainerFootPath()

    expect(path.stride).toBeGreaterThan(defaultTrainerGeometry.crank * 2)
    expect(path.stride).toBeGreaterThan(path.rise)
  })

  it("reports a stride that moves when the linkage does", () => {
    const base = trainerFootPath().stride
    const longer = trainerFootPath({ ...defaultTrainerGeometry, crank: 46 }).stride
    const shorter = trainerFootPath({ ...defaultTrainerGeometry, rocker: 70 }).stride

    expect(longer).toBeGreaterThan(base)
    expect(shorter).not.toBeCloseTo(base, 1)
  })

  it("keeps a rubbish crank angle on the loop instead of returning NaN", () => {
    const pose = solveTrainer(Number.NaN)

    expect(Number.isFinite(pose.foot.x) && Number.isFinite(pose.foot.y)).toBe(true)
    expect(Number.isFinite(pose.grip.x) && Number.isFinite(pose.grip.y)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */

describe("velocity-squared drag", () => {
  it("takes the drag factor from the vent and nothing else", () => {
    const shut = solveErgCycle({ ...defaultErgGeometry, vent: 0 })
    const open = solveErgCycle({ ...defaultErgGeometry, vent: 1 })

    expect(shut.dragFactor).toBeCloseTo(defaultErgGeometry.dragShut / defaultErgGeometry.inertia, 9)
    expect(open.dragFactor).toBeCloseTo(defaultErgGeometry.dragOpen / defaultErgGeometry.inertia, 9)
    expect(open.dragFactor).toBeGreaterThan(shut.dragFactor)
  })

  it("holds the handle against k·ω², so opening the vent costs force not speed", () => {
    const shut = solveErgCycle({ ...defaultErgGeometry, vent: 0 })
    const open = solveErgCycle({ ...defaultErgGeometry, vent: 1 })
    const ratio = defaultErgGeometry.dragOpen / defaultErgGeometry.dragShut

    expect(open.peakForce / shut.peakForce).toBeCloseTo(ratio, 6)
    // The chain pins the rim speed while the clutch is in, so the peak is the
    // rower's; what the vent changes is how hard the wheel is to spin and how
    // fast it gives the speed back.
    expect(open.peakSpeed).toBeCloseTo(shut.peakSpeed, 6)
    expect(open.meanSpeed).toBeLessThan(shut.meanSpeed)
  })

  it("puts the force where the speed is: engaged on the drive, free on the recovery", () => {
    const cycle = solveErgCycle()
    const driving = cycle.samples.filter((sample) => sample.engaged)
    const coasting = cycle.samples.filter((sample) => !sample.engaged)

    expect(driving.length).toBeGreaterThan(0)
    expect(coasting.length).toBeGreaterThan(0)
    expect(coasting.every((sample) => sample.force === 0)).toBe(true)
    for (const sample of driving) {
      expect(sample.force).toBeCloseTo(
        (cycle.drag * sample.speed * sample.speed) / defaultErgGeometry.sprocket,
        6,
      )
    }
  })

  it("coasts down on drag alone once the clutch lets go", () => {
    const cycle = solveErgCycle()

    // Every step with the clutch out is slower than the step before it. Taken
    // over adjacent samples rather than over the coasting ones as a set, because
    // the cycle wraps back into a coast before the catch picks it up again.
    for (let index = 1; index < cycle.samples.length; index += 1) {
      const before = cycle.samples[index - 1]
      const now = cycle.samples[index]
      if (!now.engaged) expect(now.speed).toBeLessThan(before.speed)
    }
  })

  it("comes back periodic: the stroke ends at the speed it started at", () => {
    const cycle = solveErgCycle()
    const first = cycle.samples[0]
    const last = cycle.samples[cycle.samples.length - 1]

    // The catch re-engages the clutch, so the wrap is the coast into it.
    expect(last.speed).toBeGreaterThan(0)
    expect(first.speed).toBeGreaterThan(0)
    expect(ergAt(cycle, 1).speed).toBeCloseTo(ergAt(cycle, 0).speed, 9)
  })

  it("finds the window at the catch where the handle and the seat oppose", () => {
    const cycle = solveErgCycle()
    const opposed = cycle.samples.filter((sample) => sample.handleRate * sample.seatRate < 0)

    expect(cycle.counterPhase).toBeGreaterThan(0)
    // All of it sits in the first part of the drive: the slide is still coming
    // forward while the chain has already gone taut.
    expect(Math.max(...opposed.map((sample) => sample.phase))).toBeLessThan(
      defaultErgGeometry.driveFraction,
    )
    for (const sample of opposed) {
      expect(sample.handleRate).toBeGreaterThan(0)
      expect(sample.seatRate).toBeLessThan(0)
    }
  })

  it("closes the window when the catch has no overlap in it", () => {
    expect(solveErgCycle({ ...defaultErgGeometry, catchOverlap: 0 }).counterPhase).toBe(0)
  })

  it("samples by phase, wrapping, and gives a neutral sample for an empty cycle", () => {
    const cycle = solveErgCycle()

    expect(ergAt(cycle, 1.25).handle).toBeCloseTo(ergAt(cycle, 0.25).handle, 9)
    expect(ergAt(cycle, -0.25).handle).toBeCloseTo(ergAt(cycle, 0.75).handle, 9)
    expect(ergAt(cycle, Number.NaN).speed).toBeCloseTo(ergAt(cycle, 0).speed, 9)
    expect(ergAt({ ...cycle, samples: [] }, 0.5).speed).toBe(0)
  })

  it("gives a finite cycle for a rubbish geometry", () => {
    const cycle = solveErgCycle({
      ...defaultErgGeometry,
      inertia: 0,
      vent: Number.NaN,
      rate: Number.NaN,
      sprocket: Number.NaN,
    })

    expect(Number.isFinite(cycle.dragFactor)).toBe(true)
    expect(cycle.samples.every((sample) => Number.isFinite(sample.speed) && Number.isFinite(sample.force))).toBe(true)
  })
})
