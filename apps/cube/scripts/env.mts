/**
 * Scripts run outside Next, so the env file is read by hand when the platform
 * has not already supplied the variables.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

export function loadEnv(): void {
  if (process.env.DATABASE_URL) return
  const file = path.join(import.meta.dirname, "../.env.local")
  if (!existsSync(file)) return
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(line)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}
