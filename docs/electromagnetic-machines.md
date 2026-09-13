# Electromagnetic machines

Twelve installable SVG machines cover electromagnetic actuation, sensing, suspension,
transmission and braking without repeating the catalogue's sealed positional servo, generic
linear actuator, mechanical grippers, gear and belt transmissions, or mobile robots. The
collection shows the mechanism that gives each device its name: windings, poles, air gaps,
armatures, contacts, rotors and targets remain visible in every paint variant.

## What ships

| Item | Mechanism | Controlled axis | Native view |
| --- | --- | --- | --- |
| `solenoid-valve` | Helical coil pulls a plunger across a valve gallery | `position` 0–1 | `profile` |
| `electromagnetic-relay` | Energized coil closes a hinged armature and contacts | `energized` 0–1 | `profile` |
| `induction-motor` | Three stator phases produce a rotating field around a cage rotor | `angle` degrees | `front` |
| `stepper-motor` | Discrete phase teeth index a permanent-magnet rotor | `step` integer | `front` |
| `voice-coil-actuator` | A coil travels axially through an annular magnet gap | `position` −1–1 | `profile` |
| `magnetic-bearing` | Opposed electromagnets center a rotor without contact | `offset` −1–1 | `front` |
| `eddy-current-brake` | A magnet array overlaps a spinning conductive disc | `engagement` 0–1 | `iso` |
| `maglev-carriage` | Lift magnets hold a carriage above a linear stator | `travel` 0–1 | `profile` |
| `magnetic-gripper` | Pole shoes energize, capture and lift a steel workpiece | `strength` 0–1 | `front` |
| `inductive-sensor` | An oscillator coil responds as a metal target enters its field | `distance` 0–1 | `profile` |
| `resolver` | A rotary transformer produces angle-dependent sine and cosine channels | `angle` degrees | `front` |
| `transformer-core` | Primary and secondary windings share an alternating core flux | `phase` 0–1 | `iso` |
| `electromagnetism-geometry` | Shared winding, phase and resolver geometry | — | — |

## Distinctness

`servo-motor` presents a closed positional actuator and horn; `induction-motor` exposes slip
between a continuous three-phase field and its squirrel cage, while `stepper-motor` exposes
phase teeth and discrete indexing. `linear-actuator` is a generic cylinder; `solenoid-valve`
shows a return spring, coil and fluid gallery, and `voice-coil-actuator` is a centred,
bidirectional moving coil with no screw or piston. `robot-gripper` and `suction-gripper` use
fingers and vacuum; `magnetic-gripper` has no moving jaw and earns its lift through energized
pole shoes. `motion-platform` mechanically supports a deck on six rods; `magnetic-bearing`
shows an unsupported rotor and opposed correction coils. `rotary-table`, `planetary-gearbox`
and `belt-drive` transmit motion; the eddy-current brake dissipates it without touching the
disc. The relay, maglev carriage, proximity sensor, resolver and transformer have no existing
catalogue counterparts.

The collection is mechanism-first rather than a set of generic field diagrams. Animated
flux marks explain which hardware is active, but the component's silhouette and moving part
remain readable when effects are disabled.

## Shared geometry and honesty

`src/lib/robocn/electromagnetism.ts` exports:

```ts
coilWinding(options): Vec3[]
threePhaseField(phase, poles): { phases: [number, number, number]; angle: number; magnitude: number }
resolverSignals(angle, excitation): { sine: number; cosine: number }
```

`coilWinding` is geometric: it samples a helix with a fixed physical envelope, so turn count
changes winding density rather than component size. `threePhaseField` performs the real vector
sum of three sinusoidal phases placed 120 electrical degrees apart. `resolverSignals` returns
the ideal sine and cosine channels of an ideal resolver. The library does not solve Maxwell's
equations, motor torque, heating, slip dynamics, levitation control, contact bounce or fluid
flow.

Flux loops, eddy marks and sensor lobes are qualitative illustrations. Their brightness and
density indicate polarity or activation only; they never claim tesla, force, torque,
temperature or calibrated distance. Documentation for every item names this limit.

## Motion and interaction

Every component follows `docs/motion-and-interaction.md`: a supplied controlled axis wins and
stops its loop; otherwise `behavior`, `speed`, `phase`, `paused` and `animate` drive the shared
clock. Each exports a pure behavior sampler. Pointer drag and arrow keys change the controlled
axis and report through its `on…Change` callback. Reduced motion parks the automatic behavior
at `phase` while leaving input active.

| Item | Behaviors | Grabbed interaction |
| --- | --- | --- |
| `solenoid-valve` | `cycle`, `pulse`, `static` | Drag the plunger; arrows move 5%, Shift 15% |
| `electromagnetic-relay` | `switch`, `pulse`, `static` | Drag/click the armature; arrows move 5% |
| `induction-motor` | `run`, `slip`, `static` | Wind the rotor around its hub; arrows turn 5° |
| `stepper-motor` | `step`, `run`, `static` | Wind or arrow between integer steps |
| `voice-coil-actuator` | `oscillate`, `pulse`, `static` | Drag the coil along its axis; arrows move 0.1 |
| `magnetic-bearing` | `balance`, `disturb`, `static` | Displace the rotor; arrows move 0.1 |
| `eddy-current-brake` | `brake`, `feather`, `static` | Move the magnet overlap; arrows move 5% |
| `maglev-carriage` | `shuttle`, `hover`, `static` | Drag along the rail; arrows move 5% |
| `magnetic-gripper` | `pick`, `hold`, `static` | Drag through field strength; arrows move 5% |
| `inductive-sensor` | `approach`, `inspect`, `static` | Drag the target; arrows change distance 5% |
| `resolver` | `turn`, `sweep`, `static` | Wind the rotor; arrows turn 5° |
| `transformer-core` | `alternate`, `pulse`, `static` | Scrub electrical phase; arrows move 5% |

## Geometry, views and hooks

Every machine is modelled once in world units and projected by `robotCamera(view)`. Circular
windings and rotor faces use `camera.wall()` or `camera.plane()` according to their physical
plane; solids use projected footprints and depth sorting. `variant` changes paint only. Every
DOM coordinate passes through `px()`, and invalid numeric input resolves to the neutral pose.

Stable hooks are part of the API:

- `solenoid-valve`: `data-coil`, `data-plunger`, `data-spring`, `data-port`, `data-flow`
- `electromagnetic-relay`: `data-coil`, `data-armature`, `data-contact`, `data-spring`
- `induction-motor`: `data-stator-phase`, `data-rotor`, `data-cage-bar`, `data-field`
- `stepper-motor`: `data-phase`, `data-rotor`, `data-tooth`, `data-index`
- `voice-coil-actuator`: `data-magnet`, `data-coil`, `data-carriage`, `data-gap`
- `magnetic-bearing`: `data-coil`, `data-rotor`, `data-gap`, `data-axis`
- `eddy-current-brake`: `data-disc`, `data-magnet`, `data-eddy`, `data-overlap`
- `maglev-carriage`: `data-track`, `data-stator`, `data-carriage`, `data-air-gap`
- `magnetic-gripper`: `data-coil`, `data-pole`, `data-workpiece`, `data-field`
- `inductive-sensor`: `data-coil`, `data-target`, `data-field`, `data-output`
- `resolver`: `data-primary`, `data-secondary`, `data-rotor`, `data-channel`
- `transformer-core`: `data-primary`, `data-secondary`, `data-core`, `data-flux`

## Integration and verification

Each component receives a registry item depending on `robot-style`, `use-robot-motion`, and
`electromagnetism-geometry` when imported. It also receives a docs record, live demo and map
entry, deterministic catalogue card, README row, motion-table row and component tests. The
new library receives its own registry item and unit tests. `docs/spec.md` gains the family in
the component table and a verification section.

Tests cover the shared mathematical invariants, the controlled axis moving the named
mechanism, controlled-over-automatic precedence, behavior sampler bounds, invalid numeric
input, accessible labels, pointer and keyboard reporting, variant palette overrides and all
four views. Verification runs the focused suite, full tests, typecheck, lint, registry build,
production build, and browser checks at desktop and 390 px with reduced motion forced on.
