# Personal devices

Five machines you carry, and the geometry solver under them. The set already has machines
that make something (`fabricator`), machines that move something (`conveyor-belt`) and the
parts a machine is assembled out of (`planetary-gearbox`, `belt-drive`). It has nothing that
sits in a hand — and the hinge, the kickstand, the click wheel and the band are mechanisms in
exactly the sense the rest of the set means it: one degree of freedom, visible, and honest
from four camera angles.

## What ships

| Item | Mechanism | Native view |
|---|---|---|
| `device-geometry` | lib: hinge closure, kickstand triangle, rotary detents, constant-pitch band | — |
| `wheel-player` | a rotary click wheel with detents, scrolling a list | `front` |
| `slab-handset` | the slab's own attitude; the content stays level under it | `front` |
| `clamshell-laptop` | one revolute hinge, 0° shut to 135° open | `profile` |
| `slate-tablet` | a kickstand whose foot has to reach the desk | `profile` |
| `wrist-terminal` | a digital crown geared to a dial, on a band that keeps its length | `front` |

## Originality

The brief named a manufacturer. What ships is the *archetype* each of those products made
common — a click-wheel pocket player, a candybar touchscreen handset, a clamshell laptop, a
propped slate, a wrist display on a link band. Industrial-design archetypes are not anyone's
property; trade dress is. So: no wordmarks, no logos, no fruit, no product names, no exact
paint schemes, no rendered app icons that stand in for real ones, and nothing in a demo label
or an `aria-label` that names a company or a product line. Screens draw *structure* — a list,
a dial, a keyboard, a status bar — in palette roles, never a brand's UI. A stranger should
read these as "a laptop", not as "that laptop".

Proportions are the generic ones the category converged on (a 16:10 lid, a 2:1 handset, a
40mm square-ish watch case), not measured from any one product.

## Why a solver

Four of the five have a closure a drawing can get wrong, and the fifth has a wrap.

- **The hinge** has to keep the lid's length at every angle, and the drawing has to know when
  the lid has passed vertical, because past it you are looking at the back of the screen.
- **The kickstand** is a triangle that must close: the slate's bottom edge is on the desk and
  the stand's foot has to be on the desk too, with the leg at its real length. Recline too far
  on a short leg and the foot cannot reach — `standPose` reports `folded` instead of stretching
  the leg, the same way `motion-platform` reports a leg out of travel.
- **The wheel and the crown** are the same mechanism: a rotary input divided into detents that
  wraps. One turn of the list has to come back to the row it started on, in both directions.
- **The band** keeps its link count and its pitch at every closure, so opening the watch
  cannot make the strap longer. It is integrated as a constant-pitch chain with a curvature
  that varies, which is `spine-kinematics`' trick applied to a bracelet.

None of it is dynamics. There is no friction in the hinge, no detent force, no torque on the
crown, no material in the band, and no contact between the stand's foot and the desk beyond
the requirement that it be there. Every component's docs `notes` say so.

## The shared contract

Everything in `docs/spec.md` holds unchanged: palette roles through `resolveRobotPalette`, a
`size` that only scales, four paint variants that change nothing geometric, `view` on all five
because all five are bodies you can walk round, controlled-prop-wins motion with a `"static"`
behaviour, `interactive` drag plus arrow keys with `on…Change` throughout, `px()` on every
computed coordinate, and a neutral pose for non-finite input.

The one axis these add to the vocabulary is a **screen**: a discrete `screen` prop per
component naming what the display is showing (`list`, `now-playing`, `home`, `call`, `desktop`,
`sketch`, `dial`, `rings`, `off`). It is structure drawn in palette roles, and it is a union,
so an unknown value falls back to the neutral one rather than throwing.

## `data-*` hooks

API, so an outer loop can drive the DOM without re-rendering:

| Attribute | On |
|---|---|
| `data-body` | the slab or case, everywhere |
| `data-screen` | the display, everywhere |
| `data-wheel`, `data-segment="menu\|next\|play\|previous"` | `wheel-player` |
| `data-row="<n>"` | the highlighted list row on the player |
| `data-camera`, `data-button="power\|volume"` | `slab-handset` |
| `data-lid`, `data-hinge`, `data-keyboard`, `data-key="<n>"`, `data-trackpad` | `clamshell-laptop` |
| `data-stand`, `data-stylus`, `data-desk` | `slate-tablet` |
| `data-crown`, `data-dial`, `data-band="upper\|lower"`, `data-link="<n>"` | `wrist-terminal` |

## Integration

Six files each, in one pass per machine: `registry.json`, `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (every view, variant and behaviour reachable),
`src/components/site/catalogue.tsx` (a deterministic posed still), `README.md`, and tests.
The new names go in `droidCollection`'s sibling list in `scripts/__tests__/registry.test.ts`
and in `src/components/site/__tests__/docs-catalogue.test.tsx` — a new `deviceSlugs` array in
each, since these are not droids.
