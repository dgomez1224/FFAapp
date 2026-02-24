/**
 * H2H Standings - This Week Rivalry Records
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface RecordRow {
  wins: number;
  draws: number;
  losses: number;
}

interface H2HStandingsResponse {
  gameweek: number;
  latest_completed_gameweek: number | null;
  source: "database" | "draft";
  matchups: Array<{
    team_1_id: string;
    team_2_id: string;
    team_1: { entry_name: string | null; manager_name: string | null };
    team_2: { entry_name: string | null; manager_name: string | null };
    current_season_record_1: RecordRow;
    current_season_record_2: RecordRow;
    all_time_record_1: RecordRow;
    all_time_record_2: RecordRow;
  }>;
}

export default function H2HStandings() {
  const [data, setData] = useState<H2HStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStandings() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-rivalries`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: H2HStandingsResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch H2H rivalry records");
        }

        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load H2H rivalry records");
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">H2H Standings</h1>
        <p className="text-sm text-muted-foreground">Loading H2H records...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">H2H Standings</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.matchups.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">H2H Standings</h1>
        <p className="text-sm text-muted-foreground">No H2H matchup records available yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Head-to-Head Standings</h1>
        <p className="text-sm text-muted-foreground">
          This week&apos;s matchups with current season and all-time records. GW {data.gameweek}
        </p>
      </div>

      <div className="grid gap-3">
        {data.matchups.map((m, index) => {
          const left = m.team_1?.manager_name || m.team_1?.entry_name || "Manager 1";
          const right = m.team_2?.manager_name || m.team_2?.entry_name || "Manager 2";
          return (
            <Card key={`${m.team_1_id}-${m.team_2_id}-${index}`} className="p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <div className="text-right font-semibold">{left}</div>
                <div className="text-muted-foreground">vs</div>
                <div className="font-semibold">{right}</div>
              </div>
              <div className="mt-3 grid grid-cols-[80px_1fr_auto_1fr] items-center gap-2 text-sm">
                <div className="text-muted-foreground">Season</div>
                <div className="text-right">{m.current_season_record_1.wins} win{m.current_season_record_1.wins === 1 ? "" : "s"}</div>
                <div className="text-muted-foreground">{m.current_season_record_1.draws} draw{m.current_season_record_1.draws === 1 ? "" : "s"}</div>
                <div>{m.current_season_record_2.wins} win{m.current_season_record_2.wins === 1 ? "" : "s"}</div>
                <div className="text-muted-foreground">All-Time</div>
                <div className="text-right">{m.all_time_record_1.wins} win{m.all_time_record_1.wins === 1 ? "" : "s"}</div>
                <div className="text-muted-foreground">{m.all_time_record_1.draws} draw{m.all_time_record_1.draws === 1 ? "" : "s"}</div>
                <div>{m.all_time_record_2.wins} win{m.all_time_record_2.wins === 1 ? "" : "s"}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
