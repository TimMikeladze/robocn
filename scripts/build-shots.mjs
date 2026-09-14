#!/usr/bin/env node
/**
 * Captures the README screenshots into `docs/screenshots/`.
 *
 * Same argument as the social card: the pages are CSS-variable-themed SVG, so
 * the only honest picture of them is a picture of the real thing. Reasoning and
 * the shot list are in `docs/screenshots.md`.
 *
 *   pnpm shots                     every shot, light and dark
 *   pnpm shots --only landing      one shot
 *   pnpm shots --theme dark        one register
 *   pnpm shots --url http://…:3001 capture from a server you name
 *
 * macOS + Google Chrome only; a maintainer command, not part of `pnpm build`.
 */

import { mkdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import {
  downsample,
  parseArgs,
  resolveOrigin,
  rm,
  scratchDir,
  wait,
  withPage,
} from "./lib/capture.mjs"

const OUT_DIR = "docs/screenshots"
/** Hydration, the theme class, and a settled first frame of the motion loops. */
const SETTLE_MS = 3000
/** Clear the sticky header when scrolling a section to the top. */
const HEADER = 8

/**
 * `scrollTo` is a selector that must exist — see `docs/screenshots.md` for why a
 * missing one is fatal rather than a silent full-page capture.
 */
const SHOTS = [
  { name: "landing", route: "/", width: 1280, height: 812 },
  { name: "catalogue", route: "/", width: 1280, height: 900, scrollTo: "#catalogue" },
  { name: "docs", route: "/docs/robot-arm", width: 1280, height: 900 },
  { name: "workbench", route: "/workbench?setup=0", width: 1440, height: 900, settleMs: 5000 },
  { name: "workbench-setup", route: "/workbench?setup=1", width: 1440, height: 900, settleMs: 3000 },
]

const THEMES = ["light", "dark"]

const args = parseArgs(process.argv.slice(2))
const shots = args.only
  ? SHOTS.filter((shot) => String(args.only).split(",").includes(shot.name))
  : SHOTS
const themes = args.theme ? [String(args.theme)] : THEMES

if (shots.length === 0) {
  console.error(`no shot named ${args.only}. Known: ${SHOTS.map((s) => s.name).join(", ")}`)
  process.exit(1)
}

/**
 * The host the install lines should print, read off `site.ts` rather than
 * repeated here — the pages render whatever host is serving them, which on a
 * dev server is `localhost`.
 */
async function productionUrl() {
  const source = await readFile("src/lib/site.ts", "utf8")
  const match = source.match(/export const productionUrl = "([^"]+)"/)
  if (!match) throw new Error("no `productionUrl` in src/lib/site.ts")
  return match[1]
}

/**
 * next-themes reads its choice out of `localStorage` under `theme`, so the only
 * way to pin the register is to be on the origin first and then reload into it.
 * Left on `system` the capture comes out in whatever theme the machine running
 * Chrome is in, which is how the first social card came out dark.
 */
async function pinTheme(page, origin, theme) {
  await page.goto(`${origin}/`)
  await page.evaluate(`window.localStorage.setItem("theme", ${JSON.stringify(theme)})`)
}

async function main() {
  const { origin, stop } = await resolveOrigin(args.url, "/")
  const production = await productionUrl()
  const scratch = await scratchDir()
  await mkdir(OUT_DIR, { recursive: true })

  try {
    for (const theme of themes) {
      // `webgl`: the catalogue has react-three-fiber tiles on it, and headless
      // Chrome without a software rasteriser photographs them as empty panels.
      await withPage(async (page) => {
        await page.colorScheme(theme)
        await page.viewport(1280, 900)
        await pinTheme(page, origin, theme)

        for (const shot of shots) {
          const out = path.join(OUT_DIR, `${shot.name}-${theme}.png`)
          const raw = path.join(scratch, `${shot.name}-${theme}@2x.png`)
          console.log(`→ ${shot.name} (${theme}) — ${origin}${shot.route}`)

          await page.viewport(shot.width, shot.height)
          await page.goto(`${origin}${shot.route}`)
          await page.settle(shot.settleMs ?? SETTLE_MS)

          let top = 0
          if (shot.scrollTo) {
            if (!(await page.waitForSelector(shot.scrollTo))) {
              throw new Error(`${shot.name}: no ${shot.scrollTo} on ${shot.route}`)
            }
            top = await page.scrollTo(shot.scrollTo, HEADER)
            // The machines below the fold only start their loops once they are
            // on screen, so give them a cycle before the shutter.
            await wait(1500)
          }

          await page.rewriteLocalHost(production)
          await page.screenshot(raw, { y: top, width: shot.width, height: shot.height })
          await downsample(raw, out, shot.width, shot.height)
          const { size } = await stat(out)
          console.log(`✓ ${out} — ${(size / 1024).toFixed(0)} KB`)
        }
      }, { webgl: true })
    }
  } finally {
    stop()
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
