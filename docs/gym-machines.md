# Gym machines — where the felt load comes from

Five machines and one solver, on an axis nothing in the set has yet: **the resistance a person
feels is almost never the weight they selected**, and on each of these it is changed by a
different visible mechanism.

| Item | Type | What it is |
|---|---|---|
| `gym-geometry` | lib | Five mechanisms that stand between a selected weight and a felt load: rope reeving, a variable-radius cam, an inclined rail, a coupler curve, and velocity-squared air drag. |
| `cable-station` | ui | Selectorised weight stack, reeved through pulleys to a handle. |
| `resistance-cam` | ui | A lever on a variable-radius cam, so the resistance tracks a strength curve. |
| `leg-press` | ui | A sled on inclined rails, where the rail angle *is* the resistance. |
| `cross-trainer` | ui | Crank and rocker; the foot path is the coupler curve of the linkage. |
| `rowing-erg` | ui | Air flywheel on a one-way clutch, with a damper vent that sets the drag factor. |

## What is actually new here

Everything else in the registry that carries a load is honest about **position**: a walker's
hull goes where the support polygon lets it, a derrick's block hangs where the rope pays out.
None of them say anything about **force**, because none of them has a mechanism in between.

These do, and the mechanism is the point. Each machine reports a number nobody typed:

```
cable-station    advantage   n           handle force = W / n,  stack rise = d / n
resistance-cam   moment arm  r(θ)        resistance   = W · r(θ) / r_lever
leg-press        sled load   W · sin(θ)
cross-trainer    stride      extent of the coupler curve
rowing-erg       drag factor k / I       handle force ∝ (handle speed)²
```

Five different reasons the felt load ≠ the selected load: **reeving ratio, cam radius, rail
angle, linkage path, velocity-squared drag**. That is what makes them a family rather than
five machines that are all a lever, and it is why they share one solver: each of the five is a
function from one controlled number — a stroke, an angle, a travel — to a pose *and* the load
that pose implies.

## The shared contract

`src/lib/robocn/gym.ts`. Pure functions over plain `{x, y}`; no React, no dependencies beyond
`kinematics.ts` and `linkage.ts`. Nothing here knows about a person, a muscle, a rep or a
calorie. Five entry points:

### `reeveStack(handleTravel, geometry)` — the reeving ratio

The rope is inextensible, so whatever the handle draws is shared between the falling lines
under the load. With `n` lines:

```
stack rise   = handle travel / n
handle force = selected weight / n
```

`lines` is the reeving, `pin` splits the stack: the pinned plate and everything above it ride
up on the riser, everything below stays on the floor. So `selected`, `weight`, `advantage`,
`handleForce` and every plate's height are **outputs** — the only inputs are the pin and how
far the handle has come down. The travel constraint is `tacklePosition` from `linkage.ts`,
which already states it for a drum; a cable station has no drum, so one "turn" is set to one
world unit of rope and the same constraint runs.

### `solveCam(angle, geometry)` — the moment arm

The Nautilus idea. The cable leaves the cam at a radius that changes with lever angle, so the
resistance torque tracks the joint's strength curve instead of being flat. Three consequences
that are computed, not drawn:

- **The moment arm is the cam radius at that angle.** `camTangent` finds where the run out to
  the anchor touches the working circle, so the perpendicular distance from the pivot to the
  cable is `r(θ)` *exactly*, whichever way the cable leaves. `radius` and `momentArm` are one
  number, and the resistance the lever feels is `W · r(θ)`.
- **Payout is the integral of `r dθ`.** The stack therefore does *not* rise linearly with the
  lever: over the shipped profile, equal quarters of the sweep pay out 7.2, 12.6, 11.2 and 5.7.
  `payout` is integrated with composite Simpson over the sweep so far.
- **The drawn cam is the resistance curve.** `camProfile()` is the same `r(θ)` in polar, wound
  so that a cam keyed to its lever turns *forward* with it, and `camOutline(pose)` turns it to
  where the lever has actually put it. Reading a radius off the outline is reading the moment
  arm off the machine.

### `solveSled(stroke, geometry)` — the rail angle

A carriage on rails inclined `railAngle` from horizontal. The component of weight along the
rails is `W · sin(θ)`, so a 30° frame gives half the plate weight and a 45° frame gives 0.71 of
it. This is the only machine in the family where changing the *frame* changes the weight, and
it is the whole reason a leg press number does not compare with anyone else's.

Frictionless: no rail friction, no roller drag, no bearing loss. Stated on the page.

### `solveTrainer(crankAngle, geometry)` + `trainerFootPath(geometry)` — the coupler curve

A crank, a coupler and a rocker — `solveFourBar` from `linkage.ts`. The footpad is a point
rigidly attached to the coupler, `padAlong` past the crank pin and carried on *beyond* the
coupler pin, the way a real pedal arm is; so its path is a **coupler curve**: a closed,
egg-shaped, distinctly non-elliptical loop. `stride` is the horizontal extent of that loop and
`rise` its vertical extent, both found by sampling the solved loop over a full crank
revolution — not by tracing an ellipse and calling the long axis a stride. On the shipped
links the stride comes out at 98.7 against a crank diameter of 72, so the linkage genuinely
amplifies rather than following the crank circle. Change the crank radius or any link length
and the path changes shape, which is exactly what separates one machine's feel from another's.

The grip is the same rocker carried the other way past its ground pivot, so arms and feet are
one linkage and cannot drift out of phase, and the two sides are that linkage half a
revolution apart. `TRAINER_BRANCH` fixes which of the two assemblies the loop takes, once, so
the machine cannot flip branch between frames and turn itself inside out.

### `solveErgCycle(geometry)` — velocity-squared drag

The only one with real dynamics.

- **Drag.** A fan flywheel is retarded by `τ = k·ω²`. The damper vent sets `k`: open the vent,
  more air reaches the cage, `k` rises. `dragFactor = k / I` is the number a rower actually
  reads off the monitor.
- **Clutch.** The chain drives the sprocket through a one-way clutch. While the chain is
  faster than the rim the wheel is *driven* — `ω = handleRate / sprocket` — and the force at
  the handle is `k·ω² / sprocket`, which is why an erg gets harder the faster it is pulled,
  not the further. When the chain drops below rim speed the clutch releases and the wheel
  coasts on drag alone: `dω/dt = −k·ω²/I`.
- **Periodic.** `solveErgCycle` integrates one stroke repeatedly until the start and end
  speeds agree, so the cycle it returns is the machine's steady state rather than a spin-up
  transient. The component memoises it on the geometry and samples it by phase, which is what
  keeps every behaviour a pure function of the clock.
- **Where the fan is.** Each sample carries `wheelAngle`, the integral of the wheel's own
  speed since the catch, and the cycle carries `turnsPerStroke`. So the drawn fan spins up
  through the drive and runs down through the recovery instead of turning at a chosen rate,
  and a shut vent visibly turns it further on the same stroke.
- **Counter-travel.** The drive sequences legs → body → arms and the recovery reverses it, and
  the slide's own reversal runs `catchOverlap` past the end of the cycle — so at the catch the
  seat is still coming forward while the chain has already gone taut and the handle is going
  the other way. `counterPhase` is the fraction of the cycle where `handleRate` and `seatRate`
  have opposite signs, measured off the samples rather than asserted; on the shipped geometry
  it comes out near 4%, and setting `catchOverlap` to zero closes it entirely.

Illustrative where it has to be: there is no rower. The handle and seat schedules are chosen
ramps with the sequencing a coach would recognise, and everything downstream of them —
speeds, forces, the drag factor, the counter-travel window — is integrated from those ramps.
No cable stretch, sheave friction, rail friction or bearing loss anywhere in the file.

## The machines

All five are drawn in **side elevation** (`profile`), because every one of these mechanisms is
a thing that happens in a vertical plane, and pushed through `robotCamera` for the other three.
Each takes one controlled number, a behaviour union including `static`, `interactive` drag and
arrow keys, and puts its reported output in the `aria-label` so it is testable:

| Machine | Controlled | Behaviours | In the label |
|---|---|---|---|
| `cable-station` | `draw` (handle travel) | `press`, `pyramid`, `hold`, `static` | mechanical advantage, selected weight |
| `resistance-cam` | `angle` (lever) | `curl`, `slow`, `hold`, `static` | moment arm at that angle |
| `leg-press` | `travel` | `press`, `partials`, `hold`, `static` | sled load and the share it is of the plates |
| `cross-trainer` | `crankAngle` | `stride`, `sprint`, `coast`, `static` | stride, and the rise that goes with it |
| `rowing-erg` | `strokePhase` | `row`, `sprint`, `paddle`, `static` | drag factor, stroke rate |

Two of those names dodge something. `leg-press` takes `travel` and not `stroke` because
`stroke` is an SVG attribute the component passes through, and `rowing-erg` takes
`strokePhase` and not `phase` because `phase` is already the motion offset every machine in
the set carries.

Two of the machines also use a data hook to say what they have worked out rather than only
saying it in the label: `[data-cam][data-arm]` is the moment arm, and `[data-travel]` gains
`data-opposed` for exactly the window where the erg's handle and seat go opposite ways.

One framing note. `leg-press` sizes its envelope from the **rail angle** and nothing else.
That is not the framing breathing: the rail angle is a thing somebody bolted together, like
the cable station's reeving, while the travel is the machine working — and the travel never
touches the frame.

## Originality

Named for the job, as machines: a cable station, a resistance cam, a leg press, a cross
trainer, a rowing erg. No brand, logo, badge, paint scheme or trade name appears in the
components, the demos, the labels or the docs. "Nautilus-style" appears in this note as the
name of the *mechanism* — a variable-radius cam — and nowhere in shipped copy.
