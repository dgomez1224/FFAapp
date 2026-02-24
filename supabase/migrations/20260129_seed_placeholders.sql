-- Optional seed data for local UI rendering (no FPL API required)
-- This inserts placeholder manager_aliases, teams, a tournament, season_state,
-- and zeroed gameweek_scores for GW1 if tables are empty.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM teams) THEN
    -- Insert manager aliases - check if entry_id is bigint or text
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'manager_aliases' AND column_name = 'entry_id' AND data_type IN ('integer','bigint')
    ) THEN
      -- manager_aliases.entry_id is numeric, use placeholder numbers
      INSERT INTO manager_aliases (entry_id, manager_name)
      VALUES
        (100001, 'PATRICK'),
        (100002, 'MATT'),
        (100003, 'MARCO'),
        (100004, 'LENNART'),
        (100005, 'CHRIS'),
        (100006, 'IAN'),
        (100007, 'HENRI'),
        (100008, 'DAVID'),
        (100009, 'MAX'),
        (100010, 'BENJI')
      ON CONFLICT (entry_id) DO NOTHING;
    ELSE
      -- manager_aliases.entry_id is text, use text values
      INSERT INTO manager_aliases (entry_id, manager_name)
      VALUES
        ('seed-PATRICK', 'PATRICK'),
        ('seed-MATT', 'MATT'),
        ('seed-MARCO', 'MARCO'),
        ('seed-LENNART', 'LENNART'),
        ('seed-CHRIS', 'CHRIS'),
        ('seed-IAN', 'IAN'),
        ('seed-HENRI', 'HENRI'),
        ('seed-DAVID', 'DAVID'),
        ('seed-MAX', 'MAX'),
        ('seed-BENJI', 'BENJI')
      ON CONFLICT (entry_id) DO NOTHING;
    END IF;

    -- Insert tournament with all possible columns
    -- Check for knockout_gameweeks and other optional columns
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'tournaments' AND column_name = 'knockout_gameweeks'
    ) THEN
      -- Tournament has knockout_gameweeks (and likely other columns)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'league_id'
      ) THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tournaments' AND column_name = 'league_id' AND data_type IN ('integer','bigint')
        ) THEN
          EXECUTE $sql$
            INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, end_gameweek, group_stage_gameweeks, knockout_gameweeks, teams_advance_pct, is_active, league_id)
            VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 38, 4, 6, 0.80, true, 0)
            ON CONFLICT DO NOTHING
          $sql$;
        ELSE
          EXECUTE $sql$
            INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, end_gameweek, group_stage_gameweeks, knockout_gameweeks, teams_advance_pct, is_active, league_id)
            VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 38, 4, 6, 0.80, true, 'seed-league')
            ON CONFLICT DO NOTHING
          $sql$;
        END IF;
      ELSE
        EXECUTE $sql$
          INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, end_gameweek, group_stage_gameweeks, knockout_gameweeks, teams_advance_pct, is_active)
          VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 38, 4, 6, 0.80, true)
          ON CONFLICT DO NOTHING
        $sql$;
      END IF;
    ELSE
      -- Tournament doesn't have knockout_gameweeks (simpler schema)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments' AND column_name = 'league_id'
      ) THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'tournaments' AND column_name = 'league_id' AND data_type IN ('integer','bigint')
        ) THEN
          EXECUTE $sql$
            INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, group_stage_gameweeks, is_active, league_id)
            VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 4, true, 0)
            ON CONFLICT DO NOTHING
          $sql$;
        ELSE
          EXECUTE $sql$
            INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, group_stage_gameweeks, is_active, league_id)
            VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 4, true, 'seed-league')
            ON CONFLICT DO NOTHING
          $sql$;
        END IF;
      ELSE
        INSERT INTO tournaments (entry_id, name, season, status, start_gameweek, group_stage_gameweeks, is_active)
        VALUES (164475, 'FFA Cup', '2025/26', 'group_stage', 1, 4, true)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- Insert teams - check if entry_id is bigint or text
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'teams' AND column_name = 'entry_id' AND data_type IN ('integer','bigint')
    ) THEN
      -- teams.entry_id is numeric, generate placeholder numbers
      INSERT INTO teams (entry_id, entry_name, manager_name, manager_short_name, tournament_id)
      SELECT
        (ROW_NUMBER() OVER (ORDER BY ma.manager_name) + 100000)::bigint, -- Generate placeholder numeric entry_ids
        ma.manager_name || ' FC',
        ma.manager_name,
        ma.manager_name,
        t.id
      FROM manager_aliases ma
      CROSS JOIN LATERAL (
        SELECT id FROM tournaments WHERE season = '2025/26' ORDER BY created_at DESC LIMIT 1
      ) t;
    ELSE
      -- teams.entry_id is text, use text values from manager_aliases or generate
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'manager_aliases' AND column_name = 'entry_id' AND data_type IN ('integer','bigint')
      ) THEN
        -- manager_aliases.entry_id is numeric, convert to text
        INSERT INTO teams (entry_id, entry_name, manager_name, manager_short_name, tournament_id)
        SELECT
          ma.entry_id::text,
          ma.manager_name || ' FC',
          ma.manager_name,
          ma.manager_name,
          t.id
        FROM manager_aliases ma
        CROSS JOIN LATERAL (
          SELECT id FROM tournaments WHERE season = '2025/26' ORDER BY created_at DESC LIMIT 1
        ) t;
      ELSE
        -- Both are text, use directly
        INSERT INTO teams (entry_id, entry_name, manager_name, manager_short_name, tournament_id)
        SELECT
          ma.entry_id,
          ma.manager_name || ' FC',
          ma.manager_name,
          ma.manager_name,
          t.id
        FROM manager_aliases ma
        CROSS JOIN LATERAL (
          SELECT id FROM tournaments WHERE season = '2025/26' ORDER BY created_at DESC LIMIT 1
        ) t;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'season_state' AND column_name = 'league_id'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'season_state' AND column_name = 'league_id' AND data_type IN ('integer','bigint')
      ) THEN
        INSERT INTO season_state (season, current_gameweek, deadline_time, league_id, league_name)
        VALUES ('2025/26', 1, NULL, 0, 'FFA (Seeded)')
        ON CONFLICT (season) DO NOTHING;
      ELSE
        INSERT INTO season_state (season, current_gameweek, deadline_time, league_id, league_name)
        VALUES ('2025/26', 1, NULL, 'seed-league', 'FFA (Seeded)')
        ON CONFLICT (season) DO NOTHING;
      END IF;
    ELSE
      INSERT INTO season_state (season, current_gameweek, deadline_time, league_name)
      VALUES ('2025/26', 1, NULL, 'FFA (Seeded)')
      ON CONFLICT (season) DO NOTHING;
    END IF;

    INSERT INTO gameweek_scores (team_id, tournament_id, gameweek, total_points, captain_points, bench_points, raw_data)
    SELECT
      teams.id,
      teams.tournament_id,
      1,
      0,
      0,
      0,
      '{}'::jsonb
    FROM teams;
  END IF;
END $$;
