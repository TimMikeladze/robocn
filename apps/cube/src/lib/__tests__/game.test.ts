import { describe, expect, it } from "vitest"

import {
  CUBE_SLOTS,
  IP_DAILY_LIMIT,
  PLAYER_DAILY_LIMIT,
  checkMoveBudget,
  daysBetween,
  foldRound,
  freshScramble,
  nextUtcMidnight,
  parseSharedMove,
  playerNameFor,
  utcDay,
} from "@/lib/game"
import { makePlayerId } from "@/lib/identity"

describe("checkMoveBudget", () => {
  it("allows a first move on a quiet cube", () => {
    expect(
      checkMoveBudget({ playerMovesToday: 0, ipMovesToday: 0, msSinceLastMove: null }),
    ).toEqual({ ok: true })
  })

  it("allows a move once the cube has settled", () => {
    expect(
      checkMoveBudget({ playerMovesToday: 0, ipMovesToday: 0, msSinceLastMove: 60_000 }),
    ).toEqual({ ok: true })
  })

  it("blocks a player who already moved on that cube today — one cube does not spend another's move", () => {
    const result = checkMoveBudget({
      playerMovesToday: PLAYER_DAILY_LIMIT,
      ipMovesToday: 0,
      msSinceLastMove: null,
    })
    expect(result).toEqual({ ok: false, reason: "player" })
    // The budget is per cube, so the same counts on a different round are a
    // different budget — the scoping lives in db.ts's queries.
    expect(PLAYER_DAILY_LIMIT).toBe(1)
    expect(CUBE_SLOTS).toBe(6)
  })

  it("blocks an address that has spent its daily moves on fresh cookies", () => {
    const result = checkMoveBudget({ playerMovesToday: 0, ipMovesToday: IP_DAILY_LIMIT, msSinceLastMove: null })
    expect(result).toEqual({ ok: false, reason: "ip" })
  })

  it("blocks machine-gun submits to the same cube", () => {
    const result = checkMoveBudget({ playerMovesToday: 0, ipMovesToday: 0, msSinceLastMove: 500 })
    expect(result).toEqual({ ok: false, reason: "too-fast" })
  })
})

describe("day buckets", () => {
  it("buckets by UTC calendar day", () => {
    expect(utcDay(new Date("2026-09-23T23:59:59Z"))).toBe("2026-09-23")
    expect(utcDay(new Date("2026-09-24T00:00:00Z"))).toBe("2026-09-24")
  })

  it("unlocks at the next UTC midnight, not the local one", () => {
    const at = new Date("2026-09-23T15:00:00Z")
    expect(nextUtcMidnight(at).toISOString()).toBe("2026-09-24T00:00:00.000Z")
  })

  it("counts a same-day solve as one day", () => {
    expect(daysBetween(new Date("2026-09-23T01:00:00Z"), new Date("2026-09-23T22:00:00Z"))).toBe(1)
  })

  it("rounds a day and a bit up to two days", () => {
    expect(daysBetween(new Date("2026-09-23T01:00:00Z"), new Date("2026-09-24T02:00:00Z"))).toBe(2)
  })
})

describe("parseSharedMove", () => {
  it("takes the classic notation", () => {
    expect(parseSharedMove("R")).toEqual({ face: "R", layer: 0, turns: 1 })
    expect(parseSharedMove(" U'")).toEqual({ face: "U", layer: 0, turns: 3 })
    expect(parseSharedMove("F2")).toEqual({ face: "F", layer: 0, turns: 2 })
  })

  it("refuses inner layers, wide moves and junk", () => {
    expect(parseSharedMove("2R")).toBeNull()
    expect(parseSharedMove("Rw")).toBeNull()
    expect(parseSharedMove("X")).toBeNull()
    expect(parseSharedMove("")).toBeNull()
    expect(parseSharedMove("RU")).toBeNull()
    expect(parseSharedMove("R'2")).toBeNull()
  })
})

describe("foldRound", () => {
  it("derives the state and knows a solved cube", () => {
    const fold = foldRound("R U F", ["F'", "U'", "R'"])
    expect(fold.solved).toBe(true)
    expect(fold.moveCount).toBe(3)
    expect(fold.state).toBe("R U F F' U' R'")
  })

  it("knows an unsolved cube", () => {
    expect(foldRound("R U F", []).solved).toBe(false)
  })

  it("is immune to junk tokens in the log", () => {
    expect(foldRound("R", ["nonsense"]).moveCount).toBe(1)
  })
})

describe("freshScramble", () => {
  it("never hands out a solved cube", () => {
    for (let seed = 1; seed < 25; seed++) {
      expect(foldRound(freshScramble(seed), []).solved).toBe(false)
    }
  })

  it("is deterministic for a seed", () => {
    expect(freshScramble(7)).toBe(freshScramble(7))
  })
})

describe("playerNameFor", () => {
  it("is stable and shaped like a name", () => {
    const name = playerNameFor("player-0123456789ABCDEFGHIJ")
    expect(name).toBe(playerNameFor("player-0123456789ABCDEFGHIJ"))
    expect(name).toMatch(/^[a-z]+-[a-z]+-[0-9A-Za-z]{6}$/)
  })

  it("gives every player a distinct name", () => {
    const ids = Array.from({ length: 1000 }, () => makePlayerId())
    const names = new Set(ids.map(playerNameFor))
    expect(names.size).toBe(ids.length)
  })
})
