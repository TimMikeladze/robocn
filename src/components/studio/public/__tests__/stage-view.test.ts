import { describe, expect, it } from "vitest"

import { galleryCards, safeStage } from "@/components/studio/public/stage-view"
import type { PublicCard } from "@/lib/studio/queries"

describe("safeStage", () => {
  it("keeps a ground the stage knows and clamps the zoom", () => {
    expect(safeStage({ background: "blueprint", zoom: 1.5 })).toEqual({ background: "blueprint", zoom: 1.5 })
    expect(safeStage({ background: "dark", zoom: 40 }).zoom).toBe(3)
    expect(safeStage({ background: "dark", zoom: 0 }).zoom).toBe(0.25)
  })

  it.each([null, "grid", [], { background: "url(x)", zoom: "2" }, { zoom: Number.NaN }])(
    "falls back to the plain panel for %j",
    (input) => {
      expect(safeStage(input)).toEqual({ background: "panel", zoom: 1 })
    },
  )
})

describe("galleryCards", () => {
  const row = {
    slug: "loader",
    name: "Loader",
    description: "",
    componentId: "robot-arm",
    publishedAt: new Date("2026-09-17T23:30:00Z"),
    versionId: "ver_1",
    pose: { variant: "wire", onPose: "x" },
    stageView: { background: "panel", zoom: 1 },
    hasThumbnail: false,
    orgName: "Acme",
    orgSlug: "acme",
  } as unknown as PublicCard

  it("sanitizes the pose and prints the date in UTC", () => {
    const [card] = galleryCards([row])
    expect(card.pose).toEqual({ variant: "wire" })
    // ICU versions disagree on "Sep" and "Sept"; the day is the part a time zone would move.
    expect(card.published).toMatch(/^17 Sept? 2026$/)
    expect(card.machine).toBeTruthy()
  })

  it("drops a design whose machine has left the registry", () => {
    expect(galleryCards([{ ...row, componentId: "retired-machine" }])).toEqual([])
  })
})
