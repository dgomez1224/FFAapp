import React, { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import type { Division } from "../lib/divisions";

type LeaderLine = { manager_name: string; value: number; details: string | null };
type LeaderMetric = { value: number; leaders: LeaderLine[] };
type ViewMode = "all" | Division;

type Payload = {
  season_leaders: {
    points_in_gameweek: LeaderMetric;
    most_50_plus_gws: LeaderMetric;
    longest_win_streak: LeaderMetric;
    longest_unbeaten_streak: LeaderMetric;
    longest_losing_streak: LeaderMetric;
    longest_winless_streak: LeaderMetric;
  };
};

/** Strip season (e.g. "2025/26 - ") from details; current season is implied by the "Season Stat Leaders" header. */
function stripSeasonFromDetails(details: string) {
  return String(details || "").replace(/\d{4}\/\d{2}\s*-\s*/g, "").replace(/\s+/g, " ").trim();
}

function leaderText(metric?: LeaderMetric) {
  if (!metric?.leaders?.length) return "—";
  return metric.leaders
    .map((l) => {
      let details = l.details || "";
      details = stripSeasonFromDetails(details);
      const isPointsInGwFormat = details.startsWith(`${l.value}:`);
      if (isPointsInGwFormat) return `${l.manager_name} (${details})`;
      return `${l.manager_name} (${l.value} GW${details ? `: ${details}` : ""})`;
    })
    .join(" / ");
}

const VIEW_OPTIONS: Array<{ id: ViewMode; label: string }> = [
  { id: "all", label: "All league" },
  { id: "division_one", label: "Division 1" },
  { id: "division_two", label: "Division 2" },
];

export default function SeasonStatLeaders() {
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const params = viewMode === "all" ? "" : `?division=${encodeURIComponent(viewMode)}`;
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/leaders${params}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to load season leaders");
        setData(payload);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [viewMode]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Season Stat Leaders</h3>
        <div className="flex flex-wrap gap-1">
          {VIEW_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={viewMode === option.id ? "default" : "outline"}
              onClick={() => setViewMode(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading season leaders…</p>
      ) : (
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Points in a GW</TableCell>
              <TableCell>{leaderText(data?.season_leaders.points_in_gameweek)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Most 50+ GW&apos;s</TableCell>
              <TableCell>{leaderText(data?.season_leaders.most_50_plus_gws)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Longest Win Streak</TableCell>
              <TableCell>{leaderText(data?.season_leaders.longest_win_streak)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Longest Unbeaten Streak</TableCell>
              <TableCell>{leaderText(data?.season_leaders.longest_unbeaten_streak)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Longest Losing Streak</TableCell>
              <TableCell>{leaderText(data?.season_leaders.longest_losing_streak)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Longest Winless Streak</TableCell>
              <TableCell>{leaderText(data?.season_leaders.longest_winless_streak)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
