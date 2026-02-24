/**
 * League Standings - Public Read-Only
 * 
 * Displays the main FPL league standings based on the static entry ID.
 * Shows all managers, teams, and points in a public table.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface Standing {
  team_id: string;
  rank: number;
  manager_name?: string;
  entry_name?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  points_for: number;
  points_against: number;
}

interface LeagueStandingsResponse {
  standings: Standing[];
  source: "database" | "draft" | "classic";
}

export default function LeagueStandings() {
  const [data, setData] = useState<LeagueStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStandings() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: LeagueStandingsResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch league standings");
        }

        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load league standings");
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-muted-foreground">Loading standings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League Standings</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">League Standings</h1>
        <p className="text-sm text-muted-foreground">Ranked by league points, then points for.</p>
      </div>

      <Card className="p-4">
        <div className="fpl-table-container">
          <Table>
            <TableHeader>
              <TableRow className="fpl-table-header">
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">P</TableHead>
              <TableHead className="text-right">W</TableHead>
              <TableHead className="text-right">D</TableHead>
              <TableHead className="text-right">L</TableHead>
              <TableHead className="text-right">Pts</TableHead>
              <TableHead className="text-right">For</TableHead>
              <TableHead className="text-right">Against</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="fpl-table-body">
              {data.standings.map((standing) => (
                <TableRow key={standing.team_id}>
                  <TableCell className="fpl-rank text-center">{standing.rank}</TableCell>
                  <TableCell className="fpl-manager-name">{standing.manager_name || "—"}</TableCell>
                  <TableCell className="fpl-manager-name">{standing.entry_name || "—"}</TableCell>
                  <TableCell className="fpl-numeric">{standing.played}</TableCell>
                  <TableCell className="fpl-numeric">{standing.wins}</TableCell>
                  <TableCell className="fpl-numeric">{standing.draws}</TableCell>
                  <TableCell className="fpl-numeric">{standing.losses}</TableCell>
                  <TableCell className="fpl-points">{standing.points}</TableCell>
                  <TableCell className="fpl-numeric">{standing.points_for}</TableCell>
                  <TableCell className="fpl-numeric">{standing.points_against}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
