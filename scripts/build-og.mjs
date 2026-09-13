#!/usr/bin/env node
/**
 * Captures `/og` to `public/og.png` — the 1200 x 630 social card.
 *
 * Why a screenshot and not `next/og`: the machines are CSS-variable-themed SVG
 * with masks and gradients, none of which satori renders. Reasoning in
 * `docs/og-image.md`.
 *
 *   pnpm og                          reuse `next dev` if it is up, else boot one
 *   pnpm og --url http://…:3001      capture from a server you name
 *   pnpm og --theme dark --out public/og-dark.png
 *
 * The browser driver lives in `scripts/lib/capture.mjs`, shared with `pnpm shots`.
 * macOS + Google Chrome only; a maintainer command, not part of `pnpm build`.
 */

import { stat } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import {
  downsample,
  parseArgs,
  resolveOrigin,
  rm,
  scratchDir,
  withPage,
} from "./lib/capture.mjs"

const WIDTH = 1200
const HEIGHT = 630
/** After fonts resolve: hydration, the theme class, and a settled first frame. */
const SETTLE_MS = 2500

const args = parseArgs(process.argv.slice(2))
const out = path.resolve(args.out ?? "public/og.png")

async function main() {
  const { origin, stop } = await resolveOrigin(args.url, "/og")
  const url = `${origin}/og${args.theme ? `?theme=${args.theme}` : ""}`

  const scratch = await scratchDir()
  const raw = path.join(scratch, "og@2x.png")
  try {
    console.log(`→ capturing ${url}`)
    await withPage(async (page) => {
      await page.viewport(WIDTH, HEIGHT)
      await page.goto(url)
      await page.settle(SETTLE_MS)
      await page.screenshot(raw, { x: 0, y: 0, width: WIDTH, height: HEIGHT })
    })
    await downsample(raw, out, WIDTH, HEIGHT)
    const { size } = await stat(out)
    console.log(`✓ ${path.relative(process.cwd(), out)} — ${(size / 1024).toFixed(0)} KB`)
  } finally {
    stop()
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
