/**
 * The one Postgres client.
 *
 * Cached on `globalThis` because Fast Refresh re-evaluates this module and a
 * pool per evaluation runs a dev database out of connections in an afternoon.
 * The URL is read lazily so importing a schema type never needs an env var.
 */

import "server-only"

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

type Database = PostgresJsDatabase<typeof schema>

const cache = globalThis as unknown as { __studioDb?: Database }

export function databaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set. Studio needs Postgres — see docs/studio.md.")
  }
  return url
}

function connect(): Database {
  const client = postgres(databaseUrl(), {
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idle_timeout: 20,
    // Silences the NOTICE for `create table if not exists` during migrations.
    onnotice: () => {},
  })
  return drizzle(client, { schema, casing: undefined })
}

/** A proxy so `db` can be imported at module scope without connecting. */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    cache.__studioDb ??= connect()
    return Reflect.get(cache.__studioDb, property, receiver)
  },
})

export { schema }
