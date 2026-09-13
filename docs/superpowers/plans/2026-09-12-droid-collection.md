# Droid Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship eight original, configurable science-fiction droid families as tested robocn registry components with complete demos and documentation.

**Architecture:** Each droid is an independently installable procedural SVG component built from the existing palette, size, and surface helpers. Interactive gaze reuses `usePointerTarget`; all other motion is controlled directly by props, and stable semantic `data-*` hooks expose each mechanism for tests and consumers.

**Tech Stack:** React 19, TypeScript 5, SVG, Next.js 16 App Router, Vitest, Testing Library, shadcn registry format

**Spec:** `docs/superpowers/specs/2026-09-12-droid-collection-design.md`

## Global Constraints

- Use original archetypes; do not use franchise character names, logos, exact paint schemes, or character-specific markings.
- Every component accepts `size`, `variant`, shared palette props, `showGround`, `label`, and ordinary SVG props.
- Every numeric input is finite-checked and clamped or wrapped to the visual range.
- Motion is controlled by props; components create no timers or animation loops.
- Every SVG has `role="img"` and an overridable accessible name.
- Every registry item declares every robocn file it imports.

---

### Task 1: Utility and orb droids

**Files:**
- Create: `src/components/ui/utility-droid.tsx`
- Create: `src/components/ui/orb-droid.tsx`
- Create: `src/components/ui/__tests__/droid-collection.test.tsx`

**Interfaces:**
- Consumes: `resolveRobotPalette`, `resolveRobotSize`, `robotSurface`, and palette/style types from `@/lib/robocn/style`; `usePointerTarget` and `Vec2` for orb gaze.
- Produces: `UtilityDroidProps`, `UtilityDroid`, `OrbDroidProps`, and `OrbDroid`.

- [ ] **Step 1: Write the failing behavior tests**

```tsx
it("changes the utility dome and deployed tool from controlled props", () => {
  const { container, rerender } = render(<UtilityDroid headAngle={0} tool="interface" toolExtension={0} />)
  const dome = container.querySelector("[data-dome]")!.getAttribute("transform")
  rerender(<UtilityDroid headAngle={45} tool="gripper" toolExtension={1} />)
  expect(container.querySelector("[data-dome]")!.getAttribute("transform")).not.toBe(dome)
  expect(container.querySelector('[data-tool="gripper"]')).not.toBeNull()
})

it("rotates the orb shell independently from its stabilized head", () => {
  const { container, rerender } = render(<OrbDroid track={false} bodyAngle={0} headAngle={0} />)
  const shell = container.querySelector("[data-body]")!.getAttribute("transform")
  const head = container.querySelector("[data-head]")!.getAttribute("transform")
  rerender(<OrbDroid track={false} bodyAngle={90} headAngle={30} />)
  expect(container.querySelector("[data-body]")!.getAttribute("transform")).not.toBe(shell)
  expect(container.querySelector("[data-head]")!.getAttribute("transform")).not.toBe(head)
})
```

- [ ] **Step 2: Run tests and verify missing-module failures**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

- [ ] **Step 3: Implement the two component APIs**

```ts
type UtilityDroidSeries = "workshop" | "navigator" | "rescue"
type UtilityDroidTool = "none" | "interface" | "gripper" | "scanner"
type UtilityDroidLegMode = "two" | "three"

interface UtilityDroidProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  series?: UtilityDroidSeries
  dome?: "round" | "flat" | "faceted"
  legMode?: UtilityDroidLegMode
  headAngle?: number
  tool?: UtilityDroidTool
  toolExtension?: number
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}

interface OrbDroidProps extends Omit<React.ComponentProps<"svg">, "color">, RobotPaletteProps {
  size?: RobotSize | number
  variant?: RobotVariant
  headAngle?: number
  bodyAngle?: number
  look?: Vec2 | null
  track?: boolean
  antenna?: "single" | "twin" | "none"
  signal?: "idle" | "ready" | "warning"
  showGround?: boolean
  label?: string
}
```

Draw a cylindrical utility body with `data-dome`, two/three leg layouts, and `data-tool`; draw a segmented `data-body` orb with an independently transformed `data-head` and controlled/tracked eye.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

```bash
git add src/components/ui/utility-droid.tsx src/components/ui/orb-droid.tsx src/components/ui/__tests__/droid-collection.test.tsx
git commit -m "feat: add utility and orb droids"
```

### Task 2: Protocol and security droids

**Files:**
- Create: `src/components/ui/protocol-droid.tsx`
- Create: `src/components/ui/security-droid.tsx`
- Modify: `src/components/ui/__tests__/droid-collection.test.tsx`

**Interfaces:**
- Consumes: existing style helpers; `usePointerTarget` and `Vec2` for security gaze.
- Produces: `ProtocolDroidProps`, `ProtocolDroid`, `SecurityDroidProps`, and `SecurityDroid`.

- [ ] **Step 1: Add failing humanoid behavior tests**

```tsx
it("poses the protocol droid and exposes its articulated joints", () => {
  const { container, rerender } = render(<ProtocolDroid pose="formal" gesture="none" />)
  const arm = container.querySelector('[data-arm="right"]')!.getAttribute("transform")
  rerender(<ProtocolDroid pose="converse" gesture="explain" exposed />)
  expect(container.querySelector('[data-arm="right"]')!.getAttribute("transform")).not.toBe(arm)
  expect(container.querySelector("[data-wiring]")).not.toBeNull()
})

it("changes security posture and alert sensor state", () => {
  const { container, rerender } = render(<SecurityDroid track={false} pose="stand" alert={false} />)
  const stance = container.querySelector("[data-frame]")!.getAttribute("transform")
  rerender(<SecurityDroid track={false} pose="patrol" alert />)
  expect(container.querySelector("[data-frame]")!.getAttribute("transform")).not.toBe(stance)
  expect(container.querySelector("[data-alert]")).not.toBeNull()
})
```

- [ ] **Step 2: Run tests and verify missing-module failures**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

- [ ] **Step 3: Implement the two humanoid APIs**

```ts
interface ProtocolDroidProps extends SharedDroidSvgProps {
  pose?: "formal" | "converse" | "cautious"
  headAngle?: number
  gesture?: "none" | "explain" | "greet" | "point"
  exposed?: boolean
  signal?: DroidSignal
}

interface SecurityDroidProps extends SharedDroidSvgProps {
  pose?: "stand" | "patrol" | "guard"
  headAngle?: number
  look?: Vec2 | null
  track?: boolean
  alert?: boolean
  signal?: DroidSignal
}
```

Keep the protocol silhouette narrow and jointed with optional `data-wiring`; make security taller and angular with a tracked sensor bar, `data-frame`, and `data-alert`.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

```bash
git add src/components/ui/protocol-droid.tsx src/components/ui/security-droid.tsx src/components/ui/__tests__/droid-collection.test.tsx
git commit -m "feat: add protocol and security droids"
```

### Task 3: Medical and infantry droids

**Files:**
- Create: `src/components/ui/medical-droid.tsx`
- Create: `src/components/ui/infantry-droid.tsx`
- Modify: `src/components/ui/__tests__/droid-collection.test.tsx`

**Interfaces:**
- Consumes: existing style helpers and shared SVG prop conventions.
- Produces: `MedicalDroidProps`, `MedicalDroid`, `InfantryDroidProps`, and `InfantryDroid`.

- [ ] **Step 1: Add failing specialist behavior tests**

```tsx
it("renders selected medical tools and diagnostic level", () => {
  const { container, rerender } = render(<MedicalDroid leftTool="scanner" rightTool="injector" diagnostic={0.2} />)
  expect(container.querySelector('[data-tool="scanner"]')).not.toBeNull()
  const meter = container.querySelector("[data-diagnostic]")!.getAttribute("width")
  rerender(<MedicalDroid leftTool="clamp" rightTool="probe" diagnostic={0.9} />)
  expect(container.querySelector("[data-diagnostic]")!.getAttribute("width")).not.toBe(meter)
})

it("supports light and heavy infantry frames with controlled poses", () => {
  const { container, rerender } = render(<InfantryDroid frame="light" pose="march" equipment="pack" />)
  expect(container.querySelector('[data-frame="light"]')).not.toBeNull()
  rerender(<InfantryDroid frame="heavy" pose="guard" equipment="shield" />)
  expect(container.querySelector('[data-frame="heavy"]')).not.toBeNull()
  expect(container.querySelector('[data-equipment="shield"]')).not.toBeNull()
})
```

- [ ] **Step 2: Run tests and verify missing-module failures**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

- [ ] **Step 3: Implement the specialist APIs**

```ts
type MedicalTool = "none" | "scanner" | "injector" | "clamp" | "probe"

interface MedicalDroidProps extends SharedDroidSvgProps {
  headAngle?: number
  leftTool?: MedicalTool
  rightTool?: MedicalTool
  diagnostic?: number
  signal?: DroidSignal
}

interface InfantryDroidProps extends SharedDroidSvgProps {
  frame?: "light" | "heavy"
  pose?: "stand" | "march" | "guard" | "disabled"
  headAngle?: number
  equipment?: "none" | "pack" | "scanner" | "shield"
  signal?: DroidSignal
}
```

Render medical modular instrument ends and a bounded `data-diagnostic` meter. Render skeletal and armored infantry frames with semantic equipment and no projectile effects.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

```bash
git add src/components/ui/medical-droid.tsx src/components/ui/infantry-droid.tsx src/components/ui/__tests__/droid-collection.test.tsx
git commit -m "feat: add medical and infantry droids"
```

### Task 4: Probe and courier droids

**Files:**
- Create: `src/components/ui/probe-droid.tsx`
- Create: `src/components/ui/courier-droid.tsx`
- Modify: `src/components/ui/__tests__/droid-collection.test.tsx`

**Interfaces:**
- Consumes: existing style helpers and shared SVG prop conventions.
- Produces: `ProbeDroidProps`, `ProbeDroid`, `CourierDroidProps`, and `CourierDroid`.

- [ ] **Step 1: Add failing mobile behavior tests**

```tsx
it("controls probe hover, scanner, and appendage count", () => {
  const { container, rerender } = render(<ProbeDroid hover={0} scanAngle={-20} appendages={3} />)
  const pod = container.querySelector("[data-pod]")!.getAttribute("transform")
  expect(container.querySelectorAll("[data-appendage]")).toHaveLength(3)
  rerender(<ProbeDroid hover={1} scanAngle={20} appendages={6} active />)
  expect(container.querySelector("[data-pod]")!.getAttribute("transform")).not.toBe(pod)
  expect(container.querySelectorAll("[data-appendage]")).toHaveLength(6)
})

it("steers the courier wheels and carries an optional pod", () => {
  const { container, rerender } = render(<CourierDroid steering={-25} travel={0} cargo="none" />)
  const wheel = container.querySelector('[data-wheel="front"]')!.getAttribute("transform")
  rerender(<CourierDroid steering={25} travel={0.5} cargo="pod" />)
  expect(container.querySelector('[data-wheel="front"]')!.getAttribute("transform")).not.toBe(wheel)
  expect(container.querySelector('[data-cargo="pod"]')).not.toBeNull()
})
```

- [ ] **Step 2: Run tests and verify missing-module failures**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

- [ ] **Step 3: Implement the mobile APIs**

```ts
interface ProbeDroidProps extends SharedDroidSvgProps {
  hover?: number
  scanAngle?: number
  appendages?: number
  active?: boolean
  signal?: DroidSignal
}

interface CourierDroidProps extends SharedDroidSvgProps {
  heading?: number
  steering?: number
  travel?: number
  cargo?: "none" | "pod" | "crate" | "tools"
  antenna?: "whip" | "dish" | "none"
  signal?: DroidSignal
}
```

Render a bounded-height probe with three to six `data-appendage` chains and controlled scan mast. Render a low courier chassis with `data-wheel` steering, wrapped travel marks, and optional `data-cargo`.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm vitest run src/components/ui/__tests__/droid-collection.test.tsx`

```bash
git add src/components/ui/probe-droid.tsx src/components/ui/courier-droid.tsx src/components/ui/__tests__/droid-collection.test.tsx
git commit -m "feat: add probe and courier droids"
```

### Task 5: Registry integration

**Files:**
- Modify: `registry.json`
- Modify: `scripts/__tests__/registry.test.ts`
- Generate: `public/r/*.json`

**Interfaces:**
- Consumes: all eight component files and their direct robocn imports.
- Produces: eight installable registry items and generated payloads.

- [ ] **Step 1: Add a failing table-driven registry test**

```ts
it.each(["utility-droid", "orb-droid", "protocol-droid", "security-droid", "medical-droid", "infantry-droid", "probe-droid", "courier-droid"])(
  "publishes %s as one UI source file",
  (name) => {
    const item = registry.items.find((candidate) => candidate.name === name)
    expect(item?.type).toBe("registry:ui")
    expect(item?.files).toHaveLength(1)
  },
)
```

- [ ] **Step 2: Run the registry test and verify all eight lookups fail**

Run: `pnpm vitest run scripts/__tests__/registry.test.ts`

- [ ] **Step 3: Add exact entries and build payloads**

Each entry depends on `robot-style`; `orb-droid` and `security-droid` also depend on `robot-kinematics` and `use-pointer-target`. Set each target to `@ui/<name>.tsx`.

- [ ] **Step 4: Verify and commit registry integration**

Run: `pnpm registry:build && pnpm vitest run scripts/__tests__/registry.test.ts`

```bash
git add registry.json scripts/__tests__/registry.test.ts public/r
git commit -m "feat: publish droid registry items"
```

### Task 6: Documentation, demos, and catalogue

**Files:**
- Modify: `src/lib/docs.ts`
- Modify: `src/components/demos/demos.tsx`
- Modify: `src/components/site/catalogue.tsx`
- Modify: `src/components/site/__tests__/docs-catalogue.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: all eight public component APIs.
- Produces: docs routes, live demos, catalogue cards, and README discovery rows.

- [ ] **Step 1: Extend the existing site test with all eight slugs**

```ts
const droidSlugs = ["utility-droid", "orb-droid", "protocol-droid", "security-droid", "medical-droid", "infantry-droid", "probe-droid", "courier-droid"]

it.each(droidSlugs)("documents and previews %s", (slug) => {
  expect(docs.some((entry) => entry.slug === slug)).toBe(true)
  expect(screen.getByRole("link", { name: new RegExp(slug.replace("-", " "), "i") })).toHaveAttribute("href", `/docs/${slug}`)
  expect(demos[slug]).toBeDefined()
})
```

- [ ] **Step 2: Run the site test and verify the missing-entry failures**

Run: `pnpm vitest run src/components/site/__tests__/docs-catalogue.test.tsx`

- [ ] **Step 3: Add complete docs records and demos**

Document every public prop and controlled-motion invariant. Map each slug to a demo that uses `Segmented` for enums and `NumberControl` for numeric ranges.

- [ ] **Step 4: Add catalogue cards and README rows**

Render one distinctive static pose per component and add a concise “What is in it” table row for every item.

- [ ] **Step 5: Verify and commit site integration**

Run: `pnpm vitest run src/components/site/__tests__/docs-catalogue.test.tsx`

```bash
git add src/lib/docs.ts src/components/demos/demos.tsx src/components/site/catalogue.tsx src/components/site/__tests__/docs-catalogue.test.tsx README.md
git commit -m "docs: add the droid collection"
```

### Task 7: Whole-project verification

**Files:**
- Modify only files required by failures caused by the collection.

**Interfaces:**
- Consumes: complete collection and site integration.
- Produces: verified source, generated registry payloads, and production site.

- [ ] **Step 1: Run all tests**

Run: `pnpm test`

- [ ] **Step 2: Run static checks**

Run: `pnpm typecheck && pnpm lint`

- [ ] **Step 3: Rebuild install payloads and production site**

Run: `pnpm registry:build && pnpm build`

- [ ] **Step 4: Inspect generated payloads**

Confirm `public/r/{utility,orb,protocol,security,medical,infantry,probe,courier}-droid.json` each contains its component file and required registry dependencies.

- [ ] **Step 5: Commit verification fixes when the previous steps required changes**

```bash
git add registry.json public/r src README.md
git commit -m "fix: complete droid collection verification"
```
