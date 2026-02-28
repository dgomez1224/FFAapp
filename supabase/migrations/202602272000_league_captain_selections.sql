-- League captain selections (FPL Draft league; distinct from cup_captain_selections).
CREATE TABLE IF NOT EXISTS captain_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  gameweek INTEGER NOT NULL,
  captain_element_id INTEGER NOT NULL,
  vice_captain_element_id INTEGER,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_captain_selections_team_gameweek
  ON captain_selections(team_id, gameweek);

ALTER TABLE captain_selections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'captain_selections' AND policyname = 'Allow all for service'
  ) THEN
    CREATE POLICY "Allow all for service" ON captain_selections FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
