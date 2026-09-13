import { describe, expect, it } from "vitest"

import { oklchToHex, resolveCssColor } from "@/lib/robocn/color"

describe("oklchToHex", () => {
  it("converts oklch to sRGB", () => {
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000")
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff")
  })

  it("leaves anything else alone", () => {
    expect(oklchToHex("#ff0000")).toBeNull()
    expect(oklchToHex("lab(50 20 20)")).toBeNull()
  })
})

describe("resolveCssColor", () => {
  it("passes through a colour three.js already understands", () => {
    expect(resolveCssColor("#ff0000")).toBe("#ff0000")
  })

  it("converts oklch, which three.js does not parse", () => {
    expect(resolveCssColor("oklch(1 0 0)")).toBe("#ffffff")
  })

  it("falls back when there is nothing to resolve against", () => {
    expect(resolveCssColor("", "#123456")).toBe("#123456")
  })
})
