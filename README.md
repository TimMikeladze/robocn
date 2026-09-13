# robocn

**Robot components for shadcn/ui.** A [shadcn registry](https://ui.shadcn.com/docs/registry)
of machines that solve their own kinematics in the browser: articulated arms in SVG and
WebGL, production-line cells, mobile robots, robotic animals, and sensor displays.
Articulated arms solve their poses from real kinematics; rovers, drones, and lidar displays
accept controlled poses or sensor data. Components are procedural SVG or WebGL, not sprite
sheets.

[**robocn.dev**](https://robocn.dev) · [Components](https://robocn.dev/docs) ·
[Builder](https://robocn.dev/builder) · [Install](https://robocn.dev/docs/installation) ·
MIT licensed

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/landing-dark.png">
  <img alt="The robocn landing page: the pitch, the install line, and a three-link arm aiming at the pointer inside a work cell" src="docs/screenshots/landing-light.png">
</picture>

Components install as source into your project, the way shadcn/ui components do. Own them,
edit them, theme them with CSS variables.

```bash
pnpm dlx shadcn@latest add https://robocn.dev/r/robot-arm.json
```

## What is in it

Every item below is on [the landing page](https://robocn.dev), running, at the size it
installs at.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/catalogue-dark.png">
  <img alt="The robocn catalogue: a grid of hairline-bordered cards, each running one machine — a robot arm, the same arm as a WebGL rig, a lit stage, a fabricator laying voxels, a voxel workpiece, an arm fabricator" src="docs/screenshots/catalogue-light.png">
</picture>

| Item | What it is |
|---|---|
| `utility-droid` | Cylindrical service droid with three series, rotating sensor dome, chassis layouts, and deployable tools. |
| `orb-droid` | Rolling spherical companion with an independently stabilized head and pointer-tracking optic. |
| `bellows-droid` | Soft-shell pneumatic pod: a pleated dome that inflates and settles on a volume-conserving profile, carrying its lens pods and vent with it. Grab the crown. |
| `robot-avocado` | Split-shell specimen pod: one body of revolution halved on its own centre plane, the two halves tilting apart on a rod under the machine while the stone rides up out of the gap on a screw column. Shut, it reassembles exactly. |
| `robot-strawberry` | Berry-shelled field unit whose sensor studs are placed by the golden angle over *equal areas* of its own skin and run out along their own surface normals, under a calyx of rigid blades on one hinge. |
| `robot-tomato` | Truss-hung crop unit: a clamp, a peduncle with two hinges sharing one swing angle, a lobed shell, and a ripening front that is real coverage of the surface rather than a colour ramp. The only machine here that hangs. |
| `protocol-droid` | Humanoid translator with controlled postures, gestures, head angle, and optional exposed wiring. |
| `security-droid` | Tall angular guard frame with patrol poses, pointer-tracking sensor bar, and alert state. |
| `medical-droid` | Clinical assistant with diagnostic readout and independently selected instrument arms. |
| `infantry-droid` | Light or heavy field frame with controlled poses and utility equipment modules. |
| `probe-droid` | Hovering survey platform with steerable optics, scan cone, and three to six appendages. |
| `courier-droid` | Compact floor-running service bot with steering, tread travel, antennas, and cargo modules. |
| `casing-droid` | Armoured conical casing unit: three skirts and domes, sized hemisphere grid, neck cage, elevating eyestalk, manipulator and emitter. |
| `astromech-droid` | Barrel repair unit: tripod/bipod ride heights, three domes, liveries, feet and antennas, service ports, periscope and holo cone. |
| `attendant-droid` | Plated etiquette humanoid: three builds, faceplates and hands, optional collar, and plating that strips back to the loom. |
| `cyber-trooper` | Converted armoured humanoid: three helmets and visors, two builds, shoulder and jaw options, three chest units, power reserve. |
| `pylon-droid` | Deployable survey pylon: stowed it is a sharp triangular plate with every limb folded inside its own outline, and one deploy number stands it on a tripod with its apex cap lifted off a lit core. |
| `robot-hound` | Boxy companion tracker on a concealed drive: one attention number runs the collar out, lifts the nose, pricks the ear dishes and raises the telescoping probe; the only animal in the set with no legs. |
| `guide-droid` | Rotor-lifted visitor guide: one hover number flies it and stretches the coil springs its hands and feet ride on, with ring optics, a speaker grille, and a drag to fly it by hand. |
| `monolith-droid` | Slab-bodied walker with no limbs: a rectangular column sliced into parallel slabs, each hinged at its own top face, that splay into a braced stance and stride half a cycle apart. |
| `custodian-droid` | Floating armoured custodian: the casing is a ring of armour segments on radial rails, and one number blooms them into a corona off a lit chassis, with a gimballed optic behind a three-arm bracket cage. |
| `sentinel-console` | Bulkhead-mounted watch station: an identity strip, a gimballed optic on visible trunnions, a solved iris diaphragm that stops down to a pinhole, and a voice grille. The one machine that is part of the ship. |
| `robot-fish` | Swimming fish in profile: a tail-weighted body wave, working fins, pointer steering, a dart on click. |
| `robot-snake` | Serpentine crawler in plan: even wave, sidewinding lift with contact marks, a coil, a strike on click. |
| `spine-kinematics` | Serpenoid travelling-wave body solver, with taper, steady turn and ground clearance. |
| `bear-kinematics` | Plantigrade stance: a rigid sole placed on the floor with the leg solved to the ankle it produces, the base of support those intervals make, and the static load at each contact. |
| `robot-spider` | Eight-legged walker in plan with solved knees, three gaits, and a crouch on click. |
| `robot-crab` | Sideways walker: the same gait turned across the body, hinged claws, tracking eyestalks. |
| `hexapod-kinematics` | Radial four-to-ten-leg walker solver: tripod, wave and ripple gaits, knees solved per leg. |
| `robot-bird` | Perching flyer: three-link wings carrying fanned feathers, a beat cycle, a takeoff on click. |
| `robot-dragonfly` | Four-winged flyer in plan: fore and hind pairs half a cycle apart, a solved abdomen, a dart on click. |
| `robot-bat` | Membrane flyer: four finger struts with the skin drawn through their tips, an inverted roost, a drop on click. |
| `robot-jellyfish` | Pulsing bell: one number narrows, deepens and flares the whole surface, over a rippling curtain of solved tentacles. |
| `robot-manta` | Ray whose travelling wave runs across the span, with a roll that genuinely foreshortens it. |
| `robot-octopus` | Mantle and eight independently solved arms, mounted on a ring, reaching for the pointer. |
| `robot-seahorse` | Upright swimmer whose prehensile grip is the spine solver's steering taken to the stop. |
| `robot-ant` | Six-legged forager with three body sections on a bending chain, tracking antennae and a cargo module. |
| `robot-scorpion` | Eight legs plus a metasoma solved in the sagittal plane, so the arch is a real height. |
| `robot-mantis` | Raptorial forelimbs solved to a real target — the only animal here with somewhere to reach. |
| `robot-frog` | Solved hind legs driven through crouch, launch, trail and landing by one pair of numbers. |
| `robot-turtle` | The gait solver at four legs, under a procedurally plated carapace everything retracts into. |
| `robot-cat` | Four solved legs whose roots are the two ends of a solved spine: the arch moves them both. |
| `robot-dog` | The cat's twin with a floating shoulder: the hip is a spine joint, the shoulder is the far end of a swinging scapula, the neck is solved to the floor, and the tail is solved across the centre plane so the wag runs out of the drawing. |
| `robot-fox` | The third answer to what moves a leg root: the whole body tips about its hip. The brush is an output rather than an input, and the two ears pan onto one quarry so their axes converge. |
| `robot-bear` | The quadruped that stands up: soles that are intervals rather than points, so the feet make a base of support with edges, and a balance rule that keeps the centre of mass inside it — or does not, and topples. |
| `robot-horse` | The first machine whose gait is a real thing rather than a label: named footfall sequences with the beat counted off them, and a fetlock and a neck that are both driven by the load each foot is carrying. |
| `robot-inchworm` | A looper that moves by alternating anchors, with the arch height solved from the anchor span. |
| `micro-duck` | Bipedal duck robot: solved legs, a craning neck, and a beak that opens. |
| `duck-kinematics` | Pure biped pose solver: footfall cycle, S-curve neck chain, hinged beak. |
| `reachy-mini` | Companion head on a six-rod parallel platform, with tracking eyes and antennas. |
| `stewart-kinematics` | Closed-form six-degree-of-freedom Stewart platform IK with stroke limits. |
| `robot-quadruped` | Four-legged robot with solved gait poses and controlled stance. |
| `quadruped-kinematics` | Pure two-link leg solver with standing, walking, and trotting trajectories. |
| `fabricator` | Additive build cell: a three-axis head laying a sampled solid voxel by voxel, six shapes, a resolution axis, four camera angles. |
| `arm-fabricator` | The same build on an articulated arm: a yawing turret and a solved shoulder and elbow reaching for each cell. |
| `drone-fabricator` | The same build with no envelope: a repulsor platform that flies to each cell and banks into its travel. |
| `voxel-form` | The workpiece on its own — the sampled solid, with no machine around it. |
| `voxel-geometry` | Continuous occupancy fields sampled into buildable voxels, in deposition order, with the buried cells dropped, and the paths to draw them. |
| `linear-actuator` | Controlled cylinder stroke with optional piston cutaway. |
| `servo-motor` | Positional servo with single, double, or cross horns. |
| `rotary-table` | Rotary indexing platter with controlled angle and up to twelve fixtures. |
| `robot-rover` | Four- or six-wheel ground robot with controlled heading, steering, and tread travel. |
| `robot-drone` | Quad- or hexacopter with counter-rotating propellers and optional guards. |
| `lidar-scan` | Polar range display for supplied angle-distance samples. |
| `robot-gripper` | A standalone parallel or angular gripper with controlled jaw opening. |
| `conveyor-belt` | A conveyor with automatic or controlled travel, reversible direction, and workpieces. |
| `transmission-geometry` | Gear outlines and mesh phase, assembly-valid planetary trains, taut belt paths, and an energy chain folded over its bend. |
| `planetary-gearbox` | A reduction stage with its face off: sun, planets and a held ring, with real meshing teeth and the ratio read off the tooth counts. |
| `belt-drive` | A toothed belt on its real tangents and wrap angles, with an idler you can wind down and teeth that march by arc length. |
| `cable-carrier` | The energy chain that feeds a moving axis, its fold travelling at exactly half the carriage. |
| `mecanum-wheel` | Six to fourteen barrel rollers modelled at 45° out of the wheel plane, in a left hand and a right. |
| `tool-changer` | A robot-side and tool-side coupler that comes apart: seat the halves, then drive the lock balls out. |
| `suction-gripper` | A bar of bellows cups that lands on a sheet, compresses against it, and carries it on the lips. |
| `robot-hand` | Five digits on a thumb with a real saddle joint: fingers that abduct, seven named grasps, a handedness, and the pad gap a pinch closes. |
| `robot-foot` | An ankle and a hinged toe plate rolling through a stance, with the load moving from the heel to the ball to the toe. |
| `robot-leg` | A hip, knee and ankle solved to wherever the foot has to be. Grab it and the foot is yours. |
| `robot-torso` | A pelvis, a column of equal vertebrae, and a cage of rib hoops that opens as it breathes. |
| `robot-skeleton` | The whole biped, walking. A run is a walk with the duty factor under a half, and it says when both feet are off the floor. |
| `hand-kinematics` | The hand solver: five digits in one frame, a two-angle saddle thumb, and the pinch gap that falls out of it. |
| `skeleton-kinematics` | The biped solver: stride cycles, a foot that rolls over a planted sole, an equal-segment spine, counter-swinging arms. |
| `motion-platform` | A six-axis Stewart base under a payload deck, with visible stroke and a fault when a pose asks for more travel than it has. |
| `produce-geometry` | Solids of revolution with a real profile: the surface, a golden-angle lattice spaced by equal surface area, half shells that reassemble, a hinge about any line, and blades that keep their length at every pitch. |
| `electromagnetism-geometry` | Helical winding points, balanced three-phase vectors, and ideal resolver sine/cosine channels. |
| `solenoid-valve` | A coil-driven plunger switching a visible two- or three-port flow gallery. |
| `electromagnetic-relay` | An energized coil pulling an armature across one or two contact sets. |
| `induction-motor` | Three stator phases producing a rotating field around a squirrel-cage rotor. |
| `stepper-motor` | Four energized phases indexing a toothed rotor through discrete steps. |
| `voice-coil-actuator` | A moving coil travelling bidirectionally through a fixed annular magnet gap. |
| `magnetic-bearing` | Four opposed electromagnets centering a visibly unsupported rotor. |
| `eddy-current-brake` | A magnet array overlapping a conductive disc to illustrate contactless braking. |
| `maglev-carriage` | A levitated carriage travelling above a segmented linear stator. |
| `magnetic-gripper` | Switchable pole shoes capturing and lifting a steel workpiece without jaws. |
| `inductive-sensor` | A metal target moving through the qualitative lobe of an oscillator coil. |
| `resolver` | A rotary transformer producing ideal sine and cosine position channels. |
| `transformer-core` | EI and toroidal cores with selectable winding ratios and reversible flux. |
| `device-geometry` | The mechanisms in a machine you carry: a hinge, a kickstand that has to close, rotary detents that wrap, a constant-pitch link band, and a screen on a plane at any attitude. |
| `clamshell-laptop` | A portable workstation on one solved hinge: the lid keeps its length, the screen only draws from a camera that can see it, and the hinge stops at the travel it has. |
| `slate-tablet` | A slate and its kickstand on one recline axis, with the foot solved onto the desk — and folded flat when the leg is too short to reach. |
| `wheel-player` | A pocket media player whose click wheel is geared to its list: one turn is one pass, the detents wrap, and the hold switch is a real interlock. |
| `slab-handset` | A touchscreen slab turned about its own axis: edge on at a quarter, back and camera array at a half, and a display re-laid-out rather than rotated for landscape. |
| `wrist-terminal` | A wrist display with a crown geared to its dial and a link band that keeps its length however far it is opened. |
| `sound-geometry` | The closures in a machine that makes a sound by moving something: a spiral groove, a pivoted tonearm's tracking error, an exponential horn, a spring governor, a tuned comb, and a pinned barrel. |
| `turntable-deck` | A belt-drive deck whose arm is geared to its platter by the groove: one revolution walks the stylus in one groove pitch, and the tracking error is in the readout. |
| `gramophone-horn` | The acoustic deck a century earlier: a mainspring whose governor holds the speed until it runs down, a crank that is the wind, and an exponential horn. |
| `music-box-drum` | A pinned barrel bending a comb tuned by length, and letting go the instant the pin reaches the tip. The notes are a pattern you pass it. |
| `busker-droid` | A one-machine band whose pose comes from data: a step pattern raises each beater and drops it on the beat, both arms solved to what they are about to hit. |
| `robot-arm` | The articulated arm. Any number of links, eight end effectors, four paint variants, four mounts. |
| `robot-arm-3d` | The same arm as a procedural react-three-fiber rig. |
| `robot-stage` | Canvas, lights, contact shadow, grid floor and orbit controls for the 3D items. |
| `scara-arm` | A SCARA cell in plan view: two rotary links, a Z spindle, the swept area. |
| `delta-arm` | A parallel delta in isometric, solved with the closed-form delta IK. |
| `gantry-arm` | A cartesian gantry with independent axes and an optional plotter trail. |
| `robot-face` | A head whose eyes follow the pointer, with six moods. |
| `robot-loader` | A pick-and-place cycle as a loading indicator, determinate or not. |
| `arm-controls` | A teach pendant: one slider per joint, driving an arm in forward kinematics. |
| `robot-kinematics` | The solver. No React, no three.js, no dependencies. |
| `robot-style` | Sizes, variants, palette resolution, and the theme variables and keyframes. |
| `robot-color` | CSS variables and `oklch()` turned into something three.js can parse. |
| `use-robot-arm` | Animated pose for a link chain, plus `useEasedPoint`. |
| `use-pointer-target` | Pointer position in a component's own world units. |
| `use-robot-motion` | The clock the machines run on, the rate limiter, and press-and-drag control. |

Installing a component pulls in what it needs: `robot-arm` brings `robot-kinematics`,
`robot-style` and both hooks, and the theme variables ride along with `robot-style`.

## Usage

```tsx
import { RobotArm } from "@/components/ui/robot-arm"

export function Hero() {
  return (
    <RobotArm
      links={[1, 0.82, 0.34]}
      tool="welder"
      behavior="pointer"
      size="lg"
      showEnvelope
    />
  )
}
```

The SVG machines share colour, size, and paint variants. Motion and mechanical
controls depend on the component; each docs page lists its supported props.

**Colour.** Four roles — `shell`, `metal`, `dark`, `accent` — each resolving from a prop,
then a CSS variable, then a built-in default.

```tsx
<RobotArm color="oklch(0.58 0.2 292)" accent="#f5d90a" />
```

```css
:root {
  --robot-shell: oklch(0.72 0.17 47);
  --robot-accent: oklch(0.72 0.15 176);
}
```

**Size.** `size` takes a scale step (`xs`–`xl`) or a pixel number. Geometry lives in a fixed
viewBox, so size only ever scales the drawing. Arms also support `thickness` to scale
limb weight separately.

**Form.** `variant` is `solid`, `outline`, `blueprint` or `wire`. Blueprint adds the grid,
the dimensions or the joint angles where applicable. On articulated arms, `tool` picks
the end effector and `mount` bolts the machine to the floor, ceiling or wall.

**Motion.** Every machine moves on its own. Leave the value prop out — `extension`,
`angle`, `phase`, `heading` — and it runs `behavior`: a cylinder works its duty cycle, a
servo sweeps or steps, a table indexes, a rover patrols, a drone hovers, a lidar ray
sweeps, the duck walks. Supply the value and the loop stops: controlled always wins, which
is how every one of these components already worked. `speed` scales the cycle, `phase`
offsets it, `paused` freezes it, and `animate={false}` or a reduced-motion preference parks
it. Arms keep their own vocabulary — `behavior` is `pointer`, `orbit`, `sweep`, `idle` or
`static`, or drive them with a `target`, a function of elapsed seconds, or an `angles`
array. A settled pose costs no renders.

**Interaction.** `interactive` turns a machine into a control: drag the actuator's rod, the
servo horn, the gripper's jaws, the conveyor belt, the rotary platter, or an arm's tool tip;
arrow-key any of them; click a fixture to index it; press to send the rover a bearing or fly
the drone. While you hold it, the machine tracks the pointer exactly; let go and it eases
back into whatever its behaviour has moved on to, rate-limited the way a servo returns.
Every draggable is also a `role="slider"` with the value on it, and every gesture starts
with a press, so touch devices get the same control a mouse does.

The details, per machine, are in [docs/motion-and-interaction.md](docs/motion-and-interaction.md).

## Examples

Every component page on the site is a bench: the machine on the left, every prop it takes
wired to a control on the right, and the install line for it above.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/docs-dark.png">
  <img alt="The Robot arm component page: the arm rendered in a framed bench on the left, and controls for view, variant, tool, motion, mount, colour and link count on the right" src="docs/screenshots/docs-light.png">
</picture>

**A machine that runs itself.** Leave the value prop out and it works its own cycle.

```tsx
import { RobotRover } from "@/components/ui/robot-rover"

<RobotRover wheels={6} behavior="patrol" label="ROVER / 06" />
```

**The same machine, controlled.** Supply the value and the loop stops — controlled always
wins.

```tsx
import { LinearActuator } from "@/components/ui/linear-actuator"

<LinearActuator extension={0.62} cutaway />
```

**A machine as a control.** `interactive` makes it draggable and arrow-keyable, with a
`role="slider"` on the handle; let go and it eases back into its behaviour.

```tsx
import { RobotGripper } from "@/components/ui/robot-gripper"

const [opening, setOpening] = React.useState(0.4)

<RobotGripper interactive opening={opening} onOpeningChange={setOpening} fingers="parallel" />
```

**Drive an arm from joint angles.** `arm-controls` is a teach pendant — one slider per
joint, forward kinematics, no solver in the path.

```tsx
import { ArmControls } from "@/components/ui/arm-controls"

const [angles, setAngles] = React.useState([-30, 45, 20])

<ArmControls angles={angles} onAnglesChange={setAngles} tool="welder" />
```

**The same arm in three dimensions.** `robot-arm-3d` is the same chain as a procedural
react-three-fiber rig; `robot-stage` is the canvas, lights, contact shadow and orbit
controls it needs.

```tsx
import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotStage } from "@/components/ui/robot-stage"

<RobotStage className="h-80 w-full" floor="grid">
  <RobotArm3D interactive links={[1, 0.82, 0.34]} tool="gripper" behavior="orbit" />
</RobotStage>
```

**An animal.** The walkers take the same vocabulary — a view, a size, a variant, and
either a behaviour or the pose numbers themselves.

```tsx
import { RobotCat } from "@/components/ui/robot-cat"

<RobotCat view="profile" size={360} behavior="prowl" label="FELIS / 13" />
```

**A sensor display.** `lidar-scan` takes real angle–distance samples and draws the polar
plot; the sweeping ray is the behaviour on top of it.

```tsx
import { LidarScan } from "@/components/ui/lidar-scan"

<LidarScan samples={samples} maxRange={12} showRays behavior="sweep" />
```

## The kinematics

- Two links solve analytically with the law of cosines, with a chosen elbow side.
- Three or more run FABRIK, seeded with the previous frame so animation stays coherent
  instead of snapping between valid solutions.
- Out-of-reach targets clamp onto the reachable annulus rather than failing.
- The delta and the Stewart platform have their own closed-form solvers; the gantry is direct.
- Everything is plain functions over `{x, y}` and `{x, y, z}` objects, shared by the SVG
  components and the three.js rig.

```ts
import { solveChain2, chainAngles2 } from "@/lib/robocn/kinematics"

const joints = solveChain2({ x: 0, y: 0 }, { x: 40, y: 25 }, [30, 24, 16])
const angles = chainAngles2(joints)
```

## Namespaced install

```json
{
  "registries": {
    "@robocn": "https://robocn.dev/r/{name}.json"
  }
}
```

```bash
pnpm dlx shadcn@latest add @robocn/robot-arm @robocn/delta-arm
```

## Development

```bash
pnpm install
pnpm dev              # docs site and registry, on http://localhost:3000
pnpm generate         # builder runtime + the registry→component gallery map
pnpm registry:build   # writes public/r/*.json
pnpm og               # recaptures public/og.png, the social card
pnpm shots            # recaptures docs/screenshots/*.png, the pictures above
pnpm test             # kinematics, components, registry integrity
pnpm typecheck
pnpm build            # builds the registry, then the site
```

The app is both the docs site and the registry source: every file listed in `registry.json`
lives at the path a consumer installs it to, so what the site renders is exactly what ships.
`registry.json` refers to its own items by URL — the only way one registry item can depend on
another outside shadcn's own registry — so the host is stamped in at build time from
`NEXT_PUBLIC_REGISTRY_URL` (or Vercel's production URL).

The social card at `public/og.png` is a screenshot of `/og`, which is a real page built
from real components — see [the social card](docs/og-image.md) for why, and run `pnpm og`
after changing what it shows. The pictures in this README are captures of the real pages
for the same reason: `pnpm shots`, and [the screenshots](docs/screenshots.md) for the shot
list. Both drive headless Chrome through `scripts/lib/capture.mjs`.

The project describes itself in three places. `package.json` carries the description,
keywords, homepage and repository; `src/lib/site.ts` carries the name, tagline,
description and keywords the `<meta>` tags are built from in `src/app/layout.tsx`, and
`productionUrl` — the host printed on the social card and in the screenshots, whichever
server actually rendered them. The third is GitHub's own repo metadata, which is settings
rather than source:

```bash
gh repo edit --description "…" --homepage https://robocn.dev --add-topic shadcn-registry
```

A test keeps the first two from drifting apart. The repo's social preview image is
`public/og.png`, uploaded by hand under Settings → General → Social preview — GitHub has
no API for it.

The header mark is a machine too: a three-link arm in a work cell, solved by the same core
the registry ships, painted in the same orange, aiming at the cursor anywhere on the page —
[the logo](docs/logo.md), and [the header lockup](docs/header-lockup.md) for the type and
spacing around it.

Adding a component means: write it under `src/components/ui` and add an entry to
`registry.json`. That is the whole requirement — the item is then on the landing page, in
the docs index, on its own docs page with a working demo, and in the sitemap, because all
four are built from the registry and fall back to the component's own default pose when
nobody has written a card or a bench for it. Write the `docs.ts` entry, the card art and
the demo when you want better than the default.

Three things are enforced. The registry test fails if a component imports a robocn file its
registry entry does not depend on — the failure mode that would otherwise ship a broken
install. The catalogue test fails if an item does not reach the landing grid, because the
page shows every item in the registry rather than a curated subset. And the motion test
drives real animation frames at every card and fails the ones that draw the same picture
three seconds later, because a pinned value prop is indistinguishable from configuration in
the source. See [gallery coverage](docs/gallery-coverage.md).

The whole path — solver, component, camera angles, motion, registry, docs, demo, catalogue,
README row, tests — is written up as an agent skill at `.claude/skills/ship-robot/`.

## Robot builder

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/builder-dark.png">
  <img alt="The robocn builder: a design-partner conversation panel on the left with starting-point prompts, and a live sandboxed preview of the robot arm on the right over a dotted grid" src="docs/screenshots/builder-light.png">
</picture>

Open `/builder` to load any component from the library, edit its actual React source,
and preview it in an isolated browser sandbox. Connect an OpenAI API key to design new
robots or ask the agent to revise an existing one. Drafts and versions stay in your
browser; export TSX or a shadcn registry item when ready.

See [builder setup and architecture](docs/builder.md) for local/server agent configuration
and deployment. `pnpm dev`, `pnpm build`, `pnpm test`, and `pnpm typecheck` prepare the
builder's runtime from the current library automatically.

## Credits

The kinematics and the rig vocabulary grew out of the fabricator in
[keycaps](https://github.com/TimMikeladze) — a swarm of autonomous arms that bid for work —
generalised here from one bespoke three.js scene into installable components.

## License

MIT © 2026 Tim Mikeladze. See [LICENSE](LICENSE).
