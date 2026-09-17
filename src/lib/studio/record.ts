import "server-only"

import { db, schema } from "@/db"
import type { Verb } from "@/lib/studio/activity"
import { newId } from "@/lib/studio/ids"
import type { Membership } from "@/lib/studio/session"

/** One line in the organization's feed. Never allowed to fail the action that called it. */
export async function record(
  m: Membership,
  verb: Verb,
  target: { type: string; id: string | null; name: string },
  meta: Record<string, unknown> = {},
) {
  try {
    await db.insert(schema.activity).values({
      id: newId("act"),
      organizationId: m.org.id,
      actorId: m.user.id,
      verb,
      targetType: target.type,
      targetId: target.id,
      targetName: target.name,
      meta,
    })
  } catch (error) {
    console.error("[studio] activity not recorded", error)
  }
}
