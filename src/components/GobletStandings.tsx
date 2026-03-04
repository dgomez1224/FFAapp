/**
 * Goblet Standings - Public Read-Only
 * 
 * Displays Goblet competition standings. Goblet is a round-based competition
 * with aggregate leaderboard tracking.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

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
  source: "database" | "derived" | "draft";
}

const BASELINE_KEY = "goblet_baseline_ranks";

export default function GobletStandings() {
  const [data, setData] = useState<GobletStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCrest } = useManagerCrestMap();

  useEffect(() => {
    async function fetchStandings() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/goblet-standings`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: GobletStandingsResponse = await res.json();

        if (!res.ok || (payload as any)?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch goblet standings");
        }

        const standings = payload?.standings || [];
        try {
          const stored = sessionStorage.getItem(BASELINE_KEY);
          if (!stored && standings.length > 0) {
            const initial: Record<string, number> = {};
            standings.forEach((s, index) => {
              if (s.manager_name) {
                initial[s.manager_name] = index + 1;
              }
            });
            sessionStorage.setItem(BASELINE_KEY, JSON.stringify(initial));
          }
        } catch {
          // Ignore sessionStorage errors (e.g. unavailable environment)
        }

        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load goblet standings");
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
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

  let baselineRanks: Record<string, number> = {};
  try {
    const stored = sessionStorage.getItem(BASELINE_KEY);
    baselineRanks = stored ? JSON.parse(stored) : {};
  } catch {
    baselineRanks = {};
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Goblet Standings</h1>
        <p className="text-sm text-muted-foreground">
          Ranked by points for. Data source: {data.source}
        </p>
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
              {data.standings.map((standing, index) => {
                const managerKey = standing.manager_name ?? "";
                const baselineRank =
                  managerKey && baselineRanks
                    ? baselineRanks[managerKey]
                    : undefined;
                const currentRank = index + 1;
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
