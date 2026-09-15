import { describe, expect, it } from "vitest"

import { resultsFor } from "@/components/site/command-menu"
import type { CatalogueEntry } from "@/components/site/docs-catalogue"

const entries: CatalogueEntry[] = [
  {
    slug: "robot-gripper",
    item: "robot-gripper",
    title: "Robot gripper",
    summary: "A standalone end effector with parallel or angular fingers.",
    group: "Machines",
  },
  {
    slug: "suction-gripper",
    item: "suction-gripper",
    title: "Suction gripper",
    summary: "A bar of bellows cups and the sheet it picks.",
    group: "Machines",
  },
  {
    slug: "robot-dog",
    item: "robot-dog",
    title: "Robot dog",
    summary: "A four-legged walker with a trot gait.",
    group: "Robots",
  },
]

describe("command palette", () => {
  it("puts the site's own destinations above the components", () => {
    const results = resultsFor("", entries)
    expect(results[0].group).toBe("Pages")
    expect(results.filter((result) => result.group === "Pages")).toHaveLength(5)
  })

  it("matches on every word, in any order, across title slug and summary", () => {
    expect(resultsFor("gripper", entries).map((r) => r.href)).toEqual([
      "/docs/robot-gripper",
      "/docs/suction-gripper",
    ])
    // Two words: both must hit, and the order they are typed in does not matter.
    expect(resultsFor("bellows cups", entries).map((r) => r.href)).toEqual([
      "/docs/suction-gripper",
    ])
    expect(resultsFor("cups bellows", entries).map((r) => r.href)).toEqual([
      "/docs/suction-gripper",
    ])
  })

  it("finds a component by its slug, which is what an installer knows it as", () => {
    expect(resultsFor("robot-dog", entries).map((r) => r.href)).toEqual(["/docs/robot-dog"])
  })

  it("returns nothing rather than everything when nothing matches", () => {
    expect(resultsFor("submarine", entries)).toEqual([])
  })

  it("caps the component hits so an empty query cannot render the whole registry", () => {
    const many: CatalogueEntry[] = Array.from({ length: 80 }, (_, i) => ({
      slug: `machine-${i}`,
      item: `machine-${i}`,
      title: `Machine ${i}`,
      summary: "",
      group: "Machines",
    }))
    const components = resultsFor("machine", many).filter((r) => r.group !== "Pages")
    expect(components).toHaveLength(40)
  })
})
