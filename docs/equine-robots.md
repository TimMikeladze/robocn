# The equine pair

Two machines and one new solver. The registry already has five things with four legs on the
floor — `robot-quadruped` (a rigid box), `robot-cat` (the back arches), `robot-dog` (the
shoulder swings on a blade), `robot-fox` (the whole animal tips) and `robot-hound` (a
concertina neck on a concealed drive). All five answer *what moves a leg root*. Neither of
these two does. They answer a different question:

> **What is a gait, and what is holding the animal up?**

That is the gap. Every walker in the set so far takes a `phase`, spreads four or six
quarter-cycle offsets around it, and calls the result "walk" or "trot". A horse is the one
animal where the gait is not a label: a walk is four beats in a lateral sequence, a trot is
two beats on diagonal pairs, a canter is three beats with a *lead*, and a gallop is four with
a suspension. You can count them. The beat is an output of the footfall offsets, not a name
someone typed.

Once you have the footfall pattern you also have, for free, the thing that drives both of
these machines: **which feet are down right now, and therefore what share of the body each
one is carrying.** That number — the load — is the new primitive, and each machine spends it
on a different mechanism.

| | |
|---|---|
| Items | `gait-kinematics` (lib), `robot-horse` (ui), `robot-pegasus` (ui) |
| Native view | `profile` for both |
| Solvers | `gait-kinematics` (footfall, support, load), `spine-kinematics` (topline, mane, tail), `robot-kinematics` (`solveChain2` legs and neck, `solveChain3` wing spars) |
| Distinct from | `robot-quadruped`: offsets and a duty factor with no sequence and no beat. `robot-cat` / `robot-dog` / `robot-fox`: each moves a leg root a different way; none of them knows which foot is bearing weight. `robot-bird`: scripted wing angles; the pegasus solves its spar to a tip path. |

## `gait-kinematics` — `solveGait(options)`

Zero React, zero dependencies past `robot-kinematics`. One call returns the whole support
state of a four-legged animal at one instant.

```
solveGait({ gait, phase, lead, duty, stride, lift })
  → { gait, beats, duty, lead, support, airborne, legs[], forehand }
```

Six gaits, each a fixed set of per-limb phase offsets:

| `gait` | Touchdowns (LH, RH, LF, RF) | Duty | Beats | What it is |
|---|---|---|---|---|
| `halt` | all planted | 1 | 0 | Four feet down, no cycle |
| `walk` | 0, 0.5, 0.25, 0.75 | 0.65 | 4 | Lateral sequence — never fewer than two feet down, and it never leaves the floor |
| `trot` | 0.5, 0, 0, 0.5 | 0.45 | 2 | Diagonal pairs, with a suspension between each |
| `pace` | 0, 0.5, 0, 0.5 | 0.45 | 2 | Lateral pairs. The same beat count as a trot on a different diagonal, which is exactly why the beat alone does not name a gait |
| `canter` | 0, 0.28, 0.28, 0.56 | 0.4 | 3 | Outside hind, the diagonal pair, then the leading fore. The uneven intervals are what leave room for exactly one suspension and no gaps before it |
| `gallop` | 0, 0.2, 0.45, 0.65 | 0.3 | 4 | The canter's diagonal broken apart, and a longer suspension |

Written for a right lead; `lead: "left"` mirrors the two sides.

**`beats` is counted, not declared.** The solver rounds each limb's touchdown instant and
counts the distinct values. That is what makes the walk-versus-trot distinction a fact about
the numbers rather than a string, and it is the first thing the solver tests assert: 4, 2, 2,
3, 4.

**`lead` swaps the two sides** for the canter and the gallop, and is ignored by the
symmetrical gaits. A left-lead canter is the mirror of a right-lead one, which the tests
check by mirroring the offsets rather than by eye.

### Load

Each limb reports `load`: the share of the body's weight it is carrying this instant, 0 when
it is in the air.

```
weight(leg)  = leg.fore ? FOREHAND : 1 − FOREHAND      // 0.58 / 0.42, the static split
load(leg)    = grounded(leg) ? weight(leg) / Σ weight(every grounded limb) : 0
```

so a horse standing square puts 0.29 on each fore and 0.21 on each hind, a trot puts 0.58 on
the single grounded fore, and in the suspension every load is zero. The invariants:

- the loads sum to exactly 1 whenever any foot is down, and to 0 when none is;
- no load is ever negative or greater than 1;
- `support` is the count of grounded limbs, and `airborne` is `support === 0`.

It is a **static weight distribution**, not a dynamics solve. There is no acceleration, no
ground reaction, no impulse, no centre of pressure. It is the share of the standing weight
each contact point would take, and the docs `notes` say so on both machines.

`gaitLoad` and `fetlockSink` are exported alongside, both pure, so a component that wants the
spring without the whole pose can have it.

## `robot-horse` — the sprung fetlock

Every leg in this registry so far is a chain solved to a foot target. The horse's is too, as
far as the knee (fore) and the hock (hind) — and then it stops solving, because **the joint
below is not driven by a target and is not scripted either. It is driven by the load.**

```
sink(load) = FETLOCK_DROP · load          // degrees the pastern drops
```

The fetlock of a real horse is a passive spring: the suspensory apparatus lets the joint sink
under weight and returns it when the limb unloads. So the pastern angle here is an *output of
the gait*, the same number `solveGait` produced, and what you are looking at when the joint
drops is the support pattern made visible. Freeze a trot at mid-stance and the two loaded
diagonals are visibly sunk while the two swinging limbs are straight; freeze it in the
suspension and all four are straight, because nothing is carrying anything.

That is the new axis. It is cheap to state and it is not in any other machine: one joint in
the chain whose angle no one sets.

### The neck as a balance beam

The second derived part, and it is worth naming why it is not the fox's brush again. The
fox's tail opposes an **attitude the caller sets** — `pitch` in, carriage out. The horse's
head and neck answer a **load the gait produces**, so the nod is in step with the footfalls
rather than with a body angle, and it appears without anybody setting anything:

```
nod = BALANCE · (foreLoad − restingForeLoad)
carriage = lerp(scriptedCarriage, scriptedCarriage + nod, balance)
```

A walking horse nods once per fore-limb loading and a trotting one barely nods at all, and
that falls out of the same arithmetic rather than out of two different scripts. `balance` is
the dial, 0 scripted to 1 fully derived.

### Everything else

- The topline is `solveSpine` with a restrained curvature, as the dog's and the fox's are:
  level back, deep girth, and a croup that comes back down over the hind legs. The withers
  are the anchor here — unlike the fox, the horse does not tip.
- The mane runs along the crest and the tail hangs off the croup, both on `solveSpine`, both
  picking up amplitude from the stride so they stream at a gallop and hang at a halt.
- The hind limb spends its free parameter the way the fox's does: the metatarsus is carried at
  an angle that opens with the crouch, and the femur and tibia solve to it.

### Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `walk` | Four beats, lateral sequence, the neck nodding once a stride. The signature. |
| `trot` | Two beats, diagonal, with a suspension; the back level and the nod nearly gone. |
| `canter` | Three beats on a lead, with the body rising and falling once a stride. |
| `gallop` | Four beats, the longest stride, mane and tail streaming. |
| `graze` | Halted with the neck run down to the floor and the odd weight shift. |
| `static` | Standing square. |

`interactive`: **drag across to scrub the stride** — the box is one full stride, so a person
can walk it through the footfalls one at a time and watch the fetlocks take the weight — with
arrow keys stepping 5% of a stride and Home/End parking it at the start and the end.
`onPhaseChange` throughout, and the head and eyes track the pointer. Released, it eases back
into the gait rather than snapping, which is the shared rule.

## `robot-pegasus` — the handover

One body, two support systems, and the number between them.

Nothing in the registry negotiates between two ways of holding itself up. `robot-bird` beats
its wings; five machines walk; none of them hands the load from one to the other. `lift` is
that number, 0 on the floor to 1 in the air, and it is **the same load budget**:

```
legLoad(i)  = (1 − lift) · gaitLoad(i)
wingLoad    = lift
```

Take the lift up and four things happen for one reason. The fetlocks recoil, because the load
driving them has gone. The legs run out of floor and fold in under the body — the fox's rule,
keyed here to the load rather than to the reach. The gait's cycle fades out while the
wingbeat's fades in, so the two cycles cross over rather than cutting. And the body rises off
the ground line. One prop, four consequences, all of them arithmetic.

At `lift` 0 it is a horse; at 1 it is a flyer with its legs tucked; in between is the part
worth drawing, and it is the part the drag gesture puts under your finger.

### The wing: a tip path, and a spar solved to it

`robot-bird` scripts its wing angles — shoulder, elbow and wrist each lerped through the beat.
This one goes the other way. The **wingtip traces a path** and the three bones are solved to
it:

```
tip.across  = ± (ROOT + SPAN · spread · cos(elevation))
tip.up      =   AMPLITUDE · spread · sin(2π t)
tip.forward =   SWEEP · spread · sin(4π t)            // twice a beat: the figure of eight
```

A 1:2 Lissajous is a figure of eight, which is what a wingtip actually traces — forward on the
downstroke, back on the upstroke. `solveChain3(shoulder, tip, [humerus, radius, manus])` with
the elbow bulging tailward gives the three bones, so **the articulation is an output of the
path**, and folding the wing is nothing more than `spread` going to zero: the same solve, a
near target, the bones stacking against the body the way they have to.

Modelled in three space and pushed through `robotCamera`, for the same reason the fox's ears
are: the beat is out of the plane the machine is drawn in, so a profile has to foreshorten it
rather than fake it.

### Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `launch` | The signature: canter, gather, and hand the weight over — the lift comes on across two strides while the wingbeat comes up under it. |
| `canter` | On the floor, wings folded, three beats. |
| `soar` | Wings held out with a slow trim, legs tucked, lift at 1. |
| `hover` | Lift at 1 and a fast shallow beat, holding station. |
| `static` | Standing, wings furled. |

`interactive`: **drag up and down to work the handover** — the lift itself, 0 at the bottom of
the box to 1 at the top, arrows 10% and shift 25%, Home on the floor and End in the air.
`onLiftChange`. The head tracks the pointer throughout.

## Controlled axes

`robot-horse`: `gait`, `lead`, `phase`, `arch`, `crouch`, `neck` (carriage), `balance`,
`ears`, `gaze`, plus `speed`, `offset`, `paused`, `animate`.
`robot-pegasus`: all of those bar `balance`, plus `lift`, `spread`, `beat` (the wingbeat
fraction) and `wingbeats` (beats per stride).

Each is finite-checked and clamped; a `NaN` renders the neutral pose. Supplying `phase` stops
the clock, everywhere, as it does across the set.

## `data-*` hooks

Shared: `data-horse` / `data-pegasus`, `data-view`, `data-solids`, `data-spine`, `data-trunk`,
`data-neck`, `data-head`, `data-ears`, `data-ear="left|right"`, `data-eyes`, `data-mane`,
`data-tail`, `data-leg="fore-left|fore-right|hind-left|hind-right"`,
`data-fetlock="<leg id>"`, `data-joint="…"`, `data-contact`, `data-ground`.
Pegasus adds `data-wing="left|right"`, `data-wingtip="left|right"` and `data-lift`.

## Views

Modelled once, projected. Profile is native for both. Off-axis a `data-solids` group supplies
the width a single elevation cannot: the trunk as one extruded footprint per spine segment,
the four legs as tubes half a track either side, the skull as a solid. The pegasus's wings are
three-space throughout — even the profile projects them — so plan shows the span and the
figure of eight, and profile shows the beat foreshorten.

## What these are not

Illustrative kinematics with a static weight split on top. No dynamics: no acceleration, no
ground reaction force, no centre of pressure, no impulse at footfall, no aerodynamics of any
kind — the wing generates no modelled lift and `lift` is a prop, not a computed force. The
support pattern and the beat count are real and derived; the load share is a static
distribution; the fetlock spring is a proportional rule and not a stiffness. Neither animal
travels across its frame while its feet move. Manes, tails and plating are drawn, not solved.

Original archetypes throughout: a four-legged machine that gaits and a winged one that hands
its weight from legs to wings, each named for its job.
