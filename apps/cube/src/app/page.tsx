import { GameClient } from "@/components/game-client"
import { getState } from "@/lib/db"

export const dynamic = "force-dynamic"

function Unavailable() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="datum-frame border border-border bg-panel p-8 text-center">
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          unavailable
        </p>
        <p className="mt-2 text-sm">
          The shared cube cannot be reached right now. It keeps every move it was
          given — refresh in a moment.
        </p>
      </div>
    </div>
  )
}

/**
 * The game. The first render comes straight from the database so the cube is
 * on screen before any JavaScript runs; the client then takes over, polls for
 * other people's moves, and handles the daily move.
 */
export default async function Home() {
  let initial: Awaited<ReturnType<typeof getState>> | null = null
  try {
    initial = await getState({ playerId: null, ipHash: "ssr" })
  } catch (error) {
    console.error("cube: initial state failed", error)
  }
  if (!initial) return <Unavailable />
  return <GameClient initial={initial} />
}
