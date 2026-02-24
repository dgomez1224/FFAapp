/**
 * Managers Page - Cards overview
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface ManagerCardData {
  manager_name: string;
  total_points: number;
  points_per_game: number | null;
  league_titles: number;
  cup_wins: number;
  goblet_wins: number;
  best_gameweek_details: string | null;
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<ManagerCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadManagers() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/legacy-stats/all-time`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load all-time manager stats");
        }

        const merged = (payload?.stats || []).map((row: any) => ({
          manager_name: row.manager_name,
          total_points: row.total_points || 0,
          points_per_game: row.points_per_game ?? null,
          league_titles: row.league_titles ?? 0,
          cup_wins: row.cup_wins ?? 0,
          goblet_wins: row.goblet_wins ?? 0,
          best_gameweek_details: row.best_gameweek_details ?? null,
        }));

        setManagers(merged);
      } catch (err: any) {
        setError(err.message || "Failed to load managers");
      } finally {
        setLoading(false);
      }
    }

    loadManagers();
  }, []);

  const sortedManagers = useMemo(
    () => [...managers].sort((a, b) => b.total_points - a.total_points),
    [managers]
  );

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Managers</h1>
        <p className="text-sm text-muted-foreground">Loading managers…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Managers</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Managers</h1>
        <p className="text-sm text-muted-foreground mt-2">
          League leaders and all-time highlights. Profile photos will be added later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedManagers.map((manager) => {
          const blurb = [
            manager.league_titles ? `${manager.league_titles}x league titles` : null,
            manager.cup_wins ? `${manager.cup_wins}x cup wins` : null,
            manager.goblet_wins ? `${manager.goblet_wins}x goblet wins` : null,
          ]
            .filter(Boolean)
            .join(" • ") || "Building their legacy season by season.";

          return (
            <Card key={manager.manager_name} className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                  {manager.manager_name.slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{manager.manager_name}</h2>
                  <p className="text-xs text-muted-foreground">All-time points: {manager.total_points}</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">{blurb}</div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-muted/60 p-2 text-center">
                  <div className="text-xs text-muted-foreground">PPG</div>
                  <div className="font-semibold">
                    {manager.points_per_game ? manager.points_per_game.toFixed(2) : "—"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-center">
                  <div className="text-xs text-muted-foreground">Best GW</div>
                  <div className="font-semibold text-[11px] leading-tight">
                    {manager.best_gameweek_details ?? "—"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-center">
                  <div className="text-xs text-muted-foreground">Trophies</div>
                  <div className="font-semibold">
                    {manager.league_titles + manager.cup_wins + manager.goblet_wins}
                  </div>
                </div>
              </div>

              <Link
                to={`/manager/${manager.manager_name.toLowerCase()}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                View profile →
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
