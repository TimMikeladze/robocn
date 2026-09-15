# Carved lanterns — a shell whose openings are cut, not drawn

One machine and one solver, on an axis nothing in the set has yet: **material removed from a
curved shell**, and the light that then gets out.

| Item | Type | What it is |
|---|---|---|
| `carve-geometry` | lib | Outlines authored in shell coordinates and wrapped onto a lobed body of revolution, carved along their own perimeter, the plugs they free, the light that escapes through them, and a flame that answers to the draught. |
| `jack-o-lantern` | ui | A carved gourd lantern: a ribbed shell, a scalloped lid on a stem, a face cut a feature at a time, a candle inside, and every part coming off in the reverse of the order it was fitted. |

## What is actually new here

`produce-geometry` already revolves a profile, lobes it, and puts things **on** the skin — a
stud, a blade, a seam. Nothing in the set takes anything **out** of a skin. A carved opening is
a different problem in three ways:

1. **It is authored flat and lives curved.** A face is drawn the way a person would draw it on
   paper — a triangle here, a grin there — and then it has to sit on a shell whose radius
   changes with height and whose lobes pull the surface in and out around the axis. So an
   outline is authored in *shell coordinates* `{u, v}`: `u` degrees of azimuth from the front,
   `v` the station up the profile. `wrapOutline` sends every vertex through the same
   `profilePoint` the shell itself is drawn with, so a cut lands **on** the skin by
   construction — it rides the furrows instead of floating over them.

2. **Carving is progress along a perimeter, not opacity.** A knife goes in at one point and
   travels round the outline. `carveTrace(rim, progress)` returns the part of the closed loop
   that has been cut so far, to the exact point the knife has reached — so a half-carved eye is
   a scored arc with a tool at its end, not a faded triangle. At `progress` 1 the loop closes
   and the plug is free; before that the plug is still shell. `carveStage` schedules the
   features one after another, the way a person cuts them, so one scalar drives the whole job,
   and `carveWindow` says when each one was cut — which is what the piece falling out of it
   afterwards has to know.

3. **The light is paid for by the hole.** `lightThrough` sums the *open* cut area — area
   measured on the wrapped polygon in world units, not in the flat authoring space — and hands
   back the escape fraction and, per cut, a spill along that cut's own surface normal. Reach is
   inverse-square, as in `lantern-geometry`: doubling what gets through buys `√2` the throw.
   A shell with no cuts in it emits nothing, however hard the candle burns.

4. **The projection runs backwards.** Cutting a face somebody drew means putting the pointer
   *back* on the skin it is over, and there is no closed form for that — a lobed body of
   revolution behind an arbitrary projection. `pickShell` is an honest search: a coarse sweep
   of the near face that keeps several *separated* candidates, because the projection folds the
   near face over itself near the limb, then four halving refinements on each. It reports the
   distance it settled at rather than claiming a hit, and it takes a **seed** — where the last
   pick landed — so a drag follows one branch of the surface instead of hopping between two
   that share a pixel. `strokeOutline` then turns the path the knife took into the ribbon it
   cut, offset in a space where a degree of `u` and a station of `v` are the same length, so a
   nib that is round at the equator is still round at the crown.

The flame is the fifth piece and the only dynamics: `flameAt(clock)` is a deterministic
flicker — two incommensurate sines plus a hashed jitter, so it never repeats on a beat — that
**leans with the draught**. Taking the lid off is a draught, so the flame that was standing
straight up under a closed lid bends and guts when the machine comes apart. It is a pure
function of the clock, which is what lets the tests sample it instead of faking frames.

## The shared contract

Shell coordinates, everywhere in `carve-geometry`:

- `u` — degrees of azimuth about the vertical axis, **0 at the front of the machine**, positive
  to starboard. `v` — station on the profile, 0 at the base and 1 at the crown, the same
  parameter `produce-geometry` uses.
- World output is the set's own: `x` starboard, `y` up, `z` aft. The component owns the
  projection and the paint, as always.
- Every outline is a **closed** polygon, given once without repeating the first point.
- A cut knows its `rim` (on the outer skin), its `plug` (the same loop pushed in by the wall
  thickness, which is the piece that falls out), its `centroid`, its outward `normal` and its
  `area`.

The generators are parametric rather than drawn, so a face is a set of numbers:

| Generator | Shape |
|---|---|
| `wedgeCut({ u, v, width, height, tilt, sides })` | An eye or a nose: a triangle, or any regular fan, tilted about its own centre. |
| `toothedMouth({ teeth, width, ... })` | A grin: a band with `teeth` triangular tabs left standing, alternating top and bottom. The tab count is the input, so a four-tooth grin and a nine-tooth grin are the same function. |
| `scallopedRim({ scallops, ... })` | The lid cut: a closed ring at one station with a zig-zag in it, plus one notch at the front cut deeper than any scallop, so the lid keys back into the shell in exactly one orientation. The key has to be more than twice the scallop depth, or a trough is deeper than the key and the lid has more than one seat. |

`facePattern(name, options)` composes those into the four faces the component ships —
`classic`, `grin`, `scowl`, `sly` — in cut order, eyes first and mouth last.

## Turning it round

`view` names the camera a machine is drawn from; the four named views are four sets of angles,
not four drawings. `robotCameraAt` in `robot-style` is `robotCamera` with the angles left open,
so a machine can hand a person the camera itself: `azimuth` swings it round, `elevation` lifts
it over the top or drops it under the floor, and both are offsets from whatever `view` already
said. Because it is still **one** camera, everything follows it for nothing — the silhouette,
the rib culling, the depth sort between lid and shell, which cuts are facing, where a spill
throws. There is no drawing of the back of the shell, because there is no drawing of the front.

That is also what makes free-hand carving work anywhere: turn the shell round, and the pick
lands on the skin that is now facing you.

## Taking it apart

The teardown is `assembly-geometry`, unchanged and unforked: `stem`, `lid`, `candle`, `shell`,
each with the axis it was fitted along and the order it was fitted in. `exploded` runs it
backwards — stem off the lid, lid up off the neck, candle up out of the bowl, shell never — and
at `exploded={0}` every offset is exactly the zero vector.

The **plugs** are not on that schedule, and that is deliberate: a plug is not a fitted part, it
is shell that stops being shell. Each one leaves along its own cut's surface normal, driven by
the carve that freed it, so the eyes push out of the face while the lid is still on. Left
alone it then drops out of the drawing — a finished face is holes, not chips hanging in front
of them — and comes back into the exploded formation once the lid above it is clear.

The frame is fitted to the room the teardown actually needs at this `progress`, not to the room
it would need fully apart: it zooms out as the machine comes apart and at no other time, which
is the difference between a seated lantern filling its drawing and sitting in a third of it.

## What is solved and what is illustrated

Solved: the wrap onto the lobed shell, the carve along the perimeter, the plug offsets, the cut
areas and the escape fraction, the inverse-square spill, the flame, and the teardown schedule.

Illustrated: the glow inside the shell, the bloom around each opening, the candle body, the
gutter of wax, and the **fall** of a freed plug — the push out along the normal is solved, but
nothing here models gravity. There is no combustion model, no radiosity and no collision model
— plugs pass through the paths of other parts exactly as they do in every exploded drawing.

Every opening is painted at the same brightness and differs only in how far it throws, because
what a smaller hole passes less of is flux, not radiance. The light takes the palette's `glow`
and `accent` roles, so a candle-coloured lantern is `glow="oklch(0.85 0.17 75)"` and not a
hardcoded orange.

## The `data-*` hooks

`data-shell`, `data-lid`, `data-stem`, `data-candle`, `data-flame`, `data-cut="<id>"`,
`data-glow="<id>"`, `data-groove="<id>"`, `data-plug="<id>"`, `data-spill="<id>"`, `data-neck`,
`data-frame`, `data-view`, `data-tool`. A cut made by hand carries the id of the stroke that
cut it, so a test can name one.

Everything that is *in* the skin — the opening, its glow, its bloom, the groove the knife is
still cutting — is clipped to the shell's own silhouette, because a hole cannot be drawn
outside the thing it is a hole in. The plugs are not clipped: they have left.
