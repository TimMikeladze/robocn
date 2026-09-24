# The puzzle cube — one solver, two renderers

`rubiks-cube` is the cube as a game in WebGL: orbit it, grab a layer, watch a real solve play.
But WebGL is a dependency — `three`, a canvas, a GPU — and plenty of places a cube wants to be
won't run one. `puzzle-cube` is the same permutation state machine drawn as **SVG**: installs as
source, themes through CSS variables, projects through the same `robotCamera` every flat machine
in the set uses, and animates without a canvas.

| Item | Type | What it is |
|---|---|---|
| `cube-geometry` | lib | An N×N×N twisty cube as cubies on an integer lattice, each carrying an integer orientation matrix. Moves, algebra, scramble, drag geometry, sticker lookup, and a layer-by-layer solver. |
| `rubiks-cube` | ui | The cube as a WebGL game: grab a face and the layer turns with your hand, type moves, scramble, hint, solve, undo. |
| `puzzle-cube` | ui | The same cube as a flat drawing: orthographic projection, painter's algorithm, flat shading — same state, same turns, same solve. |

No maths is duplicated. Both components import `cube-geometry` for the state, the turns, the
drag geometry and the sticker lookup; each owns only its own projection and paint.

## Projection

The cube is modelled once in world units (edge 100, centred on the origin) and projected
through `robotCamera(view)`, so all four views come out of one model. The native view is `iso`
— three faces at once, which is what a puzzle cube has to show to read as one. `fitTransform`
frames the envelope; nothing is redrawn per view.

Visibility is two passes, both exact for this machine:

- **Back-face culling by signed area.** A cubie face whose projected quad winds backwards is
  facing away. For a convex solid under a linear camera the surviving faces never overlap each
  other on screen.
- **Painter's algorithm over cubie groups**, sorted by the projected depth of each cubie's
  centre. Cubies are convex and never interpenetrate — including mid-turn, when the turning
  slice is rotated by a floating-point angle before projection — so the sort is exact, not an
  approximation that usually works.

A turn in flight rotates the slice's positions **and** orientations by the same partial
rotation, which is what makes a turning layer read as one rigid body rather than nine
sliding tiles. When the turn lands, the exact integer `applyTurn` replaces the float — the
floating point never enters the state.

## Light

There is no ray tracer and no shadow map: **flat shading**. One key light sits in world space,
and every face's paint is its resolved colour scaled by `0.62 + 0.38·max(0, n·L)`. That is the
whole lighting model, and the docs say so. Sticker colours resolve prop →
`--robot-cube-<face>` → the standard scheme, the same three steps as the WebGL sibling, and
the plastic body comes from `resolveRobotPalette()` so the cube sits in a themed page.

## Motion

The same behaviours as the sibling — `cycle`, `scramble`, `solve`, `static` — each an exported
pure function of the clock, so motion is tested by sampling rather than by faking frames.
`solve` is driven by the solver, not the clock: it scrambles itself, solves itself with the
real method, and starts again. Turns are queued and travel with an ease that reads as a wrist;
`animate={false}`, `paused` or reduced motion parks the loops and lands queued turns
instantly — input still works.

## Drag that follows the hand

The press lands on a sticker, and the sticker polygon is its own hit target — no ray casting,
the browser does the picking. The first few pixels decide the layer, and because the camera is
**linear**, the two in-plane world tangents of the grabbed face project to a 2×2 basis:
solving that basis for the screen drag gives an exact world direction, which goes to
`grabFromDrag` unchanged — the same function the WebGL rig feeds. The layer then winds with
the pointer (half the cube's edge per quarter turn), and the release snaps to the quarter turn
it is nearest: letting go half way back snaps back rather than through. The turn enters the
state only when the settle lands.

## Keyboard and the driver

The typewriter from the sibling: `U D L R F B` (+ shift for anticlockwise), `S` scramble,
`H` hint, `Enter` solve, backspace undo, escape reset, `⌘Z`/`⌘⇧Z` undo/redo. The `controls`
prop hands over the same driver the sibling has — `turn`, `scramble`, `reset`, `undo`, `redo`,
`solve`, `hint`, `state`, `history`, `solved` — and `algorithm` makes the component controlled:
exactly that line applied to a solved cube. Every turn carries where it came from, so a
stopwatch can time a person without timing the idle loop.

## Variants and views

Paint only, never geometry. `solid` is shaded fills with dark strokes; `outline` is line art;
`wire` drops to grid strokes with the live slice picked out in accent; `blueprint` washes the
fills and adds the annotation layer — order, move count, the three world axes. All four views
come free from the projection.

## What is solved and what is illustrated

Solved: the state, every turn, the scramble, the drag geometry, the sticker colours, `isSolved`
and the solve — all in `cube-geometry`. Illustrated: the eased travel of a turn, the flat
shading, the gap between stickers, the underglow when it comes home.

## Hooks

`data-cube` on the drawing (`data-view`, `data-order`, `data-solved`, `data-turning`,
`data-dragging`, `data-moves`), `data-cubie` per cubie group and `data-sticker` with
`data-face` per sticker — enough for a test or a readout to follow the state without reaching
into the paint.
