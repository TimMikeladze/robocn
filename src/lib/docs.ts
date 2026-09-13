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

/**
 * The three switches every self-running machine shares. `speed` is named per
 * component, since a cycle means something different on each of them.
 */
/** The gait machines name their offset `offset`, since `phase` is their cycle. */
const gaitLoop = (): PropRow[] => loop.filter((row) => row.name !== "phase")

/**
 * The camera axis, which every machine with a body in space carries. The
 * default is always the view that machine is drawn in, so adding it changed
 * nothing for anyone already using one — docs/views-backfill.md.
 */
const view = (native: "plan" | "front" | "profile" | "iso", subject: string): PropRow => ({
  name: "view",
  type: `"plan" | "front" | "profile" | "iso"`,
  default: `"${native}"`,
  description: `Where the camera stands. One ${subject}, four projections: straight down, straight on, side elevation, or three-quarter from above.`,
})

const loop: PropRow[] = [
  {
    name: "animate",
    type: "boolean",
    default: "true",
    description:
      "Off parks the machine at phase and stops rendering. A reduced-motion preference does the same.",
  },
  { name: "paused", type: "boolean", default: "false", description: "Freeze where it stands." },
  {
    name: "phase",
    type: "number",
    default: "0",
    description: "Seconds of offset, so a row of machines breaks step.",
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

const droidForm: PropRow[] = [
  ...form.slice(0, 2),
  { name: "showGround", type: "boolean", default: "true", description: "Draw the contact line or shadow beneath the droid." },
  { name: "signal", type: '"idle" | "ready" | "warning"', description: "Status-lamp state using neutral, accent, or shell colour; each component documents its visual default in the demo." },
  { name: "label", type: "string", description: "Optional technical caption under the drawing." },
  ...palette,
]

export const docs: DocEntry[] = [
  {
    slug: "utility-droid", item: "utility-droid", title: "Utility droid", group: "Robots",
    summary: "A compact cylindrical utility unit with interchangeable domes, two chassis layouts, rotating optics, and deployable service tools.",
    files: ["components/ui/utility-droid.tsx"],
    usage: `import { UtilityDroid } from "@/components/ui/utility-droid"

<UtilityDroid series="navigator" dome="faceted" legMode="three" headAngle={32} tool="scanner" toolExtension={0.8} />`,
    props: [
      view("front", "droid"),
      { name: "series", type: '"workshop" | "navigator" | "rescue"', default: '"workshop"', description: "Changes the functional front-panel module." },
      { name: "dome", type: '"round" | "flat" | "faceted"', default: '"faceted"', description: "Selects the upper sensor-shell silhouette." },
      { name: "legMode", type: '"two" | "three"', default: '"three"', description: "Uses two side legs or adds a central stabilizer." },
      { name: "headAngle", type: "number", description: "Sensor heading in degrees, clamped to −150..150. Omit and the dome turns itself — to the pointer, or with the behaviour." },
      { name: "tool", type: '"none" | "interface" | "gripper" | "scanner"', default: '"interface"', description: "Deployable side-mounted service tool." },
      { name: "toolExtension", type: "number", description: "Tool travel normalized to 0–1. Omit and the behaviour runs the tool out and stows it." },
      { name: "behavior", type: '"work" | "scan" | "idle" | "static"', default: '"work"', description: "Work turns to the bench, runs the tool out, holds it there and stows it; scan sweeps the dome; idle drifts." },
      { name: "speed", type: "number", default: "0.22", description: "Work cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The dome is the droid's attention: it turns to the pointer while it is over the drawing, and goes back to work when it leaves." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. The barrel is round in plan and the legs are set round it rather than side by side, which is the thing one elevation could not say.", "The dome and the tool are controlled when you supply them and self-running when you do not — the usual rule. Pointer tracking beats the behaviour while the pointer is over it.", "All three series share one chassis API; the series changes panel geometry rather than character branding."],
  },
  {
    slug: "orb-droid", item: "orb-droid", title: "Orb droid", group: "Robots",
    summary: "A spherical rolling companion with a separately stabilized head, segmented drive shell, tracking optic, and antenna options.",
    files: ["components/ui/orb-droid.tsx"],
    usage: `import { OrbDroid } from "@/components/ui/orb-droid"

<OrbDroid bodyAngle={72} headAngle={-18} look={{ x: 0.5, y: -0.2 }} antenna="twin" />`,
    props: [
      view("front", "droid"),
      { name: "bodyAngle", type: "number", default: "0", description: "Controlled rotation of the segmented drive sphere in degrees." },
      { name: "headAngle", type: "number", default: "0", description: "Head steering in degrees, clamped to −65..65." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in −1..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "Follow the page pointer while look is null." },
      { name: "antenna", type: '"single" | "twin" | "none"', default: '"twin"', description: "Communications mast configuration." },
      ...droidForm,
    ],
    notes: ["A ball is the same circle from every angle, so the body needs no second drawing; the panelling on it is elevation artwork that foreshortens with the camera. The head is a dome, which only reads as one off the front.", "Body and head transforms are independent, so a rolling shell does not drag the stabilized cap around with it.", "Pointer tracking is isolated to this client component and can be disabled or overridden.", "The shell, head and optic carry data-body, data-head and data-optic hooks, so an outer animation loop can drive all three through the DOM without re-rendering the component."],
  },
  {
    slug: "protocol-droid", item: "protocol-droid", title: "Protocol droid", group: "Robots",
    summary: "A slim humanoid translator with formal and conversational stances, expressive arm gestures, and optional exposed torso wiring.",
    files: ["components/ui/protocol-droid.tsx"],
    usage: `import { ProtocolDroid } from "@/components/ui/protocol-droid"

<ProtocolDroid pose="converse" gesture="explain" headAngle={15} exposed />`,
    props: [
      view("front", "droid"),
      { name: "pose", type: '"formal" | "converse" | "cautious"', default: '"formal"', description: "Whole-body posture and leg stance." },
      { name: "gesture", type: '"none" | "explain" | "greet" | "point"', default: '"none"', description: "Controlled arm and forearm pose." },
      { name: "headAngle", type: "number", default: "0", description: "Head rotation in degrees, clamped to −55..55." },
      { name: "exposed", type: "boolean", default: "false", description: "Reveal the torso cable loom instead of the closed service panel." },
      { name: "behavior", type: '"converse" | "idle" | "static"', default: '"converse"', description: "Converse works through its gestures a beat at a time with the head turning to whoever is being addressed; idle waits politely." },
      { name: "speed", type: "number", default: "0.35", description: "Gestures per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The head turns to the pointer, and a click moves the conversation on to the next gesture." },
      { name: "onGestureChange", type: "(gesture: ProtocolDroidGesture) => void", description: "The gesture a click moved it to." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. A humanoid drawn from the front says nothing about its own depth: off that axis the torso, pelvis and head are boxes and the limbs are tubes set through the body, at the same joint angles the pose already solved.", "Each named pose is deterministic and immediately rendered; interpolate props outside the component when animation is needed.", "The form is an original translator archetype rather than a character replica."],
  },
  {
    slug: "security-droid", item: "security-droid", title: "Security droid", group: "Robots",
    summary: "A tall angular guard robot with controlled patrol postures, a pointer-tracking sensor bar, and a visible alert state.",
    files: ["components/ui/security-droid.tsx"],
    usage: `import { SecurityDroid } from "@/components/ui/security-droid"

<SecurityDroid pose="guard" alert look={{ x: -0.4, y: 0 }} headAngle={-20} />`,
    props: [
      view("front", "droid"),
      { name: "pose", type: '"stand" | "patrol" | "guard"', default: '"stand"', description: "Whole-frame stance and arm position." },
      { name: "headAngle", type: "number", default: "0", description: "Head rotation in degrees, clamped to −70..70." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled horizontal sensor aim; overrides tracking." },
      { name: "track", type: "boolean", default: "true", description: "Follow the page pointer while look is null." },
      { name: "alert", type: "boolean", default: "false", description: "Light the alert beacon and promote the sensor colour." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. A humanoid drawn from the front says nothing about its own depth: off that axis the torso, pelvis and head are boxes and the limbs are tubes set through the body, at the same joint angles the pose already solved.", "Alert is visual state only; the component does not infer threats or start a timer.", "The tracked sensor translates inside a fixed protective bar so it remains mechanically legible."],
  },
  {
    slug: "medical-droid", item: "medical-droid", title: "Medical droid", group: "Robots",
    summary: "A clinical service robot with a diagnostic meter and independently selected scanner, injector, clamp, or probe instruments.",
    files: ["components/ui/medical-droid.tsx"],
    usage: `import { MedicalDroid } from "@/components/ui/medical-droid"

<MedicalDroid leftTool="scanner" rightTool="injector" diagnostic={0.82} signal="ready" />`,
    props: [
      view("front", "droid"),
      { name: "leftTool / rightTool", type: '"none" | "scanner" | "injector" | "clamp" | "probe"', default: '"scanner" / "probe"', description: "Instrument mounted on each modular arm." },
      { name: "diagnostic", type: "number", default: "0.65", description: "Normalized 0–1 diagnostic meter fill." },
      { name: "headAngle", type: "number", default: "0", description: "Head rotation in degrees, clamped to −60..60." },
      { name: "behavior", type: '"diagnose" | "monitor" | "idle" | "static"', default: '"diagnose"', description: "Diagnose ramps the readout to a result and holds it; monitor cycles a live trace; idle waits." },
      { name: "speed", type: "number", default: "0.25", description: "Scans per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The head follows the pointer, and a click runs the scan again from the top." },
      { name: "onDiagnosticRestart", type: "() => void", description: "Fired when a click restarts the scan." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. The column is a tapered body of revolution rather than a flat panel, and the two instrument arms reach forward out of it \u2014 neither of which one elevation could say.", "Tools change the visible end geometry but do not imply medical advice or simulated treatment.", "The diagnostic value is a display input supplied by the parent application."],
  },
  {
    slug: "infantry-droid", item: "infantry-droid", title: "Infantry droid", group: "Robots",
    summary: "A mechanical field unit with skeletal and armored frames, four controlled poses, and non-projectile utility equipment.",
    files: ["components/ui/infantry-droid.tsx"],
    usage: `import { InfantryDroid } from "@/components/ui/infantry-droid"

<InfantryDroid frame="heavy" pose="guard" equipment="shield" signal="warning" />`,
    props: [
      view("front", "droid"),
      { name: "frame", type: '"light" | "heavy"', default: '"light"', description: "Skeletal scout or armored field silhouette." },
      { name: "pose", type: '"stand" | "march" | "guard" | "disabled"', default: '"stand"', description: "Controlled whole-body posture." },
      { name: "equipment", type: '"none" | "pack" | "scanner" | "shield"', default: '"none"', description: "Visible utility module carried by the frame." },
      { name: "headAngle", type: "number", default: "0", description: "Head rotation in degrees, clamped to −75..75." },
      { name: "behavior", type: '"patrol" | "alert" | "idle" | "static"', default: '"patrol"', description: "Patrol marches and looks left and right; alert stands to guard and scans in short turns; idle stands easy." },
      { name: "speed", type: "number", default: "0.2", description: "Sweeps per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The head follows the pointer, and a click puts the frame on guard — or stands it down again." },
      { name: "onPoseChange", type: "(pose: InfantryDroidPose) => void", description: "The stance a click asked for." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. A humanoid drawn from the front says nothing about its own depth: off that axis the torso, pelvis and head are boxes and the limbs are tubes set through the body, at the same joint angles the pose already solved.", "Equipment deliberately stays at utility pack, survey scanner, and protective shield silhouettes.", "Light and heavy frames share the same pose contract for easy replacement."],
  },
  {
    slug: "probe-droid", item: "probe-droid", title: "Probe droid", group: "Robots",
    summary: "A hovering survey platform with a steerable sensor mast, controlled altitude, scan cone, and configurable manipulator count.",
    files: ["components/ui/probe-droid.tsx"],
    usage: `import { ProbeDroid } from "@/components/ui/probe-droid"

<ProbeDroid hover={0.75} scanAngle={24} appendages={6} active />`,
    props: [
      view("front", "droid"),
      { name: "hover", type: "number", default: "0.5", description: "Normalized 0–1 altitude offset and matching shadow cue." },
      { name: "scanAngle", type: "number", default: "0", description: "Sensor mast angle in degrees, clamped to −65..65." },
      { name: "appendages", type: "number", default: "5", description: "Manipulator count, rounded and clamped to 3–6." },
      { name: "active", type: "boolean", default: "false", description: "Show the reduced-motion-aware scan cone." },
      { name: "behavior", type: '"hover" | "scan" | "pointer" | "static"', default: '"hover"', description: "Hover rides the repulsors up and down; scan holds its height and sweeps the sensor; pointer comes round to you." },
      { name: "speed", type: "number", default: "0.3", description: "Bob and sweep cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The sensor turns to the pointer while it is over the drawing." },
      ...droidForm,
    ],
    notes: ["The appendages are set round the pod rather than side by side \u2014 the thing one elevation could not say. Off the front they are tubes on a ring, and the pod is a body of revolution.", "Hover does not animate itself; pass telemetry or a timeline value from outside.", "Appendage tools rotate among claw, probe, and ring end shapes for a readable asymmetric silhouette."],
  },
  {
    slug: "courier-droid", item: "courier-droid", title: "Courier droid", group: "Robots",
    summary: "A compact floor-running service bot with controlled heading, front-wheel steering, tread travel, antennas, and cargo modules.",
    files: ["components/ui/courier-droid.tsx"],
    usage: `import { CourierDroid } from "@/components/ui/courier-droid"

<CourierDroid heading={28} steering={18} travel={0.4} cargo="pod" antenna="dish" />`,
    props: [
      view("plan", "droid"),
      { name: "heading", type: "number", default: "0", description: "Controlled chassis heading in degrees; values may make multiple turns." },
      { name: "steering", type: "number", default: "0", description: "Front-wheel steering in degrees, clamped to −45..45." },
      { name: "travel", type: "number", default: "0", description: "Wrapped tread phase; whole-number turns render identically." },
      { name: "cargo", type: '"none" | "pod" | "crate" | "tools"', default: '"none"', description: "Module secured to the top deck." },
      { name: "antenna", type: '"whip" | "dish" | "none"', default: '"whip"', description: "Communications hardware on the rear deck." },
      { name: "behavior", type: '"deliver" | "patrol" | "pointer" | "static"', default: '"deliver"', description: "Deliver drives straight legs and square corners; patrol runs a tighter version of it; pointer comes round to face the cursor." },
      { name: "speed", type: "number", default: "0.25", description: "Legs of the route per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "It turns to face the pointer while the pointer is over it." },
      ...droidForm,
    ],
    notes: ["Plan view is the identity projection, heading included. The four wheels become cylinders, and the body, cargo module and antenna gain their heights, as the camera comes down off the vertical.", "Heading rotates the complete chassis while steering affects only the front axle.", "Travel changes clipped tread marks without creating an internal animation loop."],
  },
  {
    slug: "casing-droid", item: "casing-droid", title: "Casing droid", group: "Robots",
    summary: "An armoured conical casing unit: hemisphere skirt, caged neck, rotating dome, an eyestalk that swings and elevates, and a swappable manipulator.",
    files: ["components/ui/casing-droid.tsx"],
    usage: `import { CasingDroid } from "@/components/ui/casing-droid"

<CasingDroid domeAngle={40} eyeElevation={-12} manipulator="clamp" emitter lamps />`,
    props: [
      view("front", "droid"),
      { name: "skirt", type: '"banded" | "smooth" | "ribbed"', default: '"banded"', description: "Lower casing treatment; the flare geometry is shared." },
      { name: "hemisphereRows", type: "number", default: "3", description: "Rows of skirt hemispheres, clamped to 2–4." },
      { name: "hemisphereColumns", type: "number", default: "4", description: "Hemispheres across each row, clamped to 3–6; the studs shrink to fit." },
      { name: "dome", type: '"round" | "flat" | "faceted"', default: '"round"', description: "Upper sensor-shell silhouette, drawn into the same envelope." },
      { name: "collar", type: '"slats" | "mesh" | "plain"', default: '"slats"', description: "Mid-section treatment between the skirt and the neck." },
      { name: "neckRings", type: "number", default: "3", description: "Rings in the neck cage, clamped to 2–5; the cage spans the same gap either way." },
      { name: "stalkLength", type: "number", default: "1", description: "Eyestalk reach as a multiple of standard, clamped to 0.5–1.8." },
      { name: "domeAngle", type: "number", default: "0", description: "Dome heading in degrees, wrapped to −180..180; swings and foreshortens the eyestalk." },
      { name: "eyeElevation", type: "number", default: "0", description: "Eyestalk pitch in degrees, clamped to −28..28." },
      { name: "manipulator", type: '"none" | "suction" | "clamp" | "probe"', default: '"suction"', description: "Tool on the left appendage." },
      { name: "emitter", type: '"none" | "rod" | "dish" | "array"', default: '"array"', description: "Hardware on the right appendage: bare rod, dish, or the ringed array." },
      { name: "lamps", type: '"none" | "pair" | "quad"', default: '"pair"', description: "Dome lamp arrangement." },
      { name: "behavior", type: '"patrol" | "survey" | "idle" | "static"', default: '"patrol"', description: "Patrol holds a bearing, swings to the next and holds again; survey sweeps the room; idle is the drift of a machine that is still switched on." },
      { name: "speed", type: "number", default: "0.18", description: "Sweeps per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The eyestalk follows the pointer — which is, after all, the entire point of this machine." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. The casing is a cone of revolution with a dome on top, and the manipulator and emitter reach forward out of the shoulders rather than sideways across the picture.", "Heading is cyclic: 360 renders identically to 0 rather than sticking at a limit.", "An original armoured-casing archetype; the emitter is a ringed rod with no projectile effect."],
  },
  {
    slug: "astromech-droid", item: "astromech-droid", title: "Astromech droid", group: "Robots",
    summary: "A barrel repair unit with tripod and bipod ride heights, a rotating dome and radar eye, an opening service panel, a rising periscope, and a holographic projection cone.",
    files: ["components/ui/astromech-droid.tsx"],
    usage: `import { AstromechDroid } from "@/components/ui/astromech-droid"

<AstromechDroid legMode="tripod" domeAngle={55} panel tool="welder" holo={0.8} lean={-6} />`,
    props: [
      view("front", "droid"),
      { name: "legMode", type: '"tripod" | "bipod"', default: '"tripod"', description: "Tripod drops the centre foot and squats; bipod retracts it and stands tall." },
      { name: "dome", type: '"round" | "flat" | "faceted"', default: '"round"', description: "Upper sensor-shell silhouette, drawn into the same envelope." },
      { name: "livery", type: '"plain" | "banded" | "paneled"', default: '"banded"', description: "How much panel detailing the body carries." },
      { name: "feet", type: '"skid" | "wheel" | "tread"', default: '"skid"', description: "Contact hardware under every foot, centre leg included." },
      { name: "antenna", type: '"none" | "whip" | "dish"', default: '"none"', description: "Communications hardware on the dome; it swings with the heading." },
      { name: "ports", type: "number", default: "2", description: "Service hatches down the body front, clamped to 1–3." },
      { name: "domeAngle", type: "number", description: "Dome heading in degrees, wrapped to −180..180. Omit and the dome turns itself — to the pointer, or with the behaviour." },
      { name: "lean", type: "number", description: "Whole-body lean in degrees, clamped to −14..14. Omit and the behaviour rocks it." },
      { name: "panel", type: "boolean", description: "Open the front service panel. Omit and the work cycle opens and closes it." },
      { name: "tool", type: '"none" | "probe" | "welder" | "periscope"', default: '"none"', description: "Instrument extended from the open panel; periscope rises from the dome instead." },
      { name: "holo", type: "number", description: "Projection strength 0–1; zero hides the cone entirely. Omit and the behaviour fades it up and down." },
      { name: "behavior", type: '"work" | "roam" | "idle" | "static"', default: '"work"', description: "Work turns to the socket, opens up and projects; roam sweeps the dome and rocks on the tripod; idle drifts." },
      { name: "speed", type: "number", default: "0.25", description: "Work cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The dome turns to the pointer while it is over the drawing, and goes back to work when it leaves." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. The barrel is a drum, the centre foot stands behind the other two rather than between them, and the dome sits on top of both \u2014 none of which is in a single view.", "Every value is controlled when you supply it and self-running when you do not; pointer tracking beats the behaviour while the pointer is over it.", "Ride height follows the chassis mode, so legMode changes the body transform as well as the feet.", "The periscope is dome-mounted and does not require the service panel to be open."],
  },
  {
    slug: "attendant-droid", item: "attendant-droid", title: "Attendant droid", group: "Robots",
    summary: "A plated humanoid attendant with a fixed faceplate and vocoder grille, four etiquette poses, and plating levels that strip the body back to its exposed loom.",
    files: ["components/ui/attendant-droid.tsx"],
    usage: `import { AttendantDroid } from "@/components/ui/attendant-droid"

<AttendantDroid pose="present" plating="partial" headAngle={18} speaking />`,
    props: [
      view("front", "droid"),
      { name: "pose", type: '"attention" | "bow" | "present" | "alarm"', description: "Etiquette posture. Omit and the behaviour works through them." },
      { name: "headAngle", type: "number", description: "Head rotation in degrees, clamped to −45..45. Omit and it turns to whoever it is addressing." },
      { name: "plating", type: '"full" | "partial" | "bare"', default: '"full"', description: "Body covering. Partial keeps the chest plate; bare exposes the torso and limb looms." },
      { name: "build", type: '"slim" | "standard" | "heavy"', default: '"standard"', description: "Frame width. Scales limbs and torso across only — every joint keeps its height, so poses are unchanged." },
      { name: "face", type: '"grille" | "visor" | "lamps"', default: '"grille"', description: "Faceplate treatment: paired optics, a full visor band, or oversized lamps." },
      { name: "hands", type: '"fingers" | "clamp" | "mitt"', default: '"fingers"', description: "End effector on each arm." },
      { name: "collar", type: "boolean", default: "true", description: "Draw the raised collar around the neck." },
      { name: "speaking", type: "boolean", description: "Light the vocoder grille. Omit and it lights while the droid is talking." },
      { name: "behavior", type: '"attend" | "fret" | "idle" | "static"', default: '"attend"', description: "Attend works the room a courtesy at a time; fret alternates alarm and apology with the head whipping about; idle waits politely." },
      { name: "speed", type: "number", default: "0.3", description: "Poses per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The head turns to the pointer, and a click takes it on to its next pose. `onPoseChange` reports either way." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. A humanoid drawn from the front says nothing about its own depth: off that axis the torso, pelvis and head are boxes and the limbs are tubes set through the body, at the same joint angles the pose already solved.", "Heavier and fully plated where the protocol droid is slim and jointed; the two share the collection prop contract.", "An original attendant archetype rather than a character replica."],
  },
  {
    slug: "cyber-trooper", item: "cyber-trooper", title: "Cyber trooper", group: "Robots",
    summary: "A converted armoured humanoid with a blank slab head, optional side handles, three chest units, a bounded power meter, and four controlled poses.",
    files: ["components/ui/cyber-trooper.tsx"],
    usage: `import { CyberTrooper } from "@/components/ui/cyber-trooper"

<CyberTrooper pose="march" chestUnit="core" power={0.45} handles headAngle={-14} />`,
    props: [
      view("front", "trooper"),
      { name: "pose", type: '"stand" | "march" | "reach" | "powerdown"', description: "Whole-body posture; powerdown slumps the frame and dims the optics. Omit and the behaviour drives it." },
      { name: "headAngle", type: "number", description: "Head rotation in degrees, clamped to −40..40. Omit and it turns to whoever it is facing." },
      { name: "chestUnit", type: '"bar" | "vent" | "core"', default: '"bar"', description: "Chest module face; core also scales with the power reserve." },
      { name: "helmet", type: '"slab" | "domed" | "crested"', default: '"slab"', description: "Head shell silhouette, drawn into the same envelope." },
      { name: "build", type: '"standard" | "heavy"', default: '"standard"', description: "Frame width. Scales limbs and torso across only — every joint keeps its height, so poses are unchanged." },
      { name: "visor", type: '"lamps" | "slit" | "bar"', default: '"lamps"', description: "Optic treatment on the faceplate; all three dim under powerdown." },
      { name: "shoulders", type: '"pauldron" | "flush"', default: '"pauldron"', description: "Capped pauldrons, or arms running flush to the torso." },
      { name: "jaw", type: "boolean", default: "true", description: "Draw the hinged jaw plate." },
      { name: "power", type: "number", description: "Power reserve 0–1 shown in a fixed meter track. Omit and marching draws it down and standing puts it back." },
      { name: "handles", type: "boolean", default: "true", description: "Draw the two side handles on the head shell." },
      { name: "behavior", type: '"march" | "advance" | "idle" | "static"', default: '"march"', description: "March steps and spends the reserve, then halts to recharge; advance marches and reaches; idle stands by on a trickle charge." },
      { name: "speed", type: "number", default: "0.4", description: "Steps per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "The head turns to the pointer, and a click cuts its power — click again to bring it back. `onPowerChange` reports both." },
      ...droidForm,
    ],
    notes: ["Front elevation is the drawing it always had. A humanoid drawn from the front says nothing about its own depth: off that axis the torso, pelvis and head are boxes and the limbs are tubes set through the body, at the same joint angles the pose already solved.", "Supply a value and it renders exactly as given; leave it out and the behaviour runs it.", "The power meter is display state, not a battery model — the parent decides what a reserve means."],
  },
  {
    slug: "micro-duck", item: "micro-duck", title: "Micro duck", group: "Robots",
    summary: "A bipedal duck robot: two solved legs on a controlled footfall cycle, a servo-stack neck that cranes and pecks, and a beak that opens.",
    files: ["components/ui/micro-duck.tsx"],
    usage: `import { MicroDuck } from "@/components/ui/micro-duck"

<MicroDuck behavior="walk" />

// Or drive the cycle yourself, the way it has always worked.
<MicroDuck gait="walk" phase={0.3} gaze={0.4} beak={0.2} showContacts />`,
    props: [
      view("profile", "duck"),
      { name: "behavior", type: '"walk" | "idle" | "peck" | "static"', default: '"idle"', description: "What it does when phase is not supplied: pace, shift its weight and look around, or work the floor." },
      { name: "gait", type: '"stand" | "walk" | "strut"', description: "Footfall pattern. Omit and the behavior picks one — walking walks, everything else stands." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions; ignored when standing." },
      { name: "speed", type: "number", default: "0.7", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a row of ducks breaks step. Phase is the gait cycle here, so the offset has its own name." },
      { name: "interactive", type: "boolean", default: "true", description: "Watch the pointer, and quack when poked: a beak snap and a head bob that decay out." },
      { name: "onQuack", type: "() => void", description: "Fired on the poke that starts a quack." },
      { name: "height", type: "number", default: "0.55", description: "Normalized pelvis height, clamped to 0–1 (24–54 world units). Zero folds the legs into a sit." },
      { name: "stride", type: "number", default: "0.6", description: "Normalized fore/aft foot travel, clamped to 0–1. Zero steps in place." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized foot clearance, clamped to 0–1. Zero slides the foot along the ground." },
      { name: "gaze", type: "number", description: "Neck aim, clamped to −1..1: −1 pecks at the floor, 1 cranes upward. Omit and it follows the pointer, or the behavior." },
      { name: "beak", type: "number", description: "Normalized beak opening, clamped to 0–1. One is a 34° gape, and the skull lifts a little with it. Omit and the behavior works it." },
      ...gaitLoop(),
      { name: "showGround", type: "boolean", default: "true", description: "Ground reference line; blueprint adds its hatching." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the foot that is carrying weight." },
      { name: "showCable", type: "boolean", default: "true", description: "The wire loom running down the back of the neck." },
      { name: "label", type: "string", description: "Caption underneath the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had, with the far leg slid sideways to fake its depth. Off that axis both legs stand either side of the pelvis, and the body, neck and head are solids.", "Supplying phase hands the cycle back to your timeline and stops the internal clock — controlled always wins. Without it the duck runs its own, parked by a reduced-motion preference.", "Legs solve two-link inverse kinematics with the knee breaking rearward, and the neck is a three-link FABRIK chain. The drawing preserves link lengths but does not model balance or ground forces.", "The far leg is drawn behind the body at reduced opacity, which is depth in the illustration rather than a second solve."],
  },
  {
    slug: "duck-kinematics", item: "duck-kinematics", title: "Duck kinematics", group: "Foundations",
    summary: "The pose solver behind the duck. Two planar legs, a footfall cycle that never lifts both feet, and a neck chain swung on a constant radius.",
    files: ["lib/robocn/duck.ts"],
    usage: `import { solveDuck } from "@/lib/robocn/duck"

const pose = solveDuck({ gait: "walk", phase: 0.3, gaze: 0.5 })
pose.legs // id, hip, knee, ankle, contact
pose.neck // four joints from shoulder to skull base
pose.head // pivot, angle, beak opening in degrees`,
    api: [
      { name: "solveDuck", type: "(options?: DuckOptions) => DuckPose", description: "Solves both legs, the neck chain, and the head from the gait and stance controls." },
      { name: "DuckOptions", type: "{ gait?, phase?, height?, stride?, lift?, gaze?, beak? }", description: "Same controls as MicroDuck. Every value is clamped, and non-finite input falls back to the default." },
      { name: "DuckLeg", type: "{ id, hip: Vec2, knee: Vec2, ankle: Vec2, contact }", description: "Sagittal coordinates: x forward, y up, ground at zero. Thigh 26 units, shank 28, ankle 9 above the ground when the foot is down." },
      { name: "duckLinks", type: "{ thigh, shank, neck }", description: "The link lengths the solver uses, exported so a renderer can size parts from them." },
    ],
    notes: ["No React and no three.js: the solver is plain functions over `{x, y}` objects and does not mutate its input.", "Walk holds 0.62 of the cycle in stance and strut 0.52, so at most one foot is ever off the ground. These are illustrative trajectories, not a balance model."],
  },
  {
    slug: "reachy-mini", item: "reachy-mini", title: "Reachy mini", group: "Robots",
    summary: "A companion robot: a head on a six-rod parallel platform, driven in six degrees of freedom, with pointer-tracking eyes and sprung antennas.",
    files: ["components/ui/reachy-mini.tsx"],
    usage: `import { ReachyMini } from "@/components/ui/reachy-mini"

<ReachyMini behavior="scan" />

// Any axis you supply is yours; the rest keep breathing.
<ReachyMini yaw={18} pitch={-8} antennaLeft={22} antennaRight={-10} />`,
    props: [
      view("iso", "robot"),
      { name: "behavior", type: '"idle" | "scan" | "nod" | "static"', default: '"idle"', description: "What the platform does with any axis you have not supplied: breathe, sweep the room, or nod." },
      { name: "sway / heave / surge", type: "number", description: "Head translation in world units: right, up, and toward the viewer. Clamped to ±10, ±8, ±10. Omit and the behavior drives it." },
      { name: "roll / pitch / yaw", type: "number", description: "Head rotation in degrees, clamped to ±24, ±24, ±30. Positive pitch tips the face down. Omit and the head turns toward the pointer instead." },
      { name: "speed", type: "number", default: "0.35", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Turn the head toward the pointer — not just the pupils — and nod once when clicked." },
      { name: "onNod", type: "() => void", description: "Fired on the click that starts a nod." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Pupil aim in −1..1 on both axes. Set it to drive the gaze; leave it null to track the pointer." },
      { name: "track", type: "boolean", default: "true", description: "Follow the pointer anywhere on the page while look is null." },
      { name: "blink", type: "boolean", default: "true", description: "Occasional blink, disabled by a reduced-motion preference." },
      { name: "antennaLeft / antennaRight", type: "number", description: "Antenna angles in degrees, clamped to ±45. Omit and they trail the head, springing back after a turn or a nod." },
      { name: "showLinkage", type: "boolean", default: "true", description: "Draw the six rods, their bearings, and the platform disc." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow under the body." },
      { name: "geometry", type: "Partial<StewartGeometry>", description: "Override ring radii, anchor spread, platform height, or actuator travel." },
      { name: "label", type: "string", description: "Caption under the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The whole robot is modelled in world units and the Stewart solve is already three-dimensional, so a view is only a change of projection. `iso` is its own axonometric; the other three are the shared orthographic cameras.", "Every frame of the idle, the scan and the nod goes through the same inverse kinematics as a pose you supply: the motion is six changing leg lengths, not a transform on the picture.", "The linkage is solved: six leg lengths from real Stewart platform inverse kinematics, projected isometrically and depth-sorted. The head shell is an illustration that takes roll from the pose and shifts its face with yaw and pitch.", "A pose that asks a leg for more than its travel lights the fault lamp and paints that rod in the accent colour. The component clamps its own inputs, so faults come from tightening geometry.travel.", "Eye tracking is pointer-driven through use-pointer-target; pass look to control it, or track={false} to hold the gaze still."],
  },
  {
    slug: "stewart-kinematics", item: "stewart-kinematics", title: "Stewart kinematics", group: "Foundations",
    summary: "Closed-form inverse kinematics for a six-legged parallel platform: give it a head pose, get six leg lengths and their stroke.",
    files: ["lib/robocn/stewart.ts"],
    usage: `import { solveStewart } from "@/lib/robocn/stewart"

const solution = solveStewart({ yaw: 20, pitch: -6, heave: 3 })
solution.legs // base, platform, length, stroke, withinLimits
solution.reachable // false when any leg runs out of travel`,
    api: [
      { name: "solveStewart", type: "(pose?: StewartPose, geometry?: StewartGeometry) => StewartSolution", description: "Rotates and translates each platform anchor, then measures back to its base anchor. One pass, no iteration." },
      { name: "StewartPose", type: "{ sway?, heave?, surge?, roll?, pitch?, yaw? }", description: "Translations in world units (x right, y up, z toward the viewer) and rotations in degrees, applied yaw, then pitch, then roll." },
      { name: "StewartLeg", type: "{ id, base: Vec3, platform: Vec3, length, stroke, withinLimits }", description: "Stroke is the change from the home length; withinLimits compares it to geometry.travel." },
      { name: "defaultStewartGeometry", type: "StewartGeometry", description: "Ring radii, anchor spread per pair, platform height, and actuator travel for a desk-scale head." },
    ],
    notes: ["Anchors sit in three pairs 120° apart on both rings and each leg crosses to the far anchor of its pair, so every leg has the same home length.", "Out-of-range poses still return complete geometry with reachable false, so a UI can draw the fault instead of handling an exception."],
  },
  {
    slug: "robot-quadruped", item: "robot-quadruped", title: "Robot quadruped", group: "Robots",
    summary: "A four-legged robot with solved hip, knee, and foot positions. Scrub a walking or trotting cycle, change the stance, and inspect which feet touch the ground.",
    files: ["components/ui/robot-quadruped.tsx"],
    usage: `import { RobotQuadruped } from "@/components/ui/robot-quadruped"

<RobotQuadruped behavior="trot" />

// Or scrub the cycle yourself.
<RobotQuadruped gait="trot" phase={0.65} height={0.5} stride={0.8} showContacts />`,
    props: [
      view("profile", "robot"),
      { name: "behavior", type: '"walk" | "trot" | "idle" | "static"', default: '"idle"', description: "What it does when phase is not supplied. Idle still breathes: the hips rise and fall." },
      { name: "gait", type: '"stand" | "walk" | "trot"', description: "Footfall pattern. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions; ignored when standing." },
      { name: "speed", type: "number", default: "0.75", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pack breaks step. Phase is the gait cycle here, so the offset has its own name." },
      ...gaitLoop(),
      { name: "interactive", type: "boolean", default: "true", description: "It notices you: the pointer coming over it gets it up and walking, and a click sits it down." },
      { name: "onGaitChange", type: "(gait) => void", description: "Fired when the resolved footfall pattern changes." },
      { name: "height", type: "number", default: "0.5", description: "Normalized stance height, clamped to 0–1 (36–54 world units at the hips). Non-finite values use 0.5." },
      { name: "stride", type: "number", default: "0.6", description: "Normalized fore/aft foot travel, clamped to 0–1. Zero steps in place. Non-finite values use 0.6." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized foot clearance, clamped to 0–1. Zero slides feet along the ground. Non-finite values use 0.5." },
      { name: "showGround", type: "boolean", default: "true", description: "Ground reference plane; blueprint adds its grid." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark solved feet that touch the ground plane." },
      { name: "label", type: "string", description: "Caption underneath the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had, where one pair of legs is drawn behind the other. Off that axis the legs are tubes either side of the body at half a track out, and the body is a box.", "Supplying phase hands the cycle back to your timeline and stops the internal clock. Without it the robot keeps its own, parked by a reduced-motion preference.", "All four legs solve two-link inverse kinematics in parallel planes. The illustration preserves link lengths but does not simulate balance, forces, or terrain."],
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
    slug: "robot-fish", item: "robot-fish", title: "Robot fish", group: "Robots",
    summary: "A swimming fish in profile. The hull is a travelling body wave offset to either side, with the swing piled at the tail, fins that work, and a dart you can set off.",
    files: ["components/ui/robot-fish.tsx"],
    usage: `import { RobotFish } from "@/components/ui/robot-fish"

<RobotFish behavior="cruise" />

// Or drive the beat from your own timeline.
<RobotFish phase={0.35} amplitude={0.7} waves={1.4} turn={0.3} fins={20} />`,
    props: [
      view("profile", "fish"),
      { name: "behavior", type: '"cruise" | "dart" | "hover" | "static"', default: '"cruise"', description: "What it does when phase is not supplied: a steady beat, burst-and-glide, or holding station on its fins." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions." },
      { name: "speed", type: "number", default: "1.1", description: "Tail beats per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a shoal breaks step. Phase is the beat here, so the offset has its own name." },
      ...gaitLoop(),
      { name: "amplitude", type: "number", default: "0.5", description: "Peak body swing, clamped to 0–1, where 1 is 52° off the axis. Omit and the behavior sets it." },
      { name: "waves", type: "number", default: "1.2", description: "Wave crests along the body, clamped to 0.25–3." },
      { name: "turn", type: "number", description: "Steady body curvature, −1 nose down to 1 nose up. Omit and it turns toward the pointer." },
      { name: "segments", type: "number", default: "14", description: "Links in the body, rounded and clamped to 3–24." },
      { name: "fins", type: "number", description: "Pectoral fin angle in degrees, clamped to −45..45. Omit and the behavior works them." },
      { name: "interactive", type: "boolean", default: "true", description: "Turns toward the pointer, and darts when clicked — a swing and speed spike that decays out." },
      { name: "onDart", type: "() => void", description: "Fired on the click that starts a dart." },
      { name: "showGround", type: "boolean", default: "true", description: "The seabed line and its scatter." },
      { name: "label", type: "string", description: "Caption underneath the fish." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had. A hull is round in section: off-axis the body is a chain of tubes down the solved spine, each as thick as the hull is there.", "The hull is the solver's output: `spineOutline` offsets every solved joint by a width profile, so the silhouette cannot drift out of step with the wave.", "Body swing is tapered to the tail, which is what a carangiform swimmer does. Thrust, drag and buoyancy are not modelled — this is a pose, not a simulation."],
  },
  {
    slug: "robot-snake", item: "robot-snake", title: "Robot snake", group: "Robots",
    summary: "A serpentine crawler from above. One travelling wave gives it serpentine travel, sidewinding with half the body lifted clear, or a resting coil.",
    files: ["components/ui/robot-snake.tsx"],
    usage: `import { RobotSnake } from "@/components/ui/robot-snake"

<RobotSnake behavior="sidewind" showContacts />

// Or scrub the wave yourself.
<RobotSnake phase={0.4} amplitude={0.9} waves={1.5} lift={1} turn={-0.2} />`,
    props: [
      view("plan", "crawler"),
      { name: "behavior", type: '"serpentine" | "sidewind" | "coil" | "static"', default: '"serpentine"', description: "What it does when phase is not supplied: an even wave, alternating sections lifted clear, or curled up and breathing." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions." },
      { name: "speed", type: "number", default: "0.6", description: "Wave cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a nest of them breaks step." },
      ...gaitLoop(),
      { name: "amplitude", type: "number", default: "0.78", description: "Peak body swing, clamped to 0–1. Omit and the behavior sets it." },
      { name: "waves", type: "number", default: "1.5", description: "Wave crests along the body, clamped to 0.25–3." },
      { name: "turn", type: "number", description: "Steady curvature, −1..1, added to the wave. Omit and the head follows the pointer." },
      { name: "lift", type: "number", description: "Peak ground clearance on the lifted half of the wave, 0–1. Sidewinding is 1." },
      { name: "segments", type: "number", default: "16", description: "Links in the body, rounded and clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "The head turns toward the pointer, and a click throws a strike that flattens the wave and recovers." },
      { name: "onStrike", type: "() => void", description: "Fired on the click that starts a strike." },
      { name: "showGround", type: "boolean", default: "true", description: "Ground reference lines under the machine." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the segments carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the snake." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection. The spine solver reports a clearance for every joint, so sidewinding is genuinely off the ground rather than shaded to look it \u2014 from the side the lifted half of the body is visibly clear of it.", "Lifted sections draw an offset shadow and drop out of the contact marks, so sidewinding reads as height rather than as a differently shaped wave.", "The solver integrates a tangent angle instead of moving joints, so every link is exactly the same length at every phase, turn and amplitude."],
  },
  {
    slug: "robot-spider", item: "robot-spider", title: "Robot spider", group: "Robots",
    summary: "An eight-legged walker from above, with every knee solved in its own vertical plane. Tripod, wave and ripple gaits, and a body that turns to face where it is going.",
    files: ["components/ui/robot-spider.tsx"],
    usage: `import { RobotSpider } from "@/components/ui/robot-spider"

<RobotSpider behavior="walk" />

// Or drive the cycle and the facing yourself.
<RobotSpider gait="ripple" phase={0.3} heading={40} height={0.7} legs={6} showContacts />`,
    props: [
      view("plan", "walker"),
      { name: "behavior", type: '"walk" | "skitter" | "idle" | "static"', default: '"walk"', description: "What it does when phase is not supplied: a tripod walk, a fast ripple, or standing and breathing." },
      { name: "gait", type: '"stand" | "tripod" | "wave" | "ripple"', description: "Footfall pattern. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions." },
      { name: "speed", type: "number", default: "0.9", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a nest of them breaks step." },
      ...gaitLoop(),
      { name: "legs", type: "number", default: "8", description: "Legs, rounded to an even number and clamped to 4–10." },
      { name: "height", type: "number", default: "0.55", description: "Normalized body clearance, clamped to 0–1 (8–30 world units)." },
      { name: "stride", type: "number", default: "0.65", description: "Normalized foot travel, clamped to 0–1. Zero steps in place." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized swing height, clamped to 0–1." },
      { name: "heading", type: "number", description: "Facing in degrees, clockwise from up. Omit and it turns toward the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "It faces the pointer and walks while it is watched; a click drops it into a crouch and another stands it up." },
      { name: "onCrouchChange", type: "(crouched: boolean) => void", description: "Fired when a click changes the crouch." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground patch under the machine; blueprint adds its grid." },
      { name: "showContacts", type: "boolean", default: "false", description: "Ring the feet carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection, facing included. The gait solver already works in three dimensions, so off-axis the legs are simply the solve drawn at the knee heights and foot clearances the plan view could only hint at by sliding them up the screen.", "Stance is pulled in far enough that a full stride still lands inside each leg's reach, so no requested foot is ever out of range.", "The view is plan: raised knees and swinging feet are offset up the screen in proportion to their solved height, which is a depth cue rather than a projection. The leg lengths themselves are solved."],
  },
  {
    slug: "robot-crab", item: "robot-crab", title: "Robot crab", group: "Robots",
    summary: "A sideways walker from above: the same gait solver as the spider turned across the body, plus two hinged claws and a pair of tracking eyestalks.",
    files: ["components/ui/robot-crab.tsx"],
    usage: `import { RobotCrab } from "@/components/ui/robot-crab"

<RobotCrab behavior="scuttle" />

// Or drive the cycle, the course and the claws yourself.
<RobotCrab phase={0.25} heading={270} claw={0.8} eyes={-0.5} showContacts />`,
    props: [
      view("plan", "walker"),
      { name: "behavior", type: '"scuttle" | "idle" | "static"', default: '"scuttle"', description: "What it does when phase is not supplied: runs one way, stops, runs back, or stands and works its claws." },
      { name: "gait", type: '"stand" | "tripod" | "wave" | "ripple"', description: "Footfall pattern. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock. Wraps in both directions." },
      { name: "speed", type: "number", default: "1", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a colony breaks step." },
      ...gaitLoop(),
      { name: "legs", type: "number", default: "8", description: "Walking legs, rounded to an even number and clamped to 4–10. The claws are extra." },
      { name: "height", type: "number", default: "0.4", description: "Normalized body clearance, clamped to 0–1." },
      { name: "stride", type: "number", default: "0.7", description: "Normalized foot travel, clamped to 0–1." },
      { name: "lift", type: "number", default: "0.55", description: "Normalized swing height, clamped to 0–1." },
      { name: "heading", type: "number", description: "Travel direction in degrees across the body: 90 runs to starboard, 270 to port. Omit and the behavior picks." },
      { name: "claw", type: "number", description: "Claw opening, 0 shut to 1 wide. Omit and the behavior works them." },
      { name: "eyes", type: "number", description: "Eyestalk aim, −1..1. Omit and the stalks follow the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The stalks track the pointer, and a click snaps both claws shut and lets them fall open." },
      { name: "onSnap", type: "() => void", description: "Fired on the click that snaps the claws." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground patch under the machine." },
      { name: "showContacts", type: "boolean", default: "false", description: "Ring the feet carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the robot." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection. Off-axis the legs are the solve at its own heights, the carapace has a real thickness and the chelipeds are tubes rather than outlines.", "The carapace never turns: only the travel direction handed to the gait solver does, which is the whole mechanical difference between this and the spider.", "Claws are illustrated linkages with one solved degree of freedom — the hinged jaw. The walking legs are the solved part."],
  },
  {
    slug: "robot-bird", item: "robot-bird", title: "Robot bird", group: "Robots",
    summary: "A perching flyer in profile. Each wing is a three-link chain carrying fanned feather plates, so folding, extending and beating are one mechanism.",
    files: ["components/ui/robot-bird.tsx"],
    usage: `import { RobotBird } from "@/components/ui/robot-bird"

<RobotBird behavior="perch" />

// Or drive the beat and the pose yourself.
<RobotBird phase={0.25} spread={1} tail={0.8} altitude={0.6} headAngle={-20} />`,
    props: [
      view("profile", "bird"),
      { name: "behavior", type: '"perch" | "flap" | "glide" | "static"', default: '"perch"', description: "What it does when phase is not supplied: sits folded and looks around, beats, or holds the wings out and trims with the tail." },
      { name: "phase", type: "number", description: "Controlled wingbeat fraction. Supplying it stops the internal clock. Wraps in both directions." },
      { name: "speed", type: "number", default: "1.6", description: "Wingbeats per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a flock breaks step." },
      ...gaitLoop(),
      { name: "spread", type: "number", description: "Wing extension, 0 folded against the body to 1 spread. Omit and the behavior sets it." },
      { name: "tail", type: "number", description: "Tail fan, 0 closed to 1 spread. Omit and the behavior sets it." },
      { name: "altitude", type: "number", description: "Height above the perch, 0–1. Above zero the legs tuck. Omit and the behavior decides." },
      { name: "headAngle", type: "number", description: "Head turn in degrees, clamped to −40..40. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The head tracks the pointer, and a click launches it: wings out, hard beats, then a settle back onto the perch." },
      { name: "onTakeoff", type: "() => void", description: "Fired on the click that starts a launch." },
      { name: "showGround", type: "boolean", default: "true", description: "The perch and its shadow." },
      { name: "label", type: "string", description: "Caption underneath the bird." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had. The wings are either side of the torso rather than one behind the other, which only reads once the camera comes round.", "Folding and beating are the same chain at different angles, so a wing never has two sets of artwork: spread interpolates the whole linkage between tucked and extended.", "The wing is an illustrated linkage driven by angles rather than an inverse-kinematic solve — there is no target for it to reach. The feather fan opens on the downstroke and closes coming up, which is what a real primary fan does."],
  },
  {
    slug: "fabricator", item: "fabricator", title: "Fabricator", group: "Machines",
    summary: "An additive build cell that makes its own workpiece. The object on the plate is a continuous field sampled into voxels and laid cell by cell, so raising the resolution rebuilds the same object out of smaller cells rather than drawing a different picture.",
    files: ["components/ui/fabricator.tsx"],
    usage: `import { Fabricator } from "@/components/ui/fabricator"

<Fabricator shape="lattice" behavior="build" view="iso" />

// Controlled, or a control: scrub the build line yourself.
<Fabricator progress={0.4} resolution={9} />
<Fabricator interactive onProgressChange={setProgress} />`,
    props: [
      { name: "shape", type: '"sphere" | "block" | "pyramid" | "gear" | "vessel" | "lattice"', default: '"sphere"', description: "What the cell is making. Each is an occupancy field over the build volume, not a stored model." },
      { name: "resolution", type: "number", default: "6", description: "Voxels along one edge, rounded and clamped to 2–14. Omit it under behavior=\"refine\" and the machine animates it." },
      { name: "progress", type: "number", description: "Controlled build fraction, clamped to 0–1. Omit it and the build line runs behavior. A non-finite value empties the plate." },
      { name: "behavior", type: '"build" | "layer" | "refine" | "idle" | "static"', default: '"build"', description: "Lay the whole object and clear the plate; work one layer across; hold the object complete and walk the resolution coarse to fine; or stand finished and still." },
      { name: "speed", type: "number", default: "0.12", description: "Build cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to lay or strip material; arrow keys step one layer, Home empties the plate and End completes it." },
      { name: "onProgressChange", type: "(progress: number) => void", description: "The commanded build fraction, fired throughout a drag or a key press." },
      { name: "view", type: '"plan" | "front" | "profile" | "iso"', default: '"iso"', description: "Where the camera stands. One model, four projections; plan collapses the volume to its footprint." },
      { name: "showEnclosure", type: "boolean", default: "true", description: "The four columns and the rails that tie their heads together." },
      { name: "showReadout", type: "boolean", default: "true", description: "The build percentage and voxel resolution under the plate." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow under the build plate." },
      { name: "signal", type: '"idle" | "ready" | "warning"', description: "Carriage lamp. Omit it and it lights while material is landing." },
      { name: "label", type: "string", description: "Caption under the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Vectors, not pixels: every voxel is an SVG path built from projected world coordinates, so the same drawing serves a 96px card and a full-bleed hero.",
      "The shape is a continuous field, so sampling it converges on the real solid as resolution rises without bound — the 2–14 clamp is a drawing budget, because the cell count is cubic and the drawn surface is quadratic. Resolutions above about ten with refine running are the expensive corner.",
      "The three axes all come off one number. Deposition order is a serpentine raster through the solid and progress is an index into it, so the bridge, carriage and quill point at the cell being laid in controlled mode as much as under a behavior.",
      "Cells buried inside the solid are never drawn — they would be painted over anyway. What you see is the surface at the current build line.",
      "A supplied progress wins and stops the loop, and a supplied resolution wins over refine. A resolution too coarse to resolve the shape lays a single central cell rather than an empty plate.",
    ],
  },
  {
    slug: "voxel-form", item: "voxel-form", title: "Voxel form", group: "Machines",
    summary: "The workpiece on its own, with no machine around it. A continuous field sampled at your resolution and drawn as vector cells, so it can sit in a hero, a card or a loading state without a gantry bolted to it.",
    files: ["components/ui/voxel-form.tsx"],
    usage: `import { VoxelForm } from "@/components/ui/voxel-form"

<VoxelForm shape="gear" behavior="refine" showPlate={false} />

// Controlled, or a control:
<VoxelForm progress={0.6} resolution={9} />
<VoxelForm interactive onProgressChange={setProgress} />`,
    props: [
      { name: "shape", type: '"sphere" | "block" | "pyramid" | "gear" | "vessel" | "lattice"', default: '"sphere"', description: "Which occupancy field to sample." },
      { name: "resolution", type: "number", default: "6", description: "Voxels along one edge, rounded and clamped to 2–14. Omit it under behavior=\"refine\" and it animates." },
      { name: "progress", type: "number", description: "Controlled build fraction, clamped to 0–1. A non-finite value empties the plate." },
      { name: "behavior", type: '"build" | "layer" | "refine" | "idle" | "static"', default: '"build"', description: "The shared fabricator cycle: lay the object and clear, work one layer, walk the resolution coarse to fine, or stand complete." },
      { name: "speed", type: "number", default: "0.14", description: "Build cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to lay or strip material; arrow keys step one layer." },
      { name: "onProgressChange", type: "(progress: number) => void", description: "The commanded build fraction, fired throughout a drag or a key press." },
      { name: "view", type: '"plan" | "front" | "profile" | "iso"', default: '"iso"', description: "Where the camera stands. One model, four projections." },
      { name: "showPlate", type: "boolean", default: "true", description: "The plate the form stands on. Off, and it floats." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow underneath." },
      { name: "label", type: "string", description: "Caption underneath the form." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The same geometry every fabricator in the set builds — one field, one deposition order, one set of vector cells. Pick this when you want the object and not the machine.",
      "Cells buried inside the solid are never drawn. Raising the resolution rebuilds the same object out of smaller cells rather than making it bigger.",
    ],
  },
  {
    slug: "arm-fabricator", item: "arm-fabricator", title: "Arm fabricator", group: "Machines",
    summary: "An articulated fabricator that has to reach for its work. The turret yaws toward the cell being laid and the shoulder and elbow are solved with the analytic two-link elbow, in the arm's own vertical plane.",
    files: ["components/ui/arm-fabricator.tsx"],
    usage: `import { ArmFabricator } from "@/components/ui/arm-fabricator"

<ArmFabricator shape="gear" behavior="build" elbow="up" />

// Controlled, or a control:
<ArmFabricator progress={0.45} resolution={7} view="profile" />`,
    props: [
      { name: "shape", type: '"sphere" | "block" | "pyramid" | "gear" | "vessel" | "lattice"', default: '"gear"', description: "Which occupancy field to sample." },
      { name: "resolution", type: "number", default: "6", description: "Voxels along one edge, rounded and clamped to 2–14." },
      { name: "progress", type: "number", description: "Controlled build fraction, clamped to 0–1." },
      { name: "behavior", type: '"build" | "layer" | "refine" | "idle" | "static"', default: '"build"', description: "The shared fabricator cycle." },
      { name: "speed", type: "number", default: "0.12", description: "Build cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to lay or strip material; arrow keys step one layer." },
      { name: "onProgressChange", type: "(progress: number) => void", description: "The commanded build fraction." },
      { name: "view", type: '"plan" | "front" | "profile" | "iso"', default: '"iso"', description: "Where the camera stands." },
      { name: "elbow", type: '"up" | "down"', default: '"up"', description: "Which way the elbow breaks. Both are valid solutions for the same tip position." },
      { name: "showPlate", type: "boolean", default: "true", description: "The build plate and the volume printed on it." },
      { name: "showReadout", type: "boolean", default: "true", description: "Build percentage and voxel resolution." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow under the cell." },
      { name: "signal", type: '"idle" | "ready" | "warning"', description: "Shoulder lamp. Omit it and it lights while material is landing." },
      { name: "label", type: "string", description: "Caption under the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the yaw, the shoulder and the elbow. Illustrated: the wrist, which holds the nozzle vertical because that is how a deposition head works rather than being solved for an orientation.",
      "The goal is clamped onto the reachable sphere before the elbow is solved, so both links always hold the lengths they claim. A cell the arm cannot get to shows as a longer beam, never as a stretched forearm — and the arm is placed so that, at the shipped link lengths, no cell in the volume is out of reach.",
      "Same field, same deposition order and same build line as the rest of the family: only the body carrying the nozzle is different.",
    ],
  },
  {
    slug: "drone-fabricator", item: "drone-fabricator", title: "Drone fabricator", group: "Machines",
    summary: "A free-flying fabricator with no envelope at all. A repulsor platform flies to each cell, rides a fixed standoff above the build line, and banks into its own travel.",
    files: ["components/ui/drone-fabricator.tsx"],
    usage: `import { DroneFabricator } from "@/components/ui/drone-fabricator"

<DroneFabricator shape="vessel" pods={6} behavior="build" />

// Controlled, or a control:
<DroneFabricator progress={0.35} resolution={8} view="front" />`,
    props: [
      { name: "shape", type: '"sphere" | "block" | "pyramid" | "gear" | "vessel" | "lattice"', default: '"vessel"', description: "Which occupancy field to sample." },
      { name: "resolution", type: "number", default: "6", description: "Voxels along one edge, rounded and clamped to 2–14." },
      { name: "progress", type: "number", description: "Controlled build fraction, clamped to 0–1." },
      { name: "behavior", type: '"build" | "layer" | "refine" | "idle" | "static"', default: '"build"', description: "The shared fabricator cycle." },
      { name: "speed", type: "number", default: "0.12", description: "Build cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to lay or strip material; arrow keys step one layer." },
      { name: "onProgressChange", type: "(progress: number) => void", description: "The commanded build fraction." },
      { name: "view", type: '"plan" | "front" | "profile" | "iso"', default: '"iso"', description: "Where the camera stands." },
      { name: "pods", type: "number", default: "4", description: "Repulsor pods around the deck, rounded and clamped to 3–6. The deck tilts with the bank, so a pod on the low side really does sit lower." },
      { name: "showPlate", type: "boolean", default: "true", description: "The plate the solid is built on." },
      { name: "showReadout", type: "boolean", default: "true", description: "Build percentage and voxel resolution." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow, plus the platform's own shadow tracking it across the plate." },
      { name: "signal", type: '"idle" | "ready" | "warning"', description: "Pod and deck lamps. Omit them and they light while material is landing." },
      { name: "label", type: "string", description: "Caption under the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the deposition order, the flight target and the bank, which is taken from how far the platform still has to travel to the next cell. Illustrated: the repulsors — there is no thrust or lift model behind them.",
      "No frame and no rails, so the reachable volume is bounded by where the platform can fly rather than by an envelope.",
      "Same field, same deposition order and same build line as the rest of the family.",
    ],
  },
  {
    slug: "voxel-geometry", item: "voxel-geometry", title: "Voxel geometry", group: "Foundations",
    summary: "The sampler behind the fabricator: continuous occupancy fields over the unit cube, turned into buildable cells in deposition order, with the buried ones dropped.",
    files: ["lib/robocn/voxel.ts"],
    usage: `import { voxelSolid, voxelLaid, voxelBuild } from "@/lib/robocn/voxel"

const solid = voxelSolid({ shape: "gear", resolution: 8 })
const part = voxelBuild(solid, voxelLaid(solid, 0.4))
part.surface // the cells worth drawing, each flagged if its top is open
part.active  // the cell under the nozzle`,
    api: [
      { name: "voxelOccupies", type: "(shape, u, v, w) => boolean", description: "The field itself, over the unit cube with u, v, w in −1..1 and v up. Continuous, so it can be sampled at any resolution; anything outside the cube or not a number is empty." },
      { name: "voxelSolid", type: "({ shape?, resolution? }) => VoxelSolid", description: "Samples a shape into every occupied cell, ordered the way a head would lay them: layer by layer, serpentine across each so the head never flies home empty." },
      { name: "voxelLaid", type: "(solid, progress) => number", description: "How many cells a 0–1 build fraction has laid. Non-finite progress empties the plate." },
      { name: "voxelBuild", type: "(solid, laid) => VoxelBuild", description: "The visible state of a part-built solid: the laid cells with an open face, whether each has an open top, the layer being worked, and the cell under the nozzle." },
      { name: "voxelResolution", type: "(value?) => number", description: "Rounds and clamps a requested resolution into 2–14, the range the drawing budget allows." },
      { name: "voxelCenter", type: "(cell, resolution) => Vec3", description: "A cell's centre in normalised coordinates, −1 to 1 on each axis." },
      { name: "VoxelShape", type: '"sphere" | "block" | "pyramid" | "gear" | "vessel" | "lattice"', description: "Six fields chosen to stay legible at low resolutions and to stress the sampler differently: curvature, a chamfer, stepping, angular teeth with a bore, a hollow interior, and an open-cell frame." },
    ],
    notes: [
      "Surface extraction, not every cell: an occupied cell is only returned when one of its six neighbours inside the laid prefix is empty. Interior cells are painted over anyway, and dropping them turns a cubic count into a quadratic one.",
      "The clamp on resolution belongs to the renderer, not the geometry. The field is continuous and the sampled volume converges on it as the grid gets finer, which is what the tests assert against the analytic volume of a sphere.",
      "Pure functions over plain objects. No React, no dependencies beyond clamp.",
    ],
  },
  {
    slug: "spine-kinematics", item: "spine-kinematics", title: "Spine kinematics", group: "Foundations",
    summary: "The travelling-wave body solver behind the fish and the snake: a serpenoid curve with taper, steady turn, and ground clearance.",
    files: ["lib/robocn/spine.ts"],
    usage: `import { solveSpine, spineOutline } from "@/lib/robocn/spine"

const pose = solveSpine({ segments: 14, phase: 0.3, amplitude: 0.7, waves: 1.4, taper: 0.8 })
pose.joints // position, angle, s, clearance, contact
spineOutline(pose, (s) => 12 * (1 - s)) // the hull, as one path`,
    api: [
      { name: "solveSpine", type: "(options?: SpineOptions) => SpinePose", description: "Walks the joints off a travelling tangent angle from the nose backwards. The nose sits at the origin pointing along +x, with the body running back toward −x." },
      { name: "SpineOptions", type: "{ segments?, length?, phase?, amplitude?, waves?, taper?, turn?, lift? }", description: "Segments 3–24, amplitude 0–1 (1 is 52° of swing), waves 0.25–3, taper −1..1, turn −1..1 (1 is a half circle), lift 0–1 (up to 7 units of clearance)." },
      { name: "SpineJoint", type: "{ position: Vec2, angle, s, clearance, contact }", description: "Angle is the body's heading at that joint in degrees; s runs 0 at the nose to 1 at the tail; contact means the joint is on the ground plane." },
      { name: "spineOutline", type: "(pose, halfWidth: (s) => number, round?) => string", description: "The joints offset either side by a width profile and closed into one SVG path — the hull, built from the solved spine rather than drawn beside it." },
      { name: "spineLimits", type: "{ swing: 52, turn: 180, clearance: 7 }", description: "What amplitude, turn and lift of 1 mean in degrees and world units." },
    ],
    notes: ["Integrating a tangent angle rather than displacing joints is what keeps every link exactly the same length at every phase — the invariant the tests assert.", "A crest travels head to tail as phase rises. Run phase backwards to reverse it. No thrust, drag or friction is modelled."],
  },
  {
    slug: "hexapod-kinematics", item: "hexapod-kinematics", title: "Hexapod kinematics", group: "Foundations",
    summary: "The radial walking solver behind the spider and the crab: four to ten legs, three gaits, plan-view feet, and knees solved in each leg's own vertical plane.",
    files: ["lib/robocn/hexapod.ts"],
    usage: `import { solveHexapod } from "@/lib/robocn/hexapod"

const pose = solveHexapod({ legs: 8, gait: "tripod", phase: 0.4, heading: 90 })
pose.legs // id, side, hip, knee, foot, kneeHeight, clearance, contact, bearing
pose.height // body height in world units`,
    api: [
      { name: "solveHexapod", type: "(options?: HexapodOptions) => HexapodPose", description: "Fans the hips around the carapace, slides each foot along the travel direction, and solves the knee as a two-link chain in the leg's vertical plane." },
      { name: "HexapodOptions", type: "{ legs?, gait?, phase?, height?, stride?, lift?, heading?, radius?, fan?, spread?, femur?, tibia? }", description: "Legs 4–10 rounded to an even number; normalized height, stride and lift; heading in degrees (0 walks toward the nose, 90 to starboard)." },
      { name: "HexapodLeg", type: "{ id, side, hip: Vec2, knee: Vec2, foot: Vec2, kneeHeight, clearance, contact, bearing }", description: "Positions are plan view — x starboard, y toward the nose — with the knee's height reported separately so a drawing can raise it." },
      { name: "HexapodGait", type: '"stand" | "tripod" | "wave" | "ripple"', description: "Tripod swings alternate legs (duty 0.5), wave moves one leg at a time, ripple runs a delay down each side." },
    ],
    notes: ["Femur and tibia hold their lengths in every pose, because the stance radius is capped so a full stride still lands inside the leg's reach.", "Illustrative trajectories, not dynamics: no balance, no ground reaction, and the body never translates — the feet do."],
  },
  {
    slug: "linear-actuator", item: "linear-actuator", title: "Linear actuator", group: "Machines",
    summary: "A linear cylinder with a moving piston and rod. Reveal its internals in cutaway view, or use the complete housing in a production-cell illustration.",
    files: ["components/ui/linear-actuator.tsx"],
    usage: `import { LinearActuator } from "@/components/ui/linear-actuator"

<LinearActuator cutaway size="lg" />

// Controlled, or a control:
<LinearActuator extension={0.75} />
<LinearActuator interactive onExtensionChange={setStroke} />`,
    props: [
      view("profile", "cylinder"),
      { name: "extension", type: "number", description: "Controlled stroke, clamped to 0–1. Zero retracts and one fully extends. Omit it and the cylinder runs behavior." },
      { name: "behavior", type: '"cycle" | "breathe" | "static"', default: '"cycle"', description: "The duty cycle — stroke out, dwell, stroke back, dwell — or a continuous sine." },
      { name: "speed", type: "number", default: "0.32", description: "Duty cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the rod along its stroke or arrow-key it; the cylinder becomes a slider and eases back into its cycle on release." },
      { name: "onExtensionChange", type: "(extension: number) => void", description: "Fired throughout a drag or a key press, in controlled mode too." },
      { name: "cutaway", type: "boolean", default: "false", description: "Make the cylinder wall translucent and reveal the piston." },
      { name: "showRuler", type: "boolean", default: "true", description: "Stroke scale and percentage under the rod." },
      { name: "label", type: "string", description: "Caption under the assembly." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had. A cylinder is round in section, which only reads off that axis: the barrel, the rod and the end flanges are tubes down the machine\u2019s axis.", "A supplied extension always wins and stops the loop. Uncontrolled the cylinder runs its own cycle; grabbing it pins the stroke to the pointer, and releasing eases it back in at the cylinder's own rate.", "The piston and rod move together through a fixed illustrative stroke; the component does not simulate fluid pressure or force.", "The scale is a percentage of the drawing's stroke, not a measurement in physical units."],
  },
  {
    slug: "servo-motor", item: "servo-motor", title: "Servo motor", group: "Machines",
    summary: "A positional servo with mounting tabs, a cable, and interchangeable single, double, or cross horns. Drive the shaft angle from application state.",
    files: ["components/ui/servo-motor.tsx"],
    usage: `import { ServoMotor } from "@/components/ui/servo-motor"

<ServoMotor behavior="step" horn="cross" variant="blueprint" />

// Controlled, or a dial you can turn:
<ServoMotor angle={45} />
<ServoMotor interactive onAngleChange={setAngle} />`,
    props: [
      view("front", "servo"),
      { name: "angle", type: "number", description: "Clockwise horn angle in degrees, clamped to −180..180. Zero points up. Omit it and the shaft runs behavior." },
      { name: "behavior", type: '"sweep" | "step" | "hunt" | "static"', default: '"sweep"', description: "Sweep its travel, index between positions, or hunt a degree or two around zero the way a loaded servo does." },
      { name: "speed", type: "number", default: "0.25", description: "Sweeps, or passes through the step positions, per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag anywhere around the hub to aim the horn; arrows step 5°, with shift 15°." },
      { name: "onAngleChange", type: "(angle: number) => void", description: "Fired throughout a drag or a key press, in controlled mode too." },
      { name: "horn", type: '"single" | "double" | "cross"', default: '"double"', description: "One, two, or four attachment arms. The first arm carries the direction mark." },
      { name: "showCable", type: "boolean", default: "true", description: "Draw the three-wire cable and connector." },
      { name: "showScale", type: "boolean", default: "true", description: "Circular reference scale around the shaft." },
      { name: "label", type: "string", description: "Caption under the motor." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Front elevation is the drawing it always had. The can, the mounting tabs and the output boss have a depth through the machine that only reads once the camera comes round.", "A supplied angle always wins and stops the loop. The step behavior deliberately jumps its goal: the 210°/s slew rate is what draws the travel between positions, and what carries a released horn back into the sweep.", "The drawing's travel limits are illustrative and do not specify the limits of a particular physical servo."],
  },
  {
    slug: "rotary-table", item: "rotary-table", title: "Rotary table", group: "Machines",
    summary: "A rotary indexing table in plan view. Fixtures and workpieces rotate with the platter while the base, motor, and index pointer stay fixed.",
    files: ["components/ui/rotary-table.tsx"],
    usage: `import { RotaryTable } from "@/components/ui/rotary-table"

<RotaryTable stations={6} loaded variant="blueprint" />

// Controlled, or a dial: drag to spin, click a fixture to index it up.
<RotaryTable angle={60} />
<RotaryTable interactive onStationChange={setStation} />`,
    props: [
      view("plan", "table"),
      { name: "angle", type: "number", description: "Controlled clockwise platter angle in degrees. Wraps after each turn. Omit it and the platter runs behavior." },
      { name: "behavior", type: '"index" | "spin" | "static"', default: '"index"', description: "Step station to station with a dwell between, or turn continuously." },
      { name: "speed", type: "number", default: "0.5", description: "Index steps per second, or turns per second while spinning." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the platter to spin it, click a fixture to bring it round to the pointer, or arrow-key one station at a time." },
      { name: "onAngleChange", type: "(angle: number) => void", description: "The platter angle, wrapped to 0–360, whenever a person moves it." },
      { name: "onStationChange", type: "(station: number) => void", description: "Which station has been indexed to the pointer." },
      { name: "stations", type: "number", default: "6", description: "Equally spaced fixtures, rounded and clamped to 0–12. Non-finite values use six; zero gives a bare platter." },
      { name: "loaded", type: "boolean", default: "true", description: "Show a workpiece in every fixture." },
      { name: "showTicks", type: "boolean", default: "true", description: "Draw the graduated angle marks on the rotating platter." },
      { name: "label", type: "string", description: "Caption below the stationary angle readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection, and the platter\u2019s own rotation composes onto the camera, so a tipped table still indexes truthfully. The base, the platter\u2019s thickness and the fixtures are solids that only read off the vertical.", "A supplied angle always wins and stops the loop; index it yourself by setting angle to stationIndex * 360 / stations. Uncontrolled, indexing is a staircase goal plus a 150°/s slew — the dwell is what is left between steps.", "Zero degrees aligns the first fixture to the fixed pointer at the top. The remaining fixtures are equally spaced clockwise."],
  },
  {
    slug: "robot-rover", item: "robot-rover", title: "Robot rover", group: "Robots",
    summary: "A ground robot in plan view. Choose four or six wheels, steer the front axle, and drive its heading and tread travel from your application.",
    files: ["components/ui/robot-rover.tsx"],
    usage: `import { RobotRover } from "@/components/ui/robot-rover"

<RobotRover wheels={6} behavior="patrol" />

// Or drive it: pointer mode turns it to face the cursor.
<RobotRover behavior="pointer" interactive onHeadingChange={setHeading} />
<RobotRover heading={25} steering={15} wheelTravel={0.4} active />`,
    props: [
      view("plan", "rover"),
      { name: "wheels", type: "4 | 6", default: "4", description: "Two or three axles. Only the front axle steers." },
      { name: "behavior", type: '"patrol" | "wander" | "pointer" | "static"', default: '"patrol"', description: "Drive a square patrol, drift about, or come round to face the pointer." },
      { name: "heading", type: "number", description: "Clockwise degrees from the top. Omit it and the rover drives behavior." },
      { name: "steering", type: "number", description: "Front-wheel angle, clamped to −45..45 degrees. Omit it and the wheels steer themselves: the angle is the heading the chassis has left to cover." },
      { name: "wheelTravel", type: "number", description: "Controlled tread phase. Whole turns repeat; decrease to reverse. Omit it and the treads roll while it drives." },
      { name: "speed", type: "number", default: "0.3", description: "Legs of the patrol per second, or drift cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag to send it a bearing — the only way to steer it on a touch screen — and arrow-key it 15° at a time." },
      { name: "onHeadingChange", type: "(heading: number) => void", description: "The commanded bearing, wrapped to 0–360." },
      { name: "showSensor", type: "boolean", default: "true", description: "Draw the roof-mounted sensor turret." },
      { name: "active", type: "boolean", description: "Illuminate the front lamps. Omit and they light while it is driving." },
      { name: "label", type: "string", description: "Caption underneath the rover, independent of heading." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection, and the heading is carried by the camera rather than by turning the picture, so the rover faces the same way from every angle. The wheels are cylinders and the chassis a box \u2014 neither of which a plan view ever had to have.", "Any axis you supply wins for that axis alone: a controlled heading still leaves the treads and the steering to the component unless you supply those too.", "Steering is not a second animation — it is the heading error, which is why the rover leans into a turn and straightens as it finishes one. It is still an illustration rather than a dynamics solver: nothing integrates a driving path."],
  },
  {
    slug: "robot-drone", item: "robot-drone", title: "Robot drone", group: "Robots",
    summary: "A multirotor aircraft with four or six motors, counter-rotating propellers, landing gear and removable guards, drawn from any of four camera angles.",
    files: ["components/ui/robot-drone.tsx"],
    usage: `import { RobotDrone } from "@/components/ui/robot-drone"

<RobotDrone view="iso" rotors={6} behavior="orbit" />`,
    props: [
      { name: "rotors", type: "4 | 6", default: "4", description: "Quadcopter or hexacopter geometry." },
      { name: "view", type: `"plan" | "front" | "profile" | "iso"`, default: `"plan"`, description: "Where the camera stands. One airframe, four projections: straight down, nose-on, side elevation, or three-quarter." },
      { name: "behavior", type: `"hover" | "orbit" | "pointer" | "static"`, default: `"hover"`, description: "What it flies when nothing drives it: drift on the spot, a banked circle, or chase the cursor." },
      { name: "heading", type: "number", description: "Clockwise degrees from the nose-up position. Omit and the nose follows the flight path." },
      { name: "rotorAngle", type: "number", description: "Controlled blade angle in degrees. Omit and the rotors spin; adjacent propellers turn opposite ways." },
      { name: "speed", type: "number", default: "0.2", description: "Orbits, or drift cycles, per second." },
      ...loop,
      { name: "onHeadingChange", type: "(heading: number) => void", description: "The commanded bearing, wrapped to 0–360, while a person is flying it." },
      { name: "guards", type: "boolean", default: "true", description: "Protective rings and struts around each rotor." },
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag to fly the aircraft; arrow keys nudge it, Escape releases it." },
      { name: "active", type: "boolean", description: "Illuminate the fuselage lamp. Omit and it lights while airborne." },
      { name: "label", type: "string", description: "Caption underneath the aircraft, independent of heading." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Every view draws the same model. Parts are defined in world units and pushed through the shared camera, so heading, guards and blade angle stay truthful from any angle; plan view is the identity projection. Landing gear and the fuselage sides only appear once the camera tips over.", "Non-finite angles use zero. The component illustrates flight; it does not calculate lift."],
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
      { name: "scanAngle", type: "number", description: "Scan-ray angle relative to sensor-forward. Omit it and the ray runs behavior; a non-finite value hides it." },
      { name: "behavior", type: '"sweep" | "pointer" | "static"', default: '"sweep"', description: "Sweep the ray around, or aim it at the pointer." },
      { name: "speed", type: "number", default: "0.35", description: "Sweeps per second." },
      ...loop,
      { name: "showRay", type: "boolean", default: "true", description: "Draw the scan ray and its wedge at all." },
      { name: "interactive", type: "boolean", default: "false", description: "Hover a return to pick it out and read its bearing and distance off the bottom of the plot." },
      { name: "onSampleHover", type: "(sample: LidarSample | null) => void", description: "The return under the pointer, and null when it leaves." },
      { name: "showRays", type: "boolean", default: "false", description: "Draw a line from the sensor to each valid return." },
      { name: "showRings", type: "boolean", default: "true", description: "Quarter-range rings and crosshairs." },
      { name: "label", type: "string", description: "Bottom caption; defaults to the maximum range." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The component does not generate samples. The demo supplies a deterministic room outline and obstacle, clearly labelled as sample data.", "Negative, non-finite, and beyond-range distances are omitted. Non-finite angles are omitted. Zero-distance returns are valid and plot at the origin.", "Returns are drawn by age: each brightens as the ray passes it and fades over the next 150° of sweep, down to a floor that keeps the plot readable as a map between passes. That is display only — nothing is filtered. Supply a new samples array when fresh sensor data arrives."],
  },
  {
    slug: "robot-gripper", item: "robot-gripper", title: "Robot gripper",
    summary: "A standalone end effector with parallel or angular fingers. Drive the jaws from application state to build a fixture, tool selector, or work-cell simulation.",
    group: "Machines", files: ["components/ui/robot-gripper.tsx"],
    usage: `import { RobotGripper } from "@/components/ui/robot-gripper"

<RobotGripper fingers="parallel" active size="lg" />

// Controlled, or a control: drag a jaw, or click to toggle.
<RobotGripper opening={0.65} />
<RobotGripper interactive onOpeningChange={setOpening} />`,
    props: [
      view("front", "tool"),
      { name: "opening", type: "number", description: "Controlled jaw opening, clamped to 0–1. Omit it and the jaws run behavior." },
      { name: "behavior", type: '"cycle" | "flex" | "static"', default: '"cycle"', description: "A pick cycle — open, close onto a part, carry it, release — or a shallow breathing open and shut." },
      { name: "speed", type: "number", default: "0.3", description: "Pick cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag a jaw to set the opening, click to toggle open and shut, or arrow-key it." },
      { name: "onOpeningChange", type: "(opening: number) => void", description: "Fired throughout a drag, a tap or a key press." },
      { name: "fingers", type: '"parallel" | "angular"', default: '"parallel"', description: "Straight fingers or inward-reaching angled fingers. Both close at the centre." },
      { name: "active", type: "boolean", default: "false", description: "Pulses the status lamp, respecting reduced motion." },
      { name: "holding", type: "boolean", description: "Draws a workpiece between the jaws. Omit it and the pick cycle carries one: the part appears when the jaws close on it." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Front elevation is the drawing it always had. The body, the wrist block and the jaw plates gain their depth through the tool as the camera comes round.", "A supplied opening always wins and stops the loop. Uncontrolled, the jaws work a pick cycle, parked by a reduced-motion preference.", "The drawing exposes an accessible name with its opening percentage. Override aria-label for application-specific context."],
  },
  {
    slug: "conveyor-belt", item: "conveyor-belt", title: "Conveyor belt",
    summary: "A production-line conveyor with rollers and workpieces. Runs automatically or follows a controlled travel value, wrapping in either direction.",
    group: "Machines", files: ["components/ui/conveyor-belt.tsx"],
    usage: `import { ConveyorBelt } from "@/components/ui/conveyor-belt"

<ConveyorBelt parts={4} direction="right" size="lg" />

// Controlled, or a jog wheel you can scrub.
<ConveyorBelt position={0.25} />
<ConveyorBelt interactive onPositionChange={setPosition} />`,
    props: [
      view("profile", "line"),
      { name: "position", type: "number", description: "Controlled belt travel in revolutions. Wraps at every integer. Omit to run automatically; non-finite values park at zero." },
      { name: "parts", type: "number", default: "3", description: "Evenly spaced workpieces, rounded and clamped to 0–12. Zero gives an empty belt; non-finite values use three." },
      { name: "direction", type: '"left" | "right"', default: '"right"', description: "Direction of travel, including controlled travel." },
      { name: "speed", type: "number", default: "0.12", description: "Turns per second when uncontrolled. Zero or non-finite values park the belt; negative values reverse travel." },
      { name: "animate", type: "boolean", default: "true", description: "Enables automatic travel. Reduced-motion preference also disables it." },
      { name: "paused", type: "boolean", default: "false", description: "Freeze the belt where it stands." },
      { name: "phase", type: "number", default: "0", description: "Turns of offset, so a bank of belts breaks step." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag the belt to scrub it — the part under your finger stays under it — and release to let the line pick back up." },
      { name: "onPositionChange", type: "(position: number) => void", description: "Belt travel in turns, throughout a drag or a key press." },
      { name: "label", type: "string", description: "Caption underneath the conveyor." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Side elevation is the drawing it always had. A conveyor is a bed, so the width across the line, the rollers as cylinders and the side frames only appear once the camera comes round.", "A supplied position updates immediately and disables the internal animation loop. The travel slider in the demo shows this controlled mode.", "A scrubbed belt does not snap back to line speed on release: it eases up to it, on the same rate limiter every other machine in the set returns on.", "Omit position for automatic motion, or set animate={false} for a still illustration. The animation loop is cleaned up on unmount."],
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
      view("profile", "arm"),
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
      {
        name: "interactive",
        type: "boolean",
        default: "false",
        description:
          "Press and drag inside the frame to send the tool there; release and it eases back into its behaviour. Hover is not available on a touch screen, so this is how one drives it.",
      },
      {
        name: "onTargetChange",
        type: "(target: Vec2 | null) => void",
        description: "The dragged goal in world units, and null on release.",
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
      {
        name: "interactive",
        type: "boolean",
        default: "false",
        description:
          "Press the floor and the tip goes there, following the pointer until it is released. Picking against a plane is what separates driving the arm from orbiting the camera around it.",
      },
      {
        name: "onTargetChange",
        type: "(target: Vec3 | null) => void",
        description: "The picked floor position in world units, and null on release.",
      },
      ...motion,
      ...palette,
    ],
    notes: ["The drawing is a section through the arm\u2019s own vertical plane, projected: side elevation is the drawing it always had, and the castings, the pedestal and the base plate gain their width across the machine as the camera comes round.", 
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
        name: "pauseOnHover",
        type: "boolean",
        default: "true",
        description:
          "Stop the auto-rotation while the pointer is over the stage, so a machine can be looked at without chasing it round.",
      },
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
      view("plan", "cell"),
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
      {
        name: "interactive",
        type: "boolean",
        default: "false",
        description:
          "Press and drag inside the frame to send the tool there; release and it eases back into its behaviour. Hover is not available on a touch screen, so this is how one drives it.",
      },
      {
        name: "onTargetChange",
        type: "(target: Vec2 | null) => void",
        description: "The dragged goal in world units, and null on release.",
      },
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
      view("iso", "machine"),
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
      {
        name: "interactive",
        type: "boolean",
        default: "false",
        description:
          "Press and drag inside the frame to send the tool there; release and it eases back into its behaviour. Hover is not available on a touch screen, so this is how one drives it.",
      },
      {
        name: "onTargetChange",
        type: "(target: Vec2 | null) => void",
        description: "The dragged goal in world units, and null on release.",
      },
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
      view("front", "machine"),
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
      {
        name: "interactive",
        type: "boolean",
        default: "false",
        description:
          "Press and drag inside the frame to send the tool there; release and it eases back into its behaviour. Hover is not available on a touch screen, so this is how one drives it.",
      },
      {
        name: "onTargetChange",
        type: "(target: Vec2 | null) => void",
        description: "The dragged goal in world units, and null on release.",
      },
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
        name: "behavior",
        type: `"wander" | "scan" | "still"`,
        default: `"wander"`,
        description:
          "What the eyes do with no pointer and no look: drift about, sweep side to side, or hold still. The head breathes either way.",
      },
      { name: "speed", type: "number", default: "0.18", description: "Wander cycles per second." },
      {
        name: "interactive",
        type: "boolean",
        default: "true",
        description: "Flinch when poked: the head recoils and the eyes drop, decaying out over about a second.",
      },
      { name: "onPoke", type: "() => void", description: "Fired on the press that starts a flinch." },
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
      {
        name: "pauseOnHover",
        type: "boolean",
        default: "false",
        description:
          "Stop the cycle while the pointer is over the cell — the one thing anyone wants to do to a loading animation.",
      },
      { name: "label", type: "string", description: "Caption under the cell." },
      ...form.slice(0, 2),
      ...palette,
    ],
    notes: ["Front elevation is the drawing it always had. The bed\u2019s depth and the section of the two columns and the beam are what the elevation never had to show, and they appear as the camera comes round.", "The machine is modelled in world units, so a view is only a change of projection. `iso` is its own axonometric, which `spin` and `tilt` steer; the other three are the shared orthographic cameras and ignore both.", "Plan view is the identity projection. The column, the two link decks and the spindle only have heights once the camera comes down off the vertical \u2014 the same geometry, not a second drawing.", 
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
      {
        name: "playable",
        type: "boolean",
        default: "false",
        description:
          "Show a Run button that drives `program` into `onAnglesChange`, frame by frame. Moving a slider stops it: whoever has a hand on the machine has control of it.",
      },
      {
        name: "program",
        type: "(clock: number, limits: [number, number][]) => number[]",
        description:
          "Joint angles at `clock` seconds. Defaults to a sweep of every joint, each a little out of step with the last.",
      },
      { name: "speed", type: "number", default: "0.2", description: "Program cycles per second." },
      {
        name: "playing / onPlayingChange",
        type: "boolean / (playing: boolean) => void",
        description: "Control the Run state yourself, or just watch it.",
      },
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
    slug: "use-robot-motion",
    item: "use-robot-motion",
    title: "useRobotMotion",
    summary:
      "The clock every machine runs on and the handle you grab it by: a rate-limited scalar, pointer-capture dragging, and keyboard steps — all parked by a reduced-motion preference.",
    group: "Foundations",
    files: ["hooks/use-robot-motion.ts"],
    usage: `const motion = useRobotScalar((clock) => Math.sin(clock * Math.PI * 2) * 90, {
  rate: 210,        // degrees per second on the way back
  hold: dragging,   // pin it while the pointer has it
  speed: 0.25,      // cycles per second
})

const dragging = useRobotDrag(svgRef, {
  enabled: interactive,
  onDrag: useCallback((unit) => setAngle(unit.x * 360 - 180), []),
})`,
    api: [
      {
        name: "useRobotClock",
        type: "(options?) => number",
        description:
          "Seconds \u00d7 speed since mount, offset by phase. Parks at phase when animation is off or reduced motion is preferred, and holds where it stands while paused.",
      },
      {
        name: "useRobotScalar",
        type: "(goal, options?) => { value, clock }",
        description:
          "One frame loop that advances the clock and rate-limits a value toward goal(clock). hold pins the value while the clock keeps running underneath, so releasing a grabbed machine eases back into the cycle instead of snapping to it.",
      },
      {
        name: "useRobotDrag",
        type: "(ref, options) => boolean",
        description:
          "Pointer capture on press, unit coordinates on every move, and the drag state back for the cursor. Pressing rather than hovering is what gives a touch device the same control a mouse has.",
      },
      {
        name: "approach",
        type: "(value, goal, step) => number",
        description: "The rate limiter itself. Pure, so a component can use it directly.",
      },
      {
        name: "arrowStep",
        type: "(key, step, large?) => number",
        description: "Arrow and page keys as a signed delta; zero for keys that are not ours.",
      },
      {
        name: "useReducedMotion",
        type: "() => boolean",
        description: "Subscribes to the preference, so a change takes effect without a reload.",
      },
    ],
    notes: [
      "Every uncontrolled robocn machine runs on this hook, which is why they all park together under a reduced-motion preference and all resume from where you left them.",
      "The goal is a function of the clock, so a behaviour is a pure function that can be sampled in a test at a fixed phase rather than driven by a timer.",
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
