/**
 * game — the rules of the shared cubes, as pure functions.
 *
 * Everything here is decidable without the database: what a legal shared move
 * is, whether a player may make one, what the state of a round is, what a
 * player is called, when the next move unlocks. `db.ts` feeds it counts and
 * timestamps; the routes and the client consume its payload shapes.
 */

import {
  applyMoves,
  createCube,
  formatAlgorithm,
  isSolved,
  parseAlgorithm,
  parseMove,
  scrambleMoves,
  type CubeMove,
} from "@/lib/robocn/cube"

/* ------------------------------------------------------------------ limits */

/** How many cubes the shelf holds — one live round each, always. */
export const CUBE_SLOTS = 6
/** One move per person per cube per UTC day — the whole idea of the game. */
export const PLAYER_DAILY_LIMIT = 1
/** A second, blunter brake: fresh cookies from one address, per cube. */
export const IP_DAILY_LIMIT = 3
/** Each cube is protected from machine-gun submits of its own. */
export const MIN_MOVE_GAP_MS = 2_000

/** Why a move may not be made right now. */
export type MoveBlockReason = "player" | "ip" | "too-fast"

export interface MoveBudget {
  playerMovesToday: number
  ipMovesToday: number
  /** Milliseconds since the previous move on the round, if there was one. */
  msSinceLastMove: number | null
}

export type MoveCheck =
  | { ok: true }
  | { ok: false; reason: MoveBlockReason }

export function checkMoveBudget(budget: MoveBudget): MoveCheck {
  if (budget.playerMovesToday >= PLAYER_DAILY_LIMIT) return { ok: false, reason: "player" }
  if (budget.ipMovesToday >= IP_DAILY_LIMIT) return { ok: false, reason: "ip" }
  if (
    budget.msSinceLastMove !== null &&
    budget.msSinceLastMove < MIN_MOVE_GAP_MS
  ) {
    return { ok: false, reason: "too-fast" }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------- days */

/** The UTC day a timestamp falls in, as `YYYY-MM-DD` — the bucket limits count. */
export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10)
}

/** The next UTC midnight — when a spent move unlocks. */
export function nextUtcMidnight(at: Date = new Date()): Date {
  const next = new Date(at)
  next.setUTCHours(24, 0, 0, 0)
  return next
}

/** Whole days between two instants, rounded up — how long a cube took. */
export function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))
}

/* ------------------------------------------------------------------- moves */

/**
 * A move the shared cube accepts: classic notation for one **outer** face
 * turn — `R`, `U'`, `F2`. Depth prefixes (`2R`) are a different game and are
 * refused, as is anything the cube library cannot parse.
 */
export function parseSharedMove(notation: string): CubeMove | null {
  if (typeof notation !== "string" || notation.length > 4) return null
  const move = parseMove(notation.trim())
  if (!move || move.layer !== 0) return null
  return move
}

export interface RoundFold {
  /** `scramble + moves` as one algorithm string — what the cube renders. */
  state: string
  solved: boolean
  moveCount: number
}

/** The truth of a round, recomputed from its scramble and its log. */
export function foldRound(scramble: string, notations: string[]): RoundFold {
  const moves = [
    ...parseAlgorithm(scramble),
    ...notations
      .map((token) => parseMove(token))
      .filter((move): move is CubeMove => move !== null),
  ]
  const cube = applyMoves(createCube(3), moves)
  return {
    state: formatAlgorithm(moves),
    solved: isSolved(cube),
    moveCount: notations.length,
  }
}

/** A scramble worth sharing: 20 outer turns that do not land home. */
export function freshScramble(seed: number): string {
  for (let attempt = 0; attempt < 16; attempt++) {
    const moves = scrambleMoves(3, 20, seed + attempt * 7919)
    const folded = foldRound(formatAlgorithm(moves), [])
    if (!folded.solved) return folded.state
  }
  return "R U F"
}

/* ------------------------------------------------------------------- names */

const ADJECTIVES = [
  "teal", "amber", "cobalt", "copper", "graphite", "indigo", "jade", "khaki",
  "lilac", "magenta", "nickel", "olive", "plum", "quartz", "rust", "silver",
  "titan", "ultramarine", "verdant", "walnut", "xantic", "yarrow", "zinc",
  "brisk", "calm", "deft", "eager", "flint", "gleaming", "hasty", "iron",
  "jetty", "keen", "lucid", "misty", "nimble", "opaline", "pesky", "quiet",
] as const

const ANIMALS = [
  "falcon", "otter", "ibex", "heron", "lynx", "marmot", "narwhal", "octopus",
  "puffin", "quokka", "raven", "sable", "tapir", "urchin", "vulture", "wombat",
  "xerus", "yak", "zebu", "badger", "crane", "dingo", "ermine", "ferret",
  "gannet", "hare", "jerboa", "koi", "lemming", "marten", "newt", "orca",
  "pika", "ram", "stoat", "tarsier", "vole", "whelp", "kiang",
] as const

/**
 * A player's display name, derived from their cookie id so it is stable and
 * needs no account. The adjective-animal pair is for reading; the suffix is
 * six characters of the player's own nanoid, so two players who happen to draw
 * the same pair still get different names.
 */
export function playerNameFor(playerId: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let index = 0; index < playerId.length; index++) {
    const byte = playerId.charCodeAt(index)
    a ^= byte
    a = Math.imul(a, 0x01000193) >>> 0
    b = (b + Math.imul(byte + index, 0x85ebca6b)) >>> 0
  }
  const adjective = ADJECTIVES[a % ADJECTIVES.length]
  const animal = ANIMALS[b % ANIMALS.length]
  const suffix = playerId.replace(/^player-/, "").slice(-6)
  return `${adjective}-${animal}-${suffix}`
}

/* ---------------------------------------------------------------- payloads */

/** One logged move, as the feed and the log page show it. */
export interface PublicMove {
  seq: number
  /** The slot of the cube it was played on. */
  cube: number
  notation: string
  playerName: string
  at: string
}

/** A cube: live or archived, whole or in summary. */
export interface RoundView {
  id: number
  /** The shelf slot the cube sits in, 1–6. Stable across rounds. */
  slot: number
  scramble: string
  state: string
  moveCount: number
  playerCount: number
  startedAt: string
  solvedAt: string | null
  solvedBy: string | null
}

/** A solved cube on the leaderboard. */
export interface ArchivedRound {
  id: number
  slot: number
  moveCount: number
  playerCount: number
  days: number
  startedAt: string
  solvedAt: string
  solvedBy: string
  /** The cube's final algorithm — held up for everyone to see the moment. */
  state: string
}

/** Whether this player may turn this cube right now. Keyed by round id. */
export interface CubeStatus {
  canMove: boolean
  blockedBy: MoveBlockReason | null
}

export interface YouView {
  id: string
  name: string
  /** How many of today's per-cube moves are still unspent (0…6). */
  movesLeftToday: number
  nextMoveAt: string | null
  cubes: Record<number, CubeStatus>
}

export interface GameStatePayload {
  /** The shelf: six live cubes, ordered by slot. */
  rounds: RoundView[]
  /** The round before the newest archive, while its solve is still news. */
  previous: ArchivedRound | null
  recent: PublicMove[]
  you: YouView
}

export const RECENT_MOVES = 18
/** How long after a solve the banner keeps appearing for arriving players. */
export const SOLVED_BANNER_MS = 5 * 60_000
