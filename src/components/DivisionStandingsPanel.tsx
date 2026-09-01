/**
 * Single-division standings panel (used in dual layout).
 */

import React from "react";
import { Card } from "./ui/card";
import { StandingsTable } from "./StandingsTable";
import { useDivisionStandings } from "../lib/useDivisionStandings";
import { getDivisionLabel, type Division } from "../lib/divisions";

type DivisionStandingsPanelProps = {
  division: Division;
  compact?: boolean;
  heading?: string;
};

export function DivisionStandingsPanel({ division, compact = false, heading }: DivisionStandingsPanelProps) {
  const {
    loading,
    error,
    rowsToRender,
    baselineById,
    fromRanks,
    showRankMovement,
    showLiveColumns,
  } = useDivisionStandings(division);

  const title = heading ?? getDivisionLabel(division);

  if (loading) {
    return (
      <Card className={compact ? "p-4" : "p-6"}>
        <h2 className={`${compact ? "text-lg" : "text-xl"} font-semibold mb-2`}>{title}</h2>
        <p className="text-sm text-muted-foreground">Loading standings...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? "p-4" : "p-6"}>
        <h2 className={`${compact ? "text-lg" : "text-xl"} font-semibold mb-2`}>{title}</h2>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className={`${compact ? "text-lg" : "text-xl"} font-semibold`}>{title}</h2>
      {division === "division_one" ? (
        <p className="text-xs text-muted-foreground">Bottom two places are in the relegation zone.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Top two places are in the promotion zone.</p>
      )}
      <Card className="min-w-0 overflow-x-auto p-4">
        <StandingsTable
          rows={rowsToRender}
          division={division}
          baselineById={baselineById}
          fromRanks={fromRanks}
          showRankMovement={showRankMovement}
          showLiveColumns={showLiveColumns}
        />
      </Card>
    </div>
  );
}
