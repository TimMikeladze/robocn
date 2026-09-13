# The pylon droid

One machine, one new idea: **it hides inside its own silhouette.** Stowed, `pylon-droid` is a
sharp equilateral plate sitting flat on the ground — no legs, no head, no limbs breaking the
outline. Deployed, the same plate is standing on a tripod with its apex lifted off a lit core.
Nothing else in the set does that, and it is the whole reason this one exists.

## What ships

`pylon-droid` — a deployable survey pylon. A 124 × 107 plate, 18 deep, that splits at the
waist.

## The axis

`deploy`, 0 stowed to 1 standing, and everything is a function of it:

| At 0 | At 1 |
|---|---|
| plate flat on the ground | chassis 30 units up |
| legs folded down and inboard, knees under the waist | legs solved to feet planted at ±50 |
| aft strut lying up the back face | strut swung 152° into the third contact |
| waist shut, core hidden | cap 26 up its mast, core grille lit |

The constraint that made the geometry: **at `deploy` 0 every limb has to be inside the
triangle.** A folded two-link leg throws its knee out by nearly a whole link, so the fold had
to go *inboard*: with the hip at (34, 12) and the stowed foot at (12, 2), the 24 + 24 leg
folds with the knee at (14, 26) — well inside the hypotenuse — and one bend (`down`) serves
the whole stroke, so the knee swings out as the foot slides out and comes back under the hip
as the leg straightens. It never flips sides. The legs are drawn behind the plate, so `solid`
shows the bare triangle and `outline`/`wire` show the stowed mechanism through it, which is
what line art is for.

The aft strut is the honest part of standing a slab up: a plate has no fore-aft base, so it
swings a rigid 52-unit leg off a hinge on a rib down its back face into a tripod. Its deployed
angle is not a tuned number — it is `acos(-(16 + 30) / 52)`, the angle that puts the pad on
the ground.

## Distinctness

- `bellows-droid` has no joints and conserves volume; this one has three contacts and a
  fold-away silhouette.
- `guide-droid` hangs; this one has to solve *how to stand up* from flat.
- The set has walkers. This is not one: it stands, it does not travel, and the docs say so.

## The contract

Colour, size, the four variants, the four views, controlled-wins, `behavior` + `speed` +
`phase` + `paused`, `interactive` drag/arrows, `role="slider"`, `px()` on every computed
coordinate — all as `docs/spec.md` states.

Native view is `front`, because the plate is the machine and the plate faces you. It is
modelled once in world units (x starboard, y up from the ground, z toward the viewer) and
pushed through `robotCamera`:

- plate faces and their panel detail are planar, so they ride `camera.wall(9)` — the identity
  in front, singular in profile, which is what a plate seen edge-on is;
- the plate solid is the convex hull of its two faces projected, exact for a prism; the core
  box and the hinge rib are the same construction, and only exist off the plate's own axis;
- legs, strut, feet and mast are world points through `camera.project`, drawn as capsules
  between projected joints.

Behaviours: `deploy` (stand, hold, sit — a duty cycle), `survey` (stays up, breathing, panning),
`stow` (down and dormant, lamp ticking over), `static`. `interactive` drags the machine up and
down; arrows 10%, shift 25%, Home stows, End stands.

## `data-*` hooks

`data-pylon` `data-view` · `data-chassis` · `data-cap` · `data-core` · `data-grille` /
`data-bar` / `data-lit` · `data-mast` · `data-leg="left|right"` · `data-foot="left|right"` ·
`data-strut` · `data-strut-foot` · `data-solids` / `data-inner-solids` · `data-optic` / `data-iris` · `data-beacon`

## What is solved and what is drawn

Solved: the legs (two-link law-of-cosines, knee breaking outward, out of reach clamps rather
than fails), the strut angle, the projection.

Illustrated: the mast is a rail pair rather than a modelled screw, the pleated cable in the
waist is a curve, and there is no mass, no balance and no ground reaction anywhere — a real
pylon this shape would need its tripod much wider. The docs `notes` say so.

## Originality

A survey pylon is a genre object: a marker that walks itself to the next station. The name is
the job. No franchise, no logo, no paint scheme — an equilateral plate is a shape, and the
palette is the set's own four roles.
