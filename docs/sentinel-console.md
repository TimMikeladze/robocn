# The sentinel console

One machine: a bulkhead-mounted watch station. It does not stand on the deck — it is *part of
the ship*. A housing set into a wall carries an identity strip, a gimballed optic behind an
iris diaphragm, and a voice grille, and that is the whole robot.

Built from a reference image (a tall dark console panel with a lit name strip, a single large
red lens, and a perforated speaker block beneath it). What was taken is written below; what
was left behind is the character.

## Why it earns a place

Every other machine in the set has a floor, a hull, or a rotor. This one has a wall.

| Nearest neighbour | What it does | Why this is not that |
|---|---|---|
| `robot-face` | Eyes that follow, six moods | A face drawn as a face: one viewpoint, no `view` axis, no optics — the eyes are pupils that slide |
| `lidar-scan` | Polar display of range data | A plot, not a body. Nothing to walk round |
| `orb-droid`, `security-droid` | Pointer-tracking optic | Floor machines that carry the optic on a body; the optic is a moved pupil, not a gimbal |
| `bellows-droid` | Lens pods and an `iris` vent | That vent is an ellipse that opens. This is a ring of blades solved from one angle |
| `guide-droid` | Ring optics and a bar grille | Hangs from a rotor; its grille is seven bars, and it has no aperture at all |

Two new mechanisms:

**The iris diaphragm.** A ring of `blades` leaves, each pivoting about a pin on a fixed ring,
each carrying a circular working edge. The opening is *solved* from the blade swing in closed
form and the blades are drawn from that solution, so stopping down is a linkage moving rather
than a circle being tweened. Nothing else in the set has one.

**The gimballed optic.** The lens cell is a real body in space that yaws and pitches about a
pivot behind its own front face, with visible trunnions and a yoke. Its bezel is a circle in
the cell's plane, so turning it foreshortens the ring into an ellipse and slides the glass
across it — the way a camera head actually reads — instead of a dot moving inside a static
circle.

## Read off the reference

**Silhouette.** A tall narrow slab set flush into a dark wall: a small lit name strip near the
top, one large circular lens a little above the middle, a perforated block at the bottom. At
150px it reads as *tall panel, one eye, grille under it* — nothing else in the catalogue reads
that way.

**Proportions**, as ratios of the console face height H (top of the housing to the bottom):

| Part | Ratio | World units (H = 190) |
|---|---|---|
| Console face | 0.35 wide × 1.0 tall | 66 × 190 |
| Identity strip | 0.73 of face width, top at 0.045H | 48 × 11 at y 85..96 |
| Lens bezel, outer | 0.70 of face width, centre 0.55H down | r 23 at y 0 |
| Aperture, wide open | 0.48 of face width | r 16 |
| Grille block | 0.76 of face width, 0.78H..0.96H | 50 × 34 at y −78..−44 |

The lens sits above centre, not on it: that one ratio is what makes the panel read as a face
without a face being drawn.

**Degrees of freedom.** The reference is a still of a fixture, so the mechanisms are the ones
the hardware implies and each is a prop here: the optic yaws and pitches (`look`, or the
pointer), the iris opens and closes (`aperture`), the grille carries a speech level (`voice`),
the strip carries a status lamp (`signal`).

**Panel roles.** The console housing → `shell`; the bezel, trunnions, strip frame, grille mesh
and fasteners → `metal`; the recessed face, the aperture behind the blades, the speaker box
and the bulkhead → `dark`; the lit pupil, the strip backlight and the live grille bars →
`accent`. No colour is sampled. The reference's red eye is not a default — the demo passes
`accent` only to show the archetype's tone.

**Signature details** kept: the lit name strip, the concentric bezel rings, the specular
highlight off the glass, the perforated block. Dropped: the name itself, the badge, the
paint.

### Originality

Shipped as the archetype — a ship's sentinel console — not the character. No franchise name in
the component, the docs, the demo labels, the `plate` default or the `aria-label`; no serial
number from the reference; no character paint scheme. Same constraint as `casing-droid`,
`astromech-droid` and `guide-droid`. Reference images stay in the session scratchpad and are
not committed.

## The iris

A blade pivots about a pin at radius `p` from the optical axis. Fixed in the blade, at
distance `e` from that pin, is the centre of the blade's working edge, an arc of radius `b`.
Swing the blade by `θ` and that centre runs round a circle of radius `e`, so its distance from
the axis is

```
d(θ) = √(p² + e² + 2·p·e·cos θ)
```

and every blade's edge is tangent to a circle of radius `d(θ) − b` about the axis. That is the
aperture, and it is exact: the material runs from each edge out to the rim, so what the
blades leave behind is a rounded `blades`-gon of inradius `d(θ) − b`. Going the other way — the direction the component
actually needs — inverts in one line:

```
θ = acos( clamp( ((r + b)² − p² − e²) / (2·p·e), −1, 1 ) )
```

With `p = 19`, `e = 14`, `b = 15`, a swing of 41°…118° takes the opening from r 16 down to
r 2.5, which is the stroke the component maps `aperture` 1…0 onto.

Each blade is then drawn as the lens of overlap between the bezel bore and its own edge
circle, sampled as a polygon from the two circle–circle intersections. Blades overlap, because real
ones do; what you see of each is its leading arc, and the rest is under its neighbour.

It stays in the component rather than becoming a `src/lib/robocn/` item: there is no chain to
seed and nothing to iterate, so it is one closed-form ring rather than a solver someone else
would reuse. The functions are exported and tested directly all the same.

## Contract

Standard: `size`, `variant`, palette props, `label`, `signal`, `plate`.

- `view`, native **`front`**. The console is modelled once as solids in world units — X across
  the face, Y up it, Z out of the wall toward the room — and every part is an extruded
  cross-section hulled under `robotCamera(view)`. Face artwork (strip text, grille bars, iris
  blades) is drawn only while the face is toward the camera, which is `front` and `iso`; in
  `profile` and `plan` the face is edge-on and what you get instead is the depth — how far the
  bezel stands proud of the bulkhead, the speaker box behind the grille, and the conduit
  entering the back of the housing. A wall fixture seen from above *is* a band, and that is
  the honest drawing of one.
- `behavior`: `watch` (holds a bearing, swings to the next, holds again), `listen` (iris wide,
  optic all but still), `speak` (grille running an envelope, iris mid), `alert` (iris stopped
  down and pulsing, optic snapping between bearings), `static`. Scaled by `speed`, offset by
  `phase`, frozen by `paused`, parked by `animate={false}` or reduced motion.
- Controlled `aperture` (0..1) wins and stops the loop. `voice` and `look` are separately
  controllable, the way `guide-droid` separates its blade angle.
- `interactive` (default on): drag across the lens to stop the iris down and open it up, arrow
  keys step it, `Home` closes and `End` opens, `onApertureChange` reports throughout.
  `role="slider"` with `aria-valuenow` in percent. The optic tracks the page pointer unless
  `look` is supplied — grabbing it and being watched by it are separate, and both work on
  touch.

### Axes

| Prop | Values | What it changes |
|---|---|---|
| `blades` | 4–10 | Leaves in the diaphragm; 8 is the default |
| `plate` | string | The identity strip. Generic by default, and never a name from a film |
| `voice` | 0..1 | Lit cells in the grille, out from the middle |
| `showBulkhead` | boolean | The wall plate the console is set into, with its fasteners |

### `data-*` hooks

`data-console` and `data-view` on the drawing group, and per mechanism: `data-bulkhead`,
`data-housing`, `data-face`, `data-plate`, `data-lamp`, `data-conduit`, `data-cell` (the
gimballed optic), `data-bezel`, `data-glass`, `data-pupil`, `data-iris`, `data-blade="0"`,
`data-trunnion="left"`, `data-grille`, `data-bar="0"`, `data-speaker`.

## What it is not

The iris is solved; everything else is illustrated and the docs `notes` say so. There is no
optics model — the aperture does not change what the pupil sees, there is no depth of field
and no exposure. `voice` lights cells because it was told to: nothing here listens, speaks,
watches, or infers a state, and no timer starts on its own. The gimbal has no actuator, no
rate limit of its own beyond the return easing every machine in the set shares, and no
mechanical stops other than the clamp on `look`.

## Verification

- `vitest`: the iris solver's closed form against the analytic aperture radius, its
  monotonicity across the stroke, and the blade polygons being one shape rotated; the
  behaviour sampler staying inside its ranges, repeating whole cycles and returning the
  neutral pose for a non-finite clock; `aperture` moving the blades and the bore; `look`
  turning the cell and sliding the glass; `voice` lighting cells; `blades` changing the count;
  the label naming the state, the aperture and the view; `NaN` on every numeric axis rendering
  the neutral pose with no `NaN` in the DOM; the keyboard reporting through
  `onApertureChange`. Views are covered by `views.test.tsx`.
- `pnpm test`, `typecheck`, `lint`, `registry:build`, `build`.
- Driven in a browser: the docs page, each behaviour, each variant, each view, grabbed with a
  mouse and with touch emulation, at 390px, and with reduced motion forced on.
