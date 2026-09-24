"use client"

/**
 * game-client — the shared cube, as it is played.
 *
 * The server owns the truth; the cube component owns the feel. They meet here:
 * the cube runs controlled on `scramble + moves`, remote moves arrive as
 * animated appends, and a player's own move is proposed by hand (drag or key),
 * confirmed on the bar, and reconciled by a remount onto what the server now
 * says — so the local cube and the shared one can never drift.
 */

import * as React from "react"

import { RobotStage } from "@/components/ui/robot-stage"
import { RubiksCube, type RubiksCubeApi } from "@/components/ui/rubiks-cube"
import { daysBetween, type GameStatePayload } from "@/lib/game"
import { formatMove, type CubeMove } from "@/lib/robocn/cube"

const POLL_MS = 15_000
/** How long a freshly solved cube is held up before the next one takes over. */
const SOLVED_HOLD_MS = 4_500

/** What the cube is showing — deliberately decoupled from the latest payload. */
interface Display {
  roundId: number
  algorithm: string
  key: number
}

/** Keys the demo cube reserves for itself; the shared cube must not obey them. */
const RESERVED_KEYS = new Set(["s", "h", "enter", "backspace", "escape"])

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
  const [display, setDisplay] = React.useState<Display>({
    roundId: initial.round.id,
    algorithm: initial.round.state,
    key: 0,
  })
  const [proposal, setProposal] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"live" | "practice">("live")
  const [dismissedNews, setDismissedNews] = React.useState<number | null>(null)
  const practiceApi = React.useRef<RubiksCubeApi | null>(null)
  const swapTimer = React.useRef(0)
  const proposing = React.useRef(false)

  React.useEffect(() => {
    proposing.current = proposal !== null
  }, [proposal])

  React.useEffect(() => () => window.clearTimeout(swapTimer.current), [])

  const bootstrapped = payload.you.id !== ""
  const canMove = bootstrapped && payload.you.canMove

  /* -------------------------------------------------------- fetching state */

  const scheduleSwap = React.useCallback((next: GameStatePayload, fromKey: number) => {
    window.clearTimeout(swapTimer.current)
    swapTimer.current = window.setTimeout(() => {
      setDisplay({ roundId: next.round.id, algorithm: next.round.state, key: fromKey + 1 })
    }, SOLVED_HOLD_MS)
  }, [])

  const applyPayload = React.useCallback(
    (next: GameStatePayload) => {
      setPayload(next)
      setDisplay((current) => {
        if (next.round.id === current.roundId) {
          // Same cube: remote moves arrive as animated appends.
          return { ...current, algorithm: next.round.state }
        }
        window.clearTimeout(swapTimer.current)
        if (next.previous && next.previous.id === current.roundId) {
          // The cube we were watching was just solved: hold up the solved
          // state — the winning move animates in — then bring on the next one.
          scheduleSwap(next, current.key)
          return { ...current, algorithm: next.previous.state }
        }
        return { roundId: next.round.id, algorithm: next.round.state, key: current.key + 1 }
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

  const onCubeMove = React.useCallback(
    (move: CubeMove) => {
      if (mode !== "live" || !canMove || proposal) return
      setProposal(formatMove(move))
    },
    [canMove, mode, proposal],
  )

  const discard = React.useCallback(() => {
    setProposal(null)
    setDisplay((current) => ({
      roundId: payload.round.id,
      algorithm: payload.round.state,
      key: current.key + 1,
    }))
  }, [payload.round.id, payload.round.state])

  const play = React.useCallback(async () => {
    if (!proposal || submitting) return
    setSubmitting(true)
    try {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ move: proposal }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        nextMoveAt?: string | null
        solved?: boolean
        payload?: GameStatePayload
      }
      if (response.ok && body.payload) {
        const next = body.payload
        setProposal(null)
        setPayload(next)
        if (body.solved) {
          // Hold the solved cube up — the local cube is already showing it —
          // then swap in the fresh scramble.
          setDisplay((current) => ({
            roundId: next.previous?.id ?? current.roundId,
            algorithm: next.previous?.state ?? current.algorithm,
            key: current.key + 1,
          }))
          scheduleSwap(next, display.key + 1)
        } else {
          setDisplay((current) => ({
            roundId: next.round.id,
            algorithm: next.round.state,
            key: current.key + 1,
          }))
        }
        return
      }
      if (response.status === 429 && body.error === "too-fast") {
        setNotice("the cube is still settling — try again in a second")
        return
      }
      if (response.status === 429) {
        setNotice(
          body.nextMoveAt
            ? `that was your move for today — the next one unlocks in ${countdown(body.nextMoveAt)}`
            : "daily limit reached",
        )
        setProposal(null)
        void fetchState()
        return
      }
      if (response.status === 403) {
        setNotice("the cube does not know you yet — one moment")
        await fetchState()
        return
      }
      if (response.status === 400) {
        setNotice("that turn is not a move the shared cube takes")
        discard()
        return
      }
      setNotice("the cube is unreachable — try again")
    } catch {
      setNotice("the cube is unreachable — try again")
    } finally {
      setSubmitting(false)
    }
  }, [discard, display.key, fetchState, proposal, scheduleSwap, submitting])

  /* ----------------------------------------------------------------- keys */

  // In live mode the component's own conveniences (S scramble, Enter solve,
  // undo, reset) must not touch the shared cube: they never reach it.
  const onKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (mode !== "live") return
      const target = event.target as HTMLElement | null
      if (!target?.closest?.("canvas")) return
      const key = event.key.toLowerCase()
      if (RESERVED_KEYS.has(key) || (key === "z" && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [mode],
  )

  /* ----------------------------------------------------------------- view */

  const day = daysBetween(new Date(payload.round.startedAt), new Date())
  const news =
    payload.previous && payload.previous.id !== payload.round.id && dismissedNews !== payload.previous.id
      ? payload.previous
      : null
  const interactive = mode === "practice" || (canMove && !proposal && !submitting)

  const barButton =
    "border border-border px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide hover:border-foreground disabled:opacity-50"

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg leading-snug font-medium">
            One cube. One move a day. Everybody.
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            This Rubik&apos;s cube belongs to the whole internet. Each person gets
            a single move per day — drag a face or type a turn, confirm it, and
            it is played on the shared cube. Solved cubes are archived on the{" "}
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
              {option === "live" ? "live cube" : "practice"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section>
          <div
            className="datum-frame relative border border-border bg-panel"
            onKeyDownCapture={onKeyDownCapture}
          >
            <RobotStage
              className="h-[380px] w-full sm:h-[440px]"
              floor="none"
              orbit="free"
              camera={[3.4, 2.9, 4.2]}
            >
              {mode === "live" ? (
                <RubiksCube
                  key={`live-${display.key}-${display.roundId}`}
                  algorithm={display.algorithm}
                  behavior="static"
                  interactive={interactive}
                  onMove={(move, _state, source) => {
                    if (source === "user") onCubeMove(move)
                  }}
                  label="The shared cube. Drag a face to turn that layer, or type U, D, L, R, F, B — shift turns the other way, 2 after a letter is a half turn."
                />
              ) : (
                <RubiksCube
                  key="practice"
                  behavior="static"
                  scrambleOnMount={20}
                  interactive
                  controls={(api) => {
                    practiceApi.current = api
                  }}
                  label="A practice cube of your own. Nothing you do here is shared."
                />
              )}
            </RobotStage>

            {news ? (
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
              <span className="cube-live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--signal)" }} />
              cube #{payload.round.id}
            </span>
            <span>day {day}</span>
            <span>{count(payload.round.moveCount, "move")}</span>
            <span>{count(payload.round.playerCount, "player")}</span>
            <a href="/log" className="underline underline-offset-2 hover:text-foreground">
              full log
            </a>
          </div>

          {notice ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm">
              {notice}
            </div>
          ) : null}

          {mode === "practice" ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-panel px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Practice cube — nothing here is shared. Take as many turns as you
                like.
              </p>
              <button
                type="button"
                className={barButton}
                onClick={() => practiceApi.current?.scramble(20)}
              >
                scramble
              </button>
            </div>
          ) : proposal ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-border bg-panel px-4 py-3">
              <p className="text-sm">
                Your move:{" "}
                <span className="font-mono font-medium" style={{ color: "var(--signal)" }}>
                  {proposal}
                </span>{" "}
                <span className="text-muted-foreground">
                  — this is your one move for today.
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
          ) : canMove ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm">
              You are{" "}
              <span className="font-mono" style={{ color: "var(--signal)" }}>
                {payload.you.name}
              </span>
              . Your move today is ready — turn the cube.
            </div>
          ) : payload.you.blockedBy === "ip" ? (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
              Daily limit reached from this network
              {payload.you.nextMoveAt ? ` — next move in ${countdown(payload.you.nextMoveAt)}` : ""}
              . The practice cube is all yours meanwhile.
            </div>
          ) : (
            <div className="mt-3 border border-border bg-panel px-4 py-3 text-sm text-muted-foreground">
              You are{" "}
              <span className="font-mono" style={{ color: "var(--signal)" }}>
                {payload.you.name}
              </span>
              {payload.you.nextMoveAt
                ? ` — your move is played. The next one unlocks in ${countdown(
                    payload.you.nextMoveAt,
                  )}.`
                : " — your move is played."}{" "}
              The practice cube is all yours meanwhile.
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="datum-frame border border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5 font-mono text-[11px] tracking-wide uppercase">
              <span className="text-muted-foreground">moves</span>
              <span className="flex items-center gap-1.5">
                <span className="cube-live-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--signal)" }} />
                live
              </span>
            </div>
            <ol className="divide-y divide-border">
              {payload.recent.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No moves yet — this cube is waiting for its first.
                </li>
              ) : (
                payload.recent
                  .slice()
                  .reverse()
                  .map((move) => (
                    <li
                      key={move.seq}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="truncate">
                        <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                          #{move.seq}
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
              <li>One move per person per UTC day — confirmed by the server.</li>
              <li>The cube&apos;s state is always recomputed from its full log.</li>
              <li>Whoever lands the final move archives the cube under their name.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
