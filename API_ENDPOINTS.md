# FPL Draft API Endpoints - Verified Structure

## Base URL
```
https://draft.premierleague.com/api
```

## Core Endpoints Required for FFA Cup

### 1. Bootstrap Static Data
**Endpoint:** `GET /bootstrap-static`

**Purpose:** Get all players, teams, game settings, and scoring rules

**Example Response Structure:**
```json
{
  "events": [
    {
      "id": 1,
      "name": "Gameweek 1",
      "deadline_time": "2024-08-16T17:30:00Z",
      "finished": true,
      "data_checked": true,
      "highest_score": 112,
      "is_current": false,
      "is_next": false
    }
  ],
  "phases": [
    {
      "id": 1,
      "name": "Overall",
      "start_event": 1,
      "stop_event": 38
    }
  ],
  "teams": [
    {
      "id": 1,
      "name": "Arsenal",
      "short_name": "ARS",
      "code": 3
    }
  ],
  "elements": [
    {
      "id": 1,
      "web_name": "Ramsdale",
      "team": 1,
      "element_type": 1,
      "status": "a",
      "now_cost": 50,
      "total_points": 45,
      "points_per_game": "3.2",
      "draft_rank": 150
    }
  ],
  "element_types": [
    {
      "id": 1,
      "singular_name": "Goalkeeper",
      "singular_name_short": "GKP",
      "squad_select": 2,
      "squad_min_play": 1,
      "squad_max_play": 1
    }
  ]
}
```

### 2. League Details
**Endpoint:** `GET /league/{league_id}/details`

**Purpose:** Get league information, all entries (teams), and standings

**Example Response Structure:**
```json
{
  "league": {
    "id": 12345,
    "name": "FFA Cup League",
    "created": "2024-08-01T12:00:00Z",
    "closed": false,
    "scoring": "c",
    "ko_rounds": 0,
    "make_code_public": false,
    "rank": null,
    "size": 10,
    "league_type": "x",
    "start_event": 29,
    "transactions": "yes"
  },
  "league_entries": [
    {
      "id": 1,
      "entry_id": 234567,
      "entry_name": "The Invincibles",
      "player_first_name": "John",
      "player_last_name": "Smith",
      "short_name": "JOH",
      "waiver_pick": 5,
      "joined_time": "2024-08-01T12:30:00Z",
      "total": 1234
    }
  ],
  "standings": [
    {
      "id": 1,
      "event_total": 65,
      "player_name": "John Smith",
      "rank": 1,
      "last_rank": 2,
      "rank_sort": 1,
      "total": 1234,
      "entry": 234567,
      "entry_name": "The Invincibles"
    }
  ],
  "matches": []
}
```

### 3. Entry Details
**Endpoint:** `GET /entry/{entry_id}/public`

**Purpose:** Get specific manager's team information

**Example Response Structure:**
```json
{
  "entry": {
    "id": 234567,
    "player_first_name": "John",
    "player_last_name": "Smith",
    "entry_name": "The Invincibles",
    "short_name": "JOH",
    "started_event": 29,
    "years_active": 1
  }
}
```

### 4. Entry Squad
**Endpoint:** `GET /entry/{entry_id}/event/{event_id}`

**Purpose:** Get squad lineup for a specific gameweek (includes captain selection if available)

**Example Response Structure:**
```json
{
  "picks": [
    {
      "element": 123,
      "position": 1,
      "is_captain": false,
      "is_vice_captain": false,
      "multiplier": 1
    },
    {
      "element": 456,
      "position": 2,
      "is_captain": true,
      "is_vice_captain": false,
      "multiplier": 2
    },
    {
      "element": 789,
      "position": 12,
      "is_captain": false,
      "is_vice_captain": false,
      "multiplier": 1
    }
  ],
  "subs": []
}
```

### 5. Live Gameweek Data
**Endpoint:** `GET /event/{event_id}/live`

**Purpose:** Get live scoring data for all players in a specific gameweek

**Example Response Structure:**
```json
{
  "elements": [
    {
      "id": 123,
      "stats": {
        "minutes": 90,
        "goals_scored": 1,
        "assists": 0,
        "clean_sheets": 0,
        "goals_conceded": 2,
        "own_goals": 0,
        "penalties_saved": 0,
        "penalties_missed": 0,
        "yellow_cards": 0,
        "red_cards": 0,
        "saves": 0,
        "bonus": 2,
        "bps": 35,
        "influence": "45.2",
        "creativity": "12.3",
        "threat": "56.0",
        "ict_index": "11.4",
        "total_points": 7,
        "in_dreamteam": false
      },
      "explain": [
        {
          "fixture": 123,
          "stats": [
            {
              "identifier": "minutes",
              "points": 2,
              "value": 90
            },
            {
              "identifier": "goals_scored",
              "points": 4,
              "value": 1
            },
            {
              "identifier": "bonus",
              "points": 2,
              "value": 2
            }
          ]
        }
      ]
    }
  ]
}
```

### 6. Gameweek Fixtures
**Endpoint:** `GET /fixtures?event={event_id}`

**Purpose:** Get all fixtures for a specific gameweek

**Example Response Structure:**
```json
[
  {
    "id": 123,
    "event": 29,
    "started": true,
    "finished": true,
    "kickoff_time": "2024-08-16T14:00:00Z",
    "team_h": 1,
    "team_a": 2,
    "team_h_score": 2,
    "team_a_score": 1,
    "stats": []
  }
]
```

### 7. Entry History (Overall Performance)
**Endpoint:** `GET /entry/{entry_id}/history`

**Purpose:** Get manager's gameweek-by-gameweek performance history

**Example Response Structure:**
```json
{
  "history": [
    {
      "event": 29,
      "points": 65,
      "total_points": 65,
      "rank": 3,
      "rank_sort": 3,
      "event_transfers": 0,
      "event_transfers_cost": 0,
      "points_on_bench": 8
    },
    {
      "event": 30,
      "points": 72,
      "total_points": 137,
      "rank": 2,
      "rank_sort": 2,
      "event_transfers": 1,
      "event_transfers_cost": 0,
      "points_on_bench": 12
    }
  ]
}
```

## API Limitations & Considerations

### Rate Limiting
- FPL API has no official rate limit documentation
- Recommended: max 1 request per second
- Implement exponential backoff for 429 responses

### Data Availability
- Live data updates approximately every 2-3 minutes during matches
- `data_checked: true` indicates finalized gameweek data
- Captain selections may not be available via API (see note below)

### Critical Gap: Captain Selection Storage
**IMPORTANT:** The FPL Draft API does NOT provide a write endpoint for captain selections. While we can read captain data from `/entry/{entry_id}/event/{event_id}`, the official FPL website handles captain selection through their authenticated interface.

**Implication for FFA Cup:**
We must store captain/vice-captain selections in our own database and validate them against the live roster from the API. This is tournament-specific metadata and acceptable per requirements.

## Endpoint-to-Feature Mapping

| Feature | Primary Endpoint | Secondary Endpoints |
|---------|-----------------|---------------------|
| User Authentication | `/entry/{entry_id}/public` | `/league/{league_id}/details` |
| Roster Validation | `/entry/{entry_id}/event/{event_id}` | `/bootstrap-static` |
| Live Scoring | `/event/{event_id}/live` | `/entry/{entry_id}/history` |
| Captain Selection UI | `/entry/{entry_id}/event/{event_id}` | `/bootstrap-static` (for player names) |
| Group Stage Standings | `/league/{league_id}/details` | `/entry/{entry_id}/history` |
| Knockout Matchups | `/entry/{entry_id}/history` | `/event/{event_id}/live` |
| Statistics Dashboard | `/entry/{entry_id}/history` | `/bootstrap-static`, `/event/{event_id}/live` |
| Tournament Scheduling | `/bootstrap-static` (events array) | - |

## Polling Strategy

### Real-time Updates During Live Gameweeks
1. **Bootstrap data:** Cache and refresh every 24 hours
2. **Live scoring:** Poll every 90 seconds during active gameweek
3. **Squad/lineup data:** Poll when captain selection is needed
4. **League standings:** Poll every 5 minutes during active gameweek

### Off-peak (No active matches)
1. Reduce polling to every 5-10 minutes
2. Use `data_checked` flag to detect finalized gameweek data
