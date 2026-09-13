# The cat

One animal, and the reason it is worth adding to a menagerie that already has a walker, a
jumper and a plodder: **it is the first machine in the set whose leg roots are carried by a
solved spine.** Everything else with legs bolts them to a rigid body. `robot-quadruped` hangs
four legs off a box; `robot-turtle` hangs four off a carapace; `robot-ant` articulates three
body sections but still plants its hips on them. The cat's shoulder *is* spine joint 0 and its
hip *is* the last spine joint, so arching the back moves both leg roots and the legs have to
answer for it.

No new solver, which is the menagerie's rule. `solveSpine` twice — once for the back, once for
the tail — and `solveChain2` four times, once per leg.

| | |
|---|---|
| Item | `robot-cat` |
| Native view | `profile` |
| Solvers | `spine-kinematics` (back, tail), `robot-kinematics` (`solveChain2`, four legs) |
| Barrel | Offset off the solved spine, a different profile each side: level back, deep chest, tucked waist, heavy rump |
| Distinct from | `robot-quadruped`: a rigid body with four legs under it. Here the body is the mechanism. |

## The back

`solveSpine` runs nose-to-tail from the shoulder (`s = 0`) to the pelvis (`s = 1`) in the
sagittal plane, and two of its parameters carry the whole animal:

- **`turn` is the arch.** A constant curvature over the body is exactly a cat's back: positive
  bows it up into the startle arch, negative hollows it into the stretch. The prop is scaled to
  `0.42` of the solver's range, because a full half-circle over a 52-unit back is a hoop, not a
  cat. The solver's arc starts level at the nose and curves away from there, so the whole chain
  is then turned back by **half its own arc**: that puts the crown in the middle of the back
  with both ends level, instead of bowing the shoulders and dropping the hindquarters. The same
  rotation, run the other way, is what drops the rear onto its haunches when it sits.
- **`amplitude` at `waves: 0.6` is the bound.** One flex-and-extend travelling down the body per
  stride, which is what a galloping cat's spine does and what a walking one's does not. `prowl`
  runs it near zero; `pounce` spends it.

The shoulder is placed by `crouch`; the pelvis is wherever the solved back puts it. That is the
point — you do not get to place both ends.

## The legs

Each leg is `solveChain2` from its spine-carried root to a target that a footfall cycle slides
along the ground. The forelimb is scapula + forearm to the wrist, with a rigid pastern to the
paw. The hind limb is the cat-shaped one: femur + tibia solved to the **hock**, and the
metatarsus carried from the hock down to the paw at an angle that opens with `crouch`.

The hock angle is a rule, not a solve — a three-link chain hip-to-paw has one free parameter
and this is how it is spent, resolved explicitly instead of letting FABRIK pick a different
answer every frame. Femur and tibia lengths are exact, and an out-of-reach target clamps the
way every chain in the registry does. The docs `notes` say which half is solved.

## Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `prowl` | Low stalk: `crouch` held, a lateral-sequence walk, ears forward, tail low and sweeping |
| `pounce` | Load, wiggle, launch, land: the back flexes, the hind legs extend, the whole animal leaves the ground and absorbs |
| `arch` | The startle: curvature at its limit, legs stiff, tail up, ears flat back, breathing |
| `sit` | Haunches folded to the ground, forelegs straight, tail curled forward, ears working |
| `static` | Still |

`interactive`: the head, ears and eyes track the pointer, and a click pounces — `onPounce`.

## Controlled axes

`arch`, `crouch`, `tail`, `ears`, `gaze`, and `phase` for the cycle. Supplying `phase` stops the
clock, the way it does everywhere else. Each is finite-checked and clamped; a `NaN` renders the
neutral pose.

## `data-*` hooks

`data-cat`, `data-view`, `data-solids`, `data-spine` (the back path), `data-trunk`,
`data-tail`, `data-head`, `data-ear="left|right"`, `data-eyes`,
`data-leg="fore-left|fore-right|hind-left|hind-right"`, `data-joint="…"`, `data-joints`,
`data-contact`, `data-ground`.

## Views

Modelled once and projected. The profile drawing is the native one; off-axis a `data-solids`
group gives it the width a single elevation cannot say — the four legs as tubes at half a track
either side, the trunk as one extruded footprint per spine segment so the arch survives the
projection, and the skull as a solid.

## What it is not

Illustrative trajectories, the same caveat the rest of the menagerie carries. No balance, no
ground reaction, no righting reflex, and the body does not travel across the frame while the
feet walk. The ears, whiskers and the tail's plume are drawn, not solved.

Original archetype: a quadruped robot with a flexible back, named for its job.
