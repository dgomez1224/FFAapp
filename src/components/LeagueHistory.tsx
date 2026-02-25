/**
 * League History - Public Read-Only
 * 
 * Displays historical league data combining:
 * - Legacy CSV imports (seasons < 2025/26)
 * - Computed data (seasons >= 2025/26)
 * 
 * Shows past seasons, final standings, awards, and records.
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE, HISTORICAL_STATS_CUTOFF_SEASON } from "../lib/constants";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

interface HistoryEntry {
  season: string;
  entry_id?: string;
  entry_name?: string;
  manager_name?: string;
  final_rank?: number;
  total_points?: number;
  awards?: string;
  records?: string;
  [key: string]: any; // Allow additional fields from CSV
}

interface SeasonData {
  season: string;
  entries: HistoryEntry[];
}

interface LeagueHistoryResponse {
  seasons: SeasonData[];
}

export default function LeagueHistory() {
  const [data, setData] = useState<LeagueHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const { getCrest } = useManagerCrestMap();

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-history`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: LeagueHistoryResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch league history");
        }

        setData(payload);
        if (payload.seasons.length > 0 && !selectedSeason) {
          setSelectedSeason(payload.seasons[0].season);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load league history");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League History</h1>
        <p className="text-sm text-muted-foreground">Loading league history...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League History</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.seasons.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">League History</h1>
        <p className="text-sm text-muted-foreground">
          No historical data available. Historical data can be imported via CSV.
        </p>
      </Card>
    );
  }

  const currentSeason = data.seasons.find((s) => s.season === selectedSeason);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">League History</h1>
        <p className="text-sm text-muted-foreground">
          Historical league data from past seasons. Combines legacy CSV data (pre-2025/26) and computed data (2025/26+).
        </p>
      </div>

      {/* Season Selector */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {data.seasons.map((season) => (
            <button
              key={season.season}
              onClick={() => setSelectedSeason(season.season)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedSeason === season.season
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {season.season}
            </button>
          ))}
        </div>
      </Card>

      {/* Selected Season Standings */}
      {currentSeason && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">{currentSeason.season} Final Standings</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Team</TableHead>
                {currentSeason.entries[0]?.total_points !== undefined && (
                  <TableHead className="text-right">Total Points</TableHead>
                )}
                {currentSeason.entries[0]?.awards && (
                  <TableHead>Awards</TableHead>
                )}
                {currentSeason.entries[0]?.records && (
                  <TableHead>Records</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
                  {currentSeason.entries.map((entry, index) => {
                const isLegacy = entry.source === "legacy" || (entry.season && entry.season < HISTORICAL_STATS_CUTOFF_SEASON);
                // Use manager_name as key since it's the stable identifier
                const rowKey = entry.manager_name || entry.entry_id || `row-${index}`;
                return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-medium">
                      {entry.final_rank ?? index + 1}
                    </TableCell>
                    <TableCell>{entry.manager_name || "–"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCrest(entry.manager_name) ? (
                          <img
                            src={getCrest(entry.manager_name)!}
                            alt=""
                            className="h-4 w-4 rounded object-cover border"
                          />
                        ) : null}
                        <span>{entry.entry_name || (entry.entry_id ? `Entry ${entry.entry_id}` : "–")}</span>
                      </div>
                      {isLegacy && (
                        <span className="ml-2 text-xs text-muted-foreground">(Legacy)</span>
                      )}
                    </TableCell>
                    {entry.total_points !== undefined && (
                      <TableCell className="text-right font-medium">
                        {entry.total_points}
                      </TableCell>
                    )}
                    {entry.awards && (
                      <TableCell>{entry.awards}</TableCell>
                    )}
                    {entry.records && (
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.records}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Total Seasons</h3>
          <p className="text-2xl font-bold">{data.seasons.length}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Total Managers</h3>
          <p className="text-2xl font-bold">
            {new Set(
              data.seasons.flatMap((s) => s.entries.map((e) => e.entry_id || e.manager_name))
            ).size}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Most Recent</h3>
          <p className="text-lg">{data.seasons[0]?.season || "–"}</p>
        </Card>
      </div>
    </div>
  );
}
