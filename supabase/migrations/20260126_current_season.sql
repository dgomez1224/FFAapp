-- Current-season schema + derived all-time view
-- This file is safe to run multiple times (IF NOT EXISTS).

-- --------------------
-- Canonical Manager Alias Mapping
-- --------------------

CREATE TABLE IF NOT EXISTS manager_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  manager_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manager_aliases_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_manager_aliases_entry_id ON manager_aliases(entry_id);

-- --------------------
-- Core Current-Season Tables
-- --------------------

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  entry_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_short_name TEXT,
  seed INTEGER,
  tournament_id UUID REFERENCES tournaments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT teams_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_teams_entry_id ON teams(entry_id);
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON teams(tournament_id);

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'group_stage',
  start_gameweek INTEGER NOT NULL,
  group_stage_gameweeks INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist (for existing tables)
DO $$
BEGIN
  -- Add entry_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tournaments' 
    AND column_name = 'entry_id'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN entry_id TEXT;
    UPDATE tournaments SET entry_id = '164475' WHERE entry_id IS NULL;
    ALTER TABLE tournaments ALTER COLUMN entry_id SET NOT NULL;
  END IF;

  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tournaments' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN is_active BOOLEAN DEFAULT true;
    UPDATE tournaments SET is_active = true WHERE is_active IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournaments_entry_id ON tournaments(entry_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_is_active ON tournaments(is_active);

CREATE TABLE IF NOT EXISTS gameweek_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  tournament_id UUID REFERENCES tournaments(id),
  gameweek INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  captain_points INTEGER,
  bench_points INTEGER,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, gameweek, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_gameweek_scores_team_id ON gameweek_scores(team_id);
CREATE INDEX IF NOT EXISTS idx_gameweek_scores_gameweek ON gameweek_scores(gameweek);
CREATE INDEX IF NOT EXISTS idx_gameweek_scores_tournament_id ON gameweek_scores(tournament_id);

CREATE TABLE IF NOT EXISTS matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  round TEXT NOT NULL,
  matchup_number INTEGER NOT NULL,
  team_1_id UUID REFERENCES teams(id),
  team_2_id UUID REFERENCES teams(id),
  leg_1_gameweek INTEGER NOT NULL,
  leg_2_gameweek INTEGER NOT NULL,
  team_1_leg_1_points INTEGER,
  team_1_leg_2_points INTEGER,
  team_2_leg_1_points INTEGER,
  team_2_leg_2_points INTEGER,
  winner_id UUID REFERENCES teams(id),
  tie_breaker_applied TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matchups_tournament_id ON matchups(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matchups_round ON matchups(round);

CREATE TABLE IF NOT EXISTS h2h_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_1_id UUID NOT NULL REFERENCES teams(id),
  team_2_id UUID NOT NULL REFERENCES teams(id),
  gameweek INTEGER NOT NULL,
  team_1_points INTEGER NOT NULL,
  team_2_points INTEGER NOT NULL,
  winner_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_1_id, team_2_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_h2h_matchups_team_1_id ON h2h_matchups(team_1_id);
CREATE INDEX IF NOT EXISTS idx_h2h_matchups_team_2_id ON h2h_matchups(team_2_id);
CREATE INDEX IF NOT EXISTS idx_h2h_matchups_gameweek ON h2h_matchups(gameweek);

CREATE TABLE IF NOT EXISTS goblet_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  round INTEGER NOT NULL,
  points INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, round)
);

CREATE INDEX IF NOT EXISTS idx_goblet_standings_team_id ON goblet_standings(team_id);
CREATE INDEX IF NOT EXISTS idx_goblet_standings_round ON goblet_standings(round);

CREATE TABLE IF NOT EXISTS player_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  gameweek INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT,
  is_captain BOOLEAN DEFAULT false,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, gameweek, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_selections_team_id ON player_selections(team_id);
CREATE INDEX IF NOT EXISTS idx_player_selections_gameweek ON player_selections(gameweek);

CREATE TABLE IF NOT EXISTS season_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL UNIQUE,
  current_gameweek INTEGER NOT NULL,
  deadline_time TIMESTAMPTZ,
  league_id TEXT,
  league_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------
-- 2025/26+ Historical Tables
-- --------------------

CREATE TABLE IF NOT EXISTS season_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  final_rank INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_season_standings_season ON season_standings(season);
CREATE INDEX IF NOT EXISTS idx_season_standings_rank ON season_standings(season, final_rank);

CREATE TABLE IF NOT EXISTS season_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  league_title BOOLEAN DEFAULT false,
  cup_winner BOOLEAN DEFAULT false,
  goblet_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_season_trophies_season ON season_trophies(season);
CREATE INDEX IF NOT EXISTS idx_season_trophies_team_id ON season_trophies(team_id);

CREATE TABLE IF NOT EXISTS manager_weekly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  gameweek INTEGER NOT NULL,
  points INTEGER NOT NULL,
  captain_points INTEGER,
  bench_points INTEGER,
  h2h_result TEXT,
  h2h_opponent_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_manager_weekly_stats_season ON manager_weekly_stats(season);
CREATE INDEX IF NOT EXISTS idx_manager_weekly_stats_team_season ON manager_weekly_stats(team_id, season);
CREATE INDEX IF NOT EXISTS idx_manager_weekly_stats_gameweek ON manager_weekly_stats(season, gameweek);

CREATE TABLE IF NOT EXISTS manager_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  points_per_game NUMERIC(5, 2),
  points_plus NUMERIC(5, 2),
  total_transactions INTEGER,
  highest_gameweek INTEGER,
  lowest_gameweek INTEGER,
  fifty_plus_weeks INTEGER,
  sub_twenty_weeks INTEGER,
  longest_win_streak INTEGER,
  longest_loss_streak INTEGER,
  longest_undefeated_streak INTEGER,
  most_points_gameweek INTEGER,
  least_points_gameweek INTEGER,
  largest_margin_win NUMERIC(5, 2),
  avg_margin_win NUMERIC(5, 2),
  avg_margin_loss NUMERIC(5, 2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_season_stats_season ON manager_season_stats(season);
CREATE INDEX IF NOT EXISTS idx_manager_season_stats_team ON manager_season_stats(team_id);

-- --------------------
-- Legacy Trophies (pre-2025/26)
-- --------------------

CREATE TABLE IF NOT EXISTS legacy_season_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name),
  CONSTRAINT legacy_season_trophies_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add won_league column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'won_league'
  ) THEN
    ALTER TABLE legacy_season_trophies ADD COLUMN won_league BOOLEAN DEFAULT false;
  END IF;

  -- Add won_cup column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'won_cup'
  ) THEN
    ALTER TABLE legacy_season_trophies ADD COLUMN won_cup BOOLEAN DEFAULT false;
  END IF;

  -- Add won_goblet column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'won_goblet'
  ) THEN
    ALTER TABLE legacy_season_trophies ADD COLUMN won_goblet BOOLEAN DEFAULT false;
  END IF;

  -- Add trophy_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'trophy_count'
  ) THEN
    ALTER TABLE legacy_season_trophies ADD COLUMN trophy_count INTEGER DEFAULT 0;
  END IF;

  -- Add double_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'double_type'
  ) THEN
    ALTER TABLE legacy_season_trophies ADD COLUMN double_type TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legacy_season_trophies_season ON legacy_season_trophies(season);
CREATE INDEX IF NOT EXISTS idx_legacy_season_trophies_manager ON legacy_season_trophies(manager_name);

-- Backfill won_* from old column names if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'league_champion'
  ) THEN
    EXECUTE 'UPDATE legacy_season_trophies SET won_league = COALESCE(won_league, league_champion, false)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'cup_winner'
  ) THEN
    EXECUTE 'UPDATE legacy_season_trophies SET won_cup = COALESCE(won_cup, cup_winner, false)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legacy_season_trophies' AND column_name = 'goblet_winner'
  ) THEN
    EXECUTE 'UPDATE legacy_season_trophies SET won_goblet = COALESCE(won_goblet, goblet_winner, false)';
  END IF;
END $$;

UPDATE legacy_season_trophies
SET trophy_count =
  (CASE WHEN won_league THEN 1 ELSE 0 END) +
  (CASE WHEN won_cup THEN 1 ELSE 0 END) +
  (CASE WHEN won_goblet THEN 1 ELSE 0 END),
  double_type = CASE
    WHEN (CASE WHEN won_league THEN 1 ELSE 0 END) +
         (CASE WHEN won_cup THEN 1 ELSE 0 END) +
         (CASE WHEN won_goblet THEN 1 ELSE 0 END) = 3 THEN 'treble'
    WHEN won_league AND won_cup THEN 'league+cup'
    WHEN won_league AND won_goblet THEN 'league+goblet'
    WHEN won_cup AND won_goblet THEN 'cup+goblet'
    ELSE NULL
  END;

-- --------------------
-- Manager Rating Tables
-- --------------------

CREATE TABLE IF NOT EXISTS manager_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  rating DECIMAL(10, 2) NOT NULL,
  rating_version TEXT NOT NULL DEFAULT 'FFA_RATING_V1',
  placement_score DECIMAL(10, 2) NOT NULL,
  silverware_score DECIMAL(10, 2) NOT NULL,
  ppg_score DECIMAL(10, 2) NOT NULL,
  plus_g_modifier DECIMAL(5, 4) NOT NULL,
  base_score DECIMAL(10, 2) NOT NULL,
  ppg DECIMAL(5, 2) NOT NULL,
  plus_g DECIMAL(5, 2) NOT NULL,
  seasons_played INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, rating_version)
);

CREATE INDEX IF NOT EXISTS idx_manager_ratings_rating ON manager_ratings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_manager_ratings_team_id ON manager_ratings(team_id);

CREATE TABLE IF NOT EXISTS manager_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  rating DECIMAL(10, 2) NOT NULL,
  rating_delta DECIMAL(10, 2),
  delta_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_rating_history_team_season ON manager_rating_history(team_id, season);
CREATE INDEX IF NOT EXISTS idx_manager_rating_history_season_gw ON manager_rating_history(season, gameweek);

CREATE TABLE IF NOT EXISTS manager_rating_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  delta DECIMAL(10, 2) NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_rating_deltas_team_season ON manager_rating_deltas(team_id, season);
CREATE INDEX IF NOT EXISTS idx_manager_rating_deltas_source ON manager_rating_deltas(source);

-- --------------------
-- All-Time Manager Standings (ELO Rating)
-- --------------------

CREATE TABLE IF NOT EXISTS all_time_manager_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL UNIQUE,
  elo_rating DECIMAL(12, 2) NOT NULL DEFAULT 0,
  placement_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  silverware_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ppg_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  plus_g_modifier DECIMAL(6, 4) NOT NULL DEFAULT 1,
  base_score DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ppg DECIMAL(6, 3) NOT NULL DEFAULT 0,
  plus_g DECIMAL(6, 3) NOT NULL DEFAULT 0,
  seasons_played INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT all_time_manager_standings_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);

CREATE INDEX IF NOT EXISTS idx_all_time_manager_standings_rating ON all_time_manager_standings(elo_rating DESC);

-- --------------------
-- RLS (Public Read Access)
-- --------------------

-- Enable RLS and create policies (using DROP IF EXISTS to handle existing policies)
DO $$
BEGIN
  -- manager_aliases
  ALTER TABLE manager_aliases ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_aliases;
  CREATE POLICY "Public read access" ON manager_aliases FOR SELECT USING (true);

  -- teams
  ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON teams;
  CREATE POLICY "Public read access" ON teams FOR SELECT USING (true);

  -- tournaments
  ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON tournaments;
  CREATE POLICY "Public read access" ON tournaments FOR SELECT USING (true);

  -- gameweek_scores
  ALTER TABLE gameweek_scores ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON gameweek_scores;
  CREATE POLICY "Public read access" ON gameweek_scores FOR SELECT USING (true);

  -- matchups
  ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON matchups;
  CREATE POLICY "Public read access" ON matchups FOR SELECT USING (true);

  -- h2h_matchups
  ALTER TABLE h2h_matchups ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON h2h_matchups;
  CREATE POLICY "Public read access" ON h2h_matchups FOR SELECT USING (true);

  -- goblet_standings
  ALTER TABLE goblet_standings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON goblet_standings;
  CREATE POLICY "Public read access" ON goblet_standings FOR SELECT USING (true);

  -- player_selections
  ALTER TABLE player_selections ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON player_selections;
  CREATE POLICY "Public read access" ON player_selections FOR SELECT USING (true);

  -- season_state
  ALTER TABLE season_state ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON season_state;
  CREATE POLICY "Public read access" ON season_state FOR SELECT USING (true);

  -- season_standings
  ALTER TABLE season_standings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON season_standings;
  CREATE POLICY "Public read access" ON season_standings FOR SELECT USING (true);

  -- season_trophies
  ALTER TABLE season_trophies ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON season_trophies;
  CREATE POLICY "Public read access" ON season_trophies FOR SELECT USING (true);

  -- manager_weekly_stats
  ALTER TABLE manager_weekly_stats ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_weekly_stats;
  CREATE POLICY "Public read access" ON manager_weekly_stats FOR SELECT USING (true);

  -- manager_season_stats
  ALTER TABLE manager_season_stats ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_season_stats;
  CREATE POLICY "Public read access" ON manager_season_stats FOR SELECT USING (true);

  -- manager_ratings
  ALTER TABLE manager_ratings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_ratings;
  CREATE POLICY "Public read access" ON manager_ratings FOR SELECT USING (true);

  -- manager_rating_history
  ALTER TABLE manager_rating_history ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_rating_history;
  CREATE POLICY "Public read access" ON manager_rating_history FOR SELECT USING (true);

  -- manager_rating_deltas
  ALTER TABLE manager_rating_deltas ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON manager_rating_deltas;
  CREATE POLICY "Public read access" ON manager_rating_deltas FOR SELECT USING (true);

  -- legacy_season_trophies
  ALTER TABLE legacy_season_trophies ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON legacy_season_trophies;
  CREATE POLICY "Public read access" ON legacy_season_trophies FOR SELECT USING (true);

  -- all_time_manager_standings
  ALTER TABLE all_time_manager_standings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON all_time_manager_standings;
  CREATE POLICY "Public read access" ON all_time_manager_standings FOR SELECT USING (true);
END $$;

-- --------------------
-- Derived All-Time Stats View (Legacy + Current)
-- NOTE: This view is deprecated. Use all_time_manager_stats table instead.
-- View will be dropped in migration 20260130_update_all_time_manager_stats.sql
-- --------------------

/*
-- View removed - use all_time_manager_stats table instead
CREATE OR REPLACE VIEW all_time_manager_stats_view AS
WITH combined_standings AS (
  SELECT
    manager_name,
    wins,
    draws,
    losses,
    points,
    points_for
  FROM legacy_season_standings
  WHERE season < '2025/26'
  UNION ALL
  SELECT
    t.manager_name,
    ss.wins,
    ss.draws,
    ss.losses,
    ss.total_points AS points,
    ss.points_for
  FROM season_standings ss
  JOIN teams t ON t.id = ss.team_id
),
agg_standings AS (
  SELECT
    manager_name,
    SUM(wins) AS wins,
    SUM(draws) AS draws,
    SUM(losses) AS losses,
    SUM(points) AS total_points,
    SUM(points_for) AS points_plus
  FROM combined_standings
  GROUP BY manager_name
),
combined_manager_stats AS (
  SELECT
    manager_name,
    points_per_game,
    points_plus,
    total_transactions,
    highest_gameweek,
    lowest_gameweek,
    fifty_plus_weeks,
    sub_twenty_weeks,
    longest_win_streak,
    longest_loss_streak,
    longest_undefeated_streak,
    most_points_gameweek,
    least_points_gameweek,
    largest_margin_win,
    avg_margin_win,
    avg_margin_loss
  FROM legacy_manager_season_stats
  WHERE season < '2025/26'
  UNION ALL
  SELECT
    t.manager_name,
    ms.points_per_game,
    ms.points_plus,
    ms.total_transactions,
    ms.highest_gameweek,
    ms.lowest_gameweek,
    ms.fifty_plus_weeks,
    ms.sub_twenty_weeks,
    ms.longest_win_streak,
    ms.longest_loss_streak,
    ms.longest_undefeated_streak,
    ms.most_points_gameweek,
    ms.least_points_gameweek,
    ms.largest_margin_win,
    ms.avg_margin_win,
    ms.avg_margin_loss
  FROM manager_season_stats ms
  JOIN teams t ON t.id = ms.team_id
),
agg_manager_stats AS (
  SELECT
    manager_name,
    SUM(COALESCE(total_transactions, 0)) AS total_transactions,
    SUM(COALESCE(fifty_plus_weeks, 0)) AS fifty_plus_weeks,
    SUM(COALESCE(sub_twenty_weeks, 0)) AS sub_twenty_weeks,
    SUM(COALESCE(highest_gameweek, 0)) AS highest_gameweek,
    SUM(COALESCE(lowest_gameweek, 0)) AS lowest_gameweek,
    SUM(COALESCE(longest_win_streak, 0)) AS longest_win_streak,
    SUM(COALESCE(longest_loss_streak, 0)) AS longest_loss_streak,
    SUM(COALESCE(longest_undefeated_streak, 0)) AS longest_undefeated_streak,
    SUM(COALESCE(most_points_gameweek, 0)) AS most_points_gameweek,
    SUM(COALESCE(least_points_gameweek, 0)) AS least_points_gameweek,
    SUM(COALESCE(largest_margin_win, 0)) AS largest_margin_win,
    SUM(COALESCE(avg_margin_win, 0)) AS avg_margin_win,
    SUM(COALESCE(avg_margin_loss, 0)) AS avg_margin_loss
  FROM combined_manager_stats
  GROUP BY manager_name
),
trophy_counts AS (
  SELECT
    manager_name,
    SUM(CASE WHEN won_league THEN 1 ELSE 0 END) AS league_titles,
    SUM(CASE WHEN won_cup THEN 1 ELSE 0 END) AS cup_wins,
    SUM(CASE WHEN won_goblet THEN 1 ELSE 0 END) AS goblet_wins
  FROM legacy_season_trophies
  WHERE season < '2025/26'
  GROUP BY manager_name
  UNION ALL
  SELECT
    t.manager_name,
    SUM(CASE WHEN st.league_title THEN 1 ELSE 0 END) AS league_titles,
    SUM(CASE WHEN st.cup_winner THEN 1 ELSE 0 END) AS cup_wins,
    SUM(CASE WHEN st.goblet_winner THEN 1 ELSE 0 END) AS goblet_wins
  FROM season_trophies st
  JOIN teams t ON t.id = st.team_id
  GROUP BY t.manager_name
)
SELECT
  s.manager_name,
  COALESCE(s.wins, 0) AS wins,
  COALESCE(s.losses, 0) AS losses,
  COALESCE(s.draws, 0) AS draws,
  COALESCE(s.total_points, 0) AS total_points,
  COALESCE(s.points_plus, 0) AS points_plus,
  CASE
    WHEN COALESCE(s.wins, 0) + COALESCE(s.draws, 0) + COALESCE(s.losses, 0) > 0
    THEN ROUND(s.total_points::numeric / (s.wins + s.draws + s.losses), 2)
    ELSE 0
  END AS points_per_game,
  COALESCE(m.total_transactions, 0) AS total_transactions,
  COALESCE(t.league_titles, 0) AS league_titles,
  COALESCE(t.cup_wins, 0) AS cup_wins,
  COALESCE(t.goblet_wins, 0) AS goblet_wins,
  COALESCE(m.fifty_plus_weeks, 0) AS fifty_plus_weeks,
  COALESCE(m.sub_twenty_weeks, 0) AS sub_twenty_weeks,
  COALESCE(m.highest_gameweek, 0) AS highest_gameweek,
  COALESCE(m.lowest_gameweek, 0) AS lowest_gameweek,
  COALESCE(m.largest_margin_win, 0) AS largest_margin_win,
  0 AS largest_margin_loss,
  COALESCE(m.avg_margin_win, 0) AS avg_margin_win,
  COALESCE(m.avg_margin_loss, 0) AS avg_margin_loss,
  COALESCE(m.longest_win_streak, 0) AS longest_win_streak,
  COALESCE(m.longest_loss_streak, 0) AS longest_loss_streak,
  COALESCE(m.longest_undefeated_streak, 0) AS longest_undefeated_streak,
  0 AS elo_rating
FROM agg_standings s
LEFT JOIN agg_manager_stats m ON m.manager_name = s.manager_name
LEFT JOIN trophy_counts t ON t.manager_name = s.manager_name;
*/