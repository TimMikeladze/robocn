import type { Metadata } from "next"
import Link from "next/link"

import { Refresher } from "@/components/refresher"
import { getLog, type RoundLog } from "@/lib/db"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "log" }

function timeLabel(iso: string): string {
  return new Date(iso).toISOString().slice(11, 19) + "Z"
}

/**
 * The whole log of the live cube — the paper trail the state is derived from.
 */
export default async function LogPage() {
  let log: RoundLog | null = null
  let failed = false
  try {
    log = await getLog()
  } catch (error) {
    console.error("cube: log failed", error)
    failed = true
  }

  if (failed || !log) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="border border-border bg-panel px-4 py-3 text-sm">
          The log cannot be reached right now.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Refresher />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-medium">
          Cube #{log.round.id} — the log
        </h1>
        <p className="font-mono text-[12px] text-muted-foreground">
          {log.round.moveCount} moves · {log.round.playerCount} players · scramble{" "}
          <span className="font-mono">{log.round.scramble}</span>
        </p>
      </div>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Every move ever played on the live cube, newest first. The cube&apos;s
        state is derived from exactly this list — nothing else.
      </p>

      {log.moves.length === 0 ? (
        <div className="datum-frame border border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
          No moves yet —{" "}
          <Link href="/" className="underline underline-offset-2">
            yours could be the first
          </Link>
          .
        </div>
      ) : (
        <div className="datum-frame border border-border bg-panel">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-2.5 text-left font-normal">#</th>
                <th className="px-4 py-2.5 text-left font-normal">move</th>
                <th className="px-4 py-2.5 text-left font-normal">by</th>
                <th className="px-4 py-2.5 text-right font-normal">at</th>
              </tr>
            </thead>
            <tbody>
              {log.moves.map((move) => (
                <tr key={move.seq} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-[12px] text-muted-foreground">
                    {move.seq}
                  </td>
                  <td
                    className="px-4 py-2 font-mono text-sm font-medium"
                    style={{ color: "var(--signal)" }}
                  >
                    {move.notation}
                  </td>
                  <td className="px-4 py-2 text-sm text-muted-foreground">{move.playerName}</td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-muted-foreground">
                    {timeLabel(move.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
