# The oil field

Ten machines and one solver covering the chain a barrel actually travels: a well pumped, a
hole drilled, mud circulated, pressure controlled at the head, product stored, shipped by sea
and by road, gas burned off, crude split into cuts, and the offshore hull that carries the
whole upstream package out to sea.

Design note for `linkage-geometry`, `pumpjack`, `drilling-derrick`, `mud-pump`,
`wellhead-tree`, `storage-tank`, `oil-tanker`, `tanker-truck`, `flare-stack`,
`fractionating-column` and `jackup-rig`.

## Why this is a family and not eleven items

Three things are shared and nothing else in the registry has them.

**One solver, three mechanisms.** `linkage.ts` is the first closed-loop kinematics in the set.
Everything solved so far has been an *open* chain — a shoulder reaching for a target, a spine
integrating a tangent, legs hung off a body. A four-bar is closed: the crank does not choose
where the beam goes, the loop does, and at some geometries the loop cannot be assembled at
all. That is a genuinely different solve and it earns its own file. It drives the pumpjack
(crank-rocker), the mud pump (slider-crank, the degenerate four-bar with one link at
infinity), and the derrick (block and tackle, where the constraint is a constant rope length
rather than a constant link length).

**`accent` is the product.** Across the whole family the accent colour is hydrocarbon: crude
standing in the tank under its floating roof, the cargo band along the tanker's hull, mud in
the pump's fluid end, the live cut leaving the column, flow through the choke, the flare
plume. Reading a card, you can see at a glance how full a thing is. Nothing else in the set
uses accent as a quantity.

**Level is a mechanism.** Four of the ten are driven by *how much liquid is in them* rather
than by an angle: the tank roof floats on it, the tanker's waterline climbs the hull, the
truck's compartments fill, the column's flash zone moves. That is the axis this family adds.

## What ships

| Item | The mechanism | What nothing else in the set does |
|---|---|---|
| `linkage-geometry` | four-bar, slider-crank, block and tackle | the first *closed* loop: link lengths as a constraint, not a chain |
| `pumpjack` | crank → pitman → walking beam, solved | a rocker whose stroke is a consequence of the loop, not a number |
| `drilling-derrick` | drum payout ÷ lines = block travel | mechanical advantage drawn as rope, with the falls really reeved |
| `mud-pump` | three slider-cranks 120° apart | the only multi-cylinder machine; discharge is the sum of three piston velocities |
| `wellhead-tree` | valve stack + variable choke bean | a pressure-control *assembly*, where `solenoid-valve` is one valve |
| `storage-tank` | roof floating on the liquid | a body with no fixed height: the level carries it |
| `oil-tanker` | cargo sets the draft | the only machine where the ground plane cuts the body |
| `tanker-truck` | articulated hitch + compartment fill | two bodies on one kingpin, each compartment its own quantity |
| `flare-stack` | plume length from flow | an emissive process, drawn as one and labelled as one |
| `fractionating-column` | trays and side draws | a count axis that changes the separation, like `resolution` on the fabricator |
| `jackup-rig` | fixed legs, climbing hull | one number is both the air gap above the water and the leg left below it |

## The solver

`src/lib/robocn/linkage.ts`. Pure functions, plain `{x, y}`, no React, no dependencies.

```ts
solveFourBar(crankAngle, { ground, crank, coupler, rocker }, { branch })
  // → { crankPin, couplerPin, crankAngle, couplerAngle, rockerAngle,
  //     transmissionAngle, assembled }
couplerPoint(pose, { along, offset })    // a point rigid to the coupler
solveSliderCrank(crankAngle, { crank, rod, offset })
  // → { pin, slider, rodAngle, stroke, assembled }
tacklePosition(payout, { lines, drumRadius, crownHeight, blockHeight })
  // → { height, travel, advantage }
tackleFalls(crown, block, lines, spacing)   // → the reeved rope, one polyline per fall
```

Invariants, all tested directly:

- **Link lengths are exact at every crank angle.** The four-bar is solved as a circle
  intersection — the coupler pin is where a circle of radius `coupler` about the crank pin
  meets a circle of radius `rocker` about the rocker pivot — so the lengths are the
  construction, not an approximation that drifts.
- **Non-assemblable geometry clamps, never returns `NaN`.** Where the circles do not meet, the
  coupler pin lands on the line between the two centres at the point closest to both, and
  `assembled` is `false`. A caller drawing a linkage that has locked up gets a stretched
  drawing, which is what it is, rather than a dead subtree.
- **The branch is chosen, not discovered.** `branch: "up" | "down"` picks the intersection, the
  same way `bend` picks an elbow, so the machine cannot flip between the two valid solutions
  frame to frame.
- **Slider-crank stroke is analytic**: `2 × crank` at zero offset, and the reported stroke is
  the difference between the solved extremes rather than a constant someone typed.
- **Tackle is a rope-length constraint**: block travel is drum payout divided by the number of
  lines, and `advantage` is the line count. Raising `lines` makes the block slower and the
  falls more numerous in the same drawing.

It does not do dynamics. No mass, torque, inertia, friction, rope stretch, sheave efficiency,
fluid or pressure anywhere in the file, and the components say so.

## The shared contract

Everything the rest of the registry keeps, kept here: `shell`/`metal`/`dark`/`accent` through
`resolveRobotPalette` and `robotSurface`, `size` as scale-only, `variant` as paint-only,
`behavior` + `speed`/`phase`/`paused`/`animate`, `interactive` with pointer and arrow keys,
`px()` on every computed coordinate, a stable `data-*` per mechanism, `role="img"` or
`role="slider"` with a real label.

**Views.** All ten have a body in space and all ten take `view`. They are modelled once in
world units — **x** starboard, **y** up, **z** aft — and projected:

- principal masses are solids, drawn with `extrudedPath` / `frustumPath` / `slabPath`, so they
  are correct from every camera;
- the mechanism is solved in the machine's own working plane and lifted into a box, so the
  pumpjack's beam in plan view is the beam seen from above, foreshortened by its own tilt,
  rather than a second drawing;
- flat horizontal features — a tank roof, a rotary table, a deck, a spudcan — go through
  `camera.plane(height, spin)` and are exact;
- fine elevation detail — gauge faces, ladder rungs, handwheels, seams — goes through
  `camera.wall(offset, spin)` and collapses in plan view, which is what a drawn-on face does
  when you look at it edge-on.

Native views: `profile` for the machines whose mechanism is a side elevation (`pumpjack`,
`mud-pump`, `oil-tanker`, `tanker-truck`), `front` for the standing ones (`drilling-derrick`,
`wellhead-tree`, `storage-tank`, `flare-stack`, `fractionating-column`, `jackup-rig`).

**Ground and water.** `showGround` draws a grade line and a contact shadow on the land
machines, and a waterline with a hull shadow on `oil-tanker` and `jackup-rig`. The waterline
is drawn *through* the body rather than under it, because that is the whole point of the draft
axis.

## The `data-*` hooks

These are API. A test asserts a prop moved one of them.

| Machine | Hooks |
|---|---|
| `pumpjack` | `data-crank` `data-pitman` `data-beam` `data-horsehead` `data-rod` `data-counterweight` |
| `drilling-derrick` | `data-block` `data-hook` `data-drum` `data-falls` `data-string` `data-mast` |
| `mud-pump` | `data-crankshaft` `data-cylinder="0\|1\|2"` `data-piston` `data-rod` `data-discharge` |
| `wellhead-tree` | `data-choke` `data-valve="master\|swab\|wing-left\|wing-right"` `data-flow` `data-gauge` |
| `storage-tank` | `data-roof` `data-liquid` `data-seal` `data-stair` `data-gauge` |
| `oil-tanker` | `data-hull` `data-waterline` `data-cargo` `data-manifold` `data-house` `data-crane` |
| `tanker-truck` | `data-tractor` `data-trailer` `data-hitch` `data-compartment="n"` `data-wheel="n"` |
| `flare-stack` | `data-plume` `data-pilot` `data-tip` `data-boom` `data-knockout` |
| `fractionating-column` | `data-shell` `data-tray="n"` `data-draw="n"` `data-flash` `data-overhead` |
| `jackup-rig` | `data-hull` `data-leg="n"` `data-jack="n"` `data-spudcan="n"` `data-cantilever` |

## Behaviours

Each is a pure function of the clock, exported from its component file, sampled directly by
the tests.

| Machine | Behaviours | What runs |
|---|---|---|
| `pumpjack` | `pump` `slow` `static` | crank angle, one revolution per cycle |
| `drilling-derrick` | `trip` `drill` `static` | block up and down the mast, or a slow feed |
| `mud-pump` | `stroke` `slow` `static` | crankshaft angle |
| `wellhead-tree` | `throttle` `shut-in` `static` | choke opening |
| `storage-tank` | `fill` `draw` `static` | liquid level |
| `oil-tanker` | `laden` `swell` `static` | cargo, or a gentle heave at constant cargo |
| `tanker-truck` | `haul` `discharge` `static` | wheel phase and suspension, or compartments emptying |
| `flare-stack` | `flare` `pilot` `static` | flow to the tip |
| `fractionating-column` | `run` `swing` `static` | heat into the flash zone |
| `jackup-rig` | `jack` `preload` `static` | hull elevation up the legs |

## Honesty

Stated here and repeated in each component's docs `notes`:

- **Solved:** the pumpjack's four-bar and the polished-rod stroke that falls out of it; the
  mud pump's three slider-cranks and the crossheads they drive; the derrick's block travel and
  the reeved falls; the tanker's and the jack-up's waterline against a modelled hull; the tank
  roof's height on the liquid; the truck's hitch articulation; every projection.
- **Illustrated:** the flare plume, the flow arrows, the mud and crude as coloured regions, the
  column's temperature banding and the separation it implies, the derrick's drill string below
  the floor, the seabed under a spudcan.
- **Absent:** there is no fluid, thermal, combustion, pressure, buoyancy, stability, mass or
  torque model anywhere in this family. A tanker's draft is a drawn proportion of a modelled
  hull, not displacement solved against a hull form; a column's cuts are labelled draws, not
  a flash calculation; a flare's plume is a length, not combustion. Nothing here reports a
  physical quantity it did not compute.

## Originality

Generic industrial archetypes. No operator, brand, field, vessel or equipment-maker names, no
liveries, no hull markings beyond a draft scale and a load line, and no logos — in the
components, the demo labels, or the docs. Every machine is named for its job.

## Integration

Per machine: `registry.json`, `src/lib/docs.ts`, a demo plus its entry in the `demos` map, a
catalogue card, a README row, and tests. The family's names also go in `oilFieldCollection`
(`scripts/__tests__/registry.test.ts`) and `oilFieldSlugs`
(`src/components/site/__tests__/docs-catalogue.test.tsx`), which enumerate by hand.
