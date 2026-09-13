# Monolith droid

A new axis for the droid set: a machine with no limbs. Everything already in `src/components/ui`
hangs mechanism off a body — a dome on a cone, arms on a torso, legs on a spine. This one *is*
its mechanism. It is a rectangular column sliced lengthwise into parallel slabs, each hung off a
hinge at the top, and every pose it has is those slabs moving relative to one another.

Reference: photographs of a blocky slab robot, read for silhouette and mechanism only. No
markings, wordmark, dot-matrix insignia or paint scheme were taken, and the images are not in
the repo. What was taken:

- **Silhouette.** A tall rectangular column, visibly divided into a small number of full-height
  slabs standing shoulder to shoulder, that splits into an A-frame stance. At 150px the whole
  thing is four vertical bars and a dark band.
- **Proportions**, as ratios of the long axis: slab height 1.0, slab width 0.144, slab depth
  0.167 — so each slab is a touch deeper than it is wide, and about seven times taller than it
  is wide. Four slabs closed are 0.61 of the height across. The base plate is 0.045 of the
  height and stands proud of the slab on all four sides.
- **Degrees of freedom**: the hinge line across the top of the column (the pin holes are visible
  on the broad faces), and the slabs' freedom to swing out sideways and fore-and-aft from it.
- **Panel roles**: bare slab faces are `shell`, the machined end caps and base plates read
  `metal` and `dark`, the band across the upper third and the recessed readout are `dark`, and
  the lit rows in the readout are `accent`.
- **Signature details**: the dark collar band, the recessed readout of short lit rows, the pin
  holes at the top of each slab, the segment seams running across all four slabs at the same
  heights, and the wide base plate under each foot.

The archetype is a *slab walker*, not a character. The name is the job.

## What ships

`monolith-droid` — one `registry:ui` item, no solver. There is no chain to solve here: a slab is
a rigid body on a one-axis hinge, so the pose is two rotations and a rise per slab, which is a
table and some trigonometry, not kinematics. Inventing IK for it would be worse than not having
it.

## The mechanism

One slab is a cuboid whose pivot sits at the centre of its top face, on the common hinge line
that runs across the column. Three numbers move it:

- **`splay`** rotates the slab about the fore-aft axis, by an angle proportional to how far the
  slab stands from the centre of the column. At 0 every angle is zero and the slabs close into
  one solid column; at 1 the outer slabs are at 16° and the machine stands in a braced A-frame.
  This is the one controlled scalar, the one the drag and the arrow keys work, and the one the
  behaviours ease toward.
- **`stride`** rotates the slab about the across axis, alternating slabs half a cycle apart, and
  lifts each one while it is swinging forward. That is the footfall cycle: a slab is either
  planted and pushing back, or off the deck and reaching.
- **`lean`** tips the whole assembly about the deck.

Nothing else moves. There is no waist, no head and no arm, and that is the point.

## One geometry, projected

Every part is a cuboid in world units — `x` starboard, `y` up, `z` toward the tail — and it is
drawn by projecting its eight corners through `robotCamera(view)`. Each box contributes its six
faces; a face is drawn only when its rotated normal points toward the camera, and the faces are
painted back to front by depth, slabs included. So `plan` shows four end caps and nothing else,
`front` shows the broad faces with a sliver of cap above them, and `iso` shows two faces of every
slab with the near ones covering the far ones. No angle is hand-drawn.

Face artwork — the collar, the seams, the pin holes, the readout — is drawn in the face's own
world units and wrapped in the affine matrix built from the projected face basis. The projection
is linear, so that matrix is exact: a pin hole is a real circle on a real face and comes out as
the correct ellipse from every angle, and it collapses to a line when the face goes edge-on,
which is what a face does. Everything on a face is a fill, never a stroke, so the matrix never
distorts a line weight.

`view` defaults to `front`, the elevation the machine was designed in.

## Contract

- Colour: `shell` slab faces, `metal` end caps, `dark` base plates, collar and readout recess,
  `accent` the lit rows and the status lamp. All through `resolveRobotPalette` / `robotSurface`.
- `size`, `variant` (all four), `view` (all four), `label`, `showGround`, `signal`.
- Motion: `behavior` is `"walk" | "unfold" | "brief" | "static"`, sampled by the exported pure
  function `monolithDroidPose(behavior, clock)`. `walk` strides at a working splay, `unfold`
  opens and closes the column with the slabs still, `brief` stands near-closed and runs the
  readout, `static` parks half open.
- Interaction: `interactive` drags the column open and closed horizontally, arrow keys step it,
  Home closes it, End opens it. `onSplayChange` reports throughout.
- Controlled: `splay` stops the loop; `stride`, `panel` and `lean` override the behaviour's own
  value for that one axis without stopping it.

## `data-*` hooks

`data-monolith` (the frame), `data-view`, `data-slab="<index>"` on every face of that slab and
its base plate, `data-facet="front|back|left|right|top|bottom"`, `data-panel`, `data-row="<i>"`
with `data-lit` on the lit ones, `data-collar`, `data-pin`, `data-foot="<index>"`,
`data-contact`.

## What it is not

Illustrated, not simulated: there is no mass, no balance and no support polygon, so a splay of 0
with a stride on it will happily walk on a column that could not stand. The gait is a scripted
footfall cycle, not a solved one. The readout lights rows because it was told to — it reports
nothing and starts no timer.

## Integration

`registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx` (+ the `demos` map),
`src/components/site/catalogue.tsx`, `README.md`, and the tests —
`src/components/ui/__tests__/monolith-droid.test.tsx` plus the name in `droidCollection`
(`scripts/__tests__/registry.test.ts`), `droidSlugs`
(`src/components/site/__tests__/docs-catalogue.test.tsx`) and the `views.test.tsx` tables.
