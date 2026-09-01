-- Player messaging inbox and scouting network.
-- Edge functions (service role) are the only accessors.

CREATE TABLE IF NOT EXISTS player_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_position TEXT,
  player_image_url TEXT,
  native_language TEXT NOT NULL DEFAULT 'English',
  message_type TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  content TEXT NOT NULL,
  content_translation TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  source_gameweek INTEGER,
  reply_content TEXT,
  replied_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_messages_dedup
  ON player_messages (manager_name, player_id, trigger_event, (COALESCE(source_gameweek, 0)));

CREATE INDEX IF NOT EXISTS idx_player_messages_manager_created
  ON player_messages (manager_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_messages_manager_unread
  ON player_messages (manager_name)
  WHERE is_read = false;

CREATE TABLE IF NOT EXISTS scout_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL,
  scout_name TEXT NOT NULL,
  position_focus TEXT[] NOT NULL DEFAULT '{}',
  stat_focus JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_gameweeks INTEGER NOT NULL DEFAULT 3
    CHECK (duration_gameweeks BETWEEN 2 AND 4),
  start_gameweek INTEGER NOT NULL,
  end_gameweek INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_assignments_manager
  ON scout_assignments (manager_name, created_at DESC);

CREATE TABLE IF NOT EXISTS scout_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id UUID NOT NULL REFERENCES scout_assignments(id) ON DELETE CASCADE,
  manager_name TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_position TEXT,
  player_image_url TEXT,
  recommendation_text TEXT NOT NULL,
  statistics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_recs_scout
  ON scout_recommendations (scout_id, recommendation_score DESC);

CREATE INDEX IF NOT EXISTS idx_scout_recs_manager
  ON scout_recommendations (manager_name, created_at DESC);

ALTER TABLE player_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_recommendations ENABLE ROW LEVEL SECURITY;
