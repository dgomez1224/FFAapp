-- One row per (tournament, round label, matchup slot) so concurrent bracket GETs cannot duplicate seeds.
-- Safe to apply if no duplicate (tournament_id, round, matchup_number) rows exist yet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_matchups_tournament_round_matchup_number
  ON matchups (tournament_id, round, matchup_number);
