-- Add vice captain support for cup captain selections.
ALTER TABLE cup_captain_selections
  ADD COLUMN IF NOT EXISTS vice_captain_player_id INTEGER,
  ADD COLUMN IF NOT EXISTS vice_captain_name TEXT;
