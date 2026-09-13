# Every component, on the home page, moving

## The problem this fixes

The landing grid, the docs index and the docs pages were all built from three
hand-maintained maps keyed by registry item name: `docs` in `src/lib/docs.ts`,
`art` in `catalogue.tsx`, and `demos` in `demos.tsx`.
`docs/landing-catalogue.md` already argued the grid should be a function of the
registry rather than a curated subset, and a test enforced that. Two things it
did not enforce kept going wrong:

1. **A new component needed three hand-written entries**, and a missing one made
   it invisible. `robot-dog` shipped with a component, a registry entry, a
   design note and a test — and appeared nowhere on the site, because nobody
   added it to `docs.ts`. `use-robot-motion` shipped with no demo, so its page
   held an empty panel. The test caught the omission; it did not fix it.
2. **Most cards did not move.** The landing copy promises "every machine runs
   its own cycle until you supply its value", and then the grid supplied every
   value: `behavior="static"`, a pinned `angle`, a pinned `progress`. 86 of 107
   cards drew the same picture for ever — a showroom of frozen drawings.

## The two rules

**Every registry item resolves to a page, a card and a demo, with no
hand-written entry required.** A written entry is an *override*, not a
prerequisite. Absent one, the item falls back to its own registry copy and its
own component rendered with defaults — which is the animated pose its author
already wrote.

**Nothing in the grid is pinned.** Card art passes configuration — size,
variant, view, series, tool, shape, hand, pole count — and never a controlled
value. Two components had no cycle to run at all, so they got one:
`orb-droid` rolls, rocks or surveys, and `security-droid` patrols, goes alert or
stands idle.

## The three fallbacks

**Pages.** `src/lib/docs.ts` is the written pages **joined onto the registry**:
any item with no authored entry gets one built from its registry `title`,
`description` and `files`, in a group derived from its type and categories.
`docs` is what the landing grid, the docs index, the docs route and the sitemap
all read, so one join covers every list at once.

**Cards and demos.** `scripts/build-gallery.mjs` runs inside `pnpm generate` —
the step that already builds the builder runtime, and which `dev`, `build`,
`test` and `typecheck` all run first — and emits
`src/components/site/gallery.generated.tsx`, mapping every registry item to the
component that draws it:

| item | fallback art |
| --- | --- |
| `registry:ui` | its own component, `size` only, default behaviour |
| `registry:ui` needing WebGL | `CatalogueStage`, which lazy-loads three |
| `registry:ui` that is a control panel | the machine it drives (`arm-controls` → the arm) |
| `registry:lib`, `registry:hook` | the machine that exercises it, in `blueprint` |

The generated file is gitignored and rebuilt by `pnpm generate`, like
`src/lib/builder/generated.json`. The PascalCase of the item name is the export
name — `robot-cat` → `RobotCat` — and the generator **throws** if a component
does not export it, so a renamed export is a build failure rather than a missing
card.

Foundations have no component of their own, so each keeps an explicit
`exercises` alias in `scripts/lib/gallery.mjs` (`spine-kinematics` → the snake).
An item with no alias falls back to an arm in blueprint: generic, but visible
and moving. Invisible is the one outcome that is not allowed.

`catalogue.tsx` reads its art through `cardArt`, and `demos.tsx` its demos
through `demoFor`. Both consult the hand-written map first. `demoFor` caches one
component identity per slug, or React would remount the bench on every render.

## What the tests hold

`src/components/site/__tests__/catalogue-motion.test.tsx`

- **every card actually animates.** Each card is rendered with
  `requestAnimationFrame` and `performance.now` driven forward three seconds,
  sampling the markup every fifth frame, and fails if every sample is identical.
  Sampling rather than comparing the two ends matters: most cycles are a second
  long, so a machine caught at a whole number of periods draws its first frame
  again and would read as frozen.
- This is the only check that catches a pinned value prop, because in the source
  a pinned value looks exactly like configuration.
- The two WebGL cards are exempt and asserted to be exempt — jsdom holds their
  placeholder, so their motion is covered by their own component tests.

`src/components/site/__tests__/catalogue.test.tsx`

- every registry item resolves to a card, is present in the grid the page
  actually renders, and resolves to a demo.

`src/components/site/__tests__/gallery-fallback.test.tsx`

- the generated map covers the registry; a solver draws its machine as a
  drawing; an unposed item gets a card from its own registry copy; an item with
  no written demo still renders a bench; every registry item has a docs entry.

## Adding a component after this

Add the component and its registry entry. It is now on the landing page, in the
docs index, on its own docs page with a working demo, and in the sitemap. Write
the `docs.ts` entry, the card art and the demo when you want better than the
default — and the motion test will tell you if the card you wrote is frozen.
