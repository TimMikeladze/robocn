/**
 * robocn — the site's global theme.
 *
 * A preset is three hues and three chroma multipliers, not a hand-written block
 * of colours. Every token below carries a fixed lightness, a chroma, the role it
 * takes its hue from, and an offset from that role's hue — the offsets already
 * baked into `globals.css`. Rotating a role therefore moves the whole ladder
 * together and keeps the relationships that made the default look right.
 *
 * See `docs/theme-changer.md`.
 */

/** Which of the three hues a token hangs off. */
export type ThemeRole = "base" | "signal" | "shell"

export interface ThemeToken {
  /** CSS custom property, including the leading `--`. */
  name: string
  /** oklch lightness, fixed across presets: contrast is not negotiable. */
  l: number
  /** oklch chroma, before the role's multiplier. */
  c: number
  role: ThemeRole
  /** Degrees from the role's hue. */
  h: number
}

export interface ThemeRoleSpec {
  hue: number
  /** Multiplies every token chroma on this role. `0` gives greyscale. */
  chroma: number
}

export interface ThemePreset {
  id: string
  label: string
  roles: Record<ThemeRole, ThemeRoleSpec>
}

export interface ThemeData {
  ladder: { light: ThemeToken[]; dark: ThemeToken[] }
  presets: ThemePreset[]
  radii: number[]
  defaults: { preset: string; radius: number }
  storageKey: string
  styleId: string
}

/** A hand-picked override for one role: an absolute hue and a chroma multiplier. */
export interface ThemeTune {
  hue: number
  chroma: number
}

export interface ThemeChoice {
  preset: string
  radius: number
  /** Per-role overrides on top of the preset. Absent roles keep the preset's. */
  tune?: Partial<Record<ThemeRole, ThemeTune>>
}

/**
 * The light register. Hue offsets are relative to the role hue, so `steel`
 * (base 246 / signal 176 / shell 46) reproduces `globals.css` exactly.
 */
const light: ThemeToken[] = [
  { name: "--background", l: 0.966, c: 0.003, role: "base", h: -6 },
  { name: "--foreground", l: 0.23, c: 0.014, role: "base", h: 4 },
  { name: "--panel", l: 0.995, c: 0.001, role: "base", h: -6 },
  { name: "--card", l: 0.995, c: 0.001, role: "base", h: -6 },
  { name: "--popover", l: 0.995, c: 0.001, role: "base", h: -6 },
  { name: "--primary", l: 0.24, c: 0.016, role: "base", h: 4 },
  { name: "--primary-foreground", l: 0.98, c: 0.002, role: "base", h: -6 },
  { name: "--secondary", l: 0.93, c: 0.004, role: "base", h: -1 },
  { name: "--muted", l: 0.93, c: 0.004, role: "base", h: -1 },
  { name: "--muted-foreground", l: 0.52, c: 0.012, role: "base", h: 4 },
  { name: "--accent", l: 0.93, c: 0.006, role: "base", h: -1 },
  { name: "--border", l: 0.885, c: 0.006, role: "base", h: -1 },
  { name: "--input", l: 0.885, c: 0.006, role: "base", h: -1 },
  { name: "--datum", l: 0.78, c: 0.01, role: "base", h: -1 },
  { name: "--ring", l: 0.62, c: 0.12, role: "signal", h: 0 },
  { name: "--signal", l: 0.56, c: 0.11, role: "signal", h: 0 },
  // A shade darker than `--robot-shell`, so a 28 px mark holds a near-white ground.
  { name: "--shell", l: 0.63, c: 0.18, role: "shell", h: -2 },
  { name: "--shell-hot", l: 0.7, c: 0.2, role: "shell", h: 4 },
  { name: "--robot-shell", l: 0.72, c: 0.17, role: "shell", h: 1 },
  { name: "--robot-metal", l: 0.85, c: 0.012, role: "base", h: 4 },
  { name: "--robot-dark", l: 0.32, c: 0.02, role: "base", h: 4 },
  { name: "--robot-accent", l: 0.72, c: 0.15, role: "signal", h: 0 },
  { name: "--robot-glow", l: 0.78, c: 0.16, role: "signal", h: 0 },
  { name: "--robot-grid", l: 0.62, c: 0.02, role: "base", h: 4 },
]

const dark: ThemeToken[] = [
  { name: "--background", l: 0.175, c: 0.012, role: "base", h: 6 },
  { name: "--foreground", l: 0.95, c: 0.004, role: "base", h: -6 },
  { name: "--panel", l: 0.215, c: 0.013, role: "base", h: 6 },
  { name: "--card", l: 0.215, c: 0.013, role: "base", h: 6 },
  { name: "--popover", l: 0.215, c: 0.013, role: "base", h: 6 },
  { name: "--primary", l: 0.95, c: 0.004, role: "base", h: -6 },
  { name: "--primary-foreground", l: 0.2, c: 0.013, role: "base", h: 6 },
  { name: "--secondary", l: 0.265, c: 0.013, role: "base", h: 6 },
  { name: "--muted", l: 0.265, c: 0.013, role: "base", h: 6 },
  { name: "--muted-foreground", l: 0.68, c: 0.012, role: "base", h: 4 },
  { name: "--accent", l: 0.27, c: 0.014, role: "base", h: 6 },
  { name: "--border", l: 0.3, c: 0.013, role: "base", h: 6 },
  { name: "--input", l: 0.3, c: 0.013, role: "base", h: 6 },
  { name: "--datum", l: 0.38, c: 0.013, role: "base", h: 6 },
  { name: "--ring", l: 0.78, c: 0.14, role: "signal", h: 0 },
  { name: "--signal", l: 0.8, c: 0.14, role: "signal", h: 0 },
  { name: "--shell", l: 0.73, c: 0.19, role: "shell", h: 0 },
  { name: "--shell-hot", l: 0.82, c: 0.19, role: "shell", h: 10 },
  { name: "--robot-shell", l: 0.7, c: 0.18, role: "shell", h: 1 },
  { name: "--robot-metal", l: 0.72, c: 0.015, role: "base", h: 4 },
  { name: "--robot-dark", l: 0.26, c: 0.02, role: "base", h: 4 },
  { name: "--robot-accent", l: 0.84, c: 0.16, role: "signal", h: 0 },
  { name: "--robot-glow", l: 0.88, c: 0.17, role: "signal", h: 0 },
  { name: "--robot-grid", l: 0.55, c: 0.02, role: "base", h: 4 },
]

const roles = (
  base: number,
  signal: number,
  shell: number,
  chroma: Partial<Record<ThemeRole, number>> = {},
): Record<ThemeRole, ThemeRoleSpec> => ({
  base: { hue: base, chroma: chroma.base ?? 1 },
  signal: { hue: signal, chroma: chroma.signal ?? 1 },
  shell: { hue: shell, chroma: chroma.shell ?? 1 },
})

/**
 * Eight, each a pairing rather than a single colour: a ground, a signal the
 * chrome takes, and the paint on the machines.
 */
export const themePresets: ThemePreset[] = [
  // Shell hues are spread around the wheel, because the machines are the
  // largest coloured mass on any page here and two presets that paint them
  // the same colour are the same preset as far as a reader is concerned.
  { id: "steel", label: "Steel", roles: roles(246, 176, 46) },
  { id: "rust", label: "Rust", roles: roles(52, 150, 28, { base: 0.9 }) },
  { id: "sulphur", label: "Sulphur", roles: roles(96, 258, 85, { base: 0.9 }) },
  { id: "viridian", label: "Viridian", roles: roles(162, 45, 150, { base: 0.95 }) },
  { id: "cobalt", label: "Cobalt", roles: roles(264, 62, 262, { base: 1.1 }) },
  { id: "plasma", label: "Plasma", roles: roles(302, 285, 322, { base: 1.1 }) },
  // The ground carries real blue and the machines are drawn in the signal:
  // white on blue, the way the drawing this came from was printed.
  { id: "blueprint", label: "Blueprint", roles: roles(252, 220, 218, { base: 2.2 }) },
  { id: "mono", label: "Mono", roles: roles(246, 246, 246, { base: 0, signal: 0, shell: 0 }) },
]

/** Corner radius in rem. `0.625` is the shadcn default and ours. */
export const themeRadii = [0, 0.3, 0.625, 1]

export const themeStorageKey = "robocn-theme"
export const themeStyleId = "robocn-theme"

export const defaultThemeChoice: ThemeChoice = { preset: "steel", radius: 0.625 }

export const themeData: ThemeData = {
  ladder: { light, dark },
  presets: themePresets,
  radii: themeRadii,
  defaults: defaultThemeChoice,
  storageKey: themeStorageKey,
  styleId: themeStyleId,
}

/**
 * Both registers in one stylesheet, so light/dark stays a class flip with no
 * JavaScript in the path.
 *
 * Self-contained on purpose: it has no free identifiers, because it is also
 * serialised with `toString()` into the pre-paint script.
 */
export function themeCss(
  data: ThemeData,
  presetId: string,
  radius: number,
  tune?: Partial<Record<ThemeRole, ThemeTune>>,
): string {
  // No `??` and no `?.` anywhere in the serialised functions: whatever a build
  // decides to do with newer syntax, this has to survive `toString()`.
  const matches = data.presets.filter((p) => p.id === presetId)
  const preset = matches.length > 0 ? matches[0] : data.presets[0]
  const picked = tune ? tune : {}
  // A tuned role replaces the preset's hue and chroma; an untuned one is the
  // preset untouched, so `steel` with no tune is still byte-for-byte `steel`.
  const specOf = (name: ThemeRole): ThemeRoleSpec => {
    const from = preset.roles[name]
    const over = picked[name]
    if (!over) return from
    return {
      hue: typeof over.hue === "number" ? over.hue : from.hue,
      chroma: typeof over.chroma === "number" ? over.chroma : from.chroma,
    }
  }
  const block = (tokens: ThemeToken[]) =>
    tokens
      .map((t) => {
        const role = specOf(t.role)
        const c = Math.round(t.c * role.chroma * 10000) / 10000
        const h = (((role.hue + t.h) % 360) + 360) % 360
        return t.name + ":oklch(" + t.l + " " + c + " " + h + ")"
      })
      .join(";")
  // `:root:root` outranks `globals.css` — and outranks Next's dev-time style
  // injection, which can land after ours in the head.
  return (
    ":root:root:not(.dark){" + block(data.ladder.light) + ";--radius:" + radius + "rem}" +
    ":root:root.dark{" + block(data.ladder.dark) + "}"
  )
}

export type ThemeCssFn = typeof themeCss

/**
 * Writes the stylesheet. Used after mount and, via `toString()`, before paint —
 * so it too takes everything as an argument.
 */
export function applyTheme(
  css: ThemeCssFn,
  data: ThemeData,
  choice: ThemeChoice,
): void {
  let el = document.getElementById(data.styleId) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement("style")
    el.id = data.styleId
    document.head.appendChild(el)
  }
  el.textContent = css(data, choice.preset, choice.radius, choice.tune)
}

/**
 * Anything can be in `localStorage`; only three fields are ours, and a tune is
 * only taken a role at a time with both numbers in range — a half-written or
 * hand-edited entry degrades to the preset rather than to a broken palette.
 */
export function readThemeChoice(raw: string | null, data: ThemeData): ThemeChoice {
  const choice: ThemeChoice = { preset: data.defaults.preset, radius: data.defaults.radius }
  if (!raw) return choice
  try {
    const saved = JSON.parse(raw)
    if (saved && typeof saved.preset === "string") choice.preset = saved.preset
    if (saved && typeof saved.radius === "number") {
      choice.radius = Math.min(2, Math.max(0, saved.radius))
    }
    if (saved && saved.tune && typeof saved.tune === "object") {
      const tune: Partial<Record<ThemeRole, ThemeTune>> = {}
      const names: ThemeRole[] = ["base", "signal", "shell"]
      for (let i = 0; i < names.length; i++) {
        const entry = saved.tune[names[i]]
        if (entry && typeof entry.hue === "number" && typeof entry.chroma === "number") {
          tune[names[i]] = {
            hue: (((entry.hue % 360) + 360) % 360),
            chroma: Math.min(3, Math.max(0, entry.chroma)),
          }
        }
      }
      if (names.filter((n) => tune[n]).length > 0) choice.tune = tune
    }
  } catch {
    return choice
  }
  return choice
}

/**
 * The pre-paint boot. Every dependency arrives as an argument, so the whole
 * thing serialises to a string with nothing left dangling.
 */
function bootTheme(
  css: ThemeCssFn,
  apply: typeof applyTheme,
  read: typeof readThemeChoice,
  data: ThemeData,
): void {
  try {
    apply(css, data, read(window.localStorage.getItem(data.storageKey), data))
  } catch {
    /* Pre-paint theming is best-effort: globals.css already holds the default. */
  }
}

/** The inline script, built from the same functions the app runs. */
export function themeBootScript(data: ThemeData = themeData): string {
  return (
    "(" + bootTheme.toString() + ")(" +
    themeCss.toString() + "," +
    applyTheme.toString() + "," +
    readThemeChoice.toString() + "," +
    JSON.stringify(data) +
    ")"
  )
}

/** The three roles, in panel order. */
export const themeRoles: ThemeRole[] = ["base", "signal", "shell"]

/** The token that stands in for a role wherever one colour has to speak for it. */
const roleToken: Record<ThemeRole, string> = {
  base: "--background",
  signal: "--signal",
  shell: "--robot-shell",
}

/**
 * How much chroma a role's representative token carries at multiplier `1`.
 * A picked colour's own chroma is read against this to get the multiplier, so
 * a vivid pick on `base` tints the ground without bleaching the ladder.
 */
const roleChromaRef: Record<ThemeRole, number> = { base: 0.09, signal: 0.13, shell: 0.17 }

/** The role's spec after any tune — what the panel and the CSS both work from. */
export function roleSpec(
  preset: ThemePreset,
  role: ThemeRole,
  tune?: Partial<Record<ThemeRole, ThemeTune>>,
): ThemeRoleSpec {
  const from = preset.roles[role]
  const over = tune?.[role]
  if (!over) return from
  return { hue: over.hue, chroma: over.chroma }
}

/** A role's representative colour, in oklch parts. */
export function roleSwatchParts(
  spec: ThemeRoleSpec,
  role: ThemeRole,
  mode: "light" | "dark" = "light",
) {
  const token = (mode === "light" ? light : dark).filter((t) => t.name === roleToken[role])[0]
  return {
    l: token.l,
    c: Math.round(token.c * spec.chroma * 10000) / 10000,
    h: (((spec.hue + token.h) % 360) + 360) % 360,
  }
}

/** One swatch colour, for the preset chips and the role pickers in the panel. */
export function roleSwatch(spec: ThemeRoleSpec, role: ThemeRole, mode: "light" | "dark" = "light") {
  const { l, c, h } = roleSwatchParts(spec, role, mode)
  return `oklch(${l} ${c} ${h})`
}

/** One swatch colour, for the preset chips in the panel. */
export function presetSwatch(preset: ThemePreset, role: ThemeRole, mode: "light" | "dark" = "light") {
  return roleSwatch(preset.roles[role], role, mode)
}

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** `#rrggbb` to oklch. The panel's colour inputs speak hex; the ladder does not. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const text = hex.replace("#", "")
  const full =
    text.length === 3 ? text[0] + text[0] + text[1] + text[1] + text[2] + text[2] : text.slice(0, 6)
  const n = Number.parseInt(full, 16)
  const r = srgbToLinear(((n >> 16) & 255) / 255)
  const g = srgbToLinear(((n >> 8) & 255) / 255)
  const b = srgbToLinear((n & 255) / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return {
    l: Math.round(L * 10000) / 10000,
    c: Math.round(Math.hypot(A, B) * 10000) / 10000,
    h: (((Math.atan2(B, A) * 180) / Math.PI + 360) % 360),
  }
}

/** oklch to `#rrggbb`, clipped into sRGB — a colour input cannot show wide gamut. */
export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180
  const A = c * Math.cos(rad)
  const B = c * Math.sin(rad)

  const ls = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const ms = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const ss = (l - 0.0894841775 * A - 1.291485548 * B) ** 3

  const rgb = [
    4.0767416621 * ls - 3.3077115913 * ms + 0.2309699292 * ss,
    -1.2684380046 * ls + 2.6097574011 * ms - 0.3413193965 * ss,
    -0.0041960863 * ls - 0.7034186147 * ms + 1.707614701 * ss,
  ].map((v) =>
    Math.round(clamp01(linearToSrgb(clamp01(v))) * 255)
      .toString(16)
      .padStart(2, "0"),
  )
  return `#${rgb.join("")}`
}

/** The tune a picked hex implies for a role: its hue, and its chroma as a multiplier. */
export function tuneFromHex(hex: string, role: ThemeRole): ThemeTune {
  const { c, h } = hexToOklch(hex)
  return {
    hue: Math.round(h),
    chroma: Math.round(Math.min(3, c / roleChromaRef[role]) * 100) / 100,
  }
}

/**
 * A random tune for every role: three hues spread apart, chroma in a band that
 * stays inside sRGB. Higher is reachable on the dial, but a random theme that
 * lands out of gamut just shows up clipped, which reads as a bug.
 */
export function randomTune(): Record<ThemeRole, ThemeTune> {
  const start = Math.random() * 360
  const spread = 60 + Math.random() * 120
  const band = (low: number, high: number) =>
    Math.round((low + Math.random() * (high - low)) * 100) / 100
  // Round first, then wrap: rounding 359.6 into the circle gives 360, which is
  // off the end of the hue range.
  const hue = (value: number) => Math.round(value) % 360
  return {
    base: { hue: hue(start), chroma: band(0.4, 1.4) },
    signal: { hue: hue(start + spread), chroma: band(0.7, 1.15) },
    shell: { hue: hue(start + spread * 2), chroma: band(0.7, 1.15) },
  }
}

/** The same CSS, broken over lines for a consumer pasting it into a stylesheet. */
export function formatThemeCss(css: string): string {
  return css
    .replace(/\{/g, " {\n  ")
    .replace(/;/g, ";\n  ")
    .replace(/\}/g, "\n}\n")
    .trim()
}
