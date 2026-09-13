# Robotic animals

Five machines built on animal locomotion, drawn in the same visual language as the rest of
the set. Two pure solvers carry the motion; each component renders one of them, or its own
parametric pose, and follows the motion contract in `docs/motion-and-interaction.md`.

| Item | Type | What it is |
|---|---|---|
| `spine-kinematics` | lib | Serpenoid travelling-wave body: joints, tangent angles, ground clearance. |
| `hexapod-kinematics` | lib | Radial many-legged walker: plan-view feet, knees solved in each leg's vertical plane. |
| `robot-fish` | ui | Swimming fish in profile: tail-weighted body wave, fins, turn, dart. |
| `robot-snake` | ui | Serpentine crawler in plan: even wave, sidewinding lift, tracking head, strike. |
| `robot-spider` | ui | Eight-legged walker in plan: tripod, wave and ripple gaits, crouch. |
| `robot-crab` | ui | Sideways walker in plan: the same gait solver at 90°, hinged claws, eyestalks. |
| `robot-bird` | ui | Perching bird in profile: articulated wings with fanned feathers, tail fan, takeoff. |

Water, ground and air, with a different mechanism under each: a travelling wave, a radial
gait, and a flap cycle.

## Why these two solvers

The registry already has a sagittal two-link solver (`quadruped-kinematics`), a biped with a
neck (`duck-kinematics`) and a parallel platform (`stewart-kinematics`). Nothing in it bends
a *body*, and nothing walks with more than four legs. Both gaps are real geometry rather than
illustration, so both go in `src/lib/robocn/` with no React around them.

### `spine-kinematics` — `solveSpine(options)`

A serpenoid curve, the standard model for swimming and serpentine crawling. The body's
tangent angle at station `s` (0 at the nose, 1 at the tail) is

```
θ(s) = amplitude · env(s) · cos(2π(waves·s − phase)) + turn·s
```

and the joints are walked off that angle from the nose backwards, one fixed link length at a
time. Two consequences worth naming:

- **Link lengths are exact.** The pose integrates a tangent angle rather than displacing
  joints, so every link is the same length at every phase. That is the invariant the tests
  assert, the same way the quadruped's leg tests do.
- **A crest travels head to tail as `phase` rises,** which is what the wave does on a real
  fish. Reverse it by running `phase` backwards.

`taper` is the amplitude envelope: `1` piles the swing at the tail (a fish beats its tail),
`0` spreads it evenly (a snake), `−1` puts it at the head. `turn` adds a constant curvature
so the body arcs, which is both steering and, at full value, the coil. `lift` reports ground
clearance on the half of the wave that is off the ground — sidewinding — and `contact` marks
the rest.

### `hexapod-kinematics` — `solveHexapod(options)`

Four to ten legs arranged around a body, walking in plan view.

- Hips sit on the carapace edge at fanned angles, half to a side. `fan` is how far around the
  body they spread; `spread` is how far out the feet plant.
- Each foot has a nominal stance point, and the gait slides it along the travel direction:
  stance carries it backwards, swing arcs it forward with ground clearance. `heading` is that
  travel direction, which is the entire difference between the spider and the crab.
- **The knee is solved, not drawn.** Each leg is a two-link chain in its own vertical plane —
  horizontal distance from hip to foot on one axis, body height on the other — through the
  shared `solveChain2`. The pose reports the knee's plan position *and* its height, so the
  drawing can raise it. Femur and tibia lengths therefore hold exactly, which is the test.
- Gaits: `tripod` (alternate legs, duty 0.5), `wave` (one leg at a time), `ripple` (a
  progressive delay down each side), `stand`.

Both solvers are illustrative trajectories, not dynamics: no balance, no ground reaction, no
body-frame integration of the resulting travel.

## The components

Each is a procedural SVG with `size`, `variant`, palette props, `showGround` and `label`, a
`role="img"` label describing what it is doing, stable `data-*` hooks on the mechanisms, and
the three motion rules: controlled wins, uncontrolled runs a `behavior`, interaction yields
and resumes.

| Component | Uncontrolled motion (`behavior`) | Interaction (`interactive`) |
|---|---|---|
| `robot-fish` | `cruise` steady beat; `dart` burst-and-glide; `hover` fin-holding with a slack body; `static` | Turns toward the pointer; click darts — a swing and speed spike that decays. `onDart` |
| `robot-snake` | `serpentine` even wave; `sidewind` lifted alternating body; `coil` curled and breathing; `static` | Head turns toward the pointer; click strikes and recoils. `onStrike` |
| `robot-spider` | `walk` tripod gait; `skitter` fast ripple; `idle` a slow stance breath; `static` | Walks toward the pointer while it is watched; click drops it into a crouch. `onCrouchChange` |
| `robot-crab` | `scuttle` sideways tripod; `idle` claw display; `static` | Eyestalks track the pointer; click snaps both claws. `onSnap` |
| `robot-bird` | `perch` settling bob and head turns; `flap` full wing cycle; `glide` wings held with small trim; `static` | Head tracks the pointer; click launches it into a flap burst that settles back. `onTakeoff` |

Shared drawing decisions:

- **Far limbs read as depth, not as a second solve.** The bird's far wing and the spider's
  far-side legs draw behind the body at reduced opacity, the way the quadruped's far legs do.
- **Body ribbons are offsets of the spine.** Fish and snake build one path from the solved
  joints offset along each joint's normal, so the outline is the solver's output rather than
  a hand-drawn silhouette that has to be kept in sync.
- **Feet that carry weight can be marked.** `showContacts` on the walkers and the snake, same
  prop name and meaning as the quadruped and the duck.

## Delivery checklist

Solver, solver tests, component, component tests, registry entry, docs entry, demo,
catalogue card, README row — the path every other item took. The registry test enforces that
each item declares the robocn files it imports, so the fish and the snake both depend on
`spine-kinematics`, and the spider and the crab on `hexapod-kinematics`.

## Verification

- `vitest`: solver invariants (link lengths, wave travel, taper, gait duty, heading
  rotation), and per component the controlled-wins rule, the `data-*` hooks changing with
  their props, and the click interactions.
- `tsc --noEmit`, `eslint`, `next build`.
- Driven in a browser: every new docs page, each behavior switched through, each animal
  clicked, and reduced motion forced on to confirm the loops park.
