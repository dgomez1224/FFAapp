-- Daily message scheduling and per-player frequency tracking.

ALTER TABLE player_messages
  ADD COLUMN IF NOT EXISTS scheduled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS player_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  message_date DATE NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_name, player_id, message_date)
);

CREATE INDEX IF NOT EXISTS idx_player_message_tracking_manager_date
  ON player_message_tracking (manager_name, message_date);

ALTER TABLE player_message_tracking ENABLE ROW LEVEL SECURITY;
