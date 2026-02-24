# Database Schema Documentation

## Overview

This document describes the database schema for the FFA Cup Web Application in public read-only mode. The schema supports league standings, cup competitions, goblet standings, H2H matchups, manager/player insights, and historical data via CSV imports.

## Core Tables

### `teams`

Stores team/manager information mapped to FPL entry IDs.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL UNIQUE,
  entry_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_short_name TEXT,
  seed INTEGER,
  tournament_id UUID REFERENCES tournaments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_entry_id ON teams(entry_id);
CREATE INDEX idx_teams_tournament_id ON teams(tournament_id);
```

**Notes:**
- `entry_id` maps to FPL entry ID (e.g., "164475")
- All 10 league members should be in this table
- `tournament_id` links to active tournament (optional in public mode)

### `tournaments`

Stores tournament metadata and configuration.

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id TEXT NOT NULL, -- Static entry ID (164475)
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'group_stage', -- group_stage, knockout, completed
  start_gameweek INTEGER NOT NULL,
  group_stage_gameweeks INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_entry_id ON tournaments(entry_id);
CREATE INDEX idx_tournaments_is_active ON tournaments(is_active);
```

### `gameweek_scores`

Stores gameweek scores for each team.

```sql
CREATE TABLE gameweek_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  tournament_id UUID REFERENCES tournaments(id),
  gameweek INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  captain_points INTEGER,
  bench_points INTEGER,
  raw_data JSONB, -- Store full FPL API response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, gameweek, tournament_id)
);

CREATE INDEX idx_gameweek_scores_team_id ON gameweek_scores(team_id);
CREATE INDEX idx_gameweek_scores_gameweek ON gameweek_scores(gameweek);
CREATE INDEX idx_gameweek_scores_tournament_id ON gameweek_scores(tournament_id);
```

### `matchups`

Stores knockout bracket matchups.

```sql
CREATE TABLE matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  round TEXT NOT NULL, -- e.g., "Quarter Final", "Semi Final", "Final"
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
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matchups_tournament_id ON matchups(tournament_id);
CREATE INDEX idx_matchups_round ON matchups(round);
```

## Historical Data Tables (CSV-Backed)

### `league_history`

Stores historical league data imported from CSV files.

```sql
CREATE TABLE league_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL, -- e.g., "2023/24", "2022/23"
  entry_id TEXT NOT NULL,
  entry_name TEXT,
  manager_name TEXT,
  final_rank INTEGER,
  total_points INTEGER,
  awards TEXT, -- JSON string or comma-separated
  records TEXT, -- JSON string or comma-separated
  additional_data JSONB, -- Flexible storage for extra CSV columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_league_history_season ON league_history(season);
CREATE INDEX idx_league_history_entry_id ON league_history(entry_id);
CREATE INDEX idx_league_history_final_rank ON league_history(season, final_rank);
```

**CSV Import Format:**

```csv
season,entry_id,entry_name,manager_name,final_rank,total_points,awards,records
2023/24,164475,Team Name,Manager Name,1,2500,Champion,Most Points
2023/24,123456,Another Team,Another Manager,2,2450,Runner-up,
2022/23,164475,Team Name,Manager Name,3,2400,,
```

### CSV Import Instructions

1. **Prepare CSV File:**
   - Required columns: `season`, `entry_id`
   - Optional columns: `entry_name`, `manager_name`, `final_rank`, `total_points`, `awards`, `records`
   - Additional columns will be stored in `additional_data` JSONB field

2. **Import via Supabase Dashboard:**
   - Go to Table Editor → `league_history`
   - Click "Import data" → "Import CSV"
   - Map columns and import

3. **Import via SQL:**
   ```sql
   -- Example: Import from CSV file
   COPY league_history(season, entry_id, entry_name, manager_name, final_rank, total_points, awards, records)
   FROM '/path/to/league_history.csv'
   WITH (FORMAT csv, HEADER true);
   ```

4. **Import via Edge Function (Recommended):**
   Create an admin-only endpoint that accepts CSV data and inserts into `league_history`.

## Analytics Tables

### `goblet_standings`

Stores goblet competition standings (round-based).

```sql
CREATE TABLE goblet_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  round INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, round)
);

CREATE INDEX idx_goblet_standings_team_id ON goblet_standings(team_id);
CREATE INDEX idx_goblet_standings_round ON goblet_standings(round);
CREATE INDEX idx_goblet_standings_total_points ON goblet_standings(total_points DESC);
```

### `h2h_matchups`

Stores head-to-head matchup results.

```sql
CREATE TABLE h2h_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_1_id UUID NOT NULL REFERENCES teams(id),
  team_2_id UUID NOT NULL REFERENCES teams(id),
  gameweek INTEGER NOT NULL,
  team_1_points INTEGER NOT NULL,
  team_2_points INTEGER NOT NULL,
  winner_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_1_id, team_2_id, gameweek)
);

CREATE INDEX idx_h2h_matchups_team_1_id ON h2h_matchups(team_1_id);
CREATE INDEX idx_h2h_matchups_team_2_id ON h2h_matchups(team_2_id);
CREATE INDEX idx_h2h_matchups_gameweek ON h2h_matchups(gameweek);
```

### `player_selections`

Tracks which players are selected by which teams each gameweek.

```sql
CREATE TABLE player_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  player_id INTEGER NOT NULL, -- FPL player ID
  player_name TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  is_captain BOOLEAN DEFAULT false,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, player_id, gameweek)
);

CREATE INDEX idx_player_selections_team_id ON player_selections(team_id);
CREATE INDEX idx_player_selections_player_id ON player_selections(player_id);
CREATE INDEX idx_player_selections_gameweek ON player_selections(gameweek);
```

## Row-Level Security (RLS)

Since this is a public read-only application, all tables should have RLS policies that allow public read access:

```sql
-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gameweek_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblet_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_selections ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read access" ON gameweek_scores FOR SELECT USING (true);
CREATE POLICY "Public read access" ON matchups FOR SELECT USING (true);
CREATE POLICY "Public read access" ON league_history FOR SELECT USING (true);
CREATE POLICY "Public read access" ON goblet_standings FOR SELECT USING (true);
CREATE POLICY "Public read access" ON h2h_matchups FOR SELECT USING (true);
CREATE POLICY "Public read access" ON player_selections FOR SELECT USING (true);
```

## Views (Optional)

### `group_stage_standings`

Materialized view for fast group stage standings queries.

```sql
CREATE MATERIALIZED VIEW group_stage_standings AS
SELECT 
  t.id AS team_id,
  t.entry_name,
  t.manager_name,
  SUM(gs.total_points) AS total_points,
  SUM(gs.captain_points) AS captain_points,
  COUNT(gs.id) AS played
FROM teams t
LEFT JOIN gameweek_scores gs ON gs.team_id = t.id
WHERE gs.gameweek BETWEEN (
  SELECT start_gameweek FROM tournaments WHERE is_active = true LIMIT 1
) AND (
  SELECT start_gameweek + group_stage_gameweeks - 1 
  FROM tournaments 
  WHERE is_active = true 
  LIMIT 1
)
GROUP BY t.id, t.entry_name, t.manager_name
ORDER BY total_points DESC, captain_points DESC;

CREATE INDEX idx_group_stage_standings_team_id ON group_stage_standings(team_id);
```

Refresh the view periodically:
```sql
REFRESH MATERIALIZED VIEW group_stage_standings;
```

## Migration Checklist

- [ ] Create all tables with proper indexes
- [ ] Set up RLS policies for public read access
- [ ] Import initial team data (10 league members)
- [ ] Create tournament record for current season
- [ ] Import historical data via CSV (if available)
- [ ] Set up materialized views (optional)
- [ ] Test all Edge Function endpoints
- [ ] Verify public access works without authentication

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone-aware storage
- Use `UUID` for primary keys for better distribution
- Index foreign keys and frequently queried columns
- Consider partitioning `gameweek_scores` by season if data grows large
- Historical data can be imported incrementally as CSV files become available
