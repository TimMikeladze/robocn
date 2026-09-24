import { describe, expect, it } from "vitest"

import { clientIp, hashIp, isPlayerId, makePlayerId } from "@/lib/identity"

describe("isPlayerId", () => {
  it("accepts the cookie's own format", () => {
    expect(isPlayerId(makePlayerId())).toBe(true)
  })

  it("refuses anything a stranger might send", () => {
    expect(isPlayerId("")).toBe(false)
    expect(isPlayerId("player-not-a-nanoid")).toBe(false)
    expect(isPlayerId("player-11111111-2222-3333-4444-555555555555")).toBe(false)
    expect(isPlayerId("11111111-2222-3333-4444-555555555555")).toBe(false)
    expect(isPlayerId(undefined)).toBe(false)
    expect(isPlayerId(null)).toBe(false)
  })

  it("makes ids that never repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => makePlayerId()))
    expect(ids.size).toBe(500)
  })
})

describe("clientIp", () => {
  it("takes the first forwarded hop", () => {
    const request = new Request("https://cube.robocn.dev", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    })
    expect(clientIp(request)).toBe("203.0.113.7")
  })

  it("falls back to local when the platform sent nothing", () => {
    expect(clientIp(new Request("https://cube.robocn.dev"))).toBe("local")
  })
})

describe("hashIp", () => {
  it("is deterministic and salted by the secret", () => {
    expect(hashIp("203.0.113.7", "secret-one")).toBe(hashIp("203.0.113.7", "secret-one"))
    expect(hashIp("203.0.113.7", "secret-one")).not.toBe(hashIp("203.0.113.7", "secret-two"))
    expect(hashIp("203.0.113.7", "secret-one")).not.toContain("203")
  })
})
