---
name: fork-robot
description: Set up a fork of the robocn repository and get to the point of building a machine in it — fork, clone, install, run the docs site, and find your way around. Use when someone wants to add a robot to robocn but is not already working inside a checkout of it, or asks how to contribute a component.
---

# Fork robocn

robocn is a [shadcn registry](https://ui.shadcn.com/docs/registry) of machines that solve their
own kinematics: [robocn.dev](https://robocn.dev), MIT licensed,
[TimMikeladze/robocn](https://github.com/TimMikeladze/robocn).

Adding a machine means working **inside a checkout of the repository**, not installing a
package. The docs site and the registry are the same Next.js app, and every component lives at
the exact path a consumer installs it to — which is why the site always compiles what it ships.

If you are already in a robocn checkout, skip this and use `build-robot`.

## Before anything

Check, don't assume:

```bash
node --version     # 20 or newer
pnpm --version     # 11 or newer — corepack enable, or npm i -g pnpm
gh auth status     # optional, but it makes the fork and the PR one command each
```

## Fork and clone

With the GitHub CLI:

```bash
gh repo fork TimMikeladze/robocn --clone --remote
cd robocn
```

That leaves `origin` pointing at the fork and `upstream` at `TimMikeladze/robocn`. Without
`gh`, fork on the web, then:

```bash
git clone https://github.com/<you>/robocn.git
cd robocn
git remote add upstream https://github.com/TimMikeladze/robocn.git
```

Then:

```bash
pnpm install       # postinstall mirrors skills/ into .claude/skills and .agents/skills
pnpm dev           # if the port is taken, use another — don't kill what is running
```

`pnpm dev` runs `pnpm generate` first, which builds the gallery and workbench manifests from
`registry.json`. Open the docs site and confirm the landing page draws machines before you
change anything: a blank catalogue means `generate` did not run.

## Start from your own branch

```bash
git fetch upstream
git checkout -b <machine-name> upstream/main
```

Branch from `upstream/main`, not from a stale `origin/main`. One machine, or one closely
related pair, per branch — `publish-robot` explains why.

## What is where

```
src/lib/robocn/kinematics.ts      zero-dependency maths: FABRIK, elbow IK, FK, delta IK
src/lib/robocn/style.ts           sizes, variants, palette resolution, the view camera
src/lib/robocn/<solver>.ts        one pure solver per mechanism family
src/hooks/use-robot-motion.ts     the clock every machine runs on, and the drag handle
src/hooks/use-robot-arm.ts        the rAF pose loop for a link chain
src/components/ui/<name>.tsx      the machines — this is what installs into someone's project
src/components/demos/demos.tsx    the bench on each docs page
src/components/site/              the landing page; not registry items
registry.json                     the manifest; `pnpm registry:build` writes public/r/*.json
docs/                             design notes, one per family or per axis
skills/                           these skills
```

Everything under `src/components/ui/` may import only `@/lib/robocn/*`, `@/hooks/*`,
`@/lib/utils` and React. Anything else has to be declared in the registry entry, and usually
means the drawing is doing too much.

## Check the tree is green before you start

```bash
pnpm test
pnpm typecheck
pnpm lint
```

If something is already red on a fresh clone, that is upstream's problem, not yours — note
which files, and keep your own changes clear of them so your pull request does not appear to
own the failure.

## Then build

Use the `build-robot` skill. The short version:

```bash
pnpm robot:new <name> --description "…" --view front    # add --solver <name> for real kinematics
pnpm robot:check <name>
```

`pnpm robot:new` writes a machine that already renders and already keeps the whole
customisation contract, its tests, its registry item and its view fixture. You write the
mechanism.

## Ground rules that get pull requests turned down

- **Originality.** Science-fiction archetypes only — no franchise character names, logos, exact
  paint schemes or character-specific markings, anywhere including the demo label. Name the
  machine for its job. Reference images are frequently of copyrighted characters; ship the
  archetype, not the character, and don't commit the image.
- **Distinctness.** Say what your machine does that nothing in the set already does — a new
  mechanism, a new axis, a new view. "It looks different" is not distinctness, and the set is
  already two hundred items deep.
- **Honesty.** Draw what is solved and say what is not. An illustrated part is fine. An
  illustrated part presented as solved is not.
- **No new dependencies** in a component. The solver core is deliberately dependency-free.

## Staying current

```bash
git fetch upstream && git rebase upstream/main
pnpm install && pnpm robot:check <name>
```

Rebase rather than merge; a machine is usually a small, self-contained diff and a merge commit
in it is noise. Re-run the check after a rebase — shared helpers move.

When it works and it is verified, use `publish-robot`.
