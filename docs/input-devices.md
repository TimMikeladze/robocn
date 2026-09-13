# Input devices

Four machines a person types on, and the geometry solver under them. The set already has
machines that make something, machines that move something, and the parts a machine is
assembled out of. It has nothing a person *operates by pressing*, and a key is a mechanism in
exactly the sense the rest of the set means it: one degree of freedom, a spring, a contact
that closes at a point in the travel rather than at the end of it, and a stack of them in a
matrix that is scanned rather than wired one wire per key.

`clamshell-laptop` already draws a keyboard — as 55 flat rounded rects with no height, no
travel and no switch under them. That is the honest limit of a keyboard drawn as decoration on
another machine, and it is the reason this family exists.

## What ships

| Item | Mechanism | Native view |
|---|---|---|
| `keyboard-geometry` | lib: travel with hysteresis, sculpted cap profiles, a raked deck frame, matrix scan order, typing schedules | — |
| `key-switch` | one switch, sectioned: stem, spring, and a leaf that closes partway down | `profile` |
| `robot-keypad` | a raked bench entry pad: a scanned matrix of travelling keys and an entry readout | `front` |
| `robot-keyboard` | a whole deck: rows in units on one pitch, sculpted caps, per-key travel, three layouts | `iso` |
| `input-terminal` | two coupled mechanisms — a canted display head, and a key deck whose strokes land on its screen | `front` |

## Distinctness

- `key-switch` is the only machine in the set whose output is **discrete**: the contact is
  either closed or not, and the point it closes at is partway down a continuous travel. Every
  other machine's state is a number. It also has hysteresis — it opens higher than it closed —
  which nothing else here models.
- `robot-keypad` is the only machine with a **scanned matrix**: state distributed over a grid
  that is read one row at a time, so "which key is down" and "which key is being looked at"
  are two different things, both drawn.
- `robot-keyboard` is the only machine whose parts are **placed by a unit grid** — 1u, 1.25u,
  6.25u — with the stagger falling out of the widths rather than being nudged into place, and
  whose caps are sculpted per row, so the deck has a real profile in elevation instead of
  being a flat plate. `split` cuts the same rows down the middle and turns the halves about
  the deck's own centre; the one change to the rows is that a 6.25u space cannot belong to one
  half, so it becomes two thumb keys.
- `input-terminal` is the only machine where **one mechanism drives another**: the keys it
  strikes are what puts characters on its screen. Everything else in the set has one
  mechanism, or several that are independent.

`sentinel-console` is also a bulkhead station, and does not overlap: it is an optic behind an
iris, with nothing to type on.

## Why a solver

Four things a drawing gets wrong if it guesses.

- **Travel is not linear and actuation is not at the bottom.** A key of 4 units of travel
  closes its contact at about 2 and then has 2 more of overtravel. A cap drawn at "half
  pressed" is therefore not the same thing as "the key has registered", and the two must be
  separately visible. `keyTravel` returns both, plus the overtravel, and takes the previous
  contact state so the reset point can sit *above* the actuation point — real hysteresis,
  about 0.4 units on a real switch.
- **A keystroke is not a sine.** It falls fast, bottoms out for a moment, and comes back
  slower on the spring. `pressCurve` is that shape, once, so every key in the family — the
  single switch, the keypad, the deck, the terminal — presses the same way.
- **A row of caps has to fill the deck.** Rows are specified in units, and a row that does not
  add up to the deck width is a layout bug, not something to stretch. `keyboardLayout` lays
  rows out on a fixed unit pitch, left-aligned with a per-row stagger, and reports each row's
  own width so the drawing can show the short row short.
- **A raked deck is a plane at an attitude, and a cap presses along its normal.** Not down the
  world's y axis. `deckFrame` is that frame, and `capSolid` is one cap as a box on it — eight
  corners projected and hulled, so a cap is truthful from all four cameras and a press moves
  it the right way in each. This is what makes a keypad's travel visible from `front`, which
  is what the rake is for: a face flat on the bench has travel straight into the screen. A cap
  also carries its own `spin` in the deck plane and a `tilt` on its top face, which is what a
  split board's turned halves and a sculpted row are made of.

Not modelled, and said so in every `notes`: no force curve, no tactile bump force, no click
leaf dynamics, no key rollover, no debounce timing, no ghosting, no character encoding. The
scan order is the real order; the scan *rate* is whatever `speed` says. The screens draw
structure — a cursor, filled lines, an entry dot — never text a reader could mistake for
output, and never an application's artwork.

## The shared contract

Everything in `docs/spec.md` holds unchanged: palette roles through `resolveRobotPalette`, a
`size` that only scales, four paint variants that change nothing geometric, `view` on all four
machines because all four are bodies you can walk round, controlled-prop-wins motion with a
`"static"` behaviour, `interactive` drag plus arrow keys with `on…Change` throughout, `px()` on
every computed coordinate, and a neutral pose for non-finite input.

The one axis this family adds is a **passage**: the position through a schedule of keystrokes,
0 at the start to 1 at the end. The prop is `typed` — not `stroke`, which is an SVG attribute
and collides on an `svg` element — and it is what makes scrubbing a typing sequence with a
pointer mean something. `key-switch` is grabbed by `press` instead, because one switch has no
passage, and `input-terminal` is grabbed by `cant`, because a console's head is the thing a
hand actually goes to.

`input-terminal` carries two scalars, `cant` and `typed`, and the loop runs while either is
uncontrolled — a head held by hand keeps typing underneath, which is what `hold` on
`useRobotScalar` is for. `behavior="static"` or `animate={false}` parks both.

## `data-*` hooks

API, so an outer loop can drive the DOM without re-rendering:

| Attribute | On |
|---|---|
| `data-key="<n>"` with `data-down`, `data-legend` | every machine with keys |
| `data-switch`, `data-stem`, `data-spring`, `data-contact` with `data-closed`, `data-leg`, `data-jacket`, `data-housing` | `key-switch` |
| `data-body`, `data-face`, `data-readout`, `data-dot="<n>"`, `data-lamp`, `data-scan` with `data-row` | `robot-keypad` |
| `data-deck`, `data-half="left\|right"`, `data-row="<n>"`, `data-backlight` | `robot-keyboard` |
| `data-head`, `data-hinge`, `data-screen`, `data-cursor`, `data-line="<n>"`, `data-deck`, `data-lamp="power\|link"` | `input-terminal` |

## Originality

Generic industrial-design archetypes: a sectioned keyswitch, a door/bench entry pad, a
staggered mechanical keyboard, and a terminal on a stand. No manufacturer, no product line, no
wordmark, no keycap legend set that belongs to anyone, no paint scheme, and nothing in a demo
`label` or an `aria-label` that names a company. Legends are digits, arrows and blanks.

## Integration

Six files per machine, in one pass each: `registry.json`, `src/lib/docs.ts`,
`src/components/demos/demos.tsx` (every view, variant, layout and behaviour reachable),
`src/components/site/catalogue.tsx` (a card that runs its own cycle — the motion test fails a
pinned one), `README.md`, and tests. The new names go in `inputCollection` in
`scripts/__tests__/registry.test.ts` and `inputSlugs` in
`src/components/site/__tests__/docs-catalogue.test.tsx`.
