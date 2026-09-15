#!/usr/bin/env node
/**
 * Prepares the workbench.
 *
 * Emits two artefacts, both gitignored, both rebuilt by `pnpm generate`:
 *
 *   src/lib/workbench/generated.json            what every component's props are
 *   src/components/workbench/registry.generated.tsx  how to load each component
 *
 * The manifest is what the controls panel reads: one entry per `registry:ui`
 * item, with a knob derived from each prop its interface declares. The registry
 * file is one `React.lazy` per component, so the workbench loads the machine on
 * the stage rather than all of them — and Fast Refresh still swaps the module
 * underneath, which is the entire point of the tool.
 *
 * It also picks up **drafts**: a machine under `src/components/ui` that nobody
 * has added to `registry.json` yet. A new robot is a file before it is an item,
 * and the workbench is where you look at it while it becomes one — so the loop
 * has to work from the first save, not from the moment it ships.
 * Notes: `docs/workbench.md`.
 */

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { exportedNames, isWebgl, pascalCase } from "./lib/gallery.mjs"
import { controlsFor, indexTypes, isRobotSource, titleCase } from "./lib/workbench.mjs"

/**
 * A component that cannot mount bare on the stage: the 3D arm needs a canvas
 * around it, the stage needs something to hold, and the export control needs a
 * machine to record. The WebGL pair keeps its own module so three.js stays
 * behind that lazy boundary and nothing else pulls a renderer in.
 */
const wrapped = {
  "robot-arm-3d": { export: "StagedArm3D", module: "@/components/workbench/webgl" },
  "robot-stage": { export: "StageWithArm", module: "@/components/workbench/webgl" },
  "robot-export": { export: "ExportedArm", module: "@/components/workbench/wrappers" },
}

async function sourcesUnder(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map(async (entry) => {
        const file = path.join(entry.parentPath ?? entry.path, entry.name)
        return { file, source: await readFile(file, "utf8") }
      }),
  )
}

const registry = JSON.parse(await readFile("registry.json", "utf8"))

// Aliases and base interfaces resolve across files: `variant?: RobotVariant`
// is declared in a component and defined in `src/lib/robocn/style.ts`.
const files = [
  ...(await sourcesUnder("src/lib")),
  ...(await sourcesUnder("src/hooks")),
  ...(await sourcesUnder("src/components/ui")),
]
const index = indexTypes(files)
const sourceOf = new Map(files.map((entry) => [entry.file, entry.source]))

const components = []
for (const item of registry.items) {
  if (item.type !== "registry:ui") continue
  const file = item.files?.find((entry) => entry.path.startsWith("src/components/ui/"))?.path
  if (!file) throw new Error(`${item.name}: registry:ui item ships no component file`)
  const source = sourceOf.get(file)
  if (!source) throw new Error(`${item.name}: ${file} is not readable`)
  const wanted = pascalCase(item.name)
  const exportName = exportedNames(source).find(
    (name) => name.toLowerCase() === wanted.toLowerCase(),
  )
  if (!exportName) {
    throw new Error(
      `${item.name}: ${file} exports no ${wanted}. The workbench resolves ` +
        `components by the PascalCase of the item name — rename the export.`,
    )
  }
  const { props, controls } = controlsFor({ file, source, exportName, index })
  components.push({
    id: item.name,
    title: item.title,
    description: item.description,
    categories: item.categories ?? [],
    draft: false,
    file,
    module: file.replace(/^src\//, "@/").replace(/\.tsx?$/, ""),
    export: exportName,
    webgl: isWebgl(source),
    wrap: wrapped[item.name] ?? null,
    props,
    controls,
  })
}

// Drafts: a machine on disk that no registry item claims yet. Shadcn primitives
// live in the same folder and are not machines, so the robocn vocabulary is what
// tells them apart — a new robot imports the palette, the camera or the clock
// before it does anything else.
const shipped = new Set(components.map((component) => component.file))
for (const { file, source } of files) {
  if (!file.startsWith("src/components/ui/") || !file.endsWith(".tsx")) continue
  if (shipped.has(file) || !isRobotSource(source)) continue
  const id = path.basename(file, ".tsx")
  const wanted = pascalCase(id)
  const exportName = exportedNames(source).find(
    (name) => name.toLowerCase() === wanted.toLowerCase(),
  )
  // A draft without its own named export cannot be mounted. It is mid-write, not
  // broken: leave it out and pick it up on the next scan.
  if (!exportName) continue
  const { props, controls } = controlsFor({ file, source, exportName, index })
  components.push({
    id,
    title: titleCase(id),
    description: "Not in the registry yet — a draft on disk.",
    categories: ["drafts"],
    draft: true,
    file,
    module: file.replace(/^src\//, "@/").replace(/\.tsx?$/, ""),
    export: exportName,
    webgl: isWebgl(source),
    wrap: null,
    props,
    controls,
  })
}
components.sort((a, b) => a.title.localeCompare(b.title))

await mkdir("src/lib/workbench", { recursive: true })
await writeFile(
  "src/lib/workbench/generated.json",
  `${JSON.stringify({ components }, null, 2)}\n`,
)

const lines = [
  `"use client"`,
  "",
  "/**",
  " * GENERATED by `scripts/build-workbench.mjs` — do not edit.",
  " *",
  " * One lazy import per registry component, keyed by item name. The workbench",
  " * loads only the machine on the stage; Fast Refresh replaces the module under",
  " * the lazy boundary, so an edit to the component file lands on the stage.",
  " */",
  "",
  `import * as React from "react"`,
  "",
  "/** The stage passes props it read out of the manifest, so this is the honest type. */",
  "export type WorkbenchComponent = React.ComponentType<Record<string, unknown>>",
  "",
  "export const workbenchComponents: Record<string, React.LazyExoticComponent<WorkbenchComponent>> = {",
  ...components.map((component) => {
    // The WebGL pair loads three.js, so even their wrappers stay behind the
    // lazy boundary: nothing pulls in a renderer until it is on the stage.
    const load = component.wrap
      ? `import(${JSON.stringify(component.wrap.module)}).then((module) => ({ default: module.${component.wrap.export} as unknown as WorkbenchComponent }))`
      : `import(${JSON.stringify(component.module)}).then((module) => ({ default: module.${component.export} as unknown as WorkbenchComponent }))`
    return `  ${JSON.stringify(component.id)}: React.lazy(() => ${load}),`
  }),
  "}",
  "",
]
await mkdir("src/components/workbench", { recursive: true })
await writeFile("src/components/workbench/registry.generated.tsx", lines.join("\n"))

const knobs = components.reduce(
  (total, component) => total + component.controls.filter((c) => c.kind !== "unsupported").length,
  0,
)
const drafts = components.filter((component) => component.draft).length
console.log(
  `Workbench prepared: ${components.length} components${drafts ? ` (${drafts} draft)` : ""}, ${knobs} derived controls.`,
)
