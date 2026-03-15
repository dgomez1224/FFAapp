-- Enable pg_cron (run once; enable in Dashboard → Database → Extensions if needed).
-- Then run this in SQL Editor after replacing YOUR_SERVICE_ROLE_KEY with the value from
-- Supabase Dashboard → Settings → API → service_role (secret).

-- SELECT cron.schedule(
--   'score-cup-gameweeks',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/admin/score-cup-gameweek-auto',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- If you don't use app.settings, run the following and replace YOUR_SERVICE_ROLE_KEY manually:
/*
SELECT cron.schedule(
  'score-cup-gameweeks',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://flcewhvladymqgpjbtvo.supabase.co/functions/v1/server/admin/score-cup-gameweek-auto',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
*/

-- Note: Enable pg_cron and pg_net extensions in Dashboard → Database → Extensions first.
-- Then uncomment the block above, replace YOUR_SERVICE_ROLE_KEY, and run in SQL Editor.
