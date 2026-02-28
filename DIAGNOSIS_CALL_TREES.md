# Diagnosis: Call Trees and Divergence

## 1. Goblet Standings handler – call tree

```
GET /goblet-standings
  → syncCurrentSeasonLegacyStats(supabase)
  → fetchDraftBootstrap() → currentEvent, latestCompletedEvent
  → maxGwForGoblet = currentEvent ?? latestCompletedEvent
  → syncH2hAndGobletWithLive(supabase)
       → syncGobletLive(supabase)
            → resolveCurrentGameweek()  ✓
            → fetchDraftMatches(supabase)  → matches, entryIdToTeamId
            → computeLiveEntryPoints(currentGw)  ✓ (same as below)
            → for each match: team1Id = entryIdToTeamId[entry1Id], ...
            → if !team1Id || !team2Id: continue  ← BUG: entryIdToTeamId keyed by FPL entry_id only
            → upsert h2h_matchups
            → rebuildGobletStandings(supabase)
  → supabase.from("h2h_matchups").select(...)  // reads back synced data
  → aggregate by team, return standings
```

**Finding:** Goblet **does** call `computeLiveEntryPoints(currentGw)` and **does** merge live into current GW in `syncGobletLive`. The failure is in **fetchDraftMatches**: it builds `entryIdToTeamId` only with key `String(t.entry_id)` (FPL entry_id). Draft API `details.matches` use `league_entry_1` / `league_entry_2`, which are **draft league entry IDs** (`entry.id` or `entry.league_entry_id`), not FPL `entry_id`. So `entryIdToTeamId[entry1Id]` is undefined, every match is skipped (`if (!team1Id || !team2Id) continue`), no rows are upserted, and Goblet never gets live data.

---

## 2. This Week's Matchups – scoring call tree (client)

```
ThisWeekMatchups (client)
  → fetch(/h2h-matchups)  → payload (team_1_points, team_2_points from DB or draft path)
  → fetch(/api/live)  → startsByPlayerId
  → for each matchup: fetch(/fixtures/matchup?type=league&gameweek=&team1=&team2=)
       → server builds lineup with live stats, effective_points
  → client sums detail.team_1.lineup[].effective_points (non-bench) = live_team_1_points
  → client merges into matchups: live_team_1_points, live_team_2_points
  → UI displays live totals from matchup detail, not from h2h-matchups
```

**Finding:** “This Week” looks live because it **ignores** h2h-matchups points for display and uses **fixtures/matchup** lineups to compute live totals on the client. So the **scoring** that looks correct is the one from **fixtures/matchup** (server builds live lineups; client sums them). The h2h-matchups response is only used for structure and rivalry data.

---

## 3. Fixtures hub – scoring call tree (server)

```
GET /fixtures
  → resolveDraftLeagueDetails → draftMatches
  → currentGw from bootstrap
  → inline: livePayload = fetch(DRAFT_BASE_URL/event/{currentGw}/live)
  → inline: currentGwEntryIds = from draftMatches (league_entry_1, league_entry_2)
  → inline: for each entryId fetch entry/{entryId}/event/{currentGw}, sum starter points
  → fixturesLiveEntryPoints[entryId] = total  (key = league_entry_1 style id)
  → buildDraftRankMapWithLive(draftMatches, currentGw, fixturesLiveEntryPoints)
  → leagueByGw: for each match, team1Id = String(m.league_entry_1), p1 = fixturesLiveEntryPoints[team1Id] for current GW
  → draftEntryMap keyed by same id (league_entry_1)
```

**Finding:** Fixtures uses **inline** live computation (same idea as `computeLiveEntryPoints`) and keys everything by **match key** (`league_entry_1` / `league_entry_2`). So fixtures and matchup detail use **draft-style ids** consistently; Goblet’s `fetchDraftMatches` does not.

---

## 4. League matchup detail – scoring call tree (server)

```
GET /fixtures/matchup?type=league&gameweek=&team1=&team2=
  → resolveDraftLeagueDetails → matches
  → team1, team2 resolved (DB teams or draft entries)
  → matchupLiveEntryPoints: same inline pattern (event/live + entry/{id}/event, sum starters)
  → rankMap = buildDraftRankMapWithLive(matches, currentGw, matchupLiveEntryPoints)
  → mapLineup builds each player with live stats → effective_points
  → client sees live lineups and can sum effective_points
```

**Finding:** Matchup detail also uses **inline** live entry points keyed by the same match ids. So **Fixtures** and **Matchup** both use the same key space (draft match keys). Goblet’s sync uses **entryIdToTeamId** keyed by FPL **entry_id** only, so it diverges.

---

## 5. Player Insights – merge logic

- **Bootstrap:** `draftBootstrap.elements` (or classic); normalized to `rawPlayers` → `byPlayerFromBootstrap` keyed by **player id** (`p.id` / `p.element`).
- **Element-status:** `GET league/28469/element-status` → `element_status` array.
  - Row: `element` (player id), `owner` (or `entry` / `entry_id` / `league_entry_id`).
  - Merge: `playerId = row.element`; `ownerKey = row.owner ?? row.entry ?? row.entry_id ?? row.id ?? row.league_entry_id`; `ownerLabel = ownerLabelByOwnerId[ownerKey]`.
- **ownerLabelByOwnerId:** From `league/details` → `league_entries`; for each entry, keys are `entry_id`, `entry`, `id`, `league_entry_id` (all numeric). So we need **element-status.owner** to equal one of those. Draft may return **entry** (FPL) or **league_entry_id** (draft); we already support both in `ownerKey`.
- **Correct merge:** `bootstrap.id === elementStatus.element` (player id). We use `row?.element ?? row?.element_id` for player and `row?.owner ?? row?.entry ?? ...` for owner. Merge is by player id into `ownersMap[playerId]`; then `ownerManagerMap[playerId]` = first owner. So merge key is correct.
- **Filtering:** When `selections.length === 0` we do `fullInsightsFromBootstrap.filter(...)` and return only `finalAdjusted` (filtered). So we **do** filter out players by position/team/ownership/search. User requirement: “Return ALL players always”, “Filtering must be frontend-only” → we should return the full list and let the client filter.

---

## 6. Player images

- No image proxy found. `resolvePlayerImageUrl` builds a direct URL (or `https://resources.premierleague.com/.../p{code}.png`). Frontend uses `<img src={url}>`. No `fetch()` or auth on image requests. So no change needed beyond ensuring URL format (e.g. 110x140 if desired).

---

## Summary of required fixes

| Issue | Root cause | Fix |
|-------|------------|-----|
| Goblet not live | `entryIdToTeamId` only keyed by FPL `entry_id`; match uses draft id | In `fetchDraftMatches`, map **all** keys that can appear in a match (`entry.id`, `entry.league_entry_id`, `entry.entry_id`) → `team_id`. |
| Player Insights “not all players” | Server returns filtered list when `selections` empty | Return full player list (with ownership); apply filters only when explicitly requested or move filtering to frontend. |
| League/Fixtures vs This Week | Same live logic, but Goblet uses wrong key map | Fixing Goblet key map aligns Goblet with Fixtures/Matchup. Optionally extract shared `computeLiveEntryPoints` and use it in Fixtures + Matchup to avoid duplication. |
| Images | No proxy; direct URL | Server uses direct CDN URL (110x140); no auth/proxy. Confirmed. |

Implementing the Goblet and Player Insights fixes next; then optionally sharing live scoring.
