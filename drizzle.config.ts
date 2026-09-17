import { loadEnvConfig } from "@next/env"
import { defineConfig } from "drizzle-kit"

// The same files `next dev` reads, so `pnpm db:migrate` needs no extra setup.
loadEnvConfig(process.cwd())

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
})
