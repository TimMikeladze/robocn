# cube — the shared Rubik's cube

A dedicated robocn example deployed at **cube.robocn.dev**. One 3×3 cube belongs to
the whole internet. Every person gets **one move per UTC day**. The cube is solved
by nobody in particular and everybody at once. When it lands home, the cube is
archived onto the leaderboard and a fresh scrambled cube takes its place.

## The rules

- One live cube (a **round**) at a time, 3×3, scrambled with 20 random outer moves.
- A **move** is one outer-layer face turn: `U D L R F B`, `'` for anticlockwise,
  `2` for a half turn. Inner-layer moves are rejected.
- **Rate limits** (enforced server-side, per UTC day):
  - 1 move per player (anonymous cookie identity).
  - 3 moves per IP hash (a blunt brake on cookie farming).
  - a move must be 2 s after the previous move on the round (a spam brake).
- The server is the only authority: it recomputes the state from
  `scramble + moves` after every submission and checks `isSolved`.
- On solve: the round is stamped `solved_at` / `solved_by`, a new round is
  created in the same transaction, and the finished cube joins the leaderboard.
- Identity is a random cookie (`cube_player`, 10 years, httpOnly) — no accounts.
  The player's display name ("teal-falcon-x7Kq2P") is derived from that id —
  a word pair for reading, six characters of the id's own nanoid so every
  player's name is unique — and snapshotted onto each move.

## The pieces

- `src/lib/robocn/*`, `src/components/ui/rubiks-cube.tsx`, `robot-stage.tsx` —
  vendored verbatim from the robocn registry (exactly what
  `shadcn add rubiks-cube` installs). Update by re-copying from the registry.
- `src/lib/game.ts` — pure game logic: round payload shapes, day buckets,
  next-move time, name generation, state fold (`scramble + log → state`), solved
  detection glue. Unit-tested, no DB.
- `src/lib/identity.ts` — cookie player id, ip hashing, cookie read/write.
- `src/lib/db.ts` — pg pool, `ensureRound`, `getState`, `submitMove`
  (transaction: lock round → check limits → insert move → fold state → archive +
  spawn next round on solve), `getLeaderboard`, `getLog`.
- `src/app/api/state/route.ts` — GET: current round, your status, recent moves.
  Establishes the player cookie on first call.
- `src/app/api/move/route.ts` — POST `{ "move": "R'" }`: the whole game loop.
  `400` bad move, `403` no identity yet, `429` daily limit, `409` round moved on.
- `src/app/page.tsx` — SSR initial state (same helper as the API), then the
  client polls `/api/state` every 15 s and on focus.
- `src/app/leaderboard/page.tsx` — archived cubes: moves, players, days, solver.
- `src/app/log/page.tsx` — the full move log of the live round.

## How the shared cube stays honest client-side

The cube component runs controlled on `algorithm = scramble + moves`:

- mount / non-append change → instant rebuild (new round, page load),
- appended move → animated turn (someone else's move arrives over the wire),
- your own move is proposed by dragging/typing, confirmed on a bar under the
  stage, then the cube remounts onto the server-confirmed algorithm — the local
  proposal and the server's truth never drift.

Keys the component reserves for its demo conveniences (`S` scramble, `Enter`
solve, `H` hint, undo/reset) are intercepted on capture so they can't desync the
shared cube; after your daily move is spent the stage offers a separate local
practice cube instead.

## Data

Databases `robocn_cube` (production) and `robocn_cube_preview` (preview/dev) on the
shared fly sandbox postgres. The host lives only in env vars (`DATABASE_URL` in
`apps/cube/.env.local` and the Vercel project) — never in committed files.
Schema in `db/schema.sql`, applied idempotently by `pnpm db:migrate` (also part
of the Vercel build).

```sql
rounds(id, scramble, started_at, solved_at, solved_by)
moves(id, round_id, seq, notation, player_id, player_name, ip_hash, created_at)
  UNIQUE(round_id, seq) + indexes on (player_id, created_at), (ip_hash, created_at)
```

## Ops

- Dev: `pnpm --filter @robocn/cube dev` (port 3100), env in `apps/cube/.env.local`.
- Test: `pnpm --filter @robocn/cube test` (pure logic only — no DB needed).
- Deploy: Vercel project `robocn-cube`, root directory `apps/cube`, domains
  `cube.robocn.dev` (+ preview URLs). Env: `DATABASE_URL`, `CUBE_SECRET`.
- `scripts/dev-solve.mts` — plays a real solution onto the live dev round as
  synthetic players, to exercise archive → leaderboard → new round end to end.
