# Virtualizing the landing catalogue

The grid under "Every machine" on `/` renders **one card per registry item**, and
the count only goes up — it passed 140 while this was being written. Every card
is a live machine: an SVG that runs its own `requestAnimationFrame` loop and
calls `setState` on every frame (`use-robot-motion.ts`). Mounted all at once that
is one animation loop and one React re-render per card per frame, for a section
that shows at most six cards at a time.

## What "virtualization" means here

Not a windowing library. The grid is a responsive `grid-cols-1/2/3` split into
grouped `<section>`s, it is the target of the `#catalogue` anchor and of
`pnpm shots --only catalogue`, and every card is a `<Link>` a crawler should
find. Row-slicing that with `@tanstack/react-virtual` would mean measuring rows
per breakpoint, taking the scroll container away from the document, and dropping
a hundred-odd links out of the DOM to keep one section fast.

So the **card shell stays, the art is what gets virtualized**: the link, the
title and the card line render for every item, always. The machine inside the art
well mounts when the card comes within 600px of the viewport and unmounts when it
leaves again. The well is a fixed `h-44` either way, so nothing reflows and the
scrollbar never moves.

What that buys, measured in Chrome against the dev server: **36 machines mounted
out of 145**, and the number stays there wherever you scroll to, rather than
climbing to every card on the page. In the server HTML the same grid is **85KB
instead of 1.1MB**, measured by rendering it with `renderToStaticMarkup` with
every card mounted and with none.

The difference is not subtle at this size: with every card mounted, the dev-mode
page pins the main thread hard enough that a bare `window.scrollTo` over CDP
times out. With the art virtualized the same page answers scripted scrolls and
fills each row as it arrives.

## The mechanism

`src/components/site/use-near-viewport.ts` — `useNearViewport()` returns a ref
and a boolean. One `IntersectionObserver` is shared by every card that asks for
the same `rootMargin`, because a hundred-odd observers watching one grid is the cost this
is meant to remove. The cache is keyed on the global `IntersectionObserver`
constructor as well as the margin, so a test that stubs the global gets its own.

Options:

| option | default | why |
| --- | --- | --- |
| `rootMargin` | `600px` | roughly one viewport of lead time, so a machine is already moving by the time it is scrolled to |
| `once` | `false` | cards unmount when they leave; `CatalogueStage` passes `true` so a WebGL context is never torn down by its own observer |
| `fallback` | `true` | what "near" means with no `IntersectionObserver` — jsdom. Cards render; `CatalogueStage` passes `false` so a test never starts a WebGL context |

## What the server sends

`useNearViewport` reads "is there an observer?" through `useSyncExternalStore`,
and its **server** snapshot says yes — so the server renders the placeholder, the
hydration render agrees with it, and the document no longer carries every
machine's SVG inlined. The first `EAGER_CARDS` cards are exempt and always
mounted; they are counted down the flattened grid, not per group, because the
first group is Arms and it is three cards long.

The trade is that with JavaScript off the grid is titled frames rather than
drawings. That is the same trade `CatalogueStage` already made for the two
WebGL cards, and the page's own hero — a machine that solves its pose in the
browser — is not a no-JS page either.

## Remounting

A card that scrolls away and comes back is a fresh mount: its clock restarts at
its `phase`. That is invisible for a cycle nobody was watching, and it is why the
margin is a whole viewport — the machine has a scroll's worth of time to be
moving before it is looked at.

## Tests

`catalogue.test.tsx` covers both halves:

- with no `IntersectionObserver` (plain jsdom) every card's art renders, which is
  what keeps the existing coverage, title and "no React warning" assertions
  meaningful;
- with a stubbed observer a card's well is empty until its target intersects, and
  fills when it does.
