# The airliner

A four-engine double-deck widebody, drawn once in world units and projected — and the first
machine in the set you can turn to *any* angle and take completely apart at the same time.

Reference: a technical cutaway poster of a four-engine double-deck jetliner. Read for
silhouette, proportion, the structure under the skin and what an exploded service drawing
shows. Nothing traced, no livery, no manufacturer's marks — it is named for its job.

## What ships

| Item | Type | What it is |
|---|---|---|
| `airframe` | lib, new | The loft and the gear kinematics: `fuselageSection`, `fuselageRing`, `wingStation`, `wingSurface`, `wingPanel`, `gearRetraction`, `controlMix` |
| `airliner` | ui, new | The machine: skin, structure, cabin, wing, empennage, four engines, five gear units, free orbit, exploded teardown |

## Why a new lib

Nothing in the set lofts a body along a horizontal axis. `produce.ts` revolves a profile about
`y` for a fruit; `hull.ts` tiles a sphere. A fuselage is neither: it is a **non-convex** body
along `z` with a second lobe on top over its forward third, and a wing is a swept, tapered,
dihedral, kinked planform that has to be sampled at any station. Both are pure geometry over
plain objects, both are reusable by anything else with wings, and neither belongs inside a
component file.

The genuinely *solved* mechanism is the gear.

## Kinematics: `solveElbow2`, for the side stay

Two links, so the law of cosines — the cheap, stable answer the table calls for.

A retracting leg is not an animation of a leg getting shorter. The oleo swings about a fixed
**trunnion**, and a two-part **side stay** — anchored to the structure, broken at a knee —
folds as it goes. Given the leg's angle, the stay's foot is known, so the knee is an elbow
solve between the anchor and that foot:

```ts
const knee = solveElbow2(anchor, foot, stay.upper, stay.lower, bend)
```

The stay is what makes a retraction read as machinery rather than as a rotation: it folds one
way, it is straight and locked when the gear is down, and it is what the door has to clear.
Out of range clamps onto the annulus instead of producing `NaN`, which is the property every
solver here keeps.

Everything else about the aircraft is a **loft** or a **mix**, and the docs `notes` say so.
`controlMix` is a real mixing function — the outboard ailerons lock out as the flaps come in,
the way a big aeroplane's do — but nothing here computes lift, drag, load factor or a stall.
The aircraft does not fly; it is a machine on a stand.

## The skin is longitudinal panels, not a silhouette

Most machines here are convex solids: `slabPath` wraps their projected corners in one hull and
that is exact. A fuselage with an upper deck is **not convex** — the crown fairs back down
behind the hump — so one hull would cut that corner off, and a hull per lengthwise slice would
show seams across the body.

So the skin is built the other way round: **one path per longitudinal panel**, running nose to
tail along two adjacent vertices of every cross-section. Sixteen panels per fuselage section.
This buys four things at once:

- the non-convex crown comes out right, because no panel spans it;
- the panels carry the skin's own lap-joint lines for free, as their strokes;
- a panel has a normal, so it can take a **wash from a fixed light** and the body reads as a
  body rather than as a corrugated tube. Fixed to the machine, not to the camera: which side of
  a fuselage is lit should not change because the reader walked round it;
- **the cutaway is a camera-relative cull.** `cutaway` opens the panels facing the reader —
  at 1 exactly the near hemisphere, no more — and the frames, decks, seats and cargo behind
  them are simply there. An opened panel is not deleted: its outline stays, so the silhouette
  of the aeroplane survives being cut. Turn the machine and the cut follows the camera, the way
  a cutaway drawing always does.

## Painter's order, because it turns

Every drawable is emitted as `{ depth, node }` and the whole set is sorted once per frame.
`camera.depth` is larger toward the reader, so the list is drawn ascending. That is the only
thing that makes a *freely* orbited machine legible: at 40° the port wing is in front of the
body and at 220° it is behind it, and no fixed order can be right at both.

`debris-field` sorts because it is a population; `pumpjack` explicitly does not, because all
four of its cameras keep `sin(azimuth) ≥ 0`. This machine has no such luxury — `azimuth` is
any angle at all.

## The teardown

`explodeAssembly` from `assembly-geometry`, unchanged. Fit axes are the set's world axes —
`x` starboard, `y` up, `z` aft, nose at `−z` — and stages, not parts, so a handed pair leaves
together.

| order | stage | axis | travel |
|---|---|---|---|
| 0 | centre section and wing box | — | 0, it is the bench |
| 1 | forward fuselage `−z`, aft fuselage `+z` | ±z | 44 / 40 |
| 2 | radome `−z`, tail cone `+z` | ±z | 74 / 66 |
| 3 | wings, port and starboard | ±x | 52 |
| 4 | fin | `+y` | 42 |
| 5 | tailplanes, port and starboard | ±x | 40 |
| 6 | rudder and elevators | `+z` | 26 |
| 7 | pylons | `−y` | 24 |
| 8 | engines | `−z` | 36 |
| 9 | slats `−z`, flaps and ailerons and spoilers `+z`, winglets `+y` | ±z | 22 |
| 10 | gear, all five units | `−y` | 34 |
| 11 | decks, cabin and cargo | `−y` | 48 |

The travels are set so the machine stays legible in its own frame rather than as far as a part
could physically go: an exploded drawing you cannot read is not a drawing.

Read backwards that is the real order: unload the holds and drop the decks out, pull the five
gear units, strip the moving surfaces off the wing, engines off the pylons, pylons off the
wing, rudder and elevators, tailplanes, fin, wings off the wing box, radome and tail cone,
then the forward and aft fuselage off the centre section that was the bench.

**Exploding parks the aircraft.** Gear goes down and locked, the surfaces go to neutral and the
configuration freezes over the first sixth of the teardown — a service drawing of a machine
mid-flare is nonsense, and an offset from a seat that is itself moving means nothing.

**Framing** is a fixed seated envelope grown by `explode` alone, through `assemblyEnvelope`.
The frame zooms out when you take it apart and at no other time; it never breathes with the
surfaces or the gear.

**The shadow** is the machine's own footprint, drawn in the plan plane and pushed through
`camera.plane(0)` — so it foreshortens into the right oval from every camera instead of being a
circle that happens to be underneath.

## The axes

| Prop | What it is |
|---|---|
| `view` | the four named cameras. Native `iso`, which is the angle the sweep, the hump and all four engines read from at once |
| `azimuth` / `elevation` | any angle at all, **on top of** `view`. Azimuth wraps; elevation is clamped to ±88, since past the pole the camera is under the floor |
| `explode` | 0 seated to 1 every part its own clearance away |
| `configuration` | 0 clean to 1 dirty — slats, the three flap sections, and the gear, in that order, because that is the order they come out |
| `gear` | the legs on their own, when the caller wants them apart from the flaps |
| `pitch` / `roll` / `yaw` | commands, through `controlMix`, not surface angles |
| `cutaway` | 0 skin closed to 1 the reader's side opened |

## `data-*`

`data-frame` `data-view` `data-tool` on the drawing group, then one per mechanism:

| Attribute | On |
|---|---|
| `data-fuselage` `data-panel` | one skin panel, by section: `radome` `forward` `centre` `aft` `tailcone` |
| `data-cut-panel` | a panel the cutaway has opened, drawn as its outline alone |
| `data-frame-ring` | a frame inside the shell |
| `data-windows` | one deck's window belt on one side |
| `data-fairing` | the belly fairing over the wing root |
| `data-wing` `data-strip` | one strip of the wing box, port or starboard |
| `data-slat` `data-flap` `data-aileron` `data-spoiler` `data-bay` | one moving surface on the wing |
| `data-winglet` | the canted tip |
| `data-fin` `data-rudder` `data-tailplane` `data-elevator` | the empennage |
| `data-pylon` `data-engine` `data-fan` | one of the four engines, numbered 1 to 4 from port |
| `data-gear` `data-leg` `data-stay` `data-wheel` | one of the five units: `nose` `wing-port` `wing-starboard` `body-port` `body-starboard` |
| `data-cabin` | a deck, a seat row, the flight deck, or a container |
| `data-lamp` | a navigation lamp or a beacon |
| `data-leader` `data-ground` | the teardown's leaders, and the contact shadow |

## Invariants the tests hold

- `explode = 0` puts every offset at exactly the zero vector.
- The stage order is the fitting order reversed, and no part moves backwards.
- A retracted leg's stay never exceeds its own two link lengths, at any fraction.
- `wingStation` is monotone in `x` and its dihedral rise is monotone with it.
- `fuselageSection` is continuous across the barrel joins, and the crown is never below the
  centreline.
- Every behaviour is a pure function of the clock, sampled rather than driven by frames.
- Rubbish in — a `NaN` explode, an infinite azimuth, a stale `behavior` string — renders a
  stable neutral pose and no `NaN` reaches the DOM.

## Integration

`registry.json` (two new items), `src/lib/docs.ts`, `demos.tsx`, `catalogue.tsx`, `README.md`,
`src/components/ui/__tests__/views.test.tsx`, `src/components/ui/__tests__/airliner.test.tsx`,
`src/lib/robocn/__tests__/airframe.test.ts`, and `public/og/airliner.png`.
