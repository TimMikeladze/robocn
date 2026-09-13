import { act, cleanup, render } from "@testing-library/react"
import type * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { catalogueArt } from "@/components/site/catalogue"

/**
 * The landing page promises every machine runs its own cycle. This drives real
 * animation frames at each card and fails the ones that do not move — which is
 * the only way to catch a pinned value prop, since a pinned value looks exactly
 * like configuration in the source.
 *
 * Notes: `docs/gallery-coverage.md`.
 */

/** jsdom holds a placeholder for these rather than starting a WebGL context. */
const webgl = ["robot-arm-3d", "robot-stage"]

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/**
 * Renders a card and samples its markup across three seconds of frames.
 *
 * Sampling rather than comparing the ends matters: most of these cycles are a
 * second long, so a machine caught at a whole number of periods draws exactly
 * its first frame again and would read as frozen.
 */
function sample(node: React.ReactNode) {
  let now = 0
  const pending: FrameRequestCallback[] = []
  vi.spyOn(performance, "now").mockImplementation(() => now)
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    pending.push(callback)
    return pending.length
  })
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})

  const { container } = render(<div>{node}</div>)
  const seen = new Set([container.innerHTML])

  // 40ms a frame: inside the 50ms delta clamp in `useRobotClock`, so the clock
  // advances by the whole step. 75 of them is long enough that an indexing
  // table, which dwells at a station for a second, has stepped.
  for (let frame = 0; frame < 75; frame += 1) {
    const due = pending.splice(0, pending.length)
    now += 40
    act(() => {
      for (const callback of due) callback(now)
    })
    if (frame % 5 === 0) seen.add(container.innerHTML)
  }
  return seen
}

describe("every card moves", () => {
  const slugs = Object.keys(catalogueArt).filter((slug) => !webgl.includes(slug))

  it.each(slugs)("%s animates on its own", (slug) => {
    expect(
      sample(catalogueArt[slug].art).size,
      `${slug} draws one frame for three seconds — it is pinned. Drop the ` +
        `controlled value prop (or behavior="static") and let its cycle run.`,
    ).toBeGreaterThan(1)
  })

  it("exempts exactly the two cards that need WebGL", () => {
    // If a third card ever needs a canvas, it has to be added here on purpose.
    for (const slug of webgl) expect(catalogueArt[slug]).toBeDefined()
  })
})
