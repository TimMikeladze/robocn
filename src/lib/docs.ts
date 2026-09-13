/**
 * What the docs site knows about each registry item: the copy, the props
 * table, and which source files to show. The registry itself stays the source
 * of truth for what ships; this is the reading material around it.
 */

export interface PropRow {
  name: string
  type: string
  default?: string
  description: string
}

export type DocGroup = "Arms" | "Machines" | "Robots" | "Foundations"

export interface DocEntry {
  slug: string
  /** Registry item name, or null for a page that installs nothing. */
  item: string | null
  title: string
  summary: string
  group: DocGroup
  /** Files shown under "Source", relative to `src/`. */
  files: string[]
  usage?: string
  props?: PropRow[]
  /** Short API list, for libraries and hooks. */
  api?: PropRow[]
  notes?: string[]
}

const palette: PropRow[] = [
  {
    name: "color",
    type: "string",
    default: "var(--robot-shell)",
    description: "Body panels — the colour the machine reads as.",
  },
  {
    name: "accent",
    type: "string",
    default: "var(--robot-accent)",
    description: "Status colour: tip light, live tool, readouts.",
  },
  {
    name: "metal",
    type: "string",
    default: "var(--robot-metal)",
    description: "Bare machined parts: collars, bolts, tool bodies.",
  },
  {
    name: "dark",
    type: "string",
    default: "var(--robot-dark)",
    description: "Cast joints, base, shadow side.",
  },
  {
    name: "palette",
    type: "Partial<RobotPalette>",
    description:
      "Override any subset of roles at once, including glow and grid.",
  },
]

const form: PropRow[] = [
  {
    name: "variant",
    type: `"solid" | "outline" | "blueprint" | "wire"`,
    default: `"solid"`,
    description:
      "How the machine is painted. Geometry never changes between variants.",
  },
  {
    name: "size",
    type: `"xs" | "sm" | "md" | "lg" | "xl" | number`,
    default: `"md"`,
    description: "Rendered width in pixels, or a step on the scale.",
  },
  {
    name: "thickness",
    type: "number",
    default: "1",
    description: "Limb weight multiplier, independent of size.",
  },
]

const motion: PropRow[] = [
  {
    name: "speed",
    type: "number",
    description: "Tip travel in world units per second.",
  },
  {
    name: "animate",
    type: "boolean",
    default: "true",
    description:
      "Off snaps to the goal and renders once. Reduced-motion does this for you.",
  },
  { name: "paused", type: "boolean", default: "false", description: "Freeze in place." },
  {
    name: "phase",
    type: "number",
    default: "0",
    description: "Seconds of offset, so a row of machines breaks step.",
  },
]

export const docs: DocEntry[] = [
  {
    slug: "installation",
    item: null,
    title: "Installation",
    summary:
      "robocn is a shadcn registry. Components install as source into your project, with their dependencies and theme variables.",
    group: "Foundations",
    files: [],
    notes: [
      "Run `shadcn init` first if the project has no components.json — robocn components import `cn` from your utils alias.",
      "Each item pulls in the libraries and hooks it needs. Installing robot-arm also installs robot-kinematics, robot-style and the two hooks.",
      "The theme variables and keyframes ride along with robot-style, so an install themes itself.",
    ],
  },
  {
    slug: "robot-arm",
    item: "robot-arm",
    title: "Robot arm",
    summary:
      "The articulated arm: any number of links, eight end effectors, four paint variants, four mounts. Give it a target, a behaviour, or a set of joint angles.",
    group: "Arms",
    files: ["components/ui/robot-arm.tsx"],
    usage: `import { RobotArm } from "@/components/ui/robot-arm"

export function Cell() {
  return (
    <RobotArm
      links={[1, 0.82, 0.34]}
      tool="welder"
      behavior="pointer"
      size="lg"
      showEnvelope
    />
  )
}`,
    props: [
      {
        name: "links",
        type: "number[]",
        default: "[1, 0.82, 0.34]",
        description:
          "Relative link lengths, shoulder outward. Scaled to fill reach, so these are proportions.",
      },
      {
        name: "reach",
        type: "number",
        default: "64",
        description:
          "Total stretch in world units. The view is 132 × 118 with the base at (0, 0).",
      },
      {
        name: "target",
        type: "Vec2 | ((clock: number) => Vec2) | null",
        default: "null",
        description:
          "Where the tool tip should be. A function of elapsed seconds scripts a path.",
      },
      {
        name: "angles",
        type: "number[]",
        description:
          "Drive it forward instead: one degree value per joint. Overrides target and behavior.",
      },
      {
        name: "behavior",
        type: `"pointer" | "orbit" | "sweep" | "idle" | "static"`,
        default: `"idle"`,
        description: "What moves the tip when no target is given.",
      },
      {
        name: "bend",
        type: `"up" | "down"`,
        default: `"up"`,
        description: "Which way the elbow breaks.",
      },
      {
        name: "tool",
        type: `"gripper" | "welder" | "painter" | "cutter" | "scanner" | "vacuum" | "magnet" | "none"`,
        default: `"gripper"`,
        description: "End effector.",
      },
      {
        name: "grip",
        type: "number",
        description: "Jaw opening, 0 closed to 1 wide. Defaults to reacting to `active`.",
      },
      {
        name: "active",
        type: "boolean",
        description:
          "Tool running — sparks, spray, a spinning blade. Defaults to whether the tip is moving.",
      },
      {
        name: "mount",
        type: `"floor" | "ceiling" | "wall-left" | "wall-right"`,
        default: `"floor"`,
        description: "Where the machine is bolted down.",
      },
      ...form,
      ...motion,
      { name: "label", type: "string", description: "Stencilled onto the base plate." },
      {
        name: "showEnvelope",
        type: "boolean",
        default: "false",
        description: "Dashed arcs for the inner and outer limits of the workspace.",
      },
      {
        name: "showAngles",
        type: "boolean",
        description: "Joint readouts. On by default in the blueprint variant.",
      },
      {
        name: "showBase / showCable / showGrid",
        type: "boolean",
        description: "Turn individual parts of the drawing off.",
      },
      {
        name: "onPose",
        type: "(pose: RobotArmPose) => void",
        description: "Every solved pose: joints, tip, angles, and whether it is moving.",
      },
      ...palette,
    ],
  },
  {
    slug: "robot-arm-3d",
    item: "robot-arm-3d",
    title: "Robot arm 3D",
    summary:
      "The same arm as a procedural react-three-fiber rig — no model to load, and the same target puts the tip in the same place as the SVG one.",
    group: "Arms",
    files: ["components/ui/robot-arm-3d.tsx"],
    usage: `import { RobotArm3D } from "@/components/ui/robot-arm-3d"
import { RobotStage } from "@/components/ui/robot-stage"

export function Cell() {
  return (
    <RobotStage floor="grid" className="h-96">
      <RobotArm3D behavior="orbit" tool="welder" links={[1, 0.82, 0.34]} />
    </RobotStage>
  )
}`,
    props: [
      {
        name: "links",
        type: "number[]",
        default: "[1, 0.82, 0.34]",
        description: "Relative link lengths, scaled to fill reach.",
      },
      {
        name: "reach",
        type: "number",
        default: "2.4",
        description: "Total stretch in three.js world units.",
      },
      {
        name: "target",
        type: "Vec3 | ((clock: number) => Vec3) | null",
        default: "null",
        description: "Controlled tip position, or a scripted path.",
      },
      {
        name: "behavior",
        type: `"pointer" | "orbit" | "sweep" | "idle" | "static"`,
        default: `"idle"`,
        description: "Pointer maps the cursor onto a plane in front of the arm.",
      },
      { name: "tool", type: "RobotTool", default: `"gripper"`, description: "End effector." },
      {
        name: "wireframe",
        type: "boolean",
        default: "false",
        description: "Render the rig as wireframe.",
      },
      {
        name: "position / rotation / scale",
        type: "[number, number, number] | number",
        description: "Placed like any other three.js object.",
      },
      {
        name: "onPose",
        type: "(joints: Vec3[]) => void",
        description: "Called every frame outside React state, for readouts.",
      },
      ...motion,
      ...palette,
    ],
    notes: [
      "Colours resolve through `robot-color`, so CSS variables and oklch() reach three.js, and a dark-mode toggle retints the rig without a remount.",
    ],
  },
  {
    slug: "robot-stage",
    item: "robot-stage",
    title: "Robot stage",
    summary:
      "The room the 3D robots stand in: lights, a contact shadow, an optional grid floor, and orbit controls.",
    group: "Arms",
    files: ["components/ui/robot-stage.tsx"],
    usage: `<RobotStage camera={[3.6, 2.6, 4.6]} floor="grid" autoRotate>
  <RobotArm3D behavior="sweep" />
</RobotStage>`,
    props: [
      {
        name: "camera",
        type: "[number, number, number]",
        default: "[3.6, 2.6, 4.6]",
        description: "Camera position. The default frames a 2.5-unit machine.",
      },
      { name: "fov", type: "number", default: "40", description: "Field of view." },
      {
        name: "controls",
        type: "boolean",
        default: "true",
        description: "Drag to orbit. Off makes the stage a static illustration.",
      },
      { name: "autoRotate", type: "boolean", default: "false", description: "Turn slowly." },
      {
        name: "floor",
        type: `"grid" | "shadow" | "none"`,
        default: `"shadow"`,
        description: "Floor treatment under the machine.",
      },
      {
        name: "canvasProps",
        type: "Partial<CanvasProps>",
        description: "Anything else the react-three-fiber canvas takes.",
      },
    ],
  },
  {
    slug: "scara-arm",
    item: "scara-arm",
    title: "SCARA arm",
    summary:
      "A SCARA cell from directly above: two rotary links, a Z spindle, and the swept area you actually plan a line around.",
    group: "Machines",
    files: ["components/ui/scara-arm.tsx"],
    usage: `<ScaraArm behavior="orbit" z={0.6} tool="vacuum" showEnvelope />`,
    props: [
      {
        name: "links",
        type: "number[]",
        default: "[1, 0.85]",
        description: "Relative lengths of the two rotary links.",
      },
      { name: "reach", type: "number", default: "46", description: "Total stretch." },
      {
        name: "z",
        type: "number",
        default: "0.35",
        description: "Spindle extension, 0 retracted to 1 fully down.",
      },
      {
        name: "target",
        type: "Vec2 | ((clock: number) => Vec2) | null",
        description: "Controlled tip position in the plane.",
      },
      {
        name: "behavior",
        type: `"pointer" | "orbit" | "sweep" | "idle" | "static"`,
        default: `"orbit"`,
        description: "What drives the tip.",
      },
      {
        name: "showShadow",
        type: "boolean",
        default: "true",
        description: "Offset silhouette on the table — how the Z height reads.",
      },
      {
        name: "showEnvelope",
        type: "boolean",
        default: "true",
        description: "Dashed annulus for the swept area.",
      },
      ...form,
      ...motion,
      ...palette,
    ],
  },
  {
    slug: "delta-arm",
    item: "delta-arm",
    title: "Delta arm",
    summary:
      "A parallel delta in isometric, solved with the closed-form delta IK. Change the geometry and the arms behave the way that machine would.",
    group: "Machines",
    files: ["components/ui/delta-arm.tsx"],
    usage: `<DeltaArm
  geometry={{ base: 62, platform: 18, upper: 17, lower: 58 }}
  behavior="orbit"
  spin={32}
  tilt={0.45}
/>`,
    props: [
      {
        name: "geometry",
        type: "Partial<DeltaGeometry>",
        default: "{ base: 62, platform: 18, upper: 17, lower: 58 }",
        description:
          "Triangle sides and arm lengths. Short biceps keep the elbows inside the plate.",
      },
      {
        name: "target",
        type: "Vec3 | ((clock: number) => Vec3) | null",
        description:
          "Platform position: x and z across the workspace, y below the plate (negative).",
      },
      {
        name: "height",
        type: "number",
        description: "Height the platform holds when a behaviour drives it.",
      },
      {
        name: "spin / tilt",
        type: "number",
        default: "32 / 0.45",
        description: "Viewing angle: rotation about the vertical, then how far the view tips.",
      },
      {
        name: "showTarget",
        type: "boolean",
        description:
          "Platform readout, and a warning when a target falls outside the workspace.",
      },
      ...form,
      ...motion,
      ...palette,
    ],
  },
  {
    slug: "gantry-arm",
    item: "gantry-arm",
    title: "Gantry arm",
    summary:
      "A cartesian gantry. The axes are independent, so the head takes the dog-leg path a real machine takes rather than an arc.",
    group: "Machines",
    files: ["components/ui/gantry-arm.tsx"],
    usage: `<GantryArm behavior="sweep" trail tool="painter" />`,
    props: [
      {
        name: "target",
        type: "Vec2 | ((clock: number) => Vec2) | null",
        description: "Head position. x runs ±52, y from the bed up to about 76.",
      },
      {
        name: "behavior",
        type: `"pointer" | "orbit" | "sweep" | "idle" | "static"`,
        default: `"sweep"`,
        description: "Sweep rasters the long axis and steps the short one.",
      },
      {
        name: "trail",
        type: "boolean",
        default: "false",
        description: "Draw where the head has been — turns the gantry into a plotter.",
      },
      {
        name: "trailLength",
        type: "number",
        default: "90",
        description: "How many trail points to keep.",
      },
      {
        name: "showBed / showRulers",
        type: "boolean",
        description: "The bed, and the dimension lines. Rulers default on in blueprint.",
      },
      ...form,
      ...motion,
      ...palette,
    ],
  },
  {
    slug: "robot-face",
    item: "robot-face",
    title: "Robot face",
    summary:
      "A head whose eyes follow the pointer anywhere on the page, with moods for the states a product actually has.",
    group: "Robots",
    files: ["components/ui/robot-face.tsx"],
    usage: `<RobotFace mood="curious" size="lg" label="RC-01" />`,
    props: [
      {
        name: "mood",
        type: `"idle" | "happy" | "curious" | "focused" | "error" | "sleeping"`,
        default: `"idle"`,
        description: "Eyes and mouth together.",
      },
      {
        name: "track",
        type: "boolean",
        default: "true",
        description: "Follow the pointer anywhere on the page.",
      },
      {
        name: "look",
        type: "Vec2 | null",
        description: "Look here instead, in -1..1 on both axes.",
      },
      { name: "blink", type: "boolean", default: "true", description: "Occasional blink." },
      {
        name: "showAntenna",
        type: "boolean",
        default: "true",
        description: "The antenna and its status lamp.",
      },
      ...form.slice(0, 2),
      ...palette,
    ],
  },
  {
    slug: "robot-loader",
    item: "robot-loader",
    title: "Robot loader",
    summary:
      "A pick-and-place cycle as a loading indicator. Indeterminate on its own; give it a value and the out-tray fills in proportion.",
    group: "Robots",
    files: ["components/ui/robot-loader.tsx"],
    usage: `<RobotLoader label="Deploying" />
<RobotLoader value={62} capacity={5} />`,
    props: [
      {
        name: "cycle",
        type: "number",
        default: "2.6",
        description: "Seconds per pick-and-place cycle.",
      },
      {
        name: "value",
        type: "number",
        description: "0–100 fills the out-tray in proportion. Omit for indeterminate.",
      },
      {
        name: "capacity",
        type: "number",
        default: "4",
        description: "Parts in a full tray.",
      },
      { name: "label", type: "string", description: "Caption under the cell." },
      ...form.slice(0, 2),
      ...palette,
    ],
    notes: [
      "Sets `aria-busy` and an `aria-label` that carries the percentage, so it announces as a progress indicator.",
    ],
  },
  {
    slug: "arm-controls",
    item: "arm-controls",
    title: "Arm controls",
    summary:
      "A teach pendant: one slider per joint, driving an arm in forward kinematics. Pass the same angles array to the arm.",
    group: "Robots",
    files: ["components/ui/arm-controls.tsx"],
    usage: `const [angles, setAngles] = React.useState([62, -70, -28])

<RobotArm angles={angles} showAngles />
<ArmControls
  angles={angles}
  onAnglesChange={setAngles}
  onReset={() => setAngles([62, -70, -28])}
/>`,
    props: [
      {
        name: "angles",
        type: "number[]",
        description: "One angle per joint, in degrees, relative to the previous segment.",
      },
      {
        name: "onAnglesChange",
        type: "(angles: number[]) => void",
        description: "Called on every slider move.",
      },
      {
        name: "limits",
        type: "[number, number] | [number, number][]",
        default: "[-180, 180]",
        description: "One range for every joint, or a range each.",
      },
      { name: "labels", type: "string[]", description: "Joint names. Defaults to J1, J2, …" },
      {
        name: "tool / onToolChange / tools",
        type: "RobotTool",
        description: "Shows the end-effector selector when a change handler is given.",
      },
      {
        name: "readouts",
        type: "{ label: string; value: ReactNode }[]",
        description: "Extra values under the sliders, e.g. the tip position.",
      },
      { name: "onReset", type: "() => void", description: "Shows a Home button." },
    ],
  },
  {
    slug: "robot-kinematics",
    item: "robot-kinematics",
    title: "Robot kinematics",
    summary:
      "The maths every component shares. No React, no three.js, no dependencies — import it on its own if you only want the solver.",
    group: "Foundations",
    files: ["lib/robocn/kinematics.ts"],
    usage: `import { solveChain2, chainAngles2 } from "@/lib/robocn/kinematics"

const joints = solveChain2({ x: 0, y: 0 }, { x: 40, y: 25 }, [30, 24, 16])
const angles = chainAngles2(joints)`,
    api: [
      {
        name: "solveChain2 / solveChain3",
        type: "(root, target, links, options?) => Vec[]",
        description:
          "Joint positions from shoulder to tip. Two links solve analytically; longer chains run FABRIK, seeded with the previous pose for temporal coherence.",
      },
      {
        name: "solveElbow2 / solveElbow3",
        type: "(root, target, upper, fore, bend?) => Vec",
        description: "Law-of-cosines elbow, with a chosen side.",
      },
      {
        name: "solveDelta",
        type: "(target, geometry) => DeltaPose",
        description:
          "Closed-form delta IK: anchors, elbows, platform corners and motor angles, plus whether the target was reachable.",
      },
      {
        name: "forwardChain2 / chainAngles2 / chainLinks2",
        type: "…",
        description: "Forward kinematics and its inverse, for driving joints directly.",
      },
      {
        name: "chainReach / chainMinReach / clampToReach2",
        type: "…",
        description:
          "The annulus a chain can touch. Out-of-reach targets clamp onto it rather than failing.",
      },
      {
        name: "isometric / isometricDepth",
        type: "(v: Vec3, options?) => Vec2 | number",
        description: "Flatten 3D points for SVG, and sort parts front to back.",
      },
    ],
  },
  {
    slug: "robot-style",
    item: "robot-style",
    title: "Robot style",
    summary:
      "Sizes, variants, palette resolution and the capsule limb geometry — plus the CSS variables and keyframes the whole set is themed with.",
    group: "Foundations",
    files: ["lib/robocn/style.ts"],
    usage: `:root {
  --robot-shell: oklch(0.72 0.17 47);
  --robot-accent: oklch(0.72 0.15 176);
}`,
    api: [
      {
        name: "resolveRobotPalette",
        type: "(props) => RobotPalette",
        description:
          "Prop, then CSS variable, then built-in default, for each of shell, metal, dark, accent, glow, grid and foreground.",
      },
      {
        name: "robotSurface",
        type: "(role, variant, palette, weight?) => RobotSurface",
        description: "Fill, stroke and weight for one part, under one paint variant.",
      },
      {
        name: "capsulePath",
        type: "(a, b, radius) => string",
        description: "The limb silhouette every machine in the set is drawn from.",
      },
      {
        name: "mountTransform / labelTransform",
        type: "(mount, …) => string",
        description:
          "Puts the drawing in robot coordinates for a given mount, and turns labels back the right way up.",
      },
      {
        name: "px",
        type: "(value: number) => number",
        description:
          "Rounds a coordinate before it reaches the DOM. Trigonometry differs in the last bits between Node and the browser, and unrounded values show up as hydration mismatches.",
      },
    ],
  },
  {
    slug: "robot-color",
    item: "robot-color",
    title: "Robot color",
    summary:
      "CSS variables and oklch() turned into something three.js can parse, so the WebGL robots share one theme with the SVG ones.",
    group: "Foundations",
    files: ["lib/robocn/color.ts"],
    api: [
      {
        name: "resolveCssColor",
        type: "(value, fallback?, context?) => string",
        description:
          "Resolves var() against the document and converts oklch to hex. Returns the fallback while server-rendering.",
      },
      {
        name: "oklchToHex",
        type: "(input: string) => string | null",
        description: "oklch() and oklab() to #rrggbb, in code rather than through the DOM.",
      },
    ],
  },
  {
    slug: "use-robot-arm",
    item: "use-robot-arm",
    title: "useRobotArm",
    summary:
      "Animated pose for a link chain. It eases the tip toward its goal, solves seeded with the previous frame, and stops the loop once the pose settles.",
    group: "Foundations",
    files: ["hooks/use-robot-arm.ts"],
    usage: `const pose = useRobotArm({
  links: [30, 24, 16],
  target: (clock) => ({ x: Math.cos(clock) * 30, y: 30 }),
  behavior: "idle",
})

pose.joints // Vec2[], shoulder to tip
pose.angles // degrees, relative to the previous segment`,
    api: [
      {
        name: "useRobotArm",
        type: "(options) => RobotArmPose",
        description: "joints, tip, angles and whether the tip is still chasing its goal.",
      },
      {
        name: "useEasedPoint",
        type: "(target, start, options?) => EasedPoint",
        description:
          "The easing half on its own, for machines with no chain to solve. Returns the point, the clock and whether it is moving.",
      },
      {
        name: "robotRestTarget",
        type: "(root, links) => Vec2",
        description: "Where an arm parks when it has nothing to chase.",
      },
    ],
  },
  {
    slug: "use-pointer-target",
    item: "use-pointer-target",
    title: "usePointerTarget",
    summary:
      "Pointer position in a component's own world units. Returns null when the pointer is away, so a machine can fall back to its idle behaviour.",
    group: "Foundations",
    files: ["hooks/use-pointer-target.ts"],
    usage: `const pointer = usePointerTarget<SVGSVGElement>({
  within: "window",
  toWorld: (unit) => ({ x: unit.x * 132 - 66, y: 104 - unit.y * 118 }),
})

<svg ref={pointer.ref}>…</svg>`,
    api: [
      {
        name: "toWorld",
        type: "(unit: Vec2, rect: DOMRect) => Vec2",
        description:
          "Maps 0..1 inside the element's box into your units. Values run outside 0..1 once the pointer leaves.",
      },
      {
        name: "within",
        type: `"element" | "window"`,
        description: "Track only over the element, or anywhere on the page.",
      },
      {
        name: "persist",
        type: "boolean",
        description: "Hold the last position after the pointer leaves.",
      },
    ],
  },
]

export const docBySlug = (slug: string) => docs.find((entry) => entry.slug === slug)

export const docGroups: DocGroup[] = ["Arms", "Machines", "Robots", "Foundations"]
