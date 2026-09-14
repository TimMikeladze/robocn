import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, ".claude/skills/ship-robot/SKILL.md");
const destination = resolve(repoRoot, ".agents/skills/ship-robot/SKILL.md");

await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { force: true });

console.log("Installed ship-robot skill for Codex.");
