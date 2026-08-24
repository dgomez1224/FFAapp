-- Division Two expansion: two Draft leagues, 20 managers, current-season entry IDs
-- Division One league: 23236
-- Division Two league: 31913

-- --------------------
-- Shared manager list
-- --------------------

-- --------------------
-- league_divisions
-- --------------------

CREATE TABLE IF NOT EXISTS league_divisions (
  division TEXT PRIMARY KEY CHECK (division IN ('division_one', 'division_two')),
  league_id TEXT NOT NULL,
  league_code TEXT,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO league_divisions (division, league_id, league_code, display_name)
VALUES
  ('division_one', '23236', NULL, 'Division One'),
  ('division_two', '31913', NULL, 'Division Two')
ON CONFLICT (division) DO UPDATE SET
  league_id = EXCLUDED.league_id,
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

ALTER TABLE league_divisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON league_divisions;
CREATE POLICY "Public read access" ON league_divisions FOR SELECT USING (true);

-- --------------------
-- teams.division
-- --------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'division'
  ) THEN
    ALTER TABLE teams ADD COLUMN division TEXT NOT NULL DEFAULT 'division_one'
      CHECK (division IN ('division_one', 'division_two'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teams_division ON teams(division);

-- --------------------
-- all_time_manager_stats.current_division
-- --------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'all_time_manager_stats' AND column_name = 'current_division'
  ) THEN
    ALTER TABLE all_time_manager_stats ADD COLUMN current_division TEXT
      CHECK (current_division IN ('division_one', 'division_two'));
  END IF;
END $$;

-- --------------------
-- Relax manager-name CHECKs to all 20 managers
-- --------------------

ALTER TABLE manager_aliases DROP CONSTRAINT IF EXISTS manager_aliases_manager_name_check;
ALTER TABLE manager_aliases ADD CONSTRAINT manager_aliases_manager_name_check CHECK (
  manager_name = ANY (ARRAY[
    'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI',
    'ANDREW','BRENDAN','CONNOR','LUKE','KARIM','JORDAN','ROHUN','ZACH','SEBASTIAN','GRANT'
  ])
);

ALTER TABLE legacy_season_trophies DROP CONSTRAINT IF EXISTS legacy_season_trophies_manager_name_check;
ALTER TABLE legacy_season_trophies ADD CONSTRAINT legacy_season_trophies_manager_name_check CHECK (
  manager_name = ANY (ARRAY[
    'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI',
    'ANDREW','BRENDAN','CONNOR','LUKE','KARIM','JORDAN','ROHUN','ZACH','SEBASTIAN','GRANT'
  ])
);

-- --------------------
-- Seed aliases, teams, divisions, and 2026/27 cup tournament
-- --------------------

DO $$
DECLARE
  tid UUID;
  new_tid UUID;
BEGIN
  SELECT id INTO tid FROM tournaments WHERE is_active = true ORDER BY created_at DESC LIMIT 1;
  IF tid IS NULL THEN
    SELECT id INTO tid FROM tournaments ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Division One aliases (current-season entry IDs)
  INSERT INTO manager_aliases (entry_id, manager_name) VALUES
    ('258967', 'BENJI'),
    ('247337', 'CHRIS'),
    ('132262', 'DAVID'),
    ('135018', 'HENRI'),
    ('268695', 'IAN'),
    ('238334', 'LENNART'),
    ('122327', 'MARCO'),
    ('118187', 'MATT'),
    ('126340', 'MAX'),
    ('261017', 'PATRICK')
  ON CONFLICT (entry_id) DO UPDATE SET manager_name = EXCLUDED.manager_name, updated_at = NOW();

  -- Division Two aliases
  INSERT INTO manager_aliases (entry_id, manager_name) VALUES
    ('183764', 'ANDREW'),
    ('195884', 'BRENDAN'),
    ('221585', 'CONNOR'),
    ('165408', 'GRANT'),
    ('231538', 'JORDAN'),
    ('231380', 'KARIM'),
    ('216175', 'LUKE'),
    ('178589', 'ROHUN'),
    ('183859', 'SEBASTIAN'),
    ('215391', 'ZACH')
  ON CONFLICT (entry_id) DO UPDATE SET manager_name = EXCLUDED.manager_name, updated_at = NOW();

  -- Normalize Division One team names and current-season entry IDs
  UPDATE teams SET manager_name = 'MATT' WHERE manager_name IN ('MATTHEW', 'MATT');

  UPDATE teams SET entry_id = 258967, manager_name = 'BENJI', division = 'division_one' WHERE manager_name = 'BENJI';
  UPDATE teams SET entry_id = 247337, manager_name = 'CHRIS', division = 'division_one' WHERE manager_name = 'CHRIS';
  UPDATE teams SET entry_id = 132262, manager_name = 'DAVID', division = 'division_one' WHERE manager_name = 'DAVID';
  UPDATE teams SET entry_id = 135018, manager_name = 'HENRI', division = 'division_one' WHERE manager_name = 'HENRI';
  UPDATE teams SET entry_id = 268695, manager_name = 'IAN', division = 'division_one' WHERE manager_name = 'IAN';
  UPDATE teams SET entry_id = 238334, manager_name = 'LENNART', division = 'division_one' WHERE manager_name = 'LENNART';
  UPDATE teams SET entry_id = 122327, manager_name = 'MARCO', division = 'division_one' WHERE manager_name = 'MARCO';
  UPDATE teams SET entry_id = 118187, manager_name = 'MATT', division = 'division_one' WHERE manager_name = 'MATT';
  UPDATE teams SET entry_id = 126340, manager_name = 'MAX', division = 'division_one' WHERE manager_name = 'MAX';
  UPDATE teams SET entry_id = 261017, manager_name = 'PATRICK', division = 'division_one' WHERE manager_name = 'PATRICK';

  -- Division Two teams (keep existing row if already present)
  INSERT INTO teams (entry_id, entry_name, manager_name, manager_short_name, division, tournament_id)
  VALUES
    (183764, 'ANDREW FC', 'ANDREW', 'ANDREW', 'division_two', tid),
    (195884, 'BRENDAN FC', 'BRENDAN', 'BRENDAN', 'division_two', tid),
    (221585, 'CONNOR FC', 'CONNOR', 'CONNOR', 'division_two', tid),
    (165408, 'GRANT FC', 'GRANT', 'GRANT', 'division_two', tid),
    (231538, 'JORDAN FC', 'JORDAN', 'JORDAN', 'division_two', tid),
    (231380, 'KARIM FC', 'KARIM', 'KARIM', 'division_two', tid),
    (216175, 'LUKE FC', 'LUKE', 'LUKE', 'division_two', tid),
    (178589, 'ROHUN FC', 'ROHUN', 'ROHUN', 'division_two', tid),
    (183859, 'SEBASTIAN FC', 'SEBASTIAN', 'SEBASTIAN', 'division_two', tid),
    (215391, 'ZACH FC', 'ZACH', 'ZACH', 'division_two', tid)
  ON CONFLICT (tournament_id, entry_id) DO UPDATE SET
    division = 'division_two',
    manager_name = EXCLUDED.manager_name,
    entry_name = EXCLUDED.entry_name,
    manager_short_name = EXCLUDED.manager_short_name;

  UPDATE all_time_manager_stats SET current_division = 'division_one'
  WHERE manager_name = ANY (ARRAY[
    'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
  ]);

  UPDATE all_time_manager_stats SET current_division = 'division_two'
  WHERE manager_name = ANY (ARRAY[
    'ANDREW','BRENDAN','CONNOR','LUKE','KARIM','JORDAN','ROHUN','ZACH','SEBASTIAN','GRANT'
  ]);

  -- New-season FFA Cup covering all 20 teams
  UPDATE tournaments SET is_active = false WHERE season <> '2026/27';

  SELECT id INTO new_tid
  FROM tournaments
  WHERE season = '2026/27'
  ORDER BY created_at DESC
  LIMIT 1;

  IF new_tid IS NULL THEN
    INSERT INTO tournaments (
      name, league_id, season, start_gameweek, end_gameweek, group_stage_gameweeks,
      knockout_gameweeks, teams_advance_pct, status, is_active, entry_id
    )
    VALUES (
      'FFA Cup', 23236, '2026/27', 27, 38, 4,
      8, 0.80, 'group_stage', true, '132262'
    )
    RETURNING id INTO new_tid;
  ELSE
    UPDATE tournaments
    SET is_active = true,
        league_id = 23236,
        entry_id = '132262',
        start_gameweek = 27,
        group_stage_gameweeks = 4,
        status = 'group_stage',
        updated_at = NOW()
    WHERE id = new_tid;
  END IF;

  UPDATE teams SET tournament_id = new_tid WHERE new_tid IS NOT NULL;
END $$;
