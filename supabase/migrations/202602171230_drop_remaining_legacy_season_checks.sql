-- Drop remaining season-bound check constraints that can block CURRENT_SEASON writes.
-- Targets legacy_season_standings explicitly.

DO $$
DECLARE
  rec RECORD;
  def TEXT;
BEGIN
  FOR rec IN
    SELECT conname, oid
    FROM pg_constraint
    WHERE conrelid = 'public.legacy_season_standings'::regclass
      AND contype = 'c'
  LOOP
    def := pg_get_constraintdef(rec.oid);
    IF def ILIKE '%season%' AND (def ILIKE '%<%' OR def ILIKE '%2025/26%') THEN
      EXECUTE format('ALTER TABLE public.legacy_season_standings DROP CONSTRAINT %I', rec.conname);
    END IF;
  END LOOP;
END $$;

