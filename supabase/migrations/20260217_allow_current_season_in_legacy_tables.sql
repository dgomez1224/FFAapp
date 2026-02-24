-- Allow current and future seasons in legacy aggregate tables.
-- Existing check constraints in these tables can block writes for CURRENT_SEASON (e.g. 2025/26).

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.legacy_h2h_gameweek_results'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%season%'
      AND pg_get_constraintdef(oid) ILIKE '%2025/26%'
  LOOP
    EXECUTE format('ALTER TABLE public.legacy_h2h_gameweek_results DROP CONSTRAINT %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.legacy_h2h_stats'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%season%'
      AND pg_get_constraintdef(oid) ILIKE '%2025/26%'
  LOOP
    EXECUTE format('ALTER TABLE public.legacy_h2h_stats DROP CONSTRAINT %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.legacy_season_standings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%season%'
      AND pg_get_constraintdef(oid) ILIKE '%2025/26%'
  LOOP
    EXECUTE format('ALTER TABLE public.legacy_season_standings DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

