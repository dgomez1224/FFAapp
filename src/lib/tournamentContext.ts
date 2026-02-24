/**
 * Tournament Context - Public Read-Only Mode
 * 
 * This context provides league and tournament data using the static entry ID.
 * No authentication or localStorage is required - all data is derived from
 * the static entry ID (164475).
 * 
 * All components should use this context to access league information.
 */

import { useMemo, useState, useEffect } from "react";
import { STATIC_ENTRY_ID } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "./constants";

export interface TournamentContext {
  entryId: string;
  leagueId: string | null;
  leagueName: string | null;
  currentGameweek: number;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to access tournament context in public read-only mode.
 * Automatically resolves league context from the static entry ID.
 */
export function useTournamentContext(): TournamentContext {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContext() {
      try {
        setLoading(true);
        setError(null);

        // Fetch current gameweek
        const gwRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() }
        );
        if (gwRes.ok) {
          const gwData = await gwRes.json();
          setCurrentGameweek(gwData.current_gameweek || 1);
        }

        // Fetch league standings to get league info
        const standingsRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-standings`,
          { headers: getSupabaseFunctionHeaders() }
        );
        if (standingsRes.ok) {
          const standingsData = await standingsRes.json();
          setLeagueId(standingsData.leagueId || null);
          setLeagueName(standingsData.leagueName || null);
        } else {
          throw new Error("Failed to load league context");
        }
      } catch (err: any) {
        console.error("Failed to load tournament context:", err);
        setError(err.message || "Failed to load league data");
      } finally {
        setLoading(false);
      }
    }

    loadContext();
  }, []);

  return useMemo(
    () => ({
      entryId: STATIC_ENTRY_ID,
      leagueId,
      leagueName,
      currentGameweek,
      loading,
      error,
    }),
    [leagueId, leagueName, currentGameweek, loading, error]
  );
}
