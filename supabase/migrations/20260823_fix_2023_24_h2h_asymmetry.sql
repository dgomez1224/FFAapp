-- Correct 2023/24 H2H rows that did not invert against their reverse matchup.
-- Totals are taken from legacy_h2h_gameweek_results scores (points_for vs points_against).

UPDATE legacy_h2h_stats
SET wins = 3, draws = 0, losses = 1, games_played = 4
WHERE season = '2023/24' AND upper(manager_name) = 'PATRICK' AND upper(opponent_name) = 'BENJI';

UPDATE legacy_h2h_stats
SET wins = 3, draws = 0, losses = 1, games_played = 4
WHERE season = '2023/24' AND upper(manager_name) = 'HENRI' AND upper(opponent_name) = 'MARCO';

UPDATE legacy_h2h_stats
SET wins = 3, draws = 0, losses = 2, games_played = 5
WHERE season = '2023/24' AND upper(manager_name) = 'PATRICK' AND upper(opponent_name) = 'HENRI';
