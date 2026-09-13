# robocn

A [shadcn registry](https://ui.shadcn.com/docs/registry) of robot components: articulated
arms in SVG and WebGL, production-line machines, mobile robots, and sensor displays.
Articulated arms solve their poses from real kinematics; rovers, drones, and lidar displays
accept controlled poses or sensor data. Components are procedural SVG or WebGL, not sprite sheets.

Components install as source into your project, the way shadcn/ui components do. Own them,
edit them, theme them with CSS variables.

```bash
pnpm dlx shadcn@latest add https://robocn.dev/r/robot-arm.json
```

## What is in it

| Item | What it is |
|---|---|
| `linear-actuator` | Controlled cylinder stroke with optional piston cutaway. |
| `servo-motor` | Positional servo with single, double, or cross horns. |
| `rotary-table` | Rotary indexing platter with controlled angle and up to twelve fixtures. |
| `robot-rover` | Four- or six-wheel ground robot with controlled heading, steering, and tread travel. |
| `robot-drone` | Quad- or hexacopter with counter-rotating propellers and optional guards. |
| `lidar-scan` | Polar range display for supplied angle-distance samples. |
| `robot-gripper` | A standalone parallel or angular gripper with controlled jaw opening. |
| `conveyor-belt` | A conveyor with automatic or controlled travel, reversible direction, and workpieces. |
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

**Arm motion.** `behavior` is `pointer`, `orbit`, `sweep`, `idle` or `static`. Or drive it
yourself with a controlled `target`, a function of elapsed seconds for a scripted path, or an
`angles` array to pose it joint by joint. The loop stops once a pose settles, so a parked arm
costs no renders. With animation disabled or reduced motion enabled, fixed goals snap
into place and scripted paths are sampled at `phase` without a continuous loop.

Rovers, drones, and actuators use controlled positions without internal timers. The
conveyor can run automatically or take a controlled position. Lidar displays accept
your angle-distance samples.

## The kinematics

- Two links solve analytically with the law of cosines, with a chosen elbow side.
- Three or more run FABRIK, seeded with the previous frame so animation stays coherent
  instead of snapping between valid solutions.
- Out-of-reach targets clamp onto the reachable annulus rather than failing.
- The delta has its own closed-form solver; the gantry is direct.
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
pnpm registry:build   # writes public/r/*.json
pnpm test             # kinematics, components, registry integrity
pnpm typecheck
pnpm build            # builds the registry, then the site
```

The app is both the docs site and the registry source: every file listed in `registry.json`
lives at the path a consumer installs it to, so what the site renders is exactly what ships.
`registry.json` refers to its own items by URL — the only way one registry item can depend on
another outside shadcn's own registry — so the host is stamped in at build time from
`NEXT_PUBLIC_REGISTRY_URL` (or Vercel's production URL).

Adding a component means: write it under `src/components/ui`, add an entry to `registry.json`,
add its docs entry and demo, and run the tests. The registry test fails if a component imports
a robocn file its registry entry does not depend on, which is the failure mode that would
otherwise ship a broken install.

## Credits

The kinematics and the rig vocabulary grew out of the fabricator in
[keycaps](https://github.com/TimMikeladze) — a swarm of autonomous arms that bid for work —
generalised here from one bespoke three.js scene into installable components.

MIT.
