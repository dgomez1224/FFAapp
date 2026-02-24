/**
 * This Week's Matchups - Public Read-Only
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { Card } from "./ui/card";

interface MatchupRow {
  fixture_id?: string;
  team_1_id: string;
  team_2_id: string;
  gameweek?: number;
  team_1_points: number;
  team_2_points: number;
  team_1_rank?: number | null;
  team_2_rank?: number | null;
  winner_id: string | null;
  team_1: { entry_name: string; manager_name: string } | null;
  team_2: { entry_name: string; manager_name: string } | null;
}

interface MatchupsResponse {
  gameweek: number;
  matchups: MatchupRow[];
}

interface RecordRow {
  wins: number;
  draws: number;
  losses: number;
}

interface H2HStandingsResponse {
  gameweek: number;
  matchups: Array<{
    team_1_id: string;
    team_2_id: string;
    current_season_record_1: RecordRow;
    current_season_record_2: RecordRow;
    all_time_record_1: RecordRow;
    all_time_record_2: RecordRow;
  }>;
}

export function ThisWeekMatchups() {
  const [data, setData] = useState<MatchupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatchups() {
      try {
        setLoading(true);
        setError(null);
        const [matchupsRes, rivalriesRes] = await Promise.all([
          fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups`, { headers: getSupabaseFunctionHeaders() }),
          fetch(`${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-rivalries`, { headers: getSupabaseFunctionHeaders() }),
        ]);
        const payload: MatchupsResponse = await matchupsRes.json();
        const rivalryPayload: H2HStandingsResponse = await rivalriesRes.json();
        if (!matchupsRes.ok || (payload as any)?.error) {
          throw new Error((payload as any)?.error?.message || "Failed to fetch matchups");
        }
        if (!rivalriesRes.ok || (rivalryPayload as any)?.error) {
          throw new Error((rivalryPayload as any)?.error?.message || "Failed to fetch rivalry data");
        }

        const rivalryMap: Record<string, any> = {};
        (rivalryPayload.matchups || []).forEach((m) => {
          rivalryMap[`${m.team_1_id}__${m.team_2_id}`] = m;
          rivalryMap[`${m.team_2_id}__${m.team_1_id}`] = {
            ...m,
            current_season_record_1: m.current_season_record_2,
            current_season_record_2: m.current_season_record_1,
            all_time_record_1: m.all_time_record_2,
            all_time_record_2: m.all_time_record_1,
          };
        });

        const merged: MatchupsResponse = {
          ...payload,
          matchups: (payload.matchups || []).map((m) => ({
            ...m,
            rivalry: rivalryMap[`${m.team_1_id}__${m.team_2_id}`] || null,
          })),
        } as any;
        setData(merged);
      } catch (err: any) {
        setError(err.message || "Failed to load matchups");
      } finally {
        setLoading(false);
      }
    }

    loadMatchups();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week’s Matchups</h1>
        <p className="text-sm text-muted-foreground">Loading matchups…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week’s Matchups</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.matchups.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week’s Matchups</h1>
        <p className="text-sm text-muted-foreground">No matchups available yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">This Week’s Matchups</h2>
        <p className="text-sm text-muted-foreground">Gameweek {data.gameweek}</p>
      </div>
      <div className="space-y-2">
        {data.matchups.map((m, idx) => {
          const href = `/matchup/league/${m.gameweek || data.gameweek}/${m.team_1_id}/${m.team_2_id}`;
          const rivalry = (m as any).rivalry;
          const season1Wins = rivalry?.current_season_record_1?.wins ?? "—";
          const seasonDraws = rivalry?.current_season_record_1?.draws ?? "—";
          const season2Wins = rivalry?.current_season_record_2?.wins ?? "—";
          const allTime1Wins = rivalry?.all_time_record_1?.wins ?? "—";
          const allTimeDraws = rivalry?.all_time_record_1?.draws ?? "—";
          const allTime2Wins = rivalry?.all_time_record_2?.wins ?? "—";

          return (
            <Link
              key={`${m.team_1_id}-${m.team_2_id}-${idx}`}
              to={href}
              className="block w-full rounded-md border p-3 text-foreground no-underline transition-colors hover:bg-muted/40 hover:no-underline visited:text-foreground"
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-base font-medium">
                <div className="min-w-0 truncate text-right">
                  {m.team_1?.entry_name || "—"}
                </div>
                <div className="shrink-0 text-center text-2xl leading-none">
                  {m.team_1_points} - {m.team_2_points}
                </div>
                <div className="min-w-0 truncate">
                  {m.team_2?.entry_name || "—"}
                </div>
              </div>

              <div className="mt-1 grid grid-cols-[1fr_1fr] items-center gap-2 text-sm">
                <div className="truncate text-right">{m.team_1?.manager_name || "—"}</div>
                <div className="truncate">{m.team_2?.manager_name || "—"}</div>
              </div>

              <div className="mt-2 space-y-1 text-base leading-tight">
                <div className="grid grid-cols-[7rem_1fr_auto_1fr] items-center gap-2">
                  <div className="text-right">Season:</div>
                  <div className="text-right">{season1Wins} wins</div>
                  <div>{seasonDraws} draws</div>
                  <div>{season2Wins} wins</div>
                </div>
                <div className="grid grid-cols-[7rem_1fr_auto_1fr] items-center gap-2">
                  <div className="text-right">All-Time:</div>
                  <div className="text-right">{allTime1Wins} wins</div>
                  <div>{allTimeDraws} draws</div>
                  <div>{allTime2Wins} wins</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
