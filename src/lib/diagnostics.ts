/**
 * Runtime diagnostics (DEV only). Run on app load to validate env and key endpoints.
 */

import { EDGE_FUNCTIONS_BASE } from "./constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";

export async function runDiagnostics(): Promise<void> {
  console.group("🚦 App Diagnostics");

  console.log("ENV SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL ? "(set)" : "(missing)");

  const base = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}`;
  const headers = getSupabaseFunctionHeaders();

  try {
    const liveRes = await fetch(`${base}/api/live?event=1`, { headers });
    console.log("Live API status:", liveRes.status);
  } catch (e) {
    console.error("Live API failed:", e);
  }

  try {
    const gobletRes = await fetch(`${base}/goblet-standings`, { headers });
    const gobletJson = await gobletRes.json();
    const standings = gobletJson?.standings ?? [];
    console.log("Goblet standings rows:", Array.isArray(standings) ? standings.length : "none");
  } catch (e) {
    console.error("Goblet endpoint failed:", e);
  }

  try {
    const matchupsRes = await fetch(`${base}/h2h-matchups`, { headers });
    const matchupsJson = await matchupsRes.json();
    const matchups = matchupsJson?.matchups ?? [];
    console.log("Latest Updates feed: built client-side from h2h-matchups + api/live + fixtures/matchup");
    console.log("H2H matchups count:", Array.isArray(matchups) ? matchups.length : "none");
    console.log("Rows missing event_time: N/A (event_time is set client-side on each update row)");
  } catch (e) {
    console.error("H2H matchups / Latest Updates feed check failed:", e);
  }

  console.groupEnd();
}
