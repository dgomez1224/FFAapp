# FFA Cup Data Models & Schema Design

## Database Schema (Tournament Metadata Only)

### tournaments
Stores tournament configuration and settings.

```typescript
interface Tournament {
  id: string;                    // UUID
  name: string;                  // "FFA Cup 2025"
  league_id: number;             // FPL Draft League ID
  season: string;                // "2024/25"
  start_gameweek: number;        // Calculated: 38 - (4 + knockout_gws) + 1
  end_gameweek: number;          // Always 38
  group_stage_gameweeks: number; // Always 4
  knockout_gameweeks: number;    // 2 × ⌈log₂(0.8 × N)⌉
  teams_advance_pct: number;     // 0.8 (80%)
  status: 'setup' | 'group_stage' | 'knockout' | 'completed';
  current_gameweek: number;      // Current GW of tournament
  created_at: timestamp;
  updated_at: timestamp;
}
```

**Example:**
- 10 teams → start_gw = 38 - (4 + 6) + 1 = GW 29
- 20 teams → start_gw = 38 - (4 + 8) + 1 = GW 27

### teams
Maps FPL Draft entries to tournament participants.

```typescript
interface Team {
  id: string;                    // UUID
  tournament_id: string;         // FK to tournaments
  entry_id: number;              // FPL Draft Entry ID
  entry_name: string;            // Cached from API
  manager_name: string;          // Cached from API
  manager_short_name: string;    // Cached from API
  seed: number | null;           // Group stage final ranking (1-N)
  group_stage_points: number;    // Sum of points GW 29-32 (example)
  group_stage_captain_points: number; // Tie-breaker
  eliminated_at: string | null;  // Knockout round eliminated ('R16', 'QF', 'SF', 'F')
  created_at: timestamp;
}
```

### gameweek_scores
Stores calculated scores per team per gameweek (derived from API data).

```typescript
interface GameweekScore {
  id: string;                    // UUID
  team_id: string;               // FK to teams
  tournament_id: string;         // FK to tournaments
  gameweek: number;              // 1-38
  total_points: number;          // Including captain multiplier
  captain_points: number;        // Points contributed by captain (after 2x)
  bench_points: number;          // Points from bench players
  captain_element_id: number | null;    // Player ID of captain
  vice_captain_element_id: number | null; // Player ID of vice captain
  raw_data: jsonb;               // Full API response for audit
  calculated_at: timestamp;
  created_at: timestamp;
}
```

### captain_selections
Stores user's captain choices for each gameweek.

```typescript
interface CaptainSelection {
  id: string;                    // UUID
  team_id: string;               // FK to teams
  gameweek: number;              // 1-38
  captain_element_id: number;    // Player ID from FPL API
  vice_captain_element_id: number; // Player ID from FPL API
  validated_at: timestamp | null; // When roster validation passed
  locked: boolean;               // True after gameweek deadline
  created_at: timestamp;
  updated_at: timestamp;
  
  // Unique constraint: (team_id, gameweek)
}
```

### matchups
Stores knockout round pairings and results.

```typescript
interface Matchup {
  id: string;                    // UUID
  tournament_id: string;         // FK to tournaments
  round: string;                 // 'R16', 'QF', 'SF', 'F'
  matchup_number: number;        // 1-8 for R16, 1-4 for QF, etc.
  team_1_id: string;             // FK to teams (higher seed)
  team_2_id: string;             // FK to teams (lower seed)
  leg_1_gameweek: number;        // First leg GW
  leg_2_gameweek: number;        // Second leg GW
  team_1_leg_1_points: number | null;
  team_1_leg_2_points: number | null;
  team_2_leg_1_points: number | null;
  team_2_leg_2_points: number | null;
  winner_id: string | null;      // FK to teams
  tie_breaker_applied: string | null; // 'highest_gw' | 'captain_sum' | null
  status: 'pending' | 'leg_1_complete' | 'complete';
  created_at: timestamp;
}
```

### admin_logs
Audit trail for manual corrections.

```typescript
interface AdminLog {
  id: string;                    // UUID
  tournament_id: string;         // FK to tournaments
  admin_identifier: string;      // Admin's entry ID or username
  action: string;                // 'manual_score_correction', 'bracket_adjustment'
  entity_type: string;           // 'gameweek_score', 'matchup', 'captain_selection'
  entity_id: string;             // ID of affected record
  old_value: jsonb;              // Previous state
  new_value: jsonb;              // New state
  reason: string;                // Explanation
  created_at: timestamp;
}
```

## Derived Data Models (Runtime, from API)

### PlayerData
Derived from `/bootstrap-static` endpoint.

```typescript
interface PlayerData {
  id: number;                    // element.id from API
  web_name: string;              // Display name
  team: number;                  // PL team ID
  element_type: number;          // Position (1=GKP, 2=DEF, 3=MID, 4=FWD)
  status: string;                // 'a' = available, 'i' = injured, etc.
  total_points: number;          // Season total
}
```

### SquadPick
Derived from `/entry/{entry_id}/event/{event_id}`.

```typescript
interface SquadPick {
  element: number;               // Player ID
  position: number;              // 1-15 (1-11 starters, 12-15 bench)
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;            // 2 for captain, 1 otherwise
}
```

### LivePlayerStats
Derived from `/event/{event_id}/live`.

```typescript
interface LivePlayerStats {
  id: number;                    // Player ID
  total_points: number;          // Points this gameweek
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
  };
}
```

## Tournament Logic Data Structures

### GroupStageStanding
Calculated view combining teams and gameweek_scores.

```typescript
interface GroupStageStanding {
  team_id: string;
  entry_name: string;
  manager_name: string;
  total_points: number;          // Sum of gameweeks 29-32
  captain_points_sum: number;    // Tie-breaker
  rank: number;                  // 1-N based on points (then captain_points)
  advancing: boolean;            // true if rank <= ceil(0.8 * N)
}
```

### KnockoutBracket
Tree structure for knockout rounds.

```typescript
interface KnockoutBracket {
  round: string;
  matchups: Array<{
    matchup_id: string;
    team_1: {
      id: string;
      name: string;
      seed: number;
      leg_1_points: number;
      leg_2_points: number;
      aggregate: number;
    };
    team_2: {
      id: string;
      name: string;
      seed: number;
      leg_1_points: number;
      leg_2_points: number;
      aggregate: number;
    };
    winner_id: string | null;
    status: string;
  }>;
}
```

## Calculation Logic Map

### Captain Point Calculation
```
For each gameweek for each team:
1. Fetch captain selection from captain_selections table
2. If no selection exists:
   a. Check previous gameweek captain_selection
   b. If found, use previous captain
   c. If not found, captain_points = 0, no doubling
3. Fetch live player stats from API
4. Apply multiplier:
   - Captain gets 2× their points
   - All other players get 1× their points
5. Sum all points (starters + bench) with multipliers applied
6. Store in gameweek_scores
```

### Group Stage Final Ranking
```
For each team:
1. Sum total_points across gameweeks [start_gw, start_gw+3]
2. Sum captain_points across same gameweeks
3. Sort by:
   - Primary: total_points DESC
   - Tie-breaker: captain_points DESC
4. Assign seed 1-N
5. Mark advancing if seed <= ceil(0.8 * N)
```

### Knockout Pairing
```
Teams advancing = teams where advancing = true
Sort by seed ASC
Pair as:
  Match 1: Seed 1 vs Seed N
  Match 2: Seed 2 vs Seed N-1
  ...
  Match M: Seed M vs Seed (N-M+1)
```

### Knockout Winner Determination
```
For each matchup after leg 2 complete:
1. Calculate aggregate: team_1_total = leg1 + leg2
2. Calculate aggregate: team_2_total = leg1 + leg2
3. If team_1_total > team_2_total: winner = team_1
4. If team_2_total > team_1_total: winner = team_2
5. If tied:
   a. Compare max(leg1, leg2) for each team
   b. If still tied, sum captain_points across both legs
   c. Team with higher value wins
```

## Data Validation Rules

### Captain Selection Validation
```
When user selects captain:
1. Fetch current squad from API: /entry/{entry_id}/event/{gameweek}
2. Extract all element IDs from picks array
3. Verify captain_element_id exists in picks
4. Verify vice_captain_element_id exists in picks
5. Verify captain ≠ vice_captain
6. If all valid: save to captain_selections, set validated_at
7. If invalid: return error with available player list
```

### Tournament Consistency Checks
```
Before each calculation run:
1. Verify all teams have entry_id that resolves via API
2. Verify current_gameweek is within [start_gw, end_gw]
3. Verify all matchups reference valid team_ids
4. Verify no duplicate captain selections per (team, gameweek)
```

## Indexes for Performance

```sql
-- Fast lookups by tournament
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_gameweek_scores_team ON gameweek_scores(team_id, gameweek);
CREATE INDEX idx_captain_selections_team_gw ON captain_selections(team_id, gameweek);
CREATE INDEX idx_matchups_tournament_round ON matchups(tournament_id, round);

-- Fast aggregations
CREATE INDEX idx_gameweek_scores_tournament_gw ON gameweek_scores(tournament_id, gameweek);
```

## Cache Strategy

### Redis/In-Memory Cache
```
Key Pattern: ffa:bootstrap:static
TTL: 24 hours
Purpose: Player data, teams, gameweek info

Key Pattern: ffa:live:{gameweek}
TTL: 90 seconds
Purpose: Live player stats during active gameweek

Key Pattern: ffa:entry:{entry_id}:squad:{gameweek}
TTL: 1 hour
Purpose: Squad composition for roster validation
```
