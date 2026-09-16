import { expect, it } from "vitest"

import { umamiConfig } from "@/components/site/analytics"

const ID = "7da11a8a-03cf-4019-b7cc-a6ac11087297"

/**
 * The gate is the point: a fork with no Umami of its own must ship no
 * third-party script. `docs/analytics.md`.
 */

it("stays off until a website id is set", () => {
  expect(umamiConfig(undefined, undefined)).toBeNull()
  // An emptied Vercel variable is someone turning it off, not a request to
  // load a script with `undefined` as its id.
  expect(umamiConfig("", "https://linesofcode-umami.vercel.app/script.js")).toBeNull()
  expect(umamiConfig("   ")).toBeNull()
})

it("falls back to Umami Cloud when no script URL is given", () => {
  expect(umamiConfig(ID)).toEqual({
    src: "https://cloud.umami.is/script.js",
    websiteId: ID,
  })
})

it("takes a self-hosted script URL whole, path and all", () => {
  const src = "https://linesofcode-umami.vercel.app/script.js"
  expect(umamiConfig(ID, src)).toEqual({ src, websiteId: ID })
})
