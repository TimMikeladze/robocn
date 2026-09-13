# Vehicle robots

Seven machines that carry something along a path, and one solver. Everything else in the set
either stands still and works (an arm, a press, a gearbox) or moves its own body about (an
animal, a droid, a rover). A vehicle is the third thing: a rigid body whose *whole* shape is
an answer to the medium it travels through, and the mechanism worth drawing is the one that
turns it.

`robot-rover` and `robot-drone` already do "a machine that goes somewhere" as a heading and a
drift. Neither solves the constraint underneath, which is what this family is for: a rover's
front wheels are turned by heading error, and both of a car's are turned by the *same*
steering rack through different angles, because they run on different circles. That difference
is the family.

## What ships

| Item | Archetype | The axis nothing else has |
|---|---|---|
| `vehicle-geometry` | lib | Ackermann steering, steady-state articulation, coordinated bank, a rigid body sitting on N axles, the rocket equation, foil lift |
| `robot-car` | autonomous road car | One `steer` number, two different wheel angles, one turn radius — and the body rolls the way the radius says |
| `transit-bus` | articulated city bus | The hitch: the rear section's angle is *solved* from the tractor's turn. Plus doors, and a kneel that is real suspension travel |
| `cargo-plane` | high-wing freighter | A coordinated turn: bank comes from speed and radius, and the ailerons deflect the way that roll was commanded |
| `hydrofoil-craft` | foilborne autonomous ferry | The only machine here that leaves its own ground plane — lift goes as v², so the hull rises off the water and the struts appear |
| `launch-vehicle` | two-stage orbital booster | Staging: the interstage parts, Δv is Tsiolkovsky over the stages that are left, and the engines gimbal against the pitch program |
| `strike-starfighter` | split-foil attack fighter | Four wings on two hinges that open from cruise into an X about the fore-aft axis |
| `ion-interceptor` | twin ion-drive interceptor | Hexagonal panels pitching on lateral pylons, with a pod that turns *inside* them |

Named for the job. These are genre archetypes — a split-wing attack fighter and a panelled
ion interceptor are as old as the genre — and nothing here carries a franchise name, a logo,
a paint scheme or a character marking, in the component, the docs or a demo label.

## The solver: `src/lib/robocn/vehicle.ts`

Pure functions over plain numbers and `Vec2` / `Vec3`. No React, no dependencies, its own
registry item and its own tests.

| Function | What it is | Real or illustrated |
|---|---|---|
| `ackermann(steer, {wheelbase, track})` | Turn radius `L / tan δ` at the centreline, then each wheel's own angle from its own radius | Exact geometry |
| `hitchAngle(steer, tractor, trailerWheelbase)` | The steady-state articulation angle: the hitch runs on a circle, the trailer axle has no lateral velocity, solve for the angle between them | Exact geometry |
| `coordinatedBank(speed, radius)` | `atan(v² / rg)` — the bank at which the turn is coordinated | Exact |
| `axleRide(surface, positions)` | A rigid body on N axles over a surface: least-squares heave and pitch, plus each axle's own deflection from it | Exact |
| `tsiolkovsky(massRatio, exhaustVelocity)` | `vₑ ln(mr)` | Exact |
| `stackDeltaV(stages)` | The sum over the stages still attached | Exact |
| `foilLift(speed, area, coefficient, density)` | `½ ρ v² S C_L` | The ideal lift equation. No drag, no wave-making, no cavitation |
| `foilRise(speed, takeoff)` | How far out of the water the hull is, from lift against weight | Derived from the above; the *shape* of the transition is a stated rule |
| `pitchProgram(fraction, kick)` | 90° to 0° over an ascent, kicked over early | **Illustrative.** Not a trajectory optimiser |
| `wheelSolid(centre, radius, halfWidth, steer)` | A steered wheel's corners in world space, ready for `slabPath` | Geometry |

Two of those — `foilRise` and `pitchProgram` — are shapes rather than simulations, and both
say so in the docs `notes` of the machines that use them. Nothing in this family integrates a
path: a car's steering angle is a pose, not a trajectory, and no machine here accumulates
where it has driven.

## The shared contract

Everything the rest of the set already keeps — `shell`/`metal`/`dark`/`accent` through
`robotSurface`, `size` scaling a fixed viewBox, four variants that change paint only, a
`behavior` union that always includes `static`, controlled props winning and stopping the
loop, `interactive` with pointer drag and arrow keys, `px()` on every computed coordinate,
finite-clamped inputs and a neutral pose for bad ones.

### Views

Every one of the seven takes `view`, because every one of them is an object in space.
Modelled once in world units — **x** starboard, **y** up, **z** aft — and pushed through
`robotCamera(view)`.

| Machine | Native view | What the other cameras add |
|---|---|---|
| `robot-car` | `profile` | Plan is where Ackermann becomes visible: the two front wheels are at different angles |
| `transit-bus` | `profile` | Plan shows the articulation off-tracking inside the tractor's line |
| `cargo-plane` | `plan` | Front shows dihedral and the bank; profile shows the high wing and the loading ramp |
| `hydrofoil-craft` | `profile` | Front shows the foil's span and the strut pair |
| `launch-vehicle` | `front` | Plan is the engine cluster and the fin arrangement |
| `strike-starfighter` | `front` | Front is where the X is; plan is the four wings splayed, which is the same hinge seen from above |
| `ion-interceptor` | `front` | Plan reduces the panels to two lines — which is what a flat panel seen from above is |

### `data-*` hooks — these are API

| Machine | Attributes |
|---|---|
| `robot-car` | `data-body` `data-wheel="front-left"` … `data-steer` `data-roll` `data-lamp` |
| `transit-bus` | `data-tractor` `data-trailer` `data-hitch` `data-door="front"` `data-kneel` `data-wheel` |
| `cargo-plane` | `data-airframe` `data-wing="port"` `data-aileron="port"` `data-flap` `data-gear` `data-prop` |
| `hydrofoil-craft` | `data-hull` `data-strut="fore"` `data-foil` `data-waterline` `data-spray` `data-rise` |
| `launch-vehicle` | `data-stack` `data-stage="first"` `data-engine` `data-gimbal` `data-plume` `data-fin` `data-readout` |
| `strike-starfighter` | `data-fuselage` `data-foil="upper-port"` `data-hinge` `data-engine` `data-canopy` `data-cannon` |
| `ion-interceptor` | `data-pod` `data-panel="port"` `data-pylon` `data-viewport` `data-emitter` |

### Behaviours

Each is an exported pure function of the clock, sampled directly in the tests.

| Machine | Behaviours | What the cycle is |
|---|---|---|
| `robot-car` | `cruise` `slalom` `park` `static` | The steering angle |
| `transit-bus` | `route` `service` `static` | Steering on a route, or a stop: kneel, doors, pull away |
| `cargo-plane` | `cruise` `circuit` `approach` `static` | The commanded turn radius, which is what the bank comes from |
| `hydrofoil-craft` | `takeoff` `foilborne` `moor` `static` | Speed, which is the only input the rise has |
| `launch-vehicle` | `ascent` `hold` `static` | Ascent fraction: pitch program, staging, plume |
| `strike-starfighter` | `patrol` `attack` `static` | Foil opening, plus a bank |
| `ion-interceptor` | `patrol` `intercept` `static` | Panel pitch and pod yaw |

## Why seven and not one

A vehicle component that took `kind="car" | "bus" | "plane"` would be one silhouette with
three hats. These are seven mechanisms: a steering rack, a hitch, a control surface, a foil, a
staging ring, a wing hinge and a panel pylon. Only the first two share maths, and they share
it through the solver rather than through a component.

## Verification

`vitest` over the solver (Ackermann's inner wheel always turning harder than the outer, a
straight rack giving equal angles and an infinite radius, the articulation angle being zero
straight ahead and signed with the steer, a rigid body on a flat surface having no pitch, Δv
adding across stages, lift going as the square of speed) and over each machine (every
controlled axis moving its own `data-*` mechanism, `NaN` on every numeric axis never reaching
the DOM, the accessible label naming the machine and the view, each behaviour sampler inside
its limits and neutral for a non-finite clock, the keyboard control reporting through its
`on…Change`). Then `tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and driven
in a browser: every behaviour, all four variants, all four views, grabbed with a pointer, at
390px, and with reduced motion forced on to confirm the loops park.
