-- Captain sign-in + FFA Cup captain selections
-- Email-based manager auth mapping, session tokens, and per-gameweek captain picks.

CREATE TABLE IF NOT EXISTS manager_auth_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_name),
  UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_auth_emails_email_lower
  ON manager_auth_emails ((LOWER(email)));

CREATE TABLE IF NOT EXISTS manager_sign_in_sessions (
  token TEXT PRIMARY KEY,
  manager_name TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_sign_in_sessions_team_id
  ON manager_sign_in_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_manager_sign_in_sessions_expires_at
  ON manager_sign_in_sessions(expires_at);

CREATE TABLE IF NOT EXISTS cup_captain_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  manager_name TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  captain_player_id INTEGER NOT NULL,
  captain_name TEXT,
  squad_event INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_cup_captain_selections_gameweek
  ON cup_captain_selections(gameweek);
CREATE INDEX IF NOT EXISTS idx_cup_captain_selections_team_id
  ON cup_captain_selections(team_id);

-- Service-role only writes/reads through edge functions.
ALTER TABLE manager_auth_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_sign_in_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cup_captain_selections ENABLE ROW LEVEL SECURITY;
