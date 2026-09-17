# Hero: the 2D → 3D transition

The fact strip claims "2D + 3D — same kinematics". The hero should show it
rather than assert it: one arm, one pointer target, two renderers, and a
transition that makes the swap legible instead of a hard cut.

## Shape

`Hero` (`src/components/site/hero.tsx`) owns four quadrants — `docs/hero-quadrants.md` —
and the wipe lives in the arm's. That quadrant is a fixed-height stage with two stacked
layers:

| layer | component | mounted |
| --- | --- | --- |
| flat | `RobotArm` (SVG) | always |
| solid | `HeroStage` → `RobotStage` + `RobotArm3D` | lazily, on the first 3D request; kept after |

A `dimension` state (`"2d" | "3d"`) is the intent; a rAF-driven `t` (0 = flat,
1 = solid) is the animation. `t` is written to the stage element as the CSS
custom property `--edge` (a percentage), so the layers animate without React
re-rendering at frame rate.

## The effect: a wipe with a scan line

A straight crossfade of an SVG against a WebGL canvas reads as a glitch. Instead
a horizontal line sweeps the panel:

- above the line the 3D rig is visible, below it the SVG drawing is,
- both masks carry an 8% soft band so the two overlap at the seam,
- an accent-coloured 1px line with a glow rides the seam, fading out at `t` 0 and 1,
- the SVG lifts slightly (`scale` + `blur`) as it goes, so the drawing looks like
  it is being replaced from underneath rather than dimming.

`t` is the 3D-ness, so the reverse transition is the same code running backwards:
the line rises and the drawing refills behind it.

Two extra beats sell the dimensional change:

1. **Camera dolly.** The 3D camera starts dead-on and near-orthographic (fov 20,
   straight down −z), which is the closest a perspective camera gets to the flat
   drawing, and lerps to the 3/4 hero view (fov 40) as the wipe runs. That is
   what turns "two pictures" into "one machine rotating into depth".
2. **Wireframe first.** The rig renders `wireframe` until `t > 0.55`, so the
   drawing becomes a wire cage and only then gains surfaces.

## One pointer, two solvers

The stage element carries the pointer listener. The SVG keeps its own
`behavior="pointer"` mapping; the same normalised position is mapped into
3D world units and handed to `RobotArm3D` as a controlled `target` via a ref,
so no pointer move re-renders React. The canvas is `pointer-events: none`
throughout, which is what lets both layers track the pointer at the same time,
including mid-wipe. The arm therefore never jumps at the swap: it is the same
target solved twice.

Two things had to be fixed for this to work at all:

- the WebGL canvas sets its own `pointer-events`, so it has to be cleared on the
  canvas itself (`[&_canvas]:pointer-events-none`) or the drawing underneath
  never sees a pointer move again once the rig is mounted;
- `resolveCssColor` only understood `oklch()`. Chrome now serialises a computed
  `var()` colour as `lab()`, which three.js cannot parse — every 3D component was
  quietly keeping its built-in fallback instead of the theme's colour, and the
  stage floor came out white. It now normalises through a 1px canvas.

## Cost

- `three` and the stage are behind `next/dynamic({ ssr: false })`, so the flat
  hero ships without them. The chunk is prefetched on first pointer intent.
- While the hero is flat the canvas stays mounted but switches to
  `frameloop="demand"`, so a hidden WebGL context costs nothing per frame.
- `prefers-reduced-motion`: `t` snaps, the scan line is not drawn.

## Pure helpers

`src/lib/transition.ts` holds the maths (easing, seam position, the two mask
gradients, camera lerp) so it is unit-testable without a canvas:
`src/lib/__tests__/transition.test.ts`.
