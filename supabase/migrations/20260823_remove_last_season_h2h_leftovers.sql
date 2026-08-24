-- Last-season Division One h2h_matchups reused current team UUIDs after the
-- Division Two expansion. Unique key is (team_1_id, team_2_id, gameweek), so
-- reversed pairings (e.g. LENNART-BENJI vs BENJI-LENNART) both survived.
-- Those leftover rows inflated GW1 games played, Goblet points, and This Week
-- fixtures. Historical seasons stay in legacy_h2h_stats / legacy tables.

DELETE FROM h2h_matchups
WHERE updated_at < '2026-08-01';
