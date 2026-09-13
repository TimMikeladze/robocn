import { describe, expect, it } from "vitest"

import {
  capSolid,
  codeStrikes,
  deckFrame,
  deckPoint,
  keyTravel,
  keyboardLayout,
  keycapProfile,
  matrixScan,
  pressCurve,
  strokePresses,
  type KeyStrike,
} from "@/lib/robocn/keyboard"
import { distance3 } from "@/lib/robocn/kinematics"
import { robotCamera } from "@/lib/robocn/style"

describe("keyTravel", () => {
  it("closes the contact partway down, not at the bottom", () => {
    const half = keyTravel(0.5, { travel: 4, actuation: 2 })
    expect(half.depth).toBeCloseTo(2, 6)
    // Exactly at the actuation point counts as closed.
    expect(half.actuated).toBe(true)
    expect(half.bottomedOut).toBe(false)

    const light = keyTravel(0.4, { travel: 4, actuation: 2 })
    expect(light.actuated).toBe(false)
    expect(light.overtravel).toBe(0)

    const full = keyTravel(1, { travel: 4, actuation: 2 })
    expect(full.bottomedOut).toBe(true)
    expect(full.overtravel).toBeCloseTo(1, 6)
  })

  it("opens higher than it closed — the switch has hysteresis", () => {
    // Coming back up through 1.8 units with the contact already closed, it is
    // still closed; going down through the same point it is not yet.
    const rising = keyTravel(0.45, { travel: 4, actuation: 2, reset: 1.6, closed: true })
    const falling = keyTravel(0.45, { travel: 4, actuation: 2, reset: 1.6, closed: false })
    expect(rising.actuated).toBe(true)
    expect(falling.actuated).toBe(false)
    // Below the reset point it opens whatever it was doing.
    expect(keyTravel(0.3, { travel: 4, actuation: 2, reset: 1.6, closed: true }).actuated).toBe(
      false,
    )
  })

  it("clamps the press and stays neutral on nonsense", () => {
    expect(keyTravel(4).fraction).toBe(1)
    expect(keyTravel(-2).fraction).toBe(0)
    expect(keyTravel(Number.NaN).depth).toBe(0)
    expect(keyTravel(0.5, { travel: Number.NaN, actuation: Number.NaN }).actuated).toBe(true)
    // An actuation point past the travel can never close, and does not throw.
    expect(keyTravel(1, { travel: 4, actuation: 9 }).actuated).toBe(false)
  })
})

describe("pressCurve", () => {
  it("falls fast, bottoms out, and comes back slower on the spring", () => {
    expect(pressCurve(0)).toBe(0)
    expect(pressCurve(1)).toBe(0)
    expect(pressCurve(0.25)).toBeCloseTo(1, 6)
    // A quarter in it is already down; a quarter from the end it is still coming up.
    expect(pressCurve(0.12)).toBeGreaterThan(0.3)
    expect(pressCurve(0.12)).toBeLessThan(1)
    expect(pressCurve(0.75)).toBeGreaterThan(0)
    expect(pressCurve(0.75)).toBeLessThan(1)
    // The return is the slower half: a quarter past the peak the key is still
    // further down than it was a quarter before it.
    expect(pressCurve(0.45)).toBeGreaterThan(pressCurve(0.05))
    expect(pressCurve(Number.NaN)).toBe(0)
  })
})

describe("keyboardLayout", () => {
  it("lays rows out on one unit pitch and reports a row that does not fill the deck", () => {
    const deck = keyboardLayout(
      [
        [1, 1, 1, 1],
        [1.5, 1, 1],
      ],
      { unit: 10, gap: 1 },
    )
    expect(deck.keys).toHaveLength(7)
    expect(deck.units).toBe(4)
    expect(deck.rowUnits).toEqual([4, 3.5])
    // Widths are unit widths less one gap, so the pitch is exactly `unit`.
    expect(deck.keys[0].width).toBeCloseTo(9, 6)
    expect(deck.keys[4].width).toBeCloseTo(14, 6)
    // One pitch between neighbours, however wide the cap.
    expect(deck.keys[1].x - deck.keys[0].x).toBeCloseTo(10, 6)
    expect(deck.keys[5].x - deck.keys[4].x).toBeCloseTo(12.5, 6)
    // Rows run back to front: row 0 is furthest from the reader.
    expect(deck.keys[4].y).toBeGreaterThan(deck.keys[0].y)
    expect(deck.width).toBeCloseTo(40, 6)
  })

  it("staggers rows without changing their pitch, and indexes in scan order", () => {
    const deck = keyboardLayout([[1, 1], [1, 1]], { unit: 10, gap: 1, stagger: [0, 0.5] })
    expect(deck.keys[2].x - deck.keys[0].x).toBeCloseTo(5, 6)
    expect(deck.keys[3].x - deck.keys[2].x).toBeCloseTo(10, 6)
    expect(deck.keys.map((key) => key.index)).toEqual([0, 1, 2, 3])
    expect(deck.keys.map((key) => key.row)).toEqual([0, 0, 1, 1])
    expect(deck.keys.map((key) => key.column)).toEqual([0, 1, 0, 1])
  })

  it("survives an empty spec and nonsense widths", () => {
    expect(keyboardLayout([]).keys).toEqual([])
    const odd = keyboardLayout([[Number.NaN, 1]], { unit: Number.NaN })
    expect(odd.keys).toHaveLength(2)
    for (const key of odd.keys) {
      expect(Number.isFinite(key.x)).toBe(true)
      expect(Number.isFinite(key.width)).toBe(true)
      expect(key.width).toBeGreaterThan(0)
    }
  })
})

describe("keycapProfile", () => {
  it("sculpts the rows: the home row is the low point and the ends tilt inward", () => {
    const rows = 5
    const profile = Array.from({ length: rows }, (_, row) => keycapProfile(row, rows))
    const home = profile[2]
    for (const [row, cap] of profile.entries()) {
      if (row !== 2) expect(cap.rise).toBeGreaterThan(home.rise)
    }
    // The back rows tilt toward the reader, the front rows away.
    expect(profile[0].tilt).toBeGreaterThan(0)
    expect(profile[rows - 1].tilt).toBeLessThan(0)
    // Flat boards ask for no sculpt at all.
    expect(keycapProfile(0, 1).tilt).toBe(0)
    expect(Number.isFinite(keycapProfile(Number.NaN, Number.NaN).rise)).toBe(true)
  })
})

describe("matrixScan", () => {
  it("energizes one row at a time and reads the columns across it", () => {
    const first = matrixScan(0, 4, 3)
    expect(first).toMatchObject({ row: 0, column: 0, cell: 0 })
    expect(matrixScan(1 / 12, 4, 3)).toMatchObject({ row: 0, column: 1, cell: 1 })
    expect(matrixScan(3 / 12, 4, 3)).toMatchObject({ row: 1, column: 0, cell: 3 })
    // A whole cycle comes back to the first cell.
    expect(matrixScan(1, 4, 3).cell).toBe(0)
    expect(matrixScan(-1 / 12, 4, 3).cell).toBe(11)
    expect(matrixScan(Number.NaN, 4, 3).cell).toBe(0)
    expect(matrixScan(0.5, 0, 0).cell).toBe(0)
  })
})

describe("strokePresses", () => {
  it("presses one key at a time through the passage and lets go after it", () => {
    const strikes: KeyStrike[] = [
      { index: 0, at: 0 },
      { index: 1, at: 0.5 },
    ]
    const start = strokePresses(strikes, 3, 0, { dwell: 0.2 })
    expect(start[0]).toBeCloseTo(0, 6)
    expect(start[2]).toBe(0)

    const mid = strokePresses(strikes, 3, 0.05, { dwell: 0.2 })
    expect(mid[0]).toBeGreaterThan(0.5)
    expect(mid[1]).toBe(0)

    const second = strokePresses(strikes, 3, 0.55, { dwell: 0.2 })
    expect(second[1]).toBeGreaterThan(0.5)
    expect(second[0]).toBe(0)

    // Past the last strike everything is up again.
    expect(strokePresses(strikes, 3, 1, { dwell: 0.2 })).toEqual([0, 0, 0])
  })

  it("ignores strikes outside the deck and survives nonsense", () => {
    const presses = strokePresses([{ index: 9, at: 0.1 }, { index: -1, at: 0.2 }], 3, 0.1)
    expect(presses).toEqual([0, 0, 0])
    expect(strokePresses([{ index: 0, at: Number.NaN }], 2, Number.NaN)).toEqual([0, 0])
    expect(strokePresses([], 0, 0.5)).toEqual([])
  })

  it("schedules a code across the passage, one strike per character", () => {
    const strikes = codeStrikes([4, 7, 1], 12)
    expect(strikes.map((strike) => strike.index)).toEqual([4, 7, 1])
    expect(strikes[0].at).toBeGreaterThan(0)
    expect(strikes[2].at).toBeLessThan(1)
    for (let i = 1; i < strikes.length; i += 1) {
      expect(strikes[i].at).toBeGreaterThan(strikes[i - 1].at)
    }
    expect(codeStrikes([], 12)).toEqual([])
  })
})

describe("deckFrame", () => {
  it("is an orthonormal frame whose normal leans toward the reader as it rakes", () => {
    for (const rake of [0, 12, 22, 40]) {
      const frame = deckFrame({ x: 0, y: 10, z: 0 }, rake)
      for (const axis of [frame.u, frame.q, frame.n]) {
        expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 6)
      }
      expect(frame.u.x * frame.q.x + frame.u.y * frame.q.y + frame.u.z * frame.q.z).toBeCloseTo(0, 6)
      expect(frame.q.x * frame.n.x + frame.q.y * frame.n.y + frame.q.z * frame.n.z).toBeCloseTo(0, 6)
      // The normal comes off the face up and toward the front of the machine.
      expect(frame.n.y).toBeGreaterThan(0)
      expect(frame.n.z).toBeLessThanOrEqual(0)
    }
    // Flat on the bench the normal is straight up.
    expect(deckFrame({ x: 0, y: 0, z: 0 }, 0).n).toMatchObject({ x: 0, z: 0 })
    expect(Number.isFinite(deckFrame({ x: 0, y: 0, z: 0 }, Number.NaN).n.y)).toBe(true)
  })

  it("places deck points at their own spacing, lifted along the normal", () => {
    const frame = deckFrame({ x: 0, y: 8, z: 0 }, 22)
    const a = deckPoint(frame, 0, 0)
    const b = deckPoint(frame, 12, 0)
    const c = deckPoint(frame, 0, 12)
    expect(distance3(a, b)).toBeCloseTo(12, 6)
    expect(distance3(a, c)).toBeCloseTo(12, 6)
    // A lift is exactly along the normal.
    const lifted = deckPoint(frame, 0, 0, 3)
    expect(distance3(a, lifted)).toBeCloseTo(3, 6)
    expect(lifted.y).toBeGreaterThan(a.y)
  })
})

describe("capSolid", () => {
  it("draws a cap as a box on the deck, and a press moves it", () => {
    const camera = robotCamera("iso")
    const frame = deckFrame({ x: 0, y: 8, z: 0 }, 22)
    const placement = { index: 0, row: 0, column: 0, x: 0, y: 0, width: 9, depth: 9, units: 1 }
    const up = capSolid(camera, frame, placement, 0, { height: 5, travel: 3 })
    const down = capSolid(camera, frame, placement, 1, { height: 5, travel: 3 })
    expect(up).toMatch(/^M /)
    expect(up.endsWith("Z")).toBe(true)
    expect(down).not.toBe(up)
    expect(up).not.toMatch(/NaN/)

    // In plan the cap is a rectangle whatever the press, because travel is
    // along the deck normal and plan sees none of the rake's height.
    const plan = robotCamera("plan")
    expect(capSolid(plan, frame, placement, 0, { height: 5, travel: 3 })).toMatch(/^M /)
    expect(capSolid(camera, frame, placement, Number.NaN, {})).not.toMatch(/NaN/)
  })
})
