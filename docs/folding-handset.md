# The folding handset

A sixth machine for the carried set, and one more closure under it. `slab-handset` already
covers the rigid candybar: its honest mechanism is its *attitude*, because a slab has no
joints. The folding handset is the opposite case — a handset that is a mechanism, with a
display that has to survive being bent in half.

The brief named a manufacturer's folding phone and carried two reference images that did not
reach the session (the prompt arrived with placeholders, no image data). So this is built from
the archetype the category has converged on rather than from a render: a book fold, portrait
leaves, a continuous inner display, a cover display on the outside, and the cameras on the
other outside face.

## What ships

| Item | Mechanism | Native view |
|---|---|---|
| `device-geometry` | + `foldPose`: a book fold whose display keeps its own length | — |
| `folding-handset` | two leaves rolling on a water-drop bend, 0° shut to 180° flat | `front` |

Front elevation is the native view because both ends of the travel land face-on to it: the
cover display shut, the whole inner display flat. `plan` is where the mechanism itself reads —
the V, and the gap at its root.

## Why the bend is solved

A folding phone drawn as "two rectangles at an angle" gets the one thing wrong that the whole
product is about. The display is a single sheet. It cannot stretch, and it cannot be creased
to a knife edge — it bends through a finite radius. Everything a reader recognises as a
foldable falls out of those two facts:

- **The sheet keeps its length.** The bend consumes `radius × (180 − fold)` of display. That
  length has to come from somewhere, so it comes off the panels: the display peels away from
  the inner end of each leaf as the machine shuts, and `2 × run + arc` is the sheet length at
  every angle. That peeled strip is the teardrop cavity, and it is why a shut foldable has a
  visible gap rather than meeting flush.
- **The leaves roll, they do not pivot.** Both leaf planes stay tangent to the bend circle, so
  the panels roll around it. That is what the cams in a water-drop hinge are for, and it is
  what puts the shut leaves `2 × radius` apart with the bend tucked inside the cavity instead
  of pinched at the spine.
- **The panel is rigid.** `hinge → tip` is exactly `leaf` at every angle, pinched or not. The
  display shortens; the machine does not.
- **The fault is reported.** Ask for a bend radius too big for the leaves and `foldPose`
  returns `pinched` with `run` clamped to zero, the same way `standPose` returns `folded` for a
  kickstand leg that cannot reach the desk. Nothing is stretched to hide it.

The solver works in the fold's own symmetric frame, where both leaves swing by half the
closure toward the front of the machine. The component then applies one rigid rotation that
holds the port leaf still, because that is how a hand opens it: the other leaf comes *toward*
you and lands on top, which is what puts the flat inner display and the shut cover display
face-on to the same camera. Fold it the other way and a half-open machine hides behind its own
fixed leaf — which is exactly what the first render did.

## What is not modelled

No dynamics: no hinge friction, no detent, no torque, no crease memory, and no material in the
sheet beyond its length and its bend radius. The bend is a circular arc, not a real teardrop
spline. The cover display and the camera array are illustrated, and both displays draw
structure in palette roles.

## Distinct from what already exists

`clamshell-laptop` is a lid on a fixed base, hinged on a pin, with a screen on one leaf and
the machine resting on a desk. This is two leaves and no base, hinged on a rolling contact,
with one display across both leaves and a second on the outside, held in the air. The shared
`hingePose` does not describe it: a pin hinge cannot open a gap, and a lid does not have to
conserve a sheet.

## Proportions

Generic category ratios, not measured from any one product: shut face 1 : 2.07 (60 × 124 world
units), open 1.03 : 1, shut thickness 0.2 of the shut width, bend radius 0.05 of the leaf, and
a cover display 0.62 of the shut face's height. The leaves are portrait so the fold axis is
vertical, which is the whole reason shut reads as a phone and flat reads as a small tablet.

## `data-*` hooks

| Attribute | On |
|---|---|
| `data-body` | the assembly, carrying `data-fold` and `data-pinched` |
| `data-leaf="port\|starboard"` | each panel, carrying `data-heading` |
| `data-screen` | the inner display's half on that leaf, carrying `data-half` |
| `data-bend` | the bend itself, carrying `data-arc` |
| `data-hinge` | the spine cover over the cavity |
| `data-cover` | the outer display on the leaf that swings, shut-side |
| `data-lens` | the punch-hole camera, on the inner display and on the cover |
| `data-button="power\|volume"` | keys on the free leaf's own free edge |

There is no rear camera array. The back of the leaf a hand holds is the one face none of the
four cameras can ever see, so nothing is modelled on it: dead geometry that never draws is
worse than an honest omission.

## Originality

An archetype, not a product. No wordmark, no product or model name, no manufacturer, no fruit,
no exact paint scheme, and nothing naming one in a demo label or an `aria-label`. Both displays
draw structure — a status bar, rows, panes, tiles, a clock face — never an operating system's
own artwork or an app icon that stands in for a real one.

## Integration

`registry.json` (the new item, and `device-geometry`'s description), `src/lib/docs.ts` (the
item plus a `foldPose` row on `device-geometry`), `src/components/demos/demos.tsx`,
`src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`'s item table, and tests —
`folding-handset` into `deviceCollection` in `scripts/__tests__/registry.test.ts` and
`deviceSlugs` in `src/components/site/__tests__/docs-catalogue.test.tsx`.
