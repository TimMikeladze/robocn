#!/usr/bin/env node
/**
 * Photograph one element of a running page, so a machine can be looked at
 * rather than guessed at.
 *
 *   node scripts/inspect.mjs --url http://localhost:3117/docs/rod-pump \
 *     --sel "[data-demo] svg" --out /tmp/shot.png --width 1280 --height 900
 *
 * Thin wrapper over the same DevTools driver `pnpm og` and `pnpm shots` use.
 * Maintainer tooling; nothing here runs in a build.
 */

import process from "node:process"

import { parseArgs, withPage } from "./lib/capture.mjs"

const args = parseArgs(process.argv.slice(2))
const url = args.url ?? "http://localhost:3117/"
const selector = args.sel ?? null
const out = args.out ?? "/tmp/inspect.png"
const width = Number(args.width ?? 1280)
const height = Number(args.height ?? 900)
const settle = Number(args.settle ?? 2200)
const theme = args.theme ?? "light"
const clicks = args.click ? String(args.click).split("|") : []

await withPage(async (page) => {
  await page.viewport(width, height, Number(args.scale ?? 2))
  await page.media([
    { name: "prefers-color-scheme", value: theme },
    ...(args.reduced ? [{ name: "prefers-reduced-motion", value: "reduce" }] : []),
  ])
  await page.goto(url)
  await page.settle(settle)

  for (const label of clicks) {
    const hit = await page.evaluate(
      `(() => {
        const wanted = ${JSON.stringify(label)}
        const nodes = [...document.querySelectorAll("button, [role=radio], [role=tab]")]
        const node = nodes.find((n) => (n.textContent || "").trim() === wanted)
        if (!node) return false
        node.click()
        return true
      })()`,
    )
    if (!hit) console.error(`  no control labelled ${JSON.stringify(label)}`)
    await page.evaluate("new Promise((r) => setTimeout(r, 500))", true)
  }
  if (clicks.length) await page.settle(900)

  let clip = { x: 0, y: 0, width, height }
  if (selector) {
    const scrolled = await page.scrollTo(selector, 80)
    if (scrolled === null) throw new Error(`no element matching ${selector}`)
    const box = await page.box(selector)
    if (!box) throw new Error(`no element matching ${selector}`)
    const pad = Number(args.pad ?? 12)
    clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y + scrolled - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    }
  }
  await page.screenshot(out, clip)
  console.log(`  ${out}  ${Math.round(clip.width)} x ${Math.round(clip.height)}`)
})
