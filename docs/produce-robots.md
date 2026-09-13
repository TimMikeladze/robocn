# Produce robots

Three field units that work a crop by living in it: `robot-avocado`, `robot-strawberry`,
`robot-tomato`. Each takes the silhouette of the fruit it tends, because a machine the canopy
does not notice is a machine the canopy does not fight — and each one carries a mechanism the
set did not have.

## Why these three

"It looks different" is not distinctness. Every one of these earns its place on a mechanism:

| Machine | The mechanism nothing else here has |
|---|---|
| `robot-avocado` | A **body of revolution that splits.** Two half shells tilt apart on a rod along the floor under the machine — a bivalve, not a door — and the stone, an optic on a lifting column, rides up out of the gap. `tool-changer` comes apart into two *separate* halves; `custodian-droid` slides armour out on radial rails. Neither cuts one surface in two and keeps both halves on the same machine. |
| `robot-strawberry` | A **golden-angle lattice on a curved surface.** The seed studs are placed by the sunflower spiral over the *cumulative surface area* of the profile, so they are evenly spread on the skin rather than on the parameter, and each one extends along its own surface normal. Nothing in the set populates a surface; everything else places parts by hand or on a ring. |
| `robot-tomato` | A **machine that hangs.** Every other body here stands on the ground, floats on repulsors, or is bolted to a bulkhead. This one is carried by a truss clamp on a two-hinge peduncle and swings under it, and its ripening front is a *latitude cap* on the shell — the skin still to turn, painted in the live colour, bounded by the near half of a real ring. Coverage, not a gradient. |

Shared: all three are solids of revolution with a real profile, modelled once in world units and
pushed through `robotCamera`, so the four views come out of one geometry.

## The solver: `produce-geometry`

`src/lib/robocn/produce.ts`, registry item `produce-geometry`. Pure functions over plain
`{x,y,z}`, no React, no camera — the components own the projection.

| Export | What it gives, and the invariant the tests hold it to |
|---|---|
| `revolveProfile(profile, options)` | The surface as points. Every point's distance from the axis is the profile radius at its ring — lobed or not. |
| `profilePoint` / `latitudeRing` / `meridianLine` | One point, one horizontal ring, one vertical furrow on that same surface. |
| `surfaceNormal(profile, t)` | The outward normal in the meridian plane, which is what a seed stud extends along and what decides whether it faces the camera. |
| `goldenLattice(profile, count)` | Sites by the golden angle, spaced by **equal surface area**: successive azimuths differ by 137.507…°, and the count landing in any latitude band matches that band's share of the lateral area to within one. |
| `halfShell(profile, side, options)` | Half the surface, azimuth 0..180 or 180..360. The two halves reassemble into `revolveProfile` exactly. |
| `hingeRotate(points, hinge, degrees)` | Those points turned about an arbitrary line — a post behind the machine, a rod on the floor under it, a knuckle in a stem. Distance to the line is preserved at every angle, and 0° is the identity. |
| `bladeRing(count, options)` | Hinged blades on a ring: calyx sepals, a landing collar. Blade length is exact at every pitch, and the blades are evenly spaced. |

The lobing is a radius modulation in azimuth (`1 - depth·(1 - cos(lobes·θ))/2`), so a tomato's
furrows are where the surface actually is, not lines drawn on a sphere.

## The shared contract

- One number per machine is the mechanism, and a drag or the arrow keys can take it:
  `open` (avocado), `bloom` (strawberry), `swing` (tomato). `on…Change` throughout.
- `behavior` always includes `static`; `speed`, `phase`, `paused`, `animate` and reduced motion
  behave as everywhere else. Samplers are exported pure functions of the clock:
  `avocadoGoal`, `strawberryGoal`, `tomatoGoal`.
- `view` defaults to `front` on all three — they are drawn straight on — and the silhouette is
  the convex hull of the projected surface, which is exact for the convex ones. The tomato's
  lobed shell is not convex in azimuth; its hull is the outline of the *widest* meridians, which
  is what a lobed fruit's outline actually is, and its furrows are hidden-line culled.
- `size`, `variant`, palette roles, `px()`, finite clamping, `role="img"` / `role="slider"`,
  ground shadow flattened by `camera.flatten`.

### `data-*` hooks — these are API

`data-frame`, `data-view` on all three. Then:

- avocado: `data-half="left" | "right"`, `data-cut`, `data-hinge`, `data-latch="left" | "right"`,
  `data-column`, `data-stone`, `data-optic`, `data-stem`, `data-speckle="<i>"`,
  `data-pedestal`, `data-lamp`.
- strawberry: `data-body`, `data-blade="<i>"`, `data-seed="<i>"`, `data-stem`, `data-foot`,
  `data-lamp`.
- tomato: `data-hanger`, `data-stem="upper" | "lower"`, `data-body`, `data-lobe="<i>"`,
  `data-front`, `data-sepal="<i>"`, `data-port`, `data-lamp`.

## What is solved and what is illustrated

Solved: the profiles and their surfaces, the golden-angle lattice over cumulative area, the
surface normals the studs ride, the half-shell split and its hinge, the shell wall that makes an
open half a bowl, the blade ring's length at every pitch, the two-hinge peduncle, the ripening
latitude and its near arc, the projection, and the hidden-line pass on furrows, studs, cut faces
and blades.

Illustrated: the stone's polish highlight, the avocado's skin speckle, the pit each strawberry
stud sits in, and the tomato's inspection port and clamp. There is no crop model, no agronomy, no ripeness sensing,
no fruit mechanics — the ripening front moves because `ripeness` said so, and the tomato's swing
is a pendulum-shaped number, not a solved pendulum with a mass and a length. Each docs page says
so in its `notes`.

## Originality

Generic cultivars and generic field hardware. No grower, variety, brand, or packing-label
artwork anywhere — in the components, the demo labels or the docs.

## Integration

`registry.json` (four items: three `registry:ui`, one `registry:lib`), `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (+ the `demos` map), `src/components/site/catalogue.tsx`,
`README.md`, and the two allow-list arrays — `produceCollection` in
`scripts/__tests__/registry.test.ts` and `produceSlugs` in
`src/components/site/__tests__/docs-catalogue.test.tsx`.
