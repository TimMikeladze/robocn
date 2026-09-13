#!/usr/bin/env node
/**
 * Captures the social cards — the site's, and one per page.
 *
 * `/og` → `public/og.png`, the 1200 x 630 contact sheet.
 * `/og/<slug>` → `public/og/<slug>.png`, the card for that page.
 *
 * Why screenshots and not `next/og`: the machines are CSS-variable-themed SVG
 * with masks and gradients, none of which satori renders. Reasoning in
 * `docs/og-image.md`, and `docs/per-page-og-images.md` for the page cards.
 *
 *   pnpm og                          the site card and every page card
 *   pnpm og --only site              just public/og.png
 *   pnpm og --only micro-duck,orrery those page cards
 *   pnpm og --pages                  every page card, no site card
 *   pnpm og --url http://…:3001      capture from a server you name
 *   pnpm og --theme dark --out public/og-dark.png
 *
 * The browser driver lives in `scripts/lib/capture.mjs`, shared with `pnpm shots`.
 * macOS + Google Chrome only; a maintainer command, not part of `pnpm build`.
 */

import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import sharp from "sharp"

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
/**
 * A page card has one machine on it rather than twelve, and every one of them
 * is parked by the reduced-motion preference below, so there is less to wait
 * for — which matters when there are 170 of them.
 */
const PAGE_SETTLE_MS = 1400

const PAGES_DIR = "public/og"
const MANIFEST = "src/lib/og.generated.ts"

/**
 * The pose pin. Every machine in the set parks at its `phase` under this —
 * `useRobotClock`, `useRobotScalar` and `useRobotArm` all do — so two captures
 * of the same commit are the same file without anyone posing 170 cards by
 * hand. `docs/per-page-og-images.md`.
 */
const PINNED = [{ name: "prefers-reduced-motion", value: "reduce" }]

const args = parseArgs(process.argv.slice(2))
const siteOut = path.resolve(args.out ?? "public/og.png")
const themeQuery = args.theme ? `?theme=${args.theme}` : ""

const only = typeof args.only === "string" ? args.only.split(",").map((s) => s.trim()) : null
const wantsSite = args.pages ? false : !only || only.includes("site")
const pageFilter = only ? only.filter((name) => name !== "site") : null
const wantsPages = args.pages ? true : !only || pageFilter.length > 0

/** Which page cards the server says exist. `/og/pages` is built from `docs.ts`. */
async function pageSlugs(origin) {
  const response = await fetch(`${origin}/og/pages`)
  if (!response.ok) throw new Error(`GET ${origin}/og/pages — ${response.status}`)
  const { slugs } = await response.json()
  if (!pageFilter?.length) return slugs
  const unknown = pageFilter.filter((slug) => !slugs.includes(slug))
  if (unknown.length) throw new Error(`no page card for: ${unknown.join(", ")}`)
  return pageFilter
}

/**
 * 2x capture → 1200 x 630 → a 256-colour palette. The cards are flat vector
 * fills on two or three theme colours, so the palette costs nothing visible and
 * takes a card from ~90 KB to ~25 KB — which is the difference between 170 of
 * them being 15 MB of git history and being 4 MB of it.
 */
async function quantize(file) {
  const data = await sharp(file).png({ palette: true, effort: 10 }).toBuffer()
  await writeFile(file, data)
}

const kb = (size) => `${(size / 1024).toFixed(0)} KB`

async function main() {
  // `/og/pages` is the probe: it is the cheapest route here to compile, and it
  // is the one that has to answer before anything else can be planned.
  const { origin, stop } = await resolveOrigin(args.url, "/og/pages")
  const scratch = await scratchDir()

  try {
    await withPage(
      async (page) => {
        await page.viewport(WIDTH, HEIGHT)
        await page.media(PINNED)

        if (wantsSite) {
          const url = `${origin}/og${themeQuery}`
          console.log(`→ capturing ${url}`)
          const raw = path.join(scratch, "og@2x.png")
          await page.goto(url)
          await page.settle(SETTLE_MS)
          await page.screenshot(raw, { x: 0, y: 0, width: WIDTH, height: HEIGHT })
          await downsample(raw, siteOut, WIDTH, HEIGHT)
          const { size } = await stat(siteOut)
          console.log(`✓ ${path.relative(process.cwd(), siteOut)} — ${kb(size)}`)
        }

        if (!wantsPages) return

        const slugs = await pageSlugs(origin)
        await mkdir(PAGES_DIR, { recursive: true })
        console.log(`→ ${slugs.length} page cards`)

        const captured = []
        for (const [index, slug] of slugs.entries()) {
          const out = path.join(PAGES_DIR, `${slug}.png`)
          const raw = path.join(scratch, `${slug}@2x.png`)
          await page.goto(`${origin}/og/${slug}${themeQuery}`)
          await page.settle(PAGE_SETTLE_MS)
          await page.screenshot(raw, { x: 0, y: 0, width: WIDTH, height: HEIGHT })
          await downsample(raw, out, WIDTH, HEIGHT)
          await quantize(out)
          captured.push(slug)
          const { size } = await stat(out)
          console.log(`✓ ${index + 1}/${slugs.length} ${out} — ${kb(size)}`)
        }

        // Only when the whole set was captured: a `--only` run must not shrink
        // the manifest to the one card it took.
        if (!pageFilter?.length) await writeManifest(captured)
      },
      // The two 3D cards are a `<canvas>`, and headless Chrome without a
      // software rasteriser photographs those as empty panels.
      { webgl: true },
    )
  } finally {
    stop()
    await rm(scratch, { recursive: true, force: true })
  }
}

async function writeManifest(slugs) {
  const lines = [
    "/**",
    " * GENERATED by `scripts/build-og.mjs` — do not edit.",
    " *",
    " * The page cards under `public/og/` that have actually been captured. Read by",
    " * `src/lib/og.ts` so a page with no card yet falls back to the site card",
    " * rather than to a 404. Notes: `docs/per-page-og-images.md`.",
    " */",
    "",
    "export const capturedOgSlugs: string[] = [",
    ...[...slugs].sort().map((slug) => `  ${JSON.stringify(slug)},`),
    "]",
    "",
  ]
  await writeFile(MANIFEST, lines.join("\n"))
  console.log(`✓ ${MANIFEST} — ${slugs.length} cards`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
