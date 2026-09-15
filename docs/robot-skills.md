# The robot-building skills

Four skills, in `skills/`, published from this repository and installable anywhere with

```bash
npx skills add TimMikeladze/robocn
```

They replace the single `ship-robot` skill, which had grown to a 192-line front page that sent
an agent through 11 touchpoints and ~200 KB of reading before it drew a line.

| Skill | For |
|---|---|
| `build-robot` | A new machine, end to end. The rename of `ship-robot`. |
| `refine-robot` | Changing a machine that already ships — a new axis, a new view, a fix. |
| `fork-robot` | Someone outside this repo who wants to build a machine in their own fork. |
| `publish-robot` | Walking that person through a pull request back here. |

## Why it was slow

Verification is not the problem. Measured on this tree:

| | wall clock |
|---|---|
| `pnpm generate` | 1.4 s |
| `pnpm registry:build` | 1.6 s |
| `pnpm typecheck` | 2.9 s |
| `pnpm test` (119 files, 1747 tests) | 13 s |
| `pnpm lint` | 17 s |

The cost is **agent turns**, and they went three places.

### 1. Reading before the first useful action

`ship-robot` opened with "Read first": reference images, then `docs/spec.md` (129 KB), then
`docs/motion-and-interaction.md` (22 KB), then "the nearest existing component" — which is a
search, then a 700-line file. Roughly 200 KB before any decision was made, most of it a
catalogue of 200 items that has nothing to do with the machine being built.

### 2. Wiring that the repo had already automated

The skill listed six integration files as required. Four of them are not, and have not been
since the gallery fallbacks landed — and now none of the six is hand-written at all, because
`pnpm robot:new` writes every one:

| File | Status |
|---|---|
| `registry.json` | **Required.** The only one. |
| `src/lib/docs.ts` | Optional — `generated` at the bottom of the file builds an entry from the registry item for anything unwritten. |
| `src/components/demos/demos.tsx` | Optional — `demoBySlug` falls back to `AutoDemo` over `gallery.generated.tsx`. |
| `src/components/site/catalogue.tsx` | Optional — `cardArt` falls back to `fallbackArt`, the machine's own default pose. |
| `README.md` | Optional. Prose, not a contract. |
| `src/components/ui/__tests__/…` | **Required**, by convention rather than by a test. |

`catalogue.test.tsx` enforces *resolution*, not authorship: every registry item must draw
something and have some demo. The generated path satisfies both — which is what made it safe to
have the scaffolder write real entries rather than leaving a half-wired item behind on a
failure. The instruction is now simply "run the command", and what is left for a person is the
mechanism.

The two allow-list arrays (`droidCollection`, `droidSlugs`) are per-family extra coverage, not
a gate. A machine that joins no family joins neither array.

### 3. Mechanical edits in enormous files

What is left is still real work, and all of it is templated: a registry item, a component
skeleton that keeps the whole customisation contract, the four standard behaviour tests, a
fixture in `views.test.tsx`, a docs entry, a demo bench, a card and a README row. Hand-editing
that means locating anchors in `registry.json` (164 KB), `docs.ts` (6.6k lines), `demos.tsx`
(5.4k lines), `catalogue.tsx`, `views.test.tsx` and a 49 KB README, then writing ~200 lines of
boilerplate that is identical across two hundred machines.

That is now one command.

## What changed

### `pnpm robot:new <name>`

`scripts/new-robot.mjs`. **One command, everything mechanical**, in one call:

| Written | |
|---|---|
| `src/components/ui/<name>.tsx` | A machine that renders and keeps the whole contract: palette, size, all four variants, all four views through `elevationDraft`, a controlled prop, a behaviour union with `static`, drag and arrow keys, `data-*` hooks, `role`/`aria-*`, `px()` and finite clamping — plus one visible degree of freedom to build the real geometry around |
| `src/components/ui/__tests__/<name>.test.tsx` | The four tests every machine owes, plus the behaviour samplers |
| `src/lib/robocn/<solver>.ts` + `__tests__/` | With `--solver`: a pure solver and its tests |

| Edited in place | |
|---|---|
| `registry.json` | The item — plus the solver's own `registry:lib` item |
| `views.test.tsx` | The import, the `machines` fixture and the `natives` entry |
| `src/lib/docs.ts` | The written page: usage, a props table off the shared blocks, notes |
| `src/components/demos/demos.tsx` | The import, the `Bench` with view / variant / motion controls, and the map entries |
| `src/components/site/catalogue.tsx` | The import and the landing card |
| `README.md` | The table row |

`--dry-run` prints the plan and runs every transform, so a moved anchor fails there rather than
halfway through a write. `--minimal` stops after the first five, for a machine not going on the
site yet. The command refuses to overwrite an existing machine, and transforms every file before
writing any of them.

Two invariants it had to learn, both caught by the repo's own tests while building this:

- **a docs entry's `files` must be files its own registry item owns** — a machine's page cannot
  list the solver's source, because the solver has its own entry;
- **a catalogue card must actually animate** — `catalogue-motion.test.tsx` drives real frames at
  every entry in the `art` map, so the card runs the machine's own cycle and never pins a value.

And one anchoring rule: `docs.ts` and `demos.tsx` are full of `usage:` template literals holding
sample code whose own brackets sit at column zero, so scanning *forward* for a block's closing
line lands inside a code sample. (It did: a docs entry landed inside the `assembly-geometry`
usage block.) Every insertion now names something that follows the literal and takes the last
closer before it.

### `pnpm robot:check <name>`

`scripts/check-robot.mjs`. The focused loop, ~20 s instead of a full-repo sweep:

- the machine's own test file, the registry test and the views test;
- `tsc --noEmit`;
- `eslint` over the files that changed;
- `registry:build`;
- then a report of the site wiring — docs entry, demo bench, catalogue card, README row, view
  fixture — as written or falling back. Not a gate: `robot:new` writes all five and each has a
  generated fallback, so the report exists to make a fallback a decision rather than an
  oversight.

`--full` adds the whole test suite and `next build`. Measured on a scaffolded machine: 13 s for
the focused loop, 32 s for `--full` including the production build.

### The skill front pages

`build-robot/SKILL.md` is about half the length and front-loads nothing. It opens with the
loop, lists what the one command writes so there is no touchpoint checklist to work through,
and names the exemplar to copy in a table so that picking one is a lookup rather than a search. `docs/spec.md`
is no longer in the reading path at all — it is a catalogue, and the skill needs a contract.

References load **one at a time, only when the machine has that axis**: `kinematics.md` when
there is a solver, `views.md` when it moves in space, `motion.md` when it runs itself,
`reference-images.md` when an image came with the prompt, `craft.md` before the drawing is
called finished, `polish.md` only when editing what the scaffolder wrote.

`views.md` now leads with `elevationDraft`, which is how the machines built since the walkers
are drawn and which the old reference never mentioned: write the machine once in its own
elevation, in plain drawing coordinates, and `point` / `path` / `solid` / `box` / `bar` /
`disc` give you all four cameras. The `extrudedPath` and `camera.plane` route stays, below it,
for plan-view machines.

## What was deliberately not cut

The maths is the reason the set exists, so none of it moved:

- the solver decision table, and the rule that the agent picks from it rather than asking;
- a real solver lives in `src/lib/robocn/`, pure, zero-dependency, with its own tests that run
  without React;
- seed FABRIK with the previous frame; clamp out-of-reach onto the annulus rather than
  failing; degrees on the surface, radians inside;
- finite-check and clamp every numeric input, and render a stable neutral pose for rubbish;
- `px()` on every computed coordinate, or the server and the browser disagree;
- one geometry projected through `robotCamera`, never hand-drawn per angle;
- behaviours as exported pure functions of the clock, so motion is tested by sampling rather
  than by faking frames;
- the honesty rule: say in the docs which parts are solved and which are illustrated.

The design note also stays, but its trigger narrowed: a note is owed when a **new solver** or a
**new axis** ships, not for every machine. A machine on an existing solver is a paragraph in
the commit message.

## Layout, and how it publishes

```
skills/
  build-robot/SKILL.md      + references/{component,craft,kinematics,motion,views,reference-images,polish}.md
  refine-robot/SKILL.md     + references/site.md
  fork-robot/SKILL.md
  publish-robot/SKILL.md
```

`skills/` at the repository root is what the `skills` CLI walks, so
`npx skills add TimMikeladze/robocn` offers all four and installs to whichever agent the
person runs. `SKILL.md` frontmatter needs `name` and `description` and nothing else.

`scripts/setup-skills.mjs` mirrors `skills/` into `.claude/skills/` and `.agents/skills/` on
`postinstall`, so this repository's own agents see them without a second copy in git. Both
mirrors are ignored; `skills/` is the source of truth.

## The workbench brief

`New` in the workbench writes a brief that names the skill, so it moved with the rename — and
it now forks on whether the file exists. The workbench has two paths: holding a folder it
writes `src/components/ui/<slug>.tsx` itself from `draftSource`, and without one it asks the
agent to create it. `pnpm robot:new` refuses to overwrite a machine that is already there, so a
brief that unconditionally said "run `pnpm robot:new`" would dead-end the folder path on its
first command. `newRobotPrompt` takes `drafted`, which the dialog sets from
`written || onDisk`: fresh, the brief sends the agent to the scaffolder; drafted, it sends them
straight to the mechanism and the registry entry. Both ends say `pnpm robot:check <slug>`.
