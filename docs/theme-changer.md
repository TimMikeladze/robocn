# The global theme changer

A site-wide themer in the header: pick a palette, a corner radius and a light/dark
mode, and the whole site — chrome *and* every robot on the page — repaints. State
persists across reloads and applies before first paint.

This is not decoration. The claim on the front page is "theme it with CSS
variables"; a themer that retints 90 machines at once is the demonstration.

## What a preset actually is

Not a hand-written block of 24 colours. A preset is **three hues and three chroma
multipliers**:

| role | drives |
| --- | --- |
| `base` | the neutral ground: background, panel, card, border, muted, foreground |
| `signal` | the chrome accent: ring, `--signal`, and the robots' status colour (`--robot-accent`, `--robot-glow`) |
| `shell` | the machines' body: `--shell`, `--shell-hot` (the header mark) and `--robot-shell` |

Every token in `src/lib/site-theme.ts` is `{ name, l, c, role, h }` — a fixed
lightness, a chroma, the role it takes its hue from, and a **hue offset** from that
role. The offsets are the ones already baked into `globals.css` (background sits at
240 while foreground sits at 250, and so on), so the `steel` preset reproduces the
existing theme byte for byte. A preset then only says "base is at 264 now", and the
whole ladder rotates together, keeping the relationships that made it look right.

`mono` is chroma `0` on all three roles: the same ladder, greyscale — including the
robots, which is a genuinely good blueprint look rather than a broken one.

## Tuning a role by hand

A preset is a starting point, not the end of it. `ThemeChoice` carries an optional
`tune` — a per-role `{ hue, chroma }` that replaces the preset's numbers for that
role only:

```ts
themeCss(themeData, "steel", 0.625, { shell: { hue: 300, chroma: 0.5 } })
```

Tuning is stored per role rather than as a full copy of the preset, so an untuned
role keeps following the palette you pick. Picking a palette clears the tune
outright — otherwise the swatch you clicked is not the theme you get.

The panel drives it three ways per role:

| control | what it writes |
| --- | --- |
| colour picker | `tuneFromHex` — the picked colour's oklch hue, and its chroma as a multiplier of the role's reference chroma (`base` 0.09, `signal` 0.13, `shell` 0.17) |
| hue dial | `hue`, 0–360°, on a track painted with the wheel at that role's lightness |
| chroma dial | `chroma`, 0–3, where `0` is greyscale and `1` is the preset's own weight |
| random | three hues spread 60–180° apart, chroma in a sane band |

Only hue and chroma are adjustable: **lightness stays pinned to the ladder**, which
is what keeps every generated theme readable. A colour picker that let you set
lightness would let you set `--background` to the same L as `--foreground`.

`hexToOklch` / `oklchToHex` do the sRGB↔OKLab conversion, because a native colour
input speaks hex and the ladder speaks oklch. The hex handed back to the input is
gamut-clipped, so a wide-gamut role shows its nearest sRGB neighbour in the swatch
while the CSS keeps the real value.

## Why CSS text and not inline styles

The applier writes one `<style id="robocn-theme">` holding two blocks:

```css
:root:root:not(.dark) { … }
:root:root.dark        { … }
```

Both modes ship at once, so toggling light/dark is still a class flip on `<html>`
with no JavaScript in the path and no flash. Setting the vars with
`style.setProperty` instead would pin one mode and force a re-apply — and a
visible repaint — on every toggle.

`:root:root` doubles specificity so the block beats `globals.css` (and beats Next's
dev-time style injection, which can land after ours in the head). The two selectors
are mutually exclusive and equally specific, so light never leaks into dark.

`globals.css` keeps the full default theme. It is the no-JS fallback and the
`steel` preset at the same time.

## No flash

`themeBootScript()` renders a synchronous inline script at the top of `<body>`: it
reads `localStorage`, builds the CSS and appends the style element to `<head>`
before the body is parsed.

The script does not re-implement the generator. `themeCss` is a self-contained
function — no free identifiers, everything arrives as arguments — and the script is
literally `(${bootTheme})(${themeCss}, ${JSON.stringify(themeData)})`. One
implementation, and the tests cover the one that ships. The payload is the compact
ladder (~2 KB), not 8 presets of expanded CSS.

## Controls

| control | what it writes |
| --- | --- |
| palette | `robocn-theme` → `{ preset }` in `localStorage`, and clears `tune` |
| colour | `robocn-theme` → `{ tune }`, per role: picker, hue dial, chroma dial |
| random | `{ tune }` for all three roles at once |
| radius | `robocn-theme` → `{ radius }`, emitted as `--radius`; four chips plus a 0–2 rem dial |
| mode | `next-themes`, untouched — the themer just drives `setTheme` |
| copy CSS | the generated block — tune included — for pasting into a consumer's `globals.css` |

Mode lives in the panel *and* stays as the standalone header toggle: one click for
the thing people do constantly, the panel for the rest. Both read the same
`next-themes` store, so they cannot disagree.

## Files

```
src/lib/site-theme.ts                      ladder, presets, themeCss, bootTheme
src/components/site/theme-script.tsx       the pre-paint script tag
src/components/site/theme-customizer.tsx   the header popover
src/components/ui/popover.tsx              base-ui popover, shadcn shape
src/components/ui/slider.tsx               the dials; takes --slider-track / --slider-indicator
```
