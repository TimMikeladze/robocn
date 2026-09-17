#!/usr/bin/env node
/**
 * Migrations, as part of the production build.
 *
 * `pnpm db:migrate` is drizzle-kit on a developer's machine. This is the same
 * migrations applied by whatever is building the deployment, so a push to main
 * takes the schema with it and nobody has to remember. Notes:
 * `docs/deploying-studio.md`.
 *
 * It refuses to run anywhere but a production build, because a preview build
 * carries a `DATABASE_URL` too and a preview must never migrate production.
 * Locally it does nothing at all: `pnpm db:migrate` is the local command.
 */

import { spawnSync } from "node:child_process"
import process from "node:process"

const environment = process.env.VERCEL_ENV
const skip = (why) => {
  console.log(`db:deploy — skipped: ${why}`)
  process.exit(0)
}

if (!environment) skip("not a Vercel build (use `pnpm db:migrate` locally)")
if (environment !== "production") skip(`${environment} build; only production migrates`)
if (!process.env.DATABASE_URL) {
  // A build that cannot reach the database is a build that must not pretend it
  // migrated. It is still a build: the marketing site does not need Postgres.
  skip("no DATABASE_URL on this environment")
}

console.log("db:deploy — applying migrations to the production database")
const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
})

if (result.status !== 0) {
  console.error("db:deploy — migration failed; the deployment is being stopped")
  process.exit(result.status ?? 1)
}
