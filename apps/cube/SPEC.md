# cube — the shared Rubik's cubes

A dedicated robocn example deployed at **cube.robocn.dev**. Six 3×3 cubes
belong to the whole internet at once — each one standalone, with its own
scramble, its own log, its own life. Every person gets **one move per cube
per UTC day** (six moves a day if you work the whole shelf). A cube is
solved by nobody in particular and everybody at once; when one lands home
it is archived onto the leaderboard and a fresh scrambled cube takes its
place in the same slot.

The cubes are drawn with the SVG `puzzle-cube` renderer — no WebGL, no
canvas: one solver, flat projection, cheap enough to run six of them on a
phone.

## The rules

- **Six live cubes** at a time, in stable slots 1–6. Each slot always holds
  one live round (a **round** = one cube's life: scramble → moves → archive).
- 3×3, scrambled with 20 random outer moves.
- A **move** is one outer-layer face turn: `U D L R F B`, `'` for
  anticlockwise, `2` for a half turn. Inner-layer moves are rejected.
- **Rate limits** (enforced server-side, per UTC day, per cube — each cube
  is standalone):
  - 1 move per player per cube (anonymous cookie identity) — six a day if
    you visit every cube.
  - 3 moves per IP hash per cube (a blunt brake on cookie farming).
  - a move must be 2 s after the previous move on that cube (a spam brake).
- The server is the only authority: it recomputes each cube's state from
  `scramble + moves` after every submission and checks `isSolved`.
- On solve: the round is stamped `solved_at` / `solved_by`, a new round is
  created **in the same slot** in the same transaction, and the finished
  cube joins the leaderboard.
- Identity is a random cookie (`cube_player`, 10 years, httpOnly) — no
  accounts. The player's display name ("teal-falcon-x7Kq2P") is derived
  from that id and snapshotted onto each move.

## The pieces

- `src/lib/robocn/*`, `src/components/ui/puzzle-cube.tsx` — vendored
  verbatim from the robocn registry (exactly what `shadcn add puzzle-cube`
  installs). Update by re-copying from the registry.
- `src/lib/game.ts` — pure game logic: round payload shapes, day buckets,
  next-move time, name generation, state fold (`scramble + log → state`),
  solved detection glue. Unit-tested, no DB.
- `src/lib/identity.ts` — cookie player id, ip hashing, cookie read/write.
- `src/lib/db.ts` — pg pool, `ensureRounds` (fill all six slots), `getState`
  (all cubes + your status on each), `submitMove` (transaction: lock round →
  check limits → insert move → fold state → archive + spawn the slot's next
  round on solve), `getLeaderboard`, `getLog`.
- `src/app/api/state/route.ts` — GET: the six live cubes, your status on
  each, recent moves across the shelf. Establishes the player cookie on
  first call.
- `src/app/api/move/route.ts` — POST `{ "move": "R'", "cube": 3 }` (cube is
  the slot, 1–6): the whole game loop. `400` bad move, `403` no identity
  yet, `429` daily limit, `503` database asleep.
- `src/app/page.tsx` — SSR initial state (same helper as the API), then the
  client polls `/api/state` every 15 s and on focus.
- `src/app/leaderboard/page.tsx` — archived cubes: moves, players, days,
  solver.
- `src/app/log/page.tsx` — the full move log of one cube, picked with
  `?cube=N` (slot 1–6), with a switcher across the shelf.

## How the shared cubes stay honest client-side

Each cube component runs controlled on `algorithm = scramble + moves`:

- mount / non-append change → instant rebuild (new round, page load),
- appended move → animated turn (someone else's move arrives over the wire),
- your own move is proposed by dragging/typing **on that cube**, confirmed
  on the bar under the shelf, then that cube remounts onto the
  server-confirmed algorithm — the local proposal and the server's truth
  never drift.

Keys the component reserves for its demo conveniences (`S` scramble,
`Enter` solve, `H` hint, undo/reset) are intercepted on capture so they
can't desync a shared cube; after a cube's daily move is spent it becomes a
static picture (still showing a distinct angle), and the shelf offers a
separate local practice cube instead.

## Data

Databases `robocn_cube` (production) and `robocn_cube_preview` (preview/dev)
on the shared fly sandbox postgres. The host lives only in env vars
(`DATABASE_URL` in `apps/cube/.env.local` and the Vercel project) — never in
committed files. Schema in `db/schema.sql`, applied idempotently by
`pnpm db:migrate` (also part of the Vercel build).

```sql
rounds(id, scramble, started_at, solved_at, solved_by, final_state, slot)
  -- exactly one live round per slot:
  UNIQUE (slot) WHERE solved_at IS NULL
moves(id, round_id, seq, notation, player_id, player_name, ip_hash, created_at)
  UNIQUE(round_id, seq) + indexes on (player_id, created_at), (ip_hash, created_at)
```

## Ops

- Dev: `pnpm --filter @robocn/cube dev` (port 3100), env in `apps/cube/.env.local`.
- Test: `pnpm --filter @robocn/cube test` (pure logic only — no DB needed).
- Deploy: Vercel project `robocn-cube`, root directory `apps/cube`, domains
  `cube.robocn.dev` (+ preview URLs). Env: `DATABASE_URL`, `CUBE_SECRET`.
- `scripts/dev-solve.mts — cube [1-6]` — plays a real solution onto that
  slot's live round as synthetic players, to exercise archive → leaderboard
  → next round end to end.
