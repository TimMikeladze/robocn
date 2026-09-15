import { describe, expect, it } from "vitest"

import { manifestSource, mergeManifest, parseManifest } from "../lib/og-manifest.mjs"

/**
 * `src/lib/og.generated.ts` is what tells a docs page it has a card of its own.
 * The rule that matters is the merge: `pnpm og --only <new-machine>` is the
 * whole card step a new machine owes, so a one-card run has to register that
 * card without dropping the two hundred it did not take.
 *
 * Notes: `docs/per-page-og-images.md`.
 */

const everythingExists = () => true

describe("the page-card manifest", () => {
  it("reads back what it writes", () => {
    const slugs = ["micro-duck", "orrery", "robot-arm"]
    expect(parseManifest(manifestSource(slugs))).toEqual(slugs)
  })

  it("reads an absent or unparseable manifest as empty", () => {
    expect(parseManifest("")).toEqual([])
    expect(parseManifest("export const capturedOgSlugs: string[] = []\n")).toEqual([])
  })

  it("keeps the cards a --only run did not take", () => {
    const claimed = ["micro-duck", "orrery"]
    expect(mergeManifest(claimed, ["robot-baseball"], everythingExists)).toEqual([
      "micro-duck",
      "orrery",
      "robot-baseball",
    ])
  })

  it("claims a card again without duplicating it", () => {
    expect(mergeManifest(["orrery"], ["orrery"], everythingExists)).toEqual(["orrery"])
  })

  it("drops a slug whose PNG has gone", () => {
    // A deleted machine, otherwise left behind by the merge — and `og.test.ts`
    // fails a manifest that names a file that is not on disk.
    const exists = (slug: string) => slug !== "retired-droid"
    expect(mergeManifest(["orrery", "retired-droid"], [], exists)).toEqual(["orrery"])
  })
})
