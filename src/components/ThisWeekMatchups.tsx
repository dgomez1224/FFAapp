/**
 * This Week's Matchups - Public Read-Only
 * Updated with centered manager names and improved formatting
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { Card } from "./ui/card";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

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
  const { getCrest } = useManagerCrestMap();

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
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-muted-foreground">Loading matchups…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.matchups.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">This Week's Matchups</h1>
        <p className="text-sm text-muted-foreground">No matchups available yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">This Week's Matchups</h2>
        <p className="text-sm text-muted-foreground">Gameweek {data.gameweek}</p>
      </div>
      <div className="space-y-3">
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
              className="block w-full rounded-md border p-4 text-foreground no-underline transition-colors hover:bg-muted/40 hover:no-underline visited:text-foreground"
            >
              {/* Team names and entry names */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-3">
                <div className="text-center">
                  <div className="font-semibold text-sm mb-1 inline-flex items-center justify-center gap-1">
                    {getCrest(m.team_1?.manager_name) ? (
                      <img
                        src={getCrest(m.team_1?.manager_name)!}
                        alt=""
                        className="h-4 w-4 rounded object-cover border"
                      />
                    ) : null}
                    <span>{m.team_1?.entry_name || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.team_1?.manager_name || "—"}</div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-20 text-center">
                    <div className="text-3xl font-bold leading-none">
                      <span>{m.team_1_points}</span>
                      <span className="mx-1">-</span>
                      <span>{m.team_2_points}</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-sm mb-1 inline-flex items-center justify-center gap-1">
                    {getCrest(m.team_2?.manager_name) ? (
                      <img
                        src={getCrest(m.team_2?.manager_name)!}
                        alt=""
                        className="h-4 w-4 rounded object-cover border"
                      />
                    ) : null}
                    <span>{m.team_2?.entry_name || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.team_2?.manager_name || "—"}</div>
                </div>
              </div>

              {/* Win records */}
              <div className="space-y-1 text-xs border-t pt-2">
                <div className="grid grid-cols-[6rem_1fr_auto_1fr] gap-2 items-center">
                  <span className="text-muted-foreground font-medium">Season:</span>
                  <div className="text-center font-medium">{season1Wins}W</div>
                  <div className="text-center text-muted-foreground">{seasonDraws}D</div>
                  <div className="text-center font-medium">{season2Wins}W</div>
                </div>
                <div className="grid grid-cols-[6rem_1fr_auto_1fr] gap-2 items-center">
                  <span className="text-muted-foreground font-medium">All-Time:</span>
                  <div className="text-center font-medium">{allTime1Wins}W</div>
                  <div className="text-center text-muted-foreground">{allTimeDraws}D</div>
                  <div className="text-center font-medium">{allTime2Wins}W</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
