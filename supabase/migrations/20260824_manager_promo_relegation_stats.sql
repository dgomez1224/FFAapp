-- Promotion / relegation tenure on all_time_manager_stats
-- Division Two began in 2026/27. All prior seasons were Division One.

ALTER TABLE all_time_manager_stats
  ADD COLUMN IF NOT EXISTS promotions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relegations INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seasons_in_div_one INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seasons_in_div_two INTEGER NOT NULL DEFAULT 0;

-- Seed from completed league seasons plus the in-progress 2026/27 tenure.
UPDATE all_time_manager_stats s
SET
  promotions = 0,
  relegations = 0,
  seasons_in_div_one =
    COALESCE(
      (
        SELECT COUNT(DISTINCT l.season)
        FROM legacy_season_standings l
        WHERE l.manager_name = s.manager_name
          AND l.competition_type = 'league'
          AND l.season IS NOT NULL
          AND l.season <> '2026/27'
      ),
      0
    )
    + CASE WHEN s.current_division = 'division_one' THEN 1 ELSE 0 END,
  seasons_in_div_two =
    CASE WHEN s.current_division = 'division_two' THEN 1 ELSE 0 END,
  updated_at = NOW();

-- Season end (do not run until 2026/27 is finished):
-- Tenure already includes the current season. Apply promotions/relegations via
-- POST /admin/apply-season-end-division-stats with promoted/relegated names.
-- Increment tenure only at the start of the following season:
--   UPDATE all_time_manager_stats
--   SET seasons_in_div_one = seasons_in_div_one + 1
--   WHERE current_division = 'division_one';
--   UPDATE all_time_manager_stats
--   SET seasons_in_div_two = seasons_in_div_two + 1
--   WHERE current_division = 'division_two';
