# CSV Import Utilities

## Overview

This document provides utilities and scripts for importing legacy CSV data into the database. The import process uses index-based mapping to canonical managers and filters out the current season (2025/26).

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

## CSV File Structure

### 1. ALL TIME LEADERS.csv

**Structure:** Has `manager_name` column explicitly

**Columns:**
- `manager_name` (REQUIRED) - Manager name
- `WINS`, `LOSSES`, `DRAWS` - Win/loss/draw counts
- `POINTS` - Total points
- `+` or `plus` - Points plus
- `TRANSACTIONS` - Total transactions
- `PPG` - Points per game
- `League Titles` - League title count
- `FFA Cups` - Cup wins
- `Goblets` - Goblet wins
- `50+ PTS` - 50+ point weeks
- `20- PTS` - Sub-20 point weeks
- `Margin Win`, `Margin Loss` - Margin statistics
- `LONGEST W STREAK`, `LONGEST L STREAK` - Streak records
- `ELO` - ELO rating

**Import Process:**
1. Parse CSV with `parseCSV()`
2. Use `parseAllTimeStats()` to extract data
3. Validate manager names with `validateCanonicalManagers()`
4. Insert into `all_time_manager_stats` table

### 2. Home.csv

**Structure:** Season standings with manager names in rows (ordered by rank)

**Format per season:**
- Row 1: Header (e.g., "League Standings 2023/24")
- Rows 2-11: Standings (C or rank, Manager Name, W, D, L, +, PTS)
- Then Goblet standings section
- Then "Standings by Gameweek" section (empty or Flourish link)

**Import Process:**
1. Parse CSV and identify season sections
2. For each season section:
   - Extract league standings (first table)
   - Extract goblet standings (second table)
   - Use `parseSeasonStandings()` with index-based mapping
   - Filter out 2025/26 season
3. Insert into `legacy_season_standings` table

### 3. MANAGER PROFILE_ [NAME].csv

**Structure:** Individual manager statistics per season

**Sections:**
- V.S RECORD ALL TIME - All-time H2H records
- V.S RECORD [SEASON] - Season-specific H2H records
- TROPHIES section
- Season results (gameweek-by-gameweek H2H)

**Import Process:**
1. Parse CSV
2. Extract manager name from filename
3. Parse H2H records (all-time and per-season)
4. Parse trophy information
5. Parse gameweek H2H results
6. Insert into:
   - `legacy_h2h_stats`
   - `legacy_h2h_gameweek_results`
   - `legacy_season_trophies`
   - `legacy_manager_season_stats`

## Import Script Example

```typescript
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { 
  parseCSV, 
  parseAllTimeStats, 
  parseSeasonStandings,
  mapRowsToManagers,
  filterCurrentSeason,
  validateCanonicalManagers 
} from './src/lib/csvIngestion';
import { CANONICAL_MANAGERS } from './src/lib/canonicalManagers';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importAllTimeStats() {
  const csvContent = fs.readFileSync(
    './data/legacy/FPL All-Time Statistics (2021-25) - ALL TIME LEADERS.csv',
    'utf-8'
  );

  const stats = parseAllTimeStats(csvContent);
  const { valid, invalid } = validateCanonicalManagers(stats);

  if (invalid.length > 0) {
    console.error('Invalid managers found:', invalid);
    return;
  }

  const { error } = await supabase
    .from('all_time_manager_stats')
    .upsert(valid, { onConflict: 'manager_name' });

  if (error) throw error;
  console.log(`Imported ${valid.length} all-time stats`);
}

async function importSeasonStandings() {
  const csvContent = fs.readFileSync(
    './data/legacy/FPL All-Time Statistics (2021-25) - Home.csv',
    'utf-8'
  );

  // Parse and identify seasons
  const rows = parseCSV(csvContent);
  const seasons = ['2021/22', '2022/23', '2023/24', '2024/25'];
  
  const allStandings: any[] = [];

  seasons.forEach((season) => {
    if (season >= '2025/26') return; // Skip current season

    // Find league standings section for this season
    // This is a simplified example - actual parsing will be more complex
    const leagueStandings = parseSeasonStandings(csvContent, season);
    const gobletStandings = parseSeasonStandings(csvContent, season); // Parse goblet section

    allStandings.push(
      ...leagueStandings.map(s => ({ ...s, competition_type: 'league' })),
      ...gobletStandings.map(s => ({ ...s, competition_type: 'goblet' }))
    );
  });

  const filtered = filterCurrentSeason(allStandings);
  const { valid } = validateCanonicalManagers(filtered);

  const { error } = await supabase
    .from('legacy_season_standings')
    .upsert(valid, { onConflict: 'season,manager_name,competition_type' });

  if (error) throw error;
  console.log(`Imported ${valid.length} season standings`);
}

async function importManagerProfiles() {
  const managers = CANONICAL_MANAGERS;

  for (const manager of managers) {
    const filename = `./data/legacy/FPL All-Time Statistics (2021-25) - MANAGER PROFILE_ ${manager}.csv`;
    
    if (!fs.existsSync(filename)) {
      console.warn(`File not found: ${filename}`);
      continue;
    }

    const csvContent = fs.readFileSync(filename, 'utf-8');
    
    // Parse H2H records, trophies, etc.
    // Implementation depends on exact CSV structure
    
    console.log(`Imported profile for ${manager}`);
  }
}

// Run imports
async function main() {
  try {
    await importAllTimeStats();
    await importSeasonStandings();
    await importManagerProfiles();
    console.log('All imports completed');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
```

## Validation Rules

Before importing:

1. **Manager Names:** All must be in canonical list
2. **Season Filter:** All seasons must be < 2025/26
3. **Data Integrity:** Check for duplicates
4. **Required Fields:** Ensure required columns are present

## Post-Import Verification

```sql
-- Verify all managers are canonical
SELECT DISTINCT manager_name 
FROM all_time_manager_stats
WHERE manager_name NOT IN (
  'PATRICK', 'MATT', 'MARCO', 'LENNART', 'CHRIS', 
  'IAN', 'HENRI', 'DAVID', 'MAX', 'BENJI'
);
-- Should return 0 rows

-- Verify no current season data
SELECT DISTINCT season 
FROM legacy_season_standings
WHERE season >= '2025/26';
-- Should return 0 rows

-- Verify data completeness
SELECT 
  manager_name,
  COUNT(DISTINCT season) as seasons_played
FROM legacy_season_standings
WHERE competition_type = 'league'
GROUP BY manager_name
ORDER BY manager_name;
-- Should show all 10 managers
```

## Notes

- CSV parsing handles quoted fields and commas within quotes
- Index-based mapping assumes consistent row ordering
- Manager names are normalized to uppercase
- All imports validate against canonical manager list
- Current season (2025/26) is automatically excluded
