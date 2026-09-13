# The battle station

Two machines and one new solver: `hull-geometry`, `battle-station`, `debris-field`. The set
already draws bodies that machinery is pointed at (`docs/celestial-bodies.md`). This is the
one body that *is* machinery — an armoured sphere somebody built — and the mechanism nothing
else here has is that **it comes apart, and the pieces are the pieces it was made of**.

## Why these two

| Machine | The mechanism nothing else here has |
|---|---|
| `battle-station` | **A body that comes apart and goes back together exactly.** The hull is a real tiling: equal-area latitude courses, each cut into plates whose areas sum to exactly one sphere. `breakup` does not fade a picture into another picture — it launches every one of those plates down its own straight trajectory, from a rupture the caller places, behind a fracture front that reaches the far side last. At `breakup = 0` every plate is back at the position the tiling gave it, to the last bit, so the intact hull is not a second drawing. Nothing else in the set is a solid that dismantles into its own parts; `tool-changer` is the closest and it is two halves on one axis. |
| `debris-field` | **A depth-sorted population.** Every other item here is one object, or a handful of parts on one body. This is `count` fragments, each on its own trajectory with its own tumble at its own release time, drawn back to front by `camera.depth` so a near fragment genuinely occludes a far one. The orrery carries bodies on arms and never has to decide which is in front; this one does, every frame. |

`battle-station` also carries the axis that makes the same tiling read the other way round:
`plating` is how much of the hull is on, so the courses fill in from the equator and the
meridional ribs and the two girdle rings show through the gap. Under construction and coming
apart are one ordering run in two directions, which is why it is an axis and not a third item.

## The solver: `hull-geometry`

`src/lib/robocn/hull.ts`. Pure functions over plain numbers and `{x,y,z}`. No React, no
camera, no dependency but `clamp` from the kinematics core. Latitude and longitude are
degrees; directions are unit vectors in the body's own frame, with the pole on `y`, so a
component hands them to `surfacePoint`/`bodyFrame` from `celestial-geometry` and the plating
turns with the body for free.

| Export | What it gives, and the invariant the tests hold it to |
|---|---|
| `hullPlates(courses, options?)` | The tiling. Courses are cut by **equal area** — `sin(latitude)` stepped uniformly — so each course is exactly `1/courses` of the sphere, and each is divided into equal longitudes. The plate areas therefore sum to exactly 1, at every course count and every plate count, which is the test: a tiling with a gap or an overlap is not a hull. Plates per course track `cos(latitude)` so a polar plate is not a sliver. |
| `plateOutline(plate, steps?)` | That plate's boundary as latitude/longitude pairs: along the south parallel, up the east meridian, back along the north, down the west. Closed, and every point inside the plate's own bounds. |
| `plateNormal(plate)` | The unit direction of the plate's centre — where it sits on the intact hull. |
| `burst(plate, progress, options?)` | The breakup. `progress` 0 to 1 drives a **fracture front** sweeping out from `origin`: a plate's `release` is 0 until the front reaches it and 1 by the end, so the far side lets go last. Released, the plate travels in a straight line from where it sat. Three invariants: `progress = 0` returns every plate to `plateNormal` exactly; `\|offset\|` is monotone non-decreasing in `progress`, so **no plate ever moves inward**; and the travel is bounded by `spread`. |
| `shockRing(centre, axis, radius, steps?)` | A real circle of that radius in the plane through `centre` normal to `axis` — every point at `radius` from the centre and square to the axis. Projected, it is the ellipse; nothing draws one. |
| `dish(radius, depth)` | A paraboloid from its rim and its depth, carrying the focal length `r²/(4d)`. |
| `dishProfile` / `dishNormal` | A point on that bowl and its outward normal, in the bowl's own axial plane. The invariant is the one that makes a dish a dish: a ray coming in parallel to the axis, reflected about the normal at **any** point on the surface, passes through the focus. The emitters converge because the surface is a paraboloid, not because they were drawn converging. |

## Shared contract

- `size`, `variant`, the four palette roles, `px()` on every coordinate, finite-clamped inputs,
  `role="img"` / `role="slider"`, `label`.
- `view`: both carry it. A bare sphere looks the same from every camera — the **plating, the
  girdle, the dish, the rupture axis, the shock ring's plane and the fragment depth order do
  not**, so all of it turns with the camera. Native view `front` for both.
- One number per machine is the mechanism and a drag or the arrow keys can take it:
  `breakup` (station), `spread` (debris). `on…Change` throughout.
- The station's second axis, `charge`, is controlled the same way but is not the slider —
  the precedent is `sentinel-console`, whose `voice` and `look` sit beside its `aperture`.
- `behavior` always includes `static`; `speed`, `phase`, `paused`, `animate` and reduced
  motion behave as everywhere else. Samplers are exported pure functions of the clock:
  `stationGoal`, `stationCharge`, `debrisGoal`.
- Light: both take a `sun` bearing and shade through `illumination` from `celestial-geometry`,
  so a station reads as a body in the same space the planets and moons are in.

### `data-*` hooks — these are API

`data-frame` and `data-view` on both. Then:

- station: `data-hull`, `data-plate="<i>"`, `data-course="<i>"`, `data-rib="<i>"`,
  `data-girdle="north"|"south"`, `data-trench`, `data-dish`, `data-emitter="<i>"`,
  `data-focus`, `data-beam`, `data-shock`, `data-terminator`, `data-rupture`.
- debris: `data-fragment="<i>"`, `data-shock`, `data-rupture`, `data-core`.

## What is solved and what is illustrated

**Solved:** the tiling and its areas, every plate boundary, the fracture front and the release
order it produces, the straight-line trajectories, the monotone outward travel, each
fragment's own tumble frame, the shock ring as a real circle in a stated plane, the paraboloid
and its focus, the convergence of the emitter rays on that focus, the day–night line, the
per-plate illumination, the depth sort, and the projection of all of it.

**Illustrated:** the trench and hatch detail, the plate bevels, the beam's glow and taper, the
shock ring's expansion rate and fade, the rib profile, and the fragment edge shading. There is
no structural model, no mass, no energy, no fragment-to-fragment collision and no gravity —
plates pass through each other's paths because nothing is stopping them, and the docs say so.
`breakup` is a number you can run backwards, which is the honest framing: it is a
demonstration of a tiling coming apart, not a simulation of anything failing.

## Originality

Generic archetypes, named for the job: an **armoured orbital battle station** and the
**debris field** left behind. Nothing here names or reproduces a franchise, a character, a
craft, a paint scheme or a crest — in the components, the demo labels, the docs or the palette
defaults. The dish's latitude and longitude are props with an ordinary default rather than a
fixed signature position, the plating is a generic course pattern, and the label rows read as
hull and station numbers.

## Integration

`registry.json` (two `registry:ui`, one `registry:lib`), `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (+ the `demos` map), `src/components/site/catalogue.tsx`,
`README.md`, `scripts/lib/gallery.mjs` (`exercises`), the allow-list arrays in
`scripts/__tests__/registry.test.ts` and
`src/components/site/__tests__/docs-catalogue.test.tsx`, and
`src/components/ui/__tests__/views.test.tsx`.
