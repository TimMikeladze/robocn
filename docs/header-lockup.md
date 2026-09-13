# The header lockup

A redesign of the mark and of the type, alignment and sizes around it. The old
header put a 28 px stick-figure arm beside a 17 px wordmark and then a 13 px nav,
with nothing separating the lockup from the navigation.

## What was wrong

| | problem |
| --- | --- |
| mark | link strokes (2.6/2.2/1.4) and joint hubs (2.5/2.1/1.6) were the same weight, so limb and joint did not read as different things; a bore punched through all three joints left the mark moth-eaten at 28 px; the plinth was a 3 px smudge; the parked pose put every bit of mass on the lower-left diagonal and left two corners of the box empty, so the mark looked tilted next to a horizontal wordmark |
| lockup | a mark with no footprint has no edges to align to. The 28 px arm was 2.3x the wordmark's cap height and still read as lighter than it |
| type | 17 px wordmark against a 13 px nav is a 1.31 ratio — too close to read as hierarchy, too far to read as one row. Default tracking on a six-letter lowercase wordmark |
| nav | 24 px from the wordmark, so it read as part of the brand rather than as navigation. No active-page state at all |
| icons | `p-2` around a `size-4` glyph: no hit-target shape, no hover affordance |

## The mark: the machine in its cell

The arm stays a real three-link chain solved by `useRobotArm` every frame — that
claim is the whole point of the mark. What changes is everything around the solve.

**It is drawn inside a work cell.** A rounded square, faintly tinted in the
machines' orange with a hairline edge. This is the load-bearing change:

- a bare stick figure has no silhouette at 16 px; a tinted square with something
  angular inside it does. The mark now survives a favicon
- a square is a box the wordmark can be optically centred against. Alignment stops
  being a judgement call
- the orange now reads as *lit* — a machine under light in a cell — rather than as
  a scribble floating on the header
- it is honest: a robot arm in a work cell, which is also what a component tile is

**The machine is bolted down.** A floor bar and a solid plinth carry the shoulder,
so the arm stands on something instead of hanging in space.

**Limb and joint are now different weights.** Links taper 2.6 -> 2.0 -> 1.3 from
shoulder outward; hubs run 3.0 / 2.3 / 1.5, each wider than the link it caps, so a
joint reads as a collar rather than as a bead on a string.

**Only the two big joints are bored.** At 28 px a ring around the wrist hub was
under a pixel. Shoulder and elbow keep their bore (1.4 and 1.2 px of ring at 28 px);
the wrist is solid.

**The parked pose fills the box.** Shoulder at (8.9, 15.4) on its plinth, tip
parked at (16.8, 6.6) — 0.86 of a 13.8 reach, so the elbow stays visibly bent and
the arm runs corner to corner instead of hugging one diagonal.

## Type and spacing

| | before | after |
| --- | --- | --- |
| mark | 28 px, no footprint | 28 px cell |
| wordmark | 17 px / 600 / default tracking | 16 px / 600 / `-0.02em`, `leading-none` |
| mark -> wordmark | 8 px | 10 px |
| wordmark -> nav | 24 px | 16 px, a hairline rule, 16 px |
| nav | 13 px regular, 20 px apart | 13 px medium, 20 px apart |
| nav active | none | `text-foreground` on the longest matching route |
| icon buttons | `p-2` | 32 px square, `rounded-md`, `hover:bg-accent` |

`leading-none` on the wordmark is what makes `items-center` centre the *letters*
against the square rather than centring the line box, which sits low.

The hairline rule is the fix for "the nav belongs to the brand": it costs one
`<span>` and it ends the lockup. Hidden below `sm`, where the nav is the only thing
left on the row anyway.

## Active state

The nav is split out as `site-nav.tsx` so it can read `usePathname` without making
the whole header a client component. The active item is the link with the **longest
matching href prefix**, so `/docs/installation` lights *Install* rather than both
*Install* and *Components*.
