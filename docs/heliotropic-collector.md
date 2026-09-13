# The heliotropic collector

One machine, `robot-sunflower`, and one solver under it, `phyllotaxis-geometry`. It is a
solar collector shaped like the flower that solved the same problem first: pack the most
cells onto a disc, and keep the disc pointed at the light.

## Why it earns a place

The set already has a golden-angle lattice — `produce-geometry` spreads strawberry seed studs
over the *cumulative surface area* of a solid of revolution. This is the other half of that
idea and a different mechanism:

| The mechanism nothing else here has | Where it shows |
|---|---|
| **Emergent structure that is drawn, not decided.** The florets are placed by one rule (angle `n·137.507°`, radius `√n`) and the *spiral arms* are then found in the result rather than authored. `parastichyOffsets` reports the index steps whose neighbours are closest, and those steps come out consecutive Fibonacci numbers — 13 and 21, 21 and 34 — because the angle says so. The component draws those arms. Nothing else in the set draws a consequence it did not place. |
| **A two-axis aim solved from a direction.** `bearing` and `elevation` are not two free angles: the light is a direction, `aimFrom` turns it into the pair, `trackerFrame` turns the pair back into the head's own axes, and everything on the head is placed in that frame. The round trip is exact, which is why the disc, the rays and the leaf wings all agree about where the sun is. |
| **A joint whose angle is a remainder.** The stem leans toward the light on its own (heliotropism), and the gimbal collar at the top takes up *exactly what the stem did not*. The collar angle is `aim − stem tip tangent`, a number the solver produces. Lean the stem further and the collar unwinds to match; the head's normal never moves off the sun. |

## The solver: `phyllotaxis-geometry`

`src/lib/robocn/phyllotaxis.ts`. Pure functions over plain `{x,y}` / `{x,y,z}`, no React, no
camera. The component owns the projection and the paint.

| Export | What it gives, and the invariant the tests hold it to |
|---|---|
| `vogelDisc(count, options)` | The lattice. Successive azimuths differ by exactly the golden angle; radius goes as `√n`, so **every annulus of equal area holds the same number of sites** — the test compares the count inside half the radius against a quarter of the total, to within one. |
| `parastichyOffsets(sites, families)` | The index steps that are nearest neighbours, smallest first. For any count from 80 to 600 they are **two consecutive Fibonacci numbers**. This is the test that says the lattice is real. |
| `spiralArm(sites, start, step)` | The chain of sites stepping by one of those offsets — one drawn spiral arm. Its own length is monotone in radius. |
| `discDish(site, options)` | The shallow paraboloid the florets sit on: the offset along the face normal and the local normal there. The normal is unit, agrees with the numeric derivative of the offset, and is exactly the face normal at the centre. |
| `aimFrom(direction)` / `aimDirection(aim)` | Direction ↔ `{azimuth, elevation}`. Round trips to the normalised direction for any non-degenerate input; a zero vector gives the neutral aim rather than `NaN`. |
| `trackerFrame(aim)` | The head's own axes in the world: `right`, `up`, `forward`. Orthonormal, right-handed (`right × forward = up`), and `forward` is `aimDirection(aim)`. |
| `framePoint(frame, origin, local)` | A point written in the head's frame, placed in the world. The identity frame is the identity map, and distances are preserved. |
| `rayFlorets(count, options)` | The petals: hinged on the rim of the disc, in the disc's own frame. Rigid — length is exact at every pitch — and evenly spaced. |

World axes are the set's: **x** starboard, **y** up, **z** toward the tail, the machine facing
`−z`. Azimuth 0 therefore faces the `front` camera, and elevation 90 is straight up.

## The machine

Drawn in `front`, modelled once in world units, pushed through `robotCamera` for the other
three. Standing on a three-foot anchor plate.

- **Stem.** `solveSpine` from `spine-kinematics`, run vertically: the stem's contour length is
  fixed, `turn` is the heliotropic lean, and a small `amplitude` is the sway in the air. Every
  link is exactly the same length at every lean, which is what the solver is for.
- **Leaf wings.** Two collector panels on stem collars, pitched by the same aim. They are
  hinged, not drawn — the panel's outline is its four corners in the world.
- **Head.** The disc, on the gimbal. Rim ring, ray florets round it, the Vogel lattice inside,
  the parastichy arms over the lattice, a hub boss and an optic at the centre.
- **Florets.** Each cell is canted along its own dish normal and drawn only while it faces the
  camera, so the far side of a dished head really does go dark as it turns away.

### One number is the machine

`daylight`, 0 at dawn to 1 at dusk, runs a day arc: azimuth swings east to west, elevation
rises to noon and falls. Everything else follows it — the stem lean, the collar, the leaf
pitch, and `bloom`, which opens the rays with the light unless it is supplied. Drag across the
machine to scrub the day; arrows step it; `onDaylightChange` fires throughout.

`sun` overrides the arc with an explicit `{azimuth, elevation}`, and `track` hands the light to
the pointer, which is the gesture a person actually tries on a flower.

### `data-*` hooks — these are API

`data-frame`, `data-view`, `data-anchor`, `data-stem`, `data-node="<i>"`, `data-leaf="left"`,
`data-leaf="right"`, `data-collar`, `data-head`, `data-rim`, `data-disc`, `data-floret="<i>"`,
`data-arm="<i>"`, `data-ray="<i>"`, `data-hub`, `data-lamp`.

## What is solved and what is illustrated

**Solved:** the lattice and its spacing, the parastichy offsets, the dish surface and its
normals, the aim and its frame, the stem (link lengths exact at every lean), the collar
remainder, the leaf panels' corners, the ray florets' length at every pitch, the projection,
and the facing cull on florets, rays and leaves.

**Illustrated:** the hub speckle, the anchor feet, and the incidence rays the blueprint variant
draws. There is no photometry, no sun ephemeris, no plant model: `daylight` is a shaped number,
not a solar position for a date and a latitude, and the disc collects nothing. The docs `notes`
say so.

## Originality

A generic field machine and a generic flower. No cultivar, grower, brand or product artwork
anywhere — component, demo labels or docs.

## Integration

`registry.json` (one `registry:ui`, one `registry:lib`), `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (+ the `demos` map), `src/components/site/catalogue.tsx`,
`README.md`, `scripts/lib/gallery.mjs` (`exercises`), the two allow-list arrays, and
`src/components/ui/__tests__/views.test.tsx`.
