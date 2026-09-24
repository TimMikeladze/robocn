-- cube — the shared Rubik's cube. One live round at a time; the moves are
-- the log, the state is always derived from scramble + moves.

CREATE TABLE IF NOT EXISTS rounds (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scramble text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  solved_at timestamptz,
  solved_by text,
  -- Written once, when the cube is archived: its final algorithm.
  final_state text
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
