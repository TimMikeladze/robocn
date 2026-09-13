import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { productionUrl, site } from "../../src/lib/site"

/**
 * The project describes itself in three places that nothing links together:
 * `package.json` (npm, and what GitHub's sidebar reads), `src/lib/site.ts` (the
 * site's own tags), and the GitHub repo settings. The first two are checked
 * here; the third is set from `site.ts` by hand — see the README's Development
 * section.
 */

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  description?: string
  keywords?: string[]
  homepage?: string
  repository?: { url?: string }
  license?: string
}

describe("project metadata", () => {
  it("carries the fields a package page and a GitHub sidebar read", () => {
    expect(pkg.description?.length).toBeGreaterThan(50)
    expect(pkg.license).toBe("MIT")
    expect(pkg.keywords?.length).toBeGreaterThan(5)
  })

  it("points at the same home and repository the site does", () => {
    expect(pkg.homepage).toBe(productionUrl)
    expect(pkg.repository?.url).toContain(site.repository.replace("https://", ""))
  })

  it("gives the metadata tags something to say", () => {
    // Long enough to be a description, short enough to survive a search result.
    expect(site.description.length).toBeGreaterThan(80)
    expect(site.description.length).toBeLessThan(200)
    expect(site.keywords.length).toBeGreaterThan(5)
    expect(site.author.name).toBeTruthy()
  })
})
