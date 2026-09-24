/**
 * identity — who is playing, without accounts.
 *
 * A player is a random cookie set by the API on first contact; an IP is a
 * salted hash for the second rate limit only. Neither is reversible, and no
 * address is ever stored.
 */

import { createHash } from "node:crypto"
import { customAlphabet } from "nanoid"

import { playerNameFor } from "@/lib/game"

export const PLAYER_COOKIE = "cube_player"
export const PLAYER_COOKIE_MAX_AGE = 10 * 365 * 86_400

/** Player ids are 21 url-safe alphanumeric chars — no `-`/`_`, so a name suffix cut from one never needs cleaning. */
const newId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 21)

/** `player-<nanoid>` — the prefix keeps the cookie from ever looking like anything else. */
export function isPlayerId(value: string | undefined | null): value is string {
  return typeof value === "string" && /^player-[0-9A-Za-z]{21}$/.test(value)
}

export function makePlayerId(): string {
  return `player-${newId()}`
}

export function nameOf(playerId: string): string {
  return playerNameFor(playerId)
}

/** The first forwarded hop, or localhost — whatever the platform saw. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  return forwarded?.split(",")[0]?.trim() || "local"
}

/** A salted one-way hash; the salt comes from env so dumps cannot be correlated. */
export function hashIp(ip: string, secret: string): string {
  return createHash("sha256").update(`${ip}:${secret}`).digest("hex").slice(0, 24)
}
