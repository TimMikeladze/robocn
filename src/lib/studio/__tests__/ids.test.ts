import { describe, expect, it } from "vitest"

import { freeSlug, isValidSlug, newId, slugify } from "@/lib/studio/ids"

describe("slugify", () => {
  it("lowercases, strips accents and collapses everything else to dashes", () => {
    expect(slugify("  Acme Robotics, Inc. ")).toBe("acme-robotics-inc")
    expect(slugify("Café Münster")).toBe("cafe-munster")
    expect(slugify("---")).toBe("")
  })

  it("stops at 48 characters without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(47)} b c`)
    expect(slug).toBe("a".repeat(47))
  })
})

describe("isValidSlug", () => {
  it("accepts what slugify makes", () => {
    expect(isValidSlug("acme-robotics")).toBe(true)
    expect(isValidSlug("a")).toBe(true)
  })

  it("refuses the path segments Studio owns", () => {
    for (const reserved of ["sign-in", "onboarding", "invite", "account", "api", "settings"]) {
      expect(isValidSlug(reserved)).toBe(false)
    }
  })

  it("refuses the wrong shape", () => {
    for (const bad of ["", "-acme", "acme-", "Acme", "ac me", "a".repeat(49)]) {
      expect(isValidSlug(bad)).toBe(false)
    }
  })
})

describe("freeSlug", () => {
  const takenIn = (slugs: string[]) => async (slug: string) => slugs.includes(slug)

  it("uses the plain slug when it is free", async () => {
    expect(await freeSlug("Robot Arm", takenIn([]))).toBe("robot-arm")
  })

  it("walks -2, -3 past collisions", async () => {
    expect(await freeSlug("Arm", takenIn(["arm", "arm-2"]))).toBe("arm-3")
  })

  it("steps off a reserved word and names the nameless", async () => {
    expect(await freeSlug("Account", takenIn([]))).toBe("account-1")
    expect(await freeSlug("!!!", takenIn([]))).toBe("untitled")
  })
})

describe("newId", () => {
  it("says what it is", () => {
    expect(newId("prj")).toMatch(/^prj_[0-9a-z]{12}$/)
  })
})
