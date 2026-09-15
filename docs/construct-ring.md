# Construct ring — a stroke, classified, forged into solid light

One machine and one solver, on an axis nothing in the set has: **the reader draws the
mechanism's output with a pointer**, and the machine has to make something honest out of it.

| Item | Type | What it is |
|---|---|---|
| `construct-geometry` | lib | Stroke sampling, a shape frame (centroid, span, principal axis, closure, circularity, corners), a classifier from that frame to an archetype, parametric archetype outlines, a scanline lattice that fills one, and the draw it costs. |
| `construct-ring` | ui | A signet emitter ring: a lit bezel over a knurled band, a teardown that takes it apart in fitting order, and a forge that turns a drawn stroke into a construct. |

Reference images: a chunky signet ring with a domed inlay over a cracked-finish band, and a
carried emitter of the same family. Taken from them: the silhouette (broad band, bezel wider
than the band, inlay proud of it), the proportions (bezel about 0.55 of the band diameter,
band thick enough to read at 150px), the panel roles (band `metal`, shank plates and bezel `shell`,
side inlays `accent`, bore `dark`, lens and emission `glow`). **Not** taken: the insignia. The reference's bar-and-disc mark
is a character logo; this ring's face is an abstract iris — a bore, four radial inlays and a
spiral — so the archetype ships and the character does not. Do not put the mark back.

## What is actually new here

Every other interactive machine in the set maps a pointer to **one scalar** — an angle, a
flow, an extension — and eases back to a behaviour on release. This one takes the *shape of
the gesture*. The pointer path is the input, and there is no scalar to clamp it to.

So the honest question is: what can be computed from a freehand stroke, and what must be
admitted as illustration? The split this family draws:

**Solved.** Arc-length resampling (a mouse emits points at pointer rate, not at even spacing,
so nothing downstream can be trusted until they are evenly spaced). The frame: centroid, the
principal axis from the covariance of the samples, span along and across that axis, closure
(end-to-start gap over path length), signed area by the shoelace formula, circularity
`4πA/P²`, and a corner count from turning angle over a smoothed window. The classifier is a
score over those five numbers — nothing is hidden, and `classifyStroke` is a pure function a
stranger can unit-test. The lattice is a real polygon scanline clip: every fill line is the
intersection of the archetype outline with a line at the construct's own rake, so the hatch
follows the shape instead of being painted over it. Cost is proportional to the outline's
area, and the ring's gauge reads exactly that.

**Illustrated.** The archetype outlines and their seams (`constructDetail`) are parametric drawings — a glove is a
glove because it is drawn as one, not because a fist was solved. The glow, the shimmer and
the seams are drawing. There is no physics on a construct: nothing swings, nothing collides,
nothing has mass. The docs `notes` say so.

## The classifier

Five numbers in, one archetype out, with a score per archetype so a near miss is a near miss
rather than a coin flip:

| Archetype | What the stroke looks like |
|---|---|
| `bubble` | closed, circular (`circularity > 0.72`), aspect near 1 |
| `shield` | closed, low circularity, taller than wide, few corners |
| `cage` | closed, many corners, aspect near 1 — a scribbled loop |
| `glove` | any closure, aspect around 1.75, few corners |
| `hammer` | open, long and straight, aspect over 2.6 |
| `bridge` | open, long, one broad arch — low turning, high span |
| `claw` | open, short, high turning, low span |

Each archetype also carries the proportion it wants — a glove is nearly as tall as it is
long, a hammer is not — and the fit blends that with the stroke's own aspect (`ASPECT_BLEND`,
0.65 toward the archetype). Without it a flat scribble made a flat glove, which read as a
blob. The stroke still decides how big the construct is, where it sits and which way it
points.

`classifyStroke` never throws and never returns nothing: a stroke of two points, or of
`NaN`s, classifies as `bubble` with a neutral frame, because a ring that fails in front of
the reader is worse than a ring that makes a bubble.

## The shared contract

The machine keeps the set's contract — palette roles, `size`, the four variants, the four
cameras through `robotCamera`, controlled-prop-wins motion, `behavior` including `"static"`,
reduced motion parking the loops — with two things worth stating:

- **The ring is projected; the construct is not.** The ring is modelled in world units (`x`
  starboard, `y` up, `z` aft, the band's axis along `z`) and drawn through `elevationDraft`,
  so all four cameras come off one geometry. A construct is light thrown at the reader and
  lives in the **picture plane**: it does not rotate with the camera, by design, because the
  stroke that made it was drawn in that plane. Said in the docs `notes` too.
- **Drawing and dragging are the same gesture, disambiguated by `interactive`.** `interactive`
  makes the bezel a slider over the reserve, the way every other machine works. `drawable`
  makes the whole field a sketch surface. Both may be on; a stroke that starts inside the
  bezel adjusts the reserve, one that starts outside it forges.

## Turning it: the whole sphere, not four views

`view` names four cameras. This machine also takes **any** camera: `azimuth` and `elevation`
in degrees, straight into `robotCameraAt`, which is the same projection the named views are
built from — so turning it costs no second drawing and nothing about the teardown, the
gauge or the emission needs a special case.

`normalizeOrbit(azimuth, elevation)` is the whole rule, and it is exported and tested:
azimuth wraps into (-180, 180]; an elevation past the pole **carries over it** —
`elevation = 180 - elevation`, `azimuth += 180` — so a drag upward keeps going, over the top
and down the far side, instead of jamming at 90°. The camera has no roll axis, so it arrives
the far side upright rather than upside down; that is a property of `robotCameraAt`, said
here so nobody files it as a bug.

Gestures, in the order the pointer resolves them:

| Gesture | With | Does |
|---|---|---|
| drag in the field | `drawable` | forges a construct |
| drag anywhere else | `rotatable` (default on) | turns the ring, by pointer *delta*, so one drag can go round and round |
| drag on the ring | `interactive`, `rotatable` off | scrubs the reserve |
| ← → ↑ ↓ | `rotatable` | 15° round and ~10° up, 45°/31° with shift |
| Home | `rotatable` | back to the named `view` |

Turning is the axis a person reaches for first, so while `rotatable` is on the slider role
reports the **camera** (`aria-valuenow` the azimuth, `aria-valuetext` both angles) and the
reserve stays a prop and a behaviour. A ring nobody has turned renders byte-identical to one
that never could be — the named view is still the default.

## Reduced motion

Parking the clock is not the same as parking the machine. A conjured construct's solidity is
`constructSettle(age, life)`, and a parked clock sits at age 0 — which is *nothing on screen*.
So reduced motion is folded into the same flag as `animate={false}`: the loop stops and the
construct renders fully solid rather than at the start of its rise. Drawing still works with
reduced motion on; it never disables input.

## Motion

`behavior`, all pure functions of the clock, exported and sampled in tests:

| Behaviour | What it does |
|---|---|
| `conjure` | Cycles the archetype list, each construct materialising, holding and dissolving. |
| `charge` | No construct; the reserve fills and the bezel brightens with it. |
| `flare` | A single construct held, with the emission column pulsing. |
| `idle` | The bezel breathes; nothing is forged. |
| `static` | One frame, no loop. |

A drawn construct always wins over the behaviour and over a controlled `construct`, and it
holds — it does not dissolve on a timer the way a conjured one does. The next stroke replaces
it; Escape or Backspace clears it and hands the field back to the behaviour.

## The teardown

`exploded` 0..1 runs the ring apart through the shared `assembly-geometry`: the lens up off
the bezel, the inlays out and up, the bezel and collar up, the shank plates out along their
own radials, the band never. At `exploded={0}` every offset is exactly zero. Same schedule, all four
cameras — a world offset projects to a pure screen offset.

## `data-*` hooks

`data-view` carries `data-azimuth` and `data-elevation` beside it. Then `data-band`,
`data-shank="port"|"starboard"`, `data-collar`, `data-bezel`, `data-lens`,
`data-inlay="port"|"starboard"`, `data-bore`, `data-gauge`, `data-field`, `data-emission`,
`data-construct` (carries `data-archetype` and `data-settle`), `data-lattice`, `data-seams`,
`data-stroke`, `data-ground`, `data-view`.
