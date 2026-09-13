# The camel

A third machine on `gait-kinematics`, and it is not a horse with a hump on it. The horse
spends the solver's load on a sprung fetlock and a nodding neck. The pegasus spends it on a
handover between legs and wings. This one spends it on something no machine in the registry
has ever had:

> **Ground that gives.**

Every other machine in the set stands on a line. The floor is `y = 0`, a foot is either on it
or above it, and `contact` is a boolean. That is fine for a shop floor and wrong for anything
that works on sand, which is the one animal in this family that does. So the camel's floor is
a **medium with a depth**, and the foot goes into it.

| | |
|---|---|
| Item | `robot-camel` |
| Native view | `profile` |
| Solvers | `gait-kinematics` (footfall, load, pad spread, sinkage), `spine-kinematics` (topline, hump, tail), `robot-kinematics` (`solveChain2` — four limbs and the neck) |
| Distinct from | `robot-horse`: same solver, but the load goes into the ground rather than into a spring. `robot-quadruped` / `robot-cat` / `robot-dog` / `robot-fox`: a rigid floor line under all of them. |

## The ground

Two pure functions, both in `gait-kinematics` beside `fetlockSink`, because both are
consequences of the same load number:

```
padSpread(load)          = 1 + 0.55 · load
footSinkage(load, ground, spread) = 9 · load · ground / spread
```

`ground` is the new prop: 0 is rock, 1 is dry sand. Pressure is load over contact area, and
how far that pressure takes the foot down scales with how soft the ground is. What makes it
worth modelling rather than asserting is the third term:

**The pad opens under load, and that is what keeps the animal up.** A desert foot is a splay
pad, not a hoof; weight coming onto it spreads it, the spread drops the pressure, and the
same animal on the same sand therefore sinks *less* than it would on a foot that did not
open. That is the mechanism, it falls out of two lines of arithmetic, and the test asserts
exactly it: `footSinkage(load, 1, padSpread(load)) < footSinkage(load, 1, 1)`.

So on rock the machine reads like the horse — four pads on a line. Take `ground` up and the
loaded feet settle into it, each one as deep as what it is carrying, with the unloaded ones
riding clear. Freeze a pace at mid-stance and the two sunk feet are the two on the ground,
which is the support pattern written into the sand.

It is a proportional rule and not a soil model. No bearing capacity, no shear, no compaction,
and the displaced ground is drawn rather than conserved — the docs `notes` say so.

## The hump

The second mechanism, and the second thing driven rather than set. A hump is a **store**, and
a store that is empty does not shrink evenly — it slumps. `reserve` runs 1 to 0:

- at 1 the hump stands up off the back, firm, its own height;
- as it falls the height goes but the base does not, because the skin is still there;
- past the middle it folds over to one side, which is what an empty hump does.

It is one outline hung on the topline — the base pinned to two fixed points on the back, the
crown placed by `reserve` for height and by `reserve` again for lean, and the two flanks drawn
through control points that slacken as the store empties. So it is the same curve throughout,
bent, rather than one drawing swapped for another. The base width is held while the height
falls, which is the honest half of "the same skin, less in it". It is not a volume solve, and
it conserves nothing.

## The roll

The third: **a pacing animal throws itself right over, and a trotting one barely moves.**

```
roll = ROLL · (load on the left feet − load on the right feet)
```

A pace is the lateral two-beat — both feet of one side are down together — so at every instant
the animal's whole weight is on one side, the roll goes to a full ±1, and it swings right over
each way once per stride. A trot is the diagonal two-beat, and its support is a fore on one
side against a hind on the other, so all that is ever off-centre is the difference between what
the forehand carries and what the hind end does: **exactly 0.16 of a body, at every instant
either diagonal is down, and nothing at all in the suspension.** A walk lands somewhere between
the two, being lateral in sequence but never in pairs.

Nobody writes any of that. It comes out of the same load numbers, and the test asserts the
exact residual rather than eyeballing it — which makes it the best evidence in the set that the
gait solver is describing something real rather than labelling it. (The first draft of that test
asserted a trot rolls *zero*; the arithmetic said 0.16 and the arithmetic was right. The
forehand split is why.)

`pace` is also why this machine exists on that solver at all: `gait-kinematics` shipped six
gaits and the horse reaches five of them. The camel is the one that paces.

## Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `pace` | The signature: lateral couplets, and the roll that falls out of them. |
| `walk` | Four beats, the same lateral sequence a horse walks, rolling between the other two. |
| `trot` | Diagonal pairs — the control case, where all that is left of the roll is the forehand split. |
| `couch` | Folded down onto the ground: knees first, then the quarters, the way one gets down. |
| `static` | Standing square. |

`interactive`: **drag up and down to work the ground** — firm at the top of the frame, soft at
the bottom, so dragging down is sinking — with arrows stepping 10% and shift 25%, Home on rock
and End in sand. `onGroundChange`. The head and eyes track the pointer throughout.

## Controlled axes

`gait`, `phase`, `ground`, `reserve`, `arch`, `crouch`, `neck`, `tail`, `ears`, `gaze`, plus
`speed`, `offset`, `paused` and `animate`. Each is finite-checked and clamped; a `NaN` renders
the neutral pose.

## `data-*` hooks

`data-camel`, `data-view`, `data-solids`, `data-spine`, `data-trunk`, `data-hump`, `data-neck`,
`data-head`, `data-ears`, `data-ear="left|right"`, `data-eyes`, `data-tail`, `data-roll`,
`data-ground`, `data-bed` (the disturbed surface), `data-leg="…"`, `data-pad="…"`,
`data-hoof="…"` (the pad's centre, as the other two use it), `data-fetlock="…"`,
`data-joint="…"`, `data-contact`.

## Views

Modelled once and projected, profile native. The roll is a rotation about the fore-aft axis,
so plan and front show it directly and the profile shows its consequence — one side's shoulder
up and the other's down, which is what a roll looks like from the side. Off-axis a
`data-solids` group gives the trunk its width, one extruded footprint per spine segment.

## What it is not

Illustrative kinematics with a proportional ground rule on top. No soil mechanics: no bearing
capacity, no shear failure, no compaction, and the rim of disturbed ground around a sunk foot
is drawn rather than displaced from anywhere. No dynamics: the load is a static weight
distribution, there is no impulse at footfall, and the roll is a proportional rule rather than
a moment about anything. The hump slumps by a rule and conserves no volume. The animal does not
travel across its frame while its feet move.

Original archetype: a four-legged machine built for ground that will not hold it up, named for
its job.
