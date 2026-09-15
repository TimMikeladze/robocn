import { describe, expect, it } from "vitest"

import { docBySlug, docs } from "@/lib/docs"
import { entryMarkdown, indexMarkdown, llmsTxt } from "@/lib/markdown"

/**
 * The Markdown mirrors are what an agent reads instead of the page, so the
 * failure mode is silent: the HTML stays right while the text a model is
 * handed goes stale or points at the wrong host. These tie the two together.
 */

const HOST = "https://robocn.dev"

describe("page markdown", () => {
  const arm = docBySlug("robot-arm")!

  it("prints the install line against the host it was asked for", () => {
    const markdown = entryMarkdown(arm, HOST)
    expect(markdown).toContain(`${HOST}/r/robot-arm.json`)
    // A mirror served off a preview must not hand out the production URL.
    expect(entryMarkdown(arm, "http://localhost:3000")).not.toContain(HOST)
  })

  it("carries the title, the summary and every section the page renders", () => {
    const markdown = entryMarkdown(arm, HOST)
    expect(markdown.startsWith(`# ${arm.title}\n`)).toBe(true)
    expect(markdown).toContain(arm.summary)
    expect(markdown).toContain("## Install")
    expect(markdown).toContain("## Usage")
    expect(markdown).toContain("## Props")
    expect(markdown).toContain("## Source")
    // The props table is a table, not a bullet list a model has to parse.
    expect(markdown).toContain("| name | type | default | description |")
  })

  it("points a reader at the index, wherever they landed", () => {
    expect(entryMarkdown(arm, HOST)).toContain(`${HOST}/llms.txt`)
  })

  it("says how it works rather than Notes for a page that installs nothing", () => {
    const library = docs.find((entry) => !entry.item && entry.notes?.length)
    if (!library) return
    const markdown = entryMarkdown(library, HOST)
    expect(markdown).toContain("## How it works")
    expect(markdown).not.toContain("## Install")
  })
})

describe("llms.txt", () => {
  it("lists every docs page as a Markdown URL", () => {
    const text = llmsTxt(HOST)
    for (const entry of docs) {
      expect(text, `missing ${entry.slug}`).toContain(`${HOST}/docs/${entry.slug}.md`)
    }
  })

  it("opens with the llmstxt.org shape: a title, then a blockquote", () => {
    const [title, blank, blurb] = llmsTxt(HOST).split("\n")
    expect(title).toBe("# robocn")
    expect(blank).toBe("")
    expect(blurb.startsWith("> ")).toBe(true)
  })

  it("names the registry endpoint an agent would install from", () => {
    expect(llmsTxt(HOST)).toContain(`${HOST}/r/{name}.json`)
  })
})

describe("docs index markdown", () => {
  it("counts only the items that install something", () => {
    const installable = docs.filter((entry) => entry.item).length
    expect(indexMarkdown(HOST)).toContain(`${installable} installable components`)
  })
})
