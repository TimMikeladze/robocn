/**
 * The envelope every Studio server action answers in.
 *
 * An action that throws shows the user Next's generic error and hides the
 * reason in production, so expected failures — a bad name, a missing
 * permission — come back as values. Anything unexpected still throws.
 */

import { ZodError } from "zod"

import { StudioError } from "@/lib/studio/session"

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() }
  } catch (error) {
    if (error instanceof StudioError) return { ok: false, error: error.message }
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "That input is not valid." }
    }
    // `redirect()` and `notFound()` are thrown on purpose and must keep going.
    throw error
  }
}
