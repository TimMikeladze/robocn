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

Consumers install with `bunx --bun shadcn@latest add https://<host>/r/robot-arm.json`, or add the
`@robocn` namespace to `components.json` and run `add @robocn/robot-arm`.

## Components

| Item | Type | What it is |
|---|---|---|
| `robot-kinematics` | lib | IK/FK core. No React, no three, no deps. |
| `robot-style` | lib | Size scale, variants, palette resolution from CSS vars, view camera. |
| `use-robot-arm` | hook | Animated pose state for a link chain. |
| `use-pointer-target` | hook | Pointer position mapped into arm world units. |
| `celestial-geometry` | lib | Kepler's equation, ellipses about a focus, the terminator circle, illumination, limb darkening, body frames, an irregular radius field. |
| `celestial-planet` | ui | A tilted globe with bands, caps, storms and a ring system the body genuinely occludes. |
| `celestial-moon` | ui | The phase machine: the crescent is the projected terminator, and libration rocks the limb into view. |
| `celestial-star` | ui | Limb darkening as a law, granulation, a rotating spot belt, prominence loops on the limb. |
| `celestial-asteroid` | ui | An irregular body whose silhouette changes as it turns, tumbling about a moving axis. |
| `orrery` | ui | Bodies on arms whose length is the orbital radius, on real Kepler ellipses with the hub at a focus. |
| `hull-geometry` | lib | An equal-area tiling of a sphere into armour plates summing to exactly one, a fracture front and the straight-line travel behind it, a shock ring, and a paraboloid dish. |
| `battle-station` | ui | An armoured orbital station whose hull is that tiling: it comes apart into the plates it was made of, and goes back together exactly. |
| `debris-field` | ui | The same fragments with the body taken away, depth-sorted so a near piece occludes a far one. |
| `robot-arm` | ui | The flagship: SVG articulated arm, N links, 8 tools, 4 variants. |
| `robot-arm-3d` | ui | The same arm as a procedural react-three-fiber rig. |
| `robot-stage` | ui | Canvas + lights + floor + orbit controls for the 3D items. |
| `scara-arm` | ui | SCARA in plan view: two rotary links, Z column, top-down. |
| `delta-arm` | ui | Parallel delta robot, real delta IK, isometric projection. |
| `gantry-arm` | ui | Cartesian gantry / plotter head on X-Y rails. |
| `robot-face` | ui | Head with pointer-tracking eyes, moods, blinking, antenna. |
| `robot-loader` | ui | Pick-and-place loop as a loading indicator. |
| `arm-controls` | ui | Slider panel that drives an arm in forward kinematics. |
| `robot-export` | ui | The record button: wrap a machine and save it as an animated WebP, an animated GIF or a still. |
| `robot-capture` | lib | DOM to frames to bytes: a cascade-baking snapshotter, a GIF89a encoder, an animated-WebP muxer. |
| `robot-gripper` | ui | Standalone parallel or angular gripper that works a pick cycle. |
| `conveyor-belt` | ui | Automatic or controlled conveyor travel with workpieces. |
| `micro-duck` | ui | Bipedal duck robot: solved legs, craning neck, hinged beak. |
| `duck-kinematics` | lib | Pure biped pose solver: footfall cycle, neck chain, beak. |
| `reachy-mini` | ui | Companion head on a solved six-rod parallel platform. |
| `stewart-kinematics` | lib | Closed-form 6-DOF Stewart platform IK with stroke limits. |
| `animatronic-face` | ui | Expressive humanoid head: every feature a servo, expressions that blend. |
| `face-actuation` | lib | The face rig: 16 servo channels, 9 blendable expressions, exact ellipsoid silhouettes. |
| `robot-quadruped` | ui | Four-legged robot that walks, trots, and notices the pointer. |
| `robot-cat` | ui | Legs hung off a solved spine: the arch moves the shoulder and the hip, and the legs answer. |
| `robot-dog` | ui | The same spine with a floating shoulder, a solved neck, and a tail solved across the centre plane. |
| `robot-fox` | ui | Tips its whole body about its hip; the brush is an output of the pitch and the ears triangulate. |
| `robot-bear` | ui | Plantigrade soles make each foot an interval, so the feet make a base of support with edges; rearing collapses it and the balance rule keeps the mass inside it — or does not, and topples. |
| `robot-polar-bear` | ui | One number hands the load from the soles to the water: the hull settles to a waterline, the hind limbs trail, and the forelimbs solve to a stroke path. |
| `robot-panda` | ui | The seat is a third contact that buys back the base both forepaws just left, and the pseudo-thumb's pad gap is an output of what is held. |
| `robot-horse` | ui | Named gaits as real footfall sequences with the beat counted off them; the load drives a sprung fetlock and a nodding neck. |
| `robot-pegasus` | ui | One load budget shared between legs and wings; the wing is three bones solved to a tip tracing a figure of eight. |
| `robot-camel` | ui | The only floor in the set with a depth: the pad opens under load, that drops its pressure, and the pressure is the sinkage. |
| `gait-kinematics` | lib | Six equine gaits as touchdown sequences: the beat counted, the support pattern, the lead, and the share of the body on every grounded foot. |
| `robot-fish` | ui | Swimming fish built on a travelling body wave, with fins and a dart. |
| `robot-snake` | ui | Serpentine crawler: even wave, sidewinding lift, coil, strike. |
| `spine-kinematics` | lib | Serpenoid travelling-wave spine with taper, turn and clearance. |
| `bear-kinematics` | lib | Plantigrade stance: a rigid sole placed on the floor with the leg solved to the ankle it produces, the base of support those intervals make, and the static load at each contact. |
| `robot-spider` | ui | Eight-legged plan-view walker with solved knees and three gaits. |
| `robot-crab` | ui | Sideways walker on the same gait solver, with hinged claws. |
| `hexapod-kinematics` | lib | Radial four-to-ten-leg gait solver, knees solved per leg. |
| `walker-kinematics` | lib | Two or four legs carrying their mass above the hips: a footfall schedule, the support polygon it leaves, and the hull attitude that is the only way to move that mass over a foot. |
| `scout-walker` | ui | Two legs, so the support is one foot: the cab rolls the whole machine over the leg that stays put, and reports it when the roll stop runs out first. |
| `siege-walker` | ui | The same solver with four feet at the corners of a long rectangle, which already hold the mass — until it paces, and the support is a line down one flank. |
| `tripod-kinematics` | lib | Three legs: a load schedule, the body position that schedule demands, and the support polygon it has to stay inside. |
| `tripod-droid` | ui | Stubby three-legged survey walker that leans onto two feet before it lifts the third, and says how much room it has left. |
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
| `phyllotaxis-geometry` | lib | Golden-angle disc lattices, the Fibonacci arms that fall out of them, a dished face, and a two-axis aim solved from a direction. |
| `robot-sunflower` | ui | Heliotropic collector mast: a floret lattice on a dished head aimed by a solved tracker, on a stem that leans while the collar takes the remainder. |
| `cactus-geometry` | lib | Continuum limbs solved from their own curvature, ribbed sections and crest lines, a staggered areole lattice, taper-true skin normals, rigid spine fans and petals. |
| `robot-cactus` | ui | Potted columnar collector: one continuum solver for the column and both arms, areoles and spines on the solved crests, a rigid corolla at the crown. |
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
| `device-geometry` | lib | Hinge closure, book fold, kickstand triangle, rotary detents, constant-pitch band, panels at any attitude. |
| `clamshell-laptop` | ui | A portable workstation on one solved hinge, with the screen drawn only where a camera can see it. |
| `slate-tablet` | ui | A slate and the kickstand whose foot has to reach the desk — or fold. |
| `wheel-player` | ui | A pocket player whose click wheel is geared to its list, with a hold switch that is a real interlock. |
| `slab-handset` | ui | One slab turned about its own axis: screen, edge, then the back and its camera array. |
| `folding-handset` | ui | A book fold whose display keeps its own length as it bends, on leaves that roll rather than pivot. |
| `wrist-terminal` | ui | A crown geared to a dial, on a link band that keeps its length. |
| `keyboard-geometry` | lib | Key travel with hysteresis, an asymmetric keystroke, a unit-pitch deck, matrix scan order, and caps as solids on a raked face. |
| `key-switch` | ui | One switch, sectioned: a contact that closes partway down the travel and opens again higher than it closed. |
| `robot-keypad` | ui | A raked bench entry pad on a scanned matrix: the key down and the cell being read are two different things. |
| `robot-keyboard` | ui | A whole deck placed by a unit grid, caps sculpted per row, and a split layout whose halves are turned apart. |
| `input-terminal` | ui | A console whose key deck drives its own screen: the glyph count is the keystrokes it has taken. |
| `vehicle-geometry` | lib | Ackermann steering, steady-state articulation, the coordinated bank, a rigid body on N axles, the rocket equation, surface-piercing foil lift. |
| `robot-car` | ui | One steering number, two different wheel angles, and a body that rides the road on its own axles. |
| `transit-bus` | ui | An articulated bus whose rear section angle is solved from the hitch, with plug doors and a kneel on the doors' own number. |
| `cargo-plane` | ui | A freighter that banks because it was asked to turn; the ailerons carry the roll it has not finished. |
| `hydrofoil-craft` | ui | The one machine that climbs out of its own ground plane: lift as v², so the surface-piercing V sheds wetted area. |
| `launch-vehicle` | ui | Flies a pitch program, gimbals against it, stages, and reports the Δv still attached. |
| `strike-starfighter` | ui | Four wings on two fore-aft hinges that open from a cruise plane into an X. |
| `ion-interceptor` | ui | Hexagonal panels pitching on lateral pylons, around a pod that yaws inside them. |
| `hopper-dynamics` | lib | Bounce dynamics: an exact parabola in the air, an exact spring-mass stance, and the duty factor between them derived. |
| `spring-hopper` | ui | A one-legged rig on a real helical spring, with a solid height it can be crushed onto. |
| `ball-hopper` | ui | A shell that is its own compliance: flattened at constant volume, and it comes to rest in finite time. |
| `sound-geometry` | lib | Spiral groove, tonearm tracking error, exponential horn, spring governor, tuned comb, pinned barrel. |
| `piano-geometry` | lib | A grand action and its escapement, a back check, a late damper, a scale that cannot be ideal, the bent side that is its envelope, a lid solved from its prop. |
| `turntable-deck` | ui | An arm geared to its platter by the groove, and the tracking error that falls out of it. |
| `gramophone-horn` | ui | A mainspring and its governor, a crank that is the wind, and an exponential horn. |
| `music-box-drum` | ui | A pinned barrel bending a comb tuned by length, and letting go on the pin. |
| `busker-droid` | ui | The only machine here whose pose comes from data: a step pattern, two solved arms. |
| `robot-grand-piano` | ui | A player grand: a roll, 88 solved actions, and a hammer let go before the blow. |
| `linkage-geometry` | lib | Closed loops: four-bar, slider-crank, block and tackle, and the elevation-to-world helpers. |
| `pumpjack` | ui | A beam pump whose stroke is what the four-bar produces, not a tween. |
| `drilling-derrick` | ui | A block reeved on 4–12 lines; the drum's payout is shared between them. |
| `mud-pump` | ui | One to three slider-cranks on a shaft, discharge summed from the solved velocities. |
| `wellhead-tree` | ui | A valve stack whose line-up decides which bore is live. |
| `storage-tank` | ui | A floating roof on the liquid, and a rolling ladder solved from it. |
| `oil-tanker` | ui | Cargo sets the draft, so the sea line cuts a hull that moves. |
| `tanker-truck` | ui | Tractor and trailer on one kingpin, with the trailer's yaw solved from the steer. |
| `flare-stack` | ui | A modelled stack under an illustrated plume, and it says which is which. |
| `fractionating-column` | ui | Tray count as an axis: spacing, seams and draw heights all come off it. |
| `jackup-rig` | ui | Fixed legs, a climbing hull: one number is the air gap and the stick-up. |
| `household-geometry` | lib | Hinged leaves, sectional panels, a drum's Froude regime, a resonant suspension, a roped hoist, tracking slats, Darcy flow. |
| `gabled-house` | ui | A dwelling as a machine: the ridge is the pitch, the garage door rides a real track, the fins track the sun. |
| `tower-block` | ui | Storeys as height and travel at once, with a car and counterweight on one rope. |
| `espresso-machine` | ui | A spring-lever group solved as a slider-crank: the declining pressure is the spring. |
| `refrigerator` | ui | Solved leaves on vertical hinges, an interior the swing reveals, and a lamp on a real door switch. |
| `radial-bloom` | ui | Four guided stages per ram, so the star opens past twice its closed radius without a stage ever leaving its sleeve. |
| `lantern-geometry` | lib | An ordered exploded assembly — each part along the axis it was fitted on, in reverse fitting order, seating again exactly — a charge transfer solved in closed form so it conserves at any step size, a recital, a reserve gauge, and an inverse-square emission column. |
| `power-lantern` | ui | A carried reservoir that charges a ring through a port on its face: charge is moved rather than invented, the recital gates the transfer, the beam is paid for out of the reserve, and the whole machine comes apart in the reverse of the order it was built. |
| `washing-machine` | ui | Wash and spin either side of a Froude number of one, over a tub that resonates on the way up. |
| `rail-geometry` | lib | Bogies placed on a curve and the centre and end throw that follow, Klingel hunting on a coned wheelset, a pantograph solved to a working height, and a turnout's lead, crossing angle and blade throw. |
| `rail-locomotive` | ui | The inverse of every other vehicle here: nothing on board steers, the track places it — bogies on the tangent, the body the chord, the throw the answer. |
| `rail-bogie` | ui | The only self-excited motion in the set: coned treads, so the wheelsets weave at Klingel's wavelength until the flange stops them. |
| `pantograph-collector` | ui | Height is bought with reach, and the head is level because a second closed loop says so — at one height, and not at the ends of the travel. |
| `rail-turnout` | ui | A route is detection rather than a setting, so a turnout caught in mid-stroke has none; and the crossing angle is the turnout number and nothing else. |
| `gridiron-geometry` | lib | The ball as a real prolate spheroid, drag-free ballistics, counter-rotating wheel exit conditions, a route tree sampled by arc length, a sprung pad arm at equilibrium, and the column pitch a hand on the turf implies. |
| `robot-football` | ui | The outline is the ellipsoid's own central section, so end-on it is a circle; the laces are on the surface and go round the back. |
| `gridiron-lineman` | ui | A three-point stance is a four-contact stance: the hand on the turf is what makes the back flat, and the pitch is solved for. |
| `gridiron-quarterback` | ui | The elbow is an output of where the hand is on the swing, and the ball leaves on the velocity the hand had. |
| `gridiron-receiver` | ui | Pose from a path: a point at an arc length along the route tree, leaning by the exterior angle at the break. |
| `gridiron-kicker` | ui | A swing leg that meets a ball, and a parabola that starts where the strike did. Clearing the bar is computed. |
| `blocking-sled` | ui | Static equilibrium against a return spring, on a frame with a friction threshold it will not move below. |
| `ball-launcher` | ui | Mean of the two surface speeds out, difference as spin. Both numbers, one pair of inputs. |

### The armoured walkers

Two machines on one new solver (`walker-kinematics`), on an axis the set did not have: a hull
carried well above its hips, which cannot slide over its feet and has to buy every lateral
move with roll. Design note: [armoured-walkers.md](armoured-walkers.md).

`vitest` over the solver and the two machines: femur and tibia exact in every gait, at every
height and phase, for both leg counts; the loads summing to one body whenever anything is down
and to nothing in a flight phase; the achieved centre of mass equal to `hull · sin(roll)` and
`hull · cos(roll) · sin(pitch)` — read off the pose rather than off the input — with both
angles inside their stops; a biped in single support rolling its mass exactly onto the stance
foot and standing level in double support, and a taller hull reaching the same foot with less
roll; a quadruped's lateral-sequence walk never dropping below three feet down and never
rolling past four degrees, while `pace` clamps at the stop and goes negative; the stride's
flight phase reported rather than hidden, and claiming no margin either way; the hip dropping
on the side the hull rolls onto, with the pair still averaging the ride height; the loads
following the mass — four square feet at a quarter each, and the near side taking more than
half when it is pushed; the ride height falling when short legs cannot reach; a gait the leg
count does not have falling back to standing; and `walkerHullPoint` putting a hull-mounted
part exactly where the solver put the hips, which is the contract that keeps the drawing on
the machine.

The margin helper separately: positive inside a square, exactly the distance to the edge, and
negative outside, whichever way the polygon is wound; zero at best on a line; and a single
contact measured as a point.

Driven in a browser through all four views and all four variants at each step, which is what
caught the two a drawing only shows: a knee solved in the plane of the *step* rather than the
plane of the *machine*, so a foot passing under its own hip threw the knee forward and the leg
read as a broken chair; and a neck that projected as a rod with a box on the end until it was
given the droop that puts the head under the hull's nose.

### The rail machines

`vitest` over the solver and the four machines: the chord relation the throws come from,
checked three ways — the centre throw inward, the end throw outward and further, and a bogie
pivot thrown neither way because it is *on* the track; both going to zero on straight track
and on nonsense. Klingel's wavelength against its own closed form, longer for less cone and
infinite for none; the lateral and the yaw a quarter of a wavelength apart, and the whole
thing repeating after exactly one; the rolling-radius difference equal to `2γy`, which is the
restoring term itself; the flange as a clamp. The pantograph's arms their own length at every
height, the knee folding in as the pan rises, the height clamping past full extension rather
than breaking, and the head level at the height the levelling was set for and measurably tipped
at the bottom of the travel. The crossing angle from the turnout number, the radius from where
the inner rails actually meet, the offset coming out as one gauge whatever the number, a
diverging route that leaves the straight with no kink and runs on at exactly `1:N` past the
crossing, and two blades whose gaps always sum to the throw with no route set between them.
`tsc --noEmit`, `eslint`, `registry:build` and `next build` clean.

Rendered headless through all four views and all four variants at each step, which is what
caught the four a drawing only shows: a fit envelope written with the train's fore-aft sign
inverted, so the consist ran off one edge of the frame; an underframe solebar modelled as a
slab across the whole floor, which in plan view painted every vehicle dark; glazing and cab
screens painted with a literal colour instead of through `robotSurface`, so they stayed solid
in the outline variant; and a bogie whose axleboxes overlapped its own wheels, which hid them
from above.

### The household

`vitest` over the solver and the five machines: a leaf's free edge on a circle about its hinge
at every angle; every sectional panel exactly its own height at every travel, vertical when
shut and flat when open; a release angle below a Froude number of one and none at or above it;
the whole load inside the drum at every sample of a wash, thrown at a wash speed and pinned at
a spin; the suspension worse at its critical speed than at four times it and settling to the
imbalance itself above it; a hoist rope the same length at every car position, with the
counterweight falling exactly as far as the car rises; a tracker clamped at its stops and
saying so. `tsc --noEmit`, `eslint`, `registry:build` and `next build` clean.

Rendered headless through all four views and all four variants at each step, which is what
caught the three a drawing only shows: window and door artwork modelled with the whole
cabinet's depth, so it tunnelled through the house in the isometric view; a lid's tub mouth
drawn from a camera that cannot see down it; and a cast shadow that fell toward the sun
instead of away from it.

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

### Hoofed machines

`vitest` over `gait-kinematics` and the three machines on it. The beat count of every gait read
off its own touchdowns (4, 2, 2, 3, 4) rather than declared; the loads summing to exactly one
body whenever any foot is down and to nothing in a suspension; a canter and a gallop mirroring
exactly about the lead while the symmetrical gaits ignore it; a walk never dropping below two
feet down and a gallop provably leaving the floor; no foot ever driven below the floor.

Per machine: the horse's fetlock sitting lower over its own hoof when loaded than when free,
and the forehand's pair sunk further than the hind's standing square, because the forehand
carries more; the poll swinging further across a stride with `balance` on than off. The
pegasus's leg loads going to zero and its limbs folding as `lift` reaches 1, the body rising
with it, and half a body still on the feet at 0.5; every wing bone holding its exact length at
any beat and any spread; the wingtip crossing zero twice fore-and-aft for every once up-and-
down, which is what makes the path a figure of eight. The camel's sunk feet being exactly its
loaded feet, its pads narrower on a swinging limb than a standing one, and a pace rolling to a
full ±1 while a trot's roll is exactly the forehand split — 0.16 of a body — at every instant
either diagonal is down.

That last one is the correction worth recording: the test first asserted a trot rolls *zero*,
and the arithmetic said 0.16. The arithmetic was right, because a trot's diagonal puts a
forehand against a hind end rather than two equal sides. The claim in the docs changed to match
the solver rather than the other way round.

Drag mapping through synthetic pointer events on all three, reduced motion parking every loop,
`tsc --noEmit`, `eslint`, `registry:build` and `next build` clean, and all four views and all
four variants rendered headless at each step — which is what caught the pegasus's wings being
foreshortened to a line in their own native elevation, and sent them through the real camera in
their own group instead of riding the body's flat artwork.

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

Six machines you carry, on one new solver. The set had machines that make something, machines
that move something and the parts a machine is assembled from, and nothing that sits in a hand —
but a hinge, a book fold, a kickstand, a click wheel and a link band are mechanisms in exactly the
sense the rest of the set means it: one degree of freedom, visible, and honest from four camera
angles. Design notes: [personal-devices.md](personal-devices.md) and, for the sixth,
[folding-handset.md](folding-handset.md).

`device-geometry` carries five closures and a wrap that a drawing can get wrong, and each has an
invariant the tests hold it to: the hinge keeps the lid's length at every angle and reports when
it has passed vertical; the book fold spends `radius × (180 − fold)` of display on the bend and
takes it off the straight runs, so `2 × run + arc` is the sheet's length at every angle while the
panels stay rigid, and both leaf faces stay tangent to the bend circle so the leaves roll on it
instead of pivoting on a pin — a bend too big for the leaves comes back `pinched`; the kickstand's
foot is solved onto the desk with the leg at its real
length, and a leg too short to reach comes back `folded` rather than stretched, the way
`motion-platform` reports a leg out of travel; the detents wrap in both directions so a full turn
of a list lands on the row it started on; and the band keeps its link count and its pitch at every
closure, integrating a heading the way `spine-kinematics` does. It also carries `panelTransform`,
which is what puts a screen on a plane that is neither horizontal nor vertical — a lid, a propped
slate, a turned handset — as one affine transform plus a `facing` that says whether you are
looking at its front, its back, or its edge. Screens are drawn only when a camera can actually
see them, because a screen sheared to a sliver is a picture of a screen rather than a projection
of one.

None of it is dynamics: no friction in the hinge, no detent force on the crown, no crease memory
in the folding display, no material or clasp in the band, no contact model under the stand's foot,
and nothing that plays, senses or knows which way up it is. Each machine's docs `notes` say so. The `screen` prop draws structure
in palette roles — a list, a dial, a keyboard, a window — never an application's own artwork, and
nothing in the set reproduces a manufacturer, product line, wordmark or paint scheme, in the
components, the demos or the labels.

Verified with `vitest` (the solver invariants above, each machine's controlled axis moving its
mechanism, the screen appearing only from a camera that can see it, the stand folding, the wheel
wrapping in both directions and its hold switch taking pointer, key and behaviour away together,
the handset's silhouette correctly *not* changing through a half turn while its faces and keys
do, the folding display's own length conserved at every angle with the panels still rigid and the
held leaf still, the band's length at every closure, the crown ribs that face you, invalid input on every
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

Five machines that make a sound by moving something, on two solvers. Design note:
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

`robot-grand-piano` is the fifth machine and has its own solver, because a grand has something
none of the others do: an **escapement**. The jack drives the hammer's knuckle until the jack's
toe meets the let-off button, and from there the hammer covers the last of the blow with nothing
behind it — you cannot hold a hammer against a string, and a drawing that tweens the hammer off
the key is doing exactly that. The ratio it escapes at is a product of three levers, so an
action geared too low never escapes at all and `regulated` says so; on the way back the check
catches the hammer part-way down, which is what lets a note repeat. Its scale is the other
closure: an ideal one halves every octave and would want a six-metre bottom string, so the
exponent is compressed toward the bass and the shortfall is what the wound strings are for.
Each string runs from an agraffe one strike point in front of the hammers to a bridge pin one
speaking length behind it, so **the bent side of the case is the envelope of the scale** rather
than a shape somebody liked. It reads the same roll format the barrel does, through the same
`combLift` and `combRelease`. Design note: [robot-grand-piano.md](robot-grand-piano.md).

None of it is acoustics: no frequency response, no horn cutoff, no radiation impedance, no
spring torque curve, no decay, and nothing plays a sound. One approximation is stated rather
than hidden — the gramophone's platter angle is the clock times the regulated speed, not an
integral of it — and each docs page says which parts are solved and which are drawn. The piano magnifies its
travels — a key dips a three-hundredth of the instrument's length — and only its travels: every
ratio, the escapement, the after-touch and the check are solved life-size and the `data-*` hooks
carry the unmagnified numbers.

Verified with `vitest` (the solver invariants: the stylus walking monotonically inward with the
arm's own length preserved at every radius, tracking error crossing zero exactly twice across a
well-aligned sweep and staying under two degrees between, an acoustic arm reporting no nulls at
all, the horn's area doubling over a constant distance, the governor holding then sagging and
its flyweights going out with the square, an octave of comb at one over root two, a tine at full
lift at its pin and free the instant after, a blank pattern plucking nothing; plus each
machine's controlled axis moving its mechanism, the arm cueing and parking, the crank angle
tracking the wind, the pedal working off the kick row, the four views on one geometry, the
slider contract on all five, nonsense input on every numeric axis, and the behaviour samplers at
fixed phases; for the piano: the hammer travel as the dip times the product of the three levers
and stopping dead at the escapement while the key keeps going, an action geared too low never
escaping, the damper still down at a third of the dip and the sustain pedal lifting every one of
them, the una corda shifting the whole action, the scale halving at the top and falling short
below with the foreshortening rising all the way down, a crossed bass string reaching less far
down the case than its own length, every hitch pin landing inside the case the outline was built
around, and the lid angle solved from three sides with an impossible stick refused), `tsc
--noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and driven in Chrome: every docs page,
all four views, all four variants, the landing cards, reduced motion, and the pages at 390px
with no horizontal overflow.

## The heliotropic collector

One machine on one new solver: `robot-sunflower` on `phyllotaxis-geometry`. The light is a
*direction*, and everything on the machine is written in the frame that direction implies —
`aimFrom` turns it into an azimuth and an elevation, `trackerFrame` turns the pair back into
the head's own axes, and the disc, the rays and the leaf panels are all placed in those axes,
so they cannot disagree about where the sun is. Design note:
[heliotropic-collector.md](heliotropic-collector.md).

Two things fall out rather than being drawn. The florets are placed by the golden angle over
equal area, and the *spiral arms* are then found in the result: `parastichyOffsets` reports
which index step has the closest neighbours, and for any lattice from 80 to 600 florets those
steps are consecutive Fibonacci numbers. Nothing in the file knows that. And the gimbal collar
is a remainder — the stem leans toward the light on its own and the collar takes up exactly
what the stem did not, so the head's normal never comes off the sun however far the mast bends.

The stem is `spine-kinematics` doing new work rather than a new solver: a fixed contour length
whose steady `turn` is the heliotropic lean, with every link exactly the same length at every
lean. Illustrated: the hub speckle, the anchor feet, the blueprint's incidence ray. There is no
photometry, no ephemeris and no plant model — `daylight` is a shaped number, not a solar
position for a date and a latitude.

## Celestial bodies

Four bodies and the machine that carries them, on one new solver: `celestial-geometry`,
`celestial-planet`, `celestial-moon`, `celestial-star`, `celestial-asteroid`, `orrery`. The set
draws machinery; this family draws the things machinery is pointed at, and draws them the same
way — solved rather than illustrated, projected rather than redrawn, and grabbable. Design
note: [celestial-bodies.md](celestial-bodies.md).

Each earns its place on a mechanism nothing else here has. The planet is the only item with a
part **occluded by the body it belongs to**: the ring is one annulus in the equatorial plane,
and a ring point is hidden when it is behind the centre plane *and* its perpendicular distance
to the line of sight is inside the radius — exact for a sphere seen orthographically. The moon
is the **terminator as a projected great circle**, which is why its crescent flips the right way
at quarter without anything drawing a crescent. The star is a **surface brightness law drawn as
geometry**: each shell is an annulus carrying `1 − I/I₀` off `1 − u(1 − μ)`, so a giant's limb
is visibly darker than a dwarf's because the coefficient is. The asteroid is the only body whose
**silhouette changes as it turns** — its radius is a deterministic sum of cosine lobes, so the
outline is the farthest projected sample in each angular bin rather than a hull that would
bridge every hollow. And the orrery makes **Kepler's laws visible**: the arm's length *is* the
orbital radius, so it telescopes over a year, the body runs at periapsis and loiters at
apoapsis, the hub sits at a focus, and the periods come from `T ∝ a^{3/2}`.

Nothing here is simulated beyond that: no gravity, no perturbation theory, no radiative
transfer, no ephemeris and no scale. The bodies do not pull on each other, the elements are the
caller's, and no real or fictional world is named. Each docs page's `notes` says which parts are
solved and which are illustrated.

### Verification for these eight items

`vitest`: the two new solvers directly — Kepler inverting itself to 1e-9 at every anomaly up to
`e = 0.97`, equal areas in equal times, the orbit's focus, the terminator on the sphere and
square to the light, the limb-darkening law monotone from centre to limb, an irregular radius
bounded by its depth and continuous over a closed walk with no seam, orthonormal body frames, a
sphere lattice with equal-area cover, the golden-angle disc spacing by area, and the parastichy
offsets coming out consecutive Fibonacci numbers for seven different lattice sizes. Then the
components: the ring cut into far and near runs, the day-night line moving with the light and
not the body, a latitude band that cannot show rotation against a storm that must, the crescent's
area at new, quarter and full, libration rocking the craters and stopping when it is switched
off, a giant's limb darker than a dwarf's, loops growing with activity, a rock's outline changing
as it turns and staying the same for a seed, an arm telescoping and a body outrunning itself at
periapsis, every drag and arrow key reporting, and `NaN` on every numeric prop never reaching the
DOM. The `views.test.tsx` fixture suite covers all four cameras for each of the six new machines.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `next build` clean. Driven in a browser on
desktop and at 390px: every docs page, every behaviour, all four variants and all four views,
each machine grabbed with a mouse and with touch emulation, and reduced motion forced on to
confirm the loops park.

## The oil field

Ten machines and one solver covering the chain a barrel travels: a well pumped, a hole
drilled, mud circulated, pressure controlled at the head, product stored, shipped by sea and
by road, gas burned off, crude split into cuts, and the offshore hull that carries the upstream
package out. Design note: [oil-field.md](oil-field.md).

`linkage-geometry` is the first **closed** loop in the set. Everything solved so far has been
an open chain — a shoulder reaching for a target, a spine integrating a tangent, legs hung off
a body. A four-bar is closed: the crank does not choose where the beam goes, the loop does, and
at some geometries it cannot be assembled at all. The coupler pin is the intersection of two
circles, so both link lengths are the construction rather than an approximation that drifts;
where the circles do not meet the coupler keeps its length, points straight at the ground
pivot, and reports `assembled: false` instead of returning `NaN`. The slider-crank is the
degenerate case with one link at infinity, and the block and tackle is the same idea with a
constant *rope* length instead of a constant link length — which is why stringing more lines
makes the same drum turn lift less, visibly, as rope rather than as a number.

Two things unify the family beyond the solver. `accent` is the product everywhere — crude
under a floating roof, mud in a fluid end, the live cut leaving a column, flow through a choke,
the plume — so a card tells you how full a thing is at a glance. And four of the ten are driven
by *how much liquid is in them* rather than by an angle: the tank roof floats on it, the
tanker's waterline climbs the hull, the truck's compartments empty from the rear, the column's
flash zone moves. That is the axis this family adds.

Two view helpers came out of it and live in `robot-style`, since every machine projects the
same way: `elevationDraft`, which gives a machine drawn in one vertical plane every solid,
disc, member and polyline it needs already pushed through the camera; and `fitTransform`, which
lays a *fixed* envelope of motion into the frame, so a machine drawn to fit its native view
stays inside its own frame from every other camera and the framing never breathes as the
machine works.

What is solved: the pumpjack's four-bar and the rod stroke that falls out of it (the horsehead
face is an arc about the saddle bearing, which is why the rod stays vertical and travels
exactly radius × beam angle); the mud pump's three slider-cranks and the discharge differenced
from them; the derrick's block travel and its reeved falls; the tanker's and the jack-up's
waterline against a modelled hull; the tank roof's height and the rolling ladder's constant
length; the truck's hitch as a real world-space yaw; every projection. What is illustrated, and
says so in its docs `notes`: the flare plume, the flow arrows, the column's temperature banding,
the drill string below the floor, the seabed under a spudcan. What is absent: there is no
fluid, thermal, combustion, pressure, buoyancy, stability, mass or torque model anywhere in the
family, and nothing reports a physical quantity it did not compute — the wellhead's gauge is a
reading the caller supplies and the component only points a needle at.

Verified with `vitest` (the solver's invariants directly — link lengths exact at every crank
angle, the rocker swinging between the two collinear dead centres, a chosen branch that cannot
flip, a non-assemblable loop clamping rather than producing `NaN`, an analytic slider-crank
stroke, payout shared between lines, one fall per line; then 67 component tests: every
controlled axis moving its named `data-*` mechanism, the drum turning three times as far on
twelve lines as on four for the same block height, a triplex rippling less than a duplex and a
duplex less than a simplex, the master valve shutting everything above it, the ladder holding
its length across the stroke, the boot top going under while the sea line stays put, the
trailer yawing without moving the tractor, the legs not moving while the hull climbs them, each
behaviour sampler inside its own limits and neutral for a non-finite clock, `NaN` on every
numeric axis never reaching the DOM, a colour override landing, and all four cameras producing
four different drawings for all ten machines), plus the `views.test.tsx` snapshot suite over
all four cameras for each of the ten. `tsc --noEmit` and `eslint` clean over every file the
family touches, `pnpm registry:build` clean, and `next build` compiling clean.

Driven in a browser against `next dev`, in an isolated headless Chrome rather than a shared
one: all eleven docs pages render, animate on their own clock, expose `role="slider"` and a
real label, and never put `NaN` in the DOM; all four views, all four variants and every
behaviour and option switched through the demo's own controls; a pointer press-drag-release
and four arrow keys moving each machine and reporting through its `on…Change`; reduced motion
forced on, which parks every loop while leaving all ten still controllable from the keyboard;
390px with no horizontal overflow the rest of the site does not already have; and the landing
grid in both themes, where all eleven cards resolve and every one of them moves.


## Bouncing machines

Two machines that leave the ground, on one new solver. The set jumps — `robot-frog`'s own docs
say the arc is scripted and there is no ballistics in it — and the gait solvers never leave the
floor at all. A bounce is the one motion where **the ground is part of the mechanism**, and the
whole claim of `hopper-dynamics` is that the split between its two regimes is not a control:
flight is a projectile and stance is a mass on a linear spring, so given a drop height and a
spring rate, the flight time, the contact time and therefore the duty factor all fall out.
Stiffen the spring and contact gets shorter and harder without the hop changing — 0.46 duty at
`stiffness` 12 against 0.15 at 120, at the same height, and neither number was typed. Design
note: [bouncing-machines.md](bouncing-machines.md).

Every export carries an invariant the tests hold it to: contact ends when the spring force
returns to zero, which is *past* a half period because gravity biases the oscillation
(`(2/ω)(π − atan(vω/g))`, exact); flight is `2v` and apex `v²/2g`, so the ballistic half cannot
see the spring at all; a drop loses the square of its restitution every bounce and the sequence
ends when the rebound can no longer lift the machine clear, because contact time does *not* go
to zero as the landing speed does and an ideal Zeno bounce would never finish; `springCoils`
keeps its coil count and radius at every length and clamps at its own solid height rather than
drawing coils through each other; and `squashRadii` holds `rx² ry = r³`.

`spring-hopper` wears the solver as a leg — the only spring in the set drawn as a real spring,
and the only part anywhere that can be crushed onto itself. `ball-hopper` wears it as a shell:
the orthographic projection of a constant-volume spheroid is exactly an axis-aligned ellipse,
so one geometry gives a flatter ball in the elevations and a wider one in plan, with no artwork
per angle. It earns its place beside `orb-droid`, which rolls, never leaves the ground and has a
rigid shell.

Neither is dynamics beyond that: no damping inside the stance (the loss is taken at take-off as
a restitution coefficient, which is how a bounce is measured), no horizontal travel, no
friction, no spin-up from contact, no material, no motor and no energy budget — so the steady
hop is the ideal lossless case. The leg swing, the reaction wheel, the contact patch and the
yaw are drawn rather than solved, and both docs pages say which is which.

Verified with `vitest` (the solver invariants above plus nonsense input on every argument; one
number loading the spring and dropping the body; the coil count surviving a crush and reporting
`bottomedOut`; the leg swinging only in the air and the wheel answering it; the shell widening
as it flattens; the optic, vents and seam drawn only where a camera can see them; the slider
contract, keyboard and accessible label on both; the behaviour samplers at fixed phases, whole
cycles repeating in both directions, and a non-finite clock giving a neutral pose; four cameras
producing four drawings), `tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and
rendered headless through all four views, all four variants, both contact regimes and the
150px catalogue card for each.

## Vehicle robots

Seven machines that carry something along a path, and one solver. `robot-rover` and
`robot-drone` already did "a machine that goes somewhere" as a heading and a drift; this family
solves the *constraint* underneath instead. A rover's front wheels are turned by heading error;
both of a car's are turned by the same rack through different angles, because they run on
different circles. Design note: [vehicle-robots.md](vehicle-robots.md).

`vehicle-geometry` is exact where it claims to be — Ackermann steering, the steady-state
articulation angle of a towed section, `atan(v²/rg)`, the least-squares line a rigid body on N
axles settles to, `vₑ ln(mr)` summed over the stages still attached, and the `1/v²` equilibrium
of a surface-piercing foil. Two functions are stated shapes rather than simulations and say so
in their own docs: the gravity-turn `pitchProgram` and the illustrative `roadProfile`. Nothing
here integrates a path, a force or a mass: no machine in the family travels anywhere, and a
steering angle is a pose.

Three consequences are worth naming because they are what the solver buys. The bus comes out of
a roundabout straight, because the articulation is a steady state with no history rather than an
integrated manoeuvre. The plane's ailerons return to neutral once a turn is established, because
they carry the roll still to be done rather than a second animation. And the booster's Δv drops
at staging, because the readout is the equation over what is still attached — the only honest
way to draw throwing half a vehicle away.

Verified with `vitest` (32 solver assertions — the inner wheel always turning harder, a straight
rack giving an infinite radius, articulation signed with the steer and zero straight ahead, a
body level on a level surface and taking a bump between its axles as travel, Δv adding across
stages and monotonic pitch from 0 to 90, lift going as the square of speed and rise as its
inverse, a steered wheel keeping its radius, a roll that preserves every length; and 45 over the
machines — each controlled axis moving the mechanism it names, the labels, the keyboard and
pointer controls, each behaviour sampler inside its own limits and neutral for a non-finite
clock, reduced motion scheduling no frame at all while the controls keep working, and `NaN` on
every numeric axis of every machine never reaching the DOM). That last one caught the
real bug in the family: a non-finite `phase` parks the motion clock at `NaN`, and everything
derived from the clock rather than from the eased value — a wheel's rolling angle, a propeller's
blade angle, a hull's heave — went to the DOM as `NaN` until each machine guarded it.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `pnpm build` clean, and driven in a browser:
every docs page, all four variants and all four views of each machine, grabbed with a pointer,
at 390px, and with reduced motion forced on.

## The battle station

Two machines and one new solver on the mechanism nothing else in the set had: **a solid that
comes apart into the parts it was made of, and goes back together exactly**. Design note:
[battle-station.md](battle-station.md).

`hull-geometry` is the solver, and every export has an invariant the tests hold it to. The
tiling cuts the sphere into equal-area courses and each course into equal longitudes, so the
plate areas sum to exactly 1 at every course and plate count — a hull with a gap in it is not a
hull, and equal *angles* would have made that nearly right rather than right. The breakup is a
**fracture front**: a plate's release is zero until the front sweeping out from the rupture
reaches it, and after that it travels in a straight line, so the hull peels open from one point
instead of inflating. Two more invariants fall out and are tested directly: `progress = 0`
returns every plate to its own `plateNormal` to the last bit, which is why the intact station is
not a second drawing of itself; and the distance from the centre is monotone in `progress` for
every focus blend, because both candidate travel directions have a non-negative component along
the plate's own normal. The dish is a paraboloid carrying `r²/(4d)`, and an axial ray reflected
about `dishNormal` at *any* point on the bowl passes through that focus — which is what lets the
emitter rays be solved rather than aimed.

`battle-station` reads the same tiling two ways. `breakup` runs it apart; `plating` takes courses
off pole-first and shows the ribs and girdle rings underneath, and the equatorial trench is a
course carrying nothing rather than a stripe painted over one. `debris-field` is the aftermath
and earns its own item on a mechanism nothing else here has: it is a **population**, so it has to
decide what is in front of what, and it sorts by `camera.depth` and paints back to front — an
order that changes with the camera rather than being redrawn per angle. Its fragments keep
turning after they have flown, because nothing stopped them.

None of it is simulated: no mass, no energy, no structural model, no gravity and no collision.
Pieces pass through each other's paths, and both axes run backwards as happily as forwards, which
is the honest framing — a tiling coming apart, not a thing failing. Each docs page says which
parts are solved and which are drawn. The archetypes are generic, the dish position is a prop
rather than a signature, and nothing reproduces a craft, crest or paint scheme from anywhere.

Verified with `vitest` (the solver invariants above plus nonsense on every argument; the hull
reassembling plate-for-plate after a full breakup; the near side releasing before the far side;
no plate ever drawn closer in than it sat; the trench and the dish bore removing plating rather
than covering it; `plating` taking courses without taking the frame; every emitter ray landing on
the focus; the beam appearing only above its charge; the depth order changing with the camera but
culling nothing; the trails being two-point straight lines and only for pieces that have let go;
the behaviour samplers' limits and their cycles repeating in both directions; the drag and
keyboard contracts; `NaN` on every numeric axis; and the four views through the snapshot suite),
`tsc --noEmit`, `eslint`, `pnpm registry:build`, `pnpm build`, and driven in Chrome: every docs
page, all four views, all four variants, every behaviour, the breakup dragged with a mouse and
with a touch pointer, reduced motion parking the loops, the 150px catalogue cards, and the pages
at 390px with no horizontal overflow.

## The bears

Six quadrupeds in this set already answer *what moves a leg root*. None of them could stand up,
because all of them stand on points: a pad at the end of each chain, four dots on a line, nothing
with edges. `bear-kinematics` is the other half — a **plantigrade** sole, a rigid heel-to-toe
segment placed on the floor with the leg solved to the ankle that placement produces. A foot is
then an interval, feet union into a base of support, and a base has edges a centre of mass can be
inside or outside of. That distance is the **margin**, and the three machines spend it three ways:
`robot-bear` rears and has to keep it; `robot-polar-bear` gives the whole base away to the water;
`robot-panda` buys one back with a third contact so both forepaws come free. Design note:
`docs/ursine-robots.md`.

The loads are a static distribution — the minimum-norm solution of loads that sum to one body and
whose weighted mean is the centre of mass, which for two contacts is exactly the lever rule — and
not a dynamics solve. No acceleration, no ground reaction, no centre of pressure, no impulse at
footfall, no hydrodynamics, no grasp forces. The balance rule is proportional, has no gain and no
lag, and both halves of it are bounded by the hind limb's own reach; when the margin cannot be
kept the machine reports it and draws it rather than saving itself.

### Verification for these four items

`vitest` — 40 tests across the solver and the three machines. The solver: the sole exactly
`heel + toe` long at every pitch and pivot, neither end ever below the floor, the contact read off
the geometry rather than copied from the pivot, an unreachable floor reported as airborne rather
than faked, the two-contact loads matching the schoolbook lever rule, the loads summing to one
whenever anything is down and never going negative, the margin's sign at the centre, on an edge
and outside, a third contact widening the hull, and the step rolling heel → flat → toe → swing in
that order with the contact carried backwards through the stance. The machines: rearing lifting
the forelimbs and cutting the base to under half, the balance rule never making the margin worse
at any point in the rise and the mid-rise toppling without it, the hump swelling with the forelimb
load and going flat in a rear, the swim handover emptying the contacts and drawing the waterline,
the two strokes running half a cycle apart with the hind pair trailing, the seat landing and
buying a base where two heels in one place had left none, the thumb opening further around a
fatter stalk at the same grip, both forepaws solved to the stalk, the behaviour samplers' limits
and their neutral pose for a non-finite clock, the slider contracts, and `NaN` on every numeric
axis.

`tsc --noEmit`, `eslint` and `pnpm registry:build` clean over these files, and `pnpm build` green
(173 static pages). Driven in Chrome: the four docs pages, every behaviour, all four variants and
all four views, the rear and the swim dragged with a mouse and stepped with Home/End and the
arrows, reduced motion parking the loops (frame-identical over a second, against a frame that
changes without it), the 150px catalogue cards, and the pages at 390px.

## Input devices

Four machines a person operates by pressing, on one new solver. The set had machines that make
something, machines that move something and the parts a machine is assembled from, and nothing
worked by a finger — but a key is a mechanism in exactly the sense the rest of the set means it:
one degree of freedom, a spring, and a contact that closes at a point in the travel rather than
at the end of it. `clamshell-laptop` already drew a keyboard, as fifty-five flat rects with no
height, no travel and no switch under them; that is the honest limit of a keyboard drawn as
decoration on another machine, and it is why this family exists. Design note:
[input-devices.md](input-devices.md).

Each earns its place on something the set did not have. `key-switch` is the first machine whose
output is **discrete** — a contact that is closed or not, tripping partway down a continuous
travel with overtravel left after it, and reopening *higher* than it closed, which is the only
hysteresis in the set. `robot-keypad` is the first with a **scanned matrix**: state spread over a
grid read one row at a time, so the key that is down and the cell being looked at are two
different things and both are drawn. `robot-keyboard` is the first whose parts are **placed by a
unit grid** — 1u, 1.25u, 6.25u on one pitch, with the stagger falling out of the widths — and
whose caps are sculpted per row, so the deck has a real profile in elevation; `split` cuts the
same rows and turns the halves about the deck's own centre. `input-terminal` is the first where
**one mechanism drives another**: the glyph count on its screen is the keystrokes its deck has
taken, so scrubbing the passage moves both because they are the same number.

`keyboard-geometry` is the solver, and each export has an invariant the tests hold it to: travel
closes the contact at the actuation point and reopens it at the reset, holding its state in
between; the keystroke curve falls fast, dwells and returns slower, so a key never reads as a
sine; rows are laid on a fixed unit pitch with a per-row stagger and each row's own width is
reported, so a short row is drawn short rather than stretched; the scan walks the cells in the
real order and wraps in both directions; and the deck frame is orthonormal at every rake, with
caps standing on it as boxes that press along its normal, carrying their own spin in the plane
and tilt on the top face. The rake is the mechanism rather than the styling — a face flat on the
bench presses straight into a front camera and shows nothing.

None of it is dynamics: no force curve, no tactile bump force, no click leaf physics, no
rollover, no debounce, no ghosting and no character encoding. The screens draw structure — a
status band, filled lines, an entry dot, a block cursor — never text, and the caps of a keyboard
are blank, so a passage is a rhythm across the deck rather than something typed. Each machine's
docs `notes` say so, and nothing in the set reproduces a manufacturer, product line, wordmark,
key set or paint scheme.

### Verification for these five items

`vitest` — 55 tests across the solver and the four machines. The solver: the contact closing
partway down and never at a point past the end of the travel, the hysteresis band holding its
state in both directions, the keystroke curve's asymmetry, one unit pitch whatever a cap's width,
a stagger that moves a row without changing its pitch, rows reported short, the home row as the
sculpt's low point with the ends tilting inward, the scan energizing one row at a time and
wrapping, a schedule that strikes each key in turn inside the passage at both ends, strikes
outside the deck dropped rather than clamped, an orthonormal deck frame at every rake with its
normal leaning toward the operator, caps as boxes that move with a press and are unchanged by a
quarter turn of their own square, and `NaN` on every input. The machines: the stem driving the
spring, the contact closing at 0.55 and not at 0.4 of a travel whose actuation is at half, the
leaf staying closed at 0.45 on the way back up and opening at 0.2, the contact reported once per
event rather than once per frame, the leg changing for a tactile bump and the jacket appearing
only for a clicky one, the drawn travel scaling with the travel given, the cutaway drawn only
from a camera that can see its plane, the keypad striking one key at a time with the readout
filling a dot per digit, the matrix laid out as asked and scanned a row at a time, the rake
changing the body, the deck coming to sixty-one keys because that is what the rows add up to, the
split halves turned apart, the sculpt changing a cap, the ripple crossing the deck rather than
pressing everything at once, the terminal's head stopping where the hinge stops and its screen
filling from the same passage its keys are struck through, a screen that is off drawing no lines
at all, the slider contracts, the accessible labels, palette overrides, and the behaviour
samplers at fixed phases.

`tsc --noEmit`, `eslint` and `pnpm registry:build` clean over these files, and `pnpm build` green.
Driven in Chrome: the four docs pages, every behaviour and every variant switched through, all
four views, the keyboard's passage dragged with a pointer (the slider's `aria-valuenow` moving
0.38 → 0.75 and back into the behaviour on release), each machine sampled across real animation
frames to confirm it runs its own cycle — the switch's contact tripping and holding through the
hysteresis, the keypad's scan walking its cells, the terminal's lines filling — reduced motion
forced on to confirm the loops park frame-identical, the catalogue cards at 150–170px, and the
four pages at 390px with no horizontal overflow.

## Gridiron machines

Seven machines and one solver, `docs/gridiron-machines.md`. Four players in the postures the
game asks for, the ball they throw, and the two pieces of training equipment that make them do
it again. No team, league, franchise, character, logo, colourway or real number appears
anywhere in it, including in demo labels and catalogue lines: the players are named for the job
and wear plain plated armour in the set's own palette.

The ball is the reason the family has a lib. A football is a prolate spheroid, and two things
follow from writing it that way rather than drawing an oval. Its **silhouette is exact** from
any angle — written as `p = R M q`, the surface normal is `R M⁻¹ q`, so the outline is the great
circle of the unit sphere whose pole is `M⁻¹ Rᵀ d`, pushed back out through `R M`; end-on that
degenerates to a circle of the waist radius, and nothing special-cases it. And the **laces are
on the surface**, each carrying the sign of its own normal against the view, so a spiral takes
them round the back instead of sliding them across the front.

The players are `solveSkeleton` from `skeleton-kinematics` below the shoulders. The column is
this family's own: `playerSpine` sweeps equal segments through a constant curvature centred so
the **chord** comes out at the pitch asked for, where `spineCurve` accumulates its pitch down
the column and so puts the chord at about half of it. Making the chord the number is what lets
`stancePitch` bisect for it: the flat back of a three-point stance is the pitch that leaves the
shoulder exactly one arm's length from a hand already on the turf, not a number anybody typed.

Two machines carry a second register at a different scale, and say so on the panel: the
receiver's route map and the kicker's flight plot are both at field scale, because a machine is
two yards tall and a route is twelve. The quarterback has no second register at all — the ball
leaves on the real parabola and exits the frame, with the range and hang time on the readout.

Every trajectory in the family is drag-free, and the plot says `DRAG-FREE` on its own axis
label. There is no air, no contact, no defender, no rule and no clock.

### Verification for these eight items

`vitest` — 41 solver tests and 31 across the seven machines. The solver: an orthonormal ball
frame at any attitude, every surface point actually on the spheroid it claims, the end-on
silhouette a circle of the waist radius with nothing along the axis, the broadside one reaching
the full length, every silhouette point's real normal perpendicular to the view (which is what
makes it the outline), the laces facing the camera at one roll and away at the opposite one,
a spiral's cone tighter than a wobble's, whole cycles repeating in both directions, the parabola
against its own closed form, forty-five degrees as the furthest range off the ground, a steeper
launch trading range for hang time, matched wheels giving no spin and the spin equal to the
surface difference over the ball's circumference, every named route with real length and the
tree mirroring on one sign, arc-length sampling clamped at both ends, the turn appearing only
near a break, the pad arm's equilibrium checked as a moment balance and its returns diminishing,
the frame held below the friction threshold, the column's segments equal with its chord at the
pitch asked for, the stance pitch putting the shoulder exactly one arm from the hand and laying
the back flat, an orthonormal head frame at any pitch, and `NaN` on every input. The machines:
the laces thinning as the ball rolls away, the end-on outline round and the broadside one long,
the hand leaving the turf when the lineman fires and only the three-point stance putting one
there, the helmet sitting lower in a stance than standing, the throwing arm moving through the
swing with the ball changing from held to away, a harder throw ranging further, the receiver's
body turning with the route and the label changing from running straight to cutting, the route
map redrawing on a new route, the kicking leg swinging and the tee disappearing at contact,
CLEARS and SHORT decided from the flight rather than declared, a punt out-hanging a placement,
the sled's returns diminishing and its frame held or sliding on the threshold, the pad count
clamped, topspin and backspin from which wheel is faster, the whole head elevating together,
every behaviour sampler at fixed phases, palette overrides, accessible labels, and every view
and variant rendering with no `NaN` in the DOM.

`tsc --noEmit`, `eslint` and `pnpm registry:build` clean, and `pnpm build` green. Driven in
Chrome at the eight docs pages: every behaviour, variant and view switched through, each machine
grabbed with a pointer and released back into its behaviour, reduced motion forced on to confirm
the loops park, the catalogue cards at 150–210px, and the pages at 390px with no horizontal
overflow.

## The radial bloom

One machine, `docs/radial-bloom.md`: a hub of telescoping rams pointed outward in one plane.
It came from a reference image of a twelve-armed starburst, and what was taken from it is
written down there — the silhouette, the proportions as ratios, the unequal spoke lengths and
the off-centre chisel point. The paint scheme, the badge around it and the mark's identity were
not taken; the component is named for its job and nothing in it, the docs, the demo label or the
catalogue line refers to a brand or a product.

The mechanism is the point. A single ram cannot show three times its retracted length without
leaving its sleeve, so each ram is four concentric stages — one fixed and three sliding, each
travelling a third of the tip's travel. Six world units of overlap remain between consecutive
stages at full extension, so the array is guided at every stroke rather than only at the ends.
The rams are built to different strokes on purpose: twelve identical telescopes cannot nest
around one hub, and that is what makes the open star ragged while the closed one stays even.

Ranks alternate `±pitch` out of the hub plane, so plan view is untouched and the array opens
into two cones once the camera tips. `strokes` takes a vector of readings and shows it as real
machined travel; a non-finite entry leaves that ram closed rather than clamping it onto the ring.

### Verification for this item

`vitest` — 11 tests: every ram driven out by a rising extension and two different rams moving
by different amounts, the tip radius measurably further out at full extension than at rest, a
stroke vector setting the ram count, `spin` turning the array, all four cameras producing
different drawings with no `NaN` in the DOM, the ram count clamped at 24 and 0 rams rendering a
bare hub, the label naming the machine, its extension and its view, the slider surface appearing
only when interactive, and a palette override landing. The behaviour samplers at fixed phases:
inside 0..1, repeating in both directions after whole cycles, `bloom` moving every ram by the
same amount while `ripple` and `index` spread them apart, and a bad clock or extension giving
the neutral pose. Plus the set-wide view harness: the plan drawing snapshotted as the one it was
designed as, and the isometric one snapshotted separately.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `pnpm build` clean. Driven in Chrome at
`/docs/radial-bloom`: every behaviour, every variant and every view switched through, the array
dragged open with a pointer and released back into its behaviour, arrow keys and Home/End, the
stroke vector, `pitch` taken to 0 and 40, reduced motion forced on to confirm the loop parks, the
catalogue card at 150px, and the page at 390px with no horizontal overflow.

### Verification for the animatronic face

`vitest`: the rig on its own — every expression resolving to finite channels, joy and sorrow
driving the lip corner opposite ways and sorrow and anger the inner brow opposite ways, doubt
coming out genuinely lopsided, intensity scaling the whole vector rather than fading it, blink
and speech composing on top of an expression instead of replacing it, an explicit channel
beating the expression on one side only, every channel clamped and junk falling back to the
documented defaults, a servo stroke per channel with the out-of-travel flag, a channel-by-
channel blend, a feature point landing on the ellipsoid and collapsing to the equator rather
than `NaN` outside the silhouette, the neck rotating a point through yaw and pitch, and the
skull's projected silhouette coming out as the exact x/y section face-on and the z/y section
side-on and turning with roll. Then the component: brows, mouth and the hinged jaw all moving
on a changed expression, the same expression at a lower intensity being a different drawing,
the two brows genuinely different under `doubt` with the camera square on, both lids closing on
a controlled blink and the pupils aiming from `look`, the skull reprojecting between views with
the far eye turning away in `profile`, sixteen push-rods and the fault lamp under a tightened
travel, and the label, a colour override and `NaN` on every numeric prop. The behaviours go
through the exported samplers: the jaw only opening while conversing, `static` parking every
axis, `emote` easing rather than cutting between expressions, and the blink staying inside
0..1 and firing irregularly. `views.test.tsx` covers all four cameras.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `next build` clean; 2302 tests pass.
Driven in a browser on desktop and at 390px: the docs page, all nine expressions, all four
behaviours, all four variants and all four views, the jaw swept 0→1, the actuator rods on, the
head tracking the pointer to ±25° and reacting to a click, and reduced motion forced on — which
parks the loop and leaves pointer tracking working. The browser caught three things the tests
could not: eyelids whose outlines read as spectacles when the eye was open (they are painted in
the band's own colour now), a jaw hinge rotating the wrong way, and a nose drawn flat on the
surface that vanished in `profile` — it has volume now, and breaks the silhouette.

## The tripod droid

Two items, `docs/tripod-droid.md`: `tripod-kinematics` and the walker on it. It came from a
reference image of a stubby, wide-bodied three-legged creature, and what was taken is written
down there — the silhouette, the proportions as ratios of the body width, the chamfered slab,
the two tall slot optics, the side nubs and the three legs in a row. No colour was sampled, no
character is reproduced, and the image is not committed anywhere in this repo.

Three legs is the mechanism, and it is the one thing no other walker here does. Every other
one stands on an even number of legs and keeps half of them planted; with six that is free,
because three feet are always down. With three it is not: lift one and the base of support
collapses from a triangle to a **segment**, so the machine has to move its own mass onto that
segment before the foot can leave the floor.

`bear-kinematics` asks the opposite question in one dimension — given a centre of mass, what is
each sole carrying. `solveTripod` runs the same relation forwards in two. A leg's load is handed
over on a ramp inside the three-foot overlap its duty cycle buys, the loads sum to one body, and
the static condition then says the centre of mass **is** the load-weighted mean of the contacts.
That mean is where the body stands, and the waddle is the consequence rather than an animation.

How far it may go is derived, not chosen: sway is whatever reach is left in a leg once a planted
foot has been paid for. `creep` fits inside it and holds a non-negative margin the whole way
round; `amble` asks the body to stand over a single foot, which it cannot reach, so the clamp
bites, the centre of mass leaves the polygon and the reported margin goes negative. Longer links
or a lower ride height buy the room back, which makes ride height a stability control rather than
a styling prop.

### Verification for this item

`vitest` — 11 solver tests: femur and tibia lengths held across every gait, height and phase;
the loads summing to one with an airborne foot carrying nothing; the body sitting exactly at the
load-weighted mean while it can reach it; `amble` losing the polygon on stubby legs and holding
it on long ones; the standing triangle with a positive margin; `pivot` turning the body and the
others leaving it alone; the heading moving the swinging foot; a lean clamped to the sway disc
and carrying the hips with it; whole cycles repeating in both directions; and garbage input
giving a neutral stance with no `NaN`. Then 9 component tests: the cycle moving the legs *and*
the body and returning after a whole cycle, the support polygon and the stability flag going
false under `amble`, a lean moving the body and the stubs, the optics aiming, invalid props
rendering the neutral stance, a colour override landing, and the slider surface appearing only
when interactive — plus the behaviour samplers and the set-wide view harness, which snapshots
the front elevation it was designed as and the isometric one separately. 2332 tests pass.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `pnpm build` clean. Driven in Chrome at
`/docs/tripod-droid`: all four views, all four variants, all five behaviours — `scurry` reporting
"off balance" for the whole cycle and `trundle` "balanced" for the whole cycle, which is the
claim the solver makes — the body dragged over its feet with a pointer and released, arrow keys
with `Home` and `End` (which pushes it forward past its forefeet and turns the lamp), reduced
motion forced on to confirm the loop parks while the keyboard still works, both catalogue cards,
and the page at 390px with no horizontal overflow.

Rendering the machine beside the reference caught what the tests could not: a panel seam under
the optics that read as a mouth, a blank flank and roof that left plan and side elevation with
nothing on them, and a side nub drawn behind the body so it vanished in profile. The browser
caught one more — mapping the drag straight onto the ground plane made the fore-and-aft axis,
which is nearly edge-on in front elevation, swing the machine end to end for a few pixels. It is
a damped least-squares solve now, anchored on the body's own centre, so a drag pushes the body
where the pointer goes from every camera, including plan view where starboard is on the other
side of the picture.

## The ribbed column

One machine on one new solver: `robot-cactus` on `cactus-geometry`. What the set did not have
is a **limb with no joints** — a continuum member that bends along its whole length and has to
stay exactly as long bent as it was straight. Design note:
[ribbed-column.md](ribbed-column.md).

The tangent angle off vertical is `θ(s) = emergence − sweep · W(s)`, where `W` is the
normalised integral of a bell centred on the elbow, and the joints are walked off that angle at
each **link's midpoint**, one fixed link at a time. Integrating the angle rather than displacing
joints is the only reason the length is exact rather than nearly exact, and `W(1) = 1` is why
`sweep === emergence` ends a limb vertical *whatever* the elbow or the spread — which is the
whole of "lift and curl" in one number. A column is `emergence 0` with a wide spread, so it
leans progressively; an arm is `emergence 88°` with a narrow one, so it leaves the trunk flat,
turns hard at one place and runs up parallel to it. One mechanism, two settings, no second
drawing.

The second new thing is a surface whose detail is part of the solve. Because a limb bends in
exactly one vertical plane its binormal is constant along it, so the frame is already
parallel-transported and a rib crest cannot drift round the limb between stations. The ribs are
a modulation of the section radius, which makes a crest a *line on the solved surface*; the
areoles sit on those crests at even arc spacing, staggered half a step on alternate ribs; and
each carries the skin's own normal with the taper leant into it (`radial − (dr/ds)·tangent`),
which is what makes the crown's spines point up and out instead of sideways. The spine fans and
the corolla are both rigid — every needle exactly its length at every splay, every petal exactly
its length at every pitch — so shutting the flower into a bud shortens the silhouette and not
the petal.

The lean is the one thing that is not a pose. The pointer and the idle wander add into one
bearing and one magnitude handed to the column's `sweep`, and the arms and the flower are
*carried* by that bend rather than aimed separately, so they cannot disagree with it. The rib
pattern is anchored to the world rather than to the bend plane, or it would spin round the
column every time the machine changed its mind about which way to lean.

Illustrated: the pot, the soil, the stamen speckle, the status lamp and the blueprint's lean
line. There is no botany — nothing grows and `bloom` is a shaped number, not a phenology.

`vitest` — 16 solver tests: the contour length exact and every link identical at five sweeps ×
three elbows; the tip vertical whenever the sweep takes back the emergence, at four elbows; the
frame orthonormal with a constant binormal; the bend confined to its own plane with no sideways
drift; an interpolated station still orthonormal; crests at every `360/ribs` with the furrows
between them; a crest standing exactly the radius off its own centreline at every station; the
ring closed and never inside the deepest furrow; the normal leaning up a taper and purely
radial without one; areoles on the crests, staggered on alternate ribs and evenly spaced within
one; rigid needles on a cone about the pad's normal with a centre needle at exactly 0°; rigid
petals at four pitches; a bud taller than it is wide and an open corolla more than twice as
wide; and garbage input giving finite geometry. Then 14 component tests: bloom moving the arms
and the corolla but *not* the column, the pointer leaning the column and carrying the arms, the
lean reported on `data-lean` and mirrored exactly either side of centre, the
rib/areole/arm/petal counts, the pot and the fans coming away, one geometry projected to two
cameras, the drag and the keyboard reporting through `onBloomChange`, the plain-image
semantics, `NaN` everywhere rendering a neutral machine, and a colour override landing — plus
the behaviour samplers, the arm-pose mapping, the two-rate wander and the pointer lean. 2312
tests pass.

`tsc --noEmit`, `eslint` and `pnpm registry:build` clean. Driven in Chrome at
`/docs/robot-cactus`: all four views, all four variants, all four behaviours, the flowering
dragged from 10% at the bottom of the frame to 92% at the top and released to ease back into
the cycle, `Home` and the arrow keys from the keyboard, reduced motion forced on to confirm the
loop parks, both catalogue cards, and the page at 390px with no horizontal overflow. Pointer
tracking was driven with real mouse moves against `data-lean`: 14.13° on bearing 69.11° at the
far left and 14.13° on −69.11° at the far right — an exact mirror — with the pull growing from
13.62° to 14.82° as the pointer came down the frame, and the machine handing itself back to the
behaviour when the pointer left. `data-lean` exists because the root group carries no transform
at rest, so there was otherwise nothing on the machine to diff attention against.

The browser caught what the tests could not: the pot drawn at the viewBox origin instead of the
machine's (`frustumPath` returns raw projected coordinates, and `at()` is what adds the origin);
per-segment silhouette hulls leaving a ladder of seams across the column, replaced by one path
walked up the extreme points of each section and back down the other side; arms bearing ±90°,
which put both of them square to the profile camera and lost them; and a viewBox half again as
wide as the machine needed, which rendered a tall thin plant small for its own `size`. The last
was a design error rather than a bug: the corolla opened its rigid blades to *flat*, which is
the obvious reading of a flower opening and is wrong for this camera — the front elevation sits
ten degrees above horizontal, so an open corolla projected to a line and the machine lost the
one event it has in its own native view. It opens into a funnel now, and the silhouette flips
from a tall narrow bud to a wide shallow cup.

### Verification for the power lantern

`vitest` over the geometry and the machine — 37 tests, and 2351 in the suite. The solver: the
assembly reassembling to the *zero vector* rather than to something small, every part exactly
its own clearance away at full travel, the teardown running in reverse fitting order and never
backwards, a strictly sequential teardown at zero overlap and a simultaneous one at full,
parts sharing a fitting order counting as one stage and leaving together, and a zero axis or a
non-finite travel degrading instead of throwing. The charge: conservation, with what leaves
the reservoir arriving in the cell less exactly what was drawn; one 2.5-unit step equal to a
thousand 2.5-millisecond ones to nine places, which is what makes a pure sampler exact; the
clamps at an empty reservoir and a full cell; nothing moving with an empty dock while the
emitter still draws; and rubbish clamped into a state that still reads. Then the recital
counting up and finishing on the last cell with the line and glyph inside their band, the
gauge fills averaging back to the level they were made from, the cage leaving a bay on the
front rather than a rib, and the beam reaching half as far at a quarter of the power.

The machine: every part moving off the assembly and every transform gone again at
`exploded={0}`; the crown leaving before the parts under it; the lid standing off its seat
whenever the bore is in use and seated when it is not; the gauge reading the reserve and the
label saying it; the ring docking, showing its own charge, and the iris closing without one;
the conduit running only while the model says charge is moving — a *full ring darkens it with
the transfer still switched on*; the beam priced by the inverse square and absent on an empty
reserve; the collar lighting a glyph at a time; one geometry differing between cameras with
the view named in the label; a rib count and a colour override landing; `NaN` everywhere
rendering a neutral machine with no `NaN` in the DOM; and the slider surface appearing only
when interactive, naming whichever channel `control` grabbed. The behaviour samplers at fixed
phases: `charge` conserving at every phase, `oath` filling the ring on the last glyph, `emit`
paying the area under its gate rather than its peak, and `service` returning to exactly zero.

`tsc --noEmit`, `eslint`, `pnpm registry:build` and `pnpm build` clean. Driven in Chrome at
`/docs/power-lantern`: all four views, all four variants, every behaviour, the machine dragged
apart to 92% and released to ease back to 0, the keyboard taking `apart` to 1, reduced motion
forced on to confirm the loop parks while the drag still works, dark mode, both catalogue
cards, and the page at 390px (the only horizontal overflow there is the site header's icon
row, which every docs page has).

The browser caught four things the tests could not: the crown lid sitting *on* the bore, so a
docked ring was invisible — the lid now stands off its seat whenever the bore is in use, and
gives way to the part's own travel once the teardown starts; a ring too small and thin to read
at the crown; an iris drawn as flat blades, which is a scribble when a disc is seen ten degrees
off edge-on, replaced by a shutter with real thickness and seam lines; and a conduit drawn over
the outside of the hood, now drawn only where it can actually be seen — up the column inside
the glass, and again in the open bore. The framing was a fifth: a fixed envelope with enough
headroom for the teardown drew the assembled machine small in its own frame, so the fit is
allowed to enlarge.

#### Reshaped to a reference

A reference photograph of a period lantern moved the form and one mechanism. The silhouette
became the marine-lamp archetype it is now — a squat barrel of ribbed prism glass in a cage of
bowed straps, between a flared foot and a stack of collars under a domed cap, on a stem and a
hanging eye — and the charge port moved from a bore in the crown to a **round boss on the
face**, which is where the reference carries its fitting and is the better place for it: the
ring now seats head-on in the machine's own view, so its charge reads as an arc of the ring
rather than as a line seen edge-on, and the iris that closes the bore reads as a diaphragm
instead of a scribble. The crown lid and its stand-off went with it; the parts list is
`base · plinth · core · cell · rib ×N · collar · hood · finial · hanger · bezel · iris · ring`,
and the teardown now has *two* fit axes — up the stack, and forward off the face.

Proportions, the ribbed barrel, the bowed straps, the collar stack, the stem and eye, and the
round port were taken in words and ratios; nothing was traced and no colour was sampled. The
machine stays an archetype named for its job.

Re-verified after the reshape: 2351 tests, `tsc --noEmit`, `eslint`, `pnpm registry:build` and
`pnpm build` all clean, and driven in Chrome at `/docs/power-lantern` again — all four views,
all four variants, the teardown to 100% in front, profile and iso, reduced motion parking the
loop, the catalogue card at 150px, and the page at 390px.

The browser caught four more: cage straps drawn as stacked arc sections, which read as a chain
of blocks rather than a bent strap, replaced by one path up each rail of the bow; those straps
collapsing to a hairline when seen edge-on, fixed by drawing the bar's other section too, so it
keeps a width from every camera; prism rings drawn as whole ellipses, which read as a coil seen
through the glass, cut back to the near half each; and the burner deck painted `dark`, which
read through the glass as something the barrel was full of. A fifth was a schedule error rather
than a drawing one: the barrel's clearance was larger than the collar's above it, so the glass
overtook the collar on the way out — clearances have to fall with removal rank or the stack
does not spread.
