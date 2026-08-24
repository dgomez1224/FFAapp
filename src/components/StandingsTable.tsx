import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import type { Standing } from "../lib/useDivisionStandings";

type StandingsTableProps = {
  rows: Standing[];
  baselineById: Record<string, Standing>;
  baselineRanksRef: React.MutableRefObject<Record<string, number> | null>;
  isLiveGameweek: boolean;
  showLiveColumns: boolean;
};

export function StandingsTable({
  rows,
  baselineById,
  baselineRanksRef,
  isLiveGameweek,
  showLiveColumns,
}: StandingsTableProps) {
  const { getCrest } = useManagerCrestMap();

  return (
    <div className="fpl-table-container">
      <Table>
        <TableHeader>
          <TableRow className="fpl-table-header">
            <TableHead className="w-12">Rank</TableHead>
            <TableHead className="w-12 text-center">Δ</TableHead>
            <TableHead>Manager</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">P</TableHead>
            <TableHead className="text-right">W</TableHead>
            <TableHead className="text-right">D</TableHead>
            <TableHead className="text-right">L</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right">For</TableHead>
            <TableHead className="text-right">Against</TableHead>
            <TableHead className="text-right">Avg Δ Win</TableHead>
            <TableHead className="text-right">Avg Δ Loss</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="fpl-table-body">
          {rows.map((standing) => {
            const baseline = baselineById[standing.team_id];
            const baselineRank = baselineRanksRef.current?.[standing.team_id] ?? null;
            const currentRank = standing.rank;
            const moved = baselineRank != null ? baselineRank - currentRank : 0;

            let deltaSymbol = "—";
            let deltaClass = "text-muted-foreground";
            if (isLiveGameweek && baselineRank != null) {
              if (moved > 0) {
                deltaSymbol = `↑${moved}`;
                deltaClass = "text-emerald-500 font-semibold";
              } else if (moved < 0) {
                deltaSymbol = `↓${Math.abs(moved)}`;
                deltaClass = "text-red-500 font-semibold";
              }
            }

            const winsChanged = showLiveColumns && baseline && standing.wins > baseline.wins;
            const drawsChanged = showLiveColumns && baseline && standing.draws > baseline.draws;
            const lossesChanged = showLiveColumns && baseline && standing.losses > baseline.losses;
            const pointsChanged = showLiveColumns && baseline && standing.points > baseline.points;
            const forChanged = showLiveColumns && baseline && standing.points_for > baseline.points_for;
            const againstChanged = showLiveColumns && baseline && standing.points_against > baseline.points_against;

            return (
              <TableRow key={standing.team_id}>
                <TableCell className="fpl-rank text-center">{standing.rank}</TableCell>
                <TableCell className={`text-center ${deltaClass}`}>{deltaSymbol}</TableCell>
                <TableCell className="fpl-manager-name">{standing.manager_name || "—"}</TableCell>
                <TableCell className="fpl-manager-name">
                  <div className="flex items-center gap-2">
                    {getCrest(standing.manager_name) ? (
                      <img
                        src={getCrest(standing.manager_name)!}
                        alt=""
                        className="h-4 w-4 rounded object-cover border"
                      />
                    ) : null}
                    <span>{standing.entry_name || "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="fpl-numeric">{standing.played}</TableCell>
                <TableCell className={`fpl-numeric${winsChanged ? " text-emerald-500 font-semibold" : ""}`}>
                  {standing.wins}
                </TableCell>
                <TableCell className={`fpl-numeric${drawsChanged ? " text-muted-foreground font-semibold" : ""}`}>
                  {standing.draws}
                </TableCell>
                <TableCell className={`fpl-numeric${lossesChanged ? " text-red-500 font-semibold" : ""}`}>
                  {standing.losses}
                </TableCell>
                <TableCell className={`fpl-points${pointsChanged ? " text-emerald-500 font-semibold" : ""}`}>
                  {standing.points}
                </TableCell>
                <TableCell className={`fpl-numeric${forChanged ? " text-emerald-500 font-semibold" : ""}`}>
                  {standing.points_for}
                </TableCell>
                <TableCell className={`fpl-numeric${againstChanged ? " text-red-500 font-semibold" : ""}`}>
                  {standing.points_against}
                </TableCell>
                <TableCell className="fpl-numeric">
                  {standing.avg_margin_victory != null ? standing.avg_margin_victory.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="fpl-numeric">
                  {standing.avg_margin_defeat != null ? standing.avg_margin_defeat.toFixed(1) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
