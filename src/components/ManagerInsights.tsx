/**
 * Manager Insights - Public Read-Only
 * 
 * Provides detailed insights for each manager including:
 * - Average points per gameweek
 * - Captain efficiency
 * - Bench utilization
 * - Consistency metrics (variance/standard deviation)
 * - Historical performance trends
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { ManagerRatingTicker } from "./ManagerRatingTicker";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";

interface ManagerInsight {
  team_id: string;
  entry_name: string;
  manager_name: string;
  gameweeks_played: number;
  total_points: number;
  average_points_per_gameweek: number;
  captain_efficiency: number;
  total_captain_points: number;
  total_bench_points: number;
  consistency_std_dev: number;
  consistency_variance: number;
  highest_gameweek: number;
  lowest_gameweek: number;
}

interface ManagerInsightsResponse {
  insights: ManagerInsight[];
}

interface RatingHistoryEntry {
  season: string;
  gameweek: number;
  rating: number;
  rating_delta: number;
  delta_source: string | null;
}

interface RatingHistoryResponse {
  history: RatingHistoryEntry[];
}

export default function ManagerInsights() {
  const [data, setData] = useState<ManagerInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryResponse | null>(null);
  const { getCrest } = useManagerCrestMap();

  useEffect(() => {
    async function fetchInsights() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-insights`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: ManagerInsightsResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch manager insights");
        }

        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load manager insights");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Manager Insights</h1>
        <p className="text-sm text-muted-foreground">Loading manager insights...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Manager Insights</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data || data.insights.length === 0) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Manager Insights</h1>
        <p className="text-sm text-muted-foreground">No manager data available yet.</p>
      </Card>
    );
  }

  // Sort by average points per gameweek
  const sortedInsights = [...data.insights].sort(
    (a, b) => b.average_points_per_gameweek - a.average_points_per_gameweek
  );

  const handleTeamSelect = async (teamId: string) => {
    setSelectedTeamId(teamId);
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-ratings/history/${teamId}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload: RatingHistoryResponse = await res.json();
      if (res.ok) {
        setRatingHistory(payload);
      }
    } catch (err) {
      console.error("Failed to fetch rating history:", err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Manager Insights</h1>
        <p className="text-sm text-muted-foreground">
          Detailed analytics for each manager including consistency, captain efficiency, performance trends, and ratings.
        </p>
      </div>

      {/* Manager Rating Ticker */}
      <ManagerRatingTicker compact={false} showDelta={true} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ratings">Rating History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">GWs</TableHead>
                  <TableHead className="text-right">Total Pts</TableHead>
                  <TableHead className="text-right">Avg Pts/GW</TableHead>
                  <TableHead className="text-right">Captain Eff</TableHead>
                  <TableHead className="text-right">Std Dev</TableHead>
                  <TableHead className="text-right">High</TableHead>
                  <TableHead className="text-right">Low</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedInsights.map((insight) => (
                  <TableRow
                    key={insight.team_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTeamSelect(insight.team_id)}
                  >
                    <TableCell className="font-medium">{insight.manager_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCrest(insight.manager_name) ? (
                          <img
                            src={getCrest(insight.manager_name)!}
                            alt=""
                            className="h-4 w-4 rounded object-cover border"
                          />
                        ) : null}
                        <span>{insight.entry_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{insight.gameweeks_played}</TableCell>
                    <TableCell className="text-right font-medium">{insight.total_points}</TableCell>
                    <TableCell className="text-right">{insight.average_points_per_gameweek.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{insight.captain_efficiency.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <span className={insight.consistency_std_dev < 15 ? "text-green-600" : "text-orange-600"}>
                        {insight.consistency_std_dev.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-green-600">{insight.highest_gameweek}</TableCell>
                    <TableCell className="text-right text-red-600">{insight.lowest_gameweek}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="ratings" className="mt-4">
          {selectedTeamId && ratingHistory ? (
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Rating History</h3>
              {ratingHistory.history.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead>Gameweek</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ratingHistory.history.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.season}</TableCell>
                        <TableCell>GW {entry.gameweek}</TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.rating.toFixed(0)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            entry.rating_delta > 0
                              ? "text-green-600"
                              : entry.rating_delta < 0
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {entry.rating_delta > 0 ? "+" : ""}
                          {entry.rating_delta.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.delta_source || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No rating history available.</p>
              )}
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Select a manager from the overview table to view their rating history.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Consistency Legend</h3>
          <p className="text-sm text-muted-foreground">
            Standard deviation measures point consistency. Lower values indicate more consistent performance.
          </p>
          <ul className="text-sm mt-2 space-y-1">
            <li>• &lt; 15: Very consistent</li>
            <li>• 15-25: Moderately consistent</li>
            <li>• &gt; 25: Inconsistent</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Captain Efficiency</h3>
          <p className="text-sm text-muted-foreground">
            Average captain points per gameweek. Higher values indicate better captain selection.
          </p>
        </Card>
      </div>
    </div>
  );
}
