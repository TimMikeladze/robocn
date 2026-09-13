# Mechanical music

Four machines that make a sound by moving something, and the geometry under them. The set
already has machines that cut, carry, lift and walk. It has nothing that *plays* — and a
record deck, a wind-up gramophone, a cylinder music box and a beater arm are mechanisms in
exactly the sense the rest of the set means it: a small number of degrees of freedom, visible,
and wrong in a way a reviewer can point at if the drawing fakes them.

## What ships

| Item | Mechanism | Native view |
|---|---|---|
| `sound-geometry` | lib: spiral groove, pivoted-tonearm tracking error, exponential horn, spring governor, tuned comb, pinned barrel | — |
| `turntable-deck` | a pivoted tonearm tracking a spiral groove, geared to the platter | `plan` |
| `gramophone-horn` | a mainspring and its governor driving an acoustic deck into a flared horn | `profile` |
| `music-box-drum` | a pinned barrel lifting and releasing a tuned comb | `plan` |
| `busker-droid` | two arms solved to strike targets off a step pattern | `front` |

## Distinctness

- `rotary-table` also spins a platter. It **indexes** — a staircase goal and a slew rate, with
  fixtures that stop under a pointer. `turntable-deck` runs continuously and has an arm whose
  position is *derived from the groove*, which is a mechanism the set does not otherwise have.
- `turntable-deck` is electric and geometrically correct. `gramophone-horn` is the same
  archetype a century earlier and is neither: a stored-energy drive that sags as it runs down,
  and an arm with no alignment geometry at all. Putting both on one solver is the point,
  because the same function then tells the truth about both — the deck nulls twice and holds
  its tracking error under 1.3°, the gramophone never nulls and sits around 20°.
- `music-box-drum` and `busker-droid` share one mechanism. A step sequencer is a pinned barrel
  unrolled flat: a pin approaches, lifts its tine (or its beater), and lets go. `combLift` and
  `combRelease` drive both machines, which is why there is one solver and not two.
- Against the droids: every other droid in the set is posed or tracks something.
  `busker-droid` is the only machine whose pose comes from **data** — a pattern you pass it.

## Why a solver

Five closures a drawing would get wrong, and every one of them is visible.

- **The groove** is an Archimedean spiral: the stylus moves inward by exactly one groove pitch
  per revolution of the platter. That is what ties the arm to the platter, so scrubbing the
  record backwards has to walk the stylus back out. A drawing that animates the arm and the
  platter independently drifts apart within a turn.
- **The tonearm** is a triangle with two fixed sides — pivot-to-spindle and effective length —
  so the arm angle is *solved* from the groove radius, not tweened. With the offset angle it
  gives the tracking error, which is zero at exactly two radii for a well set-up arm and is
  the number the whole geometry exists to minimise. It is reported in the readout, so a
  gramophone's terrible arm reads as terrible.
- **The horn** is an exponential flare: the cross-sectional area doubles over a constant
  distance along the axis. A cone is a different machine and looks it.
- **The governor** is what makes a wind-up deck run at a speed at all. The flyweights stand
  out with the square of the speed until they reach their stop, and the speed holds flat while
  the mainspring is above its knee and sags below it. Run it down and the platter slows.
- **The comb** is tuned by length: a cantilever's frequency goes as one over the length
  squared, so an octave up is exactly one over root two the length. The tines are graded from
  a scale rather than drawn as a decorative fan.

None of it is acoustics. Nothing here computes a frequency response, a horn's cutoff, a
radiation impedance, a spring's torque curve or a string's decay, and nothing plays a sound.
The geometry is solved; everything that would need material properties is illustrated and the
docs `notes` say so.

## The shared contract

Everything in `docs/spec.md` holds unchanged: palette roles through `resolveRobotPalette`, a
`size` that only scales, four paint variants that change nothing geometric, `view` on all four
machines because all four are bodies you can walk round, controlled-prop-wins motion with a
`"static"` behaviour, `interactive` drag plus arrow keys with `on…Change` throughout, `px()` on
every computed coordinate, and a neutral pose for non-finite input.

The axis these add to the vocabulary is a **pattern**: `music-box-drum` and `busker-droid` both
take `pattern`, an array of rows of characters, one row per tine or voice, where any non-blank
character is a pin. It is data, so an empty or malformed row produces a machine that turns and
strikes nothing rather than one that throws.

## The views each machine is drawn in

`music-box-drum` is the one worth recording. Its two essential axes — the pattern *along* the
barrel and the *bend* of a tine — are perpendicular, and no single orthographic camera shows
both: in profile the tines run into the screen, and in plan the bend is invisible. The barrel
therefore lies along **x** with the comb's tines running along **z**, which makes plan (the
fan and the pin grid) and profile (the barrel end-on with its ring of pins, and the bend)
both legible, and leaves front as the weak one. `plan` is the default because that is how a
movement is looked at. `iso` shows everything at once and is one click away.

## Motion

One scalar per machine, and in every case it is the thing a hand would actually grab:

| Machine | Scalar | Controlled prop | Behaviours |
|---|---|---|---|
| `turntable-deck` | platter revolutions | `progress` (0 lead-in → 1 run-out) | `play`, `scratch`, `static` |
| `gramophone-horn` | how wound the spring is | `wind` (0 → 1) | `play`, `crank`, `static` |
| `music-box-drum` | barrel rotation, degrees | `turn` | `play`, `cadence`, `static` |
| `busker-droid` | position through the pattern, in steps | `beat` | `groove`, `fill`, `static` |

`turntable-deck` is the one worth reading twice. Progress and platter angle are not two
animations; they are one number seen at two scales, because the groove gears them together.
Dragging the platter is therefore a scrub: the stylus retreats up the spiral, the readout
counts back, and the tracking error changes with it.

`gramophone-horn` is honest about one approximation and says so in its notes: the platter's
angle is the clock times the regulated speed, not an integral of it, so changing the wind
changes the platter's rate from that moment rather than replaying history. There is no spring
model under it.

## `data-*` hooks

API, so an outer loop can drive the DOM without re-rendering:

`data-platter` (with `data-spin`), `data-record`, `data-tonearm` (with `data-angle`),
`data-headshell`, `data-stylus`, `data-cue`, `data-belt`, `data-motor`, `data-selector`,
`data-pitch`, `data-plinth`, `data-solids`; `data-case`, `data-mechanism`, `data-spring`,
`data-governor` (with `data-spread`), `data-weight="left"`, `data-crank` (with `data-angle`),
`data-horn` (with `data-sections`), `data-soundbox`; `data-bedplate`, `data-barrel` (with
`data-turn`), `data-pin="tine-step"`, `data-comb`, `data-tine="0"` (with `data-lift`),
`data-fly`, `data-wheel`; `data-frame`, `data-torso`, `data-waist`, `data-head` (with
`data-nod`), `data-lamp`, `data-arm="left"` (with `data-lift`), `data-joint="left-elbow"`,
`data-beater="snare"`, `data-kit`, `data-drum="kick"`, `data-cymbal`, `data-pedal` (with
`data-swing`), `data-leg="left"`; and `data-view` on every drawing group.

## Originality

The brief named a category, not a maker. What ships is the archetype: a belt-drive deck, an
acoustic horn gramophone, a cylinder music box movement, and a one-machine band. No wordmarks,
no logos, no product lines, no exact paint schemes, no reproduced record label, and nothing in
a demo label or an `aria-label` that names a company, a record, a tune or a performer. The
record's label is concentric structure in palette roles. The default patterns are plain
alternating figures written for this file.

## Verification

`vitest` over the solver and the four machines: the stylus walks monotonically inward as
progress rises and the arm's length from its pivot never changes; tracking error crosses zero
exactly twice across a well-aligned arm's sweep and stays under two degrees between; the horn's
area doubles over a constant distance; the governor's flyweights go out with the square of the
speed and hold at the stop; an octave of comb is one over root two the length; a tine lifts as
its pin approaches, is at full lift at the pin, and is free immediately after; a pattern of
blanks strikes nothing. Then `tsc --noEmit`, `eslint`, `registry:build`, `next build`, and the
four machines driven in a browser through every variant, every view, at 390px, with reduced
motion forced on.
