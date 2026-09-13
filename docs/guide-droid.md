# The guide droid

One machine: a rotor-lifted visitor guide. It hangs a light shell body under a single
two-blade rotor and carries its hands and feet on **coil springs**, so every limb is a
consequence of how hard the rotor is pulling rather than a pose someone typed in.

Built from a reference image (a mascot-style helper robot, a toy render plus an in-game
render of the same subject). What was taken is written below; what was left behind is the
character.

## Why it earns a place

Nothing in the set lifts from a rotor *and* hangs a body off it, and nothing has a spring.

| Nearest neighbour | What it does | Why this is not that |
|---|---|---|
| `probe-droid` | Hovers on repulsors, appendages set round a pod | No visible lift source; its appendages are rigid and driven directly |
| `robot-drone` | Multirotor aircraft, plan view | All airframe, no body — nothing hangs under it |
| `orb-droid` | Rolling sphere, stabilized head | Ground machine; its shell is the drive |
| `robot-jellyfish` | Hanging tentacles under a bell | Tentacles are solved spines; these are springs under load |

The new mechanism is the **sprung limb**: one `lift` number sets hover height, and the same
number stretches the arm and leg springs, because a machine hanging in the air puts its
limbs in tension and a machine sitting on its feet puts them in compression. The coil is
drawn from its own extension — coil count is fixed, pitch is not — so the spring is the
readout, not decoration.

## Read off the reference

**Silhouette.** Teardrop shell bulb, pointed at the top where a short mast carries a
two-blade rotor; a smaller round body beneath it; four orbs — two hands out on springs, two
feet under it. It reads at 150px as *bulb-under-rotor with four dots*.

**Proportions**, as ratios of the figure's height H (rotor disc to foot bottom):

| Part | Ratio | World units (H = 178) |
|---|---|---|
| Shell bulb | 0.48 wide × 0.45 tall | 86 × 80 |
| Body | 0.31 wide × 0.28 tall | 56 × 50 |
| Rotor span | 0.56 | 100 |
| Optic | 0.16 diameter, centres ±0.11 | r 14 at x ±20 |
| Hand orb | 0.12 | r 10.5 |
| Foot orb | 0.13 wide | rx 12 |

**Degrees of freedom** visible in the reference, each a prop here: the rotor spins
(`rotorAngle`), the machine floats at a height (`height`), the limbs stretch and trail with
it, the optics aim (`look` / pointer), the grille lights when it talks (`voice`).

**Panel roles.** The reference's body colour → `shell` (the centre seam is a raised moulding
in the same paint, edged in `dark`, not a contrasting plate); the mast, rotor, optic bezels,
orbs and spring wire → `metal`; the rivets, seam edges and the grille recess → `dark`; the lit
optic centre, the grille bars and the mast lamp → `accent`. No colour is sampled: the defaults are
the theme's, and the demo passes `color=` only to show the archetype's tone.

**Signature details** kept: the centre seam with its rivet line, the concentric ring optics,
the bar grille under them, the spring wire, the toe cap on each foot.

### Originality

Shipped as the archetype — a rotor-lifted guide companion — not the character. No franchise
name anywhere in the component, docs, demo labels or `aria-label`; no character paint scheme
(the reference's blue-and-yellow is not a default); no markings. Same constraint as
`casing-droid` and `astromech-droid`. Reference images stay in the session scratchpad and are
not committed.

## The mechanism

```
lift 0                          lift 1
feet on the deck                hanging at altitude
leg springs compressed (28)     leg springs stretched (40)
arm springs slack, hands in     arms hang out and trail
shadow tight and dark           shadow wide and faint
```

- `RISE = 26` world units between the two, applied to the whole machine.
- Spring extension is `lerp(rest, stretched, lift)` per limb pair; `coilPath` samples a
  sinusoid along the limb axis, so more extension means a longer pitch and a visibly thinner
  coil, exactly as a real spring reads.
- `sway` (−1..1) trails the hands and feet sideways and leans the body a few degrees. It is
  the behaviour's lateral drift, not an integrated acceleration — illustrative, and the docs
  `notes` say so.
- The rotor turns at a constant rate on the clock; **thrust shows in the wash ring's
  opacity, not in the blade rate**, because a blade angle that speeds up and slows down with
  lift would run backwards whenever lift fell.

## Contract

Standard: `size`, `variant`, palette props, `showGround`, `label`, `signal`, `role="img"`.

- `view`, native **`front`**. The shell and the body are surfaces of revolution and the rotor
  is a flat disc. The shell's meridian is one path shared by the elevation drawing and the
  off-axis solid — tipped by `camera.lift` and unioned with the equator disc scaled by
  `camera.flatten`, so it is a teardrop from the side and a circle from above — the body is an
  exact projected spheroid, and the rotor and the seam rings go through `camera.plane()`. The
  face — optics, grille, seam, rivets — is elevation artwork through `camera.wall()` and
  collapses edge-on in `profile`, which is what a face does. The arms are raked a little
  forward so a side elevation sees them instead of hiding them behind the shell.
- `behavior`: `hover` (station-keeping bob), `beckon` (rises, waves a hand, talks through the
  grille), `settle` (rotor at idle, weight on its feet), `static`. Scaled by `speed`, offset
  by `phase`, frozen by `paused`, parked by `animate={false}` or reduced motion.
- Controlled `height` (0..1) wins and stops the loop; `rotorAngle` and `voice` are separately
  controllable, the way `robot-drone` separates its blade angle.
- `interactive` (default on): drag up and down to fly it, arrow keys step it, `Home`/`End` are
  deck and ceiling, `onHeightChange` reports throughout. `role="slider"` with
  `aria-valuenow` in percent. The optics track the pointer unless `look` is supplied.

### Axes

| Prop | Values | What it changes |
|---|---|---|
| `blades` | 2–6 | Rotor blade count; 2 is the reference |
| `limbs` | `"coil"` \| `"strut"` | Springs, or rigid two-part struts with a visible knuckle |
| `voice` | 0..1 | Lit bars in the grille |

### `data-*` hooks

`data-guide` and `data-view` on the drawing group, `data-solids` on the off-axis group, and
per mechanism: `data-rotor`, `data-mast`, `data-shell`, `data-body`, `data-optic="left"`,
`data-eye="left"`, `data-grille`, `data-arm="left"`, `data-hand="left"`, `data-leg="left"`,
`data-foot="left"`, `data-contact`.

## What it is not

No flight dynamics. There is no thrust, no mass, no drag and no spring constant: the springs
extend as a function of hover height and the sway is a drift term, both illustrative. The
rotor is drawn, not solved, and the docs `notes` say so. Nothing here infers state or starts a
timer — `voice` lights bars because it was told to.

## Verification

- `vitest`: the behaviour sampler stays inside 0..1 and returns the neutral pose for a
  non-finite clock; `height` moves the shell and stretches the leg springs; `blades` and
  `limbs` change the mechanism; `voice` lights bars; the label names the state and the view;
  `NaN` on every numeric axis renders the neutral pose with no `NaN` in the DOM; a press flies
  it and releasing hands it back to the behaviour; keyboard steps report through
  `onHeightChange`. The four views are covered by `views.test.tsx`.
- `pnpm test`, `pnpm typecheck`, `eslint`, `pnpm registry:build` all clean for this item.
- Rendered in Chrome: all four views and all four variants side by side, the hover range end to
  end, the 150px catalogue card, and the docs page at desktop and at 390px with reduced motion
  forced on (the loop parks at `phase`). The first render caught the bug worth catching — the
  rotor hub was projected with the float's sign flipped, which drew the rotor *inside* the
  shell. Pointer drag is covered by the test above rather than by hand.
