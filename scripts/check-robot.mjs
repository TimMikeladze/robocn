/**
 * `pnpm robot:check <name>` — the focused verification loop for one machine.
 *
 * The full sweep is cheap in wall clock but noisy: it runs 119 test files to
 * tell you about one. This runs the things a new or changed machine can
 * actually break, then reports the site wiring — the docs entry, the demo
 * bench, the catalogue card, the README row, the view fixture — as written or
 * falling back. `pnpm robot:new` writes all five, and every one of them has a
 * generated fallback, so the report is not a gate: it is there so a machine
 * running on a fallback is a decision rather than an oversight.
 *
 * `--full` adds the whole suite and `next build`, which is what to run once
 * before shipping. Notes: `docs/robot-skills.md`.
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const argv = process.argv.slice(2)
const full = argv.includes("--full")
const name = argv.find((arg) => !arg.startsWith("--"))

if (!name || argv.includes("--help") || argv.includes("-h")) {
  console.error(`
  Usage: pnpm robot:check <name> [--full]

    --full   Also run the whole test suite and \`next build\`.
`)
  process.exit(name ? 0 : 1)
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const at = (...parts) => path.join(root, ...parts)
const rel = (file) => path.relative(root, file)

const registry = JSON.parse(readFileSync(at("registry.json"), "utf8"))
const item = registry.items.find((entry) => entry.name === name)
if (!item) {
  console.error(`\n  registry.json ships no item called "${name}". Did \`pnpm robot:new\` run?\n`)
  process.exit(1)
}

const owned = item.files.map((file) => at(file.path))
const missing = owned.filter((file) => !existsSync(file))
if (missing.length) {
  console.error(`\n  registry.json declares files that do not exist:\n${missing.map((file) => `    ${rel(file)}`).join("\n")}\n`)
  process.exit(1)
}

/* ------------------------------------------------------------- the gates */

const testFiles = [
  at("src/components/ui/__tests__", `${name}.test.tsx`),
  at("src/lib/robocn/__tests__", `${name}.test.ts`),
].filter(existsSync)

const shared = [
  "scripts/__tests__/registry.test.ts",
  "src/components/ui/__tests__/views.test.tsx",
  "src/components/site/__tests__/catalogue.test.tsx",
]

const run = (label, command, args) => {
  process.stdout.write(`  ${label}… `)
  const started = Date.now()
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const ok = result.status === 0
  console.log(ok ? `ok (${seconds}s)` : `FAILED (${seconds}s)`)
  if (!ok) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd()
    console.log(`\n${output}\n`)
  }
  return ok
}

console.log(`\n  Checking ${name}\n`)

const gates = []

// The gallery and workbench manifests are built from `registry.json`, and the
// catalogue tests read them. A new item is invisible to both until they are
// regenerated, which `pnpm test` does and a bare `vitest run` does not.
gates.push(run("generate", "pnpm", ["run", "generate"]))

if (!testFiles.length) {
  console.log("  tests… MISSING")
  console.log(`\n    No test file at ${rel(at("src/components/ui/__tests__", `${name}.test.tsx`))}.`)
  console.log("    Every machine owes four: a controlled prop moves the mechanism, rubbish")
  console.log("    input renders neutral, the label names it and its view, a colour lands.\n")
  gates.push(false)
} else {
  gates.push(
    run("tests", "pnpm", [
      "exec",
      "vitest",
      "run",
      ...testFiles.map(rel),
      ...(full ? [] : shared),
    ]),
  )
}

gates.push(run("typecheck", "pnpm", ["exec", "tsc", "--noEmit"]))
gates.push(run("lint", "pnpm", ["exec", "eslint", ...owned.map(rel), ...testFiles.map(rel)]))
gates.push(run("registry", "node", ["scripts/build-registry.mjs"]))

if (full) {
  gates.push(run("full suite", "pnpm", ["exec", "vitest", "run"]))
  gates.push(run("build", "pnpm", ["exec", "next", "build"]))
}

/* ----------------------------------------------------------- the wiring */

const has = (file, needle) => existsSync(at(file)) && readFileSync(at(file), "utf8").includes(needle)

const wiring = [
  ["docs entry", "src/lib/docs.ts", `slug: "${name}"`, "generated from the registry item"],
  ["demo bench", "src/components/demos/demos.tsx", `"${name}":`, "AutoDemo over the machine's own defaults"],
  ["catalogue card", "src/components/site/catalogue.tsx", `"${name}":`, "the machine's own default pose"],
  ["README row", "README.md", `\`${name}\``, "absent"],
  ["view fixture", "src/components/ui/__tests__/views.test.tsx", `"${name}":`, "no per-view snapshot"],
]

// `pnpm robot:new` writes all of these, and each has a generated fallback, so
// neither column is a failure — the report is here so that a machine running on
// a fallback is a decision somebody made rather than one nobody noticed.
const fallbacks = wiring.filter(([, file, needle]) => !has(file, needle))

console.log("\n  Site wiring:\n")
for (const [label, file, needle, fallback] of wiring) {
  console.log(
    has(file, needle)
      ? `    ${label.padEnd(15)} written`
      : `    ${label.padEnd(15)} falling back — ${fallback}`,
  )
}
if (fallbacks.length) {
  console.log(`
    Nothing above fails a build. \`pnpm robot:new\` writes all five; a machine
    scaffolded with --minimal, or one older than this command, runs on the
    fallbacks until somebody writes them.`)
}

const passed = gates.every(Boolean)
console.log(
  passed
    ? `\n  ${name} passes.${full ? "" : "  Run with --full before shipping."}\n`
    : `\n  ${name} does not pass yet.\n`,
)
process.exit(passed ? 0 : 1)
