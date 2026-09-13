# The bears

Three machines and one new solver. The registry already has six things with four legs on the
floor — `robot-quadruped` (a rigid box), `robot-cat` (the back arches), `robot-dog` (the
shoulder swings on a blade), `robot-fox` (the whole animal tips about its hip), `robot-hound`
(a concertina neck), `robot-turtle` (a gait under a shell). Every one of them stands on a
**point**. The paw at the end of each chain is a pad the size of a full stop, the leg solves to
it, and the animal's base of support is four dots on a line.

That is the gap, and it is the whole family:

> **A bear is plantigrade. Its foot is a segment on the floor, not a point — so it has a base
> of support, and that is why it can stand up.**

Everything here comes out of that one sentence. A sole that is a segment can be flat, on its
heel, or on its toe, and the contact it makes is an *interval*. Intervals can be unioned into a
base of support. A base of support has edges, so a centre of mass can be inside it or outside
it, and the distance to the nearest edge is a number. That number — the **margin** — is the new
primitive, the way `load` is the equine pair's, and each of these three machines spends it on a
different mechanism.

| | |
|---|---|
| Items | `bear-kinematics` (lib), `robot-bear` (ui), `robot-polar-bear` (ui), `robot-panda` (ui) |
| Native view | `profile` for all three |
| Solvers | `bear-kinematics` (sole roll, base of support, static load share), `spine-kinematics` (topline, neck), `robot-kinematics` (`solveChain2` limbs) |
| Distinct from | Every other quadruped here: a point contact per foot, no support interval, and nothing that knows whether the animal would fall over. `robot-skeleton` has a rolling foot but it is a biped that never had four contacts to lose. |

## `bear-kinematics`

Zero React, zero dependencies past `robot-kinematics`. Three pure functions.

### `solveSole(options) → SolePose`

One plantigrade limb: hip, knee, ankle, **heel and toe**, and what the sole is doing.

```
solveSole({ hip, plant, pivot, pitch, femur, tibia, heel, toe, ankle, bend })
  → { hip, knee, ankle, heel, toe, pitch, contact, span, reached }
```

The sole is a rigid segment: `heel` units behind the ankle's projection, `toe` units in front,
carried `ankle` units below the ankle joint. `pitch` is the sole's angle, positive toe-up.
`pivot` says which part of it is on the floor — `"heel"`, `"toe"` or `"flat"` — and `plant` is
where that pivot sits. The ankle is then an *output* of the sole's placement rather than an
input, which is the inversion the whole family needs: you place the foot the way a foot is
placed, and the leg answers.

- **The sole never changes length and never goes through the floor.** Heel and toe are placed
  off one direction vector, so `|heel − toe|` is exactly `heel + toe` at every pitch — the first
  thing the solver tests assert. If the placement would sink either end below the floor, the
  whole limb is lifted until it does not.
- **`contact`** is `"flat"`, `"heel"`, `"toe"` or `"airborne"`, read off the two ends' heights
  rather than copied from `pivot`, so it stays true when the limb has been lifted or the target
  is out of reach.
- **`span`** is the grounded interval along the floor: `[heel.x, toe.x]` flat, a degenerate
  point at the heel or the toe when it is rolling, `null` in the air. A degenerate span is the
  honest answer for a digitigrade foot, and the reason this set's other quadrupeds cannot rear.
- **`reached`** is false when the hip cannot get to the ankle the placement asks for. The chain
  is clamped to its reach, the sole rides with it rigidly, and the contact becomes `"airborne"`
  — a limb that cannot make the floor does not pretend to be standing on it.

### `solveSupport(contacts, com) → SupportPose`

```
solveSupport([{ id, span }, …], com)
  → { span, com, margin, stable, loads }
```

- `span` is the union hull of the grounded intervals: the base of support in the sagittal plane.
- `margin` is `1 − |com − centre| / halfWidth`: **1 dead centre, 0 on an edge, negative outside**
  — at which point `stable` is false and the machine is falling over, which the components draw
  rather than hide.
- `loads` is the share of the standing weight at each contact. Two constraints fix it — the
  loads sum to 1, and the load-weighted mean of the contact positions *is* the centre of mass —
  and the minimum-norm solution of those two is closed form:

```
load(i) = 1/n + (com − x̄)(x(i) − x̄) / Σ (x(j) − x̄)²
```

  For two contacts this is exactly the lever rule, which the tests check against the schoolbook
  answer. A load that comes out negative means that contact is being pulled off the floor — the
  centre of mass is outside the base — so it is clamped to zero and the rest renormalized, and
  `stable` already said so.

It is a **static weight distribution**, not a dynamics solve: no acceleration, no ground
reaction, no impulse, no centre of pressure. The docs `notes` say so on all three machines.

### `plantigradeStep(t, options) → StepPose`

Where one sole is in its own step, and it is the mechanism that separates this family from
every other walker in the registry:

| Fraction of stance | `pivot` | `pitch` | What it is |
|---|---|---|---|
| 0 | `heel` | `+18°` | Heel strike: the toe is still in the air |
| 0 → 0.18 | `heel` | +18° → 0 | The sole rolls down onto the floor |
| 0.18 → 0.72 | `flat` | 0 | **Flat.** The whole sole is down and the support is an interval |
| 0.72 → 1 | `toe` | 0 → −26° | The heel lifts and it rolls off the toe |
| swing | — | −26° → +18° | Carried forward on an arc, the sole swinging back toe-up for the next strike |

A digitigrade walker's foot has one state. This has four, and the middle one is the only reason
a bear can stop mid-stride and stand up.

## `robot-bear` — the rear

The brown-bear archetype and the flagship. One prop does the thing the family exists for:

**`rear`, 0 on four soles to 1 standing on two.** Taking it up:

- lifts the forelimbs off the floor, so the base of support stops being `[hind heel, fore toe]`
  and becomes `[hind heel, hind toe]` — about a fifth of its length;
- tips the whole trunk up about the hip, the way the fox's pitch does, so the withers, the
  shoulder, the neck and the head all swing;
- moves the centre of mass forward with them, *out over the front edge of a base that just got
  much shorter*.

That last consequence is the machine. Left alone the margin goes negative and the animal falls
on its face, so it does what an animal does — in two moves, and `balance` is the dial on both:

```
under = clamp(com, ±hindRoom)                        // the hind soles step in under the mass
shift = clamp(centre − com, ±SHIFT) · balance        // then the body slides over its own feet
hindRoom = √(reach² − (hip − ankle)²)                // and both are bounded by the limb's reach
```

The reach bound is the honest part: a foot the limb cannot get to is not a foot, so neither half
of the rule may ask for one. At `balance` 1 the standing pose is not a pose anybody authored — it
is wherever the arithmetic had to put the feet and the body to keep `margin` positive — and the
blueprint variant draws the base, the centre of mass and the margin so you can watch it being
kept.

**Where it bites is the middle of the rise.** Halfway up, the forelimbs have left the floor, the
base is a fifth of what it was, and the mass is still well forward: with `balance` at 0 the centre
of mass is outside the base, `stable` goes false, the support marker goes red, and the machine is
drawn toppling, because that is what that pose is. At the top it is over its feet either way —
a rear that gets all the way to vertical does not need holding, which is exactly why an animal
rushes the middle of it.

### The hump

The second derived part. A brown bear's shoulder hump is the muscle that drives the foreleg
into the ground; it is not decoration and it is not a shape that would exist on an animal whose
forelimbs carry nothing. So the hump is an output of the foreleg's load:

```
hump = HUMP_MIN + (HUMP_MAX − HUMP_MIN) · foreLoad / restingForeLoad
```

Walk it and the hump swells under each forelimb's stance and relaxes in the swing. Rear it and
the hump goes flat, because there is no load to drive. One number from `solveSupport`, spent on
the silhouette rather than on a joint, and `hump` overrides it for anyone who wants a shape
instead of a mechanism.

### Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `amble` | The signature. A **lateral-sequence** plantigrade walk — near hind and near fore a tenth of a stride apart, which is the rolling amble a bear actually has and which no diagonal walker in this set does — with every sole rolling heel to toe. |
| `rear` | Up onto the hind soles and back down, one rise per cycle, with the balance rule holding the margin through the middle of it. |
| `forage` | Head down over the floor, one forepaw raking, the hump loaded throughout. |
| `static` | Standing square on four flat soles. |

`interactive`: **drag up and down to rear it** — the bottom of the box is four feet, the top is
standing — with arrow keys stepping 10% (25% with shift) and Home/End at either end.
`onRearChange` throughout, `role="slider"` with `aria-valuetext` in percent, and released it
eases back into the behaviour rather than snapping. The head and eyes track the pointer.

## `robot-polar-bear` — the handover

Same chassis, longer body, longer neck, a smaller head carried low — the proportions are what
make it read without a single marking or a drop of white paint. And a second support system:

**`swim`, 0 on the floor to 1 afloat.** It is the same load budget, handed over:

```
legLoad(i)   = (1 − swim) · supportLoad(i)
buoyancy     = swim
```

so one prop does four things for one reason. The soles unload and the base of support stops
mattering. The body settles to a draft at the waterline — it rides *in* the surface, not on it,
and the line is drawn across the flank where the hull actually sits. The hind limbs stop
stepping and trail, because a swimming bear does not kick. And the forelimbs go from standing on
the floor to **paddling**, which is the other half of this machine.

### The stroke is a path, and the limb is solved to it

The paw traces a closed stroke — down and back through the water, up and forward through the
recovery — and the two links are solved to it:

```
paw.forward = REACH · cos(2π t)
paw.down    = DEPTH · sin(2π t) · (t in the pull ? 1 : RECOVERY)
```

An ellipse flattened on the recovery half: a real swimming stroke pulls deep and recovers
shallow. `solveChain2(shoulder, paw, [humerus, radius])` then produces the shoulder and elbow
angles, so **the articulation is an output of the stroke path**, the same way the pegasus's spar
is an output of its wingtip path — and folding the stroke is nothing more than `swim` going to
zero, at which point the same solve is pointed at the floor again.

The two forelimbs run half a cycle apart, which is the alternating crawl a polar bear swims
with.

| `behavior` | What it does |
|---|---|
| `swim` | The signature: afloat at the waterline, forelimbs alternating, hind trailing. |
| `plod` | The lateral-sequence plantigrade walk on the floor. |
| `stalk` | Low and long, the neck run right down below the shoulder — the creep. |
| `rear` | Up on the hind soles, the same transition the brown bear has. `rear` is scaled out by `swim`: nothing rears in the water. |
| `static` | Standing square. |

`interactive`: **drag up and down to work the handover** — floor at the bottom, afloat at the
top — arrows 10%, shift 25%, Home on the floor and End in the water. `onSwimChange`, `role="slider"`.

## `robot-panda` — the third contact, and the thumb

The bear that sits down to eat, and the reason that is a mechanism rather than a pose:

**`sit`, 0 standing to 1 down on the ischium.** The pelvis is rigid on the body, so where its
underside ends up is a consequence of the tilt rather than a pose: when it would go through the
floor, the animal rests on it. It then enters `solveSupport` as a **third contact with a span of
its own.**

Why that matters is visible in the numbers on the way down. Once both forepaws are up on the
stalk, the only things left on the floor are the two hind soles — and by then they have rolled
back onto their heels, which is *two points in the same place*. A point is not a base: for the
last tenth of the sit the solver reports no base at all and a margin of −1. Then the seat lands,
and there is one. That is the arithmetic statement of why an animal sits down to use its hands,
and `showSupport` draws the whole handover.

### The pseudo-thumb

The panda's sixth digit is an enlarged wrist bone that opposes the other five. It is the only
opposable grip in this registry that is not on `robot-hand`, and here it is solved rather than
drawn:

```
gap    = STALK_MAX · (1 − grip)
pad    = clamp(stalk, 0, gap)            // what the stalk actually takes up
closed = stalk >= gap                    // the thumb has met the digits
```

The **pad gap is an output**: give it a fatter stalk and the thumb rides further open at the same
`grip`, and the digits splay to take it. Close the grip on nothing and the pads meet. The stalk
itself is a real IK target — both forepaws solve to it with `solveChain2` — so moving it moves
the whole forelimb chain, and when it comes within reach of the muzzle the head tips to meet it.

| `behavior` | What it does |
|---|---|
| `feed` | The signature: sits, closes the thumb on the stalk, brings it up to the muzzle and works the jaw, then lets it back down. |
| `sit` | Down on the seat, both forelimbs free and nothing in them. |
| `amble` | The lateral-sequence plantigrade walk, on all fours. |
| `static` | Standing square. |

`interactive`: **the pointer is the stalk.** Both forepaws solve to wherever it is, the head
follows it, and a click takes a bite — `onBite`. `role="img"`, like the other machines whose
gesture is a target rather than a scalar.

## Controlled axes

Shared: `view`, `behavior`, `phase`, `speed`, `offset`, `animate`, `paused`, `variant`, `size`,
`showGround`, `showContacts`, `showSupport`, `label`, and the palette.

- `robot-bear`: `rear`, `balance`, `arch`, `crouch`, `hump`, `dig`, `ears`, `gaze`.
- `robot-polar-bear`: `swim`, `strokes`, `rear`, `balance`, `arch`, `crouch`, `neck`, `gaze`.
- `robot-panda`: `sit`, `grip`, `stalkWidth`, `stalk` (the target, a `Vec2`), `chew`, `arch`,
  `crouch`, `balance`, `gaze`.

Each is finite-checked and clamped; `NaN` renders the neutral pose. Supplying `phase` stops the
clock, everywhere, as it does across the set.

## `data-*` hooks

Shared: `data-bear` / `data-polar-bear` / `data-panda`, `data-view`, `data-solids`, `data-spine`,
`data-trunk`, `data-neck`, `data-head`, `data-ears`, `data-ear="left|right"`, `data-eyes`,
`data-muzzle`, `data-leg="fore-left|fore-right|hind-left|hind-right"`, `data-sole="<leg id>"`
carrying `data-contact-state` (`flat` / `heel` / `toe` / `airborne`), `data-joint="…"`,
`data-ground`, `data-contact`, and `data-support` carrying `data-stable`, `data-margin` and
`data-base` with `data-com` inside it.

Per machine: the bear adds `data-hump` and `data-rear`; the polar bear adds `data-waterline`,
`data-stroke="left|right"`, `data-swim` and `data-buoyancy`; the panda adds `data-seat` (with
`data-down`), `data-thumb="left|right"`, `data-stalk`, `data-jaw`, `data-sit` and `data-grip`.

## Views

Modelled once in the animal's own frame and projected through `robotCamera`. Profile is native
for all three. Off-axis a `data-solids` group supplies the width a single elevation cannot: the
trunk as one extruded footprint per spine segment, the four limbs as tubes half a track either
side, and — the part that only an off-axis camera can show — **the soles as rectangles on the
floor rather than as lines**, which is the whole claim of the family made visible.

## What these are not

Illustrative kinematics with a static weight distribution on top. The sole roll, the support
interval, the margin and the beat of the walk are real and derived. The load share is a static
distribution and not a dynamics solve: no acceleration, no ground reaction force, no centre of
pressure, no impulse at footfall. The balance rule is proportional and not a controller — it has
no gain, no lag and no fall recovery; when the margin cannot be kept, the machine reports it and
draws it rather than saving itself. The polar bear's buoyancy is a prop and not a computed
displacement, and there is no hydrodynamics: the stroke makes no thrust. Fur, pelage and claws
are drawn, not solved, and none of the three travels across its frame while its feet move.

Original archetypes throughout: three plantigrade machines named for what they are — no
character, no franchise, no markings copied from anything.
