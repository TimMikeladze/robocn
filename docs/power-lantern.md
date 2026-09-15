# The power lantern

A hand-carried charge reservoir in the old marine-lamp form: a squat barrel of ribbed prism
glass inside a cage of bowed straps, between a flared foot and a stack of collars under a
domed cap, hung from a stem and an eye. The charge port is a round boss on its *face* — a bore
with an iris in it that a ring seats into, head-on to the reader — with a conduit that moves
charge out of the reservoir and into the ring, an inscription collar that lights a glyph at a
time while the recital runs, and an emission cone out of the port paid for out of the same
reserve.

The form comes from a reference photograph of a period lantern: the proportions (a body about
0.6 as wide as the machine is tall, a cap a quarter of the height, a foot a fifth), the ribbed
prism barrel, the bowed cage straps standing off the glass, the stacked collars, the stem and
hanging eye, and the round port on the face. Nothing was traced, no colour was sampled, and
the machine is named for its job.

Two items:

| Item | Type | What it is |
|---|---|---|
| `lantern-geometry` | lib | The exploded-assembly schedule, the charge model, the recital, the reserve gauge, the cage, and the emission column. |
| `power-lantern` | ui | The machine: the reservoir, the dock, the ring, the recital, the beam, and every part of it coming off in the order it was fitted. |

## The axis the set did not have

Three machines here already come apart — `battle-station` blooms its hull plates outward
along their own normals, `custodian-droid` runs armour segments out on radial rails,
`tool-changer` separates two halves. All three are *one* motion shared by every part.

This is an **ordered exploded assembly**: a list of parts, each with the axis it was fitted
along and the distance it has to travel to be clear, taken apart in the reverse of the order
it was built in. Part *k* does not start moving until the parts fitted after it are already
on their way out, so the animation reads as a teardown rather than a shell expanding. At
`exploded={0}` every offset is exactly the zero vector — the assembly is not *nearly* back
together, it is back together — and at `exploded={1}` every part is exactly its own clearance
away.

That schedule is the reusable part, and it is why the maths is a lib rather than a table in
the component: `explodeAssembly(parts, progress)` is about parts and fitting order, not about
lanterns.

**Projection is linear**, so a world-space offset projects to a pure screen offset:
`camera.project(offset.x, offset.y, offset.z)` is the translation to hang on the part's group.
One offset, four cameras, no second drawing — which is the whole reason the exploded view
works from `iso` as well as it does from `front`.

## What "a battery" means here

Everything the machine claims is a number it computes:

- **A reservoir with a finite reserve.** `charge` is 0..1 of the cell's capacity. It is not a
  brightness setting: the glow, the gauge, the beam's reach and what the dock can deliver all
  come off it.
- **A dock on the face.** `ring="docked"` seats a ring in the port on the front of the body,
  the iris opens to take it, and the conduit up the column lights in proportion to what is
  actually moving. The port faces the reader in the machine's own view, which is why the
  ring's charge reads as an arc of the ring rather than as an edge-on line.
- **Charge transfer that conserves.** `stepCharge` moves charge out of the reservoir and into
  the ring at a rate, against the ring's own capacity, and what leaves one arrives in the
  other: `reservoir + cell` after a step equals what it was before, minus exactly what the
  emitter drew. There is no step size at which that stops being true — the model is piecewise
  linear and solved in closed form, so one 10-second step and a thousand 10-millisecond steps
  give the same state to floating point.
- **A recital.** The inscription collar carries glyph cells round the band, and `recital`
  lights them one at a time. The `oath` behaviour gates the transfer to it: the ring is full
  at the moment the last glyph lights, because the rate was solved from the cell capacity and
  the length of the recital, not tuned until it looked right.
- **Emission that costs something.** The beam is a cone out of the port, and running it draws
  the reserve down. Its reach follows the inverse-square law: for a fixed threshold,
  `reach ∝ √intensity`, so twice the power is √2 the distance — not twice.
- **A reserve state.** `depleted / low / nominal / full` off the reserve, which is what the
  lamp and the gauge read from. Nothing else in the drawing invents a state.

The **glyphs are abstract marks** — three bars per cell from a deterministic hash of the cell
index. There is no text, no language, and nothing to read.

## Parts, and the order they come off

Fitted from the plinth up; removed from the crown down. Each part's clearance grows with how
late it was fitted, so the stack spreads instead of colliding, and the cage ribs leave along
their own radials rather than up the axis.

| Removal rank | Part | Fit axis | Clearance |
|---|---|---|---|
| 0 | `ring` (the workpiece, not part of the assembly) | −z, out of the face | 42 |
| 1 | `iris` | −z | 32 |
| 2 | `bezel` (the port boss) | −z | 23 |
| 3 | `hanger` (stem and eye) | +y | 40 |
| 4 | `finial` (the vent cap) | +y | 32 |
| 5 | `hood` (the dome) | +y | 25 |
| 6 | `collar` (the inscription band) | +y | 18 |
| 7 | `rib` ×N (the cage straps) | outward radial, per strap | 24 |
| 8 | `cell` (the prism barrel) | +y | 13 |
| 9 | `core` (the emitter column) | +y | 6 |
| 10 | `plinth` | +y | 3 |
| 11 | `base` | 0 |

Two different fit axes is the point of the schedule rather than a complication of it: the port
was fitted to the face and leaves along the face's own normal, so in the machine's own front
elevation it comes almost straight at the reader and hardly moves on screen, while in `profile`
and `iso` it clearly walks off the body. That is what a projection of one geometry looks like;
it is not four drawings.

There is no collision model and no fastener model: parts pass through each other's paths the
way they do in every exploded drawing, and `exploded` runs backwards as happily as forwards.

## The contract

Everything the set already keeps: `size`, `variant` (paint only), `view` (`front` native, one
geometry through `robotCamera`), the palette roles, `px()` on every computed coordinate,
finite-clamped inputs that degrade to a neutral pose, `role="img"` unless `interactive` makes
it a slider, and reduced motion parking the loop without disabling the drag.

Two controlled channels, because the machine has two things a person wants to hold:
`control="exploded"` (the default) puts the drag and the arrow keys on the teardown;
`control="charge"` puts them on the reserve. Whichever is not grabbed still runs off the
behaviour clock, and supplying either prop pins that channel and leaves the other running.

`data-*` hooks, which are API:

`data-lantern`, `data-view`, `data-exploded`, `data-charge`, `data-reserve`,
`data-part="base|plinth|core|cell|rib|collar|hood|finial|hanger|bezel|iris|ring"`,
`data-rib`, `data-prism`, `data-glyph` with `data-lit`, `data-gauge`, `data-segment`,
`data-dock`, `data-port-glow`, `data-conduit`, `data-beam`.

## Behaviours

Pure functions of the clock, exported as `lanternBehaviorState(behavior, clock)`:

- `charge` — the ring docked and taking charge at a constant rate; the cell fills at 0.8 of
  the cycle and the reservoir is down by exactly what the ring took.
- `oath` — the same transfer gated to the recital, ending together.
- `emit` — a trapezoidal beam gate, with the reserve drawn down by the integral of the gate
  rather than by its peak.
- `idle` — a held reserve, with the core breathing.
- `service` — the teardown: all the way apart and back together, which is the proof that
  `exploded={0}` reassembles exactly.
- `static` — parked.

## Illustrated, and saying so

Solved: the explode schedule, the charge transfer and its conservation, the recital count, the
gauge segments, the beam's reach, the cage placement — straps bowed on their own profile and
drawn as two sections of one bar, so a strap keeps a width when it is seen edge-on — its depth
ordering, and all four projections. Illustrated: the glow itself, the prism ribs, the vent
slots, the bolts and the knurling. There is no thermal model, no efficiency, no internal resistance and no discharge
curve — the transfer is a rate and a capacity, and nothing here claims otherwise.

## Originality

An original archetype: a caged reservoir lantern that charges a ring. No franchise name,
insignia, oath text, or paint scheme, here, in the component, in the demo labels or in the
defaults — the emission colour is the theme's accent, and `accent` is a prop.
