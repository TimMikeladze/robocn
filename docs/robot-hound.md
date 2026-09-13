# The hound

**Goal:** one machine for the boxy companion tracker — a wedge chassis on a concealed drive,
with a head that rises out of a concertina neck. Registry item `robot-hound`, group Robots.

Worked from reference images of a wedge-bodied robot dog: a boxy toy-scale tracker photographed
from three-quarter front, plus a handful of thumbnails at other angles. What was taken is
listed below, in words and ratios. **The images are not committed** — they are not ours to
redistribute — and the machine that ships is the archetype, not the character.

## Constraint

Same as `docs/sci-fi-icon-droids.md`: original archetypes only. No franchise character names,
no logos, no exact paint schemes, no character-specific markings — not in the component name,
the docs, the demo `label`, or the palette defaults. The name is the job: a hound is a machine
that casts about for a scent and tells you when it has one.

## What was taken from the references

**Silhouette** (the only thing that must match, and the thing that survives a 150px card): a
low wedge box, widest at the floor, with a second, smaller wedge — the head — carried out in
front of it on a ribbed collar, two dish ears on the head's back, and a thin probe rising off
the tail end. No legs anywhere. It reads as a dog from the outline alone, and as a machine from
the fact that nothing about it is an animal part.

**Proportions**, as ratios of the chassis length `L` (the `viewBox` numbers are these):

| Part | Ratio |
| --- | --- |
| Chassis deck height | 0.55 L |
| Chassis width, floor / deck | 0.80 L / 0.53 L — a frustum, not a box |
| Head length | 0.63 L, from the neck pivot to the nose |
| Head height, back / nose | 0.33 L / 0.15 L — a wedge, deeper at the back |
| Head width | 0.38 L, tapering to 0.30 L at the nose |
| Neck gap | 0.03 L stowed to 0.20 L at full stretch |
| Ear dish | 0.11 L radius, on a 0.14 L stalk |
| Probe | 0.38 L stowed to 0.65 L run out |

**Degrees of freedom** visible in the references, each of which is a prop here: the neck
extends, the head pitches and yaws on it, each ear dish elevates and swivels, the probe
telescopes and rises, and the drive rollers under the skirt turn. Nothing moves that the
drawing cannot show moving.

**Panel roles.** The references are a two-tone blue-grey machine with a striped collar, a red
ribbed sensor block over the snout and a coloured keypad on the back. That maps to
`shell` (chassis and head panels), `metal` (collar ribs, ear dishes, probe, roller hubs),
`dark` (the drive plinth, panel seams, joints, the recessed keypad well) and `accent` (the
visor bar, the eye and the lit keys). No colour is sampled: `resolveRobotPalette()` supplies
every value, so an install themes itself.

**Signature details**, and nothing else at `md` size: the ribbed collar, the dish ears, the
visor bar over the snout, the keypad on the deck, the probe.

## Distinctness

The set already has four-legged animals (`robot-cat`, `robot-quadruped`, `robot-turtle`), and
all of them are legs hung off a body with a solved chain per leg. The hound has **no legs at
all** — it is the only animal in the set that travels on a drive rather than a gait, so its
whole expressive range is in the head and neck, and that is what the machine spends its
geometry on. Two mechanisms are new to the set:

- **A concertina that spans two moving points.** `bellows-droid` pleats a body of revolution
  about one fixed axis. The hound's collar bridges a gap that both stretches *and* swings, so
  its ribs are laid along the live axis between the deck and the head, their pitch set by the
  extension — the collar is the readout for how far the head has come out, not an ornament.
- **A telescoping probe.** Every other boom in the set bends (`casing-droid`'s stalk,
  `robot-snake`'s spine). This one slides: three sections of falling diameter with visible
  collars, the overlap shrinking as it runs out.

And one new drawing primitive, in `robot-style`: `frustumPath`, the hull of two *different*
footprints at two heights. `extrudedPath` gives a prism; the hound's chassis and its head are
tapered, and a taper is what makes the silhouette read as a machine rather than a crate.

## One number runs it

`attention`, 0 to 1, the way `lift` runs `guide-droid`:

| attention | 0 | 1 |
| --- | --- | --- |
| Neck | stowed, ribs stacked | run out 0.2 L, ribs open |
| Head pitch | nose down 26° | nose up 6° |
| Ears | folded back 12° | pricked up 30° |
| Probe | 16° and a third out | 46° and fully out |
| Visor | dim | lit across |

Supply it and the loop stops. Leave it out and `behavior` runs it: `seek` casts the head side
to side at half attention, `alert` holds it high with a tremor, `idle` lets it settle, `static`
parks it. `robotHoundPose(behavior, clock)` is exported as a pure function of the clock, so the
tests sample the motion rather than faking frames.

`interactive` hands it over: drag up and down to raise the head, arrows step it, Home stows and
End alerts, `onAttentionChange` reports throughout. The head yaws to the pointer the whole
time — that is the machine noticing you, and it is independent of attention.

## Views

`profile` is the view it is drawn in and the default. The chassis, the drive plinth and the
head are solids in world units (x starboard, y up, z toward the tail, nose at −z) projected
through `robotCamera`; the keypad is planar deck artwork through `camera.plane`; the side
detail — collar ribs, eye, seams — is elevation artwork through `camera.wall(0, 90)` and goes
edge-on in front view, which is what the side of a machine does. The head is a pitched and
yawed box, so its silhouette is the hull of its own eight corners projected, and the eye is a
circle sampled in the head's plane rather than a circle drawn on screen.

## Data hooks

`data-hound` (+ `data-view`), `data-chassis`, `data-drive`, `data-roller`, `data-keypad`,
`data-key`, `data-neck`, `data-head`, `data-ear="left|right"`, `data-visor`, `data-eye`,
`data-probe`, `data-contact`.

## What is illustrated

No dynamics anywhere: no drive model, no traction, no mass, and the rollers turn at a rate
proportional to the clock rather than to any travel. The concertina is drawn from its own
extension but has no fold pattern or material model, the probe has no antenna pattern, and the
hound does not track, smell or detect anything — the visor lights because `attention` told it
to. The docs `notes` say all of this.

## Integration

Registry item (`registry:ui`, one file, depending on `robot-style`, `robot-kinematics`,
`use-pointer-target`, `use-robot-motion`), a docs record in `src/lib/docs.ts`, a demo reaching
every axis and all four views in `src/components/demos/demos.tsx`, a catalogue card, a README
row, and behaviour tests in `src/components/ui/__tests__/robot-hound.test.tsx` plus the shared
view suite. `frustumPath` gets its own case in `src/lib/robocn/__tests__/style.test.ts`.
