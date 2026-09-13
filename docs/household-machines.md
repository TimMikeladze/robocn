# The household

Five machines and one solver covering the building you live in and the machines inside it: a
house, a tower block, an espresso machine, a refrigerator and a washing machine.

Design note for `household-geometry`, `gabled-house`, `tower-block`, `espresso-machine`,
`refrigerator` and `washing-machine`.

## Why this is a family and not five items

**Everything here is an enclosure you open.** The registry has one machine that comes apart
(`tool-changer`) and one that opens along its own depth (`robot-torso`). Nothing in it is a
*box with a door*, where opening is the point and what is behind the door is a different
drawing: shelves and drawers, a drum, a staircase, a car in a shaft. A leaf hinged on a
vertical edge is a flat panel at an attitude, which is what `panelTransform` was written for,
so the doors come out right from all four cameras without a second piece of artwork.

**`accent` is what is live.** Across the family the accent colour is the thing happening right
now: lit windows and a porch lamp, occupied floors, the shot in the cup, the lamp that the
door switch turns on, the programme light and the water in the drum. Reading a card you can
see at a glance whether the machine is doing anything. The oil field used accent as a
*quantity*; here it is a *state*.

**Two of the five are architecture, which the set has never had.** A house and a tower are
machines here in the same sense a pumpjack is: a roof pitch that is an angle, a storey count
that changes the height, a garage door on a real track, a lift car roped to a counterweight.
Nothing is a photograph of a building.

## What ships

| Item | The mechanism | What nothing else in the set does |
|---|---|---|
| `household-geometry` | swing, sectional track, tumble, suspension, hoist, slats, flow | the first *dimensionless* solve: one number decides the whole regime |
| `gabled-house` | sectional garage door, tracking shutters and array, solved gable | a body whose silhouette is an angle you pass it |
| `tower-block` | lift car and counterweight on a constant rope | a count axis that is also a travel: more storeys, further to fall |
| `espresso-machine` | spring-lever group: slider-crank piston on a spring | pressure as an *output* of a spring, not a curve someone drew |
| `refrigerator` | two leaves on vertical hinges, and a door switch | an interior that is a second drawing, revealed by a solved swing |
| `washing-machine` | tumble by Froude number, tub on a resonant suspension | a machine that is *unstable at one speed and calm above it* |

## The solver

`src/lib/robocn/household.ts`. Pure functions, plain objects, no React, no dependencies. It
owns the closures a drawing is not allowed to fake.

```ts
swingPose(angle, { width, maxAngle })
  // → { angle, edge: {x, depth}, facing, reach, open }

sectionalPanels(travel, { panels, panelHeight, radius, opening, headroom })
  // → [{ index, a, b, angle, onTrack }] — every panel still `panelHeight` long

tumblePose(rpm, { radius })
  // → { froude, release, regime: "resting"|"cascading"|"cataracting"|"centrifuging" }
tumbleItems(clock, { count, rpm, radius, itemRadius })
  // → [{ x, y, angle, airborne }] — riding the wall, then a real ballistic arc

suspensionPose(rpm, { critical, imbalance, damping })
  // → { ratio, amplitude, phase, resonant }

hoistPose(position, { travel, sheave, spacing })
  // → { car, counterweight, rope, length } — length constant at every position

slatPose(sun, { minTilt, maxTilt, width, pitch })
  // → { tilt, clamped, shade }

extractionFlow(pressure, { resistance, threshold })
  // → flow, and 0 below the threshold rather than a negative trickle
```

Invariants, all tested directly:

- **A leaf keeps its width.** `swingPose` places the free edge on a circle about the hinge, so
  a door at 90° stands exactly as wide out of the face as it was across it. `facing` is
  `cos θ` — how much of the leaf a front camera still sees — and it is what decides whether
  the leaf's own artwork (a handle, a dispenser) is drawn at all.
- **A sectional panel keeps its length.** Panels are placed by *arc length* along a track that
  runs up the opening, round a quarter circle and back under the head. A panel straddling the
  bend is drawn as the chord between its two ends, which is what a real one does. Fully open,
  every panel is horizontal; fully shut, every panel is vertical; at no travel does a panel
  stretch.
- **The tumble regime is one dimensionless number.** A body on the drum wall leaves it where
  gravity can no longer supply the centripetal force: `cos α = ω²r/g = Fr`, measured from the
  upward vertical. Below `Fr = 1` there is a release angle and the load falls; at `Fr ≥ 1`
  there is none and the load is pinned to the wall — which *is* the spin cycle, not a separate
  animation. The washing machine's wash and spin are the same solver either side of one.
- **The fall is ballistic and rejoins the drum.** After release an item is a projectile until
  its path re-meets the drum circle; the re-entry time is the root of a quadratic, not a
  guess, so nothing leaves the drum and nothing hangs in the air.
- **The suspension is a real rotor response.** `amplitude = e·r²/√((1−r²)² + (2ζr)²)` with
  `r = ω/ωn`. It is small below the critical speed, large at it, and settles to the imbalance
  itself above it — a tub that walks on the way up and self-centres at full spin. Nothing else
  in the set is worse at one input than at a larger one.
- **The rope length is constant.** `hoistPose` puts the counterweight the same distance below
  the sheave that the car is above its own bottom stop, and the reported `length` is equal at
  every position — the same honesty `drilling-derrick` gives its falls.
- **A tracker at its stop says so.** `slatPose` clamps to the travel it has and reports
  `clamped`, rather than pointing a fixed array at a sun it cannot reach.

## The contract these five keep

Everything in `docs/spec.md` plus:

- **`view`.** All five are objects in space and take `plan | front | profile | iso`, native
  `front`. Each is modelled once in its own front elevation through `elevationDraft(camera,
  "front")` and projected; doors and lids go through `panelTransform`/`panelPath`, so a leaf
  that is edge-on in `front` opens toward the camera in `iso` with no extra drawing.
- **One controlled scalar each,** and it is the thing you would actually grab:

  | Machine | Scalar | Interactive drag |
  |---|---|---|
  | `gabled-house` | `sun` 0–1, a day | across: time of day |
  | `tower-block` | `carriage` 0–1, the lift | up and down: the car |
  | `espresso-machine` | `lever` 0–1, the pull | down: the lever |
  | `refrigerator` | `door` 0–1, the fresh leaf | across: swing it |
  | `washing-machine` | `rpm`, the drum | across: spin it up through resonance |

- **`data-*` hooks.** `data-roof`, `data-garage`, `data-panel="garage-2"`, `data-shutter`,
  `data-array`, `data-lift-car`, `data-counterweight`, `data-rope`, `data-storey`,
  `data-crown`, `data-lever`, `data-piston`, `data-stream`, `data-cup`, `data-needle`,
  `data-door="fresh"`, `data-lamp`, `data-shelf`, `data-compressor`, `data-drum`, `data-tub`,
  `data-item`, `data-drawer`, `data-dial`, `data-spring="left"`. They are API.

## What is solved and what is drawn

Stated here and in each page's `notes`, because the rule is that an illustrated part is fine
and an illustrated part presented as solved is not.

- **Solved:** every door swing and lid; the garage door's panel positions; the lift car,
  counterweight and rope; the gable from the pitch; the lever group's piston and its spring
  pressure; the tumble release, the ballistic fall and the suspension response; the tracker
  angle, its stops and the shade fraction.
- **Drawn:** brickwork, glazing bars, the fridge's condenser coil run, the boiler's sight
  glass, the crema on a cup, foam, water sloshing, and every interior fitting. There is no
  thermodynamics anywhere in this family: a temperature is a label, a "warm boiler" is a lamp,
  and nothing computes a heat flow, a pressure drop in a pipe, a wind load or an occupancy.
- **Not invented:** the tower's lit floors are a fixed deterministic pattern scaled by
  `occupancy`, not a simulation of people, and the docs say so.

## Originality

Generic archetypes only: a gabled suburban house, a residential tower, a lever espresso
machine, a two-door refrigerator, a front- or top-loading washer. No manufacturer, model,
wordmark, control layout or livery is reproduced, here, in the demos or in the labels.
