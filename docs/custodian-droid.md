# The custodian droid

One machine: a floating armoured custodian. A rounded casing with no limbs, no wheels and no
rotor, hanging in the air with a single deep-set optic on its face — and a shell that is not
one piece. The armour is a ring of segments riding **radial rails**, and one `open` number
runs them all out into a corona around a lit chassis.

Built from a reference image (a rendered spherical caretaker unit with a glowing central
eye). What was taken is written below; what was left behind is the character.

## Why it earns a place

Nothing in the set opens its own shell. Bellows inflates a soft dome, the console stops down
a planar iris; this one takes its armour apart in space and puts it back.

| Nearest neighbour | What it does | Why this is not that |
| --- | --- | --- |
| `probe-droid` | Hovers on repulsors, rigid appendages set round a pod | Its pod is one closed body; nothing on it moves but the sensor |
| `sentinel-console` | Wall fixture, solved iris, gimballed optic | Leaves sliding *in* one plane, bolted to a bulkhead. This flies, and its plates leave the plane |
| `bellows-droid` | Pleated dome that inflates | A soft volume, one surface, no separate parts |
| `orb-droid` | Rolling sphere with a stabilized head | A ground machine; its shell is the drive |
| `guide-droid` | Rotor-lifted, sprung limbs | Lift is the mechanism there; here lift is background and the shell is the mechanism |

The new mechanism is the **segmented shell**: `plates` armour segments, each a wedge of the
casing outline from an inner radius out to the rounded-cube silhouette, each riding its own
raked rail. Opening runs every segment out along its radius, the front edge travelling
further than the back so the corona blooms rather than just dilating, and each rail shows
as a strut that lengthens between the chassis and the plate it carries. The chassis is
exposed as they part, so the machine is closed armour at `open: 0` and a lit lattice inside a
ring of floating plates at `open: 1`.

## Read off the reference

**Silhouette.** A rounded cube — wider than tall, corners broken back, no limbs — with a
circular recess on the face carrying a lit lens, and a bracket cage standing proud in front
of the lens on three arms, the lower one drawn down into a prong. At 150px it reads as
*a lit eye in a floating block*.

**Proportions**, as ratios of the casing width W:

| Part | Ratio | World units (W = 124) |
| --- | --- | --- |
| Casing | 1.00 × 0.79 × 0.68 (w × h × depth) | 124 × 98 × 84 |
| Corner break | 0.16 | r 20 |
| Optic recess | 0.37 diameter | r 23 |
| Lens | 0.21 diameter | r 13 |
| Voice ring | 0.29 diameter | r 18 |
| Cage ring | 0.24 diameter, 0.13 proud of the face | r 15 at z + 16 |
| Lower prong | 0.41 of casing height below the axis | 40 |

**Degrees of freedom** visible in the reference, each a prop here: the shell segments part
(`open`), the optic aims (`look` / pointer), the ring around the lens lights (`voice`), the
machine floats and the shell rolls under a stabilized optic (the behaviour's `lift` and
`roll`), and the segment count is the casing's own construction (`plates`).

**Panel roles.** The reference's brushed casing → `shell`; the cage arms, the bezel and the
rails → `metal`; the recess behind the lens, the seam grooves and the core → `dark`; the lens,
the ring cells and the core lattice → `accent` / `glow`. No colour is sampled; the defaults are
the theme's.

**Signature details** kept: the recessed optic housing, the three-arm cage with its lower
prong, the ring of cells round the lens, and one groove with a bolt at each end across every
armour segment.

### Originality

Shipped as the archetype — a floating custodian unit — not the character. No franchise name
in the component, docs, demo labels or `aria-label`; no character markings; no paint scheme
(the reference's steel-and-cyan is not a default). Same constraint as `casing-droid` and
`astromech-droid`. Reference images stay in the session scratchpad and are not committed.

## The mechanism

```
open 0                            open 1
plates seated, seams closed       plates 22 units out on their rails
chassis hidden behind the armour  the lattice on it lit through the gaps
rails stowed, a stub of strut     rails extended, a strut on every segment
silhouette = the rounded cube     silhouette = a corona of plates
```

- Each segment spans `360 / plates` degrees about the optical axis. Its outer edge is the
  casing outline sampled across that span — so the segments *are* the casing, not decoration
  laid on it — and its inner edge is an arc at `R_INNER = 34`.
- Travel is `open × 22` at the front face and `open × 12` at the back, so the plates cant
  outward as they go.
- Every solid is a **stack of rims**, not one extrusion: the outermost rim sits at 0.9 of the
  one behind it, nine units in front of it, and the wall is the quad strip between each
  neighbouring pair. That corner break is what keeps the casing a rounded cube from the side
  instead of a slab with square rims. Each quad is wound the same way, because a camera that
  folds the section onto itself (plan, profile) overlaps neighbouring quads, and opposite
  windings cancel under the nonzero fill rule — which is exactly how the shell went invisible
  in two of the four views the first time.
- The lattice on the chassis is only drawn as far out as the armour has uncovered, so nothing
  is lit that a seated plate is standing in front of.
- The shell `roll` turns every segment and rail about the optical axis. The chassis, cage and
  optic do not turn with it: the optic is gimballed, and a gimballed optic stays level while
  its mount drifts. That is the one detail that makes the machine read as *floating* rather
  than *sliding*.

## Contract

Standard: `size`, `variant`, palette props, `showGround`, `label`, `signal`.

- `view`, native **`front`**. Everything is modelled once in world units — `x` across the
  face, `y` down it, `z` out of it toward the room — and every point goes through
  `camera.project`. There is no second drawing: in `profile` the face is edge-on and the
  casing is a block with the plates standing off its rim, and in `plan` the corona is seen
  from above. Face artwork (seams, ring cells, bore) is drawn on its own plane through the
  affine map that plane projects to, so it skews correctly and vanishes edge-on.
- `behavior`: `watch` (seated shell, slow float, the optic drifting across the room),
  `survey` (runs the shell half out and breathes it while the optic sweeps), `alert` (snaps
  the shell wide, tight fast float, the voice ring bursting), `static`. Scaled by `speed`,
  offset by `phase`, frozen by `paused`, parked by `animate={false}` or reduced motion.
- Controlled `open` (0..1) wins and stops the loop; `voice` is separately controllable.
- `interactive` (default on): drag **across** the machine to run the shell out and in, arrow
  keys step it, `Home`/`End` are seated and wide, `onOpenChange` reports throughout.
  `role="slider"` with `aria-valuenow` in percent. The optic tracks the pointer unless `look`
  is supplied.

### Axes

| Prop | Values | What it changes |
| --- | --- | --- |
| `plates` | 4–10 | Armour segments in the shell; 6 is the reference |
| `voice` | 0..1 | Lit cells in the ring round the lens, out from the middle |
| `look` / `track` | `Vec2` / boolean | Where the optic is aimed |

### `data-*` hooks

`data-custodian` and `data-view` on the drawing group, and per mechanism: `data-shell`,
`data-plate="0"…`, `data-rail="0"…`, `data-core`, `data-lattice`, `data-optic`, `data-barrel`, `data-lens`,
`data-cage`, `data-arm="0"…`, `data-ring`, `data-cell="0"…` (`data-lit` on the ones that are
lit), `data-contact`.

## What it is not

No flight model: there is no thrust, mass or repulsor field, and the float and roll are drift
terms rather than integrated motion. The rails are drawn as prismatic joints and are not force
limited — nothing here has a stroke load. The optic is a body that yaws and pitches about a
pivot behind its own face, but there is no optics model: no exposure, no focus, no depth of
field. Nothing infers state or starts a timer — `voice` lights cells because it was told to.

## Verification

- `vitest`: `open` moves every plate and lengthens every rail; the plate count follows
  `plates`; `voice` lights ring cells; the label names the state, the opening and the view;
  `NaN` on every numeric axis renders the neutral machine with no `NaN` in the DOM; a press
  runs the shell and releasing hands it back to the behaviour; keyboard steps report through
  `onOpenChange`; the behaviour sampler stays inside its limits and is neutral for a
  non-finite clock. The four views are covered by `views.test.tsx`.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm registry:build`, `pnpm build`.
- Driven in Chrome: all four views, all four variants, the open range end to end, the docs page
  at desktop and at 390px, reduced motion forced on, and the 150px catalogue card beside the
  reference.
