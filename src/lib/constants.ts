/**
 * Public Read-Only Mode Constants
 * 
 * This file defines the static entry ID that serves as the single source of truth
 * for all league data in public mode. This value is never user-provided, never
 * stored in localStorage, and never derived from auth/session state.
 * 
 * All public endpoints and components should use this constant to resolve
 * league context and fetch associated data.
 * 
 * NOTE: The STATIC_ENTRY_ID (164475) is David's entry ID for the current season.
 * Manager aliases are stored in the manager_aliases table and map entry IDs to
 * canonical manager names. See supabase/migrations/20260127_update_manager_aliases.sql
 * for the current mappings (Patrick: 148669, David: 164475).
 */
export const STATIC_ENTRY_ID = "164475";

/**
 * FPL API Base URL
 */
export const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

/**
 * Supabase Edge Functions Base Path
 * This is the base path for all public read-only endpoints
 */
export const EDGE_FUNCTIONS_BASE =
  import.meta.env.VITE_EDGE_FUNCTIONS_BASE || "/server";

/**
 * Season Cutoff for Automatic Historical Stats
 * 
 * Seasons before 2025/26 are treated as legacy data (CSV imports only).
 * Starting with 2025/26, all historical stats are automatically generated
 * and persisted weekly from live FPL data.
 * 
 * CRITICAL: This cutoff must be enforced in all data processing logic.
 */
export const HISTORICAL_STATS_CUTOFF_SEASON = "2025/26";

/**
 * Current Season
 * Used to determine if data should be auto-computed or loaded from CSV
 */
export const CURRENT_SEASON = "2025/26";

/**
 * Flourish Embed IDs for Standings by Gameweek
 * These are the embed IDs provided for gameweek standings visualizations
 */
export const FLOURISH_EMBED_IDS = [
  "26707472",
  "23015586",
  "17184960",
  "10850560",
  "8292967",
] as const;
