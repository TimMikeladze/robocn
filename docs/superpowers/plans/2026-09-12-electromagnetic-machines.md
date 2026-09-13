# Electromagnetic Machines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship twelve distinct electromagnetic machine components and their shared geometry as installable, documented, interactive robocn registry items.

**Architecture:** A zero-React geometry module calculates winding points, three-phase vectors and resolver channels. Each visual component is an independent client-side SVG that imports the existing palette, projection and motion contracts, owns one controlled axis, and is integrated immediately into the registry, docs, demo map, catalogue, README and view matrix.

**Tech Stack:** React 19, TypeScript 5, SVG, Next.js 16 App Router, Vitest, Testing Library, shadcn registry format

**Spec:** `docs/superpowers/specs/2026-09-12-electromagnetic-machines-design.md`

## Global Constraints

- Add exactly twelve UI items: `solenoid-valve`, `electromagnetic-relay`, `induction-motor`, `stepper-motor`, `voice-coil-actuator`, `magnetic-bearing`, `eddy-current-brake`, `maglev-carriage`, `magnetic-gripper`, `inductive-sensor`, `resolver`, and `transformer-core`.
- Add one supporting registry library named `electromagnetism-geometry` at `src/lib/robocn/electromagnetism.ts`.
- Every component accepts all shared palette props, `size`, `variant`, `view`, `behavior`, `speed`, `phase`, `paused`, `animate`, `interactive`, `showField`, and `label`.
- Controlled values win over automatic motion; invalid numbers render each component's documented neutral pose.
- Every component projects one geometry through `robotCamera(view)` and supports `plan`, `front`, `profile`, and `iso`.
- Field marks are qualitative illustrations and expose no invented force, torque, flux-density, temperature, voltage, current or calibrated distance.
- Every component is registered, documented, demoed, catalogued, listed in README and covered by the view matrix before the next pair begins.
- Preserve all pre-existing uncommitted work; commits contain only files or hunks belonging to this collection.

---

### Task 1: Electromagnetic geometry

**Files:**
- Create: `src/lib/robocn/electromagnetism.ts`
- Create: `src/lib/robocn/__tests__/electromagnetism.test.ts`
- Modify: `registry.json`
- Modify: `src/lib/docs.ts`
- Modify: `src/components/demos/demos.tsx`
- Modify: `src/components/site/catalogue.tsx`
- Modify: `README.md`
- Modify: `docs/spec.md`

**Interfaces:**
- Consumes: `Vec3` from `src/lib/robocn/kinematics.ts`.
- Produces: `coilWinding(options): Vec3[]`, `threePhaseField(phase, poles): ThreePhaseField`, and `resolverSignals(angle, excitation): ResolverSignals`.

- [ ] **Step 1: Write the failing geometry tests**

```ts
expect(coilWinding({ turns: 4, length: 20, radius: 5 })).toHaveLength(4 * 8 + 1)
expect(threePhaseField(0).phases).toHaveLength(3)
expect(resolverSignals(90)).toMatchObject({ sine: 1, cosine: 0 })
```

- [ ] **Step 2: Run `pnpm vitest run src/lib/robocn/__tests__/electromagnetism.test.ts` and confirm the missing-module failure**
- [ ] **Step 3: Implement finite defaults, clamped winding samples, three-phase vector summation and ideal resolver quadrature**
- [ ] **Step 4: Re-run the focused test and confirm it passes**
- [ ] **Step 5: Add the registry, docs, demo, catalogue, README and spec entries for `electromagnetism-geometry`; use an induction-motor blueprint still for nonvisual library art**
- [ ] **Step 6: Run registry and catalogue integrity tests**
- [ ] **Step 7: Commit with `feat: add electromagnetic geometry`**

### Task 2: Solenoid valve and electromagnetic relay

**Files:**
- Create: `src/components/ui/solenoid-valve.tsx`
- Create: `src/components/ui/electromagnetic-relay.tsx`
- Create: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`
- Modify: `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `SolenoidValve`, `solenoidValveGoal`, `ElectromagneticRelay`, and `electromagneticRelayGoal` with the props fixed by the design specification.

- [ ] **Step 1: Add failing tests that rerender each controlled axis and assert changes on `[data-plunger]` and `[data-armature]`; assert invalid values match neutral transforms**
- [ ] **Step 2: Run the focused component test and confirm both missing-module failures**
- [ ] **Step 3: Implement the solenoid with a sampled winding, translating plunger, compressing spring, selected ports and visible flow route**
- [ ] **Step 4: Run the solenoid tests and confirm they pass while the relay still fails to import**
- [ ] **Step 5: Implement the relay with winding, hinged armature, one or two contact sets and normally-open/closed inversion**
- [ ] **Step 6: Run the pair's tests and confirm they pass**
- [ ] **Step 7: Wire both items through all integration files and add native/profile plus tipped/iso view coverage**
- [ ] **Step 8: Run focused, registry, docs and catalogue tests**
- [ ] **Step 9: Commit with `feat: add solenoid and relay machines`**

### Task 3: Induction and stepper motors

**Files:**
- Create: `src/components/ui/induction-motor.tsx`
- Create: `src/components/ui/stepper-motor.tsx`
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`, `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `InductionMotor`, `inductionMotorGoal`, `StepperMotor`, and `stepperMotorGoal`.
- Consumes: `threePhaseField` and `coilWinding` from `electromagnetism-geometry`.

- [ ] **Step 1: Add failing tests for rotor rotation, phase teeth, integer step wrapping, behavior bounds and invalid neutral values**
- [ ] **Step 2: Run the focused tests and verify missing-module failures**
- [ ] **Step 3: Implement the induction motor's stator phases, cage bars, rotor and slip-separated field marker**
- [ ] **Step 4: Run induction tests to green**
- [ ] **Step 5: Implement the stepper's radial stator teeth, phase groups, indexed rotor and optional detent ring**
- [ ] **Step 6: Run pair tests to green**
- [ ] **Step 7: Integrate both registry items, docs, demos, catalogue stills, README rows, spec rows, motion table and view matrix**
- [ ] **Step 8: Run focused and integration tests**
- [ ] **Step 9: Commit with `feat: add induction and stepper motors`**

### Task 4: Voice-coil actuator and magnetic bearing

**Files:**
- Create: `src/components/ui/voice-coil-actuator.tsx`
- Create: `src/components/ui/magnetic-bearing.tsx`
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`, `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `VoiceCoilActuator`, `voiceCoilGoal`, `MagneticBearing`, and `magneticBearingGoal`.

- [ ] **Step 1: Add failing tests for bipolar carriage translation, bearing offset, opposing coil emphasis, accessible values and neutral fallback**
- [ ] **Step 2: Verify missing-module failures**
- [ ] **Step 3: Implement the voice coil with a fixed annular gap and bounded travel**
- [ ] **Step 4: Run voice-coil tests to green**
- [ ] **Step 5: Implement the bearing with a suspended rotor, four pole pieces, selected displacement axis and qualitative correction emphasis**
- [ ] **Step 6: Run pair tests to green**
- [ ] **Step 7: Complete every integration touchpoint and view entry for both items**
- [ ] **Step 8: Run focused and integration tests**
- [ ] **Step 9: Commit with `feat: add voice coil and magnetic bearing`**

### Task 5: Eddy-current brake and maglev carriage

**Files:**
- Create: `src/components/ui/eddy-current-brake.tsx`
- Create: `src/components/ui/maglev-carriage.tsx`
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`, `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `EddyCurrentBrake`, `eddyBrakeGoal`, `MaglevCarriage`, and `maglevCarriageGoal`.

- [ ] **Step 1: Add failing tests for magnet overlap, optional disc slots, carriage travel, invariant air gap and invalid neutral values**
- [ ] **Step 2: Verify missing-module failures**
- [ ] **Step 3: Implement the brake disc, moving magnet array, qualitative eddy marks and independently controlled disc angle**
- [ ] **Step 4: Run brake tests to green**
- [ ] **Step 5: Implement the segmented linear stator, hovering carriage and payload choices**
- [ ] **Step 6: Run pair tests to green**
- [ ] **Step 7: Complete every integration touchpoint and view entry for both items**
- [ ] **Step 8: Run focused and integration tests**
- [ ] **Step 9: Commit with `feat: add eddy brake and maglev carriage`**

### Task 6: Magnetic gripper and inductive sensor

**Files:**
- Create: `src/components/ui/magnetic-gripper.tsx`
- Create: `src/components/ui/inductive-sensor.tsx`
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`, `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `MagneticGripper`, `magneticGripperGoal`, `InductiveSensor`, and `inductiveSensorGoal`.

- [ ] **Step 1: Add failing tests for strength-dependent workpiece capture, absent workpieces, target distance, no-target detection and finite fallbacks**
- [ ] **Step 2: Verify missing-module failures**
- [ ] **Step 3: Implement two energized pole shoes and the documented visual capture state machine**
- [ ] **Step 4: Run gripper tests to green**
- [ ] **Step 5: Implement the threaded sensor body, oscillator coil, movable target, qualitative lobe and threshold output**
- [ ] **Step 6: Run pair tests to green**
- [ ] **Step 7: Complete every integration touchpoint and view entry for both items**
- [ ] **Step 8: Run focused and integration tests**
- [ ] **Step 9: Commit with `feat: add magnetic gripper and inductive sensor`**

### Task 7: Resolver and transformer core

**Files:**
- Create: `src/components/ui/resolver.tsx`
- Create: `src/components/ui/transformer-core.tsx`
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`, `registry.json`, `src/lib/docs.ts`, `src/components/demos/demos.tsx`, `src/components/site/catalogue.tsx`, `README.md`, `docs/spec.md`, `docs/motion-and-interaction.md`, `src/components/ui/__tests__/views.test.tsx`, `src/components/site/__tests__/docs-catalogue.test.tsx`

**Interfaces:**
- Produces: `Resolver`, `resolverGoal`, `TransformerCore`, and `transformerGoal`.
- Consumes: `resolverSignals` and `coilWinding` from `electromagnetism-geometry`.

- [ ] **Step 1: Add failing tests for rotor angle, sine/cosine channels, electrical phase, turn-ratio geometry and invalid neutral values**
- [ ] **Step 2: Verify missing-module failures**
- [ ] **Step 3: Implement the resolver's primary rotor, quadrature secondaries and optional channel bars**
- [ ] **Step 4: Run resolver tests to green**
- [ ] **Step 5: Implement EI and toroid core geometry with phase-directed illustrative flux and ratio-specific winding densities**
- [ ] **Step 6: Run pair tests to green**
- [ ] **Step 7: Complete every integration touchpoint and view entry for both items**
- [ ] **Step 8: Run focused and integration tests**
- [ ] **Step 9: Commit with `feat: add resolver and transformer core`**

### Task 8: Interaction and complete verification

**Files:**
- Modify: `src/components/ui/__tests__/electromagnetic-machines.test.tsx`
- Modify: `docs/spec.md`
- Modify generated view snapshots under `src/components/ui/__tests__/__snapshots__/views/`

**Interfaces:**
- Verifies the public contracts produced in Tasks 1–7.

- [ ] **Step 1: Add keyboard callback tests for a linear axis, rotary axis, discrete index and bipolar axis**
- [ ] **Step 2: Run focused tests and verify any missing interaction behavior fails**
- [ ] **Step 3: Implement only the missing pointer/keyboard behavior needed to make those public tests pass**
- [ ] **Step 4: Run `pnpm vitest run src/components/ui/__tests__/electromagnetic-machines.test.tsx src/lib/robocn/__tests__/electromagnetism.test.ts src/components/ui/__tests__/views.test.tsx`**
- [ ] **Step 5: Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm registry:build`, and `pnpm build`**
- [ ] **Step 6: Start `pnpm dev` on an unused port and drive every docs page at desktop and 390 px; exercise every behavior, view, variant, pointer/keyboard input and reduced motion**
- [ ] **Step 7: Inspect all twelve 150 px catalogue cards for clipping, indistinct silhouettes and hydration warnings**
- [ ] **Step 8: Record the actual verification results in `docs/spec.md`**
- [ ] **Step 9: Commit with `test: verify electromagnetic machines`**
