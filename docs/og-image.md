# The social card

`public/og.png` — 1200 × 630 — is what Twitter/X, LinkedIn, Slack, Discord, iMessage
and Facebook show when someone pastes a robocn link. It is a **screenshot of a real
page**, not a drawing of one.

This page is about the site's card. Every docs page has one of its own, drawn from
the same parts and captured by the same command — [a social card per
page](per-page-og-images.md).

## Why a screenshot and not `ImageResponse`

Next's `ImageResponse` renders through satori, which supports a subset of CSS and a
smaller subset of SVG: no CSS custom properties, no `<mask>`, no `<filter>`, no
`<clipPath>`, no `oklch()`. Every robocn machine is built out of exactly those
things — the whole palette is `var(--robot-shell)` and friends resolving through
CSS variables. Rendering the card through satori would mean hand-drawing a second,
fake set of robots that drift away from the real ones the first time anyone edits a
component. So the card is produced the other way round: a real route, rendered by a
real browser, captured to a PNG that is committed.

The cost is that the PNG is a build artifact in git and has to be regenerated when
the composition changes. `pnpm og` does that in one command and the file is small
(flat vector art, ~100 KB).

## The pieces

| piece | where |
| --- | --- |
| the composition | `src/components/site/og-card.tsx` |
| the route it renders on | `src/app/og/page.tsx` (`noindex`) |
| the capture | `scripts/build-og.mjs` → `pnpm og`, over `scripts/lib/capture.mjs` |
| the tags that point at it | `openGraph.images` / `twitter` in `src/app/layout.tsx` |
| the page cards beside it | [per-page-og-images.md](per-page-og-images.md) |

## The composition

Modelled on [catsvg.app](https://catsvg.app)'s card — wordmark and one-line pitch on
the left, the product itself repeated on the right — but drawn in robocn's own
register rather than catsvg's rounded pastel one:

- **Title block, left, 440 px.** The site header's mark and wordmark at poster size,
  the tagline, the install line in mono inside a hairline box, and a fact strip along
  the bottom edge. Flush hairlines, no rounding, no shadow — and the card carries
  datum ticks at all four corners, the way a drawing frame does.
- **Contact sheet, right, 760 px.** Twelve machines in a 4 × 3 grid of hairline-
  separated panels — the landing page's catalogue, tightened. Each tile carries its
  registry item name in 10 px mono at the bottom left, which reads as content at full
  size and as texture at feed size.

Everything comes from the theme tokens in `globals.css`. The only saturated colour is
what the machines bring: the orange `--robot-shell`, the teal `--robot-accent`, and
the one dark tile where `lidar-scan` brings its own ground.

The card renders in the **light** register. `/og` puts `light` or `dark` on the
wrapper explicitly rather than letting `next-themes`' `system` decide, because
otherwise the capture comes out in whatever theme the machine running Chrome is
in — which is how the first one came out dark. That is what the `.light` selector
next to each robocn `:root` block in `globals.css` is for.

### Which twelve

Picked for silhouette variety at feed size rather than for importance — a tall
articulated arm, a cone, a radial walker, a wingspan, a barrel, a sphere, two
humanoids, a build cell, a quadruped, a parallel arm and a polar plot.

The `blueprint` variant was on the sheet and came off it: a tile is about 80 px wide
in a feed, and at that size the grid and the dimension lines wash out to an empty
panel. The drawing register needs a page, not a thumbnail.

The two WebGL items are absent for a different reason: a headless screenshot of a
`<canvas>` is a coin flip, and there are already two SVG arms on the sheet.

The poses are copied from the landing catalogue's art map, so a tile looks like the
card the visitor will land on, and every one is pinned — `behavior="static"` or an
explicit `phase` — so two captures of the same commit are the same file.
`og-card.test.tsx` fails if a tile names an item the registry does not have.

## Crop safety

The 1.91 : 1 frame is what every major platform actually requests, and none of them
crop it to a square today. Where a square thumbnail does appear (some iMessage and
WhatsApp previews), the centre 630 × 630 lands on the install box and the first two
columns of machines — a legible card, just not the wordmark. That is the trade the
catsvg layout makes and it is the right one: the wordmark is worth more at feed size
than square-crop insurance is.

## Regenerating

```bash
pnpm og               # this card, and every page card
pnpm og --only site   # this card alone
```

Reuses the `next dev` you already have running — it reads the port out of
`.next/dev/lock`, and Next refuses to start a second server for the same directory
anyway — otherwise boots one on the first free port from 3100. Then it drives Chrome
at a 2× device scale and downsamples 2400 × 1260 to 1200 × 630 with `sips`, so the
hairlines stay crisp. macOS + Chrome only; a maintainer command, not part of
`pnpm build`, because CI has neither.

Chrome's own `--screenshot` flag is not used. It needs `--virtual-time-budget` to
wait for anything, and virtual time never expires against a dev server: the HMR
websocket is a fetch that never settles, so the capture hangs forever. The script
speaks the DevTools protocol instead — navigate, await `document.fonts.ready`, settle,
drop the `<nextjs-portal>` the dev indicator lives in, `Page.captureScreenshot` with
an explicit 1200 × 630 clip.

The capture also emulates `prefers-reduced-motion: reduce`, which parks every machine
in the set at its `phase`. That is what pins the 170 page cards, which cannot be posed
by hand. It barely touches this one — the twelve tiles are pinned already — but it does
stop the CSS keyframe classes in `globals.css` (the blink, the pulse, the scan), so the
card moved by a few hundred bytes the first time it ran under the flag. Strictly an
improvement: those were the last three things on the sheet that were not reproducible.

That driver is `scripts/lib/capture.mjs`, shared with `pnpm shots`, which takes the
README screenshots the same way — see [the screenshots](screenshots.md). `--url` names
an origin (`--url http://localhost:3001`), not the full route.

Preview without capturing: `pnpm dev`, then `/og`. `/og?theme=dark` renders the same
card in the dark register; `pnpm og --theme dark` captures that one instead, if the
dark card is ever preferred as the shipped asset.
