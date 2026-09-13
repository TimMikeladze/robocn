# The robotic menagerie

Twelve more animals, on the solvers the first five already proved. `robotic-animals.md`
shipped a travelling wave (`spine-kinematics`) and a radial gait (`hexapod-kinematics`); this
set spends them on bodies they had not been asked to make yet, and adds no new library. Where
a machine needed a chain solved — the mantis's raptorial forelimbs, the frog's hind legs — it
reaches for `solveChain2`, which the arms have used since the first release.

That is the design decision worth stating up front: **no new solver**. A twelfth animal that
invents a thirteenth maths file is a worse registry than one that shows the same three
solvers doing genuinely different work. The wave that swims a fish also flutters a jellyfish
bell, arches a scorpion's tail and runs *across* a manta's wing instead of along its body.

| Item | Native view | Mechanism | Distinct from |
|---|---|---|---|
| `robot-dragonfly` | plan | Four wings in two counter-phased pairs; abdomen on a spine | `robot-bird` beats one pair in phase |
| `robot-bat` | profile | Three-link arm carrying four finger struts; the membrane is drawn *through* the strut tips | `robot-bird`'s feathers are separate plates |
| `robot-jellyfish` | front | Radial bell contraction; tentacle spines with a delay down the length | Nothing else in the set pulses radially |
| `robot-manta` | plan | `solveSpine` along the **span**, so the wave runs root to tip | `robot-fish` runs the wave nose to tail |
| `robot-octopus` | front | Eight independent spines off one mantle, each with its own phase and curl | `robot-snake` is one spine |
| `robot-seahorse` | profile | One spine whose `turn` is the prehensile grip; dorsal flutter an order faster than the body | `robot-fish` never coils |
| `robot-ant` | plan | Six-leg `solveHexapod`; three body sections articulated on a short spine | `robot-spider`'s body is one rigid carapace |
| `robot-scorpion` | plan | Eight-leg gait **plus** a metasoma spine standing out of the ground plane | `robot-crab` has no tail and walks sideways |
| `robot-mantis` | profile | Two raptorial forelimbs solved with `solveChain2` to a real target | The only animal here with an IK goal |
| `robot-frog` | profile | Three-link hind legs solved through a crouch–extend–tuck–land cycle | `robot-quadruped` never leaves the ground |
| `robot-turtle` | plan | Four-leg gait under a domed carapace, everything retracting on one scalar | `robot-spider` cannot put itself away |
| `robot-inchworm` | profile | Alternating anchors: no travelling wave, an arch that shortens and reaches | Every other crawler here moves by wave or gait |

Air, water, ground and one machine that climbs by folding in half.

## What each solver is being asked to do that it was not before

**`solveSpine` across a span.** The manta's wing root is `s = 0` and its tip is `s = 1`, so a
crest travelling from nose to tail in the solver arrives at the wing tip instead. Amplitude is
tapered to the tip (`taper: 0.9`), which is what makes a ray's wing look like a ray's wing
rather than a flag. Both wings share one phase and mirror, so the animal stays symmetric.

**`solveSpine` in the sagittal plane.** The scorpion's tail is solved in the *vertical* plane
that contains the animal's fore-aft axis, so the solver's own `x` is how far back a segment
reaches and its own `y` is how high it is — one curve supplying both facts. `arch` is that
curve's `turn`: at zero the tail trails flat, and near one the arc carries it back, up and
forward again, which is why arching it genuinely brings the plan footprint over the body
instead of just drawing a shorter tail. Off-axis the same heights are projected, so the arch
is a fact about the machine rather than a relief cue.

**`solveSpine` many times over.** The octopus solves eight, the jellyfish solves `arms`, each
with its own phase offset and its own `turn`. Independent phases are the whole reason an
octopus does not read as a rosette of snakes.

**`solveHexapod` at four legs.** It always clamped to 4–10; nothing had asked for four. The
turtle's slow `wave` gait at `legs={4}` is a plod, and the same solver at `legs={6}` walks the
ant.

**`solveChain2` with a target.** The mantis's forelimb is the only animal linkage in the set
with somewhere to *reach*. Coxa and femur are solved to the strike point, which is the pointer
while it is watched and a scripted point otherwise; the reach clamps rather than failing, the
way every arm in the registry does.

## The shared contract

Identical to the first five, because that is the point:

- `size`, `variant`, palette props, `showGround`, `label`, `role="img"` with a label that says
  what the machine is *doing*.
- `view: "plan" | "front" | "profile" | "iso"`, defaulting to the native view in the table
  above. One geometry, projected: the flat artwork goes through `camera.plane()` or
  `camera.wall()`, and a `data-solids` group draws the parts that only exist off-axis —
  wings at their true stroke angle, a tail at its real height, a bell that is a dome.
- Controlled prop wins and stops the clock; otherwise `behavior` runs it, scaled by `speed`,
  offset by `offset`, frozen by `paused`, parked by `animate={false}` or reduced motion.
- `interactive` gives it to a person: something tracks the pointer, and a click fires the
  animal's one gesture, with a callback.

### Behaviour and interaction

| Component | `behavior` | Interaction |
|---|---|---|
| `robot-dragonfly` | `hover` station-keeping; `dart` burst travel; `perch` wings held, abdomen curled; `static` | Yaws toward the pointer; click darts. `onDart` |
| `robot-bat` | `roost` hanging furled; `flap`; `glide`; `static` | Head tracks the pointer; click drops it off the roost. `onDrop` |
| `robot-jellyfish` | `pulse` contract and coast; `drift` slack; `bloom` held open; `static` | Tentacles lean toward the pointer; click contracts hard. `onPulse` |
| `robot-manta` | `cruise`; `soar` wings held; `bank` a rolling turn; `static` | Banks toward the pointer; click surges. `onSurge` |
| `robot-octopus` | `crawl` arms working; `jet` mantle pumping, arms trailing; `furl`; `static` | Arms reach for the pointer; click jets. `onJet` |
| `robot-seahorse` | `hold` tail gripped, dorsal fluttering; `hover`; `drift`; `static` | Head tilts to the pointer; click grips and releases. `onGripChange` |
| `robot-ant` | `forage` walking with turns; `haul` slower with the gaster up; `idle`; `static` | Antennae track the pointer; click works the mandibles. `onMandibleChange` |
| `robot-scorpion` | `stalk` low and forward; `guard` tail up, claws spread; `strike`; `static` | Turns to the pointer; click strikes with the tail. `onStrike` |
| `robot-mantis` | `stalk` folded and swaying; `strike`; `groom`; `static` | The forelimbs reach for the pointer; click snaps the strike. `onStrike` |
| `robot-frog` | `crouch` throat pulse; `hop` the full jump cycle; `swim`; `static` | Eyes track the pointer; click jumps. `onHop` |
| `robot-turtle` | `plod` four-leg wave gait; `bask`; `retract`; `static` | Head tracks the pointer; click pulls everything in. `onRetractChange` |
| `robot-inchworm` | `loop` anchor–arch–reach; `rear` front end casting about; `measure`; `static` | The front end reaches for the pointer; click rears it up. `onRear` |

### `data-*` hooks

API, so they are listed: `data-<animal>` and `data-view` on the drawing group, `data-solids`
on the off-axis group, and per mechanism — `data-wing="fore-left"`, `data-abdomen`,
`data-membrane`, `data-bell`, `data-tentacle="3"`, `data-arm="5"`, `data-tail`, `data-sting`,
`data-forelimb="left"`, `data-leg="2"`, `data-mandible`, `data-antenna="left"`,
`data-carapace`, `data-anchor="front"`, `data-head`, `data-eyes`, `data-contact`.

## What these are not

Illustrative trajectories, the same caveat the first five carry. No thrust, no drag, no
buoyancy, no balance, no ground reaction, and no body-frame integration of the travel a gait
would produce — the feet move, the body does not go anywhere. Where a linkage is drawn rather
than solved (a dragonfly wing, a jellyfish bell, a turtle's retraction) the docs `notes` for
that item say so out loud.

Original archetypes: each is named for what it does, and none of them carries a franchise's
markings, name or paint.

## Verification

- `vitest`: the twelve behaviour samplers stay inside their own limits and return neutral for
  a non-finite clock; controlled props move the named `data-*` mechanism; each click fires its
  callback and interaction off means it does not; `NaN` on every numeric axis renders without
  `NaN` reaching the DOM. The view axis is covered by the snapshot suite in `views.test.tsx`,
  which asserts the drawing changes in every non-native view and that asking for the native
  view is the default drawing.
- `tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`.
- Driven in a browser: all twelve docs pages and the landing catalogue rendered and inspected
  (no `NaN` or `Infinity` reaching any drawing, every accessible label naming the machine and
  its state), the pages checked at 390px for horizontal overflow, reduced motion forced on to
  confirm the loops park, and the click gestures exercised. Every camera angle is covered by
  the snapshot suite rather than by hand.
