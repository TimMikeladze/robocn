/**
 * What the docs site knows about each registry item: the copy, the props
 * table, and which source files to show. The registry itself stays the source
 * of truth for what ships; this is the reading material around it.
 *
 * `docs` is that reading material **joined onto the registry**: an item nobody
 * has written up still gets an entry, built from its own registry title and
 * description, so it appears on the landing page, in the docs index and in the
 * sitemap the day it ships. See `generated` at the bottom of this file.
 */

import registry from "../../registry.json"

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

const authored: DocEntry[] = [
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
    notes: ["Uncontrolled it patrols and sweeps its head; alert overrides whatever behavior says and stands it to guard. Pose it yourself and the stance is yours while the head keeps scanning.", "Front elevation is the drawing it always had. The barrel is round in plan and the legs are set round it rather than side by side, which is the thing one elevation could not say.", "The dome and the tool are controlled when you supply them and self-running when you do not — the usual rule. Pointer tracking beats the behaviour while the pointer is over it.", "All three series share one chassis API; the series changes panel geometry rather than character branding."],
  },
  {
    slug: "orb-droid", item: "orb-droid", title: "Orb droid", group: "Robots",
    summary: "A spherical rolling companion with a separately stabilized head, segmented drive shell, tracking optic, and antenna options.",
    files: ["components/ui/orb-droid.tsx"],
    usage: `import { OrbDroid } from "@/components/ui/orb-droid"

<OrbDroid behavior="roll" antenna="twin" />
<OrbDroid bodyAngle={72} headAngle={-18} look={{ x: 0.5, y: -0.2 }} />`,
    props: [
      view("front", "droid"),
      { name: "behavior", type: '"roll" | "rock" | "survey" | "static"', default: '"roll"', description: "What it does when neither angle is supplied: roll turns the shell and holds the head level, rock stays put, survey sweeps the optic." },
      { name: "speed", type: "number", default: "0.3", description: "Cycles per second: one revolution, one rock, one sweep." },
      { name: "bodyAngle", type: "number", description: "Controlled rotation of the segmented drive sphere in degrees. Omit to run behavior." },
      { name: "headAngle", type: "number", description: "Head steering in degrees, clamped to −65..65. Omit to run behavior." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in −1..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "Follow the page pointer while look is null." },
      { name: "antenna", type: '"single" | "twin" | "none"', default: '"twin"', description: "Communications mast configuration." },
      ...loop,
      ...droidForm,
    ],
    notes: ["Uncontrolled it rolls: the shell turns continuously and the head holds level, which is the mechanism a ball robot is built around. Supply bodyAngle or headAngle and that one channel is yours; supply both and the clock stops.", "A ball is the same circle from every angle, so the body needs no second drawing; the panelling on it is elevation artwork that foreshortens with the camera. The head is a dome, which only reads as one off the front.", "Body and head transforms are independent, so a rolling shell does not drag the stabilized cap around with it.", "Pointer tracking is isolated to this client component and can be disabled or overridden.", "The shell, head and optic carry data-body, data-head and data-optic hooks, so an outer animation loop can drive all three through the DOM without re-rendering the component."],
  },
  {
    slug: "bellows-droid", item: "bellows-droid", title: "Bellows droid", group: "Robots",
    summary: "A soft-shell pneumatic pod: a pleated dome that inflates and settles on a volume-conserving profile, carrying its lens pods and vent with it.",
    files: ["components/ui/bellows-droid.tsx"],
    usage: `import { BellowsDroid } from "@/components/ui/bellows-droid"

<BellowsDroid inflation={0.8} pleats={7} aperture="iris" interactive />`,
    props: [
      view("front", "pod"),
      { name: "inflation", type: "number", description: "Controlled fill, 0 flat and wide to 1 full and tall. Omit and the bellows runs itself." },
      { name: "behavior", type: '"breathe" | "settle" | "startle" | "static"', default: '"breathe"', description: "Breathe is a slow sine; settle fills over three quarters of the cycle and dumps in the last quarter; startle sits full and loses most of it twice a cycle." },
      { name: "speed", type: "number", default: "0.28", description: "Breaths per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "The crown is the handle: drag it up and down, or focus it and use the arrows. Release eases back into the behaviour at the shell's own fill rate." },
      { name: "onInflationChange", type: "(inflation: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "pleats", type: "number", default: "7", description: "Seams gathered into the crown, clamped to 4..12." },
      { name: "optics", type: '"pair" | "single" | "none"', default: '"pair"', description: "Lens pods set through the shell. They ride it: filling the pod lifts them and brings them together." },
      { name: "aperture", type: '"grille" | "iris" | "none"', default: '"grille"', description: "The vent between the optics. It opens with the shell, because it is what the bellows breathes through." },
      ...droidForm,
    ],
    notes: [
      "The shell is the mechanism: there are no joints. Height and radius are tied so radius squared times height never changes, which is the volume of the solid of revolution up to the profile's fixed shape factor — filling it makes it taller and narrower.",
      "One geometry, four cameras. The silhouette is the convex hull of the projected surface, which is exact for a convex solid of revolution; the pleats are meridians on that same surface and are drawn only while they face you. A body of revolution has the same outline from the front and the side — what changes off-axis is which pleats you see and whether there is a face to see at all.",
      "Solved: the volume-conserving profile, the projection, the hidden-line pass on the pleats and the panels. Illustrated: the crown gather and the pleat twist, which are shaped to read rather than derived from a fold pattern. There is no pressure, material, or fold-count model.",
      "An original soft-robotics archetype. The vent is a vent and the patches beside it are louvred intakes, not a face.",
    ],
  },
  {
    slug: "robot-avocado", item: "robot-avocado", title: "Robot avocado", group: "Robots",
    summary: "A split-shell specimen pod: one body of revolution cut in half, tilting apart on a rod under the machine, with the stone riding up out of the gap on a screw column.",
    files: ["components/ui/robot-avocado.tsx"],
    usage: `import { RobotAvocado } from "@/components/ui/robot-avocado"

<RobotAvocado open={0.7} bearing={24} interactive />`,
    props: [
      view("front", "pod"),
      { name: "open", type: "number", description: "Controlled shell opening, 0 shut to 1 wide. Omit and the shell runs itself." },
      { name: "behavior", type: '"present" | "ajar" | "scan" | "static"', default: '"present"', description: "Present opens, holds the stone up and shuts; ajar never opens more than a crack; scan holds it half open while the optic works the room." },
      { name: "speed", type: "number", default: "0.24", description: "Open-and-shut cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag either way out of the middle to part the shell, or focus it and use the arrows: 10 per cent a press, 25 with shift, Home and End shut and wide. Release eases back into the behaviour." },
      { name: "onOpenChange", type: "(open: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "bearing", type: "number", description: "Where the stone's optic is aimed, in degrees off the face, clamped to ±180. Omit and the behaviour aims it." },
      { name: "stone", type: '"optic" | "core" | "none"', default: '"optic"', description: "What sits in the socket: a lens on the polished core, the bare core, or an empty socket." },
      ...droidForm,
    ],
    notes: [
      "The cut is the mechanism. The two halves are the same surface of revolution, so shutting them reassembles it exactly; the interior is the section polygon of the shell's inner surface, drawn only while it faces the camera, and the wall between the two is what makes an open half read as a bowl.",
      "The stone and its column are painted behind both halves, so what you see of them is only what the gap actually exposes — shut, the reassembled shell covers them completely.",
      "One geometry, four cameras. Solved: the profile, the split, the hinge, the projection and the hidden-surface pass on the cut faces, the optic and the speckle. Illustrated: the polish highlight on the stone and the speckle pattern itself, which sits on the surface but means nothing.",
      "An original field-unit archetype. There is no crop, ripeness or handling model: the shell opens because `open` said so.",
    ],
  },
  {
    slug: "robot-strawberry", item: "robot-strawberry", title: "Robot strawberry", group: "Robots",
    summary: "A berry-shelled field unit: sensor studs placed by the golden angle over equal areas of its own skin, running out along their own normals under a calyx of rigid blades.",
    files: ["components/ui/robot-strawberry.tsx"],
    usage: `import { RobotStrawberry } from "@/components/ui/robot-strawberry"

<RobotStrawberry bloom={0.8} seeds={32} blades={6} interactive />`,
    props: [
      view("front", "berry"),
      { name: "bloom", type: "number", description: "Controlled bloom, 0 furled and seated to 1 splayed and run out. Omit and the calyx runs itself." },
      { name: "behavior", type: '"unfurl" | "probe" | "furl" | "static"', default: '"unfurl"', description: "Unfurl opens, works and furls again; probe works the middle of the range with the studs never fully seated; furl stays shut bar the two moments it cracks open." },
      { name: "speed", type: "number", default: "0.26", description: "Open-and-furl cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to work the calyx, or focus it and use the arrows: 5 per cent a press, 15 with shift, Home and End furled and splayed." },
      { name: "onBloomChange", type: "(bloom: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "seeds", type: "number", default: "26", description: "Studs on the skin, clamped to 10..48. They are placed by the golden angle over equal areas of surface, so raising the count fills the same skin more finely rather than crowding the top." },
      { name: "blades", type: "number", default: "6", description: "Calyx blades, clamped to 3..9." },
      ...droidForm,
    ],
    notes: [
      "The lattice is spaced by surface area, not by the profile's parameter: the cumulative area is integrated along the meridian and stepped through evenly, which is what keeps the studs the same distance apart on a body whose radius changes all the way up.",
      "Each stud extends along its own surface normal, and is drawn only while that normal faces the camera — so half the skin is honestly missing from every elevation, and it is the studs near the crown that survive into plan view.",
      "The calyx blades are rigid: their length is exact at every pitch, and they are projected as planar quads rather than redrawn per angle.",
      "Solved: the profile, the lattice, the normals, the blade hinge, the projection and the hidden-line pass. Illustrated: the pit each stud sits in, and the shoulder line. There is no crop or ripeness model — nothing here senses anything.",
    ],
  },
  {
    slug: "robot-tomato", item: "robot-tomato", title: "Robot tomato", group: "Robots",
    summary: "A truss-hung crop unit on a two-hinge peduncle, with a lobed shell and a ripening front that is coverage of the surface rather than a colour ramp.",
    files: ["components/ui/robot-tomato.tsx"],
    usage: `import { RobotTomato } from "@/components/ui/robot-tomato"

<RobotTomato swing={18} ripeness={0.7} lobes={6} interactive />`,
    props: [
      view("front", "fruit"),
      { name: "swing", type: "number", description: "Controlled swing off plumb in degrees, clamped to ±34. Omit and it swings itself." },
      { name: "behavior", type: '"sway" | "settle" | "sort" | "static"', default: '"sway"', description: "Sway is a slow pendulum; settle is a knock swinging itself off over the cycle; sort takes it over to one side and holds it there to be picked." },
      { name: "speed", type: "number", default: "0.3", description: "Swings per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to swing it — the fruit follows the pointer from every camera — or focus it and use the arrows: 5 degrees a press, 15 with shift, Home plumb and End hard over." },
      { name: "onSwingChange", type: "(swing: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "ripeness", type: "number", default: "0.72", description: "How far the ripening front has climbed, 0 at the blossom end to 1 at the shoulder. The skin still to turn wears the accent colour." },
      { name: "lobes", type: "number", default: "6", description: "Meridian furrows cut into the shell, clamped to 4..9. The furrows are a radius modulation, so they are where the surface actually is." },
      { name: "sepals", type: "number", default: "5", description: "Sepals hinged on the crown, clamped to 0..8." },
      ...droidForm,
    ],
    notes: [
      "It hangs. The swing angle is shared between two hinges — the clamp takes three fifths of it and the knuckle the rest — so the peduncle droops rather than pivoting as a stick, and both link lengths are held exactly by the rotation at every angle.",
      "The ripening front is coverage: the unturned skin is the cap of the surface above a latitude, and its boundary is the near half of a real ring on the body, so it curves the way the fruit does. Looking straight down, the visible skin is the shoulder, and the front is drawn only once it has climbed past the belt.",
      "Solved: the profile and its lobing, the two-hinge chain, the ripening latitude and its near arc, the projection and the hidden-line pass on the furrows, sepals and port. Illustrated: the inspection port's slots and the clamp.",
      "No crop, ripeness, mass or pendulum model. The swing is a shaped number rather than a solved pendulum with a length, and the fruit ripens because `ripeness` said so.",
    ],
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

<SecurityDroid behavior="patrol" />
<SecurityDroid pose="guard" alert look={{ x: -0.4, y: 0 }} headAngle={-20} />`,
    props: [
      view("front", "droid"),
      { name: "behavior", type: '"patrol" | "alert" | "idle" | "static"', default: '"patrol"', description: "The beat it walks when it is not posed. Alert stands it to guard and shortens the scan." },
      { name: "speed", type: "number", default: "0.35", description: "Cycles per second: one sweep of the head." },
      { name: "pose", type: '"stand" | "patrol" | "guard"', description: "Whole-frame stance and arm position. Omit and behavior picks one." },
      { name: "headAngle", type: "number", description: "Head rotation in degrees, clamped to −70..70. Omit to run behavior." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled horizontal sensor aim; overrides tracking." },
      { name: "track", type: "boolean", default: "true", description: "Follow the page pointer while look is null." },
      { name: "alert", type: "boolean", default: "false", description: "Light the alert beacon, promote the sensor colour, and stand it to guard." },
      ...loop,
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
    slug: "robot-hound", item: "robot-hound", title: "Robot hound", group: "Robots",
    summary: "A boxy companion tracker with no legs at all: a wedge chassis on a concealed drive, and a head carried out in front of it on a concertina neck that one attention number runs.",
    files: ["components/ui/robot-hound.tsx"],
    usage: `import { RobotHound } from "@/components/ui/robot-hound"

<RobotHound behavior="seek" ears="dish" probe="whip" onAttentionChange={setAttention} />`,
    props: [
      view("profile", "hound"),
      { name: "attention", type: "number", description: "How alert it is, 0 stowed to 1 up on the scent. Supplying it stops the loop; the neck, head, ears, probe and visor all ride it either way." },
      { name: "behavior", type: '"seek" | "alert" | "idle" | "static"', default: '"seek"', description: "Seek casts the head the full width of the ground ahead of it; alert holds the head up with a tremor; idle settles it back onto its skirt." },
      { name: "speed", type: "number", default: "0.3", description: "Cycles per second: one cast of the head, one breath of the idle." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag up and down to bring its head up, or use the arrow keys; Home stows it and End puts it on the scent. Release eases it back into the behaviour." },
      { name: "onAttentionChange", type: "(attention: number) => void", description: "The attention a drag or a key moved it to, reported in controlled mode too." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled head aim in \u22121..1; overrides pointer tracking. The head turns without changing its posture." },
      { name: "track", type: "boolean", default: "true", description: "The head turns to the page pointer while look is null." },
      { name: "ears", type: '"dish" | "vane" | "none"', default: '"dish"', description: "The pair of sensor pods on the back of the head: splayed dishes, flat vanes, or nothing." },
      { name: "probe", type: '"whip" | "mast" | "none"', default: '"whip"', description: "The boom off the tail: a telescoping whip with a bulb, a rigid mast with a cross arm, or nothing." },
      { name: "keys", type: "number", default: "4", description: "Keypad columns across the deck, clamped to 3\u20138. Three rows either way." },
      { name: "skirt", type: '"flared" | "straight"', default: '"flared"', description: "A chassis that flares out to the floor, or straight sides." },
      ...droidForm,
    ],
    notes: [
      "Side elevation is the view it is drawn in. The chassis and the head are solids in world units \u2014 the chassis a frustum between two footprints, the head a box that pitches and yaws \u2014 so every angle is that one model projected: the head's outline is the hull of its own eight corners, and the ear dishes, the eye and the collar ribs are circles sampled in their own planes, which is why they are ellipses from anywhere else.",
      "Attention is the whole machine: the same number runs the collar out, lifts the nose, pricks and splays the ear dishes, raises the probe and lights the visor. The collar's ribs are rings on the live axis between the deck and the head, so their spacing is the extension rather than a drawn pleat, and the probe telescopes rather than bending \u2014 three sections of falling diameter with visible collars.",
      "Where it is looking is independent of how alert it is, so it can notice you from a stow: look and the pointer turn the head on the end of the collar without moving the collar.",
      "Illustrated, not simulated. There is no drive model, traction, mass or antenna pattern; the rollers turn on the clock rather than on any travel, and the hound detects nothing \u2014 the visor lights because attention told it to.",
      "An original archetype \u2014 a boxy companion tracker \u2014 not a character. The keypad is a keypad and carries no markings from a film.",
    ],
  },
  {
    slug: "guide-droid", item: "guide-droid", title: "Guide droid", group: "Robots",
    summary: "A rotor-lifted visitor guide whose hands and feet ride on coil springs, so one hover-height number flies it and stretches every limb at the same time.",
    files: ["components/ui/guide-droid.tsx"],
    usage: `import { GuideDroid } from "@/components/ui/guide-droid"

<GuideDroid behavior="beckon" blades={2} limbs="coil" onHeightChange={setHeight} />`,
    props: [
      view("front", "droid"),
      { name: "height", type: "number", description: "Hover height, 0 on the deck to 1 at altitude. Supplying it stops the loop; the springs stretch with it either way." },
      { name: "behavior", type: '"hover" | "beckon" | "settle" | "static"', default: '"hover"', description: "Hover station-keeps with a slow bob and a drift; beckon rises, waves a hand and talks; settle puts the weight back on its feet." },
      { name: "speed", type: "number", default: "0.4", description: "Hover cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag it up and down to fly it, or use the arrow keys; Home is the deck and End the ceiling. Release eases it back into the behaviour." },
      { name: "onHeightChange", type: "(height: number) => void", description: "The hover height a drag or a key moved it to, reported in controlled mode too." },
      { name: "rotorAngle", type: "number", description: "Controlled blade angle in degrees. Omit and the rotor turns on the clock." },
      { name: "voice", type: "number", description: "Lit bars in the speaker grille, 0–1, filling out from the middle. Omit and the behaviour works it." },
      { name: "blades", type: "number", default: "2", description: "Rotor blades, clamped to 2–6." },
      { name: "limbs", type: '"coil" | "strut"', default: '"coil"', description: "Hands and feet on coil springs, or on rigid two-part struts with a visible knuckle." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in −1..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "The ring optics follow the page pointer while look is null." },
      ...droidForm,
    ],
    notes: ["Front elevation is the view it is drawn in. The shell and the body are surfaces of revolution and the rotor is a disc, so off that axis they are projected solids rather than second drawings; the face is elevation artwork and goes edge-on in profile, which is what a face does.", "Lift is the whole machine: the same number raises the airframe and sets the spring extension, because a machine hanging in the air puts its limbs in tension and one sitting on its feet puts them in compression.", "Illustrative, not simulated: there is no thrust, mass, drag or spring constant, the sway is a drift term rather than an integrated acceleration, and the rotor is drawn rather than solved. Thrust shows in the wash ring, not the blade rate, so the blades never run backwards.", "The grille is a speaker: voice lights bars because it was told to. Nothing here infers state or starts a timer.", "An original archetype — a rotor-lifted guide companion — not a character."],
  },
  {
    slug: "custodian-droid", item: "custodian-droid", title: "Custodian droid", group: "Robots",
    summary: "A floating armoured custodian whose shell comes apart: armour segments on radial rails that bloom into a corona around a lit chassis, with a gimballed optic behind a bracket cage.",
    files: ["components/ui/custodian-droid.tsx"],
    usage: `import { CustodianDroid } from "@/components/ui/custodian-droid"

<CustodianDroid behavior="survey" plates={6} onOpenChange={setOpen} />`,
    props: [
      view("front", "droid"),
      { name: "open", type: "number", description: "The shell, 0 seated to 1 run all the way out. Supplying it stops the loop; the rails extend with it either way." },
      { name: "behavior", type: '"watch" | "survey" | "alert" | "static"', default: '"watch"', description: "Watch keeps the armour seated and station-keeps; survey runs the shell half out and breathes it; alert throws it wide, floats tight and fast, and talks." },
      { name: "speed", type: "number", default: "0.3", description: "Cycles per second: one float, one sweep of the room." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag across it to work the shell, or use the arrow keys; Home seats the armour and End runs it wide. Release eases it back into the behaviour." },
      { name: "onOpenChange", type: "(open: number) => void", description: "The opening a drag or a key moved the shell to, reported in controlled mode too." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in \u22121..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "The optic follows the page pointer while look is null." },
      { name: "voice", type: "number", description: "Lit cells in the ring round the lens, 0\u20131, filling out from the middle. Omit and the behaviour works it." },
      { name: "plates", type: "number", default: "6", description: "Armour segments in the shell, clamped to 4\u201310. The segments are cut from the casing outline, so a higher count is finer armour rather than a bigger machine." },
      ...droidForm,
    ],
    notes: [
      "Front elevation is the view it is drawn in. Every part is modelled once in world units \u2014 across the face, down it, and out of it \u2014 and projected, so the tipped cameras show real depth: how far the plates stand off the chassis, the rails between them, the cage standing proud of the lens. In profile and plan the face artwork is edge-on and gone, which is what a face looks like from the side.",
      "The shell is the mechanism. Each armour segment is a wedge of the casing outline riding its own rail, and the front edge travels further than the back, so opening blooms the corona rather than only dilating it. The lattice on the chassis is lit under the armour and shows through the gaps as the segments part.",
      "The optic is a body, not a pupil: it yaws and pitches about a pivot behind its own face, so aiming it foreshortens the bezel and slides the glass across the recess. It stays level while the shell rolls with the machine's drift, the way a gimballed optic does.",
      "Illustrative, not simulated: there is no thrust, mass or repulsor field, the float and roll are drift terms, the rails carry no stroke load, and there is no optics model \u2014 no exposure, no focus. Nothing infers state or starts a timer: voice lights cells because it was told to.",
      "An original archetype \u2014 a floating custodian unit \u2014 not a character. No franchise name, markings or paint scheme; the defaults are the theme's.",
    ],
  },
  {
    slug: "sentinel-console", item: "sentinel-console", title: "Sentinel console", group: "Robots",
    summary: "A bulkhead-mounted watch station: a gimballed optic behind a solved iris diaphragm, an identity strip, and a voice grille. The one machine in the set that is part of the ship rather than standing on the deck.",
    files: ["components/ui/sentinel-console.tsx"],
    usage: `import { SentinelConsole } from "@/components/ui/sentinel-console"

<SentinelConsole behavior="watch" blades={8} plate="SENTINEL 7" onApertureChange={setAperture} />`,
    props: [
      view("front", "console"),
      { name: "aperture", type: "number", description: "The opening, 0 a pinhole to 1 wide. Supplying it stops the loop; the blades are solved from it either way." },
      { name: "behavior", type: '"watch" | "listen" | "speak" | "alert" | "static"', default: '"watch"', description: "Watch holds a bearing and swings to the next; listen opens the iris and all but stops; speak runs the grille; alert stops down hard and snaps between bearings." },
      { name: "speed", type: "number", default: "0.22", description: "Cycles per second: one sweep of the room, one burst of speech." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag across the lens to work the iris, or use the arrow keys; Home closes it and End opens it. Release eases it back into the behaviour." },
      { name: "onApertureChange", type: "(aperture: number) => void", description: "The opening a drag or a key moved it to, reported in controlled mode too." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in \u22121..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "The optic follows the page pointer while look is null." },
      { name: "voice", type: "number", description: "Lit cells in the voice grille, 0\u20131, filling out from the middle. Omit and the behaviour works it." },
      { name: "blades", type: "number", default: "8", description: "Leaves in the diaphragm, clamped to 4\u201310." },
      { name: "plate", type: "string", default: '"SENTINEL"', description: "The identity strip across the top of the console." },
      { name: "showBulkhead", type: "boolean", default: "true", description: "Draw the bulkhead plate the console is set into." },
      ...form.slice(0, 2),
      { name: "signal", type: '"idle" | "ready" | "warning"', default: '"ready"', description: "The lamp on the identity strip: neutral, accent, or shell colour." },
      { name: "label", type: "string", description: "Optional technical caption under the drawing." },
      ...palette,
    ],
    notes: [
      "Front elevation is the view it is drawn in. The console is modelled once as solids in world units \u2014 across the face, down it, and out of the wall \u2014 and projected, so the tipped cameras show real depth: how far the bezel stands proud, the speaker box behind the grille, the conduit into the back of the housing. In profile and plan the face is edge-on and its artwork is gone, which is what a wall fixture looks like from the side.",
      "The iris is solved. Each blade pivots about a pin on a fixed ring and carries a circular working edge, so the bore is the law of cosines in the blade swing, run backwards from the opening you asked for; the blades are drawn from that solution and overlap the way real ones do.",
      "The optic is a body, not a pupil: it yaws and pitches about a pivot behind its own face, between two visible trunnions, so turning it foreshortens the bezel and slides the glass across it.",
      "Everything else is illustrated. There is no optics model \u2014 the aperture changes no exposure and no depth of field \u2014 and the gimbal has no actuator or mechanical stops beyond the clamp on look. Nothing here listens, speaks or infers a state: voice lights cells because it was told to.",
      "An original archetype \u2014 a ship's sentinel console \u2014 not a character. The identity strip is generic by default and carries no name from a film.",
    ],
  },
  {
    slug: "pylon-droid", item: "pylon-droid", title: "Pylon droid", group: "Robots",
    summary: "A deployable survey pylon: stowed it is a sharp triangular plate with every limb folded inside its own outline, and one deploy number stands it up on a tripod with its apex cap lifted off a lit core.",
    files: ["components/ui/pylon-droid.tsx"],
    usage: `import { PylonDroid } from "@/components/ui/pylon-droid"

<PylonDroid behavior="deploy" stance="wide" onDeployChange={setDeploy} />

// Or hold it wherever you want it — controlled always wins.
<PylonDroid deploy={0.35} view="iso" />`,
    props: [
      view("front", "pylon"),
      { name: "deploy", type: "number", description: "0 stowed flat, 1 standing. Supplying it stops the loop. It is the whole machine: the chassis rise, the leg solve, the strut swing and the cap lift all come off this one number." },
      { name: "behavior", type: '"deploy" | "survey" | "stow" | "static"', default: '"deploy"', description: "Deploy stands up, holds the station and sits back down; survey stays up breathing and panning; stow lies dormant on the deck." },
      { name: "speed", type: "number", default: "0.22", description: "Deployment cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag it up and down to raise it, or use the arrow keys; Home stows it and End stands it up. Release eases it back into the behaviour." },
      { name: "onDeployChange", type: "(deploy: number) => void", description: "The deployment a drag or a key moved it to, reported in controlled mode too." },
      { name: "stance", type: '"narrow" | "wide"', default: '"narrow"', description: "How far out the feet plant once it is standing. Wide is five units further, which is as far as the legs reach." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in −1..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "The apex optic follows the page pointer while look is null." },
      ...droidForm,
    ],
    notes: ["Front elevation is the view it is drawn in, because the plate is the machine and the plate faces you. The faces and their panel detail ride the elevation plane and go edge-on in profile, which is what a plate seen from the side does; the plate solid off that axis is the convex hull of its two faces, which is exact for a prism.", "Stowed, every limb is inside the triangle: the legs fold until the knee lands on the hypotenuse, the aft strut lies up the back face, and the cap sits shut on the core. The limbs are drawn behind the plate, so solid shows the bare outline and outline and wire show the stowed mechanism through it.", "The legs are solved — two-link law of cosines, the knee breaking outward in stowage as much as in stance, an out-of-reach foot clamped onto the leg rather than failing — and the strut's planted angle is acos(-(hinge + rise) / strut) rather than a tuned number.", "Illustrated, not simulated: the mast is a rail pair rather than a modelled screw, the waist loom is a curve, and there is no mass, balance or ground reaction anywhere. It stands; it does not walk.", "An original archetype — a survey pylon that stands itself up — named for the job. No franchise, no logo, no paint scheme."],
  },
  {
    slug: "monolith-droid", item: "monolith-droid", title: "Monolith droid", group: "Robots",
    summary: "A slab-bodied walker with no limbs: a rectangular column sliced into parallel slabs, each hinged at its own top face, that splay into a braced stance and stride half a cycle apart.",
    files: ["components/ui/monolith-droid.tsx"],
    usage: `import { MonolithDroid } from "@/components/ui/monolith-droid"

<MonolithDroid behavior="walk" slabs={4} onSplayChange={setSplay} />`,
    props: [
      view("front", "column"),
      { name: "splay", type: "number", description: "How far the column is open, 0 closed into one solid block to 1 braced. Supplying it stops the loop; the hinge angles are worked from it either way." },
      { name: "behavior", type: '"walk" | "unfold" | "brief" | "static"', default: '"walk"', description: "Walk strides at a working splay with alternate slabs half a cycle apart; unfold opens and closes the column with the slabs still; brief stands near-closed and runs the readout." },
      { name: "speed", type: "number", default: "0.5", description: "Cycles per second: one footfall pair, or one open and close." },
      ...loop,
      { name: "interactive", type: "boolean", default: "true", description: "Drag across it to pull the column open and closed, or use the arrow keys; Home closes it and End opens it. Release eases it back into the behaviour." },
      { name: "onSplayChange", type: "(splay: number) => void", description: "The opening a drag or a key moved it to, reported in controlled mode too." },
      { name: "stride", type: "number", description: "Controlled footfall phase, 0–1. Omit and the behaviour works the gait." },
      { name: "panel", type: "number", description: "Lit rows in the readout, 0–1, filling from the top. Omit and the behaviour works it." },
      { name: "lean", type: "number", description: "Whole-body tilt in degrees, clamped to ±14. Omit and the behaviour works it." },
      { name: "slabs", type: "number", default: "4", description: "Slabs in the column, clamped to 3–6. The camera pulls back so a wider column still fits the frame." },
      ...droidForm,
    ],
    notes: [
      "Front elevation is the view it is drawn in. Every part is a cuboid in world units, and a face is drawn only when its rotated normal points at the camera, back to front by depth — so plan view is four end caps, front is the broad faces with a sliver of cap above them, and iso shows two faces of every slab.",
      "Face artwork — the collar, the seams, the pin holes, the readout — is drawn in the face's own world units under the affine matrix built from the projected face basis. A pin hole is a real circle on a real face, so it comes out as the right ellipse from every angle and collapses to a line when the face goes edge-on.",
      "No solver, and none is pretended: a slab is a rigid body on a one-axis hinge, so the pose is two rotations and a rise per slab. The gait is a scripted footfall cycle with no mass, balance or support polygon behind it — a closed column with a stride on it will walk on something that could not stand.",
      "The readout lights rows because it was told to. Nothing here reports a state or starts a timer.",
      "An original archetype — a slab walker — not a character. It carries no wordmark, insignia or paint scheme, and the label is the caller's.",
    ],
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
    slug: "animatronic-face", item: "animatronic-face", title: "Animatronic face", group: "Robots",
    summary: "An expressive humanoid head where every feature is a servo: paired brows, lids, cheeks and lip corners, a hinged jaw, and nine expressions that blend rather than swap.",
    files: ["components/ui/animatronic-face.tsx"],
    usage: `import { AnimatronicFace } from "@/components/ui/animatronic-face"

<AnimatronicFace behavior="converse" />

// An expression is a blend, so intensity is a real dial, not a fade.
<AnimatronicFace expression="doubt" intensity={0.6} showActuators />

// Or drive a servo yourself; it wins over the expression.
<AnimatronicFace expression="joy" channels={{ jaw: 0.4, left: { browOuter: -0.8 } }} />`,
    props: [
      view("front", "head"),
      { name: "expression", type: '"neutral" | "joy" | "surprise" | "sorrow" | "anger" | "fear" | "disgust" | "doubt" | "sleep"', description: "Which expression the rig drives toward. Omit and the behavior picks one." },
      { name: "intensity", type: "number", default: "1", description: "How far it drives there, clamped to 0–1. The whole channel vector scales, so half a smile is a different face rather than a faded one." },
      { name: "behavior", type: '"idle" | "converse" | "listen" | "emote" | "static"', default: '"idle"', description: "What the head does with anything you have not supplied: breathe and glance about, talk, attend to you, or walk the whole expression set." },
      { name: "speed", type: "number", default: "0.3", description: "Cycles per second." },
      ...loop,
      { name: "blink", type: "number", description: "Lid closure over the expression, clamped to 0–1. Omit and it blinks on an irregular cycle of its own." },
      { name: "speech", type: "number", description: "Speech level, clamped to 0–1: opens the jaw and slackens the lips on top of whatever the face is holding." },
      { name: "yaw / pitch / roll", type: "number", description: "Neck angles in degrees, clamped to ±34, ±28, ±26. Omit and the head turns toward the pointer." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Pupil aim in −1..1 on both axes. Set it to drive the gaze; leave it null to track the pointer." },
      { name: "track", type: "boolean", default: "true", description: "Follow the pointer anywhere on the page while look is null." },
      { name: "interactive", type: "boolean", default: "true", description: "Turn the head toward the pointer, and react when clicked — a start, a blink, and a warming toward pleased." },
      { name: "onReact", type: "() => void", description: "Fired on the click that starts a reaction." },
      { name: "channels", type: "Partial<FaceChannels>", description: "Drive individual servos: jaw, lipPress, lipPucker, noseWrinkle, and a left / right object each carrying browInner, browOuter, lidUpper, lidLower, cheek and lipCorner. These win over the expression." },
      { name: "showActuators", type: "boolean", default: "false", description: "Draw the sixteen push-rods from the frame ring to the parts they drive." },
      { name: "showNeck", type: "boolean", default: "true", description: "Neck column and shoulder plate under the head." },
      { name: "showGround", type: "boolean", default: "true", description: "Contact shadow." },
      { name: "geometry", type: "Partial<HeadGeometry>", description: "Override the skull half-axes, the servo gain, or the stroke the servos have." },
      { name: "label", type: "string", description: "Caption under the head." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Nothing in the drawing branches on an expression name. Every expression resolves to the same ten-channel vector — six of them paired left and right — and the face reads channels, which is why intensity, blink and speech compose instead of one winning.",
      "The skull is an ellipsoid and its silhouette is projected exactly: composing the camera, the neck rotation and the radii gives a 2×3 matrix whose shape matrix eigen-decomposes into one ellipse. Four cameras, no per-angle artwork.",
      "Features are curves drawn in the face's own chart and pushed onto that surface, so the brow wraps the temple and the far eye turns away by itself. A patch whose normal points away from the camera fades out — which is why the face is gone in plan view, looking at the crown.",
      "The jaw is a hinge on a real axis through the ear servos, and the lower lip rides the jaw plate, so the mouth opens because the mechanism moved rather than because a second mouth was drawn.",
      "showActuators draws one rod per servo and paints it in the accent colour when it runs out of stroke. The component clamps its own inputs, so the only way to see a fault is to tighten geometry.travel.",
      "Gaze is illustrated, not solved — the eyes are discs on the surface, not a solved eyeball in a socket. Everything else the rig reports is a channel value the drawing is bound to.",
    ],
  },
  {
    slug: "face-actuation", item: "face-actuation", title: "Face actuation", group: "Foundations",
    summary: "The rig behind the animatronic face: ten servo channels, nine blendable expressions, per-servo stroke against travel, and the ellipsoid maths that puts a feature on a skull.",
    files: ["lib/robocn/face.ts"],
    usage: `import { blendFace, faceShape, solveFace, onFace, ellipsoidOutline } from "@/lib/robocn/face"

const solution = solveFace({ expression: "doubt", intensity: 0.7, speech: 0.4 })
solution.left.browOuter   // the left brow's servo
solution.actuators        // id, value, stroke, travel, withinLimits
solution.withinLimits     // false when any servo ran out of stroke

// Expressions mix channel by channel, which is what an ease between them is.
const halfway = blendFace(faceShape("neutral"), faceShape("joy"), 0.5)`,
    api: [
      { name: "solveFace", type: "(input?: FaceInput, geometry?: HeadGeometry) => FaceSolution", description: "Expression scaled by intensity, then blink and speech added on top, then explicit channels last. Every channel is clamped, and each one reports its servo stroke." },
      { name: "faceShape", type: "(expression: FaceExpression) => FaceChannels", description: "The full-intensity channel vector for one of the nine expressions. Six channels are paired, so doubt can raise one brow and level the other." },
      { name: "blendFace", type: "(a: FaceChannels, b: FaceChannels, t: number) => FaceChannels", description: "Channel-by-channel mix. An ease between expressions is this, not a cross-fade of two drawings." },
      { name: "onFace", type: "(x: number, y: number, radii: Vec3, outset?: number) => Vec3", description: "Solves the ellipsoid for z, so a feature placed on the front elevation lands on the skull. Outside the silhouette it lands on the equator rather than returning NaN." },
      { name: "ellipsoidOutline", type: "(radii: Vec3, pose: HeadPose, camera: RobotCamera, center?: Vec3) => EllipseOutline", description: "The exact silhouette of an ellipsoid under an orthographic camera: cx, cy, the two semi-axes and the tilt of the major one." },
      { name: "rotateHead", type: "(point: Vec3, pose: HeadPose) => Vec3", description: "Neck rotation in degrees, applied roll, then pitch, then yaw." },
      { name: "defaultHeadGeometry", type: "HeadGeometry", description: "Skull half-axes, servo gain in world units per unit of channel, and the stroke the servos have." },
    ],
    notes: [
      "A channel is a servo. Ten of them: browInner, browOuter, lidUpper, lidLower, cheek and lipCorner on each side, plus noseWrinkle, lipPress, lipPucker and jaw on the centreline.",
      "lidUpper is the one lid channel that runs both ways — a lid retracts past open, which is what makes surprise and fear read as wide-eyed rather than merely un-blinked.",
      "Blink takes the larger of itself and the expression's own lid rather than summing, because a lid cannot close twice; speech takes the larger jaw and slackens the lips, because a pressed mouth is not also speaking.",
      "Out-of-travel channels still return complete values with withinLimits false, so a UI draws the fault instead of handling an exception.",
    ],
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
    slug: "robot-dragonfly", item: "robot-dragonfly", title: "Robot dragonfly", group: "Robots",
    summary: "A four-winged flyer from above. Fore and hind pairs beat half a cycle apart, which is what lets it hold station, and a beating wing is foreshortened by the cosine of its own stroke angle rather than redrawn.",
    files: ["components/ui/robot-dragonfly.tsx"],
    usage: `import { RobotDragonfly } from "@/components/ui/robot-dragonfly"

<RobotDragonfly behavior="hover" />

// Or drive the beat, the yaw and the abdomen yourself.
<RobotDragonfly phase={0.25} swing={1} heading={-30} curl={0.5} altitude={0.8} />`,
    props: [
      view("plan", "flyer"),
      { name: "behavior", type: '"hover" | "dart" | "perch" | "static"', default: '"hover"', description: "What it does when phase is not supplied: hold station, burst about, or sit with the wings out and the abdomen hooked under." },
      { name: "phase", type: "number", description: "Controlled wingbeat fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "4", description: "Wingbeats per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a swarm breaks step." },
      ...gaitLoop(),
      { name: "swing", type: "number", description: "Stroke amplitude, 0 wings held flat to 1 the full beat. Omit and the behavior sets it." },
      { name: "curl", type: "number", description: "Abdomen curl out of the wing plane, 0 straight to 1 hooked under. Omit and the behavior sets it." },
      { name: "heading", type: "number", description: "Body yaw in degrees, clamped to −70..70. Omit and it turns toward the pointer." },
      { name: "altitude", type: "number", description: "Height above the ground, 0–1. Omit and the behavior decides." },
      { name: "segments", type: "number", default: "9", description: "Links in the abdomen, clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "It yaws toward the pointer, and a click sends it off in a dart that decays." },
      { name: "onDart", type: "() => void", description: "Fired on the click that starts a dart." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground shadow, and the reed it perches on." },
      { name: "label", type: "string", description: "Caption underneath the flyer." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Plan view is the identity projection. Off-axis the wings stand at their real stroke angle and the body is a chain of tubes — the two things the plan can only imply.", "Fore and hind wings carry a fixed half-cycle offset. That is the mechanism, not a decoration: it is what a dragonfly does instead of bobbing through every stroke.", "The wing plate is an illustrated membrane on a solved projection — the foreshortening is real, the venation is drawn. The abdomen is the spine solver."],
  },
  {
    slug: "robot-bat", item: "robot-bat", title: "Robot bat", group: "Robots",
    summary: "A membrane flyer in profile. Four finger struts fan off the wrist of a three-link arm and the skin is drawn through their tips, so furling and beating deform one surface instead of swapping artwork.",
    files: ["components/ui/robot-bat.tsx"],
    usage: `import { RobotBat } from "@/components/ui/robot-bat"

<RobotBat behavior="roost" />

// Or drive the beat and the posture yourself.
<RobotBat phase={0.3} spread={1} flight={1} headAngle={-20} />`,
    props: [
      view("profile", "bat"),
      { name: "behavior", type: '"roost" | "flap" | "glide" | "static"', default: '"roost"', description: "What it does when phase is not supplied: hang furled from the beam, beat, or hold the skin out." },
      { name: "phase", type: "number", description: "Controlled wingbeat fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "2.2", description: "Wingbeats per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a colony breaks step." },
      ...gaitLoop(),
      { name: "spread", type: "number", description: "Wing extension, 0 furled against the body to 1 spread. Omit and the behavior sets it." },
      { name: "flight", type: "number", description: "0 hanging head-down from the beam, 1 airborne and the right way up. Omit and the behavior decides." },
      { name: "headAngle", type: "number", description: "Head turn in degrees, clamped to −40..40. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The head tracks the pointer, and a click drops it off the beam for a circuit before it climbs back." },
      { name: "onDrop", type: "() => void", description: "Fired on the click that starts a sortie." },
      { name: "showGround", type: "boolean", default: "true", description: "The roosting beam." },
      { name: "label", type: "string", description: "Caption underneath the bat." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Hanging and flying are one body rotated by flight, not two drawings. Everything is written for the flying pose and turned over into the roost.", "The membrane is the boundary the strut tips describe, with the scalloped trailing edge a bat actually has. Move a finger and the skin follows, because there is nothing else for it to follow.", "The wing is an angle-driven linkage rather than an inverse-kinematic solve: there is no target for a wing to reach."],
  },
  {
    slug: "robot-jellyfish", item: "robot-jellyfish", title: "Robot jellyfish", group: "Robots",
    summary: "A pulsing bell face on. One contraction number narrows it, deepens it and flares the rim together, and the tentacles hanging off that rim each run their own spine on a delay, so the curtain ripples.",
    files: ["components/ui/robot-jellyfish.tsx"],
    usage: `import { RobotJellyfish } from "@/components/ui/robot-jellyfish"

<RobotJellyfish behavior="pulse" arms={11} />

// Or drive the squeeze and the lean yourself.
<RobotJellyfish phase={0.2} contraction={0.85} lean={-0.6} />`,
    props: [
      view("front", "bell"),
      { name: "behavior", type: '"pulse" | "drift" | "bloom" | "static"', default: '"pulse"', description: "What it does when phase is not supplied: squeeze and coast, hang slack, or hold open and feed." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.5", description: "Contractions per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a bloom breaks step." },
      ...gaitLoop(),
      { name: "contraction", type: "number", description: "Bell contraction, 0 relaxed to 1 squeezed. Omit and the behavior works it." },
      { name: "arms", type: "number", default: "9", description: "Tentacles round the rim, clamped to 3–16." },
      { name: "segments", type: "number", default: "10", description: "Links in each tentacle, clamped to 3–24." },
      { name: "lean", type: "number", description: "Lean of the tentacle curtain, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The curtain leans toward the pointer, and a click contracts the bell hard." },
      { name: "onPulse", type: "() => void", description: "Fired on the click that contracts the bell." },
      { name: "showGround", type: "boolean", default: "true", description: "The water column marks behind it." },
      { name: "label", type: "string", description: "Caption underneath the bell." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The pulse is asymmetric on purpose: it squeezes in the first third of the cycle and relaxes over the rest, which is the part that makes it swim rather than flutter.", "Front elevation is the drawing it always had. Off-axis the rim comes out as the circle it is, with every tentacle mounted somewhere on it.", "The bell is an illustrated surface of revolution driven by one number — meridians, margin and all. The tentacles are the spine solver."],
  },
  {
    slug: "robot-manta", item: "robot-manta", title: "Robot manta", group: "Robots",
    summary: "A ray from above, whose travelling wave runs across the span instead of along the body: the wing root is station 0 and the tip is station 1, so a crest leaves the shoulder and arrives at the tip.",
    files: ["components/ui/robot-manta.tsx"],
    usage: `import { RobotManta } from "@/components/ui/robot-manta"

<RobotManta behavior="cruise" />

// Or drive the beat and the roll yourself.
<RobotManta phase={0.4} amplitude={0.7} bank={-0.8} waves={1.1} />`,
    props: [
      view("plan", "ray"),
      { name: "behavior", type: '"cruise" | "soar" | "bank" | "static"', default: '"cruise"', description: "What it does when phase is not supplied: a steady beat, wings held, or a long rolling turn." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.55", description: "Wingbeats per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a squadron breaks step." },
      ...gaitLoop(),
      { name: "amplitude", type: "number", description: "Peak wing swing, 0–1. Omit and the behavior sets it." },
      { name: "waves", type: "number", default: "0.85", description: "Wave crests along the span, clamped to 0.25–3." },
      { name: "bank", type: "number", description: "Roll, −1 to port and 1 to starboard. Omit and it banks toward the pointer." },
      { name: "segments", type: "number", default: "12", description: "Stations along each wing, clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "It banks toward the pointer, and a click surges." },
      { name: "onSurge", type: "() => void", description: "Fired on the click that starts a surge." },
      { name: "showGround", type: "boolean", default: "true", description: "The shadow on the seabed." },
      { name: "label", type: "string", description: "Caption underneath the ray." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Banking is a roll about the fore-aft axis, so in plan the span foreshortens by its own cosine and one tip rises as the other drops. The yaw comes out of the roll rather than being a second control.", "Plan view is the identity projection. Off-axis the wings are a chain of tubes at the heights the wave actually put them.", "Illustrative, like the rest: no thrust, no added mass, and the animal never leaves the middle of the frame."],
  },
  {
    slug: "robot-octopus", item: "robot-octopus", title: "Robot octopus", group: "Robots",
    summary: "A mantle and eight arms face on. Each arm is its own spine on its own phase, length and curl, and they are mounted on a ring round the mouth rather than fanned in a line.",
    files: ["components/ui/robot-octopus.tsx"],
    usage: `import { RobotOctopus } from "@/components/ui/robot-octopus"

<RobotOctopus behavior="crawl" arms={8} />

// Or drive the arms and the mantle yourself.
<RobotOctopus phase={0.3} curl={0.8} jet={0.6} gather={0.4} />`,
    props: [
      view("front", "animal"),
      { name: "behavior", type: '"crawl" | "jet" | "furl" | "static"', default: '"crawl"', description: "What it does when phase is not supplied: work the arms, pump the mantle with the arms streamed back, or ball up." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.55", description: "Arm cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair break step." },
      ...gaitLoop(),
      { name: "arms", type: "number", default: "8", description: "Arms round the mouth, clamped to 4–10." },
      { name: "segments", type: "number", default: "10", description: "Links in each arm, clamped to 3–24." },
      { name: "curl", type: "number", description: "Arm curl, 0 straight to 1 coiled. Omit and the behavior works them." },
      { name: "jet", type: "number", description: "Mantle contraction, 0 full to 1 squeezed onto the siphon. Omit and the behavior works it." },
      { name: "gather", type: "number", description: "How far the arms stream back, 0 fanned to 1 gathered. Omit and the behavior decides." },
      { name: "interactive", type: "boolean", default: "true", description: "The arms nearest the pointer straighten and lengthen toward it while the rest curl away; a click jets." },
      { name: "onJet", type: "() => void", description: "Fired on the click that pumps the mantle." },
      { name: "showGround", type: "boolean", default: "true", description: "The seabed line." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The independent phase per arm is the whole point: run them in lockstep and it reads as a rosette rather than an animal.", "Arms are on a ring, so the ones round the back draw first and shorter. Front elevation implies that; the other three cameras show it.", "Reaching modulates each arm's curl by how nearly it points at the pointer. It is a bias on a trajectory, not an inverse-kinematic solve — the mantis is the machine here with a real target."],
  },
  {
    slug: "robot-seahorse", item: "robot-seahorse", title: "Robot seahorse", group: "Robots",
    summary: "An upright swimmer in profile whose prehensile grip is the spine solver's own steering taken to the stop. Bony rings sit on the solved joints, and the dorsal fin runs an order faster than the body.",
    files: ["components/ui/robot-seahorse.tsx"],
    usage: `import { RobotSeahorse } from "@/components/ui/robot-seahorse"

<RobotSeahorse behavior="hold" />

// Or drive the coil and the sway yourself.
<RobotSeahorse phase={0.2} grip={1} sway={0.3} headAngle={-18} />`,
    props: [
      view("profile", "swimmer"),
      { name: "behavior", type: '"hold" | "hover" | "drift" | "static"', default: '"hold"', description: "What it does when phase is not supplied: wound onto the holdfast, station-keeping on the dorsal fin, or loose in the current." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.5", description: "Body cycles per second. The dorsal fin runs at six times that." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair break step." },
      ...gaitLoop(),
      { name: "grip", type: "number", description: "Tail grip, 0 straight to 1 wound round the holdfast. Omit and the behavior sets it." },
      { name: "sway", type: "number", description: "Body sway, 0–1. Omit and the behavior sets it." },
      { name: "headAngle", type: "number", description: "Head tilt in degrees, clamped to −35..35. Omit and it follows the pointer." },
      { name: "segments", type: "number", default: "14", description: "Links in the body, clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "The head tilts to the pointer, and a click lets go of the holdfast or takes hold again." },
      { name: "onGripChange", type: "(gripped: boolean) => void", description: "Fired on the click that grips or releases." },
      { name: "showGround", type: "boolean", default: "true", description: "The holdfast it winds its tail around." },
      { name: "label", type: "string", description: "Caption underneath the swimmer." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Grip and steer are one control. A seahorse's tail is its rudder taken to the stop, and the component says so by feeding both from the solver's turn.", "The hull and the bony rings are both built from the solved joints, so the plating cannot drift out of step with the bend.", "The dorsal fin is an illustrated rib fan on its own multiple of the clock; the body is the solve."],
  },
  {
    slug: "robot-ant", item: "robot-ant", title: "Robot ant", group: "Robots",
    summary: "A six-legged forager from above. The spider's carapace is one plate; this body is three sections on a short spine, so a turn runs down the animal instead of pivoting it as a slab.",
    files: ["components/ui/robot-ant.tsx"],
    usage: `import { RobotAnt } from "@/components/ui/robot-ant"

<RobotAnt behavior="forage" />

// Or drive the gait, the course and the jaws yourself.
<RobotAnt phase={0.3} heading={-40} bite={1} cargo="leaf" gaster={0.8} showContacts />`,
    props: [
      view("plan", "forager"),
      { name: "behavior", type: '"forage" | "haul" | "idle" | "static"', default: '"forage"', description: "What it does when phase is not supplied: a quick tripod casting for a trail, a slow wave gait under a load, or standing and feeling about." },
      { name: "gait", type: "string", description: "Footfall pattern: stand, tripod, wave or ripple. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "1.1", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a column breaks step." },
      ...gaitLoop(),
      { name: "height", type: "number", default: "0.5", description: "Normalized body clearance, clamped to 0–1." },
      { name: "stride", type: "number", default: "0.66", description: "Normalized foot travel, clamped to 0–1." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized swing height, clamped to 0–1." },
      { name: "heading", type: "number", description: "Course in degrees, which bends the body chain. Omit and the behavior picks." },
      { name: "bite", type: "number", description: "Mandible opening, 0 shut to 1 wide. Omit and the behavior works them." },
      { name: "antennae", type: "number", description: "Antenna aim, −1..1. Omit and they follow the pointer." },
      { name: "cargo", type: '"none" | "crumb" | "leaf"', default: '"none"', description: "What it is carrying over its head." },
      { name: "gaster", type: "number", description: "Gaster lift, 0 level to 1 cocked up. Omit and the behavior sets it." },
      { name: "interactive", type: "boolean", default: "true", description: "The antennae track the pointer, and a click opens and shuts the mandibles." },
      { name: "onMandibleChange", type: "(open: boolean) => void", description: "Fired on the click that works the jaws." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground patch under the machine." },
      { name: "showContacts", type: "boolean", default: "false", description: "Ring the feet carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the forager." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Six legs, fixed. The gait solver takes four to ten, but an ant has six and the component does not pretend otherwise.", "The heading bends the body chain rather than rotating the whole drawing, which is what puts the head into a turn before the gaster follows.", "The mandibles, the antennae and the cargo are illustrated linkages. The legs and the body chain are the solved parts."],
  },
  {
    slug: "robot-scorpion", item: "robot-scorpion", title: "Robot scorpion", group: "Robots",
    summary: "An eight-legged stalker from above with a metasoma solved in the sagittal plane, so the solver's own x is how far back the tail reaches and its y is how high — the arch is a real height, not a shorter drawing.",
    files: ["components/ui/robot-scorpion.tsx"],
    usage: `import { RobotScorpion } from "@/components/ui/robot-scorpion"

<RobotScorpion behavior="stalk" />

// Or drive the gait, the arch and the claws yourself.
<RobotScorpion phase={0.4} arch={1} claw={0.9} heading={-25} showContacts />`,
    props: [
      view("plan", "animal"),
      { name: "behavior", type: '"stalk" | "guard" | "strike" | "static"', default: '"stalk"', description: "What it does when phase is not supplied: low and forward, planted with the tail up, or loading and letting go." },
      { name: "gait", type: "string", description: "Footfall pattern: stand, tripod, wave or ripple. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.9", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a nest breaks step." },
      ...gaitLoop(),
      { name: "legs", type: "number", default: "8", description: "Walking legs, rounded to an even number and clamped to 4–10. The pedipalps are extra." },
      { name: "height", type: "number", default: "0.5", description: "Normalized body clearance, clamped to 0–1." },
      { name: "stride", type: "number", default: "0.66", description: "Normalized foot travel, clamped to 0–1." },
      { name: "lift", type: "number", default: "0.5", description: "Normalized swing height, clamped to 0–1." },
      { name: "heading", type: "number", description: "Which way it faces, in degrees. Omit and it turns toward the pointer." },
      { name: "arch", type: "number", description: "Tail arch, 0 trailing flat to 1 curled over the back. Omit and the behavior sets it." },
      { name: "claw", type: "number", description: "Pedipalp opening, 0 shut to 1 spread. Omit and the behavior works them." },
      { name: "segments", type: "number", default: "9", description: "Links in the tail, clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "It turns toward the pointer, and a click whips the tail over." },
      { name: "onStrike", type: "() => void", description: "Fired on the click that strikes." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground patch under the machine." },
      { name: "showContacts", type: "boolean", default: "false", description: "Ring the feet carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The tail is one curve supplying two facts: where each segment sits in plan, and how high it is. Arch it and the plan footprint genuinely comes back over the body, because the tail really has curled forward.", "Off-axis the tail is projected at those heights, which is where the arch stops being an inference.", "The pedipalps are illustrated linkages with one solved degree of freedom apiece — the hinged jaw. The legs and the tail are the solved parts."],
  },
  {
    slug: "robot-mantis", item: "robot-mantis", title: "Robot mantis", group: "Robots",
    summary: "The one animal in the set with somewhere to reach. The raptorial forelimbs are a two-link chain solved to a real target, so the strike is inverse kinematics and an unreachable goal clamps rather than fails.",
    files: ["components/ui/robot-mantis.tsx"],
    usage: `import { RobotMantis } from "@/components/ui/robot-mantis"

<RobotMantis behavior="stalk" />

// Or aim the forelimbs yourself, in the animal's own units.
<RobotMantis target={{ x: 46, y: -14 }} phase={0.3} headAngle={20} />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"stalk" | "strike" | "groom" | "static"', default: '"stalk"', description: "What it does when target is not supplied: folded and swaying, loading and shooting the forelimbs out, or cleaning them across the head." },
      { name: "target", type: "{ x: number; y: number }", description: "Where the forelimbs reach, in the animal's own units: x forward from the shoulder, y up. Supplying it stops the pointer and the behavior." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.8", description: "Cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair break step." },
      ...gaitLoop(),
      { name: "stride", type: "number", default: "0.5", description: "Walking-leg travel, clamped to 0–1." },
      { name: "headAngle", type: "number", description: "Head turn in degrees, clamped to −45..45." },
      { name: "interactive", type: "boolean", default: "true", description: "The forelimbs reach for the pointer, and a click snaps the strike out past it." },
      { name: "onStrike", type: "() => void", description: "Fired on the click that snaps." },
      { name: "onTargetChange", type: "(target: Vec2) => void", description: "Where the forelimbs are aimed, whenever it moves." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["A goal outside the reach clamps onto the reachable circle, the way every arm in the registry does. Drag the pointer off the frame and you get a stretched limb, not a broken one.", "The four walking legs are solved chains too, planted on the ground plane. The blueprint variant draws the forelimb's reach circle.", "The gait is an illustrative footfall trajectory: no balance, no ground reaction, and the animal never travels across the frame."],
  },
  {
    slug: "robot-frog", item: "robot-frog", title: "Robot frog", group: "Robots",
    summary: "A jumper in profile. The hind legs are two-link chains solved hip to ankle, and crouch, launch, the airborne trail and the landing absorb are all the same linkage at different points of one pair of numbers.",
    files: ["components/ui/robot-frog.tsx"],
    usage: `import { RobotFrog } from "@/components/ui/robot-frog"

<RobotFrog behavior="hop" />

// Or drive the crouch and the height yourself.
<RobotFrog extend={1} altitude={0.8} gaze={-0.5} />`,
    props: [
      view("profile", "jumper"),
      { name: "behavior", type: '"crouch" | "hop" | "swim" | "static"', default: '"crouch"', description: "What it does when phase is not supplied: sit with the throat going, run the whole jump, or kick a breaststroke at mid-water." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.7", description: "Jumps per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a chorus breaks step." },
      ...gaitLoop(),
      { name: "extend", type: "number", description: "Hind-leg extension, 0 folded into the crouch to 1 straight. Omit and the behavior sets it." },
      { name: "altitude", type: "number", description: "Height above the ground, 0–1. Omit and the behavior decides." },
      { name: "gaze", type: "number", description: "Eye aim, −1..1. Omit and they follow the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The eyes track the pointer, and a click jumps." },
      { name: "onHop", type: "() => void", description: "Fired on the click that jumps." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as it rises." },
      { name: "label", type: "string", description: "Caption underneath the jumper." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Extension and altitude are the whole animal. The knee is solved from the hip and the ankle, so there is no crouched drawing and no airborne drawing to keep in step.", "The vocal sac runs on its own multiple of the clock, because a call is far faster than a jump.", "No ballistics: the arc is a scripted trajectory, and the frog never travels across the frame. The blueprint variant draws the hind leg's reach circle."],
  },
  {
    slug: "robot-cat", item: "robot-cat", title: "Robot cat", group: "Robots",
    summary: "The one machine here whose leg roots are carried by a solved spine. The shoulder is joint 0 of the back and the hip is its last joint, so arching the back moves both and the four solved legs have to answer for it.",
    files: ["components/ui/robot-cat.tsx"],
    usage: `import { RobotCat } from "@/components/ui/robot-cat"

<RobotCat behavior="prowl" />

// Or pose the back, the legs and the tail yourself.
<RobotCat arch={0.8} crouch={0.2} tail={0.9} ears={-1} />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"prowl" | "pounce" | "arch" | "sit" | "static"', default: '"prowl"', description: "What it does when phase is not supplied: stalk on a lateral-sequence walk, run the whole pounce, hold the startle arch, or sit on its haunches." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.55", description: "Cycles per second: one stride prowling, one pounce pouncing." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a litter of them breaks step." },
      ...gaitLoop(),
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed into the stretch to 1 arched. Omit and the behavior sets it. It moves the shoulder and the hip, not just the outline." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 flattened. Omit and the behavior decides." },
      { name: "tail", type: "number", description: "Tail carriage, −1 tucked under to 1 straight up. Omit and the behavior decides." },
      { name: "ears", type: "number", description: "Ears, −1 flat back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The head, ears and eyes track the pointer, and a click pounces." },
      { name: "onPounce", type: "() => void", description: "Fired on the click that pounces." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as it leaves the floor." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the paws carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The back is solveSpine in the sagittal plane, shoulder at s=0 and pelvis at s=1. Its steady turn is the arch and its travelling wave is the bound, so the two leg roots are solver output rather than fixed points on a box.",
      "Femur and tibia are solved to the hock and their lengths hold exactly; the metatarsus below it is carried at an angle that opens with the crouch. That is how the one free parameter of a three-link hind limb is spent, and it is a rule rather than a solve.",
      "The ears, whiskers and the tail's banding are drawn, not solved. Illustrative trajectories throughout: no balance, no ground reaction, no righting reflex, and the animal never travels across the frame.",
    ],
  },
  {
    slug: "robot-dog", item: "robot-dog", title: "Robot dog", group: "Robots",
    summary: "The cat's spine carries both leg roots; this one's carries only the hip. A dog has no clavicle, so the shoulder is the far end of a scapula that swings on the ribcage — and the tail is solved across the centre plane, so the wag runs out of the drawing it is drawn in.",
    files: ["components/ui/robot-dog.tsx"],
    usage: `import { RobotDog } from "@/components/ui/robot-dog"

<RobotDog behavior="trot" />

// Or pose the back, the legs, the head and the tail yourself.
<RobotDog arch={0} crouch={0.2} nose={1} tail={0.2} wag={-0.8} ears={0.4} />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"trot" | "sniff" | "sit" | "alert" | "static"', default: '"trot"', description: "What it does when phase is not supplied: trot on diagonal pairs, quarter the ground nose-down, sit on its croup, or stand on point with a forefoot up." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.7", description: "Cycles per second: one stride per cycle at a trot." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair of them breaks step." },
      ...gaitLoop(),
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed into the play bow to 1 roached. Omit and the behavior sets it. Half the cat's range, because a dog holds a topline." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 flattened. Omit and the behavior decides." },
      { name: "tail", type: "number", description: "Tail carriage, −1 tucked under to 1 straight up. It is a rigid rotation of the whole solved tail about the animal's lateral axis." },
      { name: "wag", type: "number", description: "Where the tail is in its swing, −1 to 1 across the centre plane. Omit and it wags, harder while the pointer is on it." },
      { name: "nose", type: "number", description: "How low the head is carried, 0 up and level to 1 nose on the floor. It is the solved neck's target, not a rotation." },
      { name: "ears", type: "number", description: "Ears, −1 folded back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The head, ears and eyes track the pointer, the wag picks up, and a click barks." },
      { name: "onBark", type: "() => void", description: "Fired on the click that barks." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as the suspension lifts it." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the paws carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The hip is the last joint of the solved back; the shoulder is not on the spine at all. It is the far end of a scapula that pivots on the ribcage and swings with its own leg's stride, which is where a trot's reach comes from. The swing angle is a rule, the way the hock's is — humerus and radius are solved from the shoulder it puts there.",
      "The tail is solveSpine in the transverse plane, so the wag is perpendicular to the side elevation. The whole solved curve is then rotated bodily about the animal's lateral axis by the carriage, which preserves every link length exactly. In profile it foreshortens as it swings, because that is what a wagging tail does; plan and isometric show the arc whole.",
      "The neck is a solved two-link chain from the withers to the poll, so nose puts the head down without moving the withers. The head's own pitch at the poll is a rule off nose rather than the last link's direction, because a dog carries its head at an angle to its neck. The ears, the jaw and the tail's plates are drawn, not solved. Illustrative trajectories throughout: no balance, no ground reaction, no impulse in the bounce, and the animal never travels across the frame.",
    ],
  },
  {
    slug: "robot-fox", item: "robot-fox", title: "Robot fox", group: "Robots",
    summary: "The cat's back arches and the dog's shoulder swings; this one tips the whole animal about its hip. The brush is the first tail in the set that is an output rather than an input — its carriage is derived from the pitch — and the two ears pan independently onto one quarry, so their axes converge.",
    files: ["components/ui/robot-fox.tsx"],
    usage: `import { RobotFox } from "@/components/ui/robot-fox"

<RobotFox behavior="mouse" />

// Or tip the body yourself and let the brush answer for it.
<RobotFox pitch={0.8} counterweight={1} crouch={0.2} bearing={-0.5} range={0.9} />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"mouse" | "trot" | "listen" | "curl" | "static"', default: '"mouse"', description: "What it does when phase is not supplied: stalk and pounce nose-first, trot on diagonal pairs, stand and work the ears, or curl up asleep." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.5", description: "Cycles per second: one hunt per cycle mousing, one stride per cycle at a trot." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair of them breaks step." },
      ...gaitLoop(),
      { name: "pitch", type: "number", description: "Body attitude, −1 nose to the floor to 1 reared onto the hind legs. The whole animal turns about its hip, which is the one joint it does not move. Omit and the behavior sets it." },
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached. Restrained the way the dog's is, because a fox holds a topline." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 flattened. Omit and the behavior decides." },
      { name: "tail", type: "number", description: "Scripted tail carriage, −1 tucked under to 1 straight up. What the counterweight overrides." },
      { name: "counterweight", type: "number", description: "How much of the carriage the body takes, 0 scripted to 1 pure counterweight. At 1 the brush is entirely an output of the pitch. Omit and the behavior decides." },
      { name: "ears", type: "number", description: "Ears, −1 folded back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "bearing", type: "number", description: "Where the quarry is across the nose axis, −1..1 over ±75°. Both ears pan onto it. Omit and the pointer is the quarry." },
      { name: "range", type: "number", description: "How close the quarry is, 0 far off to 1 right in front. It is what makes the two ear axes converge. Omit and the pointer's height sets it." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The eyes track the pointer, the pointer is the quarry the ears aim at, and a click dives." },
      { name: "onDive", type: "() => void", description: "Fired on the click that dives." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as the animal leaves the floor." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the paws carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "pitch is a rigid rotation of the whole solved body about its hip, so every link length survives it exactly. The hip is the anchor and does not move; the withers, the shoulder, the head and the brush all swing about it, and the hind legs stay planted while the forelegs answer.",
      "Once the floor is past the foreleg's reach the limb folds instead of dangling at full stretch: the target comes back in along the same line to a fraction of the reach. The fold begins exactly at the reach limit and deepens with how far past it the body has taken the shoulder — a rule, but one keyed to the geometry rather than to the clock.",
      "The brush's carriage is derived, not driven: it opposes the pitch and the rate the pitch is changing at, and counterweight is the dial between that and the scripted carriage. The rate is taken analytically from the same pure stance function, so a controlled pitch or phase — a still — has no rate to answer and the brush works from the angle alone. It is a proportional rule and not an inertia tensor: no mass, no moment, no conservation.",
      "Each ear pans about its own axis onto one quarry from its own place on a fixed baseline, so the two axes converge and the disparity between them grows as the range closes. foxEarBearing is exported as a pure function and returns both pans, the disparity and the quarry. The ears are modelled in three space and projected, so plan and isometric show the convergence and the profile foreshortens it.",
      "The head does not yaw to the quarry; the ears carry that. The muzzle, the whiskers and the brush's plates are drawn, not solved. Illustrative trajectories throughout: no balance, no ground reaction, no impulse in the landing, and the animal never travels across the frame.",
    ],
  },
  {
    slug: "robot-bear", item: "robot-bear", title: "Robot bear", group: "Robots",
    summary: "The quadruped that stands up. Its soles are segments on the floor rather than points, so the four of them union into a base of support with edges — and rearing collapses that base to two while taking the centre of mass out over it. The balance rule slides the body back until the margin is positive again; the shoulder hump is an output of what the forelimbs carry.",
    files: ["components/ui/robot-bear.tsx"],
    usage: `import { RobotBear } from "@/components/ui/robot-bear"

<RobotBear behavior="amble" />

// Or stand it up yourself and watch the balance rule keep the margin.
<RobotBear rear={1} balance={1} showSupport />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"amble" | "rear" | "forage" | "static"', default: '"amble"', description: "What it does when nothing is driving it: the lateral-sequence plantigrade walk, a rise onto the hind soles and back down, head-down foraging with a working forepaw, or standing square." },
      { name: "phase", type: "number", description: "Controlled stride fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.4", description: "Strides, or rises, per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair of them breaks step." },
      ...gaitLoop(),
      { name: "rear", type: "number", description: "0 on four soles to 1 standing on the hind pair. Omit and the behavior works it; drag it with the pointer." },
      { name: "balance", type: "number", description: "How much of the body's carriage the balance rule takes, 0 scripted to 1 derived. At 1 the standing pose is wherever the arithmetic had to put the body to keep the centre of mass over the soles." },
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached. Restrained, because a bear holds a topline." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 down on the hocks. Omit and the behavior decides." },
      { name: "hump", type: "number", description: "Hump height in world units. Omit and the load on the forelimbs drives it." },
      { name: "dig", type: "number", description: "How hard the near forepaw rakes the floor, 0–1." },
      { name: "ears", type: "number", description: "Ears, −1 flattened back to 1 pricked. Omit and the behavior sets them." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "Drag up and down to rear it, arrows for 10% (25% with shift), Home and End at either end. The head tracks the pointer." },
      { name: "onRearChange", type: "(rear: number) => void", description: "Fired while a person is rearing it by hand." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as it stands up." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark each grounded sole, shaded by the share of the weight it carries." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the base of support, the centre of mass on its plumb line, and the margin between them. It goes red when the margin is negative." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Every foot is a rigid heel-to-toe sole placed on the floor by solveSole, with the leg solved to the ankle that placement produces rather than the other way round. A flat sole is an interval, a rolling one is a point, and a sole that cannot reach the floor reports itself airborne instead of pretending to stand.",
      "rear is a rigid rotation of the whole solved body about its hip, so every link length survives it exactly — and it is the base of support, not the drawing, that decides whether the pose stands up. With balance at 0 and a full rear the centre of mass leaves the base, the support marker goes red and the machine is drawn toppling, because that is what that pose is.",
      "The balance rule is proportional and has no gain, no lag and no fall recovery: it slides the body along the floor until the centre of mass sits at the middle of whatever base the feet are making, clamped to 22 units of travel.",
      "The hump is derived from the forelimb load, so it swells under each forelimb's stance and goes flat in a rear. Supplying hump overrides the mechanism with a shape.",
      "Illustrative kinematics with a static weight distribution on top: no acceleration, no ground reaction force, no centre of pressure, no impulse at footfall. Fur, pelage and claws are drawn, not solved, and the animal does not travel across its frame while its feet move.",
    ],
  },
  {
    slug: "robot-polar-bear", item: "robot-polar-bear", title: "Robot polar bear", group: "Robots",
    summary: "The same plantigrade chassis with a second support system. swim hands the load from the soles to the water in one number: the base of support stops mattering, the hull settles to its waterline, the hind limbs trail, and the forelimbs paddle on a stroke path their two links are solved to.",
    files: ["components/ui/robot-polar-bear.tsx"],
    usage: `import { RobotPolarBear } from "@/components/ui/robot-polar-bear"

<RobotPolarBear behavior="swim" />

// Or work the handover yourself: half in, half out.
<RobotPolarBear swim={0.5} showContacts showSupport />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"plod" | "swim" | "stalk" | "rear" | "static"', default: '"swim"', description: "What it does when nothing is driving it: afloat with the forelimbs alternating, the plantigrade walk, a long low creep with the neck below the shoulder, a rise onto the hind soles, or standing square." },
      { name: "phase", type: "number", description: "Controlled stride, or stroke, fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.45", description: "Strides, or strokes, per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair of them breaks step." },
      ...gaitLoop(),
      { name: "swim", type: "number", description: "0 on the floor to 1 afloat — the handover. Omit and the behavior works it; drag it with the pointer." },
      { name: "strokes", type: "number", default: "1", description: "Forelimb strokes per cycle, clamped 0.25–4. The two sides run half a cycle apart." },
      { name: "rear", type: "number", description: "0 on four soles to 1 up on the hind pair. Scaled out by swim: nothing rears in the water." },
      { name: "balance", type: "number", description: "How much of the carriage the balance rule takes, 0 scripted to 1 derived." },
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 down on the hocks." },
      { name: "neck", type: "number", description: "Neck carriage, −1 run right down below the shoulder to 1 held high. The long neck is this animal's signature, so it is its own axis." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "Drag up and down to work the handover, arrows for 10% (25% with shift), Home on the floor and End in the water." },
      { name: "onSwimChange", type: "(swim: number) => void", description: "Fired while a person is working the handover by hand." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which fades out as the water takes the weight." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark each grounded sole, shaded by the share of the weight it still carries." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the base of support, the centre of mass, and the margin between them." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "swim is one number with four consequences, all arithmetic: legLoad(i) = (1 − swim) · supportLoad(i) and buoyancy = swim, so the soles unload; the hull rises to its draft at the waterline; the hind limbs stop stepping and trail; and the forelimbs cross over from standing to paddling.",
      "The stroke is a path and the limb is an output of it: the paw traces a closed loop that pulls deep and recovers shallow, and solveChain2 produces the shoulder and elbow from wherever on it the paw is. polarStroke is exported as a pure function of the beat, and the path itself is drawn while swimming.",
      "Buoyancy is a prop, not a computed displacement. There is no hydrodynamics of any kind: the stroke makes no thrust, the hull has no drag, and the draft is a constant rather than a function of what is submerged.",
      "Everything the bear says about its soles holds here too — the sole is rigid, the contact is read off the geometry, and the loads are a static distribution rather than a dynamics solve.",
    ],
  },
  {
    slug: "robot-panda", item: "robot-panda", title: "Robot panda", group: "Robots",
    summary: "The bear that sits down to use its hands. The seat is a third contact with a span of its own — which is what buys back a base once both forepaws have left the floor — and the pseudo-thumb's pad gap is an output of whatever is between the pads rather than of the dial.",
    files: ["components/ui/robot-panda.tsx"],
    usage: `import { RobotPanda } from "@/components/ui/robot-panda"

<RobotPanda behavior="feed" />

// Or sit it down and hand it a stalk of your own size.
<RobotPanda sit={1} grip={1} stalkWidth={8} stalk={{ x: 30, y: 34 }} showSupport />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"feed" | "sit" | "amble" | "static"', default: '"feed"', description: "What it does when nothing is driving it: sit and bring a stalk up to the muzzle, sit with both forelimbs free, the lateral-sequence plantigrade walk, or standing square." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.35", description: "Feeding cycles, or strides, per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a pair of them breaks step." },
      ...gaitLoop(),
      { name: "sit", type: "number", description: "0 standing to 1 down on the seat. Omit and the behavior works it." },
      { name: "grip", type: "number", description: "How far the pseudo-thumb is closed on the digits, 0–1." },
      { name: "stalkWidth", type: "number", default: "5", description: "Stalk diameter in world units, 0–9. What the thumb has to open around — the pad gap answers it." },
      { name: "stalk", type: "Vec2", description: "Where the stalk is, in the animal's own frame: x forward from the hip, y up off the floor. Both forepaws are solved to it. Omit and the pointer is the stalk." },
      { name: "chew", type: "number", description: "Jaw opening, 0 shut to 1 wide. Omit and the behavior chews." },
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 down on the hocks." },
      { name: "gaze", type: "number", description: "Eye aim, −1..1. The head tips toward the stalk on its own once it is near the muzzle." },
      { name: "balance", type: "number", description: "How much of the carriage the balance rule takes, 0 scripted to 1 derived." },
      { name: "interactive", type: "boolean", default: "true", description: "The pointer is the stalk — both forepaws solve to wherever it is — and a click takes a bite." },
      { name: "onStalkChange", type: "(stalk: Vec2) => void", description: "Fired with the stalk position on a click." },
      { name: "onBite", type: "() => void", description: "Fired on the click that bites." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark each grounded sole, shaded by the share of the weight it carries." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the base of support and the centre of mass. This is the machine where you can watch the base being bought." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The seat is not a pose: the pelvis is rigid on the body, so where its underside ends up is a consequence of the tilt, and when it would go through the floor the animal rests on it. It then enters solveSupport as a third contact with a span of its own. Just before it lands, both forepaws are on the stalk and the two hind soles have rolled onto their heels — two points in the same place, which is not a base — so the seat is what is holding the animal up, and the blueprint variant draws it.",
      "The pad gap is an output: gap = 9 · (1 − grip), and a stalk wider than the gap rides the thumb further open at the same grip. Closing on nothing brings the pads together. The digits, the claws and the pelage are drawn; the thumb's angle and the forelimb chains are solved.",
      "The stalk is a real target: solveSole places each forepaw on it and the two links answer, so moving the stalk moves the whole chain. The two paws stack on it the way a pair of hands do.",
      "Illustrative kinematics with a static weight distribution on top — no dynamics, no grasp forces, no friction between pad and stalk, and the animal does not travel across its frame.",
    ],
  },
  {
    slug: "bear-kinematics", item: "bear-kinematics", title: "Bear kinematics", group: "Foundations",
    summary: "The plantigrade solver behind the bears: a rigid sole placed on the floor with the leg solved to the ankle it produces, the base of support those intervals make, and the static share of the weight at each contact.",
    files: ["lib/robocn/bear.ts"],
    usage: `import { plantigradeStep, solveSole, solveSupport } from "@/lib/robocn/bear"

const step = plantigradeStep(0.2, { reach: 12, clearance: 8 })
const leg = solveSole({ hip: { x: 0, y: 40 }, plant: step.plant, pivot: step.pivot,
  pitch: step.pitch, femur: 20, tibia: 18, heel: 7, toe: 12, ankle: 5 })
leg.contact // "flat" | "heel" | "toe" | "airborne"
solveSupport([{ id: "hind", span: leg.span }], 6).margin // 1 centred, 0 on an edge`,
    api: [
      { name: "solveSole", type: "(options: SoleOptions) => SolePose", description: "One plantigrade limb, placed by its foot: the sole is rigid and never goes through the floor, the ankle falls out of the placement, and the two links are solved to it." },
      { name: "SoleOptions", type: "{ hip, plant, pivot?, pitch?, femur, tibia, heel, toe, ankle, bend?, floor? }", description: "pivot says which point of the sole plant refers to — its heel end, its middle or its toe end — and pitch is the sole's angle, positive toe-up." },
      { name: "SolePose", type: "{ hip, knee, ankle, heel, toe, pitch, contact, span, reached }", description: "contact is flat, heel, toe or airborne, read off the geometry rather than copied from pivot; span is the grounded interval, degenerate at a roll and null in the air; reached is false when the hip could not get to the ankle asked for." },
      { name: "solveSupport", type: "(contacts, com: number) => SupportPose", description: "The union hull of the grounded intervals, the margin from the centre of mass to the nearest edge (1 dead centre, 0 on an edge, negative outside), and the load at each contact — the minimum-norm solution of loads that sum to 1 and whose weighted mean is the centre of mass, which for two contacts is exactly the lever rule." },
      { name: "plantigradeStep", type: "(t, options?) => StepPose", description: "Where one sole is in its own step: heel strike, the roll down, the flat middle of the stance, the roll off the toe, and the swing. A digitigrade foot has one state; this has four." },
      { name: "soleLimits", type: "{ strike: 18, off: 26, down: 0.18, lift: 0.72 }", description: "The sole angles a step rolls through, and the fractions of the stance it rolls at." },
    ],
    notes: [
      "The sole is exactly heel + toe long at every pitch and pivot, and neither end ever goes below the floor — the first two things the solver tests assert.",
      "The loads are a static weight distribution, not a dynamics solve: no acceleration, no ground reaction, no impulse, no centre of pressure. A load that would come out negative means that foot is being lifted off — the centre of mass is outside the base — so it is clamped to zero and stable already says so.",
    ],
  },
  {
    slug: "robot-horse", item: "robot-horse", title: "Robot horse", group: "Robots",
    summary: "The first machine here whose gait is a real thing rather than a label: a walk is four beats in a lateral sequence, a trot two on diagonals, a canter three on a lead — and the beat is counted off the footfalls. What each grounded foot is carrying then drives two joints nobody sets: a fetlock that sinks under load, and a neck that nods because the forehand is loading.",
    files: ["components/ui/robot-horse.tsx"],
    usage: `import { RobotHorse } from "@/components/ui/robot-horse"

<RobotHorse behavior="walk" />

// Or drive the footfall pattern yourself and watch the fetlocks take the weight.
<RobotHorse gait="canter" lead="left" phase={0.3} showContacts />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"walk" | "trot" | "canter" | "gallop" | "graze" | "static"', default: '"walk"', description: "What it does when phase is not supplied. Each one picks its own footfall pattern, its own stride length and how much of the neck's carriage the load takes." },
      { name: "gait", type: '"halt" | "walk" | "trot" | "pace" | "canter" | "gallop"', description: "Footfall pattern, overriding the one the behavior picked. pace — the lateral two-beat — is only reachable here." },
      { name: "lead", type: '"left" | "right"', default: '"right"', description: "Which foreleg lands last. Only the canter and the gallop have a lead; the symmetrical gaits ignore it." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.6", description: "Strides per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a string of them breaks step." },
      ...gaitLoop(),
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached. Restrained, because a horse holds a topline. Omit and the behavior sets it." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 dropped. Omit and the behavior decides." },
      { name: "neck", type: "number", description: "Scripted neck carriage, −1 head to the floor to 1 head high. What the balance moves around. Omit and the behavior sets it." },
      { name: "balance", type: "number", description: "How much of the carriage the forehand's load takes, 0 scripted to 1 fully derived. At 1 the nod is entirely an output of the gait. Omit and the behavior decides." },
      { name: "tail", type: "number", description: "Tail carriage, −1 clamped under the quarters to 1 flagged out behind. Omit and the behavior sets it." },
      { name: "ears", type: "number", description: "Ears, −1 pinned back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "Drag across it to scrub the stride — the frame is one whole cycle — with arrows stepping 5% and shift 15%, Home parking it at the start and End handing it back to the behavior. The head tracks the pointer." },
      { name: "onPhaseChange", type: "(phase: number) => void", description: "Fired with the scrubbed cycle fraction, 0–1." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the hooves carrying weight, which is the gait's support pattern drawn out." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "A gait here is a set of touchdown instants, and the beat count is read off them rather than declared — 4 for a walk, 2 for a trot and a pace, 3 for a canter, 4 for a gallop. The pace is the proof that a beat count alone does not name a gait: it has a trot's two beats on the other diagonal.",
      "The fetlock is the one joint in the limb that nobody sets. Its angle is fetlockSink(load), so a loaded limb visibly sinks and a swinging one recoils, and the drop you are looking at is the support pattern made visible. It is a proportional rule, not a stiffness: there is no spring rate and no damping.",
      "The neck's nod is derived the same way — it answers the forehand's load against what the forehand carries standing square — so a walking horse nods twice a stride, once per foreleg, and a trotting one barely nods. balance is the dial between that and the scripted carriage.",
      "The load is a static weight distribution: the forehand's 58 percent shared out among whichever feet are down, summing to exactly one body while anything is down and to nothing in a suspension. No acceleration, no ground reaction force, no centre of pressure, no impulse at footfall.",
      "The body's rise through a suspension is a scripted curve per gait rather than a ballistic trajectory, and the animal never travels across the frame while its feet move. The mane, the tail's hair and the head's plating are drawn, not solved.",
    ],
  },
  {
    slug: "robot-pegasus", item: "robot-pegasus", title: "Robot pegasus", group: "Robots",
    summary: "One body, two ways of holding it up, and the number between them. lift splits the animal's weight between its legs and its wings, and four things answer it at once: the fetlocks recoil, the legs run out of reach and fold, the stride fades out, and the wingbeat fades in. The wing is three bones solved to a tip tracing a figure of eight.",
    files: ["components/ui/robot-pegasus.tsx"],
    usage: `import { RobotPegasus } from "@/components/ui/robot-pegasus"

<RobotPegasus behavior="launch" />

// Or work the handover yourself and watch everything answer it.
<RobotPegasus lift={0.5} spread={0.8} beat={0.2} gait="canter" showContacts />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"launch" | "canter" | "soar" | "hover" | "static"', default: '"launch"', description: "What it does when nothing is supplied. launch is the one that crosses the handover; canter stays on the floor; soar and hover are both entirely on the wings." },
      { name: "lift", type: "number", description: "The handover, 0 the legs carry the whole animal to 1 the wings do. The one prop the machine is about. Omit and the behavior decides." },
      { name: "spread", type: "number", description: "Wing extension, 0 furled against the body to 1 spread. Folding is the tip path closing, not a different drawing. Omit and it comes up with the lift." },
      { name: "beat", type: "number", description: "Controlled wingbeat fraction. Omit and it runs off the stride at wingbeats per cycle." },
      { name: "wingbeats", type: "number", description: "Wingbeats per stride. Omit and the behavior sets it — a hover beats fastest because it is holding station on the wings alone." },
      { name: "gait", type: '"halt" | "walk" | "trot" | "pace" | "canter" | "gallop"', description: "The footfall pattern whatever weight is still on the feet runs. Omit and the behavior picks one." },
      { name: "lead", type: '"left" | "right"', default: '"right"', description: "Which foreleg lands last, for the canter and the gallop." },
      { name: "phase", type: "number", description: "Controlled stride fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.5", description: "Strides per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a flight of them breaks step." },
      ...gaitLoop(),
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached. Omit and the behavior sets it." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 dropped. Omit and the behavior decides." },
      { name: "neck", type: "number", description: "Neck carriage, −1 head to the floor to 1 head high. Omit and the behavior sets it." },
      { name: "tail", type: "number", description: "Tail carriage, −1 clamped under the quarters to 1 flagged out behind." },
      { name: "ears", type: "number", description: "Ears, −1 pinned back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "Drag up and down to work the handover — the frame's height is the whole of it — with arrows stepping 10% and shift 25%, Home on the floor and End in the air. The head tracks the pointer." },
      { name: "onLiftChange", type: "(lift: number) => void", description: "Fired with the handover, 0–1." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as it leaves the floor." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the hooves still carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "lift is one load budget shared between two support systems: the legs carry 1 − lift of the body and the wings carry lift, and the leg loads are the gait solver's own numbers scaled by it. That is what makes the fetlocks recoil as the animal goes up rather than being told to.",
      "The legs fold because they run out of reach, not because a script folds them: the floor stays where it is while the body rises, and once the hoof target is past the limb's own reach the target comes back in along the same line. It is a rule, but one keyed to the geometry.",
      "Each wing is three bones solved to a wingtip path rather than three scripted angles. The path is a 1:2 Lissajous — one cycle up and down against two fore and aft — which is the figure of eight a wingtip traces, and spread scales the whole path, so folding the wing is the same solve with a nearer target.",
      "The wings are modelled in three space and go through the camera in their own group, so they are exact from every angle. In a true side elevation a lateral span foreshortens and the two wings very nearly superimpose — that is what a side elevation of a wing is, not a drawing bug. Plan and front show the span.",
      "No aerodynamics of any kind: the wing generates no modelled lift, and lift is a prop rather than a computed force. No dynamics under the feet either — the load is a static weight distribution, and the rise is a ramp rather than a ballistic trajectory. The animal never travels across its frame.",
    ],
  },
  {
    slug: "robot-camel", item: "robot-camel", title: "Robot camel", group: "Robots",
    summary: "Every other machine in the set stands on a line. This one's ground is a medium with a depth, and its feet go into it — as deep as what each is carrying, and less deep because the pad opens under the load and drops its own pressure. The hump is a store that slumps as it empties, and the roll is an output of the gait.",
    files: ["components/ui/robot-camel.tsx"],
    usage: `import { RobotCamel } from "@/components/ui/robot-camel"

<RobotCamel behavior="pace" />

// Or put it on rock and watch the feet come back up out of the ground.
<RobotCamel gait="pace" phase={0.2} ground={0} reserve={0.3} showContacts />`,
    props: [
      view("profile", "animal"),
      { name: "behavior", type: '"pace" | "walk" | "trot" | "couch" | "static"', default: '"pace"', description: "What it does when phase is not supplied. pace is the signature — the lateral two-beat nothing else in the set uses — and trot is the control case for the roll." },
      { name: "gait", type: '"halt" | "walk" | "trot" | "pace" | "canter" | "gallop"', description: "Footfall pattern, overriding the one the behavior picked." },
      { name: "ground", type: "number", description: "What it is standing on, 0 rock to 1 dry sand. The loaded feet go into it. Omit and the behavior sets it." },
      { name: "reserve", type: "number", description: "How much is left in the hump, 1 full and upright to 0 empty and folded over. The base is held while the height goes. Omit and the behavior decides." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.5", description: "Strides per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a string of them breaks step." },
      ...gaitLoop(),
      { name: "arch", type: "number", description: "Back curvature, −1 hollowed to 1 roached. Omit and the behavior sets it." },
      { name: "crouch", type: "number", description: "Leg fold, 0 standing tall to 1 couched. Omit and the behavior decides." },
      { name: "neck", type: "number", description: "Neck carriage, −1 head to the floor to 1 head high. Omit and the behavior sets it." },
      { name: "tail", type: "number", description: "Tail carriage, −1 clamped to 1 held out." },
      { name: "ears", type: "number", description: "Ears, −1 pinned back to 1 pricked forward. Omit and they prick at the pointer." },
      { name: "gaze", type: "number", description: "Head and eye aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "Drag up and down to work the ground — firm at the top of the frame, soft at the bottom, so dragging down is sinking — with arrows stepping 10% and shift 25%, Home on rock and End in sand. The head tracks the pointer." },
      { name: "onGroundChange", type: "(ground: number) => void", description: "Fired with the ground's softness, 0–1." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line, and the band of yielding material under it." },
      { name: "showContacts", type: "boolean", default: "false", description: "Mark the pads carrying weight, at the width the load has opened them to." },
      { name: "label", type: "string", description: "Caption underneath the animal." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The ground is the new axis and it is the only floor in the registry with a depth. padSpread opens the pad under load and footSinkage turns the pressure that leaves into a depth, so each loaded foot sits as deep as what it carries — and an opening pad drops its own pressure, which is why the same animal on the same sand stays higher up than it would on a foot that did not open. The tests assert exactly that comparison.",
      "It is a proportional rule, not a soil model: no bearing capacity, no shear, no compaction, and the rim of disturbed ground around a sunk foot is drawn rather than displaced from anywhere.",
      "The hump is one outline bent rather than one drawing swapped for another: its base is pinned to the back and does not move, its height falls with the reserve, and past the halfway mark it leans over while the rear flank goes slack. It conserves no volume.",
      "The roll is an output of the gait. A pace is the lateral two-beat, so the whole weight is on one side and the roll swings to a full ±1 once each way per stride; a trot's support is diagonal, so all that is ever off-centre is the forehand's share against the hind end's — 0.16 of a body, exactly, whenever either diagonal is down. camelRoll is exported pure, and the test asserts that residual rather than eyeballing it.",
      "Illustrative kinematics throughout: the load is a static weight distribution, there is no impulse at footfall, the roll is a proportional rule rather than a moment about anything, and the animal never travels across its frame.",
    ],
  },
  {
    slug: "robot-turtle", item: "robot-turtle", title: "Robot turtle", group: "Robots",
    summary: "A plodder from above: the shared gait solver at four legs on a slow wave, under a procedurally plated carapace, with one number that pulls the head, tail and every foot in underneath it.",
    files: ["components/ui/robot-turtle.tsx"],
    usage: `import { RobotTurtle } from "@/components/ui/robot-turtle"

<RobotTurtle behavior="plod" />

// Or drive the gait and the retraction yourself.
<RobotTurtle phase={0.3} retract={0.8} gaze={0.4} showContacts />`,
    props: [
      view("plan", "plodder"),
      { name: "behavior", type: '"plod" | "bask" | "retract" | "static"', default: '"plod"', description: "What it does when phase is not supplied: one leg at a time, sitting with the neck out, or shut up entirely." },
      { name: "gait", type: "string", description: "Footfall pattern: stand, tripod, wave or ripple. Omit and the behavior picks one." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.45", description: "Gait cycles per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a line of them breaks step." },
      ...gaitLoop(),
      { name: "height", type: "number", default: "0.35", description: "Normalized body clearance, clamped to 0–1." },
      { name: "stride", type: "number", default: "0.55", description: "Normalized foot travel, clamped to 0–1." },
      { name: "lift", type: "number", default: "0.4", description: "Normalized swing height, clamped to 0–1." },
      { name: "heading", type: "number", default: "0", description: "Which way the shell faces, in degrees." },
      { name: "retract", type: "number", description: "Retraction, 0 fully out to 1 everything under the shell. Omit and the behavior sets it." },
      { name: "gaze", type: "number", description: "Head aim, −1..1. Omit and it follows the pointer." },
      { name: "interactive", type: "boolean", default: "true", description: "The head tracks the pointer, and a click pulls everything in or lets it back out." },
      { name: "onRetractChange", type: "(withdrawn: boolean) => void", description: "Fired on the click that withdraws or emerges." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground patch under the machine." },
      { name: "showContacts", type: "boolean", default: "false", description: "Ring the feet carrying weight." },
      { name: "label", type: "string", description: "Caption underneath the plodder." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Retraction is geometry rather than a fade: the limbs really do come in, and the carapace is drawn after them, so it covers what has been pulled underneath.", "The scutes are laid out from the shell's own dimensions — five vertebrals, four costals a side, and a marginal ring — so a resized carapace re-plates itself.", "Four legs is the low end of the shared gait solver, which always allowed it and had never been asked. The carapace dome only reads off-axis."],
  },
  {
    slug: "robot-inchworm", item: "robot-inchworm", title: "Robot inchworm", group: "Robots",
    summary: "A looper in profile that moves by alternating anchors rather than a travelling wave. The body is a fixed length, so the arch height is solved from the anchor span: close the span and the loop has to rise.",
    files: ["components/ui/robot-inchworm.tsx"],
    usage: `import { RobotInchworm } from "@/components/ui/robot-inchworm"

<RobotInchworm behavior="loop" />

// Or drive the span and the reach yourself.
<RobotInchworm phase={0.35} span={0.2} reach={0.7} />`,
    props: [
      view("profile", "crawler"),
      { name: "behavior", type: '"loop" | "rear" | "measure" | "static"', default: '"loop"', description: "What it does when phase is not supplied: anchor, arch, reach and draw up; hold the front end up and cast about; or pace the same loop out slowly." },
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the internal clock." },
      { name: "speed", type: "number", default: "0.4", description: "Loops per second." },
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a row of them breaks step." },
      ...gaitLoop(),
      { name: "span", type: "number", description: "Anchor separation, 0 drawn right up to 1 stretched out. Omit and the behavior sets it." },
      { name: "reach", type: "number", description: "How far the front end is lifted off the surface, 0–1. Omit and the behavior decides." },
      { name: "segments", type: "number", default: "14", description: "Links in the body, clamped to 3–24." },
      { name: "interactive", type: "boolean", default: "true", description: "The front end lifts toward the pointer, and a click rears it right up." },
      { name: "onRear", type: "() => void", description: "Fired on the click that rears it up." },
      { name: "showGround", type: "boolean", default: "true", description: "The surface, and the marks that show it travelling over it." },
      { name: "label", type: "string", description: "Caption underneath the crawler." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The arch is solved, not drawn: a short bisection on the spine solver's turn finds the arc of the body's own length whose chord is the current anchor span. Shorten the span and the loop rises because there is nowhere else for the length to go.", "No travelling wave anywhere in it, which is what makes it different from every other crawler here. Exactly one end is ever off the surface.", "The animal walks on the spot and the surface marks slide under it, the same convention the conveyor and the rover use. There is no ground friction or adhesion model."],
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
    slug: "gait-kinematics", item: "gait-kinematics", title: "Gait kinematics", group: "Foundations",
    summary: "The footfall solver behind the horse, the pegasus and the camel: six named gaits as real touchdown sequences, a beat count derived from them rather than declared, the support pattern, and the share of the body's weight on every grounded foot — plus the three things that one number drives.",
    files: ["lib/robocn/gait.ts"],
    usage: `import { solveGait, fetlockSink, padSpread, footSinkage } from "@/lib/robocn/gait"

const pose = solveGait({ gait: "canter", phase: 0.4, lead: "left" })
pose.beats     // 3 — counted from the footfalls, not declared
pose.support   // how many feet are down right now
pose.legs      // id, fore, touchdown, contact, load, foot

// Three things the same load number drives.
fetlockSink(leg.load)                  // degrees the sprung pastern drops
padSpread(leg.load)                    // how far a splay pad opens
footSinkage(leg.load, 0.8)             // how deep it goes into soft ground`,
    api: [
      { name: "solveGait", type: "(options?: GaitOptions) => GaitPose", description: "One instant of a gait: who is down, when each limb landed, where its foot is, and what share of the standing weight it carries." },
      { name: "GaitOptions", type: "{ gait?, phase?, lead?, duty?, stride?, lift? }", description: "Gait is halt, walk, trot, pace, canter or gallop; lead is the foreleg that lands last and only the canter and the gallop have one; duty overrides the gait's own; stride and lift are normalized foot travel and swing height." },
      { name: "GaitLeg", type: "{ id, side, fore, touchdown, t, contact, load, foot: Vec2 }", description: "touchdown is where in the stride this limb lands, t is the time since it did, and load is its share of the body — 0 in the air, and summing to exactly 1 across every grounded limb." },
      { name: "GaitPose", type: "{ gait, beats, duty, lead, leadLeg, support, airborne, forehand, legs }", description: "beats is the number of distinct footfall instants, counted from the touchdowns; support is how many feet are down; airborne is the suspension." },
      { name: "gaitBeats", type: "(gait: EquineGait) => number", description: "The beat count on its own: 4 for a walk, 2 for a trot and a pace, 3 for a canter, 4 for a gallop, 0 for a halt." },
      { name: "fetlockSink", type: "(load: number) => number", description: "The sprung pastern: how far the fetlock drops, in degrees, under a load. A passive joint whose angle is an output of the gait." },
      { name: "padSpread", type: "(load: number) => number", description: "A splay pad opening under load, as a multiple of its own unloaded width. The same primitive as fetlockSink off the same number, with a different consequence." },
      { name: "footSinkage", type: "(load: number, ground: number, spread?: number) => number", description: "How far a foot goes into the ground, in world units. Pressure is load over contact area and ground is how soft it is, so a pad that opens under load sinks less than one that does not. A proportional rule, not a soil model." },
      { name: "gaitLimits", type: "{ reach: 16, clearance: 11, fetlock: 30, spread: 0.55, sinkage: 9 }", description: "What stride, lift, a full load, a fully opened pad and fully soft ground mean in world units and degrees." },
    ],
    notes: [
      "The beat count is read off the touchdown instants rather than declared, which is what makes walk-versus-trot a fact about the numbers. The pace and the trot both come out at two, on different diagonals — proof that the count alone does not name a gait.",
      "The load is a static weight distribution — the forehand's share divided among whichever feet are down — and not a dynamics solve. No acceleration, no ground reaction, no centre of pressure. It solves no legs either: the components own their own limb chains and read the load off this.",
      "fetlockSink, padSpread and footSinkage are all consequences of that one load number, which is why they live here rather than in the machines that spend them: a sprung joint, a foot that opens, and a ground that gives are the same arithmetic read three ways.",
    ],
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
    slug: "walker-kinematics", item: "walker-kinematics", title: "Walker kinematics", group: "Foundations",
    summary: "Two or four legs on a rectangular hip base, for machines that carry their mass above the hips: the footfall schedule, the support polygon it leaves, and the hull attitude that is the only way such a machine can move its mass over a foot.",
    files: ["lib/robocn/walker.ts"],
    usage: `import { solveWalker, walkerHullPoint } from "@/lib/robocn/walker"

const pose = solveWalker({ legs: 2, gait: "walk", phase: 0.25 })
pose.roll     // degrees of roll the load demanded — an output, not an input
pose.centre   // where that attitude actually got the mass, in plan
pose.margin   // room left inside the support polygon; negative is over the edge
walkerHullPoint(pose, { x: 0, y: 30, z: 12 }) // a hull-mounted part, in the world`,
    api: [
      { name: "solveWalker", type: "(options?: WalkerOptions) => WalkerPose", description: "Runs the footfall schedule, takes the support polygon it leaves, works out the nearest place inside it the mass can stand, and buys that offset with roll and pitch — then solves each knee as a two-link chain in its own vertical plane, from a hip the attitude has moved." },
      { name: "WalkerOptions", type: "{ legs?, gait?, phase?, height?, step?, lift?, halfWidth?, halfLength?, femur?, tibia?, hull?, rollLimit?, pitchLimit?, inset?, knee?, lean? }", description: "`legs` is 2 or 4; `hull` is how far the centre of mass sits above the hip line, which is what sets the price of every lateral move; `lean` pushes the demand in −1..1 of each attitude stop before it is clamped." },
      { name: "WalkerPose", type: "{ count, gait, ride, roll, pitch, demand, centre, legs, support, margin, airborne, stable, hull, femur, tibia, rollLimit, pitchLimit }", description: "Plan positions are x starboard, y toward the nose. `demand` is where the load asked the mass to be and `centre` where the attitude got it; `margin` is the signed distance from that to the edge of the support." },
      { name: "WalkerGait", type: '"stand" | "walk" | "stride" | "creep" | "pace"', description: "Per leg count: a biped has stand, walk and stride (which has a flight phase); a quadruped has stand, walk and creep in lateral sequence, and pace, which swings both legs of a side together. A gait the leg count does not have falls back to stand." },
      { name: "walkerHullPoint", type: "(pose: WalkerPose, local: Vec3) => Vec3", description: "Where a point bolted to the hull ends up in the world, in the hull's own frame — origin at the hip centre, x starboard, y up, z toward the nose. The solver places the hips with this same transform, which is what keeps a drawing on the machine it was solved for." },
      { name: "supportMargin", type: "(centre: Vec2, support: readonly Vec2[]) => number", description: "Room inside the convex hull of the contacts: positive inside a polygon, zero at best on a segment, negative outside either." },
      { name: "walkerGaits", type: "(legs: 2 | 4) => WalkerGait[]", description: "Which gaits a leg count actually has, for building a control that cannot offer a nonsense one." },
    ],
    notes: [
      "The relation the family is built on: the mass is `hull` above the hip line, so a lateral offset costs `asin(offset / hull)` of roll and a fore-aft one the same in pitch, measured on the hull the roll already left. Roll and pitch are outputs. Past the stops the mass cannot reach the polygon at all, and the margin goes negative.",
      "The inverse of `tripod-kinematics`, which moves the body itself over its feet. A hull bolted to its hips cannot slide, so the same static condition has to be paid for with attitude — which is why a biped heaves over every step and a quadruped on a lateral-sequence walk hardly moves at all.",
      "Illustrative, not dynamics: the footfall pattern is a chosen schedule, each foot's share is that schedule weighted by how near the mass ended up rather than a ground-reaction solve, and there is no mass, inertia or overturning moment. A negative margin says the machine could not hold that pose standing still. A taller hull needing less roll is a fact about this static geometry and not a claim about a tall machine in motion.",
      "A flight phase is reported (`airborne`) rather than hidden, and it claims no margin either way, because there is then no support to be inside of.",
    ],
  },
  {
    slug: "tripod-kinematics", item: "tripod-kinematics", title: "Tripod kinematics", group: "Foundations",
    summary: "The three-legged balance solver: a load schedule per foot, the body position that schedule demands, and the support polygon it has to stay inside.",
    files: ["lib/robocn/tripod.ts"],
    usage: `import { solveTripod, supportMargin } from "@/lib/robocn/tripod"

const pose = solveTripod({ gait: "creep", phase: 0.35 })
pose.centre   // where the body has to stand to hold that load split
pose.margin   // room left inside the support polygon; negative is over the edge
pose.legs     // hip, knee, foot, kneeHeight, clearance, contact, load`,
    api: [
      { name: "solveTripod", type: "(options?: TripodOptions) => TripodPose", description: "Schedules the load across three feet, solves the body position that schedule demands, clamps it to what the legs can follow, and solves each knee as a two-link chain in its own vertical plane." },
      { name: "TripodOptions", type: "{ gait?, phase?, height?, step?, lift?, heading?, turn?, sway?, lean?, femur?, tibia? }", description: "Normalized height, step and lift; heading and turn in degrees; sway in world units, clamped to what the legs can reach; lean in −1..1 of that limit." },
      { name: "TripodPose", type: "{ gait, height, centre, yaw, legs, support, margin, stable, sway, femur, tibia }", description: "Plan positions are x starboard, y toward the nose. `centre` is the body over its feet, `margin` the signed distance from it to the edge of the support polygon." },
      { name: "TripodGait", type: '"stand" | "creep" | "amble" | "pivot"', description: "Creep keeps a three-foot overlap to hand the load across; amble takes two feet off at once; pivot runs the creep pattern as a turn on the spot." },
      { name: "supportMargin", type: "(centre: Vec2, support: readonly Vec2[]) => number", description: "How much room a centre of mass has inside a polygon of contacts: positive inside a triangle, zero at best on a segment, negative outside either." },
    ],
    notes: [
      "The inverse of `bear-kinematics`: that one is given a centre of mass and works out the loads, in one dimension. This one is given the loads and works out the centre of mass, in two — which is the only way a three-legged machine can take a step.",
      "Sway is derived, not chosen: it is what is left of a leg's reach once a planted foot has been paid for, so femur, tibia and ride height all change whether a gait is statically holdable. An explicit `sway` can only make it smaller.",
      "Illustrative trajectories, not dynamics: the load ramp is a schedule, there is no ground reaction or inertia, and the feet travel rather than the world.",
    ],
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
    slug: "radial-bloom", item: "radial-bloom", title: "Radial bloom", group: "Machines",
    summary: "A hub of telescoping rams pointed outward in one plane: closed it is an even star, driven out it is a ragged burst. Four guided stages per ram, and a vector of strokes drives each ram on its own.",
    files: ["components/ui/radial-bloom.tsx"],
    usage: `import { RadialBloom } from "@/components/ui/radial-bloom"

<RadialBloom rams={12} />

// The whole stroke, open and closed.
<RadialBloom behavior="bloom" />

// Controlled as one array, as a vector of rams, or as a dial you can pull open.
<RadialBloom extension={0.8} />
<RadialBloom strokes={[1, 0.4, 0.9, 0.2, 0.7, 0.55]} />
<RadialBloom interactive onExtensionChange={setExtension} />`,
    props: [
      view("plan", "array"),
      { name: "extension", type: "number", description: "Controlled extension of the whole array, 0 closed to 1 open. Supplying it stops the loop." },
      { name: "strokes", type: "number[]", description: "Controlled extension per ram, 0 to 1. Its length sets the ram count, so a six-value vector builds a six-ram hub." },
      { name: "behavior", type: '"bloom" | "ripple" | "index" | "flutter" | "static"', default: '"flutter"', description: "The default holds station near full travel with a small dither, which is the array working. bloom runs the whole stroke open and closed, ripple sends a travelling wave round the ring, index drives one ram at a time with the rest parked back." },
      { name: "rams", type: "number", default: "12", description: "How many rams on the hub, clamped to 0–24. Ignored when strokes is supplied." },
      { name: "pitch", type: "number", default: "13", description: "Half-angle of the two ranks either side of the hub plane, in degrees, clamped to 0–40. Zero is a genuinely flat array." },
      { name: "spin", type: "number", default: "0", description: "Turn of the whole array about its own axis, in degrees. Independent of view." },
      { name: "speed", type: "number", default: "0.3", description: "Opens and closes, or passes round the ring, per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag out from the hub to pull the array open; arrows step 5%, with shift 15%, Home closes and End opens." },
      { name: "onExtensionChange", type: "(extension: number) => void", description: "Fired throughout a drag or a key press, in controlled mode too." },
      { name: "signal", type: '"idle" | "ready" | "warning"', default: '"ready"', description: "Hub lamp: metal when idle, accent when ready, shell for a warning." },
      { name: "showEnvelope", type: "boolean", description: "Dashed circles at the closed and full reach radii. Defaults on in blueprint and off elsewhere." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow under the hub." },
      { name: "label", type: "string", description: "Caption under the array." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "One ram is four concentric stages: a fixed sleeve and three that slide, each moving a third of the tip's travel. Six world units of overlap remain between consecutive stages at full extension, so no stage ever leaves the one guiding it.",
      "The rams have different strokes on purpose — twelve identical telescopes cannot nest around one hub. Closed, every tip sits at the same radius; it is the extension that is ragged.",
      "Rams alternate above and below the hub plane by pitch, so plan view is unchanged and the array opens into two cones as the camera tips. At pitch 0 the tipped views collapse to a line, which is what a flat array seen edge-on is.",
      "Stage positions, overlaps and every projection are solved. The hub's face detail and the collars at each stage mouth are drawn, not driven.",
      "The three moving stages are one painted member stepping down through three diameters, not four differently coloured parts: a telescope reads as one spoke that gets thinner, and the collar at each mouth is what says where the joints are.",
      "Non-finite strokes render that ram closed rather than clamped onto the ring — a missing reading is not a zero reading.",
    ],
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
    slug: "robot-car", item: "robot-car", title: "Robot car", group: "Robots",
    summary: "An autonomous road car with a real steering rack: one angle in, two different wheel angles out, plus the lean the turn radius implies and a body that rides the road on its own axles.",
    files: ["components/ui/robot-car.tsx"],
    usage: `import { RobotCar } from "@/components/ui/robot-car"

<RobotCar behavior="cruise" />

// Plan view is where the two front wheels visibly disagree.
<RobotCar view="plan" steer={34} roughness={0} />
<RobotCar interactive onSteerChange={setSteer} />`,
    props: [
      view("profile", "car"),
      { name: "steer", type: "number", description: "Centreline steering angle in degrees, positive to starboard, clamped to ±60. Omit it and the behaviour drives the rack." },
      { name: "onSteerChange", type: "(steer: number) => void", description: "The commanded angle, while a person is steering it." },
      { name: "behavior", type: '"cruise" | "slalom" | "park" | "static"', default: '"cruise"', description: "Lane-keeping, a real weave, or a shuffle to full lock and back." },
      { name: "roughness", type: "number", default: "0.35", description: "How rough the road under the wheels is, 0 (glass) to 1. The body takes the least-squares line through its axle contacts; the dampers keep the rest." },
      { name: "speed", type: "number", default: "0.35", description: "Steering cycles per second. The road passes underneath at a rate the behaviour sets." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the car to steer it; arrow keys turn the rack 4° at a time, Home centres it, Escape hands it back." },
      { name: "showSensor", type: "boolean", default: "true", description: "The roof sensor drum." },
      { name: "showGround", type: "boolean", default: "true", description: "The carriageway the wheels are standing on, its lane markings, and the shadow under the car. The markings stand still in the world, so they say how fast it is going." },
      { name: "active", type: "boolean", description: "Light the lamps. Omit and they light while it is driving." },
      { name: "label", type: "string", description: "Caption underneath the car." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Solved: the two front wheel angles and the turn radius, from `ackermann()` — the inner wheel always turns harder, because it runs on the smaller circle. The body's heave and pitch are the least-squares line through the axle contacts, which is what a rigid body on springs actually settles to.", "Stated rather than solved: the body leans outward at a roll gradient of 5.5° per g, the way a car on road springs does, off a lateral acceleration capped at 0.8 g — a car at a real rack angle has slowed for the corner. There is no roll stiffness and no weight transfer, and the road is an illustrative profile rather than a measured surface.", "Nothing integrates a path. The steering angle is a pose, not a trajectory, and the car never goes anywhere."],
  },
  {
    slug: "transit-bus", item: "transit-bus", title: "Transit bus", group: "Robots",
    summary: "An articulated city bus. Steer the front axle and the rear section's angle is solved from the hitch, so the tail swings out of a turn and comes back straight on its own.",
    files: ["components/ui/transit-bus.tsx"],
    usage: `import { TransitBus } from "@/components/ui/transit-bus"

<TransitBus behavior="route" />

// Plan is where the articulation reads. A stop is one number.
<TransitBus view="plan" steer={30} />
<TransitBus doors={1} behavior="service" />`,
    props: [
      view("profile", "bus"),
      { name: "steer", type: "number", description: "Front-axle steering in degrees, positive to starboard, clamped to ±42. Omit it and the behaviour drives it." },
      { name: "onSteerChange", type: "(steer: number) => void", description: "The commanded angle, while a person is steering it." },
      { name: "doors", type: "number", description: "Doors, 0 shut to 1 open. The bus kneels — and stops — on the same number, because a bus kneels to open and a bus with its doors open is standing. Omit it and the behaviour works the stop." },
      { name: "behavior", type: '"route" | "service" | "static"', default: '"route"', description: "Running a route, or working a stop: pull in, kneel, open, stand, shut, pull away." },
      { name: "articulated", type: "boolean", default: "true", description: "A rear section on a turntable, or one rigid body. Turning it off removes the hitch and the concertina." },
      { name: "speed", type: "number", default: "0.3", description: "Steering cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the bus to steer it; arrow keys turn the rack 3° at a time." },
      { name: "showGround", type: "boolean", default: "true", description: "The carriageway, and the kerb it pulls up to." },
      { name: "active", type: "boolean", description: "Light the destination sign. Omit and it lights in service." },
      { name: "label", type: "string", description: "Caption underneath the bus." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Solved: the articulation angle, from `hitchAngle()`. The pivot rides a circle behind the drive axle and the towed axle cannot slide sideways, which fixes the angle between the sections. It is a steady state with no history, so a bus that has been round a roundabout comes out of it straight rather than unwinding.", "The concertina ribs belong half to each section, so the fold genuinely opens on the outside of the bend. The plug doors stand off the side before their leaves part, and the wheels stop turning while they are open.", "Illustrated: the kneel is a stated drop and roll on the doors' own number. No tyre model, no load, no swept-path envelope, and nothing integrates a manoeuvre."],
  },
  {
    slug: "cargo-plane", item: "cargo-plane", title: "Cargo plane", group: "Robots",
    summary: "A high-wing freighter that banks because it was asked to turn. Give it a rate of turn and an airspeed and the bank is solved; the ailerons carry the roll it has not finished.",
    files: ["components/ui/cargo-plane.tsx"],
    usage: `import { CargoPlane } from "@/components/ui/cargo-plane"

<CargoPlane behavior="circuit" engines={4} />

// The same commanded turn banks further at speed.
<CargoPlane turn={3} airspeed={160} view="front" />
<CargoPlane behavior="approach" />`,
    props: [
      view("plan", "aircraft"),
      { name: "turn", type: "number", description: "Commanded rate of turn in degrees per second, positive to starboard, clamped to ±6. Omit it and the behaviour flies it." },
      { name: "onTurnChange", type: "(turn: number) => void", description: "The commanded rate, while a person is flying it." },
      { name: "airspeed", type: "number", default: "110", description: "True airspeed in metres per second. The bank for a given rate of turn is not the same at every speed." },
      { name: "configuration", type: "number", description: "Flaps, gear and ramp together, 0 clean to 1 dirty. Omit it and the behaviour sets it." },
      { name: "behavior", type: '"cruise" | "circuit" | "approach" | "static"', default: '"cruise"', description: "Hold a heading, fly rate-one turns each way, or come down dirty." },
      { name: "engines", type: "2 | 4", default: "4", description: "Two engines or four, on the same wing." },
      { name: "speed", type: "number", default: "0.2", description: "Turn cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the aircraft to command a turn; arrow keys change the rate half a degree per second at a time." },
      { name: "showRamp", type: "boolean", default: "true", description: "The rear loading ramp, down at the dirty end of the configuration." },
      { name: "active", type: "boolean", description: "Light the navigation lamps and the beacon." },
      { name: "label", type: "string", description: "Caption underneath the aircraft." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Solved: the bank, from `coordinatedBank()`. A rate of turn at an airspeed fixes the radius, and a coordinated turn stands at atan(v²/rg) — so doubling the speed at the same radius asks for four times the tangent.", "The ailerons are not a second animation: they carry the difference between the bank the aircraft is holding and the one the turn asks for, so they return to neutral once the turn is established and never move in level flight.", "Illustrated: the wing is a flat plate and the propellers are drawn rather than solved. Nothing computes lift, drag, load factor or a stall, and the aircraft does not travel."],
  },
  {
    slug: "hydrofoil-craft", item: "hydrofoil-craft", title: "Hydrofoil craft", group: "Robots",
    summary: "A foilborne ferry — the one machine here that climbs out of its own ground plane. Lift goes as the square of speed, so the surface-piercing V sheds immersed area and the hull rises clear.",
    files: ["components/ui/hydrofoil-craft.tsx"],
    usage: `import { HydrofoilCraft } from "@/components/ui/hydrofoil-craft"

<HydrofoilCraft behavior="takeoff" />

// Below takeoff she is hullborne and rides the swell.
<HydrofoilCraft knots={12} />
<HydrofoilCraft knots={44} view="front" />`,
    props: [
      view("profile", "craft"),
      { name: "knots", type: "number", description: "Speed through the water, 0–60. Supplying it stops the loop." },
      { name: "onKnotsChange", type: "(knots: number) => void", description: "The commanded speed, while a person is at the throttle." },
      { name: "takeoffSpeed", type: "number", default: "18", description: "The speed the foils can first carry the boat at. Below it she stays hullborne however hard she is driven." },
      { name: "behavior", type: '"takeoff" | "foilborne" | "moor" | "static"', default: '"takeoff"', description: "Work up through the transition and back down, hold her up, or lie alongside." },
      { name: "speed", type: "number", default: "0.22", description: "Throttle cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across her to set the speed; arrow keys move it two knots at a time, Home stops, End is full ahead." },
      { name: "showSea", type: "boolean", default: "true", description: "The sea, the waterline, and the hull's shadow in it." },
      { name: "active", type: "boolean", description: "Spray off the struts. Omit and it appears whenever they are cutting water." },
      { name: "label", type: "string", description: "Caption underneath the craft." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Solved: the rise, from `foilRise()`. A surface-piercing foil carrying a steady weight has to shed immersed area as 1/v², and the only way it can is by climbing until less of the V is wetted — so the accent on each limb is genuinely the part still below the waterline after the boat has risen.", "Below the takeoff speed the foil cannot carry her at all: she stays hullborne and rides the swell, and the ride goes quiet as she comes up, which is what a hydrofoil is for.", "Illustrated: the swell is a stated shape and the bow's lift through the transition is a rule. No drag, no wave-making, no cavitation, no righting moment, and she does not travel."],
  },
  {
    slug: "launch-vehicle", item: "launch-vehicle", title: "Launch vehicle", group: "Robots",
    summary: "A two-stage orbital booster: it flies a pitch program, gimbals against it, throws half of itself away, and reports the ideal Δv left from the rocket equation.",
    files: ["components/ui/launch-vehicle.tsx"],
    usage: `import { LaunchVehicle } from "@/components/ui/launch-vehicle"

<LaunchVehicle behavior="ascent" />

// One number is the whole flight.
<LaunchVehicle ascent={0.62} />
<LaunchVehicle ascent={0} showReadout={false} engines={5} />`,
    props: [
      view("front", "vehicle"),
      { name: "ascent", type: "number", description: "Where the vehicle is in its ascent, 0 on the pad to 1 at insertion. Supplying it stops the loop." },
      { name: "onAscentChange", type: "(ascent: number) => void", description: "The commanded point in the ascent, while a person is scrubbing it." },
      { name: "behavior", type: '"ascent" | "hold" | "static"', default: '"ascent"', description: "Fly the ascent, or sit on the pad." },
      { name: "engines", type: "5 | 9", default: "9", description: "Engines in the first-stage cluster. They all gimbal together." },
      { name: "speed", type: "number", default: "0.16", description: "Flights per second, at the outside." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag up the frame to scrub the ascent; arrow keys move it four percent at a time, Home is the pad and End is insertion." },
      { name: "showPad", type: "boolean", default: "true", description: "The pad and its hold-downs, which fall away as she climbs." },
      { name: "showReadout", type: "boolean", default: "true", description: "Pitch, the stage that is burning, and the ideal Δv still attached." },
      { name: "label", type: "string", description: "Caption underneath the vehicle." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["Solved: the remaining Δv, from `tsiolkovsky()` summed over the stages still attached — so the number drops the moment the booster lets go, which is the only honest way to draw staging. The stage figures are stated, not a real vehicle.", "The engines gimbal against the program rather than being animated: they carry the pitch the stack has not taken up, so they centre once it is tracking and swing hardest through the pitchover.", "Illustrated: the pitch program is a curve chosen to look like a gravity turn, not a solved trajectory. There is no thrust, drag, mass flow, gravity loss or atmosphere, and no altitude is computed — the drawing is in the vehicle's own frame, and the pad is what falls away."],
  },
  {
    slug: "strike-starfighter", item: "strike-starfighter", title: "Strike starfighter", group: "Robots",
    summary: "A split-foil attack fighter: four wings on two fore-aft hinges that open from a cruise plane into an X, carrying their own engines and tip cannons with them.",
    files: ["components/ui/strike-starfighter.tsx"],
    usage: `import { StrikeStarfighter } from "@/components/ui/strike-starfighter"

<StrikeStarfighter behavior="attack" />

// Front is where the X is; plan is the same hinge from above.
<StrikeStarfighter foils={1} view="front" />
<StrikeStarfighter foils={0} bank={35} />`,
    props: [
      view("front", "fighter"),
      { name: "foils", type: "number", description: "The S-foils, 0 closed (cruise) to 1 open (attack). Supplying it stops the loop." },
      { name: "onFoilsChange", type: "(foils: number) => void", description: "The commanded opening, while a person is working the foils." },
      { name: "bank", type: "number", description: "Roll about the fore-aft axis in degrees. Omit it and the behaviour flies it." },
      { name: "behavior", type: '"patrol" | "attack" | "static"', default: '"patrol"', description: "Cruise with the foils closed and open them for a look, or hold them open and fly hard." },
      { name: "speed", type: "number", default: "0.25", description: "Foil cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag up the frame to open the foils; arrow keys move them five percent at a time." },
      { name: "showCannons", type: "boolean", default: "true", description: "Cannons on the four wing tips. They are carried on the panels, so opening the foils spreads them." },
      { name: "active", type: "boolean", description: "Light the engines, the canopy and the nose sensor." },
      { name: "label", type: "string", description: "Caption underneath the fighter." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["One geometry, four panels, two hinges. Each pair swings about a fore-aft axis at its own root, and every panel keeps its span and its chord at every opening — the engines and the tip cannons are carried on the panels rather than drawn where they look right, so opening the foils genuinely spreads the guns and the thrust line.", "`bank` rolls the whole airframe about the same axis, which is why an opened X reads as an X from every camera: it is projected, not redrawn.", "A science-fiction archetype and nothing more: no character, no markings, no livery. Nothing here is aerodynamic — there is no air — and the fighter does not travel."],
  },
  {
    slug: "ion-interceptor", item: "ion-interceptor", title: "Ion interceptor", group: "Robots",
    summary: "A twin ion-drive interceptor: hexagonal panels pitching on lateral pylons, around a pod that yaws inside them and carries its viewport and emitters round with it.",
    files: ["components/ui/ion-interceptor.tsx"],
    usage: `import { IonInterceptor } from "@/components/ui/ion-interceptor"

<IonInterceptor behavior="patrol" />

// Square to the camera the panels are hexagons; from above they are lines.
<IonInterceptor panelPitch={0} view="front" />
<IonInterceptor panelPitch={55} yaw={30} view="plan" />`,
    props: [
      view("front", "interceptor"),
      { name: "panelPitch", type: "number", description: "Panel pitch about the pylons in degrees, clamped to ±80. Supplying it stops the loop." },
      { name: "onPanelPitchChange", type: "(pitch: number) => void", description: "The commanded pitch, while a person is working the panels." },
      { name: "yaw", type: "number", description: "The pod's own yaw inside the pylons, ±55 degrees. Omit it and the behaviour turns it." },
      { name: "behavior", type: '"patrol" | "intercept" | "static"', default: '"patrol"', description: "Drift with the panels near square, or work them hard while the pod hunts." },
      { name: "ribs", type: "number", default: "3", description: "Ribs across each panel's face, 0–6. They foreshorten with the panel and vanish with it edge-on." },
      { name: "speed", type: "number", default: "0.3", description: "Panel cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the interceptor to pitch the panels; arrow keys move them 5° at a time." },
      { name: "active", type: "boolean", description: "Light the viewport and the emitters." },
      { name: "label", type: "string", description: "Caption underneath the interceptor." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: ["The panels are flat plates in space, not artwork: the same geometry is a pair of tall hexagons head-on, a pair of lines from straight above when they are square, and a pair of widening slabs as they come round. Pitch is a rotation about each pylon's own axis.", "The pod turns inside the pylons, so the viewport, the armoured face and the emitters all come round with it while the pylons and panels stay where the airframe put them.", "A science-fiction archetype and nothing more: no character, no markings, no livery. There is no aerodynamics here and no ion physics either."],
  },
  {
    slug: "vehicle-geometry", item: "vehicle-geometry", title: "Vehicle geometry", group: "Foundations",
    summary: "The constraints a vehicle works against: Ackermann steering, steady-state articulation, the coordinated bank, a rigid body on N axles, the rocket equation, and surface-piercing foil lift.",
    files: ["lib/robocn/vehicle.ts"],
    usage: `import { ackermann, hitchAngle, coordinatedBank, foilRise } from "@/lib/robocn/vehicle"

const rack = ackermann(25, { wheelbase: 120, track: 62 })
rack.inner > rack.outer   // the inner wheel runs on the smaller circle
hitchAngle(25, { wheelbase: 106, track: 60, hitch: 29 }, 57)
coordinatedBank(110, 2100) // degrees
foilRise(32, 18)           // 0 hullborne .. 1 foilborne`,
    api: [
      { name: "ackermann", type: "(steer: number, geometry: SteerGeometry) => AckermannPose", description: "The angle the centreline would need, answered with the two the wheels actually take, plus the radius the rear axle runs on. Exact geometry; the inner wheel always turns harder." },
      { name: "hitchAngle", type: "(steer, tractor: TractorGeometry, trailerWheelbase) => number", description: "The steady-state articulation angle of a towed section, signed with the steer. No history, so straightening the rack straightens the vehicle." },
      { name: "coordinatedBank", type: "(speed, radius, gravity?) => number", description: "atan(v²/rg), in degrees. An infinite radius or no speed is wings level." },
      { name: "axleRide", type: "(surface: (x) => number, positions) => AxleRide", description: "A rigid body on N axles over a surface: the least-squares heave and pitch it settles to, and each axle's own travel from it." },
      { name: "tsiolkovsky / stackDeltaV", type: "(massRatio, exhaustVelocity) => number / (stages) => number", description: "vₑ ln(mr), and the sum over the stages still attached. A ratio at or below one is no Δv." },
      { name: "foilLift / foilRise", type: "(speed, area, coefficient?, density?) => number / (speed, takeoff) => number", description: "The ideal lift equation, and the rise that follows from it: below the takeoff speed nothing, above it the wetted fraction is (takeoff/v)² and the rest is the climb." },
      { name: "pitchProgram", type: "(fraction: number, kick?: number) => number", description: "Illustrative. Degrees from vertical over an ascent: vertical off the pad, kicked over early, most of the turn taken in the middle. Not a solved trajectory." },
      { name: "roadProfile", type: "(x, amplitude?, wavelength?) => number", description: "Illustrative. Two sines that do not share a period, so a body running over it never repeats over a short run." },
      { name: "wheelSolid / rollPoint", type: "(centre, radius, halfWidth, steer?, steps?) => Vec3[] / (point, depth, roll, centre?) => Vec3", description: "Drawing geometry: a steered wheel as the solid it is, and a profile-elevation point lifted into the world and rolled about the fore-aft axis. Both feed straight into slabPath." },
    ],
    notes: ["Everything here is exact geometry except `pitchProgram` and `roadProfile`, which are stated shapes and say so. Nothing integrates a path, a force or a mass.", "Positive is to starboard everywhere — clockwise seen from above — the same sense as every heading in the set. `rollPoint` follows the aircraft convention instead: positive puts the starboard side down."],
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
    slug: "planetary-gearbox", item: "planetary-gearbox", title: "Planetary gearbox", group: "Machines",
    summary: "A reduction stage with its face off: a sun driving planets inside a held ring, with real meshing teeth. The reduction is read off the tooth counts rather than typed in.",
    files: ["components/ui/planetary-gearbox.tsx"],
    usage: `import { PlanetaryGearbox } from "@/components/ui/planetary-gearbox"

<PlanetaryGearbox sunTeeth={18} planetTeeth={12} planets={3} />

// Controlled, or a shaft you can wind.
<PlanetaryGearbox angle={140} />
<PlanetaryGearbox interactive onAngleChange={setAngle} />`,
    props: [
      view("front", "gearbox"),
      { name: "angle", type: "number", description: "Controlled input shaft angle in degrees. Omit it and the shaft runs behavior." },
      { name: "behavior", type: '"run" | "jog" | "static"', default: '"run"', description: "Turn continuously, or index in half-turn steps with a dwell between." },
      { name: "speed", type: "number", default: "0.3", description: "Input turns per second running, or half-turn steps per second jogging." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag round the centre to wind the input shaft, or arrow-key it 10° at a time." },
      { name: "onAngleChange", type: "(angle: number) => void", description: "Input angle, wrapped to 0–360, whenever a person moves it." },
      { name: "sunTeeth", type: "number", default: "16", description: "Teeth on the sun, rounded and clamped to 8–40." },
      { name: "planetTeeth", type: "number", default: "12", description: "Teeth on each planet. Raised to the nearest count that assembles, and capped so neighbours cannot overlap." },
      { name: "planets", type: "number", default: "3", description: "Equally spaced planets, rounded and clamped to 3–5." },
      { name: "showHousing", type: "boolean", default: "true", description: "Draw the case and its bolt circle around the train." },
      { name: "showRatio", type: "boolean", default: "true", description: "Print the tooth counts and the reduction under the drawing." },
      { name: "label", type: "string", description: "Caption below the ratio readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The teeth are geometry. Every member's phase comes from the mesh relation in transmission-geometry, so the planets counter-rotate at −sun/planet and the ring provably does not move at all with the sun — which is what makes the carrier the output and the reduction exactly 1 + ring/sun.",
      "Tooth counts you ask for are not always the counts you get: the ring is sun + 2 × planet, and (sun + ring) has to divide by the planet count or the planets cannot all mesh at once. The planet count is raised until it does, and the readout shows what was built.",
      "Geometry only — no torque, no backlash, no friction, no efficiency. It will happily turn a ratio that would strip itself.",
    ],
  },
  {
    slug: "belt-drive", item: "belt-drive", title: "Belt drive", group: "Machines",
    summary: "A toothed belt between two pulleys with an idler you can wind down to take up slack. The belt is routed along its real tangents, and its teeth march by arc length.",
    files: ["components/ui/belt-drive.tsx"],
    usage: `import { BeltDrive } from "@/components/ui/belt-drive"

<BeltDrive driveTeeth={18} drivenTeeth={30} tension={0.45} />

// Controlled, or a belt you can scrub.
<BeltDrive travel={1.5} />
<BeltDrive interactive onTravelChange={setTravel} />`,
    props: [
      view("front", "drive"),
      { name: "travel", type: "number", description: "Controlled belt travel, in turns of the drive pulley. Omit it and the belt runs behavior." },
      { name: "behavior", type: '"run" | "shuttle" | "static"', default: '"run"', description: "Run one way, or shuttle back and forth across four fifths of a turn." },
      { name: "speed", type: "number", default: "0.35", description: "Drive turns per second, or shuttles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the belt along its run, or arrow-key it a twentieth of a turn at a time." },
      { name: "onTravelChange", type: "(travel: number) => void", description: "Belt travel in drive turns, throughout a drag or a key press." },
      { name: "driveTeeth", type: "number", default: "18", description: "Teeth on the driving pulley, rounded and clamped to 10–48. The pitch radius follows." },
      { name: "drivenTeeth", type: "number", default: "30", description: "Teeth on the driven pulley, rounded and clamped to 10–48." },
      { name: "tension", type: "number", default: "0.45", description: "How far the idler is wound down its slot, 0–1. Lengthens the belt and takes more wrap." },
      { name: "showIdler", type: "boolean", default: "true", description: "Include the tensioner in the loop. Without it the belt is a plain two-pulley run." },
      { name: "showPlate", type: "boolean", default: "true", description: "Draw the back plate the shafts are carried in." },
      { name: "label", type: "string", description: "Caption below the ratio and belt-length readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Not the conveyor: nothing rides on this belt, it transmits. The driven pulley turns at the ratio the tooth counts give, and the teeth are placed by arc length along the belt, so they stay in step with both pulleys.",
      "The path is the taut one — external tangents between the pulleys and a real wrap arc on each. Moving the idler changes the belt length, and the readout says by how much; the component computes the path a belt would take rather than holding one length and slackening.",
      "Geometry only: no tension, no tooth jump, no slip.",
    ],
  },
  {
    slug: "cable-carrier", item: "cable-carrier", title: "Cable carrier", group: "Machines",
    summary: "The energy chain that feeds a moving axis. The chain cannot change length, so its fold travels at exactly half the carriage — which is the whole mechanism.",
    files: ["components/ui/cable-carrier.tsx"],
    usage: `import { CableCarrier } from "@/components/ui/cable-carrier"

<CableCarrier links={26} cables={3} />

// Controlled, or a carriage you can drag.
<CableCarrier travel={0.65} />
<CableCarrier interactive onTravelChange={setTravel} />`,
    props: [
      view("profile", "carrier"),
      { name: "travel", type: "number", description: "Controlled carriage position, 0–1 along the run. Omit it and the carriage runs behavior." },
      { name: "behavior", type: '"cycle" | "creep" | "static"', default: '"cycle"', description: "Run the full stroke with a dwell at each end, or creep back and forth about the middle." },
      { name: "speed", type: "number", default: "0.25", description: "Full strokes per second, or creep cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the carriage along its rail, or arrow-key it five percent at a time." },
      { name: "onTravelChange", type: "(travel: number) => void", description: "Carriage travel, 0–1, throughout a drag or a key press." },
      { name: "links", type: "number", default: "26", description: "Links in the chain, rounded and clamped to 8–40. The pitch is whatever the fixed length divides into." },
      { name: "cables", type: "number", default: "3", description: "Strands threaded through the chain, rounded and clamped to 0–4." },
      { name: "showRail", type: "boolean", default: "true", description: "Draw the rail the carriage runs on above the chain." },
      { name: "label", type: "string", description: "Caption below the travel readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Links are placed by arc length along the solved path, not drawn in three poses and interpolated, so the pitch between neighbours is the same on both runs and right round the bend at every travel.",
      "The fold moves at half the carriage rate because the chain length is fixed — solve (bend − anchor) + πr + (bend − carriage) = length and that is what falls out. The readout prints the length so you can watch it not change.",
      "The chain plates are drawn in their own plane and have no modelled thickness; the trough, the rail and the carriage do.",
    ],
  },
  {
    slug: "mecanum-wheel", item: "mecanum-wheel", title: "Mecanum wheel", group: "Machines",
    summary: "The wheel that lets a base drive sideways: barrel rollers set at 45° out of the wheel plane, in a left hand and a right hand.",
    files: ["components/ui/mecanum-wheel.tsx"],
    usage: `import { MecanumWheel } from "@/components/ui/mecanum-wheel"

<MecanumWheel hand="left" rollers={9} view="iso" />

// Controlled, or a hub you can spin.
<MecanumWheel angle={120} />
<MecanumWheel interactive onAngleChange={setAngle} />`,
    props: [
      view("profile", "wheel"),
      { name: "angle", type: "number", description: "Controlled hub angle in degrees. Omit it and the hub runs behavior." },
      { name: "behavior", type: '"roll" | "crab" | "static"', default: '"roll"', description: "Roll continuously, or reverse each half cycle the way a corner drives when the base goes sideways." },
      { name: "speed", type: "number", default: "0.3", description: "Hub turns per second rolling, or crab cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag round the hub to spin it, or arrow-key it 10° at a time." },
      { name: "onAngleChange", type: "(angle: number) => void", description: "Hub angle, wrapped to 0–360, whenever a person moves it." },
      { name: "hand", type: '"left" | "right"', default: '"right"', description: "Which way the rollers lean. A holonomic base needs one of each per axle." },
      { name: "rollers", type: "number", default: "9", description: "Barrel rollers round the rim, rounded and clamped to 6–14." },
      { name: "showHub", type: "boolean", default: "true", description: "Draw the hub, spokes and stub axle inside the rollers." },
      { name: "label", type: "string", description: "Caption below the hand and roller readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The rollers are modelled rather than drawn: each barrel's axis is tilted 45° out of the wheel plane toward the rim tangent, and both of its ends go through the shared camera. That is why flipping the hand reverses the skew and why the part reads best in iso.",
      "Roller spin is not solved. A mecanum roller turns from contact with the floor, and there is no floor here — only the hub angle is driven.",
    ],
  },
  {
    slug: "tool-changer", item: "tool-changer", title: "Tool changer", group: "Machines",
    summary: "The coupler between a wrist and whatever it is holding, and the only machine in the set that comes apart. One axis seats the halves and then drives the lock.",
    files: ["components/ui/tool-changer.tsx"],
    usage: `import { ToolChanger } from "@/components/ui/tool-changer"

<ToolChanger tool="spindle" balls={6} />

// Controlled, or a half you can lift into place.
<ToolChanger engagement={1} />
<ToolChanger interactive onEngagementChange={setEngagement} />`,
    props: [
      view("front", "coupler"),
      { name: "engagement", type: "number", description: "Controlled engagement, 0 parked to 1 locked. Omit it and the coupler runs behavior." },
      { name: "behavior", type: '"dock" | "latch" | "static"', default: '"dock"', description: "Run a whole tool change, or work the lock with the halves left seated." },
      { name: "speed", type: "number", default: "0.3", description: "Dock cycles per second, or latch cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the tool half up to the coupler, or arrow-key it five percent at a time." },
      { name: "onEngagementChange", type: "(engagement: number) => void", description: "Engagement, 0–1, throughout a drag or a key press." },
      { name: "tool", type: '"gripper" | "spindle" | "vacuum" | "none"', default: '"gripper"', description: "What is hanging off the tool half." },
      { name: "balls", type: "number", default: "6", description: "Lock balls round the spigot, rounded and clamped to 3–8." },
      { name: "showDock", type: "boolean", default: "true", description: "Draw the stand the tool half is parked in." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "One axis, two stages the drawing keeps separate: below 0.6 the halves are closing the gap and the lock cannot move; above it they are seated and the piston drives the balls out. The accessible label names which of parked, seated and locked it is in.",
      "Nothing is drawn locked. The balls are wherever the piston has pushed them, which is why the lock reads as a mechanism rather than as a state colour.",
      "No collision, no keying, no air or signal couplings — the pneumatic and electrical passes a real changer carries are not modelled.",
    ],
  },
  {
    slug: "suction-gripper", item: "suction-gripper", title: "Suction gripper", group: "Machines",
    summary: "A bar of bellows cups and the sheet it picks. The head stops where the part is and everything past contact goes into the bellows instead of the stroke.",
    files: ["components/ui/suction-gripper.tsx"],
    usage: `import { SuctionGripper } from "@/components/ui/suction-gripper"

<SuctionGripper cups={5} vacuum />

// Controlled, or a bar you can press down.
<SuctionGripper descent={0.9} holding />
<SuctionGripper interactive onDescentChange={setDescent} />`,
    props: [
      view("front", "head"),
      { name: "descent", type: "number", description: "Controlled descent, 0 raised to 1 pressed. Omit it and the head runs behavior." },
      { name: "behavior", type: '"cycle" | "breathe" | "static"', default: '"cycle"', description: "Work a pick — down, seal, lift, place, release — or breathe about the middle of the stroke." },
      { name: "speed", type: "number", default: "0.3", description: "Pick cycles per second, or breaths per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the bar down onto the sheet, or arrow-key it five percent at a time." },
      { name: "onDescentChange", type: "(descent: number) => void", description: "Descent, 0–1, throughout a drag or a key press." },
      { name: "vacuum", type: "boolean", default: "true", description: "Is the line live at all. With it off the cups never take the sheet." },
      { name: "holding", type: "boolean", description: "Override whether the sheet is held. Left out, a controlled head holds once the lips are down and an uncontrolled one holds for the carrying part of its cycle." },
      { name: "cups", type: "number", default: "5", description: "Bellows cups on the bar, rounded and clamped to 2–8." },
      { name: "showSheet", type: "boolean", default: "true", description: "Draw the sheet and the table it starts on." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "robot-gripper's opposite number: no fingers, no pivot, nothing that closes. The axis is one descent, and past contact the head stops and the bellows take up the rest — which is why a cup bar can land on a part whose height it does not know.",
      "A held sheet rides the lips, so the vacuum is visible in where the part is rather than in a lamp. The line state is an input, not something inferred from the pose: vacuum says whether it is live and holding overrides the seal outright.",
      "No flow, no leak-down, no payload check. Nothing here says whether the part is heavy enough to fall off.",
    ],
  },
  {
    slug: "robot-hand", item: "robot-hand", title: "Robot hand", group: "Machines",
    summary: "Five digits on a thumb with a real saddle joint. Fingers abduct about the palm normal, the thumb opposes across the palm, and the gap between the two pads is a number the solver produces rather than a shape the drawing implies.",
    files: ["components/ui/robot-hand.tsx"],
    usage: `import { RobotHand } from "@/components/ui/robot-hand"

<RobotHand grasp="pinch" view="iso" />

// Controlled, posed digit by digit, or a hand you can close.
<RobotHand curl={0.8} grasp="power" side="left" spread={-0.4} />
<RobotHand digits={[0.2, 0, 1, 1, 1]} wristPitch={-25} />
<RobotHand interactive onCurlChange={setCurl} onGraspChange={setGrasp} />`,
    props: [
      view("front", "hand"),
      { name: "curl", type: "number", description: "Controlled closure, 0 open to 1 shut, scaling the grasp. Omit it and the hand runs behavior." },
      { name: "grasp", type: '"open" | "pinch" | "tripod" | "power" | "hook" | "point" | "lateral"', default: '"power"', description: "Which grip the digits close into. Each names a per-digit closure, a thumb opposition and a finger fan that curl then scales." },
      { name: "digits", type: "(number | null)[]", description: "Per-digit closure, thumb first, overriding the grasp for any entry that is a finite number. A hand posed exactly rather than by name." },
      { name: "spread", type: "number", description: "Finger fan, -1 pressed together to 1 splayed. Defaults to the grasp's own." },
      { name: "opposition", type: "number", description: "Thumb across the palm, 0 alongside to 1 opposed. Defaults to the grasp's own." },
      { name: "side", type: '"left" | "right"', default: '"right"', description: "A hand is handed. Left is right mirrored in x, not a second drawing." },
      { name: "wristPitch", type: "number", default: "0", description: "Wrist flexion in degrees, positive toward the palm. Applied after the digits solve, so it never changes a grasp." },
      { name: "wristYaw", type: "number", default: "0", description: "Wrist deviation in degrees, positive toward the thumb." },
      { name: "behavior", type: '"grip" | "wave" | "static"', default: '"grip"', description: "Close onto the grip and open again, or ripple the digits one after another." },
      { name: "speed", type: "number", default: "0.3", description: "Grips per second, or waves per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to close the hand; a click, Enter or Space steps to the next grasp." },
      { name: "onCurlChange", type: "(curl: number) => void", description: "Closure, 0–1, throughout a drag or a key press." },
      { name: "onGraspChange", type: "(grasp: HandGrasp) => void", description: "The grasp stepped to by a click or a key." },
      { name: "showWrist", type: "boolean", default: "true", description: "Draw the wrist collar and cuff below the palm." },
      { name: "showPinch", type: "boolean", default: "true", description: "Draw the caliper between the thumb pad and the index pad." },
      { name: "label", type: "string", description: "Caption below the grasp readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The thumb has a real saddle. Two driven angles place the metacarpal — swung across the palm and lifted out of it — and the flexion plane rolls about that metacarpal, which is the rotation opposition really is. That is why tripod and lateral exist at all.",
      "Each finger is a three-link chain solved forward in a plane abducted about the palm normal, so spreading the hand is a pose rather than a second drawing, and a closing hand foreshortens instead of shrinking.",
      "The pinch gap is reported, never asserted. It is the distance between two pads, in world units; the hand is not holding anything and there is no contact, no grasp planning and no force anywhere in it.",
      "A curled hand in front elevation foreshortens into stubs, because that is what a hand pointed at a camera does. Use iso or profile to read a grip.",
    ],
  },
  {
    slug: "hand-kinematics", item: "hand-kinematics", title: "Hand kinematics", group: "Foundations",
    summary: "The dependency-free hand solver: five digits in one frame, a thumb on a two-angle saddle joint with the coupled axial roll opposition really is, and the pad gap that falls out of it.",
    files: ["lib/robocn/hand.ts"],
    usage: `import { solveHand, graspProfile } from "@/lib/robocn/hand"

const pose = solveHand({ grasp: "pinch", curl: 1, side: "left" })
pose.digits   // thumb first: joints, radii, closure, tip, pad
pose.pinch    // { thumb, finger, gap } in world units
graspProfile("tripod") // { digits, opposition, spread }`,
    api: [
      { name: "solveHand", type: "(options?: HandOptions) => HandPose", description: "Five digits in hand-local 3D: x across the palm toward the thumb, y up the hand, z out of the palm. The wrist is the origin." },
      { name: "HandOptions", type: "{ grasp?, curl?, digits?, spread?, opposition?, side?, wristPitch?, wristYaw? }", description: "Same axes as RobotHand. Every field is finite-checked; nonsense degrades to a neutral open hand." },
      { name: "HandDigit", type: "{ name, joints: Vec3[], radii, closure, tip, pad }", description: "Knuckle then one point per joint out to the tip, with the contact pad on the flexion side of the last phalanx." },
      { name: "graspProfile", type: "(grasp: HandGrasp) => HandGraspProfile", description: "The per-digit closure, thumb opposition and finger fan a named grip asks for." },
      { name: "handGoal / handWave", type: "(behavior, clock) => number", description: "The grip loop and the digit ripple, as pure functions of the clock." },
    ],
    notes: [
      "Phalanx lengths are preserved at every closure, spread and wrist angle, because each digit is posed forward in a plane whose two basis vectors are unit and perpendicular.",
      "A tip pinch sits at the very edge of the thumb's workspace, which is why the grasp table closes the thumb so little for it: in a real pinch the thumb is nearly straight and the finger comes to meet it.",
      "No contact, no forces, no collision between digits. Nothing stops a hand closing through itself if you pose it that way.",
    ],
  },
  {
    slug: "robot-foot", item: "robot-foot", title: "Robot foot", group: "Machines",
    summary: "One ankle, one toe hinge, and the load moving between them: dorsiflexed at heel strike, flat at mid-stance, plantarflexed with the heel lifted at push-off.",
    files: ["components/ui/robot-foot.tsx"],
    usage: `import { RobotFoot } from "@/components/ui/robot-foot"

<RobotFoot behavior="step" side="left" />

// Controlled, or a foot you can roll by hand.
<RobotFoot roll={0.85} view="iso" />
<RobotFoot interactive onRollChange={setRoll} />`,
    props: [
      view("profile", "foot"),
      { name: "roll", type: "number", description: "Controlled stance, 0 at heel strike to 1 at toe-off. Supplying it stops the loop and keeps the foot on the floor." },
      { name: "behavior", type: '"step" | "rock" | "static"', default: '"step"', description: "Roll through a stance then lift and carry back, or rock heel to toe without ever leaving the floor." },
      { name: "side", type: '"left" | "right"', default: '"right"', description: "A foot is handed; left is right mirrored across the machine's axis." },
      { name: "speed", type: "number", default: "0.5", description: "Steps per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag left and right to roll the foot heel to toe." },
      { name: "onRollChange", type: "(roll: number) => void", description: "Stance fraction, 0–1, throughout a drag or a key press." },
      { name: "showLoad", type: "boolean", default: "true", description: "Tint the heel, ball and toe pads by how much of each is still on the floor." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the floor line the sole rolls on." },
      { name: "label", type: "string", description: "Caption below the stance readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The toe plate is hinged at the ball rather than welded to the sole, so plantarflexing over a planted foot extends that hinge and lifts the heel instead of driving the toe through the floor.",
      "The ankle strut's length is measured between the two points the pose produced, so its stroke is a consequence of the joint angle rather than an illustration of one.",
      "The loads are geometry — which parts of the sole are still down — and not forces. Nothing here weighs anything.",
    ],
  },
  {
    slug: "robot-leg", item: "robot-leg", title: "Robot leg", group: "Machines",
    summary: "A hip, a knee and an ankle solved to wherever the foot has to be, with the knee breaking forward and two strut actuators drawn between solved points. Grab it and the foot is yours.",
    files: ["components/ui/robot-leg.tsx"],
    usage: `import { RobotLeg } from "@/components/ui/robot-leg"

<RobotLeg behavior="stride" side="left" />

// Controlled: the foot is the input, the joints are the output.
<RobotLeg target={{ x: 22, y: 18 }} stance={0.6} />
<RobotLeg interactive onTargetChange={setTarget} />`,
    props: [
      view("profile", "leg"),
      { name: "target", type: "{ x: number; y: number }", description: "Controlled ankle in leg world units: x toward the nose, y up from the floor. Supplying it stops the loop and solves to it." },
      { name: "stance", type: "number", description: "Controlled hip height, 0 crouched to 1 standing tall." },
      { name: "behavior", type: '"stride" | "squat" | "kick" | "static"', default: '"stride"', description: "What the leg does when target is not supplied: walk the stride cycle, drop and rise on a planted foot, or swing the foot through an arc." },
      { name: "stride", type: "number", default: "0.7", description: "Stride length, 0 to 1." },
      { name: "lift", type: "number", default: "0.6", description: "Foot clearance through the swing, 0 to 1." },
      { name: "side", type: '"left" | "right"', default: '"right"', description: "A leg is handed; left is right mirrored across the machine's axis." },
      { name: "speed", type: "number", default: "0.6", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the foot anywhere; the hip and knee solve to it, and releasing eases back into the behaviour." },
      { name: "onTargetChange", type: "(target: Vec2) => void", description: "The foot position throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the floor line." },
      { name: "label", type: "string", description: "Caption below the joint readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The knee always breaks forward out of the hip-to-ankle line, which is the joint a person has. An out-of-reach foot stretches the leg toward it rather than leaving the pose undefined.",
      "The two struts are drawn between points the solver produced, so their stroke is the pose rather than a decoration of it.",
      "The ankle here levels the sole against the floor and lifts the toes as the foot clears it. The heel-to-toe roll through a stance is robot-foot's mechanism; this leg borrows it only while it is running the stride itself.",
    ],
  },
  {
    slug: "robot-torso", item: "robot-torso", title: "Robot torso", group: "Machines",
    summary: "A pelvis, a column of equal vertebrae, and a cage of rib hoops. Leaning and twisting move the shoulders without stretching the back, and breathing opens the cage along the machine's depth.",
    files: ["components/ui/robot-torso.tsx"],
    usage: `import { RobotTorso } from "@/components/ui/robot-torso"

<RobotTorso behavior="breathe" ribs={7} />

// Controlled, or a column you can bend by hand.
<RobotTorso lean={18} twist={-24} breath={0.8} view="iso" />
<RobotTorso interactive onLeanChange={setLean} onTwistChange={setTwist} />`,
    props: [
      view("front", "torso"),
      { name: "lean", type: "number", description: "Controlled pitch in degrees, positive toward the nose, clamped to -35..45. Supplying any pose prop stops the loop." },
      { name: "twist", type: "number", description: "Controlled shoulder counter-rotation against the pelvis, in degrees, clamped to ±40." },
      { name: "sway", type: "number", default: "0", description: "Lateral roll of the whole column about the sacrum, in degrees, clamped to ±25." },
      { name: "breath", type: "number", description: "Controlled cage expansion, 0 empty to 1 full." },
      { name: "behavior", type: '"breathe" | "twist" | "static"', default: '"breathe"', description: "Work the cage, or wind the shoulders against the hips." },
      { name: "ribs", type: "number", default: "7", description: "How many rib hoops the cage is built from, 3 to 10. The vertebra count follows it." },
      { name: "speed", type: "number", default: "0.35", description: "Breaths, or twists, per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to twist and up and down to lean." },
      { name: "onLeanChange", type: "(lean: number) => void", description: "Pitch in degrees throughout a drag or a key press." },
      { name: "onTwistChange", type: "(twist: number) => void", description: "Shoulder rotation in degrees throughout a drag or a key press." },
      { name: "showHips", type: "boolean", default: "true", description: "Draw the pelvis casting and its hip sockets." },
      { name: "label", type: "string", description: "Caption below the pose readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Every vertebra is the same distance from the one below it in every pose, because the column is built as a chain of unit directions rather than as points that are bent afterwards.",
      "The ribs are open arcs leaving their own vertebra and descending as they come forward, drawn in the transverse plane — so they foreshorten into the ellipses a real cage makes from a raised camera. The lowest hoops float: they fall away further and stop short of the midline.",
      "No balance and no mass. Lean is a number someone typed, and nothing here would fall over.",
    ],
  },
  {
    slug: "robot-skeleton", item: "robot-skeleton", title: "Robot skeleton", group: "Robots",
    summary: "The whole biped, walking: legs solved to a rolling foot, an equal-segment spine under a rib cage, arms counter-swinging, and hands on the same solver the standalone hand ships on.",
    files: ["components/ui/robot-skeleton.tsx"],
    usage: `import { RobotSkeleton } from "@/components/ui/robot-skeleton"

<RobotSkeleton behavior="walk" view="profile" />

// Controlled, or a gait you can scrub by hand.
<RobotSkeleton gait="run" phase={0.44} stride={1} lift={1} />
<RobotSkeleton interactive onPhaseChange={setPhase} grasp="power" grip={1} />`,
    props: [
      view("front", "machine"),
      { name: "phase", type: "number", description: "Controlled cycle fraction. Supplying it stops the loop. Wraps in both directions." },
      { name: "gait", type: '"stand" | "walk" | "run" | "march"', description: "Footfall pattern. Omit and behavior picks one. Run is a walk with a duty factor under a half, which is what puts both feet in the air." },
      { name: "behavior", type: '"walk" | "run" | "march" | "idle" | "static"', default: '"walk"', description: "What it does when phase is not supplied. Idle stands and rocks a degree or two." },
      { name: "stance", type: "number", default: "1", description: "Hip height, 0 crouched to 1 standing tall." },
      { name: "stride", type: "number", default: "0.7", description: "Stride length, 0 to 1, capped at what the leg can actually reach." },
      { name: "lift", type: "number", default: "0.6", description: "Foot clearance through the swing, 0 to 1." },
      { name: "lean", type: "number", description: "Whole-column pitch in degrees. Omit and the gait picks one." },
      { name: "twist", type: "number", default: "0", description: "Extra shoulder rotation against the pelvis, on top of the gait's own." },
      { name: "gazePitch", type: "number", default: "0", description: "Head pitch in degrees, clamped to ±35." },
      { name: "gazeYaw", type: "number", default: "0", description: "Head yaw in degrees, clamped to ±60." },
      { name: "grasp", type: '"open" | "pinch" | "tripod" | "power" | "hook" | "point" | "lateral"', default: '"open"', description: "What the hands are doing. The same grasp table robot-hand uses." },
      { name: "grip", type: "number", default: "0.25", description: "Hand closure, 0 open to 1 shut." },
      { name: "speed", type: "number", default: "0.55", description: "Gait cycles per second." },
      ...gaitLoop(),
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a crowd of them breaks step. Phase is the cycle here, so the offset has its own name." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to scrub the gait; arrow keys step it." },
      { name: "onPhaseChange", type: "(phase: number) => void", description: "The cycle fraction throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow, which fades in the flight phase." },
      { name: "label", type: "string", description: "Caption below the gait readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "This is a skeleton, not shadcn's skeleton loading placeholder. It installs to @ui/robot-skeleton.tsx and collides with nothing, but the two names mean different things in one project.",
      "The stride is worked in the body frame: the pelvis stays at x = 0 and the feet travel under it, which is why a walk cycle and a treadmill are the same drawing. A stride the leg could not reach is capped rather than left to the solver to clamp.",
      "The hands are solveHand at a fifth scale, so the machine's grip is the same mechanism robot-hand ships on its own.",
      "No balance, no centre of mass, no ground reaction, no dynamics. The hip height is a number someone typed. The readout says grounded or flight because the duty factor says so, not because anything is being simulated.",
    ],
  },
  {
    slug: "skeleton-kinematics", item: "skeleton-kinematics", title: "Skeleton kinematics", group: "Foundations",
    summary: "The dependency-free biped solver: stride cycles with real duty factors, a foot that rolls heel to toe over a planted sole, an equal-segment spine, and arms swinging against the legs.",
    files: ["lib/robocn/skeleton.ts"],
    usage: `import { solveSkeleton, footRoll, solveLeg } from "@/lib/robocn/skeleton"

const pose = solveSkeleton({ gait: "run", phase: 0.44, stride: 1 })
pose.legs      // hip, knee, ankle, heel, ball, toe, angle, contact
pose.grounded  // false in the moments a run has no foot down
footRoll(0.9)  // { angle, contact, heelLoad, ballLoad, toeLoad }`,
    api: [
      { name: "solveSkeleton", type: "(options?: SkeletonOptions) => SkeletonPose", description: "Pelvis, spine, head, two arms and two legs in world units: x the machine's right, y up, z behind it, floor at y = 0." },
      { name: "strideCycle", type: "(gait, t, options?) => StrideSample", description: "One leg's ankle at cycle time t, in the sagittal body frame. The planted foot rolls about its heel, its sole and then its ball." },
      { name: "footRoll", type: "(stance: number) => FootRoll", description: "The ankle angle and the load path through one stance: heel at contact, whole sole in the middle, ball and toe at push-off." },
      { name: "footPoints", type: "(ankle, angle, proportions?) => FootGeometry", description: "Heel, ball and toe for a rolled ankle. The toe plate is hinged at the ball, so push-off extends that hinge instead of driving the toe through the floor." },
      { name: "solveLeg", type: "(hip, foot, femur, tibia) => [Vec2, Vec2, Vec2]", description: "The sagittal two-link leg on its own, knee breaking forward." },
      { name: "spineCurve", type: "(options: SpineOptions) => Vec3[]", description: "Vertebra centres from the sacrum to the shoulder line, every segment the same length however far the column leans or twists." },
      { name: "defaultProportions", type: "SkeletonProportions", description: "The frame every machine in the family starts from: bone lengths, spans, and the vertebra count." },
    ],
    notes: [
      "No React, no three.js, no dependencies, and nothing is mutated. The stride is worked in the body frame, so a walk cycle and a treadmill are the same drawing.",
      "Run is a walk with a duty factor below a half. That single number is what produces the moments with no foot down, and pose.grounded reports them rather than hiding them.",
      "There is no balance, no centre of mass, no ground reaction and no dynamics anywhere in it. Poses, not physics.",
    ],
  },
  {
    slug: "motion-platform", item: "motion-platform", title: "Motion platform", group: "Machines",
    summary: "Six actuators and a deck: the Stewart platform doing the job it was invented for, with visible stroke and a fault when a pose asks for more travel than it has.",
    files: ["components/ui/motion-platform.tsx"],
    usage: `import { MotionPlatform } from "@/components/ui/motion-platform"

<MotionPlatform behavior="sway" payload="camera" />

// Controlled, or a deck you can tip.
<MotionPlatform roll={12} pitch={-6} heave={8} />
<MotionPlatform interactive onPoseChange={setPose} />`,
    props: [
      view("iso", "platform"),
      { name: "roll", type: "number", description: "Controlled roll in degrees, clamped to ±24. Supplying any pose prop stops the loop." },
      { name: "pitch", type: "number", description: "Controlled pitch in degrees, clamped to ±24." },
      { name: "yaw", type: "number", description: "Controlled yaw in degrees." },
      { name: "heave", type: "number", description: "Controlled rise above the resting height, in world units." },
      { name: "sway", type: "number", description: "Controlled sideways offset, in world units." },
      { name: "surge", type: "number", description: "Controlled fore-aft offset, in world units." },
      { name: "behavior", type: '"settle" | "sway" | "static"', default: '"settle"', description: "The small continuous correction a loaded platform lives on, or the full six-axis excursion." },
      { name: "speed", type: "number", default: "0.25", description: "Pose cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the deck to tip it — across for roll, up and down for pitch — or arrow-key it 4° at a time." },
      { name: "onPoseChange", type: "(pose: { roll: number; pitch: number }) => void", description: "The tilt a person has put in, throughout a drag or a key press." },
      { name: "payload", type: '"deck" | "camera" | "none"', default: '"deck"', description: "What is bolted to the plate. Both stand on the plate's own solved normal." },
      { name: "showStroke", type: "boolean", default: "true", description: "Print the tilt and the longest leg stroke under the drawing." },
      { name: "label", type: "string", description: "Caption below the stroke readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Every leg length comes from stewart-kinematics, and the deck is drawn through its own six solved anchors rather than as a picture with a transform on it — so the plate tips because the legs moved, and the payload stands on the normal those anchors define.",
      "A pose that asks a leg for more than its travel is reported, not hidden: the leg is flagged, the lamp changes and the label says over travel. That is the number that tells you whether a pose is reachable.",
      "Kinematics only — no payload, no actuator dynamics, no washout filter.",
    ],
  },
  {
    slug: "clamshell-laptop", item: "clamshell-laptop", title: "Clamshell laptop", group: "Machines",
    summary: "A portable workstation on one solved hinge. The lid keeps its own length at every angle, and the screen is drawn only from a camera that can actually see it.",
    files: ["components/ui/clamshell-laptop.tsx"],
    usage: `import { ClamshellLaptop } from "@/components/ui/clamshell-laptop"

<ClamshellLaptop screen="code" view="iso" />

// Controlled, or a lid you can open yourself.
<ClamshellLaptop lid={105} />
<ClamshellLaptop interactive onLidChange={setAngle} />`,
    props: [
      view("profile", "machine"),
      { name: "lid", type: "number", description: "Controlled lid angle in degrees, 0 shut. Omit it and the hinge runs behavior." },
      { name: "behavior", type: '"open" | "adjust" | "static"', default: '"open"', description: "Run a whole session — lift, work, shut — or leave it open and work the angle." },
      { name: "travel", type: "number", default: "135", description: "How far the hinge opens, degrees, clamped to 90–150. Ask for more and it stops here." },
      { name: "speed", type: "number", default: "0.24", description: "Open-and-shut cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the lid open, or arrow-key it five degrees at a time." },
      { name: "onLidChange", type: "(angle: number) => void", description: "Lid angle in degrees throughout a drag or a key press." },
      { name: "screen", type: '"desktop" | "code" | "media" | "off"', default: '"desktop"', description: "What the display is showing. Structure in palette roles — a bar, a window, lines, a dock — never an application's own artwork." },
      { name: "showDesk", type: "boolean", default: "true", description: "Draw the contact shadow on the desk." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The hinge is solved, not tweened. The lid is `lid` long from the pivot in every pose, and the drawing knows when it has passed vertical — which is what lets it decide between drawing the display and drawing the back of it.",
      "The screen appears only when the camera can see it: shut it is face down on the keyboard, and side on it is a line. Nothing is drawn at a grazing angle, because a sheared screen is a picture of a screen rather than a projection of one.",
      "Side elevation is the view it is drawn in; the machine is modelled once in world units and pushed through the camera, so the keyboard foreshortens in plan and the lid becomes a slab in profile without any second drawing.",
      "No friction, no detent, no torque and no balance — there is nothing stopping the lid but `travel`. The keyboard layout is illustrated rather than mapped to any standard.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo; the display draws structure only.",
    ],
  },
  {
    slug: "slate-tablet", item: "slate-tablet", title: "Slate tablet", group: "Machines",
    summary: "A slate and the kickstand under it. One recline axis leans the slate and solves the stand's foot onto the desk; a leg too short to reach folds instead of stretching.",
    files: ["components/ui/slate-tablet.tsx"],
    usage: `import { SlateTablet } from "@/components/ui/slate-tablet"

<SlateTablet screen="sketch" stylus />

// Controlled, or a slate you can push back.
<SlateTablet recline={0.8} />
<SlateTablet interactive onReclineChange={setRecline} />`,
    props: [
      view("profile", "slate"),
      { name: "recline", type: "number", description: "Controlled recline, 0 nearly upright to 1 laid right back. Omit it and the slate runs behavior." },
      { name: "behavior", type: '"prop" | "sketch" | "static"', default: '"prop"', description: "Stand it up, hold it and lay it back down, or work the small range someone drawing on it uses." },
      { name: "leg", type: "number", default: "46", description: "Stand leg length in world units, clamped 20–80. Too short for the tilt and the stand folds." },
      { name: "speed", type: "number", default: "0.22", description: "Recline cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the slate back, or arrow-key it five percent at a time." },
      { name: "onReclineChange", type: "(recline: number) => void", description: "Recline, 0–1, throughout a drag or a key press." },
      { name: "screen", type: '"home" | "sketch" | "off"', default: '"home"', description: "What the display is showing. Structure in palette roles, never an application's own artwork." },
      { name: "stylus", type: "boolean", default: "true", description: "Dock the stylus along the top edge." },
      { name: "showDesk", type: "boolean", default: "true", description: "Draw the contact shadow on the desk." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "One axis moves two things. `recline` sets the tilt, and the stand is then a triangle that has to close: the slate's bottom edge is on the desk, the foot has to be on the desk too, and the leg is at its real length — so the horizontal run is whatever is left of it after the drop.",
      "The fault is reported rather than hidden. Shorten `leg` past what the tilt needs and `standPose` returns `folded`: the stand lies flat against the back and the readout and the accessible label both say so, the same way `motion-platform` reports a leg out of travel.",
      "No contact model, no friction and no mass — nothing here says the slate would actually stay up. The stylus is docked rather than held on, and the screen artwork is illustrated.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "wheel-player", item: "wheel-player", title: "Wheel player", group: "Machines",
    summary: "A pocket media player whose click wheel is geared to its list: one turn is one pass of the rows, and the detents wrap in both directions.",
    files: ["components/ui/wheel-player.tsx"],
    usage: `import { WheelPlayer } from "@/components/ui/wheel-player"

<WheelPlayer rows={8} screen="list" />

// Controlled, or a wheel you can work with a thumb.
<WheelPlayer rotation={135} />
<WheelPlayer interactive onRowChange={setRow} />`,
    props: [
      view("front", "player"),
      { name: "rotation", type: "number", description: "Controlled wheel rotation in degrees. Omit it and the wheel runs behavior." },
      { name: "behavior", type: '"scroll" | "seek" | "static"', default: '"scroll"', description: "Run the list past at a turn a cycle, or work back and forth the way a thumb hunting for a track does." },
      { name: "rows", type: "number", default: "8", description: "Rows in the list, rounded and clamped to 3–12. One turn of the wheel covers all of them." },
      { name: "locked", type: "boolean", default: "false", description: "The hold switch. On, nothing moves the wheel — not the pointer, not the keys, not the behaviour." },
      { name: "speed", type: "number", default: "0.22", description: "Turns of the wheel per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag round the wheel, or arrow-key it a row at a time." },
      { name: "onRotationChange", type: "(rotation: number) => void", description: "Wheel angle in degrees throughout a drag or a key press." },
      { name: "onRowChange", type: "(row: number) => void", description: "The row the wheel has landed on, 0-based." },
      { name: "screen", type: '"list" | "now-playing" | "off"', default: '"list"', description: "What the display is showing. Structure in palette roles, never an application's own artwork." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The wheel is geared to the list rather than pointed at it: a detent is 360 divided by `rows`, so one full turn is exactly one pass however long the list is, and the angle and the highlighted row can never disagree.",
      "Scrolling off the top lands on the bottom. The detents wrap in both directions, and a drag is unwrapped onto the turn the wheel is already on, so dragging past the end carries on instead of spinning a whole revolution back.",
      "The hold switch is an interlock, not a colour. With `locked` on, the pointer, the keyboard and the behaviour are all taken away from the wheel at once, and the machine reports `aria-disabled`.",
      "The display window slides to keep the selection near the middle and stops at both ends, so the list never draws a row it does not have. Nothing here plays, times or decodes anything.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "slab-handset", item: "slab-handset", title: "Slab handset", group: "Machines",
    summary: "A touchscreen handset modelled once and turned about its own axis. A quarter turn takes the screen edge on; a half turn shows the back and its camera array.",
    files: ["components/ui/slab-handset.tsx"],
    usage: `import { SlabHandset } from "@/components/ui/slab-handset"

<SlabHandset screen="map" orientation="landscape" />

// Controlled, or a slab you can turn over.
<SlabHandset turn={160} lenses={3} />
<SlabHandset interactive onTurnChange={setTurn} />`,
    props: [
      view("front", "handset"),
      { name: "turn", type: "number", description: "Controlled rotation about the handset's own vertical axis, degrees. Omit it and it runs behavior." },
      { name: "behavior", type: '"turn" | "nudge" | "static"', default: '"turn"', description: "Walk it right round so every face comes past, or work the small range a hand holding it does." },
      { name: "orientation", type: '"portrait" | "landscape"', default: '"portrait"', description: "Which way up it is held. Landscape swaps the slab's width for its height and lays the display out again." },
      { name: "speed", type: "number", default: "0.14", description: "Revolutions per second, or nudges per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across the frame to turn it — the whole width is one revolution — or arrow-key it ten degrees at a time." },
      { name: "onTurnChange", type: "(turn: number) => void", description: "Rotation in degrees throughout a drag or a key press." },
      { name: "screen", type: '"home" | "call" | "map" | "off"', default: '"home"', description: "What the display is showing. Structure in palette roles, never an application's own artwork." },
      { name: "lenses", type: "number", default: "3", description: "Lenses in the rear camera array, rounded and clamped to 1–4." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "A slab has no joints, so the honest mechanism is its attitude. `turn` rotates one model about its own vertical axis and every camera gets the result: the screen goes edge on at a quarter turn and the back comes round at a half, with the side keys crossing over as they should.",
      "Landscape is not a rotated picture. Rolling a rectangular slab a quarter turn in its own plane leaves it axis-aligned and only swaps its width for its height, so the body is remodelled and the display is laid out again for the shape it is now.",
      "A silhouette that does not change through a half turn is correct rather than a bug: that is what a rectangular slab does. What changes is which face is toward you.",
      "No sensors, no radio, no orientation logic — nothing here knows which way up it is except the prop you gave it. The rear array is illustrated, and the display draws structure only.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "folding-handset", item: "folding-handset", title: "Folding handset", group: "Machines",
    summary: "A book-fold handset and the display that has to survive it. The crease is a real bend radius, the sheet keeps its own length, and the leaves roll on the bend rather than pivoting on a pin.",
    files: ["components/ui/folding-handset.tsx"],
    usage: `import { FoldingHandset } from "@/components/ui/folding-handset"

<FoldingHandset screen="split" cover="clock" />

// Controlled, or a machine you can open yourself.
<FoldingHandset fold={108} radius={4} />
<FoldingHandset interactive onFoldChange={setFold} />`,
    props: [
      view("front", "machine"),
      { name: "fold", type: "number", description: "Controlled fold in degrees: 0 shut, 180 flat. Omit it and the fold runs behavior." },
      { name: "behavior", type: '"unfold" | "flex" | "static"', default: '"unfold"', description: "Run a whole session — open it, use it, shut it — or leave it half open and work the angle." },
      { name: "travel", type: "number", default: "180", description: "How far the hinge opens, degrees, clamped to 90–180. Ask for more and it stops here." },
      { name: "radius", type: "number", default: "3", description: "The crease's bend radius in world units, clamped to 1.5–40. It sets the gap the shut machine leaves and the display the bend spends." },
      { name: "speed", type: "number", default: "0.2", description: "Open-and-shut cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up inside the frame to open it, or arrow-key it ten degrees at a time." },
      { name: "onFoldChange", type: "(fold: number) => void", description: "Fold in degrees throughout a drag or a key press." },
      { name: "screen", type: '"canvas" | "split" | "gallery" | "off"', default: '"canvas"', description: "What the inner display is showing. Structure in palette roles, laid out across both leaves — never an application's own artwork." },
      { name: "cover", type: '"clock" | "alerts" | "off"', default: '"clock"', description: "What the cover display on the outside of the swinging leaf is showing." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The display cannot stretch and cannot be creased to a knife edge, so the bend costs `radius × (180 − fold)` of sheet and that length comes off the panels: the display peels away from the inner end of each leaf as the machine shuts. `2 × run + arc` is the sheet's length at every angle, and the peeled strip is the teardrop cavity you can see in the gap.",
      "The leaves roll on the bend rather than pivoting on a pin — both faces stay tangent to the bend circle, which is what the cams in a water-drop hinge are for, and what leaves the shut leaves `2 × radius` apart with the bend tucked inside instead of pinched flat.",
      "The panel is rigid whatever the display is doing: hinge to tip is exactly one leaf at every angle. Ask for a bend too big for the leaves and the machine reports `pinched` with the straight run clamped to zero, the way `slate-tablet` reports a stand that cannot reach the desk.",
      "The solver works in the fold's own symmetric frame; the component turns the whole pose by the swing so one leaf is held still, which is how a hand opens it — and what puts the flat inner display and the shut cover display face-on to the same camera. The one face none of the four cameras can see is the back of the leaf that is held, so nothing is modelled there.",
      "A display half is drawn only when the camera can see it and is not behind the other leaf: shut, both halves are inside the sandwich. The bend is drawn as the cylinder patch it is, at the two heights of one arc.",
      "No dynamics — no hinge friction, no detent, no torque, no crease memory, and no material in the sheet beyond its length and its radius. The bend is a circular arc rather than a real teardrop spline, and both displays draw structure only.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "wrist-terminal", item: "wrist-terminal", title: "Wrist terminal", group: "Machines",
    summary: "A wrist display on two solved mechanisms: a crown geared to the dial, and a constant-pitch link band that keeps its length however far it is opened.",
    files: ["components/ui/wrist-terminal.tsx"],
    usage: `import { WristTerminal } from "@/components/ui/wrist-terminal"

<WristTerminal ticks={12} closure={0.8} />

// Controlled, or a crown you can work with a finger.
<WristTerminal crown={120} screen="rings" />
<WristTerminal interactive onCrownChange={setCrown} />`,
    props: [
      view("front", "terminal"),
      { name: "crown", type: "number", description: "Controlled crown rotation in degrees. Omit it and the crown runs behavior." },
      { name: "behavior", type: '"dial" | "pulse" | "static"', default: '"dial"', description: "Run the crown round a turn a cycle, or work the quarter turn a finger checking something does." },
      { name: "ticks", type: "number", default: "12", description: "Detents in one turn of the crown, rounded and clamped to 4–24." },
      { name: "closure", type: "number", default: "0.75", description: "How far the band is closed, 0 hanging open to 1 round a wrist." },
      { name: "links", type: "number", default: "7", description: "Links in each half of the band, rounded and clamped to 4–12." },
      { name: "speed", type: "number", default: "0.2", description: "Turns of the crown per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag round the face to work the crown, or arrow-key it a detent at a time." },
      { name: "onCrownChange", type: "(crown: number) => void", description: "Crown angle in degrees throughout a drag or a key press." },
      { name: "screen", type: '"dial" | "rings" | "off"', default: '"dial"', description: "What the display is showing. Structure in palette roles, never an application's own artwork." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The crown is geared to the dial. A detent is 360 divided by `ticks`, so one turn is one pass of the face and the hand can never point somewhere the reading disagrees with. It wraps in both directions.",
      "The band is a constant-pitch chain: the link count and the pitch are fixed and only the curvature changes, so opening it cannot make the strap longer. It is the travelling-wave trick `spine-kinematics` uses — integrate a heading rather than move joints — applied to a bracelet.",
      "The knurl is surface, not texture. Each rib is a line on the crown's cylinder, drawn only while it faces the camera, which is what makes the crown read as turning from every angle instead of only head on.",
      "Because the band wraps away from you, the near links are sorted to paint last — a closed band drawn in link order draws itself inside out.",
      "No dynamics: no detent force, no torque, no clasp, no material. The band is drawn round nothing — there is no wrist model under it — and the display draws structure only.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "device-geometry", item: "device-geometry", title: "Device geometry", group: "Foundations",
    summary: "The mechanisms in a machine you carry: a hinge, a book fold whose display keeps its length, a kickstand that has to close, rotary detents that wrap, a band that keeps its length, and a screen on a plane at any attitude.",
    files: ["lib/robocn/device.ts"],
    usage: `import { hingePose, foldPose, standPose, detent, bandLinks, panelTransform } from "@/lib/robocn/device"

const lid = hingePose(105, 84, 78)          // lid keeps its length; facing says what you see
const book = foldPose(60, 60, 3)            // 2 * run + arc is the sheet, at every angle
const stand = standPose(0.7, 78, 46, 44)    // foot solved onto the desk, or folded
const dial = detent(450, 8, 45)             // -> { index: 2, offset, turns }
const band = bandLinks(7, 6.4, 0.8)         // constant pitch, curvature varies
const panel = panelTransform(camera, corner, along, down, 104, 78)`,
    api: [
      { name: "hingePose", type: "(angle, base, lid, options?) => HingePose", description: "One revolute joint in side elevation. The lid is `lid` long from the pivot in every pose, `facing` says how much of the screen is toward the front, and `overCentre` says when it has passed vertical." },
      { name: "foldPose", type: "(angle, leaf, radius, options?) => FoldPose", description: "A book fold: the bend spends `radius × (180 − angle)` of display, the straight run gives it up so the sheet keeps its length, and both leaf faces stay tangent to the bend circle so the leaves roll rather than pivot. Returns `pinched` for a bend too big for the leaves." },
      { name: "standPose", type: "(recline, slate, leg, mount, options?) => StandPose", description: "The kickstand triangle: given the tilt, the drop from the hinge to the desk decides the horizontal run. Returns `folded` when the leg cannot reach, instead of stretching it." },
      { name: "detent", type: "(rotation, steps, degreesPerStep) => DetentPose", description: "A rotary input divided into steps, wrapping in both directions. The click wheel and the digital crown are the same mechanism at different scales." },
      { name: "wheelSegment", type: "(degrees) => \"menu\" | \"next\" | \"play\" | \"previous\" | null", description: "Which quarter of a ring a thumb at this angle is on. Null for a non-finite angle." },
      { name: "bandLinks", type: "(count, pitch, closure, options?) => BandLink[]", description: "A link band as a constant-pitch chain — count and pitch fixed, curvature varying — so opening it cannot make it longer." },
      { name: "listWindow", type: "(index, rows, visible) => number[]", description: "The rows a fixed-height list shows with `index` selected, sliding to keep it near the middle and stopping at both ends." },
      { name: "panelTransform", type: "(camera, corner, along, down, width, height) => PanelProjection", description: "A flat panel at any attitude, as one affine transform for its artwork plus a `facing` that says whether you are looking at its front, its back, or its edge." },
      { name: "panelPath", type: "(camera, corner, along, down) => string", description: "The same panel's outline, projected." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no dependencies, and no dynamics — no friction in the hinge, no detent force on the crown, no crease memory in the folding display, no material in the band, and no contact between the stand's foot and the desk beyond the requirement that it be there.",
      "`camera.plane` covers artwork in the horizontal plane and `camera.wall` covers a vertical one. `panelTransform` is for everything in between — a lid, a propped slate, a turned handset — which is where the screens in this family actually live.",
      "Panel axes follow what a reader of the panel sees rather than the world: a screen facing the front camera runs its own left-to-right from +x to −x, because from nose-on the machine's starboard side is on your left.",
    ],
  },
  {
    slug: "keyboard-geometry", item: "keyboard-geometry", title: "Keyboard geometry", group: "Foundations",
    summary: "The mechanisms under a machine you type on: travel with real hysteresis, an asymmetric keystroke, a unit-pitch deck with a stagger, matrix scan order, and caps standing on a raked plane.",
    files: ["lib/robocn/keyboard.ts"],
    usage: `import { keyTravel, keyboardLayout, matrixScan, deckFrame, capSolid } from "@/lib/robocn/keyboard"

const key = keyTravel(0.55, { travel: 4, actuation: 2, closed })  // -> actuated partway down
const deck = keyboardLayout([[1, 1, 1, 1], [1.25, 6.25, 1.25]])   // unit widths, one pitch
const scan = matrixScan(clock, 5, 14)                             // one row energized at a time
const face = deckFrame({ x: 0, y: 18, z: 0 }, 22)                 // a raked key plane
const cap = capSolid(camera, face, deck.keys[3], key.fraction)`,
    api: [
      { name: "keyTravel", type: "(press, options?) => KeyTravelPose", description: "One key's travel. The contact closes at `actuation` on the way down and opens at `reset` on the way up, so pass the previous state as `closed` and the switch has real hysteresis instead of chattering at one point." },
      { name: "pressCurve", type: "(t) => number", description: "The shape of one keystroke: a fast fall, a moment bottomed out, and a slower return on the spring. Nothing in this family presses like a sine." },
      { name: "keyboardLayout", type: "(rows, options?) => KeyboardDeck", description: "Rows of unit widths laid out on one pitch with a per-row stagger, indexed in scan order. `rowUnits` reports each row's own width, so a row that does not fill the deck is drawn short rather than stretched." },
      { name: "keycapProfile", type: "(row, rows, base?) => KeycapProfile", description: "The sculpt of one row: how far its caps stand above the deck and how far their faces tilt. The home row is the low point and the rows either side of it tilt inward." },
      { name: "matrixScan", type: "(clock, rows, columns) => MatrixScanPose", description: "Where a scan has got to: one row energized, the columns read across it, wrapping in both directions. Which key is down and which key is being looked at are two different things." },
      { name: "strokePresses", type: "(strikes, keys, stroke, options?) => number[]", description: "How far every key of a deck is pressed at a point in a passage, given a schedule of strikes. Overlapping strikes give the key the deeper press." },
      { name: "codeStrikes", type: "(indices, keys, options?) => KeyStrike[]", description: "A schedule that strikes each index in turn, evenly across the passage and inside it at both ends. Keys outside the deck are dropped, not clamped onto a key nobody asked for." },
      { name: "deckFrame", type: "(origin, rake) => DeckFrame", description: "The frame a raked key face lives in: across, downhill toward the operator, and out of the face. Keys press along the negative normal, which is why a raked deck shows its travel from a front camera and a flat one does not." },
      { name: "capSolid", type: "(camera, frame, placement, press, options?) => string", description: "One keycap as a tapered box standing on that frame, projected and hulled — truthful from all four cameras." },
      { name: "deckPanel / capFace", type: "(camera, frame, …) => PanelProjection", description: "A rectangle of the deck — a legend, a readout strip — as one affine transform plus whether the camera can see its front at all." },
    ],
    notes: [
      "Pure functions over plain objects. No dynamics: no force curve, no tactile bump force, no click leaf, no key rollover, no debounce timing, no ghosting and no character encoding.",
      "The scan *order* is the real one — rows strobed, columns read across them. The scan *rate* is whatever clock you hand it.",
      "Travel and actuation are world units, so a switch with more travel really does stand its cap higher and trip further down. A contact placed past the end of the travel simply never closes, rather than being clamped onto the bottom.",
    ],
  },
  {
    slug: "key-switch", item: "key-switch", title: "Key switch", group: "Machines",
    summary: "One mechanical keyswitch, sectioned: a stem on a coil spring whose contact closes partway down the travel and opens again higher than it closed.",
    files: ["components/ui/key-switch.tsx"],
    usage: `import { KeySwitch } from "@/components/ui/key-switch"

<KeySwitch action="tactile" behavior="tap" />

// Controlled, or a switch you can press with a finger.
<KeySwitch press={0.55} travel={4} actuation={2} />
<KeySwitch interactive onActuatedChange={setClosed} />`,
    props: [
      view("profile", "switch"),
      { name: "press", type: "number", description: "Controlled press, 0 at rest to 1 bottomed out. Omit it and the stem runs behavior." },
      { name: "behavior", type: '"tap" | "flutter" | "hold" | "static"', default: '"tap"', description: "One whole keystroke a cycle, the band around the actuation point where the hysteresis stops it chattering, or pressed and held." },
      { name: "action", type: '"linear" | "tactile" | "clicky"', default: '"tactile"', description: "What the stem's leg does on the way down: a plain bar, a bar with a lobe on it, or one that drives a separate jacket." },
      { name: "travel", type: "number", default: "4", description: "Full travel of the stem in world units, clamped to 2–6. It is geometry: more travel stands the cap higher at rest." },
      { name: "actuation", type: "number", default: "travel / 2", description: "How far down the contact closes, world units. It reopens a tenth of the travel higher than that." },
      { name: "speed", type: "number", default: "0.5", description: "Strokes per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag down the frame to press it, or arrow-key it 5% at a time; Home and End park it up and bottomed out." },
      { name: "onPressChange", type: "(press: number) => void", description: "Press throughout a drag or a key press." },
      { name: "onActuatedChange", type: "(closed: boolean) => void", description: "Fires when the contact closes or opens — once per event, never once per frame." },
      { name: "showBoard", type: "boolean", default: "true", description: "The board the switch is mounted through." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The only machine here whose output is discrete. Everything else in the set reports a number; this reports a contact that is either closed or not, and the point it closes at is partway down a continuous travel with overtravel left after it.",
      "It has real hysteresis: the leaf resets a tenth of the travel higher than it actuated, so easing off a key that has registered does not open it again straight away. The `flutter` behaviour is there to show exactly that.",
      "Bottoming out is geometry rather than a limit: the stem's skirt lands on the cavity floor at the end of the travel, and the cap lands on the housing at the same moment.",
      "The cutaway is a drawing in the machine's own fore-aft plane, projected. From `plan` and `front` that plane is edge on — a line, which is what a section seen from the side is — so from those two the switch is drawn as the solids it is made of, and the cap's travel is still what moves.",
      "No dynamics: no force curve, no tactile bump force, no click leaf physics, no debounce. The spring is drawn compressing at its real proportion; it is not resolving any load.",
    ],
  },
  {
    slug: "robot-keypad", item: "robot-keypad", title: "Robot keypad", group: "Machines",
    summary: "A raked bench entry pad on a scanned matrix: the key that is down and the cell the scan is reading are two different things, and both are drawn.",
    files: ["components/ui/robot-keypad.tsx"],
    usage: `import { RobotKeypad } from "@/components/ui/robot-keypad"

<RobotKeypad code="4813" outcome="granted" />

// Controlled, or a pad you can scrub through the entry.
<RobotKeypad typed={0.45} rows={4} columns={3} rake={22} showScan />
<RobotKeypad interactive onTypedChange={setTyped} />`,
    props: [
      view("front", "keypad"),
      { name: "typed", type: "number", description: "Controlled position through the entry, 0 to 1. Omit it and the keys run behavior. It is `typed` rather than `stroke` because `stroke` is an SVG attribute." },
      { name: "behavior", type: '"entry" | "scan" | "idle" | "static"', default: '"entry"', description: "Work through the entry and answer it, run the matrix scan with nothing pressed, or sit with the backlight on." },
      { name: "code", type: "string", default: '"4813"', description: "The characters it enters, in order. Anything not on a cap is dropped rather than mapped onto a key nobody asked for." },
      { name: "outcome", type: '"granted" | "denied"', default: '"granted"', description: "What it answers with once the entry is in. It compares nothing — this is the answer, not the result of a check." },
      { name: "rows", type: "number", default: "4", description: "Rows in the matrix, rounded and clamped to 3–5." },
      { name: "columns", type: "number", default: "3", description: "Columns in the matrix, rounded and clamped to 3–4. A fourth column gets lettered keys, so no legend is ever drawn twice." },
      { name: "rake", type: "number", default: "22", description: "How far the key face is tipped up from the bench, degrees, clamped 0–40. Geometry: it sets the wedge's back height, and it is what makes a press visible head on." },
      { name: "showScan", type: "boolean", default: "false", description: "Draw the row rails and outline the cell the scan is reading. Blueprint draws them anyway." },
      { name: "speed", type: "number", default: "0.3", description: "Entries per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across the face to scrub the entry, or arrow-key it a digit at a time." },
      { name: "onTypedChange", type: "(typed: number) => void", description: "Position through the entry throughout a drag or a key press." },
      { name: "onEntryChange", type: "(digits: number) => void", description: "How many digits have been taken, when that changes — never once per frame." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The matrix is scanned, not wired one line per key: one row is energized and the columns are read across it. The cell being read is outlined and the key that is down is pressed, because they are not the same thing and a drawing that conflates them is lying about how a keypad works.",
      "The rake is the mechanism, not the styling. A key face flat on the bench presses straight into a front camera and shows nothing; tipped up, the same travel moves the cap down the screen. Set `rake={0}` and you can see the machine lose its own legibility, honestly.",
      "Each cap is a box standing on the face and pressing along its normal, so the travel is truthful from every camera rather than being a vertical nudge that only works in one of them.",
      "It checks nothing. There is no code comparison, no lockout, no attempt counter, no timing and no encoding: `outcome` is the answer it has been told to give.",
      "From `plan` the camera stands past the far edge of the deck, so the legends read away from you. That is what looking at a keypad over its own top edge does, and it is the same projection every other machine in the set uses.",
      "An original archetype. No manufacturer, product line, wordmark or key set is reproduced here or in the demo.",
    ],
  },
  {
    slug: "robot-keyboard", item: "robot-keyboard", title: "Robot keyboard", group: "Machines",
    summary: "A whole key deck placed by a unit grid: rows in 1u, 1.25u and 6.25u widths on one pitch, sculpted caps, and a split layout whose halves are genuinely turned apart.",
    files: ["components/ui/robot-keyboard.tsx"],
    usage: `import { RobotKeyboard } from "@/components/ui/robot-keyboard"

<RobotKeyboard layout="compact" behavior="type" />

// Controlled, or a deck you can scrub a passage across.
<RobotKeyboard typed={0.4} layout="split" profile="sculpted" />
<RobotKeyboard interactive onTypedChange={setTyped} />`,
    props: [
      view("iso", "deck"),
      { name: "typed", type: "number", description: "Controlled position through the passage, 0 to 1. Omit it and the deck runs behavior. It is `typed` rather than `stroke` because `stroke` is an SVG attribute." },
      { name: "behavior", type: '"type" | "ripple" | "scan" | "idle" | "static"', default: '"type"', description: "Type the passage, run a self-test wave across the deck, strobe the matrix with nothing pressed, or sit still." },
      { name: "layout", type: '"compact" | "extended" | "split"', default: '"compact"', description: "Which deck it is. `extended` adds a function row and a four-column block; `split` cuts the same rows down the middle and turns the halves apart." },
      { name: "profile", type: '"sculpted" | "flat"', default: '"sculpted"', description: "Sculpted rows dish toward the home row and tilt their faces with it, which is what gives the deck a profile in elevation. Flat makes every cap one height." },
      { name: "strokes", type: "number", default: "16", description: "Keystrokes in the passage, rounded and clamped to 4–40." },
      { name: "rake", type: "number", default: "6", description: "How far the case is tipped up from the desk, degrees, clamped 0–16." },
      { name: "backlight", type: "boolean", default: "true", description: "Light the caps that are down." },
      { name: "showScan", type: "boolean", default: "false", description: "Draw the row rails and outline the cell the scan is reading." },
      { name: "speed", type: "number", default: "0.22", description: "Passages per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across the deck to scrub the passage, or arrow-key it a stroke at a time." },
      { name: "onTypedChange", type: "(typed: number) => void", description: "Position through the passage throughout a drag or a key press." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The rows are specified in unit widths and laid out on one pitch, so the stagger falls out of the widths the way it does on a real board rather than being nudged into place. A 60% deck comes to sixty-one keys because that is what the rows add up to.",
      "`split` is a change to where the keys are, not a second drawing: each half is turned about the deck's own centre and pushed out, and every cap carries the turn as its own spin. The one difference in the rows is that a 6.25u space cannot belong to one half, so it becomes two thumb keys.",
      "Sculpting is real geometry: each row's caps stand at their own height and their top faces tilt toward the home row, which is why the deck has a profile from a side camera and a flat board does not.",
      "The caps are blank, and a passage is a rhythm across the deck rather than text. Nothing here encodes a character, maps a layout, or reproduces anyone's key set.",
      "No dynamics and no electronics: no rollover, no debounce, no ghosting. The scan order is the real one — a row strobed, the columns read across it — and the scan rate is whatever `speed` says.",
    ],
  },
  {
    slug: "input-terminal", item: "input-terminal", title: "Input terminal", group: "Machines",
    summary: "A bench console with two coupled mechanisms: a head canted on a hinge, and a key deck whose strokes are what put glyphs on its screen.",
    files: ["components/ui/input-terminal.tsx"],
    usage: `import { InputTerminal } from "@/components/ui/input-terminal"

<InputTerminal behavior="session" screen="query" />

// Controlled — two scalars, because it has two mechanisms.
<InputTerminal cant={18} typed={0.6} screen="log" lines={10} />
<InputTerminal interactive onCantChange={setCant} />`,
    props: [
      view("front", "console"),
      { name: "cant", type: "number", description: "Controlled head angle, degrees back from upright, clamped 6–45. Omit it and the head runs behavior." },
      { name: "typed", type: "number", description: "Controlled position through the passage, 0 to 1. Omit it and the keys run behavior." },
      { name: "behavior", type: '"session" | "query" | "idle" | "static"', default: '"session"', description: "Set the head, type under it and lay it back; type with the head parked; sit with the cursor blinking; or stop." },
      { name: "screen", type: '"boot" | "log" | "query" | "off"', default: '"query"', description: "What the display is showing. Structure in palette roles — a status band, filled lines, a block cursor — never text." },
      { name: "lines", type: "number", default: "7", description: "Lines the screen holds, rounded and clamped to 4–12. The passage fills exactly that many." },
      { name: "speed", type: "number", default: "0.2", description: "Sessions per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag down the frame to lay the head back, or arrow-key it 3° at a time; Shift 10°, Home and End upright and right back." },
      { name: "onCantChange", type: "(cant: number) => void", description: "Head angle throughout a drag or a key press." },
      { name: "showDesk", type: "boolean", default: "true", description: "The contact shadow under the case." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The only machine in the set where one mechanism drives another: the glyph count on the screen is the keystrokes the deck has taken, so the cursor sits wherever the keys have got to. Scrub the passage and both move together, because they are the same number.",
      "Two mechanisms means two controlled props. `cant` is the one you grab, and the loop keeps running while `typed` is still the machine's own — a head held by hand carries on typing underneath it, which is what pinning a value while the clock runs on is for. Supplying both, or `behavior=\"static\"`, parks everything.",
      "The head is hinged up a column at the back of the case rather than on the deck's own edge, which is what makes this a console rather than a machine that folds shut. `clamshell-laptop` is the one that folds.",
      "It computes nothing. The screen draws structure — a status band, filled lines, a block cursor — and never text: no encoding, no shell, no output, and no application's artwork.",
      "An original archetype. No manufacturer, product line, wordmark or paint scheme is reproduced here or in the demo.",
    ],
  },
  {
    slug: "produce-geometry", item: "produce-geometry", title: "Produce geometry", group: "Foundations",
    summary: "Solids of revolution with a real profile: the surface, a golden-angle lattice spaced by equal area, half shells that reassemble, a hinge about any line, and blades that keep their length.",
    files: ["lib/robocn/produce.ts"],
    usage: `import { revolveProfile, goldenLattice, halfShell, hingeRotate, bladeRing } from "@/lib/robocn/produce"

const profile = (t: number) => ({ height: 96 * t, radius: 30 * Math.sin(Math.PI * t) })
const skin = revolveProfile(profile, { rings: 12, meridians: 24 })
const studs = goldenLattice(profile, 26, { from: 0.08, to: 0.9 })
const half = halfShell(profile, "right", { rings: 12, meridians: 16 })
const open = hingeRotate(half, { origin: { x: 0, y: 8, z: 0 }, axis: { x: 0, y: 0, z: 1 } }, -30)
const calyx = bladeRing(6, { radius: 28, height: 86, length: 19, width: 19, pitch: -40 })`,
    api: [
      { name: "revolveProfile", type: "(profile, options?) => Vec3[]", description: "The surface as points, rings by meridians. Every sample sits at the profile's own radius and height, lobed or not." },
      { name: "profilePoint", type: "(profile, t, azimuth?, options?) => Vec3", description: "One point on that surface. `lobes` and `lobeDepth` modulate the radius in azimuth, so a furrowed fruit is furrowed rather than striped." },
      { name: "latitudeRing", type: "(profile, t, options?, steps?) => Vec3[]", description: "The closed ring at one station — a belt, a ripening front, a seat for a blade ring." },
      { name: "meridianLine", type: "(profile, azimuth, options?, steps?) => Vec3[]", description: "The line up one azimuth — a furrow, or a seam." },
      { name: "surfaceNormal", type: "(profile, t, azimuth?) => Vec3", description: "The outward normal in the meridian plane, turned to the azimuth: the direction a stud extends along, and the vector that says whether it faces the camera." },
      { name: "goldenLattice", type: "(profile, count, options?) => ProduceLatticeSite[]", description: "Sites by the golden angle, spaced by equal lateral surface area — the cumulative area is integrated and stepped through evenly, so the sites do not crowd where the profile is steep." },
      { name: "halfShell", type: "(profile, side?, options?) => Vec3[]", description: "Half the surface. `left` is `right` mirrored in the x = 0 plane point for point, so the two halves reassemble into exactly the surface `revolveProfile` draws." },
      { name: "hingeRotate", type: "(points, hinge, degrees) => Vec3[]", description: "Points turned about an arbitrary line — a vertical post behind a machine, a rod along the floor under it, a knuckle in a stem. Distance to the line is preserved and zero degrees is the identity." },
      { name: "bladeRing", type: "(count, options) => ProduceBlade[]", description: "Blades hinged on a ring, evenly spaced, with the blade's length exact at every pitch and its outline as four corners in space." },
      { name: "lateralArea", type: "(profile, from?, to?, steps?) => number", description: "Surface area of a band, which is what the lattice is spaced by." },
      { name: "widestSection", type: "(profile, steps?) => ProduceSection & { t }", description: "The belt: the widest station, for anything that has to clear it or decide what a camera above can see." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no camera, no dependencies — the components own the projection and the paint.",
      "No crop, growth, ripeness or material model of any kind. These are shapes and the mechanisms that move them.",
      "The normals come from the unlobed surface of revolution: the furrows are shallow enough that a stud still stands off its own skin, and saying so is cheaper than a normal nobody can see the difference in.",
    ],
  },
  {
    slug: "transmission-geometry", item: "transmission-geometry", title: "Transmission geometry", group: "Foundations",
    summary: "Where the flexible thing goes, and where the teeth are: gear outlines and mesh phase, assembly-valid planetary trains, taut belt paths, and an energy chain over its bend.",
    files: ["lib/robocn/transmission.ts"],
    usage: `import { planetaryTrain, planetaryPose, beltLayout } from "@/lib/robocn/transmission"

const train = planetaryTrain(18, 12, 3)   // { sun: 18, planet: 12, ring: 42, ratio: 3.33 }
const pose = planetaryPose(train, 140)    // carrier, planet bearings and spins, held ring

const belt = beltLayout([{ x: 0, y: 0, radius: 20 }, { x: 70, y: 0, radius: 8 }])
belt.length // spans plus wraps`,
    api: [
      { name: "gearPath", type: "(teeth, pitchRadius, options?) => string", description: "One gear's outline, tooth zero centred on the +x axis so a group rotate() is the gear's own angle. With a rim, the teeth point inward and the path is an annulus to be filled even-odd: a ring gear." },
      { name: "meshAngle", type: "(driverTeeth, driverAngle, drivenTeeth, bearing, internal?) => number", description: "The angle that puts the driven gear's teeth in the driver's spaces, given where it sits. Differentiating it gives the ratio: −N₁/N₂ externally, +N₁/N₂ for a pinion inside a ring." },
      { name: "planetaryTrain", type: "(sunTeeth, planetTeeth, planets) => PlanetaryTrain", description: "Tooth counts that actually assemble: ring = sun + 2 × planet, (sun + ring) divisible by the planet count, and planets capped so neighbours clear. Returns the reduction 1 + ring/sun." },
      { name: "planetaryPose", type: "(train, sunAngle) => PlanetaryPose", description: "Where every member of a fixed-ring train stands: the carrier at the reduction, each planet's bearing and spin, and the ring — which comes out constant, as a held ring must." },
      { name: "beltLayout", type: "(pulleys) => BeltLayout", description: "The taut path round a loop of pulleys taken in order: external tangents, a wrap arc on each, the total length and one path string. Two equal pulleys give 2 × centres + 2πr." },
      { name: "beltSample", type: "(layout, distance) => { x, y, heading }", description: "A point on the belt and the direction it is travelling, at an arc length. Wraps whole laps, which is how belt teeth march." },
      { name: "carrierLinks", type: "(travel, geometry) => CarrierPose", description: "An energy chain folded over itself: link placements at constant pitch along a fixed-length path, plus where the fold sits — at half the carriage, because the length cannot change." },
    ],
    notes: [
      "Invariants the tests hold it to: a planetary train only comes back if it assembles and its reduction is exactly 1 + ring/sun; meshing gears counter-rotate at −N₁/N₂ and present a tooth to a space at the line of centres; a belt round two equal pulleys is 2 × centres + 2πr and the segments always add to the total; and a chain keeps its link count and pitch at every travel while its bend moves at exactly half the carriage.",
      "No dynamics anywhere: no torque, no belt tension, no backlash, no friction, no efficiency.",
      "Pure functions over plain objects. No React, no dependencies beyond the vector helpers.",
    ],
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
  {
    slug: "resolver", item: "resolver", title: "Resolver", group: "Machines",
    summary: "A rotary transformer turns shaft angle into ideal sine and cosine secondary channels. The exposed windings make the sensor legible without a waveform panel.",
    files: ["components/ui/resolver.tsx"],
    usage: `import { Resolver } from "@/components/ui/resolver"

<Resolver behavior="turn" showChannels view="iso" />
<Resolver angle={90} interactive onAngleChange={setAngle} />`,
    props: [
      { name: "angle", type: "number", description: "Controlled rotor angle in degrees, wrapped to one turn." },
      { name: "behavior", type: `"turn" | "sweep" | "static"`, default: `"turn"`, description: "Continuous turn or bounded sweep." },
      { name: "excitation", type: "number", default: "1", description: "Ideal channel scale from −1 to 1." },
      { name: "showChannels", type: "boolean", default: "true", description: "Show signed sine and cosine channel bars." },
      { name: "interactive / onAngleChange", type: "boolean / (angle: number) => void", description: "Wind and report shaft angle." },
      view("front", "resolver"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["The sine and cosine channels are ideal trigonometric outputs. No winding impedance, phase error, harmonics, voltage or calibration error is modelled."],
  },
  {
    slug: "transformer-core", item: "transformer-core", title: "Transformer core", group: "Machines",
    summary: "Primary and secondary windings share an EI or toroidal magnetic core. Phase reverses the illustrative flux direction and ratio changes winding density inside one envelope.",
    files: ["components/ui/transformer-core.tsx"],
    usage: `import { TransformerCore } from "@/components/ui/transformer-core"

<TransformerCore behavior="alternate" core="ei" turns="step-down" />
<TransformerCore phase={0.5} core="toroid" turns="step-up" interactive />`,
    props: [
      { name: "phase", type: "number", description: "Controlled electrical phase from 0 to 1, wrapped by one cycle." },
      { name: "behavior", type: `"alternate" | "pulse" | "static"`, default: `"alternate"`, description: "Continuous phase or half-cycle reversal." },
      { name: "core", type: `"ei" | "toroid"`, default: `"ei"`, description: "Magnetic core construction." },
      { name: "turns", type: `"step-down" | "equal" | "step-up"`, default: `"equal"`, description: "Relative primary and secondary winding densities." },
      { name: "interactive / onPhaseChange", type: "boolean / (phase: number) => void", description: "Scrub and report electrical phase." },
      view("iso", "transformer"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["Winding density indicates a ratio and flux direction indicates polarity only. No voltage, current, saturation, loss, leakage, temperature or load is inferred."],
  },
  {
    slug: "magnetic-gripper", item: "magnetic-gripper", title: "Magnetic gripper", group: "Machines",
    summary: "Two energized pole shoes capture and lift a ferromagnetic plate or bar without a moving jaw. Field strength drives the visible capture sequence.",
    files: ["components/ui/magnetic-gripper.tsx"],
    usage: `import { MagneticGripper } from "@/components/ui/magnetic-gripper"

<MagneticGripper behavior="pick" workpiece="plate" view="iso" />
<MagneticGripper strength={0.8} interactive onStrengthChange={setStrength} />`,
    props: [
      { name: "strength", type: "number", description: "Controlled qualitative field strength from 0 to 1." },
      { name: "behavior", type: `"pick" | "hold" | "static"`, default: `"pick"`, description: "Automatic capture cycle or energized hold." },
      { name: "workpiece", type: `"plate" | "bar" | "none"`, default: `"plate"`, description: "Steel load below the poles; none never invents a load." },
      { name: "interactive / onStrengthChange", type: "boolean / (strength: number) => void", description: "Scrub and report the bounded field strength." },
      view("front", "magnetic gripper"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["Capture at half strength is an explicit visual state transition, not a force calculation. No mass, permeability, current, temperature or safety factor is inferred."],
  },
  {
    slug: "inductive-sensor", item: "inductive-sensor", title: "Inductive sensor", group: "Machines",
    summary: "A threaded proximity sensor exposes its oscillator coil and a movable metal target. Distance and range determine a qualitative detected output without inventing a target.",
    files: ["components/ui/inductive-sensor.tsx"],
    usage: `import { InductiveSensor } from "@/components/ui/inductive-sensor"

<InductiveSensor behavior="approach" target="tooth" range={0.3} />
<InductiveSensor distance={0.2} interactive onDistanceChange={setDistance} />`,
    props: [
      { name: "distance", type: "number", description: "Controlled target distance from 0 near to 1 far." },
      { name: "behavior", type: `"approach" | "inspect" | "static"`, default: `"approach"`, description: "Full approach cycle or motion near the threshold." },
      { name: "target", type: `"plate" | "tooth" | "none"`, default: `"plate"`, description: "Metal target geometry; none always reports clear." },
      { name: "range", type: "number", default: "0.35", description: "Qualitative detection threshold, clamped to 0.1–1." },
      { name: "interactive / onDistanceChange", type: "boolean / (distance: number) => void", description: "Drag and report target distance." },
      view("profile", "inductive sensor"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["Distance is normalized to the drawing and is not calibrated. The component does not infer material, frequency, field strength or millimetres."],
  },
  {
    slug: "eddy-current-brake", item: "eddy-current-brake", title: "Eddy-current brake", group: "Machines",
    summary: "A magnet array moves across a rotating conductive disc and reveals qualitative eddy paths in the overlap. The disc and brake never touch.",
    files: ["components/ui/eddy-current-brake.tsx"],
    usage: `import { EddyCurrentBrake } from "@/components/ui/eddy-current-brake"

<EddyCurrentBrake behavior="brake" slots={12} view="iso" />
<EddyCurrentBrake engagement={0.7} discAngle={35} interactive />`,
    props: [
      { name: "engagement", type: "number", description: "Controlled magnet overlap from 0 clear to 1 fully engaged." },
      { name: "behavior", type: `"brake" | "feather" | "static"`, default: `"brake"`, description: "Full or shallow automatic overlap motion." },
      { name: "discAngle", type: "number", description: "Independent controlled disc angle in degrees." },
      { name: "slots", type: "0 | 6 | 12", default: "6", description: "Vent slots in the conductive disc." },
      { name: "interactive / onEngagementChange", type: "boolean / (engagement: number) => void", description: "Move the magnet array and report overlap." },
      view("iso", "eddy-current brake"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["The disc visibly slows as overlap grows, but that timing is illustrative. No conductivity, braking torque, heat, speed or field density is calculated."],
  },
  {
    slug: "maglev-carriage", item: "maglev-carriage", title: "Maglev carriage", group: "Machines",
    summary: "A payload carriage travels above a segmented linear stator while preserving a visible air gap. Deck, bin and compact robot payloads share the same transport.",
    files: ["components/ui/maglev-carriage.tsx"],
    usage: `import { MaglevCarriage } from "@/components/ui/maglev-carriage"

<MaglevCarriage behavior="shuttle" payload="bin" view="iso" />
<MaglevCarriage travel={0.4} interactive onTravelChange={setTravel} />`,
    props: [
      { name: "travel", type: "number", description: "Controlled carriage position from 0 to 1 along the stator." },
      { name: "behavior", type: `"shuttle" | "hover" | "static"`, default: `"shuttle"`, description: "Full travel or small centre corrections." },
      { name: "payload", type: `"deck" | "bin" | "robot"`, default: `"deck"`, description: "Load mounted on the carriage." },
      { name: "interactive / onTravelChange", type: "boolean / (travel: number) => void", description: "Drag or arrow-key along the rail." },
      view("profile", "maglev carriage"), ...loop, ...form.slice(0, 2), ...palette,
    ], notes: ["The air gap and linear geometry are illustrated. The component does not simulate lift force, stability, commutation, mass or acceleration."],
  },
  {
    slug: "voice-coil-actuator", item: "voice-coil-actuator", title: "Voice-coil actuator", group: "Machines",
    summary: "A moving coil and carriage travel in both directions through a fixed annular magnetic gap. Unlike the generic linear cylinder, its electromagnetic working parts remain exposed.",
    files: ["components/ui/voice-coil-actuator.tsx"],
    usage: `import { VoiceCoilActuator } from "@/components/ui/voice-coil-actuator"

<VoiceCoilActuator behavior="oscillate" view="iso" />
<VoiceCoilActuator position={-0.4} interactive onPositionChange={setPosition} />`,
    props: [
      { name: "position", type: "number", description: "Controlled bipolar carriage position from −1 to 1." },
      { name: "behavior", type: `"oscillate" | "pulse" | "static"`, default: `"oscillate"`, description: "Automatic bidirectional motion." },
      { name: "travel", type: "number", default: "42", description: "Visible stroke, clamped to 20–60 world units." },
      { name: "interactive / onPositionChange", type: "boolean / (position: number) => void", description: "Drag or arrow-key the carriage." },
      { name: "showField", type: "boolean", default: "true", description: "Show qualitative loops through the magnet gap." },
      view("profile", "voice-coil actuator"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: ["The coil travel and gap are geometric. Field marks do not report force, flux density, current, frequency or heating."],
  },
  {
    slug: "magnetic-bearing", item: "magnetic-bearing", title: "Magnetic bearing", group: "Machines",
    summary: "Four opposed electromagnets centre a rotor across a visible air gap. Offset moves the unsupported rotor and changes the opposing correction emphasis.",
    files: ["components/ui/magnetic-bearing.tsx"],
    usage: `import { MagneticBearing } from "@/components/ui/magnetic-bearing"

<MagneticBearing behavior="balance" axis="x" view="iso" />
<MagneticBearing offset={0.5} axis="y" interactive />`,
    props: [
      { name: "offset", type: "number", description: "Controlled bipolar rotor displacement from −1 to 1." },
      { name: "behavior", type: `"balance" | "disturb" | "static"`, default: `"balance"`, description: "Small correction or large disturbance motion." },
      { name: "axis", type: `"x" | "y"`, default: `"x"`, description: "Displayed correction axis." },
      { name: "interactive / onOffsetChange", type: "boolean / (offset: number) => void", description: "Displace the rotor and report the bounded offset." },
      { name: "showField", type: "boolean", default: "true", description: "Show qualitative field rings across the air gap." },
      view("front", "magnetic bearing"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: ["Coil emphasis only explains feedback direction. The component does not simulate magnetic force, rotor dynamics, stability or a controller."],
  },
  {
    slug: "induction-motor",
    item: "induction-motor",
    title: "Induction motor",
    summary: "A cutaway three-phase stator around a squirrel-cage rotor. The ideal field vector and mechanical rotor angle separate by a configurable illustrative slip.",
    group: "Machines",
    files: ["components/ui/induction-motor.tsx"],
    usage: `import { InductionMotor } from "@/components/ui/induction-motor"

<InductionMotor behavior="slip" poles={4} view="iso" />
<InductionMotor angle={120} interactive onAngleChange={setAngle} />`,
    props: [
      { name: "angle", type: "number", description: "Controlled mechanical rotor angle in degrees." },
      { name: "behavior", type: `"run" | "slip" | "static"`, default: `"run"`, description: "Continuous or visibly lagging automatic rotation." },
      { name: "poles", type: "2 | 4 | 6", default: "4", description: "Stator pole count used by the ideal three-phase resultant." },
      { name: "slip", type: "number", default: "0.06", description: "Illustrative 0–0.3 separation between field and rotor timing." },
      { name: "interactive / onAngleChange", type: "boolean / (angle: number) => void", description: "Wind the rotor and report its angle." },
      { name: "showField", type: "boolean", default: "true", description: "Show the calculated three-phase resultant marker." },
      view("front", "induction motor"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: ["The three-phase vector sum is ideal and exact. Slip animation is explanatory timing, not a torque, load, current or thermal model."],
  },
  {
    slug: "stepper-motor",
    item: "stepper-motor",
    title: "Stepper motor",
    summary: "Four phase windings index a toothed rotor through a selected number of discrete positions. Its output never rests between integer steps.",
    group: "Machines",
    files: ["components/ui/stepper-motor.tsx"],
    usage: `import { StepperMotor } from "@/components/ui/stepper-motor"

<StepperMotor behavior="step" steps={8} view="iso" />
<StepperMotor step={3} interactive onStepChange={setStep} />`,
    props: [
      { name: "step", type: "number", description: "Controlled integer rotor index, wrapped by the selected step count." },
      { name: "behavior", type: `"step" | "run" | "static"`, default: `"step"`, description: "Dwelled or continuous discrete indexing." },
      { name: "steps", type: "4 | 6 | 8 | 12", default: "8", description: "Visible rotor index count." },
      { name: "detent", type: "boolean", default: "true", description: "Show the ring of available stop positions." },
      { name: "interactive / onStepChange", type: "boolean / (step: number) => void", description: "Wind or arrow between integer steps." },
      { name: "showField", type: "boolean", default: "true", description: "Show the qualitative active-phase ring." },
      view("front", "stepper motor"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: ["The phase and tooth geometry is explanatory. The component does not model winding current, holding torque, missed steps or resonance."],
  },
  {
    slug: "solenoid-valve",
    item: "solenoid-valve",
    title: "Solenoid valve",
    summary:
      "A helical coil pulls a sprung plunger across a two- or three-port valve gallery. The plunger, spring and visible flow route all answer the same controlled position.",
    group: "Machines",
    files: ["components/ui/solenoid-valve.tsx"],
    usage: `import { SolenoidValve } from "@/components/ui/solenoid-valve"

<SolenoidValve behavior="pulse" ports={3} normally="closed" view="iso" />
<SolenoidValve position={0.7} interactive onPositionChange={setPosition} />`,
    props: [
      { name: "position", type: "number", description: "Controlled plunger stroke from 0 released to 1 pulled." },
      { name: "behavior", type: `"cycle" | "pulse" | "static"`, default: `"cycle"`, description: "Automatic plunger duty cycle when position is omitted." },
      { name: "ports", type: "2 | 3", default: "2", description: "Number of visible valve ports." },
      { name: "normally", type: `"open" | "closed"`, default: `"closed"`, description: "Whether the released flow route is open or closed." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag or arrow-key the plunger." },
      { name: "onPositionChange", type: "(position: number) => void", description: "Reports pointer and keyboard changes." },
      { name: "showField", type: "boolean", default: "true", description: "Show qualitative activation loops around the coil." },
      view("profile", "solenoid valve"),
      ...loop,
      ...form.slice(0, 2),
      ...palette,
    ],
    notes: [
      "The winding is sampled as a fixed-envelope helix. Flow switching and field loops are explanatory geometry; no fluid force, pressure, coil heating or magnetic flux density is calculated.",
    ],
  },
  {
    slug: "electromagnetic-relay",
    item: "electromagnetic-relay",
    title: "Electromagnetic relay",
    summary:
      "An exposed coil pulls a hinged armature into one or two contact sets. Normally-open and normally-closed modes invert the contact result without changing the mechanism.",
    group: "Machines",
    files: ["components/ui/electromagnetic-relay.tsx"],
    usage: `import { ElectromagneticRelay } from "@/components/ui/electromagnetic-relay"

<ElectromagneticRelay behavior="switch" poles={2} view="iso" />
<ElectromagneticRelay energized={1} normally="closed" />`,
    props: [
      { name: "energized", type: "number", description: "Controlled coil energy from 0 released to 1 pulled." },
      { name: "behavior", type: `"switch" | "pulse" | "static"`, default: `"switch"`, description: "Automatic armature motion when energized is omitted." },
      { name: "poles", type: "1 | 2", default: "1", description: "One or two switched contact sets." },
      { name: "normally", type: `"open" | "closed"`, default: `"open"`, description: "Contact state with the coil released." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag, arrow-key or toggle the armature." },
      { name: "onEnergizedChange", type: "(energized: number) => void", description: "Reports pointer and keyboard changes." },
      { name: "showField", type: "boolean", default: "true", description: "Show qualitative activation loops around the coil." },
      view("profile", "relay"),
      ...loop,
      ...form.slice(0, 2),
      ...palette,
    ],
    notes: [
      "The armature and contacts are geometric. Field loops are qualitative; the component does not model contact bounce, current, voltage, force or heating.",
    ],
  },
  {
    slug: "electromagnetism-geometry",
    item: "electromagnetism-geometry",
    title: "Electromagnetism geometry",
    summary:
      "Winding geometry, a balanced three-phase resultant, and ideal resolver quadrature. Pure TypeScript with no React and no claim to solve a complete electromagnetic field.",
    group: "Foundations",
    files: ["lib/robocn/electromagnetism.ts"],
    usage: `import { coilWinding, threePhaseField, resolverSignals } from "@/lib/robocn/electromagnetism"

const winding = coilWinding({ turns: 12, length: 40, radius: 8 })
const field = threePhaseField(0.25, 4)
const channels = resolverSignals(37)`,
    api: [
      {
        name: "coilWinding",
        type: "(options: CoilWindingOptions) => Vec3[]",
        description: "Samples a finite helix along x, y or z while keeping its requested length and radius fixed.",
      },
      {
        name: "threePhaseField",
        type: "(phase: number, poles?: number) => ThreePhaseField",
        description: "Sums three sinusoidal windings 120 electrical degrees apart and reports the resultant mechanical angle and magnitude.",
      },
      {
        name: "resolverSignals",
        type: "(angle: number, excitation?: number) => ResolverSignals",
        description: "Returns ideal excitation-scaled sine and cosine secondary channels for a shaft angle in degrees.",
      },
    ],
    notes: [
      "The phase and resolver relationships are ideal calculations. The library does not solve Maxwell's equations, torque, force, heating or a complete electrical circuit.",
    ],
  },
  {
    slug: "turntable-deck", item: "turntable-deck", title: "Turntable deck", group: "Machines",
    summary: "A belt-drive deck whose arm is geared to its platter by the groove: one revolution walks the stylus in by exactly one groove pitch, and the arm angle is solved from the radius it reaches.",
    files: ["components/ui/turntable-deck.tsx"],
    usage: `import { TurntableDeck } from "@/components/ui/turntable-deck"

<TurntableDeck rpm={45} cue="play" />

// Controlled, or a platter you can scrub with a thumb.
<TurntableDeck progress={0.35} />
<TurntableDeck interactive onProgressChange={setProgress} />`,
    props: [
      view("plan", "deck"),
      { name: "progress", type: "number", description: "Controlled position through the side, 0 lead-in to 1 run-out. Omit it and the deck runs behavior." },
      { name: "behavior", type: '"play" | "scratch" | "static"', default: '"play"', description: "Run the side through, or rock the platter back and forth over a slow crawl forward — which carries the stylus back up the spiral." },
      { name: "cue", type: '"play" | "lift" | "rest"', default: '"play"', description: "Where the arm is standing: in the groove, picked up over it, or parked on its rest off the record." },
      { name: "rpm", type: "33 | 45 | 78", default: "33", description: "The speed selector. Scales the platter against the 33 rpm default; an unknown value falls back to 33." },
      { name: "turnsPerSide", type: "number", default: "40", description: "Revolutions of the platter in a whole side, clamped to 2–400. A real one is several hundred; the gearing is exact for whatever you set." },
      { name: "speed", type: "number", default: "0.55", description: "Platter revolutions per second at 33 rpm." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag the platter to scrub, or arrow-key it a revolution at a time." },
      { name: "onProgressChange", type: "(progress: number) => void", description: "Position through the side throughout a drag or a key press." },
      { name: "showGrooves", type: "boolean", default: "true", description: "Draw the groove spiral on the record." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Progress and platter angle are not two animations; they are one number seen at two scales, because the spiral gears them together. Scrubbing the platter therefore walks the stylus back out and the readout counts down with it.",
      "The arm is solved, not tweened: the pivot is a fixed distance from the spindle and the stylus a fixed distance from the pivot, so asking for a groove radius fixes the angle. The tracking error falls out of that geometry and goes in the readout — this arm nulls at two radii and stays under one and a half degrees between them.",
      "The spiral repeats. When the stylus reaches the run-out the next revolution puts it back at the lead-in, which is the one place the gearing is a loop rather than a machine.",
      "Nothing here plays, times or decodes anything. The belt is drawn where a belt goes rather than solved, the arm tube is a straight taper between projected ends, and the record's label is concentric structure in palette roles.",
      "An original archetype. No manufacturer, product line, wordmark, paint scheme or record label is reproduced here or in the demo.",
    ],
  },
  {
    slug: "gramophone-horn", item: "gramophone-horn", title: "Gramophone horn", group: "Machines",
    summary: "The acoustic deck a century before the electric one: a mainspring and its governor drive the platter, the crank is the wind, and the horn is an exponential flare modelled once and projected.",
    files: ["components/ui/gramophone-horn.tsx"],
    usage: `import { GramophoneHorn } from "@/components/ui/gramophone-horn"

<GramophoneHorn behavior="play" progress={0.4} />

// Controlled, or a crank you can wind by hand.
<GramophoneHorn wind={0.2} />
<GramophoneHorn interactive onWindChange={setWind} />`,
    props: [
      view("profile", "machine"),
      { name: "wind", type: "number", description: "Controlled wind, 0 run right down to 1 fully wound. Omit it and the spring runs behavior." },
      { name: "behavior", type: '"play" | "crank" | "static"', default: '"play"', description: "Run the spring down over three quarters of the cycle and wind it back in the last quarter, or walk it up and down the range a hand on the handle covers. Static parks it wound and still." },
      { name: "progress", type: "number", default: "0.3", description: "Where the soundbox is standing, 0 lead-in to 1 run-out." },
      { name: "speed", type: "number", default: "0.1", description: "Cycles of the spring per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag round the crank to wind it — three turns of the handle is a full wind — or arrow-key it." },
      { name: "onWindChange", type: "(wind: number) => void", description: "How wound the spring is throughout a drag or a key press." },
      { name: "showMechanism", type: "boolean", default: "true", description: "Show the spring barrel and the governor through the case's side panel." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The governor is what makes a wind-up deck run at a speed at all. It holds the platter at its rate while the mainspring has torque to spare and lets it sag proportionally once it has not, and the flyweights stand out with the square of the speed until they reach their stop. Run it right down and the readout says so.",
      "It shares `turntable-deck`'s tonearm solver, which is how it can be honest about itself: a straight acoustic arm has almost no alignment geometry, so it never nulls and its tracking error is an order of magnitude worse than the electric deck's. The number is in the readout either way.",
      "The horn is an exponential flare — the cross-sectional area doubles over a constant distance along the axis — built as a stack of rings on one axis and projected, so it foreshortens truthfully from every camera instead of being drawn per angle.",
      "One approximation, stated: the platter's angle is the clock times the regulated speed, not an integral of it, so changing the wind changes the platter's rate from that moment rather than replaying history. There is no spring model, no torque curve and no acoustics — the mainspring's coil is a drawing.",
      "An original archetype. No manufacturer, product line, wordmark, paint scheme or record label is reproduced here or in the demo.",
    ],
  },
  {
    slug: "music-box-drum", item: "music-box-drum", title: "Music box drum", group: "Machines",
    summary: "A pinned barrel plucking a comb tuned by length. The notes are data you pass it: one row per tine, any non-blank character a pin.",
    files: ["components/ui/music-box-drum.tsx"],
    usage: `import { MusicBoxDrum } from "@/components/ui/music-box-drum"

<MusicBoxDrum tines={12} />

// Your own cylinder, or a barrel you can crank by hand.
<MusicBoxDrum pattern={["x...x...", "..x...x."]} tines={2} />
<MusicBoxDrum interactive onStepChange={setStep} />`,
    props: [
      view("plan", "movement"),
      { name: "turn", type: "number", description: "Controlled barrel rotation in degrees. Omit it and the barrel runs behavior." },
      { name: "behavior", type: '"play" | "cadence" | "static"', default: '"play"', description: "Turn steadily, or hunt the way a governor does — swelling and easing within each revolution without ever running backwards." },
      { name: "tines", type: "number", default: "12", description: "Tines on the comb, rounded and clamped to 4–20. Rows beyond the count are ignored; tines beyond the pattern simply never sound." },
      { name: "pattern", type: "readonly string[]", description: "One row per tine; any non-blank character is a pin at that step. An empty array is a barrel with no pins, not a fallback." },
      { name: "speed", type: "number", default: "0.12", description: "Revolutions of the barrel per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to turn the barrel by hand — the frame's width is one revolution — or arrow-key it a step at a time." },
      { name: "onTurnChange", type: "(turn: number) => void", description: "Barrel rotation in degrees throughout a drag or a key press." },
      { name: "onStepChange", type: "(step: number) => void", description: "The step now standing under the comb, 0-based." },
      { name: "showFly", type: "boolean", default: "true", description: "Draw the air-brake fly that regulates the turn." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The pluck is a discontinuity, not a wobble. A pin bends its tine further and further as it comes round, is at full bend exactly at the step, and is gone the instant after — which is what a released tine does and what `combLift` returns.",
      "The comb is tuned by length: a cantilever's frequency goes as one over the length squared, so a semitone is a factor of 2^(−1/24) and an octave up is exactly one over root two the length. That is why the fan is a curve.",
      "The tips all stand in a line along the barrel and the roots step away from it, because a pin can only reach a tip that is on the barrel's surface. The stepped base is the consequence, not decoration.",
      "It shares its mechanism with `busker-droid`: a step sequencer is this barrel unrolled flat, and the same `combLift` raises a beater there.",
      "No acoustics and no dynamics. Nothing here computes a frequency, a decay or a damper, the mainspring is a great wheel with no spring behind it, and the fly is geared rather than braked.",
    ],
  },
  {
    slug: "busker-droid", item: "busker-droid", title: "Busker droid", group: "Robots",
    summary: "A one-machine band whose pose comes from data: a step pattern raises each beater as its step comes round and drops it on the beat, and both arms are solved to what they are about to hit.",
    files: ["components/ui/busker-droid.tsx"],
    usage: `import { BuskerDroid } from "@/components/ui/busker-droid"

<BuskerDroid behavior="groove" />

// Your own figure — kick, snare, cymbal — or a bar you can scrub.
<BuskerDroid pattern={["x...x...", "....x...", "..x...x."]} />
<BuskerDroid interactive onStepChange={setStep} />`,
    props: [
      view("front", "droid"),
      { name: "beat", type: "number", description: "Controlled position through the pattern, in steps. Omit it and it runs behavior." },
      { name: "behavior", type: '"groove" | "fill" | "static"', default: '"groove"', description: "Play the pattern once a cycle, or run it at double time." },
      { name: "pattern", type: "readonly string[]", default: "a plain sixteen-step figure", description: "One row per voice — kick, snare, cymbal — where any non-blank character is a hit. An empty array is a machine that keeps time and strikes nothing." },
      { name: "speed", type: "number", default: "0.55", description: "Passes of the whole pattern per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to scrub the pattern — the frame's width is one pass — or arrow-key it a step at a time." },
      { name: "onBeatChange", type: "(beat: number) => void", description: "Position through the pattern throughout a drag or a key press." },
      { name: "onStepChange", type: "(step: number) => void", description: "The step now under the beaters, 0-based." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow beneath the machine." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The only machine in the set whose pose comes from data you pass it. Every other droid here is posed or follows a pointer; this one reads a pattern, which is the same pattern `music-box-drum` carries as pins on its barrel.",
      "The up-stroke is slow and the down-stroke is one frame, because that is what `combLift` does: it rises over two thirds of a step and drops to nothing at the step itself. The strike is the drop.",
      "Both arms are two-link solutions, each solved in the vertical plane that contains its own shoulder and its own target — the plane the arm actually swings in. A target out of reach straightens the arm rather than stretching it.",
      "The kit is illustrated, not solved: the drums are cylinders and the cymbal a tipped disc, with no membrane, no stand compliance and no sound. The head's nod and the body's bob are driven off the kick's release rather than being a separate animation.",
      "An original archetype. No performer, band, maker or livery is reproduced here or in the demo.",
    ],
  },
  {
    slug: "scout-walker", item: "scout-walker", title: "Scout walker", group: "Robots",
    summary: "A two-legged reconnaissance walker whose cab is a mass above its hips: with one foot down the support is that foot, so it rolls the whole machine over the leg that is staying put.",
    files: ["components/ui/scout-walker.tsx"],
    usage: `import { ScoutWalker } from "@/components/ui/scout-walker"

<ScoutWalker behavior="patrol" showSupport />

// Or scrub the gait and push the cab off its feet yourself.
<ScoutWalker gait="walk" stride={0.25} lean={{ x: 1, y: 0 }} view="front" />`,
    props: [
      view("front", "walker"),
      { name: "behavior", type: '"patrol" | "advance" | "watch" | "static"', default: '"patrol"', description: "Patrol walks a line with a real double support; advance is a low, quick stride with a flight phase; watch stands and scans." },
      { name: "gait", type: '"stand" | "walk" | "stride"', description: "Footfall pattern. Omit and the behaviour picks one." },
      { name: "stride", type: "number", description: "Controlled gait cycle, 0–1. Supplying it stops the clock." },
      { name: "speed", type: "number", default: "0.5", description: "Gait cycles per second." },
      ...loop,
      { name: "lean", type: "Vec2 | null", default: "null", description: "Controlled attitude push, −1..1 of each stop: x rolls it, y pitches it. It beats the drag, and the gait still runs underneath." },
      { name: "onLeanChange", type: "(lean: Vec2) => void", description: "The lean a drag or a key moved it to, reported in controlled mode too." },
      { name: "interactive", type: "boolean", default: "true", description: "Press and drag to push the cab off its feet, or use the arrow keys; Home re-centres. Release eases it back into the gait." },
      { name: "height", type: "number", description: "Ride height 0–1, clamped to what the legs can still reach once the stride and the attitude stops are paid for." },
      { name: "step", type: "number", description: "Foot travel, 0–1." },
      { name: "lift", type: "number", default: "0.55", description: "Swing clearance, 0–1." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled aim in −1..1: x yaws the cab on its hips, y tips the chin pods." },
      { name: "track", type: "boolean", default: "true", description: "The cab follows the page pointer while look is null." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the support, a ring at each loaded foot sized by its share, and the mass on the plumb line down to where it falls." },
      ...droidForm,
    ],
    notes: [
      "The roll is the machine. `solveWalker` takes the support polygon the footfall leaves, works out the nearest place inside it the mass can stand, and buys that offset with attitude: the cab sits `hull` above the hip line, so getting the mass over a foot costs `asin(offset / hull)` of roll. In double support the mass is already between the feet and the cab stands level; in single support it heaves over.",
      "Front elevation is the view it is drawn in, because a roll is a thing a front elevation shows. Every part of the cab goes through the same hull transform the solver put the hips on, so the dropped hip on the loaded side is geometry rather than a drawn pose.",
      "`advance` runs a duty under a half, which means a flight phase: both feet leave the floor, and the machine reports itself airborne with no margin claimed either way rather than pretending it is balanced.",
      "Illustrative where it says so: the footfall is a schedule, the load share is that schedule weighted by how near the mass is, and there is no inertia or overturning moment. Off balance means it could not hold that pose standing still.",
      "An original archetype — a two-legged scout walker — named for its job. No franchise, insignia or paint scheme, here or in the demo; the default palette is the theme's.",
    ],
  },
  {
    slug: "siege-walker", item: "siege-walker", title: "Siege walker", group: "Robots",
    summary: "A four-legged armoured transport walker on the same solver: four feet at the corners of a long rectangle already contain its mass, so it walks nearly level — and cannot pace at all.",
    files: ["components/ui/siege-walker.tsx"],
    usage: `import { SiegeWalker } from "@/components/ui/siege-walker"

<SiegeWalker behavior="march" showSupport />

// The gait it cannot hold: both legs of a side swing together.
<SiegeWalker gait="pace" stride={0.25} view="front" showSupport />`,
    props: [
      view("profile", "walker"),
      { name: "behavior", type: '"march" | "haul" | "pace" | "halt" | "static"', default: '"march"', description: "March is a lateral-sequence walk; haul is slow and low with three feet always down; pace swings both legs of a side together, which this hull cannot hold; halt stands and scans." },
      { name: "gait", type: '"stand" | "walk" | "creep" | "pace"', description: "Footfall pattern. Omit and the behaviour picks one." },
      { name: "stride", type: "number", description: "Controlled gait cycle, 0–1. Supplying it stops the clock." },
      { name: "speed", type: "number", default: "0.32", description: "Gait cycles per second." },
      ...loop,
      { name: "lean", type: "Vec2 | null", default: "null", description: "Controlled attitude push, −1..1 of each stop: x rolls it, y pitches it. It beats the drag, and the gait still runs underneath." },
      { name: "onLeanChange", type: "(lean: Vec2) => void", description: "The lean a drag or a key moved it to, reported in controlled mode too." },
      { name: "interactive", type: "boolean", default: "true", description: "Press and drag to push the hull off its feet, or use the arrow keys; Home re-centres. Release eases it back into the gait." },
      { name: "height", type: "number", description: "Ride height 0–1, clamped to what the legs can still reach once the stride and the attitude stops are paid for." },
      { name: "step", type: "number", description: "Foot travel, 0–1." },
      { name: "lift", type: "number", default: "0.5", description: "Swing clearance, 0–1." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled aim in −1..1: x yaws the head on the neck, y raises and lowers it." },
      { name: "track", type: "boolean", default: "true", description: "The head follows the page pointer while look is null." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the support polygon, a ring at each loaded foot sized by its share, and the mass on the plumb line down to where it falls." },
      ...droidForm,
    ],
    notes: [
      "The same solver as the scout walker, and the contrast is the point: four feet at the corners of a long rectangle almost always contain the mass already, so the demanded attitude is small and this machine walks nearly level. Its walk is a lateral sequence — hind, then the fore on that side, then the other — which never leaves fewer than three feet down.",
      "`pace` throws that away. Swinging both legs of a side together leaves a support that is a line down one flank, half a hull width out, and a hull this shape cannot roll far enough to put its mass on it: the roll clamps at the stop, the margin goes negative and the lamp turns. Nothing scripts that; it falls out of the footfall order.",
      "Side elevation is the view it is drawn in, because a long hull is a side elevation. The head is carried on a drooping segmented neck and yaws with the aim; the hull, the flank plating and the hips all ride the one transform the solver used.",
      "Illustrative where it says so: the footfall is a schedule, the load share is that schedule weighted by how near the mass is, and there is no inertia, payload or overturning moment. Off balance means it could not hold that pose standing still.",
      "An original archetype — a four-legged siege transport — named for its job. No franchise, insignia or paint scheme, here or in the demo; the default palette is the theme's.",
    ],
  },
  {
    slug: "tripod-droid", item: "tripod-droid", title: "Tripod droid", group: "Robots",
    summary: "A stubby three-legged survey walker that has to move its own mass onto the line between two feet before it can lift the third — and reports how much room it has left.",
    files: ["components/ui/tripod-droid.tsx"],
    usage: `import { TripodDroid } from "@/components/ui/tripod-droid"

<TripodDroid behavior="trundle" showSupport />

// Or scrub the gait and push the body over its feet yourself.
<TripodDroid gait="creep" stride={0.35} lean={{ x: 0.6, y: 0 }} view="iso" />`,
    props: [
      view("front", "walker"),
      { name: "behavior", type: '"trundle" | "scurry" | "survey" | "settle" | "static"', default: '"trundle"', description: "Trundle creeps about, wandering off course and back; scurry ambles flat out on a gait it cannot hold; survey turns on the spot; settle stands and breathes." },
      { name: "gait", type: '"stand" | "creep" | "amble" | "pivot"', description: "Footfall pattern. Omit and the behaviour picks one." },
      { name: "stride", type: "number", description: "Controlled gait cycle, 0–1. Supplying it stops the clock." },
      { name: "speed", type: "number", default: "0.45", description: "Gait cycles per second." },
      ...loop,
      { name: "lean", type: "Vec2 | null", default: "null", description: "Controlled body offset over the feet, −1..1 on each axis. It beats the drag, and the gait still runs underneath." },
      { name: "onLeanChange", type: "(lean: Vec2) => void", description: "The lean a drag or a key moved it to, reported in controlled mode too." },
      { name: "interactive", type: "boolean", default: "true", description: "Press and drag to push the body over its feet, or use the arrow keys; Home re-centres and End pushes it forward to the stop. Release eases it back into the gait." },
      { name: "height", type: "number", description: "Ride height 0–1. It is also a stability control: standing tall leaves less leg to move the body with, so there is less sway to walk on." },
      { name: "step", type: "number", description: "Foot travel, 0–1." },
      { name: "lift", type: "number", default: "0.5", description: "Swing clearance, 0–1." },
      { name: "heading", type: "number", description: "Travel direction in degrees: 0 walks toward the nose, 90 to starboard." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled optic aim in −1..1; overrides pointer tracking." },
      { name: "track", type: "boolean", default: "true", description: "The slot optics follow the page pointer while look is null." },
      { name: "showSupport", type: "boolean", default: "false", description: "Draw the support polygon, a ring at each loaded foot sized by its share, and the centre of mass." },
      ...droidForm,
    ],
    notes: [
      "Three legs is the mechanism. Lift one and the base of support collapses from a triangle to a line, so the body has to be over that line before the foot leaves the floor. `solveTripod` schedules the load, the static condition puts the centre of mass at the load-weighted mean of the contacts, and that mean is where the body stands.",
      "How far it may move is not a magic number: it is whatever reach is left in a leg once a planted foot has been paid for. Creep fits inside it; amble asks the body to stand over a single foot, which it cannot reach, so the clamp bites and the margin goes negative. Longer links or a lower ride height buy the room back.",
      "Front elevation is the view it is drawn in. The slab is three stacked solids so the chamfer is geometry rather than paint, and the face marks are flat rectangles on the nose panel — they foreshorten in iso and collapse to a line in plan, which is what marks on a face do.",
      "Illustrative where it says so: the load ramp is a chosen schedule and not a ground-reaction solve, there is no mass or inertia anywhere, and the stub arms are counterweights in appearance only — they carry nothing in the solve. A negative margin means it could not hold that pose standing still, not that it has been simulated falling over.",
      "An original archetype — a three-legged survey walker — named for its job. No franchise, no insignia, no paint scheme; the default palette is the theme's and the label is the caller's.",
    ],
  },
  {
    slug: "robot-grand-piano", item: "robot-grand-piano", title: "Robot grand piano", group: "Machines",
    summary: "A player grand whose roll drives 88 solved actions. The jack lets each hammer go before it reaches the string, because you cannot hold a hammer against one.",
    files: ["components/ui/robot-grand-piano.tsx"],
    usage: `import { RobotGrandPiano } from "@/components/ui/robot-grand-piano"

<RobotGrandPiano />

// Your own roll: one row per lane, and the key each lane strikes.
<RobotGrandPiano roll={["x...x...", "..x...x."]} lanes={[28, 40]} />
<RobotGrandPiano view="profile" pedal="damper" lid="half" interactive />`,
    props: [
      view("plan", "instrument"),
      { name: "beat", type: "number", description: "Controlled position through the roll, in steps. Omit it and the roll runs behavior." },
      { name: "behavior", type: '"perform" | "rubato" | "static"', default: '"perform"', description: "Run the roll at a steady pass, or with the rate swelling and easing inside it — never backwards." },
      { name: "notes", type: "number", default: "88", description: "Notes in the compass, rounded and clamped to 12–88. The scale, the case and the keyboard are all redrawn around it." },
      { name: "roll", type: "readonly string[]", description: "One row per lane; any non-blank character is a perforation at that step. An empty roll is a piano that runs and plays nothing." },
      { name: "lanes", type: "readonly number[]", description: "Which key each lane strikes, as an index into the compass — so three rows can be a chord rather than three neighbours." },
      { name: "lid", type: '"closed" | "half" | "full"', default: '"full"', description: "Which prop the lid stands on. The angle is solved from the stick, the notch and the cup, not picked." },
      { name: "pedal", type: '"none" | "damper" | "shift"', default: '"none"', description: "Sustain lifts every damper off its string; una corda slides the whole action across by one string spacing." },
      { name: "speed", type: "number", default: "0.3", description: "Passes of the whole roll per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to scrub the roll — the frame's width is one pass — or arrow-key it a note at a time." },
      { name: "onBeatChange", type: "(beat: number) => void", description: "Position through the roll throughout a drag or a key press." },
      { name: "onStepChange", type: "(step: number) => void", description: "The step now under the reading bar, 0-based." },
      { name: "showLegs", type: "boolean", default: "true", description: "Draw the legs and the pedal lyre." },
      { name: "label", type: "string", description: "Caption below the state readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The hammer is released before the note, not at it. The jack drives the knuckle until its toe meets the let-off button and then leaves the hammer to cover the last of the blow unpowered — which is the one thing a piano action exists to do, and the thing a drawing that tweens the hammer off the key gets wrong.",
      "It comes back to the check, not to rest: the back check holds the hammer part-way down while the key is still held, which is what lets a note repeat. The key is held for as long as its string rings, so the damper falls with the sound.",
      "The bent side of the case is the envelope of the scale. Each string runs from an agraffe one strike point in front of the hammers to a bridge pin one speaking length behind it; take the hitch pins, push them out by the rim's thickness and that curve is a grand.",
      "Travels are drawn magnified — a key dips a three-hundredth of the instrument's length — but only the travels. Every ratio, the escapement, the after-touch and the check are solved life-size, and `data-travel`, `data-dip` and `data-lift` carry the unmagnified numbers.",
      "The case is drawn as a section: the wall between you and the inside is cut away, which is why the harp and the action read from every angle. In plan a raised lid really does cover most of the instrument, so it is drawn as the plate it is with the harp reading through it.",
      "No acoustics and no dynamics. Nothing computes a frequency, an inharmonicity, a tension or a decay, there is no hammer mass and no velocity, and the flight after let-off is the remaining gap covered in a fixed window rather than an integration. The choirs, the wound strings and the plate are illustrated.",
      "An original archetype. No maker, model, decal, plate casting, piece of music or performer is reproduced here or in the demo.",
    ],
  },
  {
    slug: "sound-geometry", item: "sound-geometry", title: "Sound geometry", group: "Foundations",
    summary: "The closures in a machine that makes a sound by moving something: a spiral groove, a pivoted tonearm's tracking error, an exponential horn, a spring governor, a tuned comb, and a pinned barrel.",
    files: ["lib/robocn/sound.ts"],
    usage: `import { groovePose, tonearmPose, governorPose, pinBarrel, combLift } from "@/lib/robocn/sound"

const side = groovePose(0.4, { outer: 146, inner: 60, pitch: 0.12 })
const arm = tonearmPose(side.radius, { mounting: 220.3, effective: 239.3, offset: 24.2 })
arm.trackingError                       // degrees, and it changes sign between the nulls

const governor = governorPose(0.15)     // { speed: 0.5, spread: 0.25, governing: false }
const barrel = pinBarrel(["x...x...", "..x...x."])
combLift(barrel, 0, 4)                  // 1 at the pin, 0 the instant after`,
    api: [
      { name: "groovePose", type: "(progress, geometry) => GroovePose", description: "Where the stylus is standing and how many revolutions that is. The spiral gears the arm to the platter: one revolution moves the stylus in by exactly one groove pitch." },
      { name: "grooveTurns", type: "(geometry) => number", description: "Revolutions in a whole side: the playable band divided by the groove pitch." },
      { name: "grooveProgress", type: "(radius, geometry) => number", description: "The inverse, for a caller that knows where the stylus is standing." },
      { name: "grooveSpiralPath", type: "(geometry, turns?, stepsPerTurn?) => string", description: "The groove as artwork: one Archimedean spiral drawn with the number of visible turns you ask for." },
      { name: "tonearmPose", type: "(radius, geometry) => TonearmPose", description: "A triangle with two fixed sides, so a groove radius fixes the arm angle. Returns the stylus, the arm angle, the overhang and the tracking error — the angle between the cartridge and the groove's tangent." },
      { name: "tonearmNulls", type: "(geometry, inner, outer, samples?) => number[]", description: "The radii where the cartridge sits exactly square to the groove. A well set up arm has two inside the record; an acoustic one may have none." },
      { name: "hornProfile", type: "(geometry, steps?) => HornSection[]", description: "An exponential or conical horn sampled into sections, throat first, ready to be built into a solid." },
      { name: "hornRadius", type: "(along, geometry) => number", description: "The radius at one station along the axis. Exponential by default: the area doubles over a constant distance." },
      { name: "flareRate", type: "(geometry) => number", description: "The flare constant, so the area doubles every ln 2 divided by it. Zero for a cone." },
      { name: "governorPose", type: "(wind, options?) => GovernorPose", description: "What a wind-up drive does: the speed holds while the spring has torque and sags proportionally below the knee, and the flyweights stand out with the square of the speed until they reach their stop." },
      { name: "combTines", type: "(count, options?) => CombTine[]", description: "A comb tuned by length, up a scale. A cantilever's frequency goes as one over the length squared, so an octave up is one over root two the length." },
      { name: "pinBarrel", type: "(pattern, steps?) => Barrel", description: "Pins laid out from a pattern, one row per tine: any non-blank character is a pin at that step. Malformed rows produce a barrel that turns and plucks nothing." },
      { name: "combLift", type: "(barrel, tine, position, options?) => number", description: "How far a pin has bent its tine: rising as the pin comes round, exactly 1 at the step, and nothing after. That discontinuity is the pluck." },
      { name: "combRelease", type: "(barrel, tine, position, options?) => number", description: "The other half: 1 at the instant of release, falling away over the tail." },
      { name: "barrelStep", type: "(barrel, position) => number", description: "The step standing under the comb, wrapped into the barrel in both directions." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no dependencies, and no acoustics: nothing here computes a frequency response, a horn's cutoff, a radiation impedance, a spring's torque curve or a decay, and nothing plays a sound.",
      "The tonearm is the piece that earns the file. Its tracking error is a number a drawing would otherwise quietly get wrong, and it is what lets `turntable-deck` and `gramophone-horn` share one solver while telling the truth about how differently they track.",
      "A step sequencer is a pinned barrel unrolled flat, which is why `combLift` drives a music box's tine and a droid's beater alike.",
    ],
  },
  {
    slug: "piano-geometry", item: "piano-geometry", title: "Piano geometry", group: "Foundations",
    summary: "The closures in a grand: an action that lets its hammer go before the blow, a back check, a late damper, a scale that cannot be ideal, the bent side that is the envelope of it, and a lid solved from its prop.",
    files: ["lib/robocn/piano.ts"],
    usage: `import { actionPose, hammerPose, pianoLayout, lidPose } from "@/lib/robocn/piano"

const key = actionPose(1, { dip: 1, balance: 0.55, wippen: 1.3, lever: 7, blow: 4.6 })
key.ratio        // 5.005 — the product of the three levers
key.escaped      // true: the jack tripped before the key bottomed
key.gap          // what the hammer still has to cover on its own

const plan = pianoLayout({ notes: 88, strike: 20, halfWidth: 21 })
plan.rim         // the case, drawn around the scale
lidPose("full", { width: 52 }).angle    // 47°, solved from three sides`,
    api: [
      { name: "actionPose", type: "(dip, options?) => ActionPose", description: "One action solved from the key dip. The ratio is key × wippen × hammer lever, the jack trips at (blow − letOff) / ratio, and past that the hammer holds where it was left — with the after-touch, the gap and `regulated` reported." },
      { name: "hammerPose", type: "(lift, ring, options?) => HammerPose", description: "The whole stroke from the two numbers a pattern gives you — `combLift` for the approach and `combRelease` for the ring. Off the string at once, caught by the back check, and home only when the key lets it go." },
      { name: "damperLift", type: "(press, options?) => number", description: "How far the damper has left the string. Nothing happens for the first half of the dip; the sustain pedal lifts every damper on its own." },
      { name: "pianoScale", type: "(options?) => PianoString[]", description: "The speaking length of every note, what an ideal halving scale would have asked for, and how far short of it this one falls — plus the strike point, the choir and whether the string is wound." },
      { name: "pianoLayout", type: "(options?) => PianoLayout", description: "The plan: every string from its tuning pin through its agraffe and bridge pin to its hitch, the long and bass bridges, the capo line, and the rim drawn around all of it." },
      { name: "lidPose", type: "(stage, options?) => LidPose", description: "The lid on its prop: hinge to notch, hinge to the stick's foot, and the stick. A stick that cannot close the triangle will not stand, and says so." },
      { name: "pianoKeys", type: "(notes, options?) => PianoKey[]", description: "The compass laid across the keyboard: 52 naturals and 36 sharps for an 88, each sharp leaning outward from the middle of its own group rather than sitting on a boundary." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no dependencies, and no acoustics: nothing computes a frequency, an inharmonicity, a tension, a soundboard impedance or a decay, and there is no hammer mass and no velocity.",
      "The escapement is the piece that earns the file. Driving the hammer from the key all the way to the string is the mistake every drawing of a piano makes, and it is the one thing the mechanism exists to prevent.",
      "An ideal scale halves the speaking length every octave; run that down 88 notes and the bottom string wants six metres. The exponent is compressed toward the bass instead, and `foreshortening` reports how much — which is what the wound strings are for.",
      "The bridge lands one speaking length behind an agraffe one strike point in front of the hammers, so the bent side of a grand is a consequence of the scale. An overstrung bass string reaches less far down the case than its own length, which is the entire point of crossing it.",
    ],
  },
  {
    slug: "phyllotaxis-geometry", item: "phyllotaxis-geometry", title: "Phyllotaxis geometry", group: "Foundations",
    summary: "The golden-angle disc, the Fibonacci spiral arms that fall out of it, a dished face and its normals, and the two-axis aim that points the whole thing at a light.",
    files: ["lib/robocn/phyllotaxis.ts"],
    usage: `import { aimFrom, parastichyOffsets, trackerFrame, vogelDisc } from "@/lib/robocn/phyllotaxis"

const sites = vogelDisc(160, { radius: 28 })
parastichyOffsets(sites)          // [21, 34] — nobody chose those
const frame = trackerFrame(aimFrom({ x: 0.3, y: 0.8, z: -0.5 }))`,
    api: [
      { name: "GOLDEN_ANGLE", type: "number", description: "137.507…°, the angle the whole lattice is one consequence of." },
      { name: "vogelDisc(count, options?)", type: "PhyllotaxisSite[]", description: "Sites at n·137.507° and radius √n, so every annulus of equal area holds the same number of them. `innerRadius` leaves the eye bare." },
      { name: "parastichyOffsets(sites, families?)", type: "number[]", description: "The index steps whose neighbours are closest — the spiral-arm families. They come out consecutive Fibonacci numbers because the angle says so." },
      { name: "spiralArm(sites, start, step)", type: "PhyllotaxisSite[]", description: "One arm: the chain of sites stepping by one of those offsets." },
      { name: "discDish(site, options?)", type: "DiscDishPoint", description: "The shallow paraboloid the florets sit in: the offset along the face normal, and the unit normal there." },
      { name: "aimFrom(direction)", type: "TrackerAim", description: "A direction turned into an azimuth and an elevation. A zero vector parks level rather than returning NaN." },
      { name: "aimDirection(aim)", type: "Vec3", description: "The inverse. Round trips exactly." },
      { name: "trackerFrame(aim)", type: "TrackerFrame", description: "The head's own axes in the world: `forward` is the aim, `right` stays level however far it pitches, and `right × forward = up`." },
      { name: "framePoint(frame, origin, local)", type: "Vec3", description: "A point written in the head's frame, placed in the world. Distance-preserving." },
      { name: "rayFlorets(count, options)", type: "RayFloret[]", description: "Petals hinged on a rim, in the disc's own frame. Rigid: the length is exact at every pitch." },
    ],
    notes: [
      "Pure functions over plain `{x, y}` and `{x, y, z}`. No React, no camera, no dependencies.",
      "The parastichy count is the test that matters: for any lattice from 80 to 600 florets, the two nearest-neighbour index steps are consecutive Fibonacci numbers. Nothing in the file knows that — it is what the angle does.",
      "There is no plant here, and no sun. `aimFrom` is a two-axis mount's inverse, not a solar position for a date and a latitude.",
    ],
  },
  {
    slug: "robot-sunflower", item: "robot-sunflower", title: "Robot sunflower", group: "Robots",
    summary: "A heliotropic collector mast: a golden-angle floret lattice on a dished head aimed at the light by a two-axis tracker, on a stem that leans toward it while the gimbal collar takes up exactly what the stem did not.",
    files: ["components/ui/robot-sunflower.tsx"],
    usage: `import { RobotSunflower } from "@/components/ui/robot-sunflower"

<RobotSunflower behavior="sweep" florets={160} arms={8} />
<RobotSunflower daylight={0.62} interactive onDaylightChange={setDay} />`,
    props: [
      view("front", "machine"),
      { name: "daylight", type: "number", description: "Controlled time of day, 0 and 1 midnight and 0.5 noon. Supplying it stops the loop." },
      { name: "sun", type: "{ azimuth: number; elevation: number }", description: "Where the light actually is. Overrides the day arc and the pointer entirely." },
      { name: "behavior", type: '"sweep" | "day" | "nod" | "static"', default: '"sweep"', description: "Sweep runs the working arc — the part of the day a collector collects in, which a two-axis mount's azimuth range is sized for; day runs the whole twenty-four hours, so the head turns away and the rays furl at night; nod is the hunting a tracker does once it has arrived." },
      { name: "speed", type: "number", default: "0.14", description: "Passes of the arc per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to scrub the day; arrows step 3 percent, shift 10, Home dawn and End dusk." },
      { name: "onDaylightChange", type: "(daylight: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "track", type: "boolean", default: "true", description: "Hand the light to the pointer while it is over the drawing. Suppressed while a drag is in progress." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled gaze in −1..1; overrides pointer tracking." },
      { name: "florets", type: "number", default: "120", description: "Collector cells on the face, clamped to 12..320. They are placed by the golden angle over equal area." },
      { name: "rays", type: "number", default: "21", description: "Ray petals hinged on the rim, clamped to 0..48." },
      { name: "arms", type: "number", default: "8", description: "Spiral arms drawn over the lattice, clamped to 0..24. The step they follow is whichever parastichy the solver reports." },
      { name: "bloom", type: "number", description: "How open the rays are, 0 furled to 1 wide. Omit and the light opens them: shut below the horizon, full by 40 degrees." },
      { name: "lean", type: "number", default: "1", description: "How much of the aim the stem takes up itself, 0 rigid to 1 full lean. The collar always takes the rest." },
      ...droidForm,
    ],
    notes: [
      "The collar angle is a remainder, not an input: the stem leans toward the light on its own and the gimbal takes up exactly what it did not, so the head's normal never comes off the sun however far the mast bends.",
      "The spiral arms are found rather than placed. `parastichyOffsets` reports which index step has the closest neighbours, and drawing that step is what makes the arms appear — their count is a Fibonacci number because the angle is the golden angle.",
      "Solved: the lattice and its spacing, the dish surface and its normals, the aim and its frame, the stem — every link exactly the same length at every lean — the collar remainder, the leaf panels' corners, the ray length at every pitch, the projection, and the facing cull on florets, rays and leaves.",
      "Illustrated: the hub speckle, the anchor feet, and the incidence ray the blueprint variant draws. There is no photometry, no ephemeris and no plant model: `daylight` is a shaped number, not a solar position for a date and a latitude, and the disc collects nothing.",
      "A generic field machine and a generic flower. No cultivar, grower or product artwork anywhere.",
    ],
  },
  {
    slug: "cactus-geometry", item: "cactus-geometry", title: "Cactus geometry", group: "Foundations",
    summary: "Continuum limbs solved from their own curvature — exactly as long bent as straight — with ribbed sections, crest lines, a staggered areole lattice, taper-true skin normals, and rigid spine fans and petals.",
    files: ["lib/robocn/cactus.ts"],
    usage: `import { solveCactusLimb, areoleSites, spineFan } from "@/lib/robocn/cactus"

// emergence 88 and sweep 88: leaves the trunk flat, ends up vertical.
const arm = solveCactusLimb({ length: 54, emergence: 88, sweep: 88, elbow: 0.34 })
areoleSites(arm, { ribs: 10, depth: 0.2, perRib: 4 }).map((pad) => spineFan(pad))`,
    api: [
      { name: "solveCactusLimb(options)", type: "CactusLimb", description: "A centreline solved from its curvature: `θ(s) = emergence − sweep · W(s)`, walked off at each link's midpoint. Every link exactly the same length at every bend, and `sweep === emergence` ends the limb vertical whatever the elbow." },
      { name: "stationAt(limb, s)", type: "CactusStation", description: "The station anywhere along it, with the frame rebuilt from the interpolated angle rather than lerped, so it stays orthonormal wherever it is sampled." },
      { name: "ribFactor(angle, ribs, depth)", type: "number", description: "How much of its radius the skin keeps at a roll angle. Crests are exactly 1, at every 360/ribs." },
      { name: "limbPoint / limbRing / ribCrest", type: "Vec3 | Vec3[]", description: "A point on the skin, the closed section, and one crest run the length of the limb — a line on the solved surface rather than a stripe drawn on a silhouette." },
      { name: "areoleSites(limb, options)", type: "CactusAreole[]", description: "Pads on the crests, evenly spaced in station and staggered half a step on alternate ribs, each carrying the skin's own normal." },
      { name: "skinNormal(limb, s, angle)", type: "Vec3", description: "That normal: the radial direction with the taper leant into, which is what makes a pad near a tapering crown point up and out rather than sideways." },
      { name: "spineFan(areole, options)", type: "CactusSpine[]", description: "Needles on a cone about the normal. Every needle exactly its length at every splay, and the basis is taken from the world rather than seeded, so a fan is deterministic." },
      { name: "corollaPetals(count, station, options)", type: "CactusPetal[]", description: "Rigid blades hinged on a ring in a station's own plane. Shutting the flower into a bud shortens the silhouette, not the petal." },
      { name: "rollToward(station, azimuth)", type: "number", description: "The roll angle on a limb that faces a world azimuth — how an arm finds its seat on a column." },
      { name: "cactusBearing(azimuth)", type: "Vec3", description: "The outward horizontal direction of an azimuth. 0 faces the front camera, matching `phyllotaxis.ts`." },
    ],
    notes: [
      "Pure functions over plain `{x, y, z}` in the set's world axes. No React, no camera, no dependencies.",
      "The angle is integrated and the joints are walked, never displaced — which is the only reason the length is exact rather than nearly exact. A limb bends in one vertical plane, so its binormal is constant along it and the frame is already parallel-transported.",
      "No botany. Nothing grows, nothing transpires, and there is no plant model here — these are trajectories and surfaces. Design note: `docs/ribbed-column.md`.",
    ],
  },
  {
    slug: "robot-cactus", item: "robot-cactus", title: "Robot cactus", group: "Robots",
    summary: "A potted columnar collector: the ribbed column and both arms are one continuum solver at different settings, the areoles and spine fans sit on the solved crests, and a rigid corolla opens at the crown.",
    files: ["components/ui/robot-cactus.tsx"],
    usage: `import { RobotCactus } from "@/components/ui/robot-cactus"

<RobotCactus behavior="flower" ribs={15} arms={2} />
<RobotCactus bloom={0.7} interactive onBloomChange={setBloom} />`,
    props: [
      view("front", "machine"),
      { name: "bloom", type: "number", description: "Controlled flowering, 0 shut and low to 1 wide and lifted. Supplying it stops the loop." },
      { name: "behavior", type: '"breathe" | "flower" | "reach" | "static"', default: '"breathe"', description: "Breathe leaves it shut and idling, so the wander is the motion; flower runs the whole flowering and shuts again; reach works the arms with the corolla never more than ajar." },
      { name: "speed", type: "number", default: "0.12", description: "One whole flowering per second at 1. It also scales the idle wander." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to work the flowering; arrows step 5 percent, shift 15, Home shut and End wide." },
      { name: "onBloomChange", type: "(bloom: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "track", type: "boolean", default: "true", description: "Lean toward the pointer while it is over the drawing. Suppressed while a drag is in progress." },
      { name: "look", type: "Vec2 | null", default: "null", description: "Controlled attention in −1..1; overrides pointer tracking." },
      { name: "ribs", type: "number", default: "13", description: "Rib crests round the column, clamped to 5..28. The areoles are placed on them." },
      { name: "ribDepth", type: "number", default: "0.2", description: "How deep the furrows cut, as a fraction of the radius; 0 leaves the column round." },
      { name: "areoles", type: "number", default: "4", description: "Areoles on each crest, clamped to 0..12. The column takes two more than the arms." },
      { name: "spines", type: "number", default: "6", description: "Needles in each areole\u2019s fan, clamped to 0..10. Above three it also grows one straight out of the pad." },
      { name: "arms", type: "number", default: "2", description: "Arms grown off the column, clamped to 0..4. Each leaves at its own station and bearing." },
      { name: "petals", type: "number", default: "16", description: "Petals in the outer rank of the corolla, clamped to 0..36. The inner rank takes about six in ten of them." },
      { name: "sway", type: "number", default: "1", description: "How much of the idle wander it runs, 0 rigid to 1 full." },
      { name: "showPot", type: "boolean", default: "true", description: "The pot, its lip and the soil." },
      ...droidForm,
    ],
    notes: [
      "The column and both arms are the same solver. A column is `emergence 0` with a wide spread, so it leans progressively; an arm is `emergence 88°` with a narrow one, so it leaves the trunk flat, turns hard at one place and runs up parallel to it. `sweep === emergence` ends a limb vertical whatever the elbow, which is the whole of lift and curl in one number.",
      "The ribs are a modulation of the section radius, so a crest is a line on the solved surface rather than a stripe drawn on a silhouette — and the areoles sit on those crests with the skin\u2019s own normal, taper included, which is what leans the crown\u2019s spines up and out.",
      "The lean is not a pose: the pointer and the idle wander add into one bearing and one magnitude handed to the column, and the arms and the flower are carried by that bend rather than aimed separately. The rib pattern is anchored to the world, or it would spin every time the machine changed its mind.",
      "Solved: the centreline and its exact length at every bend, the frame at every station, the ribbed sections, the crests, the areole lattice and its stagger, the skin normals, the spine fans, the petal length at every pitch, the arms\u2019 seats on the column, the silhouette, the projection and the facing culls.",
      "The corolla opens into a funnel rather than a disc. The front camera sits ten degrees above horizontal, so rigid blades opened flat would project to a line and the machine’s own native view would lose the one event it has; stopping at 32 degrees keeps a bowl with real height, and the silhouette flips from a tall narrow bud to a wide shallow cup.",
      "Illustrated: the pot, the soil, the stamen speckle, the status lamp and the lean line the blueprint variant draws. There is no botany — nothing grows and `bloom` is a shaped number, not a phenology.",
      "A generic potted machine and a generic flower. No species, grower or product artwork anywhere.",
    ],
  },
  {
    slug: "celestial-geometry", item: "celestial-geometry", title: "Celestial geometry", group: "Foundations",
    summary: "Kepler's equation solved to machine precision, ellipses about a focus, the terminator great circle, illumination and limb darkening, body frames, and a deterministic irregular radius field.",
    files: ["lib/robocn/celestial.ts"],
    usage: `import { orbitalState, terminator, limbDarkening } from "@/lib/robocn/celestial"

const state = orbitalState({ semiMajor: 100, eccentricity: 0.5, period: 4 }, time)
state.radius                       // a(1 − e·cos E): the hub is at a focus
terminator(44, { x: 0.4, y: 0.7, z: -0.6 })`,
    api: [
      { name: "solveKepler(meanAnomaly, eccentricity?)", type: "number", description: "The eccentric anomaly, by safeguarded Newton. Inverts itself to 1e-9 at every mean anomaly for eccentricities up to 0.97." },
      { name: "orbitalState(elements, time?)", type: "OrbitalState", description: "Position, radius and true anomaly, with the focus at the origin. One period returns the body to where it started, and equal areas are swept in equal times." },
      { name: "orbitPath(elements, steps?)", type: "Vec3[]", description: "The ellipse, stepped in eccentric anomaly so the curve is evenly drawn rather than bunched where the body runs." },
      { name: "terminator(radius, sun, steps?)", type: "Vec3[]", description: "The great circle where the light grazes the sphere. Projected, it is the crescent — which is why nothing has to draw one." },
      { name: "phaseFraction(sun, viewer)", type: "number", description: "The lit fraction of the disc a viewer sees: 1 at opposition, 0 at conjunction, a half at quadrature." },
      { name: "illumination(point, sun)", type: "number", description: "How lit one surface point is, −1 to 1, and exactly 0 on the terminator." },
      { name: "limbDarkening(mu, coefficient?)", type: "number", description: "`1 − u(1 − μ)`: the real law, monotone from the centre of the disc to the limb." },
      { name: "bodyFrame(options?)", type: "CelestialFrame", description: "A body's own axes: tilt the pole, then turn about it. Advance the spin and the precession at different rates and you have a tumble." },
      { name: "surfacePoint(frame, radius, latitude, longitude)", type: "Vec3", description: "A point on the turning body. Always at `radius`; a 360° spin is the identity." },
      { name: "latitudeBand / meridian", type: "Vec3[]", description: "A parallel and a longitude line on that same body." },
      { name: "sphereLattice(count)", type: "Vec3[]", description: "Points spread evenly over a sphere by equal area — craters, granules, spots — with no seam and no pole cluster." },
      { name: "lumpyRadius(direction, options?)", type: "number", description: "An irregular body's radius as a fraction of the mean. Deterministic for a seed, bounded in 1 ± depth, and smooth across every lobe axis." },
      { name: "spinAxis / lumpyPoint / discMu", type: "—", description: "The pole for a tilt and a bearing, that radius field applied, and the cosine of the view angle at a fraction of the way out of a disc." },
    ],
    notes: [
      "Pure functions over plain `{x, y, z}` in the set's world axes. No React, no camera, no dependencies.",
      "Kepler is safeguarded rather than plain Newton: the root is always within `e` of the mean anomaly, so that bracket is exact and any step leaving it is replaced by a bisection. Newton alone wanders near periapsis on a very eccentric orbit.",
      "No gravity, no perturbation theory, no radiative transfer and no ephemeris. The elements are the caller's, bodies do not pull on each other, and nothing here is a position for a date.",
    ],
  },
  {
    slug: "celestial-planet", item: "celestial-planet", title: "Celestial planet", group: "Machines",
    summary: "A tilted, turning globe with latitude bands, polar caps, longitude storms and a ring system the body genuinely occludes — the far arc is cut where the silhouette crosses it.",
    files: ["components/ui/celestial-planet.tsx"],
    usage: `import { CelestialPlanet } from "@/components/ui/celestial-planet"

<CelestialPlanet surface="banded" tilt={26} rings moons={2} />
<CelestialPlanet spin={140} sun={110} interactive onSpinChange={setSpin} />`,
    props: [
      view("front", "body"),
      { name: "spin", type: "number", description: "Controlled rotation about the pole, in degrees. Supplying it stops the loop." },
      { name: "behavior", type: '"rotate" | "orbit" | "tumble" | "static"', default: '"rotate"', description: "Rotate turns it; orbit walks the light round with it so the phase changes; tumble carries the pole round at a different rate." },
      { name: "speed", type: "number", default: "0.1", description: "Revolutions per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across the globe to turn it; arrows 10 degrees, shift 30, Home and End park it." },
      { name: "onSpinChange", type: "(spin: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "tilt", type: "number", default: "24", description: "Degrees the pole leans out of vertical, clamped to ±90." },
      { name: "precession", type: "number", default: "18", description: "The bearing the pole leans toward, in degrees." },
      { name: "sun", type: "number", description: "Where the light is, in degrees round the body; 0 is behind the viewer. Omit and the behaviour decides." },
      { name: "sunHeight", type: "number", default: "8", description: "Degrees the light stands above the body's orbital plane." },
      { name: "surface", type: '"terrestrial" | "banded" | "ice" | "molten"', default: '"banded"', description: "Which kind of world: it changes the banding, the cap latitude and the storm count, never the palette." },
      { name: "rings", type: "boolean", default: "true", description: "A ring system in the equatorial plane, occluded by the body." },
      { name: "moons", type: "number", default: "1", description: "Bodies on real Kepler orbits around it, clamped to 0..3. They go behind the globe too." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "The rings are the mechanism. They are one annulus in the body's own equatorial plane, and a ring point is hidden when it is behind the centre plane and its perpendicular distance to the line of sight is inside the radius — exact for a sphere seen orthographically. The visible runs are drawn far, globe, near.",
      "The day-night line is not drawn: `terminator` returns the great circle where the light grazes the sphere, and the night side is the camera-facing half of that circle closed against the unlit half of the limb.",
      "A latitude band is a ring about the pole, so rotation cannot move it. The storms have a longitude, which is what makes the spin something you can see.",
      "Solved: the terminator and its projection, the ring occlusion split, the bands and caps on the turning body, the moons' orbits, and the silhouette — which is the projected limb circle, not an assumed circle. Illustrated: the storm ovals and the band weights.",
      "No gravity and no scale. The moons do not perturb anything, and nothing here is a real world.",
    ],
  },
  {
    slug: "celestial-moon", item: "celestial-moon", title: "Celestial moon", group: "Machines",
    summary: "The phase machine: a lunation whose crescent is the projection of the terminator circle rather than a drawn shape, with libration rocking the body so the limb craters come round and go again.",
    files: ["components/ui/celestial-moon.tsx"],
    usage: `import { CelestialMoon } from "@/components/ui/celestial-moon"

<CelestialMoon behavior="cycle" craters={60} maria={3} />
<CelestialMoon phase={0.25} interactive onPhaseChange={setPhase} />`,
    props: [
      view("front", "body"),
      { name: "phase", type: "number", description: "Controlled lunation: 0 new, 0.25 first quarter, 0.5 full. Supplying it stops the loop." },
      { name: "behavior", type: '"cycle" | "libration" | "static"', default: '"cycle"', description: "Cycle runs the lunation; libration holds near full, where the rocking is the only thing left to see." },
      { name: "speed", type: "number", default: "0.09", description: "Lunations per second." },
      { name: "animate", type: "boolean", default: "true", description: "Off parks the body at `offset` and stops rendering. A reduced-motion preference does the same." },
      { name: "paused", type: "boolean", default: "false", description: "Freeze where it stands." },
      { name: "offset", type: "number", default: "0", description: "Seconds of clock offset, so a row of them breaks step. Named `offset` because `phase` is the lunation." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to scrub the lunation; arrows 2.5 percent, shift an eighth, Home new and End full." },
      { name: "onPhaseChange", type: "(phase: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "craters", type: "number", default: "46", description: "Craters on the surface, clamped to 0..200. Placed on the body, so they ride the libration." },
      { name: "maria", type: "number", default: "3", description: "Dark plains, clamped to 0..6." },
      { name: "libration", type: "number", default: "1", description: "How far the body rocks, 0 locked to 1 full." },
      { name: "tilt", type: "number", default: "5", description: "Degrees the pole leans out of vertical." },
      { name: "seed", type: "number", default: "7", description: "Any integer. The same seed is the same face, every render." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "A crescent drawn as two offset circles is nearly right at a crescent, wrong at a gibbous, and flips the wrong way at quarter. None of that is drawn here: the night side is the camera-facing half of the terminator great circle closed against the unlit half of the limb, so the flip happens because the geometry does it.",
      "Libration runs on a period of its own, which is why the near side is a range and not a fixed picture. Those ratios are illustrative rather than real periods, and the docs say so rather than the drawing implying otherwise.",
      "Each crater is a circle on the body, so it projects to an ellipse squashed toward the limb, and its floor sits on the side the light is not coming from — the same light the terminator was built from.",
      "Solved: the terminator and its projection, the lit fraction, the crater foreshortening and its shading, the libration frame, and the silhouette. Illustrated: the crater rim relief and the mare outlines.",
      "No ephemeris. `phase` is a number, not a date, and nothing here is a real body.",
    ],
  },
  {
    slug: "celestial-star", item: "celestial-star", title: "Celestial star", group: "Machines",
    summary: "A luminous body drawn from the limb-darkening law rather than a gradient, with granulation, a rotating spot belt, prominence loops anchored on the limb, and a corona.",
    files: ["components/ui/celestial-star.tsx"],
    usage: `import { CelestialStar } from "@/components/ui/celestial-star"

<CelestialStar kind="giant" behavior="flare" prominences={4} />
<CelestialStar activity={0.8} interactive onActivityChange={setActivity} />`,
    props: [
      view("front", "body"),
      { name: "activity", type: "number", description: "Controlled activity, 0 quiet to 1 violent. Supplying it stops the loop." },
      { name: "behavior", type: '"rotate" | "flare" | "pulse" | "static"', default: '"flare"', description: "Flare grows a loop over half the cycle and lets it fall back; pulse works the radius as well as the activity; rotate holds the surface steady and turns it." },
      { name: "speed", type: "number", default: "0.16", description: "Activity cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to work the activity; arrows 5 percent, shift 15, Home quiet and End violent." },
      { name: "onActivityChange", type: "(activity: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "kind", type: '"dwarf" | "main-sequence" | "giant"', default: '"main-sequence"', description: "Sets the radius and the limb-darkening coefficient: a cooler, more extended atmosphere darkens harder at the edge, and it is visible." },
      { name: "spin", type: "number", description: "Controlled rotation about the pole, in degrees. Omit and the clock turns it." },
      { name: "tilt", type: "number", default: "14", description: "Degrees the pole leans out of vertical." },
      { name: "shells", type: "number", default: "8", description: "Concentric bands the darkening law is sampled into, clamped to 3..20." },
      { name: "granules", type: "number", default: "90", description: "Convection cells on the disc, clamped to 0..260." },
      { name: "spots", type: "number", default: "5", description: "Cool spots in the latitude belt, clamped to 0..12. They go round the back as the body turns." },
      { name: "prominences", type: "number", default: "3", description: "Loops anchored on the limb, clamped to 0..8. They grow with activity." },
      { name: "corona", type: "boolean", default: "true", description: "The outer halo." },
      ...droidForm.filter((row) => row.name !== "showGround" && row.name !== "signal"),
    ],
    notes: [
      "The disc is not a radial gradient. Each shell is an annulus carrying `1 − I/I₀` at its own radius, off the law `I/I₀ = 1 − u(1 − μ)`. Stacked discs would composite into a ramp of their own making; a ring of the disc darkened by the law is the law and nothing else.",
      "The outline variants contour the same numbers instead of filling them, so the falloff reads as a set of level curves rather than disappearing.",
      "Prominences are anchored on the limb, because that is the only place a loop stands clear of the disc and reads as one. They travel round it as the body turns.",
      "Solved: the darkening law and the radius it is sampled at, the spot belt on the turning body and its foreshortening, the loop arcs along great circles, and the silhouette. Illustrated: the granulation cell shapes, the loop profile and the corona's falloff.",
      "No radiative transfer, no spectrum, no magnetic field. Activity is a number, not a solved dynamo, and nothing here is a real star.",
    ],
  },
  {
    slug: "celestial-asteroid", item: "celestial-asteroid", title: "Celestial asteroid", group: "Machines",
    summary: "An irregular body whose radius is a deterministic sum of cosine lobes, so its silhouette genuinely changes as it turns — and it tumbles about an axis that is itself going round.",
    files: ["components/ui/celestial-asteroid.tsx"],
    usage: `import { CelestialAsteroid } from "@/components/ui/celestial-asteroid"

<CelestialAsteroid body="contact" seed={4} craters={22} moonlet />
<CelestialAsteroid tumble={140} interactive onTumbleChange={setTumble} />`,
    props: [
      view("front", "body"),
      { name: "tumble", type: "number", description: "Controlled rotation in degrees. The pole follows it. Supplying it stops the loop." },
      { name: "behavior", type: '"tumble" | "spin" | "drift" | "static"', default: '"tumble"', description: "Tumble and spin turn it at different rates; drift barely turns it, the way a body nobody has hit in a long time turns." },
      { name: "speed", type: "number", default: "0.08", description: "Revolutions per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to turn it; arrows 10 degrees, shift 30, Home and End park it." },
      { name: "onTumbleChange", type: "(tumble: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "body", type: '"rubble" | "monolith" | "contact"', default: '"rubble"', description: "Sets the lobe count and how deep they cut: a rubble pile is many shallow lobes, a contact body is two deep ones." },
      { name: "seed", type: "number", default: "9", description: "Any integer. The same seed is the same rock, every render — on the server and in the browser alike." },
      { name: "craters", type: "number", default: "18", description: "Craters on the surface, clamped to 0..80." },
      { name: "sun", type: "number", default: "34", description: "Where the light is, in degrees round the body; 0 is behind the viewer." },
      { name: "moonlet", type: "boolean", default: "false", description: "A companion on its own orbit, which passes behind the rock." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "The outline is not a hull. A hull would bridge every hollow the lobes make, which is the whole subject — so the surface is sampled densely, projected, and the farthest sample in each angular bin about the centre is kept. That is the true silhouette of a body star-shaped about its own centre, concavities included.",
      "It tumbles rather than spins: the body turns about its pole while the pole itself goes round at a fraction of that rate which is not a whole number, so no two frames of the cycle repeat.",
      "The day-night line is taken analytically — the great circle of directions square to the light, with the body's own radius along each one — so the shadow's inner edge is smooth and its outer edge is the body's own rim.",
      "Solved: the radius field, the silhouette, the terminator, the shadow region, the crater foreshortening, the companion's orbit and its occlusion. Illustrated: the crater rims and the regolith shading.",
      "No collisional history, no rotation dynamics, no mass. The tumble is a shaped number rather than a solved free precession.",
    ],
  },
  {
    slug: "orrery", item: "orrery", title: "Orrery", group: "Machines",
    summary: "A geared model of a system: bodies carried on radial arms whose length is the orbital radius, running fast at periapsis and slow at apoapsis on real Kepler ellipses with the hub at a focus.",
    files: ["components/ui/orrery.tsx"],
    usage: `import { Orrery } from "@/components/ui/orrery"

<Orrery bodies={5} eccentricity={0.6} inclination={12} />
<Orrery epoch={3.2} interactive onEpochChange={setYear} />`,
    props: [
      view("plan", "machine"),
      { name: "epoch", type: "number", description: "Controlled time, in years. Supplying it stops the loop." },
      { name: "behavior", type: '"run" | "jog" | "static"', default: '"run"', description: "Run winds time on continuously; jog indexes a year at a time and dwells between them, the way a geared model is wound on." },
      { name: "speed", type: "number", default: "0.14", description: "Turns of the innermost body per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across the frame to wind time on — the full width is twenty-four years; arrows a quarter of a year, shift a whole one." },
      { name: "onEpochChange", type: "(epoch: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "bodies", type: "number", default: "4", description: "Bodies on the train, clamped to 1..6. Each gets an orbit, an arm, a gear and a body." },
      { name: "eccentricity", type: "number", default: "0.45", description: "How eccentric the orbits are, 0 circular to 1 as far as the set goes. Every orbit gets a different share of it." },
      { name: "inclination", type: "number", default: "7", description: "Degrees the outermost orbit is tilted out of the plane; the inner ones get a share, so the train reads as a stack of planes." },
      { name: "showOrbits", type: "boolean", default: "true", description: "Draw the ellipses the bodies run on." },
      { name: "showGears", type: "boolean", default: "true", description: "Draw the hub train the arms are geared to." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "The arm's length is the orbital radius, so it really does telescope in and out over a year — and the body runs at periapsis and loiters at apoapsis because `orbitalState` solves Kepler's equation rather than sliding an angle round at a constant rate.",
      "The hub is at a focus of every ellipse, not at the centre. That is the difference between a drawing of an orrery and one.",
      "The periods are not free either: they come from the third law, `T ∝ a^{3/2}`, so an outer body is slow because it is far out.",
      "Drawn from above, where the ellipses read true. Tipping the camera brings out the column and the plinth, which are the parts that only exist off the plan axis.",
      "Solved: Kepler's equation, the orbits and their foci, the periods, the arms, and the hub train as real horizontal circles. Illustrated: the gear teeth are not drawn and nothing is geared to anything — there is no gravity here and the bodies do not pull on each other.",
    ],
  },
  {
    slug: "hull-geometry", item: "hull-geometry", title: "Hull geometry", group: "Foundations",
    summary: "An equal-area tiling of a sphere into armour plates whose areas sum to exactly one, a fracture front and the straight-line travel behind it, a shock ring as a real circle, and a paraboloid dish.",
    files: ["lib/robocn/hull.ts"],
    usage: `import { hullPlates, burst, dish, dishNormal } from "@/lib/robocn/hull"

const plates = hullPlates(9, { perCourse: 12 })
plates.reduce((sum, plate) => sum + plate.area, 0)   // exactly 1: no gaps
burst(plates[7], 0.4, { origin: { x: 0, y: 0, z: -1 }, spread: 1.6 })`,
    api: [
      { name: "hullPlates(courses, options?)", type: "HullPlate[]", description: "The tiling. Courses are cut by equal area and divided into equal longitudes, so the plate areas sum to exactly one sphere at every course and plate count. Plates per course track the cosine of the latitude, so a polar plate is not a sliver." },
      { name: "plateOutline(plate, steps?)", type: "{ latitude, longitude }[]", description: "That plate's boundary: along the south parallel, up the east meridian, back along the north, down the west. A parallel is a curve on the body, so each edge is stepped rather than chorded." },
      { name: "plateNormal(plate)", type: "Vec3", description: "The unit direction of the plate's centre — where it sits on the intact hull." },
      { name: "burst(plate, progress, options?)", type: "PlateBurst", description: "The breakup. A fracture front sweeps out from `origin`, so a plate's `release` is 0 until the front reaches it; after that it travels in a straight line. At progress 0 every plate is back at `plateNormal` exactly, and the distance from the centre never decreases." },
      { name: "shockRing(centre, axis, radius, steps?)", type: "Vec3[]", description: "A real circle of that radius in the plane through `centre` square to `axis`. Projected, it is the ellipse — nothing has to draw one." },
      { name: "dish(radius, depth)", type: "DishSurface", description: "A paraboloid from its rim and its depth, carrying the focal length `r²/(4d)` measured from the vertex." },
      { name: "dishProfile / dishNormal / dishFocalPoint", type: "Vec2", description: "A point on the bowl, its outward normal there, and where the focus sits — all in the bowl's own axial plane. Reflecting an axial ray about that normal at any point on the surface sends it through the focus, which is what lets an emitter array be solved rather than aimed." },
      { name: "direction(latitude, longitude)", type: "Vec3", description: "The unit direction at a latitude and longitude, pole on `y` — the same convention `celestial-geometry` uses, so plate geometry hands straight to `surfacePoint`." },
    ],
    notes: [
      "Pure functions over plain numbers and `{x, y, z}`. No React, no camera, no dependency but `clamp`.",
      "Courses are cut by equal area rather than by equal angle, which is the reason the sum is exact rather than nearly right: the area of a zone depends only on its height, so stepping `sin(latitude)` uniformly gives every course exactly its share.",
      "The travel never comes back in, whatever the `focus` blend, because both candidate directions — straight out, and away from the rupture — have a non-negative component along the plate's own normal.",
      "No structure, no mass, no energy and no collision. Pieces pass through each other's paths because nothing is stopping them, and `progress` runs backwards as happily as forwards.",
    ],
  },
  {
    slug: "battle-station", item: "battle-station", title: "Battle station", group: "Machines",
    summary: "An armoured orbital station whose hull is a real tiling: the breakup launches every plate down its own line behind a fracture front, and putting it back reassembles the sphere exactly.",
    files: ["components/ui/battle-station.tsx"],
    usage: `import { BattleStation } from "@/components/ui/battle-station"

<BattleStation behavior="detonate" courses={9} perCourse={12} />
<BattleStation breakup={0.4} interactive onBreakupChange={setBreakup} />`,
    props: [
      view("front", "station"),
      { name: "breakup", type: "number", description: "Controlled breakup, 0 intact to 1 fully apart. Supplying it stops the loop." },
      { name: "behavior", type: '"patrol" | "charge" | "detonate" | "static"', default: '"detonate"', description: "Patrol just turns it; charge winds the dish up and fires; detonate fires, lets the hull go and puts it back." },
      { name: "speed", type: "number", default: "0.14", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to work the breakup; arrows 5 percent, shift 15, Home intact and End apart." },
      { name: "onBreakupChange", type: "(breakup: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "charge", type: "number", description: "Controlled dish charge, 0 cold to 1 firing. Omit and the behaviour drives it." },
      { name: "spin", type: "number", description: "Controlled rotation about the pole, in degrees. Omit and the clock turns it." },
      { name: "tilt", type: "number", default: "18", description: "Degrees the pole leans out of vertical." },
      { name: "courses", type: "number", default: "9", description: "Armour courses pole to pole, clamped 3..21. Every course is exactly the same area." },
      { name: "perCourse", type: "number", default: "12", description: "Plates round the equator, clamped 4..28. Every other course scales by its own cosine." },
      { name: "plating", type: "number", default: "1", description: "How much of the hull is plated. Courses come off pole-first, showing the ribs and girdle rings under them." },
      { name: "trench", type: "boolean", default: "true", description: "The equatorial service trench: a course carrying no plating at all, so it is a hole in the hull rather than a stripe on one." },
      { name: "ribs", type: "number", default: "12", description: "Meridional ribs on the frame under the plating, clamped 0..24." },
      { name: "dishLatitude / dishLongitude", type: "number", default: "34 / 72", description: "Degrees: where the focusing dish sits on the hull. It is placeable, not a fixed signature position." },
      { name: "dishSpan", type: "number", default: "26", description: "Degrees of hull the dish bore takes up, measured from its axis. Clamped 8..48 — the plates inside it are removed." },
      { name: "emitters", type: "number", default: "8", description: "Emitters round the bowl, clamped 0..16. Their rays are solved onto the focus." },
      { name: "rupture", type: "number", default: "24", description: "Degrees round the body the hull fails at. The fracture front starts here." },
      { name: "spread", type: "number", default: "0.75", description: "How far a plate travels by the end, in radii. Clamped 0..6." },
      { name: "seed", type: "number", default: "5", description: "Any integer. The same seed is the same breakup, every render." },
      { name: "sun", type: "number", default: "38", description: "Where the light is, in degrees round the body; 0 is behind the viewer." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "The hull is a tiling, not a texture: equal-area courses divided into equal longitudes, whose plate areas sum to exactly one sphere. `breakup` launches those plates rather than fading one drawing into another, and at 0 every plate is back where the tiling put it to the last bit — so the intact station is not a second drawing.",
      "It peels rather than inflates. A fracture front sweeps out from the rupture, so the near side lets go while the far side is still whole, and each plate then travels in a straight line at its own share of the speed.",
      "The trench is a course with nothing on it, and `plating` takes courses away pole-first, which is why the ribs and girdle rings show through. Both are the same tiling read a different way: under construction and coming apart are one ordering run in two directions.",
      "The dish is a paraboloid. Its focal length is `r²/(4d)` and each emitter ray is an axial ray reflected about the bowl's own normal, so the rays converge on the focus because the surface does. The beam that leaves the focus is illustrated.",
      "Solved: the tiling and its areas, every plate boundary, the fracture front and release order, the trajectories, the dish surface and the emitter convergence, the day-night line, the per-plate illumination, and the projection of all of it. Illustrated: the trench and hatch detail, the beam's taper and glow, the shock ring's expansion rate, and the rib profile.",
      "Nothing is simulated. No mass, no energy, no structural model and no collision — plates pass through each other's paths because nothing is stopping them, and `breakup` runs backwards as happily as forwards. It is a tiling coming apart, not a thing failing.",
      "An original archetype: a generic armoured orbital station. The dish position is a prop, the plating is a generic course pattern, and nothing here reproduces a craft, a crest or a paint scheme from anywhere.",
    ],
  },
  {
    slug: "debris-field", item: "debris-field", title: "Debris field", group: "Machines",
    summary: "A population of hull fragments on straight trajectories from one rupture, each released at its own moment and turning at its own rate, drawn back to front so a near fragment occludes a far one.",
    files: ["components/ui/debris-field.tsx"],
    usage: `import { DebrisField } from "@/components/ui/debris-field"

<DebrisField behavior="drift" courses={6} perCourse={9} showTrails />
<DebrisField spread={0.7} interactive onSpreadChange={setSpread} />`,
    props: [
      view("front", "field"),
      { name: "spread", type: "number", description: "Controlled scatter, 0 still assembled to 1 fully apart. Supplying it stops the loop." },
      { name: "behavior", type: '"burst" | "drift" | "tumble" | "static"', default: '"drift"', description: "Burst runs the scatter out and back; drift holds it and lets the tumble carry the drawing; tumble holds it further out." },
      { name: "speed", type: "number", default: "0.1", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across it to scrub the scatter; arrows 5 percent, shift 15, Home assembled and End apart." },
      { name: "onSpreadChange", type: "(spread: number) => void", description: "Fires on every drag and key press, in controlled mode too." },
      { name: "courses", type: "number", default: "6", description: "Courses the body was plated in, clamped 2..14. With `perCourse` it sets the fragment count." },
      { name: "perCourse", type: "number", default: "9", description: "Fragments round the equator of that body, clamped 2..20." },
      { name: "reach", type: "number", default: "1.3", description: "How far a fragment travels at full spread, in radii. Clamped 0..12." },
      { name: "rupture", type: "number", default: "18", description: "Degrees round the field the rupture sat at." },
      { name: "showTrails", type: "boolean", default: "false", description: "Straight lines back to the piece of hull each fragment came off — the trajectories, drawn." },
      { name: "showShock", type: "boolean", default: "true", description: "The expanding front." },
      { name: "seed", type: "number", default: "5", description: "Any integer. The same seed is the same field, every render." },
      { name: "sun", type: "number", default: "38", description: "Where the light is, in degrees round the field; 0 is behind the viewer." },
      ...droidForm.filter((row) => row.name !== "showGround"),
    ],
    notes: [
      "This is the only drawing in the set that has to decide what is in front of what. Everything else here is one object; this is a population with nothing holding it in any order, so the fragments are sorted by `camera.depth` and painted back to front — and the order changes when the camera moves rather than the artwork being redrawn per angle.",
      "Every fragment is a plate off the same tiling `battle-station` is built from, on the same solved trajectory. At `spread` 0 they reassemble into the body exactly, which is what makes the scatter readable as a scatter of something.",
      "The fragments keep turning after they have flown out, because nothing stopped them: the tumble runs off the clock rather than off the travel. That is the difference from the station's breakup, where a plate turns only while it is being thrown.",
      "Solved: the tiling, the fracture front and its release order, the straight-line travel, each fragment's own tumble frame, the illumination, the depth sort, the shock ring as a real circle in a stated plane, and the trails — which are straight because the solver makes them so.",
      "Illustrated: the fragment edge shading and the shock ring's expansion rate and fade. There is no mass, no energy, no gravity and no collision: fragments pass through each other's paths, and `spread` is a number you can scrub in both directions rather than a time after an event.",
    ],
  },
  {
    slug: "linkage-geometry", item: "linkage-geometry", title: "Linkage geometry", group: "Foundations",
    summary:
      "Closed-loop kinematics: a four-bar, a slider-crank and a block and tackle, plus the helpers that lift an elevation drawing into world space. No React, no dependencies, and no dynamics.",
    files: ["lib/robocn/linkage.ts"],
    usage: `import { solveFourBar, solveSliderCrank, tacklePosition } from "@/lib/robocn/linkage"

const pose = solveFourBar(48, { ground: -56, rise: 76, crank: 14, coupler: 78, rocker: 56 }, { branch: "down" })
const piston = solveSliderCrank(120, { crank: 15, rod: 62 })
const block = tacklePosition(3, { lines: 8, drumRadius: 11, topHeight: 204, floorHeight: 72 })`,
    api: [
      { name: "solveFourBar", type: "(crankAngle: number, geometry: FourBarGeometry, options?) => FourBarPose", description: "Closes the loop as a circle intersection, so both link lengths are exact. `branch` picks the assembly; `assembled` is false where the loop cannot close and the pose is stretched rather than NaN." },
      { name: "rigidPoint", type: "(origin: Vec2, angle: number, along: number, offset?: number) => Vec2", description: "A point rigidly attached to a link: along its direction, then to its left." },
      { name: "solveSliderCrank", type: "(crankAngle: number, geometry: SliderCrankGeometry) => SliderCrankPose", description: "The degenerate four-bar. Reports the wrist pin, the rod angle, and the analytic stroke between the two dead centres." },
      { name: "tacklePosition", type: "(drumTurns: number, geometry: TackleGeometry) => TacklePosition", description: "Shares the drum's payout between the strung lines: block travel is payout ÷ lines and the advantage is the line count." },
      { name: "tackleReeving", type: "(crown: Vec2, block: Vec2, lines: number, spacing: number) => Vec2[]", description: "The rope itself, zig-zagging between the crown and block sheaves, with exactly `lines` falls." },
    ],
    notes: [
      "Pure geometry. No mass, torque, inertia, friction, rope stretch or sheave efficiency is modelled anywhere in the file.",
      "The elevation helpers that turn a drawing into world-space solids — `elevationDraft`, `elevationSolid`, `elevationDisc`, `fitTransform` — live in `robot-style`, since every machine projects the same way.",
    ],
  },
  {
    slug: "pumpjack", item: "pumpjack", title: "Pumpjack", group: "Machines",
    summary:
      "A beam pump with its four-bar actually solved. The crank turns, the pitman closes the loop, and the polished-rod stroke is what the link lengths produce — not a number anyone typed.",
    files: ["components/ui/pumpjack.tsx"],
    usage: `import { Pumpjack } from "@/components/ui/pumpjack"

<Pumpjack behavior="pump" balance="crank" />
<Pumpjack crankAngle={120} balance="beam" interactive onCrankAngleChange={setAngle} />`,
    props: [
      { name: "crankAngle", type: "number", description: "Controlled crank angle in degrees. Supplying it stops the loop." },
      { name: "behavior", type: `"pump" | "slow" | "static"`, default: `"pump"`, description: "Continuous pumping, or a pump-off duty cycle: two revolutions then a rest." },
      { name: "balance", type: `"crank" | "beam" | "air"`, default: `"crank"`, description: "Where the counterbalance mass is carried. It moves the mass, not the linkage." },
      { name: "showWell", type: "boolean", default: "true", description: "The stuffing box, wellhead and flow line under the polished rod." },
      { name: "interactive / onCrankAngleChange", type: "boolean / (angle: number) => void", description: "Turn the gearbox by hand: the pointer's bearing about the crank centre is the crank angle." },
      view("profile", "beam pump"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The four-bar, the beam angle and the rod stroke are solved; the horsehead's arc is centred on the saddle bearing, which is why the rod stays vertical and travels exactly radius × beam angle.",
      "No dynamics: no fluid, rod load, torque, counterbalance calculation or production rate is computed.",
    ],
  },
  {
    slug: "drilling-derrick", item: "drilling-derrick", title: "Drilling derrick", group: "Machines",
    summary:
      "A mast, a crown, and a travelling block that is reeved rather than positioned: the drum's payout is shared between the strung lines, so mechanical advantage shows up as rope.",
    files: ["components/ui/drilling-derrick.tsx"],
    usage: `import { DrillingDerrick } from "@/components/ui/drilling-derrick"

<DrillingDerrick behavior="trip" lines={8} />
<DrillingDerrick hoist={0.35} lines={12} interactive onHoistChange={setHoist} />`,
    props: [
      { name: "hoist", type: "number", description: "Controlled block height, 0 at the floor to 1 at the crown. Stops the loop." },
      { name: "behavior", type: `"trip" | "drill" | "static"`, default: `"trip"`, description: "The whole mast up and back, or a slow feed off the top and a run back up to make a connection." },
      { name: "lines", type: "4 | 6 | 8 | 10 | 12", default: "6", description: "Lines strung between the crown and the block. More lines means more drum turns for the same lift." },
      { name: "showString / showRack", type: "boolean", default: "true", description: "The string below the floor and the mud return; the racked stands inside the mast." },
      { name: "interactive / onHoistChange", type: "boolean / (hoist: number) => void", description: "Drag or arrow-key the block up and down the mast." },
      view("front", "derrick"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Block travel and the reeved falls are solved from a constant rope length. Nothing computes hook load, line tension, rope stretch, sheave efficiency or depth.",
      "The hole, the string below the floor and the returning mud are illustrated.",
    ],
  },
  {
    slug: "mud-pump", item: "mud-pump", title: "Mud pump", group: "Machines",
    summary:
      "The only multi-cylinder machine in the set. Each cylinder is its own slider-crank at its own throw angle, and the discharge readout is the sum of the solved piston velocities.",
    files: ["components/ui/mud-pump.tsx"],
    usage: `import { MudPump } from "@/components/ui/mud-pump"

<MudPump behavior="stroke" cylinders={3} />
<MudPump crankAngle={210} cylinders={2} interactive onCrankAngleChange={setAngle} />`,
    props: [
      { name: "crankAngle", type: "number", description: "Controlled crankshaft angle in degrees. Supplying it stops the loop." },
      { name: "behavior", type: `"stroke" | "surge" | "static"`, default: `"stroke"`, description: "A steady revolution, or the same revolution taken unevenly." },
      { name: "cylinders", type: "1 | 2 | 3", default: "3", description: "Simplex, duplex or triplex. The throws stay evenly spaced, and the discharge gets smoother as you add them." },
      { name: "showFlow", type: "boolean", default: "true", description: "The suction and discharge manifolds, the dampener, and the discharge the pistons add up to." },
      { name: "interactive / onCrankAngleChange", type: "boolean / (angle: number) => void", description: "Turn the crankshaft by hand." },
      view("iso", "mud pump"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The crossheads, rods and pistons are solved by `solveSliderCrank`; the discharge is those solved positions differenced and summed, which is geometry.",
      "No hydraulics: no pressure, flow rate, valve timing, slip, compressibility or fluid is modelled.",
    ],
  },
  {
    slug: "wellhead-tree", item: "wellhead-tree", title: "Wellhead tree", group: "Machines",
    summary:
      "The valve stack on a completed well. Every valve's rising stem shows its state, and the accent is drawn only along the bore the open valves actually leave through.",
    files: ["components/ui/wellhead-tree.tsx"],
    usage: `import { WellheadTree } from "@/components/ui/wellhead-tree"

<WellheadTree service="production" behavior="throttle" />
<WellheadTree service="shut-in" choke={0} pressure={0.4} />`,
    props: [
      { name: "choke", type: "number", description: "Controlled choke opening, 0 shut to 1 wide. Supplying it stops the loop." },
      { name: "service", type: `"production" | "shut-in" | "kill"`, default: `"production"`, description: "What the tree is lined up to do, which is which valves are open." },
      { name: "behavior", type: `"throttle" | "shut-in" | "static"`, default: `"throttle"`, description: "Working the bean across its range, or closing it and leaving it closed." },
      { name: "pressure", type: "number", default: "0.58", description: "A gauge reading you supply, 0 to 1 of the dial. Never inferred." },
      { name: "showFlow", type: "boolean", default: "true", description: "The line leaving the live wing, its width set by the choke." },
      { name: "interactive / onChokeChange", type: "boolean / (choke: number) => void", description: "Drag or arrow-key the choke open and shut." },
      view("front", "wellhead tree"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The valve line-up is the mechanism: shut the master and nothing above it is live, whatever the choke is doing.",
      "No pressure, flow, temperature or rate is computed anywhere. `pressure` is a reading the caller supplies and the component only points a needle at.",
    ],
  },
  {
    slug: "storage-tank", item: "storage-tank", title: "Storage tank", group: "Machines",
    summary:
      "A tank whose roof has no fixed height. The floating roof rides the liquid and the rolling ladder, hinged at the shell top with its wheels on the deck, is solved from wherever the roof is.",
    files: ["components/ui/storage-tank.tsx"],
    usage: `import { StorageTank } from "@/components/ui/storage-tank"

<StorageTank behavior="fill" courses={5} />
<StorageTank level={0.3} roof="fixed" interactive onLevelChange={setLevel} />`,
    props: [
      { name: "level", type: "number", description: "Controlled liquid level, 0 empty to 1 full. Supplying it stops the loop." },
      { name: "behavior", type: `"fill" | "draw" | "static"`, default: `"fill"`, description: "A tank running up and back down, or a slow draw-off and a fast refill." },
      { name: "roof", type: `"floating" | "fixed"`, default: `"floating"`, description: "A roof that rides the liquid, or a cone roof that does not — in which case the level only shows on the gauge." },
      { name: "courses", type: "number", default: "4", description: "Shell courses, drawn as weld seams round the tank. Clamped to 2–8." },
      { name: "showStair", type: "boolean", default: "true", description: "The spiral stairway up the outside of the shell." },
      { name: "interactive / onLevelChange", type: "boolean / (level: number) => void", description: "Drag or arrow-key the tank up and down." },
      view("front", "tank"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The shell is a body of revolution, so the silhouette, the course seams, the wind girder and the spiral stair are one geometry projected from every camera.",
      "A low roof is genuinely hidden behind the near wall from ground level, which is why the gauge board is there. No volume, mass, vapour, temperature or capacity is computed.",
    ],
  },
  {
    slug: "oil-tanker", item: "oil-tanker", title: "Oil tanker", group: "Machines",
    summary:
      "The one machine in the set whose ground plane cuts through it. Cargo moves the hull down through the waterline, carrying the boot top, the draft marks and the load line under with it.",
    files: ["components/ui/oil-tanker.tsx"],
    usage: `import { OilTanker } from "@/components/ui/oil-tanker"

<OilTanker behavior="laden" tanks={8} />
<OilTanker cargo={0.2} behavior="swell" interactive onCargoChange={setCargo} />`,
    props: [
      { name: "cargo", type: "number", description: "Controlled cargo, 0 in ballast to 1 fully laden. Supplying it stops the loop." },
      { name: "behavior", type: `"laden" | "swell" | "static"`, default: `"laden"`, description: "A whole port call, or a held cargo with the sea doing the moving." },
      { name: "tanks", type: "number", default: "6", description: "Cargo tanks, which is also the hatches drawn along the deck. Clamped to 2–10." },
      { name: "showManifold", type: "boolean", default: "true", description: "The midship manifold, its hose over the side, and the cargo gauges." },
      { name: "interactive / onCargoChange", type: "boolean / (cargo: number) => void", description: "Drag or arrow-key her down through the waterline." },
      view("profile", "tanker"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Heave and trim are a rigid motion applied in the hull's own plane, so every camera sees the same ship rather than a rotated picture of one.",
      "The draft is a drawn proportion of a drawn hull. Nothing solves displacement, buoyancy, trim, stability, tonnage or a hull form.",
    ],
  },
  {
    slug: "tanker-truck", item: "tanker-truck", title: "Tanker truck", group: "Machines",
    summary:
      "A tractor unit and a road tanker on one kingpin. Steer the front axle and the trailer's yaw is solved, not chosen — so it off-tracks inside the tractor's line, and the barrel foreshortens in side elevation as it turns.",
    files: ["components/ui/tanker-truck.tsx"],
    usage: `import { TankerTruck } from "@/components/ui/tanker-truck"

<TankerTruck behavior="haul" compartments={5} />

// Manoeuvre is the behaviour that gives the hitch something to solve.
<TankerTruck behavior="manoeuvre" view="plan" />

// A pinned hitch overrides the solution.
<TankerTruck level={0.4} hitch={30} view="plan" />`,
    props: [
      { name: "level", type: "number", description: "Controlled cargo, 0 empty to 1 full. Supplying it stops the loop." },
      { name: "behavior", type: `"haul" | "discharge" | "manoeuvre" | "static"`, default: `"haul"`, description: "Rolling with a full barrel, a delivery round emptying a compartment at a time, or a yard manoeuvre that works the articulation." },
      { name: "compartments", type: "number", default: "4", description: "Bulkheaded compartments, which discharge from the rear. Clamped to 2–6." },
      { name: "steer", type: "number", description: "Front-axle steering in degrees, positive to starboard, clamped to ±26 — past that the kingpin’s circle closes inside the trailer’s wheelbase and there is no steady articulation to solve for. Omit it and the behaviour drives the rack." },
      { name: "hitch", type: "number", description: "Trailer yaw about the kingpin in degrees, clamped to ±60. Omit it and it is solved from the steer; supply it and the solution is overridden." },
      { name: "showCabinet", type: "boolean", default: "true", description: "The discharge cabinet, the hose reel, and a gauge per compartment." },
      { name: "showGround", type: "boolean", default: "true", description: "The carriageway and its lane markings, which run with the road speed." },
      { name: "interactive / onLevelChange", type: "boolean / (level: number) => void", description: "Drag or arrow-key the load in and out." },
      view("profile", "road tanker"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the two steer-wheel angles from `ackermann()`, and the articulation angle from `hitchAngle()` — the kingpin rides a circle of its own and the bogie cannot slide sideways, which fixes the angle between the units. It is a steady state with no history, so a truck that has been round a corner comes out of it straight.",
      "The yaw is a real rotation about the kingpin's vertical axis in world space, not a rotation of the drawing, so the bogie goes round with the barrel instead of staying behind.",
      "The barrel is opaque, so each compartment's contents are read off the cabinet gauges and its dome collar rather than drawn through the shell.",
      "No suspension, mass, load transfer or fluid is computed, and nothing accumulates where it has driven.",
    ],
  },
  {
    slug: "flare-stack", item: "flare-stack", title: "Flare stack", group: "Machines",
    summary:
      "The one machine in the family that is a process rather than a mechanism: a knockout drum, a derrick-supported riser and a tip, under a plume whose length is the flow and whose lean is the wind.",
    files: ["components/ui/flare-stack.tsx"],
    usage: `import { FlareStack } from "@/components/ui/flare-stack"

<FlareStack behavior="flare" wind={22} />
<FlareStack flow={0.05} behavior="pilot" />`,
    props: [
      { name: "flow", type: "number", description: "Controlled flow to the tip, 0 pilots only to 1 full. Supplying it stops the loop." },
      { name: "behavior", type: `"flare" | "pilot" | "static"`, default: `"flare"`, description: "A relief event — fast rise, long decay — or pilots lit and nothing else." },
      { name: "wind", type: "number", default: "14", description: "Lean on the plume in degrees from vertical, clamped to ±50." },
      { name: "showKnockout", type: "boolean", default: "true", description: "The knockout drum and the header running up to the riser." },
      { name: "interactive / onFlowChange", type: "boolean / (flow: number) => void", description: "Drag or arrow-key the flow to the tip." },
      view("front", "flare stack"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Everything solid is modelled — drum, derrick, riser, tip, steam ring, pilots. The plume is drawn: `flow` is a proportion of its length, not a rate.",
      "No heat, radiation, smoke, composition, velocity or combustion is computed.",
    ],
  },
  {
    slug: "fractionating-column", item: "fractionating-column", title: "Fractionating column", group: "Machines",
    summary:
      "A crude tower whose tray count is the axis. The spacing, the weld-ring seams and the heights the side draws come off are all derived from it, so more trays rebuilds the column rather than redrawing it.",
    files: ["components/ui/fractionating-column.tsx"],
    usage: `import { FractionatingColumn } from "@/components/ui/fractionating-column"

<FractionatingColumn trays={18} cut={2} behavior="run" />
<FractionatingColumn heat={0.8} trays={8} interactive onHeatChange={setHeat} />`,
    props: [
      { name: "heat", type: "number", description: "Controlled heat into the column, 0 to 1. It moves the flash zone, and stops the loop." },
      { name: "behavior", type: `"run" | "swing" | "static"`, default: `"run"`, description: "A steady case with a slow drift, or the column pushed from one cut point to another." },
      { name: "trays", type: "number", default: "14", description: "Trays in the shell, clamped to 6–24. Sets the spacing and the seam count." },
      { name: "cut", type: "number", default: "1", description: "Which side draw is running, 0 lightest: naphtha, kerosene, diesel, gas oil." },
      { name: "showCircuits", type: "boolean", default: "true", description: "The overhead drum and reflux line, and the reboiler at the bottom." },
      { name: "interactive / onHeatChange", type: "boolean / (heat: number) => void", description: "Drag or arrow-key the heat, and watch the flash zone move." },
      view("front", "column"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The shell is a body of revolution, so the tray seams and the platform rings are exact from every camera, and the draws are real nozzles with real valves.",
      "The temperature strip is an illustrated gradient and the flash zone a marker on it. Nothing computes a flash, a separation, a composition, a temperature or a rate.",
    ],
  },
  {
    slug: "jackup-rig", item: "jackup-rig", title: "Jack-up rig", group: "Machines",
    summary:
      "One number that is both halves of the drawing: the legs are a fixed length, so raising the hull out of the water shortens the stick-up above it by exactly the same amount.",
    files: ["components/ui/jackup-rig.tsx"],
    usage: `import { JackupRig } from "@/components/ui/jackup-rig"

<JackupRig behavior="jack" legs={4} />
<JackupRig elevation={0.1} interactive onElevationChange={setElevation} />`,
    props: [
      { name: "elevation", type: "number", description: "Controlled hull elevation, 0 afloat to 1 jacked right up. Supplying it stops the loop." },
      { name: "behavior", type: `"jack" | "preload" | "static"`, default: `"jack"`, description: "A full move on and off location, or the small settling cycle she does on arrival." },
      { name: "legs", type: "3 | 4", default: "3", description: "Legs on the hull, each with its own jacking house and spudcan." },
      { name: "showDerrick", type: "boolean", default: "true", description: "The cantilever and the drilling package skidded out over the stern." },
      { name: "interactive / onElevationChange", type: "boolean / (elevation: number) => void", description: "Drag or arrow-key the hull up and down its legs." },
      view("front", "jack-up"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The legs are trusses in world space and the hull is a solid, so all four cameras are looking at the same rig.",
      "The seabed and the water are drawn. Nothing computes buoyancy, penetration, punch-through, leg loads or a sea state.",
    ],
  },
  {
    slug: "spring-hopper", item: "spring-hopper", title: "Spring hopper", group: "Robots",
    summary: "A single-legged rig that bounces on a real spring. Flight is a parabola and stance is a mass on a spring, and how long each lasts is a consequence of the drop height and the spring rate rather than a duty knob.",
    files: ["components/ui/spring-hopper.tsx"],
    usage: `import { SpringHopper } from "@/components/ui/spring-hopper"

<SpringHopper behavior="hop" />

// Softer spring, taller hop: longer contact, deeper squat, same ballistics.
<SpringHopper behavior="bound" stiffness={14} height={0.9} />

// Or load the spring yourself. Controlled compression plants it on the ground.
<SpringHopper compression={0.8} interactive onCompressionChange={setLoad} />`,
    props: [
      view("profile", "rig"),
      { name: "behavior", type: '"hop" | "bound" | "pump" | "static"', default: '"hop"', description: "What it does when compression is not supplied: the steady bounce, a taller one with the leg swung for the landing, or working the spring on the spot without ever leaving the ground." },
      { name: "compression", type: "number", description: "Controlled spring load, 0 free to 1 at the deepest it goes. Supplying it stops the loop and plants the machine — you cannot drive it into the air." },
      { name: "onCompressionChange", type: "(compression: number) => void", description: "Fires throughout a drag and on every arrow key, so interaction works in controlled mode too." },
      { name: "height", type: "number", default: "0.5", description: "Apex of the hop in hop units, 0–1. One hop unit is 70 drawing units." },
      { name: "stiffness", type: "number", default: "40", description: "Spring rate in weights per hop unit, 4–400. Static sag is its reciprocal, and it sets the contact time." },
      { name: "speed", type: "number", default: "0.8", description: "Hops per second." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag down the frame to load the spring; release and it eases back into the behaviour. Arrows 5%, shift 15%, Home free and End fully loaded." },
      ...loop,
      { name: "signal", type: '"idle" | "ready" | "warning"', default: '"ready"', description: "Mast lamp: neutral, accent, or shell." },
      { name: "showGround", type: "boolean", default: "true", description: "The ground line and the shadow, which shrinks as it rises." },
      { name: "label", type: "string", description: "Caption underneath; the blueprint variant adds the duty factor to it." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The spring is drawn as a spring: a sampled helix whose coil count and radius never change, because a real one compresses by twisting its wire. It cannot pass its own solid height, and when it lands there the machine stops sinking — soften the spring under a full-height drop in the demo and you can watch it bottom out.",
      "Stance and flight are solved, not tweened. Contact time is the closed form for a mass on a spring under gravity, so a stiffer spring gives a shorter, harder contact at the same hop height and the duty factor moves with it.",
      "Illustrated, not solved: the leg swing and the reaction wheel that answers it. A free machine really does turn a wheel against its limb to aim the next landing, but the ratio here is drawn rather than an inertia model. The leg never swings while the foot is planted.",
      "No damping inside the stance, no travel across the frame, no motor and no energy budget — the steady hop is the ideal lossless case. An original archetype: a single-legged hopping test rig, with no manufacturer or character reproduced.",
    ],
  },
  {
    slug: "ball-hopper", item: "ball-hopper", title: "Ball hopper", group: "Robots",
    summary: "A bounding sensor ball whose shell is its own compliance. It flattens on impact at constant volume — so it has to get exactly that much wider — and with a restitution below one it bounces lower each time and comes to rest.",
    files: ["components/ui/ball-hopper.tsx"],
    usage: `import { BallHopper } from "@/components/ui/ball-hopper"

<BallHopper behavior="bounce" />

// Dropped and left alone: each bounce is e² of the last, then it sits down.
<BallHopper behavior="settle" restitution={0.55} />

// Or hold it up yourself and let go.
<BallHopper altitude={1} interactive onAltitudeChange={setHeight} />`,
    props: [
      view("front", "shell"),
      { name: "behavior", type: '"bounce" | "settle" | "skitter" | "static"', default: '"bounce"', description: "What it does when altitude is not supplied: the steady bounce, a whole settling sequence a cycle, or fast low bounces with the band turning." },
      { name: "altitude", type: "number", description: "Controlled height, 0 on the ground to 1 at the top of its drop. Supplying it stops the loop and holds it there — off the ground, so not touching and not squashed." },
      { name: "onAltitudeChange", type: "(altitude: number) => void", description: "Fires throughout a drag and on every arrow key." },
      { name: "spin", type: "number", description: "Which way the sensor band faces, in degrees. Omit and it turns as it bounces." },
      { name: "height", type: "number", default: "0.6", description: "Apex of the bounce in hop units, 0–1. One hop unit is 70 drawing units." },
      { name: "stiffness", type: "number", default: "40", description: "Shell stiffness in weights per hop unit, 4–400. Sets the contact time and how deep the squash goes." },
      { name: "restitution", type: "number", default: "0.66", description: "Fraction of the landing speed returned at take-off, 0–1. Apexes decay by its square, which is what drives settle." },
      { name: "speed", type: "number", default: "0.7", description: "Bounces a second, or settling sequences a second when the behavior is settle." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag up the frame to lift it; release and it drops. Arrows 5%, shift 15%, Home on the ground and End at the top." },
      ...loop,
      { name: "signal", type: '"idle" | "ready" | "warning"', default: '"ready"', description: "Optic lamp: neutral, accent, or shell." },
      { name: "showGround", type: "boolean", default: "true", description: "The horizon line and the shadow, which shrinks as it rises." },
      { name: "label", type: "string", description: "Caption underneath; the blueprint variant adds the restitution to it." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The squash conserves volume: an oblate spheroid with rx² ry = r³, so flattening the shell widens it by exactly that much. Because the orthographic projection of a spheroid is exactly an axis-aligned ellipse, a squashed ball reads as a flatter one in the elevations and a wider one in plan view, out of one geometry and with no artwork per angle.",
      "It comes to rest in finite time, which is not free: contact time does not go to zero as the landing speed does, so an ideal Zeno bounce never finishes. The sequence ends when the rebound can no longer lift the shell clear, and it then sits at its static sag.",
      "Illustrated, not solved: the contact patch — a constant-volume shell stays tangent to the ground, so the patch is drawn rather than cut — and the yaw, which does not come out of the contact. The band, lugs, vents and optic sit on the shell's own surface and are drawn only where a camera can see them.",
      "Not orb-droid: that one rolls, never leaves the ground, and has a rigid shell. Nothing travels across the frame, and no friction, spin-up or material is modelled. An original archetype: a throwable bounding sensor ball.",
    ],
  },
  {
    slug: "hopper-dynamics", item: "hopper-dynamics", title: "Hopper dynamics", group: "Foundations",
    summary: "The bounce solver behind both hoppers: an exact parabola in the air, an exact spring-mass stance on the ground, and the split between them derived rather than dialled.",
    files: ["lib/robocn/hopper.ts"],
    usage: `import { solveHop, hopTimings, solveDrop, springCoils, squashRadii } from "@/lib/robocn/hopper"

const timings = hopTimings({ height: 0.5, stiffness: 40 })
timings.duty  // fraction of the cycle spent touching the ground

const state = solveHop({ phase: 0.3, stiffness: 40 })
state.altitude  // negative while the compliance is loaded

solveDrop({ time: 4, height: 1, restitution: 0.6 }).resting
springCoils({ length: 40, turns: 6, radius: 7, wire: 1.4 }).bottomedOut
squashRadii(30, 0.25)  // { rx, ry }, at constant volume`,
    api: [
      { name: "solveHop", type: "(options?: HopOptions) => HopState", description: "The steady bounce as a function of the cycle fraction: touchdown at phase 0, stance, take-off, flight. Wraps in both directions." },
      { name: "HopState", type: "{ altitude, compression, squeeze, contact, velocity, load, bounce, resting }", description: "Altitude is height above the machine's free-standing rest and goes negative while the compliance is loaded; load is in machine weights, so 1 is standing still." },
      { name: "hopTimings", type: "(options?: HopOptions) => HopTimings", description: "Contact, flight, cycle, duty, depth, take-off speed, static sag and natural frequency — every one a consequence of the drop height and the spring rate." },
      { name: "solveDrop", type: "(options?: DropOptions) => HopState", description: "A machine released from height at time 0 and left alone: apexes decay by the square of the restitution until the rebound cannot lift it clear, after which it sits at its static sag." },
      { name: "dropTimings", type: "(options?: DropOptions) => { bounces, settleTime, apexAt }", description: "How many contacts the sequence makes, when it is over, and when each apex falls — enough to loop a settling behaviour on." },
      { name: "springCoils", type: "(options?: SpringOptions) => SpringCoils", description: "A helix seen side-on, which is a sinusoid. Coil count and radius are invariant, and the length is clamped at the solid height and reported as bottomedOut." },
      { name: "squashRadii", type: "(radius: number, squeeze: number) => { rx, ry }", description: "An oblate spheroid at constant volume: rx² ry = r³." },
    ],
    notes: [
      "Units are mass 1 and gravity 1, so a hop unit is whatever the drawing decides one is, and a load of 1 is the machine's own weight. Static sag is 1 / stiffness.",
      "Contact ends when the spring force returns to zero, which is not half a period — gravity biases the oscillation, and the closed form is (2/ω)(π − atan(vω/g)). That is the number a duty-factor knob would have got wrong.",
      "No damping inside the stance, no horizontal travel, no friction, no spin-up from contact, no material and no actuator. The loss is taken at take-off as a restitution coefficient, which is how a bounce is actually measured.",
    ],
  },
  {
    slug: "gabled-house", item: "gabled-house", title: "Gabled house", group: "Machines",
    summary: "A dwelling drawn as a machine: the ridge is the pitch you pass it, the garage door's rigid panels ride one track, and the fins and the array turn to face a sun that is just the time of day.",
    files: ["components/ui/gabled-house.tsx"],
    usage: `import { GabledHouse } from "@/components/ui/gabled-house"

<GabledHouse behavior="arrive" storeys={2} pitch={38} />

// Or drive the whole day yourself — everything else follows from it.
<GabledHouse sun={0.72} garage={0.6} view="iso" />
<GabledHouse interactive onSunChange={setSun} />`,
    props: [
      view("front", "house"),
      { name: "sun", type: "number", description: "Controlled time of day, 0 midnight to 1 midnight. Supplying it stops the loop." },
      { name: "behavior", type: '"day" | "arrive" | "static"', default: '"day"', description: "Run a day, or run the same day with the garage opening for the arrival home in the late afternoon." },
      { name: "storeys", type: "number", default: "2", description: "Storeys in the main body, rounded and clamped to 1–3. The eaves, the windows and the ridge all follow." },
      { name: "pitch", type: "number", default: "38", description: "Roof pitch in degrees, clamped to 10–55. The ridge height is a consequence of it, not a second number." },
      { name: "garage", type: "number", description: "Controlled sectional door travel, 0 shut to 1 open. Omit it and the behaviour decides." },
      { name: "panels", type: "number", default: "4", description: "Panels in the garage curtain, 2–6. Every one keeps its height at every travel." },
      { name: "array", type: "boolean", default: "true", description: "The tracking array on its mast in the garden." },
      { name: "showSun", type: "boolean", default: "true", description: "Draw the sun on its arc. It is the input, so it is worth drawing." },
      { name: "speed", type: "number", default: "0.08", description: "Days per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to run the day by hand — the frame's width is one day — or arrow-key it." },
      { name: "onSunChange", type: "(sun: number) => void", description: "Time of day throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the cast shadow, which leans away from the sun and lengthens as it drops." },
      { name: "label", type: "string", description: "Caption under the drawing." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The garage door is the mechanism worth the file: rigid panels placed by arc length along a track that runs up the opening, round a quarter bend and back under the head. A panel straddling the bend is the chord between its two rollers, which is what a real one is, and no panel stretches at any travel.",
      "The fins and the array are the same solver at different stops. Both turn to face the sun and both report when they have run out of travel — the array is drawn at its stop rather than pointed at a sun it cannot reach.",
      "The sun is a direction in the world, not a sprite on the page, so it moves correctly from all four cameras and the shadow it casts is the house's own footprint displaced by it.",
      "Brick, glazing and planting are drawing. Nothing computes a heat flow, a daylight factor, a wind load or a real solar position for a real latitude: the arc is symmetric about noon, and the lit windows are a threshold on the sun's altitude.",
      "A generic gabled dwelling. No maker, plan book, estate or address is reproduced here or in the demo.",
    ],
  },
  {
    slug: "tower-block", item: "tower-block", title: "Tower block", group: "Machines",
    summary: "A residential tower with the lift left visible: the car and the counterweight hang on one rope over one sheave, so the weight falls exactly as far as the car rises.",
    files: ["components/ui/tower-block.tsx"],
    usage: `import { TowerBlock } from "@/components/ui/tower-block"

<TowerBlock storeys={14} behavior="service" />

// Or take the car yourself; it reports the storey it is standing at.
<TowerBlock carriage={0.6} onFloorChange={setFloor} />
<TowerBlock interactive cutaway storeys={20} occupancy={0.8} />`,
    props: [
      view("front", "tower"),
      { name: "carriage", type: "number", description: "Controlled lift position, 0 at the bottom stop to 1 at the top. Supplying it stops the loop." },
      { name: "behavior", type: '"service" | "night" | "static"', default: '"service"', description: "Run the car up the building and back with a dwell at each end, or park it at the ground between two late calls while the building empties." },
      { name: "storeys", type: "number", default: "12", description: "Storeys above the podium, rounded and clamped to 4–24. It is the height, the facade grid and the lift's travel at once." },
      { name: "occupancy", type: "number", default: "0.55", description: "How much of the building is in, 0 to 1. It scales a fixed pattern of lit windows — it does not model anybody." },
      { name: "cutaway", type: "boolean", default: "true", description: "Cut the shaft open so the car, the ropes, the sheave and the counterweight are visible." },
      { name: "crown", type: '"mast" | "plant" | "none"', default: '"mast"', description: "What sits on the roof: a plant deck, or a plant deck with a mast and its aviation lamp." },
      { name: "speed", type: "number", default: "0.16", description: "Round trips of the car per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to take the car, or arrow-key it a storey at a time." },
      { name: "onCarriageChange", type: "(carriage: number) => void", description: "Car position throughout a drag or a key press." },
      { name: "onFloorChange", type: "(floor: number) => void", description: "The storey the car is standing at, 0-based, whenever it changes — not every pixel it passes." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow beneath the podium." },
      { name: "label", type: "string", description: "Caption under the drawing." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The rope cannot stretch, so the counterweight mirrors the car about mid travel and `hoistPose` reports the total rope length — equal at every position, which is the invariant its test checks rather than believes.",
      "The storey count is the only structural axis: the height, the facade grid, the landing doors and the travel all come off it, so a four-storey block and a twenty-four-storey one are the same machine.",
      "The lit windows are a fixed deterministic pattern scaled by occupancy. The same flat lights at the same occupancy every render — there is no dispatching, no call queue, no traffic and no people.",
      "The aviation lamp is the one thing here on a clock of its own, and it is a lamp rather than a light model.",
      "A generic residential tower. No building, architect, city or address is reproduced here or in the demo.",
    ],
  },
  {
    slug: "espresso-machine", item: "espresso-machine", title: "Espresso machine", group: "Machines",
    summary: "A spring-lever group drawn as the linkage it is: lever, connecting rod, piston. The declining shot pressure is the spring paying its force back, not a curve somebody drew.",
    files: ["components/ui/espresso-machine.tsx"],
    usage: `import { EspressoMachine } from "@/components/ui/espresso-machine"

<EspressoMachine behavior="pull" cups={2} />

// Or scrub the shot and read the gauge off it.
<EspressoMachine shot={0.45} onPressureChange={setBar} />
<EspressoMachine interactive cutaway />`,
    props: [
      view("front", "machine"),
      { name: "shot", type: "number", description: "Controlled progress through one pull, 0 to 1: a fast charge, then the long extraction. Supplying it stops the loop." },
      { name: "behavior", type: '"pull" | "steam" | "idle" | "static"', default: '"pull"', description: "Pull one shot per cycle, steam with the wand, or stand idle with the lever up." },
      { name: "cups", type: "1 | 2", default: "1", description: "Cups under the spout. Two is one basket split, which is what a double is." },
      { name: "wand", type: "number", default: "18", description: "Steam wand angle in degrees from vertical, clamped to ±40." },
      { name: "cutaway", type: "boolean", default: "true", description: "Cut the group open so the piston, the spring, the rod and the water under the piston are visible." },
      { name: "speed", type: "number", default: "0.22", description: "Shots per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag down the frame to pull the lever through a shot, or arrow-key it." },
      { name: "onShotChange", type: "(shot: number) => void", description: "Progress through the pull throughout a drag or a key press." },
      { name: "onPressureChange", type: "(bar: number) => void", description: "Group pressure in bar, to a tenth, whenever it changes." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow under the machine." },
      { name: "label", type: "string", description: "Caption under the drawing." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The lever is a crank, the link is a connecting rod and the piston is the slider, so the piston position comes from `solveSliderCrank` — the same closed-loop solver the mud pump runs on. Pulling the lever down raises the piston and compresses the spring; letting it go is the shot.",
      "Pressure is the spring's force over the piston area and nothing else, which is why the gauge falls through the extraction. A lever machine's declining profile is a property of springs, not a shape anyone chose.",
      "Flow is Darcy's law through the puck, with a threshold below which nothing comes through at all, and what is in the cup is that flow integrated over the part of the shot that has happened — sampled rather than accumulated, so the same `shot` always gives the same cup.",
      "One number is the whole state, which is what lets the stream run because the piston is descending rather than because a timer said so.",
      "No temperature, no crema, no dose, no grind, no acoustics. The steam plume, the sight glass and the meniscus are drawing.",
      "A generic lever machine. No manufacturer, model, badge or café is reproduced here or in the demo.",
    ],
  },
  {
    slug: "refrigerator", item: "refrigerator", title: "Refrigerator", group: "Machines",
    summary: "A cabinet whose doors are solved leaves on vertical hinges, with an interior that is a second drawing revealed by the swing and a lamp thrown by a real door switch.",
    files: ["components/ui/refrigerator.tsx"],
    usage: `import { Refrigerator } from "@/components/ui/refrigerator"

<Refrigerator behavior="service" layout="top-freezer" />

// Or open it yourself, either compartment.
<Refrigerator door={0.7} freezer={0} view="iso" />
<Refrigerator interactive layout="side-by-side" onDoorChange={setDoor} />`,
    props: [
      view("front", "cabinet"),
      { name: "door", type: "number", description: "Controlled fresh-food door, 0 shut to 1 at its 110° stop. Supplying it stops the loop." },
      { name: "freezer", type: "number", description: "Controlled freezer door, independent of the fresh one." },
      { name: "behavior", type: '"service" | "idle" | "static"', default: '"service"', description: "Open the fresh door, stand open, shut it, then do the same for the freezer — never both at once. Idle keeps it shut and cycles the compressor." },
      { name: "layout", type: '"top-freezer" | "side-by-side" | "single"', default: '"top-freezer"', description: "Which leaves the cabinet has, how wide each is and where it is hinged." },
      { name: "shelves", type: "number", default: "3", description: "Shelves in the fresh compartment, 2–5, spaced across whatever height that compartment has." },
      { name: "showPlant", type: "boolean", default: "true", description: "Draw the condenser coil and the compressor at the back." },
      { name: "speed", type: "number", default: "0.18", description: "Service cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to swing the fresh door, or arrow-key it." },
      { name: "onDoorChange", type: "(door: number) => void", description: "Fresh door opening throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow under the cabinet." },
      { name: "label", type: "string", description: "Caption under the drawing." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "A leaf is a flat panel at an attitude: `swingPose` puts its free edge on a circle about the hinge so the door keeps its width at every angle, and `panelTransform` carries the handle and the display on the leaf, foreshortening as it opens and disappearing when it is edge-on.",
      "The door is a slab, not a sheet — the same face again along its own normal — which is what gives it an edge from any camera but square on.",
      "The lamp is a real door switch: it makes at a stated opening, so the inside lights when the seal breaks. The interior is only drawn once a door is open far enough to see past the leaf, which is also why it costs nothing when the cabinet is shut.",
      "No thermodynamics. The compressor's duty cycle is a pattern on the clock, the display is a label, and nothing computes a heat load, a defrost or a door-open penalty.",
      "A generic two-door cabinet. No manufacturer, model, badge or livery is reproduced here or in the demo.",
    ],
  },
  {
    slug: "washing-machine", item: "washing-machine", title: "Washing machine", group: "Machines",
    summary: "One drum, and one dimensionless number deciding what it is doing: below a Froude number of one the load is thrown, at or above it the load is pinned to the wall.",
    files: ["components/ui/washing-machine.tsx"],
    usage: `import { WashingMachine } from "@/components/ui/washing-machine"

<WashingMachine behavior="cycle" load={6} />

// Or take the drum by hand and run it up through resonance.
<WashingMachine rpm={320} onRpmChange={setRpm} interactive />
<WashingMachine loading="top" door={0.8} view="iso" />`,
    props: [
      view("front", "machine"),
      { name: "rpm", type: "number", description: "Controlled drum speed, 0–1600. Supplying it stops the loop." },
      { name: "behavior", type: '"cycle" | "spin" | "dry" | "static"', default: '"cycle"', description: "A whole programme — tumbling wash, pause, then the spin ramping through the critical speed — or that ramp on its own, or a dry tumble with no water." },
      { name: "loading", type: '"front" | "top"', default: '"front"', description: "A horizontal axis with a glass door, or a vertical axis under a hinged lid with an agitator." },
      { name: "load", type: "number", default: "5", description: "Items in the drum, 0–10. Front loading only: they are solved, so they are only drawn where the solve holds." },
      { name: "water", type: "number", description: "Water in the drum, 0 to 1. Forced to nothing above 300 rpm, because the pump runs before a spin." },
      { name: "door", type: "number", default: "0", description: "Door or lid opening, 0 shut to 1 at its stop." },
      { name: "programme", type: "number", default: "2", description: "Position on the eight-place dial, which indexes in 30° detents." },
      { name: "speed", type: "number", default: "0.14", description: "Programmes per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to take the drum through the whole speed range — the interesting part is the critical speed on the way up — or arrow-key it." },
      { name: "onRpmChange", type: "(rpm: number) => void", description: "Drum speed throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow under the case." },
      { name: "label", type: "string", description: "Caption under the drawing." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "A body on the drum wall leaves it where gravity can no longer supply the centripetal force: cos α = ω²r/g. Below a Froude number of one there is a release angle and the load falls on a ballistic arc that really does rejoin the drum; at or above one there is none and the load is pinned. Wash and spin are the same solver either side of one number.",
      "The tub is hung on springs, so it answers an out-of-balance load the way a rotor on a flexible mount does — quiet below its critical speed, violent at it, and calm again above it. It is the only machine in the set that is worse at one input than at a larger one, and the case is cut away so you can see the suspension answer.",
      "A top-loading machine has a vertical axis, where gravity never lifts the load at all: the agitator moves it and the tumble release does not apply, so the solved load is not drawn there. The mouth is only drawn for a camera that can see down it.",
      "One approximation, stated: the drum's angle is the clock times its speed rather than the integral of it, so changing the speed changes the rate from that moment rather than replaying history. Water, suds, heat and the wash itself are drawing.",
      "A generic domestic washer. No manufacturer, model, programme names or badge is reproduced here or in the demo.",
    ],
  },
  {
    slug: "household-geometry", item: "household-geometry", title: "Household geometry", group: "Foundations",
    summary: "The closures in the building you live in and the machines inside it: hinged leaves, sectional panels, a tumbling drum, a resonant suspension, a roped hoist, tracking slats, and flow through a packed bed.",
    files: ["lib/robocn/household.ts"],
    usage: `import { swingPose, sectionalPanels, tumblePose, suspensionPose, hoistPose } from "@/lib/robocn/household"

swingPose(0.5, { width: 80, maxAngle: 110 })     // the free edge stays 80 from the hinge
sectionalPanels(0.4, { panels: 4, opening: 28 }) // every panel still 7 long

tumblePose(48, { radius: 0.25 }).regime           // "cataracting"
tumblePose(1200, { radius: 0.25 }).release        // null — it never leaves the wall
suspensionPose(320, { critical: 320 }).resonant   // true
hoistPose(0.8, { travel: 180, sheave: 220 }).length // the same at every position`,
    api: [
      { name: "swingPose", type: "(open, options) => SwingPose", description: "A leaf hinged on a vertical edge. The free edge lies on a circle about the hinge, so it keeps its width at every angle, and `facing` is how much of it a front camera still sees." },
      { name: "sectionalPanels", type: "(travel, options) => SectionalPanel[]", description: "Rigid panels on a track that runs up an opening, round a quarter bend and back under the head. Placed by arc length, with each panel the chord between its two rollers, so no panel stretches at any travel." },
      { name: "sectionalTrack", type: "(options, steps?) => Vec2[]", description: "The track itself, as a polyline: what the rollers actually run in." },
      { name: "tumblePose", type: "(rpm, options?) => TumblePose", description: "What a drum at this speed does to what is in it: the Froude number, the release angle where gravity can no longer hold the load to the wall, and the regime either side of one." },
      { name: "tumbleCycle", type: "(rpm, options?) => TumbleCycle | null", description: "One item's trip: up the wall to release, through the air, and back onto the wall. The landing is the root of the quadratic that puts the projectile back on the drum circle. Null when the drum is stopped or centrifuging." },
      { name: "tumbleItems", type: "(clock, rpm, count, options?) => TumbleItem[]", description: "Where the load is at a moment, spread evenly round that one cycle." },
      { name: "suspensionPose", type: "(speed, options?) => SuspensionPose", description: "A tub hung on springs with an out-of-balance load: the textbook rotor response, small below the critical speed, large at it, and settling to the imbalance itself above it." },
      { name: "hoistPose", type: "(position, options) => HoistPose", description: "A car roped to a counterweight over one sheave. The weight falls exactly as far as the car rises, and the total rope length is reported so that can be checked." },
      { name: "slatPose", type: "(sun, options?) => SlatPose", description: "Blades that turn to face the sun over one day, the shade that follows from how far they turned, and a `clamped` flag when they wanted to turn further than their stops allow." },
      { name: "extractionFlow", type: "(pressure, options?) => number", description: "Darcy's law through a packed bed, and nothing at all below the threshold rather than a negative trickle." },
      { name: "springPressure", type: "(compression, options?) => number", description: "The pressure a compressed spring puts behind a piston — the whole of a lever machine's declining shot." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no dependencies, and no thermodynamics: nothing here computes a heat flow, a pressure drop in a pipe, a wind load, a temperature or an occupancy.",
      "The tumble is the piece that earns the file. One dimensionless number decides the whole regime, which is why a washing machine's wash and its spin are the same solver rather than two animations, and why `tumbleCycle` returns null rather than a fiction when there is no release.",
      "Every closure here is checked against the thing a drawing would get wrong: a leaf that keeps its width, a panel that keeps its length round a bend, a rope that keeps its length, a projectile that rejoins the drum, and a tracker that says when it has run out of travel.",
    ],
  },
  {
    slug: "rail-geometry", item: "rail-geometry", title: "Rail geometry", group: "Foundations",
    summary: "What a track does to the vehicle standing on it: bogies placed on a curve and the centre and end throw that follow, Klingel hunting on a coned wheelset, a pantograph solved to a working height, and a turnout's lead, crossing angle and blade throw.",
    files: ["lib/robocn/rail.ts"],
    usage: `import { bogieRide, curveRadius, huntingPose, klingelWavelength, turnoutGeometry } from "@/lib/robocn/rail"

const ride = bogieRide(curveRadius(10, 88), { pivotSpacing: 88, halfLength: 66 })
ride.centreThrow   // the body's middle, inside the curve
ride.endThrow      // its ends, outside it — and always further

klingelWavelength({ wheelRadius: 19, halfGauge: 33, conicity: 0.1 })
turnoutGeometry(8, 20).crossingAngle   // atan(1/8) in degrees`,
    api: [
      { name: "curveRadius", type: "(turn: number, chord: number) => number", description: "The radius of a curve that turns through `turn` degrees under a chord — how a curve is quoted here, because the angle a vehicle's own bogie spacing subtends is the thing you can see. Zero is straight and returns Infinity." },
      { name: "bogieRide", type: "(radius, geometry: BogieGeometry) => BogieRide", description: "A rigid body on two bogies, placed on a curve. The pivots are on the track and the body is the chord between them, so the yaw of each bogie, the centre throw `R(1 − cos θ)` and the end throw `√(R²cos²θ + L²) − R` all fall out with no approximation." },
      { name: "bodyOffset", type: "(x, radius, pivotSpacing) => number", description: "Where any point along the body sits across the track, positive outward. Negative between the pivots, zero at them, positive beyond — which is what makes the centre and end throw two readings of one relation." },
      { name: "klingelWavelength", type: "(geometry: WheelsetGeometry) => number", description: "λ = 2π√(b r₀ / γ): the distance a coned wheelset takes to weave one full cycle. The one length in railway engineering with nothing to do with speed. A cylindrical tread returns Infinity." },
      { name: "huntingPose", type: "(distance, amplitude, geometry) => HuntingPose", description: "Where a hunting wheelset stands after running `distance`: `y = A cos(2πs/λ)`, and the yaw is its own slope, so the two run a quarter cycle apart. The flange is a hard clamp, and `flanging` says when it is on." },
      { name: "radialYaw", type: "(offset, radius) => number", description: "The angle a wheelset takes up if it steers radially — square to the radius at its own position along the bogie." },
      { name: "pantographPose", type: "(height, geometry: PantographGeometry) => PantographPose", description: "A single-arm collector solved to a working height. Height spends reach, so the knee folds in as the pan rises; past full extension the height clamps and `reachable` goes false. The head's attitude is the output of a second, closed loop — the control rod — not a value pinned to horizontal." },
      { name: "turnoutGeometry", type: "(turnoutNumber, gauge) => TurnoutGeometry", description: "The crossing angle is `atan(1/N)`; the crossing is where the inner rails meet, at `cos α = (R − g)/(R + g)`, which fixes the radius and the lead. The offset at the crossing comes out as very nearly one gauge whatever the number, and the lead grows about as N²." },
      { name: "turnoutPoint", type: "(distance, geometry) => Vec2", description: "A point on the diverging route, measured along the straight from the toe. Tangent to the straight at the toe, so it leaves with no kink, and straight on at the crossing angle past the crossing." },
      { name: "bladePose", type: "(position, throwDistance, tolerance?) => BladePose", description: "Two switch blades on one throw bar: the gaps always sum to the throw. The route is detection — a tolerance on the closed blade — so a turnout caught in mid stroke reports `\"unset\"` rather than a route nobody has." },
      { name: "trackCurvature / wireStagger", type: "(distance, amplitude?) => number / (distance, amplitude?, span?) => number", description: "Illustrative. A stretch of line that winds without repeating over a short run, and the triangular zig-zag a contact wire is strung with. Neither is surveyed or solved." },
    ],
    notes: [
      "Everything here is exact geometry except `trackCurvature` and `wireStagger`, which are stated shapes and say so. No dynamics: nothing knows about mass, speed, force, adhesion, damping or wear.",
      "Positive is to starboard everywhere — clockwise seen from above — the same sense as every heading in the set.",
      "The family this is under: `docs/rail-machines.md`. Its thesis is that every other vehicle in robocn is *steered* and a rail vehicle is not, so the track is the input and the pose is the answer.",
    ],
  },
  {
    slug: "rail-locomotive", item: "rail-locomotive", title: "Rail locomotive", group: "Robots",
    summary: "An electric locomotive and the train behind it, placed by the track rather than steered along it. Bend the track and each bogie takes the tangent under its own pivot, each body becomes the chord between two of them, and the sideways throw of the middle and the ends follows.",
    files: ["components/ui/rail-locomotive.tsx"],
    usage: `import { RailLocomotive } from "@/components/ui/rail-locomotive"

<RailLocomotive behavior="line" cars={1} />

// Plan is where the curve reads: the whole train bends along it.
<RailLocomotive view="plan" curve={9} cars={2} />
<RailLocomotive behavior="depot" showThrow />`,
    props: [
      view("profile", "train"),
      { name: "curve", type: "number", description: "Degrees the track turns through under one bogie-centre spacing, positive to starboard, clamped to ±10. Omit it and the behaviour runs the road." },
      { name: "onCurveChange", type: "(curve: number) => void", description: "The track being asked for, while a person is bending it." },
      { name: "behavior", type: '"line" | "yard" | "depot" | "static"', default: '"line"', description: "Winding through curves both ways, a crossover held hard over each way, or standing in the depot working its pantograph." },
      { name: "cars", type: "number", default: "1", description: "Trailing vehicles behind the locomotive, 0–4. Every one of them is placed on the curve at its own arc position." },
      { name: "pantograph", type: '"auto" | "raised" | "stowed"', default: '"auto"', description: "The roof collector. Auto leaves it to the behaviour, which is the only thing that ever lowers it." },
      { name: "speed", type: "number", default: "0.22", description: "Track cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the train to bend the track under it; arrow keys 1° at a time, Home straightens it." },
      { name: "showTrack", type: "boolean", default: "true", description: "The rails it is standing on, which curve with it." },
      { name: "showThrow", type: "boolean", description: "Call out the solved centre and end throw as dimension lines. Blueprint does by default." },
      { name: "active", type: "boolean", description: "Light the headlight. Omit and it lights under power." },
      { name: "label", type: "string", description: "Caption underneath the train." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the placement, from `bogieRide()`. Each bogie pivot is on the track and the body is the straight line between two of them, so the centre throw `R(1 − cos θ)` inward and the end throw outward are geometry rather than artwork — and both go to zero on straight track without a special case.",
      "The pantograph is the same linkage `pantograph-collector` ships standalone, and the bogies are the ones `rail-bogie` draws on its own.",
      "Illustrated: the track a `line` behaviour runs through is a stated shape, and there is no cant, no transition spiral, no traction and no braking. The train does not travel — the curve is a steady state, so straightening the track straightens the train with nothing to unwind.",
    ],
  },
  {
    slug: "rail-bogie", item: "rail-bogie", title: "Rail bogie", group: "Machines",
    summary: "A powered two-axle bogie, and the only self-excited motion in the set: nothing commands the wheelsets to wander, they wander because they are coned — at exactly Klingel's wavelength, until the flange stops them.",
    files: ["components/ui/rail-bogie.tsx"],
    usage: `import { RailBogie } from "@/components/ui/rail-bogie"

<RailBogie behavior="hunt" />

// Conicity is the whole mechanism. Take it away and the motion stops.
<RailBogie travel={9} conicity={0} />
<RailBogie behavior="brake" view="profile" />`,
    props: [
      view("plan", "bogie"),
      { name: "travel", type: "number", description: "Distance run, in wheel diameters, 0–40. Supplying it stops the loop." },
      { name: "onTravelChange", type: "(travel: number) => void", description: "The run, while a person is scrubbing it." },
      { name: "behavior", type: '"hunt" | "curve" | "brake" | "static"', default: '"hunt"', description: "Running and letting the cone work, standing radially on a curve, or running the shoes on until the weave dies away." },
      { name: "conicity", type: "number", default: "0.1", description: "Tread conicity — the tan of the cone angle, 0–0.4. The one control worth touching: zero is a cylindrical tread and the hunting stops dead." },
      { name: "amplitude", type: "number", default: "7", description: "How far the wheelset wanders, in world units. An input, because the kinematic solution does not set one; the flange clamps it." },
      { name: "brake", type: "number", description: "Shoes on the treads, 0 off to 1 hard on. Omit it and the behaviour works them." },
      { name: "speed", type: "number", default: "0.24", description: "Runs per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across the bogie to scrub the run; arrow keys half a wheel diameter at a time." },
      { name: "showTrack", type: "boolean", default: "true", description: "The rails and sleepers under it." },
      { name: "active", type: "boolean", description: "Light the traction motor and call out a wheelset that is flanging." },
      { name: "label", type: "string", description: "Caption underneath the bogie." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the hunting, from `klingelWavelength()` and `huntingPose()`. Displace a coned wheelset and the rolling radii differ, so it yaws; yaw it and it runs sideways. That loop is undamped and second order, so the lateral position and the yaw come out a quarter of a wavelength apart — the wheelset is running most steeply sideways exactly as it passes centre.",
      "The frame is not animated either. It joins two wheelsets that are a wheelbase apart on one wave, so it sits on their mean and points along the line between them, and the difference is what the primary suspension has to take.",
      "Illustrated: the suspension travel, the brake shoes and the traction motor. No speed, no creep forces, no damping and no critical speed — and the flange clearance is drawn generously, or a real one per cent of the gauge would be invisible.",
    ],
  },
  {
    slug: "pantograph-collector", item: "pantograph-collector", title: "Pantograph collector", group: "Machines",
    summary: "A single-arm roof current collector. Height and reach are not independent — asking for height folds the knee in and walks the pan back over its own base — and the head stays level because a control rod says so, not because it was pinned there.",
    files: ["components/ui/pantograph-collector.tsx"],
    usage: `import { PantographCollector } from "@/components/ui/pantograph-collector"

<PantographCollector behavior="raise" />

// Front is where the stagger reads: the contact walks across the strip.
<PantographCollector view="front" height={1} along={35} />
<PantographCollector interactive onHeightChange={setHeight} />`,
    props: [
      view("profile", "collector"),
      { name: "height", type: "number", description: "Working height, 0 stowed to 1 at the wire. Supplying it stops the loop." },
      { name: "onHeightChange", type: "(height: number) => void", description: "The height being asked for, while a person is working it." },
      { name: "behavior", type: '"raise" | "run" | "stow" | "static"', default: '"raise"', description: "Up, work under the wire, and down; up and holding; or down bar the one moment it is put up and brought straight back." },
      { name: "along", type: "number", description: "How far along the run it is, which is what walks the contact across the strip and slides the masts past. Omit it and the clock runs it." },
      { name: "speed", type: "number", default: "0.25", description: "Raise cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag up and down to work it; arrows 5%, shift 15%, Home stows and End is at the wire." },
      { name: "showWire", type: "boolean", default: "true", description: "The contact wire, its masts, and the stagger it is strung with." },
      { name: "showRoof", type: "boolean", default: "true", description: "The roof and insulators it stands on." },
      { name: "active", type: "boolean", description: "Light the strip. Omit and it lights on contact." },
      { name: "label", type: "string", description: "Caption underneath the collector." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the arms, from `pantographPose()`. The head rides the workspace of a two-link chain, so height is bought with reach and the pan travels back over the base as it rises; past full extension the height clamps rather than producing a broken pose, and the docs' `reachable` flag says so.",
      "The head's attitude is a second closed loop: a control rod runs from the lower arm to a lever on the head, and the head's angle is whatever assembles that loop at this height. It comes out flat at the height the levelling was set for and tips away from it at the ends of the travel — which is what a working range is.",
      "Illustrated: the stagger pattern, and the wire itself, which is a straight run rather than a catenary. No uplift, no contact force, no sag and no arcing.",
    ],
  },
  {
    slug: "rail-turnout", item: "rail-turnout", title: "Rail turnout", group: "Machines",
    summary: "The points, and the fact that a route is a state rather than a setting: two blades on one throw bar, and what decides where a train goes is detection — so a turnout caught in mid stroke has no route set at all.",
    files: ["components/ui/rail-turnout.tsx"],
    usage: `import { RailTurnout } from "@/components/ui/rail-turnout"

<RailTurnout behavior="route" />

// The number is the whole geometry, and it is drawn to scale.
<RailTurnout number={10} throwPosition={1} />
<RailTurnout hand="left" interactive onRouteChange={setRoute} />`,
    props: [
      view("plan", "turnout"),
      { name: "throwPosition", type: "number", description: "Blade position, 0 normal to 1 reverse. Supplying it stops the loop." },
      { name: "onThrowChange", type: "(position: number) => void", description: "The blades, while a person is working them." },
      { name: "onRouteChange", type: '(route: "normal" | "reverse" | "unset") => void', description: "Fires when detection makes or breaks — which is when the route really changes, rather than on every frame the blades move." },
      { name: "behavior", type: '"route" | "creep" | "static"', default: '"route"', description: "Set, dwell, throw, dwell; or working the blade around the point of detection, where a machine that cannot quite make its route spends its time." },
      { name: "number", type: "number", default: "5", description: "Turnout number: one across for N along, 3–12. Bigger is shallower, faster, and — because this is drawn to scale — visibly longer." },
      { name: "hand", type: '"left" | "right"', default: '"right"', description: "Which way the diverging route goes." },
      { name: "speed", type: "number", default: "0.28", description: "Point-machine cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Press and drag across it to work the blades; arrows 10%, shift 25%, Home normal and End reverse." },
      { name: "showSleepers", type: "boolean", default: "true", description: "The sleepers, which run out under the diverging route through the switch." },
      { name: "active", type: "boolean", description: "Light the route that is set and the detection lamp. Omit and it lights when detection is made." },
      { name: "label", type: "string", description: "Caption underneath the turnout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the geometry, from `turnoutGeometry()` and `bladePose()`. The number fixes the crossing angle at `atan(1/N)`; the crossing is where the inner rails actually meet, which fixes the radius and the lead; and the two blades share a rod, so the open gap is exactly the throw less the closed one.",
      "The route is detection, not a flag: `onRouteChange` fires when the closed blade comes inside its tolerance, and a turnout held in mid stroke reports `\"unset\"` and lights nothing. That is the state a signaller sees.",
      "Drawn to scale, which is why a bigger number comes out as a longer, flatter machine — a real turnout is a long shallow thing, and the frame is refitted per number rather than the geometry being squashed.",
      "Illustrated: rail sections, the check rails' own geometry and the point machine's internals. No locking, no interlocking, no forces, and nothing runs over it.",
    ],
  },
  {
    slug: "gridiron-geometry", item: "gridiron-geometry", title: "Gridiron geometry", group: "Foundations",
    summary: "The football family's dependency-free maths: the ball as a real prolate spheroid, drag-free ballistics, counter-rotating wheel exit conditions, a route tree sampled by arc length, a sprung pad arm at equilibrium, and the column pitch a hand on the turf implies.",
    files: ["lib/robocn/gridiron.ts"],
    usage: `import { ballSilhouette, kickFlight, launcherExit, sampleRoute } from "@/lib/robocn/gridiron"

// The outline of an ellipsoid is a central section, not its equator.
ballSilhouette(ballFrame({ pitch: 8, roll: 120 }), defaultBall, viewDir)

kickFlight({ speed: 26, angle: 44 })      // { range, apex, hangTime, at, path }
launcherExit({ top: 48, bottom: 16 })     // { speed, spin, bias }
sampleRoute(routePath("post", { depth: 12 }), 13.4)  // { point, heading, turn }`,
    api: [
      { name: "ballFrame", type: "(attitude?) => BallFrame", description: "The ball's own axes in world space from a yaw, a pitch and a roll. At rest the nose points downfield and the laces face up." },
      { name: "ballSilhouette", type: "(frame, shape, viewDir, steps?) => Vec3[]", description: "The outline, exactly: the great circle whose pole is M⁻¹Rᵀd, pushed back out through R M. End-on it degenerates to a circle of the waist radius, and nothing special-cases it." },
      { name: "ballSeam / ballLaces / ballStripes", type: "(frame, shape, viewDir, …) => marks", description: "Surface marks, each carrying the sign of its own normal against the view, so what is on the far side is not drawn on the near one." },
      { name: "flightAttitude", type: "(flight, t, options?) => BallAttitude", description: "Spiral, wobble, tumble and snap as one mechanism: the nose walks a cone at a third of the roll rate, and the cone opens as the spin comes down." },
      { name: "kickFlight", type: "(options?) => KickFlight", description: "A drag-free parabola. The hang time, range, apex and impact angle are read off the one curve rather than typed in." },
      { name: "launcherExit", type: "(options?) => LauncherExit", description: "Exit speed is the mean of the two wheel surface speeds; spin is their difference over the ball's own diameter." },
      { name: "routePath / sampleRoute", type: "(route, options?) => Vec2[] / (path, distance) => RouteSample", description: "Eleven routes in yards, and the runner at an arc length along one: position, heading, and how hard it is turning at the nearest break." },
      { name: "playerSpine / playerUpperBody", type: "(options) => Vec3[] / UpperBody", description: "Equal segments at a constant curvature whose chord is the pitch asked for, plus the head's own axes so a helmet lays onto it as a solid." },
      { name: "stancePitch", type: "(options) => number", description: "The column pitch that puts the shoulder exactly one arm's length from a hand already on the turf. Bisection on the same column the drawing uses." },
      { name: "sledDeflection / sledSlide", type: "(load, options?) => number / (drive, options?) => SledSlide", description: "Static equilibrium of a pivoted pad arm against its return spring, and the friction threshold a frame will not move below." },
      { name: "helmetOutline / facemaskBars / shoulderYoke / padOutline", type: "(…) => Vec2[]", description: "The kit all four players wear. Illustration, shared so they match — nothing here is load-bearing." },
    ],
    notes: [
      "No React, no three.js, no dependencies beyond the kinematics and skeleton cores, and nothing is mutated.",
      "Every trajectory is drag-free. That is an exact parabola of a ball that does not exist: a real punt goes a good deal less far, and the hang time is optimistic.",
      "The wheel launcher assumes no slip at either contact. A real one loses some of the surface speed to the ball skidding through the gap.",
      "There is no contact, no defender, no rule and no clock anywhere in it.",
    ],
  },
  {
    slug: "robot-football", item: "robot-football", title: "Robot football", group: "Robots",
    summary: "The ball, modelled rather than drawn: a prolate spheroid whose outline is its own central section, with laces on the surface that go round the back when it spins.",
    files: ["components/ui/robot-football.tsx"],
    usage: `import { RobotFootball } from "@/components/ui/robot-football"

<RobotFootball behavior="spiral" />

// Controlled, or a ball you can turn in your hand.
<RobotFootball view="front" yaw={90} pitch={12} roll={140} />
<RobotFootball interactive onAttitudeChange={setAttitude} />`,
    props: [
      view("profile", "ball"),
      { name: "roll", type: "number", description: "Controlled roll about the long axis, in degrees. Any of the three attitude props stops the loop." },
      { name: "pitch", type: "number", description: "Controlled nose attitude in degrees, positive nose up." },
      { name: "yaw", type: "number", description: "Controlled nose bearing in degrees, positive turning right." },
      { name: "behavior", type: '"spiral" | "wobble" | "tumble" | "snap" | "hold" | "static"', default: '"spiral"', description: "A spiral and a wobble are the same mechanism with different numbers; a tumble takes the roll off and pitches it end over end." },
      { name: "spin", type: "number", default: "6", description: "Turns about the long axis per cycle." },
      { name: "wobble", type: "number", description: "Half-angle of the precession cone in degrees. Omit and the flight picks one." },
      { name: "laces", type: "boolean", default: "true", description: "Draw the stitches. They are on the surface, so they are only drawn where the camera can see them." },
      { name: "stripes", type: "boolean", default: "true", description: "Draw the two bands near the ends." },
      { name: "speed", type: "number", default: "0.5", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to roll it, up and down to pitch it." },
      { name: "onAttitudeChange", type: "(attitude: { yaw, pitch, roll }) => void", description: "The attitude throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow, which fades as a snap lifts the ball." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The silhouette is the ellipsoid's own central section, not its equator, so it is exact from any angle: end-on it is a circle of the waist radius and broadside it reaches the full length, and nothing special-cases either.",
      "Laces, seam and bands each carry the sign of their own normal against the view. Spinning the ball takes them round the back and brings them out the other side rather than sliding them across the front.",
      "No air. The ball spins and precesses at whatever it is given and never decays.",
    ],
  },
  {
    slug: "gridiron-lineman", item: "gridiron-lineman", title: "Gridiron lineman", group: "Robots",
    summary: "The three-point stance as a four-contact stance: the hand on the turf carries load, and the flat back is the column pitch that being down there implies.",
    files: ["components/ui/gridiron-lineman.tsx"],
    usage: `import { GridironLineman } from "@/components/ui/gridiron-lineman"

<GridironLineman behavior="snap" number="74" />

// Controlled, or a snap you can work by hand.
<GridironLineman stance="two-point" fire={0.6} padLevel={0.9} />
<GridironLineman interactive onFireChange={setFire} />`,
    props: [
      view("profile", "machine"),
      { name: "fire", type: "number", description: "Controlled: 0 down in the stance, 1 at full extension. Supplying it stops the loop." },
      { name: "behavior", type: '"snap" | "drive" | "pull" | "set" | "static"', default: '"snap"', description: "What it does when fire is not supplied. A snap is the whole sequence; drive and pull hold its middle open." },
      { name: "stance", type: '"three-point" | "two-point" | "set" | "upright"', default: '"three-point"', description: "Only the three-point stance puts a hand down, and only that one carries load on it." },
      { name: "padLevel", type: "number", default: "0.5", description: "How low it plays, 0 to 1: a deeper crouch and more lean off one number." },
      { name: "mask", type: '"cage" | "bar" | "shield"', default: '"cage"', description: "Facemask style. Bars only — no livery, no markings." },
      { name: "number", type: "string", default: '""', description: "Two characters on the chest plate. Your string; nobody real's." },
      { name: "speed", type: "number", default: "0.4", description: "Cycles per second." },
      ...gaitLoop(),
      { name: "offset", type: "number", default: "0", description: "Seconds of offset, so a line of them does not fire together." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to work the snap by hand; arrow keys step it." },
      { name: "onFireChange", type: "(fire: number) => void", description: "How far out of the stance, throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Solved: the legs, feet and pelvis are solveSkeleton from skeleton-kinematics — the same solver robot-skeleton ships. The arms come out of the gait's swing and are solved to their own targets, because in this stance they are doing two different jobs.",
      "The flat back is not typed in. stancePitch bisects for the column pitch that leaves the shoulder exactly one arm's length from the hand on the turf, on the same column the drawing uses.",
      "The feet are staggered by freezing the walk solver at a cycle fraction where one foot has just landed and the other is still on its toe — a real sample of the gait rather than a second pose table.",
      "Illustrated: the helmet, facemask, shoulder yoke and pads. Nothing about them is load-bearing, and none of it is a team, a livery or a person.",
      "No contact, no opponent and no ground reaction. The hand load is a share the stance declares, not a force anything computed.",
    ],
  },
  {
    slug: "gridiron-quarterback", item: "gridiron-quarterback", title: "Gridiron quarterback", group: "Robots",
    summary: "A drop-back and a throw with the arm solved to a release point travelling an arc, and a ball that leaves on the velocity the hand had.",
    files: ["components/ui/gridiron-quarterback.tsx"],
    usage: `import { GridironQuarterback } from "@/components/ui/gridiron-quarterback"

<GridironQuarterback behavior="throw" steps={7} number="09" />

// Controlled, or a throw you can work by hand.
<GridironQuarterback release={0.55} velocity={31} />
<GridironQuarterback interactive onReleaseChange={setRelease} />`,
    props: [
      view("profile", "machine"),
      { name: "release", type: "number", description: "Controlled swing: 0 cocked, 1 through the follow-through. Supplying it stops the loop." },
      { name: "behavior", type: '"drop" | "throw" | "scramble" | "set" | "static"', default: '"throw"', description: "What it does when release is not supplied." },
      { name: "steps", type: "number", default: "5", description: "Steps of the drop-back, which is how far into the pocket it goes." },
      { name: "velocity", type: "number", default: "27", description: "Release speed in yards per second. A hard pass is about 27." },
      { name: "mask", type: '"cage" | "bar" | "shield"', default: '"cage"', description: "Facemask style." },
      { name: "number", type: "string", default: '""', description: "Two characters on the chest plate." },
      { name: "showBall", type: "boolean", default: "true", description: "Draw the ball in the hand and on its way out of the frame." },
      { name: "speed", type: "number", default: "0.4", description: "Cycles per second." },
      ...gaitLoop(),
      { name: "offset", type: "number", default: "0", description: "Seconds of offset." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to work the throw by hand." },
      { name: "onReleaseChange", type: "(release: number) => void", description: "How far through the swing, throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow and the line the machine set up on." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The elbow is never placed. The hand travels an arc through three points — cocked, released, followed through — and solveElbow3 makes of it what it can.",
      "The release angle is the direction of the last part of the swing, sampled just before the ball leaves, so changing the arc changes the trajectory rather than only the picture.",
      "The rest of the flight is not drawn. The machine is about two yards tall and the pass goes twenty, so the ball leaves on the real parabola and exits the frame; the range and hang time on the readout are the whole flight.",
      "That parabola is drag-free, which flatters the throw.",
    ],
  },
  {
    slug: "gridiron-receiver", item: "gridiron-receiver", title: "Gridiron receiver", group: "Robots",
    summary: "The route tree as geometry: the runner is a point at an arc length along a polyline, and the lean into a cut is the exterior angle at the break.",
    files: ["components/ui/gridiron-receiver.tsx"],
    usage: `import { GridironReceiver } from "@/components/ui/gridiron-receiver"

<GridironReceiver route="post" depth={12} behavior="route" />

// Controlled: put it anywhere along the route, in yards.
<GridironReceiver route="corner" side={-1} distance={13.4} />
<GridironReceiver behavior="catch" number="88" />`,
    props: [
      view("profile", "machine"),
      { name: "route", type: '"go" | "hitch" | "slant" | "flat" | "out" | "in" | "curl" | "comeback" | "post" | "corner" | "wheel"', default: '"post"', description: "Which route. Outside breaks are positive x and inside breaks negative, so the whole tree mirrors on one sign." },
      { name: "depth", type: "number", default: "12", description: "How deep the break is, in yards." },
      { name: "side", type: "number", default: "1", description: "1 aligned right; -1 mirrors the whole route." },
      { name: "distance", type: "number", description: "Controlled yards run along the route. Supplying it stops the loop." },
      { name: "behavior", type: '"route" | "release" | "catch" | "idle" | "static"', default: '"route"', description: "What it does when distance is not supplied. Release is the first couple of yards worked back and forth." },
      { name: "mask", type: '"cage" | "bar" | "shield"', default: '"cage"', description: "Facemask style." },
      { name: "number", type: "string", default: '""', description: "Two characters on the chest plate." },
      { name: "showRoute", type: "boolean", default: "true", description: "Draw the route map beside the machine. It is a map at field scale, and the panel says so." },
      { name: "speed", type: "number", default: "0.28", description: "Cycles per second." },
      ...gaitLoop(),
      { name: "offset", type: "number", default: "0", description: "Seconds of offset." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to run the route by hand." },
      { name: "onDistanceChange", type: "(yards: number) => void", description: "Yards along the route, throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow, which fades in the flight phase of a run." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Nobody typed a lean. sampleRoute returns the turn being taken at the nearest corner, faded in over a couple of yards either side of it, and that number is the bank, the shoulder twist and the head turn.",
      "The gait phase comes off the distance run rather than a second clock, so the stride cannot drift away from the ground the machine is covering.",
      "Two scales on purpose: the machine at machine scale and the route beside it at field scale, because a twelve-yard route is six machine-heights long and one scale would lose one of them.",
      "No defenders, no coverage, no separation. The ball only appears when catch puts one in the hands.",
    ],
  },
  {
    slug: "gridiron-kicker", item: "gridiron-kicker", title: "Gridiron kicker", group: "Robots",
    summary: "A swing leg solved to an ankle path that passes through the ball, and a drag-free parabola that starts where the strike happened. Whether it is good is read off the plot.",
    files: ["components/ui/gridiron-kicker.tsx"],
    usage: `import { GridironKicker } from "@/components/ui/gridiron-kicker"

<GridironKicker kick="place" distance={38} />

// Controlled, or a punt with its own hang time.
<GridironKicker kick="punt" swing={0.5} power={1} />
<GridironKicker interactive onSwingChange={setSwing} />`,
    props: [
      view("profile", "machine"),
      { name: "swing", type: "number", description: "Controlled: 0 cocked, 0.5 at contact, 1 through the follow-through. Supplying it stops the loop." },
      { name: "behavior", type: '"kick" | "approach" | "set" | "static"', default: '"kick"', description: "What it does when swing is not supplied." },
      { name: "kick", type: '"place" | "punt" | "kickoff"', default: '"place"', description: "A punt is struck from the hands and much higher, which is a different trajectory rather than a different number." },
      { name: "power", type: "number", default: "0.85", description: "How hard, 0 to 1. Scales the launch speed the kick style starts from." },
      { name: "angle", type: "number", description: "Launch angle in degrees. Omit and the kick style picks one." },
      { name: "distance", type: "number", default: "35", description: "Distance to the uprights, in yards. The bar is at ten feet, and clearing it is computed." },
      { name: "mask", type: '"cage" | "bar" | "shield"', default: '"bar"', description: "Facemask style." },
      { name: "number", type: "string", default: '""', description: "Two characters on the chest plate." },
      { name: "showPlot", type: "boolean", default: "true", description: "Draw the flight plot above the machine. It is at field scale, and the panel says how many yards it spans." },
      { name: "speed", type: "number", default: "0.4", description: "Cycles per second." },
      ...gaitLoop(),
      { name: "offset", type: "number", default: "0", description: "Seconds of offset." },
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to work the swing by hand." },
      { name: "onSwingChange", type: "(swing: number) => void", description: "How far through the swing, throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The launch height is the height of the strike on the swing path, so a punt starts where the ball was dropped and a placement starts off the turf. Different trajectory, same solver.",
      "CLEARS or SHORT is the ball's height where the bar is, against the height of the bar. Nothing declares the result.",
      "Two scales on purpose: the machine at machine scale, and the flight above it at field scale with the span written on the panel.",
      "The parabola is drag-free. A real ball does not go this far and does not hang this long.",
    ],
  },
  {
    slug: "blocking-sled", item: "blocking-sled", title: "Blocking sled", group: "Machines",
    summary: "Pads at a static equilibrium — the load's moment against a return spring's — on a frame that will not move at all until the drive beats the friction under its skids.",
    files: ["components/ui/blocking-sled.tsx"],
    usage: `import { BlockingSled } from "@/components/ui/blocking-sled"

<BlockingSled behavior="drive" pads={5} />

// Controlled, or a sled you can lean on.
<BlockingSled load={0.8} stiffness={4000} weight={400} />
<BlockingSled interactive onLoadChange={setLoad} />`,
    props: [
      view("iso", "machine"),
      { name: "load", type: "number", description: "Controlled load on the pads, 0 to 1. Supplying it stops the loop." },
      { name: "behavior", type: '"drive" | "hit" | "recoil" | "idle" | "static"', default: '"drive"', description: "What it does when load is not supplied. Recoil is a loaded pad let go, ringing back through its own spring." },
      { name: "pads", type: "number", default: "3", description: "How many pads the frame carries, 1 to 5." },
      { name: "stiffness", type: "number", default: "2600", description: "Return spring rate, torque per radian. Stiffer gives less ground for the same load." },
      { name: "weight", type: "number", default: "220", description: "What the frame weighs, which is what has to be beaten before it moves at all." },
      { name: "friction", type: "number", default: "0.62", description: "Static friction under the skids." },
      { name: "speed", type: "number", default: "0.45", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag across to lean on it; let go and the springs take it back." },
      { name: "onLoadChange", type: "(load: number) => void", description: "The load throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The pad angle is a static equilibrium, found by bisection: the load's moment falls off as the cosine of the angle while the spring's climbs linearly, so there is exactly one crossing. That is why the last few degrees cost so much more than the first few.",
      "The frame is a threshold, not a ramp. Nothing happens until the drive beats the static friction under the skids; past that, the surplus is what accelerates it, and the readout says which side of the line the machine is on.",
      "Modelled once in the profile elevation and pushed through the camera, so the row of pads foreshortens from a raised camera rather than being redrawn per view.",
      "No impact and no impulse. The deflection is a static balance and the slide is a constant acceleration — a real hit is neither.",
    ],
  },
  {
    slug: "ball-launcher", item: "ball-launcher", title: "Ball launcher", group: "Machines",
    summary: "Two counter-rotating wheels: the ball leaves at the mean of their surface speeds and turns at their difference over its own diameter. Both numbers are on the readout.",
    files: ["components/ui/ball-launcher.tsx"],
    usage: `import { BallLauncher } from "@/components/ui/ball-launcher"

<BallLauncher behavior="feed" elevation={30} />

// Controlled: mismatch the wheels and the spin is the difference.
<BallLauncher top={48} bottom={16} />
<BallLauncher interactive onWheelsChange={setWheels} />`,
    props: [
      view("profile", "machine"),
      { name: "top", type: "number", default: "34", description: "Top wheel speed in turns per second. Supplying either wheel stops the loop from picking them." },
      { name: "bottom", type: "number", default: "22", description: "Bottom wheel speed in turns per second. Mismatch is spin." },
      { name: "behavior", type: '"feed" | "spin" | "idle" | "static"', default: '"feed"', description: "Feed runs balls through; spin brings the wheels up with nothing going between them." },
      { name: "elevation", type: "number", default: "26", description: "Barrel elevation in degrees. The wheels, the chute and the muzzle all lie on that axis." },
      { name: "speed", type: "number", default: "0.5", description: "Cycles per second." },
      ...loop,
      { name: "interactive", type: "boolean", default: "false", description: "Drag up and down to bias the wheels, which is to dial the spin in." },
      { name: "onWheelsChange", type: "(wheels: { top: number; bottom: number }) => void", description: "Both wheel speeds throughout a drag or a key press." },
      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow under the tripod." },
      { name: "label", type: "string", description: "Caption below the readout." },
      ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "Exit speed is the mean of the two contact speeds and spin is their difference over the ball's own diameter, both out of launcherExit off the same pair of inputs. Matched wheels throw it flat and fast; every turn of mismatch trades speed for rotation.",
      "The wheels are drawn at the speeds they are given — the spokes index by the clock times the rate — so a wheel at half speed visibly turns at half speed.",
      "No slip, no compression and no air. A real launcher loses some of the contact speed to the ball skidding through the gap; this one reports the ideal, which is the number the machine is set to.",
    ],
  },
]
/**
 * Which group a registry item lands in when nobody has written its page yet.
 * Deliberately coarse: it only has to be near enough that the item is visible
 * and findable, because the moment someone writes the entry above, that wins.
 */
function groupFor(item: (typeof registry.items)[number]): DocGroup {
  if (item.type !== "registry:ui") return "Foundations"
  const categories: string[] = item.categories ?? []
  if (categories.includes("3d") || /(^|-)arm(-|$)/.test(item.name)) return "Arms"
  if (categories.includes("robots") || categories.includes("animals")) return "Robots"
  return "Machines"
}

/**
 * Every registry item has a page, whether or not anybody wrote one.
 *
 * The landing grid, the docs index and the sitemap are all built from `docs`,
 * so an item missing from the list above used to be invisible everywhere at
 * once — which is exactly what happened to `robot-dog`. A generated entry is a
 * worse page than a written one, and it is enormously better than no page.
 *
 * Notes: `docs/gallery-coverage.md`.
 */
const generated: DocEntry[] = registry.items
  .filter((item) => !authored.some((entry) => entry.slug === item.name))
  .map((item) => ({
    slug: item.name,
    item: item.name,
    title: item.title,
    summary: item.description,
    group: groupFor(item),
    files: item.files.map((file) => file.path.replace(/^src\//, "")),
  }))

export const docs: DocEntry[] = [...authored, ...generated]

export const docBySlug = (slug: string) => docs.find((entry) => entry.slug === slug)

/** Items the registry ships that nobody has written a page for yet. */
export const generatedDocSlugs = generated.map((entry) => entry.slug)

export const docGroups: DocGroup[] = ["Arms", "Machines", "Robots", "Foundations"]
