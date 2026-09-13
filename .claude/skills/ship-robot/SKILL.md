---
name: ship-robot
description: Ship a robot component in robocn end to end — pose solver, SVG geometry, camera angles, colour/size/variant customisation, self-running motion, pointer and keyboard interaction, registry entry, docs page, demo, catalogue card, README row, tests, and verification. Accepts optional reference images (a photo, render, concept art, or several angles of one subject) as the spec. Use when adding or changing anything under src/components/ui, src/lib/robocn, src/hooks, src/components/site, or registry.json, or when an image of a robot is pasted with a build request.
---

# Ship a robot end to end

A robot is not shipped when it renders. It is shipped when it installs into a stranger's
project from the registry, themes itself, animates itself, can be grabbed, has a docs page
with a working demo, and has tests that fail if any of that breaks.

Eleven touchpoints. Miss one and the failure is silent — a broken install, an undocumented
item, a demo that 404s.

| # | Touchpoint | File |
|---|---|---|
| 1 | Design note | `docs/<topic>.md` — new family or new axis only |
| 2 | Solver, if the mechanism has real kinematics | `src/lib/robocn/<name>.ts` + `__tests__/` |
| 3 | Component | `src/components/ui/<name>.tsx` |
| 4 | Behaviour samplers, exported | same file |
| 5 | Registry item | `registry.json` |
| 6 | Docs entry | `src/lib/docs.ts` |
| 7 | Demo + `demos` map entry | `src/components/demos/demos.tsx` |
| 8 | Catalogue card — **required, the landing page shows every item** | `src/components/site/catalogue.tsx` |
| 9 | README row | `README.md` |
| 10 | Tests (+ any allow-list array a new item belongs in) | `src/components/ui/__tests__/…` |
| 11 | Verification | tests, typecheck, lint, registry build, browser |

## Inputs

The prompt is usually short and may carry **optional reference images** — a photo, a render,
concept art, a toy, or several angles of one subject. Both paths are normal:

- **No image.** The prompt names the machine or the family ("create robotic animals"). Go
  straight to the design note and pick the archetypes yourself.
- **With images.** They are the spec. Read them for silhouette, proportions, degrees of
  freedom, panel roles and signature details — never trace, never sample colours, never ship
  a character. Several angles of one subject mean the `view` axis, not several components.
  Full procedure, including the originality filter and the extra verification pass:
  `references/reference-images.md`.

An image of *our own site or a component* is feedback, not a subject — fix what it points at
rather than building something new. When both readings are live, say which you took in one
line and carry on.

## Order of work

1. **Read first.** Any reference images, then `docs/spec.md` (the contract),
   `docs/motion-and-interaction.md` (how machines move and get grabbed), then the nearest
   existing component — a fully posed one
   (`medical-droid.tsx`), a self-running grabbable one (`servo-motor.tsx`), a multi-angle one
   (`robot-drone.tsx`). Copy their shape; every machine in the set reads the same way on
   purpose.
2. **Pick the solver yourself.** Decide from the mechanism, don't ask: real kinematics
   (chains, delta, Stewart, legs) gets a solver in `src/lib/robocn/` with its own registry
   item and tests; anything else gets a pose table in the component. Inventing IK for a
   machine that does not have it is worse than a table. `references/kinematics.md` has the
   decision table.
3. **Design note** for a new family or a new axis, before code: what ships, what makes each
   machine distinct from what already exists, the shared contract, the `data-*` hooks, the
   integration list. Working from references, it also records what was taken from them — in
   words, proportions as ratios, and the originality constraint. Never embed or commit the
   images themselves. Decision-dense, not a template — `docs/sci-fi-icon-droids.md` and
   `docs/drone-views.md` are the size and tone.
4. **Test, then build, one machine at a time.** Write the failing behaviour test, run it, see
   the missing-module failure, implement, run the focused test, commit that machine. Two
   machines per commit at most — `docs/superpowers/plans/2026-09-12-droid-collection.md` is
   the worked example of the loop.
5. **Wire it in** — all six integration files, in one pass, before moving to the next machine.
   Half-wired items are what the registry and catalogue tests exist to catch.
6. **Verify, then `/ship`.**

## The contract every machine keeps

Non-negotiable, because learning one component has to teach all of them:

- **Colour.** `shell` `metal` `dark` `accent` (+ `glow` `grid` `foreground`), each resolving
  prop → CSS variable → built-in. Never hardcode a colour; take it from
  `resolveRobotPalette()` and paint through `robotSurface(role, variant, palette, weight)`.
- **Size.** `size?: RobotSize | number`. Geometry lives in world units inside a fixed
  `viewBox`; size only scales, never re-lays-out.
- **Form.** `variant: "solid" | "outline" | "blueprint" | "wire"` changes paint only, never
  geometry.
- **Views.** Every machine with a body in space takes `view: "plan" | "front" | "profile" |
  "iso"`, defaulting to the view it was designed in. Model the geometry once in world units
  and push it through `robotCamera(view)` — never redraw per angle. Instruments and panels
  that are not objects in space (a polar display, a loader, a control panel) are the
  exception, and the design note says so.
- **Motion.** Controlled prop wins and stops the loop; otherwise `behavior` (a per-component
  union that always includes `"static"`) runs it, scaled by `speed`, offset by `phase`, frozen
  by `paused`, parked by `animate={false}` or reduced motion.
- **Interaction.** `interactive` hands the machine to a person: pointer drag, arrow keys,
  `on…Change` throughout. Release eases back into the behaviour, rate-limited.
- **Honesty.** One geometry, projected — never hand-faked artwork per angle. Every numeric
  input finite-checked and clamped; invalid input renders a stable neutral pose. Never invent
  data (a lidar does not clamp a bad return onto the ring). Say in the docs `notes` which
  parts are solved and which are illustrated.
- **Accessibility.** `role="img"` + overridable `aria-label`; interactive machines are
  `role="slider"` with `tabIndex=0` and `aria-valuemin/max/now/text`. Reduced motion parks
  loops and never disables input.
- **Hydration.** Every computed coordinate through `px()`.
- **Test hooks.** A stable `data-*` attribute on every mechanism.
- **Originality.** Science-fiction archetypes only — no franchise names, logos, exact paint
  schemes or character markings, anywhere including demo labels. Name the machine for its job.

## Detail

- `references/component.md` — component skeleton, prop conventions, drawing helpers,
  `data-*` naming, when maths earns its own lib file.
- `references/reference-images.md` — turning a pasted image into a component: triage, what
  to extract, colour as a role map, the originality filter, comparing the render back.
- `references/craft.md` — making it look like machinery: silhouette, proportion, visible
  degrees of freedom, the four variants, effects and keyframes, distinctness, originality.
- `references/motion.md` — the three motion rules, `use-robot-motion` API, behaviour samplers
  as pure functions, drag/keyboard/a11y wiring.
- `references/kinematics.md` — which solver to reach for, the `kinematics.ts` API, seeding and
  reach clamping, `useRobotArm` / `useEasedPoint` / `usePointerTarget`, how to test a solver.
- `references/views.md` — one machine from `plan`, `front`, `profile`, `iso` via
  `robotCamera`; extrusions, draw order, and the 3D (r3f) path.
- `references/integration.md` — registry entry, docs entry, demo, catalogue, README, and the
  invariants the registry test enforces.
- `references/site.md` — landing-page work: the 2D↔3D wipe, the full catalogue, per-frame
  rules, gating, WebGL traps.

## Traps that have already cost time here

- **Undeclared registry import** → an install that does not compile. The registry test catches
  it; it caught `arm-controls` importing `robot-style` without depending on it.
- **Unrounded trigonometry** → hydration mismatch. Node and the browser differ in the last
  bits. `px()` before the DOM.
- **Pose lagging one render behind a changed `links` prop** — derive from props, don't cache
  across renders without syncing.
- **Parts drawn inside other parts** (delta motors inside the plate) — only visible in a
  browser, which is why "driven in a browser" is in the checklist.
- **`onDrag` / `toWorld` not wrapped in `useCallback`** → listeners rebind every render.
- **Missing `touch-none`** → the browser scrolls instead of dragging.
- **three.js cannot read CSS variables**, and Chrome serialises computed `var()` colours as
  `lab()`. Go through `resolveCssColor`, or the theme is silently ignored.
- **React Compiler is on.** In r3f code hoist per-frame scratch objects to module scope, take
  the camera from `useFrame((state) => …)`, don't hand-wrap ref-reading getters in
  `useCallback`.
- **Allow-list arrays.** `droidCollection` in `scripts/__tests__/registry.test.ts` and
  `droidSlugs` in `src/components/site/__tests__/docs-catalogue.test.tsx` list items by name.
  A new droid goes in both.
- **A registry item with no catalogue card** fails
  `src/components/site/__tests__/catalogue.test.tsx`. There is no curated landing grid to opt
  into any more — every item is on the page.
- **`AGENTS.md` is rewritten by `next dev`.** Commit the change with your work; deleting it
  from the diff just recreates it.

## Verify before claiming it is done

```bash
pnpm vitest run src/components/ui/__tests__/<collection>.test.tsx   # focused, while building
pnpm test          # everything, including registry + docs integrity
pnpm typecheck
pnpm lint
pnpm registry:build
pnpm build         # registry, then next build
```

Then drive it in a browser (`pnpm dev`; if the port is taken, use another — don't kill what is
running): the docs page, every `behavior`, every variant, every view, grabbed with a mouse and
with touch emulation, reduced motion forced on to confirm the loops park, and at 390px. With a
reference image, screenshot the demo at the reference's angle and compare — silhouette and
proportions first, detail last, and check the 150px catalogue card too. UI
work gets the browser agent, not a guess. Report what actually ran; "should work" is not done.

Update `docs/spec.md`'s item table and verification section when the set grows.

## Checklist

```
- [ ] reference images read for silhouette, proportions, DOFs, panel roles (if any given);
      archetype only, no character names or paint schemes; images left uncommitted
- [ ] design note (new family or new axis only)
- [ ] solver + solver tests (only if there is real kinematics)
- [ ] component: palette, size, variant, view, behavior, interactive, data-*, role/aria,
      px(), finite-clamped inputs, all four variants and all four views checked
- [ ] behaviour samplers exported as pure functions of the clock
- [ ] registry.json item: type, title, description >20 chars, categories, target, every
      robocn import declared in registryDependencies
- [ ] docs entry in src/lib/docs.ts: slug, item, group, files, usage, props, notes
- [ ] demo reaching every axis, view control included + entry in the `demos` map
- [ ] catalogue card with a deterministic posed still (no item may be missing one)
- [ ] README row
- [ ] tests: controlled props move the mechanism, invalid input is neutral, label is right;
      name added to any allow-list array
- [ ] pnpm test / typecheck / lint / registry:build / build all green
- [ ] driven in a browser, desktop and 390px, reduced motion checked
- [ ] rendered beside the reference at its angle and at 150px (if any given)
```
