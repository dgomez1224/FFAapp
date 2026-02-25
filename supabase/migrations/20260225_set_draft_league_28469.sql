-- Set current season Draft league id to 28469 in persisted config tables.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'season_state' AND column_name = 'league_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'season_state' AND column_name = 'league_id' AND data_type IN ('integer','bigint')
    ) THEN
      UPDATE season_state
      SET league_id = 28469
      WHERE season = '2025/26';
    ELSE
      UPDATE season_state
      SET league_id = '28469'
      WHERE season = '2025/26';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournaments' AND column_name = 'league_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'tournaments' AND column_name = 'league_id' AND data_type IN ('integer','bigint')
    ) THEN
      UPDATE tournaments
      SET league_id = 28469
      WHERE season = '2025/26';
    ELSE
      UPDATE tournaments
      SET league_id = '28469'
      WHERE season = '2025/26';
    END IF;
  END IF;
END $$;

