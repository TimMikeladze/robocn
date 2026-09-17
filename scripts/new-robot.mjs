/**
 * `pnpm robot:new <name>` — everything mechanical about a new machine, in one
 * command.
 *
 * The parts of shipping a robot that are identical across two hundred of them
 * are not worth an agent's turns. This writes all of them:
 *
 *   src/components/ui/<name>.tsx          the whole customisation contract
 *   src/components/ui/__tests__/…         the four tests every machine owes
 *   src/lib/robocn/<solver>.ts + tests    with --solver
 *   registry.json                         the item, so it installs
 *   src/components/ui/__tests__/views…    the four-camera fixture
 *   src/lib/docs.ts                       the written docs page
 *   src/components/demos/demos.tsx        the bench, with a control per axis
 *   src/components/site/catalogue.tsx     the landing card
 *   README.md                             the table row
 *
 * What it emits already renders, already passes its own tests, and is already
 * on the site — leaving only the geometry and, where the mechanism has any, the
 * solver. `--minimal` stops after the first five. Notes: `docs/robot-skills.md`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const VIEWS = ["plan", "front", "profile", "iso"]

function usage(message) {
  if (message) console.error(`\n  ${message}\n`)
  console.error(`  Usage: pnpm robot:new <name> [options]

    --title <text>          Registry title. Default: the name, title-cased.
    --description <text>    Registry description, over 20 characters. Required by the
                            registry test; a placeholder is written if omitted.
    --view <${VIEWS.join("|")}>
                            The view the machine is drawn in. Default: front.
    --categories <a,b>      Registry categories: the robotics umbrella, then the
                            group the item belongs to. Default: robotics,droids.
    --deps <a,b>            Extra robocn registry items this one imports.
    --solver <name>         Also scaffold src/lib/robocn/<name>.ts, its tests and
                            its own registry:lib item.
    --group <id>            The group category, if it is easier to say than a
                            categories list: one of the ids in src/lib/groups.ts.
    --label <text>          The technical caption the demo passes. Default: the
                            name, upper-cased.
    --minimal               Only the required files — component, tests, registry
                            item, view fixture. Skips the docs entry, the demo
                            bench, the catalogue card and the README row.
    --no-views              Skip the views.test.tsx fixture.
    --dry-run               Print what would be written and change nothing.
`)
  process.exit(message ? 1 : 0)
}

function parseArgs(argv) {
  const options = {
    view: "front",
    categories: "robotics,droids",
    deps: "",
    views: true,
    wiring: true,
    dryRun: false,
  }
  let name = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") usage()
    else if (arg === "--no-views") options.views = false
    else if (arg === "--minimal") options.wiring = false
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) usage(`${arg} needs a value.`)
      index += 1
      if (key === "title") options.title = value
      else if (key === "description") options.description = value
      else if (key === "view") options.view = value
      else if (key === "categories") options.categories = value
      else if (key === "deps") options.deps = value
      else if (key === "solver") options.solver = value
      else if (key === "group") options.group = value
      else if (key === "label") options.label = value
      else usage(`Unknown option ${arg}.`)
    } else if (name === null) name = arg
    else usage(`Unexpected argument ${arg}.`)
  }
  if (!name) usage("A kebab-case name is required, e.g. `pnpm robot:new survey-droid`.")
  return { name, options }
}

const isKebab = (value) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value)
const pascal = (value) => value.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")
const camel = (value) => { const p = pascal(value); return p[0].toLowerCase() + p.slice(1) }
const words = (value) => value.split("-").join(" ")
const sentence = (value) => { const w = words(value); return w[0].toUpperCase() + w.slice(1) }

/**
 * A solver's registry item keeps its suffix and its file drops it:
 * `walker-kinematics` lives in `walker.ts`, `household-geometry` in
 * `household.ts`. True of every lib item in the registry, so it is the rule.
 */
const solverFile = (solver) => solver.replace(/-(geometry|kinematics)$/, "")

/**
 * The elevation a machine drawn in this view is written in. `elevationDraft`
 * takes the *plane the drawing lives in*, not the camera: an isometric machine
 * is still authored in one of the two elevations, and the camera does the rest.
 */
const planeFor = (view) => (view === "profile" ? "profile" : "front")

/* ------------------------------------------------------------------ files */

function componentSource({ name, view, solver }) {
  const Component = pascal(name)
  const behaviorType = `${Component}Behavior`
  const sampler = `${camel(name)}Reach`
  const plane = planeFor(view)
  const title = sentence(name)
  const solverImport = solver
    ? `import { solve${pascal(solver)} } from "@/lib/robocn/${solverFile(solver)}"\n`
    : ""
  const solverNote = solver
    ? `\n * The mechanism is solved in \`src/lib/robocn/${solverFile(solver)}.ts\` — pure, no React,\n * tested on its own. The drawing only reads the pose it produces.\n *`
    : ""

  return `"use client"

/**
 * ${name} — TODO: one paragraph on what this machine is and what makes it
 * distinct from everything already in the set. Say which parts are solved and
 * which are illustrated; an illustrated part is fine, an illustrated part
 * presented as solved is not.
 *${solverNote}
 * Drawn once in the ${plane} elevation and pushed through \`robotCamera\`, so all
 * four views are the same geometry rather than four drawings that drift apart.
 */

import * as React from "react"

import { arrowStep, useRobotDrag, useRobotScalar } from "@/hooks/use-robot-motion"
import { clamp, lerp, type Vec2 } from "@/lib/robocn/kinematics"
${solverImport}import {
  boxCorners,
  elevationDraft,
  fitTransform,
  px,
  resolveRobotPalette,
  resolveRobotSize,
  robotCamera,
  robotSurface,
  type RobotPaletteProps,
  type RobotSize,
  type RobotVariant,
  type RobotView,
} from "@/lib/robocn/style"
import { cn } from "@/lib/utils"

/** What the machine does with nobody driving it. Always includes \`static\`. */
export type ${behaviorType} = "cycle" | "sweep" | "static"

const VIEW_WIDTH = 200
const VIEW_HEIGHT = 240
const NATIVE_VIEW: RobotView = "${view}"

/** World units. x along the drawing, y up from the ground, z out of the plane. */
const ENVELOPE = boxCorners({ x: -70, y: 0, z: -40 }, { x: 70, y: 200, z: 40 })

const MAST_TOP = 132
const BOOM_ROOT: Vec2 = { x: 0, y: MAST_TOP }
const BOOM_LENGTH = 62

const viewNames: Record<RobotView, string> = {
  plan: "plan view",
  front: "front elevation",
  profile: "side elevation",
  iso: "isometric view",
}

/**
 * Every behaviour is a pure function of the clock, exported so motion can be
 * tested by sampling it rather than by faking animation frames.
 */
export function ${sampler}(behavior: ${behaviorType}, clock: number): number {
  if (!Number.isFinite(clock)) return 0
  switch (behavior) {
    case "cycle":
      return (Math.sin(clock * Math.PI * 2) + 1) / 2
    case "sweep":
      return ((clock % 1) + 1) % 1
    default:
      return 0
  }
}

export interface ${Component}Props
  extends Omit<React.ComponentProps<"svg">, "color">,
    RobotPaletteProps {
  /** Controlled reach, 0 stowed to 1 out. Supplying it stops the loop. */
  reach?: number
  onReachChange?: (reach: number) => void
  behavior?: ${behaviorType}
  showGround?: boolean
  /** Where the camera stands. Defaults to the view the machine was drawn in. */
  view?: RobotView
  speed?: number
  phase?: number
  paused?: boolean
  animate?: boolean
  interactive?: boolean
  label?: string
  size?: RobotSize | number
  variant?: RobotVariant
}

function ${Component}({
  reach,
  onReachChange,
  behavior = "cycle",
  showGround = true,
  view = NATIVE_VIEW,
  speed = 0.4,
  phase = 0,
  paused = false,
  animate = true,
  interactive = false,
  label,
  size = "md",
  variant = "solid",
  color,
  accent,
  metal,
  dark,
  glow,
  grid,
  palette: paletteOverride,
  className,
  style,
  role,
  tabIndex,
  onKeyDown,
  onBlur,
  "aria-label": ariaLabel,
  ...props
}: ${Component}Props) {
  const palette = resolveRobotPalette({ color, accent, metal, dark, glow, grid, palette: paletteOverride })
  const width = resolveRobotSize(size)
  const svgRef = React.useRef<SVGSVGElement>(null)
  const [held, setHeld] = React.useState<number | null>(null)
  const controlled = reach !== undefined

  // Controlled wins and pins the value; the clock keeps running underneath, so
  // release reads as a servo returning rather than a jump.
  const hold = controlled ? (Number.isFinite(reach) ? clamp(reach as number, 0, 1) : 0) : held
  const goal = React.useCallback((clock: number) => ${sampler}(behavior, clock), [behavior])
  const motion = useRobotScalar(goal, {
    rate: 1.2,
    hold,
    speed,
    paused,
    phase,
    animate: animate && !controlled && behavior !== "static",
  })
  const out = clamp(motion.value, 0, 1)

  const camera = robotCamera(view)
  const frame = fitTransform(ENVELOPE, camera, VIEW_WIDTH, VIEW_HEIGHT)
  const { path: line, solid, box, bar, disc } = elevationDraft(camera, "${plane}")

  const apply = React.useCallback(
    (next: number) => {
      const bounded = Math.round(clamp(next, 0, 1) * 100) / 100
      setHeld(bounded)
      onReachChange?.(bounded)
    },
    [onReachChange],
  )
  const dragging = useRobotDrag(svgRef, {
    enabled: interactive,
    // \`onDrag\` must stay in a \`useCallback\` or the listeners rebind every render.
    onDrag: React.useCallback((unit: Vec2) => apply(unit.x), [apply]),
    onDragEnd: React.useCallback(() => setHeld(null), []),
  })

  const shell = robotSurface("shell", variant, palette)
  const machined = robotSurface("metal", variant, palette)
  const cast = robotSurface("dark", variant, palette)

  // TODO: the real mechanism. Every degree of freedom has to be visibly
  // mechanical — a prop that only nudges pixels is the thing reviewers notice.
  const swing = lerp(-64, 4, out)
  const radians = (swing * Math.PI) / 180
  const boomTip: Vec2 = {
    x: BOOM_ROOT.x + Math.cos(radians) * BOOM_LENGTH,
    y: BOOM_ROOT.y + Math.sin(radians) * BOOM_LENGTH,
  }
  const percent = Math.round(out * 100)

  return (
    <svg
      ref={svgRef}
      role={role ?? (interactive ? "slider" : "img")}
      aria-label={
        ariaLabel ??
        \`${title}, \${percent} percent out, \${viewNames[view] ?? viewNames.${view}}\`
      }
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 1 : undefined}
      aria-valuenow={interactive ? px(out) : undefined}
      aria-valuetext={interactive ? \`\${percent} percent out\` : undefined}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented) return
        const delta = arrowStep(event.key, 0.05, 0.2)
        if (delta !== 0) apply(out + delta)
        else if (event.key === "Home") apply(0)
        else if (event.key === "End") apply(1)
        else return
        event.preventDefault()
      }}
      viewBox={\`0 0 \${VIEW_WIDTH} \${VIEW_HEIGHT}\`}
      width={width}
      height={px((width * VIEW_HEIGHT) / VIEW_WIDTH)}
      onBlur={(event) => {
        onBlur?.(event)
        if (!dragging) setHeld(null)
      }}
      className={cn(
        "max-w-full select-none",
        interactive &&
          "cursor-grab touch-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[currentColor]",
        dragging && "cursor-grabbing",
        className,
      )}
      style={{ color: palette.foreground, ...style }}
      {...props}
    >
      {variant === "blueprint" && (
        <path
          d={\`M \${VIEW_WIDTH / 2} 8 V \${VIEW_HEIGHT - 18}\`}
          fill="none"
          stroke={palette.grid}
          strokeWidth={0.5}
          strokeDasharray="3 4"
          opacity={0.4}
        />
      )}

      <g data-view={view} transform={frame || undefined}>
        {showGround && (
          <>
            <path
              data-ground
              d={solid([{ x: -56, y: 0 }, { x: 56, y: 0 }], 34)}
              fill={palette.dark}
              opacity={0.12}
            />
            <path
              d={line([{ x: -56, y: 0 }, { x: 56, y: 0 }])}
              fill="none"
              stroke={palette.dark}
              strokeWidth={1}
              opacity={0.5}
            />
          </>
        )}

        <g data-base>
          <path d={box(-34, 0, 34, 20, 24)} {...shell} />
          <path d={box(-26, 20, 26, 28, 18)} {...cast} />
        </g>

        <g data-mast>
          <path d={bar({ x: 0, y: 26 }, { x: 0, y: MAST_TOP }, 9, 9)} {...machined} />
          <path d={disc(BOOM_ROOT, 11, 11)} {...cast} />
        </g>

        <g data-boom data-joint="shoulder">
          <path d={bar(BOOM_ROOT, boomTip, 6, 6)} {...shell} />
          <path d={disc(boomTip, 5, 6)} {...machined} />
          <path d={disc(boomTip, 2.2, 7)} fill={palette.accent} stroke="none" />
        </g>
      </g>

      {label && (
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 6}
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize={6}
          fill={palette.foreground}
        >
          {label}
        </text>
      )}
    </svg>
  )
}

export { ${Component} }
`
}

function testSource({ name }) {
  const Component = pascal(name)
  const sampler = `${camel(name)}Reach`
  const title = sentence(name)
  return `import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ${Component}, ${sampler} } from "@/components/ui/${name}"

afterEach(cleanup)

describe("${name}", () => {
  it("moves the mechanism when the controlled value changes", () => {
    const { container, rerender } = render(<${Component} animate={false} reach={0} />)
    const stowed = container.querySelector("[data-boom] path")!.getAttribute("d")

    rerender(<${Component} animate={false} reach={1} />)

    expect(container.querySelector("[data-boom] path")!.getAttribute("d")).not.toBe(stowed)
  })

  it("draws a stable neutral pose for rubbish input", () => {
    const { container } = render(
      // @ts-expect-error — a stale prop from a consumer should degrade, not throw.
      <${Component} animate={false} reach={Number.NaN} behavior="nonsense" />,
    )

    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  })

  it("names itself and the camera it is drawn from", () => {
    const { container, rerender } = render(<${Component} animate={false} />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/${title}/i)

    rerender(<${Component} animate={false} view="iso" />)
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toMatch(/isometric/)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("iso")
  })

  it("takes a colour override", () => {
    const { container } = render(<${Component} animate={false} color="#f97316" />)
    expect(container.innerHTML).toContain("#f97316")
  })

  it("samples every behaviour as a pure function of the clock", () => {
    expect(${sampler}("static", 0.4)).toBe(0)
    expect(${sampler}("cycle", Number.NaN)).toBe(0)
    // A whole cycle comes back to where it started.
    expect(${sampler}("cycle", 1)).toBeCloseTo(${sampler}("cycle", 2), 6)
  })
})
`
}

function solverSource(solver) {
  const Solve = `solve${pascal(solver)}`
  const Pose = `${pascal(solver)}Pose`
  return `/**
 * ${solver} — TODO: one paragraph on what this solves and why the mechanism
 * has real kinematics rather than a pose table.
 *
 * Pure functions over plain objects. No React, no three.js, no dependencies —
 * the SVG components and the r3f rig call the same code, which is the whole
 * reason the set can claim "2D + 3D, same kinematics".
 */

import { clamp, type Vec2 } from "@/lib/robocn/kinematics"

export interface ${pascal(solver)}Geometry {
  /** TODO: the fixed dimensions of the mechanism, in world units. */
  reach: number
}

export interface ${Pose} {
  /** TODO: the joints the drawing reads, shoulder outward. */
  joints: Vec2[]
  /** False when the input was outside the workspace and had to be clamped. */
  reachable: boolean
}

export const default${pascal(solver)}Geometry: ${pascal(solver)}Geometry = {
  reach: 60,
}

/**
 * TODO: the solver itself.
 *
 * Non-negotiables, because the rest of the set holds them: angles are degrees
 * on the surface and radians inside; a target outside the workspace clamps onto
 * the reachable boundary and still returns a valid pose rather than \`NaN\`; a
 * non-finite input produces the neutral pose; and an iterative solve is seeded
 * with the previous frame so it is temporally coherent.
 */
export function ${Solve}(
  target: Vec2,
  geometry: ${pascal(solver)}Geometry = default${pascal(solver)}Geometry,
): ${Pose} {
  const x = Number.isFinite(target?.x) ? target.x : 0
  const y = Number.isFinite(target?.y) ? target.y : 0
  const reach = Math.max(1e-6, Math.abs(geometry.reach))
  const distance = Math.hypot(x, y)
  const scale = distance > reach ? reach / distance : 1
  const tip: Vec2 = { x: x * scale, y: y * scale }

  return {
    joints: [{ x: 0, y: 0 }, { x: clamp(tip.x, -reach, reach), y: clamp(tip.y, -reach, reach) }],
    reachable: distance <= reach,
  }
}
`
}

function solverTestSource(solver) {
  const Solve = `solve${pascal(solver)}`
  return `import { describe, expect, it } from "vitest"

import { ${Solve}, default${pascal(solver)}Geometry } from "@/lib/robocn/${solverFile(solver)}"

describe("${solver}", () => {
  it("reaches a target inside the workspace", () => {
    const pose = ${Solve}({ x: 20, y: 10 })

    expect(pose.reachable).toBe(true)
    expect(pose.joints.at(-1)).toEqual({ x: 20, y: 10 })
  })

  it("clamps an out-of-reach target onto the boundary instead of failing", () => {
    const { reach } = default${pascal(solver)}Geometry
    const pose = ${Solve}({ x: reach * 10, y: 0 })

    expect(pose.reachable).toBe(false)
    expect(Math.hypot(pose.joints.at(-1)!.x, pose.joints.at(-1)!.y)).toBeCloseTo(reach, 6)
  })

  it("gives the neutral pose for a non-finite target", () => {
    const pose = ${Solve}({ x: Number.NaN, y: Number.POSITIVE_INFINITY })

    for (const joint of pose.joints) {
      expect(Number.isFinite(joint.x) && Number.isFinite(joint.y)).toBe(true)
    }
  })
})
`
}

/* -------------------------------------------------------------- registry */

/**
 * Inserted textually rather than by reparsing and reserialising: the file is
 * 164 KB of hand-formatted JSON, and a rewrite would put the whole thing in the
 * diff.
 */
function withRegistryItems(source, items) {
  const tail = source.lastIndexOf("\n  ]\n}")
  if (tail === -1) throw new Error("registry.json does not end in the shape this script expects.")
  const block = items
    .map((item) => JSON.stringify(item, null, 2).split("\n").map((row) => `    ${row}`).join("\n"))
    .join(",\n")
  return `${source.slice(0, tail)},\n${block}${source.slice(tail)}`
}

function registryItems({ name, title, description, categories, deps, solver }) {
  const url = (item) => `{REGISTRY_URL}/r/${item}.json`
  const items = []
  if (solver) {
    items.push({
      name: solver,
      type: "registry:lib",
      title: sentence(solver),
      description: `TODO: what ${words(solver)} solves, in one sentence a stranger can read on a card.`,
      categories: ["robotics", "foundations"],
      registryDependencies: [url("robot-kinematics")],
      files: [{ path: `src/lib/robocn/${solverFile(solver)}.ts`, type: "registry:lib", target: `@lib/${solverFile(solver)}.ts` }],
    })
  }
  items.push({
    name,
    type: "registry:ui",
    title,
    description,
    categories,
    registryDependencies: [
      url("robot-style"),
      url("robot-kinematics"),
      url("use-robot-motion"),
      ...(solver ? [url(solver)] : []),
      ...deps.map(url),
    ],
    files: [{ path: `src/components/ui/${name}.tsx`, type: "registry:ui", target: `@ui/${name}.tsx` }],
  })
  return items
}

/* ------------------------------------------------------------- wiring   */

/** The clause a catalogue card has room for. */
const firstClause = (summary) => summary.split(/(?<=\.)\s/)[0] ?? summary

/**
 * `src/lib/docs.ts` — the written page. A generated entry already exists for
 * any registry item, so this is the upgrade: a props table, usage, and notes.
 *
 * `view`, `loop`, `form` and `palette` are module-local in docs.ts and in scope
 * where this lands.
 */
function docsEntry({ name, description, view, solver }) {
  const Component = pascal(name)
  const rows = [
    `      { name: "reach", type: "number", description: "TODO: what this number is, in the machine's own terms. Supplying it stops the loop." },`,
    `      { name: "onReachChange", type: "(reach: number) => void", description: "Fires while it is dragged or keyed, so interaction works in controlled mode too." },`,
    `      { name: "behavior", type: \`"cycle" | "sweep" | "static"\`, default: \`"cycle"\`, description: "What it does with nobody driving it." },`,
    `      { name: "interactive", type: "boolean", default: "false", description: "Hand it to a person: drag it, or focus it and use the arrow keys. It eases back into the behaviour on release." },`,
    `      { name: "showGround", type: "boolean", default: "true", description: "Draw the contact shadow and the ground line beneath it." },`,
    `      { name: "label", type: "string", description: "Optional technical caption under the drawing." },`,
    `      view("${view}", "machine"),`,
    `      { name: "speed", type: "number", default: "0.4", description: "Cycles per second." },`,
    `      ...loop,`,
    `      ...form.slice(0, 2),`,
    `      ...palette,`,
  ]
  const machine = `  {
    slug: "${name}", item: "${name}",
    summary:
      ${JSON.stringify(description)},
    files: ["components/ui/${name}.tsx"],
    usage: \`import { ${Component} } from "@/components/ui/${name}"

// Runs its own cycle.
<${Component} behavior="cycle" />

// Or drive it, which stops the loop.
<${Component} reach={0.6} onReachChange={setReach} interactive />\`,
    props: [
${rows.join("\n")}
    ],
    notes: [
      "TODO: what this machine does not do, and which parts are solved rather than illustrated.",
    ],
  },`

  if (!solver) return machine

  const Solve = `solve${pascal(solver)}`
  const lib = `  {
    slug: "${solver}", item: "${solver}",
    summary:
      "TODO: what ${words(solver)} solves, in one sentence a stranger can read on a card.",
    files: ["lib/robocn/${solverFile(solver)}.ts"],
    api: [
      { name: "${Solve}(target, geometry?)", type: "(target: Vec2, geometry?: ${pascal(solver)}Geometry) => ${pascal(solver)}Pose", description: "TODO. Out of reach clamps onto the boundary rather than failing, and a non-finite target gives the neutral pose." },
      { name: "default${pascal(solver)}Geometry", type: "${pascal(solver)}Geometry", description: "The dimensions the machine ships with." },
    ],
    notes: [
      "Pure functions over plain objects: no React, no three.js, no dependencies.",
    ],
  },`
  return `${lib}\n${machine}`
}

/** `src/components/demos/demos.tsx` — the bench, with a control per axis. */
function demoComponent({ name, view, label }) {
  const Component = pascal(name)
  return `function ${Component}Demo() {
  const [view, setView] = React.useState<RobotView>("${view}")
  const [variant, setVariant] = React.useState<RobotVariant>("solid")
  const [behavior, setBehavior] = React.useState<${Component}Behavior>("cycle")
  return (
    <Bench controls={<>
      <Segmented label="view" value={view} options={views} onChange={setView} />
      <Segmented label="variant" value={variant} options={variants} onChange={setVariant} />
      <Segmented label="motion" value={behavior} options={["cycle", "sweep", "static"] as const} onChange={setBehavior} />
      {/* TODO: a control for every axis this machine grows. */}
      <Hint>Drag across it, or focus it and use the arrow keys.</Hint>
    </>}>
      <${Component} size={300} view={view} variant={variant} behavior={behavior} interactive label="${label}" />
    </Bench>
  )
}
`
}

/**
 * `src/components/site/catalogue.tsx` — the landing card.
 *
 * It must actually animate: `catalogue-motion.test.tsx` drives real frames at
 * every entry in this map and fails one that draws the same picture twice. So
 * the card runs the machine's own cycle and never pins a value prop.
 */
function catalogueEntries({ name, description, solver }) {
  const Component = pascal(name)
  // TODO for the author: pose it for 150px. Not pinned — see above.
  const machine = `  "${name}": { line: ${JSON.stringify(firstClause(description))}, art: <${Component} size={168} /> },`
  if (!solver) return machine
  const lib = `  "${solver}": { line: "The solver under it, drawn as the machine it solves for.", art: <${Component} size={168} variant="blueprint" /> },`
  return `${machine}\n${lib}`
}

/** `README.md` — one row in the "What is in it" table. */
function readmeRows({ name, description, solver }) {
  const machine = `| \`${name}\` | ${description} |`
  if (!solver) return machine
  return `${machine}\n| \`${solver}\` | TODO: what ${words(solver)} solves, in the same voice as the rest. |`
}

/* ------------------------------------------------------- views.test.tsx  */

/** Insert one line after the last line matching `anchor`. */
function insertAfterLast(source, anchor, line, where) {
  const rows = source.split("\n")
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (anchor.test(rows[index])) {
      rows.splice(index + 1, 0, line)
      return rows.join("\n")
    }
  }
  throw new Error(`${where}: no line matched ${anchor}`)
}

/**
 * Insert a row at the end of the literal opened by `opener`.
 *
 * `closer` is a line at column zero — but scanning *forward* for one is not
 * safe, because these files hold `usage:` template literals full of sample code
 * whose own brackets sit at column zero. (That is not hypothetical: a docs entry
 * landed inside the `assembly-geometry` usage sample before this took the
 * backward route.) So `before` names something that comes after the literal, and
 * the close is the last `closer` before it.
 */
function insertIntoBlock(source, opener, row, where, { closer = "\n}\n", before } = {}) {
  const start = source.indexOf(opener)
  if (start === -1) throw new Error(`${where}: could not find ${opener}`)
  const limit = source.indexOf(before, start + opener.length)
  if (limit === -1) throw new Error(`${where}: could not find ${before}, which should follow ${opener}`)
  const close = source.lastIndexOf(closer, limit)
  if (close === -1 || close < start) {
    throw new Error(`${where}: ${opener} is not closed the way this script expects.`)
  }
  return `${source.slice(0, close)}\n${row}${source.slice(close)}`
}

/** The import a wiring file needs for the machine it is about to reference. */
const uiImport = /^import \{ [^}]+ \} from "@\/components\/ui\/[^"]+"$/

function withDocsEntry(source, spec) {
  return insertIntoBlock(source, "const authored: AuthoredEntry[] = [", docsEntry(spec), "docs.ts", {
    closer: "\n]\n",
    before: "const byName = new Map(",
  })
}

function withDemo(source, spec) {
  const Component = pascal(spec.name)
  let next = insertAfterLast(
    source,
    uiImport,
    `import { ${Component}, type ${Component}Behavior } from "@/components/ui/${spec.name}"`,
    "demos.tsx",
  )
  const opener = "export const demos: Record<string, React.ComponentType<DemoProps>> = {"
  const at = next.indexOf(opener)
  if (at === -1) throw new Error("demos.tsx: could not find the demos map")
  next = `${next.slice(0, at)}${demoComponent(spec)}\n${next.slice(at)}`
  const rows = [`  "${spec.name}": ${Component}Demo,`]
  // A library points at the demo of the machine that shows it off.
  if (spec.solver) rows.push(`  "${spec.solver}": ${Component}Demo,`)
  return insertIntoBlock(next, opener, rows.join("\n"), "demos.tsx", { before: "function AutoDemo(" })
}

function withCard(source, spec) {
  const next = insertAfterLast(
    source,
    uiImport,
    `import { ${pascal(spec.name)} } from "@/components/ui/${spec.name}"`,
    "catalogue.tsx",
  )
  return insertIntoBlock(next, "const art: Record<string, Art> = {", catalogueEntries(spec), "catalogue.tsx", {
    before: "export const catalogueSlugs",
  })
}

function withReadmeRow(source, spec) {
  return insertAfterLast(source, /^\| `[a-z0-9-]+` \| .* \|$/, readmeRows(spec), "README.md")
}

function withViewFixture(source, { name, view }) {
  const Component = pascal(name)
  let next = insertAfterLast(
    source,
    uiImport,
    `import { ${Component} } from "@/components/ui/${name}"`,
    "views.test.tsx",
  )
  next = insertIntoBlock(
    next,
    "const machines: Record<string, (view?: RobotView) => React.ReactElement> = {",
    `  "${name}": (view) => <${Component} animate={false} reach={0.4} view={view} />,`,
    "views.test.tsx",
    { before: "const natives:" },
  )
  next = insertIntoBlock(
    next,
    "const natives: Partial<Record<keyof typeof machines, RobotView>> = {",
    `  "${name}": "${view}",`,
    "views.test.tsx",
    { before: "const tippedFrom" },
  )
  return next
}

/* ------------------------------------------------------------------ main */

const { name, options } = parseArgs(process.argv.slice(2))

if (!isKebab(name)) usage(`"${name}" is not kebab-case. Try ${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.`)
if (options.solver && !isKebab(options.solver)) usage(`--solver "${options.solver}" is not kebab-case.`)
if (!VIEWS.includes(options.view)) usage(`--view must be one of ${VIEWS.join(", ")}.`)

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const at = (...parts) => path.join(root, ...parts)

const registrySource = await readFile(at("registry.json"), "utf8")
const registry = JSON.parse(registrySource)
const taken = new Set(registry.items.map((item) => item.name))
if (taken.has(name)) usage(`registry.json already ships "${name}". Use \`refine-robot\` to change it.`)
if (options.solver && taken.has(options.solver)) usage(`registry.json already ships "${options.solver}".`)

const deps = options.deps.split(",").map((value) => value.trim()).filter(Boolean)
const unknown = deps.filter((dep) => !taken.has(dep))
if (unknown.length) usage(`--deps names items the registry does not have: ${unknown.join(", ")}`)

const title = options.title ?? sentence(name)
const description =
  options.description ??
  `TODO: what the ${words(name)} is and what makes it distinct, in over twenty characters.`
if (description.length <= 20) usage("--description has to be longer than 20 characters; the registry test checks it.")

const componentPath = at("src/components/ui", `${name}.tsx`)
const testPath = at("src/components/ui/__tests__", `${name}.test.tsx`)
if (existsSync(componentPath)) usage(`${path.relative(root, componentPath)} already exists.`)

const files = [
  [componentPath, componentSource({ name, view: options.view, solver: options.solver })],
  [testPath, testSource({ name })],
]
if (options.solver) {
  files.push([at("src/lib/robocn", `${solverFile(options.solver)}.ts`), solverSource(options.solver)])
  files.push([at("src/lib/robocn/__tests__", `${solverFile(options.solver)}.test.ts`), solverTestSource(options.solver)])
}

/**
 * The group the machine lands in. It is a registry category, so the site reads
 * it straight off the item — `src/lib/groups.ts` is the list, read from there
 * rather than copied, so a new group needs no edit here.
 */
const GROUPS = [...readFileSync(at("src/lib", "groups.ts"), "utf8").matchAll(/^  (\w+): "/gm)].map(
  (match) => match[1],
)
let categoryList = options.categories.split(",").map((value) => value.trim()).filter(Boolean)
if (options.group) categoryList = ["robotics", options.group]
const group = categoryList[1]
if (!GROUPS.includes(group)) {
  usage(`The second category is the group, and must be one of: ${GROUPS.join(", ")}.`)
}

const items = registryItems({
  name,
  title,
  description,
  categories: categoryList,
  deps,
  solver: options.solver,
})

const spec = {
  name,
  title,
  description,
  group,
  view: options.view,
  solver: options.solver,
  label: options.label ?? name.toUpperCase(),
}

/**
 * Every file this command edits in place, each with the transform that adds the
 * machine to it. Read up front so a failure to find an anchor aborts before
 * anything is written, rather than halfway through.
 */
const wiring = [
  ["src/components/ui/__tests__/views.test.tsx", "view fixture", options.views, withViewFixture],
  ["src/lib/docs.ts", "docs entry", options.wiring, withDocsEntry],
  ["src/components/demos/demos.tsx", "demo bench", options.wiring, withDemo],
  ["src/components/site/catalogue.tsx", "catalogue card", options.wiring, withCard],
  ["README.md", "README row", options.wiring, withReadmeRow],
]
  .filter(([, , enabled]) => enabled)
  .map(([file, what, , transform]) => ({ file, what, transform }))

for (const entry of wiring) entry.source = await readFile(at(entry.file), "utf8")

if (options.dryRun) {
  console.log("\n  Would write:")
  for (const [file] of files) console.log(`    ${path.relative(root, file)}`)
  console.log(`    registry.json${" ".repeat(29)}+ ${items.map((item) => item.name).join(", ")}`)
  for (const { file, what, transform, source } of wiring) {
    // Run it, so a moved anchor is a failure here rather than a surprise later.
    transform(source, spec)
    console.log(`    ${file.padEnd(42)}+ ${what}`)
  }
  console.log()
  process.exit(0)
}

// Transform everything before writing anything.
const edited = wiring.map((entry) => [at(entry.file), entry.transform(entry.source, spec)])

for (const [file, contents] of files) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, contents)
}
await writeFile(at("registry.json"), withRegistryItems(registrySource, items))
for (const [file, contents] of edited) await writeFile(file, contents)

console.log(`
  ${pascal(name)} scaffolded — it renders, its tests pass, and it is on the site.

  Written:`)
for (const [file] of files) console.log(`    ${path.relative(root, file)}`)
console.log(`
  Wired into:
    registry.json${" ".repeat(29)}+ ${items.map((item) => item.name).join(", ")}`)
for (const { file, what } of wiring) console.log(`    ${file.padEnd(42)}+ ${what}`)
console.log(`
  Next:
    1. ${options.solver ? `Write the solver in src/lib/robocn/${solverFile(options.solver)}.ts and its tests first.` : "Write the geometry in the component."}
    2. Replace the TODOs — the file header, the docs notes, the demo controls,
       and pose the catalogue card for 150px.
    3. pnpm robot:check ${name}
`)
