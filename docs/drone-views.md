# Drone views — drawing one machine from four angles

`RobotDrone` only ever existed in plan view. The request is different viewing angles
("profiles"), so the drone gains a `view` prop: `plan`, `front`, `profile`, `iso`.

## Decision: one geometry, four cameras

The drone is *not* redrawn per view. Its parts are defined once in world units and pushed
through an orthographic camera picked by `view`. That keeps propellers, guards and heading
truthful in every view instead of four sets of hand-faked artwork drifting apart.

World axes, right-handed: **x** starboard, **y** up, **z** toward the tail. Nose is `-z`,
which lands nose-up in plan view — the orientation the component already had.

A camera is an azimuth and an elevation:

| view | azimuth | elevation | reads as |
|---|---|---|---|
| `plan` | 0° | 90° | straight down, nose up (today's drawing) |
| `front` | 180° | 10° | nose-on elevation, discs nearly edge-on |
| `profile` | 90° | 10° | side elevation from starboard, nose right |
| `iso` | 145° | 26° | three-quarter from above |

`robotCamera(view)` lives in `lib/robocn/style.ts` — it is part of the shared visual
language, not drone-specific, so other machines can take views later.

```
project(x, y, z) -> screen point
depth(x, y, z)   -> toward the camera; bigger draws later
plane(y, spin)   -> SVG transform for plan-view artwork sitting at height y
lift             -> screen rise per world unit of height; 0 when looking straight down
```

### Why `plane()` matters

Guards, propellers and the deck detail are all *planar* drawings in the horizontal plane, so
their projection is an exact 2×2 matrix. Feeding the existing plan artwork through
`plane(height, heading)` foreshortens a guard ring into an ellipse and a propeller into a
sliver for free. In plan view the matrix is the identity, so the tuned top-down drawing comes
out byte-identical to before.

### Height units

The camera divides height by `cos(10°)`, the elevation views' elevation, in every view. It is a
change of units for the vertical axis rather than a distortion — uniform across all four cameras
— and it buys the property the rest of the set needs: `lift` is exactly 1 in `front` and
`profile`, so a machine *drawn* in elevation is untouched there, and still exactly 0 in `plan`,
so a machine drawn in plan is untouched there. The drone is drawn in plan, so its default view is
unaffected; its three tipped views stand 1.5% taller than they did. `camera.wall()` is the
elevation counterpart of `plane()` — see `docs/views-backfill.md`.

### Solids

Parts with height (fuselage, camera pod, motor cans) are extruded footprints. Because a world
height offset projects to a pure vertical screen offset, the silhouette of an extrusion is the
convex hull of the footprint drawn twice, `lift × height` apart — `extrudedPath()` in
`style.ts`, over `convexHull2()` in `kinematics.ts`. One path per solid, so it paints correctly
under every variant including the washed blueprint fill.

### Draw order

Rotors are split by `camera.depth` against the deck: the far ones paint before the fuselage,
the near ones after. In plan every rotor is behind the deck, which reproduces today's order.

## Scope of the change

- `lib/robocn/kinematics.ts` — `convexHull2`.
- `lib/robocn/style.ts` — `RobotView`, `robotViews`, `robotCamera`, `extrudedPath`, `roundedFootprint`.
- `components/ui/robot-drone.tsx` — `view` prop; skids, motor cans and a solid fuselage, all of
  which only become visible once the camera is off the vertical.
- docs entry, demo control, registry copy, tests.

Not done in that pass: views for the other machines. They were backfilled afterwards —
`docs/views-backfill.md` covers all thirty, the exemptions, and the two camera additions it
needed.
