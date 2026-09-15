# The about page

`/about` is the page that answers "what is this and why should I believe it",
which nothing else on the site was doing. The landing page sells, the docs index
lists, a component page documents one machine. None of them says what the project
is *for*, and a registry whose whole claim is "these are solved, not drawn" has to
make that claim somewhere a reader can check it.

## What it says, and why in that order

1. **Machines, not pictures of machines.** The headline is the thesis. Everything
   below it is evidence for that one sentence.
2. **Why it exists.** shadcn/ui covers forms and layout; nothing covered machines.
   The alternative a reader has actually used is a GIF, a Lottie file or a
   hand-keyframed SVG — fixed at one size, one palette, one pose. Naming the
   alternative is what makes the pitch land.
3. **What is actually solved.** Four claims — IK, one solver behind both
   renderers, the mechanisms underneath, and the logo. This is the section the
   page exists for.
4. **What is in it.** Counted from `docs`, not typed out, so it cannot go stale
   against the registry.
5. **How you control one.** Theming, `variant`, size, `interactive`, reduced
   motion. The answer to "can I make it fit my app".
6. **How it is built.** The app is the registry; the Markdown mirrors are for the
   agents who are a large share of the readers.
7. **Install one**, with a live arm under it. The page ends with the thing it has
   spent six sections earning.
8. **Who.**

## Rules for editing it

**Every claim on this page has to be true of the code.** "A gearbox turns at its
real ratio", "a fan brake retards as k·ω²", "the mark is a three-link chain solved
by the same hook" — those are checkable statements about
`src/lib/robocn/transmission.ts`, `gym.ts` and `logo.tsx`. If one stops being
true, the sentence goes, not the qualifier. A page whose job is to be believed
cannot carry a hedge.

**The counts come from the registry.** `installable.length` and the per-group
figures are derived. Do not replace them with a number.

## Where it is linked

The footer, the `⌘K` palette's Pages group, `sitemap.ts`, `llms.txt` and the
README's header row. Deliberately *not* the header nav: that bar already carries
Components, Workbench and Install plus the search field, and it runs out of room
below `sm` — see the breakpoint note in `docs/site-polish.md`. About is a page
people read once, not a destination they navigate back to.
