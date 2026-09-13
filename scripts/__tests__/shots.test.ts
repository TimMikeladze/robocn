import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * The README's pictures are committed PNGs, so the failure mode is a broken
 * image on the GitHub page rather than anything the app would notice. These
 * tests tie the three places that have to agree — `pnpm shots`, the files on
 * disk, and the `<picture>` blocks in the README — together.
 */

const readme = readFileSync("README.md", "utf8")
const script = readFileSync("scripts/build-shots.mjs", "utf8")

/** Every `docs/screenshots/…png` the README points at, in either slot. */
const referenced = [
  ...readme.matchAll(/(?:src|srcset)="(docs\/screenshots\/[^"]+\.png)"/g),
].map((match) => match[1])

/** The `name:` of every entry in the script's own shot list. */
const shots = [...script.matchAll(/\{ name: "([a-z-]+)", route:/g)].map((m) => m[1])

describe("README screenshots", () => {
  it("points at files that exist", () => {
    expect(referenced.length).toBeGreaterThan(0)
    for (const file of referenced) expect(existsSync(file), file).toBe(true)
  })

  it("pairs every picture with a dark counterpart", () => {
    const light = referenced.filter((file) => file.endsWith("-light.png"))
    expect(light.length).toBe(referenced.length / 2)
    for (const file of light) {
      expect(referenced).toContain(file.replace("-light.png", "-dark.png"))
    }
  })

  it("shows every shot `pnpm shots` takes", () => {
    expect(shots.length).toBeGreaterThan(0)
    for (const name of shots) {
      expect(referenced, name).toContain(`docs/screenshots/${name}-light.png`)
      expect(existsSync(`docs/screenshots/${name}-dark.png`), name).toBe(true)
    }
  })

  it("describes each picture for a reader who cannot see it", () => {
    const alts = [...readme.matchAll(/<img alt="([^"]*)" src="docs\/screenshots\//g)]
    expect(alts.length).toBe(shots.length)
    // Long enough to say what is in the picture, not just name the page.
    for (const [, alt] of alts) expect(alt.length).toBeGreaterThan(40)
  })
})
