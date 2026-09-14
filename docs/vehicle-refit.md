# Refitting the road vehicles

`robot-car`, `transit-bus` and `tanker-truck` all rendered, and all three read as a slab with
wheels stuck on. This note is the record of why they did, and what the refit changes. The
family note — what each machine is *for* — stays `docs/vehicle-robots.md`.

## What was actually wrong

**`slabPath` is a convex hull.** Every body in the three machines was one call to it, so every
concavity a road vehicle has — a wheel arch, the step from bonnet to screen, a bus skirt, the
gap under a tanker barrel — was filled in before it was drawn. That is the single reason the
silhouettes read as bars of soap. A hull can only ever be a lump; a vehicle is a set of lumps.

**Nothing related the wheels to the body.** The wheels stood on the road at ±half-track and
the body was a separate extrusion that happened to pass over them. No arch, no fender, no
mudguard, nothing they sat *in* — so they read as castors under a box.

**Proportions were off in the one axis nobody looks at.** The car was 215 long and 60 wide, a
3.6:1 plan that no car has; a real saloon is 2.4:1. So the profile was passable and the plan
was a phone case. The bus was 4.3:1 where an articulated bus is nearer 6:1.

**The tanker was in a different idiom entirely.** It predates `vehicle.ts`: no Ackermann, no
solved hitch, no suspension, wheels drawn as flat discs in a fixed profile plane rather than as
solids. Its `hitch` was a free prop, so the one thing the component claimed — "the yaw is real
in world space" — was true of the barrel and false of everything else: the trailer bogie
detached from the trailer as soon as it turned.

**The motion was thin.** The bus had no road and no wheel rotation at all. The tanker's only
loop was a cargo number, and its "roll" rotated a single line inside each wheel. Both looked
frozen next to the car, which at least heaved on a road profile.

## The refit

### Bodies are assemblies of convex parts, not one hull

Every machine gets its body decomposed so the gaps are real geometry rather than paint:

| Machine | Parts, low to high |
|---|---|
| car | rear valance · rocker · door skin · front valance — four blocks with the two arch gaps left between them · an arch band at each wheel station, cut into segments so the mouth stays open · the upper body over the lot · the greenhouse · the roof sensor · the nose and tail kit, drawn after the wheels because in front elevation they are the nearest things on the car |
| bus | a dark underfloor plate the length of each section · skirt runs between the arches · the body from the arch line to the roof · window bays with pillars between them · plug doors · roof pods · the concertina |
| truck | chassis rail · fifth wheel · cab · roof fairing · stacks · the barrel, whose beam is the circle at that height · catwalk and manlids · bogie frame and mudguard · landing legs · underrun bar · discharge cabinet |

Each part is convex on its own, so its hull *is* its silhouette; the arch between two of them
is a hole in the drawing because nothing was ever asked to cover it. The underfloor plate is
what the bus's arches are a hole *into* — without it they are holes into the page.

### Beams take the station, not just the height

`beam(y)` became `beam(point)`. That is what lets a fender stand proud over a wheel while the
door skin behind it tucks in, and it is the difference between a plan view that reads as a car
and one that reads as a rounded rectangle.

### Wheels are wheels

The same wheel in all three: tyre (dark solid), rim (metal solid inside it), and `n` spokes
that **turn with the road**, in the wheel's own steered plane. Road speed already existed on
the car; the bus and the truck now have one too, so every wheel in the family rotates and every
one of them turns about the same axle the arch is drawn around. The truck's driven and trailer
axles are drawn as the duals they are — nothing else makes a plan view read as a lorry.

### Proportions come from the real vehicle

Set once per machine, at the top of the file, in metres, with the drawing unit derived:

| | length | drawn as | so a unit is | width | height | wheel Ø |
|---|---|---|---|---|---|---|
| car | 4.4 m | 215 units | 20.5 mm | 82 u · 1.68 m | 66 u · 1.35 m (1.54 m over the sensor) | 34 u · 0.70 m |
| bus | 18.0 m | 256 units | 70 mm | 44 u · 3.09 m | 50 u · 3.52 m | 18 u · 1.27 m |
| truck | 16.5 m | 300 units | 55 mm | 46 u · 2.53 m | 71 u · 3.90 m | 20 u · 1.10 m |

The car and the truck are to scale in all three axes. The **bus is drawn 1.2× wide** — 3.1 m
against a true 2.55 — because a 7:1 plan in a 2:1 frame is a hairline. Stated here rather than
silently: its two elevations are to scale and its plan is a fifth too broad.

### The tanker joins the family

Rewritten against `vehicle.ts` in the same idiom as the other two — nose toward +x, world
through `rollPoint`, wheels through `wheelSolid`. It keeps a flat road: a tractor and a
semitrailer pitch independently over a bump, and `axleRide` is a rigid body on N axles, so
putting the two units on one is the sort of thing this set does not do:

- `steer` is new and is the input. The steer axle takes `ackermann()`.
- `hitch` becomes an **override**. Left alone, the trailer's yaw is `hitchAngle()` off the
  steer — kingpin just ahead of the drive tandem, 150 units of trailer wheelbase behind it — so
  the trailer off-tracks inside the tractor's line the way a semi does. Supplying `hitch` pins
  it, which is what the existing demo and tests drive.
- The bogies now ride the same yaw as the barrel, so a turn keeps the trailer together.
- `steer` is clamped to ±26°, because a wheelbase this long has no steady articulation past
  it: the kingpin's circle closes inside the trailer's own wheelbase and the truck is
  jackknifed. That is the solver telling the truth, not a rendering limit — fifteen degrees of
  rack is already forty of articulation, which is why `manoeuvre` only uses fifteen.

`level`, `compartments`, the rear-first discharge order and the cabinet gauges are unchanged:
they were the honest part.

### Behaviours

Each stays a pure function of the clock, sampled in the tests.

| Machine | Behaviour | What moves |
|---|---|---|
| car | `cruise` `slalom` `park` | steering, and therefore both wheel angles, the roll and the turn radius |
| bus | `route` `service` | steering and the hitch; `service` adds the kneel and the doors, and stops the wheels while it stands |
| truck | `haul` `discharge` `manoeuvre` | `haul` rolls a full barrel down the road; `discharge` is the delivery round, standing still; `manoeuvre` is the one that steers, so the solved hitch has something to solve |

`manoeuvre` is new. The tanker had no behaviour that moved the mechanism the component is
named for.

## What is still illustrated, and says so

- `roadProfile` is two sines, not a measured surface. Unchanged.
- The car's roll is a roll gradient — 5.5° per g, a saloon on road springs — applied to the
  lateral acceleration `coordinatedBank` implies, thrown outward. The acceleration is capped at
  0.6 g, on the grounds that a car at a real rack angle has slowed for the corner; without the
  cap it runs to several g and the body sits on its stop through a whole slalom instead of
  following the steering. No roll stiffness, no weight transfer.
- The truck's articulation is the steady state, not an integrated manoeuvre — so a truck that
  has been round a corner comes out of it straight, with no swept path behind it.
- Nothing integrates a path. No machine here accumulates where it has driven.

## Verification

The existing vehicle and oil-field suites keep passing unchanged — they assert mechanism, not
artwork, which is the point of them. Added: the tanker's solved hitch (zero straight ahead,
signed with the steer, pinned by the override), a wheel that turns with road speed on all
three, and the new behaviour sampler. Then the view snapshots are re-recorded, because the
drawing is deliberately different, and the three machines are driven in a browser through
every behaviour, variant and view at desktop and 390 px.
