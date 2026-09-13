# Wiring it into the site and the registry

Six files beyond the component. The registry test catches three of these omissions; the rest
are silent.

## 1. `registry.json`

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
    {
      "path": "src/components/ui/casing-droid.tsx",
      "type": "registry:ui",
      "target": "@ui/casing-droid.tsx"      // @ui/ | @lib/ | @hooks/ — required
    }
  ]
}
```

Enforced by `scripts/__tests__/registry.test.ts`:

- every declared file exists, names are unique, `description` is longer than 20 characters;
- every file has a `target` matching `^@(ui|lib|hooks)/`;
- every `registryDependencies` entry is either `{REGISTRY_URL}/r/<item in this registry>.json`
  or one of shadcn's own (`button`, `card`, `label`, `select`, `slider`);
- **every robocn file the source imports is declared.** This is the one that matters — an
  undeclared import ships an install that does not compile. It already caught `arm-controls`
  importing `robot-style` without depending on it;
- every registry item has a docs entry, and that entry's `files` are files the item owns.

`{REGISTRY_URL}` is a placeholder; `pnpm registry:build` stamps in `NEXT_PUBLIC_REGISTRY_URL`
(or Vercel's production URL) and writes `public/r/*.json`. Never hardcode the host.

npm packages go in a `dependencies` array on the item — only `robot-arm-3d` / `robot-stage`
need it (`three`, `@react-three/fiber`, `@react-three/drei`).

**Theme and keyframes ride on `robot-style`.** That item carries `cssVars` (light and dark
values for `--robot-shell`, `--robot-metal`, `--robot-dark`, `--robot-accent`, `--robot-glow`,
`--robot-grid`) and a `css` block holding `@keyframes robocn-*` (`spin`, `spray`, `spark`,
`pulse`, `scan`, `blink`), a `.robocn-*` utility class for each, and one
`@media (prefers-reduced-motion: reduce)` rule that stops them all. A new tool effect adds its
keyframe, its class and its name in that media rule, and the component depends on
`robot-style` — a `<style>` tag inside a component ships markup with no animation attached to
it.

## 2. `src/lib/docs.ts`

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
  notes: ["What the component does not do — no timers, no inferred state, original archetype."],
}
```

`group` is `"Arms" | "Machines" | "Robots" | "Foundations"` and drives the docs nav. Shared
prop blocks already exist: `palette`, `form`, `droidForm`, `loop`, `gaitLoop()`, `motion` —
spread them instead of retyping rows. Libraries and hooks use `api` instead of `props`, and
may set `item: null` for a page that installs nothing.

The docs route (`src/app/docs/[slug]/page.tsx`) is generated from this array — page, install
command, props table, source view. There is no page file to add.

## 3. `src/components/demos/demos.tsx`

A `Bench` with controls for every axis the component has, plus an entry in the `demos` map at
the bottom keyed by docs slug (libraries and hooks point at the demo of the component that
shows them off):

```tsx
function CasingDroidDemo() {
  const [pose, setPose] = React.useState<CasingDroidPose>("alert")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [dome, setDome] = React.useState(30)
  return (
    <Bench controls={<>
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="pose" value={pose} options={["idle", "alert", "extend"] as const} onChange={setPose} />
      <NumberControl label="dome" value={dome} min={-180} max={180} onChange={setDome} format={v => `${v}°`} />
    </>}>
      <CasingDroid size={300} pose={pose} domeAngle={dome} variant={variant} label="CASING / 04" />
    </Bench>
  )
}
```

Every behaviour, every view, every tool must be reachable from the demo — it is where the
component gets reviewed, by you in the browser and by everyone after.

## 4. `src/components/site/catalogue.tsx`

**Every registry item gets a card — there is no curated subset, and a test fails if one is
missing.** One entry in the `art` map, keyed by the registry item name: a one-clause `line`
and an `art` — a *posed still*, not the default pose. Pick the props that make the silhouette
legible at ~150px (`track={false}` with a fixed `look` for anything that follows the pointer,
so the card is deterministic).

The title, group and order come from `docs.ts` through the server page, so there is no title
to write here. A Foundations item is a `.ts` file: its card shows the machine that exercises
it drawn in `blueprint`. Design notes: `docs/landing-catalogue.md`.

## 5. `README.md`

One row in the "What is in it" table, same voice as the rest: what it is, what makes it
distinct.

## 6. Tests

`src/components/ui/__tests__/<collection>.test.tsx`, Testing Library + jsdom. The pattern is
render → capture a `data-*` attribute → rerender with changed props → assert it moved:

```tsx
it("poses the protocol droid and exposes its articulated joints", () => {
  const { container, rerender } = render(<ProtocolDroid pose="formal" gesture="none" />)
  const arm = container.querySelector('[data-arm="right"]')!.getAttribute("transform")

  rerender(<ProtocolDroid pose="converse" gesture="explain" exposed />)

  expect(container.querySelector('[data-arm="right"]')!.getAttribute("transform")).not.toBe(arm)
  expect(container.querySelector("[data-wiring]")).not.toBeNull()
  expect(container.querySelectorAll("[data-joint]").length).toBeGreaterThanOrEqual(6)
})
```

Cover, per machine: each controlled axis moves its mechanism; the accessible label says what
it is; invalid input (`NaN`, an out-of-range angle, a bogus union value) renders the neutral
pose instead of throwing; a colour override lands. Motion goes through the exported behaviour
samplers (see `references/motion.md`), not through faked animation frames, except where a
regression needs controlled frames — `motion.test.tsx` already has that harness.

Don't over-test. Critical paths and edge cases, not every path segment.

**Allow-list arrays.** Two tests enumerate items by name and will not notice a new one on
their own:

- `droidCollection` in `scripts/__tests__/registry.test.ts` — asserts each is one
  `registry:ui` source file at `src/components/ui/<name>.tsx`;
- `droidSlugs` in `src/components/site/__tests__/docs-catalogue.test.tsx` — asserts each has a
  docs entry, a demo, and a catalogue link to `/docs/<slug>`.

Add the new name to both. Everything else in those files is derived from `registry.json` and
`docs.ts` and needs no edit.

## Deploy

`robocn.dev`, Vercel, `linesofcode` scope, GitHub-connected auto-deploys.
`NEXT_PUBLIC_REGISTRY_URL` is set per environment and stamped into the registry JSON at build
time. `pnpm build` = `registry:build` then `next build`, so a broken registry fails the build.
