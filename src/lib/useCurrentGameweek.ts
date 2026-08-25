import { useEffect, useState } from "react";
import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";

export function useCurrentGameweek() {
  const [currentGameweek, setCurrentGameweek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() },
        );
        if (!res.ok) return;
        const payload = await res.json();
        const gw = Number(payload?.current_gameweek || 1);
        if (!cancelled && Number.isFinite(gw) && gw > 0) setCurrentGameweek(gw);
      } catch {
        // Keep the conservative default (GW 1) so cup features stay hidden.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { currentGameweek, loading };
}
