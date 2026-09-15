---
name: build-robot
description: Build a new machine in robocn — solver, geometry, four camera angles, self-running motion, pointer and keyboard interaction, registry entry and tests. Accepts reference images (a photo, render, concept art, or several angles of one subject) as the spec. Use when adding a machine under src/components/ui or a solver under src/lib/robocn, or when an image of a robot arrives with a build request.
---

# Build a robot

A machine is not a drawing that moves. It is a mechanism whose pose is *solved*, drawn once in
world units and projected, that installs into a stranger's project from the registry and
themes itself there.

Do not read `docs/spec.md`. It is a catalogue of two hundred items, not a contract — this file
is the contract.

## The loop

```bash
pnpm robot:new <name> --description "…" --view front        # add --solver <name> if it has real kinematics
# write the solver, then the geometry
pnpm robot:check <name>
pnpm og --only <name>                                       # the social card — seconds, and always
```

1. **Scaffold.** One command writes everything mechanical, and what it emits already renders,
   already passes its tests, and is already on the site. Start here; never hand-write any of it.
   `--dry-run` to see the plan first.
2. **Read one exemplar**, from the table below. One file, not a search.
3. **Solver first, if there is one.** Decide from the table under *Kinematics*; do not ask.
   Write its test, watch it fail, implement, watch it pass.
4. **Then the geometry.** Replace the scaffold's mast-and-boom with the real machine. Every
   degree of freedom has to be visibly mechanical.
5. **`pnpm robot:check <name>`** — about ten seconds. `--full` before you ship.
6. **Drive it in a browser** once the shape is right, and only then claim it is done.
7. **Capture its social card** — `pnpm og --only <name>`, once the drawing is final. Part of
   building a machine, not a maintainer chore to defer: see *The card* below.

## The card

`pnpm og --only <name>` photographs `/og/<name>`, writes `public/og/<name>.png` and adds the
slug to `src/lib/og.generated.ts`. Both files are committed with the machine.

- **Always, and last.** A page with no card of its own falls back to the twelve-machine contact
  sheet, so a machine that ships without one is invisible in every Slack, iMessage and tweet its
  link lands in. Take it after the geometry is final — a card of a half-drawn machine is a
  capture you will only take again.
- **Seconds, not minutes.** About five, against the `pnpm dev` you already have up; the script
  reuses that server and starts one only if there is none. Several machines in one run:
  `pnpm og --only <a>,<b>,<c>`. **Never the bare `pnpm og`** — that is 200-odd captures and a
  quarter of an hour, and nothing about a new machine needs the other 200 retaken.
- **It needs the app to compile**, because the card is a screenshot of a real page. A `GET
  /og/pages — 500` means the dev server is red, not that the card is unavailable.
- **macOS + Chrome.** If Chrome is not installed, say the card was not taken — do not report the
  machine as finished with the step quietly dropped.

The composition itself takes no work: `src/components/site/og-item-card.tsx` draws every card
from the catalogue pose you already set, so posing that card poses this one. Notes:
`docs/per-page-og-images.md`.

## What the one command writes

| File | What lands in it |
|---|---|
| `src/components/ui/<name>.tsx` | The machine, keeping the whole contract |
| `src/components/ui/__tests__/<name>.test.tsx` | The four tests every machine owes, plus the behaviour samplers |
| `src/lib/robocn/<solver>.ts` + `__tests__/` | With `--solver`: a pure solver and its tests |
| `registry.json` | The item — the one thing that makes it installable |
| `views.test.tsx` | The four-camera fixture and its native view |
| `src/lib/docs.ts` | The written docs page: usage, a props table, notes |
| `src/components/demos/demos.tsx` | The bench, with view / variant / motion controls |
| `src/components/site/catalogue.tsx` | The landing card |
| `README.md` | The table row |

So there is no wiring pass and no checklist of touchpoints. What is left for you is the
**mechanism**: the solver, the geometry, and replacing the TODOs the scaffold leaves — the file
header, the docs `notes`, a demo control per axis you add, and posing the catalogue card for
150px.

`--minimal` stops after the first five, for a machine that is not going on the site yet. Every
one of the last four also has a generated fallback in the repo, so a machine is never invisible
even if one is missing; `pnpm robot:check` reports which are written and which are falling back.
`references/polish.md` has the shapes if you need to write one by hand.

A **design note** in `docs/` is owed when a **new solver** or a **new axis** ships — what it
solves, what makes it distinct, the shared contract, the `data-*` hooks. Not for a machine on
a solver that already exists; that is a paragraph in the commit message.
`docs/armoured-walkers.md` is the size and tone.

## Copy the nearest one

| Building | Read |
|---|---|
| A machine drawn in elevation — a rig, a tower, a stack, most machinery | `src/components/ui/flare-stack.tsx` (350 lines, the shortest complete one) |
| A posed machine, every mechanism driven by a prop, no loop | `src/components/ui/medical-droid.tsx` |
| Self-running and grabbable, one scalar | `src/components/ui/servo-motor.tsx` |
| A solved chain reaching for something | `src/components/ui/robot-mantis.tsx` |
| Legs, gait, a support polygon | `src/components/ui/scout-walker.tsx` + `src/lib/robocn/walker.ts` |
| A body of revolution, a shell, a lattice | `src/components/ui/robot-strawberry.tsx` |
| Drawn in plan — rover, drone, spider, table | `src/components/ui/robot-drone.tsx` |

## Kinematics — pick it yourself

Read the mechanism, take a row, say in one line what you took and why, and build. The cost of
choosing wrong is small; the cost of stopping to ask is the whole turn.

| Mechanism | Use |
|---|---|
| 1 link | `solveChain2` — direction × length |
| 2 links | `solveElbow2` / `solveElbow3` — law of cosines: cheap, stable, the pose people expect |
| 3+ links | `solveChain2/3` → FABRIK, **seeded with the previous frame** |
| Delta | `solveDelta(target, geometry)` — closed form |
| Gantry / cartesian | nothing; position directly with `useEasedPoint(…, { perAxis: true })` |
| Stewart / hexapod | `solveStewart(pose, geometry)` |
| Legs | `quadruped.ts`, `walker.ts`, `tripod.ts`, `hexapod.ts` |
| None of these | a pose table in the component — inventing IK for a machine that has none is worse |

A solver that is real kinematics someone could reuse gets `src/lib/robocn/<name>.ts`, its own
registry item and its own tests: pure functions over plain objects, no React, no three.js, no
dependencies. Details and the test list: `references/kinematics.md`.

## The contract every machine keeps

Non-negotiable, because learning one component has to teach all of them. The scaffold already
holds all of it — the point is not to break it.

- **Colour.** `shell` `metal` `dark` `accent` (+ `glow` `grid` `foreground`), each resolving
  prop → CSS variable → built-in. Never hardcode a colour: take it from
  `resolveRobotPalette()` and paint through `robotSurface(role, variant, palette, weight)`.
- **Size.** `size?: RobotSize | number`. Geometry in world units inside a fixed `viewBox`;
  size only scales, never re-lays-out.
- **Form.** `variant: "solid" | "outline" | "blueprint" | "wire"` changes paint only, never
  geometry. Blueprint's annotation layer is the one additive exception.
- **Views.** Anything with a body in space takes `view`, defaulting to the view it was drawn
  in. Model once, project through `robotCamera` — never redraw per angle. Instruments that are
  not objects in space (a polar display, a loader, a control panel) are exempt, and the design
  note says so.
- **Motion.** A controlled prop wins and stops the loop. Otherwise `behavior` — a per-component
  union that always includes `"static"` — runs it, scaled by `speed`, offset by `phase`, frozen
  by `paused`, parked by `animate={false}` or reduced motion. Every behaviour is an **exported
  pure function of the clock**, so it is tested by sampling rather than by faking frames.
- **Interaction.** `interactive` hands the machine to a person: pointer drag, arrow keys,
  `on…Change` throughout. Release eases back into the behaviour, rate-limited. Never gate a
  drag on hover, or touch cannot reach it.
- **Honesty.** One geometry, projected. Every numeric input finite-checked and clamped; rubbish
  renders a stable neutral pose rather than throwing. Never invent data — a lidar does not
  clamp a bad return onto the ring. Say in the docs `notes` which parts are solved and which
  are illustrated. An illustrated part is fine; an illustrated part presented as solved is not.
- **Accessibility.** `role="img"` + overridable `aria-label` naming the machine and its view;
  interactive machines are `role="slider"` with `tabIndex=0` and `aria-valuemin/max/now/text`.
  Reduced motion parks loops and never disables input.
- **Hydration.** Every computed coordinate through `px()`.
- **Test hooks.** A stable `data-*` attribute per mechanism, named for the mechanism.
- **Originality.** Science-fiction archetypes only — no franchise names, logos, exact paint
  schemes or character markings, anywhere including demo labels. Name it for its job.

## Reference images

Optional. With none, go straight to building. With them, they are the spec: read them for
silhouette, proportions, degrees of freedom, panel roles and signature details — never trace,
never sample colours, never ship a character. Several angles of one subject mean the `view`
axis, not several components. An image of *our own site or a component* is feedback, not a
subject. Full procedure: `references/reference-images.md`.

## References — load one, when the machine has that axis

- `references/kinematics.md` — the solver API, seeding, reach clamping, the hooks, how to test one.
- `references/views.md` — `elevationDraft` first: write the machine once in its own elevation
  and get all four cameras. Then the plan-view route.
- `references/motion.md` — the three motion rules, `use-robot-motion`, drag and keyboard wiring.
- `references/component.md` — prop conventions, drawing vocabulary, `data-*` naming.
- `references/craft.md` — making it read as machinery: silhouette, proportion, the four variants.
- `references/reference-images.md` — turning a pasted image into a machine.
- `references/polish.md` — editing the docs entry, demo bench and catalogue card the scaffolder wrote, and the two invariants they have to keep.

## Traps that have already cost time here

- **Undeclared registry import** → an install that does not compile. `pnpm robot:check` catches it.
- **Unrounded trigonometry** → hydration mismatch. `px()` before the DOM.
- **Pose lagging one render behind a changed prop** — derive from props, don't cache across renders.
- **Parts drawn inside other parts** — only visible in a browser, which is why the browser step exists.
- **`onDrag` / `toWorld` not in `useCallback`** → listeners rebind every render.
- **Missing `touch-none`** → the browser scrolls instead of dragging.
- **A knee solved in the plane of the step rather than the plane of the machine** — a foot
  passing under its own hip throws the knee forward and the leg reads as a broken chair.
- **three.js cannot read CSS variables**, and Chrome serialises computed `var()` as `lab()`.
  Go through `resolveCssColor`, or the theme is silently ignored.
- **React Compiler is on.** In r3f code hoist per-frame scratch objects to module scope, take
  the camera from `useFrame((state) => …)`, don't hand-wrap ref-reading getters in `useCallback`.
- **`AGENTS.md` is rewritten by `next dev`.** Commit the change with your work.

## Verify

```bash
pnpm robot:check <name>           # ~10 s: generate, focused tests, typecheck, lint, registry
pnpm robot:check <name> --full    # adds the whole suite and next build — once, before shipping
pnpm og --only <name>             # ~5 s: the machine's social card, once the drawing is final
```

Then drive it (`pnpm dev`; if the port is taken use another — don't kill what is running): the
docs page, every `behavior`, every variant, every view, grabbed with a mouse and with touch
emulation, reduced motion forced on to confirm the loops park, and at 390px. With a reference
image, screenshot the demo at the reference's angle and compare — silhouette and proportions
first, detail last — and check the 150px catalogue card. UI work gets the browser agent, not a
guess.

`git status` before you call it done: the diff carries `public/og/<name>.png` and
`src/lib/og.generated.ts` as well as the machine. If either is missing, the card step did not
run.

Report what actually ran. "Should work" is not done.
