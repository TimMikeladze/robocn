# Rail machines

Four machines and one solver, on the one constraint nothing else in the set has: **a rail
vehicle does not choose its path — the track chooses it.**

Every other vehicle in robocn is steered. `robot-car` turns two wheels through different
angles because a rack asked it to; `transit-bus` bends at the hitch because the tractor
turned; `cargo-plane` banks because it was told to turn. A train is the inverse. Nothing on
board steers. The track is the input, and the vehicle's pose — the yaw of each bogie, the
sideways throw of the body, the lateral wandering of a wheelset that *nobody commanded* — is
what the geometry answers. That inversion is the family.

It is also why this is not a variation on `vehicle-geometry`. Ackermann asks "given a steer,
where do the wheels point?" Rail asks "given a track, where does the vehicle go?" — and the
answers are overthrow, end throw, Klingel hunting, and a crossing angle. Different questions,
different file.

## What ships

| Item | Archetype | The axis nothing else has |
|---|---|---|
| `rail-geometry` | lib | Bogie placement on a curve, centre and end throw, Klingel hunting, a pantograph solved to a working height, turnout lead geometry and blade throw |
| `rail-locomotive` | electric locomotive and its consist | The whole train is *placed* by the curve: each bogie takes the tangent at its own pivot, the body is the chord between them, and the overthrow and end throw fall out |
| `rail-bogie` | two-axle powered bogie | Hunting — the only self-excited motion in the set. Nobody moves the wheelset; conicity does, at exactly Klingel's wavelength, until the flange stops it |
| `pantograph-collector` | single-arm roof current collector | A closed linkage that trades height for reach, with a control-rod loop that decides the pan's attitude — so the head being level is an *output*, and it stops being level at the ends of the travel |
| `rail-turnout` | trailing-point turnout on a point machine | Route as a state: two blades on one throw bar, one closed and one open by exactly the throw, and detection that is a tolerance rather than a boolean someone set |

Four machines, one of which is the train — `rail-locomotive` with `cars` is a consist, and
the curve runs through all of it.

## The solver — `src/lib/robocn/rail.ts`

Pure functions over plain numbers and `{x, y}`. No React, no dependencies. Exact geometry
everywhere except two clearly labelled illustrative shapes (`trackCurvature`, `wireStagger`).

### Placement on a curve

A bogie pivot sits **on** the track. The body is the straight line between two pivots, so the
body is a chord of the curve, and two real railway numbers fall out of that with no
approximation:

- **centre throw** (overthrow) `R(1 − cos θ)`, where `2θ` is the angle subtended by the pivot
  spacing — how far the middle of the body swings *inside* the curve;
- **end throw** `√(R²cos²θ + L²) − R` for a body end `L` from the body centre — how far the
  corner swings *outside* it.

These are the numbers that size a platform gap and a loading gauge, and they are why a long
vehicle on a tight curve is a clearance problem. `bogieRide(radius, geometry)` returns both,
plus each pivot's position and yaw.

The user-facing input is `curve` — **degrees the track turns through under one bogie-centre
spacing**, clamped to ±10. It is bounded, readable, and directly visible in the drawing, and
`curveRadius(turn, chord)` converts it to a radius. A curve of `0` is straight and returns an
infinite radius with zero throw, rather than a special case in every caller.

### Hunting

A railway wheelset has coned treads rigidly joined by an axle. Displace it sideways and the
rolling radii differ, so it yaws; yaw it and it moves sideways. That is a second-order system
with no damping, and its solution is Klingel's:

```
λ = 2π √(b r₀ / γ)      lateral y(s) = A cos(2πs/λ)      yaw ψ(s) = dy/ds
```

`b` half the contact spacing, `r₀` the rolling radius, `γ` the conicity. `klingelWavelength`
and `huntingPose` are exactly that, with the flange clearance as a hard clamp — a real
wheelset stops at the flange, it does not keep growing. The amplitude is an input because the
kinematic solution does not set one; the docs say so.

Nothing else in robocn oscillates because of its own shape. The bear topples because of a
balance rule, the hopper bounces because of a spring — the wheelset hunts because it is
*coned*, and if you set conicity to zero the motion stops and the wavelength goes to infinity.

### The pantograph

A single-arm pantograph is a closed linkage, and the part worth solving is that the working
height and the reach are not independent: `pantographPose(height, geometry)` solves the lower
and upper arms with the law of cosines, so raising the pan pulls it *back* over the base along
the curve the linkage allows, and past full extension it clamps instead of producing NaN, and
says so in `reachable`.

The head's attitude is a **second** closed loop, solved rather than pinned. A control rod runs
from a point on the lower arm to a lever rigidly attached to the head, so the lever's
direction is the circle intersection that assembles that loop at this height. `designHeight`
says where the levelling was set, and the reported `attitude` is the difference from there —
zero at that height and growing at either end of the travel, which is exactly what a working
range is. Pinning the head flat would have been a lie the drawing could not be checked against;
this one can, and the component's test checks it at both ends.

`wireStagger` is the zig-zag the contact wire is strung with so the carbon strip wears evenly.
It is a stated triangular shape, not a catenary solution, and it is labelled illustrative.

### The turnout

`turnoutGeometry(number, gauge)` — the turnout number `N` is the crossing's rate of
divergence, so the crossing angle is `atan(1/N)`. The diverging route is a simple arc leaving
the straight tangentially at the toe, and the crossing is where the two routes' **inner rails
actually meet**, which happens at `cos α = (R − g)/(R + g)` for a half-gauge `g`. That is what
fixes the radius, and the lead is then `R sin α`.

Gauge is the input rather than the lead because gauge is the real invariant — a railway does
not change it to suit a turnout. Two consequences are then visible in the drawing: the offset
at the crossing comes out as `g(1 + cos α)`, very nearly one gauge whatever the number, and
the lead grows about as `N²`. A 1-in-10 turnout is drawn *longer* than a 1-in-4, which is the
truth about turnouts and the reason the frame is refitted per number rather than the geometry
squashed to fill it.

`bladePose(position, throw, tolerance)` gives the two switch blades, named for the route each
one sets rather than for a side: `normalGap` is zero when the straight route is set,
`reverseGap` when the diverging one is, and the two always sum to the throw because they share
a rod. `route` is `"unset"` whenever neither is inside the detection tolerance — which is what
a point machine actually reports, and why a turnout caught in mid-stroke has no route at all.

## The shared contract

Everything the set already keeps: `shell` / `metal` / `dark` / `accent` from
`resolveRobotPalette` through `robotSurface`; `size` scaling a fixed viewBox; four variants
that change paint only; `view` on all four machines, since every one of them is an object in
space; controlled-prop-wins motion with a `behavior` union including `"static"`; `interactive`
with drag, arrow keys and `on…Change`; `px()` on every computed coordinate; finite-clamped
inputs; `role="img"` / `role="slider"` and a label that names the view.

Native views follow the view each mechanism reads in. `profile` for the locomotive and the
pantograph — a train and a roof collector are both side elevations. `plan` for the bogie,
because hunting is a *lateral* motion and a side elevation hides the whole of it; and `plan`
for the turnout, which is a track drawing and has never been anything else.

| Machine | Controlled axis | `behavior` | Grabbed |
|---|---|---|---|
| `rail-locomotive` | `curve`, degrees of track turn under one bogie spacing, ±10 | `line` wind through curves both ways; `station` run in, stop, dwell, pull away; `depot` still with the pantograph down; `static` | Drag across to bend the track; arrows 1°, shift 3°, Home straight. `onCurveChange` |
| `rail-bogie` | `travel`, distance run in wheel diameters, 0–40 | `hunt` run and let the conicity work; `curve` run into a curve so the wheelsets stand radially; `brake` shoes on and the weave dying away; `static` | Drag across to scrub the run; arrows half a wheel diameter. `onTravelChange`. `conicity` and `amplitude` are geometry, not motion |
| `pantograph-collector` | `height`, 0 stowed to 1 at full working height | `raise` up, run, down; `run` up and holding, breathing against the wire; `stow` down bar the moment it lifts; `static` | Drag up and down the arm; arrows 5%, shift 15%, Home/End stowed or full. `onHeightChange`. `along` walks the wire across the strip |
| `rail-turnout` | `throwPosition`, 0 normal to 1 reverse | `route` set, dwell, throw, dwell; `creep` work the blade around the detection point, where a point machine fights; `static` | Drag across to work the blades; arrows 10%, shift 25%, Home/End normal or reverse. `onThrowChange`, `onRouteChange` |

## `data-*` hooks — these are API

| Machine | Attributes |
|---|---|
| `rail-locomotive` | `data-view`, `data-curve`, `data-centre-throw`, `data-end-throw`, `data-pantograph-height`; `data-vehicle="locomotive\|car-n"`, `data-body`, `data-bogie="<vehicle>-lead\|-trail"` with `data-yaw`, `data-wheel`, `data-motor`, `data-solebar`, `data-glazing`, `data-cab`, `data-lamp`, `data-coupler`, `data-door`, `data-track`, `data-rail`, `data-pantograph` with `data-lower-arm` / `data-upper-arm` / `data-knee` / `data-pan-rod` / `data-pan` (`data-attitude`) / `data-horn`, `data-throw-marks` with `data-throw-centre` and `data-throw-end` |
| `rail-bogie` | `data-view`, `data-travel`, `data-wavelength`, `data-conicity`; `data-wheelset="lead\|trail"` with `data-lateral`, `data-yaw`, `data-flanging`; `data-axle`, `data-wheel`, `data-flange`, `data-axlebox`, `data-primary`, `data-brake` with `data-application`, `data-motor`, `data-motor-terminal`; `data-frame` with `data-yaw` and `data-lateral`, `data-sideframe`, `data-transom`, `data-secondary`, `data-centre-pivot`; `data-track`, `data-rail`, `data-sleeper`, `data-centreline` |
| `pantograph-collector` | `data-view`, `data-height`, `data-working-height`, `data-reachable`; `data-roof`, `data-insulator`, `data-base`, `data-arm` with `data-lower-arm` / `data-upper-arm` / `data-rod` / `data-lever` / `data-joint`, `data-pan` with `data-attitude` / `data-strip` / `data-horn` / `data-bow`, `data-wire-run` with `data-mast` / `data-registration` / `data-wire`, `data-contact` |
| `rail-turnout` | `data-view`, `data-throw`, `data-route`, `data-crossing-angle`; `data-stock="left\|right"`, `data-diverging="left\|right"`, `data-blade="normal\|reverse"` with `data-gap`, `data-throw-bar` with `data-travel`, `data-detection-rod`, `data-machine`, `data-detection`, `data-crossing`, `data-check="through\|diverging"`, `data-route-path`, `data-sleeper` |

## What is solved and what is illustrated

Solved: bogie placement, centre throw, end throw, the Klingel wavelength and the hunting
pose, the pantograph linkage and its reach clamp, the turnout crossing angle, lead radius and
blade gaps.

Illustrated and said so in each docs page: the wire stagger shape, the track curvature a
`line` behaviour runs through, traction and braking (no forces anywhere), the bogie's
suspension travel, and the overhead line as a straight run rather than a catenary. The
wheelset's flange clearance is drawn generously — a real one is about one per cent of the
gauge and would be invisible — and the docs say so. Nothing here integrates a force, a mass
or a speed.

## Originality

Industrial archetypes only — a box-cab electric locomotive, a two-axle powered bogie, a
single-arm roof collector, a trailing-point turnout. No operator liveries, no franchise
markings, no real railway's paint scheme, in the components, the demos or the docs.

## Integration

`rail-geometry` + four `registry:ui` items in `registry.json`; five entries in
`src/lib/docs.ts` (`Foundations` for the solver, `Robots` for the locomotive, `Machines` for
the other three); five demos and `demos` map entries; five catalogue cards, each running its
own behaviour because `catalogue-motion.test.tsx` drives real frames at every card and fails a
pinned one; five README rows; `railCollection` in `scripts/__tests__/registry.test.ts` and
`railSlugs` in `src/components/site/__tests__/docs-catalogue.test.tsx`;
`src/lib/robocn/__tests__/rail.test.ts` and
`src/components/ui/__tests__/rail-machines.test.tsx`.
