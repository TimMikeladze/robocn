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
    summary: "The footfall solver behind the horse: six named gaits as real touchdown sequences, a beat count derived from them, the support pattern, and the share of the body's weight on every grounded foot.",
    files: ["lib/robocn/gait.ts"],
    usage: `import { solveGait, gaitBeats, fetlockSink } from "@/lib/robocn/gait"

const pose = solveGait({ gait: "canter", phase: 0.4, lead: "left" })
pose.beats     // 3 — counted from the footfalls, not declared
pose.support   // how many feet are down right now
pose.legs      // id, fore, touchdown, contact, load, foot
fetlockSink(pose.legs[0].load) // degrees the sprung pastern drops`,
    api: [
      { name: "solveGait", type: "(options?: GaitOptions) => GaitPose", description: "One instant of a gait: who is down, when each limb landed, where its foot is, and what share of the standing weight it carries." },
      { name: "GaitOptions", type: "{ gait?, phase?, lead?, duty?, stride?, lift? }", description: "Gait is halt, walk, trot, pace, canter or gallop; lead is the foreleg that lands last and only the canter and the gallop have one; duty overrides the gait's own; stride and lift are normalized foot travel and swing height." },
      { name: "GaitLeg", type: "{ id, side, fore, touchdown, t, contact, load, foot: Vec2 }", description: "touchdown is where in the stride this limb lands, t is the time since it did, and load is its share of the body — 0 in the air, and summing to exactly 1 across every grounded limb." },
      { name: "GaitPose", type: "{ gait, beats, duty, lead, leadLeg, support, airborne, forehand, legs }", description: "beats is the number of distinct footfall instants, counted from the touchdowns; support is how many feet are down; airborne is the suspension." },
      { name: "gaitBeats", type: "(gait: EquineGait) => number", description: "The beat count on its own: 4 for a walk, 2 for a trot and a pace, 3 for a canter, 4 for a gallop, 0 for a halt." },
      { name: "fetlockSink", type: "(load: number) => number", description: "The sprung pastern: how far the fetlock drops, in degrees, under a load. A passive joint whose angle is an output of the gait." },
      { name: "gaitLimits", type: "{ reach: 16, clearance: 11, fetlock: 30 }", description: "What stride, lift and a full load mean in world units and degrees." },
    ],
    notes: [
      "The beat count is read off the touchdown instants rather than declared, which is what makes walk-versus-trot a fact about the numbers. The pace and the trot both come out at two, on different diagonals — proof that the count alone does not name a gait.",
      "The load is a static weight distribution — the forehand's share divided among whichever feet are down — and not a dynamics solve. No acceleration, no ground reaction, no centre of pressure. It solves no legs either: the components own their own limb chains and read the load off this.",
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
    summary: "The mechanisms in a machine you carry: a hinge, a kickstand that has to close, rotary detents that wrap, a band that keeps its length, and a screen on a plane at any attitude.",
    files: ["lib/robocn/device.ts"],
    usage: `import { hingePose, standPose, detent, bandLinks, panelTransform } from "@/lib/robocn/device"

const lid = hingePose(105, 84, 78)          // lid keeps its length; facing says what you see
const stand = standPose(0.7, 78, 46, 44)    // foot solved onto the desk, or folded
const dial = detent(450, 8, 45)             // -> { index: 2, offset, turns }
const band = bandLinks(7, 6.4, 0.8)         // constant pitch, curvature varies
const panel = panelTransform(camera, corner, along, down, 104, 78)`,
    api: [
      { name: "hingePose", type: "(angle, base, lid, options?) => HingePose", description: "One revolute joint in side elevation. The lid is `lid` long from the pivot in every pose, `facing` says how much of the screen is toward the front, and `overCentre` says when it has passed vertical." },
      { name: "standPose", type: "(recline, slate, leg, mount, options?) => StandPose", description: "The kickstand triangle: given the tilt, the drop from the hinge to the desk decides the horizontal run. Returns `folded` when the leg cannot reach, instead of stretching it." },
      { name: "detent", type: "(rotation, steps, degreesPerStep) => DetentPose", description: "A rotary input divided into steps, wrapping in both directions. The click wheel and the digital crown are the same mechanism at different scales." },
      { name: "wheelSegment", type: "(degrees) => \"menu\" | \"next\" | \"play\" | \"previous\" | null", description: "Which quarter of a ring a thumb at this angle is on. Null for a non-finite angle." },
      { name: "bandLinks", type: "(count, pitch, closure, options?) => BandLink[]", description: "A link band as a constant-pitch chain — count and pitch fixed, curvature varying — so opening it cannot make it longer." },
      { name: "listWindow", type: "(index, rows, visible) => number[]", description: "The rows a fixed-height list shows with `index` selected, sliding to keep it near the middle and stopping at both ends." },
      { name: "panelTransform", type: "(camera, corner, along, down, width, height) => PanelProjection", description: "A flat panel at any attitude, as one affine transform for its artwork plus a `facing` that says whether you are looking at its front, its back, or its edge." },
      { name: "panelPath", type: "(camera, corner, along, down) => string", description: "The same panel's outline, projected." },
    ],
    notes: [
      "Pure functions over plain objects. No React, no dependencies, and no dynamics — no friction in the hinge, no detent force on the crown, no material in the band, and no contact between the stand's foot and the desk beyond the requirement that it be there.",
      "`camera.plane` covers artwork in the horizontal plane and `camera.wall` covers a vertical one. `panelTransform` is for everything in between — a lid, a propped slate, a turned handset — which is where the screens in this family actually live.",
      "Panel axes follow what a reader of the panel sees rather than the world: a screen facing the front camera runs its own left-to-right from +x to −x, because from nose-on the machine's starboard side is on your left.",
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
      { name: "behavior", type: '"sweep" | "day" | "nod" | "static"', default: '"sweep"', description: "Sweep runs dawn to dusk; day runs the whole twenty-four hours, so the head turns away and the rays furl at night; nod is the hunting a tracker does once it has arrived." },
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
      "Two rigid bodies on one kingpin. The hitch is a real yaw in world space, so the barrel foreshortens in side elevation as it turns and swings properly in plan.",
    files: ["components/ui/tanker-truck.tsx"],
    usage: `import { TankerTruck } from "@/components/ui/tanker-truck"

<TankerTruck behavior="haul" compartments={5} />
<TankerTruck level={0.4} hitch={30} view="plan" />`,
    props: [
      { name: "level", type: "number", description: "Controlled cargo, 0 empty to 1 full. Supplying it stops the loop." },
      { name: "behavior", type: `"haul" | "discharge" | "static"`, default: `"haul"`, description: "Rolling with a full barrel, or a delivery round emptying a compartment at a time." },
      { name: "compartments", type: "number", default: "4", description: "Bulkheaded compartments, which discharge from the rear. Clamped to 2–6." },
      { name: "hitch", type: "number", default: "0", description: "Trailer yaw about the kingpin in degrees, clamped to ±60." },
      { name: "showCabinet", type: "boolean", default: "true", description: "The discharge cabinet, the hose reel, and a gauge per compartment." },
      { name: "interactive / onLevelChange", type: "boolean / (level: number) => void", description: "Drag or arrow-key the load in and out." },
      view("profile", "road tanker"), ...loop, ...form.slice(0, 2), ...palette,
    ],
    notes: [
      "The barrel is opaque, so each compartment's contents are read off the cabinet gauges and its dome collar rather than drawn through the shell.",
      "No suspension, mass, load transfer, steering geometry or fluid is computed.",
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
