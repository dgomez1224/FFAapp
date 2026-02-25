/**
 * Cup Group Stage - Public Read-Only
 * 
 * Displays cup group stage standings with all 10 league members
 * automatically registered. No user registration required.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

interface CupStanding {
  team_id: string;
  entry_name: string;
  manager_name: string;
  manager_short_name: string;
  total_points: number;
  captain_points: number;
  played: number;
  wins?: number;
  draws?: number;
  losses?: number;
  plus?: number;
  rank: number;
}

interface CupGroupStageResponse {
  registeredCount: number;
  standings: CupStanding[];
  autoRegistered: boolean;
}

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function CupGroupStage() {
  const [data, setData] = useState<CupGroupStageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCrest } = useManagerCrestMap();

  const fetchStandings = async () => {
    try {
      setError(null);
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/cup-group-stage`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload: CupGroupStageResponse = await res.json();

      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch cup standings");
      }

      setData(payload);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    const interval = setInterval(fetchStandings, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Determine advancing threshold (top 80%)
  const advancingCount = data && data.standings.length > 0 ? Math.ceil(data.standings.length * 0.8) : 0;
  const hasStandings = data && data.standings.length > 0;
  const standings = data?.standings || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Cup Group Stage</h1>
        <p className="text-sm text-muted-foreground">
          {data ? (
            <>
              All {data.registeredCount} league members are automatically registered.
              {hasStandings && ` Top ${advancingCount} advance.`}
            </>
          ) : (
            "All league members are automatically registered."
          )}
        </p>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm text-destructive">Error: {error}</p>
        </Card>
      )}

      <Card className="p-4">
        {loading && standings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Loading group stage standings…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">D</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">+</TableHead>
                <TableHead className="text-right">Total Points</TableHead>
                <TableHead className="text-right">Captain Points</TableHead>
                <TableHead className="text-right">Played</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.length > 0 ? (
                standings.map((team) => {
                  const advancing = hasStandings && team.rank <= advancingCount;
                  return (
                    <TableRow
                      key={team.team_id || team.manager_name}
                      className={advancing ? "bg-green-50 dark:bg-green-950/40 font-semibold" : ""}
                    >
                      <TableCell>{team.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getCrest(team.manager_name) ? (
                            <img
                              src={getCrest(team.manager_name)!}
                              alt=""
                              className="h-4 w-4 rounded object-cover border"
                            />
                          ) : null}
                          <span>{team.entry_name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{team.manager_name}</TableCell>
                      <TableCell className="text-right">{team.wins ?? 0}</TableCell>
                      <TableCell className="text-right">{team.draws ?? 0}</TableCell>
                      <TableCell className="text-right">{team.losses ?? 0}</TableCell>
                      <TableCell className="text-right">{team.plus ?? 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        {team.total_points}
                      </TableCell>
                      <TableCell className="text-right">{team.captain_points}</TableCell>
                      <TableCell className="text-right">{team.played}</TableCell>
                      <TableCell className="text-center">
                        {hasStandings ? (
                          advancing ? (
                            <span className="text-green-600 dark:text-green-400">Advancing</span>
                          ) : (
                            <span className="text-muted-foreground">Eliminated</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading..." : "No league members found in database."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
