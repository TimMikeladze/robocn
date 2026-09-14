# Tripod droid

A stubby, wide-bodied three-legged walker, and the balance solver under it.

Ships two items:

| Item | Type | What it is |
|---|---|---|
| `tripod-kinematics` | lib | Three-legged gait: a load schedule, the body position that schedule demands, and the support polygon that says whether the machine can hold it. |
| `tripod-droid` | ui | The machine: a chamfered slab body on three solved legs, two slot optics, two stub arms, and a stability readout. |

## What the reference gave

The prompt carried one image: a small, flat, wide-bodied creature — a chamfered rounded
box, two tall black rectangular eyes set high and close, a short nub sticking out each
side at mid-height, and three stubby legs in a row underneath. Nothing was traced and no
colour was sampled; what was taken is the silhouette and the proportions, as ratios of the
body width `W`:

| | ratio | world units (W = 100) |
|---|---|---|
| body height | 0.62 W | 62 |
| corner chamfer | 0.08 W | 8 |
| eye slot | 0.10 × 0.20 W | 10 × 20 |
| eye centres | ±0.16 W, 0.30 down from the top | ±16, y = 67 |
| side stub | 0.12 × 0.08 W | 12 × 8, at y = 48 |
| leg | 0.10 W wide, 0.39 W long | 10 × 24 |
| leg spacing | ±0.28 W and centre | ±28, 0 |

Colours map onto roles rather than being copied: the terracotta body is `shell`, the black
eye slots are `dark`, the lit bar inside a slot and the stability lamp are `accent`, and
the leg segments, bolts and stub arms are `metal`. The default palette stays the theme's;
the demo and the catalogue card pass nothing.

**Originality.** This is a generic sci-fi survey bug — an archetype, not a character. No
franchise name, logo, insignia or paint scheme appears in the component, the docs, the demo
labels or the `aria-label`, and the machine is named for its job. The reference image is not
committed anywhere in this repo.

### The three legs are the reading

Three stubby legs in a row is the one thing in the picture that nothing in this set already
does. Read as a machine, three legs in a row in *front elevation* is a tripod seen head-on:
two forelegs at ±30° off the beam and one hind leg on the centreline. That is the layout,
and it is why the middle leg draws slightly higher and behind in the native view.

## Why it earns its place

Every walker already here stands on an even number of legs, and every one of them keeps
half the legs planted while the other half swings — `hexapod-kinematics` calls that the
tripod gait, and with six legs it is free, because three feet are always down.

With **three** legs it is not free. Lift one and the support polygon collapses from a
triangle to a **segment**; lift two and it collapses to a point. So a three-legged walker
cannot take a step without first moving its own mass onto the line between the two feet
that stay down. That movement is the machine.

- `bear-kinematics` asks the opposite question in one dimension: given where the centre of
  mass is, what is each sole carrying? Its `solveSupport` inverts a 1-D lever rule.
- `tripod-kinematics` runs it forwards in two: given a **load schedule** — which foot is
  being unloaded, when — the centre of mass has to sit at the load-weighted mean of the
  contacts. That mean *is* the body's plan position. The gait is the schedule; the waddle is
  the consequence.

And because the body cannot slide over its hips without limit, the demanded position is
clamped to a `sway` disc. When the schedule asks for more excursion than the machine has,
the clamp bites, the centre of mass leaves the support polygon, and the reported `margin`
goes **negative**. That is the honest difference between the two travelling gaits: `creep`
stays inside the sway limit and is statically stable throughout; `amble` does not, and the
readout says so.

## The solver — `src/lib/robocn/tripod.ts`

```ts
solveTripod({ gait, phase, height, step, lift, heading, turn, sway, lean, radius, femur, tibia })
  → { gait, height, centre, yaw, legs, support, margin, stable, femur, tibia }
```

Plan coordinates follow `hexapod.ts`: **x** starboard, **y** toward the nose. Heading 0
walks toward the nose, 90 to starboard.

1. **Hips** sit at plan radius `radius` on bearings 30°, 150° and 270° — two fore, one aft —
   and they move with the body, because they are bolted to it.
2. **Feet.** Each leg has a nominal stance point out along its bearing. A scalar runs
   backwards through stance and arcs forward with ground clearance through swing, exactly as
   in `hexapod.ts`; `creep` and `amble` apply it as a translation along the heading, `pivot`
   applies the same scalar as an **angle** about the body, which is what turning on the spot
   is.
3. **Loads.** A leg's load is `1` planted and ramps smoothly to `0` across the unload window
   before lift-off and back after touchdown, then all three are normalized to sum to one.
   Duty is the gait: `creep` 2/3 (one leg off at a time), `amble` 1/2 (two legs off for a
   sixth of the cycle).
4. **Centre.** `centre = Σ load(i) · foot(i)`, clamped to the `sway` disc. This is the
   static condition — the load-weighted mean of the contacts *is* the centre of mass —
   solved for the position rather than for the loads.
5. **Margin.** Signed distance from `centre` to the boundary of the polygon of grounded
   feet: positive inside a triangle, at best zero on a segment, negative outside either.
   `stable` is `margin >= 0`.
6. **Knees** are solved, not drawn: each leg is a two-link chain in its own vertical plane,
   `solveChain2` with the horizontal hip-to-foot distance on one axis and the body height on
   the other, so femur and tibia hold their lengths in every pose. Stance radius is capped so
   a full step still lands inside the leg's reach.

Illustrative, and the docs say so: the load ramp is a chosen schedule, not a ground-reaction
solve; there is no mass, no inertia and no acceleration anywhere, so a negative margin is a
statement that the machine could not hold that pose standing still, not a simulation of it
falling over.

## The component — `src/components/ui/tripod-droid.tsx`

Native view **front**, the elevation the reference is drawn in. One geometry in world units
— **x** starboard, **y** up, **z** aft — pushed through `robotCamera(view)`:

- **Body**: three stacked solids, so the chamfer is real rather than painted. A `frustumPath`
  from the small footprint up to the big one, an `extrudedPath` of the big one, and a
  `frustumPath` back down to the small one. Correct from every camera, and it collapses to
  the tuned front silhouette at `view="front"`.
- **Face**: the eye slots, their lit bars, the brow seam, the grille and the stability lamp
  are flat rectangles on the front face at `z = -halfLength`, drawn with `slabPath`, so they
  foreshorten into the body in iso and collapse to a line in plan — which is what marks on a
  face do.
- **Legs**: capsules through the solver's projected hip, knee and foot.
- **Stub arms**: boxes on a lateral hinge at the beam, lifting on the side the body leans
  toward. Illustrated counterweights — stated in the docs `notes`; they carry no load in the
  solve.

### The axes

| Prop | Does |
|---|---|
| `gait` | `stand` `creep` `amble` `pivot`. Omit and `behavior` picks one. |
| `behavior` | `trundle` `scurry` `survey` `settle` `static` — creep along, amble along, turn on the spot, stand and breathe, stop. |
| `stride` | Controlled gait cycle, 0–1. Supplying it stops the clock. |
| `lean` | Controlled body offset over the feet, `{x, y}` in −1..1. Supplying it wins over the drag. |
| `height` `step` `lift` `heading` | Ride height, foot travel, swing clearance, travel direction. |
| `look` / `track` | Optic aim; the slots' lit bars follow the pointer. |
| `showSupport` | Draw the support polygon, the loaded feet and the centre-of-mass marker. |
| `signal` | `warning` → shell, `ready` → accent, `idle` → metal. A negative margin forces the lamp to warning whatever `signal` says, because that is the machine reporting itself. |

### Interaction

`interactive` (default on) makes the whole drawing a two-axis control: **press and drag to
push the body over its feet**. Drag far enough during a swing and the centre of mass leaves
the support segment, the margin goes negative and the lamp turns. Arrow keys nudge, `Home`
re-centres, `End` pushes to the sway limit. Release eases back into the gait's own lean
through `useEasedPoint`, rate-limited, so it returns like a servo. `role="slider"` with
`aria-valuetext` reading the stability margin.

### `data-*` hooks

`data-droid`, `data-view`, `data-body`, `data-leg="0|1|2"`, `data-foot`, `data-knee`,
`data-contact`, `data-optic="left|right"`, `data-stub="left|right"`, `data-support`,
`data-centre`, `data-lamp`.

## Integration

`registry.json` (both items), `src/lib/docs.ts` (both entries), `demos.tsx` (one bench, both
slugs), `catalogue.tsx` (a posed card each — the lib card in `blueprint` with the support
polygon showing), `README.md`, `docs/spec.md`, the tests, and the two allow-list arrays:
`droidCollection` in `scripts/__tests__/registry.test.ts` and `droidSlugs` in
`src/components/site/__tests__/docs-catalogue.test.tsx`.
