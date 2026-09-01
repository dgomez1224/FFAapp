/**
 * Static 2025/26 Bench Boost Cup results.
 * Knockout comes from the BracketHQ embed; group stage is the 10-team field
 * that produced those eight seeds (top eight advanced).
 */

export type LegacyCupRound = "Quarter-Final" | "Semi-Final" | "Final" | "Third Place";

export type LegacyCupParticipant = {
  seed: number | null;
  team_name: string;
  manager_name: string;
  advanced: boolean;
};

export type LegacyCupMatch = {
  round: LegacyCupRound;
  home_team: string;
  away_team: string;
  home_manager: string;
  away_manager: string;
  winner: string;
  match_order: number;
};

export const LEGACY_FFA_CUP_2025_EMBED = "https://brackethq.com/b/hmogd/embed/";
export const LEGACY_FFA_CUP_2025_CHAMPION_TEAM = "Wirtz. Name. Ever.FC";
export const LEGACY_FFA_CUP_2025_CHAMPION_MANAGER = "DAVID";

export const LEGACY_FFA_CUP_2025_PARTICIPANTS: LegacyCupParticipant[] = [
  { seed: 1, team_name: "Ebb's and Flo's", manager_name: "PATRICK", advanced: true },
  { seed: 2, team_name: "Wirtz. Name. Ever.FC", manager_name: "DAVID", advanced: true },
  { seed: 3, team_name: "FLY EMIRATES", manager_name: "HENRI", advanced: true },
  { seed: 4, team_name: "Sloppy Steaks", manager_name: "MARCO", advanced: true },
  { seed: 5, team_name: "WritzTaMère", manager_name: "LENNART", advanced: true },
  { seed: 6, team_name: "Creamer (Pause) FC", manager_name: "BENJI", advanced: true },
  { seed: 7, team_name: "Cunha believe it", manager_name: "MAX", advanced: true },
  { seed: 8, team_name: "Change Name", manager_name: "IAN", advanced: true },
  { seed: null, team_name: "GyokGyok 3000", manager_name: "CHRIS", advanced: false },
  { seed: null, team_name: "Lokomotiv Gargantuan", manager_name: "MATT", advanced: false },
];

export const LEGACY_FFA_CUP_2025_MATCHES: LegacyCupMatch[] = [
  {
    round: "Quarter-Final",
    home_team: "Ebb's and Flo's",
    away_team: "Change Name",
    home_manager: "PATRICK",
    away_manager: "IAN",
    winner: "Ebb's and Flo's",
    match_order: 1,
  },
  {
    round: "Quarter-Final",
    home_team: "Sloppy Steaks",
    away_team: "WritzTaMère",
    home_manager: "MARCO",
    away_manager: "LENNART",
    winner: "Sloppy Steaks",
    match_order: 2,
  },
  {
    round: "Quarter-Final",
    home_team: "FLY EMIRATES",
    away_team: "Creamer (Pause) FC",
    home_manager: "HENRI",
    away_manager: "BENJI",
    winner: "FLY EMIRATES",
    match_order: 3,
  },
  {
    round: "Quarter-Final",
    home_team: "Wirtz. Name. Ever.FC",
    away_team: "Cunha believe it",
    home_manager: "DAVID",
    away_manager: "MAX",
    winner: "Wirtz. Name. Ever.FC",
    match_order: 4,
  },
  {
    round: "Semi-Final",
    home_team: "Ebb's and Flo's",
    away_team: "Sloppy Steaks",
    home_manager: "PATRICK",
    away_manager: "MARCO",
    winner: "Ebb's and Flo's",
    match_order: 5,
  },
  {
    round: "Semi-Final",
    home_team: "FLY EMIRATES",
    away_team: "Wirtz. Name. Ever.FC",
    home_manager: "HENRI",
    away_manager: "DAVID",
    winner: "Wirtz. Name. Ever.FC",
    match_order: 6,
  },
  {
    round: "Final",
    home_team: "Ebb's and Flo's",
    away_team: "Wirtz. Name. Ever.FC",
    home_manager: "PATRICK",
    away_manager: "DAVID",
    winner: "Wirtz. Name. Ever.FC",
    match_order: 7,
  },
  {
    round: "Third Place",
    home_team: "Sloppy Steaks",
    away_team: "FLY EMIRATES",
    home_manager: "MARCO",
    away_manager: "HENRI",
    winner: "FLY EMIRATES",
    match_order: 8,
  },
];

export const LEGACY_FFA_CUP_2025_ROUNDS: LegacyCupRound[] = [
  "Quarter-Final",
  "Semi-Final",
  "Final",
  "Third Place",
];
