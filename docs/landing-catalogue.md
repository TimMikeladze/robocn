# The landing catalogue

The grid under "Every machine" on `/` shows **one card per registry item — all of
them**, grouped the way the docs index groups them. It used to be a hand-picked
35 out of 53, which meant every new component silently failed to appear on the
page that is supposed to be the showroom.

## Why all of them

The landing page is the only page a visitor is guaranteed to see. A curated
subset is a judgement about which machines matter, and that judgement went stale
the moment someone shipped a component without editing an unrelated file. Showing
everything removes the judgement and the maintenance at once: the page is now a
function of the registry, and a test fails if it stops being one.

Foundations — the solvers, the style layer and the hooks — are in the grid too.
They install like any other item, so leaving them out made a third of the
registry invisible from the front page.

## Where each piece of copy comes from

| piece | owner | why |
| --- | --- | --- |
| title, group, order | `src/lib/docs.ts` | one source of truth; a renamed component cannot drift out of sync with its card |
| card line | `src/components/site/catalogue.tsx` | card copy is tighter than a docs summary — one clause, not two sentences |
| the art | `src/components/site/catalogue.tsx` | hand-posed per machine, **as an override**; an item nobody posed falls back to its own component with nothing set but a size |

`page.tsx` is a server component: it filters `docs` to entries with an `item` and
passes only `{ slug, title, group, summary }` to the client `Catalogue`. The
props tables and source-file lists in `docs.ts` never cross the boundary — the
same rule `DocsCatalogue` already follows. `summary` is there so an item with no
hand-written card line still has one.

`docs` itself is now the written pages joined onto `registry.json`, so an item
that ships without a page still appears here. See `docs/gallery-coverage.md`.

## Art for things that are not a machine

A Foundations item is a `.ts` file. Its card shows **the machine that exercises
it, drawn in `blueprint`** — the same aliasing `demos.tsx` already does when it
points `spine-kinematics` at the snake demo. Blueprint is the right register: the
landing page itself says a drawing is what you want when you are explaining a
mechanism rather than selling one, and that is exactly the difference between
`robot-snake` and `spine-kinematics`.

The three hooks get the machine whose behaviour they are: `use-pointer-target`
gets the face whose eyes follow you, `use-robot-motion` gets the loader's cycle,
`use-robot-arm` gets the arm with its envelope drawn.

## The two WebGL cards

`robot-arm-3d` and `robot-stage` need a canvas. Both cards go through
`CatalogueStage`, which:

- loads `three` through `next/dynamic({ ssr: false })`, so the landing page still
  ships without it — the hero already owns that import and the chunk is shared;
- mounts only once the card is within 300px of the viewport
  (`useNearViewport`, `once: true`), so scrolling to the Arms group is what
  starts the context, not loading the page — and the card around it unmounts the
  whole thing a viewport later, which is what releases the context;
- renders `frameloop="demand"` under `prefers-reduced-motion` and never
  auto-rotates there.

Before it mounts, the card holds a same-size placeholder, so the grid does not
reflow when the canvas arrives.

## Only the cards you can see are running

Every card is a live machine with its own `requestAnimationFrame` loop, so a grid
that mounts all of them is a hundred-odd loops a frame to draw six cards' worth
of viewport. The **card shell always renders** — the link, the title, the card
line, and an art well of fixed height — and the machine inside the well mounts
when the card comes within 600px of the viewport and unmounts when it leaves.
Nothing reflows, every card is still a link in the DOM, and the server HTML for
the grid drops from about 1.1MB to 85KB.

`src/components/site/use-near-viewport.ts` is the mechanism, shared with
`CatalogueStage`: one `IntersectionObserver` for every card that asks for the
same margin. Reasoning, options and the trade-offs: `docs/catalogue-virtualization.md`.

## Every card moves

The art in this file passes **configuration** — size, variant, view, series,
tool, shape — and never a controlled value. `behavior="static"`, a pinned
`angle`, a pinned `progress` or a pinned gait `phase` all stop the machine, and
a page that says every machine runs its own cycle cannot be a wall of stills.

`catalogue-motion.test.tsx` drives real animation frames at every card and fails
the ones that draw the same picture three seconds later. That is the only check
that catches a pinned prop, because in the source a pinned value is
indistinguishable from configuration.

## The tests that keep it honest

`src/components/site/__tests__/catalogue.test.tsx` asserts:

- every `registry.json` item resolves to a card — posed here, or fallen back to
  its own component;
- every item is in the grid the page actually renders;
- every item resolves to a demo;
- every card's slug is a real registry item (no cards for things you cannot
  install);
- every card title equals the `docs.ts` title for that slug.

A component added to the registry now appears on its own. The suite fails if
that stops being true, or if a card stops moving.
