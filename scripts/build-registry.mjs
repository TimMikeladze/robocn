#!/usr/bin/env node
/**
 * Builds the registry into `public/r`.
 *
 * `registry.json` refers to its own items by URL, because that is the only way
 * a registry dependency can point at a registry other than shadcn's own. The
 * host is not known until deploy time, so the manifest carries a placeholder
 * and this script stamps it in.
 */

import { execFileSync } from "node:child_process"
import { readFileSync, rmSync, writeFileSync } from "node:fs"

const registryUrl = (
  process.env.NEXT_PUBLIC_REGISTRY_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "")

const source = readFileSync("registry.json", "utf8")
const stamped = source.replaceAll("{REGISTRY_URL}", registryUrl)
const temporary = "registry.build.json"

writeFileSync(temporary, stamped)
try {
  execFileSync(
    "pnpm",
    ["dlx", "shadcn@latest", "build", temporary, "--output", "public/r"],
    { stdio: "inherit" },
  )
} finally {
  rmSync(temporary, { force: true })
}

console.log(`\nRegistry built for ${registryUrl}`)
