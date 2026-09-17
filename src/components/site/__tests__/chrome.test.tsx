import { describe, expect, it } from "vitest"

import { isApp, isEmbed } from "@/components/site/chrome"

describe("site chrome", () => {
  it("treats Studio as an app frame: header yes, footer no", () => {
    expect(isApp("/studio")).toBe(true)
    expect(isApp("/studio/acme/assets")).toBe(true)
    // What Studio publishes is a page like any other.
    expect(isApp("/d/loader-arm-4f9k2a")).toBe(false)
    expect(isApp("/studios")).toBe(false)
    expect(isApp(null)).toBe(false)
  })

  it("strips both from an embed, which lives inside somebody else's page", () => {
    expect(isEmbed("/embed/loader-arm-4f9k2a")).toBe(true)
    expect(isEmbed("/embedded")).toBe(false)
    expect(isEmbed("/docs/embed/x")).toBe(false)
  })
})
