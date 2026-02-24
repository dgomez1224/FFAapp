-- Database Check Queries
-- Run these in Supabase Dashboard → SQL Editor

-- Check teams count
SELECT COUNT(*) as team_count FROM teams;

-- Check season_state for 2025/26
SELECT * FROM season_state WHERE season = '2025/26';

-- Check gameweek_scores count
SELECT COUNT(*) as gameweek_scores_count FROM gameweek_scores;

-- Check manager_aliases
SELECT COUNT(*) as manager_aliases_count FROM manager_aliases;

-- Check if seed data exists
SELECT 
  (SELECT COUNT(*) FROM teams) as teams,
  (SELECT COUNT(*) FROM season_state) as season_states,
  (SELECT COUNT(*) FROM gameweek_scores) as gameweek_scores,
  (SELECT COUNT(*) FROM manager_aliases) as manager_aliases;
