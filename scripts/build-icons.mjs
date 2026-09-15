#!/usr/bin/env node
/**
 * Writes the app icons: `src/app/icon.svg` and `src/app/apple-icon.png`.
 *
 * The mark is `<Logo />` — a three-link chain the component solves at runtime —
 * so the icon cannot be the component. It is a capture of it: this opens the
 * social-card route, where the logo renders with `behavior="static"` and is
 * therefore in its parked pose, lifts that SVG out of the DOM, and bakes every
 * computed fill and stroke onto the elements so the file stands on its own with
 * no stylesheet behind it.
 *
 * A maintainer command, like `pnpm og` and `pnpm shots`. Re-run it when the
 * mark changes — see `docs/logo.md` and `docs/site-polish.md`.
 *
 *   pnpm icons
 *   pnpm icons --url http://…:3001
 */

import { writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import sharp from "sharp"

import { parseArgs, resolveOrigin, withPage } from "./lib/capture.mjs"

/** Apple wants 180 px; everything else reads the SVG. */
const APPLE = 180
const OUT_SVG = "src/app/icon.svg"
const OUT_PNG = "src/app/apple-icon.png"

/**
 * Lifts the logo out of the page with its painted colours baked on.
 *
 * Every class is dropped and `fill`/`stroke`/`stroke-width` written as
 * attributes from the computed style, because an icon is loaded without the
 * page's stylesheet and `fill-shell` would otherwise resolve to nothing.
 */
const EXTRACT = `(() => {
  /**
   * The browser's own colour engine, used as a converter: the computed styles
   * come back as \`oklch(...)\`, which no SVG rasteriser understands. Painting a
   * pixel and reading it back gives the sRGB the tab strip would have shown.
   */
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  probe.canvas.width = probe.canvas.height = 1
  const resolve = (color) => {
    if (!color || color === "none") return null
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = color
    probe.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
    if (a === 0) return null
    return { hex: "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join(""), alpha: a / 255 }
  }

  const svg = document.querySelector("svg[viewBox='0 0 24 24']")
  if (!svg) return null
  const copy = svg.cloneNode(true)
  const sources = [svg, ...svg.querySelectorAll("*")]
  const copies = [copy, ...copy.querySelectorAll("*")]
  copies.forEach((node, i) => {
    const style = getComputedStyle(sources[i])
    node.removeAttribute("class")
    node.removeAttribute("style")
    if (node === copy) return
    for (const channel of ["fill", "stroke"]) {
      const paint = resolve(style[channel])
      if (!paint) continue
      node.setAttribute(channel, paint.hex)
      if (paint.alpha < 0.999) node.setAttribute(channel + "-opacity", paint.alpha.toFixed(3))
    }
    if (node.getAttribute("stroke") && style.strokeWidth) {
      node.setAttribute("stroke-width", parseFloat(style.strokeWidth).toFixed(2))
    }
  })
  copy.removeAttribute("aria-hidden")
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  copy.setAttribute("width", "24")
  copy.setAttribute("height", "24")
  return { markup: copy.outerHTML, ground: resolve(getComputedStyle(document.body).backgroundColor)?.hex ?? "#ffffff" }
})()`

/**
 * The bore through each joint is painted in the page's ground, which on a dark
 * tab strip would be a white hole. Rounded to a mid grey it reads as a bearing
 * in both schemes, which is the one thing a 16 px favicon has to get right.
 */
function neutraliseBores(markup, ground) {
  return markup.replaceAll(`fill="${ground}"`, 'fill="#8a8f94"')
}

const args = parseArgs(process.argv.slice(2))
const { origin, stop } = await resolveOrigin(args.url, "/og")

try {
  const captured = await withPage(async (page) => {
    await page.viewport(1200, 630, 1)
    await page.goto(`${origin}/og`)
    await page.settle(1500)
    return page.evaluate(EXTRACT)
  })

  if (!captured) throw new Error("no logo on /og — has the social card changed?")

  const svg = neutraliseBores(captured.markup, captured.ground)
  await writeFile(OUT_SVG, `${svg}\n`)
  // Apple composites a touch icon onto whatever it likes, so it gets an opaque
  // ground rather than the transparent corners outside the cell.
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(APPLE, APPLE)
    .flatten({ background: captured.ground })
    .png()
    .toFile(path.join(process.cwd(), OUT_PNG))

  console.log(`→ ${OUT_SVG}`)
  console.log(`→ ${OUT_PNG} (${APPLE}x${APPLE})`)
} finally {
  stop()
}
