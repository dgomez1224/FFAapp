-- Update all_time_manager_stats table to match all_time_manager_stats_view columns
-- Then drop the view and update code to use the table

-- Create all_time_manager_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS all_time_manager_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_name TEXT NOT NULL UNIQUE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  points_plus INTEGER NOT NULL DEFAULT 0,
  points_per_game DECIMAL(5, 2),
  total_transactions INTEGER DEFAULT 0,
  league_titles INTEGER DEFAULT 0,
  cup_wins INTEGER DEFAULT 0,
  goblet_wins INTEGER DEFAULT 0,
  fifty_plus_weeks INTEGER DEFAULT 0,
  sub_twenty_weeks INTEGER DEFAULT 0,
  highest_gameweek INTEGER,
  lowest_gameweek INTEGER,
  largest_margin_win DECIMAL(5, 2),
  largest_margin_loss DECIMAL(5, 2),
  avg_margin_win DECIMAL(5, 2),
  avg_margin_loss DECIMAL(5, 2),
  longest_win_streak INTEGER,
  longest_loss_streak INTEGER,
  longest_undefeated_streak INTEGER,
  elo_rating DECIMAL(5, 2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT all_time_manager_stats_manager_name_check CHECK (
    manager_name = ANY (ARRAY[
      'PATRICK','MATT','MARCO','LENNART','CHRIS','IAN','HENRI','DAVID','MAX','BENJI'
    ])
  )
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add largest_margin_loss if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'all_time_manager_stats' 
    AND column_name = 'largest_margin_loss'
  ) THEN
    ALTER TABLE all_time_manager_stats ADD COLUMN largest_margin_loss DECIMAL(5, 2);
  END IF;

  -- Add most_points_gameweek if it doesn't exist (from view aggregation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'all_time_manager_stats' 
    AND column_name = 'most_points_gameweek'
  ) THEN
    ALTER TABLE all_time_manager_stats ADD COLUMN most_points_gameweek INTEGER;
  END IF;

  -- Add least_points_gameweek if it doesn't exist (from view aggregation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'all_time_manager_stats' 
    AND column_name = 'least_points_gameweek'
  ) THEN
    ALTER TABLE all_time_manager_stats ADD COLUMN least_points_gameweek INTEGER;
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_all_time_manager_stats_manager_name ON all_time_manager_stats(manager_name);
CREATE INDEX IF NOT EXISTS idx_all_time_manager_stats_total_points ON all_time_manager_stats(total_points DESC);

-- Enable RLS and create policy
DO $$
BEGIN
  ALTER TABLE all_time_manager_stats ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public read access" ON all_time_manager_stats;
  CREATE POLICY "Public read access" ON all_time_manager_stats FOR SELECT USING (true);
END $$;

-- Drop the view (after ensuring table has all columns)
DROP VIEW IF EXISTS all_time_manager_stats_view;
