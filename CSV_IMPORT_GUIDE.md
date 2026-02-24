# CSV Import Guide - Legacy Data (Pre-2025/26)

## Overview

This guide explains how to import historical league data from CSV files for seasons before 2025/26. **Seasons from 2025/26 onward are automatically generated** and should NOT be imported via CSV.

## Season Cutoff

**CRITICAL:** The cutoff season is `2025/26`. All data processing enforces this:
- **Seasons < 2025/26:** Legacy data (CSV imports only, never recomputed)
- **Seasons ≥ 2025/26:** Living data (auto-generated weekly from FPL API)

## CSV File Locations

Place CSV files in:
```
/data/legacy/
  ├── overall_standings.csv
  ├── manager_stats.csv
  ├── historic_league_tables.csv
```

## CSV Schema Requirements

### 1. `overall_standings.csv`

**Purpose:** Final league standings per season

**Required Columns:**
- `season` (TEXT) - Format: "YYYY/YY" (e.g., "2021/22")
- `manager_name` (TEXT) - **REQUIRED** - Manager name (stable identifier, constant across seasons)
- `final_rank` (INTEGER) - Final league position (1-10)
- `total_points` (INTEGER) - Total season points
- `wins` (INTEGER) - Number of wins
- `draws` (INTEGER) - Number of draws
- `losses` (INTEGER) - Number of losses
- `points_for` (INTEGER) - Total points scored
- `points_against` (INTEGER) - Total points conceded

**Optional Columns:**
- `entry_id` (TEXT) - FPL entry ID (changes yearly, optional)
- `entry_name` (TEXT) - Team name (optional, can be stored for reference)

**Important:** `manager_name` is the primary identifier and must be consistent across seasons. `entry_id` changes yearly and is optional.

**Example:**
```csv
season,manager_name,final_rank,total_points,wins,draws,losses,points_for,points_against,entry_id,entry_name
2021/22,Manager Name,1,2500,25,0,13,1739,1000,164475,Team Name
2021/22,Another Manager,2,2450,22,1,15,1618,1100,123456,Another Team
2022/23,Manager Name,3,2400,20,2,16,1600,1050,164476,Team Name
```

### 2. `manager_stats.csv`

**Purpose:** Manager statistics per season

**Required Columns:**
- `season` (TEXT) - Format: "YYYY/YY"
- `manager_name` (TEXT) - **REQUIRED** - Manager name (stable identifier)
- `ppg` (DECIMAL) - Points per game (0-3)
- `plus_g` (DECIMAL) - Average points per gameweek
- `total_transactions` (INTEGER) - Total transfers made
- `highest_gameweek` (INTEGER) - Highest scoring gameweek
- `lowest_gameweek` (INTEGER) - Lowest scoring gameweek
- `fifty_plus_weeks` (INTEGER) - Number of 50+ point gameweeks
- `sub_twenty_weeks` (INTEGER) - Number of sub-20 point gameweeks

**Optional Columns:**
- `entry_id` (TEXT) - FPL entry ID (changes yearly, optional)

**Example:**
```csv
season,manager_name,ppg,plus_g,total_transactions,highest_gameweek,lowest_gameweek,fifty_plus_weeks,sub_twenty_weeks,entry_id
2021/22,Manager Name,1.66,38.64,113,100,14,36,9,164475
2021/22,Another Manager,1.68,37.50,108,95,18,32,7,123456
```

### 3. `historic_league_tables.csv`

**Purpose:** Historical league tables (can be same as overall_standings.csv)

**Schema:** Same as `overall_standings.csv`

## Import Methods

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to Table Editor
   - Select the target table (e.g., `legacy_league_standings`)

2. **Import CSV**
   - Click "Import data" → "Import CSV"
   - Select your CSV file
   - Map columns to table columns
   - **Important:** Ensure `season < '2025/26'` filter is applied or verify manually

3. **Verify Import**
   - Check row count matches CSV
   - Verify season values are all < 2025/26
   - Check for duplicate entries

### Method 2: SQL COPY Command

```sql
-- Import overall standings
-- Note: manager_name is required, entry_id and entry_name are optional
COPY legacy_league_standings(
  season,
  manager_name,  -- Required: stable identifier
  final_rank,
  total_points,
  wins,
  draws,
  losses,
  points_for,
  points_against,
  entry_id,       -- Optional: changes yearly
  entry_name      -- Optional: can be stored for reference
)
FROM '/path/to/data/legacy/overall_standings.csv'
WITH (FORMAT csv, HEADER true);

-- Import manager stats
-- Note: manager_name is required, entry_id is optional
COPY legacy_manager_stats(
  season,
  manager_name,  -- Required: stable identifier
  ppg,
  plus_g,
  total_transactions,
  highest_gameweek,
  lowest_gameweek,
  fifty_plus_weeks,
  sub_twenty_weeks,
  entry_id       -- Optional: changes yearly
)
FROM '/path/to/data/legacy/manager_stats.csv'
WITH (FORMAT csv, HEADER true);

-- Import trophies (if available)
-- Note: manager_name is required, entry_id is optional
COPY legacy_trophies(
  season,
  manager_name,  -- Required: stable identifier
  league_title,
  cup_winner,
  goblet_winner,
  entry_id       -- Optional: changes yearly
)
FROM '/path/to/data/legacy/trophies.csv'
WITH (FORMAT csv, HEADER true);
```

### Method 3: Edge Function (Admin-Only)

Create an admin-only Edge Function endpoint that:
1. Accepts CSV data via POST
2. Validates season < 2025/26
3. Inserts into appropriate legacy tables
4. Returns import summary

**Example endpoint structure:**
```typescript
POST /admin/import-legacy-data
Body: {
  table: "legacy_league_standings",
  data: [...], // CSV rows as JSON
  season: "2021/22"
}
```

## Validation Rules

Before importing, ensure:

1. **Season Format:** All seasons must be in "YYYY/YY" format
2. **Season Cutoff:** All seasons must be < "2025/26"
3. **Manager Names:** Must be consistent across seasons (stable identifier)
4. **Entry IDs:** Optional - can be NULL or different per season
5. **Ranks:** Must be integers 1-10
6. **No Duplicates:** Check for existing records before import (based on season + manager_name)

## Post-Import Verification

After importing, verify:

```sql
-- Check imported seasons
SELECT DISTINCT season 
FROM legacy_league_standings 
ORDER BY season DESC;

-- Verify all seasons are < 2025/26
SELECT season 
FROM legacy_league_standings 
WHERE season >= '2025/26';
-- Should return 0 rows

-- Check data completeness
SELECT 
  season,
  COUNT(*) as team_count,
  MIN(final_rank) as min_rank,
  MAX(final_rank) as max_rank
FROM legacy_league_standings
GROUP BY season
ORDER BY season DESC;

-- Verify manager names are consistent
-- Check for managers with multiple entry_ids in same season (shouldn't happen)
SELECT season, manager_name, COUNT(DISTINCT entry_id) as entry_id_count
FROM legacy_league_standings
WHERE entry_id IS NOT NULL
GROUP BY season, manager_name
HAVING COUNT(DISTINCT entry_id) > 1;
-- Should return 0 rows

-- Verify manager names match teams table (for computed data matching)
-- This is optional since entry_id changes yearly
SELECT DISTINCT l.manager_name
FROM legacy_league_standings l
WHERE NOT EXISTS (
  SELECT 1 FROM teams t 
  WHERE t.manager_name = l.manager_name
);
-- This may return rows if managers haven't played in 2025/26+ yet
```

## Trophy Data Import

If you have trophy data, import it separately:

```csv
season,manager_name,league_title,cup_winner,goblet_winner,entry_id
2021/22,Manager Name,true,false,false,164475
2022/23,Another Manager,false,true,false,123456
2023/24,Manager Name,true,true,true,164476
```

**Note:** 
- `manager_name` is required (stable identifier)
- `entry_id` is optional (changes yearly)
- Trophy data is used for rating calculations. Ensure accuracy.

## Troubleshooting

### Duplicate Key Errors

If you get duplicate key errors:
```sql
-- Check for duplicates (based on season + manager_name)
SELECT season, manager_name, COUNT(*)
FROM legacy_league_standings
GROUP BY season, manager_name
HAVING COUNT(*) > 1;

-- Delete duplicates (keep first)
DELETE FROM legacy_league_standings
WHERE id NOT IN (
  SELECT MIN(id)
  FROM legacy_league_standings
  GROUP BY season, manager_name
);
```

### Missing or Inconsistent Manager Names

If manager names are inconsistent:
1. Check for typos or variations (e.g., "John Smith" vs "John A. Smith")
2. Standardize manager names across all CSV files
3. Manager names must match exactly to link legacy and computed data

**Note:** Entry IDs are optional and can be NULL. They don't need to match the teams table since they change yearly.

### Season Format Issues

If seasons aren't recognized:
- Ensure format is exactly "YYYY/YY" (e.g., "2021/22", not "2021-22")
- Check for leading/trailing spaces
- Verify no null or empty season values

## Best Practices

1. **Backup First:** Always backup database before bulk imports
2. **Test Import:** Import one season first to verify schema
3. **Validate Data:** Run validation queries after import
4. **Document Changes:** Keep track of what was imported and when
5. **Version Control:** Store CSV files in version control

## Automated Import Script

Example Node.js script for automated imports:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importLegacyStandings(filePath: string) {
  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const records = csv.parse(csvContent, { columns: true });

  // Filter to ensure season < 2025/26
  const validRecords = records.filter((r: any) => r.season < '2025/26');

  // Ensure manager_name is present (required)
  const recordsWithManager = validRecords.filter((r: any) => r.manager_name);

  // Map CSV columns to database columns
  // manager_name is required, entry_id and entry_name are optional
  const mappedRecords = recordsWithManager.map((r: any) => ({
    season: r.season,
    manager_name: r.manager_name,  // Required
    entry_id: r.entry_id || null,  // Optional
    entry_name: r.entry_name || null,  // Optional
    final_rank: r.final_rank,
    total_points: r.total_points,
    wins: r.wins,
    draws: r.draws,
    losses: r.losses,
    points_for: r.points_for,
    points_against: r.points_against,
  }));

  const { data, error } = await supabase
    .from('legacy_league_standings')
    .upsert(mappedRecords, { onConflict: 'season,manager_name' });  // Use manager_name for conflict resolution

  if (error) throw error;
  return data;
}
```

## Next Steps

After importing legacy data:

1. Verify data appears in `/league-history` endpoint
2. Check that ratings can be calculated (requires trophy data)
3. Ensure unified views work correctly
4. Test that legacy data doesn't interfere with computed data

---

**Remember:** Never import data for seasons ≥ 2025/26. Those are automatically generated weekly.
