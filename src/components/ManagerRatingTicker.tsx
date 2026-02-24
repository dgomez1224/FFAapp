/**
 * Manager Rating Ticker - Live Rating Display
 * 
 * Displays current manager ratings with deltas and trends.
 * Similar in prominence to FPL's league tables.
 * 
 * Can be used in:
 * - Global dashboard header/sidebar
 * - Manager Insights page
 * - H2H views
 */

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface ManagerRating {
  team_id: string;
  entry_id?: string;
  entry_name: string;
  manager_name: string;
  rating: number;
  rating_version: string;
  ppg: number;
  plus_g: number;
  seasons_played: number;
}

interface ManagerRatingWithDelta extends ManagerRating {
  delta?: number;
  trend?: "up" | "down" | "neutral";
}

interface ManagerRatingsResponse {
  ratings: ManagerRating[];
}

interface Props {
  compact?: boolean;
  showDelta?: boolean;
  maxItems?: number;
}

export function ManagerRatingTicker({ compact = false, showDelta = true, maxItems }: Props) {
  const [ratings, setRatings] = useState<ManagerRatingWithDelta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRatings() {
      try {
        setLoading(true);
        setError(null);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/manager-ratings`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: ManagerRatingsResponse = await res.json();

        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch ratings");
        }

        // Fetch previous ratings for delta calculation
        let ratingsWithDeltas = payload.ratings;
        if (showDelta) {
          // For now, we'll calculate delta from rating history if available
          // In a real implementation, you'd fetch the previous gameweek's rating
          ratingsWithDeltas = payload.ratings.map((rating) => ({
            ...rating,
            delta: 0, // TODO: Calculate from rating history
            trend: "neutral" as const,
          }));
        }

        if (maxItems) {
          ratingsWithDeltas = ratingsWithDeltas.slice(0, maxItems);
        }

        setRatings(ratingsWithDeltas);
      } catch (err: any) {
        setError(err.message || "Failed to load ratings");
      } finally {
        setLoading(false);
      }
    }

    fetchRatings();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRatings, 30000);
    return () => clearInterval(interval);
  }, [showDelta, maxItems]);

  if (loading) {
    return (
      <Card className={compact ? "p-2" : "p-4"}>
        <p className="text-sm text-muted-foreground">Loading ratings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? "p-2" : "p-4"}>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (ratings.length === 0) {
    return (
      <Card className={compact ? "p-2" : "p-4"}>
        <p className="text-sm text-muted-foreground">No ratings available yet.</p>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-4 overflow-x-auto">
        {ratings.map((rating, index) => (
          <div key={rating.team_id} className="flex items-center gap-2 min-w-fit">
            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
            <span className="text-sm font-semibold">{rating.manager_name}</span>
            <span className="text-sm font-bold">{rating.rating.toFixed(0)}</span>
            {showDelta && rating.delta !== undefined && (
              <span
                className={`text-xs ${
                  rating.delta > 0
                    ? "text-green-600"
                    : rating.delta < 0
                    ? "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {rating.delta > 0 ? "+" : ""}
                {rating.delta.toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Manager Ratings</h3>
        <p className="text-xs text-muted-foreground">FFA Rating V1</p>
      </div>
      <div className="space-y-2">
        {ratings.map((rating, index) => (
          <div
            key={rating.team_id}
            className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-sm font-medium text-muted-foreground w-6">
                #{index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{rating.manager_name}</p>
                <p className="text-xs text-muted-foreground truncate">{rating.entry_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold">{rating.rating.toFixed(0)}</p>
                {showDelta && rating.delta !== undefined && (
                  <p
                    className={`text-xs ${
                      rating.delta > 0
                        ? "text-green-600"
                        : rating.delta < 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {rating.delta > 0 ? "+" : ""}
                    {rating.delta.toFixed(1)}
                  </p>
                )}
              </div>
              {rating.trend && (
                <span
                  className={`text-xs ${
                    rating.trend === "up"
                      ? "text-green-600"
                      : rating.trend === "down"
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {rating.trend === "up" ? "↑" : rating.trend === "down" ? "↓" : "—"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
