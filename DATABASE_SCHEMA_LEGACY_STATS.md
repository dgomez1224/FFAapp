# Database Schema - Legacy Statistics

## Overview

This schema extends the existing database with tables for legacy league statistics, manager profiles, and historical data. All tables use `manager_name` as the primary identifier, matching the canonical manager list.

## Canonical Managers

The following 10 managers are fixed and permanent:
- PATRICK
- MATT
- MARCO
- LENNART
- CHRIS
- IAN
- HENRI
- DAVID
- MAX
- BENJI

All `manager_name` columns must contain one of these values exactly (case-insensitive matching, but stored in uppercase).

## All-Time Manager Statistics

### `all_time_manager_stats`

Stores aggregated all-time statistics for each manager.

```sql
CREATE TABLE all_time_manager_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  points_plus INTEGER NOT NULL DEFAULT 0,
  points_per_game DECIMAL(5, 2),
  total_transactions INTEGER DEFAULT 0,
  league_titles INTEGER DEFAULT 0,
  cup_wins INTEGER DEFAULT 0,
  goblet_wins INTEGER DEFAULT 0,
  fifty_plus_weeks INTEGER DEFAULT 0,
  sub_twenty_weeks INTEGER DEFAULT 0,
  highest_gameweek INTEGER,
  lowest_gameweek INTEGER,
  largest_margin_win DECIMAL(5, 2),
  largest_margin_loss DECIMAL(5, 2),
  avg_margin_win DECIMAL(5, 2),
  avg_margin_loss DECIMAL(5, 2),
  longest_win_streak INTEGER,
  longest_loss_streak INTEGER,
  longest_undefeated_streak INTEGER,
  elo_rating DECIMAL(5, 2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_name)
);

CREATE INDEX idx_all_time_manager_stats_manager_name ON all_time_manager_stats(manager_name);
```

## Season-by-Season League Tables

### `legacy_season_standings`

Stores final league standings for each season (pre-2025/26).

```sql
CREATE TABLE legacy_season_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season < '2025/26'),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  final_rank INTEGER NOT NULL CHECK (final_rank BETWEEN 1 AND 10),
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  competition_type TEXT DEFAULT 'league', -- 'league' or 'goblet'
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name, competition_type)
);

CREATE INDEX idx_legacy_season_standings_season ON legacy_season_standings(season);
CREATE INDEX idx_legacy_season_standings_manager_name ON legacy_season_standings(manager_name);
CREATE INDEX idx_legacy_season_standings_rank ON legacy_season_standings(season, final_rank);
```

## Head-to-Head Statistics

### `legacy_h2h_stats`

Stores H2H records between managers.

```sql
CREATE TABLE legacy_h2h_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  opponent_name TEXT NOT NULL CHECK (opponent_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  season TEXT, -- NULL for all-time, or specific season
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  avg_points DECIMAL(5, 2),
  games_played INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_name, opponent_name, season)
);

CREATE INDEX idx_legacy_h2h_stats_manager ON legacy_h2h_stats(manager_name);
CREATE INDEX idx_legacy_h2h_stats_opponent ON legacy_h2h_stats(opponent_name);
CREATE INDEX idx_legacy_h2h_stats_season ON legacy_h2h_stats(season);
```

### `legacy_h2h_gameweek_results`

Stores individual H2H gameweek results.

```sql
CREATE TABLE legacy_h2h_gameweek_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season < '2025/26'),
  gameweek INTEGER NOT NULL CHECK (gameweek BETWEEN 1 AND 38),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  opponent_name TEXT NOT NULL CHECK (opponent_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  points_for INTEGER NOT NULL,
  points_against INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('W', 'D', 'L')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, gameweek, manager_name, opponent_name)
);

CREATE INDEX idx_legacy_h2h_gw_season_gw ON legacy_h2h_gameweek_results(season, gameweek);
CREATE INDEX idx_legacy_h2h_gw_manager ON legacy_h2h_gameweek_results(manager_name);
```

## Gameweek Standings (Legacy)

### `legacy_gameweek_standings`

Stores standings for each gameweek in legacy seasons.

```sql
CREATE TABLE legacy_gameweek_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season < '2025/26'),
  gameweek INTEGER NOT NULL CHECK (gameweek BETWEEN 1 AND 38),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 10),
  points INTEGER NOT NULL,
  captain_points INTEGER,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, gameweek, manager_name)
);

CREATE INDEX idx_legacy_gw_standings_season_gw ON legacy_gameweek_standings(season, gameweek);
CREATE INDEX idx_legacy_gw_standings_manager ON legacy_gameweek_standings(manager_name);
CREATE INDEX idx_legacy_gw_standings_rank ON legacy_gameweek_standings(season, gameweek, rank);
```

## Season Trophies (Legacy)

### `legacy_season_trophies`

Stores trophy winners per season (pre-2025/26).

```sql
CREATE TABLE legacy_season_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season < '2025/26'),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  league_champion BOOLEAN DEFAULT false,
  cup_winner BOOLEAN DEFAULT false,
  goblet_winner BOOLEAN DEFAULT false,
  treble BOOLEAN DEFAULT false,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name)
);

CREATE INDEX idx_legacy_season_trophies_season ON legacy_season_trophies(season);
CREATE INDEX idx_legacy_season_trophies_manager ON legacy_season_trophies(manager_name);
```

## Manager Season Stats

### `legacy_manager_season_stats`

Stores per-season statistics for each manager.

```sql
CREATE TABLE legacy_manager_season_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season TEXT NOT NULL CHECK (season < '2025/26'),
  manager_name TEXT NOT NULL CHECK (manager_name IN (
    'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
    'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
  )),
  points_per_game DECIMAL(5, 2),
  points_plus DECIMAL(5, 2),
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
  largest_margin_win DECIMAL(5, 2),
  largest_margin_loss DECIMAL(5, 2),
  avg_margin_win DECIMAL(5, 2),
  avg_margin_loss DECIMAL(5, 2),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season, manager_name)
);

CREATE INDEX idx_legacy_manager_season_stats_season ON legacy_manager_season_stats(season);
CREATE INDEX idx_legacy_manager_season_stats_manager ON legacy_manager_season_stats(manager_name);
```

## RLS Policies

All tables should have public read access:

```sql
-- All-time stats
ALTER TABLE all_time_manager_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON all_time_manager_stats FOR SELECT USING (true);

-- Season standings
ALTER TABLE legacy_season_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_season_standings FOR SELECT USING (true);

-- H2H stats
ALTER TABLE legacy_h2h_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_h2h_stats FOR SELECT USING (true);

ALTER TABLE legacy_h2h_gameweek_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_h2h_gameweek_results FOR SELECT USING (true);

-- Gameweek standings
ALTER TABLE legacy_gameweek_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_gameweek_standings FOR SELECT USING (true);

-- Season trophies
ALTER TABLE legacy_season_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_season_trophies FOR SELECT USING (true);

-- Manager season stats
ALTER TABLE legacy_manager_season_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON legacy_manager_season_stats FOR SELECT USING (true);
```

## Data Validation

All tables enforce the canonical manager list via CHECK constraints. Invalid manager names will be rejected at the database level.

## Notes

- All legacy data is for seasons < 2025/26
- Current season (2025/26+) uses live API data only
- Manager names are stored in uppercase
- All timestamps use TIMESTAMPTZ
- Indexes are optimized for common query patterns
