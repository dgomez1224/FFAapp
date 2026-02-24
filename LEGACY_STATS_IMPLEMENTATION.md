# Legacy Statistics Implementation Summary

## Overview

This document summarizes the implementation of legacy league statistics, manager profile pages, and additional standings views for the FFA Cup Web Application.

## Key Features Implemented

### 1. Canonical Managers System

**File:** `src/lib/canonicalManagers.ts`

- Fixed list of exactly 10 managers (PATRICK, MATT, MARCO, LENNART, CHRIS, IAN, HENRI, DAVID, MAX, BENJI)
- Validation functions to ensure only canonical managers are used
- Index-based mapping utilities for CSV imports
- Manager name normalization

### 2. Database Schema

**File:** `DATABASE_SCHEMA_LEGACY_STATS.md`

**New Tables:**
- `all_time_manager_stats` - Aggregated all-time statistics
- `legacy_season_standings` - Season-by-season league/goblet standings
- `legacy_h2h_stats` - Head-to-head records (all-time and per-season)
- `legacy_h2h_gameweek_results` - Individual H2H gameweek results
- `legacy_gameweek_standings` - Gameweek standings for legacy seasons
- `legacy_season_trophies` - Trophy winners per season
- `legacy_manager_season_stats` - Per-season manager statistics

**Key Features:**
- All tables use `manager_name` as primary identifier
- CHECK constraints enforce canonical manager list
- Season cutoff enforced (all data < 2025/26)
- RLS policies for public read access

### 3. CSV Ingestion Utilities

**File:** `src/lib/csvIngestion.ts`

**Functions:**
- `parseCSV()` - Parses CSV with quoted field support
- `mapRowsToManagers()` - Maps index-based rows to canonical managers
- `filterCurrentSeason()` - Filters out 2025/26 season
- `parseAllTimeStats()` - Parses ALL TIME LEADERS.csv
- `parseSeasonStandings()` - Parses Home.csv season standings
- `validateCanonicalManagers()` - Validates manager names

**Key Rules:**
- Only ALL TIME LEADERS.csv has `manager_name` column
- All other CSVs use index-based alignment
- Manager order matches canonical list exactly
- Current season automatically excluded

### 4. Backend Endpoints

**File:** `supabase/functions/server/index.ts`

**New Endpoints:**
- `GET /legacy-stats/all-time` - All-time manager statistics
- `GET /legacy-stats/season-standings/:season` - Season standings (league/goblet)
- `GET /legacy-stats/manager/:managerName` - Complete manager profile
- `GET /legacy-stats/h2h/:managerName` - H2H records
- `GET /legacy-stats/gameweek-standings/:season/:gameweek` - Gameweek standings
- `GET /legacy-stats/seasons` - List of available seasons

**Features:**
- All endpoints validate canonical managers
- Season cutoff enforced
- Public read-only access
- TypeScript strict mode

### 5. UI Components

#### LegacyStandingsTable
**File:** `src/components/LegacyStandingsTable.tsx`

- FPL-style table formatting
- Champion highlighting
- Consistent column structure
- Reusable across all views

#### Home Page
**File:** `src/pages/Home.tsx`

- All-time standings table
- Season-by-season standings
- League and Goblet tables
- Manager profile links
- FPL-style layout

#### Manager Profile Pages
**File:** `src/pages/ManagerProfile.tsx`

- Standardized layout for all 10 managers
- All-time statistics summary
- Season-by-season standings
- H2H records table
- Trophy history
- Navigation to other managers
- Route: `/manager/:managerName`

#### Legacy Gameweek Standings
**File:** `src/pages/LegacyGameweekStandings.tsx`

- Gameweek standings for legacy seasons
- Season and gameweek selectors
- Supports Flourish embeds or API data
- Filters out current season

### 6. FPL-Style Styling

**File:** `src/styles/fpl-tables.css`

- Table-heavy layout
- Minimalist design
- Data-first approach
- Familiar spacing and typography
- Champion row highlighting
- Responsive table wrapper

## Data Flow

### CSV Import Flow
```
CSV Files → Parse → Index-based Mapping → Validate Managers → 
Filter Season → Insert into Database
```

### Data Display Flow
```
Database → Edge Function → Frontend Component → FPL-Style Table
```

## CSV File Handling

### Files Processed:
1. **ALL TIME LEADERS.csv** - Has `manager_name` column
2. **Home.csv** - Index-based mapping (ordered by rank)
3. **MANAGER PROFILE_ [NAME].csv** - Individual manager data

### Import Rules:
- Manager names normalized to uppercase
- Index-based mapping for CSVs without manager_name
- Current season (2025/26) automatically excluded
- All managers validated against canonical list

## Routing

**New Routes:**
- `/home` - Home page with standings tables
- `/manager/:managerName` - Individual manager profile (10 routes)
- `/legacy-gameweek-standings` - Legacy gameweek standings

**Updated Routes:**
- `/` - Redirects to `/home`

## Manager Profile Pages

Each of the 10 canonical managers has a dedicated profile page:
- `/manager/patrick`
- `/manager/matt`
- `/manager/marco`
- `/manager/lennart`
- `/manager/chris`
- `/manager/ian`
- `/manager/henri`
- `/manager/david`
- `/manager/max`
- `/manager/benji`

All pages use the same standardized layout and component structure.

## Table Formatting

All tables follow FPL-style conventions:
- Rank column (C for champion, numbers for others)
- Manager name column
- W/D/L columns
- Points for column (optional)
- Points column (emphasized)
- Champion row highlighted
- Consistent spacing and typography

## Validation & Safety

1. **Canonical Managers:** All manager names validated against fixed list
2. **Season Cutoff:** 2025/26 automatically excluded from imports
3. **Database Constraints:** CHECK constraints enforce canonical managers
4. **Type Safety:** Full TypeScript strict mode compliance
5. **Error Handling:** Graceful fallbacks for missing data

## Next Steps

1. **Import CSV Data:**
   - Run import scripts from `CSV_IMPORT_UTILITIES.md`
   - Verify all 10 managers have data
   - Check season cutoff enforcement

2. **Test UI:**
   - Verify all manager profile pages load
   - Test season selector functionality
   - Verify table formatting matches FPL style

3. **Deploy:**
   - Deploy database schema
   - Deploy Edge Functions
   - Import legacy data
   - Test all routes

## Files Created

### Core Logic
- `src/lib/canonicalManagers.ts` - Canonical managers system
- `src/lib/csvIngestion.ts` - CSV parsing and ingestion utilities

### Database
- `DATABASE_SCHEMA_LEGACY_STATS.md` - Legacy statistics schema

### Backend
- Updated `supabase/functions/server/index.ts` - Legacy stats endpoints

### Frontend Components
- `src/components/LegacyStandingsTable.tsx` - Shared standings table
- `src/pages/Home.tsx` - Home page with standings
- `src/pages/ManagerProfile.tsx` - Manager profile page
- `src/pages/LegacyGameweekStandings.tsx` - Legacy gameweek standings

### Styling
- `src/styles/fpl-tables.css` - FPL-style table CSS

### Documentation
- `CSV_IMPORT_UTILITIES.md` - CSV import guide
- `LEGACY_STATS_IMPLEMENTATION.md` - This file

## Important Notes

- **Canonical Managers:** The 10 managers are fixed and permanent
- **Index-Based Mapping:** CSVs without manager_name use row index
- **Season Cutoff:** 2025/26 is excluded from all legacy imports
- **Public Read-Only:** All endpoints maintain public read-only architecture
- **FPL-Style UI:** Tables match FPL website structure and formatting
- **Type Safety:** All code passes TypeScript strict mode

---

**Status:** ✅ Complete - All requirements implemented
