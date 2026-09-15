# The pumpjack teardown

Adds an exploded assembly axis to `pumpjack`, and promotes the schedule that drives it out of
`lantern-geometry` into a lib of its own.

## What ships

| Item | Type | What changes |
|---|---|---|
| `assembly-geometry` | lib, new | `explodeAssembly`, `explodeFraction`, `AssemblyPart`, `ExplodedPart`, and `assemblyEnvelope` |
| `lantern-geometry` | lib | Imports the four from `assembly-geometry` and re-exports them. No behaviour change, nothing to migrate. |
| `pumpjack` | ui | `explode`, `onExplodeChange`, `explodeOverlap`, `showLeaders`, and a `service` behaviour. |

## Why the solver moves

`explodeAssembly` was written for the lantern but has nothing lantern-shaped in it: parts, fit
axes, an order, a progress. Leaving it there means installing a pumpjack drags in charge
transfer, recitals, reserve gauges and an emission column it has no use for.

`lantern.ts` re-exports, so `import { explodeAssembly } from "@/lib/robocn/lantern"` keeps
working in anything already installed.

## The parts table

Fit axes are the set's world axes — `x` starboard, `y` up, `z` aft — and the pumpjack's
drawing runs along `-z`, so "forward, off the beam's nose" is `+z` and the handed pairs are
`±x`. Stages, not parts: everything fitted at the same time leaves together.

| order | stage | axis | travel |
|---|---|---|---|
| 0 | skid | — | 0, it is the bench |
| 1 | samson post, gearbox, prime mover | `+y` | 24–30 |
| 2 | saddle bearing | `+y` | 24 |
| 3 | walking beam | `+y` | 28 |
| 4 | horsehead `+z`, equalizer `−z` | fore and aft | 34 / 24 |
| 5 | crank discs | `±x` | 24 |
| 6 | counterweights | `±x` | 22 |
| 7 | pitmans | `±x` | 34 |
| 8 | bridle, carrier bar, polished rod | `−y` | 20 |

Read backwards that is the real order: pull the rod, then the pitmans, then the weights, then
the cranks, then the horsehead and equalizer, then the beam off the saddle, then the saddle,
then the post and gearbox off the skid.

**The wellhead does not explode.** It is the well, not the pump — you do not take the well
apart to service the machine standing over it. It stays put and gives the drawing a fixed
reference, the way the lantern treats the ring it is charging.

**Lateral fit axes are new to the set.** The lantern is a body of revolution stacked on one
axis; this is the first assembly that is bilaterally symmetric, and the cranks, weights and
pitmans come off sideways in handed pairs. That reads in `iso` and `front`. In `profile` it is
foreshortened to almost nothing, because a side elevation genuinely cannot show a lateral
move — the 10° elevation leaves only a little vertical parallax. That is the projection being
honest, not a bug, and the docs `notes` say so.

## Freezing the linkage

An exploded view of a *moving* four-bar is nonsense: parts float off seats that are themselves
swinging, and an offset stops meaning anything. So `explode > 0` parks the crank.

Where it parks is derived, not typed. The service position is the one a manual draws — beam
level — and that is an inverse four-bar problem, so it is scanned:

```ts
const PUMPJACK_SERVICE_ANGLE = (() => {
  let best = 0, error = Infinity
  for (let angle = 0; angle < 360; angle += 0.25) {
    const beam = Math.abs(signed(solveFourBar(angle, GEOMETRY, { branch: "down" }).rockerAngle))
    if (beam < error) { error = beam; best = angle }
  }
  return best
})()
```

The crank eases onto it over the first sixth of the explode, on the shortest arc, so the
machine parks rather than snaps and scrubbing back resumes the pump. Module scope, so the scan
runs once per process, not per render.

## Framing

`fitFrame` is fed a *fixed* envelope on purpose, so the frame cannot breathe as the machine
works. An exploded machine is bigger than a seated one, though, so the envelope is interpolated
between a seated box and an apart box **by `explode` alone** — never by the crank angle. The
frame zooms out when you take it apart and at no other time, which is what a service animation
does.

## No depth sort

`debris-field` sorts its fragments because it is a population with no fixed order. This is not
that. The handed pairs separate along `±x`, and all four cameras have `sin(azimuth) ≥ 0`
(plan 0°, front 180°, profile 90°, iso 145°), so `+x` is never further from the camera than
`−x`. Drawing port before starboard is correct at every angle, which is already what the
component does. No sort is added, because none is needed.

## Leaders

A leader is the offset negated: a dashed line from where a part sits now back to its seat.
Free, since the offset is already in hand. `showLeaders` defaults to on while exploded and
draws nothing at rest.

## Invariants the tests hold

- `explode = 0` puts every offset at exactly the zero vector — seated, not nearly seated.
- `PUMPJACK_SERVICE_ANGLE` really does level the beam, to under a quarter degree.
- The stage order is the fitting order reversed, and no part ever moves backwards.
- The rod stroke is unchanged by any of this: `pumpjackCarrier` is the same function it was.

## Integration

`registry.json` (new lib item, `lantern-geometry` and `pumpjack` dependencies), `src/lib/docs.ts`
(a Foundations entry, pumpjack prop rows), `demos.tsx` (an explode control and the
`assembly-geometry` demo), `catalogue.tsx` (a card), `README.md` (a row),
`src/components/ui/__tests__/oil-field.test.tsx` and `src/lib/robocn/__tests__/assembly.test.ts`.
