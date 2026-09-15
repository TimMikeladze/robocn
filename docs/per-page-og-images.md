# A social card per page

`public/og.png` is the card for the site. Every docs page now has one of its own
under `public/og/<slug>.png`, so pasting `/docs/micro-duck` into Slack shows
**the duck** rather than the twelve-machine contact sheet again.

This is the same machinery as [the social card](og-image.md), pointed at 170-odd
routes instead of one. Read that first: it is where the reasoning for capturing
a real browser rather than composing with `ImageResponse` lives, and none of it
changes here.

## The pieces

| piece | where |
| --- | --- |
| the composition | `src/components/site/og-item-card.tsx` |
| the copy on each card | `src/lib/og-pages.ts` |
| the route it renders on | `src/app/og/[slug]/page.tsx` (`noindex`) |
| the list the capture reads | `src/app/og/pages/route.ts` → `GET /og/pages` |
| the capture | `scripts/build-og.mjs` → `pnpm og`, over `scripts/lib/capture.mjs` |
| what was captured | `src/lib/og.generated.ts` |
| the tags that point at it | `ogImage()` in `src/lib/og.ts` |

## The composition

The site card's layout, with the contact sheet replaced by one machine:

- **Title block, left, 430 px.** The mark and the wordmark along the top, then a
  centred stack: the docs group in mono under a teal rule, the page's title at
  poster size, the one-clause line the landing catalogue prints under its card,
  and the install line for that item in a hairline box. The host sits alone at
  the foot. The same datum ticks at all four corners as the site card.
- **Stage, right, 770 px.** The machine, fitted to a 660 × 500 box, with its
  registry item name in 10 px mono at the bottom left — the tile label off the
  contact sheet, kept so a card is recognisably from the same set.

A page that installs nothing — `installation`, `/workbench` — gets the tagline in
place of the install box, and the arm the whole set is built around, drawn as a
drawing, in place of a machine of its own.

### Where the art comes from

`cardArt()` in `catalogue.tsx` — the landing catalogue's own art map, which is
already the best-posed drawing of each machine in the repo, and already falls
back to the machine's own defaults for anything nobody hand-posed. The card
imports that rather than keeping a second list, so a re-posed catalogue card
re-poses the social card with it and the two cannot drift. It takes the card's
one-clause `line` from the same call, for the same reason.

### Fitting it

The catalogue's poses are drawn for a 168 px card well and the stage is 660 ×
500, so `FitArt` measures the drawing after mount and scales it up.

It fits and centres on `getBBox()` — the ink — rather than on the element's box.
Most machines sit off-centre inside their own viewBox, because a reach envelope,
a ground shadow or a readout reserves room on one side that nothing is drawn in;
fitting the box puts the duck down and to the right of the middle of the card,
and fitting the ink puts it in the middle. `MAX_SCALE` caps the blow-up at 4.6 —
not for quality, since the SVG stays crisp however far it goes, but because past
that a machine with three moving parts starts to read as a diagram of one part.

The two WebGL cards skip all of this: they are a `<canvas>` sized by its
container rather than a drawing with a box of its own, so they are handed the
stage directly.

### Pinning the pose

The site card pins every tile by hand (`behavior="static"`, an explicit
`phase`). That does not scale to 170 of them, and the catalogue art map is
explicitly forbidden from pinning — `catalogue-motion.test.tsx` fails any card
that draws the same picture twice.

So the capture pins them instead: `pnpm og` emulates
`prefers-reduced-motion: reduce`, and every machine in the set parks at its
`phase` under it — that is what `useRobotClock`, `useRobotScalar` and
`useRobotArm` all do with the preference, and the only other thing the
preference touches is the handful of CSS keyframe classes in `globals.css`,
which it stops. Two captures of the same commit are the same file, and no source
file has to be posed twice.

## Which pages

Every entry in `docs` — which is every registry item plus the written pages —
and `/workbench`, which is not a docs page:

| page | card |
| --- | --- |
| `/` | `public/og.png` — the contact sheet |
| `/docs` | `public/og.png` — see below |
| `/workbench` | `public/og/workbench.png` |
| `/docs/<slug>` | `public/og/<slug>.png` |

`/` and `/docs` share the contact sheet on purpose. It is a picture of twelve
machines, and those two pages *are* the catalogue — a card of one machine would
be a worse picture of either than the sheet already is.

`workbench` is not a registry item name, and `og.test.ts` fails if it ever becomes
one: `/og/workbench` and a docs page called `workbench` would write the same PNG.
The same test pins `pages`, which `/og/pages` needs as a static segment.

## The manifest

`ogImage()` reads `src/lib/og.generated.ts` — the cards that have actually been
captured — rather than assuming one exists for every page. A component that
ships between two capture runs has a page before it has a card, and an
`og:image` pointing at a 404 is worse than one pointing at the contact sheet, so
an unknown slug falls back to the site card.

Every run writes the manifest, including a one-card `--only`, because it is
**merged** rather than replaced: the union of what it already claims and what
the run took, minus any slug whose PNG is no longer on disk. That is what makes
`pnpm og --only <new-machine>` a complete step — the card registers itself the
moment it is taken, instead of waiting for someone to re-photograph the other
two hundred pages. Replacing would shrink the list to the one slug; not writing
it at all, which is what this used to do, shipped machines whose own page linked
with the contact sheet. The merge and the parse live in
`scripts/lib/og-manifest.mjs`, away from the browser, and
`scripts/__tests__/og-manifest.test.ts` pins both.

## Size

170 PNGs is a lot of committed bytes, so each card is quantised to a 256-colour
palette with `sharp` after the downsample. The art is flat vector fills on two
or three theme colours, so the palette is lossless in practice and takes a card
from ~90 KB to ~30 KB. `public/og.png` is left alone: it is the one anybody
looks at closely.

## Regenerating

```bash
pnpm og                          # the site card and every page card
pnpm og --only site              # just public/og.png
pnpm og --only micro-duck,orrery # those page cards
pnpm og --pages                  # every page card, no site card
```

**A new machine takes its own card, in the same sitting as the machine.**
`pnpm og --only <name>` is about five seconds against a `pnpm dev` that is
already up — the script reuses that server rather than booting one — and the
PNG and the manifest line are committed with the component. The robot skills
say so as a step rather than as an optional extra, because a machine that ships
without a card is invisible in every link preview of its own page. Re-take it
when the drawing moves, for the same reason: the card is a photograph of it.

Same constraints as before: macOS + Chrome, and not part of `pnpm build` — a
card is a screenshot of a real page, so the app has to compile before one can be
taken, and a red dev server shows up as `GET /og/pages — 500`. A full run is
200-odd captures and takes about a quarter of an hour, so it is for a change to
the composition or to a shared helper, never for one machine.

WebGL is on for this run — `robot-arm-3d` and `robot-stage` are canvas cards and
photograph as empty panels without a software rasteriser. That is the same flag
`pnpm shots` already uses, and the reason the site card on its own never did.

Preview without capturing: `pnpm dev`, then `/og/micro-duck`. `?theme=dark`
renders the same card in the dark register.
