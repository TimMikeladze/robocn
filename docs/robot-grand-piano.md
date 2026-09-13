# The robot grand piano

One machine, and the geometry under it. The set already plays: a deck tracks a groove, a
barrel plucks a comb, a droid hits a kit off a step pattern. None of them has an *action* —
a five-lever chain that throws a hammer at a string and then lets go of it before the blow.
That release is the whole point of a grand, it is the thing every drawing of a piano gets
wrong, and it is solvable.

## What ships

| Item | Mechanism | Native view |
|---|---|---|
| `piano-geometry` | lib: the grand action and its escapement, the string scale, the bridge and rim envelope, the lid on its prop, the keyboard | — |
| `robot-grand-piano` | a player grand: a roll drives 88 actions, the hammers escape, the dampers lift, the pedals work | `plan` |

## Distinctness

- `robot-keyboard` also has keys that go down. Its keys are *switches* — travel, an actuation
  point, hysteresis — and nothing happens beyond the key. Here the key is the first lever of
  five, and what matters is what comes out the far end.
- `music-box-drum` also strikes tuned metal off a pattern. Its pin stays in contact right up
  to the moment of release, and the release *is* the note. A hammer is the opposite: it is
  released **before** the note, flies the last of the blow unpowered, and is caught on the way
  back. `combLift` describes the approach in both machines, which is why the roll is a
  `pinBarrel` and not a second pattern format — but the escapement and the check belong to
  this machine alone.
- `busker-droid` strikes things by solving an arm to them. Nothing here is solved to a target;
  the hammer's path is fixed by its shank and its flange, and the only question is how much of
  it the jack drives.

## Why a solver

Six closures a drawing would get wrong, and every one of them is visible.

- **The hammer does not follow the key.** The jack drives the knuckle until the jack's toe
  meets the let-off button; from there the hammer covers the last of the blow distance with
  nothing behind it. Animating the hammer as a function of the key means the hammer is still
  being pushed at the instant of contact, which is the one thing a piano action exists to
  prevent — you cannot hold a hammer against a string. `actionPose` caps the driven travel at
  the escapement and reports `escaped`, the gap left, and the after-touch.
- **The ratio is a product of levers, not a number.** Key balance × wippen × hammer lever.
  Change the balance rail and the escapement moves, because the dip at which the jack trips is
  `(blow − letOff) / ratio`. Regulate it badly enough and the key bottoms before the jack
  trips: the hammer never escapes and the note never sounds. `regulated` says so rather than
  pretending.
- **The hammer comes back to the check, not to rest.** While the key is held the back check
  catches the hammer part-way down and holds it there. A hammer that drops all the way home
  between notes cannot repeat, which is exactly the fault the repetition lever was invented to
  cure.
- **The damper leaves late.** It stays on the string for the first half of the key dip and is
  clear by the bottom, so a half-pressed key is a key that has done nothing. The top notes
  have no dampers at all.
- **The scale cannot be ideal.** An ideal scale halves the speaking length every octave; run
  that down 88 notes from a short top string and the bottom note wants six metres. Real scales
  hold the halving law in the treble and compress the exponent below it, and the shortfall is
  what the wound strings are for. `pianoScale` reports both the ideal length and the
  foreshortening, so the bass reads as short *on purpose*.
- **The bent side is the envelope of the scale.** The string runs from its agraffe to its
  bridge pin; the agraffe sits one strike point in front of the hammer line, so the bridge
  lands one speaking length behind that. Do it for every note, take the hull of the hitch pins
  and push it out by the thickness of the rim, and the curve of a grand falls out of it. The
  spine and the front are straight because a grand's are, and they are snapped back onto their
  own lines afterwards.

Three smaller ones worth having. The **capo line curves** because the strike ratio is a
fraction of a length that varies by a factor of forty — and the tuning pins follow it, which
is why a grand's pin block is laid out on an arc. An **overstrung bass string reaches less far
down the case than its own length**, because it is run at an angle; that is the entire point
of crossing it over the others. And the **lid angle is a triangle** — hinge to notch, hinge to
the stick's foot, and the stick itself — so the long prop and the short prop give angles you
solve rather than pick, and a stick too long for its notch will not stand.

None of it is acoustics. Nothing computes a frequency, an inharmonicity, a tension, a
soundboard impedance or a decay, and nothing plays a sound. The hammer's flight after let-off
is the remaining gap covered in a fixed window, not an integration — there is no hammer mass
and no velocity in the model, and the docs `notes` say so.

## The magnification, stated once

A key dips ten millimetres on an instrument two and three quarter metres long, and its hammer
travels forty-seven. At the size this component is looked at, both are a fraction of a pixel.
The drawing therefore magnifies **the travels, and only the travels**: key dip, hammer blow
and damper lift, by one constant. Every ratio, the escapement point, the after-touch and the
check are solved life-size, and the `data-travel`, `data-dip` and `data-lift` hooks carry the
unmagnified numbers. Nothing about the case, the scale or the stations of the action is
touched — the layout is life-size throughout.

## The shared contract

Everything in `docs/spec.md` holds: palette roles through `resolveRobotPalette`, a `size` that
only scales, four paint variants that change nothing geometric, `view` on all four cameras,
controlled-prop-wins motion with a `"static"` behaviour, `interactive` drag plus arrow keys
with `on…Change` throughout, `px()` on every computed coordinate, and a neutral pose for
non-finite input.

The roll is the same **pattern** axis `music-box-drum` and `busker-droid` already carry: an
array of rows, one row per lane, any non-blank character a perforation. It is data, so a
malformed or empty roll gives a piano that runs and plays nothing. What is new is `lanes` —
the key each lane strikes — so a three-row roll can be a chord rather than three neighbours.

## The views

The two axes that matter are perpendicular, the way they are on `music-box-drum`, and for the
same reason: the **scale** is plan geometry and the **action** is a profile mechanism.

`plan` is the default, because a grand is *specified* in plan — the bent side, the bridge, the
string fan and the crossing bass section are all there, and all of them come out of the
solver. The hammers barely move in plan, which is correct: a hammer rotates about an axis
across the keyboard, so almost all of its travel is in height. What plan shows instead is
which strings are speaking, painted in the accent role — a state readout in colour rather than
faked geometry. A raised lid covers most of the instrument seen from above, which is also
correct and is why it is drawn as the plate it is, with the harp reading through it.

`profile` is the mechanism view and one click away: the key rocking on its balance rail, the
hammer swinging to the string and dropping back to the check, the damper lifting, and the lid
on its prop stick. `front` is the keyboard end-on with the whole compass dipping. `iso` has
all of it at once.

World axes: **+x** is the bass side and the spine, **−x** the treble side and the bent side,
**z = 0** the front of the case at the keyboard, **+z** the tail, **+y** up. That puts the
keyboard at the top in plan, nose-up like every other plan-native machine in the set, and
makes `front` the player's own view with the bass on the left.

## Motion

One scalar: position through the roll, in steps.

| Controlled prop | Behaviours | Speed |
|---|---|---|
| `beat` | `perform`, `rubato`, `static` | passes of the whole roll per second |

`rubato` is the same pass with the rate swelling and easing inside it, never running backwards.
Dragging across the frame scrubs a whole pass; arrow keys step a note at a time. The hammers
follow from the roll through `combLift`, the ring from `combRelease`, and the damper from the
key dip and the pedal — so a scrubbed piano is a piano with its keys held where you left them,
not an animation paused. The key is held for as long as its string rings, which is what a
player mechanism's perforation actually does, and it is why the damper comes down with the
sound.

## `data-*` hooks

API, so an outer loop can drive the DOM without re-rendering:

`data-rim`, `data-soundboard`, `data-plate`, `data-bridge="long"`, `data-bridge="bass"`,
`data-capo`, `data-strings`, `data-string="0"` (with `data-sounding`), `data-action` (with
`data-shift`), `data-hammer="0"` (with `data-travel`), `data-damper="0"` (with `data-lift`),
`data-keyboard`, `data-key="0"` (with `data-dip`), `data-lid` (with `data-angle`), `data-prop`,
`data-lyre`, `data-pedal="damper"`, `data-pedal="shift"`, `data-pedal="sostenuto"`,
`data-leg="0"`, and `data-view` on the drawing group.

## Originality

An archetype: a concert grand and a player mechanism, both older than any living maker's
current catalogue. No wordmark, no fallboard decal, no maker's name, no cast-iron plate
lettering, no livery, and nothing in a demo label or an `aria-label` that names a company, a
model, a piece of music or a performer. The default rolls are plain figures — a broken chord
and a scale — written for this file.

## Verification

`vitest` over the solver and the machine: the hammer travel is the key dip times the product
of the three lever ratios, and it stops at the escapement while the key keeps going; an action
whose ratio is too low never escapes and says so; the damper is still down at a third of the
dip and clear at the bottom; the sustain pedal lifts every damper regardless of the keys; the
speaking length halves per octave at the top and falls short of ideal further down, with the
foreshortening rising monotonically toward the bottom note; a crossed bass string's run down
the case is shorter than its own speaking length while the two together still measure it; every
hitch pin lands inside the case the outline was built around. Then the component: a roll drives
the hammers it names and no others, the pedal lifts every damper, the una corda shifts the whole
action, scrubbing moves the readout, a bogus roll plays nothing, and non-finite input renders
the neutral pose. Then `tsc --noEmit`, `eslint`, `registry:build`, `next build`, and the
machine driven in a browser through every variant, every view, at 390px, with reduced motion
forced on.
