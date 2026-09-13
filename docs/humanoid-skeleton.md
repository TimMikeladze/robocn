# The humanoid skeleton

Five machines and two solvers. The set already had a hand; it had no arm that was an arm, no
leg, no torso, and nothing to hang them on. This is the humanoid frame — the parts a walking
machine is assembled from, and the assembled machine.

It also rebuilds `robot-hand` on a real solver, which is where the family started: the hand
was the one machine in the set whose docs carried an apology.

## What ships

| Item | Mechanism | Solver | Native view |
|---|---|---|---|
| `hand-kinematics` | lib — five digits, saddle-jointed thumb | — | — |
| `skeleton-kinematics` | lib — biped stride, spine, foot roll | `hand` for the hands | — |
| `robot-hand` | five digits, abduction, opposition, wrist | `hand` | `front` |
| `robot-foot` | ankle, midfoot, toe hinge, sole load path | `skeleton` | `profile` |
| `robot-leg` | hip–knee–ankle solved to a foot target, strut actuators | `skeleton` | `profile` |
| `robot-torso` | pelvis, lumbar column, rib hoops, shoulder yokes | `skeleton` | `front` |
| `robot-skeleton` | the whole biped, walking | `skeleton` + `hand` | `front` |

Naming: `robot-skeleton` is a skeleton, not shadcn's `skeleton` loading placeholder. It
installs to `@ui/robot-skeleton.tsx` and collides with nothing, but the docs page says so
out loud, because "add skeleton" means two different things in one project.

## Why the hand was rebuilt rather than extended

The old `robot-hand` posed five three-link chains forward and admitted, in its docs `notes`,
that the thumb was "the honest exception" — solved in the palm plane and lifted forward as it
closed, rather than given a joint. That caveat was correct and it was the thing that made
`pinch` a drawing rather than a mechanism: the thumb pad never actually arrived anywhere.

The thumb now has a real saddle. Two rotations at the carpometacarpal joint — **abduction**,
lifting the thumb out of the palm plane, and **opposition**, swinging that plane across the
palm — followed by a two-hinge chain solved in the rotated plane. That is what a saddle joint
is, and it is cheap: two basis vectors and the same `forwardChain2` the fingers already use.

Three things fall out of it that the old hand could not have:

- **`pinch.gap`** — the distance between the thumb pad and the index pad, in world units,
  derived from the pose. It is the number that says whether a pinch is a pinch. It is
  reported, never asserted: the hand does not claim to be holding anything.
- **`spread`** — finger abduction. The fingers fan about the palm normal, so an open hand
  can be splayed or closed up, and the grasps that need a narrow hand (`hook`) get one.
- **`side`** — a hand is handed. One geometry, mirrored in `x`, so a left hand is the right
  hand's reflection and not a second drawing.

Grasps go from four to seven: `open`, `pinch`, `tripod`, `power`, `hook`, `point`, `lateral`.
`tripod` and `lateral` are the two that only exist once the thumb opposes — a three-digit
pad grip and a key grip across the side of the index — so they are the proof the joint is
real.

## The solvers

### `src/lib/robocn/hand.ts` — `hand-kinematics`

```ts
solveHand(options): HandPose          // five digits in hand-local 3D, palm, wrist, pinch
graspProfile(grasp): number[]         // per-digit closure a named grip asks for
handGoal(behavior, clock)             // the closure loop
handRipple(clock, digit)              // one digit's place in the wave
```

Hand-local axes: `x` across the palm toward the thumb, `y` up the hand from wrist to
fingertip, `z` out of the palm toward the reader. The wrist sits at the origin. Everything a
component draws is a point in that frame, so the four camera views are one projection of one
model.

Each finger is still a three-link chain posed forward — proximal, middle, distal — but now in
a plane that is itself rotated about the palm normal by the finger's abduction angle. The
thumb's plane is rotated twice, as above. `wristPitch` and `wristYaw` rotate the whole hand
about the wrist, after the digits are solved, so a flexed wrist does not change a grasp.

Invariants the tests hold it to: phalanx lengths are preserved at every closure and every
spread; a full `pinch` brings the thumb pad and index pad closer than an `open` hand does;
`side: "left"` is the exact mirror of `side: "right"`; a `NaN` anywhere produces the neutral
open pose rather than a `NaN` coordinate.

### `src/lib/robocn/skeleton.ts` — `skeleton-kinematics`

```ts
solveSkeleton(options): SkeletonPose   // pelvis, spine, head, two arms, two legs
solveLeg(hip, foot, femur, tibia)      // the sagittal two-link leg, knee forward
strideCycle(gait, t, options)          // one leg's foot target and contact at cycle time t
footRoll(t, gait)                      // ankle angle and sole contact through a stance
spineCurve(options)                    // vertebra centres from sacrum to shoulder line
defaultProportions                     // the frame every component starts from
```

World axes: `x` the machine's right, `y` up, `z` behind it — so it faces `-z`, which is the
`profile` camera's `+x`. The floor is `y = 0`.

The stride is worked in the **body frame**: the pelvis stays at `x = 0` and the feet travel
under it, which is how a treadmill and a walk cycle are the same drawing. Per leg, at cycle
time `t` with duty factor `d`:

- **stance**, `t < d` — the foot is planted and slides from `+stride/2` to `−stride/2`;
- **swing**, `t ≥ d` — the foot arcs back to `+stride/2` and lifts by `lift·sin(πs)`.

`run` is `stand`/`walk` with a duty factor below `0.5`, which is the whole difference: below
a half, the two stance windows stop overlapping and there are moments with no foot down.
`pose.grounded` reports them rather than pretending they do not happen.

**Foot roll is the part worth getting right.** A foot does not arrive flat. Through a stance
the ankle runs dorsiflexed (heel down, toes up) at contact, flat through mid-stance, and
plantarflexed at toe-off with the heel lifted off the sole line. `footRoll` returns that
angle and the fraction of the sole actually down, and `robot-foot` is nothing but that
function with a machine drawn around it.

The spine is a chain of equal links from the sacrum to the shoulder line, each carrying
`lean/n` degrees of pitch plus a fixed lordotic shape, then rotated about `y` by `twist·u` so
the shoulders counter-rotate against the pelvis the way they do in a walk. Arms swing half a
cycle out of phase with the same-side leg, with the elbow breaking backward.

What none of it is: there is no balance, no centre of mass, no ground reaction, no dynamics.
The pelvis height is a number someone typed, not a number that fell out of anything. Every
docs page says so.

## The shared contract

Palette, size, the four variants, the four views, `behavior`/`speed`/`phase`/`paused`, and
`interactive` — as everywhere else in the set. Per machine:

| Machine | `behavior` | Grabbed |
|---|---|---|
| `robot-hand` | `grip`, `wave`, `static` | Drag to close; click steps the grasp |
| `robot-foot` | `step`, `rock`, `static` | Drag to roll heel-to-toe |
| `robot-leg` | `stride`, `squat`, `kick`, `static` | Drag the foot; the leg solves to it |
| `robot-torso` | `breathe`, `twist`, `static` | Drag to lean and twist |
| `robot-skeleton` | `walk`, `run`, `idle`, `static` | Drag to scrub the gait |

`data-*` hooks, which are API:

- hand — `data-hand`, `data-wrist`, `data-palm`, `data-digit="index"`, `data-phalanx="index-1"`, `data-pad="thumb"`
- foot — `data-foot`, `data-ankle`, `data-sole`, `data-toe`, `data-heel`, `data-pad="heel|ball|toe"`
- leg — `data-leg`, `data-hip`, `data-femur`, `data-knee`, `data-tibia`, `data-ankle`, `data-actuator="hip|knee"`
- torso — `data-torso`, `data-pelvis`, `data-spine`, `data-vertebra="3"`, `data-rib="2"`, `data-sternum`, `data-shoulder="left"`, `data-neck`
- skeleton — `data-skeleton`, `data-skull`, `data-ribcage`, `data-pelvis`, `data-arm="left"`, `data-leg="right"`, `data-hand="left"`, `data-foot="right"`

## Originality

A generic articulated frame: yokes, hinges, strut actuators, plated rib hoops. No franchise
endoskeleton, no character, no paint scheme, no skull markings. The skull is a sensor housing
with an optic bar, not a face — `robot-face` is the machine that has a face.

## Integration

Each of the five UI items and both libs gets: a `registry.json` entry with every robocn
import declared, a `docs.ts` entry, a demo reaching every axis, a catalogue card with a posed
still, a README row, and tests. `docs/spec.md`'s item table grows by seven rows.
