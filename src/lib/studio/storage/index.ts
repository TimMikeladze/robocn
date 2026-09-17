/**
 * Where bytes go.
 *
 * Two drivers behind one contract. `postgres` needs nothing but the database
 * Studio already has, which is why it is the default; `vercel-blob` takes over
 * when `BLOB_READ_WRITE_TOKEN` is set. Each asset row records the driver that
 * wrote it, so switching does not orphan what is already stored.
 */

import "server-only"

import { postgresDriver } from "./postgres"
import { vercelBlobDriver } from "./vercel-blob"

export interface StoredObject {
  bytes: Uint8Array
  mime: string
}

export interface StorageDriver {
  readonly id: "postgres" | "vercel-blob"
  put(input: { key: string; organizationId: string; mime: string; bytes: Uint8Array }): Promise<void>
  get(key: string): Promise<StoredObject | null>
  delete(keys: string[]): Promise<void>
}

const drivers = { postgres: postgresDriver, "vercel-blob": vercelBlobDriver } as const

export type DriverId = keyof typeof drivers

/** The driver new uploads are written with. */
export const activeDriver = (): StorageDriver =>
  process.env.BLOB_READ_WRITE_TOKEN ? vercelBlobDriver : postgresDriver

/** The driver a stored row was written with. */
export const driverFor = (id: string): StorageDriver => drivers[id as DriverId] ?? postgresDriver
