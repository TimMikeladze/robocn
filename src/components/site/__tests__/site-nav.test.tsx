import { describe, expect, it } from "vitest"

import { activeHref } from "@/components/site/site-nav"

describe("header nav", () => {
  it("lights the deepest route that matches, not every ancestor", () => {
    // `/docs` is a prefix of `/docs/installation`; only Install should light.
    expect(activeHref("/docs/installation")).toBe("/docs/installation")
    expect(activeHref("/docs")).toBe("/docs")
    expect(activeHref("/docs/robot-arm")).toBe("/docs")
    expect(activeHref("/workbench")).toBe("/workbench")
    expect(activeHref("/about")).toBe("/about")
  })

  it("lights nothing off the nav's own routes", () => {
    expect(activeHref("/")).toBeNull()
    expect(activeHref(null)).toBeNull()
    // A sibling route that merely starts with the same letters is not a match.
    expect(activeHref("/docsearch")).toBeNull()
  })
})
