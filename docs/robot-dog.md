# The dog

A second quadruped on a solved spine, and the reason it is not a repaint of `robot-cat`:
**the cat's spine carries both leg roots, and the dog's carries only one.** A dog has no
clavicle — the shoulder blade floats on the ribcage and swings fore and aft, which is where
the reach in a trot comes from. So here the hip is still a spine joint and the shoulder is
*not*: it is the far end of a scapula that pivots on the thorax and swings with the stride.

Two more things are new to the set, and both of them are geometry rather than artwork:

- **The wag is solved across the centre plane.** Every other `solveSpine` in the registry
  bends inside the plane it is drawn in — the cat's back and the scorpion's tail in the
  sagittal plane, the manta's wing along its span. The dog's tail is solved in the
  *transverse* plane and then lifted bodily by its carriage, so the wag is perpendicular to
  the side elevation it is drawn in. It foreshortens in profile and opens out in plan,
  because that is what a wagging tail does.
- **The neck is a solved chain, not a capsule.** Two links from the withers to the poll,
  through `solveChain2`, so `nose` can put the head on the floor while the withers stay where
  the legs put them. The poll is a joint of its own — a dog carries its head at an angle to
  the neck rather than along it — so the head's pitch is a rule off `nose`, not the last
  link's direction.

No new solver, which is still the menagerie's rule: `solveSpine` twice and `solveChain2`
five times.

| | |
|---|---|
| Item | `robot-dog` |
| Native view | `profile` |
| Solvers | `spine-kinematics` (back, tail), `robot-kinematics` (`solveChain2` — four legs and the neck) |
| Barrel | Offset off the solved back: level topline, deep chest, tucked loin, sloped croup |
| Distinct from | `robot-cat`: the shoulder is on the spine there and on a swinging scapula here, the back is stiff rather than arching, and the tail wags out of the drawing plane instead of inside it. `robot-hound`: no legs at all, a drive under a skirt. `robot-quadruped`: a rigid box with four legs bolted to it. |

## The back

`solveSpine` withers-to-pelvis (`s = 0` at the withers, `s = 1` at the croup) in the sagittal
plane, and the two parameters are spent differently from the cat's:

- **`turn` is scaled to `0.22`,** half the cat's `0.42`. A dog's back does not arch; it holds
  a topline. Positive roaches it, negative hollows it into the play bow, and the range stops
  well short of a hoop on purpose. The same half-arc counter-tilt the cat uses puts the crown
  in the middle of the back instead of dropping the hindquarters, and the same rotation run
  the other way folds the croup down when it sits.
- **`amplitude` is nearly spent.** A trot is the gait a stiff back is for: the spine stays put
  and the *body* bobs, which is `altitude` on the diagonal cadence, not a travelling wave. The
  wave amplitude is left at a few percent so the loin works a little, and no more.

## The shoulder

The scapula pivots at a point on the thorax, `0.12` of the way down the solved back and offset
along its normal, and swings about that pivot with its own leg's stride phase. Its far end is
the shoulder joint, and the humerus and radius are solved from there to the carpus with
`solveChain2`; a rigid pastern carries the carpus to the paw. So the fore leg's root travels
fore and aft under the body while the hind leg's root is wherever the spine puts it — one leg
root solved, one carried, which is the anatomy.

The swing angle is a rule, not a solve: a three-link chain from the thorax to the paw has a
free parameter, and this is how it is spent, the same way the cat resolves its hock. The hind
limb is the shared digitigrade one — femur and tibia solved to the hock, metatarsus carried
below it at an angle that opens with the crouch. Link lengths are exact and an out-of-reach
target clamps, the way every chain in the registry does.

## The tail

Solved in the transverse plane: the serpenoid `turn` is the wag and the travelling wave is the
whip that trails behind it, so the tip lags the base instead of swinging rigidly. The whole
solved curve is then rotated bodily about the animal's lateral axis by the carriage angle,
which is a rigid rotation and therefore preserves the link lengths exactly. Carriage is a
straight line; the curve in it is lateral. In the side elevation the tail foreshortens as it
swings — that is the projection telling the truth, not a dropped frame — and the plan and
isometric cameras show the arc whole.

## Behaviour and interaction

| `behavior` | What it does |
|---|---|
| `trot` | Diagonal pairs at duty 0.5 with a suspension bob, nose level, tail up and swinging |
| `sniff` | Slow walk with the forequarters down, the neck run out to the floor and the head casting side to side |
| `sit` | Croup folded to the ground, forelegs straight, tail sweeping the floor behind |
| `alert` | The point: level back, one forefoot lifted and tucked, tail straight out, ears full forward |
| `static` | Still |

`interactive`: the head, ears and eyes track the pointer, the wag picks up while it is
watched, and a click barks — `onBark`, a head lift, a jaw, an ear flick and a short bounce
off the forehand.

## Controlled axes

`arch`, `crouch`, `tail` (carriage), `wag` (lateral swing, −1 to 1), `nose`, `ears`, `gaze`,
and `phase` for the cycle. Supplying `phase` stops the clock, the way it does everywhere else.
Each is finite-checked and clamped; a `NaN` renders the neutral pose.

## `data-*` hooks

`data-dog`, `data-view`, `data-solids`, `data-spine` (the back path), `data-trunk`,
`data-tail`, `data-neck`, `data-head`, `data-jaw`, `data-ear="left|right"`, `data-eyes`,
`data-scapula="left|right"`,
`data-leg="fore-left|fore-right|hind-left|hind-right"`, `data-joint="…"`, `data-joints`,
`data-contact`, `data-ground`.

## Views

Modelled once and projected. The profile drawing is the native one, and even there the tail
goes through the camera, because its motion is out of that plane. Plan gets its own anchor in
the frame: nose to tail tip is most of the frame's height once the camera is overhead, so the
floor line the two elevations stand on is the wrong place to hang the drawing from. Off-axis a `data-solids`
group gives the machine the width a single elevation cannot say: the four legs as tubes at
half a track either side, the trunk as one extruded footprint per spine segment so the topline
survives the projection, the skull as a solid, and the tail as its true 3D polyline.

## What it is not

Illustrative trajectories, the same caveat the rest of the menagerie carries. No balance, no
ground reaction, no impulse in the bounce, and the body does not travel across the frame while
the feet walk. The ears, the jaw and the tail's plates are drawn, not solved.

Original archetype: a four-legged robot with a floating shoulder, named for its job.
