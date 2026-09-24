"use client"

/**
 * game-client — the shared cubes, as they are played.
 *
 * The server owns the truth; the cube components own the feel. They meet
 * here: every cube runs controlled on its own `scramble + moves`, remote
 * moves arrive as animated appends, and a player's own move is proposed by
 * hand (drag or key) on one cube, confirmed on the bar, and reconciled by a
 * remount onto what the server now says — so a local cube and its shared
 * twin can never drift.
 */

import * as React from "react"

import { PuzzleCube, type PuzzleCubeApi } from "@/components/ui/puzzle-cube"
import { CUBE_SLOTS, daysBetween, type GameStatePayload, type RoundView } from "@/lib/game"
import { formatMove, type CubeMove } from "@/lib/robocn/cube"

const POLL_MS = 15_000
/** How long a freshly solved cube is held up before its replacement shows. */
const SOLVED_HOLD_MS = 4_500

/** What one grid cell is showing — deliberately decoupled from the payload. */
interface Display {
  roundId: number
  algorithm: string
  key: number
}

type Displays = Record<number, Display>

/**
 * Keys the demo cube reserves for itself; a shared cube must not obey them.
 * Arrow keys are left alone — they only turn that cube's own camera.
 */
const RESERVED_KEYS = new Set(["s", "h", "enter", "backspace", "escape"])

/**
 * The angle each spent cube is drawn from, so the shelf shows six different
 * sides of itself. Cubes you can still turn get the free camera instead.
 */
const IDLE_AZIMUTHS = [-35, -18, -6, 6, 18, 35] as const

interface Proposal {
  slot: number
  roundId: number
  notation: string
}

function relative(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}

function countdown(iso: string): string {
  const seconds = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function count(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`
}

export function GameClient({ initial }: { initial: GameStatePayload }) {
  const [payload, setPayload] = React.useState<GameStatePayload>(initial)
  const [displays, setDisplays] = React.useState<Displays>(() =>
    Object.fromEntries(
      initial.rounds.map((round) => [
        round.slot,
        { roundId: round.id, algorithm: round.state, key: 0 },
      ]),
    ),
  )
  const [proposal, setProposal] = React.useState<Proposal | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"live" | "practice">("live")
  const [dismissedNews, setDismissedNews] = React.useState<number | null>(null)
  const practiceApi = React.useRef<PuzzleCubeApi | null>(null)
  const swapTimers = React.useRef<Record<number, number>>({})
  const proposing = React.useRef(false)

  React.useEffect(() => {
    proposing.current = proposal !== null
  }, [proposal])

  React.useEffect(
    () => () => {
      for (const timer of Object.values(swapTimers.current)) window.clearTimeout(timer)
    },
    [],
  )

  const bootstrapped = payload.you.id !== ""

  /* -------------------------------------------------------- fetching state */

  const scheduleSwap = React.useCallback((slot: number, display: Display) => {
    window.clearTimeout(swapTimers.current[slot])
    swapTimers.current[slot] = window.setTimeout(() => {
      setDisplays((current) => ({ ...current, [slot]: display }))
    }, SOLVED_HOLD_MS)
  }, [])

  const applyPayload = React.useCallback(
    (next: GameStatePayload) => {
      setPayload(next)
      setDisplays((current) => {
        const out: Displays = { ...current }
        for (const round of next.rounds) {
          const shown = out[round.slot]
          if (!shown) {
            out[round.slot] = { roundId: round.id, algorithm: round.state, key: 0 }
            continue
          }
          if (round.id === shown.roundId) {
            // Same cube: remote moves arrive as animated appends.
            out[round.slot] = { ...shown, algorithm: round.state }
            continue
          }
          window.clearTimeout(swapTimers.current[round.slot])
          if (next.previous && next.previous.id === shown.roundId) {
            // The cube we were watching was just solved: hold up the solved
            // state — the winning move animates in — then bring on the next.
            scheduleSwap(round.slot, { roundId: round.id, algorithm: round.state, key: shown.key + 1 })
            out[round.slot] = { ...shown, algorithm: next.previous.state }
          } else {
            out[round.slot] = { roundId: round.id, algorithm: round.state, key: shown.key + 1 }
          }
        }
        return out
      })
    },
    [scheduleSwap],
  )

  const fetchState = React.useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" })
      if (!response.ok) return
      const next = (await response.json()) as GameStatePayload
      if (!proposing.current) applyPayload(next)
    } catch {
      // The next poll will try again.
    }
  }, [applyPayload])

  // First contact: the cookie and the player's name come from the API.
  React.useEffect(() => {
    const timer = window.setTimeout(() => void fetchState(), 0)
    return () => window.clearTimeout(timer)
  }, [fetchState])

  React.useEffect(() => {
    const every = window.setInterval(() => {
      if (!document.hidden && !proposing.current) void fetchState()
    }, POLL_MS)
    const onFocus = () => {
      if (!proposing.current) void fetchState()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(every)
      window.removeEventListener("focus", onFocus)
    }
  }, [fetchState])

  React.useEffect(() => {
    if (!notice) return
    const clear = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(clear)
  }, [notice])

  /* ------------------------------------------------------------- proposing */

  const canMoveOn = React.useCallback(
    (roundId: number) => payload.you.cubes[roundId]?.canMove === true,
    [payload.you.cubes],
  )

  const onCubeMove = React.useCallback(
    (slot: number, roundId: number, move: CubeMove) => {
      if (mode !== "live" || !canMoveOn(roundId) || proposal) return
      setProposal({ slot, roundId, notation: formatMove(move) })
    },
    [canMoveOn, mode, proposal],
  )

  /** Put a cube back onto exactly what the server last said, unmoved. */
  const remount = React.useCallback((slot: number, algorithm: string, bump = 1) => {
    setDisplays((current) => {
      const shown = current[slot]
      if (!shown) return current
      return { ...current, [slot]: { roundId: shown.roundId, algorithm, key: shown.key + bump } }
    })
  }, [])

  const discard = React.useCallback(() => {
    if (!proposal) return
    const round = payload.rounds.find((entry) => entry.slot === proposal.slot)
    if (round) remount(proposal.slot, round.state)
    setProposal(null)
  }, [payload.rounds, proposal, remount])

  const play = React.useCallback(async () => {
    if (!proposal || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ move: proposal.notation, cube: proposal.slot }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        nextMoveAt?: string | null
        solved?: boolean
        payload?: GameStatePayload
      }
      if (response.ok && body.payload) {
        const next = body.payload
        const slot = proposal.slot
        setProposal(null)
        setPayload(next)
        const round = next.rounds.find((entry) => entry.slot === slot)
        if (body.solved && next.previous) {
          // Hold the solved cube up — the local cube is already showing it —
          // then swap in the fresh scramble for that slot.
          setDisplays((current) => {
            const shown = current[slot]
            if (!shown) return current
            return { ...current, [slot]: { ...shown, algorithm: next.previous!.state } }
          })
          if (round) {
            scheduleSwap(slot, { roundId: round.id, algorithm: round.state, key: displays[slot].key + 1 })
          }
        } else if (round) {
          remount(slot, round.state)
        }
        return
      }
      if (response.status === 429 && body.error === "too-fast") {
        setNotice("that cube is still settling — try again in a second")
        return
      }
      if (response.status === 429) {
        setNotice(
          body.nextMoveAt
            ? `that was your move on this cube for today — the next one unlocks in ${countdown(body.nextMoveAt)}`
            : "daily limit reached on this cube",
        )
        setProposal(null)
        void fetchState()
        return
      }
      if (response.status === 403) {
        setNotice("the cubes do not know you yet — one moment")
        await fetchState()
        return
      }
      if (response.status === 404) {
        setNotice("that cube moved on — showing the fresh one")
        setProposal(null)
        void fetchState()
        return
      }
      if (response.status === 400) {
        setNotice("that turn is not a move the shared cubes take")
        discard()
        return
      }
      setNotice("the cubes are unreachable — try again")
    } catch {
      setNotice("the cubes are unreachable — try again")
    } finally {
      setSubmitting(false)
    }
  }, [discard, displays, fetchState, proposal, remount, scheduleSwap, submitting])

  /* ----------------------------------------------------------------- keys */

  // In live mode the component's own conveniences (S scramble, Enter solve,
  // undo, reset) must not touch a shared cube: they never reach it.
  const onKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode !== "live") return
      const target = event.target as HTMLElement | null
      if (!target?.closest?.('[data-cube="puzzle-cube"]')) return
      const key = event.key.toLowerCase()
      if (RESERVED_KEYS.has(key) || (key === "z" && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [mode],
  )

  /* ----------------------------------------------------------------- view */

  const news =
    payload.previous && dismissedNews !== payload.previous.id ? payload.previous : null

  const barButton =
    "border border-border px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide hover:border-foreground disabled:opacity-50"

  const movesChip = bootstrapped ? (
    <span>
      {payload.you.movesLeftToday} of {CUBE_SLOTS} moves left today
    </span>
  ) : null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg leading-snug font-medium">
            Six cubes. One move each, a day. Everybody.
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            These six Rubik&apos;s cubes belong to the whole internet, each one on
            its own life. You get one move per cube per day — drag a face or
            type a turn, confirm it, and it is played on that shared cube.
            Solved cubes are archived on the{" "}
            <a href="/leaderboard" className="underline underline-offset-2">
              leaderboard
            </a>{" "}
            forever.
          </p>
        </div>
        <div className="flex border border-border font-mono text-[12px] uppercase">
          {(["live", "practice"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`px-3 py-1.5 tracking-wide ${
                mode === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "live" ? "live cubes" : "practice"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section onKeyDownCapture={onKeyDownCapture}>
          <div className="datum-frame relative border border-border bg-panel p-3 sm:p-4">
            {mode === "live" ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {payload.rounds.map((round) => (
                  <CubeCard
                    key={round.slot}
                    round={round}
                    display={displays[round.slot]}
                    interactive={
                      bootstrapped &&
                      canMoveOn(round.id) &&
                      !proposal &&
                      !submitting
                    }
                    status={payload.you.cubes[round.id] ?? null}
                    nextMoveAt={payload.you.nextMoveAt}
                    bootstrapped={bootstrapped}
                    onMove={(move) => onCubeMove(round.slot, round.id, move)}
                  />
                ))}
              </div>
            ) : (
              <PracticeCube controlsRef={practiceApi} />
            )}

            {news && mode === "live" ? (
              <div className="pointer-events-auto absolute top-3 left-1/2 w-[92%] max-w-md -translate-x-1/2 border border-border bg-background/95 px-4 py-3 text-center backdrop-blur">
                <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  solved
                </p>
                <p className="mt-1 text-sm">
                  Cube #{news.id} was solved by{" "}
                  <span className="font-medium">{news.solvedBy}</span> —{" "}
                  {count(news.moveCount, "move")}, {count(news.playerCount, "player")},{" "}
                  {count(news.days, "day")}.
                </p>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="absolute top-1.5 right-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setDismissedNews(news.id)}
                >
                  ×
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground">
              <span
                className="cube-live-dot inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--signal)" }}
              />
              6 live cubes
            </span>
            {movesChip}
            <a href="/log" className="underline underline-offset-2 hover:text-foreground">
              full log
            </a>
          </div>

          {notice ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm">{notice}</div>
          ) : null}

          {mode === "practice" ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-panel px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Practice cube — nothing here is shared. Take as many turns as you
                like.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={barButton}
                  onClick={() => practiceApi.current?.scramble(20)}
                >
                  scramble
                </button>
                <button
                  type="button"
                  className={barButton}
                  onClick={() => practiceApi.current?.reset()}
                >
                  reset
                </button>
                <button
                  type="button"
                  className={barButton}
                  onClick={() => practiceApi.current?.solve()}
                >
                  solve it
                </button>
              </div>
            </div>
          ) : proposal ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-panel px-4 py-3">
              <p className="text-sm">
                Cube #{proposal.roundId}: your move{" "}
                <span className="font-mono font-medium" style={{ color: "var(--signal)" }}>
                  {proposal.notation}
                </span>{" "}
                <span className="text-muted-foreground">
                  — this is your move on this cube for today.
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${barButton} bg-foreground text-background hover:bg-foreground`}
                  disabled={submitting}
                  onClick={() => void play()}
                >
                  {submitting ? "playing…" : "play it"}
                </button>
                <button type="button" className={barButton} disabled={submitting} onClick={discard}>
                  discard
                </button>
              </div>
            </div>
          ) : !bootstrapped ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
              Finding your seat…
            </div>
          ) : payload.you.movesLeftToday === 0 ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
              You are{" "}
              <span className="font-mono" style={{ color: "var(--signal)" }}>
                {payload.you.name}
              </span>{" "}
              — all six moves are played. The next ones unlock in{" "}
              {countdown(payload.you.nextMoveAt ?? new Date().toISOString())}. The
              practice cube is all yours meanwhile.
            </div>
          ) : (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm">
              You are{" "}
              <span className="font-mono" style={{ color: "var(--signal)" }}>
                {payload.you.name}
              </span>{" "}
              — {count(payload.you.movesLeftToday, "move")} left today. Turn a
              cube that still has yours.
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="datum-frame border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
              <span className="text-muted-foreground">moves</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="cube-live-dot inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--signal)" }}
                />
                live
              </span>
            </div>
            <ol className="divide-y divide-border">
              {payload.recent.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No moves yet — the shelf is waiting for its first.
                </li>
              ) : (
                payload.recent
                  .slice()
                  .reverse()
                  .map((move) => (
                    <li
                      key={`${move.cube}-${move.seq}`}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="truncate">
                        <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                          c{move.cube}·#{move.seq}
                        </span>
                        <span className="font-mono font-medium" style={{ color: "var(--signal)" }}>
                          {move.notation}
                        </span>{" "}
                        <span className="text-muted-foreground">{move.playerName}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {relative(move.at)}
                      </span>
                    </li>
                  ))
              )}
            </ol>
          </div>

          <div className="border border-border bg-panel px-4 py-3.5 text-sm text-muted-foreground">
            <p className="mb-2 font-mono text-[11px] tracking-wide text-foreground uppercase">
              how it works
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Six standalone cubes — one move per cube per person per UTC day.</li>
              <li>Each cube&apos;s state is always recomputed from its full log.</li>
              <li>Whoever lands a cube&apos;s final move archives it under their name.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- one cube card */

function CubeCard({
  round,
  display,
  interactive,
  status,
  nextMoveAt,
  bootstrapped,
  onMove,
}: {
  round: RoundView
  display: Display | undefined
  interactive: boolean
  status: { canMove: boolean; blockedBy: string | null } | null
  nextMoveAt: string | null
  bootstrapped: boolean
  onMove: (move: CubeMove) => void
}) {
  const day = daysBetween(new Date(round.startedAt), new Date())
  const shown = display ?? { roundId: round.id, algorithm: round.state, key: 0 }

  const statusLine = !bootstrapped
    ? "finding your seat…"
    : status?.canMove
      ? "your move is ready"
      : status?.blockedBy === "too-fast"
        ? "settling — a moment"
        : status?.blockedBy === "ip"
          ? "network limit on this cube"
          : nextMoveAt
            ? `played — next in ${countdown(nextMoveAt)}`
            : "played today"

  return (
    <div className="flex flex-col gap-2 border border-border/60 px-3 py-2.5">
      <div className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
        <span className="text-foreground">
          c{round.slot} · cube #{round.id}
        </span>
        <span>
          day {day} · {round.moveCount} mv
        </span>
      </div>
      <PuzzleCube
        key={`${shown.key}-${shown.roundId}`}
        algorithm={shown.algorithm}
        behavior="static"
        size={240}
        className="mx-auto h-auto w-full max-w-[280px]"
        interactive={interactive}
        azimuth={interactive ? undefined : IDLE_AZIMUTHS[(round.slot - 1) % IDLE_AZIMUTHS.length]}
        onMove={(move, _state, source) => {
          if (source === "user") onMove(move)
        }}
        label={`Shared cube ${round.slot} of 6, round ${round.id}. Drag a sticker to turn that layer, drag the plastic to turn the whole cube, or type U, D, L, R, F, B — shift turns the other way.`}
      />
      <p
        className="text-center text-[12px] text-muted-foreground"
        style={status?.canMove ? { color: "var(--signal)" } : undefined}
      >
        {statusLine}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------- practice cube */

function PracticeCube({
  controlsRef,
}: {
  controlsRef: React.RefObject<PuzzleCubeApi | null>
}) {
  return (
    <PuzzleCube
      behavior="static"
      scrambleOnMount={20}
      size={340}
      className="mx-auto h-auto w-full max-w-[380px]"
      interactive
      controls={(api) => {
        controlsRef.current = api
      }}
      label="A practice cube of your own. Nothing you do here is shared."
    />
  )
}
