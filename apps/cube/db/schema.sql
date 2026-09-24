-- cube — the shared Rubik's cubes. Six live rounds at a time, one per slot;
-- the moves are the log, the state is always derived from scramble + moves.

CREATE TABLE IF NOT EXISTS rounds (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scramble text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  solved_at timestamptz,
  solved_by text,
  -- Written once, when the cube is archived: its final algorithm.
  final_state text,
  -- Which shelf slot this round lives in (1..6) while it is live.
  slot integer
);

CREATE TABLE IF NOT EXISTS moves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_id integer NOT NULL REFERENCES rounds(id),
  seq integer NOT NULL,
  notation text NOT NULL,
  player_id text NOT NULL,
  player_name text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, seq)
);

CREATE INDEX IF NOT EXISTS moves_player_recent ON moves (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moves_ip_recent ON moves (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS moves_round_desc ON moves (round_id, id DESC);
CREATE INDEX IF NOT EXISTS rounds_slot ON rounds (slot);

-- Rounds from the one-cube era have no slot: live ones are assigned in id
-- order (there is at most one), and ensureRounds fills any slot still empty.
DO $$
DECLARE
  r record;
  s integer := 0;
BEGIN
  FOR r IN SELECT id FROM rounds WHERE solved_at IS NULL AND slot IS NULL ORDER BY id LOOP
    s := s + 1;
    UPDATE rounds SET slot = s WHERE id = r.id;
  END LOOP;
END $$;

-- Exactly one live round per slot; archived rounds keep theirs for the record.
CREATE UNIQUE INDEX IF NOT EXISTS rounds_live_slot ON rounds (slot) WHERE solved_at IS NULL;
