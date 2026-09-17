import { describe, expect, it } from "vitest"

import { isFullBleed } from "@/components/site/header-bar"

describe("header width", () => {
  it("runs edge to edge on the workbench, which is an app frame", () => {
    expect(isFullBleed("/workbench")).toBe(true)
    expect(isFullBleed("/workbench/robot-arm")).toBe(true)
  })

  it("does the same for Studio, the other app frame", () => {
    expect(isFullBleed("/studio")).toBe(true)
    expect(isFullBleed("/studio/acme/designs/dsn_1")).toBe(true)
    expect(isFullBleed("/studios")).toBe(false)
  })

  it("keeps the reading rail everywhere else", () => {
    expect(isFullBleed("/")).toBe(false)
    expect(isFullBleed("/docs")).toBe(false)
    expect(isFullBleed(null)).toBe(false)
    // A sibling route that merely starts with the same letters is a page.
    expect(isFullBleed("/workbenches")).toBe(false)
  })
})
