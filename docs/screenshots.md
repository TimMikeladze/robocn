# Screenshots

`docs/screenshots/*.png` are what the README shows. Like [the social card](og-image.md),
they are **captures of the real app**, not mockups — the same reasoning applies, and the
same browser driver takes them.

```bash
pnpm shots                    # every shot, light and dark, into docs/screenshots/
pnpm shots --only landing     # one shot
pnpm shots --theme light      # one register
pnpm shots --url http://localhost:3001
```

## The shots

| name | route | what it has to show |
| --- | --- | --- |
| `landing` | `/` | the hero: pitch, install line, the three-link arm tracking, the fact strip |
| `catalogue` | `/` | the grid of every registry item, live — the thing that makes the size of the set legible |
| `docs` | `/docs/robot-arm` | one component page: the demo, its controls, the install line, the props table |
| `builder` | `/builder` | the editor: source on the left, sandboxed preview on the right |

Each is captured twice, `-light` and `-dark`, and the README pairs them in a `<picture>`
so GitHub serves whichever matches the reader's theme.

## How

`scripts/lib/capture.mjs` is the browser driver — launch headless Chrome, drive one page
over the DevTools protocol, capture at 2x, downsample with `sips`. `build-og.mjs` and
`build-shots.mjs` are both thin scripts over it. The reasons for driving DevTools rather
than `chrome --screenshot`, and for the 2x-then-downsample, are in
[the social card](og-image.md); they did not change.

Two things are specific to these shots:

- **A shot may name a `selector`.** The script scrolls it into view, waits, and clips to
  its box plus a margin. That is how `catalogue` gets the grid without the hero above it.
  A missing selector is a hard failure, not a silent full-page capture — a shot that
  quietly starts showing the wrong thing is worse than one that fails.
- **The theme is forced, not inherited.** `?theme=light|dark` on the route, the same
  escape hatch `/og` uses, so the capture does not come out in whatever register the
  machine running Chrome happens to be in.

macOS + Google Chrome only. A maintainer command; not part of `pnpm build`. Re-run it when
the pages it photographs change, and commit the PNGs — they are build artifacts in git for
the same reason `og.png` is.
