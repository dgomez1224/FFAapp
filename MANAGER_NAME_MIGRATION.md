# Manager Name Migration Guide

## Overview

The database schema has been updated to use `manager_name` as the stable identifier for legacy data, since `entry_id` changes every year. This document explains the changes and migration steps.

## Key Changes

### 1. Primary Identifier
- **Before:** `entry_id` was the primary identifier for legacy data
- **After:** `manager_name` is the primary identifier (stable across seasons)
- **Reason:** `entry_id` changes yearly in FPL, but `manager_name` remains constant

### 2. Database Schema Updates

**Legacy Tables:**
- `legacy_league_standings`: `UNIQUE(season, manager_name)` instead of `UNIQUE(season, entry_id)`
- `legacy_manager_stats`: `UNIQUE(season, manager_name)` instead of `UNIQUE(season, entry_id)`
- `legacy_trophies`: `UNIQUE(season, manager_name)` instead of `UNIQUE(season, entry_id)`

**Column Changes:**
- `manager_name`: Now `NOT NULL` (required)
- `entry_id`: Now nullable (optional)
- `entry_name`: Now nullable (optional)

### 3. Unified Views

The `unified_league_standings` and `unified_trophies` views now:
- Use `manager_name` as the primary identifier
- Join legacy and computed data on `manager_name`
- Include `entry_id` and `entry_name` as optional fields

## Migration Steps

If you have existing legacy data imported with the old schema:

### Step 1: Backup Database
```sql
-- Create backup of legacy tables
CREATE TABLE legacy_league_standings_backup AS 
SELECT * FROM legacy_league_standings;
```

### Step 2: Update Schema
```sql
-- Drop old unique constraint
ALTER TABLE legacy_league_standings 
DROP CONSTRAINT IF EXISTS legacy_league_standings_season_entry_id_key;

-- Add new unique constraint on manager_name
ALTER TABLE legacy_league_standings 
ADD CONSTRAINT legacy_league_standings_season_manager_name_key 
UNIQUE(season, manager_name);

-- Make manager_name NOT NULL (if not already)
ALTER TABLE legacy_league_standings 
ALTER COLUMN manager_name SET NOT NULL;

-- Make entry_id nullable (if not already)
ALTER TABLE legacy_league_standings 
ALTER COLUMN entry_id DROP NOT NULL;

-- Repeat for other legacy tables
ALTER TABLE legacy_manager_stats 
DROP CONSTRAINT IF EXISTS legacy_manager_stats_season_entry_id_key;

ALTER TABLE legacy_manager_stats 
ADD CONSTRAINT legacy_manager_stats_season_manager_name_key 
UNIQUE(season, manager_name);

ALTER TABLE legacy_manager_stats 
ALTER COLUMN manager_name SET NOT NULL;

ALTER TABLE legacy_manager_stats 
ALTER COLUMN entry_id DROP NOT NULL;

ALTER TABLE legacy_trophies 
DROP CONSTRAINT IF EXISTS legacy_trophies_season_entry_id_key;

ALTER TABLE legacy_trophies 
ADD CONSTRAINT legacy_trophies_season_manager_name_key 
UNIQUE(season, manager_name);

ALTER TABLE legacy_trophies 
ALTER COLUMN manager_name SET NOT NULL;

ALTER TABLE legacy_trophies 
ALTER COLUMN entry_id DROP NOT NULL;
```

### Step 3: Verify Data Integrity
```sql
-- Check for missing manager_names
SELECT COUNT(*) 
FROM legacy_league_standings 
WHERE manager_name IS NULL;
-- Should return 0

-- Check for duplicate manager_names per season
SELECT season, manager_name, COUNT(*) 
FROM legacy_league_standings 
GROUP BY season, manager_name 
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Verify manager names are consistent
SELECT manager_name, COUNT(DISTINCT entry_id) as entry_id_count
FROM legacy_league_standings
WHERE entry_id IS NOT NULL
GROUP BY manager_name
HAVING COUNT(DISTINCT entry_id) > 1;
-- This is expected - managers can have different entry_ids per season
```

### Step 4: Update Indexes
```sql
-- Add index on manager_name if not exists
CREATE INDEX IF NOT EXISTS idx_legacy_league_standings_manager_name 
ON legacy_league_standings(manager_name);

CREATE INDEX IF NOT EXISTS idx_legacy_manager_stats_manager_name 
ON legacy_manager_stats(manager_name);

CREATE INDEX IF NOT EXISTS idx_legacy_trophies_manager_name 
ON legacy_trophies(manager_name);
```

### Step 5: Recreate Views
```sql
-- Drop and recreate unified views
DROP VIEW IF EXISTS unified_league_standings;
CREATE VIEW unified_league_standings AS
-- Legacy data (pre-2025/26)
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

DROP VIEW IF EXISTS unified_trophies;
CREATE VIEW unified_trophies AS
-- Legacy data
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

## CSV Import Updates

When importing new CSV files:

1. **Ensure `manager_name` column exists** and is populated
2. **`entry_id` is optional** - can be NULL or omitted
3. **`entry_name` is optional** - can be NULL or omitted
4. **Manager names must be consistent** across all CSV files for the same person

## Code Updates

### Backend
- Updated `league-history` endpoint to handle `manager_name` as primary identifier
- Legacy data mapping now prioritizes `manager_name`

### Frontend
- `LeagueHistory` component uses `manager_name` as key instead of `entry_id`
- Displays `entry_name` or `entry_id` as fallback for team name

## Benefits

1. **Stable Identifiers:** Manager names don't change year-to-year
2. **Flexible Entry IDs:** Can store different entry_ids per season without conflicts
3. **Better Matching:** Legacy and computed data can be matched on `manager_name`
4. **Rating Calculations:** Easier to aggregate data across seasons for ratings

## Important Notes

- **Manager Name Consistency:** Ensure manager names are spelled exactly the same across all CSV files
- **Case Sensitivity:** Manager names are case-sensitive - "John Smith" ≠ "john smith"
- **Entry ID Changes:** It's normal for the same manager to have different `entry_id` values across seasons
- **Future Seasons:** For 2025/26+, `entry_id` is still used in the `teams` table, but legacy data uses `manager_name`

---

**Migration Status:** ✅ Complete - All code updated to use `manager_name` as stable identifier
