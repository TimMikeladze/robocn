# The rod pump

Design note for `rodpump-geometry` and `rod-pump`. Joins the family in
[`oil-field.md`](./oil-field.md), which it changes in two ways: it is the family's **second
solver**, and it is the first thing in the set that computes a pressure.

`pumpjack` is the surface unit — a four-bar whose rocker makes a stroke. This is what that
stroke is doing four thousand feet down, and why the polished rod load is not a constant.

## Why it earns a solver

A sucker-rod pump has no chain to solve. The plunger is one reciprocating degree of freedom
hung off a crank, and a pose table would draw it perfectly well.

What it has instead is **mechanics**, and they are the whole subject:

- a fluid column that transfers on and off the rods twice a revolution;
- two ball valves whose sequence is not a schedule but a consequence of where the plunger is
  and which way it is going;
- a gas space below the plunger that compresses, and has to be compressed to discharge
  pressure before the travelling valve will open at all.

Get those three right and the **dynamometer card** falls out of them. That is the reason for
`src/lib/robocn/rodpump.ts`: a pumper reading a card is reading this model, and a card drawn as
six hand-made shapes teaches nothing.

## One chamber, and everything else follows

The mistake worth naming, because the model was built twice: **the two balls are not two
parts that happen to alternate.** They are the two ends of one volume — the barrel between the
standing valve and the plunger — and there is exactly one number that decides both of them.

`chamberPressure(cycle, …)` is that number, normalised so 0 is pump intake pressure and 1 is
discharge:

```
p ≤ 0        the chamber is below the formation   → the standing valve lifts
0 < p < 1    neither                              → BOTH BALLS ARE DOWN
p ≥ 1        the chamber is above the column above → the travelling valve lifts
```

They can never both pass, because one chamber cannot be under the formation and over the
discharge column at the same time. And the middle case is not a gap in the model — it is a
real state, and it is the two ends of a dynamometer card: the plunger is moving and *nothing
is going anywhere*, because all it is doing is changing the pressure. `pumpState` names the
four sides that gives you: `picking-up`, `filling`, `releasing`, `discharging`.

**Which way the plunger is going decides which way the pressure moves.** Going up it expands
whatever gas the clearance kept, from discharge back down toward intake. Coming down it
compresses what is trapped above the liquid, from intake up toward discharge — until it meets
the liquid, which does not compress at all and sends the chamber straight to discharge.
Isothermally, with `Vb` the gas the clearance kept and `Vt` the gas space at the top:

```
up:    p = (1 + ratio) · Vb/(Vb + travel) − ratio
down:  p = ratio · (Vt / (travel − fill + clearance) − 1),  or 1 on contact with the liquid
```

**The load is then one sentence:** what the plunger carries is what is left of the differential
across it, `1 − p`, rounded by the stretch of a rod string four thousand feet long. That single
statement produces every card in the family:

- **`full`** — the barrel fills, so there is nothing to shift at either end. The chamber
  crosses in a hair of travel, both transfers are instants, and the card is the rectangle.
- **`gas`** — gas has to be compressed on the way down *and* expanded on the way back up, so
  the card is rounded at **both** ends: the concave bleed on the right every gassy well draws,
  and the drawn-out pick-up on the left that comes with it. Both balls are down for about a
  fifth of the stroke.
- **`pound`** — the unfilled volume is void, not gas, so it pushes back with nothing: the
  chamber stays at intake and the plunger falls free with the whole column still on the rods,
  until it hits the liquid and the pressure goes straight to discharge. Full load held out to
  the liquid level, then the slam.

`gas` and `pound` **both come back to `full` as the barrel fills**, which is the check that
this is one model and not three. The card's abscissa is `plungerTravel` and its ordinate is
this load, so `pumpCard` is the two sampled over a cycle and the running dot cannot leave it.

## The balls are carried, not switched

Once the pressure has let a ball go, it is **carried off its seat by the fluid going past it**,
rides up its cage as the flow builds, and beds back down as the stroke slows. So position is
downstream of flow, and flow is downstream of the chamber:

```
valveFlow  = plungerSpeed, gated by chamberPressure crossing SEAL_BAND
ballLift   = clamp(|flow| / BALL_FLOAT, 0, 1)
```

`ballLift` is linear in flow because the annular area past the ball opens as it rises: a ball
in its seat is a rotameter, which is why a real one sits at a *height* rather than at one of
two places. Cracking open is quick — it is a pressure force — and settling back is gradual,
because it is the flow dying underneath it.

Three things fall out for free:

- a valve opens and closes over real travel, and the ball rides highest where the plunger is
  fastest;
- a plunger falling through a void **moves nothing**, so its ball stays hard down through the
  whole fall and slams to the cage the instant it meets liquid;
- under `gas` the standing valve opens **late**, so a gassy pump fills late as well as
  discharging late — which is the left-hand side of its card.

The flow markers ride the same number. They march with the **volume the plunger has
displaced**, not with the clock, so they stall where the plunger stalls and run where it runs.
It is the same fluid.

**Wear is the other half.** A ball and its seat take a hammering every stroke, and once the
contact face is no longer round the valve still seats but no longer seals. `tv-leak` and
`sv-leak` pit the ball, bed it a little deeper into its own groove, draw the fluid slipping
back past a ball that is sitting exactly where it should be, and take the loss off the
production readout through `volumetricEfficiency`. On the card, `slip` droops the top to the
right and `backflow` rounds the lower-left. `tagging` is the plunger landing on the standing
valve: a spike above `Fo` at the bottom and nowhere else. The failure, the picture and the
number are one thing.

The drawing carries the chamber too: the bar under the card is `p` between intake and
discharge, with the two valve thresholds marked on it. Watch it cross the right-hand mark and
the travelling valve lifts; watch it cross the left-hand one and the standing valve does.

## The field formulas, unchanged

```
Fo = 0.34 · D² · G · L      pounds     — the fluid load on the plunger
PD = 0.1166 · D² · S · N    bbl/day    — pump displacement
```

Both are the handbook's, and both are derived rather than fitted: `0.34` is `0.7854 × 0.433`,
and `0.1166` is `0.7854 × 1440 / 9702`. Every readout on the drawing comes out of them, so
changing the bore on the demo bench changes the load, the card's scale and the production
together.

## What is not here

**No wave equation.** The surface card is not propagated down the rod string: no stretch,
damping, inertia, buoyancy, friction, gas solubility, temperature or slippage rate. This is the
**downhole** card, which is the one a pump failure is read from anyway, and the components say
so. Nothing reports a quantity it did not compute.

The rock, its bedding, the cement sheath, the perforation tunnels, the gas bubbles and the
fluid as coloured regions are **drawing**. `fluidLevel` is a number you supply — the component
never infers the annulus level from the fillage, or from anything else. It does use it: drop
the level below the pump intake and the tailpipe goes dry and the inflow stops, because that is
what a pumped-off well does.

## The cutaway

This is the set's first machine whose subject is a *section*, and it holds the `view` contract
the same way everything else does: one geometry, four cameras, no per-view artwork.

- **Every tubular is the cylinder it is.** `extrudedPath(circleFootprint(…))` — a cylinder's
  silhouette is the hull of its two end circles, so it is exact from every camera. It is drawn
  ghosted, because in elevation you are looking *through* it.
- **The cut is flat detail at depth zero.** The wall faces, the fluid columns and the
  perforations are `elevationDraft`'s `path` at depth 0. They foreshorten with the camera and
  collapse to a line seen edge-on, which is what a cut plane does.
- **So the plan view is a wellbore cross-section.** Casing, cement, tubing, barrel, plunger and
  rod as concentric rings, with the section plane edge-on through the middle. That is a real
  drawing, not a degenerate one.
- **`solidity` is the one thing that follows the camera.** How opaque a tubular's round body is
  drawn scales with `camera.flatten` — washed right back where you are looking through the cut,
  solid where you are looking down the well. It is paint, not geometry, and it is what keeps
  all four views legible from one drawing.
- **The tubulars and the rock run past the envelope at both ends** (`BLEED`), so the section
  bleeds off the frame instead of showing the rounded end of a cylinder. The envelope is the
  *well*, not the rock: the rock is scenery.
- **The card is an instrument, not an object**, so it never turns with the camera. When it is
  shown the whole projection stands off centre to leave it clear rock to sit on.

## The `data-*` hooks

These are API. A test asserts a prop moved one of them.

| Hook | Carries |
|---|---|
| `data-plunger` | `data-travel` — 0 on bottom, 1 on top |
| `data-travelling-valve` / `data-standing-valve` | `data-open` — the ball's lift, 0 on its seat to 1 against its cage; `data-flow` — what is going through it |
| `data-ball="travelling\|standing"` | `data-wear` — how far gone the seat face is |
| `data-chamber` | `data-charge` — the liquid in the barrel, in stroke fractions |
| `data-chamber-gauge` | `data-pressure` — the chamber, 0 at intake and 1 at discharge |
| `data-void` | present only while the plunger is falling through gas or nothing |
| `data-flow` | `data-direction` — which way the fluid is going |
| `data-card` | `data-condition`, `data-load` |
| `data-rod` | `data-load` — fraction of `Fo` on the rods |
| `data-annulus` | `data-level` |
| `data-barrel` `data-tubing` `data-casing` `data-holddown` `data-intake` `data-formation` `data-perforation` `data-production` | the drawing's parts |

## Behaviours

| Behaviour | What runs |
|---|---|
| `pump` | one stroke a cycle |
| `slow` | a pump-off controller's duty: two strokes, then a rest |
| `static` | parked mid-upstroke, where both valves are doing something |

`rodPumpCycle` returns an **unwrapped** cycle count, the way `pumpjackCrank` returns an
unwrapped angle, so the easing never has to cross the seam at the bottom of the stroke.

## Driving it by hand

`interactive` makes the well a control: drag up and down it and the plunger follows the
pointer. Each travel happens twice a cycle, once going up and once coming down, so
`cycleForTravel(travel, near)` picks the nearer branch — which is what makes a drag carried
past the top of the stroke **turn over** into the downstroke the way a crank does, instead of
reversing. The anchor is kept in a ref so `onDrag` does not rebind every render.

## Originality

A generic API-style insert pump, named for its job: rod-inserted, heavy-wall barrel, bottom
hold-down, cup seals. No manufacturer, field or operator names, no logos, and the default
palette is the theme's. The demo's `25-175 RHBC` is the API designation for that
configuration, not a product.
