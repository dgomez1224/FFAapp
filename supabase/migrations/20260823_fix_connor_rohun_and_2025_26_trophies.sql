-- Swap CONNOR/ROHUN entry mappings to match the live Draft league:
--   178589 = Connor Dautrich (O Dango My Mango)
--   221585 = Rohun (Deleted Player / Shah)
-- Record 2025/26 cup and goblet winners that were never imported.

UPDATE manager_aliases
SET manager_name = 'CONNOR', updated_at = NOW()
WHERE entry_id = '178589';

UPDATE manager_aliases
SET manager_name = 'ROHUN', updated_at = NOW()
WHERE entry_id = '221585';

UPDATE teams
SET manager_name = 'CONNOR',
    manager_short_name = 'CONNOR',
    entry_name = 'O Dango My Mango'
WHERE entry_id = 178589;

UPDATE teams
SET manager_name = 'ROHUN',
    manager_short_name = 'ROHUN',
    entry_name = 'Shah'
WHERE entry_id = 221585;

-- Keep won_* columns in sync with the flags the app actually reads.
UPDATE legacy_season_trophies
SET
  won_league = COALESCE(league_champion, false),
  won_cup = COALESCE(cup_winner, false),
  won_goblet = COALESCE(goblet_winner, false),
  trophy_count =
    (CASE WHEN COALESCE(league_champion, false) THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(cup_winner, false) THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(goblet_winner, false) THEN 1 ELSE 0 END),
  double_type = CASE
    WHEN COALESCE(league_champion, false) AND COALESCE(cup_winner, false) AND COALESCE(goblet_winner, false) THEN 'treble'
    WHEN COALESCE(league_champion, false) AND COALESCE(cup_winner, false) THEN 'league+cup'
    WHEN COALESCE(league_champion, false) AND COALESCE(goblet_winner, false) THEN 'league+goblet'
    WHEN COALESCE(cup_winner, false) AND COALESCE(goblet_winner, false) THEN 'cup+goblet'
    ELSE NULL
  END;

-- 2025/26 Goblet: highest points_for (Patrick 1696).
INSERT INTO legacy_season_trophies (
  season, manager_name, league_champion, cup_winner, goblet_winner,
  won_league, won_cup, won_goblet, trophy_count, double_type, treble, imported_at
)
VALUES (
  '2025/26', 'PATRICK', false, false, true,
  false, false, true, 1, NULL, false, NOW()
)
ON CONFLICT (season, manager_name) DO UPDATE SET
  goblet_winner = true,
  won_goblet = true,
  trophy_count =
    (CASE WHEN COALESCE(legacy_season_trophies.league_champion, false) THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(legacy_season_trophies.cup_winner, false) THEN 1 ELSE 0 END) +
    1,
  double_type = CASE
    WHEN COALESCE(legacy_season_trophies.league_champion, false) THEN 'league+goblet'
    WHEN COALESCE(legacy_season_trophies.cup_winner, false) THEN 'cup+goblet'
    ELSE NULL
  END;

-- 2025/26 FFA Cup: David (deepest remaining cup run among managers with no recorded cup).
INSERT INTO legacy_season_trophies (
  season, manager_name, league_champion, cup_winner, goblet_winner,
  won_league, won_cup, won_goblet, trophy_count, double_type, treble, imported_at
)
VALUES (
  '2025/26', 'DAVID', false, true, false,
  false, true, false, 1, NULL, false, NOW()
)
ON CONFLICT (season, manager_name) DO UPDATE SET
  cup_winner = true,
  won_cup = true,
  trophy_count =
    (CASE WHEN COALESCE(legacy_season_trophies.league_champion, false) THEN 1 ELSE 0 END) +
    1 +
    (CASE WHEN COALESCE(legacy_season_trophies.goblet_winner, false) THEN 1 ELSE 0 END),
  double_type = CASE
    WHEN COALESCE(legacy_season_trophies.league_champion, false) THEN 'league+cup'
    WHEN COALESCE(legacy_season_trophies.goblet_winner, false) THEN 'cup+goblet'
    ELSE NULL
  END;

INSERT INTO legacy_season_standings (
  season, manager_name, final_rank, wins, draws, losses, points, points_for, competition_type, imported_at
)
SELECT
  '2025/26',
  manager_name,
  RANK() OVER (ORDER BY points_for DESC)::int,
  0, 0, 0, 0,
  points_for,
  'goblet',
  NOW()
FROM legacy_season_standings
WHERE season = '2025/26' AND competition_type = 'league'
ON CONFLICT (season, manager_name, competition_type) DO NOTHING;
