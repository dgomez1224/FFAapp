# Status checks – Latest Updates, Player Insights, Goblet, rankings, player images

---

## 1. Latest Updates – what it fetches (JSON) and how sorting works

### What it fetches (in order)

**1) `GET .../h2h-matchups`**

```json
{
  "gameweek": 28,
  "matchups": [
    { "team_1_id": "...", "team_2_id": "...", "gameweek": 28 }
  ]
}
```

**2) `GET .../api/live?event=28`**

```json
{
  "event": 28,
  "timestamp": "2025-02-27T...",
  "elements": [
    {
      "element": 123,
      "stats": {
        "minutes": 90,
        "goals_scored": 1,
        "assists": 0,
        "starts": 1,
        "clean_sheets": 1,
        "yellow_cards": 0,
        "red_cards": 0,
        "total_points": 8,
        ...
      },
      "explain": []
    }
  ],
  "fixtures": [
    { "id": 1, "started": true, "finished": false, "elapsed": 67, "team_h": 1, "team_a": 2, "kickoff_time": "2025-02-27T15:00:00Z" }
  ]
}
```

Used to build `startsByPlayerId[element] = stats.starts` for the “Start” stat.

**3) For each matchup: `GET .../fixtures/matchup?type=league&gameweek=28&team1=...&team2=...`**

```json
{
  "type": "league",
  "gameweek": 28,
  "current_gameweek": 28,
  "matchup": {
    "live_team_1_points": 45,
    "live_team_2_points": 38,
    "is_ongoing": true,
    "has_started": true
  },
  "team_1": {
    "id": "...",
    "manager_name": "...",
    "entry_name": "...",
    "lineup": [
      {
        "player_id": 123,
        "player_name": "Player Name",
        "player_image_url": "https://...",
        "position": 2,
        "minutes": 90,
        "is_bench": false,
        "effective_points": 8,
        "goals_scored": 1,
        "assists": 0,
        "clean_sheets": 1,
        "defensive_contributions": 12,
        "fixture_kickoff_time": "2025-02-27T15:00:00Z",
        "fixture_elapsed": 90
      }
    ]
  },
  "team_2": { "lineup": [ ... ] }
}
```

From these three sources the client builds **current** snapshots (per manager+player), then **deltas** vs the previous poll to create **UpdateRow** entries.

### How sorting works now

- Each **UpdateRow** has a **`timestamp`** (number):
  - `timestamp = fixture_kickoff_time` (parsed to ms) **+** `fixture_elapsed * 60 * 1000`.
  - If there’s no valid `fixture_kickoff_time`, `timestamp = 0` (those rows sort to the bottom).

- **Sort** (after all merges, in `visibleRows`):
  - Primary: **`(b.timestamp ?? 0) - (a.timestamp ?? 0)`** → newest event time first.
  - Tie-break: **`a.id.localeCompare(b.id)`** for stable order when timestamps are equal.

- No sorting by: player id, player name, manager name, `news_added`, or array insertion order. Only `timestamp` (and then `id`).

- Rows with `timestamp === 0` appear at the bottom. Order matches real match flow (kickoff + minutes). Sorting is re-applied on every refresh over the merged `rows` array.

---

## 2. Player Insights – how it works and what it returns

### How it works

- **Endpoint:** `GET .../player-insights` with optional query params:  
  `position`, `team`, `availability`, `ownership` (e.g. `all`, `free_agent`, or manager name),  
  `min_avg_minutes`, `max_avg_minutes`, `avg_minutes_bucket`, `search`, `include_debug`.

- **Data sources:**
  1. **Bootstrap:** Draft `bootstrap-static` (preferred) and/or FPL `bootstrap-static` for the full player list and stats (points, goals, assists, minutes, defensive contributions, etc.).
  2. **Ownership:**  
     - Primary: Draft `league/{id}/element-status` (each element has an `owner` = entry_id).  
     - Mapped to manager names via `league/{id}/details` → `league_entries`.  
     - Fallback: for each league entry, `entry/{entryId}/event/{gameweek}` picks; if that fails, DB `player_selections` + `teams`.

- **Flow:**
  - Build a full player list from bootstrap (Draft preferred).
  - Resolve ownership (owned by which manager(s) or unowned).
  - Apply filters (position, team, availability, ownership, avg minutes, search).
  - Optionally enrich with FPL `element-summary/{id}` for home/away splits and games played.
  - Sort and return `insights` (+ optional `managers`, `source`, `include_debug`).

### What it returns (JSON)

```json
{
  "insights": [
    {
      "player_id": 123,
      "player_name": "Player Name",
      "image_url": "https://...",
      "position": 2,
      "team": 5,
      "team_name": "Arsenal",
      "availability": "a",
      "selected_by_percent": 12.5,
      "total_points": 120,
      "goals_scored": 2,
      "assists": 3,
      "defensive_contributions": 18,
      "defensive_contribution_returns": 1,
      "games_played": 25,
      "home_games": 12,
      "away_games": 13,
      "home_points": 65,
      "away_points": 55,
      "minutes_played": 2100,
      "points_per_game_played": 4.8,
      "minutes_per_game_played": 84,
      "points_per_90_played": 5.14,
      "average_points_home": 5.42,
      "average_points_away": 4.23,
      "owned_by": ["Manager Name"],
      "owner_team": "Manager Name",
      "ownership_status": "owned"
    }
  ],
  "managers": ["Manager A", "Manager B", ...],
  "source": "fpl_bootstrap"
}
```

`source` can be `"fpl_bootstrap"` or `"database"` depending on path. With `include_debug=1`, extra ownership/debug fields are included.

---

## 3. Goblet Standings – how it updates live

### Updating the Goblet tables

- **`syncH2hAndGobletWithLive(supabase)`** is the function that keeps both **h2h_matchups** and **goblet_standings** in sync with live points for the **current gameweek**.

- **Steps:**
  1. Resolve current event (Draft bootstrap).
  2. Get league details and matches; map draft entry IDs to DB team IDs.
  3. For **current GW only:**  
     - Fetch `event/{currentEvent}/live` → per-player points.  
     - For each entry in that GW’s matches, fetch `entry/{entryId}/event/{currentEvent}` picks and sum live points for starters (positions 1–11) → **liveEntryPoints[entryId]**.
  4. **h2h_matchups:** For each match row, set `team_1_points` / `team_2_points` from live when `gameweek === currentEvent`, else from stored match points; compute `winner_id`; upsert to `h2h_matchups`.
  5. **goblet_standings:** For each team, from match results build **pointsByTeamGw[teamId][gameweek]** (using the same live/stored points). Then for each team and each GW up to now, compute cumulative **total_points** and upsert rows into **goblet_standings** (`team_id`, `round` = GW, `points`, `total_points`, `updated_at`).

- **When it runs:**  
  - Before reading Goblet: `GET .../goblet-standings` calls `syncH2hAndGobletWithLive(supabase)` first, then reads from DB.  
  - League matchup detail for current GW also calls `syncH2hAndGobletWithLive` when `gameweek === currentGw` before building ranks.

So the “live” Goblet table update is: sync runs, then we read from **goblet_standings** (and optionally aggregate from **h2h_matchups**); for the current GW, points come from the live API and are written into those tables by the sync.

---

## 4. Rankings: /fixtures and /matchups vs This Week’s Matchups

### `/fixtures` (Fixtures hub)

- **Source:** Draft league details + matches (or DB `h2h_matchups` if Draft fails).
- **Live points for current GW:** Fetches `event/{currentGw}/live` and, for every entry in that GW’s matches, `entry/{entryId}/event/{currentGw}` picks; sums starter points → **fixturesLiveEntryPoints**.
- **Rank map:**  
  **`buildDraftRankMapWithLive(draftMatches, currentGw, fixturesLiveEntryPoints)`**  
  So for the **current gameweek**, ranks use **live** points; for past GWs they use stored match points (3 pts win, 1 draw, 0 loss + points_for tie-break).
- **Displayed as:** `team_1_rank` / `team_2_rank` on each fixture for the current GW.

### `/fixtures/matchup` (Matchup detail – league)

- **Source:** Same league matches (Draft or DB).
- **Live points:** For the **two teams in this matchup** and current GW, fetches live + picks and sums → **matchupLiveEntryPoints**.
- **Rank map:**  
  **`buildDraftRankMapWithLive(matches, currentGw, matchupLiveEntryPoints)`**  
  So again, **current GW** uses **live** points for ranking.
- **Displayed as:** `rank` on team_1 / team_2 when `gameweek === currentGw`.

### Matchup detail – cup

- **Rank map:** **`buildLeagueRankMap(supabase, currentGw)`** (from DB `h2h_matchups`: points, points_for, no live injection).  
  So cup matchup ranks are from **league table in DB**, not from Draft live.

### This Week’s Matchups (Dashboard widget)

- **Source:** **`GET .../h2h-matchups`** (with optional gameweek).
- **Rank source in that endpoint:**  
  - **Database path:** **`buildLeagueRankMap(supabase, latestCompletedForRanks)`** – ranks from DB `h2h_matchups` up to latest completed GW (no live for current GW).  
  - **Draft path:** **`buildDraftRankMapFromMatches(allMatches, latestCompletedForRanks)`** – ranks from **stored** match points only; **no** live entry points for current GW.  
  So **team_1_rank** / **team_2_rank** in This Week’s Matchups are **not** refreshed with live points for the current gameweek; they reflect completed GWs / stored data only.

**Summary**

| Route / UI              | Rank function                          | Current GW uses live? |
|-------------------------|----------------------------------------|-------------------------|
| /fixtures               | buildDraftRankMapWithLive(..., live)   | Yes                     |
| /fixtures/matchup (league) | buildDraftRankMapWithLive(..., live) | Yes                     |
| /fixtures/matchup (cup)  | buildLeagueRankMap(supabase)           | No (DB table)           |
| This Week’s Matchups    | buildLeagueRankMap / buildDraftRankMapFromMatches | No (stored only) |

---

## 5. Why some player images are blocked

- **Where URLs come from:**  
  Server: **`resolvePlayerImageUrl(player)`** uses, in order:  
  `player.image_url`, `photo_url`, `photo`, `headshot` (if they look like `https?://...`), or builds  
  `https://resources.premierleague.com/premierleague/photos/players/250x250/p{code}.png` from `player.photo` / `player.code`.  
  Client (e.g. LivePlayerUpdates, ThisWeekMatchups) also has **`sanitizeImageUrl`** (http→https) and **avatar fallbacks** when the image fails.

- **Why some are “blocked”:**
  1. **Referrer / hotlinking:** Premier League (and FPL) image hosts often allow only requests with a specific `Referer` (e.g. fantasy.premierleague.com). When your app loads the same URL from another origin (e.g. zoryaanalytics.com or localhost), the server can respond with **403 Forbidden** or not serve the image, so the browser “blocks” it.
  2. **CORS:** If the client tried to fetch the image via `fetch()` and the image server doesn’t send permissive CORS headers, the response can be blocked; with `<img src="...">` it’s usually **referrer policy** rather than CORS that causes the block.
  3. **Invalid or missing code:** If `code` / `photo` is missing or wrong, the built URL may 404 or be rejected.

- **What the app does:**  
  When the image fails to load, the UI falls back to **avatar placeholders** (e.g. `ui-avatars.com` by player name or similar). So “blocked” means the first choice (FPL/PL URL) is refused by the host; the user still sees a fallback image.

To fix blocking you’d need either: (a) proxy player images through your own backend (same origin + your referrer), or (b) use an image URL that the PL host allows from your domain (if they offer one), or (c) rely on the current avatar fallback as the intended behaviour.
