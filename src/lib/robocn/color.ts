/**
 * robocn — colour resolution for WebGL.
 *
 * The 2D components hand CSS straight to SVG, so `var(--robot-shell)` and
 * `oklch(...)` just work. three.js parses neither, so the 3D components run
 * their palette through here first: CSS variables are read off the document,
 * and oklch is converted to sRGB in code rather than guessed at.
 */

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

/** Linear-light channel to a gamma-encoded sRGB byte. */
function encodeChannel(linear: number) {
  const value =
    linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
  return Math.round(clamp01(value) * 255)
}

const hex2 = (value: number) => value.toString(16).padStart(2, "0")

/** oklch()/oklab() to `#rrggbb`. Returns null for anything else. */
export function oklchToHex(input: string): string | null {
  const match = /^ok(lch|lab)\(([^)]+)\)$/i.exec(input.trim())
  if (!match) return null
  const parts = match[2]
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
  const number = (raw: string | undefined, scale = 1) => {
    if (!raw) return 0
    const value = Number.parseFloat(raw)
    if (Number.isNaN(value)) return 0
    return raw.trim().endsWith("%") ? (value / 100) * scale : value
  }

  const lightness = number(parts[0], 1)
  let a: number
  let b: number
  if (match[1].toLowerCase() === "lch") {
    const chroma = number(parts[1], 0.4)
    const hue = (number(parts[2]) * Math.PI) / 180
    a = chroma * Math.cos(hue)
    b = chroma * Math.sin(hue)
  } else {
    a = number(parts[1], 0.4)
    b = number(parts[2], 0.4)
  }

  // oklab -> LMS -> linear sRGB (Björn Ottosson's matrices).
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return `#${hex2(encodeChannel(r))}${hex2(encodeChannel(g))}${hex2(encodeChannel(blue))}`
}

/**
 * A colour three.js can parse. CSS variables are resolved against `context`
 * (or the document root), so a robot in a `.dark` subtree picks up that
 * subtree's values. Falls back to `fallback` while server-rendering.
 */
export function resolveCssColor(
  value: string,
  fallback = "#9ca3af",
  context?: Element | null,
): string {
  if (!value) return fallback
  let raw = value.trim()

  if (raw.includes("var(")) {
    if (typeof document === "undefined") return fallback
    const probe = document.createElement("span")
    probe.style.color = raw
    probe.style.display = "none"
    const host = context ?? document.body
    host.appendChild(probe)
    raw = getComputedStyle(probe).color || fallback
    probe.remove()
  }

  return oklchToHex(raw) ?? raw
}
