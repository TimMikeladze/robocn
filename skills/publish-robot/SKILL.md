---
name: publish-robot
description: Take a finished machine from a robocn fork to a pull request against TimMikeladze/robocn — final verification, the screenshots, the commit, the branch, and the PR body. Use when a robot is built and working and the next step is contributing it back, or when someone asks how to submit their component.
---

# Publish a robot

A pull request here is judged on three things, in this order: **does it install**, **is the
mechanism real**, and **does it earn its place** next to two hundred machines that already
exist. Everything below is in service of answering those before a reviewer has to ask.

Do not open the pull request until the verification section has actually run. A PR that fails
`pnpm build` costs the maintainer a round trip and you a day.

## 1. Verify, for real

```bash
pnpm robot:check <name> --full
```

That runs `generate`, the whole test suite, `typecheck`, `lint`, `registry:build` and
`next build`. All of it has to be green. If something unrelated to your machine is red, check
whether it was red before your branch:

```bash
git stash && pnpm test ; git stash pop
```

Say so in the PR body if it was. Do not fix unrelated breakage in the same pull request.

Then drive it in a browser (`pnpm dev`; if the port is taken use another — don't kill what is
running) and confirm, with your own eyes:

- every `behavior`, including `static`;
- all four variants — `solid`, `outline`, `blueprint`, `wire`;
- all four views, if it has a body in space;
- grabbed with a mouse **and** with touch emulation, if it is `interactive`;
- reduced motion forced on: loops park, input still works;
- the docs page at 390px, and the catalogue card at 150px.

The 150px card is where a bad silhouette shows up. If the machine is unrecognisable there, the
proportions are wrong — fix the ratios in world units, not the detail.

## 2. Check what the reviewer will check

- **Install.** Every robocn file your component imports is declared in its
  `registryDependencies`. The registry test enforces it; an undeclared import ships an install
  that does not compile.
- **The contract.** Palette through `resolveRobotPalette` and `robotSurface` — no hardcoded
  colour anywhere. `size` scales and never re-lays-out. `variant` changes paint and never
  geometry. `px()` on every computed coordinate. Every numeric input finite-checked and
  clamped, with a stable neutral pose for rubbish. `role`/`aria-label`, and
  `role="slider"` + `aria-value*` if interactive.
- **One geometry, projected.** Not four drawings. A machine with hand-drawn per-angle artwork
  will be sent back.
- **Originality.** No franchise names, logos, paint schemes or character markings — in the
  component name, the docs, the demo `label` or the `aria-label`. Name the machine for its job.
  No third-party reference image committed anywhere in the diff.
- **Tests that would fail if the machine broke.** Controlled props move the mechanism; rubbish
  input renders neutral; the label names the machine and its view; a colour override lands; the
  behaviour samplers are exercised as pure functions. Not a snapshot of everything.
- **A solver, if it claims one.** In `src/lib/robocn/`, pure, dependency-free, with its own
  tests that run without React. Link lengths preserved, out-of-reach clamped rather than
  `NaN`, FK/IK round trip, neutral pose for non-finite input.

## 3. Screenshots

Every pull request that adds or changes a drawing carries pictures. Reviewers cannot run every
branch.

- the docs demo at a representative pose;
- the four variants side by side, or the four views if the change is about the camera;
- the 150px catalogue card;
- for a reference-image build, the render beside the reference, at the reference's angle.

`pnpm shots` builds the repo's own screenshots; for a PR, a browser screenshot of your docs
page is enough. Put them in the PR body, not in the repo — do not commit screenshots of your
own machine to `docs/screenshots/`, that directory is the site's.

## 4. Clean the diff

```bash
git status
git diff --stat
```

- **One machine, or one closely related pair, per pull request.** The scout walker and the
  siege walker shipped together because they are the same solver answering two leg counts.
  Two unrelated machines are two pull requests.
- **No unrelated formatting.** If your editor reflowed a file you did not mean to touch,
  `git checkout --` it.
- **`AGENTS.md` is rewritten by `next dev`.** If it is in your diff, commit it with the work —
  deleting it from the diff just recreates the uncommitted change.
- **The social card is in.** `public/og/<name>.png` and the `src/lib/og.generated.ts` line that
  claims it are committed, like the component. Missing means `pnpm og --only <name>` never ran
  and the docs page will link with the contact sheet instead of the machine.
- **Generated files stay out.** `public/r/`, `src/components/site/gallery.generated.tsx`,
  `src/components/workbench/registry.generated.tsx`, `src/lib/workbench/generated.json` and
  `*.tsbuildinfo` are all ignored. If one is in `git status`, something is wrong.
- **View snapshots that moved for machines you did not touch** mean you changed a shared
  helper. Either that was intended — say so in the PR body — or back the change out.

## 5. Commit

Conventional commits, lower case after the type, and a body that says what the machine *is*
rather than what files you added:

```
feat: add the scout walker and the siege walker

Two machines on the walker solver, and the contrast between them is the
point. The biped stands on one foot for most of its cycle, so it rolls the
whole cab over the leg that stays put; the quadruped's four feet already
contain its mass, so it walks nearly level — until it paces, and the
support is a line down one flank it cannot roll far enough to reach.
```

`feat:` for a new machine or axis, `fix:` for a drawing or solver correction, `docs:` for a
design note. A machine on an existing solver does not need a design note in `docs/` — this
commit body is where it is explained. A **new solver or a new axis** does: what it solves, what
makes it distinct, the shared contract, the `data-*` hooks.

## 6. Open the pull request

```bash
git push -u origin <branch>
gh pr create --repo TimMikeladze/robocn --base main --web
```

`--web` so you can paste screenshots. The body wants:

```markdown
## What it is
One paragraph: the machine, and the one thing it does that nothing in the set already does.

## The mechanism
What is solved and what is illustrated — explicitly. If there is a new solver, what it solves
and why the mechanism has real kinematics rather than a pose table.

## Axes
The props, and what each one moves.

## Screenshots
Docs demo · four variants · four views · the 150px card.

## Verification
- [ ] `pnpm robot:check <name> --full` green
- [ ] `pnpm og --only <name>` run, card and manifest line committed
- [ ] driven in a browser: every behavior, variant and view
- [ ] grabbed with mouse and touch, reduced motion parks the loops
- [ ] reads at 390px and at 150px
- [ ] archetype only — no franchise names, logos or paint schemes; no reference image committed

## Notes
Anything that was already red on `upstream/main`, any shared helper you touched and the view
snapshots that moved because of it, and anything you decided not to do.
```

## After it is open

- Reviews here are about the mechanism, not style. "Make this a real hinge", "this degree of
  freedom is not visible", "the silhouette reads as the courier droid at 150px" are the usual
  ones. Fix and push to the same branch; don't force-push over review comments.
- If a rebase is asked for: `git fetch upstream && git rebase upstream/main`, then re-run
  `pnpm robot:check <name> --full`, because shared helpers move.
- The repo is MIT licensed. Opening the pull request contributes your component under it.

Report what actually ran and what you actually saw. "Should work" is not done.
