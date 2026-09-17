import { describe, expect, it } from "vitest"

import { describeActivity } from "@/lib/studio/activity"

const line = (verb: string, targetName = "Loader arm", meta: Record<string, unknown> = {}) =>
  describeActivity({ verb, targetName, meta })

describe("describeActivity", () => {
  it("reads as the sentence after the actor's name", () => {
    expect(line("design.published")).toBe("published Loader arm")
    expect(line("comment.created")).toBe("commented on Loader arm")
  })

  it("says where a design was moved to, when it knows", () => {
    expect(line("design.staged", "Loader arm", { to: "In review" })).toBe("moved Loader arm to In review")
    expect(line("design.staged")).toBe("moved Loader arm")
  })

  it("names the version that was saved or restored", () => {
    expect(line("design.saved", "Loader arm", { number: 4 })).toBe("saved v4 of Loader arm")
    expect(line("design.saved")).toBe("saved a version of Loader arm")
    expect(line("design.restored", "Loader arm", { from: 2 })).toBe("restored v2 of Loader arm")
  })

  it("counts a multi-file upload and names a single one", () => {
    expect(line("asset.uploaded", "a.png", { count: 3 })).toBe("uploaded 3 files")
    expect(line("asset.uploaded", "a.png", { count: 1 })).toBe("uploaded a.png")
  })

  it("says which settings changed", () => {
    expect(line("settings.updated", "workflow")).toBe("updated workflow settings")
  })

  it("survives a verb it has never heard of and a target with no name", () => {
    expect(line("billing.exploded", "")).toBe("billing.exploded something")
  })

  it("ignores meta of the wrong type", () => {
    expect(line("design.saved", "Loader arm", { number: "4" })).toBe("saved a version of Loader arm")
  })
})
