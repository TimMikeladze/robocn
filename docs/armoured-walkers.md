# Armoured walkers — the machines that carry their mass high

Two machines and one solver, on an axis nothing in the set has yet: **a hull carried well
above its hips**, and the attitude that costs.

| Item | Type | What it is |
|---|---|---|
| `walker-kinematics` | lib | Two or four legs on a rectangular hip base; a load schedule, the hull attitude that schedule demands, and the support polygon it has to stay inside. |
| `scout-walker` | ui | Two-legged reconnaissance walker: a yawing cab pod on a hip yoke, on legs that break backward. |
| `siege-walker` | ui | Four-legged armoured transport walker: a long hull on four columnar legs, with a solved neck. |

## What is actually new here

Every other walker in the registry moves its **body** to stay balanced. `tripod-kinematics`
is the clearest case: the hips slide over the feet, and the sway they may slide is whatever
leg reach is left over. A stubby survey droid can do that because its mass sits on top of the
hips, near enough.

These two cannot. Their mass is a hull a long way **above** the hip line, and a hull bolted to
its hips does not slide sideways — it **rolls**. So the relation the whole family is built on
is:

```
lateral offset of the mass = hull · sin(roll)
fore-aft offset            = hull · sin(pitch)
```

Read backwards, which is how the solver runs it: the load schedule says where the centre of
mass has to be, and the attitude that puts it there is `asin(offset / hull)`. Roll and pitch
are **outputs**, not inputs, and they run out — past the roll stop the mass simply cannot get
over the foot, the centre of mass leaves the support polygon, and `margin` goes negative.

That single relation is what separates the two machines, and it is arithmetic rather than
styling:

- The **biped** has a support base of one foot through most of the cycle. To lift a foot it
  must first get its mass over the *other* one, a full half hip-width away, so it rolls hard
  every step. Watch it head-on and the rolling **is** the walk.
- The **quadruped** always has three feet down in its walk, so the demanded mass position
  barely leaves the middle of a wide rectangle and the hull stays near level. Ask it for
  `pace` — the two legs of a side swinging together — and the rectangle collapses to a line
  down one flank, and a machine the size of a building has to roll like the biped. Same
  solver, same numbers, different footfall order.

Both things fall out of the load-weighted mean of the contacts. Nothing is animated to look
heavy.

## The shared contract

`solveWalker({ legs: 2 | 4, ... })` — one solver, both machines:

- **Footfall.** Per-leg phase offsets and a duty factor per gait. `stand` (duty 1), and then
  per leg count: the biped gets `walk` (duty 0.62, a real double-support overlap) and `stride`
  (duty 0.46, which has a flight phase — both feet off, which it reports rather than hides).
  The quadruped gets `walk` (lateral sequence, duty 0.78, never fewer than three feet down),
  `creep` (duty 0.9) and `pace` (ipsilateral pairs, duty 0.56). A gait the leg count does not
  have falls back to `stand` rather than drawing nonsense.
- **Load.** Handed over on a smoothstep ramp inside the overlap the duty buys; the loads sum
  to exactly one body whenever anything is down.
- **Attitude.** Roll and pitch from the relation above, each clamped to its own stop. `lean`
  adds to the demand before the clamp, so a person can push the machine past what it can hold.
- **Hips.** Rolling about the fore-aft axis through the hip centre drops the hip on the low
  side and lifts the other — so the legs are solved from hips that have *moved*, and the
  crouch on the loaded side is geometry rather than a drawn pose. Pitch does the same along
  the hull.
- **Legs.** Femur and tibia solved as a two-link chain in each leg's own vertical plane, from
  the moved hip to the foot. Knees break backward (`bend: "down"`), which is what makes these
  read as walkers rather than as furniture.
- **Margin.** Signed distance from the achieved centre of mass to the edge of the support
  polygon, over the convex hull of whatever feet are down: positive inside, zero at best on a
  segment, negative outside.

Illustrative where it has to be: the load ramp is a schedule and not a ground-reaction solve;
there is no mass, inertia, angular momentum or overturning moment anywhere. A negative margin
says the machine could not hold that pose **standing still**. In particular the model says a
higher hull needs *less* roll for the same lateral move, which is true of the static geometry
and says nothing about what a tall machine does dynamically. The docs say so on both pages.

## The machines

**`scout-walker`** — native view `front`, because the roll is the mechanism and the roll is
what a front elevation shows. A cab pod that yaws to the pointer, two chin blisters, a hip
yoke across the top of the legs, thigh and shin boxes on the solved chain, and a footplate
that stays flat on the floor. Behaviours: `patrol`, `advance`, `watch`, `static`.

**`siege-walker`** — native view `profile`, because a long hull is a side elevation. Hull,
flank plating, four columnar legs at the corners of a long rectangle, a segmented neck solved
to a head that tracks the pointer, and a chin pod. Behaviours: `march`, `haul`, `halt`,
`static`.

Both take the full contract: four views through `robotCamera`, four variants as paint only,
palette roles throughout, `interactive` drag and arrow keys pushing the hull attitude with
`onLeanChange`, `showSupport` drawing the polygon, the loaded feet sized by share and the
centre of mass, and a warning lamp that lights off the solver's own `stable` flag rather than
off a prop.

## Originality

Science-fiction archetypes, named for the job: a two-legged scout and a four-legged siege
transport. No franchise name, insignia, paint scheme, silhouette tracing or character marking
appears in the components, the demos, the labels or the docs. The default palette is the
theme's.
