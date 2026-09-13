import { render } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { demoFor, demos } from "@/components/demos/demos"
import { fallbackArt } from "@/components/site/catalogue"
import { galleryEntries } from "@/components/site/gallery.generated"
import { docs } from "@/lib/docs"

/**
 * The safety net: what a registry item gets when nobody has written its card,
 * its demo or its page. Notes: `docs/gallery-coverage.md`.
 */

const registry: {
  items: { name: string; type: string; title: string; description: string }[]
} = JSON.parse(readFileSync(path.join(process.cwd(), "registry.json"), "utf8"))

describe("the generated gallery", () => {
  it("resolves every registry item to something that can draw it", () => {
    const missing = registry.items.filter((item) => {
      const entry = galleryEntries[item.name]
      // A WebGL item has no eager component on purpose; the grid lazy-loads it.
      return !entry || (!entry.component && !entry.webgl)
    })
    expect(missing.map((item) => item.name)).toEqual([])
  })

  it("draws a solver with the machine that exercises it, as a drawing", () => {
    const spine = galleryEntries["spine-kinematics"]
    expect(spine.draws).toBe("robot-snake")
    expect(spine.blueprint).toBe(true)
    // A machine draws itself, painted normally.
    expect(galleryEntries["robot-snake"].draws).toBe("robot-snake")
    expect(galleryEntries["robot-snake"].blueprint).toBe(false)
  })

  it("gives an unposed item a card built from its own registry copy", () => {
    const card = fallbackArt({
      slug: "robot-cat",
      title: "Robot cat",
      group: "Robots",
      summary: "Four solved legs hung off a back that arches. It prowls and pounces.",
    })
    expect(card).not.toBeNull()
    // One clause, which is all a card has room for.
    expect(card?.line).toBe("Four solved legs hung off a back that arches.")
    const { container } = render(<>{card?.art}</>)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("renders a bench for an item with no written demo", () => {
    // `use-robot-motion` is the real case: a registry hook nobody wrote a demo
    // for, which used to mean an empty panel on its page.
    expect(demos["use-robot-motion"]).toBeUndefined()
    const Demo = demoFor("use-robot-motion")
    expect(Demo).toBeTruthy()
    const { container } = render(Demo ? <Demo slug="use-robot-motion" /> : null)
    expect(container.querySelector("svg")).not.toBeNull()
  })

  it("hands back one module-level component for every unwritten slug", () => {
    // Manufacturing one per call would reset the bench's state on every
    // render, and the React Compiler rule would refuse the call site outright.
    const unwritten = registry.items
      .map((item) => item.name)
      .filter((name) => !demos[name] && galleryEntries[name]?.component)
    expect(unwritten.length).toBeGreaterThan(0)
    const benches = new Set(unwritten.map((name) => demoFor(name)))
    expect(benches.size).toBe(1)
    expect(benches.has(demos["robot-cat"])).toBe(false)
  })

  it("gives an unwritten registry item a docs entry from the registry", () => {
    for (const item of registry.items) {
      const entry = docs.find((doc) => doc.slug === item.name)
      expect(entry, item.name).toBeTruthy()
      expect(entry?.item, item.name).toBe(item.name)
      expect(entry?.summary, item.name).toBeTruthy()
    }
  })
})
