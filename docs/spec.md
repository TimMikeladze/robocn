# robocn — spec

A shadcn-compatible registry of robot components: articulated arms, alternate kinematic
families, and robot ephemera. Every item is copy-in source, themeable with CSS variables,
and sized by props.

## Why

`shadcn/ui` covers forms and layout. Nothing covers *machines* — the arm that animates on a
robotics landing page, the pick-and-place loader on a fabrication dashboard, the face on a
support bot. robocn is that set, built on a real kinematics core rather than a looping GIF.

Inspiration and prior art: `../keycaps/packages/fabricator` — its FABRIK solver, analytic
two-link elbow, procedural `ArmRig`, and tool-head vocabulary. robocn generalises those from
one bespoke three.js scene into installable components with no scene assumptions.

## Shape of the repo

Single Next.js app that is both the docs site and the registry source of truth. Files live at
the exact path a consumer installs them to, so the docs site always compiles what it ships.

```
src/lib/robocn/kinematics.ts     zero-dependency math: FABRIK, elbow IK, FK, delta IK
src/lib/robocn/style.ts          sizes, variants, palette resolution, tool + motion types
src/hooks/use-robot-arm.ts       rAF pose loop: eases a chain toward a target, settles to 0 renders
src/hooks/use-pointer-target.ts  pointer/touch position in a component's own world units
src/components/ui/*.tsx          the components
registry.json                    registry manifest -> `pnpm registry:build` -> public/r/*.json
```

Consumers install with `npx shadcn@latest add https://<host>/r/robot-arm.json`, or add the
`@robocn` namespace to `components.json` and run `add @robocn/robot-arm`.

## Components

| Item | Type | What it is |
|---|---|---|
| `robot-kinematics` | lib | IK/FK core. No React, no three, no deps. |
| `robot-style` | lib | Size scale, variants, palette resolution from CSS vars, view camera. |
| `use-robot-arm` | hook | Animated pose state for a link chain. |
| `use-pointer-target` | hook | Pointer position mapped into arm world units. |
| `robot-arm` | ui | The flagship: SVG articulated arm, N links, 8 tools, 4 variants. |
| `robot-arm-3d` | ui | The same arm as a procedural react-three-fiber rig. |
| `robot-stage` | ui | Canvas + lights + floor + orbit controls for the 3D items. |
| `scara-arm` | ui | SCARA in plan view: two rotary links, Z column, top-down. |
| `delta-arm` | ui | Parallel delta robot, real delta IK, isometric projection. |
| `gantry-arm` | ui | Cartesian gantry / plotter head on X-Y rails. |
| `robot-face` | ui | Head with pointer-tracking eyes, moods, blinking, antenna. |
| `robot-loader` | ui | Pick-and-place loop as a loading indicator. |
| `arm-controls` | ui | Slider panel that drives an arm in forward kinematics. |
| `robot-gripper` | ui | Standalone parallel or angular gripper that works a pick cycle. |
| `conveyor-belt` | ui | Automatic or controlled conveyor travel with workpieces. |
| `micro-duck` | ui | Bipedal duck robot: solved legs, craning neck, hinged beak. |
| `duck-kinematics` | lib | Pure biped pose solver: footfall cycle, neck chain, beak. |
| `reachy-mini` | ui | Companion head on a solved six-rod parallel platform. |
| `stewart-kinematics` | lib | Closed-form 6-DOF Stewart platform IK with stroke limits. |
| `robot-quadruped` | ui | Four-legged robot that walks, trots, and notices the pointer. |
| `robot-cat` | ui | Legs hung off a solved spine: the arch moves the shoulder and the hip, and the legs answer. |
| `robot-dog` | ui | The same spine with a floating shoulder, a solved neck, and a tail solved across the centre plane. |
| `robot-fox` | ui | Tips its whole body about its hip; the brush is an output of the pitch and the ears triangulate. |
| `robot-fish` | ui | Swimming fish built on a travelling body wave, with fins and a dart. |
| `robot-snake` | ui | Serpentine crawler: even wave, sidewinding lift, coil, strike. |
| `spine-kinematics` | lib | Serpenoid travelling-wave spine with taper, turn and clearance. |
| `robot-spider` | ui | Eight-legged plan-view walker with solved knees and three gaits. |
| `robot-crab` | ui | Sideways walker on the same gait solver, with hinged claws. |
| `hexapod-kinematics` | lib | Radial four-to-ten-leg gait solver, knees solved per leg. |
| `robot-bird` | ui | Perching flyer with three-link wings and a fanning tail. |
| `robot-dragonfly` | ui | Four-winged flyer in plan: fore and hind pairs beating half a cycle apart. |
| `robot-bat` | ui | Membrane flyer: finger struts with the skin drawn through their tips, and an inverted roost. |
| `robot-jellyfish` | ui | Pulsing bell: one contraction number drives the whole surface of revolution. |
| `robot-manta` | ui | Ray whose travelling wave runs across the span, with a roll that foreshortens it. |
| `robot-octopus` | ui | Mantle and eight independently solved arms, mounted on a ring. |
| `robot-seahorse` | ui | Upright swimmer whose prehensile grip is the spine solver's steering at the stop. |
| `robot-ant` | ui | Six-legged forager with three body sections on a bending chain. |
| `robot-scorpion` | ui | Eight legs plus a metasoma solved in the sagittal plane. |
| `robot-mantis` | ui | Raptorial forelimbs solved to a real target — the only animal with an IK goal. |
| `robot-frog` | ui | Solved hind legs driven through the whole jump by one pair of numbers. |
| `robot-turtle` | ui | Four-leg gait under a plated carapace everything retracts into. |
| `robot-inchworm` | ui | A looper on alternating anchors, with the arch solved from the anchor span. |
| `quadruped-kinematics` | lib | Pure planar leg solver and illustrative footfall trajectories. |
| `bellows-droid` | ui | Soft-shell pneumatic pod: a volume-conserving pleated dome, lens pods and a vent that ride it. |
| `produce-geometry` | lib | Solids of revolution: the surface, a golden-angle lattice by equal area, half shells that reassemble, a hinge about any line, blades that keep their length. |
| `robot-avocado` | ui | Split-shell pod: one surface halved, tilted apart on a rod, with the stone riding up the gap. |
| `robot-strawberry` | ui | Berry shell whose sensor studs are placed by area over its own skin, under a calyx of rigid blades. |
| `robot-tomato` | ui | Truss-hung fruit on a two-hinge peduncle, with a ripening front that is coverage rather than a ramp. |
| `casing-droid` | ui | Armoured conical casing unit: dome, skirt, neck cage, eyestalk, manipulator, emitter. |
| `astromech-droid` | ui | Barrel repair unit: ride heights, dome, livery, feet, antenna, ports, periscope, holo. |
| `attendant-droid` | ui | Plated etiquette humanoid: builds, faceplates, hands, collar, plating teardown. |
| `cyber-trooper` | ui | Converted armoured humanoid: helmets, visors, builds, shoulders, jaw, power reserve. |
| `pylon-droid` | ui | Deployable survey pylon: a triangular plate that folds every limb inside its own outline, then stands on a tripod. |
| `robot-hound` | ui | Boxy companion tracker on a concealed drive: a concertina neck, splayed ear dishes, a telescoping probe, one attention number. |
| `guide-droid` | ui | Rotor-lifted visitor guide: hover height, coil-sprung limbs, ring optics, speaker grille. |
| `sentinel-console` | ui | Bulkhead watch station: a gimballed optic behind a solved iris diaphragm, an identity strip, a voice grille. |
| `monolith-droid` | ui | Slab-bodied walker with no limbs: a column sliced into hinged slabs that splay into a stance and stride half a cycle apart. |
| `custodian-droid` | ui | Floating armoured custodian: armour segments on radial rails that bloom off a lit chassis, behind a caged gimballed optic. |
| `linear-actuator` | ui | Cylinder running a duty cycle, with a draggable rod and piston cutaway. |
| `servo-motor` | ui | Positional servo with interchangeable horn geometry. |
| `rotary-table` | ui | Indexing platter, fixtures, and workpieces; drag to spin, click to index. |
| `robot-rover` | ui | Four- or six-wheel ground robot that patrols, wanders, or comes to the pointer. |
| `robot-drone` | ui | Four- or six-rotor aircraft, drawn in plan, elevation or isometric. |
| `lidar-scan` | ui | Polar display whose ray sweeps and whose returns fade behind it. |
| `fabricator` | ui | Additive build cell: a three-axis gantry head laying a sampled solid voxel by voxel. |
| `arm-fabricator` | ui | The same build on an articulated arm: yawing turret, solved shoulder and elbow. |
| `drone-fabricator` | ui | The same build with no envelope: a repulsor platform that flies to each cell. |
| `voxel-form` | ui | The workpiece on its own, with no machine around it. |
| `voxel-geometry` | lib | Continuous occupancy fields sampled into buildable voxels, in deposition order, and the paths to draw them. |
| `transmission-geometry` | lib | Gear outlines and mesh phase, planetary trains that assemble, taut belt paths, energy chains. |
| `planetary-gearbox` | ui | Sun, planets and a held ring, meshing truthfully; the ratio comes from the teeth. |
| `belt-drive` | ui | Two pulleys, a real taut belt, and an idler that lengthens it. |
| `cable-carrier` | ui | The energy chain whose fold travels at half the carriage. |
| `mecanum-wheel` | ui | Barrel rollers modelled at 45° out of the wheel plane, handed. |
| `tool-changer` | ui | Two halves that seat, then lock; the only machine here that comes apart. |
| `suction-gripper` | ui | A bellows cup bar that lands on a sheet and carries it on the lips. |
| `robot-hand` | ui | Five digits on a thumb with a real saddle joint; the pinch gap is a number the solver produces. |
| `hand-kinematics` | lib | Five digits in one frame, a two-angle saddle thumb, and the pad gap opposition closes. |
| `robot-foot` | ui | An ankle and a hinged toe plate rolling through a stance, with the load moving heel to ball to toe. |
| `robot-leg` | ui | Hip, knee and ankle solved to the foot, with strut actuators whose stroke is the pose. |
| `robot-torso` | ui | A pelvis, equal vertebrae, and a rib cage that opens along the machine's depth. |
| `robot-skeleton` | ui | The whole biped: a run is a walk with the duty factor under a half. |
| `skeleton-kinematics` | lib | Stride cycles, foot roll, an equal-segment spine, arms swinging against the legs. |
| `motion-platform` | ui | The Stewart platform as a machine: payload deck, visible stroke, travel faults. |
| `electromagnetism-geometry` | lib | Helical windings, balanced three-phase vectors, and ideal resolver quadrature. |
| `solenoid-valve` | ui | A coil-driven plunger switching a two- or three-port valve gallery. |
| `electromagnetic-relay` | ui | An energized coil pulling a hinged armature across one or two contact sets. |
| `induction-motor` | ui | A three-phase stator and squirrel-cage rotor with visible slip. |
| `stepper-motor` | ui | Phase teeth indexing a permanent-magnet rotor through discrete steps. |
| `voice-coil-actuator` | ui | A moving coil and carriage travelling through a fixed magnet gap. |
| `magnetic-bearing` | ui | Four opposed coils centering a contactless rotor along either axis. |
| `eddy-current-brake` | ui | A movable magnet array braking a conductive disc without contact. |
| `maglev-carriage` | ui | A levitated payload carriage above a segmented linear stator. |
| `magnetic-gripper` | ui | Switchable pole shoes lifting a steel plate or bar without a jaw. |
| `inductive-sensor` | ui | An oscillator coil responding to a metal target at controlled distance. |
| `resolver` | ui | A rotary transformer producing ideal sine and cosine position channels. |
| `transformer-core` | ui | Coupled primary and secondary windings around EI or toroidal cores. |
| `use-robot-motion` | hook | The clock every machine runs on, and the handle you grab it by. |
| `device-geometry` | lib | Hinge closure, kickstand triangle, rotary detents, constant-pitch band, panels at any attitude. |
| `clamshell-laptop` | ui | A portable workstation on one solved hinge, with the screen drawn only where a camera can see it. |
| `slate-tablet` | ui | A slate and the kickstand whose foot has to reach the desk — or fold. |
| `wheel-player` | ui | A pocket player whose click wheel is geared to its list, with a hold switch that is a real interlock. |
| `slab-handset` | ui | One slab turned about its own axis: screen, edge, then the back and its camera array. |
| `wrist-terminal` | ui | A crown geared to a dial, on a link band that keeps its length. |
| `sound-geometry` | lib | Spiral groove, tonearm tracking error, exponential horn, spring governor, tuned comb, pinned barrel. |
| `turntable-deck` | ui | An arm geared to its platter by the groove, and the tracking error that falls out of it. |
| `gramophone-horn` | ui | A mainspring and its governor, a crank that is the wind, and an exponential horn. |
| `music-box-drum` | ui | A pinned barrel bending a comb tuned by length, and letting go on the pin. |
| `busker-droid` | ui | The only machine here whose pose comes from data: a step pattern, two solved arms. |

### Humanoid skeleton

`vitest` over the two new solvers and the five machines: phalanx lengths preserved at every
closure, spread and wrist angle; a `pinch` closing the pad gap to under a third of an open
hand's while a `hook`, which never opposes, stays wide; a left hand the exact mirror of a
right; bone lengths and vertebra spacing held through every gait, phase, lean and twist; no
part of any sole below the floor at any phase of any gait; the flight phase of a run reported
rather than hidden; the knee breaking forward and the elbow backward. `tsc --noEmit`,
`eslint`, `registry:build` and `next build` clean.

Driven in a browser at every stage, and rendered headless through all four views and all four
variants at each step. That caught the two that only a drawing shows: the toe being driven
through the floor at push-off, which is what gave the foot its real hinge at the ball, and a
rib cage that projected as a stack of rings until the hoops were opened into arcs that
descend as they come forward.

## Customisation contract

Every visual component takes the same three axes, so learning one teaches all of them.

**Colour.** Four palette roles — `shell`, `metal`, `dark`, `accent` — plus `glow`, `grid`,
`foreground`. Each resolves from a prop, else a CSS variable (`--robot-shell`, …), else a
shadcn token. The registry ships the variables in `cssVars` for light and dark, so an install
themes itself; passing `color="#f97316"` overrides one arm without touching the theme.

**Size.** `size` takes a scale name (`xs`–`xl`) or a pixel number. Geometry is defined in
world units inside a fixed `viewBox`, so size never re-lays-out the drawing — one number
scales the whole machine. `thickness` scales limb weight independently.

**Form.** `variant`: `solid` (filled machine), `outline` (line art), `blueprint` (technical
drawing with grid, dimensions and joint angles), `wire` (skeleton). `tool` picks the end
effector: `gripper | welder | painter | cutter | scanner | vacuum | magnet | none`.

**Motion.** Three rules, everywhere. A supplied value prop wins and stops the loop.
Without one, `behavior` runs the machine — per-component unions (`cycle`, `sweep`, `index`,
`patrol`, `hover`, `walk`, …) that always include `static` — scaled by `speed`, offset by
`phase`, frozen by `paused`, and parked by `animate={false}` or a reduced-motion
preference. `interactive` lets a person take it: the machine tracks the pointer while it is
held and eases back into the behaviour on release. Arms keep their own `behavior`
vocabulary: `pointer`, `orbit`, `sweep`, `idle`, `static`. The full per-machine table is in
[motion-and-interaction.md](motion-and-interaction.md).

### Views

Every machine with a body in space takes `view: "plan" | "front" | "profile" | "iso"`,
defaulting to the view it is drawn in, and is modelled once and pushed through
`robotCamera(view)` — never redrawn per angle. The exceptions are the instruments and panels
that are not objects in space: `lidar-scan`, `robot-loader`, `arm-controls` and `robot-face`
take no `view`, and `robot-arm-3d` / `robot-stage` have a real camera already.
`docs/views-backfill.md` has the per-component table and the two camera additions the backfill
needed; `docs/drone-views.md` has the camera itself.

## Kinematics core

- Two links solve analytically (law of cosines) with a chosen elbow side — cheap, stable,
  and the pose people expect from an industrial arm.
- Three or more links run FABRIK, seeded with the previous frame so animation is temporally
  coherent instead of snapping between valid solutions.
- Out-of-reach targets clamp onto the reachable sphere rather than failing, so a pointer
  dragged off-canvas produces a stretched arm, not a broken one.
- Delta gets its own closed-form solver (per-arm YZ formulation at 120° rotations); the
  gantry is direct.
- Pure functions over plain `{x,y}` / `{x,y,z}` objects. The 2D components and the three.js
  rig call the same code.

## Verification

### Initial release

Historical verification for the original release; this does not imply that the later
additions have been installed into that same fresh consumer project.

- `vitest` — 23 tests. Kinematics: link lengths preserved, reach clamping, FK/IK round trip,
  elbow side, delta solutions landing on their forearm spheres, seeded poses staying
  coherent. Components: accessible labels, limb counts, FK posing, colour overrides, the
  loader's progress semantics. Registry: every declared file exists, every item has a
  target, and no item imports a robocn file its registry entry does not depend on.
- The registry test caught the failure that matters most — `arm-controls` imported
  `robot-style` without depending on it, which would have shipped a broken install.
- `tsc --noEmit`, `eslint`, and `next build` over the whole app: clean.
- Driven in a browser at every stage. This caught a hydration mismatch (trigonometry
  differing in the last bits between Node and the browser — fixed by rounding coordinates
  before they reach the DOM), a delta whose motors sat inside its own plate, and a pose
  array that lagged a render behind a changed `links` prop.
- End to end: a fresh `create-next-app`, `shadcn init`, then
  `shadcn add https://robocn.dev/r/robot-arm.json …` for four items. Fourteen files, the
  theme variables, the keyframes and the npm dependencies all landed; `tsc` and
  `next build` passed in that project, and all four machines rendered.

Deployed at https://robocn.dev (Vercel, linesofcode scope, GitHub connected for
auto-deploys). `NEXT_PUBLIC_REGISTRY_URL` is set per environment and is what gets stamped
into the registry JSON at build time.

## Mobile robots and sensing

Rovers and drones drive themselves — a patrol of straight legs and square corners, a
hover, a chase after the pointer — and take a supplied `heading` as an override that stops
the loop. None of it integrates vehicle or flight dynamics: a rover's steering is the
heading error it is still working off, not a solved slip angle, and a drone's bank is its
own translation. All angles are degrees, clockwise from the top of the drawing. Invalid
angles use a stable neutral pose.

The lidar display consumes angle-distance pairs, using a caller-specified maximum range.
It omits invalid and beyond-range returns, never inventing obstacles or clamping them onto
the outer ring. Sensor heading rotates the returns; the scan ray sweeps on its own clock
and only lights the returns it passes — it never filters or ages the data behind it. The
docs demo labels its synthetic room data explicitly.

### Expanded library verification

The expanded source currently contains 24 registry items. The test suite covers actuator
poses, rover/drone/lidar geometry, accessible controls, catalogue filtering, mobile
navigation, registry documentation coverage, and animation scheduling. Motion regressions
are reproduced with controlled animation frames, including disabled paths, live reduced
motion, settled-state reporting, independent gantry axes, and stationary scripted updates.

The app passes TypeScript, ESLint, and the production build. The generated registry source
is checked against the component files. The new component demos and catalogue flows have
also been exercised in a browser on desktop and at a 390px viewport. These checks cover
source delivery and the docs app; the original release's fresh-consumer installation
check above has not been repeated for all of the expanded items.

## Robotic animals

Five machines drawn from animal locomotion, on two new solvers — a serpenoid travelling
wave (`spine-kinematics`) for the fish and the snake, and a radial many-legged gait
(`hexapod-kinematics`) for the spider and the crab. The bird's wing is an illustrated
three-link linkage driven by angles, and its docs say so. Design note:
[robotic-animals.md](robotic-animals.md).

Both solvers hold their link lengths exactly — the spine integrates a tangent angle instead
of moving joints, and the hexapod caps its stance radius so a full stride still lands inside
each leg's reach — and both are illustrative trajectories rather than dynamics: no thrust,
no drag, no balance, no ground reaction. Verified with `vitest` (solver invariants,
controlled-wins, behaviour sampling, invalid input, the click interactions), `tsc --noEmit`,
`eslint`, `pnpm registry:build`, `next build`, and driven in a browser on desktop and at a
390px viewport.

## The robotic menagerie

Twelve more animals on the same three solvers, and no new library — the point being that a
registry is better served by showing `spine-kinematics`, `hexapod-kinematics` and `solveChain2`
doing genuinely different work than by growing a thirteenth maths file. The wave that swims a
fish also flutters a jellyfish bell, arches a scorpion's tail out of the ground plane, and runs
*across* a manta's wing instead of along its body; the gait that walks a spider also plods a
turtle at four legs and forages an ant at six; and the chain the arms have always solved gives
the mantis the one inverse-kinematic goal in the set. Design note:
[robotic-menagerie.md](robotic-menagerie.md).

Two mechanisms are new without being new maths. The scorpion's tail is solved in the animal's
*sagittal* plane, so the solver's own `x` is how far back it reaches and its `y` is how high —
one curve supplying both the plan footprint and the true height, which is why arching it makes
the tail genuinely come over the back rather than being redrawn shorter. The inchworm solves
the other way round: its body is a fixed contour length, so a short bisection on the spine's
`turn` finds the arc whose chord is the current anchor span, and closing the span raises the
loop because the length has nowhere else to go.

The same caveats as the first five: illustrative trajectories, not dynamics. No thrust, drag,
buoyancy, balance or ground reaction, and no body-frame integration of the travel a gait would
produce. Where a linkage is drawn rather than solved — a dragonfly's wing membrane, a jellyfish
bell, a turtle's retraction — that item's docs `notes` say so.

Verified with `vitest` (the twelve behaviour samplers inside their own limits and neutral for a
non-finite clock, controlled props moving the named `data-*` mechanism, each click firing its
callback, interaction off firing none, `NaN` on every numeric axis never reaching the DOM, and
the mantis clamping an unreachable goal), the `views.test.tsx` snapshot suite over all four
cameras for each of the twelve, `tsc --noEmit`, `eslint`, `pnpm registry:build`, and driven in
a browser: every docs page, the landing catalogue, the pages at 390px with no horizontal
overflow, reduced motion forced on to confirm the loops park, and the click gestures worked.

## Fabrication

A family of machines that make something rather than moving something, on one new solver. The
workpiece is not artwork: `voxel-geometry` defines each shape as a *continuous* occupancy
field over the unit cube, and the component samples it at `resolution` and lays the cells in
a serpentine deposition order. Progress is an index into that order, so the bridge, carriage
and quill all point at the cell being laid — in controlled mode as much as under a behaviour.
Three bodies carry the same nozzle — a gantry cell, an articulated arm whose turret, shoulder
and elbow are solved for the cell being laid, and a repulsor platform that simply flies there —
and `voxel-form` is the workpiece with the machine taken away. Picking one is picking a
constraint: rails, a reachable sphere, or nothing holding it up. Design note:
[fabricator.md](fabricator.md).

`resolution` is the axis nothing else in the set has: raising it rebuilds the same object out
of smaller voxels rather than drawing a different picture, and every voxel is an SVG path, so
it scales without pixels. The field is continuous and the sampled volume converges on it as
the grid gets finer — the tests assert that against the analytic volume of a sphere — but the
component clamps `resolution` to 2–14 because the cell count is cubic and the drawn surface
quadratic. That clamp is a rendering budget, and the docs say so. Cells buried inside the
solid are never drawn; what renders is the surface at the current build line.

Verified with `vitest` (field convergence, deposition order, surface extraction against a
brute-force neighbour check, the projected paths, the cursor, controlled-wins, all six shapes,
all four views, invalid input, the keyboard control, the behaviour samplers, the arm holding
its link lengths in plan view under every build position, and the flyer's pod clamping), `tsc --noEmit`, `eslint`,
`pnpm registry:build`, `next build`, and driven in a browser on desktop and at a 390px
viewport.

## The guide droid

One machine that hangs rather than stands: a shell body under a spinning rotor, with its hands
and feet carried on coil springs. `lift` is the whole machine — the same number raises the
airframe and sets spring extension, tension in the air and compression on its feet — and the
coil is drawn from that extension rather than tweened between two pictures. Thrust shows in the
rotor wash, not the blade rate, so the blades never run backwards when it descends. Nothing
here is simulated: no thrust, mass, drag or spring constant, and the sway the limbs trail is a
drift term. The rotor is drawn, not solved, and the docs `notes` say so. Design note:
[guide-droid.md](guide-droid.md).

Verified with `vitest` (hover height moving the airframe and the springs, the blade count, the
limb linkage, the lit grille bars, the behaviour sampler's limits and its neutral pose for a
non-finite clock, a press flying it and a release handing it back, the keyboard control
reporting through `onHeightChange`, invalid input on every numeric axis, and the four views
through the snapshot suite), `tsc --noEmit`, `eslint`, `pnpm registry:build`, and rendered in
Chrome across every view and variant, the hover range, the 150px card, and the docs page on
desktop and at 390px with reduced motion forced on.

## The cat

`robot-cat` is the first machine in the set whose leg roots are carried by a solved spine.
Everything else with legs bolts them to a rigid body; here the shoulder is joint 0 of the back
and the hip is its last joint, so arching moves both and the four `solveChain2` legs are solved
from wherever it puts them. No new solver: `solveSpine` twice — the back and the tail — and
`solveChain2` four times. The solver's steady `turn` is the arch, tilted by half its own arc so
the crown lands in the middle of the back rather than dropping the hindquarters, and its
travelling wave is the bound that a walk does not have. Design note:
[robot-cat.md](robot-cat.md).

Femur and tibia are solved to the hock and hold their lengths exactly; the metatarsus below is
carried at an angle that opens with the crouch, which is how the one free parameter of a
three-link hind limb is spent — a rule, stated as one, rather than a solve that would pick a
different answer every frame. The ears, whiskers and the tail's banding are drawn, and the docs
`notes` say so. Verified with `vitest` (the behaviour samplers' limits and their neutral pose
for a non-finite clock, the arch moving the hip and its leg while the shoulder stays put, the
controlled crouch, tail and ear axes, the gait on a controlled cycle with contacts, the four
views through the snapshot suite, the click firing `onPounce` only when interactive, and `NaN`
on every numeric axis), `tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and
driven in a browser: every behaviour, all four variants, all four views, clicked, at 390px, and
with reduced motion forced on to confirm the loops park.

## The dog

`robot-dog` is the cat's answer run the other way: the spine carries the hip and **not** the
shoulder. A dog has no clavicle, so the shoulder is the far end of a scapula that pivots on the
ribcage and swings with its own leg's stride, which is where a trot's reach comes from — one
leg root solved off the back, one carried on a blade, which is the anatomy. The swing angle is
a rule, the way the hock's is. Design note: [robot-dog.md](robot-dog.md).

Two more mechanisms are new to the set and both are geometry. The **tail is solved in the
transverse plane**: every other `solveSpine` here bends inside the plane it is drawn in, and
this one bends across it, so the wag is perpendicular to the side elevation. The solved curve is
then rotated bodily about the animal's lateral axis by the carriage, a rigid rotation that keeps
every link length exact, which is why the profile foreshortens the tail as it swings and the
plan camera opens the arc out whole. The **neck is a solved two-link chain** to the poll, so
`nose` reaches the floor without moving the withers; the head's pitch at the poll is a rule off
`nose`, because a dog carries its head at an angle to its neck. Plan also gets its own frame
anchor: nose to tail tip is most of the frame once the camera is overhead.

Verified with `vitest` (the behaviour samplers' limits and their neutral pose for a non-finite
clock, the bark gesture's limits, the stride moving the scapula and the foreleg with it, the
arch moving the hip and its leg, the solved neck putting the nose down, the wag and the carriage
each moving the tail on their own axis, the ear and gaze axes, the click firing `onBark` only
when interactive, `NaN` on every numeric axis rendering a neutral pose, and the four views
through the snapshot suite), `tsc --noEmit`, `eslint`, `pnpm registry:build`, and driven in
Chrome: four views, four variants, every behaviour, the catalogue card, the pointer tracking and
the bark, reduced motion parking the loop, and the docs page at 390px.

## The soft shell

`bellows-droid` is the one machine in the set with no joints: the shell is the mechanism. Its
height and radius are tied so that `radius² × height` — the volume of the solid of revolution,
up to the profile's fixed shape factor — never changes, so filling it makes it taller *and*
narrower, and the optics, the vent and the crown all ride that one number. The silhouette is
the convex hull of the projected surface, which is exact for a convex solid of revolution and
gives all four cameras from one geometry; the pleats are meridians on the same surface, drawn
only while they face you. The crown gather and the pleat twist are illustrated rather than
solved from a fold pattern, and the docs `notes` say so — there is no pressure or material
model. Design note: [soft-shell-pod.md](soft-shell-pod.md).

Verified with `vitest` (volume conservation across the stroke, the behaviour samplers' range
and cycle repeat, the one axis reshaping shell, crown, optics and vent together, the four views
including the front and profile silhouettes being identical as a body of revolution's must be,
invalid input, the slider keyboard contract), `tsc --noEmit`, `eslint`, `pnpm registry:build`,
`next build`, and driven in a browser on desktop and at a 390px viewport.

## Machine parts

Eight machines and one solver that are *parts* rather than cells — the kit a machine is
assembled out of, where the Machines group previously only had things that make something or
move something. Design note: [machine-parts.md](machine-parts.md).

`transmission-geometry` is the new solver, and it carries four mechanisms nothing else in the
set had: a gear's outline, the phase relationship that makes two gears mesh, the taut path of
a belt round a set of pulleys, and an energy chain folded over its own bend. What it buys is
that the drawings cannot lie about their own ratios — a planetary train is only returned when
it actually assembles, meshing gears counter-rotate at the tooth ratio with a tooth in a
space at the line of centres, a belt round two equal pulleys measures `2 × centres + 2πr`, and
a chain keeps its link count and pitch at every travel while its fold moves at exactly half
the carriage. The mecanum wheel models each barrel roller's axis 45° out of the wheel plane
and projects both ends, so the handedness is geometry rather than artwork; the hand poses five
three-link chains forward; the motion platform puts `stewart-kinematics` under a payload deck
and reports the leg that has run out of travel instead of stretching it.

None of it is dynamics: no torque, belt tension, backlash, friction, contact or payload. Each
machine's docs `notes` say so, and say which parts are solved and which are illustrated — the
hand's thumb opposition and the mecanum roller's own spin are the two illustrated ones.

Verified with `vitest` (solver invariants above, each machine's controlled axis moving its
mechanism, the behaviour samplers at fixed phases, invalid input, accessible labels, palette
overrides), `tsc --noEmit`, `eslint`, `pnpm registry:build`, `next build`, and driven in a
browser on desktop and at a 390px viewport.

## The stowed silhouette

`pylon-droid` is the one machine in the set that hides inside its own outline. Stowed it is a
sharp equilateral plate flat on the ground — legs folded until the knee lands on the
hypotenuse, aft strut lying up the back face, waist shut over the core. `deploy` is the whole
machine: the same number lifts the chassis, solves both legs onto their pads, swings the strut
into the third contact a plate needs to stand fore-and-aft, and raises the apex cap off the
core on its mast. That constraint — every limb inside the triangle at zero — is what fixed the
leg links and the stowed foot, and the limbs are drawn behind the plate so `solid` shows the
bare outline while `outline` and `wire` show the mechanism through it. The strut's planted
angle is `acos(-(hinge + rise) / strut)` rather than a tuned number. Nothing is simulated:
no mass, no balance, no ground reaction, and it stands rather than travels. Design note:
[pylon-droid.md](pylon-droid.md).

Verified with `vitest` (deploy moving chassis, cap, legs and strut together, the stowed feet
staying off the ground, the core lighting only as the waist opens, the behaviour sampler's
limits and its duty cycle repeating in both directions, invalid input on every axis including
a bogus stance, the keyboard contract through `onDeployChange`, and the four views through the
snapshot suite), `tsc --noEmit`, `eslint`, `pnpm registry:build`, `next build`, and driven in a
browser on desktop and at a 390px viewport with reduced motion forced on.

## The sentinel console

The one machine in the set that is part of the ship. `sentinel-console` is a housing set into a
bulkhead — an identity strip, a gimballed optic, a voice grille — so it has no floor, no hull
and no ground shadow; `showBulkhead` draws the wall it is set into instead. Design note:
[sentinel-console.md](sentinel-console.md).

Two mechanisms carry it. The **iris** is solved: each blade pivots about a pin on a fixed ring
and carries a circular working edge, so the distance from the axis to that edge's centre is the
law of cosines in the blade swing, and the component runs it backwards — the opening you ask
for gives the swing, the swing draws the blades, and what they leave behind is a rounded
`blades`-gon of that inradius. It stays in the component rather than becoming a lib item
because there is no chain to seed and nothing to iterate. The **optic** is a body rather than a
pupil: it yaws and pitches about a pivot behind its own face, between two visible trunnions, so
turning it foreshortens the bezel into an ellipse and slides the glass across it.

Everything else is illustrated and the docs `notes` say so: no optics model, no exposure, no
depth of field, no actuator on the gimbal. The console is modelled once as solids in world
units and projected, so `profile` and `plan` drop the face artwork and show the depth — how far
the bezel stands proud, the speaker box, the conduit into the back of the housing. A wall
fixture seen from above is a band, and that is the honest drawing of one.

Verified with `vitest` (the iris solver against the analytic bore, its monotonicity, the blade
polygons being one shape rotated, and — the regression that matters — that no blade covers the
optical axis or intrudes on the solved opening while the material starts exactly where the
opening ends; the behaviour sampler's stops, cycle repeat and neutral pose; the aperture moving
the blades; `look` turning the cell and sliding the glass; `voice` lighting cells; invalid input
on every numeric axis; the keyboard contract), `tsc --noEmit`, `eslint`, `pnpm registry:build`,
and driven in Chrome: all four views and four variants, the catalogue card, the iris dragged
with a mouse and with a touch pointer, the arrow keys and Home/End reporting through
`onApertureChange`, release easing back into the behaviour, reduced motion parking the loop
while the drag still works, and the docs page at 390px with no horizontal overflow.

## The hound

`robot-hound` is the one animal in the set with no legs. Everything else with four feet —
`robot-quadruped`, `robot-cat`, `robot-turtle` — is a solved chain per leg hung off a body; the
hound travels on rollers tucked under a flared skirt, so the whole machine's expressive range is
in its head, and `attention` is the single number that runs it: the collar extends, the nose
comes up, the ear dishes prick and splay, the probe rises and the visor lights, all off one
value that a drag or the arrow keys can take over. Where it is *looking* is a separate axis, so
it can notice you from a stow. Design note: [robot-hound.md](robot-hound.md).

Two mechanisms are new. The **collar** is a concertina spanning two moving points — where
`bellows-droid` pleats a body of revolution about one fixed axis, the hound's ribs are rings on
the live axis between the deck and the head, so their spacing *is* the extension rather than a
drawn pleat. The **probe** telescopes rather than bending, which no other boom here does: three
sections of falling diameter with visible collars. And `robot-style` gains `frustumPath`, the
hull of two *different* footprints at two heights — `extrudedPath` gives a prism, and a machine
whose body is wider at the floor than at the deck needs the taper to read as built.

The head is a box that pitches and yaws, so its outline is the hull of its own eight corners
projected; the ear dishes, the eye and the collar ribs are circles sampled in their own planes,
which is what makes them ellipses from every other camera and why the dishes have to splay
outward to be seen at all in side elevation. None of it is dynamics: no drive model, traction,
mass or antenna pattern, the rollers turn on the clock rather than on any travel, and the hound
detects nothing — the visor lights because `attention` said so. The docs `notes` say all of it,
and the archetype is original: a boxy companion tracker, not a character.

Verified with `vitest` (one number moving the collar, head, ears and probe together and lighting
the visor; `look` turning the head without moving the collar; the keypad count, pod and boom
options and the squared-off skirt; the behaviour sampler's limits, its per-behaviour character
and its neutral pose for a non-finite clock; a press bringing the head up and a release handing
it back; the keyboard reporting through `onAttentionChange`; invalid input on every numeric axis;
the accessible label naming state, attention and view; `frustumPath` collapsing to `extrudedPath`
when both footprints match; and all four views through the snapshot suite), `tsc --noEmit`,
`eslint`, `pnpm registry:build`, and driven in Chrome: all four behaviours (`static` parked, the
others running), all four variants and all four views with no `NaN` reaching the DOM, grabbed
with a mouse and with a touch pointer without the page scrolling under it, the arrow keys and
Home/End, release easing back into the behaviour, reduced motion parking the loop while the
keyboard still works, the 150px catalogue card, and the docs page at 390px with no horizontal
overflow.

## Electromagnetic machines

The electromagnetic family adds twelve machines with separate jobs: a solenoid valve and
relay switch mechanisms, induction and stepper motors, a bidirectional voice coil, a magnetic
bearing, a contactless eddy-current brake, a linear maglev carriage, a lifting magnet, an
inductive proximity sensor, a resolver, and a coupled transformer core. None duplicates the
existing generic motor, cylinder, gripper, rotary table, conveyor, or lidar components. The
shared `electromagnetism-geometry` helper owns the finite helix, ideal balanced three-phase
resultant, and ideal resolver quadrature used by the drawings.

Each component models one physical control axis and projects the same geometry through all four
camera views. Field loops, flux arrows, braking response, levitation, detection, force, flow,
and contact timing are explanatory marks. They do not claim to solve Maxwell's equations,
electrical circuits, torque, force, heating, fluid pressure, material response, saturation, or
closed-loop stability. Those limits are repeated on the individual docs pages.

Verified with `vitest` (66 focused solver, behavior, interaction, accessibility, invalid-input,
and view checks plus 113 registry, docs, demo, and catalogue checks), `tsc --noEmit`, `eslint`,
`pnpm registry:build`, and `next build`. Driven in Chrome across all twelve docs routes, the
transformer's views, variants and behaviors, keyboard input, reduced motion, and a true 390px
viewport with no horizontal overflow. The repository-wide test run still reports three
pre-existing failures in hand pinch geometry and custodian-droid view snapshots; the
electromagnetic suites are green.


## Personal devices

Five machines you carry, on one new solver. The set had machines that make something, machines
that move something and the parts a machine is assembled from, and nothing that sits in a hand —
but a hinge, a kickstand, a click wheel and a link band are mechanisms in exactly the sense the
rest of the set means it: one degree of freedom, visible, and honest from four camera angles.
Design note: [personal-devices.md](personal-devices.md).

`device-geometry` carries four closures and a wrap that a drawing can get wrong, and each has an
invariant the tests hold it to: the hinge keeps the lid's length at every angle and reports when
it has passed vertical; the kickstand's foot is solved onto the desk with the leg at its real
length, and a leg too short to reach comes back `folded` rather than stretched, the way
`motion-platform` reports a leg out of travel; the detents wrap in both directions so a full turn
of a list lands on the row it started on; and the band keeps its link count and its pitch at every
closure, integrating a heading the way `spine-kinematics` does. It also carries `panelTransform`,
which is what puts a screen on a plane that is neither horizontal nor vertical — a lid, a propped
slate, a turned handset — as one affine transform plus a `facing` that says whether you are
looking at its front, its back, or its edge. Screens are drawn only when a camera can actually
see them, because a screen sheared to a sliver is a picture of a screen rather than a projection
of one.

None of it is dynamics: no friction in the hinge, no detent force on the crown, no material or
clasp in the band, no contact model under the stand's foot, and nothing that plays, senses or
knows which way up it is. Each machine's docs `notes` say so. The `screen` prop draws structure
in palette roles — a list, a dial, a keyboard, a window — never an application's own artwork, and
nothing in the set reproduces a manufacturer, product line, wordmark or paint scheme, in the
components, the demos or the labels.

Verified with `vitest` (the solver invariants above, each machine's controlled axis moving its
mechanism, the screen appearing only from a camera that can see it, the stand folding, the wheel
wrapping in both directions and its hold switch taking pointer, key and behaviour away together,
the handset's silhouette correctly *not* changing through a half turn while its faces and keys
do, the band's length at every closure, the crown ribs that face you, invalid input on every
numeric axis, accessible labels, palette overrides, and the behaviour samplers at fixed phases),
`tsc --noEmit`, `eslint`, `pnpm registry:build`, `next build`, and driven in a browser across
every view, variant and behaviour, grabbed with a pointer, at 150px and at a 390px viewport.

## Produce robots

Three field units whose shells copy the crop they work in, on one new solver. Each earns its
place on a mechanism the set did not have: `robot-avocado` is the first **body of revolution
that splits** — two halves of one surface tilting apart on a rod under the machine, with the
stone riding up out of the gap, and shutting them reassembles the surface exactly;
`robot-strawberry` is the first machine to **populate a surface**, placing its sensor studs by
the golden angle over *equal areas* of skin and running each one out along its own normal; and
`robot-tomato` is the first machine that **hangs**, carried by a truss clamp on a peduncle whose
two hinges share one swing angle. Design note: [produce-robots.md](produce-robots.md).

`produce-geometry` is the solver, and every export has an invariant the tests hold it to: the
lattice's successive azimuths differ by the golden angle and the count in any latitude band
matches that band's share of the lateral area to within a site; the two half shells are mirrors
point for point, so they reassemble; `hingeRotate` preserves every point's distance to the line
it turns about and is the identity at zero; and a blade's length is exact at every pitch. The
tomato's ripening front is coverage, not a colour ramp — the skin still to turn is the cap of
the surface above a latitude, bounded by the near half of a real ring on the body, and in plan
view, where what you see is the shoulder, the front is drawn only once it has climbed past the
belt.

None of it is agronomy: no crop, growth, ripeness, sensing or fruit-mechanics model, and the
tomato's swing is a shaped number rather than a solved pendulum with a mass and a length. Each
docs page says which parts are solved and which are illustrated — the stone's polish, the skin
speckle, the stud pits and the clamp are drawn.

Verified with `vitest` (the solver invariants above plus nonsense input on every argument; one
number opening the shell, raising the stone and parting the latch; the cut faces appearing only
when the shell is open and facing you; the optic hiding when it looks away; the lattice keeping
its site count as the studs run out and only the facing studs drawn; the two-hinge chain moving
the fruit while the clamp stays bolted down; the ripening front moving with `ripeness` and
vanishing at both ends; the behaviour samplers' limits, cycle repeat and neutral pose for a
non-finite clock; the four views on one geometry; the slider contract on all three), `tsc
--noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and driven in Chrome: every docs page,
all four views, all four variants, the landing cards at 150px, and the pages at 390px with no
horizontal overflow.

## Mechanical music

Four machines that make a sound by moving something, on one solver. Design note:
[mechanical-music.md](mechanical-music.md).

The piece that earns the file is the **spiral**: one revolution of a platter moves the stylus
in by exactly one groove pitch, which is what gears `turntable-deck`'s arm to its platter.
Progress and platter angle are therefore one number at two scales rather than two animations
that drift apart, and scrubbing the platter walks the stylus back out. The arm itself is a
triangle with two fixed sides, so a groove radius *fixes* the angle, and the **tracking error**
— the angle between the cartridge and the groove's tangent — falls out of the geometry and goes
in the readout. The same solver runs `gramophone-horn`, which is how it can be honest that a
straight acoustic arm never nulls at all and tracks an order of magnitude worse.

`gramophone-horn` adds a **governor**: the speed holds flat while the mainspring is above its
knee and sags proportionally below it, the flyweights stand out with the square of the speed
until they reach their stop, and the crank is the wind — three turns of the handle for a full
one. Its horn is an exponential flare, area doubling over a constant axial distance, built as a
stack of rings on one axis and projected, so it foreshortens truthfully from every camera.

`music-box-drum` and `busker-droid` share one mechanism, which is the reason there is one
solver and not two: **a step sequencer is a pinned barrel unrolled flat**. A pin bends its tine
further and further as it comes round, is at full bend exactly at the step, and is gone the
instant after — and that same `combLift` raises a droid's beater and drops it on the beat. The
comb is tuned by length, so an octave up is exactly one over root two, and the tine tips stand
in a line along the barrel with the roots stepping away, because a pin can only reach a tip on
the barrel's surface. `busker-droid` is the first machine in the set whose pose comes from
**data you pass it**, with both arms solved as two-link chains in the vertical plane that
contains the shoulder and the thing it is hitting.

None of it is acoustics: no frequency response, no horn cutoff, no radiation impedance, no
spring torque curve, no decay, and nothing plays a sound. One approximation is stated rather
than hidden — the gramophone's platter angle is the clock times the regulated speed, not an
integral of it — and each docs page says which parts are solved and which are drawn.

Verified with `vitest` (the solver invariants: the stylus walking monotonically inward with the
arm's own length preserved at every radius, tracking error crossing zero exactly twice across a
well-aligned sweep and staying under two degrees between, an acoustic arm reporting no nulls at
all, the horn's area doubling over a constant distance, the governor holding then sagging and
its flyweights going out with the square, an octave of comb at one over root two, a tine at full
lift at its pin and free the instant after, a blank pattern plucking nothing; plus each
machine's controlled axis moving its mechanism, the arm cueing and parking, the crank angle
tracking the wind, the pedal working off the kick row, the four views on one geometry, the
slider contract on all four, nonsense input on every numeric axis, and the behaviour samplers at
fixed phases), `tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and driven in
Chrome: every docs page, all four views, all four variants, the landing cards, reduced motion,
and the pages at 390px with no horizontal overflow.
