import type { Metadata } from "next"
import Link from "next/link"

import { getLeaderboard } from "@/lib/db"
import type { ArchivedRound } from "@/lib/game"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "leaderboard" }

function dateLabel(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function Row({ round, rank }: { round: ArchivedRound; rank: number }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">{rank}</td>
      <td className="px-4 py-2.5 font-mono text-sm font-medium">cube #{round.id}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{round.moveCount}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{round.playerCount}</td>
      <td className="px-4 py-2.5 text-right font-mono text-sm">{round.days}</td>
      <td className="hidden px-4 py-2.5 font-mono text-[12px] text-muted-foreground sm:table-cell">
        {dateLabel(round.startedAt)}
      </td>
      <td className="px-4 py-2.5 font-mono text-sm" style={{ color: "var(--signal)" }}>
        {round.solvedBy}
      </td>
    </tr>
  )
}

/**
 * The archive: every cube the internet has finished, newest solve first.
 */
export default async function LeaderboardPage() {
  let rounds: ArchivedRound[] = []
  let failed = false
  try {
    rounds = await getLeaderboard()
  } catch (error) {
    console.error("cube: leaderboard failed", error)
    failed = true
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-lg font-medium">Leaderboard</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Every cube the internet has solved, newest first. The player who landed
        the final move archives it under their name.
      </p>

      {failed ? (
        <div className="border border-border bg-panel px-4 py-3 text-sm">
          The archive cannot be reached right now.
        </div>
      ) : rounds.length === 0 ? (
        <div className="datum-frame border border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
          No cube has been solved yet —{" "}
          <Link href="/" className="underline underline-offset-2">
            the first one is still live
          </Link>
          .
        </div>
      ) : (
        <div className="datum-frame border border-border bg-panel">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left font-normal">rank</th>
                <th className="px-4 py-2.5 text-left font-normal">cube</th>
                <th className="px-4 py-2.5 text-right font-normal">moves</th>
                <th className="px-4 py-2.5 text-right font-normal">players</th>
                <th className="px-4 py-2.5 text-right font-normal">days</th>
                <th className="hidden px-4 py-2.5 text-left font-normal sm:table-cell">solved</th>
                <th className="px-4 py-2.5 text-left font-normal">by</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, index) => (
                <Row key={round.id} round={round} rank={index + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
