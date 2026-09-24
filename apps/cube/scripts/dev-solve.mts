/**
 * dev-solve — verification tool, not part of the game.
 *
 * Plays a real solution onto one cube's live round through the real
 * `submitMove` path — one synthetic player per move, honouring every rate
 * limit — until the cube is archived and that slot's next round is scrambled.
 * Run it against the preview database and watch the archive → leaderboard →
 * next-round transition happen. Usage: `pnpm dev:solve [cube 1-6]`.
 */
import { getLeaderboard, getState, submitMove } from "../src/lib/db"
import { makePlayerId } from "../src/lib/identity"
import { CUBE_SLOTS } from "../src/lib/game"
import { formatMove, invertMoves, parseAlgorithm } from "../src/lib/robocn/cube"

import { loadEnv } from "./env.mts"

loadEnv()

const slot = Math.min(CUBE_SLOTS, Math.max(1, Number.parseInt(process.argv[2] ?? "1", 10) || 1))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const before = await getState({ playerId: makePlayerId(), ipHash: "script" })
  const round = before.rounds.find((entry) => entry.slot === slot) ?? before.rounds[0]
  console.log(
    `c${round.slot} #${round.id}: ${round.moveCount} moves played so far, scramble ${round.scramble}`,
  )

  // The exact inverse of everything the cube has been through — the shortest
  // honest line home, and a check of invertMoves on the way.
  const line = invertMoves(parseAlgorithm(round.state))
  console.log(`inverse line: ${line.length} moves`)

  let step = 0
  for (const move of line) {
    step += 1
    // Each synthetic player is fresh; the round-level 2 s gap is honoured.
    await sleep(2100)
    const result = await submitMove({
      cube: round.slot,
      notation: formatMove(move),
      playerId: makePlayerId(),
      ipHash: `script-${step}`,
    })
    if (result.kind !== "ok") {
      console.error(`move ${formatMove(move)} rejected:`, result)
      process.exit(1)
    }
    if (step % 5 === 0 || result.solved) {
      console.log(`  ${step} moves played${result.solved ? " — solved!" : ""}`)
    }
    if (result.solved) {
      console.log("archive:", JSON.stringify(result.archive))
      break
    }
  }

  const after = await getState({ playerId: makePlayerId(), ipHash: "script" })
  const next = after.rounds.find((entry) => entry.slot === slot)
  console.log(`c${slot} is now #${next?.id} with scramble ${next?.scramble}`)
  const board = await getLeaderboard()
  console.log(`leaderboard: ${board.length} solved cube(s), newest is #${board[0]?.id}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
