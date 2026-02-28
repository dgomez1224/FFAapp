# Live Fixture Scores and Rankings: How They Are Calculated and Returned

This describes how **live** fixture scores and **league rankings** are produced for:

- **`/fixtures`** (Fixtures hub – league + cup)
- **`/fixtures/matchup`** with `type=league` (matchup detail, e.g. from “This Week’s Matchups”)

Both use the **same shared scoring path** below. Past gameweeks use stored/Draft API points only; the **current** gameweek uses live points when available.

---

## 1. Shared live scoring: `computeLiveEntryPoints(currentGw)`

A single function computes **live points per entry** for the current gameweek (starters only):

1. **`GET draft.premierleague.com/api/event/{currentGw}/live`**  
   Returns per-player live points for the gameweek. The server builds a map: **element id → points** (`extractLivePointsMap`).

2. **Draft league details**  
   `resolveDraftLeagueDetails` (e.g. `GET league/{id}/details`) gives **matches** and **league_entries**. For the **current** gameweek, we collect all **entry ids** that appear in matches (`league_entry_1`, `league_entry_2`).

3. **Picks and starter points**  
   For each of those entry ids we call **`GET draft.premierleague.com/api/entry/{entryId}/event/{currentGw}`** to get that entry’s **picks** (lineup). For each pick with **position 1–11** (starters), we take the **element id**, look up points in the live map, and **sum** them. That sum is the **live total** for that entry for the current GW.

4. **Result**  
   A map **entry id (string) → number**: `liveEntryPoints[entryId] = total live points (starters only)` for the current gameweek.

So: **one** function, **one** definition of “live points” (starters, current GW only), used everywhere below.

---

## 2. Rank map: `buildDraftRankMapWithLive(matches, currentGw, liveEntryPoints)`

Rankings are **league table position** (1st, 2nd, …) based on:

- **Points** (win = 3, draw = 1, loss = 0) from **all matches up to and including** the given gameweek.
- **Points for** (total goals/points scored in those matches) as tiebreaker.

For **past** gameweeks we use points from the match object (Draft API or DB). For the **current** gameweek we use **live** points when available:

- If `gw === currentGw` and `liveEntryPoints` is provided and non-empty, we use `liveEntryPoints[entry1]` and `liveEntryPoints[entry2]` instead of `league_entry_1_points` / `league_entry_2_points`.
- We aggregate points and points_for per entry, sort by (points desc, points_for desc), and assign rank 1, 2, 3, …

So:

- **Ranks** = league position from match results up to that GW.
- **Current GW** = live points from `computeLiveEntryPoints`; **past GWs** = stored/Draft API points only.

---

## 3. `/fixtures` (Fixtures hub)

1. **Resolve current gameweek**  
   From bootstrap or `season_state` (`current_gameweek`).

2. **Load league matches**  
   Draft league details → `draftMatches` (all gameweeks). If Draft API fails, fallback from DB `h2h_matchups`.

3. **Live points for current GW**  
   `fixturesLiveEntryPoints = await computeLiveEntryPoints(currentGw)` (shared utility).

4. **Rank map**  
   `rankMap = buildDraftRankMapWithLive(draftMatches, currentGw, fixturesLiveEntryPoints)` so current GW uses live points, past GWs use stored.

5. **Build league fixtures per gameweek**  
   For each match in `draftMatches`:
   - `team1Id` / `team2Id` = `league_entry_1` / `league_entry_2` (draft entry ids).
   - If **this match is current GW** and we have live data:  
     `team_1_points = fixturesLiveEntryPoints[team1Id]` (fallback to match’s stored points if missing).  
     Same for `team_2_points`.
   - If **past GW**: use `league_entry_1_points` / `league_entry_2_points` (or equivalent) from the match.
   - For **current GW only**: set `team_1_rank` / `team_2_rank` from `rankMap[team1Id]` / `rankMap[team2Id]`; past GWs can leave rank null or omit.

6. **Return**  
   Response includes `league: groupToArray(enrichedLeague)` (and cup/cup_group). Each league fixture has `gameweek`, `team_1_id`, `team_2_id`, `team_1_points`, `team_2_points`, and for current GW `team_1_rank`, `team_2_rank`, `is_ongoing: true`.

So under **`/fixtures`**, **scores** for the current gameweek are the **live** totals from `computeLiveEntryPoints`, and **rankings** are from `buildDraftRankMapWithLive` using those same live points for the current GW.

---

## 4. `/fixtures/matchup` (e.g. `type=league`)

Used when you open a single league matchup (e.g. from “This Week’s Matchups” or the Fixtures page).

1. **Resolve current gameweek** and **league matches** (same as above).

2. **Resolve the two teams**  
   From query params `team1`, `team2`, `gameweek` (draft entry ids or DB team ids depending on context).

3. **Live points**  
   `matchupLiveEntryPoints = await computeLiveEntryPoints(currentGw)` (same shared function).

4. **Rank map**  
   `rankMap = buildDraftRankMapWithLive(matches, currentGw, matchupLiveEntryPoints)`.

5. **Find the matching league row**  
   The match row where `(league_entry_1, league_entry_2)` (or equivalent) matches the two teams and `event === gameweek`.

6. **Lineup and effective points**  
   For the detail view, the server builds each team’s **lineup** (players, positions, etc.). For each player it uses **live** stats when `gameweek === currentGw` (e.g. from the same event/live and picks data), and computes **effective_points** (e.g. including captain double). So the **matchup detail** shows live player-level points; the **match total** for the current GW is consistent with the same `computeLiveEntryPoints` totals.

7. **Return**  
   The matchup payload includes team names, **team_1_points** / **team_2_points** (live for current GW when applicable), **team_1_rank** / **team_2_rank** from `rankMap`, and the lineups with **effective_points**.

So under **matchups** (league), **scores** and **rankings** are calculated the same way as under `/fixtures`: shared `computeLiveEntryPoints(currentGw)` and `buildDraftRankMapWithLive(..., currentGw, liveEntryPoints)`.

---

## 5. Summary

| What                | Source |
|---------------------|--------|
| **Live points (current GW)** | `computeLiveEntryPoints(currentGw)` → map entry id → total starter points from Draft API event/live + entry/event picks. |
| **Rankings**        | `buildDraftRankMapWithLive(matches, currentGw, liveEntryPoints)` → league table from match results; current GW uses live points. |
| **Past GW scores**  | Stored values only (Draft API match object or DB); never overwritten by live. |
| **Where it’s used** | `/fixtures` (league list), `/fixtures/matchup` (league detail). Same logic for both. |

So: **live fixture scores** = starter totals from Draft live + picks; **rankings** = league position from those same points (for current GW) plus stored points (past GWs); **returned** in the `league` array on `/fixtures` and in the matchup payload on `/fixtures/matchup` (type=league).

---

## 6. How This Differs from “This Week’s Matchups” (Dashboard, `/dashboard`)

“This Week’s Matchups” is the widget on the **dashboard** that lists current gameweek matchups and shows live-looking scores. Its **data flow** is different from the one used by `/fixtures` and `/fixtures/matchup`.

### Where the dashboard gets its data

1. **List of matchups**  
   The client calls **`/h2h-matchups`** (no query or with gameweek). That handler:
   - Does **not** call `computeLiveEntryPoints`.
   - Does **not** call `buildDraftRankMapWithLive` (no live-inclusive ranks).
   - Resolves gameweek (e.g. current “display” gameweek) and **ranks** via:
     - `rankMap = await buildLeagueRankMap(supabase, latestCompletedForRanks)`, or  
     - Draft fallback: `draftRankMap = buildDraftRankMapFromMatches(allMatches, latestCompletedForRanks)`.
   - So **rank** is always “up to **latest completed** gameweek” only (`latestCompletedForRanks`). The **current** gameweek is **not** included in the rank calculation on this route.
   - **Points** in the list:
     - If DB has rows for this gameweek: `team_1_points` / `team_2_points` come from **DB** (`h2h_matchups`). Those can be live only if something else (e.g. Goblet sync) has already run and written live into the DB.
     - If no DB rows: points come from the **Draft API match object** (`league_entry_1_points` / `league_entry_2_points`) — i.e. **stored** values, not live.

2. **Live-looking scores on the dashboard**  
   The client does **not** use the points from the list for the big numbers. For **each** matchup it:
   - Fetches **`/fixtures/matchup?type=league&gameweek=…&team1=…&team2=…`**.
   - Takes `detail.team_1.lineup` and `detail.team_2.lineup`.
   - Sums `effective_points` for non-bench players → `live_team_1_points`, `live_team_2_points`.
   - Merges these into the list and shows them as the main scores.

So for the **dashboard**:

- **Scores shown** = same underlying logic as `/fixtures/matchup` (server builds lineups with live `effective_points`; client sums them). So the **scoring formula** is the same.
- **Scores in the list response** = from `/h2h-matchups` only → either DB (possibly stale) or Draft stored; the list endpoint itself never runs live scoring.
- **Rankings shown** = from `/h2h-matchups` → `team_1_rank` / `team_2_rank` = **league position up to latest completed gameweek only**. Current gameweek is **not** included, so ranks do **not** reflect live match results for “this week”.

### Side-by-side

| Aspect | `/fixtures` and `/fixtures/matchup` | This Week’s Matchups (dashboard) |
|--------|------------------------------------|----------------------------------|
| **List / context** | Fixtures: draft matches + `computeLiveEntryPoints` + `buildDraftRankMapWithLive`. Matchup: same live + rank. | List from **`/h2h-matchups`**: no `computeLiveEntryPoints`, no `buildDraftRankMapWithLive`. |
| **Points in list** | For current GW: **live** (from `computeLiveEntryPoints`). | From DB or Draft **stored**; list endpoint does not compute live. |
| **Scores displayed** | Server returns live totals (and matchup returns lineups with live `effective_points`). | Client gets live by calling **`/fixtures/matchup`** per matchup and summing lineups → same scoring logic, but **N extra requests**. |
| **Rankings** | `buildDraftRankMapWithLive(..., currentGw, liveEntryPoints)` → rank **includes current GW** (live). | `buildLeagueRankMap(supabase, latestCompletedForRanks)` or `buildDraftRankMapFromMatches(..., latestCompletedForRanks)` → rank **excludes current GW** (only up to latest completed). |

So: **scoring** on the dashboard (the numbers you see) matches `/fixtures` and matchup because it uses matchup lineups; **rank** on the dashboard does **not** include the current gameweek and is “league position after last completed week”; and the **list endpoint** for the dashboard (`/h2h-matchups`) never runs the shared live scoring or live-inclusive rank logic itself.
