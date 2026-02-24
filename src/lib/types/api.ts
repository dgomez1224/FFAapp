/**
 * API Response Types
 * 
 * Type definitions for all API endpoints used in the live matchups feature.
 */

export interface ContextResponse {
  entryId: string;
  currentEvent: number;
  leagues: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  bootstrapVersion: string | null;
  season: string;
}

export interface LiveElement {
  element: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    influence: number;
    creativity: number;
    threat: number;
    ict_index: number;
    starts: number;
    expected_goals: number;
    expected_assists: number;
    expected_goal_involvements: number;
    expected_goals_conceded: number;
    total_points: number;
  };
  explain: Array<{
    name: string;
    points: number;
    value: number;
  }>;
}

export interface LiveFixture {
  id: number;
  started: boolean;
  finished: boolean;
  elapsed: number;
  team_h: number;
  team_a: number;
}

export interface LiveDataResponse {
  event: number;
  elements: LiveElement[];
  fixtures: LiveFixture[];
  timestamp: string;
}

export interface PickResponse {
  element: number;
  position: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
}

export interface EntryPicksResponse {
  entryId: string;
  event: number;
  picks: PickResponse[];
  entry_name: string | null;
}

export interface H2HMatchup {
  entry_1: number;
  entry_1_name: string;
  entry_2: number;
  entry_2_name: string;
  picks_1: PickResponse[];
  picks_2: PickResponse[];
}

export interface H2HResponse {
  entryId: string;
  event: number;
  leagueId: number;
  matchups: H2HMatchup[];
}
