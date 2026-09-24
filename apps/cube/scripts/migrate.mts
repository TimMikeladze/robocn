/**
 * Applies db/schema.sql. Idempotent — part of every build, safe to re-run.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { Pool } from "pg"

import { loadEnv } from "./env.mts"

loadEnv()

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const pool = new Pool({
    connectionString: url,
    max: 1,
    ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  })
  const schema = readFileSync(path.join(import.meta.dirname, "../db/schema.sql"), "utf8")
  try {
    await pool.query(schema)
    console.log("cube: schema applied")
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
