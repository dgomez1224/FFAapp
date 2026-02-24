# Extended Database Schema - Historical Stats & Ratings

## Overview

This document extends the base schema (`DATABASE_SCHEMA.md`) with tables for:
- Automatic historical stats generation (2025/26+)
- Manager rating system (FFA_RATING_V1)
- Legacy CSV data imports (pre-2025/26)
- Weekly stat persistence

## Season Cutoff Enforcement

**CRITICAL:** All data processing must enforce the season cutoff:
- Seasons < 2025/26: Legacy data (CSV imports only, never recomputed)
- Seasons ≥ 2025/26: Living data (auto-generated weekly from FPL API)

## Historical Stats Tables (2025/26+)

### `season_standings`

Stores final league standings per season (auto-generated from 2025/26 onward).

```sql
CREATE TABLE season_standings (
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

CREATE INDEX idx_season_standings_season ON season_standings(season);
CREATE INDEX idx_season_standings_rank ON season_standings(season, final_rank);
```

### `season_trophies`

Stores trophy wins per season (auto-generated from 2025/26 onward).

```sql
CREATE TABLE season_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  league_title BOOLEAN DEFAULT false,
  cup_winner BOOLEAN DEFAULT false,
  goblet_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id)
);

CREATE INDEX idx_season_trophies_season ON season_trophies(season);
CREATE INDEX idx_season_trophies_team_id ON season_trophies(team_id);
```

### `manager_weekly_stats`

Stores weekly manager statistics for rating calculations (2025/26+).

```sql
CREATE TABLE manager_weekly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  gameweek INTEGER NOT NULL,
  points INTEGER NOT NULL,
  captain_points INTEGER,
  bench_points INTEGER,
  h2h_result TEXT, -- 'win', 'loss', 'draw', null
  h2h_opponent_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, team_id, gameweek)
);

CREATE INDEX idx_manager_weekly_stats_season ON manager_weekly_stats(season);
CREATE INDEX idx_manager_weekly_stats_team_season ON manager_weekly_stats(team_id, season);
CREATE INDEX idx_manager_weekly_stats_gameweek ON manager_weekly_stats(season, gameweek);
```

## Manager Rating System Tables

### `manager_ratings`

Current ratings for all managers (updated weekly).

```sql
CREATE TABLE manager_ratings (
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

CREATE INDEX idx_manager_ratings_rating ON manager_ratings(rating DESC);
CREATE INDEX idx_manager_ratings_team_id ON manager_ratings(team_id);
```

### `manager_rating_history`

Historical rating changes per gameweek.

```sql
CREATE TABLE manager_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  rating DECIMAL(10, 2) NOT NULL,
  rating_delta DECIMAL(10, 2) NOT NULL,
  delta_source TEXT, -- 'league', 'cup', 'goblet', 'h2h', 'weekly'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season, gameweek)
);

CREATE INDEX idx_manager_rating_history_team_season ON manager_rating_history(team_id, season);
CREATE INDEX idx_manager_rating_history_season_gw ON manager_rating_history(season, gameweek);
```

### `manager_rating_deltas`

Detailed attribution of rating changes.

```sql
CREATE TABLE manager_rating_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL,
  source TEXT NOT NULL, -- 'league', 'cup', 'goblet', 'h2h'
  delta DECIMAL(10, 2) NOT NULL,
  context JSONB, -- Additional context (opponent, round, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_manager_rating_deltas_team_season ON manager_rating_deltas(team_id, season);
CREATE INDEX idx_manager_rating_deltas_source ON manager_rating_deltas(source);
```

## Legacy CSV Import Tables (Pre-2025/26)

### `legacy_league_standings`

Imported from CSV for seasons < 2025/26.

**Note:** `manager_name` is the stable identifier (constant across seasons).
`entry_id` changes yearly and is optional. `entry_name` is also optional.

```sql
CREATE TABLE legacy_league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  manager_name TEXT NOT NULL,  -- Stable identifier (constant across seasons)
  entry_id TEXT,                -- Optional: changes yearly
  entry_name TEXT,              -- Optional: can be stored for reference
  final_rank INTEGER NOT NULL,
  total_points INTEGER,
  wins INTEGER,
  draws INTEGER,
  losses INTEGER,
  points_for INTEGER,
  points_against INTEGER,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name)  -- Use manager_name as unique constraint
);

CREATE INDEX idx_legacy_league_standings_season ON legacy_league_standings(season);
CREATE INDEX idx_legacy_league_standings_manager_name ON legacy_league_standings(manager_name);
CREATE INDEX idx_legacy_league_standings_entry_id ON legacy_league_standings(entry_id); -- Optional index
```

### `legacy_manager_stats`

Imported manager statistics from CSV.

**Note:** `manager_name` is the stable identifier. `entry_id` is optional.

```sql
CREATE TABLE legacy_manager_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  manager_name TEXT NOT NULL,  -- Stable identifier
  entry_id TEXT,                -- Optional: changes yearly
  ppg DECIMAL(5, 2),
  plus_g DECIMAL(5, 2),
  total_transactions INTEGER,
  highest_gameweek INTEGER,
  lowest_gameweek INTEGER,
  fifty_plus_weeks INTEGER,
  sub_twenty_weeks INTEGER,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name)  -- Use manager_name as unique constraint
);

CREATE INDEX idx_legacy_manager_stats_season ON legacy_manager_stats(season);
CREATE INDEX idx_legacy_manager_stats_manager_name ON legacy_manager_stats(manager_name);
```

### `legacy_trophies`

Imported trophy data from CSV.

**Note:** `manager_name` is the stable identifier. `entry_id` is optional.

```sql
CREATE TABLE legacy_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL,
  manager_name TEXT NOT NULL,  -- Stable identifier
  entry_id TEXT,                -- Optional: changes yearly
  league_title BOOLEAN DEFAULT false,
  cup_winner BOOLEAN DEFAULT false,
  goblet_winner BOOLEAN DEFAULT false,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name)  -- Use manager_name as unique constraint
);

CREATE INDEX idx_legacy_trophies_season ON legacy_trophies(season);
CREATE INDEX idx_legacy_trophies_manager_name ON legacy_trophies(manager_name);
```

## Views for Unified Queries

### `unified_league_standings`

Combines legacy and computed standings.

```sql
CREATE VIEW unified_league_standings AS
-- Legacy data (pre-2025/26)
-- manager_name is the stable identifier
SELECT 
  season,
  manager_name,  -- Primary identifier
  entry_id,       -- Optional: may be NULL
  entry_name,     -- Optional: may be NULL
  final_rank,
  total_points,
  wins,
  draws,
  losses,
  points_for,
  points_against,
  'legacy' AS source
FROM legacy_league_standings
WHERE season < '2025/26'

UNION ALL

-- Computed data (2025/26+)
-- Join on manager_name to match with legacy data
SELECT 
  ss.season,
  t.manager_name,  -- Primary identifier for matching
  t.entry_id,      -- Current season's entry_id
  t.entry_name,    -- Current season's entry_name
  ss.final_rank,
  ss.total_points,
  ss.wins,
  ss.draws,
  ss.losses,
  ss.points_for,
  ss.points_against,
  'computed' AS source
FROM season_standings ss
JOIN teams t ON ss.team_id = t.id
WHERE ss.season >= '2025/26';
```

### `unified_trophies`

Combines legacy and computed trophies.

```sql
CREATE VIEW unified_trophies AS
-- Legacy data
-- manager_name is the stable identifier
SELECT 
  season,
  manager_name,  -- Primary identifier
  entry_id,       -- Optional: may be NULL
  league_title,
  cup_winner,
  goblet_winner,
  'legacy' AS source
FROM legacy_trophies
WHERE season < '2025/26'

UNION ALL

-- Computed data
-- Join on manager_name to match with legacy data
SELECT 
  st.season,
  t.manager_name,  -- Primary identifier for matching
  t.entry_id,      -- Current season's entry_id
  st.league_title,
  st.cup_winner,
  st.goblet_winner,
  'computed' AS source
FROM season_trophies st
JOIN teams t ON st.team_id = t.id
WHERE st.season >= '2025/26';
```

## RLS Policies

All new tables should have public read access:

```sql
-- Season standings
ALTER TABLE season_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON season_standings FOR SELECT USING (true);

-- Season trophies
ALTER TABLE season_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON season_trophies FOR SELECT USING (true);

-- Manager weekly stats
ALTER TABLE manager_weekly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON manager_weekly_stats FOR SELECT USING (true);

-- Manager ratings
ALTER TABLE manager_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON manager_ratings FOR SELECT USING (true);

-- Manager rating history
ALTER TABLE manager_rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON manager_rating_history FOR SELECT USING (true);

-- Manager rating deltas
ALTER TABLE manager_rating_deltas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON manager_rating_deltas FOR SELECT USING (true);

-- Legacy tables
ALTER TABLE legacy_league_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_league_standings FOR SELECT USING (true);

ALTER TABLE legacy_manager_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_manager_stats FOR SELECT USING (true);

ALTER TABLE legacy_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_trophies FOR SELECT USING (true);
```

## CSV Import Schemas

### Expected CSV Structure: `overall_standings.csv`

```csv
season,entry_id,entry_name,manager_name,final_rank,total_points,wins,draws,losses,points_for,points_against
2021/22,164475,Team Name,Manager Name,1,2500,25,0,13,1739,1000
2021/22,123456,Another Team,Another Manager,2,2450,22,1,15,1618,1100
```

### Expected CSV Structure: `manager_stats.csv`

```csv
season,entry_id,manager_name,ppg,plus_g,total_transactions,highest_gameweek,lowest_gameweek,fifty_plus_weeks,sub_twenty_weeks
2021/22,164475,Manager Name,1.66,38.64,113,100,14,36,9
```

### Expected CSV Structure: `historic_league_tables.csv`

Same as `overall_standings.csv` but may include additional historical columns.

## Migration Notes

1. Create all tables in order (dependencies first)
2. Create views after tables
3. Set up RLS policies
4. Import legacy CSV data (seasons < 2025/26 only)
5. Begin weekly stat persistence for 2025/26+
