CREATE TABLE IF NOT EXISTS manager_media_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL UNIQUE,
  club_crest_url TEXT,
  club_logo_url TEXT,
  manager_profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE manager_media_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_media_profiles'
      AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access"
      ON manager_media_profiles
      FOR SELECT
      USING (true);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('manager-media', 'manager-media', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;
