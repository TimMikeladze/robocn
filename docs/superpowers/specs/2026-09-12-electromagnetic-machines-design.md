# Electromagnetic Machines Design

## Purpose

Add twelve independently installable electromagnetic machine components to robocn. The
collection gives robotics interfaces accurate, configurable drawings of the actuators,
sensors and electromechanical parts around a robot while adding no duplicate of an existing
catalogue item.

The concise family design note is `docs/electromagnetic-machines.md`. This specification fixes
the public APIs, mechanism boundaries, shared calculations, interaction rules, integrations
and acceptance criteria for implementation.

## Scope

The release contains twelve `registry:ui` items and one supporting `registry:lib` item:

| Registry item | React export | Primary use |
| --- | --- | --- |
| `solenoid-valve` | `SolenoidValve` | Fluid and pneumatic control |
| `electromagnetic-relay` | `ElectromagneticRelay` | Galvanic switching |
| `induction-motor` | `InductionMotor` | Continuous rotary drive |
| `stepper-motor` | `StepperMotor` | Discrete open-loop positioning |
| `voice-coil-actuator` | `VoiceCoilActuator` | Fast bidirectional linear motion |
| `magnetic-bearing` | `MagneticBearing` | Contactless rotor support |
| `eddy-current-brake` | `EddyCurrentBrake` | Contactless rotary braking |
| `maglev-carriage` | `MaglevCarriage` | Contactless linear transport |
| `magnetic-gripper` | `MagneticGripper` | Steel workpiece handling |
| `inductive-sensor` | `InductiveSensor` | Metal target detection |
| `resolver` | `Resolver` | Absolute rotary position sensing |
| `transformer-core` | `TransformerCore` | Coupled magnetic circuits |
| `electromagnetism-geometry` | named pure functions | Shared winding and phase geometry |

Full field simulation, dynamic motor models, force and torque output, thermal behavior,
electrical circuit solving, contact bounce, fluid simulation and closed-loop levitation are
outside this release.

## Existing-catalogue boundary

The public item names do not exist in either `registry.json` or `src/components/ui`. Their
mechanical responsibilities also stay separate:

- Existing `servo-motor` is a closed positional box with interchangeable output horns.
  `induction-motor` exposes a squirrel cage and continuous three-phase field;
  `stepper-motor` exposes toothed discrete commutation.
- Existing `linear-actuator` is an implementation-neutral cylinder. `solenoid-valve` couples
  a coil and spring to a flow gallery; `voice-coil-actuator` shows a moving coil in an annular
  magnetic gap.
- Existing `robot-gripper` and `suction-gripper` use fingers and vacuum. `magnetic-gripper`
  lifts a ferromagnetic plate through two energized pole faces without a jaw.
- Existing transmission components convey motion. `eddy-current-brake` removes motion
  without mechanical contact.
- Existing `motion-platform` supports a load on six mechanical links. `magnetic-bearing`
  centres a rotor across a visible air gap.

## Shared component contract

Every component extends `Omit<React.ComponentProps<"svg">, "color">` and
`RobotPaletteProps`, and accepts the following shared members. `SharedElectromagneticProps`
is shorthand used only in this specification; each public props interface declares these
members directly so installing one component does not require a React base-component module.

```ts
size?: RobotSize | number
variant?: RobotVariant
view?: RobotView
behavior?: ComponentBehavior
speed?: number
phase?: number
paused?: boolean
animate?: boolean
interactive?: boolean
showField?: boolean
label?: string
```

Each component defines one controlled axis and one matching callback. Passing the controlled
axis parks its automatic loop. Pointer and keyboard input always report through the callback,
including controlled mode. Uncontrolled interaction owns the visual axis until release, then
eases toward the current behavior goal through `useRobotInteraction`.

Every root is `role="img"` when static and `role="slider"`, `tabIndex={0}` with matching
`aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` when interactive. A
caller-provided `aria-label` wins over the component default. Reduced motion parks automatic
motion without disabling pointer or keyboard input.

Inputs are finite-checked before clamping or wrapping. Invalid controlled values render the
neutral pose and expose the neutral accessible value. Invalid behavior clocks return the
neutral pose. All computed SVG coordinates use `px()` before reaching the DOM.

## Supporting library

`src/lib/robocn/electromagnetism.ts` imports only plain vector types and exports:

```ts
interface CoilWindingOptions {
  turns: number
  length: number
  radius: number
  samplesPerTurn?: number
  center?: Vec3
  axis?: "x" | "y" | "z"
}

function coilWinding(options: CoilWindingOptions): Vec3[]

interface ThreePhaseField {
  phases: [number, number, number]
  angle: number
  magnitude: number
}

function threePhaseField(phase: number, poles?: number): ThreePhaseField

interface ResolverSignals {
  sine: number
  cosine: number
}

function resolverSignals(angle: number, excitation?: number): ResolverSignals
```

`coilWinding` clamps turns to 1–64, samples a helix within the exact requested length and
radius, includes both endpoints, and returns finite points for invalid options by substituting
safe defaults. `threePhaseField` calculates three sinusoidal phase amplitudes separated by
120 electrical degrees and their resultant field angle and magnitude. `resolverSignals`
returns ideal excitation-scaled sine and cosine channels. Phase and angle arguments wrap;
invalid values use zero.

The library deliberately does not export field strength, flux density, torque or force.
Components draw qualitative flux loops from their own fixed pose tables and label them as
illustrative in docs.

## Component APIs and behavior

### Solenoid valve

```ts
type SolenoidValveBehavior = "cycle" | "pulse" | "static"
interface SolenoidValveProps extends SharedElectromagneticProps {
  position?: number
  onPositionChange?: (position: number) => void
  ports?: 2 | 3
  normally?: "open" | "closed"
}
function solenoidValveGoal(behavior: SolenoidValveBehavior, clock: number): number
```

`position` 0–1 moves the plunger and compresses the return spring while switching the visible
flow path. Neutral is 0. `cycle` traverses smoothly; `pulse` holds each end with a short
transition. Hooks: `data-coil`, `data-plunger`, `data-spring`, `data-port`, `data-flow`.

### Electromagnetic relay

```ts
type ElectromagneticRelayBehavior = "switch" | "pulse" | "static"
interface ElectromagneticRelayProps extends SharedElectromagneticProps {
  energized?: number
  onEnergizedChange?: (energized: number) => void
  poles?: 1 | 2
  normally?: "open" | "closed"
}
function electromagneticRelayGoal(behavior: ElectromagneticRelayBehavior, clock: number): number
```

`energized` 0–1 pulls a hinged armature, closes or opens each contact set and extends its
return spring. Neutral is 0. Hooks: `data-coil`, `data-armature`, `data-contact`, `data-spring`.

### Induction motor

```ts
type InductionMotorBehavior = "run" | "slip" | "static"
interface InductionMotorProps extends SharedElectromagneticProps {
  angle?: number
  onAngleChange?: (angle: number) => void
  poles?: 2 | 4 | 6
  slip?: number
}
function inductionMotorGoal(behavior: InductionMotorBehavior, clock: number): number
```

`angle` is the mechanical rotor angle in degrees and wraps to 0–360. `slip` clamps to 0–0.3
and separates rotor angle from the three-phase field marker; it is illustrative timing rather
than a load model. Neutral angle is 0. Hooks: `data-stator-phase`, `data-rotor`,
`data-cage-bar`, `data-field`.

### Stepper motor

```ts
type StepperMotorBehavior = "step" | "run" | "static"
interface StepperMotorProps extends SharedElectromagneticProps {
  step?: number
  onStepChange?: (step: number) => void
  steps?: 4 | 6 | 8 | 12
  detent?: boolean
}
function stepperMotorGoal(behavior: StepperMotorBehavior, clock: number, steps: number): number
```

`step` is an integer wrapped by `steps`; the rotor moves only to the corresponding tooth
index. `step` dwells and advances one index; `run` advances continuously through discrete
indices. Neutral is index 0. Hooks: `data-phase`, `data-rotor`, `data-tooth`, `data-index`.

### Voice-coil actuator

```ts
type VoiceCoilBehavior = "oscillate" | "pulse" | "static"
interface VoiceCoilActuatorProps extends SharedElectromagneticProps {
  position?: number
  onPositionChange?: (position: number) => void
  travel?: number
}
function voiceCoilGoal(behavior: VoiceCoilBehavior, clock: number): number
```

`position` clamps to −1–1 and translates the coil and carriage through a fixed annular magnet
gap. `travel` clamps to 20–60 world units without changing the outer envelope. Neutral is 0.
Hooks: `data-magnet`, `data-coil`, `data-carriage`, `data-gap`.

### Magnetic bearing

```ts
type MagneticBearingBehavior = "balance" | "disturb" | "static"
interface MagneticBearingProps extends SharedElectromagneticProps {
  offset?: number
  onOffsetChange?: (offset: number) => void
  axis?: "x" | "y"
}
function magneticBearingGoal(behavior: MagneticBearingBehavior, clock: number): number
```

`offset` clamps to −1–1 along the selected axis. Opposing coil emphasis changes inversely as
the rotor crosses the centre, but no force value is exposed. Neutral is 0. Hooks:
`data-coil`, `data-rotor`, `data-gap`, `data-axis`.

### Eddy-current brake

```ts
type EddyCurrentBrakeBehavior = "brake" | "feather" | "static"
interface EddyCurrentBrakeProps extends SharedElectromagneticProps {
  engagement?: number
  onEngagementChange?: (engagement: number) => void
  discAngle?: number
  slots?: 0 | 6 | 12
}
function eddyBrakeGoal(behavior: EddyCurrentBrakeBehavior, clock: number): number
```

`engagement` 0–1 moves a magnet array over a conductive disc. `discAngle` wraps to 0–360 and
is independently controlled; automatic behavior rotates the disc at a visibly lower rate as
engagement grows but does not claim a physical deceleration curve. Neutral engagement is 0.
Hooks: `data-disc`, `data-magnet`, `data-eddy`, `data-overlap`.

### Maglev carriage

```ts
type MaglevCarriageBehavior = "shuttle" | "hover" | "static"
interface MaglevCarriageProps extends SharedElectromagneticProps {
  travel?: number
  onTravelChange?: (travel: number) => void
  payload?: "deck" | "bin" | "robot"
}
function maglevCarriageGoal(behavior: MaglevCarriageBehavior, clock: number): number
```

`travel` 0–1 moves the carriage along a segmented linear stator while a fixed air gap remains
visible. `hover` stays near the centre with a small axial correction. Neutral is 0.5. Hooks:
`data-track`, `data-stator`, `data-carriage`, `data-air-gap`.

### Magnetic gripper

```ts
type MagneticGripperBehavior = "pick" | "hold" | "static"
interface MagneticGripperProps extends SharedElectromagneticProps {
  strength?: number
  onStrengthChange?: (strength: number) => void
  workpiece?: "plate" | "bar" | "none"
}
function magneticGripperGoal(behavior: MagneticGripperBehavior, clock: number): number
```

`strength` 0–1 energizes two pole shoes. The workpiece remains parked below 0.5, then closes
the air gap and lifts through the second half. This threshold is a visual state machine, not
a force calculation. Neutral is 0. Hooks: `data-coil`, `data-pole`, `data-workpiece`,
`data-field`.

### Inductive sensor

```ts
type InductiveSensorBehavior = "approach" | "inspect" | "static"
interface InductiveSensorProps extends SharedElectromagneticProps {
  distance?: number
  onDistanceChange?: (distance: number) => void
  target?: "plate" | "tooth" | "none"
  range?: number
}
function inductiveSensorGoal(behavior: InductiveSensorBehavior, clock: number): number
```

`distance` 0–1 maps near-to-far across the component's fixed sensing envelope. `range` clamps
to 0.1–1 and controls only the qualitative threshold/readout. No target means no detection,
regardless of distance. Neutral distance is 1. Hooks: `data-coil`, `data-target`,
`data-field`, `data-output`.

### Resolver

```ts
type ResolverBehavior = "turn" | "sweep" | "static"
interface ResolverProps extends SharedElectromagneticProps {
  angle?: number
  onAngleChange?: (angle: number) => void
  excitation?: number
  showChannels?: boolean
}
function resolverGoal(behavior: ResolverBehavior, clock: number): number
```

`angle` wraps to 0–360 and rotates the transformer rotor. `excitation` clamps to −1–1;
channel bars come from `resolverSignals`. Neutral angle is 0. Hooks: `data-primary`,
`data-secondary`, `data-rotor`, `data-channel`.

### Transformer core

```ts
type TransformerBehavior = "alternate" | "pulse" | "static"
interface TransformerCoreProps extends SharedElectromagneticProps {
  phase?: number
  onPhaseChange?: (phase: number) => void
  core?: "ei" | "toroid"
  turns?: "step-down" | "equal" | "step-up"
}
function transformerGoal(behavior: TransformerBehavior, clock: number): number
```

`phase` wraps to 0–1 electrical cycle. Winding emphasis alternates with phase; arrow direction
reverses across the core. Turn-ratio choices change winding density while preserving the
fixed envelope. No voltage or current values are inferred. Neutral phase is 0. Hooks:
`data-primary`, `data-secondary`, `data-core`, `data-flux`.

## Visual and projection rules

Each component defines one set of world-space parts and projects them through
`robotCamera(view)`. `profile`-native components place their active axis in the x–y wall;
`front`-native components place rotor geometry in the x–y wall; `iso`-native components use
both wall and horizontal planes. Components use depth sorting when a moving part can pass in
front of a housing. The four standard variants share geometry and differ only through
`robotSurface` paint.

Coils use `coilWinding`; rotor and stator teeth derive from radial sample tables; springs use
an inline fixed-envelope polyline. Field marks are separate groups gated by `showField` and
parked under reduced motion. Every component remains mechanically legible with `showField`
false and at the 150 px catalogue-card size.

## Documentation and demos

Each `src/lib/docs.ts` record includes installation, a concise usage example, all public props,
its native view, and a note distinguishing calculated geometry from illustrative behavior.
Demos expose the controlled axis, behavior, view, variant and one mechanism-specific option.
The `demos` map receives every slug.

Catalogue cards use `animate={false}` and explicit controlled values, so SSR and client
hydration produce the same deterministic still. README rows describe the visible mechanism
rather than using generic “animated component” copy. `docs/spec.md` adds all thirteen registry
items and records the completed verification commands.

## Testing

`src/lib/robocn/__tests__/electromagnetism.test.ts` verifies:

- coil endpoints, radius, axial extent, point count and finite fallback;
- three phase separation, a near-constant ideal resultant magnitude, and expected field
  rotation over one electrical cycle;
- resolver sine/cosine quadrature, excitation scaling and finite fallback.

`src/components/ui/__tests__/electromagnetic-machines.test.tsx` verifies each component's
controlled axis changes its named `data-*` mechanism, invalid values produce the documented
neutral pose, its default and overridden labels, and its behavior sampler returns bounded
finite values. Interaction tests exercise one linear, one rotary, one discrete and one
bipolar component through keyboard input and callbacks; the shared interaction code already
covers pointer capture and easing.

The existing view snapshot matrix gains all twelve items at their native view plus `iso` or
`profile` comparison. Registry, docs and catalogue integrity tests guarantee each item is
installable and discoverable.

## Acceptance criteria

- All twelve public items and the supporting library build from the generated registry.
- No new item name or primary mechanism duplicates the existing catalogue.
- Every component satisfies palette, size, paint variant, view, motion, interaction,
  accessibility, finite-input and hydration requirements.
- Controlled props stop automatic motion and render exactly the requested bounded pose.
- Every docs page, demo route and catalogue card renders without warnings.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm registry:build` and `pnpm build` pass.
- Browser verification covers every behavior and variant, all four views, pointer and keyboard
  interaction, reduced motion, desktop layout, 390 px layout and 150 px catalogue cards.
