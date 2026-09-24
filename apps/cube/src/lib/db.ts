/**
 * db — the only authority on the shared cubes.
 *
 * Reads derive everything (`getState`, `getLeaderboard`, `getLog`); the one
 * write path, `submitMove`, is a single transaction under an advisory lock so
 * two people submitting at the same millisecond get two different seqs, and a
 * cube can only ever be archived once — by whoever's transaction lands first.
 */

import { randomInt } from "node:crypto"
import { Pool, type PoolClient } from "pg"
import { formatMove } from "@/lib/robocn/cube"

import {
  CUBE_SLOTS,
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
  type CubeStatus,
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
  slot: number | null
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

const ROUND_COLUMNS = "id, slot, scramble, started_at, solved_at, solved_by"

async function liveRounds(client: PoolClient | Pool): Promise<RoundRow[]> {
  const { rows } = await client.query<RoundRow>(
    `SELECT ${ROUND_COLUMNS} FROM rounds WHERE solved_at IS NULL ORDER BY slot NULLS LAST, id`,
  )
  return rows
}

async function createRound(client: PoolClient, slot: number): Promise<RoundRow> {
  const scramble = freshScramble(randomInt(1, 2 ** 31))
  const { rows } = await client.query<RoundRow>(
    `INSERT INTO rounds (scramble, slot) VALUES ($1, $2) RETURNING ${ROUND_COLUMNS}`,
    [scramble, slot],
  )
  return rows[0]
}

/**
 * There are always six live rounds, one per slot: the shelf is topped up
 * whenever a slot is found empty (first boot, a fresh deploy on a moved
 * database, or the one-cube era meeting the new schema).
 */
export async function ensureRounds(): Promise<RoundRow[]> {
  const client = await pool().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID])
    const rounds = await liveRounds(client)
    const taken = new Set(rounds.map((round) => round.slot))
    for (let slot = 1; slot <= CUBE_SLOTS; slot++) {
      if (!taken.has(slot)) rounds.push(await createRound(client, slot))
    }
    await client.query("COMMIT")
    return rounds.sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99))
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
    slot: round.slot ?? 0,
    scramble: round.scramble,
    state: fold.state,
    moveCount: fold.moveCount,
    playerCount: new Set(moves.map((move) => move.player_id)).size,
    startedAt: round.started_at.toISOString(),
    solvedAt: round.solved_at?.toISOString() ?? null,
    solvedBy: round.solved_by,
  }
}

/* ---------------------------------------------------------------- budgets */

/**
 * Per-cube counts for the rate limits, plus each cube's own settle gap.
 * Player and IP counts are scoped to the round: each cube is standalone, so
 * a move spent on cube 2 does not touch cube 5's budget.
 */
async function budgetCounts(
  client: PoolClient,
  rounds: RoundRow[],
  playerId: string | null,
  ipHash: string,
): Promise<Map<number, { playerMovesToday: number; ipMovesToday: number; msSinceLastMove: number | null }>> {
  const dayStart = `${utcDay()}T00:00:00Z`
  const ids = rounds.map((round) => round.id)
  const playerCounts = playerId
    ? await client.query<{ round_id: number; count: string }>(
        "SELECT round_id, count(*) AS count FROM moves WHERE player_id = $1 AND created_at >= $2 AND round_id = ANY($3) GROUP BY round_id",
        [playerId, dayStart, ids],
      )
    : null
  const ipCounts = await client.query<{ round_id: number; count: string }>(
    "SELECT round_id, count(*) AS count FROM moves WHERE ip_hash = $1 AND created_at >= $2 AND round_id = ANY($3) GROUP BY round_id",
    [ipHash, dayStart, ids],
  )
  const lastMoves = await client.query<{ round_id: number; created_at: Date }>(
    "SELECT DISTINCT ON (round_id) round_id, created_at FROM moves WHERE round_id = ANY($1) ORDER BY round_id, created_at DESC",
    [ids],
  )

  const result = new Map<
    number,
    { playerMovesToday: number; ipMovesToday: number; msSinceLastMove: number | null }
  >()
  for (const round of rounds) {
    result.set(round.id, { playerMovesToday: 0, ipMovesToday: 0, msSinceLastMove: null })
  }
  for (const row of playerCounts?.rows ?? []) {
    result.get(row.round_id)!.playerMovesToday = Number(row.count)
  }
  for (const row of ipCounts.rows) {
    result.get(row.round_id)!.ipMovesToday = Number(row.count)
  }
  for (const row of lastMoves.rows) {
    result.get(row.round_id)!.msSinceLastMove = Date.now() - new Date(row.created_at).getTime()
  }
  return result
}

/** The last solved round, if its solve is recent enough to still be news. */
async function previousRoundNews(): Promise<ArchivedRound | null> {
  const { rows } = await pool().query<{
    id: number
    slot: number | null
    final_state: string | null
    started_at: Date
    solved_at: Date
    solved_by: string
    move_count: string
    player_count: string
  }>(
    `SELECT r.id, r.slot, r.final_state, r.started_at, r.solved_at, r.solved_by,
            count(m.id) AS move_count, count(DISTINCT m.player_id) AS player_count
     FROM rounds r JOIN moves m ON m.round_id = r.id
     WHERE r.solved_at IS NOT NULL
     GROUP BY r.id, r.slot, r.final_state, r.started_at, r.solved_at, r.solved_by
     ORDER BY r.solved_at DESC
     LIMIT 1`,
  )
  const row = rows[0]
  if (!row) return null
  const solvedAt = new Date(row.solved_at)
  if (Date.now() - solvedAt.getTime() > SOLVED_BANNER_MS) return null
  return {
    id: row.id,
    slot: row.slot ?? 0,
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
 * The whole game state a client needs: the shelf, and this player's standing
 * on every cube of it. `playerId` is null on first render, before the API has
 * handed out a cookie.
 */
export async function getState(options: {
  playerId: string | null
  ipHash: string
}): Promise<GameStatePayload> {
  const rounds = await ensureRounds()
  const movesByRound = new Map<number, MoveRow[]>()
  for (const round of rounds) {
    movesByRound.set(round.id, await roundMoves(round.id))
  }

  const client = await pool().connect()
  const statuses = new Map<number, CubeStatus>()
  try {
    const budgets = await budgetCounts(client, rounds, options.playerId, options.ipHash)
    for (const round of rounds) {
      const budget = budgets.get(round.id) ?? {
        playerMovesToday: 0,
        ipMovesToday: 0,
        msSinceLastMove: null,
      }
      const check = options.playerId
        ? checkMoveBudget(budget)
        : ({ ok: false, reason: "player" } as const)
      statuses.set(round.id, {
        canMove: check.ok,
        blockedBy: check.ok ? null : (check.reason as MoveBlockReason),
      })
    }
  } finally {
    client.release()
  }

  // The feed: recent moves from across the shelf, oldest first.
  const recent: PublicMove[] = []
  for (const round of rounds) {
    for (const move of movesByRound.get(round.id) ?? []) {
      recent.push({
        seq: move.seq,
        cube: round.slot ?? 0,
        notation: move.notation,
        playerName: move.player_name,
        at: move.created_at.toISOString(),
      })
    }
  }
  recent.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  if (recent.length > RECENT_MOVES) recent.splice(0, recent.length - RECENT_MOVES)

  const cubes: Record<number, CubeStatus> = {}
  let movesLeftToday = 0
  for (const round of rounds) {
    const status = statuses.get(round.id) ?? { canMove: false, blockedBy: null }
    cubes[round.id] = status
    if (status.canMove || status.blockedBy === "too-fast") movesLeftToday += 1
  }

  return {
    rounds: rounds.map((round) => toRoundView(round, movesByRound.get(round.id) ?? [])),
    previous: await previousRoundNews(),
    recent,
    you: options.playerId
      ? {
          id: options.playerId,
          name: nameOf(options.playerId),
          movesLeftToday,
          nextMoveAt: movesLeftToday === 0 ? nextUtcMidnight().toISOString() : null,
          cubes,
        }
      : { id: "", name: "", movesLeftToday: 0, nextMoveAt: null, cubes },
  }
}

/* ----------------------------------------------------------------- writing */

export type SubmitResult =
  | { kind: "bad-move" }
  | { kind: "unknown-cube" }
  | { kind: "blocked"; reason: MoveBlockReason; nextMoveAt: string | null }
  | {
      kind: "ok"
      solved: boolean
      payload: GameStatePayload
      /** Only when this move archived the cube. */
      archive: ArchivedRound | null
    }

/**
 * The whole game loop in one transaction: lock the slot's round, check the
 * budget, insert the move, recompute the state from the log, and — if it
 * lands home — archive the round and scramble that slot's next one before the
 * lock is let go.
 */
export async function submitMove(input: {
  cube: number
  notation: string
  playerId: string
  ipHash: string
}): Promise<SubmitResult> {
  if (!Number.isInteger(input.cube) || input.cube < 1 || input.cube > CUBE_SLOTS) {
    return { kind: "unknown-cube" }
  }
  const move = parseSharedMove(input.notation)
  if (!move) return { kind: "bad-move" }
  const notation = formatMove(move)
  const playerName = nameOf(input.playerId)

  const client = await pool().connect()
  let outcome: SubmitResult
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_ID])

    const { rows } = await client.query<RoundRow>(
      `SELECT ${ROUND_COLUMNS} FROM rounds WHERE solved_at IS NULL AND slot = $1 LIMIT 1`,
      [input.cube],
    )
    let round = rows[0]
    if (!round) round = await createRound(client, input.cube)
    else await client.query("SELECT id FROM rounds WHERE id = $1 FOR UPDATE", [round.id])

    const budgets = await budgetCounts(client, [round], input.playerId, input.ipHash)
    const check = checkMoveBudget(
      budgets.get(round.id) ?? { playerMovesToday: 0, ipMovesToday: 0, msSinceLastMove: null },
    )
    if (!check.ok) {
      outcome = {
        kind: "blocked",
        reason: check.reason,
        nextMoveAt: check.reason === "too-fast" ? null : nextUtcMidnight().toISOString(),
      }
    } else {
      const seqRow = await client.query<{ seq: string }>(
        "SELECT coalesce(max(seq), 0) + 1 AS seq FROM moves WHERE round_id = $1",
        [round.id],
      )
      const seq = Number(seqRow.rows[0].seq)
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
        await createRound(client, input.cube)
        archive = {
          id: round.id,
          slot: input.cube,
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
    slot: number | null
    final_state: string | null
    started_at: Date
    solved_at: Date
    solved_by: string
    move_count: string
    player_count: string
  }>(
    `SELECT r.id, r.slot, r.final_state, r.started_at, r.solved_at, r.solved_by,
            count(m.id) AS move_count, count(DISTINCT m.player_id) AS player_count
     FROM rounds r JOIN moves m ON m.round_id = r.id
     WHERE r.solved_at IS NOT NULL
     GROUP BY r.id, r.slot, r.final_state, r.started_at, r.solved_at, r.solved_by
     ORDER BY r.solved_at DESC
     LIMIT 200`,
  )
  return rows.map((row) => ({
    id: row.id,
    slot: row.slot ?? 0,
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
  /** The shelf, for the switcher: slot and id of every live cube. */
  cubes: { slot: number; id: number; moveCount: number }[]
}

/** One cube's whole log, newest first. `slot` picks the cube (default 1). */
export async function getLog(slot = 1): Promise<RoundLog> {
  const rounds = await ensureRounds()
  const bounded = Number.isInteger(slot) && slot >= 1 && slot <= CUBE_SLOTS ? slot : 1
  const round = rounds.find((entry) => (entry.slot ?? 0) === bounded) ?? rounds[0]
  const moves = await roundMoves(round.id)
  // The shelf summary for the switcher: each cube's id and its own move count.
  const counts = await pool().query<{ round_id: number; count: string }>(
    "SELECT round_id, count(*) AS count FROM moves WHERE round_id = ANY($1) GROUP BY round_id",
    [rounds.map((entry) => entry.id)],
  )
  const countOf = new Map(counts.rows.map((row) => [row.round_id, Number(row.count)]))
  return {
    round: toRoundView(round, moves),
    moves: moves
      .slice()
      .reverse()
      .map((move) => ({
        seq: move.seq,
        cube: round.slot ?? 0,
        notation: move.notation,
        playerName: move.player_name,
        at: move.created_at.toISOString(),
      })),
    cubes: rounds.map((entry) => ({
      slot: entry.slot ?? 0,
      id: entry.id,
      moveCount: countOf.get(entry.id) ?? 0,
    })),
  }
}
