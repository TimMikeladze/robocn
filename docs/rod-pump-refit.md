# The rod pump, refitted

Spec for the second pass over `rod-pump` / `rodpump-geometry`. Five corrections, all from a
pumper reading the drawing. [`rod-pump.md`](./rod-pump.md) is the design note and is updated to
match once this lands.

## 1. The BPD readout goes

`### LB · ### BPD` on the card was filler: what a well makes is decided at the tank, not by a
displacement formula times a fillage. The slot becomes the number a downhole card is actually
*read* for — **pump fillage**, which is `tvOpenTravel`, the travel at which the load transfers
on the way down.

- Card readout: `### LB · nn% FILL`.
- `RodPumpPose` loses `displacement` and `production`; they existed only to print that line.
  `pumpDisplacement()` stays — it is the handbook formula, exported and tested, and a caller
  sizing a pump wants it. `efficiency` stays and the demo bench keeps it.

## 2. The travelling valve ball beds into its seat

The standing valve ball sits 2 units into its seat; the travelling valve ball sat exactly *on*
the seat face, leaving an annulus of clear bore around it where it lands. One constant,
`SEAT_SINK`, used by both, so the two balls land the same way.

## 3. The intake is the wrong way round

Today: a slotted tube below the pump with its entry off the bottom of the frame, and the pump
drawing fluid straight up it. That is a plain tailpipe, and it is backwards.

A **mud anchor** exists to keep gas out of the pump, and it does that by making the fluid change
direction:

```
casing annulus  →  ports near the TOP of the mud anchor
                →  DOWN the annulus between the anchor and the dip tube
                →  round the shoe of the dip tube (the U)
                →  UP the dip tube to the standing valve
gas keeps rising up the casing annulus and carries straight past the ports
```

So the drawing changes:

- **The tubing string ends.** It runs to a bull plug at `MUD_LOW`, on camera, instead of
  bleeding off the bottom of the frame. Below the seating nipple that tubing *is* the mud
  anchor.
- **Ports near its top** (`MUD_PORT_LOW..MUD_PORT_HIGH`), below the seating nipple and above the
  perforations — the entry the well was missing.
- **A dip tube** hung off the pump intake, open at `DIP_LOW` just above the plug.
- **The flow markers follow the U**: down the anchor annulus, round the shoe, up the dip tube,
  each gated on the standing valve as before.
- **Gas goes past the intake, not into it**: the bubbles belong in the **casing annulus**,
  because the annulus is where the drawdown is and so where gas comes out of solution. They rise
  on the clock rather than on the plunger — buoyancy has nothing to do with the stroke — and
  they swell on the way up as the head above them comes off. Illustrated, and said to be.
- The perforated interval moves down to `[8, 17, 26]`, below the ports, so the path reads bottom
  to top: in at the perforations, up the annulus, in at the ports, down, round and up.

## 4. A tubing anchor, and the card it draws

New condition **`unanchored`**. A tubing anchor holds the tubing against the casing so the
string cannot stretch and shorten as the fluid load transfers on and off it twice a stroke.
When it is not holding, that movement comes straight off the plunger's travel *relative to the
barrel*, and that is a card you can read.

One number in `PumpRegime`:

```
stretch   stroke fractions the tubing takes when it is carrying the column (0 when anchored)
```

and one new solved quantity, which is the whole model:

```
swept = clamp(travel − stretch · load, 0, 1)      // pumpTravel()
```

The tubing carries the column exactly when the rods do not, so it is long at the bottom of the
stroke and short at the top: the barrel chases the plunger up and the pump sweeps less than the
rods travelled. The card's abscissa becomes `swept` (identical to `travel` when anchored), which
gives the trapezoid a pumper recognises — a vertical left edge where the plunger is not moving
relative to the barrel at all, a top that stops short of full stroke, and a right edge sloping
back out as the load comes off. `volumetricEfficiency` takes the lost stroke too.

In the drawing the **tubing string and everything landed in it rises by `(travel − swept)`** —
tubing, mud anchor, dip tube, hold-down, barrel, standing valve, the anchor body itself and the
fluid inside all of them. Casing, cement, rock, perforations, plunger and rods stay put, so the
movement is visible against them. It is zero for every other condition, so no snapshot moves.

The anchor is drawn on every condition, between the pump and the casing: a mandrel, a cone each
side, and a toothed slip that rides down it onto the casing wall. `unanchored` sits them back up
the cone and off the wall.

## 5. The formation flows, and the level breathes

- **Inflow is continuous.** The perforation streaks were gated on the standing valve, so the
  well stopped producing on every downstroke. The reservoir does not know about the stroke: they
  are drawn whenever there is drawdown to drive them, fading out only as the level approaches
  the top of the window, and breathing a little with what the pump has taken.
- **The level draws down.** The supplied `fluidLevel` becomes the *standing* level; the drawn
  level dips by what the barrel has taken in this stroke and recovers as the formation feeds it
  back. It is clamped at the mud anchor ports — a level that started above the intake never
  falls below it, which is the condition for the full-pump card to mean anything. A level
  supplied below the intake still reads as a pumped-off well.

## Pieces

| File | What changes |
|---|---|
| `src/lib/robocn/rodpump.ts` | `unanchored`, `regime.stretch`, `pumpTravel`, `swept` on the pose, `pumpCard` abscissa, efficiency; `displacement`/`production` off the pose |
| `src/components/ui/rod-pump.tsx` | mud anchor and dip tube, tubing anchor, the tubing rise, continuous inflow, drawdown, `SEAT_SINK`, the readout |
| `src/lib/robocn/__tests__/rodpump.test.ts` | the new condition, the swept travel, the lost stroke |
| `src/components/ui/__tests__/rod-pump.test.tsx` | the tubing rises only when unanchored; the level draws down; the mud anchor is fed through its ports |
| `src/components/demos/demos.tsx` | the condition in the switch, BPD rows out |
| `src/lib/docs.ts`, `docs/rod-pump.md`, `README.md` | the condition, the hooks, the notes |

## Verify

`pnpm robot:check rod-pump --full`, the view snapshots read per file, `pnpm og --only rod-pump`,
then the four views and seven conditions driven in a browser at 320px and at 150px.
