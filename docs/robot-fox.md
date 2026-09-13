# The fox

A third quadruped on a solved spine, and it is not a repaint of either of the other two
because the three of them answer the same question three different ways. *What moves a leg
root?* The cat says: the back arches, and both roots move with it. The dog says: the hip is
on the spine, the shoulder is on a blade that swings on the ribcage. The fox says:
**the whole animal tips.**

That is the new axis, and it is the first one in the set — every other machine with a body on
the floor keeps that body level and bends things inside it. `pitch` rotates the entire
modelled animal about its own hip, which stays put, so the withers swing up and forward and
the forelegs have to answer for it. Rear far enough and the floor goes out of the foreleg's
reach and it folds — not because a script folds it, but because the arithmetic says it cannot
be put down.

Two more mechanisms are new, and both are geometry rather than artwork:

- **The brush is an output, not an input.** Every other tail in the registry is a driven
  parameter — the cat's carriage, the dog's wag, the scorpion's arch. The fox's carriage is
  *derived from the body's pitch and the rate the pitch is changing at*, opposing both. That
  is what a fox's brush is for, and `counterweight` is the dial between the two readings: 0
  and the behaviour carries the tail, 1 and the body does.
- **The ears triangulate.** They are the biggest ears in the set because they are the sensor.
  Each pans independently about its own vertical axis to face one point — the quarry — so the
  two axes converge, and the *disparity* between them is a real geometric number that grows
  as the quarry comes in. It is modelled in three space and projected, so plan and isometric
  show the convergence and the profile shows it foreshorten.

No new solver, which is still the menagerie's rule: `solveSpine` twice and `solveChain2` five
times.

| | |
|---|---|
| Item | `robot-fox` |
| Native view | `profile` |
| Solvers | `spine-kinematics` (back, brush), `robot-kinematics` (`solveChain2` — four legs and the neck) |
| Anchor | The **hip**, not the withers. The pitch turns about it, so it is the end that is placed. |
| Barrel | Offset off the solved back: level topline, shallow chest, long tucked loin — a low, long canid |
| Distinct from | `robot-cat`: the body is level there and arches; here it tips. Its tail is a sagittal input; here it is a sagittal output. `robot-dog`: the shoulder swings on a blade there and rides the tipping trunk here, and the tail wags across the centre plane rather than balancing in it. `robot-quadruped`: a rigid box with four legs bolted under it. |

## The pitch, and the hip it turns about

The cat and the dog both place the withers and let the solved back put the pelvis wherever it
lands. The fox does it the other way round, because that is what a rearing animal does: the
spine is solved and tilted as usual, and then the whole chain is translated so that its **last
joint lands on a fixed hip point**. The pelvis is therefore the one thing `pitch` does not
move, and everything else swings about it.

```
pitched = tilt(solveSpine(...), archTilt + pitch · 46°)
spine(i) = pitched.joints[i] − pitched.joints[last] + hip
```

`tilt` is a rigid rotation of the whole pose, tangents and all, so every link length survives
it exactly. Arch and pitch go through the same rotation — the arch half-counter-tilt the cat
and dog use to keep both ends level, plus the pitch on top of it.

The hind legs are rooted at the hip and solve to the floor, so they stay planted through a
rear. The forelegs are rooted on the tipping trunk and solve to a floor target that gets
further away as the body goes up.

**When the floor leaves reach, the limb folds.** The foreleg's target is the floor target only
while the floor is reachable; past that the target comes back in along the same line to a
fraction of the reach, so the limb draws up under the chest instead of dangling at full
stretch. The fold begins exactly at the reach limit, and how far it goes is how far past that
limit the shoulder has gone. It is a rule — a three-link limb with nowhere to stand has a free
parameter — but it is a rule keyed to the geometry rather than to the clock, and the docs
`notes` say so.

## The brush

`solveSpine` in the sagittal plane, hung off the hip, the same plane the cat's tail works in.
What is new is where its carriage comes from:

```
balance = −0.95 · pitch − clamp(0.06 · dpitch/dt)
carriage = lerp(scriptedCarriage, balance, counterweight)
```

Rear and the brush sweeps down behind; pitch over into the dive and it flies up; and the rate
term makes it lead the turn slightly rather than following it exactly, which is the difference
between a counterweight and a pendulum. The rate is taken analytically, by sampling the same
pure stance function a few milliseconds either side of now — no state carried across renders,
so it is as testable as everything else here. Supplying `pitch` as a prop stops the clock, and
a controlled pitch has no rate anyone can know, so the counterweight then works from the angle
alone.

The wave amplitude picks up with the same rate term, which is the whip in a brush that has just
been thrown.

It is a proportional rule, not an inertia tensor. There is no mass, no moment, and no
conservation of anything; it is the shape the mechanism would take, drawn honestly as a rule.

## The ears

Two dishes, each panning about its own vertical axis through its own base, both aimed at one
point. The quarry is placed in the animal's plan frame by `bearing` (across, −1..1 over ±75°)
and `range` (0 far, 1 close):

```
quarry  = (cos(75° · bearing) · r, sin(75° · bearing) · r),  r = lerp(70, 16, range)
pan(e)  = atan2(quarry.across − e.across, quarry.forward − e.forward)
disparity = pan(left) − pan(right)
```

`foxEarBearing` is exported as a pure function and returns all of it, including the disparity,
which grows as the range closes and goes to zero as it opens — that is the whole point of two
ears a fixed distance apart, and the test asserts it. Each ear is modelled as a triangular
aperture in three space and pushed through `robotCamera`, so the convergence reads in plan and
isometric and foreshortens in profile.

`ears` is the other, shared number — folded back at −1, pricked at 1 — and is the same
vocabulary the cat and the dog use.

## Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `mouse` | The signature. Stalk in low, freeze, rear onto the hind legs, pitch right over and dive nose-first, land on the forefeet and recover. `pitch` does the whole thing; the brush answers it. |
| `trot` | The straight-line canid trot: level back, narrow track, brush streaming out level behind. The one gait where the counterweight is nearly idle. |
| `listen` | Planted and still, both ears working a bearing across the frame. The one behaviour where the ears are the mechanism. |
| `curl` | Down and asleep: croup folded, nose tucked, the brush brought right round over the face. The counterweight is off — a sleeping fox is not balancing. |
| `static` | Still |

`interactive`: the eyes and the head aim track the pointer, **the pointer is the quarry** — its
x is the bearing and its height is the range, so the ears converge as it comes down the frame —
and a click dives: `onDive`.

## Controlled axes

`pitch`, `arch`, `crouch`, `tail` (carriage), `counterweight`, `ears`, `bearing`, `range`,
`gaze`, and `phase` for the cycle. Supplying `phase` stops the clock, the way it does
everywhere else. Each is finite-checked and clamped; a `NaN` renders the neutral pose.

## `data-*` hooks

`data-fox`, `data-view`, `data-solids`, `data-spine` (the back path), `data-trunk`,
`data-brush`, `data-neck`, `data-head`, `data-ears`, `data-ear="left|right"`, `data-eyes`,
`data-leg="fore-left|fore-right|hind-left|hind-right"`, `data-joint="…"`, `data-joints`,
`data-contact`, `data-ground`, `data-bearing` (the sight line, blueprint only).

## Views

Modelled once and projected. The profile drawing is the native one, and even there the ears go
through the camera, because their motion is out of that plane — the same reason the dog's tail
does. Off-axis a `data-solids` group gives the machine the width a single elevation cannot say:
the four legs as tubes at half a track either side, the trunk as one extruded footprint per
spine segment so the topline survives the tip, the skull as a solid, and the brush as a tube
that thickens before it tips.

## What it is not

Illustrative trajectories, the same caveat the rest of the menagerie carries. The counterweight
is a proportional rule and not a simulation — no mass, no moment of inertia, no conservation.
No balance, no ground reaction, no impulse in the landing, and the animal does not travel
across the frame while the feet walk. The head does not yaw to the quarry; the ears carry that,
which is the mechanism worth drawing. The muzzle, the whiskers and the brush's plates are
drawn, not solved.

Original archetype: a four-legged robot that tips its whole body and balances it with a tail,
named for its job.
