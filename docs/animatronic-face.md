# Animatronic face — an expressive head as solved actuator channels

The set already has two faces. `robot-face` is a flat panel with six moods: eyes, a mouth
glyph, no volume and no mechanism. `reachy-mini` is a companion head on a solved Stewart
platform, but its *face* is a drawing — two eyes that slide, and nothing else moves.

`animatronic-face` is the third and the expressive one: an anthropomorphic head whose face is
a **rig of servo channels**, the way a real animatronic is built. Brows, eyelids, cheeks,
nose, lip corners and jaw are all driven; an expression is a blend of channel targets, not a
swap of artwork.

## What ships

| item | type | what it is |
|---|---|---|
| `face-actuation` | lib | The action-unit rig: channel definitions, expression blending, servo strokes, ellipsoid silhouette projection. No React. |
| `animatronic-face` | ui | The head. One 3-D geometry, four cameras, nine expressions, four behaviours, pointer-tracked gaze. |

## Decision: an action-unit rig, not a mood-to-artwork table

Every expression resolves through one intermediate: a **channel vector**. A channel is one
servo on the rig.

| channel | range | mechanism |
|---|---|---|
| `browInner` | −1 … 1 | inner brow tip: down is anger, up is sorrow |
| `browOuter` | −1 … 1 | outer brow tip: up is surprise |
| `lidUpper` | 0 … 1 | upper lid closing over the eye |
| `lidLower` | 0 … 1 | lower lid raising — the squint that makes a smile read |
| `cheek` | 0 … 1 | cheek plate lifting |
| `noseWrinkle` | 0 … 1 | nose bridge shortening |
| `lipCorner` | −1 … 1 | mouth corner: down sorrow, up joy |
| `lipPress` | −1 … 1 | lips slack to pressed thin |
| `lipPucker` | 0 … 1 | mouth rounding |
| `jaw` | 0 … 1 | jaw plate hinging open |

Six of those are **paired** — left and right are separate servos. That is what buys the
asymmetry a real face has, and it is the whole reason `doubt` (one brow up, one level) is
expressible at all rather than being a second drawing of a brow.

`solveFace()` takes an expression, an intensity, a gaze, a blink, a speech level and any
explicit channel overrides, and returns the resolved per-side channel values plus one
`FaceActuator` per servo carrying its stroke in world units and whether it ran out of travel.
Nothing downstream ever branches on the expression name: the drawing reads channels.

Consequences that matter:

- **Blending is real.** `intensity` scales the whole vector, so `joy` at 0.3 is a different
  face from `joy` at 1.0 rather than the same picture faded. `blendFace()` mixes two
  expressions, which is what the `emote` behaviour walks through.
- **Speech and blink are additive, not modal.** A head can be mid-`sorrow`, blinking, and
  talking; the jaw and the lids compose instead of one winning.
- **Faults are honest.** Asking for more than a servo's travel lights the fault lamp and
  paints that actuator in the accent colour. The component clamps its own inputs, so the only
  way to see a fault is to tighten `geometry.travel` — same contract as `reachy-mini`.

## Decision: the head is an ellipsoid, projected exactly

Every feature is a 3-D point on the head, and every view is the same shared
`robotCamera(view)`. Nothing is redrawn per angle.

World axes: **x** the robot's right, **y** up, **z** toward the back of the skull. The face
looks down `−z`, which lands face-on in `front` — the native view.

The skull itself is an ellipsoid. Under an orthographic camera an ellipsoid's silhouette is
*exactly* an ellipse, so `ellipsoidOutline()` composes camera × neck rotation × radii into a
2×3 matrix `A`, takes the 2×2 shape matrix `AAᵀ`, and eigen-decomposes it into a semi-major, a
semi-minor and an angle. One `<ellipse>`, exact in all four views, correct under neck yaw,
pitch and roll. No hull, no per-view artwork, no 40-segment polygon.

Features sit **on** that surface: `onFace(x, y)` solves the ellipsoid for `z`, so an eye moved
outboard also moves back, and the brow line curves round the temple by itself in `iso`. Lids,
brows and the mouth are 3-D polylines through the same solve; eyes and irises are small discs
projected by the same ellipsoid routine with one radius flattened, so they foreshorten to
slivers in `profile` the way a real eye does.

The jaw is a hinge, not a morph: the lower-face plate rotates about a real axis through the
ear servos at `y = −10, z = +18`, and every point of it is rotated in 3-D before projection.

## Decision: the actuators are drawable

`showActuators` draws each servo as a push-rod from a frame ring behind the face to its
feature anchor, depth-sorted with the head. It is the same idea as `reachy-mini`'s six rods:
the thing that is solved is the thing you can see. Turned off by default, because the face is
usually the point.

## Behaviours

Four, plus `static`. All are pure functions of the clock, exported, so the tests never fake
animation frames.

| behaviour | what it does |
|---|---|
| `idle` | breathes, micro-saccades, drifts the brows, blinks on an irregular cycle |
| `converse` | a speech envelope opens the jaw and works the lip corners; the head nods on phrase boundaries |
| `listen` | head tilts, brows lift, gaze holds on the pointer, an occasional agreeing nod |
| `emote` | walks the whole expression set, easing through `blendFace()` |

A controlled `expression` still lets the behaviour drive everything it does not name — the
same rule as the rest of the set.

## Integration

`docs/animatronic-face.md` (this file) · `src/lib/robocn/face.ts` + its test ·
`src/components/ui/animatronic-face.tsx` · `registry.json` (two items) · `src/lib/docs.ts`
(two entries) · `src/components/demos/demos.tsx` · `src/components/site/catalogue.tsx` ·
`README.md` · `src/components/ui/__tests__/animatronic-face.test.tsx` ·
`src/components/ui/__tests__/views.test.tsx`.

## Originality

An archetype, not a character: a service-robot head with visible servo housings and a
seamed shell. No franchise name, no character markings, no borrowed paint scheme. It is named
for what it is — a face driven by actuators.
