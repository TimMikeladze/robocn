/**
 * db — the only authority on the shared cube.
 *
 * Reads derive everything (`getState`, `getLeaderboard`, `getLog`); the one
 * write path, `submitMove`, is a single transaction under an advisory lock so
 * two people submitting at the same millisecond get two different seqs, and a
 * cube can only ever be archived once.
 */

import { randomInt } from "node:crypto"
import { Pool, type PoolClient } from "pg"
import { formatMove } from "@/lib/robocn/cube"

import {
  RECENT_MOVES,
  SOLVED_BANNER_MS,
  checkMoveBudget,
  daysBetween,
  foldRound,
  freshScramble,
  nextUtcMidnight,
  parseSharedMove,
  utcDay,
  type ArchivedRound,
  type GameStatePayload,
  type MoveBlockReason,
  type PublicMove,
  type RoundView,
} from "@/lib/game"
import { nameOf } from "@/lib/identity"

/** Serialises round creation and move submission. */
const LOCK_ID = 0xc0be2026

interface RoundRow {
  id: number
  scramble: string
  started_at: Date
  solved_at: Date | null
  solved_by: string | null
}

interface MoveRow {
  seq: number
  notation: string
  player_id: string
  player_name: string
  created_at: Date
}

declare global {
  var __cubePool: Pool | undefined
}

function pool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  if (!globalThis.__cubePool) {
    globalThis.__cubePool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    })
  }
  return globalThis.__cubePool
}

/* ----------------------------------------------------------------- reading */

const ROUND_COLUMNS = "id, scramble, started_at, solved_at, solved_by"

async function liveRound(client: PoolClient | Pool): Promise<RoundRow | null> {
  const { rows } = await client.query<RoundRow>(
    `SELECT ${ROUND_COLUMNS} FROM rounds WHERE solved_at IS NULL ORDER BY id DESC LIMIT 1`,
  )
  return rows[0] ?? null
}

async function createRound(client: PoolClient | Pool): Promise<RoundRow> {
  const scramble = freshScramble(randomInt(1, 2 ** 31))
  const { rows } = await client.query<RoundRow>(
    `INSERT INTO rounds (scramble) VALUES ($1) RETURNING ${ROUND_COLUMNS}`,
    [scramble],
  )
  return rows[0]
}

/** There is always a live round: create one when the previous cube was archived. */
export async function ensureRound(): Promise<RoundRow> {
  const client = await pool().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID])
    const round = (await liveRound(client)) ?? (await createRound(client))
    await client.query("COMMIT")
    return round
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function roundMoves(roundId: number): Promise<MoveRow[]> {
  const { rows } = await pool().query<MoveRow>(
    "SELECT seq, notation, player_id, player_name, created_at FROM moves WHERE round_id = $1 ORDER BY seq",
    [roundId],
  )
  return rows
}

function toRoundView(round: RoundRow, moves: MoveRow[]): RoundView {
  const fold = foldRound(round.scramble, moves.map((move) => move.notation))
  return {
    id: round.id,
    scramble: round.scramble,
    state: fold.state,
    moveCount: fold.moveCount,
    playerCount: new Set(moves.map((move) => move.player_id)).size,
    startedAt: round.started_at.toISOString(),
    solvedAt: round.solved_at?.toISOString() ?? null,
    solvedBy: round.solved_by,
  }
}

interface BudgetCounts {
  playerMovesToday: number
  ipMovesToday: number
  msSinceLastMove: number | null
}

async function budgetCounts(
  client: PoolClient,
  roundId: number,
  playerId: string | null,
  ipHash: string,
): Promise<BudgetCounts> {
  const dayStart = `${utcDay()}T00:00:00Z`
  const playerCount = playerId
    ? await client.query<{ count: string }>(
        "SELECT count(*) AS count FROM moves WHERE player_id = $1 AND created_at >= $2",
        [playerId, dayStart],
      )
    : null
  const ipCount = await client.query<{ count: string }>(
    "SELECT count(*) AS count FROM moves WHERE ip_hash = $1 AND created_at >= $2",
    [ipHash, dayStart],
  )
  const last = await client.query<{ created_at: Date }>(
    "SELECT created_at FROM moves WHERE round_id = $1 ORDER BY seq DESC LIMIT 1",
    [roundId],
  )
  const lastAt = last.rows[0]?.created_at
  return {
    playerMovesToday: playerCount ? Number(playerCount.rows[0].count) : 0,
    ipMovesToday: Number(ipCount.rows[0].count),
    msSinceLastMove: lastAt ? Date.now() - lastAt.getTime() : null,
  }
}

/** The last solved round, if its solve is recent enough to still be news. */
async function previousRoundNews(): Promise<ArchivedRound | null> {
  const { rows } = await pool().query<{
    id: number
    final_state: string | null
    started_at: Date
    solved_at: Date
    solved_by: string
    move_count: string
    player_count: string
  }>(
    `SELECT r.id, r.final_state, r.started_at, r.solved_at, r.solved_by,
            count(m.id) AS move_count, count(DISTINCT m.player_id) AS player_count
     FROM rounds r JOIN moves m ON m.round_id = r.id
     WHERE r.solved_at IS NOT NULL
     GROUP BY r.id, r.final_state, r.started_at, r.solved_at, r.solved_by
     ORDER BY r.solved_at DESC
     LIMIT 1`,
  )
  const row = rows[0]
  if (!row) return null
  const solvedAt = new Date(row.solved_at)
  if (Date.now() - solvedAt.getTime() > SOLVED_BANNER_MS) return null
  return {
    id: row.id,
    moveCount: Number(row.move_count),
    playerCount: Number(row.player_count),
    days: daysBetween(new Date(row.started_at), solvedAt),
    startedAt: new Date(row.started_at).toISOString(),
    solvedAt: solvedAt.toISOString(),
    solvedBy: row.solved_by,
    state: row.final_state ?? "",
  }
}

/**
 * The whole game state a client needs. `playerId` is null on first render,
 * before the API has handed out a cookie.
 */
export async function getState(options: {
  playerId: string | null
  ipHash: string
}): Promise<GameStatePayload> {
  const round = await ensureRound()
  const moves = await roundMoves(round.id)
  const client = await pool().connect()
  let budget: BudgetCounts = {
    playerMovesToday: 0,
    ipMovesToday: 0,
    msSinceLastMove: null,
  }
  try {
    budget = await budgetCounts(client, round.id, options.playerId, options.ipHash)
  } finally {
    client.release()
  }

  const check = options.playerId
    ? checkMoveBudget(budget)
    : ({ ok: false, reason: "player" } as const)
  const recent: PublicMove[] = moves.slice(-RECENT_MOVES).map((move) => ({
    seq: move.seq,
    notation: move.notation,
    playerName: move.player_name,
    at: move.created_at.toISOString(),
  }))

  return {
    round: toRoundView(round, moves),
    previous: await previousRoundNews(),
    recent,
    you: options.playerId
      ? {
          id: options.playerId,
          name: nameOf(options.playerId),
          canMove: check.ok,
          blockedBy: check.ok ? null : (check.reason as MoveBlockReason),
          nextMoveAt: check.ok ? null : nextUtcMidnight().toISOString(),
        }
      : { id: "", name: "", canMove: false, blockedBy: null, nextMoveAt: null },
  }
}

/* ----------------------------------------------------------------- writing */

export type SubmitResult =
  | { kind: "bad-move" }
  | { kind: "blocked"; reason: MoveBlockReason; nextMoveAt: string | null }
  | {
      kind: "ok"
      solved: boolean
      payload: GameStatePayload
      /** Only when this move archived the cube. */
      archive: ArchivedRound | null
    }

/**
 * The whole game loop in one transaction: lock, check the budget, insert the
 * move, recompute the state from the log, and — if it lands home — archive the
 * round and scramble the next one before the lock is let go.
 */
export async function submitMove(input: {
  notation: string
  playerId: string
  ipHash: string
}): Promise<SubmitResult> {
  const move = parseSharedMove(input.notation)
  if (!move) return { kind: "bad-move" }
  const notation = formatMove(move)
  const playerName = nameOf(input.playerId)

  const client = await pool().connect()
  let outcome: SubmitResult
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID])

    let round = await liveRound(client)
    if (!round) round = await createRound(client)
    else await client.query("SELECT id FROM rounds WHERE id = $1 FOR UPDATE", [round.id])

    const budget = await budgetCounts(client, round.id, input.playerId, input.ipHash)
    const check = checkMoveBudget(budget)
    if (!check.ok) {
      outcome = {
        kind: "blocked",
        reason: check.reason,
        nextMoveAt: check.reason === "too-fast" ? null : nextUtcMidnight().toISOString(),
      }
    } else {
      const { rows } = await client.query<{ seq: string }>(
        "SELECT coalesce(max(seq), 0) + 1 AS seq FROM moves WHERE round_id = $1",
        [round.id],
      )
      const seq = Number(rows[0].seq)
      await client.query(
        "INSERT INTO moves (round_id, seq, notation, player_id, player_name, ip_hash) VALUES ($1, $2, $3, $4, $5, $6)",
        [round.id, seq, notation, input.playerId, playerName, input.ipHash],
      )

      const log = await client.query<MoveRow>(
        "SELECT seq, notation, player_id, player_name, created_at FROM moves WHERE round_id = $1 ORDER BY seq",
        [round.id],
      )
      const moves = log.rows
      const fold = foldRound(round.scramble, moves.map((entry) => entry.notation))

      let archive: ArchivedRound | null = null
      if (fold.solved) {
        const solvedAt = new Date()
        await client.query(
          "UPDATE rounds SET solved_at = $1, solved_by = $2, final_state = $3 WHERE id = $4",
          [solvedAt, playerName, fold.state, round.id],
        )
        await createRound(client)
        archive = {
          id: round.id,
          moveCount: moves.length,
          playerCount: new Set(moves.map((entry) => entry.player_id)).size,
          days: daysBetween(new Date(round.started_at), solvedAt),
          startedAt: new Date(round.started_at).toISOString(),
          solvedAt: solvedAt.toISOString(),
          solvedBy: playerName,
          state: fold.state,
        }
        outcome = { kind: "ok", solved: true, payload: null as never, archive }
      } else {
        outcome = { kind: "ok", solved: false, payload: null as never, archive: null }
      }
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }

  if (outcome.kind === "ok") {
    // The response payload is read fresh, outside the write transaction.
    outcome = { ...outcome, payload: await getState({ playerId: input.playerId, ipHash: input.ipHash }) }
  }
  return outcome
}

/* ------------------------------------------------------- leaderboard and log */

export async function getLeaderboard(): Promise<ArchivedRound[]> {
  const { rows } = await pool().query<{
    id: number
    final_state: string | null
    started_at: Date
    solved_at: Date
    solved_by: string
    move_count: string
    player_count: string
  }>(
    `SELECT r.id, r.final_state, r.started_at, r.solved_at, r.solved_by,
            count(m.id) AS move_count, count(DISTINCT m.player_id) AS player_count
     FROM rounds r JOIN moves m ON m.round_id = r.id
     WHERE r.solved_at IS NOT NULL
     GROUP BY r.id, r.final_state, r.started_at, r.solved_at, r.solved_by
     ORDER BY r.solved_at DESC
     LIMIT 200`,
  )
  return rows.map((row) => ({
    id: row.id,
    moveCount: Number(row.move_count),
    playerCount: Number(row.player_count),
    days: daysBetween(new Date(row.started_at), new Date(row.solved_at)),
    startedAt: new Date(row.started_at).toISOString(),
    solvedAt: new Date(row.solved_at).toISOString(),
    solvedBy: row.solved_by,
    state: row.final_state ?? "",
  }))
}

export interface RoundLog {
  round: RoundView
  moves: PublicMove[]
}

/** The live round's whole log, newest first. */
export async function getLog(): Promise<RoundLog> {
  const round = await ensureRound()
  const moves = await roundMoves(round.id)
  return {
    round: toRoundView(round, moves),
    moves: moves
      .slice()
      .reverse()
      .map((move) => ({
        seq: move.seq,
        notation: move.notation,
        playerName: move.player_name,
        at: move.created_at.toISOString(),
      })),
  }
}
