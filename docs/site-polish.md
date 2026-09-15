# What pdfcn does that robocn did not

`pdfcn.dev` is another shadcn registry site, and a notably finished one. This is
what a read of its markup, its head and its text endpoints turned up, which of
it is worth having here, and what was built as a result.

The study: headless Chrome over `scripts/lib/capture.mjs` against the landing
page, `/docs`, `/docs/components`, the settings popover and the search dialog,
plus `curl` against `/llms.txt` and the `.md` mirrors.

## What they have

| | pdfcn | robocn before |
| --- | --- | --- |
| head | manifest, `theme-color` that flips with the theme, `apple-touch-icon`, `icon.svg`, canonical, author link, keywords, full OG + Twitter | OG and Twitter only |
| crawlers | `robots.txt`, sitemap | neither |
| agents | `llms.txt`, a `.md` mirror of every page, an `Accept: text/markdown` path, a page-level *Copy Page* menu, an `sr-only` note in the DOM saying so | nothing |
| app bar | search with a `⌘K` hint, GitHub star count, settings popover holding theme and preferences with single-key shortcuts | five icon buttons, no search |
| docs page | *On This Page* rail, page actions, prev/next pager at the foot | title, body, nothing around it |
| landing | announcement badge above the headline pointing at the newest thing | — |

## What we took, and why

**The agent surface first.** robocn's audience is disproportionately coding
agents — the whole product is "install this source into your project". A site
that can only be read as hydrated HTML makes that agent do the worst possible
version of the job. So: `llms.txt` as the index, a Markdown mirror of every
docs page, and an `Accept: text/markdown` path to the same thing. This is the
one place where pdfcn's polish is not decoration.

**Metadata, because it is nearly free.** `sitemap.ts`, `robots.ts`,
`manifest.ts`, an SVG icon, an apple touch icon, and a `theme-color` per scheme.
207 registry items were not in any sitemap.

**Search, because 208 items is past the point where browsing works.** The
catalogue filter on `/docs` is good, but it is only reachable *from* `/docs`. A
`⌘K` palette makes every component one keystroke away from every page.

**The docs furniture**: a TOC rail, a page-actions menu, a prev/next pager. A
robocn doc page has a fixed section list — Install, Notes, Usage, Props, API,
Source — so the TOC is derived from what the page actually rendered rather than
from parsing headings back out of the DOM.

## What we did not take

- **A settings popover for sound and haptics.** robocn has neither.
- **Their lockup** (labs mark / product switcher / breadcrumb slash). robocn's
  mark is a live machine and the lockup is written up in `docs/header-lockup.md`;
  swapping it for a breadcrumb would be a downgrade, not polish.
- **Sponsor and Discord links.** Nothing to point them at.

## The build

### Markdown mirrors

`src/lib/markdown.ts` turns a `DocEntry` into the page as Markdown: title,
summary, install command, notes, usage, props and API tables, and the list of
source files with their registry URL. It is the same data the HTML page renders,
so the two cannot drift.

Routing is the interesting part. `/docs/[slug]/page.tsx` already owns
`/docs/robot-arm`, and a route handler cannot sit at `/docs/robot-arm.md`
without colliding with it. So `src/proxy.ts` (Next 16's renamed middleware —
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`) rewrites:

- `/docs/robot-arm.md` → `/api/md/docs/robot-arm`
- `/docs.md` → `/api/md/docs`
- any docs URL sent with `Accept: text/markdown` → the same handler

`/api/md/[[...path]]/route.ts` serves it as `text/markdown`. Every mirrored page
carries the same one-paragraph note pdfcn uses, telling a reader where the index
is and how to ask for Markdown, so an agent that lands on one page finds the
rest.

`llms.txt` is the index: the site blurb, then every docs page grouped the way
the site groups them, each with its `.md` link and its one-line summary, then
the registry endpoints.

### Discovery

`sitemap.ts` emits `/`, `/docs`, `/workbench` and all 207 item pages.
`robots.ts` allows everything and points at the sitemap. `manifest.ts` is the
installable-app manifest. `icon.svg` is the mark in its parked pose — hand-drawn
rather than rendered from `<Logo />`, because the component solves its chain at
runtime and a favicon cannot. `apple-icon.png` is that SVG rasterised by
`scripts/build-icons.mjs`.

`themeColor` moved to the `viewport` export years ago; ours carries a light and
a dark entry so the browser chrome matches the palette in use.

### The command palette

`src/components/site/command-menu.tsx`. `⌘K`, `Ctrl-K` or `/` anywhere on the
site; typing filters every docs entry plus the four top-level destinations;
`↑`/`↓`/`Enter` move and open. Built on the Base UI dialog we already have
rather than a new dependency.

Entries reach it as props from the server — slug, title, group, summary — which
is the same payload the landing grid already ships, so nothing new is sent that
was not already on the wire for `/`.

### The docs page

- `docs-toc.tsx` — *On This Page*, sticky, on `xl` and up only. Scroll-spy by
  `IntersectionObserver`, marking the heading nearest the top of the viewport.
  It fits *inside* the site rail rather than widening it: the three columns are
  a 13rem nav, an 11rem TOC and whatever is left. At the rail's `max-w-7xl` that
  is ~776px of content; past `2xl`, where the rail opens to 92rem, ~960px. Prose
  on the page carries its own measure (`max-w-[78ch]` on the notes, `64ch` on the
  summary) so the wide case widens the demo bench and the code blocks, not the
  line length. An earlier pass widened the docs shell alone to `xl:max-w-7xl` and
  left the header at `max-w-6xl`, which put the wordmark 60-odd pixels right of
  the page title beneath it — the rail exists so that cannot recur, see
  `src/components/site/rail.ts`.
- `page-actions.tsx` — *Copy page* copies the Markdown mirror to the clipboard;
  the menu beside it offers *View as Markdown*, *Open in ChatGPT* and *Open in
  Claude*, each of which hands the assistant the `.md` URL rather than the HTML
  one.
- `docs-pager.tsx` — prev/next through the flat catalogue order, which is what
  the sidebar is already sorted by.

The section headings on a doc page now carry ids, because the TOC has to link
somewhere.

### The app bar

The search button sits where pdfcn's does — left of the icon cluster, with the
`⌘K` hint inside it — and collapses to an icon under `md`. The GitHub link now
carries the star count, fetched on the server and revalidated hourly; the count
is omitted entirely if the request fails, rather than rendering a zero.

## Verification

`pnpm test`, `pnpm typecheck`, and a Chrome pass over `/`, `/docs`,
`/docs/robot-arm` and the palette in both schemes.
