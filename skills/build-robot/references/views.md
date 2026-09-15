# Angles, views and 3D

**Every machine with a body in space ships a `view` prop.** Not an extra, not a later pass:
part of the contract, the way `size` and `variant` are. When someone asks for "different
profiles" they mean camera angles, and the answer is never four sets of hand-drawn artwork —
those drift apart the first time the machine changes. Model the geometry once and project it.

**The exception**, stated in the design note when it applies: things that are not objects in
space. A polar sensor display, a loading indicator, a teach pendant, a face drawn as a face.
If you can walk round it, it takes a `view`.

**The default is the view it was designed in** — `plan` for flat and top-down machines,
`front` for standing ones, `profile` for machines whose mechanism only reads from the side.
Picking the native view as the default means adding the axis to an existing machine changes
nothing for anyone already using it.

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

---

## Start here: `elevationDraft`

Most machines are drawn in an elevation — a rig, a tower, a walking beam, a droid standing up.
For those, **do not touch `camera.project` at all**. `elevationDraft(camera, plane)` is the
drafting board: you write the whole machine once, in the elevation's own flat coordinates
(x along the drawing, y up from the ground), say how deep each part is, and every camera comes
out correct.

```tsx
const camera = robotCamera(view)
const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
const { point, path, solid, box, bar, disc } = elevationDraft(camera, "profile")
```

`plane` is `"profile"` or `"front"` — **the plane the drawing lives in, not the camera**. A
machine authored side-on uses `"profile"`; one authored nose-on uses `"front"`. An `iso`-native
machine is still authored in one of the two, and the camera does the rest.

| Helper | Gives you |
|---|---|
| `point(p, depth?)` | the screen position of one drawing point |
| `path(points, depth?, close?)` | a polyline at one depth — flat detail, a seam, a cable run |
| `solid(outline, halfDepth, offset?)` | the silhouette of an outline swept ±`halfDepth` out of the plane |
| `box(x0, y0, x1, y1, halfDepth, offset?)` | the same for an axis-aligned rectangle |
| `bar(a, b, halfWidth, halfDepth, offset?)` | a member between two points — every strut, beam and limb |
| `disc(centre, r, halfDepth, offset?, steps?)` | a disc standing in the plane: a wheel, a sheave, a drum, a crank web |

`offset` shifts a part out of the plane without changing its drawing coordinates — that is how
you get the port and starboard halves of a derrick from one expression:

```tsx
{[-26, 26].map((offset) => (
  <path key={offset} d={bar({ x: -34, y: 6 }, { x: -13, y: 190 }, 2.2, 2.6, offset)} {...machined} />
))}
```

What this buys: a walking beam seen from above is that beam foreshortened by its own tilt,
because it is the same solid. Flat detail drawn with `path` foreshortens and finally collapses
to a line when seen edge-on — which is what a line drawn on a face does. Nothing is
special-cased per view.

`fitTransform(ENVELOPE, camera, w, h)` centres and scales the projected machine inside the
viewBox, so a camera that makes the machine wider does not push it off the edge. Build
`ENVELOPE` once with `boxCorners(min, max)` in world units.

Worked examples, shortest first: `flare-stack.tsx`, `wellhead-tree.tsx`, `mud-pump.tsx`,
`drilling-derrick.tsx`.

---

## Plan-view machines: `camera.plane` and `extrudedPath`

A rover, a drone, a spider, a rotary table is drawn looking down. Its artwork lives in the
*horizontal* plane, so it goes through a different pair of helpers.

### Planar artwork is free

```ts
camera.plane(height, spin)   // SVG transform for plan artwork sitting at world height `height`
```

Wrap existing plan-view artwork in it and a guard ring foreshortens into an ellipse, a
propeller into a sliver, with no extra drawing. In plan the matrix is the identity, so the
tuned top-down drawing comes out byte-identical.

### Solids are extruded footprints

A world height offset projects to a pure *vertical* screen offset, so the silhouette of an
extrusion is the convex hull of its footprint drawn twice, `lift × height` apart:

```ts
const footprint = roundedFootprint(16, 25, 12, 9)   // halfWidth, halfLength, radius, steps
const fuselage = extrudedPath(footprint, camera, DECK, BELLY, headingAngle)
```

One path per solid, so it paints correctly under every variant including the washed blueprint
fill. `extrudedPath` collapses back to the footprint itself in plan view.

### Draw order

Split parts by `camera.depth` against the deck: far ones paint before the body, near ones
after. In plan everything lands behind the deck, reproducing the original order.

```tsx
const deckDepth = camera.depth(0, DECK, 0)
const far = rotors.filter((r) => r.depth <= deckDepth)
const near = rotors.filter((r) => r.depth > deckDepth)
```

The rest of the camera: `camera.project(x, y, z)`, `camera.depth(x, y, z)`, `camera.lift`
(screen rise per world unit of height; 0 looking straight down), `camera.flatten` (how much a
horizontal disc keeps of its depth; 1 in plan), `camera.wall(offset, spin)` for artwork drawn
in a vertical plane at an arbitrary angle.

---

## What the view has to change, either way

- `aria-label` names the view (`viewNames[view] ?? viewNames.<native>`).
- `data-view={view}` on the drawing group, so tests can assert per-view geometry.
- The ground: a flat plan cross-hair versus a horizon line, and the contact shadow flattens by
  `camera.flatten` and slides out from under a machine that rises.
- Anything already keyed to height — a hover bob — becomes visible in the tipped views. Check
  it does not now float.

`pnpm robot:new` writes the fixture into `views.test.tsx` for you. That fixture asserts three
things: the native view is byte-identical to the default, every view sets `data-view` and names
itself in the label and contains no `NaN`, and a tipped view differs from the native one. The
file snapshots are written on the first run — read the tipped one once and check it is a
machine rather than a line.

## Rotation versus view

`heading` / `spin` / `bodyAngle` rotate the machine in its own world (pass it as the `spin`
argument to `plane()` and `extrudedPath()`, or as `offset`/geometry to the draft helpers).
`view` moves the camera. Keep them independent — a rover facing 30° looks right from all four
cameras.

## Adding the axis to a machine that has only one

The existing drawing is already one of the four — that is the default, and it must come out
byte-identical. Then, in order: decide the world axes; re-read the existing drawing as a
projection rather than as 2D artwork; move flat artwork onto `path`/`plane`; move parts with
real height onto `solid`/`bar`/`disc`/`extrudedPath`; split the draw order by depth; then add
what only exists off-axis — skids, motor cans, the side of a chassis — which is usually where
the work actually is.

## The 3D path

`robot-arm-3d` + `robot-stage` are the react-three-fiber pair.

- The rig is procedural and calls the *same* `kinematics.ts` the SVG components call. No
  duplicated maths, no model files.
- Colour goes through `robot-color` (`src/lib/robocn/color.ts`) — three.js cannot read a CSS
  variable, and Chrome serialises a computed `var()` colour as `lab()`.
- `robot-stage` owns the canvas, lights, contact shadow, floor and orbit controls; the rig owns
  no scene assumptions, so it drops into a consumer's existing canvas.
- Anything importing `three` or `@react-three/*` declares it in the registry entry's npm
  `dependencies`, and stays out of the 2D components' dependency graph.
