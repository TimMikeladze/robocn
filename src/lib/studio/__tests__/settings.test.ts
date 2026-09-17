import { describe, expect, it } from "vitest"

import {
  defaultSettings,
  defaultWorkflow,
  parseSettings,
  settingsSchema,
  stageOf,
} from "@/lib/studio/settings"

describe("parseSettings", () => {
  it("answers the defaults for nothing, for garbage and for the wrong shape", () => {
    const defaults = defaultSettings()
    expect(parseSettings(null)).toEqual(defaults)
    expect(parseSettings("")).toEqual(defaults)
    expect(parseSettings("{not json")).toEqual(defaults)
    expect(parseSettings(JSON.stringify({ workflow: "nope" }))).toEqual(defaults)
    expect(defaults.workflow).toEqual(defaultWorkflow)
  })

  it("fills in what a partial blob leaves out", () => {
    const settings = parseSettings(JSON.stringify({ profile: { tagline: "Arms." } }))
    expect(settings.profile).toEqual({
      listed: true,
      tagline: "Arms.",
      website: "",
      accent: "#f38b4a",
      logoAssetId: null,
    })
    expect(settings.defaults).toEqual({ background: "panel", paletteId: null })
    expect(settings.workflow).toEqual(defaultWorkflow)
  })
})

describe("settingsSchema", () => {
  const stage = (id: string) => ({ id, name: id, color: "#112233", done: false })

  it("rejects two stages with one id", () => {
    const result = settingsSchema.safeParse({ workflow: [stage("draft"), stage("draft")] })
    expect(result.success).toBe(false)
  })

  it("rejects an empty workflow", () => {
    expect(settingsSchema.safeParse({ workflow: [] }).success).toBe(false)
  })

  it("rejects a colour that is not six-digit hex and a website that is not http", () => {
    expect(settingsSchema.safeParse({ workflow: [{ ...stage("a"), color: "red" }] }).success).toBe(false)
    expect(settingsSchema.safeParse({ profile: { website: "javascript:alert(1)" } }).success).toBe(false)
    expect(settingsSchema.safeParse({ profile: { website: "https://example.com" } }).success).toBe(true)
  })
})

describe("stageOf", () => {
  it("falls back to the first stage when a design's stage was deleted", () => {
    const settings = defaultSettings()
    expect(stageOf(settings, "approved").id).toBe("approved")
    expect(stageOf(settings, "gone").id).toBe("draft")
  })
})
