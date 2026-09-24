/**
 * POST /api/move — one person's one move of the day, on one cube.
 *
 * Body: `{ "move": "R'", "cube": 3 }` — `cube` is the shelf slot, 1–6. The
 * server is the only authority: the notation is parsed here, the budget is
 * checked here, and the cube's state is recomputed here from its scramble and
 * its whole log.
 *
 * 200 ok · 400 bad move · 403 no identity (bootstrap with GET /api/state) ·
 * 404 no such cube · 429 daily/spam limit · 503 the database is asleep.
 */

import { cookies } from "next/headers"

import { submitMove } from "@/lib/db"
import { PLAYER_COOKIE, clientIp, hashIp, isPlayerId } from "@/lib/identity"

export async function POST(request: Request) {
  const playerId = (await cookies()).get(PLAYER_COOKIE)?.value
  if (!isPlayerId(playerId)) {
    return Response.json({ error: "identity" }, { status: 403 })
  }

  let body: { move?: unknown; cube?: unknown }
  try {
    body = (await request.json()) as { move?: unknown; cube?: unknown }
  } catch {
    return Response.json({ error: "bad-move" }, { status: 400 })
  }
  if (typeof body?.move !== "string" || typeof body?.cube !== "number") {
    return Response.json({ error: "bad-move" }, { status: 400 })
  }

  const secret = process.env.CUBE_SECRET ?? "dev"
  const ipHash = hashIp(clientIp(request), secret)

  try {
    const result = await submitMove({
      cube: body.cube,
      notation: body.move,
      playerId,
      ipHash,
    })
    if (result.kind === "bad-move") {
      return Response.json({ error: "bad-move" }, { status: 400 })
    }
    if (result.kind === "unknown-cube") {
      return Response.json({ error: "unknown-cube" }, { status: 404 })
    }
    if (result.kind === "blocked") {
      return Response.json(
        { error: result.reason, nextMoveAt: result.nextMoveAt },
        { status: 429 },
      )
    }
    return Response.json({
      solved: result.solved,
      payload: result.payload,
      archive: result.archive,
    })
  } catch (error) {
    console.error("cube: move failed", error)
    return Response.json({ error: "unavailable" }, { status: 503 })
  }
}
