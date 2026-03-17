/**
 * Goblet Standings - Public Read-Only
 * 
 * Displays Goblet competition standings. Goblet is a round-based competition
 * with aggregate leaderboard tracking.
 */

import React, { useEffect, useRef, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import gobletTrophy from "../assets/trophies/Goblet Icon.png";

interface GobletStanding {
  team_id: string;
  entry_name?: string;
  manager_name?: string;
  points_for?: number;
  total_points: number;
  rank: number;
}

interface GobletStandingsResponse {
  standings: GobletStanding[];
  baseline_standings?: GobletStanding[];
  source: "database" | "derived" | "draft";
}

export default function GobletStandings() {
  const [data, setData] = useState<GobletStandingsResponse | null>(null);
  const [liveStandings, setLiveStandings] = useState<GobletStanding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baselineRanksRef = useRef<Record<string, number> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getCrest } = useManagerCrestMap();

  const handleRefresh = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    window.location.reload();
  };

  useEffect(() => {
    let eventFinished = true;
    async function fetchStandings(): Promise<boolean> {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/goblet-standings`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        let payload: GobletStandingsResponse = await res.json();

        if (!res.ok || (payload as any)?.error) {
          const errPayload = (payload as any)?.error;
          throw new Error(errPayload?.message || "Failed to fetch goblet standings");
        }

        // Always recompute baseline from stored database standings
        // Prefer server-provided baseline_standings when available,
        // otherwise derive from current standings.
        const baselineSource =
          (payload as any).baseline_standings && (payload as any).baseline_standings.length
            ? (payload as any).baseline_standings
            : payload?.standings;

        if (baselineSource?.length) {
          const sorted = [...baselineSource].sort((a: any, b: any) => {
            const apts = a.points_for ?? a.total_points ?? 0;
            const bpts = b.points_for ?? b.total_points ?? 0;
            return bpts - apts;
          });
          const initial: Record<string, number> = {};
          sorted.forEach((s: any, index: number) => {
            const key = String(s.entry_id ?? s.team_id ?? "");
            if (!key) return;
            initial[key] = index + 1;
          });
          baselineRanksRef.current = initial;
        }

        // Overlay real names and compute live standings from h2h-matchups league entries / teams.
        try {
          const matchupsRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-matchups`,
            { headers: getSupabaseFunctionHeaders() },
          );
          if (matchupsRes.ok) {
            const matchupsJson: any = await matchupsRes.json();
            const matchups: any[] = Array.isArray(matchupsJson?.matchups)
              ? matchupsJson.matchups
              : [];

            const nameByTeamId: Record<string, { entry_name: string; manager_name: string }> = {};
            const nameByEntryId: Record<string, { entry_name: string; manager_name: string }> = {};

            matchups.forEach((m: any) => {
              const t1 = m.team_1 || null;
              const t2 = m.team_2 || null;
              const team1Id = String(m.team_1_id ?? "");
              const team2Id = String(m.team_2_id ?? "");
              const team1EntryId = String(m.team_1_entry_id ?? "").trim();
              const team2EntryId = String(m.team_2_entry_id ?? "").trim();

              if (team1Id && t1) {
                nameByTeamId[team1Id] = {
                  entry_name: t1.entry_name ?? team1Id,
                  manager_name: t1.manager_name ?? team1Id,
                };
              }
              if (team2Id && t2) {
                nameByTeamId[team2Id] = {
                  entry_name: t2.entry_name ?? team2Id,
                  manager_name: t2.manager_name ?? team2Id,
                };
              }
              if (team1EntryId && t1) {
                nameByEntryId[team1EntryId] = {
                  entry_name: t1.entry_name ?? team1EntryId,
                  manager_name: t1.manager_name ?? team1EntryId,
                };
              }
              if (team2EntryId && t2) {
                nameByEntryId[team2EntryId] = {
                  entry_name: t2.entry_name ?? team2EntryId,
                  manager_name: t2.manager_name ?? team2EntryId,
                };
              }
            });

            if (
              (Object.keys(nameByEntryId).length > 0 ||
                Object.keys(nameByTeamId).length > 0) &&
              Array.isArray(payload.standings) &&
              payload.standings.length
            ) {
              const overlaid = (payload.standings || []).map((s: any) => {
                const teamId = String(s.team_id ?? "");
                const entryId = String(s.entry_id ?? "");
                const fromEntry = entryId ? nameByEntryId[entryId] : undefined;
                const fromTeam = teamId ? nameByTeamId[teamId] : undefined;
                const names = fromEntry || fromTeam || null;
                return names ? { ...s, ...names } : s;
              });
              payload = { ...payload, standings: overlaid };
            }

            // Use server standings as-is for points (no client-side live add).
            // League standings already reflect live; goblet shows same source of truth.
            setLiveStandings(null);
          }
        } catch {
          // Non-fatal: fall back to database names and baseline-only view.
          setLiveStandings(null);
        }

        setData(payload);

        try {
          const gwRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
            { headers: getSupabaseFunctionHeaders() }
          );
          const gwData = gwRes.ok ? await gwRes.json() : null;
          eventFinished = gwData?.event_finished === true || gwData?.current_event_finished === true;
        } catch {
          // default eventFinished stays true (no polling)
        }
      } catch (err: any) {
        setError(err.message || "Failed to load goblet standings");
      } finally {
        setLoading(false);
      }
      return eventFinished;
    }

    fetchStandings().then((eventFinished) => {
      if (!eventFinished) {
        pollingIntervalRef.current = setInterval(fetchStandings, 300_000);
      }
    });
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Goblet Standings</h1>
        <p className="text-sm text-muted-foreground">Loading goblet standings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Goblet Standings</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.standings.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Goblet Standings</h1>
        <p className="text-sm text-muted-foreground">No goblet data available yet.</p>
      </Card>
    );
  }

  const baselineRanks = baselineRanksRef.current ?? {};
  const rawRows = liveStandings ?? data.standings;
  const pointsFor = (s: GobletStanding) => s.points_for ?? s.total_points ?? 0;
  const rowsToRender = [...rawRows]
    .sort((a, b) => pointsFor(b) - pointsFor(a))
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={gobletTrophy} alt="" className="h-10 w-10 object-contain" aria-hidden />
          <div>
            <h1 className="font-heading text-2xl font-semibold">Goblet Standings</h1>
            <p className="text-sm text-muted-foreground">
              Ranked by points for. Data source: {data.source}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 flex items-center gap-1"
        >
          ↻ Refresh
        </button>
      </div>

      <Card className="p-4">
        <div className="fpl-table-container">
          <Table>
            <TableHeader>
              <TableRow className="fpl-table-header">
                <TableHead className="w-12">Rank</TableHead>
                <TableHead className="w-10 text-center">±</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Points For</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="fpl-table-body">
              {rowsToRender.map((standing, index) => {
                const stableKey = String((standing as any).entry_id ?? standing.team_id ?? "");
                const baselineRank =
                  stableKey && baselineRanks ? baselineRanks[stableKey] : undefined;
                const currentRank = standing.rank;
                const moved =
                  baselineRank != null ? baselineRank - currentRank : 0;
                const arrow =
                  moved > 0
                    ? `↑${moved}`
                    : moved < 0
                    ? `↓${Math.abs(moved)}`
                    : "—";
                const arrowColor =
                  moved > 0
                    ? "text-emerald-500 font-semibold"
                    : moved < 0
                    ? "text-red-500 font-semibold"
                    : "text-muted-foreground";

                return (
                  <TableRow key={standing.team_id}>
                    <TableCell className="fpl-rank text-center">{standing.rank}</TableCell>
                    <TableCell className={`text-center ${arrowColor}`}>{arrow}</TableCell>
                  <TableCell className="fpl-manager-name">
                    <div className="flex items-center gap-2">
                      {getCrest(standing.manager_name) ? (
                        <img
                          src={getCrest(standing.manager_name)!}
                          alt=""
                          className="h-4 w-4 rounded object-cover border"
                        />
                      ) : null}
                      <span>{standing.entry_name || standing.team_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="fpl-manager-name">{standing.manager_name || "–"}</TableCell>
                  <TableCell className="fpl-points">{standing.points_for ?? standing.total_points}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
