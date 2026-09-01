-- Transfer targets for signed-in managers, plus player reply storage.
-- Edge functions (service role) are the only accessors.

CREATE TABLE IF NOT EXISTS transfer_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_position TEXT,
  player_team TEXT,
  player_image_url TEXT,
  price NUMERIC,
  points_per_game NUMERIC,
  form TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_name, player_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_targets_manager
  ON transfer_targets (manager_name, created_at DESC);

ALTER TABLE transfer_targets ENABLE ROW LEVEL SECURITY;

ALTER TABLE player_messages
  ADD COLUMN IF NOT EXISTS player_response TEXT,
  ADD COLUMN IF NOT EXISTS player_responded_at TIMESTAMPTZ;
