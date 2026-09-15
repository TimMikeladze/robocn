# The site wiring

`pnpm robot:new` writes all of this — the docs entry, the demo bench, the catalogue card and
the README row — along with the component, its tests and the registry item. **You do not need
this file to ship a machine.** It is here for two cases:

- you are **editing** what the scaffolder wrote — adding a control for an axis you invented,
  posing the card for 150px, filling the docs `notes`;
- you are working on a machine that predates the command, or one scaffolded with `--minimal`.

Each of these also has a generated fallback in the repo, so a machine is never invisible
without them: `docs.ts` has `generated`, `catalogue.tsx` has `fallbackArt`, `demoBySlug` falls
back to `AutoDemo`, and `catalogue.test.tsx` enforces *resolution*, not authorship.
`pnpm robot:check <name>` reports which are written and which are falling back.

## What the fallback gives you, if you are on one

| | Fallback | Written version buys |
|---|---|---|
| Docs page | `generated` in `src/lib/docs.ts` builds an entry from the registry title and description | a props table, usage, `notes`, and the right group |
| Demo | `demoBySlug` falls back to `AutoDemo` over `gallery.generated.tsx` — the machine with a variant and view switch | a control for every axis, which is where the machine gets reviewed |
| Catalogue card | `cardArt` falls back to `fallbackArt` — the machine's own default pose at 150px | a deterministic posed still chosen to read at that size |
| README row | nothing | the one clause that says why it exists |

## Two invariants the scaffolder learned the hard way

- **A docs entry's `files` must be files its own registry item owns.** `registry.test.ts`
  checks it, so a machine's page cannot list the solver's source — the solver's own entry does.
- **A catalogue card must actually animate.** `catalogue-motion.test.tsx` drives real frames at
  every entry in the `art` map and fails one that draws the same picture twice, because a
  pinned value prop is indistinguishable from configuration in the source. Pose a card with
  props that do not stop the loop; never `animate={false}` or a pinned controlled value there.

## 1. `src/lib/docs.ts`

```ts
{
  slug: "casing-droid", item: "casing-droid", title: "Casing droid", group: "Robots",
  summary: "One sentence a stranger can read on a card.",
  files: ["components/ui/casing-droid.tsx"],        // relative to src/, shown under "Source"
  usage: `import { CasingDroid } from "@/components/ui/casing-droid"

<CasingDroid pose="alert" domeAngle={40} />`,
  props: [
    { name: "pose", type: '"idle" | "alert" | "extend"', default: '"idle"', description: "Whole-body posture." },
    ...droidForm,        // size, variant, showGround, signal, label, and the palette rows
  ],
  notes: ["What it does not do — no timers, no inferred state, original archetype."],
}
```

`group` is `"Arms" | "Machines" | "Robots" | "Foundations"` and drives the docs nav. Shared
prop blocks already exist — `palette`, `form`, `droidForm`, `loop`, `gaitLoop()`, `motion` —
spread them instead of retyping rows. Libraries and hooks use `api` instead of `props`, and may
set `item: null` for a page that installs nothing.

The docs route is generated from this array. There is no page file to add.

## 2. `src/components/demos/demos.tsx`

A `Bench` with a control for every axis, plus an entry in the `demos` map at the bottom keyed
by docs slug. Libraries and hooks point at the demo of the component that shows them off.

```tsx
function CasingDroidDemo() {
  const [pose, setPose] = React.useState<CasingDroidPose>("alert")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [dome, setDome] = React.useState(30)
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="pose" value={pose} options={["idle", "alert", "extend"] as const} onChange={setPose} />
      <NumberControl label="dome" value={dome} min={-180} max={180} onChange={setDome} format={(v) => `${v}°`} />
    </>}>
      <CasingDroid size={300} pose={pose} domeAngle={dome} variant={variant} label="CASING / 04" />
    </Bench>
  )
}
```

Every behaviour, every view and every tool must be reachable from it — this is where the
machine gets reviewed, by you in the browser and by everyone after.

## 3. `src/components/site/catalogue.tsx`

One entry in the `art` map, keyed by the registry item name: a one-clause `line` and a **posed
still**, not the default pose. Pick props that make the silhouette legible at ~150px
(`track={false}` with a fixed `look` for anything that follows the pointer, so the card is
deterministic). A Foundations item is a `.ts` file: its card shows the machine that exercises
it, drawn in `blueprint`.

The title, group and order come from `docs.ts` through the server page, so there is no title to
write here. `catalogue-motion.test.tsx` drives frames at every card and fails one that draws
the same picture twice, so nothing in the map may be fully pinned.

## 4. `README.md`

One row in the "What is in it" table, in the same voice as the rest: what it is, and what makes
it distinct.

## 5. The family allow-lists

Two tests enumerate items by name for extra per-family coverage:

- `droidCollection` in `scripts/__tests__/registry.test.ts` — asserts each is one
  `registry:ui` source file at `src/components/ui/<name>.tsx`;
- `droidSlugs` in `src/components/site/__tests__/docs-catalogue.test.tsx` — asserts each has a
  docs entry, a demo, and a catalogue link.

These are **not a gate**. A machine that joins a family should join both arrays; one that
starts a family of its own joins neither. Everything else in those files is derived from
`registry.json` and `docs.ts` and needs no edit.

## The registry item, for when it needs changing by hand

```jsonc
{
  "name": "casing-droid",
  "type": "registry:ui",                    // registry:ui | registry:lib | registry:hook
  "title": "Casing droid",
  "description": "An armoured conical casing unit with a rotating dome, elevating eyestalk, and swappable manipulator.",
  "categories": ["robotics", "robots"],
  "registryDependencies": [
    "{REGISTRY_URL}/r/robot-style.json",
    "{REGISTRY_URL}/r/robot-kinematics.json"
  ],
  "files": [
    { "path": "src/components/ui/casing-droid.tsx", "type": "registry:ui", "target": "@ui/casing-droid.tsx" }
  ]
}
```

`scripts/__tests__/registry.test.ts` enforces: every declared file exists; names are unique;
`description` is longer than 20 characters; every file has a `target` matching
`^@(ui|lib|hooks)/`; every `registryDependencies` entry is either
`{REGISTRY_URL}/r/<item in this registry>.json` or one of shadcn's own (`button`, `card`,
`label`, `select`, `slider`); and — the one that matters — **every robocn file the source
imports is declared**. An undeclared import ships an install that does not compile.

`{REGISTRY_URL}` is a placeholder; `pnpm registry:build` stamps in `NEXT_PUBLIC_REGISTRY_URL`
(or Vercel's production URL) and writes `public/r/*.json`. Never hardcode the host. npm packages
go in a `dependencies` array on the item.

**Theme and keyframes ride on `robot-style`.** That item carries `cssVars` for both schemes and
a `css` block holding `@keyframes robocn-*` (`spin`, `spray`, `spark`, `pulse`, `scan`,
`blink`), a `.robocn-*` utility class for each, and one
`@media (prefers-reduced-motion: reduce)` rule that stops them all. A new tool effect adds its
keyframe, its class and its name in that media rule — a `<style>` tag inside a component ships
markup with no animation attached to it.

## Deploy

`robocn.dev`, Vercel, `linesofcode` scope, GitHub-connected auto-deploys.
`NEXT_PUBLIC_REGISTRY_URL` is set per environment and stamped into the registry JSON at build
time. `pnpm build` = `generate`, `registry:build`, then `next build`, so a broken registry
fails the build.
