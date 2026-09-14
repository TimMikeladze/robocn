# The radial bloom

A hub with twelve telescoping rams pointed outward in one plane. Retracted it is a
compact gear-toothed star; driven out it is a long ragged burst. One number works
the whole array, or a vector of numbers works each ram on its own.

`src/components/ui/radial-bloom.tsx`. No solver file: the mechanism is a telescope,
which is arithmetic, not kinematics.

## What the reference gave it

The prompt came with an app icon: a twelve-armed starburst on a rounded square —
tapered spokes of clearly unequal length radiating from a small bright centre, each
ending in a chiselled, slightly asymmetric point.

Taken, in words:

- **Silhouette.** Twelve radial members from a small central body, no rim, no frame.
  The mark reads entirely as *length variation around a ring*.
- **Proportions**, as ratios of the drawing's long axis: centre body ≈ 0.17, longest
  spoke ≈ 0.41 from the centre, shortest ≈ 0.30, spoke width at the root ≈ 0.04.
  Those became `HUB_R`, `TIP_MAX`, the `REACH` table and the stage widths in world
  units.
- **Degrees of freedom** the picture implies: each spoke has its own length, and the
  centre is the thing they all come out of. That is the whole machine — extension per
  ram, plus how far the array is turned.
- **Signature detail.** The chisel tip: two facets of unequal length, so a point is
  off-centre rather than symmetric. Stage 3 carries it and nothing else does.

Not taken: the terracotta-and-cream paint, the rounded-square badge, and any identity
the mark carries. Colours are the set's four roles as always, the badge is absent, and
the component is named for its job. Nothing in the component, the docs, the demo label
or the catalogue line refers to a mark, a brand or a product.

## Why a telescope

A single ram cannot do this. To show a spoke nearly three times its retracted length
the moving part has to leave the sleeve, and a part that has left its sleeve is not
guided any more. Twelve blades long enough to do it in one stage would also have to
retract through each other at the centre.

So each ram is **four concentric stages**: one fixed sleeve bolted to the hub rim and
three that slide, each stage carrying the next. Every stage moves `T/3`, so the tip
moves `T`, and the overlap between consecutive stages stays at 6 world units at full
extension — the stage is always guided, at every stroke. That is where the numbers
come from:

```
stage k spans r ∈ [18 + k·T/3, 40 + k·T/3]     stage length 22, overlap 6
T ∈ [0, 48]                                     tip ∈ [43, 91]
```

Stage 3 is 3 units longer than the others: its nose cap is wider than the bore it
slides in, so it cannot retract flush and there is always a painted point showing.
That is also what keeps the closed state legible.

## Why the spokes are unequal

`REACH` is a fixed twelve-entry table of per-ram stroke ratios, 0.62 to 1. It is not
decoration and it is not random: the rams are not interchangeable, because nesting
twelve identical telescopes around one hub means the long ones foul. Retracted, every
tip is at the same radius — the array closes to an even star. It is *extension* that
is ragged, which is what the reference actually shows.

An array with a different ram count indexes the same table, so the pattern is stable
for any count and identical between server and client.

## Ranks, and why the machine has a view

Rams alternate `+pitch` and `−pitch` about the hub plane, two ranks of six. In plan
both ranks foreshorten by the same `cos(pitch)`, so the view the machine was designed
in is unaffected — the identity projection is still the star. Tip the camera and the
array opens into two cones, which is the only reason a flat machine is worth looking
at from the side. `pitch={0}` collapses it to a genuinely flat array and the tipped
views go to a line, which is what a flat array seen edge-on is.

## The contract

| axis | prop |
| --- | --- |
| whole-array extension, controlled | `extension` (0..1) |
| per-ram extension, controlled | `strokes: number[]` — length sets the ram count |
| uncontrolled | `behavior: "bloom" \| "ripple" \| "index" \| "flutter" \| "static"`, default `flutter` |
| geometry | `rams` (0..24), `pitch` (0..40°), `spin` (degrees) |
| camera | `view`, native `plan` |
| person | `interactive` — drag out from the hub, arrows, Home/End |

`data-bloom`, `data-hub`, `data-ram="<i>"`, `data-blade`, `data-lamp`, `data-envelope`.

Behaviours, exported as pure functions of the clock: `bloomGoal(behavior, clock)` is
the array's own extension, `ramStroke(behavior, extension, clock, index, count)` is how
that extension is distributed around the ring. `bloom` drives every ram together,
`ripple` runs a travelling wave, `index` drives one ram at a time with the rest parked
back, `flutter` is a small dither about a setpoint.

`flutter` is the default, at a setpoint of 0.9. A stranger who installs this and renders
`<RadialBloom />` should see the machine *working* — the open ragged star, holding station
and breathing — not a hub that happens to be shut at the moment they looked. `bloom` is the
behaviour that runs the whole stroke, and it is one word away.

## Why the spoke is one colour

The first cut alternated the four stages `dark / shell / metal / shell`, on the set's usual
rule that segments down a chain read as separate parts. On this machine it was wrong: it
banded each spoke into four blocks and destroyed the radial read at 150px, which is the only
thing this silhouette has. A telescope is not four differently coloured parts — it is one
member that steps down in diameter. So the three moving stages are all `shell`,
tapering `4.4 → 3.4 → 2.4 → 1.6` half-width to a chisel point, and only the sleeve takes a
different role — `metal` — because it is the one stage that does not move, and that
distinction *is* the mechanism. What says where the joints are is the `metal` collar at each
mouth, which is what says so on the real thing.

## What is solved and what is drawn

Solved: stage positions and overlaps, the per-ram tip radius, the projection of every
stage from world units through `robotCamera`. Every stage is a convex slab pushed
through `slabPath`, so its silhouette is exact from all four cameras rather than four
drawings.

Drawn: the hub's face detail — bolt circle, bearing, index tick — which is flat artwork
laid on the hub top through `camera.plane`, and the collars at each stage mouth, which
are decoration sized to the stage they sit on rather than parts with their own motion.

## Distinctness

`rotary-table` indexes one platter; `robot-sunflower` places a lattice by the golden
angle and does not move it; `linear-actuator` and `voice-coil-actuator` are single
strokes seen from the side; `lidar-scan` is a polar plot, not an object. Nothing in the
set is an array of independently stroked members on one hub, and nothing else takes a
vector of values and shows it as real machined travel rather than as a chart.
