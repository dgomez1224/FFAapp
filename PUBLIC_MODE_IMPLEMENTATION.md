# Public Read-Only Mode Implementation

## Overview

This document describes the complete rewrite of the FFA Cup Web Application to support public, read-only access without authentication. All league data is derived from a static FPL entry ID (164475), and all 10 league members are automatically registered in cup competitions.

## Key Changes

### 1. Static Entry ID

**File:** `src/lib/constants.ts`

- Introduced `STATIC_ENTRY_ID = "164475"` as the single source of truth
- This value is never user-provided, never stored in localStorage, and never derived from auth/session state
- All backend endpoints and frontend components use this constant

### 2. Authentication Removal

**Removed Files:**
- `src/pages/Login.tsx` (no longer needed)
- `src/pages/Signup.tsx` (no longer needed)
- `src/pages/AuthCallback.tsx` (no longer needed)

**Updated Files:**
- `src/pages/router.tsx` - Removed all auth routes and guards
- `src/lib/tournamentContext.ts` - Removed localStorage dependencies, uses static entry ID only

### 3. Backend Edge Functions

**File:** `supabase/functions/server/index.ts`

Completely rewritten to support public read-only mode with new endpoints:

#### Public Endpoints:

1. **`GET /league-standings`**
   - Returns main FPL league standings
   - Resolves league from static entry ID
   - Shows all managers, teams, and points

2. **`GET /cup-group-stage`**
   - Returns cup group stage standings
   - All 10 league members are automatically registered
   - No registration step required

3. **`GET /goblet-standings`**
   - Returns Goblet competition standings
   - Round-based scoring with aggregate leaderboard

4. **`GET /manager-insights`**
   - Returns insights for all managers
   - Includes: avg points/GW, captain efficiency, consistency metrics
   - `GET /manager-insights/:teamId` for individual manager details

5. **`GET /player-insights`**
   - Returns league-wide player analytics
   - Most selected players, captain frequency, point contributions

6. **`GET /h2h-standings`**
   - Returns Head-to-Head season standings
   - Wins, losses, draws, points for/against

7. **`GET /league-history`**
   - Returns historical league data from CSV imports
   - `GET /league-history/:season` for specific season

8. **`GET /live-scores/:gameweek`**
   - Returns live gameweek scores for all teams
   - Updated to work with static entry ID

9. **`GET /current-gameweek`**
   - Returns current FPL gameweek number

#### Key Backend Changes:

- All endpoints use `resolveLeagueContext()` to get league data from static entry ID
- No authentication checks - all endpoints are public
- CORS enabled for all origins
- Graceful fallbacks when database tables don't exist yet

### 4. Frontend Components

#### Updated Components:

1. **`src/components/LiveDashboard.tsx`**
   - Removed auth dependencies
   - Uses `useTournamentContext()` hook
   - Polls for updates instead of realtime (public mode)

2. **`src/components/BracketView.tsx`**
   - Updated to work without tournament ID from localStorage
   - Uses tournament context from static entry ID

3. **`src/components/GroupStageTable.tsx`**
   - Now used by `CupGroupStage` component
   - Auto-registers all league members

#### New Components:

1. **`src/components/LeagueStandings.tsx`**
   - Displays main FPL league standings
   - Public read-only table

2. **`src/components/CupGroupStage.tsx`**
   - Displays cup group stage with auto-registered teams
   - Shows advancing status (top 80%)

3. **`src/components/GobletStandings.tsx`**
   - Displays Goblet competition standings
   - Round-based aggregate leaderboard

4. **`src/components/H2HStandings.tsx`**
   - Displays Head-to-Head season standings
   - Full H2H table with wins/losses/draws

5. **`src/components/ManagerInsights.tsx`**
   - Detailed manager analytics
   - Consistency metrics, captain efficiency, performance trends

6. **`src/components/PlayerInsights.tsx`**
   - League-wide player analytics
   - Most selected, captain frequency, point contributions

7. **`src/components/LeagueHistory.tsx`**
   - Historical league data viewer
   - Season selector and standings display
   - Data loaded from CSV imports

### 5. Router Updates

**File:** `src/pages/router.tsx`

- Removed all auth routes (Login, Signup, AuthCallback)
- Added new public routes:
  - `/league-standings`
  - `/cup-group-stage`
  - `/goblet`
  - `/h2h`
  - `/managers`
  - `/players`
  - `/history`
- All routes are public - no auth guards

### 6. Tournament Context

**File:** `src/lib/tournamentContext.ts`

- Completely rewritten to use static entry ID only
- Removed all localStorage dependencies:
  - No `ffa_entry_id`
  - No `ffa_team_id`
  - No `ffa_tournament_id`
  - No `ffa_current_gw`
- Automatically resolves league context on mount
- Provides: `entryId`, `leagueId`, `leagueName`, `currentGameweek`, `loading`, `error`

### 7. Dashboard

**File:** `src/pages/Dashboard.tsx`

- Updated to show overview with tabs
- Includes: Live Scores, League, Cup, Overview
- All views are public and read-only

## Database Schema

See `DATABASE_SCHEMA.md` for complete schema documentation.

### Key Tables:

- `teams` - Team/manager information
- `tournaments` - Tournament metadata
- `gameweek_scores` - Gameweek scores
- `matchups` - Knockout bracket matchups
- `league_history` - Historical data (CSV-backed)
- `goblet_standings` - Goblet competition data
- `h2h_matchups` - H2H matchup results
- `player_selections` - Player selection tracking

### CSV Import for League History:

1. Prepare CSV with columns: `season`, `entry_id`, `entry_name`, `manager_name`, `final_rank`, `total_points`, `awards`, `records`
2. Import via Supabase Dashboard or SQL `COPY` command
3. Data is queryable via `/league-history` endpoint

## Verification Checklist

### Public Access
- ✅ App loads standings without login
- ✅ No auth middleware blocks public routes
- ✅ Supabase anon key is sufficient for all requests

### Static Context Enforcement
- ✅ `STATIC_ENTRY_ID` is the sole league identifier
- ✅ No league/team context pulled from user state
- ✅ No localStorage dependency remains

### Data Integrity
- ✅ League standings match FPL source
- ✅ All 10 managers appear in cup group tables
- ✅ Goblet standings are internally consistent
- ✅ H2H tables balance wins/losses correctly

### CSV & History
- ✅ CSV schemas are documented
- ✅ Imported data is queryable
- ✅ League history renders without runtime transforms

### Type Safety
- ✅ No unresolved TypeScript errors
- ✅ All API responses are typed
- ✅ Realtime or fetch payloads are safely cast

### Performance & Stability
- ✅ No N+1 queries (server-side aggregation)
- ✅ No client-side joins for core tables
- ✅ Pages render predictably on refresh

## Running the Application

1. **Set Environment Variables:**
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```

3. **Access Application:**
   - Open `http://localhost:5173` (or your Vite port)
   - No login required - all data is public

## Deployment

1. **Build for Production:**
   ```bash
   npm run build
   ```

2. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy make-server-78aa35ba
   ```

3. **Set Environment Variables in Supabase:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Future Enhancements

While the current implementation is read-only, the architecture supports future authenticated features:

- Admin endpoints for data updates
- User-specific views (when authenticated)
- Write operations behind authentication
- Real-time subscriptions for authenticated users

The codebase clearly separates:
- Public read-only paths (current implementation)
- Future authenticated paths (can be added without breaking public mode)

## Notes

- All endpoints are safe for public access (read-only, no secrets exposed)
- Static entry ID (164475) is hardcoded - change in `src/lib/constants.ts` if needed
- Database tables may not exist initially - Edge Functions handle missing tables gracefully
- CSV imports for league history are optional but recommended for historical data
- Goblet and H2H standings can be derived from matchups if dedicated tables don't exist
