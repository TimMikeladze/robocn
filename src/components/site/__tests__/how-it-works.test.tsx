import { readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { landingSkills } from "@/components/site/how-it-works"
import { docs } from "@/lib/docs"

/**
 * The section names the four skills and prints three commands. Both are the kind
 * of thing that rots quietly: a skill gets added under `skills/` and the landing
 * page keeps advertising four, or the item count is edited to a literal.
 */

const onDisk = readdirSync(path.join(process.cwd(), "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

describe("landing: what to do with it", () => {
  it("lists exactly the skills the repository ships", () => {
    expect([...landingSkills].map((skill) => skill.name).sort()).toEqual(onDisk)
  })

  it("gives every skill a one-line purpose", () => {
    for (const skill of landingSkills) {
      expect(skill.purpose.length, skill.name).toBeGreaterThan(20)
      expect(skill.purpose.length, skill.name).toBeLessThan(90)
    }
  })

  it("has a registry to count, so the derived figure is never zero", () => {
    // The panel prints `docs.filter(e => e.item).length`; a literal would pass
    // this trivially, which is the point of asserting the source instead.
    expect(docs.filter((entry) => entry.item).length).toBeGreaterThan(100)
  })
})
