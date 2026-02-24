import React, { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

type LeaderLine = { manager_name: string; value: number; details: string | null };
type LeaderMetric = { value: number; leaders: LeaderLine[] };

type Payload = {
  season: string;
  season_leaders: {
    points_in_gameweek: LeaderMetric;
    most_50_plus_gws: LeaderMetric;
    longest_win_streak: LeaderMetric;
    longest_unbeaten_streak: LeaderMetric;
    longest_losing_streak: LeaderMetric;
    longest_winless_streak: LeaderMetric;
  };
};

function leaderText(metric?: LeaderMetric) {
  if (!metric?.leaders?.length) return "—";
  return metric.leaders
    .map((l) => {
      const details = l.details || "";
      const isPointsInGwFormat = details.startsWith(`${l.value}:`);
      if (isPointsInGwFormat) return `${l.manager_name} (${details})`;
      return `${l.manager_name} (${l.value} GW${details ? `: ${details}` : ""})`;
    })
    .join(" / ");
}

export default function SeasonStatLeaders() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/leaders`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) throw new Error(payload?.error?.message || "Failed to load season leaders");
        setData(payload);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">Season Stat Leaders</h3>
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
