import { render } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { OgCard, ogTileSlugs } from "@/components/site/og-card"
import { docs } from "@/lib/docs"
import { defaultManager } from "@/lib/site"

const registry: { items: { name: string }[] } = JSON.parse(
  readFileSync(path.join(process.cwd(), "registry.json"), "utf8"),
)
const registryItems = registry.items.map((item) => item.name)
const items = docs.filter((entry) => entry.item).length

describe("social card", () => {
  it("only ever names machines you can install", () => {
    // Each tile prints its slug on the card, so a renamed component would
    // otherwise ship a label pointing at nothing.
    const missing = ogTileSlugs.filter((slug) => !registryItems.includes(slug))
    expect(missing, `no registry item for: ${missing.join(", ")}`).toEqual([])
  })

  it("fills the sheet", () => {
    // 4 x 3. A short list would leave a hole in the grid.
    expect(ogTileSlugs).toHaveLength(12)
    expect(new Set(ogTileSlugs).size).toBe(12)
  })

  it("prints an install line that works from anywhere", () => {
    // The card is captured from a dev server; the command on it must not be.
    const { container } = render(<OgCard items={items} />)
    const text = container.textContent ?? ""
    expect(text).toContain("bunx --bun shadcn@latest add")
    // The tab label names the manager the command below it actually uses.
    expect(text).toContain(defaultManager)
    expect(text).toContain("https://robocn.dev/r/robot-arm.json")
    expect(text).not.toContain("localhost")
  })

  it("carries the wordmark, the tagline and the registry count", () => {
    const { container } = render(<OgCard items={items} />)
    const text = container.textContent ?? ""
    expect(text).toContain("robocn")
    expect(text).toContain("Robot components for shadcn/ui")
    expect(text).toContain(String(items))
  })
})
