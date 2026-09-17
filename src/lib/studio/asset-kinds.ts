/** What a file is, from what it says it is. Pure: the library's filters and the tests share it. */

export const assetKinds = ["image", "video", "audio", "font", "document", "other"] as const
export type AssetKind = (typeof assetKinds)[number]

export const MAX_ASSET_BYTES = 25 * 1024 * 1024

const documentMimes = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "text/plain",
  "text/markdown",
  "text/csv",
])

const bare = (mime: string) => mime.toLowerCase().split(";")[0].trim()

export function kindOf(mime: string): AssetKind {
  const type = bare(mime)
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"
  if (type.startsWith("font/") || type === "application/font-woff") return "font"
  if (documentMimes.has(type) || type.startsWith("text/")) return "document"
  return "other"
}

/**
 * Types a browser would *run* if it were handed them from our origin. They are
 * stored — a design team does trade HTML mock-ups — but always served as a
 * download, never inline. SVG is not here: it is served inline under a
 * sandboxing CSP instead, because people need to see it.
 */
const activeMimes = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/xml",
  "text/xml",
])
export const mustDownload = (mime: string) => activeMimes.has(bare(mime))

const isControl = (character: string) => {
  const code = character.charCodeAt(0)
  return code < 32 || code === 127
}

/** A file name safe to show, store and put in a `Content-Disposition`. */
export function cleanFileName(name: string) {
  const cleaned = [...name]
    .map((character) => (isControl(character) ? " " : character))
    .join("")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return cleaned || "untitled"
}

export function cleanTags(tags: readonly string[]) {
  const seen = new Set<string>()
  for (const tag of tags) {
    const cleaned = tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 32)
    if (cleaned) seen.add(cleaned)
  }
  return [...seen].slice(0, 20)
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
