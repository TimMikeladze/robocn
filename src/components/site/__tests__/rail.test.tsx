import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { rail } from "@/components/site/rail"

/**
 * The header and the pages under it have to share one column, and they drifted
 * apart twice: once on the gutter (`px-4 sm:px-6` against `px-5`) and once on
 * the width, when the docs shell grew to `xl:max-w-7xl` for the table-of-contents
 * rail and the header stayed at `max-w-6xl`. Both times the wordmark ended up
 * tens of pixels right of the page title beneath it.
 *
 * This reads the source rather than the DOM on purpose: the failure is a second
 * literal appearing somewhere, not a component rendering the wrong thing.
 */

const shells = [
  "src/components/site/header-bar.tsx",
  "src/components/site/site-footer.tsx",
  "src/app/page.tsx",
  "src/app/about/page.tsx",
  "src/app/docs/layout.tsx",
]

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8")

describe("the site rail", () => {
  it("is one column, centred, with a gutter at every width", () => {
    expect(rail).toContain("mx-auto")
    expect(rail).toContain("max-w-6xl")
    expect(rail).toMatch(/\bpx-\d/)
  })

  it("is what every shell uses", () => {
    for (const file of shells) {
      expect(read(file), `${file} does not use the shared rail`).toContain(
        'from "@/components/site/rail"',
      )
    }
  })

  it("is not re-declared anywhere with its own width or gutter", () => {
    for (const file of shells) {
      const source = read(file)
      // The rail module is the only place these may appear.
      expect(source, `${file} sets its own max width`).not.toMatch(/max-w-[67]xl/)
      expect(source, `${file} sets its own page gutter`).not.toMatch(/"[^"]*\bpx-5\b/)
    }
  })
})
