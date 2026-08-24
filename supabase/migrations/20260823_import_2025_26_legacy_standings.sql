-- 2025/26 is now a completed historical season. Allow it in trophy history
-- and import league standings derived from gameweek results.

ALTER TABLE public.legacy_season_trophies
  DROP CONSTRAINT IF EXISTS legacy_season_trophies_season_check;
ALTER TABLE public.legacy_season_trophies
  ADD CONSTRAINT legacy_season_trophies_season_check CHECK (season < '2026/27');

INSERT INTO public.legacy_season_standings (
  season, manager_name, final_rank, wins, draws, losses, points, points_for, competition_type, imported_at
)
SELECT
  '2025/26' AS season,
  manager_name,
  RANK() OVER (
    ORDER BY
      (COUNT(*) FILTER (WHERE result = 'W') * 3 + COUNT(*) FILTER (WHERE result = 'D')) DESC,
      SUM(points_for) DESC
  )::int AS final_rank,
  COUNT(*) FILTER (WHERE result = 'W')::int AS wins,
  COUNT(*) FILTER (WHERE result = 'D')::int AS draws,
  COUNT(*) FILTER (WHERE result = 'L')::int AS losses,
  (COUNT(*) FILTER (WHERE result = 'W') * 3 + COUNT(*) FILTER (WHERE result = 'D'))::int AS points,
  SUM(points_for)::int AS points_for,
  'league' AS competition_type,
  NOW() AS imported_at
FROM public.legacy_h2h_gameweek_results
WHERE season = '2025/26'
GROUP BY manager_name
ON CONFLICT (season, manager_name, competition_type) DO UPDATE SET
  final_rank = EXCLUDED.final_rank,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  points = EXCLUDED.points,
  points_for = EXCLUDED.points_for,
  imported_at = EXCLUDED.imported_at;

INSERT INTO public.legacy_season_trophies (
  season, manager_name, league_champion, cup_winner, goblet_winner
)
SELECT '2025/26', manager_name, true, false, false
FROM public.legacy_season_standings
WHERE season = '2025/26'
  AND competition_type = 'league'
  AND final_rank = 1
ON CONFLICT (season, manager_name) DO UPDATE SET
  league_champion = true;
