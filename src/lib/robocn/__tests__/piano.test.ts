import { describe, expect, it } from "vitest"

import {
  actionPose,
  damperLift,
  hammerPose,
  lidPose,
  pianoKeys,
  pianoLayout,
  pianoScale,
} from "@/lib/robocn/piano"

describe("the grand action", () => {
  it("multiplies three levers, and the hammer stops when the jack trips", () => {
    const geometry = { dip: 1, balance: 0.5, wippen: 1.2, lever: 8, blow: 4.6, letOff: 0.2 }
    const half = actionPose(0.5, geometry)

    // Key, wippen, hammer: the ratio is the product, not a number.
    expect(half.ratio).toBeCloseTo(0.5 * 1.2 * 8, 10)
    expect(half.hammer).toBeCloseTo(0.5 * half.ratio, 10)
    expect(half.escaped).toBe(false)

    // The jack trips with the blow all but covered, and after that the hammer
    // holds where it was left however much further the key goes.
    const bottom = actionPose(1, geometry)
    expect(bottom.escapeDip).toBeCloseTo((4.6 - 0.2) / half.ratio, 10)
    expect(bottom.escaped).toBe(true)
    expect(bottom.hammer).toBeCloseTo(4.4, 10)
    expect(bottom.gap).toBeCloseTo(0.2, 10)
    expect(bottom.afterTouch).toBeGreaterThan(0)
    expect(bottom.jack).toBeGreaterThan(0)
  })

  it("reports an action geared too low to escape at all", () => {
    // Half the ratio, so the key bottoms with the hammer still short.
    const soft = actionPose(1, { lever: 3, blow: 4.6, letOff: 0.2 })
    expect(soft.regulated).toBe(false)
    expect(soft.escaped).toBe(false)
    expect(soft.gap).toBeGreaterThan(0.2)
  })

  it("leaves the string, is caught by the check, and only then goes home", () => {
    const strike = hammerPose(1, 1)
    expect(strike.contact).toBe(true)
    expect(strike.travel).toBeCloseTo(4.6, 6)

    const caught = hammerPose(0, 0.6)
    expect(caught.checked).toBe(true)
    expect(caught.travel).toBeLessThan(strike.travel)
    expect(caught.travel).toBeGreaterThan(0)

    // The key is held while the note rings, so it comes home with the sound.
    expect(caught.dip).toBeCloseTo(0.6, 10)
    expect(hammerPose(0, 0).travel).toBe(0)
    expect(hammerPose(0, 0.05).travel).toBeLessThan(caught.travel)
  })

  it("keeps the damper on the string for the first half of the dip", () => {
    expect(damperLift(0.3)).toBe(0)
    expect(damperLift(0.6)).toBeGreaterThan(0)
    expect(damperLift(1)).toBe(1)
    // The pedal takes every damper off whatever the keys are doing.
    expect(damperLift(0, { pedal: 1 })).toBe(1)
  })

  it("stays neutral on nonsense", () => {
    const pose = actionPose(Number.NaN, { dip: Number.NaN, lever: Number.NaN })
    expect(pose.dip).toBe(0)
    expect(pose.hammer).toBe(0)
    expect(Number.isFinite(pose.angle)).toBe(true)
    expect(damperLift(Number.NaN)).toBe(0)
    expect(hammerPose(Number.NaN, Number.NaN).travel).toBe(0)
  })
})

describe("the scale", () => {
  const strings = pianoScale()

  it("halves per octave at the top and is short of it in the bass", () => {
    const top = strings[87]!
    const octaveDown = strings[75]!

    // Within three percent of a halving across the top octave: the compression
    // is there all the way up, it is just not worth anything yet.
    const doubling = octaveDown.speaking / top.speaking
    expect(doubling).toBeGreaterThan(1.94)
    expect(doubling).toBeLessThanOrEqual(2)
    expect(top.foreshortening).toBeCloseTo(0, 6)
    expect(octaveDown.foreshortening).toBeLessThan(0.05)

    // The bottom note is a fraction of what an ideal scale would have asked
    // for, which is the whole reason the bass is wound.
    const bottom = strings[0]!
    expect(bottom.ideal).toBeGreaterThan(bottom.speaking * 3)
    expect(bottom.foreshortening).toBeGreaterThan(0.6)
    expect(bottom.wound).toBe(true)
    expect(top.wound).toBe(false)
  })

  it("gets longer all the way down, and falls further short all the way down", () => {
    for (let index = 1; index < strings.length; index += 1) {
      expect(strings[index]!.speaking).toBeLessThan(strings[index - 1]!.speaking)
      expect(strings[index]!.foreshortening).toBeLessThanOrEqual(
        strings[index - 1]!.foreshortening + 1e-9,
      )
    }
    expect(strings[0]!.choir).toBe(1)
    expect(strings[87]!.choir).toBe(3)
  })

  it("moves the strike point, so the capo line is a curve", () => {
    const layout = pianoLayout({ strike: 12 })
    expect(strings[0]!.strike / strings[0]!.speaking).toBeCloseTo(1 / 8, 2)
    expect(strings[87]!.strike / strings[87]!.speaking).toBeCloseTo(1 / 16, 2)

    // Every agraffe stands one strike point in front of the hammer line, every
    // tuning pin a fixed run in front of its own agraffe.
    for (const string of layout.strings) {
      expect(string.agraffe.y).toBeCloseTo(12 - string.strike, 9)
      expect(string.agraffe.y - string.pin.y).toBeCloseTo(2.6, 9)
    }
    const capo = layout.capo
    expect(capo[0]!.y).toBeGreaterThan(capo[capo.length - 1]!.y)
  })

  it("puts the bass on its own bridge, crossing the others and reaching less far back", () => {
    const layout = pianoLayout({ strike: 12, overstrung: 18 })
    expect(layout.bassBridge).toHaveLength(18)
    expect(layout.bridge).toHaveLength(88 - 18)

    const bottom = layout.strings[0]!
    expect(bottom.crossed).toBe(true)
    // Angled toward the middle, which is what carries it over the long bridge.
    expect(bottom.bridge.x).toBeLessThan(bottom.pin.x - 5)
    // A string run at an angle reaches less far down the case than its length.
    expect(bottom.bridge.y - bottom.agraffe.y).toBeLessThan(bottom.speaking)
    expect(Math.hypot(bottom.bridge.x - bottom.agraffe.x, bottom.bridge.y - bottom.agraffe.y))
      .toBeCloseTo(bottom.speaking, 6)

    // A note that is not crossed runs straight back, so its length is its run.
    const straight = layout.strings[40]!
    expect(straight.bridge.x).toBeCloseTo(straight.pin.x, 9)
    expect(straight.bridge.y - straight.agraffe.y).toBeCloseTo(straight.speaking, 9)
  })

  it("draws the case around the strings, straight down the spine", () => {
    const layout = pianoLayout({ strike: 12, halfWidth: 22, margin: 4, front: 0 })
    expect(layout.depth).toBeGreaterThan(layout.strings[0]!.bridge.y)
    for (const point of layout.rim) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(26 + 1e-9)
      expect(point.y).toBeGreaterThanOrEqual(-1e-9)
    }
    // Every hitch pin has to be inside the case it is pulling against.
    for (const string of layout.strings) {
      expect(string.hitchPin.y).toBeLessThan(layout.depth)
      expect(Math.abs(string.hitchPin.x)).toBeLessThan(26)
    }
    // The spine is snapped straight onto its line; the bent side is an offset
    // of a curve, so it only comes close to the corner.
    expect(Math.max(...layout.rim.map((point) => point.x))).toBeCloseTo(26, 9)
    expect(Math.min(...layout.rim.map((point) => point.x))).toBeLessThan(-25)
  })
})

describe("the lid and the keyboard", () => {
  it("solves the lid angle from its prop stick", () => {
    const shut = lidPose("closed", { width: 52 })
    const short = lidPose("half", { width: 52 })
    const long = lidPose("full", { width: 52 })

    expect(shut.angle).toBe(0)
    expect(short.angle).toBeGreaterThan(15)
    expect(long.angle).toBeGreaterThan(short.angle + 15)
    expect(long.stands).toBe(true)

    // Three sides: lengthen the stick and the lid stands higher, until the
    // stick is too long for the triangle to close at all.
    expect(lidPose("full", { width: 52, stick: 40 }).angle).toBeGreaterThan(long.angle)
    const impossible = lidPose("full", { width: 52, stick: 400 })
    expect(impossible.stands).toBe(false)
    expect(impossible.angle).toBe(0)
  })

  it("lays 88 keys out with the bottom note at the bass edge", () => {
    const keys = pianoKeys(88, { span: 48 })
    expect(keys).toHaveLength(88)
    expect(keys.filter((key) => key.natural)).toHaveLength(52)

    // A0 at one edge, C8 at the other, and the sharps narrower and shorter.
    expect(keys[0]!.natural).toBe(true)
    expect(keys[0]!.x).toBeGreaterThan(keys[87]!.x)
    expect(keys[1]!.natural).toBe(false)
    expect(keys[1]!.width).toBeLessThan(keys[0]!.width)
    expect(keys[1]!.length).toBeLessThan(keys[0]!.length)
    for (let index = 1; index < keys.length; index += 1) {
      expect(keys[index]!.x).toBeLessThan(keys[index - 1]!.x)
    }
  })
})
