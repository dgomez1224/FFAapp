# DraftFPL Live-Style Implementation

## Overview

This document describes the implementation of DraftFPL Live-style client-side behavior for the FFA Cup Web Application. The feature enables real-time H2H matchup tracking with live point updates, polling every 60 seconds.

## Architecture

### Client-Side Components

1. **`useEntryId` Hook** (`src/lib/useEntryId.ts`)
   - Manages entry ID from URL query params or localStorage
   - URL is source of truth; localStorage is convenience only
   - Validates entry ID is a positive integer
   - Updates URL via pushState when entry ID changes

2. **Scoring Logic** (`src/lib/scoring.ts`)
   - Pure functions for computing player points
   - `computePlayerPoints()` - Base point calculation
   - `applyCaptaincy()` - Applies captain multiplier
   - `applyAutoSubs()` - Handles automatic substitutions
   - `applyBonus()` - Applies bonus points (respects 60-minute rule)
   - `computeSquadPoints()` - Total squad calculation

3. **LiveMatchups Component** (`src/components/LiveMatchups.tsx`)
   - Displays live H2H matchups with real-time updates
   - Polls every 60 seconds for live data
   - Recomputes scores client-side using scoring functions
   - Uses AbortController for cleanup
   - Avoids interval drift with setTimeout loop

4. **Set Entry Page** (`src/pages/SetEntry.tsx`)
   - Allows users to set their entry ID
   - Validates input (positive integer)
   - Updates URL and localStorage

### Backend Endpoints (Edge Functions)

All endpoints are in `supabase/functions/server/index.ts`:

1. **`GET /api/context?entryId=XXXX`**
   - Returns entry ID, current gameweek, league metadata
   - Includes bootstrap version for cache invalidation
   - Cache: ~5 minutes

2. **`GET /api/live?event=NN`**
   - Returns live player stats and fixture statuses
   - Fetches from FPL API `/event/{event}/live/`
   - Cache: Stale-while-revalidate, client polls every 60s

3. **`GET /api/entry/:entryId/picks?event=NN`**
   - Returns squad/picks for a specific entry and gameweek
   - Includes captain/vice-captain selections
   - Cache: Longer once deadline passes

4. **`GET /api/h2h?entryId=XXXX&event=NN`**
   - Returns H2H fixtures for the manager's league
   - Includes picks for both managers in each matchup
   - Pairs entries by rank (simplified pairing logic)

## Data Flow

1. User sets entry ID via `/set-entry` page or URL param
2. `LiveMatchups` component:
   - Fetches context once (current gameweek, leagues)
   - Fetches H2H matchups once (opponents, picks)
   - Starts 60s polling loop:
     - Fetches live data (`/api/live`)
     - Recomputes scores using client-side functions
     - Updates UI with new totals

## Scoring Rules

### Default Rules
```typescript
{
  applyAutosubs: true,
  applyBonus: true,
  bonusReliableAt60: true,  // Bonus only reliable after 60' or at FT
  captainMultiplier: 2,     // Standard FPL captain multiplier
}
```

### Autosubs Logic
- If starting player has 0 minutes, substitute with first bench player that has >0 minutes
- Must respect formation constraints (GK, DEF, MID, FWD min/max)
- Bench order matters (position 12 is first sub)

### Bonus Points
- Only applied after 60 minutes of play (if `bonusReliableAt60` is true)
- Or when fixture is finished (final bonus)
- Before 60', bonus points are excluded from calculations

### Captaincy
- Captain points are multiplied by `captainMultiplier` (default: 2)
- Vice-captain has no multiplier (only used if captain doesn't play)

## Type Definitions

All API response types are defined in `src/lib/types/api.ts`:
- `ContextResponse`
- `LiveDataResponse`
- `EntryPicksResponse`
- `H2HResponse`

## Usage

### Setting Entry ID

1. Navigate to `/set-entry`
2. Enter your FPL entry ID (e.g., `164475`)
3. Click "Save"
4. Entry ID is stored in URL and localStorage

### Viewing Live Matchups

1. Navigate to `/home` or any page with `<LiveMatchups />`
2. Component automatically:
   - Reads entry ID from URL or localStorage
   - Fetches context and matchups
   - Starts polling for live updates
3. Matchups display with:
   - Manager names
   - Live point totals
   - Last update timestamp
   - Polling status indicator

### URL Parameters

- `?entryId=XXXX` - Sets entry ID in URL (source of truth)

## Limitations & Future Improvements

1. **Element Type Mapping**: Currently uses simplified defaults. Full implementation would require bootstrap data to map elements to positions (GK/DEF/MID/FWD).

2. **Fixture-to-Player Mapping**: Currently uses overall fixture status for all players. Full implementation would map each player to their specific fixture.

3. **H2H Pairing**: Currently pairs entries by rank (1v2, 3v4, etc.). Full implementation would use actual H2H fixture data from FPL API.

4. **Formation Validation**: Autosubs currently always allow substitutions. Full implementation would validate GK/DEF/MID/FWD constraints.

5. **Bootstrap Data**: Would benefit from caching bootstrap static data for element type lookups.

## Testing

### Manual Testing
1. Set entry ID via `/set-entry`
2. Navigate to `/home` and verify `LiveMatchups` component loads
3. Check browser console for polling logs
4. Verify scores update every 60 seconds

### Unit Tests (Future)
- `computePlayerPoints()` - Test point calculations
- `applyAutoSubs()` - Test substitution logic
- `applyBonus()` - Test 60-minute rule
- `applyCaptaincy()` - Test multiplier

## Security Notes

- Entry ID is **NOT** used for authentication
- It's purely a UX convenience for selecting which team to view
- No sensitive data is stored or transmitted
- All endpoints are public and read-only
