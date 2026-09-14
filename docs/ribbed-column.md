# The ribbed column

`robot-cactus`, and the solver under it: `cactus-geometry`.

## What is new here

The set already had chains (`kinematics.ts`), travelling waves (`spine.ts`) and bodies of
revolution (`produce.ts`). What it did not have is a **limb with no joints** — a continuum
member that bends along its whole length and has to stay exactly as long bent as it was
straight. That is what a cactus arm is, and it is the same thing a soft manipulator is.

The second new thing is a **surface whose detail is part of the solve**. `produce.ts` places
studs on a body of revolution about a fixed vertical axis. A cactus is ribbed *along a
centreline that bends*, so the ribs, the areoles and the spines all have to be written in the
frame each station of that centreline carries, or they come off the shape the moment it moves.

## The solver

```ts
solveCactusLimb({ length, segments, base, bearing, emergence, sweep, elbow, spread, radius })
```

The tangent angle off vertical is

```
θ(s) = emergence − sweep · W(s)
```

where `W` is the normalised integral of a bell centred on `elbow` with width `spread`. The
joints are then walked off `θ` at each **link's midpoint**, one fixed link at a time.

Three consequences, and all three are the reason it is a solver and not a curve:

- **Length is exact at every bend.** `count × link === length`, by construction, because the
  angle is integrated and the positions are walked — never displaced.
- **`sweep === emergence` ends the limb vertical**, whatever the elbow or the spread, because
  `W(1) = 1`. That is the whole of "lift and curl" in one number.
- **The bend goes where the elbow says.** A column is `emergence 0`, a small negative sweep and
  a wide spread — it leans progressively, nothing at the soil and all of it by the crown. An
  arm is `emergence 88°`, a sweep that takes most of that back, and a narrow spread — it leaves
  the trunk flat, turns hard at one place, and runs up parallel to it. One mechanism, two
  settings, no second drawing.

Because a limb bends in exactly one vertical plane, its `binormal` is **constant along it**.
The frame is therefore already parallel-transported and a rib crest cannot drift round the
limb between one station and the next.

## What the frame carries

| Function | What it is |
|---|---|
| `ribFactor(angle, ribs, depth)` | The fraction of the radius the skin keeps at a roll angle. Crests are exactly 1, at every `360/ribs`. |
| `limbPoint(station, angle, ribs)` | A point on the skin. `limbRing` is the closed section; `ribCrest` is one crest run the length of the limb — a **line on the solved surface**, not a stripe drawn on a silhouette. |
| `areoleSites(limb, …)` | Pads on the crests, evenly spaced in station and staggered by half a step on alternate ribs, so the pattern is a lattice rather than a set of rings. |
| `skinNormal(limb, s, angle)` | The outward normal **with the taper leant into**: `radial − (dr/ds)·tangent`. It is what makes the pads near a tapering crown point up and out instead of sideways, which is the whole read of a crown of spines. |
| `spineFan(areole, …)` | Needles on a cone about that normal. Every needle exactly `length` long at every splay, and the basis round the normal is taken from the world's vertical, so a fan is deterministic rather than seeded. |
| `corollaPetals(count, station, …)` | Rigid blades hinged on a ring in the tip station's own plane. Shutting the flower into a bud shortens the **silhouette**, not the petal. |
| `rollToward(station, azimuth)` | The roll angle on a limb that faces a world azimuth — how an arm finds its seat on the column. |

Azimuth 0 faces the `front` camera (`−z`), matching `phyllotaxis.ts`, not `produce.ts`'s
`+z`. The header of `cactus.ts` says so.

## The component

One geometry, four cameras. The silhouette of a limb is **one path**: at every section, the two
projected points furthest either side of the direction the centreline runs in on screen, walked
up one side and back down the other. That is what keeps a bent column free of the seams that a
per-segment hull leaves, and it means every variant paints the limb as one solid. `blueprint`
and `wire` additionally draw the sections themselves, because a construction mesh is what those
two registers are for.

Rib crests on the far side of a limb are culled against the centreline's depth. Areoles are
culled a little **past** the silhouette (`depth > −0.2`), so the needles at the edge of a limb
are there rather than stopping at the outline.

### The one number

`bloom`, 0 to 1, and everything the machine does with its body is downstream of it: the arms
lift (`emergence` falls) and curl (`sweep` rises), and the corolla's pitch falls from `76°` to
`32°`. `cactusArmPose(bloom)` is that mapping, exported and tested.

The corolla is a **funnel, not a disc**, and that is a drawing decision with a reason. Opening
the rigid blades to flat would be the obvious thing, and it is wrong here: the `front` camera
sits ten degrees above horizontal, so a flat corolla projects to a line and the machine's own
native view loses the one event it has. Stopping at `32°` keeps a bowl with real height, so the
silhouette flips from a tall narrow bud to a wide shallow cup and the change reads at `md` from
every camera. The tube under it barely moves (`88°` to `78°`), which keeps the flower standing
clear of the crown's spines instead of opening down into them.

### Attention

The lean is the one thing that is not a pose. `cactusWake(look)` turns the pointer into a lean
in degrees — sideways from where the pointer is across the drawing, and a pull toward the
camera that grows as the pointer comes down the frame, so a machine leaning at a hand near its
pot looks different from one standing up under a hand held high. With nothing watching,
`cactusSway(clock, amount)` runs two incommensurate rates so it drifts round rather than
ticking back and forth on one axis. The two add, and the sum is one bearing and one magnitude
handed to the column's `sweep`. The arms and the flower are **carried** by that bend rather
than aimed separately, which is why they cannot disagree with it.

The ribs are anchored to the world (`roll: -bearing`) rather than to the bend plane. Without
that they would spin round the column every time it changed its mind about which way to lean.

### Behaviours

| `behavior` | What it does |
|---|---|
| `breathe` | Shut and idling: the wander is the motion and the bud only breathes. |
| `flower` | The whole flowering — open over a third of the cycle, hold it, shut again. |
| `reach` | The arms working, with the corolla never more than ajar. |
| `static` | Half open, half lifted: a still. |

### `data-*`

`data-frame` / `data-view`; `data-pot`, `data-rim`, `data-soil`; `data-limb="column" | "left" |
"right" | "rear" | "fore"`, each holding `data-skin`, `data-rib={n}`, `data-section={n}` (mesh
variants only) and `data-areole={n}`; `data-flower` with `data-open`, `data-petal={n}` and
`data-stamen`; `data-lamp`. `data-frame` also carries `data-lean="<degrees> <bearing>"`, which
is the one attribute that moves with the pointer — the hook to assert attention against.

## What is solved and what is illustrated

**Solved:** the centreline and its exact length at every bend, the frame at every station, the
ribbed section, the rib crests, the areole lattice and its stagger, the skin normal with taper,
the spine fans' lengths and splay, the petals' length at every pitch, the arms' seats on the
column, the silhouette, the projection, and the facing culls on crests and pads.

**Illustrated:** the pot, the soil, the stamen speckle, the status lamp, and the lean line the
blueprint variant draws.

There is no botany here. Nothing grows, nothing transpires, `bloom` is a shaped number and not
a phenology, and the machine is an archetype — a potted columnar collector — not a species.
