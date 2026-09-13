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
| `robot-style` | lib | Size scale, variants, palette resolution from CSS vars. |
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
| `robot-gripper` | ui | Standalone parallel or angular gripper with controlled opening. |
| `conveyor-belt` | ui | Automatic or controlled conveyor travel with workpieces. |
| `micro-duck` | ui | Bipedal duck robot: solved legs, craning neck, hinged beak. |
| `duck-kinematics` | lib | Pure biped pose solver: footfall cycle, neck chain, beak. |
| `reachy-mini` | ui | Companion head on a solved six-rod parallel platform. |
| `stewart-kinematics` | lib | Closed-form 6-DOF Stewart platform IK with stroke limits. |
| `robot-quadruped` | ui | Four-legged robot with solved controlled gait poses. |
| `quadruped-kinematics` | lib | Pure planar leg solver and illustrative footfall trajectories. |
| `linear-actuator` | ui | Cylinder with controlled stroke and piston cutaway. |
| `servo-motor` | ui | Positional servo with interchangeable horn geometry. |
| `rotary-table` | ui | Controlled indexing platter, fixtures, and workpieces. |
| `robot-rover` | ui | Four- or six-wheel ground robot with controlled heading and steering. |
| `robot-drone` | ui | Four- or six-rotor aircraft with controlled blade and heading angles. |
| `lidar-scan` | ui | Polar angle-distance display for supplied sensor returns. |

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

**Motion.** `behavior`: `pointer` (follow the cursor), `orbit`, `sweep`, `idle` (breathing
bob), `static`. Or drive it yourself with a controlled `target`. All motion respects
`prefers-reduced-motion` and the loop stops rendering once a pose settles.

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

## Controlled mobile robots and sensing

Rovers and drones render controlled poses directly. They do not integrate vehicle or
flight dynamics. Their controls update immediately and need no internal animation loop;
a consumer can supply its own timeline or telemetry. All angles are degrees, clockwise
from the top of the drawing. Invalid angles use a stable neutral pose.

The lidar display consumes angle-distance pairs, using a caller-specified maximum range.
It omits invalid and beyond-range returns, never inventing obstacles or clamping them
onto the outer ring. Sensor heading rotates the returns; scan angle only moves the ray.
The docs demo labels its synthetic room data explicitly.

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
