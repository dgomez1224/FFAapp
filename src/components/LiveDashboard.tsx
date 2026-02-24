/**
 * Live Dashboard - Public Read-Only Mode
 * 
 * Displays live gameweek scores for all teams in the league.
 * No authentication required - uses static entry ID to resolve league context.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { useTournamentContext } from "../lib/tournamentContext";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface LiveScoreRow {
  id: string;
  team_id: string;
  gameweek: number;
  total_points: number;
  captain_points: number | null;
  bench_points: number | null;
  teams: {
    entry_name: string;
    manager_name: string;
    manager_short_name: string;
    seed: number | null;
  } | null;
}

export function LiveDashboard() {
  const { currentGameweek, loading: contextLoading, error: contextError } = useTournamentContext();
  const [rows, setRows] = useState<LiveScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contextLoading || !currentGameweek) return;

    async function loadInitial() {
      setLoading(true);
      setError(null);

      const functionsBase = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}`;
      const url = `${functionsBase}/live-scores/${currentGameweek}`;
      
      try {
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();

        if (!res.ok || payload?.error) {
          setError(
            payload?.error?.message ??
              "Unable to load live scores. Please try again.",
          );
          setLoading(false);
          return;
        }

        setRows(payload.scores ?? []);
      } catch (err: any) {
        setError(err.message || "Failed to load live scores");
      } finally {
        setLoading(false);
      }
    }

    loadInitial();

    // Set up polling instead of realtime (since we're in public mode)
    const interval = setInterval(loadInitial, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [currentGameweek, contextLoading]);

  if (contextLoading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Live scores</h1>
        <p className="text-sm text-muted-foreground">Loading league context...</p>
      </Card>
    );
  }

  if (contextError) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Live scores</h1>
        <p className="text-sm text-destructive">{contextError}</p>
      </Card>
    );
  }

  if (!currentGameweek) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Live scores</h1>
        <p className="text-sm text-muted-foreground">
          Unable to determine current gameweek.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live scores</h1>
          <p className="text-sm text-muted-foreground">
            Real-time standings for gameweek {currentGameweek}.
          </p>
        </div>
      </div>

      <Card className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading live scores…
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Captain pts</TableHead>
                <TableHead className="text-right">Bench pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No scores available for this gameweek yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      {row.teams?.manager_name ?? row.teams?.manager_short_name ?? "Unknown"}
                    </TableCell>
                    <TableCell>{row.teams?.entry_name ?? row.team_id}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.total_points}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.captain_points ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.bench_points ?? "–"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
