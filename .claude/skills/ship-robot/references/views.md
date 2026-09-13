# Angles, views and 3D

**Every machine with a body in space ships a `view` prop.** Not an extra, not a later pass:
part of the contract, the same way `size` and `variant` are. When someone asks for "different
profiles" they mean camera angles, and the answer is never four sets of hand-drawn artwork —
those drift apart the first time the machine changes. Model the geometry once in world units
and project it. Design note: `docs/drone-views.md`.

**The exception**, stated in the design note when it applies: things that are not objects in
space. A polar sensor display, a loading indicator, a teach pendant, a face drawn as a face —
these have one correct viewpoint and take no `view`. If you can walk round it, it takes a
`view`.

**The default is the view it was designed in** — `plan` for flat and top-down machines (drone,
rover, gantry, rotary table), `front` for standing ones (droids, humanoids, quadrupeds),
`profile` for machines whose mechanism only reads from the side (actuator, conveyor). Picking
the native view as the default means adding the axis to an existing machine changes nothing
for anyone already using it.

## The camera

`robotCamera(view)` in `src/lib/robocn/style.ts` — shared visual language, not drone-specific.

```ts
type RobotView = "plan" | "front" | "profile" | "iso"
```

| view | azimuth | elevation | reads as |
|---|---|---|---|
| `plan` | 0° | 90° | straight down, nose up — the identity projection |
| `front` | 180° | 10° | nose-on elevation, discs nearly edge-on |
| `profile` | 90° | 10° | side elevation from starboard, nose right |
| `iso` | 145° | 26° | three-quarter from above |

World axes are right-handed: **x** starboard, **y** up, **z** toward the tail, nose at `-z`.
That lands nose-up in plan, which is how the flat machines were already drawn — so adding
`view` to an existing plan-view machine changes nothing at `view="plan"`.

```ts
const camera = robotCamera(view)
camera.project(x, y, z)   // → screen Vec2, in drawing units
camera.depth(x, y, z)     // → toward the camera; bigger draws later
camera.plane(y, spin)     // → SVG transform for plan-view artwork sitting at height y
camera.lift               // → screen rise per world unit of height; 0 looking straight down
camera.flatten            // → how much a horizontal disc keeps of its depth; 1 in plan
```

### Planar artwork is free

Guards, propellers, deck detail, a rotary table's platter — anything drawn flat in the
horizontal plane — projects through an exact 2×2 matrix. Wrap the existing plan-view artwork
in `camera.plane(height, heading)` and a guard ring foreshortens into an ellipse and a
propeller into a sliver with no extra drawing. In plan the matrix is the identity, so the
tuned top-down drawing comes out byte-identical.

### Solids are extruded footprints

A world height offset projects to a pure *vertical* screen offset, so the silhouette of an
extrusion is the convex hull of its footprint drawn twice, `lift × height` apart:

```ts
const footprint = roundedFootprint(16, 25, 12, 9)          // halfWidth, halfLength, radius, steps
const fuselage = extrudedPath(footprint, camera, DECK, BELLY, headingAngle)
```

One path per solid, so it paints correctly under every variant including the washed blueprint
fill. `extrudedPath` collapses back to the footprint itself in plan view.

### Draw order

Split parts by `camera.depth` against the deck: the far ones paint before the body, the near
ones after. In plan everything lands behind the deck, reproducing the original order.

```tsx
const deckDepth = camera.depth(0, DECK, 0)
const far = rotors.filter(r => r.depth <= deckDepth)
const near = rotors.filter(r => r.depth > deckDepth)
```

### What the view has to change

- `aria-label` names the view (`viewNames[view] ?? viewNames.plan`).
- `data-view={view}` on the drawing group, so tests can assert per-view geometry.
- The ground: a flat plan cross-hair versus a horizon line at `90 - GROUND * camera.lift`.
- The contact shadow flattens by `camera.flatten` and slides out from under the machine as
  it rises.
- Anything already keyed to height (a hover bob) becomes visible in the tipped views — check
  it does not now float.

Add the view axis to the demo's `Segmented` controls and to the docs props row when you add
it; the demo is where a reviewer flips through all four.

## Adding the axis to a machine that has only one view

The existing drawing is already one of the four — that is the default, and it must come out
byte-identical. Then, in order:

1. Decide the world axes: **x** starboard, **y** up, **z** toward the tail. Re-read the
   existing drawing as a projection of that, rather than as 2D artwork.
2. Wrap flat artwork in `camera.plane(height, spin)`. In the native view the matrix is the
   identity, so nothing moves.
3. Replace parts that have real height with `extrudedPath(footprint, camera, top, bottom, spin)`.
   They are invisible in the native view and appear as the camera tips.
4. Split the draw order by `camera.depth`.
5. Add anything that only exists off-axis — skids, motor cans, a solid fuselage, the side of a
   chassis — which is usually where the work actually is.
6. Label, `data-view`, ground line, shadow flatten (below), demo control, docs props row,
   registry description, and a test per view.

Test it by asserting the native view is unchanged and that a tipped view moves the geometry:
render at `plan`, capture a `data-*` path or transform, rerender at `iso`, assert it differs —
and assert the accessible label names the view.

## Rotation versus view

`heading` / `spin` / `bodyAngle` rotate the machine in its own world (pass it as the `spin`
argument to `plane()` and `extrudedPath()`). `view` moves the camera. Keep them independent —
a rover facing 30° looks right from all four cameras.

## The 3D path

`robot-arm-3d` + `robot-stage` are the react-three-fiber pair. Rules:

- The rig is procedural and calls the *same* `kinematics.ts` the SVG components call. No
  duplicated maths, no model files.
- Colour comes through `robot-color` (`src/lib/robocn/color.ts`), which turns CSS variables
  and `oklch()` into something three.js can parse — three cannot read a CSS variable.
- `robot-stage` owns the canvas, lights, contact shadow, floor and orbit controls; the rig
  owns no scene assumptions, so it can be dropped into a consumer's existing canvas.
- Anything importing `three` or `@react-three/*` declares it in the registry entry's npm
  `dependencies`, and stays out of the 2D components' dependency graph.
