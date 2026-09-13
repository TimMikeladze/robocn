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
| `robot-fish` | ui | Swimming fish built on a travelling body wave, with fins and a dart. |
| `robot-snake` | ui | Serpentine crawler: even wave, sidewinding lift, coil, strike. |
| `spine-kinematics` | lib | Serpenoid travelling-wave spine with taper, turn and clearance. |
| `robot-spider` | ui | Eight-legged plan-view walker with solved knees and three gaits. |
| `robot-crab` | ui | Sideways walker on the same gait solver, with hinged claws. |
| `hexapod-kinematics` | lib | Radial four-to-ten-leg gait solver, knees solved per leg. |
| `robot-bird` | ui | Perching flyer with three-link wings and a fanning tail. |
| `quadruped-kinematics` | lib | Pure planar leg solver and illustrative footfall trajectories. |
| `casing-droid` | ui | Armoured conical casing unit: dome, skirt, neck cage, eyestalk, manipulator, emitter. |
| `astromech-droid` | ui | Barrel repair unit: ride heights, dome, livery, feet, antenna, ports, periscope, holo. |
| `attendant-droid` | ui | Plated etiquette humanoid: builds, faceplates, hands, collar, plating teardown. |
| `cyber-trooper` | ui | Converted armoured humanoid: helmets, visors, builds, shoulders, jaw, power reserve. |
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
| `use-robot-motion` | hook | The clock every machine runs on, and the handle you grab it by. |

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
