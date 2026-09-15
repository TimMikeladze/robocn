import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * `skills/` is published: `bunx skills add TimMikeladze/robocn` reads it
 * straight off GitHub, and `pnpm install` mirrors it into `.claude/skills` and
 * `.agents/skills`. So the things that break it are frontmatter the CLI cannot
 * parse, and — the one that actually costs an agent a turn — a path named in a
 * skill that does not exist any more.
 *
 * Notes: `docs/robot-skills.md`.
 */

const root = process.cwd()
const skillsDir = path.join(root, "skills")

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

/** Every markdown file a skill ships, SKILL.md and its references. */
const documents = skills.flatMap((skill) => {
  const base = path.join(skillsDir, skill)
  const references = path.join(base, "references")
  return [
    path.join(base, "SKILL.md"),
    ...(existsSync(references)
      ? readdirSync(references).map((file) => path.join(references, file))
      : []),
  ]
})

const frontmatter = (source: string) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source)
  if (!match) return null
  return Object.fromEntries(
    match[1]
      .split("\n")
      .filter((row) => /^[a-z]+:/.test(row))
      .map((row) => [row.slice(0, row.indexOf(":")), row.slice(row.indexOf(":") + 1).trim()]),
  )
}

describe("the published skills", () => {
  it("ships exactly the four the repository documents", () => {
    expect([...skills].sort()).toEqual([
      "build-robot",
      "fork-robot",
      "publish-robot",
      "refine-robot",
    ])
  })

  it.each(skills)("gives %s frontmatter the skills CLI can read", (skill) => {
    const front = frontmatter(readFileSync(path.join(skillsDir, skill, "SKILL.md"), "utf8"))

    expect(front, "SKILL.md must open with a --- frontmatter block").not.toBeNull()
    // The CLI keys installs off `name`, and routes off `description`.
    expect(front!.name).toBe(skill)
    expect(front!.description.length).toBeGreaterThan(80)
  })

  /**
   * The expensive failure: a skill that sends an agent to a file that was
   * renamed or deleted. Placeholders (`<name>`) and globs are skipped; anything
   * concrete has to resolve, either inside the skill or from the repo root.
   */
  it.each(documents.map((file) => path.relative(root, file)))("names only real paths in %s", (file) => {
    const source = readFileSync(path.join(root, file), "utf8")
    const here = path.dirname(path.join(root, file))
    const cited = [...source.matchAll(/`((?:src|docs|scripts|skills|public|references)\/[^`\s]+)`/g)]
      .map((match) => match[1])
      .filter((value) => !value.includes("<") && !value.includes("*") && /\.\w+$/.test(value))

    const missing = [...new Set(cited)].filter(
      (value) => !existsSync(path.join(here, value)) && !existsSync(path.join(root, value)),
    )

    expect(missing, `paths that do not exist: ${missing.join(", ")}`).toEqual([])
  })

  it("runs the commands build-robot tells an agent to run", () => {
    const scripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts

    expect(scripts["robot:new"]).toBe("node scripts/new-robot.mjs")
    expect(scripts["robot:check"]).toBe("node scripts/check-robot.mjs")
  })
})

describe("pnpm robot:new", () => {
  const run = (args: string[]) =>
    spawnSync("node", ["scripts/new-robot.mjs", ...args], { cwd: root, encoding: "utf8" })

  it("plans a machine without writing anything", () => {
    const result = run(["scaffold-probe", "--dry-run", "--solver", "scaffold-solver"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("src/components/ui/scaffold-probe.tsx")
    expect(result.stdout).toContain("src/lib/robocn/scaffold-solver.ts")
    expect(existsSync(path.join(root, "src/components/ui/scaffold-probe.tsx"))).toBe(false)
  })

  /**
   * The point of the command: one call, and the machine is on the site. A dry
   * run executes every transform, so an anchor that moved in one of these files
   * fails here rather than halfway through a real write.
   */
  it("wires the machine into every file the site is built from", () => {
    const result = run(["scaffold-probe", "--dry-run", "--solver", "scaffold-solver"])

    expect(result.status).toBe(0)
    for (const file of [
      "registry.json",
      "src/components/ui/__tests__/views.test.tsx",
      "src/lib/docs.ts",
      "src/components/demos/demos.tsx",
      "src/components/site/catalogue.tsx",
      "README.md",
    ]) {
      expect(result.stdout, `${file} is not in the plan`).toContain(file)
    }
  })

  /**
   * Every lib item in the registry keeps its suffix on the item name and drops
   * it from the file — `walker-kinematics` lives in `walker.ts`. A scaffolder
   * that wrote `walker-kinematics.ts` would be the only one that did not.
   */
  it("drops -geometry and -kinematics from the solver's file name", () => {
    // A name the registry cannot already ship, so that shipping a real solver
    // never turns this probe into a name collision.
    const result = run(["scaffold-probe", "--dry-run", "--solver", "probe-geometry"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("src/lib/robocn/probe.ts")
    expect(result.stdout).toContain("src/lib/robocn/__tests__/probe.test.ts")
    // The registry item keeps the suffix.
    expect(result.stdout).toContain("probe-geometry")
    expect(result.stdout).not.toContain("probe-geometry.ts")
  })

  it("stops at the installable minimum when asked", () => {
    const result = run(["scaffold-probe", "--dry-run", "--minimal"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("registry.json")
    expect(result.stdout).not.toContain("src/lib/docs.ts")
    expect(result.stdout).not.toContain("src/components/site/catalogue.tsx")
  })

  it("refuses a docs group that is not one of the four", () => {
    const result = run(["scaffold-probe", "--dry-run", "--group", "Gadgets"])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/--group must be one of/)
  })

  it("refuses a name the registry already ships", () => {
    const result = run(["robot-arm", "--dry-run"])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/already ships/)
  })

  it("refuses a name that is not kebab-case", () => {
    const result = run(["RobotArm", "--dry-run"])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/kebab-case/)
  })

  it("refuses a dependency the registry does not have", () => {
    const result = run(["scaffold-probe", "--dry-run", "--deps", "not-a-real-item"])

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/not-a-real-item/)
  })
})

describe("pnpm robot:check", () => {
  it("refuses an item the registry does not know", () => {
    const result = spawnSync("node", ["scripts/check-robot.mjs", "not-a-real-item"], {
      cwd: root,
      encoding: "utf8",
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/ships no item/)
  })
})
