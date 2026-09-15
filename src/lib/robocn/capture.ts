"use client"

/**
 * Getting a machine out of the DOM and into a file.
 *
 * A robocn component is an `<svg>` whose colours are `var(--robot-shell, …)`,
 * whose text inherits the page's font and whose sparks are CSS keyframes.
 * Serialize it and hand it to an `Image` and you get the *fallback* palette on
 * a transparent field with nothing moving — a different drawing than the one on
 * screen. So this module bakes the cascade into a clone before serializing it,
 * frame by frame, and writes the frame deltas it actually measured.
 *
 * Encoding is elsewhere and dependency-free: `./gif` writes GIF89a, `./webp`
 * re-houses the browser's own WebP frames as an animation. Notes:
 * `docs/export.md`.
 */

import { encodeGif, type GifFrame } from "@/lib/robocn/gif"
import { muxAnimatedWebp } from "@/lib/robocn/webp"

export type ExportFormat = "webp" | "gif" | "png"

export interface CaptureOptions {
  /** Device pixels per CSS pixel. */
  scale?: number
  /** A CSS colour painted under the drawing, or null to keep it transparent. */
  background?: string | null
  /** Inline same-origin `@font-face` files so text keeps its typeface. */
  fonts?: boolean
}

export interface RecordOptions extends CaptureOptions {
  /** Frames a second to aim for. What is written is what was measured. */
  fps?: number
  /** Seconds of motion. Zero — the default — takes a single frame. */
  duration?: number
  signal?: AbortSignal
  onProgress?: (captured: number, total: number) => void
}

/** A captured frame and how long it should stay on screen, in milliseconds. */
export interface Frame {
  canvas: HTMLCanvasElement
  delay: number
}

export type CaptureTarget = HTMLElement | SVGElement

/** Both containers floor a frame at 10 ms, and nothing should hang on one. */
const MIN_DELAY = 10
const MAX_DELAY = 10_000

/**
 * Frame delays from the instants the frames were sampled at.
 *
 * Serializing and decoding a frame costs tens of milliseconds, so a nominal
 * rate is a lie. Recording the real deltas means a recording plays back at the
 * speed the machine moved, and a slow frame reads as a long frame rather than
 * as a speed-up. The last frame has no successor, so it takes the average of
 * the rest — or the nominal interval when it is the only frame.
 */
export function frameDelays(sampledAt: number[], nominal: number): number[] {
  const clamp = (value: number) => Math.min(MAX_DELAY, Math.max(MIN_DELAY, Math.round(value)))
  if (sampledAt.length <= 1) return [clamp(nominal)]
  const deltas = sampledAt.slice(1).map((at, index) => clamp(at - sampledAt[index]))
  const mean = deltas.reduce((total, delta) => total + delta, 0) / deltas.length
  return [...deltas, clamp(mean)]
}

/** `robot-arm` + `gif` → `robot-arm.gif`; an empty name still gets a file. */
export const exportFileName = (name: string, format: ExportFormat) => {
  const stem = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${stem || "robocn"}.${format}`
}

/** Frames a recording of this length at this rate is made of. */
export const frameCount = (duration: number, fps: number) =>
  duration <= 0 ? 1 : Math.max(1, Math.round(duration * Math.max(1, fps)))

/**
 * Properties SVG children inherit. Emitted only where a child's computed value
 * differs from the one its parent already carries, which is the difference
 * between a few hundred declarations and twenty thousand.
 */
const SVG_INHERITED = [
  "color",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "paint-order",
  "shape-rendering",
  "text-anchor",
  "visibility",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
]

/** Properties an SVG element keeps to itself, with the value worth omitting. */
const SVG_OWN: [string, string][] = [
  ["opacity", "1"],
  ["mix-blend-mode", "normal"],
  ["filter", "none"],
  ["clip-path", "none"],
  ["mask", "none"],
  ["mask-type", "luminance"],
  ["vector-effect", "none"],
  ["dominant-baseline", "auto"],
  ["stop-color", "rgb(0, 0, 0)"],
  ["stop-opacity", "1"],
  ["display", "inline"],
]

/** What an HTML element needs for the clone to lay itself out and paint the same. */
const HTML_INHERITED = [
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant-numeric",
  "letter-spacing",
  "line-height",
  "text-align",
  "text-transform",
  "visibility",
  "white-space",
  "word-break",
]

const HTML_OWN = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "box-sizing",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "justify-content",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "order",
  "overflow-x",
  "overflow-y",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-radius",
  "box-shadow",
  "opacity",
  "filter",
  "mix-blend-mode",
  "transform",
  "transform-origin",
  "text-decoration-line",
  "text-shadow",
  "text-overflow",
  "vertical-align",
  "z-index",
]

/** Read a computed value without throwing on an engine that does not know the property. */
const read = (style: CSSStyleDeclaration, property: string) => {
  try {
    return style.getPropertyValue(property)
  } catch {
    return ""
  }
}

/**
 * Copy one element's computed style onto its clone, and hand the children the
 * inherited values they should be compared against.
 *
 * CSS animation is baked here too: an element mid-keyframe has a computed
 * `transform` and `opacity`, and copying them is the only way `robocn-spin`
 * survives into a clone that has no stylesheet.
 */
function bakeElement(
  live: Element,
  clone: Element,
  inherited: Map<string, string>,
  svg: boolean,
): Map<string, string> {
  const style = window.getComputedStyle(live)
  const declarations: string[] = []
  const next = new Map(inherited)

  for (const property of svg ? SVG_INHERITED : HTML_INHERITED) {
    const value = read(style, property)
    if (!value) continue
    if (inherited.get(property) === value) continue
    declarations.push(`${property}:${value}`)
    next.set(property, value)
  }

  if (svg) {
    for (const [property, initial] of SVG_OWN) {
      const value = read(style, property)
      if (!value || value === initial) continue
      declarations.push(`${property}:${value}`)
    }
    // Only an animated element needs its matrix copied; every other transform
    // is already on the clone as the attribute it was written as.
    if (read(style, "animation-name") !== "none") {
      for (const property of ["transform", "transform-origin", "transform-box"]) {
        const value = read(style, property)
        if (value) declarations.push(`${property}:${value}`)
      }
    }
  } else {
    for (const property of HTML_OWN) {
      const value = read(style, property)
      if (value) declarations.push(`${property}:${value}`)
    }
  }

  if (declarations.length > 0) {
    const own = clone.getAttribute("style")
    // The element's own inline style wins: it is the pose the component set.
    clone.setAttribute("style", `${declarations.join(";")};${own ?? ""}`)
  }
  // Classes cannot resolve in the clone and animation declarations would only
  // restart what has just been baked.
  clone.removeAttribute("class")
  return next
}

/** Walk the live tree and its clone together, baking as it goes. */
function bake(live: Element, clone: Element, inherited: Map<string, string>, svg: boolean) {
  const next = bakeElement(live, clone, inherited, svg)
  const inSvg = svg || live.tagName.toLowerCase() === "svg"
  const liveChildren = live.children
  const cloneChildren = clone.children
  for (let index = 0; index < liveChildren.length && index < cloneChildren.length; index += 1) {
    bake(liveChildren[index], cloneChildren[index], next, inSvg)
  }
}

/**
 * Swap every live `<canvas>` into the clone as the picture it is showing.
 *
 * A cloned canvas is blank — the bitmap is not part of the element. WebGL reads
 * back empty unless its context was made with `preserveDrawingBuffer`, which is
 * why `robot-stage` asks for one.
 */
function bakeCanvases(live: Element, clone: Element) {
  const liveCanvases = [live, ...live.querySelectorAll("canvas")].filter(
    (node): node is HTMLCanvasElement => node instanceof HTMLCanvasElement,
  )
  const cloneCanvases = [clone, ...clone.querySelectorAll("canvas")].filter(
    (node) => node.tagName.toLowerCase() === "canvas",
  )
  liveCanvases.forEach((canvas, index) => {
    const target = cloneCanvases[index]
    if (!target?.parentNode) return
    let url: string
    try {
      url = canvas.toDataURL("image/png")
    } catch {
      return // Tainted by a cross-origin draw: leave the gap rather than throw.
    }
    const rect = canvas.getBoundingClientRect()
    const image = document.createElementNS("http://www.w3.org/1999/xhtml", "img")
    image.setAttribute("src", url)
    image.setAttribute("width", String(Math.round(rect.width) || canvas.width))
    image.setAttribute("height", String(Math.round(rect.height) || canvas.height))
    image.setAttribute("style", target.getAttribute("style") ?? "")
    target.parentNode.replaceChild(image, target)
  })
}

let fontFaces: Promise<string> | null = null

/**
 * Every same-origin `@font-face` in the document, with its files inlined.
 *
 * Fetched once per page: a capture re-serializes on every frame, and the
 * typeface does not change between them. A cross-origin sheet throws on
 * `cssRules` and a cross-origin file cannot be read — both are skipped, and the
 * text falls back rather than the capture failing.
 */
async function inlineFonts(): Promise<string> {
  if (fontFaces) return fontFaces
  fontFaces = (async () => {
    // A rule and the sheet it came from: font URLs are relative to the
    // stylesheet, not to the page. Next writes `../media/…`, which resolves to
    // a 404 against the document and to the real file against the sheet.
    const rules: { text: string; base: string }[] = []
    // Recursive on purpose: a `@font-face` can sit inside `@layer`, `@media` or
    // `@supports`, and Tailwind puts the whole sheet in layers.
    const collect = (list: CSSRuleList, base: string) => {
      for (const rule of Array.from(list)) {
        if (/^@font-face/.test(rule.cssText)) {
          rules.push({ text: rule.cssText, base })
          continue
        }
        const nested = (rule as CSSGroupingRule).cssRules
        if (nested) collect(nested, base)
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        collect(sheet.cssRules, sheet.href ?? document.baseURI)
      } catch {
        // A cross-origin sheet throws rather than listing: its faces fall back.
      }
    }
    const urls = new Map<string, string>()
    for (const rule of rules) {
      for (const match of rule.text.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
        urls.set(match[2], rule.base)
      }
    }
    const embedded = new Map<string, string>()
    await Promise.all(
      [...urls].map(async ([url, base]) => {
        try {
          const absolute = new URL(url, base)
          if (absolute.origin !== window.location.origin) return
          const response = await fetch(absolute.href)
          if (!response.ok) return
          const buffer = await response.arrayBuffer()
          let binary = ""
          const bytes = new Uint8Array(buffer)
          for (let index = 0; index < bytes.length; index += 1) {
            binary += String.fromCharCode(bytes[index])
          }
          const type = response.headers.get("content-type") ?? "font/woff2"
          embedded.set(url, `data:${type};base64,${window.btoa(binary)}`)
        } catch {
          /* One missing face is a fallback, not a failed export. */
        }
      }),
    )
    return rules
      .map((rule) =>
        rule.text.replace(/url\((['"]?)([^'")]+)\1\)/g, (whole, _quote, url) => {
          const data = embedded.get(url)
          return data ? `url("${data}")` : whole
        }),
      )
      .filter((rule) => rule.includes("data:"))
      .join("\n")
  })()
  return fontFaces
}

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export interface Snapshot {
  markup: string
  width: number
  height: number
  /** Whether the document wraps HTML in a `<foreignObject>`. It changes how it can be loaded. */
  foreign: boolean
}

/**
 * One instant of a target as a standalone SVG document.
 *
 * An `<svg>` target is snapshotted as itself. Anything else — a demo panel with
 * its controls, the workbench stage, a whole matrix — is wrapped in a
 * `<foreignObject>`, which is how the browser is persuaded to rasterize HTML.
 */
export async function snapshot(
  target: CaptureTarget,
  options: CaptureOptions = {},
): Promise<Snapshot> {
  const rect = target.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const isSvg = target.tagName.toLowerCase() === "svg"
  const clone = target.cloneNode(true) as Element

  bake(target, clone, new Map(), isSvg)
  bakeCanvases(target, clone)
  // Last, so neither walk above loses its live-to-clone alignment: the export
  // button itself sits inside the thing it records, and does not belong in it.
  for (const chrome of Array.from(clone.querySelectorAll("[data-robocn-hide]"))) chrome.remove()

  const wantsFonts = options.fonts !== false && (target.textContent ?? "").trim().length > 0
  const faces = wantsFonts ? await inlineFonts() : ""

  if (isSvg) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
    clone.setAttribute("width", String(width))
    clone.setAttribute("height", String(height))
    if (faces) {
      const sheet = document.createElementNS("http://www.w3.org/2000/svg", "style")
      sheet.textContent = faces
      clone.insertBefore(sheet, clone.firstChild)
    }
    return {
      markup: new XMLSerializer().serializeToString(clone),
      width,
      height,
      foreign: false,
    }
  }

  const style = faces ? `<style>${escapeXml(faces)}</style>` : ""

  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")
  const own = clone.getAttribute("style") ?? ""
  // The clone is the whole document now: it lays out at the origin, at the size
  // it had on the page, with nothing outside it to push it around.
  clone.setAttribute(
    "style",
    `${own};margin:0;position:static;inset:auto;width:${width}px;height:${height}px;`,
  )
  const body = new XMLSerializer().serializeToString(clone)
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">${style}` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">${body}</foreignObject></svg>`
  return { markup, width, height, foreign: true }
}

/**
 * The colour showing through a target that paints none of its own — the first
 * opaque background above it, which is what a viewer sees behind the machine.
 */
export function backgroundBehind(node: Element): string {
  let current: Element | null = node
  while (current) {
    const colour = window.getComputedStyle(current).backgroundColor
    if (colour && colour !== "transparent" && !/^rgba\(.*,\s*0\)$/.test(colour)) return colour
    current = current.parentElement
  }
  return "#ffffff"
}

/**
 * A snapshot, painted.
 *
 * A blob URL beats a data URL on both the encode and the decode, and that is
 * what a pure SVG snapshot gets. A document carrying a `<foreignObject>` does
 * not: Chrome taints the canvas when one arrives over `blob:`, and a tainted
 * canvas cannot be read back at all — no `toBlob`, no `getImageData`, no
 * export. The same document over `data:` is clean.
 */
export async function rasterize(
  shot: Snapshot,
  options: CaptureOptions = {},
): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 2
  const url = shot.foreign
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shot.markup)}`
    : URL.createObjectURL(new Blob([shot.markup], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const image = new Image()
    image.decoding = "sync"
    image.src = url
    await (image.decode
      ? image.decode()
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error("the snapshot would not render"))
        }))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(shot.width * scale))
    canvas.height = Math.max(1, Math.round(shot.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    context.imageSmoothingQuality = "high"
    if (options.background) {
      context.fillStyle = options.background
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    if (!shot.foreign) URL.revokeObjectURL(url)
  }
}

/** One frame, start to finish. */
export const captureFrame = async (target: CaptureTarget, options: CaptureOptions = {}) =>
  rasterize(await snapshot(target, options), options)

/**
 * The next paint, or 100 ms, whichever comes first.
 *
 * A hidden tab never paints, so waiting on `requestAnimationFrame` alone is a
 * recording that hangs at two frames out of fifteen with no way out. The timer
 * keeps it moving: the machine is frozen behind the scenes, so the frames come
 * out the same, but the file is written and the button comes back.
 */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(done)
    setTimeout(done, 100)
  })

const now = () =>
  typeof performance === "object" && typeof performance.now === "function"
    ? performance.now()
    : Date.now()

/**
 * Sample a target over time.
 *
 * Real time, on purpose: the machines run on `requestAnimationFrame`, so the
 * only way to record what they do is to watch them do it. A frame that took
 * longer than the interval is not dropped — the delta is written instead.
 */
export async function record(
  target: CaptureTarget,
  options: RecordOptions = {},
): Promise<Frame[]> {
  const fps = Math.max(1, options.fps ?? 15)
  const total = frameCount(options.duration ?? 0, fps)
  const interval = 1000 / fps
  const canvases: HTMLCanvasElement[] = []
  const sampledAt: number[] = []

  // A throwaway first frame, so the font fetch and the first layout are not
  // charged to frame one — otherwise every loop opens on a held still.
  if (total > 1 && !options.signal?.aborted) await captureFrame(target, options)

  for (let index = 0; index < total; index += 1) {
    if (options.signal?.aborted) break
    const start = now()
    sampledAt.push(start)
    canvases.push(await captureFrame(target, options))
    options.onProgress?.(index + 1, total)
    if (index === total - 1) break
    // Only wait for the part of the interval the capture did not already spend.
    while (now() - start < interval) {
      if (options.signal?.aborted) break
      await nextFrame()
    }
  }

  if (canvases.length === 0) throw new Error("nothing was captured")
  const delays = frameDelays(sampledAt.slice(0, canvases.length), interval)
  return canvases.map((canvas, index) => ({ canvas, delay: delays[index] }))
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`this browser cannot write ${type}`))),
      type,
      quality,
    )
  })

const imageData = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("no 2d context")
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

/** Whether this browser's canvas can write WebP at all. Safari before 14 could not. */
export const supportsWebp = () => {
  try {
    return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    return false
  }
}

export interface EncodeOptions {
  /** Lossy quality for WebP, 0–1. */
  quality?: number
  /** Repeat count for the animated formats; 0 is forever. */
  loop?: number
}

/** Frames to a file. One frame is a still; more than one is an animation. */
export async function encodeFrames(
  frames: Frame[],
  format: ExportFormat,
  options: EncodeOptions = {},
): Promise<Blob> {
  if (frames.length === 0) throw new Error("nothing to encode")
  const { quality = 0.92, loop = 0 } = options
  const { width, height } = frames[0].canvas

  if (format === "png") return toBlob(frames[0].canvas, "image/png")

  if (format === "gif") {
    const gif = encodeGif(
      frames.map((frame): GifFrame => {
        const { data } = imageData(frame.canvas)
        return { data, delay: frame.delay }
      }),
      { width, height, loop },
    )
    return new Blob([gif as unknown as BlobPart], { type: "image/gif" })
  }

  if (frames.length === 1) return toBlob(frames[0].canvas, "image/webp", quality)
  const encoded = await Promise.all(
    frames.map(async (frame) => ({
      delay: frame.delay,
      data: new Uint8Array(await (await toBlob(frame.canvas, "image/webp", quality)).arrayBuffer()),
    })),
  )
  const webp = muxAnimatedWebp(encoded, { width, height, loop })
  return new Blob([webp as unknown as BlobPart], { type: "image/webp" })
}

/** Hand the file to the browser. Nothing leaves the page. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately races the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ExportOptions extends RecordOptions, EncodeOptions {
  format?: ExportFormat
  /** File stem. The extension comes from the format. */
  name?: string
  /**
   * What to do with the finished file. Defaults to {@link download}, which
   * hands it to the browser.
   *
   * The way out of a page is not always the downloads folder: a page holding a
   * directory handle can write the blob into a repository instead, which is
   * where a screenshot was going anyway.
   */
  save?: (blob: Blob, filename: string) => void | Promise<void>
}

export interface ExportResult {
  blob: Blob
  filename: string
  frames: number
  width: number
  height: number
}

/** Record a target and save it. The whole path, for a button to call. */
export async function exportNode(
  target: CaptureTarget,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const format = options.format ?? "webp"
  // A still is a still whatever the duration says, and PNG has no animation.
  const duration = format === "png" ? 0 : options.duration ?? 0
  const frames = await record(target, { ...options, duration })
  const blob = await encodeFrames(frames, format, options)
  const filename = exportFileName(options.name ?? "robocn", format)
  await (options.save ?? download)(blob, filename)
  return {
    blob,
    filename,
    frames: frames.length,
    width: frames[0].canvas.width,
    height: frames[0].canvas.height,
  }
}
