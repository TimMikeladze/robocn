# Droid Collection Design

## Purpose

Add a broad set of original science-fiction droid archetypes to robocn. The collection should evoke familiar robot roles—astromech utility unit, rolling orb companion, protocol humanoid, security humanoid, medical assistant, infantry unit, hovering probe, and compact courier—without reproducing named characters or protected markings.

## Public components

The collection adds eight independently installable procedural SVG components:

| Registry item | React component | Core controls |
|---|---|---|
| `utility-droid` | `UtilityDroid` | `series`, `dome`, `legMode`, `headAngle`, `tool`, `toolExtension`, `signal` |
| `orb-droid` | `OrbDroid` | `headAngle`, `bodyAngle`, `look`, `track`, `antenna`, `signal` |
| `protocol-droid` | `ProtocolDroid` | `pose`, `headAngle`, `gesture`, `exposed`, `signal` |
| `security-droid` | `SecurityDroid` | `pose`, `headAngle`, `look`, `track`, `alert`, `signal` |
| `medical-droid` | `MedicalDroid` | `headAngle`, `leftTool`, `rightTool`, `diagnostic`, `signal` |
| `infantry-droid` | `InfantryDroid` | `frame`, `pose`, `headAngle`, `equipment`, `signal` |
| `probe-droid` | `ProbeDroid` | `hover`, `scanAngle`, `appendages`, `active`, `signal` |
| `courier-droid` | `CourierDroid` | `heading`, `steering`, `travel`, `cargo`, `antenna`, `signal` |

Every component also accepts the shared robocn `size`, `variant`, palette props, `showGround`, and `label`, plus ordinary SVG props. Numeric inputs are finite-checked and clamped or wrapped to the range the drawing can represent.

## Visual language

The components use the existing `robot-style` palette and surface helpers. Silhouettes communicate function before decoration:

- Utility: cylindrical body, rotating dome, radial tool ports, stabilizing legs.
- Orb: large segmented rolling shell with a separately stabilized cap.
- Protocol: narrow humanoid frame, visible joint rings, formal upright posture.
- Security: tall shoulders, long limbs, narrow sensor bar, guarded stance.
- Medical: clinical torso, diagnostic face, modular instrument arms.
- Infantry: economical skeletal frame or armored heavy frame, compact equipment module.
- Probe: floating sensor pod with asymmetrical lenses and hanging manipulators.
- Courier: low rectangular chassis, wheels, mast antenna, optional cargo pod.

No component uses franchise names, logos, exact paint schemes, or character-specific surface details. Examples use robocn's orange/teal default and neutral alternatives.

## Behavior and accessibility

All motion is controlled by props. Components do not create their own animation loops. Orb and security gaze may optionally use the existing `usePointerTarget` hook; setting `look` overrides pointer tracking. Active scans use the existing reduced-motion-aware registry animation classes.

Each root SVG has `role="img"` and a useful default `aria-label`; callers can override the label through standard SVG props. Mechanical subassemblies expose stable `data-*` hooks so tests and consumers can inspect behavior without relying on path geometry.

## Registry and documentation

Every component gets:

- a `registry:ui` entry with exact internal registry dependencies;
- a documentation record with usage, props, and mechanical notes;
- a live demo with controls for its defining behaviors;
- a catalogue card and README table row;
- component tests covering controlled pose changes, variants, and accessibility.

The registry build remains the integration boundary: generated install payloads must contain the component source and every robocn dependency imported by that source.

## Testing and verification

Component tests render real SVG output and assert observable structure and pose changes. Registry integrity tests verify install metadata. The final verification suite is `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm registry:build`, and `pnpm build`.
