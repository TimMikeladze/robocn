/**
 * GET /api/state — the whole game state, and the first handshake.
 *
 * Establishes the anonymous player cookie on first contact, then returns the
 * six live cubes, recent moves from across the shelf, the previous round's
 * news, and whether this player may move on each cube today.
 */

import { cookies } from "next/headers"

import { getState } from "@/lib/db"
import { PLAYER_COOKIE, PLAYER_COOKIE_MAX_AGE, hashIp, clientIp, isPlayerId, makePlayerId } from "@/lib/identity"

export async function GET(request: Request) {
  const jar = await cookies()
  const existing = jar.get(PLAYER_COOKIE)?.value
  const playerId = isPlayerId(existing) ? existing : makePlayerId()

  const secret = process.env.CUBE_SECRET ?? "dev"
  const ipHash = hashIp(clientIp(request), secret)

  try {
    const payload = await getState({ playerId, ipHash })
    if (!isPlayerId(existing)) {
      jar.set(PLAYER_COOKIE, playerId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: PLAYER_COOKIE_MAX_AGE,
        path: "/",
      })
    }
    return Response.json(payload)
  } catch (error) {
    console.error("cube: state failed", error)
    return Response.json({ error: "unavailable" }, { status: 503 })
  }
}
