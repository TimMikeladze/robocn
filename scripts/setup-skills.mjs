/**
 * Mirrors `skills/` into the two places this repository's own agents look.
 *
 * `skills/` is the source of truth and the only committed copy — it is also the
 * layout the `skills` CLI walks, so `npx skills add TimMikeladze/robocn` offers
 * the same four skills to anyone outside. `.claude/skills/` and `.agents/skills/`
 * are generated and ignored, so there is nothing to keep in sync by hand.
 *
 * Notes: `docs/robot-skills.md`.
 */

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, "skills");
const mirrors = [
  resolve(repoRoot, ".claude/skills"),
  resolve(repoRoot, ".agents/skills"),
];

const skills = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const mirror of mirrors) {
  await mkdir(mirror, { recursive: true });
  for (const skill of skills) {
    // Replace rather than merge, so a reference deleted upstream does not
    // linger in the mirror and get read as current.
    await rm(resolve(mirror, skill), { recursive: true, force: true });
    await cp(resolve(source, skill), resolve(mirror, skill), { recursive: true });
  }
}

console.log(`Installed ${skills.length} robocn skills: ${skills.join(", ")}`);
