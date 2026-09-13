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
      "Off snaps to a fixed goal or samples a scripted path at phase, then stops. Reduced-motion preference does the same.",
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
    slug: "robot-quadruped", item: "robot-quadruped", title: "Robot quadruped", group: "Robots",
    summary: "A four-legged robot with solved hip, knee, and foot positions. Scrub a walking or trotting cycle, change the stance, and inspect which feet touch the ground.",
    files: ["components/ui/robot-quadruped.tsx"],
    usage: `import { RobotQuadruped } from "@/components/ui/robot-quadruped"

<RobotQuadruped gait="trot" phase={0.65} height={0.5} stride={0.8} showContacts />`,
    props: [
      { name: "gait", type: '"stand" | "walk" | "trot"', default: '"stand"', description: "Standing pose, staggered single-foot swings, or diagonal-pair swings." },
      { name: "phase", type: "number", default: "0", description: "Controlled cycle fraction. Wraps in both directions; ignored when standing. Non-finite values use zero." },
      { name: "height", type: "number", default: "0.5", description: "Normalized stance height, clamped to 0–1 (36–54 world units at the hips). Non-finite values use 0.5." },
      { name: "stride", type: "number", default: "0.6", description: "Normalized fore/aft foot travel, clamped to 0–1. Zero steps in place. Non-finite values use 0.6." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized foot clearance, clamped to 0–1. Zero slides feet along the ground. Non-finite values use 0.5." },
      { name: "showGround", type: "boolean", default: "true", description: "Ground reference plane; blueprint adds its grid." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark solved feet that touch the ground plane." },
      { name: "label", type: "string", description: "Caption underneath the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Phase is controlled and updates immediately; there is no internal animation loop. Connect a timeline or telemetry to animate it, and honor reduced-motion preferences in that driving code.", "All four legs solve two-link inverse kinematics in parallel planes. The illustration preserves link lengths but does not simulate balance, forces, or terrain."],
  },
  {
    slug: "quadruped-kinematics", item: "quadruped-kinematics", title: "Quadruped kinematics", group: "Foundations",
    summary: "The dependency-free pose solver behind the quadruped. Four legs, three footfall patterns, and bounded controls that keep every foot reachable.",
    files: ["lib/robocn/quadruped.ts"],
    usage: `import { solveQuadruped } from "@/lib/robocn/quadruped"

const pose = solveQuadruped({ gait: "walk", phase: 0.4, height: 0.6 })
pose.legs // id, side, hip, knee, foot, contact
pose.height // hip height in world units`,
    api: [
      { name: "solveQuadruped", type: "(options?: QuadrupedOptions) => QuadrupedPose", description: "Solves hip/knee/foot coordinates for front-left, front-right, rear-left, and rear-right, in that order." },
      { name: "QuadrupedOptions", type: "{ gait?, phase?, height?, stride?, lift? }", description: "Same gait and normalized stance controls as RobotQuadruped. Defaults to a neutral standing pose." },
      { name: "QuadrupedLeg", type: "{ id, side, hip: Vec2, knee: Vec2, foot: Vec2, contact }", description: "Coordinates in a sagittal plane: x points forward and y up. Upper links are 30 units, lower links 28. Contact means foot y is within 1e-7 of zero." },
    ],
    notes: ["The solver has no React or three.js dependency and does not mutate its inputs. Each side can be projected independently for an SVG or 3D renderer.", "These are illustrative gait trajectories, not a stability or dynamics model. Walk staggers quarter-cycle swings; trot pairs opposite corners."],
  },
  {
    slug: "linear-actuator", item: "linear-actuator", title: "Linear actuator", group: "Machines",
    summary: "A linear cylinder with a moving piston and rod. Reveal its internals in cutaway view, or use the complete housing in a production-cell illustration.",
    files: ["components/ui/linear-actuator.tsx"],
    usage: `import { LinearActuator } from "@/components/ui/linear-actuator"

<LinearActuator extension={0.75} cutaway size="lg" />`,
    props: [
      { name: "extension", type: "number", default: "0.5", description: "Controlled stroke, clamped to 0–1. Zero retracts and one fully extends; non-finite values retract." },
      { name: "cutaway", type: "boolean", default: "false", description: "Make the cylinder wall translucent and reveal the piston." },
      { name: "showRuler", type: "boolean", default: "true", description: "Stroke scale and percentage under the rod." },
      { name: "label", type: "string", description: "Caption under the assembly." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Extension updates immediately without an internal timer. The piston and rod move together through a fixed illustrative stroke; the component does not simulate fluid pressure or force.", "The scale is a percentage of the drawing's stroke, not a measurement in physical units."],
  },
  {
    slug: "servo-motor", item: "servo-motor", title: "Servo motor", group: "Machines",
    summary: "A positional servo with mounting tabs, a cable, and interchangeable single, double, or cross horns. Drive the shaft angle from application state.",
    files: ["components/ui/servo-motor.tsx"],
    usage: `import { ServoMotor } from "@/components/ui/servo-motor"

<ServoMotor angle={45} horn="cross" variant="blueprint" />`,
    props: [
      { name: "angle", type: "number", default: "0", description: "Clockwise horn angle in degrees, clamped to −180..180. Zero points up. Non-finite values use zero." },
      { name: "horn", type: '"single" | "double" | "cross"', default: '"double"', description: "One, two, or four attachment arms. The first arm carries the direction mark." },
      { name: "showCable", type: "boolean", default: "true", description: "Draw the three-wire cable and connector." },
      { name: "showScale", type: "boolean", default: "true", description: "Circular reference scale around the shaft." },
      { name: "label", type: "string", description: "Caption under the motor." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Angle updates immediately without an internal timer. Supply values from your controls or timeline to animate the horn.", "The drawing's travel limits are illustrative and do not specify the limits of a particular physical servo."],
  },
  {
    slug: "rotary-table", item: "rotary-table", title: "Rotary table", group: "Machines",
    summary: "A rotary indexing table in plan view. Fixtures and workpieces rotate with the platter while the base, motor, and index pointer stay fixed.",
    files: ["components/ui/rotary-table.tsx"],
    usage: `import { RotaryTable } from "@/components/ui/rotary-table"

<RotaryTable angle={60} stations={6} loaded variant="blueprint" />`,
    props: [
      { name: "angle", type: "number", default: "0", description: "Controlled clockwise platter angle in degrees. Wraps after each turn; non-finite values use zero." },
      { name: "stations", type: "number", default: "6", description: "Equally spaced fixtures, rounded and clamped to 0–12. Non-finite values use six; zero gives a bare platter." },
      { name: "loaded", type: "boolean", default: "true", description: "Show a workpiece in every fixture." },
      { name: "showTicks", type: "boolean", default: "true", description: "Draw the graduated angle marks on the rotating platter." },
      { name: "label", type: "string", description: "Caption below the stationary angle readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The platter angle updates immediately without an internal timer. Drive it from your simulation or index it by setting angle to stationIndex * 360 / stations when stations is greater than zero.", "Zero degrees aligns the first fixture to the fixed pointer at the top. The remaining fixtures are equally spaced clockwise."],
  },
  {
    slug: "robot-rover", item: "robot-rover", title: "Robot rover", group: "Robots",
    summary: "A ground robot in plan view. Choose four or six wheels, steer the front axle, and drive its heading and tread travel from your application.",
    files: ["components/ui/robot-rover.tsx"],
    usage: `import { RobotRover } from "@/components/ui/robot-rover"

<RobotRover wheels={6} heading={25} steering={15} wheelTravel={0.4} active />`,
    props: [
      { name: "wheels", type: "4 | 6", default: "4", description: "Two or three axles. Only the front axle steers." },
      { name: "heading", type: "number", default: "0", description: "Clockwise degrees from the top. Wraps after each turn; non-finite values use zero." },
      { name: "steering", type: "number", default: "0", description: "Front-wheel angle, clamped to −45..45 degrees. Non-finite values use zero." },
      { name: "wheelTravel", type: "number", default: "0", description: "Controlled tread phase. Whole turns repeat; decrease to reverse. Non-finite values use zero." },
      { name: "showSensor", type: "boolean", default: "true", description: "Draw the roof-mounted sensor turret." },
      { name: "active", type: "boolean", default: "false", description: "Illuminate the front status lights." },
      { name: "label", type: "string", description: "Caption underneath the rover, independent of heading." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["All positions are controlled and update immediately. The component has no timer; connect your own timeline or telemetry for motion.", "This is a pose illustration, not a vehicle dynamics solver. Steering rotates the front wheels equally and does not integrate a driving path."],
  },
  {
    slug: "robot-drone", item: "robot-drone", title: "Robot drone", group: "Robots",
    summary: "A multirotor aircraft in plan view, with four or six motors, counter-rotating propellers, a camera, and removable guards.",
    files: ["components/ui/robot-drone.tsx"],
    usage: `import { RobotDrone } from "@/components/ui/robot-drone"

<RobotDrone rotors={6} heading={30} rotorAngle={45} guards active />`,
    props: [
      { name: "rotors", type: "4 | 6", default: "4", description: "Quadcopter or hexacopter geometry." },
      { name: "heading", type: "number", default: "0", description: "Clockwise degrees from the top, wrapping after each turn." },
      { name: "rotorAngle", type: "number", default: "0", description: "Controlled blade angle in degrees. Adjacent propellers rotate in opposite directions." },
      { name: "guards", type: "boolean", default: "true", description: "Protective rings and struts around each rotor." },
      { name: "active", type: "boolean", default: "false", description: "Illuminate the fuselage status lamp." },
      { name: "label", type: "string", description: "Caption underneath the aircraft, independent of heading." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Heading and rotor angle update immediately without an internal animation loop. Non-finite angles use zero. Active changes the lamp; supply changing rotorAngle values to animate the blades.", "The component illustrates a pose; it does not calculate lift or simulate flight."],
  },
  {
    slug: "lidar-scan", item: "lidar-scan", title: "Lidar scan", group: "Robots",
    summary: "A polar range display for real or simulated lidar samples. Returns stay in sensor coordinates and rotate with its heading.",
    files: ["components/ui/lidar-scan.tsx"],
    usage: `import { LidarScan } from "@/components/ui/lidar-scan"

<LidarScan
  samples={[{ angle: 0, distance: 5 }, { angle: 90, distance: 8 }]}
  maxRange={10}
  heading={20}
  scanAngle={60}
  showRays
/>`,
    props: [
      { name: "samples", type: "readonly LidarSample[]", default: "[]", description: "Angle-distance pairs. Angles run clockwise from sensor-forward; distance uses the same units as maxRange." },
      { name: "maxRange", type: "number", default: "10", description: "Distance represented by the outer ring. Non-finite or nonpositive values use 10." },
      { name: "heading", type: "number", default: "0", description: "Clockwise sensor heading in degrees. Rotates samples and scan ray together; non-finite values use zero." },
      { name: "scanAngle", type: "number", description: "Scan-ray angle relative to sensor-forward. Omit or supply a non-finite value to hide the ray." },
      { name: "showRays", type: "boolean", default: "false", description: "Draw a line from the sensor to each valid return." },
      { name: "showRings", type: "boolean", default: "true", description: "Quarter-range rings and crosshairs." },
      { name: "label", type: "string", description: "Bottom caption; defaults to the maximum range." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The component does not generate samples. The demo supplies a deterministic room outline and obstacle, clearly labelled as sample data.", "Negative, non-finite, and beyond-range distances are omitted. Non-finite angles are omitted. Zero-distance returns are valid and plot at the origin.", "Changing scanAngle only moves the ray; it does not filter or age returns. Supply a new samples array when fresh sensor data arrives."],
  },
  {
    slug: "robot-gripper", item: "robot-gripper", title: "Robot gripper",
    summary: "A standalone end effector with parallel or angular fingers. Drive the jaws from application state to build a fixture, tool selector, or work-cell simulation.",
    group: "Machines", files: ["components/ui/robot-gripper.tsx"],
    usage: `import { RobotGripper } from "@/components/ui/robot-gripper"

<RobotGripper opening={0.65} fingers="parallel" active size="lg" />`,
    props: [
      { name: "opening", type: "number", default: "0.6", description: "Controlled jaw opening, clamped to 0–1. Non-finite values close the jaws." },
      { name: "fingers", type: '"parallel" | "angular"', default: '"parallel"', description: "Straight fingers or inward-reaching angled fingers. Both close at the centre." },
      { name: "active", type: "boolean", default: "false", description: "Pulses the status lamp, respecting reduced motion." },
      { name: "holding", type: "boolean", default: "false", description: "Draws a workpiece between the jaws." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Opening updates immediately. There is no internal animation loop: drive it from your own timeline, telemetry, or slider. This also keeps static and reduced-motion views still.", "The drawing exposes an accessible name with its opening percentage. Override aria-label for application-specific context."],
  },
  {
    slug: "conveyor-belt", item: "conveyor-belt", title: "Conveyor belt",
    summary: "A production-line conveyor with rollers and workpieces. Runs automatically or follows a controlled travel value, wrapping in either direction.",
    group: "Machines", files: ["components/ui/conveyor-belt.tsx"],
    usage: `import { ConveyorBelt } from "@/components/ui/conveyor-belt"

<ConveyorBelt position={0.25} parts={4} direction="right" size="lg" />`,
    props: [
      { name: "position", type: "number", description: "Controlled belt travel in revolutions. Wraps at every integer. Omit to run automatically; non-finite values park at zero." },
      { name: "parts", type: "number", default: "3", description: "Evenly spaced workpieces, rounded and clamped to 0–12. Zero gives an empty belt; non-finite values use three." },
      { name: "direction", type: '"left" | "right"', default: '"right"', description: "Direction of travel, including controlled travel." },
      { name: "speed", type: "number", default: "0.12", description: "Turns per second when uncontrolled. Zero or non-finite values park the belt; negative values reverse travel." },
      { name: "animate", type: "boolean", default: "true", description: "Enables automatic travel. Reduced-motion preference also disables it." },
      { name: "label", type: "string", description: "Caption underneath the conveyor." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["A supplied position updates immediately and disables the internal animation loop. The travel slider in the demo shows this controlled mode.", "Omit position for automatic motion, or set animate={false} for a still illustration. The animation loop is cleaned up on unmount."],
  },
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
          "The easing half on its own, for machines with no chain to solve. Returns point, clock and moving. Set perAxis: true to move each axis independently at the configured feed rate.",
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
